// "Hi on WhatsApp → website" (owner's call, 8 Oct 2026).
//
// Shubhora's OWN WhatsApp number (the wa_cloud_accounts row whose owner is WA_ONBOARD_OWNER_ID) runs this bot
// instead of a seller's menu / AI reply. It talks a new business through what the website needs, one question at a
// time, in the language they write in; the AI itself decides what is still missing and asks for it. Then it:
//   1. makes their account (mobile number = login, no form, no OTP) and their poster profile;
//   2. takes their photos (shop, products, a rate list → products with prices are read off it) and voice notes;
//   3. runs the same build as the app (/api/card/build, as that user) and puts the website live under a link made
//      from the business name, wearing one of the three looks chosen per number — so two shops in the same trade do
//      not get the same website;
//   4. sends the link, a picture of it and a one-tap login into the app.
// After that the same chat EDITS the live website: "phone number badlo", "timing 10-8 karo", "offer lagao" go through
// the app's own checked edit operations (card-edit-ai.ts); 1 / 2 / 3 swaps the look; a photo joins the gallery.
//
// State: one wa_onboard row per number (migration 0063). Everything here runs with the service role; the website
// build runs as the user (a session minted from a magic link), so quotas, saves and ownership are exactly the app's.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { graph, logCloud, markRead, sendCloud, friendlyGraphError, type CloudAccount } from "@/lib/wa-cloud";
import { restAsService } from "@/lib/poster-server";
import { SUPA_URL, serviceHeaders, serviceConfigured } from "@/lib/admin-guard";
import { SITE_URL } from "@/lib/site-url";
import { geminiComplete, type GeminiMessage } from "@/lib/gemini";
import { phoneEmail } from "@/lib/phone";
import { matchCategory } from "@/lib/category-match";
import { categoryOf } from "@/lib/poster-categories";
import { mergeBuiltCard, type BuildResponse } from "@/lib/card-facts";
import { threeLooks, applyLook, type Look, type LookPlan } from "@/lib/site-looks";
import { applyEdits } from "@/lib/card-edits";
import { editOpsFor, type EditLang } from "@/lib/card-edit-ai";
import { screenshotCard } from "@/lib/render-page";
import { rateLimited } from "@/lib/api-security";
import type { Card, CardBlock, CardPage } from "@/lib/types";

/* ------------------------------------------------------------------ types ------------------------------------------------------------------ */
export type Stage = "new" | "asking" | "photos" | "building" | "live";
type Lang = EditLang;
type Product = { name: string; price?: string };
type Facts = {
  business?: string; trade?: string; city?: string; person?: string; about?: string; hours?: string; offer?: string;
  address?: string; email?: string; since?: string; upi?: string; products?: Product[];
};
type Photo = { url: string; kind: "shop" | "product" | "ratelist" | "logo" | "other" };
type Data = {
  facts: Facts; photos: Photo[]; history: { role: "user" | "assistant"; content: string }[]; lang?: Lang; waName?: string;
  /** Media that arrived before the account existed (Meta keeps it a while): read once the account is there. */
  pendingMedia?: { id: string; mime: string }[];
  cardId?: string; cardUsername?: string; looks?: BuildResponse["looks"]; lookIdx?: number;
  builds?: number; edits?: number; lastBusyAt?: number; buildStartedAt?: number;
};
type Row = { phone: string; user_id: string | null; stage: Stage; data: Data };

type WaMedia = { id?: string; mime_type?: string; caption?: string };
type WaMsg = { id: string; from: string; timestamp?: string; type: string; text?: { body: string }; image?: WaMedia; audio?: WaMedia; voice?: WaMedia; document?: WaMedia & { filename?: string }; video?: WaMedia; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } }; button?: { text: string }; location?: { name?: string; address?: string; latitude?: number; longitude?: number } };
type WaValue = { metadata?: { phone_number_id?: string }; contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: WaMsg[]; statuses?: unknown[] };

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const S = (v: unknown, n: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim().slice(0, n);
const e164 = (digits: string) => "+" + digits.replace(/[^0-9]/g, "");
const one = <T,>(r: { data: T[] | null }): T | null => (Array.isArray(r.data) ? r.data[0] ?? null : null);
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Is this Cloud API account Shubhora's own number (the one that makes websites)? */
export const isOnboardAccount = (acc: Pick<CloudAccount, "owner_id">) => !!process.env.WA_ONBOARD_OWNER_ID && acc.owner_id === process.env.WA_ONBOARD_OWNER_ID;

/* ------------------------------------------------------------------ language ------------------------------------------------------------------ */
const HINGLISH = /\b(hai|hain|ho|kar|karo|karna|kaise|kya|kyu|nahi|nahin|mera|meri|hamara|dukan|dukaan|chahiye|bhejo|batao|haan|ji|theek|thik|kaam|namaste|shop|wala|wale|banao|bana|do|dedo|lagao|badlo|hatao)\b/i;
function langOf(text: string, fallback: Lang = "hinglish"): Lang {
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (HINGLISH.test(text)) return "hinglish";
  if (/[a-z]{3,}/i.test(text)) return "en";
  return fallback;
}
const T = (lang: Lang, hi: string, hing: string, en: string) => (lang === "hi" ? hi : lang === "hinglish" ? hing : en);
const LANG_NAME: Record<Lang, string> = { hi: "Hindi, in Devanagari script", hinglish: "Hinglish (Hindi words in Latin letters, the way Indians type on WhatsApp)", en: "simple English" };

/* ------------------------------------------------------------------ state ------------------------------------------------------------------ */
const freshData = (): Data => ({ facts: {}, photos: [], history: [] });
async function loadRow(phone: string): Promise<Row> {
  const r = one(await restAsService<Row[]>(`wa_onboard?phone=eq.${encodeURIComponent(phone)}&select=phone,user_id,stage,data`));
  if (!r) return { phone, user_id: null, stage: "new", data: freshData() };
  const d = r.data && typeof r.data === "object" ? r.data : freshData();
  return { ...r, data: { ...freshData(), ...d, facts: d.facts ?? {}, photos: Array.isArray(d.photos) ? d.photos : [], history: Array.isArray(d.history) ? d.history : [] } };
}
async function saveRow(row: Row): Promise<void> {
  row.data.history = row.data.history.slice(-24);
  const r = await restAsService("wa_onboard?on_conflict=phone", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ phone: row.phone, user_id: row.user_id, stage: row.stage, data: row.data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) console.error("[wa-onboard] save failed", r.status, r.text.slice(0, 200), "— has migration 0063 run?");
}

/* ------------------------------------------------------------------ sending ------------------------------------------------------------------ */
async function say(acc: CloudAccount, phone: string, text: string): Promise<void> {
  try {
    const id = await sendCloud(acc, phone, { text });
    if (id) await logCloud({ ownerId: acc.owner_id, cardId: null, phone, waId: id, direction: "out", sender: "bot", text });
  } catch (e) {
    console.error("[wa-onboard] send failed", friendlyGraphError(e));
    await restAsService(`wa_cloud_accounts?owner_id=eq.${acc.owner_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_error: friendlyGraphError(e).slice(0, 200), updated_at: new Date().toISOString() }) });
  }
}
async function sayImage(acc: CloudAccount, phone: string, imageUrl: string, caption: string): Promise<boolean> {
  try {
    const id = await sendCloud(acc, phone, { imageUrl, caption });
    if (id) await logCloud({ ownerId: acc.owner_id, cardId: null, phone, waId: id, direction: "out", sender: "bot", kind: "image", text: caption });
    return !!id;
  } catch { return false; }
}

/* ------------------------------------------------------------------ media ------------------------------------------------------------------ */
async function fetchMedia(acc: CloudAccount, id: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const m = await graph<{ url?: string; mime_type?: string }>(acc.access_token, id);
    if (!m.url) return null;
    const r = await fetch(m.url, { headers: { Authorization: `Bearer ${acc.access_token}` }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) return null;
    return { buf, mime: (m.mime_type ?? r.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim() };
  } catch { return null; }
}
/** Into the media bucket under the owner's own folder (so the build may use it as THEIR photo). */
async function storeImage(uid: string, buf: Buffer, kind: string): Promise<string | null> {
  try {
    const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    const key = `poster/${uid}/wa-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, {
      method: "POST", headers: { ...serviceHeaders(), "Content-Type": "image/jpeg", "x-upsert": "true" }, body: new Uint8Array(out), signal: AbortSignal.timeout(20_000),
    });
    return up.ok ? `${SUPA_URL}/storage/v1/object/public/media/${key}` : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ AI ------------------------------------------------------------------ */
const KEY = () => process.env.GEMINI_API_KEY ?? "";
function parseJson<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { const a = s.indexOf("{"), z = s.lastIndexOf("}"); if (a >= 0 && z > a) { try { return JSON.parse(s.slice(a, z + 1)) as T; } catch { return null; } } return null; }
}

/** A voice note → its words, in the speaker's own language and script. */
async function transcribe(buf: Buffer, mime: string): Promise<string> {
  if (!KEY()) return "";
  try {
    const { text } = await geminiComplete({
      apiKey: KEY(), tag: "wa-onboard:voice", maxOutputTokens: 600, temperature: 0,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime || "audio/ogg", data: buf.toString("base64") } }, { text: "Transcribe this WhatsApp voice note word for word. Keep the speaker's language: Hindi in Devanagari, Hinglish as Latin letters, English as English. Output only the words, nothing else." }] }],
    });
    return text.trim().slice(0, 1500);
  } catch { return ""; }
}

