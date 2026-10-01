"use client";

// "What do you do?" — a searchable, grouped list in the app's own type instead of the phone's plain system list.
// Opens as a bottom sheet on phones and a centred panel on computers.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_GROUPS, categoryOf } from "@/lib/poster-categories";
// The everyday words live with the trade guesser (the website peek uses the same list at set-up).
import { ALIASES } from "@/lib/category-match";

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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const label = (k: string) => { const c = categoryOf(k); return c ? (lang === "hi" ? c.hi : c.en) : ""; };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [open]);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATEGORY_GROUPS.map((g) => ({
      g, items: CATEGORIES.filter((c) => c.group === g && (!s || c.en.toLowerCase().includes(s) || c.hi.includes(q.trim()) || c.key.includes(s) || aliasMatch(c.key, s))),
    })).filter((x) => x.items.length);
  }, [q]);

  function pick(k: string) { onChange(k); setOpen(false); setQ(""); }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="listbox" aria-expanded={open}
        className={`mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-3 text-left text-[15px] ${className}`}>
        <span className={value ? "font-medium text-ink" : "text-faint font-normal"}>{value ? label(value) : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Choose what you do" onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-float sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
                <Search className="h-4 w-4 text-muted" />
                <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === "hi" ? "खोजें… जैसे मिठाई, डॉक्टर" : "Search… e.g. mithai, doctor, parlour"}
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
