// "Shubhora" engine.
//
//   node bridge/poster-engine.mjs [--date YYYY-MM-DD] [--force]   → today's base art
//   import { renderPoster } ...                                     → personalised poster
//
// One piece of AI artwork per day (occasion from occasions.json, otherwise a
// rotating evergreen theme), generated ONCE and shared by every user; the
// personal layer — greeting text, name, photo, logo, number — is drawn by
// code with sharp, so Hindi never misspells and the brand never drifts.
//
// Quality gate: the artwork is checked by a vision model for stray text,
// letters, logos or watermarks and regenerated (max 3 tries) — "perfect the
// first time the user sees it" is the whole point.

import "./fonts-setup.mjs";   // bundled poster fonts, before anything renders text
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ensureStockArt, ensureStockPhoto, rosterKind, stockFitsOccasion } from "./stock-art.mjs";
import { renderSignature, paletteFor as sigPaletteFor } from "./signature.mjs";
import { isShubhoraProduct, shubhoraProductArt } from "./shubhora-product-art.mjs";
import { uspsFor as sigUspsFor, SCRIPT_PAIR as SIG_SCRIPT, CTA as SIG_CTA, TAG as SIG_TAG, LINES as SIG_LINES, BANNER_FALLBACK as SIG_BANNER, groupOf as sigGroupOf, defaultLook as sigDefaultLook, accentOf as sigAccentOf, labelOf as sigLabelOf, paletteOf as sigPaletteOf } from "./signature-presets.mjs";
export { rosterKind };
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, "..");
export const BASE_DIR = path.join(APP, "public", "poster", "base");
export const OUT_DIR = path.join(APP, "public", "poster", "out");
const LOGO_FALLBACK = path.join(APP, "public", "wellwa", "images", "wellwa-logo.png");
// Nano Banana 2 Lite: same 1K poster art at half the price of gemini-3.1-flash-image ($0.0336 vs $0.067 an image —
// owner's call, 29 Sep 2026). POSTER_IMAGE_MODEL in .env.local overrides.
const IMAGE_MODEL = process.env.POSTER_IMAGE_MODEL || "gemini-3.1-flash-lite-image";
const CHECK_MODEL = process.env.POSTER_CHECK_MODEL || "gemini-3.5-flash-lite";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* none */ }
  return env;
}
const env = loadEnv();
const KEY = env.GEMINI_API_KEY || "";
const WM_HOST = (env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/^https?:\/\//, "").replace(/\/$/, "");   // poster watermark

/* ---------------- calendar ---------------- */
/** IST calendar date; pass a Date, or a number of days to offset from now (istDate(1) = tomorrow). */
export function istDate(d = new Date()) {
  const base = typeof d === "number" ? new Date(Date.now() + d * 86400000) : d;
  return new Date(base.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
export function loadOccasions() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "occasions.json"), "utf8"));
}
export function occasionFor(dateStr, cal = loadOccasions()) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return (cal.moving ?? []).find((o) => o.y === y && o.m === m && o.d === d)
      ?? (cal.fixed ?? []).find((o) => o.m === m && o.d === d) ?? null;
}

/* Evergreen themes for ordinary days — rotate so a week never repeats. Each is
 * a complete art brief; the greeting is what the poster says. */
export const EVERGREEN = [
  { slug: "sunrise",    hi: "शुभ प्रभात",            en: "Good Morning",        greet: "Naya din, nayi umeed.", theme: "golden sunrise over misty green hills and a calm lake, birds in the distance, fresh morning light" },
  { slug: "chai",       hi: "सुप्रभात",              en: "Good Morning",        greet: "Ek cup chai aur ek nayi shuruaat.", theme: "a steaming clay cup of chai on a wooden table by a window with soft morning light and marigolds" },
  { slug: "motivation", hi: "आज का दिन आपका है",     en: "Make Today Count",    greet: "Mehnat kabhi bekaar nahi jaati.", theme: "a lone figure silhouette on a mountain summit at dawn, dramatic sky, inspiring" },
  { slug: "nature",     hi: "प्रकृति के साथ",        en: "Breathe",             greet: "Sukoon apne aas-paas hai.", theme: "lush tropical garden after rain with water droplets on leaves and soft bokeh light" },
  { slug: "water",      hi: "पानी पीजिए, स्वस्थ रहिए", en: "Stay Hydrated",     greet: "Aaj ek glass zyada.", theme: "a crystal-clear glass of water with a splash and lemon slice on a bright kitchen counter, fresh and clean" },
  { slug: "gratitude",  hi: "आभार",                  en: "Gratitude",           greet: "Jo hai uske liye shukriya.", theme: "warm evening light through a temple courtyard with diyas and marigold petals, peaceful" },
  { slug: "family",     hi: "परिवार ही सब कुछ",      en: "Family First",        greet: "Sabse badi daulat: apne log.", theme: "a warm Indian family dinner table seen from above with thalis and hands sharing food, cosy light" },
  { slug: "sunday",     hi: "रविवार की शुभकामनाएँ",  en: "Happy Sunday",        greet: "Aaram bhi zaroori hai.", theme: "a hammock in a sunny garden with a book and lemonade, relaxed weekend vibe" },
  { slug: "success",    hi: "सफलता की ओर",           en: "Keep Going",          greet: "Chhote kadam, badi manzil.", theme: "a long road through golden fields leading to a bright horizon, hopeful" },
  { slug: "rain",       hi: "बारिश की बूँदें",       en: "Rainy Day",           greet: "Har boond ek nayi shuruaat.", theme: "monsoon rain on a green landscape with a colourful umbrella, fresh and cinematic" },
  { slug: "flowers",    hi: "खुशियों का दिन",        en: "Bloom Today",         greet: "Muskurate rahiye.", theme: "a field of bright marigolds and lotus flowers under a soft blue sky, vivid and joyful" },
  { slug: "diya",       hi: "शुभ संध्या",            en: "Good Evening",        greet: "Shaam sukoon bhari ho.", theme: "a single glowing brass diya on a dark reflective surface with soft golden bokeh, serene" },
  { slug: "city",       hi: "आगे बढ़ते रहिए",        en: "Keep Moving",         greet: "Sheher jaagta hai, aap bhi.", theme: "an Indian city skyline at sunrise with warm light on modern buildings and a flying flock of birds" },
  { slug: "mountains",  hi: "ऊँचाइयों की ओर",        en: "Aim High",            greet: "Manzil door nahi.", theme: "snow-capped Himalayan peaks in golden morning light with a clear blue sky, majestic" },
];
export function evergreenFor(dateStr) {
  const day = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  if (dow === 0) return EVERGREEN.find((e) => e.slug === "sunday");
  // Weekday pool: never "Happy Sunday" on a weekday (bug seen on Thu 17 Sep 2026), no "Good Evening" card for a 4 AM post,
  // and the rain card only in the monsoon months.
  const month = new Date(dateStr + "T00:00:00Z").getUTCMonth() + 1;
  const pool = EVERGREEN.filter((e) => e.slug !== "sunday" && e.slug !== "diya" && (e.slug !== "rain" || (month >= 6 && month <= 9)));
  return pool[day % pool.length];
}

/** What today's poster is about — occasion first, evergreen otherwise. */
export function themeFor(dateStr) {
  const occ = occasionFor(dateStr);
  if (occ) return { kind: "occasion", slug: occ.slug, hi: occ.hi, en: occ.title, greet: occ.greet || "", theme: occ.theme, verify: !!occ.verify };
  const ev = evergreenFor(dateStr);
  return { kind: "evergreen", slug: ev.slug, hi: ev.hi, en: ev.en, greet: ev.greet, theme: ev.theme, verify: false };
}

/* ---------------- personas ----------------
 * The art is shared; the persona decides the words. Every line here was
 * written to be safe for anyone to forward: no health claims, no income
 * promises, nothing that dates. */
export const PERSONAS = {
  business:     { hi: "व्यापारी",        en: "Business",       line: (p) => p.tagline || "आपका भरोसा, हमारी पहचान", cta: (p) => p.phone ? p.phone : "" },
  personal:     { hi: "व्यक्तिगत",       en: "Personal",       line: (p) => p.tagline || "शुभकामनाओं सहित", cta: () => "" },
  home:         { hi: "घर से व्यवसाय",  en: "Home business",  line: (p) => p.tagline || "घर का बना, प्यार से", cta: (p) => p.phone ? p.phone : "" },
  community:    { hi: "समाज / संगठन",   en: "Community",      line: (p) => p.tagline || "आपके साथ, आपके लिए", cta: (p) => p.phone ? p.phone : "" },
  student:      { hi: "छात्र",           en: "Student",        line: (p) => p.tagline || "सीखते रहो, बढ़ते रहो", cta: () => "" },
  professional: { hi: "प्रोफ़ेशनल",     en: "Professional",   line: (p) => p.tagline || "", cta: (p) => p.phone ? p.phone : "" },
};

/* ---------------- what goes on the poster ----------------
 * Default = brand only: the firm/company name (profile.tagline for business
 * personas) and the logo. The person's name, designation line and phone show
 * only when the user switches them on (profile.layout.showName / showLine /
 * showPhone). Personal & student profiles have no firm, so they show the name. */
/** The same words twice on one poster ("AI BUSINESS ASSISTANCE" as the extra line AND as the firm on the identity
 *  card) read as a mistake. Owners do type the firm name into "extra line" — so a line that repeats the name, the
 *  firm or the title is simply not drawn a second time. */
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const repeats = (line, ...others) => { const n = norm(line); return !!n && others.some((o) => norm(o) === n); };

export function identityFor(profile) {
  const L = profile?.layout && typeof profile.layout === "object" ? profile.layout : {};
  const persona = PERSONAS[profile?.persona] ?? PERSONAS.personal;
  const personal = profile?.persona === "personal" || profile?.persona === "student";
  const brand = (profile?.tagline || "").trim();
  const showName = L.showName === true || personal || !brand;
  const big = showName ? (profile?.name || brand) : brand;
  let line = "";
  if (!profile?.kids_mode && !L.hideLine) {
    if (L.showLine === true || personal) line = showName && brand && !personal ? brand : persona.line(profile);
    if (showName && brand && line === brand && big === brand) line = "";
    if (L.showLine !== true && !personal) line = showName && brand ? brand : ""; // brand as the designation line when the name is on top
  }
  const phone = !profile?.kids_mode && L.showPhone === true ? persona.cta(profile) : "";
  return { big, line, phone, showName };
}

/* ---------------- Gemini ---------------- */
async function gemini(model, body) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${model} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/** The art brief. Fixed rules do the heavy lifting; the theme only adds subject. */
/* ---------------- art groups ----------------
 * Same occasion, a setting that fits the user's trade. Only paid profiles get
 * group art (generated on demand, once per group per day); free = shared art.
 * Group comes from the category (src/lib/poster-categories.ts), else persona,
 * and the user can pin one via profile.layout.artGroup. */
export const ART_GROUPS = {
  Retail:    "set in or around a beautifully decorated Indian shop / bazaar / storefront with tasteful displays (no readable signage)",
  Food:      "set around delicious Indian food, a warm kitchen or a festive dining table, appetising and inviting",
  Health:    "set in a clean, calm, wellness atmosphere: fresh water, greenery, soft clinical light, a healthy family feeling",
  Services:  "set in a modern Indian city / office / professional setting, elegant and trustworthy, subtle skyline or workspace",
  Education: "set around learning: books, a bright classroom or campus, young students (faces not towards camera), hopeful mood",
  Sales:     "set with a feeling of growth and partnership: handshake, rising sun over a city, open road, aspirational and energetic",
  Industry:  "set around Indian farms, fields, factories or warehouses at golden hour, honest hard-work mood",
  Community: "set with a festive Indian crowd, flags and banners without text, rally or gathering energy, tricolour accents where natural",
  Personal:  "",
};
const PERSONA_GROUP = { business: "Retail", personal: "Personal", home: "Food", community: "Community", student: "Education", professional: "Services" };
const CATEGORY_GROUP = { kirana: "Retail", garments: "Retail", jewellery: "Retail", mobile: "Retail", furniture: "Retail", hardware: "Retail", medical: "Retail", sweets: "Food", "grocery-online": "Retail", gift: "Retail", optical: "Retail", footwear: "Retail", restaurant: "Food", cafe: "Food", tiffin: "Food", catering: "Food", hotel: "Food", doctor: "Health", hospital: "Health", dentist: "Health", ayurveda: "Health", pharma: "Health", gym: "Health", salon: "Health", spa: "Health", water: "Health", wellness: "Health", ca: "Services", lawyer: "Services", insurance: "Services", finance: "Services", realestate: "Services", builder: "Services", interior: "Services", travel: "Services", transport: "Services", auto: "Services", electrician: "Services", photography: "Services", event: "Services", printing: "Services", it: "Services", security: "Services", cleaning: "Services", tailor: "Services", mehndi: "Services", astro: "Services", courier: "Services", school: "Education", coaching: "Education", college: "Education", computer: "Education", teacher: "Education", dance: "Education", student: "Education", mlm: "Sales", distributor: "Sales", sales: "Sales", agent: "Sales", agri: "Industry", dairy: "Industry", manufacturer: "Industry", wholesale: "Industry", textile: "Industry", political: "Community", mla: "Community", ngo: "Community", samaj: "Community", temple: "Community", club: "Community", union: "Community", housing: "Community", personal: "Personal", employee: "Services", govt: "Services", army: "Community", influencer: "Personal", other: "Personal" };
export function artGroupFor(profile) {
  const pinned = profile?.layout?.artGroup;
  if (pinned && pinned !== "auto" && ART_GROUPS[pinned] !== undefined) return pinned;
  return CATEGORY_GROUP[profile?.category] ?? PERSONA_GROUP[profile?.persona] ?? "Personal";
}

export function artPrompt(theme, title, group = "") {
  const setting = ART_GROUPS[group] || "";
  return [
    `Poster artwork for "${title}", Indian audience, premium greeting-card quality.`,
    `Subject: ${theme}.`,
    setting ? `Setting: ${setting}. The occasion stays the hero; the setting is the backdrop.` : "",
    `Composition: PORTRAIT 3:4. The subject fills the frame naturally; keep the TOP 18% and BOTTOM 18% slightly calmer (soft sky, gentle blur, shadow) so short text can sit there — but never leave large empty flat areas.`,
    `Style: bold and striking — the visual quality of a top ad agency's festival campaign: photorealistic or fine illustration, rich saturated colours with one vivid accent, dramatic cinematic light (golden hour, rim light, glowing highlights), depth, sharp focus, eye-catching at thumbnail size on a phone; no clutter, no borders, no frames, no collage.`,
    `STRICTLY FORBIDDEN: any text, letters, words, numbers, calendars, signs, logos, brand marks, watermarks, captions, speech bubbles, UI elements, or human faces looking straight at the camera.`,
  ].join(" ");
}

