// Shubhora's own website pictures, made ONCE with the AI image model (owner, 20 Nov 2026: "AI se banner banwa lo, real banner … ye image
// ek baar banni hai, baad me Shubhora ke liye wahi use hogi"). Runs ON THE SERVER (the Gemini key lives in its .env.local);
// scripts/shubhora-ai-art.sh starts it from the Mac and brings the pictures back into the repo (public/art/shubhora/ai/).
//   node scripts/shubhora-ai-art.mjs            every picture that is not there yet
//   node scripts/shubhora-ai-art.mjs hero-1     that one again (a picture that came out wrong)
// About 13 pictures, one call each. Nothing here is called by the app: no customer's website ever spends on this.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const val = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const KEY = val("GEMINI_API_KEY");
const MODEL = val("IMG_MODEL") || "gemini-3.1-flash-lite-image";
if (!KEY) { console.error("GEMINI_API_KEY is not in .env.local"); process.exit(1); }
const OUT = path.join(process.cwd(), "public", "art", "shubhora", "ai");
fs.mkdirSync(OUT, { recursive: true });

const STYLE = "Photorealistic commercial photograph, shot on a full-frame camera, natural warm light, shallow depth of field, rich but true colours, clean and premium, modern India. People are ordinary Indian adults (not celebrities, not any real or famous person), natural expressions, neat everyday clothes. Any phone or laptop screen shows only soft abstract coloured shapes and blocks — never readable words.";
const NO_TEXT = "ABSOLUTELY NO TEXT, letters, numbers, signboards with writing, logos, brand names or watermarks anywhere in the image.";
const BANNER = "Wide website banner. The subject is on the RIGHT half; the LEFT half is calm, darker and uncluttered (soft out-of-focus background) so a white headline can sit there.";

const JOBS = [
  // ---- the three banners (16:9) ----
  ["hero-1", "16:9", `${BANNER} A confident Indian shop owner in his thirties stands at the counter of a bright, tidy modern retail shop, smiling, holding up a smartphone towards the camera; shelves softly blurred behind him; evening warm light with a deep blue-indigo tone in the shadows.`],
  ["hero-2", "16:9", `${BANNER} On a clean wooden desk inside a boutique, an open laptop and a smartphone stand side by side, both showing the same colourful website layout made of abstract blocks; a woman entrepreneur's hands rest near the laptop; soft bokeh of the boutique behind; deep navy and teal tones.`],
  ["hero-3", "16:9", `${BANNER} Night. A closed, dimly lit shop counter; a smartphone on a small stand glows brightly with a chat screen of green and white message bubbles (no readable words); a warm lamp far behind; the feeling that the business keeps answering customers while the owner sleeps; deep teal and indigo night tones.`],
  // ---- "What you get" (4:3) ----
  ["get-link", "4:3", "Close-up of a customer's hand holding a smartphone, scanning a small acrylic QR-code stand placed on a neat shop counter; shop softly blurred behind."],
  ["get-contact", "4:3", "A young Indian woman customer on a street outside a shop, smiling at her smartphone and tapping it with her thumb, as if calling or messaging the shop; bright daylight."],
  ["get-products", "4:3", "A smartphone held in front of a neat display of products (sarees, sweets boxes and gift items arranged on shelves), the phone screen showing a grid of small product pictures as abstract colourful tiles."],
  ["get-leads", "4:3", "An Indian shop owner at his counter, relaxed and pleased, looking at a tablet that shows a tidy list of coloured rows and round avatars (abstract, no words); a cup of chai beside him."],
  ["get-website", "4:3", "A laptop on a desk in a small office showing a beautiful website made of abstract image blocks and coloured sections, a smartphone beside it showing the same design; a plant and a notebook nearby; daylight."],
  ["get-ai", "4:3", "A smartphone lying on a bedside table at night, screen glowing with a chat of green and white message bubbles (no readable words); in the soft background a person sleeps peacefully; calm blue night light."],
  ["get-poster", "4:3", "Early morning. A hand holds a smartphone showing a bright festive greeting-card design with diyas and marigold flowers and abstract shapes (no words); a cup of chai and soft sunrise light on a balcony behind."],
  ["get-ads", "4:3", "A small product photo-shoot set-up on a table in a shop: a handbag and a bottle of perfume on a plain backdrop with a small ring light, a smartphone on a tripod photographing them."],
  // ---- the partner business page (4:3) ----
  ["biz-demo", "4:3", "An Indian man in a neat shirt (a sales partner) shows his smartphone to a friendly shopkeeper across the counter of a small grocery shop; both are smiling and looking at the phone; warm daylight."],
  ["biz-team", "4:3", "A small group of four Indian men and women of different ages sitting around a table in a simple bright office, talking happily with phones and a laptop on the table; a team of independent partners; natural light."],
];

const only = process.argv.slice(2);
let sharp = null;
try { sharp = createRequire(import.meta.url)("sharp"); } catch { /* the PNG is kept as it comes */ }

for (const [name, ratio, prompt] of JOBS) {
  if (only.length && !only.includes(name)) continue;
  const file = path.join(OUT, `${name}.jpg`);
  if (!only.length && fs.existsSync(file)) { console.log(`- ${name}: already there`); continue; }
  let done = false;
  for (let attempt = 1; attempt <= 2 && !done; attempt++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(120_000),
        headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt} ${STYLE} ${NO_TEXT}` }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }),
      });
      const d = await r.json().catch(() => null);
      const b64 = (d?.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data)?.inlineData?.data;
      if (!b64) { console.log(`! ${name}: no picture (try ${attempt}) ${String(d?.error?.message ?? "").slice(0, 120)}`); continue; }
      const buf = Buffer.from(b64, "base64");
      if (sharp) await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(file);
      else fs.writeFileSync(file, buf);
      console.log(`✓ ${name}`); done = true;
    } catch (e) { console.log(`! ${name}: ${e instanceof Error ? e.message : e} (try ${attempt})`); }
  }
}
console.log("finished →", OUT);
