// Plan pricing (amounts in paise). Razorpay is env-gated: without keys the
// app runs in demo mode (upgrade "succeeds" locally so the flow is demoable).

export type PaidPlan = "pro" | "team";
export type SaasTier = "starter" | "growth" | "pro";

// Owner's call (26 Sep 2026): Growth gets 10 AI credits a month (smallest video = 20, so any video needs a pack),
// and the monthly credits are NOT advertised anywhere — they are a quiet bonus in the balance, not a plan promise.
/** The all-in-one subscription (card + website + posters + social + WhatsApp CRM + AI studio).
 *  `base` is the price we advertise, `amount` is what Razorpay charges (base + 18% GST).
 *  `credits` are the AI credits included every month; they expire with the month, bought packs do not. */
export const GST_PCT = 18;
export const SAAS_PLANS: Record<SaasTier, { base: number; amount: number; credits: number; label: string; tagline: string }> = {
  // Starter (owner's call, 8 Oct 2026): the AI salesman and everything that turns a website into sales — no posters,
  // social posting, AI pictures or own domain (those are Growth). One-time monthly payment, no mandate.
  starter: { base: 84661, amount: 99900, credits: 0, label: "Starter", tagline: "An AI salesman on your website and WhatsApp" },   // ₹999 incl. GST
  growth: { base: 254153, amount: 299900, credits: 10, label: "Standard", tagline: "Standard website (up to 5 pages), social posting and WhatsApp AI" },   // ₹2,999 incl. GST (owner, 22 Sep 2026)
  pro: { base: 423644, amount: 499900, credits: 500, label: "Pro", tagline: "For teams, more brands and more AI video" },          // ₹4,999 incl. GST (owner, 22 Sep 2026)
};
/** What each plan adds on top of the shared feature list (shown on Pricing and in Settings). */
/** Premium (owner, 16 Oct 2026): the Standard plan (Rs 2,999 a month) plus the Premium website and Google SEO. First month Rs 5,999, then Rs 2,999 a month:
 *  one autopay mandate on the Standard plan, with the Rs 3,000 difference added to the first debit. A running Standard customer pays only that difference. */
export const PREMIUM_EXTRA_PAISE = 300000;
export const PREMIUM_FIRST_PAISE = SAAS_PLANS.growth.amount + PREMIUM_EXTRA_PAISE;   // 5,999
export const PREMIUM = { label: "Premium", tagline: "Premium multi-page website and Google SEO, on top of everything in Standard" };
export const PREMIUM_ITEMS = ["Everything in Standard", "Premium website: a page for every product and service, About, Gallery, Contact, a layout made for your business", "Google SEO: every page and product on Google with schema and a sitemap", "Try up to 3 layouts and keep the one you like", "Advanced features for your trade (Orders · Silai for tailors and boutiques first): customised for you, charged separately"];
export const SAAS_EXTRA: Record<SaasTier, string[]> = {
  starter: ["AI salesman on your website: it answers questions, suggests items, and takes orders and bookings", "WhatsApp order and UPI pay buttons for customers", "Bookings calendar with reminders for customers and for you", "Follow-up messages go out by themselves for every enquiry", "Festival wishes and offers to all your customers from your WhatsApp", "A message asking for a Google review after every sale", "A report every Monday of views, enquiries and orders", "Change your website just by saying what you want; no Shubhora tag"],
  growth: ["Standard website (up to 5 pages), with a sub-domain address", "Daily poster on Facebook, Instagram and WhatsApp Status", "Meta Ads (Facebook and Instagram)", "WhatsApp AI assistant that answers customers and filters leads", "AI Ad Studio and Reel Maker", "Google reviews and Google Business posts", "Works in 12 Indian languages", "WhatsApp AI replies, up to 1,000 a month (fair use)"],
  pro: ["A manager from Shubhora just for you", "More business profiles or brands", "10,000+ AI replies a month", "Your team members can use your customer list", "Your videos and pictures are made first, and you get help first", "A monthly report on how you show on Google and how your business is doing"],
};

