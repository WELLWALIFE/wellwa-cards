"use client";
// The COLLAGE blueprint (docs/website-looks-v3.md §3): built like the home-services and clinic sites of the Oct 2026
// market review — the words on the left with a grid of quick-action tiles under them (WhatsApp, Call, Directions,
// Book, then the first services), and a 2×2 collage of the card's photos on the right; the trust facts under the
// words. On a phone the collage follows the tiles. Without a photo the words and tiles take the width (`collage-ink`).
import { heroModel } from "@/lib/site-hero";
import { sitePhotos, siteServiceNames } from "@/lib/site-photos";
import type { Card } from "@/lib/types";
import type { bentoFacts } from "@/components/site-bento";
import { CtaPair, Display, HeroPhoto, Kicker, Sub, TrustRow } from "@/components/site-smart";
import { Icon, type IconName } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { trackClick } from "@/lib/track";

type Facts = ReturnType<typeof bentoFacts>;
type Tile = { key: string; label: string; icon: IconName; href?: string; external?: boolean; onClick?: () => void };

export function CollageHero({ card, hi, t, onBook, facts }: { card: Card; hi: boolean; t: (s: string) => string; onBook?: (slug: string) => void; facts: Facts | null }) {
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const photos = sitePhotos(card, 4);
  const ink = m.variant === "collage-ink" || photos.length === 0;
  const L = (en: string, h: string) => (hi ? h : t(en));
  const tiles: Tile[] = [];
  if (m.primary.kind === "whatsapp") tiles.push({ key: "wa", label: "WhatsApp", icon: "whatsapp", href: m.primary.href, external: true });
  const call = m.primary.kind === "call" ? m.primary : m.secondary?.kind === "call" ? m.secondary : null;
  if (call) tiles.push({ key: "call", label: L("Call", "कॉल"), icon: "phone", href: call.href });
  if (facts?.map) tiles.push({ key: "map", label: L("Directions", "रास्ता"), icon: "directions", href: facts.map.url, external: true });
  if (facts?.booking) tiles.push({ key: "book", label: L("Book", "बुक करें"), icon: "calendar", onClick: () => onBook?.(facts.booking!.slug) });
  // Service names fill the grid only when they complete it (two rows of four); a half row of ticks reads as filler.
  // A trade's process steps ("1. Message your need") sit among its services in the templates: they are steps, not tiles.
  const names = siteServiceNames(card, 16).filter((x) => !/^\d+\s*[.)]/.test(x.trim())).slice(0, 8 - tiles.length);
  if (tiles.length + names.length >= 8) for (const s of names) tiles.push({ key: `s-${s}`, label: s, icon: "check" });
  const n = Math.min(4, photos.length);
  return (
    <section className="collage" data-variant={ink ? "collage-ink" : "collage"} lang={lang} aria-label={m.name}>
      <div className="collage-wrap">
        <div className="collage-words hero-stagger">
          <Kicker lang={lang}>{t(m.kicker)}</Kicker>
          <Display lang={lang}>{t(m.headline)}</Display>
          <Sub lang={lang}>{t(m.sub)}</Sub>
          {tiles.length >= 4 && (
            <ul className="collage-tiles">
              {tiles.map((x, i) => (
                <li key={x.key} className="tile-in" style={{ ["--i" as string]: i } as React.CSSProperties}>
                  {x.href
                    ? <a href={x.href} {...(x.external ? { target: "_blank", rel: "noreferrer" } : {})} className="collage-tile" onClick={() => trackClick(card.username, `site-tile-${x.key}`)}><i><Icon name={x.icon} size={22} /></i><span>{t(x.label)}</span></a>
                    : x.onClick
                      ? <button type="button" className="collage-tile" onClick={x.onClick}><i><Icon name={x.icon} size={22} /></i><span>{t(x.label)}</span></button>
                      : <span className="collage-tile"><i><Icon name={x.icon} size={22} /></i><span>{t(x.label)}</span></span>}
                </li>
              ))}
            </ul>
          )}
          <TrustRow trust={m.trust} hours={m.hours} hi={hi} />
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="ghost" onBook={onBook} />
        </div>
        {!ink && (
          <div className="collage-grid" data-n={n}>
            {photos.slice(0, n).map((u, i) => (
              <div key={u} className="collage-cell">
                {i === 0 && m.photo?.src === u
                  ? <HeroPhoto photo={m.photo} crop="tile" priority alt={m.name} className="collage-ph-pic" />
                  : <Pic src={u} alt="" className="collage-img" eager={i < 2} sizes="(min-width:1024px) 280px, 50vw" />}
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
.site .collage-wrap{max-width:calc(var(--content) + 2*var(--gutter));margin:0 auto;padding:0 var(--gutter);display:flex;flex-direction:column;gap:var(--s6)}
.site .collage-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.site .collage-words .display{--t-display:clamp(2.25rem,9.5vw,3rem)}
/* The button comes right after the claim, then the proof, then the quick actions (a phone showed the tiles first and the WhatsApp button below the fold). */
.site .collage-words>.hero-ctas{order:3}.site .collage-words>.trust-row{order:4}.site .collage-words>.collage-tiles{order:5}
.site .collage-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3) var(--s2);width:100%;margin:var(--s2) 0 0;padding:var(--s4) var(--s3);list-style:none;border:1px solid var(--line);border-radius:var(--r-card);background:var(--surface)}
.site .collage-tile{display:flex;flex-direction:column;align-items:center;gap:var(--s2);width:100%;text-align:center;font:500 11px/1.2 var(--font-text,var(--look-body));color:var(--ink);text-decoration:none;background:none;border:0;padding:0;cursor:pointer}
.site .collage-tile i{display:grid;place-items:center;width:52px;height:52px;border-radius:var(--r-ctl);background:var(--p-soft);color:var(--accent)}
.site .collage-tile span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site .collage-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);aspect-ratio:1}
.site .collage-cell{position:relative;overflow:hidden;border-radius:var(--r-img);background:var(--paper-2)}
.site .collage-grid[data-n="4"]{grid-template-rows:repeat(5,1fr)}
.site .collage-grid[data-n="4"]>:nth-child(1){grid-row:1/4}
.site .collage-grid[data-n="4"]>:nth-child(2){grid-row:1/3}
.site .collage-grid[data-n="4"]>:nth-child(3){grid-row:4/6}
.site .collage-grid[data-n="4"]>:nth-child(4){grid-row:3/6}
.site .collage-grid[data-n="3"]{grid-template-rows:1fr 1fr}
.site .collage-grid[data-n="3"]>:nth-child(1){grid-row:1/3}
.site .collage-grid[data-n="2"]{aspect-ratio:2/1}
.site .collage-grid[data-n="1"]{grid-template-columns:1fr;aspect-ratio:16/10}
.site .collage-cell .hero-ph-wrap{position:absolute;inset:0}
.site .collage-img,.site .collage-ph-pic{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@media (min-width:1024px){
.site .collage{padding:var(--s8) 0 var(--s8)}
.site .collage-wrap{flex-direction:row;align-items:center;gap:var(--s8)}
.site .collage-words{flex:1 1 50%}
.site .collage-words .display{--t-display:clamp(2.75rem,3.8vw,3.75rem)}
.site .collage-grid{flex:1 1 50%;max-width:560px}
.site .collage-tile i{width:60px;height:60px}.site .collage-tile{font-size:12px}
}
.site .collage .hero-stagger>*{animation-name:hero-in}
`;
