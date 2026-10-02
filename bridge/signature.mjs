// "Signature" poster looks (owner's design, 29–30 Sep 2026): one spec → the 4:5 master (FB / IG feed), the 9:16 frame
// (WhatsApp Status, Story, Reel — with the voice line as a subtitle) and the 1:1 (Google Business). Two looks:
//   vibrant — white page, brand-gradient brush headline, icon chips for the business's USPs, real photo, WhatsApp CTA
//   classic — photo window over a deep panel, gold rules, monogram seal, serif Hindi (Tiro Devanagari)
// Everything is drawn here (SVG + sharp); the only picture is a real photo (stock / the owner's own). No AI, ₹0.
import "./fonts-setup.mjs";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_MARK = path.join(__dirname, "..", "public", "brand", "shubhora-mark.png");
// emoji never reach the SVG (the fonts have no colour glyphs → tofu boxes); quotes are kept — SVG text nodes allow them
const esc = (s) => String(s ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// CSS font-family: a name with a digit or spaces must be quoted ("Baloo 2" unquoted is an invalid value — librsvg then
// drops the whole list and falls back to a serif). Every name here is already quoted for the SVG.
const LAT = "'Poppins'", DEV = "'Baloo 2'", DEV2 = "'Mukta'", SCRIPT = "'Lora'", SERIF = "'Playfair Display'", SERIF_DEV = "'Tiro Devanagari Hindi'";
const GOLD = "#d9b25f", GOLD2 = "#f1d48a", CREAM = "#fbf5e8";
export const LOOKS = ["vibrant", "classic"];

/* ---------------- colour ---------------- */
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return { h, s, l };
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}
/** The business's own palette from its accent colour (category default or the owner's pick). */
export function paletteFor(look, accent) {
  const hsl = hexToHsl(accent) || { h: 265, s: 0.8, l: 0.55 };
  if (look === "classic") return { deep: hslToHex(hsl.h, Math.max(0.35, hsl.s * 0.7), 0.17), deeper: hslToHex(hsl.h, Math.max(0.35, hsl.s * 0.7), 0.09), accent: hslToHex(hsl.h, hsl.s, 0.55) };
  // warm accents (orange, red, pink, yellow) run toward pink; cool ones (blue, green, teal, purple) toward magenta —
  // both end in the vivid, "ad-like" gradients of the reference posters instead of muddy in-between hues
  const warm = hsl.h < 90 || hsl.h >= 300, dir = warm ? -1 : 1;
  const s = Math.max(0.78, hsl.s), a = hslToHex(hsl.h, s, 0.53), b = hslToHex(hsl.h + dir * 30, s, 0.55), c = hslToHex(hsl.h + dir * 75, s, 0.57);
  return { a, b, c, ink: hslToHex(hsl.h, 0.55, 0.16), accent: a };
}

