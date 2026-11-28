// WhatsApp Cloud API (official Meta API, the user's own credentials).
// One account per owner (wa_cloud_accounts). Sending, templates, inbound
// handling (CRM log + menu bot + AI reply) and delivery statuses live here;
// the webhook route and the CRM send route are thin wrappers.
import { restAsService } from "@/lib/poster-server";
import { AI_STOP_TAG } from "@/lib/crm-pro";
import { isBlocked } from "@/lib/crm-block";
import { aiReply, splitAlert, splitOrder, orderSummary, orderPaise, sellerSiteUrl, completeFileSets, ensureDemoLink, demoLink, getBrandTraining, type ChatMsg } from "@/lib/wa-ai";
import { istInstant } from "@/lib/bookings";
import { createBooking } from "@/lib/bookings-server";
import { ownerAlert } from "@/lib/owner-alert";
import { serviceExpiry } from "@/lib/single-services-server";
import type { Card } from "@/lib/types";
import { asksStock, bookDays, bookedText, bookTurn, cardAnswer, dayMenu, deskBill, deskDue, deskIntent, deskNothing, deskStatus, formQuestions, formTurn, matchItems, orderDoneText, orderList, orderMenu, orderOwnerLine, orderTurn, shopItems, stockAnswer } from "../../bridge/shop-desk.mjs";

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
  | { videoUrl: string; caption?: string }
  | { documentUrl: string; fileName?: string; caption?: string }
  | { template: string; lang: string; components?: unknown[] }
  /** A menu the customer taps: up to 3 reply buttons (20 letters each), or a list of up to 10 rows (24 letters each). */
  | { interactive: { body: string; buttons?: string[]; rows?: string[]; button?: string } };

