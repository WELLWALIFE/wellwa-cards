"use client";
// The website's plan, asked AFTER the free card is made (owner, 2 Nov 2026: "make my website dabane ke baad payment ka option aaye —
// aapka card ban gaya hai, website ke liye apna plan select kare; payment ke baad payment confirm kare aur 24–48 hr ka page dikha de").
// Order of the finish: the card is made and shown first (it stays free whatever is chosen) → this sheet → Razorpay → the receipt
// (PaidReceipt) → the website is made → the waiting screen with the three steps (SiteProgress). "Not now" keeps the free card.
import { useState } from "react";
import { Check, CheckCircle2, Clock, Globe, MessageCircle, ShieldCheck, X } from "lucide-react";
import { SubscribeButton, type PaidInfo } from "@/components/subscribe-button";
import { SAAS_PLANS, PREMIUM_FIRST_PAISE, rupees } from "@/lib/billing";

type Pick = "standard" | "premium";

export function WebsitePlanSheet({ hi, name, onClose, onPaid }: { hi: boolean; name?: string; onClose: () => void; onPaid: (p: PaidInfo | null) => void }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [pick, setPick] = useState<Pick>("standard");
  const plans: { key: Pick; title: string; price: string; per: string; tag?: string; items: string[] }[] = [
    { key: "standard", title: "Standard", price: rupees(SAAS_PLANS.growth.amount), per: T("/ month", "/ महीना"), tag: T("Recommended", "सबसे सही"),
      items: [T("Website up to 5 pages, no Shubhora tag", "5 pages तक website, Shubhora tag नहीं"), T("Daily posters on Facebook, Instagram, WhatsApp", "रोज़ posters — Facebook, Instagram, WhatsApp"), T("WhatsApp AI replies 24×7", "WhatsApp AI 24×7 जवाब")] },
    { key: "premium", title: "Premium", price: rupees(PREMIUM_FIRST_PAISE), per: T("first month", "पहला महीना"),
      items: [T("Everything in Standard", "Standard का सब कुछ"), T("A page for every product + Google SEO", "हर product का page + Google SEO"), T(`Then ${rupees(SAAS_PLANS.growth.amount)} / month`, `फिर ${rupees(SAAS_PLANS.growth.amount)} / महीना`)] },
  ];
  const sel = plans.find((p) => p.key === pick)!;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center" role="dialog" aria-modal="true" id="website-plan">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface shadow-float sm:rounded-3xl">
        <div className="relative bg-[#12144a] px-5 pb-5 pt-6 text-center text-white">
          <button type="button" onClick={onClose} aria-label={T("Close", "बंद करें")} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good text-white"><Check className="h-6 w-6" strokeWidth={3} /></span>
          <p className="mt-2 text-xl font-extrabold">{T("Your card is ready", "आपका card बन गया है")}</p>
          <p className="mt-1 text-sm text-white/80">{name ? T(`Now choose a plan for ${name}'s website`, `अब ${name} की website के लिए plan चुनें`) : T("Now choose a plan for your website", "अब अपनी website के लिए plan चुनें")}</p>
        </div>
        <div className="space-y-2.5 p-4">
          {plans.map((p) => {
            const on = p.key === pick;
            return (
              <button key={p.key} type="button" onClick={() => setPick(p.key)} aria-pressed={on} className={`relative block w-full rounded-2xl border-2 p-3.5 text-left transition ${on ? "border-brand bg-brand-soft/40" : "border-border"}`}>
                {p.tag && <span className="absolute -top-2.5 right-3 rounded-full bg-[#12144a] px-2 py-0.5 text-[10px] font-bold text-[#ffd54a]">{p.tag}</span>}
                <span className="flex items-center gap-2.5">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand bg-brand" : "border-border"}`}>{on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}</span>
                  <span className="flex-1 text-base font-bold">{p.title}</span>
                  <span className="text-right"><span className="block text-base font-extrabold">{p.price}</span><span className="block text-[10px] text-muted">{p.per}</span></span>
                </span>
                <span className="mt-2 block space-y-1 pl-7">{p.items.map((t) => <span key={t} className="flex items-start gap-1.5 text-xs"><Check className="mt-0.5 h-3 w-3 shrink-0 text-good" />{t}</span>)}</span>
              </button>
            );
          })}
          <SubscribeButton key={pick} tier="growth" premium={pick === "premium"} onPaid={(p) => onPaid(p)} onDone={() => onPaid(null)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white shadow-card disabled:opacity-60">
            {T(`Pay ${sel.price} — UPI / card`, `${sel.price} pay करें — UPI / card`)}
          </SubscribeButton>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-good" /> {T("Secure Razorpay · GST included · monthly autopay", "Razorpay से सुरक्षित · GST शामिल · हर महीने autopay")}</p>
          <button type="button" onClick={onClose} className="block w-full pt-1 text-center text-sm font-semibold text-muted underline underline-offset-2">{T("Not now — keep my free card", "अभी नहीं — free card ही रखें")}</button>
        </div>
      </div>
    </div>
  );
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
        <h1 className="relative mt-2 text-2xl font-extrabold">{T("Payment confirmed", "Payment confirm हो गया")}</h1>
        <p className="relative text-sm text-white/90">{T("Thank you! Your plan is active.", "धन्यवाद! आपका plan चालू है।")}</p>
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
