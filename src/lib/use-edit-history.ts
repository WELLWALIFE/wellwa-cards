"use client";
// Undo / Redo for an edit screen's own changes (owner, 26 Oct 2026: "patti par dono button — undo aur redo, center me"). The screen
// passes its working copy as a string (JSON); every change is a step back, up to 50. Saved = a fresh start (`reset` changes).
import { useEffect, useRef, useState } from "react";

export type EditHistory = { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };

export function useEditHistory(value: string | null, apply: (v: string) => void, reset: unknown): EditHistory {
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const last = useRef<string | null>(null);
  const skip = useRef(false);
  const applyRef = useRef(apply);
  useEffect(() => { applyRef.current = apply; });
  // A fresh start after loading or saving.
  useEffect(() => { last.current = null; setPast([]); setFuture([]); }, [reset]);
  useEffect(() => {
    if (value === null) return;
    if (skip.current) { skip.current = false; last.current = value; return; }
    const prev = last.current;
    last.current = value;
    if (prev !== null && prev !== value) { setPast((p) => [...p.slice(-49), prev]); setFuture([]); }
  }, [value]);
  const undo = () => {
    if (!past.length || last.current === null) return;
    const back = past[past.length - 1], now = last.current;
    setPast(past.slice(0, -1)); setFuture([...future, now]);
    skip.current = true; last.current = back; applyRef.current(back);
  };
  const redo = () => {
    if (!future.length || last.current === null) return;
    const fwd = future[future.length - 1], now = last.current;
    setFuture(future.slice(0, -1)); setPast([...past, now]);
    skip.current = true; last.current = fwd; applyRef.current(fwd);
  };
  return { canUndo: past.length > 0, canRedo: future.length > 0, undo, redo };
}
