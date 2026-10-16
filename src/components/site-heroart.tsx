// The art for a hero that has no photo (16 Oct 2026, hero-nav pass). A business without a banner used to open on a dark
// or coloured field with the words on its left and nothing on its right: "average". Now the field carries a drawn
// shape of the trade's family (rings for jewellery, arches for a salon, a plate for food, a plus for health, blades
// for a workshop, a dot grid for teaching, loose blobs for a shop, waves for the rest) in the palette's own colours.
//
// Pure SVG with currentColor strokes, no image, no request, no layout: it is absolutely positioned inside a hero
// that is already `position: relative`, behind the words, `aria-hidden`. The lines draw themselves in once (stroke-dash,
// transform-free); reduced motion and the owner's "no motion" show them drawn. Server-safe: no hooks, no 'use client'.
import type { ReactElement } from "react";

export type ArtKind = "rings" | "arch" | "plate" | "grid" | "blade" | "pulse" | "blobs" | "wave";

/** The trade's drawing: poster-categories keys → one of eight families. Unknown trades get the waves. */
export function artKind(categoryKey: string | undefined): ArtKind {
  const k = categoryKey ?? "";
  if (/^(jewellery|astro|mla|influencer)$/.test(k)) return "rings";
  if (/^(salon|beauty|mehndi|spa|hotel|event|catering|dance|club|textile|boutique|tailor)$/.test(k)) return "arch";
  if (/^(cafe|sweets|bakery|restaurant|tiffin|dairy|agri|grocery-online)$/.test(k)) return "plate";
  if (/^(coaching|college|school|computer|it|ca|lawyer|finance|insurance|agent)$/.test(k)) return "grid";
  if (/^(gym|auto|electrician|plumber|hardware|builder|housing|interior|manufacturer|transport|courier|cleaning|printing|security|army|govt|union|employee)$/.test(k)) return "blade";
  if (/^(doctor|dentist|hospital|medical|ayurveda|ngo)$/.test(k)) return "pulse";
  if (/^(kirana|garments|footwear|gift|mobile|furniture|distributor|wholesale|mlm|optical)$/.test(k)) return "blobs";
  return "wave";
}

const DOTS = Array.from({ length: 49 }, (_, i) => ({ x: 90 + (i % 7) * 72, y: 90 + Math.floor(i / 7) * 72 }));
const SEEDS = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return { x: 330 + Math.cos(a) * 215, y: 300 + Math.sin(a) * 215 }; });

/** Each shape is one `l` (line, drawn in) or `f` (soft fill). `pathLength=1` lets every line draw with the same dash. */
const SHAPES: Record<ArtKind, ReactElement> = {
  rings: (
    <>
      <circle className="f" cx="360" cy="300" r="130" />
      <circle className="l" pathLength={1} cx="360" cy="300" r="260" /><circle className="l" pathLength={1} cx="360" cy="300" r="200" />
      <circle className="l" pathLength={1} cx="360" cy="300" r="140" /><circle className="l" pathLength={1} cx="360" cy="300" r="80" />
      <path className="l" pathLength={1} d="M360 215L445 300L360 385L275 300Z" />
      <circle className="d" cx="360" cy="40" r="7" /><circle className="d" cx="560" cy="300" r="5" /><circle className="d" cx="160" cy="300" r="5" />
    </>
  ),
  arch: (
    <>
      <path className="f" d="M290 580V250a135 135 0 0 1 270 0V580Z" />
      <path className="l" pathLength={1} d="M70 580V300a120 120 0 0 1 240 0V580Z" />
      <path className="l" pathLength={1} d="M120 580V310a70 70 0 0 1 140 0V580Z" />
      <path className="l" pathLength={1} d="M290 580V250a135 135 0 0 1 270 0V580Z" />
      <circle className="l" pathLength={1} cx="425" cy="95" r="26" />
    </>
  ),
  plate: (
    <>
      <circle className="f" cx="330" cy="300" r="190" />
      <circle className="l" pathLength={1} cx="330" cy="300" r="250" /><circle className="l" pathLength={1} cx="330" cy="300" r="190" />
      <circle className="l" pathLength={1} cx="330" cy="300" r="120" />
      <path className="l" pathLength={1} d="M240 300a90 90 0 0 1 180 0" />
      {SEEDS.map((s, i) => <circle key={i} className="d" cx={s.x} cy={s.y} r={i % 3 === 0 ? 7 : 4} />)}
    </>
  ),
  grid: (
    <>
      <path className="f" d="M90 90H522a432 432 0 0 1-432 432Z" />
      {DOTS.map((d, i) => <circle key={i} className="d" cx={d.x} cy={d.y} r="4" />)}
      <rect className="l" pathLength={1} x="234" y="234" width="144" height="144" rx="8" />
      <path className="l" pathLength={1} d="M90 522a432 432 0 0 1 432-432" />
    </>
  ),
  blade: (
    <>
      <path className="f" d="M170 580L330 30H440L280 580Z" />
      <path className="l" pathLength={1} d="M170 580L330 30H440L280 580Z" />
      <path className="l" pathLength={1} d="M310 580L470 30H520L360 580Z" />
      <path className="l" pathLength={1} d="M410 580L570 30H595L435 580Z" />
      <circle className="l" pathLength={1} cx="150" cy="170" r="70" />
    </>
  ),
  pulse: (
    <>
      <path className="f" d="M255 110h90v140h140v90H345v140h-90V340H115v-90h140z" />
      <path className="l" pathLength={1} d="M255 110h90v140h140v90H345v140h-90V340H115v-90h140z" />
      <circle className="l" pathLength={1} cx="300" cy="295" r="255" />
      <path className="l" pathLength={1} d="M10 520h150l30-70 55 130 45-100 30 40h300" />
    </>
  ),
  blobs: (
    <>
      <circle className="f" cx="250" cy="250" r="170" />
      <circle className="l" pathLength={1} cx="410" cy="380" r="150" />
      <rect className="l" pathLength={1} x="300" y="70" width="200" height="200" rx="44" transform="rotate(14 400 170)" />
      <circle className="f" cx="130" cy="470" r="44" />
      <circle className="d" cx="520" cy="130" r="8" /><circle className="d" cx="90" cy="150" r="6" />
    </>
  ),
  wave: (
    <>
      <path className="f" d="M0 330C100 250 200 410 300 330S500 250 600 330V600H0Z" />
      <path className="l" pathLength={1} d="M0 190C100 110 200 270 300 190S500 110 600 190" />
      <path className="l" pathLength={1} d="M0 260C100 180 200 340 300 260S500 180 600 260" />
      <path className="l" pathLength={1} d="M0 330C100 250 200 410 300 330S500 250 600 330" />
      <circle className="l" pathLength={1} cx="470" cy="110" r="60" />
    </>
  ),
};

