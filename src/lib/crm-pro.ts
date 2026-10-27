// CRM Pro (phase 1, owner's call 21 Oct 2026 — docs/crm-pro.md): the Today screen, the paginated customer list,
// a customer's full picture (tasks, calls, one timeline), tasks and call logging. Everything here is scoped to a
// workspace (owner id + the caller's role from resolveScope): an agent sees only leads assigned to them. Writes go
// through the service role after that check, exactly like /api/crm/lead; reads of the lead rows use LEAD_COLS + the
// phase-1 columns from migration 0068.
import { restAsService } from "@/lib/poster-server";
import { LEAD_COLS, addEvent, type LeadRow, type Scope } from "@/lib/crm-server";

export const PRO_COLS = `${LEAD_COLS},kind,alt_phone,business,address,pincode,birthday,anniversary,lang,product_ids,budget_paise,last_activity_at,last_call_at,calls_count,opted_out`;
export type LeadPro = LeadRow & {
  kind: "lead" | "customer" | "lost"; alt_phone: string; business: string; address: string; pincode: string; birthday: string | null; anniversary: string | null;
  lang: string; product_ids: string[]; budget_paise: number; last_activity_at: string; last_call_at: string | null; calls_count: number; opted_out: boolean;
  /** Filled for lists (enrich): the customer's own last WhatsApp line (not ours), and the last call's outcome and note. */
  last_in?: { text: string; at: string } | null; last_call?: { at: string; outcome: string; note: string } | null;
};
export const TASK_KINDS = ["call", "whatsapp", "visit", "meeting", "other"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export type TaskRow = { id: string; owner_id: string; lead_id: string | null; assigned_to: string | null; created_by: string | null; kind: TaskKind; title: string; text: string; due_at: string; remind_at: string | null; reminded_at: string | null; done_at: string | null; outcome: string; source: string; created_at: string };
export const TASK_COLS = "id,owner_id,lead_id,assigned_to,created_by,kind,title,text,due_at,remind_at,reminded_at,done_at,outcome,source,created_at";
export const OUTCOMES = ["connected", "no_answer", "busy", "switched_off", "wrong_number", "call_back", "not_interested", "unknown"] as const;
/** The tag that stops every automatic message to a customer (AI replies, follow-ups, wishes, broadcasts) — set by "Not interested". */
export const AI_STOP_TAG = "not-interested";
/** Set by the WhatsApp AI when a chat is personal (family, friends): no AI reply, and the customer is kept out of Today, the
 *  call list and the main list — only the "Personal" filter shows them (owner, 23 Oct 2026). "not-personal" = the owner said
 *  it is a customer after all: the AI never marks it personal again. */
export const PERSONAL_TAG = "personal";
export const NOT_PERSONAL_TAG = "not-personal";
const NOT_PERSONAL_LEADS = "tags=not.cs.%7Bpersonal%7D";
export type Outcome = (typeof OUTCOMES)[number];
export type CallRow = { id: string; owner_id: string; lead_id: string | null; agent_id: string | null; direction: "out" | "in"; channel: "phone" | "exotel" | "ai"; status: string; started_at: string; seconds: number; outcome: Outcome; note: string; recording_url: string | null; created_at: string };
export const CALL_COLS = "id,owner_id,lead_id,agent_id,direction,channel,status,started_at,seconds,outcome,note,recording_url,created_at";
export type BookingLite = { id: string; lead_id: string | null; name: string; phone: string; service: string; starts_at: string; status: string };
export type CrmPrefs = { ask_outcome: boolean; retry_after_min: number; missed_call_wa: boolean; missed_call_text: string; auto_task_new_lead: boolean; daily_summary: boolean; birthday_wish: boolean; stale_days: number; round_robin: boolean; call_target: number; sales_target_k: number };
export const DEFAULT_PREFS: CrmPrefs = { ask_outcome: true, retry_after_min: 180, missed_call_wa: false, missed_call_text: "Namaste {name} ji 🙏 {business} se call kiya tha, baat nahi ho paayi. Jab suvidha ho, is number par call ya message kar dein.", auto_task_new_lead: false, daily_summary: false, birthday_wish: false, stale_days: 7, round_robin: false, call_target: 0, sales_target_k: 0 };

const list = <T,>(r: { data: T[] | null }): T[] => (Array.isArray(r.data) ? r.data : []);
const enc = encodeURIComponent;
export const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const OPEN = "status=not.in.(converted,won,lost)";

/** The PostgREST filter that limits a workspace to what this caller may see. */
export function scopeFilter(scope: Scope): string {
  return `owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}`;
}

/** Someone a lead or task of this workspace may be assigned to: the owner, or a joined, active team member. */
export async function isTeamMember(ownerId: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  if (userId === ownerId) return true;
  return list(await restAsService<{ id: string }[]>(`crm_agents?owner_id=eq.${ownerId}&agent_user_id=eq.${userId}&active=is.true&select=id&limit=1`)).length > 0;
}

export async function prefsOf(ownerId: string): Promise<CrmPrefs> {
  const r = (await restAsService<{ crm: Partial<CrmPrefs> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`)).data?.[0];
  return { ...DEFAULT_PREFS, ...(r?.crm ?? {}) };
}
export async function savePrefs(ownerId: string, patch: Partial<CrmPrefs>): Promise<CrmPrefs> {
  const next = { ...(await prefsOf(ownerId)), ...patch };
  await restAsService("owner_prefs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: ownerId, crm: next, updated_at: new Date().toISOString() }) });
  return next;
}

/* ---------------- list ---------------- */
export type ListQuery = { q?: string; stage?: string; kind?: string; tag?: string; /** At least this many stars (tags star:1..star:5). */ stars?: number; source?: string; assigned?: string; city?: string; due?: string; idle?: number; sort?: string; page?: number };
export async function listLeads(scope: Scope, qy: ListQuery): Promise<{ leads: LeadPro[]; page: number; more: boolean }> {
  const page = Math.max(0, qy.page ?? 0), size = 50;
  const f: string[] = [scopeFilter(scope)];
  // Characters that are syntax inside a PostgREST or=(...) list (and the ilike wildcards) are dropped from the search.
  const q = (qy.q ?? "").trim().replace(/[,.()"\\*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (q) {
    const like = `*${q}*`;
    // "+91 98765 43210" / "98765-43210" must still find "+919876543210": also match the digits alone against the phone.
    // A number pasted with its country code ("+91 98765 43210", "919876543210") is matched on its last 10 digits, so a number saved without
    // (or with) the 91 is still found; the other phone (alt_phone) is searched too.
    const d0 = q.replace(/\D/g, ""), dq = d0.length > 10 ? d0.slice(-10) : d0;
    const byDigits = dq.length >= 4 ? `,phone.ilike.${enc(`*${dq}*`)},alt_phone.ilike.${enc(`*${dq}*`)}` : "";
    f.push(`or=(name.ilike.${enc(like)},phone.ilike.${enc(like)}${byDigits},city.ilike.${enc(like)},business.ilike.${enc(like)},ai_intent.ilike.${enc(like)},message.ilike.${enc(like)})`);
  }
  if (qy.stage) f.push(`status=eq.${enc(qy.stage)}`);
  if (qy.kind) f.push(`kind=eq.${enc(qy.kind)}`);
  if (qy.tag) f.push(`tags=cs.${enc(`{${qy.tag.replace(/[{}",\\]/g, "")}}`)}`);
  if (qy.tag !== PERSONAL_TAG && !q) f.push(NOT_PERSONAL_LEADS);
  if (qy.stars && qy.stars >= 1 && qy.stars <= 5) f.push(`tags=ov.${enc(`{${[1, 2, 3, 4, 5].filter((n) => n >= qy.stars!).map((n) => `star:${n}`).join(",")}}`)}`);   // personal chats only under their own filter (a search still finds them)
  if (qy.source) f.push(`source=eq.${enc(qy.source)}`);
  if (qy.city) f.push(`city=ilike.${enc(qy.city)}`);
  if (qy.assigned === "me") f.push(`assigned_to=eq.${scope.userId}`);
  else if (qy.assigned === "none") f.push("assigned_to=is.null");
  else if (isUuid(qy.assigned)) f.push(`assigned_to=eq.${qy.assigned}`);
  // End of today in IST (the server runs in UTC: setHours() would end "today" at 05:30 IST tomorrow).
  if (qy.due === "today") f.push(`next_follow_up=lt.${enc(istDayBounds().end)}`, OPEN);
  else if (qy.due === "overdue") f.push(`next_follow_up=lt.${enc(new Date().toISOString())}`, OPEN);
  else if (qy.due === "any") f.push("next_follow_up=not.is.null", OPEN);
  if (qy.idle && qy.idle > 0) f.push(`last_activity_at=lt.${enc(new Date(Date.now() - qy.idle * 86400000).toISOString())}`, OPEN);
  const order = qy.sort === "newest" ? "created_at.desc" : qy.sort === "followup" ? "next_follow_up.asc.nullslast,last_activity_at.desc" : qy.sort === "value" ? "value_paise.desc,last_activity_at.desc" : qy.sort === "score" ? "score.desc,last_activity_at.desc" : "last_activity_at.desc";
  const rows = list(await restAsService<LeadPro[]>(`leads?${f.join("&")}&select=${PRO_COLS}&order=${order}&limit=${size + 1}&offset=${page * size}`));
  return { leads: await enrichLeads(scope.ownerId, rows.slice(0, size)), page, more: rows.length > size };
}


/* ---------------- what a list row shows (owner, 26 Oct 2026: "jo customer ne kaha / last call ka note", not our own auto message) ---------------- */
/** Adds each lead's last inbound WhatsApp line and its last call (outcome + note): two reads for the whole page. */
export async function enrichLeads(ownerId: string, leads: LeadPro[]): Promise<LeadPro[]> {
  if (!leads.length) return leads;
  const phones = [...new Set(leads.map((l) => l.phone).filter(Boolean))].slice(0, 120);
  const ids = leads.map((l) => l.id).filter((id) => isUuid(id)).slice(0, 120);
  const inList = (xs: string[]) => xs.map((x) => `"${x.replace(/"/g, "")}"`).join(",");
  const [msgs, calls] = await Promise.all([
    phones.length ? restAsService<{ phone: string; text: string; sent_at: string }[]>(`wa_messages?owner_id=eq.${ownerId}&direction=eq.in&phone=in.(${enc(inList(phones))})&text=neq.&select=phone,text,sent_at&order=sent_at.desc&limit=${Math.min(1500, phones.length * 12)}`).catch(() => null) : null,
    ids.length ? restAsService<{ lead_id: string; started_at: string; outcome: string; note: string | null }[]>(`crm_calls?owner_id=eq.${ownerId}&lead_id=in.(${ids.join(",")})&select=lead_id,started_at,outcome,note&order=started_at.desc&limit=${Math.min(1500, ids.length * 10)}`).catch(() => null) : null,
  ]);
  const lastIn = new Map<string, { text: string; at: string }>();
  for (const m of msgs ? list(msgs) : []) if (!lastIn.has(m.phone)) lastIn.set(m.phone, { text: (m.text ?? "").slice(0, 160), at: m.sent_at });
  const lastCall = new Map<string, { at: string; outcome: string; note: string }>();
  for (const c of calls ? list(calls) : []) if (!lastCall.has(c.lead_id)) lastCall.set(c.lead_id, { at: c.started_at, outcome: c.outcome, note: (c.note ?? "").slice(0, 160) });
  return leads.map((l) => ({ ...l, last_in: lastIn.get(l.phone) ?? null, last_call: lastCall.get(l.id) ?? null }));
}

/* ---------------- today ---------------- */
export type TodayItem = { lead: LeadPro; task?: TaskRow; booking?: BookingLite; why: string };
export type Today = { overdue: TodayItem[]; due: TodayItem[]; unread: TodayItem[]; fresh: TodayItem[]; bookings: TodayItem[]; callbacks: TodayItem[]; cold: TodayItem[]; counts: { due: number; unread: number; fresh: number; hot: number; calledToday: number; target: number } };
/** Start and end (exclusive) of today in IST, as UTC ISO strings. */
function istDayBounds(): { start: string; end: string } {
  const startIst = new Date(Date.now() + 5.5 * 3600_000); startIst.setUTCHours(0, 0, 0, 0);
  return { start: new Date(startIst.getTime() - 5.5 * 3600_000).toISOString(), end: new Date(startIst.getTime() + 86400000 - 5.5 * 3600_000).toISOString() };
}
export async function today(scope: Scope): Promise<Today> {
  const now = new Date();
  const { start: dayStart, end: dayEnd } = istDayBounds();
  const sf = scopeFilter(scope);
  const taskF = scope.role === "agent" ? `owner_id=eq.${scope.ownerId}&assigned_to=eq.${scope.userId}` : `owner_id=eq.${scope.ownerId}`;
  const [tasks, unread, fresh, bookings, cold, calls, prefs] = await Promise.all([
    restAsService<TaskRow[]>(`crm_tasks?${taskF}&done_at=is.null&due_at=lt.${enc(dayEnd)}&select=${TASK_COLS}&order=due_at&limit=200`),
    restAsService<LeadPro[]>(`leads?${sf}&unread=gt.0&${NOT_PERSONAL_LEADS}&select=${PRO_COLS}&order=last_message_at.desc&limit=50`),
    restAsService<LeadPro[]>(`leads?${sf}&${NOT_PERSONAL_LEADS}&created_at=gte.${enc(new Date(now.getTime() - 86400000).toISOString())}&calls_count=eq.0&status=eq.new&select=${PRO_COLS}&order=created_at.desc&limit=50`),
    restAsService<BookingLite[]>(`bookings?owner_id=eq.${scope.ownerId}&status=eq.booked&starts_at=gte.${enc(dayStart)}&starts_at=lt.${enc(dayEnd)}&select=id,lead_id,name,phone,service,starts_at,status&order=starts_at&limit=50`),
    restAsService<LeadPro[]>(`leads?${sf}&${NOT_PERSONAL_LEADS}&status=in.(interested,follow_up)&last_activity_at=lt.${enc(new Date(now.getTime() - 3 * 86400000).toISOString())}&next_follow_up=is.null&select=${PRO_COLS}&order=last_activity_at&limit=30`),
    restAsService<{ id: string }[]>(`crm_calls?owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&agent_id=eq.${scope.userId}` : ""}&status=eq.done&started_at=gte.${enc(dayStart)}&select=id&limit=500`),
    prefsOf(scope.ownerId),
  ]);
  const taskRows = list(tasks);
  const ids = new Set<string>([...taskRows.map((t) => t.lead_id).filter(Boolean) as string[], ...list(bookings).map((b) => b.lead_id).filter(Boolean) as string[]]);
  const leadsById = new Map<string, LeadPro>();
  // Scoped like every other read: an agent only gets the leads assigned to them (a task or booking on someone else's lead is dropped).
  if (ids.size) for (const l of list(await restAsService<LeadPro[]>(`leads?${sf}&id=in.(${[...ids].join(",")})&select=${PRO_COLS}&limit=300`))) leadsById.set(l.id, l);
  const overdue: TodayItem[] = [], due: TodayItem[] = [];
  for (const t of taskRows) {
    const lead = t.lead_id ? leadsById.get(t.lead_id) : undefined;
    // A sold customer's service reminder still shows (repeat business); every other task on a closed lead does not.
    const service = serviceMonths(t.text) > 0 && lead && lead.status !== "lost";
    if (!lead || (["converted", "won", "lost"].includes(lead.status) && !service) || (lead.tags ?? []).includes(PERSONAL_TAG)) continue;
    (t.due_at < dayStart ? overdue : due).push({ lead, task: t, why: t.title || t.kind });
  }
  const unreadItems = list(unread).map((lead) => ({ lead, why: `${lead.unread} unread` }));
  const freshItems = list(fresh).map((lead) => ({ lead, why: lead.source }));
  const bookingItems = list(bookings).filter((b) => scope.role !== "agent" || (b.lead_id && leadsById.has(b.lead_id))).map((b) => ({ lead: (b.lead_id && leadsById.get(b.lead_id)) || ({ id: b.lead_id ?? `b-${b.id}`, name: b.name, phone: b.phone, status: "booked", tags: [], unread: 0, score: 0 } as unknown as LeadPro), booking: b, why: b.service }));
  // AI-answered calls that asked for a call back and have no open task yet.
  let callbacks: TodayItem[] = [];
  if (scope.role !== "agent") {
    const cb = list(await restAsService<{ id: string; caller: string; lead_id: string | null; summary: string; started_at: string }[]>(`phone_calls?owner_id=eq.${scope.ownerId}&intent=eq.callback&started_at=gte.${enc(new Date(now.getTime() - 3 * 86400000).toISOString())}&select=id,caller,lead_id,summary,started_at&order=started_at.desc&limit=20`));
    const need = cb.filter((c) => c.lead_id && !taskRows.some((t) => t.lead_id === c.lead_id));
    const cbIds = need.map((c) => c.lead_id as string).filter((id) => !leadsById.has(id));
    if (cbIds.length) for (const l of list(await restAsService<LeadPro[]>(`leads?owner_id=eq.${scope.ownerId}&id=in.(${cbIds.join(",")})&select=${PRO_COLS}`))) leadsById.set(l.id, l);
    callbacks = need.map((c) => ({ lead: leadsById.get(c.lead_id as string) as LeadPro, why: c.summary })).filter((x) => x.lead);
  }
  const coldItems = list(cold).map((lead) => ({ lead, why: lead.ai_next || lead.ai_intent || "" }));
  const hot = (await restAsService<{ id: string }[]>(`leads?${sf}&score=gte.70&${OPEN}&select=id&limit=200`)).data?.length ?? 0;
  // One enrich for every lead on the screen (a lead in two sections is the same object).
  const all = [...overdue, ...due, ...unreadItems, ...freshItems, ...bookingItems, ...callbacks, ...coldItems];
  const rich = new Map((await enrichLeads(scope.ownerId, [...new Map(all.filter((x) => isUuid(x.lead.id)).map((x) => [x.lead.id, x.lead])).values()])).map((l) => [l.id, l]));
  for (const x of all) { const r = rich.get(x.lead.id); if (r) x.lead = r; }
  return { overdue, due, unread: unreadItems, fresh: freshItems, bookings: bookingItems, callbacks, cold: coldItems, counts: { due: overdue.length + due.length, unread: unreadItems.reduce((n, x) => n + (x.lead.unread || 0), 0), fresh: freshItems.length, hot, calledToday: list(calls).length, target: prefs.call_target } };
}

/* ---------------- one customer ---------------- */
export type TimelineItem = { id: string; at: string; kind: "message" | "event" | "call" | "task" | "task_done" | "booking"; icon: string; text: string; sub?: string; who?: string; data?: Record<string, unknown> };
export async function leadFull(scope: Scope, id: string): Promise<{ lead: LeadPro; tasks: TaskRow[]; calls: CallRow[]; timeline: TimelineItem[]; bookings: BookingLite[] } | null> {
  const lead = list(await restAsService<LeadPro[]>(`leads?id=eq.${id}&${scopeFilter(scope)}&select=${PRO_COLS}&limit=1`))[0];
  if (!lead) return null;
  const [tasks, calls, events, msgs, bookings] = await Promise.all([
    restAsService<TaskRow[]>(`crm_tasks?lead_id=eq.${id}&select=${TASK_COLS}&order=done_at.asc.nullsfirst,due_at&limit=100`),
    restAsService<CallRow[]>(`crm_calls?lead_id=eq.${id}&select=${CALL_COLS}&order=started_at.desc&limit=100`),
    restAsService<{ id: string; kind: string; text: string; created_at: string }[]>(`lead_events?lead_id=eq.${id}&select=id,kind,text,created_at&order=created_at.desc&limit=150`),
    restAsService<{ id: string; direction: string; sender: string; kind: string; text: string; sent_at: string }[]>(`wa_messages?owner_id=eq.${lead.owner_id}&phone=eq.${enc(lead.phone)}&select=id,direction,sender,kind,text,sent_at&order=sent_at.desc&limit=400`),
    restAsService<BookingLite[]>(`bookings?lead_id=eq.${id}&select=id,lead_id,name,phone,service,starts_at,status&order=starts_at.desc&limit=30`),
  ]);
  const tl: TimelineItem[] = [];
  // Messages collapse per day: "12 messages · last: …" — the Chat tab has every one.
  const byDay = new Map<string, { n: number; last: { text: string; sent_at: string; direction: string } }>();
  for (const m of list(msgs)) { const d = new Date(m.sent_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); const cur = byDay.get(d); if (!cur) byDay.set(d, { n: 1, last: m }); else cur.n += 1; }
  for (const [d, v] of byDay) tl.push({ id: `m-${d}`, at: v.last.sent_at, kind: "message", icon: "💬", text: `${v.n} message${v.n > 1 ? "s" : ""}`, sub: `${v.last.direction === "in" ? "←" : "→"} ${v.last.text.slice(0, 120)}` });
  for (const e of list(events)) if (!["call", "task", "task_done"].includes(e.kind)) tl.push({ id: `e-${e.id}`, at: e.created_at, kind: "event", icon: e.kind === "status" ? "🏷" : e.kind === "followup" ? "⏰" : e.kind === "sent" ? "📤" : e.kind === "ai" ? "✦" : e.kind === "created" ? "✨" : "📝", text: e.text });
  for (const c of list(calls)) tl.push({ id: `c-${c.id}`, at: c.started_at, kind: "call", icon: c.direction === "in" ? "📲" : "📞", text: c.outcome, sub: [c.seconds ? `${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, "0")}` : "", c.note].filter(Boolean).join(" · "), data: { outcome: c.outcome, seconds: c.seconds, recording_url: c.recording_url, channel: c.channel } });
  for (const t of list(tasks)) { tl.push({ id: `t-${t.id}`, at: t.created_at, kind: "task", icon: "☐", text: t.title || t.kind, sub: t.due_at, data: { kind: t.kind, due_at: t.due_at } }); if (t.done_at) tl.push({ id: `td-${t.id}`, at: t.done_at, kind: "task_done", icon: "☑", text: t.title || t.kind, sub: t.outcome }); }
  for (const b of list(bookings)) tl.push({ id: `b-${b.id}`, at: b.starts_at, kind: "booking", icon: "📅", text: b.service || "Booking", sub: b.status });
  tl.sort((a, b) => (a.at < b.at ? 1 : -1));
  return { lead, tasks: list(tasks), calls: list(calls), timeline: tl.slice(0, 300), bookings: list(bookings) };
}

/* ---------------- tasks ---------------- */
export async function createTask(scope: Scope, t: { lead_id: string | null; kind: TaskKind; title: string; text?: string; due_at: string; assigned_to?: string | null; remind_at?: string | null; source?: string }): Promise<TaskRow | null> {
  // No assignee given: an agent's own task is theirs; the owner's / a manager's task on a lead goes to whoever has that lead,
  // so it shows on that agent's Today screen (it filters tasks by assigned_to).
  let assignee = t.assigned_to ?? (scope.role === "agent" ? scope.userId : null);
  if (t.assigned_to === undefined && scope.role !== "agent" && t.lead_id) {
    assignee = (await restAsService<{ assigned_to: string | null }[]>(`leads?id=eq.${t.lead_id}&owner_id=eq.${scope.ownerId}&select=assigned_to&limit=1`)).data?.[0]?.assigned_to ?? null;
  }
  const row = { owner_id: scope.ownerId, lead_id: t.lead_id, assigned_to: assignee, created_by: scope.userId, kind: t.kind, title: t.title.slice(0, 120), text: (t.text ?? "").slice(0, 1000), due_at: t.due_at, remind_at: t.remind_at ?? null, source: t.source ?? "manual" };
  const r = await restAsService<TaskRow[]>(`crm_tasks?select=${TASK_COLS}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  const task = Array.isArray(r.data) ? r.data[0] : null;
  if (task && t.lead_id) await addEvent(scope.token, scope.ownerId, t.lead_id, "task", `${t.kind === "call" ? "📞" : t.kind === "whatsapp" ? "💬" : t.kind === "visit" ? "🚶" : t.kind === "meeting" ? "🤝" : "☐"} ${t.title || t.kind} · ${fmtIst(t.due_at)}`).catch(() => null);
  return task;
}
/* ---------------- service / filter reminders (owner, 23 Oct 2026: repeat business) ---------------- */
/** A service reminder carries "[service:N]" at the start of its text: N months between services. When one is done, the next
 *  one is made N months later — once per customer (an open one already there is left alone). */
const SERVICE_RE = /^\[service:(\d{1,2})\]/;
export const serviceMonths = (text: string) => { const m = SERVICE_RE.exec(text ?? ""); const n = m ? Number(m[1]) : 0; return n >= 1 && n <= 36 ? n : 0; };
/** 11 am IST, N months after `from`. */
export function monthsLater(from: Date, n: number): string {
  const x = new Date(from.getTime() + 5.5 * 3600_000); x.setUTCMonth(x.getUTCMonth() + n); x.setUTCHours(11, 0, 0, 0);
  return new Date(x.getTime() - 5.5 * 3600_000).toISOString();
}
export async function createServiceTask(scope: Scope, leadId: string, months: number, what: string, from = new Date()): Promise<TaskRow | null> {
  if (months < 1 || months > 36) return null;
  const open = list(await restAsService<{ id: string }[]>(`crm_tasks?lead_id=eq.${leadId}&owner_id=eq.${scope.ownerId}&done_at=is.null&text=like.${enc("[service:*")}&select=id&limit=1`));
  if (open.length) return null;
  return createTask(scope, { lead_id: leadId, kind: "call", title: `🔧 Service${what ? ` — ${what}` : ""}`.slice(0, 120), text: `[service:${months}] ${what}`.slice(0, 1000), due_at: monthsLater(from, months), source: "auto" });
}
/** A finished service reminder makes the next one. */
export async function nextServiceAfter(scope: Scope, t: Pick<TaskRow, "lead_id" | "text" | "title">): Promise<void> {
  const n = serviceMonths(t.text);
  if (!n || !t.lead_id) return;
  await createServiceTask(scope, t.lead_id, n, t.text.replace(SERVICE_RE, "").trim()).catch(() => null);
}
export async function patchTask(scope: Scope, id: string, p: { done?: boolean; outcome?: string; snooze_to?: string; due_at?: string; title?: string; kind?: TaskKind; text?: string; assigned_to?: string | null }): Promise<TaskRow | null> {
  const before = list(await restAsService<TaskRow[]>(`crm_tasks?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${TASK_COLS}&limit=1`))[0];
  if (!before || (scope.role === "agent" && before.assigned_to && before.assigned_to !== scope.userId)) return null;
  const patch: Record<string, unknown> = {};
  if (p.done === true) { patch.done_at = new Date().toISOString(); patch.outcome = (p.outcome ?? "").slice(0, 200); }
  if (p.done === false) { patch.done_at = null; }
  if (p.snooze_to) { patch.due_at = p.snooze_to; patch.remind_at = null; patch.reminded_at = null; }
  if (p.due_at) { patch.due_at = p.due_at; patch.reminded_at = null; }
  if (typeof p.title === "string") patch.title = p.title.slice(0, 120);
  if (typeof p.text === "string") patch.text = p.text.slice(0, 1000);
  if (p.kind && (TASK_KINDS as readonly string[]).includes(p.kind)) patch.kind = p.kind;
  if (p.assigned_to !== undefined && scope.role !== "agent") patch.assigned_to = p.assigned_to;
  const r = await restAsService<TaskRow[]>(`crm_tasks?id=eq.${id}&select=${TASK_COLS}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } });
  const task = Array.isArray(r.data) ? r.data[0] : null;
  if (task && task.lead_id) {
    if (p.done === true) await addEvent(scope.token, scope.ownerId, task.lead_id, "task_done", `☑ ${task.title || task.kind}${task.outcome ? ` — ${task.outcome}` : ""}`).catch(() => null);
    if (p.done === true && !before.done_at) await nextServiceAfter(scope, task);
    else if (p.snooze_to) await addEvent(scope.token, scope.ownerId, task.lead_id, "followup", `⏰ ${task.title || task.kind} → ${fmtIst(task.due_at)}`).catch(() => null);
  }
  return task;
}
export async function deleteTask(scope: Scope, id: string): Promise<boolean> {
  const r = await restAsService(`crm_tasks?id=eq.${id}&owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return r.ok;
}

/* ---------------- calls ---------------- */
export async function logCall(scope: Scope, c: { lead_id: string; outcome: Outcome; seconds: number; note: string; started_at?: string; direction?: "out" | "in"; channel?: "phone" | "exotel" }): Promise<CallRow | null> {
  const row = { owner_id: scope.ownerId, lead_id: c.lead_id, agent_id: scope.userId, direction: c.direction ?? "out", channel: c.channel ?? "phone", status: "done", started_at: c.started_at ?? new Date().toISOString(), seconds: Math.max(0, Math.min(86400, Math.round(c.seconds || 0))), outcome: c.outcome, note: c.note.slice(0, 1000) };
  const r = await restAsService<CallRow[]>(`crm_calls?select=${CALL_COLS}`, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
  const call = Array.isArray(r.data) ? r.data[0] : null;
  if (call) await addEvent(scope.token, scope.ownerId, c.lead_id, "call", `📞 ${OUTCOME_TEXT[c.outcome] ?? c.outcome}${c.seconds ? ` · ${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, "0")}` : ""}${c.note ? ` — ${c.note.slice(0, 200)}` : ""}`).catch(() => null);
  return call;
}
export async function patchCall(scope: Scope, id: string, p: { outcome?: Outcome; seconds?: number; note?: string }): Promise<CallRow | null> {
  const patch: Record<string, unknown> = {};
  if (p.outcome && (OUTCOMES as readonly string[]).includes(p.outcome)) patch.outcome = p.outcome;
  if (typeof p.seconds === "number") patch.seconds = Math.max(0, Math.min(86400, Math.round(p.seconds)));
  if (typeof p.note === "string") patch.note = p.note.slice(0, 1000);
  const r = await restAsService<CallRow[]>(`crm_calls?id=eq.${id}&owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&agent_id=eq.${scope.userId}` : ""}&select=${CALL_COLS}`, { method: "PATCH", body: JSON.stringify(patch), headers: { Prefer: "return=representation" } });
  return Array.isArray(r.data) ? r.data[0] ?? null : null;
}
export const OUTCOME_TEXT: Record<string, string> = { connected: "Connected", no_answer: "No answer", busy: "Busy", switched_off: "Switched off", wrong_number: "Wrong number", call_back: "Call back later", not_interested: "Not interested", unknown: "Call" };

export const fmtIst = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
