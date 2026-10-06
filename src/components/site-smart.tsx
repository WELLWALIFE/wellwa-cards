"use client";
// The website's shared "smart" pieces (docs/website-looks-v2.md §4): small, content-driven, on every blueprint and
// on older sites too. Each one shows nothing when the card lacks what it needs, and every animation is CSS on
// transform / opacity only and stops under prefers-reduced-motion.
//
// The hero pieces (docs/premium-look.md §3.1, §3.2, §3.8) sit here too: <Kicker>, <Display>, <Sub>, <TrustRow>,
// <CtaPair>, <Wordmark>, <HeroPhoto> and HERO_CSS — the one set of parts all four heroes (board / cover / slide /
// classic) are built from, fed by `heroModel()` (src/lib/site-hero.ts). Everything a visitor must read is in the
// server HTML: the open state is seeded on the server, a stat shows its final number before any script runs.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { openNow, type HoursRow, type OpenState } from "@/lib/open-now";
import type { HeroModel } from "@/lib/site-hero";
import { Icon, type IconName } from "@/components/site-icons";
import { Pic } from "@/components/pic";
import { trackClick } from "@/lib/track";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- open now ---------- */

/** The shop's state right now (IST), recomputed every minute; null when the hours cannot be read. The first value is
 *  computed during render — on the server too — so the HTML already says "Open · till 9 pm" before any script runs. */
