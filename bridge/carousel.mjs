// Carousel posts (owner, 2 Nov 2026 — a content app plans ~30% of its posts as carousels: several slides a customer swipes
// through, the posts people save and share most). One day of the month plan with `brief.slides` → N pictures, 1080×1350
// (Instagram / Facebook feed): a cover with the day's heading, one slide per step, and an ending with the name, number and
// link. All drawn here (SVG + sharp, the poster fonts) in the business's own colour — no AI, ₹0. A free account's preview
// carries a diagonal "SAMPLE" band on every slide (drawn in, so no clean copy exists).
import "./fonts-setup.mjs";
import fs from "node:fs";
import sharp from "sharp";
import { measure, wrap, escText as esc, fitSize } from "./signature.mjs";

const W = 1080, H = 1350;
const FONT = "'Baloo 2', 'Poppins', 'Mukta', sans-serif";

function hsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return { h: 262, s: 0.7, l: 0.5 };
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return { h, s, l };
}
const hx = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
};
/** deep (backgrounds), mid (the colour itself, readable on white), soft (tint), pop (a warm highlight). */
function colours(accent) {
  const { h, s } = hsl(accent);
  const sat = Math.max(0.45, Math.min(0.85, s));
  return { deep: hx(h, sat * 0.85, 0.16), deep2: hx(h + 18, sat, 0.30), mid: hx(h, sat, 0.42), soft: hx(h, Math.min(0.6, sat), 0.95), pop: "#ffd54a" };
}

const sample = () => `<g transform="translate(${W / 2},${H / 2}) rotate(-28)"><rect x="${-W}" y="-46" width="${W * 2}" height="92" fill="rgba(0,0,0,0.38)"/><text x="0" y="16" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="rgba(255,255,255,0.92)" letter-spacing="6">SAMPLE · SHUBHORA.COM</text></g>`;
const lines = (arr, x, y, size, lh, fill, weight = 800, anchor = "start") => arr.map((t, i) => `<text x="${x}" y="${y + i * lh}" text-anchor="${anchor}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(t)}</text>`).join("");
const dots = (i, n, y, on, off) => { const gap = 26, x0 = W / 2 - ((n - 1) * gap) / 2; return Array.from({ length: n }, (_, k) => `<circle cx="${x0 + k * gap}" cy="${y}" r="${k === i ? 8 : 6}" fill="${k === i ? on : off}"/>`).join(""); };

/** The biggest size ≤ hi at which the text wraps into ≤ max lines of `width`. */
function fitWrap(text, width, hi, lo, max) {
  for (let s = hi; s >= lo; s -= 4) { const l = wrap(text, s, width, 99); if (l.length <= max) return { size: s, lines: l }; }
  return { size: lo, lines: wrap(text, lo, width, max) };
}

function cover(o, c, n) {
  const t = fitWrap(o.title, W - 200, 104, 60, 4);
  const lh = Math.round(t.size * 1.18), y0 = Math.round(H / 2 - (t.lines.length * lh) / 2 + t.size * 0.35);
  const kick = o.kicker ? `<text x="100" y="${y0 - t.size - 30}" font-family="${FONT}" font-weight="700" font-size="34" letter-spacing="4" fill="${c.pop}">${esc(String(o.kicker).toUpperCase())}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.deep}"/><stop offset="1" stop-color="${c.deep2}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="${W - 60}" cy="140" r="260" fill="#ffffff" opacity="0.06"/><circle cx="80" cy="${H - 80}" r="200" fill="#ffffff" opacity="0.05"/>
<text x="100" y="150" font-family="${FONT}" font-weight="700" font-size="${fitSize(o.name, W - 360, 40, 26)}" fill="#ffffff" opacity="0.92">${esc(o.name)}</text>
${kick}${lines(t.lines, 100, y0, t.size, lh, "#ffffff")}
<rect x="100" y="${y0 + (t.lines.length - 1) * lh + 50}" width="140" height="10" rx="5" fill="${c.pop}"/>
<g><rect x="${W - 330}" y="${H - 170}" width="230" height="74" rx="37" fill="#ffffff"/><text x="${W - 215}" y="${H - 122}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="32" fill="${c.deep}">${esc(o.swipe)} →</text></g>
${dots(0, n, H - 132, c.pop, "rgba(255,255,255,0.35)").replace(/cx="(\d+(\.\d+)?)"/g, (m, v) => `cx="${Number(v) - 230}"`)}
${o.sample ? sample() : ""}</svg>`;
}

