"use client";
// The small "?" beside a field (owner, 23 Nov 2026: "question mark ke icon ke saath field wise how to use"): one tap opens a short
// note on what to type and why; tap again or anywhere else to close. Inside a <label> it never moves the focus to the input.
import { useEffect, useRef, useState } from "react";

export function FieldTip({ en, hi, lang }: { en: string; hi: string; lang: "hi" | "en" | string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  return (
    <span ref={ref} className="relative ml-1 inline-flex align-middle">
      <button type="button" aria-label={lang === "en" ? "How to fill this" : "इसे कैसे भरें"} aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] font-bold leading-none ${open ? "border-brand bg-brand text-white" : "border-border bg-surface text-muted"}`}>?</button>
      {open && (
        <span role="note" className="absolute left-1/2 top-5 z-30 w-60 -translate-x-1/2 rounded-xl border border-border bg-surface p-2.5 text-left text-[12px] font-normal normal-case leading-snug text-ink shadow-lg">
          {lang === "en" ? en : hi}
        </span>
      )}
    </span>
  );
}
