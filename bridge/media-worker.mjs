// ============================================================
// Shubhora Studio — media worker (pm2 process name: neuraledge-media — a server name, never shown to anyone)
// Processes queued reel jobs from media_jobs, one at a time.
//
// Tiers:
//   basic — branded SVG cards + Hindi TTS voiceover (no AI scenes)
//   kling — 2 AI scenes via Replicate (REPLICATE_API_TOKEN)
//   veo   — 2 AI scenes via Gemini Veo (GEMINI_API_KEY)
//
// Hard rules learned the hard way (this box froze once):
//   - ONE job at a time, ffmpeg at nice 15 with a virtual-memory ulimit
//   - delivery size 1080x1920 @ 30fps, no zoompan on video, fades only
//   - every failure refunds the user's credits
//   - every outside call has a timeout, and one job may never run forever
// ============================================================

import { renameSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderAd, renderScene, defaultScript, FORMATS as AD_FORMATS, CTA_LABELS } from "./ad-engine.mjs";
import * as AD_ENGINE from "./ad-engine.mjs";
import { renderRealisticAd } from "./realistic-engine.mjs";
import { renderPresenterAd } from "./presenter-engine.mjs";
import { wordCues, renderCuePngs, burnCaptions, reframe } from "./caption-engine.mjs";
import * as CAPTION from "./caption-engine.mjs";
import { nativeScript } from "./tts-script.mjs";
import { runStoryboard, runAnimate, sweepV2 } from "./ad-v2.mjs";
import { processStockReel } from "./stock-reel.mjs";
import { processExplainer } from "./explainer-engine.mjs";

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- shared look & encode settings ----------------
 * These live in ad-engine.mjs / caption-engine.mjs so every renderer agrees.
 * They are read through the namespace imports (not named imports) on purpose:
 * pm2 runs this file against whatever engine files are on the box, and a
 * worker that refuses to BOOT because one export is missing takes every
 * render down. The fallbacks below are the same values, so an older engine
 * file degrades to "still correct" instead of "dead". */
const DEV = AD_ENGINE.DEV
  || "Noto Sans Devanagari, Noto Sans Gujarati, Noto Sans Gurmukhi, Noto Sans Bengali, Noto Sans Tamil, Noto Sans Telugu, Noto Sans Kannada, Noto Sans Malayalam, Noto Sans Oriya, Liberation Sans, DejaVu Sans, sans-serif";
const LATIN = "Liberation Sans, DejaVu Sans, sans-serif";
/** Font stack for one string: Indic text must not fall back to a Latin-only face (tofu boxes). */
const fam = AD_ENGINE.fam || ((s) => (/[ऀ-ൿ]/.test(String(s ?? "")) ? DEV : LATIN));
const isIndic = (s) => /[ऀ-ൿ]/.test(String(s ?? ""));
/** Letter-spacing pulls a Devanagari cluster apart (वेलवा reads as वे ल वा), so
 *  only Latin text is tracked. Found by rendering the card and looking at it. */
const track = (s, n) => (isIndic(s) ? 0 : n);
const SAFE = CAPTION.SAFE || {
  top: (h) => Math.round(h * 0.12),          // under the Status progress bar + sender name
  bottomReel: (h) => Math.round(h * 0.22),   // above the Reels username/caption/audio strip
  bottomStatus: (h) => Math.round(h * 0.14),
  side: (w) => Math.round(w * 0.078),
};
const FPS = CAPTION.FPS || 30;               // Reels / Status / Shorts are all 30fps surfaces
const INTERMEDIATE = CAPTION.INTERMEDIATE || ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "14", "-pix_fmt", "yuv420p"];
const DELIVERY_V = CAPTION.DELIVERY_V || ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", "3000k", "-bufsize", "6000k", "-profile:v", "high", "-level", "4.2", "-bf", "3", "-g", "60", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart+write_colr"];
const DELIVERY_A = CAPTION.DELIVERY_A || ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"];
const MASTER_AF = CAPTION.MASTER_AF || "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.95,aresample=48000,aformat=channel_layouts=stereo";

/* ---------------- outside-call timeouts ----------------
 * Node's fetch has NO default timeout: one stalled socket used to freeze the
 * single render slot forever while the heartbeat kept reporting "healthy". */
const T_JSON = 30_000;      // a text/JSON answer
const T_TTS = 120_000;      // audio generation (a presenter monologue is one long call)
const T_IMAGE = 90_000;     // image generation — same value ad-v2.mjs already uses live
const T_SUBMIT = 60_000;    // "start this render" calls
const T_MEDIA = 120_000;    // downloading or uploading a video/photo

/* ---------------- env ---------------- */
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2];
    }
  } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI = env.GEMINI_API_KEY || "";
for (const k of ["IMG_MODEL", "JUDGE_MODEL", "KLING_ENDPOINT", "TTS_MODEL", "EXPLAINER_IMG_MODEL", "EXPLAINER_GEMINI_IMG"]) if (env[k] && !process.env[k]) process.env[k] = env[k]; // model switches live in .env.local
const REPLICATE = env.REPLICATE_API_TOKEN || "";
const PEXELS = env.PEXELS_API_KEY || "";
const KLING_MODEL = env.REPLICATE_KLING_MODEL || "kwaivgi/kling-v2.1";
const FFMPEG = env.WA_FFMPEG || "/opt/neuraledge/bin/ffmpeg";

/** Plain-text Gemini call for prompt-writing helpers below (not image/TTS). */
async function geminiText(prompt, maxTokens) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(T_JSON),
  });
  const d = await r.json();
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("");
}
const FONT = [
  "/usr/share/fonts/liberation-sans/LiberationSans-Bold.ttf",
  "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
].find((f) => { try { return readFileSync(f).length > 0; } catch { return false; } }) || null;
const SITE = (env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");

if (!SUPA_URL || !SUPA_KEY) { console.error("[media] missing Supabase env"); process.exit(1); }

const sb = (p, init = {}) => fetch(`${SUPA_URL}${p}`, {
  signal: AbortSignal.timeout(T_JSON),   // a hung Supabase socket must not hold the render slot
  ...init,
  headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
});

/* ---------------- ffmpeg, capped ---------------- */
let HAS_SYSTEMD_RUN = null;
async function ffmpeg(args, timeoutMs = 8 * 60_000) {
  // Real-RSS cap via cgroup (ulimit -v killed ffmpeg at startup: static builds
  // map huge VIRTUAL space while using little actual RAM). If the encode's
  // resident memory balloons past 900M, the kernel kills IT — never the box.
  if (HAS_SYSTEMD_RUN === null) {
    HAS_SYSTEMD_RUN = await run("/bin/sh", ["-c", "command -v systemd-run"]).then(() => true, () => false);
  }
  const guard = HAS_SYSTEMD_RUN
    ? "exec systemd-run --scope --quiet --collect -p MemoryMax=900M -p TasksMax=512 nice -n 15"
    : "exec nice -n 15";
  const cmd = `${guard} ${FFMPEG} -y -loglevel error ${args}`;
  try {
    return await run("/bin/sh", ["-c", cmd], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
  } catch (e) {
    // keep the useful tail of stderr — "Command failed" alone helps nobody
    const lines = String(e?.stderr ?? "").trim().split("\n");
    console.error("[ffmpeg] " + lines.slice(-12).join("\n[ffmpeg] "));
    const tail = lines.filter((l) => !/Could not open encoder|Task finished|Terminating thread/.test(l)).slice(-3).join(" | ").slice(0, 260);
    throw new Error(`ffmpeg failed: ${tail || e?.message?.slice(0, 200) || "unknown"}`);
  }
}

/* ---------------- SVG cards (drawn at delivery size) ---------------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function wrap(text, max) {
  const words = String(text).trim().split(/\s+/); const lines = []; let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) { lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}
async function card(file, { kicker = "", title, lines = [], footer, big = 72, photo = null, tone = 0 }) {
  const tones = [
    ["#042c36", "#0a6c6c", "#12a092"],
    ["#052538", "#0b5f7e", "#1493a8"],
    ["#04303a", "#0d7566", "#1aa87e"],
  ];
  const [c1, c2, c3] = tones[tone % tones.length];
  // The card was composed on a 720 x 1280 grid; the reel is delivered at
  // 1080x1920, so the SAME composition is drawn at S=1.5. Every number below
  // is still the original one — multiplied once, here, so the layout can
  // never drift apart from the video size.
  const S = 1.5, W = 720 * S, H = 1280 * S, MID = 360 * S;
  const px = (n) => +(n * S).toFixed(2);
  // The brand line used to sit at 90% of the height — underneath the Instagram
  // Reels username/caption strip, i.e. the one band guaranteed to be covered.
  const footY = Math.round(H - SAFE.bottomReel(H) - px(19));
  // ...but moving the footer UP without moving the text left a 3-line headline
  // running straight through the divider (drawn at footY - px(68)) and a 4-line
  // one printing over the brand line and into the Reels strip. So the block is
  // laid out against the footer, not from a fixed startY: measure it, lift it as
  // far as the photo / kicker above allows, and shrink the type until the last
  // descender clears the divider. Everything is in the original 720x1280 grid
  // units; px() scales once, at the end.
  const FLOOR = photo ? 706 : 136;              // grid units: below the photo (130+560) / clear of the top edge
  const PREF = photo ? 760 : 400;               // where the block sits when it fits, i.e. today's layout
  const LIMIT = footY - px(90);                 // no ink at or below this, in delivered pixels
  const measure = (s) => {
    const tl = wrap(title, s > 60 ? 15 : 19);
    const step = s + 12;
    const bodyOff = tl.length * step + 34;                                     // first body baseline, relative to startY
    const lastRel = lines.length ? bodyOff + (lines.length - 1) * 50 : Math.max(0, tl.length - 1) * step;
    return { tl, step, bodyOff, ascent: Math.round(s * 0.78), height: lastRel + (lines.length ? 14 : Math.round(s * 0.3)) };
  };
  let big2 = big, m = measure(big2), startY = PREF;
  for (let guard = 0; guard < 24; guard++) {
    m = measure(big2);
    const floor = Math.max(FLOOR + m.ascent, kicker ? big2 + 128 : 0);
    startY = Math.max(floor, Math.min(PREF, Math.round(LIMIT / S) - m.height));
    if (px(startY + m.height) <= LIMIT + 0.5 || big2 <= 34) break;
    big2 -= 4;
  }
  const bigPx = px(big2);
  const titleLines = m.tl;
  const titleSvg = titleLines.map((l, i) =>
    `<text x="${MID}" y="${px(startY + i * m.step)}" text-anchor="middle" font-family="${fam(l)}" font-weight="900" font-size="${bigPx}" fill="#ffffff">${esc(l)}</text>`).join("");
  const bodyY = startY + m.bodyOff;
  const body = lines.map((l, i) =>
    `<text x="${MID}" y="${px(bodyY + i * 50)}" text-anchor="middle" font-family="${fam(l)}" font-size="${px(34)}" fill="#dff6f2">${esc(l)}</text>`).join("");
  const kick = kicker
    ? `<rect x="${px(360 - (kicker.length * 11 + 44) / 2)}" y="${px(startY - big2 - 96)}" rx="${px(24)}" width="${px(kicker.length * 11 + 44)}" height="${px(48)}" fill="#ffffff" opacity="0.16"/>
       <text x="${MID}" y="${px(startY - big2 - 62)}" text-anchor="middle" font-family="${fam(kicker)}" font-weight="700" font-size="${px(26)}" letter-spacing="${px(track(kicker, 3))}" fill="#ffffff">${esc(kicker.toUpperCase())}</text>`
    : "";

  let photoTag = "";
  if (photo) {
    const fitted = await sharp(photo).resize(px(600), px(560), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    photoTag = `<image x="${px(60)}" y="${px(130)}" width="${px(600)}" height="${px(560)}" href="data:image/png;base64,${fitted.toString("base64")}"/>`;
  }

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${[...Array(18)].map((_, i) => { const r = px(18 + (i * 43 + tone * 17) % 100), cx = px((i * 197 + tone * 61) % 720), cy = px((i * 311 + tone * 97) % 1280); return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="0.045" stroke="#ffffff" stroke-opacity="0.10" stroke-width="${px(3)}"/>`; }).join("")}
  ${photoTag}${kick}${titleSvg}${body}
  <rect x="${px(300)}" y="${footY - px(68)}" width="${px(120)}" height="${px(4)}" rx="${px(2)}" fill="#ffffff" opacity="0.5"/>
  <text x="${MID}" y="${footY}" text-anchor="middle" font-family="${fam(footer)}" font-weight="700" font-size="${px(30)}" letter-spacing="${px(track(footer, 8))}" fill="#ffffff">${esc((footer || "").toUpperCase())}</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

/** Split a spoken script into 2-4 on-screen beats. */
function beats(script) {
  const sentences = String(script).split(/(?<=[.!?।])\s+/).map((x) => x.trim()).filter(Boolean);
  if (sentences.length <= 1) return [String(script).trim()];
  const out = [];
  const per = Math.ceil(sentences.length / Math.min(3, sentences.length));
  for (let i = 0; i < sentences.length; i += per) out.push(sentences.slice(i, i + per).join(" "));
  return out.slice(0, 4);
}

/** Fetch a user photo (our hosts only, small). */
async function fetchPhoto(url) {
  if (!url) return null;
  try {
    const abs = url.startsWith("/") ? SITE + url : url;
    if (!(abs.startsWith(SITE) || abs.startsWith(SUPA_URL))) return null;
    const r = await fetch(abs, { signal: AbortSignal.timeout(T_JSON) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= 5 * 1024 * 1024 ? buf : null;
  } catch { return null; }
}

/* ---------------- Hindi TTS ---------------- */
/** One WAV per spoken line, so a scene can last exactly as long as its line. */
// Gemini prebuilt TTS voices, picked for ad narration and grouped by the
// gender each one reads as. Google documents the character ("Firm", "Breezy")
// but not the gender, so these groupings come from listening, not the docs.
// Keys are what the Studio sends — never rename one, old jobs store the key.
const VOICES = {
  // male
  warm: "Charon",          // informative — the default
  clear: "Puck",           // upbeat
  deep: "Orus",            // firm, lower
  friendly: "Achird",      // friendly, neighbourly
  smooth: "Algieba",       // smooth, premium
  expert: "Sadaltager",    // knowledgeable — technical claims
  // female
  calm: "Kore",            // firm but steady
  warmf: "Sulafat",        // warm
  youthful: "Leda",        // youthful
  soft: "Achernar",        // soft — family/emotional scripts
  gentle: "Vindemiatrix",  // gentle
  mature: "Gacrux",        // mature, assured
  lively: "Laomedeia",     // upbeat — offer and festival reels
};

function wavHeader(len, sr = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(len, 40);
  return h;
}

const TTS_LANG_NAME = { hi: "Hindi", hinglish: "Hindi", mr: "Marathi", gu: "Gujarati", pa: "Punjabi", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia", en: "Indian English" };
/** The style line names the language: one English instruction for every language made the narrator read Hindi with an English accent. */
const ttsStyle = (lang) => (lang === "en" || !TTS_LANG_NAME[lang]
  ? "Read this aloud as a warm, confident Indian reel narrator. Natural pace, clear diction, friendly energy. Do not add any words of your own: "
  : `Read this aloud as a warm, confident ${TTS_LANG_NAME[lang]} ad narrator speaking to an Indian family. Speak it as a native ${TTS_LANG_NAME[lang]} speaker would, natural pace, clear pronunciation of every word, friendly energy, no English accent. Do not add any words of your own: `);

async function ttsOnce(text, name, model = process.env.TTS_MODEL || "gemini-2.5-flash-preview-tts") {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: name } } } },
    }),
    signal: AbortSignal.timeout(T_TTS),
  });
  const d = await r.json();
  return {
    b64: d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data,
    why: d?.error ? JSON.stringify(d.error).slice(0, 140) : d?.candidates?.[0]?.finishReason || "no audio",
  };
}

