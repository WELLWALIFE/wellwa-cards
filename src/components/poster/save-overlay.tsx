"use client";
// The Save button and its message, over the live window's bottom-left corner (owner, 25 Oct 2026: take the save bar off the bottom,
// give the work area the room). "Saved" goes by itself after a moment; an error stays longer.
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

export function SaveOverlay({ show, dirty, busy, hi, note, onSave }: {
  show: boolean; dirty: boolean; busy: boolean; hi: boolean; note: { text: string; bad: boolean } | null; onSave: () => void;
}) {
  const [shown, setShown] = useState<{ text: string; bad: boolean } | null>(null);
  useEffect(() => {
    setShown(note);
    if (!note) return;
    const t = setTimeout(() => setShown(null), note.bad ? 7000 : 2800);
    return () => clearTimeout(t);
  }, [note]);
  return (
    <>
      {shown && <p role={shown.bad ? "alert" : "status"} className={`pointer-events-none absolute inset-x-2 bottom-12 rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-white shadow-card ${shown.bad ? "bg-danger/95" : "bg-good/95"}`}>{shown.text}</p>}
      {show && (dirty || busy
        ? <button type="button" onClick={onSave} disabled={busy} className="absolute bottom-2 left-2 rounded-full grad-brand px-5 py-2 text-sm font-bold text-white shadow-card disabled:opacity-60">{busy ? "…" : hi ? "Save करें" : "Save"}</button>
        : <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white"><Check className="h-3.5 w-3.5" /> {hi ? "सब save है" : "All saved"}</span>)}
    </>
  );
}
