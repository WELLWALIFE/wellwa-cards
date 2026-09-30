// The card's LOOKS — twelve complete visual styles, not just twelve banners.
//
// A look sets the fonts, the surface colours, the corner radius, the header treatment and a few CSS rules that
// re-skin the whole card (section boxes, buttons, tabs, the QR footer). The card body renders once; the look is
// applied through CSS custom properties on the card root (`data-look`), so every Tailwind utility inside the card
// (bg-surface2, border-border, text-muted…) picks the look's palette up automatically.
//
// Pure module (no React, no fetch): used by the public card, the editor, the Looks gallery and the website view.
import type { CardTemplate } from "./types";

export type LookTone = "light" | "dark";
export type LookHeader = "banner" | "tall" | "split" | "strip" | "glass" | "editorial";

export type LookDef = {
  key: CardTemplate;
  name: string;
  hi: string;
  /** One line under the name in the gallery. */
  blurb: string;
  tone: LookTone;
  /** Google Fonts family for headings (and the body when `bodyFont` is unset). */
  headFont: string;
  bodyFont?: string;
  /** CSS custom properties applied on the card root. `--r` is the corner radius, `--look-*` are look-only tokens. */
  vars: Record<string, string>;
  header: LookHeader;
  /** How the theme colour is used on the header when there is no banner image. */
  cover: (theme: string) => string;
  /** Extra rules, scoped by the caller under `[data-look="<key>"]`. */
  css?: string;
  /** Gallery preview colours (when the owner has no theme yet). */
  swatch: [string, string];
};

const LIGHT = {
  "--surface": "#ffffff", "--surface-2": "#f3f4f9", "--border": "#e4e7f0", "--border-strong": "#cfd4e4",
  "--ink": "#141a33", "--muted": "#5a6180", "--faint": "#8d93ad",
};
const DARK = {
  "--surface": "#0f1222", "--surface-2": "#171b31", "--border": "#262b48", "--border-strong": "#374070",
  "--ink": "#eef0ff", "--muted": "#a4a9cc", "--faint": "#6c7299",
};

