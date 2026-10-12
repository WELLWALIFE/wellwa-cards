"use client";
// The SHOP blueprint (docs/website-looks-v3.md §2): built like the sweet-shop, chai-chain and home-services sites of the
// Oct 2026 market review — a row of round chips you scroll sideways (the card's products with their pictures when it
// has four or more, else the quick actions), a promo banner with the headline, ONE Order button and the photo, and a
// fact strip under it (rating · open now · since · the offer). The products follow as the page's first section.
// Without a photo the banner is a solid field of the palette's deep-to-mid gradient (`shelf-ink`).
import { heroModel } from "@/lib/site-hero";
import type { Card, ProductItem } from "@/lib/types";
import type { bentoFacts } from "@/components/site-bento";
import { CtaPair, Display, HeroPhoto, Kicker, Sub, TrustRow } from "@/components/site-smart";
import { Icon, type IconName } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { trackClick } from "@/lib/track";

type Facts = ReturnType<typeof bentoFacts>;
type Chip = { key: string; label: string; icon?: IconName; img?: string; href?: string; external?: boolean; onClick?: () => void };

/** The first eight products that have a picture and a name. */
function productChips(card: Card): { item: ProductItem; img: string }[] {
  const out: { item: ProductItem; img: string }[] = [];
  for (const p of card.pages.filter((pg) => !pg.hidden).flatMap((pg) => pg.blocks).flatMap((b) => (b.kind === "product" ? b.items : []))) {
    const img = (p.images?.[0] ?? p.imageUrl ?? "").trim();
    if (img && (p.name ?? "").trim()) out.push({ item: p, img });
    if (out.length === 8) break;
  }
  return out;
}

export function ShopHero({ card, hi, t, onBook, facts, onProduct }: {
  card: Card; hi: boolean; t: (s: string) => string; onBook?: (slug: string) => void; facts: Facts | null; onProduct?: (p: ProductItem) => void;
}) {
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const ink = !m.photo;
  const L = (en: string, h: string) => (hi ? h : t(en));
  const products = productChips(card);
  let chips: Chip[];
  if (products.length >= 4) chips = products.map((p, i) => ({ key: `p${i}`, label: p.item.name, img: p.img, onClick: () => onProduct?.(p.item) }));
  else {
    chips = [];
    if (m.primary.kind === "whatsapp") chips.push({ key: "wa", label: "WhatsApp", icon: "whatsapp", href: m.primary.href, external: true });
    const call = m.primary.kind === "call" ? m.primary : m.secondary?.kind === "call" ? m.secondary : null;
    if (call) chips.push({ key: "call", label: L("Call", "कॉल"), icon: "phone", href: call.href });
    if (facts?.map) chips.push({ key: "map", label: L("Directions", "रास्ता"), icon: "directions", href: facts.map.url, external: true });
    if (facts?.booking) chips.push({ key: "book", label: L("Book", "बुक करें"), icon: "calendar", onClick: () => onBook?.(facts.booking!.slug) });
    if (facts?.offer?.text) chips.push({ key: "offer", label: L("Offer", "ऑफ़र"), icon: "tag" });
  }
  const chipInner = (c: Chip) => (
    <>
      <i>{c.img ? <Pic src={c.img} alt="" className="shelf-chip-img" sizes="88px" eager w={160} /> : c.icon ? <Icon name={c.icon} size={22} /> : null}</i>
      <span>{t(c.label)}</span>
    </>
  );
  return (
    <section className="shelf" data-variant={ink ? "shelf-ink" : "shelf"} lang={lang} aria-label={m.name}>
      <div className="shelf-wrap">
        {chips.length >= 3 && (
          <div className="shelf-chips" role="list">
            {chips.map((c, i) => c.href
              ? <a key={c.key} role="listitem" href={c.href} {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})} className="shelf-chip tile-in" style={{ ["--i" as string]: i } as React.CSSProperties} onClick={() => trackClick(card.username, `site-chip-${c.key}`)}>{chipInner(c)}</a>
              : <button key={c.key} role="listitem" type="button" className="shelf-chip tile-in" style={{ ["--i" as string]: i } as React.CSSProperties} onClick={c.onClick}>{chipInner(c)}</button>)}
          </div>
        )}
        <div className={`shelf-promo ${ink ? "hero-dark shelf-promo-ink" : ""}`}>
          <div className="shelf-words hero-stagger">
            <Kicker lang={lang}>{t(m.kicker)}</Kicker>
            <Display lang={lang}>{t(m.headline)}</Display>
            <Sub lang={lang}>{t(m.sub)}</Sub>
            <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle={ink ? "link" : "ghost"} onBook={onBook} />
          </div>
          {m.photo && <div className="shelf-ph"><HeroPhoto photo={m.photo} crop="tile" priority alt={m.name} className="shelf-ph-pic" /></div>}
        </div>
        <div className="shelf-facts">
          <TrustRow trust={m.trust} hours={m.hours} hi={hi} />
          {facts?.offer?.text && <span className="shelf-offer"><Icon name="tag" />{t(facts.offer.text)}</span>}
        </div>
      </div>
    </section>
  );
}

