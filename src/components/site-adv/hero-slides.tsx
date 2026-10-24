"use client";
// The Premium website's sliding top (owner, 23 Oct 2026: "ek se zyada banner, jo auto slide ho, sab par alag heading"): the hero the
// design chose, drawn once per banner (site.hero.slides) with that banner's big line, small line and picture, stacked in one place
// and cross-faded every few seconds. Dots to pick one; it pauses while the visitor's pointer or focus is on it; no auto-play for
// visitors who ask for reduced motion. Hidden banners are inert for screen readers and the keyboard.
import { createElement, useEffect, useState, type ComponentType } from "react";
import type { HeroSlide } from "@/lib/types";
import type { SiteContent } from "@/components/site-adv/content";
import type { VariantProps } from "@/components/site-adv/shared";

const EVERY_MS = 5500;

/** The content one banner shows: its words, and its picture when it has one (else the hero's own). */
function contentFor(c: SiteContent, s: HeroSlide): SiteContent {
  const photo = s.imageUrl
    ? { src: s.imageUrl, focus: "50% 50%", bright: false, dark: true, ...(c.hm.photo && c.hm.photo.src === s.imageUrl ? { focus: c.hm.photo.focus, lqip: c.hm.photo.lqip, bright: c.hm.photo.bright, dark: c.hm.photo.dark } : {}) }
    : c.hm.photo;
  return { ...c, hm: { ...c.hm, headline: s.headline || c.hm.headline, sub: s.sub ?? c.hm.sub, ...(photo ? { photo } : {}), ...(s.imageUrl ? { clip: undefined } : {}) } };
}

export function HeroSlides({ Hero, slides, ...p }: VariantProps & { Hero: ComponentType<VariantProps>; slides: HeroSlide[] }) {
  const [at, setAt] = useState(0);
  const [hold, setHold] = useState(false);
  const n = slides.length;
  useEffect(() => {
    if (hold || n < 2) return;
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old browser */ }
    if (reduce) return;
    const t = setInterval(() => setAt((i) => (i + 1) % n), EVERY_MS);
    return () => clearInterval(t);
  }, [hold, n]);
  return (
    // One column exactly as wide as the page (minmax(0, 1fr)): an auto column grew to a wide hero's content and pushed its words and
    // picture far off the right edge, so the top looked empty (found on a new design, 25 Oct 2026).
    <div className="adv-slides" style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", width: "100%" }}
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocusCapture={() => setHold(true)} onBlurCapture={() => setHold(false)}>
      {slides.map((s, i) => (
        <div key={i} aria-hidden={i !== at} inert={i !== at}
          style={{ gridArea: "1 / 1", minWidth: 0, opacity: i === at ? 1 : 0, transition: "opacity .8s ease", pointerEvents: i === at ? "auto" : "none", zIndex: i === at ? 1 : 0 }}>
          {createElement(Hero, { ...p, c: contentFor(p.c, s) })}
        </div>
      ))}
      {n > 1 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, zIndex: 3, display: "flex", justifyContent: "center", gap: 8 }}>
          {slides.map((s, i) => (
            <button key={i} type="button" onClick={() => setAt(i)} aria-label={`${i + 1} / ${n}: ${s.headline}`} aria-current={i === at}
              style={{ width: i === at ? 26 : 9, height: 9, borderRadius: 9, border: "1px solid rgba(255,255,255,.7)", background: i === at ? "rgba(255,255,255,.95)" : "rgba(0,0,0,.35)", transition: "width .3s ease", cursor: "pointer", padding: 0 }} />
          ))}
        </div>
      )}
    </div>
  );
}
