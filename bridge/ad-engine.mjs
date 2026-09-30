// Ad Builder engine: template-based product ads rendered with sharp + ffmpeg.
// No AI video — only a short AI script (optional) and Gemini TTS. ₹~1/video.
//
// job.input = { product, headline?, offer, features[], phone, lang (hi|hinglish|en),
//   template, music, formats ["reel","square","wide"], photos [urls], logoUrl?,
//   brandName, voiceStyle, script? (4-5 lines) }
// Output: input.outputs = { reel, square, wide } public URLs; output_url = first.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { FPS, SAFE, INTERMEDIATE, DELIVERY_V, DELIVERY_A, MASTER_AF, DUCK, MUSIC_VOL, MUSIC_SOLO } from "./caption-engine.mjs";

export const DEV = "Noto Sans Devanagari, Noto Sans Gujarati, Noto Sans Gurmukhi, Noto Sans Bengali, Noto Sans Tamil, Noto Sans Telugu, Noto Sans Kannada, Noto Sans Malayalam, Noto Sans Oriya, Liberation Sans, DejaVu Sans, sans-serif"; // every Indic script we ship (fontconfig picks the face that has the glyphs)
const LAT = "Liberation Sans, DejaVu Sans, Arial, sans-serif";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hasDev = (s) => /[\u0900-\u0D7F]/.test(String(s ?? "")); // any Indic block, not just Devanagari
/** Font stack for a string: the nine-face Indic stack when it contains an Indic script, else Latin. */
export const fam = (s) => (hasDev(s) ? DEV : LAT);
export const CTA_LABELS = { en: "Call / WhatsApp now", hi: "अभी Call / WhatsApp करें", hinglish: "Abhi Call / WhatsApp karein", mr: "आत्ताच Call / WhatsApp करा", gu: "હમણાં જ Call / WhatsApp કરો", pa: "ਹੁਣੇ Call / WhatsApp ਕਰੋ", bn: "এখনই Call / WhatsApp করুন", ta: "இப்போதே Call / WhatsApp செய்யுங்கள்", te: "ఇప్పుడే Call / WhatsApp చేయండి", kn: "ಈಗಲೇ Call / WhatsApp ಮಾಡಿ", ml: "ഇപ്പോൾ തന്നെ Call / WhatsApp ചെയ്യൂ", or: "ଏବେ Call / WhatsApp କରନ୍ତୁ" };

export const FORMATS = { reel: { w: 1080, h: 1920 }, square: { w: 1080, h: 1080 }, wide: { w: 1920, h: 1080 } };  // full HD like the big studios

// Six looks. Each: palette + decoration + motion feel.
export const TEMPLATES = {
  bold:    { name: "Bold",     bg: ["#0f172a", "#1e3a8a"], accent: "#fbbf24", text: "#ffffff", sub: "#cbd5e1", deco: "circles", zoom: "in" },
  clean:   { name: "Clean",    bg: ["#ffffff", "#e0f2fe"], accent: "#0e9e90", text: "#0b1220", sub: "#475569", deco: "dots",    zoom: "out" },
  festive: { name: "Festive",  bg: ["#7c2d12", "#b45309"], accent: "#fde68a", text: "#fff7ed", sub: "#fed7aa", deco: "sparks",  zoom: "in" },
  offer:   { name: "Offer",    bg: ["#b91c1c", "#f59e0b"], accent: "#ffffff", text: "#ffffff", sub: "#fef3c7", deco: "burst",   zoom: "pan" },
  trust:   { name: "Trust",    bg: ["#082f49", "#0e7490"], accent: "#67e8f9", text: "#ffffff", sub: "#bae6fd", deco: "lines",   zoom: "out" },
  fresh:   { name: "Fresh",    bg: ["#064e3b", "#0e9e90"], accent: "#a7f3d0", text: "#ffffff", sub: "#d1fae5", deco: "waves",   zoom: "in" },
};

