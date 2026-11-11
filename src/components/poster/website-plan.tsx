"use client";
// The website's plan, asked AFTER the free card is made (owner, 2 Nov 2026: "make my website dabane ke baad payment ka option aaye —
// aapka card ban gaya hai, website ke liye apna plan select kare; payment ke baad payment confirm kare aur 24–48 hr ka page dikha de").
// Order of the finish: the card is made and shown first (it stays free whatever is chosen) → this sheet → Razorpay → the receipt
// (PaidReceipt) → the website is made → the waiting screen with the three steps (SiteProgress). "Not now" keeps the free card.
import { useRef, useState } from "react";
import { Check, CheckCircle2, Clock, Eye, Globe, MessageCircle, ShieldCheck, X } from "lucide-react";
import { SubscribeButton, type PaidInfo } from "@/components/subscribe-button";
import { api } from "@/lib/poster-client";
import { SAAS_PLANS, PREMIUM_FIRST_PAISE, rupees } from "@/lib/billing";

type Pick = "standard" | "premium";

/** What each website plan gives — the full list, said plainly (owner, 2 Nov 2026: "dono me kya kya hai wo batao, fir select kare to
 *  payment"). Source of truth for the words: the pricing page (src/app/(marketing)/pricing) and lib/billing. */
function planList(hi: boolean) {
  const T = (en: string, h: string) => (hi ? h : en);
  const monthly = rupees(SAAS_PLANS.growth.amount);
  return [
    {
      key: "standard" as Pick, title: "Standard", price: monthly, per: T("a month · GST included", "हर महीने · GST शामिल"), tag: "",
      lead: T("Your website and your daily marketing, done for you.", "आपकी website और रोज़ की marketing — सब आपके लिए।"),
      items: [
        T("Your website (up to 5 pages) on your link — no Shubhora tag", "आपकी website (5 pages तक) आपके link पर — Shubhora tag नहीं"),
        T("Live within 24–48 hours; we WhatsApp you when it is live", "24–48 घंटे में live — live होते ही WhatsApp"),
        T("On Google search: your website is listed by itself once it is live", "Google search पर: live होते ही website अपने-आप Google पर"),
        T("A new poster every day on Facebook, Instagram and WhatsApp Status — by itself", "हर दिन नया poster — Facebook, Instagram, WhatsApp Status पर अपने-आप"),
        T("WhatsApp AI that answers your customers 24×7 (up to 1,000 replies a month)", "WhatsApp AI जो 24×7 ग्राहकों को जवाब दे (महीने में 1,000 तक)"),
        T("Meta Ads, AI Ad Studio and Reel Maker", "Meta Ads, AI Ad Studio और Reel Maker"),
        T("Google reviews and Google Business posts", "Google reviews और Google Business posts"),
        T("12 Indian languages", "12 भारतीय भाषाएँ"),
      ],
    },
    {
      key: "premium" as Pick, title: "Premium", price: rupees(PREMIUM_FIRST_PAISE), per: T(`first month, then ${monthly} a month`, `पहला महीना, फिर ${monthly} / महीना`), tag: T("Most popular", "सबसे ज़्यादा चुना गया"),
      lead: T("A bigger website made to bring customers from Google.", "बड़ी website — Google से ग्राहक लाने के लिए।"),
      items: [
        T("Everything in Standard", "Standard का सब कुछ"),
        T("Premium multi-page website: a page for every product and service", "Premium website: हर product और service का अपना page"),
        T("Google SEO: every page and product on Google", "Google SEO: हर page और product Google पर"),
        T("A layout made for your business — try 3, keep the one you like", "आपके business के लिए design — 3 देखें, जो पसंद हो रखें"),
      ],
    },
  ];
}

/** "Your V-Card is ready" → the website's plans (full lists, one to pick) → Razorpay. `overlay`: drawn over the build screen (the card's
 *  preview stays behind it; "View card" closes it); else a page of its own (/poster/site/plans). "Not now" keeps the free card. */