async function generateArt(theme, title, group = "") {
  if (!KEY) throw new Error("GEMINI_API_KEY missing");
  const prompt = artPrompt(theme, title, group);
  const bodies = [
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
  ];
  let last = "";
  for (const body of bodies) {
    try {
      const j = await gemini(IMAGE_MODEL, body);
      const img = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
      if (img) return Buffer.from(img.inlineData.data, "base64");
      last = "no image part";
    } catch (e) { last = e.message; }
  }
  throw new Error(`art generation failed: ${last}`);
}

/** Vision QA: stray text / logos / watermark → reject. Cheap (flash-lite). */
export async function artLooksClean(buf) {
  try {
    const j = await gemini(CHECK_MODEL, {
      contents: [{ parts: [
        { inlineData: { mimeType: "image/png", data: buf.toString("base64") } },
        { text: "Inspect this image. Does it contain ANY visible text, letters, numbers, writing, signage, logos, brand marks, watermarks or captions? Reply with exactly one word: YES or NO." },
      ] }],
      generationConfig: { temperature: 0, maxOutputTokens: 5 },
    });
    const t = (j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().toUpperCase();
    return !t.startsWith("YES");
  } catch { return true; } // checker down → don't block the day
}

/** Today's shared base art (PNG, 3:4). Generated once, QA'd, cached on disk. */
const artInFlight = new Map(); // date-group → promise (two users of one group at 8 AM = one generation)
export async function ensureBaseArt(dateStr, { force = false, group = "", stock = null } = {}) {
  // Stock first (a real photo chosen for the trade and the day — no AI cost, shared by everyone in that trade);
  // the AI painting only when no fitting photo was found — and always for a jayanti / national / awareness day,
  // which no stock photo can show (stock-art.mjs, stockFitsOccasion).
  if (stock && stockFitsOccasion(themeFor(dateStr))) {
    try {
      const art = await ensureStockArt({ theme: themeFor(dateStr), category: stock.category, kind: stock.kind, dateStr });
      if (art?.file) return { file: art.file, theme: { ...themeFor(dateStr), date: dateStr, stock: true, credit: art.credit || "" } };
    } catch (e) { console.log(`[poster] stock art failed (${e.message}) → AI art`); }
  }
  const g = group && group !== "Personal" && ART_GROUPS[group] ? group : "";
  const k = `${dateStr}${g ? `-${g.toLowerCase()}` : ""}`;
  if (!force && artInFlight.has(k)) return artInFlight.get(k);
  const p = ensureBaseArtNow(dateStr, k, g, force).finally(() => artInFlight.delete(k));
  artInFlight.set(k, p);
  return p;
}
async function ensureBaseArtNow(dateStr, k, g, force) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  const file = path.join(BASE_DIR, `${k}.png`);
  const meta = path.join(BASE_DIR, `${k}.json`);
  if (fs.existsSync(file) && !force) return { file, theme: JSON.parse(fs.readFileSync(meta, "utf8")) };
  const theme = themeFor(dateStr);
  let art = null, tries = 0;
  while (tries < 3) {
    tries++;
    const candidate = await generateArt(theme.theme, theme.en, g);
    const png = await sharp(candidate).resize(1080, 1440, { fit: "cover", position: "attention" }).png().toBuffer();
    if (await artLooksClean(png)) { art = png; break; }
    console.log(`[poster] ${dateStr}: art try ${tries} rejected by QA (text/logo found)`);
    art = art ?? png; // keep the last one as a fallback if all tries fail
  }
  fs.writeFileSync(file, art);
  fs.writeFileSync(meta, JSON.stringify({ ...theme, date: dateStr, group: g || "shared", tries, generatedAt: new Date().toISOString(), model: IMAGE_MODEL }, null, 2));
  // personalised copies for this date are stale now (shared art only — group art is new, nothing depends on it yet)
  if (!g && fs.existsSync(OUT_DIR)) for (const f of fs.readdirSync(OUT_DIR)) if (f.includes(`-${dateStr}`) && f.endsWith(".jpg")) fs.unlinkSync(path.join(OUT_DIR, f));
  console.log(`[poster] ${k}: base art ready (${theme.kind}:${theme.slug}, ${tries} tries)`);
  return { file, theme: { ...theme, date: dateStr } };
}