type Seen = { kind: Photo["kind"]; products: Product[]; hours?: string; note?: string };
/** What is in a photo the owner sent: a rate list (→ products with prices), a product, the shop, a logo. */
async function lookAtPhoto(buf: Buffer, mime: string): Promise<Seen> {
  const fallback: Seen = { kind: "other", products: [] };
  if (!KEY()) return fallback;
  try {
    const small = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const { text } = await geminiComplete({
      apiKey: KEY(), tag: "wa-onboard:photo", maxOutputTokens: 1200, temperature: 0, json: true,
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } },
        { text: `A small Indian business owner sent this photo for their website. Answer as JSON only:
{"kind":"ratelist"|"product"|"shop"|"logo"|"other","products":[{"name":"…","price":"…"}],"hours":"…","note":"…"}
- kind: ratelist = a menu / price list / rate card / fee board with several items and prices; product = one or a few items for sale; shop = the shop front, interior, workshop, staff, a signboard; logo = a logo or visiting card; other = anything else.
- products: every item with its price exactly as written (₹ or Rs numbers as text, e.g. "120", "1,500 / kg"); keep names in the script they are written in; up to 40 for a rate list, else at most 3. Empty if none.
- hours: opening hours if a signboard shows them, else omit. note: one short line of what the photo shows.` },
      ] }],
    });
    const v = parseJson<{ kind?: string; products?: { name?: unknown; price?: unknown }[]; hours?: unknown; note?: unknown }>(text);
    if (!v) return fallback;
    const kind = (["ratelist", "product", "shop", "logo", "other"] as const).find((k) => k === v.kind) ?? "other";
    const products = (Array.isArray(v.products) ? v.products : []).map((p) => ({ name: S(p?.name, 60), price: S(p?.price, 30) })).filter((p) => p.name).slice(0, 40);
    void mime;
    return { kind, products, ...(S(v.hours, 120) ? { hours: S(v.hours, 120) } : {}), ...(S(v.note, 160) ? { note: S(v.note, 160) } : {}) };
  } catch { return fallback; }
}

const REQUIRED: (keyof Facts)[] = ["business", "trade", "city", "person"];
const missingOf = (f: Facts) => REQUIRED.filter((k) => !S(f[k], 200));

