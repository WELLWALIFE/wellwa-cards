// How a long video is CUT: the script becomes beats (whole sentences), beats are packed into shots of a few
// seconds, and every shot's length is measured against the voice we already recorded.
//
// The unit used to be the paragraph. On a real 817-word script that meant paragraphs of 10 to 33 seconds, one
// picture each — so a picture sat on screen for half a minute while the narration moved on to the next topic.
// The unit is now a beat, and a picture can never own more than two shots or 14 seconds, and never crosses a
// paragraph: when the topic changes, the picture changes.
import fs from "node:fs";
import path from "node:path";

/** Whole frames, so the picture and the voice are driven by the same integer (see quantise). */
export const FPS_DEFAULT = 30;

/** Pace, chosen by how long the whole thing is: a ten-minute video is encoded at a lower bitrate, and cutting
 *  every six seconds at that bitrate turns each cut to mush. Longer videos therefore hold each shot longer. */
export function pacing(spokenSeconds) {
  return spokenSeconds > 420
    ? { min: 4.5, target: 8.5, max: 11.0 }
    : { min: 3.5, target: 6.5, max: 9.0 };
}
export const SOURCE_MAX_ONSCREEN = 14.0;   // one picture, however framed, is never on screen longer than this
export const MAX_SHOTS_PER_SOURCE = 2;

/**
 * One paragraph → its sentences. Guards for the two places a full stop is not the end of a sentence: an
 * initial ("R. K. Traders") and a decimal ("2.999"). A sentence too short to hold the screen on its own is
 * merged into its neighbour — a one-second frame strobes on a phone.
 */
