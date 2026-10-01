// The website's design system: palettes, font pairs, hero layouts and corner radii, resolved from `card.site.style`
// (the owner's choice in /poster/website/edit, or what a reference website suggested) with the card's own colour
// and look as the fallback — so a website that never chose anything still renders in its brand colour.
//
// Pure module (no React, no fetch, no DOM): used by the public website renderer, the website editor and the
// server (reference-website → style).
import type { Card, SiteStyle } from "./types";
import { luminance } from "./color";
import type { LookDef } from "./looks";

/* ================= colour maths ================= */

const hex6 = (c: unknown): string | null => {
  const v = typeof c === "string" ? c.trim() : "";
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (m) return `#${m[1].toLowerCase()}`;
  const s = /^#?([0-9a-f]{3})$/i.exec(v);
  return s ? `#${s[1].split("").map((x) => x + x).join("").toLowerCase()}` : null;
};
const rgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
/** `a` mixed towards `b` by t (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(hex6(a) ?? "#0e9e90"), y = rgb(hex6(b) ?? "#000000");
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
function toHsl(h: string): [number, number, number] {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/** Ink that stays readable on a solid fill of `hex`. */
export const inkOn = (hex: string) => (luminance(hex) > 0.42 ? "#101427" : "#ffffff");
/** A colour dark enough to carry white text (light brand colours are stepped down). */
function readable(hex: string): string {
  let h = hex6(hex) ?? "#0e9e90";
  for (let i = 0; i < 8 && luminance(h) > 0.3; i++) h = mixHex(h, "#000000", 0.1);
  return h;
}

/* ================= palettes ================= */

export type SitePalette = {
  key: string; name: string; hi: string;
  /** Hero and footer base. */ deep: string;
  /** Buttons, links, icons — the brand colour on light surfaces. */ mid: string;
  /** Second gradient stop. */ glow: string;
  /** Small text on the hero (eyebrow, pills): pale on dark palettes. */ accent: string;
  /** Eyebrows and rules on light surfaces (defaults to `mid`). */ mark?: string;
  /** Text on `deep`. */ ink: string;
  /** Footer base when `deep` is light. */ foot?: string;
  tone: "dark" | "light";
};

const P = (key: string, name: string, hi: string, deep: string, mid: string, glow: string, accent: string, extra: Partial<SitePalette> = {}): SitePalette =>
  ({ key, name, hi, deep, mid, glow, accent, ink: "#ffffff", tone: "dark", ...extra });

/** Hand-picked website palettes. "brand" is special: built from the card's colour (or `style.color`). */
export const SITE_PALETTES: SitePalette[] = [
  P("brand", "Your colour", "आपका रंग", "#0b1230", "#2f5bf5", "#6a3cf0", "#dbe4ff"),
  P("midnight", "Midnight", "मिडनाइट", "#0b1230", "#2f5bf5", "#6a3cf0", "#ffd166"),
  P("ocean", "Ocean", "ओशन", "#062a4a", "#0369a1", "#0ea5e9", "#a5f3fc"),
  P("teal", "Teal", "टील", "#042f2e", "#0f766e", "#0891b2", "#99f6e4"),
  P("emerald", "Emerald", "एमराल्ड", "#052e16", "#15803d", "#0d9488", "#bbf7d0"),
  P("royal", "Royal", "रॉयल", "#2a0d4d", "#7c3aed", "#db2777", "#f5d0fe"),
  P("rose", "Rose", "रोज़", "#4a0a1f", "#be123c", "#db2777", "#fecdd3"),
  P("crimson", "Crimson", "क्रिमसन", "#3f0a0a", "#b91c1c", "#f97316", "#fde68a"),
  P("saffron", "Saffron", "केसरिया", "#431407", "#ea580c", "#f59e0b", "#fff4b8"),
  P("gold", "Gold", "गोल्ड", "#2a1204", "#b45309", "#d97706", "#fde68a"),
  P("cocoa", "Cocoa", "कोको", "#1f1209", "#7c4a1e", "#b45309", "#f5d9b8"),
  P("steel", "Steel", "स्टील", "#0f172a", "#334155", "#2563eb", "#cbd5e1"),
  P("noir", "Noir", "नॉयर", "#0a0a0a", "#1f1f1f", "#3f3f46", "#d4af37", { mark: "#9a7b1c" }),
  P("ivory", "Ivory", "आइवरी", "#f6efe4", "#b45309", "#e2b07a", "#7c2d12", { ink: "#2f261d", foot: "#2f261d", tone: "light" }),
  P("pearl", "Pearl", "पर्ल", "#f3f6fc", "#1e3a8a", "#93c5fd", "#1e3a8a", { ink: "#0b1d4d", foot: "#0b1d4d", tone: "light" }),
];
export const PALETTE_KEYS = SITE_PALETTES.map((p) => p.key);