type Collected = { facts: Partial<Facts>; reply: string; done: boolean };
/** One turn of the conversation that gathers the website's facts: what the message tells us, and what to say next. */
async function collect(row: Row, text: string, lang: Lang): Promise<Collected> {
  const f = row.data.facts;
  const missing = missingOf(f);
  const fallbackQ = T(lang,
    missing[0] === "business" ? "आपकी दुकान / बिज़नेस का नाम क्या है?" : missing[0] === "trade" ? "आप क्या काम करते हैं या क्या बेचते हैं?" : missing[0] === "city" ? "आपकी दुकान किस शहर में है?" : "आपका नाम क्या है?",
    missing[0] === "business" ? "Aapki dukaan / business ka naam kya hai?" : missing[0] === "trade" ? "Aap kya kaam karte hain ya kya bechte hain?" : missing[0] === "city" ? "Aapki dukaan kis sheher me hai?" : "Aapka naam kya hai?",
    missing[0] === "business" ? "What is your shop / business called?" : missing[0] === "trade" ? "What do you do or sell?" : missing[0] === "city" ? "Which city is it in?" : "What is your name?");
  if (!KEY()) return { facts: {}, reply: fallbackQ, done: false };
  const system = `You are Shubhora's WhatsApp assistant. Shubhora makes a website (with a digital business card, product catalogue and WhatsApp ordering) for small Indian businesses — shops, clinics, tutors, salons, repair, agents, professionals — in minutes, free to start.
Your job in this chat: gather what the website needs, warmly, ONE question at a time, short WhatsApp-style messages (1–3 lines). No forms, no lists of questions.
REQUIRED (ask only for what is still missing, in this order): business — the shop / firm / clinic name (for a professional with no firm, use "<Name> — <profession>", e.g. "Dr. Meena Sharma — Dentist"); trade — what they do or sell, in a few words; city; person — the owner's name.
NICE TO HAVE, never insist, take it when they say it: about (what makes them special), hours, offer, address (area / landmark), since (year started), upi (UPI id), products (name + price).
Their mobile number is ${row.phone} (it is their WhatsApp) — never ask for a phone number; they can change it later.
If they ask what this is, answer in one line (free website + card in 10 minutes, right here) and go on with the next question. If they send something unrelated, answer briefly and return to the question. Never invent facts.
Write in ${LANG_NAME[lang]}. Address them with respect (ji / aap).
Reply with ONE JSON object only: {"facts":{...only the facts this message gives or corrects, keys from: business, trade, city, person, about, hours, offer, address, email, since, upi, products (array of {name, price})...}, "reply":"your next message to them", "done": true when business, trade, city and person are all known after this message}.
KNOWN SO FAR: ${JSON.stringify(f)}. STILL MISSING: ${missing.join(", ") || "nothing"}.
When done becomes true, "reply" must be a short confirmation of the business name, trade and city (one line), nothing more — the app adds what comes next.`;
  const history: GeminiMessage[] = row.data.history.slice(-10).map((m) => ({ role: m.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: m.content }] }));
  history.push({ role: "user", parts: [{ text }] });
  try {
    const { text: out } = await geminiComplete({ apiKey: KEY(), tag: "wa-onboard:collect", system, contents: history, maxOutputTokens: 700, temperature: 0.4, json: true });
    const v = parseJson<{ facts?: Record<string, unknown>; reply?: unknown; done?: unknown }>(out);
    if (!v) return { facts: {}, reply: fallbackQ, done: false };
    const got = (v.facts && typeof v.facts === "object" ? v.facts : {}) as Record<string, unknown>;
    const facts: Partial<Facts> = {};
    for (const k of ["business", "trade", "city", "person", "about", "hours", "offer", "address", "email", "since", "upi"] as const) { const s = S(got[k], k === "about" ? 600 : 120); if (s) facts[k] = s; }
    if (Array.isArray(got.products)) {
      const ps = got.products.map((p) => ({ name: S((p as Product)?.name, 60), price: S((p as Product)?.price, 30) })).filter((p) => p.name);
      if (ps.length) facts.products = ps;
    }
    const merged = { ...f, ...facts };
    const done = missingOf(merged).length === 0;
    return { facts, reply: S(v.reply, 900) || fallbackQ, done };
  } catch { return { facts: {}, reply: fallbackQ, done: false }; }
}

function mergeFacts(f: Facts, p: Partial<Facts>): Facts {
  const products = p.products ? [...(f.products ?? [])] : f.products;
  if (p.products && products) for (const np of p.products) { const i = products.findIndex((x) => x.name.toLowerCase() === np.name.toLowerCase()); if (i >= 0) products[i] = { ...products[i], ...(np.price ? { price: np.price } : {}) }; else products.push(np); }
  return { ...f, ...p, ...(products ? { products: products.slice(0, 40) } : {}) };
}

/* ------------------------------------------------------------------ account ------------------------------------------------------------------ */
/** The user id behind a mobile number, if an account exists (generate_link doubles as the lookup: it answers with the user). */
async function magic(email: string): Promise<{ userId: string; hashed: string } | null> {
  const g = await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: serviceHeaders(), body: JSON.stringify({ type: "magiclink", email }), cache: "no-store" });
  const j = (await g.json().catch(() => ({}))) as { id?: string; user?: { id?: string }; hashed_token?: string; properties?: { hashed_token?: string } };
  if (!g.ok) return null;
  const hashed = j.hashed_token ?? j.properties?.hashed_token ?? "";
  const userId = j.id ?? j.user?.id ?? "";
  return hashed && userId ? { userId, hashed } : null;
}
/** A session for that user (the website build and the app's own routes run as them). */
async function sessionFor(email: string): Promise<string | null> {
  const m = await magic(email); if (!m) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: m.hashed }), cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string };
  return r.ok && j.access_token ? j.access_token : null;
}
/** A one-tap link into the app, opening on the Card & Website page. */
async function loginLink(email: string, to = "/poster/site?edit=1"): Promise<string> {
  const m = await magic(email);
  return m ? `${SITE_URL}/auth/link?t=${encodeURIComponent(m.hashed)}&to=${encodeURIComponent(to)}` : `${SITE_URL}/login`;
}
async function asUser(token: string, path: string, init: { method?: string; json?: unknown } = {}): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${SITE_URL}${path}`, { method: init.method ?? (init.json ? "POST" : "GET"), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: init.json ? JSON.stringify(init.json) : undefined, cache: "no-store", signal: AbortSignal.timeout(60_000) });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, status: r.status, data };
}

function businessMeta(f: Facts) {
  const key = matchCategory(`${f.trade ?? ""} ${f.business ?? ""} ${f.about ?? ""}`);
  const cat = key ? categoryOf(key) : null;
  return {
    cat,
    business: { name: S(f.business, 80), role: "business", reach: "local", category: cat?.key ?? "", trade: S(f.trade, 40), city: S(f.city, 60), address: S(f.address, 200), about: S(f.about, 1200), website: "" },
  };
}

/** The account for this number: found, or made now from what the chat has gathered. Returns its id, or null. */
async function ensureAccount(row: Row): Promise<string | null> {
  if (row.user_id) return row.user_id;
  const email = phoneEmail(row.phone);
  const f = row.data.facts;
  const { cat, business } = businessMeta(f);
  const person = S(f.person, 60) || S(row.data.waName, 60) || business.name;
  let userId = (await magic(email))?.userId ?? null;
  const existed = !!userId;
  if (!userId) {
    const password = randomUUID() + "Aa1!";
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
      method: "POST", headers: serviceHeaders(), cache: "no-store",
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: {
        full_name: person, display_name: person, phone: row.phone, signed_up_via: "whatsapp", agreed_at: new Date().toISOString(), agreed_via: "whatsapp",
        business, you_done_at: new Date().toISOString(), setup_pos: null,
      } }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; msg?: string };
    if (!r.ok || !j.id) { console.error("[wa-onboard] create user failed", r.status, j.msg); return null; }
    userId = j.id;
  } else {
    // An account from the app: the chat's facts fill what it still lacks (never over an existing set-up).
    const u = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as { user_metadata?: Record<string, unknown> };
    const md = u.user_metadata ?? {};
    const biz = (md.business && typeof md.business === "object" ? md.business : {}) as Record<string, unknown>;
    if (!S(biz.name, 80)) await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ user_metadata: { ...md, business: { ...business, ...biz, name: business.name }, phone: md.phone || row.phone, setup_pos: null } }) }).catch(() => undefined);
  }
  row.user_id = userId;
  await saveRow(row);
  const token = await sessionFor(email);
  if (token && !existed) {
    await asUser(token, "/api/account", { json: { action: "auto", agree: true } }).catch(() => null);
    await asUser(token, "/api/welcome", { json: {} }).catch(() => null);
  }
  if (token) {
    const profiles = await asUser(token, "/api/poster/profiles").catch(() => null);
    const list = Array.isArray(profiles?.data.profiles) ? (profiles!.data.profiles as unknown[]) : [];
    if (!list.length) await asUser(token, "/api/poster/profiles", { json: { persona: cat?.persona ?? "business", name: business.name || person, phone: row.phone.replace(/\D/g, "").slice(-10), city: business.city, category: cat?.key ?? "", lang: row.data.lang === "en" ? "en" : "hi", is_default: true } }).catch(() => null);
  }
  return userId;
}

/* ------------------------------------------------------------------ the website ------------------------------------------------------------------ */
function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
const slugOf = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 32);
async function usernameAvailable(u: string): Promise<boolean> {
  const r = await restAsService<boolean>("rpc/username_available", { method: "POST", body: JSON.stringify({ p_username: u, p_card_id: null }) });
  return r.ok && r.data === true;
}
/** A link from the business name: sharma-sweets, then sharma-sweets-jaipur, then with the number's last digits. */
async function pickUsername(f: Facts, phone: string): Promise<string> {
  const base0 = slugOf(f.business ?? "") || slugOf(f.person ?? "") || "shop";
  const base = base0.length >= 3 ? base0 : `${base0}-${phone.slice(-4)}`;
  const tries = [base, `${base}-${slugOf(f.city ?? "")}`.replace(/-$/, ""), `${base}-${phone.slice(-4)}`, `${base}-${phone.slice(-6)}`];
  for (const u of tries) if (u.length >= 3 && u.length <= 32 && (await usernameAvailable(u))) return u;
  return `${base.slice(0, 20)}-${Math.random().toString(36).slice(2, 7)}`;
}
async function liveCard(uid: string, cardId?: string): Promise<Card | null> {
  const q = cardId ? `cards?owner_id=eq.${uid}&id=eq.${cardId}&select=id,username,active,data` : `cards?owner_id=eq.${uid}&order=created_at.desc&limit=1&select=id,username,active,data`;
  const row = one(await restAsService<{ id: string; username: string; active: boolean | null; data: Card }[]>(q));
  return row ? { ...(row.data as Card), id: row.id, username: row.username, active: row.active ?? true } : null;
}
/** The card row as the app's publishCard writes it (cloud.ts), with the service role. */
async function publish(uid: string, card: Card): Promise<boolean> {
  const safe = (c: string | undefined, d = "#6d28d9") => (/^#[0-9a-f]{6}$/i.test(c ?? "") ? (c as string) : d);
  const data: Card = { ...card, themeColor: safe(card.themeColor), avatarColor: safe(card.avatarColor, safe(card.themeColor)) };
  const row = { owner_id: uid, username: card.username, name: data.name, job_title: data.jobTitle, company: data.company, tagline: data.tagline, about: data.about, theme_color: data.themeColor, avatar_url: data.avatarUrl ?? null, cover_url: data.coverUrl ?? null, active: data.active, data };
  const existing = one(await restAsService<{ id: string }[]>(`cards?owner_id=eq.${uid}&id=eq.${card.id}&select=id`));
  const r = existing
    ? await restAsService(`cards?id=eq.${card.id}&owner_id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) })
    : await restAsService("cards", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: card.id, ...row }) });
  if (!r.ok) console.error("[wa-onboard] publish failed", r.status, r.text.slice(0, 200));
  return r.ok;
}
const siteUrl = (username: string) => `${SITE_URL}/c/${username}`;

