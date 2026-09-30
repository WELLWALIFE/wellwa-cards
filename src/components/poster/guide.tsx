"use client";
// One-line "what to do here" box shown at the top of every screen, so nobody
// needs a manual. Keep each guide to a single friendly sentence.
import { Lightbulb } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
export function Guide({ hi, en, step }: { hi: string; en: string; step?: string }) {
  const { lang } = useT();
  return (
    <div className="flex items-start gap-2 rounded-xl bg-brand-soft/60 border border-brand/30 px-3 py-2.5 text-[13px] leading-snug text-ink">
      <Lightbulb className="h-4 w-4 text-brand shrink-0 mt-0.5" />
      <span>{step ? <b className="text-brand-ink mr-1">{step}</b> : null}{lang === "en" ? en : hi}</span>
    </div>
  );
}
