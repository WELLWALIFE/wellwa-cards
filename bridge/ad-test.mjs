// Standalone Ad Builder test (no DB): node bridge/ad-test.mjs --out /tmp/adtest
import fs from "node:fs"; import path from "node:path"; import { execFile } from "node:child_process"; import { promisify } from "node:util";
import { renderAd, defaultScript } from "./ad-engine.mjs";
const run = promisify(execFile);
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = { ...process.env }; for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const FFMPEG = "/opt/neuraledge/bin/ffmpeg";
const OUT = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "/tmp/adtest"; fs.mkdirSync(OUT, { recursive: true });
function wavHeader(len, sr = 24000) { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(len, 40); return h; }
async function tts(text, file) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", { method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } } }) });
  const j = await r.json(); const b64 = j?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data; if (!b64) throw new Error("tts " + JSON.stringify(j).slice(0, 100));
  const pcm = Buffer.from(b64, "base64"); fs.writeFileSync(file, Buffer.concat([wavHeader(pcm.length), pcm])); return pcm.length / 48000;
}
const inp = { product: "Wellwa Aura Maxx", headline: "पानी बदलो, सेहत बदलो", features: ["Hydrogen-rich alkaline पानी", "7 platinum-titanium plates", "5 साल की warranty"], offer: "₹5000 की छूट + free installation", phone: "87082 75430", brandName: "Wellwa Life", website: "wellwalife.com", lang: "hinglish", template: process.argv.includes("--tpl") ? process.argv[process.argv.indexOf("--tpl") + 1] : "bold", music: "upbeat-corporate" };
const lines = defaultScript(inp); const voLines = [];
for (let i = 0; i < lines.length; i++) { const w = path.join(OUT, `vo-${i}.wav`); const sec = await tts(lines[i], w); voLines.push({ text: lines[i], sec }); console.log("tts", i, sec.toFixed(1)); }
const parts = voLines.map((l, i) => `[${i}:a]apad=whole_dur=${Math.max(2.2, l.sec + 0.5) - (i < voLines.length - 1 ? 0.3 : 0)}[a${i}]`);
const a = ["-y", "-loglevel", "error"]; voLines.forEach((_, i) => a.push("-i", path.join(OUT, `vo-${i}.wav`)));
await run(FFMPEG, [...a, "-filter_complex", `${parts.join(";")};${voLines.map((_, i) => `[a${i}]`).join("")}concat=n=${voLines.length}:v=0:a=1[out]`, "-map", "[out]", path.join(OUT, "vo.wav")]);
const photo = fs.readFileSync(path.join(APP, "public/wellwa/images/aura-maxx.webp"));
const logo = fs.readFileSync(path.join(APP, "public/wellwa/images/wellwa-logo.png"));
const ffmpeg = (args) => run(FFMPEG, args.filter((x) => x !== "-y" && x !== "-loglevel" && x !== "error").length ? args : args, { maxBuffer: 1 << 26 });
for (const fmt of ["reel", "square"]) { const out = await renderAd(OUT, fmt, inp, { photo, logo, voWav: path.join(OUT, "vo.wav"), music: path.join(APP, "bridge/music", inp.music + ".mp3") }, { ffmpeg }, voLines); console.log("DONE", out); }
