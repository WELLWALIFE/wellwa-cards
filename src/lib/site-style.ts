// The website's design system: palettes, font sets, hero layouts and corner radii, resolved from `card.site.style`
// (the owner's choice in /poster/website/edit, or what a reference website suggested) with the card's own colour
// and look as the fallback — so a website that never chose anything still renders in its brand colour.
//
// Pure module (no React, no fetch, no DOM): used by the public website renderer, the website editor and the
// server (reference-website → style). The tokens it emits are documented in docs/premium-look.md §2.
import type { Card, SiteStyle, SiteLayouts, HeroVariant } from "./types";
import { HERO_VARIANTS } from "./types";
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

/* ================= OKLCH (no dependency) ================= */
// Every website colour is derived from one hue in OKLCH (docs/premium-look.md §2.3) and emitted as sRGB hex first,
// OKLCH second — Chrome/WebView < 111 drops the oklch() declaration and keeps the hex.

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gam = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** OKLCH of a #rrggbb colour: l 0..1, c (≈ 0..0.4), h in degrees. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = rgb(hex6(hex) ?? "#0e9e90").map((v) => lin(v / 255));
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B), h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}
/** #rrggbb for an OKLCH colour (l 0..1); a colour outside sRGB loses chroma until it fits, never its lightness. */
export function oklchToHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  const fits = (ch: number) => oklabToLinear(l, ch * Math.cos(rad), ch * Math.sin(rad)).every((v) => v > -1e-4 && v < 1 + 1e-4);
  let lo = 0, hi = c;
  if (fits(c)) lo = c;
  else for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  const [r, g, b] = oklabToLinear(l, lo * Math.cos(rad), lo * Math.sin(rad)).map((v) => gam(Math.max(0, Math.min(1, v))) * 255);
  return toHex(r, g, b);
}
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const num = (n: number) => String(Math.round(n * 1000) / 1000).replace(/^0\./, ".");
const hex8 = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
/** One token, hex first and OKLCH second: `--paper:#f7f3ec;--paper:oklch(97% .012 85)`. */
function tok(name: string, l: number, c: number, h: number, a?: number): string {
  const hx = oklchToHex(l, c, h);
  const ok = `oklch(${pct(l)} ${num(c)} ${num(h)}${a === undefined ? "" : ` / ${num(a)}`})`;
  return `--${name}:${a === undefined ? hx : hex8(hx, a)};--${name}:${ok}`;
}
export type Tone = "light" | "dark";
export type OklchOpts = {
  /** Chroma of the source colour (capped at .13; a grey brand stays grey). Default .13. */
  c?: number;
  /** Jewellers, bridal, hotels: ivory paper, espresso ink, gold for 1 px rules and the kicker only. */
  luxe?: boolean;
  /** The hero photo is bright at the bottom: the scrim deepens to .90. */
  bright?: boolean;
};
/** The colour tokens of docs/premium-look.md §2.3 for one hue, as CSS declarations for the `.site` root. */
export function oklchVars(h: number, tone: Tone, opts: OklchOpts = {}): string {
  h = ((h % 360) + 360) % 360;
  // Gold is a line, never a fill: for hues around gold the accent stays quiet.
  const C = Math.min(opts.c ?? 0.13, h >= 70 && h <= 100 ? 0.09 : 0.13);
  const dark = tone === "dark";
  const paper: [number, number, number] = opts.luxe ? [0.96, 0.015, 85] : dark ? [0.18, 0.02, h] : [0.97, 0.012, h];
  const paper2: [number, number, number] = opts.luxe ? [0.93, 0.02, 85] : dark ? [0.22, 0.025, h] : [0.94, 0.018, h];
  const lightInk: [number, number, number] = opts.luxe ? [0.24, 0.03, 60] : [0.22, 0.025, h];
  const ink: [number, number, number] = dark ? [0.95, 0.01, h] : lightInk;
  const accent: [number, number, number] = [dark ? 0.72 : 0.48, C, h];
  const accentHex = oklchToHex(...accent), paperHex = oklchToHex(...paper), lightInkHex = oklchToHex(...lightInk);
  // Text on the accent: paper when it reads, else the light row's ink (a 72 % accent on a dark page carries ink).
  const onAccent = !dark && contrast(accentHex, paperHex) >= 4.5 ? paperHex : lightInkHex;
  const shadowInk = oklchToHex(...ink);
  const out = [
    `--h:${num(h)}`,
    tok("paper", ...paper), tok("paper-2", ...paper2), tok("ink", ...ink),
    tok("muted", ...ink, dark ? 0.7 : 0.64), tok("line", ...ink, dark ? 0.14 : 0.1),
    tok("accent", ...accent), tok("accent-soft", dark ? 0.3 : 0.93, dark ? 0.05 : 0.04, h),
    `--on-accent:${onAccent}`,
    tok("hero-ink", 0.15, 0.02, h), tok("hero-text", 0.97, 0.01, h, 0.94), tok("hero-muted", 0.97, 0.01, h, 0.64),
    `--hero-line:rgba(255,255,255,.12)`,
    // WhatsApp's green on the WhatsApp control only; `--wa-dark` for that control on a dark hero of a light page.
    `--wa:${dark ? "#25d366" : "#1faa5c"}`, `--wa-dark:#25d366`,
    tok("scrim-bot", 0.15, 0.02, h, opts.bright ? 0.9 : 0.82), tok("scrim-mid", 0.15, 0.02, h, 0.45), `--scrim-top:transparent`,
    `--star:var(--accent)`,
    opts.luxe ? tok("gold", 0.72, 0.09, 85) : `--gold:var(--accent)`,
    // Elevation shadow (ink at 6 %): `.s-card` on the cinematic blueprint, floating sheets, the sticky bar.
    `--e-1:0 1px 2px ${hex8(shadowInk, 0.06)},0 8px 24px ${hex8(shadowInk, 0.06)}`,
    `--scheme:${dark ? "dark" : "light"}`,
  ];
  return out.join(";");
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
  /** The hero's tone (the page itself is paper either way). */
  tone: "dark" | "light";
  /** OKLCH hue and chroma of `mid`: the input of oklchVars(). */
  h: number; c: number;
};

