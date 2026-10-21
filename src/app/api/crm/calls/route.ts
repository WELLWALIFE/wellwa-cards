// Call log (bearer; ?as= / body.as). Phase 1 = tap-to-call from the phone, the app asks what happened on return
// (docs/crm-pro.md 3.6); phase 2 adds Exotel rows through /api/crm/call.
//   GET ?lead=<id> | ?days=7                                      → { calls }
//   POST { lead_id, outcome, seconds, note, started_at?, next?: { kind, title, due_at }, stage?, wa_text? } → { call, task? }
//     next = a follow-up task made in the same tap; stage = a stage change (connected → interested …);
//     wa_text = a WhatsApp message to send right away from the owner's linked number ("missed you").
//   PATCH { id, outcome?, seconds?, note? }                          → { call }
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope, addEvent, STAGES } from "@/lib/crm-server";
import { sendCustomer } from "@/lib/customer-send";
import { logCall, patchCall, createTask, isUuid, OUTCOMES, CALL_COLS, TASK_KINDS, type Outcome, type CallRow, type TaskKind } from "@/lib/crm-pro";

const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const f = [`owner_id=eq.${scope.ownerId}`];
  if (scope.role === "agent") f.push(`agent_id=eq.${scope.userId}`);
  const lead = p.get("lead"); if (isUuid(lead)) f.push(`lead_id=eq.${lead}`);
  const days = Number(p.get("days") ?? 0); if (days > 0) f.push(`started_at=gte.${encodeURIComponent(new Date(Date.now() - days * 86400000).toISOString())}`);
  const r = await restAsService<CallRow[]>(`crm_calls?${f.join("&")}&select=${CALL_COLS}&order=started_at.desc&limit=500`);
  return NextResponse.json({ calls: Array.isArray(r.data) ? r.data : [] });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.lead_id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = (await restAsService<{ id: string; phone: string; name: string; status: string }[]>(`leads?id=eq.${b.lead_id}&owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}&select=id,phone,name,status&limit=1`)).data?.[0];
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const outcome: Outcome = (OUTCOMES as readonly string[]).includes(b.outcome) ? b.outcome : "unknown";
  const call = await logCall(scope, { lead_id: lead.id, outcome, seconds: Number(b.seconds) || 0, note: typeof b.note === "string" ? b.note.trim() : "", started_at: iso(b.started_at) ?? undefined });
  if (!call) return NextResponse.json({ error: "Could not save the call. Please try again." }, { status: 502 });
  let task = null;
  if (b.next && typeof b.next === "object") {
    const due = iso(b.next.due_at);
    if (due) task = await createTask(scope, { lead_id: lead.id, kind: (TASK_KINDS as readonly string[]).includes(b.next.kind) ? (b.next.kind as TaskKind) : "call", title: String(b.next.title ?? "").trim() || "Call again", due_at: due, source: "manual" });
  }
  if (typeof b.stage === "string" && (STAGES as readonly string[]).includes(b.stage) && b.stage !== lead.status) {
    await restAsService(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: b.stage, updated_at: new Date().toISOString() }) });
    await addEvent(scope.token, scope.ownerId, lead.id, "status", `Stage → ${b.stage.replace("_", " ")}`).catch(() => null);
  }
  let sent: boolean | null = null;
  if (typeof b.wa_text === "string" && b.wa_text.trim()) {
    sent = await sendCustomer(scope.ownerId, lead.phone, b.wa_text.trim().slice(0, 1500)).catch(() => false);
    if (sent) await addEvent(scope.token, scope.ownerId, lead.id, "sent", `📤 ${b.wa_text.trim().slice(0, 120)}`).catch(() => null);
  }
  return NextResponse.json({ call, task, sent });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const call = await patchCall(scope, b.id, { outcome: b.outcome, seconds: typeof b.seconds === "number" ? b.seconds : undefined, note: typeof b.note === "string" ? b.note : undefined });
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  return NextResponse.json({ call });
}