function deco(kind, W, H, color, seed = 7) {
  let x = seed; const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
  let out = "";
  if (kind === "circles" || kind === "dots") for (let i = 0; i < 16; i++) { const r = kind === "dots" ? 4 + rnd() * 10 : 30 + rnd() * 140; out += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${(0.05 + rnd() * 0.1).toFixed(2)}"/>`; }
  if (kind === "sparks") for (let i = 0; i < 40; i++) { const cx = rnd() * W, cy = rnd() * H, r = 2 + rnd() * 5; out += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.3 + rnd() * 0.6).toFixed(2)}"/>`; }
  if (kind === "burst") for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; out += `<line x1="${W / 2}" y1="${H / 2}" x2="${(W / 2 + Math.cos(a) * W).toFixed(0)}" y2="${(H / 2 + Math.sin(a) * W).toFixed(0)}" stroke="${color}" stroke-opacity="0.08" stroke-width="${W / 30}"/>`; }
  if (kind === "lines") for (let i = 0; i < 12; i++) { const y = rnd() * H; out += `<line x1="0" y1="${y.toFixed(0)}" x2="${W}" y2="${(y + (rnd() - 0.5) * 300).toFixed(0)}" stroke="${color}" stroke-opacity="0.08" stroke-width="2"/>`; }
  if (kind === "waves") for (let i = 0; i < 5; i++) { const y = H * 0.55 + i * 60; out += `<path d="M0 ${y} Q ${W / 4} ${y - 40} ${W / 2} ${y} T ${W} ${y} V ${H} H0 Z" fill="${color}" opacity="0.06"/>`; }
  return out;
}

function wrap(text, max) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
/**
 * Fit text into at most `maxLines` lines WITHOUT deleting any of it: put more
 * characters on a line and shrink the type by the same factor until it fits.
 * This used to be `lines.slice(0, 4)`, which quietly cut a long offer or CTA
 * off mid-sentence — a truthfulness problem, not just a layout one.
 */
function fit(text, max, size, maxLines = 4) {
  let n = max, s = size, lines = wrap(text, n);
  for (let i = 0; i < 10 && lines.length > maxLines; i++) {
    const k = Math.min(1.3, lines.length / maxLines);
    n = Math.max(n + 1, Math.round(n * k));
    s = Math.max(Math.round(size * 0.5), Math.round(s / k));
    lines = wrap(text, n);
  }
  return { lines, size: s };
}
/** Stable per-job seed: two shops never get the same decoration scatter. */
const seedOf = (s) => { let x = 2166136261; for (const ch of String(s ?? "wellwa")) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619); } return ((x >>> 0) % 2147483646) + 1; };
function textBlock(lines, x, y, size, opts = {}) {
  const { fill = "#fff", weight = 800, anchor = "start", lh = 1.18, family } = opts;
  return lines.map((l, i) => `<text x="${x}" y="${(y + i * size * lh).toFixed(0)}" text-anchor="${anchor}" font-family="${family || fam(l)}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(l)}</text>`).join("");
}