/** The build, as the app runs it: started as the user, followed until it ends. Null when it failed or timed out. */
async function buildFor(token: string, row: Row): Promise<BuildResponse | null> {
  const f = row.data.facts;
  const photos = row.data.photos;
  const shop = photos.find((p) => p.kind === "shop");
  const facts = {
    lang: row.data.lang ?? "hinglish",
    hours: S(f.hours, 120), offer: S(f.offer, 200), since: S(f.since, 8), upi: S(f.upi, 80),
    specialText: S(f.about, 600), work: S(f.trade, 200),
    bannerUrl: shop?.url ?? "",
    photos: photos.filter((p) => p.kind !== "logo" && p.url !== shop?.url).map((p) => p.url).slice(0, 5),
  };
  // The build form carries six rows; a rate list often has thirty. The rest are saved as the owner's products first
  // (the build reads them back, so the catalogue page shows the whole list), the first six ride along on the form.
  const all = (f.products ?? []).map((p) => ({ name: p.name, brand: "", price: p.price ?? "", photo: "" }));
  const single = photos.filter((p) => p.kind === "product");
  if (all.length === 1 && single[0]) all[0].photo = single[0].url;
  if (all.length > 6 && !row.data.builds) {
    for (const p of all.slice(6, 40)) await asUser(token, "/api/poster/products", { json: { name: p.name, price: p.price, benefits: [], offer: "", category: "" } }).catch(() => null);
  }
  const products = all.slice(0, 6);
  const start = await asUser(token, "/api/card/build", { json: { async: true, facts, products } });
  if (!start.ok && start.status !== 202) { console.error("[wa-onboard] build start", start.status, JSON.stringify(start.data).slice(0, 200)); return null; }
  const t0 = Date.now();
  while (Date.now() - t0 < 8 * 60_000) {
    await sleep(5_000);
    const v = await asUser(token, "/api/card/build").catch(() => null);
    if (!v?.ok || !v.data.job) continue;
    if (v.data.state === "running") continue;
    const res = v.data.result as BuildResponse | { error?: string } | undefined;
    await asUser(token, "/api/card/build", { json: { claim: v.data.job } }).catch(() => null);
    if (v.data.state === "done" && res && (res as BuildResponse).ok) return res as BuildResponse;
    console.error("[wa-onboard] build failed", JSON.stringify(res ?? {}).slice(0, 200));
    return null;
  }
  return null;
}

/** The three looks for this card, one of them chosen by the number — neighbours in the same trade get different websites. */
function dressed(card: Card, plans: BuildResponse["looks"], phone: string, idx?: number): { card: Card; looks: Look[]; idx: number } {
  const looks = threeLooks(card, card.site?.style, plans as LookPlan[] | undefined);
  const i = idx != null && looks[idx] ? idx : looks.length ? hash(phone) % looks.length : 0;
  return { card: looks[i] ? applyLook(card, looks[i]) : card, looks, idx: i };
}
function looksMenu(looks: Look[], idx: number, lang: Lang): string {
  return looks.map((l, i) => `${i + 1}️⃣ ${lang === "hi" ? l.hi : l.name}${i === idx ? T(lang, " ✅ (अभी यही)", " ✅ (abhi yahi)", " ✅ (current)") : ""}`).join("\n");
}

