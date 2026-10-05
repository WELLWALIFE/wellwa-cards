"use client";
// The Bento blueprint's hero (docs/website-looks-v2.md §3.1): a board of tiles, each one thing the business has —
// its photo or clip, its name, call and WhatsApp, open-now, the rating, the map, an offer, the first product, the
// years, booking. A tile is drawn only when the card has its content; `site.hero.tiles` picks and orders them.
// Two columns on a phone, four on a computer; the photo tile spans two by two.
import { useMemo } from "react";
import { MessageCircle, Phone, MapPin, Star, Tag, CalendarClock, ArrowRight, Navigation } from "lucide-react";
import type { Card, CardBlock, ProductItem } from "@/lib/types";
import { TILE_KEYS, type TileKey } from "@/lib/site-blueprints";
import { useOpenNow } from "@/components/site-smart";
import { Pic as Img, picUrl } from "@/components/pic";
import { trackClick } from "@/lib/track";
import { linkHref } from "@/components/link-icon";
import { safeMapUrl } from "@/components/card-view";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tc)]";
/** Press feedback: the tile sinks a little under the finger. */
const PRESS = "transition-transform duration-150 active:scale-[0.985] motion-reduce:transform-none";

export type BentoInput = {
  card: Card;
  hi: boolean;
  t: (s: string) => string;
  /** The hero photo (cover / first stock photo) and the trade clip when the card carries one and may show it. */
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
  /** Short trust chips for the name tile. */ pills?: string[];
  darkPage: boolean;
};

/** Which tiles this card can fill, in the owner's (or default) order. */
export function bentoTiles(i: BentoInput): TileKey[] {
  const can: Record<TileKey, boolean> = {
    photo: !!(i.photo || i.clip), name: true, contact: !!(i.phone || i.wa), open: !!i.hours?.length, rating: !!i.rating && i.rating.count > 0,
    map: !!i.map, offer: !!i.offer?.text, product: !!i.product, since: !!i.since, booking: !!i.booking,
  };
  const order = (i.card.site?.hero?.tiles?.length ? i.card.site.hero.tiles : [...TILE_KEYS]) as TileKey[];
  const out = order.filter((k) => can[k]);
  if (!out.includes("name")) out.unshift("name");
  return out;
}