async function fitPhoto(buf, w, h) {
  return sharp(buf).resize(w, h, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
}
async function circlePhoto(buf, d) {
  const mask = Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`);
  return sharp(buf).resize(d, d, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

/** One scene card. kind: hook | product | features | offer | cta */
export async function renderScene(file, { kind, fmt, tpl, inp, photo, logo, caption, seed }) {
  const { w: W, h: H } = FORMATS[fmt]; const T = TEMPLATES[tpl] ?? TEMPLATES.bold;
  // Per-job scatter. With the old fixed seed = 7 every customer's every card
  // carried the identical decoration.
  const dseed = Number(seed) || seedOf(inp.__jobId ?? inp.jobId ?? `${inp.brandName ?? ""}|${inp.product ?? ""}`);
  const sq = W === H, tall = H >= W, wide = W > H;
  const pad = Math.round(W * 0.08);
  const k = sq ? 0.78 : 1;                       // square: same layout as tall, smaller type
  const base = (s) => Math.round((tall ? W : H) * s * k);
  const wrapN = (n) => (sq ? Math.round(n * 0.85) : n);
  let body = "", imgs = [];
  const brand = String(inp.brandName || "").slice(0, 30);
  const phone = String(inp.phone || "");

  if (kind === "hook") {
    const { lines, size: hs } = fit(inp.headline || inp.product, wrapN(tall ? 14 : 22), base(tall ? 0.115 : 0.12), 4);
    body += textBlock(lines, W / 2, tall ? H * 0.42 : H * 0.42, hs, { fill: T.text, anchor: "middle", weight: 900 });
    body += `<rect x="${W / 2 - 60}" y="${tall ? H * 0.42 + lines.length * base(0.135) + 10 : H * 0.42 + lines.length * base(0.14) + 10}" width="120" height="6" rx="3" fill="${T.accent}"/>`;
    if (brand) body += `<text x="${W / 2}" y="${H * 0.14}" text-anchor="middle" font-family="${fam(brand)}" font-size="${base(0.045)}" font-weight="700" letter-spacing="4" fill="${T.accent}">${esc(brand.toUpperCase())}</text>`;
  }
  if (kind === "product") {
    if (photo) {
      // Tall: photo 0.12–0.50 H, title from 0.57 H. The word-by-word caption band sits at 0.72–0.78 H
      // (SAFE.bottomReel), and a two-line product name that started at 0.66 H ran straight through it.
      const pw = tall ? Math.round(W * (sq ? 0.55 : 0.78)) : Math.round(H * 0.7), ph = tall ? Math.round(H * (sq ? 0.36 : 0.38)) : Math.round(H * 0.7);
      const p = await fitPhoto(photo, pw, ph); const m = await sharp(p).metadata();
      const left = tall ? Math.round((W - m.width) / 2) : Math.round(W * 0.06 + (pw - m.width) / 2), top = tall ? Math.round(H * 0.12 + (ph - m.height) / 2) : Math.round((H - m.height) / 2);
      body += `<rect x="${left - 14}" y="${top - 14}" width="${m.width + 28}" height="${m.height + 28}" rx="28" fill="#ffffff" opacity="0.95"/>`;
      imgs.push({ input: p, left, top });
    }
    const { lines, size: ps } = fit(inp.product, wrapN(tall ? 16 : 13), base(tall ? (sq ? 0.085 : 0.075) : 0.075), 2);
    const tx = tall ? W / 2 : W * 0.58, ty = tall ? H * (sq ? 0.58 : 0.57) : H * 0.34;
    body += textBlock(lines, tx, ty, ps, { fill: T.text, anchor: tall ? "middle" : "start", weight: 900 });
    // The first feature under the name — on a tall card only when the name took one line, or it lands in the captions.
    if (inp.features?.[0] && !sq && (!tall || lines.length === 1)) { const f0 = fit(inp.features[0], wrapN(tall ? 26 : 22), base(0.045), 2); body += textBlock(f0.lines, tx, ty + lines.length * base(tall ? 0.1 : 0.09) + base(0.02), f0.size, { fill: T.sub, anchor: tall ? "middle" : "start", weight: 600 }); }
  }
  if ((kind === "features" || kind === "offer") && photo) {
    const pw = Math.round(W * (tall ? 0.34 : 0.22)), ph2 = Math.round(H * (tall ? 0.2 : 0.3));
    const p = await fitPhoto(photo, pw, ph2); const m = await sharp(p).metadata();
    imgs.push({ input: p, left: Math.round(W - m.width - pad * 0.6), top: Math.round(kind === "features" ? H * 0.06 : H * 0.72) });
  }
  if (kind === "features") {
    const feats = (inp.features || []).filter(Boolean).slice(0, 3);
    const y0 = tall ? H * 0.3 : H * 0.28, gap = tall ? base(0.19) : base(0.2);
    body += `<text x="${W / 2}" y="${tall ? H * 0.2 : H * 0.16}" text-anchor="middle" font-family="${fam(inp.product)}" font-size="${base(0.06)}" font-weight="900" fill="${T.accent}">${esc(inp.product)}</text>`;
    feats.forEach((f, i) => {
      const y = y0 + i * gap;
      body += `<circle cx="${pad + 22}" cy="${y - 12}" r="22" fill="${T.accent}"/><text x="${pad + 22}" y="${y - 2}" text-anchor="middle" font-family="${LAT}" font-size="26" font-weight="900" fill="${T.bg[0]}">✓</text>`;
      const ft = fit(f, wrapN(tall ? 22 : 40), base(0.055), 2);
      body += textBlock(ft.lines, pad + 64, y, ft.size, { fill: T.text, weight: 700 });
    });
  }
  if (kind === "offer" && inp.offer) {
    const { lines, size: os } = fit(inp.offer, wrapN(tall ? 14 : 22), base(0.1), 4);
    body += `<rect x="${pad}" y="${H * 0.3}" width="${W - 2 * pad}" height="${H * 0.4}" rx="32" fill="#000" opacity="0.18"/>`;
    body += `<text x="${W / 2}" y="${H * 0.3 + base(0.11)}" text-anchor="middle" font-family="${LAT}" font-size="${base(0.045)}" font-weight="700" letter-spacing="6" fill="${T.accent}">${esc(inp.lang === "en" ? "SPECIAL OFFER" : "ख़ास ऑफ़र")}</text>`;
    body += textBlock(lines, W / 2, H * 0.3 + base(0.24), os, { fill: T.text, anchor: "middle", weight: 900 });
  }
  if (kind === "quote" && inp.testimonial) {
    const tm = inp.testimonial;
    const rating = Math.max(1, Math.min(5, Number(tm.rating) || 5));
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    body += `<text x="${pad}" y="${H * 0.2}" font-family="${LAT}" font-size="${base(0.16)}" font-weight="900" fill="${T.accent}" opacity="0.55">&#8220;</text>`;
    const { lines, size: qs } = fit(String(tm.text || ""), wrapN(tall ? 16 : 26), base(tall ? 0.058 : 0.05), 6);
    body += textBlock(lines, W / 2, H * 0.34, qs, { fill: T.text, anchor: "middle", weight: 700 });
    const afterY = H * 0.34 + lines.length * base(tall ? 0.078 : 0.068) + base(0.07);
    body += `<text x="${W / 2}" y="${afterY}" text-anchor="middle" font-family="${LAT}" font-size="${base(0.06)}" fill="${T.accent}">${stars}</text>`;
    const who = [tm.customer_name, tm.city].filter(Boolean).join(", ");
    if (who) body += `<text x="${W / 2}" y="${afterY + base(0.1)}" text-anchor="middle" font-family="${fam(who)}" font-size="${base(0.045)}" font-weight="700" fill="${T.sub}">${esc(who)}</text>`;
  }
  if (kind === "cta") {
    if (logo) { const l = await fitPhoto(logo, Math.round(W * 0.3), Math.round(H * 0.14)); const m = await sharp(l).metadata(); imgs.push({ input: l, left: Math.round((W - m.width) / 2), top: Math.round(H * 0.14) }); }
    else if (brand) {
      // auto-fit: long firm names ("Wellwa Life India Pvt Ltd") wrap to 2 lines and shrink so they never run off the card
      const bl = fit(brand, wrapN(tall ? 16 : 26), base(0.07), 2).lines;
      const longest = Math.max(...bl.map((l) => l.length));
      const bs = Math.min(base(0.07), Math.floor((W * 0.86) / (longest * 0.6)));
      body += textBlock(bl, W / 2, H * 0.2, bs, { fill: T.text, anchor: "middle", weight: 900 });
    }
    // The spoken closing line as the card's message (realistic / presenter tiers pass it in)
    if (inp.ctaText) {
      const { lines: cl, size: cs } = fit(String(inp.ctaText), wrapN(tall ? 18 : 30), base(phone || inp.website ? 0.05 : 0.068), 3);
      const y0 = phone || inp.website ? H * 0.72 : H * 0.42;
      body += textBlock(cl, W / 2, y0, cs, { fill: T.text, anchor: "middle", weight: 800 });
    }
    // Phone is optional — only draw the "call now" pill when there's a real number to show;
    // otherwise leave the closing scene as a clean brand card (logo/name + caption strip).
    if (phone) {
      body += `<text x="${W / 2}" y="${H * 0.45}" text-anchor="middle" font-family="${DEV}" font-size="${base(0.06)}" font-weight="700" fill="${T.sub}">${esc(CTA_LABELS[inp.lang] ?? CTA_LABELS.en)}</text>`;
      body += `<rect x="${W / 2 - Math.round(W * 0.36)}" y="${H * 0.5}" width="${Math.round(W * 0.72)}" height="${base(0.13)}" rx="${base(0.065)}" fill="${T.accent}"/>`;
      body += `<text x="${W / 2}" y="${H * 0.5 + base(0.09)}" text-anchor="middle" font-family="${LAT}" font-size="${base(0.065)}" font-weight="900" fill="${T.bg[0]}">${esc(phone)}</text>`;
      if (inp.website) body += `<text x="${W / 2}" y="${H * 0.5 + base(0.2)}" text-anchor="middle" font-family="${LAT}" font-size="${base(0.04)}" fill="${T.sub}">${esc(inp.website)}</text>`;
    } else if (inp.website) {
      body += `<rect x="${W / 2 - Math.round(W * 0.36)}" y="${H * 0.5}" width="${Math.round(W * 0.72)}" height="${base(0.13)}" rx="${base(0.065)}" fill="${T.accent}"/>`;
      body += `<text x="${W / 2}" y="${H * 0.5 + base(0.09)}" text-anchor="middle" font-family="${LAT}" font-size="${base(0.05)}" font-weight="900" fill="${T.bg[0]}">${esc(inp.website)}</text>`;
    } else if (!inp.ctaText) {
      // No number and no website (the owner has not added a phone yet): the closing card used to be a small logo on
      // a plain gradient. It still has to say who and what to do — the brand name under the logo and the
      // call-to-action in the accent pill where the number would sit.
      if (logo && brand) {
        const bl = fit(brand, wrapN(tall ? 16 : 26), base(0.06), 2).lines;
        const bs = Math.min(base(0.06), Math.floor((W * 0.86) / (Math.max(...bl.map((l) => l.length)) * 0.6)));
        body += textBlock(bl, W / 2, H * 0.36, bs, { fill: T.text, anchor: "middle", weight: 900 });
      }
      const lbl = CTA_LABELS[inp.lang] ?? CTA_LABELS.en;
      const ls = Math.min(base(0.052), Math.floor((W * 0.64) / ([...lbl.replace(/\p{M}/gu, "")].length * 0.55)));
      body += `<rect x="${W / 2 - Math.round(W * 0.36)}" y="${H * 0.5}" width="${Math.round(W * 0.72)}" height="${base(0.13)}" rx="${base(0.065)}" fill="${T.accent}"/>`;
      body += `<text x="${W / 2}" y="${H * 0.5 + base(0.085)}" text-anchor="middle" font-family="${DEV}" font-size="${ls}" font-weight="900" fill="${T.bg[0]}">${esc(lbl)}</text>`;
    }
  }
  // Caption strip (the spoken line), bottomed on the SAME safe line the rest of the
  // pipeline uses — not flush to the frame. At y = H - ch - pad/2 a 1080x1920 strip
  // sat at 1796-1877, i.e. entirely behind the Instagram Reels username/caption bar
  // (>= 1498) and the WhatsApp Status reply box (>= 1651). This strip is the ONLY
  // subtitle on the video whenever the owner unticks "Word-by-word captions", so
  // being covered means being lost.
  if (caption) {
    const { lines: cl, size: cs } = fit(caption, wrapN(tall ? 30 : 48), base(0.036), 3); const ch = cl.length * cs * 1.3 + 30;
    const inset = tall && !sq ? SAFE.bottomReel(H) : SAFE.bottomStatus(H);
    const yTop = H - ch - inset;
    body += `<rect x="${pad / 2}" y="${yTop}" width="${W - pad}" height="${ch}" rx="18" fill="#000" opacity="0.45"/>`;
    body += textBlock(cl, W / 2, yTop + cs * 1.15, cs, { fill: "#fff", anchor: "middle", weight: 600 });
  }
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="${wide ? 1 : 0}" y2="${wide ? 0 : 1}"><stop offset="0" stop-color="${T.bg[0]}"/><stop offset="1" stop-color="${T.bg[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${deco(T.deco, W, H, T.accent, dseed)}${body}</svg>`;
  let img = sharp(Buffer.from(svg)).png();
  if (imgs.length) { const bg = await img.toBuffer(); img = sharp(bg).composite(imgs).png(); }
  await img.toFile(file);
}

