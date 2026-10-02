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

export function buildSystem(
  card: Card,
  wa?: string,
  platform?: PlatformKnowledge,
  brand?: BrandTraining,
  channel: "card" | "whatsapp" = "card",
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
    : channel === "whatsapp" ? `You are replying on WhatsApp for ${card.name} (${card.company}). Keep replies short (2-6 lines), WhatsApp-style, one question at a time.` : `You are the assistant on ${card.name}'s digital business card (${card.company}).`;
  // What the visitor is actually reading. Normally the whole card, so a question about products can be
  // answered from the home page; on a page that must stand alone (Shubhora), only that page.
  const content = opts.onlyPage ? [opts.onlyPage] : card.pages;
  return `${where}

${buildTrainingBlock(layers, trade)}${adminK}

THIS CARD (facts about this specific seller — always true):
- Name: ${card.name}${sideBySide ? ", Shubhora partner" : `, ${card.jobTitle} at ${card.company}`}
${sideBySide ? "" : `- Tagline: ${card.tagline}
- About: ${card.about}
`}- Contact: ${card.links.map((l) => `${l.type}:${l.value}`).join(", ")}
- Everything on the card / website (products with prices, services, FAQ, timings, address, offers, reviews — answer from these first):
${cardDigest({ ...card, pages: content }, { maxChars: 9000 })}

THIS SELLER'S WEBSITE (the card page — always call it the "website" when talking to the customer): ${cardSiteUrl(card, brand)}

CLOSING THE LOOP
- Anything you can't confirm (exact stock, delivery date, a custom discount): say ${card.name.split(" ")[0]} will confirm${wa ? ` — WhatsApp https://wa.me/${wa}` : ""}.
- Where it fits naturally, steer toward the demo/visit/booking button on the card.${channel === "whatsapp" ? `
- If the customer clearly wants to buy now, book a demo/visit, or complains, end your reply with a separate last line: [[ALERT: one-line summary for the seller]]` : ""}`;
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
