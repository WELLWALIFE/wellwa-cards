// Pricing/lengths for the Ad Builder — kept in its own zero-dependency file
// (no "sharp") because src/app/poster/video/page.tsx is a CLIENT component
// and importing anything from banner.ts (which pulls in sharp) breaks the
// browser bundle.

// Ad Builder price by duration (owner's rule 2026-09-14, 1 credit ≈ ₹10, 2 credits/sec):
// 10s → 20, 20s → 40, 30s → 60, 45s → 90, 60s → 120 credits.
export const AD_LENGTHS = [10, 20, 30, 45, 60] as const;
// Realistic tier stays capped at 30s — each 5-sec Kling clip costs ~₹45, so a
// 60-sec realistic ad (12 clips ≈ ₹540) would cost more than the 120 credits earn.
export const REALISTIC_MAX_LENGTH = 30;
export function adCredits(lengthSec: number): number {
  return Math.max(20, Math.ceil(lengthSec / 5) * 10);
}

/** Credit packs sold in-app (paise). Subscribers pay ₹10 a credit (less on big packs). */
export const CREDIT_PACKS = [{ credits: 50, paise: 50000 }, { credits: 100, paise: 95000 }, { credits: 300, paise: 270000 }] as const;
/** Pay-as-you-go (no subscription): same credit cost per action, but about ₹15 a credit, with a small starter pack. */
// Starter pack 30 credits (owner's call, 28 Sep 2026; was 20 for ₹299) — ₹449 keeps the same ~₹15 a credit.
export const PAYG_PACKS = [{ credits: 30, paise: 44900 }, { credits: 50, paise: 74900 }, { credits: 100, paise: 139900 }] as const;
export const packsFor = (subscribed: boolean) => (subscribed ? CREDIT_PACKS : PAYG_PACKS);

/* ---- Long explainer video (the owner's own text, slides + voice) ----
 * Real cost to us: the voice (a few paise a minute) plus CPU — there is no AI video and no stock footage here,
 * so it is priced as the cheapest thing in the Studio: 10 credits a minute, minimum 20. */
export const EXPLAINER_MAX_MIN = 10;
export const EXPLAINER_CREDITS_PER_MIN = 10;
/** Indian speech in these videos runs at about 150 words a minute; the text itself decides the length. */
export const explainerMinutes = (text: string): number => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return words ? Math.min(EXPLAINER_MAX_MIN, Math.max(0.5, words / 150)) : 0;
};
export const explainerCredits = (text: string): number => {
  const m = explainerMinutes(text);
  return m ? Math.max(20, Math.ceil(m) * EXPLAINER_CREDITS_PER_MIN) : 0;
};
