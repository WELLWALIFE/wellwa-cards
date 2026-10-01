"use client";
// Website mode: the Card document rendered as a real multi-page website.
// One page at a time (nav switches, #slug deep-links), a desktop layout per
// block kind, consecutive same-kind blocks merged into one section, and the
// same visitor-language switch, lightbox, appointment dialog and chat as the
// phone card. Served by /c/<username> on desktop when card.site.enabled.
//
// The home page is COMPOSED (src/lib/site-home.ts): the owner's own home blocks, then previews of the products,
// photos, reviews, FAQ and the map that live on the other pages, each linking to its page. The design — palette,
// fonts, hero layout, corners — comes from card.site.style (src/lib/site-style.ts), with the card's colour and
// look as the fallback, so a website that never chose a style still wears its brand colour.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { INTRODUCER_KEY } from "@/lib/username";
import { Menu, X, MessageCircle, Phone, Download, Check, Star, MapPin, ChevronDown, FileText, Copy, Clock, Play, UserPlus, CalendarClock, ArrowRight, Navigation, Quote, Megaphone, Newspaper, LoaderCircle } from "lucide-react";
import type { Card, CardBlock, CardPage, ProductItem } from "@/lib/types";
import { ContactForm, AppointmentBlock, ImageLightbox, LanguagePicker, TranslateCtx, WelcomePopup, useCardLang, useT, embed, parsePrice, isCuratedArt, splitGlyph, glyphText, safeMapUrl, pageMeta, type CardBrand } from "@/components/card-view";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { CardChat } from "@/components/card-chat";
import { JoinNudge } from "@/components/join-nudge";
import { trackView, trackClick } from "@/lib/track";
import { tint } from "@/lib/color";
import { lookOf } from "@/lib/looks";
import { siteDesign } from "@/lib/site-style";
import { cardProducts, isProductSlug } from "@/lib/product-page";
import { homeSections, isEmptyBlock, trustFacts, type HomeSection } from "@/lib/site-home";
import { localLine, mapPin, pageHref } from "@/lib/seo";

// eslint-disable-next-line @next/next/no-img-element
const Img = (p: { src: string; alt: string; className?: string; style?: React.CSSProperties; eager?: boolean }) => <img src={p.src} alt={p.alt} className={p.className} style={p.style} loading={p.eager ? "eager" : "lazy"} decoding="async" />;

/* ---- product photo normaliser ----
 * Cut-out product photos come with wildly different transparent margins (one
 * file is 4:5 with the machine edge-to-edge, the next is square with 20% air),
 * so in equal boxes the machines look different sizes. Trim the transparent
 * margin client-side (alpha only — JPEGs/opaque files are left untouched) so
 * every product fills its box the same way. Cached per URL. */
const trimCache = new Map<string, string>();
function useTrimmed(src?: string) {
  const [out, setOut] = useState<string | undefined>(() => (src && trimCache.get(src)) || src);
  useEffect(() => {
    if (!src) return;
    const hit = trimCache.get(src); if (hit) { setOut(hit); return; }
    let alive = true;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) return;
        const sc = Math.min(1, 480 / Math.max(w, h));
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc));
        const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
        if (maxX < 0) { trimCache.set(src, src); return; }
        const bw = maxX - minX + 1, bh = maxY - minY + 1;
        if ((bw * bh) / (c.width * c.height) > 0.9) { trimCache.set(src, src); return; } // no real margin — keep the original
        const px = Math.round(bw * 0.04), py = Math.round(bh * 0.04);
        const x0 = Math.max(0, minX - px) / sc, y0 = Math.max(0, minY - py) / sc, x1 = Math.min(c.width, maxX + px + 1) / sc, y1 = Math.min(c.height, maxY + py + 1) / sc;
        const o = document.createElement("canvas"); o.width = Math.round(x1 - x0); o.height = Math.round(y1 - y0);
        o.getContext("2d")?.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, o.width, o.height);
        const url = o.toDataURL("image/png"); trimCache.set(src, url); if (alive) setOut(url);
      } catch { trimCache.set(src, src); }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return out ?? src;
}
/** Product photo that fills its box consistently (see useTrimmed). */
function FitImg({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  const s = useTrimmed(src);
  return <Img src={s ?? src} alt={alt} className={className} eager={eager} />;
}

const paras = (s?: string | null) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tc)]";
const CARD_HOVER = "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card motion-reduce:transform-none motion-reduce:transition-none";
const GROUPED = new Set(["services", "about", "highlights", "cta"]);
/** Primary button on light surfaces: the palette gradient. */
const BTN = "btn-grad inline-flex items-center justify-center gap-2 rounded-full font-semibold transition";

const isEmpty = isEmptyBlock;

/** Short trust facts for the hero ("📅 Since 2015", "🚚 Home delivery"): the first
 *  highlights block of the first page, when it has 2–6 items of at most 28 characters. */
function heroPills(card: Card): string[] {
  const hl = card.pages[0]?.blocks.find((b): b is Extract<CardBlock, { kind: "highlights" }> => b.kind === "highlights" && !b.items.some((x) => (x ?? "").startsWith("✅")));
  const items = (hl?.items ?? []).map((s) => (s ?? "").trim()).filter(Boolean);
  if (items.length < 2 || items.length > 6) return [];
  return items.every((s) => Array.from(splitGlyph(s).text).length <= 28) ? items : [];
}

/** The first product photo on the card — the hero picture when the owner chose none. */
function firstProductPhoto(card: Card): string | undefined {
  return productPhotos(card)[0];
}
/** One photo per product, in card order (for the hero mosaic). */
function productPhotos(card: Card): string[] {
  const out: string[] = [];
  for (const pg of card.pages) for (const b of pg.blocks) if (b.kind === "product") for (const it of b.items) { const u = it.images?.[0] ?? it.imageUrl; if (u && !out.includes(u)) out.push(u); }
  return out;
}

/** Sections fade up as they scroll into view. Only once JS runs (`js` on the root), so the page is never blank;
 *  whatever is already on screen is marked shown before the first paint, so nothing blinks on load. */
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
    // Safety nets: whatever has not scrolled into view after a few seconds, or when printing, is shown anyway.
    const all = () => { nodes.forEach((n) => n.classList.add("in")); io.disconnect(); };
    const timer = window.setTimeout(all, 4000);
    window.addEventListener("beforeprint", all);
    return () => { io.disconnect(); window.clearTimeout(timer); window.removeEventListener("beforeprint", all); };
  }, deps);
}

/** One of the owner's recent daily posters, shown on the website's Updates page and the "Latest" strip on Home. */
export type SiteUpdate = { date: string; url: string; title: string; caption?: string | null };
const UPDATES = "updates";

