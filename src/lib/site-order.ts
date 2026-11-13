// The website order (owner, 13 Nov 2026): the website is PAID for first and made afterwards, once, in the plan that was paid.
//   "Make my website" → the plans (Website Standard / Premium, one payment for the year) → payment → "Thank you — our team is working on
//   your website, delivered within 24–48 hours" → the build runs by itself on the server → live by itself 24 hours later (lib/site-ready.ts).
// Nothing is built before the payment (a build is one to three minutes of AI: it used to run before the plan sheet, and again every time
// the owner came back without paying). No free card is offered to a new account.
// Isomorphic: no 'use client', no 'server-only'.

export type SitePkg = "site_standard" | "site_premium";

/** What is charged, GST included, for one year (the packages sold since 4 Nov 2026). */
export const SITE_PKG: Record<SitePkg, { amount: number; label: string; title: string }> = {
  site_standard: { amount: 299900, label: "Website Standard", title: "Website Standard — 1 year" },
  site_premium: { amount: 599900, label: "Website Premium", title: "Website Premium — 1 year" },
};
export const isSitePkg = (v: unknown): v is SitePkg => v === "site_standard" || v === "site_premium";

/** A package payment is a "custom" payment request (lib/payments.ts) that carries this mark in its note. */
export const pkgNote = (p: SitePkg) => `[pkg:${p}]`;
export const pkgOfNote = (note: string | null | undefined): SitePkg | null => {
  const m = /^\[pkg:(site_standard|site_premium)\]/.exec((note ?? "").trim());
  return m ? (m[1] as SitePkg) : null;
};

/** Where the order stands, for the screens:
 *   none     no package and nothing chosen           → the plans
 *   pay      a plan was chosen but not paid          → the plans (never "Make my website" again)
 *   queued   paid, the build has not started         → the thank-you page (it starts the build)
 *   building paid, the build is running              → the thank-you page
 *   waiting  made; goes live by itself at `readyAt`  → the thank-you page / the app
 *   live     the website shows to visitors */
export type OrderStage = "none" | "pay" | "queued" | "building" | "waiting" | "live";
export type OrderState = {
  stage: OrderStage;
  pkg: SitePkg | "custom" | "";
  /** The plan chosen but not yet paid. */
  wanted: SitePkg | null;
  until: string | null;
  readyAt: string | null;
  hasCard: boolean;
  /** The last payment for the package, for the receipt. */
  receipt: { amount: number; paymentId: string; paidAt: string; label: string } | null;
};

/** Set by "Make my website" on this phone: coming back opens the plans, not the Make screen. */
export const SITE_INTENT_KEY = "shubhora.site-intent";
