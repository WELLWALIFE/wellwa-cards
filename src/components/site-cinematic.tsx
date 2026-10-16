"use client";
// The Cinematic blueprint (docs/website-looks-v2.md §3.2, premium-look.md §3.4): a full-bleed photo cover with the
// words bottom-left, a nav that only appears once the hero is scrolled, photo bands that move slower than the page
// between the scenes, and one big review that fades to the next.
//
// The hero is `heroModel()` drawn with the shared pieces (site-smart.tsx): kicker · headline (a claim, never the
// slug) · one line of benefit · the trust row · ONE paper-filled button + the phone as a text link. The photo is
// dimmed only at the bottom where the words sit (plus the text side on desktop), Ken Burns runs on desktop only,
// and a card without a photo or clip gets the `cover-ink` field (ink, grain on desktop, type-led).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Card, TestimonialItem } from "@/lib/types";
import { heroModel, ownUpload } from "@/lib/site-hero";
import { Kicker, Display, Sub, TrustRow, CtaPair, HeroPhoto } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { HeroArt, artKind } from "@/components/site-heroart";
import { tradeMood } from "@/lib/trade-moods";
import { Pic as Img } from "@/components/pic";

/** The owner's own product shot for the no-photo hero's still-life (never a stock, sample or AI picture). */
function ownStill(card: Card): string | undefined {
  for (const p of card.pages) {
    if (p.hidden) continue;
    for (const b of p.blocks) {
      if (b.kind !== "product") continue;
      for (const it of b.items) { const u = it.images?.[0] ?? it.imageUrl; if (ownUpload(u)) return u; }
    }
  }
  return undefined;
}

/** The old props (photo, focus, phone, wa, waHref, hours, eyebrow, pills) are still accepted so site-view compiles;
 *  the hero reads everything from `heroModel(card)` and only falls back to `clip` / `textSide` when the model lacks them. */
export function CinematicHero({ card, hi, t, clip, textSide }: {
  card: Card; hi: boolean; t: (s: string) => string; photo?: string; clip?: { url: string; poster?: string }; focus?: string; textSide?: "left" | "right" | "center";
  phone?: string; wa?: string; waHref: (text?: string) => string; hours?: { day: string; time: string }[]; eyebrow?: string; pills?: string[];
}) {
  const m = heroModel(card, hi ? "hi" : "en");
  const lang = hi ? "hi" : undefined;
  const clipM = m.clip ?? (clip?.url && m.variant === "cover" ? { url: clip.url, poster: clip.poster ?? m.photo?.src ?? "" } : undefined);
  const ink = !m.photo && !clipM;
  const still = ink ? ownStill(card) : undefined;
  // `center` only for cover-centre (hotels, banquets, events); otherwise the side the subject leaves empty.
  const side = m.variant === "cover-centre" ? "center" : textSide === "right" ? "right" : "left";
  return (
    <section className={`cin-hero hero-dark ${ink ? "cin-ink" : "cin-cover"}`} data-side={side} aria-label={m.name}>
      {!ink && <HeroPhoto photo={m.photo} clip={clipM} clipOn="desktop" crop="cover" priority scrim side={side} grain={!!m.photo?.dark} kenBurns className="cin-ph" />}
      {ink && <i aria-hidden="true" className="hero-grain" />}
      {ink && <HeroArt kind={artKind(card.seo?.categoryKey)} tone={tradeMood(card.seo?.categoryKey).luxe ? "gold" : "light"} />}
      <div className="cin-body">
        <div className="cin-col hero-stagger">
          <Kicker lang={lang}>{t(m.kicker)}</Kicker>
          <Display lang={lang}>{t(m.headline)}</Display>
          <Sub lang={lang}>{t(m.sub)}</Sub>
          <TrustRow trust={m.trust} hours={m.hours} hi={hi} />
          <i aria-hidden="true" className="cin-rule" />
          <CtaPair primary={m.primary} secondary={m.secondary} username={card.username} secondaryStyle="link" />
        </div>
        {still && <div className="cin-still"><Img src={still} alt="" className="cin-still-img" sizes="(max-width: 1023px) 100vw, 480px" eager /></div>}
      </div>
      <div aria-hidden="true" className="cin-cue"><i /><span>{hi ? "नीचे" : "Scroll"}</span></div>
    </section>
  );
}

