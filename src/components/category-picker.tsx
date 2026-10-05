"use client";

// "What do you do?" — type a few letters and pick one of the 2-3 trades suggested underneath (owner's call,
// 2 Oct 2026: "search kare, suggested name 2/3 aa jaaye, user ek select kar le"). The full grouped list is one
// tap away for anyone who would rather browse; it opens as a bottom sheet on phones and a centred panel on computers.
// What the owner types never vanishes (owner's call, 5 Oct 2026): it is the first row of the drop-down, it is kept
// on blur / Done / Enter unless it IS a listed trade, and it stays in the box as "own words · matched trade".
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, List, PenLine, Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_GROUPS, categoryOf } from "@/lib/poster-categories";
// The everyday words live with the trade guesser (the website peek uses the same list at set-up).
import { ALIASES, suggestCategories } from "@/lib/category-match";

/**
 * True when the typed words match an everyday name of this trade: "mithai" → sweets, "parl" → salon (parlour),
 * "mithai shop" → sweets. A word must match from its start, so "dress" never finds "dr" (doctor).
 */
function aliasMatch(key: string, s: string): boolean {
  const list = ALIASES[key];
  if (!list || !s) return false;
  const typed = ` ${s.split(/\s+/).join(" ")} `;
  return list.some((a) => (s.length >= 3 && (a.startsWith(s) || a.split(" ").some((w) => w.startsWith(s)))) || typed.includes(` ${a} `));
}

/** The typed text IS this trade — its English or Hindi name (whole, or one "/" part), its key or an everyday alias,
 *  case-insensitive — so there is nothing to keep in the owner's own words. */
function exact(key: string, s: string): boolean {
  const t = s.trim().toLowerCase();
  const c = categoryOf(key);
  if (!t || !c) return false;
  return [c.en, c.hi, ...c.en.split("/"), ...c.hi.split("/"), c.key, ...(ALIASES[key] ?? [])].some((x) => x.trim().toLowerCase() === t);
}