/* ---------------- icons (100×100 box, white) ---------------- */
const ICON = {
  truck: `<rect x="14" y="34" width="44" height="30" rx="5" fill="#fff"/><path d="M58 42 h14 l12 12 v10 h-26 Z" fill="#fff"/><circle cx="30" cy="70" r="8" fill="#fff" stroke="#0004" stroke-width="3"/><circle cx="70" cy="70" r="8" fill="#fff" stroke="#0004" stroke-width="3"/>`,
  leaf: `<path d="M24 76 C 26 44, 50 24, 80 24 C 80 56, 60 78, 30 76 Z" fill="#fff"/><path d="M28 74 C 40 56, 54 44, 74 30" stroke="#0005" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  rupee: `<text x="50" y="68" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="50" fill="#fff">₹</text>`,
  clock: `<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="7"/><path d="M50 30 V52 L64 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
  tag: `<path d="M22 22 h30 l30 30 -30 30 -30 -30 Z" fill="#fff"/><circle cx="36" cy="36" r="6" fill="#0006"/>`,
  star: `<path d="M50 18 L60 40 L84 42 L66 58 L72 82 L50 69 L28 82 L34 58 L16 42 L40 40 Z" fill="#fff"/>`,
  scissors: `<circle cx="32" cy="66" r="10" fill="none" stroke="#fff" stroke-width="7"/><circle cx="68" cy="66" r="10" fill="none" stroke="#fff" stroke-width="7"/><path d="M38 58 L70 22 M62 58 L30 22" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`,
  sparkle: `<path d="M50 14 L58 42 L86 50 L58 58 L50 86 L42 58 L14 50 L42 42 Z" fill="#fff"/>`,
  home: `<path d="M18 52 L50 22 L82 52" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 48 V78 H72 V48" fill="#fff"/>`,
  gift: `<rect x="20" y="42" width="60" height="38" rx="5" fill="#fff"/><rect x="16" y="30" width="68" height="14" rx="4" fill="#fff"/><rect x="46" y="30" width="8" height="50" fill="#0005"/>`,
  users: `<circle cx="40" cy="38" r="11" fill="#fff"/><circle cx="66" cy="42" r="9" fill="#fff"/><path d="M18 74 c0-14 10-22 22-22 s22 8 22 22 Z" fill="#fff"/><path d="M60 74 c0-10 6-18 16-18 s10 8 10 18 Z" fill="#fff" opacity="0.85"/>`,
  wa: `<circle cx="50" cy="48" r="28" fill="none" stroke="#fff" stroke-width="7"/><path d="M34 70 L26 84 L44 76 Z" fill="#fff"/><path d="M40 38 c0 14 10 24 24 24 l4-6 -8-4 -3 4 c-5-2-9-6-11-11 l4-3 -4-8 Z" fill="#fff"/>`,
  shield: `<path d="M50 14 L80 26 V50 C80 68 66 80 50 88 C34 80 20 68 20 50 V26 Z" fill="#fff"/><path d="M36 50 L46 60 L66 40" fill="none" stroke="#0006" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  check: `<circle cx="50" cy="50" r="32" fill="#fff"/><path d="M34 51 L45 62 L68 38" fill="none" stroke="#0006" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  phone: `<path d="M30 18 h26 a8 8 0 0 1 8 8 v48 a8 8 0 0 1 -8 8 h-26 a8 8 0 0 1 -8 -8 v-48 a8 8 0 0 1 8 -8 Z" fill="#fff"/><rect x="28" y="28" width="30" height="42" fill="#0005"/>`,
  pin: `<path d="M50 14 C34 14 24 26 24 40 C24 60 50 86 50 86 S76 60 76 40 C76 26 66 14 50 14 Z" fill="#fff"/><circle cx="50" cy="40" r="10" fill="#0006"/>`,
  heart: `<path d="M50 84 C 20 62 12 46 20 32 C 28 20 44 22 50 34 C 56 22 72 20 80 32 C 88 46 80 62 50 84 Z" fill="#fff"/>`,
  stetho: `<path d="M30 16 v26 a20 20 0 0 0 40 0 v-26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M50 62 v8 a16 16 0 0 0 32 0 v-8" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="82" cy="54" r="8" fill="#fff"/>`,
  book: `<path d="M18 24 h28 a6 6 0 0 1 6 6 v50 a6 6 0 0 0 -6 -6 h-28 Z" fill="#fff"/><path d="M82 24 h-28 a6 6 0 0 0 -6 6 v50 a6 6 0 0 1 6 -6 h28 Z" fill="#fff" opacity="0.85"/>`,
  cart: `<path d="M16 22 h12 l10 40 h38 l8 -28 h-50" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="42" cy="76" r="7" fill="#fff"/><circle cx="70" cy="76" r="7" fill="#fff"/>`,
  tools: `<path d="M22 78 L58 42" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M56 26 a16 16 0 1 0 18 18 l8 -8 -10 -10 -8 8 Z" fill="#fff"/>`,
  camera: `<rect x="16" y="32" width="68" height="46" rx="8" fill="#fff"/><rect x="36" y="22" width="28" height="12" rx="3" fill="#fff"/><circle cx="50" cy="55" r="14" fill="#0006"/><circle cx="50" cy="55" r="8" fill="#fff"/>`,
  cake: `<rect x="20" y="52" width="60" height="30" rx="6" fill="#fff"/><path d="M20 62 q10 -8 20 0 t20 0 t20 0" fill="none" stroke="#0005" stroke-width="5"/><rect x="46" y="28" width="8" height="24" fill="#fff"/><circle cx="50" cy="22" r="6" fill="#fff"/>`,
  car: `<path d="M18 56 L28 36 h44 l10 20 v18 h-12 v-8 h-40 v8 h-12 Z" fill="#fff"/><circle cx="34" cy="74" r="8" fill="#fff" stroke="#0005" stroke-width="3"/><circle cx="66" cy="74" r="8" fill="#fff" stroke="#0005" stroke-width="3"/>`,
  image: `<rect x="18" y="24" width="64" height="52" rx="8" fill="none" stroke="#fff" stroke-width="7"/><circle cx="38" cy="42" r="6" fill="#fff"/><path d="M24 70 L44 52 L56 62 L66 54 L78 70" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>`,
  play: `<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="7"/><path d="M43 36 L64 50 L43 64 Z" fill="#fff"/>`,
  card: `<rect x="16" y="26" width="68" height="48" rx="8" fill="none" stroke="#fff" stroke-width="7"/><circle cx="36" cy="46" r="7" fill="#fff"/><rect x="50" y="40" width="22" height="6" rx="3" fill="#fff"/><rect x="50" y="52" width="22" height="6" rx="3" fill="#fff"/>`,
  ai: `<rect x="24" y="24" width="52" height="52" rx="12" fill="none" stroke="#fff" stroke-width="7"/><text x="50" y="61" text-anchor="middle" font-family="'Poppins'" font-weight="800" font-size="28" fill="#fff">AI</text>`,
  chart: `<g fill="#fff"><rect x="22" y="56" width="12" height="22" rx="3"/><rect x="42" y="44" width="12" height="34" rx="3"/><rect x="62" y="32" width="12" height="46" rx="3"/></g><path d="M20 40 L46 26 L60 34 L80 18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  globe: `<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="7"/><ellipse cx="50" cy="50" rx="13" ry="30" fill="none" stroke="#fff" stroke-width="6"/><path d="M20 50 H80 M26 35 H74 M26 65 H74" stroke="#fff" stroke-width="5"/>`,
  profile: `<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="7"/><circle cx="50" cy="42" r="10" fill="#fff"/><path d="M30 72 c4-12 12-16 20-16 s16 4 20 16" fill="#fff"/>`,
  cloud: `<path d="M32 70 h38 a14 14 0 0 0 2 -28 a20 20 0 0 0 -38 -6 a16 16 0 0 0 -2 34 Z" fill="#fff"/>`,
  sun: `<circle cx="50" cy="50" r="18" fill="#fff"/><g stroke="#fff" stroke-width="6" stroke-linecap="round"><path d="M50 14 v10 M50 76 v10 M14 50 h10 M76 50 h10 M24 24 l7 7 M69 69 l7 7 M24 76 l7 -7 M69 31 l7 -7"/></g>`,
};
const ICON_WORDS = [
  [/deliver|डिलीवर|home ?delivery|shipping|courier/i, "truck"], [/fresh|ताज़ा|ताजा|organic|शुद्ध|pure/i, "leaf"], [/upi|cash|₹|price|रेट|emi|payment|paytm|gpay/i, "rupee"],
  [/\d\s?(am|pm)\b|बजे|खुला|\bopen\b|hours|समय|24\s?[x×]|घंटे|same.day|on.time|उसी दिन/i, "clock"], [/offer|\bsale\b|\boff\b|छूट|discount|wholesale|combo|थोक/i, "tag"], [/hair|\bcut\b|salon|बाल/i, "scissors"],
  [/facial|glow|skin|makeup|beauty|spa|निखार/i, "sparkle"], [/bridal|wedding|शादी|दुल्हन|premium|best|quality|top/i, "star"], [/home visit|घर|visit|door/i, "home"],
  [/gift|package|पैक|free/i, "gift"], [/family|team|group|परिवार|members|staff|customers/i, "users"], [/whatsapp|chat|reply/i, "wa"], [/trust|भरोसा|guarantee|warranty|insur|safe|secure/i, "shield"],
  [/verified|certified|iso|licen|expert|experience|अनुभव/i, "check"], [/call|phone|mobile|repair/i, "phone"], [/location|map|near|address|पता|branch/i, "pin"], [/care|love|health|स्वास्थ्य|wellness/i, "heart"],
  [/doctor|clinic|consult|checkup|\blab\b|\btests?\b|dental|डॉक्टर|जाँच|वैद्य/i, "stetho"], [/class|course|coaching|study|school|tuition|\bbook\b|पढ़ाई|कोर्स|शिक्षक|बैच/i, "book"], [/\bshop\b|order|grocery|cart|store|खरीद|stock|स्टॉक/i, "cart"],
  [/service|repair|install|fitting|tools|maintenance|सर्विस/i, "tools"], [/photo|camera|shoot|video|studio/i, "camera"], [/cake|bakery|sweet|मिठाई|birthday|घी/i, "cake"], [/\bcar\b|bike|\bauto\b|taxi|travel|\btour|\bride\b|vehicle|गाड़ि|transport|flight|train|\bbus\b/i, "car"],
  [/poster|design/i, "image"], [/\bai\b|smart/i, "ai"], [/growth|business|profit|sales|placement|emi|loan|sip\b/i, "chart"], [/language|भाषा|multi|india|भारत/i, "globe"], [/profile|account/i, "profile"], [/more|cloud|और/i, "cloud"], [/morning|सुबह|\bsun\b|\bday\b/i, "sun"],
];
export function iconFor(text, fallback = "star") { const t = String(text || ""); for (const [re, k] of ICON_WORDS) if (re.test(t)) return k; return fallback; }

/* ---------------- text helpers ---------------- */
const isDev = (ch) => /[ऀ-ൿ]/.test(ch);
/** rough advance width of a string at 1px font size */
const measure = (s) => [...String(s || "")].reduce((a, ch) => a + (isDev(ch) ? (/[\u093E-\u094D\u0951-\u0954\u0962\u0963]/.test(ch) ? 0.2 : 0.72) : /[A-Z]/.test(ch) ? 0.68 : /[ilj.,:;' ]/.test(ch) ? 0.32 : 0.58), 0);
/** wrap words to a pixel width at a font size; at most `max` lines (last one gets an ellipsis) */
function wrap(text, size, width, max = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean), lines = []; let cur = "";
  for (const w of words) { const next = (cur + " " + w).trim(); if (measure(next) * size > width && cur) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur);
  if (lines.length > max) { const cut = lines.slice(0, max); cut[max - 1] = cut[max - 1].replace(/[,.।]?$/, "") + "…"; return cut; }
  return lines;
}
/** biggest font size (≤ hi) at which the text fits on one line of `width` px, never below lo */
const fitSize = (text, width, hi, lo) => Math.max(lo, Math.min(hi, Math.floor(width / Math.max(0.1, measure(text)))));
/** The business name in full, never "NATIONAL ACADEMY…" (owner's call, 2 Oct 2026): one line shrunk down to `lo`,
 *  and when even that does not fit, two lines at `two` px. → { lines, size } */
function nameLines(text, width, hi, lo, two) {
  const name = String(text || "").replace(/\s+/g, " ").trim();
  if (measure(name) * lo <= width) return { lines: [name], size: fitSize(name, width, hi, lo) };
  const lines = wrap(name, two, width, 2);
  return { lines, size: two };
}

/* ---------------- shared drawing ---------------- */
function brush(x, y, w, h, rot = -1.6) {
  const j = (a, b) => a + (Math.sin(b * 12.9898) * 43758.5453 % 1) * 10 - 5;
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push([x + (w * i) / 12, j(y, i)]);
  for (let i = 12; i >= 0; i--) pts.push([x + (w * i) / 12, j(y + h, i + 20)]);
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ") + " Z";
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"><path d="${d}" fill="url(#brand)" opacity="0.97"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/></g>`;
}
const waIcon = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ee0a0"/><stop offset="1" stop-color="#17b26a"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#g)"/><circle cx="50" cy="48" r="28" fill="none" stroke="#fff" stroke-width="7"/><path d="M34 70 L26 84 L44 76 Z" fill="#fff"/><path d="M40 38 c0 14 10 24 24 24 l4-6 -8-4 -3 4 c-5-2-9-6-11-11 l4-3 -4-8 Z" fill="#fff"/></svg>`);
async function brandMark(h) { try { return await sharp(BRAND_MARK).resize({ height: h }).png().toBuffer(); } catch { return null; } }
async function logoBadge(spec, size, radius, fill) {
  // the owner's logo on a white tile, else the initial on a brand tile
  if (spec.logo && fs.existsSync(spec.logo)) {
    try {
      const inner = await sharp(spec.logo).resize(size - 16, size - 16, { fit: "inside" }).png().toBuffer();
      const m = await sharp(inner).metadata();
      const tile = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#ffffff"/></svg>`);
      return sharp(tile).composite([{ input: inner, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }]).png().toBuffer();
    } catch { /* fall through to the initial */ }
  }
  const ch = [...String(spec.name || "S").trim()][0]?.toUpperCase() || "S";
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs>${fill}</defs><rect width="${size}" height="${size}" rx="${radius}" fill="url(#brand)"/><text x="${size / 2}" y="${size * 0.68}" text-anchor="middle" font-family="${LAT}, ${DEV}" font-weight="800" font-size="${size * 0.54}" fill="#fff">${esc(ch)}</text></svg>`)).png().toBuffer();
}
/** the photo, fitted (never stretched) inside a box, melting into the page on its left and top */
/** the source photo, optionally cut to `box` ({left, top, width, height}) first */
async function source(file, box) {
  const img = sharp(file);
  if (box && box.width > 0 && box.height > 0) { const m = await img.metadata(); if (box.left + box.width <= m.width && box.top + box.height <= m.height) return sharp(await img.extract(box).png().toBuffer()); }
  return img;
}
async function heroFeathered(file, maxW, maxH, mode = "photo", box = null) {
  const src = await source(file, box);
  const meta = await src.metadata();
  const k = Math.min(maxW / meta.width, maxH / meta.height);
  const w = Math.max(2, Math.round(meta.width * k)), h = Math.max(2, Math.round(meta.height * k));
  let img = await src.resize(w, h).png().toBuffer();
  if (mode === "cutout") return { buf: img, w, h };   // a drawn product picture (phone / laptop) with its own shadow
  if (mode === "card") {
    // a square / upright photo: rounded corners and a shadow, no feathering (it would look cut off)
    const pad = 24, r = 28;
    img = await sharp(img).composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`), blend: "dest-in" }]).png().toBuffer();
    const card = Buffer.from(`<svg width="${w + pad * 2}" height="${h + pad * 2}"><defs><filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.22"/></filter></defs><rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="${r}" fill="#fff" filter="url(#s)"/></svg>`);
    return { buf: await sharp(card).composite([{ input: img, left: pad, top: pad }]).png().toBuffer(), w: w + pad * 2, h: h + pad * 2 };
  }
  if (mode === "product") {
    // a product shot sits on a soft white card with a shadow instead of melting into the page
    const pad = 28;
    const card = Buffer.from(`<svg width="${w + pad * 2}" height="${h + pad * 2}"><defs><filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.18"/></filter></defs><rect x="${pad / 2}" y="${pad / 2}" width="${w + pad}" height="${h + pad}" rx="26" fill="#fff" filter="url(#s)"/></svg>`);
    return { buf: await sharp(card).composite([{ input: img, left: pad, top: pad }]).png().toBuffer(), w: w + pad * 2, h: h + pad * 2 };
  }
  const fadeL = Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.26" stop-color="#fff"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#a)"/></svg>`);
  const fadeT = Buffer.from(`<svg width="${w}" height="${h}"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.32" stop-color="#fff"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#b)"/></svg>`);
  img = await sharp(img).ensureAlpha().composite([{ input: fadeL, blend: "dest-in" }]).png().toBuffer();
  return { buf: await sharp(img).composite([{ input: fadeT, blend: "dest-in" }]).png().toBuffer(), w, h };
}
async function photoWindow(file, w, h, mode = "photo", bg = "#1a1a2e", box = null, safeTop = 0) {
  const src = await source(file, box);
  if (mode === "cutout") {
    // a drawn product picture (phone / laptop, own shadow) straight on the panel, below the header
    const room = h - safeTop - 40;
    const inner = await src.resize(Math.round(w * 0.86), Math.round(room), { fit: "inside" }).png().toBuffer();
    const m = await sharp(inner).metadata();
    const back = Buffer.from(`<svg width="${w}" height="${h}"><defs><radialGradient id="g" cx="0.5" cy="0.4" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></radialGradient></defs><rect width="${w}" height="${h}" fill="${bg}"/><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
    return sharp(back).composite([{ input: inner, left: Math.round((w - m.width) / 2), top: Math.round(safeTop + (room - m.height) / 2) + 6 }]).png().toBuffer();
  }
  if (mode === "product") {
    // the product on a white card (rounded, soft shadow) floating on the deep panel, below the header (safeTop) —
    // a plain cut-out or a shop photo both read well
    const room = h - safeTop - 70, pad = 26;
    const inner = await src.resize(Math.round(Math.min(w * 0.6, room)) - pad * 2, Math.round(room) - pad * 2, { fit: "inside" }).png().toBuffer();
    const m = await sharp(inner).metadata(), cw = m.width + pad * 2, ch = m.height + pad * 2;
    const cx = Math.round((w - cw) / 2), cy = Math.round(safeTop + (room - ch) / 2) + 10;
    const back = Buffer.from(`<svg width="${w}" height="${h}"><defs><radialGradient id="g" cx="0.5" cy="0.4" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></radialGradient><filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.45"/></filter></defs><rect width="${w}" height="${h}" fill="${bg}"/><rect width="${w}" height="${h}" fill="url(#g)"/><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="28" fill="#ffffff" filter="url(#s)"/></svg>`);
    return sharp(back).composite([{ input: inner, left: cx + pad, top: cy + pad }]).png().toBuffer();
  }
  return src.resize(w, h, { fit: "cover", position: "attention" }).modulate({ saturation: 0.94 }).png().toBuffer();
}

/* ================= VIBRANT ================= */
const vibrantDefs = (p) => `
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.a}"/><stop offset="0.5" stop-color="${p.b}"/><stop offset="1" stop-color="${p.c}"/></linearGradient>
  <linearGradient id="brandV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.c}"/></linearGradient>
  <linearGradient id="c1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>
  <linearGradient id="c2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.b}"/><stop offset="1" stop-color="${p.c}"/></linearGradient>
  <linearGradient id="c3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17b26a"/><stop offset="1" stop-color="#5ee0a0"/></linearGradient>
  <linearGradient id="c4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="1" stop-color="#6fc4ff"/></linearGradient>
  <linearGradient id="c5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.c}"/><stop offset="1" stop-color="${p.a}"/></linearGradient>
  <radialGradient id="blob1" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${p.a}" stop-opacity="0.30"/><stop offset="1" stop-color="${p.a}" stop-opacity="0"/></radialGradient>
  <radialGradient id="blob2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${p.c}" stop-opacity="0.30"/><stop offset="1" stop-color="${p.c}" stop-opacity="0"/></radialGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="${p.ink}" flood-opacity="0.16"/></filter>
  <filter id="chipShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.18"/></filter>`;

function chipsRow(chips, y, W) {
  const n = Math.min(5, chips.length); if (!n) return "";
  const size = 108, step = 200, x0 = Math.round((W - (n - 1) * step - size) / 2);
  return chips.slice(0, 5).map((c, i) => {
    const x = x0 + i * step, r = size / 2, key = ICON[c.icon] ? c.icon : iconFor(`${c.label} ${c.sub || ""}`);
    const ls = fitSize(c.label, 196, 25, 19), label = wrap(c.label, ls, 196, 1)[0] || "", sub = c.sub ? (wrap(c.sub, 18, 190, 1)[0] || "") : "";
    return `<g transform="translate(${x},${y})"><circle cx="${r}" cy="${r}" r="${r}" fill="url(#c${(i % 5) + 1})" filter="url(#chipShadow)"/><g transform="translate(${r - 50},${r - 50})">${ICON[key]}</g>
      <text x="${r}" y="${size + 44}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="800" font-size="${ls}" fill="#22264f">${esc(label)}</text>
      ${sub ? `<text x="${r}" y="${size + 76}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="500" font-size="18" fill="#5b6080">${esc(sub)}</text>` : ""}</g>`;
  }).join("");
}
function vibrantHeader(spec, p, y) {
  const nm = nameLines(spec.name, 560, 46, 26, 28);
  const two = nm.lines.length > 1;
  const nameSvg = two
    ? `<text x="190" y="${y + 34}" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${nm.size}" fill="${p.ink}">${esc(nm.lines[0])}</text>
  <text x="190" y="${y + 66}" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${nm.size}" fill="${p.ink}">${esc(nm.lines[1])}</text>`
    : `<text x="190" y="${y + 50}" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${nm.size}" fill="${p.ink}">${esc(nm.lines[0])}</text>`;
  return `${nameSvg}
  <text x="190" y="${y + (two ? 96 : 90)}" font-family="${DEV2}, ${LAT}" font-weight="600" font-size="${two ? 22 : 25}" fill="#4b5090">${esc(wrap(spec.tagline, two ? 22 : 25, 560, 1)[0] || "")}</text>
  ${spec.script1 ? `<text x="1010" y="${y + 34}" text-anchor="end" font-family="${SCRIPT}" font-style="italic" font-weight="700" font-size="34" fill="url(#brand)">${esc(spec.script1)}</text>` : ""}
  ${spec.script2 ? `<text x="1010" y="${y + 74}" text-anchor="end" font-family="${SCRIPT}" font-style="italic" font-weight="700" font-size="34" fill="url(#brand)">${esc(spec.script2)}</text><path d="M760 ${y + 92} Q 890 ${y + 80} 1010 ${y + 88}" fill="none" stroke="url(#brand)" stroke-width="4" stroke-linecap="round"/>` : ""}`;
}
function vibrantHeadline(spec, p, y, W) {
  // one big line when it fits at ≥ 62 px, otherwise two lines at 60 px (the brush band grows with it)
  let h1size = fitSize(spec.h1, 900, 84, 40), lines = [spec.h1];
  if (h1size < 62) { lines = wrap(spec.h1, 60, 900, 2); h1size = lines.length > 1 ? 60 : h1size; }
  const extra = lines.length > 1 ? 66 : 0;
  const h2 = wrap(spec.h2, 34, 960, 2);
  const svg = `${brush(56, y, 968, 190 + extra)}
  <text x="92" y="${y + 72}" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${fitSize(spec.h0, 900, 44, 30)}" fill="${p.kick || "#ffffff"}">${esc(spec.h0)}</text>
  ${lines.map((l, i) => `<text x="92" y="${y + 156 + i * 66}" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${h1size}" fill="${p.hi || "#fff35c"}">${esc(l)}</text>`).join("")}
  ${h2.map((l, i) => `<text x="${W / 2}" y="${y + extra + 250 + i * 42}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="700" font-size="${h2.length > 1 ? 32 : 36}" fill="${p.ink}">${esc(l)}</text>`).join("")}`;
  return { svg, extra: extra + (h2.length > 1 ? 30 : 0) };
}
function vibrantCta(spec, p, y, small = false) {
  const s = small ? 0.86 : 1, h = Math.round(140 * s);
  return `<rect x="56" y="${y}" width="968" height="${h}" rx="${Math.round(34 * s)}" fill="#ffffff" filter="url(#shadow)"/>
  <text x="212" y="${y + Math.round(54 * s)}" font-family="${DEV2}, ${LAT}" font-weight="700" font-size="${Math.round(30 * s)}" fill="${p.ink}">${esc(spec.cta1)}</text>
  <text x="212" y="${y + Math.round(104 * s)}" font-family="${LAT}" font-weight="800" font-size="${Math.round(34 * s)}" fill="#17b26a">${esc(spec.cta2)}</text>
  <rect x="716" y="${y + Math.round(32 * s)}" width="278" height="${Math.round(76 * s)}" rx="${Math.round(38 * s)}" fill="url(#brand)" filter="url(#chipShadow)"/>
  <text x="855" y="${y + Math.round(82 * s)}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="800" font-size="${Math.round(fitSize(spec.btn, 250, 29, 20) * s)}" fill="#ffffff">${esc(spec.btn)}</text>`;
}
const badgeSvg = (b, cx, cy, ink, k = 1, fill = "#fff35c") => b ? `<g transform="rotate(-8 ${cx} ${cy}) translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})"><circle cx="${cx}" cy="${cy}" r="86" fill="${fill}" filter="url(#chipShadow)"/><text x="${cx}" y="${cy - 12}" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${fitSize(b[0], 140, 30, 18)}" fill="${ink}">${esc(b[0])}</text><text x="${cx}" y="${cy + 32}" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${fitSize(b[1], 140, 44, 22)}" fill="${ink}">${esc(b[1])}</text></g>` : "";
const footer = (spec, y, W, size) => `<text x="${W / 2 - 150}" y="${y}" font-family="${LAT}" font-weight="600" font-size="${size}" fill="#ffffff" opacity="0.95">${esc(spec.link)}</text>`;

/** Chips stacked down the left (the side layout): icon, heading, small line — one per row. */
function chipsColumn(chips, x, y, rowH, maxW) {
  const list = chips.slice(0, 5); if (!list.length) return "";
  return list.map((c, i) => {
    const cy = y + i * rowH, r = 38, key = ICON[c.icon] ? c.icon : iconFor(`${c.label} ${c.sub || ""}`);
    const ls = fitSize(c.label, maxW, 27, 20), label = wrap(c.label, ls, maxW, 1)[0] || "", sub = c.sub ? (wrap(c.sub, 18, maxW, 1)[0] || "") : "";
    return `<g transform="translate(${x},${cy})"><circle cx="${r}" cy="${r}" r="${r}" fill="url(#c${(i % 5) + 1})" filter="url(#chipShadow)"/><g transform="translate(${r - 36},${r - 36}) scale(0.72)">${ICON[key]}</g>
      <text x="${r * 2 + 22}" y="${r + (sub ? 2 : 10)}" font-family="${DEV2}, ${LAT}" font-weight="800" font-size="${ls}" fill="#22264f">${esc(label)}</text>
      ${sub ? `<text x="${r * 2 + 22}" y="${r + 30}" font-family="${DEV2}, ${LAT}" font-weight="500" font-size="18" fill="#5b6080">${esc(sub)}</text>` : ""}</g>`;
  }).join("");
}
/** "side" when the picture is a product shot or an upright / square photo (it needs height, not width), else "row". */
async function heroLayout(spec) {
  if (!spec.hero?.file || !fs.existsSync(spec.hero.file)) return "row";
  if (spec.hero.mode === "product") return "side";
  if (spec.hero.mode === "cutout") return "side";   // drawn product pictures are upright (phone / tablet)
  try { const m = await (await source(spec.hero.file, spec.hero.box)).metadata(); return m.width / m.height < 1.25 ? "side" : "row"; } catch { return "row"; }
}
async function vibrant45(spec) {
  const W = 1080, H = 1350, p = spec.palette, head = vibrantHeadline(spec, p, 196, W);
  const side = (await heroLayout(spec)) === "side", y0 = 500 + head.extra;
  // side layout: chips stacked on the left, the product / upright photo big on the right, down to the CTA
  const rowH = Math.min(100, Math.floor((1100 - y0) / Math.max(1, Math.min(5, (spec.chips || []).length))));
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${vibrantDefs(p)}</defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <circle cx="1010" cy="140" r="360" fill="url(#blob2)"/><circle cx="60" cy="760" r="330" fill="url(#blob1)"/>
  <path d="M0 1240 C 220 1180, 420 1330, 640 1260 S 980 1180, 1080 1250 V1350 H0 Z" fill="url(#brand)" opacity="0.92"/>
  <path d="M0 1290 C 240 1240, 460 1360, 700 1300 S 1000 1240, 1080 1300 V1350 H0 Z" fill="url(#brandV)" opacity="0.5"/>
  ${vibrantHeader(spec, p, 48)}
  ${head.svg}
  ${side ? chipsColumn(spec.chips || [], 56, y0 + 10, rowH, 330) : chipsRow(spec.chips || [], y0, W)}
  ${!side && spec.s1 ? `<text x="60" y="${820 + head.extra / 2}" font-family="${SCRIPT}" font-style="italic" font-weight="700" font-size="40" fill="url(#brand)">${esc(spec.s1)}</text>` : ""}
  ${!side && spec.s2 ? `<text x="60" y="${870 + head.extra / 2}" font-family="${SCRIPT}" font-style="italic" font-weight="700" font-size="40" fill="url(#brand)">${esc(spec.s2)}</text><path d="M60 ${892 + head.extra / 2} Q 200 ${880 + head.extra / 2} 330 ${888 + head.extra / 2}" fill="none" stroke="url(#brand)" stroke-width="4" stroke-linecap="round"/>` : ""}
  </svg>`;
  const top = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${vibrantDefs(p)}</defs>
  ${badgeSvg(spec.badge, side ? 1000 : 930, side ? y0 + 24 : 860 + head.extra, p.ink, side ? 0.8 : 1, p.badge || "#fff35c")}
  ${vibrantCta(spec, p, 1128)}
  ${footer(spec, 1326, W, 22)}</svg>`;
  const layers = [];
  if (spec.hero?.file && fs.existsSync(spec.hero.file)) {
    const cut = spec.hero.mode === "cutout";
    if (side) { const h = await heroFeathered(spec.hero.file, cut ? 600 : 520, 1104 - y0 - (cut ? -40 : 48), cut ? "cutout" : spec.hero.mode === "product" ? "product" : "card", spec.hero.box); layers.push({ input: h.buf, left: 1040 - h.w + (cut ? 0 : 24), top: 1112 - h.h + (cut ? 0 : 24) }); }
    else { const h = await heroFeathered(spec.hero.file, cut ? 720 : 840, cut ? 500 : 470, spec.hero.mode, spec.hero.box); layers.push({ input: h.buf, left: W - h.w - (cut ? 20 : 0), top: (cut ? 1120 : 1150) - h.h }); }
  }
  layers.push({ input: Buffer.from(top), left: 0, top: 0 });
  layers.push({ input: await logoBadge(spec, 112, 30, vibrantDefs(p)), left: 56, top: 48 });
  layers.push({ input: waIcon(112), left: 84, top: 1142 });
  const mark = await brandMark(26); if (mark) layers.push({ input: mark, left: W / 2 - 190, top: 1304 });
  return sharp(Buffer.from(base)).composite(layers).png().toBuffer();
}

async function vibrant916(spec, { subtitle = "", said = 0, plate = false } = {}) {
  const W = 1080, H = 1920, p = spec.palette, head = vibrantHeadline(spec, p, 416, W);
  const side = (await heroLayout(spec)) === "side", y0 = 716 + head.extra, bottom = plate || subtitle ? 1350 : 1560;
  const rowH = Math.min(104, Math.floor((bottom - y0) / Math.max(1, Math.min(5, (spec.chips || []).length))));
  const words = String(subtitle || "").split(/\s+/).filter(Boolean); const half = Math.ceil(words.length / 2);
  const ts = (ws, off) => ws.map((w, i) => `<tspan fill="${off + i < said ? p.b : "#22264f"}">${esc(w)}</tspan>`).join(" ");
  const subSize = fitSize(words.slice(0, half).join(" "), 840, 44, 30);
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${vibrantDefs(p)}</defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <circle cx="1010" cy="380" r="380" fill="url(#blob2)"/><circle cx="40" cy="1080" r="360" fill="url(#blob1)"/>
  <path d="M0 1700 C 220 1640, 420 1790, 640 1720 S 980 1640, 1080 1710 V1920 H0 Z" fill="url(#brand)" opacity="0.92"/>
  <path d="M0 1760 C 240 1710, 460 1830, 700 1770 S 1000 1710, 1080 1770 V1920 H0 Z" fill="url(#brandV)" opacity="0.5"/>
  ${vibrantHeader(spec, p, 268)}
  ${head.svg}
  ${side ? chipsColumn(spec.chips || [], 56, y0 + 10, rowH, 330) : chipsRow(spec.chips || [], y0, W)}
  ${!side && spec.s1 ? `<text x="60" y="${1040 + head.extra}" font-family="${SCRIPT}" font-style="italic" font-weight="700" font-size="40" fill="url(#brand)">${esc(spec.s1)}</text>` : ""}
  ${!side && spec.s2 ? `<text x="60" y="${1090 + head.extra}" font-family="${SCRIPT}" font-style="italic" font-weight="700" font-size="40" fill="url(#brand)">${esc(spec.s2)}</text><path d="M60 ${1112 + head.extra} Q 200 ${1100 + head.extra} 330 ${1108 + head.extra}" fill="none" stroke="url(#brand)" stroke-width="4" stroke-linecap="round"/>` : ""}
  </svg>`;
  const top = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${vibrantDefs(p)}</defs>
  ${badgeSvg(spec.badge, side ? 1000 : 930, side ? y0 + 24 : 1180 + head.extra, p.ink, side ? 0.8 : 1, p.badge || "#fff35c")}
  ${words.length ? `<rect x="90" y="1462" width="900" height="126" rx="26" fill="#ffffff" opacity="0.92" filter="url(#shadow)"/>
  <text x="${W / 2}" y="1512" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${subSize}">${ts(words.slice(0, half), 0)}</text>
  <text x="${W / 2}" y="1566" text-anchor="middle" font-family="${DEV}, ${LAT}" font-weight="800" font-size="${subSize}">${ts(words.slice(half), half)}</text>` : ""}
  ${vibrantCta(spec, p, 1600, true)}
  ${footer(spec, 1866, W, 24)}</svg>`;
  const layers = [];
  if (spec.hero?.file && fs.existsSync(spec.hero.file)) {
    const cut = spec.hero.mode === "cutout";
    if (side) { const h = await heroFeathered(spec.hero.file, cut ? 600 : 520, bottom - y0 - (cut ? -40 : 40), cut ? "cutout" : spec.hero.mode === "product" ? "product" : "card", spec.hero.box); layers.push({ input: h.buf, left: 1040 - h.w + (cut ? 0 : 24), top: bottom - h.h + (cut ? 8 : 24) }); }
    else { const h = await heroFeathered(spec.hero.file, cut ? 760 : 900, cut ? 520 : 480, spec.hero.mode, spec.hero.box); layers.push({ input: h.buf, left: W - h.w - (cut ? 20 : 0), top: (cut ? 1450 : 1475) - h.h }); }
  }
  layers.push({ input: Buffer.from(top), left: 0, top: 0 });
  layers.push({ input: await logoBadge(spec, 112, 30, vibrantDefs(p)), left: 56, top: 268 });
  layers.push({ input: waIcon(96), left: 84, top: 1610 });
  const mark = await brandMark(26); if (mark) layers.push({ input: mark, left: W / 2 - 190, top: 1844 });
  return sharp(Buffer.from(base)).composite(layers).png().toBuffer();
}

/* ================= CLASSIC ================= */
const classicDefs = (p) => `
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8923f"/><stop offset="0.5" stop-color="${GOLD2}"/><stop offset="1" stop-color="#b8923f"/></linearGradient>
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8923f"/><stop offset="0.5" stop-color="${GOLD2}"/><stop offset="1" stop-color="#b8923f"/></linearGradient>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.deep}"/><stop offset="1" stop-color="${p.deeper}"/></linearGradient>
  <linearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${p.deep}" stop-opacity="0"/><stop offset="1" stop-color="${p.deep}" stop-opacity="1"/></linearGradient>
  <linearGradient id="topVeil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="0.35" stop-color="#000" stop-opacity="0"/></linearGradient>
  <pattern id="lin" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="#fff" stroke-opacity="0.035" stroke-width="1"/></pattern>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.35"/></filter>`;
const diamond = (x, y, s = 7, fill = GOLD) => `<path d="M${x} ${y - s} L${x + s} ${y} L${x} ${y + s} L${x - s} ${y} Z" fill="${fill}"/>`;
const rule = (x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${(x1 + x2) / 2 - 22}" y2="${y}" stroke="url(#gold)" stroke-width="1.5"/>${diamond((x1 + x2) / 2, y)}<line x1="${(x1 + x2) / 2 + 22}" y1="${y}" x2="${x2}" y2="${y}" stroke="url(#gold)" stroke-width="1.5"/>`;
const frame = (W, H, inset) => `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" fill="none" stroke="url(#gold)" stroke-width="2"/><rect x="${inset + 10}" y="${inset + 10}" width="${W - (inset + 10) * 2}" height="${H - (inset + 10) * 2}" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="1"/>`;
const seal = (cx, cy, r, letter) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GOLD}" opacity="0.14"/><circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="none" stroke="url(#gold)" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="none" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="1"/><text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-family="${SERIF}, ${SERIF_DEV}" font-weight="700" font-size="${r * 1.05}" fill="${GOLD2}">${esc(letter)}</text>`;
function uspLine(items, cx, y, size = 24) {
  let list = items.slice(0, 4); if (!list.length) return "";
  const gap = 62, est = (s) => measure(s) * size * 1.06 + [...s].length * 1.5;
  const width = (l) => l.reduce((a, s) => a + est(s), 0) + gap * (l.length - 1);
  while (list.length > 2 && width(list) > 960) list = list.slice(0, -1);   // long labels: fewer of them rather than a cut-off line
  const total = width(list);
  let x = cx - total / 2, out = "";
  list.forEach((s, i) => { if (i) out += diamond(x - gap / 2, y - 8, 5); out += `<text x="${x}" y="${y}" font-family="${DEV2}, ${LAT}" font-weight="600" font-size="${size}" letter-spacing="1.5" fill="${CREAM}">${esc(s)}</text>`; x += est(s) + gap; });
  return out;
}
function classicHeader(spec, y, W) {
  const nm = nameLines(spec.name, spec.tag ? 520 : 760, 44, 24, 26);
  const two = nm.lines.length > 1;
  const nameSvg = two
    ? `<text x="196" y="${y + 28}" font-family="${SERIF}, ${SERIF_DEV}" font-weight="700" font-size="${nm.size}" fill="${CREAM}">${esc(nm.lines[0])}</text>
  <text x="196" y="${y + 58}" font-family="${SERIF}, ${SERIF_DEV}" font-weight="700" font-size="${nm.size}" fill="${CREAM}">${esc(nm.lines[1])}</text>`
    : `<text x="196" y="${y + 40}" font-family="${SERIF}, ${SERIF_DEV}" font-weight="700" font-size="${nm.size}" fill="${CREAM}">${esc(nm.lines[0])}</text>`;
  return `${nameSvg}
  <text x="198" y="${y + (two ? 82 : 76)}" font-family="${LAT}, ${DEV2}" font-weight="600" font-size="${two ? 17 : 19}" letter-spacing="4" fill="${GOLD2}">${esc(String(spec.tagline || "").toUpperCase().slice(0, 44))}</text>
  ${spec.tag ? `<rect x="${W - 66 - 250}" y="${y + 14}" width="250" height="52" rx="26" fill="#000" fill-opacity="0.35" stroke="${GOLD}" stroke-opacity="0.8" stroke-width="1.5"/>
  <text x="${W - 66 - 125}" y="${y + 49}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="700" font-size="${fitSize(spec.tag, 220, 22, 15)}" letter-spacing="2" fill="${GOLD2}">${esc(spec.tag)}</text>` : ""}`;
}
function classicBody(spec, p, y, W, { subtitle = "", said = 0, reserve = 0, maxY = 1e9 } = {}) {
  // the headline on one line when it fits at 56 px or more, otherwise two lines at 60 px
  let h1size = fitSize(spec.h1, 940, 92, 56), h1lines = [spec.h1];
  if (measure(spec.h1) * h1size > 940) { h1lines = wrap(spec.h1, 60, 940, 2); h1size = 60; }
  const h2 = wrap(spec.h2, 34, 940, 2);
  const words = String(subtitle || "").split(/\s+/).filter(Boolean); const half = Math.ceil(words.length / 2);
  const ts = (ws, off) => ws.map((w, i) => `<tspan fill="${off + i < said ? GOLD2 : CREAM}">${esc(w)}</tspan>`).join(" ");
  let cur = y;
  let out = h1lines.map((l, i) => `<text x="${W / 2}" y="${cur + 96 + i * 70}" text-anchor="middle" font-family="${SERIF_DEV}, ${SERIF}" font-size="${h1size}" fill="${CREAM}">${esc(l)}</text>`).join("");
  cur += 96 + 24 + (h1lines.length - 1) * 70;
  h2.forEach((l, i) => { out += `<text x="${W / 2}" y="${cur + 40 + i * 42}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="400" font-size="${h2.length > 1 ? 30 : 34}" fill="${CREAM}" opacity="0.85">${esc(l)}</text>`; });
  cur += 40 + (h2.length - 1) * 42 + 46;
  out += rule(300, 780, cur); cur += 56;
  out += uspLine(spec.usps || [], W / 2, cur, 24); cur += 56;
  let plateY = null;
  if (reserve) { plateY = cur; cur += reserve + 24; }   // the status video lays its own subtitle plate here
  if (words.length) {
    const subSize = fitSize(words.slice(0, half).join(" "), 780, 38, 26);
    out += `<rect x="120" y="${cur}" width="840" height="120" rx="14" fill="#000" fill-opacity="0.28" stroke="${GOLD}" stroke-opacity="0.35"/>
    <text x="${W / 2}" y="${cur + 48}" text-anchor="middle" font-family="${SERIF_DEV}, ${SERIF}" font-size="${subSize}">${ts(words.slice(0, half), 0)}</text>
    <text x="${W / 2}" y="${cur + 98}" text-anchor="middle" font-family="${SERIF_DEV}, ${SERIF}" font-size="${subSize}">${ts(words.slice(half), half)}</text>`;
    cur += 154;
  }
  out += `<rect x="${W / 2 - 300}" y="${cur}" width="600" height="84" rx="42" fill="url(#gold)" filter="url(#soft)"/>
  <text x="${W / 2}" y="${cur + 54}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="800" font-size="${fitSize(spec.cta, 540, 32, 22)}" fill="${p.deeper}">${esc(spec.cta)}</text>`;
  cur += 84 + 60;
  out += `<text x="${W / 2}" y="${cur}" text-anchor="middle" font-family="${LAT}" font-weight="700" font-size="36" letter-spacing="3" fill="${GOLD2}">${esc(spec.phone)}</text>`;
  cur += 42;
  // the town only when it still clears the footer (a two-line headline or the video's plate can use up that room)
  if (spec.address && cur <= maxY) out += `<text x="${W / 2}" y="${cur}" text-anchor="middle" font-family="${DEV2}, ${LAT}" font-weight="500" font-size="22" fill="${CREAM}" opacity="0.75">${esc(wrap(spec.address, 22, 900, 1)[0])}</text>`;
  return { svg: out, end: cur, plateY };
}
const footerTextW = (spec) => [...String(spec.link || "").toUpperCase()].length * (0.66 * 20 + 3);
const footerMarkX = (spec, W) => Math.round((W - (footerTextW(spec) + 40)) / 2);
const classicFooter = (spec, y, W) => `<text x="${footerMarkX(spec, W) + 40}" y="${y}" font-family="${LAT}" font-weight="600" font-size="20" letter-spacing="3" fill="${GOLD2}" opacity="0.9">${esc(String(spec.link || "").toUpperCase())}</text>`;

async function classic45(spec) {
  const W = 1080, H = 1350, p = spec.palette, PHOTO_H = 720;
  const body = classicBody(spec, p, PHOTO_H, W, { maxY: H - 100 });
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${classicDefs(p)}</defs><rect width="${W}" height="${H}" fill="url(#panel)"/><rect width="${W}" height="${H}" fill="url(#lin)"/></svg>`;
  const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${classicDefs(p)}</defs>
  <rect x="0" y="0" width="${W}" height="${PHOTO_H}" fill="url(#topVeil)"/><rect x="0" y="${PHOTO_H - 300}" width="${W}" height="300" fill="url(#photoFade)"/>
  ${frame(W, H, 34)}
  ${spec.logo && fs.existsSync(spec.logo) ? "" : seal(120, 128, 54, [...String(spec.name || "S").trim()][0]?.toUpperCase() || "S")}
  ${classicHeader(spec, 78, W)}
  ${body.svg}
  ${classicFooter(spec, H - 58, W)}</svg>`;
  const layers = [];
  if (spec.hero?.file && fs.existsSync(spec.hero.file)) layers.push({ input: await photoWindow(spec.hero.file, W, PHOTO_H, spec.hero.mode, p.deep, spec.hero.box, 190), left: 0, top: 0 });
  layers.push({ input: Buffer.from(over), left: 0, top: 0 });
  if (spec.logo && fs.existsSync(spec.logo)) layers.push({ input: await logoBadge(spec, 108, 54, classicDefs(p)), left: 66, top: 74 });
  const mark = await brandMark(24); if (mark) layers.push({ input: mark, left: footerMarkX(spec, W), top: H - 76 });
  return sharp(Buffer.from(base)).composite(layers).png().toBuffer();
}

async function classic916(spec, { subtitle = "", said = 0, reserve = 0, info = null } = {}) {
  const W = 1080, H = 1920, p = spec.palette, PHOTO_H = 1040;
  const body = classicBody(spec, p, PHOTO_H, W, { subtitle, said, reserve, maxY: H - 110 });
  if (info) info.plateY = body.plateY;
  const base = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${classicDefs(p)}</defs><rect width="${W}" height="${H}" fill="url(#panel)"/><rect width="${W}" height="${H}" fill="url(#lin)"/></svg>`;
  const over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${classicDefs(p)}</defs>
  <rect x="0" y="0" width="${W}" height="${PHOTO_H}" fill="url(#topVeil)"/><rect x="0" y="${PHOTO_H - 340}" width="${W}" height="340" fill="url(#photoFade)"/>
  ${frame(W, H, 34)}
  ${spec.logo && fs.existsSync(spec.logo) ? "" : seal(120, 330, 54, [...String(spec.name || "S").trim()][0]?.toUpperCase() || "S")}
  ${classicHeader(spec, 280, W)}
  ${body.svg}
  ${classicFooter(spec, H - 64, W)}</svg>`;
  const layers = [];
  if (spec.hero?.file && fs.existsSync(spec.hero.file)) layers.push({ input: await photoWindow(spec.hero.file, W, PHOTO_H, spec.hero.mode, p.deep, spec.hero.box, 400), left: 0, top: 0 });
  layers.push({ input: Buffer.from(over), left: 0, top: 0 });
  if (spec.logo && fs.existsSync(spec.logo)) layers.push({ input: await logoBadge(spec, 108, 54, classicDefs(p)), left: 66, top: 276 });
  const mark = await brandMark(24); if (mark) layers.push({ input: mark, left: footerMarkX(spec, W), top: H - 82 });
  return sharp(Buffer.from(base)).composite(layers).png().toBuffer();
}

/* ================= public ================= */
/** Fill what a spec leaves out so a render never fails on a missing field. */
export function normalizeSpec(spec) {
  const look = LOOKS.includes(spec.look) ? spec.look : "vibrant";
  const palette = spec.palette && (look === "classic" ? spec.palette.deep : spec.palette.a) ? spec.palette : paletteFor(look, spec.accent);
  return {
    look, palette, accent: spec.accent || palette.accent,
    name: String(spec.name || "").trim() || "My Business", tagline: String(spec.tagline || "").trim(), logo: spec.logo || null,
    tag: String(spec.tag || "").trim(), h0: String(spec.h0 || "").trim(), h1: String(spec.h1 || "").trim() || String(spec.name || ""), h2: String(spec.h2 || "").trim(),
    chips: Array.isArray(spec.chips) ? spec.chips.filter((c) => c && c.label).slice(0, 5).map((c) => ({ icon: c.icon || iconFor(`${c.label} ${c.sub || ""}`), label: String(c.label), sub: c.sub ? String(c.sub) : "" })) : [],
    usps: Array.isArray(spec.usps) ? spec.usps.map((u) => String(u).trim()).filter(Boolean).slice(0, 4) : (Array.isArray(spec.chips) ? spec.chips.map((c) => c.label).slice(0, 4) : []),
    s1: spec.s1 || "", s2: spec.s2 || "", badge: Array.isArray(spec.badge) && spec.badge.length === 2 ? spec.badge : null,
    cta1: spec.cta1 || "", cta2: spec.cta2 || "", cta: spec.cta || spec.btn || "", btn: spec.btn || spec.cta || "", phone: spec.phone || "", address: spec.address || "",
    link: spec.link || "", hero: spec.hero && spec.hero.file ? { file: spec.hero.file, mode: ["product", "cutout"].includes(spec.hero.mode) ? spec.hero.mode : "photo", box: spec.hero.box && typeof spec.hero.box === "object" ? spec.hero.box : null } : null,
    lang: spec.lang || "hi",
  };
}
/** One subtitle plate (the spoken sentence, up to three lines) as a PNG the video lays over the moving frame. */
async function platePng(spec, text, w, h) {
  const classic = spec.look === "classic";
  let size = 42, lines = [];
  for (size of [48, 44, 40, 36, 32]) { lines = wrap(text, size, w - 72, 9); if (lines.length <= 3) break; }
  if (lines.length > 3) lines = wrap(text, size, w - 72, 3);
  const lh = Math.round(size * 1.3), y0 = Math.round((h - lines.length * lh) / 2 + size * 0.98);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    ${classic ? `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="16" fill="#000" fill-opacity="0.46" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="1.5"/>`
      : `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="28" fill="#ffffff" fill-opacity="0.95" stroke="${spec.palette.a}" stroke-opacity="0.35" stroke-width="2"/>`}
    ${lines.map((l, i) => `<text x="${w / 2}" y="${y0 + i * lh}" text-anchor="middle" font-family="${classic ? `${SERIF_DEV}, ${SERIF}` : `${DEV}, ${LAT}`}" font-weight="${classic ? 400 : 800}" font-size="${size}" fill="${classic ? CREAM : "#22264f"}">${esc(l)}</text>`).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
/**
 * The status video's pictures: the 9:16 frame (1080×1920 PNG, no subtitle — the classic look keeps a gap for it) and
 * one plate PNG per spoken sentence, each with where it sits on that frame. The video zooms the frame slowly and shows
 * the plates one after another in time with the voice.
 */
export async function statusFrames(spec0, sentences = []) {
  const spec = normalizeSpec(spec0);
  const PW = 900, PH = 210, info = {};
  const base = spec.look === "classic" ? await classic916(spec, { reserve: sentences.length ? PH : 0, info }) : await vibrant916(spec, { plate: sentences.length > 0 });
  const top = spec.look === "classic" ? (info.plateY ?? 1300) : 1374;
  const plates = [];
  for (const text of sentences) plates.push({ buf: await platePng(spec, text, PW, PH), left: 90, top, w: PW, h: PH });
  return { base, plates };
}
/**
 * Render one format of a spec. format: "45" (1080×1350 master), "916" (1080×1920, with the voice line as subtitle),
 * "11" (1080×1080 for Google, cut from the master's lower part so headline, brand and CTA stay whole).
 * Returns a PNG buffer, or writes `out` (jpg/png by extension) and returns the path.
 */
export async function renderSignature(spec0, { format = "45", subtitle = "", said = 0, out = null, master = null } = {}) {
  const spec = normalizeSpec(spec0);
  let buf;
  if (format === "916") buf = spec.look === "classic" ? await classic916(spec, { subtitle, said }) : await vibrant916(spec, { subtitle, said });
  else if (format === "11") {
    const m = master && fs.existsSync(master) ? await sharp(master).png().toBuffer() : (spec.look === "classic" ? await classic45(spec) : await vibrant45(spec));
    buf = await sharp(m).extract({ left: 0, top: 270, width: 1080, height: 1080 }).png().toBuffer();
  } else buf = spec.look === "classic" ? await classic45(spec) : await vibrant45(spec);
  if (!out) return buf;
  const img = sharp(buf);
  await (/\.jpe?g$/i.test(out) ? img.jpeg({ quality: 90, mozjpeg: true }) : img.png()).toFile(out);
  return out;
}
