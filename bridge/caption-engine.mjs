// Burnt-in word-highlight captions for ad videos (all tiers).
// The static ffmpeg on the VPS has no drawtext/libass, so each caption state
// is a PNG (sharp/SVG) overlaid with enable='between(t,a,b)'. Words are timed
// proportionally to their length inside each spoken line (TTS gives us the
// line duration), grouped 2-3 per screen, current word in the accent colour.
//
// This file is also the shared home for the render constants every engine uses
// (media-worker.mjs, ad-engine.mjs, realistic-engine.mjs, stock-reel.mjs,
// ad-v2.mjs, poster-video.mjs) — one delivery encode, one safe-area table,
// one audio master. Keep them here so a change lands everywhere at once.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DEV = "Noto Sans Devanagari, Noto Sans Gujarati, Noto Sans Gurmukhi, Noto Sans Bengali, Noto Sans Tamil, Noto Sans Telugu, Noto Sans Kannada, Noto Sans Malayalam, Noto Sans Oriya, Liberation Sans, DejaVu Sans, sans-serif";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isIndic = (s) => /[ऀ-ൿ]/.test(s);

/* ---------------- shared render constants ---------------- */

/** Every delivered video runs at 30 fps — 24 reads as a stutter on a phone feed. */
export const FPS = 30;

/**
 * Pixels of each edge that the PLATFORM covers with its own chrome, so nothing
 * we draw may sit there. Measured on a 1080x1920 frame:
 *   top         — WhatsApp Status progress bar + sender name (~230 px)
 *   bottomReel  — Instagram Reels username / caption / audio strip (~422 px)
 *   bottomStatus— WhatsApp Status reply box only (~269 px)
 *   side        — Reels right-hand action rail (~84 px)
 */
export const SAFE = {
  top: (H) => Math.round(H * 0.12),
  bottomReel: (H) => Math.round(H * 0.22),
  bottomStatus: (H) => Math.round(H * 0.14),
  side: (W) => Math.round(W * 0.078),
};

/** Every pass the file goes through BEFORE the last one: fast and near-lossless, never uploaded. */
export const INTERMEDIATE = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "14", "-pix_fmt", "yuv420p"];

/** The one encode the customer actually receives. Exactly one pass per file carries this. */
// -maxrate/-bufsize: CRF alone let a stock-footage reel run at 5 Mbps, which stutters when the phone gets 1–3 Mbps
// from the storage edge. 3 Mbps peak is still above what Instagram itself re-encodes to; quiet scenes stay well under it.
export const DELIVERY_V = ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", "3000k", "-bufsize", "6000k", "-profile:v", "high", "-level", "4.2", "-bf", "3", "-g", "60", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart+write_colr"];

/** Audio on any file that leaves us: 48 kHz stereo AAC, never the raw 24 kHz mono TTS. */
export const DELIVERY_A = ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"];

/** Last link of every audio chain: -14 LUFS (the level Instagram/YouTube normalise to) with a true-peak ceiling. */
export const MASTER_AF = "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.95,aresample=48000,aformat=channel_layouts=stereo";

/** Music under a voice: raised bed + sidechain duck, the pattern already proven in poster-video.mjs. */
export const DUCK = "sidechaincompress=threshold=0.05:ratio=8:attack=40:release=500:makeup=1";
export const MUSIC_VOL = 0.32;   // under a voice (the duck pulls it down when a word lands)
export const MUSIC_SOLO = 0.5;   // no voice at all

/** lines: [{ text, start, sec }] (start = when the line's audio begins, sec = spoken length). → cues [{ words[], hi, start, end }] one per word. */
export function wordCues(lines, { perGroup = 3 } = {}) {
  const cues = [];
  for (const l of lines) {
    const words = String(l.text || "").replace(/\[\[ALERT[^\]]*\]\]/g, "").split(/\s+/).map((w) => w.trim()).filter(Boolean);
    if (!words.length || !(l.sec > 0)) continue;
    const weights = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let t = l.start;
    const times = words.map((w, i) => { const d = (weights[i] / total) * l.sec; const c = { start: t, end: t + d }; t += d; return c; });
    // groups of ≤perGroup words, never across the line
    for (let g = 0; g < words.length; g += perGroup) {
      const grp = words.slice(g, g + perGroup);
      for (let k = 0; k < grp.length; k++) cues.push({ words: grp, hi: k, start: times[g + k].start, end: times[g + k].end });
    }
  }
  // avoid zero-length / overlapping windows (a line that runs longer than its scene slot pushes the next line, never hides it)
  return cues.reduce((acc, c) => { const prev = acc[acc.length - 1]; const start = prev && prev.end > c.start ? prev.end : c.start; acc.push({ ...c, start, end: Math.max(c.end, start + 0.08) }); return acc; }, []);
}

