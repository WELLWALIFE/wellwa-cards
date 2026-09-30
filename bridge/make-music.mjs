// Generates the four built-in music beds (synthesised with ffmpeg, royalty-free
// by construction) into bridge/music/*.mp3. Drop real mp3s with the same names
// to replace them. Run once: node bridge/make-music.mjs
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.WA_FFMPEG || (fs.existsSync("/opt/neuraledge/bin/ffmpeg") ? "/opt/neuraledge/bin/ffmpeg" : "ffmpeg");
const DIR = path.join(__dirname, "music"); fs.mkdirSync(DIR, { recursive: true });
const D = 24;
// chord pads: layered sines with slow tremolo + gentle low-pass; arpeggio for festive/upbeat
const pad = (notes, vol) => notes.map((f, i) => `sine=f=${f}:d=${D},volume=${vol},tremolo=f=${0.18 + i * 0.05}:d=0.35[p${i}]`).join(";") + ";" + notes.map((_, i) => `[p${i}]`).join("") + `amix=inputs=${notes.length}:normalize=0`;
const BEDS = {
  soft:    `${pad([196, 246.9, 293.7, 392], 0.18)},lowpass=f=1200,afade=t=in:d=2,afade=t=out:st=${D - 3}:d=3`,
  calm:    `${pad([174.6, 220, 261.6, 329.6], 0.16)},lowpass=f=900,aecho=0.6:0.3:600:0.25,afade=t=in:d=2,afade=t=out:st=${D - 3}:d=3`,
  festive: `${pad([261.6, 329.6, 392, 523.3], 0.14)},lowpass=f=2500[base];sine=f=1046.5:d=${D},volume=0.12,tremolo=f=6:d=0.9,aecho=0.7:0.4:180:0.35[bell];[base][bell]amix=inputs=2:normalize=0,afade=t=in:d=1,afade=t=out:st=${D - 3}:d=3`,
  upbeat:  `${pad([220, 277.2, 329.6, 440], 0.16)},lowpass=f=1800[base];sine=f=110:d=${D},volume=0.25,tremolo=f=2.2:d=1[bass];[base][bass]amix=inputs=2:normalize=0,afade=t=in:d=1,afade=t=out:st=${D - 3}:d=3`,
};
for (const [k, f] of Object.entries(BEDS)) {
  const out = path.join(DIR, `${k}.mp3`);
  await run(FFMPEG, ["-y", "-loglevel", "error", "-filter_complex", f, "-t", String(D), "-c:a", "libmp3lame", "-b:a", "128k", out]);
  console.log("wrote", out);
}