/** The "brand" palette for one colour: deep = the colour towards night, glow = a warmer, lighter neighbour. */
export function brandPalette(color: string): SitePalette {
  const mid = readable(color);
  const [h, s, l] = toHsl(mid);
  return {
    key: "brand", name: "Your colour", hi: "आपका रंग", tone: "dark", ink: "#ffffff",
    deep: mixHex(mid, "#0b1214", 0.62),
    mid,
    glow: fromHsl(h + 18, Math.min(1, s * 1.05), Math.min(0.62, l + 0.14)),
    accent: fromHsl(h + 24, Math.min(1, s), 0.86),
  };
}

/** The palette a card's website uses: the chosen key, else its brand colour. */
export function paletteFor(card: Pick<Card, "themeColor" | "site">): SitePalette {
  const st = card.site?.style;
  const own = SITE_PALETTES.find((p) => p.key === st?.palette && p.key !== "brand");
  if (own) return own;
  return brandPalette(hex6(st?.color) ?? hex6(card.themeColor) ?? "#0e9e90");
}

/** The named palette closest in hue to a colour (greys → steel / noir). */
export function nearestPalette(color: string): string {
  const h6 = hex6(color); if (!h6) return "midnight";
  const [h, s, l] = toHsl(h6);
  if (s < 0.14) return l < 0.3 ? "noir" : "steel";
  let best = "midnight", bd = 1e9;
  for (const p of SITE_PALETTES) {
    if (p.key === "brand" || p.tone === "light" || p.key === "noir" || p.key === "steel") continue;
    const ph = toHsl(p.mid)[0];
    const d = Math.min(Math.abs(ph - h), 360 - Math.abs(ph - h));
    if (d < bd) { bd = d; best = p.key; }
  }
  return best;
}

/* ================= fonts ================= */

export type FontPair = { key: string; name: string; hi: string; head: string; body: string; headWeight?: number; blurb: string };
export const FONT_PAIRS: FontPair[] = [
  { key: "look", name: "Card look", hi: "कार्ड जैसा", head: "", body: "", blurb: "The fonts of your card's look" },
  { key: "modern", name: "Modern", hi: "मॉडर्न", head: "Plus Jakarta Sans", body: "Inter", blurb: "Clean, startup-like" },
  { key: "elegant", name: "Elegant", hi: "एलिगेंट", head: "Playfair Display", body: "Inter", blurb: "Serif headings — boutiques, clinics, studios" },
  { key: "luxury", name: "Luxury", hi: "लक्ज़री", head: "Cormorant Garamond", body: "Inter", headWeight: 600, blurb: "Fine serif — jewellers, hotels, premium brands" },
  { key: "friendly", name: "Friendly", hi: "फ्रेंडली", head: "Poppins", body: "Inter", blurb: "Round and warm — shops, food, families (Hindi ready)" },
  { key: "bold", name: "Bold", hi: "बोल्ड", head: "Manrope", body: "Inter", headWeight: 800, blurb: "Heavy headings — gyms, builders, sales" },
  { key: "editorial", name: "Editorial", hi: "एडिटोरियल", head: "Lora", body: "Inter", blurb: "Book-like serif — coaches, writers, ayurveda" },
  { key: "tech", name: "Tech", hi: "टेक", head: "Space Grotesk", body: "Inter", blurb: "Geometric — IT, mobile, gadgets" },
  { key: "hindi", name: "Hindi", hi: "हिन्दी", head: "Baloo 2", body: "Mukta", blurb: "Made for Devanagari — हिन्दी websites" },
];
/** Google Fonts weights each family really has (the css2 API refuses a request naming a weight a family lacks). */
const NO_800 = new Set(["Cormorant Garamond", "Lora", "Space Grotesk"]);
/** Google Fonts stylesheet for the given families (Inter is the site default and needs no request). */
export function fontHref(families: string[]): string {
  const fams = Array.from(new Set(families.filter(Boolean))).filter((f) => f !== "Inter");
  if (!fams.length) return "";
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700${NO_800.has(f) ? "" : ";800"}`).join("&")}&display=swap`;
}
export type ResolvedFonts = { key: string; head: string; body: string; headWeight: number; href: string };
export function fontsFor(style: SiteStyle | undefined, look: LookDef): ResolvedFonts {
  const pair = FONT_PAIRS.find((f) => f.key === style?.font && f.key !== "look");
  const head = pair?.head || look.headFont;
  const body = pair?.body || look.bodyFont || look.headFont;
  return { key: pair?.key ?? "look", head, body, headWeight: pair?.headWeight ?? (look.key === "bold" ? 800 : 700), href: fontHref([head, body]) };
}