/**
 * One PNG per distinct (group, hi) — cues sharing the same group/hi reuse the file.
 * `bottom` = pixels to leave clear under the caption box; the default keeps it
 * above the Instagram Reels username/caption strip. A Status-only render can
 * pass SAFE.bottomStatus(H) to sit lower.
 *
 * Each PNG is only the BAND the caption occupies (W x ~170), not the whole frame,
 * and the cue carries `y` = where that band belongs. burnCaptions overlays at 0:y.
 */
export async function renderCuePngs(dir, cues, { W, H, accent = "#FFD54A", position = "low", bottom } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const cache = new Map();
  const fsz = Math.round(W * (W >= H ? 0.045 : 0.062)); // bigger on vertical
  const inset = position === "mid" ? Math.round(H * 0.36) : bottom ?? SAFE.bottomReel(H);
  const maxW = W * 0.86;
  for (const c of cues) {
    const key = `${c.words.join(" | ")}#${c.hi}`;
    if (cache.has(key)) { const hit = cache.get(key); c.png = hit.file; c.y = hit.y; continue; }
    const file = path.join(dir, `cap-${cache.size}.png`);
    const indic = c.words.some(isIndic);
    const f0 = indic ? fsz * 0.95 : fsz;
    // Width estimate that works for Indic too: matras, halants and other
    // combining marks are separate code points but draw no advance width,
    // so text.length over-counts a Hindi word by half.
    const runW = (words, f) => [...words.join(" ").replace(/\p{M}/gu, "")].length * f * (indic ? 0.62 : 0.58);
    let f = f0;
    let rows = [c.words];
    // 1. shrink until the single line fits
    while (runW(c.words, f) > maxW && f > f0 * 0.62) f *= 0.94;
    // 2. still too wide (three long words) → break onto two balanced lines, then shrink again
    if (runW(c.words, f) > maxW && c.words.length > 1) {
      let cut = 1, best = Infinity;
      for (let s = 1; s < c.words.length; s++) {
        const d = Math.abs(runW(c.words.slice(0, s), f) - runW(c.words.slice(s), f));
        if (d < best) { best = d; cut = s; }
      }
      rows = [c.words.slice(0, cut), c.words.slice(cut)];
      while (Math.max(...rows.map((r) => runW(r, f))) > maxW && f > f0 * 0.5) f *= 0.94;
    }
    f = Math.round(f);
    const lh = f * 1.32;
    const boxH = rows.length * lh + f * 0.5;
    const boxW = Math.min(W * 0.92, Math.max(...rows.map((r) => runW(r, f))) + f * 1.6);
    const yTop = H - inset - boxH;            // box bottom sits exactly on the safe line
    const x0 = (W - boxW) / 2;
    // The PNG is only the BAND the caption occupies, never a full 1080x1920 canvas.
    // ffmpeg decodes every overlay input into a raw RGBA frame and holds it for the whole
    // pass, so 60 full-frame cues meant 60 x 8.3 MB of frame buffers: burnCaptions grew to
    // fill whatever memory cap it was given (measured on the VPS: 912 MB under
    // MemoryMax=900M, 1509 MB under 1500M — it survived only because the kernel swapped).
    // A band is about eight times smaller and the same pass stays flat. `y` travels with
    // the cue so burnCaptions overlays it back in the right place.
    const pad = Math.ceil(f * 0.3) + 4;
    const bandTop = Math.max(0, Math.round(yTop - pad));
    const bandH = Math.max(1, Math.min(H - bandTop, Math.ceil(boxH + pad * 2)));
    let seen = 0;
    const text = rows.map((row, ri) => {
      const at = seen; seen += row.length;
      const baseline = (yTop - bandTop + f * 0.25 + (ri + 1) * lh - lh * 0.3).toFixed(0);
      return `<text x="${W / 2}" y="${baseline}" text-anchor="middle" font-family="${DEV}" font-size="${f}" font-weight="800" fill="#ffffff" stroke="#000" stroke-width="${Math.max(1, Math.round(f * 0.06))}" paint-order="stroke" letter-spacing="0.5">${row.map((w, i) => `<tspan fill="${at + i === c.hi ? accent : "#ffffff"}">${esc(w)}</tspan>${i < row.length - 1 ? " " : ""}`).join("")}</text>`;
    }).join("\n  ");
    const svg = `<svg width="${W}" height="${bandH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x0.toFixed(0)}" y="${(yTop - bandTop).toFixed(0)}" width="${boxW.toFixed(0)}" height="${boxH.toFixed(0)}" rx="${(f * 0.45).toFixed(0)}" fill="#000" fill-opacity="0.55"/>
  ${text}
</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(file);
    cache.set(key, { file, y: bandTop }); c.png = file; c.y = bandTop;
  }
  return cues;
}

/**
 * Overlay the cues onto inFile → outFile, each at its own `y` (renderCuePngs hands
 * back band-sized PNGs). Long cue lists are burnt in passes of ≤20 overlays.
 * ffmpeg(argsArray) runs the binary.
 *
 * This is normally the LAST pass the file goes through, so the final chunk
 * carries the delivery encode and every earlier chunk stays intermediate.
 * Audio is copied through untouched — it was already mastered at the concat.
 * Pass { final: false } if something else re-encodes afterwards.
 */
export async function burnCaptions(ffmpeg, inFile, outFile, cues, { final = true } = {}) {
  const withPng = cues.filter((c) => c.png);
  if (!withPng.length) { fs.copyFileSync(inFile, outFile); return outFile; }
  // This is the one pass in the pipeline whose memory used to be unbounded, and it is the
  // pass every captioned delivery ends on. Three things keep it flat on a 3.6 GB box whose
  // ffmpeg runs under MemoryMax=900M: band-sized cue PNGs (renderCuePngs above), a small
  // chunk, and capped input queues. Measured peak must NOT rise when the cap is raised.
  const CH = 20;
  let src = inFile;
  for (let p = 0; p < withPng.length; p += CH) {
    const chunk = withPng.slice(p, p + CH);
    const isLast = p + CH >= withPng.length;
    const dst = isLast ? outFile : outFile.replace(/\.mp4$/, `-cap${p}.mp4`);
    const args = ["-y", "-loglevel", "error", "-i", src];
    // one decoder thread + a short queue per PNG: default threads and queues on 60 inputs
    // blew the worker's task limit and let the graph buffer as much as it liked
    for (const c of chunk) args.push("-thread_queue_size", "4", "-threads", "1", "-i", c.png);
    let fc = "", last = "0:v";
    chunk.forEach((c, i) => { fc += `[${last}][${i + 1}:v]overlay=0:${Math.round(c.y ?? 0)}:enable='between(t,${c.start.toFixed(3)},${c.end.toFixed(3)})'[v${i}];`; last = `v${i}`; });
    fc += `[${last}]format=yuv420p[v]`;
    const fcFile = outFile.replace(/\.mp4$/, `-capf${p}.txt`); fs.writeFileSync(fcFile, fc);
    args.push("-filter_complex_threads", "1", "-filter_complex_script", fcFile, "-map", "[v]", "-map", "0:a?", ...(isLast && final ? DELIVERY_V : INTERMEDIATE), "-c:a", "copy", dst);
    await ffmpeg(args);
    if (src !== inFile) { try { fs.unlinkSync(src); } catch { /* ignore */ } }
    src = dst;
  }
  return outFile;
}

/**
 * Same video in another aspect ratio without a new AI generation.
 *   mode "fit"  — blurred-bars letterbox: the WHOLE master stays visible.
 *   mode "crop" — scale to fill, then centre-crop. Only safe for a master that
 *                 carries nothing outside the centre band (see below).
 *   mode "auto" — fit. Cropping is never chosen for you.
 *
 * Square is a LETTERBOX on purpose. Centre-cropping 1080x1920 to 1080x1080 keeps
 * only rows 420-1500, and everything that names the business lives outside that
 * band: the brand chip realistic-engine draws at SAFE.top(H) (y 230-308) and the
 * end card's logo and brand name (H*0.14 and H*0.2). A square post that carries
 * no brand is worse than a square post with bars. Do not switch this back without
 * first re-drawing the chip and the CTA card at the target size after the reframe,
 * the way the word captions already are.
 *
 * `final: false` when captions are burnt in afterwards (this pass is then only
 * an intermediate and must not carry the expensive delivery encode).
 */
export async function reframe(ffmpeg, inFile, outFile, { W, H, mode = "auto", final = true } = {}) {
  const how = mode === "crop" ? "crop" : "fit";
  // setsar=1: scaling a 9:16 master to fill 16:9 lands on 1920x3413.33, and
  // ffmpeg keeps the rounding error as a 10239:10240 pixel aspect, so the file
  // reports a nonsense display ratio. Force square pixels.
  const fc = how === "crop"
    ? `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuv420p[v]`
    : `[0:v]split=2[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,gblur=sigma=26,eq=brightness=-0.1[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]`;
  await ffmpeg(["-y", "-loglevel", "error", "-i", inFile, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", ...(final ? DELIVERY_V : INTERMEDIATE), "-c:a", "copy", outFile]);
  return outFile;
}