const P = (key: string, name: string, hi: string, deep: string, mid: string, glow: string, accent: string, extra: Partial<SitePalette> = {}): SitePalette => {
  const { h, c } = hexToOklch(mid);
  return { key, name, hi, deep, mid, glow, accent, ink: "#ffffff", tone: "dark", h, c, ...extra };
};

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
  const ok = hexToOklch(mid);
  return {
    key: "brand", name: "Your colour", hi: "आपका रंग", tone: "dark", ink: "#ffffff",
    deep: mixHex(mid, "#0b1214", 0.62),
    mid,
    glow: fromHsl(h + 18, Math.min(1, s * 1.05), Math.min(0.62, l + 0.14)),
    accent: fromHsl(h + 24, Math.min(1, s), 0.86),
    h: ok.h, c: ok.c,
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
// Self-hosted (docs/premium-look.md §2.1): scripts/fetch-fonts.mjs reads FONT_FACES below, downloads one woff2 per
// row into public/fonts and writes the @font-face block into src/app/globals.css. Nothing here loads from Google.

export type FontFaceRow = { family: string; /** "400" (static) or "400-600" (one variable file). */ w: string; sub: "latin" | "deva"; ital: boolean };
const face = (family: string, w: string, sub: "latin" | "deva" = "latin", ital = false): FontFaceRow => ({ family, w, sub, ital });
/** Every self-hosted file: one row = one woff2 (the script parses these rows, so keep one `face(…)` per line). */
export const FONT_FACES: FontFaceRow[] = [
  // Display, Latin
  face("Instrument Serif", "400"),
  face("Instrument Serif", "400", "latin", true),
  face("Playfair Display", "400-500"),
  face("Newsreader", "400-500"),
  face("Fraunces", "400-500"),
  face("DM Serif Display", "400"),
  face("Lora", "500"),
  face("Bricolage Grotesque", "600-700"),
  face("Space Grotesk", "600"),
  // Text, Latin (one variable file each; Mukta is static)
  face("Inter", "400-600"),
  face("Manrope", "400-600"),
  face("DM Sans", "400-500"),
  face("Mukta", "400"),
  face("Mukta", "600"),
  // Devanagari (downloaded only when a Devanagari glyph paints)
  face("Tiro Devanagari Hindi", "400"),
  face("Tiro Devanagari Hindi", "400", "deva"),
  face("Noto Sans Devanagari", "400-600", "deva"),
  face("Noto Serif Devanagari", "400-500", "deva"),
  face("Hind", "400", "deva"),
  face("Hind", "600", "deva"),
  face("Hind", "700", "deva"),
  face("Mukta", "400", "deva"),
  face("Mukta", "600", "deva"),
  face("Yatra One", "400", "deva"),
];
const slug = (family: string) => family.toLowerCase().replace(/\s+/g, "-");
/** The public path of one self-hosted file: /fonts/<family>-<wght>[-ital][-deva].woff2. */
export const fontFile = (f: FontFaceRow) => `/fonts/${slug(f.family)}-${f.w}${f.ital ? "-ital" : ""}${f.sub === "deva" ? "-deva" : ""}.woff2`;
const SELF_HOSTED = new Set(FONT_FACES.map((f) => f.family));
/** The latin file of `family` that carries weight `w` (a static of that weight, else the variable range). */
function latinFile(family: string, w: number): string | null {
  const rows = FONT_FACES.filter((f) => f.family === family && f.sub === "latin" && !f.ital);
  const hit = rows.find((f) => f.w === String(w)) ?? rows.find((f) => { const [a, b] = f.w.split("-").map(Number); return b !== undefined && w >= a && w <= b; }) ?? rows[0];
  return hit ? fontFile(hit) : null;
}

/** Fallback metrics per family: the local Arial / Times New Roman face, size-adjusted to the web font so the swap
 *  moves nothing (CLS). Percentages, computed by scripts/font-metrics.mjs (fontkit) from the downloaded files. */
export type FontMetrics = { fb: "Arial" | "Times New Roman"; sizeAdjust: number; ascent: number; descent: number; lineGap: number };
/* metrics:start */
export const FONT_METRICS: Record<string, FontMetrics> = {
  "Instrument Serif": { fb: "Times New Roman", sizeAdjust: 84.05, ascent: 117.79, descent: 36.88, lineGap: 0 },
  "Playfair Display": { fb: "Times New Roman", sizeAdjust: 112.3, ascent: 96.35, descent: 22.35, lineGap: 0 },
  "Newsreader": { fb: "Times New Roman", sizeAdjust: 105.25, ascent: 69.83, descent: 25.18, lineGap: 0 },
  "Fraunces": { fb: "Times New Roman", sizeAdjust: 126.63, ascent: 77.23, descent: 20.14, lineGap: 0 },
  "DM Serif Display": { fb: "Times New Roman", sizeAdjust: 110.73, ascent: 93.56, descent: 30.26, lineGap: 0 },
  "Lora": { fb: "Times New Roman", sizeAdjust: 117.6, ascent: 85.54, descent: 23.3, lineGap: 0 },
  "Bricolage Grotesque": { fb: "Arial", sizeAdjust: 111.7, ascent: 83.26, descent: 24.17, lineGap: 0 },
  "Space Grotesk": { fb: "Arial", sizeAdjust: 110.76, ascent: 88.84, descent: 26.36, lineGap: 0 },
  "Inter": { fb: "Arial", sizeAdjust: 107.29, ascent: 90.29, descent: 22.48, lineGap: 0 },
  "Manrope": { fb: "Arial", sizeAdjust: 99.74, ascent: 106.88, descent: 30.08, lineGap: 0 },
  "DM Sans": { fb: "Arial", sizeAdjust: 105.58, ascent: 93.95, descent: 29.36, lineGap: 0 },
  "Mukta": { fb: "Arial", sizeAdjust: 94.89, ascent: 119.08, descent: 56.06, lineGap: 0 },
  "Tiro Devanagari Hindi": { fb: "Times New Roman", sizeAdjust: 112.75, ascent: 66.96, descent: 21.73, lineGap: 29.27 },
};
/* metrics:end */

export type FontSet = {
  key: string; name: string; hi: string; blurb: string;
  /** Latin display face and its H1 weight; serif → −.02em tracking, sans → −.03em. */
  display: { family: string; w: number; serif: boolean; ital?: boolean };
  /** Latin text face and the weights the page uses (400 body, 500 meta, 600 kicker / CTA). */
  text: { family: string; w: number[] };
  /** Devanagari faces: the display face joins the H1 stack on Hindi-first sites; the text face is always in the stack. */
  deva: { display: { family: string; w: number }; text: string };
};
const S = (key: string, name: string, hi: string, blurb: string, display: FontSet["display"], text: FontSet["text"], devaDisplay: FontSet["deva"]["display"], devaText: string): FontSet =>
  ({ key, name, hi, blurb, display, text, deva: { display: devaDisplay, text: devaText } });
/** The nine type sets (docs/premium-look.md §2.1). Two families, three weights at most; serif display ≤ 500. */
export const FONT_SETS: FontSet[] = [
  S("luxury", "Luxury", "लक्ज़री", "Fine serif — jewellers, boutiques, hotels", { family: "Instrument Serif", w: 400, serif: true, ital: true }, { family: "Inter", w: [400, 500, 600] }, { family: "Tiro Devanagari Hindi", w: 400 }, "Noto Sans Devanagari"),
  S("elegant", "Elegant", "एलिगेंट", "Classic serif — bridal, salons, garments, events", { family: "Playfair Display", w: 400, serif: true }, { family: "Inter", w: [400, 500, 600] }, { family: "Tiro Devanagari Hindi", w: 400 }, "Hind"),
  S("editorial", "Editorial", "एडिटोरियल", "Book-like serif — CAs, lawyers, coaching, ayurveda", { family: "Newsreader", w: 400, serif: true }, { family: "Inter", w: [400, 500, 600] }, { family: "Noto Serif Devanagari", w: 400 }, "Mukta"),
  S("warm", "Warm", "वार्म", "Soft serif, friendly sans — cafes, sweets, bakeries, restaurants", { family: "Fraunces", w: 400, serif: true }, { family: "Manrope", w: [400, 600] }, { family: "Yatra One", w: 400 }, "Mukta"),
  S("clinic", "Clinic", "क्लिनिक", "Calm and clean — doctors, dentists, hospitals, labs", { family: "DM Serif Display", w: 400, serif: true }, { family: "DM Sans", w: [400, 500] }, { family: "Noto Serif Devanagari", w: 400 }, "Hind"),
  S("honest", "Honest", "ऑनेस्ट", "Plain and trustworthy — kirana, dairy, agri, hardware (Hindi ready)", { family: "Lora", w: 500, serif: true }, { family: "Mukta", w: [400, 600] }, { family: "Mukta", w: 600 }, "Mukta"),
  S("bold", "Bold", "बोल्ड", "Strong grotesque — gyms, electronics, auto", { family: "Bricolage Grotesque", w: 700, serif: false }, { family: "Inter", w: [400, 500, 600] }, { family: "Hind", w: 700 }, "Hind"),
  S("tech", "Tech", "टेक", "Geometric — IT, repair, courier, gadgets", { family: "Space Grotesk", w: 600, serif: false }, { family: "Inter", w: [400, 500, 600] }, { family: "Hind", w: 600 }, "Hind"),
  S("hindi", "Hindi", "हिन्दी", "Made for Devanagari — हिन्दी websites", { family: "Tiro Devanagari Hindi", w: 400, serif: true }, { family: "Mukta", w: [400, 600] }, { family: "Tiro Devanagari Hindi", w: 400 }, "Mukta"),
];
/** Keys stored before the sets existed (FONT_PAIRS of Sept 2026) → the set they now mean. */
export const FONT_ALIASES: Record<string, string> = { modern: "tech", friendly: "warm" };
/** The set a stored `style.font` means; null for "look" / unset / unknown. */
export function fontSetFor(key: string | undefined | null): FontSet | null {
  if (!key || key === "look") return null;
  const k = FONT_ALIASES[key] ?? key;
  return FONT_SETS.find((s) => s.key === k) ?? null;
}

/** The pickers' list: "look" (the card look's fonts) + the nine sets. `head`/`body` are the Latin faces. */
export type FontPair = { key: string; name: string; hi: string; head: string; body: string; headWeight?: number; blurb: string };
export const FONT_PAIRS: FontPair[] = [
  { key: "look", name: "Card look", hi: "कार्ड जैसा", head: "", body: "", blurb: "The fonts of your card's look" },
  ...FONT_SETS.map((s): FontPair => ({ key: s.key, name: s.name, hi: s.hi, head: s.display.family, body: s.text.family, headWeight: s.display.w, blurb: s.blurb })),
];

const SANS_FB = `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const SERIF_FB = `Georgia, "Times New Roman", "Noto Serif", serif`;
const q = (f: string) => `"${f}"`;
const withFallback = (family: string) => (FONT_METRICS[family] ? `${q(family)}, ${q(`${family} Fallback`)}` : q(family));
/** The font variables of one set for the inline `<style>`: `--font-display`, `--font-text`, `--font-deva-display`,
 *  `--display-w`, `--display-w-hi`, `--display-lh`, `--display-tr`, `--text-w`, plus the `--look-head/--look-body/--head-w`
 *  aliases. `hi`: a Hindi-first site (card.language "hi", or a Devanagari name) — its Devanagari display face joins the
 *  H1 stack; else a Hindi H1 is set in the Devanagari text face at `--display-w-hi` (600), so no display file downloads
 *  for one translated line. */
export function fontCss(set: FontSet, opts: { hi?: boolean } = {}): string {
  const devaText = q(set.deva.text);
  const devaIsText = set.deva.display.family === set.deva.text;
  const devaHead = opts.hi || devaIsText ? q(set.deva.display.family) : devaText;
  const display = `${withFallback(set.display.family)}, ${devaHead}, ${set.display.serif ? SERIF_FB : SANS_FB}`;
  // The Devanagari text face first: its files carry a unicode-range, so Latin falls straight through to the text face.
  const text = set.deva.text === set.text.family ? `${withFallback(set.text.family)}, ${SANS_FB}` : `${devaText}, ${withFallback(set.text.family)}, ${SANS_FB}`;
  const devaDisplay = `${q(set.deva.display.family)}, ${devaText}, ${set.display.serif ? SERIF_FB : SANS_FB}`;
  const wHi = opts.hi || devaIsText ? set.deva.display.w : 600;
  return [
    `--font-display:${display}`, `--font-text:${text}`, `--font-deva-display:${devaDisplay}`,
    `--display-w:${set.display.w}`, `--display-w-hi:${wHi}`, `--display-lh:.98`, `--display-tr:${set.display.serif ? "-.02em" : "-.03em"}`,
    `--text-w:${set.text.w[0]}`,
    `--look-head:var(--font-display)`, `--look-body:var(--font-text)`, `--head-w:var(--display-w)`,
  ].join(";");
}
/** The two files worth a `<link rel="preload" as="font">`: the display face at its H1 weight and the text file. */
export function fontPreload(set: FontSet): string[] {
  return [latinFile(set.display.family, set.display.w), latinFile(set.text.family, set.text.w[0])].filter((x): x is string => !!x);
}

/** Families without an 800 weight on Google Fonts (the css2 API refuses a request naming a weight a family lacks). */
const NO_800 = new Set(["Cormorant Garamond", "Lora", "Space Grotesk"]);
/** Google Fonts stylesheet for the families that are NOT self-hosted (a card look's fonts); "" when none is needed.
 *  Inter is self-hosted now, so it never needs a request either. */
export function fontHref(families: string[]): string {
  const fams = Array.from(new Set(families.filter(Boolean))).filter((f) => f !== "Inter" && !SELF_HOSTED.has(f));
  if (!fams.length) return "";
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700${NO_800.has(f) ? "" : ";800"}`).join("&")}&display=swap`;
}
export type ResolvedFonts = {
  key: string; head: string; body: string; headWeight: number;
  /** Google stylesheet for a card look's fonts; "" for a set (self-hosted). */ href: string;
  /** The set, or null when the website wears the card look's fonts. */ set: FontSet | null;
  /** fontCss(set) — or the look's two faces as the same variables. */ css: string;
  /** fontPreload(set); empty for a look. */ preload: string[];
};
export function fontsFor(style: SiteStyle | undefined, look: LookDef, opts: { hi?: boolean } = {}): ResolvedFonts {
  const set = fontSetFor(style?.font);
  if (set) {
    return { key: set.key, head: set.display.family, body: set.text.family, headWeight: set.display.w, href: "", set, css: fontCss(set, opts), preload: fontPreload(set) };
  }
  const head = look.headFont, body = look.bodyFont || look.headFont, headWeight = look.key === "bold" ? 800 : 700;
  const css = [`--font-display:'${head}', Inter, ${SANS_FB}`, `--font-text:'${body}', Inter, ${SANS_FB}`, `--font-deva-display:var(--font-display)`, `--display-w:${headWeight}`, `--display-w-hi:${headWeight}`, `--display-lh:1.02`, `--display-tr:-.02em`, `--text-w:400`, `--look-head:var(--font-display)`, `--look-body:var(--font-text)`, `--head-w:var(--display-w)`].join(";");
  return { key: "look", head, body, headWeight, href: fontHref([head, body]), set: null, css, preload: [] };
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
  { key: "editorial", name: "Editorial", hi: "एडिटोरियल", blurb: "Your banner full-bleed, the headline low and large, facts in a glass card — hotels, schools, premium" },
  { key: "marquee", name: "Marquee", hi: "मार्की", blurb: "Headline centred over a slowly moving strip of your photos — shops, food, studios" },
];
export function heroLayoutFor(style: SiteStyle | undefined, has: { image: boolean; cover: boolean }): HeroLayout {
  if (style?.hero) return style.hero;
  if (has.image) return "split";
  return has.cover ? "photo" : "split";
}

/** The page structures (docs/website-looks-v2.md §3); the registry with names and defaults is site-blueprints.ts. */
export const BLUEPRINT_KEYS = ["bento", "cinematic", "story"] as const;
export type BlueprintKey = (typeof BLUEPRINT_KEYS)[number];

/** Corner sets: `r` is the legacy `--r` (unchanged); ctl / card / tile / img are the four tokens of §2.4, in px. */
export const RADII: { key: NonNullable<SiteStyle["radius"]>; name: string; hi: string; r: string; ctl: number; card: number; tile: number; img: number }[] = [
  { key: "sharp", name: "Sharp", hi: "शार्प", r: "0.4rem", ctl: 4, card: 8, tile: 12, img: 4 },
  { key: "soft", name: "Soft", hi: "सॉफ्ट", r: "1rem", ctl: 12, card: 16, tile: 20, img: 8 },
  { key: "round", name: "Round", hi: "राउंड", r: "1.5rem", ctl: 16, card: 24, tile: 28, img: 12 },
];
export const radiusFor = (style: SiteStyle | undefined, look: LookDef): string => RADII.find((r) => r.key === style?.radius)?.r ?? look.vars["--r"] ?? "1rem";
/** `--r-ctl/--r-card/--r-tile/--r-img` for a style ("soft" when nothing was chosen). */
export function radiusVars(style: SiteStyle | undefined): string {
  const r = RADII.find((x) => x.key === style?.radius) ?? RADII[1];
  return `--r-ctl:${r.ctl}px;--r-card:${r.card}px;--r-tile:${r.tile}px;--r-img:${r.img}px`;
}

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

const DEVA = /[ऀ-ॿ]/;
export type SiteDesignOpts = {
  /** The mood brief's luxury flag (trade-moods.ts): ivory paper, espresso ink, a gold line. */
  luxe?: boolean;
  /** The hero photo is bright where the text sits (hero.bright). */
  bright?: boolean;
};
export function siteDesign(card: Pick<Card, "themeColor" | "site" | "template"> & Partial<Pick<Card, "language" | "name" | "company">>, look: LookDef, opts: SiteDesignOpts = {}): SiteDesign {
  const palette = paletteFor(card);
  const hi = card.language === "hi" || DEVA.test(card.company || card.name || "");
  const fonts = fontsFor(card.site?.style, look, { hi });
  const radius = radiusFor(card.site?.style, look);
  const on = inkOn(palette.mid);
  const foot = palette.foot ?? palette.deep;
  const mark = palette.mark ?? palette.mid;
  const vars = [
    // The §2.3 tokens. `palette.tone` is the hero's tone; the page is paper until a dark-page preset exists.
    oklchVars(palette.h, "light", { c: palette.c, luxe: opts.luxe, bright: opts.bright }),
    radiusVars(card.site?.style),
    fonts.css,
    // Legacy names, one release (docs/premium-look.md §2): the classic page and the sections still read them, with the
    // palette's own hex so nothing they draw changes colour. `--grad` is gone from here; globals.css carries it.
    `--p-deep:${palette.deep}`, `--p-mid:${palette.mid}`, `--p-glow:${palette.glow}`, `--p-accent:${palette.accent}`,
    `--p-ink:${palette.ink}`, `--p-on:${on}`, `--p-mark:${mark}`, `--p-foot:${foot}`, `--p-foot-ink:${inkOn(foot)}`, `--tc:${palette.mid}`,
    // 7% was invisible: every section read as one long white page. 12% is a tint a visitor notices without
    // the page turning into stripes.
    `--p-soft:color-mix(in srgb, ${palette.mid} 12%, var(--surface))`,
    `--r:${radius}`,
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
 *  its font family picks the nearest set, a big top photo suggests the photo hero. */
export function styleFromReference(r: ReferenceStyle): SiteStyle {
  const color = r.colors.map(hex6).find((c): c is string => !!c && luminance(c) < 0.75 && toHsl(c)[1] > 0.12);
  const named = r.fonts.find((f) => FONT_PAIRS.some((p) => p.head && p.head.toLowerCase() === f.toLowerCase()));
  const font = named ? FONT_PAIRS.find((p) => p.head.toLowerCase() === named.toLowerCase())!.key
    : r.fonts.some((f) => SERIF.test(f)) ? "elegant"
    : r.fonts.some((f) => ROUNDED.test(f)) ? "warm"
    : r.fonts.some((f) => TECH.test(f)) ? "tech"
    : r.fonts.some((f) => HEAVY.test(f)) ? "bold"
    : "tech";
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
  if (typeof o.blueprint === "string" && (BLUEPRINT_KEYS as readonly string[]).includes(o.blueprint)) out.blueprint = o.blueprint as SiteStyle["blueprint"];
  if (typeof o.palette === "string" && PALETTE_KEYS.includes(o.palette)) out.palette = o.palette;
  const color = hex6(o.color); if (color) out.color = color;
  // An old key ("modern", "friendly") is stored as the set it now means.
  if (typeof o.font === "string" && fontSetFor(o.font)) out.font = FONT_ALIASES[o.font] ?? o.font;
  if (typeof o.hero === "string" && HERO_LAYOUTS.some((h) => h.key === o.hero)) out.hero = o.hero as HeroLayout;
  if (typeof o.heroVariant === "string" && (HERO_VARIANTS as readonly string[]).includes(o.heroVariant)) out.heroVariant = o.heroVariant as HeroVariant;
  if (typeof o.radius === "string" && RADII.some((r) => r.key === o.radius)) out.radius = o.radius as NonNullable<SiteStyle["radius"]>;
  const lay = cleanLayouts(o.layouts);
  if (lay) out.layouts = lay;
  if (typeof o.pattern === "string" && (["none", "dots", "waves", "grid", "diagonal", "blobs", "rings"] as string[]).includes(o.pattern)) out.pattern = o.pattern as SiteStyle["pattern"];
  if (typeof o.motion === "string" && (["none", "calm", "lively"] as string[]).includes(o.motion)) out.motion = o.motion as SiteStyle["motion"];
  return out;
}

/** The hero's media facts (`site.hero.lqip` / `bright` / `kicker`) with only safe values — for whoever writes `hero`
 *  (the build, the banner finisher, the merge). A 24 px WebP LQIP is ≤ 600 bytes, so ≤ 900 base64 characters. */
export function cleanHeroExtras(x: unknown): { lqip?: string; bright?: boolean; kicker?: string } {
  if (!x || typeof x !== "object") return {};
  const o = x as Record<string, unknown>;
  const out: { lqip?: string; bright?: boolean; kicker?: string } = {};
  if (typeof o.lqip === "string" && /^data:image\/webp;base64,[A-Za-z0-9+/=]{20,900}$/.test(o.lqip)) out.lqip = o.lqip;
  if (typeof o.bright === "boolean") out.bright = o.bright;
  if (typeof o.kicker === "string" && o.kicker.trim() && o.kicker.trim().length <= 60 && !/[<>]/.test(o.kicker)) out.kicker = o.kicker.trim();
  return out;
}

export const LAYOUT_CHOICES: Record<keyof SiteLayouts, readonly string[]> = {
  about: ["photo-left", "photo-right", "statement", "columns"],
  services: ["rows", "cards", "list"],
  products: ["showcase", "grid", "dense"],
  faq: ["open", "accordion"],
  reviews: ["quote", "pair", "cards"],
  gallery: ["mosaic", "masonry"],
};
/** The section layouts, each checked against its choices; null when none is valid. */
export function cleanLayouts(x: unknown): SiteLayouts | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of Object.keys(LAYOUT_CHOICES) as (keyof SiteLayouts)[]) {
    const v = typeof o[k] === "string" ? (o[k] as string).trim().toLowerCase() : "";
    if (v && LAYOUT_CHOICES[k].includes(v)) out[k] = v;
  }
  return Object.keys(out).length ? (out as SiteLayouts) : null;
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

  // Fonts: the family it actually renders, when we have that set; otherwise the nearest family in feel.
  const named = [m.headFont, m.bodyFont].filter(Boolean)
    .map((f) => FONT_PAIRS.find((p) => p.head && p.head.toLowerCase() === String(f).toLowerCase()))
    .find(Boolean);
  const all = `${m.headFont ?? ""} ${m.bodyFont ?? ""}`;
  style.font = named?.key
    ?? (SERIF.test(all) ? "elegant"
      : ROUNDED.test(all) ? "warm"
      : TECH.test(all) ? "tech"
      : HEAVY.test(all) ? "bold"
      : "tech");

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
