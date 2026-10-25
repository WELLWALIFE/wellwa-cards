"use client";
// The live window on top of an edit screen (owner, 24 Oct 2026: "upar ek chota window jo live dikhata hai aur niche scrollable options …
// jo change hua wo hi portion apne aap window me dikhe"). It stays under the app's top bar while the options scroll, shows the working
// copy of the website (or the phone card) through the real renderer (/preview/site, read from localStorage under its own key), goes
// to the part `focus` names after each change, and opens big or small with one tap. Nothing is saved from here.
import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { Card } from "@/lib/types";
import { isEmbedded, toParent } from "@/components/poster/embed-mode";
import { WindowBar, type EditSwitch, type SaveProps } from "@/components/poster/save-overlay";
import type { EditHistory } from "@/lib/use-edit-history";

export type LiveFocus = { top?: boolean; text?: string; body?: boolean } | null;
const SITE_W = 1280, CARD_W = 400;

export function LiveWindow({ card, k, view = "site", focus, hi, page, overlay, bar, onEditTarget }: {
  /** The ✏️ Edit chips in the preview: which part was tapped (preview/site/view.tsx). */ onEditTarget?: (target: { kind: string; blockId?: string; text?: string }) => void;
  /** The bar under the window: Back, See it, Big, Save (edit screens). */ bar?: { onBack: () => void; see: React.ReactNode; save: SaveProps; switcher?: EditSwitch; history?: EditHistory };
  /** Shown over the window, bottom left (the Save button and its message: owner, 25 Oct 2026, "save wali patti hatao"). */ overlay?: React.ReactNode;
  card: Card | null; /** The localStorage key the preview reads (letters, digits, dashes). */ k: string;
  /** The website page to open (the change is on it, e.g. "contact" for the address); unset = home. */ page?: string;
  view?: "site" | "card"; /** What to show after this change: the top, or the section / line with this text. */ focus?: LiveFocus; hi: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState(false);
  const [scale, setScale] = useState(0.3);
  // The frame is one screen of the website (the window's own height, unscaled), never the whole page: a hero made "one screen tall"
  // grew with a page-tall frame and pushed its words thousands of pixels down (found on the live walk, 24 Oct 2026). The website
  // scrolls inside it, and a change scrolls the preview itself to the part (preview/site/view.tsx).
  const [boxH, setBoxH] = useState(220);
  const w = view === "card" ? CARD_W : SITE_W;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => { if (el.clientWidth) setScale(Math.min(1, el.clientWidth / w)); if (el.clientHeight) setBoxH(el.clientHeight); };
    fit();
    const ro = "ResizeObserver" in window ? new ResizeObserver(fit) : null;
    ro?.observe(el); window.addEventListener("resize", fit);
    return () => { ro?.disconnect(); window.removeEventListener("resize", fit); };
  }, [w, card]);
  const frameH = Math.round(boxH / scale);
  const post = (m: unknown) => { try { frame.current?.contentWindow?.postMessage(m, window.location.origin); } catch { /* ignore */ } };
  // Every change: the copy to the preview, then where to look.
  const sig = card ? JSON.stringify(card) : "";
  const focusSig = focus ? JSON.stringify(focus) : "";
  // Shown inside Website edit: that screen's own window shows the change (one window, not two).
  const [inside, setInside] = useState(false);
  useEffect(() => { setInside(isEmbedded()); }, []);
  useEffect(() => {
    if (!sig || !inside) return;
    toParent({ type: "embed-live", card: JSON.parse(sig), ...(focusSig ? { focus: JSON.parse(focusSig) } : {}), ...(page ? { page } : {}), view });
  }, [sig, focusSig, inside, page, view]);
  useEffect(() => {
    if (!sig || inside) return;
    try { localStorage.setItem(k, sig); } catch { /* full or private */ }
    post(`preview:${k}`);
    if (focusSig) post({ type: "preview-focus", key: k, ...JSON.parse(focusSig) });
  }, [sig, focusSig, k, inside]);
  const editRef = useRef(onEditTarget);
  useEffect(() => { editRef.current = onEditTarget; });
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { type?: string; key?: string; target?: { kind: string } } | null;
      if (e.origin !== window.location.origin || !d || d.type !== "preview-edit" || d.key !== k || !d.target) return;
      editRef.current?.(d.target);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [k]);
  if (!card || inside) return null;
  return (
    <div className="sticky z-10 -mx-4 bg-surface px-4 pb-2 pt-1" style={{ top: "calc(env(safe-area-inset-top) + var(--help-banner, 0px))" }}>
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-card">
        <div ref={box} className="overflow-hidden bg-white transition-[height] duration-300" style={{ height: big ? "68svh" : "30svh" }}>
          <div className="relative" style={{ width: Math.round(w * scale), height: boxH }}>
            <iframe ref={frame} title={hi ? "Live preview" : "Live preview"} src={`/preview/site?k=${k}${view === "card" ? "&view=card" : ""}${onEditTarget ? "&tap=1" : ""}${page && view !== "card" ? `&page=${encodeURIComponent(page)}` : ""}`}
              onLoad={() => post(`preview:${k}`)} className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: frameH, border: 0, transform: `scale(${scale})` }} />
          </div>
        </div>
        {overlay}
        {!bar && <>
        <span className="pointer-events-none absolute left-12 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">● Live</span>
        <button type="button" onClick={() => setBig((b) => !b)} aria-label={big ? (hi ? "छोटा करें" : "Make small") : (hi ? "बड़ा करें" : "Make big")}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
          {big ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />} {big ? (hi ? "छोटा" : "Small") : (hi ? "बड़ा" : "Big")}
        </button>
        </>}
        {bar && <WindowBar hi={hi} onBack={bar.onBack} see={bar.see} big={big} onBig={() => setBig((b) => !b)} save={bar.save} switcher={bar.switcher} history={bar.history} />}
      </div>
    </div>
  );
}
