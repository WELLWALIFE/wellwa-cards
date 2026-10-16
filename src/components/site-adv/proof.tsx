"use client";
// Advanced-site GALLERY, PROOF and TRUST variants (owner, 16 Oct 2026: the Rs 5,999 site must not look like anyone else's,
// so each of these three sections has several real compositions, not one with new colours).
//
// GALLERY (the business's own photos; the lightbox is the page's, through x.zoom)
//   masonry         staggered columns of tall and wide frames, captions on hover / focus
//   filmstrip       one dark strip of large frames to swipe, with arrows, a counter and a progress line
//   bento           one large frame and a ring of smaller ones, laid out by how many photos there are
//   album-tabs      the owner's album headings (GalleryImage.group) as tabs; no groups -> a plain grid
//   lightbox-grid   an even, numbered grid; the last tile says "+N more"; one button opens everything
// PROOF (the owner's reviews; the page's own list is capped at three, these read the card for the rest)
//   review-wall     a masonry of review cards, one in the ink field
//   testimonial-carousel   one large quote at a time, swipe / arrows / dots
//   star-summary    the average and a 5-to-1 breakdown beside a stack of review cards
//   results-band    ink band: average, count and share of 5 stars as numbers, three short quotes under them
//   clients-strip   the customers' names as a "trusted by" ribbon, then the best review
// TRUST (the card's own numbers, 2-4 facts)
//   counters        large numbers on the ink field
//   icon-row        a line icon per fact
//   ticker          a slim accent band that scrolls the facts (still, and wrapped, under reduced motion)
//   split-cards     a statement on the left, the facts as cards on the right
//
// Every variant draws nothing when its slice of the content is too thin, and leaves out any part (caption, name, avatar,
// button) it has no material for. Colours, corners, spacing and faces come only from the spec's tokens (shared.tsx).
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CountUp } from "@/components/site-smart";
import { Icon, iconFor, type IconName } from "@/components/site-icons";
import { Btn, Eyebrow, H2, Head, Photo, Sec, Stars, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";

/* ================= shared helpers ================= */

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const first = (s: string) => (Array.from(s.trim())[0] ?? "").toUpperCase();
export const css = (v: Record<string, string | number>) => v as CSSProperties;

/** The pages the visitor can see (the same rule as buildContent). */
function visibleBlocks(x: AdvCtx) {
  const hidden = new Set(x.card.site?.hidden ?? []);
  return x.card.pages.filter((p) => !p.hidden && !hidden.has(p.slug)).flatMap((p) => p.blocks);
}

/* ---------- photos ---------- */

export type Frame = { url: string; label: string; group: string };
/** The photos the section shows: the gallery blocks in page order (with their album heading), then whatever else the page
 *  owns that is a picture (carousel / image blocks), one frame per address. content.ts caps its list at nine; the gallery
 *  variants take up to `max`, so a business that uploaded twenty photos is not cut to nine. */
export function framesOf(c: SiteContent, x: AdvCtx, max = 18): Frame[] {
  const own: Frame[] = [];
  for (const b of visibleBlocks(x)) if (b.kind === "gallery") for (const i of b.images) if (i.url) own.push({ url: i.url, label: (i.label ?? "").trim(), group: (i.group ?? "").trim() });
  const seen = new Set<string>();
  const out: Frame[] = [];
  for (const f of [...own, ...c.gallery.map((g) => ({ url: g.url, label: g.label, group: "" }))]) {
    if (!f.url || seen.has(f.url)) continue;
    seen.add(f.url); out.push(f);
  }
  return out.slice(0, max);
}

/** One photo as a button that opens the lightbox on `urls` at `i`. A caption (the owner's label) shows on hover / focus and
 *  always on a touch screen. */
export function FrameBtn({ f, i, urls, x, name, cls = "", style, sizes, label, children }: {
  f: Frame; i: number; urls: string[]; x: AdvCtx; name: string; cls?: string; style?: CSSProperties; sizes?: string; label?: string; children?: ReactNode;
}) {
  const cap = f.label ? x.t(f.label) : "";
  return (
    <button
      type="button" className={`gx-tile ${cls}`} style={style}
      onClick={() => { x.track("gallery-zoom"); x.zoom(urls, i, cap || name); }}
      aria-label={label ?? (cap || x.ui(`Open photo ${i + 1} of ${urls.length}`, `फ़ोटो ${i + 1} / ${urls.length} खोलें`))}
    >
      <Photo src={f.url} alt="" sizes={sizes} />
      {cap && <span className="gx-cap">{cap}</span>}
      {children}
    </button>
  );
}

/* ---------- reviews ---------- */

export type Rev = { name: string; text: string; rating: number };
export type Reviews = { all: Rev[]; rated: number; avg: number; total: number; dist: number[] };
/** Every review the visitor can see, best first (rating, then length: the order content.ts uses), with the average over the
 *  rated ones and how many gave 1..5 stars. content.ts hands the sections three; a wall, a carousel and a breakdown want all. */
export function reviewsOf(c: SiteContent, x: AdvCtx): Reviews {
  let raw = visibleBlocks(x).flatMap((b) => (b.kind === "testimonials" ? b.items : [])).filter((r) => (r.text ?? "").trim());
  if (!raw.length) raw = c.reviews.items;
  const all: Rev[] = raw
    .map((r) => ({ name: (r.name ?? "").trim(), text: r.text.trim(), rating: Math.min(5, Math.max(0, Math.round(Number(r.rating) || 0))) }))
    .sort((a, b) => (b.rating - a.rating) || (b.text.length - a.text.length));
  const rated = all.filter((r) => r.rating >= 1);
  const dist = [0, 0, 0, 0, 0];
  for (const r of rated) dist[r.rating - 1]++;
  return { all, rated: rated.length, avg: rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0, total: all.length, dist };
}
export const countLabel = (x: AdvCtx, n: number) => (x.hi ? `${n} रिव्यू` : `${n} review${n === 1 ? "" : "s"}`);

/** The average, five stars and the review count in one line (only when there are enough ratings to average). */
export function AvgLine({ r, x }: { r: Reviews; x: AdvCtx }) {
  if (r.rated < 3) return null;
  return <p className="prf-avg"><b>{r.avg.toFixed(1)}</b><Stars n={r.avg} size={16} /><span>{countLabel(x, r.total)}</span></p>;
}
/** A round monogram of the reviewer's name (nothing when the review has no name). */
export function Mono({ name }: { name: string }) {
  return name ? <span className="prf-av" aria-hidden="true">{first(name)}</span> : null;
}

/* ---------- trust ---------- */

type Fact = SiteContent["facts"][number];
/** The fact's own icon (from what it says), else a neutral tick; never a wrong glyph. */
export const factIcon = (f: Fact): IconName => iconFor(`${f.label} ${f.value}`) ?? (/★/.test(f.value) ? "star" : "check");
/** The number's size class by its length: "Since 2015" cannot be set as large as "12". */
export const lenOf = (v: string) => { const n = Array.from(v).length; return n <= 6 ? "s" : n <= 10 ? "m" : "l"; };

/* ---------- a slow ribbon ---------- */

/** A seamless ribbon of `items`, repeated until one copy is at least `min` items long. Hidden from assistive tech (the caller
 *  gives the same words once, as an sr-only list); still, and wrapped, under reduced motion or the spec's motion "none". */
export function Rail({ items, min, speed = 38, reverse = false }: { items: ReactNode[]; min: number; speed?: number; reverse?: boolean }) {
  if (!items.length) return null;
  const reps = Math.max(1, Math.ceil(min / items.length));
  const copy = (k: number) => (
    <div className="rl-copy" key={k}>
      {Array.from({ length: reps }, (_, r) => (
        <ul className="rl-set" key={r} data-rep={r || k ? "" : undefined}>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
      ))}
    </div>
  );
  return <div className="rl" aria-hidden="true"><div className="rl-track" style={{ animationDuration: `${speed}s`, ...(reverse ? { animationDirection: "reverse" as const } : {}) }}>{copy(0)}{copy(1)}</div></div>;
}

/* ================= GALLERY ================= */

export const MASONRY_AR = ["4/5", "1/1", "3/4", "5/4", "4/5", "3/2", "1/1", "3/4"];

/* ---------- masonry ---------- */
export function GalleryMasonry({ c, x, index }: VariantProps) {
  const fr = framesOf(c, x);
  if (fr.length < 3) return null;
  const urls = fr.map((f) => f.url);
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("Moments, framed", "कुछ यादगार पल")} />
      <div className="gx-masonry" data-big={fr.length >= 9 ? "" : undefined}>
        {fr.map((f, i) => (
          <FrameBtn key={f.url} f={f} i={i} urls={urls} x={x} name={c.name} style={{ aspectRatio: MASONRY_AR[i % MASONRY_AR.length] }} sizes="(min-width:1200px) 25vw, (min-width:768px) 33vw, 50vw" />
        ))}
      </div>
    </Sec>
  );
}

