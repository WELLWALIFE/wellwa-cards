"use client";
// The Save button and its message, over the live window's bottom-left corner (owner, 25 Oct 2026: take the save bar off the bottom,
// give the work area the room). "Saved" goes by itself after a moment; an error stays longer.
import { useEffect, useState } from "react";
import { Check, ChevronLeft, Maximize2, Minimize2, RotateCcw } from "lucide-react";

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

export type SaveProps = { show: boolean; dirty: boolean; busy: boolean; note: { text: string; bad: boolean } | null; onSave: () => void; /** For a few seconds after a Save: put it back. */ undo?: () => void };

/** The slim bar under the live window (owner, 25 Oct 2026: "aur easy aur professional"): Back on the left, then what the window is,
 *  and on the right "See it", Big / Small and Save. Nothing sits on the picture itself any more. */
export function WindowBar({ hi, onBack, see, big, onBig, save }: { hi: boolean; onBack: () => void; see: React.ReactNode; big: boolean; onBig: () => void; save: SaveProps }) {
  const [shown, setShown] = useState<{ text: string; bad: boolean } | null>(null);
  useEffect(() => {
    setShown(save.note);
    if (!save.note) return;
    const t = setTimeout(() => setShown(null), save.note.bad ? 7000 : 2800);
    return () => clearTimeout(t);
  }, [save.note]);
  const icon = "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink active:scale-95";
  return (
    <div className="relative flex items-center gap-2 border-t border-border bg-surface px-2 py-1.5">
      {shown && <p role={shown.bad ? "alert" : "status"} className={`pointer-events-none absolute inset-x-2 bottom-[calc(100%+8px)] rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-white shadow-card ${shown.bad ? "bg-danger/95" : "bg-good/95"}`}>{shown.text}</p>}
      <button type="button" onClick={onBack} aria-label={hi ? "पीछे" : "Back"} className={icon}><ChevronLeft className="h-5 w-5" /></button>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-muted"><span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-good" /> {hi ? "Live" : "Live"}</span>
      <span className="flex-1" />
      {see}
      <button type="button" onClick={onBig} aria-label={big ? (hi ? "छोटा करें" : "Make small") : (hi ? "बड़ा करें" : "Make big")} className={icon}>{big ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
      {save.undo && !save.dirty && !save.busy && <button type="button" onClick={save.undo} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-ink"><RotateCcw className="h-3.5 w-3.5" /> {hi ? "Undo" : "Undo"}</button>}
      {(save.show || save.undo) && (save.dirty || save.busy
        ? <button type="button" onClick={save.onSave} disabled={save.busy} className="h-8 shrink-0 rounded-full grad-brand px-4 text-sm font-bold text-white shadow-card disabled:opacity-60">{save.busy ? "…" : hi ? "Save करें" : "Save"}</button>
        : !save.undo && <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-good/10 px-3 text-[11px] font-semibold text-good"><Check className="h-3.5 w-3.5" /> {hi ? "Saved" : "Saved"}</span>)}
    </div>
  );
}
/** The "See card / See it live" link as it sits in the bar. */
export const seeCls = "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-brand-ink";
