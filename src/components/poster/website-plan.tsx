"use client";
// The website's plans, asked BEFORE anything is made (owner, 13 Nov 2026 — lib/site-order.ts): "Make my website" → these two plans, one
// payment for the year → Razorpay → the thank-you page (/poster/site/order), where the website is made by itself and goes live within
// 24–48 hours. Nothing is built before the payment, and no free card is offered.
import { useRef, useState } from "react";
import { Check, CheckCircle2, Clock, Globe, MessageCircle, ShieldCheck, X } from "lucide-react";
import type { PaidInfo } from "@/components/subscribe-button";
import { PayRequestButton } from "@/components/poster/pay-request";
import { api } from "@/lib/poster-client";
import { rupees } from "@/lib/billing";
import { SITE_PKG, type SitePkg } from "@/lib/site-order";

type Pick = "standard" | "premium";

/** What each website plan gives — the full list, said plainly (owner, 2 Nov 2026: "dono me kya kya hai wo batao, fir select kare to
 *  payment"). Source of truth for the words: the pricing page (src/app/(marketing)/pricing) and lib/billing. */
function planList(hi: boolean) {
  const T = (en: string, h: string) => (hi ? h : en);
  const year = T("for 1 year · GST included · one payment", "1 साल के लिए · GST शामिल · एक बार payment");
  return [
    {
      key: "standard" as Pick, pkg: "site_standard" as SitePkg, title: "Website Standard", price: rupees(SITE_PKG.site_standard.amount), per: year, tag: "",
      lead: T("A dynamic website for your business, made for you.", "आपके business की dynamic website — हम बनाकर देते हैं।"),
      items: [
        T("Your website (up to 5 pages) and digital card on your own link", "आपकी website (5 pages तक) और digital card, आपके अपने link पर"),
        T("Made by our team and delivered within 24–48 hours", "हमारी team बनाकर 24–48 घंटे में देती है"),
        T("We WhatsApp you the moment it is live", "Live होते ही WhatsApp पर खबर"),
        T("On Google search by itself once it is live", "Live होते ही अपने-आप Google search पर"),
        T("Change photos, words and products yourself, any time", "फ़ोटो, शब्द और products जब चाहें खुद बदलें"),
        T("First month of the Growth Plan free: daily posters, WhatsApp AI and CRM", "Growth Plan का पहला महीना free: रोज़ का poster, WhatsApp AI और CRM"),
      ],
    },
    {
      key: "premium" as Pick, pkg: "site_premium" as SitePkg, title: "Website Premium", price: rupees(SITE_PKG.site_premium.amount), per: year, tag: T("Most popular", "सबसे ज़्यादा चुना गया"),
      lead: T("A dynamic and progressive website: bigger, and it installs like an app.", "Dynamic और progressive website: बड़ी, और app की तरह install होती है।"),
      items: [
        T("Everything in Website Standard", "Website Standard का सब कुछ"),
        T("Premium multi-page website: a page for every product and service", "Premium website: हर product और service का अपना page"),
        T("Progressive: customers can install it on their phone like an app", "Progressive: ग्राहक इसे phone पर app की तरह install कर सकते हैं"),
        T("Google SEO: every page and product on Google", "Google SEO: हर page और product Google पर"),
        T("A layout designed for your business", "आपके business के लिए बना design"),
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
  void cardHref; void onView;   // from the days a card was made first: nothing is made before the payment now
  // A real payment calls onPaid and then onDone: only the first counts (a review, 2 Nov 2026 — the receipt lost its details).
  const gotPaid = useRef(false);
  const [note, setNote] = useState("");
  const plans = planList(hi);
  /** The plan's payment request, made when its button is tapped; an account that already has the plan goes on to its order. */
  const codeFor = (pkg: SitePkg) => async (): Promise<string | null> => {
    setNote("");
    const r = await api<{ code?: string; already?: boolean; error?: string }>("/api/pay/mine", { method: "POST", json: { op: "package", pkg } }).catch(() => null);
    if (r?.ok && r.data.already) { if (!gotPaid.current) { gotPaid.current = true; onPaid(null); } return null; }
    if (!r?.ok || !r.data.code) { setNote(r?.data?.error || T("Could not open the payment now. Please try again.", "Payment अभी नहीं खुल पाया। दोबारा try करें।")); return null; }
    return r.data.code;
  };
  const body = (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-10 pt-5" id="website-plan">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{T("Choose your website plan", "अपनी website का plan चुनें")}</h1>
          <p className="mt-1 text-sm text-muted">{name ? T(`For ${name}'s website. Pay once for the year; our team makes it and delivers it within 24–48 hours.`, `${name} की website के लिए। साल का एक बार payment; हमारी team बनाकर 24–48 घंटे में देती है।`) : T("Pay once for the year; our team makes your website and delivers it within 24–48 hours.", "साल का एक बार payment; हमारी team आपकी website बनाकर 24–48 घंटे में देती है।")}</p>
        </div>
        {overlay && <button type="button" onClick={onClose} aria-label={T("Close", "बंद करें")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"><X className="h-5 w-5" /></button>}
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
                <PayRequestButton code="" getCode={codeFor(p.pkg)} amountPaise={SITE_PKG[p.pkg].amount} hi={hi}
                  label={T(`Pay ${p.price} — ${p.title}`, `${p.price} दें — ${p.title}`)}
                  onPaid={() => { if (gotPaid.current) return; gotPaid.current = true; onPaid({ paymentId: "", label: p.title, amount: SITE_PKG[p.pkg].amount, at: new Date().toISOString() }); }}
                  buttonClass={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold disabled:opacity-60 ${dark ? "bg-[#ffd54a] text-[#12144a]" : "grad-brand text-white"}`} />
              </div>
            </div>
          );
        })}
      </div>
      {note && <p role="status" className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs font-medium">{note}</p>}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-good" /> {T("Secure payment by Razorpay · UPI, cards or net banking · one payment, no autopay", "Razorpay से सुरक्षित payment · UPI, card या net banking · एक बार payment, autopay नहीं")}</p>
      <button type="button" onClick={onClose} className="block w-full text-center text-sm font-semibold text-muted underline underline-offset-2">{T("Not now", "अभी नहीं")}</button>
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
