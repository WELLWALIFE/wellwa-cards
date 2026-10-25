"use client";
// A poster screen shown inside an edit page's tab (Products, Timings & address …): the frame grows with the screen, the screen's
// unsaved copy goes to the page's live window, and Save / Cancel there come back here (components/poster/embed-mode.tsx).
import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/types";

export type EmbedLive = { card: Card; page?: string; focus?: { top?: boolean; text?: string } };

export function EmbedPane({ src, title, onLive, onDone, onDirty, onSaved, onError, saveTick = 0 }: {
  src: string; title: string; onLive: (v: EmbedLive) => void; onDone: (saved: boolean) => void;
  /** The screen has changes not saved yet (the full editor): the page's own Save bar saves them (bumps `saveTick`). */
  onDirty?: (dirty: boolean) => void; onSaved?: () => void; onError?: (text: string) => void; saveTick?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(640);
  const [n, setN] = useState(0);
  /** The screen inside has drawn itself (its first height came): until then a light outline of a form shows, not an empty space. */
  const [readyFor, setReadyFor] = useState("");
  const key = `${src}-${n}`;
  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; });
  const cb = useRef({ onLive, onDone, onDirty, onSaved, onError });
  useEffect(() => { cb.current = { onLive, onDone, onDirty, onSaved, onError }; });
  useEffect(() => { if (saveTick > 0) try { ref.current?.contentWindow?.postMessage({ type: "embed-save" }, window.location.origin); } catch { /* ignore */ } }, [saveTick]);
  useEffect(() => () => cb.current.onDirty?.(false), [src]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !ref.current || e.source !== ref.current.contentWindow) return;
      const m = e.data as { type?: string; h?: number; saved?: boolean } & Partial<EmbedLive>;
      if (m?.type === "embed-height" && typeof m.h === "number") { setH(Math.max(320, Math.min(m.h, 20000))); setReadyFor(keyRef.current); }
      else if (m?.type === "embed-live" && m.card) cb.current.onLive({ card: m.card, page: m.page, focus: m.focus });
      else if (m?.type === "embed-dirty") cb.current.onDirty?.(!!(m as { dirty?: boolean }).dirty);
      else if (m?.type === "embed-saved") cb.current.onSaved?.();
      else if (m?.type === "embed-error") cb.current.onError?.(String((m as { text?: string }).text ?? ""));
      else if (m?.type === "embed-done") { cb.current.onDone(!!m.saved); setN((x) => x + 1); }   // the screen opens again, fresh
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  const ready = readyFor === key;
  return (
    <div className="relative">
      <iframe key={key} ref={ref} title={title} src={src} onLoad={() => setTimeout(() => setReadyFor(key), 1500)}
        className={`-mx-4 block w-[calc(100%+2rem)] border-0 transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`} style={{ height: ready ? h : 420 }} />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 space-y-3" aria-label="Loading" role="status">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse space-y-2 rounded-2xl border border-border bg-surface p-4">
              <div className="h-3 w-1/3 rounded-full bg-surface2" />
              <div className="h-10 w-full rounded-xl bg-surface2" />
              {i === 0 && <div className="h-20 w-full rounded-xl bg-surface2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
