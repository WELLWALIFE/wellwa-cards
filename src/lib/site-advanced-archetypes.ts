// The ADVANCED website's archetype library (owner, 15-16 Oct 2026: "layout har kisi ka bilkul different hona chahiye"): for
// every trade group, six or more complete compositions - a hero, the order the sections come in, the variant of each
// section, a palette, two faces, corners, density and motion. They are PLAIN DATA: the designer AI is shown the few that
// fit the business and adapts one (or crosses two); the no-AI fallback and the uniqueness pass below start from them.
//
// Written from the shape of premium small-business sites (a sweet shop that leads with the counter and the gift box, a
// clinic that leads with the doctor and the first-visit steps, a jeweller that leads with one hero piece and a quiet
// page, a builder that leads with the project ledger ...). A researcher's findings can be added later WITHOUT touching
// any code: append a line to the trade's list with a() - or a new trade group to GROUPS and its category keys to
// TRADE_GROUP. Nothing here can break the page: every id goes through validateSpec() before it is drawn, and
// checkArchetypes() (run by the engine's self-test) names any id the renderer does not know.
//
// Pure module (no React, no fetch, no DOM, no server-only): the engine, the preview and the tests import it.
import {
  ADV_FONTS, BODY_FONTS, DEFAULT_ORDER, DENSITIES, HERO_IDS, SANS_HEADINGS, SECTION_KEYS, SERIF_HEADINGS, SHAPES, VARIANT_IDS, rng, validateSpec, variantOf,
  type AdvancedSpec, type SectionKey,
} from "./site-advanced";
import { PALETTE_KEYS, SITE_PALETTES } from "./site-style";
import { tradeMood } from "./trade-moods";
import { isEmptyBlock } from "./site-home";
import type { Card, CardBlock } from "./types";

/** One complete composition. Strings, not the id unions, on purpose: a variant added to the renderer later can be used here
 *  the same day, and one that is not there yet is repaired by validateSpec instead of failing the build. */
export type Archetype = {
  id: string;
  /** What a human calls it ("The counter"). */
  name: string;
  /** One line: the idea of the page - who leads, how the visitor meets the business. Shown to the designer AI. */
  idea: string;
  hero: string;
  /** The sections that follow the hero, in order; the ones not named keep their default place (repairOrder). */
  lead: string[];
  /** Variant per section (not the hero). */
  sections: Record<string, string>;
  palette: { key: string; tone: "light" | "dark"; luxe?: boolean };
  fonts: { heading: string; body: string };
  shape: "sharp" | "soft" | "pill";
  density: "airy" | "compact";
  motion: "none" | "subtle" | "rich";
  /** Direction for the designer: photography, colour, voice. */
  notes: string;
};

/** The compact way to write one (so a researcher can add a line without learning the type):
 *   a("id", "Name", "the idea", "hero-id", "lead sections", "section:variant ...", "palette light|dark [luxe]", "Heading/Body", "shape density motion", "notes") */
function a(id: string, name: string, idea: string, hero: string, lead: string, secs: string, pal: string, fonts: string, style: string, notes: string): Archetype {
  const p = pal.split(/\s+/);
  const [heading, body] = fonts.split("/");
  const [shape, density, motion] = style.split(/\s+/);
  return {
    id, name, idea, hero, lead: lead.split(/\s+/).filter(Boolean),
    sections: Object.fromEntries(secs.split(/\s+/).filter(Boolean).map((x) => x.split(":") as [string, string])),
    palette: { key: p[0], tone: p[1] === "dark" ? "dark" : "light", ...(p.includes("luxe") ? { luxe: true } : {}) },
    fonts: { heading: heading.trim(), body: (body ?? "Inter").trim() },
    shape: shape as Archetype["shape"], density: density as Archetype["density"], motion: motion as Archetype["motion"], notes,
  };
}

/* ================= trade groups ================= */

export type TradeGroup = { key: string; label: string; /** What the trades in it have in common, for the designer. */ about: string };
export const GROUPS: TradeGroup[] = [
  { key: "sweets", label: "Sweets, bakery, caterers, tiffin", about: "appetite and freshness; the product photograph sells; festival and bulk orders; ordering on WhatsApp is the goal" },
  { key: "dining", label: "Restaurant, dhaba, cafe", about: "atmosphere, the menu, the dish; walk-in, reservation or delivery; the room matters as much as the plate" },
  { key: "stay", label: "Hotel, lodge, resort", about: "rooms and views first; trust (location, amenities); direct booking by call or WhatsApp" },
  { key: "jewellery", label: "Jewellery", about: "luxury and heritage; few pieces shown large; hallmark and trust; calm, never loud" },
  { key: "fashion", label: "Clothing, sarees, textile, tailor, boutique, footwear", about: "the collection is the page; seasons and occasions; fittings and custom work; lookbook feel" },
  { key: "decor", label: "Furniture, home decor, interior, architect", about: "projects and rooms; materials; a process from visit to handover; portfolio first" },
  { key: "shop", label: "General retail, electronics, optical, online store", about: "range, price and a person who helps; quick facts (timings, delivery, brands); catalogue and ask-on-WhatsApp" },
  { key: "grocery", label: "Kirana, grocery, supermarket", about: "fresh stock, fair prices, home delivery; the list sent on WhatsApp; a neighbourhood face people trust" },
  { key: "gifts", label: "Gifts, stationery, florists, hampers", about: "occasions and giving; a person to help choose; custom messages; orders by date on WhatsApp" },
  { key: "wholesale", label: "Wholesale, distributor, trading", about: "stock, rates and dispatch for buyers who know what they want; MOQ and credit as told; a quote on WhatsApp" },
  { key: "industry", label: "Manufacturer, factory, packaging", about: "capability, capacity and quality as told; buyers are procurement people; samples, catalogue, quote" },
  { key: "buildmat", label: "Hardware, paint, sanitary, tiles, building material", about: "materials seen and touched; contractors and homeowners; project photographs; site delivery and rates" },
  { key: "clinic", label: "Doctor, dentist, ayurveda, hospital, diagnostic lab", about: "trust and calm; who the doctor is; treatments; first-visit steps; timings and booking up front" },
  { key: "pharmacy", label: "Medical store, pharmacy, pharma", about: "genuine medicines, a pharmacist who checks, timings and home delivery; never medical advice; calm and fast" },
  { key: "fitness", label: "Gym, fitness, yoga", about: "energy and transformation; plans and batches; trainers; a trial or joining offer" },
  { key: "beauty", label: "Salon, spa, mehndi, makeup artist", about: "the look and the mood; services with prices; the artist; bookings; before-and-after style portfolio" },
  { key: "wellness", label: "Wellness products, water, network marketing", about: "product benefits without health claims; the people behind it; how to order; a community feel" },
  { key: "advisory", label: "CA, lawyer, insurance, finance", about: "authority and clarity; practice areas; how an engagement works; credentials only as told; a calm consultation call" },
  { key: "property", label: "Real estate, builder, construction", about: "projects and locations; trust and track record; site visits; enquiry is the goal" },
  { key: "homeservice", label: "Electrician, plumber, cleaning, security, courier, printing", about: "speed, price clarity and a person who picks up; service list; coverage area; call now" },
  { key: "motors", label: "Auto, garage, showroom, transport", about: "vehicles and rates; workshop trust; before-after jobs; call and map first" },
  { key: "creative", label: "Photography, events, decoration, DJ", about: "the portfolio is the page; packages; the team's eye; enquiry by date" },
  { key: "tech", label: "IT, software, digital marketing", about: "what is built and for whom; process; results (only as told); a modern, confident page" },
  { key: "travel", label: "Travel, tours, tickets", about: "destinations and packages; how it works; what is included; trust; enquiry by WhatsApp" },
  { key: "school", label: "School, dance and music classes", about: "campus and children; classes and approach; admissions steps; parents' trust; calm warmth" },
  { key: "playschool", label: "Play school, nursery, day care", about: "safety and warmth first; the day's rhythm; programmes by age; fees and timings said openly; mothers decide" },
  { key: "college", label: "College, institute, university", about: "programmes and outcomes; campus life; admission steps and dates; placements only as told" },
  { key: "coaching", label: "Coaching, tuition, skill centre, teacher", about: "results and method (only as told); batches; faculty; enquiry or demo class" },
  { key: "farm", label: "Agriculture, dairy, manufacturer", about: "the product and where it comes from; capacity and quality (only as told); dealers and bulk enquiry" },
  { key: "community", label: "Temple, NGO, samaj, club, union, housing society", about: "purpose and people; events and notices; how to join or donate; warmth over polish" },
  { key: "leader", label: "Political leader, MLA, councillor, sarpanch", about: "the person and the work; the area; public contact; a plain, respectful, confident page" },
  { key: "astro", label: "Astrology, vastu, pandit", about: "calm, traditional, trust; services and how to consult; the person" },
  { key: "personal", label: "Personal brand, creator, professional, sales agent", about: "the person is the brand; what they do; a portrait; how to reach" },
  { key: "general", label: "Any other business", about: "a clear story, the offering, proof and a way to reach out" },
];

/** poster-categories.ts key -> group. A key not here (a new category) lands in "general" until it is added. */
export const TRADE_GROUP: Record<string, string> = {
  sweets: "sweets", catering: "sweets", tiffin: "sweets",
  restaurant: "dining", cafe: "dining", hotel: "stay", jewellery: "jewellery",
  garments: "fashion", textile: "fashion", tailor: "fashion",
  furniture: "decor", interior: "decor",
  kirana: "grocery", "grocery-online": "shop", gift: "gifts", hardware: "buildmat", footwear: "fashion", mobile: "shop", optical: "shop", wholesale: "wholesale", distributor: "wholesale",
  doctor: "clinic", dentist: "clinic", ayurveda: "clinic", hospital: "clinic", medical: "pharmacy", pharma: "pharmacy",
  gym: "fitness", salon: "beauty", spa: "beauty", mehndi: "beauty",
  water: "wellness", wellness: "wellness", mlm: "wellness",
  ca: "advisory", lawyer: "advisory", insurance: "advisory", finance: "advisory",
  realestate: "property", builder: "property",
  electrician: "homeservice", cleaning: "homeservice", security: "homeservice", courier: "homeservice", printing: "homeservice",
  auto: "motors", transport: "motors", photography: "creative", event: "creative", it: "tech", travel: "travel",
  school: "school", playschool: "playschool", college: "college", dance: "school",
  coaching: "coaching", computer: "coaching", teacher: "coaching", student: "coaching",
  agri: "farm", dairy: "farm", manufacturer: "industry",
  temple: "community", ngo: "community", samaj: "community", club: "community", union: "community", housing: "community",
  political: "leader", mla: "leader", astro: "astro",
  personal: "personal", employee: "personal", govt: "personal", army: "personal", influencer: "personal", sales: "personal", agent: "personal",
  other: "general",
};

/* ================= the library ================= */

