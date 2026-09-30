// WhatsApp CRM server helpers (bearer routes under /api/crm).
// Reads go through Supabase REST as the caller (RLS); the unread reset, AI
// insight writes and template use-counts go through the service role.
// Sending goes to the tenant's WhatsApp worker via the bridge manager, exactly
// like /api/wa/send, but flagged asOwner so the bot mutes for 15 minutes.
import { restAsUser, restAsService, userHeaders } from "@/lib/poster-server";
import { businessContext } from "@/lib/reviews-server";
import { SUPA_URL } from "@/lib/admin-guard";

const BRIDGE = "http://127.0.0.1:8787";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

export const STAGES = ["new", "contacted", "interested", "follow_up", "converted", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export type LeadRow = {
  id: string; owner_id: string; card_id: string | null; assigned_to: string | null; name: string; phone: string; email: string; message: string; source: string; status: string; score: number;
  notes: string; next_follow_up: string | null; value_paise: number; lost_reason: string; tags: string[]; last_message_at: string | null; unread: number;
  ai_intent: string; ai_sentiment: string; ai_summary: string; ai_next: string; ai_at: string | null; city: string; created_at: string; updated_at: string;
};
export type MsgRow = { id: string; direction: "in" | "out"; sender: "customer" | "bot" | "owner"; kind: string; text: string; sent_at: string; sent_by?: string | null };
export type EventRow = { id: string; kind: string; text: string; created_at: string };
export type TemplateRow = { id: string; name: string; shortcut: string; body: string; uses: number };

export const LEAD_COLS = "id,owner_id,card_id,assigned_to,name,phone,email,message,source,status,score,notes,next_follow_up,value_paise,lost_reason,tags,last_message_at,unread,ai_intent,ai_sentiment,ai_summary,ai_next,ai_at,city,created_at,updated_at";

const list = <T,>(r: { data: T[] | null }): T[] => (Array.isArray(r.data) ? r.data : []);

export async function inbox(token: string, ownerId: string): Promise<LeadRow[]> {
  return list(await restAsUser<LeadRow[]>(token, `leads?owner_id=eq.${ownerId}&select=${LEAD_COLS}&order=last_message_at.desc.nullslast,created_at.desc&limit=500`));
}

/** The lead, only if the caller can read it AND it belongs to the workspace being acted on. */
export async function leadById(token: string, id: string, ownerId?: string): Promise<LeadRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const l = list(await restAsUser<LeadRow[]>(token, `leads?id=eq.${id}&select=${LEAD_COLS}&limit=1`))[0] ?? null;
  return l && (!ownerId || l.owner_id === ownerId) ? l : null;
}

export async function messagesFor(token: string, ownerId: string, phone: string): Promise<MsgRow[]> {
  return list(await restAsUser<MsgRow[]>(token, `wa_messages?owner_id=eq.${ownerId}&phone=eq.${encodeURIComponent(phone)}&select=id,direction,sender,kind,text,sent_at,sent_by&order=sent_at.desc&limit=300`)).reverse();
}

export async function eventsFor(token: string, leadId: string): Promise<EventRow[]> {
  return list(await restAsUser<EventRow[]>(token, `lead_events?lead_id=eq.${leadId}&select=id,kind,text,created_at&order=created_at.desc&limit=100`));
}

export async function templatesFor(token: string, ownerId: string): Promise<TemplateRow[]> {
  return list(await restAsUser<TemplateRow[]>(token, `wa_templates?owner_id=eq.${ownerId}&select=id,name,shortcut,body,uses&order=uses.desc,created_at`));
}

export async function addEvent(token: string, ownerId: string, leadId: string, kind: string, text: string) {
  await restAsUser(token, "lead_events", { method: "POST", body: JSON.stringify({ owner_id: ownerId, lead_id: leadId, kind, text: text.slice(0, 500) }), headers: { Prefer: "return=minimal" } });
}

