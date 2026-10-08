import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SAAS_PLANS, GST_PCT, rupees, SAAS_EXTRA, FREE_PLAN, FREE_PLAN_WORTH, FREE_PLAN_TRUST, FREE_PLAN_TERM, PRO_CUSTOM } from "@/lib/billing";
import { TalkToUs } from "@/components/talk-to-us";
import { CREDIT_PACKS, PAYG_PACKS } from "@/lib/media/ad-pricing";
import { WELCOME_CREDITS } from "@/lib/site-pricing";
import { SubscribeButton } from "@/components/subscribe-button";
import { BRAND, SUITE, pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/pricing", {
  title: `Pricing — ${BRAND}`,
  description: "One subscription for your website, daily posters, social posting, WhatsApp CRM and AI videos. Start with a digital V-Card free for 1 year.",
});

const INCLUDED = [
  "Website + digital card on one link, built by AI in 5 minutes",
  "A new poster and a status video with voice every morning, posted to WhatsApp Status for you",
  "Daily Story, 4 posts and 3 reels a week on Facebook and Instagram",
  "WhatsApp AI assistant that answers customers and captures leads",
  "Lead CRM with pipeline, reminders and broadcasts",
  "Google Business posts and automatic review replies",
  "AI Ad Studio and Reel Maker",
  "Works in 12 Indian languages",
];
const EXTRA = SAAS_EXTRA;

export default function PricingPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 text-center">
        <span className="mono text-xs uppercase tracking-wide text-faint">Pricing</span>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">One subscription. Your whole online presence.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">{SUITE} replaces the designer, the social media person and the person who answers WhatsApp. Start free — your website and digital card are free for 1 year, no card details needed; upgrade any time.</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">Free</h2>
            <p className="text-sm text-muted">Your business online</p>
            <span className="mt-4 self-start rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700">Worth {rupees(FREE_PLAN_WORTH)}</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-good">FREE</span>
              <span className="text-sm text-muted">for 1 year</span>
            </div>
            <p className="mt-1 text-xs text-faint">{FREE_PLAN_TRUST}</p>
            <p className="mt-0.5 text-[11px] text-faint">{FREE_PLAN_TERM}</p>
            {WELCOME_CREDITS > 0 && <p className="mt-4 rounded-lg bg-surface2 px-3 py-2 text-sm font-semibold">{WELCOME_CREDITS} free AI credits to start</p>}
            <ul className="mt-5 flex-1 space-y-2.5">
              {FREE_PLAN.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <Link href="/signup" className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface2">Start free</Link>
          </div>
          {(["starter", "growth"] as const).map((tier) => {
            const p = SAAS_PLANS[tier]; const hot = tier === "growth";
            return (
              <div key={tier} className={`flex flex-col rounded-2xl border bg-surface p-6 ${hot ? "border-brand ring-1 ring-brand" : "border-border"}`}>
                {hot && <span className="mono mb-3 self-start rounded bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-white">Most popular</span>}
                <h2 className="text-lg font-semibold">{p.label}</h2>
                <p className="text-sm text-muted">{p.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{rupees(p.amount)}</span>
                  <span className="text-sm text-muted">/ month</span>
                </div>
                <p className="mt-1 text-xs text-faint">Includes {GST_PCT}% GST ({rupees(p.base)} + GST)</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {(tier === "starter" ? EXTRA.starter : [...INCLUDED, ...EXTRA[tier]]).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
                  ))}
                </ul>
                <SubscribeButton tier={tier} className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${hot ? "bg-brand text-white hover:opacity-90" : "border border-border hover:bg-surface2"}`}>
                  Subscribe to {p.label}
                </SubscribeButton>
                <Link href="/signup" className="mt-2 text-center text-xs text-muted hover:text-ink">or start free</Link>
              </div>
            );
          })}
          {/* Pro: custom price (owner's call, 25 Sep 2026) — talk to us, a dedicated manager sets it up. */}
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">{PRO_CUSTOM.label}</h2>
            <p className="text-sm text-muted">{PRO_CUSTOM.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight">{PRO_CUSTOM.price}</span>
              <span className="text-sm text-muted">quote for your need</span>
            </div>
            <p className="mt-1 text-xs text-faint">Anything beyond Growth — tell us what you need</p>
            <p className="mt-4 rounded-lg bg-brand-soft/50 px-3 py-2 text-sm font-semibold text-brand-ink">We make all kinds of software</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {PRO_CUSTOM.items.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {f}</li>
              ))}
            </ul>
            <div className="mt-6"><TalkToUs /></div>
          </div>
        </div>
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
        <p className="mt-8 text-center text-xs text-faint">Prices in Indian rupees, including {GST_PCT}% GST. The free website and card are free for their first year, then ₹1,499 a year (included in Growth). Custom Solutions are quoted per requirement. Cancel any time; the plan runs to the end of the paid month. See our <Link href="/refund" className="underline">refund policy</Link> and <Link href="/terms" className="underline">terms</Link>.</p>
      </section>
    </div>
  );
}