export function splitSentences(paragraph, { minChars = 22, maxChars = 220 } = {}) {
  const text = String(paragraph || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const out = [];
  let buf = "";
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    buf += chars[i];
    if (!/[।.!?]/.test(chars[i])) continue;
    const before = chars[i - 1] ?? "";
    const after = chars[i + 1] ?? "";
    if (chars[i] === "." && /[A-Z]/.test(before) && (chars[i - 2] ?? " ") === " ") continue;  // "R. K."
    if (chars[i] === "." && /\d/.test(before) && /\d/.test(after)) continue;                   // "2.999"
    while (/[।.!?"'”’)]/.test(chars[i + 1] ?? "")) buf += chars[++i];
    out.push(buf.trim());
    buf = "";
  }
  if (buf.trim()) out.push(buf.trim());

  // A sentence longer than a breath is cut again at its last comma — for the PICTURE only; the voice is
  // untouched because we never split the recording itself.
  const cut = [];
  for (const s of out) {
    if (s.length <= maxChars) { cut.push(s); continue; }
    let rest = s;
    while (rest.length > maxChars) {
      const at = Math.max(rest.lastIndexOf(",", maxChars), rest.lastIndexOf("—", maxChars), rest.lastIndexOf("-", maxChars));
      if (at < minChars) break;
      cut.push(rest.slice(0, at + 1).trim());
      rest = rest.slice(at + 1).trim();
    }
    if (rest) cut.push(rest);
  }

  // Merge the stragglers.
  const merged = [];
  for (const s of cut) {
    if (merged.length && s.length < minChars) merged[merged.length - 1] += ` ${s}`;
    else merged.push(s);
  }
  return merged.length ? merged : [text];
}

/** Seconds → whole frames, with the rounding error carried forward. Without the carry, 50 shots of "round to
 *  the nearest frame" drift a second away from the voice by the end of the film. */
export function quantise(seconds, fps = FPS_DEFAULT) {
  const frames = [];
  let carry = 0;
  for (const s of seconds) {
    const exact = Math.max(1, s * fps) + carry;
    const n = Math.max(1, Math.round(exact));
    carry = exact - n;
    frames.push(n);
  }
  return frames;
}

/**
 * Beats → shots, inside one paragraph. Greedy: keep adding beats until the shot has reached its target, and
 * never let it pass its maximum. A last shot too short to stand alone folds back into the one before it.
 * A single beat longer than max cannot be split in the audio (we have no word timing), so the PICTURE is
 * sub-cut instead: the same shot is listed several times and the builder re-frames it.
 */
export function packBeats(beats, { min, target, max }) {
  const shots = [];
  let cur = [];
  let acc = 0;
  for (const b of beats) {
    if (acc > 0 && acc + b.sec > max) { shots.push({ beats: cur, sec: acc }); cur = []; acc = 0; }
    cur.push(b);
    acc += b.sec;
    if (acc >= target) { shots.push({ beats: cur, sec: acc }); cur = []; acc = 0; }
  }
  if (cur.length) shots.push({ beats: cur, sec: acc });
  if (shots.length > 1 && shots[shots.length - 1].sec < min) {
    const tail = shots.pop();
    const prev = shots[shots.length - 1];
    prev.beats = prev.beats.concat(tail.beats);
    prev.sec += tail.sec;
  }
  // A shot still over max is one unsplittable sentence: cut the picture, not the sound.
  const out = [];
  for (const s of shots) {
    const slices = Math.max(1, Math.ceil(s.sec / target));
    if (slices === 1 || s.beats.length > 1) { out.push({ ...s, slice: 0, slices: 1 }); continue; }
    for (let k = 0; k < slices; k++) out.push({ beats: s.beats, sec: s.sec / slices, slice: k, slices });
  }
  return out;
}

/**
 * How many NEW pictures this video may buy, and which paragraph gets them. Shots are free; pictures are not,
 * in money and in wall clock. Every paragraph gets at least one of its own — that is what makes "new topic"
 * and "new picture" the same event — and what is left goes to the longest paragraphs, which need it most.
 */
// Seven a minute: a new picture roughly every eight seconds, with the re-framing in between. Five looked like a
// slideshow on a real ten-minute film. At ≈₹6 a picture that is ≈₹42 a minute against ₹100 a minute charged.
export function allocatePictures(paraSeconds, spokenSeconds, { perMinute = 7, floor = 8, ceiling = 64, room = Infinity } = {}) {
  const want = Math.round((spokenSeconds / 60) * perMinute);
  const budget = Math.max(floor, Math.min(ceiling, Math.min(want, room)));
  const n = paraSeconds.length;
  const give = paraSeconds.map(() => 1);
  let left = Math.max(0, budget - n);
  // Longest first, and never more than a paragraph can actually show (one picture per 14 seconds on screen).
  const order = paraSeconds.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  while (left > 0) {
    let gave = false;
    for (const i of order) {
      if (left <= 0) break;
      if (give[i] >= Math.ceil(paraSeconds[i] / SOURCE_MAX_ONSCREEN)) continue;
      give[i] += 1; left -= 1; gave = true;
    }
    if (!gave) break;
  }
  return { budget, perParagraph: give };
}

/* ---------------- measuring the voice we already recorded ---------------- */

const wavSeconds = (file, rate = 24000, bytesPerSample = 2, channels = 1) => {
  try { return Math.max(0, (fs.statSync(file).size - 44) / (rate * bytesPerSample * channels)); } catch { return 0; }
};

/**
 * Trim the lead-in and tail the voice engine leaves on every line (0.2-0.6s), and report the real length.
 * Untrimmed, that padding is exactly what makes a measured boundary land in the wrong place.
 */
export async function trimSilence(ff, src, out, { rate = 24000 } = {}) {
  const AF = "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB:detection=peak,areverse,"
    + "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-40dB:detection=peak,areverse";
  await ff(["-y", "-loglevel", "error", "-i", src, "-af", AF, "-ar", String(rate), "-ac", "1", out]);
  const sec = wavSeconds(out, rate);
  return sec > 0.4 ? sec : wavSeconds(src, rate);   // a line that trims to nothing keeps its original length
}

/**
 * Where the sentences actually fall inside one recorded paragraph. We look for the pauses the voice already
 * made, in the file we already paid for — no second trip to the voice engine, and it works just as well on a
 * recording the owner made themselves.
 * Returns durations, one per sentence, summing to the paragraph's length.
 */
export async function measureBeats(ff, wav, dir, tag, sentences, totalSec) {
  const n = sentences.length;
  const byWords = () => {
    const w = sentences.map((s) => Math.max(1, s.split(/\s+/).filter(Boolean).length));
    const all = w.reduce((a, b) => a + b, 0);
    return w.map((x) => (totalSec * x) / all);
  };
  if (n <= 1) return [totalSec];
  const listFile = path.join(dir, `sil-${tag}.txt`);
  try {
    // ffmpeg is run with -loglevel error everywhere, so silencedetect's own lines would be swallowed;
    // ametadata writes them to a file instead.
    await ff(["-y", "-loglevel", "error", "-i", wav, "-af",
      `silencedetect=n=-35dB:d=0.22,ametadata=mode=print:file=${listFile}`, "-f", "null", "-"]);
    const txt = fs.readFileSync(listFile, "utf8");
    const gaps = [];
    let start = null;
    for (const line of txt.split("\n")) {
      const s = /silence_start=([\d.]+)/.exec(line);
      const e = /silence_end=([\d.]+)/.exec(line);
      const d = /silence_duration=([\d.]+)/.exec(line);
      if (s) start = Number(s[1]);
      if (e && start !== null) {
        const end = Number(e[1]);
        gaps.push({ mid: (start + end) / 2, len: d ? Number(d[1]) : end - start });
        start = null;
      }
    }
    const inside = gaps.filter((g) => g.mid > 0.6 && g.mid < totalSec - 0.6);
    if (inside.length < n - 1) return byWords();
    const chosen = inside.sort((a, b) => b.len - a.len).slice(0, n - 1).sort((a, b) => a.mid - b.mid);
    const out = [];
    let prev = 0;
    for (const g of chosen) { out.push(Math.max(0.6, g.mid - prev)); prev = g.mid; }
    out.push(Math.max(0.6, totalSec - prev));
    // Scale back onto the real total, so rounding inside never changes the paragraph's length.
    const sum = out.reduce((a, b) => a + b, 0);
    return out.map((x) => (x * totalSec) / sum);
  } catch {
    return byWords();
  } finally {
    fs.rm(listFile, { force: true }, () => {});
  }
}

/**
 * The same measurement against a recording the owner brought. There we only have a word-count estimate, and its
 * error accumulates; a real person reading a script pauses at the sentence ends, so each estimate is snapped to
 * the nearest real pause when one is close by.
 */
export async function snapToPauses(ff, wav, dir, tag, estimates, totalSec, tolerance = 1.5) {
  const wanted = [];
  let acc = 0;
  for (let i = 0; i < estimates.length - 1; i++) { acc += estimates[i]; wanted.push(acc); }
  if (!wanted.length) return estimates;
  const listFile = path.join(dir, `sil-own-${tag}.txt`);
  try {
    await ff(["-y", "-loglevel", "error", "-i", wav, "-af",
      `silencedetect=n=-35dB:d=0.22,ametadata=mode=print:file=${listFile}`, "-f", "null", "-"]);
    const txt = fs.readFileSync(listFile, "utf8");
    const mids = [];
    let start = null;
    for (const line of txt.split("\n")) {
      const s = /silence_start=([\d.]+)/.exec(line);
      const e = /silence_end=([\d.]+)/.exec(line);
      if (s) start = Number(s[1]);
      if (e && start !== null) { mids.push((start + Number(e[1])) / 2); start = null; }
    }
    if (!mids.length) return estimates;
    const snapped = [];
    let prev = 0;
    for (const w of wanted) {
      let best = w, bestD = tolerance;
      for (const m of mids) { const d = Math.abs(m - w); if (d < bestD && m > prev + 0.6) { best = m; bestD = d; } }
      snapped.push(Math.max(0.6, best - prev));
      prev = best;
    }
    snapped.push(Math.max(0.6, totalSec - prev));
    const sum = snapped.reduce((a, b) => a + b, 0);
    return snapped.map((x) => (x * totalSec) / sum);
  } catch {
    return estimates;
  } finally {
    fs.rm(listFile, { force: true }, () => {});
  }
}
