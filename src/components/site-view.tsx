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
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { INTRODUCER_KEY } from "@/lib/username";
import { X, Download, Check, ChevronDown, FileText, Copy, Play, UserPlus, CalendarClock, Megaphone, Newspaper, LoaderCircle } from "lucide-react";
import type { Card, CardBlock, CardPage, ProductItem, SiteLayouts, TestimonialItem } from "@/lib/types";
import { ContactForm, AppointmentBlock, ImageLightbox, LanguagePicker, TranslateCtx, WelcomePopup, useCardLang, useT, embed, parsePrice, splitGlyph, glyphText, safeMapUrl, pageMeta, type CardBrand } from "@/components/card-view";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { CardChat } from "@/components/card-chat";
import { JoinNudge } from "@/components/join-nudge";
import { ShubhoraBar } from "@/components/shubhora-bar";
import { NoticeBar, NoticePopup } from "@/components/notice-view";
import { FormBlock } from "@/components/form-block";
import { trackView, trackClick } from "@/lib/track";
import { lookOf } from "@/lib/looks";
import { siteDesign } from "@/lib/site-style";
import { tradeMood } from "@/lib/trade-moods";
import { heroModel, stripEmoji, tradeLabel, type HeroModel } from "@/lib/site-hero";
import { Icon, iconFor } from "@/components/site-icons";
import { cardProducts, isProductSlug } from "@/lib/product-page";
import { homeSections, isEmptyBlock, sinceYear, trustFacts, type HomeSection } from "@/lib/site-home";
import { BottomSheet, CountUp, CtaPair, Display, HERO_CSS, HeroPhoto, Kicker, Marquee, OpenNowChip, SMART_CSS, Sub, TrustRow, Wordmark } from "@/components/site-smart";
import { BentoHero, bentoFacts, BENTO_CSS } from "@/components/site-bento";
import { CinematicHero, ParallaxBand, QuoteRotator, CINEMATIC_CSS } from "@/components/site-cinematic";
import { PosterHero, POSTER_CSS } from "@/components/site-poster";
import type { BlueprintKey } from "@/lib/site-blueprints";
import { aboutLayout, faqLayout, galleryLayout, productsLayout, reviewsLayout, servicesLayout, preferredLayouts, type ProductsLayout } from "@/lib/site-layout";

/** The designer's section layouts (card.site.style.layouts), read by the section components below. */
const LayoutCtx = createContext<SiteLayouts | undefined>(undefined);
/** The page's blueprint (docs/website-looks-v2.md): sections draw themselves a little differently on each. */
const BlueprintCtx = createContext<BlueprintKey | undefined>(undefined);
import { localLine, mapPin, pageHref } from "@/lib/seo";

import { Pic as Img, picUrl } from "@/components/pic";

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
    // The margins are measured on a 640px copy from our own optimiser (same origin, ~10x smaller than the upload).
    img.src = picUrl(src, 640);
    return () => { alive = false; };
  }, [src]);
  return out ?? src;
}
/** Product photo that fills its box consistently (see useTrimmed). */
function FitImg({ src, alt, className, eager, sizes, w }: { src: string; alt: string; className?: string; eager?: boolean; sizes?: string; w?: number }) {
  const s = useTrimmed(src);
  return <Img src={s ?? src} alt={alt} className={className} eager={eager} sizes={sizes} w={w} />;
}

const paras = (s?: string | null) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const CARD_HOVER = "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none";
const GROUPED = new Set(["services", "about", "highlights", "cta"]);
/** The three control shapes (docs/premium-look.md §4.4, globals.css `.site`): filled primary, ghost, plain link. */
const BTN = "btn-primary";
const GHOST = "btn-ghost";
const LINK = "btn-link";
/** Class strings the sections share (§4.3): a card is `.s-card` — a line OR a shadow per blueprint, never both. */
const cls = {
  card: "s-card",
  /** The small accent square an icon sits in (address, hours, a step). */
  iconBox: "icon-box",
  /** The small line above a section title. */
  kicker: "kicker",
} as const;

const isEmpty = isEmptyBlock;

/** The "good to know" facilities (§4.1): the first highlights block of the first page, when it has 2–6 short
 *  items — "UPI accepted", "Home delivery", "GST billing" — each stripped of its emoji. */
function goodToKnow(card: Card): string[] {
  const hl = card.pages[0]?.blocks.find((b): b is Extract<CardBlock, { kind: "highlights" }> => b.kind === "highlights" && !b.items.some((x) => (x ?? "").startsWith("✅")));
  const items = (hl?.items ?? []).map((s) => (s ?? "").trim()).filter(Boolean);
  if (items.length < 2 || items.length > 6) return [];
  return items.every((s) => Array.from(splitGlyph(s).text).length <= 28) ? items : [];
}

