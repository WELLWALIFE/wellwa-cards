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

/** What the booking card is called, by trade: "Book a visit" over a footwear shop's page, or "Book a consultation" over a garage's, read wrong
 *  (15 Oct 2026 sweep). A trade not listed keeps the title drawn from its button ("Book a table on WhatsApp" gives "Book a table"; else "Book a visit"). */
const BOOK_TITLE: Record<string, string> = {
  doctor: "Book a consultation", ayurveda: "Book a consultation", hospital: "Book a consultation", dentist: "Book a check-up",
  salon: "Book a slot", spa: "Book a slot", auto: "Book a service", cleaning: "Book a service", electrician: "Book a service",
  transport: "Book a vehicle", builder: "Book a site visit", interior: "Book a site visit", realestate: "Book a site visit",
  security: "Book a site survey", courier: "Book a pickup", optical: "Book an eye test", housing: "Book a facility",
  footwear: "Plan your visit", garments: "Plan your visit", textile: "Plan your visit", jewellery: "Plan your visit",
  hardware: "Plan your visit", mobile: "Plan your visit", furniture: "Plan your visit", printing: "Plan your visit",
};
/** The reviews' heading: patients, residents and guests are not "customers". */
const REVIEWS_TITLE: Record<string, string> = {
  doctor: "What patients say", dentist: "What patients say", ayurveda: "What patients say", hospital: "What patients say",
  housing: "What residents say", restaurant: "What guests say",
};
/** The "why us" heading of a residents' society: nobody chooses a society, they live in it. */
const WHY_TITLE: Record<string, string> = { housing: "What residents get" };

/** The hero's line under the headline is kept only when it is 90 characters or fewer (site-hero.ts aiSub); fourteen of the released designs
 *  carried 92 to 103 and so showed the trade's stock line instead of their own (15 Oct 2026 sweep). The same lines, shortened by hand. */
