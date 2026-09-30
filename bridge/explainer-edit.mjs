// THE SCENE EDITOR's half on the worker: what a finished long video remembers about itself, and how the owner's
// changes are applied to the next build.
//
// Every build ends by writing a MANIFEST (scenes-<fmt>.json, kept with the work): each scene as it was actually
// made — its words, heading, picture, camera move, place on the clock — and each paragraph with its words and
// times. The app shows that in the editor. When the owner applies changes, the app writes edits.json next to it
// and queues the job again with input.edit = { n, credits }; the engine lays the changes over its plan and
// remakes only the shots they touch.
//
// edits.json:
//   { n, at, title?,
//     paragraphs: { "<p>": { text?, revoice?, voiceUrl? } },      text = new words; revoice = say it again (AI
//                                                                voice); voiceUrl = a new recording of this
//                                                                paragraph (own voice), cut into the old one
//     scenes:     { "<i>": { heading?, move?, captions?, picture? } }
//                 picture = { mode: "regen", frame, subject, moment } | { mode: "own", url } | { mode: "pick", from }
//                         | { mode: "card" } }
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FPS } from "./caption-engine.mjs";

/** What an edit costs, in credits: only the parts that pay an outside service. Everything else is free. */
export const EDIT_PICTURE_CREDITS = 1;      // one AI picture made to the owner's order (≈ ₹3 of API + the CPU)
export const EDIT_VOICE_CREDITS = 1;        // one paragraph spoken again by the AI voice

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

/** The last build's manifest, or null (a video made before the editor existed, or a first build). */
export function readManifest(dir, fmt) {
  if (!fmt) return null;
  const m = readJson(path.join(dir, `scenes-${fmt}.json`));
  return m && Array.isArray(m.paragraphs) && Array.isArray(m.shots) ? m : null;
}

/** The owner's list of changes, or null. */
export function readEdits(dir) {
  const e = readJson(path.join(dir, "edits.json"));
  return e && typeof e === "object" ? e : null;
}

/** The paragraphs of the last build with the owner's new words laid over them. Never re-split: paragraph 4 stays
 *  paragraph 4, however long its new text is, so every scene number in the editor still means the same thing. */
export function applyEditsToParts(prior, edit) {
  return prior.paragraphs.map((p, i) => {
    const e = edit?.paragraphs?.[i];
    const t = e && typeof e.text === "string" ? e.text.replace(/\s+/g, " ").trim() : "";
    return t.length >= 2 ? t.slice(0, 1500) : String(p.text ?? "");
  });
}

/** Words of a line, lower-cased, for matching one build's lines to the next. */
const bag = (t) => new Set(String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1));
const overlap = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.max(a.size, b.size); };

/**
 * Match this build's spoken lines to the finished film's, and carry each line's order, heading and picture across.
 *
 * Three passes inside each paragraph: the same words; the same position when the paragraph still has the same
 * number of lines; the closest words otherwise (at least half in common). A line that matches nothing starts
 * blank — it borrows a neighbour's picture until the owner orders one in the editor.
 *
 * Returns { unitPlan, seed, priorToNew, matched }: the plan for every line; the picture files that stay with the
 * shots that showed them (only sources — a "second look" shot follows its source by itself); and the map from the
 * editor's scene numbers (the finished film's) to this build's shot numbers.
 */