/** Devanagari and Latin letters in the same line — i.e. ordinary Hinglish ad
 *  copy like "Wellwa Aura से बदलिए रोज़ का पानी।" */
const mixedScript = (s) => /[ऀ-ॿ]/.test(s) && /[A-Za-z]/.test(s);

async function ttsLine(text, outWav, voice = "warm", lang = "", glossary = null, model = undefined) {
  const name = VOICES[voice] || VOICES.warm;
  // Indian-language lines go to TTS in their own script (see tts-script.mjs):
  // avoids the random "OTHER" refusals on Roman Hinglish and fixes pronunciation.
  const original = text;
  text = await nativeScript(text, lang, GEMINI, glossary);
  // Verified against the live API: the English style preamble in front of a
  // mixed Devanagari+Latin line makes TTS return finishReason:"OTHER" with no
  // audio, every time — the same line without the preamble narrates fine. So
  // Hinglish lines skip the preamble, and the remaining attempts cover the
  // occasional transient refusal on everything else.
  const styled = mixedScript(text) ? text : ttsStyle(lang) + text;
  const tries = [
    () => ttsOnce(styled, name, model),
    () => ttsOnce(styled, name, model),
    () => ttsOnce(text, name, model),
    () => ttsOnce(original, name, model),
    () => ttsOnce(original, VOICES.warm, model),
  ];
  let why = "";
  let b64;
  for (let i = 0; i < tries.length && !b64; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1200));
    ({ b64, why } = await tries[i]());
  }
  if (!b64) throw new Error("TTS failed: " + why);
  const pcm = Buffer.from(b64, "base64");
  writeFileSync(outWav, Buffer.concat([wavHeader(pcm.length), pcm]));
  return pcm.length / (24000 * 2);   // seconds
}

/** Split a script into spoken lines (one per scene). */
function lines(script) {
  const out = String(script)
    .split(/(?<=[.!?।])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
  return out.length ? out.slice(0, 5) : [String(script).trim()];
}

/* ---------------- AI scene prompts from the script ---------------- */
async function scenePrompts(script, beats = [], n = 2, guidance = "") {
  const fallback = Array.from({ length: n }, (_, i) =>
    `Cinematic commercial shot ${i + 1} for: ${(beats[i] || script).slice(0, 160)} — premium look, soft light, photorealistic, vertical 9:16, no text on screen.`);
  if (!GEMINI) return fallback;
  try {
    const beatList = beats.length
      ? `\n\nThe spoken lines (shot N plays while line N is heard, so shot N must match line N's meaning):\n${beats.slice(0, n).map((b, i) => `${i + 1}. ${b}`).join("\n")}`
      : "";
    const owner = guidance ? `\n\nTHE OWNER'S OWN DIRECTION — follow it above everything else:\n${guidance}` : "";
    const text = await geminiText(`Write exactly ${n} video-generation prompts (English, one per line, no numbering) for a vertical 9:16 Indian small-business promo reel about: "${script.slice(0, 300)}".${beatList}${owner}\n\nEach: one cinematic live-action scene with real people in a real Indian home, photorealistic, specific camera move and lighting, warm and aspirational — never cartoonish, never comedic. End each with "no text on screen". If the product appears, keep exact geometry, single spout, thin pipes.`, 200 * n);
    const lines = text.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter((l) => l.length > 40).slice(0, n);
    return lines.length === n ? lines : fallback;
  } catch { return fallback; }
}

/* ---------------- AI scene photos ----------------
 * Photoreal stills + Ken Burns motion is the sweet spot: ~1/4 the cost of
 * generated video, and on a phone screen a slow push across a real-looking
 * photo reads almost the same as footage. */
async function scenePhotoPrompts(script, beats, n, guidance = "") {
  const fallback = Array.from({ length: n }, (_, i) =>
    `Photorealistic cinematic vertical 9:16 photograph illustrating: ${script.slice(0, 140)} (angle ${i + 1}), Indian setting, warm natural light, shallow depth of field, premium advertising photography, no text, no watermark.`);
  if (!GEMINI) return fallback;
  try {
    const owner = guidance ? `\n\nTHE OWNER'S OWN DIRECTION — follow it above everything else:\n${guidance}\n` : "";
    const text = await geminiText(`${owner}A reel voiceover has ${n} spoken lines. Write exactly ${n} image-generation prompts (English, ONE per line, no numbering) — prompt N is the picture shown WHILE line N is being spoken, so prompt N must visually express line N's exact meaning (its mood too: a line about losing health looks unhealthy/exhausted, a line about gaining wealth looks prosperous).\n\nThe spoken lines:\n${beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\nEach prompt: one photorealistic vertical 9:16 photograph, an Indian setting with real people where people make sense, specific lighting and camera framing, premium advertising photography. Each must end with "no text, no watermark". Consecutive shots of one story, not the same shot repeated.`, 700);
    const lines = text.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter((l) => l.length > 40).slice(0, n);
    return lines.length === n ? lines : fallback;
  } catch { return fallback; }
}

/** Reference photos (the owner's own face, the real product) downloaded once
 *  and reused for every scene, so the same subject appears throughout. */
async function loadRefs(urls) {
  const out = [];
  for (const u of (urls ?? []).slice(0, 4)) {
    const buf = await fetchPhoto(u);
    if (!buf) continue;
    try {
      // Normalise: Gemini takes JPEG happily and this caps the payload size.
      const jpg = await sharp(buf).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      out.push({ inlineData: { mimeType: "image/jpeg", data: jpg.toString("base64") } });
    } catch { /* skip an unreadable reference */ }
  }
  return out;
}

async function scenePhoto(prompt, outFile, refs = []) {
  // Reference images first, prompt last — Gemini reads the trailing text as the
  // instruction acting on the images above it.
  const parts = [...refs, { text: refs.length
    ? `${prompt}\n\nIMPORTANT: use the reference image(s) above — keep the same person's face and the same product exactly as shown. Do not invent a different face or a different machine.`
    : prompt }];
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
    }),
    signal: AbortSignal.timeout(T_IMAGE),
  });
  const d = await r.json();
  const part = (d?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData);
  if (!part) throw new Error("image gen failed: " + JSON.stringify(d?.error ?? d).slice(0, 140));
  await sharp(Buffer.from(part.inlineData.data, "base64")).resize(1080, 1920, { fit: "cover" }).jpeg({ quality: 88 }).toFile(outFile);
}

/* ---------------- free stock clips (Pexels) ----------------
 * Multi-candidate + AI rerank instead of one-keyword-one-search: for each
 * beat we search 3 differently-angled phrases, pool the results, and let
 * Gemini pick the clip whose actual content best matches the spoken line
 * (using Pexels' descriptive URL slug — no extra image download needed). */