const LIBRARY: Record<string, Archetype[]> = {
  sweets: [
    a("sweets-counter", "The mithai counter", "the glass counter first: big product photography, the festival box a tap away", "full-bleed", "services gallery about proof",
      "trust:ticker services:magazine gallery:masonry about:overlap-card proof:cards process:icon-cards", "saffron light", "Fraunces/DM Sans", "soft airy rich", "warm, appetite-first; macro shots of sweets on brass and banana leaf; saffron and cream; one big order button"),
    a("sweets-heritage", "Since the family shop", "a heritage masthead: the family name as a title, the story and the years before the products", "masthead", "about trust services proof",
      "about:year-timeline trust:counters services:price-list proof:testimonial-carousel gallery:filmstrip", "cocoa light", "Playfair Display/Inter", "sharp airy subtle", "old-shop dignity; cocoa and cream; small-caps; only the years and numbers the owner gave"),
    a("sweets-gift-boxes", "The gift-box studio", "festival hampers as products: boxes, sizes, a simple way to order for family and offices", "stacked-poster", "services gallery process about",
      "services:feature-cards gallery:bento process:icon-cards about:story-columns proof:review-wall", "rose dark", "DM Serif Display/Manrope", "pill airy rich", "rich, giftable; deep rose ink field with warm gold accents; boxes photographed from above"),
    a("sweets-printed-menu", "The printed menu", "a menu card: names, dotted leaders, prices; fast to read, easy to order from", "editorial-marquee", "services about gallery visit",
      "services:menu-leaders about:story-columns gallery:lightbox-grid trust:strip proof:cards", "gold light", "Newsreader/DM Sans", "sharp compact subtle", "typographic, restrained; cream paper and a gold rule; the price list is the hero"),
    a("sweets-bulk-desk", "The bulk-order desk", "for caterers and weddings: events served, how an order runs, a quote on WhatsApp", "split-frame", "trust process services proof",
      "trust:icon-row process:numbered-list services:category-tabs proof:results-band gallery:mosaic", "crimson light", "Bricolage Grotesque/Inter", "soft compact subtle", "organised, reliable; clear steps from enquiry to delivery; show past events as photographs"),
    a("sweets-home-kitchen", "The home-kitchen diary", "a personal page: the cook, the day's menu, the weekly rhythm", "centered-minimal", "about services process gallery",
      "about:owner-card services:scroller process:steps gallery:filmstrip proof:testimonial-carousel", "emerald light", "Lora/Mukta", "soft airy subtle", "homely and honest; natural light, steel dabbas; green and cream; first-person voice"),
    a("sweets-festival-rush", "The festival rush", "a bright seasonal page: what is on for the festival, the cut-off date, the order button", "mosaic", "trust services proof gallery",
      "trust:split-cards services:grid proof:star-summary gallery:album-tabs about:photo-collage", "saffron dark", "Bricolage Grotesque/DM Sans", "pill compact rich", "festive energy on an ink field; saffron, marigold; urgency without hype"),
  ],
  dining: [
    a("dining-night-room", "The night room", "the room after dark: a cinematic hero, then the dishes, then the reservation", "full-bleed", "gallery services about proof",
      "gallery:filmstrip services:menu-leaders about:pull-quote proof:cards trust:ticker", "crimson dark", "Playfair Display/DM Sans", "sharp airy rich", "moody, warm light, candle and steam; deep red ink field; the menu as an elegant list"),
    a("dining-chai-corner", "The chai corner", "a small, friendly cafe: the board, the corner, the regulars", "centered-minimal", "about services gallery visit",
      "about:owner-card services:grid gallery:masonry trust:strip proof:testimonial-carousel", "cocoa light", "Fraunces/DM Sans", "soft airy subtle", "cosy, hand-lettered feel; cream and brown; photographs of cups, hands and corners"),
    a("dining-family-table", "The family table", "big plates, big portions, big families: the dishes first, then the reviews", "split-frame", "services proof gallery about",
      "services:feature-cards proof:review-wall gallery:mosaic about:story-columns trust:icon-row", "saffron light", "Bricolage Grotesque/Inter", "soft compact rich", "loud-friendly; saffron and cream; full-table photographs; a delivery and call row"),
    a("dining-chef-led", "The chef's page", "the chef or the family recipe as the voice; a short, edited menu", "editorial-marquee", "about services gallery proof",
      "about:editorial-split services:magazine gallery:bento proof:clients-strip process:numbered-list", "ivory light", "Instrument Serif/Inter", "sharp airy subtle", "editorial and quiet; ivory paper, ink type; plated close-ups; a signature dish line"),
    a("dining-order-first", "The order-first dhaba", "delivery and takeaway: categories, prices, call and WhatsApp within a thumb's reach", "glass-card", "trust services visit proof",
      "trust:icon-row services:category-tabs process:steps proof:star-summary gallery:lightbox-grid", "crimson light", "Space Grotesk/Inter", "pill compact rich", "fast and bold; red and white; menu tabs; a visible timings and delivery area"),
    a("dining-reservation", "The reservation card", "a place worth planning for: the visit details come early, then the story", "mosaic", "visit trust services gallery",
      "trust:split-cards services:scroller gallery:album-tabs about:photo-collage proof:cards", "emerald dark", "DM Serif Display/Manrope", "soft airy rich", "evening green on ink; brass details; a clear table-booking call"),
  ],
  stay: [
    a("stay-view-first", "The view first", "a full-screen view of the property, rooms right under it", "full-bleed", "services gallery about proof",
      "services:feature-cards gallery:filmstrip about:overlap-card trust:icon-row proof:testimonial-carousel", "ivory light luxe", "Playfair Display/Inter", "sharp airy rich", "luxe hospitality; ivory and espresso with a gold line; one great exterior and one great room"),
    a("stay-room-ledger", "The room ledger", "a clear tariff of rooms with photographs, amenities as icons, book by call", "split-frame", "trust services gallery visit",
      "trust:icon-row services:tiers gallery:bento proof:cards process:steps", "ocean light", "Manrope/Inter", "soft compact subtle", "clean, trustworthy; sea blue and white; room types as comparison columns"),
    a("stay-heritage-haveli", "The haveli story", "a place with a past: story, courtyard, rooms, stay notes", "masthead", "about gallery services proof",
      "about:year-timeline gallery:masonry services:price-list proof:review-wall trust:strip", "gold dark luxe", "Newsreader/DM Sans", "sharp airy subtle", "heritage warmth; gold on dark; archival feel; only the history the owner told"),
    a("stay-wedding-lawn", "The celebration venue", "banquet and lawn: capacity (as told), events hosted, enquiry for a date", "stacked-poster", "gallery services process proof",
      "gallery:mosaic services:magazine process:timeline-h proof:results-band about:story-columns", "royal dark", "DM Serif Display/DM Sans", "soft airy rich", "celebratory; deep violet and gold; wide shots of the lawn at dusk"),
    a("stay-pilgrim-lodge", "The pilgrim's lodge", "a simple dharamshala/lodge: where it is, what is near, clear rates", "diagonal", "visit trust services faq",
      "trust:strip services:price-list gallery:lightbox-grid proof:cards process:icon-cards", "teal light", "Lora/Mukta", "soft compact subtle", "plain and reassuring; distances and landmarks; clear check-in notes"),
    a("stay-boutique-edit", "The boutique edit", "four rooms, each with its own character, edited like a magazine", "editorial-marquee", "about services gallery proof",
      "about:numbers-led services:magazine gallery:bento proof:clients-strip trust:ticker", "noir dark luxe", "Instrument Serif/Inter", "sharp airy rich", "black and gold; large crisp room photographs; short poetic captions"),
  ],
  jewellery: [
    a("jewel-one-piece", "The single piece", "one hero piece, a quiet page, a collection that opens like a jewellery box", "centered-minimal", "services about gallery proof",
      "services:scroller about:pull-quote gallery:filmstrip trust:strip proof:testimonial-carousel", "ivory light luxe", "Instrument Serif/Inter", "sharp airy subtle", "ivory and espresso, a gold hairline; macro photographs on velvet; never a discount banner"),
    a("jewel-heritage-house", "The heritage house", "generations of trust: the family name, hallmark, the story, then the collection", "masthead", "about trust services proof",
      "about:year-timeline trust:counters services:magazine proof:cards gallery:mosaic", "gold dark luxe", "Playfair Display/DM Sans", "sharp airy subtle", "deep gold on dark; archival; hallmark and purity as told"),
    a("jewel-bridal-suite", "The bridal suite", "bridal sets as the lead, the occasion as the structure: engagement, wedding, gifting", "full-bleed", "services gallery process about",
      "services:category-tabs gallery:bento process:icon-cards about:overlap-card proof:review-wall", "rose dark luxe", "DM Serif Display/Manrope", "soft airy rich", "rich rose and gold; hands, bangles and red silk; a consultation call"),
    a("jewel-lookbook", "The lookbook", "a fashion lookbook: large masonry of pieces, captions, appointment", "editorial-marquee", "gallery services about proof",
      "gallery:masonry services:feature-cards about:editorial-split proof:clients-strip trust:ticker", "pearl light", "Newsreader/Inter", "sharp airy subtle", "cool pearl and navy; editorial crops; plenty of space"),
    a("jewel-craft-atelier", "The craft atelier", "made-to-order: the karigar, the process, the pieces", "split-frame", "about process services gallery",
      "about:owner-card process:timeline-h services:grid gallery:filmstrip proof:cards", "cocoa dark luxe", "Fraunces/DM Sans", "soft airy subtle", "workshop warmth; bench, wax, gold wire; the maker's hands"),
    a("jewel-everyday", "Everyday gold", "light daily wear, gifting and gold-plan clarity (as told), friendly", "mosaic", "trust services gallery proof",
      "trust:split-cards services:price-list gallery:album-tabs proof:star-summary about:story-columns", "gold light", "Lora/Inter", "soft compact subtle", "friendly gold; clear categories (rings, chains, earrings); price-by-weight language only if the owner gives it"),
  ],
  fashion: [
    a("fashion-lookbook", "The season lookbook", "the collection as full-bleed looks, scrolled like a magazine", "full-bleed", "gallery services about proof",
      "gallery:masonry services:magazine about:pull-quote proof:review-wall trust:ticker", "rose light", "Playfair Display/DM Sans", "sharp airy rich", "editorial fashion photography; rose and ink; captions in small caps"),
    a("fashion-saree-house", "The saree house", "drapes, weaves and occasions; categories by fabric and wedding/festive/daily", "stacked-poster", "services gallery about proof",
      "services:category-tabs gallery:filmstrip about:story-columns proof:testimonial-carousel trust:strip", "crimson dark", "DM Serif Display/Mukta", "soft airy rich", "jewel tones on dark; fabric close-ups; silk and zari"),
    a("fashion-tailor-atelier", "The tailor's atelier", "measure, cut, fit, deliver: the process is the proof", "split-frame", "process about services gallery",
      "process:timeline-h about:owner-card services:price-list gallery:bento proof:cards trust:icon-row", "steel light", "Newsreader/Inter", "sharp compact subtle", "refined and exact; charcoal and cream; patterns, chalk, tape"),
    a("fashion-boutique-edit", "The boutique edit", "a curated rail of pieces, an owner with a point of view", "editorial-marquee", "services about gallery proof",
      "services:scroller about:editorial-split gallery:mosaic proof:clients-strip process:icon-cards", "ivory light", "Instrument Serif/Manrope", "soft airy subtle", "airy and personal; ivory, black type, one accent colour from the stock"),
    a("fashion-wholesale-sheet", "The wholesale sheet", "for trade buyers: fabrics, minimums as told, catalogues, easy bulk enquiry", "mosaic", "trust services process proof",
      "trust:split-cards services:grid process:numbered-list proof:results-band gallery:lightbox-grid", "ocean light", "Space Grotesk/Inter", "soft compact subtle", "brisk and organised; blue and white; swatches and stacks; a catalogue request button"),
    a("fashion-festive-edit", "The festive edit", "occasion-led: Diwali, wedding, Eid - each a lane with its own pieces", "glass-card", "services gallery proof about",
      "services:feature-cards gallery:album-tabs proof:cards about:photo-collage trust:icon-row", "saffron dark", "Fraunces/Manrope", "pill airy rich", "festive and glowing; saffron and magenta accents; bright garments against the dark"),
  ],
  decor: [
    a("decor-portfolio-wall", "The portfolio wall", "completed rooms, large; a short note under each", "full-bleed", "gallery about process proof",
      "gallery:masonry about:editorial-split process:timeline-h proof:cards services:magazine", "noir light", "Instrument Serif/Inter", "sharp airy subtle", "gallery-white and black; wide, honest photographs; materials named"),
    a("decor-showroom-floor", "The showroom floor", "furniture ranges as a catalogue: categories, finishes, order or visit", "split-frame", "services gallery trust visit",
      "services:category-tabs gallery:bento trust:icon-row proof:star-summary about:overlap-card", "cocoa light", "Fraunces/DM Sans", "soft airy subtle", "warm wood and linen; room-set photographs; a showroom address up front"),
    a("decor-design-studio", "The design studio", "a studio with a method: brief, concept, build, handover", "editorial-marquee", "about process gallery services",
      "about:numbers-led process:numbered-list gallery:filmstrip services:price-list proof:testimonial-carousel", "steel light", "Space Grotesk/Manrope", "sharp compact subtle", "architectural and exact; grey, white, a single accent; plans and details"),
    a("decor-before-after", "The before and after", "transformations as the proof: each project a story", "diagonal", "gallery proof process services",
      "gallery:album-tabs proof:review-wall process:steps services:feature-cards about:story-columns", "teal light", "Bricolage Grotesque/Inter", "soft compact rich", "confident, practical; before/after pairs; budgets only as told"),
    a("decor-materials-library", "The materials library", "finishes, fabrics and woods like swatches; the studio's palette", "mosaic", "services about gallery process",
      "services:magazine about:photo-collage gallery:mosaic process:icon-cards trust:strip", "emerald light", "Lora/DM Sans", "soft airy subtle", "tactile; close-ups of grain and weave; muted greens and sand"),
    a("decor-luxe-residence", "The luxe residence", "high-end homes: few projects, long captions, an appointment", "centered-minimal", "about gallery services proof",
      "about:pull-quote gallery:bento services:tiers proof:clients-strip trust:counters", "gold dark luxe", "Playfair Display/Inter", "sharp airy rich", "dark and gold; evening interiors; restrained copy"),
  ],
  shop: [
    a("shop-aisle-catalogue", "The aisle catalogue", "everything in stock, grouped; quick facts on top, order on WhatsApp", "split-frame", "trust services gallery visit",
      "trust:icon-row services:category-tabs gallery:lightbox-grid proof:star-summary process:steps", "teal light", "Manrope/Inter", "soft compact subtle", "bright and practical; clean product shots on white; delivery and timings on the first screen"),
    a("shop-neighbourhood-store", "The neighbourhood store", "a trusted local shop: the owner, the area served, the regulars", "centered-minimal", "about trust services proof",
      "about:owner-card trust:strip services:grid proof:testimonial-carousel gallery:masonry", "emerald light", "Lora/Mukta", "soft airy subtle", "warm and personal; green and cream; the shopfront photograph"),
    a("shop-brand-wall", "The brand wall", "authorised brands as the proof; the range by brand", "mosaic", "trust services proof gallery",
      "trust:counters services:magazine proof:clients-strip gallery:bento about:story-columns", "ocean dark", "Space Grotesk/DM Sans", "pill compact rich", "confident trade; dark blue; logo ribbon only of brands the owner sells"),
    a("shop-price-board", "The price board", "a plain price list for people who know what they want", "editorial-marquee", "services trust visit about",
      "services:price-list trust:ticker about:story-columns proof:cards gallery:filmstrip", "steel light", "DM Sans/Inter", "sharp compact subtle", "no-nonsense; grey and one signal colour; the list is the star"),
    a("shop-new-arrivals", "The new arrivals shelf", "a shelf that scrolls: what is new, what is popular", "glass-card", "services gallery trust proof",
      "services:scroller gallery:mosaic trust:split-cards proof:review-wall process:icon-cards", "royal light", "Bricolage Grotesque/Manrope", "pill airy rich", "fresh and young; violet and white; floating product cutouts"),
    a("shop-wholesale-godown", "The wholesale godown", "bulk, rates on request, how to order, dispatch", "diagonal", "trust process services proof",
      "trust:split-cards process:numbered-list services:tiers proof:results-band gallery:filmstrip", "saffron light", "Bricolage Grotesque/Inter", "soft compact subtle", "industrial warmth; stacks, cartons, trucks; a catalogue and rate-list request"),
  ],
  clinic: [
    a("clinic-doctor-first", "The doctor first", "the doctor's portrait and promise, then treatments, then booking", "split-frame", "about services process proof",
      "about:owner-card services:feature-cards process:icon-cards proof:cards trust:icon-row", "teal light", "Newsreader/Inter", "soft airy subtle", "calm and clear; teal and white; a real portrait; credentials only as told"),
    a("clinic-first-visit", "The first visit", "a patient's journey: what happens when you walk in, step by step", "centered-minimal", "process services about visit",
      "process:timeline-h services:grid about:story-columns trust:strip proof:testimonial-carousel", "ocean light", "Manrope/Inter", "soft airy subtle", "reassuring and plain; soft blue; no stock-smile excess"),
    a("clinic-treatment-index", "The treatment index", "an A-to-Z of treatments for people who search by problem", "editorial-marquee", "services trust about proof",
      "services:category-tabs trust:icon-row about:editorial-split proof:star-summary process:steps", "emerald light", "DM Sans/Inter", "sharp compact subtle", "clinical and organised; green and white; no outcome claims"),
    a("clinic-family-care", "The family doctor", "warm, local, trusted by generations - for all ages", "mosaic", "trust about services proof",
      "trust:split-cards about:overlap-card services:scroller proof:review-wall gallery:bento", "rose light", "Lora/Mukta", "pill airy subtle", "gentle and human; soft rose and cream; clinic interior photographs"),
    a("clinic-dental-studio", "The dental studio", "bright, modern, smile-led; the equipment and the comfort", "full-bleed", "services gallery proof process",
      "services:feature-cards gallery:filmstrip proof:testimonial-carousel process:numbered-list trust:ticker", "pearl light", "Bricolage Grotesque/DM Sans", "soft airy rich", "fresh and bright; pearl and navy; close-ups of the clinic, not of teeth"),
    a("clinic-ayurveda-ritual", "The ayurveda ritual", "tradition and calm: the vaidya, the herbs, the routine", "stacked-poster", "about services process gallery",
      "about:pull-quote services:price-list process:icon-cards gallery:masonry proof:cards", "emerald dark", "Playfair Display/Mukta", "soft airy subtle", "deep green on ink; herbs, oil, brass; no cure claims"),
  ],
  fitness: [
    a("fit-transform", "The transformation", "energy first: a loud hero, plans, trainers, the join button", "full-bleed", "services proof gallery process",
      "services:tiers proof:results-band gallery:masonry process:steps trust:counters", "crimson dark", "Bricolage Grotesque/Inter", "sharp compact rich", "high contrast; red on black; sweat, chalk, iron; no body-shaming"),
    a("fit-yoga-studio", "The yoga studio", "calm, daylight, breath: classes and the teacher", "centered-minimal", "about services gallery proof",
      "about:owner-card services:scroller gallery:filmstrip proof:testimonial-carousel process:icon-cards", "emerald light", "Newsreader/Manrope", "soft airy subtle", "sage and cream; morning light; slow motion"),
    a("fit-coach-led", "The coach", "the trainer is the brand: story, method, packages", "split-frame", "about process services proof",
      "about:editorial-split process:numbered-list services:feature-cards proof:review-wall trust:strip", "steel dark", "Space Grotesk/DM Sans", "sharp compact subtle", "personal and direct; slate and lime-free accent; portrait-led"),
    a("fit-batch-timetable", "The batch timetable", "when and where: batches, fees as told, a trial class", "editorial-marquee", "trust services visit proof",
      "trust:ticker services:price-list gallery:bento proof:cards process:timeline-h", "ocean dark", "Manrope/Inter", "pill compact rich", "practical; deep blue; a timetable feel"),
    a("fit-community-box", "The community box", "a crew, not a gym: events, members, the vibe", "mosaic", "gallery proof about services",
      "gallery:mosaic proof:review-wall about:photo-collage services:grid trust:split-cards", "saffron dark", "Bricolage Grotesque/DM Sans", "pill airy rich", "warm energy; orange on charcoal; group photographs"),
    a("fit-women-wellness", "The women's studio", "a safe, friendly studio: classes, timings, the trainers", "glass-card", "about services proof gallery",
      "about:overlap-card services:category-tabs proof:cards gallery:lightbox-grid process:icon-cards", "rose light", "Fraunces/DM Sans", "pill airy subtle", "soft and welcoming; rose and cream; faces of members only with permission"),
  ],
  beauty: [
    a("beauty-mood-board", "The mood board", "the look first: a collage of work, then the menu of services", "mosaic", "gallery services about proof",
      "gallery:bento services:price-list about:photo-collage proof:review-wall trust:ticker", "rose light", "Fraunces/DM Sans", "pill airy rich", "soft blush and cream; close-ups of finished looks; hand-written feel"),
    a("beauty-service-menu", "The service menu", "a clean printed menu with prices; easy to book", "editorial-marquee", "services about gallery visit",
      "services:menu-leaders about:story-columns gallery:filmstrip proof:cards process:steps", "ivory light luxe", "Playfair Display/Inter", "sharp airy subtle", "ivory and gold hairline; restraint; a calm booking button"),
    a("beauty-artist-portrait", "The artist", "the makeup/mehndi artist as the draw: portrait, story, signature style", "split-frame", "about gallery services proof",
      "about:owner-card gallery:masonry services:feature-cards proof:testimonial-carousel process:icon-cards", "royal light", "DM Serif Display/Manrope", "soft airy rich", "plum and cream; detail shots of hands and patterns"),
    a("beauty-spa-retreat", "The spa retreat", "stillness: treatments, rooms, the ritual", "full-bleed", "about services gallery proof",
      "about:pull-quote services:tiers gallery:filmstrip proof:cards process:timeline-h", "teal dark", "Newsreader/DM Sans", "soft airy subtle", "deep teal on ink; stones, steam, candle; slow fades"),
    a("beauty-bridal-diary", "The bridal diary", "bridal packages and trial; a diary of real weddings", "stacked-poster", "services gallery process proof",
      "services:feature-cards gallery:masonry process:numbered-list proof:review-wall about:overlap-card", "crimson light", "Playfair Display/Mukta", "soft airy rich", "red, gold and cream; brides only with permission; booking by date"),
    a("beauty-quick-salon", "The quick salon", "walk-in salon: services with prices, timings, offers, a map", "glass-card", "services trust visit proof",
      "services:category-tabs trust:icon-row proof:star-summary gallery:lightbox-grid process:steps", "royal dark", "Bricolage Grotesque/Inter", "pill compact rich", "lively; violet and pink; open-now and walk-ins welcome"),
  ],
  wellness: [
    a("well-product-lab", "The product lab", "each product with what it is and how to use it - no cure claims", "split-frame", "services about process proof",
      "services:feature-cards about:story-columns process:icon-cards proof:cards trust:icon-row", "teal light", "Manrope/Inter", "soft airy subtle", "clean and clinical-friendly; white and teal; labels shown honestly"),
    a("well-daily-ritual", "The daily ritual", "a routine: morning, midday, night - the products slot into it", "centered-minimal", "process services about gallery",
      "process:timeline-h services:scroller about:pull-quote gallery:filmstrip proof:testimonial-carousel", "emerald light", "Lora/DM Sans", "soft airy subtle", "calm green; daylight; glasses of water, bowls, hands"),
    a("well-founder-story", "The founder", "why this was started; the person behind the brand", "masthead", "about services proof process",
      "about:owner-card services:magazine proof:review-wall process:numbered-list trust:strip", "cocoa light", "Fraunces/Inter", "soft airy subtle", "personal and honest; earth tones; first-person"),
    a("well-community-circle", "The community circle", "a network of people: stories, meetups, how to join (no income claims)", "mosaic", "proof about gallery services",
      "proof:star-summary about:photo-collage gallery:mosaic services:grid trust:split-cards", "saffron light", "Bricolage Grotesque/Manrope", "pill compact rich", "warm and social; saffron; group photographs"),
    a("well-water-science", "The water page", "purifiers and ionizers explained simply: what it does, models, installation, service", "full-bleed", "services process trust faq",
      "services:tiers process:steps trust:counters proof:cards gallery:bento", "ocean dark", "Space Grotesk/Inter", "sharp compact subtle", "deep blue; droplets and glass; specifications only as listed by the owner"),
    a("well-order-by-need", "Order by need", "choose by need (sleep, energy, digestion) and order on WhatsApp", "glass-card", "services trust proof about",
      "services:category-tabs trust:icon-row proof:review-wall about:overlap-card process:icon-cards", "rose light", "DM Sans/Inter", "pill airy subtle", "gentle; rose and cream; benefit language without medical claims"),
  ],
  advisory: [
    a("adv-chambers", "The chambers", "authority and calm: practice areas, the advocate, a consultation call", "split-frame", "about services process proof",
      "about:editorial-split services:price-list process:numbered-list proof:cards trust:strip", "midnight dark", "Playfair Display/Inter", "sharp airy subtle", "navy and brass; a formal portrait; no result promises"),
    a("adv-ledger", "The ledger", "numbers and order: services by season (GST, ITR, audit), documents list, deadlines", "editorial-marquee", "services process trust faq",
      "services:category-tabs process:timeline-h trust:counters proof:testimonial-carousel about:story-columns", "steel light", "Space Grotesk/DM Sans", "sharp compact subtle", "grey, white, a green tick; tabular; a checklist feel"),
    a("adv-plain-words", "Plain words", "complex made simple: a friendly explainer-led page", "centered-minimal", "about services faq proof",
      "about:pull-quote services:grid proof:review-wall process:steps trust:ticker", "ocean light", "Newsreader/Manrope", "soft airy subtle", "approachable; light blue; short sentences; FAQs prominent"),
    a("adv-practice-areas", "The practice areas", "a magazine of what is handled, each with when to call", "mosaic", "services trust about proof",
      "services:magazine trust:split-cards about:overlap-card proof:cards process:icon-cards", "emerald dark", "DM Serif Display/Inter", "soft compact subtle", "deep green; considered; icons not photographs"),
    a("adv-family-planner", "The family planner", "insurance and finance as peace of mind: the plan, the review, the claim help", "full-bleed", "about process services proof",
      "about:owner-card process:icon-cards services:tiers proof:testimonial-carousel trust:icon-row", "teal light", "Lora/Mukta", "soft airy subtle", "warm and protective; teal and cream; family imagery used sparingly"),
    a("adv-credentials-first", "Credentials first", "qualifications, registrations and the firm's standing up front (only as told)", "masthead", "trust about services process",
      "trust:counters about:numbers-led services:price-list process:numbered-list proof:clients-strip", "noir light", "Instrument Serif/Inter", "sharp airy subtle", "monochrome; quiet; a single call-to-consult"),
  ],
  property: [
    a("prop-project-showcase", "The project showcase", "each project as a feature: location, status, enquiry", "full-bleed", "services gallery about proof",
      "services:feature-cards gallery:filmstrip about:overlap-card proof:cards trust:counters", "gold dark luxe", "Playfair Display/Inter", "sharp airy rich", "aspirational; dusk renders and real site photographs; no price promises"),
    a("prop-site-visit", "The site visit", "book a visit: how it works, locations, timings", "split-frame", "process services visit proof",
      "process:timeline-h services:category-tabs trust:icon-row proof:testimonial-carousel gallery:bento", "teal light", "Manrope/Inter", "soft compact subtle", "bright and helpful; teal; map-led"),
    a("prop-builder-ledger", "The builder's ledger", "years, projects, delivered units - only the numbers the owner gives", "editorial-marquee", "trust about services gallery",
      "trust:counters about:numbers-led services:magazine gallery:masonry proof:results-band", "steel dark", "Space Grotesk/DM Sans", "sharp compact subtle", "solid and sober; steel and orange; sites and cranes"),
    a("prop-neighbourhood-guide", "The neighbourhood guide", "the area as the product: what is near, who lives there", "masthead", "about services gallery visit",
      "about:editorial-split services:grid gallery:album-tabs trust:strip proof:cards", "emerald light", "Newsreader/Inter", "soft airy subtle", "editorial; green; street-level photographs"),
    a("prop-dealer-desk", "The dealer's desk", "properties listed with filters; a person to call", "glass-card", "services trust proof visit",
      "services:price-list trust:icon-row proof:star-summary process:steps gallery:lightbox-grid", "ocean light", "Bricolage Grotesque/Inter", "pill compact rich", "quick; blue; call and WhatsApp for each listing"),
    a("prop-interior-handover", "From plan to keys", "construction as a story: plan, build, finish, handover", "diagonal", "process gallery about proof",
      "process:numbered-list gallery:mosaic about:story-columns proof:review-wall services:tiers", "saffron light", "Bricolage Grotesque/Inter", "soft compact subtle", "progress photographs; saffron and charcoal; honest timelines"),
  ],
  homeservice: [
    a("svc-call-now", "Call now", "the phone is the product: what we fix, how fast, one big call button", "glass-card", "trust services process proof",
      "trust:icon-row services:grid process:steps proof:star-summary gallery:lightbox-grid", "steel light", "Space Grotesk/Inter", "pill compact rich", "urgent and calm; blue-grey and signal yellow-free orange; coverage area visible"),
    a("svc-price-clarity", "Price clarity", "a price list so nobody is surprised", "split-frame", "services trust process faq",
      "services:price-list trust:strip process:numbered-list proof:cards about:story-columns", "emerald light", "Manrope/Inter", "soft compact subtle", "honest and plain; green; rates only as told"),
    a("svc-visit-steps", "Booked, arrived, done", "from booking to cleanup: the visit step by step", "centered-minimal", "process services proof visit",
      "process:timeline-h services:category-tabs proof:testimonial-carousel trust:ticker gallery:filmstrip", "teal light", "DM Sans/Inter", "soft airy subtle", "reassuring; teal; uniform and tools photographed"),
    a("svc-work-gallery", "The work gallery", "finished jobs as proof, grouped by service", "mosaic", "gallery services proof process",
      "gallery:album-tabs services:scroller proof:review-wall process:icon-cards trust:counters", "ocean dark", "Bricolage Grotesque/DM Sans", "sharp compact rich", "dark and bold; before and after; job locations by area only"),
    a("svc-team-id", "The verified team", "trust for people letting someone into the house or office: verified staff, ID, protocols (as told)", "editorial-marquee", "trust about services faq",
      "trust:split-cards about:owner-card services:feature-cards proof:clients-strip process:steps", "royal light", "Newsreader/Manrope", "soft airy subtle", "sober and safe; violet-navy; faces only with permission"),
    a("svc-bulk-orders", "Bulk and business", "for offices, societies and print jobs: quote, turnaround, repeat orders", "diagonal", "services process trust proof",
      "services:tiers process:numbered-list trust:counters proof:results-band gallery:bento", "crimson light", "Space Grotesk/Inter", "sharp compact subtle", "efficient; red and grey; samples and turnaround"),
  ],
  motors: [
    a("auto-workshop-bay", "The workshop bay", "the bay, the mechanics, the jobs done; book a slot", "full-bleed", "services gallery process proof",
      "services:feature-cards gallery:filmstrip process:timeline-h proof:cards trust:counters", "steel dark", "Bricolage Grotesque/Inter", "sharp compact rich", "gunmetal and orange; sparks, tools, clean bays"),
    a("auto-showroom", "The showroom", "vehicles on the floor: models, finance help, test drive", "split-frame", "services trust gallery visit",
      "services:category-tabs trust:icon-row gallery:bento proof:star-summary process:steps", "midnight light", "Space Grotesk/DM Sans", "sharp airy subtle", "showroom white; one deep blue; hero shots from three-quarter angles"),
    a("auto-fleet-rates", "The fleet and rates", "vehicles, capacity, routes and a rate sheet", "editorial-marquee", "services trust process visit",
      "services:tiers trust:ticker process:numbered-list gallery:masonry proof:clients-strip", "saffron light", "Manrope/Inter", "soft compact subtle", "dependable; saffron and charcoal; route list; call the dispatcher"),
    a("auto-care-club", "The care club", "service plans, reminders, genuine parts - a relationship", "centered-minimal", "about services process proof",
      "about:story-columns services:grid process:icon-cards proof:testimonial-carousel trust:strip", "ocean light", "DM Sans/Inter", "soft airy subtle", "friendly; blue; shows the customer, not the car"),
    a("auto-detailing-gloss", "The gloss", "detailing and accessories: glossy macro shots, packages", "stacked-poster", "gallery services proof process",
      "gallery:bento services:price-list proof:review-wall process:steps about:photo-collage", "noir dark", "Space Grotesk/Manrope", "sharp airy rich", "black glass; reflections; neon-free accent colour"),
    a("auto-logistics-network", "The network", "a transport company: coverage, tracking help, years in service (as told)", "mosaic", "trust services about proof",
      "trust:counters services:magazine about:numbers-led proof:results-band gallery:filmstrip", "emerald dark", "Bricolage Grotesque/DM Sans", "soft compact subtle", "green on ink; trucks at dusk; coverage by city list"),
  ],
  creative: [
    a("creative-portfolio-reel", "The portfolio reel", "work first and nearly nothing else: a reel of the best frames", "full-bleed", "gallery about services proof",
      "gallery:filmstrip about:pull-quote services:tiers proof:clients-strip trust:ticker", "noir dark", "Instrument Serif/Inter", "sharp airy rich", "black; full-bleed frames; tiny type"),
    a("creative-wedding-stories", "Wedding stories", "each wedding a story: real couples, real days (with permission)", "stacked-poster", "gallery proof services process",
      "gallery:album-tabs proof:testimonial-carousel services:feature-cards process:timeline-h about:owner-card", "ivory light luxe", "Playfair Display/Mukta", "soft airy subtle", "ivory and blush; film grain; couples credited"),
    a("creative-package-card", "The package card", "three clear packages, what is included, a date check", "split-frame", "services gallery process proof",
      "services:tiers gallery:masonry process:numbered-list proof:cards about:story-columns", "royal light", "DM Serif Display/Manrope", "soft compact subtle", "clear and warm; violet; included/excluded ticks"),
    a("creative-event-stage", "The event stage", "decoration and DJ: stage, lights, scale; enquiry by date", "glass-card", "gallery services process proof",
      "gallery:mosaic services:scroller process:steps proof:review-wall trust:counters", "crimson dark", "Bricolage Grotesque/DM Sans", "pill airy rich", "stage lighting; magenta and gold; wide crowd shots"),
    a("creative-studio-journal", "The studio journal", "a journal of shoots and the thinking behind them", "masthead", "about gallery services proof",
      "about:editorial-split gallery:masonry services:magazine proof:cards process:icon-cards", "cocoa light", "Newsreader/DM Sans", "sharp airy subtle", "literary; paper tones; captions as little essays"),
    a("creative-product-shoots", "Product and fashion shoots", "commercial photography: clients, process, turnaround", "editorial-marquee", "gallery process services proof",
      "gallery:bento process:timeline-h services:price-list proof:results-band about:numbers-led", "steel light", "Space Grotesk/Inter", "sharp compact rich", "crisp; grey; clients logo ribbon only as told"),
  ],
  tech: [
    a("tech-product-demo", "The product demo", "what we build, shown: a big device frame, outcomes, a call to talk", "video-first", "services proof process trust",
      "services:feature-cards proof:results-band process:timeline-h trust:counters about:story-columns", "midnight dark", "Space Grotesk/Inter", "sharp compact rich", "dark UI; electric blue; screens and diagrams"),
    a("tech-agency-index", "The agency index", "a numbered index of services and case studies, typographic", "editorial-marquee", "services gallery about proof",
      "services:price-list gallery:masonry about:numbers-led proof:clients-strip process:numbered-list", "noir light", "Bricolage Grotesque/Manrope", "sharp compact subtle", "monochrome; huge type; a single accent colour"),
    a("tech-case-files", "The case files", "projects as case studies: problem, work, result (as told)", "split-frame", "gallery process services proof",
      "gallery:album-tabs process:steps services:grid proof:testimonial-carousel trust:strip", "emerald light", "DM Sans/Inter", "soft compact subtle", "clear and practical; green; screenshot-led"),
    a("tech-small-business-kit", "The small-business kit", "websites, ads and WhatsApp tools for local shops: packages and a plain-language promise", "centered-minimal", "services process trust faq",
      "services:tiers process:icon-cards trust:icon-row proof:cards gallery:bento", "teal light", "Manrope/Inter", "pill airy subtle", "friendly tech; teal; zero jargon"),
    a("tech-lab", "The lab", "engineering depth: stack, method, how we work", "diagonal", "about process services trust",
      "about:editorial-split process:numbered-list services:magazine trust:split-cards proof:results-band", "royal dark", "Space Grotesk/DM Sans", "sharp compact rich", "violet on ink; code-adjacent details; no fake metrics"),
    a("tech-growth-partner", "The growth partner", "marketing as a partnership: monthly rhythm, reports, results (only as told)", "mosaic", "proof services process about",
      "proof:star-summary services:category-tabs process:timeline-h about:owner-card gallery:filmstrip", "saffron dark", "Bricolage Grotesque/Inter", "pill compact rich", "bold; orange; dashboards drawn, not faked"),
  ],
  travel: [
    a("travel-destination-wall", "The destination wall", "destinations as big tiles: tap one for packages", "full-bleed", "services gallery process proof",
      "services:magazine gallery:masonry process:steps proof:review-wall trust:ticker", "ocean light", "Fraunces/DM Sans", "soft airy rich", "blue sky and sea; dramatic landscapes; short place captions"),
    a("travel-package-ladder", "The package ladder", "budget, standard, premium - side by side", "split-frame", "services trust process proof",
      "services:tiers trust:icon-row process:numbered-list proof:cards gallery:bento", "teal light", "Manrope/Inter", "soft compact subtle", "clear inclusions; teal; no fares unless told"),
    a("travel-journal", "The travel journal", "stories from trips: the planner's eye", "masthead", "about gallery services proof",
      "about:editorial-split gallery:album-tabs services:scroller proof:testimonial-carousel process:timeline-h", "cocoa light", "Newsreader/Manrope", "sharp airy subtle", "paper tones; postmarks; photographs with notes"),
    a("travel-pilgrim-yatra", "The yatra planner", "pilgrimage groups: dates, stays, food, safety", "stacked-poster", "services process trust faq",
      "services:price-list process:timeline-h trust:strip proof:cards gallery:filmstrip", "saffron dark", "Lora/Mukta", "soft compact subtle", "saffron on dark; temple silhouettes; group departure dates"),
    a("travel-tickets-desk", "The tickets desk", "flights, trains, visas: a desk that answers fast", "glass-card", "services trust process visit",
      "services:category-tabs trust:icon-row process:steps proof:star-summary about:story-columns", "royal light", "Space Grotesk/Inter", "pill compact rich", "quick and bright; violet; WhatsApp-first"),
    a("travel-honeymoon-edit", "The honeymoon edit", "romantic, curated trips for two", "centered-minimal", "gallery services about proof",
      "gallery:bento services:feature-cards about:pull-quote proof:review-wall process:icon-cards", "rose dark luxe", "Playfair Display/DM Sans", "soft airy rich", "dusk pink and gold; two figures small in a big landscape"),
  ],
  school: [
    a("school-campus-tour", "The campus tour", "walk through the campus: classrooms, play area, a day in school", "full-bleed", "gallery about services process",
      "gallery:filmstrip about:overlap-card services:feature-cards process:numbered-list proof:cards", "ocean light", "Fraunces/Manrope", "soft airy rich", "bright, safe and open; blue and sunshine; photographs of spaces more than faces"),
    a("school-admission-path", "The admission path", "for parents: how to apply, dates (as told), fees on request", "split-frame", "process services about proof",
      "process:timeline-h services:category-tabs about:story-columns proof:testimonial-carousel trust:icon-row", "emerald light", "DM Sans/Inter", "soft compact subtle", "clear and kind; green; a checklist of documents"),
    a("school-principal-note", "The principal's note", "the leader's message and values lead; then programmes", "centered-minimal", "about services proof process",
      "about:owner-card services:price-list proof:cards process:steps trust:strip", "midnight light", "Newsreader/Inter", "sharp airy subtle", "dignified; navy and cream; a signed message"),
    a("school-arts-academy", "The arts academy", "dance, music, art classes: levels, performances, enrolment", "stacked-poster", "gallery services proof process",
      "gallery:masonry services:scroller proof:testimonial-carousel process:icon-cards about:editorial-split", "royal dark", "DM Serif Display/DM Sans", "soft airy rich", "stage light; violet and gold; movement blur"),
  ],
  coaching: [
    a("coach-results-wall", "The results wall", "toppers and selections (only as told) as the lead, then batches", "editorial-marquee", "proof services process trust",
      "proof:results-band services:category-tabs process:steps trust:counters about:story-columns", "royal dark", "Bricolage Grotesque/Inter", "sharp compact rich", "high energy; violet and yellow-free gold; names with permission"),
    a("coach-method", "The method", "how teaching works: concept, practice, test, review", "split-frame", "process about services proof",
      "process:timeline-h about:editorial-split services:tiers proof:cards trust:strip", "teal light", "DM Sans/Inter", "soft compact subtle", "analytical; teal; diagrams of the weekly cycle"),
    a("coach-faculty-first", "Faculty first", "the teachers, their subjects and style", "centered-minimal", "about services proof process",
      "about:owner-card services:grid proof:testimonial-carousel process:icon-cards gallery:filmstrip", "midnight light", "Newsreader/Manrope", "soft airy subtle", "scholarly; navy and cream; portraits of teachers"),
    a("coach-batch-board", "The batch board", "when classes run, fees as told, a free demo class", "glass-card", "trust services visit proof",
      "trust:ticker services:price-list gallery:lightbox-grid proof:star-summary process:steps", "saffron light", "Space Grotesk/Inter", "pill compact rich", "clear timetable; saffron; a demo-class button"),
    a("coach-skill-lab", "The skill lab", "computer and skill courses: syllabus, projects, certificates (as told)", "mosaic", "services process gallery proof",
      "services:feature-cards process:numbered-list gallery:bento proof:review-wall trust:split-cards", "emerald dark", "Manrope/DM Sans", "soft compact rich", "screens and projects; green on dark"),
    a("coach-one-teacher", "The one teacher", "a single teacher's page: subjects, approach, a trial class", "masthead", "about services proof faq",
      "about:pull-quote services:scroller proof:cards trust:strip process:steps", "cocoa light", "Fraunces/Mukta", "soft airy subtle", "personal; warm paper tones; the teacher's voice"),
  ],
  farm: [
    a("farm-source", "From the source", "where it is grown or made, how, then the range", "full-bleed", "about services process gallery",
      "about:overlap-card services:feature-cards process:timeline-h gallery:masonry proof:cards", "emerald light", "Fraunces/DM Sans", "soft airy rich", "fields and early light; green and earth; the producer's hands"),
    a("farm-dealer-network", "The dealer network", "dealers and distributors: products, territories, how to stock", "split-frame", "trust services process proof",
      "trust:counters services:category-tabs process:numbered-list proof:clients-strip gallery:filmstrip", "steel light", "Space Grotesk/Inter", "sharp compact subtle", "trade-facing; grey and green; a dealer-enquiry button"),
    a("farm-capacity-sheet", "The capacity sheet", "a manufacturer's page: machines, capacity (as told), quality steps", "editorial-marquee", "trust services process gallery",
      "trust:split-cards services:magazine process:steps gallery:bento proof:results-band", "ocean dark", "Bricolage Grotesque/Inter", "sharp compact subtle", "industrial blue; machinery macro shots; no fake certifications"),
    a("farm-daily-fresh", "Fresh every morning", "dairy/produce: the daily route, subscriptions, purity (as told)", "centered-minimal", "services process about visit",
      "services:grid process:icon-cards about:owner-card trust:strip proof:testimonial-carousel", "teal light", "Lora/Mukta", "soft airy subtle", "milky white and blue; steel cans; the morning route"),
    a("farm-seed-to-shelf", "Seed to shelf", "agri inputs by crop and season: what to use when", "mosaic", "services trust about faq",
      "services:category-tabs trust:icon-row about:story-columns proof:cards gallery:lightbox-grid", "saffron light", "Manrope/Mukta", "soft compact subtle", "crop calendar feel; harvest saffron; advice in plain words"),
    a("farm-heritage-works", "The heritage works", "a factory with history: the plant, the people, the product", "masthead", "about gallery services proof",
      "about:year-timeline gallery:filmstrip services:price-list proof:clients-strip trust:counters", "cocoa dark", "Playfair Display/Inter", "sharp airy subtle", "sepia and brass; archival plant photographs"),
  ],
  community: [
    a("comm-purpose-first", "The purpose first", "why we exist; the work; how to take part", "centered-minimal", "about services process proof",
      "about:pull-quote services:feature-cards process:steps proof:testimonial-carousel trust:counters", "emerald light", "Newsreader/Mukta", "soft airy subtle", "earnest; green; real events, real faces with permission"),
    a("comm-events-calendar", "The events calendar", "what is coming up, what happened: notices and festivals", "editorial-marquee", "services gallery about visit",
      "services:category-tabs gallery:album-tabs about:story-columns trust:ticker proof:cards", "saffron light", "Bricolage Grotesque/Mukta", "soft compact rich", "festive and busy; saffron; dated cards"),
    a("comm-temple-darshan", "The darshan page", "a temple trust: the deity, aarti timings, donations, seva", "stacked-poster", "about visit services gallery",
      "about:pull-quote trust:strip services:price-list gallery:filmstrip proof:cards", "saffron dark", "Playfair Display/Mukta", "soft airy subtle", "deep saffron on dark; lamplight; timings prominent; no donation pressure"),
    a("comm-donate-desk", "The donation desk", "an NGO: the cause, the impact (as told), a clear donate/volunteer action", "split-frame", "about proof process services",
      "about:overlap-card proof:results-band process:icon-cards services:grid gallery:masonry", "rose light", "Fraunces/Inter", "soft airy rich", "warm and honest; rose; photographs of work in progress, not of suffering"),
    a("comm-members-hall", "The members' hall", "a society or club: members, committee, notices, joining", "mosaic", "trust about services visit",
      "trust:split-cards about:owner-card services:grid proof:cards gallery:bento", "ocean light", "Manrope/Inter", "soft compact subtle", "friendly notice-board feel; blue; committee portraits"),
    a("comm-resident-board", "The resident board", "a housing society: notices, accounts, complaints, facility booking", "glass-card", "services trust process visit",
      "services:category-tabs trust:icon-row process:steps proof:star-summary gallery:lightbox-grid", "teal light", "DM Sans/Inter", "pill compact subtle", "calm civic; teal; contacts of guard and secretary"),
  ],
  leader: [
    a("leader-people-first", "People first", "the leader among the people: work done, the area, the door that is open", "full-bleed", "about proof services visit",
      "about:editorial-split proof:cards services:feature-cards trust:counters gallery:masonry", "saffron dark", "Bricolage Grotesque/Mukta", "sharp airy rich", "confident, plain; flag colours used lightly; photographs from the ground"),
    a("leader-work-record", "The work record", "what has been done - only what is told - as a record by area", "editorial-marquee", "services trust about gallery",
      "services:price-list trust:counters about:numbers-led gallery:album-tabs proof:clients-strip", "midnight light", "Newsreader/Inter", "sharp compact subtle", "formal; navy; a ledger of works"),
    a("leader-meet", "Meet and write", "constituents: how to reach the office, hours for meetings, grievance steps", "split-frame", "process visit about services",
      "process:numbered-list trust:strip about:owner-card services:category-tabs proof:cards", "emerald light", "DM Sans/Mukta", "soft compact subtle", "approachable; green; contact first"),
    a("leader-vision-note", "The vision note", "a letter-like page: the vision in the leader's voice", "centered-minimal", "about services proof gallery",
      "about:pull-quote services:grid proof:testimonial-carousel gallery:filmstrip trust:ticker", "ivory light", "Playfair Display/Mukta", "soft airy subtle", "dignified; ivory; signature"),
    a("leader-ward-map", "The ward map", "work by ward and village, news, events", "mosaic", "services gallery trust visit",
      "services:magazine gallery:album-tabs trust:split-cards proof:cards about:story-columns", "ocean light", "Manrope/Mukta", "soft compact rich", "map-minded; blue; local place names"),
    a("leader-youth-voice", "The youth voice", "a younger leader or activist: energy, causes, volunteers", "diagonal", "about services gallery process",
      "about:photo-collage services:scroller gallery:bento process:icon-cards proof:review-wall", "crimson dark", "Space Grotesk/Mukta", "pill compact rich", "bold; red; short punchy lines; no slogans against anyone"),
  ],
  astro: [
    a("astro-consult", "The consultation", "how a reading works: bring your details, choose a format, get guidance", "centered-minimal", "services process about faq",
      "services:price-list process:steps about:owner-card proof:cards trust:strip", "royal dark", "Playfair Display/Mukta", "soft airy subtle", "indigo and gold; stars and diyas drawn, not stocky; no guarantees"),
    a("astro-vedic-library", "The vedic library", "the knowledge areas: kundali, vastu, muhurat - each explained", "masthead", "services about gallery proof",
      "services:magazine about:editorial-split gallery:masonry proof:testimonial-carousel process:icon-cards", "cocoa light", "Newsreader/Mukta", "sharp airy subtle", "manuscript tones; serif; restraint"),
    a("astro-pandit-ji", "Pandit ji", "the person: lineage and approach", "split-frame", "about services proof visit",
      "about:year-timeline services:feature-cards proof:cards trust:icon-row process:numbered-list", "saffron light", "Fraunces/Mukta", "soft airy subtle", "warm saffron; a portrait; the mandir or study room"),
    a("astro-puja-booking", "The puja booking", "pujas and ceremonies: list, samagri, book a date", "stacked-poster", "services process trust proof",
      "services:category-tabs process:timeline-h trust:icon-row proof:review-wall gallery:filmstrip", "crimson dark", "DM Serif Display/Mukta", "soft airy rich", "red and gold; marigold, ghee lamps"),
    a("astro-vastu-home", "The vastu visit", "vastu for homes and shops: the visit, the report, the remedies in plain words", "split-frame", "process services about proof",
      "process:numbered-list services:grid about:story-columns proof:cards gallery:bento", "emerald light", "Lora/Mukta", "soft compact subtle", "earth and green; floor plans; compass line-art"),
    a("astro-daily-guide", "The daily guide", "a rhythm of guidance: today, this week - content-led", "mosaic", "services about proof gallery",
      "services:scroller about:photo-collage proof:star-summary gallery:album-tabs trust:ticker", "midnight dark", "Instrument Serif/Mukta", "pill airy rich", "night blue and gold; moon phases; no predictions made up"),
  ],
  personal: [
    a("me-portrait", "The portrait", "one person, one great portrait, one clear thing they do", "split-frame", "about services proof process",
      "about:owner-card services:feature-cards proof:testimonial-carousel process:numbered-list trust:strip", "midnight light", "Instrument Serif/Inter", "soft airy subtle", "a single confident photograph; navy and white"),
    a("me-creator-reel", "The creator reel", "content first: the best posts and videos, collaborations", "video-first", "gallery about services proof",
      "gallery:bento about:story-columns services:tiers proof:clients-strip trust:ticker", "royal dark", "Bricolage Grotesque/Manrope", "pill airy rich", "bold; violet; stills from the work"),
    a("me-cv-page", "The living CV", "a professional record: roles, skills, certificates (as told), contact", "masthead", "about trust services process",
      "about:year-timeline trust:counters services:price-list process:numbered-list proof:cards", "steel light", "Newsreader/Inter", "sharp compact subtle", "quiet; grey; a timeline"),
    a("me-agent-desk", "The agent's desk", "a sales or insurance agent: products offered, how I help, call me", "glass-card", "services process trust proof",
      "services:category-tabs process:steps trust:icon-row proof:review-wall about:overlap-card", "teal light", "Manrope/Mukta", "pill compact rich", "friendly; teal; a clear phone-number-first layout"),
    a("me-service-hero", "Service and pride", "an officer, soldier or retired professional: service record (as told), community work", "stacked-poster", "about gallery services proof",
      "about:pull-quote gallery:filmstrip services:grid proof:cards trust:strip", "emerald dark", "Playfair Display/Mukta", "sharp airy subtle", "dignified; olive green; uniform photographs with permission"),
    a("me-newsletter", "The notes", "a writer or coach: ideas, a way to follow", "editorial-marquee", "about services gallery proof",
      "about:editorial-split services:magazine gallery:masonry proof:clients-strip process:icon-cards", "ivory light", "Fraunces/DM Sans", "soft airy subtle", "paper and ink; essays; one accent"),
  ],
  general: [
    a("gen-editorial", "The editorial", "a clear story first, the offering, proof", "split-frame", "about services proof gallery",
      "about:story-columns services:grid proof:cards gallery:masonry trust:strip", "midnight light", "Newsreader/Inter", "soft airy subtle", "calm and clear; navy and white"),
    a("gen-catalogue", "The catalogue", "the offering first, with prices and an ask button", "editorial-marquee", "trust services gallery about",
      "trust:icon-row services:feature-cards gallery:mosaic about:overlap-card proof:star-summary", "teal light", "Manrope/Inter", "soft compact subtle", "clean; teal; product photographs"),
    a("gen-showcase", "The showcase", "photographs lead", "full-bleed", "gallery about services proof",
      "gallery:bento about:pull-quote services:scroller proof:testimonial-carousel trust:ticker", "noir dark", "Instrument Serif/DM Sans", "sharp airy rich", "dark; large photographs"),
    a("gen-proof-first", "Proof first", "reviews and numbers first", "mosaic", "trust proof about services",
      "trust:counters proof:review-wall about:numbers-led services:category-tabs process:steps", "emerald light", "DM Sans/Inter", "pill compact rich", "green; star summary; short claims only as told"),
    a("gen-walk-in", "Walk-in", "where we are, when we are open, how to reach us", "glass-card", "visit trust services proof",
      "trust:split-cards services:price-list gallery:lightbox-grid proof:cards process:icon-cards", "saffron light", "Bricolage Grotesque/Mukta", "soft compact subtle", "local; saffron; map and timings first"),
    a("gen-storyteller", "The storyteller", "the owner's story, step by step", "centered-minimal", "about proof process services",
      "about:owner-card proof:testimonial-carousel process:timeline-h services:magazine gallery:filmstrip", "cocoa light", "Fraunces/Manrope", "soft airy subtle", "warm; earth tones; first-person voice"),
  ],
};

