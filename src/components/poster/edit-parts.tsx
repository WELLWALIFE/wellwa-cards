"use client";
// The head of each part on Website edit / Card edit (owner, 25 Oct 2026: "pura professional design"): the part's name, one line on
// what it changes, and where the change shows — on both, the website only, or the card only.
import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, type LucideIcon } from "lucide-react";

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
/** What to do for an empty part, in one line (owner, 26 Oct 2026: "khali hisse ke liye aasan raasta"). */
const EMPTY_HINT: Record<string, [string, string]> = {
  photos: ["Add a photo of your shop or work", "अपनी दुकान या काम की photo लगाएँ"],
  products: ["Add your first product or service", "पहला product या service जोड़ें"],
  about: ["Let AI write two lines about you", "AI से अपने बारे में 2 लाइन लिखवाएँ"],
  details: ["3–4 things you offer", "आप क्या देते हैं — 3-4 बातें"],
  reviews: ["Ask for a review on WhatsApp — the message is ready", "WhatsApp पर review माँगें — message तैयार है"],
  you: ["Add your photo and number", "अपनी photo और number लगाएँ"],
  where: ["Add your address and opening hours", "पता और खुलने का समय लिखें"],
  links: ["Add UPI so people can pay you", "UPI लगाएँ — लोग सीधे pay करें"],
  buttons: ["Add Call and WhatsApp buttons", "Call और WhatsApp बटन जोड़ें"],
  trade: ["Write your business name and work", "Business का नाम और काम लिखें"],
  seo: ["Write your city to show on Google", "अपना शहर लिखें — Google पर दिखें"],
};
const tagOf = (scope: Scope, hi: boolean) => scope === "both" ? (hi ? "दोनों" : "Both") : scope === "site" ? (hi ? "Website" : "Website") : (hi ? "Card" : "Card");

export function EditMenu<K extends string>({ groups, hi, onPick, showScope = true, state, what, fold = [] }: {
  groups: MenuGroup<K>[]; hi: boolean; onPick: (group: string, key: K) => void; showScope?: boolean;
  /** Filled or empty, per part (lib/edit-status.ts): a ✓ or an orange "Empty", and the score on top. */ state?: (key: K) => "ok" | "empty" | undefined;
  /** "card" / "website": the word in the score line. */ what?: string;
  /** Groups shown closed under one "More" row (the rarely used parts). */ fold?: string[];
}) {
  const [opened, setOpened] = useState<string[]>([]);
  const all = groups.flatMap((g) => g.tabs.map((t) => state?.(t.key))).filter(Boolean);
  const done = all.filter((x) => x === "ok").length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const row = (g: MenuGroup<K>, t: MenuPart<K>) => {
    const st = state?.(t.key);
    return (
      <button key={t.key} type="button" onClick={() => onPick(g.key, t.key)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-surface2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[g.key] ?? TONES.settings}`}><t.Icon className="h-[18px] w-[18px]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight">{t.label}</span>
          {st === "empty" && EMPTY_HINT[t.key]
            ? <span className="mt-0.5 block truncate text-xs font-medium text-[#c2620a]">{hi ? EMPTY_HINT[t.key][1] : EMPTY_HINT[t.key][0]} →</span>
            : <span className="mt-0.5 block truncate text-xs text-muted">{t.sub}</span>}
        </span>
        {st === "empty" && <span className="shrink-0 rounded-full bg-[#fff1e0] px-2 py-0.5 text-[10px] font-bold text-[#c2620a]">{hi ? "खाली" : "Empty"}</span>}
        {st === "ok" && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good/15 text-good"><Check className="h-3 w-3" strokeWidth={3} /></span>}
        {!st && showScope && t.scope !== "both" && <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">{tagOf(t.scope, hi)}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>
    );
  };
  return (
    <div className="space-y-4">
      {all.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-card">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold">{hi ? `आपका ${what ?? "card"} ${pct}% पूरा` : `Your ${what ?? "card"} is ${pct}% complete`}</p>
            <p className="text-xs font-semibold text-muted">{done}/{all.length}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full grad-brand transition-all" style={{ width: `${pct}%` }} /></div>
          {done < all.length && <p className="mt-2 text-[11px] text-muted">{hi ? "नारंगी \"खाली\" वाले भरें — ग्राहक को पूरी जानकारी मिलेगी।" : "Fill the orange \"Empty\" ones — customers get the full picture."}</p>}
        </div>
      )}
      {/* What is still empty, on top (owner, 26 Oct 2026: "khali wale upar"): one tap to each. */}
      {state && (() => {
        const todo = groups.flatMap((g) => g.tabs.filter((t) => state(t.key) === "empty").map((t) => ({ g, t })));
        if (!todo.length) return null;
        return (
          <section>
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-[#c2620a]">{hi ? `बाकी हैं (${todo.length})` : `Still to fill (${todo.length})`}</p>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-[#f5c58a] bg-[#fffaf3] shadow-card">
              {todo.map(({ g, t }) => row(g, t))}
            </div>
          </section>
        );
      })()}
      {groups.map((g) => {
        const folded = fold.includes(g.key);
        const isOpen = !folded || opened.includes(g.key);
        return (
          <section key={g.key}>
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-faint">{g.label}</p>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
              {isOpen
                ? g.tabs.map((t) => row(g, t))
                : <button type="button" onClick={() => setOpened((o) => [...o, g.key])} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES.settings}`}><MoreHorizontal className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-tight">{hi ? "और options दिखाएँ" : "Show more options"}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{g.tabs.map((t) => t.label).join(" · ")}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
                  </button>}
            </div>
          </section>
        );
      })}
      <p className="px-1 text-center text-[11px] text-faint">{hi ? "हर बदलाव ऊपर की window में तुरंत दिखता है · Preview में ✏️ दबाकर भी खोलें" : "Every change shows in the window above · or tap ✏️ in the preview"}</p>
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
