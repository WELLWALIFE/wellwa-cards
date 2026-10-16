"use client";
// The standard website's header (16 Oct 2026, hero-nav pass): the owner's logo (or the name as a wordmark), the pages,
// the language, WhatsApp once the hero has scrolled away, and on a phone a full-height menu instead of a dropdown.
//
// What changed against the old inline header in site-view.tsx:
//  - it condenses on scroll without changing its height (a height change would shift the page under the finger):
//    the mark shrinks a notch, the bar turns opaque with a hairline shadow, and a 2 px progress line draws along its
//    foot where the browser has scroll-driven animations (nothing at all where it has not);
//  - the phone menu is a sheet under the bar with the pages set large, WhatsApp first and Call second, then the
//    language; it locks the page scroll, closes on Escape / a tap on a page, and hands focus back to its button;
//  - nav links draw their underline on hover and keep it on the current page.
// The sticky action bar and every other hook in site-view.tsx are untouched. The Advanced website has its own header.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { CardPage } from "@/lib/types";
import { LanguagePicker } from "@/components/card-view";
import { Icon } from "@/components/site-icons";
import { Wordmark } from "@/components/site-smart";
import { Pic as Img } from "@/components/pic";
import { trackClick } from "@/lib/track";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export function SiteHeader({ username, name, tradeWord, logo, lang, setLang, translating, theme, isHome, scrolled, active, navMain, navMore, allPages, hrefFor, go, waHref, phoneHref, t }: {
  username: string; name: string; tradeWord: string; logo?: string;
  lang: string; setLang: (l: string) => void; translating: boolean; theme: string;
  isHome: boolean; scrolled: boolean; active: string;
  navMain: CardPage[]; navMore: CardPage[]; allPages: CardPage[];
  hrefFor: (slug: string) => string; go: (slug: string) => void;
  waHref?: string; phoneHref?: string; t: (s: string) => string;
}) {
  const hi = lang === "hi";
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [top, setTop] = useState(60);
  const headRef = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLAnchorElement>(null);

  // The sheet starts right under the bar wherever the bar is (below an announcement strip, or pinned at the top).
  const openMenu = () => { setTop(Math.round(headRef.current?.getBoundingClientRect().bottom ?? 60)); setOpen(true); };
  const closeMenu = (back = true) => { setOpen(false); if (back) btnRef.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-menu", "1");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    // A phone turned sideways, or a window widened past the breakpoint, leaves a dead sheet open: close it.
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => { if (mq.matches) setOpen(false); };
    window.addEventListener("keydown", onKey); mq.addEventListener?.("change", onMq);
    const f = window.setTimeout(() => firstRef.current?.focus({ preventScroll: true }), 60);
    // The page behind the sheet is out of reach of Tab and of screen readers while it is open.
    const behind = Array.from(document.querySelectorAll<HTMLElement>(".site > main, .site > footer"));
    behind.forEach((el) => el.setAttribute("inert", ""));
    return () => { behind.forEach((el) => el.removeAttribute("inert")); document.body.style.overflow = prev; document.body.removeAttribute("data-menu"); window.removeEventListener("keydown", onKey); mq.removeEventListener?.("change", onMq); window.clearTimeout(f); };
  }, [open]);

  const pick = (slug: string) => { setOpen(false); go(slug); };
  const waGate = isHome && !scrolled; // One WhatsApp affordance per screen: the bar's own appears once the hero's button is gone.

  return (
    <>
      <header ref={headRef} className={`site-head sticky top-0 ${open ? "z-[46] menu-open" : "z-30"} glass border-b border-border ${scrolled ? "scrolled" : ""}`}>
        <div className="site-head-in mx-auto max-w-6xl px-5 md:px-6 h-[60px] md:h-[68px] flex items-center gap-6">
          <button type="button" onClick={() => { setOpen(false); go("home"); }} className={`site-mark flex items-center gap-3 min-w-0 shrink max-w-[300px] rounded-lg text-left ${FOCUS}`} aria-label={name}>
            {logo
              ? <Img src={logo} alt="" className="h-9 max-w-[160px] w-auto shrink-0 object-contain md:h-10" eager w={160} />
              : <Wordmark name={t(name)} trade={isHome ? undefined : t(tradeWord)} lang={lang} />}
          </button>
          {/* A "both" card is the owner's own website: Shubhora is on the bottom strip only (owner's call, 2 Oct 2026). */}
          <nav className="site-nav hidden md:flex items-center gap-x-0.5 ml-auto h-full" aria-label="Pages">
            {navMain.map((p) => (
              <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} aria-current={active === p.slug ? "page" : undefined}
                className={`site-nl relative h-full whitespace-nowrap px-3 text-[14px] font-medium inline-flex items-center transition-colors ${FOCUS} focus-visible:ring-inset ${active === p.slug ? "text-ink" : "text-muted hover:text-ink"}`}>
                {t(p.label)}
              </a>
            ))}
            {navMore.length > 0 && (
              <div className="relative h-full flex items-center" onKeyDown={(e) => e.key === "Escape" && setMoreOpen(false)}>
                <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="menu"
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium ${FOCUS} ${navMore.some((p) => p.slug === active) ? "text-ink" : "text-muted hover:text-ink"}`}>
                  {hi ? "और" : "More"} <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                    <div role="menu" className="site-more absolute right-0 top-[calc(100%-6px)] z-30 w-52 p-1">
                      {navMore.map((p) => <button key={p.id} type="button" role="menuitem" onClick={() => { setMoreOpen(false); go(p.slug); }} className={`w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-surface2 ${FOCUS} ${active === p.slug ? "font-semibold" : ""}`}>{t(p.label)}</button>)}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
          <div className="hidden md:block"><LanguagePicker lang={lang} setLang={setLang} busy={translating} theme={theme} /></div>
          {waHref && (
            <a href={waHref} target="_blank" rel="noreferrer" onClick={() => trackClick(username, "site-whatsapp")} className={`site-head-wa max-md:hidden btn-primary btn-sm ${FOCUS} ${waGate ? "invisible" : ""}`}
              aria-hidden={waGate ? true : undefined} tabIndex={waGate ? -1 : undefined}>
              <Icon name="whatsapp" /> WhatsApp
            </a>
          )}
          <button ref={btnRef} type="button" onClick={() => (open ? closeMenu(false) : openMenu())} aria-expanded={open} aria-controls="site-menu" aria-label={hi ? "मेन्यू" : "Menu"}
            className={`site-burger md:hidden ml-auto h-11 w-11 grid place-items-center rounded-lg border border-border ${FOCUS}`}>
            {open ? <X className="h-5 w-5" /> : <Icon name="menu" size={20} />}
          </button>
        </div>
        <i aria-hidden="true" className="site-prog" />
      </header>
      {open && (
        <div id="site-menu" className="site-menu md:hidden" style={{ top }} role="dialog" aria-modal="true" aria-label={hi ? "पेज" : "Pages"}>
          <div className="site-menu-in">
            <nav aria-label="Pages">
              <ol className="site-menu-list">
                {allPages.map((p, i) => (
                  <li key={p.id} style={{ ["--i" as string]: i } as React.CSSProperties}>
                    <a ref={i === 0 ? firstRef : undefined} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); pick(p.slug); }} aria-current={active === p.slug ? "page" : undefined} lang={lang}>
                      <span>{t(p.label)}</span>
                      <Icon name="arrow-right" size={18} />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="site-menu-act" style={{ ["--i" as string]: allPages.length } as React.CSSProperties}>
              {waHref && <a href={waHref} target="_blank" rel="noreferrer" onClick={() => trackClick(username, "site-menu-whatsapp")} className="btn-primary hero-cta"><Icon name="whatsapp" /> <span>{hi ? "WhatsApp करें" : "WhatsApp us"}</span></a>}
              {phoneHref && <a href={phoneHref} onClick={() => trackClick(username, "site-menu-phone")} className="btn-ghost hero-cta"><Icon name="phone" /> <span>{hi ? "कॉल करें" : "Call us"}</span></a>}
              <div className="site-menu-lang"><LanguagePicker lang={lang} setLang={setLang} busy={translating} theme={theme} /></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The header's rules. Colours are the site's tokens; the cinematic blueprint's transparent bar is dealt with in
 *  CINEMATIC_CSS (it only has to turn solid while this menu is open, which `.menu-open` below does for every look). */
export const HEAD_CSS = `
@keyframes site-menu-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes site-menu-li{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes site-prog{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.site header.site-head{transition:box-shadow .25s ease,background-color .25s ease}
.site header.site-head.scrolled{box-shadow:0 1px 0 var(--line),0 10px 24px -18px rgb(0 0 0/.35)}
.site header.site-head.menu-open{background:var(--paper)!important;box-shadow:none;backdrop-filter:none}
.site .site-mark{transform-origin:0 50%;transition:transform .25s cubic-bezier(.2,.7,.2,1)}
.site header.site-head.scrolled .site-mark{transform:scale(.92)}
.site .site-nl::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:2px;background:var(--accent);transform:scaleX(0);transform-origin:0 50%;transition:transform .28s cubic-bezier(.2,.7,.2,1)}
.site .site-nl:hover::after,.site .site-nl[aria-current=page]::after{transform:scaleX(1)}
.site .site-nl:lang(hi){letter-spacing:0}
.site .site-more{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--e-1,0 12px 32px -12px rgb(0 0 0/.3))}
.site .site-prog{position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--accent);transform:scaleX(0);transform-origin:0 50%;pointer-events:none;opacity:0}
@supports (animation-timeline:scroll()){
.site header.site-head.scrolled .site-prog{opacity:1;animation:site-prog linear both;animation-timeline:scroll(root)}
}
.site .site-menu{position:fixed;left:0;right:0;bottom:0;z-index:45;background:var(--paper);color:var(--ink);overflow-y:auto;overscroll-behavior:contain;animation:site-menu-in .22s ease-out both}
.site .site-menu-in{min-height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:var(--s6);padding:var(--s4) var(--gutter) calc(var(--s6) + env(safe-area-inset-bottom,0px))}
.site .site-menu-list{list-style:none;margin:0;padding:0}
.site .site-menu-list li{border-bottom:1px solid var(--line);animation:site-menu-li .4s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i,0)*45ms + 60ms)}
.site .site-menu-list a{display:flex;align-items:center;justify-content:space-between;gap:var(--s4);min-height:64px;padding:var(--s3) 0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.65rem,7.4vw,2.1rem);line-height:1.1;letter-spacing:-.01em;font-weight:var(--display-w,var(--head-w,500));color:var(--ink);text-decoration:none}
.site .site-menu-list a:lang(hi){letter-spacing:0;line-height:1.3;font-size:clamp(1.5rem,6.6vw,1.9rem)}
.site .site-menu-list a svg{flex:none;color:var(--muted);transition:transform .2s ease}
.site .site-menu-list a[aria-current=page]{color:var(--accent)}
.site .site-menu-list a[aria-current=page] svg{color:var(--accent)}
.site .site-menu-list a:active svg{transform:translateX(4px)}
.site .site-menu-act{display:flex;flex-direction:column;gap:var(--s3);animation:site-menu-li .4s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i,0)*45ms + 60ms)}
.site .site-menu-act .hero-cta{width:100%;min-height:52px}
.site .site-menu-lang{display:flex;justify-content:center;padding-top:var(--s2)}
body[data-menu] .site-bar{transform:translateY(110%)!important}
@media (prefers-reduced-motion: reduce){
.site .site-menu,.site .site-menu-list li,.site .site-menu-act{animation:none}
.site .site-mark,.site .site-nl::after{transition:none}
.site header.site-head.scrolled .site-prog{animation:none;opacity:0}
}
.site[data-motion=none] .site-menu,.site[data-motion=none] .site-menu-list li,.site[data-motion=none] .site-menu-act{animation:none}
`;
