"use client";
// The Bento blueprint's hero (docs/premium-look.md §3.3): a calm paper board. The brand block leads — kicker,
// headline, one line of benefit, a quiet trust row, one filled button and one plain one — then the photo tile,
// cropped and unwashed, then short strip tiles for what the shop has: open now, the map, an offer, booking.
// Everything it says comes from heroModel() (src/lib/site-hero.ts); the owner's tile toggles (site.hero.tiles,
// TILE_KEYS) still decide what is drawn: `since`/`rating` fold into the trust row, `contact` is the CTA row.
//
// Phone: a flex column (a flowing brand block cannot share fixed grid rows) — brand · CTA 56 px · 2-col strips 96 px
// · photo 4:5 lazy below the fold, so the LCP is the H1. Desktop: 12 columns × 120 px rows, 16 px gap — brand 5×3
// (paper, no border) + photo 7×3, four 3×1 strips, products 12×2 with real thumbnails. Flat `--paper` tiles with a
// 1 px line (`--elev: line`), `--r-tile`; no glass, blur, aurora, gradients, chips or emoji. Variants: `board`,
// `board-statement` (no photo: brand 12×3, a hairline under the kicker), `board-ink` (dark brand tile).
import { useMemo } from "react";
import type { Card, CardBlock, ProductItem } from "@/lib/types";
import { TILE_KEYS, type TileKey } from "@/lib/site-blueprints";
import { heroModel, type HeroModel } from "@/lib/site-hero";
import { Kicker, Display, Sub, TrustRow, HeroPhoto, useOpenNow } from "@/components/site-smart";
import { Icon, type IconName } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { trackClick } from "@/lib/track";
import { safeMapUrl } from "@/components/card-view";

export type BentoInput = {
  card: Card;
  hi: boolean;
  t: (s: string) => string;
  /** Legacy: the hero photo and clip are read from heroModel() now (card.coverUrl only); these are ignored. */
  photo?: string; clip?: { url: string; poster?: string };
  focus?: string;
  phone?: string; wa?: string; waHref: (text?: string) => string;
  hours?: { day: string; time: string }[];
  rating?: { avg: number; count: number };
  map?: { address: string; url: string };
  offer?: Extract<CardBlock, { kind: "offer" }>;
  product?: ProductItem; onProduct?: (p: ProductItem) => void;
  since?: number;
  booking?: { slug: string } | null; go: (slug: string) => void;
  eyebrow?: string; logo?: string;
  /** Legacy: the hero has no chips any more (§5); the facilities live in the "good to know" strip. */ pills?: string[];
  darkPage: boolean;
};

/** Which tiles this card can fill, in the owner's (or default) order. `photo` is the card's cover photograph (the
 *  one hero picture, heroModel); `since` and `rating` are trust-row facts; `contact` is the CTA row. */
export function bentoTiles(i: BentoInput): TileKey[] {
  const m = heroModel(i.card, i.hi ? "hi" : "en");
  const can: Record<TileKey, boolean> = {
    photo: !!m.photo, name: true, contact: !!(i.phone || i.wa), open: !!i.hours?.length, rating: !!m.trust.rating,
    map: !!i.map, offer: !!i.offer?.text, product: productThumbs(i.card).length >= 2, since: !!m.trust.since, booking: !!i.booking,
  };
  const order = (i.card.site?.hero?.tiles?.length ? i.card.site.hero.tiles : [...TILE_KEYS]) as TileKey[];
  const out = order.filter((k) => can[k]);
  if (!out.includes("name")) out.unshift("name");
  return out;
}

/** The first four products that have a real picture — the desktop products row draws nothing else (§3.3). */
function productThumbs(card: Card): { item: ProductItem; img: string }[] {
  const out: { item: ProductItem; img: string }[] = [];
  for (const p of card.pages.filter((pg) => !pg.hidden).flatMap((pg) => pg.blocks).flatMap((b) => (b.kind === "product" ? b.items : []))) {
    const img = (p.images?.[0] ?? p.imageUrl ?? "").trim();
    if (img && (p.name ?? "").trim()) out.push({ item: p, img });
    if (out.length === 4) break;
  }
  return out;
}

