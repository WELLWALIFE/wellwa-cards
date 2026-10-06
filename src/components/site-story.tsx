"use client";
// The Story blueprint (docs/premium-look.md §3.5): the website as full-screen slides, one thing per slide. Slide 1
// converts — it is what a phone visitor sees as the whole website: the trade and city once (kicker), one claim
// (headline), one line of benefit, ONE filled button and a quiet meta line over a still, lightly graded photo; the
// rest of the slides (what we do, products, why us, photos, a review each, the offer, how to reach us) wear the
// same tokens. On a computer the slides run inside a plain phone frame beside the wordmark, the trust row, the QR
// code and the two buttons — the headline is printed once, in the frame. Slides the card lacks are never drawn.
import { useEffect, useRef, useState } from "react";
import type { Card, CardBlock, ProductItem, TestimonialItem } from "@/lib/types";
import { heroModel, ownUpload, stripEmoji, type HeroModel, type HeroVariant } from "@/lib/site-hero";
import { Kicker, Display, Sub, TrustRow, CtaPair, Wordmark, HeroPhoto, useOpenNow } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Pic as Img } from "@/components/pic";
import { trackClick } from "@/lib/track";
import { linkHref } from "@/components/link-icon";
import { splitGlyph } from "@/components/card-view";

type Slide =
  | { k: "cover"; photo?: string; clip?: { url: string; poster?: string } }
  | { k: "what"; title: string; lines: string[]; body?: string }
  | { k: "products"; title: string; items: ProductItem[]; more: number; page: string }
  | { k: "why"; title: string; items: string[] }
  | { k: "photos"; title: string; urls: string[]; page?: string }
  | { k: "review"; item: TestimonialItem; n: number; of: number }
  | { k: "offer"; block: Extract<CardBlock, { kind: "offer" }> }
  | { k: "contact" };

/** The colour of the progress bar over a slide: it sits outside the slides, so each slide says what it carries. */
type Tone = "dark" | "light" | "accent";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current";

/** The slides this card can fill, in order. */
export function storySlides(card: Card, photo?: string, clip?: { url: string; poster?: string }): Slide[] {
  const pages = card.pages.filter((p) => !p.hidden);
  const blocks = pages.flatMap((p) => p.blocks);
  const pageOf = (kind: CardBlock["kind"]) => pages.find((p) => p.slug !== "home" && p.blocks.some((b) => b.kind === kind))?.slug ?? pages.find((p) => p.blocks.some((b) => b.kind === kind))?.slug ?? "home";
  const out: Slide[] = [{ k: "cover", photo, clip }];
  const about = blocks.find((b): b is Extract<CardBlock, { kind: "about" }> => b.kind === "about" && !!(b.body ?? "").trim());
  const services = blocks.find((b): b is Extract<CardBlock, { kind: "services" }> => b.kind === "services" && b.items.length > 0);
  const lines = (services?.items ?? []).map((x) => x.name).filter(Boolean).slice(0, 5);
  if (lines.length || about) out.push({ k: "what", title: services?.title || about?.title || "", lines, body: (about?.body ?? "").split(/\n+/)[0]?.slice(0, 220) });
  const products = blocks.flatMap((b) => (b.kind === "product" ? b.items : [])).filter((p) => (p.name ?? "").trim());
  if (products.length) out.push({ k: "products", title: blocks.find((b) => b.kind === "product")?.title ?? "", items: products.slice(0, 6), more: Math.max(0, products.length - 6), page: pageOf("product") });
  const why = blocks.find((b): b is Extract<CardBlock, { kind: "highlights" }> => b.kind === "highlights" && b.items.length >= 3);
  if (why) out.push({ k: "why", title: why.title, items: why.items.map((x) => stripEmoji(splitGlyph(x ?? "").text || x)).filter(Boolean).slice(0, 6) });
  const urls = [...new Set(blocks.flatMap((b) => (b.kind === "gallery" ? b.images.map((i) => i.url ?? "") : b.kind === "image" || b.kind === "carousel" ? b.images.map((i) => i.url) : [])).filter(Boolean))].filter((u) => u !== photo).slice(0, 4);
  if (urls.length >= 2) out.push({ k: "photos", title: blocks.find((b) => b.kind === "gallery")?.title ?? "", urls, page: pageOf("gallery") });
  const reviews = blocks.flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((x) => (x.text ?? "").trim()).slice(0, 3);
  reviews.forEach((item, i) => out.push({ k: "review", item, n: i + 1, of: reviews.length }));
  const offer = blocks.find((b): b is Extract<CardBlock, { kind: "offer" }> => b.kind === "offer" && !!(b.text ?? "").trim());
  if (offer) out.push({ k: "offer", block: offer });
  out.push({ k: "contact" });
  return out;
}

