// Stock AI presenters for the "Presenter" tier: 12 consistent Indian actors
// generated once with Gemini image (studio portrait, looking at camera, plain
// background — what the Kling avatar model wants). Writes
// public/studio/actors/<key>.jpg + actors.json. Run: node bridge/make-actors.mjs [--force]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
function loadEnv() { const env = { ...process.env }; try { for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch { /* none */ } return env; }
const env = loadEnv();
const KEY = env.GEMINI_API_KEY;
const OUT = path.join(APP, "public", "studio", "actors");
const force = process.argv.includes("--force");

export const ACTORS = [
  { key: "priya", name: "Priya", gender: "female", voice: "warmf", look: "young Indian woman around 26, friendly confident smile, smart casual kurti, light makeup, long dark hair" },
  { key: "ananya", name: "Ananya", gender: "female", voice: "youthful", look: "young Indian woman around 23, energetic creator vibe, modern western top, hoop earrings, bright expression" },
  { key: "meera", name: "Meera", gender: "female", voice: "mature", look: "Indian woman around 42, elegant cotton saree, warm motherly confidence, subtle jewellery" },
  { key: "dr-kavita", name: "Dr. Kavita", gender: "female", voice: "calm", look: "Indian woman doctor around 38, white coat over formal wear, stethoscope, calm trustworthy expression" },
  { key: "simran", name: "Simran", gender: "female", voice: "soft", look: "young Punjabi woman around 30, business formal blazer, professional soft smile, neat bun" },
  { key: "lakshmi", name: "Lakshmi", gender: "female", voice: "gentle", look: "South Indian woman around 35, silk saree, jasmine in hair, gentle homely warmth" },
  { key: "rahul", name: "Rahul", gender: "male", voice: "friendly", look: "young Indian man around 27, friendly neighbourhood-shop energy, casual shirt, short beard, bright smile" },
  { key: "arjun", name: "Arjun", gender: "male", voice: "clear", look: "Indian man around 30, fit, modern t-shirt, upbeat creator energy, clean shave, styled hair" },
  { key: "vikram", name: "Vikram", gender: "male", voice: "smooth", look: "Indian man around 38, tailored navy suit, premium corporate presenter, groomed beard" },
  { key: "rajesh", name: "Rajesh", gender: "male", voice: "warm", look: "Indian man around 45, kurta, respected businessman/trader warmth, salt-and-pepper hair, moustache" },
  { key: "dr-suresh", name: "Dr. Suresh", gender: "male", voice: "expert", look: "Indian man doctor around 50, white coat, glasses, assured expert expression" },
  { key: "farhan", name: "Farhan", gender: "male", voice: "deep", look: "Indian man around 33, dark shirt, calm deep-voice presenter feel, neat beard, confident gaze" },
];

const prompt = (look) => `Studio portrait photograph for a talking-head video: ${look}. Framing: head and shoulders, centred, facing the camera directly, eyes looking straight into the lens, mouth closed with a natural relaxed expression, shoulders square. Plain soft-grey seamless studio background, even soft key light, photorealistic, sharp focus on the face, 85mm lens look. No text, no logos, no hands, no props, no other people.`;

async function gen(look) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt(look) }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }) });
  const j = await r.json();
  const part = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part) throw new Error(j.error?.message || "no image");
  return Buffer.from(part.inlineData.data, "base64");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!KEY) throw new Error("GEMINI_API_KEY missing");
  fs.mkdirSync(OUT, { recursive: true });
  const meta = [];
  for (const a of ACTORS) {
    const file = path.join(OUT, `${a.key}.jpg`);
    if (!fs.existsSync(file) || force) {
      let ok = false;
      for (let t = 0; t < 3 && !ok; t++) {
        try { const buf = await gen(a.look); await sharp(buf).resize(900, 1200, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toFile(file); ok = true; console.log("made", a.key); }
        catch (e) { console.log("retry", a.key, e.message); await new Promise((r) => setTimeout(r, 2000)); }
      }
      if (!ok) { console.log("SKIP", a.key); continue; }
      await sharp(file).resize(300, 400).jpeg({ quality: 82 }).toFile(path.join(OUT, `${a.key}-thumb.jpg`));
    }
    meta.push({ key: a.key, name: a.name, gender: a.gender, voice: a.voice, url: `/studio/actors/${a.key}.jpg`, thumb: `/studio/actors/${a.key}-thumb.jpg` });
  }
  fs.writeFileSync(path.join(OUT, "actors.json"), JSON.stringify(meta, null, 2));
  console.log(`actors.json: ${meta.length} actors`);
}
