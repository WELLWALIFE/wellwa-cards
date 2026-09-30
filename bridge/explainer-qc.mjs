// The last look before the owner gets the video. Cheap, deterministic checks on the finished file — the things
// that have actually gone wrong in delivered videos and that no picture-by-picture judge can see:
//
//   black    a stretch of black frames inside the film (a shot that failed to draw, a PNG that never rendered)
//   silent   a voice track that is not there (the mix mapped the wrong stream, or the voice never made it in)
//   short    a file that stops well before the timeline says it should
//
// It returns what it found and the engine decides: black windows are mapped back to shots, those shots are
// rebuilt, and the film is encoded once more. Nothing here calls a model or costs money.
import fs from "node:fs";
import path from "node:path";

const num = (re, s) => { const m = re.exec(s); return m ? Number(m[1]) : null; };

/**
 * ff(args) runs ffmpeg. `total` is the intended length in seconds. `voice` says a narration is expected.
 * Returns { ok, black: [{ start, end }], silent, seconds }.
 */
export async function checkFinal(ff, file, { total, voice = true, dir, log = () => {} }) {
  const out = { ok: true, black: [], silent: false, seconds: null };
  if (!fs.existsSync(file)) return { ...out, ok: false };
  const work = dir || path.dirname(file);
  const meta = path.join(work, "qc-meta.txt");
  try { fs.unlinkSync(meta); } catch { /* none */ }

  // One pass reads the video for black stretches and the audio for its level; ametadata/metadata write to a
  // file because the worker runs ffmpeg with -loglevel error and the detectors' own log lines are swallowed.
  const graph = `[0:v]blackdetect=d=0.5:pic_th=0.985:pix_th=0.10,metadata=mode=print:file=${meta}[v]`;
  try {
    await ff(["-y", "-loglevel", "error", "-i", file, "-filter_complex", graph, "-map", "[v]", "-f", "null", "-"]);
  } catch (e) { log(`[qc] black scan failed (${e?.message ?? e})`); }
  try {
    const txt = fs.readFileSync(meta, "utf8");
    let start = null;
    for (const line of txt.split("\n")) {
      const s = /lavfi\.black_start=([\d.]+)/.exec(line);
      const e = /lavfi\.black_end=([\d.]+)/.exec(line);
      if (s) start = Number(s[1]);
      if (e && start !== null) { out.black.push({ start, end: Number(e[1]) }); start = null; }
    }
    // A black that runs to the end of the file has no black_end line.
    if (start !== null) out.black.push({ start, end: total });
  } catch { /* no metadata written = nothing black */ }
  // The film fades from and to black on purpose; those are not faults.
  out.black = out.black.filter((b) => b.end > 0.9 && b.start < total - 1.2 && b.end - b.start >= 0.5);

  if (voice) {
    const vol = path.join(work, "qc-vol.txt");
    try { fs.unlinkSync(vol); } catch { /* none */ }
    // volumedetect reports through the log, which the worker swallows; astats writes its RMS per window to the
    // metadata file instead, and the loudest window says whether anyone is speaking at all.
    try {
      await ff(["-y", "-loglevel", "error", "-i", file, "-af", `astats=metadata=1:reset=48,ametadata=mode=print:file=${vol}:key=lavfi.astats.Overall.RMS_level`, "-vn", "-f", "null", "-"]);
      const txt = fs.readFileSync(vol, "utf8");
      let loudest = -Infinity;
      for (const line of txt.split("\n")) { const v = num(/RMS_level=(-?[\d.]+|-inf)/, line); if (v !== null && Number.isFinite(v)) loudest = Math.max(loudest, v); }
      if (loudest !== -Infinity && loudest < -45) out.silent = true;
    } catch (e) { log(`[qc] level scan failed (${e?.message ?? e})`); }
  }

  // Length: the container's own duration, read straight from the mp4's mvhd box (no probe tool, no decode).
  out.seconds = mp4Seconds(file);
  const short = out.seconds !== null && out.seconds < total - 2.5;

  out.ok = !out.black.length && !out.silent && !short;
  log(`[qc] ${out.ok ? "clean" : "problems"}: black=${out.black.length} silent=${out.silent} length=${out.seconds === null ? "?" : out.seconds.toFixed(1)}/${total.toFixed(1)}`);
  return out;
}

/** The duration an mp4 declares about itself: mvhd's duration / timescale. null when the box cannot be found. */
export function mp4Seconds(file) {
  try {
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, "r");
    try {
      const span = Math.min(size, 4 * 1024 * 1024);
      const heads = [0, Math.max(0, size - span)];
      for (const at of heads) {
        const buf = Buffer.alloc(span);
        fs.readSync(fd, buf, 0, span, at);
        const i = buf.indexOf("mvhd");
        if (i < 0) continue;
        const version = buf[i + 4];
        if (version === 1) {
          const timescale = buf.readUInt32BE(i + 4 + 4 + 8 + 8);
          const duration = Number(buf.readBigUInt64BE(i + 4 + 4 + 8 + 8 + 4));
          return timescale ? duration / timescale : null;
        }
        const timescale = buf.readUInt32BE(i + 4 + 4 + 4 + 4);
        const duration = buf.readUInt32BE(i + 4 + 4 + 4 + 4 + 4);
        return timescale ? duration / timescale : null;
      }
      return null;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}
