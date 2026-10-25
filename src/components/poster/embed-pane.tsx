"use client";
// A poster screen shown inside an edit page's tab (Products, Timings & address …): the frame grows with the screen, the screen's
// unsaved copy goes to the page's live window, and Save / Cancel there come back here (components/poster/embed-mode.tsx).
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/types";

export type EmbedLive = { card: Card; page?: string; focus?: { top?: boolean; text?: string } };

export function EmbedPane({ src, title, onLive, onDone }: { src: string; title: string; onLive: (v: EmbedLive) => void; onDone: (saved: boolean) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(640);
  const [n, setN] = useState(0);
  const cb = useRef({ onLive, onDone });
  useEffect(() => { cb.current = { onLive, onDone }; });
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !ref.current || e.source !== ref.current.contentWindow) return;
      const m = e.data as { type?: string; h?: number; saved?: boolean } & Partial<EmbedLive>;
      if (m?.type === "embed-height" && typeof m.h === "number") setH(Math.max(320, Math.min(m.h, 20000)));
      else if (m?.type === "embed-live" && m.card) cb.current.onLive({ card: m.card, page: m.page, focus: m.focus });
      else if (m?.type === "embed-done") { cb.current.onDone(!!m.saved); setN((x) => x + 1); }   // the screen opens again, fresh
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  return <iframe key={`${src}-${n}`} ref={ref} title={title} src={src} className="-mx-4 block w-[calc(100%+2rem)] border-0" style={{ height: h }} />;
}