export const LOOKS: LookDef[] = [
  {
    key: "classic", name: "Classic", hi: "क्लासिक", blurb: "Clean and familiar — works for every trade.", tone: "light",
    headFont: "Inter", vars: { ...LIGHT, "--r": "1rem" }, header: "banner",
    cover: (t) => `linear-gradient(120deg, ${t}, ${t}aa)`, swatch: ["#2f5bf5", "#19c8f0"],
  },
  {
    key: "gradient", name: "Gradient", hi: "ग्रेडिएंट", blurb: "Your colour melting into night — modern and bright.", tone: "light",
    headFont: "Plus Jakarta Sans", vars: { ...LIGHT, "--r": "1.25rem" }, header: "banner",
    cover: (t) => `linear-gradient(135deg, ${t}, ${t}cc 55%, #0b1214)`, swatch: ["#6d5cf5", "#0b1214"],
  },
  {
    key: "minimal", name: "Minimal", hi: "मिनिमल", blurb: "White space, thin lines, nothing shouting.", tone: "light",
    headFont: "Inter", vars: { ...LIGHT, "--surface-2": "#fafafc", "--r": "0.75rem" }, header: "strip",
    cover: () => "var(--surface-2)", swatch: ["#f4f4f7", "#c9ccd8"],
    css: `.look-sec{background:transparent;border:1px solid var(--border)} .look-title{letter-spacing:.18em}`,
  },
  {
    key: "dark", name: "Dark", hi: "डार्क", blurb: "Deep charcoal with your colour as the only light.", tone: "dark",
    headFont: "Inter", vars: { ...DARK, "--r": "1rem" }, header: "banner",
    cover: () => "linear-gradient(135deg, #0d1a1c, #12242a)", swatch: ["#0d1a1c", "#12242a"],
  },
  {
    key: "photo", name: "Photo", hi: "फ़ोटो", blurb: "A big banner photo on top — for shops and studios.", tone: "light",
    headFont: "Inter", vars: { ...LIGHT, "--r": "1.25rem" }, header: "tall",
    cover: (t) => `linear-gradient(135deg, ${t}, ${t}aa)`, swatch: ["#e5673b", "#f2a33c"],
  },
  {
    key: "bold", name: "Bold", hi: "बोल्ड", blurb: "Heavy type, strong colour blocks.", tone: "light",
    headFont: "Manrope", vars: { ...LIGHT, "--r": "0.6rem" }, header: "banner",
    cover: (t) => `linear-gradient(160deg, ${t}, #0b1214)`, swatch: ["#d24b4b", "#0b1214"],
    css: `h1,h2,.look-head{font-weight:800;letter-spacing:-.02em} .look-btn{border-radius:.5rem;text-transform:uppercase;letter-spacing:.06em;font-size:.78rem}`,
  },
  // ---- new looks (Sep 2026) ----
  {
    key: "royal", name: "Royal", hi: "रॉयल", blurb: "Midnight navy, gold rule lines, serif name — jewellers, boutiques, premium services.", tone: "dark",
    headFont: "Cormorant Garamond", bodyFont: "Inter",
    vars: { "--surface": "#0b1230", "--surface-2": "#121a3d", "--border": "#2a3467", "--border-strong": "#3e4a8a", "--ink": "#f4efe1", "--muted": "#b9b6d6", "--faint": "#7f7fa8", "--r": "0.9rem", "--look-gold": "#d6b25e" },
    header: "banner",
    cover: (t) => `radial-gradient(120% 90% at 0% 0%, ${t}66, transparent 60%), linear-gradient(160deg, #0b1230, #1a1f4f)`,
    swatch: ["#0b1230", "#d6b25e"],
    css: `h1{font-size:2rem;font-weight:600;letter-spacing:.01em} .look-title{color:var(--look-gold);letter-spacing:.22em} .look-title::after{content:"";display:block;width:2.5rem;height:1px;background:var(--look-gold);margin-top:.5rem} .look-sec{border:1px solid #2a3467;background:linear-gradient(180deg,#121a3d,#0e1536)} .look-btn{border-radius:.5rem} .look-quick{border-radius:999px;background:transparent!important;border:1px solid var(--look-gold);color:var(--look-gold)!important;box-shadow:none} .look-tagline{color:var(--look-gold)!important;font-style:italic}`,
  },
  {
    key: "glass", name: "Glass", hi: "ग्लास", blurb: "Frosted glass over soft colour clouds — tech, salons, cafés.", tone: "light",
    headFont: "Plus Jakarta Sans",
    vars: { ...LIGHT, "--surface": "#f7f8ff", "--surface-2": "rgba(255,255,255,.72)", "--border": "rgba(120,130,190,.22)", "--r": "1.4rem" },
    header: "glass",
    cover: (t) => `radial-gradient(60% 80% at 15% 20%, ${t}cc, transparent 70%), radial-gradient(50% 70% at 85% 30%, #ff8ad855, transparent 70%), radial-gradient(70% 60% at 50% 100%, #38c6ff66, transparent 70%), linear-gradient(180deg, #eef1ff, #f7f8ff)`,
    swatch: ["#8fb3ff", "#ffb3e6"],
    css: `.look-sec{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 30px -18px rgba(40,50,120,.35);border:1px solid rgba(255,255,255,.7)} .look-btn{border-radius:999px} .look-quick{border-radius:999px} .look-tabs{backdrop-filter:blur(14px)}`,
  },
  {
    key: "corporate", name: "Corporate", hi: "कॉर्पोरेट", blurb: "Square corners, left-aligned, a colour bar — consultants, CA, real estate, B2B.", tone: "light",
    headFont: "Manrope",
    vars: { ...LIGHT, "--surface-2": "#f5f6fa", "--r": "0.35rem" },
    header: "split",
    cover: (t) => `linear-gradient(90deg, ${t} 0 38%, #ffffff 38%)`,
    swatch: ["#1e3a8a", "#e5e7eb"],
    css: `h1{letter-spacing:-.01em} .look-title{letter-spacing:.14em;color:var(--ink);font-weight:700} .look-sec{border-left:3px solid var(--theme);border-radius:.25rem} .look-btn{border-radius:.3rem} .look-quick{border-radius:.3rem} .look-avatar{border-radius:.4rem!important}`,
  },
  {
    key: "earthy", name: "Earthy", hi: "अर्दी", blurb: "Warm cream paper, terracotta and olive, a gentle serif — ayurveda, food, handmade, wellness.", tone: "light",
    headFont: "Lora", bodyFont: "Inter",
    vars: { "--surface": "#fbf6ee", "--surface-2": "#f3eadb", "--border": "#e6d9c3", "--border-strong": "#cdbb9c", "--ink": "#2f261d", "--muted": "#6f6252", "--faint": "#a0917c", "--r": "1.1rem" },
    header: "banner",
    cover: (t) => `linear-gradient(135deg, ${t}, #b86a3a)`,
    swatch: ["#b86a3a", "#7f8f5a"],
    css: `h1{font-weight:600} .look-title{color:#8a6a45;letter-spacing:.16em} .look-sec{box-shadow:none;border:1px solid #e6d9c3} .look-btn{border-radius:999px}`,
  },
  {
    key: "neon", name: "Neon", hi: "नियॉन", blurb: "Black, with your colour glowing — gyms, DJs, gaming, night cafés.", tone: "dark",
    headFont: "Space Grotesk",
    vars: { "--surface": "#07070d", "--surface-2": "#101018", "--border": "#232336", "--border-strong": "#3a3a58", "--ink": "#f5f5ff", "--muted": "#a9a9c8", "--faint": "#6b6b8c", "--r": "0.8rem" },
    header: "banner",
    cover: (t) => `radial-gradient(70% 120% at 80% 0%, ${t}99, transparent 60%), linear-gradient(180deg, #0b0b14, #07070d)`,
    swatch: ["#07070d", "#39ff88"],
    css: `h1{text-transform:uppercase;letter-spacing:.04em;font-weight:700} .look-title{color:var(--theme);letter-spacing:.24em} .look-sec{border:1px solid #232336;box-shadow:inset 0 0 0 1px rgba(255,255,255,.02)} .look-btn{box-shadow:0 0 24px -4px var(--theme)!important} .look-quick{box-shadow:0 0 18px -4px var(--theme)} .look-avatar{box-shadow:0 0 0 2px var(--theme),0 0 30px -6px var(--theme)}`,
  },
  {
    key: "editorial", name: "Editorial", hi: "एडिटोरियल", blurb: "Magazine layout: huge serif name, thin rules, one accent — designers, writers, photographers, doctors.", tone: "light",
    headFont: "Playfair Display", bodyFont: "Inter",
    vars: { ...LIGHT, "--surface": "#fffdf9", "--surface-2": "#fffdf9", "--border": "#e9e4da", "--r": "0.2rem" },
    header: "editorial",
    cover: () => "#fffdf9",
    swatch: ["#fffdf9", "#1a1a1a"],
    css: `h1{font-size:2.35rem;line-height:1.05;font-weight:500;letter-spacing:-.01em} .look-title{font-family:var(--look-head);text-transform:none;letter-spacing:0;font-size:1.05rem;font-style:italic;color:var(--ink);border-bottom:1px solid var(--border);padding-bottom:.35rem} .look-sec{border:0;border-top:1px solid var(--border);border-radius:0;padding-left:0;padding-right:0;background:transparent} .look-btn{border-radius:0;border:1px solid var(--ink)!important;background:transparent!important;color:var(--ink)!important;box-shadow:none!important} .look-quick{border-radius:0;background:var(--ink)!important} .look-tabs a{text-transform:uppercase;letter-spacing:.12em;font-size:.7rem}`,
  },
];

