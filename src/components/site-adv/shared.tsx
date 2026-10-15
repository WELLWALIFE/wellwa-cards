"use client";
// What every advanced-site variant shares: the props a variant receives, a few tiny building blocks (section wrapper,
// heading, eyebrow, button, stars, photo) that read the spec's shape and density through CSS tokens, and the base CSS.
// A variant file imports from here and from nothing else in site-adv, so variants can be written side by side.
//
// Tokens come from the root (`advancedVars`, src/lib/site-advanced.ts): --r-ctl/--r-card/--r-tile/--r-img (shape),
// --section-pad/--gap (density), --font-display/--font-text, and the OKLCH colour tokens (--paper, --paper-2, --ink,
// --muted, --line, --accent, --accent-soft, --hero-ink, ...). A variant never hard-codes a colour, radius or font.
import type { ReactNode } from "react";
import type { Card, CardLink } from "@/lib/types";
import type { CardBrand } from "@/components/card-view";
import type { AdvancedSpec } from "@/lib/site-advanced";
import { Pic } from "@/components/pic";
import { Icon } from "@/components/site-icons";
import type { SiteContent, Offering } from "@/components/site-adv/content";

export type { SiteContent, Offering };

/** What the page gives every variant besides the content: language, links, tracking, the lightbox, navigation. */
export type AdvCtx = {
  card: Card;
  /** The visitor's language code ("en", "hi", ...). */
  lang: string;
  hi: boolean;
  /** Translate a string the owner wrote (the card's own words) into the visitor's language. */
  t: (s: string) => string;
  /** A fixed interface string in both languages: `ui("Call", "कॉल")`. Never for the owner's words. */
  ui: (en: string, hi: string) => string;
  /** A wa.me link opening with the business name and "I saw your website"; `text` replaces the opening line. */
  waHref: (text?: string) => string;
  wa?: CardLink;
  phone?: CardLink;
  /** The "location" link of the card (Google Maps), when there is one. */
  mapLink?: CardLink;
  /** Count a click (`adv-<what>`). */
  track: (target: string) => void;
  /** Open the lightbox on `images` at `index`. */
  zoom: (images: string[], index: number, alt?: string) => void;
  /** Scroll to another section of this page. */
  jump: (key: string) => void;
  /** Open another page of the website (a product's own page); undefined in the editor preview of a single page. */
  goto?: (slug: string) => void;
  hrefFor: (slug: string) => string;
  qr: string;
  shareUrl?: string;
  brand?: CardBrand | null;
};

/** What a section component receives. `index` is its place among the sections that are drawn (0 = hero). */
export type VariantProps = { c: SiteContent; spec: AdvancedSpec; x: AdvCtx; index: number };
export type Variant = (p: VariantProps) => ReactNode;

/* ---------- building blocks ---------- */

export type Tone = "paper" | "alt" | "ink";
/** A page section: anchor id (`adv-<key>`), reveal on scroll, tone (page / second paper / the ink field), the inner width.
 *  `tone="ink"` re-points the colour tokens at the hero's ink so every child written for paper reads right on it. */
export function Sec({ k, tone = "paper", wide = false, className = "", children, label }: { k: string; tone?: Tone; wide?: boolean; className?: string; children: ReactNode; label?: string }) {
  return (
    <section id={`adv-${k}`} data-sec={k} data-tone={tone} data-reveal aria-label={label} className={`adv-sec ${tone === "ink" ? "hero-dark" : ""} ${className}`}>
      <div className={`adv-wrap ${wide ? "adv-wide" : ""}`}>{children}</div>
    </section>
  );
}

/** The small line above a section title. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={`kicker ${className}`}>{children}</p>;
}
/** A section title (display face). */
export function H2({ children, className = "", as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h2" | "h3" | "p" }) {
  return <Tag className={`adv-h2 ${className}`}>{children}</Tag>;
}
export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return <p className={`adv-lede ${className}`}>{children}</p>;
}
/** Eyebrow + title + lede, stacked: the head most sections open with. */
export function Head({ eyebrow, title, lede, className = "" }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; className?: string }) {
  return <div className={`adv-head ${className}`}><Eyebrow>{eyebrow}</Eyebrow><H2 className={eyebrow ? "mt-3" : ""}>{title}</H2><Lede>{lede}</Lede></div>;
}

/** The three control shapes of the shared design system (filled, ghost, plain link); the corners follow the spec's shape. */
export function Btn({ href, kind = "primary", children, onClick, external = false, className = "", ...rest }: {
  href: string; kind?: "primary" | "ghost" | "link"; children: ReactNode; onClick?: () => void; external?: boolean; className?: string; "data-kind"?: string;
}) {
  return (
    <a href={href} onClick={onClick} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className={`btn-${kind} ${className}`} {...rest}>{children}</a>
  );
}