/* ---------- filmstrip ---------- */
const STRIP_AR = [0.8, 1.5, 1, 0.75, 1.33];
export function GalleryFilmstrip({ c, x }: VariantProps) {
  const fr = framesOf(c, x);
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  if (fr.length < 3) return null;
  const n = fr.length;
  const urls = fr.map((f) => f.url);
  const padL = (el: HTMLElement) => parseFloat(getComputedStyle(el).paddingLeft) || 0;
  // Which frame sits at the left edge: the nearest one, or the last once the strip cannot scroll further.
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) { setCur(kids.length - 1); return; }
    const left = el.scrollLeft + padL(el);
    let best = 0, d = Infinity;
    kids.forEach((k, i) => { const dd = Math.abs(k.offsetLeft - left); if (dd < d) { d = dd; best = i; } });
    setCur(best);
  };
  const go = (to: number) => {
    const el = ref.current; const k = el?.children[Math.max(0, Math.min(n - 1, to))] as HTMLElement | undefined;
    if (el && k) el.scrollTo({ left: k.offsetLeft - padL(el), behavior: reducedMotion() ? "auto" : "smooth" });
  };
  return (
    <Sec k="gallery" tone="ink" wide>
      <div className="gx-fs-top">
        <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("Take a closer look", "ज़रा क़रीब से देखें")} />
        <div className="gx-fs-ctl">
          <span className="gx-fs-count" aria-hidden="true">{pad2(cur + 1)} / {pad2(n)}</span>
          <button type="button" className="gx-round" data-flip="" onClick={() => go(cur - 1)} disabled={cur <= 0} aria-label={x.ui("Previous photo", "पिछली फ़ोटो")}><Icon name="arrow-right" size={18} /></button>
          <button type="button" className="gx-round" onClick={() => go(cur + 1)} disabled={cur >= n - 1} aria-label={x.ui("Next photo", "अगली फ़ोटो")}><Icon name="arrow-right" size={18} /></button>
        </div>
      </div>
      <div ref={ref} onScroll={onScroll} className="gx-fs-strip" tabIndex={0} role="region" aria-label={x.ui("Photo strip: scroll sideways", "फ़ोटो पट्टी: बग़ल में स्क्रोल करें")}>
        {fr.map((f, i) => (
          <FrameBtn key={f.url} f={f} i={i} urls={urls} x={x} name={c.name} cls="gx-fs-frame" style={css({ "--ar": STRIP_AR[i % STRIP_AR.length] })} sizes="(min-width:768px) 40vw, 80vw" />
        ))}
      </div>
      <span className="gx-fs-prog" aria-hidden="true"><i style={{ transform: `scaleX(${(cur + 1) / n})` }} /></span>
    </Sec>
  );
}

/* ---------- bento ---------- */
// [columns, rows] of every tile on the four-column desktop grid, by how many photos are drawn (3..7). Each table fills its
// grid with no hole; the grid packs "dense".
const BENTO: Record<number, [number, number][]> = {
  3: [[2, 2], [2, 1], [2, 1]],
  4: [[2, 2], [2, 1], [1, 1], [1, 1]],
  5: [[2, 2], [1, 1], [1, 2], [1, 1], [4, 1]],
  6: [[2, 2], [1, 1], [1, 2], [1, 1], [2, 1], [2, 1]],
  7: [[2, 2], [1, 1], [1, 2], [1, 1], [2, 1], [1, 1], [1, 1]],
};
export function GalleryBento({ c, x, index }: VariantProps) {
  const all = framesOf(c, x);
  if (all.length < 3) return null;
  const shown = all.slice(0, 7);
  const urls = all.map((f) => f.url);
  const spans = BENTO[shown.length];
  const rest = all.length - shown.length;
  // On a phone (two columns) the first tile is the big square and, when the rest do not pair up, the last one runs across.
  const oddRest = (shown.length - 1) % 2 === 1;
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("A look inside", "एक झलक")} />
      <div className="gx-bento">
        {shown.map((f, i) => {
          const last = i === shown.length - 1 && rest > 0;
          return (
            <FrameBtn
              key={f.url} f={f} i={i} urls={urls} x={x} name={c.name}
              style={css({ "--dc": spans[i][0], "--dr": spans[i][1], "--mc": i === 0 || (oddRest && i === shown.length - 1) ? 2 : 1, "--mr": i === 0 ? 2 : 1 })}
              sizes={i === 0 ? "(min-width:768px) 50vw, 100vw" : "(min-width:768px) 25vw, 50vw"}
              label={last ? x.ui(`Open photo ${i + 1} of ${urls.length}: see all`, `फ़ोटो ${i + 1} / ${urls.length}: सब देखें`) : undefined}
            >
              {last && <span className="gx-more" aria-hidden="true">+{rest + 1}</span>}
            </FrameBtn>
          );
        })}
      </div>
    </Sec>
  );
}