const building = new Set<string>();
/** Build → look → live → tell them. Runs detached from the webhook (minutes long). */
async function buildAndGoLive(acc: CloudAccount, row: Row, lang: Lang): Promise<void> {
  if (building.has(row.phone)) return;
  building.add(row.phone);
  try {
    const uid = await ensureAccount(row);
    const token = uid ? await sessionFor(phoneEmail(row.phone)) : null;
    if (!uid || !token) throw new Error("no account / session");
    const res = await buildFor(token, row);
    if (!res) throw new Error("build failed");
    const existing = await liveCard(uid, row.data.cardId);
    const username = existing?.username ?? row.data.cardUsername ?? (await pickUsername(row.data.facts, row.phone));
    const merged = mergeBuiltCard(existing, res.card, { id: existing?.id ?? randomUUID(), username });
    const { card, looks, idx } = dressed(merged, res.looks, row.phone, existing ? row.data.lookIdx : undefined);
    if (!(await publish(uid, card))) throw new Error("publish failed");
    await asUser(token, "/api/card/facts", { method: "PATCH", json: { facts: { primaryCardId: card.id } } }).catch(() => null);
    row.data = { ...row.data, cardId: card.id, cardUsername: card.username, looks: res.looks, lookIdx: idx, builds: (row.data.builds ?? 0) + 1 };
    row.stage = "live";
    await saveRow(row);
    const url = siteUrl(card.username);
    const login = await loginLink(phoneEmail(row.phone));
    // A picture of it first (best effort, under a minute), then the link and what they can do now.
    const shot = await within(screenshotCard(card, url).catch(() => null), 50_000);
    const shotUrl = shot ? await storeImage(uid, shot, "shot") : null;
    const head = T(lang, `🎉 *${card.company || card.name}* की वेबसाइट तैयार है!`, `🎉 *${card.company || card.name}* ki website taiyar hai!`, `🎉 The website for *${card.company || card.name}* is ready!`);
    if (shotUrl) await sayImage(acc, row.phone, shotUrl, `${head}\n${url}`);
    const body = T(lang,
      `${shotUrl ? "" : `${head}\n`}🔗 ${url}\n\nये लिंक अपने ग्राहकों को भेजिए — इसमें आपका कार्ड, कैटलॉग और WhatsApp ऑर्डर बटन है।\n\n*लुक बदलना हो?* नंबर लिखें:\n${looksMenu(looks, idx, lang)}\n\n*कुछ भी बदलना हो तो यहीं लिखें*, जैसे:\n• टाइमिंग 10 से 8 करो\n• ऑफ़र लगाओ — 20% छूट\n• मेरा नाम ठीक करो\n• फ़ोटो भेजें → गैलरी में लग जाएगी\n\n📱 ऐप में खोलें (एक टैप लॉगिन): ${login}`,
      `${shotUrl ? "" : `${head}\n`}🔗 ${url}\n\nYe link apne customers ko bhejiye — isme aapka card, catalogue aur WhatsApp order button hai.\n\n*Look badalna ho?* Number likhiye:\n${looksMenu(looks, idx, lang)}\n\n*Kuch bhi badalna ho to yahin likhiye*, jaise:\n• timing 10 se 8 karo\n• offer lagao — 20% off\n• mera naam theek karo\n• photo bhejo → gallery me lag jayegi\n\n📱 App me kholiye (one-tap login): ${login}`,
      `${shotUrl ? "" : `${head}\n`}🔗 ${url}\n\nShare this link with your customers — it has your card, catalogue and a WhatsApp order button.\n\n*Want another look?* Reply with a number:\n${looksMenu(looks, idx, lang)}\n\n*To change anything, just write it here*, e.g.\n• change timing to 10 to 8\n• add offer — 20% off\n• fix my name\n• send a photo → it goes into the gallery\n\n📱 Open in the app (one-tap login): ${login}`);
    await say(acc, row.phone, body);
    row.data.history.push({ role: "assistant", content: `[website live] ${url}` });
    await saveRow(row);
  } catch (e) {
    console.error("[wa-onboard] build/live failed", e instanceof Error ? e.message : e);
    // A rebuild that failed leaves the live website as it was; a first build goes back to the photos step.
    row.stage = row.data.cardId ? "live" : "photos";
    await saveRow(row);
    await say(acc, row.phone, row.data.cardId
      ? T(lang, "माफ़ कीजिए 🙏 दोबारा नहीं बन पाई — आपकी पुरानी वेबसाइट वैसी ही लाइव है। थोड़ी देर बाद फिर कहें।", "Maaf kijiye 🙏 dobara nahi ban paayi — aapki purani website waise hi live hai. Thodi der baad phir kahiye.", "Sorry 🙏 the rebuild did not work — your website is live as it was. Please ask again in a little while.")
      : T(lang, "माफ़ कीजिए 🙏 वेबसाइट अभी नहीं बन पाई। कुछ देर बाद *ready* लिखकर दोबारा try करें।", "Maaf kijiye 🙏 website abhi nahi ban paayi. Thodi der baad *ready* likh kar dobara try karein.", "Sorry 🙏 the website could not be made just now. Please write *ready* in a little while to try again."));
  } finally { building.delete(row.phone); }
}

/* ------------------------------------------------------------------ live edits ------------------------------------------------------------------ */
const REBUILD_RE = /\b(rebuild|dobara banao|phir se banao|fir se banao|nayi website|new website|website dobara)\b|फिर से बनाओ|दोबारा बनाओ|नई वेबसाइट/i;
const LOGIN_RE = /^\s*(login|log in|app|link|app link|login link|लॉगिन|ऐप)\s*$/i;
const HELP_RE = /^\s*(help|menu|\?|मदद|madad|hi|hello|hii|namaste|नमस्ते)\s*$/i;

function addToGallery(card: Card, url: string, label: string): Card {
  const pages = card.pages.map((p) => ({ ...p, blocks: [...p.blocks] }));
  const img = { url, color: card.themeColor || "#6d28d9", label };
  for (const p of pages) for (let i = 0; i < p.blocks.length; i++) { const b = p.blocks[i]; if (b.kind === "gallery") { p.blocks[i] = { ...b, images: [...b.images, img].slice(0, 24) }; return { ...card, pages }; } }
  const home = pages.find((p) => p.slug === "home") ?? pages[0];
  const block: CardBlock = { id: `gal-${Date.now().toString(36)}`, kind: "gallery", title: "Gallery", images: [img] };
  if (home) home.blocks.push(block);
  else pages.push({ id: `pg-${Date.now().toString(36)}`, slug: "gallery", label: "Gallery", blocks: [block] } as CardPage);
  return { ...card, pages };
}