/** The slide-1 variant actually drawn (§3.5): a bright photo goes to `slide-duo` (hard edge, paper panel, no scrim) —
 *  a scrim deep enough for white type would wash it; a non-story variant falls back on what the card has. */
function slideVariant(m: HeroModel): HeroVariant {
  const v = m.variant;
  if (!v.startsWith("slide-")) return m.photo || m.clip ? "slide-photo" : "slide-ink";
  if (v === "slide-photo" && m.photo?.bright && !m.clip) return "slide-duo";
  if ((v === "slide-photo" || v === "slide-duo") && !m.photo && !m.clip) return "slide-ink";
  return v;
}

/** "Main market" out of "Main market, Rewari" — the one place word for the meta line; else the city. */
function placeOf(address: string | undefined, city: string | undefined): string {
  const first = stripEmoji((address ?? "").split(/,|\n/)[0] ?? "").trim();
  if (first && Array.from(first).length <= 28) return first;
  return (city ?? "").trim();
}

export function StoryView({ card, hi, t, qr, photo, clip, phone, wa, waHref, hours, map, onProduct, go }: {
  card: Card; hi: boolean; t: (s: string) => string; qr: string; photo?: string; clip?: { url: string; poster?: string }; focus?: string;
  phone?: string; wa?: string; waHref: (text?: string) => string; hours?: { day: string; time: string }[]; map?: { address: string; url: string };
  onProduct: (p: ProductItem) => void; go: (slug: string) => void; eyebrow?: string; logo?: string;
}) {
  const slides = storySlides(card, photo, clip);
  const lang = hi ? "hi" : "en";
  const m = heroModel(card, lang);
  const variant = slideVariant(m);
  const L = (en: string, h: string) => (hi ? h : t(en));
  const live = useOpenNow(m.hours ?? hours);
  const open = live ? { state: live.state, until: hi ? live.noteHi : live.note } : m.trust.open;
  const place = placeOf(map?.address, m.trust.city);
  // The still-life for a no-photo slide: only a picture the owner uploaded (never stock, a logo or an AI reference).
  const still = variant === "slide-ink" || variant === "slide-type"
    ? card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).flatMap((b) => (b.kind === "product" ? b.items : [])).map((p) => p.images?.[0] ?? p.imageUrl).find(ownUpload)
    : undefined;
  const book = (href: string) => (e: React.MouseEvent) => { if (href.startsWith("#")) { e.preventDefault(); go(href.slice(1)); } };

  const Head = ({ eyebrow: e, title, tone }: { eyebrow: string; title: string; tone?: "dark" | "accent" }) => (
    <div>
      <Kicker lang={lang} className={tone === "accent" ? "story-kicker-inv" : ""}>{e}</Kicker>
      {title && <h2 className="story-h2" lang={lang}>{t(title)}</h2>}
    </div>
  );

  const tones: Tone[] = slides.map((s) => s.k === "cover" ? (variant === "slide-duo" || variant === "slide-type" ? "light" : "dark") : s.k === "why" || s.k === "contact" ? "dark" : s.k === "offer" ? "accent" : "light");

  const slide = (s: Slide, i: number) => {
    const base = "story-slide relative flex h-full w-full shrink-0 snap-start flex-col overflow-hidden";
    switch (s.k) {
      case "cover": {
        const dark = variant !== "slide-duo" && variant !== "slide-type";
        const cue = L("Swipe", "ऊपर swipe करें");
        return (
          <section key={i} className={`${base} story-cover ${dark ? "hero-dark" : ""}`} data-variant={variant} aria-label={m.name}>
            {variant === "slide-photo" && (
              <>
                <HeroPhoto photo={m.photo} clip={m.clip} clipOn="always" crop="cover" priority sizes="1600px" className="story-ph" />
                <i aria-hidden="true" className="story-tint" />
                <i aria-hidden="true" className="story-scrim" />
              </>
            )}
            {variant === "slide-duo" && <HeroPhoto photo={m.photo} crop="cover" priority sizes="1600px" className="story-ph story-duo-ph" />}
            {(variant === "slide-ink" || variant === "slide-type") && (
              still
                ? <div className="story-still"><Img src={still} alt="" className="story-still-img" eager sizes="400px" /></div>
                : dark && <i aria-hidden="true" className="hero-grain" />
            )}
            {/* the header is hidden on a story, so the name stands here, once, where a nav's mark would be */}
            {m.logo ? <Img src={m.logo} alt={m.name} className="story-mark story-mark-logo" eager w={40} /> : <Wordmark name={m.name} className="story-mark" lang={lang} />}
            <div className="story-copy hero-stagger">
              <Kicker lang={lang}>{m.kicker}</Kicker>
              <Display lang={lang}>{t(m.headline)}</Display>
              <Sub lang={lang}>{t(m.sub)}</Sub>
              <a href={m.primary.href} {...(m.primary.kind === "whatsapp" ? { target: "_blank", rel: "noreferrer" } : {})} data-kind={m.primary.kind}
                className={`btn-primary hero-cta story-cta ${FOCUS}`}
                onClick={(e) => { trackClick(card.username, `site-hero-${m.primary.kind}`); book(m.primary.href)(e); }}>
                <Icon name={m.primary.kind === "whatsapp" ? "whatsapp" : m.primary.kind === "call" ? "phone" : "calendar"} /> <span>{m.primary.label}</span>
              </a>
              {(open || place) ? (
                <p className="story-meta">
                  {open && <span data-state={open.state}><i aria-hidden="true" className="open-dot" />{open.state === "open" ? L("Open", "खुला") : L("Closed", "बंद")} · {open.until}</span>}
                  {open && place && <span aria-hidden="true" className="story-dot">·</span>}
                  {place && <span>{t(place)}</span>}
                </p>
              ) : <TrustRow trust={m.trust} hi={hi} className="story-meta" />}
            </div>
            <p aria-hidden="true" className="story-cue"><Icon name="chevron-down" size={14} className="story-cue-ic" />{cue}</p>
          </section>
        );
      }
      case "what": return (
        <section key={i} className={`${base} story-paper2 justify-center`}>
          <Head eyebrow={L("What we do", "हम क्या करते हैं")} title={s.title} />
          {s.lines.length > 0 && <ol className="story-lines">{s.lines.map((l, j) => <li key={j}><span className="story-num">0{j + 1}</span>{t(l)}</li>)}</ol>}
          {s.body && <p className="story-body">{t(s.body)}</p>}
        </section>
      );
      case "products": return (
        <section key={i} className={`${base} story-paper justify-center`} style={{ paddingInline: 0 }}>
          <div className="px-6"><Head eyebrow={L("Products", "प्रोडक्ट")} title={s.title} /></div>
          <div className="story-rail" style={{ scrollSnapType: "x mandatory" }}>
            {s.items.map((p, j) => { const img = p.images?.[0] ?? p.imageUrl; return (
              <button key={j} type="button" onClick={() => onProduct(p)} className={`story-card s-card ${FOCUS}`}>
                <div className="story-card-ph">{img ? <Img src={img} alt={p.name} className="story-card-img" sizes="70vw" /> : <span className="story-card-ini" aria-hidden="true">{Array.from(p.name.trim())[0]?.toUpperCase()}</span>}</div>
                <div className="story-card-txt"><p className="story-card-name">{t(p.name)}</p>{(p.price || p.mrp) && <p className="story-card-price">{p.price || p.mrp}</p>}</div>
              </button>
            ); })}
          </div>
          {s.more > 0 && <button type="button" onClick={() => go(s.page)} className={`btn-link story-more story-more-rail ${FOCUS}`}>{hi ? `सभी ${s.items.length + s.more} देखें` : `See all ${s.items.length + s.more}`} <Icon name="arrow-right" /></button>}
        </section>
      );
      case "why": return (
        <section key={i} className={`${base} hero-dark justify-center`}>
          <Head eyebrow={L("Why us", "हमें क्यों चुनें")} title={s.title} tone="dark" />
          <ul className="story-why">{s.items.map((x, j) => <li key={j}><Icon name="check" className="story-check" />{t(x)}</li>)}</ul>
        </section>
      );
      case "photos": return (
        <section key={i} className={`${base} story-paper justify-center`}>
          <Head eyebrow={L("Photos", "फ़ोटो")} title={s.title} />
          <div className="story-grid">{s.urls.map((u, j) => <div key={j} className={`story-grid-ph ${j === 0 && s.urls.length === 3 ? "story-grid-wide" : ""}`}><Img src={u} alt="" className="story-grid-img" sizes="50vw" /></div>)}</div>
          {s.page && <button type="button" onClick={() => go(s.page!)} className={`btn-link story-more ${FOCUS}`}>{L("All photos", "सभी फ़ोटो")} <Icon name="arrow-right" /></button>}
        </section>
      );
      case "review": return (
        <section key={i} className={`${base} story-paper2 justify-center`}>
          <Kicker lang={lang}>{`${L("Reviews", "रिव्यू")} · ${s.n}/${s.of}`}</Kicker>
          <div className="story-stars" aria-label={`${Math.round(Number(s.item.rating) || 5)}/5`}>{Array.from({ length: 5 }).map((_, k) => <Icon key={k} name="star" size={16} fill className={k < Math.round(Number(s.item.rating) || 5) ? "" : "story-star-off"} />)}</div>
          <blockquote className="story-quote" lang={lang}>“{t(s.item.text)}”</blockquote>
          <i aria-hidden="true" className="story-rule" />
          <p className="story-by">{s.item.name}</p>
        </section>
      );
      case "offer": return (
        <section key={i} className={`${base} story-accent justify-center`}>
          <Icon name="tag" size={28} />
          <Head eyebrow={t(s.block.title || "Offer")} title="" tone="accent" />
          <p className="story-offer" lang={lang}>{t(s.block.text)}</p>
          {s.block.code && <p className="story-code">{L("Code", "Code")}: <b>{s.block.code}</b></p>}
          {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-offer-whatsapp")} className={`btn-primary story-btn-inv ${FOCUS}`}><Icon name="whatsapp" /> {L("Claim on WhatsApp", "WhatsApp पर लें")}</a>}
        </section>
      );
      case "contact": return (
        <section key={i} className={`${base} hero-dark justify-center`}>
          <Head eyebrow={L("Reach us", "संपर्क")} title={m.name} tone="dark" />
          {map?.address && <p className="story-addr"><Icon name="pin" className="story-addr-ic" /> {t(map.address)}</p>}
          <TrustRow trust={m.trust} hours={m.hours ?? hours} hi={hi} className="story-trust" />
          <div className="story-actions">
            {wa && <a href={waHref()} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-story-whatsapp")} data-kind="whatsapp" className={`btn-primary hero-cta ${FOCUS}`}><Icon name="whatsapp" /> WhatsApp</a>}
            {phone && <a href={linkHref("phone", phone)} onClick={() => trackClick(card.username, "site-story-phone")} className={`btn-ghost ${FOCUS}`}><Icon name="phone" /> {L("Call now", "Call करें")}</a>}
            {map && <a href={map.url} target="_blank" rel="noreferrer" onClick={() => trackClick(card.username, "site-story-map")} className={`btn-ghost ${FOCUS}`}><Icon name="directions" /> {L("Directions", "रास्ता देखें")}</a>}
          </div>
          <p className="story-foot">Powered by Shubhora</p>
        </section>
      );
    }
  };

  const story = <StoryTrack count={slides.length} tones={tones} lang={lang} prev={L("Previous", "पिछला")} next={L("Next", "अगला")}>{slides.map(slide)}</StoryTrack>;

  return (
    <>
      {/* phone: the story is the page */}
      <div className="md:hidden" style={{ height: "calc(100svh - var(--site-top, 0px))" }}>{story}</div>
      {/* computer: the story in a plain frame, beside the business — the headline is printed once, in the frame */}
      <div className="story-desk hero-dark hidden md:flex" lang={lang}>
        <div className="story-desk-copy">
          {m.logo ? <Img src={m.logo} alt={m.name} className="story-logo" eager w={56} /> : <Wordmark name={m.name} trade={m.kicker} lang={lang} />}
          <TrustRow trust={m.trust} hours={m.hours ?? hours} hi={hi} />
          {qr && (
            <div className="story-qr">
              <Img src={qr} alt="QR code" className="story-qr-img" w={96} />
              <p>{L("Scan to open on your phone", "Phone पर खोलने के लिए scan करें")}</p>
            </div>
          )}
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="ghost" onBook={go} />
        </div>
        <div className="story-frame" title={L("Arrow keys move the slides", "Arrow keys से slides बदलें")}>{story}</div>
      </div>
    </>
  );
}

/** The slides, their progress bar and the tap zones; each copy (phone / the frame on a computer) keeps its own place. */
function StoryTrack({ count, tones, lang, prev, next, children }: { count: number; tones: Tone[]; lang: string; prev: string; next: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const on = () => setAt(Math.round(el.scrollTop / Math.max(1, el.clientHeight)));
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);
  const jump = (i: number) => { const el = ref.current; if (!el) return; const n = Math.max(0, Math.min(count - 1, i)); el.scrollTo({ top: n * el.clientHeight, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };
  useEffect(() => {
    // Only the copy that is on screen answers the keys (the other is display:none).
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current || ref.current.offsetParent === null) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); jump(at + 1); } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); jump(at - 1); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, count]);
  return (
    <div className="story relative h-full w-full overflow-hidden" lang={lang}>
      {/* progress: 2 px segments, the slide's own text colour at 40 %, no blend mode, no "1/9" badge */}
      <div className="story-progress" aria-hidden="true" data-tone={tones[Math.min(at, tones.length - 1)] ?? "dark"}>
        {Array.from({ length: count }).map((_, i) => <span key={i} data-done={i <= at ? "" : undefined}><span /></span>)}
      </div>
      {/* tap zones: the top half of a slide, left back / right on — the buttons and links live in the lower half */}
      <button type="button" aria-label={prev} onClick={() => jump(at - 1)} className="absolute left-0 top-0 z-20 h-[55%] w-[30%] cursor-w-resize opacity-0" />
      <button type="button" aria-label={next} onClick={() => jump(at + 1)} className="absolute right-0 top-0 z-20 h-[55%] w-[70%] cursor-e-resize opacity-0" />
      <div ref={ref} className="story-track h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "none" }}>
        {children}
      </div>
    </div>
  );
}

