// Turns one paragraph of a long video into one SHOT — a piece of picture that lasts exactly as long as that
// paragraph is spoken. Three kinds, chosen by shotlist.mjs:
//
//   stock  real filmed footage from Pexels, filling the frame, graded, with the owner's words along the bottom
//   image  a picture made for this exact line, when nothing filmed would match it — also pushed in slowly
//   photo  the owner's own picture with a slow push in (a still that does not move reads as a dead frame)
//   text   the words alone, full screen — used where the point IS the words (a price, a promise, a conclusion)
//
// Every shot is written with identical encode settings so the whole film can be joined without re-encoding twice,
// and each one is cached by name: a retry after a failure picks up at the shot it stopped on.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FPS } from "./caption-engine.mjs";
import { MAX_SHOTS_PER_SOURCE } from "./explainer-beats.mjs";

// One grade over everything, so clips from different cameras and the owner's phone photos read as one film.
const GRADE = "eq=contrast=1.04:saturation=1.06,vignette=PI/5";
// Long videos are minutes of footage, so the working copies are lighter than the reel pipeline's crf-14:
// the delivery pass is what the owner actually receives, and at these lengths crf 14 would fill the disk.
// superfast, not veryfast: a shot is an intermediate that the delivery encode re-encodes anyway, and on the VPS
// fifty shots at veryfast took twenty minutes. crf 18 keeps the intermediate a touch above the final quality.
const SHOT_V = ["-c:v", "libx264", "-preset", "superfast", "-crf", "18", "-pix_fmt", "yuv420p", "-an"];
const cached = (f, min = 20_000) => { try { return fs.statSync(f).size >= min; } catch { return false; } };

/**
 * The header: the shot's title, CENTRED in the upper-middle of the frame.
 *
 * Not along the bottom — a reel's own buttons eat the bottom fifth of the screen, and a line sitting down there
 * reads as a subtitle, which is the shape the owner rejected. Upper-middle also clears the logo chip.
 * Nothing is drawn at all when there is no title: an empty frame beats half a sentence.
 */