async function stockKeywords(beats) {
  const fallback = beats.map(() => ["clean drinking water glass"]);
  if (!GEMINI) return fallback;
  try {
    const text = await geminiText(`For each spoken reel line below, give 3 different English stock-video search phrases (2-4 words each) that could visually match that line's meaning and mood — vary the angle (one literal, one emotional/mood, one action-based). One beat per line, its 3 phrases separated by " | ", same order as the beats, no numbering, nothing else.\n\n${beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}`, 500);
    const lines = text.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).slice(0, beats.length);
    const parsed = lines.map((l) => l.split("|").map((p) => p.trim()).filter(Boolean));
    return parsed.length === beats.length && parsed.every((p) => p.length) ? parsed : fallback;
  } catch { return fallback; }
}

/** Pexels auto-generates page URLs from a description, e.g. .../video/a-woman-drinking-water-1234/ */
function pexelsSlug(url) {
  const m = String(url || "").match(/\/video\/([a-z0-9-]+)-\d+\/?$/i);
  return m ? m[1].replace(/-/g, " ") : "";
}

async function pexelsSearchOne(query, usedIds) {
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`, {
    headers: { Authorization: PEXELS },
    signal: AbortSignal.timeout(T_JSON),
  });
  const d = await r.json();
  return (d?.videos ?? [])
    .filter((v) => !usedIds.has(v.id))
    .map((v) => ({
      id: v.id,
      slug: pexelsSlug(v.url) || query,
      // the portrait file CLOSEST to our 1920-tall delivery size — picking the
      // smallest one above 1280 meant shipping an upscaled 720p clip inside a
      // 1080p reel. Anything over 2160 is a needless download.
      file: (v.video_files ?? [])
        .filter((f) => f.height >= 1280 && f.height <= 2160 && f.width < f.height && /mp4/.test(f.file_type ?? "mp4"))
        .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920))[0],
    }))
    .filter((c) => c.file);
}

/** Search all given phrases for one beat, pool candidates, let Gemini rank them against the line. */
async function stockClip(phrases, line, outFile, usedIds) {
  const pools = await Promise.all(phrases.map((q) => pexelsSearchOne(q, usedIds).catch(() => [])));
  const seen = new Set();
  const pool = pools.flat().filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).slice(0, 10);
  if (!pool.length) return false;

  let order = pool.map((_, i) => i);
  if (GEMINI && pool.length > 1) {
    try {
      const list = pool.map((c, i) => `${i}. ${c.slug}`).join("\n");
      const text = await geminiText(`Spoken reel line: "${line}"\n\nCandidate stock-video descriptions:\n${list}\n\nReply with ONLY the candidate numbers, best match first, comma-separated (e.g. "2,0,1") — pick the one whose visual content and mood best fits the line.`, 60);
      const ranked = text.match(/\d+/g)?.map(Number).filter((n) => n >= 0 && n < pool.length) ?? [];
      if (ranked.length) order = [...new Set([...ranked, ...order])];
    } catch { /* keep Pexels' own relevance order */ }
  }

  for (const i of order) {
    const c = pool[i];
    try {
      const res = await fetch(c.file.link, { signal: AbortSignal.timeout(T_MEDIA) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 60 * 1024 * 1024) continue;
      writeFileSync(outFile, buf);
      usedIds.add(c.id);
      return true;
    } catch { continue; }
  }
  return false;
}

/** Remix: scene i is kept — download its saved asset instead of regenerating. */
async function reuseScene(inp, i, outFile) {
  const keep = inp.reuseScenes?.find((x) => x.i === i);
  if (!keep || inp.changes?.[i] !== undefined) return false;
  try {
    const r = await fetch(keep.url, { signal: AbortSignal.timeout(T_MEDIA) });
    if (!r.ok) return false;
    writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch { return false; }
}

/* ---------------- providers ---------------- */
const VEO_CLIP_SEC = 8;

async function veoClip(prompt, outFile, refs = []) {
  // referenceImages (max 3, type "asset") keep the owner's real product and
  // face in frame instead of Veo inventing a machine. Duration must be 8s
  // whenever reference images are supplied.
  const instance = { prompt };
  // durationSeconds is always sent explicitly (as a NUMBER — a string is
  // rejected) so VEO_CLIP_SEC below is guaranteed to match the real clip
  // length; guessing it is what once cut a paid render off mid-sentence.
  const params = {
    aspectRatio: "9:16",
    durationSeconds: VEO_CLIP_SEC,
    // Verified against the live API: plain text-to-video only accepts
    // "allow_all" — "allow_adult" is rejected outright without a reference
    // image. It becomes valid again once a reference image is attached below.
    personGeneration: refs.length ? "allow_adult" : "allow_all",
  };
  // Veo rejects a negative prompt outright once reference images are attached,
  // so it can only be sent on the plain text-to-video path.
  if (!refs.length) params.negativePrompt = "text, captions, watermark, extra pipes, thick hose";
  if (refs.length) {
    // Verified against the live API: Veo wants `bytesBase64Encoded` here —
    // `inlineData` (the shape the text models use) is rejected outright.
    instance.referenceImages = refs.slice(0, 3).map((r) => ({
      image: { bytesBase64Encoded: r.inlineData.data, mimeType: r.inlineData.mimeType },
      referenceType: "asset",
    }));
  }
  // 429s are Tier-1 per-minute rate limiting, not a hard failure — a bursty
  // few minutes of testing/remixing shouldn't cost the owner a paid job that
  // would have gone through fine 30 seconds later. Real errors (bad prompt,
  // safety block) come back with a different status and fail immediately.
  let start;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning", {
      method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [instance], parameters: params }),
      signal: AbortSignal.timeout(T_SUBMIT),
    });
    start = await res.json();
    if (start.name || res.status !== 429 || attempt >= 3) break;
    console.error(`[media] veo rate-limited, retrying in 30s (attempt ${attempt + 1}/3)`);
    await new Promise((r) => setTimeout(r, 30000));
  }
  if (!start.name) throw new Error("Veo start failed: " + JSON.stringify(start.error ?? start).slice(0, 150));
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    const op = await fetch(`https://generativelanguage.googleapis.com/v1beta/${start.name}`, { headers: { "x-goog-api-key": GEMINI }, signal: AbortSignal.timeout(T_JSON) }).then((r) => r.json());
    if (op.done) {
      if (op.error) throw new Error("Veo failed: " + JSON.stringify(op.error).slice(0, 150));
      const gen = op.response?.generateVideoResponse ?? {};
      const uri = gen.generatedSamples?.[0]?.video?.uri;
      if (!uri) {
        // Veo reports a safety block as a *successful* operation carrying no
        // sample, so the reason has to be dug out of the response — a bare
        // "no video" tells nobody anything when a 400-credit job dies on it.
        const why = [gen.raiMediaFilteredReasons, op.response?.raiMediaFilteredReasons]
          .flat().filter(Boolean).join("; ")
          || JSON.stringify(op.response ?? op).slice(0, 200);
        const err = new Error("Veo returned no video: " + why);
        err.veoFiltered = true;
        throw err;
      }
      const vid = await fetch(uri, { headers: { "x-goog-api-key": GEMINI }, signal: AbortSignal.timeout(T_MEDIA) });
      writeFileSync(outFile, Buffer.from(await vid.arrayBuffer()));
      return;
    }
  }
  throw new Error("Veo timed out");
}

async function klingClip(prompt, outFile) {
  const create = await fetch(`https://api.replicate.com/v1/models/${KLING_MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REPLICATE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { prompt, aspect_ratio: "9:16", duration: 5 } }),
    signal: AbortSignal.timeout(T_SUBMIT),
  }).then((r) => r.json());
  if (!create.id) throw new Error("Kling start failed: " + JSON.stringify(create).slice(0, 150));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const p = await fetch(`https://api.replicate.com/v1/predictions/${create.id}`, {
      headers: { Authorization: `Bearer ${REPLICATE}` },
      signal: AbortSignal.timeout(T_JSON),
    }).then((r) => r.json());
    if (p.status === "succeeded") {
      const url = Array.isArray(p.output) ? p.output[0] : p.output;
      if (!url) throw new Error("Kling: no output url");
      const vid = await fetch(url, { signal: AbortSignal.timeout(T_MEDIA) });
      writeFileSync(outFile, Buffer.from(await vid.arrayBuffer()));
      return;
    }
    if (p.status === "failed" || p.status === "canceled") throw new Error("Kling failed: " + String(p.error).slice(0, 150));
  }
  throw new Error("Kling timed out");
}

