"use client";
// The POSTER look (the third blueprint, key "story" for stored styles): a bold block of the trade's colour with the headline
// set big, the photo as a card that hangs over the edge into the page, and the trust line as its caption. It replaced the
// swipe slides (owner, 6 Oct 2026: "story wala look sahi nahi hai — ye layout hi hata ke dusra koi lagao"): on a phone it
// reads nothing like the Cinematic cover (words over the photo) or the Bento board (paper tiles).
import { heroModel } from "@/lib/site-hero";
import { tradeMood } from "@/lib/trade-moods";
import type { Card } from "@/lib/types";
import { CtaPair, Display, HeroPhoto, Kicker, Sub, TrustRow } from "@/components/site-smart";

export function PosterHero({ card, hi, t, onBook }: { card: Card; hi: boolean; t: (s: string) => string; onBook?: (slug: string) => void }) {
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const luxe = !!tradeMood(card.seo?.categoryKey).luxe;
  const photo = m.photo && m.variant !== "poster-ink" ? m.photo : undefined;
  return (
    <section className="poster hero-dark" data-field={luxe ? "ink" : "accent"} data-photo={photo ? "" : undefined} aria-label={m.name}>
      <div className="poster-in">
        <div className="poster-copy hero-stagger" lang={lang}>
          <Kicker lang={lang}>{m.kicker}</Kicker>
          <Display lang={lang}>{t(m.headline)}</Display>
          <Sub lang={lang}>{t(m.sub)}</Sub>
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="ghost" onBook={onBook} className="poster-ctas" />
          {!photo && <TrustRow trust={m.trust} hours={m.hours} hi={hi} className="poster-trust" />}
        </div>
        {photo && (
          <figure className="poster-card">
            <HeroPhoto photo={photo} crop="tile" priority className="poster-ph" alt={m.name} />
            <figcaption><TrustRow trust={m.trust} hours={m.hours} hi={hi} /></figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}

export const POSTER_CSS = `
.site .poster{position:relative;background:var(--accent);color:var(--on-accent);--hero-text:var(--on-accent);padding:calc(28px + env(safe-area-inset-top,0px)) var(--gutter,20px) 0}
.site .poster[data-field=ink]{background:var(--hero-ink);color:var(--hero-text)}
.site .poster[data-field=ink] .kicker{color:var(--gold,var(--accent))}
.site .poster .kicker{color:var(--hero-text);opacity:.8}
.site .poster .display{--t-display:clamp(2.75rem,12vw,3.5rem);max-width:12ch}
.site .poster .hero-sub{max-width:34ch;opacity:.9;margin-top:var(--s4,16px)}
.site .poster-ctas{margin-top:var(--s5,24px)}
.site .poster-trust{margin-top:var(--s5,24px);padding-bottom:var(--s7,48px)}
/* the photo card hangs over the bottom edge of the colour block into the page below */
.site .poster-card{position:relative;z-index:1;margin:var(--s5,24px) 0 0;transform:translateY(var(--s7,48px))}
.site .poster[data-photo]{margin-bottom:calc(var(--s7,48px) + 64px)}
.site .poster-ph{aspect-ratio:4/3;border-radius:var(--r-tile);overflow:hidden;box-shadow:0 24px 48px -24px rgb(0 0 0/.45)}
.site .poster-ph img{width:100%;height:100%;object-fit:cover;display:block}
.site .poster-card figcaption{margin-top:var(--s4,16px)}
.site .poster-card figcaption .trust-row{color:var(--muted)}
@media (min-width:1024px){
  .site .poster{padding:0 var(--gutter,64px)}
  .site .poster-in{max-width:var(--content,1120px);margin:0 auto;display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:64px;align-items:end;min-height:76vh}
  .site .poster-copy{padding:96px 0 80px}
  .site .poster .display{--t-display:clamp(4rem,5.6vw,5.5rem);max-width:12ch}
  .site .poster-card{margin:0;transform:translateY(96px)}
  .site .poster[data-photo]{margin-bottom:112px}
  .site .poster-ph{aspect-ratio:5/4;box-shadow:16px 16px 0 0 var(--paper),0 32px 64px -32px rgb(0 0 0/.5)}
  .site .poster-trust{padding-bottom:0}
}
.site .poster .hero-stagger>*{animation-name:hero-in}
`;
