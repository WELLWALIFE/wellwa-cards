import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { GST_PCT, rupees, FREE_PLAN_WORTH, FREE_PLAN_TRUST, FREE_PLAN_TERM, PRO_CUSTOM, NO_LOCK_IN } from "@/lib/billing";
import { TalkToUs } from "@/components/talk-to-us";
import { CREDIT_PACKS, PAYG_PACKS } from "@/lib/media/ad-pricing";
import { WELCOME_CREDITS } from "@/lib/site-pricing";
import { BRAND, SUITE, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/pricing", {
  title: `Pricing — ${BRAND}`,
  description: "Website Standard ₹2,999 a year, Website Premium ₹5,999 a year, Growth Plan ₹2,999 a month. Start with a free digital V-Card.",
});

// The plan lists are the owner's own words (16 Oct 2026): nothing added.
const FREE_CARD = [
  "Digital business card on one link",
  "Made by AI in 5 minutes from your details",
  "Share on WhatsApp or with a QR code",
  "People can contact you directly from your card",
];
const STANDARD_ITEMS = [
  "Dynamic website, up to 5 pages",
  "SEO + AI-search ready",
  "Product catalogue + WhatsApp order",
  "AI Ad Studio and Reel Maker (credits)",
  "Growth Plan: 1st month free",
];
const GROWTH_ITEMS = [
  "Daily posters",
  "Facebook & Instagram auto-post",
  "WhatsApp AI chatbot 24×7",
  "CRM & lead follow-ups",
  "Google profile & review replies",
  "WhatsApp broadcasts",
  "AI search: ChatGPT & Gemini",
  "Monthly report",
];
const CUSTOM_ITEMS = [
  "Custom software, apps and websites built for your business",
  "Daily work done by itself: WhatsApp, customers, follow-ups, billing and reports",
  "Your own CRM and business software, with screens for your numbers and logins for your team",
  "AI assistants and chat bots taught about your business",
  "Works with the tools you already use: online payments, Tally, Google Sheets",
  "More brands and branches on one account",
  "A manager from Shubhora just for you",
];
const PREMIUM_LIST = [
  "Dynamic & Progressive website",
  "Installs on phone like an app",
  "SEO + AI-search ready",
  "Product catalogue + WhatsApp order",
  "AI Ad Studio and Reel Maker (credits)",
  "Growth Plan: 1st month free",
];