/** Script lines per language when the user gave none. */
export function defaultScript(inp) {
  const f = (inp.features || []).filter(Boolean);
  const L = inp.lang;
  const offerLine = inp.offer ? { en: `${inp.offer}.`, hi: `${inp.offer}।`, hinglish: `${inp.offer}.` }[L] ?? `${inp.offer}.` : "";
  const ctaLine = inp.phone
    ? { en: `Call or WhatsApp ${inp.phone} today!`, hi: `आज ही Call या WhatsApp करें ${inp.phone} पर!`, hinglish: `Aaj hi Call ya WhatsApp karein ${inp.phone} par!` }[L]
    : { en: `Get in touch today!`, hi: `आज ही संपर्क करें!`, hinglish: `Aaj hi contact karein!` }[L];
  if (L === "en") return [inp.headline || `Introducing ${inp.product}.`, `${inp.product} — ${f[0] || "quality you can trust"}.`, f[1] ? `${f[1]}. ${f[2] || ""}`.trim() : `Made for you.`, offerLine, ctaLine].filter(Boolean);
  if (L === "hi") return [inp.headline || `पेश है ${inp.product}।`, `${inp.product} — ${f[0] || "भरोसेमंद क्वालिटी"}।`, f[1] ? `${f[1]}। ${f[2] || ""}`.trim() : `आपके लिए बना।`, offerLine, ctaLine].filter(Boolean);
  return [inp.headline || `Pesh hai ${inp.product}.`, `${inp.product} — ${f[0] || "bharosemand quality"}.`, f[1] ? `${f[1]}. ${f[2] || ""}`.trim() : `Aapke liye bana.`, offerLine, ctaLine].filter(Boolean);
}