/* ---------------- assembly ---------------- */
async function assemble(dir, { clips, cards, closing = [], photos = [], voWav, voSec, durations, brand, motion = true, clipSec = 5, music = null }) {
  // Normalize every visual to 1080x1920@30 (what Reels/Status/Shorts expect and
  // what Veo already returns); fades between; voice over a real music bed, or
  // over silence — never over a synthesised drone.
  const W = 1080, H = 1920;
  const parts = [];
  // `cards` is only ever non-empty on the basic tier (its own opening title +
  // per-line cards) — everything else starts straight on the first generated
  // shot. `closing` (the outro/CTA card) always goes at the true end,
  // regardless of tier — it must never be inferred from array position, which
  // is what previously sent the outro to the FRONT on tiers with no opening
  // cards (cards = [outro] alone looked identical to cards = [title]).
  const [titleCard, ...restCards] = cards;
  if (titleCard) parts.push({ type: "image", file: titleCard, dur: 0 });
  for (const c of clips) parts.push({ type: "video", file: c, dur: clipSec });
  for (const c of photos) parts.push({ type: "photo", file: c, dur: 0 });
  for (const c of restCards) parts.push({ type: "image", file: c, dur: 0 });
  for (const c of closing) parts.push({ type: "image", file: c, dur: 0 });
  // Voice-locked timing: each still shows for exactly as long as the line it
  // narrates (plus a breath), so picture and voice never drift apart.
  const stills = parts.filter((p) => p.type !== "video");
  if (durations && durations.length) {
    stills.forEach((p, i) => { p.dur = Math.max(2.0, (durations[i] ?? 3.0) + 0.45); });
  } else {
    const fallback = Math.max(2.6, ((voSec || 14) + 2.5) / Math.max(1, stills.length));
    stills.forEach((p) => { p.dur = fallback; });
  }
  const XF = 0.3;                         // crossfade between two parts
  const span = () => parts.reduce((a, p) => a + p.dur, 0) - XF * Math.max(0, parts.length - 1);
  // Generated clips have a fixed length, so on the video tiers the picture can
  // run out before the voice does. Hold the closing card until the last word.
  if (voSec && span() < voSec + 1.2) {
    const tail = parts[parts.length - 1];
    if (tail) tail.dur += voSec + 1.2 - span();
  }
  const total = span();

  // ---- 1. every part is rendered on its OWN, one ffmpeg at a time ----
  // This used to be a single filter graph with all five branches live at once.
  // Measured on the VPS with these same fixtures: that graph peaks at 817 MB of
  // RSS at the old 720 x 1280 / 24fps and 1.2-1.6 GB at 1080x1920/30 — against the
  // 900 MB cgroup cap ffmpeg() runs under. In other words the old path was
  // already being OOM-killed on longer scripts, and the bigger picture could
  // never have fitted. One part per pass keeps the peak flat no matter how
  // many scenes or how long the script is.
  const partFiles = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const f = path.join(dir, `part${i}.mp4`);
    const secs = p.dur.toFixed(2);
    const input = p.type === "video" ? `-t ${secs} -i ${p.file}` : `-loop 1 -t ${secs} -i ${p.file}`;
    // Every branch ends in yuv420p: a PNG card decodes to RGBA, 2.7x the bytes.
    const chain = (p.type === "photo" && motion)
      // slow push-in, alternating direction so consecutive shots differ.
      // zoompan crops on whole pixels, so it runs on a larger frame and
      // downsamples to W x H — otherwise the picture shimmers as it moves.
      ? `[0:v]scale=${Math.round(W * 1.5)}:${Math.round(H * 1.5)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.5)}:${Math.round(H * 1.5)},zoompan=z='${i % 2 === 0 ? `min(zoom+0.0009,1.14)` : `if(eq(on,1),1.14,max(zoom-0.0009,1.0))`}':d=${Math.round(p.dur * FPS)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v]`
      // A generated clip that came back SHORTER than its slot would leave the
      // fold below asking xfade for an offset past the end of the file, which
      // is a hard error. Holding the last frame costs nothing and cannot fail.
      : `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}${p.type === "video" ? `,tpad=stop_mode=clone:stop_duration=${secs}` : ""},format=yuv420p[v]`;
    await ffmpeg(`${input} -filter_complex "${chain}" -map "[v]" -an -t ${secs} -r ${FPS} ${INTERMEDIATE.join(" ")} ${f}`, 5 * 60_000);
    partFiles.push(f);
  }

  // ---- 2. fold them together two at a time, from the END backwards ----
  // Backwards on purpose. xfade holds its SECOND input's frames in memory
  // until the transition point, so folding front-to-back makes every offset —
  // and every buffer — grow with the length of the video: measured at 1.3 GB
  // by the last fold, against a 900 MB cap. Folded from the end, every offset
  // is just one part's own length, so the memory stays flat however long the
  // script is. The crossfades land at exactly the same moments either way.
  const lastPart = partFiles[partFiles.length - 1];
  let reel = lastPart;
  for (let i = parts.length - 2; i >= 0; i--) {
    const next = path.join(dir, `fold${i}.mp4`);
    await ffmpeg(
      `-i ${partFiles[i]} -i ${reel} -filter_complex "[0:v][1:v]xfade=transition=fade:duration=${XF}:offset=${(parts[i].dur - XF).toFixed(2)}[v]" ` +
      `-map "[v]" -an -r ${FPS} ${INTERMEDIATE.join(" ")} ${next}`, 6 * 60_000);
    if (reel !== lastPart) rmSync(reel, { force: true });   // /tmp is small; keep only what is still needed
    rmSync(partFiles[i], { force: true });
    reel = next;
  }
  if (reel !== lastPart) rmSync(lastPart, { force: true });   // a one-part reel IS lastPart

  // ---- 3. the soundtrack, on its own ----
  // Audio and video in one pass is what actually blew the memory cap: while
  // loudnorm + sidechaincompress chew through the mix, ffmpeg reads ahead on
  // the video and piles up 1080x1920 frames (measured: 1343 MB against a
  // 900 MB cap; the same render with a simple audio chain peaked at 737 MB).
  // Mastering the sound first and copying it into the picture keeps both
  // passes small.
  const voIdx = 0;
  const bedIdx = voWav ? 1 : 0;
  const voIn = voWav ? `-i ${voWav} ` : "";
  const bedIn = music
    // the music path comes from the checkout, which may contain a space
    ? `-stream_loop -1 -t ${total.toFixed(2)} -i ${shq(music)} `
    : `-f lavfi -t ${total.toFixed(2)} -i anullsrc=r=48000:cl=stereo `;
  const fadeAt = Math.max(0.1, total - 1.6).toFixed(2);
  const mix = `amix=inputs=2:duration=first:normalize=0,afade=t=out:st=${fadeAt}:d=1.6,${MASTER_AF}[aout]`;
  let audio;
  if (voWav && music) {
    // the bed ducks under every spoken word instead of fighting it. apad keeps
    // the voice leg alive to the end of the picture, or the mix stops the
    // moment the last word does and the video plays out in silence — and
    // whole_dur, never a bare apad: an endless pad made ffmpeg buffer until
    // the 900 MB cap killed it.
    audio = `[${voIdx}:a]adelay=300|300,apad=whole_dur=${total.toFixed(2)},aresample=48000,asplit=2[vo1][vo2];`
      + `[${bedIdx}:a]volume=0.32,afade=t=out:st=${fadeAt}:d=1.6[bg];`
      + `[bg][vo1]sidechaincompress=threshold=0.05:ratio=8:attack=40:release=500:makeup=1[bgd];`
      + `[bgd][vo2]${mix}`;
  } else if (voWav) {
    // no music chosen (or none installed) → the voice over silence. Silence is
    // more professional than a synthesised two-note drone.
    audio = `[${voIdx}:a]adelay=300|300,apad=whole_dur=${total.toFixed(2)},aresample=48000[vo];[${bedIdx}:a]anull[bg];[bg][vo]${mix}`;
  } else if (music) {
    audio = `[${bedIdx}:a]volume=0.5,afade=t=out:st=${fadeAt}:d=1.6,${MASTER_AF}[aout]`;
  } else {
    audio = `[${bedIdx}:a]anull[aout]`;   // a silent track, not a missing one — some players need it
  }
  const aud = path.join(dir, "mix.m4a");
  writeFileSync(path.join(dir, "afilter.txt"), audio);
  await ffmpeg(`${voIn}${bedIn}-filter_complex_script ${path.join(dir, "afilter.txt")} -map "[aout]" -vn -t ${total.toFixed(2)} ${DELIVERY_A.join(" ")} ${aud}`, 5 * 60_000);

  // ---- 4. brand watermark + the ONE delivery encode ----
  const wmFile = path.join(dir, "wm.png");
  // No brand name on file → draw nothing rather than an empty badge.
  const wmSvg = brand
    ? `<svg width="${W}" height="90" xmlns="http://www.w3.org/2000/svg"><text x="${W / 2}" y="60" text-anchor="middle" font-family="${fam(brand)}" font-weight="700" font-size="36" letter-spacing="${track(brand, 6)}" fill="#ffffff" fill-opacity="0.78">${brand.replace(/&/g, "&amp;").replace(/</g, "&lt;").toUpperCase()}</text></svg>`
    : `<svg width="${W}" height="90" xmlns="http://www.w3.org/2000/svg"></svg>`;
  await sharp(Buffer.from(wmSvg)).png().toFile(wmFile);
  // The mark is a SINGLE frame (no -loop): overlay repeats it to the end by
  // itself, where looping it meant buffering one more full-length stream.
  // It sits clear of the WhatsApp Status progress bar and the sender's name.
  const out = path.join(dir, "reel.mp4");
  await ffmpeg(
    `-i ${reel} -i ${wmFile} -i ${aud} ` +
    `-filter_complex "[0:v][1:v]overlay=(main_w-overlay_w)/2:${SAFE.top(H)}:eof_action=repeat[vfin]" ` +
    `-map "[vfin]" -map 2:a -c:a copy -t ${total.toFixed(2)} -r ${FPS} ${DELIVERY_V.join(" ")} ${out}`,
  );
  rmSync(reel, { force: true });
  rmSync(aud, { force: true });
  return out;
}

/* ---------------- music ---------------- */
const MUSIC_DIR = path.join(__dirname, "music");
/** Path to a chosen music bed, or null. A missing file is shouted about: an
 *  empty bridge/music/ used to turn every "with music" order into silence
 *  with nothing in the log to show for it. */
function musicFile(key) {
  const k = String(key ?? "").trim();
  if (!k || !/^[a-z0-9-]+$/i.test(k)) return null;
  const f = path.join(MUSIC_DIR, `${k}.mp3`);
  if (existsSync(f)) return f;
  console.error(`[media] MUSIC MISSING: ${f} does not exist — this video ships with NO music bed. Put the six .mp3 files in bridge/music/.`);
  return null;
}

/* ---------------- job processing ---------------- */
async function refund(job) {
  try {
    // An EDIT of a finished long video runs under the same job id with cost = the edit's credits; its refund gets
    // its own reference, or the ledger's (reason, ref) uniqueness would swallow it after an earlier refund.
    const editN = job.kind === "explainer" ? Number(job.input?.edit?.n) || 0 : 0;
    const r = await sb(`/rest/v1/rpc/grant_credits`, {
      method: "POST",
      body: JSON.stringify({ p_user: job.owner_id, p_amount: job.cost, p_reason: editN ? "explainer-edit-refund" : job.kind === "ad" ? "ad-refund" : "reel-refund", p_ref: editN ? `${job.id}:edit:${editN}` : job.id }),
    });
    if (!r.ok) console.error("[media] refund failed", job.id, job.owner_id, job.cost, await r.text().catch(() => ""));
  } catch (e) {
    console.error("[media] refund threw", job.id, job.owner_id, job.cost, e?.message ?? e);
  }
}

/** Record that this job has reached a paid outside call (Veo / Kling / fal /
 *  AI image). A cancel after this point refunds cost - spent_credits, so the
 *  owner is never handed back money we have already given away — and a job
 *  that never reaches a paid call keeps spent_credits = 0 and refunds in full.
 *  Coarse on purpose: one flag per job, written once, before the money moves.
 *
 *  It is also the ONLY place a cancelled render is noticed. The PATCH is guarded
 *  with status=eq.running, so when the owner has already tapped Stop it matches
 *  no row — and we throw here, BEFORE the Veo/Kling/fal/image call, instead of
 *  buying clips for a job that was refunded in full a second ago. The catch in
 *  the caller is status-guarded too, so it neither refunds twice nor resurrects
 *  the cancelled row. A PATCH that errors outright (migration 0051 not run yet)
 *  only logs: a missing column must never stop a paid render the owner is owed. */
function spendMarker(job) {
  let marked = false;
  return async () => {
    const cost = Number(job.cost) || 0;
    if (marked || cost <= 0) return;
    marked = true;
    let cancelled = false;
    try {
      const r = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ spent_credits: cost, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) console.error("[media] spend marker failed", job.id, (await r.text().catch(() => "")).slice(0, 160));
      else cancelled = ((await r.json().catch(() => [])) || []).length === 0;
    } catch (e) { console.error("[media] spend marker threw", job.id, e?.message ?? e); }
    if (cancelled) throw new Error("Cancelled by user");
  };
}