/** A photo band between two scenes that moves at a third of the page's speed (transform only; still under reduced motion). */
export function ParallaxBand({ src, alt = "", caption }: { src: string; alt?: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // The picture is laid out 24% taller than the band and only slides inside that spare height, with a slow zoom of 5%
  // across the pass: no fixed 1.25 scale (that upscaled a 1400 px photo and blurred it), and the first position is set
  // before paint, so nothing jumps when the band comes into view (owner, 14 Oct 2026).
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const img = el.firstElementChild as HTMLElement | null; if (!img) return;
    let raf = 0;
    const place = () => {
      const r = el.getBoundingClientRect(), vh = window.innerHeight || 800;
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      img.style.transform = `translate3d(0, ${((p - 0.5) * 0.2 * r.height).toFixed(1)}px, 0) scale(${(1 + 0.05 * p).toFixed(4)})`;
    };
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    place(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  // 2026-10-16: a portrait or boxed product shot cropped to a 1440x520 band showed a meaningless slice (the buttons of a
  // purifier). Once the photo's size is known, one much narrower than the band is shown whole over a blurred copy of itself.
  const [contain, setContain] = useState(false);
  useEffect(() => {
    const el = ref.current; const img = el?.querySelector("img"); if (!el || !img) return;
    const check = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const box = el.clientWidth / (el.clientHeight * 1.24);
      setContain(img.naturalWidth / img.naturalHeight < box * 0.6);
    };
    check(); img.addEventListener("load", check); window.addEventListener("resize", check);
    return () => { img.removeEventListener("load", check); window.removeEventListener("resize", check); };
  }, [src]);
  return (
    <div ref={ref} className="cin-band" aria-hidden={!alt} data-fit={contain ? "contain" : undefined} style={contain ? ({ "--band-src": `url("${src}")` } as React.CSSProperties) : undefined}>
      <Img src={src} alt={alt} className="cin-band-img" sizes="100vw" />
      {caption && <p className="cin-cap">{caption}</p>}
    </div>
  );
}

/** One big review at a time, fading to the next every few seconds; the marks under it pick one by hand.
 *  Display italic over a 1 px accent rule — no card, no yellow stars. */
export function QuoteRotator({ items, t }: { items: TestimonialItem[]; t: (s: string) => string }) {
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(true);
  const pending = useRef(0);
  useEffect(() => {
    if (items.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { setFade(false); pending.current = window.setTimeout(() => { setI((x) => (x + 1) % items.length); setFade(true); }, 350); }, 6000);
    return () => { clearInterval(id); window.clearTimeout(pending.current); };
  }, [items.length]);
  const r = items[i]; if (!r) return null;
  const stars = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 5)));
  return (
    <figure className="cin-quote">
      <i aria-hidden="true" className="cin-quote-rule" />
      <p className="cin-quote-stars" aria-label={`${stars} / 5`}>{Array.from({ length: 5 }).map((_, k) => <Icon key={k} name="star" size={14} fill={k < stars} className={k < stars ? "" : "cin-star-off"} />)}</p>
      <blockquote className="cin-quote-text" style={{ opacity: fade ? 1 : 0 }}>“{t(r.text)}”</blockquote>
      <figcaption className="cin-quote-name">{r.name}</figcaption>
      {items.length > 1 && <div className="cin-quote-dots">{items.map((_, k) => <button key={k} type="button" aria-label={`${k + 1} / ${items.length}`} aria-pressed={k === i} onClick={() => { window.clearTimeout(pending.current); setI(k); setFade(true); }} />)}</div>}
    </figure>
  );
}

/** The blueprint's CSS. The shared hero rules (photo wrapper, Ken Burns, sub line, CTA row, entrance) are HERO_CSS
 *  in site-smart.tsx and globals.css `.site`, which site-view inlines before this; only the cover's own rules sit here. */
