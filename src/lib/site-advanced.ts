// The ADVANCED website (the Rs 5,999 "Make advanced website" segment, owner 15-16 Oct 2026): a premium page whose
// LAYOUT is its own - not the same six blueprints with a new colour. A business's advanced site is described by one
// small, plain-data spec (`card.site.advanced`): which hero, which variant of every section, in what order, in which
// palette, fonts, corner shape and density. The AI designer writes the spec after reviewing the basic site; the
// renderer (src/components/site-adv) only ever reads it through validateSpec(), so a wrong or half-written spec can
// never crash the page - every unknown value is repaired to a safe default.
//
// specFromSeed() (site-advanced-archetypes.ts) is the no-AI fallback: it picks a trade archetype and varies it from a hash of the
// business (name + trade + username), so two businesses never land on the same layout even when the AI is off, slow or wrong.
//
// Pure module (no React, no fetch, no DOM): the renderer, the designer route and the preview all import it.
//
// HOW TO ADD A VARIANT: (1) append its id to the section's ID list below (the SLOT line), (2) write the component in
// src/components/site-adv/ and append it to the section's registry in registry.ts (the SLOT line there) - TypeScript
// refuses a registry that misses an id. The default for a section is the FIRST id of its list; never reorder old ids.
import type { Card, CardBlock, CardPage, ProductItem } from "./types";
import { isEmptyBlock } from "./site-home";
import { cardProducts, isProductSlug, productSlug } from "./product-page";
import { PALETTE_KEYS, SITE_PALETTES, brandPalette, FONT_METRICS, oklchVars, type SitePalette } from "./site-style";

/* ================= sections and their variants ================= */

