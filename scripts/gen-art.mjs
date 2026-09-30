// Generates the template artwork in public/art as standalone SVG files.
//
// Direction: abstract *photographic* imagery, not drawn scenes. Real photos at
// shallow depth of field are mostly light, colour and grain — so layered colour
// fields, bokeh, light leaks, flare and a film-grain pass read as photography,
// where a drawn room or person reads as clipart. Subjects are carried by a thin
// line mark and a caption rather than by illustration.
//
// Run with:  node scripts/gen-art.mjs

import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../public/art/", import.meta.url);
mkdirSync(OUT, { recursive: true });

/* ---------------- deterministic randomness ---------------- */
const prng = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/* ---------------- palettes ---------------- */
// [deep, mid, bright, warm accent] — four stops give the colour fields enough
// variation to look photographed rather than filled.
const PALETTES = {
  water:  ["#04262c", "#0e9e90", "#7fe6e0", "#ffd9a0"],
  clinic: ["#071a33", "#2563eb", "#8fc3ff", "#e6f0ff"],
  estate: ["#2a1607", "#c9781c", "#f6c98a", "#ffe9c4"],
  food:   ["#2a0b0b", "#d24b4b", "#ffb27a", "#ffe0b8"],
  gym:    ["#25100a", "#e0532f", "#ffb08a", "#ffd9a0"],
  salon:  ["#1a1140", "#6d5cf5", "#c3b6ff", "#ffd9f0"],
  office: ["#03231f", "#0d9488", "#7fd9cc", "#ffe6b8"],
  // The digital-card template sells software, so it gets its own night-violet family rather than borrowing a
  // service trade's palette — on a phone it reads as "app", which is exactly what is being sold.
  card:   ["#0c0a2e", "#6d4bf6", "#b9a8ff", "#ffd9a0"],
};

/** `a` moved `t` (0..1) of the way to `b`, both #rrggbb. */
const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift) => {
    const x = (pa >> shift) & 255, y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};

/** A four-stop palette built from one category accent: deep shade, the accent, a pale tint, warm light. */
const paletteFromAccent = (hex) => [mix(hex, "#0b1214", 0.72), hex, mix(hex, "#ffffff", 0.55), "#ffe0b8"];

// Every distinct accent in src/lib/poster-categories.ts — keep identical to
// COVER_ACCENTS in src/lib/card-facts.ts (coverArtFor() points at these files).
const COVER_ACCENTS = [
  "#f59e0b", "#db2777", "#d4af37", "#2563eb", "#92400e", "#dc2626", "#0e9e90", "#ea580c", "#7c3aed",
  "#0369a1", "#1f2937", "#b91c1c", "#78350f", "#c2410c", "#0f766e", "#0891b2", "#166534", "#16a34a",
  "#1e3a8a", "#111827", "#1d4ed8", "#b45309", "#374151", "#0f172a", "#0284c7", "#4f46e5", "#ff9933",
];

/* ---------------- the photographic pipeline ---------------- */
const DEFS = `
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
  <feColorMatrix type="saturate" values="0"/>
</filter>
<filter id="b60"><feGaussianBlur stdDeviation="60"/></filter>
<filter id="b28"><feGaussianBlur stdDeviation="28"/></filter>
<filter id="b10"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="b3"><feGaussianBlur stdDeviation="3"/></filter>`;

/**
 * The core look: several heavily-blurred colour masses, a scatter of bokeh
 * discs at mixed focus, a diagonal light leak, and an off-centre lens flare.
 */
