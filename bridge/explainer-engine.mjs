// Long explainer video (up to 10 minutes) from the owner's OWN text.
//
// The owner pastes what they want to say; the length of the video is the length of that text. No AI writing, no AI
// video, no stock footage: every word is theirs, every picture is theirs (their product/shop photos) or a plain
// branded slide. The only paid part is the voice: Gemini TTS bills audio output at 25 tokens a second, about ₹1.35
// a minute, so a 10-minute explainer costs us roughly ₹13 of API plus some CPU.
//
// Shape: opening slide → one slide per paragraph (a short heading on screen, their photo when they gave one) →
// closing slide with the phone number. The voice runs under the whole thing, music sits below it (ducked), and the
// slides are joined straight into ONE delivery encode — no intermediate video files, so a 10-minute render never
// fills the server's disk.
//
// H = { sb, SUPA_URL, SUPA_KEY, ttsLine, ffArr, fetchPhoto, musicFile, beat, log }
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { FPS, DELIVERY_V, DELIVERY_A, MASTER_AF, DUCK, MUSIC_VOL, MUSIC_SOLO, SAFE } from "./caption-engine.mjs";
import { planShots, understandScript, reviewOrders } from "./shotlist.mjs";
import { pacing, splitSentences, packBeats, allocatePictures, quantise, measureBeats, trimSilence, MAX_SHOTS_PER_SOURCE } from "./explainer-beats.mjs";
import { buildShots, stillShot, wordCardPng, lastFrame } from "./explainer-shots.mjs";
import { findClip } from "./stock-reel.mjs";
import { makePicture, pictureStats, resetPictureStats, pictureCostRupees } from "./explainer-picture.mjs";
import { transcribeWords, alignUnits, alignWords } from "./voice-align.mjs";
import { wordCues, renderCuePngs } from "./caption-engine.mjs";
import { checkFinal } from "./explainer-qc.mjs";
import { saveWork, restoreWork, fetchWork } from "./explainer-work.mjs";
import { readManifest, readEdits, applyEditsToParts, mapPrior, spliceRecording, staleShotsFor, pruneFinished, writeManifest, ownPictureFile } from "./explainer-edit.mjs";

export const SIZES = { reel: { W: 1080, H: 1920 }, wide: { W: 1920, H: 1080 }, square: { W: 1080, H: 1080 } };
export const MAX_SECONDS = 600;          // 10 minutes of speech
export const MAX_CHARS = 9000;           // ≈ 10 minutes
// The silence between two paragraphs. This is OURS, not the voice engine's: each paragraph is recorded on its own
// and we place it on the timeline, so the gap is exact to the millisecond. (Gemini's own <break> tag is not — a
// 5-second and a 10-second break came back the same length when tested against the live API.)
// 1.5s is a spoken beat: long enough to let a point land and to read the new slide, short enough not to drag.
const GAP_DEFAULT = 0.9;
const gapOf = (v) => (Number.isFinite(Number(v)) ? Math.min(2, Math.max(0.3, Number(v))) : GAP_DEFAULT);
const WPS = 2.4;                         // words per second, used only when the voice is off
const INTRO = 2.6, OUTRO = 4;
const LAT = "Liberation Sans, DejaVu Sans, Arial, sans-serif";
const DEV = "Noto Sans Devanagari, Lohit Devanagari, Mukta, Liberation Sans, sans-serif";
const hasDev = (s) => /[ऀ-ॿ]/.test(String(s || ""));
const fam = (s) => (hasDev(s) ? DEV : LAT);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A long video is 20-40x the length of a reel, so it gets a faster preset; every other delivery setting is shared. */
const DELIVERY_LONG = DELIVERY_V.map((x, i) => (DELIVERY_V[i - 1] === "-preset" ? "veryfast" : x));
/** The biggest file our storage will take. A video we cannot store is a video the owner never receives. */
const MAX_UPLOAD_MB = Number(process.env.MEDIA_MAX_MB || 45);
/**
 * Constant quality is right for a 20-second reel and wrong for a ten-minute one: crf alone produced a 45 MB file
 * from five minutes, and ten minutes would not fit at all. So the long engine aims at a bitrate that keeps the
 * finished file inside the storage limit, clamped so a short one still looks good and a long one stays watchable.
 */
function longVideoBitrate(seconds) {
  const audioKbps = 128;
  const fit = Math.floor((MAX_UPLOAD_MB * 8 * 1024) / Math.max(30, seconds)) - audioKbps;
  return Math.max(420, Math.min(2600, fit));
}

/**
 * The owner's logo, alone, on a transparent full-frame layer: top-right, on a soft white chip so a dark logo does
 * not vanish into a dark picture. Drawn once and overlaid on every shot, so it never blinks.
 * Nothing else goes on it — no business name, no phone number. That was asked for and it is also simply better.
 */
async function logoLayer(file, { W, H }, logoBuf) {
  // Small on purpose: a logo is a signature, not a poster. 7% of the frame width on wide, a touch more on tall.
  const box = Math.round(W * (W >= H ? 0.07 : 0.10));
  const pad = Math.round(box * 0.16);
  const side = Math.round(W * 0.04);
  const top = Math.round(SAFE.top(H) - H * 0.012);
  const fitted = await sharp(logoBuf).resize(box - pad * 2, box - pad * 2, { fit: "inside" }).png().toBuffer();
  const m = await sharp(fitted).metadata();
  const chipW = (m.width ?? box) + pad * 2, chipH = (m.height ?? box) + pad * 2;
  const left = W - side - chipW;
  const chip = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${chipW}" height="${chipH}">`
    + `<rect width="${chipW}" height="${chipH}" rx="12" fill="#ffffff" opacity="0.9"/></svg>`);
  // A band as wide as the frame and only as tall as the chip: overlaying a full transparent frame on every
  // one of ten thousand output frames was a fifth of the render time for nothing.
  await sharp({ create: { width: W, height: chipH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: chip, top: 0, left }, { input: fitted, top: pad, left: left + pad }])
    .png().toFile(file);
  fs.writeFileSync(`${file}.y`, String(top));
  return { file, y: top };
}

/** A piece of work already on disk from an earlier attempt: present, and not a truncated half-write.
 *  This is what makes a retry carry on from where it stopped instead of starting the film over. */
const done = (file, min = 512) => { try { return fs.statSync(file).size >= min; } catch { return false; } };

/** Wrap on width, counting Indic combining marks as zero width (they draw no advance). */
function wrap(text, perLine) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const len = (s) => [...s.replace(/\p{M}/gu, "")].length;
  const out = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if (len(line) + 1 + len(w) <= perLine) line += ` ${w}`;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

/**
 * The owner's text → the paragraphs the video is built from. A blank line always starts a new slide; a very long
 * paragraph is split on sentence ends so no slide runs much past ~20 seconds, and a stray short line is joined to
 * the one before it so the video does not flicker.
 */
/** People paste from WhatsApp and from chat assistants, so the text arrives with **bold**, headings and bullets in
 *  it. Those marks are not words: left in, the voice reads them and the screen shows "**समस्या पहचानिए". */
export function stripMarkup(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}[-*•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]{2,}/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

export function splitScript(raw, { maxChars = 320, minChars = 90 } = {}) {
  const clean = stripMarkup(String(raw || "")).replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}|\n(?=[-•*\d])/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  const parts = [];
  for (const p of paras) {
    if (p.length <= maxChars) { parts.push(p); continue; }
    const sentences = p.match(/[^.!?।]+[.!?।]+\s*|[^.!?।]+$/g) ?? [p];
    let buf = "";
    for (const s of sentences) {
      const t = s.trim();
      if (!t) continue;
      if (!buf) buf = t;
      else if (buf.length + 1 + t.length <= maxChars) buf += ` ${t}`;
      else { parts.push(buf); buf = t; }
    }
    if (buf) parts.push(buf);
  }
  const out = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev && p.length < minChars && prev.length + 1 + p.length <= maxChars + 120) out[out.length - 1] = `${prev} ${p}`;
    else out.push(p);
  }
  return out.slice(0, 200);
}

/**
 * A transcript → the paragraphs of a script, when the owner gave a recording and no text.
 * Sentences end where the speaker stopped for a breath (a gap ≥ 0.45 s) or where the transcript put a full stop;
 * paragraphs end at a long pause (≥ 0.9 s), or every ~40 words when the speaker never pauses — one picture
 * cannot carry a whole minute. Very short paragraphs are folded into their neighbour.
 */
