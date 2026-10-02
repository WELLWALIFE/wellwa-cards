"use client";

// "What do you do?" — type a few letters and pick one of the 2-3 trades suggested underneath (owner's call,
// 2 Oct 2026: "search kare, suggested name 2/3 aa jaaye, user ek select kar le"). The full grouped list is one
// tap away for anyone who would rather browse; it opens as a bottom sheet on phones and a centred panel on computers.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, List, Search, X } from "lucide-react";
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

export function CategoryPicker({ value, onChange, lang = "en", placeholder = "Choose…", className = "" }: {
  value: string; onChange: (key: string) => void; lang?: "en" | "hi"; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);           // the full list (sheet)
  const [typing, setTyping] = useState(false);       // the inline search box has focus
  const [q, setQ] = useState("");
  const [sheetQ, setSheetQ] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const label = (k: string) => { const c = categoryOf(k); return c ? (lang === "hi" ? c.hi : c.en) : ""; };
  const groupOf = (k: string) => categoryOf(k)?.group ?? "";

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [open]);

  // Suggestions under the box: the best 3 for what was typed.
  const suggestions = useMemo(() => suggestCategories(q, 3), [q]);

  const groups = useMemo(() => {
    const s = sheetQ.trim().toLowerCase();
    return CATEGORY_GROUPS.map((g) => ({
      g, items: CATEGORIES.filter((c) => c.group === g && (!s || c.en.toLowerCase().includes(s) || c.hi.includes(sheetQ.trim()) || c.key.includes(s) || aliasMatch(c.key, s))),
    })).filter((x) => x.items.length);
  }, [sheetQ]);

  function pick(k: string) { onChange(k); setOpen(false); setTyping(false); setQ(""); setSheetQ(""); box.current?.blur(); }
  // The full list is the FULL list (owner, 2 Oct 2026: "kya yahi full list hai?"): it opens with an empty search,
  // every trade in its group; the typed letters stay in the box above for the suggestions.
  function openSheet() { setSheetQ(""); setTyping(false); setOpen(true); }

  const showDrop = typing && (q.trim().length > 0);
  return (
    <>
      <div className={`relative mt-1 ${className}`}>
        <div className={`flex items-center gap-2 rounded-xl border bg-surface px-3.5 py-3 text-[15px] ${typing ? "border-brand" : "border-border"}`}>
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input ref={box} value={typing ? q : (value ? label(value) : "")} role="combobox" aria-expanded={showDrop} aria-autocomplete="list" aria-controls="cat-suggest"
            onFocus={() => { setTyping(true); setQ(""); }}
            onBlur={() => setTimeout(() => setTyping(false), 150)}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) { e.preventDefault(); pick(suggestions[0]); } if (e.key === "Escape") { setTyping(false); box.current?.blur(); } }}
            placeholder={typing ? (lang === "hi" ? "लिखें… जैसे school, मिठाई, doctor" : "Type… e.g. school, mithai, doctor") : placeholder}
            className={`w-full bg-transparent outline-none ${value && !typing ? "font-medium text-ink" : "font-normal text-ink placeholder:text-faint"}`} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={openSheet} aria-label={lang === "hi" ? "पूरी सूची" : "Full list"} title={lang === "hi" ? "पूरी सूची" : "Full list"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface2"><ChevronDown className="h-4 w-4" /></button>
        </div>
        {showDrop && (
          <ul id="cat-suggest" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-float">
            {suggestions.map((k, i) => (
              <li key={k} role="option" aria-selected={k === value}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(k)}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[14px] ${i === 0 ? "bg-brand-soft/60" : ""} hover:bg-surface2`}>
                  <span className="min-w-0"><span className="block font-medium text-ink">{label(k)}</span><span className="block text-[11px] text-muted">{groupOf(k)}</span></span>
                  {k === value && <Check className="h-4 w-4 shrink-0 text-brand" />}
                </button>
              </li>
            ))}
            {!suggestions.length && <li className="px-3.5 py-2.5 text-sm text-muted">{lang === "hi" ? "कुछ नहीं मिला — पूरी सूची देखें।" : "Nothing matches — see the full list."}</li>}
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={openSheet} className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-left text-[13px] font-semibold text-brand hover:bg-surface2">
                <List className="h-4 w-4" /> {lang === "hi" ? "पूरी सूची देखें" : "See the full list"}
              </button>
            </li>
          </ul>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Choose what you do" onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-float sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
                <Search className="h-4 w-4 text-muted" />
                <input ref={search} value={sheetQ} onChange={(e) => setSheetQ(e.target.value)} placeholder={lang === "hi" ? `सभी ${CATEGORIES.length} काम — खोजें… जैसे मिठाई, डॉक्टर` : `All ${CATEGORIES.length} trades — search… e.g. mithai, doctor`}
                  className="w-full bg-transparent text-sm font-normal outline-none" />
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-5 w-5" /></button>
            </div>
            <div role="listbox" className="overflow-y-auto overscroll-contain px-2 pb-4">
              {groups.map(({ g, items }) => (
                <div key={g}>
                  <p className="sticky top-0 bg-surface px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">{g}</p>
                  {items.map((c) => {
                    const on = c.key === value;
                    return (
                      <button key={c.key} type="button" role="option" aria-selected={on} onClick={() => pick(c.key)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] leading-snug ${on ? "bg-brand-soft font-semibold text-brand-ink" : "font-normal text-ink hover:bg-surface2"}`}>
                        <span>{lang === "hi" ? c.hi : c.en}</span>
                        {on && <Check className="h-4 w-4 text-brand" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!groups.length && <p className="p-6 text-center text-sm text-muted">{lang === "hi" ? "कुछ नहीं मिला — सबसे मिलता-जुलता चुनें।" : "Nothing found — pick the closest one."}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
