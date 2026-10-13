// Five finished website templates per trade (owner, 12 Oct 2026: "har trade ke 5 template; template ka matlab perfect
// site, every page look good and complete data"), generated from three inputs gathered by scripts/build-trade-templates.mjs:
//   • the SAMPLE: complete sample content of one business of the trade — 8 products with ₹ prices, 6 services, offer,
//     3 reviews, FAQ, hours, address, about — written per trade after the Oct 2026 market review;
//   • the DESIGNS: five page structures per trade (blueprint, palette, type, corners, the hero's words, which photos),
//     mapped from the review's style families for that trade's group; a trade without its own designs gets its group's;
//   • the PHOTOS: the trade's own stock photographs under public/art/tpl/<trade>/ (Pexels, free licence).
// The result is a plain CardTemplateDef list (docs/website-looks-v3.md §5): the same renderer draws every page, so edit,
// preview, looks and the bot work on these like on any card. Server only — the list is large; clients read /api/templates.
import type { CardTemplateDef } from "./templates";
import type { CardBlock, CardPage, GalleryImage, ProductItem, SiteStyle } from "./types";
import { categoryOf } from "./poster-categories";
import { BLUEPRINTS } from "./site-blueprints";

export type SamplePhoto = { slug: string; query: string; orientation: "landscape" | "portrait"; role: "cover" | "space" | "people" | "product" | "detail" | "team" };
export type SampleProduct = { name: string; price: string; mrp?: string; badge?: string; category?: string; desc: string; features: string[]; specs: { label: string; value: string }[]; photo: string };
export type TradeSample = {
  trade: string; businessName: string; jobTitle: string; lead: "business" | "person";
  tagline: string; about: string; highlights: string[];
  catalogTitle: string; catalogPage: string; ctaLabel: string; productCta: string;
  products: SampleProduct[]; services: { name: string; desc: string }[];
  offer: { title: string; text: string };
  reviews: { name: string; text: string; rating: number }[];
  faq: { q: string; a: string }[];
  hours: { day: string; time: string }[];
  address: string; botPersona: string; botKnowledge: string;
  photos: SamplePhoto[];
};
/** One of a trade's five designs. `cover` / `gallery` name photo slugs; a slug that was never fetched is skipped. */
export type TradeDesign = {
  slug: string; name: string; emoji: string; description: string;
  blueprint: NonNullable<SiteStyle["blueprint"]>;
  palette: string; color?: string; font: string; radius: NonNullable<SiteStyle["radius"]>; motion: NonNullable<SiteStyle["motion"]>;
  look: CardTemplateDef["data"]["template"]; body?: "dark"; heroVariant?: string;
  headline: string; sub: string;
  cover?: string; gallery?: string[]; layouts?: SiteStyle["layouts"];
};
export type TradeTemplateData = { builtAt: string; samples: Record<string, TradeSample>; designs: Record<string, { trade: string; variants: TradeDesign[] } | TradeDesign[]>; photos: Record<string, string[]> };

/* ---------- the group defaults: five structures per kind of trade, from the review (used until a trade's own designs land) ---------- */
type D = Omit<TradeDesign, "headline" | "sub" | "cover" | "gallery" | "slug" | "name" | "emoji" | "description"> & { slug: string; name: string; emoji: string; description: string };
const d = (slug: string, name: string, emoji: string, description: string, blueprint: D["blueprint"], palette: string, font: string, look: D["look"], radius: D["radius"] = "soft", motion: D["motion"] = "calm", extra: Partial<D> = {}): D =>
  ({ slug, name, emoji, description, blueprint, palette, font, look, radius, motion, ...extra });