/* ================= researched on real premium sites (16 Oct 2026) ================= */
// Four researchers read ~60 premium sites (Grand Street Dental, Zen Dentist, Ross School, Canterbury School, Sox, Allen,
// Unacademy, Stanford, Lal PathLabs, PharmEasy, 1mg, Ladurée, Pierre Hermé, Dishoom, Sweetgreen, Ottolenghi, Sabyasachi, Nicobar,
// Allbirds, Mejuri, CaratLane, Kama Ayurveda, Herman Miller, IKEA, Polycab, Royal Enfield, Asian Paints ...) and wrote down what
// makes each feel expensive: one confident idea, a proof device early (numbers, ratings, press, accreditation), photography that
// does the work, and a section order that fits who the visitor is. What follows is that, mapped onto the variants the renderer
// really has. It sits next to LIBRARY (the engine's first set); both are merged below. A new line is one a() call.
//
// The researchers' claims are about those sites, not about the businesses using these layouts: the notes say "only as told" where
// a number, a badge or a credential would be needed, and the renderer shows only what the card holds.
const RESEARCHED: Record<string, Archetype[]> = {
  school: [
    a("school-outcomes-ledger", "The outcomes ledger", "a confident headline with a row of icon stat cards under it (students, ratio, years, results): numbers first, then philosophy", "mosaic", "trust about services proof",
      "trust:counters about:story-columns services:feature-cards proof:cards gallery:mosaic faq:accordion visit:split cta:band footer:columns", "midnight light", "Playfair Display/Inter", "sharp compact subtle", "serif headline, square cards with thin rules; navy, ivory and one gold accent; only the figures the school gave"),
    a("school-story-film", "The story film", "the campus full-bleed with one first-person line and a single Book a visit button; few boxes, alternating image bands", "video-first", "about proof gallery trust",
      "about:pull-quote proof:testimonial-carousel gallery:filmstrip trust:ticker process:timeline-h cta:wide-band footer:minimal", "noir dark", "Instrument Serif/Inter", "sharp airy rich", "dark overlay, big white display type; short parent-to-parent sentences; low density"),
    a("school-craft-notebook", "The craft notebook", "paper texture, taped photos, a playful headline: the school looks hand-made, not templated", "split-frame", "services gallery about proof",
      "services:grid gallery:masonry about:photo-collage proof:review-wall faq:chat-bubble visit:map-hours cta:floating-card footer:link-grid", "saffron light", "Bricolage Grotesque/Mukta", "soft airy rich", "pastel plus one saturated colour; tilted prints, stamps and doodle arrows; child-voice quotes mixed in"),
    a("school-parent-hub", "The parent hub", "four big quick actions (Apply, Pay fees, Calendar, Contact): the page is a tool first", "centered-minimal", "cta services about trust",
      "services:category-tabs trust:icon-row about:story-columns proof:cards process:steps visit:split cta:sticky-ribbon footer:mega", "ocean light", "Manrope/Inter", "soft compact subtle", "utility layout, big icon tiles, blue and white; task-labelled copy (Pay, Download, Apply)"),
    a("school-day-timeline", "A day at school", "headline on the left and a vertical time strip (assembly, lessons, clubs, pick-up) on the right: parents see the routine", "diagonal", "process about services gallery",
      "process:timeline-h about:year-timeline services:price-list gallery:bento proof:cards faq:two-column cta:band footer:columns", "emerald light", "DM Sans/Inter", "soft airy subtle", "sage and cream, soft shadows; reassuring and concrete about the daily routine and safety"),
    a("school-magazine-collage", "The magazine collage", "four or five photos at different sizes under an overprinted serif headline and an admissions-open sticker", "masthead", "gallery about services proof",
      "gallery:masonry about:editorial-split services:magazine proof:clients-strip trust:ticker faq:numbered-accordion cta:wide-band footer:big-wordmark", "ivory light", "Instrument Serif/DM Sans", "sharp airy subtle", "editorial serif, small-caps captions that tell small stories; warm off-white, ink black, one bright accent"),
  ],
  playschool: [
    a("play-world", "The play world", "playful pre-school: colours, shapes, a day with us", "mosaic", "services gallery trust proof",
      "services:grid gallery:bento trust:split-cards proof:review-wall about:photo-collage", "saffron light", "Bricolage Grotesque/Mukta", "pill airy rich", "rounded, colourful; primary colours used with taste; children only with permission"),
    a("play-sunny-blocks", "Sunny blocks", "big rounded colour blocks, a smiling child cut into a blob, chunky type and a free-visit pill", "split-frame", "trust services gallery process",
      "trust:icon-row services:grid gallery:bento process:icon-cards proof:review-wall faq:two-column visit:split cta:floating-card footer:link-grid", "saffron light", "Bricolage Grotesque/Mukta", "pill airy rich", "bright but softened; sticker icons and very rounded corners; very short lines for mothers; big tap targets"),
    a("play-montessori-calm", "Montessori calm", "natural light, wooden-toy colours, a lowercase serif headline: a quiet page that respects the child", "centered-minimal", "about process services gallery",
      "about:story-columns process:numbered-list services:price-list gallery:filmstrip trust:strip proof:testimonial-carousel faq:accordion cta:band footer:minimal", "cocoa light", "Lora/Mukta", "soft airy subtle", "earth tones, thin line icons, lots of whitespace; gentle, philosophy-led copy about child-led learning"),
    a("play-day-in-the-life", "Day in the life", "today's date and a swipeable row of activity cards (story time, art, music): an app-like diary for parents", "editorial-marquee", "process gallery services trust",
      "process:timeline-h services:scroller gallery:album-tabs trust:ticker proof:cards faq:chat-bubble visit:hours-timeline cta:split-qr footer:mega", "rose light", "Fraunces/DM Sans", "pill airy rich", "card carousel, pastel gradients, rounded app-like surfaces; diary-like, day-by-day copy"),
    a("play-fee-table", "The programme table", "age-group chips (1.5-2.5, 2.5-3.5, 3.5-5) that lead to a transparent programme and timing table", "diagonal", "services trust faq proof",
      "services:tiers trust:split-cards faq:searchable proof:cards gallery:lightbox-grid process:steps visit:hours-timeline cta:band footer:columns", "teal light", "Manrope/Inter", "soft compact subtle", "pricing-card tables colour-coded by age; answers the worry questions up front; fees only as told"),
    a("play-safety-shield", "The safety shield", "trust badges first (CCTV, trained caregivers, hygiene, transport), then a gentle photograph", "glass-card", "trust about services gallery",
      "trust:counters about:overlap-card services:feature-cards gallery:masonry proof:testimonial-carousel faq:two-column visit:map-hours cta:wide-band footer:big-wordmark", "teal light", "Manrope/Mukta", "pill compact subtle", "shield and check icons, teal with a warm yellow; calm authority with specific safety facts (only those the school gave)"),
    a("play-story-book", "Story book pages", "a picture-book cover with the scene and title in storybook lettering; the page scrolls as chapters", "stacked-poster", "about services gallery process",
      "about:story-columns services:grid gallery:filmstrip process:numbered-list proof:review-wall faq:chat-bubble visit:split cta:floating-card footer:minimal", "gold light", "DM Serif Display/Mukta", "soft airy rich", "illustrated spot art, scalloped dividers, chapter numerals; narrative copy (Chapter 1: Hello), whimsical but clear"),
  ],
  college: [
    a("college-prospectus", "The prospectus", "a college: courses, departments, placements (only as told), apply", "masthead", "services trust about gallery",
      "services:category-tabs trust:counters about:numbers-led gallery:mosaic proof:results-band", "steel light", "Space Grotesk/Inter", "sharp compact subtle", "serious and organised; navy; a prospectus layout"),
    a("college-campus-cinema", "Campus cinema", "the campus full-screen, a two-word statement and Apply / Visit buttons", "full-bleed", "about services proof gallery",
      "about:pull-quote services:category-tabs proof:results-band gallery:filmstrip trust:ticker faq:accordion visit:address-poster cta:wide-band footer:big-wordmark", "midnight dark", "Playfair Display/Inter", "sharp airy rich", "large display serif, minimal chrome, full-bleed bands in the deep colour of the college logo; short verb calls to action"),
    a("college-programme-explorer", "Programme explorer", "programmes (B.Com, BCA, MBA) as filterable cards with duration and fee chips", "glass-card", "services trust process proof",
      "services:category-tabs trust:icon-row process:steps proof:star-summary gallery:lightbox-grid faq:searchable visit:split cta:band footer:link-grid", "ocean light", "Manrope/Inter", "soft compact subtle", "filter chips, programme cards with duration, blue and white; informational and comparison-friendly"),
    a("college-placement-board", "Placement scoreboard", "big numerals (highest package, placement rate, recruiters) and a recruiter logo strip: outcomes for students and employers", "editorial-marquee", "proof trust services about",
      "trust:counters proof:clients-strip services:magazine about:numbers-led gallery:masonry faq:two-column visit:map-hours cta:split-qr footer:mega", "gold dark", "Space Grotesk/DM Sans", "sharp compact rich", "big numerals, logo wall, dark and gold on a strong grid; every figure and every recruiter name only as told"),
    a("college-student-life", "Student life mosaic", "a photo mosaic of clubs, labs, sports and events with short captions: young and energetic", "diagonal", "gallery about services proof",
      "gallery:mosaic about:photo-collage services:scroller proof:review-wall trust:split-cards faq:chat-bubble visit:split cta:floating-card footer:link-grid", "crimson light", "Bricolage Grotesque/Inter", "pill airy rich", "masonry grid, bright accent, rounded tiles; first-person student voice"),
    a("college-heritage", "The heritage prospectus", "the crest and founding year on a formal split hero, a quote from the principal", "split-frame", "about trust services proof",
      "about:year-timeline trust:strip services:price-list proof:cards gallery:filmstrip faq:numbered-accordion visit:address-poster cta:band footer:columns", "crimson light", "Playfair Display/Inter", "sharp airy subtle", "serif throughout, burgundy and cream, ruled dividers; stately and low motion; values and legacy"),
    a("college-admission-steps", "Admission steps", "apply now and a four-step tracker (apply, test, interview, join) with the last date as a badge", "centered-minimal", "process services trust faq",
      "process:timeline-h services:grid trust:ticker faq:numbered-accordion proof:testimonial-carousel gallery:bento visit:split cta:sticky-ribbon footer:columns", "royal light", "DM Sans/Inter", "soft compact subtle", "step tracker, deadline badge, clean white and one strong colour; helpful, deadline-aware copy"),
  ],
  coaching: [
    a("coach-rank-wall", "The rank wall", "a dark hero with a grid of topper photos and rank numbers, and a Book free demo button", "mosaic", "proof services trust process",
      "proof:review-wall services:category-tabs trust:counters process:steps about:story-columns faq:accordion visit:split cta:wide-band footer:big-wordmark", "midnight dark", "Bricolage Grotesque/Inter", "sharp compact rich", "navy and black with an electric accent, bold condensed headline, high contrast; result-first, urgent but credible; names and ranks only as told"),
    a("coach-course-catalogue", "The course catalogue", "the goal selector is the hero: tabs for JEE, NEET, Class 9-10, Boards reveal the batch cards", "split-frame", "services process proof trust",
      "services:category-tabs process:steps proof:cards trust:icon-row about:story-columns faq:searchable visit:split cta:band footer:link-grid", "ocean light", "Manrope/Inter", "soft compact subtle", "tab chips and batch cards with start date and fee; clean white with a bright blue; practical, no fluff"),
    a("coach-journey-roadmap", "The journey roadmap", "a path from enrol to result with milestones: diagnostic test, weekly tests, mock series, final", "diagonal", "process services proof trust",
      "process:timeline-h services:feature-cards proof:results-band trust:split-cards about:editorial-split faq:numbered-accordion visit:map-hours cta:floating-card footer:columns", "teal light", "DM Sans/Inter", "soft compact rich", "a roadmap line with numbered nodes, rounded cards; structured, step-by-step, confidence through method"),
    a("coach-free-test", "The free-test funnel", "one headline and one field for a free scholarship test, with the number of students beneath it", "stacked-poster", "trust proof services process",
      "trust:ticker proof:testimonial-carousel services:tiers process:icon-cards about:story-columns faq:accordion visit:split cta:sticky-ribbon footer:minimal", "saffron dark", "Space Grotesk/Inter", "pill compact rich", "single-column conversion layout with a sticky call bar on the phone; bold sans, an orange or green button; direct, benefit-led"),
    a("coach-study-journal", "The study journal", "an editorial serif headline on cream with a small margin note and one study-desk photograph", "masthead", "about process gallery proof",
      "about:editorial-split process:numbered-list gallery:masonry proof:clients-strip services:magazine faq:two-column visit:address-poster cta:band footer:big-wordmark", "ivory light", "Newsreader/DM Sans", "sharp airy subtle", "cream paper, ink black, marginalia and small-caps labels: a premium boutique tutorial; small batches, personal attention"),
  ],
  clinic: [
    a("clinic-spa-calm", "The spa-calm clinic", "a warm full-width treatment-room photograph, a quiet headline, and a numbered 01 / 02 approach", "full-bleed", "about proof services gallery",
      "about:editorial-split proof:testimonial-carousel services:price-list gallery:filmstrip trust:strip faq:accordion visit:map-hours cta:wide-band footer:minimal", "ivory light", "Newsreader/DM Sans", "soft airy subtle", "warm wood and cream, thin sans, generous space; comforts listed like a hotel; gentle copy that lowers anxiety"),
    a("clinic-smile-gallery", "The result gallery", "a before-and-after stage as the centrepiece with a one-line promise and a Book button", "video-first", "gallery proof services about",
      "gallery:bento proof:review-wall services:feature-cards about:overlap-card trust:ticker faq:chat-bubble visit:split cta:band footer:link-grid", "pearl light", "Instrument Serif/Inter", "sharp airy subtle", "white and neutral so the photographs lead, thin sans, a magazine feel; understated copy; result photographs only with the patient's permission"),
    a("clinic-portrait-authority", "The doctor's authority", "a large portrait with the name, degrees and badges beside the headline, the rating above the fold", "diagonal", "trust about services proof",
      "trust:split-cards about:owner-card services:grid proof:cards process:icon-cards faq:numbered-accordion visit:map-hours cta:floating-card footer:columns", "teal light", "Newsreader/Inter", "sharp compact subtle", "portrait on a tinted shape, serif name, a badge row; deep teal and white; credentials and ratings only as told"),
    a("clinic-care-pathway", "The care pathway", "three steps (Book, Visit, Recover) with a call button and WhatsApp: the page explains what happens", "glass-card", "process services trust proof",
      "process:steps services:grid trust:icon-row proof:testimonial-carousel about:story-columns faq:chat-bubble visit:hours-timeline cta:split-qr footer:mega", "ocean light", "Manrope/Inter", "pill airy subtle", "a stepper graphic, soft blue, rounded cards, large accessible type; reassuring and procedural"),
    a("clinic-speciality-directory", "The speciality directory", "a department grid and a Find a doctor search for a hospital, an emergency number always in reach", "masthead", "services trust about proof",
      "services:category-tabs trust:counters about:photo-collage proof:star-summary gallery:lightbox-grid faq:searchable visit:branch-list cta:sticky-ribbon footer:link-grid", "ocean light", "Space Grotesk/Inter", "sharp compact subtle", "icon grid, doctor cards with timings, institutional blue and white; clear and emergency-first"),
    a("clinic-boutique-family", "The family practice", "a friendly team photograph and a 'part of our family' line over soft rounded shapes", "split-frame", "about gallery services proof",
      "about:photo-collage gallery:mosaic services:feature-cards proof:review-wall trust:icon-row faq:two-column visit:split cta:floating-card footer:big-wordmark", "rose light", "Fraunces/DM Sans", "pill airy rich", "warm colour, rounded sans, hand-drawn flourishes; team grid with first names; plain Hindi or English warmth"),
    a("lab-test-finder", "The test finder", "a big search box for tests with quick actions: download report, book home collection, upload prescription", "centered-minimal", "services trust process proof",
      "services:category-tabs trust:icon-row process:steps proof:star-summary about:story-columns faq:searchable visit:split cta:band footer:mega", "ocean light", "Manrope/Inter", "soft compact subtle", "search-first, clean white with blue and an orange accent, an icon row of actions; efficient, turnaround-time focused"),
    a("lab-package-cards", "The health packages", "three package cards (basic, advanced, full body) with the test count and price, the middle one lifted", "split-frame", "services process trust proof",
      "services:tiers process:icon-cards trust:strip proof:cards about:story-columns faq:accordion visit:map-hours cta:floating-card footer:columns", "teal light", "Bricolage Grotesque/Inter", "soft compact subtle", "pricing cards with a highlighted middle package, friendly colour; transparent pricing, plain benefits; prices only as told"),
    a("lab-accreditation-wall", "The accreditation wall", "accreditation badges and lab-quality numbers (samples tested, quality checks) in a big stat band", "mosaic", "trust about services process",
      "trust:counters about:numbers-led services:magazine process:timeline-h proof:results-band faq:numbered-accordion visit:address-poster cta:wide-band footer:big-wordmark", "midnight light", "Space Grotesk/Inter", "sharp compact subtle", "big numerals, badges, deep blue on a strict grid; precise and science-led; badges and numbers only as told"),
    a("lab-home-collection", "Home collection journey", "an illustrated four-step flow: book, the phlebotomist visits, the sample is tested, the report arrives on WhatsApp", "stacked-poster", "process services trust proof",
      "process:timeline-h services:scroller trust:icon-row proof:testimonial-carousel gallery:bento faq:chat-bubble visit:hours-timeline cta:sticky-ribbon footer:link-grid", "teal dark", "Manrope/Mukta", "pill airy rich", "illustrated steps, soft teal, rounded shapes and time-slot chips; convenient, stress-free copy"),
  ],
  pharmacy: [
    a("pharm-counter", "The pharmacy counter", "genuine medicines, timings, home delivery, one call", "glass-card", "trust services visit faq",
      "trust:icon-row services:grid proof:star-summary process:steps gallery:lightbox-grid", "teal dark", "Space Grotesk/Inter", "pill compact subtle", "clear and fast; teal; open-now and delivery first; never medical advice"),
    a("pharm-order-desk", "The order desk", "the hero is an action panel: upload prescription, call to order, WhatsApp order, with the delivery promise", "split-frame", "services trust process proof",
      "services:category-tabs trust:icon-row process:steps proof:cards about:story-columns faq:accordion visit:split cta:sticky-ribbon footer:mega", "emerald light", "Manrope/Inter", "pill compact rich", "green and white, big action buttons, icon-led, a sticky call bar; fast, practical, delivery-first"),
    a("pharm-shelves", "Category shelves", "a search bar over a rail of categories (diabetes, BP, baby, ayurveda, skin) as product-style tiles", "centered-minimal", "services gallery trust proof",
      "services:scroller gallery:lightbox-grid trust:split-cards proof:star-summary process:icon-cards faq:searchable visit:map-hours cta:band footer:link-grid", "teal light", "DM Sans/Inter", "soft compact subtle", "catalogue grid, rounded product cards, a teal accent; brief labels; prices only as told"),
    a("pharm-trusted-pharmacist", "The trusted pharmacist", "the pharmacist's portrait and licence line with a 'we check every prescription' promise", "diagonal", "trust about process services",
      "trust:strip about:owner-card process:icon-cards services:price-list proof:testimonial-carousel faq:numbered-accordion visit:split cta:floating-card footer:columns", "midnight light", "Newsreader/Inter", "soft airy subtle", "portrait, licence badges, a serif accent on clean sans, navy and mint; careful, accountable, safety first; licence details only as told"),
    a("pharm-refill-club", "The monthly refill club", "never run out of medicines: a refill reminder and a monthly basket sign-up for families", "stacked-poster", "process services proof trust",
      "process:timeline-h services:tiers proof:cards trust:ticker about:overlap-card faq:chat-bubble visit:hours-timeline cta:split-qr footer:minimal", "rose light", "Fraunces/Mukta", "pill airy subtle", "calendar motifs, a soft gradient, subscription cards; caring, routine-focused, written for elderly families"),
    a("pharm-neighbourhood-chemist", "The neighbourhood chemist", "the shopfront with timings, a 24x7 badge if true and a map pin: local first", "full-bleed", "visit services trust gallery",
      "visit:address-poster services:grid trust:strip gallery:masonry proof:cards faq:two-column cta:wide-band footer:big-wordmark", "crimson light", "Bricolage Grotesque/Mukta", "soft compact subtle", "warm local feel, a bold open-now badge, simple blocks; local, familiar and direct"),
    a("pharm-wellness-boutique", "The wellness boutique", "a lifestyle hero with product photography on a soft tint and a curated brand shelf", "editorial-marquee", "gallery services about proof",
      "gallery:bento services:magazine about:editorial-split proof:clients-strip trust:ticker faq:accordion visit:split cta:band footer:link-grid", "pearl light", "Instrument Serif/DM Sans", "sharp airy subtle", "pastel tint, serif display, generous whitespace and apothecary labels; refined, curated health-and-beauty tone"),
  ],
  sweets: [
    a("sweets-pastry-editorial", "The pastry counter editorial", "words on the left and a tall photograph of one cake on the right: a huge serif headline with an italic word", "split-frame", "about gallery services proof",
      "about:editorial-split gallery:masonry services:feature-cards proof:testimonial-carousel trust:strip faq:numbered-accordion visit:split cta:band footer:minimal", "rose light", "Instrument Serif/Inter", "sharp airy subtle", "cream and blush, hairline rules, big margins, almost no boxes; slow and airy; short, confident sentences"),
    a("sweets-story-reel", "The story reel", "a full-screen loop of sugar being poured with the shop name small at the foot; each product a full-screen scene", "video-first", "gallery about services proof",
      "gallery:filmstrip about:pull-quote services:scroller proof:clients-strip trust:ticker faq:accordion visit:address-poster cta:wide-band footer:big-wordmark", "noir dark", "Instrument Serif/DM Sans", "sharp airy rich", "photo-first, white text on dark overlays, big numerals for prices; sensory one-liners, no paragraphs"),
    a("sweets-occasion-picker", "The occasion picker", "three large tiles (wedding, birthday, festival): pick one and the page leads to that set", "mosaic", "services process gallery proof",
      "services:category-tabs process:icon-cards gallery:album-tabs proof:star-summary about:photo-collage faq:chat-bubble visit:map-hours cta:sticky-ribbon footer:link-grid", "rose light", "Bricolage Grotesque/DM Sans", "pill compact rich", "bright pastel tiles, large rounded corners, an icon per occasion and a sticky WhatsApp button; planning help (order three days ahead)"),
    a("sweets-bake-magazine", "The bake magazine", "flour, hands, oven and the finished loaf as a magazine grid under an issue-style title", "masthead", "about process gallery services",
      "about:numbers-led process:numbered-list gallery:bento services:magazine proof:cards trust:strip faq:two-column visit:split cta:band footer:columns", "ivory light", "Fraunces/Inter", "sharp airy subtle", "off-white, black type, one accent, a mixed-size image grid with small-caps labels; craft-driven: fermentation, butter, slow mornings"),
    a("sweets-chalk-menu", "The chalk menu", "a chalkboard-style menu as the hero: today's specials and a price column", "stacked-poster", "services gallery about visit",
      "services:menu-leaders gallery:lightbox-grid about:owner-card trust:ticker proof:testimonial-carousel faq:accordion visit:hours-timeline cta:floating-card footer:link-grid", "noir dark", "Bricolage Grotesque/Mukta", "soft compact subtle", "dark slate, chalk-white hand lettering, a handwritten accent; friendly neighbourhood copy, today's fresh updates"),
    a("sweets-mithai-box", "The mithai-box catalogue", "an open gift box seen from above on a dark ground, four sweets in a grid, an Order a box button", "glass-card", "services gallery about proof",
      "services:feature-cards gallery:mosaic about:overlap-card proof:cards trust:split-cards faq:two-column visit:map-hours cta:wide-band footer:mega", "crimson dark", "DM Serif Display/DM Sans", "soft compact rich", "deep maroon and saffron-gold with thin gold keylines, dense product tiles with weight and price chips; warm and festive, specific about ghee, kesar and fresh daily"),
    a("sweets-catering-proposal", "The catering proposal", "a wide banquet photograph and a guest-count line (for 50 / 200 / 500) that leads to an enquiry", "diagonal", "trust services process gallery",
      "trust:icon-row services:tiers process:numbered-list gallery:masonry proof:results-band faq:accordion visit:split cta:band footer:columns", "emerald light", "DM Serif Display/Inter", "sharp compact subtle", "ivory and deep green, formal serif, three clean package columns; organised and reliable: tasting, set-up, staff, timing"),
  ],
  dining: [
    a("dining-dish-spotlight", "The signature dish", "one plate shot huge and cropped, the dish's name as the headline, its price and an Order button beside it", "diagonal", "services about gallery proof",
      "services:feature-cards about:story-columns gallery:bento proof:cards trust:icon-row faq:two-column visit:map-hours cta:band footer:columns", "saffron light", "Bricolage Grotesque/Inter", "soft compact rich", "bright saturated overhead photography, chunky sans, tags for veg, non-veg and spicy; appetite-led, ingredients listed plainly"),
    a("dining-zine", "The cafe zine", "a hand-cut collage with stickers and a stamp-style logo, slightly off the grid, tidy info below", "stacked-poster", "about gallery services proof",
      "about:photo-collage gallery:masonry services:grid proof:review-wall trust:ticker faq:chat-bubble visit:split cta:floating-card footer:link-grid", "crimson light", "Bricolage Grotesque/Mukta", "pill airy rich", "bold colours, rough shapes, rotated cards and a marker accent; cheeky local voice in moderation"),
    a("dining-seasonal-menu", "The seasonal menu", "the menu's season and year in huge letters with a thin photo strip beneath", "masthead", "about services gallery process",
      "about:numbers-led services:menu-leaders gallery:filmstrip process:numbered-list proof:clients-strip trust:strip faq:accordion visit:address-poster cta:band footer:minimal", "noir light", "Newsreader/Inter", "sharp airy subtle", "monochrome with one accent, wide letter-spacing and hairline dividers, restrained photographs; chef-voice, precise, understated"),
    a("dining-cloud-kitchen", "The order app", "menu first: category chips and dish cards at once, a sticky Order-on-WhatsApp bar", "editorial-marquee", "services proof process visit",
      "services:category-tabs proof:star-summary process:steps trust:icon-row gallery:lightbox-grid faq:searchable visit:split cta:sticky-ribbon footer:mega", "emerald light", "Space Grotesk/Inter", "pill compact rich", "compact cards, high contrast, delivery time and area chips, little decoration; quick and functional"),
  ],
  fashion: [
    a("fashion-edit-tiles", "Edit tiles and gifting", "a seasonal edit banner, four large category tiles and a gifting concierge on WhatsApp", "diagonal", "services gallery trust about",
      "services:magazine gallery:bento trust:icon-row about:overlap-card proof:cards faq:two-column visit:split cta:floating-card footer:link-grid", "pearl light", "Manrope/DM Sans", "soft airy subtle", "soft neutrals, lifestyle plus clean product shots, a practical trust line (returns, COD, shipping); curated and friendly, sizing and care info"),
    a("fashion-craft-story", "Craft and fabric story", "a close-up of weave or embroidery with the artisan's name and fabric swatches as a strip", "masthead", "about process gallery services",
      "about:year-timeline process:timeline-h gallery:masonry services:scroller proof:cards trust:strip faq:accordion visit:address-poster cta:band footer:columns", "midnight light", "Fraunces/Mukta", "soft airy subtle", "indigo, madder and cream, serif plus a handwriting accent, textured backgrounds; heritage and craft, naming techniques and regions"),
    a("fashion-bridal-appointment", "The bridal appointment", "one dramatic bridal image with 'Book a private viewing' and a short quote", "centered-minimal", "about gallery process proof",
      "about:pull-quote gallery:filmstrip process:numbered-list proof:testimonial-carousel services:feature-cards faq:chat-bubble visit:map-hours cta:wide-band footer:big-wordmark", "crimson dark luxe", "Playfair Display/Inter", "sharp airy rich", "deep jewel tone or ivory, ornate serif, thin gold frames, very slow pacing; intimate, made-to-measure language"),
    a("fashion-sneaker-drop", "The drop grid", "the new product on a flat bright colour with a bold name and a 'new drop' tag, the rest in a tight grid", "video-first", "gallery services trust proof",
      "gallery:mosaic services:category-tabs trust:ticker proof:review-wall process:icon-cards faq:accordion visit:split cta:sticky-ribbon footer:mega", "royal dark", "Space Grotesk/Inter", "sharp compact rich", "heavy sans, saturated colour blocks, size chips and sharp corners; energetic and short, materials and comfort facts"),
  ],
  jewellery: [
    a("jewel-trust-ledger", "The trust ledger", "a delivery pincode check and the day's rate board beside the hero image, the guarantees in a row", "glass-card", "trust services gallery proof",
      "trust:split-cards services:category-tabs gallery:lightbox-grid proof:star-summary process:steps faq:numbered-accordion visit:split cta:band footer:columns", "midnight dark luxe", "Lora/Inter", "soft compact subtle", "navy and gold, structured cards, clear icons and a returns / exchange table; plain and number-led; rates and policies only as told"),
    a("jewel-silver-gift", "Silver and gift boutique", "cool silver tones, small pieces in a scattered grid, price-band filters", "diagonal", "services gallery proof about",
      "services:price-list gallery:masonry proof:cards about:photo-collage trust:ticker faq:two-column visit:map-hours cta:floating-card footer:link-grid", "pearl light", "DM Sans/Inter", "pill compact subtle", "pale grey and pink, rounded images, a light sans and gift-wrap cues; light, gifting, affordable luxury"),
  ],
  decor: [
    a("decor-room-bundles", "Room sets and bundles", "rooms photographed as sets, with curated bundles and a price anchor for each", "video-first", "services gallery process proof",
      "services:tiers gallery:mosaic process:steps proof:review-wall about:story-columns trust:strip faq:accordion visit:map-hours cta:band footer:columns", "ocean light", "Manrope/Inter", "soft airy subtle", "lifestyle photography of real rooms, generous whitespace, philosophy before price; designer attribution and prices only as told"),
    a("decor-colour-system", "The colour system", "a modular range shown as a colour-led brand: pick the finish, see the set", "stacked-poster", "services gallery about trust",
      "services:category-tabs gallery:bento about:editorial-split trust:split-cards proof:clients-strip faq:searchable visit:address-poster cta:wide-band footer:big-wordmark", "royal light", "Bricolage Grotesque/DM Sans", "sharp airy rich", "flat colour as the hero, thin type; separate paths for homeowners and professionals"),
  ],
  gifts: [
    a("gift-bouquet-editorial", "Seasonal bouquet editorial", "one large bouquet photograph with a centred serif headline and an Order today button", "centered-minimal", "services gallery about proof",
      "services:feature-cards gallery:masonry about:story-columns proof:testimonial-carousel process:timeline-h trust:strip faq:accordion visit:map-hours cta:band footer:minimal", "emerald light", "Fraunces/Inter", "soft airy subtle", "soft greens and blush, wide margins, italic serif, rounded images; gentle, seasonal, mentions same-day delivery if true"),
    a("gift-occasion-concierge", "The occasion concierge", "chips for birthday, anniversary, sympathy and corporate, and a WhatsApp concierge card", "mosaic", "services process gallery proof",
      "services:category-tabs process:icon-cards gallery:album-tabs proof:cards trust:icon-row faq:chat-bubble visit:split cta:sticky-ribbon footer:link-grid", "rose light", "Manrope/Mukta", "pill compact rich", "clear tiles, bright but tidy, helpful microcopy and a sticky chat button; quick and helpful: tell us the occasion and the budget"),
    a("gift-hamper-builder", "The hamper builder", "an open hamper with labelled items and a 'build your own' flow", "split-frame", "services process gallery proof",
      "services:grid process:steps gallery:bento proof:review-wall about:photo-collage trust:ticker faq:two-column visit:split cta:floating-card footer:columns", "saffron light", "Lora/DM Sans", "soft compact rich", "kraft-paper textures, ribbon accents and handwritten tags on a warm palette; personal, gift-message oriented"),
    a("gift-studio-floral", "Studio floral art", "a dark moody floral still life presented like an art gallery with minimal text", "full-bleed", "gallery about services proof",
      "gallery:filmstrip about:pull-quote services:magazine proof:clients-strip trust:strip faq:accordion visit:address-poster cta:wide-band footer:big-wordmark", "noir dark", "Instrument Serif/Inter", "sharp airy rich", "dark background, vivid flowers, thin uppercase sans and generous spacing; artistic and sparse"),
    a("gift-wedding-decor", "Wedding and event decor", "a wide mandap or table set-up photograph with a 'plan your event' button", "glass-card", "about gallery process proof",
      "about:overlap-card gallery:mosaic process:timeline-h proof:testimonial-carousel services:feature-cards trust:icon-row faq:numbered-accordion visit:split cta:band footer:mega", "gold light luxe", "Playfair Display/Mukta", "soft airy rich", "ivory, gold and sage, layered images, a step timeline and testimonials with venue names; a reassuring planner's voice"),
    a("gift-corporate-catalogue", "Corporate gifting catalogue", "clean product rows for bulk gifts with minimum quantity and branding options", "editorial-marquee", "services gallery trust process",
      "services:price-list gallery:lightbox-grid trust:counters process:numbered-list proof:clients-strip faq:accordion visit:split cta:split-qr footer:columns", "steel light", "Space Grotesk/Inter", "sharp compact subtle", "neutral and grid-driven, price per unit, logo-print callouts; professional, specific about quantities and lead time"),
  ],
  grocery: [
    a("groc-market-board", "The fresh market board", "a colourful produce wall with a 'fresh today' strip and a pincode delivery check", "mosaic", "trust services gallery process",
      "trust:ticker services:category-tabs gallery:bento process:steps proof:cards about:story-columns faq:two-column visit:map-hours cta:sticky-ribbon footer:link-grid", "emerald light", "Bricolage Grotesque/Mukta", "pill compact rich", "leaf green and warm yellow, rounded category chips, price-per-kg tags and big tap targets; practical and reassuring: sourced today, home delivery"),
    a("groc-neighbourhood", "The neighbourhood store", "the shopfront with the owner's name and years in the area, and 'send your list on WhatsApp'", "centered-minimal", "about services trust proof",
      "about:owner-card services:grid trust:strip proof:testimonial-carousel gallery:masonry faq:accordion visit:split cta:floating-card footer:minimal", "cocoa light", "Lora/Mukta", "soft airy subtle", "warm paper tones, a serif headline, a handwritten-list motif; personal, first-name familiarity, honest prices"),
    a("groc-organic-source", "Organic provenance", "one product (a jar of dal or oil) on a neutral ground with the farm named", "split-frame", "about process services gallery",
      "about:editorial-split process:timeline-h services:magazine gallery:filmstrip proof:cards trust:icon-row faq:numbered-accordion visit:address-poster cta:band footer:columns", "ivory light", "Newsreader/Inter", "sharp airy subtle", "muted earth palette, a light sans, generous space, origin tags; transparent about the source, ingredients and tests (only as told)"),
    a("groc-ration-plans", "Monthly ration plans", "three plan cards (family, couple, bulk) with a sample basket for each", "diagonal", "services process trust faq",
      "services:tiers process:numbered-list trust:split-cards faq:two-column proof:cards gallery:bento visit:split cta:wide-band footer:link-grid", "ocean light", "Manrope/Inter", "soft compact subtle", "pricing-table layout with tick lists, calm blues and greens and a clear savings figure; dependable, no hype"),
    a("groc-category-grid", "The aisle directory", "a dense grid of aisle tiles with images, like a store directory", "glass-card", "services gallery trust visit",
      "services:magazine gallery:lightbox-grid trust:icon-row proof:star-summary process:icon-cards faq:searchable visit:split cta:band footer:mega", "teal light", "Space Grotesk/Inter", "sharp compact subtle", "flat white, a strong sans, coloured aisle labels and tight spacing; short, scannable, brand names visible"),
    a("groc-festive-hamper", "The festive hamper shop", "a gift-hamper hero before the festival with a 'build your hamper' card", "stacked-poster", "services gallery process proof",
      "services:feature-cards gallery:mosaic process:icon-cards proof:review-wall about:photo-collage trust:ticker faq:chat-bubble visit:map-hours cta:floating-card footer:big-wordmark", "crimson dark", "DM Serif Display/Mukta", "soft compact rich", "red, gold, ribbons and box motifs; seasonal and swappable; celebratory, gifting-focused"),
  ],
  wholesale: [
    a("whole-ledger", "The catalogue ledger", "a firm name with a one-line promise ('stock ready, billed same day') and a neat rate-card preview in place of a big photo", "masthead", "services trust gallery proof",
      "services:price-list trust:strip gallery:lightbox-grid proof:cards about:story-columns faq:accordion visit:split cta:band footer:columns", "steel light", "Newsreader/Inter", "sharp compact subtle", "serif headline, mono-style numerals for rates, hairline rules, off-white paper with one ink colour; plain, numeric, trader-to-trader: MOQ, credit days (only as told)"),
    a("whole-godown", "The godown wide-shot", "a full-bleed photograph of the warehouse racks with a big stock-count figure laid over it", "full-bleed", "trust about gallery services",
      "trust:counters about:story-columns gallery:filmstrip services:magazine process:timeline-h faq:two-column visit:map-hours cta:wide-band footer:big-wordmark", "steel dark", "Bricolage Grotesque/Inter", "sharp compact rich", "heavy grotesque, dark slate with one warm accent, large numerals and edge-to-edge photographs; confident talk of scale (volumes and cities, only as told)"),
    a("whole-brand-wall", "Brands we carry", "the hero is a grid of the brands stocked: the portfolio is the authority", "mosaic", "gallery trust services proof",
      "gallery:bento trust:icon-row services:category-tabs proof:clients-strip about:story-columns faq:numbered-accordion visit:split cta:band footer:link-grid", "ocean light", "DM Sans/Inter", "soft compact subtle", "neutral white, logo-grid first, subtle shadows, rounded tiles, one trust blue; authorised-dealer, genuine stock (only the brands the owner sells)"),
    a("whole-dispatch", "The dispatch timeline", "the promise on the left and a vertical 'order to doorstep' timeline on the right", "split-frame", "process services trust gallery",
      "process:timeline-h services:grid trust:split-cards gallery:masonry proof:cards faq:accordion visit:hours-timeline cta:sticky-ribbon footer:columns", "teal light", "Manrope/Inter", "pill compact subtle", "geometric sans, a green route-line motif, numbered steps on a light grey canvas; reassuring and operational: ordering, billing and delivery"),
    a("whole-bazaar-story", "The founder's bazaar story", "a portrait of the owner in the shop with a pull quote about the family business and the years in the market", "diagonal", "about proof gallery services",
      "about:owner-card proof:testimonial-carousel gallery:mosaic services:feature-cards trust:strip faq:two-column visit:address-poster cta:floating-card footer:minimal", "cocoa light", "Fraunces/Mukta", "soft airy subtle", "warm cream, a serif display with a humanist sans, a terracotta accent, slightly rounded photographs; rooted in the local market"),
    a("whole-rate-desk", "The quote desk", "a compact hero with a 'request rates' card (product, quantity, city) fixed beside the words", "glass-card", "services process trust faq",
      "services:category-tabs process:steps trust:icon-row faq:searchable proof:star-summary gallery:lightbox-grid visit:split cta:sticky-ribbon footer:mega", "midnight light", "Space Grotesk/Inter", "soft compact rich", "clean SaaS-like sans, navy and white, card-based, a sticky call bar on the phone; fast and transactional, WhatsApp-first"),
  ],
  industry: [
    a("ind-shopfloor", "The shop-floor documentary", "a full-bleed photograph of real machines and workers with one long mission sentence, no carousel", "full-bleed", "about process gallery trust",
      "about:editorial-split process:timeline-h gallery:filmstrip trust:counters proof:cards services:magazine faq:accordion visit:address-poster cta:wide-band footer:big-wordmark", "steel dark", "Bricolage Grotesque/Inter", "sharp compact subtle", "condensed bold sans, graphite and steel blue, black-and-white photographs with one colour accent, hard edges; engineering-calm: capacity and tolerances as told"),
    a("ind-capability-matrix", "The capability matrix", "a grid of machine capabilities (CNC, press, casting) as numbered tiles that also navigate", "mosaic", "services process trust gallery",
      "services:magazine process:steps trust:split-cards gallery:bento proof:clients-strip about:numbers-led faq:numbered-accordion visit:split cta:band footer:link-grid", "midnight dark", "Space Grotesk/DM Sans", "sharp compact rich", "a technical grotesque, blueprint-like thin lines, dark navy with cyan, small-caps labels; spec-led and precise: the buyer is a procurement engineer"),
    a("ind-numbers-first", "Numbers first", "an oversized statistics band as the hero (years, units a month, export countries) with a small line under it", "editorial-marquee", "trust about services gallery",
      "trust:counters about:numbers-led services:price-list gallery:masonry proof:results-band process:numbered-list faq:two-column visit:map-hours cta:split-qr footer:columns", "ivory light", "Space Grotesk/Inter", "sharp airy subtle", "huge numerals, white and black with one orange, a tight grid and rectangle buttons; proof-heavy and short; figures only as told"),
    a("ind-raw-to-finished", "Raw to finished", "a vertical story from raw material to packed product, each step a full-width image with a number", "video-first", "process gallery about trust",
      "process:numbered-list gallery:mosaic about:story-columns trust:strip services:feature-cards proof:cards faq:accordion visit:address-poster cta:band footer:minimal", "cocoa light", "Newsreader/Inter", "soft airy subtle", "serif headlines on photographic panels, an earthy palette that matches the material, thin captions; a craft and quality-control narrative"),
    a("ind-export-sheet", "The export spec sheet", "a document-like hero: a company profile card with a certifications row and a Download catalogue / Get quote pair", "split-frame", "trust services gallery process",
      "trust:icon-row services:tiers gallery:lightbox-grid process:steps proof:clients-strip about:story-columns faq:searchable visit:split cta:floating-card footer:mega", "ocean light", "Inter/Inter", "sharp compact subtle", "neutral sans, light grey, a certification badge row and tables for specs, a restrained blue; formal and diligence-oriented (ISO, MOQ and lead time only as told)"),
    a("ind-heritage-timeline", "The heritage works", "the founding year in giant type with a horizontal timeline of milestones beneath", "masthead", "about proof process gallery",
      "about:year-timeline proof:clients-strip process:timeline-h gallery:filmstrip trust:counters services:price-list faq:numbered-accordion visit:address-poster cta:wide-band footer:big-wordmark", "emerald dark", "Playfair Display/Inter", "sharp airy subtle", "slab or classic serif, deep green or maroon, sepia-leaning photographs and ornamental dividers; proud, generational, understated"),
  ],
  buildmat: [
    a("bm-project-showcase", "Project showcase first", "a large photograph of a finished site with the materials used as small tags below it", "full-bleed", "gallery services trust process",
      "gallery:masonry services:feature-cards trust:counters process:timeline-h proof:cards about:story-columns faq:accordion visit:map-hours cta:wide-band footer:big-wordmark", "steel light", "Bricolage Grotesque/Inter", "sharp airy subtle", "a strong sans, concrete grey and one brick accent, big image cards with captions; builder-to-builder: where it was used, delivered on time"),
    a("bm-service-grid", "The service-action grid", "a row of six action tiles (get an estimate, site visit, delivery, bulk rate) right under a short headline", "mosaic", "services process gallery proof",
      "services:grid process:icon-cards gallery:bento proof:review-wall trust:icon-row about:story-columns faq:chat-bubble visit:split cta:sticky-ribbon footer:link-grid", "crimson light", "Manrope/Inter", "pill compact rich", "a friendly rounded sans with icons, a bright primary on white, 16px cards; helpful and practical: what you can do right now"),
    a("bm-swatch-wall", "The material swatch wall", "a mosaic of material swatches (tiles, laminates, handles) that enlarge on tap, the headline small", "editorial-marquee", "gallery about services trust",
      "gallery:mosaic about:photo-collage services:magazine trust:strip proof:clients-strip faq:two-column visit:address-poster cta:band footer:minimal", "pearl light", "Instrument Serif/DM Sans", "sharp airy subtle", "a minimal neutral ground so the materials carry the colour, a thin elegant sans, tiny labels; design-aware, tactile words: finish, grain, texture"),
    a("bm-contractor-counter", "The contractor trade counter", "a dark utilitarian hero: 'trade prices, site delivery' and a phone / WhatsApp block as the action", "diagonal", "trust services process proof",
      "trust:split-cards services:price-list process:steps proof:star-summary gallery:lightbox-grid about:story-columns faq:accordion visit:split cta:sticky-ribbon footer:mega", "noir dark", "Space Grotesk/Inter", "sharp compact rich", "black and safety orange, a heavy sans, a sticky call bar, high contrast, no decoration; direct site-language, quick turnaround"),
    a("bm-showroom-walk", "The showroom walk-through", "a wide showroom photograph with a numbered tour: floor one tiles, floor two sanitaryware", "split-frame", "about gallery services visit",
      "about:overlap-card gallery:filmstrip services:category-tabs trust:icon-row proof:testimonial-carousel faq:numbered-accordion visit:map-hours cta:floating-card footer:columns", "cocoa light", "DM Serif Display/Inter", "soft airy subtle", "warm stone neutrals, a serif display, thin lines, large imagery and soft shadows; inviting and visit-us focused"),
    a("bm-genuine-brands", "Genuine brands and warranty", "authorised-dealer status and the warranty promise first, then the brands by category", "glass-card", "trust services gallery proof",
      "trust:icon-row services:tiers gallery:bento proof:clients-strip about:numbers-led faq:searchable visit:split cta:band footer:link-grid", "ocean dark", "Manrope/Inter", "soft compact subtle", "deep blue with a clean white card system, brand logos in a neat strip; reassuring: genuine product, bill and warranty (only the brands and terms the owner gives)"),
  ],
  motors: [
    a("auto-heritage-ride", "The heritage ride", "a model-per-slide hero with Configure and Book a test ride, then the make's heritage as a timeline", "masthead", "services about gallery visit",
      "services:feature-cards about:year-timeline gallery:filmstrip trust:strip proof:cards faq:two-column visit:address-poster cta:wide-band footer:big-wordmark", "cocoa dark", "Playfair Display/Inter", "sharp airy rich", "heritage and culture rather than discounts; a dealer and service locator always in reach"),
    a("auto-spec-metrics", "The spec metrics", "headline numbers (range, power, price) with an inventory and a book-a-drive pair directly under the hero", "video-first", "trust services gallery proof",
      "trust:counters services:tiers gallery:bento proof:results-band process:steps about:story-columns faq:accordion visit:split cta:band footer:columns", "midnight dark", "Space Grotesk/DM Sans", "sharp compact rich", "price shown with confidence, the brand's mantra repeated, spec metrics as numbers; figures only as told"),
  ],
  homeservice: [
    a("svc-print-statement", "The bold statement", "a confident one-line personality, a dual call to action, benefit chips (free delivery, fast turnaround) and product tiles", "stacked-poster", "services trust gallery proof",
      "services:magazine trust:icon-row gallery:masonry proof:clients-strip process:icon-cards faq:chat-bubble visit:split cta:floating-card footer:mega", "royal dark", "Bricolage Grotesque/Inter", "pill compact rich", "a bold headline, three benefit chips, free samples or proofs as the lead magnet, a customer-logo row (only as told)"),
  ],
};

