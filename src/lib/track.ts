"use client";

// Card engagement tracking + ad attribution.
//
// Best effort throughout: every call silently no-ops if Supabase (or a pixel)
// isn't there — analytics must never block or break a card.
//
// Two jobs:
//   1. Our own events (view / click) into card_events, with the campaign that
//      brought the visitor, so a lead can be traced back to the ad that paid
//      for it.
//   2. Conversion events to Facebook / Google, so the ad platforms learn who
//      actually converts. On this product the conversion is a WhatsApp tap,
//      not a form submit — most tools miss that.

import { getBrowserSupabase } from "@/lib/supabase/browser";

const SRC_KEY = "wellwa-src";
const UTM_KEY = "ne-attribution";

export type Attribution = {
  src: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
};

const clean = (v: string | null, n = 80) => (v ? v.slice(0, n) : undefined);

/**
 * The campaign that brought this visitor.
 *
 * Captured on the first page they land on and kept for the session: a visitor
 * usually taps WhatsApp several screens later, and without this the conversion
 * would be credited to nothing.
 */
export function attribution(): Attribution {
  if (typeof window === "undefined") return { src: "" };
  try {
    const q = new URLSearchParams(window.location.search);
    const fromUrl: Attribution = {
      src: clean(q.get("src"), 40) ?? "",
      utm_source: clean(q.get("utm_source")),
      utm_medium: clean(q.get("utm_medium")),
      utm_campaign: clean(q.get("utm_campaign")),
      utm_content: clean(q.get("utm_content")),
      utm_term: clean(q.get("utm_term")),
    };

    const hasNew = fromUrl.src || fromUrl.utm_source || fromUrl.utm_campaign;
    if (hasNew) {
      // First touch of this visit wins; referrer only helps when there are no tags.
      fromUrl.referrer = clean(document.referrer, 200);
      sessionStorage.setItem(UTM_KEY, JSON.stringify(fromUrl));
      if (fromUrl.src) sessionStorage.setItem(SRC_KEY, fromUrl.src);
      return fromUrl;
    }

    const saved = sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved) as Attribution;

    return {
      src: sessionStorage.getItem(SRC_KEY) ?? "",
      referrer: clean(document.referrer, 200),
    };
  } catch {
    return { src: "" };
  }
}

/** Kept for callers that only want the short share tag. */
export function currentSrc(): string {
  return attribution().src;
}

export function trackView(username: string) {
  send(username, "view", "");
  fireConversion("view");
}

export function trackClick(username: string, target: string) {
  send(username, "click", target);
  fireConversion(target);
}

function send(username: string, kind: string, target: string) {
  try {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const a = attribution();
    void sb.from("card_events").insert({
      username, kind, target,
      src: a.src ?? "",
      utm_source: a.utm_source ?? null,
      utm_medium: a.utm_medium ?? null,
      utm_campaign: a.utm_campaign ?? null,
      utm_content: a.utm_content ?? null,
      utm_term: a.utm_term ?? null,
      referrer: a.referrer ?? null,
    }).then(() => {});
  } catch {
    /* ignore */
  }
}

/* ---------------- ad-platform conversions ---------------- */

type Win = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  __neAdsLabel?: string;
  __neAdsId?: string;
};

/**
 * Which card action counts as which conversion.
 *
 * WhatsApp and phone are the money actions here — someone tapping through to
 * chat is a far stronger buying signal than a page view, so both report as a
 * Lead. Meta's standard event names are used so the ad manager understands
 * them without custom setup.
 */
const CONVERSIONS: Record<string, { fb: string; google: boolean }> = {
  whatsapp: { fb: "Lead", google: true },
  call:     { fb: "Contact", google: true },
  phone:    { fb: "Contact", google: true },
  email:    { fb: "Contact", google: false },
  form:     { fb: "Lead", google: true },
  vcard:    { fb: "CompleteRegistration", google: false },
  product:  { fb: "ViewContent", google: false },
  appointment: { fb: "Schedule", google: true },
  chat:     { fb: "Contact", google: false },
  view:     { fb: "PageView", google: false },
};

function fireConversion(target: string) {
  if (typeof window === "undefined") return;
  const w = window as Win;
  const map = CONVERSIONS[target];
  if (!map) return;
  const a = attribution();

  try {
    w.fbq?.("track", map.fb, {
      content_name: target,
      source: a.utm_source ?? a.src ?? "direct",
      campaign: a.utm_campaign ?? "",
    });
  } catch { /* pixel not loaded */ }

  try {
    if (map.google && w.__neAdsId && w.__neAdsLabel) {
      w.gtag?.("event", "conversion", { send_to: `${w.__neAdsId}/${w.__neAdsLabel}` });
    }
    // GA4 always gets the raw event, which is free and useful even without ads.
    w.gtag?.("event", target === "view" ? "page_view" : `card_${target}`, {
      campaign: a.utm_campaign ?? "",
      source: a.utm_source ?? a.src ?? "direct",
    });
  } catch { /* gtag not loaded */ }
}
