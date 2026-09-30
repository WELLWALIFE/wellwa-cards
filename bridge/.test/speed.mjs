// How fast the picture actually moves on screen, in output pixels per second, for every move and shot length.
import { MOVES, framing } from "../explainer-shots.mjs";
const OVER = 1.5;
function speeds(move, sec, W, H, tight = false) {
  const { from, to } = framing(move, sec, { tight });
  const iw = W * OVER, ih = H * OVER;
  const at = (t) => from.map((a, k) => a + (to[k] - a) * t);
  const win = (f) => ({ z: f[0], x: f[1] * (iw - iw / f[0]), y: f[2] * (ih - ih / f[0]) });
  const a = win(at(0.5 - 0.5 / sec)), b = win(at(0.5 + 0.5 / sec));   // one second apart, mid-shot
  const out = [];
  for (const u of [0, 0.25, 0.5, 0.75, 1]) for (const v of [0, 0.5, 1]) {
    // image point under output (u,v) at time a → where it is at time b
    const X = a.x + u * W * (iw / a.z) / W, Y = a.y + v * H * (ih / a.z) / H;
    const u2 = (X - b.x) * W / (iw / b.z), v2 = (Y - b.y) * H / (ih / b.z);
    out.push(Math.hypot(u2 - u * W, v2 - v * H));
  }
  const centre = out[7];   // u=0.5, v=0.5
  return { min: Math.min(...out), centre, mean: out.reduce((s, x) => s + x, 0) / out.length, max: Math.max(...out), zoom: `${from[0].toFixed(2)}→${to[0].toFixed(2)}` };
}
for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
  console.log(`\n${W}x${H}  (px/s mid-shot: min / centre / mean / max)`);
  for (const sec of [3.5, 6.5, 9, 11]) {
    const row = MOVES.map((m) => { const s = speeds(m, sec, W, H); return `${m.padEnd(10)} ${s.zoom} ${s.min.toFixed(0).padStart(3)}/${s.centre.toFixed(0).padStart(3)}/${s.mean.toFixed(0).padStart(3)}/${s.max.toFixed(0).padStart(3)}`; });
    console.log(`  ${sec}s`); for (const r of row) console.log(`     ${r}`);
  }
}
