// A dry run of the picture pipeline on the VPS, before a whole video is paid for.
//
//   cd /opt/neuraledge/app && node bridge/picture-test.mjs            # Imagen 4 Fast (default), 12 orders
//   EXPLAINER_IMG_MODEL=gemini node bridge/picture-test.mjs           # force the Gemini image model instead (no Imagen)
//   node bridge/picture-test.mjs 6                                    # only the first 6 orders
//
// Twelve orders of the kind a real script produces go through the same order-check and the same picture check
// the engine uses. It prints, per order: passed / kept-as-spare / none, the attempts, the rejection reasons — and
// at the end the pass rate and the rupees. Every kept picture is uploaded to the media bucket under
// ai-media/_tests/<time>/ and its public URL printed, so the pictures can be looked at in a browser.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { reviewOrders } from "./shotlist.mjs";
import { makePicture, pictureStats, pictureCostRupees, resolveImagen } from "./explainer-picture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
try {
  for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (m && !(m[1] in env)) env[m[1]] = m[2];
  }
} catch { /* no .env.local next to bridge/ */ }
if (env.EXPLAINER_IMG_MODEL === "gemini") { process.env.EXPLAINER_IMG_MODEL = "none"; }   // forces the Gemini path
else if (env.EXPLAINER_IMG_MODEL && !process.env.EXPLAINER_IMG_MODEL) process.env.EXPLAINER_IMG_MODEL = env.EXPLAINER_IMG_MODEL;
if (env.IMG_MODEL && !process.env.IMG_MODEL) process.env.IMG_MODEL = env.IMG_MODEL;
if (env.EXPLAINER_GEMINI_IMG && !process.env.EXPLAINER_GEMINI_IMG) process.env.EXPLAINER_GEMINI_IMG = env.EXPLAINER_GEMINI_IMG;
const KEY = env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing"); process.exit(1); }
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL, SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const brief = {
  world: "present-day working India: a tidy small shop or a small office, a smartphone or laptop in use, a clean counter, city daylight",
  look: "bright morning window light, clean palette with warm wood and a soft teal accent, 50mm at f/2.8, gentle contrast",
};
// Real lines from a Shubhora script, with the kind of orders the planner writes — including the ones that used to fail.
const ORDERS = [
  { line: "छोटे दुकानदार के पास मार्केटिंग के लिए समय नहीं होता।", heading: "समय की कमी", idea: "the owner has no hours left for marketing", frame: "hands", subject: "hands tallying cash at a shop counter, a phone face-down beside them", moment: "a queue's shadow falls across the counter", backup: "a shop counter with a cash drawer open and a phone face-down beside it", abstract: false },
  { line: "हर दिन पोस्टर बनाना, व्हाट्सएप भेजना, वीडियो बनाना — सब अकेले करना मुश्किल है।", heading: "सब अकेले", idea: "one person is doing the work of four", frame: "place", subject: "one worn chair at a small shop desk with four empty chairs around it", moment: "morning light across the empty seats", backup: "four empty plastic chairs around one shop desk", abstract: false },
  { line: "कंसिस्टेंसी सबसे बड़ी समस्या है।", heading: "कंसिस्टेंसी", idea: "marketing stops the moment the owner gets busy", frame: "object", subject: "a wall calendar in a shop with the first week ticked and the rest blank", moment: "the pen lying below it", backup: "a desk calendar with a few days marked and the rest empty", abstract: true },
  { line: "लीड्स का फॉलो-अप नहीं हो पाता।", heading: "फॉलो-अप", idea: "enquiries go cold when nobody calls back", frame: "screen", subject: "a phone lying face-up on a shop counter beside a half-filled order book", moment: "a thumb above the screen, not yet pressing", backup: "an order book half ticked with a phone lying across it", abstract: false },
  { line: "Shubhora आपका WhatsApp CRM संभालता है।", heading: "WhatsApp CRM", idea: "customer messages are answered and tracked automatically", frame: "screen", subject: "a smartphone displaying a WhatsApp chat list with new messages on a wooden desk", moment: "", backup: "a phone on a wooden desk beside a cup of tea", abstract: false },   // the classic failing order
  { line: "आपकी दुकान की एक professional website तैयार।", heading: "आपकी वेबसाइट", idea: "the shop is visible online", frame: "screen", subject: "a laptop displaying a shop website homepage on a counter", moment: "", backup: "a laptop half open on a shop counter, morning light on the lid", abstract: false },   // failing order
  { line: "रोज़ाना एक नया पोस्टर, आपके नाम के साथ।", heading: "रोज़ाना पोस्टर", idea: "a fresh poster every morning", frame: "hands", subject: "hands pinning a freshly printed colour poster to a shop noticeboard", moment: "the corner still curling", backup: "a stack of printed posters on a counter beside a roll of tape", abstract: false },
  { line: "बड़े ब्रांड्स की सफलता का राज़ — रोज़ दिखना।", heading: "रोज़ दिखना", idea: "big brands are seen every single day", frame: "pair", subject: "two shop shutters side by side on one street, one covered in fresh colourful posters and one bare", moment: "early morning, shutters still down", backup: "one shutter covered in posters beside a bare one", abstract: true },
  { line: "टीम रखने का खर्च हर दुकानदार नहीं उठा सकता।", heading: "टीम का खर्च", idea: "hiring a marketing team costs more than the shop makes", frame: "object", subject: "a salary envelope and a calculator on a shop desk, the envelope thin", moment: "", backup: "a calculator and an open ledger on a shop desk", abstract: false },
  { line: "ग्राहक Google पर आपको ढूंढते हैं।", heading: "Google पर आप", idea: "customers search before they visit", frame: "person", subject: "a woman on a scooter at a kerb, phone in hand, looking up at a row of shop fronts", moment: "helmet still on", backup: "a row of shop fronts on a street with a scooter parked at the kerb", abstract: false },
  { line: "आज ही शुरू करें — पहला महीना फ्री।", heading: "पहला महीना फ्री", idea: "starting costs nothing today", frame: "hands", subject: "hands turning a shop's door sign from closed to open", moment: "sunlight through the glass", backup: "a shop door with the sign turned to open, morning light", abstract: false },
  { line: "दो लोग मिलकर बिज़नेस बढ़ाते हैं।", heading: "साथ मिलकर", idea: "growth comes from partnership", frame: "person", subject: "two people shaking hands in a modern office in front of a team", moment: "", backup: "two cups of tea on one shop counter", abstract: true },   // failing order: group/handshake
];
const n = Math.max(1, Math.min(ORDERS.length, Number(process.argv[2]) || ORDERS.length));
const orders = ORDERS.slice(0, n).map((o) => ({ kind: "image", ...o }));
const groups = orders.map((o) => ({ text: o.line, sec: 6, opensParagraph: false }));
const log = (m) => console.log(m);

