"use client";
// Renders the card saved in localStorage "vcard-preview" (written by /poster/card/build) with the real
// website renderer. Nothing is sent anywhere; the page follows the preview live when the owner changes it.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SiteView } from "@/components/site-view";
import { CardView } from "@/components/card-view";
import { PlanProvider, usePlan } from "@/lib/plan";
import { SITE_URL } from "@/lib/site-url";
import type { Card } from "@/lib/types";
import { isShubhoraSellerCard, withoutShubhoraLeaks } from "@/lib/shubhora-page";
import { activeAdvanced, advancedItemStubs, withAdvancedPages } from "@/lib/site-advanced";

const KEY = "vcard-preview";
/** The website editor (/poster/website/edit) previews under its own key, passed as ?k=, so it never
 *  collides with a V-Card build in another tab. Only letters, digits and dashes are accepted. */
function storageKey(): string {
  try { const k = new URLSearchParams(window.location.search).get("k") ?? ""; return /^[a-z0-9-]{1,40}$/i.test(k) ? k : KEY; } catch { return KEY; }
}
/** `?shot=1` (scripts/trade-check/look-shots.mjs): a screenshot of the website alone, no upgrade strip over it. */
function isShot(): boolean {
  try { return new URLSearchParams(window.location.search).get("shot") === "1"; } catch { return false; }
}
/** `?lang=hi|en` forces the visitor language the page opens in (the look audit shoots English cards in both). */
function forcedLang(): "hi" | "en" | null {
  try { const l = new URLSearchParams(window.location.search).get("lang"); return l === "hi" || l === "en" ? l : null; } catch { return null; }
}

/** `?page=<slug>` opens a page of the website: a card page ("products", "visit"), "updates", an about / gallery page the advanced site adds,
 *  or an item's own address ("p-kaju-katli"). The QA tooling and the editor's iframe use it; unset = the home page. */
/** `?view=card`: the phone card instead of the website (the edit screens' live window for a card-only change). */
function cardParam(): boolean {
  try { return new URLSearchParams(window.location.search).get("view") === "card"; } catch { return false; }
}

function pageParam(): string | undefined {
  try { const p = new URLSearchParams(window.location.search).get("page") ?? ""; return /^[\w%-]{1,80}$/.test(p) ? decodeURIComponent(p) : undefined; } catch { return undefined; }
}

function readCard(): Card | null {
  try {
    const raw = localStorage.getItem(storageKey());
    const c = raw ? (JSON.parse(raw) as Card) : null;
    return c && Array.isArray(c.pages) && Array.isArray(c.links) ? c : null;
  } catch {
    return null;
  }
}

export function PreviewSite() {
  return <PlanProvider><PreviewInner /></PlanProvider>;
}

// Free plan: the website is a preview only (visitors get the card) — say so, with the upgrade link.
// Growth / Pro (or a card plan set by admin): the website as visitors will see it.
// Shown only under the website editor's own key: the build preview (the default key) is a 390 px frame showing the
// three looks, and the bar ate a third of it (owner's call, 5 Oct 2026). One 40 px line fixed at the BOTTOM, above
// the phone's sticky action bar like ShubhoraBar's `aboveBar` (docs/premium-look.md §4.10) — never over the hero.
function UpgradeBar({ aboveBar }: { aboveBar: boolean }) {
  const { plan, loading } = usePlan();
  if (loading || plan !== "free") return null;
  return (
    <>
      <div aria-hidden style={{ height: 40 }} />
      <div className={`fixed inset-x-0 z-50 flex items-center justify-center gap-3 bg-[#12144a] px-4 text-[13px] text-white ${aboveBar ? "bottom-[calc(52px+env(safe-area-inset-bottom))] md:bottom-0" : "bottom-0"}`} style={{ height: 40 }}>
        <span className="truncate"><b>Preview only</b> — Free plan: visitors see your card, not this website.</span>
        <a href="/poster/plan" target="_top" className="shrink-0 font-semibold underline underline-offset-2">Upgrade</a>
      </div>
    </>
  );
}