/** Every section the advanced page can draw. `hero` is always first and `footer` always last (validateSpec). */
export const SECTION_KEYS = ["hero", "trust", "about", "services", "gallery", "proof", "process", "faq", "visit", "cta", "footer"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

// ---- variant ids: one list per section; the first is the default ----
export const HERO_IDS = [
  "split-frame",   // words on paper, a tall framed photo beside them, an offset block behind it
  "full-bleed",    // the photo edge to edge, words low over a scrim, a glass facts bar along the foot
  "editorial-marquee", // oversized type on paper, a slow ribbon of the card's facts, a wide photograph
  "glass-card",    // the photo edge to edge, the words on a frosted card, two figures beside it
  "stacked-poster", // centred words on the ink field, an arched photo rising from the bottom edge
  "mosaic",        // a bento of words, photos and figures that re-forms around what the card has
  "video-first",   // a headline row, then a rounded stage for the clip (the photo when there is no clip)
  "centered-minimal", // a small arch, the claim, two buttons, a ruled row, a great deal of air
  "diagonal",      // words left, the photo cut on a slant to the screen's edge
  "masthead",      // the business name as a magazine title, the claim as the cover line
  "kinetic-type",  // a giant headline with round photos set inside the sentence, a hollow ribbon behind it
  "pinned-story",  // a tall pinned stage: the claim, then the numbers, then the buttons, as you scroll
  "parallax-collage", // the headline in the middle of a layered, floating collage that follows the pointer
  "product-spotlight", // one product at a time on a round stage, cycling the catalogue with price and enquiry
  // SLOT hero ids (append here)
] as const;
export const TRUST_IDS = [
  "strip",         // the card's own numbers in one ruled row
  "counters",      // large counting numbers on the ink field
  "icon-row",      // a line icon per fact
  "ticker",        // a slim accent band that scrolls the facts
  "split-cards",   // a statement on the left, the facts as cards on the right
  "bento",        // one huge number on the accent field, the rest on ink and paper tiles
  "hairline",     // a ruled grid, each cell numbered, the figure large at its foot
  // SLOT trust ids (append here)
] as const;
export const ABOUT_IDS = [
  "story-columns", // a large statement on the left, the story in columns beside it, a small inset photo
  "overlap-card",  // a big photo with a text card overlapping it, the "good to know" list under the text
  "editorial-split", // a sticky title and the "good to know" list on the left, a large opening line, a wide photo and the story on the right
  "pull-quote",    // the opening sentence as a big centred pull-quote with a signature, the story in columns under it
  "year-timeline", // the years the owner mentions as a rail (else the paragraphs as chapters), a tall photo beside it
  "owner-card",    // "meet the owner": a portrait with a name plate, the opening line, the story, a message button
  "numbers-led",   // the card's own numbers set huge across the top, the statement and the story under them
  "photo-collage", // two or three of the business's photos overlapping, the story beside them
  "manifesto",    // the opening sentence at poster size across the full width, two photos offset around the story
  "chapters",     // the story as numbered chapters beside a sticky photo that changes with the chapter in view
  "founder-letter", // a portrait with a name plate beside the story set as a signed letter
  "banner-columns", // a wide photograph, a panel overlapping it with the title, the story and the numbered good-to-know list
  // SLOT about ids (append here)
] as const;
export const SERVICES_IDS = [
  "grid",          // products or services as a card grid (photo, name, price, ask on WhatsApp)
  "feature-cards", // large cards: photo, name, line, price, an ask button; the first one leads full width when the count is odd
  "price-list",    // a compact ruled list: small photo, name + line, price, a round ask button; the title sticks beside it
  "magazine",      // a four-column editorial grid, one 2x2 lead tile, captions over the photos
  "scroller",      // a horizontal scroll-snapping shelf with arrows and a progress hairline
  "category-tabs", // tabs from the owner's badges, else price bands, else "on offer" (no usable split -> no tabs)
  "menu-leaders",  // a printed menu: name ....... price with dotted leaders, in columns
  "tiers",         // comparison columns: price large, the line as ticks, the owner's badged tier lifted
  "index-rows",    // a numbered index: one big line per item, a tilted photo floats up beside the row under the pointer
  "listing-rows",  // full-width photo rows that alternate, a card with the name, price and buttons overlapping one side
  "shop-grid",     // a shop: search, filter chips, photo cards with a second photo on hover, badges, ask and share
  "rate-list",     // a ledger for traders: number, item and line, rate, an "ask rate" button; search from eight items
  // SLOT services ids (append here)
] as const;
export const GALLERY_IDS = [
  "mosaic",        // one large tile and a ring of small ones
  "masonry",       // staggered columns of tall and wide frames
  "filmstrip",     // one dark strip of large frames to swipe, arrows and a progress line
  "bento",         // one large frame and a ring of smaller ones, by how many photos there are
  "album-tabs",    // the owner's album headings as tabs (no headings: a plain grid)
  "lightbox-grid", // an even numbered grid, "+N more" on the last tile
  "scrapbook",    // taped, slightly tilted prints in staggered columns, each with its number and the owner's caption
  "rooms",        // a visible hairline grid, one big cell, every cell numbered with its caption under the photo
  "pinned-reel",  // the page pins and the photos slide sideways as you scroll (a swipe strip without scripting or with reduced motion)
  "stage",        // one large photo at a time with its caption, arrows and a rail of thumbnails
  // SLOT gallery ids (append here)
] as const;
export const PROOF_IDS = [
  "cards",         // up to three reviews as quote cards with the average on top
  "review-wall",   // a masonry of review cards, one in the ink field
  "testimonial-carousel", // one large quote at a time
  "star-summary",  // the average and a 5-to-1 breakdown beside a stack of review cards
  "results-band",  // ink band: the numbers behind the reviews, three short quotes under them
  "clients-strip", // the customers' names as a "trusted by" ribbon, then the best review
  "receipt",      // the reviews itemised on a paper till receipt, the average as the total
  "marquee-cards", // two rows of review cards drifting in opposite directions
  "spotlight",    // one review huge on the ink field, the other reviewers as a list to pick from
  // SLOT proof ids (append here)
] as const;
export const PROCESS_IDS = [
  "steps",         // numbered steps in a row
  "numbered-list", // big numerals and ruled rows, the title sticky beside them
  "timeline-h",    // a rail with numbered nodes, across on a wide screen and down on a phone
  "icon-cards",    // one card per step with an icon picked from what the step says
  "step-accordion", // steps that open one at a time
  "stack-cards",  // each step a tall card that sticks under the header while the next slides over it
  // SLOT process ids (append here)
] as const;
export const FAQ_IDS = [
  "accordion",     // questions that open
  "numbered-accordion", // a sticky title beside numbered questions that open one at a time
  "two-column",    // every answer in view, as two columns of cards
  "searchable",    // a search box over the questions; matches open and are marked (under four questions: a plain accordion)
  "chat-bubble",   // each question a message from the visitor, each answer a reply from the business
  "spotlight",     // the questions as a large list, the chosen answer set big on an accent card beside it
  // SLOT faq ids (append here)
] as const;
export const VISIT_IDS = [
  "split",         // address, buttons and timings beside a map link
  "map-hours",     // a drawn map card with the address under it, beside a timings table with today marked
  "hours-timeline", // the timings first, as a rail with today lit, and where to go beside it
  "address-poster", // the address set as a poster on the ink field, the timings as chips
  "branch-list",   // every location block as a ruled row with its own directions, the timings under them
  "contact-desk",  // the number set huge, a map card with directions, live timings, and a real enquiry form beside them
  // SLOT visit ids (append here)
] as const;
export const CTA_IDS = [
  "band",          // the closing ink band with the one primary button
  "wide-band",     // a full-bleed accent field, a very large line, the ways to reach in ruled rows
  "floating-card", // an accent card straddling the page and the footer, a photo beside the words
  "split-qr",      // words and buttons on one side, the site's QR on a card on the other
  "sticky-ribbon", // a closing block, and a slim ribbon that follows the visitor down a wide screen until it is reached
  "callback",      // a closing ink band with a short "call me back" form that sends a lead
  // SLOT cta ids (append here)
] as const;
export const FOOTER_IDS = [
  "columns",       // wordmark + blurb + QR, the ways to reach, the timings, then the copyright line
  "mega",          // brand + social + QR, quick links, contact, then address and timings
  "minimal",       // one quiet row of name, links and social, one line of contact and timings
  "big-wordmark",  // three compact columns, then the business's name as a very large mark
  "link-grid",     // the footer as a grid of tiles: links, ways to reach, the address, the timings
  "atelier",       // a ticker of what we sell, the name set very large in outline, then the columns
  "hotline",       // the phone number as the footer: set huge, with WhatsApp, directions and the timings
  // SLOT footer ids (append here)
] as const;

export type HeroVariantId = (typeof HERO_IDS)[number];
export type TrustVariantId = (typeof TRUST_IDS)[number];
export type AboutVariantId = (typeof ABOUT_IDS)[number];
export type ServicesVariantId = (typeof SERVICES_IDS)[number];
export type GalleryVariantId = (typeof GALLERY_IDS)[number];
export type ProofVariantId = (typeof PROOF_IDS)[number];
export type ProcessVariantId = (typeof PROCESS_IDS)[number];
export type FaqVariantId = (typeof FAQ_IDS)[number];
export type VisitVariantId = (typeof VISIT_IDS)[number];
export type CtaVariantId = (typeof CTA_IDS)[number];
export type FooterVariantId = (typeof FOOTER_IDS)[number];

/** The ids of every section, by key (hero included, for validation and the picker). */
export const VARIANT_IDS: { [K in SectionKey]: readonly string[] } = {
  hero: HERO_IDS, trust: TRUST_IDS, about: ABOUT_IDS, services: SERVICES_IDS, gallery: GALLERY_IDS,
  proof: PROOF_IDS, process: PROCESS_IDS, faq: FAQ_IDS, visit: VISIT_IDS, cta: CTA_IDS, footer: FOOTER_IDS,
};
/** Variant per section (the hero's is `spec.hero`, so it is not repeated here). */
export type SectionVariants = {
  trust?: TrustVariantId; about?: AboutVariantId; services?: ServicesVariantId; gallery?: GalleryVariantId; proof?: ProofVariantId;
  process?: ProcessVariantId; faq?: FaqVariantId; visit?: VisitVariantId; cta?: CtaVariantId; footer?: FooterVariantId;
};
export type VariantId = HeroVariantId | TrustVariantId | AboutVariantId | ServicesVariantId | GalleryVariantId | ProofVariantId | ProcessVariantId | FaqVariantId | VisitVariantId | CtaVariantId | FooterVariantId;

export const SHAPES = ["sharp", "soft", "pill"] as const;
export const DENSITIES = ["airy", "compact"] as const;
export const MOTIONS = ["none", "subtle", "rich"] as const;
export type Shape = (typeof SHAPES)[number];
export type Density = (typeof DENSITIES)[number];
export type Motion = (typeof MOTIONS)[number];

/* ================= fonts ================= */
// Only the self-hosted families (FONT_FACES in site-style.ts, public/fonts): a family outside this table would be a
// request to Google, a flash of fallback, and an unmeasured layout shift. `w` is the weight the heading is set at.

export type AdvFont = { kind: "serif" | "sans"; w: number };
export const ADV_FONTS: Record<string, AdvFont> = {
  "Instrument Serif": { kind: "serif", w: 400 },
  "Playfair Display": { kind: "serif", w: 500 },
  "Newsreader": { kind: "serif", w: 400 },
  "Fraunces": { kind: "serif", w: 500 },
  "DM Serif Display": { kind: "serif", w: 400 },
  "Lora": { kind: "serif", w: 500 },
  "Bricolage Grotesque": { kind: "sans", w: 700 },
  "Space Grotesk": { kind: "sans", w: 600 },
  "Manrope": { kind: "sans", w: 600 },
  "DM Sans": { kind: "sans", w: 500 },
  "Inter": { kind: "sans", w: 600 },
};
export const HEADING_FONTS = Object.keys(ADV_FONTS);
/** Plain names for the Premium tops (HERO_IDS), English and Hindi: the Premium page and Website edit → Look show the same words. */
export const ADV_HERO_NAMES: Record<string, [string, string]> = {
  "split-frame": ["Words + framed photo", "शब्द + फ्रेम में photo"], "full-bleed": ["Full photo", "पूरी photo"],
  "editorial-marquee": ["Big letters + moving line", "बड़े अक्षर + चलती पट्टी"], "glass-card": ["Photo + glass card", "Photo + शीशे का card"],
  "stacked-poster": ["Centre + arch photo", "बीच में + arch photo"], "mosaic": ["Mosaic", "Mosaic"], "video-first": ["Video first", "पहले video"],
  "centered-minimal": ["Calm, centred", "शांत, बीच में"], "diagonal": ["Slanted photo", "तिरछी photo"], "masthead": ["Magazine title", "Magazine जैसा"],
  "kinetic-type": ["Giant headline", "बहुत बड़ी headline"], "pinned-story": ["Scroll story", "Scroll कहानी"], "parallax-collage": ["Floating collage", "तैरती photos"],
  "product-spotlight": ["Product spotlight", "Product spotlight"],
};
export const SHAPE_NAMES: Record<string, [string, string]> = { sharp: ["Sharp", "शार्प"], soft: ["Soft", "सॉफ्ट"], pill: ["Round", "राउंड"] };

/** Faces that carry body text (400 + a bold). */
export const BODY_FONTS = ["Inter", "Manrope", "DM Sans", "Mukta"] as const;
export const SERIF_HEADINGS = HEADING_FONTS.filter((f) => ADV_FONTS[f].kind === "serif");
export const SANS_HEADINGS = HEADING_FONTS.filter((f) => ADV_FONTS[f].kind === "sans");

/* ================= the spec ================= */

export type AdvancedPalette = {
  /** A key of SITE_PALETTES ("midnight", "gold", …) or "brand" (built from `color`, else the card's colour). */
  key: string;
  /** #rrggbb, read only for "brand". */
  color?: string;
  /** The page itself: paper (light) or the ink field (dark). */
  tone: "light" | "dark";
  /** Ivory paper, espresso ink, a gold line (jewellers, bridal, hotels). */
  luxe?: boolean;
};

export type AdvancedSpec = {
  v: 1;
  /** What the layout was drawn from; the same seed + the same card gives the same fallback spec. */
  seed: string;
  /** A short name for the composition ("editorial", "catalogue", "walk-in", …) - free text, for humans and the AI. */
  archetype: string;
  palette: AdvancedPalette;
  fonts: { heading: string; body: string };
  shape: Shape;
  density: Density;
  hero: HeroVariantId;
  /** Top to bottom. Always starts with "hero", ends with "footer", names every section once. */
  order: SectionKey[];
  sections: SectionVariants;
  motion: Motion;
  /** The designer's one-paragraph reasoning ("why this layout for this business"); never shown to visitors. */
  notes: string;
};

/** The variant a section wears: the spec's choice, else the section's first id. */
export function variantOf<K extends SectionKey>(spec: AdvancedSpec, key: K): string {
  if (key === "hero") return spec.hero;
  return (spec.sections as Record<string, string | undefined>)[key] ?? VARIANT_IDS[key][0];
}

/* ================= validation: the AI's spec can never crash the page ================= */

const has = (list: readonly string[], v: unknown): v is string => typeof v === "string" && list.includes(v);
const pick = <T extends string>(list: readonly T[], v: unknown, dflt: T): T => (has(list, v) ? (v as T) : dflt);
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trimEnd() : "");
const hex6 = (v: unknown): string | undefined => {
  const m = /^#?([0-9a-f]{6})$/i.exec(typeof v === "string" ? v.trim() : "");
  return m ? `#${m[1].toLowerCase()}` : undefined;
};

