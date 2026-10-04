"use client";
// The Shubhora strip at the foot of every card and website (owner's call, 2 Oct 2026): a thin bar with a rotating
// line — "this card was made on Shubhora", "make yours free" — that opens a small sheet from the bottom with three
// points and two buttons: "Know more" (the owner's Shubhora page, /c/<user>/shubhora) and "Make mine free" (the
// sign-up, with the owner as introducer). It replaces the big blue "Get your own Shubhora" box, which nobody
// understood. Shown on every free card; on a paid card only when its owner also sells Shubhora ("Both").
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ChevronRight, X } from "lucide-react";
import { trackClick } from "@/lib/track";

const LOGO = "/art/brand/shubhora-logo.png";
const LINES = {
  en: ["This card is made on Shubhora", "Make your own website + card — FREE", "Daily poster · WhatsApp AI replies"],
  hi: ["ये card Shubhora पर बना है", "अपनी website + card बनाएँ — FREE", "रोज़ का poster · WhatsApp पर AI जवाब"],
};
const SHEET = {
  en: { title: "This website and visiting card are made on Shubhora", body: "You can make yours too — in 5 minutes, free for 1 year.", points: ["Digital card + website on your own link", "A new poster with your name every morning", "AI answers your customers on WhatsApp, every chat saved as a lead"], more: "Know more", make: "Make mine free — now", close: "Close" },
  hi: { title: "ये website और visiting card Shubhora पर बने हैं", body: "आप भी अपना बना सकते हैं — 5 मिनट में, 1 साल free।", points: ["अपने link पर digital card + website", "रोज़ सुबह आपके नाम का नया poster", "WhatsApp पर AI customers को जवाब देता है, हर chat lead में save"], more: "और जानें", make: "अभी free बनाएँ", close: "बंद करें" },
};

export function ShubhoraBar({ username, joinHref, moreHref, lang, aboveBar = false, free = true }: {
  /** A free card wears the FREE badge; a paid "Both" card carries the strip without it. */
  free?: boolean;
  /** The card's username (click counts). */
  username: string;
  /** The sign-up with this owner as introducer. */
  joinHref: string;
  /** The owner's Shubhora page — the full story, with the same introducer. */
  moreHref: string;
  /** "en" → English, anything else → Hindi. */
  lang: string;
  /** The website's phone action bar sits at the foot on small screens: the strip goes just above it there. */
  aboveBar?: boolean;
}) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const L = lang === "en" ? LINES.en : LINES.hi;
  const S = lang === "en" ? SHEET.en : SHEET.hi;
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % L.length), 4000); return () => clearInterval(t); }, [L.length]);
  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => setUp(true));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", esc); };
  }, [open]);
  function close() { setUp(false); setTimeout(() => setOpen(false), 220); }
  if (!mounted) return <div aria-hidden style={{ height: 44 }} />;
  const bottom = aboveBar ? "bottom-[calc(52px+env(safe-area-inset-bottom))] md:bottom-0" : "bottom-0";
  return (
    <>
      {/* room at the foot of the page, so the strip never covers the last line */}
      <div aria-hidden style={{ height: 44 }} />
      {createPortal(
        <>
          <button type="button" onClick={() => { setOpen(true); trackClick(username, "shubhora-bar"); }}
            className={`fixed inset-x-0 ${bottom} z-40 flex items-center justify-center gap-2 px-3 text-[13px] font-semibold text-white`}
            style={{ height: 40, background: "linear-gradient(90deg, #12144a, #2f4bd8)", paddingBottom: aboveBar ? 0 : "env(safe-area-inset-bottom)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="" className="h-5 w-5 rounded-md bg-white object-contain p-0.5" />
            <span key={i} className="truncate" style={{ animation: "shubhora-fade .4s ease" }}>{L[i]}</span>
            {free && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]"><span className="text-[#ffd54a]">FREE</span></span>}
            <ChevronRight className="h-4 w-4 opacity-80" />
          </button>
          {open && (
            <div className="fixed inset-0 z-[120]" onClick={close}>
              <div className={`absolute inset-0 bg-black/50 transition-opacity ${up ? "opacity-100" : "opacity-0"}`} />
              <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
                className={`absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 text-[#111] shadow-float transition-transform duration-300 ease-out ${up ? "translate-y-0" : "translate-y-full"}`}
                style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                <button type="button" onClick={close} aria-label={S.close} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/5"><X className="h-5 w-5" /></button>
                <div className="flex items-center gap-3 pr-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={LOGO} alt="Shubhora" className="h-11 w-11 rounded-xl border border-black/10 object-contain p-1" />
                  <p className="text-base font-bold leading-snug">{S.title}</p>
                </div>
                <p className="mt-2 text-sm text-black/70">{S.body}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {S.points.map((p) => <li key={p} className="flex items-start gap-2"><span className="text-[#2f4bd8]">✓</span><span>{p}</span></li>)}
                </ul>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a href={moreHref} onClick={() => trackClick(username, "shubhora-more")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2f4bd8] py-3 text-sm font-semibold text-[#2f4bd8]">{S.more}</a>
                  <a href={joinHref} onClick={() => trackClick(username, "shubhora-join")} className="inline-flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: "#2f4bd8" }}>{S.make} <ArrowRight className="h-4 w-4" /></a>
                </div>
              </div>
            </div>
          )}
          <style>{`@keyframes shubhora-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
        </>,
        document.body,
      )}
    </>
  );
}