const GROUP_DEFAULTS: Record<string, D[]> = {
  Retail: [
    d("shop", "Order Shop", "🛍️", "Category chips, a promo banner with Order on WhatsApp, products two across with prices — the pattern customers know from shopping apps.", "shop", "saffron", "bold", "bold", "soft"),
    d("board", "Fresh Board", "🧾", "A calm paper board: photo tile, open now, the map, the offer and the first products at a glance.", "bento", "brand", "honest", "minimal", "round"),
    d("wordmark", "Wordmark", "🅰️", "The shop's name set huge, a strip of product photos with one colour tile under it — the boutique look.", "wordmark", "ivory", "elegant", "earthy", "soft"),
    d("collage", "Collage", "🧩", "Quick-action tiles beside a photo collage; everything in soft cards.", "collage", "pearl", "tech", "glass", "round"),
    d("dark", "Premium Dark", "🌙", "A full-screen product photo on black, gold details, the whole page a dark room — for premium goods.", "cinematic", "noir", "luxury", "royal", "sharp", "calm", { body: "dark" }),
  ],
  Food: [
    d("wordmark", "Wordmark", "🥐", "The name set huge on warm paper, a strip of food photos under it — the newest café and bakery look.", "wordmark", "ivory", "warm", "earthy", "soft"),
    d("dark", "Royal Dark", "🍛", "Full-screen dish photo, gold on black, fine serif, a dark page from top to bottom.", "cinematic", "noir", "luxury", "royal", "sharp", "calm", { body: "dark" }),
    d("shop", "Order Shop", "🛵", "Dish chips to scroll, a promo banner with Order on WhatsApp, open-now and the offer — the food-app pattern.", "shop", "saffron", "bold", "bold", "round"),
    d("poster", "Bold Poster", "🍔", "A colour block, heavy uppercase type, the photo as a card — the burger-bar and street-food look.", "story", "emerald", "bold", "bold", "sharp", "lively"),
    d("board", "Fresh Board", "🥗", "A light paper board with open-now, booking and the first dishes at a glance.", "bento", "brand", "editorial", "minimal", "round"),
  ],
  Health: [
    d("collage", "Care Collage", "🩺", "Words and quick actions (WhatsApp, call, directions, book) beside a photo collage; services as tiles — the booking-app look.", "collage", "pearl", "clinic", "glass", "round"),
    d("board", "Clinic Board", "📋", "A calm paper board: the doctor's photo, open now, the map and booking at a glance.", "bento", "ocean", "clinic", "classic", "round"),
    d("cover", "Calm Cover", "🌿", "Words on paper beside a 4:5 photo, no scrim; quiet, trustworthy, serif.", "cinematic", "teal", "editorial", "minimal", "soft", "calm", { heroVariant: "cover-split" }),
    d("wordmark", "Wordmark", "🅰️", "The clinic's name set large, a strip of photos with one colour tile under it.", "wordmark", "pearl", "clinic", "minimal", "soft"),
    d("dark", "Luxe Dark", "✨", "A full-screen portrait, espresso and gold, fine serif — for salons, spas and premium clinics.", "cinematic", "cocoa", "luxury", "royal", "sharp", "calm", { body: "dark" }),
  ],
  Services: [
    d("collage", "Collage", "🧩", "Words and quick-action tiles beside a photo collage; soft cards throughout — the home-services app look.", "collage", "pearl", "tech", "glass", "round"),
    d("board", "Board", "📋", "A paper board of facts: photo, open now, the map, booking, since — all on screen one.", "bento", "steel", "honest", "corporate", "soft"),
    d("cover", "Cover", "🎬", "A full-screen photo with the headline low over it; scenes and a product rail below.", "cinematic", "midnight", "bold", "dark", "soft"),
    d("wordmark", "Wordmark", "🅰️", "The name set huge, a strip of work photos with one colour tile under it — the studio look.", "wordmark", "ivory", "editorial", "earthy", "soft"),
    d("poster", "Poster", "📣", "A colour block, heavy type, the photo as a card — bold and direct.", "story", "crimson", "bold", "bold", "sharp", "lively"),
  ],
  Education: [
    d("collage", "Campus Collage", "🎓", "Words and quick actions beside a photo collage of classes; courses as tiles.", "collage", "ocean", "editorial", "classic", "round"),
    d("board", "Board", "📋", "A paper board: the campus photo, admissions open, the map, the first courses.", "bento", "emerald", "clinic", "minimal", "round"),
    d("cover", "Cover", "🎬", "A full-screen campus photo with the headline low over it.", "cinematic", "midnight", "editorial", "dark", "soft"),
    d("wordmark", "Wordmark", "🅰️", "The institute's name set large, a strip of photos with one colour tile under it.", "wordmark", "pearl", "editorial", "minimal", "soft"),
    d("shop", "Course Shop", "📚", "Course chips to scroll, a promo banner with Enquire on WhatsApp, fees open.", "shop", "royal", "tech", "bold", "soft"),
  ],
  Sales: [
    d("board", "Board", "📋", "A paper board of facts: the person, the brands, call and WhatsApp at a glance.", "bento", "steel", "honest", "corporate", "soft"),
    d("collage", "Collage", "🧩", "Quick-action tiles beside a photo collage; products as cards.", "collage", "pearl", "tech", "glass", "round"),
    d("cover", "Cover", "🎬", "A full-screen photo with the headline low over it.", "cinematic", "midnight", "bold", "dark", "soft"),
    d("shop", "Catalogue Shop", "🛍️", "Product chips, a promo banner, prices two across — the catalogue pattern.", "shop", "saffron", "bold", "bold", "soft"),
    d("wordmark", "Wordmark", "🅰️", "The name set large, a strip of photos with one colour tile under it.", "wordmark", "ivory", "editorial", "earthy", "soft"),
  ],
  Industry: [
    d("board", "Board", "📋", "A paper board of facts: the plant, since, the map, the first products.", "bento", "steel", "tech", "corporate", "sharp"),
    d("collage", "Collage", "🧩", "Quick-action tiles beside a photo collage; products as cards.", "collage", "emerald", "honest", "classic", "soft"),
    d("cover", "Cover", "🎬", "A full-screen photo of the work with the headline low over it.", "cinematic", "midnight", "bold", "dark", "soft"),
    d("shop", "Catalogue Shop", "🛍️", "Product chips, a promo banner with Enquire on WhatsApp, prices open.", "shop", "saffron", "bold", "bold", "soft"),
    d("wordmark", "Wordmark", "🅰️", "The company's name set large, a strip of photos with one colour tile under it.", "wordmark", "pearl", "tech", "minimal", "sharp"),
  ],
  Community: [
    d("cover", "Cover", "🎬", "A full-screen photo of the people and the work, the headline low over it.", "cinematic", "saffron", "editorial", "classic", "soft"),
    d("collage", "Collage", "🧩", "Words and quick actions beside a photo collage; the work as tiles.", "collage", "pearl", "editorial", "glass", "round"),
    d("board", "Board", "📋", "A paper board: the photo, how to reach, the next event, the first causes.", "bento", "crimson", "honest", "classic", "round"),
    d("wordmark", "Wordmark", "🅰️", "The name set large, a strip of photos with one colour tile under it.", "wordmark", "ivory", "editorial", "earthy", "soft"),
    d("poster", "Poster", "📣", "A colour block, heavy type, the photo as a card — a rally poster.", "story", "saffron", "bold", "bold", "sharp", "lively"),
  ],
  Personal: [
    d("poster", "Poster", "🪪", "A colour block, the name set big, the portrait as a card — a profile that reads like a poster.", "story", "midnight", "bold", "bold", "soft", "lively"),
    d("board", "Board", "📋", "A paper board: the portrait, what I do, how to reach me.", "bento", "steel", "tech", "minimal", "round"),
    d("collage", "Collage", "🧩", "Words and quick actions beside a photo collage.", "collage", "pearl", "editorial", "glass", "round"),
    d("wordmark", "Wordmark", "🅰️", "The name set huge, a strip of photos with one colour tile under it — the portfolio look.", "wordmark", "ivory", "elegant", "earthy", "soft"),
    d("cover", "Cover", "🎬", "A full-screen portrait with the headline low over it.", "cinematic", "noir", "luxury", "royal", "sharp", "calm", { body: "dark" }),
  ],
};