export function WebsitePlans({ hi, name, overlay = false, cardHref, onView, onClose, onPaid }: {
  hi: boolean; name?: string; overlay?: boolean; cardHref?: string; onView?: () => void; onClose: () => void; onPaid: (p: PaidInfo | null) => void;
}) {
  const T = (en: string, h: string) => (hi ? h : en);
  // A real payment calls onPaid and then onDone: only the first counts (a review, 2 Nov 2026 — the receipt lost its details).
  const gotPaid = useRef(false);
  const [note, setNote] = useState("");
  /** "already on a plan" from the server: the receipt opens only when the plan really runs; a mandate still waiting for its first
   *  debit says so instead of "Payment confirmed". */
  async function already() {
    const r = await api<{ subscribed?: boolean }>("/api/poster/pay/credits", { fresh: true }).catch(() => null);
    if (r?.ok && r.data.subscribed) onPaid(null);
    else setNote(T("Your last payment is still being confirmed by the bank. Please check again in a few minutes — you will not be charged twice.", "आपका पिछला payment अभी bank से confirm हो रहा है। कुछ मिनट बाद फिर देखें — दोबारा पैसे नहीं कटेंगे।"));
  }
  const plans = planList(hi);
  const body = (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-10 pt-5" id="website-plan">
      {/* 1 · the card: one line and a way to see it */}
      <section className="flex items-center gap-3 rounded-2xl border border-good/40 bg-good/10 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-good text-white"><Check className="h-5 w-5" strokeWidth={3} /></span>
        <p className="min-w-0 flex-1 text-base font-bold">{T("Your V-Card is ready", "आपका V-Card तैयार है")}</p>
        {onView ? <button type="button" onClick={onView} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Eye className="h-4 w-4 text-brand" /> {T("View", "देखें")}</button>
          : cardHref ? <a href={cardHref} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Eye className="h-4 w-4 text-brand" /> {T("View", "देखें")}</a> : null}
        {overlay && <button type="button" onClick={onClose} aria-label={T("Close", "बंद करें")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"><X className="h-5 w-5" /></button>}
      </section>
      {/* 2 · the website: what each plan gives, then one to pick */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{T("Continue to your website", "अब अपनी website बनाएँ")}</h1>
        <p className="mt-1 text-sm text-muted">{name ? T(`Choose a plan for ${name}'s website. Your card stays free either way.`, `${name} की website के लिए plan चुनें। आपका card हर हाल में free रहेगा।`) : T("Choose a plan for your website. Your card stays free either way.", "अपनी website के लिए plan चुनें। आपका card हर हाल में free रहेगा।")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => {
          const dark = p.key === "premium";
          return (
            <div key={p.key} className={`relative flex h-full flex-col rounded-3xl border-2 p-5 shadow-card ${dark ? "border-transparent bg-[#12144a] text-white" : "border-brand/30 bg-surface"}`}>
              {p.tag && <span className="absolute right-4 top-4 rounded-full bg-[#ffd54a] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#12144a]">{p.tag}</span>}
              <span className="text-lg font-extrabold">{p.title}</span>
              <span className="mt-2 text-3xl font-extrabold tracking-tight">{p.price}</span>
              <span className={`text-xs ${dark ? "text-white/70" : "text-muted"}`}>{p.per}</span>
              <span className={`mt-2 text-sm font-medium ${dark ? "text-white/90" : ""}`}>{p.lead}</span>
              <span className="mb-5 mt-3 block space-y-2">{p.items.map((t) => <span key={t} className="flex items-start gap-2 text-sm"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-[#ffd54a]" : "text-good"}`} />{t}</span>)}</span>
              {/* Each plan has its own button: the choice and the payment are one tap (Razorpay opens). */}
              <div className="mt-auto">
                <SubscribeButton tier="growth" premium={dark} onPaid={(x) => { if (gotPaid.current) return; gotPaid.current = true; onPaid(x); }} onDone={() => undefined} onAlready={() => void already()}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold disabled:opacity-60 ${dark ? "bg-[#ffd54a] text-[#12144a]" : "grad-brand text-white"}`}>
                  {T(`Choose ${p.title} — ${p.price}`, `${p.title} चुनें — ${p.price}`)}
                </SubscribeButton>
              </div>
            </div>
          );
        })}
      </div>
      {note && <p role="status" className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs font-medium">{note}</p>}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-good" /> {T("Secure payment by Razorpay · UPI or card · monthly autopay you can stop from your UPI app", "Razorpay से सुरक्षित payment · UPI या card · हर महीने autopay, UPI app से कभी भी बंद")}</p>
      <button type="button" onClick={onClose} className="block w-full text-center text-sm font-semibold text-muted underline underline-offset-2">{T("Not now — keep my free card", "अभी नहीं — free card ही रखें")}</button>
    </div>
  );
  if (!overlay) return body;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true">{body}</div>;
}

/** The build screen's use: the same plans, over the preview of the card just made. */
export function WebsitePlanSheet({ hi, name, onClose, onPaid }: { hi: boolean; name?: string; onClose: () => void; onPaid: (p: PaidInfo | null) => void }) {
  return <WebsitePlans hi={hi} name={name} overlay onView={onClose} onClose={onClose} onPaid={onPaid} />;
}

/** The three steps after payment: Payment received → Website being made (24–48 h) → Live (WhatsApp). `stage` = the step in progress. */
export function SiteProgress({ hi, stage, when }: { hi: boolean; stage: 1 | 2; when?: string }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const steps = [
    { icon: CheckCircle2, t: T("Payment received", "Payment मिल गया"), s: "" },
    { icon: Clock, t: T("Your website is being made", "आपकी website बन रही है"), s: when || T("Within 24–48 hours", "24–48 घंटे में") },
    { icon: Globe, t: T("Website live", "Website live"), s: T("We will WhatsApp you", "WhatsApp पर बताएँगे") },
  ];
  return (
    <ol className="space-y-0">
      {steps.map((x, i) => {
        const done = i < stage, now = i === stage;
        return (
          <li key={x.t} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${done ? "bg-good" : "bg-border"}`} />}
            <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? "bg-good text-white" : now ? "bg-amber/15 text-amber ring-2 ring-amber/50" : "bg-surface2 text-faint"}`}>
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <x.icon className={`h-4 w-4 ${now ? "animate-pulse" : ""}`} />}
            </span>
            <span className="min-w-0 pt-1">
              <span className={`block text-sm font-semibold ${!done && !now ? "text-muted" : ""}`}>{x.t}</span>
              {x.s && <span className="block text-xs text-muted">{x.s}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The receipt right after Razorpay: what was paid, then the steps, then one button to make the website. */
export function PaidReceipt({ hi, paid, onGo, busy }: { hi: boolean; paid: PaidInfo | null; onGo: () => void; busy?: boolean }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const when = paid ? new Date(paid.at).toLocaleString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
  return (
    <div className="mx-auto max-w-md space-y-4 py-2" id="paid-receipt">
      <section className="relative overflow-hidden rounded-3xl bg-good px-5 py-6 text-center text-white shadow-float">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-good"><Check className="h-7 w-7" strokeWidth={3} /></span>
        <h1 className="relative mt-2 text-2xl font-extrabold">{paid ? T("Payment confirmed", "Payment confirm हो गया") : T("Your plan is active", "आपका plan चालू है")}</h1>
        <p className="relative text-sm text-white/90">{paid ? T("Thank you! Your plan is active.", "धन्यवाद! आपका plan चालू है।") : T("Now make your website.", "अब अपनी website बनाएँ।")}</p>
      </section>
      {paid && (
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">{T("Plan", "Plan")}</dt><dd className="font-semibold">{paid.label}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">{T("Paid", "Paid")}</dt><dd className="font-semibold">{rupees(paid.amount)}</dd></div>
            {paid.paymentId && <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-muted">{T("Payment ID", "Payment ID")}</dt><dd className="truncate text-xs font-semibold tabular-nums">{paid.paymentId}</dd></div>}
            <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">{T("Date", "तारीख")}</dt><dd className="font-semibold">{when}</dd></div>
          </dl>
        </section>
      )}
      <section className="rounded-3xl border border-border bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-bold">{T("What happens now", "अब आगे क्या होगा")}</p>
        <SiteProgress hi={hi} stage={1} />
      </section>
      <button type="button" onClick={onGo} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white shadow-card disabled:opacity-60">
        <Globe className="h-5 w-5" /> {T("Make my website now", "मेरी website अभी बनाएँ")}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted"><MessageCircle className="h-3.5 w-3.5" /> {T("Next: choose its design — it takes a minute.", "आगे: उसका design चुनें — एक मिनट लगेगा।")}</p>
    </div>
  );
}
