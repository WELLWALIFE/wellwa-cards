"use client";
// A Premium feature on a free account: shown where it lives, with a small 🔒 Premium tag; a tap opens one sheet
// that says what Premium gives and takes the person to the plan (owner's call, 3 Oct 2026: locks on the item,
// never on the whole page, never in the middle of the set-up).
import { useState } from "react";
import Link from "next/link";
import { Lock, Sparkles, X } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

export const PREMIUM_LINES = {
  en: ["Website on Google (search)", "AI edits — say what to change", "Your photos put on the site, AI pictures when needed", "No Shubhora tag on your website", "WhatsApp AI assistant 24×7", "Auto-post posters, your own domain"],
  hi: ["Website Google पर (search में)", "AI से बदलाव — बस बोल दो", "आपकी photos site पर, ज़रूरत हो तो AI pictures", "आपकी website पर Shubhora का tag नहीं", "WhatsApp AI assistant 24×7", "Poster auto-post, अपना domain"],
};

/** The sheet: what Premium gives, and the way to it. */
export function PremiumSheet({ feature, onClose }: { feature?: string; onClose: () => void }) {
  const { lang } = useT();
  const hi = lang === "hi";
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-2xl bg-surface p-4 shadow-float sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl grad-brand text-white"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{feature ? (hi ? `${feature} — Premium में` : `${feature} — with Premium`) : "Premium"}</p>
            <p className="text-xs text-muted">{hi ? "₹2,999 / महीना · कभी भी बंद करें" : "₹2,999 a month · cancel any time"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {(hi ? PREMIUM_LINES.hi : PREMIUM_LINES.en).map((l) => <li key={l} className="flex gap-2"><span className="text-good">✓</span><span>{l}</span></li>)}
        </ul>
        <Link href="/poster/plan" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-3.5 text-base font-semibold text-white">{hi ? "Premium लें" : "Go Premium"} →</Link>
        <p className="mt-2 text-center text-[11px] text-muted">{hi ? "आपकी free website और card वैसे ही चलते रहेंगे।" : "Your free website and card keep running as they are."}</p>
      </div>
    </div>
  );
}

/** A row that is Premium: on a free account it carries the tag and opens the sheet; on a paid one `children` runs as is. */
export function PremiumGate({ locked, feature, children, className = "" }: { locked: boolean; feature: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!locked) return <>{children}</>;
  return (
    <>
      <div className={`relative ${className}`} onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <div className="pointer-events-none opacity-80">{children}</div>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#12144a] px-2 py-0.5 text-[10px] font-bold text-[#ffd54a]"><Lock className="h-3 w-3" /> Premium</span>
      </div>
      {open && <PremiumSheet feature={feature} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The Premium card for Home and Card & Website: one line each, one button. */
export function PremiumCard({ compact = false }: { compact?: boolean }) {
  const { lang } = useT();
  const hi = lang === "hi";
  return (
    <Link href="/poster/plan" className="block rounded-2xl bg-[#12144a] p-4 text-white">
      <p className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-[#ffd54a]" /> {hi ? "Premium — website और भी अच्छी" : "Premium — a better website"}</p>
      {!compact && <p className="mt-1 text-xs text-white/80">{hi ? "Google पर, AI से बदलाव, आपकी photos, बिना Shubhora tag, WhatsApp AI." : "On Google, AI edits, your photos, no Shubhora tag, WhatsApp AI."}</p>}
      <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#12144a]">{hi ? "₹2,999 / महीना · देखें" : "₹2,999 a month · see"} →</span>
    </Link>
  );
}
