"use client";
// Opening the live card from inside the installed app (PWA, standalone) used to navigate the app window to the card:
// no back button, no close, and the phone reopened the app on the card the next time (owner's report, 30 Sep 2026).
// In a browser tab a card link still opens a new tab (it has its own back / close). In the installed app it opens
// this sheet over the app instead — the app never leaves its own screen.
import { useEffect, useState, type ReactNode } from "react";
import { X, Share2, Check } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

/** Is this page running as the installed app (no browser chrome around it)? */
export function isStandaloneApp(): boolean {
  try { return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
}

/** A link to the live card: a new tab in the browser, a sheet with a close button in the installed app. */
export function CardLink({ href, className, children, title }: { href: string; className?: string; children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href={href} target="_blank" rel="noreferrer" className={className} onClick={(e) => { if (isStandaloneApp()) { e.preventDefault(); setOpen(true); } }}>{children}</a>
      {open && <CardSheet href={href} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CardSheet({ href, title, onClose }: { href: string; title?: string; onClose: () => void }) {
  const { lang } = useT(); const en = lang === "en";
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  async function share() {
    try { if (navigator.share) { await navigator.share({ url: href }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/70">
      <div className="flex items-center gap-2 bg-[#12144a] px-3 pb-2 text-white" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold"><X className="h-4 w-4" /> {en ? "Close" : "बंद करें"}</button>
        <p className="flex-1 truncate text-center text-sm font-semibold">{title || (en ? "My card" : "मेरा कार्ड")}</p>
        <button type="button" onClick={share} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm">{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? (en ? "Copied" : "कॉपी") : (en ? "Share" : "शेयर")}</button>
      </div>
      <iframe src={href} title={title || "card"} className="w-full flex-1 bg-white" />
    </div>
  );
}