/** The engine's first set and the researched one, merged by trade group (a group in only one of them is kept as it is). */
function mergeGroups(...sets: Record<string, Archetype[]>[]): Record<string, Archetype[]> {
  const out: Record<string, Archetype[]> = {};
  for (const set of sets) for (const [g, list] of Object.entries(set)) out[g] = [...(out[g] ?? []), ...list];
  return out;
}
export const ARCHETYPES_BY_GROUP: Record<string, Archetype[]> = mergeGroups(LIBRARY, RESEARCHED);

/* ================= what the card has: fit ================= */

/** What the card carries, in counts. The archetype follows the material: a shop with forty products is not a one-room clinic,
 *  and a photo-led hero on a card with no picture is a blank slab. The engine builds one from its richer Signals (same fields). */
export type Fit = { cover: boolean; products: number; productPhotos: number; gallery: number; reviews: number; story: number; address: boolean; hours: boolean };

/** Reads the same blocks the renderer does (hidden pages and empty blocks left out), so it never counts what will not be drawn. */
export function fitOf(card: Card): Fit {
  const blocks: CardBlock[] = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).filter((b) => !isEmptyBlock(b));
  const of = <K extends CardBlock["kind"]>(kind: K) => blocks.filter((b): b is Extract<CardBlock, { kind: K }> => b.kind === kind);
  const products = of("product").flatMap((b) => b.items);
  return {
    cover: !!card.coverUrl,
    products: products.length,
    productPhotos: products.filter((p) => p.imageUrl || (p.images ?? []).length).length,
    gallery: of("gallery").reduce((s, b) => s + b.images.filter((i) => i.url).length, 0),
    reviews: of("testimonials").reduce((s, b) => s + b.items.filter((x) => (x.text ?? "").trim()).length, 0),
    story: of("about").reduce((s, b) => s + (b.body ?? "").length, 0),
    address: of("location").some((b) => !!(b.address ?? "").trim()),
    hours: of("hours").length > 0,
  };
}

