// CRM Pro phase 2 (docs/crm-pro.md 3.7, 3.12, 3.2 bulk): Exotel click-to-call, reports, bulk actions.
import { restAsService } from "@/lib/poster-server";
import { STAGES, addEvent, type Scope } from "@/lib/crm-server";
import { sendCustomer } from "@/lib/customer-send";
import { CALL_COLS, isUuid, isTeamMember, scopeFilter, type CallRow } from "@/lib/crm-pro";

const list = <T,>(r: { data: T[] | null }): T[] => (Array.isArray(r.data) ? r.data : []);
const enc = encodeURIComponent;

/* ---------------- Exotel click-to-call ----------------
 * One Exotel account for Shubhora (env); one virtual number per tenant in phone_lines (outbound = true, caller_id =
 * the number customers see). Connect API: Exotel rings From (the agent's own mobile) first, then dials To (the customer),
 * both legs through the virtual number; the status callback lands on /api/phone/status. */
export type PhoneLine = { number: string; provider: string; label: string; active: boolean; caller_id: string; outbound: boolean };
export async function outboundLine(ownerId: string): Promise<PhoneLine | null> {
  const r = await restAsService<PhoneLine[]>(`phone_lines?owner_id=eq.${ownerId}&active=is.true&outbound=is.true&select=number,provider,label,active,caller_id,outbound&limit=1`);
  if (!r.ok && /column|does not exist/i.test(r.text)) return null;   // 0068 not run yet
  return r.data?.[0] ?? null;
}
export const exotelReady = () => !!(process.env.EXOTEL_SID && process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN);
const e164 = (p: string) => { const d = String(p ?? "").replace(/\D/g, ""); return d.length === 10 ? `0${d}` : d.length === 12 && d.startsWith("91") ? `0${d.slice(2)}` : d ? `+${d}` : ""; };