async function processJob(job) {
  const dir = path.join(os.tmpdir(), `reel-${job.id}`);
  const markSpent = spendMarker(job);
  mkdirSync(dir, { recursive: true });
  try {
    const inp = job.input || {};
    const script = String(inp.script || "");
    // Shubhora is our own SaaS name, never the customer's — it must never
    // appear on a paid render just because the owner left this field blank.
    const brand = String(inp.brandName || "").slice(0, 30);
    const website = String(inp.website || "");
    const tier = inp.tier || "basic";

    // 1. voiceover — one file per spoken line (drives scene timing)
    const beatsText = lines(script);
    let voWav = null, voSec = 0, durations = [];
    if (inp.voice !== false && GEMINI) {
      const parts_ = [];
      for (let i = 0; i < beatsText.length; i++) {
        const f = path.join(dir, `vo${i}.wav`);
        durations.push(await ttsLine(beatsText[i], f, inp.voiceStyle || "warm", inp.lang));
        parts_.push(f);
      }
      // join with a short breath after each line
      voWav = path.join(dir, "vo.wav");
      const ins = parts_.map((f) => `-i ${f}`).join(" ");
      const chain = parts_.map((_, i) => `[${i}:a]apad=pad_dur=0.45[p${i}]`).join(";");
      const cat = parts_.map((_, i) => `[p${i}]`).join("") + `concat=n=${parts_.length}:v=0:a=1[out]`;
      await ffmpeg(`${ins} -filter_complex "${chain};${cat}" -map "[out]" ${voWav}`, 120_000);
      voSec = durations.reduce((a, b) => a + b, 0) + 0.45 * durations.length;
      // the title card gets its own slot before the narrated lines
      durations = [Math.max(1.8, durations[0] * 0.6), ...durations];
    }

    // 2. AI scenes
    const clips = [];
    let clipSec = 5;                 // real length of each generated clip
    const scenePhotos = [];
    if (tier === "stock") {
      if (!PEXELS) throw new Error("Stock tier configure nahi hai");
      const kws = await stockKeywords(beatsText);
      const usedIds = new Set();
      for (let i = 0; i < beatsText.length; i++) {
        const f = path.join(dir, `stock${i}.mp4`);
        try {
          const kept = await reuseScene(inp, i, f);          // remix: keep untouched scenes
          const want = String(inp.changes?.[i] ?? "").trim();
          const phrases = want ? [want] : kws[i];
          const line = want || beatsText[i];
          if (kept) clips.push(f);
          else if (await stockClip(phrases, line, f, usedIds)) clips.push(f);
          else if (await stockClip(["clean water nature"], line, f, usedIds)) clips.push(f);
        } catch (e) { console.error("[media] stock", i, e?.message ?? e); }
      }
      if (!clips.length) throw new Error("Stock clips nahi mili — script badal kar try karein");
    }
    if (tier === "photos") {
      const n = Math.min(4, Math.max(2, beatsText.length));
      // An owner-approved plan wins over anything the AI would invent here.
      const approved = (inp.scenePlan ?? []).map((s) => s?.visual).filter(Boolean);
      const prompts = approved.length >= n
        ? approved.slice(0, n)
        : await scenePhotoPrompts(script, beatsText.slice(0, n), n, inp.guidance || "");
      const refs = await loadRefs(inp.refImages);
      if (refs.length) console.log(`[media] using ${refs.length} reference photo(s)`);
      for (let i = 0; i < n; i++) {
        const f = path.join(dir, `photo${i}.jpg`);
        try {
          const kept = await reuseScene(inp, i, f);
          if (kept) { scenePhotos.push(f); continue; }
          const want = String(inp.changes?.[i] ?? "").trim();
          const prompt = want
            ? `Photorealistic cinematic vertical 9:16 photograph: ${want}. Indian setting, premium advertising photography, no text, no watermark.`
            : prompts[i];
          await markSpent();                                // paid image generation starts here
          await scenePhoto(prompt, f, refs); scenePhotos.push(f);
        } catch (e) { console.error("[media] photo", i, e?.message ?? e); }
      }
      if (!scenePhotos.length) throw new Error("AI photos generate nahi ho payi");
    }
    if (tier === "veo" || tier === "kling") {
      const refs = await loadRefs(inp.refImages);
      // Each generated clip is a fixed length, so the clip COUNT has to cover
      // the voiceover — otherwise the picture ends mid-sentence. Capped at 4
      // because every extra clip is real money.
      clipSec = tier === "veo" ? VEO_CLIP_SEC : 5;
      const need = Math.min(4, Math.max(2, Math.ceil((voSec || 16) / clipSec)));
      const approved = (inp.scenePlan ?? []).map((s) => s?.visual).filter(Boolean);
      const prompts = approved.length >= need
        ? approved.slice(0, need)
        : await scenePrompts(script, beatsText, need, inp.guidance || "");
      console.log(`[media] ${tier}: voice ${Math.round(voSec)}s → ${need} clip(s) × ${clipSec}s${refs.length ? `, ${refs.length} ref photo(s)` : ""}`);
      for (let i = 0; i < need; i++) {
        const f = path.join(dir, `clip${i}.mp4`);
        // Remix: a generated clip costs real money, so never re-render one the
        // owner did not ask to change — reuse the saved file instead.
        if (await reuseScene(inp, i, f)) { clips.push(f); continue; }
        const want = String(inp.changes?.[i] ?? "").trim();
        let prompt = want
          ? `Cinematic live-action vertical 9:16 shot: ${want}. Real people, real Indian setting, photorealistic, warm and aspirational, no text on screen.`
          : prompts[i];
        if (tier === "veo") {
          // The voiceover is dubbed on separately, so a face that appears to
          // be talking on screen — a common Veo default — reads as a glitch
          // once it's out of sync with the real audio.
          prompt += " Nobody on screen is speaking or moving their lips — calm, natural, silent expressions.";
          if (refs.length) {
            // Each clip is an independent generation from the same reference
            // photo, so without this Veo is free to redesign the product (or
            // add a second one) in every new shot instead of keeping it identical.
            prompt += " The product shown must look exactly like the one in the reference photo — same device, same colour, same design, in every shot. Never show a second or different unit.";
          }
        }
        try {
          await markSpent();                                // paid clip generation starts here
          if (tier === "veo") {
            try {
              await veoClip(prompt, f, refs);
            } catch (e) {
              // A reference photo of a real person is the most common thing
              // Veo's safety filter blocks, and the same prompt almost always
              // renders without it. Losing the likeness beats losing the clip.
              if (!refs.length || !e?.veoFiltered) throw e;
              console.error(`[media] veo clip ${i} filtered — retrying without reference photos: ${e.message}`);
              await veoClip(prompt, f, []);
            }
          } else await klingClip(prompt, f);
          clips.push(f);
        } catch (e) {
          // One bad clip must not sink the whole paid render; assemble() holds
          // the last shot so the surviving clips still cover the voiceover.
          console.error(`[media] clip ${i} failed: ${e?.message ?? e}`);
        }
      }
      if (!clips.length) throw new Error("Video clips generate nahi ho payi — credits wapas kar diye");
    }

    // 3. cards — only the basic tier opens on a text card; a real ad starts on
    // the picture, so the visual tiers go straight into their first scene and
    // every shot then lines up with the line it narrates.
    const cards = [];
    const headline = String(inp.headline || wrap(script, 26)[0] || brand);
    const photo = await fetchPhoto(inp.photoUrl);
    if (tier === "basic") {
      const title = path.join(dir, "card0.png");
      await card(title, { title: headline, footer: brand, big: 76, photo, tone: 0 });
      cards.push(title);
      const parts = beats(script);
      for (let i = 0; i < parts.length; i++) {
        const f = path.join(dir, `card${i + 1}.png`);
        await card(f, { kicker: `${i + 1} / ${parts.length}`, title: "", lines: wrap(parts[i], 30).slice(0, 7), footer: brand, big: 0, tone: i + 1 });
        cards.push(f);
      }
    }
    // The end card belongs to the customer. Never our own domain (a paid ad
    // must not advertise us), and never an English call-to-action on a Hindi
    // ad — this is the same rule written a few lines above about brand names.
    const outro = path.join(dir, "outro.png");
    const phone = String(inp.phone || "").replace(/[^\d+\-\s]/g, "").trim();
    const cta = phone ? `${CTA_LABELS[inp.lang] ?? CTA_LABELS.en} ${phone}` : "";
    const outroTitle = brand || cta || website || "";
    const outroLines = [website, cta].filter((l) => l && l !== outroTitle);
    await card(outro, { title: outroTitle, lines: outroLines, footer: "", big: 66, tone: 2 });

    // 4. assemble + upload (retry without motion rather than waste paid scenes)
    const music = musicFile(inp.music);
    let out;
    try {
      out = await assemble(dir, { clips, cards, closing: [outro], photos: scenePhotos, voWav, voSec, durations, brand, clipSec, music, motion: true });
    } catch (e) {
      console.error("[media] motion pass failed, retrying flat:", e?.message ?? e);
      out = await assemble(dir, { clips, cards, closing: [outro], photos: scenePhotos, voWav, voSec, durations, brand, clipSec, music, motion: false });
    }
    const bytes = readFileSync(out);
    const key = `ai-media/${job.owner_id}/reel-${job.id}.mp4`;
    const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Cache-Control": "max-age=31536000", "Content-Type": "video/mp4", "x-upsert": "true" },
      body: bytes,
      signal: AbortSignal.timeout(T_MEDIA),
    });
    if (!up.ok) throw new Error("upload failed: " + (await up.text()).slice(0, 120));
    const url = `${SUPA_URL}/storage/v1/object/public/media/${key}?v=${Date.now()}`;

    // Save scene assets so the user can replace any single scene later.
    const sceneFiles = (tier === "stock") ? clips.map((f, i) => ({ f, i, kind: "clip", ext: "mp4", mime: "video/mp4" }))
      : scenePhotos.map((f, i) => ({ f, i, kind: "photo", ext: "jpg", mime: "image/jpeg" }));
    const scenes = [];
    for (const sc of sceneFiles) {
      try {
        const skey = `ai-media/${job.owner_id}/scenes/${job.id}-${sc.i}.${sc.ext}`;
        const sup = await fetch(`${SUPA_URL}/storage/v1/object/media/${skey}`, {
          method: "POST",
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Cache-Control": "max-age=31536000", "Content-Type": sc.mime, "x-upsert": "true" },
          body: readFileSync(sc.f),
          signal: AbortSignal.timeout(T_MEDIA),
        });
        if (sup.ok) scenes.push({ i: sc.i, kind: sc.kind, url: `${SUPA_URL}/storage/v1/object/public/media/${skey}`, line: beatsText[sc.i] ?? "" });
      } catch { /* scene save is best-effort */ }
    }
    const doneInput = { ...inp, scenes };
    delete doneInput.reuseScenes; delete doneInput.changes;

    // status=eq.running guards against a job the user cancelled (and was
    // already refunded) while this was mid-render — never overwrite that
    // with "done" and leave them refunded AND holding a finished video.
    await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done", stage: "done", progress: { text: "Done" }, output_url: url, input: doneInput, updated_at: new Date().toISOString() }),
    });
    console.log(`[media] done ${job.id} (${tier}, ${bytes.length} bytes)`);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error(`[media] FAILED ${job.id}:`, msg);
    // Same status=eq.running guard: if the user already cancelled this job
    // (which refunds immediately), don't refund a second time here.
    const patched = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "failed", error: msg, updated_at: new Date().toISOString() }),
    });
    const rows = await patched.json().catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) await refund(job);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The ad engines build argv arrays; the capped ffmpeg() helper takes a shell
// string with -y/-loglevel already prepended — adapt here (quote every arg).
const shq = (v) => `'${String(v).replace(/'/g, "'\\''")}'`;
const ffArr = (arr) => { const a = [...arr]; while (a.length && ["-y", "-loglevel", "error"].includes(a[0])) a.shift(); return ffmpeg(a.map(shq).join(" "), 12 * 60_000); };
/** Template-tier card sequence for n spoken lines: hook, rotating middle cards, cta. */
function templateKinds(n, hasOffer) {
  if (n <= 1) return ["cta"];
  const mid = hasOffer ? ["product", "features", "offer"] : ["product", "features"];
  const out = ["hook"];
  for (let i = 0; i < n - 2; i++) out.push(mid[i % mid.length]);
  out.push("cta");
  return out;
}