function lightField(w, h, pal, seed, opts = {}) {
  const { density = 1, flare = true, leak = true } = opts;
  const r = prng(seed);
  const [deep, mid, bright, warm] = pal;
  const D = Math.max(w, h);

  let masses = `<g filter="url(#b60)">`;
  for (let i = 0; i < Math.round(7 * density); i++) {
    const c = [mid, bright, deep, warm][i % 4];
    masses += `<ellipse cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" rx="${(D * (0.18 + r() * 0.34)).toFixed(0)}" ry="${(D * (0.14 + r() * 0.3)).toFixed(0)}" fill="${c}" opacity="${(0.28 + r() * 0.42).toFixed(2)}"/>`;
  }
  masses += `</g>`;

  // bokeh at three focus depths — the strongest "real lens" cue
  const disc = (blur, n, rmin, rmax, omin, omax) => {
    let g = `<g filter="url(#${blur})">`;
    for (let i = 0; i < n; i++) {
      const rad = D * (rmin + r() * (rmax - rmin));
      const cx = r() * w, cy = r() * h;
      const c = [bright, warm, "#ffffff", mid][Math.floor(r() * 4)];
      const o = (omin + r() * (omax - omin)).toFixed(2);
      g += r() > 0.55
        ? `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="none" stroke="${c}" stroke-width="${(rad * 0.22).toFixed(1)}" opacity="${o}"/>`
        : `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${c}" opacity="${o}"/>`;
    }
    return g + `</g>`;
  };

  const flareMark = flare ? (() => {
    const fx = w * (0.18 + r() * 0.3), fy = h * (0.12 + r() * 0.24);
    let g = `<g><ellipse cx="${fx.toFixed(0)}" cy="${fy.toFixed(0)}" rx="${(D * 0.42).toFixed(0)}" ry="${(D * 0.34).toFixed(0)}" fill="${warm}" opacity="0.26" filter="url(#b60)"/>`;
    g += `<circle cx="${fx.toFixed(0)}" cy="${fy.toFixed(0)}" r="${(D * 0.05).toFixed(0)}" fill="#ffffff" opacity="0.5" filter="url(#b10)"/>`;
    for (let i = 1; i <= 4; i++) {
      const gx = fx + (w / 2 - fx) * (i / 2.2), gy = fy + (h / 2 - fy) * (i / 2.2);
      g += `<circle cx="${gx.toFixed(0)}" cy="${gy.toFixed(0)}" r="${(D * (0.02 + i * 0.012)).toFixed(0)}" fill="none" stroke="${bright}" stroke-width="${(D * 0.006).toFixed(1)}" opacity="${(0.18 - i * 0.03).toFixed(2)}" filter="url(#b3)"/>`;
    }
    return g + `</g>`;
  })() : "";

  const leakMark = leak
    ? `<path d="M${(-w * 0.1).toFixed(0)} ${(h * 0.9).toFixed(0)} L${(w * 0.36).toFixed(0)} ${(-h * 0.1).toFixed(0)} L${(w * 0.62).toFixed(0)} ${(-h * 0.1).toFixed(0)} L${(w * 0.16).toFixed(0)} ${(h * 1.1).toFixed(0)} Z" fill="${warm}" opacity="0.15" filter="url(#b28)"/>`
    : "";

  return `
<defs>
  <linearGradient id="base${seed}" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0%" stop-color="${bright}" stop-opacity="0.9"/>
    <stop offset="45%" stop-color="${mid}"/>
    <stop offset="100%" stop-color="${deep}"/>
  </linearGradient>
  <radialGradient id="vig${seed}" cx="0.5" cy="0.44" r="0.8">
    <stop offset="52%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.5"/>
  </radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#base${seed})"/>
${masses}
${disc("b28", Math.round(9 * density), 0.05, 0.15, 0.10, 0.30)}
${disc("b10", Math.round(11 * density), 0.02, 0.07, 0.14, 0.40)}
${disc("b3", Math.round(9 * density), 0.006, 0.022, 0.25, 0.65)}
${leakMark}
${flareMark}
<rect width="${w}" height="${h}" fill="url(#vig${seed})"/>`;
}

