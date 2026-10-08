// WhatsApp Cloud API (official Meta API, the user's own credentials).
// One account per owner (wa_cloud_accounts). Sending, templates, inbound
// handling (CRM log + menu bot + AI reply) and delivery statuses live here;
// the webhook route and the CRM send route are thin wrappers.
import { restAsService } from "@/lib/poster-server";
import { aiReply, splitAlert, splitOrder, orderSummary, orderPaise, cardSiteUrl, getBrandTraining, type ChatMsg } from "@/lib/wa-ai";
import type { Card } from "@/lib/types";

export const GRAPH = "https://graph.facebook.com/v21.0";

export type CloudAccount = {
  owner_id: string; phone_number_id: string; waba_id: string; access_token: string; app_secret: string; verify_token: string;
  display_phone: string; verified_name: string; quality_rating: string; messaging_limit: string; official: boolean;
  enabled: boolean; ai_enabled: boolean; last_error: string; connected_at: string;
};
const COLS = "owner_id,phone_number_id,waba_id,access_token,app_secret,verify_token,display_phone,verified_name,quality_rating,messaging_limit,official,enabled,ai_enabled,last_error,connected_at";
const one = <T,>(r: { data: T[] | null }): T | null => (Array.isArray(r.data) ? r.data[0] ?? null : null);

export const cloudAccount = async (ownerId: string) => one(await restAsService<CloudAccount[]>(`wa_cloud_accounts?owner_id=eq.${ownerId}&select=${COLS}`));
export const cloudAccountByPhoneId = async (id: string) => one(await restAsService<CloudAccount[]>(`wa_cloud_accounts?phone_number_id=eq.${encodeURIComponent(id)}&select=${COLS}`));
export const cloudAccountByVerify = async (tok: string) => one(await restAsService<CloudAccount[]>(`wa_cloud_accounts?verify_token=eq.${encodeURIComponent(tok)}&select=owner_id,verify_token`));
/** Strip secrets before sending an account to the client. */
export const publicAccount = (a: CloudAccount) => ({ ...a, access_token: a.access_token ? `…${a.access_token.slice(-6)}` : "", app_secret: a.app_secret ? "set" : "" });