async function processAd(job) {
  const dir = path.join(os.tmpdir(), `ad-${job.id}`);
  const markSpent = spendMarker(job);
  // A real wait needs a real line to read. Every write is guarded by
  // status=eq.running so a job the owner already cancelled is never brought
  // back to life by a progress update. Never lets a render fail on its own.
  const prog = async (body) => { try { await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) }); } catch { /* progress is never worth failing a render for */ } };
  let adFailed = false;
  mkdirSync(dir, { recursive: true });
  try {
    const inp = job.input || {};
    const geminiJson = async (model, body) => { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(/image/i.test(String(model)) ? T_IMAGE : T_JSON) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; };
    const planScenes = Array.isArray(inp.scenes) && inp.scenes.length ? inp.scenes : null;
    let lines, voLines = [], voWav = null, presenterPhoto = null, variantLines = [];
    let kinds = ["hook", "product", "features", "offer", "cta"];
    await prog({ stage: "voice", progress: { text: "Recording the voice…" } });
    if (inp.tier === "presenter") {
      // One continuous monologue (not per-scene) → a single TTS pass, lip-synced
      // to a photo of the presenter instead of assembled from AI B-roll scenes.
      const monologue = (planScenes ? [...planScenes.map((s) => String(s.text || "").trim()), String(inp.cta || "").trim()] : (Array.isArray(inp.script) ? inp.script.map(String) : [])).filter(Boolean).join(" ").trim();
      if (!monologue) throw new Error("No script for presenter video");
      lines = [monologue];
      if (inp.voice === false) throw new Error("Voice-over is required for a presenter video");
      voWav = path.join(dir, "vo.wav");
      const monoSec = await ttsLine(monologue, voWav, inp.voiceStyle || "warm", inp.lang);
      voLines = [{ text: monologue, sec: monoSec, start: 0 }];
      presenterPhoto = await fetchPhoto(inp.presenterPhoto);
      if (!presenterPhoto) throw new Error("Presenter photo missing or could not be loaded");
    } else {
      // voice-over: one line per scene
      let captions = null;
      if (inp.tier === "testimonial") {
        // Two cards: the customer's own words, then the branded CTA — reuses
        // the template tier's Ken-Burns/xfade assembly with a custom kinds list.
        kinds = ["quote", "cta"];
        const tm = inp.testimonial || {};
        const quote = String(tm.text || "").trim();
        if (!quote) throw new Error("No testimonial text");
        const ctaLine = inp.phone
          ? { en: `Call or WhatsApp ${inp.phone} today!`, hi: `आज ही Call या WhatsApp करें ${inp.phone} पर!`, hinglish: `Aaj hi Call ya WhatsApp karein ${inp.phone} par!` }[inp.lang] ?? `Call or WhatsApp ${inp.phone} today!`
          : { en: `Join our happy customers!`, hi: `आप भी जुड़ें हमारे खुश ग्राहकों से!`, hinglish: `Aap bhi judein hamare khush customers se!` }[inp.lang] ?? `Join our happy customers!`;
        lines = [quote, ctaLine];
      } else {
        lines = planScenes ? [...planScenes.map((s) => String(s.text || "").trim()), String(inp.script?.[planScenes.length] || inp.cta || "").trim()].filter(Boolean)
          : (Array.isArray(inp.script) && inp.script.length ? inp.script : defaultScript(inp)).slice(0, 5).map((t) => String(t).trim()).filter(Boolean);
        if (!planScenes && inp.tier === "realistic" && lines.length > 4) lines = [lines[0], lines[1], lines[3], lines[4]]; // hook, product, offer, cta
        if (planScenes && inp.tier === "realistic") lines = [...lines.slice(0, Math.min(6, planScenes.length)), lines[lines.length - 1]].filter(Boolean);
        captions = planScenes ? planScenes.map((s) => String(s.caption_text || s.text || "")) : null;
        // One template card per spoken line (hook … cta), so a 10s ad doesn't end on
        // silent filler cards and a 60s ad doesn't get its last lines cut off.
        kinds = templateKinds(lines.length, Boolean(inp.offer));
      }
      const wordCaps = inp.captions !== "off"; // burnt-in word captions replace the baked scene caption strip
      const wavs = [];
      for (let i = 0; i < lines.length; i++) {
        const w = path.join(dir, `vo-${i}.wav`);
        let sec = 0;
        if (inp.voice !== false) { try { sec = await ttsLine(lines[i], w, inp.voiceStyle || "warm", inp.lang); wavs.push(w); } catch (e) { console.error("[ad] tts", e.message, "line:", JSON.stringify(lines[i]).slice(0, 160)); } }
        voLines.push({ text: lines[i], sec, caption: wordCaps ? "" : (captions?.[i] ?? lines[i]), visual: planScenes?.[i]?.visual, motion: planScenes?.[i]?.motion, wav: wavs.includes(w) ? w : null });
        await prog({ progress: { text: `Recording the voice (${i + 1} of ${lines.length})…` } });
      }
      // A line whose TTS failed used to be skipped silently: the ad still went
      // out as "done", charged in full, with a hole where the voice should be.
      // The owner asked for a voice — if we cannot record it, nobody is charged.
      if (inp.voice !== false) {
        const missing = voLines.filter((l) => !l.wav).length;
        if (missing) throw new Error("The voice could not be recorded — your credits are back.");
      }
      // scene i audio must start when scene i starts → pad each line to its scene duration; also gives caption timing
      const nClips = inp.tier === "realistic" ? Math.max(2, voLines.length - 1) : 0;
      const sceneDur = (l, i, n) => inp.tier === "realistic" ? (i < nClips ? 5 - (i < n - 1 ? 0.4 : 0) : Math.max(3, l.sec + 0.6)) : Math.max(2.2, l.sec + 0.5) - (i < n - 1 ? 0.3 : 0);
      const withStarts = (ls) => { let t = 0; return ls.map((l, i) => { const o = { ...l, start: t }; t += sceneDur(l, i, ls.length); return o; }); };
      const buildVo = async (ls, tag) => {
        const present = ls.filter((l) => l.wav);
        if (!present.length) return null;
        const out = path.join(dir, `vo${tag ? `-${tag}` : ""}.wav`);
        const args = ["-y", "-loglevel", "error"]; ls.forEach((l, i) => l.wav && args.push("-i", l.wav));
        let k = 0; const parts = ls.map((l, i) => l.wav ? `[${k++}:a]apad=whole_dur=${sceneDur(l, i, ls.length)}[a${i}]` : null).filter(Boolean);
        const labels = ls.map((l, i) => l.wav ? `[a${i}]` : null).filter(Boolean).join("");
        await ffArr([...args, "-filter_complex", `${parts.join(";")};${labels}concat=n=${present.length}:v=0:a=1[out]`, "-map", "[out]", out]);
        return out;
      };
      voLines = withStarts(voLines);
      voWav = await buildVo(voLines, "");
      // 3 variations: alternate hook line + rotated template + music (same scenes/clips → cheap)
      if (Number(inp.variants) === 3 && (inp.tier === "template" || inp.tier === "realistic") && inp.voice !== false && voLines.length) {
        try {
          const j = await geminiJson("gemini-3.5-flash-lite", { contents: [{ parts: [{ text: `Give 2 alternative opening hook lines for this ad, same language and script as the original, each max 14 words, different angles (question / bold claim / pain point). Original hook: "${voLines[0].text}". Product: ${inp.product || ""}. Return JSON {"hooks":["...","..."]}` }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: 200 } });
          const hooks = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").hooks ?? [];
          variantLines = [];
          for (let v = 0; v < 2 && hooks[v]; v++) {
            const w = path.join(dir, `vo-alt-${v}.wav`);
            const sec = await ttsLine(String(hooks[v]), w, inp.voiceStyle || "warm", inp.lang);
            const ls = withStarts([{ ...voLines[0], text: String(hooks[v]), sec, wav: w }, ...voLines.slice(1)]);
            variantLines.push({ lines: ls, voWav: await buildVo(ls, `v${v + 2}`) });
          }
        } catch (e) { console.error("[ad] variants", e.message); }
      }
    }
    const photos = []; for (const u of (Array.isArray(inp.photos) ? inp.photos.slice(0, 5) : [])) { const b = await fetchPhoto(u); if (b) photos.push(b); }
    const photo = photos[0] ?? null;
    const logo = inp.logoUrl ? await fetchPhoto(inp.logoUrl) : null;
    const music = musicFile(inp.music);
    // Every tier can ship in all three ratios: template/testimonial re-render per ratio (cheap);
    // realistic/presenter generate ONCE (first ratio) and the others are reframed from it.
    const reqFormats = (Array.isArray(inp.formats) ? inp.formats : ["reel"]).filter((f) => AD_FORMATS[f]);
    const formats = reqFormats.length ? reqFormats : ["reel"];
    const outputs = {};
    const TPL_ORDER = ["bold", "clean", "festive", "offer", "trust", "fresh"];
    const MUSIC_ORDER = ["upbeat-corporate", "inspiring-motivational", "indian-sitar", "festive-diwali", "calm-ambient", "energetic-promo"];
    const variants = [{ tag: "", lines: voLines, voWav, template: inp.template, musicKey: inp.music }];
    variantLines.forEach((v, i) => {
      const ti = (TPL_ORDER.indexOf(inp.template) + i + 1) % TPL_ORDER.length;
      const mi = (Math.max(0, MUSIC_ORDER.indexOf(inp.music)) + i + 1) % MUSIC_ORDER.length;
      variants.push({ tag: `-v${i + 2}`, lines: v.lines, voWav: v.voWav, template: TPL_ORDER[ti], musicKey: inp.music ? MUSIC_ORDER[mi] : "" });
    });
    const wordCaps = inp.captions !== "off";
    const upload = async (file, key) => {
      await prog({ stage: "upload", progress: { text: "Almost done…" } });
      const bytes = readFileSync(file);
      const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${key}`, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Cache-Control": "max-age=31536000", "Content-Type": "video/mp4", "x-upsert": "true" }, body: bytes, signal: AbortSignal.timeout(T_MEDIA) });
      if (!up.ok) throw new Error("upload failed: " + (await up.text()).slice(0, 120));
      console.log(`[ad] ${job.id} ${key.split("/").pop()} ${bytes.length} bytes`);
      // ?v= makes every upload its own URL, so the year-long edge cache can never show an older render of the same key.
      return `${SUPA_URL}/storage/v1/object/public/media/${key}?v=${Date.now()}`;
    };
    // The cues this variant will actually get. Computed up front because it decides who
    // performs the ONE delivery encode: the engine / the reframe (nothing follows) or
    // burnCaptions (it is the last pass). wordCues() drops empty and unspoken lines, so
    // asking it is the only honest test — a testimonial's cue list is often empty, and an
    // engine that then shipped its INTERMEDIATE concat would deliver a crf-14 baseline file.
    const cuesFor = (ls) => (wordCaps ? wordCues(inp.tier === "testimonial" ? (ls ?? []).slice(1) : (ls ?? [])) : []); // the quote card already shows the customer's words
    const willCaption = (ls) => cuesFor(ls).length > 0;
    const captioned = async (file, fmt, ls, tag) => {
      const cueList = cuesFor(ls);
      if (!cueList.length) return file;
      await prog({ stage: "captions", progress: { text: "Adding captions…" } });
      const { w: W, h: H } = AD_FORMATS[fmt];
      // Reels keep the captions above Instagram's 0.22 H strip; a square post or a wide video has no
      // chrome there, so the band sits lower (0.14 H) and stays clear of the product title at 0.58 H.
      const cues = await renderCuePngs(path.join(dir, `caps${tag}-${fmt}`), cueList, { W, H, accent: inp.template === "clean" ? "#0e9e90" : "#FFD54A", bottom: fmt === "reel" ? undefined : SAFE.bottomStatus(H) });
      const out = file.replace(/\.mp4$/, "-cap.mp4");
      await burnCaptions(ffArr, file, out, cues, { W, H });
      return out;
    };
    for (const v of variants) {
      // __jobId seeds the card decoration per job; __deliver tells the engine whether IT
      // must carry the delivery encode (no captions follow) or leave an intermediate.
      const vInp = { ...inp, template: v.template, music: v.musicKey, __jobId: job.id, __deliver: !willCaption(v.lines) };
      const vMusic = v.musicKey ? musicFile(v.musicKey) : music;
      const single = inp.tier === "realistic" || inp.tier === "presenter";
      let base = null; // the generated ratio for single-generation tiers — kept UNCAPTIONED
      for (const fmt of formats) {
        let out;
        await prog({ stage: "scenes", progress: { text: "Building the scenes…" } });
        if (single && base) {
          const { w: W, h: H } = AD_FORMATS[fmt];
          // Reframe the clean master FIRST and draw this ratio's captions at its own size.
          // Burning at 9:16 and shrinking afterwards is what left a 1:1 post with ~35 px text.
          out = await reframe(ffArr, base, path.join(dir, `ad${v.tag}-${fmt}.mp4`), { W, H, mode: "fit", final: !willCaption(v.lines) });
          out = await captioned(out, fmt, v.lines, v.tag);
        } else {
          // realistic + presenter buy their clips from fal — money leaves here
          if (single) await markSpent();
          out = inp.tier === "realistic"
            ? await renderRealisticAd(dir, vInp, { photo, photos, logo, voWav: v.voWav, music: vMusic }, { ffmpeg: ffArr, gemini: geminiJson, falKey: env.FAL_KEY, renderScene }, v.lines, (m) => console.log(`[ad] ${job.id.slice(0, 8)} ${m}`), fmt)
            : inp.tier === "presenter"
            ? await renderPresenterAd(dir, { ...vInp, ctaText: v.lines?.[v.lines.length - 1]?.text || "" }, { presenterPhoto, voWav: v.voWav, logo, music: vMusic }, { ffmpeg: ffArr, falKey: env.FAL_KEY, renderScene }, (m) => console.log(`[ad] ${job.id.slice(0, 8)} ${m}`), fmt)
            : await renderAd(dir, fmt, vInp, { photo, photos, logo, voWav: v.voWav, music: vMusic }, { ffmpeg: ffArr }, v.lines, kinds);
          if (v.tag) { const renamed = out.replace(/\.mp4$/, `${v.tag}.mp4`); renameSync(out, renamed); out = renamed; }
          if (single) base = out;   // the other ratios are reframed from the clean master, not from the captioned file
          out = await captioned(out, fmt, v.lines, v.tag);
        }
        outputs[`${fmt}${v.tag}`] = await upload(out, `ai-media/${job.owner_id}/ad-${job.id}-${fmt}${v.tag}.mp4`);
      }
    }
    const donePatch = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "done", stage: "done", progress: { text: "Done" }, output_url: outputs[formats[0]], input: { ...inp, outputs, script: lines, delivered_variants: variants.length }, updated_at: new Date().toISOString() }) });
    const doneRows = donePatch.ok ? await donePatch.json().catch(() => []) : [];
    console.log(`[ad] done ${job.id}`);
    // Paid for 3 variations, made fewer? The alternative hook lines come from one Gemini
    // call + 2 TTS lines and that can fail on its own (see the catch around variantLines);
    // the render then ships ONE video at the +50% price. Give the surcharge back rather
    // than fail a finished video over a bonus hook. Guarded twice: only the process that
    // flipped the row refunds, and the ledger's unique (reason, ref) index makes a repeat
    // impossible. cost/1.5 is exactly the one-video price the route would have charged.
    if (Array.isArray(doneRows) && doneRows.length > 0 && Number(inp.variants) === 3 && variants.length < 3 && Number(job.cost) > 0) {
      const oneVideo = Math.ceil(Number(job.cost) / 1.5);
      const back = Number(job.cost) - oneVideo;
      if (back > 0) {
        const r = await sb(`/rest/v1/rpc/grant_credits`, { method: "POST", body: JSON.stringify({ p_user: job.owner_id, p_amount: back, p_reason: "ad-refund", p_ref: `${job.id}:variants` }) });
        console.log(r.ok ? `[ad] ${job.id} made ${variants.length} of 3 variations — ${back} credits returned` : `[ad] variants refund failed ${job.id}: ${(await r.text().catch(() => "")).slice(0, 120)}`);
      }
    }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error(`[ad] FAILED ${job.id}:`, msg); adFailed = true;
    const patched = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "failed", error: msg, updated_at: new Date().toISOString() }) });
    const rows = await patched.json().catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) await refund(job);
  } finally {
    // keep the last failed job's files for inspection (one at a time), clean up successes
    if (adFailed) { try { rmSync(path.join(os.tmpdir(), "ad-last-failed"), { recursive: true, force: true }); renameSync(dir, path.join(os.tmpdir(), "ad-last-failed")); } catch { rmSync(dir, { recursive: true, force: true }); } }
    else rmSync(dir, { recursive: true, force: true });
  }
}

let busy = false;
let HAS_PIPELINE_COL = false;
// What this worker is chewing on right now — published with the heartbeat so
// "alive" and "stuck on one job for 40 minutes" stop looking identical.
let current = null;   // { id, at }
// Heartbeat + capabilities: the app refuses to create pipeline-2 jobs unless a worker that understands them is alive.
const WORKER_CAPS = { ad_v2: true, version: 2 };
async function beat() {
  const caps = { ...WORKER_CAPS, job: current?.id ?? null, job_age_s: current ? Math.round((Date.now() - current.at) / 1000) : 0 };
  try { await sb(`/rest/v1/media_worker_status?on_conflict=id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: 1, caps, beat_at: new Date().toISOString() }) }); } catch { /* table may not exist yet */ }
}
setInterval(beat, 30_000); beat();
// ffmpeg children of a previous (killed) worker keep burning CPU/RAM — clear them before taking work.
run("/bin/sh", ["-c", "pkill -f 'ffmpeg.*/(ad|reel)-' || true"]).catch(() => {});
// Old job folders are pure leftovers: a full disk fails every render at once,
// and this box has been there. ad-last-failed is kept on purpose (one job's
// files, for inspection) — everything else older than a day goes.
run("/bin/sh", ["-c", `find ${os.tmpdir()} -maxdepth 1 -type d \\( -name 'reel-*' -o -name 'reel2-*' -o -name 'ad-*' \\) ! -name 'ad-last-failed' -mmin +1440 -exec rm -rf {} + 2>/dev/null || true`])
  .catch(() => {});

