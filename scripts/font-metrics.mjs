// Fallback metrics for the self-hosted web fonts (docs/premium-look.md §2.1): the visitor's local Arial (sans) or
// Times New Roman (serif) is size-adjusted to the web font, so the swap from fallback to web font moves no line.
// Used by fetch-fonts.mjs; run alone to print the table:
//   node scripts/font-metrics.mjs
import fs from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const FONTS_DIR = path.join(APP, "public", "fonts");

/** How often each letter (and the space) occurs in English text: the average advance is weighted by this, as
 *  Capsize and next/font do. A subset font's OS/2 xAvgCharWidth averages every glyph it kept and is useless here. */
const WEIGHTS = { " ": 0.1936, a: 0.0657, b: 0.0126, c: 0.0251, d: 0.0343, e: 0.1033, f: 0.0196, g: 0.0159, h: 0.0393, i: 0.0575, j: 0.0017, k: 0.0054, l: 0.0338, m: 0.0202, n: 0.0569, o: 0.0633, p: 0.0168, q: 0.0005, r: 0.0506, s: 0.0528, t: 0.0745, u: 0.0218, v: 0.0083, w: 0.0135, x: 0.0019, y: 0.0135, z: 0.0008 };
function xAvg(font) {
  let sum = 0, total = 0;
  for (const [ch, w] of Object.entries(WEIGHTS)) {
    const g = font.glyphForCodePoint(ch.codePointAt(0));
    if (!g || g.id === 0) continue;
    sum += g.advanceWidth * w; total += w;
  }
  return total ? sum / total : font.unitsPerEm * 0.5;
}

/** The metrics the overrides need, read from one font file. */
export function fontMetrics(file) {
  const f = fontkit.create(fs.readFileSync(file));
  return { upm: f.unitsPerEm, ascent: f.ascent, descent: f.descent, lineGap: f.lineGap, xAvg: xAvg(f) };
}

/** hhea metrics and weighted average width of the two fallbacks. Measured once from Liberation Sans / Serif (the
 *  metric clones of Arial / Times New Roman, /usr/share/fonts on Debian); re-measured when those files are present. */
export const FALLBACKS = {
  Arial: { upm: 2048, ascent: 1854, descent: -434, lineGap: 67, xAvg: 892.71 },
  "Times New Roman": { upm: 2048, ascent: 1825, descent: -443, lineGap: 87, xAvg: 808.58 },
};
const LIBERATION = { Arial: "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "Times New Roman": "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf" };
for (const [name, file] of Object.entries(LIBERATION)) if (fs.existsSync(file)) FALLBACKS[name] = fontMetrics(file);

/** size-adjust / ascent / descent / line-gap overrides (percent, 2 dp) that make `fb` sit like the web font. */
export function overrides(m, fbName) {
  const fb = FALLBACKS[fbName];
  const sizeAdjust = (m.xAvg / m.upm) / (fb.xAvg / fb.upm);
  const r2 = (n) => Math.round(n * 100) / 100;
  const over = (v) => r2((Math.abs(v) / m.upm / sizeAdjust) * 100);
  return { fb: fbName, sizeAdjust: r2(sizeAdjust * 100), ascent: over(m.ascent), descent: over(m.descent), lineGap: over(m.lineGap) };
}

/** One @font-face for the fallback family ("Inter Fallback"), with the overrides. */
export function fallbackFace(family, o) {
  const src = o.fb === "Arial" ? `local("Arial")` : `local("Times New Roman"), local("Noto Serif")`;
  return `@font-face{font-family:"${family} Fallback";src:${src};size-adjust:${o.sizeAdjust}%;ascent-override:${o.ascent}%;descent-override:${o.descent}%;line-gap-override:${o.lineGap}%}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  console.log("fallbacks", JSON.stringify(FALLBACKS));
  for (const name of fs.readdirSync(FONTS_DIR).filter((n) => n.endsWith(".woff2") && !n.includes("-deva")).sort()) {
    const m = fontMetrics(path.join(FONTS_DIR, name));
    console.log(name.padEnd(40), JSON.stringify(m), "→ Arial", JSON.stringify(overrides(m, "Arial")));
  }
}
