"use client";
// The card's link from the owner's NAME (/c/rajesh-kumar) or the BUSINESS name (/c/sharma-sweets) — the owner's
// choice (owner's call, 25 Sep 2026: "name ya business name ka option de do"). Chosen during setup, changeable on the
// "Your V-Card is ready" screen and in the editor (More → Link). Kept on the account as business.linkBy, so a card
// made again with AI follows it too. Not set (older accounts): the name leads, as before.
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { nameSlug, suggestUsername } from "@/lib/cloud";

export type LinkBy = "name" | "business";

/** The saved choice, or null when the owner never chose. */
export async function getLinkPref(): Promise<LinkBy | null> {
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
    const v = (data.user?.user_metadata?.business as { linkBy?: string } | undefined)?.linkBy;
    return v === "name" || v === "business" ? v : null;
  } catch {
    return null;
  }
}

/** Remember the choice on the account (merged into business, nothing else changes). Never throws. */
export async function setLinkPref(v: LinkBy): Promise<void> {
  try {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    const business = { ...((data.user?.user_metadata?.business as Record<string, unknown> | undefined) ?? {}), linkBy: v };
    await sb.auth.updateUser({ data: { business } });
  } catch { /* offline: the card itself already has the new link */ }
}

/** The free link for each choice (a number is added when the plain one is taken). null = no usable name. */
export async function linkOptions(person: string, business: string, cardId?: string): Promise<{ name: string | null; business: string | null }> {
  const [n, b] = await Promise.all([
    nameSlug(person) ? suggestUsername(person, cardId).catch(() => null) : Promise.resolve(null),
    nameSlug(business) ? suggestUsername(business, cardId).catch(() => null) : Promise.resolve(null),
  ]);
  return { name: n, business: b && b !== n ? b : null };
}
