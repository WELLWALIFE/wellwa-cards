"use client";
// Advanced-site HERO variants. Each is a different composition, not a recolour (owner, 16 Oct 2026: "the user's mouth must say WOW"):
//   split-frame        words on paper, a tall framed photo beside them with a stamp, a small inset photo and a live open chip
//   full-bleed         the photo edge to edge and slowly drifting, an oversized headline low over a scrim, a glass facts bar
//   editorial-marquee  oversized type on paper, two ribbons (the card's facts, its name in outline), a wide photograph
//   glass-card         the photo edge to edge, the words on a frosted card, two figures floating on the other side
//   stacked-poster     centred words on the ink field, an arched photograph rising from the bottom edge, a round badge
//   mosaic             a bento of words, photographs and figures that re-forms around what the card has
//   video-first        a short headline row, then a rounded stage for the clip (the photograph when there is none)
//   centered-minimal   a small arch, the claim, one line, two buttons, a ruled row - and a great deal of air
//   diagonal           words left, the photograph cut on a slant to the screen's edge with an accent line along the cut
//   masthead           the business name set as a magazine title, a ruled issue line, the claim as the cover line
//   kinetic-type       a giant headline with round photographs set inside the sentence, a hollow ribbon behind it
//   pinned-story       a tall section with a pinned stage: the claim, then the numbers, then the buttons, as you scroll
//   parallax-collage   the headline in the middle of a layered collage that floats and follows the pointer
//   product-spotlight  one product at a time on a round stage, cycling through the catalogue, with price and an enquiry button
// All read the same hero model (src/lib/site-hero.ts) as the basic site, so the claim, the buttons and the trust row are the card's
// own; a part the card has nothing for is left out and the composition closes up. With no banner photo each falls to an art-directed
// type-led composition (motion.tsx ArtField: rings / blobs / stripes / grid from the palette, the first letter, the card's own
// figures) instead of stretching a logo or a product shot. The motion lives in motion.tsx; this file only composes it.
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { CountUp, CtaPair, HeroPhoto, TrustRow } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Photo, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";
import {
  ArtField, LiveOpen, MOTION_CSS, MaskPhoto, Parallax, PointerStage, ScrollCue, SplitHeadline, Stamp, Ticker, usePinProgress,
} from "@/components/site-adv/motion";

