"use client";
// A paid feature on a free account: shown where it lives, with a small 🔒 Standard tag; a tap opens one sheet
// that says what the Standard plan gives and takes the person to the plan (owner's call, 3 Oct 2026: locks on the item,
// never on the whole page, never in the middle of the set-up).
import { useState } from "react";
import Link from "next/link";
import { Lock, Sparkles, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { usePlan } from "@/lib/plan";
import { SubscribeButton } from "@/components/subscribe-button";

export const PREMIUM_LINES = {
  en: ["Standard website (up to 5 pages), with a sub-domain address", "Daily poster on Facebook, Instagram and WhatsApp Status", "Meta Ads (Facebook and Instagram)", "WhatsApp AI assistant that answers customers and filters leads", "AI Ad Studio and Reel Maker", "Google reviews and Google Business posts"],
  hi: ["Standard website (5 pages तक), sub-domain address के साथ", "Facebook, Instagram और WhatsApp Status पर रोज़ का poster", "Meta Ads (Facebook और Instagram)", "WhatsApp AI assistant जो customers को जवाब देता है और leads छाँटता है", "AI Ad Studio और Reel Maker", "Google reviews और Google Business posts"],
};

/** The sheet: what the Standard plan gives, and the way to it. */
export function PremiumSheet({ feature, onClose }: { feature?: string; onClose: () => void }) {
  const { lang } = useT();
  const hi = lang === "hi";
  // Razorpay opens right here (owner's call, 4 Oct 2026: "jahan bhi subscription hai, Razorpay se"): the mandate is
  // approved in the person's UPI app, the plan is re-read and the lock opens without leaving the screen.
  const { refresh } = usePlan();
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-4 shadow-float sm:max-h-[90dvh] sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl grad-brand text-white"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{feature ? (hi ? `${feature} — Standard में` : `${feature} — with Standard`) : "Standard"}</p>
            <p className="text-xs text-muted">{hi ? "₹2,999 / महीना (GST सहित) · कभी भी बंद करें" : "₹2,999 a month, GST included · cancel any time"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {(hi ? PREMIUM_LINES.hi : PREMIUM_LINES.en).map((l) => <li key={l} className="flex gap-2"><span className="text-good">✓</span><span>{l}</span></li>)}
        </ul>
        <div className="mt-4">
          <SubscribeButton tier="growth" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white disabled:opacity-60" onDone={() => { void refresh(); onClose(); }}>{hi ? "Standard लें — UPI / card से" : "Get Standard — pay by UPI / card"}</SubscribeButton>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">{hi ? "आपका free card वैसे ही चलता रहेगा।" : "Your free card keeps running as it is."} · <Link href="/poster/plan" className="font-semibold text-brand-ink underline">{hi ? "सभी plans" : "All plans"}</Link></p>
      </div>
    </div>
  );
}

/** A row that needs the Standard plan: on a free account it carries the tag and opens the sheet; on a paid one `children` runs as is. */
export function PremiumGate({ locked, feature, children, className = "" }: { locked: boolean; feature: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!locked) return <>{children}</>;
  return (
    <>
      <div className={`relative ${className}`} onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <div className="pointer-events-none opacity-80">{children}</div>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#12144a] px-2 py-0.5 text-[10px] font-bold text-[#ffd54a]"><Lock className="h-3 w-3" /> Standard</span>
      </div>
      {open && <PremiumSheet feature={feature} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The upgrade card for Home and Card & Website: sells Standard (Starter is no longer sold). */
export function PremiumCard({ compact = false }: { compact?: boolean }) {
  const { lang } = useT();
  const hi = lang === "hi";
  const { refresh } = usePlan();
  return (
    <div className="rounded-2xl bg-[#12144a] p-4 text-white">
      <p className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-[#ffd54a]" /> {hi ? "Standard — वेबसाइट, रोज़ के poster और WhatsApp AI" : "Standard — a website, daily posters and a WhatsApp AI assistant"}</p>
      {!compact && <p className="mt-1 text-xs text-white/80">{hi ? "Standard ₹2,999 / महीना: वेबसाइट, Facebook-Instagram-WhatsApp Status पर रोज़ का poster, Meta Ads, WhatsApp AI और Google reviews। ज़्यादा चाहिए तो Premium।" : "Standard ₹2,999 a month: website, daily posters on Facebook, Instagram and WhatsApp Status, Meta Ads, WhatsApp AI and Google reviews. Want more? Premium."}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SubscribeButton tier="growth" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-[#12144a] disabled:opacity-60" onDone={() => { void refresh(); }}>{hi ? "₹2,999 / महीना · Standard लें" : "₹2,999 a month · get Standard"}</SubscribeButton>
        <Link href="/poster/plan" className="text-xs font-semibold text-white/80 underline">{hi ? "सभी plans" : "All plans"}</Link>
      </div>
      {/* Premium next to Standard (owner, 17 Oct 2026): ₹5,999 for the first month only, then ₹2,999 a month. */}
      <div className="mt-3 border-t border-white/15 pt-3">
        <p className="flex items-center gap-2 text-sm font-bold"><span className="rounded-full bg-[#ffd54a] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#12144a]">{hi ? "सबसे ज़्यादा चुना गया" : "Most popular"}</span> Premium</p>
        <p className="mt-1 text-xs text-white/80">{hi ? "Standard का सब कुछ, साथ में बड़ी multi-page website और Google SEO। दूसरे महीने से ₹2,999 / महीना।" : "Everything in Standard, plus a bigger multi-page website and Google SEO. Then ₹2,999 a month from the 2nd month."}</p>
        <div className="mt-2">
          <SubscribeButton tier="growth" premium className="inline-flex items-center gap-1.5 rounded-full bg-[#ffd54a] px-3.5 py-1.5 text-sm font-semibold text-[#12144a] disabled:opacity-60" onDone={() => { void refresh(); }}>{hi ? "₹5,999 पहला महीना · Premium लें" : "₹5,999 first month only · get Premium"}</SubscribeButton>
        </div>
      </div>
    </div>
  );
}
