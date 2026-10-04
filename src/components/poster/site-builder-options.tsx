"use client";

// Two ways to improve the website, both the same system as the build's "Write again" (owner's call, 4 Oct 2026:
// "write again user kabhi bhi kar sakta hai"): Change the look opens the live site with its five looks — free, a tap
// goes live; Improve with AI opens "What should change?" — the owner ticks what they want different and pays one
// credit per thing, with the total shown before anything is spent. No price is written here: it depends on the ask.
import Link from "next/link";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SiteBuilderOptions(_props: { cardId: string; templateKey?: string; generatedAt?: string; knowledge?: string; onDone?: (msg: string) => void }) {
  const { lang } = useT();
  const hi = lang === "hi";
  return (
    <section className="rounded-xl border border-brand/40 bg-brand-soft/30 p-3 space-y-3">
      <p className="text-sm font-semibold">{hi ? "Website और बेहतर करें" : "Improve your website"}</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/poster/card/build?improve=1" className="rounded-xl border-2 border-border bg-surface p-3 text-left hover:border-brand">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><LayoutTemplate className="h-4 w-4 text-brand" /> {hi ? "Look बदलें" : "Change the look"}</span>
          <span className="mt-0.5 block text-[11px] text-good font-semibold">{hi ? "Free · 5 looks, तुरंत live" : "Free · 5 looks, live at a tap"}</span>
        </Link>
        <Link href="/poster/card/build?improve=1&ask=1" className="rounded-xl border-2 border-border bg-surface p-3 text-left hover:border-brand">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand" /> {hi ? "AI से बेहतर करें" : "Improve with AI"}</span>
          <span className="mt-0.5 block text-[11px] text-muted">{hi ? "नया banner, photos, शब्द या layout — जो चुनें उतने credit" : "New banner, photos, words or layout — credits by what you pick"}</span>
        </Link>
      </div>
      <p className="text-[11px] text-muted">{hi ? "आपके products, दाम, photos और पता वैसे ही रहते हैं — सिर्फ़ जो आप बदलना चाहें वही बदलता है।" : "Your products, prices, photos and address stay — only what you ask to change changes."}</p>
    </section>
  );
}
