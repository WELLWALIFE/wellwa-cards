// POST (bearer) { lead_id, as? } → click-to-call through the tenant's Shubhora number (Exotel Connect, docs/crm-pro.md 3.7):
// the caller's own mobile rings first, then the customer; the call is recorded; /api/phone/status fills in the rest.
// Answers 409 when the tenant has no outbound line (the app then dials with tel: as in phase 1).
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope, addEvent } from "@/lib/crm-server";
import { isUuid, CALL_COLS, type CallRow } from "@/lib/crm-pro";
import { outboundLine, exotelReady, exotelConnect, callerMobile } from "@/lib/crm-pro2";
import { SITE_URL } from "@/lib/site-url";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.lead_id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const line = await outboundLine(scope.ownerId);
  if (!line || !exotelReady()) return NextResponse.json({ error: "no_line" }, { status: 409 });
  const lead = (await restAsService<{ id: string; phone: string; name: string }[]>(`leads?id=eq.${b.lead_id}&owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}&select=id,phone,name&limit=1`)).data?.[0];
  if (!lead?.phone) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const from = await callerMobile(scope);
  if (!from) return NextResponse.json({ error: "Add your own mobile number on your card first — Exotel rings it before the customer." }, { status: 400 });
  const token = process.env.CRON_KEY || process.env.INTERNAL_KEY || "";
  const row = { owner_id: scope.ownerId, lead_id: lead.id, agent_id: scope.userId, direction: "out", channel: "exotel", status: "ringing", started_at: new Date().toISOString(), from_number: from.replace(/\D/g, "") };
  const ins = await restAsService<CallRow[]>(`crm_calls?select=${CALL_COLS}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  const call = Array.isArray(ins.data) ? ins.data[0] : null;
  if (!call) return NextResponse.json({ error: "Could not start the call. Please try again." }, { status: 502 });
  const r = await exotelConnect({ from, to: lead.phone, callerId: line.caller_id || line.number, record: true, callbackUrl: `${SITE_URL}/api/phone/status?k=${encodeURIComponent(token)}&call=${call.id}` });
  if (!r.ok) {
    await restAsService(`crm_calls?id=eq.${call.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", note: r.error.slice(0, 200) }) });
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  await restAsService(`crm_calls?id=eq.${call.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ provider_sid: r.sid }) });
  await addEvent(scope.token, scope.ownerId, lead.id, "call", "📞 Calling through the Shubhora number…").catch(() => null);
  return NextResponse.json({ call: { ...call, provider_sid: r.sid } });
}