function PreviewInner() {
  const { plan, loading } = usePlan();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [qr, setQr] = useState("");

  const [editor, setEditor] = useState(false);
  const [shot, setShot] = useState(false);
  const [lang, setLang] = useState<"hi" | "en" | null>(null);
  const [startPage, setStartPage] = useState<string | undefined>(undefined);
  const [asCard, setAsCard] = useState(false);
  // The advanced website is several pages: the About and Gallery pages it adds, and a hidden page per item so every item opens
  // in place (the public route does the same, src/app/c/[username]/render.tsx). A basic card is passed through as it is.
  const shown = useMemo(() => {
    if (!card) return card;
    const base = isShubhoraSellerCard(card) ? card : withoutShubhoraLeaks(card);
    if (!activeAdvanced(base.site, base.username)) return base;
    const withPages = withAdvancedPages(base);
    return { ...withPages, pages: [...withPages.pages, ...advancedItemStubs(withPages)] };
  }, [card]);
  useEffect(() => {
    const key = storageKey();
    setEditor(key !== KEY);
    setShot(isShot());
    const l = forcedLang();
    setLang(l);
    setStartPage(pageParam());
    setAsCard(cardParam());
    // useCardLang (card-view.tsx) opens in the language it last saved: the forced one is written there first, so
    // the renderer's very first paint is already in it.
    if (l) { try { localStorage.setItem("ne-card-lang", l); } catch { /* ignore */ } }
    setCard(readCard());
    QRCode.toDataURL(SITE_URL, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
    const onStorage = (e: StorageEvent) => { if (e.key === key) setCard(readCard()); };
    // The editor sits in the parent window and posts after every change as well (storage events can lag).
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data === `preview:${key}`) { setCard(readCard()); return; }
      // The editor asks to show the part just changed (owner, 24 Oct 2026: "jo change hua wo hi portion apne aap window me dikhe"):
      // after the new paint, find it (the top, or a heading / line with that text), tell the editor where it is and mark it for a moment.
      const d = e.data as { type?: string; key?: string; top?: boolean; text?: string } | null;
      if (!d || d.type !== "preview-focus" || d.key !== key) return;
      setTimeout(() => {
        let el: HTMLElement | null = null;
        const want = (d.text ?? "").trim().toLowerCase();
        if (!d.top && want) {
          const all = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,b,strong,dt,dd,p,span"));
          el = all.find((x) => /^H[1-4]$/.test(x.tagName) && (x.textContent ?? "").trim().toLowerCase().includes(want))
            ?? all.find((x) => (x.textContent ?? "").trim().toLowerCase() === want)
            // The line that holds it (an address shown with its city): the shortest element whose text contains it.
            ?? all.filter((x) => (x.textContent ?? "").toLowerCase().includes(want)).sort((a, b) => (a.textContent ?? "").length - (b.textContent ?? "").length)[0] ?? null;
          el = (el?.closest("section") as HTMLElement | null) ?? el;
        }
        const y = el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 12) : 0;
        try { window.parent.postMessage({ type: "preview-at", key, y }, window.location.origin); } catch { /* ignore */ }
        if (el) { const o = el.style.outline, off = el.style.outlineOffset; el.style.outline = "4px solid #ffb400"; el.style.outlineOffset = "-4px"; setTimeout(() => { el!.style.outline = o; el!.style.outlineOffset = off; }, 1400); }
      }, 260);
    };
    window.addEventListener("storage", onStorage); window.addEventListener("message", onMessage);
    // The page's own height, told to the screen that frames it (the advanced-website page sizes its frame to it: no blank space under
    // the footer, no second scrollbar inside). Posted whenever the page grows or shrinks.
    let lastH = 0;
    const tell = () => { const h = document.documentElement.scrollHeight; if (h !== lastH && window.parent !== window) { lastH = h; try { window.parent.postMessage({ type: "preview-height", key, h }, window.location.origin); } catch { /* ignore */ } } };
    const ro = "ResizeObserver" in window ? new ResizeObserver(tell) : null;
    ro?.observe(document.documentElement); if (document.body) ro?.observe(document.body);
    const tick = setInterval(tell, 1500);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("message", onMessage); ro?.disconnect(); clearInterval(tick); };
  }, []);

  if (card === undefined) return null;
  if (!card) return <div className="flex-1 grid min-h-screen place-items-center text-center text-muted">Nothing to preview</div>;
  // The key re-mounts the renderer when a new card arrives, so its page and language state start fresh.
  // The editor's preview re-renders in place (the key would reset the page and scroll on every keystroke).
  const links = shown!.links.filter((l) => l.value.trim());
  const hasBar = links.some((l) => l.type === "phone" || l.type === "whatsapp" || l.type === "location");
  if (asCard) return <CardView card={shown!} qr={qr} />;
  return (
    <>
      <SiteView key={editor ? "editor" : `${card.id}-${card.username}`} card={shown!} qr={qr} free={loading || plan === "free"} initialLang={lang ?? undefined} initialPage={startPage} unlisted={shown!.pages.filter((p) => p.hidden && p.id.startsWith("adv-")).map((p) => p.slug)} />
      {editor && !shot && <UpgradeBar aboveBar={hasBar} />}
    </>
  );
}