/** Heroes that need a photograph to look right. */
export const PHOTO_HEROES: ReadonlySet<string> = new Set(["full-bleed", "glass-card", "video-first", "diagonal"]);
/** Heroes that stand on type alone: what a card with no banner gets. */
export const TEXT_HEROES: readonly string[] = ["editorial-marquee", "masthead", "centered-minimal", "stacked-poster", "split-frame", "mosaic"];
const PHOTO_SERVICES = new Set(["magazine", "scroller", "feature-cards"]);

/** How well an archetype suits what the card has: negative = a lead the card cannot carry, positive = the card has plenty for it.
 *  A score, not a gate: the guard below repairs what is left. */
export function fitScore(arch: Archetype, fit: Fit): number {
  let s = 0;
  const at = (k: string) => { const i = arch.lead.indexOf(k); return i < 0 ? 9 : i; };
  if (!fit.cover && PHOTO_HEROES.has(arch.hero)) s -= 3;
  if (fit.productPhotos === 0 && PHOTO_SERVICES.has(arch.sections.services ?? "")) s -= 2;
  if (fit.products < 3 && arch.sections.services === "tiers") s -= 2;
  if (fit.gallery < 3 && at("gallery") < 2) s -= 2;
  if (fit.reviews < 2 && at("proof") < 2) s -= 2;
  if (fit.story < 120 && at("about") < 2) s -= 1;
  if (fit.products >= 5 && at("services") < 2) s += 1;
  if (fit.gallery >= 6 && at("gallery") < 2) s += 1;
  if (fit.reviews >= 3 && at("proof") < 3) s += 1;
  if (fit.story > 280 && at("about") < 2) s += 1;
  if (fit.address && fit.hours && at("visit") < 3) s += 1;
  return s;
}