export async function markRead(userId: string, leadId: string) {
  await restAsService(`leads?id=eq.${leadId}&owner_id=eq.${userId}`, { method: "PATCH", body: JSON.stringify({ unread: 0 }), headers: { Prefer: "return=minimal" } });
}

/** The tenant's plan expiry as the bridge manager wants it (or null when the plan can't use WhatsApp). */
const FAR_EXPIRY = "2999-12-31T23:59:59.000Z";
export async function waPlanExpiry(token: string): Promise<string | null> {
  const rpc = async (name: string) => {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: userHeaders(token), body: "{}", cache: "no-store" });
    const j = await r.json().catch(() => null);
    return (Array.isArray(j) ? j[0] : j) as Record<string, unknown> | null;
  };
  // A card plan (pro / team, incl. the trial) …
  const plan = await rpc("my_plan");
  if (plan && ["pro", "team"].includes(String(plan.plan)) && !plan.expired) return String(plan.expires_at || FAR_EXPIRY);
  // … or a running Shubhora subscription (Growth / Pro both include the WhatsApp assistant + CRM).
  const saas = await rpc("my_saas");
  if (saas && saas.tier && saas.tier !== "none" && ["active", "grace"].includes(String(saas.state))) return String(saas.expires_at || FAR_EXPIRY);
  return null;
}

/** Same check for an owner the caller works for (agent view) — service-role read of the owner's plan. */
export async function ownerPlanExpiry(ownerId: string): Promise<string | null> {
  const p = (await restAsService<{ plan: string; plan_expires_at: string | null; saas_expires_at: string | null }[]>(`profiles?id=eq.${ownerId}&select=plan,plan_expires_at,saas_expires_at`)).data?.[0];
  if (!p) return null;
  const cardOk = ["pro", "team"].includes(p.plan) && !(p.plan_expires_at && new Date(p.plan_expires_at).getTime() < Date.now());
  if (cardOk) return p.plan_expires_at || FAR_EXPIRY;
  if (p.saas_expires_at && new Date(p.saas_expires_at).getTime() > Date.now()) return p.saas_expires_at;
  return null;
}

/* ---------------- team / scope ----------------
 * A caller works either in their own CRM (owner) or, with ?as=<ownerId>, in a
 * workspace they joined as an agent/manager. RLS enforces the same rule on
 * every read; this just picks the owner id and the role for the UI. */
export type Role = "owner" | "manager" | "agent";
export type Scope = { ownerId: string; role: Role; userId: string; token: string };
export type AgentRow = { id: string; owner_id: string; agent_user_id: string | null; name: string; phone: string; role: "agent" | "manager"; join_code: string; active: boolean; joined_at: string | null };
export type Membership = { owner_id: string; role: "agent" | "manager"; owner_name: string };

export async function memberships(token: string, userId: string): Promise<Membership[]> {
  const rows = list(await restAsUser<{ owner_id: string; role: "agent" | "manager" }[]>(token, `crm_agents?agent_user_id=eq.${userId}&active=is.true&select=owner_id,role`));
  const out: Membership[] = [];
  for (const r of rows) {
    const ctx = await businessContext(r.owner_id).catch(() => null);
    out.push({ owner_id: r.owner_id, role: r.role, owner_name: ctx?.name || "Team" });
  }
  return out;
}
export async function resolveScope(me: { id: string; token: string }, as: string | null | undefined): Promise<Scope | null> {
  if (!as || as === me.id) return { ownerId: me.id, role: "owner", userId: me.id, token: me.token };
  if (!/^[0-9a-f-]{36}$/i.test(as)) return null;
  const m = list(await restAsUser<{ role: "agent" | "manager" }[]>(me.token, `crm_agents?owner_id=eq.${as}&agent_user_id=eq.${me.id}&active=is.true&select=role&limit=1`))[0];
  return m ? { ownerId: as, role: m.role, userId: me.id, token: me.token } : null;
}
/** Team roster. Owners read under RLS; a verified manager gets the roster via the service role (join codes stripped). */
export async function agentsFor(token: string, ownerId: string, role: Role = "owner"): Promise<AgentRow[]> {
  if (role === "owner") return list(await restAsUser<AgentRow[]>(token, `crm_agents?owner_id=eq.${ownerId}&select=id,owner_id,agent_user_id,name,phone,role,join_code,active,joined_at&order=created_at`));
  if (role !== "manager") return [];
  return list(await restAsService<AgentRow[]>(`crm_agents?owner_id=eq.${ownerId}&active=is.true&select=id,owner_id,agent_user_id,name,phone,role,active,joined_at&order=created_at`)).map((a) => ({ ...a, join_code: "" }));
}
export const newJoinCode = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = ""; for (let i = 0; i < 6; i += 1) c += A[Math.floor(Math.random() * A.length)]; return c; };

