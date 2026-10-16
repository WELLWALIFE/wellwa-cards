"use client";
// The ADVANCED website (src/lib/site-advanced.ts): a premium, multi-page site whose layout is the business's own. Home draws the
// sections of `spec.order`, each in the variant the spec names (registry.ts), hides any section the card has nothing for
// (content.ts); the other pages (products or services with a page for every item, about, gallery, contact, updates and the card's own
// pages) are drawn by pages.tsx from the same variants and a few page templates. All of it sits in one shell (nav.tsx): the announcement
// and offer strips, a header that condenses on scroll, a full-screen menu on phones, a progress hairline, the phone's action bar,
// the footer variant, and the chat / popups / Shubhora strip.
//
// Rendered by SiteView (site-view.tsx) in place of the blueprint, on EVERY page of a card whose `site.advanced` spec is valid.
// SiteView has already counted the visit, saved the introducer and owns which page is open (`page`) and how a page is opened
// (`goto`, which also pushes the address), so none of that is repeated here.
import { Fragment, createElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import type { Card } from "@/lib/types";
import { ImageLightbox, LanguagePicker, TranslateCtx, WelcomePopup, useCardLang, type CardBrand } from "@/components/card-view";
import { CardChat } from "@/components/card-chat";
import { JoinNudge } from "@/components/join-nudge";
import { ShubhoraBar } from "@/components/shubhora-bar";
import { NoticeBar, NoticePopup } from "@/components/notice-view";
import { activeNotice } from "@/lib/notice";
import { Pic } from "@/components/pic";
import { HERO_CSS, SMART_CSS, Wordmark } from "@/components/site-smart";
import { trackClick } from "@/lib/track";
import { catalogLabel, recipeFor } from "@/lib/site-recipes";
import { advancedPalette, advancedVars, validateSpec, variantOf, type AdvancedSpec, type SectionKey } from "@/lib/site-advanced";
import type { SiteUpdate } from "@/components/site-view";
import { buildContent, sectionHasContent } from "@/components/site-adv/content";
import { ADV_BASE_CSS } from "@/components/site-adv/shared";
import { VARIANT_CSS, variantComponent } from "@/components/site-adv/registry";
import { AdvHeader, MobileBar, NAV_CSS, buildPages, chromeOf, useScrolled, type AdvCtxPlus } from "@/components/site-adv/nav";
import { AdvPageBody, PAGES_CSS, catalogueOf, itemsOf, routeOf } from "@/components/site-adv/pages";
import { SeeMore } from "@/components/site-adv/page-parts";
import { shotsOf } from "@/components/site-adv/page-more";

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
  /** The page on screen: a page of the card (`home`, `products`, `visit`...), `updates`, or an item's address (`p-kaju-katli`). */
  page?: string;
  /** The owner's recent daily posters (the Updates page exists when there are any). */
  updates?: SiteUpdate[];
  /** Open another page of the website; SiteView pushes its address and scrolls to the top. */
  goto?: (slug: string) => void;
  hrefFor?: (slug: string) => string;
};

/** The announcement and offer strips: rules the sections do not need (the header and its menu are in nav.tsx). */
const CHROME_CSS = `
.site[data-adv]{overflow-x:clip}
.adv-ann{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 14px;padding:9px 16px;background:var(--accent);color:var(--on-accent);font-size:13px;line-height:1.35;text-align:center}
.adv-ann a{display:inline-flex;align-items:center;min-height:32px;color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:3px;white-space:nowrap;padding:12px 0;margin:-12px 0}
.adv-ann button{min-width:36px;min-height:36px}
.adv-ann button{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;padding:6px;cursor:pointer;opacity:.85}
`;

/** Sections fade up as they scroll into view (the basic site's rule): only once JS runs, whatever is on screen is shown before
 *  the first paint, and a few seconds later (or when printing) everything is shown anyway. Re-run per page. */
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

const setDocTitle = (title: string) => { document.title = title; };

