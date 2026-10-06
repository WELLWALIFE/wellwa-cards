// Downloads the website's fonts from Google Fonts into public/fonts and writes their @font-face block into
// src/app/globals.css (docs/premium-look.md §2.1). Self-hosted, because fonts.gstatic.com URLs are versioned and
// user-agent dependent and a remote stylesheet's faces cannot carry our unicode-range.
//
// The list of files is FONT_FACES in src/lib/site-style.ts (one `face(…)` row = one woff2); this script reads it, so
// the TypeScript stays the single source. Run after changing that list:
//   node scripts/fetch-fonts.mjs            (NODE_EXTRA_CA_CERTS=… when the proxy's TLS is not trusted)
// Options: --dry   list the files without downloading or writing
//
// What it writes: public/fonts/<family>-<wght>[-ital][-deva].woff2, one @font-face per file with font-display: swap,
// Google's own latin unicode-range on latin files and the Devanagari block on -deva files (so a Devanagari file
// downloads only when a Devanagari glyph paints), plus a size-adjusted local fallback face per Latin family
// (scripts/font-metrics.mjs) and the FONT_METRICS table in site-style.ts.
import fs from "node:fs";
import path from "node:path";
import { fontMetrics, overrides, fallbackFace } from "./font-metrics.mjs";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const STYLE = path.join(APP, "src", "lib", "site-style.ts");
const CSS = path.join(APP, "src", "app", "globals.css");
const OUT = path.join(APP, "public", "fonts");
const dry = process.argv.includes("--dry");
// A modern Chrome: Google then serves woff2 with unicode-range per subset (an old UA gets one ttf per family).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const DEVA_RANGE = "U+0900-097F, U+1CD0-1CFF, U+A8E0-A8FF";
/** Latin display families: their fallback is Times New Roman, every other family's is Arial. */
const SERIF = new Set(["Instrument Serif", "Playfair Display", "Newsreader", "Fraunces", "DM Serif Display", "Lora", "Tiro Devanagari Hindi"]);

/* ---- the rows ---- */
const src = fs.readFileSync(STYLE, "utf8");
const block = /export const FONT_FACES[^=]*=\s*\[([\s\S]*?)\n\];/.exec(src)?.[1];
if (!block) throw new Error("FONT_FACES not found in site-style.ts");
const faces = [...block.matchAll(/face\("([^"]+)",\s*"([^"]+)"(?:,\s*"(latin|deva)")?(?:,\s*(true))?\)/g)]
  .map((m) => ({ family: m[1], w: m[2], sub: m[3] ?? "latin", ital: m[4] === "true" }));
const slug = (f) => f.toLowerCase().replace(/\s+/g, "-");
const fileOf = (f) => `${slug(f.family)}-${f.w}${f.ital ? "-ital" : ""}${f.sub === "deva" ? "-deva" : ""}.woff2`;
console.log(`${faces.length} files from FONT_FACES`);