/* ================= hero + corners ================= */

export type HeroLayout = NonNullable<SiteStyle["hero"]>;
export const HERO_LAYOUTS: { key: HeroLayout; name: string; hi: string; blurb: string }[] = [
  { key: "split", name: "Split", hi: "स्प्लिट", blurb: "Words left, your product or logo right" },
  { key: "photo", name: "Photo", hi: "फ़ोटो", blurb: "Your banner photo across the top" },
  { key: "stage", name: "Stage", hi: "स्टेज", blurb: "Headline centred, the product below it" },
  { key: "minimal", name: "Minimal", hi: "मिनिमल", blurb: "Light and calm — dark text on a soft tint" },
  { key: "grid", name: "Product grid", hi: "प्रोडक्ट ग्रिड", blurb: "Words left, a mosaic of your product photos right" },
  { key: "person", name: "Portrait", hi: "पोर्ट्रेट", blurb: "Words left, your photo right — doctors, CAs, coaches" },
];
export function heroLayoutFor(style: SiteStyle | undefined, has: { image: boolean; cover: boolean }): HeroLayout {
  if (style?.hero) return style.hero;
  if (has.image) return "split";
  return has.cover ? "photo" : "split";
}

export const RADII: { key: NonNullable<SiteStyle["radius"]>; name: string; hi: string; r: string }[] = [
  { key: "sharp", name: "Sharp", hi: "शार्प", r: "0.4rem" },
  { key: "soft", name: "Soft", hi: "सॉफ्ट", r: "1rem" },
  { key: "round", name: "Round", hi: "राउंड", r: "1.5rem" },
];
export const radiusFor = (style: SiteStyle | undefined, look: LookDef): string => RADII.find((r) => r.key === style?.radius)?.r ?? look.vars["--r"] ?? "1rem";

/* ================= the resolved design ================= */

export type SiteDesign = {
  palette: SitePalette;
  fonts: ResolvedFonts;
  radius: string;
  /** Text colour on the palette's deep hero / footer. */
  heroInk: string;
  /** Ink on a solid `mid` fill (buttons, badges). */
  on: string;
  /** Footer base (deep, or a dark companion for light palettes). */
  foot: string;
  /** CSS custom properties for the `.site` root. */
  vars: string;
};

