// Where every word of the narration actually falls — so a picture changes at the moment the sentence starts,
// not a second or two either side of it.
//
// Before this, the cut was guessed: the owner's recording was divided by word COUNT (a 40-word sentence got 40/300
// of the time), and our own voice was cut at the longest silences. Both are guesses, and both were visibly wrong on
// real videos — a picture of the new topic while the old sentence was still being finished.
//
// Now the finished audio is transcribed with word timestamps (fal.ai Whisper, the same account that pays for the
// Kling clips; a 10-minute recording costs about a rupee), and the owner's OWN text is laid over that transcript:
//
//   1. text anchors — where the transcript's words and the script's words plainly match (same language, same
//      spelling), those words are pinned to their timestamps; everything between two anchors is spread evenly.
//   2. count mapping — when the two texts cannot be matched (the owner typed Hinglish in Latin letters and Whisper
//      wrote Devanagari), the k-th script word is pinned to the k-th spoken word. Whisper's word count is within a
//      few percent of the script's on every real recording tested, so the error is spread thinly over the whole
//      film instead of piling up at the end.
//   3. snap — a sentence boundary is then moved to the nearest real pause (a gap between two spoken words), so the
//      cut lands in the breath, where a human editor would put it.
//
// Nothing here is fatal: a failed transcription returns null and the engine falls back to its old guess.
import fs from "node:fs";
import path from "node:path";

const FAL_SYNC = "https://fal.run/fal-ai/whisper";
const FAL_QUEUE = "https://queue.fal.run/fal-ai/whisper";
/** A data URI under this size is accepted by fal directly; above it the audio is uploaded first. */
const INLINE_MAX = 7 * 1024 * 1024;

/* ------------------------------------------------------------------ transcription ------------------------- */

/** Whisper's language codes for the voices we offer. Hinglish is spoken Hindi, whatever alphabet it was typed in. */
export const whisperLang = (lang) => (String(lang || "").toLowerCase().startsWith("en") ? "en" : "hi");

/**
 * The audio → [{ text, start, end }] in seconds, or null when it cannot be done.
 * `wav` is any audio file ffmpeg can read; it is compressed to 16 kHz mono before it leaves the server.
 */