/* ---- one css2 request per family ---- */
const byFamily = new Map();
for (const f of faces) (byFamily.get(f.family) ?? byFamily.set(f.family, []).get(f.family)).push(f);
function css2Url(family, rows) {
  const anyItal = rows.some((r) => r.ital);
  const weights = [...new Set(rows.map((r) => r.w))].sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
  const spec = weights.map((w) => w.replace("-", ".."));
  const axis = anyItal
    ? `ital,wght@${[...spec.map((w) => `0,${w}`), ...rows.filter((r) => r.ital).map((r) => `1,${r.w.replace("-", "..")}`)].join(";")}`
    : `wght@${spec.join(";")}`;
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${axis}&display=swap`;
}
/** The @font-face blocks of a Google stylesheet: { subset, style, weight ("400" | "400-600"), url, range }. */
function parse(css) {
  const out = [];
  for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    const body = m[2];
    const get = (k) => new RegExp(`${k}:\\s*([^;]+);`).exec(body)?.[1].trim() ?? "";
    out.push({ subset: m[1], style: get("font-style"), weight: get("font-weight").replace(/\s+/, "-"), url: /url\(([^)]+)\)/.exec(body)?.[1] ?? "", range: get("unicode-range") });
  }
  return out;
}

const fetched = []; // { face, file, bytes, range }
for (const [family, rows] of byFamily) {
  const url = css2Url(family, rows);
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${family}: ${res.status} for ${url}`);
  const blocks = parse(await res.text());
  for (const f of rows) {
    const want = f.sub === "deva" ? "devanagari" : "latin";
    const b = blocks.find((x) => x.subset === want && x.weight === f.w && x.style === (f.ital ? "italic" : "normal"));
    if (!b) { console.error(`  !! ${family} ${f.w}${f.ital ? " italic" : ""} ${want}: not in Google's stylesheet (served: ${[...new Set(blocks.map((x) => `${x.subset}/${x.weight}/${x.style}`))].join(" ")})`); continue; }
    const file = fileOf(f);
    let bytes = 0;
    if (!dry) {
      const r = await fetch(b.url, { headers: { "user-agent": UA } });
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, file), buf);
      bytes = buf.length;
    }
    fetched.push({ face: f, file, bytes, range: f.sub === "deva" ? DEVA_RANGE : b.range });
    console.log(`  ${file.padEnd(44)} ${bytes ? `${(bytes / 1024).toFixed(1)} KB` : "(dry)"}`);
  }
}
const total = fetched.reduce((s, x) => s + x.bytes, 0);
console.log(`${fetched.length} files, ${(total / 1024).toFixed(0)} KB total`);
if (dry) process.exit(0);

/* ---- metrics + fallback faces ---- */
const metrics = {};
for (const family of byFamily.keys()) {
  const latin = fetched.find((x) => x.face.family === family && x.face.sub === "latin" && !x.face.ital);
  if (!latin) continue; // a Devanagari-only family falls back to the system's Devanagari face; no metrics apply
  metrics[family] = overrides(fontMetrics(path.join(OUT, latin.file)), SERIF.has(family) ? "Times New Roman" : "Arial");
}

/* ---- globals.css ---- */
const faceCss = fetched.map(({ face, file, range }) =>
  `@font-face{font-family:"${face.family}";font-style:${face.ital ? "italic" : "normal"};font-weight:${face.w.replace("-", " ")};font-display:swap;src:url(/fonts/${file}) format("woff2");unicode-range:${range}}`);
const fallbackCss = Object.entries(metrics).map(([family, o]) => fallbackFace(family, o));
const cssBlock = [
  "/* fonts:start */",
  "/* Written by scripts/fetch-fonts.mjs from FONT_FACES (src/lib/site-style.ts) — do not edit by hand. Self-hosted, swap,",
  "   latin and Devanagari as separate files so a Devanagari file downloads only when its glyphs paint. */",
  ...faceCss,
  "/* Local fallbacks sized to each web font (scripts/font-metrics.mjs), so the swap moves no line. */",
  ...fallbackCss,
  "/* fonts:end */",
].join("\n");
let css = fs.readFileSync(CSS, "utf8");
if (!/\/\* fonts:start \*\/[\s\S]*\/\* fonts:end \*\//.test(css)) throw new Error("globals.css has no /* fonts:start */ … /* fonts:end */ markers");
css = css.replace(/\/\* fonts:start \*\/[\s\S]*\/\* fonts:end \*\//, cssBlock);
fs.writeFileSync(CSS, css);

/* ---- FONT_METRICS in site-style.ts ---- */
const rows = Object.entries(metrics).map(([family, o]) => `  "${family}": { fb: "${o.fb}", sizeAdjust: ${o.sizeAdjust}, ascent: ${o.ascent}, descent: ${o.descent}, lineGap: ${o.lineGap} },`);
const tsBlock = `/* metrics:start */\nexport const FONT_METRICS: Record<string, FontMetrics> = {\n${rows.join("\n")}\n};\n/* metrics:end */`;
if (!/\/\* metrics:start \*\/[\s\S]*\/\* metrics:end \*\//.test(src)) throw new Error("site-style.ts has no /* metrics:start */ … /* metrics:end */ markers");
fs.writeFileSync(STYLE, src.replace(/\/\* metrics:start \*\/[\s\S]*\/\* metrics:end \*\//, tsBlock));
console.log(`wrote ${faceCss.length} faces + ${fallbackCss.length} fallbacks to globals.css, ${rows.length} metrics to site-style.ts`);
