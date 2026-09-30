// One-off: same approved still + same motion prompt → Kling vs Veo 3.1 Lite vs Veo 3.1 Fast. node bridge/video-bakeoff.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import sharp from "sharp";
import { buildKlingPrompt, buildKlingNegative } from "./prompt-builders.mjs"; import { submitClip, pollClip } from "./kling.mjs";
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "qc-fixtures"); const APP = path.resolve(DIR, "../..");
const env = { ...process.env }; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const OUT = "/tmp/bake"; fs.mkdirSync(OUT, { recursive: true });
const facts = JSON.parse(fs.readFileSync(path.join(DIR, "facts.json"), "utf8"));
const shot = { people: { faces: 0 }, product: { visible: true, in_use: true }, camera: "static" };
const prompt = buildKlingPrompt(facts, shot, { visible_objects: ["display"] }); const negative = buildKlingNegative(facts, shot, prompt);
const still = await sharp(path.join(DIR, "new-in-use-onehose-ok.jpg")).resize({ width: 1080 }).jpeg({ quality: 92 }).toBuffer();
console.log("PROMPT:", prompt, "\nNEG:", negative);
const G = "https://generativelanguage.googleapis.com/v1beta"; const gh = { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" };
const list = await fetch(`${G}/models?pageSize=200`, { headers: gh }).then((r) => r.json()); const veos = (list.models ?? []).map((m) => m.name.replace("models/", "")).filter((n) => /veo/i.test(n)); console.log("VEO MODELS:", veos.join(", "));
const pick = (re) => veos.find((n) => re.test(n));
async function veo(model, tag) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${G}/models/${model}:predictLongRunning`, { method: "POST", headers: gh, body: JSON.stringify({ instances: [{ prompt, image: { bytesBase64Encoded: still.toString("base64"), mimeType: "image/jpeg" } }], parameters: { aspectRatio: "9:16", durationSeconds: 4, resolution: "720p", personGeneration: "allow_adult" } }) });
    const start = await res.json(); if (!start.name) return console.log(tag, "START FAILED", JSON.stringify(start).slice(0, 300));
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 12000)); const op = await fetch(`${G}/${start.name}`, { headers: gh }).then((r) => r.json()); if (!op.done) continue; if (op.error) return console.log(tag, "FAILED", JSON.stringify(op.error).slice(0, 300)); const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri; if (!uri) return console.log(tag, "NO VIDEO", JSON.stringify(op.response).slice(0, 300)); fs.writeFileSync(`${OUT}/${tag}.mp4`, Buffer.from(await (await fetch(uri, { headers: gh })).arrayBuffer())); return console.log(tag, model, "OK", Math.round((Date.now() - t0) / 1000) + "s"); }
    console.log(tag, "TIMEOUT");
  } catch (e) { console.log(tag, "ERROR", e.message); }
}
async function kling() { const t0 = Date.now(); try { const p = await submitClip({ falKey: env.FAL_KEY, imageBuf: still, prompt, negative }); const url = await pollClip(p, { falKey: env.FAL_KEY }); fs.writeFileSync(`${OUT}/kling.mp4`, Buffer.from(await (await fetch(url)).arrayBuffer())); console.log("kling OK", Math.round((Date.now() - t0) / 1000) + "s"); } catch (e) { console.log("kling ERROR", e.message); } }
const lite = pick(/veo-3\.1.*lite/i), fast = pick(/veo-3\.1.*fast/i);
await Promise.all([fs.existsSync(`${OUT}/kling.mp4`) ? null : kling(), lite ? veo(lite, "veo-lite") : console.log("no lite model listed"), fast ? veo(fast, "veo-fast") : console.log("no fast model listed")]);
console.log("FILES:", fs.readdirSync(OUT).join(", "));
