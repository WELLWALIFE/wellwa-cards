"use client";
// Sections drawn for ONE look only, not the shared section in another skin (owner, 14 Oct 2026: after the heroes were
// rebuilt the pages under them were still "all the same" — the top-site and Wix review had changed what a section IS
// on each of them, not only its colour). Two looks so far:
//   Full photo (cinematic) — scenes: a full-bleed About over its photo, a swipe strip of tall photos edge to edge,
//     the FAQ as a heading column beside the questions, services as large numbered rows.
//   Big name (wordmark) — an editorial page: About as one giant sentence with a narrow tall photo, services as a menu
//     of dotted lines, photos staggered in three columns, the FAQ as numbered open answers, one review as a pull quote.
// Everything is fed plain data by site-view.tsx (which owns translation and the lightbox); nothing here fetches.
import type { ReactNode } from "react";
import { Pic as Img } from "@/components/pic";
import type { TestimonialItem } from "@/lib/types";

type T = (s: string) => string;
type Photo = { url?: string; label: string };
const paras = (s?: string | null) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
const clean = (s: string) => s.replace(/^\d+[.)]\s*/, "");

/* ---------- Full photo ---------- */

/** The About text over its own photo, full width: the page's first "scene". */
export function SceneAbout({ title, body, image, eyebrow, t }: { title: string; body: string; image: string; eyebrow: string; t: T }) {
  const ps = paras(body);
  return (
    <section data-reveal className="scene-about">
      <Img src={image} alt="" className="scene-bg" sizes="100vw" />
      <i aria-hidden="true" className="scene-scrim" />
      <div className="scene-copy">
        <p className="scene-kicker">{eyebrow}</p>
        <h2 className="scene-h">{t(title)}</h2>
        <div className="scene-body">{ps.map((x, i) => <p key={i}>{t(x)}</p>)}</div>
      </div>
    </section>
  );
}

/** Tall photos in a swipe strip that runs edge to edge; the caption sits under each. */
export function SceneStrip({ imgs, onOpen, t }: { imgs: Photo[]; onOpen: (i: number) => void; t: T }) {
  return (
    <div className="scene-strip" role="list">
      {imgs.map((g, i) => (
        <button key={i} type="button" role="listitem" className="scene-shot group" onClick={() => onOpen(i)}>
          <Img src={g.url!} alt={g.label} className="scene-shot-img" eager={i < 2} sizes="(min-width:768px) 40vw, 80vw" />
          {g.label && <span className="scene-cap">{t(g.label)}</span>}
        </button>
      ))}
    </div>
  );
}

