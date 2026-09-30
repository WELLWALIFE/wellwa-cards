// Profession banners — one designed cover per business category, the way a brand's Facebook cover is designed:
// a real scene of that trade (Indian setting), a clean light area for the name, a soft colour wave in the
// category's accent, no text. Generated once with Gemini image, checked by a judge, written to
// public/art/banners/<key>.jpg (1600×600) and committed with the repo, so deploy carries them — nothing is
// generated at request time.
//
//     cd "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards" && node scripts/gen-banners.mjs            # missing ones
//     node scripts/gen-banners.mjs --only doctor,salon --force                                       # redo some
//
// Needs GEMINI_API_KEY (from .env.local). ~78 categories × 1 image ≈ a few rupees each; re-runs skip existing files.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* env from the process */ }
const KEY = env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing (.env.local)"); process.exit(1); }
const G = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_MODEL = "gemini-2.5-flash-image", JUDGE = "gemini-3.5-flash-lite";
const OUT = path.join(APP, "public", "art", "banners");
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = (args[args.indexOf("--only") + 1] || "").split(",").map((s) => s.trim()).filter((s) => s && !s.startsWith("--"));

// The categories, read from the TypeScript source so this list never drifts from the picker.
const src = fs.readFileSync(path.join(APP, "src", "lib", "poster-categories.ts"), "utf8");
const cats = [...src.matchAll(/^\s*c\("([a-z-]+)",\s*"[^"]*",\s*"([^"]*)",\s*"([^"]*)",\s*"[^"]*",\s*"[^"]*",\s*"(#[0-9a-fA-F]{6})"/gm)].map((m) => ({ key: m[1], en: m[2], group: m[3], accent: m[4] }));

// What the picture shows for each trade — the scene a customer would recognise at a glance.
const SCENE = {
  kirana: "a bright, well-stocked neighbourhood grocery store with neat shelves of packaged goods and grains",
  garments: "an elegant clothing showroom with neatly hung ethnic and western wear, warm spotlights",
  jewellery: "gold and diamond jewellery displayed on velvet under warm boutique lighting",
  mobile: "a modern mobile phone and electronics shop with display counters and lit shelves",
  furniture: "a tasteful furniture showroom with a sofa set, wooden dining table and decor",
  hardware: "a tidy hardware and paint store with tools, paint tins and sanitary fittings",
  medical: "a clean pharmacy counter with neatly arranged medicine shelves",
  sweets: "a traditional Indian sweets and bakery counter with trays of mithai and cakes",
  "grocery-online": "an e-commerce packing desk with branded parcels, a laptop and a phone",
  gift: "a colourful gift and stationery shop with wrapped gifts, cards and pens",
  optical: "a modern optical store with rows of stylish spectacle frames",
  footwear: "a footwear showroom with shoes and sandals on lit display shelves",
  restaurant: "a warm family restaurant table with Indian thalis and curries being served",
  cafe: "a cosy cafe corner with latte art, pastries and warm wooden tones",
  tiffin: "a home kitchen with freshly packed steel tiffin boxes of dal, sabzi and roti",
  catering: "a wedding buffet spread with chafing dishes and garnished Indian dishes",
  hotel: "a hotel lobby and a neatly made room with soft daylight",
  doctor: "a calm modern clinic consultation room with a stethoscope and a smiling Indian doctor in a white coat",
  hospital: "a bright hospital reception with a nurse station and modern signage",
  dentist: "a modern dental chair in a clean bright clinic",
  ayurveda: "ayurvedic herbs, oils and a mortar on a wooden table with green leaves",
  pharma: "a pharmaceutical professional with medicine samples and a tablet",
  gym: "a modern gym with dumbbells, a treadmill and a trainer, dramatic lighting",
  salon: "a stylish beauty salon interior with a styling chair, mirror lights and products",
  spa: "a serene spa setting with towels, candles, stones and flowers",
  water: "a sleek kitchen counter with a modern water ionizer and a glass of clear water",
  wellness: "wellness products, fresh fruit and a yoga mat in soft morning light",
  ca: "a tidy accountant's desk with ledgers, a calculator, tax forms and a laptop",
  lawyer: "a lawyer's desk with law books, a gavel and a fountain pen in a wood-panelled office",
  insurance: "an insurance advisor explaining a policy document to a family",
  finance: "a financial advisor's desk with charts on a laptop, coins and a growth graph",
  realestate: "a modern apartment building exterior with keys and a property brochure",
  builder: "a construction site with a crane, blueprints and a hard hat",
  interior: "a beautifully designed living room interior with a mood board and material samples",
  travel: "a scenic travel collage feel: a suitcase, passport, airplane window and mountains",
  transport: "a fleet of trucks at a logistics yard at golden hour",
  auto: "a car service garage with a lifted car and a mechanic",
  electrician: "an electrician and plumber's tools, an AC unit and a switchboard, neatly arranged",
  photography: "a photography studio with a camera on a tripod, softbox lights and a backdrop",
  event: "a decorated wedding stage with flowers, drapes and lights, a DJ console",
  printing: "a printing press with colourful flex banners, visiting cards and a large-format printer",
  it: "a modern software office with developers at laptops and code on screens",
  security: "a uniformed security guard at a corporate gate and a housekeeping team",
  cleaning: "a professional cleaning and pest-control team in uniform with equipment",
  tailor: "a boutique tailoring studio with fabrics, a sewing machine and a measuring tape",
  mehndi: "intricate mehndi on hands and a makeup artist's kit with brushes",
  astro: "a traditional astrology setting with a birth chart, brass diya and marigolds",
  courier: "a courier delivery counter with parcels, a scanner and a delivery bike",
  school: "a bright school classroom with children at desks and a teacher",
  coaching: "a coaching class with a whiteboard, students and study material",
  college: "a college campus building with students walking",
  computer: "a computer training institute with rows of desktops",
  teacher: "a friendly teacher at a whiteboard with books",
  dance: "a dance studio with mirrors and dancers in motion",
  student: "a study desk with books, a laptop and notes, sunny window",
  mlm: "a confident network-marketing team celebrating success in a bright office",
  distributor: "a distributor's warehouse with stacked branded cartons and a delivery van",
  sales: "a sales professional shaking hands with a client in a bright office",
  agent: "a helpful agent at a desk with documents and a phone, welcoming a customer",
  agri: "lush green farm fields with a tractor and fresh produce",
  dairy: "a clean dairy with milk cans, cows and fresh milk products",
  manufacturer: "a modern factory floor with machines and workers in safety gear",
  wholesale: "a wholesale market godown with bulk goods and cartons",
  textile: "rolls of colourful fabric in a textile shop",
  political: "a public gathering with the Indian tricolour and a leader greeting people",
  mla: "a public meeting with the Indian tricolour, people welcoming a leader",
  ngo: "volunteers distributing books and food to children, warm and hopeful",
  samaj: "a community gathering with people of all ages, festive decoration",
  temple: "a beautiful Hindu temple with diyas, marigolds and morning light",
  club: "a club event with members, banners and a trophy",
  union: "a workers' union gathering with flags and a stage",
  housing: "a residential society with gardens, towers and a clubhouse",
  personal: "an elegant abstract scene: soft light, plants and a clean desk",
  employee: "a professional at a modern office desk, laptop and city view",
  govt: "a government office building with the national emblem colours, formal and clean",
  army: "a proud Indian soldier silhouette at sunrise with the tricolour",
  influencer: "a content creator's setup with a ring light, phone on a tripod and colourful backdrop",
  other: "a clean modern small-business scene: a shopkeeper welcoming customers at a bright counter",
};

const prompt = (c) => `Design a premium marketing BANNER for a ${c.en} business in India, in the style of a polished corporate Facebook cover photo.
Composition, wide 16:6 landscape: ONE photorealistic scene filling the ENTIRE frame edge to edge — ${SCENE[c.key] || SCENE.other} — with real Indian people where people appear, the main subject placed slightly right of centre, the left third softer and less busy (shallow depth of field, gentle light) but still part of the same scene: NO empty white area, NO blank panel, NO split layout. Along the very BOTTOM a thin, smooth flowing gradient wave ribbon in ${c.accent} blending into a lighter tint of it.
Modern, high-end, well lit, sharp focus, magazine-quality colour grading. Absolutely NO text, letters, numbers, logos, watermarks or signatures anywhere.`;

async function image(text) {
  const r = await fetch(`${G}/${IMAGE_MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } } }), signal: AbortSignal.timeout(120_000) });
  const d = await r.json().catch(() => null);
  if (d?.error) throw new Error(`${d.error.code} ${String(d.error.message).slice(0, 120)}`);
  const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
  return part ? Buffer.from(part.inlineData.data, "base64") : null;
}
async function ok(buf, c) {
  const small = await sharp(buf).resize(640).jpeg({ quality: 80 }).toBuffer();
  const r = await fetch(`${G}/${JUDGE}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }, { text: `This is meant to be a professional banner for a "${c.en}" business with NO text. Answer JSON {"ok":true|false,"why":"<6 words>"}: ok is false if there is any readable text, letters or logos, if the scene does not match the trade, if faces or hands are deformed, or if it looks cheap or cluttered.` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 80 } }), signal: AbortSignal.timeout(40_000) });
  const j = await r.json().catch(() => ({}));
  try { const v = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"); return { ok: v.ok !== false, why: v.why || "" }; } catch { return { ok: true, why: "" }; }
}

let done = 0, failed = [];
for (const c of cats) {
  if (ONLY.length && !ONLY.includes(c.key)) continue;
  const file = path.join(OUT, `${c.key}.jpg`);
  if (fs.existsSync(file) && !FORCE) continue;
  let saved = false;
  for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
    try {
      const buf = await image(prompt(c));
      if (!buf) throw new Error("no image");
      const j = await ok(buf, c);
      if (!j.ok && attempt < 3) { console.log(`  ${c.key}: redo (${j.why})`); continue; }
      // 1600×600 centre crop from the 16:9 render, gentle sharpen, JPEG ~150 KB
      await sharp(buf).resize(1600, 600, { fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
      console.log(`✓ ${c.key}${j.ok ? "" : " (kept despite: " + j.why + ")"}`);
      saved = true; done++;
    } catch (e) {
      console.log(`  ${c.key}: ${e.message}`);
      if (/429|quota|depleted/i.test(e.message)) await new Promise((r) => setTimeout(r, 15_000));
    }
  }
  if (!saved) failed.push(c.key);
}
console.log(`\n${done} banners written to public/art/banners${failed.length ? ` — failed: ${failed.join(", ")} (run again)` : ""}`);
