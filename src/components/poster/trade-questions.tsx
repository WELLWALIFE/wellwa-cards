"use client";
// The trade's own questions, asked right after "What do you do?" (owner's call, 2 Oct 2026: the fields after the
// category must match the category — a school is asked its classes, board and medium; a restaurant its cuisine).
// Chips for one / many, a line for text; answers go to card facts `tradeAnswers` (English option names).
// Every chip question also has "+ Write your own": it opens a line for the real answer (owner's call: "other se AI
// kya samjhega?"), and that typed text is what is saved — never the word "Other".
// Owner's call, 5 Oct 2026 ("typed text disappears"): the button only opens the line — a second tap focuses it and
// never wipes anything; a draft becomes a chip on Add / Enter / comma and also when the line loses focus (a Next tap
// must not lose it); typed values sit under the line as dashed ✎ chips with their own ×; a short "Added ✓" says what
// happened; the form and the save share one cap — a full list refuses a tick too, and says so.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Sec, box, chipCls, field, type FactsPatch } from "@/components/poster/facts-fields";
import { MAX_TRADE_ANSWERS, type CardFacts } from "@/lib/card-facts";
import { categoryOf } from "@/lib/poster-categories";
import { tradeQuestionsFor } from "@/lib/trade-questions";

const isOtherOption = (en: string) => /^(other|others)$/i.test(en.trim());
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** The "+ Write your own" button: dashed, so an open line never reads as a ticked option. */
const writeCls = (open: boolean) => `rounded-full border-2 border-dashed px-3.5 py-2 text-sm font-medium ${open ? "border-brand text-brand-ink" : "border-border text-muted"}`;
/** A value the owner typed, as a chip: dashed + ✎, clearly theirs and not a seed. */
const typedCls = "inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-brand bg-brand-soft px-3.5 py-2 text-sm font-medium text-brand-ink";
const FLASH_MS = 1800;