export function AdvancedSite({ card, spec: rawSpec, qr, brand, shareUrl, free = false, linkBase, joinHandle, nudge = false, shubhora = null, initialLang, page, updates = [], goto, hrefFor }: AdvancedSiteProps) {
  // The spec comes from the AI or the database: it is repaired here too, so a hand-edited row can never crash the page.
  const spec = useMemo(() => validateSpec(rawSpec, card.username), [rawSpec, card.username]);
  const L = useCardLang(card.username);
  const setLang = L.setLang;
  useEffect(() => { if (initialLang) setLang(initialLang); }, [initialLang, setLang]);
  const hi = L.lang === "hi";
  const t = L.t;
  const c = useMemo(() => buildContent(card, L.lang), [card, L.lang]);
  const theme = advancedPalette(card, spec).mid;
  const chrome = useMemo(() => chromeOf(spec), [spec]);
  const addr = hrefFor ?? ((slug: string) => `#${slug}`);

  const links = card.links.filter((l) => l.value.trim());
  const wa = links.find((l) => l.type === "whatsapp");
  const phone = links.find((l) => l.type === "phone");
  const mapLink = links.find((l) => l.type === "location");
  // Every WhatsApp button opens with a line that names the business and says the visitor came from the website.
  const waOpen = card.language === "hi" ? `नमस्ते ${c.name}, मैंने आपकी website देखी — ` : `Hi ${c.name}, I saw your website — `;
  const waHref = (text?: string) => (wa ? `https://wa.me/${wa.value.replace(/\D/g, "")}?text=${encodeURIComponent(text ?? waOpen)}` : "#");
  const track = (what: string) => trackClick(card.username, `adv-${what}`);

  /* ---- the pages and the one on screen ---- */
  const first = card.pages[0]?.slug ?? "home";
  const slug = page ?? first;
  const items = useMemo(() => itemsOf(card), [card]);
  const pages0 = buildPages(card, { hrefFor: addr, hasUpdates: updates.length > 0 && !(card.site?.hidden ?? []).includes("updates"), active: slug, hi });
  const route = routeOf(slug, pages0, card, items);
  const isHome = route.kind === "home";
  // An item's own page keeps its catalogue marked in the menu.
  const pages = { ...pages0, active: route.kind === "item" ? catalogueOf(route, pages0)?.slug ?? pages0.active : route.kind === "home" ? pages0.home : pages0.active };

  const rootRef = useRef<HTMLDivElement>(null);
  const heroEnd = useRef<HTMLDivElement>(null);
  const [pastHero, setPastHero] = useState(false);
  const scrolled = useScrolled(24);
  const [zoom, setZoom] = useState<{ images: string[]; i: number; alt: string } | null>(null);
  // The phone's sticky bar and the header's button appear on the home page once the hero has left the viewport: a sentinel after the hero.
  useEffect(() => {
    const el = heroEnd.current;
    if (!isHome || !el || !("IntersectionObserver" in window)) { setPastHero(true); return; }
    setPastHero(false);
    const io = new IntersectionObserver((es) => { for (const e of es) setPastHero(!e.isIntersecting && e.boundingClientRect.top < 0); }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [isHome, slug]);

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

  const reduce = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // A page opened from the site arrives under a curtain that lifts (nav.tsx); the first paint (the server's HTML) does not.
  const [moved, setMoved] = useState(false);
  const open = (to: string) => { setMoved(true); goto?.(to); };
  /** A footer or a hero asks for a section by its key: the page that holds it opens (smoothly scrolled to the top), else the
   *  section on this page is scrolled to. "top" always scrolls. */
  const jump = (key: string) => {
    if (key === "top") { window.scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" }); return; }
    const here = document.getElementById(`adv-${key}`);
    const target = pages.forSection(key);
    if (target && target.slug !== slug) { open(target.slug); return; }
    here?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
  };

  const x: AdvCtxPlus = {
    card, lang: L.lang, hi, t, ui: (en, h) => (hi ? h : en), waHref, wa, phone, mapLink, track,
    zoom: (images, i, alt) => setZoom({ images, i, alt: alt || c.name }),
    jump, goto: open, hrefFor: addr, qr, shareUrl, brand,
    pages, sectionHref: (key) => pages.forSection(key)?.href ?? `#adv-${key}`,
  };

  // The sections that have something to say, in the spec's order; the footer is drawn after <main>.
  const hasContact = !!(wa || phone);
  const has = (k: SectionKey) => sectionHasContent(k, c, hasContact);
  const drawn = spec.order.filter((k) => k !== "footer" && has(k));
  useReveal(rootRef, [spec, card, L.lang, slug]);
  // A section in the variant the spec names (createElement: the registry's component is looked up per section, not created).
  const slot = (k: SectionKey, index: number) => createElement(variantComponent(k, variantOf(spec, k)), { c, spec, x, index });

  // Section links of other files (`#adv-about` in a footer) become the real address of the page, so they open in a new tab and
  // crawl; their click already goes through `jump`.
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    el.querySelectorAll<HTMLAnchorElement>('a[href^="#adv-"]').forEach((a) => {
      const key = (a.getAttribute("href") ?? "").slice(5);
      const target = pages.forSection(key);
      if (target) a.setAttribute("href", target.href);
    });
  });

  // A page change updates the tab's title (the server rendered the right one for the first load).
  const firstTitle = useRef<string | null>(null);
  useEffect(() => {
    if (linkBase === undefined) return;
    if (firstTitle.current === null) { firstTitle.current = document.title; return; }
    const city = c.city ? `, ${c.city}` : "";
    setDocTitle(route.kind === "home" ? (firstTitle.current ?? document.title)
      : route.kind === "item" ? `${t(route.item.item.name)} | ${c.name}${city}`
      : `${t(route.entry.label)} – ${c.name}${city}`);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const item = route.kind === "item" ? route.item : null;
  const itemPrice = item ? (item.item.price ?? "").trim() : "";
  const word = catalogLabel(recipeFor(card.seo?.categoryKey ?? "").catalog, hi ? "hi" : "en");
  const catPage = pages.byRole("catalogue");
  const catCount = catPage ? items.filter((i) => i.page === catPage.slug).length : 0;
  const galPage = pages.byRole("gallery");
  const shotCount = galPage ? shotsOf(card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks)).length : 0;
  // On the home page a band after the catalogue and the gallery leads into the page that holds all of it.
  const seeMore = (k: SectionKey) => {
    if (k === "services" && catPage && catCount > 0) return <SeeMore x={x} href={catPage.href} slug={catPage.slug} label={hi ? `सभी ${word} देखें` : `Browse all ${word.toLowerCase()}`} count={hi ? `${catCount} आइटम` : `${catCount} ${catCount === 1 ? "item" : "items"}`} />;
    if (k === "gallery" && galPage && shotCount > c.gallery.length) return <SeeMore x={x} href={galPage.href} slug={galPage.slug} label={x.ui("See the full gallery", "पूरी गैलरी देखें")} count={hi ? `${shotCount} फ़ोटो` : `${shotCount} photos`} />;
    return null;
  };

  const lang = <LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} />;
  const logo = c.hm.logo ? <Pic src={c.hm.logo} alt="" eager w={170} /> : <Wordmark name={t(c.name)} lang={L.lang} />;
  const bodyProps = { c, spec, x, chrome, slot, has, items, updates };

  return (
    <TranslateCtx.Provider value={t}>
      <style dangerouslySetInnerHTML={{ __html: `${SMART_CSS}${HERO_CSS}.site[data-adv]{${advancedVars(card, spec)}}${ADV_BASE_CSS}${CHROME_CSS}${NAV_CSS}${PAGES_CSS}${VARIANT_CSS}` }} />
      <div ref={rootRef} lang={L.lang} className="site min-h-screen flex flex-col" data-adv="" data-motion={spec.motion} data-shape={spec.shape} data-density={spec.density} data-page={route.kind === "page" ? route.entry.role : route.kind}>
        <a href="#adv-main" className="nv-skip" onClick={(e) => { e.preventDefault(); const m = document.getElementById("adv-main"); m?.focus({ preventScroll: true }); m?.scrollIntoView({ block: "start" }); }}>{hi ? "सीधे कंटेंट पर जाएँ" : "Skip to content"}</a>
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

        <AdvHeader x={x} name={c.name} logo={logo} scrolled={scrolled} showCta={!isHome || pastHero} lang={lang} chrome={chrome} onHome={() => (isHome ? jump("top") : open(pages.home))} />
        <NoticeBar card={card} hi={hi} />

        <main className={`relative flex-1 nv-page ${moved ? "nv-curtain" : ""}`} key={slug} id="adv-main" tabIndex={-1}>
          {route.kind === "home"
            ? drawn.map((k, i) => (
              <Fragment key={k}>
                {slot(k, i)}
                {k === "hero" && <div ref={heroEnd} aria-hidden="true" style={{ height: 1, marginTop: -1 }} />}
                {seeMore(k)}
              </Fragment>
            ))
            : <AdvPageBody route={route} {...bodyProps} />}
        </main>
        {slot("footer", drawn.length)}

        {/* The sticky action bar on phones: on the home page in only once the hero has scrolled away; an item's page leads with the item. */}
        <MobileBar x={x} shown={!isHome || pastHero} lead={item ? { title: t(item.item.name), price: itemPrice || undefined, waText: x.hi ? `नमस्ते ${c.name}, मुझे "${t(item.item.name)}"${itemPrice ? ` (${itemPrice})` : ""} के बारे में जानकारी चाहिए।` : `Hi ${c.name}, I saw your website — I'd like to know more about "${item.item.name}"${itemPrice ? ` (${itemPrice})` : ""}.` } : undefined} />
        {zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />}
        {card.popup?.enabled && linkBase !== undefined && <WelcomePopup card={card} theme={theme} active={isHome ? "home" : slug} />}
        {linkBase !== undefined && <NoticePopup card={card} theme={theme} active={isHome ? "home" : slug} hi={hi} />}
        {!free && <CardChat username={card.username} name={card.name} theme={theme} />}
        {nudge && joinHandle && !brand && <JoinNudge username={card.username} href={`/signup?by=${encodeURIComponent(joinHandle)}`} lang={L.lang} page={isHome ? "home" : slug} />}
        {shubhora && !brand && <ShubhoraBar username={card.username} joinHref={shubhora.joinHref} moreHref={shubhora.moreHref} free={shubhora.free !== false} lang={L.lang} aboveBar={!!(phone || wa || mapLink)} />}
      </div>
    </TranslateCtx.Provider>
  );
}