/** The order the sections take when the spec says nothing (or something unusable). */
export const DEFAULT_ORDER: readonly SectionKey[] = ["hero", "trust", "about", "services", "gallery", "proof", "process", "faq", "visit", "cta", "footer"];

/** hero first, footer last, every section exactly once; unknown names and repeats are dropped, missing ones slot in before the footer
 *  at their default position relative to the sections that are there. */
export function repairOrder(raw: unknown): SectionKey[] {
  const given: SectionKey[] = [];
  if (Array.isArray(raw)) for (const k of raw) if (has(SECTION_KEYS, k) && k !== "hero" && k !== "footer" && !given.includes(k as SectionKey)) given.push(k as SectionKey);
  // A section the spec left out goes in after the section that precedes it in the default order.
  for (const k of DEFAULT_ORDER) {
    if (k === "hero" || k === "footer" || given.includes(k)) continue;
    let at = 0;
    for (let i = DEFAULT_ORDER.indexOf(k) - 1; i >= 0; i--) { const j = given.indexOf(DEFAULT_ORDER[i]); if (j >= 0) { at = j + 1; break; } }
    given.splice(at, 0, k);
  }
  return ["hero", ...given, "footer"];
}

/** A safe starting point for anything the input leaves out. */
export const SAFE_SPEC: AdvancedSpec = {
  v: 1, seed: "safe", archetype: "editorial",
  palette: { key: "brand", tone: "light" },
  fonts: { heading: "Newsreader", body: "Inter" },
  shape: "soft", density: "airy", hero: HERO_IDS[0], order: [...DEFAULT_ORDER], sections: {}, motion: "subtle", notes: "",
};