export async function transcribeWords(wav, { falKey, ff, lang = "hi", log = () => {}, dir, tag = "align", upload = null }) {
  if (!falKey || !wav || !fs.existsSync(wav)) return null;
  const work = dir || path.dirname(wav);
  const mp3 = path.join(work, `${tag}.mp3`);
  const cache = path.join(work, `${tag}.words.json`);
  try {
    const saved = JSON.parse(fs.readFileSync(cache, "utf8"));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* not transcribed yet */ }
  try {
    if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 1000) {
      await ff(["-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3]);
    }
    const bytes = fs.readFileSync(mp3);
    let audio_url;
    if (bytes.length <= INLINE_MAX) audio_url = `data:audio/mpeg;base64,${bytes.toString("base64")}`;
    else if (upload) audio_url = await upload(bytes, `${tag}.mp3`);
    else { log(`[align] ${tag}: ${(bytes.length / 1e6).toFixed(1)} MB and nowhere to upload it`); return null; }

    const body = JSON.stringify({ audio_url, task: "transcribe", language: whisperLang(lang), chunk_level: "word", version: "3" });
    const headers = { Authorization: `Key ${falKey}`, "Content-Type": "application/json" };
    // Short clips synchronously; long ones through the queue so a slow minute does not hit the sync limit.
    let result = null;
    const long = bytes.length > 2 * 1024 * 1024;
    if (!long) {
      const r = await fetch(FAL_SYNC, { method: "POST", headers, body, signal: AbortSignal.timeout(180_000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`fal ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
      result = j;
    } else {
      const s = await fetch(FAL_QUEUE, { method: "POST", headers, body, signal: AbortSignal.timeout(60_000) });
      const sj = await s.json().catch(() => ({}));
      if (!s.ok || !sj.request_id) throw new Error(`fal submit ${s.status}: ${JSON.stringify(sj).slice(0, 160)}`);
      const statusUrl = sj.status_url || `${FAL_QUEUE}/requests/${sj.request_id}/status`;
      const responseUrl = sj.response_url || `${FAL_QUEUE}/requests/${sj.request_id}`;
      const t0 = Date.now();
      while (Date.now() - t0 < 8 * 60_000) {
        await new Promise((r) => setTimeout(r, 4000));
        const st = await fetch(statusUrl, { headers: { Authorization: `Key ${falKey}` } }).then((r) => r.json()).catch(() => ({}));
        if (st.status === "COMPLETED") { result = await fetch(responseUrl, { headers: { Authorization: `Key ${falKey}` } }).then((r) => r.json()); break; }
        if (st.status === "FAILED" || st.status === "ERROR") throw new Error(`fal failed: ${JSON.stringify(st).slice(0, 160)}`);
      }
      if (!result) throw new Error("fal timeout");
    }
    const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
    const words = [];
    for (const c of chunks) {
      const text = String(c.text ?? "").trim();
      const ts = Array.isArray(c.timestamp) ? c.timestamp : [];
      const start = Number(ts[0]);
      let end = Number(ts[1]);
      if (!text || !Number.isFinite(start)) continue;
      if (!Number.isFinite(end) || end < start) end = start + 0.25;
      // Whisper occasionally emits one chunk for several words; split it evenly so the count mapping holds.
      const parts = text.split(/\s+/).filter(Boolean);
      const each = (end - start) / parts.length;
      parts.forEach((p, i) => words.push({ text: p, start: start + i * each, end: start + (i + 1) * each }));
    }
    // Monotonic, non-overlapping — a transcript with a word that starts before the previous one ended breaks the snap.
    for (let i = 1; i < words.length; i++) {
      if (words[i].start < words[i - 1].end) words[i].start = words[i - 1].end;
      if (words[i].end < words[i].start) words[i].end = words[i].start + 0.05;
    }
    if (words.length < 3) { log(`[align] ${tag}: transcript too short (${words.length} words)`); return null; }
    try { fs.writeFileSync(cache, JSON.stringify(words)); } catch { /* fine */ }
    log(`[align] ${tag}: ${words.length} words, ${(words[words.length - 1].end).toFixed(1)}s`);
    return words;
  } catch (e) {
    log(`[align] ${tag}: transcription failed (${e?.message ?? e})`);
    return null;
  }
}

/* ------------------------------------------------------------------ alignment ----------------------------- */

const norm = (w) => String(w || "")
  .toLowerCase()
  .normalize("NFC")
  .replace(/[।॥.,!?;:"'()\[\]{}«»“”‘’\-–—_/\\|…]+/gu, "")
  .trim();

/** Script → its words, remembering which unit (sentence) each belongs to. */
function scriptWords(units) {
  const out = [];
  units.forEach((u, ui) => {
    for (const w of String(u || "").split(/\s+/).filter(Boolean)) {
      const n = norm(w);
      if (n) out.push({ raw: w, n, unit: ui });
    }
  });
  return out;
}

/**
 * Longest common subsequence over normalised words, banded: a script word can only match a spoken word within
 * ±band positions of where count mapping would put it. That keeps a repeated word ("aur", "the") from pairing
 * with a copy of itself a minute away, and keeps the table small on a 1500-word film.
 */
function anchors(sw, tw, band = 40) {
  const M = sw.length, N = tw.length;
  if (!M || !N || M * N > 6_000_000) return [];
  const ratio = N / M;
  const eq = (i, j) => {
    if (Math.abs(j - i * ratio) > band) return false;
    const a = sw[i].n, b = tw[j];
    return a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
  };
  // Classic LCS table, (M+1) x (N+1).
  const W = N + 1;
  const dp = new Uint16Array((M + 1) * W);
  for (let i = 1; i <= M; i++) {
    const row = i * W, prev = (i - 1) * W;
    for (let j = 1; j <= N; j++) {
      dp[row + j] = eq(i - 1, j - 1) ? dp[prev + j - 1] + 1 : Math.max(dp[prev + j], dp[row + j - 1]);
    }
  }
  const out = [];
  let i = M, j = N;
  while (i > 0 && j > 0) {
    if (eq(i - 1, j - 1) && dp[i * W + j] === dp[(i - 1) * W + j - 1] + 1) { out.push([i - 1, j - 1]); i--; j--; }
    else if (dp[(i - 1) * W + j] >= dp[i * W + j - 1]) i--;
    else j--;
  }
  return out.reverse();
}

/**
 * units: the script's sentences in spoken order (the WHOLE recording, or one paragraph's clip).
 * words: the transcript for that same audio.
 * Returns [{ start, end }] per unit in the audio's own seconds — or null when there is nothing to align.
 *
 * `end` of unit k is the `start` of unit k+1: the pause after a sentence belongs to the picture that was up while
 * it was spoken, and the new picture arrives with the new sentence. The last unit ends at `totalSec`.
 */
export function alignUnits(units, words, totalSec, { log = () => {}, tag = "" } = {}) {
  const sw = scriptWords(units);
  if (!sw.length || !words?.length) return null;
  const tw = words.map((w) => norm(w.text));
  const M = sw.length, N = words.length;

  // 1. pin what matches; 2. count-map the rest.
  const pins = anchors(sw, tw);
  const matched = pins.length / M;
  const at = new Array(M).fill(-1);
  if (matched >= 0.3) for (const [i, j] of pins) at[i] = j;
  const method = matched >= 0.3 ? `${Math.round(matched * 100)}% text anchors` : "word count";
  // fill gaps by interpolating between the nearest pins (or by pure count when there are none)
  let prevI = -1, prevJ = -1;
  for (let i = 0; i <= M; i++) {
    const j = i < M ? at[i] : N;                   // sentinel at the end
    if (j < 0) continue;
    const span = i - prevI;
    for (let k = prevI + 1; k < i; k++) {
      const f = (k - prevI) / span;
      at[k] = Math.min(N - 1, Math.max(0, Math.round(prevJ + f * (j - prevJ))));
    }
    prevI = i; prevJ = j;
  }
  for (let i = 0; i < M; i++) if (at[i] < 0) at[i] = Math.min(N - 1, Math.round((i * N) / M));
  for (let i = 1; i < M; i++) if (at[i] < at[i - 1]) at[i] = at[i - 1];

  // 3. sentence starts, snapped into the nearest breath.
  const gaps = [];                                  // { t, len } — silence between consecutive spoken words
  for (let j = 1; j < N; j++) { const len = words[j].start - words[j - 1].end; if (len >= 0.16) gaps.push({ t: words[j].start - Math.min(0.12, len * 0.4), len }); }
  const starts = new Array(units.length).fill(null);
  for (let i = 0; i < M; i++) if (starts[sw[i].unit] === null) starts[sw[i].unit] = words[at[i]].start;
  const out = [];
  let last = 0;
  for (let u = 0; u < units.length; u++) {
    let s = starts[u] ?? last;
    if (u === 0) s = 0;                             // the first picture is up before the first word
    else {
      let best = null;
      for (const g of gaps) { const d = Math.abs(g.t - s); if (d <= 0.7 && (!best || d < best.d)) best = { d, t: g.t }; }
      if (best) s = best.t;
    }
    if (u > 0) s = Math.max(last + 0.4, s);         // never a sub-half-second shot
    out.push({ start: s, end: s });
    last = s;
  }
  for (let u = 0; u < out.length; u++) out[u].end = u + 1 < out.length ? out[u + 1].start : Math.max(last + 0.4, totalSec);
  // A unit that ended up starting after the audio ends is nonsense: fall back.
  if (out.some((x) => x.start > totalSec + 0.5)) { log(`[align] ${tag}: units overran the audio — ignored`); return null; }
  log(`[align] ${tag}: ${units.length} sentences placed by ${method} (${gaps.length} pauses found)`);
  return out;
}

/**
 * Word-by-word timing of the OWNER's text (not the transcript's words — the owner's spelling is the one that goes
 * on screen). Each script word gets the timestamp of the spoken word it was mapped to; words inside one unit are
 * kept monotonic. Used for subtitles.
 * Returns [{ text, start, end, unit }].
 */
export function alignWords(units, words, placed) {
  const sw = scriptWords(units);
  if (!sw.length || !placed) return [];
  const out = [];
  for (let u = 0; u < units.length; u++) {
    const mine = sw.filter((w) => w.unit === u);
    if (!mine.length) continue;
    const { start, end } = placed[u];
    // Spoken words inside this unit's window.
    const inside = words.filter((w) => w.start >= start - 0.05 && w.start < end);
    const n = mine.length;
    if (inside.length >= Math.max(2, n * 0.6)) {
      // Count-map within the sentence: k-th script word ↔ k-th spoken word of the window.
      for (let k = 0; k < n; k++) {
        const j = Math.min(inside.length - 1, Math.round((k * inside.length) / n));
        const jn = Math.min(inside.length - 1, Math.round(((k + 1) * inside.length) / n));
        const s = inside[j].start;
        const e = k === n - 1 ? Math.min(end, inside[inside.length - 1].end) : Math.max(s + 0.08, jn > j ? inside[jn].start : inside[j].end);
        out.push({ text: mine[k].raw, start: s, end: e, unit: u });
      }
    } else {
      // No usable words in the window: spread by letter count.
      const weights = mine.map((w) => Math.max(2, [...w.n].length + 1));
      const total = weights.reduce((a, b) => a + b, 0);
      let t = start;
      const span = Math.max(0.4, end - start);
      mine.forEach((w, k) => { const d = (weights[k] / total) * span; out.push({ text: w.raw, start: t, end: t + d, unit: u }); t += d; });
    }
  }
  for (let i = 1; i < out.length; i++) if (out[i].start < out[i - 1].end) out[i].start = out[i - 1].end;
  return out.filter((w) => w.end > w.start);
}