export function siteDesign(card: Pick<Card, "themeColor" | "site" | "template">, look: LookDef): SiteDesign {
  const palette = paletteFor(card);
  const fonts = fontsFor(card.site?.style, look);
  const radius = radiusFor(card.site?.style, look);
  const on = inkOn(palette.mid);
  const foot = palette.foot ?? palette.deep;
  const mark = palette.mark ?? palette.mid;
  const vars = [
    `--p-deep:${palette.deep}`, `--p-mid:${palette.mid}`, `--p-glow:${palette.glow}`, `--p-accent:${palette.accent}`,
    `--p-ink:${palette.ink}`, `--p-on:${on}`, `--p-mark:${mark}`, `--p-foot:${foot}`, `--p-foot-ink:${inkOn(foot)}`,
    `--p-soft:color-mix(in srgb, ${palette.mid} 7%, var(--surface))`,
    `--grad:linear-gradient(120deg, ${palette.mid}, ${palette.glow})`,
    `--r:${radius}`,
    `--look-head:'${fonts.head}', Inter, system-ui, sans-serif`, `--look-body:'${fonts.body}', Inter, system-ui, sans-serif`,
    `--head-w:${fonts.headWeight}`,
  ].join(";");
  return { palette, fonts, radius, heroInk: palette.ink, on, foot, vars };
}

/* ================= reference website → style ================= */

export type ReferenceStyle = {
  /** Brand-ish colours found on the page, most likely first (#rrggbb). */
  colors: string[];
  /** Font families the page loads or names, most used first. */
  fonts: string[];
  /** The page body is dark. */
  dark: boolean;
  /** A large photo sits at the top of the page. */
  heroImage: boolean;
};
const SERIF = /playfair|lora|merriweather|garamond|cormorant|baskerville|dm serif|prata|cinzel|marcellus|crimson|spectral|frank ruhl|noto serif|pt serif|georgia|times/i;
const ROUNDED = /poppins|nunito|quicksand|baloo|fredoka|comfortaa|varela|mukta|hind|rubik/i;
const TECH = /space grotesk|space mono|ibm plex|jetbrains|fira|roboto mono|sora|syne|archivo/i;
const HEAVY = /montserrat|manrope|raleway|oswald|bebas|anton|barlow|work sans|outfit/i;
/** Design choices suggested by a reference website: its colour becomes the website's colour (never the card's),
 *  its font family picks the nearest pair, a big top photo suggests the photo hero. */
export function styleFromReference(r: ReferenceStyle): SiteStyle {
  const color = r.colors.map(hex6).find((c): c is string => !!c && luminance(c) < 0.75 && toHsl(c)[1] > 0.12);
  const named = r.fonts.find((f) => FONT_PAIRS.some((p) => p.head && p.head.toLowerCase() === f.toLowerCase()));
  const font = named ? FONT_PAIRS.find((p) => p.head.toLowerCase() === named.toLowerCase())!.key
    : r.fonts.some((f) => SERIF.test(f)) ? "elegant"
    : r.fonts.some((f) => ROUNDED.test(f)) ? "friendly"
    : r.fonts.some((f) => TECH.test(f)) ? "tech"
    : r.fonts.some((f) => HEAVY.test(f)) ? "bold"
    : "modern";
  const style: SiteStyle = { font, hero: r.heroImage ? "photo" : "split" };
  if (color) { style.palette = "brand"; style.color = color; }
  else if (r.dark) style.palette = "noir";
  return style;
}

/** A style object with only known keys and safe values (API input, stored on the card). */
export function cleanStyle(x: unknown): SiteStyle | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const out: SiteStyle = {};
  if (typeof o.palette === "string" && PALETTE_KEYS.includes(o.palette)) out.palette = o.palette;
  const color = hex6(o.color); if (color) out.color = color;
  if (typeof o.font === "string" && FONT_PAIRS.some((f) => f.key === o.font)) out.font = o.font;
  if (typeof o.hero === "string" && HERO_LAYOUTS.some((h) => h.key === o.hero)) out.hero = o.hero as HeroLayout;
  if (typeof o.radius === "string" && RADII.some((r) => r.key === o.radius)) out.radius = o.radius as NonNullable<SiteStyle["radius"]>;
  return out;
}

/* ========== a measured reference website → our design choices ========== */

/** What the browser measured on the reference page (src/lib/render-page.ts). Kept structural so this file
 *  stays free of server-only imports. */
export type MeasuredLook = {
  bg: string; ink: string; accent?: string;
  headFont?: string; bodyFont?: string;
  headScale: number; radius: number; spacing: number; columns: number;
  heroImage: boolean; sections: string[];
};

