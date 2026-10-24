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

/** A phone (or tablet): a new tab there has no easy way back to the app, and the screen being shared stays on the app's tab. */
export function isPhone(): boolean {
  try { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); } catch { return false; }
}
/** Open in the app (the sheet) rather than a new tab: the installed app, and every phone (owner, 24 Oct 2026: on a phone the website
 *  samples opened a new tab with no Close, and Share Screen did not show it). */
export const openInsideApp = () => isStandaloneApp() || isPhone();

/** The same address on THIS site when it is one of ours on another host is not known here; a same-site address keeps its path, so
 *  the sheet's frame is same-origin (Share Screen records what is inside it). */
const local = (href: string) => { try { const u = new URL(href, window.location.href); return u.origin === window.location.origin ? `${u.pathname}${u.search}` : href; } catch { return href; } };

/** A link to the live card / website: a new tab on a computer, a sheet with a Close button on a phone and in the installed app.
 *  `appHref`: the same page on this site (e.g. /c/<user>?view=site for an own-domain link), used inside the sheet. */
export function CardLink({ href, appHref, className, children, title }: { href: string; appHref?: string; className?: string; children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href={href} target="_blank" rel="noreferrer" className={className} onClick={(e) => { if (openInsideApp()) { e.preventDefault(); setOpen(true); } }}>{children}</a>
      {open && <CardSheet href={appHref ?? href} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}
/** The website is the same kind of link. */
export const SiteLink = CardLink;

/** For code that opened a page with window.open: on a phone / in the app it opens the sheet instead (InAppViewer, mounted once). */
export const OPEN_IN_APP = "shubhora:open-in-app";
export function openPage(href: string, title?: string) {
  if (openInsideApp()) { window.dispatchEvent(new CustomEvent(OPEN_IN_APP, { detail: { href, title } })); return; }
  window.open(href, "_blank", "noopener");
}
/** Mounted once in the app's layout: shows the sheet asked for by openPage(). */
export function InAppViewer() {
  const [page, setPage] = useState<{ href: string; title?: string } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setPage((e as CustomEvent<{ href: string; title?: string }>).detail);
    window.addEventListener(OPEN_IN_APP, on);
    return () => window.removeEventListener(OPEN_IN_APP, on);
  }, []);
  return page ? <CardSheet href={page.href} title={page.title} onClose={() => setPage(null)} /> : null;
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
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-[#12144a]"><X className="h-4 w-4" /> {en ? "Close" : "बंद करें"}</button>
        <p className="flex-1 truncate text-center text-sm font-semibold">{title || (en ? "My card" : "मेरा कार्ड")}</p>
        <button type="button" onClick={share} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm">{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? (en ? "Copied" : "कॉपी") : (en ? "Share" : "शेयर")}</button>
      </div>
      <iframe src={local(href)} title={title || "card"} className="w-full flex-1 bg-white" />
    </div>
  );
}
