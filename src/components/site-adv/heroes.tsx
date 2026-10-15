"use client";
// Advanced-site HERO variants. Each is a different composition, not a recolour:
//   split-frame        words on paper, a tall framed photo beside them with an offset block behind it and a floating fact chip
//   full-bleed         the photo edge to edge, an oversized headline low over a scrim, a glass facts bar along the foot
//   editorial-marquee  oversized type on paper, a slow ribbon of the card's facts, a wide photograph under it
//   glass-card         the photo edge to edge, the words on a frosted card, two figures floating on the other side
//   stacked-poster     centred words on the ink field, an arched photograph rising from the bottom edge, a round badge
//   mosaic             a bento of words, photographs and figures that re-forms around what the card has
//   video-first        a short headline row, then a rounded stage for the clip (the photograph when there is none)
//   centered-minimal   a small arch, the claim, one line, two buttons, a ruled row - and a great deal of air
//   diagonal           words left, the photograph cut on a slant to the screen's edge with an accent line along the cut
//   masthead           the business name set as a magazine title, a ruled issue line, the claim as the cover line
// Both read the same hero model (src/lib/site-hero.ts) as the basic site, so the claim, the buttons and the trust row are
// the card's own; with no banner photo each falls to a type-led composition instead of stretching a logo or a product shot.
import { useEffect, useState } from "react";
import { CountUp, CtaPair, HeroPhoto, TrustRow } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Photo, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";

const initialOf = (s: string) => Array.from(s.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|डॉ\.?)\s+/i, "").trim())[0] ?? "";