const SUB_FIX: Record<string, string> = {
  "builder-poster-build": "Our own masons, levels checked before every pour, and photos on WhatsApp the same evening.",
  "builder-studio-collage": "Visit our finished homes before you sign; what we hand over is what was drawn.",
  "housing-notice-board": "Accounts, meeting minutes and notices, open to every resident.",
  "medical-order-shop": "Send the prescription on WhatsApp; delivered within 3 km in about 2 hours.",
  "medical-trust-board": "Licensed pharmacy opposite Civil Hospital; insulin kept cold, open till 10 pm.",
  "medical-pharmacist-split": "Regular BP, sugar and thyroid medicines packed and ready before you run out.",
  "mobile-launch-dark": "Pre-book the latest Samsung, iPhone and OnePlus; no-cost EMI and old-phone exchange.",
  "mobile-repair-collage": "Screen and battery changed the same day; estimate on WhatsApp before we start.",
  "spa-price-menu": "Eight treatments with clear prices and minutes, plus packages and gift vouchers.",
  "textile-royal-silk": "Banarasi, Kanjivaram and bridal lehengas from the weavers, with the fabric told honestly.",
  "textile-festive-shop": "Daily cotton to bridal silk with written prices; photos on WhatsApp, courier home.",
  "textile-boutique-mark": "Handloom cotton, Chanderi and silk checked by hand; fall-pico done while you wait.",
  "textile-atelier-noir": "Bridal lehengas and pure silk shortlisted in one sitting; blouse stitched to measure.",
  "textile-market-board": "Lots from 20 pieces with GST bill and lot video; single sarees couriered anywhere.",
};

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
  // A design with no cover of its own takes the next one from this list; a photo a product tile already shows is the last choice,
  // or the hero and a tile were the same picture (auto "Editorial board", 15 Oct 2026 sweep).
  const ownPhotos = new Set(sample.products.slice(0, 8).map((p) => p.photo));
  const heroPool = covers.some((c) => !ownPhotos.has(c)) ? covers.filter((c) => !ownPhotos.has(c)) : covers;
  const galleryPool = byRole(sample, have, "space", "people", "detail", "product", "cover", "team");
  const team = byRole(sample, have, "team", "people")[0];
  const space = byRole(sample, have, "space", "cover")[0];
  const wa = { id: "l1", type: "whatsapp" as const, label: "WhatsApp", value: "+91" };
  const links = [wa, { id: "l2", type: "phone" as const, label: "Call", value: "+91" }, { id: "l3", type: "location" as const, label: "Find us", value: "" }, { id: "l4", type: "instagram" as const, label: "Instagram", value: "" }];
  const catalogSlug = /menu/i.test(sample.catalogPage) ? "menu" : /service|treatment/i.test(sample.catalogPage) ? "services" : /course|class|programme/i.test(sample.catalogPage) ? "courses" : /package|plan/i.test(sample.catalogPage) ? "packages" : "products";
  const booking = /book|appoint|consult|enquir|visit/i.test(sample.ctaLabel) || /^(Health|Services|Education)$/.test(group);
  // "Book on WhatsApp" gave a one-word heading, "Book", over the booking card (15 Oct 2026 sweep): a heading needs two words.
  const bookLabel = sample.ctaLabel.replace(/ on WhatsApp/i, "").trim();
  const bookTitle = BOOK_TITLE[trade] ?? (/book/i.test(sample.ctaLabel) && bookLabel.split(/\s+/).length > 1 ? bookLabel : "Book a visit");

  return designs.map((v, i) => {
    const key = `${trade}-${v.slug}`;
    let n = 0; const id = () => `${key}-${++n}`;
    const cover = v.cover && have.has(v.cover) ? v.cover : heroPool[i % Math.max(1, heroPool.length)];
    const wanted = (v.gallery ?? []).filter((s) => have.has(s));
    const gallery = [...wanted, ...galleryPool.filter((s) => !wanted.includes(s) && s !== cover)].slice(0, 6);
    const aboutPhoto = space && !cover?.includes(space) ? space : team;   // the photo of the About block, which sits on the same page as the first tiles
    // One photo per tile. Pass 1: every product keeps its own sample photo (the first to claim one wins). Pass 2: a product whose photo
    // was dropped in photo QA, or is already on an earlier tile, takes a photo of the trade no tile has yet — it used to take the
    // first one in the list, which was often the NEXT product's own, so two tiles of a row showed the same picture (15 Oct 2026 sweep).
    // A repeat is the last resort, and a letter tile only when the trade has no photo at all.
    const items = sample.products.slice(0, 8);
    const taken = new Set<string>();
    const picked = items.map((p) => { if (have.has(p.photo) && !taken.has(p.photo)) { taken.add(p.photo); return p.photo; } return undefined; });
    const all = [...have].filter((x) => !/^(cover|space|team|people)/.test(x));
    const pool = [...new Set([...byRole(sample, have, "product", "detail"), ...(all.length ? all : [...have])])];
    // Out of product photos (electrician: 4 product photos for 8 tiles), the trade's cover / space / people photos come next — a picture
    // of the work still beats the same picture twice; a repeat is the very last choice.
    const loose = [...have].filter((x) => !pool.includes(x) && x !== team);
    const apart = (x: string) => !taken.has(x) && x !== cover && x !== aboutPhoto;
    items.forEach((p, k) => {
      if (picked[k]) return;
      const s = pool.find(apart) ?? loose.find(apart) ?? pool.find((x) => !taken.has(x)) ?? (have.has(p.photo) ? p.photo : pool[k % Math.max(1, pool.length)]);
      if (s) taken.add(s);
      picked[k] = s;
    });
    const products: ProductItem[] = items.map((p, k) => ({
      name: p.name, images: picked[k] ? [url(trade, picked[k]!)] : [], mrp: p.mrp ?? "", price: p.price, badge: p.badge ?? "", ...(p.category ? { category: p.category } : {}),
      desc: p.desc, features: p.features.slice(0, 4), specs: p.specs.slice(0, 3), ctaLabel: sample.productCta,
    }));
    const home: CardBlock[] = [
      { id: id(), kind: "highlights", title: WHY_TITLE[trade] ?? "Why choose us", items: sample.highlights.slice(0, 6) },
      { id: id(), kind: "about", title: "About us", body: sample.about, ...(aboutPhoto ? { imageUrl: url(trade, aboutPhoto) } : {}) },
      { id: id(), kind: "offer", title: sample.offer.title, text: sample.offer.text, code: "", expires: "" },
      ...(booking ? [{ id: id(), kind: "appointment" as const, title: bookTitle, url: "", note: "Tell us the day and time that suits you — we confirm on WhatsApp." }] : []),
    ];
    const catalog: CardBlock[] = [
      // The page is already headed by its name: a block of the same name under it read as a doubled heading.
      { id: id(), kind: "product", title: sample.catalogTitle.trim().toLowerCase() === sample.catalogPage.trim().toLowerCase() ? `Our ${sample.catalogTitle.trim()}` : sample.catalogTitle, items: products },
      { id: id(), kind: "services", title: "Services", items: sample.services.slice(0, 6) },
    ];
    // A caption comes from the photo's slug; the role prefix ("product-hamper") is dropped so it reads "Hamper", not "Product Hamper".
    const galleryBlock: CardBlock[] = gallery.length ? [{ id: id(), kind: "gallery", title: "A look inside", images: gallery.map((s): GalleryImage => ({ url: url(trade, s), color: v.color ?? "#999999", label: cap(s.replace(/^(cover|space|people|team|product|detail)-/, "")) })) }] : [];
    const visit: CardBlock[] = [
      { id: id(), kind: "hours", title: "Timings", rows: sample.hours },
      { id: id(), kind: "location", title: "Address", address: sample.address },
      { id: id(), kind: "faq", title: "Good to know", items: sample.faq.slice(0, 6) },
      { id: id(), kind: "testimonials", title: REVIEWS_TITLE[trade] ?? "What customers say", items: sample.reviews.slice(0, 4) },
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
        site: { enabled: true, style, templateKey: key, hero: { headline: v.headline, sub: SUB_FIX[key] ?? v.sub, ...(cover ? { imageUrl: url(trade, cover) } : {}) } },
      },
    };
  });
}

export function allTradeTemplates(data: TradeTemplateData): CardTemplateDef[] {
  return Object.keys(data.samples).sort().flatMap((t) => tradeTemplates(t, data));
}