/** The FAQ as a heading column beside the questions (all open — nothing to click for a handful). */
export function SplitFaq({ eyebrow, title, items, aside, t }: { eyebrow: string; title: string; items: { q: string; a: string }[]; aside?: ReactNode; t: T }) {
  return (
    <div className="split-faq">
      <div className="split-faq-head">
        <p className="scene-kicker">{eyebrow}</p>
        <h2 className="sec-h2 mt-3">{t(title)}</h2>
        {aside && <div className="mt-6">{aside}</div>}
      </div>
      <div className="split-faq-list">
        {items.map((f, i) => (
          <details key={i} open={i === 0 || undefined} name="scene-faq">
            <summary>{t(f.q)}</summary>
            <p>{t(f.a)}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Services as large numbered rows: the number, the name big, the description beside it. */
export function SceneRows({ items, t }: { items: { name: string; desc?: string }[]; t: T }) {
  return (
    <ol className="scene-rows">
      {items.map((s, i) => (
        <li key={i}>
          <span className="scene-n">{String(i + 1).padStart(2, "0")}</span>
          <h3>{t(clean(s.name))}</h3>
          {s.desc && <p>{t(s.desc)}</p>}
        </li>
      ))}
    </ol>
  );
}

/* ---------- Big name ---------- */

/** One giant opening sentence, the rest in two quiet columns, a narrow tall photo beside it when there is one. */
export function EditorialAbout({ title, body, image, eyebrow, t }: { title: string; body: string; image?: string; eyebrow: string; t: T }) {
  // The giant line is the first sentence or two (up to ~150 characters); a whole paragraph set that big is a wall.
  const ps = paras(body);
  let lead = ps[0] ?? "";
  let tail = ps.slice(1);
  if (lead.length > 150) {
    const sentences = lead.match(/[^.!?।]+[.!?।]+\s*|[^.!?।]+$/g) ?? [lead];
    let cut = "";
    for (const x of sentences) { if (cut && (cut + x).length > 150) break; cut += x; }
    if (cut && cut.length < lead.length) { tail = [lead.slice(cut.length).trim(), ...tail]; lead = cut.trim(); }
  }
  const rest = tail.filter(Boolean);
  return (
    <div className={`ed-about ${image ? "has-img" : ""}`}>
      <div className="ed-about-text">
        <p className="kicker">{eyebrow}</p>
        <h2 className="ed-about-title">{t(title)}</h2>
        {lead && <p className="ed-lead">{t(lead)}</p>}
        {rest.length > 0 && <div className="ed-rest">{rest.map((x, i) => <p key={i}>{t(x)}</p>)}</div>}
      </div>
      {image && <div className="ed-about-ph"><Img src={image} alt="" className="ed-about-img" sizes="(min-width:1024px) 30vw, 70vw" /></div>}
    </div>
  );
}

/** A menu: the name, a dotted leader, the number; the description under it. Two columns on a wide screen. */
export function MenuServices({ items, t }: { items: { name: string; desc?: string }[]; t: T }) {
  return (
    <ul className="menu-list">
      {items.map((s, i) => (
        <li key={i}>
          <div className="menu-row"><h3>{t(clean(s.name))}</h3><i aria-hidden="true" /><span>{String(i + 1).padStart(2, "0")}</span></div>
          {s.desc && <p>{t(s.desc)}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Photos staggered in three columns, each its own height, the caption set under it — a printed contact sheet. */
export function StaggerGallery({ imgs, onOpen, t }: { imgs: Photo[]; onOpen: (i: number) => void; t: T }) {
  return (
    <div className="stagger">
      {imgs.map((g, i) => (
        <button key={i} type="button" className="stagger-it" data-i={i % 3} onClick={() => onOpen(i)}>
          <span className="stagger-ph"><Img src={g.url!} alt={g.label} className="stagger-img" eager={i < 3} sizes="(min-width:768px) 33vw, 50vw" /></span>
          {g.label && <span className="stagger-cap">{t(g.label)}</span>}
        </button>
      ))}
    </div>
  );
}

/** The FAQ as numbered, open answers in two columns; the question set in the display face. */
export function NumberedFaq({ items, t }: { items: { q: string; a: string }[]; t: T }) {
  return (
    <ol className="num-faq">
      {items.map((f, i) => (
        <li key={i}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <h3>{t(f.q)}</h3>
          <p>{t(f.a)}</p>
        </li>
      ))}
    </ol>
  );
}

/** The best review as one pull quote set huge; the others small underneath. */
export function PullQuote({ items, t }: { items: TestimonialItem[]; t: T }) {
  const [first, ...more] = items;
  return (
    <div className="pull">
      <blockquote><span aria-hidden="true">“</span>{t(first.text)}</blockquote>
      <p className="pull-by">— {first.name}</p>
      {more.length > 0 && (
        <div className="pull-more">
          {more.slice(0, 3).map((x, i) => <figure key={i}><blockquote>{t(x.text)}</blockquote><figcaption>{x.name}</figcaption></figure>)}
        </div>
      )}
    </div>
  );
}

/* ---------- Order shop and Photo collage (Haldiram's, Chaayos, Urban Company) ---------- */

/** Square rounded tiles with the name set UNDER the photo — Haldiram's "Gift with…" row, Urban Company's "Most booked". */
export function TileRow({ imgs, onOpen, t, across = 4 }: { imgs: Photo[]; onOpen: (i: number) => void; t: T; across?: number }) {
  // A last tile alone on a wide screen's second row looks like a mistake: show whole rows only.
  const n = imgs.length >= across ? imgs.length - (imgs.length % across) : imgs.length;
  return (
    <div className="tile-row" role="list">
      {imgs.slice(0, n).map((g, i) => (
        <button key={i} type="button" role="listitem" className="tile-it" onClick={() => onOpen(i)}>
          <span className="tile-ph"><Img src={g.url!} alt={g.label} className="tile-img" eager={i < 4} sizes="(min-width:768px) 22vw, 44vw" /></span>
          {g.label && <span className="tile-cap">{t(g.label)}</span>}
        </button>
      ))}
    </div>
  );
}

/** Services as small icon tiles with the name under (Urban Company's category grid); the description is one soft line. */
export function IconTiles({ items, t }: { items: { name: string; desc?: string }[]; t: T }) {
  return (
    <ul className="icon-tiles">
      {items.map((s, i) => (
        <li key={i}>
          <i aria-hidden="true">{String(i + 1).padStart(2, "0")}</i>
          <h3>{t(clean(s.name))}</h3>
          {s.desc && <p>{t(s.desc)}</p>}
        </li>
      ))}
    </ul>
  );
}

/** About as a promo banner: the photo fills one half edge to edge, the words sit on a tinted field (Haldiram's bulk-gifting banner). */
export function BannerAbout({ title, body, image, eyebrow, flip, t }: { title: string; body: string; image: string; eyebrow: string; flip?: boolean; t: T }) {
  const ps = paras(body);
  return (
    <div className={`banner-about ${flip ? "flip" : ""}`}>
      <div className="banner-ph"><Img src={image} alt="" className="banner-img" sizes="(min-width:900px) 50vw, 100vw" /></div>
      <div className="banner-words">
        <p className="kicker">{eyebrow}</p>
        <h2 className="banner-h">{t(title)}</h2>
        <div className="banner-body">{ps.map((x, i) => <p key={i}>{t(x)}</p>)}</div>
      </div>
    </div>
  );
}

/** Reviews as a swipe row of cards, the rating big on each. */
export function ReviewRow({ items, t }: { items: TestimonialItem[]; t: T }) {
  return (
    <div className="rev-row" role="list">
      {items.map((x, i) => (
        <figure key={i} role="listitem">
          <span className="rev-star" aria-label={`${Math.round(Number(x.rating) || 5)} / 5`}>{"★".repeat(Math.max(1, Math.min(5, Math.round(Number(x.rating) || 5))))}</span>
          <blockquote>{t(x.text)}</blockquote>
          <figcaption>{x.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ---------- Colour poster (Chaayos, Nham) and Tile board (Notion, Practo) ---------- */

/** Services as solid colour blocks, the name in capitals and a big number — a poster wall. */
export function ColourBlocks({ items, t }: { items: { name: string; desc?: string }[]; t: T }) {
  return (
    <ul className="col-blocks">
      {items.map((s, i) => (
        <li key={i} data-c={i % 3}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <h3>{t(clean(s.name))}</h3>
          {s.desc && <p>{t(s.desc)}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Photos with a solid caption bar across the foot of each, three across (Chaayos "Shop now"). */
export function LabelWall({ imgs, onOpen, t }: { imgs: Photo[]; onOpen: (i: number) => void; t: T }) {
  const n = imgs.length >= 3 ? imgs.length - (imgs.length % 3 === 0 ? 0 : imgs.length % 3) : imgs.length;
  return (
    <div className="label-wall">
      {imgs.slice(0, n || imgs.length).map((g, i) => (
        <button key={i} type="button" className="label-it" data-c={i % 3} onClick={() => onOpen(i)}>
          <Img src={g.url!} alt={g.label} className="label-img" eager={i < 3} sizes="(min-width:768px) 33vw, 50vw" />
          {g.label && <span className="label-bar">{t(g.label)}</span>}
        </button>
      ))}
    </div>
  );
}

/** Reviews as coloured cards, each its own field, the quote large. */
export function ColourReviews({ items, t }: { items: TestimonialItem[]; t: T }) {
  return (
    <div className="col-revs">
      {items.slice(0, 3).map((x, i) => (
        <figure key={i} data-c={i % 3}>
          <span aria-hidden="true">“</span>
          <blockquote>{t(x.text)}</blockquote>
          <figcaption>{x.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Services as a bento: the first card double-size and filled, the rest small, a label on top and an arrow below. */
export function BentoServices({ items, t }: { items: { name: string; desc?: string }[]; t: T }) {
  return (
    <ul className="bento-sv">
      {items.map((s, i) => (
        <li key={i} className={i === 0 ? "lead" : ""}>
          <small>{String(i + 1).padStart(2, "0")}</small>
          <h3>{t(clean(s.name))}</h3>
          {s.desc && <p>{t(s.desc)}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Photos as bento tiles of mixed size, the label a pill in the corner. */
export function BentoGallery({ imgs, onOpen, t }: { imgs: Photo[]; onOpen: (i: number) => void; t: T }) {
  return (
    <div className="bento-gl">
      {imgs.slice(0, 4).map((g, i) => (
        <button key={i} type="button" className="bento-gl-it" data-i={i} onClick={() => onOpen(i)}>
          <Img src={g.url!} alt={g.label} className="bento-gl-img" eager={i < 3} sizes="(min-width:768px) 30vw, 50vw" />
          {g.label && <span className="bento-pill">{t(g.label)}</span>}
        </button>
      ))}
    </div>
  );
}

/** About as two bento cards: the words on a tint, the photo beside them. */
export function BentoAbout({ title, body, image, eyebrow, t }: { title: string; body: string; image?: string; eyebrow: string; t: T }) {
  const ps = paras(body);
  return (
    <div className={`bento-ab ${image ? "has-img" : ""}`}>
      <div className="bento-ab-words">
        <small>{eyebrow}</small>
        <h2>{t(title)}</h2>
        <div>{ps.map((x, i) => <p key={i}>{t(x)}</p>)}</div>
      </div>
      {image && <div className="bento-ab-ph"><Img src={image} alt="" className="bento-ab-img" sizes="(min-width:900px) 40vw, 100vw" /></div>}
    </div>
  );
}

/** Reviews as bento cards: the first wide, a stars line on each. */
export function BentoReviews({ items, t }: { items: TestimonialItem[]; t: T }) {
  return (
    <div className="bento-rv">
      {items.slice(0, 3).map((x, i) => (
        <figure key={i} className={i === 0 ? "lead" : ""}>
          <span className="bento-stars">{"★".repeat(Math.max(1, Math.min(5, Math.round(Number(x.rating) || 5))))}</span>
          <blockquote>{t(x.text)}</blockquote>
          <figcaption>{x.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** CSS for both looks (tokens only), scoped to the blueprint so no other look changes. */
export const SCENES_CSS = `
.site[data-bp="cinematic"] .scene-about{position:relative;min-height:min(86vh,720px);display:flex;align-items:flex-end;overflow:hidden;color:#fff;background:#111}
.site[data-bp="cinematic"] .scene-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="cinematic"] .scene-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgb(0 0 0/.78),rgb(0 0 0/.15) 70%)}
.site[data-bp="cinematic"] .scene-copy{position:relative;width:100%;max-width:72rem;margin:0 auto;padding:var(--s8) 24px var(--s7)}
.site[data-bp="cinematic"] .scene-kicker{margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.8}
.site[data-bp="cinematic"] .scene-h{margin:12px 0 0;font-size:clamp(2.25rem,7vw,4.75rem);line-height:1;letter-spacing:-.02em;font-weight:400;max-width:16ch;text-wrap:balance;color:#fff}
.site[data-bp="cinematic"] .scene-body{margin-top:var(--s5);max-width:56ch;font-size:1.0625rem;line-height:1.6;color:rgb(255 255 255/.9)}
.site[data-bp="cinematic"] .scene-body p+p{margin-top:.8em}
.site[data-bp="cinematic"] .scene-strip{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin:0 -20px;padding:0 20px}
.site[data-bp="cinematic"] .scene-strip::-webkit-scrollbar{display:none}
.site[data-bp="cinematic"] .scene-shot{position:relative;flex:0 0 78vw;height:min(62vh,520px);scroll-snap-align:center;overflow:hidden;border:0;padding:0;background:var(--paper-2);cursor:zoom-in}
.site[data-bp="cinematic"] .scene-shot-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="cinematic"] .scene-cap{position:absolute;left:0;right:0;bottom:0;padding:28px 14px 12px;text-align:left;font-size:13px;color:#fff;background:linear-gradient(to top,rgb(0 0 0/.6),transparent)}
@media (min-width:768px){.site[data-bp="cinematic"] .scene-shot{flex-basis:38vw}.site[data-bp="cinematic"] .scene-strip{margin:0 calc(50% - 50vw);padding:0 max(24px,calc(50vw - 36rem))}}
.site[data-bp="cinematic"] .split-faq{display:grid;gap:var(--s6)}
.site[data-bp="cinematic"] .split-faq-list details{border-bottom:1px solid var(--line);padding:0}
.site[data-bp="cinematic"] .split-faq-list summary{cursor:pointer;list-style:none;padding:20px 0;font-size:1.15rem;font-family:var(--font-display,var(--look-head))}
.site[data-bp="cinematic"] .split-faq-list summary::-webkit-details-marker{display:none}
.site[data-bp="cinematic"] .split-faq-list summary::after{content:"+";float:right;color:var(--accent);font-size:1.4rem;line-height:1}
.site[data-bp="cinematic"] .split-faq-list details[open] summary::after{content:"–"}
.site[data-bp="cinematic"] .split-faq-list p{margin:0 0 20px;color:var(--muted);line-height:1.6;max-width:60ch}
@media (min-width:900px){.site[data-bp="cinematic"] .split-faq{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:var(--s8)}.site[data-bp="cinematic"] .split-faq-head{position:sticky;top:96px;align-self:start}}
.site[data-bp="cinematic"] .scene-rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.site[data-bp="cinematic"] .scene-rows li{display:grid;grid-template-columns:auto 1fr;gap:4px 20px;padding:26px 0;border-bottom:1px solid var(--line);align-items:baseline}
.site[data-bp="cinematic"] .scene-n{grid-row:1/3;font-size:12px;letter-spacing:.18em;color:var(--accent)}
.site[data-bp="cinematic"] .scene-rows h3{margin:0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.4rem,4vw,2.2rem);line-height:1.1;font-weight:400}
.site[data-bp="cinematic"] .scene-rows p{margin:0;color:var(--muted);line-height:1.55;max-width:60ch}
@media (min-width:900px){.site[data-bp="cinematic"] .scene-rows li{grid-template-columns:64px minmax(0,1fr) minmax(0,1fr);gap:0 32px}.site[data-bp="cinematic"] .scene-n{grid-row:auto}.site[data-bp="cinematic"] .scene-rows p{align-self:center}}

.site[data-bp="wordmark"] .ed-about{display:grid;gap:var(--s6)}
.site[data-bp="wordmark"] .ed-about-title{margin:12px 0 0;font-size:clamp(.95rem,2vw,1.1rem);letter-spacing:.14em;text-transform:uppercase;font-weight:600;font-family:var(--font-text,var(--look-body));color:var(--muted)}
.site[data-bp="wordmark"] .ed-lead{margin:var(--s4) 0 0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.7rem,5.6vw,3.1rem);line-height:1.12;letter-spacing:-.02em;text-wrap:balance}
.site[data-bp="wordmark"] .ed-lead:lang(hi){line-height:1.35;letter-spacing:0}
.site[data-bp="wordmark"] .ed-rest{margin-top:var(--s5);color:var(--muted);font-size:1.0625rem;line-height:1.65;columns:1;column-gap:var(--s6)}
.site[data-bp="wordmark"] .ed-rest p{margin:0 0 1em;break-inside:avoid}
.site[data-bp="wordmark"] .ed-about-ph{aspect-ratio:3/4;overflow:hidden;border-radius:var(--r-img);background:var(--paper-2);max-width:340px}
.site[data-bp="wordmark"] .ed-about-img{width:100%;height:100%;object-fit:cover}
@media (min-width:900px){.site[data-bp="wordmark"] .ed-about.has-img{grid-template-columns:minmax(0,8fr) minmax(0,3.4fr);gap:var(--s8);align-items:start}.site[data-bp="wordmark"] .ed-about.has-img .ed-about-ph{margin-top:var(--s8)}.site[data-bp="wordmark"] .ed-rest{columns:2}}
.site[data-bp="wordmark"] .menu-list{list-style:none;margin:0;padding:0;display:grid;gap:0 var(--s8)}
.site[data-bp="wordmark"] .menu-list li{padding:18px 0;border-bottom:1px solid var(--line)}
.site[data-bp="wordmark"] .menu-row{display:flex;align-items:baseline;gap:12px}
.site[data-bp="wordmark"] .menu-row h3{margin:0;font-family:var(--font-display,var(--look-head));font-size:1.35rem;font-weight:var(--display-w,500);letter-spacing:-.01em}
.site[data-bp="wordmark"] .menu-row i{flex:1;min-width:16px;border-bottom:2px dotted var(--line);transform:translateY(-.3em)}
.site[data-bp="wordmark"] .menu-row span{font-size:12px;letter-spacing:.12em;color:var(--accent)}
.site[data-bp="wordmark"] .menu-list p{margin:6px 0 0;color:var(--muted);font-size:.95rem;line-height:1.5;max-width:46ch}
@media (min-width:900px){.site[data-bp="wordmark"] .menu-list{grid-template-columns:1fr 1fr}}
.site[data-bp="wordmark"] .stagger{display:grid;grid-template-columns:1fr 1fr;gap:var(--s5) var(--s3);align-items:start}
.site[data-bp="wordmark"] .stagger-it{display:block;border:0;padding:0;background:none;text-align:left;cursor:zoom-in}
.site[data-bp="wordmark"] .stagger-ph{position:relative;display:block;overflow:hidden;background:var(--paper-2);aspect-ratio:4/5}
.site[data-bp="wordmark"] .stagger-it[data-i="1"] .stagger-ph{aspect-ratio:1}
.site[data-bp="wordmark"] .stagger-it[data-i="2"] .stagger-ph{aspect-ratio:3/4}
.site[data-bp="wordmark"] .stagger-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="wordmark"] .stagger-cap{display:block;margin-top:8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
@media (min-width:768px){.site[data-bp="wordmark"] .stagger{grid-template-columns:repeat(3,1fr);gap:var(--s7) var(--s5)}.site[data-bp="wordmark"] .stagger-it[data-i="1"]{margin-top:var(--s8)}.site[data-bp="wordmark"] .stagger-it[data-i="2"]{margin-top:var(--s5)}}
.site[data-bp="wordmark"] .num-faq{list-style:none;margin:0;padding:0;display:grid;gap:var(--s6) var(--s8)}
.site[data-bp="wordmark"] .num-faq li{border-top:1px solid var(--ink);padding-top:var(--s4)}
.site[data-bp="wordmark"] .num-faq span{font-size:12px;letter-spacing:.14em;color:var(--accent)}
.site[data-bp="wordmark"] .num-faq h3{margin:8px 0 0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.3rem,3.4vw,1.7rem);line-height:1.15;letter-spacing:-.01em;font-weight:var(--display-w,500)}
.site[data-bp="wordmark"] .num-faq p{margin:10px 0 0;color:var(--muted);line-height:1.6}
@media (min-width:900px){.site[data-bp="wordmark"] .num-faq{grid-template-columns:1fr 1fr}}
.site[data-bp="wordmark"] .pull blockquote{margin:0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.7rem,5.4vw,3.4rem);line-height:1.12;letter-spacing:-.02em;text-wrap:balance}
.site[data-bp="wordmark"] .pull blockquote:lang(hi){line-height:1.35;letter-spacing:0}
.site[data-bp="wordmark"] .pull blockquote>span{color:var(--accent);margin-right:.08em}
.site[data-bp="wordmark"] .pull-by{margin:var(--s4) 0 0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.site[data-bp="wordmark"] .pull-more{display:grid;gap:var(--s5);margin-top:var(--s7);padding-top:var(--s5);border-top:1px solid var(--line)}
.site[data-bp="wordmark"] .pull-more blockquote{font-family:var(--font-text,var(--look-body));font-size:1rem;line-height:1.55;letter-spacing:0;color:var(--ink)}
.site[data-bp="wordmark"] .pull-more figcaption{margin-top:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
@media (min-width:900px){.site[data-bp="wordmark"] .pull-more{grid-template-columns:repeat(3,1fr);gap:var(--s6)}}

.site[data-bp="shop"] .tile-row,.site[data-bp="collage"] .tile-row{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;margin:0 -20px;padding:0 20px 4px}
.site[data-bp="shop"] .tile-row::-webkit-scrollbar,.site[data-bp="collage"] .tile-row::-webkit-scrollbar,.site[data-bp="shop"] .rev-row::-webkit-scrollbar,.site[data-bp="collage"] .rev-row::-webkit-scrollbar{display:none}
.site[data-bp="shop"] .tile-it,.site[data-bp="collage"] .tile-it{flex:0 0 clamp(150px,42vw,210px);scroll-snap-align:start;border:0;padding:0;background:none;text-align:left;cursor:zoom-in}
.site[data-bp="shop"] .tile-ph,.site[data-bp="collage"] .tile-ph{position:relative;display:block;aspect-ratio:1;overflow:hidden;border-radius:var(--r-card);background:var(--paper-2)}
.site[data-bp="shop"] .tile-img,.site[data-bp="collage"] .tile-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="shop"] .tile-cap,.site[data-bp="collage"] .tile-cap{display:block;margin-top:10px;font-weight:600;font-size:15px;line-height:1.25;color:var(--ink)}
.site[data-bp="collage"] .tile-ph{aspect-ratio:4/5}
@media (min-width:900px){.site[data-bp="shop"] .tile-row,.site[data-bp="collage"] .tile-row{margin:0;padding:0;overflow:visible;display:grid;grid-template-columns:repeat(4,1fr)}.site[data-bp="collage"] .tile-row{grid-template-columns:repeat(5,1fr)}}
.site[data-bp="shop"] .icon-tiles,.site[data-bp="collage"] .icon-tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.site[data-bp="shop"] .icon-tiles li,.site[data-bp="collage"] .icon-tiles li{display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:var(--r-card);background:var(--surface);border:1px solid var(--line)}
.site[data-bp="shop"] .icon-tiles i,.site[data-bp="collage"] .icon-tiles i{display:grid;place-items:center;width:44px;height:44px;border-radius:var(--r-ctl);background:var(--p-soft);color:var(--accent);font-style:normal;font-size:13px;font-weight:700;letter-spacing:.06em}
.site[data-bp="shop"] .icon-tiles h3,.site[data-bp="collage"] .icon-tiles h3{margin:6px 0 0;font-size:15px;font-weight:600;line-height:1.25}
.site[data-bp="shop"] .icon-tiles p,.site[data-bp="collage"] .icon-tiles p{margin:0;font-size:13px;line-height:1.45;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site[data-bp="shop"] .icon-tiles i{border-radius:999px}
@media (min-width:900px){.site[data-bp="shop"] .icon-tiles{grid-template-columns:repeat(4,1fr)}.site[data-bp="collage"] .icon-tiles{grid-template-columns:repeat(4,1fr);gap:16px}.site[data-bp="collage"] .icon-tiles li{padding:22px}}
.site[data-bp="shop"] .banner-about,.site[data-bp="collage"] .banner-about{display:grid;overflow:hidden;border-radius:var(--r-tile);background:var(--p-soft)}
.site[data-bp="shop"] .banner-ph,.site[data-bp="collage"] .banner-ph{position:relative;aspect-ratio:16/10}
.site[data-bp="shop"] .banner-img,.site[data-bp="collage"] .banner-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="shop"] .banner-words,.site[data-bp="collage"] .banner-words{padding:var(--s5) var(--s5) var(--s6)}
.site[data-bp="shop"] .banner-h,.site[data-bp="collage"] .banner-h{margin:10px 0 0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.1;letter-spacing:-.01em;text-wrap:balance}
.site[data-bp="shop"] .banner-body,.site[data-bp="collage"] .banner-body{margin-top:var(--s4);color:var(--muted);line-height:1.6;max-width:54ch}
.site[data-bp="shop"] .banner-body p+p,.site[data-bp="collage"] .banner-body p+p{margin-top:.7em}
@media (min-width:900px){.site[data-bp="shop"] .banner-about,.site[data-bp="collage"] .banner-about{grid-template-columns:1fr 1fr;min-height:420px}.site[data-bp="shop"] .banner-ph,.site[data-bp="collage"] .banner-ph{aspect-ratio:auto}.site[data-bp="shop"] .banner-words,.site[data-bp="collage"] .banner-words{display:flex;flex-direction:column;justify-content:center;padding:var(--s7)}.site[data-bp="collage"] .banner-about.flip .banner-ph{order:2}.site[data-bp="shop"] .banner-about.flip .banner-ph{order:2}}
.site[data-bp="shop"] .banner-about{background:linear-gradient(135deg,var(--p-soft),var(--paper-2));border:1px solid var(--line)}
.site[data-bp="collage"] .banner-about{background:var(--paper-2)}
.site[data-bp="shop"] .rev-row,.site[data-bp="collage"] .rev-row{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;margin:0 -20px;padding:0 20px 4px}
.site[data-bp="shop"] .rev-row figure,.site[data-bp="collage"] .rev-row figure{flex:0 0 clamp(250px,78vw,340px);scroll-snap-align:start;margin:0;padding:20px;border-radius:var(--r-card);background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:10px}
.site[data-bp="shop"] .rev-star,.site[data-bp="collage"] .rev-star{color:var(--accent);letter-spacing:.12em;font-size:15px}
.site[data-bp="shop"] .rev-row blockquote,.site[data-bp="collage"] .rev-row blockquote{margin:0;font-size:.98rem;line-height:1.55;color:var(--ink);display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.site[data-bp="shop"] .rev-row figcaption,.site[data-bp="collage"] .rev-row figcaption{margin-top:auto;font-size:13px;font-weight:600;color:var(--muted)}
@media (min-width:900px){.site[data-bp="shop"] .rev-row,.site[data-bp="collage"] .rev-row{margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);overflow:visible}}
/* The shop's products become Haldiram's swipe rows: tall cards you slide along, the Order pill at the foot of each. */
.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img){display:flex;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;margin:0 -20px;padding:0 20px 6px;gap:14px}
.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img)::-webkit-scrollbar{display:none}
.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img)>*{flex:0 0 clamp(170px,46vw,250px);scroll-snap-align:start}
@media (min-width:1024px){.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img){margin:0;padding:0 0 6px}.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img)>*{flex-basis:calc(25% - 11px)}}
/* The collage's products: caption under a tall photo, five across, no description. */
.site[data-bp="collage"] main .grid.sm\\:grid-cols-2:has(.p-img){grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s4) var(--s3)}
.site[data-bp="collage"] main .s-card{border:0;box-shadow:none;background:transparent;border-radius:0}
.site[data-bp="collage"] main .s-card .p-img{aspect-ratio:4/5;border-radius:var(--r-card)}
.site[data-bp="collage"] main .s-card>.p-5{padding:10px 0 0}
.site[data-bp="collage"] main .s-card .line-clamp-2,.site[data-bp="collage"] main .s-card details{display:none}
@media (min-width:900px){.site[data-bp="collage"] main .grid.sm\\:grid-cols-2:has(.p-img){grid-template-columns:repeat(4,minmax(0,1fr))}}

.site[data-bp="story"] .col-blocks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.site[data-bp="story"] .col-blocks li{display:flex;flex-direction:column;gap:8px;padding:18px 16px 22px;min-height:150px;border:2px solid var(--p-deep);box-shadow:5px 5px 0 0 var(--p-deep)}
.site[data-bp="story"] .col-blocks li[data-c="0"]{background:var(--p-deep);color:#fff}
.site[data-bp="story"] .col-blocks li[data-c="1"]{background:var(--p-soft);color:var(--p-deep)}
.site[data-bp="story"] .col-blocks li[data-c="2"]{background:#fff;color:var(--p-deep)}
.site[data-bp="story"] .col-blocks span{font-family:var(--font-display,var(--look-head));font-size:2.2rem;line-height:1;opacity:.9}
.site[data-bp="story"] .col-blocks h3{margin:auto 0 0;text-transform:uppercase;letter-spacing:.03em;font-size:1rem;line-height:1.2;font-weight:800}
.site[data-bp="story"] .col-blocks p{margin:0;font-size:13px;line-height:1.4;opacity:.85;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (min-width:900px){.site[data-bp="story"] .col-blocks{grid-template-columns:repeat(4,1fr);gap:16px}}
.site[data-bp="story"] .label-wall{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.site[data-bp="story"] .label-it{position:relative;display:block;aspect-ratio:3/4;overflow:hidden;border:2px solid var(--p-deep);padding:0;background:var(--paper-2);cursor:zoom-in}
.site[data-bp="story"] .label-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="story"] .label-bar{position:absolute;left:0;right:0;bottom:0;padding:9px 10px;text-align:center;text-transform:uppercase;letter-spacing:.08em;font-weight:800;font-size:12px;border-top:2px solid var(--p-deep)}
.site[data-bp="story"] .label-it[data-c="0"] .label-bar{background:var(--p-deep);color:#fff}
.site[data-bp="story"] .label-it[data-c="1"] .label-bar{background:var(--p-soft);color:var(--p-deep)}
.site[data-bp="story"] .label-it[data-c="2"] .label-bar{background:#fff;color:var(--p-deep)}
@media (min-width:768px){.site[data-bp="story"] .label-wall{grid-template-columns:repeat(3,1fr);gap:16px}.site[data-bp="story"] .label-it{aspect-ratio:4/5}}
.site[data-bp="story"] .col-revs{display:grid;gap:14px}
.site[data-bp="story"] .col-revs figure{margin:0;padding:22px;border:2px solid var(--p-deep);box-shadow:6px 6px 0 0 var(--p-deep);display:flex;flex-direction:column;gap:10px}
.site[data-bp="story"] .col-revs figure[data-c="0"]{background:var(--p-deep);color:#fff}
.site[data-bp="story"] .col-revs figure[data-c="1"]{background:var(--p-soft);color:var(--p-deep)}
.site[data-bp="story"] .col-revs figure[data-c="2"]{background:#fff;color:var(--p-deep)}
.site[data-bp="story"] .col-revs span{font-family:var(--font-display,var(--look-head));font-size:3rem;line-height:.6}
.site[data-bp="story"] .col-revs blockquote{margin:0;font-weight:600;font-size:1.05rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.site[data-bp="story"] .col-revs figcaption{margin-top:auto;font-size:12px;text-transform:uppercase;letter-spacing:.1em;font-weight:800}
@media (min-width:900px){.site[data-bp="story"] .col-revs{grid-template-columns:repeat(3,1fr);gap:18px}}

.site[data-bp="bento"] .bento-sv{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.site[data-bp="bento"] .bento-sv li{position:relative;display:flex;flex-direction:column;gap:6px;padding:18px;min-height:132px;border-radius:var(--r-tile);background:var(--surface);border:1px solid var(--line)}
.site[data-bp="bento"] .bento-sv li.lead{grid-column:1/-1;background:var(--accent);color:var(--on-accent);border-color:transparent;min-height:180px}
.site[data-bp="bento"] .bento-sv small{font-size:12px;letter-spacing:.14em;opacity:.7}
.site[data-bp="bento"] .bento-sv h3{margin:auto 0 0;font-size:1.05rem;line-height:1.2;font-weight:700;padding-right:30px}
.site[data-bp="bento"] .bento-sv li.lead h3{font-size:clamp(1.4rem,4vw,2rem)}
.site[data-bp="bento"] .bento-sv p{margin:0;font-size:13px;line-height:1.45;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site[data-bp="bento"] .bento-sv li.lead p{color:inherit;opacity:.85}
.site[data-bp="bento"] .bento-sv li::after{content:"\\2192";position:absolute;right:14px;bottom:14px;display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:var(--p-soft);color:var(--accent);font-size:14px}
.site[data-bp="bento"] .bento-sv li.lead::after{background:var(--on-accent);color:var(--accent)}
@media (min-width:900px){.site[data-bp="bento"] .bento-sv{grid-template-columns:repeat(4,1fr);gap:14px}.site[data-bp="bento"] .bento-sv li.lead{grid-column:span 2;grid-row:span 2}}
.site[data-bp="bento"] .bento-gl{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:150px;gap:10px}
.site[data-bp="bento"] .bento-gl-it{position:relative;overflow:hidden;border:0;padding:0;border-radius:var(--r-tile);background:var(--paper-2);cursor:zoom-in}
.site[data-bp="bento"] .bento-gl-it[data-i="0"]{grid-column:1/-1;grid-row:span 2}.site[data-bp="bento"] .bento-gl-it[data-i="3"]{grid-column:1/-1}
.site[data-bp="bento"] .bento-gl-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.site[data-bp="bento"] .bento-pill{position:absolute;left:10px;bottom:10px;padding:5px 12px;border-radius:999px;background:rgb(255 255 255/.92);color:#1a1a1a;font-size:12px;font-weight:600}
@media (min-width:900px){.site[data-bp="bento"] .bento-gl{grid-template-columns:repeat(4,1fr);grid-auto-rows:190px}.site[data-bp="bento"] .bento-gl-it[data-i="0"]{grid-column:span 2;grid-row:span 2}.site[data-bp="bento"] .bento-gl-it[data-i="3"]{grid-column:span 2}}
.site[data-bp="bento"] .bento-ab{display:grid;gap:12px}
.site[data-bp="bento"] .bento-ab-words{padding:var(--s5);border-radius:var(--r-tile);background:var(--surface);border:1px solid var(--line)}
.site[data-bp="bento"] .bento-ab-words small{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
.site[data-bp="bento"] .bento-ab-words h2{margin:10px 0 0;font-family:var(--font-display,var(--look-head));font-size:clamp(1.7rem,5vw,2.6rem);line-height:1.08;letter-spacing:-.02em}
.site[data-bp="bento"] .bento-ab-words div{margin-top:var(--s4);color:var(--muted);line-height:1.6}
.site[data-bp="bento"] .bento-ab-words p+p{margin-top:.7em}
.site[data-bp="bento"] .bento-ab-ph{position:relative;min-height:260px;border-radius:var(--r-tile);overflow:hidden}
.site[data-bp="bento"] .bento-ab-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
@media (min-width:900px){.site[data-bp="bento"] .bento-ab.has-img{grid-template-columns:1.5fr 1fr;gap:14px}.site[data-bp="bento"] .bento-ab-words{padding:var(--s7)}}
.site[data-bp="bento"] .bento-rv{display:grid;gap:12px}
.site[data-bp="bento"] .bento-rv figure{margin:0;padding:22px;border-radius:var(--r-tile);background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:10px}
.site[data-bp="bento"] .bento-rv figure.lead{background:var(--paper);box-shadow:0 10px 30px -22px rgb(0 0 0/.35)}
.site[data-bp="bento"] .bento-stars{color:var(--accent);letter-spacing:.12em;font-size:14px}
.site[data-bp="bento"] .bento-rv blockquote{margin:0;line-height:1.55;font-size:1rem;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.site[data-bp="bento"] .bento-rv figure.lead blockquote{font-family:var(--font-display,var(--look-head));font-size:1.35rem;line-height:1.3}
.site[data-bp="bento"] .bento-rv figcaption{margin-top:auto;font-size:13px;font-weight:600;color:var(--muted)}
@media (min-width:900px){.site[data-bp="bento"] .bento-rv{grid-template-columns:2fr 1fr 1fr;gap:14px}}
.site[data-bp="bento"] main .faq{border:0;display:grid;gap:10px}
.site[data-bp="bento"] main .faq details{border:1px solid var(--line);border-radius:var(--r-card);padding:0 18px;background:var(--surface)}
@media (min-width:900px){.site[data-bp="bento"] main .faq.grid{grid-template-columns:1fr 1fr}}
`;
