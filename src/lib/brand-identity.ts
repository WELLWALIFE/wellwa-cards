// What makes one website look like ITS business and no other (owner's call, 3 Oct 2026: "ek-se-ek alag, unique
// brand"): the business's own colour taken from its logo, a monogram in that colour when there is no logo, and a
// background pattern the designer picks for the hero. Pure module; the renderer, the composer and the monogram
// route all read it.
//
// Isomorphic: no 'use client', no 'server-only'.
import { initials } from "@/lib/initials";

export const PATTERNS = ["none", "dots", "waves", "grid", "diagonal", "blobs", "rings"] as const;
export type Pattern = (typeof PATTERNS)[number];

const enc = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;

/** CSS for a hero overlay in the given ink (the renderer sets opacity and a soft mask). */
export function patternCss(p: Pattern | undefined, ink = "#ffffff"): { backgroundImage?: string; backgroundSize?: string } {
  const c = ink;
  switch (p) {
    case "dots": return { backgroundImage: enc(`<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><circle cx='2' cy='2' r='1.4' fill='${c}'/></svg>`), backgroundSize: "22px 22px" };
    case "waves": return { backgroundImage: enc(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40' viewBox='0 0 120 40'><path d='M0 20 Q 15 5 30 20 T 60 20 T 90 20 T 120 20' fill='none' stroke='${c}' stroke-width='1.4'/></svg>`), backgroundSize: "120px 40px" };
    case "grid": return { backgroundImage: enc(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M40 0H0V40' fill='none' stroke='${c}' stroke-width='1'/></svg>`), backgroundSize: "40px 40px" };
    case "diagonal": return { backgroundImage: enc(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M-4 20 L20 -4 M0 24 L24 0 M4 28 L28 4' stroke='${c}' stroke-width='1.2'/></svg>`), backgroundSize: "24px 24px" };
    case "blobs": return { backgroundImage: enc(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><path d='M300 80c50 30 70 110 30 160s-130 60-190 20S40 140 90 90s160-40 210-10z' fill='${c}'/></svg>`), backgroundSize: "60% auto" };
    case "rings": return { backgroundImage: enc(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><g fill='none' stroke='${c}' stroke-width='1.2'><circle cx='80' cy='80' r='30'/><circle cx='80' cy='80' r='55'/><circle cx='80' cy='80' r='78'/></g></svg>`), backgroundSize: "160px 160px" };
    default: return {};
  }
}

export type MonogramShape = "round" | "soft" | "sharp";

/** The monogram's address — an SVG the app draws itself (/api/monogram/…svg): the initials in the brand colour. */
export function monogramUrl(name: string, colorHex: string, shape: MonogramShape = "soft"): string {
  const t = initials(name, "S").replace(/[^A-Za-z0-9ऀ-ॿ]/g, "").slice(0, 2) || "S";
  const c = (colorHex || "#0e9e90").replace("#", "").toLowerCase().slice(0, 6);
  return `/api/monogram/${encodeURIComponent(t)}-${c}-${shape}.svg`;
}

/** Darken / lighten a hex colour by `t` (−1…1). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** The monogram SVG: a gradient tile in the brand colour with the initials, in the corner style of the site. */
export function monogramSvg(text: string, colorHex: string, shape: MonogramShape): string {
  const c = `#${colorHex.replace("#", "").slice(0, 6)}`;
  const deep = shade(c, -0.35), glow = shade(c, 0.18);
  const r = shape === "round" ? 128 : shape === "soft" ? 56 : 12;
  const t = text.slice(0, 2);
  const size = t.length === 1 ? 128 : /[ऀ-ॿ]/.test(t) ? 96 : 108;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs>
<rect width="256" height="256" rx="${r}" fill="url(#g)"/>
<circle cx="200" cy="56" r="70" fill="#ffffff" fill-opacity="0.08"/>
<text x="128" y="138" text-anchor="middle" dominant-baseline="middle" font-family="Inter, 'Noto Sans Devanagari', Arial, sans-serif" font-weight="800" font-size="${size}" fill="#ffffff" letter-spacing="-2">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
</svg>`;
}