const imagen = await resolveImagen(KEY, { log });
console.log(`\n== picture test: ${n} orders · image model ${imagen || `(no Imagen on this key) ${process.env.IMG_MODEL || "gemini-3.1-flash-image-preview"}`} ==\n`);
console.log("-- order check --");
const checked = await reviewOrders(orders, groups, { geminiKey: KEY, brief, log });
console.log(`   orders: ${pictureStats.codeFixed} fixed in code, ${pictureStats.rewritten} rewritten by review, of ${n}\n`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = `/tmp/picture-test-${stamp}`; fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const results = [];
for (let i = 0; i < checked.length; i++) {
  const o = checked[i];
  const started = Date.now();
  const r = await makePicture(KEY, { ...o, nextHeading: "" }, { wide: true, world: brief.world, look: brief.look, log, tag: `[test] ${i}` }).catch((e) => ({ buf: null, error: e }));
  let url = "";
  if (r.buf) {
    const file = path.join(outDir, `pic-${i}.jpg`);
    await sharp(r.buf).jpeg({ quality: 88 }).toFile(file);
    if (SUPA_URL && SUPA_KEY) {
      const key = `ai-media/_tests/${stamp}/pic-${i}.jpg`;
      const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: fs.readFileSync(file) }).catch(() => null);
      if (up?.ok) url = `${SUPA_URL}/storage/v1/object/public/media/${key}`;
    }
  }
  const status = r.error ? `ERROR ${r.error.message}` : !r.buf ? "NONE" : r.spare ? `SPARE (${r.verdict?.reasons?.join("; ")})` : "PASS";
  results.push({ i, status, attempts: r.attempts, sec: Math.round((Date.now() - started) / 1000), url, subject: o.subject });
  console.log(`   #${i} ${status} · ${r.attempts ?? 0} attempt(s) · ${Math.round((Date.now() - started) / 1000)}s · "${o.subject}"${url ? `\n      ${url}` : ""}`);
}
const pass = results.filter((r) => r.status === "PASS").length, spare = results.filter((r) => r.status.startsWith("SPARE")).length;
console.log(`\n== result: ${pass} passed first-class, ${spare} kept as best-of-rejected, ${n - pass - spare} none · ${Math.round((Date.now() - t0) / 1000)}s ==`);
console.log(`   generated: ${pictureStats.imagen} Imagen + ${pictureStats.gemini} Gemini · checks ${pictureStats.judgeA} · ≈ ₹${pictureCostRupees()}`);
const why = Object.entries(pictureStats.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(", ");
if (why) console.log(`   rejects: ${why}`);
console.log(`   files: ${outDir}\n`);