const initialOf = (s: string) => Array.from(s.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|डॉ\.?)\s+/i, "").trim())[0] ?? "";
const bookOf = (x: AdvCtx) => (slug: string) => (x.goto ? x.goto(slug) : x.jump(slug));
/** A picture a hero may draw: not the monogram, not a tinted SVG fallback. */
const isPhoto = (u: string) => !!u && !u.startsWith("/api/monogram/") && !/\.svg(?:[?#]|$)/i.test(u) && !u.startsWith("data:image/svg");
/** The page's other photos (products, gallery, about) - the cover is the hero model's own picture and is left out. */
const extraPhotos = (c: SiteContent, max: number) => {
  const cover = (c.hm.photo?.src ?? "").trim();
  return c.photos.map((u) => u.trim()).filter((u) => isPhoto(u) && u !== cover).slice(0, max);
};
/** How long a title is, so a long business name steps down one size instead of wrapping to four lines. */
const lenTier = (s: string) => { const n = Array.from(s).length; return n > 26 ? "l" : n > 16 ? "m" : "s"; };

/** The round badge's words, from what the card says: the year it began, else its rating. Nothing when it says neither.
 *  The ring holds about 34 capitals: parts are added in order of worth until the next would not fit, so no word is cut. */
function badgeOf(c: SiteContent, x: AdvCtx, prefer: "since" | "rating" = "since") {
  const { rating, since } = c.hm.trust;
  const fit = (parts: (string | false | undefined)[]) => {
    let out = "";
    for (const p of parts) { if (!p) continue; const next = out ? `${out} · ${p}` : p; if (Array.from(next).length > 34) break; out = next; }
    return out;
  };
  const bySince = since ? { value: String(since), sub: x.ui("Since", "से"), ring: fit([x.ui(`Since ${since}`, `${since} से`), x.t(c.trade), c.city && x.t(c.city)]) } : null;
  const byRating = rating ? { value: rating.v.toFixed(1), sub: `★ ${rating.n}`, ring: fit([x.ui("Rated by customers", "ग्राहकों की पसंद"), c.city && x.t(c.city), x.t(c.trade)]) } : null;
  return prefer === "since" ? bySince ?? byRating : byRating ?? bySince;
}

function Kick({ c, x, className = "" }: { c: SiteContent; x: AdvCtx; className?: string }) {
  if (!c.hm.kicker) return null;
  return <p className={`kicker ${className}`} lang={x.lang}>{x.t(c.hm.kicker)}</p>;
}
function Sub({ c, x }: { c: SiteContent; x: AdvCtx }) {
  if (!c.hm.sub) return null;
  return <p className="hero-sub" lang={x.lang}>{x.t(c.hm.sub)}</p>;
}
function Cta({ c, x, link = false }: { c: SiteContent; x: AdvCtx; link?: boolean }) {
  return <CtaPair primary={c.hm.primary} secondary={c.hm.secondary} username={x.card.username} secondaryStyle={link ? "link" : "ghost"} onBook={bookOf(x)} />;
}
/** The headline: words rising out of a mask. `cls` carries the hero's own size. */
function Head({ c, x, cls, accent = "last", as = "h1", from }: { c: SiteContent; x: AdvCtx; cls: string; accent?: "last" | "none"; as?: "h1" | "p"; from?: number }) {
  return <SplitHeadline as={as} text={x.t(c.hm.headline)} className={`ah-title ${cls}`} lang={x.lang} accent={accent} from={from} />;
}
/** The live open chip (moving dot, state, until when); nothing when the card has no readable hours. */
function Live({ c, x }: { c: SiteContent; x: AdvCtx }) {
  return c.hm.hours?.length ? <LiveOpen rows={c.hm.hours} hi={x.hi} /> : null;
}
/** The rating / since facts as a quiet line, without the open state (the live chip says that better). */
function Trust({ c, x, open = false }: { c: SiteContent; x: AdvCtx; open?: boolean }) {
  const t = c.hm.trust;
  if (!(t.rating || t.since || (open && t.open))) return null;
  return <TrustRow trust={open ? t : { ...t, open: undefined }} hours={open ? c.hm.hours : undefined} hi={x.hi} />;
}
/** The card's own numbers as big figures (value over label); nothing when the card has none. */
function Figures({ c, x, max = 4, className = "" }: { c: SiteContent; x: AdvCtx; max?: number; className?: string }) {
  const facts = c.facts.slice(0, max);
  if (!facts.length) return null;
  return (
    <ul className={`ah-figs ${className}`}>
      {facts.map((f, i) => <li key={i}><CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span></li>)}
    </ul>
  );
}
/* ---------- split-frame ---------- */
export function HeroSplitFrame({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const badge = badgeOf(c, x);
  const second = extraPhotos(c, 1)[0];
  const rating = hm.trust.rating;
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahs" aria-label={hm.name}>
      <i className="ahs-glow" aria-hidden="true" />
      <div className="adv-wrap adv-wide ahs-grid">
        <div className="ahs-words hero-stagger">
          <Kick c={c} x={x} />
          <Head c={c} x={x} cls="ahs-title" />
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          <div className="ahs-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></div>
          <Figures c={c} x={x} max={3} className="ahs-figs" />
        </div>
        <div className="ahs-art">
          <span className="ahs-block" aria-hidden="true" />
          <MaskPhoto className="ahs-frame" reveal="up" delay={120}>
            {hm.photo ? <HeroPhoto photo={hm.photo} crop="split" priority /> : <ArtField seed={spec.seed} letter={initialOf(hm.name)} />}
          </MaskPhoto>
          {badge && <Stamp className="ahs-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
          {second && <MaskPhoto className="ahs-inset" reveal="left" delay={650}><Photo src={second} eager sizes="(min-width: 900px) 20vw, 34vw" /></MaskPhoto>}
          {rating && (
            <div className="ahs-chip mo-up" style={{ "--mo-delay": "900ms" } as CSSProperties}>
              <Icon name="star" size={14} fill className="hero-star" /> <b>{rating.v.toFixed(1)}</b> <small>({rating.n})</small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- full-bleed ---------- */
export function HeroFullBleed({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const badge = badgeOf(c, x, "rating");
  const hasFacts = c.facts.length >= 2;
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahb hero-dark" aria-label={hm.name}>
      <Parallax className="ahb-photo" depth={6}>
        {hm.photo
          ? <HeroPhoto photo={hm.photo} clip={hm.clip} clipOn="desktop" crop="cover" priority scrim grain kenBurns side="left" />
          : <><ArtField seed={spec.seed} letter={initialOf(hm.name)} /><i aria-hidden="true" className="hero-scrim" /></>}
      </Parallax>
      {badge && <Stamp className="ahb-stamp" tone="paper" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
      <div className="adv-wrap adv-wide ahb-inner">
        <div className="ahb-top"><Kick c={c} x={x} className="ahb-kicker" /><Live c={c} x={x} /></div>
        <Head c={c} x={x} cls="ahb-title" />
        <div className="ahb-foot">
          <div className="ahb-say hero-stagger">
            <Sub c={c} x={x} />
            <Cta c={c} x={x} link />
          </div>
          {hasFacts
            ? <Figures c={c} x={x} max={3} className="ahb-figs" />
            : (hm.trust.rating || hm.trust.since) && <div className="ahb-facts"><Trust c={c} x={x} /></div>}
        </div>
      </div>
    </section>
  );
}

const HEROES_BASE_CSS = `
.adv-hero{overflow-x:clip}
.site .hero-stagger>.ah-title{animation:none}
.ah-glass{border:1px solid var(--hero-line);border-radius:var(--r-card);background:color-mix(in srgb,var(--hero-ink) 56%,transparent);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);color:var(--hero-text)}

.ahs{position:relative;isolation:isolate;padding-block:clamp(2rem,6vw,5.5rem) var(--section-pad)}
.ahs-glow{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(48% 62% at 76% 42%,var(--accent-soft),transparent 72%)}
.ahs-grid{display:grid;gap:clamp(2.75rem,5vw,3rem);align-items:center}
.ahs-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s5)}
.ahs-title{--ah-fs:clamp(3.3rem,7.6vw,7rem);line-height:.94;max-width:11ch}
.ahs-words .hero-sub{max-width:38ch}
.ahs-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s4)}
.ahs-figs{display:flex;flex-wrap:wrap;gap:var(--s4) clamp(1.5rem,3.5vw,2.75rem);width:100%;margin-top:var(--s3);padding-top:var(--s5);border-top:1px solid var(--line)}
.ahs-figs li>span:last-child{color:var(--muted)}
.ahs-art{position:relative;width:100%;max-width:560px;justify-self:center;padding:0 5% 6% 0}
.ahs-block{position:absolute;inset:8% 0 0 10%;border-radius:var(--r-tile);background:var(--accent-soft);border:1px solid var(--line)}
.ahs-frame{position:relative;z-index:1;aspect-ratio:4/5;background:var(--paper-2)}
.ahs-frame .mo-art-letter{font-size:clamp(11rem,32vw,22rem)}
.ahs-stamp{position:absolute;z-index:3;top:-5%;right:-1%;--rot:-10deg}
.ahs-inset{position:absolute;z-index:2;left:2%;bottom:-3%;width:34%;aspect-ratio:1;border:5px solid var(--paper);box-shadow:var(--e-1);transform:rotate(-4deg)}
.ahs-chip{position:absolute;z-index:3;right:10%;bottom:-1%;display:inline-flex;align-items:center;gap:.4em;padding:.6rem 1rem;border-radius:var(--r-pill);background:var(--paper);border:1px solid var(--line);box-shadow:var(--e-1);font-size:var(--t-meta);color:var(--muted)}
.ahs-chip b{color:var(--ink)}
@media (min-width:900px){.ahs-grid{grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr)}.ahs-art{justify-self:end}.ahs-inset{left:-12%}.ahs-stamp{right:-6%}}

.ahb{position:relative;display:flex;align-items:flex-end;min-height:min(92svh,860px);isolation:isolate}
.ahb>.ahb-photo{position:absolute;inset:0;z-index:-1;background:var(--hero-ink)}
.ahb-photo .hero-ph-wrap,.ahb-photo .mo-art{position:absolute;inset:0;width:100%;height:100%}
.ahb-stamp{position:absolute;z-index:2;top:clamp(5rem,12vw,8.5rem);right:var(--gutter);--st:clamp(84px,9vw,128px);--rot:9deg}
.ahb-inner{padding-top:clamp(7rem,18vw,12rem);padding-bottom:clamp(1.75rem,4vw,3rem)}
.site .hero-dark .ahb-top .kicker{color:var(--hero-text);opacity:.85}
.ahb-top{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5);margin-bottom:var(--s4)}
.ahb-title{--ah-fs:clamp(3rem,11.5vw,10rem);max-width:13ch;line-height:.9}
.site:lang(hi) .ahb-title{max-width:16ch}
.ahb-foot{display:grid;gap:var(--s5);margin-top:clamp(1.5rem,4vw,3rem);padding-top:var(--s5);border-top:1px solid var(--hero-line);align-items:end}
.ahb-say{display:flex;flex-direction:column;gap:var(--s4);align-items:flex-start}
.ahb-figs{display:flex;gap:clamp(1.25rem,3vw,2.5rem);padding:.9rem 1.25rem;justify-self:start;border:1px solid var(--hero-line);border-radius:var(--r-card);background:color-mix(in srgb,var(--hero-ink) 55%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.ahb-figs li{min-width:0}
.ahb-figs li>span:last-child{color:var(--hero-muted)}
.ahb-figs .ah-fig-v{font-size:clamp(1.4rem,2.6vw,2.2rem)}
.ahb-facts{justify-self:start;padding:.6rem 1rem;border:1px solid var(--hero-line);border-radius:var(--r-card);background:color-mix(in srgb,var(--hero-ink) 55%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.ahb-facts .trust-row{color:var(--hero-text)}
@media (min-width:900px){.ahb-foot{grid-template-columns:1fr auto}.ahb-figs,.ahb-facts{justify-self:end}}
@media (max-width:520px){.ahb-figs{gap:1rem;padding:.75rem .9rem}.ahb-figs li:nth-child(n+3){display:none}}
`;

/* =====================================================================================================================
   Eight more heroes (owner, 15-16 Oct 2026: every business's layout must be its OWN), then four more again. Same rules: the copy,
   the two buttons and the facts come from the hero model / the page content, nothing is invented, and a part the card has
   nothing for is left out - the composition closes up instead of showing a placeholder.
   ===================================================================================================================== */

/* ---------- editorial-marquee: oversized type on paper, two ribbons, a wide photograph ---------- */
function tickerItems(c: SiteContent): string[] {
  const out: string[] = [];
  for (const r of [c.hm.name, c.hm.kicker, ...c.facts.map((f) => `${f.value} ${f.label}`), ...c.highlights]) {
    const s = (r ?? "").replace(/\s+/g, " ").trim();
    if (s && Array.from(s).length <= 38 && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, 8);
}
export function HeroEditorialMarquee({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const items = tickerItems(c).map((s) => x.t(s));
  const hollow = [x.t(hm.name), x.t(c.trade), c.city && x.t(c.city)].filter((s): s is string => !!s);
  const badge = badgeOf(c, x, "rating");
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahe" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <div className="ahe-top">
          <Kick c={c} x={x} />
          <span className="ahe-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></span>
        </div>
        <div className="hero-stagger">
          <Head c={c} x={x} cls="ahe-title" />
          <div className="ahe-row">
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
          </div>
        </div>
      </div>
      {items.length >= 3 && (
        <div className="ahe-band">
          <Ticker items={items} look="solid" speed={60} label={hm.name} lang={x.lang} />
          {hollow.length >= 2 && <Ticker items={hollow} look="outline" speed={80} reverse lang={x.lang} className="ahe-hollow" />}
        </div>
      )}
      <div className="adv-wrap adv-wide">
        <div className="ahe-photo-wrap">
          <MaskPhoto className="ahe-photo" reveal="up" delay={200}>
            {hm.photo ? <Parallax depth={7} range="cover"><HeroPhoto photo={hm.photo} crop="cover" priority /></Parallax> : <ArtField seed={spec.seed} letter={initialOf(hm.name)} />}
          </MaskPhoto>
          {badge && hm.photo && <Stamp className="ahe-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
        </div>
      </div>
    </section>
  );
}

/* ---------- glass-card: the photograph edge to edge, the words on a frosted card, two figures beside it ---------- */
export function HeroGlassCard({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const stats = c.facts.slice(0, 2);
  const badge = badgeOf(c, x);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahg hero-dark" aria-label={hm.name}>
      <PointerStage className="ahg-stage">
        <Parallax className="ahg-bg" depth={6}>
          {hm.photo
            ? <HeroPhoto photo={hm.photo} crop="cover" priority scrim kenBurns side="center" />
            : <><ArtField seed={spec.seed} letter={initialOf(hm.name)} /><i className="ahg-glow" aria-hidden="true" /></>}
        </Parallax>
        <div className="adv-wrap adv-wide ahg-inner">
          <div className="ahg-card hero-stagger">
            <Kick c={c} x={x} />
            <Head c={c} x={x} cls="ahg-title" />
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
            {(hm.trust.rating || hm.trust.since || hm.trust.open) && <div className="ahg-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></div>}
          </div>
          <div className="ahg-side">
            {stats.length >= 2 && (
              <ul className="ahg-stats ah-figs">
                {stats.map((f, i) => (
                  <li key={i} className="ahg-stat ah-glass" data-depth="" style={{ "--k": i ? -16 : 22 } as CSSProperties}>
                    <CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span>
                  </li>
                ))}
              </ul>
            )}
            {badge && <Stamp className="ahg-stamp" tone="paper" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
          </div>
        </div>
      </PointerStage>
    </section>
  );
}

/* ---------- stacked-poster: centred words on the ink field, an arched photograph rising from the bottom edge ---------- */
export function HeroStackedPoster({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const badge = badgeOf(c, x, "rating");
  const strip = tickerItems(c).slice(1).map((s) => x.t(s));
  return (
    <section id="adv-hero" data-sec="hero" className={`adv-hero ahp hero-dark ${hm.photo ? "" : "ahp-bare"}`} aria-label={hm.name}>
      <i aria-hidden="true" className="hero-grain" />
      {!hm.photo && <ArtField seed={spec.seed} kind="rings" />}
      {strip.length >= 3 && <Ticker items={strip} look="caps" speed={70} lang={x.lang} className="ahp-strip" />}
      <div className="adv-wrap adv-wide ahp-inner hero-stagger">
        <Kick c={c} x={x} className="ahp-kicker" />
        <Head c={c} x={x} cls="ahp-title" />
        <Sub c={c} x={x} />
        <Cta c={c} x={x} />
      </div>
      {hm.photo ? (
        <div className="ahp-stage">
          <div className="ahp-wrap">
            <MaskPhoto className="ahp-arch" shape="arch" reveal="iris" delay={250}><HeroPhoto photo={hm.photo} crop="split" priority /></MaskPhoto>
            {badge && <Stamp className="ahp-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
          </div>
        </div>
      ) : (
        c.facts.length >= 2 && <div className="adv-wrap adv-wide"><Figures c={c} x={x} max={4} className="ahp-facts" /></div>
      )}
    </section>
  );
}

/* ---------- mosaic: a bento of the words, the photographs and two figures; the grid re-forms around what the card has ---------- */
type MosaicSide = { kind: "photo"; src: string } | { kind: "stat"; value: string; label: string };
export function HeroMosaic({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const extras = extraPhotos(c, 4);
  const badge = badgeOf(c, x);
  // The main tile is the cover; a card without one lets its first other photo stand in. Side tiles: photos, then figures.
  const main: { cover: true } | { src: string } | null = hm.photo ? { cover: true } : extras.length ? { src: extras.shift()! } : null;
  const sides: MosaicSide[] = extras.slice(0, 2).map((src) => ({ kind: "photo", src }));
  for (let i = 0; sides.length < 2 && i < c.facts.length; i++) sides.push({ kind: "stat", value: c.facts[i].value, label: c.facts[i].label });
  let stats = 0;
  const at = (n: number) => ({ "--mo-delay": `${n}ms` }) as CSSProperties;
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahx" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <div className="ahx-grid" data-l={`m${main ? 1 : 0}s${sides.length}`}>
          <div className="ahx-w hero-stagger">
            <Kick c={c} x={x} />
            <Head c={c} x={x} cls="ahx-title" />
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
            <div className="ahx-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></div>
          </div>
          {main && (
            <MaskPhoto className="ahx-m" reveal="up" delay={150}>
              {"cover" in main ? <HeroPhoto photo={hm.photo} crop="cover" priority /> : <Photo src={main.src} eager priority />}
              {badge && <Stamp className="ahx-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
            </MaskPhoto>
          )}
          {sides.map((s, i) => s.kind === "photo" ? (
            <MaskPhoto key={i} className={`ahx-s ahx-s${i + 1}`} reveal={i ? "left" : "up"} delay={400 + i * 160}><Photo src={s.src} eager sizes="(min-width: 900px) 22vw, 50vw" /></MaskPhoto>
          ) : (
            <div key={i} className={`ahx-stat ahx-s${i + 1} adv-lift mo-up`} style={at(450 + i * 160)} data-tone={stats++ % 2 ? "ink" : "accent"}>
              <CountUp value={x.t(s.value)} className="ah-fig-v" /><span>{x.t(s.label)}</span>
            </div>
          ))}
          {!main && !sides.length && <ArtField seed={spec.seed} className="ahx-art" />}
        </div>
      </div>
    </section>
  );
}

/* ---------- video-first: a short headline row, then a rounded stage for the clip (the photograph when there is no clip) ---------- */
export function HeroVideoFirst({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const [play, setPlay] = useState(true);
  // Motion off (reduced motion) shows the poster: the clip is not mounted at all, so it neither plays nor loads.
  useEffect(() => { if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlay(false); }, []);
  // No cover: the clip's own poster, else the page's first other photo, stands as the still.
  const still = hm.photo ? undefined : [hm.clip?.poster ?? "", ...extraPhotos(c, 1)].map((u) => u.trim()).find(isPhoto);
  const clip = hm.clip && play ? hm.clip : undefined;
  const media = !!(hm.photo || hm.clip || still);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahv" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <div className="ahv-head">
          <div className="hero-stagger">
            <Kick c={c} x={x} />
            <Head c={c} x={x} cls="ahv-title" />
          </div>
          <div className="ahv-side hero-stagger">
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
          </div>
        </div>
        <MaskPhoto className="ahv-stage hero-dark" reveal="up" delay={150}>
          {hm.photo || clip
            ? <HeroPhoto photo={hm.photo} clip={clip} clipOn="always" crop="cover" priority scrim kenBurns side="center" />
            : still ? <><Photo src={still} eager priority sizes="100vw" /><div aria-hidden="true" className="hero-scrim" /></>
            : <><ArtField seed={spec.seed} letter={initialOf(hm.name)} /><div className="ahv-figwrap"><Figures c={c} x={x} max={4} className="ahv-figs" /></div></>}
          {hm.clip && (
            <button type="button" className="ahv-pp" aria-pressed={!play} onClick={() => setPlay(!play)}
              aria-label={play ? x.ui("Pause video", "वीडियो रोकें") : x.ui("Play video", "वीडियो चलाएँ")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{play ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></> : <path d="M8.5 5.5v13l11-6.5z" />}</svg>
            </button>
          )}
          {media && (hm.trust.rating || hm.trust.since || hm.trust.open) && <div className="ahv-bar"><div className="ahv-glass ah-glass"><Live c={c} x={x} /><Trust c={c} x={x} /></div></div>}
        </MaskPhoto>
      </div>
    </section>
  );
}

/* ---------- centered-minimal: nearly nothing - one small arch, the claim, a line, two buttons, a ruled row ---------- */
export function HeroCenteredMinimal({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const hasTrust = !!(hm.trust.rating || hm.trust.since || hm.trust.open);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahc" aria-label={hm.name}>
      <i className="ahc-halo" aria-hidden="true" />
      <div className="adv-wrap ahc-inner hero-stagger">
        <span className="ahc-arch-wrap">
          <MaskPhoto className="ahc-arch" shape="arch" reveal="up" delay={100}>
            {hm.photo ? <HeroPhoto photo={hm.photo} crop="split" priority /> : <ArtField seed={spec.seed} kind="rings" letter={initialOf(hm.name)} />}
          </MaskPhoto>
        </span>
        <Kick c={c} x={x} />
        <Head c={c} x={x} cls="ahc-title" />
        <hr className="adv-rule mo-grow" />
        <Sub c={c} x={x} />
        <Cta c={c} x={x} />
        {hasTrust && <div className="ahc-foot"><Live c={c} x={x} /><Trust c={c} x={x} /></div>}
      </div>
    </section>
  );
}

/* ---------- diagonal: the words on the left, a photograph cut on a slant to the screen's edge, an accent line along the cut ---------- */
export function HeroDiagonal({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const facts = !hm.photo && c.facts.length >= 2 ? c.facts.slice(0, 3) : [];
  const badge = badgeOf(c, x, "rating");
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahd" aria-label={hm.name}>
      <div className="ahd-art">
        <span className="ahd-band" aria-hidden="true" />
        <div className="ahd-pic ah-fill">
          {hm.photo ? <HeroPhoto photo={hm.photo} crop="split" priority kenBurns /> : <ArtField seed={spec.seed} kind="stripes" letter={initialOf(hm.name)} />}
          {facts.length > 0 && (
            <ul className="ahd-facts ah-figs">{facts.map((f, i) => <li key={i}><CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span></li>)}</ul>
          )}
        </div>
        {badge && hm.photo && <Stamp className="ahd-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
      </div>
      <div className="adv-wrap adv-wide">
        <div className="ahd-words hero-stagger">
          <Kick c={c} x={x} />
          <Head c={c} x={x} cls="ahd-title" />
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          <div className="ahd-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></div>
        </div>
      </div>
    </section>
  );
}

/* ---------- masthead: the business name as a magazine's title, a ruled issue line, the claim as the cover line ---------- */
export function HeroMasthead({ c, x }: VariantProps) {
  const { hm } = c;
  const name = x.t(hm.name);
  const pic = hm.photo ? "cover" : extraPhotos(c, 1)[0];
  const good = !pic ? c.highlights.slice(0, 5) : [];
  const facts = c.facts.slice(0, 4);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahh" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <SplitHeadline text={name} accent="none" className="ah-title ahh-mast" lang={x.lang} len={lenTier(name)} />
        <div className="ahh-rule">
          <Kick c={c} x={x} />
          <span className="ahh-issue"><Live c={c} x={x} /><Trust c={c} x={x} /></span>
        </div>
        <div className={`ahh-body ${pic || good.length >= 2 ? "" : "ahh-solo"}`}>
          <div className="ahh-cover hero-stagger">
            <Head c={c} x={x} as="p" cls="ahh-line" from={500} />
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
            {facts.length > 0 && (
              <ol className="ahh-lines">
                {facts.map((f, i) => (
                  <li key={i}><span className="ahh-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span></li>
                ))}
              </ol>
            )}
          </div>
          {pic && (
            <figure className="ahh-fig">
              <MaskPhoto className="ahh-ph" reveal="up" delay={350}>{pic === "cover" ? <HeroPhoto photo={hm.photo} crop="split" priority /> : <Photo src={pic} eager priority sizes="(min-width: 900px) 40vw, 100vw" />}</MaskPhoto>
              {hm.kicker && <figcaption lang={x.lang}>{x.t(hm.kicker)}</figcaption>}
            </figure>
          )}
          {!pic && good.length >= 2 && (
            <aside className="ahh-good mo-up" style={{ "--mo-delay": "500ms" } as CSSProperties} aria-label={x.ui("Good to know", "जानने लायक")}>
              <p className="kicker">{x.ui("Good to know", "जानने लायक")}</p>
              <ul>{good.map((g, i) => <li key={i} lang={x.lang}><Icon name="check" size={16} />{x.t(g)}</li>)}</ul>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- kinetic-type: a giant headline with round photographs set inside the sentence, a hollow ribbon behind it ---------- */
export function HeroKinetic({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const words = x.t(hm.headline).trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  const pics = [hm.photo?.src ?? "", ...extraPhotos(c, 2)].filter(isPhoto);
  // The pills sit after the middle of the sentence and (with five or more words) again before its end.
  const pillAt = new Map<number, number>();
  pillAt.set(n <= 1 ? 0 : Math.max(0, Math.floor((n - 1) / 2) - (n > 4 ? 1 : 0)), 0);
  if (n >= 5) pillAt.set(n - 2, 1);
  const hollow = [x.t(hm.name), x.t(c.trade), c.city && x.t(c.city)].filter((s): s is string => !!s);
  const pill = (k: number, wi: number) => {
    const src = pics[k] ?? (k === 1 ? pics[0] : undefined);
    return (
      <span className={`ahk-pill ${src ? "" : "ahk-pill-art"}`} data-k={k} aria-hidden="true" style={{ "--wi": wi } as CSSProperties}>
        {src ? <Photo src={src} eager sizes="30vw" /> : <><ArtField seed={`${spec.seed}${k}`} kind={k ? "stripes" : "rings"} /><Icon name={k ? "star" : "arrow-up-right"} size={28} strokeWidth={1.8} /></>}
      </span>
    );
  };
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahk" aria-label={hm.name}>
      <div className="adv-wrap adv-wide ahk-inner">
        <div className="ahk-top"><Kick c={c} x={x} /><span className="ahk-live"><Live c={c} x={x} /></span></div>
        <div className="ahk-head">
        {hollow.length >= 2 && <div className="ahk-back" aria-hidden="true"><Ticker items={hollow} look="outline" speed={90} /></div>}
        <h1 className="ah-title ahk-title" lang={x.lang} style={{ "--d0": "80ms" } as CSSProperties}>
          {words.map((w, i) => (
            <Fragment key={i}>
              <span className="mo-w"><span className={`mo-wi ${i === n - 1 && n > 1 ? "mo-acc" : ""}`} style={{ "--wi": Math.min(i, 9) } as CSSProperties}>{w}</span></span>{" "}
              {pillAt.has(i) && <>{pill(pillAt.get(i)!, Math.min(i, 9) + 1)}{" "}</>}
            </Fragment>
          ))}
        </h1>
        </div>
        <div className="ahk-foot hero-stagger">
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          <Figures c={c} x={x} max={3} className="ahk-figs" />
        </div>
      </div>
    </section>
  );
}

/* ---------- pinned-story: a tall section with a pinned stage - the claim, then the numbers, then the buttons - as you scroll ---------- */
export function HeroPinnedStory({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const ref = useRef<HTMLElement>(null);
  usePinProgress(ref, 3);
  const pics = [hm.photo?.src ?? "", ...extraPhotos(c, 2)].filter(isPhoto).slice(0, 3);
  // A background per chapter; fewer pictures than chapters, the last one stays. No picture at all: the card's own art, all through.
  const bgs = pics.length ? pics : [""];
  const forCh = (ch: number) => Math.min(ch, bgs.length - 1);
  const facts = c.facts.slice(0, 3);
  const bigSub = facts.length < 2;
  return (
    <section ref={ref} id="adv-hero" data-sec="hero" data-ch="0" className="adv-hero ahn hero-dark" aria-label={hm.name}>
      <div className="ahn-stage">
        <div className="ahn-bgs" aria-hidden="true">
          {bgs.map((src, i) => (
            <div key={i} className="ahn-bg" data-on={[0, 1, 2].filter((ch) => forCh(ch) === i).join(" ")}>
              {src ? (i === 0 && hm.photo ? <HeroPhoto photo={hm.photo} crop="cover" priority /> : <Photo src={src} eager sizes="100vw" />) : <ArtField seed={spec.seed} letter={initialOf(hm.name)} />}
            </div>
          ))}
          <i className="ahn-scrim" />
          <i className="hero-grain" />
        </div>
        <div className="adv-wrap adv-wide ahn-inner">
          <div className="ahn-ch" data-c="0">
            <div className="ahn-kick"><Kick c={c} x={x} /><Live c={c} x={x} /></div>
            <Head c={c} x={x} cls="ahn-title" />
            <ScrollCue label={x.ui("Scroll", "नीचे देखें")} className="ahn-cue" />
          </div>
          <div className="ahn-ch" data-c="1" aria-hidden={undefined}>
            {bigSub ? <p className="ah-title ahn-big" lang={x.lang}>{x.t(hm.sub || hm.headline)}</p> : (
              <ul className="ahn-figs ah-figs">
                {facts.map((f, i) => <li key={i}><CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span></li>)}
              </ul>
            )}
            {!bigSub && hm.sub && <p className="hero-sub" lang={x.lang}>{x.t(hm.sub)}</p>}
          </div>
          <div className="ahn-ch" data-c="2">
            <p className="ah-title ahn-end" lang={x.lang}>{x.ui("Come and see for yourself.", "आइए, खुद देखिए।")}</p>
            <Cta c={c} x={x} />
            <Trust c={c} x={x} />
          </div>
        </div>
        <ol className="ahn-rail" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} data-i={i} />)}</ol>
      </div>
    </section>
  );
}

/* ---------- parallax-collage: the headline in the middle of a layered collage that floats and follows the pointer ---------- */
type Tile = { kind: "photo"; src: string } | { kind: "cover" } | { kind: "stat"; value: string; label: string } | { kind: "stamp" } | { kind: "ring" } | { kind: "dot" };
const COLLAGE_SHAPES = ["arch", "circle", "rect", "pill", "rect"] as const;
export function HeroCollage({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const badge = badgeOf(c, x);
  const tiles: Tile[] = [];
  if (hm.photo) tiles.push({ kind: "cover" });
  for (const src of extraPhotos(c, 4)) if (tiles.length < 4) tiles.push({ kind: "photo", src });
  // What the card has fewer pictures of is made up with its own figures, the round badge and plain palette shapes, never a blank.
  const spare: Tile[] = [
    ...c.facts.slice(0, 2).map((f): Tile => ({ kind: "stat", value: f.value, label: f.label })),
    ...(badge ? [{ kind: "stamp" } as Tile] : []), { kind: "ring" }, { kind: "dot" },
  ];
  for (const t of spare) if (tiles.length < 5) tiles.push(t);
  // The fifth slot is the badge when there is one and a picture did not take it.
  const slot = (i: number): CSSProperties => ({ "--i": i } as CSSProperties);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahl" aria-label={hm.name}>
      <i className="ahl-glow" aria-hidden="true" />
      <div className="adv-wrap adv-wide ahl-inner">
        <div className="ahl-words hero-stagger">
          <Kick c={c} x={x} />
          <Head c={c} x={x} cls="ahl-title" />
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          <div className="ahl-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></div>
        </div>
      </div>
      <PointerStage className="ahl-stage">
        {tiles.map((t, i) => (
          <div key={i} className="ahl-t" data-depth="" data-n={i} style={{ "--k": [18, -26, 30, -14, 22][i] } as CSSProperties}>
            <div className="ahl-f" style={slot(i)}>
              {t.kind === "cover" || t.kind === "photo" ? (
                <MaskPhoto className="ahl-pic" shape={COLLAGE_SHAPES[i % 5]} reveal={i % 2 ? "iris" : "up"} delay={200 + i * 140}>
                  {t.kind === "cover" ? <HeroPhoto photo={hm.photo} crop="tile" priority={i === 0} lazy={i > 0} /> : <Photo src={t.src} eager sizes="(min-width: 900px) 20vw, 40vw" />}
                </MaskPhoto>
              ) : t.kind === "stat" ? (
                <div className="ahl-stat mo-up" style={{ "--mo-delay": `${300 + i * 140}ms` } as CSSProperties}>
                  <CountUp value={x.t(t.value)} className="ah-fig-v" /><span>{x.t(t.label)}</span>
                </div>
              ) : t.kind === "stamp" && badge ? (
                <Stamp className="ahl-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />
              ) : t.kind === "ring" ? (
                <span className="ahl-ring mo-fade" aria-hidden="true"><ArtField seed={`${spec.seed}r`} kind="rings" /></span>
              ) : (
                <span className="ahl-dot mo-up" aria-hidden="true"><Icon name="star" size={26} fill /></span>
              )}
            </div>
          </div>
        ))}
      </PointerStage>
    </section>
  );
}

/* ---------- product-spotlight: one product at a time on a round stage, cycling through the catalogue ---------- */
export function HeroSpotlight({ c, x, spec }: VariantProps) {
  const { hm } = c;
  const items = (c.offerings?.items ?? []).filter((o) => isPhoto(o.images[0] ?? "")).slice(0, 4);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => { if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.querySelector('.site[data-motion="none"]')) setStill(true); }, []);
  // Four and a half seconds a product; stops under the pointer or focus, and under reduced motion (the dots still work).
  useEffect(() => {
    if (items.length < 2 || held || still) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % items.length), 4500);
    return () => window.clearInterval(id);
  }, [items.length, held, still]);
  const cur = items[Math.min(i, items.length - 1)];
  const badge = badgeOf(c, x, "rating");
  const listed = !items.length ? (c.offerings?.items ?? []).slice(0, 4) : [];
  const price = cur?.price;
  const ask = cur ? x.waHref(x.hi ? `नमस्ते ${c.name}, मुझे "${x.t(cur.name)}"${price ? ` (${price})` : ""} के बारे में जानकारी चाहिए।` : `Hi ${c.name}, I saw your website - I'd like to know more about "${cur.name}"${price ? ` (${price})` : ""}.`) : "";
  const open = (slug?: string) => (e: React.MouseEvent) => { if (slug && x.goto) { e.preventDefault(); x.goto(slug); } };
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero aho" aria-label={hm.name}>
      <i className="aho-glow" aria-hidden="true" />
      <div className="adv-wrap adv-wide aho-grid">
        <div className="aho-words hero-stagger">
          <Kick c={c} x={x} />
          <Head c={c} x={x} cls="aho-title" />
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          <div className="aho-meta"><Live c={c} x={x} /><Trust c={c} x={x} /></div>
        </div>
        <div className="aho-stage" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
          <span className="aho-disc" aria-hidden="true"><i /><i /></span>
          {items.length > 0 ? (
            <>
              <div className="aho-pics">
                {items.map((o, k) => (
                  <div key={k} className="aho-pic" data-on={k === i ? "" : undefined} aria-hidden={k === i ? undefined : true}>
                    <Photo src={o.images[0]} alt={k === i ? x.t(o.name) : ""} eager={k < 2} priority={k === 0} sizes="(min-width: 900px) 34vw, 80vw" />
                  </div>
                ))}
              </div>
              <div className="aho-card ah-glass mo-up" style={{ "--mo-delay": "500ms" } as CSSProperties}>
                <p className="aho-kick">{x.ui("Featured", "खास")} <span aria-hidden="true">{String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span></p>
                <p className="aho-name" lang={x.lang} aria-live="polite">{x.t(cur.name)}</p>
                <p className="aho-price">
                  {price && <b>{price}</b>}{cur.mrp && cur.mrp !== price && <s>{cur.mrp}</s>}
                  {cur.badge && <em>{x.t(cur.badge)}</em>}
                </p>
                <div className="aho-act">
                  {cur.slug && <a href={x.hrefFor(cur.slug)} className="btn-primary aho-btn" onClick={(e) => { x.track("spot-view"); open(cur.slug)(e); }}>{x.ui("View", "देखें")} <Icon name="arrow-right" size={16} /></a>}
                  {x.wa && <a href={ask} target="_blank" rel="noreferrer" className={`${cur.slug ? "btn-link" : "btn-primary"} aho-btn`} onClick={() => x.track("spot-enquire")}><Icon name="whatsapp" size={16} /> {x.ui("Enquire", "पूछें")}</a>}
                </div>
              </div>
              {items.length > 1 && (
                <div className="aho-dots" role="group" aria-label={x.ui("Featured products", "खास प्रोडक्ट")}>
                  {items.map((o, k) => <button key={k} type="button" aria-label={x.t(o.name)} aria-pressed={k === i} onClick={() => setI(k)} />)}
                </div>
              )}
            </>
          ) : hm.photo ? (
            <MaskPhoto className="aho-solo" shape="arch" reveal="iris" delay={200}><HeroPhoto photo={hm.photo} crop="split" priority /></MaskPhoto>
          ) : (
            <div className="aho-list ah-glass hero-dark">
              <ArtField seed={spec.seed} letter={initialOf(hm.name)} />
              {listed.length > 0 && <ol>{listed.map((o, k) => <li key={k}><span aria-hidden="true">{String(k + 1).padStart(2, "0")}</span><b lang={x.lang}>{x.t(o.name)}</b>{o.price && <em>{o.price}</em>}</li>)}</ol>}
            </div>
          )}
          {badge && <Stamp className="aho-stamp" value={badge.value} sub={badge.sub} ring={badge.ring} hi={x.hi} />}
        </div>
      </div>
    </section>
  );
}

export const HEROES_MORE_CSS = `
/* shared by the eight newer heroes: the title scale (Hindi steps down and loosens), the figure pairs, the fill box */
.ah-title{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:var(--ah-fs,clamp(2.6rem,8vw,6rem));line-height:var(--display-lh);letter-spacing:var(--display-tr);text-wrap:balance;overflow-wrap:break-word}
.site:lang(hi) .ah-title{font-size:calc(var(--ah-fs,clamp(2.6rem,8vw,6rem))*.86);line-height:1.26;letter-spacing:0;font-weight:var(--display-w-hi)}
.site .ah-fill>.hero-ph-wrap{position:absolute;inset:0}
.ah-fill{position:relative;overflow:hidden}
.ah-fill>.adv-photo,.ah-fill>.adv-tile{position:absolute;inset:0}
.ah-figs{margin:0;padding:0;list-style:none}
.ah-figs li{display:flex;flex-direction:column;gap:.3rem}
.ah-fig-v{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.75rem,3.4vw,2.75rem);line-height:1;letter-spacing:var(--display-tr);font-variant-numeric:tabular-nums}
.ah-figs li>span:last-child{font-size:var(--t-meta);line-height:1.35}
@media (hover:hover){.ah-fill .adv-photo,.ah-fill .hero-ph{transition:transform .9s cubic-bezier(.2,.7,.2,1)}}

/* editorial-marquee */
.ahe{padding-block:clamp(1.25rem,3.5vw,3rem) 0}
.ahe-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s3) var(--s5);padding-bottom:var(--s4);border-bottom:1px solid var(--ink)}
.ahe-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)}
.ahe-title{--ah-fs:clamp(3rem,11.4vw,10rem);line-height:.9;max-width:13ch;margin-top:clamp(1.25rem,3.5vw,2.75rem)}
.ahe-row{display:grid;gap:var(--s5);align-items:end;margin-top:clamp(1.5rem,4vw,3rem)}
.ahe-row .hero-sub{max-width:40ch}
@media (min-width:900px){.ahe-row{grid-template-columns:minmax(0,1fr) auto}.ahe-row .hero-ctas{justify-content:flex-end}}
.ahe-band{margin-top:clamp(2rem,5vw,3.5rem);border-block:1px solid var(--line);padding-block:clamp(.7rem,1.6vw,1.15rem);overflow:hidden}
.ahe-band .mo-tk[data-look=solid]{margin-bottom:0}
.ahe-hollow{margin-top:clamp(.5rem,1.5vw,1rem);padding-top:clamp(.5rem,1.5vw,1rem);border-top:1px solid var(--line)}
.ahe-photo-wrap{position:relative;margin-top:clamp(1.5rem,4vw,3rem)}
.ahe-photo{aspect-ratio:4/3;background:var(--paper-2)}
@media (min-width:700px){.ahe-photo{aspect-ratio:21/9}}
.ahe-photo .mo-par{position:absolute;inset:0}
.ahe-photo .hero-ph-wrap{width:100%;height:100%}
.ahe-stamp{position:absolute;z-index:2;right:clamp(.75rem,4vw,3.5rem);top:clamp(.75rem,2vw,1.5rem);--rot:-9deg}
@media (min-width:900px){.ahe-stamp{top:0;transform:translateY(-50%) rotate(-9deg)}}

/* glass-card */
.ahg{position:relative;isolation:isolate;display:flex;align-items:flex-end;min-height:min(86vh,800px);min-height:min(86svh,800px);padding-block:clamp(5rem,12vw,8rem) clamp(1rem,3vw,2.5rem)}
.ahg-stage{display:flex;align-items:flex-end;width:100%;min-height:inherit}
.ahg>.ahg-stage .ahg-bg{position:absolute;inset:0;z-index:-1}
.ahg-bg .hero-ph-wrap,.ahg-bg .mo-art{position:absolute;inset:0;width:100%;height:100%}
.ahg>.ahg-stage{position:static}
.ahg-glow{position:absolute;inset:0;background:radial-gradient(60% 75% at 82% 18%,color-mix(in srgb,var(--accent) 42%,transparent),transparent 70%),radial-gradient(50% 60% at 8% 100%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 70%)}
.ahg-inner{display:grid;gap:var(--s5);align-items:end}
.ahg-card{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);max-width:38rem;padding:clamp(1.25rem,3vw,2.25rem);border:1px solid var(--hero-line);border-radius:var(--r-tile);background:color-mix(in srgb,var(--hero-ink) 66%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.ahg-card{background:color-mix(in srgb,var(--hero-ink) 90%,transparent)}}
.ahg-title{--ah-fs:clamp(2.4rem,6.2vw,5rem);line-height:.96}
.ahg-card .hero-sub{max-width:36ch}
.ahg-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4);width:100%;padding-top:var(--s4);border-top:1px solid var(--hero-line)}
.ahg-meta .trust-row{color:var(--hero-muted)}
.ahg-side{display:none}
.ahg-stats{display:flex;flex-direction:column;gap:var(--s3)}
.ahg-stat{min-width:12rem;padding:var(--s4) var(--s5)}
.ahg-stat span:last-child{color:var(--hero-muted)}
.ahg-stamp{--rot:8deg}
@media (min-width:900px){.ahg{align-items:center}.ahg-inner{grid-template-columns:minmax(0,38rem) 1fr}.ahg-side{display:flex;flex-direction:column;align-items:flex-end;gap:var(--s6);align-self:end;justify-self:end}}

/* stacked-poster */
.ahp{position:relative;overflow:hidden;isolation:isolate;padding-top:0;text-align:center}
.ahp-strip{position:relative;z-index:1;border-bottom:1px solid var(--hero-line);padding-block:.75rem;margin-bottom:clamp(2.5rem,6vw,5rem)}
/* [data-look] lifts this above the ticker's own caps colour (var(--ink)), which was near-black on the dark poster: the strip could not be read (16 Oct 2026 QA). */
.ahp .ahp-strip[data-look] li{color:var(--hero-text);opacity:.78}
.ahp-bare{padding-bottom:clamp(2.5rem,6vw,4.5rem)}
.ahp-inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:var(--s4)}
.ahp-kicker{display:flex;align-items:center;gap:var(--s4)}
.ahp-kicker::before,.ahp-kicker::after{content:"";width:clamp(24px,6vw,64px);height:1px;background:currentColor;opacity:.4}
.ahp-title{--ah-fs:clamp(2.9rem,10.4vw,8.5rem);line-height:.9;max-width:12ch}
.ahp .hero-sub{max-width:44ch;margin-inline:auto;text-align:center}
.ahp .hero-ctas{justify-content:center}
.ahp-stage{position:relative;display:flex;justify-content:center;height:clamp(250px,38vw,450px);margin-top:clamp(2rem,5vw,3.5rem);overflow:hidden}
.ahp-wrap{position:relative;width:min(78vw,480px);flex:none;margin-top:28px}
.ahp-wrap::before,.ahp-wrap::after{content:"";position:absolute;inset:-14px -14px 0;border:1px solid var(--hero-line);border-bottom:0;border-radius:999px 999px 0 0;animation:mo-wipe-up 1.4s cubic-bezier(.7,0,.2,1) .5s backwards}
.ahp-wrap::after{inset:-28px -28px 0;opacity:.55;animation-delay:.7s}
.ahp-arch{aspect-ratio:3/4}
.site[data-shape=sharp] .ahp-wrap::before,.site[data-shape=sharp] .ahp-wrap::after{border-radius:var(--r-tile) var(--r-tile) 0 0}
.ahp-stamp{position:absolute;z-index:2;right:-6%;top:14%;--rot:-8deg}
.ahp-facts{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:clamp(2rem,5vw,3.5rem);border-top:1px solid var(--hero-line)}
.ahp-facts li{align-items:center;padding:var(--s5) var(--s3);text-align:center}
.ahp-facts li+li{border-left:1px solid var(--hero-line)}
.ahp-facts li>span:last-child{color:var(--hero-muted)}

/* mosaic */
.ahx{padding-block:clamp(.75rem,2vw,1.5rem) clamp(2rem,5vw,3.5rem)}
.ahx-grid{display:grid;gap:clamp(.5rem,1.2vw,.9rem);grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.ahx-w{grid-area:w;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:var(--s4);padding:clamp(1.5rem,4vw,3.25rem);border:1px solid var(--line);border-radius:var(--r-tile);background:var(--paper-2)}
.ahx-title{--ah-fs:clamp(2.4rem,5.6vw,4.8rem);line-height:.95}
.ahx-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)}
.ahx-m{grid-area:m;aspect-ratio:4/3;overflow:visible;background:transparent}
.ahx-m>.hero-ph-wrap,.ahx-m>.adv-photo{border-radius:var(--r-tile)}
.ahx-m{border-radius:var(--r-tile)}
.ahx-stamp{position:absolute;z-index:2;left:clamp(.75rem,2vw,1.5rem);bottom:clamp(.75rem,2vw,1.5rem);--st:clamp(88px,9vw,116px);--rot:-9deg}
.ahx-s{position:relative;overflow:hidden;aspect-ratio:1;border-radius:var(--r-tile);background:var(--paper-2)}
.ahx-s .adv-photo{position:absolute;inset:0}
.ahx-s1{grid-area:s1}.ahx-s2{grid-area:s2}
.ahx-stat{display:flex;flex-direction:column;justify-content:flex-end;gap:.35rem;aspect-ratio:1;padding:clamp(1rem,2.2vw,1.75rem);border-radius:var(--r-tile);background:var(--accent);color:var(--on-accent)}
.ahx-stat[data-tone=ink]{background:var(--hero-ink);color:var(--hero-text)}
.ahx-stat .ah-fig-v{font-size:clamp(1.9rem,4vw,3.25rem)}
.ahx-stat>span:last-child{font-size:var(--t-meta);line-height:1.35;opacity:.88}
.ahx-art{grid-area:m;border-radius:var(--r-tile);min-height:220px}
.ahx-grid[data-l=m1s2]{grid-template-areas:"w w" "m m" "s1 s2"}
.ahx-grid[data-l=m1s1]{grid-template-areas:"w w" "m m" "s1 s1"}
.ahx-grid[data-l=m1s0]{grid-template-areas:"w w" "m m"}
.ahx-grid[data-l=m0s2]{grid-template-areas:"w w" "s1 s2"}
.ahx-grid[data-l=m0s1]{grid-template-areas:"w w" "s1 s1"}
.ahx-grid[data-l=m0s0]{grid-template-areas:"w w" "m m"}
.ahx-grid[data-l$=s1] .ahx-s,.ahx-grid[data-l$=s1] .ahx-stat{aspect-ratio:16/9}
@media (min-width:900px){
.ahx-grid{grid-auto-rows:minmax(clamp(220px,25vw,320px),auto)}
.ahx-grid[data-l] .ahx-m,.ahx-grid[data-l] .ahx-s,.ahx-grid[data-l] .ahx-stat{aspect-ratio:auto}
.ahx-grid[data-l=m1s2]{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.62fr);grid-template-areas:"w m s1" "w m s2"}
.ahx-grid[data-l=m1s1]{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.62fr);grid-template-areas:"w m s1" "w m s1"}
.ahx-grid[data-l=m1s0]{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-areas:"w m";grid-auto-rows:minmax(clamp(380px,40vw,560px),auto)}
.ahx-grid[data-l=m0s2]{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);grid-template-areas:"w s1" "w s2"}
.ahx-grid[data-l=m0s1]{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);grid-template-areas:"w s1";grid-auto-rows:minmax(clamp(380px,40vw,560px),auto)}
.ahx-grid[data-l=m0s0]{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-areas:"w m";grid-auto-rows:minmax(clamp(380px,40vw,560px),auto)}
}
@media (hover:hover){.ahx-m:hover .adv-photo,.ahx-m:hover .hero-ph,.ahx-s:hover .adv-photo{transform:scale(1.04)}}

/* video-first */
.ahv{padding-block:clamp(1.25rem,3.5vw,3rem) clamp(1.5rem,4vw,3rem)}
.ahv-head{display:grid;gap:var(--s5);align-items:end;margin-bottom:clamp(1.5rem,3.5vw,2.5rem)}
.ahv-title{--ah-fs:clamp(3.1rem,7.4vw,6.25rem);line-height:.93;max-width:14ch;margin-top:var(--s4)}
.ahv-head .hero-stagger{display:flex;flex-direction:column;gap:var(--s4)}.ahv-head .ahv-title{margin-top:0}
.ahv-side{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
@media (min-width:900px){.ahv-head{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}}
.ahv-stage{aspect-ratio:4/5;isolation:isolate}
@media (min-width:700px){.ahv-stage{aspect-ratio:16/9}}
.ahv-figwrap{position:absolute;inset:auto 0 0 0;padding:clamp(1.5rem,4vw,3rem)}
.ahv-figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:var(--s5);width:100%}
.ahv-figs li>span:last-child{color:var(--hero-muted)}
.ahv-bar{position:absolute;left:var(--s4);right:var(--s4);bottom:var(--s4);display:flex;justify-content:flex-start}
.ahv-glass{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4);padding:.55rem .9rem}
.ahv-glass .trust-row{color:var(--hero-text)}
.ahv-glass .mo-open{background:transparent;border-color:transparent;padding-inline:0;-webkit-backdrop-filter:none;backdrop-filter:none}
.ahv-pp{position:absolute;z-index:2;top:var(--s4);right:var(--s4);display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--hero-line);border-radius:50%;background:color-mix(in srgb,var(--hero-ink) 62%,transparent);color:var(--hero-text);cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:background .15s,transform .08s}
.ahv-pp:hover{background:color-mix(in srgb,var(--hero-ink) 85%,transparent)}.ahv-pp:active{transform:scale(.94)}

/* centered-minimal */
.ahc{position:relative;padding-block:clamp(3.5rem,10vw,8rem) clamp(3.5rem,10vw,8rem);text-align:center;isolation:isolate}
.ahc-halo{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(62% 55% at 50% 0%,var(--accent-soft),transparent 72%)}
.ahc-inner{display:flex;flex-direction:column;align-items:center;gap:var(--s5);max-width:56rem}
.ahc-arch-wrap{position:relative;display:block;padding:7px;border:1px solid var(--line);border-radius:999px 999px 14px 14px}
.site[data-shape=sharp] .ahc-arch-wrap{border-radius:var(--r-img)}
.ahc-arch{width:clamp(104px,16vw,210px);aspect-ratio:3/4;box-shadow:0 0 0 5px var(--paper)}
.ahc-title{--ah-fs:clamp(2.6rem,8vw,6.6rem);line-height:.95;max-width:14ch}
.ahc .hero-sub{max-width:40ch;text-align:center}
.ahc .hero-ctas{justify-content:center}
.ahc-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--s2) var(--s4);width:min(100%,36rem);padding-top:var(--s5);border-top:1px solid var(--line)}

/* diagonal */
.ahd{position:relative;isolation:isolate;overflow:hidden}
.ahd-art{position:relative;height:clamp(240px,56vw,360px);margin-bottom:14px}
.ahd-band,.ahd-pic{position:absolute;inset:0;clip-path:polygon(0 0,100% 0,100% calc(100% - 34px),0 100%)}
.ahd-band{background:var(--accent);transform:translateY(14px)}
.ahd-pic{background:var(--accent-soft);animation:ahd-cut 1.25s cubic-bezier(.7,0,.2,1) backwards}
.ahd-band{animation:ahd-cut 1.25s cubic-bezier(.7,0,.2,1) .15s backwards}
@keyframes ahd-cut{from{clip-path:polygon(0 0,0 0,0 calc(100% - 34px),0 100%)}to{clip-path:polygon(0 0,100% 0,100% calc(100% - 34px),0 100%)}}
@keyframes ahd-cut-d{from{clip-path:polygon(22% 0,22% 0,0 100%,0 100%)}to{clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}}
.ahd-facts{position:absolute;right:var(--gutter);bottom:clamp(2.5rem,6vw,3.5rem);display:flex;gap:var(--s5);color:var(--ink)}
.ahd-facts li{align-items:flex-end;text-align:right}
.ahd-facts li>span:last-child{color:var(--muted)}
.ahd-facts li:nth-child(n+3){display:none}
.ahd-stamp{position:absolute;z-index:2;left:var(--gutter);bottom:-4px;--st:88px;--rot:-9deg}
.ahd-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);padding-block:clamp(1.5rem,5vw,3rem) var(--section-pad)}
.ahd-title{--ah-fs:clamp(2.6rem,5.8vw,5.6rem);line-height:.95}
.ahd-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)}
@media (min-width:960px){
.ahd{display:flex;align-items:center;min-height:min(84vh,780px);min-height:min(84svh,780px)}
.ahd>.adv-wrap{position:relative;z-index:1}
.ahd-art{position:absolute;top:0;right:0;bottom:0;width:50%;height:auto;margin:0}
.ahd-band,.ahd-pic{clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}
.ahd-pic{animation-name:ahd-cut-d}.ahd-band{animation-name:ahd-cut-d}
.ahd-band{transform:translateX(-22px)}
.ahd-facts{right:clamp(2rem,5vw,4rem);bottom:clamp(2rem,6vw,4.5rem);flex-direction:column;gap:var(--s5)}
.ahd-facts li:nth-child(n+3){display:flex}
.ahd-stamp{left:14%;bottom:12%;--st:clamp(100px,9vw,132px)}
.ahd-words{width:48%;padding-block:clamp(4rem,9vw,7rem)}
}

/* masthead */
.ahh{padding-block:clamp(1.25rem,3.5vw,2.5rem) clamp(2.5rem,6vw,4.5rem)}
.ahh-mast{--ah-fs:clamp(3rem,12.5vw,10.5rem);line-height:.88;letter-spacing:-.035em;text-wrap:balance}
.ahh-mast[data-len=m]{--ah-fs:clamp(2.6rem,9vw,7.5rem)}
.ahh-mast[data-len=l]{--ah-fs:clamp(2.2rem,6.4vw,5.25rem);line-height:.95}
.site:lang(hi) .ahh-mast{letter-spacing:0}
.ahh-rule{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s2) var(--s5);margin-top:clamp(.75rem,2vw,1.5rem);padding-block:.7rem;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}
.ahh-issue{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)}
.ahh-body{display:grid;gap:clamp(1.75rem,4vw,3rem);margin-top:clamp(1.5rem,4vw,3rem)}
.ahh-cover{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.ahh-line{--ah-fs:clamp(1.9rem,4.6vw,3.8rem);line-height:1.02;max-width:18ch}
.ahh-cover .hero-sub{max-width:42ch}
.ahh-lines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;margin:var(--s3) 0 0;padding:0;list-style:none;border-top:1px solid var(--line)}
.ahh-lines li{display:flex;flex-direction:column;gap:.25rem;padding:var(--s4) var(--s4) var(--s4) 0;border-bottom:1px solid var(--line)}
.ahh-lines li:nth-child(even){padding-left:var(--s4);border-left:1px solid var(--line)}
.ahh-lines .ah-fig-v{font-size:clamp(1.5rem,2.6vw,2.1rem)}
.ahh-lines li>span:last-child{font-size:var(--t-meta);color:var(--muted);line-height:1.35}
.ahh-no{font-size:11px;font-weight:600;letter-spacing:.12em;color:var(--accent);font-variant-numeric:tabular-nums}
.ahh-fig{margin:0}
.ahh-ph{aspect-ratio:4/5;border-radius:var(--r-img)}
.ahh-fig figcaption{margin-top:var(--s3);padding-top:var(--s2);border-top:1px solid var(--line);font-size:var(--t-meta);color:var(--muted)}
.ahh-good{align-self:start;padding:clamp(1.25rem,3vw,2rem);border:1px solid var(--line);border-radius:var(--r-card);background:var(--accent-soft)}
.ahh-good ul{display:grid;gap:var(--s3);margin:var(--s4) 0 0;padding:0;list-style:none}
.ahh-good li{display:flex;align-items:flex-start;gap:var(--s3);line-height:1.4}
.ahh-good li svg{flex:none;margin-top:.2em;color:var(--accent)}
@media (min-width:900px){.ahh-body:not(.ahh-solo){grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);align-items:start}.ahh-solo .ahh-lines{grid-template-columns:repeat(4,minmax(0,1fr))}.ahh-solo .ahh-lines li:nth-child(even){padding-left:0;border-left:0}}
.site[data-adv] .hero-dark :focus-visible{outline-color:var(--hero-text)}
`;

export const HEROES_NEW_CSS = `
/* kinetic-type */
.ahk{position:relative;isolation:isolate;overflow:hidden;padding-block:clamp(1.5rem,4vw,3.5rem) clamp(2.5rem,6vw,5rem)}
.ahk-head{position:relative;margin-top:clamp(2rem,6vw,5rem)}
.ahk-back{position:absolute;left:calc(var(--gutter)*-1);right:calc(var(--gutter)*-1);top:50%;z-index:-1;transform:translateY(-42%);opacity:.7}
.ahk-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s3) var(--s5);padding-bottom:var(--s4);border-bottom:1px solid var(--ink)}
.ahk-title{--ah-fs:clamp(3rem,10.6vw,9.5rem);line-height:.98;letter-spacing:-.035em;max-width:15ch}
.site:lang(hi) .ahk-title{line-height:1.3}
.ahk-pill{position:relative;display:inline-block;overflow:hidden;vertical-align:-.04em;width:1.5em;height:.72em;margin-inline:.04em;border-radius:999px;background:var(--accent-soft);animation:mo-wipe-left 1.2s cubic-bezier(.7,0,.2,1) backwards;animation-delay:calc(var(--wi,1)*75ms + 280ms)}
.site:lang(hi) .ahk-pill{vertical-align:-.16em;height:.66em}
.ahk-pill .adv-photo{position:absolute;inset:0}
.ahk-pill>.adv-photo{animation:mo-settle 1.8s cubic-bezier(.2,.7,.2,1) backwards;animation-delay:calc(var(--wi,1)*75ms + 280ms)}
.ahk-pill-art{display:inline-grid;place-items:center;color:var(--on-accent);background:var(--accent)}
.ahk-pill-art .mo-art{color:var(--on-accent);background:var(--accent);opacity:.9}
.ahk-pill-art svg{position:relative;width:.4em;height:.4em;stroke:currentColor}
.ahk-pill[data-k="1"]{width:1.15em}
@media (max-width:640px){.ahk-back{display:none}}
.ahk-foot{display:grid;gap:var(--s5);align-items:end;margin-top:clamp(1.75rem,4vw,3.5rem)}
.ahk-foot .hero-sub{max-width:38ch}
.ahk-figs{display:flex;flex-wrap:wrap;gap:var(--s4) clamp(1.5rem,3.5vw,2.75rem)}
.ahk-figs li>span:last-child{color:var(--muted)}
@media (min-width:900px){.ahk-foot{grid-template-columns:minmax(0,1fr) auto auto;gap:clamp(2rem,5vw,4rem)}}
@media (max-width:899px){.ahk-foot .ahk-figs{padding-top:var(--s4);border-top:1px solid var(--line)}}

/* pinned-story: a tall section, a sticky stage; switches chapters as --p moves (usePinProgress). Reduced motion: no pin, in flow. */
.ahn{position:relative;height:300vh;height:300svh;background:var(--hero-ink)}
.ahn-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;isolation:isolate}
.ahn-bgs{position:absolute;inset:0;z-index:-1}
.ahn-bg{position:absolute;inset:0;opacity:0;transition:opacity 1.1s ease}
.ahn-bg>*{position:absolute;inset:0;width:100%;height:100%;transform:scale(calc(1.02 + var(--p,0)*.16));transform-origin:60% 40%}
.ahn[data-ch="0"] .ahn-bg[data-on~="0"],.ahn[data-ch="1"] .ahn-bg[data-on~="1"],.ahn[data-ch="2"] .ahn-bg[data-on~="2"]{opacity:1}
.ahn-scrim{position:absolute;inset:0;background:linear-gradient(to top,color-mix(in srgb,var(--hero-ink) 88%,transparent) 0%,color-mix(in srgb,var(--hero-ink) 52%,transparent) 45%,color-mix(in srgb,var(--hero-ink) 30%,transparent) 100%)}
.ahn-bg .mo-art{background:var(--hero-ink)}
.ahn-inner{position:relative;height:100%}
.ahn-ch{position:absolute;left:var(--gutter);right:var(--gutter);bottom:clamp(4.5rem,11vh,7rem);display:flex;flex-direction:column;align-items:flex-start;gap:var(--s5);opacity:0;transform:translateY(34px);pointer-events:none;visibility:hidden;transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1),visibility 0s .7s}
.ahn[data-ch="0"] .ahn-ch[data-c="0"],.ahn[data-ch="1"] .ahn-ch[data-c="1"],.ahn[data-ch="2"] .ahn-ch[data-c="2"]{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition-delay:.15s,.15s,0s}
.ahn-kick{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.ahn-title{--ah-fs:clamp(3.3rem,10.5vw,9.5rem);line-height:.9;max-width:13ch}
.ahn-big{--ah-fs:clamp(2.2rem,6.6vw,5.6rem);line-height:1;max-width:18ch}
.ahn-end{--ah-fs:clamp(2.4rem,7.4vw,6.4rem);line-height:.95;max-width:14ch}
.ahn-figs{display:flex;flex-wrap:wrap;gap:var(--s6) clamp(2rem,6vw,5rem)}
.ahn-figs .ah-fig-v{font-size:clamp(3rem,9vw,7.5rem)}
.ahn-figs li>span:last-child{font-size:clamp(14px,1.4vw,17px);color:var(--hero-muted)}
.ahn-ch .trust-row{color:var(--hero-muted)}
.ahn-cue{color:var(--hero-muted)}
.ahn-cue i{background:var(--hero-line)}
.ahn-rail{position:absolute;z-index:2;right:clamp(.75rem,2.4vw,2rem);top:50%;transform:translateY(-50%);display:grid;gap:12px;margin:0;padding:0;list-style:none}
.ahn-rail li{width:3px;height:36px;border-radius:2px;background:var(--hero-line);transition:background .4s,height .4s}
.ahn[data-ch="0"] .ahn-rail li[data-i="0"],.ahn[data-ch="1"] .ahn-rail li[data-i="1"],.ahn[data-ch="2"] .ahn-rail li[data-i="2"]{background:var(--hero-text);height:56px}
@media (max-width:640px){.ahn-ch{bottom:5.5rem}.ahn-rail{top:auto;bottom:2.5rem;right:50%;transform:translateX(50%);grid-auto-flow:column}.ahn-rail li{width:36px;height:3px}.ahn[data-ch="0"] .ahn-rail li[data-i="0"],.ahn[data-ch="1"] .ahn-rail li[data-i="1"],.ahn[data-ch="2"] .ahn-rail li[data-i="2"]{height:3px;width:56px}}
@media (prefers-reduced-motion:reduce){
.ahn{height:auto}.ahn-stage{position:relative;height:auto;min-height:min(92svh,860px);padding-block:clamp(6rem,14vw,9rem) clamp(2rem,5vw,4rem);display:block}
.ahn-bg:first-child{opacity:1}.ahn-bg>*{transform:none}
.ahn-inner{height:auto;display:grid;gap:clamp(2rem,5vw,3.5rem)}
.ahn-ch{position:relative;inset:auto;left:auto;right:auto;bottom:auto;opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:none}
.ahn-rail,.ahn-cue{display:none}}
.site[data-motion=none] .ahn{height:auto}.site[data-motion=none] .ahn-stage{position:relative;height:auto;min-height:min(92svh,860px);padding-block:clamp(6rem,14vw,9rem) clamp(2rem,5vw,4rem);display:block}
.site[data-motion=none] .ahn-bg:first-child{opacity:1}.site[data-motion=none] .ahn-bg>*{transform:none}
.site[data-motion=none] .ahn-inner{height:auto;display:grid;gap:clamp(2rem,5vw,3.5rem)}
.site[data-motion=none] .ahn-ch{position:relative;inset:auto;opacity:1;transform:none;visibility:visible;pointer-events:auto}
.site[data-motion=none] .ahn-rail,.site[data-motion=none] .ahn-cue{display:none}
@media print{.ahn{height:auto}.ahn-stage{position:relative;height:auto;padding-block:3rem}.ahn-ch{position:relative;inset:auto;opacity:1;transform:none;visibility:visible}.ahn-rail{display:none}}

/* parallax-collage */
.ahl{position:relative;isolation:isolate;padding-block:clamp(2rem,5vw,4rem) clamp(1.5rem,4vw,3rem);text-align:center}
.ahl-glow{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(55% 50% at 50% 38%,var(--accent-soft),transparent 72%)}
.ahl-inner{position:relative;z-index:2}
.ahl-words{display:flex;flex-direction:column;align-items:center;gap:var(--s5);max-width:62rem;margin-inline:auto}
.ahl-title{--ah-fs:clamp(2.8rem,9.6vw,8.2rem);line-height:.92;max-width:13ch}
.ahl-words .hero-sub{max-width:44ch;text-align:center}
.ahl .hero-ctas{justify-content:center}
.ahl-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--s2) var(--s4)}
.ahl-stage{position:relative;height:clamp(300px,82vw,380px);margin-top:clamp(1.5rem,4vw,2.5rem);pointer-events:none}
.ahl-t{position:absolute;left:var(--pl);top:var(--pt);width:var(--pw);z-index:1}
.ahl-t[data-n="0"]{--pl:3%;--pt:4%;--pw:36%}.ahl-t[data-n="1"]{--pl:60%;--pt:0%;--pw:34%}.ahl-t[data-n="2"]{--pl:30%;--pt:40%;--pw:34%;z-index:2}
.ahl-t[data-n="3"]{--pl:64%;--pt:50%;--pw:32%}.ahl-t[data-n="4"]{--pl:2%;--pt:62%;--pw:24%}
.ahl-f{animation:mo-float 7s ease-in-out infinite;animation-delay:calc(var(--i)*-1.6s)}
.ahl-pic{aspect-ratio:4/5;box-shadow:0 18px 40px rgb(0 0 0/.16)}
.ahl-t[data-n="1"] .ahl-pic{aspect-ratio:1}.ahl-t[data-n="3"] .ahl-pic{aspect-ratio:3/4}.ahl-t[data-n="4"] .ahl-pic{aspect-ratio:1}
.ahl-stat{display:grid;place-content:center;gap:.25rem;aspect-ratio:1;border-radius:50%;background:var(--accent);color:var(--on-accent);text-align:center;padding:12%}
.ahl-stat .ah-fig-v{font-size:clamp(1.5rem,4vw,2.6rem)}
.ahl-stat>span:last-child{font-size:11px;line-height:1.25;opacity:.9}
.ahl-stamp{--st:100%;width:100%}
.ahl-ring{position:relative;display:block;aspect-ratio:1;border-radius:50%;overflow:hidden;border:1.5px solid var(--line)}
.ahl-dot{display:grid;place-items:center;aspect-ratio:1;border-radius:50%;background:var(--ink);color:var(--paper)}
.ahl-t[data-n="4"] .ahl-dot,.ahl-t[data-n="4"] .ahl-stamp{max-width:100%}
@media (min-width:900px){
.ahl{display:flex;align-items:center;min-height:min(92vh,880px);min-height:min(92svh,880px);padding-block:clamp(5rem,9vw,7rem)}
.ahl-inner{width:100%}
.ahl-stage{position:absolute;inset:0;height:auto;margin:0;overflow:hidden;z-index:1}
.ahl-t{left:var(--l);top:var(--t);width:var(--w)}
.ahl-t[data-n="0"]{--l:3%;--t:11%;--w:17%}.ahl-t[data-n="1"]{--l:79%;--t:7%;--w:15%}.ahl-t[data-n="2"]{--l:10%;--t:57%;--w:13.5%}
.ahl-t[data-n="3"]{--l:80%;--t:52%;--w:14%}.ahl-t[data-n="4"]{--l:65%;--t:79%;--w:9.5%}
.ahl-t[data-n="2"],.ahl-t[data-n="3"]{z-index:1}
}
@media (min-width:1500px){.ahl-t[data-n="0"]{--l:6%}.ahl-t[data-n="1"]{--l:78%}.ahl-t[data-n="2"]{--l:12%}.ahl-t[data-n="3"]{--l:79%}}

/* product-spotlight */
.aho{position:relative;isolation:isolate;padding-block:clamp(2rem,5vw,4.5rem) var(--section-pad)}
.aho-glow{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(44% 56% at 76% 46%,var(--accent-soft),transparent 72%)}
.aho-grid{display:grid;gap:clamp(2.5rem,5vw,3rem);align-items:center}
.aho-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s5)}
.aho-title{--ah-fs:clamp(2.8rem,7.4vw,6.6rem);line-height:.94;max-width:11ch}
.aho-words .hero-sub{max-width:38ch}
.aho-meta{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)}
.aho-stage{position:relative;width:100%;max-width:560px;justify-self:center;aspect-ratio:1/1.04}
.aho-disc{position:absolute;left:3%;right:3%;top:0;aspect-ratio:1;border-radius:50%;background:var(--accent-soft);border:1px solid var(--line)}
.aho-disc i{position:absolute;border-radius:50%;border:1px solid var(--line)}
.aho-disc i:nth-child(1){inset:-6%}.aho-disc i:nth-child(2){inset:-13%;opacity:.5}
.aho-pics{position:absolute;left:14%;right:14%;top:9%;height:58%}
.aho-pic{position:absolute;inset:0;overflow:hidden;border-radius:var(--r-tile);box-shadow:0 26px 60px rgb(0 0 0/.22);opacity:0;transform:translateY(22px) rotate(3deg) scale(.96);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
.aho-pic[data-on]{opacity:1;transform:rotate(-2deg)}
.aho-pic .adv-photo{position:absolute;inset:0}
.aho-card{position:absolute;z-index:2;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:.3rem;padding:.95rem 1.2rem 1rem;background:color-mix(in srgb,var(--hero-ink) 86%,transparent)}
.aho-kick{display:flex;justify-content:space-between;margin:0;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--hero-muted)}
.site:lang(hi) .aho-kick{letter-spacing:0;text-transform:none;font-size:12px}
.aho-name{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.2rem,2.2vw,1.6rem);line-height:1.15;color:var(--hero-text)}
.aho-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .7rem;margin:0;font-variant-numeric:tabular-nums;color:var(--hero-text)}
.aho-price b{font-size:1.15rem}.aho-price s{color:var(--hero-muted);font-size:var(--t-meta)}
.aho-price em{font-style:normal;font-size:11px;font-weight:600;padding:.2em .6em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent)}
.aho-act{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .9rem;margin-top:.35rem}
.aho-act .btn-primary,.aho-act .btn-link{min-height:40px;padding-block:.5rem;font-size:14px;display:inline-flex;align-items:center;gap:.4em}
.aho-act .btn-primary{background:var(--hero-text);color:var(--hero-ink)}
.aho-act .btn-link{color:var(--hero-text)}
.aho-act :focus-visible{outline-color:var(--hero-text)}
.aho-dots{position:absolute;z-index:3;right:.6rem;bottom:.7rem;display:flex;gap:0}
.aho-dots button{position:relative;width:24px;height:24px;border:0;background:none;padding:0;cursor:pointer}
.aho-dots button::after{content:"";position:absolute;inset:8px;border-radius:50%;background:transparent;border:1px solid var(--hero-text);opacity:.7;transition:background .3s,transform .3s,opacity .3s}
.aho-dots button[aria-pressed=true]::after{background:var(--hero-text);transform:scale(1.25);opacity:1}
.aho-stamp{position:absolute;z-index:3;top:0;right:0;--rot:10deg}
.aho-solo{position:absolute;left:16%;right:16%;top:4%;bottom:4%}
.aho-list{position:absolute;inset:8%;display:flex;align-items:flex-end;overflow:hidden;border-radius:var(--r-tile)}
.aho-list ol{position:relative;display:grid;width:100%;gap:0;margin:0;padding:clamp(1rem,3vw,1.75rem);list-style:none}
.aho-list li{display:grid;grid-template-columns:2.2rem 1fr auto;align-items:baseline;gap:.5rem;padding-block:.7rem;border-top:1px solid var(--hero-line)}
.aho-list li span{font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--hero-muted)}
.aho-list li b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.1rem,2vw,1.4rem)}
.aho-list li em{font-style:normal;font-size:var(--t-meta);color:var(--hero-muted)}
@media (min-width:900px){.aho-grid{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}.aho-stage{justify-self:end}}
@media (prefers-reduced-motion:reduce){.aho-pic{transition:none}}
`;

export const HEROES_CSS = MOTION_CSS + HEROES_BASE_CSS + HEROES_MORE_CSS + HEROES_NEW_CSS;