export function SiteView({ card, qr, brand, shareUrl, free = false, initialPage, linkBase, joinHandle, nudge = false, updates = [], unlisted = [] }: { card: Card; qr: string; brand?: CardBrand | null; shareUrl?: string; free?: boolean; initialPage?: string; linkBase?: string; joinHandle?: string | null; nudge?: boolean; updates?: SiteUpdate[];
  /** Pages that are reachable at their own address but are not in the menu — a product's own page. */
  unlisted?: string[] }) {
  // The website wears its own design: palette (or the card's colour), fonts (or the card look's), corners.
  const look = lookOf(card.template);
  const design = siteDesign(card, look);
  const pal = design.palette;
  const theme = pal.mid;                            // fills, accents, --tc
  const ink = design.on;                            // readable ink on a solid `theme` fill
  const hidden = new Set(card.site?.hidden ?? []);
  const hiLang = card.language === "hi";
  // The Updates page is not on the card: it is the owner's recent daily posters, added here when there are any.
  const showUpdates = updates.length > 0 && !hidden.has(UPDATES);
  const pages: CardPage[] = [
    ...card.pages.filter((p) => !hidden.has(p.slug) && (p.slug === "home" || p.blocks.some((b) => !isEmpty(b)))),
    ...(showUpdates ? [{ id: "__updates", slug: UPDATES, label: hiLang ? "अपडेट" : "Updates", blocks: [] as CardBlock[] }] : []),
  ];
  const first = card.pages[0]?.slug ?? "home";
  const [active, setActive] = useState(initialPage && pages.some((p) => p.slug === initialPage) ? initialPage : pages[0]?.slug ?? "home");
  // Every page has its own address (search engines index each one); "#slug" in the editor preview.
  const hrefFor = (slug: string) => (linkBase === undefined ? `#${slug}` : pageHref(linkBase, encodeURIComponent(slug), slug === first));
  const page = pages.find((p) => p.slug === active) ?? pages[0];
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hero = card.site?.hero;
  const links = card.links.filter((l) => l.value.trim());
  const wa = links.find((l) => l.type === "whatsapp");
  const phone = links.find((l) => l.type === "phone");
  // The hero picture: the owner's choice; unset → the first product photo (never the portrait); "" → none.
  const heroImg = hero?.imageUrl === undefined ? firstProductPhoto(card) : hero.imageUrl || undefined;
  const isHome = page?.slug === "home";
  const MAX_NAV = 6;
  // A product's own page is reached from a product card or from search, never from the menu.
  const unlistedSet = new Set(unlisted);
  const navPages = pages.filter((p) => !unlistedSet.has(p.slug));
  const navMain = navPages.slice(0, MAX_NAV), navMore = navPages.slice(MAX_NAV);
  const avatarCls = card.avatarShape === "square" ? "rounded-xl object-contain bg-white p-0.5" : "rounded-full object-cover bg-white";
  const logo = card.site?.logoUrl;                  // website logo (desktop settings); falls back to the card avatar
  const L = useCardLang(card.username);
  const t = L.t;
  const pills = heroPills(card);
  const facts = trustFacts(card);
  // The owner's own shop banner gets a lighter overlay so the shop stays visible.
  // Only on cards from the new V-Card flow (they carry `lead`): older live
  // cards keep today's overlay, which their text-heavy banners were designed under.
  const lightHero = !!card.coverUrl && !isCuratedArt(card.coverUrl) && !!card.lead;
  const mosaic = productPhotos(card).slice(0, 4);
  const portrait = card.avatarUrl && card.avatarShape !== "square" ? card.avatarUrl : undefined;
  const layout = (() => {
    const l = card.site?.style?.hero;
    // A mosaic needs three product photos and a portrait needs a photo; otherwise the next best shape.
    if (l === "grid" && mosaic.length < 3) return heroImg ? "split" : card.coverUrl ? "photo" : "split";
    if (l === "person" && !portrait) return heroImg ? "split" : card.coverUrl ? "photo" : "split";
    if (l) return l === "photo" && !card.coverUrl ? "split" : l;
    // The hero picture is the banner itself (a stock photograph of the trade, put in both slots by the
    // builder): a photograph goes across the top, never into a white product frame.
    if (heroImg && card.coverUrl && heroImg === card.coverUrl) return "photo";
    if (heroImg) return "split";
    return card.coverUrl ? "photo" : "split";
  })();
  // What stands beside the words: the product mosaic, the portrait, or the one picture.
  const heroVisual = layout === "grid" ? mosaic.length >= 3 : layout === "person" ? !!portrait : !!heroImg;
  const darkHero = layout !== "minimal" && pal.tone === "dark";
  const heroInk = layout === "minimal" ? "var(--ink)" : pal.ink;
  // On a dark hero the main button is white with the deep colour; on a light hero it is the brand gradient.
  const heroPrimary: React.CSSProperties = darkHero ? { background: "#ffffff", color: pal.deep } : { background: "var(--grad)", color: ink, boxShadow: "0 12px 28px -14px var(--p-mid)" };
  const rootRef = useRef<HTMLDivElement>(null);
  // Announcement bar: shown until its date (IST day), closable for the visit.
  const bar = card.site?.bar;
  const [barClosed, setBarClosed] = useState(false);
  const [barExpired, setBarExpired] = useState(false);
  useEffect(() => {
    if (!bar?.text) return;
    setBarExpired(!!bar.until && bar.until < new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
    try { if (sessionStorage.getItem(`site-bar:${card.username}:${bar.text}`)) setBarClosed(true); } catch { /* ignore */ }
  }, [bar?.text, bar?.until, card.username]);
  const barLive = !!bar?.text && !barExpired;
  const closeBar = () => { setBarClosed(true); try { sessionStorage.setItem(`site-bar:${card.username}:${bar?.text}`, "1"); } catch { /* ignore */ } };
  const float = card.site?.float ?? "whatsapp";
  const mapLink = links.find((l) => l.type === "location");

  // The owner's own preview ("__preview") is never counted as a visit.
  useEffect(() => { if (!(card.username ?? "").startsWith("__")) trackView(card.username); }, [card.username]);
  useEffect(() => {
    if (!joinHandle || brand) return;
    try { if (!localStorage.getItem(INTRODUCER_KEY)) localStorage.setItem(INTRODUCER_KEY, joinHandle); } catch { /* private mode */ }
  }, [joinHandle, brand]);
  useEffect(() => {
    const apply = () => { const s = window.location.hash.slice(1); if (s && pages.some((p) => p.slug === s)) setActive(s); };
    const back = (e: PopStateEvent) => { const s = (e.state as { slug?: string } | null)?.slug; setActive(s && pages.some((p) => p.slug === s) ? s : initialPage ?? pages[0]?.slug ?? "home"); };
    apply(); window.addEventListener("hashchange", apply); if (linkBase !== undefined) window.addEventListener("popstate", back);
    return () => { window.removeEventListener("hashchange", apply); window.removeEventListener("popstate", back); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useReveal(rootRef, [active, card]);
  function go(slug: string) {
    setActive(slug); setOpen(false); setMoreOpen(false);
    if (typeof history !== "undefined") {
      if (linkBase !== undefined) history.pushState({ slug }, "", hrefFor(slug) + window.location.search);
      else history.replaceState(null, "", slug === "home" ? window.location.pathname + window.location.search : `#${slug}`);
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }
  // Every WhatsApp button opens with a line that names the business and says the visitor came from the
  // website — the owner knows the lead's source, and the visitor need not think of an opening.
  const waOpen = card.language === "hi" ? `नमस्ते ${card.company || card.name}, मैंने आपकी website देखी — ` : `Hi ${card.company || card.name}, I saw your website — `;
  const waHref = (text?: string) => wa ? `https://wa.me/${wa.value.replace(/\D/g, "")}?text=${encodeURIComponent(text ?? waOpen)}` : "#";
  const pageBlocks = (page?.blocks ?? []).filter((b) => !isEmpty(b));
  const lastKind = pageBlocks.at(-1)?.kind;
  const hasAppointment = page?.blocks.some((b) => b.kind === "appointment");

  // Home: the composed section list (own blocks + pulled previews); other pages: their blocks in runs.
  // The hero already shows the trust chips as pills: printing the same five again as a "Why choose us" section
  // read as a mistake next to the real why-us points below it (seen live, 1 Oct 2026).
  const pilled = pills.length ? new Set(pills.map((x) => x.trim())) : null;
  const sections: HomeSection[] = (isHome ? homeSections(card, pages) : pageBlocks.map((b) => ({ key: b.id, kind: "block", block: b } as HomeSection)))
    .filter((s) => !(isHome && pilled && s.kind === "block" && s.block.kind === "highlights"
      && s.block.items.length === pilled.size && s.block.items.every((x) => pilled.has((x ?? "").trim()))));
  const groups: (Exclude<HomeSection, { kind: "block" }> | CardBlock[])[] = [];
  for (const s of sections) {
    if (s.kind !== "block") { groups.push(s); continue; }
    const last = groups[groups.length - 1];
    if (Array.isArray(last) && last[0].kind === s.block.kind && GROUPED.has(s.block.kind)) last.push(s.block); else groups.push([s.block]);
  }
  const runProps = { card, theme, ink, waHref, go, links, hrefFor };
  // "More on this website" lists only the pages the home page has NOT already previewed (a products, gallery,
  // reviews or FAQ preview carries its own "see all"; a services block on the home links to its page).
  const previewed = new Set(sections.filter((s) => s.kind !== "block").map((s) => (s as { page: string }).page));
  const homeKinds = new Set((pages.find((p) => p.slug === "home")?.blocks ?? []).map((b) => b.kind));
  const explorePages = navPages.filter((p) => p.slug !== first && p.slug !== "contact" && !previewed.has(p.slug) && !(p.slug === "services" && homeKinds.has("services")));
  // The footer prints each way of reaching the business once: the same number as WhatsApp AND Call was two
  // identical lines, which read as a mistake.
  const digitsOf = (v: string) => (v ?? "").replace(/\D/g, "").slice(-10);
  const sameNumber = !!wa && !!phone && digitsOf(wa.value) === digitsOf(phone.value);
  const footLinks = sameNumber ? links.filter((l) => l.type !== "phone") : links;
  const reviewCount = card.pages.flatMap((p) => p.blocks).flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim()).length;
  const fontHref = design.fonts.href;
  const eyebrowRole = card.jobTitle && card.jobTitle !== (hero?.headline || card.company || card.name) ? card.jobTitle : "";

  return (
    <TranslateCtx.Provider value={t}>
    {fontHref && <link rel="stylesheet" href={fontHref} />}
    <style dangerouslySetInnerHTML={{ __html: `.site[data-look]{${design.vars};font-family:var(--look-body)} .site[data-look] h1,.site[data-look] h2,.site[data-look] h3{font-family:var(--look-head)} .site[data-look] h1,.site[data-look] h2{font-weight:var(--head-w)} .site[data-look] .rounded-2xl{border-radius:var(--r)} .site[data-look] .rounded-xl{border-radius:calc(var(--r)*.8)} .site[data-look] .rounded-3xl{border-radius:calc(var(--r)*1.4)} .site .btn-grad{background:var(--grad);color:var(--p-on);box-shadow:0 12px 28px -14px var(--p-mid)} .site .btn-grad:hover{filter:brightness(1.06)} .site .dots{background-image:radial-gradient(rgba(255,255,255,.16) 1px, transparent 1.4px);background-size:22px 22px} .site.js [data-reveal]{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)} .site.js [data-reveal].in{opacity:1;transform:none} @media (prefers-reduced-motion: reduce){.site.js [data-reveal]{opacity:1;transform:none;transition:none}}` }} />
    <div ref={rootRef} className="site min-h-screen flex flex-col" data-look={look.key} style={{ background: "var(--surface)", ["--tc" as string]: theme } as React.CSSProperties}>
      {/* Lifted theme token: the raw brand colour as text fails contrast on dark
          surfaces, so text/icons use --tc which is lightened in dark mode. */}
      <style>{`.site{--tc:${theme}} @media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .site{--tc:color-mix(in srgb, ${theme} 62%, white)}} :root[data-theme="dark"] .site{--tc:color-mix(in srgb, ${theme} 62%, white)}`}</style>

      {/* ---- announcement bar ---- */}
      {barLive && !barClosed && (
        <div className="relative z-30 text-center text-sm font-medium" style={{ background: "var(--grad)", color: "var(--p-on)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-10 py-2">
            <Megaphone className="h-4 w-4 shrink-0" />
            {bar!.link
              ? <a href={bar!.link} onClick={(e) => { if (bar!.link!.startsWith("#")) { e.preventDefault(); go(bar!.link!.slice(1)); } }} target={bar!.link!.startsWith("#") ? undefined : "_blank"} rel="noreferrer" className="underline-offset-2 hover:underline">{t(bar!.text)}</a>
              : <span>{t(bar!.text)}</span>}
          </div>
          <button type="button" onClick={closeBar} aria-label="Close" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 opacity-80 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ---- header ---- */}
      <header className="sticky top-0 z-30 glass border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-[68px] flex items-center gap-6">
          <button type="button" onClick={() => go("home")} className={`flex items-center gap-3 shrink-0 max-w-[300px] rounded-lg ${FOCUS}`}>
            {logo
              ? <Img src={logo} alt={card.company || card.name} className="h-10 max-w-[160px] w-auto shrink-0 object-contain" eager />
              : card.avatarUrl
              ? <Img src={card.avatarUrl} alt="" className={`h-10 w-10 shrink-0 ${avatarCls}`} />
              : <span className="h-10 w-10 shrink-0 rounded-full inline-block" style={{ background: "var(--grad)" }} />}
            <span className="font-semibold text-[17px] truncate">{t(card.company || card.name)}</span>
          </button>
          <nav className="hidden md:flex items-center gap-x-0.5 ml-auto h-full" aria-label="Pages">
            {navMain.map((p) => (
              <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} aria-current={active === p.slug ? "page" : undefined} className={`relative h-[68px] whitespace-nowrap px-3 text-[14px] font-medium inline-flex items-center transition-colors ${FOCUS} focus-visible:ring-inset ${active === p.slug ? "text-ink" : "text-muted hover:text-ink"}`}>
                {t(p.label)}
                {active === p.slug && <span className="absolute left-3 right-3 bottom-0 h-[2px] rounded-t-full" style={{ background: "var(--grad)" }} />}
              </a>
            ))}
            {navMore.length > 0 && (
              <div className="relative h-full flex items-center" onKeyDown={(e) => e.key === "Escape" && setMoreOpen(false)}>
                <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="menu" className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium ${FOCUS} ${navMore.some((p) => p.slug === active) ? "text-ink" : "text-muted hover:text-ink"}`}>More <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} /></button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                    <div role="menu" className="absolute right-0 top-[60px] z-30 w-52 rounded-xl border border-border bg-surface shadow-float p-1">
                      {navMore.map((p) => <button key={p.id} type="button" role="menuitem" onClick={() => go(p.slug)} className={`w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-surface2 ${FOCUS} ${active === p.slug ? "font-semibold" : ""}`}>{t(p.label)}</button>)}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
          <div className="hidden md:block"><LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} /></div>
          {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => trackClick(card.username, "site-head-phone")} aria-label="Call" className={`hidden lg:grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-surface2 ${FOCUS}`}><Phone className="h-4 w-4" /></a>}
          {wa && (
            <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-whatsapp")} className={`max-md:hidden ${BTN} px-5 py-2.5 text-sm ${FOCUS}`}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" className={`md:hidden ml-auto h-10 w-10 grid place-items-center rounded-lg border border-border ${FOCUS}`}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-border bg-surface px-6 py-2 flex flex-col" aria-label="Pages">
            {pages.map((p) => <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} className={`py-3 text-left text-[15px] font-medium border-b border-border last:border-0 ${active === p.slug ? "text-ink" : "text-muted"}`}>{t(p.label)}</a>)}
            <div className="py-3"><LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} /></div>
          </nav>
        )}
      </header>

      <main className="flex-1 pb-14 md:pb-0">
        {isHome ? (
          <>
          <section className={`relative overflow-hidden ${layout === "stage" ? "" : "min-h-[560px] flex items-center"}`} style={{ color: heroInk, ...(layout === "minimal"
            ? { background: `radial-gradient(70% 90% at 100% 0%, color-mix(in srgb, var(--p-glow) 22%, transparent), transparent 60%), var(--p-soft)` }
            : { background: `radial-gradient(60% 80% at 85% 15%, color-mix(in srgb, var(--p-glow) 55%, transparent), transparent 62%), radial-gradient(50% 70% at 5% 95%, color-mix(in srgb, var(--p-mid) 65%, transparent), transparent 60%), linear-gradient(120deg, var(--p-deep) 0%, color-mix(in srgb, var(--p-deep) 60%, var(--p-mid)) 100%)` }) }}>
            {layout === "photo" && card.coverUrl && (
              <>
                <Img src={card.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" eager />
                <div className="absolute inset-0" style={{ background: lightHero
                  ? `linear-gradient(90deg, color-mix(in srgb, var(--p-deep) 84%, transparent) 0%, color-mix(in srgb, var(--p-deep) 55%, transparent) 45%, color-mix(in srgb, var(--p-deep) 18%, transparent) 100%)`
                  : `linear-gradient(90deg, color-mix(in srgb, var(--p-deep) 93%, transparent) 0%, color-mix(in srgb, var(--p-deep) 74%, transparent) 42%, color-mix(in srgb, var(--p-deep) 35%, transparent) 100%)` }} />
              </>
            )}
            {layout !== "photo" && layout !== "minimal" && <div aria-hidden="true" className="dots absolute inset-0 opacity-60" style={{ maskImage: "linear-gradient(180deg, transparent, black 30%, black 70%, transparent)", WebkitMaskImage: "linear-gradient(180deg, transparent, black 30%, black 70%, transparent)" }} />}
            <div className={`relative w-full mx-auto max-w-6xl px-6 ${layout === "stage" ? "pt-20 pb-0 md:pt-24 text-center" : `py-20 md:py-24 grid gap-12 items-center ${heroVisual ? "md:grid-cols-[1.15fr_1fr]" : ""}`}`}>
              <div className={`animate-rise ${layout === "stage" ? "mx-auto max-w-[760px]" : heroVisual ? "" : "md:max-w-[640px]"}`}>
                {/* Brand as the headline, role as the eyebrow, the about text as the sub —
                    never the tagline as a headline (it usually repeats the role). */}
                {eyebrowRole && <p className="text-[13px] font-semibold tracking-[0.18em] uppercase" style={{ color: layout === "minimal" ? "var(--p-mark)" : "var(--p-accent)" }}>{t(eyebrowRole)}</p>}
                <h1 className="mt-4 text-[42px] md:text-[60px] leading-[1.02] tracking-tight" style={{ textWrap: "balance" }}>{t(hero?.headline || card.company || card.name)}</h1>
                {(hero?.sub || card.about || card.tagline) && <p className={`mt-5 text-lg md:text-[19px] leading-relaxed ${layout === "stage" ? "mx-auto" : ""} max-w-[48ch]`} style={{ opacity: layout === "minimal" ? 1 : 0.9, color: layout === "minimal" ? "var(--muted)" : undefined }}>{t(hero?.sub || paras(card.about)[0]?.slice(0, 220) || card.tagline)}</p>}
                <div className={`mt-9 flex flex-wrap gap-3 ${layout === "stage" ? "justify-center" : ""}`}>
                  {wa && (
                    <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-hero-whatsapp")} className={`inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold shadow-float transition hover:brightness-105 ${FOCUS}`} style={heroPrimary}>
                      <MessageCircle className="h-4 w-4" /> {t(hero?.ctaLabel || "WhatsApp")}
                    </a>
                  )}
                  {phone && (
                    <a href={linkHref(phone.type, phone.value)} onClick={() => trackClick(card.username, "site-hero-phone")} className={`inline-flex items-center gap-2 rounded-full border px-6 py-4 text-[15px] font-semibold backdrop-blur ${FOCUS}`} style={{ borderColor: "color-mix(in srgb, currentColor 40%, transparent)", background: "color-mix(in srgb, currentColor 8%, transparent)" }}>
                      <Phone className="h-4 w-4" /> {phone.value}
                    </a>
                  )}
                </div>
                {pills.length > 0 && (
                  <ul className={`mt-7 flex flex-wrap gap-2 ${layout === "stage" ? "justify-center" : ""}`} aria-label="Highlights">
                    {pills.map((s, i) => {
                      const { glyph, text } = glyphText(s, t);
                      return (
                        <li key={i} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium" style={{ background: "color-mix(in srgb, currentColor 9%, transparent)", borderColor: "color-mix(in srgb, currentColor 22%, transparent)" }}>
                          {glyph ? <span aria-hidden="true" className="leading-none">{glyph}</span> : <Check className="h-4 w-4 shrink-0" style={{ color: darkHero ? "var(--p-accent)" : "var(--tc)" }} />}
                          {text}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {/* A shop's header already carries its logo and name: no second owner chip. */}
                {card.avatarUrl && card.name && card.name !== card.company && !card.site?.hideProfile && card.lead !== "business" && (
                  <div className={`mt-10 inline-flex items-center gap-3 border pl-1.5 pr-5 py-1.5 backdrop-blur ${card.avatarShape === "square" ? "rounded-2xl" : "rounded-full"}`} style={{ background: "color-mix(in srgb, currentColor 9%, transparent)", borderColor: "color-mix(in srgb, currentColor 20%, transparent)" }}>
                    <Img src={card.avatarUrl} alt={card.name} className={`h-11 w-11 ${avatarCls}`} />
                    <span className="leading-tight"><span className="block font-semibold text-[15px]">{card.name}</span>{card.jobTitle && <span className="block text-xs opacity-80">{t(card.jobTitle)}</span>}</span>
                  </div>
                )}
              </div>
              {layout === "grid" && mosaic.length >= 3 && (
                <div className="relative justify-self-center md:justify-self-end animate-rise w-full max-w-[460px]">
                  <div aria-hidden="true" className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-50" style={{ background: "var(--grad)" }} />
                  <div className="relative grid grid-cols-2 gap-3">
                    {mosaic.map((u, i) => (
                      <div key={u} className={`overflow-hidden rounded-2xl bg-white/95 shadow-float ${i === 0 && mosaic.length === 3 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}>
                        <Img src={u} alt="" className="h-full w-full object-cover" eager={i === 0} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {layout === "person" && portrait && (
                <div className="relative justify-self-center md:justify-self-end animate-rise">
                  <div aria-hidden="true" className="absolute -inset-10 rounded-full blur-3xl opacity-60" style={{ background: "var(--grad)" }} />
                  <div className="relative h-[300px] w-[300px] md:h-[380px] md:w-[380px] overflow-hidden rounded-[2.5rem] border-4 border-white/80 shadow-float bg-white/90">
                    <Img src={portrait} alt={card.name} className="h-full w-full object-cover" eager />
                  </div>
                </div>
              )}
              {heroImg && layout !== "stage" && layout !== "grid" && layout !== "person" && (
                <div className="relative justify-self-center md:justify-self-end animate-rise">
                  <div aria-hidden="true" className="absolute -inset-8 rounded-[3rem] blur-3xl opacity-50" style={{ background: "var(--grad)" }} />
                  <div className={`relative rounded-3xl p-3 shadow-float ${layout === "minimal" ? "bg-surface border border-border" : "bg-white/95"}`}><Img src={heroImg} alt={card.company || card.name} className="max-h-[400px] w-auto rounded-2xl object-contain" eager /></div>
                </div>
              )}
              {heroImg && layout === "stage" && (
                <div className="relative mt-12 flex justify-center animate-rise">
                  <div aria-hidden="true" className="absolute inset-x-[20%] bottom-0 h-[55%] rounded-[50%] blur-3xl opacity-60" style={{ background: "var(--grad)" }} />
                  <Img src={heroImg} alt={card.company || card.name} className="relative max-h-[460px] w-auto object-contain drop-shadow-2xl" eager />
                </div>
              )}
              {!heroImg && layout === "stage" && <div className="pb-20" />}
            </div>
          </section>

          {/* ---- trust strip: numbers the card itself carries ---- */}
          {facts.length >= 3 && (
            <section className="border-b border-border bg-surface">
              <div className={`mx-auto max-w-6xl px-6 py-7 grid gap-6 ${facts.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
                {facts.map((f, i) => (
                  <div key={i} className={`flex flex-col items-center text-center ${i ? "md:border-l md:border-border" : ""}`}>
                    <span className="text-[26px] md:text-[30px] leading-none tracking-tight font-semibold" style={{ fontFamily: "var(--look-head)", color: "var(--tc)" }}>{t(f.value)}</span>
                    <span className="mt-2 text-[13px] text-muted">{t(f.label)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          </>
        ) : (
          <section style={{ background: `radial-gradient(60% 100% at 100% 0%, color-mix(in srgb, var(--p-glow) 18%, transparent), transparent 60%), linear-gradient(110deg, var(--p-soft), transparent 70%)` }}>
            <div className="mx-auto max-w-6xl px-6 pt-14 pb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: "var(--p-mark)" }}>{t(card.company || card.name)}</p>
                <h1 className="mt-2 text-[36px] md:text-[46px] tracking-tight">{t(page?.label ?? "")}</h1>
                <span className="mt-4 block h-1 w-12 rounded-full" style={{ background: "var(--grad)" }} />
              </div>
              {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-page-whatsapp")} className={`${BTN} px-5 py-2.5 text-sm ${FOCUS}`}><MessageCircle className="h-4 w-4" /> {t(hero?.ctaLabel || "WhatsApp")}</a>}
            </div>
          </section>
        )}

        {groups.map((g, i) => Array.isArray(g)
          ? <SiteRun key={g[0].id} run={g} index={i} {...runProps} />
          : <Pulled key={g.key} section={g} index={i} {...runProps} />)}

        {/* Updates — the owner's recent daily posters: the whole page, or the latest three on Home. */}
        {showUpdates && (page?.slug === UPDATES || (isHome && !(card.site?.home?.hidden ?? []).includes(UPDATES))) && (
          <Section wide index={groups.length} theme={theme} eyebrow={hiLang ? "अपडेट" : t("Updates")} title={page?.slug === UPDATES ? (hiLang ? "हमारी ताज़ा अपडेट" : t("Our latest updates")) : (hiLang ? "ताज़ा" : t("Latest from us"))}
            aside={page?.slug !== UPDATES && updates.length > 3 ? <SeeAll href={hrefFor(UPDATES)} go={go} slug={UPDATES}>{hiLang ? "सभी अपडेट" : t("All updates")}</SeeAll> : undefined}>
            <UpdatesGrid items={page?.slug === UPDATES ? updates : updates.slice(0, 3)} waHref={waHref} hasWa={!!wa} username={card.username} hi={hiLang} />
          </Section>
        )}

        {/* Explore — the other pages as big tiles at the end of the home page; visitors rarely open the menu on their own. */}
        {page?.slug === first && explorePages.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 py-14" data-reveal>
            <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: "var(--p-mark)" }}>{hiLang ? "और देखें" : t("Explore")}</p>
            <h2 className="mt-2 text-2xl tracking-tight mb-6">{hiLang ? "पूरी वेबसाइट" : t("More on this website")}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {explorePages.map((p) => { const { Icon, hint } = pageMeta(p, card.language); return (
                <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} className={`group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 ${CARD_HOVER} ${FOCUS}`}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: "var(--grad)", color: ink }}><Icon className="h-6 w-6" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[17px] font-semibold">{t(p.label)}</span>{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
                  <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1" />
                </a>
              ); })}
            </div>
          </section>
        )}

        {/* A new business has no reviews to show, and no way to collect the first ones: its visitors are asked. */}
        {page?.slug === first && reviewCount < 3 && (
          <section className="mx-auto max-w-6xl px-6 pb-4 pt-10" data-reveal>
            <ReviewInvite username={card.username} business={card.company || card.name} hi={hiLang} />
          </section>
        )}

        {/* closing band — skipped when the page already ends on a contact/appointment block */}
        {page?.slug !== "contact" && wa && lastKind !== "contact" && lastKind !== "appointment" && (
          <section className="mx-auto max-w-6xl px-6 pb-20 pt-6" data-reveal>
            <div className="relative overflow-hidden rounded-3xl px-8 py-12 md:px-14 md:py-16 grid md:grid-cols-[1fr_auto] gap-8 items-center" style={{ background: `radial-gradient(60% 90% at 90% 10%, color-mix(in srgb, var(--p-glow) 60%, transparent), transparent 60%), linear-gradient(120deg, var(--p-deep), color-mix(in srgb, var(--p-deep) 55%, var(--p-mid)))`, color: pal.ink }}>
              <div aria-hidden="true" className="dots absolute inset-0 opacity-50" />
              <div className="relative">
                <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: "var(--p-accent)" }}>{hiLang ? "बात करें" : t("Get in touch")}</p>
                <h2 className="mt-3 text-2xl md:text-[34px] tracking-tight" style={{ textWrap: "balance" }}>{t(hasAppointment ? "Ready to see it for yourself?" : `Talk to ${card.name.split(" ")[0] || card.company} today`)}</h2>
                <p className="mt-3 text-[15px] opacity-85 max-w-xl">{t(card.tagline || "Usually replies within a few hours on WhatsApp.")}</p>
              </div>
              <div className="relative flex flex-wrap gap-3">
                <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-cta-whatsapp")} className={`inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold shadow-float ${FOCUS}`} style={pal.tone === "dark" ? { background: "#ffffff", color: pal.deep } : { background: "var(--grad)", color: ink }}><MessageCircle className="h-4 w-4" /> {t(hero?.ctaLabel || "Chat on WhatsApp")}</a>
                {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => trackClick(card.username, "site-cta-phone")} className={`inline-flex items-center gap-2 rounded-full border px-6 py-4 text-[15px] font-semibold ${FOCUS}`} style={{ borderColor: "color-mix(in srgb, currentColor 45%, transparent)" }}><Phone className="h-4 w-4" /> {t("Call")}</a>}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ---- footer: the deep palette colour, light text ---- */}
      <footer style={{ background: "var(--p-foot)", color: "var(--p-foot-ink)" }}>
        <div className="mx-auto max-w-6xl px-6 pt-14 pb-10 grid md:grid-cols-[1.3fr_1fr_1fr] gap-10 text-sm">
          <div>
            {logo && <Img src={logo} alt="" className="h-10 w-auto max-w-[180px] object-contain mb-4 rounded-lg bg-white/90 p-1" />}
            <p className="text-2xl tracking-tight" style={{ fontFamily: "var(--look-head)", fontWeight: "var(--head-w)" as unknown as number }}>{t(card.company || card.name)}</p>
            {card.jobTitle && <p className="mt-1 opacity-75">{t(card.jobTitle)}</p>}
            {card.tagline && <p className="mt-3 max-w-md opacity-75 leading-relaxed">{t(card.tagline)}</p>}
            {card.gstin?.trim() && <p className="mt-2 text-xs mono opacity-60">GSTIN {card.gstin.trim()}</p>}
            {/* One link, one QR — the same address the phone card carries. */}
            <div className="mt-6 flex items-center gap-4">
              <Img src={qr} alt="QR code" className="h-20 w-20 rounded-xl bg-white p-1.5" />
              <div className="space-y-2">
                <p className="text-xs opacity-70">{t("Scan to open this site on your phone")}</p>
                {shareUrl && <p className="text-xs mono break-all opacity-60">{shareUrl.replace(/^https?:\/\//, "")}</p>}
                <div className="flex flex-wrap gap-2">
                  <a href={`/c/${card.username}/vcf`} onClick={() => trackClick(card.username, "vcard")} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-white/10 ${FOCUS}`} style={{ borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}><Download className="h-3.5 w-3.5" /> {t("Save contact")}</a>
                  <a href="?view=card" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-white/10 ${FOCUS}`} style={{ borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}>{t("Digital card")}</a>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold tracking-[0.16em] uppercase opacity-70">{t("Pages")}</p>
            <ul className="mt-4 space-y-2.5">
              {navPages.map((p) => <li key={p.id}><a href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} className={`opacity-85 hover:opacity-100 rounded ${FOCUS}`}>{t(p.label)}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="text-[12px] font-semibold tracking-[0.16em] uppercase opacity-70">{t("Contact")}</p>
            <ul className="mt-4 space-y-2.5">
              {footLinks.map((l) => (
                l.type === "upi"
                  // upi:// does nothing in a desktop browser: the ID is shown to copy, and the link stays for phones.
                  ? <li key={l.id}><UpiLine value={l.value} username={card.username} /></li>
                  : <li key={l.id}><a href={linkHref(l.type, l.value, l.type === "whatsapp" ? waOpen : undefined)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, l.type)} className={`inline-flex items-center gap-2 opacity-85 hover:opacity-100 rounded max-w-full ${FOCUS}`}><LinkIcon type={l.type} className="h-4 w-4 shrink-0" /><span className="truncate max-w-[260px]">{l.value || l.label}</span>{sameNumber && l.type === "whatsapp" && <span className="shrink-0 text-xs opacity-60">· {t("WhatsApp & call")}</span>}</a></li>
              ))}
            </ul>
            {localLine(card) && <p className="mt-5 text-xs opacity-60 leading-relaxed">{localLine(card)}</p>}
          </div>
        </div>
        {/* Every site ends with one door into Shubhora. The link silently carries the owner's username. */}
        {joinHandle && !brand && (
          <div className="mx-auto max-w-6xl px-6 pb-8">
            <a href={`/signup?by=${encodeURIComponent(joinHandle)}`} data-join-door className="flex items-center gap-3 rounded-2xl px-5 py-4 text-white" style={{ background: "#2f4bd8" }}>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">Get your own Shubhora — free</span>
                <span className="block text-sm text-white/80">Card, website, daily posters, WhatsApp AI</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0" />
            </a>
          </div>
        )}
        <div style={{ borderTop: "1px solid color-mix(in srgb, currentColor 15%, transparent)" }}>
          <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs opacity-60">
            <span>© {new Date().getFullYear()} {t(card.company || card.name)}</span>
            <span className="mono">{brand ? (brand.hideBranding ? "" : `Powered by ${brand.name}`) : "Powered by Shubhora"}</span>
          </div>
        </div>
      </footer>
      {/* Floating WhatsApp / Call (desktop, bottom-left — the chat sits bottom-right) and the sticky action bar on phones. */}
      {float !== "none" && (float === "call" ? phone : wa) && (
        <a href={float === "call" ? linkHref(phone!.type, phone!.value) : waHref()} target={float === "call" ? undefined : "_blank"} rel="noreferrer" onClick={() => trackClick(card.username, float === "call" ? "site-float-phone" : "site-float-whatsapp")} aria-label={float === "call" ? "Call" : "WhatsApp"}
          className={`fixed bottom-5 left-5 z-40 hidden h-14 w-14 place-items-center rounded-full text-white shadow-float transition hover:scale-105 md:grid ${FOCUS}`} style={{ background: float === "call" ? "var(--p-mid)" : "#25D366" }}>
          {float === "call" ? <Phone className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
        </a>
      )}
      {(wa || phone) && (
        <div className="fixed inset-x-0 bottom-0 z-40 grid gap-px border-t border-border bg-border md:hidden" style={{ gridTemplateColumns: `repeat(${[phone, wa, mapLink].filter(Boolean).length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => trackClick(card.username, "site-bar-phone")} className="flex items-center justify-center gap-2 bg-surface py-3 text-sm font-semibold"><Phone className="h-4 w-4" style={{ color: "var(--tc)" }} /> {t("Call")}</a>}
          {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-bar-whatsapp")} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white" style={{ background: "#25D366" }}><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
          {mapLink && <a href={linkHref(mapLink.type, mapLink.value)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-bar-map")} className="flex items-center justify-center gap-2 bg-surface py-3 text-sm font-semibold"><Navigation className="h-4 w-4" style={{ color: "var(--tc)" }} /> {hiLang ? "रास्ता" : t("Directions")}</a>}
        </div>
      )}
      {card.popup?.enabled && linkBase !== undefined && <WelcomePopup card={card} theme={theme} active={active} />}
      {!free && <CardChat username={card.username} name={card.name} theme={theme} />}
      {nudge && joinHandle && !brand && <JoinNudge username={card.username} href={`/signup?by=${encodeURIComponent(joinHandle)}`} lang={L.lang} page={active} />}
    </div>
    </TranslateCtx.Provider>
  );
}

/* ---------- section shell: one header contract, alternating surfaces ---------- */
function Section({ title, eyebrow, lead, aside, wide = false, narrow = false, index = 0, children, className = "" }: {
  title?: string; eyebrow?: string; lead?: string; aside?: React.ReactNode; wide?: boolean; narrow?: boolean; index?: number; children: React.ReactNode; theme?: string; className?: string;
}) {
  return (
    <section className={className} style={index % 2 ? { background: "var(--p-soft)" } : undefined} data-reveal>
      <div className={`mx-auto px-6 py-14 md:py-[76px] ${narrow ? "max-w-2xl" : wide ? "max-w-6xl" : "max-w-3xl"}`}>
        {(title || eyebrow || lead) && (
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              {eyebrow && <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: "var(--p-mark)" }}>{eyebrow}</p>}
              {title && <h2 className="mt-2 text-[28px] md:text-[34px] tracking-tight leading-tight">{title}</h2>}
              {title && <span className="mt-4 block h-1 w-12 rounded-full" style={{ background: "var(--grad)" }} />}
              {lead && <p className="mt-4 text-[17px] text-muted leading-relaxed">{lead}</p>}
            </div>
            {aside}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** "See all 12 products →" — the link from a home preview to its page. */
function SeeAll({ href, go, slug, children }: { href: string; go: (s: string) => void; slug: string; children: React.ReactNode }) {
  return <a href={href} onClick={(e) => { e.preventDefault(); go(slug); }} className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface2 ${FOCUS}`} style={{ color: "var(--tc)" }}>{children} <ArrowRight className="h-4 w-4" /></a>;
}

/** Recent daily posters as cards: picture, date, the caption's first lines, share on WhatsApp. */
function UpdatesGrid({ items, waHref, hasWa, username, hi }: { items: SiteUpdate[]; waHref: (t?: string) => string; hasWa: boolean; username: string; hi: boolean }) {
  const t = useT();
  const [zoom, setZoom] = useState<Zoom>(null);
  const clean = (c?: string | null) => (c ?? "").replace(/#[\w\u0900-\u097F]+/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((u, i) => {
          const text = clean(u.caption);
          const d = new Date(`${u.date}T00:00:00+05:30`);
          return (
            <article key={u.url} className={`overflow-hidden rounded-3xl border border-border bg-surface ${CARD_HOVER}`}>
              <button type="button" onClick={() => setZoom({ images: items.map((x) => x.url), i, alt: u.title })} className={`block w-full cursor-zoom-in ${FOCUS}`}><Img src={u.url} alt={u.title} className="aspect-[4/5] w-full object-cover" eager={i < 3} /></button>
              <div className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted"><Newspaper className="mr-1 inline h-3.5 w-3.5" />{d.toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                <h3 className="mt-1 text-[16px] font-semibold">{t(u.title)}</h3>
                {text && <p className="mt-1.5 text-sm leading-relaxed text-muted line-clamp-3">{t(text.slice(0, 220))}</p>}
                {hasWa && <a href={waHref(`Hi, I saw your update "${u.title}"`)} target="_blank" rel="noreferrer" onClick={() => trackClick(username, "site-update-whatsapp")} className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold ${FOCUS}`} style={{ color: "var(--tc)" }}><MessageCircle className="h-4 w-4" /> {hi ? "पूछें" : t("Ask about this")}</a>}
              </div>
            </article>
          );
        })}
      </div>
      {zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />}
    </>
  );
}

/** The small caption above a section title, per block kind (skipped when it would repeat the title). */
function eyebrowFor(kind: CardBlock["kind"], title: string, hi: boolean): string | undefined {
  const map: Partial<Record<CardBlock["kind"], [string, string]>> = {
    product: ["Products", "प्रोडक्ट"], services: ["Services", "सेवाएँ"], highlights: ["Why us", "क्यों चुनें"], testimonials: ["Reviews", "रिव्यू"], faq: ["FAQ", "सवाल-जवाब"],
    gallery: ["Gallery", "गैलरी"], image: ["Pictures", "चित्र"], carousel: ["Pictures", "चित्र"], video: ["Watch", "देखिए"], location: ["Find us", "पता"], hours: ["Timings", "समय"], contact: ["Contact", "संपर्क"],
    showcase: ["Showcase", "शोकेस"], compare: ["Compare", "तुलना"], pdf: ["Download", "डाउनलोड"],
  };
  const e = map[kind]?.[hi ? 1 : 0];
  if (!e) return undefined;
  const a = title.trim().toLowerCase(), b = e.toLowerCase();
  return a === b || a.startsWith(b) || (a.length < 22 && b.includes(a)) ? undefined : e;
}

/** "Been here? Tell others" — the first reviews of a new business. What a visitor writes is saved for the
 *  owner to approve; nothing appears on the card until they do. */
function ReviewInvite({ username, business, hi }: { username: string; business: string; hi: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [text, setText] = useState("");
  const [trap, setTrap] = useState("");
  const L = (en: string, h: string) => (hi ? h : t(en));

  async function send() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/card/review", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, name, city, text, rating, website: trap }) });
      const j = await r.json().catch(() => ({ ok: false }));
      if (!j.ok) { setErr(j.error || L("Could not send just now.", "अभी भेज नहीं पाए।")); return; }
      setSent(true);
    } catch { setErr(L("Could not send just now.", "अभी भेज नहीं पाए।")); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] outline-none focus:border-[var(--tc)]";
  return (
    <div className="rounded-3xl border border-border bg-surface p-7 md:p-9">
      {sent ? (
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--grad)", color: "var(--p-on)" }}><Check className="h-5 w-5" /></span>
          <div>
            <h2 className="text-xl tracking-tight">{L("Thank you!", "धन्यवाद!")}</h2>
            <p className="mt-1 text-[15px] text-muted">{L(`${business} will see your words and put them on this page.`, `${business} आपकी बात देखकर इसी page पर लगाएँगे।`)}</p>
          </div>
        </div>
      ) : !open ? (
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: "var(--p-mark)" }}>{L("Your words", "आपकी राय")}</p>
            <h2 className="mt-2 text-[24px] md:text-[28px] tracking-tight">{L("Been here? Tell others.", "यहाँ आ चुके हैं? दूसरों को बताइए।")}</h2>
            <p className="mt-2 text-[15px] text-muted max-w-xl">{L("A line from you helps the next customer decide. It goes up once the owner has seen it.", "आपकी दो लाइनें अगले ग्राहक का फ़ैसला आसान कर देंगी। मालिक के देखने के बाद यहाँ लग जाएँगी।")}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold shadow-float ${FOCUS}`} style={{ background: "var(--grad)", color: "var(--p-on)" }}>
            <Star className="h-4 w-4" /> {L("Write a review", "Review लिखें")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:max-w-2xl">
          <h2 className="text-[24px] tracking-tight">{L(`How was ${business}?`, `${business} कैसा लगा?`)}</h2>
          <span className="inline-flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i}`} className={`rounded ${FOCUS}`}>
                <Star className="h-8 w-8" style={{ color: i <= rating ? "#f59e0b" : "var(--border)", fill: i <= rating ? "#f59e0b" : "transparent" }} />
              </button>
            ))}
          </span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={300} placeholder={L("What was good? (2-3 lines)", "क्या अच्छा लगा? (2–3 लाइन)")} className={field} />
          <div className="grid gap-4 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={L("Your name", "आपका नाम")} className={field} />
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} placeholder={L("Your city (optional)", "आपका शहर (optional)")} className={field} />
          </div>
          <input value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={send} disabled={busy || !name.trim() || text.trim().length < 10} className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold shadow-float disabled:opacity-60 ${FOCUS}`} style={{ background: "var(--grad)", color: "var(--p-on)" }}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{L("Send", "भेजें")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={`rounded-full border border-border px-5 py-3.5 text-[15px] font-semibold ${FOCUS}`}>{L("Cancel", "रहने दें")}</button>
          </div>
          <p className="text-xs text-muted">{L("Your review is sent to the owner and appears here once they approve it.", "आपकी review मालिक के पास जाएगी और उनके मंज़ूर करने पर यहाँ दिखेगी।")}</p>
        </div>
      )}
    </div>
  );
}

/** A UPI ID that can actually be used from a computer: tap on a phone, copy on a desktop. */
function UpiLine({ value, username }: { value: string; username: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => { setCopied(true); trackClick(username, "upi-copy"); setTimeout(() => setCopied(false), 1600); }).catch(() => undefined);
  };
  return (
    <span className="inline-flex items-center gap-2 max-w-full">
      <a href={linkHref("upi", value)} onClick={() => trackClick(username, "upi")} className={`inline-flex items-center gap-2 opacity-85 hover:opacity-100 rounded max-w-full ${FOCUS}`}>
        <LinkIcon type="upi" className="h-4 w-4 shrink-0" /><span className="truncate max-w-[200px] mono">{value}</span>
      </a>
      <button type="button" onClick={copy} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition hover:bg-white/10 ${FOCUS}`} style={{ borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}>
        {copied ? t("Copied") : t("Copy")}
      </button>
    </span>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="inline-flex gap-0.5" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-4 w-4" style={{ color: i <= n ? "#f59e0b" : "var(--border)", fill: i <= n ? "#f59e0b" : "transparent" }} />)}</span>;
}

type RunProps = { run: CardBlock[]; index: number; card: Card; theme: string; ink: string; waHref: (t?: string) => string; go: (slug: string) => void; links: Card["links"]; hrefFor: (slug: string) => string };

/** A run of consecutive same-kind blocks (or a single block) → one section. */
function SiteRun(p: RunProps) {
  const { run, index, theme } = p;
  const t = useT();
  const hi = p.card.language === "hi";
  const first = run[0];
  if (run.length === 1) return <SiteBlock {...p} block={first} />;
  switch (first.kind) {
    case "services": {
      const list = run as Extract<CardBlock, { kind: "services" }>[];
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrowFor("services", list[0].title, hi)} title={t(list[0].title)}>
          {list.map((b, bi) => (
            <div key={b.id} className={bi ? "mt-14" : ""}>
              {bi > 0 && <h3 className="text-xl font-semibold tracking-tight mb-6">{t(b.title)}</h3>}
              <ServicesGrid items={b.items} />
            </div>
          ))}
        </Section>
      );
    }
    case "about": {
      const list = run as Extract<CardBlock, { kind: "about" }>[];
      const withImg = list.filter((b) => b.imageUrl);
      return (
        <Section wide index={index} theme={theme}>
          {withImg.length > 0 && <div className="mb-12"><AboutBody block={withImg[0]} hi={hi} /></div>}
          <div className={`grid gap-8 ${list.filter((b) => !b.imageUrl || b !== withImg[0]).length > 1 ? "md:grid-cols-2" : ""}`}>
            {list.filter((b) => b !== withImg[0]).map((b) => (
              <div key={b.id} className="rounded-3xl border border-border bg-surface p-8">
                <h2 className="text-[22px] tracking-tight">{t(b.title)}</h2>
                <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted">{paras(b.body).map((x, i) => <p key={i}>{t(x)}</p>)}</div>
              </div>
            ))}
          </div>
        </Section>
      );
    }
    case "highlights": {
      const list = run as Extract<CardBlock, { kind: "highlights" }>[];
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrowFor("highlights", list[0].title, hi)} title={t(list[0].title)}>
          {list.map((b, bi) => (
            <div key={b.id} className={bi ? "mt-12" : ""}>
              {bi > 0 && <h3 className="text-xl font-semibold tracking-tight mb-6">{t(b.title)}</h3>}
              <HighlightsGrid items={b.items} theme={theme} />
            </div>
          ))}
        </Section>
      );
    }
    case "cta": {
      const list = run as Extract<CardBlock, { kind: "cta" }>[];
      return (
        <Section wide index={index} theme={theme}>
          <div className={`grid gap-5 ${list.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {list.map((b) => <CtaCard key={b.id} block={b} card={p.card} theme={theme} ink={p.ink} go={p.go} />)}
          </div>
        </Section>
      );
    }
    default:
      return <>{run.map((b) => <SiteBlock key={b.id} {...p} block={b} />)}</>;
  }
}

function ServicesGrid({ items }: { items: { name: string; desc: string }[] }) {
  const t = useT();
  const list = items.filter((s) => s.name.trim());
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {list.map((s, i) => (
        <div key={i} className={`rounded-2xl border border-border bg-surface p-7 ${CARD_HOVER}`}>
          <span className="inline-grid h-9 w-9 place-items-center rounded-xl text-xs font-bold tracking-wider" style={{ background: "var(--grad)", color: "var(--p-on)" }}>{String(i + 1).padStart(2, "0")}</span>
          <h3 className="mt-4 text-[17px] font-semibold">{t(s.name.replace(/^\d+[.)]\s*/, ""))}</h3>
          {s.desc && <p className="mt-2 text-[15px] text-muted leading-relaxed">{t(s.desc)}</p>}
        </div>
      ))}
    </div>
  );
}

/** "How it works": numbered circles joined by a line, the step under each — a path a visitor follows. */
function StepsRow({ items }: { items: { name: string; desc: string }[] }) {
  const t = useT();
  const list = items.filter((s) => s.name.trim()).slice(0, 5);
  const cols = list.length >= 4 ? "md:grid-cols-4" : list.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return (
    <ol className={`relative grid gap-8 ${cols}`}>
      <span aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-px md:block" style={{ background: "linear-gradient(90deg, transparent, var(--p-mid) 15%, var(--p-mid) 85%, transparent)", opacity: 0.45 }} />
      {list.map((s, i) => (
        <li key={i} className="relative">
          <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full text-base font-bold shadow-float" style={{ background: "var(--grad)", color: "var(--p-on)" }}>{i + 1}</span>
          <h3 className="mt-5 text-[17px] font-semibold">{t(s.name.replace(/^\d+[.)]\s*/, ""))}</h3>
          {s.desc && <p className="mt-2 text-[15px] text-muted leading-relaxed">{t(s.desc)}</p>}
        </li>
      ))}
    </ol>
  );
}

function HighlightsGrid({ items, theme }: { items: string[]; theme: string }) {
  const t = useT();
  const list = items.map((s) => s.trim()).filter(Boolean);
  // Same split as the phone card; the item is translated whole, then its emoji comes off.
  const short = list.length > 0 && list.every((s) => splitGlyph(s).text.length <= 24);
  // "Why choose us" (every point ticked): a grid of cards with a check, on its own — a row of small pills read
  // as an afterthought and left the section looking empty.
  const ticked = list.length >= 3 && list.every((s) => s.startsWith("✅"));
  if (ticked) {
    return (
      <div className={`grid sm:grid-cols-2 ${list.length % 3 === 0 || list.length >= 5 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
        {list.map((it, i) => { const { text } = glyphText(it, t); return (
          <div key={i} className={`flex items-start gap-3 rounded-2xl border border-border bg-surface px-5 py-4 ${CARD_HOVER}`}>
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: tint(theme), color: "var(--tc)" }}><Check className="h-4 w-4" /></span>
            <span className="text-[15px] font-medium leading-snug">{text}</span>
          </div>
        ); })}
      </div>
    );
  }
  if (short) {
    return (
      <ol className="flex flex-wrap gap-3">
        {list.map((it, i) => { const { glyph, text } = glyphText(it, t); return <li key={i} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium"><span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: tint(theme), color: "var(--tc)" }}>{glyph ?? i + 1}</span>{text}</li>; })}
      </ol>
    );
  }
  const cols = list.length % 3 === 0 || list.length === 5 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <div className={`grid sm:grid-cols-2 ${cols} gap-5`}>
      {list.map((it, i) => { const { glyph, text } = glyphText(it, t); return (
        <div key={i} className={`rounded-2xl border border-border bg-surface p-6 ${CARD_HOVER}`}>
          <span className="h-11 w-11 rounded-xl grid place-items-center text-xl" style={{ background: tint(theme), color: "var(--tc)" }}>{glyph ?? <Check className="h-5 w-5" />}</span>
          <p className="mt-4 font-semibold text-[15px] leading-snug">{text}</p>
        </div>
      ); })}
    </div>
  );
}

function AboutBody({ block, hi }: { block: Extract<CardBlock, { kind: "about" }>; hi: boolean }) {
  const t = useT();
  return (
    <div className={`grid gap-12 items-center ${block.imageUrl ? "md:grid-cols-[0.9fr_1.1fr]" : ""}`}>
      {block.imageUrl && (
        <div className="relative">
          <div aria-hidden="true" className="absolute -left-4 -top-4 h-28 w-28 rounded-3xl opacity-60" style={{ background: "var(--grad)" }} />
          <Img src={block.imageUrl} alt="" className="relative w-full h-auto max-h-[520px] object-cover rounded-3xl border border-border shadow-float" />
        </div>
      )}
      <div>
        <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: "var(--p-mark)" }}>{hi ? "परिचय" : t("About")}</p>
        <h2 className="mt-2 text-[28px] md:text-[34px] tracking-tight leading-tight">{t(block.title)}</h2>
        <span className="mt-4 block h-1 w-12 rounded-full" style={{ background: "var(--grad)" }} />
        <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-muted">{paras(block.body).map((x, i) => <p key={i}>{t(x)}</p>)}</div>
      </div>
    </div>
  );
}

