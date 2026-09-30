"use client";

// "Aapko ye V-Card kaisa laga?" — a strip that slides up from the bottom of a Shubhora partner's card and opens the
// same joining link as the "Get your own Shubhora" button at the card's foot (owner's call, 27 Sep 2026).
//
// When (the usual professional rules, so it helps instead of annoying):
//   • never in the first 10 seconds — the visitor looks at the card first;
//   • then as soon as they show interest: 20 seconds on the card, 60 % of a page scrolled, or another page opened;
//   • never in the middle of something — typing, the chat open, a photo enlarged, a video playing — it waits;
//   • once a visit; ✕ keeps it away for 7 days on this phone; after "Make my card" it never comes back;
//   • not for signed-in Shubhora users (the owner looking at their own card, or anyone who already has an account),
//     not for a visitor who has already seen the joining button at the foot of the card, not for search bots.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { trackClick } from "@/lib/track";

const QUIET_MS = 10_000;
const AFTER_MS = 20_000;
const SCROLL_SHARE = 0.6;
const SNOOZE_MS = 7 * 24 * 3600_000;
const K_SEEN = "shubhora.joinNudge.seen";     // sessionStorage: shown in this visit
const K_SNOOZE = "shubhora.joinNudge.snooze"; // localStorage: time of the last ✕
const K_DONE = "shubhora.joinNudge.done";     // localStorage: tapped "Make my card"
const BOT_RE = /bot|crawl|spider|slurp|lighthouse|headless|facebookexternalhit|whatsapp|preview/i;

/** Something the visitor is doing right now that the strip must not interrupt. */
function busy(): boolean {
  if (document.hidden) return true;
  const a = document.activeElement as HTMLElement | null;
  if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return true;
  if (document.querySelector('[role="dialog"], [aria-modal="true"], dialog[open], [data-overlay-open]')) return true;
  if (document.body.style.overflow === "hidden") return true;
  return Array.from(document.querySelectorAll("video")).some((v) => !v.paused && !v.ended);
}

const TEXT = {
  hi: { title: "आपको ये V-Card कैसा लगा? 😊", body: "आप यहाँ अपने बिज़नेस का फ्री कार्ड बना सकते हैं — सिर्फ 5 मिनट में, 1 साल फ्री।", close: "बंद करें" },
  en: { title: "How do you like this V-Card? 😊", body: "You can make a free card for your business here — in just 5 minutes, free for 1 year.", close: "Close" },
};

export function JoinNudge({ username, href, lang, page }: {
  /** The card's username (for the click count). */
  username: string;
  /** The card's own joining link — the one on the button at its foot. */
  href: string;
  /** The language the card is showing: "en" → English, anything else → Hindi. */
  lang: string;
  /** The page of the card now open; a change counts as interest. */
  page: string;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);   // slid in (a frame after mounting, so it animates)
  const blocked = useRef(false);
  const firstPage = useRef(page);
  const movedPage = useRef(false);
  const maxScroll = useRef(0);
  // Swipe left or right to close (owner's call, 29 Sep 2026).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);

  useEffect(() => { if (page !== firstPage.current) movedPage.current = true; }, [page]);

  useEffect(() => {
    try {
      if (BOT_RE.test(navigator.userAgent) || navigator.webdriver) return;
      if (sessionStorage.getItem(K_SEEN) || localStorage.getItem(K_DONE)) return;
      const snoozed = Number(localStorage.getItem(K_SNOOZE) || 0);
      if (snoozed && Date.now() - snoozed < SNOOZE_MS) return;
    } catch { /* private mode: storage off — the rules still hold for this page view */ }

    // Signed in → already has an account (or is the owner): nothing to offer.
    getBrowserSupabase()?.auth.getSession().then(({ data }) => { if (data.session) blocked.current = true; }).catch(() => undefined);

    // The joining button at the card's foot, in view for a moment → they have seen the offer.
    let doorTimer: ReturnType<typeof setTimeout> | undefined;
    const door = document.querySelector("[data-join-door]");
    const io = door && "IntersectionObserver" in window
      ? new IntersectionObserver(([e]) => {
          clearTimeout(doorTimer);
          if (e.isIntersecting) doorTimer = setTimeout(() => { blocked.current = true; }, 1500);
        }, { threshold: 0.6 })
      : null;
    if (io && door) io.observe(door);

    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room > 80) maxScroll.current = Math.max(maxScroll.current, window.scrollY / room);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Time counts only while the card is on screen (not while they are in another app).
    let visibleMs = 0;
    const tick = setInterval(() => {
      if (blocked.current) return;
      if (!document.hidden) visibleMs += 1000;
      if (visibleMs < QUIET_MS) return;
      const interested = visibleMs >= AFTER_MS || maxScroll.current >= SCROLL_SHARE || movedPage.current;
      if (!interested || busy()) return;
      blocked.current = true;
      try { sessionStorage.setItem(K_SEEN, "1"); } catch { /* ignore */ }
      setOpen(true);
    }, 1000);

    return () => { clearInterval(tick); clearTimeout(doorTimer); io?.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => setUp(true));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => { cancelAnimationFrame(r); window.removeEventListener("keydown", esc); };
  }, [open]);

  function close() {
    try { localStorage.setItem(K_SNOOZE, String(Date.now())); } catch { /* ignore */ }
    setUp(false);
    setTimeout(() => setOpen(false), 250);
  }

  if (!open || typeof document === "undefined") return null;
  const T = lang === "en" ? TEXT.en : TEXT.hi;
  // On document.body: inside the card's animated wrapper "fixed" measured from the card, so the strip sat at the
  // card's foot instead of the screen's (owner's report, 29 Sep 2026).
  return createPortal(
    <div role="region" aria-label={T.title}
      className={`fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out motion-reduce:transition-none ${up ? "translate-y-0" : "translate-y-[120%]"}`}>
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-4 pr-11 shadow-float touch-pan-y"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, opacity: dx ? Math.max(0.3, 1 - Math.abs(dx) / 240) : 1, transition: dx ? "none" : "transform .2s, opacity .2s" }}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchMove={(e) => { if (!touch.current) return; const mx = e.touches[0].clientX - touch.current.x, my = e.touches[0].clientY - touch.current.y; if (Math.abs(mx) > Math.abs(my)) setDx(mx); }}
        onTouchEnd={() => { const gone = Math.abs(dx) > 70; touch.current = null; if (gone) close(); else setDx(0); }}>
        <button type="button" onClick={close} aria-label={T.close}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface2 text-ink shadow-sm">
          <X className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold text-ink">{T.title}</p>
        <p className="mt-1 text-xs text-muted">{T.body}</p>
        <a href={href}
          onClick={() => { try { localStorage.setItem(K_DONE, "1"); } catch { /* ignore */ } trackClick(username, "popup-join"); }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: "#2f4bd8" }}>
          Make my card <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>,
    document.body,
  );
}
