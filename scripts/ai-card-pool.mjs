// AI-made photo pool for a trade's V-Card / website gallery (owner, 20 Oct 2026: stock photos of an Indian kirana are old street
// stalls however hard they are judged — "aisi image mat lagao jo acchi khasi site ko bhi bura bana de"). Eight bright, modern,
// Indian scenes of the trade are drawn, each checked by the judge (real-looking, no text, Indian people, modern), and written as the
// trade's card pool (`<cat>-v4.json`, the file ensureCardMedia reads), so every build of that trade uses them. One-time per trade.
//   node scripts/ai-card-pool.mjs kirana "Kirana / general store"
import fs from "node:fs"; import path from "node:path";
import sharp from "sharp";
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* none */ }
const KEY = env.GEMINI_API_KEY; if (!KEY) { console.log("GEMINI_API_KEY missing"); process.exit(1); }
const IMG_MODEL = env.IMG_MODEL || "gemini-3.1-flash-lite-image", JUDGE = "gemini-3.5-flash";
const G = "https://generativelanguage.googleapis.com/v1beta/models";
const [category, label] = [process.argv[2], process.argv[3] || process.argv[2]];
if (!category) { console.log("usage: node scripts/ai-card-pool.mjs <category> \"<label>\""); process.exit(1); }
const cat = category.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
const CARD_DIR = path.join(APP, "public", "poster", "base", "stock", "card");
fs.mkdirSync(CARD_DIR, { recursive: true });

const LOOK = "Contemporary commercial photography of the kind a premium brand puts on its website in 2026: bright, airy natural daylight, crisp sharp detail, a clean modern space that is tidy and well organised, natural true-to-life colour, shallow depth of field, shot on a professional camera. In INDIA: Indian people (if any) in current everyday clothes, Indian products and setting, a prosperous modern premises — never a roadside stall, never cluttered, dusty, dark or old-looking.";
const RULES = "PICTURE RULES: one clear main subject fully inside the frame; correct anatomy (two hands, five fingers each, natural faces); objects physically correct; one consistent perspective; soft natural shadows; a real photograph, never an illustration, render or HDR glow. ABSOLUTELY NO TEXT, letters, numbers, signboards with words, logos or watermarks anywhere.";
const SCENES = [
  (t) => `Wide interior of a modern, spotless ${t} in India: neat well-stocked shelves, wide clean aisle, bright even lighting, no people.`,
  (t) => `A friendly Indian shop owner behind the clean counter of a modern ${t}, handing a packed order to a smiling Indian customer, bright daylight from the shopfront.`,
  (t) => `Close-up of beautifully arranged goods on a clean, well-lit shelf inside a modern ${t} in India, plain packaging without readable text, shallow depth of field.`,
  (t) => `Exterior of a modern, well-kept ${t} in an Indian town at daytime: clean glass front, tidy entrance, a plain blank signboard without words, a customer walking in.`,
  (t) => `An Indian staff member in a neat apron arranging products on a tidy shelf inside a bright modern ${t}.`,
  (t) => `Modern billing counter of a ${t} in India: a clean counter, a card machine and a neatly packed paper bag, warm bright light, no readable text.`,
  (t) => `Fresh, appealing products of a ${t} displayed on a clean modern counter in India, overhead soft daylight, plain unbranded packaging.`,
  (t) => `A young Indian family shopping happily inside a bright, modern ${t}, wide aisle, tidy shelves, natural light.`,
];