function wrap(w, h, inner, fill = false) {
  // fill: width/height of 100% leaves the SVG with no intrinsic aspect ratio, so
  // the card header's object-contain stretches it to the full box and the
  // slice below crops it properly. Only our own abstract banners use this —
  // a user's uploaded banner keeps its ratio so we never re-crop their framing.
  const size = fill
    ? `width="100%" height="100%" preserveAspectRatio="xMidYMid slice"`
    : `width="${w}" height="${h}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${size}>
<defs>${DEFS}</defs>
${inner}
<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.06" style="mix-blend-mode:overlay"/>
</svg>`.replace(/\n\s*/g, "\n");
}

/** Labels are author-written prose — escape before it goes into XML. */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------------- thin line marks ---------------- */
// One stroke weight across every subject so the whole set shares a language.
const MARKS = {
  drop:       `M0 -46 C 26 -12, 38 4, 38 18 A 38 38 0 0 1 -38 18 C -38 4, -26 -12, 0 -46 Z`,
  glass:      `M-26 -40 L26 -40 L18 44 L-18 44 Z M-23 -8 L23 -8`,
  ripple:     `M-48 0 A 48 22 0 0 0 48 0 M-30 0 A 30 14 0 0 0 30 0 M-12 0 A 12 6 0 0 0 12 0`,
  leaf:       `M0 44 C -40 14, -40 -30, 0 -46 C 40 -30, 40 14, 0 44 Z M0 44 L0 -30`,
  heart:      `M0 40 C -44 8, -44 -28, -20 -32 C -8 -34, 0 -24, 0 -18 C 0 -24, 8 -34, 20 -32 C 44 -28, 44 8, 0 40 Z`,
  stethoscope:`M-30 -42 L-30 -6 A 30 30 0 0 0 30 -6 L30 -42 M0 24 L0 6 M0 24 A 18 18 0 1 0 0 25`,
  flask:      `M-12 -42 L12 -42 M-8 -42 L-8 -6 L-30 36 A 8 8 0 0 0 -23 46 L23 46 A 8 8 0 0 0 30 36 L8 -6 L8 -42`,
  pill:       `M-30 -10 L12 -42 A 24 24 0 0 1 38 -2 L-4 30 A 24 24 0 0 1 -30 -10 Z M-10 -26 L24 2`,
  scan:       `M-40 -30 L-40 -46 L-24 -46 M40 -30 L40 -46 L24 -46 M-40 30 L-40 46 L-24 46 M40 30 L40 46 L24 46 M0 -22 A 22 30 0 0 0 0 38 A 22 30 0 0 0 0 -22 M-22 8 L22 8`,
  home:       `M-46 0 L0 -42 L46 0 M-34 -8 L-34 44 L34 44 L34 -8 M-12 44 L-12 12 L12 12 L12 44`,
  tower:      `M-32 46 L-32 -40 L32 -40 L32 46 M-14 -24 L-14 -8 M14 -24 L14 -8 M-14 6 L-14 22 M14 6 L14 22`,
  key:        `M-40 0 A 18 18 0 1 0 -4 0 L44 0 M32 0 L32 16 M44 0 L44 18`,
  sofa:       `M-46 8 L-46 -12 A 10 10 0 0 1 -26 -12 L-26 8 M46 8 L46 -12 A 10 10 0 0 0 26 -12 L26 8 M-30 8 L-30 -20 A 8 8 0 0 1 -22 -28 L22 -28 A 8 8 0 0 1 30 -20 L30 8 M-46 8 L46 8 L46 26 L-46 26 Z`,
  plate:      `M0 0 m-46 0 a 46 46 0 1 0 92 0 a 46 46 0 1 0 -92 0 M0 0 m-28 0 a 28 28 0 1 0 56 0 a 28 28 0 1 0 -56 0`,
  cutlery:    `M-24 -44 L-24 44 M-34 -44 L-34 -12 A 10 10 0 0 0 -14 -12 L-14 -44 M24 44 L24 -8 A 14 22 0 0 1 24 -44 A 14 22 0 0 1 24 -8`,
  cup:        `M-28 -26 L-28 20 A 20 20 0 0 0 12 20 L12 -26 Z M12 -14 A 14 14 0 0 1 12 8 M-34 38 L26 38`,
  flame:      `M0 46 C -30 32, -34 4, -14 -18 C -12 -4, -4 -2, -2 -12 C 2 -30, -6 -38, 0 -46 C 20 -30, 34 -8, 30 14 C 27 32, 16 44, 0 46 Z`,
  dumbbell:   `M-46 -16 L-46 16 M-34 -26 L-34 26 M34 -26 L34 26 M46 -16 L46 16 M-34 0 L34 0`,
  pulse:      `M-48 0 L-22 0 L-10 -30 L4 30 L16 0 L48 0`,
  scissors:   `M-30 -40 L22 34 M30 -40 L-22 34 M-28 40 A 12 12 0 1 0 -28 39 M28 40 A 12 12 0 1 0 28 39`,
  sparkle:    `M0 -46 L10 -12 L44 0 L10 12 L0 46 L-10 12 L-44 0 L-10 -12 Z`,
  bottle:     `M-10 -46 L10 -46 L10 -28 L20 -10 L20 40 A 6 6 0 0 1 14 46 L-14 46 A 6 6 0 0 1 -20 40 L-20 -10 L-10 -28 Z M-20 4 L20 4`,
  chart:      `M-44 40 L-44 -40 M-44 40 L44 40 M-28 24 L-28 -6 M-4 24 L-4 -24 M20 24 L20 -34`,
  handshake:  `M-46 -6 L-22 -22 L0 -8 L22 -22 L46 -6 M-22 -22 L-22 18 L0 30 L22 18 L22 -22`,
  laptop:     `M-34 -26 L34 -26 L34 18 L-34 18 Z M-46 30 L46 30 L38 18 L-38 18 Z`,
  board:      `M-44 -34 L44 -34 L44 22 L-44 22 Z M0 22 L0 44 M-28 -12 L12 -12 M-28 4 L-4 4`,
  bulb:       `M0 -46 A 30 30 0 0 0 -14 10 L-14 22 L14 22 L14 10 A 30 30 0 0 0 0 -46 Z M-12 32 L12 32 M-8 42 L8 42`,
  trophy:     `M-24 -38 L24 -38 L20 0 A 20 20 0 0 1 -20 0 Z M-24 -30 A 14 14 0 0 1 -24 -6 M24 -30 A 14 14 0 0 0 24 -6 M0 0 L0 24 M-20 42 L20 42 L20 24 L-20 24 Z`,
  people:     `M-24 -18 A 14 14 0 1 0 -24 -19 M24 -18 A 14 14 0 1 0 24 -19 M-46 30 A 22 22 0 0 1 -2 30 M2 30 A 22 22 0 0 1 46 30`,
  shield:     `M0 -44 L38 -30 L38 6 C 38 30, 20 42, 0 46 C -20 42, -38 30, -38 6 L-38 -30 Z M-16 2 L-4 16 L18 -12`,
};