export function mapPrior(prior, savedPlan, { unit, shots, unitOf, dir }) {
  if (!prior?.shots?.length || !unit?.length) return null;
  const pUnits = [];
  for (const sh of prior.shots) {
    if (!pUnits[sh.unit]) pUnits[sh.unit] = { u: sh.unit, para: sh.para, text: sh.text, shots: [], first: sh };
    pUnits[sh.unit].shots.push(sh.i);
  }
  const pList = pUnits.filter(Boolean);
  const byPara = (list, key) => list.reduce((m, x) => { (m[x[key]] ??= []).push(x); return m; }, {});
  const newByPara = byPara(unit.map((x, u) => ({ ...x, u })), "para");
  const oldByPara = byPara(pList, "para");
  const matchOf = new Array(unit.length).fill(-1);
  for (const para of Object.keys(newByPara)) {
    const news = newByPara[para], olds = (oldByPara[para] || []).slice();
    const taken = new Set();
    // 1. the same words
    for (const n of news) { const j = olds.findIndex((o) => !taken.has(o.u) && o.text.trim() === n.text.trim()); if (j >= 0) { matchOf[n.u] = olds[j].u; taken.add(olds[j].u); } }
    // 2. the same place, when the paragraph still has as many lines
    if (news.length === olds.length) news.forEach((n, k) => { if (matchOf[n.u] < 0 && !taken.has(olds[k].u)) { matchOf[n.u] = olds[k].u; taken.add(olds[k].u); } });
    // 3. the closest words
    for (const n of news) {
      if (matchOf[n.u] >= 0) continue;
      const nb = bag(n.text);
      let best = null, score = 0.5;
      for (const o of olds) { if (taken.has(o.u)) continue; const sc = overlap(nb, bag(o.text)); if (sc > score) { best = o; score = sc; } }
      if (best) { matchOf[n.u] = best.u; taken.add(best.u); }
    }
  }
  const blank = () => ({ kind: "image", frame: "object", subject: "", moment: "", backup: "", abstract: false, idea: "", search: "", heading: "" });
  const unitPlan = unit.map((_, u) => {
    const m = matchOf[u] >= 0 ? pUnits[matchOf[u]] : null;
    if (!m) return blank();
    const fromPlan = savedPlan?.unitPlan?.[m.u];
    if (fromPlan && typeof fromPlan === "object") return { ...fromPlan, heading: m.first.heading ?? fromPlan.heading ?? "" };
    return { kind: m.first.kind === "card" ? "text" : "image", frame: m.first.frame || "object", subject: m.first.subject || "", moment: m.first.moment || "", backup: "", abstract: false, idea: m.first.subject || "", search: "", heading: m.first.heading || "" };
  });
  const seed = new Map(), priorToNew = new Map();
  const shotsOfUnit = (u) => shots.map((_, i) => i).filter((i) => unitOf[i] === u);
  let matched = 0;
  for (let u = 0; u < unit.length; u++) {
    if (matchOf[u] < 0) continue;
    matched++;
    const pj = pUnits[matchOf[u]].shots, nj = shotsOfUnit(u);
    pj.forEach((j, k) => {
      if (nj[k] !== undefined) priorToNew.set(j, nj[k]); else if (nj.length) priorToNew.set(j, nj[nj.length - 1]);
      // Every shot of the line that had a picture of its own keeps it (a line cut in two may have two: the second
      // given one in the editor). A "second look" shot follows its source by itself.
      const ps = prior.shots[j];
      if (ps?.kind === "picture" && ps.picture && nj[k] !== undefined && fs.existsSync(path.join(dir, ps.picture))) seed.set(nj[k], path.join(dir, ps.picture));
    });
  }
  return { unitPlan, seed, priorToNew, matched };
}

/**
 * Cut new recordings into the owner's recording in place of the paragraphs they replace.
 * `src` is the recording as uploaded; each splice is { p, url } and the paragraph's place in the recording comes
 * from the last manifest (film clock minus the intro). Later paragraphs first, so earlier times stay true.
 * Returns the path of the joined recording (an m4a, kept with the work by the caller).
 */
export async function spliceRecording(ff, dir, src, splices, { prior, fetchFile, log = () => {} }) {
  const head = Number(prior.headSec) || 0;
  const order = [...splices].filter((s) => prior.paragraphs[s.p]).sort((a, b) => b.p - a.p);
  let cur = src;
  let k = 0;
  for (const s of order) {
    const para = prior.paragraphs[s.p];
    const a = Math.max(0, Number(para.start) - head), b = Math.max(a + 0.2, Number(para.end) - head);
    const buf = await fetchFile(s.url).catch(() => null);
    if (!buf) throw Object.assign(new Error(`new recording for paragraph ${s.p + 1} could not be read`), { userMessage: `the new recording for paragraph ${s.p + 1} could not be read.` });
    const raw = path.join(dir, `splice-${k}.src`);
    fs.writeFileSync(raw, buf);
    // The clip, in the recording's own format (48k stereo), its leading and trailing silence trimmed so the
    // paragraph starts when the owner starts speaking, as the original did.
    const clip = path.join(dir, `splice-${k}.wav`);
    await ff(["-y", "-loglevel", "error", "-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.15,areverse,apad=pad_dur=0.25", "-ac", "2", "-ar", "48000", clip]);
    const out = path.join(dir, `splice-${k}.out.wav`);
    // before | new clip | after — three pieces of one recording, joined without a seam.
    await ff(["-y", "-loglevel", "error", "-i", cur, "-i", clip, "-filter_complex",
      `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${a.toFixed(3)},asetpts=N/SR/TB[x];[1:a]asetpts=N/SR/TB[y];[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=${b.toFixed(3)},asetpts=N/SR/TB[z];[x][y][z]concat=n=3:v=0:a=1[a]`,
      "-map", "[a]", "-ac", "2", "-ar", "48000", out]);
    log(`[edit] paragraph ${s.p + 1}: recording ${a.toFixed(1)}–${b.toFixed(1)}s replaced by the new clip`);
    for (const f of [raw, clip]) fs.rmSync(f, { force: true });
    if (cur !== src) fs.rmSync(cur, { force: true });
    cur = out;
    k++;
  }
  // Kept as AAC: a ten-minute stereo wav is 100 MB; the same at 128 kbps is 10.
  const joined = path.join(dir, "own-voice-joined.m4a");
  await ff(["-y", "-loglevel", "error", "-i", cur, "-c:a", "aac", "-b:a", "128k", joined]);
  if (cur !== src) fs.rmSync(cur, { force: true });
  return joined;
}

