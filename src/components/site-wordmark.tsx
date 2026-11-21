"use client";
// A masthead for the business, followed by the main claim and a photo strip.
import { heroModel } from "@/lib/site-hero";
import { siteAddress, sitePhotos } from "@/lib/site-photos";
import type { Card } from "@/lib/types";
import { CtaPair, Display, HeroPhoto, Kicker, Sub, TrustRow } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { HeroArt, artKind } from "@/components/site-heroart";

export function WordmarkHero({ card, hi, t, onBook }: { card: Card; hi: boolean; t: (s: string) => string; onBook?: (slug: string) => void }) {
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const photos = sitePhotos(card, 6);
  const ink = m.variant === "mark-ink" || photos.length === 0;
  const cover = m.photo?.src;
  const others = photos.filter((u) => u !== cover);
  const lead = cover ? null : others.shift() ?? null;   // no cover: the first other photo leads the strip
  const address = siteAddress(card);
  const name = t(m.name);
  const sizes = "(min-width:1024px) 25vw, 50vw";
  return (
    <section className={`mark ${ink ? "hero-dark mark-ink" : ""}`} data-variant={ink ? "mark-ink" : "mark"} lang={lang} aria-label={m.name}>
      {ink && <HeroArt kind={artKind(card.seo?.categoryKey)} />}
      <div className="mark-top hero-stagger">
        <div className="mark-masthead">
          <p className="mark-name">{name}</p>
          <Kicker lang={lang}>{t(m.kicker)}</Kicker>
        </div>
        <Display className="mark-claim" lang={lang}>{t(m.headline)}</Display>
        <div className="mark-side">
          <Sub lang={lang}>{t(m.sub)}</Sub>
          <TrustRow trust={m.trust} hours={m.hours} hi={hi} />
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="link" onBook={onBook} className="mark-ctas" />
          {address && <p className="mark-addr"><Icon name="pin" /><span>{t(address)}</span></p>}
        </div>
      </div>
      {!ink && (
        <div className="mark-strip">
          <div className="mark-ph">
            {m.photo ? <HeroPhoto photo={m.photo} crop="tile" priority alt={m.name} className="mark-ph-pic" /> : <Pic src={lead!} alt="" className="mark-img" eager priority sizes={sizes} />}
          </div>
          {others[0] && <div className="mark-ph"><Pic src={others[0]} alt="" className="mark-img" eager sizes={sizes} /></div>}
          {others[1] && <div className="mark-ph"><Pic src={others[1]} alt="" className="mark-img" sizes={sizes} /></div>}
        </div>
      )}
    </section>
  );
}

export const WORDMARK_CSS = `
.site .mark{position:relative;background:var(--paper);color:var(--ink);padding:calc(var(--s7) + env(safe-area-inset-top,0px)) 0 var(--s4)}
.site .mark-ink{background:var(--hero-ink);color:var(--hero-text);padding-bottom:var(--s8);overflow:hidden}
.site .mark-ink .mark-top{position:relative;z-index:1}
.site .mark-top{max-width:calc(var(--content) + 2*var(--gutter));margin:0 auto;padding:0 var(--gutter)}
.site .mark-masthead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--s2) var(--s5);padding-bottom:var(--s4);border-bottom:1px solid var(--line);margin-bottom:var(--s5)}
.site .mark-name{font-family:var(--font-display,var(--look-head));font-size:clamp(1.125rem,3vw,1.65rem);line-height:1.2;font-weight:var(--head-w,700);overflow-wrap:anywhere}
.site .mark-side{margin-top:var(--s4);display:flex;flex-direction:column;align-items:flex-start;gap:var(--s3)}
.site .mark .mark-claim{--t-display:clamp(2.5rem,7vw,5.5rem);max-width:18ch}
.site .mark .mark-claim[data-len="long"]{--t-display:clamp(2.25rem,5.3vw,4.25rem);max-width:20ch}
.site .mark-side .hero-sub{color:var(--muted)}
.site .mark-ink .mark-side .hero-sub{color:var(--hero-text);opacity:.85}
.site .mark-ctas{margin-top:var(--s3)}
.site .mark-strip{margin-top:var(--s6);display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);padding:0 var(--s2)}
.site .mark-strip>.mark-ph:only-child,.site .mark-strip>.mark-ph:nth-child(3):last-child{grid-column:1/-1;aspect-ratio:2/1}
.site .mark-ph{position:relative;aspect-ratio:1;overflow:hidden;border-radius:var(--r-img);background:var(--paper-2)}
.site .mark-ph .hero-ph-wrap{position:absolute;inset:0}
.site .mark-ph-pic,.site .mark-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site .mark-addr{margin:0;display:flex;gap:.4em;align-items:flex-start;line-height:1.35;color:var(--muted);font-size:var(--t-meta)}
.site .mark-ink .mark-addr{color:var(--hero-text)}
.site .mark-addr svg{flex:none;margin-top:.15em}
@media (min-width:1024px){
.site .mark{padding-top:var(--s8)}
.site .mark-top{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);column-gap:var(--s7);align-items:end}
.site .mark-masthead{grid-column:1/-1}
.site .mark-side{margin-top:0;padding-bottom:var(--s2)}
.site .mark-strip{margin-top:var(--s7);grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s3);padding:0 var(--s3)}
.site .mark-strip>.mark-ph:nth-child(3):last-child{grid-column:auto;aspect-ratio:16/10}
.site .mark-ph{aspect-ratio:16/10}
.site .mark-strip:has(>:nth-child(2):last-child){grid-template-columns:repeat(2,minmax(0,1fr))}
.site .mark-strip:has(>:only-child){grid-template-columns:minmax(0,1fr)}
.site .mark-strip>.mark-ph:only-child{aspect-ratio:3/1}
}
.site .mark .hero-stagger>*{animation-name:hero-in}
`;