/* ---------------- one job may never run forever ---------------- */
// 25 minutes was sized for a 20-second ad. A long video is fifty shots, each with a picture made for it, and a
// finished 5-minute film was killed at 25:00 with the encode already on disk. 40 gives the long engine room;
// every other kind still finishes in two or three.
const JOB_MAX_MS = Math.max(5, Number(env.MEDIA_JOB_MAX_MIN) || 40) * 60_000;
const TOO_LONG = "The video could not be finished in time — your credits have been returned.";
/** Run one job with a hard ceiling. On a timeout the row is failed + refunded
 *  and the render slot is released; the ffmpeg the job left behind is killed
 *  so it cannot keep eating the box. The abandoned promise can still finish
 *  later, but every write it makes is guarded by status=eq.running, which this
 *  has already changed — so it can neither charge again nor resurrect the job. */
async function runJob(job, fn) {
  let timer, timedOut = false, failure = null;
  current = { id: job.id, at: Date.now() };
  const ceiling = new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error(TOO_LONG)); }, JOB_MAX_MS); });
  // The catch is attached NOW, not awaited: after a timeout this promise is
  // abandoned, and in Node 20 an unhandled rejection kills the whole worker.
  const work = fn().catch((e) => { failure = e; });
  try {
    await Promise.race([work, ceiling]);
    if (failure) throw failure;
  } catch (e) {
    // The safety net for EVERY engine. An engine that records its own failure has already flipped the row, so the
    // PATCH below matches nothing and nothing is refunded twice; an engine that just throws — or throws before it
    // can record anything — would otherwise leave the row "running" for ever: no video, no refund, and the owner's
    // "one at a time" gate stuck shut. That is exactly what a stray character in an ffmpeg filter did once.
    if (timedOut) {
      console.error(`[media] WATCHDOG ${job.id}: still running after ${JOB_MAX_MS / 60_000} minutes — giving up`);
      if (/^[0-9a-f-]{36}$/i.test(String(job.id))) run("/bin/sh", ["-c", `pkill -f 'ffmpeg.*${job.id}' || true`]).catch(() => {});
    } else {
      console.error(`[media] FAILED ${job.id}:`, e?.message ?? e);
    }
    if (!/cancel/i.test(String(e?.message ?? ""))) {
      const msg = String(e?.message ?? e).slice(0, 400);
      const money = /402|quota|429|billing|balance|RESOURCE_EXHAUSTED/i.test(msg);
      alertOwner(money ? `AI service refused for money/quota (${job.kind})` : `${job.kind} video failed`,
        `Job ${job.id} (${job.kind})\nOwner ${job.owner_id}\n${timedOut ? "Watchdog: still running after the time limit." : `Error: ${msg}`}\n\n${money ? "Check the Gemini/fal balance and quota, then the job can be tried again from the app." : "Check pm2 logs neuraledge-media for the full trace."}`,
        money ? "money" : `fail:${job.kind}`);
    }
    // An engine that knows exactly what went wrong (e.userMessage) gets to tell the owner; everything else is generic.
    const why = timedOut ? TOO_LONG : (typeof e?.userMessage === "string" && e.userMessage.length < 300 ? e.userMessage : "The video could not be finished — your credits have been returned.");
    // An EDIT of a finished long video that dies here leaves the video as it was: the row goes back to done with a
    // note, and the edit's credits (the row's cost during an edit) come back.
    const editN = job.kind === "explainer" ? Number(job.input?.edit?.n) || 0 : 0;
    const body = editN
      ? { status: "done", error: null, progress: { text: `The edit could not be applied — ${timedOut ? "it took too long" : "something went wrong"}. Your video is unchanged; the edit's credits have been returned.` }, input: { ...(job.input || {}), edit: null }, cost: Number(job.input?.costOriginal ?? job.cost) || 0, updated_at: new Date().toISOString() }
      : { status: "failed", error: why, updated_at: new Date().toISOString() };
    try {
      const patched = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const rows = patched.ok ? await patched.json().catch(() => []) : [];
      if (Array.isArray(rows) && rows.length > 0 && Number(job.cost) > 0) await refund(job);
    } catch (err) { console.error("[media] failure cleanup failed", job.id, err?.message ?? err); }
  } finally { clearTimeout(timer); current = null; }
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    // This (legacy) path may only ever render pipeline-1 jobs: a pipeline-2 row is cost 0 until the owner approves its storyboard.
    let r = await sb(`/rest/v1/media_jobs?kind=in.(reel,ad,explainer)&status=eq.queued&pipeline=eq.1&order=created_at.asc&limit=1`);
    if (!r.ok && !HAS_PIPELINE_COL) r = await sb(`/rest/v1/media_jobs?kind=in.(reel,ad,explainer)&status=eq.queued&order=created_at.asc&limit=1`); // before migration 0044
    else if (r.ok) HAS_PIPELINE_COL = true;
    const jobs = r.ok ? await r.json() : [];
    if (jobs.length) {
      const job = jobs[0];
      // Claim it, and only render if WE are the process that flipped the row.
      // Two workers both rendering the same job means paying Veo/Kling twice.
      // attempts is counted here so the boot requeue can stop a restart loop.
      const claim = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.queued`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "running", attempts: (job.attempts ?? 0) + 1, updated_at: new Date().toISOString() }),
      });
      const mine = claim.ok ? await claim.json().catch(() => []) : [];
      if (Array.isArray(mine) && mine.length > 0) {
        const j = { ...job, ...mine[0] };
        if (j.kind === "explainer") await runJob(j, () => processExplainer(j, v2Helpers()));   // long video from the owner's own text
        else if (j.kind === "ad" && j.input?.tier === "stock") await runJob(j, () => processStockReel(j, { ...v2Helpers(), PEXELS })); // Reel Maker: stock clips + own images, no AI video
        else if (j.kind === "ad") await runJob(j, () => processAd(j));
        else await runJob(j, () => processJob(j));
      }
    }
    else if (HAS_PIPELINE_COL) { // pipeline 2, animate phase — shares the render slot (ffmpeg + Kling)
      const r2 = await sb(`/rest/v1/media_jobs?kind=eq.ad&status=eq.queued&pipeline=eq.2&phase=eq.animate&order=created_at.asc&limit=1`);
      const j2 = r2.ok ? (await r2.json())[0] : null;
      if (j2) { const c = await sb(`/rest/v1/media_jobs?id=eq.${j2.id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "running", attempts: (j2.attempts ?? 0) + 1, updated_at: new Date().toISOString() }) }); if (c.ok && (await c.json()).length) await runJob(j2, () => runAnimate({ ...j2, status: "running" }, v2Helpers())); }
    }
  } catch (e) {
    console.error("[media] tick error:", e?.message ?? e);
  } finally { busy = false; }
}
// Storyboard slot: network + sharp only (no ffmpeg, no Kling), so it may run while a render is in progress.
let busyStoryboard = false;
/** Any file from our own storage or site. fetchPhoto caps at 5 MB, which a ten-minute voice-over goes past. */
async function fetchOwnFile(url, maxBytes = 48 * 1024 * 1024) {
  if (!url) return null;
  const abs = String(url).startsWith("/") ? SITE + url : String(url);
  if (!(abs.startsWith(SITE) || abs.startsWith(SUPA_URL))) return null;
  try {
    const r = await fetch(abs, { signal: AbortSignal.timeout(T_MEDIA) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= maxBytes ? buf : null;
  } catch { return null; }
}
/** Wake a human. The platform owners get an email (and WhatsApp/push through their own accounts) when the AI
 *  picture service refuses for money, a video fails, or the worker gives up on a job. Throttled here per key
 *  (15 min) and again by the app (once an hour), so a dead Gemini balance sends one alarm, not one per video.
 *  Never throws, never blocks a job. */
const alertedAt = new Map();
async function alertOwner(subject, text, key = subject) {
  try {
    if (!env.CRON_KEY) { if (!alertedAt.has("__nokey")) { console.warn("[alert] CRON_KEY missing in .env.local — owner alarms are off"); alertedAt.set("__nokey", 1); } return; }
    const last = alertedAt.get(key) ?? 0;
    if (Date.now() - last < 15 * 60_000) return;
    alertedAt.set(key, Date.now());
    const r = await fetch(`${SITE}/api/notify/owner`, { method: "POST", headers: { "content-type": "application/json", "x-cron-key": env.CRON_KEY }, body: JSON.stringify({ subject, text, key }), signal: AbortSignal.timeout(20_000) });
    if (!r.ok) console.warn(`[alert] owner alarm not sent: ${r.status}`);
  } catch (e) { console.warn(`[alert] owner alarm failed: ${e?.message ?? e}`); }
}
const v2Helpers = () => ({ sb, SUPA_URL, SUPA_KEY, GEMINI, FAL_KEY: env.FAL_KEY, ttsLine, ffArr, renderScene, fetchPhoto, fetchOwnFile, beat, musicFile, alert: alertOwner, log: (m) => console.log(m) });
async function tickStoryboard() {
  if (busyStoryboard || !HAS_PIPELINE_COL) return;
  busyStoryboard = true;
  try {
    const r = await sb(`/rest/v1/media_jobs?kind=eq.ad&status=eq.queued&pipeline=eq.2&phase=eq.storyboard&order=created_at.asc&limit=1`);
    const job = r.ok ? (await r.json())[0] : null;
    if (job) {
      const c = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "running", attempts: (job.attempts ?? 0) + 1, updated_at: new Date().toISOString() }) });
      if (c.ok && (await c.json()).length) {
        try { await runStoryboard({ ...job, status: "running" }, v2Helpers()); }
        catch (e) { const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300); console.error(`[ad2] ${job.id} STORYBOARD FAILED:`, msg); await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: msg, updated_at: new Date().toISOString() }) }); } // nothing was charged
      }
    }
  } catch (e) { console.error("[media] storyboard tick error:", e?.message ?? e); } finally { busyStoryboard = false; }
}
setInterval(tickStoryboard, 6000);
setInterval(() => { if (HAS_PIPELINE_COL) sweepV2(v2Helpers()); }, 3600_000);

