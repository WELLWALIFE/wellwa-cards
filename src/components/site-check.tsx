"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import type { Card } from "@/lib/types";
import { checkSite } from "@/lib/site-quality";
import { isShubhoraSellerCard, withoutFreeCard } from "@/lib/shubhora-page";

/** The website check on the edit screen (plan Phase 2): what the site already fixed by itself, and what only the owner
 *  can give (a photo, a full address, a shorter heading). Folded to one line until opened. */
export function SiteCheck({ card, hi, staged = false, onFix }: { card: Card; hi: boolean; staged?: boolean; /** Opens the place where a note is mended (the editor passes it; the "Fix" button shows only then). */ onFix?: (n: { blockId?: string; part?: string }) => void }) {
  // A Shubhora partner's home is drawn with the company's own sections: check what the visitor sees, not the stored blocks.
  const notes = useMemo(() => checkSite(staged || !isShubhoraSellerCard(card) ? card : withoutFreeCard(card, true)), [card, staged]);
  const [open, setOpen] = useState(false);
  const todo = notes.filter((n) => n.level === "todo").length;
  if (!notes.length) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-good/30 bg-good/10 px-3.5 py-2.5 text-sm font-semibold text-good">
        <ShieldCheck className="h-4 w-4" /> {hi ? "Website check: कोई समस्या नहीं मिली" : "Website check: no issues found"}
      </p>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-3 text-left">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1 text-sm font-semibold">
          {hi ? "Website check" : "Website check"}
          <span className="ml-1.5 font-normal text-muted">{todo ? (hi ? `· ${todo} सुधार आपसे` : `· ${todo} to improve`) : (hi ? "· अपने-आप ठीक किया" : "· fixed for you")}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="space-y-2 border-t border-border px-3.5 py-3">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
              {n.level === "fixed"
                ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" />
                : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d97706]" aria-hidden />}
              <span className="min-w-0 flex-1"><span className="font-semibold">{n.page}:</span> {hi ? n.hi : n.en}</span>
              {onFix && (n.blockId || n.part) && <button type="button" onClick={() => onFix(n)} className="shrink-0 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand-ink">{hi ? "ठीक करें →" : "Fix →"}</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