/** "Main market, Rewari" → "Main market": the kicker already names the city, and the strip is narrow on a phone. */
function dropCity(address: string, city: string): string {
  const a = address.trim(), c = city.trim().toLowerCase();
  if (c && a.toLowerCase().endsWith(c)) return a.slice(0, a.length - c.length).replace(/[\s,،-]+$/, "").trim() || a;
  return a;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const ctaIcon = (kind: "whatsapp" | "call" | "book"): IconName => (kind === "whatsapp" ? "whatsapp" : kind === "call" ? "phone" : "calendar");

export function BentoHero(i: BentoInput) {
  const { card, hi, t } = i;
  const lang = hi ? "hi" : "en";
  const m = useMemo(() => heroModel(card, lang), [card, lang]);
  const tiles = bentoTiles(i);
  const has = (k: TileKey) => tiles.includes(k);
  const openTile = has("open") && !!m.hours?.length;
  const open = useOpenNow(openTile ? m.hours : undefined);

  // The trust row carries the rating and the Est. year (each behind its toggle) and the open state only when the
  // open tile is off — a fact is said once on screen one.
  const trust: HeroModel["trust"] = {
    ...(has("rating") && m.trust.rating ? { rating: m.trust.rating } : {}),
    ...(has("since") && m.trust.since ? { since: m.trust.since } : {}),
    ...(!openTile && m.trust.open ? { open: m.trust.open } : {}),
  };
  const ink = m.variant === "board-ink";
  const photo = has("photo") ? m.photo : undefined;
  const statement = !photo;
  const products = has("product") ? productThumbs(card) : [];

  type Strip = "open" | "map" | "offer" | "booking";
  const strips: Strip[] = [];
  if (openTile) strips.push("open");
  if (has("map") && i.map) strips.push("map");
  if (has("offer") && i.offer?.text) strips.push("offer");
  if (has("booking") && i.booking) strips.push("booking");
  const span = strips.length ? Math.max(3, Math.floor(12 / strips.length)) : 12;

  const label = (en: string, h: string) => (hi ? h : t(en));
  const address = dropCity(i.map?.address ?? "", card.seo?.city ?? "");
  const onBook = (href: string) => (e: React.MouseEvent) => { if (href.startsWith("#")) { e.preventDefault(); i.go(href.slice(1)); } };
  const ext = (kind: string) => (kind === "whatsapp" ? { target: "_blank", rel: "noreferrer" } : {});
  // Tiles enter 40 ms apart (.tile-in, globals.css): the photo first, then the strips, then the products.
  let n = 0;
  const tileStyle = (extra: Record<string, number> = {}) => ({ ["--i" as string]: ++n, ...extra } as React.CSSProperties);

  return (
    <section className="board" data-variant={statement ? (ink ? "board-ink" : "board-statement") : m.variant} lang={lang} aria-label={m.name}>
      <div className="board-wrap">
        <div className="board-grid" data-photo={photo ? "" : undefined}>

          {/* ---- brand block: kicker → H1 → sub → trust → CTAs (§3.1); flows, never clips ---- */}
          <div className={`board-brand hero-stagger ${ink ? "hero-dark" : ""}`}>
            <Kicker lang={lang}>{t(m.kicker)}</Kicker>
            {statement && <i aria-hidden="true" className="board-rule" />}
            <Display lang={lang}>{t(m.headline)}</Display>
            <Sub lang={lang}>{t(m.sub)}</Sub>
            <TrustRow trust={trust} hours={!openTile ? m.hours : undefined} hi={hi} />
            {has("contact") && (
              <div className="board-ctas hero-ctas">
                <a href={m.primary.href} {...ext(m.primary.kind)} data-kind={m.primary.kind} className={`btn-primary hero-cta board-cta ${FOCUS}`}
                  onClick={(e) => { trackClick(card.username, `site-hero-${m.primary.kind}`); onBook(m.primary.href)(e); }}>
                  <Icon name={ctaIcon(m.primary.kind)} /><span>{t(m.primary.label)}</span><Icon name="arrow-right" className="board-cta-arrow" />
                </a>
                {m.secondary && (
                  <a href={m.secondary.href} data-kind={m.secondary.kind} className={`btn-ghost hero-cta board-cta ${FOCUS}`} aria-label={m.secondary.label}
                    onClick={(e) => { trackClick(card.username, `site-hero-${m.secondary!.kind}`); onBook(m.secondary!.href)(e); }}>
                    <Icon name={ctaIcon(m.secondary.kind)} />
                    <span className="board-cta-long">{t(m.secondary.label)}</span>
                    <span className="board-cta-short">{m.secondary.kind === "call" ? label("Call", "कॉल") : label("Book", "बुक करें")}</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ---- photo tile: the cover, cropped to the subject, no scrim; lazy (below the fold on a phone). A trade
               banner (/api/stock/banners, 1600×600) is a poster: grey frame on top, white fade on the left — the
               tile zooms into its right half so only the photograph shows. ---- */}
          {photo && (
            <div className="board-tile board-photo tile-in" style={tileStyle()} data-banner={photo.src.startsWith("/api/stock/banners/") ? "" : undefined}>
              <HeroPhoto photo={photo} crop="tile" lazy alt="" className="board-photo-pic" />
            </div>
          )}

          {/* ---- strips: one short fact each — 96 px, two up on a phone; one row on a desktop ---- */}
          {strips.map((k, j) => {
            const style = tileStyle({ "--span": span });
            // An odd last strip takes the whole row on a phone.
            const wide = j === strips.length - 1 && strips.length % 2 === 1 ? "" : undefined;
            switch (k) {
              case "open": return (
                <div key={k} style={style} data-wide={wide} className="s-card board-tile board-strip tile-in" aria-live="polite" data-state={open?.state}>
                  <p className="board-strip-head"><i aria-hidden="true" className="open-dot" />{!open ? label("Timings", "समय") : open.state === "open" ? label("Open now", "अभी खुला है") : label("Closed", "अभी बंद")}</p>
                  <p className="board-strip-meta">{open ? (hi ? open.noteHi : open.note) : m.hours?.[0]?.time ?? ""}</p>
                </div>
              );
              case "map": return (
                <a key={k} style={style} data-wide={wide} href={i.map!.url} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-hero-map")} className={`s-card board-tile board-strip board-link tile-in ${FOCUS}`}>
                  <p className="board-strip-head"><Icon name="pin" className="board-strip-ic" /><span className="board-clamp">{t(address) || label("Find us on the map", "Map पर देखें")}</span></p>
                  <p className="board-strip-meta board-strip-go">{label("Directions", "रास्ता")} <Icon name="arrow-up-right" size={13} /></p>
                </a>
              );
              case "offer": return (
                <div key={k} style={style} data-wide={wide} className="s-card board-tile board-strip tile-in">
                  <p className="board-strip-head"><Icon name="tag" className="board-strip-ic" /><span className="board-clamp">{t(i.offer!.text)}</span></p>
                  <p className="board-strip-meta">{i.offer!.code ? <>{label("Code", "कोड")} <b className="board-code">{i.offer!.code}</b></> : t(i.offer!.title || label("Offer", "ऑफ़र"))}</p>
                </div>
              );
              case "booking": return (
                <button key={k} style={style} data-wide={wide} type="button" onClick={() => i.go(i.booking!.slug)} className={`s-card board-tile board-strip board-link tile-in ${FOCUS}`}>
                  <p className="board-strip-head"><Icon name="calendar" className="board-strip-ic" /><span className="board-clamp">{label("Book an appointment", "अपॉइंटमेंट लें")}</span></p>
                  <p className="board-strip-meta board-strip-go">{label("Pick a time", "समय चुनें")} <Icon name="arrow-right" size={13} /></p>
                </button>
              );
              default: return null;
            }
          })}

          {/* ---- products: desktop only, real thumbnails 1:1, name · ₹ ---- */}
          {products.length >= 2 && (
            <div className="board-products tile-in" style={tileStyle({ "--cols": products.length })}>
              {products.map(({ item: p, img }, j) => (
                <button key={j} type="button" onClick={() => i.onProduct?.(p)} className={`s-card board-tile board-product ${FOCUS}`}>
                  <span className="board-thumb"><Pic src={img} alt={p.name} className="board-thumb-img" sizes="(min-width: 1024px) 25vw, 50vw" /></span>
                  <span className="board-product-row"><span className="board-clamp-1">{t(p.name)}</span>{(p.price || p.mrp) && <b>{p.price || p.mrp}</b>}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** What the bento hero needs, read off the card once (pure). */
export function bentoFacts(card: Card): { rating?: { avg: number; count: number }; map?: { address: string; url: string }; offer?: Extract<CardBlock, { kind: "offer" }>; product?: ProductItem; booking: { slug: string } | null; clip?: { url: string; poster?: string } } {
  const pages = card.pages.filter((p) => !p.hidden);
  const blocks = pages.flatMap((p) => p.blocks);
  const reviews = blocks.flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim());
  const rating = reviews.length ? { avg: reviews.reduce((s, x) => s + (Number(x.rating) || 0), 0) / reviews.length, count: reviews.length } : undefined;
  const loc = blocks.find((b): b is Extract<CardBlock, { kind: "location" }> => b.kind === "location" && (!!(b.address ?? "").trim() || !!b.mapUrl));
  const mapUrl = loc ? safeMapUrl(loc.mapUrl) : "";
  const address = (loc?.address ?? "").trim();
  const map = loc ? { address, url: mapUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}` } : undefined;
  const offer = blocks.find((b): b is Extract<CardBlock, { kind: "offer" }> => b.kind === "offer" && !!(b.text ?? "").trim());
  const product = blocks.flatMap((b) => (b.kind === "product" ? b.items : [])).find((p) => (p.name ?? "").trim());
  const bookingPage = pages.find((p) => p.blocks.some((b) => b.kind === "appointment"));
  const video = blocks.find((b): b is Extract<CardBlock, { kind: "video" }> => b.kind === "video" && /\.mp4(\?|$)/i.test(b.url));
  return { rating, map, offer, product, booking: bookingPage ? { slug: bookingPage.slug } : null, ...(video ? { clip: { url: video.url, poster: video.posterUrl } } : {}) };
}

/** The board's CSS (§3.3), joined to the site's inline <style>. Phone first: a two-column flow (brand and photo span
 *  both); from 1024 px a 12-column grid. The shared hero rules it needs (.hero-sub, the trust items, the WhatsApp
 *  icon colour, the dark brand tile) are repeated under `.board` until HERO_CSS is inlined by the page. No
 *  backdrop-filter, blur or gradient anywhere. */
export const BENTO_CSS = `
.site .board{position:relative;background:var(--paper)}
.site .board-wrap{margin:0 auto;max-width:var(--content);padding:var(--s4) var(--gutter) var(--s6)}
.site .board-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:auto;gap:var(--s3)}
.site .board-tile{border-radius:var(--r-tile);overflow:hidden}
.site .board-brand{grid-column:1 / -1;display:flex;flex-direction:column;align-items:flex-start;gap:var(--s3);padding:var(--s2) 0 var(--s3);--t-display:44px}
.site .board-brand .display{max-width:16ch}
.site .board-brand .display[data-len=long]{--t-display:40px;max-width:20ch}
.site .board-brand .kicker{margin:0}
.site .board-rule{display:block;width:48px;height:1px;background:var(--gold);margin:calc(var(--s1) * -1) 0 var(--s1)}
.site .board .hero-sub{margin:0;max-width:34ch;font-size:var(--t-sub);line-height:1.45;text-wrap:pretty;color:var(--muted)}
.site .board .hero-sub:lang(hi){line-height:1.6}
.site .board .trust-row{margin-top:var(--s1)}
.site .board .hero-trust-item{display:inline-flex;align-items:center;gap:.3em;white-space:nowrap}
.site .board .hero-trust-n{opacity:.7}.site .board .hero-star{color:var(--star)}
.site .board .open-dot{display:inline-block;width:8px;height:8px;border-radius:9999px;background:var(--wa);flex:none}
.site .board [data-state=closed] .open-dot{background:var(--muted)}
.site .board-ctas{display:flex;flex-wrap:nowrap;align-items:stretch;gap:var(--s3);width:100%;margin-top:var(--s2)}
.site .board-cta{min-height:56px;gap:var(--s3)}
.site .board-cta.btn-primary{flex:1 1 auto;min-width:0;justify-content:flex-start;padding:0 var(--s5)}
.site .board-cta.btn-primary>span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.site .board-cta.btn-ghost{flex:0 0 auto;padding:0 var(--s4)}
.site .board-cta-arrow{margin-left:auto}
.site .board-cta-long{display:none}
.site .board .hero-cta[data-kind=whatsapp] svg:first-child{color:var(--wa)}
.site .board-brand.hero-dark{padding:var(--s4);border-radius:var(--r-tile)}
.site .board-brand.hero-dark .board-cta.btn-primary{padding:0 var(--s4)}
.site .board-brand.hero-dark .board-cta-arrow{display:none}
.site .board-brand.hero-dark .hero-sub{color:var(--hero-text);opacity:.9}
.site .board-brand.hero-dark .board-rule{background:var(--hero-line)}
.site .board-brand.hero-dark .hero-cta[data-kind=whatsapp] svg:first-child{color:inherit}
/* strips: two up on a phone, 96 px, one fact each; an odd last one takes the row */
.site .board-strip{display:flex;flex-direction:column;justify-content:space-between;gap:var(--s2);min-height:96px;padding:var(--s4);text-align:left;color:inherit;text-decoration:none;font:inherit;cursor:default}
.site .board-strip[data-wide]{grid-column:1 / -1}
.site .board-link{cursor:pointer;transition:border-color 150ms ease,transform 80ms ease}
.site .board-link:hover{border-color:var(--muted)}
.site .board-link:active{transform:scale(.985)}
.site .board-strip-head{display:flex;align-items:center;gap:.5em;margin:0;font-size:15px;font-weight:600;line-height:1.3}
.site .board-strip-ic{flex:none;color:var(--muted)}
.site .board-strip-meta{margin:0;font-size:var(--t-meta);font-weight:500;line-height:1.4;color:var(--muted);font-variant-numeric:tabular-nums}
.site .board-strip-go{display:inline-flex;align-items:center;gap:.25em;color:var(--accent)}
.site .board-code{font-weight:600;color:var(--ink);letter-spacing:.04em}
.site .board-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site .board-clamp-1{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
/* photo: 4:5 on a phone, after the strips, no overlay */
.site .board-photo{position:relative;grid-column:1 / -1;order:9;aspect-ratio:4/5;background:var(--paper-2)}
.site .board-photo-pic{position:absolute;inset:0}
.site .board-photo[data-banner] .hero-ph{transform:scale(1.32);transform-origin:62% 84%}
/* products: a desktop row */
.site .board-products{display:none}
@media (min-width:1024px){
  .site .board-wrap{padding:var(--s6) var(--gutter) var(--s8)}
  .site .board-grid{grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:minmax(120px,auto);gap:var(--s4)}
  .site .board-brand{grid-column:span 5;grid-row:span 3;justify-content:center;gap:var(--s4);padding:var(--s3) var(--s6) var(--s3) 0;--t-display:64px}
  .site .board-brand .display{max-width:14ch}
  .site .board-brand .display[data-len=long]{--t-display:56px;max-width:18ch}
  .site .board-grid:not([data-photo]) .board-brand{grid-column:span 12;--t-display:80px;padding:var(--s6) 0}
  .site .board-grid:not([data-photo]) .board-brand .display{max-width:18ch}
  .site .board-grid:not([data-photo]) .board-brand .display[data-len=long]{--t-display:64px;max-width:22ch}
  .site .board-brand.hero-dark{padding:var(--s6);--t-display:56px}
  .site .board-brand.hero-dark .board-cta.btn-primary{padding:0 20px}
  .site .board-grid:not([data-photo]) .board-brand.hero-dark{padding:var(--s7);--t-display:72px}
  .site .board-rule{width:64px;margin:0 0 var(--s2)}
  .site .board-ctas{width:auto;flex-wrap:wrap;margin-top:var(--s3);gap:var(--s3) var(--s3)}
  .site .board-cta{min-height:48px}
  .site .board-cta.btn-primary{flex:0 0 auto;justify-content:center;padding:0 20px}
  .site .board-cta-arrow{display:none}
  .site .board-cta-long{display:inline}.site .board-cta-short{display:none}
  .site .board-cta.btn-ghost{padding:0 20px}
  .site .board-photo{grid-column:span 7;grid-row:span 3;order:0;aspect-ratio:auto;min-height:392px}
  .site .board-strip{grid-column:span var(--span,3);grid-row:span 1;justify-content:center;gap:6px;min-height:120px;padding:var(--s4) var(--s5)}
  .site .board-photo[data-banner] .hero-ph{transform:scale(1.4);transform-origin:70% 80%}
  .site .board-strip[data-wide]{grid-column:span var(--span,3)}
  .site .board-products{display:grid;grid-column:1 / -1;grid-row:span 2;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:var(--s4)}
  .site .board-product{display:flex;flex-direction:column;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer;transition:border-color 150ms ease}
  .site .board-product:hover{border-color:var(--muted)}
  .site .board-thumb{display:block;flex:1;min-height:0;background:var(--paper-2)}
  .site .board-thumb-img{display:block;width:100%;height:100%;object-fit:cover}
  .site .board-product-row{display:flex;justify-content:space-between;gap:var(--s3);padding:var(--s3) var(--s4);font-size:14px;line-height:1.3}
  .site .board-product-row b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
}
/* Hindi: the Devanagari faces need room above and below the line, no tracking (the .site:lang(hi) rules, repeated
   here so they hold when only the board carries lang). */
.site .board:lang(hi) .display{font-size:calc(var(--t-display) * .88);line-height:1.22;letter-spacing:0;font-weight:var(--display-w-hi,600)}
.site .board:lang(hi) .kicker{letter-spacing:0;text-transform:none;font-size:13px}
.site[data-motion=none] .board .hero-stagger>*,.site[data-motion=none] .board .tile-in,.site[data-motion=none] .board .hero-ph-in{animation:none}
`;
