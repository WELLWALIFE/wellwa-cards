// Shared AI reply engine for WhatsApp (Cloud API mode) and the on-card chat.
// Same system prompt layers as the on-card chat route: platform persona +
// brand training + this card's own knowledge, language-locked to the customer.
import { geminiComplete } from "@/lib/gemini";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildTrainingBlock, guessTrade, languageLock, type AiLayers } from "@/lib/ai-training";
import { getPlatformKnowledge, type PlatformKnowledge } from "@/lib/platform";
import type { Card, CardPage } from "@/lib/types";
// Shubhora's own facts for Shubhora partners' assistants — one file shared with the WhatsApp bridge.
import { isShubhoraCard, ownNotes, shubhoraTraining } from "../../bridge/shubhora-kb.mjs";
import { cardDigest } from "../../bridge/card-digest.mjs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type BrandTraining = {
  brand_name?: string | null; brand_persona?: string | null;
  brand_knowledge?: string | null; brand_faq?: string | null;
  brand_domain?: string | null;
} | null;

/** The white-label partner's training for this card, if it belongs to one. */
export async function getBrandTraining(username: string): Promise<BrandTraining> {
  const sb = getAdminSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.rpc("card_ai_context", { p_username: username });
    return (Array.isArray(data) ? data[0] : data) ?? null;
  } catch { return null; }
}