export async function headerPng(file, { W, H, text, accent = "#ffffff", logoW = 0 }) {
  const t = String(text || "").trim();
  if (!t) return null;
  const dev = /[ऀ-ॿ]/.test(t);
  const fam = dev ? "Noto Sans Devanagari, Lohit Devanagari, Mukta, sans-serif" : "Liberation Sans, DejaVu Sans, sans-serif";
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const visible = [...t.replace(/\p{M}/gu, "")].length;
  // Three sizes, so a short punchy title is big and a long one still fits on two lines.
  // A 1920-wide frame is not a 1080-wide one: the same fraction of width would give letters twice the height.
  const wide = W >= H;
  const k = wide ? 0.56 : 1;
  const size = Math.round(W * k * (visible <= 14 ? 0.075 : visible <= 24 ? 0.064 : 0.055));
  const colW = Math.round(W * (wide ? 0.74 : 0.82));

  const perLine = Math.max(8, Math.round(colW / (size * (dev ? 0.62 : 0.55))));
  const lines = [];
  let line = "";
  for (const w of t.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if ([...next.replace(/\p{M}/gu, "")].length <= perLine) line = next;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 2);                       // the 32-character cap makes a third line impossible
  const step = Math.round(size * 1.22);
  const first = Math.round(H * (wide ? (shown.length > 1 ? 0.135 : 0.145) : (shown.length > 1 ? 0.300 : 0.310)));
  const last = first + (shown.length - 1) * step;

  // A soft full-width scrim rather than a plate hugging the words: we estimate text width, and an estimate that
  // is 10% out shows up as text spilling over a plate's edge. A gradient hides the same error.
  const top = Math.max(0, first - Math.round(H * 0.11));
  const bot = Math.min(H, last + Math.round(H * 0.07));
  // Drawn as a BAND (top..bot), not a full frame: the overlay then blends a fifth of the picture per frame instead
  // of all of it. The band's y travels in the sidecar returned below.
  let body = "";
  shown.forEach((l, i) => {
    const y = first + i * step - top;
    // Drawn twice: librsvg ignores paint-order, so the dark outline is its own pass underneath.
    body += `<text x="${Math.round(W / 2)}" y="${y}" text-anchor="middle" font-family="${fam}" font-size="${size}" font-weight="800"`
      + ` fill="none" stroke="#000000" stroke-width="${(size * 0.11).toFixed(1)}" stroke-linejoin="round" opacity="0.5">${esc(l)}</text>`;
    body += `<text x="${Math.round(W / 2)}" y="${y}" text-anchor="middle" font-family="${fam}" font-size="${size}" font-weight="800" fill="#ffffff">${esc(l)}</text>`;
  });
  const barW = Math.round(W * (wide ? 0.08 : 0.14));
  // Devanagari hangs matras below the baseline, so the rule needs more clearance there or it reads as an
  // underline struck through the word.
  const barGap = Math.round(size * (dev ? 0.78 : 0.46));
  const bandH = Math.max(8, bot - top);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${bandH}">
  <defs><linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.5" stop-color="#000" stop-opacity="0.5"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="${W}" height="${bandH}" fill="url(#sc)"/>
  <rect x="${Math.round((W - barW) / 2)}" y="${last + barGap - top}" width="${barW}" height="6" rx="3" fill="${accent}"/>
  ${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  // A sidecar remembers where the band goes, so a cached header from an earlier attempt still lands right.
  fs.writeFileSync(`${file}.y`, String(top));
  return { file, y: top };
}
/** A still overlay as overlays() takes it: a full-frame file, or { file, y } for a band. */
const asLayer = (v) => (v && typeof v === "object" ? v : v ? { file: v, y: 0 } : null);

/** How long two shots melt into each other, and how long a heading takes to arrive and leave. */
export const DISSOLVE = 0.4;
const HEAD_FADE = 0.3;

/**
 * Everything drawn over the picture, in this order:
 *   1. the tail of the PREVIOUS shot, fading out — the dissolve. A frozen frame under a moving picture for
 *      under half a second reads as a film cut, and it costs nothing: no giant xfade graph over 80 inputs, and the
 *      frame-exact timeline (one shot = N whole frames) is untouched.
 *   2. the subtitles, each lit for its own window
 *   3. the header, arriving and leaving softly — unless the same title carries into the next shot, in which case
 *      it simply stays (fading it out and straight back in is a blink)
 *   4. the logo, LAST, so nothing dims it
 * Every overlay is a still, looped for the shot's exact frame count.
 */
function overlays(args, vf, { capPng = null, capIn = true, capOut = true, logoPng = null, prevPng = null, captions = null, seconds = 0 } = {}) {
  const inputs = [];                                    // { file, pre, y, enable, fps }
  // The previous frame is a full-size PNG, and a looped PNG is decoded again for every output frame. It is only
  // needed for the dissolve, so its input simply ENDS after it (-t): eof_action=pass then lets the picture through.
  if (prevPng) inputs.push({ file: prevPng, secs: DISSOLVE + 0.1, pre: `format=rgba,fade=t=out:st=0:d=${DISSOLVE}:alpha=1` });
  if (captions && captions.list) {
    // ONE input for every subtitle of the shot: a concat list of band-sized PNGs with exact durations (the cue
    // bands, and a transparent blank between them), so the overlay input is one small picture at a time and the
    // stage costs what any other still costs. Every overlay STAGE holds ~40 MB of frame buffers whatever its
    // picture, and 25 cues as 25 stages blew the worker's 900 MB cap on the first real film.
    inputs.push({ file: captions.list, concat: true, y: captions.top });
  }
  const cap = asLayer(capPng), logo = asLayer(logoPng);
  if (cap) {
    const fades = [];
    if (capIn) fades.push(`fade=t=in:st=0:d=${HEAD_FADE}:alpha=1`);
    if (capOut && seconds > HEAD_FADE * 2 + 0.2) fades.push(`fade=t=out:st=${(seconds - HEAD_FADE).toFixed(2)}:d=${HEAD_FADE}:alpha=1`);
    inputs.push({ file: cap.file, y: cap.y, pre: fades.length ? `format=rgba,${fades.join(",")}` : "" });
  }
  if (logo) inputs.push({ file: logo.file, y: logo.y });
  // -loop 1 with no length: these are stills, and the output's own -frames:v is what ends the shot.
  // (-frames:v is an OUTPUT option; putting it in front of an input makes ffmpeg refuse the whole command.)
  // One decoder thread and a short queue per still: the defaults on many inputs let the graph buffer as much as
  // it liked (see caption-engine.burnCaptions, which learnt this the hard way).
  for (const x of inputs) {
    if (x.concat) args.push("-f", "concat", "-safe", "0", "-thread_queue_size", "4", "-threads", "1", "-i", x.file);
    else args.push("-loop", "1", "-framerate", String(FPS), ...(x.secs ? ["-t", x.secs.toFixed(2)] : []), "-thread_queue_size", "4", "-threads", "1", "-i", x.file);
  }
  if (!inputs.length) { args.push("-vf", vf, "-map", "0:v"); return; }
  let chain = `[0:v]${vf}[b0]`;
  inputs.forEach((x, i) => {
    let src = `[${i + 1}:v]`;
    if (x.pre) { chain += `;${src}${x.pre}[o${i}]`; src = `[o${i}]`; }
    const to = i === inputs.length - 1 ? "[v]" : `[b${i + 1}]`;
    const en = x.enable ? `:enable='${x.enable}'` : "";
    // The caption track is timed by its own frames, so it must not stop the shot early (eof_action=pass) and
    // its frame rate is not the shot's (no shortest). Stills loop for ever, so the same options are harmless.
    chain += `;[b${i}]${src}overlay=0:${x.y ?? 0}:eof_action=pass${en}${to}`;
  });
  args.push("-filter_complex", chain, "-map", "[v]");
}

/**
 * The shot's subtitles as one timed track: every cue band padded to one slot height (bottom-aligned, the way the
 * bands were drawn against the safe line), a transparent blank for the gaps, and a concat list with exact
 * durations. Returns { list, top } for overlays(), or null when the shot has no cues.
 * `seconds` is the shot's length: the list is padded to it so the track never ends before the picture.
 */
export async function captionTrack(dir, tag, cues, { W, H, seconds }) {
  const items = (cues || []).filter((c) => c.png && c.end > c.start + 0.03).sort((a, b) => a.start - b.start);
  if (!items.length) return null;
  const metas = await Promise.all(items.map((c) => sharp(c.png).metadata()));
  const slot = Math.max(...metas.map((m) => m.height || 1));
  // Where the slot sits: every band's bottom edge is (about) the same line, so the slot's bottom goes there.
  const bottom = Math.max(...items.map((c, k) => Math.round(c.y ?? 0) + (metas[k].height || 0)));
  const top = Math.max(0, Math.min(H - slot, bottom - slot));
  fs.mkdirSync(dir, { recursive: true });
  const blank = path.join(dir, `blank-${slot}.png`);
  if (!cached(blank, 100)) await sharp({ create: { width: W, height: slot, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(blank);
  const slotted = new Map();          // band png → slot-sized png (shared across shots: the same cue png recurs)
  const slotFile = async (png, h) => {
    if (slotted.has(png)) return slotted.get(png);
    const out = path.join(dir, `s${slot}-${path.basename(png)}`);
    if (!cached(out, 100)) {
      await sharp({ create: { width: W, height: slot, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: png, top: slot - h, left: 0 }]).png({ compressionLevel: 6 }).toFile(out);
    }
    slotted.set(png, out);
    return out;
  };
  const lines = ["ffconcat version 1.0"];
  const q = (f) => `file '${f.replace(/'/g, "'\\''")}'`;
  let t = 0;
  for (let k = 0; k < items.length; k++) {
    const c = items[k];
    const start = Math.max(t, c.start), end = Math.max(start + 0.04, Math.min(c.end, k + 1 < items.length ? items[k + 1].start : c.end));
    if (start - t > 0.01) { lines.push(q(blank), `duration ${(start - t).toFixed(3)}`); }
    lines.push(q(await slotFile(c.png, metas[k].height || slot)), `duration ${(end - start).toFixed(3)}`);
    t = end;
  }
  const tail = Math.max(0.2, seconds - t + 0.5);
  lines.push(q(blank), `duration ${tail.toFixed(3)}`, q(blank));   // the last entry is repeated so its duration counts
  const list = path.join(dir, `track-${tag}.txt`);
  fs.writeFileSync(list, lines.join("\n") + "\n");
  return { list, top, slot };
}

/**
 * A word card: the line the narrator is speaking, alone on the brand colour, centred.
 *
 * It shares the header's typography on purpose. A card drawn by a different piece of code ends up left-aligned
 * and small on a widescreen frame, and the film stops looking like one thing.
 */
export async function wordCardPng(file, { W, H, text, accent = "#0e9e90" }) {
  const t = String(text || "").trim() || " ";
  const dev = /[ऀ-ॿ]/.test(t);
  const fam = dev ? "Noto Sans Devanagari, Lohit Devanagari, Mukta, sans-serif" : "Liberation Sans, DejaVu Sans, sans-serif";
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wide = W >= H;
  const visible = [...t.replace(/\p{M}/gu, "")].length;
  const base = visible <= 16 ? 0.085 : visible <= 28 ? 0.072 : visible <= 44 ? 0.060 : 0.050;
  const size = Math.round(W * (wide ? base * 0.58 : base));
  const colW = Math.round(W * (wide ? 0.76 : 0.84));
  const perLine = Math.max(8, Math.round(colW / (size * (dev ? 0.62 : 0.55))));
  const lines = [];
  let line = "";
  for (const w of t.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if ([...next.replace(/\p{M}/gu, "")].length <= perLine) line = next;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 4);
  const step = Math.round(size * 1.3);
  const first = Math.round(H / 2 - ((shown.length - 1) * step) / 2 + size * 0.34);
  let body = "";
  shown.forEach((l, i) => {
    body += `<text x="${Math.round(W / 2)}" y="${first + i * step}" text-anchor="middle" font-family="${fam}" font-size="${size}" font-weight="800" fill="#ffffff">${esc(l)}</text>`;
  });
  const barW = Math.round(W * (wide ? 0.06 : 0.11));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#0f141c"/><stop offset="1" stop-color="#1c2735"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="${Math.round((W - barW) / 2)}" y="${first - Math.round(size * 1.15)}" width="${barW}" height="6" rx="3" fill="${accent}"/>
  ${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}

/** A stock clip cut to length: filled to frame, graded, looped when the clip is shorter than the paragraph. */
async function stockShot(ff, out, { clipFile, frames, W, H, over }) {
  const args = ["-y", "-loglevel", "error", "-stream_loop", "-1", "-i", clipFile];
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${GRADE},fps=${FPS}`;
  overlays(args, vf, over);
  args.push("-frames:v", String(frames), "-fps_mode", "cfr", ...SHOT_V, out);
  await ff(args);
}

/**
 * THE CAMERA.
 *
 * A picture that sits still reads as a dead frame; one that lurches reads as a cheap slideshow. Between the two is
 * the documentary move: a slow push or drift at CONSTANT speed that is already going on the first frame and still
 * going on the last, so the film never looks as if it has stopped — not at the head of a shot, not at its tail,
 * not under the dissolve. Three rules decide every move:
 *
 *   speed, not distance   ZOOM_RATE per second (a 3.5 s shot travels 9%, an 11 s shot 24%). A fixed distance was
 *                         a lurch on a short shot and, spread over eleven seconds, invisible again.
 *   linear, not eased     ease-in/ease-out brought every shot to a standstill at both ends — exactly where the eye
 *                         is looking for the cut — and the first film's owner read those ends as still frames.
 *   nothing stands still  a push into the CENTRE leaves the subject in the centre motionless. Every move keeps
 *                         its fixed point off centre and lets it drift, so even the subject glides a little.
 *
 * A framing is [zoom, fx, fy]: how far in, and where the window sits across the room it has to move in
 * (0 = left/top edge, 1 = right/bottom edge). A move is a start framing and an end framing, walked in a straight
 * line. Seven of them, in rotation, so consecutive pictures do not all do the same thing; a second framing of the
 * SAME picture (`tight`) starts a step closer, so the cut reads as a detail rather than the picture bouncing back.
 */
export const MOVES = ["push", "pan-right", "pull", "push-left", "tilt-down", "push-right", "pan-left"];
const ZOOM_RATE = 0.024;                       // zoom travel per second of a push or pull
const ZOOM_MIN = 0.085, ZOOM_MAX = 0.24;       // a short shot still moves; a long one never goes soft
const PAN_ZOOM = 0.10;                         // a pan holds this much zoom — the room it has to move in
const PAN_RATE = 0.06;                         // how much of that room a pan crosses per second (each way)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** The move's start and end framings for a shot of `seconds`. Exported for the tests, which measure it. */
export function framing(move, seconds, { tight = false } = {}) {
  const T = clamp(ZOOM_RATE * seconds, ZOOM_MIN, ZOOM_MAX);
  const D = clamp(PAN_RATE * seconds, 0.18, 0.40);
  // A push starts a hair in (1.04), not at 1.00: at 1.00 the window has no room to drift, and a push whose
  // window does not drift leaves the subject in the middle standing still. The second framing of a picture
  // (`tight`) starts a step closer throughout, so the cut reads as a detail rather than the picture bouncing.
  const z0 = tight ? 1.10 : 1.04;
  const pz = tight ? 1.06 + PAN_ZOOM : 1.0 + PAN_ZOOM;
  let from, to;
  switch (move) {
    case "pull":       from = [z0 + T, 0.62, 0.40]; to = [z0, 0.38, 0.56]; break;
    case "push-left":  from = [z0, 0.56, 0.52]; to = [z0 + T, 0.22, 0.44]; break;
    case "push-right": from = [z0, 0.44, 0.52]; to = [z0 + T, 0.78, 0.44]; break;
    case "pan-right":  from = [pz, 0.5 - D, 0.50]; to = [pz + T * 0.5, 0.5 + D, 0.46]; break;
    case "pan-left":   from = [pz, 0.5 + D, 0.50]; to = [pz + T * 0.5, 0.5 - D, 0.46]; break;
    case "tilt-down":  from = [pz, 0.50, 0.5 - D]; to = [pz + T * 0.5, 0.54, 0.5 + D]; break;
    case "tilt-up":    from = [pz, 0.50, 0.5 + D]; to = [pz + T * 0.5, 0.54, 0.5 - D]; break;
    default:           from = [z0, 0.64, 0.56]; to = [z0 + T, 0.36, 0.42]; break;   // push
  }
  return { from, to, seconds };
}
/** The second framing of the same picture: the opposite move, a step closer. */
export const OPPOSITE = { push: "pull", pull: "push", "push-left": "push-right", "push-right": "push-left", "pan-right": "pan-left", "pan-left": "pan-right", "tilt-down": "tilt-up", "tilt-up": "tilt-down" };

/**
 * The camera as an ffmpeg filter: the window walks from the start framing to the end framing in a straight line.
 * perspective, not zoompan: zoompan can only place its window on whole source pixels, so a drift of 17 px a
 * second moves on some frames and stands still on others — a stutter the eye reads as "cheap slideshow" even when
 * it cannot say why. perspective resamples at sub-pixel positions (measured frame-to-frame unevenness: 0.61 with
 * zoompan on a 1.5x frame, 0.01 here) and needs no oversampled frame at all, so it also uses less memory.
 * It costs more CPU than zoompan (cubic ≈ 50 ms a frame on one core): a five-minute film pays a few minutes for
 * a picture that never judders. `interpolation=linear` would halve that at a touch of softness.
 * `on` counts output frames from 1 in this filter, hence (on-1).
 */
function cameraFilter(move, frames, { tight = false } = {}) {
  const { from, to } = framing(move, frames / FPS, { tight });
  const n = Math.max(1, frames - 1);           // the last frame lands exactly on the end framing
  const t = `((on-1)/${n})`;
  const line = (a, b) => (Math.abs(a - b) < 1e-6 ? a.toFixed(4) : `(${a.toFixed(4)}+${(b - a).toFixed(5)}*${t})`);
  return windowFilter(line(from[0], to[0]), line(from[1], to[1]), line(from[2], to[2]));
}
/** cubic keeps the picture crisp; EXPLAINER_CAMERA=linear is a third cheaper and a touch softer, for a slow server. */
const CAMERA_INTERP = process.env.EXPLAINER_CAMERA === "linear" ? "linear" : "cubic";
/** perspective over the window at zoom z whose position across the room is (fx, fy) — all three expressions. */
function windowFilter(z, fx, fy) {
  const L = `(${fx}*(W-W/${z}))`, T = `(${fy}*(H-H/${z}))`, R = `(${L}+W/${z})`, B = `(${T}+H/${z})`;
  return `perspective=x0=${L}:y0=${T}:x1=${R}:y1=${T}:x2=${L}:y2=${B}:x3=${R}:y3=${B}:interpolation=${CAMERA_INTERP}:sense=source:eval=frame`;
}

/** A picture (the owner's, or one made for the line) with a slow camera move — a still that sits dead on screen looks like a mistake. */
async function photoShot(ff, out, { photoFile, frames, W, H, over, move = "push", tight = false }) {
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${cameraFilter(move, frames, { tight })},${GRADE}`;
  // -framerate before the looped image: without it the loop runs at 25 fps and every frame count below is wrong.
  const args = ["-y", "-loglevel", "error", "-framerate", String(FPS), "-loop", "1", "-i", photoFile];
  overlays(args, vf, over);
  args.push("-frames:v", String(frames), "-fps_mode", "cfr", ...SHOT_V, out);
  await ff(args);
}

/** A full-screen card (already drawn by the engine's slide()) held for the paragraph. Also used for the
 *  opening and closing cards, which are cards in every style of film. A card breathes too — a slow, constant
 *  push (1.4% a second, never under 5% or over 12%), so even the title is not a dead frame. The words stay
 *  centred: a card that drifts sideways looks mis-registered, not filmed. */
export async function stillShot(ff, out, { png, frames, W, H, logoPng, prevPng = null }) {
  const travel = clamp(0.014 * (frames / FPS), 0.05, 0.12);
  const n = Math.max(1, frames - 1);
  const vf = `scale=${W}:${H},${windowFilter(`(1.0+${travel.toFixed(4)}*(on-1)/${n})`, "0.5", "0.5")}`;
  const args = ["-y", "-loglevel", "error", "-framerate", String(FPS), "-loop", "1", "-i", png];
  overlays(args, vf, { logoPng, prevPng });
  args.push("-frames:v", String(frames), "-fps_mode", "cfr", ...SHOT_V, out);
  await ff(args);
}

/** The shot's final frame, kept as a PNG: the next shot dissolves out of it. */
export async function lastFrame(ff, mp4, png, frames) {
  await ff(["-y", "-loglevel", "error", "-i", mp4, "-vf", `select='eq(n,${Math.max(0, frames - 1)})'`, "-frames:v", "1", "-update", "1", png]);
  return png;
}

/**
 * Build every shot of the film, in order, and return the segment files.
 *
 * shots[i] = { text, frames, para, slice, slices } — para is which paragraph it belongs to, and slice/slices
 * say it is one of several cuts off the same sentence.
 * plan[i]  = { kind, picture, search, heading } from shotlist.mjs.
 * pictures[p] = how many NEW generated pictures paragraph p may buy (allocatePictures decided).
 *
 * A source picture is used for at most MAX_SHOTS_PER_SOURCE consecutive shots and never crosses into the next
 * paragraph: when the topic changes, the picture changes. The second shot off a source is a tighter crop of it,
 * pushed the other way, which on a phone reads as a second angle and costs nothing.
 */
export async function buildShots(dir, { W, H }, { shots, plan, pictures, photoFiles, accent, logoPng, ff, findClip, H: helpers, tag, fallbackCard, cuesByShot = new Map(), introLast = null, onStep, moveOverride = null }) {
  const files = [];
  const used = [];                       // per shot: { picture, move, tight, kind } — the Scene Editor reads this back
  const record = (i, r) => { used[i] = { picture: r.picture ? path.basename(r.picture) : null, move: r.move ?? null, tight: !!r.tight, kind: r.kind }; };
  const usedClips = new Set();
  const usedPhotos = new Map();          // own photo → how many times it has been shown
  let source = null;                     // { file, shotsLeft, move } — the picture currently on screen
  let para = -1;
  const lastPng = (i) => path.join(dir, `last-${tag}-${i}.png`);
  const headingAt = (i) => String(plan[i]?.heading ?? "").trim();
  const unplannedCards = [];             // shots that ended up as word cards although a picture was wanted
  const plainShots = [];                 // shots that only rendered without subtitles/heading
  const picUse = new Map();              // picture file → how many shots it has been on screen for
  const bump = (f) => picUse.set(f, (picUse.get(f) ?? 0) + 1);
  /** The stand-in for a shot without its own picture: never the picture just shown, the least-used first, the
   *  nearest among those. This is what stops one picture sitting through four headings in a row. */
  const standIn = (i, candidates, avoid) => {
    let best = null, bestKey = null;
    for (const [j, f] of candidates) {
      if (f === avoid) continue;
      const key = [picUse.get(f) ?? 0, Math.abs(j - i)];
      if (!best || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { best = f; bestKey = key; }
    }
    return best;
  };

  for (let i = 0; i < shots.length; i++) {
    const sh = shots[i];
    const out = path.join(dir, `shot-${tag}-${i}.mp4`);
    if (sh.para !== para) { para = sh.para; source = null; }   // new topic, new picture
    if (cached(out)) {
      files.push(out);
      if (!cached(lastPng(i), 1000)) { try { await lastFrame(ff, out, lastPng(i), sh.frames); } catch { /* the next shot simply cuts */ } }
      // What a kept shot shows travels in its sidecar (written below), so an edit run still knows every scene.
      try { used[i] = JSON.parse(fs.readFileSync(`${out}.json`, "utf8")); } catch { used[i] = { picture: null, move: null, tight: false, kind: "kept" }; }
      // The picture on screen carries into the next shot's reframe exactly as it did when this shot was made.
      if (used[i]?.picture && fs.existsSync(path.join(dir, used[i].picture))) { const f = path.join(dir, used[i].picture); source = used[i].kind === "reframe" ? { file: f, shotsLeft: 0, move: used[i].move } : { file: f, shotsLeft: used[i].kind === "picture" ? MAX_SHOTS_PER_SOURCE - 1 : 0, move: used[i].move }; bump(f); }
      else source = null;
      await onStep?.(i, "kept");
      continue;
    }

    const want = plan[i] ?? { kind: "image" };
    const cap = want.heading ? await headerPng(path.join(dir, `hdr-${tag}-${i}.png`), { W, H, text: want.heading, accent }) : null;
    const seconds = sh.frames / FPS;
    const over = {
      capPng: cap,
      capIn: headingAt(i) !== headingAt(i - 1),
      capOut: headingAt(i) !== headingAt(i + 1),
      logoPng,
      prevPng: i > 0 ? (cached(lastPng(i - 1), 1000) ? lastPng(i - 1) : null) : (introLast && cached(introLast, 1000) ? introLast : null),
      captions: cuesByShot.get(i)?.length ? await captionTrack(path.join(dir, `captrack-${tag}`), String(i), cuesByShot.get(i), { W, H, seconds }) : null,
      seconds,
    };
    // Plain overlays for the retry: a shot that failed with subtitles and a heading is tried once more with only
    // the logo and the dissolve before it falls back to a word card.
    const plain = { logoPng, prevPng: over.prevPng };
    // A different move for every shot, and the second framing of one picture goes the other way — unless the
    // owner chose the move for this scene in the editor.
    const chosen = moveOverride?.get?.(i) && MOVES.includes(moveOverride.get(i)) ? moveOverride.get(i) : null;
    const move = chosen ?? MOVES[i % MOVES.length];
    let made = false;
    const tail = (e) => String(e?.message ?? e).replace(/\s+/g, " ").slice(-260);
    /** Try the shot with everything on it; if ffmpeg refuses, once more with only logo + dissolve. */
    const attempt = async (what, fn) => {
      try { await fn(over); return true; }
      catch (e) { helpers?.log?.(`[explain] shot ${i} ${what} failed with subtitles/heading (…${tail(e)}) — retrying plain`); }
      try { await fn(plain); plainShots.push(i); return true; }
      catch (e) { helpers?.log?.(`[explain] shot ${i} ${what} failed (…${tail(e)})`); return false; }
    };

    // 1. Still on the picture we already have? Then this is its second, tighter framing.
    // Never for a "text" shot: the planner asked for the words on screen because the words ARE the point, and
    // quietly showing the last picture again instead is how every word card disappeared from a finished film.
    // Not when this shot has a picture of its own (the editor gave it one): then it is a new source, not a second look.
    if (!made && want.kind !== "text" && source && source.shotsLeft > 0 && !pictures?.has(i)) {
      const back = chosen ?? OPPOSITE[source.move] ?? "pull";
      const src = source;
      if (await attempt("reframe", (o) => photoShot(ff, out, { photoFile: src.file, frames: sh.frames, W, H, over: o, move: back, tight: true }))) {
        source.shotsLeft -= 1; source.move = back; bump(src.file);
        made = true; record(i, { picture: src.file, move: back, tight: true, kind: "reframe" });
      }
    }

    // 2. The owner's own photo, when the planner put one here. Free, and never counted against the budget.
    if (!made && want.kind === "photo" && photoFiles?.length) {
      const pick = photoFiles.find((f) => (usedPhotos.get(f) ?? 0) < 2) ?? null;
      if (pick) {
        usedPhotos.set(pick, (usedPhotos.get(pick) ?? 0) + 1);
        if (await attempt("own photo", (o) => photoShot(ff, out, { photoFile: pick, frames: sh.frames, W, H, over: o, move }))) {
          source = { file: pick, shotsLeft: 0, move }; bump(pick);
          made = true; record(i, { picture: pick, move, kind: "photo" });
        }
      }
    }

    // 3. Filmed footage, when the planner asked for it.
    if (!made && want.kind === "stock" && want.search && helpers?.PEXELS && findClip) {
      try {
        const hit = await findClip(helpers, { search: want.search, search_alt: want.search }, sh.text, usedClips, true);
        if (hit) {
          const clip = path.join(dir, `clip-${i}.mp4`);
          const r = await fetch(hit.url, { signal: AbortSignal.timeout(120_000) });
          if (!r.ok) throw new Error(`clip download ${r.status}`);
          fs.writeFileSync(clip, Buffer.from(await r.arrayBuffer()));
          if (await attempt("footage", (o) => stockShot(ff, out, { clipFile: clip, frames: sh.frames, W, H, over: o }))) {
            source = null;               // footage moves by itself; it is never re-framed
            made = true; record(i, { picture: null, move: null, kind: "footage" });
          }
          fs.rm(clip, { force: true }, () => {});
        }
      } catch (e) { helpers?.log?.(`[explain] shot ${i} footage failed (${e?.message ?? e})`); }
    }

    // 4. The picture made and checked for this shot, if there is one.
    if (!made && pictures?.has(i)) {
      if (await attempt("picture", (o) => photoShot(ff, out, { photoFile: pictures.get(i), frames: sh.frames, W, H, over: o, move }))) {
        source = { file: pictures.get(i), shotsLeft: MAX_SHOTS_PER_SOURCE - 1, move }; bump(pictures.get(i));
        made = true; record(i, { picture: pictures.get(i), move, kind: "picture" });
      }
    }

    // 4b. No picture of its own (rejected by the check, or never budgeted): a stand-in, in this order — another
    // picture made for THIS paragraph, the owner's own photo, any picture in the film. Never the one just shown,
    // least-used first, so no picture sits through heading after heading. A word card is the last resort.
    if (!made && want.kind !== "text") {
      const shown = source?.file ?? null;
      const samePara = [...(pictures ?? new Map())].filter(([j]) => shots[j]?.para === sh.para && j !== i);
      const ownPhotos = (photoFiles ?? []).map((f, k) => [i + 1000 + k, f]);      // far away on purpose: used by count, not distance
      const anyPic = [...(pictures ?? new Map())].filter(([j]) => j !== i);
      for (const [what, pool] of [["neighbour picture", samePara], ["own photo (stand-in)", ownPhotos], ["nearest picture", anyPic]]) {
        const pick = standIn(i, pool, shown);
        if (!pick) continue;
        if (await attempt(what, (o) => photoShot(ff, out, { photoFile: pick, frames: sh.frames, W, H, over: o, move }))) {
          source = { file: pick, shotsLeft: 0, move }; bump(pick);
          if (photoFiles?.includes(pick)) usedPhotos.set(pick, (usedPhotos.get(pick) ?? 0) + 1);
          made = true; record(i, { picture: pick, move, kind: "stand-in" });
          break;
        }
      }
    }

    // 5. The words, full screen. Asked for, or the safety net under everything above.
    // No subtitles on a word card: the words are already the picture.
    if (!made) {
      if (want.kind !== "text") unplannedCards.push(i);
      const card = await fallbackCard(i, sh.text, want.heading);
      await stillShot(ff, out, { png: card, frames: sh.frames, W, H, logoPng, prevPng: over.prevPng });
      source = null; record(i, { picture: null, move: null, kind: "card" });
    }
    files.push(out);
    try { fs.writeFileSync(`${out}.json`, JSON.stringify(used[i])); } catch { /* the sidecar is a convenience */ }
    try { await lastFrame(ff, out, lastPng(i), sh.frames); } catch (e) { helpers?.log?.(`[explain] shot ${i} last frame failed (${e?.message ?? e})`); }
    await onStep?.(i, made ? want.kind : "text");
  }
  files.unplannedCards = unplannedCards;
  files.plainShots = plainShots;
  files.used = used;
  return files;
}
