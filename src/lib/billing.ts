// Plan pricing (amounts in paise). Razorpay is env-gated: without keys the
// app runs in demo mode (upgrade "succeeds" locally so the flow is demoable).

export type PaidPlan = "pro" | "team";
export type SaasTier = "growth" | "pro";

// Owner's call (26 Sep 2026): Growth gets 10 AI credits a month (smallest video = 20, so any video needs a pack),
// and the monthly credits are NOT advertised anywhere — they are a quiet bonus in the balance, not a plan promise.
/** The all-in-one subscription (card + website + posters + social + WhatsApp CRM + AI studio).
 *  `base` is the price we advertise, `amount` is what Razorpay charges (base + 18% GST).
 *  `credits` are the AI credits included every month; they expire with the month, bought packs do not. */
export const GST_PCT = 18;
export const SAAS_PLANS: Record<SaasTier, { base: number; amount: number; credits: number; label: string; tagline: string }> = {
  growth: { base: 254153, amount: 299900, credits: 10, label: "Growth", tagline: "Everything to run one business online" },   // ₹2,999 incl. GST (owner, 22 Sep 2026)
  pro: { base: 423644, amount: 499900, credits: 500, label: "Pro", tagline: "For teams, more brands and more AI video" },          // ₹4,999 incl. GST (owner, 22 Sep 2026)
};
/** What each plan adds on top of the shared feature list (shown on Pricing and in Settings). */
export const SAAS_EXTRA: Record<SaasTier, string[]> = {
  growth: ["No Shubhora tag; your website on Google", "AI-painted banner and pictures; edit by saying it", "Daily poster + status video with voice, auto-posted", "WhatsApp AI replies (fair use up to 1,000 a month)", "Your own domain", "1 business profile", "8 free ad storyboards a month"],
  pro: ["Dedicated account manager", "More business profiles or brands", "10,000+ AI replies a month", "CRM seats for your team", "Priority rendering and support", "Monthly SEO and performance report"],
};

/** The free card is shown as "Worth ₹1,499 — FREE" (owner's call, 25 Sep 2026): what the card is worth, given free.
 *  Free for the first year (owner's call, 27 Sep 2026), then ₹1,499 a year — a running Growth / Pro plan covers it.
 *  Deliberately NOT a struck-through price (it was never sold at ₹1,499) and NOT "limited offer" — both would be
 *  misleading under the consumer rules. The trust line says that nothing is hidden; FREE_PLAN_TERM is the small print
 *  wherever the free plan is priced (pricing, refund and plan pages). The AI salesman mentions the renewal only when asked. */
export const FREE_PLAN_WORTH = 149900;
export const FREE_PLAN_TRUST = "No card details · No hidden charge";
export const FREE_PLAN_TERM = "1 year free, then ₹1,499 a year · included in Growth";
/** The V-Card after its free year (owner's call, 27 Sep 2026): ₹1,499 incl. GST for one more year. When the year ends the
 *  card keeps working `graceDays` more days, then its link shows "Card renew karein" until it is renewed (nothing is
 *  deleted). Not partner business: no BV — /api/billing/verify never reports it to the partner panel. */
export const CARD_RENEWAL = { amount: 149900, label: "V-Card renewal", years: 1, graceDays: 7 };
/** The third plan (owner's call, 25 Sep 2026): anything beyond Growth — any software, customization or automation —
 *  is built for the customer, priced on request, with a dedicated manager. "Contact us" instead of a price.
 *  SAAS_PLANS.pro stays as it is — existing Pro subscribers renew at their price and the owner activates custom deals. */
export const PRO_CUSTOM = {
  label: "Custom Solutions",
  price: "On request",
  tagline: "Need more than Growth? We build any software, customization and automation for your business.",
  cta: "Contact us",
  waText: "Hi Shubhora, I need custom software / customization / automation for my business. Please call me.",
  items: [
    "Dedicated account manager",
    "Custom software, apps and websites — built for you",
    "Shubhora customized to the way your business works",
    "Automation of daily work — WhatsApp, leads, follow-ups, billing, reports",
    "Custom CRM / ERP, dashboards and team logins",
    "AI assistants and chatbots trained on your business",
    "Integrations — payment gateway, Tally, Google Sheets, your existing tools",
    "More brands and branches on one account",
  ],
};
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
/** How a plan price is shown everywhere: the amount charged, GST included (e.g. "₹2,999"). */
export const planPrice = (t: SaasTier) => rupees(SAAS_PLANS[t].amount);
/** What the free plan gives — free for the first year (FREE_PLAN_TERM says what comes after). */
export const FREE_PLAN = [
  "Website + digital card on one link — the website on computers, the card on phones",
  "Built by AI in 5 minutes from your details; three designs, your trade's own look and pages",
  "A poster every morning with your name and number",
  "Leads from your card and website, saved in the CRM",
  "Share on WhatsApp, QR code, save-contact",
];

export const PLAN_PRICE: Record<PaidPlan, { amount: number; label: string }> = {
  pro: { amount: 119900, label: "Pro" },          // ₹1,199 / month
  team: { amount: 118000, label: "White label" }, // ₹1,180 / card / month (resellers)
};

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function publicRazorpayKey(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}