export function BentoHero(i: BentoInput) {
  const { card, hi, t } = i;
  const tiles = useMemo(() => bentoTiles(i), [i]);
  const open = useOpenNow(i.hours);
  const name = card.site?.hero?.headline || card.company || card.name;
  const sub = card.site?.hero?.sub || card.tagline || "";
  const glass = i.darkPage ? "border-white/15 bg-white/[0.07] text-[var(--p-ink)]" : "border-border bg-[color-mix(in_srgb,var(--surface)_82%,transparent)]";
  const tile = `relative overflow-hidden rounded-3xl border backdrop-blur-md shadow-[0_18px_40px_-28px_rgba(0,0,0,.45)] ${glass}`;
  const label = (en: string, h: string) => (hi ? h : t(en));
  const year = new Date().getFullYear();
  let n = 0;
  const reveal = () => ({ "data-reveal": "", style: { ["--i" as string]: n++ } as React.CSSProperties });

  return (
    <section className="relative" aria-label={name}>
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-8 md:px-6 md:pt-8 md:pb-12">
        <div className="grid auto-rows-[minmax(118px,auto)] grid-cols-2 gap-3 md:auto-rows-[minmax(150px,auto)] md:grid-cols-4 md:gap-4" style={{ gridAutoFlow: "dense" }}>
          {tiles.map((k) => {
            switch (k) {
              case "photo": return (
                <div key={k} {...reveal()} className={`${tile} col-span-2 row-span-2 min-h-[240px] md:min-h-[320px] bg-[var(--p-deep)]`}>
                  {i.clip
                    ? <video src={i.clip.url} poster={i.clip.poster ? picUrl(i.clip.poster, 1080) : undefined} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                    : <Img src={i.photo!} alt="" className="absolute inset-0 h-full w-full object-cover kb" style={i.focus ? { objectPosition: i.focus } : undefined} priority sizes="(min-width: 768px) 50vw, 100vw" />}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
                </div>
              );
              case "name": return (
                <div key={k} {...reveal()} className={`${tile} col-span-2 flex flex-col justify-center p-5 md:p-7`}>
                  <div className="flex items-start gap-3">
                    {i.logo && <Img src={i.logo} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-1" eager w={48} />}
                    <div className="min-w-0">
                      {i.eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: i.darkPage ? "var(--p-accent)" : "var(--p-mark)" }}>{t(i.eyebrow)}</p>}
                      <h1 className="mt-1 text-[30px] leading-[1.02] tracking-tight md:text-[40px]" style={{ textWrap: "balance" }}>{t(name)}</h1>
                      {sub && <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed opacity-80 md:text-[16px]">{t(sub)}</p>}
                    </div>
                  </div>
                  {!!i.pills?.length && <ul className="mt-3 flex flex-wrap gap-1.5">{i.pills.slice(0, 4).map((p, j) => <li key={j} className="rounded-full border px-2.5 py-1 text-[12px] font-medium" style={{ borderColor: "color-mix(in srgb, currentColor 18%, transparent)", background: "color-mix(in srgb, currentColor 6%, transparent)" }}>{t(p)}</li>)}</ul>}
                </div>
              );
              case "contact": return (
                <div key={k} {...reveal()} className="col-span-2 grid grid-cols-2 gap-3 md:gap-4">
                  {i.wa && <a href={i.waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-hero-whatsapp")} className={`${tile} ${PRESS} ${FOCUS} flex flex-col justify-between p-4 md:p-5 ${i.phone ? "" : "col-span-2"}`} style={{ background: "#25D366", color: "#fff", borderColor: "transparent" }}>
                    <MessageCircle className="h-7 w-7" /><span className="text-[16px] font-semibold leading-tight md:text-[18px]">{t(card.site?.hero?.ctaLabel || "WhatsApp")}</span>
                  </a>}
                  {i.phone && <a href={linkHref("phone", i.phone)} onClick={() => trackClick(card.username, "site-hero-phone")} className={`${tile} ${PRESS} ${FOCUS} flex flex-col justify-between p-4 md:p-5 ${i.wa ? "" : "col-span-2"}`} style={{ background: "var(--grad)", color: "var(--p-on)", borderColor: "transparent" }}>
                    <Phone className="h-7 w-7" /><span className="text-[16px] font-semibold leading-tight md:text-[18px]">{label("Call now", "Call करें")}</span>
                  </a>}
                </div>
              );
              // Always in the DOM from the first paint (the reveal observer only sees what mounts with the board);
              // the state fills in a moment later.
              case "open": return (
                <div key={k} {...reveal()} className={`${tile} flex flex-col justify-between p-4 md:p-5`}>
                  <span className="relative inline-flex h-3 w-3"><span className="absolute inset-0 animate-ping rounded-full motion-reduce:hidden" style={{ background: open?.state === "open" ? "#22c55e" : "#f59e0b", opacity: open ? .5 : 0 }} /><span className="relative h-3 w-3 rounded-full" style={{ background: !open ? "#9ca3af" : open.state === "open" ? "#22c55e" : "#f59e0b" }} /></span>
                  <div><p className="text-[17px] font-semibold leading-tight">{!open ? label("Timings", "समय") : open.state === "open" ? label("Open now", "अभी खुला है") : label("Closed", "अभी बंद")}</p><p className="mt-0.5 text-[13px] opacity-70">{open ? (hi ? open.noteHi : open.note) : "…"}</p></div>
                </div>
              );
              case "rating": return (
                <div key={k} {...reveal()} className={`${tile} flex flex-col justify-between p-4 md:p-5`}>
                  <Star className="h-6 w-6 fill-current" style={{ color: "#f5b301" }} />
                  <div><p className="text-[28px] font-semibold leading-none tracking-tight" style={{ fontFamily: "var(--look-head)" }}>{(Math.round(i.rating!.avg * 10) / 10).toFixed(1)}</p><p className="mt-1 text-[13px] opacity-70">{hi ? `${i.rating!.count} रिव्यू` : `${i.rating!.count} reviews`}</p></div>
                </div>
              );
              case "map": return (
                <a key={k} {...reveal()} href={i.map!.url} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-hero-map")} className={`${tile} ${PRESS} ${FOCUS} flex flex-col justify-between p-4 md:p-5`}>
                  <MapPin className="h-6 w-6" style={{ color: "var(--tc)" }} />
                  <div><p className="line-clamp-2 text-[14px] font-medium leading-snug">{t(i.map!.address || label("Find us on the map", "Map पर देखें"))}</p><p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: "var(--tc)" }}><Navigation className="h-3.5 w-3.5" /> {label("Directions", "रास्ता")}</p></div>
                </a>
              );
              case "offer": return (
                <div key={k} {...reveal()} className={`${tile} col-span-2 flex items-center gap-4 p-4 md:p-5`} style={{ background: "color-mix(in srgb, var(--p-accent) 22%, var(--surface))" }}>
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--grad)", color: "var(--p-on)" }}><Tag className="h-6 w-6" /></span>
                  <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--p-mark)" }}>{t(i.offer!.title || "Offer")}</p><p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug">{t(i.offer!.text)}</p>{i.offer!.code && <p className="mt-1 text-[12px] opacity-70">{label("Code", "Code")}: <b className="mono">{i.offer!.code}</b></p>}</div>
                </div>
              );
              case "product": { const p = i.product!; const img = p.images?.[0] ?? p.imageUrl; return (
                <button key={k} {...reveal()} type="button" onClick={() => i.onProduct?.(p)} className={`${tile} ${PRESS} ${FOCUS} row-span-2 flex flex-col text-left`}>
                  <div className="relative flex-1 min-h-[120px]" style={{ background: "var(--p-soft)" }}>{img ? <Img src={img} alt={p.name} className="absolute inset-0 h-full w-full object-contain p-4" sizes="(min-width: 768px) 25vw, 50vw" /> : <span className="absolute inset-0 grid place-items-center text-4xl font-semibold" style={{ color: "var(--tc)" }}>{Array.from(p.name.trim())[0]?.toUpperCase()}</span>}</div>
                  <div className="p-4"><p className="line-clamp-1 text-[14px] font-semibold">{t(p.name)}</p>{(p.price || p.mrp) && <p className="mt-0.5 text-[15px] font-semibold" style={{ color: "var(--tc)" }}>{p.price || p.mrp}</p>}<p className="mt-1 inline-flex items-center gap-1 text-[12px] opacity-70">{label("See", "देखें")} <ArrowRight className="h-3 w-3" /></p></div>
                </button>
              ); }
              case "since": return (
                <div key={k} {...reveal()} className={`${tile} flex flex-col justify-between p-4 md:col-span-2 md:p-5`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label("Since", "कब से")}</p>
                  <div><p className="text-[28px] font-semibold leading-none tracking-tight" style={{ fontFamily: "var(--look-head)" }}>{i.since}</p><p className="mt-1 text-[13px] opacity-70">{year - i.since! >= 2 ? (hi ? `${year - i.since!} साल का भरोसा` : `${year - i.since!} years of trust`) : label("trusted business", "भरोसेमंद")}</p></div>
                </div>
              );
              case "booking": return (
                <button key={k} {...reveal()} type="button" onClick={() => i.go(i.booking!.slug)} className={`${tile} ${PRESS} ${FOCUS} flex flex-col justify-between p-4 text-left md:p-5`}>
                  <CalendarClock className="h-6 w-6" style={{ color: "var(--tc)" }} />
                  <p className="text-[15px] font-semibold leading-tight">{label("Book an appointment", "Appointment लें")}</p>
                </button>
              );
              default: return null;
            }
          })}
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