export default function PricingPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 text-center">
        <span className="mono text-xs uppercase tracking-wide text-faint">Pricing</span>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">Simple plans. Big value.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">{SUITE} replaces the designer, the social media person and the person who answers WhatsApp. Start free with your digital card, pick a Website plan, then grow every month with the Growth Plan. All prices include GST.</p>
        <p className="mx-auto mt-3 max-w-2xl rounded-full border border-good/30 bg-good/10 px-4 py-1.5 text-sm text-ink">{NO_LOCK_IN.en}</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">Free</h2>
            <span className="mt-4 self-start rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700">Worth {rupees(FREE_PLAN_WORTH)}</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-good">FREE</span>
              <span className="text-sm text-muted">for 1 year</span>
            </div>
            <p className="mt-1 text-xs text-faint">{FREE_PLAN_TRUST}</p>
            <p className="mt-0.5 text-[11px] text-faint">{FREE_PLAN_TERM}</p>
            {WELCOME_CREDITS > 0 && <p className="mt-4 rounded-lg bg-surface2 px-3 py-2 text-sm font-semibold">{WELCOME_CREDITS} free AI credits to start</p>}
            <ul className="mt-5 flex-1 space-y-2.5">
              {FREE_CARD.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <Link href="/signup" className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface2">Start free</Link>
          </div>
          {/* Website Standard (owner, 4 Nov 2026): Rs 2,999 a year, renews at the same price. Bought on WhatsApp until yearly billing is built. */}
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">Website Standard</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">₹2,999</span>
              <span className="text-sm text-muted">/ year</span>
            </div>
            <p className="mt-1 text-xs text-faint">Includes {GST_PCT}% GST · renews at the same price</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {STANDARD_ITEMS.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <div className="mt-6"><TalkToUs label="Get Website Standard" text="Hi Shubhora, I want the Website Standard plan (₹2,999 a year)." /></div>
          </div>
          {/* Website Premium (owner, 4 Nov 2026): Rs 5,999 a year, dynamic and progressive (installs like an app). */}
          <div className="flex flex-col rounded-2xl border border-brand bg-surface p-6 ring-1 ring-brand">
            <span className="mono mb-3 self-start rounded bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-white">Most popular</span>
            <h2 className="text-lg font-semibold">Website Premium</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">₹5,999</span>
              <span className="text-sm text-muted">/ year</span>
            </div>
            <p className="mt-1 text-xs text-faint">Includes {GST_PCT}% GST · renews at the same price</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {PREMIUM_LIST.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <div className="mt-6"><TalkToUs label="Get Website Premium" text="Hi Shubhora, I want the Website Premium plan (₹5,999 a year)." /></div>
          </div>
          {/* Custom Solutions (owner, 16 Oct 2026): every kind of software and automation, price on request, with a proper brief. */}
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">{PRO_CUSTOM.label}</h2>
            <div className="mt-4">
              <span className="text-3xl font-semibold tracking-tight">{PRO_CUSTOM.price}</span>
            </div>
            <p className="mt-3 text-sm text-muted">Need something built around how your business works? We design, build and run it for you. Every kind of software and automation.</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {CUSTOM_ITEMS.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <div className="mt-6"><TalkToUs /></div>
          </div>
        </div>
        {/* Growth Plan (owner, 4 Nov 2026): Rs 2,999 a month, needs a website plan; 1st month free with every website purchase and renewal. */}
        <div className="mt-5 grid gap-6 rounded-2xl bg-[#171447] p-6 text-white md:grid-cols-[1fr_1.4fr] md:p-8">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#a9c8ff]">Growth Plan</h2>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">₹2,999</span>
              <span className="text-sm text-white/70">/ month</span>
            </div>
            <p className="mt-2 text-sm text-[#fde68a]">Needs a website plan. 1st month free with every website purchase &amp; renewal. Includes {GST_PCT}% GST.</p>
            <div className="mt-5"><TalkToUs label="Get the Growth Plan" text="Hi Shubhora, I want the Growth Plan (₹2,999 a month)." /></div>
          </div>
          <ul className="grid content-start gap-2.5 sm:grid-cols-2">
            {GROWTH_ITEMS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#a9c8ff]" /> {f}</li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-brand-ink">Ad Studio &amp; Reel Maker run on credits: 1 credit = ₹10.</p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-semibold">AI credits</h2>
          <p className="mt-1 text-sm text-muted">Posters, reels from stock footage, social posting and the WhatsApp assistant are included in the plan. Credits are only for AI video and AI photography, where every minute costs us real money.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[["AI product photo", "5 credits"], ["Reel with AI scenes", "1 credit per scene"], ["AI ad video (15 s)", "30 credits"]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border p-3"><p className="text-sm font-medium">{k}</p><p className="text-sm text-brand-ink">{v}</p></div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Subscriber credit packs never expire: {CREDIT_PACKS.map((c) => `${c.credits} for ${rupees(c.paise)}`).join(" · ")}.</p>
          <p className="mt-2 text-sm text-muted">No subscription? Use the AI tools pay-as-you-go: {PAYG_PACKS.map((c) => `${c.credits} credits for ${rupees(c.paise)}`).join(" · ")}. {WELCOME_CREDITS > 0 ? ` New accounts get ${WELCOME_CREDITS} free credits to try them.` : ""}</p>
        </div>
        <div className="mt-10 rounded-2xl border border-border bg-surface p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <div><p className="font-semibold">Want to sell Shubhora in your city?</p><p className="text-sm text-muted">Become a franchise: your territory, commission on every payment your customers make, your own panel.</p></div>
          <Link href="/franchise" className="inline-flex items-center gap-2 rounded-xl border border-brand/40 bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-soft/70">Become a franchise →</Link>
        </div>
        <p className="mt-8 text-center text-xs text-faint">Prices in Indian rupees, including {GST_PCT}% GST. The free digital card is free for its first year, then ₹1,499 a year (included in every Website plan). Custom Solutions are quoted per requirement. Website plans renew every year at the same price. The Growth Plan can be cancelled any time; it runs to the end of the paid month. See our <Link href="/refund" className="underline">refund policy</Link> and <Link href="/terms" className="underline">terms</Link>.</p>
      </section>
    </div>
  );
}