/* ---------- helpers ---------- */
const url = (trade: string, slug: string) => `/art/tpl/${trade}/${slug}.jpg`;
const cap = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const firstSentence = (s: string) => { const m = /^(.+?[.!?])(\s|$)/.exec((s ?? "").trim()); return (m ? m[1] : s).slice(0, 110); };
/** Photo slugs of a role that were really fetched, in the sample's order. */
function byRole(sample: TradeSample, have: Set<string>, ...roles: SamplePhoto["role"][]): string[] {
  const out: string[] = [];
  for (const r of roles) for (const p of sample.photos) if (p.role === r && have.has(p.slug) && !out.includes(p.slug)) out.push(p.slug);
  return out;
}

/** The five templates of one trade. */
export function tradeTemplates(trade: string, data: TradeTemplateData): CardTemplateDef[] {
  const sample = data.samples[trade];
  if (!sample) return [];
  const cat = categoryOf(trade);
  const group = cat?.group ?? "Services";
  const have = new Set(data.photos[trade] ?? []);
  const own = data.designs[trade];
  const ownList: TradeDesign[] | undefined = Array.isArray(own) ? own : own?.variants;
  const designs: TradeDesign[] = (ownList && ownList.length >= 5 ? ownList : (GROUP_DEFAULTS[group] ?? GROUP_DEFAULTS.Services).map((x) => ({ ...x, headline: sample.tagline, sub: firstSentence(sample.about) }))).slice(0, 5);

  const covers = byRole(sample, have, "cover", "space", "people", "product");
  const galleryPool = byRole(sample, have, "space", "people", "detail", "product", "cover", "team");
  const team = byRole(sample, have, "team", "people")[0];
  const space = byRole(sample, have, "space", "cover")[0];
  const wa = { id: "l1", type: "whatsapp" as const, label: "WhatsApp", value: "+91" };
  const links = [wa, { id: "l2", type: "phone" as const, label: "Call", value: "+91" }, { id: "l3", type: "location" as const, label: "Find us", value: "" }, { id: "l4", type: "instagram" as const, label: "Instagram", value: "" }];
  const catalogSlug = /menu/i.test(sample.catalogPage) ? "menu" : /service|treatment/i.test(sample.catalogPage) ? "services" : /course|class|programme/i.test(sample.catalogPage) ? "courses" : /package|plan/i.test(sample.catalogPage) ? "packages" : "products";
  const booking = /book|appoint|consult|enquir|visit/i.test(sample.ctaLabel) || /^(Health|Services|Education)$/.test(group);

  return designs.map((v, i) => {
    const key = `${trade}-${v.slug}`;
    let n = 0; const id = () => `${key}-${++n}`;
    const cover = v.cover && have.has(v.cover) ? v.cover : covers[i % Math.max(1, covers.length)];
    const wanted = (v.gallery ?? []).filter((s) => have.has(s));
    const gallery = [...wanted, ...galleryPool.filter((s) => !wanted.includes(s) && s !== cover)].slice(0, 6);
    const usedPhoto = new Set<string>();
    const spare = byRole(sample, have, "product", "detail").filter((s) => !sample.products.some((p) => p.photo === s));
    const photoOf = (p: SampleProduct): string | undefined => {
      let s: string | undefined = have.has(p.photo) && !usedPhoto.has(p.photo) ? p.photo : spare.find((x) => !usedPhoto.has(x));
      if (!s && have.has(p.photo)) s = p.photo;   // nothing spare: the shared photo is better than none
      // The sample's photo for this product was dropped in photo QA and nothing spare is left: any trade photo beats a letter tile.
      if (!s) { const all = [...have].filter((x) => !/^(cover|space|team|people)/.test(x)); const pool = all.length ? all : [...have]; s = pool.find((x) => !usedPhoto.has(x)) ?? pool[usedPhoto.size % Math.max(1, pool.length)]; }
      if (s) usedPhoto.add(s);
      return s;
    };
    const products: ProductItem[] = sample.products.slice(0, 8).map((p) => ({
      name: p.name, images: (() => { const s = photoOf(p); return s ? [url(trade, s)] : []; })(), mrp: p.mrp ?? "", price: p.price, badge: p.badge ?? "", ...(p.category ? { category: p.category } : {}),
      desc: p.desc, features: p.features.slice(0, 4), specs: p.specs.slice(0, 3), ctaLabel: sample.productCta,
    }));
    const home: CardBlock[] = [
      { id: id(), kind: "highlights", title: "Why choose us", items: sample.highlights.slice(0, 6) },
      { id: id(), kind: "about", title: "About us", body: sample.about, ...(space && !cover?.includes(space) ? { imageUrl: url(trade, space) } : team ? { imageUrl: url(trade, team) } : {}) },
      { id: id(), kind: "offer", title: sample.offer.title, text: sample.offer.text, code: "", expires: "" },
      ...(booking ? [{ id: id(), kind: "appointment" as const, title: /book/i.test(sample.ctaLabel) ? sample.ctaLabel.replace(/ on WhatsApp/i, "") : "Book a visit", url: "", note: "Tell us the day and time that suits you — we confirm on WhatsApp." }] : []),
    ];
    const catalog: CardBlock[] = [
      // The page is already headed by its name: a block of the same name under it read as a doubled heading.
      { id: id(), kind: "product", title: sample.catalogTitle.trim().toLowerCase() === sample.catalogPage.trim().toLowerCase() ? `Our ${sample.catalogTitle.trim()}` : sample.catalogTitle, items: products },
      { id: id(), kind: "services", title: "Services", items: sample.services.slice(0, 6) },
    ];
    const galleryBlock: CardBlock[] = gallery.length ? [{ id: id(), kind: "gallery", title: "A look inside", images: gallery.map((s): GalleryImage => ({ url: url(trade, s), color: v.color ?? "#999999", label: cap(s) })) }] : [];
    const visit: CardBlock[] = [
      { id: id(), kind: "hours", title: "Timings", rows: sample.hours },
      { id: id(), kind: "location", title: "Address", address: sample.address },
      { id: id(), kind: "faq", title: "Good to know", items: sample.faq.slice(0, 6) },
      { id: id(), kind: "testimonials", title: "What customers say", items: sample.reviews.slice(0, 4) },
      { id: id(), kind: "contact", title: "Enquire" },
    ];
    const pages: CardPage[] = [
      { id: `${key}-p1`, slug: "home", label: "Home", blocks: home },
      { id: `${key}-p2`, slug: catalogSlug, label: sample.catalogPage, blocks: catalog },
      ...(galleryBlock.length ? [{ id: `${key}-p3`, slug: "gallery", label: "Gallery", blocks: galleryBlock }] : []),
      { id: `${key}-p4`, slug: "visit", label: "Visit", blocks: visit },
    ];
    // A "cover-split" design is the classic page's split hero (words on paper beside a 4:5 photo): the cinematic cover
    // only draws the full-bleed shapes, so the blueprint is dropped and `hero: "split"` set (review, 13 Oct 2026).
    const split = v.blueprint === "cinematic" && v.heroVariant === "cover-split";
    const style: SiteStyle = { ...(split ? { hero: "split" as const } : { blueprint: v.blueprint }), palette: v.palette, ...(v.color ? { color: v.color } : {}), font: v.font, radius: v.radius, motion: v.motion, pattern: "none", ...(v.body ? { body: v.body } : {}), ...(v.heroVariant && !split ? { heroVariant: v.heroVariant as SiteStyle["heroVariant"] } : {}), ...(v.layouts ? { layouts: v.layouts } : {}) };
    const bpName = split ? "Split" : BLUEPRINTS.find((b) => b.key === v.blueprint)?.name ?? v.blueprint;
    const color = v.color ?? cat?.accent ?? "#0e9e90";
    return {
      key, name: `${cat?.en ?? cap(trade)} — ${v.name}`, category: `${group} · ${bpName}`, description: v.description, emoji: v.emoji,
      // Released (owner, 13 Oct 2026) once the trade has its OWN five designs, market-reviewed and checked; a trade still on
      // its group's default designs stays a draft — review board and admin only — until its own are done.
      ...(ownList && ownList.length >= 5 && have.size >= 8 ? {} : { draft: true }),
      data: {
        name: sample.businessName, jobTitle: sample.jobTitle, company: sample.lead === "business" ? sample.businessName : "",
        tagline: sample.tagline, about: sample.about,
        avatarColor: color, themeColor: color, template: v.look, verified: false,
        ...(team ? { avatarUrl: url(trade, team), avatarShape: "square" as const } : {}),
        ...(cover ? { coverUrl: url(trade, cover) } : {}),
        botPersona: sample.botPersona, botKnowledge: sample.botKnowledge,
        lead: sample.lead, seo: { categoryKey: trade, category: cat?.en },
        links, pages,
        site: { enabled: true, style, templateKey: key, hero: { headline: v.headline, sub: v.sub, ...(cover ? { imageUrl: url(trade, cover) } : {}) } },
      },
    };
  });
}

export function allTradeTemplates(data: TradeTemplateData): CardTemplateDef[] {
  return Object.keys(data.samples).sort().flatMap((t) => tradeTemplates(t, data));
}
