"use client";
// The notice as visitors see it (src/lib/notice.ts): a bar under the header, and / or a pop-up once per visit.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Megaphone, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { activeNotice, untilLabel } from "@/lib/notice";
import { WelcomePopup } from "@/components/card-view";

const go = (url: string) => { if (url.startsWith("#")) { document.getElementById(url.slice(1))?.scrollIntoView({ behavior: "smooth" }); return; } window.open(url, url.startsWith("/") ? "_self" : "_blank"); };

export function NoticeBar({ card, hi = false, compact = false }: { card: Card; hi?: boolean; compact?: boolean }) {
  const n = activeNotice(card);
  if (!n || n.mode === "popup") return null;
  const till = untilLabel(n.until, hi);
  return (
    <div className={`flex items-center justify-center gap-2 px-4 ${compact ? "py-2 text-[12.5px]" : "py-2.5 text-sm"} font-semibold text-white`} style={{ background: "linear-gradient(90deg, var(--p-deep, #12144a), var(--p-mid, #2f4bd8))" }}>
      <Megaphone className="h-4 w-4 shrink-0 opacity-90" />
      <span className="min-w-0 truncate">{n.text}{n.sub ? <span className="font-normal opacity-90"> · {n.sub}</span> : null}{till ? <span className="font-normal opacity-75"> · {till}</span> : null}</span>
      {n.label && n.url && <button type="button" onClick={() => go(n.url!)} className="shrink-0 rounded-full bg-white/95 px-3 py-1 text-[12px] font-bold" style={{ color: "var(--p-deep, #12144a)" }}>{n.label}</button>}
    </div>
  );
}

export function NoticePopup({ card, theme, active, hi = false }: { card: Card; theme: string; active: string; hi?: boolean }) {
  const n = activeNotice(card);
  const [show, setShow] = useState(false);
  const key = n ? `ne-notice-seen:${card.username}:${n.at}` : "";
  useEffect(() => {
    if (!n || n.mode === "bar" || n.form) return;
    try { if (sessionStorage.getItem(key)) return; } catch { /* show once anyway */ }
    const t = setTimeout(() => { setShow(true); try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } }, 1200);
    return () => clearTimeout(t);
  }, [n, key]);
  if (!n || n.mode === "bar") return null;
  // A notice that asks for name and number: the lead pop-up, with this notice's words.
  if (n.form) return <WelcomePopup card={{ ...card, popup: { enabled: true, title: n.text, subtitle: n.sub ?? "", ctaLabel: n.label || (hi ? "मुझे बताएँ" : "Tell me more") } }} theme={theme} active={active} />;
  if (!show) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setShow(false)}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-[#101427] shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {n.imageUrl && <img src={n.imageUrl} alt="" className="max-h-72 w-full object-cover" />}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: theme }}><Megaphone className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-snug">{n.text}</p>
              {n.sub && <p className="mt-1 text-sm text-[#475569]">{n.sub}</p>}
              {n.until && <p className="mt-1 text-xs text-[#64748b]">{untilLabel(n.until, hi)}</p>}
            </div>
            <button type="button" onClick={() => setShow(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-[#64748b] hover:bg-black/5"><X className="h-4 w-4" /></button>
          </div>
          {n.label && n.url && <button type="button" onClick={() => { setShow(false); go(n.url!); }} className="mt-4 w-full rounded-xl py-3 text-base font-semibold text-white" style={{ background: theme }}>{n.label}</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