function step(o, c, i, n, s) {
  const h = fitWrap(s.h, W - 220, 84, 48, 3), hl = Math.round(h.size * 1.16);
  const t = fitWrap(s.t || "", W - 220, 48, 34, 6), tl = Math.round(t.size * 1.38);
  // the number, the heading and the line as one block, centred on the page (a short slide no longer leaves the lower half empty)
  const block = 148 + 50 + h.lines.length * hl + (t.lines.length ? 44 + t.lines.length * tl : 0);
  const top = Math.max(230, Math.round((H - block) / 2 - 40));
  const hy = top + 148 + 50 + h.size * 0.9;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="${c.soft}"/><rect x="0" y="0" width="22" height="${H}" fill="${c.mid}"/>
<text x="${W - 60}" y="${H - 150}" text-anchor="end" font-family="'Poppins', sans-serif" font-weight="800" font-size="420" fill="${c.mid}" opacity="0.07">${i}</text>
<text x="110" y="150" font-family="${FONT}" font-weight="700" font-size="30" fill="${c.mid}" opacity="0.9">${esc(o.name)}</text>
<text x="${W - 100}" y="150" text-anchor="end" font-family="'Poppins', sans-serif" font-weight="700" font-size="28" fill="${c.mid}" opacity="0.7">${i}/${n - 2}</text>
<circle cx="184" cy="${top + 74}" r="74" fill="${c.mid}"/><text x="184" y="${top + 100}" text-anchor="middle" font-family="'Poppins', sans-serif" font-weight="800" font-size="70" fill="#ffffff">${i}</text>
${lines(h.lines, 110, hy, h.size, hl, c.deep)}
${lines(t.lines, 110, hy + (h.lines.length - 1) * hl + 44 + t.size * 1.25, t.size, tl, "#2b2b3a", 500)}
${dots(i, n, H - 110, c.mid, "rgba(0,0,0,0.15)")}
${o.sample ? sample() : ""}</svg>`;
}

function ending(o, c, n) {
  const nm = fitWrap(o.name, W - 200, 76, 44, 2), nl = Math.round(nm.size * 1.15);
  const phone = o.phone ? `<rect x="140" y="760" width="${W - 280}" height="120" rx="60" fill="#25D366"/><text x="${W / 2}" y="838" text-anchor="middle" font-family="'Poppins', sans-serif" font-weight="800" font-size="52" fill="#ffffff">${esc(o.phone)}</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.deep2}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<text x="${W / 2}" y="300" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="40" fill="${c.pop}">${esc(o.save)}</text>
${lines(nm.lines, W / 2, 470, nm.size, nl, "#ffffff", 800, "middle")}
${o.line ? `<text x="${W / 2}" y="${470 + nm.lines.length * nl + 20}" text-anchor="middle" font-family="${FONT}" font-weight="500" font-size="36" fill="#ffffff" opacity="0.85">${esc(o.line)}</text>` : ""}
${phone}
${o.link ? `<text x="${W / 2}" y="980" text-anchor="middle" font-family="'Poppins', sans-serif" font-weight="600" font-size="34" fill="#ffffff" opacity="0.9">${esc(o.link)}</text>` : ""}
${dots(n - 1, n, H - 110, c.pop, "rgba(255,255,255,0.35)")}
${o.sample ? sample() : ""}</svg>`;
}

/** o = { title, kicker, slides: [{h, t}] (2–5), name, line, phone, link, accent, lang, sample } → the files written, in order.
 *  `base` is the path without ".jpg"; slide k is `${base}-${k}.jpg`. Files already there are reused. */
export async function renderCarousel(o, base) {
  const hi = (o.lang || "hi") === "hi";
  const slides = (o.slides || []).filter((s) => s && String(s.h || "").trim()).slice(0, 5);
  const opt = { ...o, swipe: hi ? "आगे देखें" : "Swipe", save: hi ? "Save करें · Share करें" : "Save · Share" };
  const c = colours(o.accent);
  const n = slides.length + 2;
  const svgs = [cover(opt, c, n), ...slides.map((s, k) => step(opt, c, k + 1, n, s)), ending(opt, c, n)];
  const out = [];
  for (let k = 0; k < svgs.length; k++) {
    const f = `${base}-${k + 1}.jpg`;
    if (!fs.existsSync(f)) await sharp(Buffer.from(svgs[k])).jpeg({ quality: 88 }).toFile(f);
    out.push(f);
  }
  return out;
}
