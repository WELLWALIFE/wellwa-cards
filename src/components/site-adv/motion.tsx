"use client";
// Motion and art primitives of the advanced site (owner, 16 Oct 2026: "the user's mouth must say WOW"). CSS first: nothing here
// runs a script unless the effect cannot be done in CSS (the pinned story's progress, the pointer parallax, the live open chip),
// every effect starts from the FINISHED look (a keyframe has only a `from`), so a browser that skips animations, the server's
// HTML, a print and prefers-reduced-motion all show the finished page. Shared.tsx's reduced-motion rule (`animation:none !important`)
// and the spec's `data-motion=none` therefore need nothing more from here, except the ticker, which falls back to a wrapped list.
//
// What other files may import:
//   SplitHeadline  a headline whose words rise out of a mask, the last word in the accent (italic where the script has one)
//   MaskPhoto      a box that wipes open (up / left / iris), its picture settling from a slight zoom; shapes: rect, arch, pill, circle
//   Parallax       a box whose child drifts as it scrolls past (CSS scroll timelines; nothing in browsers without them)
//   Ticker         a seamless strip of short phrases, one or two rows, outline or filled, reverse direction
//   Stamp          a round badge with text running round it ("SINCE 2015") that turns slowly
//   LiveOpen       "Open now - till 9 pm" / "Closed - opens 10 am" pill, recomputed each minute from the hours
//   ArtField       the typographic fallback of a hero with no photograph: rings / blobs / stripes / grid from the palette, plus grain
//   PointerStage   (+ `data-depth` children) a layer that follows the pointer a few pixels on a laptop, still on a phone
//   Count          the shared count-up (final number in the HTML, counts up once seen)
//   usePinProgress sets --p (0..1) and data-ch (chapter) on a tall section while it is pinned
//   hashOf / pickBy  a stable number from the spec's seed, so a business keeps its own art
// CSS: MOTION_CSS (register it in registry.ts VARIANT_CSS, or import it where the primitive is used).
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { CountUp, useOpenNow } from "@/components/site-smart";
import type { HoursRow } from "@/lib/open-now";

export const Count = CountUp;

const calm = () => typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const fine = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/** A small stable hash of a string (FNV-1a), for choosing among a few looks from the spec's seed. */
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** One of `n` (0..n-1), the same every time for the same seed and salt. */
export const pickBy = (seed: string, salt: string, n: number) => hashOf(`${seed}|${salt}`) % Math.max(1, n);

/* ---------- headline ---------- */

/** The headline as words that rise out of a mask, one after another. Real text nodes between the words, so it wraps, balances,
 *  selects and reads aloud as one sentence. `accent="last"` sets the last word in the accent colour (italic in scripts that have it);
 *  `from` delays the whole line in ms. Place inside the h1 yourself via `as`. */