/* ---------------- Graph API ---------------- */
export class GraphError extends Error { code: number; sub: number; constructor(msg: string, code: number, sub: number) { super(msg); this.code = code; this.sub = sub; } }
export async function graph<T = Record<string, unknown>>(token: string, path: string, init?: { method?: string; body?: unknown; query?: Record<string, string> }): Promise<T> {
  const q = init?.query ? "?" + new URLSearchParams(init.query).toString() : "";
  const r = await fetch(`${GRAPH}/${path}${q}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } } } & T;
  if (!r.ok || j.error) throw new GraphError(j.error?.error_data?.details || j.error?.message || `Graph ${r.status}`, j.error?.code ?? r.status, j.error?.error_subcode ?? 0);
  return j;
}

export type PhoneInfo = { display_phone_number?: string; verified_name?: string; quality_rating?: string; messaging_limit_tier?: string; is_official_business_account?: boolean; name_status?: string; code_verification_status?: string };
export const phoneInfo = (token: string, phoneNumberId: string) =>
  graph<PhoneInfo>(token, phoneNumberId, { query: { fields: "display_phone_number,verified_name,quality_rating,messaging_limit_tier,is_official_business_account,name_status,code_verification_status" } });

export type SendPayload =
  | { text: string; previewUrl?: boolean }
  | { imageUrl: string; caption?: string }
  | { documentUrl: string; fileName?: string; caption?: string }
  | { template: string; lang: string; components?: unknown[] };

/** Send one message; returns the WhatsApp message id. Throws GraphError (131047 = outside 24h window → use a template). */
export async function sendCloud(acc: Pick<CloudAccount, "access_token" | "phone_number_id">, to: string, p: SendPayload): Promise<string> {
  const digits = to.replace(/[^0-9]/g, "");
  const body: Record<string, unknown> = { messaging_product: "whatsapp", recipient_type: "individual", to: digits };
  if ("text" in p) Object.assign(body, { type: "text", text: { body: p.text.slice(0, 4096), preview_url: p.previewUrl ?? /https?:\/\//.test(p.text) } });
  else if ("imageUrl" in p) Object.assign(body, { type: "image", image: { link: p.imageUrl, caption: p.caption?.slice(0, 1024) || undefined } });
  else if ("documentUrl" in p) Object.assign(body, { type: "document", document: { link: p.documentUrl, filename: p.fileName?.slice(0, 80) || "document.pdf", caption: p.caption?.slice(0, 1024) || undefined } });
  else Object.assign(body, { type: "template", template: { name: p.template, language: { code: p.lang }, components: p.components ?? [] } });
  const j = await graph<{ messages?: { id: string }[] }>(acc.access_token, `${acc.phone_number_id}/messages`, { body });
  return j.messages?.[0]?.id ?? "";
}
export const markRead = (acc: Pick<CloudAccount, "access_token" | "phone_number_id">, msgId: string) =>
  graph(acc.access_token, `${acc.phone_number_id}/messages`, { body: { messaging_product: "whatsapp", status: "read", message_id: msgId } }).catch(() => null);

export const friendlyGraphError = (e: unknown): string => {
  const g = e as GraphError;
  if (g?.code === 131047 || g?.code === 131026) return "Outside the 24-hour window — the customer hasn't messaged in the last 24 h. Send an approved template instead.";
  if (g?.code === 190) return "Access token expired or invalid — reconnect with a permanent token.";
  if (g?.code === 131030) return "This number is not in the allowed test list (Meta test mode). Add it in Meta → WhatsApp → API setup.";
  if (g?.code === 132000 || g?.code === 132001) return "Template not found or not approved yet.";
  if (g?.code === 131049 || g?.code === 130429) return "Meta rate limit / marketing limit reached — try later.";
  return String(g?.message ?? "WhatsApp API error");
};

/* ---------------- templates ---------------- */
export type MetaTemplate = { id: string; name: string; status: string; category: string; language: string; components: { type: string; format?: string; text?: string; buttons?: { type: string; text: string; url?: string }[]; example?: unknown }[]; rejected_reason?: string };
export async function listTemplates(acc: CloudAccount): Promise<MetaTemplate[]> {
  if (!acc.waba_id) return [];
  const j = await graph<{ data?: MetaTemplate[] }>(acc.access_token, `${acc.waba_id}/message_templates`, { query: { fields: "id,name,status,category,language,components,rejected_reason", limit: "100" } });
  return j.data ?? [];
}
export type NewTemplate = { name: string; category: "MARKETING" | "UTILITY"; language: string; header?: { type: "TEXT"; text: string } | { type: "IMAGE" }; body: string; footer?: string; buttons?: ({ type: "QUICK_REPLY"; text: string } | { type: "URL"; text: string; url: string } | { type: "PHONE_NUMBER"; text: string; phone_number: string })[]; bodyExamples?: string[] };
export async function createTemplate(acc: CloudAccount, t: NewTemplate): Promise<{ id: string; status: string }> {
  const components: Record<string, unknown>[] = [];
  if (t.header?.type === "TEXT") components.push({ type: "HEADER", format: "TEXT", text: t.header.text });
  if (t.header?.type === "IMAGE") components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [] } });
  const vars = (t.body.match(/\{\{\d+\}\}/g) ?? []).length;
  components.push({ type: "BODY", text: t.body, ...(vars ? { example: { body_text: [Array.from({ length: vars }, (_, i) => t.bodyExamples?.[i] || `Example ${i + 1}`)] } } : {}) });
  if (t.footer) components.push({ type: "FOOTER", text: t.footer });
  if (t.buttons?.length) components.push({ type: "BUTTONS", buttons: t.buttons });
  const j = await graph<{ id: string; status: string }>(acc.access_token, `${acc.waba_id}/message_templates`, { body: { name: t.name, category: t.category, language: t.language, allow_category_change: true, components } });
  return { id: j.id, status: j.status };
}
export const deleteTemplate = (acc: CloudAccount, name: string) => graph(acc.access_token, `${acc.waba_id}/message_templates`, { method: "DELETE", query: { name } });

/** Body/header components for a template send, from the campaign's param mapping. */
export function templateComponents(params: { source: string; value?: string }[], lead: { name?: string; city?: string; phone?: string }, headerImage?: string): unknown[] {
  const out: unknown[] = [];
  if (headerImage) out.push({ type: "header", parameters: [{ type: "image", image: { link: headerImage } }] });
  if (params.length) out.push({ type: "body", parameters: params.map((p) => ({ type: "text", text: (p.source === "name" ? ((lead.name || "").split(/\s+/)[0] || "ji") : p.source === "city" ? (lead.city || "") : p.source === "phone" ? (lead.phone || "") : (p.value || "")).slice(0, 200) || "-" })) });
  return out;
}

/* ---------------- card + CRM log ---------------- */
export async function cardForOwner(ownerId: string): Promise<Card | null> {
  const row = one(await restAsService<{ id: string; username: string; active: boolean | null; data: Card }[]>(`cards?owner_id=eq.${ownerId}&order=created_at.desc&limit=1&select=id,username,active,data`));
  return row ? { ...(row.data as Card), id: row.id, username: row.username, active: row.active ?? true } : null;
}
export async function logCloud(o: { ownerId: string; cardId: string | null; phone: string; name?: string; waId: string; direction: "in" | "out"; sender: "customer" | "bot" | "owner"; kind?: string; text: string; sentAt?: string; sentBy?: string | null; status?: string }): Promise<string | null> {
  const r = await restAsService<string>("rpc/wa_log_message", { method: "POST", body: JSON.stringify({ p_owner: o.ownerId, p_card: o.cardId, p_phone: o.phone, p_name: o.name ?? "", p_wa_id: o.waId, p_direction: o.direction, p_sender: o.sender, p_kind: o.kind ?? "text", p_text: o.text, p_sent_at: o.sentAt ?? new Date().toISOString(), p_sent_by: o.sentBy ?? null }) });
  await restAsService(`wa_messages?owner_id=eq.${o.ownerId}&wa_id=eq.${encodeURIComponent(o.waId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ channel: "cloud", status: o.status ?? (o.direction === "out" ? "sent" : "") }) });
  return r.ok ? r.data : null;
}
const e164 = (digits: string) => "+" + digits.replace(/[^0-9]/g, "");

