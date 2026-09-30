// Server-side anon client for PUBLIC data (published cards). No cookies/session.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Card } from "@/lib/types";

export function getPublicSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Cloud-published card by username; null if none. Deduped per request. */
export const fetchCloudCard = cache(async (username: string): Promise<Card | null> => {
  const sb = getPublicSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("cards")
      .select("id, data, views, active")
      .eq("username", username)
      .maybeSingle();
    if (!data || data.active === false) return null;
    const card = data.data as Card | null;
    if (!card || !card.username) return null;
    // The row id is the card's real identity (the editor loads by it); the id
    // inside the JSON can be a stale pre-publish draft id.
    return { ...card, id: data.id, views: data.views ?? 0 };
  } catch {
    return null;
  }
});

/** Fire the public view counter; never throws. */
export async function countCardView(username: string) {
  const sb = getPublicSupabase();
  if (!sb) return;
  try { await sb.rpc("increment_card_views", { p_username: username }); } catch { /* ignore */ }
}

/**
 * Has this card's owner let their plan lapse?
 *
 * The card page is anonymous and can't read profiles, so the answer comes from
 * a definer function that returns nothing but this flag.
 */
export const fetchCardExpired = cache(async (username: string): Promise<boolean> => {
  const sb = getPublicSupabase();
  if (!sb) return false;
  try {
    const { data } = await sb.rpc("card_owner_state", { p_username: username });
    const row = Array.isArray(data) ? data[0] : data;
    return Boolean(row?.expired);
  } catch {
    // Never hide a card because a lookup failed — show it in full.
    return false;
  }
});

/**
 * Is this card paused? Its V-Card year (free first year, then ₹1,499 a year) ended more than 7 days ago, nothing
 * renewed it and no paid plan covers it — the link then shows "Card renew karein" instead of the card.
 * Fails open like the lookup above: an error (or a database before migration 0057) shows the card.
 */
export const fetchCardPaused = cache(async (username: string): Promise<boolean> => {
  const sb = getPublicSupabase();
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc("card_paused", { p_username: username });
    return !error && data === true;
  } catch {
    return false;
  }
});

/** Ad tracking ids for a card (own + white-label partner's). Empty when unset. */
export const fetchCardTracking = cache(async (username: string) => {
  const sb = getPublicSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.rpc("card_tracking", { p_username: username });
    const r = Array.isArray(data) ? data[0] : data;
    if (!r) return null;
    return {
      fbPixelId: r.fb_pixel_id, ga4Id: r.ga4_id,
      googleAdsId: r.google_ads_id, adsLabel: r.ads_label,
      brandFbPixelId: r.brand_fb_pixel_id, brandGa4Id: r.brand_ga4_id,
      brandGoogleAdsId: r.brand_google_ads_id, brandAdsLabel: r.brand_ads_label,
    };
  } catch {
    return null;
  }
});

/** The owner's own domain for a card (verified), bare domain preferred over www; null when none. */
export const fetchCardDomain = cache(async (username: string): Promise<string | null> => {
  const sb = getPublicSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.from("card_domains").select("domain").eq("username", username).eq("verified", true);
    const list = ((data ?? []) as { domain: string }[]).map((r) => r.domain).sort((a, b) => Number(a.startsWith("www.")) - Number(b.startsWith("www.")) || a.length - b.length);
    return list[0] ?? null;
  } catch { return null; }
});

/** The card owner's account username — the "Get your own Shubhora" button carries it as the introducer. Null when
 *  the owner has not chosen one yet (accounts from before usernames) or the lookup fails; never throws. */
export const fetchCardOwnerUsername = cache(async (username: string): Promise<string | null> => {
  const sb = getPublicSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.rpc("card_owner_username", { p_card: username });
    const row = Array.isArray(data) ? (data[0] as { username?: string } | undefined) : (data as { username?: string } | null);
    return row?.username ?? null;
  } catch { return null; }
});