/** Five stars, `n` filled. */
export function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="adv-stars" role="img" aria-label={`${Math.round(n)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} data-off={i > Math.round(n) ? "" : undefined}><Icon name="star" size={size} fill /></span>)}
    </span>
  );
}

/** A photo that fills its box (the box sets the aspect ratio); no photo -> a quiet tile with the first letter of `fallback`. */
export function Photo({ src, alt = "", className = "", eager = false, priority = false, sizes, fallback, onClick }: {
  src?: string; alt?: string; className?: string; eager?: boolean; priority?: boolean; sizes?: string; fallback?: string; onClick?: () => void;
}) {
  if (!src) return <div className={`adv-tile ${className}`} aria-hidden="true"><span>{Array.from(fallback ?? "")[0] ?? ""}</span></div>;
  return <Pic src={src} alt={alt} className={`adv-photo ${className}`} eager={eager} priority={priority} sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"} onClick={onClick} />;
}

/* ---------- the base CSS: rides in the page's one inline <style>, after the shared design-system CSS ---------- */
export const ADV_BASE_CSS = `
.site[data-adv]{background:var(--paper);color:var(--ink);font-family:var(--font-text);font-weight:var(--text-w,400);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.site[data-adv] h1,.site[data-adv] h2,.site[data-adv] h3{font-family:var(--font-display);font-weight:var(--display-w);margin:0}
.site[data-adv] :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.adv-wrap{width:100%;max-width:1200px;margin-inline:auto;padding-inline:var(--gutter)}
.adv-wrap.adv-wide{max-width:1400px}
.adv-sec{position:relative;padding-block:var(--section-pad);background:var(--paper);scroll-margin-top:72px}
.adv-sec[data-tone=alt]{background:var(--paper-2)}
.adv-sec[data-tone=ink]{--ink:var(--hero-text);--muted:var(--hero-muted);--line:var(--hero-line);--paper:var(--hero-ink);--paper-2:color-mix(in srgb,var(--hero-ink) 86%,#fff);background:var(--hero-ink);color:var(--hero-text)}
.site[data-adv] .hero-dark .btn-primary{background:var(--hero-text);color:var(--hero-ink)}
.adv-h2{font-size:clamp(1.9rem,4.8vw,3.4rem);line-height:1.04;letter-spacing:var(--display-tr);text-wrap:balance}
.site:lang(hi) .adv-h2,.site:lang(hi) .adv-display{line-height:1.28;letter-spacing:0;font-weight:var(--display-w-hi)}
.adv-display{font-size:clamp(2.6rem,8.4vw,6.4rem);line-height:var(--display-lh);letter-spacing:var(--display-tr);text-wrap:balance;margin:0}
.adv-lede{margin:var(--s4) 0 0;font-size:var(--t-sub);line-height:1.5;color:var(--muted);max-width:54ch;text-wrap:pretty}
.adv-head{max-width:46rem;margin-bottom:clamp(2rem,5vw,3.5rem)}
.adv-body{font-size:var(--t-body);line-height:var(--body-lh);color:var(--muted)}
.adv-body p{margin:0 0 1em}
.adv-photo{display:block;width:100%;height:100%;object-fit:cover}
.adv-tile{display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-family:var(--font-display);font-size:clamp(2rem,6vw,4rem);width:100%;height:100%}
.adv-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden}
.adv-sec[data-tone=alt] .adv-card{background:var(--paper)}
.adv-stars{display:inline-flex;gap:2px;color:var(--star)}.adv-stars [data-off]{color:var(--line)}
.adv-chip{display:inline-flex;align-items:center;gap:.4em;padding:.35em .8em;border:1px solid var(--line);border-radius:var(--r-pill);font-size:var(--t-meta);font-weight:500;color:var(--muted);background:var(--paper)}
.adv-rule{display:block;width:44px;height:2px;background:var(--accent);border:0;margin:0}
.adv-btn-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s4)}
.adv-nav a.adv-navlink{position:relative;padding:.5rem .8rem;font-size:14px;font-weight:500;color:var(--muted);text-decoration:none;border-radius:var(--r-ctl);transition:color .15s}
.adv-nav a.adv-navlink:hover{color:var(--ink)}
.site .site-bar{transform:translateY(110%);transition:transform .25s ease}.site .site-bar[data-shown]{transform:none}
.adv-scrolled{box-shadow:0 1px 0 var(--line)}
/* Motion: the spec's own dial. subtle = a short rise, rich = a longer rise with a little scale and staggered children, none = still. */
.site[data-adv][data-motion=subtle].js [data-reveal]{transform:translateY(12px);transition-duration:.55s}
.site[data-adv][data-motion=rich].js [data-reveal]{transform:translateY(34px) scale(.985);transition-duration:.9s}
.site[data-adv][data-motion=subtle].js [data-reveal].in,.site[data-adv][data-motion=rich].js [data-reveal].in{opacity:1;transform:none}
.site[data-adv][data-motion=rich] .adv-lift{transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
.site[data-adv][data-motion=rich] .adv-lift:hover{transform:translateY(-6px);box-shadow:var(--e-1)}
.site[data-adv][data-motion=none] *,.site[data-adv][data-motion=none] *::before,.site[data-adv][data-motion=none] *::after{animation:none!important;transition:none!important}
.site[data-adv][data-motion=none] [data-reveal]{opacity:1!important;transform:none!important}
@media (prefers-reduced-motion:reduce){.site[data-adv] *,.site[data-adv] *::before,.site[data-adv] *::after{animation:none!important;transition:none!important}.site[data-adv].js [data-reveal]{opacity:1!important;transform:none!important}}
@media print{.site[data-adv] [data-reveal]{opacity:1!important;transform:none!important}}
`;