export async function exotelConnect(o: { from: string; to: string; callerId: string; callbackUrl: string; record: boolean }): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const sid = process.env.EXOTEL_SID!, key = process.env.EXOTEL_API_KEY!, token = process.env.EXOTEL_API_TOKEN!;
  const host = process.env.EXOTEL_SUBDOMAIN || "api.exotel.com";
  const body = new URLSearchParams({ From: e164(o.from), To: e164(o.to), CallerId: o.callerId.replace(/\D/g, "").replace(/^91(\d{10})$/, "0$1"), Record: o.record ? "true" : "false", StatusCallback: o.callbackUrl, "StatusCallbackEvents[0]": "terminal", StatusCallbackContentType: "application/json", TimeLimit: String(60 * Math.max(1, Number(process.env.PHONE_MAX_CALL_MIN || 10))) });
  try {
    const r = await fetch(`https://${host}/v1/Accounts/${sid}/Calls/connect.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${key}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15000) });
    const j = (await r.json().catch(() => ({}))) as { Call?: { Sid?: string }; RestException?: { Message?: string } };
    if (!r.ok || !j.Call?.Sid) return { ok: false, error: j.RestException?.Message || `Exotel ${r.status}` };
    return { ok: true, sid: j.Call.Sid };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** The agent's own mobile that Exotel rings first: the crm_agents row, else the owner's card number / login mobile. */
export async function callerMobile(scope: Scope): Promise<string> {
  if (scope.role !== "owner") {
    const a = (await restAsService<{ phone: string }[]>(`crm_agents?owner_id=eq.${scope.ownerId}&agent_user_id=eq.${scope.userId}&select=phone&limit=1`)).data?.[0];
    if (a?.phone) return a.phone;
  }
  const card = (await restAsService<{ data: { phone?: string; whatsapp?: string } }[]>(`cards?owner_id=eq.${scope.ownerId}&order=created_at.asc&limit=1&select=data`)).data?.[0]?.data;
  return card?.phone || card?.whatsapp || "";
}

/** Exotel's status callback → the call row (by Sid). Fields differ a little between accounts; read generously. */
export async function applyCallStatus(b: Record<string, unknown>, callId?: string | null): Promise<boolean> {
  const sid = String(b.CallSid ?? b.Sid ?? b.sid ?? "");
  if (!sid) return false;
  // /api/crm/call saves provider_sid only after Exotel answers the Connect request; a callback that wins that race finds
  // the row by the id carried in the callback URL instead (and only while it has no Sid yet).
  if (isUuid(callId)) await restAsService(`crm_calls?id=eq.${callId}&provider_sid=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ provider_sid: sid }) });
  const status = String(b.Status ?? b.CallStatus ?? "").toLowerCase();
  const seconds = Number(b.ConversationDuration ?? b.Duration ?? b.Legs?.toString?.() ?? 0) || 0;
  const rec = typeof b.RecordingUrl === "string" ? b.RecordingUrl : null;
  const done = ["completed", "busy", "no-answer", "failed", "canceled", "cancelled"].includes(status);
  const outcome = status === "completed" ? (seconds > 0 ? "connected" : "no_answer") : status === "busy" ? "busy" : status === "no-answer" ? "no_answer" : status ? "no_answer" : "unknown";
  const patch: Record<string, unknown> = { status: done ? "done" : status === "in-progress" ? "in_progress" : "ringing", seconds: Math.max(0, Math.round(seconds)) };
  if (done) patch.outcome = outcome;
  if (rec) patch.recording_url = rec;
  const r = await restAsService<CallRow[]>(`crm_calls?provider_sid=eq.${enc(sid)}&select=${CALL_COLS}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (row && done && row.lead_id) await restAsService("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: row.owner_id, lead_id: row.lead_id, kind: "call", text: `📞 ${outcome.replace("_", " ")}${seconds ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : ""} (Shubhora number)` }) }).catch(() => null);
  return !!row;
}

/* ---------------- reports ---------------- */
export type Reports = {
  days: number;
  calls: { made: number; connected: number; avgSeconds: number; byDay: { day: string; made: number; connected: number }[]; byAgent: { id: string; made: number; connected: number; seconds: number }[]; outcomes: { outcome: string; count: number }[] };
  tasks: { done: number; onTime: number; overdueOpen: number; openTotal: number };
  bySource: { source: string; leads: number; won: number; value: number }[];
  lost: { reason: string; count: number }[];
  stages: { stage: string; count: number; value: number }[];
  leads: { total: number; newInRange: number; wonInRange: number; wonValue: number; customers: number; idle7: number };
};
export async function reports(scope: Scope, days: number): Promise<Reports> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const sf = scopeFilter(scope);
  const agentF = scope.role === "agent" ? `&agent_id=eq.${scope.userId}` : "";
  const [calls, tasks, leads] = await Promise.all([
    restAsService<{ agent_id: string | null; started_at: string; seconds: number; outcome: string }[]>(`crm_calls?owner_id=eq.${scope.ownerId}${agentF}&status=eq.done&started_at=gte.${enc(since)}&select=agent_id,started_at,seconds,outcome&limit=5000`),
    restAsService<{ due_at: string; done_at: string | null }[]>(`crm_tasks?owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}&or=(done_at.gte.${enc(since)},done_at.is.null)&select=due_at,done_at&limit=5000`),
    restAsService<{ source: string; status: string; kind: string; value_paise: number; lost_reason: string; created_at: string; updated_at: string; last_activity_at: string }[]>(`leads?${sf}&select=source,status,kind,value_paise,lost_reason,created_at,updated_at,last_activity_at&limit=5000`),
  ]);
  const C = list(calls), T = list(tasks), Ls = list(leads);
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const byDayM = new Map<string, { day: string; made: number; connected: number }>();
  for (let i = Math.min(days, 30) - 1; i >= 0; i -= 1) { const k = dayKey(new Date(Date.now() - i * 86400000).toISOString()); byDayM.set(k, { day: k, made: 0, connected: 0 }); }
  const byAgentM = new Map<string, { id: string; made: number; connected: number; seconds: number }>();
  const outcomesM = new Map<string, number>();
  let connected = 0, secs = 0;
  for (const c of C) {
    const d = byDayM.get(dayKey(c.started_at)); if (d) { d.made += 1; if (c.outcome === "connected") d.connected += 1; }
    const a = byAgentM.get(c.agent_id ?? "") ?? { id: c.agent_id ?? "", made: 0, connected: 0, seconds: 0 }; a.made += 1; if (c.outcome === "connected") { a.connected += 1; a.seconds += c.seconds; connected += 1; secs += c.seconds; } byAgentM.set(a.id, a);
    outcomesM.set(c.outcome, (outcomesM.get(c.outcome) ?? 0) + 1);
  }
  const now = Date.now();
  const done = T.filter((t) => t.done_at), onTime = done.filter((t) => new Date(t.done_at as string).getTime() <= new Date(t.due_at).getTime() + 3600_000).length;
  const open = T.filter((t) => !t.done_at), overdueOpen = open.filter((t) => new Date(t.due_at).getTime() < now).length;
  const won = (s: string) => s === "converted" || s === "won";
  const srcM = new Map<string, { source: string; leads: number; won: number; value: number }>();
  const lostM = new Map<string, number>();
  const stM = new Map<string, { stage: string; count: number; value: number }>(STAGES.map((s) => [s, { stage: s, count: 0, value: 0 }]));
  let newInRange = 0, wonInRange = 0, wonValue = 0, customers = 0, idle7 = 0;
  for (const l of Ls) {
    const s = srcM.get(l.source || "other") ?? { source: l.source || "other", leads: 0, won: 0, value: 0 }; s.leads += 1; if (won(l.status)) { s.won += 1; s.value += l.value_paise || 0; } srcM.set(s.source, s);
    if (l.status === "lost") { const k = (l.lost_reason || "").trim() || "—"; lostM.set(k, (lostM.get(k) ?? 0) + 1); }
    const sk = won(l.status) ? "converted" : (STAGES as readonly string[]).includes(l.status) ? l.status : "new"; const st = stM.get(sk)!; st.count += 1; st.value += l.value_paise || 0;
    if (l.created_at >= since) newInRange += 1;
    if (won(l.status) && l.updated_at >= since) { wonInRange += 1; wonValue += l.value_paise || 0; }
    if (l.kind === "customer") customers += 1;
    if (!won(l.status) && l.status !== "lost" && new Date(l.last_activity_at).getTime() < now - 7 * 86400000) idle7 += 1;
  }
  return {
    days,
    calls: { made: C.length, connected, avgSeconds: connected ? Math.round(secs / connected) : 0, byDay: [...byDayM.values()], byAgent: [...byAgentM.values()].sort((a, b) => b.made - a.made), outcomes: [...outcomesM.entries()].map(([outcome, count]) => ({ outcome, count })).sort((a, b) => b.count - a.count) },
    tasks: { done: done.length, onTime, overdueOpen, openTotal: open.length },
    bySource: [...srcM.values()].sort((a, b) => b.leads - a.leads),
    lost: [...lostM.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    stages: [...stM.values()],
    leads: { total: Ls.length, newInRange, wonInRange, wonValue, customers, idle7 },
  };
}

/* ---------------- bulk ---------------- */
export type BulkAction = "assign" | "stage" | "tag" | "untag" | "send";
export async function bulk(scope: Scope, ids: string[], action: BulkAction, value: string | null): Promise<{ done: number; failed: number; skipped: number }> {
  const clean = ids.filter(isUuid).slice(0, 200);
  if (!clean.length) return { done: 0, failed: 0, skipped: 0 };
  const rows = list(await restAsService<{ id: string; phone: string; name: string; tags: string[]; status: string; opted_out: boolean }[]>(`leads?${scopeFilter(scope)}&id=in.(${clean.join(",")})&select=id,phone,name,tags,status,opted_out&limit=200`));
  let done = 0, failed = 0, skipped = clean.length - rows.length;
  const stamp = new Date().toISOString();
  // Leads go only to someone in this team (the owner or a joined, active agent) — never to an arbitrary user id.
  if (action === "assign" && value && !(await isTeamMember(scope.ownerId, value))) return { done: 0, failed: 0, skipped: clean.length };
  const patchLead = async (id: string, body: Record<string, unknown>) => {
    const r = await restAsService(`leads?id=eq.${id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.text.slice(0, 200));
  };
  for (const l of rows) {
    try {
      if (action === "assign") {
        if (scope.role === "agent") { skipped += 1; continue; }
        await patchLead(l.id, { assigned_to: value || null, updated_at: stamp });
        await addEvent(scope.token, scope.ownerId, l.id, "assign", value ? "Assigned (bulk)" : "Unassigned (bulk)").catch(() => null);
      } else if (action === "stage") {
        if (!value || !(STAGES as readonly string[]).includes(value) || value === l.status) { skipped += 1; continue; }
        await patchLead(l.id, { status: value, updated_at: stamp });
        await addEvent(scope.token, scope.ownerId, l.id, "status", `Stage → ${value.replace("_", " ")}`).catch(() => null);
      } else if (action === "tag" || action === "untag") {
        const t = String(value ?? "").trim().replace(/^#/, "").slice(0, 24); if (!t) { skipped += 1; continue; }
        const tags = action === "tag" ? [...new Set([...(l.tags ?? []), t])] : (l.tags ?? []).filter((x) => x !== t);
        await patchLead(l.id, { tags, updated_at: stamp });
      } else if (action === "send") {
        const text = String(value ?? "").trim(); if (!text || l.opted_out || !l.phone) { skipped += 1; continue; }
        const first = (l.name || "").split(/\s+/)[0] || "";
        const ok = await sendCustomer(scope.ownerId, l.phone, text.replace(/\{name\}/g, first).replace(/\s+ji\b/g, first ? " ji" : ""));
        if (!ok) { failed += 1; continue; }
        await addEvent(scope.token, scope.ownerId, l.id, "sent", `📤 ${text.slice(0, 120)}`).catch(() => null);
        await new Promise((r) => setTimeout(r, 1200));   // paced: one every ~1.2 s from the owner's own number
      }
      done += 1;
    } catch { failed += 1; }
  }
  return { done, failed, skipped };
}