/* ---------------- outputs ---------------- */

/** Wide cover art — pure light field, no mark, so the name sits cleanly on it. */
const banner = (palKey, seed) => wrap(1800, 600, lightField(1800, 600, PALETTES[palKey], seed, { density: 1.15 }), true);

/**
 * Software-company cover: a dark deep-space field with a faint dot grid, a connected node network and a couple of
 * bright data arcs. Abstract on purpose — a real IT banner is a network diagram, not a photograph, and the card
 * owner's name and photo sit on top of this, so the left third is kept quiet and dark.
 */
function techBanner(palKey, seed) {
  const w = 1800, h = 600, r = prng(seed), [deep, mid, bright, warm] = PALETTES[palKey];

  // The dot grid fades out towards the left so the name and avatar stay readable over it.
  let grid = `<g>`;
  for (let y = 40; y < h; y += 44) {
    for (let x = 40; x < w; x += 44) {
      const fade = Math.min(1, Math.max(0, (x / w - 0.12) * 1.5));
      if (fade <= 0.02) continue;
      grid += `<circle cx="${x}" cy="${y}" r="1.7" fill="${bright}" opacity="${(0.1 + fade * 0.22).toFixed(2)}"/>`;
    }
  }
  grid += `</g>`;

  // Nodes live on the right two-thirds, where a card header has no text.
  const nodes = [];
  for (let i = 0; i < 16; i++) nodes.push([w * (0.3 + r() * 0.68), h * (0.12 + r() * 0.76)]);
  let net = `<g stroke="${bright}" fill="none" stroke-linecap="round">`;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1];
      const d = Math.hypot(dx, dy);
      if (d > 300) continue;
      net += `<line x1="${nodes[i][0].toFixed(0)}" y1="${nodes[i][1].toFixed(0)}" x2="${nodes[j][0].toFixed(0)}" y2="${nodes[j][1].toFixed(0)}" stroke-width="1.2" opacity="${(0.3 - d / 1400).toFixed(2)}"/>`;
    }
  }
  net += `</g><g>`;
  for (const [x, y] of nodes) {
    const big = r() > 0.72;
    net += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${big ? 7 : 3.4}" fill="${big ? warm : bright}" opacity="${big ? 0.9 : 0.65}"/>`;
    if (big) net += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="17" fill="none" stroke="${warm}" stroke-width="1.4" opacity="0.35"/>`;
  }
  net += `</g>`;

  // Two long arcs sweeping across, the way a network or data-flow diagram is drawn.
  const arc = (yA, yB, op, sw, col) =>
    `<path d="M-60 ${yA} C ${w * 0.3} ${yA - 180}, ${w * 0.64} ${yB + 180}, ${w + 60} ${yB}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${op}" stroke-linecap="round"/>`;

  return wrap(w, h, `
<defs>
  <linearGradient id="tb${seed}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#05040f"/><stop offset="46%" stop-color="${deep}"/><stop offset="100%" stop-color="${mid}"/>
  </linearGradient>
  <radialGradient id="tg${seed}" cx="0.74" cy="0.3" r="0.62">
    <stop offset="0%" stop-color="${bright}" stop-opacity="0.5"/><stop offset="100%" stop-color="${bright}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="tl${seed}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#05040f" stop-opacity="0.92"/><stop offset="52%" stop-color="#05040f" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#tb${seed})"/>
<rect width="${w}" height="${h}" fill="url(#tg${seed})"/>
${grid}
${arc(h * 0.72, h * 0.3, 0.3, 2.4, bright)}
${arc(h * 0.34, h * 0.78, 0.18, 1.6, warm)}
${net}
<rect width="${w}" height="${h}" fill="url(#tl${seed})"/>
`, true);
}

/** Gallery tile: light field + a large faint line mark + caption. */
function tile(palKey, mark, seed) {
  const w = 1200, h = 900, s = Math.min(w, h) / 150;
  return wrap(w, h, `
${lightField(w, h, PALETTES[palKey], seed)}
<g transform="translate(${w / 2} ${h * 0.5}) scale(${(s * 1.02).toFixed(2)})" fill="none" stroke="#000000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.14">
  <path d="${MARKS[mark]}"/>
</g>
<g transform="translate(${w / 2} ${h * 0.5}) scale(${s.toFixed(2)})" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
  <path d="${MARKS[mark]}"/>
</g>
`);
}

/** Product shot: a studio sweep with a soft key light and a floor reflection. */
function productShot(palKey, mark, seed) {
  const w = 1200, h = 1200, pal = PALETTES[palKey], r = prng(seed), s = 3.4;
  let dust = "";
  for (let i = 0; i < 14; i++) {
    dust += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.7).toFixed(0)}" r="${(2 + r() * 5).toFixed(1)}" fill="#ffffff" opacity="${(0.10 + r() * 0.2).toFixed(2)}"/>`;
  }
  return wrap(w, h, `
<defs>
  <linearGradient id="sweep" x1="0" y1="0" x2="0.2" y2="1">
    <stop offset="0%" stop-color="#ffffff"/><stop offset="58%" stop-color="#f4f7f8"/>
    <stop offset="100%" stop-color="#cfd8dc"/>
  </linearGradient>
  <radialGradient id="key" cx="0.32" cy="0.2" r="0.8">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="refl" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${pal[1]}" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="${pal[1]}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#sweep)"/>
<rect width="${w}" height="${h}" fill="url(#key)"/>
<ellipse cx="${w / 2}" cy="${h * 0.5}" rx="${w * 0.42}" ry="${h * 0.34}" fill="${pal[2]}" opacity="0.16" filter="url(#b60)"/>
${dust}
<ellipse cx="${w / 2}" cy="${h * 0.755}" rx="230" ry="34" fill="#5d6b73" opacity="0.26" filter="url(#b28)"/>
<g transform="translate(${w / 2} ${h * 0.44}) scale(${s})" fill="none" stroke="${pal[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
  <path d="${MARKS[mark]}"/>
</g>
<g transform="translate(${w / 2} ${h * 0.98}) scale(${s} ${-s * 0.42})" fill="none" stroke="${pal[1]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.16" filter="url(#b3)">
  <path d="${MARKS[mark]}"/>
</g>
<rect y="${h * 0.79}" width="${w}" height="${h * 0.21}" fill="url(#refl)"/>
`);
}