/* ---------- album tabs ---------- */
export function GalleryAlbumTabs({ c, x, index }: VariantProps) {
  const fr = framesOf(c, x, 24);
  const uid = useId();
  const [tab, setTab] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (fr.length < 3) return null;
  // One album per heading, in the order the owner wrote them; photos without a heading join the last tab ("More photos").
  const heads = [...new Set(fr.map((f) => f.group).filter(Boolean))];
  const tabbed = heads.length >= 2;
  const albums = tabbed
    ? [
      { key: "all", label: x.ui("All", "सभी"), items: fr },
      ...heads.map((h) => ({ key: h, label: x.t(h), items: fr.filter((f) => f.group === h) })),
      ...(fr.some((f) => !f.group) ? [{ key: "more", label: x.ui("More photos", "और फ़ोटो"), items: fr.filter((f) => !f.group) }] : []),
    ]
    : [{ key: "all", label: "", items: fr }];
  const at = Math.min(tab, albums.length - 1);
  const album = albums[at];
  // A plain grid is four wide on a laptop: 5 or 6 photos left a half-empty last row (16 Oct 2026 QA). It shows the count that fills whole rows
  // (3 or 4 across), the rest stay one swipe away in the viewer.
  const fit = (n: number) => (n <= 4 || n % 4 === 0 || n % 3 === 0 ? n : Math.max(n - (n % 4), n - (n % 3)));
  const shownItems = tabbed ? album.items : album.items.slice(0, fit(album.items.length));
  const urls = album.items.map((f) => f.url);
  const pick = (i: number) => { const j = (i + albums.length) % albums.length; setTab(j); refs.current[j]?.focus(); };
  const onKey = (e: KeyboardEvent, i: number) => {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); pick(i + 1); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); pick(i - 1); }
    else if (k === "Home") { e.preventDefault(); pick(0); }
    else if (k === "End") { e.preventDefault(); pick(albums.length - 1); }
  };
  const grid = (
    <div className="gx-panel" key={album.key} data-n={shownItems.length} {...(tabbed ? { role: "tabpanel", id: `${uid}-p`, "aria-labelledby": `${uid}-t${at}`, tabIndex: 0 } : {})}>
      {shownItems.map((f, i) => <FrameBtn key={f.url} f={f} i={i} urls={urls} x={x} name={c.name} sizes="(min-width:900px) 22vw, 50vw" />)}
    </div>
  );
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="gx-album" data-plain={tabbed ? undefined : ""}>
        <div className="gx-album-side">
          <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={tabbed ? x.ui("Our albums", "हमारे एल्बम") : x.ui("Photo gallery", "फ़ोटो गैलरी")} />
          {tabbed && (
            <div className="gx-tabs" role="tablist" aria-label={x.ui("Albums", "एल्बम")}>
              {albums.map((a, i) => (
                <button
                  key={a.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${uid}-t${i}`} className="gx-tab"
                  aria-selected={i === at} aria-controls={`${uid}-p`} tabIndex={i === at ? 0 : -1}
                  onClick={() => setTab(i)} onKeyDown={(e) => onKey(e, i)}
                >
                  <span>{a.label}</span><small>{a.items.length}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        {grid}
      </div>
    </Sec>
  );
}

/* ---------- lightbox grid ---------- */
export function GalleryLightboxGrid({ c, x, index }: VariantProps) {
  const all = framesOf(c, x);
  if (all.length < 3) return null;
  const shown = all.slice(0, 8);
  const urls = all.map((f) => f.url);
  const rest = all.length - shown.length;
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("Photo gallery", "फ़ोटो गैलरी")} lede={x.ui("Tap a photo to see it full screen.", "पूरी स्क्रीन पर देखने के लिए फ़ोटो पर टैप करें।")} />
      <ul className="gx-lg" data-n={shown.length}>
        {shown.map((f, i) => {
          const last = i === shown.length - 1 && rest > 0;
          return (
            <li key={f.url}>
              <FrameBtn
                f={f} i={i} urls={urls} x={x} name={c.name} sizes="(min-width:768px) 25vw, 50vw"
                label={last ? x.ui(`Open photo ${i + 1} of ${urls.length}: see all`, `फ़ोटो ${i + 1} / ${urls.length}: सब देखें`) : undefined}
              >
                <span className="gx-no" aria-hidden="true">{pad2(i + 1)}</span>
                {last ? <span className="gx-more" aria-hidden="true">+{rest + 1}</span> : <span className="gx-zoom" aria-hidden="true"><Icon name="arrow-up-right" size={16} /></span>}
              </FrameBtn>
            </li>
          );
        })}
      </ul>
      <p className="gx-all">
        <button type="button" className="btn-ghost" onClick={() => { x.track("gallery-zoom"); x.zoom(urls, 0, c.name); }}>
          {x.ui(`View all ${all.length} photos`, `सभी ${all.length} फ़ोटो देखें`)} <Icon name="arrow-right" />
        </button>
      </p>
    </Sec>
  );
}

/* ================= PROOF ================= */

/* ---------- review wall ---------- */
// The best review leads as a large quote on the ink field; the others sit round it on a six-column grid (a lone last card runs across,
// two share the row). One review: just the large quote.
export function ProofWall({ c, x, index }: VariantProps) {
  const r = reviewsOf(c, x);
  if (!r.total) return null;
  const items = r.all.slice(0, 9);
  const [lead, ...rest] = items;
  const rem = Math.max(0, rest.length - 2) % 3;
  return (
    <Sec k="proof" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="prf-top">
        <Head eyebrow={x.ui("Reviews", "रिव्यू")} title={x.ui("Words from our customers", "हमारे ग्राहकों की ज़ुबानी")} />
        <AvgLine r={r} x={x} />
      </div>
      <div className="prf-wall" data-n={Math.min(items.length, 4)}>
        <figure className="prf-feat" data-l={lead.text.length <= 140 ? "l" : lead.text.length <= 260 ? "m" : "s"}>
          <span className="prf-feat-qm" aria-hidden="true">&ldquo;</span>
          <blockquote>{x.t(lead.text)}</blockquote>
          <figcaption><Stars n={lead.rating} size={16} />{lead.name && <span className="prf-who"><Mono name={lead.name} />{x.t(lead.name)}</span>}</figcaption>
        </figure>
        {rest.map((q, i) => (
          <figure key={i} className="adv-card prf-note" data-last={i === rest.length - 1 && i >= 2 ? (rem === 1 ? "full" : rem === 2 ? "half" : undefined) : undefined} data-half={rem === 2 && i === rest.length - 2 && i >= 2 ? "" : undefined}>
            <Stars n={q.rating} />
            <blockquote>{x.t(q.text)}</blockquote>
            {q.name && <figcaption><Mono name={q.name} /><span>{x.t(q.name)}</span></figcaption>}
          </figure>
        ))}
      </div>
    </Sec>
  );
}

/* ---------- single big testimonial, carousel ---------- */
export function ProofCarousel({ c, x, index }: VariantProps) {
  const r = reviewsOf(c, x);
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  if (!r.total) return null;
  const items = r.all.slice(0, 8);
  const n = items.length;
  const go = (to: number) => {
    const el = ref.current; if (!el) return;
    const i = (to + n) % n;
    el.scrollTo({ left: i * el.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
    if (reducedMotion()) setCur(i);
  };
  const onScroll = () => { const el = ref.current; if (el && el.clientWidth) setCur(Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / el.clientWidth)))); };
  const onKey = (e: KeyboardEvent) => {
    if (n < 2 || e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
  };
  return (
    <Sec k="proof" tone={index % 2 ? "alt" : "paper"}>
      <H2 className="sr-only">{x.ui("What customers say", "ग्राहक क्या कहते हैं")}</H2>
      <div className="prf-car" role="group" aria-roledescription="carousel" aria-label={x.ui("Customer reviews", "ग्राहकों के रिव्यू")}>
        <Eyebrow className="prf-car-eye">{x.ui("Reviews", "रिव्यू")}</Eyebrow>
        <div ref={ref} onScroll={onScroll} onKeyDown={onKey} className="prf-car-view" tabIndex={n > 1 ? 0 : undefined} aria-label={n > 1 ? x.ui("Scroll sideways for more reviews", "और रिव्यू के लिए बग़ल में स्क्रोल करें") : undefined}>
          {items.map((q, i) => (
            <figure key={i} className="prf-slide" data-l={q.text.length <= 110 ? "l" : q.text.length <= 220 ? "m" : "s"} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${n}`}>
              <span className="prf-qm" aria-hidden="true">&ldquo;</span>
              <blockquote>{x.t(q.text)}</blockquote>
              <figcaption><Stars n={q.rating} size={16} />{q.name && <span className="prf-who"><Mono name={q.name} />{x.t(q.name)}</span>}</figcaption>
            </figure>
          ))}
        </div>
        {n > 1 && (
          <div className="prf-car-ctl">
            <button type="button" className="gx-round" data-flip="" onClick={() => go(cur - 1)} aria-label={x.ui("Previous review", "पिछला रिव्यू")}><Icon name="arrow-right" size={18} /></button>
            <div className="prf-dots">
              {items.map((_, i) => <button key={i} type="button" className="prf-dot" aria-current={i === cur ? "true" : undefined} aria-label={x.ui(`Review ${i + 1} of ${n}`, `रिव्यू ${i + 1} / ${n}`)} onClick={() => go(i)} />)}
            </div>
            <button type="button" className="gx-round" onClick={() => go(cur + 1)} aria-label={x.ui("Next review", "अगला रिव्यू")}><Icon name="arrow-right" size={18} /></button>
          </div>
        )}
        <AvgLine r={r} x={x} />
      </div>
    </Sec>
  );
}

