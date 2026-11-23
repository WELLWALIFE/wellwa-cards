// Mobile shop settings: the shop on the bill, GST, paper size, counter discount limit, staff rights. GET also lists the staff logins.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanMsSetup } from "@/lib/mobile";
import { msCtx, msDenied, msHas, saveMsSetup } from "@/lib/mobile-server";

export async function GET(request: Request) {
  const c = await msCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  const staff = msHas(c.access, "setup")
    ? (await restAsService<{ id: string; name: string; phone: string; role: string }[]>(`crm_agents?owner_id=eq.${c.scope.ownerId}&active=is.true&select=id,name,phone,role&order=created_at`)).data ?? []
    : [];
  return NextResponse.json({ setup: c.setup, access: c.access, staff });
}

export async function PUT(request: Request) {
  const b = (await request.json().catch(() => null)) as { as?: string; setup?: unknown } | null;
  if (!b?.setup) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const c = await msCtx(request, b.as ?? null);
  if (!c.ok) return c.res;
  if (!msHas(c.access, "setup")) return msDenied("change settings");
  const raw = (b.setup ?? {}) as { gstOn?: unknown; gstin?: unknown };
  const next = cleanMsSetup(b.setup);
  if (raw.gstOn === true && !next.gstOn) return NextResponse.json({ error: "To charge GST, type your 15-character GSTIN." }, { status: 400 });
  if (!c.access.owner) next.staff = c.setup.staff;   // only the owner gives staff rights
  if (!(await saveMsSetup(c.scope.ownerId, next))) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, setup: next });
}
