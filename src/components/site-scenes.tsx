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
`;
