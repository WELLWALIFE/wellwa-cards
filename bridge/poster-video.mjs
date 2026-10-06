// Status video from a poster: 10–15 s, 720×1280 — WhatsApp's own Status size (also used for the FB / IG story).
// A colour-matched gradient backdrop (or a stock clip) with a soft drop shadow, the poster itself
// with rounded corners and a slow Ken-Burns zoom, one light sweep across it, fade in/out,
// a music bed from bridge/music/*.mp3 picked to suit the day, and the AI voice line —
// the video runs as long as the voice needs (10 s minimum, 15 s maximum).
// Output next to the poster: <poster>[-<music>][-v][-c].mp4 (cached).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { FPS, DELIVERY_A, MASTER_AF, DUCK } from "./caption-engine.mjs";
import { statusFrames } from "./signature.mjs";
import { labelOf as tradeLabel } from "./signature-presets.mjs";
// The spoken line comes from the better writer (Flash, not Lite; POSTER_TEXT_MODEL overrides), Lite if it is unavailable.
const TEXT_MODEL = process.env.POSTER_TEXT_MODEL || "gemini-3.5-flash";
/** Encoding for WhatsApp Status: H.264 Main profile, level 4.0, no B-frames — what WhatsApp itself produces, and what
 *  every phone's hardware decoder plays. (The ad studio's High-profile settings are fine for Instagram / YouTube; a
 *  status video is played by whatever phone the viewer has.) */
