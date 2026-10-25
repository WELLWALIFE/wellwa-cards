"use client";
// The head of each part on Website edit / Card edit (owner, 25 Oct 2026: "pura professional design"): the part's name, one line on
// what it changes, and where the change shows — on both, the website only, or the card only.
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

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

// ---- The list of every part, then the part itself (owner, 25 Oct 2026: "list → khulta page"): one tap to a part, one tap back. ----

export type MenuPart<K extends string> = { key: K; label: string; Icon: LucideIcon; sub: string; scope: Scope };
export type MenuGroup<K extends string> = { key: string; label: string; tabs: MenuPart<K>[] };

/** Each group its own quiet colour, so the list reads at a glance. */
const TONES: Record<string, string> = {
  design: "bg-[#efeaff] text-[#6d4fe0]", content: "bg-[#e7f0ff] text-[#2f5bf5]", contact: "bg-[#e3f7ee] text-[#109463]", settings: "bg-[#eef0f5] text-[#4b5270]",
};
const tagOf = (scope: Scope, hi: boolean) => scope === "both" ? (hi ? "दोनों" : "Both") : scope === "site" ? (hi ? "Website" : "Website") : (hi ? "Card" : "Card");

export function EditMenu<K extends string>({ groups, hi, onPick, showScope = true }: { groups: MenuGroup<K>[]; hi: boolean; onPick: (group: string, key: K) => void; showScope?: boolean }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.key}>
          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-faint">{g.label}</p>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {g.tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => onPick(g.key, t.key)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-surface2">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[g.key] ?? TONES.settings}`}><t.Icon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{t.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{t.sub}</span>
                </span>
                {showScope && t.scope !== "both" && <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">{tagOf(t.scope, hi)}</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="px-1 text-center text-[11px] text-faint">{hi ? "हर बदलाव ऊपर की window में तुरंत दिखता है" : "Every change shows in the window above right away"}</p>
    </div>
  );
}

/** The open part's head: back to the list, its name, and where the change shows. */
export function PartHead({ part, group, hi, onBack }: { part: MenuPart<string>; group: string; hi: boolean; onBack: () => void }) {
  const tag = part.scope === "both" ? (hi ? "Card + Website" : "Card + Website") : part.scope === "site" ? (hi ? "सिर्फ़ Website" : "Website only") : (hi ? "सिर्फ़ Card" : "Card only");
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={onBack} className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface pl-1.5 pr-3 text-sm font-semibold text-ink shadow-sm active:scale-95">
        <ChevronLeft className="h-4 w-4" /> {hi ? "सब" : "All"}
      </button>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[group] ?? TONES.settings}`}><part.Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold leading-tight">{part.label}</p>
        <p className="truncate text-[11px] text-muted">{part.sub}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${part.scope === "both" ? "bg-good/15 text-good" : "bg-brand/10 text-brand-ink"}`}>{tag}</span>
    </div>
  );
}
