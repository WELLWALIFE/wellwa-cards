"use client";
// A lead image with two supporting frames and a single set of actions.
import { heroModel } from "@/lib/site-hero";
import { sitePhotos } from "@/lib/site-photos";
import type { Card } from "@/lib/types";
import type { bentoFacts } from "@/components/site-bento";
import { CtaPair, Display, HeroPhoto, Kicker, Sub, TrustRow } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { trackClick } from "@/lib/track";
import { HeroArt, artKind } from "@/components/site-heroart";

type Facts = ReturnType<typeof bentoFacts>;
export function CollageHero({ card, hi, t, onBook, facts }: { card: Card; hi: boolean; t: (s: string) => string; onBook?: (slug: string) => void; facts: Facts | null }) {
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const cover = m.photo?.src;
  const photos = [...new Set([...(cover ? [cover] : []), ...sitePhotos(card, 3)])].slice(0, 3);
  const ink = photos.length === 0 || card.site?.style?.heroVariant === "collage-ink";
  const map = facts?.map;
  const book = facts?.booking?.slug;
  const bookHref = book && `#${book}`;
  const extraBooking = bookHref && m.primary.href !== bookHref && m.secondary?.href !== bookHref;
  return (
    <section className="collage" data-variant={ink ? "collage-ink" : "collage"} lang={lang} aria-label={m.name}>
      {ink && <HeroArt kind={artKind(card.seo?.categoryKey)} tone="dark" />}
      <div className="collage-wrap">
        <div className="collage-words hero-stagger">
          <Kicker lang={lang}>{t(m.kicker)}</Kicker>
          <Display lang={lang}>{t(m.headline)}</Display>
          <Sub lang={lang}>{t(m.sub)}</Sub>
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="ghost" onBook={onBook} />
          <TrustRow trust={m.trust} hours={m.hours} hi={hi} />
          {(map || extraBooking) && (
            <div className="collage-links">
              {map && <a href={map.url} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-tile-map")}><Icon name="directions" size={18} />{hi ? "रास्ता" : t("Directions")}</a>}
              {extraBooking && <a href={bookHref} onClick={(event) => {
                if (onBook && book) { event.preventDefault(); onBook(book); }
              }}><Icon name="calendar" size={18} />{hi ? "बुक करें" : t("Book")}</a>}
            </div>
          )}
        </div>
        {!ink && (
          <div className="collage-grid" data-n={photos.length}>
            {photos.map((u, i) => (
              <div key={u} className="collage-cell">
                {i === 0 && m.photo?.src === u
                  ? <HeroPhoto photo={m.photo} crop="tile" priority alt={m.name} className="collage-ph-pic" />
                  : <Pic src={u} alt="" className="collage-img" eager sizes={i === 0 ? "(min-width:1024px) 35vw, 85vw" : "(min-width:1024px) 16vw, 35vw"} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const COLLAGE_CSS = `
.site .collage{background:var(--paper);color:var(--ink);padding:calc(var(--s6) + env(safe-area-inset-top,0px)) 0 var(--s7)}
.site .collage[data-variant=collage-ink]{position:relative;overflow:hidden}
.site .collage[data-variant=collage-ink] .hart{--hart-ink:var(--accent)}
@media (max-width:1023px){.site .collage[data-variant=collage-ink] .hart{display:none}}
@media (min-width:1024px){.site .collage[data-variant=collage-ink] .hart{right:max(3%,calc(50% - var(--content) / 2 - var(--gutter) / 2));width:min(30vw,400px)}.site .collage[data-variant=collage-ink] .collage-words{flex:0 1 58%;max-width:58%}}
.site .collage[data-variant=collage-ink] .collage-wrap{position:relative;z-index:1}
.site .collage-wrap{max-width:calc(var(--content) + 2*var(--gutter));margin:0 auto;padding:0 var(--gutter);display:flex;flex-direction:column;gap:var(--s6)}
.site .collage-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.site .collage-words .display{--t-display:clamp(2.25rem,9.5vw,3rem)}
.site .collage-links{display:flex;flex-wrap:wrap;gap:var(--s4)}
.site .collage-links a{display:inline-flex;align-items:center;gap:.5rem;min-height:44px;color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.site .collage-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-rows:1fr;gap:var(--s2);aspect-ratio:3/2}
.site .collage-cell{position:relative;min-width:0;overflow:hidden;border-radius:var(--r-img);background:var(--paper-2)}
.site .collage-grid[data-n="3"]{grid-template-rows:1fr 1fr}
.site .collage-grid[data-n="3"]>:first-child{grid-row:1/3}
.site .collage-grid[data-n="1"]{grid-template-columns:1fr;aspect-ratio:16/10}
.site .collage-cell .hero-ph-wrap{position:absolute;inset:0}
.site .collage-img,.site .collage-ph-pic{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@media (min-width:1024px){
.site .collage{padding:var(--s8) 0 var(--s8)}
.site .collage-wrap{flex-direction:row;align-items:center;gap:var(--s8)}
.site .collage-words{flex:1 1 50%}
.site .collage-words .display{--t-display:clamp(2.75rem,3.8vw,3.75rem)}
.site .collage-grid{flex:1 1 50%;max-width:560px}
}
.site .collage .hero-stagger>*{animation-name:hero-in}
`;