/* ---------------- analytics (service role, owner-scoped) ---------------- */
export type Analytics = {
  days: { day: string; leads: number; in: number; out: number }[];
  funnel: { stage: string; count: number; value: number }[];
  sources: { source: string; count: number }[];
  totals: { leads30: number; leadsPrev30: number; won30: number; wonValue30: number; conversion: number; unread: number; overdue: number; msgsIn30: number; msgsOut30: number; botShare: number };
  response: { botMin: number | null; humanMin: number | null; answered: number; unanswered: number };
  agents: { id: string; name: string; assigned: number; open: number; sent: number; won: number }[];
};
export async function analytics(ownerId: string, agents: AgentRow[]): Promise<Analytics> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString(), prev = new Date(Date.now() - 60 * 86400000).toISOString();
  const leads = list(await restAsService<LeadRow[]>(`leads?owner_id=eq.${ownerId}&select=id,phone,source,status,score,value_paise,assigned_to,created_at,unread,next_follow_up&order=created_at.desc&limit=2000`));
  const msgs = list(await restAsService<(MsgRow & { phone: string })[]>(`wa_messages?owner_id=eq.${ownerId}&sent_at=gte.${since}&select=phone,direction,sender,sent_at,sent_by&order=sent_at&limit=20000`));
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const days: Analytics["days"] = [];
  for (let i = 13; i >= 0; i -= 1) days.push({ day: dayKey(new Date(Date.now() - i * 86400000).toISOString()), leads: 0, in: 0, out: 0 });
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const l of leads) { const d = byDay.get(dayKey(l.created_at)); if (d) d.leads += 1; }
  for (const m of msgs) { const d = byDay.get(dayKey(m.sent_at)); if (d) { if (m.direction === "in") d.in += 1; else d.out += 1; } }
  const won = (s: string) => s === "converted" || s === "won";
  const stageOf = (s: string) => (["new", "contacted", "interested", "follow_up", "converted", "lost"].includes(s) ? s : s === "hot" ? "interested" : s === "warm" ? "contacted" : s === "won" ? "converted" : "new");
  const funnel = STAGES.map((st) => ({ stage: st, count: 0, value: 0 }));
  for (const l of leads) { const f = funnel.find((x) => x.stage === stageOf(l.status)); if (f) { f.count += 1; f.value += l.value_paise || 0; } }
  const srcMap = new Map<string, number>();
  for (const l of leads) srcMap.set(l.source || "other", (srcMap.get(l.source || "other") ?? 0) + 1);
  const sources = [...srcMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  const l30 = leads.filter((l) => l.created_at >= since), lPrev = leads.filter((l) => l.created_at >= prev && l.created_at < since);
  const w30 = l30.filter((l) => won(l.status));
  const closed = leads.filter((l) => won(l.status) || l.status === "lost").length;
  // First-response time: per thread, first outbound after the first inbound (bot vs human).
  const threads = new Map<string, (MsgRow & { phone: string })[]>();
  for (const m of msgs) { if (!threads.has(m.phone)) threads.set(m.phone, []); threads.get(m.phone)!.push(m); }
  const bot: number[] = [], human: number[] = []; let answered = 0, unanswered = 0;
  for (const t of threads.values()) {
    const firstIn = t.find((m) => m.direction === "in"); if (!firstIn) continue;
    const reply = t.find((m) => m.direction === "out" && m.sent_at > firstIn.sent_at);
    if (!reply) { unanswered += 1; continue; }
    answered += 1;
    const min = (new Date(reply.sent_at).getTime() - new Date(firstIn.sent_at).getTime()) / 60000;
    (reply.sender === "bot" ? bot : human).push(min);
  }
  const med = (xs: number[]) => (xs.length ? Math.round(xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] * 10) / 10 : null);
  const out30 = msgs.filter((m) => m.direction === "out");
  const agentStats = agents.filter((a) => a.agent_user_id).map((a) => ({
    id: a.agent_user_id as string, name: a.name || a.phone || "Agent",
    assigned: leads.filter((l) => l.assigned_to === a.agent_user_id).length,
    open: leads.filter((l) => l.assigned_to === a.agent_user_id && !won(l.status) && l.status !== "lost").length,
    sent: out30.filter((m) => m.sent_by === a.agent_user_id).length,
    won: leads.filter((l) => l.assigned_to === a.agent_user_id && won(l.status)).length,
  }));
  return {
    days, funnel, sources,
    totals: {
      leads30: l30.length, leadsPrev30: lPrev.length, won30: w30.length, wonValue30: w30.reduce((n, l) => n + (l.value_paise || 0), 0),
      conversion: closed ? Math.round((leads.filter((l) => won(l.status)).length / closed) * 100) : 0,
      unread: leads.reduce((n, l) => n + (l.unread || 0), 0),
      overdue: leads.filter((l) => l.next_follow_up && new Date(l.next_follow_up).getTime() < Date.now() && !won(l.status) && l.status !== "lost").length,
      msgsIn30: msgs.length - out30.length, msgsOut30: out30.length, botShare: out30.length ? Math.round((out30.filter((m) => m.sender === "bot").length / out30.length) * 100) : 0,
    },
    response: { botMin: med(bot), humanMin: med(human), answered, unanswered },
    agents: agentStats,
  };
}

