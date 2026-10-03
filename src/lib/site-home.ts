// The website's composed home page. A card's own home page is usually short (a video, a few highlights, an
// about paragraph) while its best material — products with photos, the gallery, reviews, FAQ, the map and
// timings — sits on other pages. The website home pulls a preview of each of those in after the owner's own
// home blocks, each with a "see all" link to its page, so the first screenfuls already show the business.
//
// Section keys are stable (a block's id, or a fixed word for a pulled preview), so the owner can reorder and
// hide them in the website editor (`card.site.home`). Pure module: the renderer and the editor both use it.
import type { Card, CardBlock, CardPage, FaqItem, GalleryImage, ProductItem, SiteHome, TestimonialItem } from "./types";

type Location = Extract<CardBlock, { kind: "location" }>;
type Hours = Extract<CardBlock, { kind: "hours" }>;

export type HomeSection =
  | { key: string; kind: "block"; block: CardBlock }
  | { key: "featured"; kind: "featured"; title: string; items: ProductItem[]; page: string; total: number }
  | { key: "gallery"; kind: "gallery"; title: string; images: GalleryImage[]; page: string; total: number }
  | { key: "reviews"; kind: "reviews"; title: string; items: TestimonialItem[]; page: string; total: number; avg: number }
  | { key: "faq"; kind: "faq"; title: string; items: FaqItem[]; page: string; total: number }
  | { key: "visit"; kind: "visit"; title: string; location?: Location; hours?: Hours; page: string };

export const PULLED_KEYS = ["featured", "gallery", "reviews", "faq", "visit"] as const;

const mapOk = (u?: string) => !!u && /^https?:\/\//i.test(u.trim());
/** Kinds that render nothing when empty — the section must not appear at all. */
export function isEmptyBlock(b: CardBlock): boolean {
  if ("items" in b && Array.isArray(b.items) && b.items.length === 0) return true;
  if ("rows" in b && Array.isArray(b.rows) && b.rows.length === 0) return true;
  if ((b.kind === "image" || b.kind === "carousel" || b.kind === "gallery") && !b.images.some((i) => i.url)) return true;
  if (b.kind === "video" && !b.url) return true;
  if (b.kind === "form" && !b.fields.some((f) => f.label)) return true;
  if (b.kind === "table" && !b.rows.some((r) => r.some(Boolean))) return true;
  if (b.kind === "about" && !(b.body ?? "").trim() && !b.imageUrl) return true;
  if (b.kind === "location" && !(b.address ?? "").trim() && !mapOk(b.mapUrl)) return true;
  return false;
}

const hi = (card: Card) => card.language === "hi";
const L = (card: Card, en: string, h: string) => (hi(card) ? h : en);

/** The first page (in nav order) carrying a block of `kind`, skipping the home page — and any hidden page: the
 *  Shubhora page on a "both" card (and the one every card carries for the strip's "Know more") is for a different
 *  audience, and pulling its plans onto a school's home page as "featured" is how Shubhora's packages reached
 *  every business website (3 Oct 2026). */
function find<K extends CardBlock["kind"]>(pages: CardPage[], home: CardPage | undefined, kind: K): { page: CardPage; block: Extract<CardBlock, { kind: K }> } | null {
  for (const pg of pages) {
    if (pg === home || pg.hidden) continue;
    const block = pg.blocks.find((b): b is Extract<CardBlock, { kind: K }> => b.kind === kind && !isEmptyBlock(b));
    if (block) return { page: pg, block };
  }
  return null;
}
const has = (home: CardPage | undefined, kind: CardBlock["kind"]) => !!home?.blocks.some((b) => b.kind === kind && !isEmptyBlock(b));
const productImages = (p: ProductItem) => [...(p.images ?? []), ...(p.imageUrl ? [p.imageUrl] : [])].filter((u, j, a) => u && a.indexOf(u) === j);

