// Cartoon presenter PoC: Gemini character + mouth/eye variants, Gemini TTS,
// Rhubarb visemes, sharp compositing, ffmpeg assembly. ₹~1 per video.
//   node bridge/cartoon-poc.mjs --out /tmp/cartoon [--script "..."] [--voice Kore]
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
const env = { ...process.env };
try { for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); } } catch {}
const KEY = env.GEMINI_API_KEY;
const FFMPEG = env.FFMPEG || "/opt/neuraledge/bin/ffmpeg";
const RHUBARB = env.RHUBARB || "/opt/neuraledge/bin/rhubarb/rhubarb";
const IMG_MODEL = "gemini-2.5-flash-image", VISION = "gemini-3.5-flash-lite";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "1"] : []).filter((x) => x.length));
const OUT = args.out || "/tmp/cartoon"; fs.mkdirSync(OUT, { recursive: true });
const SCRIPT = args.script || "नमस्ते! मैं रिया हूँ, Wellwa Life से। क्या आप जानते हैं, सही पानी आपकी सेहत बदल सकता है? Wellwa Aura ionizer देता है alkaline, hydrogen-rich पानी — हर दिन, हर घूँट में ताज़गी। आज ही free demo book करें!";
const VOICE = args.voice || "Kore";
const W = 1080, H = 1920;

async function gemini(model, body) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j;
}
const imgPart = (j) => (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
async function genImage(prompt, ratio = "9:16") {
  for (const cfg of [{ responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } }, { responseModalities: ["IMAGE", "TEXT"] }]) {
    try { const p = imgPart(await gemini(IMG_MODEL, { contents: [{ parts: [{ text: prompt }] }], generationConfig: cfg })); if (p) return Buffer.from(p.inlineData.data, "base64"); } catch (e) { console.log("  img retry:", e.message.slice(0, 80)); }
  }
  throw new Error("image failed");
}
async function editImage(base, instruction) {
  for (let i = 0; i < 2; i++) {
    try {
      const j = await gemini(IMG_MODEL, { contents: [{ parts: [{ inlineData: { mimeType: "image/png", data: base.toString("base64") } }, { text: instruction }] }], generationConfig: { responseModalities: ["IMAGE"] } });
      const p = imgPart(j); if (p) return Buffer.from(p.inlineData.data, "base64");
    } catch (e) { console.log("  edit retry:", e.message.slice(0, 80)); }
  }
  throw new Error("edit failed: " + instruction.slice(0, 40));
}
async function bbox(base, what) {
  const j = await gemini(VISION, { contents: [{ parts: [{ inlineData: { mimeType: "image/png", data: base.toString("base64") } }, { text: `Detect the ${what} of the character in this image. Return a JSON object {"box_2d":[ymin,xmin,ymax,xmax]} with coordinates normalized to 0-1000. Box tightly around it.` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } });
  const t = j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let b = JSON.parse(t.replace(/```json|```/g, "")); if (Array.isArray(b)) b = b[0]; const bx = b.box_2d ?? b;
  const [y1, x1, y2, x2] = Array.isArray(bx) ? bx : [bx.ymin, bx.xmin, bx.ymax, bx.xmax];
  const box = { x: Math.round(x1 / 1000 * W), y: Math.round(y1 / 1000 * H), w: Math.round((x2 - x1) / 1000 * W), h: Math.round((y2 - y1) / 1000 * H) };
  if (!(box.w > 0 && box.h > 0)) throw new Error("bbox parse failed: " + t.slice(0, 120));
  return box;
}
function pad(b, f) { const px = Math.round(b.w * f), py = Math.round(b.h * f); return { x: Math.max(0, b.x - px), y: Math.max(0, b.y - py), w: Math.min(W - Math.max(0, b.x - px), b.w + 2 * px), h: Math.min(H - Math.max(0, b.y - py), b.h + 2 * py) }; }
async function featherMask(w, h) {
  // ellipse well inside the box, then a wide blur → alpha is ~0 at the edges
  const svg = `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="black"/><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.30}" ry="${h * 0.30}" fill="white"/></svg>`;
  return sharp(Buffer.from(svg)).blur(Math.max(4, Math.min(w, h) * 0.09)).greyscale().toBuffer();
}
/** Paste only the `box` region of `variant` onto `base`, feathered. */
async function patch(base, variant, box) {
  const v = await sharp(variant).resize(W, H, { fit: "fill" }).png().toBuffer();
  const region = await sharp(v).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).png().toBuffer();
  const mask = await featherMask(box.w, box.h);
  const masked = await sharp(region).removeAlpha().joinChannel(await sharp(mask).greyscale().toBuffer()).png().toBuffer();
  return sharp(base).composite([{ input: masked, left: box.x, top: box.y }]).png().toBuffer();
}
function wavHeader(len, sr = 24000) { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(len, 40); return h; }
async function tts(text, file) {
  for (let i = 0; i < 3; i++) {
    const j = await gemini("gemini-2.5-flash-preview-tts", { contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } } }).catch(() => null);
    const b64 = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (b64) { const pcm = Buffer.from(b64, "base64"); fs.writeFileSync(file, Buffer.concat([wavHeader(pcm.length), pcm])); return pcm.length / 48000; }
  }
  throw new Error("tts failed");
}