/** The free card is shown as "Worth ₹1,499 — FREE" (owner's call, 25 Sep 2026): what the card is worth, given free.
 *  Free for the first year (owner's call, 27 Sep 2026), then ₹1,499 a year — a running Growth / Pro plan covers it.
 *  Deliberately NOT a struck-through price (it was never sold at ₹1,499) and NOT "limited offer" — both would be
 *  misleading under the consumer rules. The trust line says that nothing is hidden; FREE_PLAN_TERM is the small print
 *  wherever the free plan is priced (pricing, refund and plan pages). The AI salesman mentions the renewal only when asked. */
export const FREE_PLAN_WORTH = 149900;
export const FREE_PLAN_TRUST = "No card details needed · No hidden charge";
export const FREE_PLAN_TERM = "Free for 1 year, then ₹1,499 a year · Standard includes it";
/** The V-Card after its free year (owner's call, 27 Sep 2026): ₹1,499 incl. GST for one more year. When the year ends the
 *  card keeps working `graceDays` more days, then its link shows "Card renew karein" until it is renewed (nothing is
 *  deleted). Not partner business: no BV — /api/billing/verify never reports it to the partner panel. */
/** The one line that goes wherever a monthly price is shown (owner, 31 Oct 2026: it must never read as "pay every month or lose it").
 *  What really happens when a plan stops (HANDOFF "When a plan stops"): the card and the website keep working; the monthly services pause. */
export const NO_LOCK_IN = {
  en: "No lock-in. Pay month by month, stop whenever you like: your card and your website stay live on the same link. Only the monthly services — daily posters, the AI assistant, ads — pause until you start again.",
  hi: "कोई lock-in नहीं। महीने-महीने pay करें, जब चाहें रोक दें: आपका card और website उसी link पर live रहते हैं। सिर्फ़ महीने वाली सेवाएँ — रोज़ का poster, AI assistant, ads — रुकती हैं, जब तक आप दोबारा शुरू न करें।",
  short: "No lock-in · your card and website stay live even if you pause",
  shortHi: "कोई lock-in नहीं · रोकने पर भी card और website live रहते हैं",
};
export const CARD_RENEWAL = { amount: 149900, label: "V-Card renewal", years: 1, graceDays: 7 };
/** The third plan (owner's call, 25 Sep 2026): anything beyond Growth — any software, customization or automation —
 *  is built for the customer, priced on request, with a dedicated manager. "Contact us" instead of a price.
 *  SAAS_PLANS.pro stays as it is — existing Pro subscribers renew at their price and the owner activates custom deals. */
export const PRO_CUSTOM = {
  label: "Custom Solutions",
  price: "On request",
  tagline: "Need more than Standard or Premium? We build the software you need, set Shubhora up your way, and make daily work run by itself.",
  cta: "Contact us",
  waText: "Hi Shubhora, I need custom software / customization / automation for my business. Please call me.",
  items: [
    "A manager from Shubhora just for you",
    "Software, apps and websites built for you",
    "Shubhora set up the way your business works",
    "Daily work done by itself — WhatsApp, customers, follow-ups, billing, reports",
    "Your own customer and business software, screens that show your numbers, and logins for your team",
    "AI assistants and chat bots taught about your business",
    "Works with your other tools — online payments, Tally, Google Sheets and what you already use",
    "More brands and branches on one account",
  ],
};
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
/** How a plan price is shown everywhere: the amount charged, GST included (e.g. "₹2,999"). */
export const planPrice = (t: SaasTier) => rupees(SAAS_PLANS[t].amount);
/** What the free plan gives — free for the first year (FREE_PLAN_TERM says what comes after). */
export const FREE_PLAN = [
  "Website + digital card on one link — the website on computers, the card on phones",
  "Made by AI in 5 minutes from your details; three designs, with a look and pages that suit your kind of work",
  "A poster every morning with your name and number",
  "People who contact you from your card and website are saved in a customer list",
  "Share on WhatsApp or with a QR code; people can save your contact",
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