/** The Story's rules, inlined with the tokens by site-view. HERO_CSS (the shared hero pieces) rides along until
 *  site-view inlines it for every blueprint — the rules are idempotent, so a second copy costs bytes only. */
export const STORY_CSS = `
.site[data-story] header.site-head,.site[data-story] .site-bar{display:none}
.site[data-story] main{padding-bottom:0}
.story-track::-webkit-scrollbar,.story-rail::-webkit-scrollbar{display:none}
.site .story{background:var(--paper);color:var(--ink);--t-display:52px;--t-h2:30px;--t-kicker:11px;--t-sub:17px;--t-body:15px;--t-meta:13px;--t-cta:15px;--gutter:24px}
.site .story-slide{height:100%;padding:var(--gutter)}
.site .story .display[data-len=long]{--t-display:44px}
.site .story .display:lang(hi),.site .story-desk .display:lang(hi){font-size:calc(var(--t-display) * .88);line-height:1.22;letter-spacing:0;font-weight:var(--display-w-hi,600)}
.site .story .kicker:lang(hi),.site .story-desk .kicker:lang(hi){letter-spacing:0;text-transform:none;font-size:13px}
.site .story-h2:lang(hi),.site .story-quote:lang(hi),.site .story-offer:lang(hi){line-height:1.25;letter-spacing:0}
/* progress */
.site .story-progress{position:absolute;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top,0px));z-index:30;display:flex;gap:4px;pointer-events:none;color:var(--hero-text)}
.site .story-progress[data-tone=light]{color:var(--ink)}
.site .story-progress[data-tone=accent]{color:var(--on-accent)}
.site .story-progress>span{position:relative;flex:1;height:2px;overflow:hidden;background:currentColor;opacity:.4;transition:opacity .3s ease}
.site .story-progress>span[data-done]{opacity:1}
.site .story-progress>span>span{position:absolute;inset:0;background:currentColor}
/* slide 1 */
.site .story-cover{justify-content:flex-end;padding-bottom:calc(52px + env(safe-area-inset-bottom,0px))}
.site .story-cover .story-ph{position:absolute;inset:0;z-index:0}
.site .story-cover[data-variant=slide-photo] .hero-ph{filter:saturate(.85) contrast(1.05)}
.site .story-cover .hero-ph-wrap[data-bright] .hero-ph{filter:saturate(.85) contrast(1.05)}
.site .story-tint{position:absolute;inset:0;z-index:1;background:var(--accent);mix-blend-mode:multiply;opacity:.2;pointer-events:none}
.site .story-scrim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to top,var(--scrim-bot) 0%,var(--scrim-bot) 12%,var(--scrim-mid) 40%,var(--scrim-top) 65%)}
.site .story-mark{position:absolute;left:var(--gutter);top:calc(28px + env(safe-area-inset-top,0px));z-index:2;color:var(--hero-text);pointer-events:none}
.site .story-cover[data-variant=slide-type] .story-mark{color:var(--ink)}
.site .story-mark-logo{height:40px;width:auto;max-width:160px;object-fit:contain}
.site .story-copy{position:relative;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:var(--s3);max-width:var(--hero-col)}
.site .story-copy .display{margin-top:var(--s1)}
.site .story-copy .hero-sub{margin-bottom:var(--s2)}
.site .story-cta{width:100%;max-width:360px;justify-content:center}
.site .story-meta{display:flex;flex-wrap:wrap;align-items:center;column-gap:.5em;margin:var(--s1) 0 0;font-size:var(--t-meta);font-weight:500;line-height:1.4;color:var(--hero-muted);font-variant-numeric:tabular-nums}
.site .story-meta>span{display:inline-flex;align-items:center}
.site .story-meta .open-dot{display:inline-block;width:8px;height:8px;border-radius:9999px;background:var(--wa-dark);margin-right:.45em}
.site .story-meta [data-state=closed] .open-dot{background:var(--hero-muted)}
.site .story-meta .story-dot{opacity:.6}
.site .story-cover:not(.hero-dark) .story-meta{color:var(--muted)}
.site .story-cover:not(.hero-dark) .story-meta .open-dot{background:var(--wa)}
.site .story-cue{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2;display:flex;justify-content:center;align-items:center;gap:4px;margin:0;font-size:12px;line-height:1;letter-spacing:.04em;color:var(--hero-text);opacity:.6;pointer-events:none}
.site .story-cover:not(.hero-dark) .story-cue{color:var(--ink)}
.site .story-cue-ic{transform:rotate(180deg)}
/* slide-duo: the photo on top with a hard edge, a paper panel under it, no scrim */
.site .story-cover[data-variant=slide-duo]{background:var(--paper);color:var(--ink);--t-display:48px;justify-content:flex-end}
.site .story-cover .story-duo-ph{inset:0 0 auto;height:55%}
/* slide-ink / slide-type: a field of ink (or paper) with the headline a notch larger; a still-life only from the owner's own product shot */
.site .story-cover[data-variant=slide-ink],.site .story-cover[data-variant=slide-type]{--t-display:56px}
.site .story-cover[data-variant=slide-type]{background:var(--paper);color:var(--ink)}
.site .story-still{position:absolute;left:var(--gutter);right:var(--gutter);top:calc(40px + env(safe-area-inset-top,0px));height:36%;z-index:0;background:var(--paper-2);border-radius:var(--r-img);overflow:hidden}
.site .story-still-img{width:100%;height:100%;object-fit:contain;padding:var(--s4)}
.site .story-cover .hero-grain{z-index:0}
/* slides 2–9: paper / paper-2 / ink / accent, the tokens only */
.site .story-paper{background:var(--paper);color:var(--ink)}
.site .story-paper2{background:var(--paper-2);color:var(--ink)}
.site .story-accent{background:var(--accent);color:var(--on-accent)}
.site .story-h2{font-family:var(--font-display,var(--look-head));font-size:var(--t-h2);line-height:1.05;letter-spacing:-.015em;font-weight:var(--display-w,var(--head-w,500));text-wrap:balance;margin:var(--s2) 0 0}
.site .story .kicker{margin:0}
.site .story-accent .kicker,.site .story-kicker-inv{color:inherit;opacity:.8}
.site .story-lines{list-style:none;margin:var(--s5) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s3)}
.site .story-lines li{display:flex;align-items:baseline;gap:var(--s3);font-family:var(--font-display,var(--look-head));font-size:22px;line-height:1.15;letter-spacing:-.01em;font-weight:var(--display-w,var(--head-w,500))}
.site .story-num{font-family:var(--font-text,var(--look-body));font-size:13px;font-weight:600;color:var(--accent);font-variant-numeric:tabular-nums}
.site .story-body{margin:var(--s5) 0 0;font-size:var(--t-body);line-height:var(--body-lh,1.6);color:var(--muted);max-width:40ch}
.site .story-rail{display:flex;gap:var(--s3);overflow-x:auto;padding:var(--s5) var(--gutter) var(--s2);scroll-padding-inline:var(--gutter);scrollbar-width:none}
.site .story-card{flex:0 0 66%;scroll-snap-align:start;overflow:hidden;text-align:left;padding:0}
.site .story-card-ph{position:relative;aspect-ratio:1;background:var(--paper-2);border-radius:var(--r-img);overflow:hidden}
.site .story-card-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:var(--s4)}
.site .story-card-ini{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-display,var(--look-head));font-size:48px;color:var(--ink);opacity:.2}
.site .story-card-txt{padding:var(--s3) var(--s1) 0}
.site .story-card-name{margin:0;font-size:15px;font-weight:500;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.site .story-card-price{margin:2px 0 0;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.site .story-more{margin:var(--s3) 0 0;align-self:flex-start;color:var(--accent)}
.site .story-more-rail{margin-inline:var(--gutter)}
.site .story-why{list-style:none;margin:var(--s5) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s3)}
.site .story-why li{display:flex;align-items:flex-start;gap:var(--s3);font-size:18px;line-height:1.35}
.site .story-check{flex:none;margin-top:4px;color:var(--hero-text);opacity:.8}
.site .story-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);margin-top:var(--s4)}
.site .story-grid-ph{position:relative;aspect-ratio:1;border-radius:var(--r-img);overflow:hidden;background:var(--paper-2)}
.site .story-grid-wide{grid-column:span 2;aspect-ratio:2/1}
.site .story-grid-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site .story-stars{display:flex;gap:2px;margin-top:var(--s5);color:var(--star)}
.site .story-star-off{opacity:.25}
.site .story-quote{margin:var(--s4) 0 0;font-family:var(--font-display,var(--look-head));font-style:italic;font-size:26px;line-height:1.25;letter-spacing:-.01em;font-weight:var(--display-w,var(--head-w,400));text-wrap:pretty}
.site .story-rule{display:block;width:32px;height:1px;background:var(--accent);margin-top:var(--s5)}
.site .story-by{margin:var(--s3) 0 0;font-size:13px;font-weight:500;color:var(--muted)}
.site .story-offer{margin:var(--s2) 0 0;font-family:var(--font-display,var(--look-head));font-size:30px;line-height:1.05;letter-spacing:-.015em;font-weight:var(--display-w,var(--head-w,500));text-wrap:balance}
.site .story-accent>svg+div{margin-top:var(--s5)}
.site .story-code{margin:var(--s4) 0 0;font-size:15px}
.site .story-code b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;border:1px solid currentColor;border-radius:var(--r-ctl);padding:2px 8px;margin-left:2px}
.site .story .story-btn-inv{margin-top:var(--s6);align-self:flex-start;background:var(--on-accent);color:var(--accent)}
.site .story-addr{display:flex;align-items:flex-start;gap:var(--s2);margin:var(--s4) 0 0;font-size:15px;line-height:1.5;color:var(--hero-text);opacity:.9}
.site .story-addr-ic{flex:none;margin-top:3px}
.site .story-trust{margin-top:var(--s3)}
.site .story-actions{display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s6)}
.site .story-actions>a{width:100%}
.site .story-foot{margin:var(--s5) 0 0;font-size:12px;color:var(--hero-muted)}
/* computer: a plain ink field; the business on the left, the slides in a plain 390×780 frame on the right */
.site .story-desk{min-height:100svh;align-items:center;justify-content:center;gap:var(--s9);padding:var(--s8) var(--gutter)}
.site .story-desk-copy{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s5);max-width:520px}
.site .story-desk-copy .hero-ctas{flex-wrap:nowrap}
.site .story-desk-copy .hero-wordmark{font-size:15px}
.site .hero-dark .hero-wordmark small{color:var(--hero-muted)}
.site .story-logo{height:56px;width:auto;max-width:200px;object-fit:contain}
.site .story-qr{display:flex;align-items:center;gap:var(--s4)}
.site .story-qr p{margin:0;max-width:16ch;font-size:var(--t-meta);line-height:1.4;color:var(--hero-muted)}
.site .story-qr-img{width:96px;height:96px;flex:none;background:#fff;border-radius:var(--r-img);padding:6px}
.site .story-frame{position:relative;width:390px;height:780px;flex:none;overflow:hidden;border-radius:20px;border:1px solid var(--hero-line);background:var(--paper);color:var(--ink)}
@media (prefers-reduced-motion: reduce){.site .story-progress>span{transition:none}}
`;