/** The default order: the owner's home blocks, with the pulled previews slotted where a good home page wants them. */
function defaultSections(card: Card, pages: CardPage[]): HomeSection[] {
  const home = pages.find((p) => p.slug === "home") ?? pages[0];
  const own: HomeSection[] = (home?.blocks ?? []).filter((b) => !isEmptyBlock(b)).map((b) => ({ key: b.id, kind: "block", block: b }));
  const out = [...own];
  // The "cta" anchor is the closing call-to-action at the end of the page, never a "See all products" link that
  // sits right under the catalogue — anchoring on that one put the FAQ and the reviews above everything else.
  const inPageLink = (b: CardBlock) => b.kind === "cta" && (b.joinUrl ?? "").startsWith("#");
  const insertBefore = (kinds: CardBlock["kind"][], s: HomeSection) => {
    const at = out.findIndex((x) => x.kind === "block" && kinds.includes(x.block.kind) && !inPageLink(x.block));
    out.splice(at < 0 ? out.length : at, 0, s);
  };

  // Featured products: right after the opening block (a video or the about text), before everything else.
  if (!has(home, "product")) {
    const f = find(pages, home, "product");
    if (f) {
      const items = [...f.block.items].sort((a, b) => Number(productImages(b).length > 0) - Number(productImages(a).length > 0)).slice(0, f.block.items.length >= 4 ? 4 : 3);
      const s: HomeSection = { key: "featured", kind: "featured", title: f.block.title || L(card, "Our products", "हमारे प्रोडक्ट"), items, page: f.page.slug, total: f.block.items.length };
      const first = out[0];
      out.splice(first && first.kind === "block" && (first.block.kind === "video" || first.block.kind === "about" || first.block.kind === "highlights") ? 1 : 0, 0, s);
    }
  }
  // Gallery: before the reviews / contact end of the page.
  if (!has(home, "gallery") && !has(home, "carousel")) {
    const g = find(pages, home, "gallery");
    if (g) {
      const images = g.block.images.filter((i) => i.url).slice(0, 5); // one big + four small tiles
      if (images.length >= 3) insertBefore(["testimonials", "faq", "contact", "appointment", "cta"], { key: "gallery", kind: "gallery", title: g.block.title || L(card, "Photos", "फ़ोटो"), images, page: g.page.slug, total: g.block.images.filter((i) => i.url).length });
    }
  }
  // Reviews: the best three, before the contact end.
  if (!has(home, "testimonials")) {
    const r = find(pages, home, "testimonials");
    if (r) {
      const all = r.block.items.filter((x) => (x.text ?? "").trim());
      const items = [...all].sort((a, b) => (b.rating - a.rating) || (b.text.length - a.text.length)).slice(0, 3);
      const avg = all.length ? all.reduce((s, x) => s + (Number(x.rating) || 0), 0) / all.length : 0;
      if (items.length) insertBefore(["faq", "contact", "appointment", "cta"], { key: "reviews", kind: "reviews", title: r.block.title || L(card, "What customers say", "ग्राहक क्या कहते हैं"), items, page: r.page.slug, total: all.length, avg });
    }
  }
  // FAQ: the first four questions.
  if (!has(home, "faq")) {
    const f = find(pages, home, "faq");
    if (f) {
      const items = f.block.items.filter((x) => x.q && x.a).slice(0, 4);
      if (items.length >= 2) insertBefore(["contact", "appointment", "cta"], { key: "faq", kind: "faq", title: f.block.title || "FAQ", items, page: f.page.slug, total: f.block.items.length });
    }
  }
  // Visit: address / map and timings together, at the end.
  if (!has(home, "location") && !has(home, "hours")) {
    const loc = find(pages, home, "location"), hrs = find(pages, home, "hours");
    if (loc || hrs) insertBefore(["contact", "appointment"], { key: "visit", kind: "visit", title: L(card, "Visit us", "हमसे मिलें"), location: loc?.block, hours: hrs?.block, page: (loc ?? hrs)!.page.slug });
  }
  return out;
}

/** The home sections in the order the website shows them, after the owner's own order and hidden list
 *  (`all`: the hidden ones too, for the editor). */
