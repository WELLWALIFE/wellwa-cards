"use client";
// A poster screen opened INSIDE another screen (Website edit shows Products, Timings & address, UPI … in its own tabs; owner,
// 25 Oct 2026: "saari cheez ek hi page par"). Inside a frame the app's own bars are hidden (globals.css html[data-embed]), the
// page's height goes up to the parent so the frame grows with it, and nothing scrolls twice.
import { useEffect, useRef } from "react";

export const isEmbedded = () => { try { return typeof window !== "undefined" && window.self !== window.top; } catch { return true; } };

/** Tell the parent screen something (same origin only). */
export function toParent(msg: Record<string, unknown>) {
  try { if (isEmbedded()) window.parent.postMessage(msg, window.location.origin); } catch { /* ignore */ }
}

export function EmbedMode() {
  useEffect(() => {
    if (!isEmbedded()) return;
    document.documentElement.dataset.embed = "1";
    let last = 0;
    // The content's own bottom, not the document's height: the app shell stretches to the frame, which would grow the frame forever.
    const send = () => { const main = document.querySelector("main"); let b = 0; for (const el of Array.from(main?.children ?? [])) { const r = el.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom + window.scrollY); } const h = Math.ceil(b + 16); if (Math.abs(h - last) > 2) { last = h; toParent({ type: "embed-height", h }); } };
    send();
    const ro = "ResizeObserver" in window ? new ResizeObserver(send) : null;
    if (document.querySelector("main")) ro?.observe(document.querySelector("main")!);
    const t = setInterval(send, 800);
    return () => { ro?.disconnect(); clearInterval(t); };
  }, []);
  return null;
}

/** A screen with an add / edit form of its own (Products, Reviews), opened inside Website edit: the ONE Save on the editor's top bar
 *  saves the open form (owner, 25 Nov 2026: "Products / Reviews ko ek hi Save ke neeche lana" — these two kept their own Save button
 *  inside the form, the last screens that did). `sig` is the open form as text, null when no form is open: the top Save lights up as
 *  soon as the form differs from how it opened. `save` is the screen's own save; `saved` goes up by one each time a save has landed;
 *  `error` is what the screen says when a save was refused. Outside a frame this does nothing. */
export function useEmbedForm(sig: string | null, save: () => void, saved: number, error: string) {
  const base = useRef<string | null>(null);
  const run = useRef(save);
  useEffect(() => { run.current = save; });
  // A save has landed: the form that follows (closed, or a fresh "add another") is the new starting point.
  useEffect(() => { if (!isEmbedded() || !saved) return; base.current = null; toParent({ type: "embed-saved" }); }, [saved]);
  useEffect(() => {
    if (!isEmbedded()) return;
    if (sig === null) base.current = null; else if (base.current === null) base.current = sig;
    toParent({ type: "embed-dirty", dirty: sig !== null && sig !== base.current });
  }, [sig, saved]);
  useEffect(() => {
    if (!isEmbedded()) return;
    const on = (e: MessageEvent) => { if (e.origin === window.location.origin && e.source === window.parent && (e.data as { type?: string })?.type === "embed-save") run.current(); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  useEffect(() => { if (isEmbedded() && error) toParent({ type: "embed-error", text: error }); }, [error]);
}