/* ---------------- menu bot (same JSON as the QR bridge) ---------------- */
type FOpt = { label: string; action: "menu" | "text" | "ai" | "human"; target?: string; reply?: string };
type FNode = { id: string; title: string; text: string; options: FOpt[] };
type Flow = { greetNew?: boolean; triggers?: string[]; nodes: FNode[] };
const flowCache = new Map<string, { at: number; flow: Flow | null }>();
const flowState = new Map<string, { nodeId: string; at: number }>();
const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
async function flowFor(ownerId: string): Promise<Flow | null> {
  const c = flowCache.get(ownerId);
  if (c && Date.now() - c.at < 60_000) return c.flow;
  const row = one(await restAsService<{ enabled: boolean; data: Flow }[]>(`wa_flows?owner_id=eq.${ownerId}&select=enabled,data`));
  const flow = row?.enabled && Array.isArray(row.data?.nodes) && row.data.nodes.length ? row.data : null;
  flowCache.set(ownerId, { at: Date.now(), flow });
  return flow;
}
function fill(t: string, card: Card, site: string) {
  return String(t ?? "").replace(/\{business\}/gi, card.company || card.name || "").replace(/\{card\}/gi, site).replace(/\{phone\}/gi, card.links.find((l) => l.type === "phone")?.value || "");
}
const renderMenu = (n: FNode, root: boolean, card: Card, site: string) => `${fill(n.text || n.title, card, site)}\n\n${n.options.slice(0, 9).map((o, i) => `${NUM[i]} ${o.label}`).join("\n")}\n\n_Reply with a number${root ? "" : " · 0 for main menu"}_`;

/** Returns the reply text (+ optional alert / handover) when the menu bot handled this message, else null. */
async function runFlow(ownerId: string, card: Card, site: string, from: string, text: string, firstContact: boolean): Promise<{ text: string; alert?: string; human?: boolean } | null> {
  const flow = await flowFor(ownerId); if (!flow) return null;
  const key = `${ownerId}:${from}`, nodes = flow.nodes, root = nodes[0];
  const t = text.trim().toLowerCase().replace(/[!.?\s]+$/g, "");
  const triggers = (flow.triggers?.length ? flow.triggers : ["hi", "hello", "hey", "menu", "start", "namaste", "namaskar", "help"]).map((x) => x.toLowerCase());
  const st = flowState.get(key); const live = st && Date.now() - st.at < 30 * 60_000 ? st : null;
  const show = (n: FNode) => { flowState.set(key, { nodeId: n.id, at: Date.now() }); return { text: renderMenu(n, n === root, card, site) }; };
  if (triggers.includes(t) || (firstContact && flow.greetNew !== false && !live)) return show(root);
  if (!live) return null;
  if (t === "0") return show(root);
  const node = nodes.find((n) => n.id === live.nodeId) ?? root;
  const n = /^\d{1,2}$/.test(t) ? parseInt(t, 10) : 0;
  const opt = (n >= 1 && node.options[n - 1]) || node.options.find((o) => o.label.toLowerCase() === t);
  if (!opt) { flowState.delete(key); return null; }
  const target = nodes.find((x) => x.id === opt.target);
  if (opt.action === "menu" && target) return show(target);
  if (opt.action === "text" && opt.reply) { flowState.set(key, { nodeId: node.id, at: Date.now() }); return { text: `${fill(opt.reply, card, site)}\n\n_0 for main menu_` }; }
  flowState.delete(key);
  if (opt.action === "human") return { text: fill(opt.reply ?? "", card, site) || `Ji, ${card.name.split(" ")[0]} aapse jald hi khud baat karenge 🙏 Tab tak aap apna sawaal yahin likh sakte hain.`, alert: `Customer chose "${opt.label}" — wants to talk to you.`, human: true };
  return { text: fill(opt.reply ?? "", card, site) || "Zaroor! Aap apna sawaal likhiye, main turant jawab dunga 🙂" };
}