/* ---------------- composition ---------------- */
const noEmoji = (s) => String(s ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
const esc = (s) => noEmoji(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const DEV = "Noto Sans Devanagari, Droid Sans Devanagari, Mangal, Kohinoor Devanagari, Devanagari Sangam MN, sans-serif";
const LAT = "Helvetica, Arial, sans-serif";
/* Text that always fits (owner's call, 2 Oct 2026: "font perfect karo — chhota hai to bada, bada hai to chhota").
   measure() is the rough advance width of a string at 1 px; fitPx() the biggest size (≤ hi) at which it fits `width`,
   never below lo; fitLines() shrinks first and, when even `lo` is too small, breaks the text into two lines. */
const isDevCh = (ch) => /[ऀ-ൿ]/.test(ch);
const measure = (str) => [...String(str || "")].reduce((a, ch) => a + (isDevCh(ch) ? (/[\u093E-\u094D\u0951-\u0954\u0962\u0963]/.test(ch) ? 0.2 : 0.72) : /[A-Z]/.test(ch) ? 0.68 : /[ilj.,:;' ]/.test(ch) ? 0.32 : 0.58), 0);
const fitPx = (text, width, hi, lo) => Math.max(lo, Math.min(hi, Math.floor(width / Math.max(0.1, measure(text)))));
function fitLines(text, width, hi, lo, two) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (measure(t) * lo <= width) return { lines: [t], size: fitPx(t, width, hi, lo) };
  const words = t.split(" "), lines = []; let cur = "";
  for (const w of words) { const next = (cur + " " + w).trim(); if (measure(next) * two > width && cur) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur);
  if (lines.length > 2) { lines.length = 2; }
  return { lines, size: fitPx(lines.reduce((a, b) => (measure(a) > measure(b) ? a : b)), width, two, Math.min(two, 28)) };
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    if (/^https?:/i.test(url)) { const r = await fetch(url); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); }
    if (url.startsWith("data:")) return Buffer.from(url.split(",")[1], "base64");
    // /api/stock/<vcard|banners|demo>/x → the folders that route reads (public/art/vcard, public/art/banners, public/demo)
    const stock = url.match(/^\/api\/stock\/(vcard|banners|demo)\/([\w.-]+)$/);
    const local = stock ? path.join(APP, "public", stock[1] === "demo" ? "demo" : path.join("art", stock[1]), stock[2]) : path.join(APP, "public", url.replace(/^\//, ""));
    return fs.existsSync(local) ? fs.readFileSync(local) : null;
  } catch { return null; }
}

/* ---------------- languages ---------------- */
/** Per-language font stacks for the SVG text layer. Devanagari (hi, mr) uses DEV;
 *  the rest fall back to the generic Noto Sans + system sans if the script font
 *  is missing (fontconfig then substitutes whatever covers the script). */
const FONTS = {
  hi: DEV, hinglish: LAT, en: LAT,
  mr: DEV,
  gu: "Noto Sans Gujarati, Shruti, Gujarati Sangam MN, Noto Sans, sans-serif",
  pa: "Noto Sans Gurmukhi, Raavi, Gurmukhi MN, Noto Sans, sans-serif",
  bn: "Noto Sans Bengali, Vrinda, Bangla Sangam MN, Noto Sans, sans-serif",
  ta: "Noto Sans Tamil, Latha, Tamil Sangam MN, Noto Sans, sans-serif",
  te: "Noto Sans Telugu, Gautami, Telugu Sangam MN, Noto Sans, sans-serif",
  kn: "Noto Sans Kannada, Tunga, Kannada Sangam MN, Noto Sans, sans-serif",
  ml: "Noto Sans Malayalam, Kartika, Malayalam Sangam MN, Noto Sans, sans-serif",
  or: "Noto Sans Oriya, Kalinga, Oriya Sangam MN, Noto Sans, sans-serif",
};
const LANG_NAMES = {
  mr: "Marathi", gu: "Gujarati", pa: "Punjabi (Gurmukhi script)", bn: "Bengali", ta: "Tamil",
  te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia (Oriya script)",
};
const I18N_DIR = path.join(BASE_DIR, "i18n");
const i18nInflight = new Map();

/**
 * Translate an occasion/evergreen title + greeting into one of the extra
 * languages via Gemini, cached forever at base/i18n/<slug>-<lang>.json so
 * each (occasion, lang) pair costs exactly one call. Throws on failure —
 * titleFor() catches and falls back to Hindi.
 */
async function translateTitle(theme, lang) {
  const name = LANG_NAMES[lang];
  if (!name) throw new Error(`unsupported lang ${lang}`);
  const file = path.join(I18N_DIR, `${theme.slug}-${lang}.json`);
  try {
    const c = JSON.parse(fs.readFileSync(file, "utf8"));
    if (c.big && c.small) return { big: c.big, small: c.small, font: FONTS[lang] };
  } catch { /* not cached yet */ }
  if (i18nInflight.has(file)) return i18nInflight.get(file);
  const job = (async () => {
    if (!KEY) throw new Error("GEMINI_API_KEY missing");
    const j = await gemini(CHECK_MODEL, {
      contents: [{ parts: [{ text: [
        `Translate this Indian greeting-poster text into ${name}, written in its native script (never Latin transliteration).`,
        `Keep the tone warm and natural for a WhatsApp good-morning / festival poster; keep the title short (max 5 words).`,
        `Hindi title: "${theme.hi}"`,
        `English title: "${theme.en}"`,
        `Greeting (one line, Hinglish): "${theme.greet || theme.en}"`,
        `Answer ONLY JSON: {"title": "...", "greeting": "..."}`,
      ].join("\n") }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const raw = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const o = JSON.parse(raw);
    const big = noEmoji(o.title), small = noEmoji(o.greeting);
    if (!big || !small) throw new Error(`empty translation for ${theme.slug}/${lang}`);
    fs.mkdirSync(I18N_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ lang, slug: theme.slug, hi: theme.hi, big, small, at: new Date().toISOString() }, null, 2));
    return { big, small, font: FONTS[lang] };
  })().finally(() => i18nInflight.delete(file));
  i18nInflight.set(file, job);
  return job;
}

/** Title lines by language (hi default; en; hinglish = en title + Hinglish greet;
 *  other Indic languages via translateTitle, falling back to Hindi on any error). */
async function titleFor(theme, lang) {
  if (lang === "en") return { big: theme.en, small: theme.greet, font: LAT };
  if (lang === "hinglish") return { big: theme.en, small: theme.greet, font: LAT };
  const hindi = { big: theme.hi, small: theme.greet || theme.en, font: DEV };
  if (!lang || lang === "hi" || !LANG_NAMES[lang]) return hindi;
  try { return await translateTitle(theme, lang); }
  catch (e) { console.warn(`[poster] i18n ${theme.slug}/${lang} failed, using Hindi: ${e.message}`); return hindi; }
}

/* ---------------- poster styles ----------------
 * Same art, same words — six looks. Chosen per profile (poster_profiles.style)
 * or per day from the style chips. "classic" is the original design. */
export const STYLES = {
  classic:     { veil: "#06111c", topOpacity: 0.72, botOpacity: 0.92, titleFill: "#ffffff", subFill: "#ffe8a3", nameFill: "#ffffff", lineFill: "#e6f4f2", ctaFill: "#7fe3d6", accent: "#7fe3d6", ring: "#ffffff", band: "gradient", titlePos: "top" },
  bold:        { veil: "#7f1d1d", topOpacity: 0.55, botOpacity: 0.97, titleFill: "#ffffff", subFill: "#fde68a", nameFill: "#ffffff", lineFill: "#fecaca", ctaFill: "#fde68a", accent: "#fbbf24", ring: "accent", band: "solid", titlePos: "top", titleAlign: "left", titleScale: 1.1, titleWeight: 800, titleShadow: true },
  clean:       { veil: "#0f172a", topOpacity: 0.35, botOpacity: 0.6, titleFill: "#ffffff", subFill: "#e2e8f0", nameFill: "#111827", lineFill: "#374151", ctaFill: "accent", accent: "#0e9e90", ring: "#ffffff", band: "gradient", panel: "white", titlePos: "top", titleShadow: true },
  festive:     { veil: "#3b1500", topOpacity: 0.6, botOpacity: 0.93, titleFill: "#ffe9a8", subFill: "#ffffff", nameFill: "#ffe9a8", lineFill: "#fff3d6", ctaFill: "#ffe9a8", accent: "#f5c451", ring: "accent", band: "gradient", titlePos: "top", frame: true, underline: true, titleShadow: true },
  minimal:     { veil: "#000000", topOpacity: 0.0, botOpacity: 0.75, titleFill: "#ffffff", subFill: "#d1d5db", nameFill: "#ffffff", lineFill: "#d1d5db", ctaFill: "#ffffff", accent: "#ffffff", ring: "#ffffff", band: "gradient", titlePos: "bottom", titleAlign: "left", titleScale: 0.85, titleShadow: true },
  traditional: { veil: "#4a0f1f", topOpacity: 0.7, botOpacity: 0.95, titleFill: "#ffd27a", subFill: "#ffffff", nameFill: "#ffffff", lineFill: "#ffe4b3", ctaFill: "#ffd27a", accent: "#ff9933", ring: "accent", band: "solid", titlePos: "top", frame: true, underline: true, titleShadow: true },
};

// The Signature looks (30 Sep 2026): drawn by bridge/signature.mjs — white page + brand gradient ("signature") and the
// gold / serif "signature-classic". They keep the old fields so a fallback render still has everything it reads.
STYLES.signature = { ...STYLES.clean, signature: "vibrant" };
STYLES["signature-classic"] = { ...STYLES.classic, signature: "classic" };

/** Style for a day: calendar override → "vary style daily" rotation → the profile's style. */
const ROTATION = ["clean", "bold", "minimal", "classic", "traditional", "festive"];
export function effectiveStyle(profile, dateStr, override) {
  if (override && STYLES[override]) return override;
  const L = profile?.layout && typeof profile.layout === "object" ? profile.layout : {};
  if (L.varyStyle) {
    const t = themeFor(dateStr);
    const i = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
    return t.kind === "occasion" ? (i % 2 ? "traditional" : "festive") : ROTATION[i % ROTATION.length];
  }
  return STYLES[profile?.style] ? profile.style : "classic";
}
/** The user's own offer text for a day (never invented): active, in range, and scoped to all or to today's product. */
export function offerFor(offers, dateStr, productId, productCategory = "") {
  for (const o of Array.isArray(offers) ? offers : []) {
    if (o.active === false || !o.text) continue;
    if (o.starts && dateStr < o.starts) continue;
    if (o.ends && dateStr > o.ends) continue;
    if (o.scope === "products" && !(productId && (o.product_ids ?? []).includes(productId))) continue;
    if (o.scope === "category" && !(productCategory && (o.categories ?? []).map((c) => String(c).toLowerCase()).includes(String(productCategory).toLowerCase()))) continue;
    return String(o.text).slice(0, 60);
  }
  return "";
}

/**
 * Personalised poster (1080×1350 JPEG). profile: {id, persona, name, tagline,
 * phone, photo_url, logo_url, lang, kids_mode}. Returns the output path.
 */
export async function renderPoster(dateStr, profile0, { force = false, watermark = false, products = [], premium = false, testimonial = null, style: styleOpt = "", custom = "", tag = "", stock = null, link = "", card = null } = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const style = effectiveStyle(profile0, dateStr, styleOpt);
  // day-specific extra line (offer / calendar note) rides on the layout without touching the saved profile
  const profile = custom ? { ...profile0, layout: { ...(profile0.layout || {}), custom } } : profile0;
  const group = premium ? artGroupFor(profile) : "Personal";
  const gTag = group !== "Personal" ? `-g${group.slice(0, 3).toLowerCase()}` : "";
  // `tag` keeps different posters for the SAME profile and day apart (e.g. the WhatsApp greeting vs the Facebook business post).
  // A day whose art is painted (a jayanti, a national day) carries no stock tag: the posters rendered on the wrong
  // stock photo earlier today keep their old file names and are simply not picked up again.
  const sTag = stock && stockFitsOccasion(themeFor(dateStr)) ? `-s${stock.kind.slice(0, 3)}` : "";
  const vTag = card ? "-vc" : "";
  // Signature (owner's call, 30 Sep 2026): the default for paid profiles — layout.look "vibrant" | "classic" picks the
  // look, "old" keeps the six original styles; a calendar day may also ask for it by style name.
  const sigLook = signatureLookFor(profile, style, { premium, watermark, card });
  const out = path.join(OUT_DIR, `${profile.id}-${dateStr}${style !== "classic" ? `-${style}` : ""}${gTag}${sTag}${tag}${vTag}${sigLook ? `-sig${sigLook[0]}2` : "-t2"}${watermark ? "-w" : ""}.jpg`);
  if (fs.existsSync(out) && !force) return out;
  // Signature draws its own page from a real photo + the layout code, so it never needs (or pays for) the day's base art;
  // only when it cannot render does the day fall through to the original styles below.
  if (sigLook) {
    try { return await renderSignaturePoster(out, dateStr, profile, { look: sigLook, theme: { ...themeFor(dateStr), date: dateStr }, products, testimonial, custom, link, stock }); }
    catch (e) { console.log(`[poster] signature/${sigLook} failed (${e.message}) → original style`); }
  }
  let base;
  try { base = await ensureBaseArt(dateStr, { group, stock }); }
  catch (e) { console.log(`[poster] group art ${group} failed (${e.message}) → shared art`); base = await ensureBaseArt(dateStr); }
  const { file, theme } = base;
  // testimonial mode: an explicit testimonial object wins (mode "testimonial" or opts.testimonial)
  if (card) return renderCardPoster(out, dateStr, profile, card, { file, theme }, watermark, link);
  if (testimonial && testimonial.text && (profile.mode === "testimonial" || profile.mode !== "product")) return renderTestimonialPoster(out, dateStr, profile, testimonial, { file, theme }, watermark);
  if (profile.mode === "product" && products.length) return renderProductPoster(out, dateStr, profile, products, { file, theme }, watermark, premium, link);
  const W = 1080, H = 1350;
  const persona = PERSONAS[profile.persona] ?? PERSONAS.personal;
  const S = STYLES[style];
  const L = profile.layout && typeof profile.layout === "object" ? profile.layout : {};
  const party = profile.party && typeof profile.party === "object" && (profile.party.name || profile.party.symbol_url) ? profile.party : null;
  const t0 = await titleFor(theme, profile.lang || "hi");
  const t = { ...t0, big: L.title || t0.big, small: L.sub !== undefined && L.sub !== null ? L.sub : t0.small };
  const bigBase = Math.round((t.big.length > 18 ? 66 : t.big.length > 12 ? 78 : 92) * (S.titleScale ?? 1));
  // The title (the day's name, or the owner's own line — a school's full name ran off both edges) fits its width.
  const titleRoom = S.titleAlign === "left" ? W - 140 : W - 120;
  const big = fitLines(t.big, titleRoom, bigBase, 40, 46);
  const bigSize = big.size;
  const ident = identityFor(profile);
  const line = party?.slogan && !ident.line ? party.slogan : ident.line;
  const cta = ident.phone;
  const customLine0 = String(L.custom || "").slice(0, 60);
  const customLine = repeats(customLine0, ident.big, ident.line, t.big, profile.name, profile.tagline) ? "" : customLine0;
  const accent = /^#[0-9a-f]{6}$/i.test(L.accent || "") ? L.accent : (party?.colors?.[0] && /^#[0-9a-f]{6}$/i.test(party.colors[0]) ? party.colors[0] : S.accent);
  const veil = party?.colors?.[1] && /^#[0-9a-f]{6}$/i.test(party.colors[1]) ? party.colors[1] : S.veil;
  const nameSize = L.nameSize === "S" ? 46 : L.nameSize === "L" ? 66 : 56;
  const photoRight = L.photoSide === "right";

  const art = await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).toBuffer();
  const logo = L.hideLogo ? null : await fetchImage(profile.logo_url);
  // Photo by default only when there is no logo (or a personal/student profile); "Show my photo" adds it alongside the logo.
  const personalPersona = profile.persona === "personal" || profile.persona === "student";
  const wantPhoto = !L.hidePhoto && (L.showPhoto === true || !logo || personalPersona);
  const photo = wantPhoto ? await fetchImage(profile.photo_url) : null;
  const symbol = party?.symbol_url ? await fetchImage(party.symbol_url) : null;
  const leaders = party ? (await Promise.all((party.leaders || []).slice(0, 3).map(async (ld) => ({ ...ld, buf: await fetchImage(ld.photo_url) })))).filter((x) => x.buf) : [];
  const composites = [];

  const px = photo ? (photoRight ? 70 : 300) : 70; // text x when the photo sits on the left
  const textX = photoRight ? 70 : px;
  const identityAnchor = "start";
  const panel = S.panel === "white";
  const ink = panel ? "#111827" : "#ffffff";
  const inkSub = panel ? "#374151" : S.lineFill;
  const topH = S.titlePos === "bottom" ? 0 : 380;
  const titleY = S.titlePos === "bottom" ? H - 470 : (S.titleY ?? 150);
  const titleAnchor = S.titleAlign === "left" ? "start" : "middle";
  const titleX = S.titleAlign === "left" ? 70 : W / 2;
  const frame = S.frame ? `<rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${accent}" stroke-width="3" rx="18"/><rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5" rx="12"/>` : "";
  const bottomBand = panel
    ? `<rect x="40" y="${H - 300}" width="${W - 80}" height="260" rx="28" fill="#ffffff" fill-opacity="0.94"/>`
    : S.band === "solid"
      ? `<rect y="${H - 330}" width="${W}" height="330" fill="${veil}" fill-opacity="0.96"/><rect y="${H - 336}" width="${W}" height="8" fill="${accent}"/>`
      : `<rect y="${H - 420}" width="${W}" height="420" fill="url(#bot)"/>`;
  const underline = S.underline ? `<rect x="${titleAnchor === "start" ? 70 : W / 2 - 90}" y="${titleY + 22}" width="180" height="6" rx="3" fill="${accent}"/>` : "";
  const nameY = panel ? H - 200 : H - 190;
  // The business name in full: shrunk to its room (the frame and the logo corner take some), two lines when needed.
  const nameRoom = W - textX - (S.frame ? 60 : 40) - (logo ? 150 : 0);
  const nm = fitLines(ident.big, nameRoom, nameSize, 34, 40);
  const lineY = nameY + 58;
  const ctaY = lineY + 58;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${veil}" stop-opacity="${S.topOpacity}"/><stop offset="1" stop-color="${veil}" stop-opacity="0"/></linearGradient>
    <linearGradient id="bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${veil}" stop-opacity="0"/><stop offset="1" stop-color="${veil}" stop-opacity="${S.botOpacity}"/></linearGradient>
  </defs>
  ${topH ? `<rect width="${W}" height="${topH}" fill="url(#top)"/>` : ""}
  ${bottomBand}
  ${frame}
  ${S.titlePos === "bottom" ? `<rect y="${H - 560}" width="${W}" height="240" fill="url(#bot)"/>` : ""}
  ${big.lines.map((l, i) => `<text x="${titleX}" y="${titleY - (big.lines.length - 1 - i) * (bigSize + 6)}" text-anchor="${titleAnchor}" font-family="${t.font}" font-size="${bigSize}" font-weight="${S.titleWeight ?? 700}" fill="${S.titleFill}" ${S.titleUpper ? 'style="text-transform:uppercase"' : ""}${S.titleShadow ? ` stroke="${veil}" stroke-width="1.2" paint-order="stroke"` : ""}>${esc(l)}</text>`).join("")}
  ${t.small ? `<text x="${titleX}" y="${titleY + 65}" text-anchor="${titleAnchor}" font-family="${LAT}" font-size="${fitPx(t.small, titleRoom - 2 * t.small.length, 30, 20)}" font-weight="600" letter-spacing="2" fill="${S.subFill === "accent" ? accent : S.subFill}">${esc(t.small)}</text>` : ""}
  ${underline}
  ${customLine ? `<text x="${W / 2}" y="${S.titlePos === "bottom" ? titleY - 70 : H - 470}" text-anchor="middle" font-family="${DEV}" font-size="${fitPx(customLine, W - 120, 34, 22)}" font-weight="600" fill="#ffffff" stroke="${veil}" stroke-width="1" paint-order="stroke">${esc(customLine)}</text>` : ""}
  ${nm.lines.map((l, i) => `<text x="${textX}" y="${nameY - (nm.lines.length - 1 - i) * (nm.size + 4)}" text-anchor="${identityAnchor}" font-family="${DEV}" font-size="${nm.size}" font-weight="700" fill="${panel ? ink : S.nameFill}">${esc(l)}</text>`).join("")}
  ${line ? `<text x="${textX}" y="${lineY}" font-family="${DEV}" font-size="${fitPx(line, nameRoom, 32, 22)}" fill="${inkSub}">${esc(line)}</text>` : ""}
  ${cta ? `<g transform="translate(${textX}, ${ctaY - 32}) scale(1.5)"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="${panel ? accent : S.ctaFill === "accent" ? accent : S.ctaFill}"/></g><text x="${textX + 46}" y="${ctaY}" font-family="${LAT}" font-size="34" font-weight="700" fill="${panel ? accent : S.ctaFill === "accent" ? accent : S.ctaFill}">${esc(cta)}</text>` : ""}
  ${watermark ? `<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-family="${DEV}" font-size="20" fill="${panel ? "#111827" : "#ffffff"}" fill-opacity="0.75">Shubhora · ${WM_HOST}/poster</text>` : ""}
  </svg>`;
  composites.push({ input: Buffer.from(svg), top: 0, left: 0 });

  if (photo) {
    const size = 190;
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    const round = await sharp(photo).resize(size, size, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const ringColor = S.ring === "accent" ? accent : S.ring;
    const ring = Buffer.from(`<svg width="${size + 12}" height="${size + 12}"><circle cx="${(size + 12) / 2}" cy="${(size + 12) / 2}" r="${(size + 12) / 2}" fill="${ringColor}"/></svg>`);
    const left = photoRight ? W - 70 - size : 70;
    composites.push({ input: ring, top: H - 240 - 6, left: left - 6 });
    composites.push({ input: round, top: H - 240, left });
  }
  if (logo && !(photoRight && photo)) {
    const lg = await sharp(logo).resize({ width: 200, height: 90, fit: "inside" }).png().toBuffer();
    const m = await sharp(lg).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 28}" height="${m.height + 20}"><rect width="100%" height="100%" rx="14" fill="#ffffff" fill-opacity="0.92"/></svg>`);
    composites.push({ input: pad, top: H - 130 - (m.height + 20) / 2, left: W - 70 - (m.width + 28) });
    composites.push({ input: lg, top: H - 130 - m.height / 2, left: W - 70 - 14 - m.width });
  } else if (logo) {
    // photo on the right → logo goes top-right corner
    const lg = await sharp(logo).resize({ width: 180, height: 80, fit: "inside" }).png().toBuffer();
    const m = await sharp(lg).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 24}" height="${m.height + 16}"><rect width="100%" height="100%" rx="12" fill="#ffffff" fill-opacity="0.92"/></svg>`);
    composites.push({ input: pad, top: 40, left: W - 60 - (m.width + 24) });
    composites.push({ input: lg, top: 48, left: W - 60 - 12 - m.width });
  }
  // political / organisation: party symbol top-left, leaders strip top-right
  if (symbol) {
    const sy = await sharp(symbol).resize({ width: 120, height: 120, fit: "inside" }).png().toBuffer();
    const m = await sharp(sy).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 20}" height="${m.height + 20}"><rect width="100%" height="100%" rx="16" fill="#ffffff" fill-opacity="0.94"/></svg>`);
    composites.push({ input: pad, top: 40, left: 50 });
    composites.push({ input: sy, top: 50, left: 60 });
  }
  if (leaders.length) {
    const size = 96; let x = W - 60 - size;
    for (const ld of leaders) {
      const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
      const round = await sharp(ld.buf).resize(size, size, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
      const ring = Buffer.from(`<svg width="${size + 8}" height="${size + 8}"><circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${(size + 8) / 2}" fill="${accent}"/></svg>`);
      composites.push({ input: ring, top: (logo && photoRight ? 140 : 44) - 4, left: x - 4 });
      composites.push({ input: round, top: logo && photoRight ? 140 : 44, left: x });
      x -= size + 14;
    }
  }
  await sharp(art).composite(composites).jpeg({ quality: 86 }).toFile(out);
  return out;
}

/**
 * Product poster: the day's art (blurred, darkened) as backdrop, the product
 * photo on a white card, one benefit line rotated by day, offer badge,
 * festival title on occasion days, identity strip at the bottom.
 */
const PALETTES = [["#0e9e90", "#0b3d3a"], ["#2563eb", "#0f172a"], ["#b45309", "#451a03"], ["#7c3aed", "#1e1b4b"], ["#dc2626", "#450a0a"], ["#0891b2", "#083344"], ["#16a34a", "#052e16"]];
const SCENES = [
  { k: "kitchen", scene: "bright modern Indian kitchen, marble counter, soft daylight, a smiling Indian family (husband, wife, child) drinking water on the left, slightly out of focus", headline: "More Than Just Water… It's Better Living" },
  { k: "morning", scene: "sunlit living room at morning, a fit young Indian woman in sportswear holding a glass of water, plants and warm light, out of focus", headline: "Start Every Morning Healthier" },
  { k: "office", scene: "clean modern office pantry, a confident Indian businessman in a blazer with a glass of water, glass walls, cool daylight, out of focus", headline: "Pure Energy For Your Busy Day" },
  { k: "kids", scene: "cheerful dining table, two Indian kids in school uniform drinking water with their mother, bright and joyful, out of focus", headline: "Healthy Water, Happy Family" },
  { k: "doctor", scene: "clinical white studio with a friendly Indian doctor in a white coat holding a glass of water, soft blue glow, out of focus", headline: "Trusted By Health-Conscious Families" },
  { k: "nature", scene: "fresh outdoor morning with green leaves, dew drops and soft sunlight, water splashes, clean and airy", headline: "Nature's Purity In Every Sip" },
  { k: "premium", scene: "luxury dark-marble kitchen at evening, warm accent lights, elegant glassware, cinematic", headline: "Premium Water. Premium Life." },
];
const latinShort = (s) => /^[A-Za-z0-9 %+\-&'.]+$/.test(s) && s.trim().split(/\s+/).length <= 3;
const HEADLINES_HI = ["सिर्फ़ पानी नहीं, बेहतर ज़िंदगी", "हर सुबह की शुरुआत सेहत से", "दिन भर की ताज़गी, हर घूँट में", "स्वस्थ पानी, खुशहाल परिवार", "सेहतमंद परिवारों की पहली पसंद", "प्रकृति की शुद्धता, हर घूँट में", "प्रीमियम पानी, प्रीमियम ज़िंदगी"];

/* The scenes and headlines above were written for a water product (the first brand on the app). Every other product —
 * a sweet shop's kaju katli, a Shubhora partner's plans — used to get the same water scenes and "हर सुबह की शुरुआत
 * सेहत से" (owner's review, 25 Sep 2026). Water scenes now stay with water products; everyone else gets scenes and
 * lines for their own trade. */
export const isWaterProduct = (prod, profile) =>
  /water|पानी|ionizer|ioniser|alkaline|hydrogen|purifier|wellwa/i.test(`${prod?.name ?? ""} ${prod?.category ?? ""} ${prod?.brand ?? ""}`)
  || ["water", "wellness"].includes(String(profile?.category ?? ""));
const PRODUCT_SCENES = {
  Tech: [
    { scene: "bright modern Indian office desk with a laptop and a smartphone, soft daylight, green plants, out of focus", en: "Grow Your Business Online", hi: "अपना business online बढ़ाएँ" },
    { scene: "a confident young Indian entrepreneur smiling at a laptop in a bright co-working space, out of focus", en: "Smarter Tools, Bigger Growth", hi: "नए ज़माने के tools, बड़ी growth" },
    { scene: "abstract deep blue and violet gradient with soft glowing network lines and light particles, clean and premium", en: "Your Business, Always On", hi: "आपका business, हर वक़्त online" },
    { scene: "a happy Indian shop owner checking customer messages on a phone at the counter, warm light, out of focus", en: "Every Customer Answered", hi: "हर customer को तुरंत जवाब" },
  ],
  Retail: [
    { scene: "beautifully lit modern Indian shop interior with tasteful shelves, warm light, out of focus", en: "Quality You Can Trust", hi: "भरोसे की quality" },
    { scene: "clean premium studio tabletop with soft shadows and a pastel backdrop", en: "Made For You", hi: "खास आपके लिए" },
    { scene: "festive Indian home corner with soft bokeh lights and marigold accents, out of focus", en: "Best Price, Best Service", hi: "सही दाम, बेहतरीन सेवा" },
  ],
  Food: [
    { scene: "rustic wooden table with brass utensils and warm light, out of focus", en: "Fresh And Delicious", hi: "ताज़ा और स्वादिष्ट" },
    { scene: "bright Indian sweets and snacks counter with a glass display and bokeh lights, out of focus", en: "Taste Everyone Loves", hi: "सबका पसंदीदा स्वाद" },
    { scene: "festive Indian dining table with marigold flowers and diyas, warm light, out of focus", en: "Order Today", hi: "आज ही order करें" },
  ],
  Health: [
    { scene: "calm modern clinic reception with soft daylight and green plants, out of focus", en: "Care You Can Trust", hi: "भरोसेमंद देखभाल" },
    { scene: "fresh green leaves and soft morning light, clean and airy", en: "Feel Better Every Day", hi: "हर दिन बेहतर महसूस करें" },
  ],
  Services: [
    { scene: "modern Indian office with glass walls and soft daylight, out of focus", en: "Trusted Service", hi: "भरोसेमंद सेवा" },
    { scene: "a friendly Indian professional at a clean desk, warm light, out of focus", en: "Work Done Right", hi: "काम, सही तरीके से" },
  ],
  Education: [
    { scene: "bright study desk with books and soft daylight, out of focus", en: "Learn With The Best", hi: "बेहतर पढ़ाई, बेहतर कल" },
  ],
  Industry: [
    { scene: "clean modern warehouse with neat stacks at golden hour, out of focus", en: "Quality At Scale", hi: "बड़े पैमाने पर quality" },
  ],
  Sales: [
    { scene: "a rising sun over a modern Indian city skyline, aspirational and energetic, out of focus", en: "Grow With Us", hi: "साथ मिलकर आगे बढ़ें" },
  ],
  Default: [
    { scene: "clean premium studio backdrop with a soft gradient light and subtle shadows", en: "Made With Care", hi: "दिल से बनाया" },
  ],
};
/** The day's scene + headline for this product: water scenes for water products, the trade's own otherwise. */
function productScene(prod, profile, day) {
  if (isWaterProduct(prod, profile)) {
    const sc = SCENES[day % SCENES.length];
    return { scene: sc.scene, en: sc.headline, hi: HEADLINES_HI[day % HEADLINES_HI.length], water: true };
  }
  const tech = /shubhora/i.test(`${prod?.name ?? ""} ${prod?.brand ?? ""}`) || ["it", "computer"].includes(String(profile?.category ?? ""));
  const list = PRODUCT_SCENES[tech ? "Tech" : artGroupFor(profile)] ?? PRODUCT_SCENES.Default;
  const pick = (list.length ? list : PRODUCT_SCENES.Default)[day % (list.length || 1)];
  return { ...pick, water: false };
}
const ICONS = {
  h2: `<circle cx="0" cy="0" r="9" fill="none" stroke="#1d4ed8" stroke-width="3"/><circle cx="16" cy="-10" r="6" fill="none" stroke="#1d4ed8" stroke-width="3"/><circle cx="16" cy="10" r="6" fill="none" stroke="#1d4ed8" stroke-width="3"/><line x1="8" y1="-5" x2="11" y2="-7" stroke="#1d4ed8" stroke-width="3"/><line x1="8" y1="5" x2="11" y2="7" stroke="#1d4ed8" stroke-width="3"/>`,
  ph: `<path d="M-14 8 A16 16 0 0 1 14 8" fill="none" stroke="#1d4ed8" stroke-width="3"/><line x1="0" y1="8" x2="8" y2="-4" stroke="#1d4ed8" stroke-width="3"/><circle cx="0" cy="8" r="3" fill="#1d4ed8"/>`,
  shield: `<path d="M0 -16 L14 -10 V2 C14 10 7 15 0 18 C-7 15 -14 10 -14 2 V-10 Z" fill="none" stroke="#1d4ed8" stroke-width="3"/><path d="M-6 1 L-1 6 L7 -5" fill="none" stroke="#1d4ed8" stroke-width="3"/>`,
  drop: `<path d="M0 -16 C6 -6 12 0 12 6 A12 12 0 0 1 -12 6 C-12 0 -6 -6 0 -16 Z" fill="none" stroke="#1d4ed8" stroke-width="3"/>`,
  star: `<path d="M0 -15 L4 -5 L15 -4 L7 3 L9 14 L0 8 L-9 14 L-7 3 L-15 -4 L-4 -5 Z" fill="none" stroke="#1d4ed8" stroke-width="3"/>`,
  check: `<circle cx="0" cy="0" r="15" fill="none" stroke="#1d4ed8" stroke-width="3"/><path d="M-7 0 L-2 5 L8 -6" fill="none" stroke="#1d4ed8" stroke-width="3"/>`,
};
const ICON_KEYS = ["h2", "ph", "shield", "drop", "star", "check"];

/** Agency-style product art via Gemini with the real product photo + logo as
 *  references; vision QA on product fidelity + text; cached per product/day. */
async function ensureProductArt(dateStr, prod, { photo, logo, day, profile }) {
  if (!KEY || !photo) return null;
  const dir = path.join(BASE_DIR, "products"); fs.mkdirSync(dir, { recursive: true });
  const sc = productScene(prod, profile, day);
  const cache = path.join(dir, `${prod.id || "p"}-${dateStr}${sc.water ? "" : "-t"}.png`);
  if (fs.existsSync(cache)) return fs.readFileSync(cache);
    const img = (buf, mime) => ({ inlineData: { mimeType: mime, data: buf.toString("base64") } });
  const parts = [img(photo, "image/png")]; if (logo) parts.push(img(logo, "image/png"));
  // The brief asks for a bold, scroll-stopping ad — not a plain product shot (owner's call, 29 Sep 2026: "jab paise lag hi
  // rahe hain to image bindaas wali bane"). The product itself must stay exactly as photographed.
  const prompt = `Design a bold, scroll-stopping, premium advertising poster (portrait 3:4) for the product in the FIRST reference image${logo ? ", using the brand logo in the SECOND reference image (reproduce it faithfully, top-left)" : ""} — the quality of a top Indian ad agency's campaign visual.
STRICT: the product must look EXACTLY like the reference photo — same shape, colours${sc.water ? ", panel, display, buttons and hose" : ", text and details"}. Do not redesign it, do not add extra units. Place it as the hero on the right on a clean surface${sc.water ? " with a dramatic splash of crystal-clear water frozen mid-air and a glass of sparkling water beside it" : " that suits it"}.
Background: ${sc.scene}.
Look: dramatic studio lighting with a strong key light and a rim light on the product, deep rich colours with one vivid accent, glossy reflections, depth of field, cinematic contrast, a sense of energy and premium quality — striking at thumbnail size on a phone. Photorealistic, sharp, no clutter.
ABSOLUTELY NO TEXT anywhere in the image (no words, letters, numbers, labels, captions), no icons, no watermark — text will be added later. Keep the top-right corner and the left-middle area (from 35% to 65% height, left 45% width) visually calm and uncluttered so text can be placed there. Leave the bottom 18% of the poster as a clean deep-blue wave band.`;
  for (let t = 1; t <= 2; t++) {
    try {
      const j = await gemini(IMAGE_MODEL, { contents: [{ parts: [...parts, { text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } });
      const p = (j.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data); if (!p) continue;
      const cand = Buffer.from(p.inlineData.data, "base64");
      const q = await gemini(CHECK_MODEL, { contents: [{ parts: [img(photo, "image/png"), img(cand, "image/png"), { text: `Image 1 is the real product. Image 2 is an ad poster. Answer JSON {"product_match":0-10,"text_ok":true/false}: does the product in image 2 match image 1 closely (shape, colours, panel)? text_ok is true ONLY if image 2 has no added words, captions, labels or numbers in the scene — ignore the brand logo and any text printed on the product itself.` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } });
      let v = {}; try { v = JSON.parse(q.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"); } catch {}
      console.log(`[poster] product art ${prod.name} try ${t}: match=${v.product_match} text=${v.text_ok}`);
      if ((v.product_match ?? 0) >= 7 && v.text_ok !== false) { fs.writeFileSync(cache, cand); return cand; }
      if (t === 2) { fs.writeFileSync(cache, cand); return cand; } // better than nothing; cached so it isn't paid twice
    } catch (e) { console.log("[poster] product art error", e.message); }
  }
  return null;
}

/* Footer of the drawn posters (plan / visiting card): photo, name and firm on the left, the call button on the right,
 * and — when the owner has a V-Card — its link in a strip along the bottom edge. The caption carries the same link as a
 * tap-to-open link; the strip is for a poster forwarded without its caption. */
async function drawnFooter({ W, H, profile, who0, whoLine, phone, en, link, avatar }) {
  const fam = (s) => (/[ऀ-ॿ]/.test(String(s)) ? DEV : LAT);
  const strip = link ? 64 : 0;
  const bandTop = link ? H - 232 : H - 214;
  const av = link ? 132 : 150;
  const avTop = link ? bandTop + Math.round((H - strip - bandTop - av) / 2) : H - 182;
  const tx = avatar ? 60 + av + 26 : 60;
  const mid = link ? bandTop + Math.round((H - strip - bandTop) / 2) : H - 110;
  // the name must stay clear of the call button: a smaller size first, then whole words only
  const room = (phone ? W - 470 : W - 60) - tx;
  const whoSize = [46, 40, 34].find((sz) => who0.length * sz * 0.56 <= room) ?? 34;
  let who = who0;
  while (who.length * whoSize * 0.56 > room && who.includes(" ")) who = who.slice(0, who.lastIndexOf(" "));
  const nameY = whoLine ? mid - 4 : mid + 14, lineY = mid + 38;
  const pillH = 90, pillY = mid - pillH / 2;
  const label = en ? "My digital card:" : "मेरा digital card:";
  const linkText = `<text x="0" y="38" font-family="${fam(label)}" font-size="29" font-weight="600" fill="#cfe0ff">${esc(label)}<tspan dx="12" font-family="${LAT}" font-size="31" font-weight="800" fill="#ffffff">${esc(link)}</tspan></text>`;
  let textW = 0;
  if (link) {
    try { textW = (await sharp(Buffer.from(`<svg width="${W}" height="54" xmlns="http://www.w3.org/2000/svg">${linkText.replace(/fill="#[0-9a-f]{6}"/gi, 'fill="#000000"')}</svg>`)).flatten({ background: "#ffffff" }).trim().toBuffer({ resolveWithObject: true })).info.width; }
    catch { textW = (label.length + link.length) * 14; }
  }
  const startX = Math.max(60, Math.round((W - (40 + textW)) / 2));
  const svg = `<rect y="${bandTop}" width="${W}" height="${H - bandTop}" fill="#020b1f" fill-opacity="0.74"/>
  <text x="${tx}" y="${nameY}" font-family="${fam(who)}" font-size="${whoSize}" font-weight="800" fill="#ffffff">${esc(who)}</text>
  ${whoLine ? `<text x="${tx}" y="${lineY}" font-family="${fam(whoLine)}" font-size="28" fill="#cfe0ff">${esc(whoLine)}</text>` : ""}
  ${phone ? `<rect x="${W - 450}" y="${pillY}" width="390" height="${pillH}" rx="${pillH / 2}" fill="#ffffff"/><text x="${W - 255}" y="${pillY + 36}" text-anchor="middle" font-family="${LAT}" font-size="25" font-weight="800" fill="#16a34a">${en ? "CALL / WHATSAPP" : "CALL / WHATSAPP करें"}</text><text x="${W - 255}" y="${pillY + 75}" text-anchor="middle" font-family="${LAT}" font-size="36" font-weight="900" fill="#062a5c">${esc(phone)}</text>` : ""}
  ${link ? `<rect y="${H - strip}" width="${W}" height="${strip}" fill="#1d4ed8"/>
  <g transform="translate(${startX + 17}, ${H - strip / 2}) rotate(-45)"><rect x="-17" y="-7" width="20" height="14" rx="7" fill="none" stroke="#ffffff" stroke-width="3.5"/><rect x="-3" y="-7" width="20" height="14" rx="7" fill="none" stroke="#ffffff" stroke-width="3.5"/></g>
  <g transform="translate(${startX + 42}, ${H - strip / 2 - 28})">${linkText}</g>` : ""}`;
  const composites = [];
  if (avatar) {
    const circle = Buffer.from(`<svg width="${av}" height="${av}"><circle cx="${av / 2}" cy="${av / 2}" r="${av / 2}" fill="#fff"/></svg>`);
    const round = await sharp(avatar).resize(av, av, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const ring = Buffer.from(`<svg width="${av + 12}" height="${av + 12}"><circle cx="${(av + 12) / 2}" cy="${(av + 12) / 2}" r="${(av + 12) / 2}" fill="#ffffff"/></svg>`);
    composites.push({ input: ring, top: avTop - 6, left: 60 - 6 }, { input: round, top: avTop, left: 60 });
  }
  return { svg, composites, top: bandTop };
}

/* Shubhora's own plans (Growth / Custom Solutions / Free V-Card) are services, and their pictures are flat icons. The
 * product-photo AI treats every picture as a thing on a table — it turned the Pro plan's three-shops icon into three
 * water filters (owner's review, 25 Sep 2026). These get a drawn poster instead: the icon on a phone screen, the plan's
 * price and benefits, and the partner's name and number (a sales poster needs someone to call). No AI picture, no cost,
 * the same quality every day. */
export const isDigitalProduct = (prod) => /^\/api\/stock\/vcard\//.test(String(prod?.photo_url ?? "")) || /shubhora/i.test(String(prod?.brand ?? ""));

async function renderDigitalProductPoster(out, dateStr, profile, prod, { file, theme }, watermark, day, link = "") {
  const W = 1080, H = 1350;
  const en = (profile.lang || "hi") === "en";
  const L = profile.layout && typeof profile.layout === "object" ? profile.layout : {};
  const fam = (s) => (/[ऀ-ॿ]/.test(String(s)) ? DEV : LAT);
  const occasion = theme.kind === "occasion";
  const t = occasion ? await titleFor(theme, profile.lang || "hi") : null;
  const ps = productScene(prod, profile, day);
  const hl = String(L.title || "").trim() || (en ? ps.en : ps.hi); // the owner's own heading ("Edit" on the poster) wins
  const hlLines = wrapLines(hl, 30, 2);
  const hlSize = hlLines.some((l) => l.length > 22) ? 54 : 60;
  // "Shubhora AI Business Assistant — Growth": the name on the left, the plan ("Growth") on the phone screen
  const parts = String(prod.name || "").split(/\s+[—–-]\s+/);
  const nameLines = wrapLines(parts[0], 22, 2);
  const screenName = wrapLines((parts.length > 1 ? parts.slice(1).join(" – ") : parts[0]).trim(), 14, 2);
  const price0 = String(prod.price ?? "").trim();
  const priceLines = wrapLines(/^\d/.test(price0) ? `₹${price0}` : price0, 18, 2);
  const all = (Array.isArray(prod.benefits) ? prod.benefits : []).map((b) => String(b).trim()).filter(Boolean);
  const benefits = all.length > 3 ? [0, 1, 2].map((i) => all[(day + i) % all.length]) : all;
  const offerLines = wrapLines(String(L.custom || "").trim() || String(prod.offer || "").trim(), 56, 2);
  // who to call: the partner's name and number by default (switched off only when the owner turned them off)
  const brand = String(profile.tagline || "").trim();
  const who0 = String((L.showName === false && brand) ? brand : (profile.name || brand)).trim();
  const whoLine = who0 === brand ? "" : brand.slice(0, 34);
  const phone = !profile.kids_mode && L.showPhone !== false ? String(profile.phone || "").trim() : "";

  const bg = await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).blur(6).modulate({ brightness: 0.8 }).toBuffer();
  const icon = await fetchImage(prod.photo_url);
  const logo = L.hideLogo ? null : await fetchImage(profile.logo_url);
  const avatar = L.hidePhoto ? null : await fetchImage(profile.photo_url);

  // phone on the right, words on the left
  const PX = 650, PY = 372, PW = 360, PH = 620, SX = PX + 16, SY = PY + 16, SW = PW - 32, SH = PH - 32, IC = 250;
  const content = IC + 58 + screenName.length * 42 + (priceLines.length ? 8 + priceLines.length * 36 : 0);
  const icTop = Math.round(SY + 44 + (SH - 44 - content) / 2);
  let y = icTop + IC + 64;
  const screenText = [
    ...screenName.map((l) => { const r = `<text x="${SX + SW / 2}" y="${y}" text-anchor="middle" font-family="${fam(l)}" font-size="34" font-weight="800" fill="#0b2a5b">${esc(l)}</text>`; y += 42; return r; }),
    ...priceLines.map((l, i) => { if (i === 0) y += 8; const r = `<text x="${SX + SW / 2}" y="${y}" text-anchor="middle" font-family="${fam(l)}" font-size="28" font-weight="700" fill="#1d4ed8">${esc(l)}</text>`; y += 36; return r; }),
  ].join("");
  let ly = 452;
  const nameSvg = nameLines.map((l) => { const r = `<text x="60" y="${ly}" font-family="${fam(l)}" font-size="46" font-weight="800" fill="#ffe8a3">${esc(l)}</text>`; ly += 56; return r; }).join("");
  ly += 26;
  const benSvg = benefits.map((b) => {
    const lines = wrapVis(b, 27, 2);
    const r = `<g transform="translate(78, ${ly - 11})"><circle r="18" fill="#22c55e"/><path d="M-8 0 L-2 6 L9 -6" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
      + lines.map((l, j) => `<text x="112" y="${ly + j * 40}" font-family="${fam(l)}" font-size="32" font-weight="600" fill="#ffffff">${esc(l)}</text>`).join("");
    ly += lines.length * 40 + 24;
    return r;
  }).join("");
  const offerH = offerLines.length > 1 ? 104 : 64, offerY = link ? 1008 : 1018;
  const offerSvg = offerLines.length ? `<rect x="60" y="${offerY}" width="${W - 120}" height="${offerH}" rx="${offerH / 2}" fill="#ffe8a3"/>`
    + offerLines.map((l, i) => `<text x="${W / 2}" y="${offerY + 42 + i * 40}" text-anchor="middle" font-family="${fam(l)}" font-size="28" font-weight="800" fill="#0b2a5b">${esc(l)}</text>`).join("") : "";
  const foot = await drawnFooter({ W, H, profile, who0, whoLine, phone, en, link, avatar });
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#061a3a" stop-opacity="0.55"/><stop offset="0.5" stop-color="#061a3a" stop-opacity="0.78"/><stop offset="1" stop-color="#020b1f" stop-opacity="0.94"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#veil)"/>
  ${occasion ? `<rect x="${W - 60 - 420}" y="58" width="420" height="64" rx="32" fill="#ffe8a3"/><text x="${W - 60 - 210}" y="101" text-anchor="middle" font-family="${t.font}" font-size="32" font-weight="700" fill="#5b3a00">${esc(t.big)}</text>` : ""}
  ${hlLines.map((l, i) => `<text x="60" y="${248 + i * (hlSize + 14)}" font-family="${fam(l)}" font-size="${hlSize}" font-weight="800" fill="#ffffff">${esc(l)}</text>`).join("")}
  ${nameSvg}${benSvg}
  <rect x="${PX + 10}" y="${PY + 24}" width="${PW}" height="${PH}" rx="56" fill="#000000" fill-opacity="0.55" filter="url(#soft)"/>
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="56" fill="#0b1220"/>
  <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="42" fill="#ffffff"/>
  <rect x="${SX + SW / 2 - 55}" y="${SY + 12}" width="110" height="24" rx="12" fill="#0b1220"/>
  ${screenText}
  ${offerSvg}
  ${foot.svg}
  ${watermark && !link ? `<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-family="${DEV}" font-size="20" fill="#ffffff" fill-opacity="0.75">Shubhora · ${WM_HOST}/poster</text>` : ""}
  </svg>`;
  const composites = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (icon) {
    const ic = await sharp(icon).resize(IC, IC, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer();
    composites.push({ input: ic, top: icTop, left: Math.round(SX + (SW - IC) / 2) });
  }
  if (logo) {
    const lg = await sharp(logo).resize({ width: 230, height: 84, fit: "inside" }).png().toBuffer();
    const m = await sharp(lg).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 32}" height="${m.height + 24}"><rect width="100%" height="100%" rx="16" fill="#ffffff" fill-opacity="0.95"/></svg>`);
    composites.push({ input: pad, top: 54, left: 60 });
    composites.push({ input: lg, top: 54 + 12, left: 60 + 16 });
  }
  composites.push(...foot.composites);
  await sharp(bg).composite(composites).jpeg({ quality: 88 }).toFile(out);
  return out;
}

/* The weekly "my digital visiting card" poster (owner's call, 25 Sep 2026: "poster me user ka visiting card bhi kabhi
 * kabhi"). The owner's own V-Card drawn on a phone — banner, photo, name, the Call / WhatsApp / Location / Save buttons —
 * with what the card really has beside it, and the link under it. Drawn from the card itself, so it is always the
 * owner's real card, and it costs no AI picture. Sundays (a festival day keeps its festival poster). */
export function isCardDay(dateStr, theme) {
  return theme?.kind !== "occasion" && new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 0;
}

async function renderCardPoster(out, dateStr, profile, card, { file, theme }, watermark, link = "") {
  const W = 1080, H = 1350;
  const en = (profile.lang || "hi") === "en";
  const L = profile.layout && typeof profile.layout === "object" ? profile.layout : {};
  const fam = (s) => (/[ऀ-ॿ]/.test(String(s)) ? DEV : LAT);
  const c = card && typeof card === "object" ? card : {};
  const occasion = theme.kind === "occasion";
  const t = occasion ? await titleFor(theme, profile.lang || "hi") : null;
  const tc = /^#[0-9a-f]{6}$/i.test(c.themeColor || "") ? c.themeColor : "#1d4ed8";

  // what the card really has — only true things go on the poster
  const blocks = (Array.isArray(c.pages) ? c.pages : []).flatMap((pg) => (Array.isArray(pg?.blocks) ? pg.blocks : []));
  const has = (pred) => blocks.some((b) => { try { return !!pred(b); } catch { return false; } });
  const links = Array.isArray(c.links) ? c.links : [];
  const hasLink = (type) => links.some((l) => l?.type === type && String(l.value ?? "").trim().length > 3);
  const offers = [
    has((b) => (b.kind === "product" || b.kind === "services") && (b.items ?? []).some((i) => i?.name)) && (en ? "My products and prices" : "मेरे products और दाम"),
    has((b) => ["gallery", "image", "carousel"].includes(b.kind) && (b.images ?? []).some((i) => i?.url)) && (en ? "Photos of my work" : "मेरे काम की photos"),
    (hasLink("location") || has((b) => b.kind === "location")) && (en ? "Address and map" : "पता और map"),
    has((b) => b.kind === "hours" && (b.rows ?? []).length) && (en ? "Opening hours" : "खुलने का समय"),
    has((b) => b.kind === "testimonials" && (b.items ?? []).some((i) => i?.text)) && (en ? "Customer reviews" : "Customers के reviews"),
    hasLink("upi") && (en ? "Pay by UPI" : "UPI से payment"),
  ].filter(Boolean);
  const bullets = [en ? "Call or WhatsApp in one tap" : "एक tap में call या WhatsApp", ...offers.slice(0, 3), en ? "Save my number in one tap" : "एक tap में मेरा number save"];

  // the card's own header: shops lead with the business name, people with their own
  const biz = c.lead === "business" && String(c.company || "").trim();
  const title = String((biz ? c.company : c.name) || profile.name || "").trim();
  const subOf = biz ? [c.name && c.name !== c.company ? c.name : "", c.jobTitle].filter(Boolean).join(" · ") : [c.jobTitle, c.company].filter(Boolean).join(" · ");
  const sub = String(subOf || c.tagline || profile.tagline || "").trim();
  const city = String(c.seo?.city || profile.city || "").trim();
  const hl = String(L.title || "").trim() || (en ? "My Digital Visiting Card" : "मेरा Digital Visiting Card");
  const hlLines = wrapLines(hl, 26, 2);
  const hlSize = hlLines.some((l) => l.length > 20) ? 56 : 62;
  const tag = String(L.custom || "").trim() || (en ? "Call, WhatsApp, location — all on one link" : "Call, WhatsApp, location — सब एक link पर");

  const bg = await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).blur(6).modulate({ brightness: 0.8 }).toBuffer();
  const logo = L.hideLogo ? null : await fetchImage(profile.logo_url);
  const cardPhoto = await fetchImage(c.avatarUrl || profile.photo_url);
  const cover = await fetchImage(c.coverUrl);
  const footPhoto = L.hidePhoto ? null : await fetchImage(profile.photo_url || c.avatarUrl);

  // the phone, on the right
  const PX = 600, PY = 330, PW = 420, PH = 740, SX = PX + 16, SY = PY + 16, SW = PW - 32, SH = PH - 32, CH = 190, AV = 132;
  const avX = Math.round(SX + SW / 2 - AV / 2), avY = SY + CH - AV / 2;
  const square = c.avatarShape === "square";
  let y = avY + AV + 50;
  const titleLines = wrapLines(title, 18, 2);
  const titleSvg = titleLines.map((l) => { const r = `<text x="${SX + SW / 2}" y="${y}" text-anchor="middle" font-family="${fam(l)}" font-size="${titleLines.length > 1 ? 28 : 32}" font-weight="800" fill="#0b2a5b">${esc(l)}</text>`; y += 36; return r; }).join("");
  const subLines = wrapVis(sub, 34, 2);
  const subSvg = subLines.map((l) => { const r = `<text x="${SX + SW / 2}" y="${y}" text-anchor="middle" font-family="${fam(l)}" font-size="21" fill="#475569">${esc(l)}</text>`; y += 27; return r; }).join("");
  const citySvg = city ? `<text x="${SX + SW / 2}" y="${y + 2}" text-anchor="middle" font-family="${fam(city)}" font-size="20" fill="#64748b">${esc(city)}</text>` : "";
  if (city) y += 28;
  const BW = Math.round((SW - 48) / 2), BH = 58, bx0 = SX + 16, by0 = y + 16;
  const btns = [["Call", "#16a34a"], ["WhatsApp", "#25D366"], ["Location", "#2563eb"], [en ? "Save contact" : "Save", tc]]
    .map(([label, col], i) => { const bx = bx0 + (i % 2) * (BW + 16), by = by0 + Math.floor(i / 2) * (BH + 14); return `<rect x="${bx}" y="${by}" width="${BW}" height="${BH}" rx="16" fill="${col}"/><text x="${bx + BW / 2}" y="${by + 37}" text-anchor="middle" font-family="${LAT}" font-size="22" font-weight="800" fill="#ffffff">${label}</text>`; }).join("");
  const skY = by0 + 2 * BH + 14 + 30;
  const skeleton = [0.86, 0.72, 0.8, 0.56].map((w, i) => skY + i * 28 + 14 <= SY + SH - 24 ? `<rect x="${SX + 24}" y="${skY + i * 28}" width="${Math.round((SW - 48) * w)}" height="14" rx="7" fill="#e2e8f0"/>` : "").join("");

  // the words, on the left (centred against the phone)
  let ly = 520;
  const listHead = `<text x="60" y="${ly}" font-family="${fam(en ? "On my card" : "मेरे card पर")}" font-size="32" font-weight="800" fill="#ffe8a3">${en ? "On my card" : "मेरे card पर"}</text>`;
  ly += 58;
  const listSvg = bullets.map((b) => {
    const lines = wrapVis(b, 27, 2);
    const r = `<g transform="translate(78, ${ly - 11})"><circle r="18" fill="#22c55e"/><path d="M-8 0 L-2 6 L9 -6" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
      + lines.map((l, j) => `<text x="112" y="${ly + j * 40}" font-family="${fam(l)}" font-size="32" font-weight="600" fill="#ffffff">${esc(l)}</text>`).join("");
    ly += lines.length * 40 + 26;
    return r;
  }).join("");

  const brand = String(profile.tagline || "").trim();
  const who0 = String((L.showName === false && brand) ? brand : (profile.name || brand)).trim();
  const whoLine = who0 === brand ? "" : brand.slice(0, 34);
  const phone = !profile.kids_mode && L.showPhone !== false ? String(profile.phone || "").trim() : "";
  const foot = await drawnFooter({ W, H, profile, who0, whoLine, phone, en, link, avatar: footPhoto });

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#061a3a" stop-opacity="0.55"/><stop offset="0.5" stop-color="#061a3a" stop-opacity="0.78"/><stop offset="1" stop-color="#020b1f" stop-opacity="0.94"/></linearGradient>
    <linearGradient id="cov" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tc}"/><stop offset="1" stop-color="#0b2a5b"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
    <clipPath id="scr"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="42"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#veil)"/>
  ${occasion ? `<rect x="${W - 60 - 420}" y="58" width="420" height="64" rx="32" fill="#ffe8a3"/><text x="${W - 60 - 210}" y="101" text-anchor="middle" font-family="${t.font}" font-size="32" font-weight="700" fill="#5b3a00">${esc(t.big)}</text>` : ""}
  ${hlLines.map((l, i) => `<text x="60" y="${240 + i * (hlSize + 12)}" font-family="${fam(l)}" font-size="${hlSize}" font-weight="800" fill="#ffffff">${esc(l)}</text>`).join("")}
  <text x="60" y="${240 + (hlLines.length - 1) * (hlSize + 12) + 52}" font-family="${fam(tag)}" font-size="30" fill="#cfe0ff">${esc(tag)}</text>
  ${listHead}${listSvg}
  <rect x="${PX + 10}" y="${PY + 24}" width="${PW}" height="${PH}" rx="60" fill="#000000" fill-opacity="0.55" filter="url(#soft)"/>
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="60" fill="#0b1220"/>
  <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="44" fill="#ffffff"/>
  ${cover ? "" : `<g clip-path="url(#scr)"><rect x="${SX}" y="${SY}" width="${SW}" height="${CH}" fill="url(#cov)"/></g>`}
  ${titleSvg}${subSvg}${citySvg}${btns}${skeleton}
  ${foot.svg}
  </svg>`;
  const composites = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (cover) {
    const mask = Buffer.from(`<svg width="${SW}" height="${CH}"><rect width="${SW}" height="${CH + 60}" rx="44" fill="#fff"/></svg>`);
    const cv = await sharp(cover).resize(SW, CH, { fit: "cover", position: "attention" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    composites.push({ input: cv, top: SY, left: SX });
  }
  // the notch sits over the banner
  composites.push({ input: Buffer.from(`<svg width="110" height="24"><rect width="110" height="24" rx="12" fill="#0b1220"/></svg>`), top: SY + 12, left: Math.round(SX + SW / 2 - 55) });
  const ringR = square ? 30 : AV / 2 + 7;
  composites.push({ input: Buffer.from(`<svg width="${AV + 14}" height="${AV + 14}"><rect width="${AV + 14}" height="${AV + 14}" rx="${ringR}" fill="#ffffff"/></svg>`), top: avY - 7, left: avX - 7 });
  if (cardPhoto) {
    const m = Buffer.from(`<svg width="${AV}" height="${AV}"><rect width="${AV}" height="${AV}" rx="${square ? 24 : AV / 2}" fill="#fff"/></svg>`);
    const ph = await sharp(cardPhoto).resize(AV, AV, { fit: square ? "contain" : "cover", position: "attention", background: "#ffffff" }).flatten({ background: "#ffffff" }).composite([{ input: m, blend: "dest-in" }]).png().toBuffer();
    composites.push({ input: ph, top: avY, left: avX });
  } else {
    const ini = String(title || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    composites.push({ input: Buffer.from(`<svg width="${AV}" height="${AV}"><rect width="${AV}" height="${AV}" rx="${square ? 24 : AV / 2}" fill="${tc}"/><text x="${AV / 2}" y="${AV / 2 + 16}" text-anchor="middle" font-family="${fam(ini)}" font-size="46" font-weight="800" fill="#ffffff">${esc(ini)}</text></svg>`), top: avY, left: avX });
  }
  if (logo) {
    const lg = await sharp(logo).resize({ width: 230, height: 84, fit: "inside" }).png().toBuffer();
    const m = await sharp(lg).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 32}" height="${m.height + 24}"><rect width="100%" height="100%" rx="16" fill="#ffffff" fill-opacity="0.95"/></svg>`);
    composites.push({ input: pad, top: 54, left: 60 }, { input: lg, top: 54 + 12, left: 60 + 16 });
  }
  composites.push(...foot.composites);
  await sharp(bg).composite(composites).jpeg({ quality: 88 }).toFile(out);
  return out;
}

/* ---------------- Signature (30 Sep 2026) ---------------- */
/** Which Signature look a render gets, or null for the original styles. */
export function signatureLookFor(profile, style, { premium = false, watermark = false, card = null } = {}) {
  if (!premium || watermark || card) return null;
  const L = profile?.layout && typeof profile.layout === "object" ? profile.layout : {};
  if (L.look === "old") return STYLES[style]?.signature || null;          // the owner chose the old styles; a calendar day can still ask
  if (STYLES[style]?.signature) return STYLES[style].signature;           // "signature" / "signature-classic" by name
  if (L.look === "classic" || L.look === "vibrant") return L.look;
  return sigDefaultLook(profile?.category);
}
const LINES_DIR = path.join(BASE_DIR, "lines");
const SIG_LANG = (lang) => (lang === "en" || lang === "hinglish" ? "en" : "hi");
const sigScriptOk = (t, lang) => !!t && !/https?:|www\.|@|#|\d/.test(t) && (lang === "hi" ? /[ऀ-ॿ]/.test(t) && !/[ऀ-ॿ][A-Za-z]|[A-Za-z][ऀ-ॿ]/.test(t) : !/[ऀ-ൿ]/.test(t));
/** The day's two headline lines for a greeting / festival: a hook that makes people think + a warm second line.
 *  Written once per theme + language + day and shared by every user (₹0.05 a day, not per user); a bad line never
 *  reaches a poster — the theme's own words are the fallback. */
// The words on the Signature poster come from the better writer (Flash, not Lite) — one call per theme + trade group +
// language per day, shared by everyone in that trade (₹0.3 a day for the whole system), falling back to Lite if it is
// unavailable, and to the line bank if both fail. POSTER_TEXT_MODEL in .env.local overrides.
const TEXT_MODEL = process.env.POSTER_TEXT_MODEL || "gemini-3.5-flash";
async function writeJson(prompt, { temperature = 0.8, maxOutputTokens = 240 } = {}) {
  const ask = async (model) => {
    const j = await gemini(model, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json" } });
    return JSON.parse(String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").replace(/^```(json)?|```$/g, "").trim());
  };
  try { return await ask(TEXT_MODEL); } catch (e) { if (TEXT_MODEL === CHECK_MODEL) throw e; console.log(`[poster] ${TEXT_MODEL} → ${CHECK_MODEL} (${String(e.message).slice(0, 80)})`); return ask(CHECK_MODEL); }
}
const HOOK_STYLES = ["a sharp question the reader asks themselves", "an unexpected contrast (two things set against each other)", "a small everyday truth said in a fresh way", "one tiny scene the reader can picture (a cup, a shutter, a road)"];
const HOOK_EXAMPLES = {
  hi: `"सूरज रोज़ उगता है, आप?" · "थकान सच है, हार नहीं" · "पहली चाय, पहला फ़ैसला" · "पेड़ जल्दी में नहीं होते" · "जो है, उसे गिनिए"`,
  en: `"The sun shows up daily. Do you?" · "Tired is real. Quitting isn't." · "First tea, first decision" · "Trees are never in a hurry"`,
};
const CLICHES = `"सफलता की ओर", "आइए मिलकर", "नई शुरुआत", "सपनों को साकार", "आपकी सेवा में", "Dream big", "Unlock your potential", "Take the first step"`;
const TRADE_LINE = (group, label) => label ? `The business is a ${label} (${group}). The lines may touch its world lightly — a customer's morning, the shop, the craft — but they are a thought for the day, never an advertisement, never a product mention.` : "";
/** The day's two headline lines: a hook that makes people think + a warm second line, written for the trade. */
async function signatureLines(theme, lang, dateStr, { group = "Personal", label = "" } = {}) {
  const t = await titleFor(theme, lang || "hi");
  const L = SIG_LANG(lang);
  const bank = SIG_LINES[theme.slug]?.[L];
  const fallback = bank ? { h1: bank[0], h2: bank[1] } : { h1: t.big, h2: t.small || "" };
  if (!KEY) return fallback;
  fs.mkdirSync(LINES_DIR, { recursive: true });
  const file = path.join(LINES_DIR, `${dateStr}-${theme.slug}-${String(group).toLowerCase()}-${L}.json`);
  if (fs.existsSync(file)) { try { const j = JSON.parse(fs.readFileSync(file, "utf8")); if (j.h1) return j; } catch { /* rewrite */ } }
  const occasion = theme.kind === "occasion";
  const day = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
  const prompt = `You write the two lines on a small Indian business's daily poster. Language: ${L === "hi" ? "Hindi (Devanagari script only, not one Latin letter, no Urdu-heavy words)" : "simple Indian English"}.
${occasion ? `Occasion: ${theme.en} (${theme.hi}).` : `Theme of the day: ${theme.en} (${theme.hi}); mood: ${theme.greet || ""}.`}
${TRADE_LINE(group, label)}
h1 — the headline, at most 6 words. It must make the reader pause: ${HOOK_STYLES[day % HOOK_STYLES.length]}. Plain, spoken words a shopkeeper would say; no exclamation marks; never a plain greeting. Tone examples (style only, never copy): ${HOOK_EXAMPLES[L]}
h2 — one warm line, at most 12 words, that lands h1 in everyday life${occasion ? " and wishes the reader well for the occasion" : ""}. It must say something h1 did not.
Never use: ${CLICHES}. No brand names, no numbers, no hashtags, no emojis, no quotation marks. Return JSON only: {"h1":"…","h2":"…"}`;
  try {
    const out = await writeJson(prompt);
    const h1 = String(out.h1 || "").replace(/\s+/g, " ").trim(), h2 = String(out.h2 || "").replace(/\s+/g, " ").trim();
    if (sigScriptOk(h1, L) && h1.split(" ").length <= 8 && sigScriptOk(h2, L) && h2.split(" ").length <= 16) { const lines = { h1, h2 }; fs.writeFileSync(file, JSON.stringify(lines)); return lines; }
  } catch (e) { console.log(`[poster] signature lines ${theme.slug}/${group}/${L}: ${e.message}`); }
  return fallback;
}
/** A product's headline: not its name (that is the kicker) but a hook about what it does for the customer, plus one
 *  line that carries the day's benefit. Written once per product + benefit + language and kept for good. */
async function productLines(prod, benefit, lang, { label = "" } = {}) {
  const L = SIG_LANG(lang), name = String(prod?.name || "").trim();
  const fallback = { h1: name, h2: benefit || prod?.offer || "" };
  if (!KEY || !name) return fallback;
  fs.mkdirSync(LINES_DIR, { recursive: true });
  const file = path.join(LINES_DIR, `product-${crypto.createHash("md5").update(`${name}|${benefit}|${L}`).digest("hex").slice(0, 12)}.json`);
  if (fs.existsSync(file)) { try { const j = JSON.parse(fs.readFileSync(file, "utf8")); if (j.h1) return j; } catch { /* rewrite */ } }
  const prompt = `You write the two lines on a small Indian business's product poster. Language: ${L === "hi" ? "Hindi (Devanagari script only; a product's English name may stay in English)" : "simple Indian English"}.
Business: ${label || "a small business"}. Product: "${name}".${benefit ? ` Today's benefit to highlight: "${benefit}".` : ""}${prod?.offer ? ` Offer: "${prod.offer}".` : ""}${Array.isArray(prod?.benefits) && prod.benefits.length ? ` Other benefits: ${prod.benefits.slice(0, 4).join("; ")}.` : ""}
h1 — the headline, at most 6 words: what this product changes for the customer, said as a hook — a question, a contrast or a small truth. Not the product name, not "buy now", no exclamation marks. Examples of the tone (style only): ${L === "hi" ? `"एक लिंक, पूरा बिज़नेस" · "ग्राहक इंतज़ार नहीं करता" · "रात दो बजे का जवाब"` : `"One link, your whole business" · "Customers don't wait" · "An answer at 2 AM"`}
h2 — one line, at most 12 words, that states today's benefit plainly (use the given benefit; do not invent facts, prices or guarantees).
No hashtags, no emojis, no quotation marks. Return JSON only: {"h1":"…","h2":"…"}`;
  try {
    const out = await writeJson(prompt, { temperature: 0.7 });
    const h1 = String(out.h1 || "").replace(/\s+/g, " ").trim(), h2 = String(out.h2 || "").replace(/\s+/g, " ").trim();
    const okText = (t) => !!t && !/https?:|www\.|@|#/.test(t) && !/[\u{1F000}-\u{1FAFF}]/u.test(t);
    if (okText(h1) && h1.split(" ").length <= 8 && okText(h2) && h2.split(" ").length <= 16 && (L === "en" || /[ऀ-ॿ]/.test(h1))) { const lines = { h1, h2 }; fs.writeFileSync(file, JSON.stringify(lines)); return lines; }
  } catch (e) { console.log(`[poster] product lines ${name}: ${e.message}`); }
  return fallback;
}
/** "98765 43210" from whatever the owner typed. */
const prettyPhone = (p) => { const d = String(p || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : String(p || "").trim(); };
/** An image (URL / data / local) copied once into base/cache so the spec can point at a file. */
async function cachedImage(url, prefix) {
  const buf = await fetchImage(url); if (!buf) return null;
  const dir = path.join(BASE_DIR, "cache"); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${prefix}-${crypto.createHash("md5").update(buf).digest("hex").slice(0, 12)}.png`);
  if (!fs.existsSync(f)) await sharp(buf).resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).png().toFile(f);
  return f;
}
/** The USP chips: the owner's own lines (layout.usps, "label|sub" or {label,sub}) else the trade's defaults. */
function sigChips(profile, group, lang) {
  const L = profile.layout && typeof profile.layout === "object" ? profile.layout : {};
  const own = Array.isArray(L.usps) ? L.usps.map((u) => (typeof u === "string" ? u.split("|") : [u?.label, u?.sub])).map(([label, sub]) => ({ label: String(label || "").trim().slice(0, 22), sub: String(sub || "").trim().slice(0, 22) })).filter((c) => c.label) : [];
  if (own.length) return own.slice(0, 5);
  return sigUspsFor(profile.category, group, lang).map((u) => { const [label, sub] = u.split("|"); return { label, sub: sub || "" }; });
}
/** Offer words → a round badge: "20% off" → ["20%","OFF"], "₹249" → ["सिर्फ़","₹249"]. */
function sigBadge(text, lang) {
  const t = String(text || "");
  const pc = /(\d{1,2})\s*%/.exec(t); if (pc) return [`${pc[1]}%`, "OFF"];
  const rs = /₹\s?(\d[\d,]{1,6})/.exec(t); if (rs) return [SIG_LANG(lang) === "hi" ? "सिर्फ़" : "Only", `₹${rs[1]}`];
  if (/free|फ़्री|फ्री|मुफ़्त/i.test(t)) return ["FREE", SIG_LANG(lang) === "hi" ? "ऑफ़र" : "offer"];
  return null;
}
async function renderSignaturePoster(out, dateStr, profile, { look, theme, products = [], testimonial = null, custom = "", link = "", stock = null }) {
  const lang = profile.lang || "hi", L2 = SIG_LANG(lang);
  const layout = profile.layout && typeof profile.layout === "object" ? profile.layout : {};
  const group = sigGroupOf(profile.category, profile.persona);
  // colour: the trade's hand-picked world (signature-presets PALETTES); an accent the owner set in the app wins and
  // gets the derived palette; Shubhora's own products get the brand's navy → blue → violet below
  const ownAccent = /^#[0-9a-f]{6}$/i.test(layout.accent || "") && layout.accent.toLowerCase() !== String(sigAccentOf(profile.category)).toLowerCase();
  const world = ownAccent ? null : sigPaletteOf(profile.category, group);
  let accent = ownAccent ? layout.accent : (world?.a || sigAccentOf(profile.category));
  let palette = world ? (look === "classic" ? sigPaletteFor("classic", world.classic || world.b) : { a: world.a, b: world.b, c: world.c, ink: world.ink, accent: world.a, hi: world.hi, kick: world.kick, badge: world.badge }) : null;
  const day = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
  const occasion = theme.kind === "occasion";
  const ident = identityFor(profile);
  const name = (ident.big || profile.name || "").trim();
  const city = String(profile.city || "").trim();
  const tagline = [ident.line && ident.line !== name ? ident.line : sigLabelOf(profile.category, lang), city].filter(Boolean).join(" · ") || profile.tagline || "";
  const prod = profile.mode === "product" && products.length && !testimonial ? products[day % products.length] : null;
  const customLine = String(custom || layout.custom || "").trim().slice(0, 80);
  // the day's kind: festival > customer story > product day (benefit / offer / plain) > an offer line on its own > greeting
  const roster = stock?.kind || "";
  const kind = occasion ? "festival" : testimonial?.text ? "testimonial"
    : prod ? (roster === "benefit" && customLine ? "benefit" : customLine ? "offer" : "product")
    : customLine ? "offer" : (["tip", "benefit"].includes(roster) ? roster : "greeting");

  // words — h0 = small white kicker on the brush, h1 = the big yellow line, h2 = the line under the brush
  let h0 = "", h1 = "", h2 = "", badge = null, tag = SIG_TAG[L2][kind] || SIG_TAG[L2].greeting;
  if (prod) {
    const benefits = (Array.isArray(prod.benefits) ? prod.benefits : []).filter(Boolean);
    const benefit = benefits.length ? benefits[Math.floor(day / products.length) % benefits.length] : "";
    const tradeLabel = sigLabelOf(profile.category, "en") || group;
    if (kind === "benefit") { const pl = await productLines(prod, customLine, lang, { label: tradeLabel }); h0 = prod.name || tag; h1 = pl.h1 !== prod.name ? pl.h1 : customLine; h2 = pl.h1 !== prod.name ? (pl.h2 || customLine) : (prod.offer || tagline); }
    else if (kind === "offer") { h0 = tag; h1 = customLine; h2 = [prod.name, benefit].filter(Boolean).join(" — ") || tagline; }
    else { const pl = await productLines(prod, benefit, lang, { label: tradeLabel }); h0 = pl.h1 !== prod.name ? (prod.name || tag) : tag; h1 = pl.h1 || prod.name || tagline; h2 = pl.h2 || benefit || prod.offer || tagline; }
    badge = sigBadge(customLine || prod.offer || "", lang);
  } else if (testimonial?.text) {
    h0 = L2 === "hi" ? "ग्राहक क्या कहते हैं" : "What customers say";
    h1 = `“${String(testimonial.text).trim().slice(0, 60)}${String(testimonial.text).trim().length > 60 ? "…" : ""}”`;
    h2 = [testimonial.name, testimonial.city].filter(Boolean).join(", ") || tagline;
  } else {
    const lines = await signatureLines(theme, lang, dateStr, { group, label: sigLabelOf(profile.category, "en") });
    const t = await titleFor(theme, lang);
    if (occasion) { h0 = L2 === "hi" ? "हार्दिक शुभकामनाएँ" : "Warm wishes on"; h1 = t.big; h2 = lines.h2 && lines.h2 !== t.small ? lines.h2 : (t.small || tagline); }
    else { h0 = t.big; h1 = lines.h1 && lines.h1 !== t.big ? lines.h1 : (t.small || t.big); h2 = lines.h2 && lines.h2 !== lines.h1 ? lines.h2 : tagline; }
    if (customLine) {
      badge = sigBadge(customLine, lang);
      // an offer leads the poster on a business day; on a festival the wish stays on top and the offer goes under it
      if (occasion) h2 = customLine;
      else { h0 = badge ? SIG_TAG[L2].offer : h0; h1 = customLine; h2 = lines.h2 && lines.h2 !== customLine ? lines.h2 : tagline; }
    }
  }

  // picture: the product's own photo on a product day, else a landscape stock photo of the TRADE (the poster is the
  // business's ad; the day's words carry the greeting) — of the festival on festival days — else the app's banner
  let hero = null;
  // Shubhora's own products are software: drawn as the partner's customers see them (their card on a phone, the AI
  // answering on WhatsApp, a dashboard on a laptop) instead of the plan icon
  if (prod && isShubhoraProduct(prod)) {
    accent = "#2f5bf5";
    // the logo's navy wordmark + its blue / violet flame: navy → blue → violet band, white headline (no yellow), cyan kicker
    palette = look === "classic" ? sigPaletteFor("classic", "#1b2a8f") : { a: "#0d1466", b: "#2f5bf5", c: "#6a3cf0", ink: "#0a1160", accent: "#2f5bf5", hi: "#ffffff", kick: "#9fdcff", badge: "#ffd166" };
    try { const art = await shubhoraProductArt(prod, profile, { accent: "#2f5bf5", accent2: "#6a3cf0", lang }); if (art?.file) hero = { file: art.file, mode: "cutout" }; }
    catch (e) { console.log(`[poster] shubhora product art: ${e.message}`); }
  }
  if (!hero && prod?.photo_url) { const f = await cachedImage(prod.photo_url, "prod"); if (f) hero = { file: f, mode: "product" }; }
  if (!hero) {
    try { const ph = await ensureStockPhoto({ theme, category: stock?.category || profile.category || "", kind: occasion ? "festival" : "product", dateStr }); if (ph?.file) hero = { file: ph.file, mode: "photo" }; }
    catch (e) { console.log(`[poster] signature photo: ${e.message}`); }
  }
  if (!hero) { const b = SIG_BANNER[group] || SIG_BANNER.Personal; const f = path.join(APP, "public", "art", "banners", b.file); if (fs.existsSync(f)) hero = { file: f, mode: "photo", box: b.box }; }
  const logo = layout.hideLogo ? null : await cachedImage(profile.logo_url, "logo").catch(() => null);

  const cta = SIG_CTA[group]?.[L2] || SIG_CTA.Personal[L2];
  const phone = prettyPhone(profile.phone);
  const spec = {
    look, accent, ...(palette ? { palette } : {}), name, tagline, logo, tag, h0, h1, h2, badge,
    chips: sigChips(profile, group, lang), usps: sigChips(profile, group, lang).map((c) => c.label),
    s1: SIG_SCRIPT[group]?.[0] || "", s2: SIG_SCRIPT[group]?.[1] || "",
    cta1: phone ? cta[0] : (L2 === "hi" ? "मेरा डिजिटल कार्ड" : "My digital card"), cta2: phone || link || "", btn: cta[1], cta: cta[2],
    phone: phone || "", address: city ? city : "", link: link || "", lang,
    hero, meta: { profileId: profile.id, date: dateStr, kind, theme: theme.slug, group },
  };
  await renderSignature(spec, { format: "45", out });
  fs.writeFileSync(`${out}.spec.json`, JSON.stringify(spec));
  try { await renderSignature(spec, { format: "11", master: out, out: out.replace(/\.jpg$/, "-11.jpg") }); } catch (e) { console.log(`[poster] signature 1:1: ${e.message}`); }
  return out;
}

async function renderProductPoster(out, dateStr, profile, products, { file, theme }, watermark, premium = false, link = "") {
  const W = 1080, H = 1350;
  const day = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
  const prod = products[day % products.length];
  if (isDigitalProduct(prod)) return renderDigitalProductPoster(out, dateStr, profile, prod, { file, theme }, watermark, day, link);
  const benefits = (Array.isArray(prod.benefits) ? prod.benefits : []).filter(Boolean);
  const benefit = benefits.length ? benefits[Math.floor(day / products.length) % benefits.length] : "";
  const [accent, deep] = PALETTES[day % PALETTES.length];
  const occasion = theme.kind === "occasion";
  const t = await titleFor(theme, profile.lang || "hi");
  const ident = identityFor(profile);
  const cta = ident.phone;
  const custom0 = String(profile.layout?.custom || "").slice(0, 60);
  const line = (repeats(custom0, ident.big, profile.name, profile.tagline) ? "" : custom0) || ident.line;

  // backdrop: daily art blurred + tinted so every day looks different but the product stays the hero
  const art = await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).blur(18).modulate({ brightness: 0.55, saturation: 0.9 }).toBuffer();
  const photo = await fetchImage(prod.photo_url);
  const logo = await fetchImage(profile.logo_url);
  const avatar = await fetchImage(profile.photo_url);
  const composites = [];
  if (premium) {
    const artBuf = await ensureProductArt(dateStr, prod, { photo, logo, day, profile });
    if (artBuf) {
      const base = await sharp(artBuf).resize(W, H, { fit: "cover" }).png().toBuffer();
      const customOffer = String(profile.layout?.custom || "").slice(0, 60);
      const feat = customOffer || (benefit && !latinShort(benefit) ? benefit : "");
      const ps = productScene(prod, profile, day);
      const hl = (profile.lang || "hi") === "en" ? ps.en : ps.hi;
      const hlLines = wrapText(hl, (profile.lang || "hi") === "en" ? 18 : 16);
      const feats = (Array.isArray(prod.benefits) ? prod.benefits : []).filter(latinShort).slice(0, 4);
      const nameFam = /[ऀ-ॿ]/.test(prod.name) ? DEV : LAT;
      // A long name ("Shubhora AI Business Assistant — Growth") ran right-to-left over the logo: two short lines instead.
      const nameLines = wrapText(prod.name, 20).slice(0, 2);
      const nameSize = nameLines.some((l) => l.length > 14) ? 40 : 48;
      const headSvg = `${nameLines.map((l, i) => `<text x="${W - 60}" y="${80 + i * (nameSize + 8)}" text-anchor="end" font-family="${nameFam}" font-size="${nameSize}" font-weight="800" fill="#0b2a5b">${esc(l)}</text>`).join("")}
  ${hlLines.map((l, i) => `<text x="60" y="${H * 0.42 + i * 66}" font-family="${/[ऀ-ॿ]/.test(l) ? DEV : LAT}" font-size="56" font-weight="800" fill="#0b2a5b">${esc(l)}</text>`).join("")}
  ${feats.map((f, i) => { const cx = 110 + i * 150, cy = H * 0.42 + hlLines.length * 66 + 40; const ws = f.split(" ").slice(0, 3); return `<g transform="translate(${cx}, ${cy})"><circle r="34" fill="#ffffff" fill-opacity="0.9" stroke="#1d4ed8" stroke-width="2"/>${ICONS[ICON_KEYS[i % ICON_KEYS.length]]}</g>${ws.map((w, j) => `<text x="${cx}" y="${cy + 62 + j * 22}" text-anchor="middle" font-family="${LAT}" font-size="19" font-weight="700" fill="#0b2a5b">${esc(w)}</text>`).join("")}`; }).join("")}`;
      const offerW = prod.offer ? Math.min(600, prod.offer.length * 20 + 60) : 0;
      const fsvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  ${headSvg}
  <rect y="${H - 240}" width="${W}" height="240" fill="#062a5c" fill-opacity="0.55"/>
  ${occasion ? `<rect x="${W / 2 - 260}" y="${H - 300}" width="520" height="52" rx="26" fill="#ffe8a3"/><text x="${W / 2}" y="${H - 264}" text-anchor="middle" font-family="${t.font}" font-size="30" font-weight="700" fill="#5b3a00">${esc(t.big)}</text>` : ""}
  <text x="70" y="${H - 150}" font-family="${DEV}" font-size="${fitPx(ident.big, cta ? W - 70 - 490 : W - 140, 50, 28)}" font-weight="800" fill="#ffffff">${esc(ident.big)}</text>
  ${line ? `<text x="70" y="${H - 102}" font-family="${DEV}" font-size="${fitPx(line, cta ? W - 70 - 490 : W - 140, 30, 20)}" fill="#dbeafe">${esc(line)}</text>` : ""}
  ${feat ? `<text x="70" y="${H - 58}" font-family="${DEV}" font-size="28" font-weight="600" fill="#ffe8a3">${esc(feat)}</text>` : prod.offer ? `<text x="70" y="${H - 58}" font-family="${DEV}" font-size="28" font-weight="700" fill="#ffe8a3">${esc(prod.offer)}</text>` : ""}
  ${cta ? `<rect x="${W - 470}" y="${H - 178}" width="400" height="86" rx="43" fill="#ffffff"/><text x="${W - 270}" y="${H - 142}" text-anchor="middle" font-family="${LAT}" font-size="22" font-weight="700" fill="#1d4ed8">CALL / WHATSAPP NOW</text><text x="${W - 270}" y="${H - 106}" text-anchor="middle" font-family="${LAT}" font-size="34" font-weight="900" fill="#062a5c">${esc(cta)}</text>` : ""}
  ${watermark ? `<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-family="${DEV}" font-size="20" fill="#ffffff" fill-opacity="0.75">Shubhora · ${WM_HOST}/poster</text>` : ""}
  </svg>`;
      await sharp(base).composite([{ input: Buffer.from(fsvg), top: 0, left: 0 }]).jpeg({ quality: 88 }).toFile(out);
      return out;
    }
  }
  const nameLines = wrapText(prod.name, 18);
  const benLines = wrapText(benefit, 26);
  const titleY = occasion ? 150 : 0;
  const cardTop = occasion ? 260 : 150, cardH = 520;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${deep}" stop-opacity="0.85"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#tint)"/>
  ${occasion ? `<text x="${W / 2}" y="${titleY}" text-anchor="middle" font-family="${t.font}" font-size="${t.big.length > 16 ? 60 : 76}" font-weight="700" fill="#ffffff">${esc(t.big)}</text><text x="${W / 2}" y="${titleY + 52}" text-anchor="middle" font-family="${LAT}" font-size="26" letter-spacing="2" fill="#ffe8a3">${esc(t.small)}</text>` : ""}
  <rect x="90" y="${cardTop}" width="${W - 180}" height="${cardH}" rx="36" fill="#ffffff" fill-opacity="0.96"/>
  ${nameLines.map((l, i) => `<text x="${W / 2}" y="${cardTop + cardH + 84 + i * 72}" text-anchor="middle" font-family="${/[ऀ-ॿ]/.test(l) ? DEV : LAT}" font-size="64" font-weight="800" fill="#ffffff">${esc(l)}</text>`).join("")}
  ${benLines.map((l, i) => `<text x="${W / 2}" y="${cardTop + cardH + 84 + nameLines.length * 72 + 20 + i * 48}" text-anchor="middle" font-family="${DEV}" font-size="38" font-weight="600" fill="#e6f4f2">${esc(l)}</text>`).join("")}
  ${prod.offer ? `<rect x="${W / 2 - 300}" y="${cardTop + cardH + 84 + nameLines.length * 72 + 30 + benLines.length * 48}" width="600" height="70" rx="35" fill="#ffe8a3"/><text x="${W / 2}" y="${cardTop + cardH + 84 + nameLines.length * 72 + 30 + benLines.length * 48 + 48}" text-anchor="middle" font-family="${DEV}" font-size="34" font-weight="800" fill="${deep}">${esc(prod.offer)}</text>` : ""}
  <rect y="${H - 230}" width="${W}" height="230" fill="#06111c" fill-opacity="0.6"/>
  <text x="${avatar ? 300 : 70}" y="${H - 150}" font-family="${DEV}" font-size="${fitPx(ident.big, W - (avatar ? 300 : 70) - 70, 50, 28)}" font-weight="700" fill="#ffffff">${esc(ident.big)}</text>
  ${line ? `<text x="${avatar ? 300 : 70}" y="${H - 100}" font-family="${DEV}" font-size="${fitPx(line, W - (avatar ? 300 : 70) - 70, 30, 20)}" fill="#e6f4f2">${esc(line)}</text>` : ""}
  ${cta ? `<g transform="translate(${avatar ? 300 : 70}, ${H - 78}) scale(1.4)"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#7fe3d6"/></g><text x="${(avatar ? 300 : 70) + 44}" y="${H - 48}" font-family="${LAT}" font-size="32" font-weight="700" fill="#7fe3d6">${esc(cta)}</text>` : ""}
  ${watermark ? `<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-family="${DEV}" font-size="20" fill="#ffffff" fill-opacity="0.75">Shubhora · ${WM_HOST}/poster</text>` : ""}
  </svg>`;
  composites.push({ input: Buffer.from(svg), top: 0, left: 0 });
  if (photo) {
    const p = await sharp(photo).resize(W - 260, cardH - 60, { fit: "inside" }).png().toBuffer();
    const m = await sharp(p).metadata();
    composites.push({ input: p, top: Math.round(cardTop + (cardH - m.height) / 2), left: Math.round((W - m.width) / 2) });
  }
  if (avatar) {
    const size = 170;
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    const round = await sharp(avatar).resize(size, size, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const ring = Buffer.from(`<svg width="${size + 12}" height="${size + 12}"><circle cx="${(size + 12) / 2}" cy="${(size + 12) / 2}" r="${(size + 12) / 2}" fill="#ffffff"/></svg>`);
    composites.push({ input: ring, top: H - 205 - 6, left: 70 - 6 });
    composites.push({ input: round, top: H - 205, left: 70 });
  }
  if (logo) {
    const lg = await sharp(logo).resize({ width: 200, height: 90, fit: "inside" }).png().toBuffer();
    const m = await sharp(lg).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 28}" height="${m.height + 20}"><rect width="100%" height="100%" rx="14" fill="#ffffff" fill-opacity="0.92"/></svg>`);
    composites.push({ input: pad, top: H - 115 - (m.height + 20) / 2, left: W - 70 - (m.width + 28) });
    composites.push({ input: lg, top: H - 115 - m.height / 2, left: W - 70 - 14 - m.width });
  }
  await sharp(art).composite(composites).jpeg({ quality: 86 }).toFile(out);
  return out;
}
/**
 * Testimonial poster: the day's art (blurred, darkened) as backdrop, a big
 * white quote card with the customer's words, star rating, name/city and an
 * optional round customer photo; the same identity footer as the product poster.
 * testimonial: { customer_name, text, rating, city, photo_url }
 */
export async function renderTestimonialPoster(out, dateStr, profile, testimonial, { file, theme }, watermark = false) {
  const W = 1080, H = 1350;
  const day = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86400000);
  const [accent, deep] = PALETTES[day % PALETTES.length];
  const occasion = theme.kind === "occasion";
  const t = await titleFor(theme, profile.lang || "hi");
  const ident = identityFor(profile);
  const cta = ident.phone;
  const custom1 = String(profile.layout?.custom || "").slice(0, 60);
  const line = (repeats(custom1, ident.big, profile.name, profile.tagline) ? "" : custom1) || ident.line;
  const en = (profile.lang || "hi") === "en";
  const rating = Math.min(5, Math.max(1, Math.round(Number(testimonial.rating ?? 5)) || 5));
  const text = noEmoji(testimonial.text).slice(0, 300);
  const isDev = /[ऀ-ॿ]/.test(text);
  const quoteLines = wrapLines(text, isDev ? 24 : 28, 7);
  const qSize = quoteLines.length > 5 ? 36 : quoteLines.length > 3 ? 40 : 46;
  const qLead = Math.round(qSize * 1.5);
  const who = [noEmoji(testimonial.customer_name), noEmoji(testimonial.city)].filter(Boolean).join(", ");
  const whoFam = /[ऀ-ॿ]/.test(who) ? DEV : LAT;
  const heading = en ? "What our customers say" : "हमारे ग्राहक क्या कहते हैं";

  const art = await sharp(file).resize(W, H, { fit: "cover", position: "attention" }).blur(18).modulate({ brightness: 0.55, saturation: 0.9 }).toBuffer();
  const photo = await fetchImage(testimonial.photo_url);
  const logo = await fetchImage(profile.logo_url);
  const avatar = await fetchImage(profile.photo_url);
  const composites = [];

  // card geometry: text block + stars + attribution (+ photo overlapping the top edge)
  const photoSize = photo ? 160 : 0;
  const cardX = 80, cardW = W - 160;
  const textTop = 120 + (photo ? photoSize / 2 + 20 : 0);
  const starsY = textTop + quoteLines.length * qLead + 30;
  const whoY = starsY + 70;
  const cardH = whoY + 50;
  // centre the card (plus the photo overhang) between the header and the identity footer
  const overhang = photo ? photoSize / 2 + 8 : 0;
  const regionTop = occasion ? 220 : 150, regionBot = H - 260;
  const cardTopEff = Math.round(Math.max(regionTop + overhang, regionTop + overhang + (regionBot - regionTop - overhang - cardH) / 2));
  const starPath = "M0 -22 L6.5 -7 L22 -6 L10 5 L13.5 21 L0 12 L-13.5 21 L-10 5 L-22 -6 L-6.5 -7 Z";
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${deep}" stop-opacity="0.85"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#tint)"/>
  ${occasion
    ? `<text x="${W / 2}" y="130" text-anchor="middle" font-family="${t.font}" font-size="${t.big.length > 16 ? 56 : 70}" font-weight="700" fill="#ffffff">${esc(t.big)}</text><text x="${W / 2}" y="180" text-anchor="middle" font-family="${LAT}" font-size="24" letter-spacing="2" fill="#ffe8a3">${esc(t.small)}</text>`
    : `<text x="${W / 2}" y="120" text-anchor="middle" font-family="${en ? LAT : DEV}" font-size="40" font-weight="700" letter-spacing="1" fill="#ffe8a3">${esc(heading)}</text>`}
  <rect x="${cardX}" y="${cardTopEff}" width="${cardW}" height="${cardH}" rx="40" fill="#ffffff" fill-opacity="0.97"/>
  <text x="${cardX + 44}" y="${cardTopEff + (photo ? photoSize / 2 + 60 : 130)}" font-family="Georgia, Times New Roman, serif" font-size="170" font-weight="700" fill="${accent}" fill-opacity="0.35">“</text>
  ${quoteLines.map((l, i) => `<text x="${W / 2}" y="${cardTopEff + textTop + i * qLead}" text-anchor="middle" font-family="${/[ऀ-ॿ]/.test(l) ? DEV : LAT}" font-size="${qSize}" font-weight="600" fill="#0f172a">${esc(l)}</text>`).join("")}
  ${[0, 1, 2, 3, 4].map((i) => `<g transform="translate(${W / 2 - 120 + i * 60}, ${cardTopEff + starsY})"><path d="${starPath}" fill="${i < rating ? "#f59e0b" : "#e5e7eb"}"/></g>`).join("")}
  ${who ? `<text x="${W / 2}" y="${cardTopEff + whoY}" text-anchor="middle" font-family="${whoFam}" font-size="32" font-weight="700" fill="${deep}">— ${esc(who)}</text>` : ""}
  <rect y="${H - 230}" width="${W}" height="230" fill="#06111c" fill-opacity="0.6"/>
  <text x="${avatar ? 300 : 70}" y="${H - 150}" font-family="${DEV}" font-size="${fitPx(ident.big, W - (avatar ? 300 : 70) - 70, 50, 28)}" font-weight="700" fill="#ffffff">${esc(ident.big)}</text>
  ${line ? `<text x="${avatar ? 300 : 70}" y="${H - 100}" font-family="${DEV}" font-size="${fitPx(line, W - (avatar ? 300 : 70) - 70, 30, 20)}" fill="#e6f4f2">${esc(line)}</text>` : ""}
  ${cta ? `<g transform="translate(${avatar ? 300 : 70}, ${H - 78}) scale(1.4)"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#7fe3d6"/></g><text x="${(avatar ? 300 : 70) + 44}" y="${H - 48}" font-family="${LAT}" font-size="32" font-weight="700" fill="#7fe3d6">${esc(cta)}</text>` : ""}
  ${watermark ? `<text x="${W / 2}" y="${H - 12}" text-anchor="middle" font-family="${DEV}" font-size="20" fill="#ffffff" fill-opacity="0.75">Shubhora · ${WM_HOST}/poster</text>` : ""}
  </svg>`;
  composites.push({ input: Buffer.from(svg), top: 0, left: 0 });
  if (photo) {
    const size = photoSize;
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    const round = await sharp(photo).resize(size, size, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const ring = Buffer.from(`<svg width="${size + 16}" height="${size + 16}"><circle cx="${(size + 16) / 2}" cy="${(size + 16) / 2}" r="${(size + 16) / 2}" fill="#ffffff"/></svg>`);
    composites.push({ input: ring, top: cardTopEff - size / 2 - 8, left: Math.round(W / 2 - size / 2) - 8 });
    composites.push({ input: round, top: cardTopEff - size / 2, left: Math.round(W / 2 - size / 2) });
  }
  if (avatar) {
    const size = 170;
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    const round = await sharp(avatar).resize(size, size, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const ring = Buffer.from(`<svg width="${size + 12}" height="${size + 12}"><circle cx="${(size + 12) / 2}" cy="${(size + 12) / 2}" r="${(size + 12) / 2}" fill="#ffffff"/></svg>`);
    composites.push({ input: ring, top: H - 205 - 6, left: 70 - 6 });
    composites.push({ input: round, top: H - 205, left: 70 });
  }
  if (logo) {
    const lg = await sharp(logo).resize({ width: 200, height: 90, fit: "inside" }).png().toBuffer();
    const m = await sharp(lg).metadata();
    const pad = Buffer.from(`<svg width="${m.width + 28}" height="${m.height + 20}"><rect width="100%" height="100%" rx="14" fill="#ffffff" fill-opacity="0.92"/></svg>`);
    composites.push({ input: pad, top: H - 115 - (m.height + 20) / 2, left: W - 70 - (m.width + 28) });
    composites.push({ input: lg, top: H - 115 - m.height / 2, left: W - 70 - 14 - m.width });
  }
  await sharp(art).composite(composites).jpeg({ quality: 86 }).toFile(out);
  return out;
}
/** Like wrapText but with a configurable line cap (and "…" on the last line when cut). */
function wrapLines(text, max, maxLines) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const cut = lines.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/[,.।]?$/, "") + "…"; return cut; }
  return lines;
}
/** wrapLines by visible width: Devanagari vowel signs and dots (\p{M}) are not counted as letters. */
function wrapVis(text, max, maxLines) {
  const vis = (x) => x.replace(/\p{M}/gu, "").length;
  const words = String(text ?? "").split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { const next = (cur + " " + w).trim(); if (vis(next) > max && cur) { lines.push(cur); cur = w; } else cur = next; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const cut = lines.slice(0, maxLines); cut[maxLines - 1] = cut[maxLines - 1].replace(/[,.।]?$/, "") + "…"; return cut; }
  return lines;
}
function wrapText(text, max) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur); return lines.slice(0, 3);
}

/* ---------------- CLI: daily base art ---------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--date");
  const date = i >= 0 ? args[i + 1] : istDate();
  ensureBaseArt(date, { force: args.includes("--force") })
    .then(({ theme }) => console.log(`[poster] ${date}: ${theme.kind}/${theme.slug}`))
    .catch((e) => { console.error("[poster] failed:", e?.message ?? e); process.exit(1); });
}