/* ---------- split-frame ---------- */
export function HeroSplitFrame({ c, x }: VariantProps) {
  const { hm } = c;
  const open = hm.trust.open;
  const book = (slug: string) => (x.goto ? x.goto(slug) : x.jump(slug));
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahs" aria-label={hm.name}>
      <div className="adv-wrap adv-wide ahs-grid">
        <div className="ahs-words hero-stagger">
          <p className="kicker" lang={x.lang}>{x.t(hm.kicker)}</p>
          <h1 className="adv-display" lang={x.lang}>{x.t(hm.headline)}</h1>
          <p className="hero-sub" lang={x.lang}>{x.t(hm.sub)}</p>
          <TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} />
          <CtaPair primary={hm.primary} secondary={hm.secondary} username={x.card.username} onBook={book} />
        </div>
        <div className="ahs-art hero-ph-in">
          <span className="ahs-block" aria-hidden="true" />
          {hm.photo ? (
            <div className="ahs-frame"><HeroPhoto photo={hm.photo} crop="split" priority className="ahs-ph" /></div>
          ) : (
            // No banner: the first letter of the name, large, with the card's own facts under it.
            <div className="ahs-frame ahs-type" aria-hidden="true">
              <span className="ahs-letter">{initialOf(hm.name)}</span>
              <ul>{c.facts.slice(0, 3).map((f, i) => <li key={i}><b>{x.t(f.value)}</b> {x.t(f.label)}</li>)}</ul>
            </div>
          )}
          {(open || hm.trust.rating) && (
            <div className="ahs-chip">
              {hm.trust.rating && <span><Icon name="star" size={14} fill className="hero-star" /> <b>{hm.trust.rating.v.toFixed(1)}</b> <small>({hm.trust.rating.n})</small></span>}
              {open && <span data-state={open.state}><i className="open-dot" aria-hidden="true" />{open.state === "open" ? x.ui("Open now", "अभी खुला") : x.ui("Closed", "बंद")}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- full-bleed ---------- */
export function HeroFullBleed({ c, x }: VariantProps) {
  const { hm } = c;
  const book = (slug: string) => (x.goto ? x.goto(slug) : x.jump(slug));
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahb hero-dark" aria-label={hm.name}>
      {hm.photo
        ? <div className="ahb-photo"><HeroPhoto photo={hm.photo} clip={hm.clip} clipOn="desktop" crop="cover" priority scrim grain kenBurns side="left" className="ahb-ph" /></div>
        : <i aria-hidden="true" className="hero-grain" />}
      <div className="adv-wrap adv-wide ahb-inner">
        <p className="kicker ahb-kicker" lang={x.lang}>{x.t(hm.kicker)}</p>
        <h1 className="adv-display ahb-title" lang={x.lang}>{x.t(hm.headline)}</h1>
        <div className="ahb-foot">
          <div className="ahb-say hero-stagger">
            <p className="hero-sub" lang={x.lang}>{x.t(hm.sub)}</p>
            <CtaPair primary={hm.primary} secondary={hm.secondary} username={x.card.username} secondaryStyle="link" onBook={book} />
          </div>
          {(hm.trust.rating || hm.trust.since || hm.trust.open) && (
            <div className="ahb-facts"><TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} /></div>
          )}
        </div>
      </div>
    </section>
  );
}

const HEROES_BASE_CSS = `
.adv-hero{overflow-x:clip}
.ahs{padding-block:clamp(2rem,6vw,5.5rem) var(--section-pad)}
.ahs-grid{display:grid;gap:clamp(2rem,5vw,3rem);align-items:center}
.ahs-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.ahs-words .hero-sub{max-width:38ch}
.ahs-art{position:relative;width:100%;max-width:540px;justify-self:center;padding:0 4% 4% 0}
.ahs-block{position:absolute;inset:7% 0 0 9%;border-radius:var(--r-tile);background:var(--accent-soft);border:1px solid var(--line)}
.ahs-frame{position:relative;z-index:1;aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.ahs-frame .hero-ph-wrap,.ahs-frame .ahs-ph{width:100%;height:100%}
.ahs-type{display:flex;flex-direction:column;justify-content:space-between;padding:clamp(1.25rem,3vw,2.25rem);background:var(--paper);border:1px solid var(--line)}
.ahs-letter{margin:auto 0;font-family:var(--font-display);font-size:clamp(7rem,22vw,15rem);line-height:.8;color:var(--accent)}
.ahs-type ul{margin:0;padding:0;list-style:none;display:grid;gap:.5rem;font-size:var(--t-meta);color:var(--muted)}
.ahs-type b{display:block;font-family:var(--font-display);font-size:1.5rem;color:var(--ink);font-weight:var(--display-w)}
.ahs-chip{position:absolute;z-index:2;left:-3%;bottom:9%;display:flex;flex-direction:column;gap:.35rem;padding:.7rem 1rem;border-radius:var(--r-card);background:var(--paper);border:1px solid var(--line);box-shadow:var(--e-1);font-size:var(--t-meta);color:var(--muted)}
.ahs-chip b{color:var(--ink)}.ahs-chip span{display:inline-flex;align-items:center;gap:.4em}
@media (min-width:900px){.ahs-grid{grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr)}.ahs-art{justify-self:end}.ahs-chip{left:-9%}}

.ahb{position:relative;display:flex;align-items:flex-end;min-height:min(92svh,860px);isolation:isolate}
.ahb-photo{position:absolute;inset:0;z-index:-1}
.ahb-photo .hero-ph-wrap,.ahb-photo .ahb-ph{width:100%;height:100%}
.ahb-inner{padding-top:clamp(7rem,18vw,12rem);padding-bottom:clamp(1.75rem,4vw,3rem)}
.ahb-kicker{margin-bottom:var(--s4)}
.ahb-title{max-width:14ch;font-size:clamp(3rem,11.5vw,9.5rem);line-height:.92}
.site:lang(hi) .ahb-title{max-width:16ch;font-size:clamp(2.6rem,9vw,7rem)}
.ahb-foot{display:grid;gap:var(--s5);margin-top:clamp(1.5rem,4vw,3rem);padding-top:var(--s5);border-top:1px solid var(--hero-line);align-items:end}
.ahb-say{display:flex;flex-direction:column;gap:var(--s4);align-items:flex-start}
.ahb-facts{justify-self:start;padding:.6rem 1rem;border:1px solid var(--hero-line);border-radius:var(--r-card);background:color-mix(in srgb,var(--hero-ink) 55%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.ahb-facts .trust-row{color:var(--hero-text)}
@media (min-width:900px){.ahb-foot{grid-template-columns:1fr auto}.ahb-facts{justify-self:end}}
`;

/* =====================================================================================================================
   Eight more heroes (owner, 15-16 Oct 2026: every business's layout must be its OWN). Same rules as the two above: the
   copy, the two buttons and the facts come from the hero model / the page content, nothing is invented, and a part the
   card has nothing for is left out - the composition closes up instead of showing a placeholder.
   ===================================================================================================================== */

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

/* ---------- editorial-marquee: oversized type on paper, a slow ribbon of the card's facts, a wide photograph ---------- */
function tickerItems(c: SiteContent): string[] {
  const out: string[] = [];
  for (const r of [c.hm.name, c.hm.kicker, ...c.facts.map((f) => `${f.value} ${f.label}`), ...c.highlights]) {
    const s = (r ?? "").replace(/\s+/g, " ").trim();
    if (s && Array.from(s).length <= 38 && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, 8);
}
export function HeroEditorialMarquee({ c, x }: VariantProps) {
  const { hm } = c;
  const items = tickerItems(c).map((s) => x.t(s));
  // One copy of the ribbon must be wider than the screen, so a short list repeats inside it (the repeats are hidden from readers).
  const row = items.length >= 3 ? Array.from({ length: Math.ceil(8 / items.length) }, () => items).flat() : [];
  const li = (s: string, i: number, hidden: boolean) => <li key={i} aria-hidden={hidden || i >= items.length ? true : undefined} lang={x.lang}>{s}</li>;
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahe" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <div className="ahe-top">
          <Kick c={c} x={x} />
          <TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} />
        </div>
        <div className="hero-stagger">
          <h1 className="ah-title ahe-title" lang={x.lang}>{x.t(hm.headline)}</h1>
          <div className="ahe-row">
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
          </div>
        </div>
      </div>
      {row.length > 0 && (
        <div className="ahe-band">
          <div className="ahe-track">
            <ul className="ahe-copy" aria-label={hm.name}>{row.map((s, i) => li(s, i, false))}</ul>
            <ul className="ahe-copy" aria-hidden="true">{row.map((s, i) => li(s, i, true))}</ul>
          </div>
        </div>
      )}
      {hm.photo && (
        <div className="adv-wrap adv-wide">
          <div className="ahe-photo ah-fill"><HeroPhoto photo={hm.photo} crop="cover" priority /></div>
        </div>
      )}
    </section>
  );
}

