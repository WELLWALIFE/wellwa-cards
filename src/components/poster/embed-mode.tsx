"use client";
// A poster screen opened INSIDE another screen (Website edit shows Products, Timings & address, UPI … in its own tabs; owner,
// 25 Oct 2026: "saari cheez ek hi page par"). Inside a frame the app's own bars are hidden (globals.css html[data-embed]), the
// page's height goes up to the parent so the frame grows with it, and nothing scrolls twice.
import { useEffect } from "react";

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