/** Send one message; returns the WhatsApp message id. Throws GraphError (131047 = outside 24h window → use a template). */
export async function sendCloud(acc: Pick<CloudAccount, "access_token" | "phone_number_id">, to: string, p: SendPayload): Promise<string> {
  const digits = to.replace(/[^0-9]/g, "");
  const body: Record<string, unknown> = { messaging_product: "whatsapp", recipient_type: "individual", to: digits };
  if ("text" in p) Object.assign(body, { type: "text", text: { body: p.text.slice(0, 4096), preview_url: p.previewUrl ?? /https?:\/\//.test(p.text) } });
  else if ("imageUrl" in p) Object.assign(body, { type: "image", image: { link: p.imageUrl, caption: p.caption?.slice(0, 1024) || undefined } });
  else if ("videoUrl" in p) Object.assign(body, { type: "video", video: { link: p.videoUrl, caption: p.caption?.slice(0, 1024) || undefined } });
  else if ("documentUrl" in p) Object.assign(body, { type: "document", document: { link: p.documentUrl, filename: p.fileName?.slice(0, 80) || "document.pdf", caption: p.caption?.slice(0, 1024) || undefined } });
  else if ("interactive" in p) {
    const text = p.interactive.body.slice(0, 1024);
    Object.assign(body, { type: "interactive", interactive: p.interactive.buttons?.length
      ? { type: "button", body: { text }, action: { buttons: p.interactive.buttons.slice(0, 3).map((t, i) => ({ type: "reply", reply: { id: `b${i + 1}`, title: t.slice(0, 20) } })) } }
      : { type: "list", body: { text }, action: { button: (p.interactive.button || "Choose").slice(0, 20), sections: [{ title: "Menu", rows: (p.interactive.rows ?? []).slice(0, 10).map((t, i) => ({ id: `r${i + 1}`, title: t.slice(0, 24) })) }] } } });
  }
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
/** This WhatsApp message id is already in the CRM log: Meta re-delivered it (a retry after a slow answer, or after an
 *  app restart emptied the in-memory list) and it was handled the first time — no second reply, no second lead. */
export async function alreadyLogged(ownerId: string, waId: string): Promise<boolean> {
  const r = await restAsService<{ id: string }[]>(`wa_messages?owner_id=eq.${ownerId}&wa_id=eq.${encodeURIComponent(waId)}&select=id&limit=1`);
  return r.ok && Array.isArray(r.data) && r.data.length > 0;
}

/* ---------------- menu bot (same JSON as the QR bridge) ---------------- */
type FOpt = { label: string; action: "menu" | "text" | "ai" | "human" | DeskAction; target?: string; reply?: string };
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

const MAIN_MENU = "Main menu";
type MenuOut = { body: string; labels: string[] };
type FlowOut = { text: string; alert?: string; human?: boolean; menu?: MenuOut; askAi?: string };
/** Returns the reply text (+ optional alert / handover) when the menu bot handled this message, else null.
 *  `menu`: the same menu as things to tap (buttons / a list). `askAi`: the card had nothing for the option — the AI answers these words. */
async function runFlow(c: DeskCtx, text: string, firstContact: boolean): Promise<FlowOut | null> {
  const { ownerId, card, site, from } = c;
  const flow = await flowFor(ownerId); if (!flow) return null;
  const key = `${ownerId}:${from}`, nodes = flow.nodes, root = nodes[0];
  const t = text.trim().toLowerCase().replace(/[!.?\s]+$/g, "");
  const triggers = (flow.triggers?.length ? flow.triggers : ["hi", "hello", "hey", "menu", "start", "namaste", "namaskar", "help"]).map((x) => x.toLowerCase());
  const st = flowState.get(key); const live = st && Date.now() - st.at < 30 * 60_000 ? st : null;
  const show = (n: FNode): FlowOut => {
    flowState.set(key, { nodeId: n.id, at: Date.now() });
    return { text: renderMenu(n, n === root, card, site), menu: { body: fill(n.text || n.title, card, site), labels: [...n.options.slice(0, 9).map((o) => o.label), ...(n === root ? [] : [MAIN_MENU])] } };
  };
  if (triggers.includes(t) || (firstContact && flow.greetNew !== false && !live)) return show(root);
  if (!live) return null;
  if (t === "0" || t === MAIN_MENU.toLowerCase()) return show(root);
  const node = nodes.find((n) => n.id === live.nodeId) ?? root;
  const n = /^\d{1,2}$/.test(t) ? parseInt(t, 10) : 0;
  const opt = (n >= 1 && node.options[n - 1]) || node.options.find((o) => o.label.toLowerCase() === t);
  if (!opt) { flowState.delete(key); return null; }
  const target = nodes.find((x) => x.id === opt.target);
  if (opt.action === "menu" && target) return show(target);
  if (opt.action === "text" && opt.reply) { flowState.set(key, { nodeId: node.id, at: Date.now() }); return { text: `${fill(opt.reply, card, site)}\n\n_0 for main menu_` }; }
  if (opt.action !== "menu" && opt.action !== "text" && opt.action !== "ai" && opt.action !== "human") {
    const card3 = opt.action === "address" || opt.action === "offer" || opt.action === "products";
    if (card3) flowState.set(key, { nodeId: node.id, at: Date.now() }); else flowState.delete(key);
    const out = await deskStart(opt.action, c, text, true);
    if (out) return out;
    flowState.delete(key);
    return { text: "", askAi: opt.label };
  }
  flowState.delete(key);
  if (opt.action === "human") return { text: fill(opt.reply ?? "", card, site) || `Ji, ${card.name.split(" ")[0]} aapse jald hi khud baat karenge 🙏 Tab tak aap apna sawaal yahin likh sakte hain.`, alert: `Customer chose "${opt.label}" — wants to talk to you.`, human: true };
  return { text: fill(opt.reply ?? "", card, site) || "Zaroor! Aap apna sawaal likhiye, main turant jawab dunga 🙂" };
}

/* ---------------- the shop's own counter on the Business API number (same answers as the QR bridge: bridge/shop-desk.mjs) ----------------
 * Status / dues / bill from the shop's books, the card's address / offer / products, the enquiry form, an appointment, an order
 * and "X hai kya?" from the stock. A talk in progress (form, appointment, order) is kept here per customer for 20 minutes. */
type DeskAction = "status" | "due" | "bill" | "book" | "form" | "order" | "address" | "offer" | "products";
type DeskCtx = { ownerId: string; card: Card; site: string; from: string; phone: string; name: string; leadId: string | null };
type DeskOut = { text: string; alert?: string };
type Turn<D> = { st?: Record<string, unknown>; say?: string; done?: D; end?: boolean; pass?: boolean };
type OrderDone = { name: string; qty: number; total: number; pickup: boolean; addr: string };
type Conv = { kind: "form" | "book" | "order"; st: Record<string, unknown>; at: number };
const convState = new Map<string, Conv>();
const CONV_TTL = 20 * 60_000;
const APP = (process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");
const UPI_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$/;
const deskRest = async (q: string): Promise<Record<string, unknown>[]> => { const r = await restAsService<Record<string, unknown>[]>(q); return Array.isArray(r.data) ? r.data : []; };
const stockCache = new Map<string, { at: number; v: Awaited<ReturnType<typeof shopItems>> }>();
async function stockOf(ownerId: string) {
  const c = stockCache.get(ownerId);
  if (c && Date.now() - c.at < 120_000) return c.v;
  const v = await shopItems({ owner: ownerId, rest: deskRest }).catch(() => []);
  stockCache.set(ownerId, { at: Date.now(), v });
  if (stockCache.size > 500) stockCache.clear();
  return v;
}
async function ownerUpi(ownerId: string, card: Card): Promise<string> {
  const rows = await deskRest(`owner_prefs?owner_id=eq.${ownerId}&select=crm`);
  const shop = String((rows[0]?.crm as { mobileSetup?: { upi?: string } } | undefined)?.mobileSetup?.upi ?? "").trim();
  const own = String(card.links.find((l) => l.type === "upi")?.value ?? "").trim();
  return UPI_RE.test(shop) ? shop : UPI_RE.test(own) ? own : "";
}
/** Fields and tags onto the lead (the tags it already has are kept). */
async function leadPatch(leadId: string | null, fields: Record<string, unknown>, tags: string[]) {
  if (!leadId) return;
  const have = one(await restAsService<{ tags: string[] | null }[]>(`leads?id=eq.${leadId}&select=tags`))?.tags ?? [];
  const add = tags.filter((t) => !have.includes(t));
  const body = { ...fields, ...(add.length ? { tags: [...have, ...add].slice(0, 30) } : {}) };
  if (Object.keys(body).length) await restAsService(`leads?id=eq.${leadId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
}
const setConv = (key: string, kind: Conv["kind"], st: Record<string, unknown>) => { convState.set(key, { kind, st, at: Date.now() }); if (convState.size > 5000) for (const [k, c] of convState) if (Date.now() - c.at > CONV_TTL) convState.delete(k); };

/** A menu option's action (or a free-typed counter question). Null: nothing to say from the books — the AI answers. */
async function deskStart(action: DeskAction, c: DeskCtx, text: string, forced: boolean): Promise<DeskOut | null> {
  const key = `${c.ownerId}:${c.from}`;
  if (action === "form") { const qs = formQuestions(c.card.botRules); setConv(key, "form", { qs, answers: [] }); return { text: `ज़रूर 🙂 बस ${qs.length} छोटे सवाल:\n\n${qs[0].q}` }; }
  if (action === "book") { const days = bookDays({}); setConv(key, "book", { step: "day", days }); return { text: dayMenu(days) }; }
  if (action === "order") { const items = orderList(c.card, await stockOf(c.ownerId)); setConv(key, "order", { step: "item", items }); return { text: orderMenu(items) }; }
  if (action === "address" || action === "offer" || action === "products") { const a = cardAnswer(action, c.card, { link: c.site }); return a ? { text: `${a}\n\n_0 for main menu_` } : null; }
  const args = { owner: c.ownerId, phone: c.phone, text, rest: deskRest, site: APP };
  const out = action === "status" ? await deskStatus(args) : action === "due" ? await deskDue({ ...args, upi: await ownerUpi(c.ownerId, c.card) }) : await deskBill(args);
  return out ? { text: out } : forced ? { text: deskNothing(action) } : null;
}
/** A talk in progress, then a free-typed counter question, then a stock question. Null: not for the counter. */
async function deskCloud(c: DeskCtx, text: string, flow: Flow | null): Promise<DeskOut | null> {
  const key = `${c.ownerId}:${c.from}`;
  const conv = convState.get(key);
  if (conv && Date.now() - conv.at < CONV_TTL) {
    convState.delete(key);
    if (conv.kind === "form") {
      const r = formTurn(conv.st as Parameters<typeof formTurn>[0], text) as unknown as Turn<{ patch: Record<string, unknown>; summary: string }>;
      if (r.st) { setConv(key, "form", r.st); return { text: r.say ?? "" }; }
      if (r.done) {
        await leadPatch(c.leadId, r.done.patch, ["form"]);
        return { text: `धन्यवाद 🙏 आपकी जानकारी मिल गई। ${c.card.name.split(" ")[0] || "हम"} जल्द ही आपसे बात करेंगे। तब तक कोई सवाल हो तो यहीं लिख दीजिए।`, alert: r.done.summary ? `Enquiry form filled — ${r.done.summary}` : undefined };
      }
    } else if (conv.kind === "book") {
      const r = await bookTurn(conv.st as Parameters<typeof bookTurn>[0], text, { owner: c.ownerId, rest: deskRest }) as unknown as Turn<{ day: string; slot: { iso: string; label: string } }>;
      if (r.st) { setConv(key, "book", r.st); return { text: r.say ?? "" }; }
      if (r.done) {
        const id = await createBooking({ ownerId: c.ownerId, cardId: c.card.id, leadId: c.leadId, name: c.name, phone: c.phone, service: "", startsAt: new Date(r.done.slot.iso), note: "WhatsApp पर खुद चुना समय", source: "whatsapp" });
        if (!id) return { text: "माफ़ कीजिए, अभी booking दर्ज नहीं हो पाई 🙏 हम आपसे खुद बात करके समय पक्का करेंगे।", alert: `Wanted an appointment on ${r.done.day} at ${r.done.slot.label} — it could not be saved, please confirm with them.` };
        return { text: bookedText(r.done.day, r.done.slot, c.card.company || ""), alert: `New appointment booked on WhatsApp: ${r.done.day}, ${r.done.slot.label}` };
      }
    } else {
      const r = orderTurn(conv.st as Parameters<typeof orderTurn>[0], text, { all: conv.st.step === "item" ? await stockOf(c.ownerId) : [] }) as unknown as Turn<OrderDone>;
      if (r.st) { setConv(key, "order", r.st); return { text: r.say ?? "" }; }
      if (r.end && !r.pass) return { text: r.say ?? "" };
      if (r.done) {
        const o = r.done;
        await leadPatch(c.leadId, { ai_intent: "Order", ...(o.total ? { value_paise: o.total } : {}), ...(o.addr ? { address: o.addr.slice(0, 200) } : {}), updated_at: new Date().toISOString() }, ["order"]);
        return { text: orderDoneText(o, { upi: await ownerUpi(c.ownerId, c.card), shop: c.card.company || "" }), alert: `🛒 New order on WhatsApp — ${orderOwnerLine(o)}. Please confirm with the customer.` };
      }
    }
  }
  const has = (a: string) => !!flow?.nodes.some((n) => n.options.some((o) => o.action === a));
  const intent = deskIntent(text, { book: has("book"), order: has("order") }) as DeskAction | null;
  if (intent) return deskStart(intent, c, text, false);
  if (!asksStock(text)) return null;
  const found = matchItems(text, await stockOf(c.ownerId));
  const ans = stockAnswer(found, { order: has("order") });
  return ans ? { text: ans.text, alert: ans.out ? `Asked for "${found[0].name}" — it is out of stock.` : undefined } : null;
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
  const site = card ? sellerSiteUrl(card, await getBrandTraining(card.username)) : "";
  for (const m of msgs) {
    if (!m.id || seen.has(m.id)) continue;
    seen.set(m.id, Date.now()); if (seen.size > 5000) for (const [k, t] of seen) if (Date.now() - t > 3600_000) seen.delete(k);
    const { kind, text } = textOf(m); if (!kind) continue;
    if (await alreadyLogged(acc.owner_id, m.id)) continue;
    const phone = e164(m.from), name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
    const sentAt = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : undefined;
    // A personal number the owner removed from the CRM for good: not saved, never answered (lib/crm-block.ts).
    if (await isBlocked(acc.owner_id, phone).catch(() => false)) continue;
    const leadId = await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, name, waId: m.id, direction: "in", sender: "customer", kind, text: text || (kind === "text" ? "" : `[${kind}]`), sentAt });
    if (!acc.enabled) continue;
    markRead(acc, m.id);
    if (STOP_RE.test(text)) {
      if (leadId) await restAsService(`leads?id=eq.${leadId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ opted_out: true }) });
      await reply(acc, card, phone, "ठीक है 🙏 अब आपको हमारी तरफ़ से promotional message नहीं आएँगे। कभी भी ज़रूरत हो तो यहीं लिख दें।");
      continue;
    }
    // Marked "Not interested" in the CRM (owner, 23 Oct 2026): the message is saved, nothing automatic goes back.
    if (leadId) {
      const lr = (await restAsService<{ tags: string[] | null }[]>(`leads?id=eq.${leadId}&select=tags`)).data;
      if (Array.isArray(lr) && (lr[0]?.tags ?? []).includes(AI_STOP_TAG)) continue;
    }
    // Owner/agent replied in the last 15 min → human is handling this chat.
    const hist = (await restAsService<{ direction: string; sender: string; text: string; sent_at: string }[]>(`wa_messages?owner_id=eq.${acc.owner_id}&phone=eq.${encodeURIComponent(phone)}&select=direction,sender,text,sent_at&order=sent_at.desc&limit=14`)).data ?? [];
    const rows = Array.isArray(hist) ? hist.reverse() : [];
    const lastOwner = rows.filter((r) => r.sender === "owner").pop();
    if (lastOwner && Date.now() - new Date(lastOwner.sent_at).getTime() < 15 * 60_000) continue;
    if (!card) continue;
    // Loop guard: another business's auto-reply bot answering ours would ping-pong for ever. Many bot replies in the
    // last 3 minutes and the last five inbound messages in that time all long (a real person cannot type five long
    // messages that fast, and mixes in short lines) → stay quiet.
    const recent = rows.filter((r) => Date.now() - new Date(r.sent_at).getTime() < 3 * 60_000);
    const botRecent = recent.filter((r) => r.sender === "bot").length;
    const lastIn = recent.filter((r) => r.direction === "in").slice(-5);
    if (botRecent >= 6 && lastIn.length === 5 && lastIn.every((r) => (r.text ?? "").trim().length > 80)) { console.warn("[wa-cloud] loop guard: no reply to", phone.slice(0, 6) + "…"); continue; }
    const firstContact = rows.filter((r) => r.direction === "in").length <= 1;
    const ctx: DeskCtx = { ownerId: acc.owner_id, card, site, from: m.from, phone, name, leadId };
    // The shop's own counter first (a talk in progress, "mera phone ban gaya?", "X hai kya?"), then the menu.
    const desk = text ? await deskCloud(ctx, text, await flowFor(acc.owner_id)).catch((e) => { console.error("[wa-cloud] desk", e); return null; }) : null;
    if (desk) {
      await reply(acc, card, phone, desk.text);
      if (desk.alert && leadId) await note(acc.owner_id, leadId, `🔔 ${desk.alert}`, true);
      if (desk.alert) await ownerAlert(acc.owner_id, { name, phone, alert: desk.alert, inbound: text });
      continue;
    }
    const flow = text ? await runFlow(ctx, text, firstContact) : null;
    let ask = text;
    if (flow && !flow.askAi) {
      if (!flow.menu || !(await replyMenu(acc, card, phone, flow.menu, flow.text))) await reply(acc, card, phone, flow.text);
      if (flow.alert && leadId) await note(acc.owner_id, leadId, `🔔 ${flow.alert}`, true);
      if (flow.alert) await ownerAlert(acc.owner_id, { name, phone, alert: flow.alert, inbound: text });
      continue;
    }
    if (flow?.askAi) ask = flow.askAi;
    if (!acc.ai_enabled) { if (flow?.askAi) await reply(acc, card, phone, "ज़रूर! आप अपना सवाल लिख दीजिए 🙂"); continue; }
    // The AI reply is a paid part (owner, 28 Nov 2026): a plan, or the WhatsApp AI bought alone. Without either the message stays a
    // lead in the CRM and the owner answers it — the same as a free number on the linked-device bridge.
    if (!(await serviceExpiry(acc.owner_id, "wa_ai").catch(() => "error"))) continue;
    if (!text) { // media without caption
      await reply(acc, card, phone, kind === "audio" ? "माफ़ कीजिए 🙏 मैं voice message अभी सुन नहीं पाता। आप टाइप करके भेज दें, तुरंत जवाब दूँगा।" : "धन्यवाद, मिल गया 🙏 बस ये बता दीजिए, आप इसके बारे में क्या जानना चाहते हैं?");
      continue;
    }
    const history: ChatMsg[] = rows.filter((r) => r.text && !r.text.startsWith("[")).map((r) => ({ role: r.direction === "in" ? "user" : "assistant", content: r.text }));
    if (ask !== text && history.length && history[history.length - 1].role === "user") history.pop();   // the menu number → the option's own words
    if (!history.length || history[history.length - 1].content !== ask) history.push({ role: "user", content: ask });
    const ai = await aiReply(card, history, "whatsapp");
    const { text: out0, alert } = splitAlert(ai);
    const { text: out1, order } = splitOrder(out0);
    // Demo talk → the demo video link goes along (once per chat: an earlier bot message already carrying it counts).
    const demoShared = !!demoLink(card.botFiles) && rows.some((r) => r.direction === "out" && r.text?.includes(demoLink(card.botFiles)!.url));
    const out = ensureDemoLink(out1, ask, card.botFiles, demoShared);
    if (out || order) {
      if (out) await reply(acc, card, phone, out);
      if (alert && leadId) await note(acc.owner_id, leadId, `🔔 AI alert: ${alert}`, true);
      // With a sound on the owner's phone (owner, 27 Nov 2026) — a CRM note alone tells nobody (lib/owner-alert.ts).
      if (alert || order) await ownerAlert(acc.owner_id, { name: order?.name || name, phone, alert: order ? `${order.kind === "booking" ? "Booking" : order.kind === "callback" ? "Call back" : "Order"}: ${orderSummary(order)}` : alert!, inbound: text });
      // The salesman closed on WhatsApp: the lead carries the order (name, what, value) and goes hot.
      if (order && leadId) {
        const kind = order.kind === "booking" ? "Booking" : order.kind === "callback" ? "Call back" : "Order";
        const ist = new Date(Date.now() + 5.5 * 3600_000);
        const followUp = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + (ist.getUTCHours() >= 18 ? 2 : 1), 11, 0) - 5.5 * 3600_000).toISOString();
        await restAsService(`leads?id=eq.${leadId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...(order.name ? { name: order.name } : {}), ai_intent: kind, value_paise: orderPaise(order), tags: [order.kind], next_follow_up: followUp, reminded_at: null, updated_at: new Date().toISOString() }) });
        await note(acc.owner_id, leadId, `🛒 ${kind}: ${orderSummary(order)}`, true);
        const at = order.kind === "booking" ? istInstant(order.at) : null;
        if (at) await createBooking({ ownerId: acc.owner_id, cardId: card.id, leadId, name: order.name || name, phone, service: order.items.map((i) => i.name).join(", ") || order.note, startsAt: at, note: order.when, source: "whatsapp" });
      }
    } else {
      const wa = card.links.find((l) => l.type === "whatsapp")?.value?.replace(/[^0-9]/g, "");
      await reply(acc, card, phone, `नमस्ते 🙏 ${card.name.split(" ")[0]} जी आपको जल्दी ही खुद जवाब देंगे।${site ? `\nतब तक डिटेल्स यहाँ देखें: ${site}` : ""}${wa ? `` : ""}`);
    }
  }
}
/** The menu as things to tap: up to three short options → reply buttons, up to ten → a list. False: it does not fit
 *  (long or repeated labels) or WhatsApp refused it — the caller sends the numbered text menu instead. */
async function replyMenu(acc: CloudAccount, card: Card | null, phone: string, menu: MenuOut, asText: string): Promise<boolean> {
  const labels = menu.labels.map((l) => l.trim()), body = menu.body.trim();
  if (!body || body.length > 1000 || !labels.length || labels.length > 10 || new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return false;
  const buttons = labels.length <= 3 && labels.every((l) => l.length >= 1 && l.length <= 20);
  if (!buttons && !labels.every((l) => l.length >= 1 && l.length <= 24)) return false;
  try {
    const id = await sendCloud(acc, phone, { interactive: buttons ? { body, buttons: labels } : { body, rows: labels, button: "Choose" } });
    if (id) await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, waId: id, direction: "out", sender: "bot", text: asText });
    return !!id;
  } catch (e) { console.warn("[wa-cloud] menu as buttons refused, sending text:", friendlyGraphError(e).slice(0, 120)); return false; }
}
/** "[MEDIA] url" lines in an AI reply → the text, then each file as a real photo / video / document message. */
async function reply(acc: CloudAccount, card: Card | null, phone: string, raw: string) {
  try {
    const text = completeFileSets(raw, card?.botFiles);  // a brochure's parts always go together
    const media = [...new Set([...text.matchAll(/^\s*\[MEDIA\]\s*(https?:\/\/\S+)\s*$/gim)].map((m) => m[1]))].slice(0, 6);
    const plain = text.replace(/^\s*\[MEDIA\].*$/gim, "").replace(/\n{3,}/g, "\n\n").trim();
    if (plain) {
      const id = await sendCloud(acc, phone, { text: plain });
      if (id) await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, waId: id, direction: "out", sender: "bot", text: plain });
    }
    for (const url of media) {
      const low = url.toLowerCase().split("?")[0];
      const file = card?.botFiles?.find((f) => f.url === url);
      const label = file?.label;
      if (file?.kind === "link" || !/\.(mp4|mov|pdf|jpe?g|png|webp)$/.test(low)) { // a plain link (YouTube…) marked as media: send it as text
        const id = await sendCloud(acc, phone, { text: url });
        if (id) await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, waId: id, direction: "out", sender: "bot", text: url });
        continue;
      }
      const payload = /\.(mp4|mov)$/.test(low) ? { videoUrl: url, caption: label } : /\.pdf$/.test(low) ? { documentUrl: url, fileName: `${(label || "document").replace(/[^a-z0-9 _-]+/gi, "").slice(0, 60) || "document"}.pdf`, caption: label } : { imageUrl: url, caption: label };
      const id = await sendCloud(acc, phone, payload);
      if (id) await logCloud({ ownerId: acc.owner_id, cardId: card?.id ?? null, phone, waId: id, direction: "out", sender: "bot", kind: "videoUrl" in payload ? "video" : "documentUrl" in payload ? "document" : "image", text: `[${label || "file"}] ${url}` });
    }
  } catch (e) {
    await restAsService(`wa_cloud_accounts?owner_id=eq.${acc.owner_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_error: friendlyGraphError(e).slice(0, 200), updated_at: new Date().toISOString() }) });
  }
}
async function note(ownerId: string, leadId: string, text: string, hot: boolean) {
  await restAsService("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: ownerId, lead_id: leadId, kind: "ai", text: text.slice(0, 500) }) });
  if (hot) await restAsService(`leads?id=eq.${leadId}&status=in.(new,contacted)`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "interested", updated_at: new Date().toISOString() }) });
}
