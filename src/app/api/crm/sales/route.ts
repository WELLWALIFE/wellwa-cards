// Sales (bearer; ?as= / body.as). GET ?lead=<id> → { sales } · POST { lead_id, items[], amount_paise?, paid_paise?, method?,
// note?, sold_at? } → { sale } (marks the lead Won) · PATCH { id, paid_paise?, status?: "refunded", note?, method? } → { sale }
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { isUuid } from "@/lib/crm-pro";
import { salesOf, createSale, patchSale } from "@/lib/crm-pro3";
import { restAsService } from "@/lib/poster-server";
import { scopeFilter } from "@/lib/crm-pro";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  const lead = p.get("lead");
  if (!scope || !isUuid(lead)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const ok = (await restAsService<{ id: string }[]>(`leads?id=eq.${lead}&${scopeFilter(scope)}&select=id&limit=1`)).data?.[0];
  if (!ok) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ sales: await salesOf(scope, lead) });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.lead_id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const r = await createSale(scope, b);
  return "error" in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json({ sale: r });
}
export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.id) || scope.role === "agent") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const sale = await patchSale(scope, b.id, b);
  return sale ? NextResponse.json({ sale }) : NextResponse.json({ error: "Sale not found." }, { status: 404 });
}
