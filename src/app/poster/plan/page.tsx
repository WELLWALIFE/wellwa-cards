"use client";
// My plan — what the customer is on, what is left this month, and how to subscribe or renew.
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoaderCircle, Check, ChevronLeft, Sparkles, AlertTriangle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { SAAS_PLANS, GST_PCT, rupees, FREE_PLAN_WORTH, FREE_PLAN_TRUST, FREE_PLAN_TERM, CARD_RENEWAL, PRO_CUSTOM, type SaasTier } from "@/lib/billing";
import { TalkToUs } from "@/components/talk-to-us";
import { packsFor } from "@/lib/media/ad-pricing";
import { SubscribeButton } from "@/components/subscribe-button";
import { CardRenewButton } from "@/components/card-renew-button";

type Res = {
  tier: SaasTier | null; state: "none" | "active" | "grace" | "expired"; expires_at: string | null; days_left: number;
  credits: { monthly: number; packs: number; total: number }; trial: { days_left: number; expired: boolean } | null;
  payments: { amount: number; created_at: string; provider_ref: string; plan?: string }[];
  /** The V-Card's year (null before migration 0057). */
  card: { state: "included" | "active" | "grace" | "paused"; until: string | null; days_left: number | null; pause_on: string | null; renewed: boolean } | null;
};
const INCLUDED: Record<SaasTier, string[]> = {
  // Starter stands on its own list (no posters, social or AI pictures); Growth and Pro add theirs to COMMON.
  starter: ["AI salesman on your website: it answers questions, suggests items, and takes orders and bookings", "WhatsApp order and UPI pay buttons for customers", "Bookings calendar with reminders", "Follow-up messages go out by themselves for every enquiry", "Festival wishes and offers to your customers", "A message asking for a Google review after every sale", "A report every Monday", "Change your website just by saying what you want; no Shubhora tag"],
  // No repeats of the common lines below (the list said "website" and "daily poster" twice).
  growth: ["1 business profile", "WhatsApp AI replies — up to 1,000 a month (fair use)", "8 free ad storyboards a month (scene pictures you check before the video is made)"],
  pro: ["3 business profiles or brands", "10,000 AI replies a month", "5 team members who can use your customer list", "Your videos and pictures are made first, and you get help first"],
};
const COMMON = [
  "Digital card + full website on your own web address",
  "Daily poster + Status video, posted to WhatsApp Status for you",
  "Daily Story, 4 posts and 3 reels a week on Facebook and Instagram",
  "WhatsApp AI assistant + a list of all your customers",
  "Google Business posts and review replies",
  "AI Ad Studio and Reel Maker",
];
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** The digital V-Card's year: free for 1 year, then ₹1,499 a year, covered by a running Growth / Pro plan. The renew
 *  button shows only in the last 30 days, the 7-day grace and while paused — never pushed on a fresh account. */