/** The drawing, behind the hero's words. `tone` picks the ink: "gold" (the luxe field's hairline), "light" (on a dark or
 *  accent field), "dark" (on paper). The CSS below places and colours it. */
export function HeroArt({ kind, tone = "light", className = "" }: { kind: ArtKind; tone?: "gold" | "light" | "dark"; className?: string }) {
  return (
    <svg className={`hart ${className}`} data-tone={tone} viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {SHAPES[kind]}
    </svg>
  );
}

export const HEROART_CSS = `
@keyframes hart-draw{from{stroke-dashoffset:1}}
@keyframes hart-fade{from{opacity:0}}
.site .hart{position:absolute;z-index:0;pointer-events:none;right:-18%;top:2%;width:min(104vw,560px);height:auto;aspect-ratio:1;color:var(--hart-ink,var(--hero-text));overflow:visible}
.site .hart[data-tone=gold]{--hart-ink:var(--gold,var(--accent))}
.site .hart[data-tone=dark]{--hart-ink:var(--ink)}
.site .hart .l{fill:none;stroke:currentColor;stroke-width:1.6;opacity:.34;stroke-dasharray:1;stroke-dashoffset:0;animation:hart-draw 1.8s cubic-bezier(.3,.6,.2,1) both}
.site .hart>:nth-child(2){animation-delay:.1s}.site .hart>:nth-child(3){animation-delay:.2s}.site .hart>:nth-child(4){animation-delay:.3s}.site .hart>:nth-child(5){animation-delay:.4s}.site .hart>:nth-child(6){animation-delay:.5s}
.site .hart .f{fill:currentColor;opacity:.07;animation:hart-fade 1.2s ease-out both}
.site .hart[data-tone=gold] .f{fill:var(--accent);opacity:.16}
.site .hart .d{fill:currentColor;opacity:.4}
/* Phone: the drawing hangs off the bottom-right corner, behind the trust chips, never behind the headline. */
@media (max-width:1023px){.site .hart{top:auto;bottom:-22%;right:-32%;width:min(92vw,420px)}}
/* The full-screen cover keeps its words at the foot: its drawing takes the empty top instead. */
@media (max-width:1023px){.site .cin-hero .hart{top:14%;bottom:auto;right:-26%;width:min(104vw,460px)}}
@media (min-width:1024px){.site .hart{right:2%;top:50%;transform:translateY(-50%);width:min(46vw,620px)}
/* The name-first look keeps its words on the right: the drawing rises from the lower corner instead of sitting behind them. */
.site .mark-ink .hart{top:auto;bottom:-48%;right:-4%;transform:none;width:min(42vw,560px)}}
@media (prefers-reduced-motion: reduce){.site .hart .l,.site .hart .f{animation:none}}
.site[data-motion=none] .hart .l,.site[data-motion=none] .hart .f{animation:none}
`;