/** Content guards on a spec: the things a variant cannot carry for THIS card (no photo for a photo hero, no pictures for a
 *  photo-led catalogue, two items for a comparison). The seed picks the stand-in so the guard does not make everyone alike. */
export function guardByFit(spec: AdvancedSpec, fit: Fit, seed: string): AdvancedSpec {
  const r = rng(`${seed}|guard`);
  const out: AdvancedSpec = { ...spec, sections: { ...spec.sections }, palette: { ...spec.palette } };
  if (!fit.cover && PHOTO_HEROES.has(out.hero)) out.hero = TEXT_HEROES[Math.floor(r() * TEXT_HEROES.length)] as AdvancedSpec["hero"];
  const svc = variantOf(out, "services");
  if (PHOTO_SERVICES.has(svc) && fit.productPhotos === 0) (out.sections as Record<string, string>).services = "price-list";
  if (svc === "tiers" && fit.products < 2) (out.sections as Record<string, string>).services = "grid";
  return out;
}

/** The ids this card CAN carry (the same rules as guardByFit), so the uniqueness pass below never moves a slot onto a variant the
 *  guard just took away (a photo hero for a card with no banner, a photo-led catalogue with no product pictures, tiers of one). */
export function allowedByFit(fit: Fit): (key: string, id: string) => boolean {
  return (key, id) =>
    !(key === "hero" && !fit.cover && PHOTO_HEROES.has(id)) &&
    !(key === "services" && fit.productPhotos === 0 && PHOTO_SERVICES.has(id)) &&
    !(key === "services" && id === "tiers" && fit.products < 2);
}