async function editLive(acc: CloudAccount, row: Row, text: string, lang: Lang): Promise<void> {
  const uid = row.user_id!;
  const card = await liveCard(uid, row.data.cardId);
  if (!card) { row.stage = "photos"; await saveRow(row); await say(acc, row.phone, T(lang, "वेबसाइट नहीं मिली — *ready* लिखें, मैं दोबारा बना देता हूँ।", "Website nahi mili — *ready* likhiye, main dobara bana deta hoon.", "I could not find the website — write *ready* and I will make it again.")); return; }
  const url = siteUrl(card.username);
  const n = /^\s*([1-3])\s*$/.exec(text);
  if (n) {
    const { card: next, looks, idx } = dressed(card, row.data.looks, row.phone, Number(n[1]) - 1);
    if (!looks[idx]) return;
    if (await publish(uid, next)) {
      row.data.lookIdx = idx; await saveRow(row);
      await say(acc, row.phone, T(lang, `✅ लुक बदल दिया: *${looks[idx].hi}*\n${url}\n\n${looksMenu(looks, idx, lang)}`, `✅ Look badal diya: *${looks[idx].name}*\n${url}\n\n${looksMenu(looks, idx, lang)}`, `✅ Look changed to *${looks[idx].name}*\n${url}\n\n${looksMenu(looks, idx, lang)}`));
    }
    return;
  }
  if (LOGIN_RE.test(text)) { await say(acc, row.phone, `📱 ${await loginLink(phoneEmail(row.phone))}`); return; }
  if (HELP_RE.test(text)) {
    await say(acc, row.phone, T(lang,
      `नमस्ते 🙏 आपकी वेबसाइट लाइव है:\n${url}\n\nजो बदलना हो, यहीं लिखें — टाइमिंग, नंबर, ऑफ़र, प्रोडक्ट, दाम। फ़ोटो भेजें तो गैलरी में लग जाती है।\n1/2/3 लिखकर लुक बदलें। *login* लिखकर ऐप खोलें।`,
      `Namaste 🙏 Aapki website live hai:\n${url}\n\nJo badalna ho yahin likhiye — timing, number, offer, product, daam. Photo bhejiye to gallery me lag jaati hai.\n1/2/3 likh kar look badliye. *login* likh kar app kholiye.`,
      `Hello 🙏 Your website is live:\n${url}\n\nWrite any change here — timings, number, offer, products, prices. Send a photo and it goes into the gallery.\nReply 1/2/3 to change the look, *login* to open the app.`));
    return;
  }
  if (REBUILD_RE.test(text)) {
    row.stage = "building"; row.data.buildStartedAt = Date.now(); await saveRow(row);
    await say(acc, row.phone, T(lang, "🔄 ठीक है, वेबसाइट दोबारा बना रहा हूँ — 3–5 मिनट। लिंक वही रहेगा।", "🔄 Theek hai, website dobara bana raha hoon — 3–5 minute. Link wahi rahega.", "🔄 Okay, making the website again — 3–5 minutes. The link stays the same."));
    void buildAndGoLive(acc, row, lang);
    return;
  }
  if (rateLimited(`wa-edit:${row.phone}`, 40, 60 * 60_000)) { await say(acc, row.phone, T(lang, "एक घंटे में बहुत बदलाव हो गए — थोड़ी देर बाद लिखें।", "Ek ghante me bahut badlav ho gaye — thodi der baad likhiye.", "Too many changes in an hour — please write again in a little while.")); return; }
  const r = await editOpsFor(card, text, lang, `wa-edit:${uid.slice(0, 8)}`);
  if (!r) { await say(acc, row.phone, T(lang, "AI ने जवाब नहीं दिया — एक बार फिर लिखें।", "AI ne jawab nahi diya — ek baar phir likhiye.", "The AI did not answer — please write it once more.")); return; }
  if (!r.ops.length) {
    const login = await loginLink(phoneEmail(row.phone));
    await say(acc, row.phone, `${r.summary || T(lang, "ये बदलाव मैं यहाँ से नहीं कर पाया।", "Ye badlav main yahan se nahi kar paaya.", "I could not make that change from here.")}\n\n${T(lang, "ऐप में Edit से कर सकते हैं:", "App me Edit se kar sakte hain:", "You can do it in the app under Edit:")} ${login}`);
    return;
  }
  const ed = applyEdits(card, r.ops, lang);
  if (!ed.applied) { await say(acc, row.phone, r.summary || T(lang, "कुछ बदला नहीं।", "Kuch badla nahi.", "Nothing changed.")); return; }
  if (await publish(uid, ed.card)) {
    row.data.edits = (row.data.edits ?? 0) + 1; await saveRow(row);
    await say(acc, row.phone, `✅ ${r.summary || T(lang, "हो गया।", "Ho gaya.", "Done.")}\n${url}`);
  } else await say(acc, row.phone, T(lang, "सेव नहीं हो पाया — फिर से try करें।", "Save nahi ho paaya — phir se try karein.", "Could not save — please try again."));
}

/* ------------------------------------------------------------------ the conversation ------------------------------------------------------------------ */
const seen = new Map<string, number>();

function photoLine(seenIt: Seen, count: number, lang: Lang): string {
  const got = seenIt.products.length;
  const what = seenIt.kind === "ratelist" ? T(lang, `रेट-लिस्ट पढ़ ली — ${got} आइटम दाम के साथ मिले।`, `Rate-list padh li — ${got} items daam ke saath mile.`, `Read the rate list — ${got} items with prices.`)
    : seenIt.kind === "product" ? T(lang, got ? `प्रोडक्ट मिला: ${seenIt.products.map((p) => p.name).join(", ")}` : "प्रोडक्ट की फ़ोटो मिली।", got ? `Product mila: ${seenIt.products.map((p) => p.name).join(", ")}` : "Product ki photo mili.", got ? `Product: ${seenIt.products.map((p) => p.name).join(", ")}` : "Got the product photo.")
    : seenIt.kind === "shop" ? T(lang, "दुकान की फ़ोटो मिली — ये बैनर बनेगी।", "Dukaan ki photo mili — ye banner banegi.", "Got the shop photo — it becomes the banner.")
    : seenIt.kind === "logo" ? T(lang, "लोगो मिल गया।", "Logo mil gaya.", "Got the logo.")
    : T(lang, "फ़ोटो मिल गई।", "Photo mil gayi.", "Got the photo.");
  return `📸 ${count}. ${what}\n${T(lang, "और भेजें, या *ready* लिखें — वेबसाइट बनाता हूँ।", "Aur bhejiye, ya *ready* likhiye — website banata hoon.", "Send more, or write *ready* and I will make the website.")}`;
}
const READY_RE = /^\s*(ready|skip|done|ok|okay|start|go|bana ?do|banao|bana|build|bas|ho gaya|हो गया|बनाओ|बना दो|बस|तैयार|शुरू)\s*[.!]*\s*$/i;