/** Any input -> a spec the renderer can draw. Never throws, never returns an unknown id, a missing section or a family that is
 *  not self-hosted. The caller passes a `seed` so a spec without one still gets a stable one. */
export function validateSpec(input: unknown, fallbackSeed = "adv"): AdvancedSpec {
  const o = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const pal = o.palette && typeof o.palette === "object" ? o.palette as Record<string, unknown> : {};
  const fonts = o.fonts && typeof o.fonts === "object" ? o.fonts as Record<string, unknown> : {};
  const secs = o.sections && typeof o.sections === "object" ? o.sections as Record<string, unknown> : {};
  const sections: Record<string, string> = {};
  for (const k of SECTION_KEYS) if (k !== "hero" && has(VARIANT_IDS[k], secs[k])) sections[k] = secs[k] as string;
  const key = typeof pal.key === "string" && PALETTE_KEYS.includes(pal.key) ? pal.key : SAFE_SPEC.palette.key;
  return {
    v: 1,
    seed: clean(o.seed, 80) || fallbackSeed,
    archetype: clean(o.archetype, 40) || SAFE_SPEC.archetype,
    palette: { key, ...(key === "brand" && hex6(pal.color) ? { color: hex6(pal.color) } : {}), tone: pal.tone === "dark" ? "dark" : "light", ...(pal.luxe === true ? { luxe: true } : {}) },
    fonts: {
      heading: has(HEADING_FONTS, fonts.heading) ? fonts.heading as string : SAFE_SPEC.fonts.heading,
      body: has(BODY_FONTS, fonts.body) ? fonts.body as string : SAFE_SPEC.fonts.body,
    },
    shape: pick(SHAPES, o.shape, SAFE_SPEC.shape),
    density: pick(DENSITIES, o.density, SAFE_SPEC.density),
    hero: pick(HERO_IDS, o.hero, HERO_IDS[0]),
    order: repairOrder(o.order),
    sections: sections as SectionVariants,
    motion: pick(MOTIONS, o.motion, SAFE_SPEC.motion),
    notes: clean(o.notes, 600),
  };
}