/* ================= lookups ================= */

/** The group a poster-categories key belongs to ("sweets" -> "sweets", an unknown key -> "general"). */
export function groupOf(categoryKey: string | undefined | null): string {
  return TRADE_GROUP[(categoryKey ?? "").trim().toLowerCase()] ?? "general";
}
export const groupInfo = (key: string): TradeGroup => GROUPS.find((g) => g.key === key) ?? GROUPS[GROUPS.length - 1];

/** All archetypes of a trade. Never empty (falls back to "general"). */
export function archetypesFor(categoryKey: string | undefined | null): Archetype[] {
  return ARCHETYPES_BY_GROUP[groupOf(categoryKey)] ?? ARCHETYPES_BY_GROUP.general;
}

/** The weight an archetype gets in a seeded draw: 1 for a neutral fit, up to ~2.5 for a good one, never below 0.15 (a poor fit is rare, not impossible). */
const weightOf = (arch: Archetype, fit?: Fit) => (fit ? Math.max(0.15, 1 + fitScore(arch, fit) * 0.5) : 1);

/** `list` in a seeded order where better fits come earlier but any can lead (weighted random sampling: key = u^(1/w)). */
function seededOrder(list: Archetype[], r: () => number, fit?: Fit): Archetype[] {
  return list.map((x) => ({ x, k: Math.pow(r(), 1 / weightOf(x, fit)) })).sort((p, q) => q.k - p.k).map((p) => p.x);
}

