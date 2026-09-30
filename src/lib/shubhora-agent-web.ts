// Server glue for the Shubhora partner assistant (bridge/shubhora-agent.mjs) on the web: the card chat and the
// Super Admin test chats. WhatsApp runs the very same module inside the bridge, so all three behave the same.
import { geminiComplete } from "@/lib/gemini";
import { fetchCardOwnerUsername, fetchCloudCard, getPublicSupabase } from "@/lib/supabase/public";
import type { PlatformKnowledge } from "@/lib/platform";
import type { Card } from "@/lib/types";
import { agentLinks, firstName, replyLanguage } from "../../bridge/shubhora-agent.mjs";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export type AgentMsg = { role: "user" | "assistant"; content: string; at?: number };
type AgentRequest = { system: string; messages: { role: string; content: string }[]; maxTokens?: number; temperature?: number };

/** Template previews saved in Super Admin (the assistant links the one that fits the customer's trade). */
async function savedTemplates(): Promise<{ key: string; name: string; category?: string }[]> {
  const sb = getPublicSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb.from("card_templates").select("key,name,category").eq("active", true);
    return (data ?? []) as { key: string; name: string; category?: string }[];
  } catch { return []; }
}

/** The card's own "Register free" button (with the referral code the owner typed) — the joining link when the owner
 *  has no account name yet. */
function ctaJoinLink(card: Card): string | null {
  for (const p of card.pages ?? []) for (const raw of p.blocks ?? []) {
    const b = raw as { kind?: string; joinUrl?: string; referralCode?: string };
    const u = String(b.joinUrl || "");
    if (b.kind === "cta" && u && !u.startsWith("#") && /signup|join/i.test(u)) {
      return b.referralCode ? `${u}${u.includes("?") ? "&" : "?"}ref=${encodeURIComponent(b.referralCode)}` : u;
    }
  }
  return null;
}

/** Everything the assistant needs to know about one partner's card. */
export async function agentContext(card: Card, platform: PlatformKnowledge) {
  const [owner, templates] = await Promise.all([fetchCardOwnerUsername(card.username), savedTemplates()]);
  return {
    seller: firstName(card.name),
    card,
    links: agentLinks({ site: SITE, cardUrl: `${SITE}/c/${card.username}`, ownerUsername: owner, joinFallback: ctaJoinLink(card), extraTemplates: templates }),
    override: platform.shubhora ?? {},
  };
}

/** A customer's own card, for the assistant's card check ("bana liya — shubhora.com/c/…"): the live card's public
 *  data, or null (not published, or a typo). */
export async function agentCardLookup(username: string): Promise<Card | null> {
  if (!/^[a-z0-9_-]{1,60}$/.test(username)) return null;
  return fetchCloudCard(username);
}

/** The model call the assistant makes (same model as every other chat here). */
export function agentComplete(apiKey?: string) {
  return async ({ system, messages, maxTokens, temperature }: AgentRequest) => {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    return geminiComplete({
      apiKey, system, maxOutputTokens: maxTokens, temperature,
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" as const : "user" as const, parts: [{ text: m.content }] })),
    });
  };
}

/** A card-chat visitor's memory, rebuilt from the conversation itself: the language they asked for. */
export function webState(history: AgentMsg[]) {
  let st: { lang?: string; langExplicit?: boolean } = {};
  for (const m of history) {
    if (m.role !== "user") continue;
    const L = replyLanguage(m.content, st);
    if (L.explicit) st = { lang: L.code, langExplicit: true };
    else if (!st.langExplicit) st = { lang: L.code };
  }
  return st;
}
