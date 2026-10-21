// Quotations (bearer; ?as= / body.as). GET ?lead=<id> → { quotes } · POST { lead_id, items[], discount_paise?, gst_pct?,
// valid_days?, note? } → { quote } with a PDF (pdf_url) · PATCH { id, status: sent|accepted|rejected|expired } → { quote, sale? }
// (accepted makes the sale). Sending the PDF on WhatsApp goes through /api/crm/send with fileUrl = pdf_url.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { restAsService } from "@/lib/poster-server";
import { isUuid, scopeFilter } from "@/lib/crm-pro";
import { quotesOf, createQuote, patchQuote } from "@/lib/crm-pro3";

export const maxDuration = 60;
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  const lead = p.get("lead");
  if (!scope || !isUuid(lead)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const ok = (await restAsService<{ id: string }[]>(`leads?id=eq.${lead}&${scopeFilter(scope)}&select=id&limit=1`)).data?.[0];
  if (!ok) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ quotes: await quotesOf(scope, lead) });
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.lead_id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const r = await createQuote(scope, b);
  return "error" in r ? NextResponse.json(r, { status: 400 }) : NextResponse.json({ quote: r });
}
export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.id) || !["sent", "accepted", "rejected", "expired"].includes(b.status)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const r = await patchQuote(scope, b.id, b.status);
  return r ? NextResponse.json(r) : NextResponse.json({ error: "Quotation not found." }, { status: 404 });
}