export function CategoryPicker({ value, onChange, lang = "en", placeholder = "Choose…", className = "", custom = "", onCustom }: {
  value: string; onChange: (key: string) => void; lang?: "en" | "hi"; placeholder?: string; className?: string;
  /** The trade in the owner's own words (the parent's biz.trade). Shown in the box for ANY category key: alone when
   *  the key is "other", else "own words · matched trade" (owner's call, 5 Oct 2026). */
  custom?: string;
  /** "Use what I typed as my trade" (owner's call, 4 Oct 2026: a trade the list lacks must still be fillable).
   *  `nearest` is the closest listed trade for the text, if any — a fallback when the parent's own guess finds none. */
  onCustom?: (text: string, nearest?: string) => void;
}) {
  const [open, setOpen] = useState(false);           // the full list (sheet)
  const [typing, setTyping] = useState(false);       // the inline search box has focus
  const [list, setList] = useState(false);           // the drop-down under the box
  const [q, setQ] = useState(custom);
  const [sheetQ, setSheetQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const settled = useRef(false);                     // a choice was just made: the blur it causes must not commit again
  const name = (k: string) => { const c = categoryOf(k); return c ? (lang === "hi" ? c.hi : c.en) : ""; };
  const label = (k: string) => { const n = name(k); return custom ? (k && k !== "other" && n ? `${custom} · ${n}` : custom) : n; };
  const groupOf = (k: string) => categoryOf(k)?.group ?? "";

  // The owner's words are what the box edits, so a trade restored from a saved draft is typed over, not retyped.
  useEffect(() => { if (document.activeElement !== box.current) setQ(custom); }, [custom]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [open]);

  // A tap anywhere outside folds the drop-down — not a blur timer, which unmounted the rows under an Android tap
  // before its click landed (owner's call, 5 Oct 2026).
  useEffect(() => {
    if (!list) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setList(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [list]);

  // Suggestions under the box: the best 3 for what was typed.
  const suggestions = useMemo(() => suggestCategories(q, 3), [q]);

  const groups = useMemo(() => {
    const s = sheetQ.trim().toLowerCase();
    return CATEGORY_GROUPS.map((g) => ({
      g, items: CATEGORIES.filter((c) => c.group === g && (!s || c.en.toLowerCase().includes(s) || c.hi.includes(sheetQ.trim()) || c.key.includes(s) || aliasMatch(c.key, s))),
    })).filter((x) => x.items.length);
  }, [sheetQ]);

  const typedOk = (t: string) => t.trim().length >= 3 && !!onCustom;
  /** The listed trade the typed text names outright, if any: that one is picked, never kept as "own words". */
  const exactKey = suggestions.find((k) => exact(k, q)) ?? null;

  function pick(k: string) { onChange(k); setQ(""); }
  /** The typed words become the trade; the closest listed one goes along so the parent can keep its look. */
  function keepTyped(text: string) { const t = text.trim().slice(0, 40); if (t && onCustom) onCustom(t, suggestCategories(t, 1)[0]); }
  /** Blur, Done or Enter: what was typed is the trade — the listed one when it names it outright, else the owner's own words. */
  function commit() {
    if (exactKey) { if (exactKey !== value || custom) pick(exactKey); return; }
    const t = q.trim();
    if (typedOk(t) && t.slice(0, 40) !== custom) keepTyped(t);
  }
  /** Fold the drop-down and drop focus; the blur this causes must not commit again (the choice is already made). */
  function close() {
    setList(false);
    if (document.activeElement === box.current) { settled.current = true; box.current?.blur(); settled.current = false; }
  }
  function closeSheet() { setOpen(false); setSheetQ(""); }
  // The full list is the FULL list (owner, 2 Oct 2026: "kya yahi full list hai?"): it opens with an empty search,
  // every trade in its group; what was typed is committed first so it is still there if the sheet is closed unpicked.
  function openSheet() { commit(); close(); setSheetQ(""); setOpen(true); }

  const showDrop = list && q.trim().length > 0;
  const ownRow = typedOk(q) && !exactKey;            // the typed words come first — unless they ARE a listed trade
  const ownOn = q.trim().slice(0, 40) === custom;
  return (
    <>
      <div ref={root} className={`relative mt-1 ${className}`}>
        <div className={`flex items-center gap-2 rounded-xl border bg-surface px-3.5 py-3 text-[15px] ${typing ? "border-brand" : "border-border"}`}>
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input ref={box} value={typing ? q : label(value)} role="combobox" aria-expanded={showDrop} aria-autocomplete="list" aria-controls="cat-suggest" enterKeyHint="done"
            onFocus={() => { setTyping(true); setList(true); }}
            onBlur={() => { setTyping(false); if (!settled.current) commit(); }}
            onChange={(e) => { setQ(e.target.value); setList(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); close(); } else if (e.key === "Escape") close(); }}
            placeholder={typing ? (lang === "hi" ? "लिखें… जैसे school, मिठाई, doctor" : "Type… e.g. school, mithai, doctor") : placeholder}
            className={`w-full bg-transparent outline-none ${(value || custom) && !typing ? "font-medium text-ink" : "font-normal text-ink placeholder:text-faint"}`} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={openSheet} aria-label={lang === "hi" ? "पूरी सूची" : "Full list"} title={lang === "hi" ? "पूरी सूची" : "Full list"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface2"><ChevronDown className="h-4 w-4" /></button>
        </div>
        {showDrop && (
          <ul id="cat-suggest" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-float">
            {ownRow && (
              <li role="option" aria-selected={ownOn}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { keepTyped(q); close(); }}
                  className="flex w-full items-center justify-between gap-2 bg-brand-soft/60 px-3.5 py-2.5 text-left text-[14px] hover:bg-surface2">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{lang === "hi" ? <>मेरा काम “{q.trim()}” है — यही रखें</> : <>Use “{q.trim()}” as my trade</>}</span>
                    <span className="block text-[11px] text-muted">{lang === "hi" ? "सूची में नहीं — website ठीक इसी के लिए लिखेंगे" : "Not in the list — we will write the website for exactly this"}</span>
                  </span>
                  <Check className="h-4 w-4 shrink-0 text-brand" />
                </button>
              </li>
            )}
            {suggestions.map((k, i) => (
              <li key={k} role="option" aria-selected={k === value && !custom}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { pick(k); close(); }}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[14px] ${i === 0 ? (ownRow ? "border-t border-border" : "bg-brand-soft/60") : ""} hover:bg-surface2`}>
                  <span className="min-w-0"><span className="block font-medium text-ink">{name(k)}</span><span className="block text-[11px] text-muted">{groupOf(k)}</span></span>
                  {k === value && !custom && <Check className="h-4 w-4 shrink-0 text-brand" />}
                </button>
              </li>
            ))}
            {!suggestions.length && !ownRow && <li className="px-3.5 py-2.5 text-sm text-muted">{lang === "hi" ? "कुछ नहीं मिला — पूरी सूची देखें।" : "Nothing matches — see the full list."}</li>}
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={openSheet} className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-left text-[13px] font-semibold text-brand hover:bg-surface2">
                <List className="h-4 w-4" /> {lang === "hi" ? "पूरी सूची देखें" : "See the full list"}
              </button>
            </li>
          </ul>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={closeSheet}>
          <div role="dialog" aria-label="Choose what you do" onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-float sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
                <Search className="h-4 w-4 text-muted" />
                <input ref={search} value={sheetQ} onChange={(e) => setSheetQ(e.target.value)} placeholder={lang === "hi" ? `सभी ${CATEGORIES.length} काम — खोजें… जैसे मिठाई, डॉक्टर` : `All ${CATEGORIES.length} trades — search… e.g. mithai, doctor`}
                  className="w-full bg-transparent text-sm font-normal outline-none" />
              </div>
              <button type="button" onClick={closeSheet} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
            </div>
            <div role="listbox" className="overflow-y-auto overscroll-contain px-2 pb-4">
              {groups.map(({ g, items }) => (
                <div key={g}>
                  <p className="sticky top-0 bg-surface px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{g}</p>
                  {items.map((c) => {
                    const on = c.key === value;
                    return (
                      <button key={c.key} type="button" role="option" aria-selected={on} onClick={() => { pick(c.key); closeSheet(); }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] leading-snug ${on ? "bg-brand-soft font-semibold text-brand-ink" : "font-normal text-ink hover:bg-surface2"}`}>
                        <span>{lang === "hi" ? c.hi : c.en}</span>
                        {on && <Check className="h-4 w-4 text-brand" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!groups.length && (
                <div className="p-6 text-center text-sm text-muted">
                  <p>{lang === "hi" ? "कुछ नहीं मिला — सबसे मिलता-जुलता चुनें।" : "Nothing found — pick the closest one."}</p>
                  {typedOk(sheetQ) && <button type="button" onClick={() => { keepTyped(sheetQ); closeSheet(); }} className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"><PenLine className="h-4 w-4" /> {lang === "hi" ? `“${sheetQ.trim()}” ही रखें` : `Use “${sheetQ.trim()}”`}</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