export async function bridge(userId: string, expiresAt: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(`${BRIDGE}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-Shubhora-User": userId, "X-Shubhora-Plan-Expires": expiresAt, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch { return { ok: false, status: 503, data: { error: "bridge_offline" } }; }
}

/** {name} {business} {card} {phone} placeholders in a template body. */
export function fillTemplate(body: string, lead: { name: string }, ctx: { name: string; phone: string; card: string }): string {
  const first = (lead.name || "").trim().split(/\s+/)[0] || "";
  return body.replace(/\{name\}/gi, first).replace(/\{business\}/gi, ctx.name).replace(/\{card\}/gi, ctx.card).replace(/\{phone\}/gi, ctx.phone).replace(/[ \t]{2,}/g, " ").replace(/^ +/gm, "");
}

export async function cardLink(userId: string): Promise<string> {
  const c = (await restAsService<{ username: string; custom_domain: string | null }[]>(`cards?owner_id=eq.${userId}&order=created_at.desc&limit=1&select=username,custom_domain`)).data?.[0];
  if (!c?.username) return "";
  return c.custom_domain ? `https://${c.custom_domain}` : `https://${c.username}.wellwalife.com`;
}

const transcript = (msgs: MsgRow[], n = 40) =>
  msgs.slice(-n).map((m) => `${m.sender === "customer" ? "Customer" : m.sender === "bot" ? "AI bot" : "Owner"}: ${m.text.slice(0, 300)}`).join("\n");

async function gemini(prompt: string, json: boolean, maxTokens: number): Promise<string> {
  const key = process.env.GEMINI_API_KEY; if (!key) return "";
  try {
    const r = await fetch(GEMINI, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) } }) });
    const j = await r.json().catch(() => ({}));
    return String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } catch { return ""; }
}