export function homeSections(card: Card, pages: CardPage[], opts: { all?: boolean } = {}): HomeSection[] {
  const base = defaultSections(card, pages);
  const order = card.site?.home?.order;
  const hidden = new Set(card.site?.home?.hidden ?? []);
  let list = base;
  if (order && order.length) {
    const rank = new Map(order.map((k, i) => [k, i]));
    // Sections the owner never saw (added later) keep their default place among the ordered ones.
    list = base.map((s, i) => ({ s, i })).sort((a, b) => {
      const ra = rank.get(a.s.key), rb = rank.get(b.s.key);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra === undefined && rb === undefined) return a.i - b.i;
      // an unranked section stays next to the ranked neighbour that followed it by default
      const ia = ra === undefined ? nearestRank(base, rank, a.i) : ra, ib = rb === undefined ? nearestRank(base, rank, b.i) : rb;
      return ia === ib ? a.i - b.i : ia - ib;
    }).map((x) => x.s);
  }
  return opts.all ? list : list.filter((s) => !hidden.has(s.key));
}
function nearestRank(base: HomeSection[], rank: Map<string, number>, i: number): number {
  for (let j = i + 1; j < base.length; j++) { const r = rank.get(base[j].key); if (r !== undefined) return r - 0.5; }
  return Number.MAX_SAFE_INTEGER;
}

/** What a section is called in the editor. */
export function sectionLabel(s: HomeSection, lang?: string): string {
  const h = lang === "hi";
  if (s.kind === "block") {
    const b = s.block;
    const title = "title" in b ? (b.title ?? "").trim() : "";
    const kind: Record<CardBlock["kind"], [string, string]> = {
      about: ["About", "परिचय"], highlights: ["Highlights", "खासियत"], services: ["Services", "सेवाएँ"], product: ["Products", "प्रोडक्ट"], gallery: ["Photos", "फ़ोटो"],
      image: ["Picture", "चित्र"], carousel: ["Pictures", "चित्र"], video: ["Video", "वीडियो"], pdf: ["PDF", "PDF"], testimonials: ["Reviews", "रिव्यू"], faq: ["FAQ", "सवाल-जवाब"],
      hours: ["Timings", "समय"], appointment: ["Appointment", "अपॉइंटमेंट"], location: ["Location", "पता"], offer: ["Offer", "ऑफ़र"], contact: ["Contact", "संपर्क"], cta: ["Call to action", "बटन"],
      compare: ["Comparison", "तुलना"], showcase: ["Showcase", "शोकेस"], table: ["Price list", "दाम की सूची"], form: ["Form", "फ़ॉर्म"],
    };
    const k = kind[b.kind]?.[h ? 1 : 0] ?? b.kind;
    return title && title.toLowerCase() !== k.toLowerCase() ? `${title} · ${k}` : k || title;
  }
  const pulled: Record<Exclude<HomeSection["kind"], "block">, [string, string]> = {
    featured: ["Featured products", "चुनिंदा प्रोडक्ट"], gallery: ["Photo preview", "फ़ोटो झलक"], reviews: ["Top reviews", "बेहतरीन रिव्यू"], faq: ["Quick FAQ", "छोटे सवाल-जवाब"], visit: ["Visit us (map + timings)", "पता और समय"],
  };
  return pulled[s.kind][h ? 1 : 0];
}

/* ================= trust strip ================= */

export type TrustFact = { value: string; label: string };

const yearNow = () => new Date().getFullYear();
/** "Since 2015" / "Est. 2009" / "2015 से" anywhere in the owner's own words → the year. */
function sinceYear(texts: string[]): number | null {
  for (const t of texts) {
    const m = /(?:since|est\.?|estd\.?|established|from|शुरू|से)\s*[:\-]?\s*((?:19|20)\d\d)\b/i.exec(t ?? "") ?? /\b((?:19|20)\d\d)\s*(?:से|se)\b/i.exec(t ?? "");
    if (m) { const y = Number(m[1]); if (y >= 1900 && y <= yearNow()) return y; }
  }
  return null;
}