function CtaCard({ block, card, theme, ink, go }: { block: Extract<CardBlock, { kind: "cta" }>; card: Card; theme: string; ink: string; go: (s: string) => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const sep = block.joinUrl.includes("?") ? "&" : "?";
  const link = block.referralCode ? `${block.joinUrl}${sep}ref=${encodeURIComponent(block.referralCode)}` : block.joinUrl;
  const internal = link.startsWith("#");
  const btn = `${BTN} px-6 py-3 text-[15px] ${FOCUS}`;
  void theme; void ink;
  return (
    <div className="rounded-3xl border border-border bg-surface p-8 flex flex-col">
      {block.title && <h3 className="text-[22px] font-semibold tracking-tight">{t(block.title)}</h3>}
      {block.body && <p className={`${block.title ? "mt-2 text-[15px] text-muted" : "text-[20px] font-semibold tracking-tight"} leading-relaxed`}>{t(block.body)}</p>}
      <div className="mt-auto pt-6 space-y-3">
        {link && (internal
          ? <button type="button" onClick={() => { trackClick(card.username, "cta-join"); go(link.slice(1)); }} className={btn}>{t(block.joinLabel || "Learn more")}</button>
          : <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(card.username, "cta-join")} className={btn}><UserPlus className="h-4 w-4" /> {t(block.joinLabel || "Join Now")}</a>)}
        {link && block.referralCode && (
          <button type="button" onClick={() => { try { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }} className={`w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted ${FOCUS}`}>
            <span className="truncate">{link}</span><span className="inline-flex items-center gap-1 shrink-0"><Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy referral link"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function OfferCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }} className={`inline-flex items-center gap-3 rounded-2xl border px-6 py-4 text-xl font-bold mono ${FOCUS}`} style={{ background: "color-mix(in srgb, currentColor 12%, transparent)", borderColor: "color-mix(in srgb, currentColor 35%, transparent)" }}>
      {code}<span className="inline-flex items-center gap-1 text-xs font-semibold"><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/* ---------- product cards (the products page and the home preview) ---------- */
type Zoom = { images: string[]; i: number; alt: string } | null;
const galleryOf = (p: ProductItem) => [...(p.images ?? []), ...(p.imageUrl ? [p.imageUrl] : [])].filter((u, j, a) => u && a.indexOf(u) === j).slice(0, 3);

/** One product on a page of its own: the picture big on the left, everything about it on the right. The grid
 *  card is a teaser; this is the page a visitor lands on from a shared link or from search. */
function ProductDetail({ p, card, theme, ink, waHref, hasWa, onZoom }: { p: ProductItem; card: Card; theme: string; ink: string; waHref: (t?: string) => string; hasWa: boolean; onZoom: (z: Zoom) => void }) {
  const t = useT();
  const hi = card.language === "hi";
  const gallery = galleryOf(p);
  const mrp = parsePrice(p.mrp), price = parsePrice(p.price);
  const saved = mrp && price && mrp > price ? mrp - price : null;
  const discount = saved && mrp ? Math.round((saved / mrp) * 100) : null;
  const features = (p.features ?? []).filter(Boolean);
  const specs = (p.specs ?? []).filter((x) => x.label || x.value);
  const waText = `Hi ${card.name.split(" ")[0]}, I'm interested in "${p.name}". Please share details.`;
  const initial = Array.from((p.name ?? "").trim())[0]?.toUpperCase() ?? "";
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14 items-start">
      <div className="grid gap-3">
        <div className="aspect-square relative overflow-hidden rounded-3xl border border-border" style={{ background: `radial-gradient(80% 60% at 50% 100%, ${tint(theme, 0.14)}, transparent 70%), var(--p-soft)` }}>
          {gallery[0]
            ? <button type="button" onClick={() => onZoom({ images: gallery, i: 0, alt: p.name })} className={`absolute inset-0 p-8 cursor-zoom-in ${FOCUS}`}><FitImg src={gallery[0]} alt={p.name} className="h-full w-full object-contain" eager /></button>
            : <span aria-hidden="true" className="absolute inset-10 rounded-2xl grid place-items-center text-7xl font-semibold" style={{ background: tint(theme), color: "var(--tc)" }}>{initial}</span>}
          {discount && <span className="absolute right-5 top-5 rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white shadow-card">{discount}% OFF</span>}
        </div>
        {gallery.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            {gallery.slice(1, 5).map((u, j) => (
              <button key={j} type="button" onClick={() => onZoom({ images: gallery, i: j + 1, alt: p.name })} className={`aspect-square overflow-hidden rounded-2xl border border-border bg-surface p-2 ${FOCUS}`}>
                <FitImg src={u} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        {p.badge && <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--grad)", color: ink }}>{t(p.badge)}</span>}
        <h2 className="mt-3 text-[28px] md:text-[34px] tracking-tight leading-tight">{t(p.name)}</h2>
        {(p.price || p.mrp) && (
          <p className="mt-4 text-2xl font-semibold">
            {p.price || p.mrp}
            {saved && <span className="ml-3 text-base text-muted line-through font-normal">{p.mrp}</span>}
            {saved && <span className="block mt-1 text-sm font-medium" style={{ color: "var(--tc)" }}>{hi ? `आप ₹${saved.toLocaleString("en-IN")} बचाते हैं` : `You save ₹${saved.toLocaleString("en-IN")}`}</span>}
          </p>
        )}
        {p.desc && <p className="mt-5 text-[17px] text-muted leading-relaxed">{t(p.desc)}</p>}
        {features.length > 0 && <ul className="mt-6 space-y-2 text-[16px]">{features.slice(0, 8).map((f, j) => <li key={j} className="flex items-start gap-2.5"><Check className="h-4 w-4 mt-1.5 shrink-0" style={{ color: "var(--tc)" }} />{t(f)}</li>)}</ul>}
        {specs.length > 0 && (
          <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px] border-t border-border pt-5">
            {specs.map((x, j) => <div key={j} className="contents"><dt className="text-muted">{t(x.label)}</dt><dd className="font-medium">{t(x.value)}</dd></div>)}
          </dl>
        )}
        {hasWa && <a href={waHref(waText)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-product-whatsapp")} className={`mt-8 inline-flex ${BTN} px-7 py-4 text-[15px] ${FOCUS}`}><MessageCircle className="h-4 w-4" /> {t(p.ctaLabel || "Order on WhatsApp")}</a>}
      </div>
    </div>
  );
}

function ProductGrid({ items, card, theme, ink, waHref, hasWa, onZoom, cols = 3, hrefFor, go }: { items: ProductItem[]; card: Card; theme: string; ink: string; waHref: (t?: string) => string; hasWa: boolean; onZoom: (z: Zoom) => void; cols?: 3 | 4; hrefFor?: (slug: string) => string; go?: (slug: string) => void }) {
  const t = useT();
  // Each product has an address of its own (/p-kaju-katli): a link the owner can send by itself, and a page
  // search can index. On the product's own page there is nothing to link to.
  const addressOf = new Map(cardProducts(card).map((x) => [x.item, x.slug]));
  const single = items.length === 1;
  // No photo anywhere in the block: compact cards without an empty picture area.
  const compact = !items.some((p) => galleryOf(p).length > 0);
  return (
    <div className={`grid sm:grid-cols-2 ${cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-6`}>
      {items.map((p, i) => {
        const gallery = galleryOf(p);
        const mrp = parsePrice(p.mrp), price = parsePrice(p.price);
        const saved = mrp && price && mrp > price ? mrp - price : null;
        const discount = saved && mrp ? Math.round((saved / mrp) * 100) : null;
        const features = (p.features ?? []).filter(Boolean);
        const specs = (p.specs ?? []).filter((s) => s.label || s.value);
        const waText = `Hi ${card.name.split(" ")[0]}, I'm interested in "${p.name}". Please share details.`;
        const initial = Array.from((p.name ?? "").trim())[0]?.toUpperCase() ?? "";
        return (
          <div key={i} className={`group rounded-3xl border border-border bg-surface overflow-hidden flex flex-col ${CARD_HOVER}`}>
            {!compact && (
              <div className="aspect-[4/5] relative overflow-hidden" style={{ background: `radial-gradient(80% 60% at 50% 100%, ${tint(theme, 0.14)}, transparent 70%), var(--p-soft)` }}>
                {gallery[0]
                  ? <button type="button" onClick={() => onZoom({ images: gallery, i: 0, alt: p.name })} className={`absolute inset-0 p-6 cursor-zoom-in ${FOCUS}`}><FitImg src={gallery[0]} alt={p.name} className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none" eager /></button>
                  // No photo for this item: its first letter, never an empty box.
                  : <span aria-hidden="true" className="absolute inset-8 rounded-2xl grid place-items-center text-6xl font-semibold" style={{ background: tint(theme), color: "var(--tc)" }}>{initial}</span>}
                {(p.badge || discount) && (
                  <div className="absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
                    {p.badge ? <span className="max-w-full truncate rounded-full px-3 py-1 text-xs font-semibold shadow-card" style={{ background: "var(--grad)", color: ink }}>{t(p.badge)}</span> : <span />}
                    {discount && <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white shadow-card">{discount}% OFF</span>}
                  </div>
                )}
              </div>
            )}
            {gallery.length > 1 && (
              <div className="flex gap-2 px-6 pt-4">
                {gallery.map((u, j) => <button key={j} type="button" onClick={() => onZoom({ images: gallery, i: j, alt: p.name })} className={`h-14 w-14 rounded-lg overflow-hidden border border-border bg-surface2/60 ${FOCUS}`}><Img src={u} alt="" className="h-full w-full object-contain p-1" /></button>)}
              </div>
            )}
            <div className="p-6 flex-1 flex flex-col">
              {compact && (p.badge || discount) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {p.badge && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--grad)", color: ink }}>{t(p.badge)}</span>}
                  {discount && <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-white">{discount}% OFF</span>}
                </div>
              )}
              {(() => {
                const slug = addressOf.get(p);
                const title = <h3 className="text-[17px] font-semibold">{t(p.name)}</h3>;
                return slug && hrefFor && go && !single
                  ? <a href={hrefFor(slug)} onClick={(e) => { e.preventDefault(); go(slug); }} className={`rounded ${FOCUS}`}>{title}</a>
                  : title;
              })()}
              {p.desc && <p className="mt-1.5 text-muted text-[15px] leading-relaxed">{t(p.desc)}</p>}
              {features.length > 0 && <ul className="mt-4 space-y-1.5 text-[15px]">{features.slice(0, 5).map((f, j) => <li key={j} className="flex items-start gap-2"><Check className="h-4 w-4 mt-1 shrink-0" style={{ color: "var(--tc)" }} />{t(f)}</li>)}</ul>}
              {specs.length > 0 && (
                <details className="mt-4 group/specs">
                  <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-medium inline-flex items-center gap-1 rounded ${FOCUS}`} style={{ color: "var(--tc)" }}>Specifications <ChevronDown className="h-4 w-4 transition-transform group-open/specs:rotate-180" /></summary>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">{specs.map((s, j) => <div key={j} className="contents"><dt className="text-muted">{t(s.label)}</dt><dd className="font-medium">{t(s.value)}</dd></div>)}</dl>
                </details>
              )}
              <div className="mt-auto pt-5">
                {(p.price || p.mrp) && (
                  <p className="mb-4 text-lg font-semibold">
                    {p.price || p.mrp}
                    {saved && <span className="ml-2 text-sm text-muted line-through font-normal">{p.mrp}</span>}
                    {saved && <span className="block text-xs font-medium" style={{ color: "var(--tc)" }}>You save ₹{saved.toLocaleString("en-IN")}</span>}
                  </p>
                )}
                <div className="flex gap-2">
                  {hasWa && <a href={waHref(waText)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-product-whatsapp")} className={`flex-1 ${BTN} px-5 py-3 text-sm ${FOCUS}`}><MessageCircle className="h-4 w-4" /> {t(p.ctaLabel || "Order on WhatsApp")}</a>}
                  {(() => {
                    const slug = addressOf.get(p);
                    return slug && hrefFor && go && !single
                      ? <a href={hrefFor(slug)} onClick={(e) => { e.preventDefault(); go(slug); }} aria-label={t("Open this product")} className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border border-border ${FOCUS}`}><ArrowRight className="h-4 w-4" /></a>
                      : null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- the home page's pulled previews ---------- */
function Pulled({ section: s, index, card, theme, ink, waHref, go, links, hrefFor }: { section: Exclude<HomeSection, { kind: "block" }>; index: number } & Omit<RunProps, "run" | "index">) {
  const t = useT();
  const hi = card.language === "hi";
  const [zoom, setZoom] = useState<Zoom>(null);
  const lightbox = zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />;
  const hasWa = links.some((l) => l.type === "whatsapp");
  switch (s.kind) {
    case "featured":
      return (
        <Section wide index={index} theme={theme} eyebrow={hi ? "प्रोडक्ट" : t("Products")} title={t(s.title)}
          aside={s.total > s.items.length ? <SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? `सभी ${s.total} प्रोडक्ट` : t(`All ${s.total} products`)}</SeeAll> : undefined}>
          <ProductGrid items={s.items} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={setZoom} cols={s.items.length === 4 ? 4 : 3} hrefFor={hrefFor} go={go} />
          {lightbox}
        </Section>
      );
    case "gallery": {
      const imgs = s.images;
      return (
        <Section wide index={index} theme={theme} eyebrow={hi ? "गैलरी" : t("Gallery")} title={t(s.title)}
          aside={<SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? `सभी ${s.total} फ़ोटो` : t(`All ${s.total} photos`)}</SeeAll>}>
          <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:h-[520px]">
            {imgs.map((g, i) => (
              <button key={i} type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url!), i, alt: g.label })} className={`group relative overflow-hidden rounded-2xl border border-border cursor-zoom-in ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square md:aspect-auto"} ${FOCUS}`}>
                <Img src={g.url!} alt={g.label} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none" eager={i < 3} />
                {g.label && <span className="absolute inset-x-0 bottom-0 px-3 py-2 text-left text-xs text-white bg-gradient-to-t from-black/60 to-transparent">{t(g.label)}</span>}
              </button>
            ))}
          </div>
          {lightbox}
        </Section>
      );
    }
    case "reviews":
      return (
        <Section wide index={index} theme={theme} eyebrow={hi ? "रिव्यू" : t("Reviews")} title={t(s.title)}
          aside={<div className="flex items-center gap-4"><span className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--look-head)", color: "var(--tc)" }}>{(Math.round(s.avg * 10) / 10).toFixed(1)}</span><span className="text-sm text-muted"><Stars n={Math.round(s.avg)} /><span className="block mt-0.5">{hi ? `${s.total} ग्राहक` : t(`${s.total} customer reviews`)}</span></span>{s.total > s.items.length && <SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? "सभी पढ़ें" : t("Read all")}</SeeAll>}</div>}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {s.items.map((x, i) => (
              <figure key={i} className={`relative rounded-2xl border border-border bg-surface p-7 ${CARD_HOVER}`}>
                <Quote className="absolute right-6 top-6 h-8 w-8 opacity-15" style={{ color: "var(--tc)" }} />
                <Stars n={x.rating} />
                <blockquote className="mt-4 text-[15px] leading-relaxed">“{t(x.text)}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-full text-sm" style={{ background: tint(theme), color: "var(--tc)" }}>{Array.from(x.name.trim())[0]?.toUpperCase() ?? "★"}</span>{x.name}</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      );
    case "faq":
      return (
        <Section wide index={index} theme={theme} eyebrow="FAQ" title={t(s.title)} aside={s.total > s.items.length ? <SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? "सभी सवाल" : t("All questions")}</SeeAll> : undefined}>
          <div className="grid md:grid-cols-2 gap-x-10">
            {s.items.map((f, i) => (
              <details key={i} name="home-faq" className="group border-b border-border py-1">
                <summary className={`flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-xl px-3 py-4 -mx-3 font-semibold text-[16px] hover:bg-surface2 transition-colors ${FOCUS}`}>{t(f.q)}<ChevronDown className="h-5 w-5 text-muted shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
                <p className="pb-5 text-[15px] text-muted leading-relaxed max-w-[65ch]">{t(f.a)}</p>
              </details>
            ))}
          </div>
        </Section>
      );
    case "visit": {
      const loc = s.location;
      const address = (loc?.address ?? "").trim();
      const pinUrl = safeMapUrl(loc?.mapUrl);
      const pin = mapPin(pinUrl);
      const mapQ = pin ? `${pin.lat},${pin.lng}` : address;
      const dir = pinUrl || (address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : "");
      return (
        <Section wide index={index} theme={theme} eyebrow={hi ? "पता और समय" : t("Find us")} title={t(s.title)} aside={<SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? "संपर्क पेज" : t("Contact page")}</SeeAll>}>
          <div className={`grid gap-6 ${mapQ ? "md:grid-cols-[1fr_1.2fr]" : ""}`}>
            <div className="space-y-5">
              {loc && (address || dir) && (
                <div className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-6">
                  <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0" style={{ background: tint(theme), color: "var(--tc)" }}><MapPin className="h-5 w-5" /></span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t(loc.title || "Address")}</p>
                    {address && <p className="mt-1 text-[16px] leading-relaxed">{t(address)}</p>}
                    {dir && <a href={dir} target="_blank" rel="noreferrer" className={`mt-3 ${BTN} px-4 py-2 text-sm ${FOCUS}`}><Navigation className="h-4 w-4" /> {hi ? "रास्ता देखें" : t("Get directions")}</a>}
                  </div>
                </div>
              )}
              {s.hours && (
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <div className="flex items-center gap-3 mb-3"><span className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: tint(theme), color: "var(--tc)" }}><Clock className="h-5 w-5" /></span><p className="font-semibold">{t(s.hours.title || "Opening hours")}</p></div>
                  <table className="w-full text-[15px]"><tbody>{s.hours.rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0"><td className="py-2.5 font-medium">{t(r.day)}</td><td className={`py-2.5 text-right tabular-nums ${/closed|बंद/i.test(r.time) ? "text-danger font-medium" : "text-muted"}`}>{t(r.time)}</td></tr>)}</tbody></table>
                </div>
              )}
            </div>
            {mapQ && <iframe title="Map" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed`} className="w-full min-h-[340px] h-full rounded-2xl border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </div>
        </Section>
      );
    }
    default:
      return null;
  }
}

function SiteBlock({ block, index, card, theme, ink, waHref, go, links, hrefFor }: RunProps & { block: CardBlock }) {
  const t = useT();
  const hi = card.language === "hi";
  const [zoom, setZoom] = useState<Zoom>(null);
  const [showAll, setShowAll] = useState(false);
  const hasWa = links.some((l) => l.type === "whatsapp");
  const lightbox = zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />;
  const eyebrow = "title" in block ? eyebrowFor(block.kind, block.title ?? "", hi) : undefined;

  switch (block.kind) {
    case "about":
      return <Section wide index={index} theme={theme}><AboutBody block={block} hi={hi} /></Section>;
    case "highlights":
      return <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}><HighlightsGrid items={block.items} theme={theme} /></Section>;
    case "services": {
      // "How it works" (numbered names) reads as a path, not a grid of cards.
      const isSteps = /^\d+[.)]\s/.test(block.items[0]?.name ?? "");
      return <Section wide index={index} theme={theme} eyebrow={isSteps ? (hi ? "प्रक्रिया" : t("Process")) : eyebrow} title={t(block.title)}>{isSteps ? <StepsRow items={block.items} /> : <ServicesGrid items={block.items} />}</Section>;
    }
    case "product":
      // A product page carries one product: it gets the detail layout, and no heading that repeats its name.
      if (block.items.length === 1 && isProductSlug(block.id.replace(/^prodb-/, ""))) {
        return (
          <Section wide index={index} theme={theme}>
            <ProductDetail p={block.items[0]} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={setZoom} />
            {lightbox}
          </Section>
        );
      }
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <ProductGrid items={block.items} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={setZoom} hrefFor={hrefFor} go={go} />
          {lightbox}
        </Section>
      );
    case "testimonials":
      if (!block.items.length) return null;
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {block.items.map((x, i) => (
              <figure key={i} className={`relative rounded-2xl border border-border bg-surface p-7 ${CARD_HOVER}`}>
                <Quote className="absolute right-6 top-6 h-8 w-8 opacity-15" style={{ color: "var(--tc)" }} />
                <Stars n={x.rating} />
                <blockquote className="mt-4 text-[15px] leading-relaxed">“{t(x.text)}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 text-sm font-semibold"><span className="grid h-9 w-9 place-items-center rounded-full text-sm" style={{ background: tint(theme), color: "var(--tc)" }}>{Array.from(x.name.trim())[0]?.toUpperCase() ?? "★"}</span>{x.name}</figcaption>
              </figure>
            ))}
          </div>
        </Section>
      );
    case "faq":
      return (
        <Section narrow index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="divide-y divide-border border-y border-border">
            {block.items.filter((f) => f.q).map((f, i) => (
              <details key={i} name="faq" className="group py-1">
                <summary className={`flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-xl px-3 py-4 -mx-3 font-semibold text-[16px] hover:bg-surface2 transition-colors ${FOCUS}`}>{t(f.q)}<ChevronDown className="h-5 w-5 text-muted shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
                <p className="px-0 pb-5 text-[15px] text-muted leading-relaxed max-w-[65ch]">{t(f.a)}</p>
              </details>
            ))}
          </div>
        </Section>
      );
    case "gallery": {
      const imgs = block.images.filter((g) => g.url);
      const shown = showAll ? imgs : imgs.slice(0, 12);
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
            {shown.map((g, i) => (
              <button key={i} type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url!), i, alt: g.label })} className={`group relative block w-full break-inside-avoid cursor-zoom-in rounded-2xl overflow-hidden border border-border ${FOCUS}`}>
                <Img src={g.url!} alt={g.label} className="w-full h-auto transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none" eager={i < 8} />
                {g.label && <span className="absolute inset-x-0 bottom-0 px-3 py-2 text-left text-xs text-white bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">{t(g.label)}</span>}
              </button>
            ))}
          </div>
          {imgs.length > shown.length && <button type="button" onClick={() => setShowAll(true)} className={`mx-auto block mt-8 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface2 ${FOCUS}`}>Show all {imgs.length} photos</button>}
          {lightbox}
        </Section>
      );
    }
    case "image": {
      const imgs = block.images.filter((g) => g.url);
      const many = imgs.length > 1;
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={many ? "grid md:grid-cols-2 gap-6" : "mx-auto max-w-5xl space-y-10"}>
            {imgs.map((g, i) => (
              <figure key={i}>
                <button type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url), i, alt: g.caption ?? block.title })} className={`block w-full cursor-zoom-in rounded-3xl border border-border bg-white overflow-hidden shadow-card ${FOCUS}`}>
                  <Img src={g.url} alt={g.caption ?? ""} className={many ? "w-full aspect-[4/3] object-contain p-4" : "w-full h-auto object-contain"} />
                </button>
                {g.caption && <figcaption className="mt-3 text-[15px] text-muted text-center leading-relaxed">{t(g.caption)}</figcaption>}
              </figure>
            ))}
          </div>
          {lightbox}
        </Section>
      );
    }
    case "carousel": {
      const imgs = block.images.filter((g) => g.url);
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {imgs.map((g, i) => (
              <figure key={i} className={`rounded-3xl border border-border bg-surface overflow-hidden ${CARD_HOVER}`}>
                <div className="relative aspect-[4/5]" style={{ background: "var(--p-soft)" }}><button type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url), i, alt: g.caption ?? block.title })} className={`absolute inset-0 p-4 cursor-zoom-in ${FOCUS}`}><FitImg src={g.url} alt={g.caption ?? ""} className="h-full w-full object-contain" eager /></button></div>
                {g.caption && <figcaption className="p-4 text-center font-medium">{t(g.caption)}</figcaption>}
              </figure>
            ))}
          </div>
          {lightbox}
        </Section>
      );
    }
    case "offer":
      return (
        <Section wide index={index} theme={theme}>
          <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-6 items-center" style={{ background: `radial-gradient(60% 90% at 90% 10%, color-mix(in srgb, var(--p-glow) 60%, transparent), transparent 60%), linear-gradient(120deg, var(--p-deep), color-mix(in srgb, var(--p-deep) 55%, var(--p-mid)))`, color: "var(--p-ink)" }}>
            <div aria-hidden="true" className="dots absolute inset-0 opacity-50" />
            <div className="relative">
              <p className="text-[13px] font-semibold tracking-[0.18em] uppercase" style={{ color: "var(--p-accent)" }}>{t(block.title)}</p>
              <p className="mt-2 text-2xl md:text-3xl tracking-tight" style={{ fontFamily: "var(--look-head)", fontWeight: "var(--head-w)" as unknown as number }}>{t(block.text)}</p>
              {block.expires && <p className="mt-2 text-sm opacity-85">Valid till {block.expires}</p>}
            </div>
            <div className="relative flex flex-col items-start gap-3">
              {block.code && <OfferCode code={block.code} />}
              {hasWa && <a href={waHref(`Hi, I'd like to claim: ${block.text}${block.code ? ` (code ${block.code})` : ""}`)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-offer-whatsapp")} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-float ${FOCUS}`} style={{ background: "#ffffff", color: "var(--p-deep)" }}><MessageCircle className="h-4 w-4" /> Claim on WhatsApp</a>}
            </div>
          </div>
        </Section>
      );
    case "location": {
      // The owner's exact pin wins: the link opens it and the map shows it.
      const address = (block.address ?? "").trim();
      const pinUrl = safeMapUrl(block.mapUrl);
      const pin = mapPin(pinUrl);
      const mapQ = pin ? `${pin.lat},${pin.lng}` : address;
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={`grid ${mapQ ? "md:grid-cols-[1fr_1.3fr]" : "max-w-xl"} gap-8 items-start`}>
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-6">
              <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0" style={{ background: tint(theme), color: "var(--tc)" }}><MapPin className="h-5 w-5" /></span>
              <div className="flex-1">{address && <p className="text-[16px] leading-relaxed">{t(block.address)}</p>}<a href={pinUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className={`${address ? "mt-3" : ""} ${BTN} px-4 py-2 text-sm ${FOCUS}`}><Navigation className="h-4 w-4" /> {hi ? "रास्ता देखें" : t("Get directions")}</a></div>
            </div>
            {mapQ && <iframe title="Map" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed`} className="w-full h-[340px] rounded-2xl border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </div>
        </Section>
      );
    }
    case "hours":
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="rounded-2xl border border-border bg-surface p-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-4"><span className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: tint(theme), color: "var(--tc)" }}><Clock className="h-5 w-5" /></span><p className="font-semibold">Opening hours</p></div>
            <table className="w-full text-[15px]"><tbody>{block.rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0"><td className="py-3 font-medium">{t(r.day)}</td><td className={`py-3 text-right tabular-nums ${/closed|बंद/i.test(r.time) ? "text-danger font-medium" : "text-muted"}`}>{t(r.time)}</td></tr>)}</tbody></table>
          </div>
        </Section>
      );
    case "contact":
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-10">
            <div className="space-y-5">
              {block.note && <p className="text-[17px] text-muted leading-relaxed">{t(block.note)}</p>}
              <ul className="space-y-3">
                {links.map((l) => (
                  <li key={l.id}><a href={linkHref(l.type, l.value)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, l.type)} className={`flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 ${CARD_HOVER} ${FOCUS}`}><span className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: tint(theme), color: "var(--tc)" }}><LinkIcon type={l.type} className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-xs text-muted">{t(l.label)}</span><span className="block font-medium truncate">{l.value}</span></span></a></li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-surface p-6 md:p-8 flex flex-col shadow-card"><ContactForm username={card.username} theme={theme} fill /></div>
          </div>
        </Section>
      );
    case "cta":
      if (!block.title) {
        // Untitled CTA = a slim band, not a full section.
        const sep = block.joinUrl.includes("?") ? "&" : "?";
        const link = block.referralCode ? `${block.joinUrl}${sep}ref=${encodeURIComponent(block.referralCode)}` : block.joinUrl;
        const internal = link.startsWith("#");
        const btn = `${BTN} px-6 py-3 text-[15px] shrink-0 ${FOCUS}`;
        return (
          <section className="mx-auto max-w-6xl px-6 py-6" data-reveal>
            <div className="rounded-2xl px-8 py-6 flex flex-wrap items-center justify-between gap-6" style={{ background: "var(--p-soft)" }}>
              {block.body && <p className="text-[18px] font-semibold tracking-tight">{t(block.body)}</p>}
              {link && (internal
                ? <button type="button" onClick={() => { trackClick(card.username, "cta-join"); go(link.slice(1)); }} className={btn}>{t(block.joinLabel || "Learn more")}</button>
                : <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(card.username, "cta-join")} className={btn}>{t(block.joinLabel || "Join Now")}</a>)}
            </div>
          </section>
        );
      }
      return <Section wide index={index} theme={theme}><div className="max-w-2xl"><CtaCard block={block} card={card} theme={theme} ink={ink} go={go} /></div></Section>;
    case "video": {
      const e = embed(block.url);
      const shorts = !!e?.vertical;
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={shorts ? "mx-auto max-w-sm" : "mx-auto max-w-4xl"}>
            <div className={`rounded-3xl overflow-hidden shadow-float bg-black ${shorts ? "aspect-[9/16]" : "aspect-video"}`}>
              {e?.type === "iframe" ? <iframe src={e.src} title={block.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                : e?.type === "video" ? <video src={e.src} poster={block.posterUrl} preload="metadata" controls playsInline className="h-full w-full" />
                : <a href={block.url} target="_blank" rel="noreferrer" className="relative block h-full w-full" style={{ background: `linear-gradient(135deg, var(--p-mid), var(--p-deep))` }}>{block.posterUrl && <Img src={block.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}<span className="absolute inset-0 grid place-items-center"><span className="h-16 w-16 rounded-full bg-white/90 grid place-items-center shadow-float"><Play className="h-7 w-7 translate-x-0.5" style={{ color: theme }} fill="currentColor" /></span></span></a>}
            </div>
            {block.caption && <p className="mt-4 text-[15px] text-muted leading-relaxed">{t(block.caption)}</p>}
          </div>
        </Section>
      );
    }
    case "appointment":
      return (
        <Section wide index={index} theme={theme}>
          <div className="rounded-3xl border border-border bg-surface p-8 md:p-12 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center shadow-card">
            <div>
              <p className="text-[12px] font-semibold tracking-[0.16em] uppercase inline-flex items-center gap-1.5" style={{ color: "var(--p-mark)" }}><CalendarClock className="h-4 w-4" /> Book a demo</p>
              <h2 className="mt-2 text-[28px] tracking-tight leading-tight">{t(block.title)}</h2>
              {block.note && <p className="mt-3 text-[17px] text-muted leading-relaxed max-w-lg">{t(block.note)}</p>}
            </div>
            <div className="max-w-sm w-full md:justify-self-end"><AppointmentBlock block={block} username={card.username} theme={theme} /></div>
          </div>
        </Section>
      );
    case "pdf": {
      const Cmp = block.fileUrl ? "a" : "div";
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <Cmp {...(block.fileUrl ? { href: block.fileUrl, download: block.fileLabel } : {})} className={`max-w-3xl flex flex-col sm:flex-row items-stretch gap-6 rounded-3xl border border-border bg-surface p-5 ${block.fileUrl ? `${CARD_HOVER} ${FOCUS}` : "opacity-70"}`}>
            {block.posterUrl && <Img src={block.posterUrl} alt={block.fileLabel} className="sm:w-56 w-full aspect-[4/3] sm:aspect-auto object-cover rounded-2xl border border-border" />}
            <div className="flex-1 flex items-center gap-4 min-w-0">
              <span className="h-12 w-12 rounded-xl grid place-items-center shrink-0" style={{ background: tint(theme), color: "var(--tc)" }}><FileText className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold truncate">{block.fileLabel}</span>
                <span className="block text-sm text-muted mt-0.5">{block.fileUrl ? t(block.hint || "Download PDF") : "File attaches after upload"}</span>
              </span>
              {block.fileUrl && <Download className="h-5 w-5 text-muted shrink-0" />}
            </div>
          </Cmp>
        </Section>
      );
    }
    case "showcase":
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.items.filter((it) => it.imageUrl || it.label).map((it, i) => {
              const inner = (
                <>
                  <div className="aspect-[16/8] w-full overflow-hidden bg-surface2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.imageUrl && <img src={it.imageUrl} alt={it.label} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold leading-tight">{t(it.label)}</p>
                    {it.sub && <p className="mt-0.5 text-sm text-muted">{t(it.sub)}</p>}
                  </div>
                </>
              );
              const cls = "group block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-shadow hover:shadow-float";
              return it.url
                ? <a key={i} href={it.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
                : <div key={i} className={cls}>{inner}</div>;
            })}
          </div>
        </Section>
      );
    case "compare":
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-[15px]">
              <thead>
                <tr>
                  <th className="text-left p-4 text-muted font-medium bg-surface2/60 w-1/4">Feature</th>
                  <th className="p-4 text-left font-semibold" style={{ background: "var(--grad)", color: ink }}>{t(block.leftLabel)}</th>
                  <th className="p-4 text-left font-semibold bg-surface2 text-muted">{t(block.rightLabel)}</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.filter((r) => r.feature).map((r, i) => {
                  const lOk = r.leftOk !== false, rOk = r.rightOk === true;
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="p-4 text-[12px] font-semibold uppercase tracking-wide text-muted align-top">{t(r.feature)}</td>
                      <td className="p-4 align-top" style={{ background: tint(theme, 0.06) }}><span className="flex items-start gap-2">{lOk ? <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--tc)" }} /> : <X className="h-4 w-4 shrink-0 mt-0.5 text-danger" />}<span className="font-medium">{t(r.left)}</span></span></td>
                      <td className="p-4 align-top text-muted"><span className="flex items-start gap-2">{rOk ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <X className="h-4 w-4 shrink-0 mt-0.5 text-danger" />}<span>{t(r.right)}</span></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      );
    default:
      return null;
  }
}

export type { CardPage };