export function scriptFromTranscript(words, { sentenceGap = 0.45, paraGap = 0.9, maxWords = 40, minWords = 10 } = {}) {
  const sentences = [];        // { text, gapAfter }
  let cur = [];
  for (let i = 0; i < words.length; i++) {
    const w = String(words[i].text || "").trim();
    if (!w) continue;
    cur.push(w);
    const next = words[i + 1];
    const gap = next ? next.start - words[i].end : 99;
    const stop = /[।.!?]$/.test(w) || gap >= sentenceGap || !next;
    if (stop && cur.length) {
      let text = cur.join(" ");
      if (!/[।.!?]$/.test(text)) text += /[ऀ-ॿ]/.test(text) ? "।" : ".";
      sentences.push({ text, gapAfter: gap });
      cur = [];
    }
  }
  const paras = [];
  let buf = [], count = 0;
  for (const sn of sentences) {
    buf.push(sn.text); count += sn.text.split(/\s+/).length;
    if (sn.gapAfter >= paraGap || count >= maxWords) { paras.push(buf.join(" ")); buf = []; count = 0; }
  }
  if (buf.length) paras.push(buf.join(" "));
  const out = [];
  for (const p of paras) {
    const n = p.split(/\s+/).length;
    if (out.length && n < minWords) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out.slice(0, 200);
}

/** The few words that go on the slide: the first clause, never the whole paragraph. */
export function headingOf(text, words = 7) {
  const first = String(text).split(/[.!?।]/)[0] || String(text);
  const w = first.split(/\s+/).filter(Boolean);
  return w.slice(0, words).join(" ") + (w.length > words ? "…" : "");
}

/** One slide: brand-coloured background, the owner's photo when there is one, a heading, and a footer line.
 *  Exported so it can be checked on the server without spending anything. */
export async function slide(file, { W, H, accent, kicker = "", heading = "", footer = "", photoBuf = null, logoBuf = null, big = false }) {
  const vertical = H > W;
  const pad = Math.round(W * (vertical ? 0.085 : 0.06));
  const topSafe = vertical ? SAFE.top(H) : Math.round(H * 0.07);
  const botSafe = vertical ? SAFE.bottomReel(H) : Math.round(H * 0.1);
  // A deep neutral card, not the brand colour: a wall of teal (or whatever the brand is) behind every title
  // read as a template. The brand colour lives on as the thin rule under the words and in the lit subtitle word.
  const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#0f141c"/><stop offset="1" stop-color="#1c2735"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.10"/><stop offset="0.6" stop-color="#000" stop-opacity="0.30"/><stop offset="1" stop-color="#000" stop-opacity="0.70"/></linearGradient></defs>`;
  const layers = [{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${grad}<rect width="${W}" height="${H}" fill="url(#g)"/></svg>`), top: 0, left: 0 }];

  let textTop = topSafe + Math.round(H * (vertical ? 0.05 : 0.08));
  if (photoBuf) {
    // Shown whole (never cropped) on a blurred copy of itself, so any shape of phone photo fits.
    const boxH = Math.round(H * (vertical ? 0.42 : 0.5));
    const boxW = W - pad * 2;
    try {
      const blur = await sharp(photoBuf).resize(W, boxH, { fit: "cover" }).blur(30).modulate({ brightness: 0.75 }).png().toBuffer();
      const fit = await sharp(photoBuf).resize(boxW, boxH, { fit: "inside" }).png().toBuffer();
      const m = await sharp(fit).metadata();
      layers.push({ input: blur, top: topSafe, left: 0 });
      layers.push({ input: fit, top: topSafe + Math.round((boxH - (m.height ?? boxH)) / 2), left: Math.round((W - (m.width ?? boxW)) / 2) });
      textTop = topSafe + boxH + Math.round(H * 0.045);
    } catch { /* a bad photo just leaves a plain slide */ }
  }
  layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${grad}<rect width="${W}" height="${H}" fill="url(#shade)"/></svg>`), top: 0, left: 0 });

  const size = Math.round(W * (big ? (vertical ? 0.088 : 0.055) : vertical ? 0.068 : 0.044));
  const perLine = Math.max(10, Math.round((W - pad * 2) / (size * (hasDev(heading) ? 0.62 : 0.55))));
  const lines = wrap(heading, perLine).slice(0, 5);
  const step = Math.round(size * 1.26);
  // With no photo the words ARE the picture, so the block sits in the middle of the frame instead of hugging the top.
  if (!photoBuf) {
    const blockH = lines.length * step + (kicker ? Math.round(size * 0.9) : 0);
    textTop = Math.max(topSafe + Math.round(H * 0.04), Math.round((H - botSafe - blockH) / 2));
  }
  let body = "";
  if (kicker) body += `<text x="${pad}" y="${textTop}" font-family="${LAT}" font-size="${Math.round(size * 0.4)}" font-weight="700" fill="#ffffff" opacity="0.7" letter-spacing="3">${esc(kicker.toUpperCase())}</text>`;
  const firstBaseline = textTop + (kicker ? Math.round(size * 0.9) : 0) + size;
  lines.forEach((l, i) => {
    body += `<text x="${pad}" y="${firstBaseline + i * step}" font-family="${fam(l)}" font-size="${size}" font-weight="800" fill="#ffffff">${esc(l)}</text>`;
  });
  if (lines.length) body += `<rect x="${pad}" y="${firstBaseline + (lines.length - 1) * step + Math.round(size * 0.55)}" width="${Math.round(W * 0.07)}" height="6" rx="3" fill="${accent}"/>`;
  if (footer) body += `<text x="${pad}" y="${H - botSafe + Math.round(H * 0.045)}" font-family="${fam(footer)}" font-size="${Math.round(W * 0.028)}" font-weight="600" fill="#ffffff" opacity="0.92">${esc(footer)}</text>`;
  layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`), top: 0, left: 0 });

  if (logoBuf) {
    try {
      const lw = Math.round(W * (vertical ? 0.13 : 0.09));
      const logo = await sharp(logoBuf).resize({ width: lw, height: lw, fit: "inside" }).png().toBuffer();
      const lm = await sharp(logo).metadata();
      const chip = await sharp({ create: { width: (lm.width ?? 40) + 24, height: (lm.height ?? 40) + 24, channels: 4, background: "#ffffffee" } })
        .composite([{ input: logo, top: 12, left: 12 }]).png().toBuffer();
      layers.push({ input: chip, top: topSafe - Math.round(H * 0.012), left: W - pad - (lm.width ?? 40) - 24 });
    } catch { /* no logo chip */ }
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: "#0f141c" } }).composite(layers).png().toFile(file);
  return file;
}

/** Every slide of one video shape, with the seconds each stays on screen. */
/** A piece of work already on disk from an earlier attempt: present and not a truncated half-write. */

export async function processExplainer(job, H) {
  const inp = job.input || {};
  const log = (m) => H.log(`[explain] ${String(job.id).slice(0, 8)} ${m}`);
  // Named after the job, not a random folder: that is what lets a retry find what the last attempt finished.
  const dir = path.join(os.tmpdir(), `explain-${job.id}`);
  fs.mkdirSync(dir, { recursive: true });
  sweepOldWork();
  /** Copy a paid-for file to the bucket the moment it exists (never fatal). */
  const keep = (file) => saveWork(H, job, file, { log }).catch(() => false);
  // An empty folder on a retry means the server lost it (restart, disk, the daily sweep): bring the work back.
  if (!fs.readdirSync(dir).length) await restoreWork(H, job, dir, { log }).catch(() => 0);
  // The list of changes is always taken fresh: a folder left from the last build may hold the previous edit's.
  if (Number(inp.edit?.n) > 0) { fs.rmSync(path.join(dir, "edits.json"), { force: true }); await fetchWork(H, job, "edits.json", dir, { log }).catch(() => false); }
  const ff = (args) => H.ffArr(args);
  const patch = (b) => H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, { method: "PATCH", body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }) }).catch(() => null);
  /** The owner may tap Stop while the voice is being recorded; then we stop too instead of paying for more lines. */
  const stillMine = async () => {
    const r = await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running&select=id`).catch(() => null);
    if (!r || !r.ok) return true;
    return ((await r.json().catch(() => [])) || []).length > 0;
  };

  let dropTemp = () => {};        // set once there is something temporary in the bucket to remove
  const t0 = Date.now();
  const marks = [];               // [stage, seconds] — printed at the end so a slow film says where it was slow
  const mark = (stage) => marks.push([stage, Math.round((Date.now() - t0) / 1000)]);
  // THE EDIT RUN. A finished video can be changed in the Scene Editor: the app writes edits.json next to the kept
  // work and queues the job again with input.edit = { n, credits }. Everything below then runs as usual, except
  // that the paragraphs come from the last build's manifest (never re-split, so scene numbers stay put), the
  // owner's changes are laid over the plan, and only the shots those changes touch are made again.
  const fmts = (Array.isArray(inp.formats) && inp.formats.length ? inp.formats : ["reel"]).filter((f) => SIZES[f]).slice(0, 1);
  const editRun = inp.edit && Number(inp.edit.n) > 0 ? { n: Number(inp.edit.n), credits: Number(inp.edit.credits) || 0 } : null;
  const prior = readManifest(dir, fmts[0]);
  const edit = editRun ? readEdits(dir) : null;
  /** An edit that cannot be applied leaves the video exactly as it was and gives the edit's credits back. */
  const editFailed = async (why) => {
    log(`edit ${editRun.n} not applied: ${why}`);
    const r = await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "done", error: null, progress: { text: `The edit could not be applied — ${why} Your video is unchanged.` }, cost: Number(inp.costOriginal ?? job.cost) || 0, input: { ...inp, edit: null, lastEditError: why }, updated_at: new Date().toISOString() }),
    }).catch(() => null);
    const rows = r?.ok ? await r.json().catch(() => []) : [];
    if (Array.isArray(rows) && rows.length && editRun.credits > 0) {
      await H.sb(`/rest/v1/rpc/grant_credits`, { method: "POST", body: JSON.stringify({ p_user: job.owner_id, p_amount: editRun.credits, p_reason: "explainer-edit-refund", p_ref: `${job.id}:edit:${editRun.n}` }) }).catch(() => null);
    }
    return { editFailed: true, why };
  };
  if (editRun && (!edit || !prior)) return editFailed(!prior ? "this video was made before editing existed, so its scenes are not on file." : "the list of changes could not be read.");
  try {
    resetPictureStats();
    if (editRun) await patch({ stage: "edit", progress: { text: "Applying your edits…" } });
    // The paragraphs: from the last build when there was one (an edit, or a retry after a finished build), so
    // that paragraph 4 is still paragraph 4; from the text otherwise.
    let parts = prior?.paragraphs?.length ? applyEditsToParts(prior, edit) : splitScript(inp.script || "");
    // No text but a recording: the recording IS the script. It is transcribed below and cut into paragraphs at
    // the speaker's own long pauses; every later step (planner, headings, subtitles) runs on that transcript.
    const autoScript = !parts.length && !!inp.voiceUrl;
    if (!parts.length && !autoScript) throw new Error("Please write the text of your video first, or upload a recording.");
    const accent = /^#[0-9a-f]{6}$/i.test(String(inp.accent || "")) ? inp.accent : "#0e9e90";
    const voice = inp.voice !== false;
    const GAP = gapOf(inp.pause);
    const lang = inp.lang || "hinglish";
    // The business name and phone number are deliberately NOT read here. They used to reach the slides, the
    // closing card and the planner's topic, so a renamed business kept showing its old name — and a name burnt
    // into every frame was wrong in the first place. Identity on screen is the logo, nothing else.
    // The owner asked for the logo alone on screen. A name and a phone number burnt into every frame is a poster,
    // not a film — and they are already in the closing card and in the post it goes out with.

    const title = String(edit?.title ?? inp.title ?? "").slice(0, 70);
    const titleChanged = !!edit && edit.title !== undefined && String(edit.title) !== String(prior?.title ?? inp.title ?? "");

    // 1. the owner's own pictures, used in order and then repeated
    await patch({ stage: "photos", progress: { text: "Getting your photos ready…" } });
    const photos = [];
    for (const url of (Array.isArray(inp.photos) ? inp.photos : []).slice(0, 12)) {
      const buf = await H.fetchPhoto(url).catch(() => null);
      if (buf) photos.push(buf);
    }
    const logoBuf = inp.logoUrl ? await H.fetchPhoto(inp.logoUrl).catch(() => null) : null;
    // The opening card exists only when there is something to put on it; the closing card only with a logo.
    // Both decide where the voice starts, so they are settled before a single second of audio is placed.
    const hasOpen = !!(title || logoBuf), hasClose = !!logoBuf;
    const headSec = hasOpen ? INTRO : 0, tailSec = hasClose ? OUTRO : 0;

    // 2a. the owner's OWN voice-over, when they brought one (they recorded it, or made it somewhere else).
    // Nothing is spoken by us then: the recording is the narration, its length is the length of the video, and
    // each slide is held for that paragraph's share of the words. Slides land within a second or two of the
    // sentence being spoken — close enough to read as deliberate, and it costs nothing to make.
    let ownVoice = null, secs, spoken, total;
    let ownPlaced = null;           // the owner's recording, sentence by sentence, when it could be heard
    let wordTimes = [];             // every word of the script on the film's clock — what the subtitles are cut from
    const captions = inp.captions !== false;
    /** A recording too big to send inline goes to the media bucket for the minutes the transcription takes. */
    const tempKeys = [];
    const uploadTemp = async (bytes, name) => {
      const key = `ai-media/${job.owner_id}/tmp-${job.id}-${name}`;
      const up = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${key}`, {
        method: "POST", headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}`, "Content-Type": "audio/mpeg", "x-upsert": "true" },
        body: bytes, signal: AbortSignal.timeout(120_000),
      });
      if (!up.ok) throw new Error(`temp upload ${up.status}`);
      tempKeys.push(key);
      return `${H.SUPA_URL}/storage/v1/object/public/media/${key}`;
    };
    dropTemp = () => { for (const key of tempKeys.splice(0)) fetch(`${H.SUPA_URL}/storage/v1/object/media/${key}`, { method: "DELETE", headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}` } }).catch(() => {}); };
    let voiceUrlNow = inp.voiceUrl || "";
    if (inp.voiceUrl) {
      await patch({ stage: "voice", progress: { text: "Reading your recording…" } });
      ownVoice = path.join(dir, "own-voice.wav");
      // The editor can replace the recording of a paragraph: the new clip is cut into the owner's recording in
      // that paragraph's place, the joined recording is kept with the job's work and becomes the job's recording
      // from here on. Once per edit (the marker), whatever the retries.
      const splices = Object.entries(edit?.paragraphs ?? {}).map(([p, e]) => ({ p: Number(p), url: e?.voiceUrl })).filter((x) => x.url && prior?.paragraphs?.[x.p]);
      const spliceMark = path.join(dir, `edit-${editRun?.n ?? 0}-voice.json`);
      if (splices.length && !fs.existsSync(spliceMark)) {
        await patch({ progress: { text: "Cutting your new recording in…" } });
        const src = path.join(dir, "own-voice.src");
        const buf = await (H.fetchOwnFile ? H.fetchOwnFile(inp.voiceUrl) : H.fetchPhoto(inp.voiceUrl)).catch(() => null);
        if (!buf) throw Object.assign(new Error("Your recording could not be read."), { userMessage: "your recording could not be read." });
        fs.writeFileSync(src, buf);
        const joined = await spliceRecording(ff, dir, src, splices, { prior, fetchFile: (u) => (H.fetchOwnFile ? H.fetchOwnFile(u) : H.fetchPhoto(u)), log });
        // Kept with the work under a new name each time, so the old recording is never overwritten mid-way.
        const key = `ai-media/${job.owner_id}/work/${job.id}/own-voice-e${editRun.n}.m4a`;
        const up = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${key}`, {
          method: "POST", headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}`, "Content-Type": "audio/mp4", "x-upsert": "true" },
          body: fs.readFileSync(joined), signal: AbortSignal.timeout(180_000),
        });
        if (!up.ok) throw new Error(`could not keep the joined recording: ${up.status}`);
        voiceUrlNow = `${H.SUPA_URL}/storage/v1/object/public/media/${key}`;
        fs.writeFileSync(spliceMark, JSON.stringify({ voiceUrl: voiceUrlNow }));
        // Everything that was measured on the old recording is stale: the wav, the transcript, its mp3.
        for (const f of ["own-voice.wav", "own.words.json", "own.mp3"]) fs.rmSync(path.join(dir, f), { force: true });
        fs.renameSync(joined, src);
      } else if (splices.length) {
        try { voiceUrlNow = JSON.parse(fs.readFileSync(spliceMark, "utf8")).voiceUrl || voiceUrlNow; } catch { /* keep the original */ }
      }
      if (!done(ownVoice, 100_000)) {
        const src = path.join(dir, "own-voice.src");
        if (!done(src, 1000)) {
          const buf = await (H.fetchOwnFile ? H.fetchOwnFile(voiceUrlNow) : H.fetchPhoto(voiceUrlNow)).catch(() => null);
          if (!buf) throw new Error("Your recording could not be read. Please upload it again.");
          fs.writeFileSync(src, buf);
        }
        // Delayed by the intro slide here, once: the final mix places this file as-is, exactly like our own
        // stitched voice track, which already carries that delay.
        await ff(["-y", "-loglevel", "error", "-i", src, "-af", `adelay=${Math.round(headSec * 1000)}|${Math.round(headSec * 1000)}`,
          "-ac", "2", "-ar", "48000", ownVoice]);
        fs.rm(src, { force: true }, () => {});
      }
      // 16-bit stereo at 48k: the WAV is its own clock, so no probe tool is needed. The intro delay baked in
      // above is not part of the narration, so it comes back off here.
      const D = Math.max(1, (fs.statSync(ownVoice).size - 44) / (48000 * 2 * 2) - headSec);
      if (D > MAX_SECONDS + 60) throw new Error("That recording is longer than 10 minutes. Please shorten it.");

      // Listen to the recording: every sentence is placed where it is actually spoken, not where its share of
      // the word count says it should be. This is the difference between a picture that changes WITH the
      // narration and one that changes near it.
      await patch({ progress: { text: "Listening to your recording…" } });
      const heard = await transcribeWords(ownVoice, { falKey: H.FAL_KEY, ff, lang, log, dir, tag: "own", upload: uploadTemp });
      if (heard) await keep(path.join(dir, "own.words.json"));
      if (autoScript) {
        if (!heard) throw Object.assign(new Error("We could not understand the recording. Please paste the text of what is said, or try again in a few minutes — your credits have been returned."), { userMessage: "We could not understand the recording. Please paste the text of what is said, or try again in a few minutes — your credits have been returned." });
        parts = scriptFromTranscript(heard.map((w) => ({ ...w, start: Math.max(0, w.start - headSec), end: Math.max(0, w.end - headSec) })));
        if (!parts.length) throw Object.assign(new Error("The recording seems to be silent. Please check it and try again — your credits have been returned."), { userMessage: "The recording seems to be silent. Please check it and try again — your credits have been returned." });
        log(`script from the recording: ${parts.length} paragraphs, ${parts.join(" ").split(/\s+/).length} words`);
      }
      const words = parts.map((t) => Math.max(1, t.split(/\s+/).filter(Boolean).length));
      const all = words.reduce((a, b) => a + b, 0);
      secs = words.map((w) => (D * w) / all);
      spoken = D;
      total = headSec + D + tailSec;
      log(`own voice-over: ${D.toFixed(1)}s over ${parts.length} slides`);
      if (heard) {
        const shifted = heard.map((w) => ({ ...w, start: Math.max(0, w.start - headSec), end: Math.max(0, w.end - headSec) }));
        const units = [], unitPara = [];
        parts.forEach((p, pi) => { for (const s of splitSentences(p)) { units.push(s); unitPara.push(pi); } });
        const placed = alignUnits(units, shifted, D, { log, tag: "own" });
        if (placed) {
          ownPlaced = { units, unitPara, placed };
          secs = parts.map((_, pi) => placed.reduce((a, x, k) => a + (unitPara[k] === pi ? x.end - x.start : 0), 0));
          spoken = secs.reduce((a, b) => a + b, 0);
          total = headSec + spoken + tailSec;
          wordTimes = alignWords(units, shifted, placed).map((w) => ({ ...w, start: w.start + headSec, end: w.end + headSec }));
        }
      }
    }

    // 2b. our own voice, paragraph by paragraph — this is what sets the length of the video.
    // Each recorded line is remembered in secs.json, so a retry after a crash or a restart picks up at the
    // paragraph it stopped on instead of paying to record the whole script again. A 10-minute video is dozens
    // of recordings; starting over from the first one every time is a long wait for the owner.
    const secsFile = path.join(dir, "secs.json");
    const saved = (() => { try { const v = JSON.parse(fs.readFileSync(secsFile, "utf8")); return Array.isArray(v) ? v : []; } catch { return []; } })();
    // Only an unbroken run from the start can be reused: a gap in the middle would shift every later paragraph
    // onto the wrong slide, so the first missing recording ends the resume.
    if (!ownVoice) {
    // A paragraph the editor changed (new words, or "say it again") loses its recording here and is recorded afresh
    // below; every other paragraph keeps its own — the film is re-cut around the new length.
    if (edit && voice) {
      for (const [p, e] of Object.entries(edit.paragraphs ?? {})) {
        const i = Number(p);
        if (!(i >= 0 && i < parts.length)) continue;
        const textChanged = e?.text !== undefined && String(e.text) !== String(prior?.paragraphs?.[i]?.text ?? "");
        // "Say it again" asked for outright, or new words without "subtitles only" — either way a fresh recording.
        if (e?.revoice === true || (textChanged && e?.revoice !== false)) {
          for (const f of [`vo-${i}.wav`, `vo-${i}.words.json`, `vo-${i}.mp3`]) fs.rmSync(path.join(dir, f), { force: true });
          saved[i] = 0;
          log(`paragraph ${i + 1} will be recorded again (edit)`);
        }
        // New words over the old recording ("subtitles only"): the transcript of the audio is unchanged, and the
        // alignment of the new words against it is redone every run anyway — nothing to throw away.
      }
    }
    // Every paragraph whose recording is still here is reused, whatever its neighbours did: each one is its own
    // file with its own measured length, so a hole in the middle is simply recorded again.
    secs = parts.map((_, i) => (Number.isFinite(saved[i]) && saved[i] > 0 && (!voice || done(path.join(dir, `vo-${i}.wav`), 2048)) ? saved[i] : 0));
    const todoLines = secs.map((v, i) => (v > 0 ? -1 : i)).filter((i) => i >= 0);
    const had = parts.length - todoLines.length;
    if (had) log(`reusing ${had} of ${parts.length} recorded line(s)`);
    await patch({ stage: "voice", progress: { text: `Recording the voice (${had} of ${parts.length})…` } });
    for (const i of todoLines) {
      if (!(await stillMine())) throw new Error("Cancelled by user");
      let sec;
      if (voice) {
        try {
          await H.ttsLine(parts[i], path.join(dir, `vo-${i}-raw.wav`), inp.voiceStyle || "warm", lang, null);
          // The voice engine leaves 0.2-0.6s of silence on each end. Left in, every measured boundary after it
          // lands in the wrong place, and the video slowly slides away from the voice.
          sec = await trimSilence(ff, path.join(dir, `vo-${i}-raw.wav`), path.join(dir, `vo-${i}.wav`));
          fs.rm(path.join(dir, `vo-${i}-raw.wav`), { force: true }, () => {});
        }
        catch (e) { log(`tts failed on part ${i + 1}: ${e?.message ?? e}`); throw new Error("The voice could not be recorded — your credits have been returned."); }
      } else {
        sec = Math.max(2.5, parts[i].split(/\s+/).filter(Boolean).length / WPS);
      }
      secs[i] = sec;
      try { fs.writeFileSync(secsFile, JSON.stringify(secs)); } catch { /* a retry just records this line again */ }
      if (voice) { await keep(path.join(dir, `vo-${i}.wav`)); await keep(secsFile); }
      const doneLines = secs.filter((v) => v > 0).length;
      if (doneLines % 3 === 0 || doneLines === parts.length) {
        await patch({ progress: { text: `Recording the voice (${doneLines} of ${parts.length})…` } });
        await H.beat?.().catch?.(() => {});
      }
    }
    // The mixed voice track is rebuilt whenever a line was recorded: it is placed against the new cut below.
    if (todoLines.length) fs.rmSync(path.join(dir, "voice.wav"), { force: true });
    spoken = secs.reduce((a, b) => a + b + GAP, 0);
    if (spoken > MAX_SECONDS + 45) throw new Error("That text is longer than 10 minutes of speech. Please shorten it a little.");
    total = headSec + spoken + tailSec;
    }

    // 3. THE CUT. The film's unit is a shot of a few seconds, not a paragraph: a paragraph of this script runs
    // up to 33 seconds, and one picture held that long is a slideshow. Sentences are timed against the voice we
    // already recorded, packed into shots, and each shot gets its own picture or a re-framing of the last one.
    const fmt0 = fmts[0];
    const size = SIZES[fmt0];
    const pace = pacing(spoken);
    await patch({ stage: "shots", progress: { text: "Working out the cut…" } });

    // Our own voice is recorded a paragraph at a time, so each recording is listened to on its own: the sentence
    // boundaries inside it come from the words actually spoken. Three at a time — they are network calls.
    // Single-sentence paragraphs need no boundary, but their word timing still feeds the subtitles.
    const paraWords = new Map();      // paragraph → transcript words (its own clock, from 0)
    if (!ownVoice && voice && H.FAL_KEY) {
      await patch({ progress: { text: "Listening to the voice…" } });
      const todo = parts.map((_, p) => p);
      for (let k = 0; k < todo.length; k += 3) {
        if (!(await stillMine())) throw new Error("Cancelled by user");
        await Promise.all(todo.slice(k, k + 3).map(async (p) => {
          const w = await transcribeWords(path.join(dir, `vo-${p}.wav`), { falKey: H.FAL_KEY, ff, lang, log, dir, tag: `vo-${p}` });
          if (w) { paraWords.set(p, w); await keep(path.join(dir, `vo-${p}.words.json`)); }
        }));
        await H.beat?.().catch?.(() => {});
      }
      log(`heard ${paraWords.size} of ${parts.length} recorded paragraphs`);
    }

    const shots = [];                 // { text, sec, para, slice, slices }
    const paraSeconds = [];
    const paraWordTimes = [];         // paragraph → [{ text, start, end }] on the paragraph's own clock
    for (let p = 0; p < parts.length; p++) {
      const sentences = splitSentences(parts[p]);
      let beatSecs = null;
      const wordsHere = paraWords.get(p);
      if (ownPlaced) {
        // Already placed against the whole recording.
        beatSecs = ownPlaced.placed.filter((_, k) => ownPlaced.unitPara[k] === p).map((x) => x.end - x.start);
        if (beatSecs.length !== sentences.length) beatSecs = null;
      } else if (wordsHere) {
        const placed = alignUnits(sentences, wordsHere, secs[p], { log, tag: `vo-${p}` });
        if (placed) {
          beatSecs = placed.map((x) => x.end - x.start);
          paraWordTimes[p] = alignWords(sentences, wordsHere, placed);
        }
      }
      if (!beatSecs) {
        if (sentences.length === 1) {
          beatSecs = [secs[p]];
        } else if (ownVoice) {
          // One recording for the whole film: the word-share guess is snapped onto the pauses the speaker made.
          const w = sentences.map((x) => Math.max(1, x.split(/\s+/).filter(Boolean).length));
          const all = w.reduce((a, b) => a + b, 0);
          beatSecs = w.map((x) => (secs[p] * x) / all);
        } else {
          beatSecs = await measureBeats(ff, path.join(dir, `vo-${p}.wav`), dir, String(p), sentences, secs[p]);
        }
      }
      const packed = packBeats(sentences.map((t, k) => ({ text: t, sec: beatSecs[k] })), pace);
      for (const s of packed) shots.push({ text: s.beats.map((b) => b.text).join(" "), sec: s.sec, para: p, slice: s.slice, slices: s.slices });
      paraSeconds.push(secs[p]);
    }
    log(`${parts.length} paragraphs → ${shots.length} shots (${pace.target}s target)`); mark("voice+cut");

    // Whole frames, carried, so picture and voice come from the same integer and cannot drift apart.
    const GAPe = ownVoice ? 0 : GAP;
    const shotFrames = quantise(shots.map((s) => s.sec), FPS);
    shots.forEach((s, i) => { s.frames = shotFrames[i]; });
    // Rebuild the timeline from those frames: the voice is placed where the picture actually is.
    const paraStart = [];
    let cursor = headSec;
    for (let p = 0; p < parts.length; p++) {
      paraStart.push(cursor);
      const own = shots.filter((s) => s.para === p).reduce((a, s) => a + s.frames, 0) / FPS;
      cursor += own + GAPe;
    }
    spoken = cursor - headSec - GAPe;
    total = headSec + spoken + tailSec;
    // Where each shot sits on the film's clock — the subtitles and the dissolves are placed against this.
    const shotStart = [];
    { let t = headSec, lastPara = -1; for (let i = 0; i < shots.length; i++) { if (shots[i].para !== lastPara) { t = paraStart[shots[i].para]; lastPara = shots[i].para; } shotStart.push(t); t += shots[i].frames / FPS; } }

    // 3a. THE WORDS ON THE CLOCK. From the transcript when we have one, otherwise spread by letter count over
    // the sentence's shot(s). Either way the film ends up with one list: every word of the script, start and end.
    if (!wordTimes.length && paraWordTimes.some(Boolean)) {
      for (let p = 0; p < parts.length; p++) for (const w of paraWordTimes[p] || []) wordTimes.push({ text: w.text, start: w.start + paraStart[p], end: w.end + paraStart[p], para: p });
    }
    const timedParas = new Set(wordTimes.map((w) => w.para ?? -1));
    if (ownPlaced) parts.forEach((_, p) => timedParas.add(p));
    {
      // Paragraphs the transcript did not cover: the shot's own text, spread over the shot (slices of one
      // sentence are one line, so the words run across all of them instead of restarting on each).
      const lines = [];
      for (let i = 0; i < shots.length; i++) {
        if (timedParas.has(shots[i].para)) continue;
        if (shots[i].slice > 0 && lines.length && lines[lines.length - 1].text === shots[i].text) { lines[lines.length - 1].sec += shots[i].frames / FPS; continue; }
        lines.push({ text: shots[i].text, start: shotStart[i], sec: shots[i].frames / FPS, para: shots[i].para });
      }
      const spread = wordCues(lines, { perGroup: 1 }).map((c) => ({ text: c.words[0], start: c.start, end: c.end }));
      wordTimes.push(...spread);
      wordTimes.sort((a, b) => a.start - b.start);
    }

    // 3b. What is on screen for each shot, and the words that go with it.
    const style = ["slides", "footage", "images"].includes(String(inp.style)) ? String(inp.style) : "images";
    // Kept with the work too: the Scene Editor shows them as thumbnails and offers them for other scenes.
    const photoFiles = photos.map((buf, i) => { const f = path.join(dir, `own-${i}.jpg`); if (!done(f, 4096)) { fs.writeFileSync(f, buf); keep(f); } return f; });
    // A sentence too long for one shot is cut into several PICTURES, but it is still ONE thing being said. The
    // planner must see it once, or it writes a different heading over each half of the same sentence — which is
    // exactly how two different titles ended up over one spoken line.
    const unit = [];                  // one entry per distinct thing said
    const unitOf = [];                // shot index → unit index
    for (let i = 0; i < shots.length; i++) {
      const same = unit.length && shots[i].text === unit[unit.length - 1].text && shots[i].para === unit[unit.length - 1].para;
      if (same) unit[unit.length - 1].sec += shots[i].frames / FPS;
      else unit.push({ text: shots[i].text, sec: shots[i].frames / FPS, para: shots[i].para, opensParagraph: i === 0 || shots[i - 1].para !== shots[i].para });
      unitOf.push(unit.length - 1);
    }
    if (unit.length !== shots.length) log(`${shots.length} shots cover ${unit.length} spoken lines`);
    // The plan (what is on screen for each line) is saved with the job's work: a retry after a crash, a restart
    // or a paused picture service reuses it, so the pictures already made still belong to their shots. Planned
    // fresh, the planner would order different pictures for the same lines and every cached picture would be wrong.
    const planFile = path.join(dir, `plan-${fmt0}.json`);
    let saved_ = null;
    try { saved_ = JSON.parse(fs.readFileSync(planFile, "utf8")); } catch { /* first attempt */ }
    let brief = null, unitPlan = null;
    // The map from the last build to this one (edit runs): each spoken line finds the line it was in the finished
    // film — by its words, then by its place in the paragraph — and takes that line's order, heading and picture
    // with it. A changed paragraph therefore keeps every picture that still fits, and only the lines the owner
    // rewrote beyond recognition start blank (they borrow a neighbour's picture until the owner orders one).
    const mapped = prior ? mapPrior(prior, saved_, { unit, shots, unitOf, dir }) : null;
    if (mapped) {
      brief = saved_?.brief ?? null; unitPlan = mapped.unitPlan;
      log(`plan carried over from the finished film: ${mapped.matched} of ${unit.length} lines matched, ${mapped.seed.size} picture(s) kept`);
    } else if (saved_ && Array.isArray(saved_.unitPlan) && saved_.unitPlan.length === unit.length) {
      brief = saved_.brief; unitPlan = saved_.unitPlan;
      log(`reusing the plan from the last attempt (${unitPlan.length} lines)`);
    } else {
      brief = style === "slides" ? null : await understandScript(parts.join("\n\n"), { geminiKey: H.GEMINI, log });
      unitPlan = style === "slides"
        ? unit.map(() => ({ kind: "text", picture: "", search: "", heading: "" }))
        : await planShots(unit, { geminiKey: H.GEMINI, brief, hasPhotos: photoFiles.length > 0, prefer: style === "images" ? "images" : "mixed", log });
      // THE ORDER CHECK: every order read against the rulebook, by code and by a text model, before any picture
      // is paid for. Rewrites are logged with their reason.
      if (style !== "slides") {
        await patch({ progress: { text: "Checking the picture orders…" } });
        unitPlan = await reviewOrders(unitPlan, unit, { geminiKey: H.GEMINI, brief, log });
        if (pictureStats.rewritten || pictureStats.codeFixed) log(`order check: ${pictureStats.codeFixed} order(s) fixed in code, ${pictureStats.rewritten} rewritten by review, of ${unitPlan.length} — before any picture was made`);
      }
      try { fs.writeFileSync(planFile, JSON.stringify({ brief, unitPlan })); await keep(planFile); } catch { /* a retry plans again */ }
    }
    // Every shot of one spoken line carries that line's heading and that line's picture.
    const plan = shots.map((_, i) => unitPlan[unitOf[i]]);
    /** Where a new picture for shot i is written: a new name on every edit, so a picture another scene still
     *  shows (the map above may hand shot 7 the file once made for shot 5) is never written over. */
    const picFile = (i) => path.join(dir, `img-${fmt0}-${i}${editRun ? `-e${editRun.n}` : ""}.jpg`);

    // THE OWNER'S CHANGES, laid over the plan. Scene = shot, numbered as the editor showed them (the last film's
    // numbers, carried across by the map). A heading belongs to the spoken line, so it changes on every shot of
    // that line (the plan entries of one line are one shared object); a picture belongs to the shot.
    const seedPictures = mapped?.seed ?? new Map();   // shot → picture file kept from the finished film
    const forcePic = new Map();       // shot → "regen" | a file already on disk (own upload / picked from the film)
    const moveOverride = new Map();
    const noCaptions = new Set();
    const scenesEdited = new Set();
    let timingChanged = false;
    if (edit) {
      // A new title only redraws the opening card — unless it makes the card appear or disappear (no logo), which
      // moves the whole film by the card's length.
      const headMoved = titleChanged && !logoBuf && (!!title !== !!String(prior?.title ?? inp.title ?? ""));
      timingChanged = Object.values(edit.paragraphs ?? {}).some((x) => x && (x.text !== undefined || x.revoice || x.voiceUrl)) || headMoved;
      const toNew = (k) => (mapped?.priorToNew?.has(k) ? mapped.priorToNew.get(k) : (timingChanged ? -1 : k));
      const headingChanged = new Set();
      for (const [k, e] of Object.entries(edit.scenes ?? {})) {
        const i = toNew(Number(k));
        if (!(i >= 0 && i < shots.length) || !e || typeof e !== "object") { if (e) log(`scene ${k}: no longer in the film after the text change — its edit is skipped`); continue; }
        scenesEdited.add(i);
        if (e.heading !== undefined) { plan[i].heading = String(e.heading ?? "").trim().slice(0, 60); headingChanged.add(i); }
        if (e.move && typeof e.move === "string") moveOverride.set(i, e.move);
        if (e.captions === false) noCaptions.add(i);
        const pic = e.picture && typeof e.picture === "object" ? e.picture : null;
        if (pic?.mode === "regen") {
          const frame = ["object", "hands", "screen", "place", "pair", "person"].includes(pic.frame) ? pic.frame : (plan[i].frame || "object");
          const subject = String(pic.subject ?? plan[i].subject ?? "").trim().slice(0, 240);
          if (subject) {
            Object.assign(plan[i], { kind: "image", frame, subject, moment: String(pic.moment ?? "").trim().slice(0, 240), backup: "", abstract: false, userOrder: true });
            fs.rmSync(picFile(i), { force: true });
            forcePic.set(i, "regen");
          }
        } else if (pic?.mode === "own" && pic.url) {
          const buf = await (H.fetchOwnFile ? H.fetchOwnFile(pic.url) : H.fetchPhoto(pic.url)).catch(() => null);
          if (buf) { await ownPictureFile(buf, picFile(i), size); await keep(picFile(i)); if (plan[i].kind !== "image") plan[i].kind = "image"; forcePic.set(i, picFile(i)); }
          else log(`scene ${k}: the uploaded picture could not be read — keeping the old one`);
        } else if (pic?.mode === "pick" && typeof pic.from === "string") {
          const name = path.basename(pic.from);
          const from = path.join(dir, name);
          if (/^(img-[a-z]+-\d+(-e\d+)?|own-\d+)\.jpg$/.test(name) && done(from, 4096) && from !== picFile(i)) { fs.copyFileSync(from, picFile(i)); await keep(picFile(i)); if (plan[i].kind !== "image") plan[i].kind = "image"; forcePic.set(i, picFile(i)); }
          else log(`scene ${k}: picked picture ${name} is not on file — keeping the old one`);
        } else if (pic?.mode === "card") {
          plan[i].kind = "text";
          seedPictures.delete(i);
        }
      }
      // The plan now carries the owner's orders and headings: saved, so the next edit starts from THIS film.
      try { fs.writeFileSync(planFile, JSON.stringify({ brief, unitPlan })); await keep(planFile); } catch { /* the manifest still has it */ }
      // Which shots are made again: everything after a change in timing (new words or a new recording move every
      // cut that follows), otherwise just the edited scenes, the other shots of their lines, and the shot after
      // each (its dissolve starts from the edited one). Cards and headers are per shot and go with them.
      const stale = staleShotsFor({ shots, unitOf, scenesEdited, timingChanged, headingChanged });
      for (const i of stale) for (const f of [`shot-${fmt0}-${i}.mp4`, `shot-${fmt0}-${i}.mp4.json`, `hdr-${fmt0}-${i}.png`, `hdr-${fmt0}-${i}.png.y`, `last-${fmt0}-${i}.png`, `card-${fmt0}-${i}.png`]) fs.rmSync(path.join(dir, f), { force: true });
      for (const f of [`explainer-${fmt0}.mp4`, `shot-${fmt0}-close.mp4`, `list-${fmt0}.txt`]) fs.rmSync(path.join(dir, f), { force: true });
      if (titleChanged) for (const f of [`open-${fmt0}.png`, `shot-${fmt0}-open.mp4`, `last-${fmt0}-intro.png`]) fs.rmSync(path.join(dir, f), { force: true });
      log(`edit ${editRun.n}: ${scenesEdited.size} scene(s) changed, ${Object.keys(edit.paragraphs ?? {}).length} paragraph(s), ${stale.size === shots.length ? "every shot" : `${stale.size} shot(s)`} to remake${timingChanged ? " (timing changed)" : ""}`);
    } else if (mapped) {
      // A build from a finished film without an edit list (a paused edit carried on, say): every shot is made again
      // against the mapped plan, and nothing cached from the old cut may slip in.
      for (const name of fs.readdirSync(dir)) if (/^(shot|hdr|last|card|list)-/.test(name) || /^explainer-[a-z]+\.mp4$/.test(name)) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    }

    // The logo, once, on its own transparent layer — it must not blink on and off with the headings.
    let logoPng = null;
    if (logoBuf) {
      const f = path.join(dir, `logo-${fmt0}.png`);
      if (done(f, 512) && fs.existsSync(`${f}.y`)) logoPng = { file: f, y: Number(fs.readFileSync(`${f}.y`, "utf8")) || 0 };
      else logoPng = await logoLayer(f, size, logoBuf);
    }

    // 4. the voice track, placed against the frames above
    let voiceWav = ownVoice;
    if (!ownVoice && voice) {
      const inputs = [];
      const delays = [];
      for (let i = 0; i < parts.length; i++) {
        const ms = Math.round(paraStart[i] * 1000);
        inputs.push("-i", path.join(dir, `vo-${i}.wav`));
        delays.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
      }
      voiceWav = path.join(dir, "voice.wav");
      // Every chain is separated by ";" — including the last one before the mix. Without that separator ffmpeg
      // reads "…[a12][a0][a1]…amix" as one chain and refuses the whole graph.
      if (!done(voiceWav, 100_000)) await ff(["-y", "-loglevel", "error", ...inputs, "-filter_complex",
        `${delays.join(";")};${parts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${parts.length}:normalize=0:dropout_transition=0[v]`,
        "-map", "[v]", "-ac", "2", "-ar", "48000", voiceWav]);
    }

    // 4b. THE PICTURES, made and checked BEFORE the shots are cut.
    // Three at a time: these are network calls, the ffmpeg work is not, and doing them up front makes the whole
    // film faster than making them one by one inside the encode loop. Each one is judged by a model that was
    // told nothing about what we wanted; one that fails is re-ordered differently, not rolled again.
    const { budget, perParagraph } = allocatePictures(paraSeconds, spoken, {});
    const pictures = new Map();          // shot index → jpg on disk
    /** Google says no money / no quota. A top-up takes minutes to land, so the film waits and asks again
     *  rather than shipping a wall of word cards or giving up on the first refusal. */
    const providerPause = async (why, round) => {
      const mins = round === 0 ? 2 : 3;
      log(`picture service refused (${why}) — waiting ${mins} minutes before trying again (${round + 1}/2)`);
      await patch({ progress: { text: `The AI picture service is busy — waiting ${mins} minutes and trying again…` } });
      const until = Date.now() + mins * 60_000;
      while (Date.now() < until) { await new Promise((r) => setTimeout(r, 20_000)); if (!(await stillMine())) throw new Error("Cancelled by user"); await H.beat?.().catch?.(() => {}); }
    };
    if (style !== "slides") {
      log(`picture budget: ${budget} (${perParagraph.join(",")})`);
      const wantPic = [];
      const spentIn = new Array(parts.length).fill(0);
      let lastSource = -99;
      // Pictures kept from the finished film stay with their lines, and count against their paragraph's budget, so
      // an edit never quietly buys a new picture for a line that had none. A scene the editor gave a picture of
      // its own is a source whatever the budget says; one whose picture is already on disk (uploaded or picked)
      // is simply taken.
      for (const [i, f] of seedPictures) if (plan[i]?.kind !== "text" && done(f, 4096)) pictures.set(i, f);
      for (const [i, v] of forcePic) { if (v === "regen") pictures.delete(i); else if (done(v, 4096)) pictures.set(i, v); }
      for (const [i] of pictures) spentIn[shots[i].para] += 1;
      for (let i = 0; i < shots.length; i++) {
        const w = plan[i];
        if (pictures.has(i)) { lastSource = i; continue; }
        if (forcePic.get(i) === "regen") { wantPic.push(i); lastSource = i; continue; }
        if (w.kind !== "image" || !w.subject) continue;
        if (mapped && !editRun) continue;                       // a carried-over film buys nothing new on its own
        if (i - lastSource < MAX_SHOTS_PER_SOURCE && shots[i].para === shots[lastSource]?.para) continue;  // still on the last one
        if (spentIn[shots[i].para] >= (perParagraph[shots[i].para] ?? 1)) continue;
        spentIn[shots[i].para] += 1; lastSource = i;
        wantPic.push(i);
      }
      await patch({ stage: "pictures", progress: { text: wantPic.length ? `Making the pictures (0 of ${wantPic.length})…` : editRun ? "Applying your edits…" : "Getting the pictures ready…" } });
      const wideShape = size.W >= size.H;
      let kept = 0;
      // Up to three rounds: the first is the normal pass; a round ends early the moment Google refuses for
      // money or quota, the film waits, and the next round picks up the pictures still missing.
      let refusedAny = null;
      for (let round = 0; round < 3; round++) {
        let refused = null;
        kept = 0;
        const PAR = 4;                                   // network-bound, not CPU: four in flight is fine
        for (let k = 0; k < wantPic.length && !refused; k += PAR) {
          if (!(await stillMine())) throw new Error("Cancelled by user");
          await Promise.all(wantPic.slice(k, k + PAR).map(async (i) => {
            const file = picFile(i);
            if (done(file, 8_000)) { pictures.set(i, file); kept++; return; }
            const w = plan[i];
            const r = await makePicture(H.GEMINI, {
              frame: w.frame, subject: w.subject, moment: w.moment, backup: w.backup, abstract: w.abstract === true,
              idea: w.idea || w.subject, heading: w.heading, nextHeading: plan[i + 1]?.heading ?? "",
            }, { wide: wideShape, world: brief?.world ?? "", look: brief?.look ?? "", log, tag: `[explain] ${String(job.id).slice(0, 8)} shot ${i}`, judge: w.userOrder !== true })
              .catch((e) => { if (e?.provider) refused = e; return { buf: null }; });
            if (r.buf) { await sharp(r.buf).jpeg({ quality: 88 }).toFile(file); pictures.set(i, file); kept++; await keep(file); }
          }));
          await patch({ progress: { text: `Making the pictures (${Math.min(wantPic.length, k + PAR)} of ${wantPic.length})…` } });
          await H.beat?.().catch?.(() => {});
        }
        if (!refused) { refusedAny = null; break; }
        refusedAny = refused;
        if (round === 2 || pictures.size >= Math.ceil(wantPic.length * 0.85)) break;
        await providerPause(refused.message, round);
      }
      log(`pictures: ${pictures.size} of ${wantPic.length} passed the check`); mark("pictures");
      // The service would not give us the pictures (no balance, no quota, or nothing at all came back). The film
      // does not fail and it does not ship half-made: it PAUSES. Everything made so far is kept (bucket + folder),
      // the row says why, the credits stay with the job, and the worker's own sweep queues it again when the
      // service answers — carrying on from exactly this point. After six hours of pausing it fails and refunds.
      const lastRefusal = refusedAny;
      if ((lastRefusal || !pictures.size) && wantPic.length >= 3 && pictures.size < Math.ceil(wantPic.length * 0.85)) {
        const why = lastRefusal ? `AI picture service refused (${String(lastRefusal.message).slice(0, 80)})` : "AI picture service returned nothing";
        log(`PAUSED — ${why}; ${pictures.size}/${wantPic.length} pictures kept, will continue automatically`);
        H.alert?.("Long video paused — AI picture service refused", `Job ${job.id}\nOwner ${job.owner_id}\n${why}\n${pictures.size} of ${wantPic.length} pictures made so far.\n\nTop up / check the Gemini balance and quota — the video continues by itself once the service answers (it gives up after 6 hours).`, "money");
        const r = await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
          method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "failed", error: `PAUSED: ${why}. The video will continue automatically; your credits are safe.`, progress: { text: `Paused — the AI picture service is busy. It will continue by itself (${pictures.size} of ${wantPic.length} pictures ready).` }, updated_at: new Date().toISOString() }),
        }).catch(() => null);
        if (r?.ok) return { paused: true, pictures: pictures.size, wanted: wantPic.length };
        // Could not record the pause (cancelled meanwhile?): fall back to a plain failure with refund.
        const e = new Error("The AI picture service is unavailable right now. Please try again in a few minutes — your credits have been returned.");
        e.userMessage = e.message;
        throw e;
      }
    }
    // 4c. SUBTITLES. Groups of a few words, the spoken one lit, never running past a sentence end. Each shot
    // is handed only the cues that fall inside it, on its own clock, so the burn happens shot by shot inside the
    // same pass that draws the shot — no second pass over a ten-minute file.
    const cuesByShot = new Map();
    if (captions && wordTimes.length) {
      const perGroup = size.W >= size.H ? 5 : 4;
      const cues = [];
      let grp = [];
      const flush = () => { if (!grp.length) return; const ws = grp.map((w) => w.text); grp.forEach((w, k) => cues.push({ words: ws, hi: k, start: w.start, end: w.end })); grp = []; };
      for (const w of wordTimes) {
        grp.push(w);
        if (grp.length >= perGroup || /[.!?।]$/.test(w.text)) flush();
      }
      flush();
      for (let i = 1; i < cues.length; i++) if (cues[i].start < cues[i - 1].end) cues[i].start = cues[i - 1].end;
      // Brand colour for the lit word when it is light enough to read on black; otherwise a warm white.
      const hex = accent.replace("#", ""); const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const capAccent = lum > 0.55 ? accent : "#FFD966";
      await renderCuePngs(path.join(dir, `cues-${fmt0}`), cues.filter((c) => c.end > c.start + 0.04), { W: size.W, H: size.H, accent: capAccent, bottom: size.W >= size.H ? Math.round(size.H * 0.075) : undefined });
      for (let i = 0; i < shots.length; i++) {
        const s0 = shotStart[i], s1 = s0 + shots[i].frames / FPS;
        const mine = cues.filter((c) => c.png && c.end > s0 + 0.02 && c.start < s1 - 0.02)
          .map((c) => ({ png: c.png, y: c.y, start: Math.max(0, c.start - s0), end: Math.min(s1 - s0, c.end - s0) }));
        if (mine.length) cuesByShot.set(i, mine);
      }
      for (const i of noCaptions) cuesByShot.delete(i);
      log(`subtitles: ${cues.length} cues over ${cuesByShot.size} shots${noCaptions.size ? ` (off on ${noCaptions.size} by the editor)` : ""}`);
    }

    const cardCache = new Map();
    const fallbackCard = async (i, text, heading) => {
      const key = heading || text.slice(0, 80);
      if (cardCache.has(key)) return cardCache.get(key);
      const f = path.join(dir, `card-${fmt0}-${i}.png`);
      // The whole sentence when it fits on a card; a title-length cut of it otherwise. A sentence chopped at
      // nine words with an ellipsis is the one thing a word card must never show.
      const first = String(text).split(/(?<=[.!?।])\s+/)[0] || String(text);
      await wordCardPng(f, { ...size, accent, text: heading || (first.length <= 120 ? first : headingOf(text, 12)) });
      cardCache.set(key, f);
      return f;
    };
    const makeShots = () => buildShots(dir, size, {
      shots, plan, pictures: style === "slides" ? shots.map(() => 0) : perParagraph,
      photoFiles, accent, logoPng, ff, findClip, pictures, H,
      tag: fmt0, fallbackCard, cuesByShot, introLast, moveOverride,
      onStep: async (i) => {
        if (i % 4 === 3 || i === shots.length - 1) { await patch({ progress: { text: `Making the video (${i + 1} of ${shots.length})…` } }); await H.beat?.().catch?.(() => {}); }
        if (!(await stillMine())) throw new Error("Cancelled by user");
      },
    });


    // 5. one delivery encode per shape (slides → video in a single pass; no intermediate files)
    const musicPath = inp.music ? H.musicFile(inp.music) : null;
    const outputs = [];
    const encode = async (shotFiles) => {
      const fmt = fmt0;
      await patch({ stage: "encode", progress: { text: "Finishing your video…" } });
      const { W, H: HH } = size;
      // Opening and closing cards. The opening carries the logo and the owner's own title, and is skipped
      // entirely when there is neither — an empty branded card at the head of a film is worse than no card.
      const pieces = [];
      if (openMp4) pieces.push(openMp4);
      pieces.push(...shotFiles);
      // The closing card is the logo alone, or nothing at all when there is no logo. It dissolves out of the
      // last shot like every other cut.
      if (hasClose) {
        const closePng = path.join(dir, `close-${fmt}.png`);
        if (!done(closePng, 4096)) await slide(closePng, { ...size, accent, heading: "", logoBuf, big: true });
        const closeMp4 = path.join(dir, `shot-${fmt}-close.mp4`);
        const lastShotPng = path.join(dir, `last-${fmt}-${shots.length - 1}.png`);
        if (!done(closeMp4, 20_000)) await stillShot(ff, closeMp4, { png: closePng, frames: Math.round(tailSec * FPS), W, H: HH, prevPng: done(lastShotPng, 1000) ? lastShotPng : null });
        pieces.push(closeMp4);
      }
      const list = path.join(dir, `list-${fmt}.txt`);
      fs.writeFileSync(list, pieces.map((f) => `file '${f}'`).join("\n") + "\n");
      const out = path.join(dir, `explainer-${fmt}.mp4`);
      const args = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list];
      if (voiceWav) args.push("-i", voiceWav);
      if (musicPath) args.push("-stream_loop", "-1", "-i", musicPath);
      const aIdx = voiceWav ? 1 : -1;
      const mIdx = musicPath ? (voiceWav ? 2 : 1) : -1;
      let filter = "";
      if (aIdx >= 0 && mIdx >= 0) {
        // the voice is used twice: once in the mix, once as the key that pushes the music down
        filter = `[${aIdx}:a]apad,atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,asplit=2[vo][key];[${mIdx}:a]volume=${MUSIC_VOL},atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, total - 3).toFixed(2)}:d=3[mraw];[mraw][key]${DUCK}[mus];[vo][mus]amix=inputs=2:normalize=0:duration=longest,${MASTER_AF}[a]`;
      } else if (aIdx >= 0) {
        filter = `[${aIdx}:a]apad,atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,${MASTER_AF}[a]`;
      } else if (mIdx >= 0) {
        filter = `[${mIdx}:a]volume=${MUSIC_SOLO},atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, total - 3).toFixed(2)}:d=3,${MASTER_AF}[a]`;
      }
      // No fade from black: on WhatsApp the first frame is the thumbnail, and a black thumbnail is a video nobody
      // taps. The film opens on its first card (which fades its words in itself) and ends on the last card.
      args.push("-vf", `scale=${W}:${HH},format=yuv420p,fps=${FPS}`, "-fps_mode", "cfr");
      if (filter) args.push("-filter_complex", filter, "-map", "0:v", "-map", "[a]");
      else args.push("-map", "0:v");
      const kbps = longVideoBitrate(total);
      // Bitrate replaces crf here; everything else about the delivery encode stays the same.
      const v = DELIVERY_LONG.filter((x, i) => x !== "-crf" && DELIVERY_LONG[i - 1] !== "-crf");
      args.push("-t", total.toFixed(2), ...v, "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.35)}k`,
        "-bufsize", `${kbps * 2}k`, ...(filter ? DELIVERY_A : []), out);
      // A retry that only failed on the upload should not spend ten more minutes encoding the same video again.
      if (done(out, 200_000) && fs.statSync(out).size <= MAX_UPLOAD_MB * 1024 * 1024) log(`reusing the ${fmt} video from the last attempt`);
      else await ff(args);
      await H.beat?.().catch?.(() => {});
      return out;
    };

    // Build, encode, LOOK, and only then hand it over. A black stretch means a shot that did not draw: those
    // shots are thrown away and made again, and the film is encoded once more. One retry — a fault that survives
    // a rebuild is not one this loop can fix, and the owner should not wait a third ten minutes for it.
    // The opening card first: the first shot dissolves out of it.
    let openMp4 = null, introLast = null;
    if (hasOpen) {
      const openPng = path.join(dir, `open-${fmt0}.png`);
      if (!done(openPng, 4096)) await slide(openPng, { ...size, accent, heading: title, logoBuf, big: true });
      openMp4 = path.join(dir, `shot-${fmt0}-open.mp4`);
      const openFrames = Math.round(headSec * FPS);
      if (!done(openMp4, 20_000)) await stillShot(ff, openMp4, { png: openPng, frames: openFrames, W: size.W, H: size.H });
      introLast = path.join(dir, `last-${fmt0}-intro.png`);
      if (!done(introLast, 1000)) { try { await lastFrame(ff, openMp4, introLast, openFrames); } catch { introLast = null; } }
    }
    let shotFiles = await makeShots(); mark("shots");
    if (shotFiles.plainShots?.length) log(`${shotFiles.plainShots.length} shot(s) rendered without subtitles/heading: ${shotFiles.plainShots.join(",")}`);
    if (shotFiles.unplannedCards?.length) log(`${shotFiles.unplannedCards.length} shot(s) fell back to word cards: ${shotFiles.unplannedCards.join(",")}`);
    let out = await encode(shotFiles);
    for (let pass = 0; pass < 1; pass++) {
      await patch({ progress: { text: "Checking the video…" } });
      const qc = await checkFinal(ff, out, { total, voice: !!voiceWav, dir, log });
      if (qc.ok) break;
      if (!qc.black.length) break;                       // silence / length are reported, not something a rebuild fixes
      const bad = new Set();
      for (let i = 0; i < shots.length; i++) {
        const s0 = shotStart[i], s1 = s0 + shots[i].frames / FPS;
        if (qc.black.some((b) => b.start < s1 && b.end > s0)) bad.add(i);
      }
      if (!bad.size) break;
      log(`rebuilding ${bad.size} shot(s) that came out black: ${[...bad].join(",")}`);
      for (const i of bad) for (const f of [`shot-${fmt0}-${i}.mp4`, `hdr-${fmt0}-${i}.png`, `last-${fmt0}-${i}.png`]) fs.rmSync(path.join(dir, f), { force: true });
      fs.rmSync(out, { force: true });
      shotFiles = await makeShots();
      out = await encode(shotFiles);
      const again = await checkFinal(ff, out, { total, voice: !!voiceWav, dir, log });
      if (!again.ok && again.black.length) log(`still ${again.black.length} black stretch(es) after the rebuild — delivering anyway`);
    }
    outputs.push({ fmt: fmt0, file: out });

    // 6. upload
    await patch({ stage: "upload", progress: { text: "Almost done…" } });
    const urls = {};
    for (const { fmt, file } of outputs) {
      // An edited video gets a new file name: the old one may be cached for an hour by browsers and the CDN, and
      // the owner should see the new cut the moment it is done. The old file is removed once the row points on.
      const key = `ai-media/${job.owner_id}/explainer-${job.id}-${fmt}${editRun ? `-e${editRun.n}` : ""}.mp4`;
      const bytes = fs.readFileSync(file);
      // "media/" is the BUCKET, and it is not optional: without it Supabase reads the first path segment as the
      // bucket name and answers "Bucket not found". The public URL below always had it, which is why the two
      // disagreed silently until a video actually reached this line.
      const up = await fetch(`${H.SUPA_URL}/storage/v1/object/media/${key}`, {
        method: "POST",
        headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}`, "Cache-Control": "max-age=31536000", "Content-Type": "video/mp4", "x-upsert": "true" },
        body: bytes,
        signal: AbortSignal.timeout(300_000),
      });
      if (!up.ok) throw new Error("upload failed: " + (await up.text()).slice(0, 120));
      urls[fmt] = `${H.SUPA_URL}/storage/v1/object/public/media/${key}?v=${Date.now()}`; // own URL per upload — safe with the long edge cache
      log(`${fmt} ${(bytes.length / 1e6).toFixed(1)} MB`);
    }
    // 6b. THE MANIFEST: every scene as it was actually made (which picture, which move, where it sits on the
    // clock) and every paragraph with its words and times. The Scene Editor shows this and the next edit run
    // starts from it. Kept with the work.
    const manifest = writeManifest(dir, {
      n: editRun?.n ?? prior?.n ?? 0, fmt: fmt0, W: size.W, H: size.H, headSec, tailSec, total, title, style,
      voice: ownVoice ? "own" : voice ? "ai" : "none", lang, voiceStyle: inp.voiceStyle || "warm",
      parts, paraStart, shots, shotStart, unitOf, plan, used: shotFiles.used ?? [], cuesByShot, captions,
    });
    await keep(manifest);
    // 7. hand the finished video to the owner. The engine writes this row itself — returning the result and
    // trusting the caller to save it is how a video that rendered, uploaded and cost real credits still sat at
    // "Almost done…" for ever. Status-guarded, so a cancel that landed first still wins.
    const doneRow = await H.sb(`/rest/v1/media_jobs?id=eq.${job.id}&status=eq.running`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "done", output_url: urls[fmts[0]],
        progress: { text: editRun ? "Done — your edits are in" : "Done" },
        // The transcript-made script is kept with the job, so the owner can see what was heard and reuse it.
        // After an edit the script is the edited paragraphs, the recording is the joined one, and the edit is over.
        input: { ...inp, script: (autoScript || editRun) ? parts.join("\n\n") : inp.script, outputs: urls, seconds: Math.round(total), parts: parts.length, autoScript: autoScript || inp.autoScript === true,
          title, voiceUrl: voiceUrlNow || inp.voiceUrl, edit: null, edits: editRun?.n ?? inp.edits ?? 0, lastEditError: null, costOriginal: inp.costOriginal ?? (editRun ? undefined : job.cost) },
        ...(editRun ? { cost: Number(inp.costOriginal ?? job.cost) || 0 } : {}),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!doneRow?.ok) throw new Error("The video was made but could not be saved. Please tap Try again.");
    // The previous cut's file goes now that the row points at the new one.
    if (editRun) {
      const prev = inp.outputs?.[fmt0];
      const m = prev ? /\/storage\/v1\/object\/public\/media\/(.+)$/.exec(String(prev)) : null;
      if (m && m[1] !== `ai-media/${job.owner_id}/explainer-${job.id}-${fmt0}${editRun ? `-e${editRun.n}` : ""}.mp4`) {
        fetch(`${H.SUPA_URL}/storage/v1/object/media/${m[1]}`, { method: "DELETE", headers: { apikey: H.SUPA_KEY, Authorization: `Bearer ${H.SUPA_KEY}` } }).catch(() => {});
      }
    }
    mark("encode+upload");
    log(`done ${Math.round(total)}s, ${parts.length} slides · took ${marks.map(([n, sec], i) => `${n} ${sec - (marks[i - 1]?.[1] ?? 0)}s`).join(", ")} · total ${Math.round((Date.now() - t0) / 1000)}s`);
    const ps = pictureStats;
    const why = Object.entries(ps.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(", ");
    log(`cost: ${ps.imagen} Imagen + ${ps.gemini} Gemini pictures made, ${ps.kept} passed, ${ps.spare} kept as best-of-rejected, ${ps.failed} none · ${ps.judgeA} checks · orders: ${ps.codeFixed} fixed in code, ${ps.rewritten} rewritten · ≈ ₹${pictureCostRupees()} (pictures+checks)${why ? ` · rejects: ${why}` : ""}`);
    dropTemp();
    // Finished — but the shots stay on disk for a day (the sweep takes them): an edit made today then remakes
    // only the scenes it touched instead of every shot. The big intermediates (the final file, the mixed voice,
    // the recording, the subtitle images) go now; everything paid-for is in the bucket anyway.
    pruneFinished(dir);
    return { output_url: urls[fmts[0]], outputs: urls, seconds: Math.round(total), parts: parts.length };
  } catch (e) {
    // A cancelled video is never coming back, so its work goes. Everything else keeps its folder: the retry
    // reuses the recordings and slides already made and carries on from where it stopped.
    const cancelled = /cancel/i.test(String(e?.message ?? ""));
    if (cancelled && !editRun) fs.rm(dir, { recursive: true, force: true }, () => {});
    try { dropTemp(); } catch { /* fine */ }
    // An edit that fails leaves the finished video in place (the row goes back to done, the edit's credits come
    // back). A cancelled edit was already put back by the app. Everything else is a real failure.
    if (editRun && !cancelled) {
      const why = typeof e?.userMessage === "string" && e.userMessage.length < 200 ? e.userMessage.replace(/\s*—?\s*your credits have been returned\.?$/i, "").trim() : "something went wrong while remaking the scenes.";
      log(`edit ${editRun.n} failed: ${String(e?.message ?? e).slice(0, 200)}`);
      return editFailed(/[.!?]$/.test(why) ? why : `${why}.`);
    }
    throw e;
  }
}

/** Folders left by videos that failed and were never retried. Kept for a day, in case the owner tries again. */
function sweepOldWork(hours = 24) {
  const cut = Date.now() - hours * 3600_000;
  try {
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (!name.startsWith("explain-")) continue;
      const p = path.join(os.tmpdir(), name);
      try { if (fs.statSync(p).mtimeMs < cut) fs.rmSync(p, { recursive: true, force: true }); } catch { /* gone already */ }
    }
  } catch { /* nothing to sweep */ }
}