const STATUS_V = ["-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "1800k", "-bufsize", "3600k", "-profile:v", "main", "-level", "3.1", "-bf", "0", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.WA_FFMPEG || (fs.existsSync("/opt/neuraledge/bin/ffmpeg") ? "/opt/neuraledge/bin/ffmpeg" : "ffmpeg");
export const MUSIC_DIR = path.join(__dirname, "music");

/** Music beds (files in bridge/music). Owners can drop any royalty-free mp3 named <key>.mp3. */
export const MUSIC = [
  { key: "soft", label: "Soft & warm", mood: "greetings, festivals" },
  { key: "festive", label: "Festive bells", mood: "Diwali, Holi, celebrations" },
  { key: "calm", label: "Calm morning", mood: "good morning, quotes" },
  { key: "upbeat", label: "Upbeat", mood: "offers, products" },
  { key: "inspiring", label: "Inspiring", mood: "motivation, success" },
  { key: "none", label: "No music", mood: "silent" },
];
/** Which bed suits the day — festivals ring, products and offers move, mornings and quotes stay calm,
 *  motivation lifts, everything else (visiting-card day, testimonials, plain wishes) is soft. */
export function musicFor(theme, kind = "") {
  if (theme?.kind === "occasion") return "festive";
  if (kind === "product" || kind === "offer" || kind === "benefit") return "upbeat";
  const slug = String(theme?.slug || "");
  if (["motivation", "success", "city", "mountains"].includes(slug)) return "inspiring";
  if (["sunrise", "chai", "nature", "water", "gratitude", "diya", "rain", "sunday", "family"].includes(slug)) return "calm";
  return "soft";
}
/** Does this profile want the voice on its status video? Default yes; only a switch-off the owner made in the app
 *  (`voice.by === "user"`) counts. Rows saved while the voice was disabled (25–29 Sep 2026) carry `on: false`
 *  without `by`, which nobody chose — those still get the voice. */
export const voiceWanted = (layout) => !(layout?.voice && layout.voice.on === false && layout.voice.by === "user");
/** The language the voice speaks: Hindi unless the owner picked another one in the video sheet (owner's call, 6 Oct
 *  2026: "default voice Hindi me jaani chahiye, user change kar sakta hai") — the app's UI language is not the voice's. */
export const voiceLangOf = (layout) => (layout?.voice?.lang && LANG_NAME[layout.voice.lang] ? layout.voice.lang : "hi");

/* ---------------- voice greeting (Gemini TTS) ----------------
 * Status viewers already know the person, so the voice does mood + brand:
 * a two-line festival wish (or one product benefit) signed off with the firm
 * name. Name/phone only when asked. Premium voices, slow warm delivery. */
const GEMINI = process.env.GEMINI_API_KEY || "";
const VOICES = { female: "Aoede", female2: "Kore", male: "Charon", male2: "Algieba" };
const LANG_NAME = { hi: "Hindi (Devanagari)", en: "simple Indian English", hinglish: "Hinglish (Hindi in Roman letters)", mr: "Marathi", gu: "Gujarati", pa: "Punjabi", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia" };

/** The AI voice on status / story videos. Off 25–29 Sep 2026 (music only); back on from 29 Sep (owner's call:
 *  the daily WhatsApp poster is a 10–15 s video with voice, the length follows the spoken line). Setting this false
 *  silences the voice everywhere — the 4 AM auto-post, the Facebook / Instagram story and the app's "Make video". */
export const VOICE_ENABLED = true;

/* --- the spoken line must be right, or there is no spoken line: checks a script has to pass before it is used --- */
const SCRIPT_RANGE = { hi: /[\u0900-\u097F]/, mr: /[\u0900-\u097F]/, gu: /[\u0A80-\u0AFF]/, pa: /[\u0A00-\u0A7F]/, bn: /[\u0980-\u09FF]/, ta: /[\u0B80-\u0BFF]/, te: /[\u0C00-\u0C7F]/, kn: /[\u0C80-\u0CFF]/, ml: /[\u0D00-\u0D7F]/, or: /[\u0B00-\u0B7F]/ };
const CLAIMS = /guarantee|guaranteed|100\s*%|\bcures?\b|गारंटी|गारण्टी|दोगुन|दुगन|\bdugn|\bdogun|लाखों कमा|lakho?n? kama|earn (?:lakhs|daily)|risk[- ]free|no side effect/i;
/** Words that would embarrass the brand or belittle anyone (owner's call, 6 Oct 2026: "kisi ko galat na lage, brand ki
 *  beizzati na ho"): insults, "cheap", fraud talk, running down other shops. */
const RUDE = /घटिया|बकवास|बेवकूफ़|बेवक़ूफ़|मूर्ख|चोर|धोखा|धोखेबाज़|नकली|फ़र्ज़ी|फर्जी|सस्ता माल|दूसरों से बेहतर|बाकी सब|दूसरी दुकान|\bidiot|\bstupid|\bfraud|\bscam|\buseless|\bpathetic|\bcheapest|\bfake\b|better than (?:others|the rest)|\bworst\b/i;
/** "" when the line is fine, otherwise what is wrong with it (goes back to the model once, then the voice is skipped). */
export function voiceScriptIssue(text, { lang = "hi", allowDigits = false } = {}) {
  const t = String(text || "").trim();
  if (!t) return "empty";
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < 8) return "too short (under 8 words)";
  if (words > 34) return "too long (over 34 words)";
  if (/https?:|www\.|\.com\b|\.in\b|@|#/i.test(t)) return "contains a link, handle or hashtag";
  if (/\p{Extended_Pictographic}/u.test(t)) return "contains an emoji";
  if (/[*_\[\]{}<>|]/.test(t)) return "contains markup characters";
  if (!allowDigits && /\d/.test(t)) return "contains a number that was not given";
  if (CLAIMS.test(t)) return "makes a guarantee / medical / income claim";
  if (RUDE.test(t)) return "belittles someone or runs down others — not a word that could embarrass the brand";
  if ((t.match(/[!！]/g) || []).length > 1) return "shouts (more than one exclamation mark)";
  if (mixedWord(t)) return "mixes Latin letters into a native-script word";
  if (lang === "en" || lang === "hinglish") { if (/[\u0900-\u0D7F]/.test(t)) return `contains native-script letters, must be ${lang === "en" ? "English" : "Hinglish in Roman letters"}`; }
  else if (SCRIPT_RANGE[lang] && !SCRIPT_RANGE[lang].test(t)) return `not written in the ${LANG_NAME[lang]} script`;
  return "";
}

export async function suggestVoiceScript({ theme, lang = "hi", brand = "", name = "", phone = "", product = null, includeName = false, includePhone = false, custom = "", category = "" }) {
  if (!GEMINI || !VOICE_ENABLED) return "";
  const L = LANG_NAME[lang] || LANG_NAME.hi;
  const occasion = theme?.kind === "occasion";
  // the trade, so the hook can come from the listener's own world; the hook's shape changes with the day so a week of
  // statuses does not sound alike
  const trade = tradeLabel(category, "en");
  const day = Math.floor(Date.now() / 86400000);
  const shape = ["a sharp question the listener asks themselves", "an unexpected contrast — two things set against each other", "a small everyday truth said in a fresh way", "one tiny scene the listener can picture (a cup, a shutter, a road at dawn)"][day % 4];
  // The line must make the listener stop and think (owner's call, 29 Sep 2026: "har text me hook ho, simple nahi").
  // Sentence 1 is the hook, sentence 2 the day's message from the given facts, sentence 3 the sign-off.
  const kindLine = product
    ? `It is a product highlight: product "${product.name}"${product.offer ? `, offer "${product.offer}"` : ""}${product.benefits?.length ? `, benefits: ${product.benefits.slice(0, 2).join(", ")}` : ""}. The message names one real benefit from that list. No medical, income or guarantee claims, no prices or numbers unless given above.`
    : occasion
      ? `Occasion: ${theme?.en || theme?.hi} (${theme?.greet || ""}). The message is a heartfelt festival wish — name the festival exactly as given, never salesy.`
      : `Theme: ${theme?.en || theme?.hi || "a warm greeting"} (${theme?.greet || ""}). The message is an uplifting thought for the day.`;
  const hookExamples = product
    ? `"जो सवाल रात दो बजे आता है, उसका जवाब भी उसी वक़्त मिलना चाहिए।" · "ग्राहक इंतज़ार नहीं करता, वो अगली दुकान चला जाता है।" · "दुकान बंद हो सकती है, ज़रूरत नहीं।"`
    : occasion
      ? `"दीये की रोशनी कमरा नहीं, मन उजला करती है।" · "त्योहार तारीख़ नहीं, बहाना है — अपनों के पास लौटने का।" · "मिठाई बँटती है, मिठास बढ़ती है।"`
      : `"सुबह सबके लिए आती है, उठता कोई-कोई है।" · "जो आज टाला, वो कल का बोझ है।" · "छोटा कदम भी कदम है, बड़ी सोच से बड़ा।"`;
  const prompt = `Write the spoken voice-over for a 12-second WhatsApp status video of a small Indian business${trade ? ` (a ${trade})` : ""}. Language: ${L}.
Length: 18 to 28 words, exactly 3 short sentences, natural when spoken slowly (no hashtags, no emojis, no bullet points, no quotation marks, no line breaks).
Structure:
1. HOOK — the first sentence must make the listener pause and think. Today its shape is: ${shape}.${trade ? ` It may come from the world of a ${trade} and its customers, without selling anything.` : ""} Never a plain greeting, never "welcome", never "we are happy to". Examples of the tone (style only — write your own, never copy): ${hookExamples}
2. MESSAGE — ${kindLine}
3. SIGN-OFF — a short, graceful sign-off from "${brand || name || "us"}"${includeName && name ? ` and the person's name "${name}"` : ""}${includePhone && phone ? ` and the phone number ${phone} read digit by digit` : ""}.
${custom ? `The owner wants this message included, in the same words where possible: "${custom}".` : ""}
Respect above all: polite, warm, formal "आप" (never "तू"/"तुम"), nothing that could embarrass the business or belittle any customer, caste, religion, gender, place or rival — no comparisons with other shops, no sarcasm, no slang, no fear or guilt. Spell every word correctly in that language; the brand name "${brand || name}" is spelled exactly as given (in that script if the language is not English) and said once, in the sign-off.
Voice of a wise friend, not an announcer: simple everyday words a shopkeeper uses, one idea, each sentence at most 12 words, no clichés ("आइए मिलकर", "सफलता की ओर", "नई शुरुआत", "सपनों को साकार", "आपकी सेवा में"), no exclamation marks, no invented facts, no other phone number, address, price, date or year. Do not invent anything about the business.
${lang === "en" || lang === "hinglish" ? "Roman letters only." : `Write ONLY in the ${L} script — not one Latin letter anywhere, brand names too spelled in ${L} letters.`}
Return only the spoken text.`;
  const askModel = async (model, p, temperature) => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: p }] }], generationConfig: { temperature, maxOutputTokens: 200 } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${model} ${r.status}`);
    return String(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ").trim().slice(0, 260);
  };
  const ask = async (p, temperature = 0.7) => { try { return await askModel(TEXT_MODEL, p, temperature); } catch { return askModel("gemini-3.5-flash-lite", p, temperature).catch(() => ""); } };
  // Numbers are fine only when the owner gave them (an offer, a phone number to read out).
  const allowDigits = !!(includePhone && phone) || /\d/.test(`${custom} ${product?.offer ?? ""} ${product?.name ?? ""} ${theme?.en ?? ""} ${theme?.hi ?? ""}`);
  try {
    let out = await ask(prompt);
    let issue = voiceScriptIssue(out, { lang, allowDigits });
    // A Hindi line came back as "सच्ची दौlat" — Latin letters glued inside a Devanagari word. The voice stumbles on
    // it and the owner sees it in the box. For any Indian-script language: once more, sternly; then the same
    // transliteration the voice uses; the mixed line is never shown.
    if (issue && lang !== "en" && lang !== "hinglish" && mixedWord(out)) {
      const n = await nativeScript(out, lang, GEMINI).catch(() => "");
      if (n && !voiceScriptIssue(n, { lang, allowDigits })) { out = n; issue = ""; }
    }
    if (issue) {
      const again = await ask(`${prompt}\nIMPORTANT — your previous answer was rejected because it ${issue}. Fix exactly that and follow every rule above.`, 0.4).catch(() => "");
      const issue2 = voiceScriptIssue(again, { lang, allowDigits });
      if (!issue2) { out = again; issue = ""; }
      else console.log(`[voice] script skipped (${issue}; retry: ${issue2})`);
    }
    if (issue) return "";   // no line rather than a wrong line — the video then plays with music only
    // One proofread before it is spoken (owner's call, 6 Oct 2026: "voice text perfect hona chahiye"): spelling, grammar,
    // respect, the brand name — the corrected line replaces it only when it passes every check above.
    const fixed = await ask(`Proofread this ${L} voice-over line for a small Indian business's WhatsApp status. Fix only real mistakes: spelling, grammar, a wrong matra or conjunct, a word that is rude, sarcastic or could embarrass the business "${brand || name}", a brand name spelled wrongly (it must read exactly "${brand || name}"). Keep the meaning, the three sentences, the length and the script; add nothing. Return only the corrected line, or the same line unchanged.\n\n${out}`, 0.2).catch(() => "");
    if (fixed && !voiceScriptIssue(fixed, { lang, allowDigits }) && Math.abs(fixed.length - out.length) < out.length * 0.4) out = fixed;
    return out;
  } catch { return ""; }
}
/** A Latin letter touching an Indic letter inside one word ("दौlat"): a script the model half-switched. */
const mixedWord = (t) => /[\u0900-\u0D7F][A-Za-z]|[A-Za-z][\u0900-\u0D7F]/.test(String(t || ""));

import { nativeScript } from "./tts-script.mjs";
const mixedScript = (t) => /[\u0900-\u097F]/.test(t) && /[A-Za-z]/.test(t);
const styleFor = (lang) => (lang === "en" || !LANG_NAME[lang]
  ? "Speak this as a premium, warm Indian brand voice: slow, calm, clear diction, gentle smile in the voice, a natural pause between sentences. Do not add any words of your own: "
  : `Speak this as a premium, warm ${String(LANG_NAME[lang]).replace(/ \(.*\)/, "")} brand voice, as a native speaker would: slow, calm, clear pronunciation of every word, gentle smile in the voice, a natural pause between sentences, no English accent. Do not add any words of your own: `);
function wavHeader(len, sr = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(len, 40);
  return h;
}
async function ttsOnce(text, voiceName) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", { method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } } }) });
  const d = await r.json().catch(() => ({}));
  return { b64: d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data, why: d?.error ? JSON.stringify(d.error).slice(0, 140) : d?.candidates?.[0]?.finishReason || "no audio" };
}
/** Voice line → WAV (24 kHz mono). Returns seconds. Same retry ladder as the ad studio (Hinglish skips the style preamble). */
export async function ttsVoice(text, outWav, gender = "female", lang = "") {
  const STYLE = styleFor(lang);
  if (!GEMINI) throw new Error("GEMINI_API_KEY missing");
  const name = VOICES[gender] || VOICES.female;
  const original = text;
  text = await nativeScript(text, lang, GEMINI);   // own script → no "OTHER" refusals, correct pronunciation
  const styled = mixedScript(text) ? text : STYLE + text;
  const tries = [() => ttsOnce(styled, name), () => ttsOnce(styled, name), () => ttsOnce(text, name), () => ttsOnce(original, name), () => ttsOnce(original, VOICES.female)];
  let b64, why = "";
  for (let i = 0; i < tries.length && !b64; i += 1) { if (i) await new Promise((r) => setTimeout(r, 1200)); ({ b64, why } = await tries[i]()); }
  if (!b64) throw new Error("TTS failed: " + why);
  const pcm = Buffer.from(b64, "base64");
  fs.writeFileSync(outWav, Buffer.concat([wavHeader(pcm.length), pcm]));
  return pcm.length / (24000 * 2);
}

