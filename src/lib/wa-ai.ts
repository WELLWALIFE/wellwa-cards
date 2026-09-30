// Shared AI reply engine for WhatsApp (Cloud API mode) and the on-card chat.
// Same system prompt layers as the on-card chat route: platform persona +
// brand training + this card's own knowledge, language-locked to the customer.
import { geminiComplete } from "@/lib/gemini";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildTrainingBlock, guessTrade, languageLock, type AiLayers } from "@/lib/ai-training";
import { getPlatformKnowledge, type PlatformKnowledge } from "@/lib/platform";
import type { Card } from "@/lib/types";
// Shubhora's own facts for Shubhora partners' assistants — one file shared with the WhatsApp bridge.
import { isShubhoraCard, ownNotes, shubhoraTraining } from "../../bridge/shubhora-kb.mjs";

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

export function buildSystem(card: Card, wa?: string, platform?: PlatformKnowledge, brand?: BrandTraining, channel: "card" | "whatsapp" = "card"): string {
  // A Shubhora partner sells Shubhora: Shubhora's current facts fill the brand layer (unless a white-label brand
  // already does), and the old frozen copy of those facts in the card's own notes is dropped.
  const shubhora = isShubhoraCard(card);
  if (shubhora && !brand?.brand_knowledge?.trim()) brand = { ...(brand ?? {}), ...shubhoraTraining(platform?.shubhora ?? {}) };
  const layers: AiLayers = {
    platformPersona: platform?.persona,
    platformRules: null,
    brandName: brand?.brand_name, brandPersona: brand?.brand_persona, brandKnowledge: brand?.brand_knowledge, brandFaq: brand?.brand_faq,
    cardPersona: card.botPersona, cardKnowledge: shubhora ? ownNotes(card.botKnowledge) : card.botKnowledge,
  };
  const trade = guessTrade([card.company, card.tagline, card.jobTitle, card.about].filter(Boolean).join(" "));
  const adminK = platform?.knowledge?.trim() ? `\n\nPLATFORM-WIDE INFO (applies to every card):\n${platform.knowledge.trim().slice(0, 3000)}` : "";
  const where = channel === "whatsapp" ? `You are replying on WhatsApp for ${card.name} (${card.company}). Keep replies short (2-6 lines), WhatsApp-style, one question at a time.` : `You are the assistant on ${card.name}'s digital business card (${card.company}).`;
  return `${where}

${buildTrainingBlock(layers, trade)}${adminK}

THIS CARD (facts about this specific seller — always true):
- Name: ${card.name}, ${card.jobTitle} at ${card.company}
- Tagline: ${card.tagline}
- About: ${card.about}
- Contact: ${card.links.map((l) => `${l.type}:${l.value}`).join(", ")}
- Pages & content: ${JSON.stringify(card.pages).slice(0, 3000)}

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