const MOUTHS = {
  A: "mouth fully closed, lips together, relaxed (as when saying M, B, P)",
  B: "mouth slightly open, upper teeth just visible, lips relaxed (as when saying K, S, T)",
  C: "mouth open medium, showing teeth, relaxed jaw (as when saying E, EH)",
  D: "mouth wide open, jaw dropped, tongue visible (as when saying AH)",
  E: "mouth slightly open and rounded, small O shape (as when saying O, OH)",
  F: "lips pushed forward and puckered into a tight small circle (as when saying OO, W)",
  G: "upper teeth touching the lower lip (as when saying F, V)",
  H: "mouth open with tongue raised touching upper teeth (as when saying L)",
};

async function main() {
  console.log("1. character…");
  const basePath = path.join(OUT, "base.png");
  let base;
  if (fs.existsSync(basePath) && !args.fresh) base = fs.readFileSync(basePath);
  else {
    base = await genImage(args.style === "real" ? "Photorealistic portrait photo, DSLR, 85mm lens, natural soft light. A friendly Indian woman presenter, about 30, shoulder-length dark hair, teal blazer over white top, standing centered, waist-up, facing the camera directly, arms relaxed, MOUTH CLOSED in a calm neutral expression, eyes open looking at camera. Background: bright modern office with large windows and a plant, shallow depth of field. Portrait 9:16 composition, head in upper third. No text, no logos, no watermark." : "Clean modern 2D vector illustration, flat design with soft shading (Vyond / corporate explainer style). A friendly Indian woman presenter, about 30, shoulder-length dark hair, teal blazer over white top, standing centered, waist-up, facing the camera directly, arms relaxed, MOUTH CLOSED in a calm neutral expression, eyes open looking at camera. Background: bright modern office with large windows and a plant, soft colors, slightly blurred. Portrait 9:16 composition, character occupies the middle, head in upper third. No text, no logos, no watermark.");
    base = await sharp(base).resize(W, H, { fit: "cover" }).png().toBuffer(); fs.writeFileSync(basePath, base);
  }
  console.log("2. boxes…");
  const mouthBox = pad(await bbox(base, "mouth (lips)"), 0.9), eyeBox = pad(await bbox(base, "pair of eyes (both eyes together)"), 0.5);
  console.log("   mouth", mouthBox, "eyes", eyeBox);
  console.log("3. mouth variants…");
  const frames = {};
  for (const [k, desc] of Object.entries(MOUTHS)) {
    const f = path.join(OUT, `frame_${k}.png`);
    if (fs.existsSync(f) && !args.fresh && !args.repatch) { frames[k] = f; continue; }
    const vf = path.join(OUT, `var_${k}.png`);
    const v = fs.existsSync(vf) && !args.fresh ? fs.readFileSync(vf) : await editImage(base, `Edit this illustration. Keep EVERYTHING exactly the same — same character, same face, same hair, same clothes, same pose, same colors, same background, same framing. Change ONLY the mouth: ${desc}. Same ${args.style === "real" ? "photo, same lighting" : "art style"}. Output the full image.`);
    fs.writeFileSync(vf, v);
    fs.writeFileSync(f, await patch(base, v, mouthBox)); frames[k] = f; console.log("   ", k);
  }
  frames.X = path.join(OUT, "frame_X.png"); fs.copyFileSync(basePath, frames.X);
  const blinkF = path.join(OUT, "frame_blink.png");
  const bvf = path.join(OUT, "var_blink.png");
  if (!fs.existsSync(blinkF) || args.fresh || args.repatch) { const v = fs.existsSync(bvf) && !args.fresh ? fs.readFileSync(bvf) : await editImage(base, "Edit this illustration. Keep EVERYTHING exactly the same. Change ONLY the eyes: both eyes gently closed (blinking), eyelids down. Same art style. Output the full image."); fs.writeFileSync(bvf, v); fs.writeFileSync(blinkF, await patch(base, v, eyeBox)); }
  // blink versions of every mouth frame
  const blinkPatch = await sharp(blinkF).extract({ left: eyeBox.x, top: eyeBox.y, width: eyeBox.w, height: eyeBox.h }).png().toBuffer();
  for (const k of Object.keys(frames)) { const f = path.join(OUT, `frame_${k}_b.png`); if (!fs.existsSync(f) || args.fresh || args.repatch) fs.writeFileSync(f, await sharp(frames[k]).composite([{ input: blinkPatch, left: eyeBox.x, top: eyeBox.y }]).png().toBuffer()); }

  console.log("4. voice…");
  const wav = path.join(OUT, "voice.wav"); const sec = await tts(SCRIPT, wav); console.log("   ", sec.toFixed(1), "s");
  console.log("5. lip-sync cues…");
  const cuesFile = path.join(OUT, "cues.json");
  await run(RHUBARB, ["-r", "phonetic", "-f", "json", "-o", cuesFile, wav]);
  const cues = JSON.parse(fs.readFileSync(cuesFile, "utf8")).mouthCues;

  console.log("6. frames list…");
  const FPS = 25, total = Math.ceil((sec + 0.6) * FPS);
  const blinks = new Set(); for (let t = 2.2; t < sec; t += 2.8 + Math.random() * 1.5) { const s = Math.round(t * FPS); blinks.add(s); blinks.add(s + 1); blinks.add(s + 2); }
  // viseme per frame: lips lead audio by ~1 frame, gaps < 0.12 s keep the
  // previous shape instead of snapping shut, and every change gets one
  // blended in-between frame so it doesn't flicker.
  const LEAD = 0.04, per = [];
  for (let i = 0; i < total; i++) {
    const t = i / FPS + LEAD;
    const c = cues.find((q) => t >= q.start && t < q.end);
    let v = c ? c.value : "X";
    if (v === "X" && c && c.end - c.start < 0.12 && per.length) v = per[per.length - 1];
    per.push(v);
  }
  const blendCache = new Map();
  async function blended(a, b, blink) {
    const key = `${a}${b}${blink ? "b" : ""}`; if (blendCache.has(key)) return blendCache.get(key);
    const f = path.join(OUT, `mix_${key}.png`);
    if (!fs.existsSync(f)) {
      const A = path.join(OUT, `frame_${a}${blink ? "_b" : ""}.png`), B = path.join(OUT, `frame_${b}${blink ? "_b" : ""}.png`);
      const bb = await sharp(B).ensureAlpha(0.5).png().toBuffer();
      fs.writeFileSync(f, await sharp(A).composite([{ input: bb }]).png().toBuffer());
    }
    blendCache.set(key, f); return f;
  }
  let list = "";
  for (let i = 0; i < total; i++) {
    const v = per[i], prev = i ? per[i - 1] : v, blink = blinks.has(i);
    const file = v !== prev ? await blended(prev, v, blink) : path.join(OUT, `frame_${v}${blink ? "_b" : ""}.png`);
    list += `file '${file}'\nduration ${1 / FPS}\n`;
  }
  list += `file '${path.join(OUT, "frame_X.png")}'\n`;
  fs.writeFileSync(path.join(OUT, "list.txt"), list);

  console.log("7. ffmpeg…");
  const out = path.join(OUT, "cartoon.mp4");
  // gentle breathing zoom so it never looks like a still photo
  await run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", path.join(OUT, "list.txt"), "-i", wav,
    "-filter_complex", `[0:v]scale=${W * 1.06}:${H * 1.06},crop=${W}:${H}:'(iw-ow)/2+8*sin(t*0.7)':'(ih-oh)/2+10*sin(t*0.45)',format=yuv420p[v]`,
    "-map", "[v]", "-map", "1:a", "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out], { maxBuffer: 1 << 26 });
  console.log("DONE", out);
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