async function draw(prompt) {
  const r = await fetch(`${G}/${IMG_MODEL}:generateContent`, { method: "POST", signal: AbortSignal.timeout(90_000), headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt} ${LOOK} ${RULES}` }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } } }) });
  const d = await r.json().catch(() => null);
  const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x) => x.inlineData?.data);
  return part ? Buffer.from(part.inlineData.data, "base64") : null;
}
async function judge(img, scene) {
  const small = await sharp(img).resize({ width: 640 }).jpeg({ quality: 80 }).toBuffer();
  const r = await fetch(`${G}/${JUDGE}:generateContent`, { method: "POST", signal: AbortSignal.timeout(45_000), headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }, { text: `This picture is meant for the website gallery of a "${label}" business in India (brief: ${scene}). Judge it strictly. Return ONLY JSON {"ok":true/false,"score":0-10,"problems":""}: ok only when it looks like a real professional photograph (not a render / illustration / plastic AI look), shows a modern, clean, bright premises of exactly this trade, any people look Indian with correct anatomy, and there is NO readable text, letters or logos anywhere (a blank sign is fine). Score 8+ is ok.` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
  const d = await r.json().catch(() => null);
  try { const t = String(d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""); return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch { return null; }
}

const WANT = 8;
// Topping up: photos an earlier run of this script already kept stay; only the missing ones are drawn.
let photos = [], n = 0;
try { const old = JSON.parse(fs.readFileSync(path.join(CARD_DIR, `${cat}-v4.json`), "utf8")); if (old.ai) { photos = (old.photos ?? []).filter((p) => fs.existsSync(path.join(CARD_DIR, path.basename(p.url)))); n = photos.length; } } catch { /* fresh */ }
const MORE = [
  (t) => `Interior of a bright modern ${t} in India seen from the entrance: clean floor, tidy shelves on both sides, a refrigerator at the back, no people.`,
  (t) => `Close-up of an Indian shopkeeper's hands weighing loose grains on a clean digital scale at a tidy counter of a modern ${t}, soft daylight.`,
  (t) => `A tidy section of a modern ${t} in India with neatly stacked packets and jars, bright even light, shallow depth of field, no readable text.`,
  (t) => `An Indian woman customer choosing items from a clean, well-lit shelf in a modern ${t}, natural light, tidy surroundings.`,
];
for (const scene of [...SCENES, ...MORE]) {
  if (photos.length >= WANT) break;
  const brief = scene(label.toLowerCase());
  let kept = null;
  for (let tries = 0; tries < 3 && !kept; tries++) {
    const img = await draw(brief);
    if (!img) continue;
    const v = await judge(img, brief);
    if (v && v.ok === false) { console.log(`  x ${brief.slice(0, 50)}… ${v.score}/10 ${String(v.problems).slice(0, 90)}`); continue; }
    kept = img;
  }
  if (!kept) continue;
  n += 1;
  const file = path.join(CARD_DIR, `${cat}-v4-ai${n}.jpg`);
  await sharp(kept).resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toFile(file);
  photos.push({ url: `/api/stock/${path.basename(file)}`, credit: "Made for Shubhora", id: `ai${n}` });
  console.log(`  ✓ ${n} ${brief.slice(0, 60)}…`);
}
if (photos.length < 4) { console.log(`only ${photos.length} passed — pool not written`); process.exit(2); }
// Keep an old clip if the stock pool had one (the home page's short video).
let clip = null, clipV = 0;
try { const old = JSON.parse(fs.readFileSync(path.join(CARD_DIR, `${cat}-v4.json`), "utf8")); clip = old.clip ?? null; clipV = old.clipV ?? 0; } catch { try { const old = JSON.parse(fs.readFileSync(path.join(CARD_DIR, `${cat}-v3.json`), "utf8")); clip = old.clip ?? null; clipV = old.clipV ?? 0; } catch { /* none */ } }
fs.writeFileSync(path.join(CARD_DIR, `${cat}-v4.json`), JSON.stringify({ category: cat, label, photos, clip, clipV, ai: true, at: new Date().toISOString() }));
// Contact sheet, to look at.
const tiles = [];
for (const p of photos) tiles.push(await sharp(path.join(CARD_DIR, path.basename(p.url))).resize(400, 225, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer());
const cols = 4, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * 400, height: rows * 225, channels: 3, background: "#fff" } }).composite(tiles.map((input, i) => ({ input, left: (i % cols) * 400, top: Math.floor(i / cols) * 225 }))).jpeg({ quality: 82 }).toFile(`/tmp/pool-${cat}.jpg`);
console.log(`${cat}: ${photos.length} AI photos written; sheet /tmp/pool-${cat}.jpg`);