/* ---------- star summary + cards ---------- */
export function ProofSummary({ c, x, index }: VariantProps) {
  const r = reviewsOf(c, x);
  if (!r.total) return null;
  const items = r.all.slice(0, 4);
  const showAvg = r.rated >= 1;
  const top = Math.max(1, ...r.dist);
  return (
    <Sec k="proof" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="prf-sum">
        <div className="prf-sum-side">
          <Head eyebrow={x.ui("Reviews", "रिव्यू")} title={x.ui("Customer ratings", "ग्राहकों की रेटिंग")} />
          {showAvg && (
            <>
              <p className="prf-big"><b>{r.avg.toFixed(1)}</b><span aria-hidden="true">/ 5</span></p>
              <Stars n={r.avg} size={20} />
              <p className="prf-based">{x.hi ? `${r.total} ग्राहकों के रिव्यू के आधार पर` : `Based on ${countLabel(x, r.total)}`}</p>
              {r.rated >= 3 && (
                <ul className="prf-bars" aria-label={x.ui("Ratings breakdown", "रेटिंग का ब्योरा")}>
                  {[5, 4, 3, 2, 1].map((s) => (
                    <li key={s}>
                      <span className="sr-only">{x.ui(`${s} stars: ${r.dist[s - 1]}`, `${s} स्टार: ${r.dist[s - 1]}`)}</span>
                      <span aria-hidden="true">{s}</span>
                      <i aria-hidden="true"><b style={{ width: `${Math.round((r.dist[s - 1] / top) * 100)}%` }} /></i>
                      <span aria-hidden="true">{r.dist[s - 1]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="prf-list">
          {items.map((q, i) => (
            <figure key={i} className="adv-card prf-row">
              <div className="prf-row-h">
                {q.name ? <span className="prf-who"><Mono name={q.name} />{x.t(q.name)}</span> : <span />}
                <Stars n={q.rating} />
              </div>
              <blockquote>{x.t(q.text)}</blockquote>
            </figure>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* ---------- results / achievements band ---------- */
export function ProofResults({ c, x }: VariantProps) {
  const r = reviewsOf(c, x);
  if (!r.total) return null;
  // Numbers only when they mean something: the owner's own figures (years, students placed, pass rate) lead when the card has them,
  // else what the reviews say; an average of two reviews is not a result.
  const stats: { value: string; label: string }[] = c.facts.length >= 2 ? c.facts.slice(0, 4).map((f) => ({ value: x.t(f.value), label: x.t(f.label) })) : [];
  if (!stats.length && r.rated >= 3) {
    stats.push({ value: `${r.avg.toFixed(1)}★`, label: x.ui("average rating", "औसत रेटिंग") });
    stats.push({ value: String(r.total), label: x.ui("customer reviews", "ग्राहक रिव्यू") });
    const five = Math.round((r.dist[4] / r.rated) * 100);
    if (five >= 50) stats.push({ value: `${five}%`, label: x.ui("gave 5 stars", "ने 5 स्टार दिए") });
  }
  // Short lines read as results: up to three of the best-rated reviews that fit in a couple of sentences.
  const short = r.all.filter((q) => q.text.length <= 200 && q.rating >= 4);
  const quotes = (short.length ? short : r.all.filter((q) => q.text.length <= 200)).slice(0, 3);
  const pickQ = quotes.length ? quotes : r.all.slice(0, 1);
  const solo = !stats.length;
  return (
    <Sec k="proof" tone="ink" wide label={x.ui("Customer results", "ग्राहकों के नतीजे")}>
      {stats.length > 0 && <Head className="prf-res-head" eyebrow={x.ui("Results", "नतीजे")} title={x.ui("The numbers we stand behind", "वो आँकड़े जिन पर हमें भरोसा है")} />}
      {stats.length > 0 && (
        <ul className="prf-res-stats" data-n={stats.length} style={css({ "--n": stats.length })}>
          {stats.map((s, i) => (
            <li key={i} data-l={lenOf(s.value)}><CountUp value={s.value} className="prf-res-num" /><span>{s.label}</span></li>
          ))}
        </ul>
      )}
      <div className="prf-res-q" data-solo={solo ? "" : undefined} style={css({ "--q": pickQ.length })}>
        {pickQ.map((q, i) => (
          <figure key={i}>
            {solo && <Stars n={q.rating} size={18} />}
            <blockquote>{x.t(q.text)}</blockquote>
            {q.name && <figcaption>{x.t(q.name)}</figcaption>}
          </figure>
        ))}
      </div>
    </Sec>
  );
}

/* ---------- clients strip ---------- */
export function ProofClients({ c, x, index }: VariantProps) {
  const r = reviewsOf(c, x);
  if (!r.total) return null;
  const names = [...new Set(r.all.map((q) => q.name).filter(Boolean))].slice(0, 12);
  const lead = r.all[0];
  const strip = names.length >= 3;
  const chips = names.map((nm) => <span key={nm} className="prf-cl-name"><Mono name={nm} />{x.t(nm)}</span>);
  return (
    <section id="adv-proof" data-sec="proof" data-tone={index % 2 ? "alt" : "paper"} data-reveal className="adv-sec">
      <div className="adv-wrap adv-wide">
        <Head eyebrow={x.ui("Reviews", "रिव्यू")} title={strip ? x.ui("In good company", "अच्छे ग्राहकों का साथ") : x.ui("What customers say", "ग्राहक क्या कहते हैं")} />
      </div>
      {strip && (
        <div className="prf-cl-band">
          <p className="sr-only">{names.map((nm) => x.t(nm)).join(", ")}</p>
          {names.length >= 5
            ? <Rail items={chips} min={12} speed={48} />
            : <ul className="prf-cl-still" aria-hidden="true">{chips.map((ch, i) => <li key={i}>{ch}</li>)}</ul>}
        </div>
      )}
      <div className="adv-wrap adv-wide">
        <figure className="prf-cl-lead">
          <Stars n={lead.rating} size={18} />
          <blockquote>{x.t(lead.text)}</blockquote>
          {lead.name && <figcaption><Mono name={lead.name} />{x.t(lead.name)}</figcaption>}
        </figure>
        <AvgLine r={r} x={x} />
      </div>
    </section>
  );
}

/* ================= TRUST ================= */

/* ---------- number counters (ink field) ---------- */
export function TrustCounters({ c, x }: VariantProps) {
  if (c.facts.length < 2) return null;
  return (
    <Sec k="trust" tone="ink" wide className="trv-sec" label={x.ui("In numbers", "एक नज़र में")}>
      <ul className="trv-count" style={css({ "--n": c.facts.length })}>
        {c.facts.map((f, i) => (
          <li key={i} data-l={lenOf(f.value)}>
            <CountUp value={x.t(f.value)} className="trv-num" />
            <hr className="adv-rule" />
            <span className="trv-lab">{x.t(f.label)}</span>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

/* ---------- icon row ---------- */
export function TrustIconRow({ c, x, index }: VariantProps) {
  if (c.facts.length < 2) return null;
  return (
    <Sec k="trust" tone={index % 2 ? "alt" : "paper"} className="trv-sec" label={x.ui("In numbers", "एक नज़र में")}>
      <ul className="trv-ir">
        {c.facts.map((f, i) => (
          <li key={i}>
            <span className="trv-ico"><Icon name={factIcon(f)} size={20} /></span>
            <span className="trv-tx"><CountUp value={x.t(f.value)} className="trv-v" /><span className="trv-l">{x.t(f.label)}</span></span>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

/* ---------- ticker ---------- */
export function TrustTicker({ c, x }: VariantProps) {
  if (c.facts.length < 2) return null;
  const items = c.facts.map((f, i) => (
    <span key={i} className="trv-tk-item"><b>{x.t(f.value)}</b><span>{x.t(f.label)}</span><i className="trv-tk-sep" /></span>
  ));
  return (
    <section id="adv-trust" data-sec="trust" data-reveal className="trv-tk" aria-label={x.ui("In numbers", "एक नज़र में")}>
      <ul className="sr-only">{c.facts.map((f, i) => <li key={i}>{x.t(f.value)} {x.t(f.label)}</li>)}</ul>
      <Rail items={items} min={8} speed={36} />
    </section>
  );
}

/* ---------- split stat cards ---------- */
export function TrustSplitCards({ c, x, index }: VariantProps) {
  if (c.facts.length < 2) return null;
  const n = c.facts.length;
  return (
    <Sec k="trust" tone={index % 2 ? "alt" : "paper"} wide className="trv-sec" label={x.ui("In numbers", "एक नज़र में")}>
      <div className="trv-sp">
        <div className="trv-sp-words">
          <Eyebrow>{x.ui("Why choose us", "हमें क्यों चुनें")}</Eyebrow>
          <H2 className="mt-3">{x.hi ? `लोग ${x.t(c.name)} पर भरोसा क्यों करते हैं` : `Why people trust ${x.t(c.name)}`}</H2>
          {x.wa && <p className="trv-sp-cta"><Btn href={x.waHref()} kind="link" external onClick={() => x.track("trust-whatsapp")}>{x.ui("Ask us anything", "हमसे कुछ भी पूछें")} <Icon name="arrow-right" /></Btn></p>}
        </div>
        <ul className="trv-cards">
          {c.facts.map((f, i) => (
            <li key={i} className="adv-card trv-card" data-wide={n === 3 && i === 0 ? "" : undefined} data-l={lenOf(f.value)}>
              <span className="trv-card-h"><span className="trv-ico"><Icon name={factIcon(f)} size={18} /></span><span className="trv-no" aria-hidden="true">{pad2(i + 1)}</span></span>
              <span className="trv-tx"><CountUp value={x.t(f.value)} className="trv-v" /><span className="trv-l">{x.t(f.label)}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </Sec>
  );
}

/* ================= CSS ================= */

const PROOF_BASE_CSS = `
/* ---- the slow ribbon (trust ticker, clients strip) ---- */
.rl{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.rl-track{display:flex;width:max-content;animation:rl-run 38s linear infinite}
.rl:hover .rl-track{animation-play-state:paused}
.rl-copy{display:flex;flex:none;align-items:center;gap:var(--rl-gap,2.5rem);padding-right:var(--rl-gap,2.5rem)}
.rl-set{display:contents;list-style:none;margin:0;padding:0}
.rl-set>li{display:flex;align-items:center;flex:none}
@keyframes rl-run{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.rl{-webkit-mask-image:none;mask-image:none}.rl-track{width:auto;animation:none}.rl-copy{flex-wrap:wrap;padding-right:0;row-gap:var(--s3)}.rl-copy~.rl-copy,.rl-set[data-rep]{display:none}}
.site[data-motion=none] .rl{-webkit-mask-image:none;mask-image:none}.site[data-motion=none] .rl-track{width:auto}.site[data-motion=none] .rl-copy{flex-wrap:wrap;padding-right:0;row-gap:var(--s3)}.site[data-motion=none] .rl-copy~.rl-copy,.site[data-motion=none] .rl-set[data-rep]{display:none}

/* ---- gallery: shared ---- */
.gx-tile{position:relative;display:block;width:100%;padding:0;border:0;overflow:hidden;border-radius:var(--r-img);background:var(--paper-2);cursor:zoom-in;isolation:isolate;color:var(--hero-text);font:inherit}
.gx-tile .adv-photo{transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.gx-tile:hover .adv-photo,.gx-tile:focus-visible .adv-photo{transform:scale(1.045)}
.gx-tile::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px var(--line);pointer-events:none}
.gx-cap{position:absolute;inset:auto 0 0 0;padding:2.75rem var(--s4) var(--s3);background:linear-gradient(transparent,var(--scrim-bot));color:var(--hero-text);font-size:var(--t-meta);font-weight:500;line-height:1.35;text-align:left;opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s}
.gx-tile:hover .gx-cap,.gx-tile:focus-visible .gx-cap{opacity:1;transform:none}
@media (hover:none){.gx-cap{opacity:1;transform:none}}
.gx-more{position:absolute;inset:0;z-index:1;display:grid;place-items:center;background:color-mix(in srgb,var(--hero-ink) 64%,transparent);color:var(--hero-text);font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.6rem,4vw,2.6rem);letter-spacing:var(--display-tr);font-variant-numeric:lining-nums}
.gx-round{display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.gx-round:hover:not(:disabled){background:var(--ink);color:var(--paper);border-color:var(--ink)}
.gx-round:disabled{opacity:.35;cursor:default}
.gx-round[data-flip] svg{transform:scaleX(-1)}

/* ---- gallery: masonry ---- */
.gx-masonry{column-count:2;column-gap:var(--s3)}
.gx-masonry .gx-tile{margin:0 0 var(--s3);break-inside:avoid}
@media (min-width:768px){.gx-masonry{column-count:3;column-gap:var(--s4)}.gx-masonry .gx-tile{margin-bottom:var(--s4)}}
@media (min-width:1200px){.gx-masonry[data-big]{column-count:4}}

/* ---- gallery: filmstrip ---- */
.gx-fs-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s5)}
.gx-fs-top .adv-head{margin-bottom:0}
.gx-fs-ctl{display:flex;align-items:center;gap:var(--s3)}
.gx-fs-count{min-width:5.5ch;margin-right:var(--s2);text-align:right;font-size:var(--t-meta);color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.gx-fs-strip{position:relative;display:flex;gap:var(--s3);overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:var(--gutter);margin:clamp(1.75rem,4vw,2.75rem) calc(var(--gutter) * -1) 0;padding:0 var(--gutter) var(--s2);scrollbar-width:none;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.gx-fs-strip::-webkit-scrollbar{display:none}
.gx-fs-strip .gx-fs-frame{--fh:clamp(300px,52vw,520px);flex:none;width:calc(var(--fh) * var(--ar,.8));max-width:82vw;height:var(--fh);scroll-snap-align:start}
.gx-fs-prog{display:block;height:2px;margin-top:var(--s5);border-radius:2px;background:var(--line);overflow:hidden}
.gx-fs-prog i{display:block;height:100%;background:var(--accent);transform-origin:left;transition:transform .4s cubic-bezier(.2,.7,.2,1)}

/* ---- gallery: bento ---- */
.gx-bento{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:clamp(130px,42vw,260px);grid-auto-flow:dense;gap:var(--s2)}
.gx-bento>.gx-tile{height:100%;grid-column:span var(--mc,1);grid-row:span var(--mr,1)}
@media (min-width:768px){.gx-bento{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:clamp(160px,17vw,240px);gap:var(--s3)}.gx-bento>.gx-tile{grid-column:span var(--dc,1);grid-row:span var(--dr,1)}}

/* ---- gallery: album tabs ---- */
.gx-album{display:grid;gap:var(--s6)}
.gx-album-side .adv-head{margin-bottom:var(--s5)}
.gx-tabs{display:flex;gap:var(--s2);overflow-x:auto;scrollbar-width:none;margin-inline:calc(var(--gutter) * -1);padding:2px var(--gutter)}
.gx-tabs::-webkit-scrollbar{display:none}
.gx-tab{display:inline-flex;flex:none;align-items:center;gap:.65em;min-height:44px;padding:.55rem 1.05rem;border:1px solid var(--line);border-radius:var(--r-pill);background:transparent;color:var(--muted);font:inherit;font-size:14px;font-weight:500;cursor:pointer;text-align:left;transition:background .2s,color .2s,border-color .2s}
.gx-tab:hover{color:var(--ink);border-color:var(--ink)}
.gx-tab[aria-selected=true]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.gx-tab small{font-size:12px;opacity:.7;font-variant-numeric:tabular-nums lining-nums}
.gx-panel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s2);align-content:start;animation:gx-in .45s cubic-bezier(.2,.7,.2,1)}
.gx-panel .gx-tile{aspect-ratio:4/5}
.gx-album[data-plain] .gx-panel>:first-child:nth-last-child(odd){grid-column:span 2}.gx-album[data-plain] .gx-panel>:first-child:nth-last-child(odd) .gx-tile{aspect-ratio:16/10}
@keyframes gx-in{from{opacity:0;transform:translateY(8px)}}
@media (min-width:900px){
.gx-album{grid-template-columns:minmax(15rem,.34fr) minmax(0,1fr);gap:var(--s8);align-items:start}
.gx-album-side{position:sticky;top:96px}
.gx-tabs{flex-direction:column;overflow:visible;margin:0;padding:0}
.gx-tab{justify-content:space-between;border-radius:var(--r-ctl);padding:.7rem 1rem}
.gx-panel{grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s3)}
.gx-album[data-plain]{grid-template-columns:minmax(0,1fr);gap:0}
.gx-album[data-plain] .gx-album-side{position:static}
.gx-album[data-plain] .gx-panel>:first-child:nth-last-child(odd){grid-column:auto}.gx-album[data-plain] .gx-panel>:first-child:nth-last-child(odd) .gx-tile{aspect-ratio:4/5}
.gx-album[data-plain] .gx-panel{grid-template-columns:repeat(4,minmax(0,1fr))}
.gx-album[data-plain] .gx-panel:is([data-n="3"],[data-n="6"],[data-n="9"],[data-n="15"]){grid-template-columns:repeat(3,minmax(0,1fr))}
}

/* ---- gallery: lightbox grid ---- */
.gx-lg{--gx-h:clamp(170px,46vw,300px);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:var(--gx-h);gap:var(--s2);list-style:none;margin:0;padding:0}
.gx-lg>li{min-width:0}
.gx-lg>li:first-child:nth-last-child(odd){grid-column:span 2}
.gx-lg .gx-tile{height:100%}
.gx-no{position:absolute;top:var(--s3);left:var(--s3);z-index:1;padding:.2em .6em;border-radius:var(--r-pill);background:color-mix(in srgb,var(--hero-ink) 55%,transparent);color:var(--hero-text);font-size:12px;font-weight:600;letter-spacing:.04em;font-variant-numeric:tabular-nums lining-nums;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.gx-zoom{position:absolute;top:var(--s3);right:var(--s3);z-index:1;display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:var(--hero-text);color:var(--hero-ink);opacity:0;transform:scale(.85);transition:opacity .25s,transform .25s}
.gx-tile:hover .gx-zoom,.gx-tile:focus-visible .gx-zoom{opacity:1;transform:none}
.gx-all{margin:clamp(1.5rem,3vw,2.25rem) 0 0;display:flex;justify-content:center}
@media (min-width:768px){
.gx-lg{--gx-h:clamp(200px,22vw,300px);grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s3)}
.gx-lg>li:first-child:nth-last-child(odd){grid-column:auto}
.gx-lg[data-n="3"],.gx-lg[data-n="5"],.gx-lg[data-n="6"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.gx-lg[data-n="5"]>li:first-child,.gx-lg[data-n="7"]>li:first-child{grid-column:span 2}
}

/* ---- proof: shared ---- */
.prf-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s5)}
.prf-top .adv-head{margin-bottom:0}
.prf-avg{display:flex;align-items:center;gap:var(--s3);margin:0;font-size:var(--t-meta);color:var(--muted)}
.prf-avg b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.2rem,5vw,3.4rem);line-height:1;color:var(--ink);font-variant-numeric:lining-nums tabular-nums}
.prf-av{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-family:var(--font-display);font-size:1rem;font-weight:var(--display-w);line-height:1}
.prf-who{display:inline-flex;align-items:center;gap:var(--s3);font-size:var(--t-meta);font-weight:600;color:var(--muted)}
.site:lang(hi) .prf-av{font-weight:var(--display-w-hi)}

/* ---- proof: review wall ---- */
.prf-wall{margin-top:clamp(2rem,5vw,3.5rem);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gap)}
.prf-feat{position:relative;margin:0;padding:clamp(1.5rem,4vw,3rem);border-radius:var(--r-tile);background:var(--hero-ink);color:var(--hero-text);display:flex;flex-direction:column;justify-content:space-between;gap:var(--s5);overflow:hidden}
.prf-feat-qm{display:block;height:clamp(2.2rem,5vw,3.6rem);font-family:var(--font-display);font-size:clamp(4.5rem,10vw,7.5rem);line-height:.9;color:var(--accent)}
.prf-feat blockquote{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.3rem,3vw,2.1rem);line-height:1.15;letter-spacing:var(--display-tr);text-wrap:balance;color:var(--hero-text)}
.prf-feat[data-l=l] blockquote{font-size:clamp(1.7rem,4.2vw,3rem);line-height:1.08}.prf-feat[data-l=s] blockquote{font-size:clamp(1.1rem,2.2vw,1.45rem);line-height:1.35;letter-spacing:0}
.site:lang(hi) .prf-feat blockquote{line-height:1.45;letter-spacing:0;font-weight:var(--display-w-hi)}
.prf-feat figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.prf-feat .adv-stars{color:var(--accent)}
.prf-feat .prf-who{color:var(--hero-muted)}
.prf-feat .prf-av{background:color-mix(in srgb,var(--hero-text) 14%,transparent);color:var(--hero-text)}
.prf-note{margin:0;padding:clamp(1.25rem,2.4vw,1.75rem);display:flex;flex-direction:column;gap:var(--s4);transition:border-color .25s,box-shadow .25s,transform .35s}
.prf-note:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:var(--e-1);transform:translateY(-3px)}
.prf-note blockquote{margin:0;font-family:var(--font-display);font-weight:400;font-size:clamp(1.05rem,1.5vw,1.2rem);line-height:1.5;text-wrap:pretty;color:var(--ink)}
.site:lang(hi) .prf-note blockquote,.site:lang(hi) .prf-row blockquote{line-height:1.7}
.prf-note figcaption{margin-top:auto;display:flex;align-items:center;gap:var(--s3);font-size:var(--t-meta);font-weight:600;color:var(--muted)}
@media (min-width:900px){
.prf-wall{grid-template-columns:repeat(6,minmax(0,1fr))}
.prf-feat{grid-column:span 4;grid-row:span 2}
.prf-note{grid-column:span 2}
.prf-wall[data-n="1"] .prf-feat{grid-column:1 / -1}
.prf-wall[data-n="2"] .prf-feat{grid-row:span 1}.prf-wall[data-n="2"] .prf-note{grid-column:span 2}
.prf-wall[data-n="3"] .prf-note{grid-column:span 2}
.prf-note[data-last=full]{grid-column:1 / -1}
.prf-note[data-last=half],.prf-note[data-half]{grid-column:span 3}
}

/* ---- proof: carousel ---- */
.prf-car{max-width:58rem;margin-inline:auto;text-align:center}
.prf-car-eye{margin-bottom:var(--s5)}
.prf-car-view{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;border-radius:var(--r-card)}
.prf-car-view::-webkit-scrollbar{display:none}
.prf-slide{flex:0 0 100%;scroll-snap-align:center;margin:0;padding:0 clamp(.25rem,2vw,1.5rem);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--s5)}
.prf-qm{display:block;height:clamp(2.2rem,5vw,3.6rem);font-family:var(--font-display);font-size:clamp(4rem,9vw,6.5rem);line-height:.95;color:var(--accent)}
.prf-slide blockquote{margin:0;font-family:var(--font-display);font-weight:400;line-height:1.22;letter-spacing:var(--display-tr);text-wrap:balance;font-size:clamp(1.15rem,2.4vw,1.6rem)}
.prf-slide[data-l=l] blockquote{font-size:clamp(1.7rem,4.4vw,3rem)}.prf-slide[data-l=m] blockquote{font-size:clamp(1.4rem,3.3vw,2.2rem)}
.site:lang(hi) .prf-slide blockquote{line-height:1.5;letter-spacing:0;font-weight:var(--display-w-hi)}
.prf-slide figcaption{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--s3) var(--s5)}
.prf-car-ctl{display:flex;align-items:center;justify-content:center;gap:var(--s4);margin-top:clamp(1.75rem,4vw,2.75rem)}
.prf-dots{display:flex;align-items:center;flex-wrap:wrap;justify-content:center}
.prf-dot{display:grid;place-items:center;width:24px;height:44px;padding:0;border:0;background:none;cursor:pointer}
.prf-dot::before{content:"";width:8px;height:8px;border-radius:99px;background:color-mix(in srgb,var(--ink) 25%,transparent);transition:width .3s,background .3s}
.prf-dot:hover::before{background:color-mix(in srgb,var(--ink) 55%,transparent)}
.prf-dot[aria-current=true]::before{width:22px;background:var(--accent)}
.prf-car .prf-avg{justify-content:center;margin-top:clamp(1.5rem,3vw,2.25rem)}

/* ---- proof: star summary ---- */
.prf-sum{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.prf-sum-side .adv-head{margin-bottom:var(--s5)}
.prf-big{display:flex;align-items:baseline;gap:var(--s3);margin:0 0 var(--s2)}
.prf-big b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(3.6rem,9vw,5.6rem);line-height:.95;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums}
.prf-big span{font-size:1.1rem;color:var(--muted)}
.prf-based{margin:var(--s3) 0 0;font-size:var(--t-meta);color:var(--muted)}
.prf-bars{list-style:none;margin:var(--s5) 0 0;padding:0;display:grid;gap:var(--s2);max-width:22rem}
.prf-bars li{display:grid;grid-template-columns:1rem minmax(0,1fr) 2rem;align-items:center;gap:var(--s3);font-size:var(--t-meta);color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.prf-bars li>span:last-child{text-align:right}
.prf-bars i{position:relative;height:6px;border-radius:99px;background:var(--line);overflow:hidden}
.prf-bars b{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--accent)}
.prf-list{display:grid;gap:var(--s4)}
.prf-row{margin:0;padding:clamp(1.25rem,2.4vw,1.75rem);display:grid;gap:var(--s4);transition:border-color .25s,box-shadow .25s}
.prf-row:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:var(--e-1)}
.prf-row-h{display:flex;align-items:center;justify-content:space-between;gap:var(--s4)}
.prf-row blockquote{margin:0;font-family:var(--font-display);font-weight:400;font-size:clamp(1.05rem,1.6vw,1.25rem);line-height:1.5;text-wrap:pretty}
@media (min-width:900px){.prf-sum{grid-template-columns:minmax(17rem,.36fr) minmax(0,1fr);gap:var(--s8);align-items:start}.prf-sum-side{position:sticky;top:96px}}

/* ---- proof: results band ---- */
.prf-res-stats{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:var(--s5) var(--s4);list-style:none;margin:0;padding:0;text-align:center}
.prf-res-stats li{display:flex;flex-direction:column;align-items:center;gap:.5rem;min-width:0}
.prf-res-stats li+li{border-left:1px solid var(--line);padding-left:var(--s3)}
.prf-res-head{margin-inline:auto;text-align:center}.prf-res-head .adv-lede{margin-inline:auto}
.prf-res-num{display:block;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.1rem,9vw,6.2rem);line-height:1;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums;color:var(--ink)}
.prf-res-stats li[data-l=m] .prf-res-num{font-size:clamp(1.7rem,6vw,4rem)}.prf-res-stats li[data-l=l] .prf-res-num{font-size:clamp(1.3rem,4vw,2.6rem)}.prf-res-stats li:first-child .prf-res-num{color:color-mix(in srgb,var(--accent) 55%,var(--hero-text))}
.prf-res-stats[data-n="4"] .prf-res-num{font-size:clamp(1.7rem,6.4vw,4.2rem)}.prf-res-stats[data-n="4"] li[data-l=m] .prf-res-num{font-size:clamp(1.5rem,5vw,3rem)}.prf-res-stats[data-n="4"] li[data-l=l] .prf-res-num{font-size:clamp(1.25rem,3.6vw,2.2rem)}
@media (max-width:699px){.prf-res-stats[data-n="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}.prf-res-stats[data-n="4"] li:nth-child(odd){border-left:0;padding-left:0}.prf-res-stats[data-n="4"] .prf-res-num,.prf-res-stats[data-n="4"] li[data-l=m] .prf-res-num{font-size:clamp(1.9rem,9vw,2.8rem)}}
.prf-res-stats[data-n="3"] .prf-res-num{font-size:clamp(2rem,8vw,5rem)}
.prf-res-stats span:not(.prf-res-num){font-size:var(--t-meta);color:var(--muted);text-wrap:balance}
.prf-res-q{display:grid;gap:var(--s6);margin-top:clamp(2.25rem,5vw,3.75rem);padding-top:clamp(1.75rem,4vw,2.75rem);border-top:1px solid var(--line)}
.prf-res-q figure{margin:0;display:flex;flex-direction:column;gap:var(--s3)}
.prf-res-q blockquote{margin:0;font-family:var(--font-display);font-weight:400;font-size:clamp(1.05rem,1.6vw,1.25rem);line-height:1.45;text-wrap:pretty}
.site:lang(hi) .prf-res-q blockquote{line-height:1.65}
.prf-res-q figcaption{font-size:var(--t-meta);font-weight:600;color:var(--muted)}
.prf-res-q[data-solo]{margin-top:0;padding-top:0;border-top:0;max-width:52rem;margin-inline:auto;text-align:center}
.prf-res-q[data-solo] figure{align-items:center;gap:var(--s5)}
.prf-res-q[data-solo] blockquote{font-size:clamp(1.4rem,3.4vw,2.4rem);line-height:1.25;text-wrap:balance}
@media (min-width:900px){.prf-res-q:not([data-solo]){grid-template-columns:repeat(var(--q,3),minmax(0,1fr));gap:var(--s7)}}

/* ---- proof: clients strip ---- */
.prf-cl-band{margin-top:clamp(.5rem,2vw,1rem);padding-block:clamp(1.1rem,2.4vw,1.75rem);border-block:1px solid var(--line);background:var(--paper-2);--rl-gap:clamp(2rem,5vw,4rem)}
.adv-sec[data-tone=alt] .prf-cl-band{background:var(--paper)}
.prf-cl-name{display:inline-flex;align-items:center;gap:.7rem;white-space:nowrap;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.15rem,2vw,1.5rem);line-height:1.2;color:var(--ink)}
.site:lang(hi) .prf-cl-name{font-weight:var(--display-w-hi)}
.prf-cl-name .prf-av{width:34px;height:34px;background:transparent;border:1px solid var(--line);color:var(--muted)}
.prf-cl-still{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--s4) var(--s7);list-style:none;margin:0;padding:0 var(--gutter)}
.prf-cl-lead{margin:clamp(2.25rem,5vw,3.75rem) auto 0;max-width:50rem;display:flex;flex-direction:column;align-items:center;gap:var(--s5);text-align:center}
.prf-cl-lead blockquote{margin:0;font-family:var(--font-display);font-weight:400;font-size:clamp(1.4rem,3.2vw,2.2rem);line-height:1.25;letter-spacing:var(--display-tr);text-wrap:balance}
.site:lang(hi) .prf-cl-lead blockquote{line-height:1.5;letter-spacing:0;font-weight:var(--display-w-hi)}
.prf-cl-lead figcaption{display:inline-flex;align-items:center;gap:var(--s3);font-size:var(--t-meta);font-weight:600;color:var(--muted)}
.prf-cl-lead+.prf-avg{justify-content:center;margin-top:clamp(1.5rem,3vw,2.25rem)}

/* ---- trust: shared ---- */
.trv-sec.adv-sec{padding-block:clamp(2.5rem,6vw,4.75rem)}
.trv-ico{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:999px;background:var(--accent-soft);color:var(--accent)}
.trv-v{display:block;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.9rem,4.4vw,3.2rem);line-height:1.05;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums;color:var(--ink)}
.trv-l{display:block;margin-top:.4rem;font-size:var(--t-meta);line-height:1.4;color:var(--muted)}
.trv-tx{display:block;min-width:0}

/* ---- trust: counters ---- */
.trv-count{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s6) var(--s4);list-style:none;margin:0;padding:0;text-align:center}
.trv-count li{display:flex;flex-direction:column;align-items:center;gap:var(--s3);min-width:0}
.trv-num{display:block;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.6rem,8vw,5.6rem);line-height:1;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums;color:var(--ink);text-wrap:balance}
.trv-count li[data-l=m] .trv-num{font-size:clamp(2rem,5.6vw,3.8rem)}.trv-count li[data-l=l] .trv-num{font-size:clamp(1.35rem,3vw,2rem)}
.trv-count .adv-rule{width:28px}
.trv-lab{font-size:var(--t-meta);font-weight:500;line-height:1.4;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);text-wrap:balance}
.site:lang(hi) .trv-lab{text-transform:none;letter-spacing:0}
@media (min-width:768px){.trv-count{grid-template-columns:repeat(var(--n,4),minmax(0,1fr))}.trv-count li+li{border-left:1px solid var(--line)}}

/* ---- trust: icon row ---- */
.trv-ir{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14.5rem),1fr));gap:var(--s5) var(--s6);list-style:none;margin:0;padding:0}
.trv-ir li{display:flex;align-items:center;gap:var(--s4);min-width:0}

/* ---- trust: ticker ---- */
.trv-tk{background:var(--accent);color:var(--on-accent);padding-block:clamp(.9rem,2vw,1.35rem);overflow:hidden;--rl-gap:clamp(1.75rem,4vw,3.25rem)}
.trv-tk-item{display:inline-flex;align-items:baseline;gap:.6em;white-space:nowrap}
.trv-tk-item b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.35rem,3vw,2rem);line-height:1.1;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums}
.trv-tk-item span{font-size:var(--t-meta);font-weight:500}
.trv-tk-sep{align-self:center;width:6px;height:6px;margin-left:clamp(.5rem,1.5vw,1.25rem);border-radius:99px;background:currentColor;opacity:.5}
@media (prefers-reduced-motion:reduce){.trv-tk .rl-copy{justify-content:center;padding-inline:var(--gutter)}}
.site[data-motion=none] .trv-tk .rl-copy{justify-content:center;padding-inline:var(--gutter)}

/* ---- trust: split cards ---- */
.trv-sp{display:grid;gap:clamp(1.5rem,4vw,3rem);align-items:center}
.trv-sp-cta{margin:var(--s5) 0 0}
.trv-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3);list-style:none;margin:0;padding:0}
.trv-card{display:flex;flex-direction:column;justify-content:space-between;gap:var(--s5);min-height:clamp(8rem,17vw,10.5rem);padding:clamp(1rem,2.4vw,1.75rem);transition:border-color .25s,transform .25s,box-shadow .25s}
.trv-card:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:var(--e-1);transform:translateY(-2px)}
.trv-card[data-wide]{grid-column:span 2}
.trv-card-h{display:flex;align-items:center;justify-content:space-between;gap:var(--s3)}
.trv-card .trv-ico{width:38px;height:38px}
.trv-no{font-size:12px;font-weight:600;letter-spacing:.06em;color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.trv-card[data-l=m] .trv-v{font-size:clamp(1.3rem,2.6vw,1.9rem)}.trv-card[data-l=l] .trv-v{font-size:clamp(1.1rem,2.2vw,1.5rem)}
@media (min-width:700px){.trv-cards{gap:var(--s4)}}
@media (min-width:900px){.trv-sp{grid-template-columns:minmax(16rem,.8fr) minmax(0,1.6fr)}}
`;

export const PROOF_CSS = PROOF_BASE_CSS;