/**
 * Render one ad in one format. helpers: { ffmpeg(args), ttsLine(text,wav,voice) }.
 * Returns the output mp4 path.
 */
export async function renderAd(dir, fmt, inp, assets, helpers, voLines, kinds = ["hook", "product", "features", "offer", "cta"]) {
  const { w: W, h: H } = FORMATS[fmt]; const T = TEMPLATES[inp.template] ?? TEMPLATES.bold;
  const files = [];
  for (let i = 0; i < kinds.length; i++) {
    const f = path.join(dir, `${fmt}-${i}.png`);
    const ph = assets.photos?.length ? assets.photos[i % assets.photos.length] : assets.photo;
    await renderScene(f, { kind: kinds[i], fmt, tpl: inp.template, inp, photo: ph, logo: assets.logo, caption: voLines[i]?.caption ?? voLines[i]?.text });
    files.push(f);
  }
  const durs = kinds.map((_, i) => Math.max(2.2, (voLines[i]?.sec ?? 0) + 0.5));
  const total = durs.reduce((a, b) => a + b, 0) - 0.3 * (kinds.length - 1);
  // inputs: stills with Ken-Burns, then voice, then music
  const args = ["-y", "-loglevel", "error"];
  files.forEach((f, i) => args.push("-loop", "1", "-t", durs[i].toFixed(2), "-i", f));
  if (assets.voWav) args.push("-i", assets.voWav);
  if (assets.music) args.push("-stream_loop", "-1", "-i", assets.music);
  const fps = FPS; let fc = "";
  files.forEach((_, i) => {
    const frames = Math.round(durs[i] * fps);
    const z = T.zoom === "out" ? `if(eq(on,1),1.12,max(zoom-0.0008,1.0))` : T.zoom === "pan" ? `1.08` : `min(zoom+0.0008,1.12)`;
    const x = T.zoom === "pan" ? `(iw-iw/zoom)*on/${frames}` : `iw/2-(iw/zoom/2)`;
    fc += `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='${z}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${fps},format=yuv420p[v${i}];`;
  });
  let last = "v0", off = 0;
  for (let i = 1; i < files.length; i++) { off += durs[i - 1] - 0.3; fc += `[${last}][v${i}]xfade=transition=${i % 2 ? "fade" : "slideleft"}:duration=0.3:offset=${off.toFixed(2)}[x${i}];`; last = `x${i}`; }
  fc += `[${last}]fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6[vout];`;
  // Audio is FINISHED here: the caption burn that may follow copies it through
  // untouched, so the duck and the -14 LUFS master have to happen on this pass.
  const vi = files.length, mi = files.length + (assets.voWav ? 1 : 0);
  const S = "aresample=48000,aformat=channel_layouts=stereo";
  const fadeOut = `afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5`;
  if (assets.voWav && assets.music) fc += `[${vi}:a]${S},apad=whole_dur=${total.toFixed(2)},asplit=2[vo1][vo2];[${mi}:a]${S},volume=${MUSIC_VOL},${fadeOut}[bg];[bg][vo1]${DUCK}[bgd];[vo2][bgd]amix=inputs=2:duration=first:normalize=0,${MASTER_AF}[aout]`;
  else if (assets.voWav) fc += `[${vi}:a]${S},apad=whole_dur=${total.toFixed(2)},${MASTER_AF}[aout]`;
  else if (assets.music) fc += `[${mi}:a]${S},volume=${MUSIC_SOLO},${fadeOut},${MASTER_AF}[aout]`;
  else fc += `anullsrc=r=48000:cl=stereo[aout]`; // digital silence: loudnorm would try to lift it by +70 dB
  const fcFile = path.join(dir, `${fmt}-filter.txt`); fs.writeFileSync(fcFile, fc);
  const out = path.join(dir, `ad-${fmt}.mp4`);
  // One delivery encode per file: when word captions are burnt in afterwards
  // THAT pass is the final one and this concat stays intermediate.
  const deliver = inp.__deliver ?? (inp.captions === "off" || !voLines.some((l) => l?.sec > 0));
  args.push("-filter_complex_script", fcFile, "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(2), "-r", String(fps), ...(deliver ? DELIVERY_V : INTERMEDIATE), ...DELIVERY_A, out);
  await helpers.ffmpeg(args);
  return out;
}