/** Contrast ratio between two colours, the WCAG way. Below 4.5 is hard to read at normal sizes. */
function contrast(a: string, b: string): number {
  const L = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const x = L(a), y = L(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Design choices taken from a measured reference website.
 *
 *  A copy, not a tracing — and never a copy of a mistake. The owner's instruction (1 Oct 2026) was that a
 *  reference site with a poor design should be improved on, not reproduced, so each measurement is taken
 *  only where it is sound:
 *    • an accent too pale to put white text on is dropped rather than carried over;
 *    • a page whose own text barely separates from its background is not imitated — ours stays readable;
 *    • headings that are the same size as the body (no hierarchy at all) are not copied; ours keep theirs;
 *    • rounding is snapped to the three we draw, so a 40px pill becomes "round" and 2px becomes "sharp".
 */
/** A page that gave us nothing to copy: no accent, no sections, a browser-default font. That is what a site
 *  that blocks headless browsers hands back (pepperfry.com serves exactly this), and what an empty page
 *  looks like. Copying it would mean copying a blank. */
export function lookIsBlank(m: MeasuredLook): boolean {
  const generic = /^(times new roman|times|serif|arial|helvetica)$/i.test(m.headFont ?? "") || !m.headFont;
  return !m.accent && !m.sections.length && !m.heroImage && generic;
}

export function styleFromLook(m: MeasuredLook): SiteStyle {
  const style: SiteStyle = {};

  // Colour. brandPalette() already pulls a colour into a readable band and builds a deep variant for the
  // fills that carry white text, so the only accents refused here are the ones no palette can save: a
  // near-white wash, near-black, or a grey. Urban Ladder's orange (#ec7744) and Nothing's yellow (#ffc700)
  // are real brand colours and used to be thrown away for failing a white-text contrast test that
  // brandPalette answers on its own.
  const readablePage = contrast(m.bg, m.ink) >= 4.5;
  const accent = m.accent && hex6(m.accent);
  const usable = accent && toHsl(accent)[1] >= 0.2 && luminance(accent) > 0.06 && luminance(accent) < 0.9;
  if (usable && accent) { style.palette = "brand"; style.color = accent; }
  else if (luminance(m.bg) < 0.25 && readablePage) style.palette = "noir";

  // Fonts: the family it actually renders, when we have that pair; otherwise the nearest family in feel.
  const named = [m.headFont, m.bodyFont].filter(Boolean)
    .map((f) => FONT_PAIRS.find((p) => p.head && p.head.toLowerCase() === String(f).toLowerCase()))
    .find(Boolean);
  const all = `${m.headFont ?? ""} ${m.bodyFont ?? ""}`;
  style.font = named?.key
    ?? (SERIF.test(all) ? "elegant"
      : ROUNDED.test(all) ? "friendly"
      : TECH.test(all) ? "tech"
      : HEAVY.test(all) ? "bold"
      : "modern");

  // A big picture at the top, or a split hero. A page with no hierarchy in its headings is not a model to
  // follow, so a flat one gets our own quiet hero rather than its flatness.
  style.hero = m.heroImage ? "photo" : m.headScale < 1.2 ? "minimal" : "split";

  // Rounding, snapped to what we draw.
  style.radius = m.radius >= 16 ? "round" : m.radius >= 6 ? "soft" : "sharp";

  return style;
}

/** The pulled-in home sections, in the order the reference site puts them. Only those five can be ordered
 *  by name; anything else on the page keeps its usual place. Returns null when the page gave us nothing
 *  worth reordering for. */
export function homeOrderFromLook(m: MeasuredLook): string[] | null {
  const MAP: Record<string, string> = {
    products: "featured", services: "featured",
    gallery: "gallery", reviews: "reviews", faq: "faq", contact: "visit",
  };
  const out: string[] = [];
  for (const s of m.sections) {
    const key = MAP[s];
    if (key && !out.includes(key)) out.push(key);
  }
  // One section is not an order; it would just pin that one to the top for no reason.
  return out.length >= 2 ? out : null;
}