export function SplitHeadline({ text, as: Tag = "h1", accent = "last", className = "", lang, from = 90, id, len }: {
  text: string; as?: "h1" | "h2" | "p"; accent?: "last" | "none" | number; className?: string; lang?: string; from?: number; id?: string;
  /** A size tier the CSS can read (`data-len`), for a title whose length varies (a business name). */
  len?: string;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const at = accent === "last" ? words.length - 1 : accent === "none" ? -1 : accent;
  // Only words after the first can carry the accent: a one-word line would be all accent.
  const hot = words.length > 1 ? at : -1;
  return (
    <Tag id={id} className={className} lang={lang} data-len={len} style={{ "--d0": `${from}ms` } as CSSProperties}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="mo-w"><span className={`mo-wi ${i === hot ? "mo-acc" : ""}`} style={{ "--wi": Math.min(i, 9) } as CSSProperties}>{w}</span></span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/* ---------- picture ---------- */

export type MaskShape = "rect" | "arch" | "pill" | "circle";
export type MaskReveal = "up" | "left" | "iris" | "none";
/** A box that wipes open on first paint with its picture settling from a slight zoom. The box needs a size (aspect-ratio or height). */
export function MaskPhoto({ children, shape = "rect", reveal = "up", delay = 0, className = "", style }: {
  children: ReactNode; shape?: MaskShape; reveal?: MaskReveal; delay?: number; className?: string; style?: CSSProperties;
}) {
  return (
    <div className={`mo-mask ${className}`} data-shape={shape} data-reveal-kind={reveal} style={{ "--mo-delay": `${delay}ms`, ...style } as CSSProperties}>
      {children}
    </div>
  );
}

/** A box whose child drifts a few percent as the box scrolls past (CSS scroll timeline; still where the browser has none).
 *  `range="exit"` for something at the top of the page (moves as it leaves), "cover" for something lower down. */
export function Parallax({ children, depth = 8, range = "exit", className = "" }: { children: ReactNode; depth?: number; range?: "exit" | "cover"; className?: string }) {
  return <div className={`mo-par ${className}`} data-range={range} style={{ "--mo-d": depth } as CSSProperties}>{children}</div>;
}

/* ---------- ticker ---------- */

/** A seamless ribbon of short phrases. One copy is repeated until it is wider than a big screen; the second copy is hidden from readers.
 *  `look`: "solid" (display face, ink and accent alternating), "outline" (hollow letters), "caps" (small tracked capitals). */
export function Ticker({ items, look = "solid", speed = 56, reverse = false, label, className = "", lang }: {
  items: string[]; look?: "solid" | "outline" | "caps"; speed?: number; reverse?: boolean; label?: string; className?: string; lang?: string;
}) {
  if (items.length < 2) return null;
  const row = Array.from({ length: Math.max(1, Math.ceil(9 / items.length)) }, () => items).flat();
  const li = (s: string, i: number) => <li key={i} aria-hidden={i >= items.length ? true : undefined} lang={lang}>{s}</li>;
  return (
    <div className={`mo-tk ${className}`} data-look={look} data-rev={reverse ? "" : undefined} style={{ "--tk": `${speed}s` } as CSSProperties}>
      <div className="mo-tk-track">
        <ul aria-label={label}>{row.map(li)}</ul>
        <ul aria-hidden="true">{row.map(li)}</ul>
      </div>
    </div>
  );
}

/* ---------- badges ---------- */

/** A round badge: `value` large in the middle, `sub` small under it, `ring` running round the rim and turning slowly. */
export function Stamp({ value, sub, ring, className = "", tone = "accent" }: { value: string; sub?: string; ring: string; /** Kept for callers; the ring no longer needs the language. */ hi?: boolean; className?: string; tone?: "accent" | "ink" | "paper" }) {
  const id = useId().replace(/:/g, "");
  // The ring has room for about 34 capitals at this size: a short phrase runs round twice, a long one is cut and runs once.
  const one = Array.from(ring).length > 34 ? `${Array.from(ring).slice(0, 33).join("").trim()}…` : ring;
  const rim = Array.from(one).length <= 16 ? `${one} · ${one} · ` : `${one} · `;
  return (
    <div className={`mo-stamp ${className}`} data-tone={tone} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="mo-stamp-ring">
        <defs><path id={`mo-r-${id}`} d="M60 60m-48 0a48 48 0 1 1 96 0a48 48 0 1 1-96 0" /></defs>
        <text fill="currentColor"><textPath href={`#mo-r-${id}`} textLength="298" lengthAdjust="spacing">{rim}</textPath></text>
      </svg>
      <div className="mo-stamp-core"><b>{value}</b>{sub && <small>{sub}</small>}</div>
    </div>
  );
}

/** "Open now - till 9 pm": the shop's state, ticking each minute (the first value is computed in the render, so the HTML has it). */
export function LiveOpen({ rows, hi, className = "" }: { rows?: HoursRow[]; hi: boolean; className?: string }) {
  const s = useOpenNow(rows);
  if (!s) return null;
  const open = s.state === "open";
  return (
    <span className={`mo-open ${className}`} data-state={s.state} aria-live="polite">
      <i aria-hidden="true" />
      <b>{open ? (hi ? "अभी खुला" : "Open now") : (hi ? "अभी बंद" : "Closed")}</b>
      <span>{hi ? s.noteHi : s.note}</span>
    </span>
  );
}

/** "Scroll" with a line that draws down it; decorative. */
export function ScrollCue({ label, className = "" }: { label: string; className?: string }) {
  return <span className={`mo-cue ${className}`} aria-hidden="true"><i /><span>{label}</span></span>;
}

/* ---------- art for a hero with no photograph ---------- */

export type ArtKind = "rings" | "blobs" | "stripes" | "grid";
export const ART_KINDS: readonly ArtKind[] = ["rings", "blobs", "stripes", "grid"];
/** A decorative fill from the palette alone, for the place a photograph would be. `seed` picks the look and its variation, so two
 *  businesses differ; `letter` sets an outlined initial large in it. Fills its (positioned) parent; carries no meaning. */
export function ArtField({ seed, kind, letter, className = "" }: { seed: string; kind?: ArtKind; letter?: string; className?: string }) {
  const k = kind ?? ART_KINDS[pickBy(seed, "art", ART_KINDS.length)];
  const fx = 20 + pickBy(seed, "fx", 60), fy = 15 + pickBy(seed, "fy", 55);
  return (
    <div className={`mo-art ${className}`} data-art={k} style={{ "--fx": `${fx}%`, "--fy": `${fy}%` } as CSSProperties} aria-hidden="true">
      <i className="mo-art-a" /><i className="mo-art-b" /><i className="mo-art-grain" />
      {letter && <span className="mo-art-letter">{letter}</span>}
    </div>
  );
}

/* ---------- pointer and scroll ---------- */

/** A stage whose `[data-depth]` children (a number: pixels of travel at the pointer's edge) follow the pointer. Laptops only. */
export function PointerStage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || calm() || !fine()) return;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      el.style.setProperty("--px", cx.toFixed(3)); el.style.setProperty("--py", cy.toFixed(3));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(loop) : 0;
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const leave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener("pointermove", move, { passive: true }); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className={`mo-stage ${className}`}>{children}</div>;
}

/** For a tall section holding a sticky stage: sets `--p` (0..1, how far through the section the viewport is) and `data-ch` (which of
 *  `chapters` is current) on the element, without re-rendering anything. Under reduced motion nothing is set and the section keeps its
 *  `data-ch="0"`; the CSS shows every chapter in flow in that case. */
export function usePinProgress(ref: React.RefObject<HTMLElement | null>, chapters: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el || calm()) return;
    el.dataset.pin = "";
    let raf = 0, live = false;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.max(0, Math.min(1, -r.top / span));
      el.style.setProperty("--p", p.toFixed(4));
      const ch = Math.min(chapters - 1, Math.floor(p * chapters * 0.999));
      if (el.dataset.ch !== String(ch)) el.dataset.ch = String(ch);
    };
    const on = () => { if (live && !raf) raf = requestAnimationFrame(update); };
    const io = new IntersectionObserver((es) => { live = es.some((e) => e.isIntersecting); if (live) on(); }, { rootMargin: "20% 0px 20% 0px" });
    io.observe(el);
    window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    update();
    return () => { io.disconnect(); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); delete el.dataset.pin; };
  }, [ref, chapters]);
}