export async function renderStatusVideo(posterFile, { music = "soft", force = false, seconds = 10, voice: voice0 = null, clip = null } = {}) {
  const voice = VOICE_ENABLED ? voice0 : null; // music only (see VOICE_ENABLED)
  // `clip`: a stock video (portrait, ≥ the length we need) moves behind the poster instead of the flat gradient.
  const useClip = !!(clip && fs.existsSync(clip));
  const key = MUSIC.some((m) => m.key === music) ? music : "soft";
  const hasVoice = !!(voice && voice.text && voice.text.trim());
  const out = posterFile.replace(/\.jpg$/i, `${key === "soft" ? "" : `-${key}`}${hasVoice ? "-v" : ""}${useClip ? "-c" : ""}.mp4`);
  // cached — unless the poster was re-rendered (edited) after the video was made, or the video predates the
  // WhatsApp-safe encoding (STATUS_V, 29 Sep 2026): those are made once more.
  const ENCODING_SINCE = Date.parse("2026-09-29T11:30:00Z");
  if (fs.existsSync(out) && !force) { const m = fs.statSync(out).mtimeMs; if (m >= fs.statSync(posterFile).mtimeMs && m >= ENCODING_SINCE) return out; }
  // voice first: the video runs as long as the voice needs — 10 s minimum, 15 s maximum. A line the voice
  // cannot finish in 15 s is spoken a little faster (never cut mid-sentence).
  let voiceWav = null, voiceSec = 0, tempo = 1;
  if (hasVoice) {
    voiceWav = out.replace(/\.mp4$/, ".wav");
    voiceSec = await ttsVoice(voice.text.trim(), voiceWav, voice.gender || "female", voice.lang || "");
    const MAX_VOICE = 15 - 1.7;   // 0.15 s lead-in + a 1.5 s tail before the fade-out
    if (voiceSec > MAX_VOICE) { tempo = Math.min(1.3, voiceSec / MAX_VOICE); voiceSec = voiceSec / tempo; }
    seconds = Math.min(15, Math.max(10, Math.max(seconds, Math.ceil(voiceSec + 2))));
  }
  // A Signature poster (bridge/signature.mjs left its spec beside it) becomes a full-frame 9:16 video: the same design
  // re-drawn for the tall screen, a slow push-in, and the spoken line as subtitle plates that follow the voice.
  const specFile = `${posterFile}.spec.json`;
  if (fs.existsSync(specFile)) {
    try {
      const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
      return await renderSignatureStatus(spec, out, { key, seconds, voiceWav, voiceSec, tempo, voiceText: hasVoice ? voice.text.trim() : "" });
    } catch (e) { console.log(`[video] signature status failed (${e.message}) → poster-on-gradient video`); }
  }
  const track = musicTrack(key), hasMusic = !!track;
  const fps = FPS, frames = Math.round(seconds * fps);
  // WhatsApp's own Status format is 720×1280 (a status posted from a phone is never bigger); the same file serves the
  // Facebook / Instagram story. Half the pixels of 1080p: plays on every phone, uploads in half the time.
  const W = 720, H = 1280, PW = 667, PH = 833;

  // --- stills built with sharp, so ffmpeg only has to move them -------------
  // The poster is mostly large text: a blurred copy of it behind itself is
  // smeared ghost-lettering, not a backdrop. Sample its dominant colour and
  // build a real gradient with a soft drop shadow instead.
  const meta = await sharp(posterFile).metadata();
  const fitK = Math.min(PW / (meta.width || PW), PH / (meta.height || PH));
  const fw = Math.round((meta.width || PW) * fitK), fh = Math.round((meta.height || PH) * fitK);
  const px = Math.round((W - fw) / 2), py = Math.round((H - fh) / 2);
  const dom = (await sharp(posterFile).stats()).dominant || { r: 24, g: 28, b: 38 };
  // keep the poster's hue but never collapse to a black void when the poster
  // itself is very dark — the floor guarantees a visible gradient either way
  const sh = (k, floor) => `rgb(${Math.round(Math.min(255, dom.r * k + floor))},${Math.round(Math.min(255, dom.g * k + floor))},${Math.round(Math.min(255, dom.b * k + floor))})`;
  const RAD = 19;
  const tmp = [];
  const bgFile = out.replace(/\.mp4$/, "-bg.png");
  const fgFile = out.replace(/\.mp4$/, "-fg.png");
  const swFile = out.replace(/\.mp4$/, "-sw.png");
  tmp.push(bgFile, fgFile, swFile);
  await sharp(Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${sh(0.62, 30)}"/><stop offset="0.5" stop-color="${sh(0.34, 14)}"/><stop offset="1" stop-color="${sh(0.18, 6)}"/>
    </linearGradient>
    <filter id="sh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="26"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="${px}" y="${py + 18}" width="${fw}" height="${fh}" rx="${RAD}" fill="#000" opacity="0.45" filter="url(#sh)"/>
  </svg>`)).png().toFile(bgFile);
  // 2x the delivered size so zoompan's whole-pixel crop rounding downsamples
  // instead of shimmering the poster's own sharp text.
  await sharp(posterFile).resize(fw * 2, fh * 2, { fit: "fill" })
    .composite([{ input: Buffer.from(`<svg width="${fw * 2}" height="${fh * 2}" xmlns="http://www.w3.org/2000/svg"><rect width="${fw * 2}" height="${fh * 2}" rx="${RAD * 2}" ry="${RAD * 2}" fill="#fff"/></svg>`), blend: "dest-in" }])
    .png().toFile(fgFile);
  const SWW = 307;
  await sharp(Buffer.from(`<svg width="${SWW}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.15"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient></defs><rect width="${SWW}" height="${H}" fill="url(#s)"/></svg>`)).png().toFile(swFile);

  const filter = [
    useClip
      ? `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},eq=brightness=-0.06:saturation=1.03,trim=duration=${seconds},setpts=PTS-STARTPTS[bg]`
      : `[0:v]fps=${fps}[bg]`,
    `[1:v]zoompan=z='min(1+0.00014*on,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${fw}x${fh}:fps=${fps},trim=duration=${seconds}[fg]`,
    `[bg][fg]overlay=${px}:${py}:format=auto[base]`,
    // the light sweep the header promises: one pass across the poster, 0.6-2.8 s
    `[2:v]fps=${fps}[sw]`,
    `[base][sw]overlay=x='-w+(W+w)*(t-0.6)/2.2':y=0:format=auto:enable='between(t,0.6,2.8)'[lit]`,
    // 1.4 s of dark, silent frame used to open the video — the only 1.5 s that decides whether anyone watches
    `[lit]fade=t=in:st=0:d=0.12,fade=t=out:st=${(seconds - 0.7).toFixed(2)}:d=0.7,format=yuv420p[v]`,
  ].join(";");
  const args = ["-y", "-loglevel", "error", ...(useClip ? ["-stream_loop", "-1", "-t", String(seconds), "-i", clip] : ["-loop", "1", "-t", String(seconds), "-i", bgFile]), "-loop", "1", "-t", String(seconds), "-i", fgFile, "-loop", "1", "-t", String(seconds), "-i", swFile];
  let audioFilter = "", audioMaps = [];
  if (hasMusic) args.push("-stream_loop", "-1", "-i", track);
  if (voiceWav) args.push("-i", voiceWav);
  const mIdx = hasMusic ? 3 : -1, vIdx = voiceWav ? (hasMusic ? 4 : 3) : -1;
  const S = "aresample=48000,aformat=channel_layouts=stereo";
  if (hasMusic && voiceWav) {
    // music ducks under the voice (sidechain); the voice now starts at 0.15 s
    audioFilter = `;[${mIdx}:a]${S},afade=t=in:st=0:d=1,afade=t=out:st=${(seconds - 1.5).toFixed(2)}:d=1.5,volume=0.45[m];[${vIdx}:a]${S}${tempo > 1 ? `,atempo=${tempo.toFixed(3)}` : ""},adelay=150|150,apad=whole_dur=${seconds},asplit=2[vo1][vo2];[m][vo1]${DUCK}[md];[md][vo2]amix=inputs=2:duration=first:normalize=0,${MASTER_AF}[a]`;
    audioMaps = ["-map", "[a]"];
  } else if (hasMusic) { audioFilter = `;[${mIdx}:a]${S},afade=t=in:st=0:d=1,afade=t=out:st=${(seconds - 1.5).toFixed(2)}:d=1.5,volume=0.7,${MASTER_AF}[a]`; audioMaps = ["-map", "[a]"]; }
  else if (voiceWav) { audioFilter = `;[${vIdx}:a]${S}${tempo > 1 ? `,atempo=${tempo.toFixed(3)}` : ""},adelay=150|150,apad=pad_dur=${seconds},${MASTER_AF}[a]`; audioMaps = ["-map", "[a]"]; }
  args.push("-filter_complex", filter + audioFilter, "-map", "[v]", ...audioMaps);
  args.push("-t", String(seconds), "-r", String(fps), ...STATUS_V, ...(audioMaps.length ? DELIVERY_A : []), out);
  try { await run(FFMPEG, args, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }); }
  finally { for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* ignore */ } } }
  if (voiceWav) { try { fs.unlinkSync(voiceWav); } catch { /* ignore */ } }
  return out;
}