/* ---------- glass-card: the photograph edge to edge, the words on a frosted card, two figures beside it ---------- */
export function HeroGlassCard({ c, x }: VariantProps) {
  const { hm } = c;
  const stats = c.facts.slice(0, 2);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahg hero-dark" aria-label={hm.name}>
      <div className="ahg-bg ah-fill" aria-hidden="true">
        {hm.photo
          ? <HeroPhoto photo={hm.photo} crop="cover" priority scrim kenBurns side="center" />
          : <><i className="ahg-glow" /><i className="hero-grain" /></>}
      </div>
      <div className="adv-wrap adv-wide ahg-inner">
        <div className="ahg-card hero-stagger">
          <Kick c={c} x={x} />
          <h1 className="ah-title ahg-title" lang={x.lang}>{x.t(hm.headline)}</h1>
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          {(hm.trust.rating || hm.trust.since || hm.trust.open) && <div className="ahg-meta"><TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} /></div>}
        </div>
        {stats.length >= 2 && (
          <ul className="ahg-stats ah-figs">
            {stats.map((f, i) => <li key={i} className="ahg-stat adv-lift"><CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- stacked-poster: centred words on the ink field, an arched photograph rising from the bottom edge ---------- */
export function HeroStackedPoster({ c, x }: VariantProps) {
  const { hm } = c;
  const { rating, since } = hm.trust;
  const badge = rating
    ? <><b>{rating.v.toFixed(1)}</b><small>★ {rating.n}</small></>
    : since ? (x.hi ? <><b>{since}</b><small>से</small></> : <><small>Since</small><b>{since}</b></>) : null;
  return (
    <section id="adv-hero" data-sec="hero" className={`adv-hero ahp hero-dark ${hm.photo ? "" : "ahp-bare"}`} aria-label={hm.name}>
      <i aria-hidden="true" className="hero-grain" />
      <div className="adv-wrap adv-wide ahp-inner hero-stagger">
        <Kick c={c} x={x} className="ahp-kicker" />
        <h1 className="ah-title ahp-title" lang={x.lang}>{x.t(hm.headline)}</h1>
        <Sub c={c} x={x} />
        <Cta c={c} x={x} />
      </div>
      {hm.photo ? (
        <div className="ahp-stage">
          <div className="ahp-wrap hero-ph-in">
            <div className="ahp-arch ah-fill"><HeroPhoto photo={hm.photo} crop="split" priority /></div>
            {badge && <div className="ahp-badge" aria-hidden="true">{badge}</div>}
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
export function HeroMosaic({ c, x }: VariantProps) {
  const { hm } = c;
  const extras = extraPhotos(c, 4);
  // The main tile is the cover; a card without one lets its first other photo stand in. Side tiles: photos, then figures.
  const main: { cover: true } | { src: string } | null = hm.photo ? { cover: true } : extras.length ? { src: extras.shift()! } : null;
  const sides: MosaicSide[] = extras.slice(0, 2).map((src) => ({ kind: "photo", src }));
  for (let i = 0; sides.length < 2 && i < c.facts.length; i++) sides.push({ kind: "stat", value: c.facts[i].value, label: c.facts[i].label });
  let stats = 0;
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahx" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <div className="ahx-grid" data-l={`m${main ? 1 : 0}s${sides.length}`}>
          <div className="ahx-w hero-stagger">
            <Kick c={c} x={x} />
            <h1 className="ah-title ahx-title" lang={x.lang}>{x.t(hm.headline)}</h1>
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
            <TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} />
          </div>
          {main && (
            <div className="ahx-m ah-fill hero-ph-in">
              {"cover" in main ? <HeroPhoto photo={hm.photo} crop="cover" priority /> : <Photo src={main.src} eager priority />}
            </div>
          )}
          {sides.map((s, i) => s.kind === "photo" ? (
            <div key={i} className={`ahx-s ahx-s${i + 1} hero-ph-in`}><Photo src={s.src} eager sizes="(min-width: 900px) 22vw, 50vw" /></div>
          ) : (
            <div key={i} className={`ahx-stat ahx-s${i + 1} adv-lift hero-ph-in`} data-tone={stats++ % 2 ? "ink" : "accent"}>
              <CountUp value={x.t(s.value)} className="ah-fig-v" /><span>{x.t(s.label)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- video-first: a short headline row, then a rounded stage for the clip (the photograph when there is no clip) ---------- */
export function HeroVideoFirst({ c, x }: VariantProps) {
  const { hm } = c;
  const [play, setPlay] = useState(true);
  // Motion off (reduced motion) shows the poster: the clip is not mounted at all, so it neither plays nor loads.
  useEffect(() => { if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlay(false); }, []);
  // No cover: the clip's own poster, else the page's first other photo, stands as the still.
  const still = hm.photo ? undefined : [hm.clip?.poster ?? "", ...extraPhotos(c, 1)].map((u) => u.trim()).find(isPhoto);
  const clip = hm.clip && play ? hm.clip : undefined;
  const media = !!(hm.photo || hm.clip || still);
  const facts = c.facts.length >= 2;
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahv" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <div className="ahv-head">
          <div className="hero-stagger">
            <Kick c={c} x={x} />
            <h1 className="ah-title ahv-title" lang={x.lang}>{x.t(hm.headline)}</h1>
          </div>
          <div className="ahv-side hero-stagger">
            <Sub c={c} x={x} />
            <Cta c={c} x={x} />
          </div>
        </div>
        {(media || facts) && (
          <div className={`ahv-stage hero-dark ${media ? "ah-fill" : "ahv-bare"}`}>
            {hm.photo || clip
              ? <HeroPhoto photo={hm.photo} clip={clip} clipOn="always" crop="cover" priority scrim kenBurns side="center" />
              : still ? <><Photo src={still} eager priority sizes="100vw" /><div aria-hidden="true" className="hero-scrim" /></>
              : <><i className="ahv-glow" aria-hidden="true" /><i className="hero-grain" aria-hidden="true" /></>}
            {hm.clip && (
              <button type="button" className="ahv-pp" aria-pressed={!play} onClick={() => setPlay(!play)}
                aria-label={play ? x.ui("Pause video", "वीडियो रोकें") : x.ui("Play video", "वीडियो चलाएँ")}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{play ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></> : <path d="M8 5.5v13l11-6.5z" />}</svg>
              </button>
            )}
            {media && (hm.trust.rating || hm.trust.since || hm.trust.open) && <div className="ahv-bar"><div className="ahv-glass"><TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} /></div></div>}
            {!media && <Figures c={c} x={x} max={4} className="ahv-figs" />}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- centered-minimal: nearly nothing - one small arch, the name of the claim, a line, two buttons, a ruled row ---------- */
export function HeroCenteredMinimal({ c, x }: VariantProps) {
  const { hm } = c;
  const hasTrust = !!(hm.trust.rating || hm.trust.since || hm.trust.open);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahc" aria-label={hm.name}>
      <div className="adv-wrap ahc-inner hero-stagger">
        {hm.photo && <div className="ahc-arch ah-fill"><HeroPhoto photo={hm.photo} crop="split" priority /></div>}
        <Kick c={c} x={x} />
        <h1 className="ah-title ahc-title" lang={x.lang}>{x.t(hm.headline)}</h1>
        <hr className="adv-rule" />
        <Sub c={c} x={x} />
        <Cta c={c} x={x} />
        {hasTrust && <div className="ahc-foot"><TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} /></div>}
      </div>
    </section>
  );
}

/* ---------- diagonal: the words on the left, a photograph cut on a slant to the screen's edge, an accent line along the cut ---------- */
export function HeroDiagonal({ c, x }: VariantProps) {
  const { hm } = c;
  const facts = !hm.photo && c.facts.length >= 2 ? c.facts.slice(0, 3) : [];
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahd" aria-label={hm.name}>
      <div className="ahd-art" aria-hidden={facts.length ? undefined : true}>
        <span className="ahd-band" aria-hidden="true" />
        <div className="ahd-pic ah-fill">
          {hm.photo ? <HeroPhoto photo={hm.photo} crop="split" priority /> : facts.length > 0 && (
            <ul className="ahd-facts ah-figs">{facts.map((f, i) => <li key={i}><CountUp value={x.t(f.value)} className="ah-fig-v" /><span>{x.t(f.label)}</span></li>)}</ul>
          )}
        </div>
      </div>
      <div className="adv-wrap adv-wide">
        <div className="ahd-words hero-stagger">
          <Kick c={c} x={x} />
          <h1 className="ah-title ahd-title" lang={x.lang}>{x.t(hm.headline)}</h1>
          <Sub c={c} x={x} />
          <Cta c={c} x={x} />
          <TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} />
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
  const side = !!pic || good.length >= 2;
  const facts = c.facts.slice(0, 4);
  return (
    <section id="adv-hero" data-sec="hero" className="adv-hero ahh" aria-label={hm.name}>
      <div className="adv-wrap adv-wide">
        <h1 className="ah-title ahh-mast hero-ph-in" data-len={lenTier(name)} lang={x.lang}>{name}</h1>
        <div className="ahh-rule">
          <Kick c={c} x={x} />
          <TrustRow trust={hm.trust} hours={hm.hours} hi={x.hi} />
        </div>
        <div className={`ahh-body ${side ? "" : "ahh-solo"}`}>
          <div className="ahh-cover hero-stagger">
            <p className="ah-title ahh-line" lang={x.lang}>{x.t(hm.headline)}</p>
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
            <figure className="ahh-fig hero-ph-in">
              <div className="ahh-ph ah-fill">{pic === "cover" ? <HeroPhoto photo={hm.photo} crop="split" priority /> : <Photo src={pic} eager priority sizes="(min-width: 900px) 40vw, 100vw" />}</div>
              {hm.kicker && <figcaption lang={x.lang}>{x.t(hm.kicker)}</figcaption>}
            </figure>
          )}
          {!pic && good.length >= 2 && (
            <aside className="ahh-good hero-ph-in" aria-label={x.ui("Good to know", "जानने लायक")}>
              <p className="kicker">{x.ui("Good to know", "जानने लायक")}</p>
              <ul>{good.map((g, i) => <li key={i} lang={x.lang}><Icon name="check" size={16} />{x.t(g)}</li>)}</ul>
            </aside>
          )}
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
.ahe-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s2) var(--s5);padding-bottom:var(--s4);border-bottom:1px solid var(--ink)}
.ahe-title{--ah-fs:clamp(2.9rem,10.5vw,8.75rem);line-height:.92;max-width:14ch;margin-top:clamp(1.25rem,3.5vw,2.75rem)}
.ahe-row{display:grid;gap:var(--s5);align-items:end;margin-top:clamp(1.5rem,4vw,3rem)}
.ahe-row .hero-sub{max-width:40ch}
@media (min-width:900px){.ahe-row{grid-template-columns:minmax(0,1fr) auto}.ahe-row .hero-ctas{justify-content:flex-end}}
.ahe-band{margin-top:clamp(2rem,5vw,3.5rem);border-block:1px solid var(--line);overflow:hidden;padding-block:clamp(.7rem,1.6vw,1.15rem);-webkit-mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)}
.ahe-track{display:flex;width:max-content;animation:ahe-slide 56s linear infinite}
.ahe-band:hover .ahe-track{animation-play-state:paused}
.ahe-copy{display:flex;align-items:center;margin:0;padding:0;list-style:none}
.ahe-copy li{display:inline-flex;align-items:center;white-space:nowrap;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.3rem,3vw,2.25rem);line-height:1.2;color:var(--ink)}
.ahe-copy li:nth-child(even){color:var(--accent)}
.ahe-copy li::after{content:"";flex:none;width:.34em;height:.34em;margin-inline:clamp(1.1rem,3vw,2.4rem);background:var(--accent);transform:rotate(45deg)}
.site:lang(hi) .ahe-copy li{font-weight:var(--display-w-hi)}
@keyframes ahe-slide{to{transform:translateX(-50%)}}
.ahe-photo{aspect-ratio:4/3;margin-top:clamp(1.5rem,4vw,3rem);border-radius:var(--r-tile);background:var(--paper-2)}
@media (min-width:700px){.ahe-photo{aspect-ratio:21/9}}
@media (prefers-reduced-motion:reduce){.ahe-track{animation:none;width:auto;flex-wrap:wrap}.ahe-copy[aria-hidden]{display:none}.ahe-copy{flex-wrap:wrap;row-gap:.25rem;padding-inline:var(--gutter)}.ahe-band{-webkit-mask-image:none;mask-image:none}}
.site[data-motion=none] .ahe-track{width:auto;flex-wrap:wrap}.site[data-motion=none] .ahe-copy[aria-hidden]{display:none}.site[data-motion=none] .ahe-copy{flex-wrap:wrap;padding-inline:var(--gutter)}

/* glass-card */
.ahg{position:relative;isolation:isolate;display:flex;align-items:flex-end;min-height:min(86vh,800px);min-height:min(86svh,800px);padding-block:clamp(5rem,12vw,8rem) clamp(1rem,3vw,2.5rem)}
.ahg-bg{position:absolute;inset:0;z-index:-1}
.ahg-glow{position:absolute;inset:0;background:radial-gradient(60% 75% at 82% 18%,color-mix(in srgb,var(--accent) 42%,transparent),transparent 70%),radial-gradient(50% 60% at 8% 100%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 70%)}
.ahg-inner{display:grid;gap:var(--s5);align-items:end}
.ahg-card{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);max-width:36rem;padding:clamp(1.25rem,3vw,2.25rem);border:1px solid var(--hero-line);border-radius:var(--r-tile);background:color-mix(in srgb,var(--hero-ink) 66%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.ahg-card{background:color-mix(in srgb,var(--hero-ink) 90%,transparent)}}
.ahg-title{--ah-fs:clamp(2.3rem,6vw,4.6rem);line-height:.98}
.ahg-card .hero-sub{max-width:36ch}
.ahg-meta{width:100%;padding-top:var(--s4);border-top:1px solid var(--hero-line)}
.ahg-stats{display:none}
.ahg-stat{min-width:11.5rem;padding:var(--s4) var(--s5);border:1px solid var(--hero-line);border-radius:var(--r-card);background:color-mix(in srgb,var(--hero-ink) 58%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.ahg-stat span:last-child{color:var(--hero-muted)}
@media (min-width:900px){.ahg{align-items:center}.ahg-inner{grid-template-columns:minmax(0,36rem) 1fr}.ahg-stats{display:flex;flex-direction:column;gap:var(--s3);align-self:end;justify-self:end}}

/* stacked-poster */
.ahp{position:relative;overflow:hidden;isolation:isolate;padding-top:clamp(2.5rem,6vw,5rem);text-align:center}
.ahp-bare{padding-bottom:clamp(2.5rem,6vw,4.5rem)}
.ahp-inner{display:flex;flex-direction:column;align-items:center;gap:var(--s4)}
.ahp-kicker{display:flex;align-items:center;gap:var(--s4)}
.ahp-kicker::before,.ahp-kicker::after{content:"";width:clamp(24px,6vw,64px);height:1px;background:currentColor;opacity:.4}
.ahp-title{--ah-fs:clamp(2.8rem,9.6vw,7.75rem);line-height:.92;max-width:13ch}
.ahp .hero-sub{max-width:44ch;margin-inline:auto;text-align:center}
.ahp .hero-ctas{justify-content:center}
.ahp-stage{position:relative;display:flex;justify-content:center;height:clamp(250px,38vw,450px);margin-top:clamp(2rem,5vw,3.5rem);overflow:hidden}
.ahp-wrap{position:relative;width:min(78vw,480px);flex:none;margin-top:28px}
.ahp-wrap::before,.ahp-wrap::after{content:"";position:absolute;inset:-14px -14px 0;border:1px solid var(--hero-line);border-bottom:0;border-radius:999px 999px 0 0}
.ahp-wrap::after{inset:-28px -28px 0;opacity:.55}
.ahp-arch{aspect-ratio:3/4;border-radius:999px 999px 0 0;background:var(--paper-2)}
.site[data-shape=sharp] .ahp-wrap::before,.site[data-shape=sharp] .ahp-wrap::after,.site[data-shape=sharp] .ahp-arch{border-radius:var(--r-tile) var(--r-tile) 0 0}
.ahp-badge{position:absolute;z-index:2;right:-5%;top:14%;display:grid;place-content:center;width:clamp(84px,12vw,116px);aspect-ratio:1;border-radius:50%;background:var(--accent);color:var(--on-accent);line-height:1.1;box-shadow:0 10px 30px rgb(0 0 0/.28);transform:rotate(-8deg)}
.ahp-badge b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.4rem,3vw,2rem);line-height:1}
.ahp-badge small{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.site:lang(hi) .ahp-badge small{letter-spacing:0;text-transform:none;font-size:12px}
.ahp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:clamp(2rem,5vw,3.5rem);border-top:1px solid var(--hero-line)}
.ahp-facts li{align-items:center;padding:var(--s5) var(--s3);text-align:center}
.ahp-facts li+li{border-left:1px solid var(--hero-line)}
.ahp-facts li>span:last-child{color:var(--hero-muted)}

/* mosaic */
.ahx{padding-block:clamp(.75rem,2vw,1.5rem) clamp(2rem,5vw,3.5rem)}
.ahx-grid{display:grid;gap:clamp(.5rem,1.2vw,.9rem);grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.ahx-w{grid-area:w;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:var(--s4);padding:clamp(1.5rem,4vw,3.25rem);border:1px solid var(--line);border-radius:var(--r-tile);background:var(--paper-2)}
.ahx-title{--ah-fs:clamp(2.3rem,5.4vw,4.4rem);line-height:.98}
.ahx-m{grid-area:m;aspect-ratio:4/3;border-radius:var(--r-tile);background:var(--paper-2)}
.ahx-s{position:relative;overflow:hidden;aspect-ratio:1;border-radius:var(--r-tile);background:var(--paper-2)}
.ahx-s .adv-photo{position:absolute;inset:0}
.ahx-s1{grid-area:s1}.ahx-s2{grid-area:s2}
.ahx-stat{display:flex;flex-direction:column;justify-content:flex-end;gap:.35rem;aspect-ratio:1;padding:clamp(1rem,2.2vw,1.75rem);border-radius:var(--r-tile);background:var(--accent);color:var(--on-accent)}
.ahx-stat[data-tone=ink]{background:var(--hero-ink);color:var(--hero-text)}
.ahx-stat .ah-fig-v{font-size:clamp(1.9rem,4vw,3.25rem)}
.ahx-stat>span:last-child{font-size:var(--t-meta);line-height:1.35;opacity:.88}
.ahx-grid[data-l=m1s2]{grid-template-areas:"w w" "m m" "s1 s2"}
.ahx-grid[data-l=m1s1]{grid-template-areas:"w w" "m m" "s1 s1"}
.ahx-grid[data-l=m1s0]{grid-template-areas:"w w" "m m"}
.ahx-grid[data-l=m0s2]{grid-template-areas:"w w" "s1 s2"}
.ahx-grid[data-l=m0s1]{grid-template-areas:"w w" "s1 s1"}
.ahx-grid[data-l=m0s0]{grid-template-areas:"w w"}
.ahx-grid[data-l$=s1] .ahx-s,.ahx-grid[data-l$=s1] .ahx-stat{aspect-ratio:16/9}
@media (min-width:900px){
.ahx-grid{grid-auto-rows:minmax(clamp(220px,25vw,320px),auto)}
.ahx-grid[data-l] .ahx-m,.ahx-grid[data-l] .ahx-s,.ahx-grid[data-l] .ahx-stat{aspect-ratio:auto}
.ahx-grid[data-l=m1s2]{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.62fr);grid-template-areas:"w m s1" "w m s2"}
.ahx-grid[data-l=m1s1]{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.62fr);grid-template-areas:"w m s1" "w m s1"}
.ahx-grid[data-l=m1s0]{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-template-areas:"w m";grid-auto-rows:minmax(clamp(380px,40vw,560px),auto)}
.ahx-grid[data-l=m0s2]{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);grid-template-areas:"w s1" "w s2"}
.ahx-grid[data-l=m0s1]{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);grid-template-areas:"w s1";grid-auto-rows:minmax(clamp(380px,40vw,560px),auto)}
.ahx-grid[data-l=m0s0]{grid-template-columns:minmax(0,1fr);grid-template-areas:"w"}
}
@media (hover:hover){.ahx-m:hover .adv-photo,.ahx-m:hover .hero-ph,.ahx-s:hover .adv-photo{transform:scale(1.04)}}

/* video-first */
.ahv{padding-block:clamp(1.25rem,3.5vw,3rem) clamp(1.5rem,4vw,3rem)}
.ahv-head{display:grid;gap:var(--s5);align-items:end;margin-bottom:clamp(1.5rem,3.5vw,2.5rem)}
.ahv-title{--ah-fs:clamp(2.5rem,7vw,5.75rem);line-height:.95;max-width:14ch;margin-top:var(--s4)}
.ahv-side{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
@media (min-width:900px){.ahv-head{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}}
.ahv-stage{position:relative;overflow:hidden;isolation:isolate;aspect-ratio:4/5;border-radius:var(--r-tile)}
@media (min-width:700px){.ahv-stage{aspect-ratio:16/9}}
.ahv-stage>.adv-photo{position:absolute;inset:0}
.ahv-stage.ahv-bare{aspect-ratio:auto;display:flex;align-items:flex-end;padding:clamp(1.5rem,4vw,3rem)}
.ahv-glow{position:absolute;inset:0;background:radial-gradient(70% 90% at 85% 0%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 70%)}
.ahv-figs{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:var(--s5);width:100%}
.ahv-figs li>span:last-child{color:var(--hero-muted)}
.ahv-bar{position:absolute;left:var(--s4);right:var(--s4);bottom:var(--s4);display:flex;justify-content:flex-start}
.ahv-glass{padding:.6rem 1rem;border:1px solid var(--hero-line);border-radius:var(--r-card);background:color-mix(in srgb,var(--hero-ink) 62%,transparent);color:var(--hero-text);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.ahv-glass .trust-row{color:var(--hero-text)}
.ahv-pp{position:absolute;z-index:2;top:var(--s4);right:var(--s4);display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--hero-line);border-radius:50%;background:color-mix(in srgb,var(--hero-ink) 62%,transparent);color:var(--hero-text);cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:background .15s,transform .08s}
.ahv-pp:hover{background:color-mix(in srgb,var(--hero-ink) 85%,transparent)}.ahv-pp:active{transform:scale(.94)}

/* centered-minimal */
.ahc{position:relative;padding-block:clamp(3.5rem,11vw,9rem) clamp(3.5rem,10vw,8rem);text-align:center;background:radial-gradient(62% 55% at 50% 0%,var(--accent-soft),transparent 72%)}
.ahc-inner{display:flex;flex-direction:column;align-items:center;gap:var(--s5);max-width:52rem}
.ahc-arch{flex:none;width:clamp(72px,10vw,104px);aspect-ratio:3/4;border-radius:999px 999px 10px 10px;background:var(--paper-2);box-shadow:0 0 0 6px var(--paper),0 0 0 7px var(--line)}
.site[data-shape=sharp] .ahc-arch{border-radius:var(--r-img)}
.ahc-title{--ah-fs:clamp(2.6rem,8.2vw,6.75rem);line-height:.98;max-width:15ch}
.ahc .hero-sub{max-width:40ch;text-align:center}
.ahc .hero-ctas{justify-content:center}
.ahc-foot{display:flex;justify-content:center;width:min(100%,34rem);padding-top:var(--s5);border-top:1px solid var(--line)}
.ahc-foot .trust-row{justify-content:center}

/* diagonal */
.ahd{position:relative;isolation:isolate;overflow:hidden}
.ahd-art{position:relative;height:clamp(220px,52vw,340px);margin-bottom:14px}
.ahd-band,.ahd-pic{position:absolute;inset:0;clip-path:polygon(0 0,100% 0,100% calc(100% - 34px),0 100%)}
.ahd-band{background:var(--accent);transform:translateY(14px)}
.ahd-pic{background:var(--accent-soft)}
.ahd-facts{position:absolute;right:var(--gutter);bottom:clamp(2.5rem,6vw,3.5rem);display:flex;gap:var(--s5);color:var(--ink)}
.ahd-facts li{align-items:flex-end;text-align:right}
.ahd-facts li>span:last-child{color:var(--muted)}
.ahd-facts li:nth-child(n+3){display:none}
.ahd-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);padding-block:clamp(1.5rem,5vw,3rem) var(--section-pad)}
.ahd-title{--ah-fs:clamp(2.4rem,5.4vw,5rem);line-height:.98}
@media (min-width:960px){
.ahd{display:flex;align-items:center;min-height:min(84vh,780px);min-height:min(84svh,780px)}
.ahd>.adv-wrap{position:relative;z-index:1}
.ahd-art{position:absolute;top:0;right:0;bottom:0;width:50%;height:auto;margin:0}
.ahd-band,.ahd-pic{clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}
.ahd-band{transform:translateX(-22px)}
.ahd-facts{right:clamp(2rem,5vw,4rem);bottom:clamp(2rem,6vw,4.5rem);flex-direction:column;gap:var(--s5)}
.ahd-facts li:nth-child(n+3){display:flex}
.ahd-words{width:48%;padding-block:clamp(4rem,9vw,7rem)}
}

/* masthead */
.ahh{padding-block:clamp(1.25rem,3.5vw,2.5rem) clamp(2.5rem,6vw,4.5rem)}
.ahh-mast{--ah-fs:clamp(3rem,12.5vw,10.25rem);line-height:.88;letter-spacing:-.035em}
.ahh-mast[data-len=m]{--ah-fs:clamp(2.6rem,9vw,7.5rem)}
.ahh-mast[data-len=l]{--ah-fs:clamp(2.2rem,6.4vw,5.25rem);line-height:.95}
.site:lang(hi) .ahh-mast{letter-spacing:0}
.ahh-rule{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s2) var(--s5);margin-top:clamp(.75rem,2vw,1.5rem);padding-block:.7rem;border-top:2px solid var(--ink);border-bottom:1px solid var(--line)}
.ahh-body{display:grid;gap:clamp(1.75rem,4vw,3rem);margin-top:clamp(1.5rem,4vw,3rem)}
.ahh-cover{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.ahh-line{--ah-fs:clamp(1.9rem,4.4vw,3.6rem);line-height:1.02;max-width:18ch}
.ahh-cover .hero-sub{max-width:42ch}
.ahh-lines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;margin:var(--s3) 0 0;padding:0;list-style:none;border-top:1px solid var(--line)}
.ahh-lines li{display:flex;flex-direction:column;gap:.25rem;padding:var(--s4) var(--s4) var(--s4) 0;border-bottom:1px solid var(--line)}
.ahh-lines li:nth-child(even){padding-left:var(--s4);border-left:1px solid var(--line)}
.ahh-lines .ah-fig-v{font-size:clamp(1.5rem,2.6vw,2.1rem)}
.ahh-lines li>span:last-child{font-size:var(--t-meta);color:var(--muted);line-height:1.35}
.ahh-no{font-size:11px;font-weight:600;letter-spacing:.12em;color:var(--accent);font-variant-numeric:tabular-nums}
.ahh-fig{margin:0}
.ahh-ph{aspect-ratio:4/5;border-radius:var(--r-img);background:var(--paper-2)}
.ahh-fig figcaption{margin-top:var(--s3);padding-top:var(--s2);border-top:1px solid var(--line);font-size:var(--t-meta);color:var(--muted)}
.ahh-good{align-self:start;padding:clamp(1.25rem,3vw,2rem);border:1px solid var(--line);border-radius:var(--r-card);background:var(--accent-soft)}
.ahh-good ul{display:grid;gap:var(--s3);margin:var(--s4) 0 0;padding:0;list-style:none}
.ahh-good li{display:flex;align-items:flex-start;gap:var(--s3);line-height:1.4}
.ahh-good li svg{flex:none;margin-top:.2em;color:var(--accent)}
@media (min-width:900px){.ahh-body:not(.ahh-solo){grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);align-items:start}.ahh-solo .ahh-lines{grid-template-columns:repeat(4,minmax(0,1fr))}.ahh-solo .ahh-lines li:nth-child(even){padding-left:0;border-left:0}}
.site[data-adv] .hero-dark :focus-visible{outline-color:var(--hero-text)}
`;

export const HEROES_CSS = HEROES_BASE_CSS + HEROES_MORE_CSS;
