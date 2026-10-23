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
import { logCall, patchCall, createTask, nextServiceAfter, isUuid, OUTCOMES, OUTCOME_TEXT, CALL_COLS, TASK_KINDS, AI_STOP_TAG, type Outcome, type CallRow, type TaskKind } from "@/lib/crm-pro";

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
  const lead = (await restAsService<{ id: string; phone: string; name: string; status: string; tags: string[] | null; lost_reason: string | null }[]>(`leads?id=eq.${b.lead_id}&owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}&select=id,phone,name,status,tags,lost_reason&limit=1`)).data?.[0];
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const outcome: Outcome = (OUTCOMES as readonly string[]).includes(b.outcome) ? b.outcome : "unknown";
  const notInterested = outcome === "not_interested";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) : "";
  let call: CallRow | null;
  if (isUuid(b.call_id)) {
    // A call through the Shubhora number (Exotel) already has its row — with the real duration and the recording — so the
    // outcome sheet completes that row instead of logging the same call a second time.
    const r = await restAsService<CallRow[]>(`crm_calls?id=eq.${b.call_id}&owner_id=eq.${scope.ownerId}&lead_id=eq.${lead.id}${scope.role === "agent" ? `&agent_id=eq.${scope.userId}` : ""}&select=${CALL_COLS}`, { method: "PATCH", body: JSON.stringify({ outcome, note, status: "done" }), headers: { Prefer: "return=representation" } });
    call = Array.isArray(r.data) ? r.data[0] ?? null : null;
    // That row was not found (another agent's call, a lead merged since): the outcome is still saved, as its own call.
    if (!call) call = await logCall(scope, { lead_id: lead.id, outcome, seconds: Number(b.seconds) || 0, note, started_at: iso(b.started_at) ?? undefined });
    else if (note) await addEvent(scope.token, scope.ownerId, lead.id, "note", `📞 ${note.slice(0, 200)}`).catch(() => null);
  } else {
    call = await logCall(scope, { lead_id: lead.id, outcome, seconds: Number(b.seconds) || 0, note, started_at: iso(b.started_at) ?? undefined });
  }
  // "Not interested" is a call outcome since migration 0075; before it is run the database refuses it, so the call is kept as
  // "connected" with the words in its note (everything else below still happens).
  if (!call && notInterested) call = await logCall(scope, { lead_id: lead.id, outcome: "connected", seconds: Number(b.seconds) || 0, note: `Not interested${note ? ` — ${note}` : ""}`.slice(0, 1000), started_at: iso(b.started_at) ?? undefined });
  if (!call) return NextResponse.json({ error: "Could not save the call. Please try again." }, { status: 502 });
  // The call that was due is done (owner, 23 Oct 2026: "Start calling" kept opening the same customer first, because the follow-up
  // stayed open after the call). Every open call / WhatsApp follow-up of this customer that is due now or within the hour is closed
  // with this outcome; the next one, if the owner picked one below, is made fresh.
  {
    const soon = new Date(Date.now() + 60 * 60_000).toISOString();
    const closed = await restAsService<{ lead_id: string | null; text: string; title: string }[]>(`crm_tasks?lead_id=eq.${lead.id}&owner_id=eq.${scope.ownerId}&done_at=is.null&kind=in.(call,whatsapp)&due_at=lte.${encodeURIComponent(soon)}&select=lead_id,text,title`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ done_at: new Date().toISOString(), outcome: `Call: ${OUTCOME_TEXT[call.outcome] ?? call.outcome}`.slice(0, 200) }) }).catch(() => null);
    // A service reminder that was due makes the next one (lib/crm-pro.ts) — not when the customer said they are not interested.
    if (!notInterested) for (const t of Array.isArray(closed?.data) ? closed!.data : []) await nextServiceAfter(scope, t);
  }
  let task = null;
  if (b.next && typeof b.next === "object") {
    const due = iso(b.next.due_at);
    if (due) task = await createTask(scope, { lead_id: lead.id, kind: (TASK_KINDS as readonly string[]).includes(b.next.kind) ? (b.next.kind as TaskKind) : "call", title: String(b.next.title ?? "").trim() || "Call again", due_at: due, source: "manual" });
  }
  if (typeof b.stage === "string" && (STAGES as readonly string[]).includes(b.stage) && b.stage !== lead.status) {
    await restAsService(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: b.stage, updated_at: new Date().toISOString() }) });
    await addEvent(scope.token, scope.ownerId, lead.id, "status", `Stage → ${b.stage.replace("_", " ")}`).catch(() => null);
  }
  // Not interested (owner, 23 Oct 2026): the customer is marked lost, their open follow-ups are closed, and every automatic message
  // stops — the AI does not reply or follow up (bridge / Cloud check the tag), and wishes and broadcasts skip them (opted_out).
  if (notInterested) {
    const now = new Date().toISOString();
    const tags = [...new Set([...(lead.tags ?? []), AI_STOP_TAG])].slice(0, 12);
    await restAsService(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "lost", tags, opted_out: true, ...(lead.lost_reason ? {} : { lost_reason: "Not interested" }), updated_at: now }) });
    await restAsService(`crm_tasks?lead_id=eq.${lead.id}&owner_id=eq.${scope.ownerId}&done_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ done_at: now, outcome: "not interested" }) }).catch(() => null);
    if (lead.status !== "lost") await addEvent(scope.token, scope.ownerId, lead.id, "status", "Stage → lost (not interested) · AI messages stopped").catch(() => null);
    return NextResponse.json({ call, task: null, sent: null });
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
