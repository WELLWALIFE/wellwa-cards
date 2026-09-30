// Voice-over for the "how to make your card" tutorial video — runs on the SERVER (it has the Gemini key).
//   node scripts/tutorial-voice.mjs scripts/tutorial-voice.json /tmp/tutorial-voice
// Input: [{ "id": "01", "text": "Hinglish line…" }, …]. Output: <outDir>/<id>.wav (24 kHz mono) + durations.json.
// Same path as the app's own videos: Hinglish → Devanagari first (pronunciation), then Gemini TTS.
// Cost: about 25 audio tokens a second — a 4-minute voice-over is a few rupees.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nativeScript } from "../bridge/tts-script.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
try {
  for (const line of readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* env from the process only */ }
const KEY = env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing in .env.local"); process.exit(1); }
const MODEL = env.TTS_MODEL || "gemini-2.5-flash-preview-tts";
const VOICE = process.env.VOICE || "Sulafat"; // warm female; "Charon" = warm male

const [, , inFile, outDir = "/tmp/tutorial-voice"] = process.argv;
const lines = JSON.parse(readFileSync(inFile, "utf8"));
mkdirSync(outDir, { recursive: true });

function wavHeader(len, sr = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(len, 40);
  return h;
}
async function once(text) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const d = await r.json().catch(() => ({}));
  return { b64: d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data, why: d?.error ? JSON.stringify(d.error).slice(0, 160) : d?.candidates?.[0]?.finishReason || "no audio" };
}

const durations = {};
for (const { id, text } of lines) {
  const out = path.join(outDir, `${id}.wav`);
  if (existsSync(out) && !process.env.FORCE) { console.log(`= ${id} (exists)`); continue; }
  const native = await nativeScript(text, "hinglish", KEY);
  let res = { b64: null, why: "" };
  for (const t of [native, native, text]) { res = await once(t); if (res.b64) break; await new Promise((r) => setTimeout(r, 1500)); }
  if (!res.b64) { console.error(`✗ ${id}: ${res.why}`); process.exitCode = 1; continue; }
  const pcm = Buffer.from(res.b64, "base64");
  writeFileSync(out, Buffer.concat([wavHeader(pcm.length), pcm]));
  durations[id] = +(pcm.length / 48000).toFixed(2);
  console.log(`✓ ${id} ${durations[id]}s  ${native.slice(0, 60)}`);
}
writeFileSync(path.join(outDir, "durations.json"), JSON.stringify(durations, null, 1));
console.log(`done → ${outDir}`);
