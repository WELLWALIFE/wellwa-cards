// Personal numbers, kept out of the CRM and away from the AI for good (lib/crm-block.ts). Owner and managers only.
//   GET    ?as=                         → { numbers }
//   POST   { lead_id | phone, as? }     → blocks the number, removes its leads and chat → { ok, removed, number }
//   DELETE ?phone=&as=                  → takes it off the list
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { blockedOf, blockNumber, unblockNumber } from "@/lib/crm-block";
import { isUuid } from "@/lib/crm-pro";

async function scopeOf(request: Request, as: unknown) {
  const me = await userFromRequest(request);
  if (!me) return { err: NextResponse.json({ error: "Please log in." }, { status: 401 }) } as const;
  const scope = await resolveScope(me, typeof as === "string" ? as : null);
  if (!scope || scope.role === "agent") return { err: NextResponse.json({ error: "Only the owner or a manager can do this." }, { status: 403 }) } as const;
  return { scope } as const;
}

export async function GET(request: Request) {
  const s = await scopeOf(request, new URL(request.url).searchParams.get("as"));
  if ("err" in s) return s.err;
  return NextResponse.json({ numbers: await blockedOf(s.scope.ownerId) });
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const s = await scopeOf(request, b.as);
  if ("err" in s) return s.err;
  let phone = typeof b.phone === "string" ? b.phone : "";
  if (isUuid(b.lead_id)) {
    const lead = (await restAsService<{ phone: string }[]>(`leads?id=eq.${b.lead_id}&owner_id=eq.${s.scope.ownerId}&select=phone&limit=1`)).data?.[0];
    if (!lead) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    phone = lead.phone;
  }
  const r = await blockNumber(s.scope.ownerId, phone).catch(() => null);
  if (!r) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
  if (!r.ok) return NextResponse.json({ error: "This customer has no proper mobile number." }, { status: 400 });
  return NextResponse.json(r);
}

export async function DELETE(request: Request) {
  const p = new URL(request.url).searchParams;
  const s = await scopeOf(request, p.get("as"));
  if ("err" in s) return s.err;
  const ok = await unblockNumber(s.scope.ownerId, p.get("phone") ?? "").catch(() => false);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
}
