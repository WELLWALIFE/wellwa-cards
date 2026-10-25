"use client";
// The head of each part on Website edit / Card edit (owner, 25 Oct 2026: "pura professional design"): the part's name, one line on
// what it changes, and where the change shows — on both, the website only, or the card only.
import type { LucideIcon } from "lucide-react";

export type Scope = "both" | "site" | "card";

export function TabHead({ Icon, title, sub, scope, hi }: { Icon: LucideIcon; title: string; sub: string; scope: Scope; hi: boolean }) {
  const tag = scope === "both" ? (hi ? "दोनों में" : "Card + Website") : scope === "site" ? (hi ? "सिर्फ़ Website" : "Website only") : (hi ? "सिर्फ़ Card" : "Card only");
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2f5bf5] to-[#7b5cff] px-4 py-3 text-white shadow-card">
      <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{title}</p>
          <p className="text-[11px] leading-snug text-white/85">{sub}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${scope === "both" ? "bg-[#22c55e] text-white" : "bg-white text-[#2f5bf5]"}`}>{tag}</span>
      </div>
    </div>
  );
}