/** The one archetype of the trade this business starts from (the no-AI path): weighted by what the card has. */
export function pickArchetype(categoryKey: string | undefined | null, seed: string, fit?: Fit): Archetype {
  return seededOrder(archetypesFor(categoryKey), rng(`${seed}|pick`), fit)[0];
}

/** `n` archetypes of the trade, rotated by the business's seed: two businesses of one trade are shown different starting
 *  points (the first is the AI's strongest hint), and the same business always gets the same ones. With a `fit`, the ones that
 *  suit what the card has come first more often. Another trade's archetypes are mixed in as the last slot so a "crossing" idea
 *  is possible. */
export function candidatesFor(categoryKey: string | undefined | null, seed: string, n = 3, fit?: Fit): Archetype[] {
  const r = rng(`${seed}|cand`);
  const out = seededOrder(archetypesFor(categoryKey), r, fit).slice(0, Math.max(1, n - 1));
  // One from a different group, for contrast.
  const others = Object.entries(ARCHETYPES_BY_GROUP).filter(([g]) => g !== groupOf(categoryKey)).flatMap(([, list]) => list);
  if (others.length && n > 1) out.push(others[Math.floor(r() * others.length)]);
  return out;
}

/** An archetype as a raw spec object, for validateSpec (the no-AI path and the baseline the AI is told about). The sections the
 *  archetype does not name are drawn from the seed instead of all falling to each section's first variant, so two businesses
 *  on one archetype still differ in their FAQ, timings, closing band and footer. */
export function archetypeSpec(arch: Archetype, seed: string): unknown {
  const r = rng(`${seed}|fill`);
  const sections: Record<string, string> = { ...arch.sections };
  for (const k of SECTION_KEYS) {
    if (k === "hero" || sections[k]) continue;
    const ids = VARIANT_IDS[k];
    sections[k] = ids[Math.floor(r() * ids.length)];
  }
  return {
    v: 1, seed, archetype: arch.name.toLowerCase().slice(0, 40), palette: { ...arch.palette }, fonts: { ...arch.fonts },
    shape: arch.shape, density: arch.density, hero: arch.hero, order: ["hero", ...arch.lead, ...DEFAULT_ORDER.filter((k) => !arch.lead.includes(k) && k !== "hero" && k !== "footer"), "footer"],
    sections, motion: arch.motion, notes: `${arch.name}: ${arch.idea}`,
  };
}

/* ================= the no-AI spec ================= */

const pickOf = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

/** The no-AI spec: one premium composition of THIS trade (chosen by the seed, leaning to what the card has), then varied so two
 *  businesses on the same archetype still differ: the business's own colour about half the time, another face of the same kind,
 *  corners / density / motion nudged, one or two section variants redrawn, two neighbouring sections swapped. The same card always
 *  gives the same spec; the seed is name + trade + username. */
export function specFromSeed(card: Card): AdvancedSpec {
  const cat = card.seo?.categoryKey ?? "";
  const name = (card.company || card.name || "").trim().toLowerCase();
  const seed = `${name}|${cat}|${card.username ?? ""}`;
  const fit = fitOf(card);
  const arch = pickArchetype(cat, seed, fit);
  const r = rng(`${seed}|vary`);
  const mood = tradeMood(cat);
  const base = archetypeSpec(arch, seed) as {
    palette: { key: string; tone: "light" | "dark"; luxe?: boolean }; fonts: { heading: string; body: string };
    shape: string; density: string; motion: string; hero: string; order: SectionKey[]; sections: Record<string, string>; notes: string; archetype: string;
  };

  // Colour: the business's own about half the time (it is theirs), else the archetype's palette, else another of the mood.
  const named = SITE_PALETTES.filter((x) => x.key !== "brand" && (mood.luxe ? ["gold", "noir", "ivory", "cocoa", "crimson", "midnight"].includes(x.key) : x.key !== "ivory" && x.key !== "pearl"));
  const roll = r();
  const palette = { ...base.palette };
  if (!arch.palette.luxe && card.themeColor && roll < 0.45) palette.key = "brand";
  else if (roll > 0.8) palette.key = pickOf(r, named).key;

  // Type: the archetype's heading about two thirds of the time, else another face of the same kind; a Hindi-first card reads in Mukta.
  const kind = ADV_FONTS[base.fonts.heading]?.kind === "sans" ? SANS_HEADINGS : SERIF_HEADINGS;
  const fonts = { heading: r() < 0.65 ? base.fonts.heading : pickOf(r, kind), body: card.language === "hi" ? "Mukta" : base.fonts.body };

  const shape = r() < 0.7 ? base.shape : pickOf(r, mood.luxe ? ["sharp", "soft"] : SHAPES);
  const density = r() < 0.75 ? base.density : pickOf(r, DENSITIES);
  const motion = r() < 0.8 ? base.motion : pickOf(r, ["subtle", "rich"]);

  // Layout: redraw one or two of the six content sections, and swap two sections the archetype did not lead with.
  const sections = { ...base.sections };
  // 15-Oct-2026 review: with 6 archetypes in a trade and only 1-2 sections redrawn, 5-6% of same-trade pairs were within two of eight
  // layout slots (one pair identical); two or three redraws plus an occasional other hero brings that to a few in a hundred.
  const redraw = ["trust", "about", "services", "gallery", "proof", "process"].sort(() => r() - 0.5).slice(0, r() < 0.5 ? 2 : 3);
  for (const k of redraw) sections[k] = pickOf(r, VARIANT_IDS[k as SectionKey]);
  const hero = r() < 0.3 ? pickOf(r, HERO_IDS) : base.hero;
  const order = [...base.order];
  const tail = 1 + arch.lead.length;
  if (order.length - 1 - tail >= 2 && r() < 0.6) { const i = tail + Math.floor(r() * (order.length - 2 - tail)); [order[i], order[i + 1]] = [order[i + 1], order[i]]; }

  const spec = validateSpec({
    v: 1, seed, archetype: base.archetype, palette, fonts, shape, density, hero, order, sections, motion,
    notes: `Library design "${arch.name}" (no AI): ${arch.idea}.`,
  }, seed);
  const guarded = guardByFit(spec, fit, seed);
  if (LIGHT_ONLY.has(guarded.palette.key)) guarded.palette.tone = "light";
  return guarded;
}
const LIGHT_ONLY = new Set(["ivory", "pearl"]);

/** A one-line description of an archetype for the designer's prompt. */
export function describeArchetype(arch: Archetype): string {
  const secs = Object.entries(arch.sections).map(([k, v]) => `${k}=${v}`).join(", ");
  return `${arch.id} "${arch.name}" - ${arch.idea}. hero=${arch.hero}; order after hero: ${arch.lead.join(" > ")}; ${secs}; palette ${arch.palette.key}/${arch.palette.tone}${arch.palette.luxe ? "/luxe" : ""}; fonts ${arch.fonts.heading} + ${arch.fonts.body}; ${arch.shape} corners, ${arch.density}, motion ${arch.motion}. Direction: ${arch.notes}`;
}

/* ================= uniqueness: no two businesses share a layout ================= */

/** The slots that make a LAYOUT (not colours or fonts): the hero, each section's variant, and the order. */
const LAYOUT_KEYS = ["hero", "trust", "about", "services", "gallery", "proof", "process"] as const;
export function layoutSlots(spec: AdvancedSpec): string[] {
  return [...LAYOUT_KEYS.map((k) => variantOf(spec, k)), spec.order.join(">")];
}
/** How many of the 8 layout slots differ (0 = the same layout, 8 = nothing in common). */
export function layoutDistance(a: AdvancedSpec, b: AdvancedSpec): number {
  const x = layoutSlots(a), y = layoutSlots(b);
  return x.reduce((n, v, i) => n + (v === y[i] ? 0 : 1), 0);
}

/** Nudge `spec` until its layout is at least `minDistance` slots away from every spec in `others` (the other
 *  businesses of the trade, and this business's own earlier design). Deterministic for one seed; only the layout slots
 *  move - the palette, faces, corners and the designer's reasoning stay. `allow` names the ids the card can carry (allowedByFit).
 *  Gives up quietly after a bounded number of tries. */
export function diversify(spec: AdvancedSpec, seed: string, others: AdvancedSpec[], minDistance = 4, allow?: (key: string, id: string) => boolean): AdvancedSpec {
  const r = rng(`${seed}|diversify`);
  const cur: AdvancedSpec = { ...spec, sections: { ...spec.sections }, order: [...spec.order] };
  for (let tries = 0; tries < 40; tries++) {
    let near: AdvancedSpec | null = null, nearD = minDistance;
    for (const o of others) { const d = layoutDistance(cur, o); if (d < nearD) { near = o; nearD = d; } }
    if (!near) return cur;
    // Move one slot where we and the nearest neighbour agree.
    const same = LAYOUT_KEYS.filter((k) => variantOf(cur, k) === variantOf(near!, k));
    const orderSame = cur.order.join(">") === near.order.join(">");
    const pickOrder = orderSame && (same.length === 0 || r() < 0.25);
    if (pickOrder) {
      // Swap two neighbouring middle sections.
      const mid = cur.order.slice(1, -1);
      const i = Math.floor(r() * (mid.length - 1));
      [mid[i], mid[i + 1]] = [mid[i + 1], mid[i]];
      cur.order = ["hero", ...mid, "footer"] as SectionKey[];
      continue;
    }
    const k = same.length ? same[Math.floor(r() * same.length)] : LAYOUT_KEYS[Math.floor(r() * LAYOUT_KEYS.length)];
    const ids = (k === "hero" ? HERO_IDS : VARIANT_IDS[k]).filter((id) => id !== variantOf(cur, k) && (!allow || allow(k, id)));
    if (!ids.length) continue;
    const id = ids[Math.floor(r() * ids.length)];
    if (k === "hero") cur.hero = id as AdvancedSpec["hero"]; else (cur.sections as Record<string, string>)[k] = id;
  }
  return cur;
}

/* ================= self-check ================= */

/** Every problem in the library: an id the renderer does not know, a palette or face that does not exist, an empty trade. Empty = fine.
 *  The engine's self-test runs this; a researcher adding lines can run it too. */
export function checkArchetypes(): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const g of GROUPS) if (!(ARCHETYPES_BY_GROUP[g.key]?.length >= 6)) bad.push(`group ${g.key}: fewer than 6 archetypes`);
  for (const [cat, g] of Object.entries(TRADE_GROUP)) if (!GROUPS.some((x) => x.key === g)) bad.push(`category ${cat} -> unknown group ${g}`);
  for (const [g, list] of Object.entries(ARCHETYPES_BY_GROUP)) {
    for (const x of list) {
      const w = `${g}/${x.id}`;
      if (seen.has(x.id)) bad.push(`${w}: duplicate id`);
      seen.add(x.id);
      if (!(HERO_IDS as readonly string[]).includes(x.hero)) bad.push(`${w}: hero ${x.hero}`);
      for (const k of x.lead) if (!(SECTION_KEYS as readonly string[]).includes(k) || k === "hero" || k === "footer") bad.push(`${w}: lead ${k}`);
      for (const [k, v] of Object.entries(x.sections)) if (!(SECTION_KEYS as readonly string[]).includes(k) || !(VARIANT_IDS[k as SectionKey] ?? []).includes(v)) bad.push(`${w}: section ${k}=${v}`);
      if (!PALETTE_KEYS.includes(x.palette.key)) bad.push(`${w}: palette ${x.palette.key}`);
      if (!ADV_FONTS[x.fonts.heading]) bad.push(`${w}: heading font ${x.fonts.heading}`);
      if (!(BODY_FONTS as readonly string[]).includes(x.fonts.body)) bad.push(`${w}: body font ${x.fonts.body}`);
      if (!["sharp", "soft", "pill"].includes(x.shape) || !["airy", "compact"].includes(x.density) || !["none", "subtle", "rich"].includes(x.motion)) bad.push(`${w}: shape/density/motion`);
      const v = validateSpec(archetypeSpec(x, "check"));
      if (v.hero !== x.hero) bad.push(`${w}: validateSpec changed the hero`);
    }
  }
  return bad;
}