export type Insights = { intent: string; sentiment: string; summary: string; next: string; tags: string[]; score: number };

/** Intent, sentiment, 2-line summary, next step and 0-100 score from the chat. Stored on the lead. */
export async function refreshInsights(userId: string, lead: LeadRow, msgs: MsgRow[]): Promise<Insights | null> {
  if (!msgs.length && !lead.message) return null;
  const ctx = await businessContext(userId);
  const prompt = `You are a sales CRM assistant for "${ctx.name}" (small Indian business).${ctx.knowledge ? `\nBusiness facts:\n${ctx.knowledge.slice(0, 1200)}` : ""}
Conversation with a customer${lead.name ? ` (${lead.name})` : ""}:
${msgs.length ? transcript(msgs) : `Customer: ${lead.message}`}

Return JSON: {"intent": <2-4 word label e.g. "Price enquiry", "Demo request", "Complaint", "Just browsing", "Ready to buy", "Support">, "sentiment": "positive"|"neutral"|"negative", "summary": <max 2 short sentences in simple English: who they are, what they want, where things stand>, "next": <ONE concrete next action for the owner, max 15 words, e.g. "Call today, confirm demo slot for Sunday">, "tags": <1-3 short tags: product names mentioned, city, budget hints>, "score": <0-100 how likely to buy soon>}`;
  const raw = await gemini(prompt, true, 400);
  try {
    const j = JSON.parse(raw) as Partial<Insights>;
    const out: Insights = {
      intent: String(j.intent ?? "").slice(0, 40), sentiment: ["positive", "neutral", "negative"].includes(String(j.sentiment)) ? String(j.sentiment) : "neutral",
      summary: String(j.summary ?? "").slice(0, 400), next: String(j.next ?? "").slice(0, 160),
      tags: (Array.isArray(j.tags) ? j.tags : []).map((t) => String(t).trim().slice(0, 24)).filter(Boolean).slice(0, 3),
      score: Math.max(0, Math.min(100, Math.round(Number(j.score) || 0))),
    };
    await restAsService(`leads?id=eq.${lead.id}&owner_id=eq.${userId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ai_intent: out.intent, ai_sentiment: out.sentiment, ai_summary: out.summary, ai_next: out.next, ai_at: new Date().toISOString(), score: out.score }) });
    return out;
  } catch {
    // Mark as attempted so the thread poll doesn't retry Gemini every few seconds.
    await restAsService(`leads?id=eq.${lead.id}&owner_id=eq.${userId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ai_at: new Date().toISOString() }) });
    return null;
  }
}

/** A reply the owner can send as-is (in the customer's language). */
export async function suggestReply(userId: string, lead: LeadRow, msgs: MsgRow[], hint?: string): Promise<string> {
  const ctx = await businessContext(userId);
  const link = await cardLink(userId);
  const prompt = `You write WhatsApp replies for the owner of "${ctx.name}" (small Indian business).${ctx.knowledge ? `\nBusiness facts (only these, never invent prices/claims):\n${ctx.knowledge.slice(0, 1500)}` : ""}${link ? `\nDigital card / website link: ${link}` : ""}
Conversation so far:
${msgs.length ? transcript(msgs, 24) : `Customer: ${lead.message}`}
${hint ? `Owner's instruction for this reply: ${hint}\n` : ""}
Write the owner's next WhatsApp message: reply in the same language/script the customer used (Hinglish if unsure), warm and personal, 1-4 short lines, move the sale one step forward (answer, then ask one question or propose a demo/call), at most 1 emoji, no medical or income claims. Return only the message text.`;
  return (await gemini(prompt, false, 300)).replace(/^["“]|["”]$/g, "").slice(0, 1200);
}