/* ---------------- inbound webhook handling ---------------- */
type WaMsg = { id: string; from: string; timestamp?: string; type: string; text?: { body: string }; image?: { caption?: string }; video?: { caption?: string }; document?: { caption?: string; filename?: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }; button?: { text: string }; location?: { name?: string; address?: string }; contacts?: unknown[]; audio?: unknown; sticker?: unknown; reaction?: unknown };
type WaValue = { metadata?: { phone_number_id?: string }; contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: WaMsg[]; statuses?: { id: string; status: string; recipient_id?: string; errors?: { code: number; title?: string }[] }[] };
const seen = new Map<string, number>(); // message id → ts (webhook retries)
const STOP_RE = /^\s*(stop|unsubscribe|band karo|band kar do|no more|don't message|dont message)\s*[.!]*\s*$/i;

function textOf(m: WaMsg): { kind: string; text: string } {
  switch (m.type) {
    case "text": return { kind: "text", text: m.text?.body ?? "" };
    case "interactive": return { kind: "text", text: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "" };
    case "button": return { kind: "text", text: m.button?.text ?? "" };
    case "image": return { kind: "image", text: m.image?.caption ?? "" };
    case "video": return { kind: "video", text: m.video?.caption ?? "" };
    case "document": return { kind: "document", text: m.document?.caption || m.document?.filename || "" };
    case "audio": return { kind: "audio", text: "" };
    case "sticker": return { kind: "sticker", text: "" };
    case "location": return { kind: "location", text: [m.location?.name, m.location?.address].filter(Boolean).join(", ") };
    case "contacts": return { kind: "contact", text: "" };
    default: return { kind: "", text: "" };
  }
}

export async function handleCloudValue(acc: CloudAccount, v: WaValue): Promise<void> {
  // delivery statuses (sent → delivered → read / failed)
  for (const s of v.statuses ?? []) {
    const st = s.status === "failed" ? "failed" : ["sent", "delivered", "read"].includes(s.status) ? s.status : "";
    if (st) await restAsService("rpc/wa_cloud_status", { method: "POST", body: JSON.stringify({ p_owner: acc.owner_id, p_wa_id: s.id, p_status: st }) });
    if (st === "failed" && s.errors?.[0]) await restAsService(`wa_broadcast_items?owner_id=eq.${acc.owner_id}&wa_msg_id=eq.${encodeURIComponent(s.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ error: `${s.errors[0].code} ${s.errors[0].title ?? ""}`.slice(0, 200) }) });
  }
  const msgs = v.messages ?? [];
  if (!msgs.length) return;
  const card = await cardForOwner(acc.owner_id);
  const site = card ? cardSiteUrl(card, await getBrandTraining(card.username)) : "";
  for (const m of msgs) {
    if (!m.id || seen.has(m.id)) continue;
    seen.set(m.id, Date.now()); if (seen.size > 5000) for (const [k, t] of seen) if (Date.now() - t > 3600_000) seen.delete(k);
    const { kind, text } = textOf(m); if (!kind) continue;
    const phone = e164(m.from), name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
    const sentAt = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : undefined;
    const leadId = await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, name, waId: m.id, direction: "in", sender: "customer", kind, text: text || (kind === "text" ? "" : `[${kind}]`), sentAt });
    if (!acc.enabled) continue;
    markRead(acc, m.id);
    if (STOP_RE.test(text)) {
      if (leadId) await restAsService(`leads?id=eq.${leadId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ opted_out: true }) });
      await reply(acc, card, phone, "Theek hai 🙏 Aapko ab hamari taraf se promotional message nahi aayenge. Kabhi bhi zaroorat ho to yahin likh dein.");
      continue;
    }
    // Owner/agent replied in the last 15 min → human is handling this chat.
    const hist = (await restAsService<{ direction: string; sender: string; text: string; sent_at: string }[]>(`wa_messages?owner_id=eq.${acc.owner_id}&phone=eq.${encodeURIComponent(phone)}&select=direction,sender,text,sent_at&order=sent_at.desc&limit=14`)).data ?? [];
    const rows = Array.isArray(hist) ? hist.reverse() : [];
    const lastOwner = rows.filter((r) => r.sender === "owner").pop();
    if (lastOwner && Date.now() - new Date(lastOwner.sent_at).getTime() < 15 * 60_000) continue;
    if (!card) continue;
    const firstContact = rows.filter((r) => r.direction === "in").length <= 1;
    const flow = text ? await runFlow(acc.owner_id, card, site, m.from, text, firstContact) : null;
    if (flow) {
      await reply(acc, card, phone, flow.text);
      if (flow.alert && leadId) await note(acc.owner_id, leadId, `🔔 ${flow.alert}`, true);
      continue;
    }
    if (!acc.ai_enabled) continue;
    if (!text) { // media without caption
      await reply(acc, card, phone, kind === "audio" ? `Maaf kijiye 🙏 main voice message abhi sun nahi pata — aap likh kar bhej dein, turant jawab dunga.` : "Dhanyavaad, mil gaya 🙏 Bas ye bata dijiye — aap iske baare me kya jaanna chahte hain?");
      continue;
    }
    const history: ChatMsg[] = rows.filter((r) => r.text && !r.text.startsWith("[")).map((r) => ({ role: r.direction === "in" ? "user" : "assistant", content: r.text }));
    if (!history.length || history[history.length - 1].content !== text) history.push({ role: "user", content: text });
    const ai = await aiReply(card, history, "whatsapp");
    const { text: out0, alert } = splitAlert(ai);
    const { text: out, order } = splitOrder(out0);
    if (out || order) {
      if (out) await reply(acc, card, phone, out);
      if (alert && leadId) await note(acc.owner_id, leadId, `🔔 AI alert: ${alert}`, true);
      // The salesman closed on WhatsApp: the lead carries the order (name, what, value) and goes hot.
      if (order && leadId) {
        const kind = order.kind === "booking" ? "Booking" : order.kind === "callback" ? "Call back" : "Order";
        const ist = new Date(Date.now() + 5.5 * 3600_000);
        const followUp = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + (ist.getUTCHours() >= 18 ? 2 : 1), 11, 0) - 5.5 * 3600_000).toISOString();
        await restAsService(`leads?id=eq.${leadId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...(order.name ? { name: order.name } : {}), ai_intent: kind, value_paise: orderPaise(order), tags: [order.kind], next_follow_up: followUp, reminded_at: null, updated_at: new Date().toISOString() }) });
        await note(acc.owner_id, leadId, `🛒 ${kind}: ${orderSummary(order)}`, true);
      }
    } else {
      const wa = card.links.find((l) => l.type === "whatsapp")?.value?.replace(/[^0-9]/g, "");
      await reply(acc, card, phone, `Namaste 🙏 ${card.name.split(" ")[0]} aapko jald hi khud jawab denge.${site ? `\nTab tak details yahan dekhein: ${site}` : ""}${wa ? `` : ""}`);
    }
  }
}
async function reply(acc: CloudAccount, card: Card | null, phone: string, text: string) {
  try {
    const id = await sendCloud(acc, phone, { text });
    if (id) await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, waId: id, direction: "out", sender: "bot", text });
  } catch (e) {
    await restAsService(`wa_cloud_accounts?owner_id=eq.${acc.owner_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_error: friendlyGraphError(e).slice(0, 200), updated_at: new Date().toISOString() }) });
  }
}
async function note(ownerId: string, leadId: string, text: string, hot: boolean) {
  await restAsService("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: ownerId, lead_id: leadId, kind: "ai", text: text.slice(0, 500) }) });
  if (hot) await restAsService(`leads?id=eq.${leadId}&status=in.(new,contacted)`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "interested", updated_at: new Date().toISOString() }) });
}