/** The Bento page's CSS: the aurora behind the board, glass cards, the nav that turns to glass on scroll. */
export const BENTO_CSS = `
@keyframes site-aurora-a{0%{transform:translate(-10%,-6%) scale(1)}50%{transform:translate(8%,10%) scale(1.15)}100%{transform:translate(-10%,-6%) scale(1)}}
@keyframes site-aurora-b{0%{transform:translate(12%,8%) scale(1.1)}50%{transform:translate(-8%,-10%) scale(.95)}100%{transform:translate(12%,8%) scale(1.1)}}
.site[data-bp="bento"] .site-aurora{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.site[data-bp="bento"] .site-aurora i{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55;will-change:transform}
.site[data-bp="bento"] .site-aurora i:nth-child(1){left:-10%;top:-20%;width:60vw;height:60vw;max-width:720px;max-height:720px;background:var(--p-mid);animation:site-aurora-a 26s ease-in-out infinite}
.site[data-bp="bento"] .site-aurora i:nth-child(2){right:-15%;top:10%;width:55vw;height:55vw;max-width:640px;max-height:640px;background:var(--p-glow);animation:site-aurora-b 32s ease-in-out infinite}
.site[data-bp="bento"] .site-aurora i:nth-child(3){left:30%;bottom:-30%;width:50vw;height:50vw;max-width:560px;max-height:560px;background:var(--p-accent);opacity:.35;animation:site-aurora-a 40s ease-in-out infinite reverse}
.site[data-bp="bento"] header.site-head{background:transparent;border-color:transparent;backdrop-filter:none;transition:background .3s,border-color .3s,backdrop-filter .3s}
.site[data-bp="bento"] header.site-head.scrolled{background:color-mix(in srgb,var(--surface) 62%,transparent);border-color:var(--border);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.site[data-bp="bento"] main section .bg-surface{background:color-mix(in srgb,var(--surface) 78%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
@media (prefers-reduced-motion: reduce){.site[data-bp="bento"] .site-aurora i{animation:none}}
`;