async function askForPhotos(acc: CloudAccount, row: Row, lang: Lang, lead: string): Promise<void> {
  await say(acc, row.phone, `${lead ? `${lead}\n\n` : ""}${T(lang,
    "अब दुकान, प्रोडक्ट या रेट-लिस्ट की *2–5 फ़ोटो* भेजिए — दाम मैं खुद पढ़ लूँगा। 📸\nफ़ोटो न हों तो *skip* लिखें, मैं अच्छी तस्वीरें लगा दूँगा।",
    "Ab dukaan, product ya rate-list ki *2–5 photo* bhejiye — daam main khud padh lunga. 📸\nPhoto na ho to *skip* likhiye, main achhi tasveerein laga dunga.",
    "Now send *2–5 photos* of your shop, products or rate list — I will read the prices myself. 📸\nNo photos? Write *skip* and I will use good pictures.")}`);
}

/** Inbound messages for Shubhora's own number. Quick parts run here; the build runs on after the webhook has answered. */
export async function handleOnboardValue(acc: CloudAccount, v: WaValue): Promise<void> {
  if (!serviceConfigured()) return;
  for (const m of v.messages ?? []) {
    if (!m.id || seen.has(m.id)) continue;
    seen.set(m.id, Date.now()); if (seen.size > 5000) for (const [k, t] of seen) if (Date.now() - t > 3600_000) seen.delete(k);
    const phone = e164(m.from);
    const waName = S(v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name, 60);
    const sentAt = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : undefined;
    const text = m.type === "text" ? S(m.text?.body, 1500) : m.type === "interactive" ? S(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title, 200) : m.type === "button" ? S(m.button?.text, 200) : "";
    const media: WaMedia | undefined = m.type === "image" ? m.image : m.type === "audio" ? m.audio : m.type === "voice" ? m.voice : m.type === "document" && /^image\//.test(m.document?.mime_type ?? "") ? m.document : undefined;
    const caption = S(media?.caption, 500);
    await logCloud({ ownerId: acc.owner_id, cardId: null, phone, name: waName, waId: m.id, direction: "in", sender: "customer", kind: m.type, text: text || caption || `[${m.type}]`, sentAt });
    if (!acc.enabled) continue;
    markRead(acc, m.id);
    if (rateLimited(`wa-onboard:${phone}`, 60, 60 * 60_000)) continue;
    try { await handleOne(acc, phone, waName, m, text, media, caption); }
    catch (e) { console.error("[wa-onboard]", e instanceof Error ? e.message : e); }
  }
}

async function handleOne(acc: CloudAccount, phone: string, waName: string, m: WaMsg, text: string, media: WaMedia | undefined, caption: string): Promise<void> {
  const row = await loadRow(phone);
  if (waName) row.data.waName = waName;
  // Someone who made their account in the app and now writes here: their live website is the one to edit.
  if (row.stage === "new" && !row.user_id) {
    const found = await magic(phoneEmail(phone));
    if (found) {
      row.user_id = found.userId;
      const card = await liveCard(found.userId);
      if (card) { row.stage = "live"; row.data.cardId = card.id; row.data.cardUsername = card.username; }
    }
  }
  const lang: Lang = text ? langOf(text, row.data.lang ?? "hinglish") : (row.data.lang ?? "hinglish");
  row.data.lang = lang;

  // A voice note is its words.
  const isAudio = m.type === "audio" || m.type === "voice";
  if (media?.id && isAudio) {
    const got = await fetchMedia(acc, media.id);
    const words = got ? await transcribe(got.buf, got.mime) : "";
    if (!words) { await say(acc, phone, T(lang, "आवाज़ साफ़ नहीं आई 🙏 एक बार लिखकर भेज दें।", "Awaaz saaf nahi aayi 🙏 ek baar likh kar bhej dein.", "I could not hear that clearly 🙏 please type it once.")); return; }
    text = words;
    row.data.lang = langOf(words, lang);
  }
  const isImage = !!media?.id && !isAudio;
  if (text) row.data.history.push({ role: "user", content: text });

  /* ---- building: wait ---- */
  if (row.stage === "building") {
    const stale = !row.data.buildStartedAt || Date.now() - row.data.buildStartedAt > 10 * 60_000;
    if (stale && !building.has(phone)) { row.stage = "photos"; await saveRow(row); }
    else {
      if (!row.data.lastBusyAt || Date.now() - row.data.lastBusyAt > 60_000) {
        row.data.lastBusyAt = Date.now(); await saveRow(row);
        await say(acc, phone, T(lang, "⏳ वेबसाइट बन रही है — 2–4 मिनट और। तैयार होते ही लिंक भेजता हूँ।", "⏳ Website ban rahi hai — 2–4 minute aur. Taiyar hote hi link bhejta hoon.", "⏳ The website is being made — 2–4 more minutes. I will send the link as soon as it is ready."));
      }
      return;
    }
  }

  /* ---- live: edits, looks, photos into the gallery ---- */
  if (row.stage === "live" && row.user_id) {
    if (isImage && media?.id) {
      const got = await fetchMedia(acc, media.id);
      const url = got ? await storeImage(row.user_id, got.buf, "photo") : null;
      const card = url ? await liveCard(row.user_id, row.data.cardId) : null;
      if (url && card && (await publish(row.user_id, addToGallery(card, url, caption || "")))) {
        await say(acc, phone, T(lang, `📸 फ़ोटो गैलरी में लगा दी।\n${siteUrl(card.username)}`, `📸 Photo gallery me laga di.\n${siteUrl(card.username)}`, `📸 Added the photo to the gallery.\n${siteUrl(card.username)}`));
      } else await say(acc, phone, T(lang, "फ़ोटो लग नहीं पाई — फिर भेजें।", "Photo lag nahi paayi — phir bhejiye.", "Could not add the photo — please send it again."));
      if (caption) await editLive(acc, row, caption, lang);
      await saveRow(row);
      return;
    }
    if (!text) return;
    await editLive(acc, row, text, lang);
    row.data.history.push({ role: "assistant", content: "[edit handled]" });
    await saveRow(row);
    return;
  }

  /* ---- photos: collect pictures (and anything else they tell us), then build ---- */
  if (row.stage === "photos" && row.user_id) {
    if (isImage && media?.id) {
      const got = await fetchMedia(acc, media.id);
      if (!got) { await say(acc, phone, T(lang, "फ़ोटो नहीं मिल पाई — फिर भेजें।", "Photo mil nahi paayi — phir bhejiye.", "Could not fetch the photo — please send it again.")); return; }
      const [url, seenIt] = await Promise.all([storeImage(row.user_id, got.buf, "photo"), lookAtPhoto(got.buf, got.mime)]);
      if (url) row.data.photos.push({ url, kind: seenIt.kind });
      if (seenIt.products.length) row.data.facts = mergeFacts(row.data.facts, { products: seenIt.products });
      if (seenIt.hours && !row.data.facts.hours) row.data.facts.hours = seenIt.hours;
      if (caption) { const c = await collect(row, caption, lang); row.data.facts = mergeFacts(row.data.facts, c.facts); }
      await saveRow(row);
      if (row.data.photos.length >= 6) { await startBuild(acc, row, lang, T(lang, "6 फ़ोटो हो गईं — बस, इतना काफ़ी है!", "6 photo ho gayi — bas, itna kaafi hai!", "That is 6 photos — plenty!")); return; }
      await say(acc, phone, photoLine(seenIt, row.data.photos.length, lang));
      return;
    }
    if (!text) return;
    if (READY_RE.test(text)) { await startBuild(acc, row, lang, ""); return; }
    const c = await collect(row, text, lang);
    row.data.facts = mergeFacts(row.data.facts, c.facts);
    row.data.history.push({ role: "assistant", content: c.reply });
    await saveRow(row);
    await say(acc, phone, `${c.reply}\n\n${T(lang, "फ़ोटो भेजें, या *ready* लिखें।", "Photo bhejiye, ya *ready* likhiye.", "Send photos, or write *ready*.")}`);
    return;
  }

  /* ---- new / asking: the AI gathers the facts ---- */
  if (isImage && media?.id) {
    row.data.pendingMedia = [...(row.data.pendingMedia ?? []), { id: media.id, mime: media.mime_type ?? "image/jpeg" }].slice(-6);
    if (!text && !caption) {
      await saveRow(row);
      await say(acc, phone, T(lang, "फ़ोटो मिल गई 👍 इसे मैं वेबसाइट में लगाऊँगा। पहले दो-तीन बातें बता दें —", "Photo mil gayi 👍 Ise main website me lagaunga. Pehle do-teen baatein bata dein —", "Got the photo 👍 I will put it on the website. First, two or three quick things —"));
      text = T(lang, "(फ़ोटो भेजी)", "(photo bheji)", "(sent a photo)");
    } else text = text || caption;
  }
  if (!text) return;
  if (row.stage === "new") {
    row.stage = "asking";
    const hello = T(lang,
      `नमस्ते${waName ? ` ${waName.split(" ")[0]} जी` : ""} 🙏 मैं Shubhora का AI हूँ। 10 मिनट में आपकी *वेबसाइट + डिजिटल कार्ड* बना देता हूँ — यहीं WhatsApp पर, शुरू करना फ़्री है।`,
      `Namaste${waName ? ` ${waName.split(" ")[0]} ji` : ""} 🙏 Main Shubhora ka AI hoon. 10 minute me aapki *website + digital card* bana deta hoon — yahin WhatsApp par, shuru karna free hai.`,
      `Hello${waName ? ` ${waName.split(" ")[0]}` : ""} 🙏 I am Shubhora's AI. I make your *website + digital card* in 10 minutes — right here on WhatsApp, free to start.`);
    const c = await collect(row, text, lang);
    row.data.facts = mergeFacts(row.data.facts, c.facts);
    row.data.history.push({ role: "assistant", content: c.reply });
    await saveRow(row);
    if (c.done) { await afterFacts(acc, row, lang, `${hello}\n\n${c.reply}`); return; }
    await say(acc, phone, `${hello}\n\n${c.reply}`);
    return;
  }
  const c = await collect(row, text, lang);
  row.data.facts = mergeFacts(row.data.facts, c.facts);
  row.data.history.push({ role: "assistant", content: c.reply });
  await saveRow(row);
  if (c.done) { await afterFacts(acc, row, lang, c.reply); return; }
  await say(acc, phone, c.reply);
}