// PAUSED long videos. When the picture service refuses (no balance, no quota, nothing coming back) the explainer
// engine does not fail the job: it parks it as status=failed with error "PAUSED: …", credits still held, all its
// work kept in the bucket. Every ten minutes this looks at those rows: older than six hours → a real failure and
// a refund; otherwise, if a one-token probe of Gemini answers, back into the queue — the engine carries on from
// its kept work. Nothing here costs a picture.
async function geminiAnswers() {
  if (!GEMINI) return false;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 1 } }),
      signal: AbortSignal.timeout(20_000),
    }).then((x) => x.json());
    return !r?.error;
  } catch { return false; }
}
async function resumePaused() {
  try {
    const r = await sb(`/rest/v1/media_jobs?kind=eq.explainer&status=eq.failed&error=like.PAUSED*&select=id,owner_id,kind,cost,input,created_at,updated_at`);
    const rows = r.ok ? await r.json().catch(() => []) : [];
    if (!Array.isArray(rows) || !rows.length) return;
    let healthy = null;
    for (const job of rows) {
      const now = new Date().toISOString();
      const ageH = (Date.now() - Date.parse(job.created_at)) / 3600_000;
      if (ageH > 6) {
        const editN = Number(job.input?.edit?.n) || 0;
        // A paused EDIT gives up differently: the finished video comes back as it was, and only the edit's
        // credits are returned.
        const body = editN
          ? { status: "done", error: null, progress: { text: "The edit could not be applied — the AI picture service stayed unavailable. Your video is unchanged; the edit's credits have been returned." }, input: { ...(job.input || {}), edit: null }, cost: Number(job.input?.costOriginal ?? job.cost) || 0, updated_at: now }
          : { error: "The AI picture service stayed unavailable for six hours — your credits have been returned.", progress: { text: "Stopped" }, updated_at: now };
        const p = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.failed&error=like.PAUSED*`, {
          method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body),
        });
        const flipped = p.ok ? await p.json().catch(() => []) : [];
        if (Array.isArray(flipped) && flipped.length && Number(job.cost) > 0) await refund(job);
        console.log(`[media] paused explainer ${job.id}${editN ? ` (edit ${editN})` : ""} gave up after ${ageH.toFixed(1)}h — refunded`);
        alertOwner("Long video gave up after 6 hours paused", `Job ${job.id} waited six hours for the AI picture service and was refunded. The service is still not answering — check the Gemini balance/quota.`, "paused-gaveup");
        continue;
      }
      if (healthy === null) healthy = await geminiAnswers();
      if (!healthy) continue;
      const q = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.failed&error=like.PAUSED*`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "queued", error: null, attempts: 0, progress: { text: "Resuming where it stopped…" }, updated_at: now }),
      });
      if (q.ok && (await q.json().catch(() => [])).length) console.log(`[media] resumed paused explainer ${job.id}`);
    }
  } catch (e) { console.error("[media] resumePaused error:", e?.message ?? e); }
}
setInterval(resumePaused, 10 * 60_000);
setTimeout(resumePaused, 60_000);

console.log(`[media] worker up | veo:${GEMINI ? "yes" : "no"} kling:${REPLICATE ? "yes" : "no"} ffmpeg:${existsSync(FFMPEG) ? "yes" : "MISSING"} music:${existsSync(MUSIC_DIR) ? readdirSync(MUSIC_DIR).filter((f) => f.endsWith(".mp3")).length : 0} track(s)`);

// A worker restart (deploy, or an out-of-memory kill) leaves the job it was on
// stuck at "running". It gets ONE more go, and only if it has gone quiet for a
// few minutes; pipeline 1 has no clip cache, so every further rerun would buy
// the same Veo/Kling clips again — pm2 restarting at 900M once turned that into
// a loop that spent real money forever. Anything past that is stopped and the
// owner gets their credits back.
async function requeueInterrupted() {
  const quietSince = Date.now() - 3 * 60_000;
  try {
    // Read the list ONCE, then decide row by row: re-reading it after the
    // requeue would catch the same job again the moment tick() picked it up.
    const r = await sb(`/rest/v1/media_jobs?kind=in.(reel,ad,explainer)&status=eq.running&select=id,owner_id,kind,cost,input,attempts,updated_at`);
    const running = r.ok ? await r.json().catch(() => []) : [];
    let back = 0, dropped = 0;
    for (const job of running) {
      const tries = Number(job.attempts ?? 0);
      const quiet = !job.updated_at || Date.parse(job.updated_at) < quietSince;
      if (tries < 2 && quiet) {
        const p2 = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "queued", updated_at: new Date().toISOString() }),
        });
        if (p2.ok && (await p2.json().catch(() => [])).length) back++;
        continue;
      }
      const editN = job.kind === "explainer" ? Number(job.input?.edit?.n) || 0 : 0;
      const patched = await sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify(editN
          ? { status: "done", error: null, progress: { text: "The edit could not be applied after a restart. Your video is unchanged; the edit's credits have been returned." }, input: { ...(job.input || {}), edit: null }, cost: Number(job.input?.costOriginal ?? job.cost) || 0, updated_at: new Date().toISOString() }
          : { status: "failed", error: "The video could not be finished — your credits have been returned.", updated_at: new Date().toISOString() }),
      });
      const rows = patched.ok ? await patched.json().catch(() => []) : [];
      if (rows.length) { dropped++; if (Number(job.cost) > 0) await refund(job); }
    }
    if (back) console.log(`[media] requeued ${back} interrupted job(s) for one more try`);
    if (dropped) console.log(`[media] gave up on ${dropped} job(s) that could not be finished — credits returned`);
  } catch (e) { console.error("[media] boot requeue failed:", e?.message ?? e); }
}
// Nothing is claimed until the interrupted jobs have been sorted out, so tick()
// cannot pick one up and have this loop fail it a second later.
requeueInterrupted().finally(() => { setInterval(tick, 8000); tick(); });
