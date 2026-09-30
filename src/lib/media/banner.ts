// Studio banner engine — composes a branded 1080x1080 SVG and rasterizes it
// with sharp. No AI API involved, so a banner costs almost nothing to serve;
// the credit price is product margin, not cost recovery.
//
// Text stays Roman/Hinglish: librsvg on the VPS has no Devanagari shaping.

import sharp from "sharp";
export const BANNER_STYLES = {
  aqua:     { stops: ["#042c3e", "#0a6c7c", "#18a89e"], accent: "#7ff0e4", ink: "#ffffff" },
  sunrise:  { stops: ["#1c1642", "#c45830", "#f7b858"], accent: "#ffe9c9", ink: "#fff7ec" },
  emerald:  { stops: ["#052a2e", "#0a5c58", "#0e9e90"], accent: "#c9f5ee", ink: "#ffffff" },
  festive:  { stops: ["#1a0a30", "#441646", "#963c28"], accent: "#ffd68c", ink: "#fff3e0" },
  midnight: { stops: ["#0a0c22", "#1e1a42", "#5a326e"], accent: "#ffe296", ink: "#f2ecff" },
} as const;
export type BannerStyle = keyof typeof BANNER_STYLES;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Deterministic pseudo-random bubbles so the same input renders the same banner. */
function bubbles(seed: number, tint: string): string {
  let x = seed || 1;
  const rnd = () => ((x = (x * 48271) % 2147483647) / 2147483647);
  let out = "";
  for (let i = 0; i < 22; i++) {
    const r = 18 + rnd() * 120, cx = rnd() * 1080, cy = rnd() * 1080, a = 0.04 + rnd() * 0.12;
    out += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${tint}" opacity="${(a / 3).toFixed(3)}" stroke="${tint}" stroke-opacity="${a.toFixed(3)}" stroke-width="${Math.max(2, r / 22).toFixed(0)}"/>`;
  }
  return out;
}

/** Wrap a headline into up to 3 lines that fit the 1080px canvas. */
function wrap(text: string, max: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max && line) { lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export type BannerInput = {
  headline: string;        // big line, <= ~60 chars
  subline?: string;        // supporting line
  badge?: string;          // small pill above the headline, e.g. "FREE DEMO"
  brandName: string;       // footer wordmark, e.g. the card holder's company
  website?: string;        // footer link line
  style?: BannerStyle;
  photo?: Buffer;          // optional product photo composited top-centre
  bgImage?: Buffer;        // optional AI-generated background (full bleed)
};

export async function renderBanner(input: BannerInput): Promise<Buffer> {
  const style = BANNER_STYLES[input.style ?? "emerald"] ?? BANNER_STYLES.emerald;
  const [c1, c2, c3] = style.stops;
  const seed = Array.from(input.headline).reduce((a, ch) => a + ch.charCodeAt(0), 7);

  // AI background: full-bleed photo + scrim so the text keeps contrast.
  let bgTag = "";
  if (input.bgImage) {
    const cover = await sharp(input.bgImage).resize(1080, 1080, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
    bgTag = `<image x="0" y="0" width="1080" height="1080" href="data:image/jpeg;base64,${cover.toString("base64")}"/>
  <rect width="1080" height="1080" fill="${c1}" opacity="0.30"/>
  <rect y="620" width="1080" height="460" fill="url(#scrim)"/>`;
  }

  const hasPhoto = Boolean(input.photo);
  const headLines = wrap(input.headline, hasPhoto ? 20 : 16);
  const headSize = headLines.some((l) => l.length > 14) ? 88 : 108;
  const headStartY = hasPhoto ? 700 : 420;

  let photoTag = "";
  let photoH = 0;
  if (input.photo) {
    // Fit the photo into a soft rounded frame, 560px tall, centred.
    const fitted = await sharp(input.photo)
      .resize(720, 560, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    photoTag = `<image x="180" y="90" width="720" height="560" href="data:image/png;base64,${fitted.toString("base64")}"/>`;
    photoH = 560;
  }

  const head = headLines
    .map((l, i) => `<text x="540" y="${headStartY + i * (headSize + 14)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${headSize}" fill="${style.ink}">${esc(l)}</text>`)
    .join("");

  const badge = input.badge
    ? `<rect x="${540 - (input.badge.length * 13 + 48) / 2}" y="${headStartY - headSize - 84}" rx="26" width="${input.badge.length * 13 + 48}" height="52" fill="${style.accent}" opacity="0.92"/>
       <text x="540" y="${headStartY - headSize - 48}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="${c1}">${esc(input.badge.toUpperCase())}</text>`
    : "";

  const subY = headStartY + headLines.length * (headSize + 14) + 30;
  const sub = input.subline
    ? `<text x="540" y="${subY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="${style.ink}" opacity="0.86">${esc(input.subline)}</text>`
    : "";

  const svg = `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c1}" stop-opacity="0"/><stop offset="1" stop-color="${c1}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  ${bgTag || bubbles(seed, "#ffffff")}
  ${input.bgImage ? "" : photoTag}
  ${badge}
  ${head}
  ${sub}
  <text x="540" y="960" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" letter-spacing="10" fill="${style.ink}">${esc(input.brandName.toUpperCase())}</text>
  ${input.website ? `<text x="540" y="1006" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="${style.ink}" opacity="0.8">${esc(input.website)}</text>` : ""}
</svg>`;

  void photoH;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

/* ---------------- credit prices (1 credit = ₹1 display) ---------------- */
export const CREDIT_PRICES = {
  banner: 5,        // template render — pure margin
  banner_ai: 12,    // AI photo background (image cost ~Rs 2)
  ad: 20,           // legacy — Ad Builder now prices by duration, see adCredits()
  ad_realistic: 100, // legacy
  reel_basic: 25,   // branded cards + Hindi voiceover, no AI scenes
  reel_photos: 60,  // AI photoreal scenes with motion (cost ~Rs 7 on flash-lite)
  reel_stock: 30,   // free Pexels HD clips + voiceover (cost ~Rs 2)
  reel_avatar: 150, // talking-head via fal.ai lip-sync (needs FAL_KEY)
  reel_remix: 15,   // replace chosen scenes in an existing reel, reuse the rest
  reel_kling: 120,  // 2 AI scenes via Kling (needs REPLICATE_API_TOKEN)
  reel_veo: 400,    // 2 AI scenes via Veo (needs GEMINI_API_KEY credits)
  // Re-rendering ONE generated video clip costs real money (~Rs 70 on Veo), so
  // editing a video-tier reel can't be charged at the still-image remix rate.
  reel_remix_kling: 70,
  reel_remix_veo: 220,
} as const;
export type ReelTier = "basic" | "photos" | "stock" | "avatar" | "kling" | "veo";

// Ad Builder pricing (AD_LENGTHS/adCredits) and CREDIT_PACKS moved to ./ad-pricing.ts
// — that file has zero deps so client components (video/page.tsx) can import it
// without pulling this file's "sharp" dependency into the browser bundle.
