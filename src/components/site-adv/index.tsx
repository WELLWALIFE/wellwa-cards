"use client";
// The ADVANCED website (src/lib/site-advanced.ts): a premium one-page site whose layout is the business's own. It draws the
// sections of `spec.order`, each in the variant the spec names (registry.ts), hides any section the card has nothing for
// (content.ts), and wraps them in the same chrome as the basic site: announcement + offer strip, header with the visitor's
// language switch, the notice, the phone's sticky action bar, the footer line, and the chat / popups / Shubhora strip.
//
// Rendered by SiteView (site-view.tsx) in place of the blueprint when `card.site.advanced` is a valid spec. SiteView has
// already counted the visit, saved the introducer and wired the page's hash, so none of that is repeated here.
import { Fragment, createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { ImageLightbox, LanguagePicker, TranslateCtx, WelcomePopup, useCardLang, type CardBrand } from "@/components/card-view";
import { CardChat } from "@/components/card-chat";
import { JoinNudge } from "@/components/join-nudge";
import { ShubhoraBar } from "@/components/shubhora-bar";
import { NoticeBar, NoticePopup } from "@/components/notice-view";
import { activeNotice } from "@/lib/notice";
import { linkHref } from "@/components/link-icon";
import { Icon } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { HERO_CSS, SMART_CSS, Wordmark } from "@/components/site-smart";
import { trackClick } from "@/lib/track";
import { advancedPalette, advancedVars, validateSpec, variantOf, type AdvancedSpec, type SectionKey } from "@/lib/site-advanced";
import { buildContent, sectionHasContent } from "@/components/site-adv/content";
import { ADV_BASE_CSS, type AdvCtx } from "@/components/site-adv/shared";
import { VARIANT_CSS, variantComponent } from "@/components/site-adv/registry";

export type AdvancedSiteProps = {
  card: Card;
  spec: AdvancedSpec;
  qr: string;
  brand?: CardBrand | null;
  shareUrl?: string;
  free?: boolean;
  /** Set on the public site (own addresses, popups on); undefined in the editor preview. */
  linkBase?: string;
  joinHandle?: string | null;
  nudge?: boolean;
  shubhora?: { joinHref: string; moreHref: string; free?: boolean } | null;
  /** The visitor language the page opens in (the preview's `?lang=`). */
  initialLang?: string;
  /** Open another page of the website (a product's own page). */
  goto?: (slug: string) => void;
  hrefFor?: (slug: string) => string;
};

/** The header, announcement and offer strips: rules the sections do not need. */
const CHROME_CSS = `
.adv-bar-wrap{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s}
.adv-bar-wrap.adv-scrolled{border-bottom-color:var(--line)}
.adv-bar{display:flex;align-items:center;gap:var(--s5);height:64px}
.adv-brand{display:flex;align-items:center;min-width:0;max-width:300px;padding:0;border:0;background:none;color:inherit;text-align:left;cursor:pointer;border-radius:var(--r-ctl)}
.adv-brand img{height:36px;width:auto;max-width:160px;object-fit:contain}
.adv-nav{display:none;align-items:center;gap:2px;margin-left:auto}
.adv-bar-right{display:none;align-items:center;gap:var(--s3)}
.adv-burger{margin-left:auto;display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--line);border-radius:var(--r-ctl);background:none;color:inherit;cursor:pointer}
.adv-mobile{display:flex;flex-direction:column;padding:var(--s2) var(--gutter) var(--s4);border-top:1px solid var(--line);background:var(--paper)}
.adv-mobile a{padding:.85rem 0;border-bottom:1px solid var(--line);font-size:15px;font-weight:500;color:var(--ink);text-decoration:none}
.adv-mobile>div{padding-top:var(--s3)}
@media (min-width:900px){.adv-nav,.adv-bar-right{display:flex}.adv-burger,.adv-mobile{display:none}}
.adv-ann{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 14px;padding:9px 16px;background:var(--accent);color:var(--on-accent);font-size:13px;line-height:1.35;text-align:center}
.adv-ann a{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
.adv-ann button{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;padding:6px;cursor:pointer;opacity:.85}
`;

const NAV: Partial<Record<SectionKey, [string, string]>> = {
  about: ["About", "हमारे बारे में"], services: ["Products", "प्रोडक्ट"], gallery: ["Gallery", "फ़ोटो"], proof: ["Reviews", "रिव्यू"],
  process: ["How it works", "कैसे काम करते हैं"], faq: ["FAQ", "सवाल"], visit: ["Visit", "पता"],
};

/** Sections fade up as they scroll into view (the basic site's rule): only once JS runs, whatever is on screen is shown before
 *  the first paint, and a few seconds later (or when printing) everything is shown anyway. */
const useIsoLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;
function useReveal(root: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useIsoLayout(() => {
    const el = root.current; if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)"));
    const vh = window.innerHeight || 800;
    for (const n of nodes) if (n.getBoundingClientRect().top < vh * 0.92) n.classList.add("in");
    el.classList.add("js");
    if (!("IntersectionObserver" in window)) { nodes.forEach((n) => n.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in"); io.unobserve(e.target); } }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    nodes.filter((n) => !n.classList.contains("in")).forEach((n) => io.observe(n));
    const all = () => { nodes.forEach((n) => n.classList.add("in")); io.disconnect(); };
    const timer = window.setTimeout(all, 4000);
    window.addEventListener("beforeprint", all);
    return () => { io.disconnect(); window.clearTimeout(timer); window.removeEventListener("beforeprint", all); };
  }, deps);
}

export function AdvancedSite({ card, spec: rawSpec, qr, brand, shareUrl, free = false, linkBase, joinHandle, nudge = false, shubhora = null, initialLang, goto, hrefFor }: AdvancedSiteProps) {
  // The spec comes from the AI or the database: it is repaired here too, so a hand-edited row can never crash the page.
  const spec = useMemo(() => validateSpec(rawSpec, card.username), [rawSpec, card.username]);
  const L = useCardLang(card.username);
  const setLang = L.setLang;
  useEffect(() => { if (initialLang) setLang(initialLang); }, [initialLang, setLang]);
  const hi = L.lang === "hi";
  const t = L.t;
  const c = useMemo(() => buildContent(card, L.lang), [card, L.lang]);
  const theme = advancedPalette(card, spec).mid;

  const links = card.links.filter((l) => l.value.trim());
  const wa = links.find((l) => l.type === "whatsapp");
  const phone = links.find((l) => l.type === "phone");
  const mapLink = links.find((l) => l.type === "location");
  // Every WhatsApp button opens with a line that names the business and says the visitor came from the website.
  const waOpen = card.language === "hi" ? `नमस्ते ${c.name}, मैंने आपकी website देखी — ` : `Hi ${c.name}, I saw your website — `;
  const waHref = (text?: string) => (wa ? `https://wa.me/${wa.value.replace(/\D/g, "")}?text=${encodeURIComponent(text ?? waOpen)}` : "#");
  const track = (what: string) => trackClick(card.username, `adv-${what}`);

  const rootRef = useRef<HTMLDivElement>(null);
  const heroEnd = useRef<HTMLDivElement>(null);
  const [pastHero, setPastHero] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState<{ images: string[]; i: number; alt: string } | null>(null);
  // The phone's sticky bar appears only once the hero has left the viewport: a sentinel after the hero.
  useEffect(() => {
    const el = heroEnd.current;
    if (!el || !("IntersectionObserver" in window)) { setPastHero(true); return; }
    const io = new IntersectionObserver((es) => { for (const e of es) setPastHero(!e.isIntersecting && e.boundingClientRect.top < 0); }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Announcement bar: shown until its date (IST day), closable for the visit. The notice (News) wins when both exist.
  const bar = card.site?.bar;
  const [barClosed, setBarClosed] = useState(false);
  const [barExpired, setBarExpired] = useState(false);
  useEffect(() => {
    if (!bar?.text) return;
    setBarExpired(!!bar.until && bar.until < new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
    try { if (sessionStorage.getItem(`site-bar:${card.username}:${bar.text}`)) setBarClosed(true); } catch { /* ignore */ }
  }, [bar?.text, bar?.until, card.username]);
  const barLive = !!bar?.text && !barExpired && !activeNotice(card);
  // The strip's link is the owner's text: only a web, mail or phone address becomes a link (never javascript:).
  const barHref = /^(https?:\/\/|mailto:|tel:)/i.test((bar?.link ?? "").trim()) ? bar!.link!.trim() : "";
  const closeBar = () => { setBarClosed(true); try { sessionStorage.setItem(`site-bar:${card.username}:${bar?.text}`, "1"); } catch { /* ignore */ } };

  const jump = (key: string) => {
    setMenu(false);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (key === "top") { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); return; }
    document.getElementById(`adv-${key}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const x: AdvCtx = {
    card, lang: L.lang, hi, t, ui: (en, h) => (hi ? h : en), waHref, wa, phone, mapLink, track,
    zoom: (images, i, alt) => setZoom({ images, i, alt: alt || c.name }),
    jump, goto, hrefFor: hrefFor ?? ((slug) => `#${slug}`), qr, shareUrl, brand,
  };

  // The sections that have something to say, in the spec's order; the footer is drawn after <main>.
  const drawn = spec.order.filter((k) => k !== "footer" && sectionHasContent(k, c, !!(wa || phone)));
  const nav = drawn.filter((k) => NAV[k]).slice(0, 5);
  useReveal(rootRef, [spec, card, L.lang]);
  // A section in the variant the spec names (createElement: the registry's component is looked up per section, not created).
  const slot = (k: SectionKey, index: number) => createElement(variantComponent(k, variantOf(spec, k)), { c, spec, x, index });

  return (
    <TranslateCtx.Provider value={t}>
      <style dangerouslySetInnerHTML={{ __html: `${SMART_CSS}${HERO_CSS}.site[data-adv]{${advancedVars(card, spec)}}${ADV_BASE_CSS}${CHROME_CSS}${VARIANT_CSS}` }} />
      <div ref={rootRef} lang={L.lang} className="site min-h-screen flex flex-col" data-adv="" data-motion={spec.motion} data-shape={spec.shape} data-density={spec.density}>
        {barLive && !barClosed && (
          <div className="adv-ann" style={{ position: "relative", zIndex: 31 }}>
            <Megaphone size={16} aria-hidden="true" />
            {barHref ? <a href={barHref} target="_blank" rel="noreferrer">{t(bar!.text)}</a> : <span>{t(bar!.text)}</span>}
            <button type="button" onClick={closeBar} aria-label={hi ? "बंद करें" : "Close"}><X size={16} /></button>
          </div>
        )}
        {c.offer && (
          <div className="adv-ann" role="note">
            <span>{t(c.offer.title ? `${c.offer.title}: ${c.offer.text}` : c.offer.text)}</span>
            {wa && <a href={waHref(c.offer.title || c.offer.text)} target="_blank" rel="noreferrer" onClick={() => track("offer-strip")}>{hi ? "यह ऑफ़र WhatsApp पर पाएँ" : t("Get this offer on WhatsApp")}</a>}
          </div>
        )}

        <header className={`adv-bar-wrap ${scrolled ? "adv-scrolled" : ""}`}>
          <div className="adv-wrap adv-wide adv-bar">
            <button type="button" className="adv-brand" onClick={() => jump("top")} aria-label={c.name}>
              {c.hm.logo ? <Pic src={c.hm.logo} alt={c.name} eager w={160} /> : <Wordmark name={t(c.name)} lang={L.lang} />}
            </button>
            <nav className="adv-nav" aria-label={x.ui("Sections", "सेक्शन")}>
              {nav.map((k) => {
                const [en, h] = NAV[k]!;
                const label = k === "services" && c.offerings?.kind === "services" ? x.ui("Services", "सेवाएँ") : x.ui(en, h);
                return <a key={k} href={`#adv-${k}`} className="adv-navlink" onClick={(e) => { e.preventDefault(); jump(k); }}>{label}</a>;
              })}
            </nav>
            <div className="adv-bar-right">
              <LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} />
              {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => track("nav-whatsapp")} className={`btn-primary btn-sm ${pastHero ? "" : "invisible"}`} aria-hidden={pastHero ? undefined : true} tabIndex={pastHero ? undefined : -1}><Icon name="whatsapp" /> WhatsApp</a>}
            </div>
            <button type="button" className="adv-burger" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={hi ? "मेन्यू" : "Menu"}>{menu ? <X size={20} /> : <Icon name="menu" size={20} />}</button>
          </div>
          {menu && (
            <nav className="adv-mobile" aria-label={x.ui("Sections", "सेक्शन")}>
              {nav.map((k) => { const [en, h] = NAV[k]!; return <a key={k} href={`#adv-${k}`} onClick={(e) => { e.preventDefault(); jump(k); }}>{x.ui(en, h)}</a>; })}
              <div><LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} /></div>
            </nav>
          )}
        </header>
        <NoticeBar card={card} hi={hi} />

        <main className="relative flex-1">
          {drawn.map((k, i) => {
            return (
              <Fragment key={k}>
                {slot(k, i)}
                {k === "hero" && <div ref={heroEnd} aria-hidden="true" style={{ height: 1, marginTop: -1 }} />}
              </Fragment>
            );
          })}
        </main>
        {slot("footer", drawn.length)}

        {/* The sticky action bar on phones: in only once the hero has scrolled away. */}
        {(wa || phone) && (
          <div className="site-bar fixed inset-x-0 bottom-0 z-40 grid gap-px border-t border-border bg-border md:hidden" data-shown={pastHero ? "" : undefined} style={{ gridTemplateColumns: `repeat(${[phone, wa, mapLink].filter(Boolean).length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
            {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => track("bar-phone")} className="flex items-center justify-center gap-2 bg-surface py-3.5 text-sm font-semibold"><Icon name="phone" /> {t("Call")}</a>}
            {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => track("bar-whatsapp")} className="flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white" style={{ background: "var(--wa)" }}><Icon name="whatsapp" /> WhatsApp</a>}
            {mapLink && <a href={linkHref(mapLink.type, mapLink.value)} target="_blank" rel="noreferrer" onClick={() => track("bar-map")} className="flex items-center justify-center gap-2 bg-surface py-3.5 text-sm font-semibold"><Icon name="directions" /> {hi ? "रास्ता" : t("Directions")}</a>}
          </div>
        )}
        {zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />}
        {card.popup?.enabled && linkBase !== undefined && <WelcomePopup card={card} theme={theme} active="home" />}
        {linkBase !== undefined && <NoticePopup card={card} theme={theme} active="home" hi={hi} />}
        {!free && <CardChat username={card.username} name={card.name} theme={theme} />}
        {nudge && joinHandle && !brand && <JoinNudge username={card.username} href={`/signup?by=${encodeURIComponent(joinHandle)}`} lang={L.lang} page="home" />}
        {shubhora && !brand && <ShubhoraBar username={card.username} joinHref={shubhora.joinHref} moreHref={shubhora.moreHref} free={shubhora.free !== false} lang={L.lang} aboveBar={!!(phone || wa || mapLink)} />}
      </div>
    </TranslateCtx.Provider>
  );
}