function CardYearBox({ card, planLabel, highlight, onRenewed }: { card: NonNullable<Res["card"]>; planLabel: string | null; highlight: boolean; onRenewed: () => void }) {
  const price = `${rupees(CARD_RENEWAL.amount)} / year`;
  const renewBtn = <CardRenewButton onDone={() => setTimeout(onRenewed, 1200)} className="grad-brand mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white">Renew V-Card — {price}</CardRenewButton>;
  if (card.state === "included") {
    return (
      <div id="vcard" className="rounded-2xl border border-good/40 bg-good/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Digital V-Card</p>
        <p className="mt-0.5 flex items-center gap-1.5 font-bold"><Check className="h-4 w-4 text-good" /> Included in {planLabel ?? "your plan"}</p>
        <p className="mt-0.5 text-xs text-muted">No extra V-Card charge while your plan is running.</p>
      </div>
    );
  }
  if (card.state === "paused") {
    return (
      <div id="vcard" className={`rounded-2xl border-2 border-danger/50 bg-danger/5 p-4 ${highlight ? "ring-2 ring-danger/40" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-danger">Digital V-Card · paused</p>
        <p className="mt-1 text-sm text-ink">Your V-Card year ended on {d(card.until)}. People who open your link now see “Card renew karein”. Renew and it comes back right away. Your details, photos and customers are safe.</p>
        {renewBtn}
        <p className="mt-1.5 text-[11px] text-faint">{price}, GST included · or choose Growth below, which includes the V-Card.</p>
      </div>
    );
  }
  if (card.state === "grace") {
    return (
      <div id="vcard" className={`rounded-2xl border-2 border-amber/50 bg-amber/10 p-4 ${highlight ? "ring-2 ring-amber/40" : ""}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber">Digital V-Card · renew now</p>
        <p className="mt-1 text-sm text-ink">Your V-Card year ended on {d(card.until)}. It keeps working till {d(card.pause_on)}. After that your link shows “Card renew karein” until you renew.</p>
        {renewBtn}
        <p className="mt-1.5 text-[11px] text-faint">{price}, GST included · or choose Growth below, which includes the V-Card.</p>
      </div>
    );
  }
  const due = card.days_left !== null && card.days_left <= 30;
  return (
    <div id="vcard" className={`rounded-2xl border p-4 ${due ? "border-amber/50 bg-amber/5" : "border-border"} ${highlight ? "ring-2 ring-brand/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Digital V-Card</p>
          <p className="mt-0.5 font-bold">{card.until ? `${card.renewed ? "Active" : "Free"} till ${d(card.until)}` : "Active"}</p>
        </div>
        {card.days_left !== null && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${due ? "bg-amber/10 text-amber" : "bg-good/10 text-good"}`}>{card.days_left} day{card.days_left === 1 ? "" : "s"} left</span>}
      </div>
      {due || highlight ? renewBtn : null}
      <p className="mt-1.5 text-[11px] text-faint">After that it is {price}, GST included. Growth includes it.</p>
    </div>
  );
}

