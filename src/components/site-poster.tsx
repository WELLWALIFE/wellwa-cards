"use client";
// Colour Poster pairs a compact colour panel with a full-size photo panel.
import { heroModel } from "@/lib/site-hero";
import { tradeMood } from "@/lib/trade-moods";
import type { Card } from "@/lib/types";
import { CtaPair, Display, HeroPhoto, Kicker, Sub, TrustRow } from "@/components/site-smart";
import { HeroArt, artKind } from "@/components/site-heroart";

export function PosterHero({ card, hi, t, onBook }: { card: Card; hi: boolean; t: (s: string) => string; onBook?: (slug: string) => void }) {
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const luxe = !!tradeMood(card.seo?.categoryKey).luxe;
  const photo = m.photo && m.variant !== "poster-ink" ? m.photo : undefined;
  return (
    <section className="poster hero-dark" data-field={luxe ? "ink" : "accent"} data-photo={photo ? "" : undefined} aria-label={m.name}>
      {!photo && <HeroArt kind={artKind(card.seo?.categoryKey)} tone={luxe ? "gold" : "light"} />}
      <div className="poster-in">
        <div className="poster-copy hero-stagger" lang={lang}>
          <Kicker lang={lang}>{t(m.kicker)}</Kicker>
          <Display lang={lang}>{t(m.headline)}</Display>
          <Sub lang={lang}>{t(m.sub)}</Sub>
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="ghost" onBook={onBook} className="poster-ctas" />
          <TrustRow trust={m.trust} hours={m.hours} hi={hi} className="poster-trust" />
        </div>
        {photo && (
          <figure className="poster-card">
            <HeroPhoto photo={photo} crop="tile" priority className="poster-ph" alt={m.name} />
          </figure>
        )}
      </div>
    </section>
  );
}

export const POSTER_CSS = `
.site .poster{position:relative;overflow:hidden;background:var(--accent);color:var(--on-accent);--hero-text:var(--on-accent)}
.site .poster[data-field=ink]{--hero-text:#fff;background:var(--hero-ink);color:var(--hero-text)}
.site .poster .kicker,.site .poster .trust-row{color:var(--hero-text)}
.site .poster .display{--t-display:clamp(2.35rem,7vw,4.25rem);max-width:16ch;margin-top:var(--s3)}
.site .poster .display[data-len="long"]{--t-display:clamp(2rem,4.6vw,3.5rem);max-width:20ch}
.site .poster .hero-sub{max-width:40ch;margin-top:var(--s4)}
.site .poster-in{position:relative;z-index:1}
.site .poster-copy{min-width:0;padding:clamp(1.75rem,5vw,4.75rem) var(--gutter)}
.site .poster-ctas,.site .poster-trust{margin-top:var(--s5)}
.site .poster-card{margin:0;min-width:0;background:var(--paper-2)}
.site .poster-ph{width:100%;height:100%;min-height:clamp(13rem,54vw,22rem)}
.site .poster-ph img{object-fit:cover}
.site .poster:not([data-photo]) .poster-in{max-width:calc(var(--content) + 2 * var(--gutter));margin-inline:auto}
@media (min-width:850px){
  .site .poster[data-photo] .poster-in{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr)}
  .site .poster[data-photo] .poster-copy{align-self:center;padding-left:max(var(--gutter),calc((100vw - var(--content)) / 2))}
  .site .poster-ph{min-height:clamp(22rem,39vw,36rem)}
}
.site .poster .hero-stagger>*{animation-name:hero-in}
`;