export const CINEMATIC_CSS = `
.site[data-bp="cinematic"] .cin-hero{position:relative;display:flex;align-items:flex-end;min-height:100svh;overflow:hidden;background:var(--hero-ink);color:var(--hero-text)}
.site .cin-hero .hero-ph-wrap{position:absolute;inset:0}
/* A shade under the menu on the cover itself, so a white bar of text never lands on a pale part of the picture. */
.site .cin-cover::before{content:"";position:absolute;left:0;right:0;top:0;height:160px;z-index:1;pointer-events:none;background:linear-gradient(to bottom,rgb(0 0 0/.5),transparent)}
.site .cin-hero>.hero-grain{display:none}
.site .cin-body{position:relative;z-index:1;width:100%;max-width:calc(var(--content) + 2*var(--gutter));margin:0 auto;padding:var(--s9) var(--gutter) calc(var(--s5) + env(safe-area-inset-bottom,0px))}
.site .cin-col{display:flex;flex-direction:column;align-items:flex-start;max-width:var(--hero-col)}
.site .cin-col>.display{margin-top:var(--s4)}
.site .cin-col>.hero-sub{margin-top:var(--s5)}
.site .cin-col>.trust-row{margin-top:var(--s4)}
.site .cin-col>.hero-ctas{margin-top:var(--s6)}
.site .cin-rule{display:none;width:64px;height:1px;margin-top:var(--s6);background:var(--gold,var(--accent))}
.site .cin-rule+.hero-ctas{margin-top:var(--s5)}
.site .cin-hero[data-side="right"] .cin-col{margin-left:auto}
.site .cin-hero[data-side="center"] .cin-col{margin:0 auto;align-items:center;text-align:center}
.site .cin-hero[data-side="center"] .cin-rule{margin-left:auto;margin-right:auto}
.site .cin-hero .hero-ctas{row-gap:var(--s4)}
.site .cin-hero .btn-link{color:var(--hero-text)}
/* On a photo the small line above the headline must read: the muted hero tone vanished on mid-grey pictures (16 Oct 2026 review). */
.site .cin-hero .kicker{color:var(--hero-text);opacity:.88;text-shadow:0 1px 12px rgb(0 0 0/.35)}
.site .cin-hero.cin-ink .kicker{color:var(--gold,var(--hero-text));text-shadow:none}
/* The cover's phone headline (§3.4: 52 px, two lines): a notch over the shared scale, long claims still step down. */
@media (max-width:1023px){
.site .cin-hero .display{--t-display:clamp(2.75rem,13vw,3.25rem)}
.site .cin-hero .display[data-len="long"]{--t-display:2.75rem}
}
/* Element-level Hindi rules, so the H1 keeps its height and the kicker its shaping even before .site carries lang. */
.site .display:lang(hi){font-size:calc(var(--t-display) * .88);line-height:1.22;letter-spacing:0;font-weight:var(--display-w-hi,600)}
.site .kicker:lang(hi){letter-spacing:0;text-transform:none;font-size:13px}
/* The no-photo cover: the ink field, type-led; the owner's own product shot as a still-life when there is one. */
.site .cin-ink .cin-body{display:flex;flex-direction:column;gap:var(--s6)}
.site .cin-still{width:100%;max-width:360px;aspect-ratio:4/5;background:var(--paper-2);border-radius:var(--r-img);overflow:hidden}
.site .cin-still-img{width:100%;height:100%;object-fit:contain}
/* Scroll cue: a 1 px accent line and the word, bottom-right on desktop, no bounce. */
.site .cin-cue{position:absolute;right:var(--gutter);bottom:var(--s8);z-index:1;display:none;flex-direction:column;align-items:center;gap:var(--s3)}
.site .cin-cue i{display:block;width:1px;height:48px;background:var(--gold,var(--accent))}
.site .cin-cue span{font:600 9px/1 var(--font-text,var(--look-body));letter-spacing:.12em;text-transform:uppercase;color:var(--hero-muted)}
.site .cin-cue span:lang(hi){letter-spacing:0;text-transform:none;font-size:11px}
@media (min-width:1024px){
.site[data-bp="cinematic"] .cin-hero{min-height:88vh}
.site .cin-body{padding-bottom:var(--s9)}
.site .cin-rule,.site .cin-cue{display:flex}
.site .cin-ink .cin-body{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:var(--s8)}
.site .cin-ink .cin-still{max-width:420px;flex:0 0 auto}
.site .cin-ink .display{--t-display:6rem}
.site .cin-ink .display[data-len="long"]{--t-display:4.5rem}
}
/* Photo bands between scenes and the one big review. */
.site .cin-band{position:relative;height:46vh;min-height:260px;overflow:hidden;isolation:isolate;contain:paint}
@media (min-width:768px){.site .cin-band{height:58vh}}
.site .cin-band-img{position:absolute;left:0;top:-12%;width:100%;height:124%;object-fit:cover}
.site .cin-band[data-fit="contain"]::before{content:"";position:absolute;inset:-40px;z-index:-1;background:var(--band-src) center/cover;filter:blur(32px) saturate(1.1);opacity:.9}
.site .cin-band[data-fit="contain"] .cin-band-img{object-fit:contain}
.site .cin-cap{position:absolute;left:var(--gutter);bottom:var(--s5);margin:0;padding:var(--s2) var(--s3);font-size:var(--t-meta);font-weight:500;color:var(--hero-text);background:var(--scrim-bot);border-radius:var(--r-img)}
.site .cin-quote{margin:0 auto;max-width:720px;text-align:center}
.site .cin-quote-rule{display:block;width:48px;height:1px;margin:0 auto var(--s5);background:var(--accent)}
.site .cin-quote-stars{display:flex;justify-content:center;gap:2px;margin:0;color:var(--star,var(--accent))}
.site .cin-star-off{opacity:.3}
.site .cin-quote-text{margin:var(--s5) 0 0;font-family:var(--font-display,var(--look-head));font-style:italic;font-weight:var(--display-w,400);font-size:26px;line-height:1.3;letter-spacing:0;text-wrap:pretty;transition:opacity .3s ease}
.site .cin-quote-text:lang(hi){font-style:normal;line-height:1.5}
@media (min-width:1024px){.site .cin-quote-text{font-size:30px}}
.site .cin-quote-name{margin-top:var(--s4);font-size:var(--t-meta);font-weight:500;color:var(--muted)}
.site .cin-quote-dots{display:flex;justify-content:center;gap:var(--s2);margin-top:var(--s5)}
.site .cin-quote-dots button{width:20px;height:2px;padding:0;border:0;background:currentColor;opacity:.3;transition:opacity .2s ease}
/* A 2 px line is not a tap target: the button keeps its look and its hit area grows to 36 px high (QA sweep, 16 Oct 2026). */
.site .cin-quote-dots button{position:relative}.site .cin-quote-dots button::before{content:"";position:absolute;inset:-17px -4px}
.site .cin-quote-dots button[aria-pressed="true"]{opacity:1}
/* The nav shows only once the hero is scrolled; section headings and the product rail. */
.site[data-bp="cinematic"] header.site-head{position:fixed;left:0;right:0;top:0;transform:translateY(-100%);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.site[data-bp="cinematic"] header.site-head.scrolled{transform:none}
.site[data-bp="cinematic"][data-home] header.site-head:not(.scrolled){top:var(--ann-h,0px)}
/* The phone menu is open over the cover: the bar stays on screen (solid, see HEAD_CSS) instead of sliding away. */
.site[data-bp="cinematic"] header.site-head.menu-open{transform:none}
/* Inner pages keep the header; on the home it lies transparent over the cover until scrolled (review, 13 Oct 2026: no nav). */
.site[data-bp="cinematic"]:not([data-home]) header.site-head{position:sticky;transform:none}
/* A soft shade under the white name and menu: over a bright photo (a white dress, a pale wall) they vanished (15 Oct 2026 sweep). */
.site[data-bp="cinematic"][data-home] header.site-head:not(.scrolled):not(.menu-open){transform:none;background:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0))!important;border-color:transparent!important;backdrop-filter:none;color:#fff;--ink:#fff;--muted:rgba(255,255,255,.75);--border:rgba(255,255,255,.3)}
.site[data-bp="cinematic"][data-home] header.site-head:not(.scrolled):not(.menu-open) a,.site[data-bp="cinematic"][data-home] header.site-head:not(.scrolled):not(.menu-open) button{color:#fff}
/* The language pill is a paper chip: on the transparent bar it turned white-on-white and vanished (16 Oct 2026). */
.site[data-bp="cinematic"][data-home] header.site-head:not(.scrolled):not(.menu-open) [aria-label="Change language"]{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.38);backdrop-filter:blur(6px)}
.site[data-bp="cinematic"][data-home] header.site-head:not(.scrolled):not(.menu-open) .site-head-wa{background:#fff;color:#111}
.site[data-bp="cinematic"] main section h2{font-size:var(--t-h2);line-height:1.05;letter-spacing:-.015em}
.site[data-bp="cinematic"] .site-rail{display:flex;gap:1.25rem;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 1.25rem 1rem;margin:0 -1.25rem;scrollbar-width:none}
@media (min-width:768px){.site[data-bp="cinematic"] .site-rail{padding:0 1.5rem 1rem;margin:0 -1.5rem}}
.site[data-bp="cinematic"] .site-rail::-webkit-scrollbar{display:none}
.site[data-bp="cinematic"] .site-rail>*{flex:0 0 78vw;max-width:360px;scroll-snap-align:start}
@media (min-width:768px){.site[data-bp="cinematic"] .site-rail>*{flex-basis:340px}}
@media (prefers-reduced-motion: reduce){.site .cin-quote-text{transition:none}}
`;