export function TradeQuestions({ category, facts, setF, hi, title = true, tradeLabel }: {
  category: string; facts: CardFacts; setF: (p: FactsPatch) => void; hi: boolean;
  /** The "About your <trade>" heading on top. */
  title?: boolean;
  /** The trade as the owner typed it ("Mobile repair") — the heading uses it before the category's name, so an
   *  "other" business is never asked "About your other". */
  tradeLabel?: string;
}) {
  const qs = tradeQuestionsFor(category);
  const c = categoryOf(category);
  // Which questions have their "Write your own" line open (also open whenever a typed answer is saved).
  const [otherOpen, setOtherOpen] = useState<Record<string, boolean>>({});
  // Tick-all: what is being typed before Add (committed on blur too). One-answer: the line as typed, committed on blur / Enter.
  const [otherDraft, setOtherDraft] = useState<Record<string, string>>({});
  // "Added ✓" and friends, per question, for a moment.
  const [flash, setFlash] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => { const t = timers.current; return () => { for (const x of Object.values(t)) clearTimeout(x); }; }, []);
  if (!c || !qs.length) return null;
  const T = (en: string, h: string) => (hi ? h : en);
  const answers = facts.tradeAnswers ?? {};
  const set = (key: string, v: string[]) => setF({ tradeAnswers: { ...answers, [key]: v } });
  const setDraft = (key: string, v: string | undefined) => setOtherDraft((d) => { const n = { ...d }; if (v === undefined) delete n[key]; else n[key] = v; return n; });
  const note = (key: string, msg: string) => {
    setFlash((f) => ({ ...f, [key]: msg }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[key]; return n; }), FLASH_MS);
  };
  const tradeName = tradeLabel?.trim() || (isOtherOption(c.en) ? T("work", "काम") : (hi ? c.hi : c.en).split(" / ")[0].split(" (")[0]);
  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-semibold">{T(`About your ${tradeName.toLowerCase()}`, `आपके ${tradeName} के बारे में`)} <span className="font-normal text-muted">({T("tap what applies", "जो सही हो दबाएँ")})</span></p>}
      {qs.map((q) => {
        const cur = answers[q.key] ?? [];
        if (q.type === "text") return (
          <Sec key={q.key} id={`q-trade-${q.key}`} title={T(q.en, q.hi)}>
            <input value={cur[0] ?? ""} onChange={(e) => set(q.key, e.target.value ? [e.target.value.slice(0, 80)] : [])} placeholder={T(q.eg ?? "", q.egHi ?? q.eg ?? "")} className={field} />
          </Sec>
        );
        // The listed options; a literal "Other" in the data is the generic "+ Write your own" below.
        const options = (q.options ?? []).filter((o) => !isOtherOption(o.en));
        const known = new Set(options.map((o) => o.en));
        const picked = cur.filter((v) => known.has(v));
        // Everything typed under "Write your own": one value for a one-answer question, any number for tick-all
        // (owner's call, 4 Oct 2026: "ek se zyada daalna ho to?") — each its own chip, removable only by its ×.
        const typedAll = cur.filter((v) => !known.has(v));
        const typed = typedAll[0] ?? "";
        const draft = otherDraft[q.key];
        const otherOn = !!otherOpen[q.key] || typedAll.length > 0;
        const seedFor = (t: string) => options.find((o) => sameText(o.en, t) || sameText(o.hi, t));
        const full = cur.length >= MAX_TRADE_ANSWERS;
        const fullNote = () => note(q.key, T(`List is full — ${MAX_TRADE_ANSWERS} at most`, `सूची भर गई — ज़्यादा से ज़्यादा ${MAX_TRADE_ANSWERS}`));
        /** Tick / untick a seed. A full list takes no more (the save keeps only the first 16 — a tick past that
         *  showed, then vanished on reload). */
        const toggle = (v: string) => {
          if (q.type === "one") { setOtherOpen((o) => ({ ...o, [q.key]: false })); setDraft(q.key, undefined); return set(q.key, picked.includes(v) ? [] : [v]); }
          if (picked.includes(v)) return set(q.key, cur.filter((x) => x !== v));
          if (full) return fullNote();
          set(q.key, [...cur, v]);
        };
        /** Open only: when the line is already open, a tap just focuses it. */
        const openOther = () => {
          if (otherOn) { inputs.current[q.key]?.focus(); return; }
          setOtherOpen((o) => ({ ...o, [q.key]: true }));
        };
        /** One-answer: the line becomes the answer (blur / Enter); a seed's own name ticks that seed instead. */
        const commitOne = () => {
          if (draft === undefined) return;
          const v = draft.trim().slice(0, 80);
          const seed = seedFor(v);
          if (seed) {
            set(q.key, [seed.en]); setOtherOpen((o) => ({ ...o, [q.key]: false })); setDraft(q.key, undefined);
            note(q.key, T("already in the list ✓", "सूची में पहले से है ✓"));
            return;
          }
          if (v !== typed) set(q.key, v ? [v] : []);
          setDraft(q.key, undefined);
        };
        /** Tick-all: the draft becomes chips (Enter, comma, + Add, or the line losing focus); several at once when
         *  separated by commas. A part that names a seed ticks the seed; a repeat is reported; the parts a full list
         *  cannot take stay in the line and are named — nothing is silently dropped. */
        const addTyped = () => {
          const parts = (draft ?? "").split(/[,،]/).map((x) => x.trim().slice(0, 80)).filter(Boolean);
          if (!parts.length) return;
          let next = cur, added = 0, ticked = 0, dup = 0;
          const left: string[] = [];
          for (const p of parts) {
            const seed = seedFor(p);
            const v = seed?.en ?? p;
            if (next.some((x) => sameText(x, v))) { dup++; continue; }
            if (next.length >= MAX_TRADE_ANSWERS) { left.push(p); continue; }
            next = [...next, v];
            if (seed) ticked++; else added++;
          }
          if (next !== cur) set(q.key, next);
          if (added || ticked || dup) setDraft(q.key, left.length ? left.join(", ") : undefined);
          const got = added + ticked;
          const fullMsg = T(`List is full — ${MAX_TRADE_ANSWERS} at most`, `सूची भर गई — ज़्यादा से ज़्यादा ${MAX_TRADE_ANSWERS}`);
          note(q.key, left.length ? (got ? T(`Added ${got} · list full for: ${left.join(", ")}`, `${got} जुड़े · सूची भर गई, नहीं जुड़े: ${left.join(", ")}`) : fullMsg)
            : added ? T("Added ✓", "जुड़ गया ✓")
            : ticked ? T("already in the list ✓", "सूची में पहले से है ✓")
            : T("already added", "पहले से जुड़ा है"));
        };
        const removeTyped = (v: string) => set(q.key, cur.filter((x) => x !== v));
        const nearCap = cur.length >= MAX_TRADE_ANSWERS - 4;
        const msg = flash[q.key];
        const setRef = (el: HTMLInputElement | null) => { inputs.current[q.key] = el; };
        return (
          <Sec key={q.key} id={`q-trade-${q.key}`} title={T(q.en, q.hi)} hint={q.type === "many" && q.key !== "offerings" ? T("Tick all that apply.", "जितने हों, सब दबाएँ।") : undefined}>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <button key={o.en} type="button" onClick={() => toggle(o.en)} disabled={full && !picked.includes(o.en)} title={full && !picked.includes(o.en) ? T(`List is full — ${MAX_TRADE_ANSWERS} at most`, `सूची भर गई — ज़्यादा से ज़्यादा ${MAX_TRADE_ANSWERS}`) : undefined}
                  className={`${chipCls(picked.includes(o.en))} disabled:cursor-not-allowed disabled:opacity-50`}>{hi ? o.hi : o.en}</button>
              ))}
              <button type="button" onClick={openOther} aria-expanded={otherOn} className={writeCls(otherOn)}>{T("+ Write your own", "+ अपना लिखें")}</button>
            </div>
            {otherOn && q.type === "one" && (
              <input ref={setRef} autoFocus={!!otherOpen[q.key]} value={draft ?? typed} onChange={(e) => setDraft(q.key, e.target.value.slice(0, 80))}
                onBlur={commitOne} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitOne(); } }}
                placeholder={T("Write it here — e.g. the exact name", "यहाँ लिखें — जैसे सही नाम")} className={field} />
            )}
            {otherOn && q.type === "many" && (
              <div className="mt-1 space-y-2">
                <div className="flex items-stretch gap-2">
                  <input ref={setRef} autoFocus={!!otherOpen[q.key]} value={draft ?? ""} onChange={(e) => setDraft(q.key, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTyped(); } }}
                    onBlur={() => { if ((draft ?? "").trim()) addTyped(); }}
                    placeholder={T("Write one and press Enter — or several with commas", "एक लिखकर Enter दबाएँ — या comma से कई")} className={`${box} min-w-0 flex-1`} />
                  <button type="button" onClick={addTyped} disabled={!(draft ?? "").trim()} className="shrink-0 rounded-xl grad-brand px-4 text-sm font-semibold text-white disabled:opacity-50">+ {T("Add", "जोड़ें")}</button>
                </div>
                {typedAll.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {typedAll.map((v) => (
                      <span key={v} className={typedCls}>✎ {v}<button type="button" onClick={() => removeTyped(v)} aria-label={T(`Remove ${v}`, `${v} हटाएँ`)} className="rounded-full p-0.5 hover:bg-brand/10"><X className="h-3.5 w-3.5" /></button></span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(msg || nearCap) && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <p role="status" className={msg ? "animate-rise font-medium text-brand-ink" : "text-muted"}>{msg || (full ? T("List is full — untick one to tick another", "सूची भर गई — दूसरा दबाने के लिए एक हटाएँ") : "")}</p>
                {nearCap && <span className="text-muted">{cur.length}/{MAX_TRADE_ANSWERS}</span>}
              </div>
            )}
          </Sec>
        );
      })}
    </div>
  );
}