/** The music bed file for a key: the licensed tracks the video studio uses first, then the synthesised beds, and any
 *  bed rather than silence when the wanted one is missing. */
function musicTrack(key) {
  const CANDIDATES = { soft: ["indian-sitar", "soft", "inspiring-motivational"], festive: ["festive-diwali", "festive", "indian-sitar"], calm: ["calm-ambient", "calm", "indian-sitar"], upbeat: ["upbeat-corporate", "energetic-promo", "upbeat"], inspiring: ["inspiring-motivational", "inspiring", "indian-sitar", "soft"] };
  const firstTrack = (names) => names.map((n) => path.join(MUSIC_DIR, `${n}.mp3`)).find((f) => fs.existsSync(f)) ?? null;
  return key === "none" ? null : (firstTrack(CANDIDATES[key] ?? [key]) ?? firstTrack(Object.values(CANDIDATES).flat()));
}

/** The spoken line as subtitle sentences: split at sentence ends, very short pieces joined to the one before, at most four. */
export function subtitleSentences(text) {
  const parts = String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[।.!?])\s+/).map((t) => t.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) { if (out.length && (p.split(" ").length < 3 || out[out.length - 1].split(" ").length < 3)) out[out.length - 1] += " " + p; else out.push(p); }
  while (out.length > 4) { const i = out.reduce((m, t, k) => (t.length < out[m].length ? k : m), 0); const j = i === out.length - 1 ? i - 1 : i; out.splice(j, 2, `${out[j]} ${out[j + 1]}`); }
  return out;
}