/* ---------- the CSS ---------- */
export const MOTION_CSS = `
@keyframes mo-rise{from{transform:translateY(112%)}to{transform:none}}
@keyframes mo-wipe-up{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes mo-wipe-left{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes mo-iris{from{clip-path:circle(0% at 50% 62%)}to{clip-path:circle(75% at 50% 50%)}}
@keyframes mo-settle{from{transform:scale(1.2)}to{transform:none}}
@keyframes mo-drift{from{transform:scale(1.04)}to{transform:scale(1.11) translate3d(-1.4%,-1%,0)}}
@keyframes mo-float{50%{transform:translateY(-12px)}}
@keyframes mo-float-r{50%{transform:translateY(11px) rotate(var(--rot,0deg))}}
@keyframes mo-spin{to{transform:rotate(360deg)}}
@keyframes mo-tk{to{transform:translateX(-50%)}}
@keyframes mo-ping{0%{transform:scale(.6);opacity:.65}80%,100%{transform:scale(2.3);opacity:0}}
@keyframes mo-up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes mo-fade{from{opacity:0}to{opacity:1}}
@keyframes mo-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes mo-cue{0%{transform:scaleY(0);transform-origin:top}45%{transform:scaleY(1);transform-origin:top}55%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
@keyframes mo-par{from{transform:translate3d(0,calc(var(--mo-d)*-1%),0) scale(1.18)}to{transform:translate3d(0,calc(var(--mo-d)*1%),0) scale(1.18)}}

/* headline words */
.mo-w{display:inline-block;overflow:hidden;vertical-align:top;padding:.08em .07em .2em;margin:-.08em -.07em -.2em}
.mo-wi{display:inline-block;animation:mo-rise 1s cubic-bezier(.16,.8,.2,1) both;animation-delay:calc(var(--wi,0)*75ms + var(--d0,90ms));will-change:transform}
.mo-acc{font-style:italic;color:var(--accent)}
.hero-dark .mo-acc{color:color-mix(in srgb,var(--accent) 58%,var(--hero-text))}
.site:lang(hi) .mo-w{padding-block:.3em .34em;margin-block:-.3em -.34em}
.site:lang(hi) .mo-acc{font-style:normal}
.mo-w:has(.mo-acc){padding-inline:.07em .12em;margin-inline:-.07em -.12em}

/* picture masks */
.mo-mask{position:relative;overflow:hidden;isolation:isolate;background:var(--paper-2)}
.mo-mask[data-shape=arch]{border-radius:999px 999px var(--r-img) var(--r-img)}
.mo-mask[data-shape=pill]{border-radius:999px}
.mo-mask[data-shape=circle]{border-radius:50%}
.mo-mask[data-shape=rect]{border-radius:var(--r-tile)}
.site[data-shape=sharp] .mo-mask[data-shape=arch]{border-radius:var(--r-tile) var(--r-tile) 0 0}
.mo-mask[data-reveal-kind=up]{animation:mo-wipe-up 1.15s cubic-bezier(.7,0,.2,1) backwards;animation-delay:var(--mo-delay,0ms)}
.mo-mask[data-reveal-kind=left]{animation:mo-wipe-left 1.15s cubic-bezier(.7,0,.2,1) backwards;animation-delay:var(--mo-delay,0ms)}
.mo-mask[data-reveal-kind=iris]{animation:mo-iris 1.3s cubic-bezier(.6,0,.2,1) backwards;animation-delay:var(--mo-delay,0ms)}
.mo-mask[data-reveal-kind]:not([data-reveal-kind=none])>*{animation:mo-settle 1.7s cubic-bezier(.2,.7,.2,1) backwards;animation-delay:var(--mo-delay,0ms)}
.mo-mask>.hero-ph-wrap,.mo-mask>.adv-photo{position:absolute;inset:0;width:100%;height:100%}

/* parallax: only where CSS scroll timelines exist; elsewhere the child simply stays put */
.mo-par{position:relative;overflow:hidden}
.mo-par>*{width:100%;height:100%}
@supports (animation-timeline:view()){
.mo-par>*{animation:mo-par linear both;animation-timeline:view();animation-range:exit 0% exit 100%}
.mo-par[data-range=cover]>*{animation-range:cover 0% cover 100%}
}

/* ticker */
.mo-tk{overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.mo-tk-track{display:flex;width:max-content;animation:mo-tk var(--tk,56s) linear infinite}
.mo-tk[data-rev] .mo-tk-track{animation-direction:reverse}
.mo-tk:hover .mo-tk-track{animation-play-state:paused}
.mo-tk ul{display:flex;align-items:center;margin:0;padding:0;list-style:none;flex:none}
.mo-tk li{display:inline-flex;align-items:center;white-space:nowrap;line-height:1.15}
.mo-tk li::after{content:"";flex:none;width:.3em;height:.3em;margin-inline:.9em;background:var(--accent);transform:rotate(45deg)}
.mo-tk[data-look=solid] li{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.5rem,4.4vw,3.2rem);color:var(--ink)}
.mo-tk[data-look=solid] li:nth-child(even){color:var(--accent)}
.mo-tk[data-look=outline] li{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(3rem,11vw,9rem);line-height:1;color:var(--ink);-webkit-text-fill-color:transparent;-webkit-text-stroke:1.5px color-mix(in srgb,var(--ink) 38%,transparent)}
.mo-tk[data-look=outline] li::after{width:.14em;height:.14em;margin-inline:.5em}
.mo-tk[data-look=caps] li{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}
.site:lang(hi) .mo-tk[data-look=caps] li{letter-spacing:0;text-transform:none;font-size:14px}
.site:lang(hi) .mo-tk li{font-weight:var(--display-w-hi)}
@media (prefers-reduced-motion:reduce){.mo-tk-track{animation:none;width:auto;flex-wrap:wrap}.mo-tk ul[aria-hidden]{display:none}.mo-tk ul{flex-wrap:wrap;row-gap:.25rem;padding-inline:var(--gutter)}.mo-tk{-webkit-mask-image:none;mask-image:none}}
.site[data-motion=none] .mo-tk-track{width:auto;flex-wrap:wrap}.site[data-motion=none] .mo-tk ul[aria-hidden]{display:none}.site[data-motion=none] .mo-tk ul{flex-wrap:wrap;padding-inline:var(--gutter)}

/* stamp */
.mo-stamp{position:relative;display:grid;place-items:center;width:var(--st,clamp(96px,11vw,132px));aspect-ratio:1;border-radius:50%;background:var(--accent);color:var(--on-accent);box-shadow:0 12px 34px rgb(0 0 0/.22);transform:rotate(var(--rot,-8deg))}
.mo-stamp[data-tone=ink]{background:var(--hero-ink);color:var(--hero-text)}
.mo-stamp[data-tone=paper]{background:var(--paper);color:var(--ink);box-shadow:0 12px 34px rgb(0 0 0/.18),inset 0 0 0 1px var(--line)}
.mo-stamp-ring{position:absolute;inset:0;width:100%;height:100%;animation:mo-spin 26s linear infinite}
.mo-stamp-ring text{font:600 9.6px var(--font-text);letter-spacing:.14em;text-transform:uppercase}
.site:lang(hi) .mo-stamp-ring text{letter-spacing:0;text-transform:none;font-size:10px;font-weight:500}
.mo-stamp-core{position:relative;display:grid;gap:1px;text-align:center;line-height:1}
.mo-stamp-core b{font-family:var(--font-display);font-weight:var(--display-w);font-size:calc(var(--st,clamp(96px,11vw,132px))*.27);letter-spacing:var(--display-tr);font-variant-numeric:tabular-nums}
.mo-stamp-core small{font-size:calc(var(--st,clamp(96px,11vw,132px))*.09);font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
.site:lang(hi) .mo-stamp-core small{letter-spacing:0;text-transform:none;font-size:11px}

/* live open chip */
.mo-open{display:inline-flex;align-items:center;gap:.55em;padding:.45em .95em .45em .8em;border:1px solid var(--line);border-radius:var(--r-pill);background:color-mix(in srgb,var(--paper) 86%,transparent);color:var(--muted);font-size:var(--t-meta);line-height:1.2;white-space:nowrap;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.mo-open b{color:var(--ink);font-weight:600}
.mo-open i{position:relative;width:8px;height:8px;border-radius:50%;background:var(--muted)}
.mo-open[data-state=open] i{background:#22c55e}
.mo-open[data-state=open] i::after{content:"";position:absolute;inset:0;border-radius:50%;background:#22c55e;animation:mo-ping 2s ease-out infinite}
.hero-dark .mo-open{background:color-mix(in srgb,var(--hero-ink) 55%,transparent);border-color:var(--hero-line);color:var(--hero-muted)}
.hero-dark .mo-open b{color:var(--hero-text)}

/* scroll cue */
.mo-cue{display:inline-flex;align-items:center;gap:.7em;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.mo-cue i{position:relative;display:block;width:1px;height:44px;background:var(--line);overflow:hidden}
.mo-cue i::after{content:"";position:absolute;inset:0;background:currentColor;animation:mo-cue 2.4s cubic-bezier(.6,0,.3,1) infinite}
.site:lang(hi) .mo-cue{letter-spacing:0;text-transform:none;font-size:12px}

/* art field */
.mo-art{position:absolute;inset:0;overflow:hidden;background:var(--paper-2);color:var(--accent)}
.hero-dark .mo-art{background:color-mix(in srgb,var(--hero-ink) 100%,transparent)}
.mo-art>i{position:absolute;pointer-events:none}
.mo-art-a,.mo-art-b{inset:0}
.mo-art-grain{inset:0;opacity:.09;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.mo-art[data-art=rings] .mo-art-a{background:repeating-radial-gradient(circle at var(--fx) var(--fy),transparent 0 38px,color-mix(in srgb,currentColor 24%,transparent) 38px 39px)}
.mo-art[data-art=rings] .mo-art-b{background:radial-gradient(60% 70% at var(--fx) var(--fy),color-mix(in srgb,currentColor 26%,transparent),transparent 70%)}
.mo-art[data-art=blobs] .mo-art-a{background:radial-gradient(46% 56% at var(--fx) var(--fy),color-mix(in srgb,currentColor 42%,transparent),transparent 72%)}
.mo-art[data-art=blobs] .mo-art-b{background:radial-gradient(40% 50% at calc(100% - var(--fx)) calc(100% - var(--fy)),color-mix(in srgb,currentColor 24%,transparent),transparent 72%)}
.mo-art[data-art=stripes] .mo-art-a{background:repeating-linear-gradient(115deg,transparent 0 18px,color-mix(in srgb,currentColor 14%,transparent) 18px 19px)}
.mo-art[data-art=stripes] .mo-art-b{background:linear-gradient(115deg,color-mix(in srgb,currentColor 30%,transparent),transparent 55%)}
.mo-art[data-art=grid] .mo-art-a{background-image:linear-gradient(color-mix(in srgb,currentColor 20%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,currentColor 20%,transparent) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:radial-gradient(70% 80% at var(--fx) var(--fy),#000,transparent 85%);mask-image:radial-gradient(70% 80% at var(--fx) var(--fy),#000,transparent 85%)}
.mo-art[data-art=grid] .mo-art-b{background:radial-gradient(50% 60% at var(--fx) var(--fy),color-mix(in srgb,currentColor 20%,transparent),transparent 70%)}
.mo-art-letter{position:absolute;right:6%;bottom:-8%;font-family:var(--font-display);font-size:clamp(14rem,48vw,34rem);line-height:.8;color:transparent;-webkit-text-stroke:1.5px color-mix(in srgb,currentColor 58%,transparent);user-select:none}
.site:lang(hi) .mo-art-letter{line-height:1}

/* pointer stage */
.mo-stage{position:relative}
.mo-stage [data-depth]{transform:translate3d(calc(var(--px,0)*var(--k,0)*1px),calc(var(--py,0)*var(--k,0)*1px),0);will-change:transform}

.mo-up{animation:mo-up .9s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--mo-delay,200ms)}
.mo-fade{animation:mo-fade 1.2s ease both;animation-delay:var(--mo-delay,200ms)}
.mo-grow{transform-origin:left;animation:mo-grow 1.2s cubic-bezier(.7,0,.2,1) both;animation-delay:var(--mo-delay,300ms)}
`;