export const LOOK_KEYS = LOOKS.map((l) => l.key);
export const lookOf = (key?: string | null): LookDef => LOOKS.find((l) => l.key === key) ?? LOOKS[0];

/** Families without an 800 weight on Google Fonts. The css2 API answers 400 Bad Request to a request that names a
 *  weight a family does not have — and then NO font of that request loads (Royal and Earthy fell back to Inter). */
const NO_800 = new Set(["Cormorant Garamond", "Lora", "Space Grotesk"]);
/** Google Fonts URL for the families a look needs (Inter is the site default and needs no request). */
export function lookFontHref(look: LookDef): string {
  const fams = Array.from(new Set([look.headFont, look.bodyFont ?? look.headFont])).filter((f) => f !== "Inter");
  if (!fams.length) return "";
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700${NO_800.has(f) ? "" : ";800"}`).join("&")}&display=swap`;
}

/** A card colour as "#rgb" … "#rrggbbaa", else the fallback. The theme colour goes into a <style> tag as raw text, so a
 *  crafted value ("red}</style><script>…") would run on every visitor's browser (owner's review, 28 Sep 2026). */
export function safeColor(c: unknown, fallback = "#0e9e90"): string {
  const v = typeof c === "string" ? c.trim() : "";
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
}

/** The CSS one card needs: variables on the root, then the look's scoped rules. */
export function lookCss(look: LookDef, rawTheme: string): string {
  const theme = safeColor(rawTheme);
  const head = `'${look.headFont}', Inter, system-ui, sans-serif`;
  const body = `'${look.bodyFont ?? look.headFont}', Inter, system-ui, sans-serif`;
  const vars = Object.entries({ ...look.vars, "--theme": theme, "--look-head": head, "--look-body": body }).map(([k, v]) => `${k}:${v}`).join(";");
  const s = `[data-look="${look.key}"]`;
  const base = [
    `${s}{${vars};font-family:var(--look-body);color:var(--ink)}`,
    `${s} h1,${s} h2,${s} h3,${s} .look-head{font-family:var(--look-head)}`,
    `${s} .look-sec{border-radius:var(--r)}`,
    `${s} .look-btn{border-radius:calc(var(--r) * .8)}`,
    `${s} .look-quick{border-radius:calc(var(--r) * .75)}`,
    `${s} .rounded-2xl{border-radius:var(--r)}`,
    `${s} .rounded-xl{border-radius:calc(var(--r) * .8)}`,
    `${s} .rounded-lg{border-radius:calc(var(--r) * .6)}`,
  ].join("");
  const extra = (look.css ?? "").replace(/(^|\})\s*([^{}]+)\{/g, (_m, brace, sel) => `${brace}${sel.split(",").map((x: string) => `${s} ${x.trim()}`).join(",")}{`);
  return base + extra;
}