/** Signature status video: the 9:16 frame full screen with a slow push-in and one light sweep, the sentence plates
 *  fading in and out in step with the voice, the same music / voice mix as the poster video. */
export async function renderSignatureStatus(spec, out, { key, seconds, voiceWav, voiceSec, tempo, voiceText }) {
  const W = 720, H = 1280, fps = FPS, frames = Math.round(seconds * fps), K = W / 1080;
  const sentences = voiceWav && voiceText ? subtitleSentences(voiceText) : [];
  const { base, plates } = await statusFrames(spec, sentences);
  const tmp = [];
  const bgFile = out.replace(/\.mp4$/, "-bg.png"), swFile = out.replace(/\.mp4$/, "-sw.png");
  tmp.push(bgFile, swFile);
  fs.writeFileSync(bgFile, base);
  const SWW = 307;
  await sharp(Buffer.from(`<svg width="${SWW}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient></defs><rect width="${SWW}" height="${H}" fill="url(#s)"/></svg>`)).png().toFile(swFile);
  // plate timing: the voice starts at 0.15 s; each sentence gets its share of the spoken time by length; the last one
  // stays up until the fade-out so the screen never goes bare while the music plays out
  const lens = sentences.map((t) => t.replace(/\s+/g, "").length || 1), total = lens.reduce((a, b) => a + b, 0);
  let t = 0.15; const spans = [];
  for (let i = 0; i < sentences.length; i++) { const d = (voiceSec + 0.4) * (lens[i] / total); spans.push([t, i === sentences.length - 1 ? Math.max(t + d, seconds - 0.7) : t + d]); t += d; }
  const plateFiles = [];
  for (const [i, p] of plates.entries()) {
    const f = out.replace(/\.mp4$/, `-p${i}.png`); tmp.push(f); plateFiles.push(f);
    await sharp(p.buf).resize(Math.round(p.w * K), Math.round(p.h * K)).png().toFile(f);
  }
  const chain = [`[0:v]zoompan=z='min(1+0.00011*on,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps},trim=duration=${seconds}[base]`, `[1:v]fps=${fps}[sw]`,
    `[base][sw]overlay=x='-w+(W+w)*(t-0.8)/2.4':y=0:format=auto:enable='between(t,0.8,3.2)'[o0]`];
  plates.forEach((p, i) => {
    const [a, b] = spans[i], idx = 2 + i;
    chain.push(`[${idx}:v]format=rgba,fade=t=in:st=${a.toFixed(2)}:d=0.3:alpha=1,fade=t=out:st=${Math.max(a, b - 0.3).toFixed(2)}:d=0.3:alpha=1[p${i}]`);
    chain.push(`[o${i}][p${i}]overlay=${Math.round(p.left * K)}:${Math.round(p.top * K)}:format=auto:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[o${i + 1}]`);
  });
  chain.push(`[o${plates.length}]fade=t=in:st=0:d=0.12,fade=t=out:st=${(seconds - 0.7).toFixed(2)}:d=0.7,format=yuv420p[v]`);
  const args = ["-y", "-loglevel", "error", "-loop", "1", "-framerate", String(fps), "-t", String(seconds), "-i", bgFile, "-loop", "1", "-framerate", String(fps), "-t", String(seconds), "-i", swFile];
  for (const f of plateFiles) args.push("-loop", "1", "-framerate", String(fps), "-t", String(seconds), "-i", f);
  const track = musicTrack(key), hasMusic = !!track;
  let audioFilter = "", audioMaps = [];
  if (hasMusic) args.push("-stream_loop", "-1", "-i", track);
  if (voiceWav) args.push("-i", voiceWav);
  const mIdx = hasMusic ? 2 + plateFiles.length : -1, vIdx = voiceWav ? 2 + plateFiles.length + (hasMusic ? 1 : 0) : -1;
  const S = "aresample=48000,aformat=channel_layouts=stereo";
  if (hasMusic && voiceWav) {
    audioFilter = `;[${mIdx}:a]${S},afade=t=in:st=0:d=1,afade=t=out:st=${(seconds - 1.5).toFixed(2)}:d=1.5,volume=0.45[m];[${vIdx}:a]${S}${tempo > 1 ? `,atempo=${tempo.toFixed(3)}` : ""},adelay=150|150,apad=whole_dur=${seconds},asplit=2[vo1][vo2];[m][vo1]${DUCK}[md];[md][vo2]amix=inputs=2:duration=first:normalize=0,${MASTER_AF}[a]`;
    audioMaps = ["-map", "[a]"];
  } else if (hasMusic) { audioFilter = `;[${mIdx}:a]${S},afade=t=in:st=0:d=1,afade=t=out:st=${(seconds - 1.5).toFixed(2)}:d=1.5,volume=0.7,${MASTER_AF}[a]`; audioMaps = ["-map", "[a]"]; }
  else if (voiceWav) { audioFilter = `;[${vIdx}:a]${S}${tempo > 1 ? `,atempo=${tempo.toFixed(3)}` : ""},adelay=150|150,apad=pad_dur=${seconds},${MASTER_AF}[a]`; audioMaps = ["-map", "[a]"]; }
  args.push("-filter_complex", chain.join(";") + audioFilter, "-map", "[v]", ...audioMaps);
  args.push("-t", String(seconds), "-r", String(fps), ...STATUS_V, ...(audioMaps.length ? DELIVERY_A : []), out);
  try { await run(FFMPEG, args, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }); }
  finally { for (const f of tmp) { try { fs.unlinkSync(f); } catch { /* ignore */ } } }
  if (voiceWav) { try { fs.unlinkSync(voiceWav); } catch { /* ignore */ } }
  return out;
}
