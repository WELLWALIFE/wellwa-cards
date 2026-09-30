// Daily occasion banner for WhatsApp follow-ups.
//
//   node bridge/banner-daily.mjs [--date YYYY-MM-DD] [--force] [--dry]
//
// Looks up today's (IST) occasion in bridge/occasions.json, asks Gemini for
// artwork ONLY (no text — image models misspell Hindi), then composes the
// banner with sharp: occasion title in Devanagari + English, Wellwa logo,
// brand strip. Output: public/wellwa/followups/daily/<date>.jpg and an
// index.json the bridge reads. Each tenant's copy (name + number strip) is
// composed lazily by the bridge at send time, so one AI image serves everyone.
//
// Runs once a day from pm2 (cron-restart 23:30 UTC = 05:00 IST). No occasion
// → nothing generated, the evergreen set is used. Any failure → exit non-zero
// and the bridge simply falls back; a follow-up never depends on this.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, "..");
const OUT_DIR = path.join(APP, "public", "wellwa", "followups", "daily");
const LOGO = path.join(APP, "public", "wellwa", "images", "wellwa-logo.png");
const MODEL = process.env.BANNER_MODEL || "gemini-3.1-flash-image";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const KEY = env.GEMINI_API_KEY || "";

const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FORCE = args.includes("--force");
const DRY = args.includes("--dry");

/** Today in India as YYYY-MM-DD (server clock is UTC). */
export function istDate(d = new Date()) {
  const t = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

export function loadOccasions() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "occasions.json"), "utf8"));
}

/** The occasion for a date, moving (festival) entries winning over fixed ones. */
export function occasionFor(dateStr, cal = loadOccasions()) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const moving = (cal.moving ?? []).find((o) => o.y === y && o.m === m && o.d === d);
  if (moving) return moving;
  return (cal.fixed ?? []).find((o) => o.m === m && o.d === d) ?? null;
}

export function readIndex() {
  try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, "index.json"), "utf8")); } catch { return {}; }
}
function writeIndex(idx) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(idx, null, 2));
}

async function geminiArt(theme, title) {
  if (!KEY) throw new Error("GEMINI_API_KEY missing");
  const prompt =
    `Premium festive greeting-card artwork for "${title}" (India). ${theme}. ` +
    `Wide 16:9 composition with the main subject on the RIGHT half and a calm, darker, less busy area on the LEFT half for text overlay. ` +
    `Rich colours, soft light, high quality illustration. ABSOLUTELY NO text, letters, numbers, logos, watermarks or captions anywhere in the image.`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const bodies = [
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } } },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } },
  ];
  let lastErr = "";
  for (const body of bodies) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { lastErr = `${r.status} ${JSON.stringify(j).slice(0, 300)}`; continue; }
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (img) return Buffer.from(img.inlineData.data, "base64");
    lastErr = `no image in response: ${JSON.stringify(j).slice(0, 300)}`;
  }
  throw new Error(`Gemini image failed: ${lastErr}`);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Base banner: art + title band + logo. 1280×720. */
export async function composeBanner(art, occ) {
  const W = 1280, H = 720;
  const bg = await sharp(art).resize(W, H, { fit: "cover", position: "entropy" }).toBuffer();
  const logo = await sharp(LOGO).resize({ height: 44 }).png().toBuffer();
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06111c" stop-opacity="0.82"/><stop offset="0.55" stop-color="#06111c" stop-opacity="0.35"/><stop offset="1" stop-color="#06111c" stop-opacity="0"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06111c" stop-opacity="0"/><stop offset="1" stop-color="#06111c" stop-opacity="0.85"/></linearGradient>
  </defs>
  <rect width="${W * 0.62}" height="${H}" fill="url(#l)"/>
  <rect y="${H - 200}" width="${W}" height="200" fill="url(#b)"/>
  <rect x="56" y="48" width="180" height="64" rx="16" fill="#ffffff" fill-opacity="0.92"/>
  <text x="60" y="${H - 250}" font-family="Noto Sans Devanagari, Droid Sans Devanagari, Mangal, Kohinoor Devanagari, Devanagari Sangam MN, sans-serif" font-size="62" font-weight="700" fill="#ffffff">${esc(occ.hi)}</text>
  <text x="62" y="${H - 190}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="1" fill="#7fe3d6">${esc(occ.title.toUpperCase())}</text>
  <text x="62" y="${H - 64}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#e6f4f2">Wellwa Life · Smart alkaline water ionizers · wellwalife.com</text>
  </svg>`;
  return sharp(bg).composite([{ input: Buffer.from(svg), top: 0, left: 0 }, { input: logo, top: 58, left: 74 }]).jpeg({ quality: 84 }).toBuffer();
}

/** Per-distributor copy: base banner + a navy strip with name and number. */
export async function personalize(baseFile, outFile, { name, phone, company }) {
  const W = 1280, S = 84;
  const line = [name, company].filter(Boolean).join(" · ");
  const svg = `<svg width="${W}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${S}" fill="#0b1b2b"/>
  <text x="56" y="52" font-family="Helvetica, Arial, sans-serif" font-size="27" font-weight="700" fill="#ffffff">${esc(line)}</text>
  <text x="${W - 56}" y="52" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="27" font-weight="700" fill="#7fe3d6">${esc(phone || "")}</text>
  </svg>`;
  await sharp(baseFile)
    .extend({ bottom: S, background: "#0b1b2b" })
    .composite([{ input: Buffer.from(svg), top: 720, left: 0 }])
    .jpeg({ quality: 84 })
    .toFile(outFile);
}

async function main() {
  const date = argVal("--date") || istDate();
  const occ = occasionFor(date);
  const idx = readIndex();
  if (!occ) {
    idx[date] = { date, slug: null, note: "no occasion — evergreen set", checkedAt: new Date().toISOString() };
    if (!DRY) writeIndex(idx);
    console.log(`[banner] ${date}: no occasion`);
    return;
  }
  const file = path.join(OUT_DIR, `${date}.jpg`);
  if (fs.existsSync(file) && !FORCE) { console.log(`[banner] ${date}: already generated (${occ.slug})`); return; }
  console.log(`[banner] ${date}: ${occ.slug} — generating with ${MODEL}…`);
  const art = await geminiArt(occ.theme, occ.title);
  const out = await composeBanner(art, occ);
  if (DRY) { fs.writeFileSync(`/tmp/banner-${date}.jpg`, out); console.log("dry run → /tmp"); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, out);
  // drop stale per-tenant copies for this date so they get rebuilt from the new base
  for (const f of fs.readdirSync(OUT_DIR)) if (f.startsWith(`${date}-`)) fs.unlinkSync(path.join(OUT_DIR, f));
  idx[date] = { date, slug: occ.slug, title: occ.title, hi: occ.hi, greet: occ.greet, url: `/wellwa/followups/daily/${date}.jpg`, model: MODEL, generatedAt: new Date().toISOString(), verify: !!occ.verify };
  writeIndex(idx);
  console.log(`[banner] ${date}: wrote ${file} (${Math.round(out.length / 1024)} KB)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error("[banner] failed:", e?.message ?? e); process.exit(1); });
}