export const SHOP_CSS = `
.site .shelf{background:var(--paper);color:var(--ink);padding:var(--s4) 0 var(--s6)}
.site .shelf-wrap{max-width:calc(var(--content) + 2*var(--gutter));margin:0 auto;padding:0 var(--gutter)}
.site .shelf-chips{display:flex;gap:var(--s4);overflow-x:auto;scrollbar-width:none;margin:0 calc(-1*var(--gutter));padding:var(--s2) var(--gutter) var(--s5);scroll-snap-type:x proximity}
.site .shelf-chips::-webkit-scrollbar{display:none}
.site .shelf-chip{flex:0 0 auto;width:72px;display:flex;flex-direction:column;align-items:center;gap:var(--s2);text-align:center;font:500 12px/1.2 var(--font-text,var(--look-body));color:var(--ink);text-decoration:none;background:none;border:0;padding:0;cursor:pointer;scroll-snap-align:start}
.site .shelf-chip i{display:grid;place-items:center;width:64px;height:64px;border-radius:999px;background:var(--p-soft);color:var(--accent);overflow:hidden;border:1px solid var(--line)}
.site .shelf-chip-img{width:100%;height:100%;object-fit:cover}
.site .shelf-chip span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site .shelf-promo{position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--r-tile);background:var(--p-soft)}
.site .shelf-promo-ink{background:linear-gradient(135deg,var(--p-deep),var(--p-mid));color:var(--hero-text)}
.site .shelf-ph{position:relative;aspect-ratio:16/10;overflow:hidden;order:-1}
.site .shelf-ph .hero-ph-wrap,.site .shelf-ph-pic{position:absolute;inset:0;width:100%;height:100%}
.site .shelf-words{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s3);padding:var(--s5)}
.site .shelf-words .display{--t-display:clamp(1.9rem,8vw,2.5rem)}
.site .shelf-words .hero-ctas{margin-top:var(--s2)}
.site .shelf-facts{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5);margin-top:var(--s4);font-size:var(--t-meta);color:var(--muted)}
.site .shelf-offer{display:inline-flex;align-items:center;gap:.4em;font-weight:600;color:var(--accent);background:var(--p-soft);padding:.45rem .8rem;border-radius:999px}
@media (min-width:1024px){
.site .shelf{padding:var(--s5) 0 var(--s7)}
.site .shelf-chip{width:92px}.site .shelf-chip i{width:76px;height:76px}
.site .shelf-promo{flex-direction:row;min-height:440px}
.site .shelf-words{flex:1 1 50%;padding:var(--s7);justify-content:center}
.site .shelf-words .display{--t-display:clamp(2.5rem,3.6vw,3.5rem)}
.site .shelf-ph{flex:1 1 50%;aspect-ratio:auto;min-height:440px;order:0}
}
.site .shelf .hero-stagger>*{animation-name:hero-in}
`;