export function cardSiteUrl(card: Card, brand?: BrandTraining): string {
  return brand?.brand_domain ? `https://${card.username}.${brand.brand_domain}` : `${SITE}/c/${card.username}`;
}
/** The link the assistant gives customers: the owner's OWN website when they set one (Train AI bot), else the card. */
export function sellerSiteUrl(card: Card, brand?: BrandTraining): string {
  const own = String(card.botSite ?? "").trim();
  return own ? (/^https?:\/\//i.test(own) ? own : `https://${own}`) : cardSiteUrl(card, brand);
}

export function buildSystem(
  card: Card,
  wa?: string,
  platform?: PlatformKnowledge,
  brand?: BrandTraining,
  channel: "card" | "whatsapp" | "phone" = "card",
  /** `asShubhoraSeller`: answer as a Shubhora seller even though the card itself is not one — the Shubhora
   *  page of a `kb: "both"` card, whose owner also runs their own business. `onlyPage`: the visitor is on
   *  that one page and nothing else on the card may be used. Both keep the owner's two sides apart. */
  opts: { asShubhoraSeller?: boolean; onlyPage?: CardPage } = {},
): string {
  // A Shubhora partner sells Shubhora: Shubhora's current facts fill the brand layer (unless a white-label brand
  // already does), and the old frozen copy of those facts in the card's own notes is dropped.
  const shubhora = !!opts.asShubhoraSeller || isShubhoraCard(card);
  if (shubhora && !brand?.brand_knowledge?.trim()) brand = { ...(brand ?? {}), ...shubhoraTraining(platform?.shubhora ?? {}) };
  // The Shubhora page of a card that is ALSO someone's own business: the owner's own persona and notes are
  // about that business (their prices, their timings) and must not leak into a Shubhora answer. The page
  // answers from Shubhora's own official knowledge instead.
  const sideBySide = !!opts.asShubhoraSeller && !isShubhoraCard(card);
  const layers: AiLayers = {
    platformPersona: platform?.persona,
    platformRules: null,
    brandName: brand?.brand_name, brandPersona: brand?.brand_persona, brandKnowledge: brand?.brand_knowledge, brandFaq: brand?.brand_faq,
    cardPersona: sideBySide ? "" : card.botPersona,
    cardKnowledge: sideBySide ? "" : shubhora ? ownNotes(card.botKnowledge) : card.botKnowledge,
  };
  const trade = guessTrade([card.company, card.tagline, card.jobTitle, card.about].filter(Boolean).join(" "));
  const adminK = platform?.knowledge?.trim() ? `\n\nPLATFORM-WIDE INFO (applies to every card):\n${platform.knowledge.trim().slice(0, 3000)}` : "";
  const where = sideBySide
    ? `You are the assistant on ${card.name}'s SHUBHORA page. ${card.name} is a Shubhora partner. On this page you talk about Shubhora only — what it is, its plans and prices, and the partner business. ${card.name} also runs their own separate business (${card.company}); that is a different page with its own assistant, so never describe, price or promote it here. If the visitor asks about it, say ${card.name.split(" ")[0]} will tell them directly${wa ? ` — WhatsApp https://wa.me/${wa}` : ""}.`
    : channel === "whatsapp" ? `You are replying on WhatsApp for ${card.name} (${card.company}). Keep replies short (2-6 lines), WhatsApp-style, one question at a time.`
    : channel === "phone" ? `You are the receptionist answering the PHONE for ${card.company || card.name} — a live voice call. Speak the way a warm, quick Indian receptionist speaks: one or two short sentences at a time, then let the caller talk. Match the caller's language (Hindi, Hinglish or English) from their first words; start in Hindi. Never read out links, ids or long lists; offer to send details on WhatsApp instead. Numbers and prices slowly and clearly. If asked something you do not know, say ${card.name.split(" ")[0]} ji will call back, and take the caller's name.`
    : `You are the assistant on ${card.name}'s digital business card (${card.company}).`;
  // What the visitor is actually reading. Normally the whole card, so a question about products can be
  // answered from the home page; on a page that must stand alone (Shubhora), only that page.
  const content = opts.onlyPage ? [opts.onlyPage] : card.pages.filter((p) => !p.hidden);
  return `${where}

${buildTrainingBlock(layers, trade)}${adminK}

THIS CARD (facts about this specific seller — always true):
- Name: ${card.name}${sideBySide ? ", Shubhora partner" : `, ${card.jobTitle} at ${card.company}`}
${sideBySide ? "" : `- Tagline: ${card.tagline}
- About: ${card.about}
`}- Contact: ${card.links.map((l) => `${l.type}:${l.value}`).join(", ")}
- Everything on the card / website (products with prices, services, FAQ, timings, address, offers, reviews — answer from these first):
${cardDigest({ ...card, pages: content }, { maxChars: 9000 })}

THIS SELLER'S WEBSITE (always call it the "website" when talking to the customer): ${sellerSiteUrl(card, brand)}${card.botSite?.trim() ? `
- This is the seller's OWN website: send customers there for details, catalogue and orders; never mention the Shubhora card page unless asked. The "From my website" part of the knowledge above is what that site says — answer from it first.` : " (the card page)"}

CLOSING THE LOOP
- Anything you can't confirm (exact stock, delivery date, a custom discount): say ${card.name.split(" ")[0]} will confirm${wa ? ` — WhatsApp https://wa.me/${wa}` : ""}.
- Where it fits naturally, steer toward the demo/visit/booking button on the card.${channel === "whatsapp" ? `
- If the customer clearly wants to buy now, book a demo/visit, or complains, end your reply with a separate last line: [[ALERT: one-line summary for the seller]]` : ""}${shubhora || channel === "phone" ? "" : `

SELLING — you are ${card.name.split(" ")[0]}'s salesperson, not an FAQ (owner's call, 8 Oct 2026)
- Lead to a decision: when they ask about something, name the best-fitting item with its price (from the card) and one reason it suits them, then offer the next step — order, book, visit or a call back.
- When they want to order, book or be called back: get what exactly (items with quantity, or the service with a preferred day/time)${channel === "whatsapp" ? " and their name" : ", their name and their mobile number"} — ask for ONE missing thing at a time. Then confirm in one line and append, as the LAST line of that reply, exactly:
[[ORDER: {"kind":"order"|"booking"|"callback","name":"…","phone":"…","items":[{"name":"…","qty":1,"price":"…"}],"when":"…","at":"YYYY-MM-DDTHH:MM","note":"…","total":"…"}]]
  For a booking, ask the day AND the time; "at" is that moment in India time (today is ${new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)}, so "kal 4 baje" = tomorrow 16:00); within the card's opening hours when it states them; "" when they gave none. Prices only from the card; "total" empty when unsure${channel === "whatsapp" ? `; "phone" is "" — on WhatsApp their number is the one they write from` : "; never invent a name or number — ask"}.
- Send the ORDER line once per request; after it, answer follow-ups normally. Never promise delivery dates or discounts the card does not state.`}${channel !== "phone" ? "" : `

ON THE PHONE — you are ${card.name.split(" ")[0]}'s receptionist and salesperson
- Find out in the first exchange what the caller needs; answer from the card; suggest the best-fitting item with its price when they are choosing.
- If they want to order, book or be called back: take their name, what exactly, and for a booking the day and time; repeat it back once to confirm. Their number is the one they are calling from — do not ask for it.
- Close warmly: say what happens next (we will confirm on WhatsApp / ${card.name.split(" ")[0]} ji will call), thank them, and stop talking. Never say you are an AI unless asked; if asked, say yes, you are ${card.company || card.name}'s AI assistant.`}`;
}

/** The hand-off a reply may end with: what the customer settled on, for the owner's CRM and the next-step buttons. */
export type ChatOrder = { kind: "order" | "booking" | "callback"; name: string; phone: string; items: { name: string; qty: number; price: string }[]; when: string; /** The booking's moment, "YYYY-MM-DDTHH:MM" India time; "" when none was given. */ at: string; note: string; total: string };
/** Split a trailing [[ORDER: {…}]] line off an AI reply. */
export function splitOrder(reply: string): { text: string; order: ChatOrder | null } {
  const m = reply.match(/\[\[ORDER:\s*(\{[\s\S]*\})\s*\]\]\s*$/i);
  if (!m) return { text: reply.replace(/\[\[ORDER:[\s\S]*$/i, "").trim(), order: null };
  const S = (v: unknown, n: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim().slice(0, n);
  try {
    const o = JSON.parse(m[1]) as Record<string, unknown>;
    const kind = (["order", "booking", "callback"] as const).find((k) => k === o.kind) ?? "order";
    const items = (Array.isArray(o.items) ? o.items : []).map((it) => { const x = (it ?? {}) as Record<string, unknown>; return { name: S(x.name, 80), qty: Math.max(1, Math.min(999, Math.round(Number(x.qty)) || 1)), price: S(x.price, 30) }; }).filter((it) => it.name).slice(0, 12);
    const order: ChatOrder = { kind, name: S(o.name, 80), phone: S(o.phone, 20).replace(/[^0-9+]/g, ""), items, when: S(o.when, 120), at: S(o.at, 20), note: S(o.note, 300), total: S(o.total, 30) };
    return { text: reply.slice(0, m.index).trim(), order };
  } catch { return { text: reply.slice(0, m.index).trim(), order: null }; }
}
/** Rupees in a price string ("₹1,200", "1200/kg", "Rs 850") → paise; 0 when none. */
export function paiseOf(s: string): number {
  const m = String(s ?? "").replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);
  return m ? Math.round(parseFloat(m[0]) * 100) : 0;
}
/** The order in words, for the owner's alert and the customer's WhatsApp message. */
export function orderSummary(o: ChatOrder): string {
  const items = o.items.map((it) => `${it.qty > 1 ? `${it.qty} × ` : ""}${it.name}${it.price ? ` (${it.price})` : ""}`).join(", ");
  const total = o.total || (o.items.length && o.items.every((it) => paiseOf(it.price)) ? `₹${(o.items.reduce((s, it) => s + paiseOf(it.price) * it.qty, 0) / 100).toLocaleString("en-IN")}` : "");
  return [items, total ? `Total ${total}` : "", o.when ? `When: ${o.when}` : "", o.note].filter(Boolean).join(" · ");
}
/** Order value in paise: the stated total, else the items added up. */
export function orderPaise(o: ChatOrder): number {
  return paiseOf(o.total) || o.items.reduce((s, it) => s + paiseOf(it.price) * it.qty, 0);
}

/** One AI turn. Returns "" when no key / blocked / error so callers can fall back. */
export async function aiReply(card: Card, history: ChatMsg[], channel: "card" | "whatsapp" = "card"): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";
  const safe = history.slice(-12).map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 1200) }));
  const wa = card.links.find((l) => l.type === "whatsapp")?.value?.replace(/[^0-9]/g, "");
  try {
    const [platform, brand] = await Promise.all([getPlatformKnowledge(), getBrandTraining(card.username)]);
    const { text, blocked } = await geminiComplete({
      apiKey: key, maxOutputTokens: 500,
      system: buildSystem(card, wa, platform, brand, channel) + languageLock(safe[safe.length - 1]?.content ?? ""),
      contents: safe.map((m) => ({ role: m.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: m.content }] })),
    });
    return blocked ? "" : text.trim();
  } catch { return ""; }
}

/** Split a trailing [[ALERT: …]] line off an AI reply. */
export function splitAlert(reply: string): { text: string; alert: string } {
  const m = reply.match(/\[\[ALERT:\s*([^\]]+)\]\]\s*$/i);
  return m ? { text: reply.slice(0, m.index).trim(), alert: m[1].trim() } : { text: reply, alert: "" };
}