/** One photo per product, in card order (for the hero mosaic). */
function productPhotos(card: Card): string[] {
  const out: string[] = [];
  // Never from a hidden page (the Shubhora page): its plan pictures are not this business's products.
  for (const pg of card.pages) { if (pg.hidden) continue; for (const b of pg.blocks) if (b.kind === "product") for (const it of b.items) { const u = it.images?.[0] ?? it.imageUrl; if (u && !out.includes(u)) out.push(u); } }
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

export function SiteView({ card, qr, brand, shareUrl, free = false, initialPage, linkBase, joinHandle, nudge = false, shubhora = null, updates = [], unlisted = [], initialLang }: { card: Card; qr: string; brand?: CardBrand | null; shareUrl?: string; free?: boolean; initialPage?: string; linkBase?: string; joinHandle?: string | null; nudge?: boolean; /** The Shubhora strip at the foot (free sites, and paid "Both" sites). */ shubhora?: { joinHref: string; moreHref: string; free?: boolean } | null; updates?: SiteUpdate[];
  /** Pages that are reachable at their own address but are not in the menu — a product's own page. */
  unlisted?: string[];
  /** The visitor language the page opens in (the preview's `?lang=`); unset = the visitor's saved choice. */
  initialLang?: string }) {
  // The website wears its own design: palette (or the card's colour), fonts (or the card look's), corners.
  const look = lookOf(card.template);
  const mood = tradeMood(card.seo?.categoryKey);
  const design = siteDesign(card, look, { luxe: mood.luxe, bright: card.site?.hero?.bright });
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
  // Where the banner's subject is (set at build time, src/lib/media/photo-focus.ts): the crop keeps it in view and
  // the words take the side it leaves empty.
  const heroFocus = hero?.focus && /^\d{1,3}% \d{1,3}%$/.test(hero.focus) ? hero.focus : undefined;
  const links = card.links.filter((l) => l.value.trim());
  const wa = links.find((l) => l.type === "whatsapp");
  const phone = links.find((l) => l.type === "phone");
  // The hero picture is `card.coverUrl` and nothing else (docs/premium-look.md §6 step 0): never hero.imageUrl, a
  // product shot or the logo — a card without a banner gets the type-led hero.
  const heroImg = card.coverUrl || undefined;
  const isHome = page?.slug === "home";
  const MAX_NAV = 6;
  // A product's own page is reached from a product card or from search, never from the menu.
  const unlistedSet = new Set(unlisted);
  // A hidden page (the owner's Shubhora page on a "both" card) opens by its own address only — never from the menu.
  const navPages = pages.filter((p) => !unlistedSet.has(p.slug) && !p.hidden);
  const navMain = navPages.slice(0, MAX_NAV), navMore = navPages.slice(MAX_NAV);
  const L = useCardLang(card.username);
  const t = L.t;
  const hiNow = L.lang === "hi";
  // The hero, as one model (site-hero.ts): kicker, claim, one line, trust row, the two buttons, the picture — in
  // the VISITOR's language, so the language switch re-speaks it.
  const hm = heroModel(card, L.lang);
  const trade = tradeLabel(card, hiNow);
  // The owner's logo in the nav; without one the name stands as a wordmark (the monogram never reaches the website).
  const logo = hm.logo;
  const facts = trustFacts(card);
  // A fact the trust row / strip already states ("Since 2015", "4.7★ · 3 reviews") is not repeated below it.
  const factText = facts.map((f) => `${f.value} ${f.label}`.toLowerCase()).join(" ");
  const pills = goodToKnow(card).filter((p) => {
    const txt = splitGlyph(p).text.toLowerCase();
    const year = /\b(?:19|20)\d{2}\b/.exec(txt)?.[0];
    if (year && (factText.includes(year) || hm.trust.since)) return false;
    if (/review|रिव्यू|★/.test(txt) && (factText.includes("★") || hm.trust.rating)) return false;
    return true;
  });
  const mosaic = productPhotos(card).slice(0, 4);
  // The marquee's strip: product photos and the gallery, up to ten, no repeats.
  const strip = [...new Set([...productPhotos(card), ...card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).flatMap((b) => (b.kind === "gallery" ? b.images.map((i) => i.url ?? "") : b.kind === "image" || b.kind === "carousel" ? b.images.map((i) => i.url) : [])).filter(Boolean)])].slice(0, 10);
  const motion = card.site?.style?.motion ?? "calm";
  const portrait = card.avatarUrl && card.avatarShape !== "square" ? card.avatarUrl : undefined;
  // The classic hero's shape (HERO_LAYOUTS, §3.6): photo / editorial = the cover; split = words on paper beside the
  // picture; grid / person / stage / minimal / marquee keep their layouts with tokens. A shape the card cannot fill
  // falls to the next: no banner → "ink" (a type-led dark field), never a logo or product shot stretched to fit.
  const layout: ClassicLayout = (() => {
    const l = card.site?.style?.hero;
    const cover = !!hm.photo;
    if (l === "grid" && mosaic.length < 3) return cover ? "photo" : "ink";
    if (l === "person" && !portrait) return cover ? "photo" : "ink";
    if (l === "editorial" && !cover) return "stage";
    if (l === "marquee" && strip.length < 4) return mosaic.length >= 3 ? "grid" : cover ? "photo" : "ink";
    if (l === "photo" || l === "split") return cover ? l : "ink";
    if (l) return l;
    return cover ? "photo" : "ink";
  })();
  const rootRef = useRef<HTMLDivElement>(null);
  // The phone's sticky bar appears only once the hero has left the viewport (§4.9): a sentinel after the hero.
  const heroEnd = useRef<HTMLDivElement>(null);
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    const el = heroEnd.current;
    if (!isHome || !el || !("IntersectionObserver" in window)) { setPastHero(true); return; }
    const io = new IntersectionObserver((es) => { for (const e of es) setPastHero(!e.isIntersecting && e.boundingClientRect.top < 0); }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [isHome, active]);
  // The preview's forced language (`?lang=`): spoken once, after useCardLang read the saved one.
  const setLang = L.setLang;
  useEffect(() => { if (initialLang) setLang(initialLang); }, [initialLang, setLang]);
  // A product tapped on a phone opens in a sheet over the page (site-smart.tsx); on a computer it opens its own page.
  const [sheet, setSheet] = useState<ProductItem | null>(null);
  const openProduct = (p: ProductItem) => setSheet(p);
  const hoursRows = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).find((b): b is Extract<CardBlock, { kind: "hours" }> => b.kind === "hours" && b.rows.length > 0)?.rows;
  // The blueprint (site-blueprints.ts): bento draws a tile board for its hero and a glass nav once scrolled.
  const bp = card.site?.style?.blueprint;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const bento = bp ? bentoFacts(card) : null;
  // Cinematic: the photos not already on the hero, as the bands between the scenes.
  const bands = bp === "cinematic" ? strip.filter((u) => u !== card.coverUrl).slice(0, 3) : [];
  const sinceOf = bp ? sinceYear([...card.pages.flatMap((p) => p.blocks).flatMap((b) => (b.kind === "highlights" ? b.items : [])), card.about ?? "", card.tagline ?? ""]) : null;
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
  const waOpen = card.language === "hi" ? `नमस्ते ${hm.name}, मैंने आपकी website देखी — ` : `Hi ${hm.name}, I saw your website — `;
  const waHref = (text?: string) => wa ? `https://wa.me/${wa.value.replace(/\D/g, "")}?text=${encodeURIComponent(text ?? waOpen)}` : "#";
  const pageBlocks = (page?.blocks ?? []).filter((b) => !isEmpty(b));
  const lastKind = pageBlocks.at(-1)?.kind;
  const hasAppointment = page?.blocks.some((b) => b.kind === "appointment");

  // Home: the composed section list (own blocks + pulled previews); other pages: their blocks in runs.
  // The hero already shows the trust chips as pills: printing the same five again as a "Why choose us" section
  // read as a mistake next to the real why-us points below it (seen live, 1 Oct 2026).
  const strip0 = goodToKnow(card);
  const pilled = strip0.length ? new Set(strip0.map((x) => x.trim())) : null;
  // The home page pulls previews (products, gallery, reviews, FAQ, visit) from the visible pages only.
  const sections: HomeSection[] = (isHome ? homeSections(card, pages.filter((p) => !p.hidden)) : pageBlocks.map((b) => ({ key: b.id, kind: "block", block: b } as HomeSection)))
    .filter((s) => !(isHome && pilled && s.kind === "block" && s.block.kind === "highlights"
      && s.block.items.length === pilled.size && s.block.items.every((x) => pilled.has((x ?? "").trim()))));
  const groups: (Exclude<HomeSection, { kind: "block" }> | CardBlock[])[] = [];
  for (const s of sections) {
    if (s.kind !== "block") { groups.push(s); continue; }
    const last = groups[groups.length - 1];
    if (Array.isArray(last) && last[0].kind === s.block.kind && GROUPED.has(s.block.kind)) last.push(s.block); else groups.push([s.block]);
  }
  const runProps = { card, theme, ink, waHref, go, links, hrefFor, openProduct };
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
  const reviewCount = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim()).length;
  const fontHref = design.fonts.href;
  // The blueprints' small line above the name: the hero model's kicker ("Jeweller · Rewari"), never the slug.
  const eyebrowRole = hm.kicker;
  // The closing band's line (owner's call, 4 Oct 2026: "Talk to the Founder", not the first name). The designation
  // when the card has a short one (Owner, Founder, Dr., Advocate…); a trade label like "Sweets / bakery" is not a
  // person, so then it is simply "us".
  const ctaTalk = (() => {
    const d = (card.jobTitle || "").trim();
    const isRole = !!d && d.length <= 24 && !/[/(]/.test(d) && d.split(/\s+/).length <= 3;
    if (!isRole) return "Talk to us today";
    if (/^dr\.?$/i.test(d)) return `Talk to Dr. ${card.name.split(" ").pop() || ""} today`.replace(/\s+today/, " today");
    return `Talk to the ${d} today`;
  })();

  return (
    <TranslateCtx.Provider value={t}><LayoutCtx.Provider value={card.site?.style?.layouts}><BlueprintCtx.Provider value={bp}>
    {fontHref && <><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link rel="stylesheet" href={fontHref} /></>}
    <style dangerouslySetInnerHTML={{ __html: `@keyframes site-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}} .site-marquee{animation:site-marquee 48s linear infinite} .site[data-motion="lively"] .site-marquee{animation-duration:28s} .site[data-motion="none"] *,.site[data-motion="none"] *::before,.site[data-motion="none"] *::after{animation:none!important;transition:none!important} .site[data-motion="none"] [data-reveal]{opacity:1!important;transform:none!important} .site-marquee:hover{animation-play-state:paused} .site[data-look]{${design.vars};font-family:var(--font-text,var(--look-body));color:var(--ink)} .site[data-look] h1,.site[data-look] h2,.site[data-look] h3{font-family:var(--font-display,var(--look-head))} .site[data-look] h1,.site[data-look] h2{font-weight:var(--display-w,var(--head-w))} .site[data-look] .rounded-2xl{border-radius:var(--r-card)} .site[data-look] .rounded-xl{border-radius:var(--r-ctl)} .site[data-look] .rounded-3xl{border-radius:var(--r-tile)}${VIEW_CSS}${SMART_CSS}${HERO_CSS}${bp === "bento" ? BENTO_CSS : bp === "cinematic" ? CINEMATIC_CSS : bp === "story" ? POSTER_CSS : ""}` }} />
    <div ref={rootRef} lang={L.lang} className="site min-h-screen flex flex-col" data-look={look.key} data-motion={motion} data-bp={bp} style={{ background: "var(--surface)" }}>

      {/* ---- announcement bar ---- */}
      {barLive && !barClosed && (
        <div className="relative z-30 text-center text-sm font-medium" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-10 py-2">
            <Megaphone className="h-4 w-4 shrink-0" />
            {bar!.link
              ? <a href={bar!.link} onClick={(e) => { if (bar!.link!.startsWith("#")) { e.preventDefault(); go(bar!.link!.slice(1)); } }} target={bar!.link!.startsWith("#") ? undefined : "_blank"} rel="noreferrer" className="underline-offset-2 hover:underline">{t(bar!.text)}</a>
              : <span>{t(bar!.text)}</span>}
          </div>
          <button type="button" onClick={closeBar} aria-label="Close" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 opacity-80 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ---- header: wordmark (or the owner's logo) · pages · language · WhatsApp once the hero has scrolled ---- */}
      <header className={`site-head sticky top-0 z-30 glass border-b border-border ${scrolled ? "scrolled" : ""}`}>
        <div className="mx-auto max-w-6xl px-5 md:px-6 h-[60px] md:h-[68px] flex items-center gap-6">
          <button type="button" onClick={() => go("home")} className={`flex items-center gap-3 shrink-0 max-w-[300px] rounded-lg text-left ${FOCUS}`}>
            {logo
              ? <Img src={logo} alt={hm.name} className="h-9 max-w-[160px] w-auto shrink-0 object-contain md:h-10" eager w={160} />
              : <Wordmark name={t(hm.name)} trade={isHome ? undefined : t(trade)} lang={L.lang} />}
          </button>
          {/* A "both" card is the owner's own website: Shubhora is on the bottom strip only (owner's call, 2 Oct 2026). */}
          <nav className="hidden md:flex items-center gap-x-0.5 ml-auto h-full" aria-label="Pages">
            {navMain.map((p) => (
              <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} aria-current={active === p.slug ? "page" : undefined} className={`relative h-[68px] whitespace-nowrap px-3 text-[14px] font-medium inline-flex items-center transition-colors ${FOCUS} focus-visible:ring-inset ${active === p.slug ? "text-ink" : "text-muted hover:text-ink"}`}>
                {t(p.label)}
                {active === p.slug && <span className="absolute left-3 right-3 bottom-0 h-px" style={{ background: "var(--accent)" }} />}
              </a>
            ))}
            {navMore.length > 0 && (
              <div className="relative h-full flex items-center" onKeyDown={(e) => e.key === "Escape" && setMoreOpen(false)}>
                <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="menu" className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-medium ${FOCUS} ${navMore.some((p) => p.slug === active) ? "text-ink" : "text-muted hover:text-ink"}`}>More <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} /></button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                    <div role="menu" className={`absolute right-0 top-[60px] z-30 w-52 ${cls.card} p-1`} style={{ boxShadow: "var(--e-1)" }}>
                      {navMore.map((p) => <button key={p.id} type="button" role="menuitem" onClick={() => go(p.slug)} className={`w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-surface2 ${FOCUS} ${active === p.slug ? "font-semibold" : ""}`}>{t(p.label)}</button>)}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
          <div className="hidden md:block"><LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} /></div>
          {/* One WhatsApp affordance per screen (§7.1): the nav's appears once the hero's own button has scrolled away. */}
          {wa && (
            <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-whatsapp")} className={`max-md:hidden ${BTN} btn-sm ${FOCUS} ${isHome && !scrolled ? "invisible" : ""}`} aria-hidden={isHome && !scrolled ? true : undefined} tabIndex={isHome && !scrolled ? -1 : undefined}>
              <Icon name="whatsapp" /> WhatsApp
            </a>
          )}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" className={`md:hidden ml-auto h-10 w-10 grid place-items-center rounded-lg border border-border ${FOCUS}`}>{open ? <X className="h-5 w-5" /> : <Icon name="menu" size={20} />}</button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-border bg-surface px-5 py-2 flex flex-col" aria-label="Pages">
            {pages.map((p) => <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} className={`py-3 text-left text-[15px] font-medium border-b border-border last:border-0 ${active === p.slug ? "text-ink" : "text-muted"}`}>{t(p.label)}</a>)}
            <div className="py-3"><LanguagePicker lang={L.lang} setLang={L.setLang} busy={L.translating} theme={theme} /></div>
          </nav>
        )}
      </header>
      {/* The owner's notice — news, an offer, a closure — under the header (src/lib/notice.ts). */}
      <NoticeBar card={card} hi={hiNow} />

      <main className="relative flex-1 pb-14 md:pb-0">
        {isHome && bp === "story" ? (
          <PosterHero card={card} hi={L.lang === "hi"} t={t} onBook={go} />
        ) : isHome && bp === "cinematic" ? (
          <CinematicHero card={card} hi={L.lang === "hi"} t={t} photo={heroImg} clip={card.site?.hero?.video !== false ? bento?.clip : undefined} focus={heroFocus} textSide={hero?.textSide}
            phone={phone?.value} wa={wa?.value} waHref={waHref} hours={hoursRows} eyebrow={eyebrowRole} pills={[]} />
        ) : isHome && bento ? (
          <div className="relative">
            <BentoHero card={card} hi={L.lang === "hi"} t={t} photo={heroImg} clip={card.site?.hero?.video !== false ? bento.clip : undefined} focus={heroFocus}
              phone={phone?.value} wa={wa?.value} waHref={waHref} hours={hoursRows} rating={bento.rating} map={bento.map} offer={bento.offer} product={bento.product} onProduct={(p) => { if (isPhone()) openProduct(p); else { const slug = cardProducts(card).find((x) => x.item === p)?.slug; if (slug) go(slug); else openProduct(p); } }}
              since={sinceOf ?? undefined} booking={bento.booking} go={go} eyebrow={eyebrowRole} logo={logo} pills={[]} darkPage={false} />
          </div>
        ) : isHome ? (
          <ClassicHero hm={hm} layout={layout} lang={L.lang} hi={hiNow} t={t} username={card.username} onBook={go} mosaic={mosaic} portrait={portrait} strip={strip} motion={motion} textSide={hero?.textSide} />
        ) : (
          /* ---- page header: the page's name, the business as its kicker, one button ---- */
          <section style={{ background: "var(--paper-2)" }}>
            <div className="mx-auto max-w-6xl px-5 md:px-6 pt-12 pb-10 md:pt-16 md:pb-14 flex flex-wrap items-end justify-between gap-6">
              <div>
                <Kicker lang={L.lang}>{t(hm.name)}</Kicker>
                <Display as="h1" className="mt-3" lang={L.lang}>{t(page?.label ?? "")}</Display>
              </div>
              {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-page-whatsapp")} className={`${BTN} ${FOCUS}`}><Icon name="whatsapp" /> {t(hero?.ctaLabel || "WhatsApp")}</a>}
            </div>
          </section>
        )}
        {/* The sticky bar's sentinel: once this line has scrolled above the viewport, the bar comes in. */}
        <div ref={heroEnd} aria-hidden="true" style={{ height: 1, marginTop: -1 }} />

        {isHome && (
          <>
            {/* ---- "good to know" (§4.1): the facilities in one quiet line, hairlines above and below ---- */}
            {pills.length >= 2 && (
              <section className="mx-auto max-w-6xl px-5 md:px-6 pt-6">
                <ul className="gtk" aria-label={hiNow ? "जानने योग्य" : "Good to know"}>
                  {pills.map((s, i) => { const text = stripEmoji(glyphText(s, t).text); const ic = iconFor(s); return <li key={i}>{ic && <Icon name={ic} />}{text}</li>; })}
                </ul>
              </section>
            )}
            {/* ---- numbers the card itself carries (§4.6): the final number in the HTML, counted up once seen ---- */}
            {facts.length >= 3 && (
              <section className="mx-auto max-w-6xl px-5 md:px-6">
                <div className={`py-8 md:py-10 grid gap-6 ${facts.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
                  {facts.map((f, i) => (
                    <div key={i} className={`flex flex-col ${i ? "md:border-l md:border-border md:pl-6" : ""}`} data-reveal style={{ ["--i" as string]: i } as React.CSSProperties}>
                      <CountUp value={t(f.value)} className="stat" />
                      <span className="mt-1.5 text-[12px] text-muted">{t(f.label)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {groups.map((g, i) => (
          <div key={Array.isArray(g) ? g[0].id : g.key} className="contents">
            {Array.isArray(g) ? <SiteRun run={g} index={i} {...runProps} /> : <Pulled section={g} index={i} {...runProps} />}
            {/* Cinematic: a slow photo band after every second scene (never one the hero already shows). */}
            {bands.length > 0 && i % 2 === 1 && bands[(i - 1) / 2] && <ParallaxBand src={bands[(i - 1) / 2]} />}
          </div>
        ))}

        {/* Updates — the owner's recent daily posters: the whole page, or the latest three on Home. */}
        {showUpdates && (page?.slug === UPDATES || (isHome && !(card.site?.home?.hidden ?? []).includes(UPDATES))) && (
          <Section wide index={groups.length} theme={theme} eyebrow={hiLang ? "अपडेट" : t("Updates")} title={page?.slug === UPDATES ? (hiLang ? "हमारी ताज़ा अपडेट" : t("Our latest updates")) : (hiLang ? "ताज़ा" : t("Latest from us"))}
            aside={page?.slug !== UPDATES && updates.length > 3 ? <SeeAll href={hrefFor(UPDATES)} go={go} slug={UPDATES}>{hiLang ? "सभी अपडेट" : t("All updates")}</SeeAll> : undefined}>
            <UpdatesGrid items={page?.slug === UPDATES ? updates : updates.slice(0, 3)} waHref={waHref} hasWa={!!wa} username={card.username} hi={hiLang} />
          </Section>
        )}

        {/* Explore — the other pages as tiles at the end of the home page; visitors rarely open the menu on their own. */}
        {page?.slug === first && explorePages.length > 0 && (
          <section className="mx-auto max-w-6xl px-5 md:px-6 py-14" data-reveal>
            <p className={cls.kicker}>{hiLang ? "और देखें" : t("Explore")}</p>
            <h2 className="sec-h2 mt-3 mb-6">{hiLang ? "पूरी वेबसाइट" : t("More on this website")}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {explorePages.map((p) => { const { Icon: PageIcon, hint } = pageMeta(p, card.language); return (
                <a key={p.id} href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} className={`group flex items-center gap-4 ${cls.card} p-5 ${CARD_HOVER} ${FOCUS}`}>
                  <span className={cls.iconBox}><PageIcon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold">{t(p.label)}</span>{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
                  <Icon name="arrow-right" className="text-muted transition-transform group-hover:translate-x-1" />
                </a>
              ); })}
            </div>
          </section>
        )}

        {/* A new business has no reviews to show, and no way to collect the first ones: its visitors are asked. */}
        {page?.slug === first && reviewCount < 3 && (
          <section className="mx-auto max-w-6xl px-5 md:px-6 pb-4 pt-10" data-reveal>
            <ReviewInvite username={card.username} business={hm.name} hi={hiLang} />
          </section>
        )}

        {/* closing band (§4.8): an ink field, the wordmark, one primary — skipped when the page already ends on a contact/appointment block */}
        {page?.slug !== "contact" && wa && lastKind !== "contact" && lastKind !== "appointment" && (
          <section className="hero-dark" data-reveal>
            <div className="mx-auto max-w-6xl px-5 md:px-6 py-16 md:py-24 grid md:grid-cols-[1fr_auto] gap-10 items-end">
              <div className="max-w-xl">
                <Wordmark name={t(hm.name)} lang={L.lang} />
                <h2 className="sec-h2 mt-6" style={{ textWrap: "balance" }}>{t(hasAppointment ? "Ready to see it for yourself?" : ctaTalk)}</h2>
                <p className="lede">{t(card.tagline || "Usually replies within a few hours on WhatsApp.")}</p>
              </div>
              <div className="hero-ctas">
                <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-cta-whatsapp")} className={`${BTN} ${FOCUS}`} data-kind="whatsapp"><Icon name="whatsapp" /> {t(hero?.ctaLabel || "Chat on WhatsApp")}</a>
                {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => trackClick(card.username, "site-cta-phone")} className={`${LINK} ${FOCUS}`}>{t("Call")} <Icon name="arrow-right" /></a>}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ---- footer (§4.8): the ink field, the wordmark, the pages and the ways to reach the business ---- */}
      <footer className="hero-dark">
        <div className="mx-auto max-w-6xl px-5 md:px-6 pt-14 pb-10 grid md:grid-cols-[1.3fr_1fr_1fr] gap-10 text-sm">
          <div>
            {logo ? <Img src={logo} alt="" className="h-10 w-auto max-w-[180px] object-contain mb-4 rounded-lg bg-white/90 p-1" w={180} /> : <Wordmark name={t(hm.name)} trade={t(trade)} lang={L.lang} className="text-[19px]" />}
            {card.tagline && <p className="mt-4 max-w-md leading-relaxed" style={{ color: "var(--hero-muted)" }}>{t(card.tagline)}</p>}
            {card.gstin?.trim() && <p className="mt-2 text-xs mono" style={{ color: "var(--hero-muted)" }}>GSTIN {card.gstin.trim()}</p>}
            {/* One link, one QR — the same address the phone card carries. */}
            <div className="mt-6 flex items-center gap-4">
              <Img src={qr} alt="QR code" className="h-20 w-20 rounded-xl bg-white p-1.5" />
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--hero-muted)" }}>{t("Scan to open this site on your phone")}</p>
                {shareUrl && <p className="text-xs mono break-all" style={{ color: "var(--hero-muted)" }}>{shareUrl.replace(/^https?:\/\//, "")}</p>}
                <div className="flex flex-wrap gap-2">
                  <a href={`/c/${card.username}/vcf`} onClick={() => trackClick(card.username, "vcard")} className={`${GHOST} btn-xs ${FOCUS}`}><Download className="h-3.5 w-3.5" /> {t("Save contact")}</a>
                  <a href="?view=card" className={`${GHOST} btn-xs ${FOCUS}`}>{t("Digital card")}</a>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="kicker">{t("Pages")}</p>
            <ul className="mt-4 space-y-2.5">
              {navPages.map((p) => <li key={p.id}><a href={hrefFor(p.slug)} onClick={(e) => { e.preventDefault(); go(p.slug); }} className={`opacity-85 hover:opacity-100 rounded ${FOCUS}`}>{t(p.label)}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="kicker">{t("Contact")}</p>
            <ul className="mt-4 space-y-2.5">
              {footLinks.map((l) => (
                l.type === "upi"
                  // upi:// does nothing in a desktop browser: the ID is shown to copy, and the link stays for phones.
                  ? <li key={l.id}><UpiLine value={l.value} username={card.username} /></li>
                  : <li key={l.id}><a href={linkHref(l.type, l.value, l.type === "whatsapp" ? waOpen : undefined)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, l.type)} className={`inline-flex items-center gap-2 opacity-85 hover:opacity-100 rounded max-w-full ${FOCUS}`}><LinkIcon type={l.type} className="h-4 w-4 shrink-0" /><span className="truncate max-w-[260px]">{l.value || l.label}</span>{sameNumber && l.type === "whatsapp" && <span className="shrink-0 text-xs opacity-60">· {t("WhatsApp & call")}</span>}</a></li>
              ))}
            </ul>
            {localLine(card) && <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--hero-muted)" }}>{localLine(card)}</p>}
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--hero-line)" }}>
          <div className="mx-auto max-w-6xl px-5 md:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "var(--hero-muted)" }}>
            <span>© {new Date().getFullYear()} {t(hm.name)}</span>
            <span className="mono">{brand ? (brand.hideBranding ? "" : `Powered by ${brand.name}`) : "Powered by Shubhora"}</span>
          </div>
        </div>
      </footer>
      {/* The sticky action bar on phones (§4.9): in only once the hero has scrolled away; the floating bubble is gone. */}
      {(wa || phone) && (
        <div className="site-bar fixed inset-x-0 bottom-0 z-40 grid gap-px border-t border-border bg-border md:hidden" data-shown={pastHero ? "" : undefined} style={{ gridTemplateColumns: `repeat(${[phone, wa, mapLink].filter(Boolean).length}, 1fr)`, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => trackClick(card.username, "site-bar-phone")} className="flex items-center justify-center gap-2 bg-surface py-3.5 text-sm font-semibold"><Icon name="phone" /> {t("Call")}</a>}
          {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-bar-whatsapp")} className="flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white" style={{ background: "var(--wa)" }}><Icon name="whatsapp" /> WhatsApp</a>}
          {mapLink && <a href={linkHref(mapLink.type, mapLink.value)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-bar-map")} className="flex items-center justify-center gap-2 bg-surface py-3.5 text-sm font-semibold"><Icon name="directions" /> {hiLang ? "रास्ता" : t("Directions")}</a>}
        </div>
      )}
      <BottomSheet open={!!sheet} onClose={() => setSheet(null)} title={sheet ? t(sheet.name) : undefined}>
        {sheet && <ProductSheetBody p={sheet} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={!!wa} hrefFor={hrefFor} go={(slug) => { setSheet(null); go(slug); }} />}
      </BottomSheet>
      {card.popup?.enabled && linkBase !== undefined && <WelcomePopup card={card} theme={theme} active={active} />}
      {linkBase !== undefined && <NoticePopup card={card} theme={theme} active={active} hi={hiNow} />}
      {!free && <CardChat username={card.username} name={card.name} theme={theme} />}
      {nudge && joinHandle && !brand && <JoinNudge username={card.username} href={`/signup?by=${encodeURIComponent(joinHandle)}`} lang={L.lang} page={active} />}
      {shubhora && !brand && active !== "shubhora" && <ShubhoraBar username={card.username} joinHref={shubhora.joinHref} moreHref={shubhora.moreHref} free={shubhora.free !== false} lang={L.lang} aboveBar={!!(phone || wa || mapLink)} />}
    </div>
    </BlueprintCtx.Provider></LayoutCtx.Provider></TranslateCtx.Provider>
  );
}

/* ---------- the classic hero (§3.6): one model, eight shapes, tokens only ---------- */
type ClassicLayout = NonNullable<Card["site"]>["style"] extends infer S ? (S extends { hero?: infer H } ? NonNullable<H> : never) | "ink" : never;

/** The hero of a site without a blueprint. `photo` / `editorial` = the cover (the photo full-bleed, the words low
 *  over a bottom scrim); `split` = words on paper beside the picture (4:5, no scrim); `grid` = the product mosaic;
 *  `person` = the portrait; `stage` = centred words, the picture wide under them; `marquee` = centred words over a
 *  slow strip; `minimal` = words only; `ink` = words only on the ink field (no banner). No wash, dots or glow. */
function ClassicHero({ hm, layout, lang, hi, t, username, onBook, mosaic, portrait, strip, motion, textSide }: {
  hm: HeroModel; layout: ClassicLayout; lang: string; hi: boolean; t: (s: string) => string; username: string; onBook: (slug: string) => void;
  mosaic: string[]; portrait?: string; strip: string[]; motion: string; textSide?: "left" | "right" | "center";
}) {
  const dark = layout === "photo" || layout === "editorial" || layout === "ink";
  const center = layout === "stage" || layout === "marquee" || (dark && textSide === "center");
  const right = dark && textSide === "right";
  const words = (
    <div className="hero-col hero-stagger" data-center={center ? "" : undefined}>
      <Kicker lang={lang}>{t(hm.kicker)}</Kicker>
      <Display lang={lang}>{t(hm.headline)}</Display>
      <Sub lang={lang}>{t(hm.sub)}</Sub>
      <TrustRow trust={hm.trust} hours={hm.hours} hi={hi} />
      <CtaPair primary={hm.primary} secondary={hm.secondary} username={username} secondaryStyle={dark ? "link" : "ghost"} onBook={onBook} />
    </div>
  );
  if (dark) {
    return (
      <section className={`hero-dark relative overflow-hidden flex items-end ${layout === "editorial" ? "min-h-[86svh]" : layout === "ink" ? "min-h-[64svh]" : "min-h-[78svh]"}`} aria-label={hm.name}>
        {hm.photo && <div className="absolute inset-0"><HeroPhoto photo={hm.photo} clip={hm.clip} clipOn="desktop" crop="cover" priority scrim side={right ? "right" : center ? "center" : "left"} grain kenBurns={motion !== "none"} className="h-full w-full" /></div>}
        {!hm.photo && <i aria-hidden="true" className="hero-grain" />}
        <div className={`relative mx-auto w-full max-w-6xl px-5 md:px-6 pt-32 pb-12 md:pb-20 flex ${right ? "justify-end" : center ? "justify-center" : ""}`}>{words}</div>
      </section>
    );
  }
  const aside = layout === "grid" && mosaic.length >= 3 ? (
    <div className="grid grid-cols-2 gap-3 w-full max-w-[460px] justify-self-center md:justify-self-end hero-ph-in">
      {mosaic.map((u, i) => (
        <div key={u} className={`overflow-hidden rounded-2xl ${i === 0 && mosaic.length === 3 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`} style={{ background: "var(--paper-2)" }}>
          <Img src={u} alt="" className="h-full w-full object-cover" eager priority={i === 0} sizes={i === 0 && mosaic.length === 3 ? "(min-width: 768px) 460px, 100vw" : "(min-width: 768px) 230px, 50vw"} />
        </div>
      ))}
    </div>
  ) : layout === "person" && portrait ? (
    <div className="relative h-[300px] w-[300px] md:h-[380px] md:w-[380px] overflow-hidden rounded-3xl justify-self-center md:justify-self-end hero-ph-in" style={{ background: "var(--paper-2)" }}>
      <Img src={portrait} alt={hm.name} className="h-full w-full object-cover" priority sizes="(min-width: 768px) 380px, 300px" />
    </div>
  ) : layout === "split" && hm.photo ? (
    <div className="relative w-full max-h-[56svh] md:max-h-none aspect-[4/5] overflow-hidden rounded-3xl justify-self-center md:justify-self-end"><HeroPhoto photo={hm.photo} crop="split" priority className="h-full w-full" /></div>
  ) : null;
  const wide = (layout === "stage" || layout === "minimal") && hm.photo ? (
    <div className="relative mt-12 aspect-[16/9] overflow-hidden rounded-3xl"><HeroPhoto photo={hm.photo} crop="cover" priority lazy={false} className="h-full w-full" /></div>
  ) : null;
  return (
    <section className="relative overflow-hidden" aria-label={hm.name} style={{ background: "var(--paper)" }}>
      <div className={`relative mx-auto w-full max-w-6xl px-5 md:px-6 ${center ? "pt-16 pb-10 md:pt-24 md:pb-12 text-center" : `py-16 md:py-24 grid gap-10 items-center ${aside ? (layout === "split" ? "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "md:grid-cols-[1.15fr_1fr]") : ""}`}`}>
        {layout === "split" && aside && <div className="md:hidden">{aside}</div>}
        <div className={center ? "mx-auto flex justify-center" : ""}>{words}</div>
        {aside && <div className={layout === "split" ? "max-md:hidden" : ""}>{aside}</div>}
        {wide}
      </div>
      {layout === "marquee" && strip.length >= 4 && (
        <div className="relative mt-4 pb-16 overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}>
          <div className="site-marquee flex w-max gap-4 px-2">
            {[...strip, ...strip].map((u, i) => (
              <div key={`${u}-${i}`} className={`h-[200px] md:h-[260px] shrink-0 overflow-hidden rounded-2xl ${i % 3 === 1 ? "w-[300px] md:w-[380px]" : "w-[200px] md:w-[240px]"}`} style={{ background: "var(--paper-2)" }}>
                <Img src={u} alt="" className="h-full w-full object-cover" eager={i < 4} sizes="380px" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- section shell (§4.2): kicker + H2 + lede, alternating paper, the band an ink field ---------- */
function Section({ title, eyebrow, lead, aside, wide = false, narrow = false, index = 0, tone = "auto", tight = false, children, className = "" }: {
  title?: string; eyebrow?: string; lead?: string; aside?: React.ReactNode; wide?: boolean; narrow?: boolean; index?: number;
  /** "band": the ink field with light text — one dark stretch breaks a long paper page. "auto": paper / paper-2. */
  tone?: "auto" | "band";
  /** A section of short lines (why-us ticks, steps) does not need a full-height stretch around it. */
  tight?: boolean;
  children: React.ReactNode; theme?: string; className?: string;
}) {
  const band = tone === "band";
  return (
    <section className={`${band ? "hero-dark relative overflow-hidden" : ""} ${className}`} data-reveal style={band ? undefined : index % 2 ? { background: "var(--paper-2)" } : { background: "var(--paper)" }}>
      {band && <i aria-hidden="true" className="hero-grain" />}
      <div className={`relative mx-auto px-5 md:px-6 ${tight ? "py-12 md:py-16" : "sec-pad"} ${narrow ? "max-w-2xl" : wide ? "max-w-6xl" : "max-w-3xl"}`}>
        {(title || eyebrow || lead) && (
          <div className={`${tight ? "mb-8" : "mb-10 md:mb-12"} flex flex-wrap items-end justify-between gap-6`}>
            <div className="max-w-2xl">
              {eyebrow && <p className={cls.kicker}>{eyebrow}</p>}
              {title && <h2 className={`sec-h2 ${eyebrow ? "mt-3" : ""}`}>{title}</h2>}
              {lead && <p className="lede">{lead}</p>}
            </div>
            {aside}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** The sections' own rules (§4), inlined with the tokens: the "good to know" line, section type, cards, products,
 *  reviews, the sticky bar's entrance. Everything else is the shared `.site` block in globals.css. */
const VIEW_CSS = `
.site .gtk{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s5);padding:var(--s3) 0;margin:0;list-style:none;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:var(--t-meta);font-weight:500;color:var(--muted)}
.site .gtk li{display:inline-flex;align-items:center;gap:.45em}.site .gtk svg{color:var(--accent);flex:none}
.site .stat{font-family:var(--font-display,var(--look-head));font-size:clamp(20px,5.6vw,var(--t-stat));white-space:nowrap;line-height:1;letter-spacing:-.01em;font-weight:var(--display-w,var(--head-w,600));font-variant-numeric:lining-nums tabular-nums;color:var(--ink)}
.site .sec-pad{padding-block:var(--section-pad)}
.site .sec-h2{font-family:var(--font-display,var(--look-head));font-size:var(--t-h2);line-height:1.05;letter-spacing:-.015em;font-weight:var(--display-w,var(--head-w,600));margin:0;text-wrap:balance}
.site .lede{margin:var(--s4) 0 0;font-size:var(--t-sub);line-height:1.45;color:var(--muted);max-width:52ch;text-wrap:pretty}
.site .hero-dark .lede{color:var(--hero-muted)}
.site .hero-dark .hero-wordmark small{color:var(--hero-muted)}
.site .hero-col{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);max-width:var(--hero-col)}
.site .hero-col[data-center]{align-items:center;text-align:center}
.site .hero-col .display{margin-top:var(--s1)}.site .hero-col .hero-ctas{margin-top:var(--s3)}
.site .hero-col .hero-sub{color:var(--muted)}.site .hero-dark .hero-col .hero-sub{color:var(--hero-text)}
.site .icon-box{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:var(--r-ctl);background:var(--accent-soft);color:var(--accent)}
.site .hero-dark .icon-box{background:rgba(255,255,255,.1);color:var(--hero-text)}
.site .btn-sm{min-height:40px;padding:0 var(--s4);font-size:14px}.site .btn-xs{min-height:32px;padding:0 var(--s3);font-size:12px;gap:.35rem}
.site .hero-dark .btn-xs{border-color:var(--hero-line);color:var(--hero-text)}
.site .num{font-variant-numeric:tabular-nums lining-nums}
.site .p-img{position:relative;aspect-ratio:4/5;background:var(--paper-2);overflow:hidden}
.site .p-ph{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-display,var(--look-head));font-size:72px;color:var(--ink);opacity:.2}
.site .p-name{font-size:15px;font-weight:500;line-height:1.35}.site .p-price{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums lining-nums}
.site .p-wa{display:inline-flex;align-items:center;gap:.4em;font-size:13px;font-weight:600;color:var(--ink);text-decoration:none}.site .p-wa svg{color:var(--wa)}.site .p-wa:hover{text-decoration:underline;text-underline-offset:.2em}
.site .rev-q{margin:0;font-family:var(--font-display,var(--look-head));font-style:italic;font-weight:400;font-size:26px;line-height:1.3;letter-spacing:0;text-wrap:pretty}
.site .rev-rule{display:block;width:40px;height:1px;background:var(--accent)}
.site .rev-name{font-size:13px;font-weight:500;color:var(--muted)}
.site .stars{display:inline-flex;gap:2px;color:var(--star)}.site .stars [data-off]{color:var(--line)}
.site .faq{border-top:1px solid var(--line)}.site .faq details{border-bottom:1px solid var(--line)}
.site .faq summary{display:flex;align-items:center;justify-content:space-between;gap:var(--s4);cursor:pointer;list-style:none;padding:var(--s4) 0;font-size:16px;font-weight:600}
.site .faq summary::-webkit-details-marker{display:none}.site .faq details[open] summary svg{transform:rotate(180deg)}.site .faq summary svg{flex:none;color:var(--muted);transition:transform .2s}
.site .faq p{margin:0;padding:0 0 var(--s5);font-size:var(--t-body);line-height:var(--body-lh);color:var(--muted);max-width:65ch}
.site .site-bar{transform:translateY(110%)}.site .site-bar[data-shown]{transform:none}
`;

/** "See all 12 products →" — the link from a home preview to its page. */
function SeeAll({ href, go, slug, children }: { href: string; go: (s: string) => void; slug: string; children: React.ReactNode }) {
  return <a href={href} onClick={(e) => { e.preventDefault(); go(slug); }} className={`${LINK} ${FOCUS}`}>{children} <Icon name="arrow-right" /></a>;
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
            <article key={u.url} className={`overflow-hidden ${cls.card} ${CARD_HOVER}`}>
              <button type="button" onClick={() => setZoom({ images: items.map((x) => x.url), i, alt: u.title })} className={`block w-full cursor-zoom-in ${FOCUS}`}><Img src={u.url} alt={u.title} className="aspect-[4/5] w-full object-cover" eager={i < 3} sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" /></button>
              <div className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted"><Newspaper className="mr-1 inline h-3.5 w-3.5" />{d.toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                <h3 className="mt-1 text-[16px] font-semibold">{t(u.title)}</h3>
                {text && <p className="mt-1.5 text-sm leading-relaxed text-muted line-clamp-3">{t(text.slice(0, 220))}</p>}
                {hasWa && <a href={waHref(`Hi, I saw your update "${u.title}"`)} target="_blank" rel="noreferrer" onClick={() => trackClick(username, "site-update-whatsapp")} className={`p-wa mt-3 ${FOCUS}`}><Icon name="whatsapp" /> {hi ? "पूछें" : t("Ask about this")}</a>}
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

  const field = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]";
  return (
    <div className={`${cls.card} p-7 md:p-9`}>
      {sent ? (
        <div className="flex items-start gap-3">
          <span className={cls.iconBox}><Icon name="check" /></span>
          <div>
            <h2 className="text-xl tracking-tight">{L("Thank you!", "धन्यवाद!")}</h2>
            <p className="mt-1 text-[15px] text-muted">{L(`${business} will see your words and put them on this page.`, `${business} आपकी बात देखकर इसी page पर लगाएँगे।`)}</p>
          </div>
        </div>
      ) : !open ? (
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className={cls.kicker}>{L("Your words", "आपकी राय")}</p>
            <h2 className="mt-3 text-[24px] md:text-[28px] tracking-tight">{L("Been here? Tell others.", "यहाँ आ चुके हैं? दूसरों को बताइए।")}</h2>
            <p className="mt-2 text-[15px] text-muted max-w-xl">{L("A line from you helps the next customer decide. It goes up once the owner has seen it.", "आपकी दो लाइनें अगले ग्राहक का फ़ैसला आसान कर देंगी। मालिक के देखने के बाद यहाँ लग जाएँगी।")}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className={`${GHOST} ${FOCUS}`}>
            <Icon name="star" /> {L("Write a review", "Review लिखें")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:max-w-2xl">
          <h2 className="text-[24px] tracking-tight">{L(`How was ${business}?`, `${business} कैसा लगा?`)}</h2>
          <span className="inline-flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i}`} className={`rounded ${FOCUS}`}>
                <Icon name="star" size={30} fill={i <= rating} style={{ color: i <= rating ? "var(--star)" : "var(--line)" }} />
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
            <button type="button" onClick={send} disabled={busy || !name.trim() || text.trim().length < 10} className={`${BTN} disabled:opacity-60 ${FOCUS}`}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{L("Send", "भेजें")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={`${GHOST} ${FOCUS}`}>{L("Cancel", "रहने दें")}</button>
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
      <button type="button" onClick={copy} className={`${GHOST} btn-xs shrink-0 ${FOCUS}`}>
        {copied ? t("Copied") : t("Copy")}
      </button>
    </span>
  );
}

/** Five line stars (site-icons), the accent for the ones that count — never #f5b301. */
function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return <span className="stars" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} fill={i <= n} data-off={i <= n ? undefined : ""} />)}</span>;
}

type RunProps = { run: CardBlock[]; index: number; card: Card; theme: string; ink: string; waHref: (t?: string) => string; go: (slug: string) => void; links: Card["links"]; hrefFor: (slug: string) => string;
  /** Opens a product in the bottom sheet (phones) instead of its own page. */ openProduct?: (p: ProductItem) => void };

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
          {withImg.length > 0 && <div className="mb-12"><AboutBody block={withImg[0]} hi={hi} index={index} /></div>}
          <div className={`grid gap-8 ${list.filter((b) => !b.imageUrl || b !== withImg[0]).length > 1 ? "md:grid-cols-2" : ""}`}>
            {list.filter((b) => b !== withImg[0]).map((b) => (
              <div key={b.id} className={`${cls.card} p-8`}>
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
        <Section wide index={index} theme={theme} tight eyebrow={eyebrowFor("highlights", list[0].title, hi)} title={t(list[0].title)}>
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
  const prefs = useContext(LayoutCtx);
  const t = useT();
  const list = items.filter((s) => s.name.trim());
  const layout = preferredLayouts(prefs, { services: list.length }).services ?? servicesLayout(list);
  const name = (s: { name: string }) => t(s.name.replace(/^\d+[.)]\s*/, ""));
  // One or two services: a full-width row each, with room for the whole description.
  if (layout === "rows") {
    return (
      <div className="divide-y divide-border border-t border-border">
        {list.map((s, i) => (
          <div key={i} className="grid gap-4 py-9 md:grid-cols-[96px_1fr] md:gap-8 items-start">
            <span className="stat text-[40px] md:text-[52px]" style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="text-[22px] md:text-[26px] font-semibold tracking-tight leading-tight">{name(s)}</h3>
              {s.desc && <p className="mt-3 text-[17px] text-muted leading-relaxed max-w-[62ch]">{t(s.desc)}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }
  // A long list (a clinic's seven treatments): two tidy columns, a tick each, not a wall of cards.
  if (layout === "list") {
    return (
      <div className="grid md:grid-cols-2 gap-x-12 md:border-t md:border-border">
        {list.map((s, i) => (
          <div key={i} className="flex items-start gap-4 border-b border-border py-5">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}><Icon name="check" size={18} /></span>
            <div>
              <h3 className="text-[16px] font-semibold leading-snug">{name(s)}</h3>
              {s.desc && <p className="mt-1 text-[14px] text-muted leading-relaxed">{t(s.desc)}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {list.map((s, i) => (
        <div key={i} className={`${cls.card} p-7 ${CARD_HOVER}`}>
          <span className="num text-[12px] font-semibold tracking-[.12em]" style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</span>
          <h3 className="mt-4 text-[17px] font-semibold">{name(s)}</h3>
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
      <span aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-px md:block" style={{ background: "var(--line)" }} />
      {list.map((s, i) => (
        <li key={i} className="relative">
          <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full text-base font-semibold num" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{i + 1}</span>
          <h3 className="mt-5 text-[17px] font-semibold">{t(s.name.replace(/^\d+[.)]\s*/, ""))}</h3>
          {s.desc && <p className="mt-2 text-[15px] text-muted leading-relaxed">{t(s.desc)}</p>}
        </li>
      ))}
    </ol>
  );
}

function HighlightsGrid({ items, theme, band = false }: { items: string[]; theme: string; band?: boolean }) {
  const t = useT();
  void theme;
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
          <div key={i} className={`flex items-start gap-3 px-5 py-4 ${band ? "rounded-2xl" : `${cls.card} ${CARD_HOVER}`}`}
            style={band ? { border: "1px solid var(--hero-line)" } : undefined}>
            <span className="mt-0.5 shrink-0" style={{ color: band ? "var(--hero-text)" : "var(--accent)" }}><Icon name="check" size={18} /></span>
            <span className="text-[15px] font-medium leading-snug">{text}</span>
          </div>
        ); })}
      </div>
    );
  }
  if (short) {
    return (
      <ul className="gtk">
        {list.map((it, i) => { const { text } = glyphText(it, t); const ic = iconFor(it); return <li key={i}>{ic ? <Icon name={ic} /> : <Icon name="check" />}{stripEmoji(text)}</li>; })}
      </ul>
    );
  }
  const cols = list.length % 3 === 0 || list.length === 5 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <div className={`grid sm:grid-cols-2 ${cols} gap-5`}>
      {list.map((it, i) => { const { text } = glyphText(it, t); return (
        <div key={i} className={`${cls.card} p-6 ${CARD_HOVER}`}>
          <span className={cls.iconBox}><Icon name={iconFor(it) ?? "check"} size={18} /></span>
          <p className="mt-4 font-semibold text-[15px] leading-snug">{stripEmoji(text)}</p>
        </div>
      ); })}
    </div>
  );
}

function AboutBody({ block, hi, index = 0 }: { block: Extract<CardBlock, { kind: "about" }>; hi: boolean; index?: number }) {
  const prefs = useContext(LayoutCtx);
  const t = useT();
  const layout = preferredLayouts(prefs, { aboutImage: !!block.imageUrl }).about ?? aboutLayout(block, index);
  const eyebrow = <p className={cls.kicker}>{hi ? "परिचय" : t("About")}</p>;
  // A short text with no photo: one centred statement, large — not a thin paragraph lost in a wide box.
  if (layout === "statement") {
    return (
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow}
        <h2 className="sec-h2 mt-3">{t(block.title)}</h2>
        <span className="rev-rule mx-auto mt-6" />
        <div className="mt-7 space-y-4 text-[21px] md:text-[24px] leading-snug" style={{ fontFamily: "var(--font-display, var(--look-head))" }}>{paras(block.body).map((x, i) => <p key={i}>{t(x)}</p>)}</div>
      </div>
    );
  }
  // A long text with no photo: the heading holds the left column, the story runs down the right.
  if (layout === "columns") {
    return (
      <div className="grid gap-8 md:grid-cols-[0.8fr_1.4fr] md:gap-16 items-start">
        <div className="md:sticky md:top-24">{eyebrow}<h2 className="sec-h2 mt-3">{t(block.title)}</h2></div>
        <div className="space-y-5 text-[17px] leading-relaxed text-muted md:border-l md:border-border md:pl-10">{paras(block.body).map((x, i) => <p key={i} className={i === 0 ? "text-[19px] text-ink" : ""}>{t(x)}</p>)}</div>
      </div>
    );
  }
  const right = layout === "photo-right";
  return (
    <div className={`grid gap-12 items-center ${right ? "md:grid-cols-[1.1fr_0.9fr]" : "md:grid-cols-[0.9fr_1.1fr]"}`}>
      <div className={`relative ${right ? "md:order-2" : ""}`}>
        <Img src={block.imageUrl!} alt="" className="relative w-full h-auto max-h-[520px] object-cover rounded-3xl" sizes="(min-width: 768px) 45vw, 100vw" />
      </div>
      <div>
        {eyebrow}
        <h2 className="sec-h2 mt-3">{t(block.title)}</h2>
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
  const btn = `${BTN} ${FOCUS}`;
  void theme; void ink;
  return (
    <div className={`${cls.card} p-8 flex flex-col`}>
      {block.title && <h3 className="text-[22px] font-semibold tracking-tight">{t(block.title)}</h3>}
      {block.body && <p className={`${block.title ? "mt-2 text-[15px] text-muted" : "text-[20px] font-semibold tracking-tight"} leading-relaxed`}>{t(block.body)}</p>}
      <div className="mt-auto pt-6 space-y-3">
        {link && (internal
          ? <button type="button" onClick={() => { trackClick(card.username, "cta-join"); go(link.slice(1)); }} className={btn}>{t(block.joinLabel || "Learn more")}</button>
          : <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(card.username, "cta-join")} className={btn}><UserPlus className="h-4 w-4" /> {t(block.joinLabel || "Join Now")}</a>)}
        {link && block.referralCode && (
          <button type="button" onClick={() => { try { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }} className={`w-full flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted ${FOCUS}`}>
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
    <button type="button" onClick={() => { try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }} className={`inline-flex items-center gap-3 rounded-xl border px-5 py-3 text-lg font-semibold mono num ${FOCUS}`} style={{ borderColor: "var(--hero-line)" }}>
      {code}<span className="inline-flex items-center gap-1 text-xs font-semibold"><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/* ---------- product cards (the products page and the home preview) ---------- */
type Zoom = { images: string[]; i: number; alt: string } | null;
const galleryOf = (p: ProductItem) => [...(p.images ?? []), ...(p.imageUrl ? [p.imageUrl] : [])].filter((u, j, a) => u && a.indexOf(u) === j).slice(0, 3);

/** One product on a page of its own: the picture big on the left, everything about it on the right. The grid
 *  card is a teaser; this is the page a visitor lands on from a shared link or from search. */
/** A product line that ends in the price repeats what is printed right beside it. The builder strips this now,
 *  so this is for the cards that were built before it did. */
const descOf = (p: ProductItem) => (p.desc ?? "").replace(/[\s.·—–-]*(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?(?:\s*\/\s*\w+)?\s*$/i, "").trim();

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/** The product inside the bottom sheet: its detail, with a link to its own page for sharing. */
function ProductSheetBody({ p, card, theme, ink, waHref, hasWa, hrefFor, go }: { p: ProductItem; card: Card; theme: string; ink: string; waHref: (t?: string) => string; hasWa: boolean; hrefFor: (s: string) => string; go: (s: string) => void }) {
  const t = useT();
  const [zoom, setZoom] = useState<Zoom>(null);
  const slug = cardProducts(card).find((x) => x.item === p)?.slug;
  return (
    <div className="pt-2">
      <ProductDetail p={p} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={setZoom} />
      {slug && <a href={hrefFor(slug)} onClick={(e) => { e.preventDefault(); go(slug); }} className={`${LINK} mt-6 text-sm ${FOCUS}`}>{t("Open its page")} <Icon name="arrow-right" /></a>}
      {zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />}
    </div>
  );
}

function ProductDetail({ p, card, theme, ink, waHref, hasWa, onZoom, named = false, flip = false }: { p: ProductItem; card: Card; theme: string; ink: string; waHref: (t?: string) => string; hasWa: boolean; onZoom: (z: Zoom) => void; named?: boolean; flip?: boolean }) {
  const t = useT();
  void theme; void ink;
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
      <div className={`grid gap-3 ${flip ? "md:order-2" : ""}`}>
        <div className="p-img rounded-3xl">
          {gallery[0]
            ? <button type="button" onClick={() => onZoom({ images: gallery, i: 0, alt: p.name })} className={`absolute inset-0 p-8 cursor-zoom-in ${FOCUS}`}><FitImg src={gallery[0]} alt={p.name} className="h-full w-full object-contain" eager sizes="(min-width: 768px) 50vw, 100vw" /></button>
            : <span aria-hidden="true" className="p-ph">{initial}</span>}
          {discount && <span className="absolute right-5 top-5 num text-[12px] font-semibold" style={{ color: "var(--accent)" }}>{discount}% off</span>}
        </div>
        {gallery.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            {gallery.slice(1, 5).map((u, j) => (
              <button key={j} type="button" onClick={() => onZoom({ images: gallery, i: j + 1, alt: p.name })} className={`aspect-square overflow-hidden rounded-2xl p-2 ${FOCUS}`} style={{ background: "var(--paper-2)" }}>
                <FitImg src={u} alt="" className="h-full w-full object-contain" w={128} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        {/* On a product's own page the heading already carries the name and the price leads; in a showcase the name comes first. */}
        {p.badge && <p className={cls.kicker}>{t(p.badge)}</p>}
        {named && <h3 className={`text-[26px] md:text-[32px] tracking-tight leading-tight ${p.badge ? "mt-3" : ""}`}>{t(p.name)}</h3>}
        {(p.price || p.mrp) && (
          <p className={`num text-[24px] md:text-[28px] font-semibold tracking-tight ${named || p.badge ? "mt-4" : ""}`}>
            {p.price || p.mrp}
            {saved && <span className="ml-3 text-lg text-muted line-through font-normal">{p.mrp}</span>}
            {saved && <span className="block mt-1 text-sm font-medium" style={{ color: "var(--accent)" }}>{hi ? `आप ₹${saved.toLocaleString("en-IN")} बचाते हैं` : `You save ₹${saved.toLocaleString("en-IN")}`}</span>}
          </p>
        )}
        {descOf(p) && <p className="mt-5 text-[17px] text-muted leading-relaxed">{t(descOf(p))}</p>}
        {features.length > 0 && <ul className="mt-6 space-y-2 text-[16px]">{features.slice(0, 8).map((f, j) => <li key={j} className="flex items-start gap-2.5"><Icon name="check" className="mt-1 shrink-0" style={{ color: "var(--accent)" }} />{t(f)}</li>)}</ul>}
        {specs.length > 0 && (
          <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px] border-t border-border pt-5">
            {specs.map((x, j) => <div key={j} className="contents"><dt className="text-muted">{t(x.label)}</dt><dd className="font-medium">{t(x.value)}</dd></div>)}
          </dl>
        )}
        {hasWa && <a href={waHref(waText)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-product-whatsapp")} data-kind="whatsapp" className={`${BTN} hero-cta mt-8 ${FOCUS}`}><Icon name="whatsapp" /> {t(p.ctaLabel || "Order on WhatsApp")}</a>}
      </div>
    </div>
  );
}

function ProductGrid({ items, card, theme, ink, waHref, hasWa, onZoom, cols = 3, hrefFor, go, layout, openProduct }: { openProduct?: (p: ProductItem) => void; items: ProductItem[]; card: Card; theme: string; ink: string; waHref: (t?: string) => string; hasWa: boolean; onZoom: (z: Zoom) => void; cols?: 3 | 4; hrefFor?: (slug: string) => string; go?: (slug: string) => void; layout?: ProductsLayout }) {
  const t = useT();
  void theme; void ink;
  const prefs = useContext(LayoutCtx);
  const bp = useContext(BlueprintCtx);
  const shape = layout ?? preferredLayouts(prefs, { products: items.length }).products ?? productsLayout(items.length);
  // One or two products: each gets the full showcase — big photo, price, every feature — the photo side alternating.
  if (shape === "showcase") {
    return (
      <div className="space-y-16 md:space-y-24">
        {items.map((p, i) => <ProductDetail key={i} p={p} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={onZoom} named flip={i % 2 === 1} />)}
      </div>
    );
  }
  const columns = cols === 4 || shape === "dense" ? 4 : 3;
  // Each product has an address of its own (/p-kaju-katli): a link the owner can send by itself, and a page
  // search can index. On the product's own page there is nothing to link to.
  const addressOf = new Map(cardProducts(card).map((x) => [x.item, x.slug]));
  const single = items.length === 1;
  // No photo anywhere in the block: compact cards without an empty picture area.
  const compact = !items.some((p) => galleryOf(p).length > 0);
  return (
    <div className={bp === "cinematic" && items.length >= 3 ? "site-rail" : `grid sm:grid-cols-2 ${columns === 4 ? "lg:grid-cols-4 gap-4" : "lg:grid-cols-3 gap-6"}`}>
      {items.map((p, i) => {
        const gallery = galleryOf(p);
        const mrp = parsePrice(p.mrp), price = parsePrice(p.price);
        const saved = mrp && price && mrp > price ? mrp - price : null;
        const discount = saved && mrp ? Math.round((saved / mrp) * 100) : null;
        const specs = (p.specs ?? []).filter((x) => x.label || x.value);
        const waText = `Hi ${card.name.split(" ")[0]}, I'm interested in "${p.name}". Please share details.`;
        const initial = Array.from((p.name ?? "").trim())[0]?.toUpperCase() ?? "";
        const slug = addressOf.get(p);
        // A phone opens the product in a sheet over the page; a computer opens its own page.
        const open = (e: React.MouseEvent) => { e.preventDefault(); if (openProduct && isPhone()) openProduct(p); else if (slug) go!(slug); };
        const linkable = !single && ((slug && hrefFor && go) || openProduct);
        const title = <h3 className="p-name">{t(p.name)}</h3>;
        return (
          <div key={i} className={`group ${cls.card} overflow-hidden flex flex-col ${CARD_HOVER}`}>
            {/* The picture 4:5 on paper-2, the whole product in the frame (§4.5); no photo → the initial, faint. */}
            {!compact && (
              <div className="p-img">
                {gallery[0]
                  ? <button type="button" onClick={() => onZoom({ images: gallery, i: 0, alt: p.name })} className={`absolute inset-0 p-6 cursor-zoom-in ${FOCUS}`}><FitImg src={gallery[0]} alt={p.name} className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none" eager={i < 3} sizes={columns === 4 ? "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} /></button>
                  : <span aria-hidden="true" className="p-ph">{initial}</span>}
                {(p.badge || discount) && (
                  <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2 pointer-events-none text-[12px] font-semibold">
                    {p.badge ? <span className="kicker" style={{ fontSize: 11 }}>{t(p.badge)}</span> : <span />}
                    {discount && <span className="num" style={{ color: "var(--accent)" }}>{discount}% off</span>}
                  </div>
                )}
              </div>
            )}
            {gallery.length > 1 && (
              <div className="flex gap-2 px-5 pt-4">
                {gallery.map((u, j) => <button key={j} type="button" onClick={() => onZoom({ images: gallery, i: j, alt: p.name })} className={`h-12 w-12 rounded-lg overflow-hidden ${FOCUS}`} style={{ background: "var(--paper-2)" }}><Img src={u} alt="" className="h-full w-full object-contain p-1" w={56} /></button>)}
              </div>
            )}
            <div className="p-5 flex-1 flex flex-col gap-1.5">
              {compact && p.badge && <p className="kicker" style={{ fontSize: 11 }}>{t(p.badge)}</p>}
              <div className="flex items-start justify-between gap-4">
                {linkable
                  ? (slug && hrefFor && go
                    ? <a href={hrefFor(slug)} onClick={open} className={`rounded ${FOCUS}`}>{title}</a>
                    : <button type="button" onClick={open} className={`text-left rounded ${FOCUS}`}>{title}</button>)
                  : title}
                {(p.price || p.mrp) && (
                  <p className="p-price shrink-0 text-right">
                    {p.price || p.mrp}
                    {saved && <span className="block text-[12px] text-muted line-through font-normal">{p.mrp}</span>}
                  </p>
                )}
              </div>
              {descOf(p) && <p className="text-muted text-[14px] leading-relaxed line-clamp-2">{t(descOf(p))}</p>}
              {specs.length > 0 && (
                <details className="mt-1 group/specs">
                  <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[13px] font-medium inline-flex items-center gap-1 rounded text-muted ${FOCUS}`}>{t("Specifications")} <Icon name="chevron-down" className="transition-transform group-open/specs:rotate-180" /></summary>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">{specs.map((sp, j) => <div key={j} className="contents"><dt className="text-muted">{t(sp.label)}</dt><dd className="font-medium">{t(sp.value)}</dd></div>)}</dl>
                </details>
              )}
              {(hasWa || (slug && hrefFor && go && !single)) && (
                <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                  {hasWa ? <a href={waHref(waText)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-product-whatsapp")} className={`p-wa ${FOCUS}`}><Icon name="whatsapp" /> {t(p.ctaLabel || "Order on WhatsApp")}</a> : <span />}
                  {slug && hrefFor && go && !single && <a href={hrefFor(slug)} onClick={open} aria-label={t("Open this product")} className={`text-muted hover:text-ink rounded ${FOCUS}`}><Icon name="arrow-right" /></a>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Reviews (§4.7): the words set large in the display italic, a 1 px accent rule, the name small. One is a centred
 *  statement; two sit side by side; three to five are a grid; six or more drift by as a strip (site-smart Marquee). */
function ReviewCards({ items, theme }: { items: TestimonialItem[]; theme: string }) {
  const prefs = useContext(LayoutCtx);
  const bp = useContext(BlueprintCtx);
  const t = useT();
  void theme;
  if (bp === "cinematic") return <QuoteRotator items={items} t={t} />;
  const one = (x: TestimonialItem, i: number, big = false) => (
    <figure key={i} className={`flex flex-col ${big ? "items-center text-center" : ""}`}>
      <Stars n={Math.round(Number(x.rating) || 5)} />
      <blockquote className={`rev-q mt-4 ${big ? "md:text-[32px]" : ""} ${items.length >= 3 && !big ? "line-clamp-6" : ""}`}>“{t(x.text)}”</blockquote>
      <span className="rev-rule mt-5" />
      <figcaption className="rev-name mt-3">{x.name}</figcaption>
    </figure>
  );
  if (items.length >= 6) {
    return (
      <Marquee speed={Math.max(40, items.length * 10)} className="-mx-5 md:-mx-6" gap="gap-10">
        {items.map((r, i) => <div key={i} className="w-[300px] shrink-0 md:w-[380px]">{one(r, i)}</div>)}
      </Marquee>
    );
  }
  const layout = preferredLayouts(prefs, { reviews: items.length }).reviews ?? reviewsLayout(items.length);
  if (layout === "quote" || items.length === 1) return <div className="mx-auto max-w-3xl">{one(items[0], 0, true)}</div>;
  if (layout === "pair" || items.length === 2) return <div className="grid md:grid-cols-2 gap-10 md:gap-16">{items.map((x, i) => one(x, i))}</div>;
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-x-12 md:gap-y-14">{items.map((x, i) => one(x, i))}</div>;
}

/* ---------- the home page's pulled previews ---------- */
function Pulled({ section: s, index, card, theme, ink, waHref, go, links, hrefFor, openProduct }: { section: Exclude<HomeSection, { kind: "block" }>; index: number } & Omit<RunProps, "run" | "index">) {
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
          <ProductGrid items={s.items} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={setZoom} cols={s.items.length === 4 ? 4 : 3} hrefFor={hrefFor} go={go} layout={s.items.length <= 2 ? "showcase" : "grid"} openProduct={openProduct} />
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
                <Img src={g.url!} alt={g.label} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none" eager={i < 3} sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} />
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
          aside={<div className="flex items-center gap-4"><span className="stat">{(Math.round(s.avg * 10) / 10).toFixed(1)}</span><span className="text-sm text-muted"><Stars n={Math.round(s.avg)} /><span className="block mt-0.5">{hi ? `${s.total} ग्राहक` : t(`${s.total} customer reviews`)}</span></span>{s.total > s.items.length && <SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? "सभी पढ़ें" : t("Read all")}</SeeAll>}</div>}>
          <ReviewCards items={s.items} theme={theme} />
        </Section>
      );
    case "faq":
      return (
        <Section wide index={index} theme={theme} eyebrow="FAQ" title={t(s.title)} aside={s.total > s.items.length ? <SeeAll href={hrefFor(s.page)} go={go} slug={s.page}>{hi ? "सभी सवाल" : t("All questions")}</SeeAll> : undefined}>
          <div className="faq grid md:grid-cols-2 gap-x-10">
            {s.items.map((f, i) => (
              <details key={i} name="home-faq">
                <summary className={FOCUS}>{t(f.q)}<Icon name="chevron-down" size={18} /></summary>
                <p>{t(f.a)}</p>
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
                <div className={`flex items-start gap-4 ${cls.card} p-6`}>
                  <span className={cls.iconBox}><Icon name="pin" size={18} /></span>
                  <div className="flex-1">
                    <p className={cls.kicker}>{t(loc.title || "Address")}</p>
                    {address && <p className="mt-2 text-[16px] leading-relaxed">{t(address)}</p>}
                    {dir && <a href={dir} target="_blank" rel="noreferrer" className={`${LINK} mt-3 text-sm ${FOCUS}`}><Icon name="directions" /> {hi ? "रास्ता देखें" : t("Get directions")}</a>}
                  </div>
                </div>
              )}
              {s.hours && (
                <div className={`${cls.card} p-6`}>
                  <div className="flex items-center gap-3 mb-3"><span className={cls.iconBox}><Icon name="clock" size={18} /></span><p className="font-semibold">{t(s.hours.title || "Opening hours")}</p><OpenNowChip rows={s.hours.rows} hi={hi} className="ml-auto" /></div>
                  <table className="w-full text-[15px]"><tbody>{s.hours.rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0"><td className="py-2.5 font-medium">{t(r.day)}</td><td className={`py-2.5 text-right tabular-nums ${/closed|बंद/i.test(r.time) ? "text-danger font-medium" : "text-muted"}`}>{t(r.time)}</td></tr>)}</tbody></table>
                </div>
              )}
            </div>
            {mapQ && <iframe title="Map" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed`} className="w-full min-h-[340px] h-full rounded-2xl" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </div>
        </Section>
      );
    }
    default:
      return null;
  }
}

function SiteBlock({ block, index, card, theme, ink, waHref, go, links, hrefFor, openProduct }: RunProps & { block: CardBlock }) {
  const t = useT();
  const hi = card.language === "hi";
  const [zoom, setZoom] = useState<Zoom>(null);
  const [showAll, setShowAll] = useState(false);
  const hasWa = links.some((l) => l.type === "whatsapp");
  const lightbox = zoom && <ImageLightbox images={zoom.images} index={zoom.i} onIndex={(i) => setZoom({ ...zoom, i })} onClose={() => setZoom(null)} alt={zoom.alt} />;
  const eyebrow = "title" in block ? eyebrowFor(block.kind, block.title ?? "", hi) : undefined;

  switch (block.kind) {
    case "about":
      return <Section wide index={index} theme={theme}><AboutBody block={block} hi={hi} index={index} /></Section>;
    case "highlights": {
      // "Why choose us" — every point ticked — is the one stretch of the page that is not white: a long page of
      // pale sections was the main reason a finished card still read as empty.
      const band = block.items.length >= 3 && block.items.every((x) => (x ?? "").startsWith("✅"));
      return <Section wide index={index} theme={theme} tone={band ? "band" : "auto"} tight eyebrow={eyebrow} title={t(block.title)}><HighlightsGrid items={block.items} theme={theme} band={band} /></Section>;
    }
    case "services": {
      // "How it works" (numbered names) reads as a path, not a grid of cards.
      const isSteps = /^\d+[.)]\s/.test(block.items[0]?.name ?? "");
      return <Section wide index={index} theme={theme} tight={isSteps} eyebrow={isSteps ? (hi ? "प्रक्रिया" : t("Process")) : eyebrow} title={t(block.title)}>{isSteps ? <StepsRow items={block.items} /> : <ServicesGrid items={block.items} />}</Section>;
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
          <ProductGrid items={block.items} card={card} theme={theme} ink={ink} waHref={waHref} hasWa={hasWa} onZoom={setZoom} hrefFor={hrefFor} go={go} layout={block.id.startsWith("prodmore-") ? "grid" : undefined} openProduct={openProduct} />
          {lightbox}
        </Section>
      );
    case "testimonials":
      if (!block.items.length) return null;
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <ReviewCards items={block.items} theme={theme} />
        </Section>
      );
    case "faq": {
      const qs = block.items.filter((f) => f.q);
      // Plain <details> between hairlines (§4.8), no cards; two or three questions start open — nothing to click for so little.
      const openAll = (preferredLayouts(card.site?.style?.layouts, { faq: qs.length }).faq ?? faqLayout(qs.length)) === "open";
      return (
        <Section narrow index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="faq">
            {qs.map((f, i) => (
              <details key={i} name={openAll ? undefined : "faq"} open={openAll || undefined}>
                <summary className={FOCUS}>{t(f.q)}<Icon name="chevron-down" size={18} /></summary>
                <p>{t(f.a)}</p>
              </details>
            ))}
          </div>
        </Section>
      );
    }
    case "gallery": {
      const imgs = block.images.filter((g) => g.url);
      const shown = showAll ? imgs : imgs.slice(0, 12);
      const gl = preferredLayouts(card.site?.style?.layouts, { gallery: imgs.length }).gallery ?? galleryLayout(imgs.length);
      const open = (i: number) => setZoom({ images: imgs.map((x) => x.url!), i, alt: imgs[i].label });
      const cap = (g: { label: string }, always = false) => g.label && <span className={`absolute inset-x-0 bottom-0 px-3 py-2 text-left text-xs text-white bg-gradient-to-t from-black/60 to-transparent ${always ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}>{t(g.label)}</span>;
      // One photo: shown whole, as wide as the page. Two: side by side. Three to five: a mosaic, the first one big.
      if (gl !== "masonry") {
        const tile = (g: { url?: string; label: string }, i: number, cls: string, sizes: string) => (
          <button key={i} type="button" onClick={() => open(i)} className={`group relative block overflow-hidden rounded-2xl cursor-zoom-in ${cls} ${FOCUS}`}>
            <Img src={g.url!} alt={g.label} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none" eager sizes={sizes} />
            {cap(g, true)}
          </button>
        );
        const n = imgs.length;
        const mosaicCls = (i: number) =>
          i === 0 ? "col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto"
          : n === 4 && i === 1 ? "col-span-2 aspect-[2/1] md:aspect-auto"
          : "aspect-square md:aspect-auto";
        return (
          <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
            {gl === "single" && (
              <button type="button" onClick={() => open(0)} className={`group relative mx-auto block w-full max-w-5xl overflow-hidden rounded-3xl cursor-zoom-in ${FOCUS}`} style={{ background: "var(--paper-2)" }}>
                <Img src={imgs[0].url!} alt={imgs[0].label} className="mx-auto w-auto max-w-full h-auto max-h-[640px] object-contain" eager sizes="(min-width: 1024px) 1024px, 100vw" />
                {cap(imgs[0], true)}
              </button>
            )}
            {gl === "pair" && <div className="grid gap-4 md:grid-cols-2">{imgs.map((g, i) => tile(g, i, "aspect-[4/3]", "(min-width: 768px) 50vw, 100vw"))}</div>}
            {gl === "mosaic" && (
              <div className={`grid grid-cols-2 gap-3 md:grid-rows-2 md:h-[520px] ${n === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
                {imgs.map((g, i) => tile(g, i, mosaicCls(i), i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"))}
              </div>
            )}
            {lightbox}
          </Section>
        );
      }
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
            {shown.map((g, i) => (
              <button key={i} type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url!), i, alt: g.label })} className={`group relative block w-full break-inside-avoid cursor-zoom-in rounded-2xl overflow-hidden ${FOCUS}`}>
                <Img src={g.url!} alt={g.label} className="w-full h-auto transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none" eager={i < 8} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
                {g.label && <span className="absolute inset-x-0 bottom-0 px-3 py-2 text-left text-xs text-white bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">{t(g.label)}</span>}
              </button>
            ))}
          </div>
          {imgs.length > shown.length && <div className="mt-8 flex justify-center"><button type="button" onClick={() => setShowAll(true)} className={`${GHOST} ${FOCUS}`}>{t(`Show all ${imgs.length} photos`)}</button></div>}
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
                <button type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url), i, alt: g.caption ?? block.title })} className={`block w-full cursor-zoom-in rounded-3xl overflow-hidden ${FOCUS}`} style={{ background: "var(--paper-2)" }}>
                  <Img src={g.url} alt={g.caption ?? ""} className={many ? "w-full aspect-[4/3] object-contain p-4" : "w-full h-auto object-contain"} sizes={many ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 1024px, 100vw"} />
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
              <figure key={i} className={`${cls.card} overflow-hidden ${CARD_HOVER}`}>
                <div className="p-img"><button type="button" onClick={() => setZoom({ images: imgs.map((x) => x.url), i, alt: g.caption ?? block.title })} className={`absolute inset-0 p-4 cursor-zoom-in ${FOCUS}`}><FitImg src={g.url} alt={g.caption ?? ""} className="h-full w-full object-contain" eager={i < 3} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" /></button></div>
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
          <div className="hero-dark relative overflow-hidden rounded-3xl p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <i aria-hidden="true" className="hero-grain" />
            <div className="relative">
              <p className={cls.kicker}>{t(block.title)}</p>
              <p className="sec-h2 mt-3">{t(block.text)}</p>
              {block.expires && <p className="mt-3 text-sm" style={{ color: "var(--hero-muted)" }}>{t("Valid till")} {block.expires}</p>}
            </div>
            <div className="relative flex flex-col items-start gap-3">
              {block.code && <OfferCode code={block.code} />}
              {hasWa && <a href={waHref(`Hi, I'd like to claim: ${block.text}${block.code ? ` (code ${block.code})` : ""}`)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-offer-whatsapp")} className={`${BTN} ${FOCUS}`}><Icon name="whatsapp" /> {t("Claim on WhatsApp")}</a>}
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
            <div className={`flex items-start gap-4 ${cls.card} p-6`}>
              <span className={cls.iconBox}><Icon name="pin" size={18} /></span>
              <div className="flex-1">{address && <p className="text-[16px] leading-relaxed">{t(block.address)}</p>}<a href={pinUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className={`${LINK} ${address ? "mt-3" : ""} text-sm ${FOCUS}`}><Icon name="directions" /> {hi ? "रास्ता देखें" : t("Get directions")}</a></div>
            </div>
            {mapQ && <iframe title="Map" src={`https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed`} className="w-full h-[340px] rounded-2xl" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          </div>
        </Section>
      );
    }
    case "hours":
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={`${cls.card} p-6 max-w-2xl`}>
            <div className="flex items-center gap-3 mb-4"><span className={cls.iconBox}><Icon name="clock" size={18} /></span><p className="font-semibold">{t("Opening hours")}</p></div>
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
                  <li key={l.id}><a href={linkHref(l.type, l.value)} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, l.type)} className={`flex items-center gap-3 ${cls.card} px-4 py-3.5 ${CARD_HOVER} ${FOCUS}`}><span className={cls.iconBox}><LinkIcon type={l.type} className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-xs text-muted">{t(l.label)}</span><span className="block font-medium truncate">{l.value}</span></span></a></li>
                ))}
              </ul>
            </div>
            <div className={`${cls.card} p-6 md:p-8 flex flex-col`}><ContactForm username={card.username} theme={theme} fill /></div>
          </div>
        </Section>
      );
    case "cta":
      if (!block.title) {
        // Untitled CTA = a slim band, not a full section.
        const sep = block.joinUrl.includes("?") ? "&" : "?";
        const link = block.referralCode ? `${block.joinUrl}${sep}ref=${encodeURIComponent(block.referralCode)}` : block.joinUrl;
        const internal = link.startsWith("#");
        // A link into the site ("See all products") is navigation, a ghost; an outside link (join, order) is the primary.
        const btn = `${internal ? GHOST : BTN} shrink-0 ${FOCUS}`;
        const action = link && (internal
          ? <button type="button" onClick={() => { trackClick(card.username, "cta-join"); go(link.slice(1)); }} className={btn}>{t(block.joinLabel || "Learn more")}</button>
          : <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => trackClick(card.username, "cta-join")} className={btn}>{t(block.joinLabel || "Join Now")}</a>);
        // With nothing to say beside it ("See all products"), the button belongs under the section it follows —
        // a tinted box around one lonely pill made the page look padded out.
        if (!block.body) return <section className="mx-auto max-w-6xl px-6 pb-14 -mt-6 flex justify-center" data-reveal>{action}</section>;
        return (
          <section className="mx-auto max-w-6xl px-6 py-6" data-reveal>
            <div className="rounded-2xl px-8 py-6 flex flex-wrap items-center justify-between gap-6" style={{ background: "var(--paper-2)" }}>
              <p className="text-[18px] font-semibold tracking-tight">{t(block.body)}</p>
              {action}
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
            <div className={`rounded-3xl overflow-hidden bg-black ${shorts ? "aspect-[9/16]" : "aspect-video"}`}>
              {e?.type === "iframe" ? <iframe src={e.src} title={block.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                : e?.type === "video" ? <video src={e.src} poster={block.posterUrl ? picUrl(block.posterUrl, 1080) : undefined} preload="metadata" controls playsInline className="h-full w-full" />
                : <a href={block.url} target="_blank" rel="noreferrer" className="relative block h-full w-full" style={{ background: "var(--hero-ink)" }}>{block.posterUrl && <Img src={block.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" sizes="(min-width: 1024px) 1024px, 100vw" />}<span className="absolute inset-0 grid place-items-center"><span className="h-16 w-16 rounded-full grid place-items-center" style={{ background: "var(--paper)", color: "var(--hero-ink)" }}><Play className="h-7 w-7 translate-x-0.5" fill="currentColor" /></span></span></a>}
            </div>
            {block.caption && <p className="mt-4 text-[15px] text-muted leading-relaxed">{t(block.caption)}</p>}
          </div>
        </Section>
      );
    }
    case "appointment":
      return (
        <Section wide index={index} theme={theme}>
          <div className={`${cls.card} p-8 md:p-12 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center`}>
            <div>
              <p className={`${cls.kicker} inline-flex items-center gap-1.5`}><CalendarClock className="h-4 w-4" /> {t("Book a demo")}</p>
              <h2 className="sec-h2 mt-3">{t(block.title)}</h2>
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
          <Cmp {...(block.fileUrl ? { href: block.fileUrl, download: block.fileLabel } : {})} className={`max-w-3xl flex flex-col sm:flex-row items-stretch gap-6 ${cls.card} p-5 ${block.fileUrl ? `${CARD_HOVER} ${FOCUS}` : "opacity-70"}`}>
            {block.posterUrl && <Img src={block.posterUrl} alt={block.fileLabel} className="sm:w-56 w-full aspect-[4/3] sm:aspect-auto object-cover rounded-2xl" sizes="(min-width: 640px) 224px, 100vw" />}
            <div className="flex-1 flex items-center gap-4 min-w-0">
              <span className={cls.iconBox}><FileText className="h-5 w-5" /></span>
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
                    {it.imageUrl && <Img src={it.imageUrl} alt={it.label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold leading-tight">{t(it.label)}</p>
                    {it.sub && <p className="mt-0.5 text-sm text-muted">{t(it.sub)}</p>}
                  </div>
                </>
              );
              const tile = `group block overflow-hidden ${cls.card} ${CARD_HOVER}`;
              return it.url
                ? <a key={i} href={it.url} target="_blank" rel="noreferrer" className={tile}>{inner}</a>
                : <div key={i} className={tile}>{inner}</div>;
            })}
          </div>
        </Section>
      );
    case "table": {
      const hl = block.highlight ?? 1;
      const rows = block.rows.filter((r) => r.some(Boolean));
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={`overflow-x-auto ${cls.card}`}>
            <table className="w-full text-[15px] num">
              <thead><tr>{block.columns.map((c, i) => <th key={i} className={`p-4 text-left font-semibold ${i === hl ? "" : "text-muted"}`} style={i === hl ? { background: "var(--accent-soft)", color: "var(--accent)" } : { background: "var(--paper-2)" }}>{t(c)}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{block.columns.map((_, j) => <td key={j} className={`p-4 align-top ${j === 0 ? "font-semibold" : ""} ${j === hl ? "font-semibold" : j > 0 ? "text-muted" : ""}`} style={j === hl ? { color: "var(--accent)" } : undefined}>{t(r[j] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {block.note && <p className="mt-3 text-xs text-muted">{t(block.note)}</p>}
        </Section>
      );
    }
    case "form":
      return (
        <Section index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={`${cls.card} p-6 md:p-8`}><FormBlock block={block} username={card.username} theme={theme} t={t} /></div>
        </Section>
      );
    case "compare":
      return (
        <Section wide index={index} theme={theme} eyebrow={eyebrow} title={t(block.title)}>
          <div className={`overflow-x-auto ${cls.card}`}>
            <table className="w-full text-[15px]">
              <thead>
                <tr>
                  <th className="text-left p-4 text-muted font-medium w-1/4" style={{ background: "var(--paper-2)" }}>{t("Feature")}</th>
                  <th className="p-4 text-left font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{t(block.leftLabel)}</th>
                  <th className="p-4 text-left font-semibold bg-surface2 text-muted">{t(block.rightLabel)}</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.filter((r) => r.feature).map((r, i) => {
                  const lOk = r.leftOk !== false, rOk = r.rightOk === true;
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="p-4 text-[12px] font-semibold uppercase tracking-wide text-muted align-top">{t(r.feature)}</td>
                      <td className="p-4 align-top"><span className="flex items-start gap-2">{lOk ? <Icon name="check" className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} /> : <X className="h-4 w-4 shrink-0 mt-0.5 text-danger" />}<span className="font-medium">{t(r.left)}</span></span></td>
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
