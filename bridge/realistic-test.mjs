// One-scene realistic test: node bridge/realistic-test.mjs --out /tmp/real1
import fs from "node:fs"; import path from "node:path"; import sharp from "sharp";
import { sceneImage, klingClip } from "./realistic-engine.mjs";
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env }; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "/tmp/real1"; fs.mkdirSync(OUT, { recursive: true });
// The hardcoded SHOTS table is gone (it described water for every business).
// Give this test the scene yourself: --img "<scene brief>" --motion "<camera move>"
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const shot = { img: arg("--img", ""), motion: arg("--motion", "slow cinematic push-in, natural motion, product stays sharp") };
if (!shot.img) { console.error('need --img "<scene brief>"'); process.exit(1); }
async function gemini(model, body) { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; }
const photo = await sharp(path.join(APP, "public/wellwa/images/aura-maxx.webp")).png().toBuffer();
const logo = await sharp(path.join(APP, "public/wellwa/images/wellwa-logo.png")).png().toBuffer();
const imgFile = path.join(OUT, "scene.png");
let img; if (fs.existsSync(imgFile)) img = fs.readFileSync(imgFile); else { img = await sceneImage({ gemini, photo, logo, brief: shot.img }); fs.writeFileSync(imgFile, img); }
console.log("scene image ok", img.length);
const url = await klingClip({ falKey: env.FAL_KEY, imageBuf: await sharp(img).resize({ width: 1080 }).jpeg({ quality: 92 }).toBuffer(), prompt: shot.motion, duration: "5", log: console.log });
const mp4 = Buffer.from(await (await fetch(url)).arrayBuffer()); fs.writeFileSync(path.join(OUT, "clip.mp4"), mp4);
console.log("DONE", path.join(OUT, "clip.mp4"), mp4.length);
