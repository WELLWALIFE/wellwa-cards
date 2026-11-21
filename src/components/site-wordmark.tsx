"use client";
// A masthead for the business, followed by the main claim and a photo strip.
import { heroModel } from "@/lib/site-hero";
import { siteAddress, sitePhotos } from "@/lib/site-photos";
import type { Card } from "@/lib/types";
import { CtaPair, Display, HeroPhoto, Kicker, OpenNowChip, Sub, TrustRow } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { trackClick } from "@/lib/track";
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
  const jump = (href: string) => (e: React.MouseEvent) => { if (href.startsWith("#") && onBook) { e.preventDefault(); onBook(href.slice(1)); } };
  const ext = m.primary.kind === "whatsapp" ? { target: "_blank", rel: "noreferrer" } : {};
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
          {ink && <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="ghost" onBook={onBook} className="mark-ctas" />}
        </div>
      </div>
      {!ink && (
        <div className="mark-strip">
          <div className="mark-ph">
            {m.photo ? <HeroPhoto photo={m.photo} crop="tile" priority alt={m.name} className="mark-ph-pic" /> : <Pic src={lead!} alt="" className="mark-img" eager priority sizes={sizes} />}
          </div>
          {others[0] && <div className="mark-ph"><Pic src={others[0]} alt="" className="mark-img" eager sizes={sizes} /></div>}
          <div className="mark-tile hero-dark">
            <a href={m.primary.href} {...ext} data-kind={m.primary.kind} className="btn-primary hero-cta mark-cta"
              onClick={(e) => { trackClick(card.username, `site-hero-${m.primary.kind}`); jump(m.primary.href)(e); }}>
              <Icon name={m.primary.kind === "whatsapp" ? "whatsapp" : m.primary.kind === "call" ? "phone" : "calendar"} /><span>{t(m.primary.label)}</span>
            </a>
            <div className="mark-tile-foot">
              {m.hours?.length ? <OpenNowChip rows={m.hours} hi={hi} tone="dark" /> : null}
              {address && <p className="mark-addr"><Icon name="pin" /><span>{t(address)}</span></p>}
              {m.secondary && (
                <a href={m.secondary.href} className="mark-sec" onClick={(e) => { trackClick(card.username, `site-hero-${m.secondary!.kind}`); jump(m.secondary!.href)(e); }}>
                  {t(m.secondary.label)} <Icon name="arrow-right" />
                </a>
              )}
            </div>
          </div>
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
.site .mark .mark-claim{--t-display:clamp(2.5rem,8vw,6rem);max-width:16ch}
.site .mark-side .hero-sub{color:var(--muted)}
.site .mark-ink .mark-side .hero-sub{color:var(--hero-text);opacity:.85}
.site .mark-ctas{margin-top:var(--s3)}
.site .mark-strip{margin-top:var(--s6);display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);padding:0 var(--s2)}
.site .mark-strip>:nth-child(3):last-child{grid-column:1/-1;aspect-ratio:2/1}
/* An odd photo out (3 photos, or 1) would sit alone with an empty cell beside it on a phone: it takes the full row instead. */
.site .mark-strip>.mark-ph:nth-child(4):last-child,.site .mark-strip>.mark-ph:first-child:nth-last-child(2){grid-column:1/-1;aspect-ratio:2/1}
.site .mark-strip .mark-tile{grid-column:1/-1;order:-1;min-height:0;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s3) var(--s5)}
.site .mark-strip .mark-tile .mark-tile-foot{flex:1 1 220px}
.site .mark-tile .btn-primary{white-space:nowrap}
.site .mark-ph{position:relative;aspect-ratio:1;overflow:hidden;border-radius:var(--r-img);background:var(--paper-2)}
.site .mark-ph .hero-ph-wrap{position:absolute;inset:0}
.site .mark-ph-pic,.site .mark-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site .mark-tile{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;gap:var(--s4);min-height:100%;padding:var(--s4);border-radius:var(--r-img);background:var(--accent);color:var(--on-accent);--hero-text:var(--on-accent)}
.site .mark-tile .btn-primary{background:var(--paper);color:var(--ink)}
.site .mark-tile .btn-primary svg{color:var(--accent)}
.site .mark-tile-foot{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s2);font-size:var(--t-meta);color:inherit}
.site .mark-addr{margin:0;display:flex;gap:.4em;align-items:flex-start;line-height:1.35;opacity:.92;text-wrap:pretty}
.site .mark-addr span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site .mark-tile .open-chip,.site .mark-tile [data-state]{white-space:nowrap}
.site .mark-addr svg{flex:none;margin-top:.15em}
.site .mark-sec{display:inline-flex;align-items:center;gap:.3em;font-weight:600;color:inherit;text-decoration:underline;text-underline-offset:3px}
@media (min-width:1024px){
.site .mark{padding-top:var(--s8)}
.site .mark-top{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);column-gap:var(--s7);align-items:end}
.site .mark-masthead{grid-column:1/-1}
.site .mark-side{margin-top:0;padding-bottom:var(--s2)}
.site .mark-strip{margin-top:var(--s7);grid-template-columns:repeat(4,1fr);gap:var(--s3);padding:0 var(--s3)}
.site .mark-strip>:nth-child(3):last-child,.site .mark-strip>.mark-ph:nth-child(4):last-child,.site .mark-strip>.mark-ph:first-child:nth-last-child(2){grid-column:auto;aspect-ratio:4/3}
.site .mark-strip .mark-tile{grid-column:auto;order:0;flex-direction:column;align-items:flex-start;justify-content:space-between;min-height:100%}
.site .mark-strip .mark-tile .mark-tile-foot{flex:0 0 auto}
.site .mark-ph{aspect-ratio:4/3}
.site .mark-tile{padding:var(--s5)}
/* Fewer photos than four columns (a cover and one more, or the cover alone): the strip fills the row instead of leaving the right side bare. */
.site .mark-strip:has(>:nth-child(3):last-child){grid-template-columns:repeat(3,1fr)}
.site .mark-strip:has(>:nth-child(2):last-child){grid-template-columns:3fr 2fr}
.site .mark-strip:has(>:nth-child(2):last-child)>.mark-ph{aspect-ratio:3/2}
}
.site .mark .hero-stagger>*{animation-name:hero-in}
`;