function MyPlan() {
  const router = useRouter();
  const { lang } = useT();
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";
  // From the paused card's "Card renew karein" button or a reminder: open on the V-Card box.
  const renew = params.get("renew") === "card";
  const [r, setR] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const [packs, setPacks] = useState<{ credits: number; paise: number }[] | null>(null);

  const load = useCallback(async () => {
    const res = await api<Res & { error?: string }>("/api/poster/plan");
    if (!res.ok) { setErr(res.data.error || "We could not open your plan. Please try again."); return; }
    setR(res.data);
    api<{ packs?: { credits: number; paise: number }[] }>("/api/poster/pay/credits").then((x) => { if (x.ok && x.data.packs?.length) setPacks(x.data.packs); }).catch(() => {});
  }, []);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(renew ? "/poster/plan?renew=card" : "/poster/plan")}`); return; } load(); })(); }, [router, load, renew]);
  useEffect(() => { if (renew && r?.card) document.getElementById("vcard")?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [renew, r?.card]);

  // This page is opened from many places (the paywalls, Me, Home, Connections, Social, Business, reminders): Back = the screen the owner was just on;
  // opened fresh (a reminder, a renew link), Me. The loading and error screens carry the way out too: a page that is slow or failed to load must not be a dead end.
  // In the sign-up "Choose your plan" run (welcome=1) there is no Back (it would land on the finished sign-up form): the way on is Skip.
  const backBtn = <button type="button" onClick={() => goBack(router, "/poster/more")} className="text-muted" aria-label={lang === "en" ? "Back" : "पीछे"}><ChevronLeft className="h-5 w-5" /></button>;
  const skipBtn = <Link href="/poster/onboard?skip=1" className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">Skip for now →</Link>;
  const exitRow = <div className="flex items-center gap-2">{welcome ? <div className="ml-auto">{skipBtn}</div> : backBtn}</div>;
  if (err) return <div className="space-y-4">{exitRow}<div className="py-16 text-center text-sm text-danger">{err}</div></div>;
  if (!r) return <div className="space-y-4">{exitRow}<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div></div>;
  const on = r.tier ? SAAS_PLANS[r.tier] : null;
  const banner = r.state === "grace"
    ? { cls: "border-amber/50 bg-amber/10 text-amber", text: `Your plan ended on ${d(r.expires_at)}. Everything still works for a few more days. Renew so that nothing stops.` }
    : r.state === "expired"
    ? { cls: "border-danger/50 bg-danger/5 text-danger", text: "Your plan has ended. Auto-posting, the WhatsApp assistant and new AI videos are paused. Your card, website and data are safe." }
    : r.trial && !r.trial.expired
    ? { cls: "border-brand/50 bg-brand-soft/40 text-brand-ink", text: `Free trial: ${r.trial.days_left} day${r.trial.days_left === 1 ? "" : "s"} left. You can subscribe any time. The trial costs nothing.` }
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {/* Not in the sign-up "Choose your plan" run: Back there would land on the finished sign-up form; Skip / Start free go on. */}
        {!welcome && backBtn}
        <h1 className="flex-1 text-lg font-bold">{welcome ? "Choose your plan" : "My plan"}</h1>
        {/* Skip (owner's call, 23 Sep 2026): straight into the app on the free plan; details can be filled any time from Setup. */}
        {welcome && skipBtn}
      </div>
      {welcome && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Your account is ready. Start free. You can take a paid plan later.</p>
          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-baseline justify-between gap-2"><p className="font-bold">1. Free</p><p className="text-sm"><span className="mr-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700">Worth {rupees(FREE_PLAN_WORTH)}</span><b className="text-lg text-good">FREE</b></p></div>
            <p className="mt-1 text-xs text-muted">Website + digital card on your link · daily poster · your customers saved in a list · free for 1 year. Showing on Google, AI banner and changes, auto-posting, WhatsApp AI and your own web address come with Growth.</p>
            <p className="mt-1 text-[11px] font-semibold text-good">{FREE_PLAN_TRUST}</p>
            <p className="mt-0.5 text-[10px] text-faint">{FREE_PLAN_TERM}</p>
            <Link href="/poster/onboard" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border-2 border-brand px-3 py-2.5 text-sm font-semibold text-brand-ink">Start free</Link>
          </div>
        </div>
      )}
      {banner && <p className={`rounded-xl border p-3 text-sm ${banner.cls}`}>{r.state === "expired" || r.state === "grace" ? <AlertTriangle className="mr-1.5 inline h-4 w-4" /> : null}{banner.text}</p>}

      {on && r.state !== "expired" && (
        <div className="rounded-2xl border border-brand/40 bg-brand-soft/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current plan</p>
              <p className="text-lg font-bold">{on.label}</p>
              <p className="text-sm text-muted">{rupees(on.amount)} a month · active till {d(r.expires_at)}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.state === "active" ? "bg-good/10 text-good" : "bg-amber/10 text-amber"}`}>{r.state === "active" ? `${r.days_left} days left` : "Renew now"}</span>
          </div>
        </div>
      )}

      {!welcome && r.card && <CardYearBox card={r.card} planLabel={on && r.state !== "expired" ? on.label : null} highlight={renew} onRenewed={load} />}

      {!welcome && <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border p-3"><p className="text-2xl font-bold tabular-nums">{r.credits.monthly}</p><p className="text-xs text-muted">Bonus credits this month</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-2xl font-bold tabular-nums">{r.credits.packs}</p><p className="text-xs text-muted">Credits you bought (never expire)</p></div>
      </div>}
      {!welcome && <p className="text-xs text-muted">{on && r.expires_at ? <>Bonus credits end on {d(r.expires_at)}. Unused ones do not carry over. Bonus credits are always used first. </> : <>No plan yet — bought credits never expire. </>}<Link href="/poster/video" className="underline">Use them in Video ad →</Link></p>}

      <h2 className="pt-2 text-sm font-bold">{welcome ? "Paid plans" : on ? "Change plan" : "Plans"}</h2>
      <div className="space-y-3">
        {/* Pro is custom-priced now (owner's call, 25 Sep 2026): only someone already on Pro still renews it here. */}
        {(r.tier === "pro" ? (["starter", "growth", "pro"] as const) : (["starter", "growth"] as const)).map((tier, i) => {
          const p = SAAS_PLANS[tier]; const current = r.tier === tier && r.state === "active";
          return (
            <div key={tier} className={`rounded-2xl border p-4 ${current ? "border-good/50 bg-good/5" : tier === "growth" ? "border-brand/60" : "border-border"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">{welcome ? `${i + 2}. ` : ""}{p.label}{tier === "starter" && !current ? <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">AI salesman</span> : null}{tier === "growth" && !current ? <span className="ml-2 rounded-full bg-good/10 px-2 py-0.5 text-[11px] font-semibold text-good">Most chosen</span> : null}</p>
                <p className="text-sm"><b className="text-lg">{rupees(p.amount)}</b> <span className="text-muted">/ month, GST included</span></p>
              </div>
              <p className="text-xs text-muted">{p.tagline} · {rupees(p.base)} + {GST_PCT}% GST</p>
              <ul className="mt-2 space-y-1">
                {(tier === "starter" ? INCLUDED.starter : [...COMMON, ...INCLUDED[tier]]).map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />{f}</li>)}
              </ul>
              {current
                ? <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check className="h-4 w-4" /> Your current plan</p>
                : <SubscribeButton tier={tier} className="grad-brand mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white">{r.tier === tier ? `Renew ${p.label}` : `Subscribe to ${p.label}`}</SubscribeButton>}
            </div>
          );
        })}
        {r.tier !== "pro" && (
          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold">{welcome ? "4. " : ""}{PRO_CUSTOM.label}</p>
              <p className="text-sm"><b className="text-lg">{PRO_CUSTOM.price}</b> <span className="text-muted">price</span></p>
            </div>
            <p className="text-xs text-muted">{PRO_CUSTOM.tagline}</p>
            <ul className="mt-2 space-y-1">
              {PRO_CUSTOM.items.map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />{f}</li>)}
            </ul>
            <div className="mt-3"><TalkToUs /></div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="text-sm font-semibold">Need more credits?</p>
        {/* The price list MUST be the one this owner will be charged, so it comes from the same
            GET /api/poster/pay/credits the Buy box uses (the server decides who counts as a
            subscriber — a trial of the suite does too). Until it answers, the local guess. */}
        <p className="mt-1 text-xs text-muted">Packs never expire. They are used after your bonus credits run out: {(packs ?? packsFor(!!on && r.state !== "expired")).map((c) => `${c.credits} for ${rupees(c.paise)}`).join(" · ")}.</p>
        {/* ?credits=1 opens the packs straight away — the old link landed on step 5 where they only appear if the balance is already too low. */}
        <Link href="/poster/video?credits=1" className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-brand px-3 py-2.5 text-sm font-semibold text-brand-ink"><Sparkles className="h-4 w-4" /> Buy credits</Link>
      </div>

      {r.payments.length > 0 && (
        <div className="rounded-xl border border-border p-3">
          <p className="mb-1.5 text-sm font-semibold">Payments</p>
          {r.payments.map((p) => (
            <div key={p.provider_ref} className="flex items-center justify-between gap-2 border-t border-border py-1.5 text-xs first:border-0">
              <span>{d(p.created_at)}</span><span className="text-muted">{p.plan === "card" ? "V-Card · 1 year" : "Plan"}</span><span className="tabular-nums">{rupees(p.amount)}</span><span className="mono text-faint">{p.provider_ref.slice(-8)}</span>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-faint">Billed by Wellwa Life India Pvt Ltd. Ask us for a GST invoice if you need one.</p>
        </div>
      )}
    </div>
  );
}

// useSearchParams needs a Suspense boundary at build time.
export default function MyPlanPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><MyPlan /></Suspense>;
}