/** Which shots an edit makes again. All of them when the timing moved; otherwise the edited scenes, the other
 *  shots of their spoken lines (a heading is per line), and the shot after each (its dissolve starts there). */
export function staleShotsFor({ shots, unitOf, scenesEdited, timingChanged, headingChanged }) {
  const stale = new Set();
  if (timingChanged) { shots.forEach((_, i) => stale.add(i)); return stale; }
  for (const i of scenesEdited) {
    stale.add(i);
    if (headingChanged?.has(i)) shots.forEach((_, j) => { if (unitOf[j] === unitOf[i]) stale.add(j); });
    // A picture on the shot after a reframed one: the next shot may have been a second look at the old picture.
    if (i + 1 < shots.length) stale.add(i + 1);
    if (i + 2 < shots.length && unitOf[i + 2] === unitOf[i + 1]) stale.add(i + 2);
  }
  return stale;
}

/** After a finished build: the big intermediates go, the shots and everything paid-for stay for a day. */
export function pruneFinished(dir) {
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const big = /^(explainer-[a-z]+\.mp4|voice\.wav|own-voice\.(wav|src)|own-voice-joined\.m4a|own\.mp3|vo-\d+\.mp3|vo-\d+-raw\.wav|clip-\d+\.mp4|splice-.*|qc-.*\.txt|list-[a-z]+\.txt)$/.test(name);
      const dirGone = /^(cues-[a-z]+)$/.test(name);
      if (big || dirGone) fs.rmSync(p, { recursive: true, force: true });
    }
  } catch { /* the sweep gets it tomorrow */ }
}

/** An uploaded picture, filled to the film's frame (cover, centred) as a JPEG the shot builder can use. */
export async function ownPictureFile(buf, file, { W, H }) {
  await sharp(buf).rotate().resize(W, H, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toFile(file);
  return file;
}

/** Write scenes-<fmt>.json: the film as made. Returns the file's path. */
export function writeManifest(dir, { n, fmt, W, H, headSec, tailSec, total, title, style, voice, lang, voiceStyle, parts, paraStart, shots, shotStart, unitOf, plan, used, cuesByShot, captions }) {
  const paraEnd = parts.map((_, p) => {
    const frames = shots.filter((s) => s.para === p).reduce((a, s) => a + s.frames, 0);
    return (paraStart[p] ?? 0) + frames / FPS;
  });
  const manifest = {
    v: 1, n: n || 0, at: new Date().toISOString(), fmt, W, H, headSec, tailSec, total: Math.round(total * 100) / 100,
    title: title || "", style, voice, lang, voiceStyle, captions: captions !== false,
    paragraphs: parts.map((text, p) => ({ p, text, start: round(paraStart[p] ?? 0), end: round(paraEnd[p]) })),
    shots: shots.map((s, i) => {
      const w = plan[i] || {};
      const u = used[i] || {};
      return {
        i, unit: unitOf[i], para: s.para, start: round(shotStart[i] ?? 0), sec: round(s.frames / FPS), text: s.text,
        heading: String(w.heading ?? ""), kind: u.kind ?? (w.kind === "text" ? "card" : "picture"), picture: u.picture ?? null,
        frame: w.frame ?? "object", subject: w.subject ?? "", moment: w.moment ?? "", move: u.move ?? null, tight: !!u.tight,
        captions: cuesByShot?.has?.(i) ?? false,
      };
    }),
  };
  const file = path.join(dir, `scenes-${fmt}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest));
  return file;
}
const round = (v) => Math.round(Number(v) * 100) / 100;