/** The required facts are in: the account is made now, photos sent earlier are read, and the photos step opens. */
async function afterFacts(acc: CloudAccount, row: Row, lang: Lang, lead: string): Promise<void> {
  const uid = await ensureAccount(row);
  if (!uid) {
    await say(acc, row.phone, T(lang, "माफ़ कीजिए, अकाउंट अभी नहीं बन पाया 🙏 थोड़ी देर बाद फिर लिखें।", "Maaf kijiye, account abhi nahi ban paaya 🙏 thodi der baad phir likhiye.", "Sorry, the account could not be made just now 🙏 please write again in a little while."));
    return;
  }
  const pending = row.data.pendingMedia ?? [];
  row.data.pendingMedia = [];
  for (const p of pending) {
    const got = await fetchMedia(acc, p.id);
    if (!got) continue;
    const [url, seenIt] = await Promise.all([storeImage(uid, got.buf, "photo"), lookAtPhoto(got.buf, got.mime)]);
    if (url) row.data.photos.push({ url, kind: seenIt.kind });
    if (seenIt.products.length) row.data.facts = mergeFacts(row.data.facts, { products: seenIt.products });
  }
  row.stage = "photos";
  await saveRow(row);
  const n = row.data.photos.length;
  const got = n ? T(lang, `${n} फ़ोटो पहले से मिल गई${row.data.facts.products?.length ? `, ${row.data.facts.products.length} आइटम दाम के साथ` : ""}।`, `${n} photo pehle se mil gayi${row.data.facts.products?.length ? `, ${row.data.facts.products.length} items daam ke saath` : ""}.`, `${n} photo${n > 1 ? "s" : ""} already in${row.data.facts.products?.length ? `, ${row.data.facts.products.length} items with prices` : ""}.`) : "";
  await askForPhotos(acc, row, lang, [lead, got].filter(Boolean).join("\n"));
}

async function startBuild(acc: CloudAccount, row: Row, lang: Lang, lead: string): Promise<void> {
  row.stage = "building"; row.data.buildStartedAt = Date.now(); row.data.lastBusyAt = Date.now();
  await saveRow(row);
  const n = row.data.photos.length, p = row.data.facts.products?.length ?? 0;
  const summary = T(lang,
    `🚀 ${lead ? `${lead} ` : ""}*${row.data.facts.business}* की वेबसाइट बना रहा हूँ${n ? ` — ${n} फ़ोटो` : ""}${p ? `, ${p} प्रोडक्ट` : ""}।\n3–5 मिनट लगेंगे। तैयार होते ही लिंक यहीं भेजूँगा। ☕`,
    `🚀 ${lead ? `${lead} ` : ""}*${row.data.facts.business}* ki website bana raha hoon${n ? ` — ${n} photo` : ""}${p ? `, ${p} product` : ""}.\n3–5 minute lagenge. Taiyar hote hi link yahin bhejunga. ☕`,
    `🚀 ${lead ? `${lead} ` : ""}Making the website for *${row.data.facts.business}*${n ? ` — ${n} photo${n > 1 ? "s" : ""}` : ""}${p ? `, ${p} product${p > 1 ? "s" : ""}` : ""}.\nIt takes 3–5 minutes. I will send the link here as soon as it is ready. ☕`);
  await say(acc, row.phone, summary);
  void buildAndGoLive(acc, row, lang);
}