export function useOpenNow(rows: HoursRow[] | undefined): OpenState | null {
  const [state, setState] = useState<OpenState | null>(() => (rows?.length ? openNow(rows) : null));
  useEffect(() => {
    if (!rows?.length) { setState(null); return; }
    const tick = () => setState(openNow(rows));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [rows]);
  return state;
}

/** "● Open now · till 8 pm" / "● Closed · opens 10 am" as a chip; `tone` matches the surface it sits on. */
export function OpenNowChip({ rows, hi, tone = "light", className = "" }: { rows: HoursRow[] | undefined; hi: boolean; tone?: "light" | "dark" | "glass"; className?: string }) {
  const s = useOpenNow(rows);
  if (!s) return null;
  const open = s.state === "open";
  const dot = open ? "#22c55e" : "#f59e0b";
  const base = tone === "glass" ? "border-white/25 bg-white/10 backdrop-blur" : tone === "dark" ? "border-white/20 bg-white/10" : "border-border bg-surface";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${base} ${className}`} aria-live="polite">
      <span className="relative inline-flex h-2.5 w-2.5">
        {open && <span className="absolute inset-0 animate-ping rounded-full motion-reduce:hidden" style={{ background: dot, opacity: 0.6 }} />}
        <span className="relative inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
      </span>
      <span>{open ? (hi ? "अभी खुला है" : "Open now") : (hi ? "अभी बंद" : "Closed")}</span>
      <span className="opacity-70">· {hi ? s.noteHi : s.note}</span>
    </span>
  );
}

/* ---------- count-up ---------- */

/** "5000+" / "4.8★" / "Since 2015": the FINAL number is in the HTML; it counts up from zero only once it scrolls
 *  into view, with motion allowed. The text as is when it has no number. Never changes what the text says. */
export function CountUp({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = /^(\D*?)(\d[\d,]*)(\.\d+)?(.*)$/.exec(value);
  const target = m ? Number(m[2].replace(/,/g, "")) + Number(m[3] ?? 0) : null;
  const [shown, setShown] = useState<string>(value);
  useEffect(() => {
    const el = ref.current;
    setShown(value);
    if (!el || target === null || !m || reduced() || !("IntersectionObserver" in window)) return;
    if (el.closest('[data-motion="none"]')) return;
    // A year ("Since 2015") is a label, not a quantity: counting from 0 to 2015 would look like a clock going wrong.
    if (target >= 1900 && target <= 2100 && !m[3] && !/[+★%]/.test(m[4])) return;
    const decimals = m[3] ? m[3].length - 1 : 0;
    const grouped = m[2].includes(",");
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      // Zero only now, the moment it is seen: the number was real until this frame and is real again in 1.1 s.
      const t0 = performance.now(), dur = 1100;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        const n = target * e;
        const num = decimals ? n.toFixed(decimals) : (grouped ? Math.round(n).toLocaleString("en-IN") : String(Math.round(n)));
        setShown(`${m[1]}${num}${m[4]}`);
        if (p < 1) raf = requestAnimationFrame(step); else setShown(value);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={ref} className={`tabular-nums ${className ?? ""}`} style={style}>{shown}</span>;
}

/* ---------- hero pieces (premium-look.md §3.1) ---------- */

/** "JEWELLER · REWARI": the one small line above the headline. The CSS uppercases and tracks it — not in Hindi,
 *  where tracking breaks conjunct shaping (`:lang(hi)`), so the string stays mixed-case. */
export function Kicker({ children, className = "", lang }: { children: React.ReactNode; className?: string; lang?: string }) {
  if (!children) return null;
  return <p className={`kicker ${className}`} lang={lang}>{children}</p>;
}

/** The headline: largest, darkest, first-painted. `data-len="long"` at 28+ characters steps the size down one notch
 *  so it stays within two lines; `text-wrap: balance` keeps the two lines even. */
export function Display({ children, as: Tag = "h1", className = "", lang, id }: { children: string; as?: "h1" | "h2" | "p"; className?: string; lang?: string; id?: string }) {
  const long = Array.from(children ?? "").length >= 28;
  return <Tag className={`display ${className}`} data-len={long ? "long" : undefined} lang={lang} id={id}>{children}</Tag>;
}

/** The one line of benefit under the headline (≤ 90 chars, 34ch wide). */
export function Sub({ children, className = "", lang }: { children: React.ReactNode; className?: string; lang?: string }) {
  if (!children) return null;
  return <p className={`hero-sub ${className}`} lang={lang}>{children}</p>;
}

/** "★ 4.7 (31) · Est. 2015 · ● Open · till 9 pm" — at most three quiet facts, joined by a dot. The open state comes
 *  from the model (server-computed) and keeps ticking from `hours` once scripts run. Nothing → nothing. */
export function TrustRow({ trust, hours, hi, className = "" }: { trust: HeroModel["trust"]; hours?: HoursRow[]; hi: boolean; className?: string }) {
  const live = useOpenNow(hours);
  const open = live ? { state: live.state, until: hi ? live.noteHi : live.note } : trust.open;
  const items: React.ReactNode[] = [];
  if (trust.rating) items.push(<span key="r" className="hero-trust-item"><Icon name="star" size={13} fill className="hero-star" /> {trust.rating.v.toFixed(1)} <span className="hero-trust-n">({trust.rating.n})</span></span>);
  if (trust.since) items.push(<span key="s" className="hero-trust-item">{hi ? `${trust.since} से` : `Est. ${trust.since}`}</span>);
  if (open) items.push(<span key="o" className="hero-trust-item" data-state={open.state}><i aria-hidden="true" className="open-dot" />{open.state === "open" ? (hi ? "खुला" : "Open") : (hi ? "बंद" : "Closed")} · {open.until}</span>);
  if (!items.length) return null;
  return <p className={`trust-row ${className}`} aria-live={hours ? "polite" : undefined}>{items.slice(0, 3)}</p>;
}

/** ONE filled button (WhatsApp, else Call, else Book) and one plain one. `secondaryStyle` = ghost (bordered) on paper
 *  heroes, link (text + arrow) over a photo. `onBook` handles a "#slug" href inside the site's own router. */
export function CtaPair({ primary, secondary, username, secondaryStyle = "ghost", onBook, className = "" }: {
  primary: HeroModel["primary"]; secondary?: HeroModel["secondary"]; username: string; secondaryStyle?: "ghost" | "link"; onBook?: (slug: string) => void; className?: string;
}) {
  const icon = (kind: "whatsapp" | "call" | "book"): IconName => (kind === "whatsapp" ? "whatsapp" : kind === "call" ? "phone" : "calendar");
  const book = (href: string) => (e: React.MouseEvent) => { if (onBook && href.startsWith("#")) { e.preventDefault(); onBook(href.slice(1)); } };
  const ext = primary.kind === "whatsapp" ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <div className={`hero-ctas ${className}`}>
      <a href={primary.href} {...ext} data-kind={primary.kind} className="btn-primary hero-cta"
        onClick={(e) => { trackClick(username, `site-hero-${primary.kind}`); book(primary.href)(e); }}>
        <Icon name={icon(primary.kind)} /> <span>{primary.label}</span>
      </a>
      {secondary && (
        <a href={secondary.href} data-kind={secondary.kind} className={secondaryStyle === "link" ? "btn-link hero-cta" : "btn-ghost hero-cta"}
          onClick={(e) => { trackClick(username, `site-hero-${secondary.kind}`); book(secondary.href)(e); }}>
          {secondaryStyle === "ghost" && <Icon name={icon(secondary.kind)} />} <span>{secondary.label}</span>
          {secondaryStyle === "link" && <Icon name="arrow-right" />}
        </a>
      )}
    </div>
  );
}

/** The name set in the display face (15 px, tracking .06em) with the trade in small caps under it — the nav's mark
 *  when the owner has no logo. The monogram square never reaches the website. */
export function Wordmark({ name, trade, className = "", lang }: { name: string; trade?: string; className?: string; lang?: string }) {
  return <span className={`hero-wordmark ${className}`} lang={lang}><b>{name}</b>{trade && <small>{trade}</small>}</span>;
}

/** What the photo is cropped to, which decides the srcset candidate the browser should take. The stock banners are
 *  1600×600: a portrait phone crop (390×560 at 2×) through object-fit: cover needs the FULL width, or the 828 px
 *  candidate is scaled ~5× and blurs. Rule: candidate = max(cropW × dpr, cropH × dpr × imgW/imgH); 1600×600 assumed. */
export type HeroCrop = "cover" | "tile" | "split";
export function heroSizes(crop: HeroCrop): string {
  // cover: 9:16 on a phone (full width needed), 16:9 on a desktop (100vw is right).
  // tile / split: 4:5 or 4:3 at ≤ 650 css px — the height × 2.67 is always more than the width → full width.
  return crop === "cover" ? "(max-width: 767px) 1600px, 100vw" : "1600px";
}

/** The hero picture (§3.2): LQIP as a plain background under it (browser upscale, no blur filter), the card's subject
 *  point as object-position, a scrim only where the text sits (bottom, plus the text side on desktop), grain on dark
 *  heroes on desktop only, Ken Burns on desktop only and off for a bright photo, a clip or reduced motion. The clip
 *  (Premium) plays over it: `clipOn="desktop"` keeps the poster on phones (the cover), "always" on a slide. */
export function HeroPhoto({ photo, clip, clipOn = "always", crop = "cover", priority = false, lazy = false, scrim = false, side = "left", grain = false, kenBurns = false, alt = "", className = "", sizes }: {
  photo?: HeroModel["photo"]; clip?: HeroModel["clip"]; clipOn?: "always" | "desktop"; crop?: HeroCrop;
  /** The LCP image (cinematic, story, classic photo): fetched first. */ priority?: boolean;
  /** Below the fold (the phone bento tile): loading="lazy". */ lazy?: boolean;
  scrim?: boolean; /** Where the words sit; "right" mirrors the desktop side scrim. */ side?: "left" | "right" | "center";
  grain?: boolean; kenBurns?: boolean; alt?: string; className?: string; sizes?: string;
}) {
  // Data saver cannot be read in CSS; it switches the motion off after the first paint (nothing else changes).
  const [still, setStill] = useState(false);
  useEffect(() => { if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) setStill(true); }, []);
  if (!photo && !clip) return null;
  const lqip = photo?.lqip ? (photo.lqip.startsWith("data:") ? photo.lqip : `data:image/webp;base64,${photo.lqip}`) : undefined;
  const kb = kenBurns && !still && !clip && !photo?.bright;
  return (
    <div className={`hero-ph-wrap hero-ph-in ${className}`} style={lqip ? { backgroundImage: `url(${lqip})` } : undefined}
      data-bright={photo?.bright ? "" : undefined} data-side={side} data-clip={clip ? clipOn : undefined}>
      {photo && <Pic src={photo.src} alt={alt} className={`hero-ph ${kb ? "hero-kb" : ""}`} style={{ objectPosition: photo.focus }}
        priority={priority} eager={!lazy && !priority} sizes={sizes ?? heroSizes(crop)} aria-hidden={alt ? undefined : true} />}
      {clip && <video src={clip.url} poster={clip.poster || undefined} className="hero-clip" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />}
      {scrim && <div aria-hidden="true" className="hero-scrim" />}
      {grain && <i aria-hidden="true" className="hero-grain" />}
    </div>
  );
}

/* ---------- marquee ---------- */

/** A slow, seamless strip of children (photos, reviews); pauses under a finger or the pointer; still under reduced
 *  motion. `speed` is seconds per loop. The track is doubled so the loop never shows a gap. */
export function Marquee({ children, speed = 40, className = "", gap = "gap-4" }: { children: React.ReactNode[]; speed?: number; className?: string; gap?: string }) {
  if (!children.length) return null;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)" }}>
      <div className={`site-marquee flex w-max ${gap} px-2`} style={{ animationDuration: `${speed}s` }}>
        {children}
        {children.map((c, i) => <span key={`dup-${i}`} aria-hidden="true" className="contents">{c}</span>)}
      </div>
    </div>
  );
}

/* ---------- bottom sheet ---------- */

/** A sheet rising from the bottom (phones) / a centred panel (desktop) over the page; Escape, the backdrop, the X
 *  and the browser's Back all close it (it pushes a history entry so Back does not leave the site). Page scroll
 *  is held while it is open. */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    document.body.setAttribute("data-sheet", "1");
    history.pushState({ sheet: 1 }, "");
    const onPop = () => closeRef.current();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { history.back(); } };
    window.addEventListener("popstate", onPop); window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev; document.body.removeAttribute("data-sheet");
      window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey);
      if (history.state?.sheet) history.back();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={() => history.back()} className="absolute inset-0 bg-black/55 backdrop-blur-[2px] site-fade" />
      <div className="site-sheet relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-float md:max-h-[88vh] md:w-[min(960px,92vw)] md:rounded-3xl">
        <div className="flex items-center justify-between gap-4 px-5 pt-3 pb-2 md:px-7 md:pt-5">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-border md:hidden" />
          {title ? <p className="mt-2 truncate text-[15px] font-semibold md:mt-0">{title}</p> : <span />}
          <button type="button" onClick={() => history.back()} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface hover:bg-surface2"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 md:px-7 md:pb-10" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>
  );
}

/** CSS for the pieces above (one string, put in the site's inline <style>). The reveal is opacity + transform only:
 *  a blur filter on a rising section repaints it every frame and is on the premium-look remove list. */
export const SMART_CSS = `
@keyframes site-sheet-up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
@keyframes site-fade{from{opacity:0}to{opacity:1}}
@keyframes site-kb{from{transform:scale(1) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-1%)}}
.site-sheet{animation:site-sheet-up .32s cubic-bezier(.2,.8,.2,1)}
.site-fade{animation:site-fade .25s ease-out}
.site .kb{animation:site-kb 22s ease-in-out infinite alternate;will-change:transform}
.site.js [data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .75s cubic-bezier(.2,.7,.2,1),transform .75s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i,0)*70ms)}
.site.js [data-reveal].in{opacity:1;transform:none}
body[data-sheet] .site-bar{transform:translateY(110%)}
.site-bar{transition:transform .25s ease}
@media (prefers-reduced-motion: reduce){.site-sheet,.site-fade,.site .kb{animation:none}.site.js [data-reveal]{opacity:1;transform:none;transition:none}}
`;

/** The hero rules that are NOT in globals.css (premium-look.md §3.1, §3.2, §3.8), inlined with the tokens: the photo
 *  wrapper (LQIP under the picture), the clip, the bright-photo and text-side rules, Ken Burns, the sub line, the CTA
 *  row and the wordmark, plus the motion guards. The shared classes — `.kicker .display .trust-row .open-dot
 *  .btn-primary .btn-ghost .btn-link .hero-dark .hero-ph .hero-scrim .hero-grain .hero-stagger .hero-ph-in` — live in
 *  globals.css under `.site`, and the pieces above wear those names. A hero section whose text sits on the photo or
 *  on the ink field carries `hero-dark`; its text column carries `hero-stagger` (kicker → H1 → sub → CTA, 50 ms). */
export const HERO_CSS = `
@keyframes hero-kb{from{transform:scale(1)}to{transform:scale(1.06)}}
.site .hero-sub{margin:0;max-width:34ch;font-size:var(--t-sub);line-height:1.45;text-wrap:pretty;color:var(--muted)}
.site .hero-sub:lang(hi){line-height:1.6}
.site .hero-dark .hero-sub{color:var(--hero-text);opacity:.9}
.site .hero-trust-item{display:inline-flex;align-items:center;gap:.3em;white-space:nowrap}
.site .hero-trust-n{opacity:.7}.site .hero-star{color:var(--star)}
.site [data-state=closed] .open-dot{background:var(--muted)}
.site .hero-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s4)}
.site .hero-cta[data-kind=whatsapp] svg{color:var(--wa)}
.site .hero-dark .hero-cta[data-kind=whatsapp] svg{color:inherit}
.site .hero-wordmark{display:inline-flex;flex-direction:column;line-height:1.1;font-family:var(--font-display,var(--look-head));font-weight:var(--display-w,var(--head-w,500));font-size:15px;letter-spacing:.06em;color:inherit}
.site .hero-wordmark small{font:500 11px/1.3 var(--font-text,var(--look-body));font-variant:small-caps;letter-spacing:.08em;color:var(--muted)}
.site .hero-wordmark:lang(hi),.site .hero-wordmark:lang(hi) small{letter-spacing:0;font-variant:normal}
.site .hero-ph-wrap{position:relative;overflow:hidden;background:var(--paper-2) center/cover no-repeat}
.site .hero-clip{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:var(--focus,50% 35%);display:none}
.site .hero-ph-wrap[data-clip=always] .hero-clip{display:block}
.site .hero-ph-wrap[data-bright] .hero-ph{filter:saturate(.92)}
.site .hero-ph-wrap[data-bright] .hero-scrim{--scrim-bot:color-mix(in srgb,var(--hero-ink) 90%,transparent)}
@media (min-width:768px){
.site .hero-ph-wrap[data-clip=desktop] .hero-clip{display:block}
.site .hero-kb{animation:hero-kb 20s linear both;will-change:transform}
.site .hero-ph-wrap[data-clip] .hero-kb{animation:none}
}
@media (min-width:1024px){
.site .hero-ph-wrap[data-side=right] .hero-scrim::after{background:linear-gradient(to left,var(--scrim-mid),transparent 60%)}
.site .hero-ph-wrap[data-side=center] .hero-scrim::after{display:none}
}
@media (prefers-reduced-motion: reduce){.site .hero-kb{animation:none}.site .hero-stagger>*{animation-name:hero-fade}}
.site[data-motion=none] .hero-kb,.site[data-motion=none] .hero-stagger>*,.site[data-motion=none] .hero-ph-in{animation:none}
`;