/**
 * Avatar placeholder — a monogram on a light field.
 *
 * Deliberately not a drawn face: a fake person on a real person's business card
 * is worse than an honest placeholder, and the card holder replaces this with
 * their own photo as the very first edit.
 */
function monogram(palKey, letters, seed) {
  const w = 600, h = 600;
  return wrap(w, h, `
${lightField(w, h, PALETTES[palKey], seed, { density: 0.8, flare: false })}
<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.31}" fill="#ffffff" opacity="0.10"/>
<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.31}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.4"/>
<text x="${w / 2}" y="${h / 2 + 44}" fill="#ffffff" opacity="0.96" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="150" font-weight="600" letter-spacing="4">${esc(letters)}</text>`);
}

/* ---------------- manifest ---------------- */
const FILES = {
  /* banners */
  "water-banner":  () => banner("water", 11),
  "clinic-banner": () => banner("clinic", 23),
  "estate-banner": () => banner("estate", 31),
  "food-banner":   () => banner("food", 41),
  "gym-banner":    () => banner("gym", 53),
  "salon-banner":  () => banner("salon", 61),
  "office-banner": () => banner("office", 71),
  "card-banner":   () => techBanner("card", 79),

  /* water / wellness */
  "water-glass":    () => tile("water", "glass", 101),
  "water-drop":     () => tile("water", "drop", 103),
  "water-ripple":   () => tile("water", "ripple", 107),
  "water-wellness": () => tile("water", "leaf", 109),
  "water-home":     () => tile("water", "home", 113),
  "water-team":     () => tile("water", "people", 127),
  "water-award":    () => tile("water", "trophy", 131),
  "water-health":   () => tile("water", "heart", 137),

  /* clinic */
  "clinic-care":     () => tile("clinic", "stethoscope", 149),
  "clinic-lab":      () => tile("clinic", "flask", 151),
  "clinic-pharmacy": () => tile("clinic", "pill", 157),
  "clinic-scan":     () => tile("clinic", "scan", 163),
  "clinic-checkup":  () => tile("clinic", "pulse", 167),
  "clinic-trust":    () => tile("clinic", "shield", 173),

  /* real estate */
  "estate-home":     () => tile("estate", "home", 179),
  "estate-tower":    () => tile("estate", "tower", 181),
  "estate-keys":     () => tile("estate", "key", 191),
  "estate-interior": () => tile("estate", "sofa", 193),

  /* restaurant */
  "food-plate":   () => tile("food", "plate", 197),
  "food-dining":  () => tile("food", "cutlery", 199),
  "food-kitchen": () => tile("food", "flame", 211),
  "food-coffee":  () => tile("food", "cup", 223),

  /* fitness */
  "gym-weights": () => tile("gym", "dumbbell", 227),
  "gym-pulse":   () => tile("gym", "pulse", 229),
  "gym-meal":    () => tile("gym", "leaf", 233),
  "gym-goal":    () => tile("gym", "trophy", 239),

  /* salon */
  "salon-hair":   () => tile("salon", "scissors", 241),
  "salon-glow":   () => tile("salon", "sparkle", 251),
  "salon-spa":    () => tile("salon", "leaf", 257),
  "salon-bridal": () => tile("salon", "heart", 263),

  /* consulting */
  "office-strategy": () => tile("office", "chart", 269),
  "office-team":     () => tile("office", "people", 271),
  "office-idea":     () => tile("office", "bulb", 277),
  "office-deal":     () => tile("office", "handshake", 281),
  "office-desk":     () => tile("office", "laptop", 283),
  "office-workshop": () => tile("office", "board", 293),

  /* digital visiting card */
  "card-phone":   () => tile("card", "laptop", 349),
  "card-ai":      () => tile("card", "sparkle", 353),
  "card-share":   () => tile("card", "people", 359),
  "card-growth":  () => tile("card", "chart", 367),
  "card-trust":   () => tile("card", "shield", 373),
  "card-idea":    () => tile("card", "bulb", 379),
  "card-deal":    () => tile("card", "handshake", 383),
  "card-award":   () => tile("card", "trophy", 389),
  "card-website": () => tile("card", "board", 397),

  /* product shots */
  "product-ionizer":  () => productShot("water", "bottle", 307),
  "product-filter":   () => productShot("water", "drop", 311),
  "product-plan":     () => productShot("office", "chart", 313),
  "product-package":  () => productShot("salon", "sparkle", 317),
  "product-dish":     () => productShot("food", "plate", 331),
  "product-program":  () => productShot("gym", "dumbbell", 337),
  "product-property": () => productShot("estate", "home", 347),

  /* avatar placeholders */
  "avatar-water":  () => monogram("water", "W", 401),
  "avatar-clinic": () => monogram("clinic", "Dr", 409),
  "avatar-estate": () => monogram("estate", "R", 419),
  "avatar-food":   () => monogram("food", "F", 421),
  "avatar-gym":    () => monogram("gym", "G", 431),
  "avatar-salon":  () => monogram("salon", "S", 433),
  "avatar-office": () => monogram("office", "C", 439),
  "avatar-card":   () => monogram("card", "V", 443),
};

/* V-Card covers, one per category colour: the same wide light field as the
   banners, no mark and no text. Added after the entries above so their output
   stays byte-for-byte the same. */
COVER_ACCENTS.forEach((hex, i) => {
  FILES[`cover-${hex.slice(1)}`] = () => wrap(1800, 600, lightField(1800, 600, paletteFromAccent(hex), 600 + i * 7, { density: 1.15 }), true);
});

let n = 0, bytes = 0;
for (const [name, fn] of Object.entries(FILES)) {
  const svg = fn();
  writeFileSync(new URL(`${name}.svg`, OUT), svg);
  n++; bytes += Buffer.byteLength(svg);
}
console.log(`wrote ${n} files, ${(bytes / 1024).toFixed(0)} KB total, avg ${(bytes / n / 1024).toFixed(1)} KB`);