/** What `card.site.advanced` means for the renderer: null when the card has none (or it is not a v1 spec), else the
 *  repaired spec. The one gate the hook in site-view.tsx goes through. */
export function parseAdvanced(x: unknown, seed = "adv"): AdvancedSpec | null {
  if (!x || typeof x !== "object" || (x as { v?: unknown }).v !== 1) return null;
  return validateSpec(x, seed);
}

/** The spec the website DRAWS: `site.advanced` unless the owner switched it off (`site.advancedOn === false`: both designs stay stored
 *  and "switch back" flips the flag). A card saved before the flag existed has no `advancedOn` and counts as on. */
export function activeAdvanced(site: unknown, seed = "adv"): AdvancedSpec | null {
  const o = site && typeof site === "object" ? site as { advanced?: unknown; advancedOn?: unknown } : null;
  return o && o.advancedOn !== false ? parseAdvanced(o.advanced, seed) : null;
}

/* ================= seeded randomness ================= */
// The no-AI fallback (specFromSeed) lives in site-advanced-archetypes.ts: it draws from the trade's archetype library, which
// imports this module, so it cannot sit here without a cycle.

/** FNV-1a, 32 bit. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** mulberry32: a small seeded generator, so one seed always draws the same choices in the same order. */
export function rng(seed: string): () => number {
  let a = hash32(seed) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ================= the theme: spec -> CSS custom properties ================= */

const SANS_FB = `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const SERIF_FB = `Georgia, "Times New Roman", "Noto Serif", serif`;
const stackOf = (family: string, serif: boolean, deva: string) => `"${family}", ${FONT_METRICS[family] ? `"${family} Fallback", ` : ""}${deva}, ${serif ? SERIF_FB : SANS_FB}`;

/** Corner tokens by shape (the same four names the shared `.btn-*` and `.s-card` rules read). */
export const SHAPE_VARS: Record<Shape, string> = {
  sharp: "--r-ctl:2px;--r-card:4px;--r-tile:6px;--r-img:2px;--r-pill:2px",
  soft: "--r-ctl:12px;--r-card:18px;--r-tile:24px;--r-img:12px;--r-pill:999px",
  pill: "--r-ctl:999px;--r-card:28px;--r-tile:36px;--r-img:22px;--r-pill:999px",
};
/** Vertical rhythm by density. */
export const DENSITY_VARS: Record<Density, string> = {
  airy: "--section-pad:clamp(4.5rem,10vw,8.5rem);--gap:clamp(1.5rem,3vw,2.5rem)",
  compact: "--section-pad:clamp(2.75rem,6vw,4.75rem);--gap:clamp(1rem,2vw,1.5rem)",
};

/** The palette a spec means: a named one, or the "brand" palette built from the spec's colour, else the card's. Its `mid` is the
 *  hex the popups and the chat bubble (which sit outside the `.site` root) take as their theme colour. */
export function advancedPalette(card: Pick<Card, "themeColor">, spec: AdvancedSpec): SitePalette {
  const pal = spec.palette;
  return SITE_PALETTES.find((x) => x.key === pal.key && x.key !== "brand") ?? brandPalette(pal.color ?? hex6(card.themeColor) ?? "#0e9e90");
}

/** The `.site` root's custom properties for a spec: the OKLCH colour tokens of the shared design system (site-style.ts), the
 *  two chosen faces with their Devanagari companions, the corner and spacing tokens. */
export function advancedVars(card: Pick<Card, "themeColor">, spec: AdvancedSpec): string {
  const pal = spec.palette;
  const sp = advancedPalette(card, spec);
  const head = ADV_FONTS[spec.fonts.heading] ?? ADV_FONTS[SAFE_SPEC.fonts.heading];
  const serif = head.kind === "serif";
  const devaHead = serif ? `"Tiro Devanagari Hindi"` : `"Hind"`;
  return [
    oklchVars(sp.h, pal.tone, { c: sp.c, luxe: pal.luxe }),
    `--font-display:${stackOf(spec.fonts.heading, serif, devaHead)}`,
    // The Devanagari text face first: its files carry a unicode-range, so Latin falls straight through to the chosen body face.
    `--font-text:"Noto Sans Devanagari", ${stackOf(spec.fonts.body, false, `"Mukta"`)}`,
    `--look-head:var(--font-display)`, `--look-body:var(--font-text)`,
    `--display-w:${head.w}`, `--head-w:${head.w}`, `--display-w-hi:${serif ? 400 : 600}`, `--text-w:400`,
    `--display-lh:${serif ? 1 : .98}`, `--display-tr:${serif ? "-.02em" : "-.03em"}`,
    SHAPE_VARS[spec.shape], DENSITY_VARS[spec.density],
    // Legacy names a few shared pieces (the hero's photo, the chat bubble) still read.
    `--p-mid:${sp.mid}`, `--p-deep:${sp.deep}`, `--tc:${sp.mid}`,
  ].join(";");
}


/* ================= pages: the advanced site is a whole website, not one scroll (owner, 16 Oct 2026) ================= */
// The card's own pages differ by trade (products / menu / packages / services / visit / join...). The advanced site gives every
// page a ROLE from what it holds, draws it with the matching template (src/components/site-adv/pages.tsx), and adds the pages
// a website is expected to have when the card has the material but no page for it (About, Gallery). Everything here is pure, so
// the server (render.tsx: titles, descriptions, the address of each page) and the browser agree on the same list.

export type AdvPageRole = "home" | "catalogue" | "about" | "gallery" | "contact" | "faq" | "page";

/** A services block whose first item starts "1. " is the owner's steps ("how it works"), not an offering (content.ts says the same). */
const isStepsBlock = (b: Extract<CardBlock, { kind: "services" }>) => /^\s*1[.)]\s/.test(b.items[0]?.name ?? "");

/** What a page of the card is, from the blocks it carries: the slug alone cannot say ("visit" is a contact page, "menu" a catalogue). */
export function pageRole(card: Pick<Card, "pages">, p: CardPage): AdvPageRole {
  if (p === card.pages[0] || p.slug === "home") return "home";
  const bs = p.blocks.filter((b) => !isEmptyBlock(b));
  const kinds = new Set(bs.map((b) => b.kind));
  if (kinds.has("product") || bs.some((b) => b.kind === "services" && !isStepsBlock(b))) return "catalogue";
  if (kinds.has("contact") || kinds.has("location") || kinds.has("hours") || kinds.has("appointment") || kinds.has("form")) return "contact";
  const only = (...ks: CardBlock["kind"][]) => bs.length > 0 && bs.every((b) => ks.includes(b.kind));
  if (only("gallery", "image", "carousel")) return "gallery";
  if (only("about", "highlights") && kinds.has("about")) return "about";
  if (only("faq")) return "faq";
  return "page";
}

/** The pages of the card that are drawn at all: not hidden by the owner, not the Shubhora page, not empty (home always). */
export function livePages(card: Pick<Card, "pages" | "site">): CardPage[] {
  const hidden = new Set(card.site?.hidden ?? []);
  return card.pages.filter((p, i) => !p.hidden && !hidden.has(p.slug) && (i === 0 || p.slug === "home" || p.blocks.some((b) => !isEmptyBlock(b))));
}

/** Ids of pages made for the advanced site at request time (never stored on the card): `adv-` + a name. */
export const ADV_PAGE_PREFIX = "adv-";

const imagesOf = (b: CardBlock): { url: string; label: string; group?: string }[] =>
  b.kind === "gallery" ? b.images.filter((i) => i.url).map((i) => ({ url: i.url!, label: i.label ?? "", group: i.group }))
  : b.kind === "image" || b.kind === "carousel" ? b.images.filter((i) => i.url).map((i) => ({ url: i.url, label: i.caption ?? "" }))
  : [];

/** The card plus the pages a website has and the card does not: About (from the About block or the card's own text) and Gallery
 *  (from every photo block of the card, three or more). Each is a normal page, so titles, descriptions, links and the sitemap
 *  logic of the basic site work on it unchanged. Done at request time; a page the card already has, or the owner hid, is left alone. */
export function withAdvancedPages(card: Card): Card {
  const hidden = new Set(card.site?.hidden ?? []);
  const live = livePages(card);
  const roles = live.map((p) => pageRole(card, p));
  const hi = card.language === "hi";
  const extra: CardPage[] = [];
  const visible = card.pages.filter((p) => !p.hidden);
  const blocks = visible.flatMap((p) => p.blocks);
  const taken = new Set(card.pages.map((p) => p.slug));
  const aboutBlock = blocks.find((b): b is Extract<CardBlock, { kind: "about" }> => b.kind === "about" && !isEmptyBlock(b) && !!(b.body ?? "").trim());
  const aboutText = (aboutBlock?.body ?? card.about ?? "").trim();
  if (!roles.includes("about") && !hidden.has("about") && !taken.has("about") && aboutText) {
    extra.push({ id: `${ADV_PAGE_PREFIX}about`, slug: "about", label: hi ? "हमारे बारे में" : "About", blocks: [{ id: `${ADV_PAGE_PREFIX}about-b`, kind: "about", title: aboutBlock?.title || (hi ? "हमारी कहानी" : "Our story"), body: aboutText, ...(aboutBlock?.imageUrl ? { imageUrl: aboutBlock.imageUrl } : {}) }] });
  }
  if (!roles.includes("gallery") && !hidden.has("gallery") && !taken.has("gallery")) {
    const seen = new Set<string>();
    const imgs = blocks.flatMap(imagesOf).filter((i) => !seen.has(i.url) && !!seen.add(i.url));
    if (imgs.length >= 3) extra.push({ id: `${ADV_PAGE_PREFIX}gallery`, slug: "gallery", label: hi ? "फ़ोटो" : "Gallery", blocks: [{ id: `${ADV_PAGE_PREFIX}gallery-b`, kind: "gallery", title: hi ? "फ़ोटो गैलरी" : "Gallery", images: imgs.map((i) => ({ url: i.url, color: card.themeColor || "#999999", label: i.label, ...(i.group ? { group: i.group } : {}) })) }] });
  }
  return extra.length ? { ...card, pages: [...card.pages, ...extra] } : card;
}

/** Every product AND service of the site with the address it answers at. Products keep the address the basic site gave them
 *  (product-page.ts); a service ("Bridal makeup", "AC repair") gets one made the same way, so every item has a page of its own. */
export type AdvItem = { item: ProductItem; slug: string; page: string; kind: "product" | "service" };
export function advancedItems(card: Card): AdvItem[] {
  const hidden = new Set(card.site?.hidden ?? []);
  // Pages made for the request (`adv-…`, `prod-…`) never hold the owner's items.
  const real = card.pages.filter((p) => !p.id.startsWith(ADV_PAGE_PREFIX) && !p.id.startsWith("prod-"));
  const base = { ...card, pages: real };
  const out: AdvItem[] = cardProducts(base).filter((p) => (p.item.name ?? "").trim() && !hidden.has(p.page)).map((p) => ({ ...p, kind: "product" as const }));
  const used = new Set(out.map((o) => o.slug));
  for (const pg of real) {
    if (pg.hidden || hidden.has(pg.slug)) continue;
    for (const b of pg.blocks) {
      if (b.kind !== "services" || isStepsBlock(b)) continue;
      for (const s of b.items) {
        if (!(s.name ?? "").trim()) continue;
        let slug = productSlug(s.name, out.length);
        if (used.has(slug)) slug = `${slug}-${out.length + 1}`;
        used.add(slug);
        out.push({ item: { name: s.name.trim(), desc: (s.desc ?? "").trim() || undefined, features: [], specs: [] }, slug, page: pg.slug, kind: "service" });
      }
    }
  }
  return out;
}
export const findAdvancedItem = (card: Card, slug: string | null | undefined): AdvItem | null =>
  isProductSlug(slug) ? advancedItems(card).find((i) => i.slug === slug) ?? null : null;

/** One tiny hidden page per item (just its name): it lets the website's page switch (`go(slug)` in site-view.tsx) reach every
 *  item without a reload; the advanced renderer reads the item itself from advancedItems(). Pass these slugs as `unlisted`. */
export function advancedItemStubs(card: Card): CardPage[] {
  return advancedItems(card).map((i) => ({
    id: `${ADV_PAGE_PREFIX}item-${i.slug}`, slug: i.slug, label: i.item.name.slice(0, 40), hidden: true,
    blocks: [{ id: `${ADV_PAGE_PREFIX}item-b-${i.slug}`, kind: "product" as const, title: "", items: [{ name: i.item.name, features: [], specs: [] }] }],
  }));
}