/** Three or four short facts for the strip under the hero — only what the card itself says: reviews it shows,
 *  products it lists, a year the owner wrote, timings, GST, verification. Nothing is invented. */
export function trustFacts(card: Card): TrustFact[] {
  const own = card.site?.home?.stats?.filter((s) => s.value.trim() && s.label.trim());
  if (own && own.length) return own.slice(0, 4);
  const h = hi(card);
  const blocks = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);
  const out: TrustFact[] = [];
  const reviews = blocks.flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim());
  if (reviews.length >= 3) {
    const avg = reviews.reduce((s, x) => s + (Number(x.rating) || 0), 0) / reviews.length;
    out.push({ value: `${(Math.round(avg * 10) / 10).toFixed(1)}★`, label: h ? `${reviews.length} ग्राहक रिव्यू` : `${reviews.length} customer reviews` });
  }
  const year = sinceYear([...blocks.flatMap((b) => (b.kind === "highlights" ? b.items : [])), card.about ?? "", card.tagline ?? "", card.botKnowledge ?? ""]);
  if (year) {
    const yrs = yearNow() - year;
    out.push({ value: h ? `${year} से` : `Since ${year}`, label: yrs >= 2 ? (h ? `${yrs} साल का भरोसा` : `${yrs} years of trust`) : (h ? "भरोसेमंद" : "trusted business") });
  }
  const products = blocks.flatMap((b) => (b.kind === "product" ? b.items : [])).filter((p) => (p.name ?? "").trim());
  if (products.length >= 3) out.push({ value: `${products.length}+`, label: h ? "प्रोडक्ट" : "products" });
  const services = blocks.flatMap((b) => (b.kind === "services" && !/^1\. /.test(b.items[0]?.name ?? "") ? b.items : [])).filter((s) => (s.name ?? "").trim());
  if (products.length < 3 && services.length >= 3) out.push({ value: `${services.length}`, label: h ? "सेवाएँ" : "services" });
  const hours = blocks.find((b): b is Hours => b.kind === "hours" && b.rows.length > 0);
  if (hours) {
    const open = hours.rows.filter((r) => !/closed|बंद/i.test(r.time ?? ""));
    if (open.length >= 7 || (open.length === hours.rows.length && hours.rows.length >= 6)) out.push({ value: h ? "7 दिन" : "7 days", label: h ? "खुला" : "open every day" });
  }
  const areas = card.seo?.areas?.filter(Boolean) ?? [];
  if (areas.length >= 3 && !areas.some((a) => /all india|online|worldwide/i.test(a))) out.push({ value: `${areas.length}`, label: h ? `${card.seo?.city ? card.seo.city + " में " : ""}इलाके` : `areas${card.seo?.city ? ` in ${card.seo.city}` : ""}` });
  else if (areas.some((a) => /all india/i.test(a))) out.push({ value: h ? "पूरे भारत" : "All India", label: h ? "में सेवा" : "delivery & service" });
  if (card.gstin?.trim()) out.push({ value: "GST", label: h ? "रजिस्टर्ड बिज़नेस" : "registered business" });
  if (card.verified) out.push({ value: "✓", label: h ? "वेरिफ़ाइड" : "verified" });
  return out.length >= 3 ? out.slice(0, 4) : [];
}

/** A home object with only known keys and bounded values (API input, stored on the card). */
export function cleanHome(x: unknown): SiteHome | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const keys = (a: unknown) => (Array.isArray(a) ? a.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 40).slice(0, 60) : undefined);
  const out: SiteHome = {};
  const order = keys(o.order); if (order) out.order = order;
  const hidden = keys(o.hidden); if (hidden) out.hidden = hidden;
  if (Array.isArray(o.stats)) {
    out.stats = o.stats
      .map((s) => (s && typeof s === "object" ? s as Record<string, unknown> : {}))
      .map((s) => ({ value: String(s.value ?? "").trim().slice(0, 24), label: String(s.label ?? "").trim().slice(0, 40) }))
      .filter((s) => s.value && s.label).slice(0, 4);
  }
  return out;
}
