"use client";
// Advanced-site ABOUT variants, the story-and-people set (owner, 16 Oct 2026: "looks nice but needs a LOT of hard work" - an About
// section must read like a page from a brand book, not a paragraph in a box).
//   story-columns   the opening sentence set very large with its last words in the accent, an arched photo and a "since" stamp,
//                   the rest of the story in two columns under a drop cap
//   overlap-card    a tall photo with a second small one tucked into its corner, the story on a card that overlaps it, the
//                   opening line in the display face, the owner's "good to know" list as chips
//   manifesto       the opening sentence across the full width at poster size, two photos offset around the story
//   chapters        the story as numbered chapters beside a sticky photo that changes with the chapter in view
//   founder-letter  a portrait with a name plate beside the story set as a letter, signed
//   banner-columns  a wide photograph, then a panel that overlaps it holding the title, the story and the numbered "good to know"
//
// Real material only: the year comes from the owner's own words (or the card's facts), the name from the card, the photos from the
// page. A part with no material (stamp, portrait, chips, second photo) is left out, never filled with a placeholder. Colours, corners,
// spacing and faces come only from the spec's tokens (shared.tsx); the entrances run only when the section scrolls into view.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/site-icons";
import { Stamp, Parallax } from "@/components/site-adv/motion";
import { Btn, Eyebrow, H2, Photo, Sec, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";

/* ================= helpers ================= */

/** Words that end in a full stop without ending a sentence. */
const ABBR = /^(?:dr|mr|mrs|ms|prof|rs|no|st|vs|etc|jr|sr|smt|shri)\.$/i;
/** A text as sentences (no look-behind, so older phones parse it): a word ends one when it closes with . ! ? or the danda. */
function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const w of text.split(/\s+/).filter(Boolean)) {
    cur.push(w);
    if (/[.!?।]["')\]”’]*$/.test(w) && !ABBR.test(w) && !/^[A-Z]\.$/.test(w)) { out.push(cur.join(" ")); cur = []; }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

type Story = { title: string; eyebrow: string; paras: string[]; statement: string; rest: string[]; image?: string };
/** The About block in the visitor's language. The statement is the first sentence when it is a usable length (20-170 characters),
 *  else the block's title; null when the page has no story. */
function readStory(c: SiteContent, x: AdvCtx): Story | null {
  const a = c.about; if (!a) return null;
  const title = x.t(a.title);
  const paras = a.paras.map((p) => x.t(p)).filter(Boolean);
  let statement = title, rest = paras;
  if (paras.length) {
    const first = sentencesOf(paras[0]);
    if (first.length && first[0].length >= 20 && first[0].length <= 170) {
      const tail = first.slice(1).join(" ");
      statement = first[0]; rest = [...(tail ? [tail] : []), ...paras.slice(1)];
    } else if (paras[0].length <= 170) { statement = paras[0]; rest = paras.slice(1); }
  }
  return { title, eyebrow: statement === title ? x.ui("Our story", "हमारी कहानी") : title, paras, statement, rest, image: a.image };
}

/** The year the owner says the business began ("since 1998", "est. 2004", "1998 से"), else a "Since 2015" fact of the card. Only a year
 *  the owner wrote: nothing is worked out or guessed. */
function sinceOf(c: SiteContent, x: AdvCtx): string | null {
  const text = [...(c.about?.paras ?? []), x.card.tagline ?? ""].join(" ");
  const m = /\b(?:since|est\.?|established(?:\s+in)?|founded(?:\s+in)?|started(?:\s+in)?|opened(?:\s+in)?)\s*[:,]?\s*((?:19|20)\d{2})\b/i.exec(text) ?? /\b((?:19|20)\d{2})\s*(?:से|में शुरू)/.exec(text);
  if (m) return m[1];
  for (const f of c.facts) { const y = /^(?:Since\s+)?((?:19|20)\d{2})(?:\s*से)?$/.exec(f.value.trim()); if (y && /since|से/i.test(f.value)) return y[1]; }
  return null;
}

/** Pictures for a variant that wants several: the About photo, then the page's others, the hero's own picture last. */
function storyPics(c: SiteContent, x: AdvCtx, max: number): string[] {
  const cover = x.card.coverUrl;
  const list = [c.about?.image, ...c.photos.filter((u) => u !== cover), cover].filter((u): u is string => !!u);
  return list.filter((u, i) => list.indexOf(u) === i).slice(0, max);
}

/** The person behind the business, from the card: a name only when the card names someone other than the business. */
function ownerOf(c: SiteContent, x: AdvCtx) {
  const { card } = x;
  const person = (card.name ?? "").trim();
  const isPerson = !!person && person.toLowerCase() !== c.name.trim().toLowerCase() && person.toLowerCase() !== (card.company ?? "").trim().toLowerCase();
  const name = isPerson ? person : c.name;
  const role = isPerson ? x.t((card.jobTitle ?? "").trim()) || c.name : c.trade;
  const first = Array.from(name.split(/\s+/).filter((w) => !/^(dr|mr|mrs|ms|shri|smt)\.?$/i.test(w))[0] ?? name).join("");
  return { isPerson, name, role, first, avatar: card.avatarUrl || undefined };
}

/** A photo that opens the lightbox: a real button, so the keyboard reaches it. */
function Zoom({ src, list, at = 0, x, name, sizes, className = "" }: { src: string; list: string[]; at?: number; x: AdvCtx; name: string; sizes?: string; className?: string }) {
  return (
    <button type="button" className={`abm-zoom ${className}`} onClick={() => x.zoom(list, at, name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")}>
      <Photo src={src} alt="" sizes={sizes} />
    </button>
  );
}

/** The section's body. Its `.abx-rv` children rise in when it first scrolls into view. The page's own reveal adds `.in` to every section a few
 *  seconds after load whether it was seen or not, so the entrance is timed here instead: armed before the first paint only when the body
 *  starts below the fold, and never for reduced motion or the spec's motion "none" (those, and the server's HTML, show the finished page). */
const useIsoLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;
export function Seen({ className = "", children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useIsoLayout(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || el.closest("[data-motion=none]")) return;
    if (el.getBoundingClientRect().top < (window.innerHeight || 800) * 0.9) return;
    el.dataset.arm = "";
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { el.dataset.seen = ""; io.disconnect(); } }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => { io.disconnect(); delete el.dataset.arm; delete el.dataset.seen; };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

/** The text with its last `n` words set in the accent (italic where the script has one); short lines are left plain. */
function Emph({ text, n = 3 }: { text: string; n?: number }) {
  const w = text.trim().split(/\s+/);
  if (w.length < 7) return <>{text}</>;
  return <>{w.slice(0, -n).join(" ")} <em>{w.slice(-n).join(" ")}</em></>;
}
/** The size tier of a statement by its length: a one-line claim can be set far larger than a two-sentence one. */
const tier = (s: string) => { const n = Array.from(s).length; return n <= 60 ? "s" : n <= 110 ? "m" : "l"; };
const css = (v: Record<string, string | number>) => v as CSSProperties;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** The "good to know" list as chips. */
function Chips({ items, x, className = "" }: { items: string[]; x: AdvCtx; className?: string }) {
  if (!items.length) return null;
  return <ul className={`abm-chips ${className}`}>{items.slice(0, 6).map((h, i) => <li key={i}><Icon name="check" size={14} />{x.t(h)}</li>)}</ul>;
}

/** The round "since" stamp, or nothing when the owner gave no year. */
function SinceStamp({ c, x, className = "", tone = "accent" }: { c: SiteContent; x: AdvCtx; className?: string; tone?: "accent" | "ink" | "paper" }) {
  const y = sinceOf(c, x);
  if (!y) return null;
  return <Stamp className={className} tone={tone} value={y} sub={x.ui("since", "से")} ring={[c.trade, c.city].filter(Boolean).map((s) => x.t(s)).join(" · ") || x.t(c.name)} hi={x.hi} />;
}

/* ================= story-columns ================= */

export function AboutStoryColumns({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const photo = s.image || storyPics(c, x, 1)[0];
  const long = s.rest.join(" ").length > 520;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Seen className="aba">
        <div className="aba-lead">
          <Eyebrow className="abx-rv">{s.eyebrow}</Eyebrow>
          <h2 className="adv-h2 aba-statement abx-rv" data-t={tier(s.statement)} style={css({ "--i": 1 })}><Emph text={s.statement} /></h2>
          <hr className="adv-rule abx-rv" style={css({ "--i": 2 })} />
          {photo && (
            <figure className="aba-inset abx-rv" style={css({ "--i": 3 })}>
              <Zoom src={photo} list={[photo]} x={x} name={c.name} sizes="(min-width: 900px) 300px, 70vw" />
              <SinceStamp c={c} x={x} className="aba-stamp" tone="paper" />
            </figure>
          )}
        </div>
        <div className={`aba-body adv-body abx-rv ${long ? "aba-cols" : ""}`} style={css({ "--i": 2 })}>
          {s.rest.map((p, i) => <p key={i}>{p}</p>)}
          <Chips items={c.highlights} x={x} className="aba-chips" />
        </div>
      </Seen>
    </Sec>
  );
}

/* ================= overlap-card ================= */

export function AboutOverlapCard({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const pics = storyPics(c, x, 2);
  const photo = s.image || pics[0];
  const second = pics.find((u) => u !== photo);
  const lead = s.statement !== s.title ? s.statement : "";
  const body = lead ? s.rest : s.paras;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Seen className={`abo ${photo ? "" : "abo-bare"}`}>
        {photo && (
          <div className="abo-media abx-rv">
            <div className="abo-photo"><Zoom src={photo} list={[photo]} x={x} name={c.name} sizes="(min-width: 900px) 58vw, 100vw" /></div>
            {second && <div className="abo-mini"><Zoom src={second} list={[second]} x={x} name={c.name} sizes="(min-width: 900px) 20vw, 36vw" /></div>}
            <SinceStamp c={c} x={x} className="abo-stamp" />
          </div>
        )}
        <div className="abo-card abx-rv" style={css({ "--i": 2 })}>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <H2 className="abo-title mt-3">{s.title}</H2>
          {lead && <p className="abo-lead" data-t={tier(lead)}>{lead}</p>}
          <div className="adv-body abo-text">{body.slice(0, 4).map((p, i) => <p key={i}>{p}</p>)}</div>
          <Chips items={c.highlights} x={x} className="abo-chips" />
        </div>
      </Seen>
    </Sec>
  );
}

/* ================= manifesto ================= */

export function AboutManifesto({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const pics = storyPics(c, x, 2);
  const [p1, p2] = pics;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Seen className="abf">
        <div className="abf-top abx-rv">
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <SinceStamp c={c} x={x} className="abf-stamp" tone="ink" />
        </div>
        <p className="abf-statement abx-rv" data-t={tier(s.statement)} style={css({ "--i": 1 })}>{s.statement !== s.title && <span className="abf-qm" aria-hidden="true">&ldquo;</span>}<Emph text={s.statement} n={4} /></p>
        <div className={`abf-grid ${p1 ? "" : "abf-solo"}`}>
          {p1 && <figure className="abf-p1 abx-rv" style={css({ "--i": 1 })}><Parallax className="abm-par" depth={5} range="cover"><Photo src={p1} alt="" sizes="(min-width: 900px) 34vw, 80vw" /></Parallax><button type="button" className="abf-hit" onClick={() => x.zoom(pics, 0, c.name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")} /></figure>}
          <div className="abf-text abx-rv" style={css({ "--i": 2 })}>
            <div className={`adv-body abf-cols ${s.rest.join(" ").length > 480 ? "abf-two" : ""}`}>{s.rest.map((p, i) => <p key={i}>{p}</p>)}</div>
            <Chips items={c.highlights} x={x} />
          </div>
          {p2 && <figure className="abf-p2 abx-rv" style={css({ "--i": 3 })}><Parallax className="abm-par" depth={4} range="cover"><Photo src={p2} alt="" sizes="(min-width: 900px) 24vw, 60vw" /></Parallax><button type="button" className="abf-hit" onClick={() => x.zoom(pics, 1, c.name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")} /></figure>}
        </div>
      </Seen>
    </Sec>
  );
}

/* ================= chapters ================= */

type Chapter = { n: number; lead: string; body: string };
/** The story as 2-5 chapters: one per paragraph when there are three or more, else the sentences cut into even groups. Each chapter
 *  opens with its first sentence in the display face (when it is short enough to read as a line). Nothing is written here. */
function chaptersOf(paras: string[]): Chapter[] {
  let groups: string[][];
  if (paras.length >= 3) groups = paras.slice(0, 5).map((p) => sentencesOf(p));
  else {
    const all = paras.flatMap(sentencesOf);
    const k = all.length >= 8 ? 4 : all.length >= 5 ? 3 : all.length >= 3 ? 2 : 1;
    const per = Math.ceil(all.length / k);
    groups = Array.from({ length: k }, (_, i) => all.slice(i * per, (i + 1) * per)).filter((g) => g.length);
  }
  return groups.map((g, i) => {
    const first = g[0] ?? "";
    const short = Array.from(first).length <= 150;
    return { n: i + 1, lead: short ? first : "", body: (short ? g.slice(1) : g).join(" ") };
  });
}

export function AboutChapters({ c, x, index }: VariantProps) {
  const s = readStory(c, x);
  const ref = useRef<HTMLOListElement>(null);
  const [cur, setCur] = useState(0);
  const chapters = s ? chaptersOf(s.paras) : [];
  const n = chapters.length;
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || n < 2) return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setCur(Number((e.target as HTMLElement).dataset.ch) || 0);
    }, { rootMargin: "-42% 0px -48% 0px" });
    Array.from(el.children).forEach((k) => io.observe(k));
    return () => io.disconnect();
  }, [n]);
  if (!s || !n) return null;
  const pics = storyPics(c, x, n);
  const pic = (i: number) => pics[Math.min(i, pics.length - 1)];
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Seen className={`abch ${pics.length ? "" : "abch-bare"}`}>
        {pics.length > 0 && (
          <div className="abch-stage" aria-hidden="true">
            <div className="abch-frame">
              {pics.map((u, i) => <div key={u} className="abch-img" data-on={i === Math.min(cur, pics.length - 1) ? "" : undefined}><Photo src={u} alt="" sizes="(min-width: 900px) 38vw, 0px" /></div>)}
              <span className="abch-count">{pad2(cur + 1)} <i>/ {pad2(n)}</i></span>
            </div>
            <SinceStamp c={c} x={x} className="abch-stamp" />
          </div>
        )}
        <div className="abch-main">
          <div className="abch-head abx-rv">
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <H2 className="mt-3 abch-title">{s.title}</H2>
          </div>
          <ol ref={ref} className="abch-list">
            {chapters.map((ch, i) => (
              <li key={i} data-ch={i} data-on={i === cur ? "" : undefined} className="abch-item">
                {pics.length > 0 && <div className="abch-pic"><Photo src={pic(i)} alt="" sizes="(max-width: 899px) 92vw, 0px" /></div>}
                <span className="abch-no" aria-hidden="true">{pad2(ch.n)}</span>
                {ch.lead && <p className="abch-lead" data-t={tier(ch.lead)}>{ch.lead}</p>}
                {ch.body && <p className="adv-body abch-body">{ch.body}</p>}
              </li>
            ))}
          </ol>
          <Chips items={c.highlights} x={x} className="abch-chips" />
        </div>
      </Seen>
    </Sec>
  );
}

/* ================= founder-letter ================= */

export function AboutFounderLetter({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const o = ownerOf(c, x);
  const portrait = o.avatar || s.image || storyPics(c, x, 1)[0];
  const contact = x.wa ? x.waHref(x.hi ? `नमस्ते ${o.first}, ` : `Hi ${o.first}, `) : "";
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Seen className={`abl ${portrait ? "" : "abl-bare"}`}>
        {portrait && (
          <figure className="abl-who abx-rv">
            <div className="abl-pic"><Zoom src={portrait} list={[portrait]} x={x} name={o.name} sizes="(min-width: 900px) 30vw, 70vw" /></div>
            <figcaption className="abl-plate"><b>{x.t(o.name)}</b><span>{o.role}</span></figcaption>
            <SinceStamp c={c} x={x} className="abl-stamp" tone="paper" />
          </figure>
        )}
        <article className="abl-letter abx-rv" style={css({ "--i": 2 })}>
          <Eyebrow>{o.isPerson ? x.ui(`A note from ${o.first}`, `${o.first} की ओर से`) : x.ui("A note from us", "हमारी ओर से")}</Eyebrow>
          <p className="abl-lead" data-t={tier(s.statement)}><Emph text={s.statement} n={3} /></p>
          <div className="adv-body abl-text">{s.rest.slice(0, 4).map((p, i) => <p key={i}>{p}</p>)}</div>
          <p className="abl-sign" aria-label={x.ui(`Signed, ${o.name}`, `${o.name}`)}><span aria-hidden="true">&mdash; {o.isPerson ? o.first : x.t(c.name)}</span></p>
          <div className="abl-foot">
            {contact && <Btn href={contact} external onClick={() => x.track("about-owner")}><Icon name="whatsapp" /> {o.isPerson ? x.ui(`Message ${o.first}`, `${o.first} को मैसेज करें`) : x.ui("Message us", "हमें मैसेज करें")}</Btn>}
            <Chips items={c.highlights.slice(0, 3)} x={x} />
          </div>
        </article>
      </Seen>
    </Sec>
  );
}

/* ================= banner-columns ================= */

export function AboutBannerColumns({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const photo = s.image || storyPics(c, x, 1)[0];
  const list = c.highlights.slice(0, 5);
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Seen className={`abb ${photo ? "" : "abb-bare"}`}>
        {photo && (
          <div className="abb-banner abx-rv">
            <Parallax className="abm-par" depth={6} range="cover"><Photo src={photo} alt="" sizes="100vw" /></Parallax>
            <button type="button" className="abb-hit" onClick={() => x.zoom([photo], 0, c.name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")} />
            <SinceStamp c={c} x={x} className="abb-stamp" tone="paper" />
          </div>
        )}
        <div className="abb-panel abx-rv" style={css({ "--i": 2 })}>
          <div className="abb-title">
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <h2 className="adv-h2 mt-3 abb-h" data-t={tier(s.statement)}><Emph text={s.statement} /></h2>
          </div>
          <div className="adv-body abb-text">{s.rest.map((p, i) => <p key={i}>{p}</p>)}</div>
          {list.length > 0 && (
            <ol className="abb-list" aria-label={x.ui("Good to know", "जानने लायक बातें")}>
              {list.map((h, i) => <li key={i}><span aria-hidden="true">{pad2(i + 1)}</span>{x.t(h)}</li>)}
            </ol>
          )}
        </div>
      </Seen>
    </Sec>
  );
}

/* ================= CSS ================= */

export const ABOUTS_CSS = `
/* ---- shared ---- */
.abm-zoom{position:absolute;inset:0;display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in;overflow:hidden;border-radius:inherit}
.abm-zoom .adv-photo{transition:transform 1.1s cubic-bezier(.2,.7,.2,1)}.abm-zoom:hover .adv-photo{transform:scale(1.04)}
.abm-par{position:absolute;inset:0}
.abm-chips{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0;padding:0;list-style:none}
.abm-chips li{display:inline-flex;align-items:center;gap:.5em;padding:.5em .95em;border-radius:var(--r-pill);background:var(--accent-soft);color:var(--ink);font-size:var(--t-meta);font-weight:500;line-height:1.3}
.abm-chips svg{flex:none;color:var(--accent)}
.adv-sec[data-tone=ink] .abm-chips li{background:color-mix(in srgb,var(--hero-text) 12%,transparent);color:var(--hero-text)}
.aba-statement em,.abf-statement em,.abl-lead em,.abb-h em{font-style:italic;color:var(--accent)}
.site:lang(hi) .aba-statement em,.site:lang(hi) .abf-statement em,.site:lang(hi) .abl-lead em,.site:lang(hi) .abb-h em{font-style:normal}
/* entrances: only once the section is on screen, and only for a visitor who has not asked for stillness */
@media (prefers-reduced-motion:no-preference){
[data-arm]:not([data-seen]) .abx-rv{opacity:0;transform:translateY(28px)}
.site[data-adv]:not([data-motion=none]) [data-arm] .abx-rv{transition:opacity .9s cubic-bezier(.2,.7,.2,1) calc(var(--i,0)*110ms),transform .9s cubic-bezier(.2,.7,.2,1) calc(var(--i,0)*110ms)}
}

/* ---- story-columns ---- */
.aba{display:grid;gap:clamp(2rem,5vw,4rem)}
.aba-lead{display:flex;flex-direction:column;gap:var(--s5);align-items:flex-start}
.aba-statement{font-size:clamp(2rem,6vw,4.4rem);line-height:1.02;max-width:17ch;letter-spacing:var(--display-tr)}
.aba-statement[data-t=m]{font-size:clamp(1.8rem,4.6vw,3.3rem);max-width:21ch}.aba-statement[data-t=l]{font-size:clamp(1.6rem,3.8vw,2.7rem);max-width:24ch;line-height:1.1}
.site:lang(hi) .aba-statement{line-height:1.32;max-width:none}
.aba-inset{position:relative;margin:var(--s3) 0 0;width:min(100%,320px);aspect-ratio:4/5;border-radius:999px 999px var(--r-tile) var(--r-tile);background:var(--paper-2)}
.site[data-shape=sharp] .aba-inset{border-radius:var(--r-tile) var(--r-tile) 0 0}
.aba-stamp{position:absolute;right:var(--s3);bottom:var(--s3);--st:96px}
.aba-body{padding-top:var(--s2)}
.aba-cols{column-gap:clamp(1.5rem,3vw,3rem)}
.aba-body p{orphans:3;widows:3}
.aba-chips{margin-top:var(--s5);column-span:all}
.site:lang(en) .aba-body>p:first-child::first-letter{float:left;font-family:var(--font-display);font-size:4.4em;line-height:.78;padding:.07em .12em 0 0;color:var(--accent)}
@media (min-width:900px){.aba{grid-template-columns:minmax(0,6fr) minmax(0,5fr);align-items:start}.aba-cols{column-count:1}.aba-body{padding-top:clamp(1rem,4vw,3rem)}.aba-stamp{right:-26%;bottom:-6%;--st:104px}}
@media (min-width:1180px){.aba-cols{column-count:2}.aba{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}}

/* ---- overlap-card ---- */
.abo{display:grid;position:relative}
.abo-media{position:relative}
.abo-photo{position:relative;aspect-ratio:4/3;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.abo-mini{position:absolute;left:-2px;bottom:calc(-1 * var(--s5));width:30%;max-width:170px;aspect-ratio:1;border-radius:var(--r-tile);overflow:hidden;border:5px solid var(--paper);background:var(--paper-2);z-index:2;display:none}
.abo-stamp{position:absolute;top:var(--s4);right:var(--s4);--st:92px;z-index:2}
.abo-card{position:relative;margin:calc(-1 * clamp(2.5rem,10vw,4.5rem)) var(--s4) 0;padding:clamp(1.5rem,4vw,3rem);border-radius:var(--r-tile);background:var(--paper);border:1px solid var(--line);box-shadow:var(--e-1);z-index:1}
.abo-title{font-size:clamp(1.9rem,4.4vw,3.2rem)}
.abo-lead{margin:var(--s4) 0 0;font-family:var(--font-display);font-size:clamp(1.25rem,2.4vw,1.75rem);line-height:1.25;letter-spacing:var(--display-tr);color:var(--ink);text-wrap:balance}
.abo-lead[data-t=l]{font-size:clamp(1.1rem,2vw,1.4rem);line-height:1.35}
.site:lang(hi) .abo-lead{line-height:1.5;letter-spacing:0;font-weight:var(--display-w-hi)}
.abo-text{margin-top:var(--s4)}
.abo-chips{margin-top:var(--s5);padding-top:var(--s5);border-top:1px solid var(--line)}
.abo-bare .abo-card{margin:0;max-width:46rem;border-left:3px solid var(--accent);box-shadow:none}
@media (min-width:900px){
.abo{grid-template-columns:repeat(12,minmax(0,1fr));align-items:center}
.abo-media{grid-column:1 / span 8;grid-row:1;height:100%}
.abo-photo{aspect-ratio:auto;min-height:600px;height:100%}
.abo-mini{display:block;left:var(--s5);bottom:var(--s5);width:24%}
.abo-card{grid-column:7 / span 6;grid-row:1;margin:0;max-height:none}
.abo-bare .abo-card{grid-column:2 / span 9}
}

/* ---- manifesto ---- */
.abf{display:grid;gap:clamp(1.5rem,4vw,3rem)}
.abf-top{display:flex;align-items:center;justify-content:space-between;gap:var(--s5)}
.abf-stamp{--st:96px}
.abf-statement{position:relative;margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.3rem,8.6vw,7rem);line-height:.98;letter-spacing:var(--display-tr);text-wrap:balance;color:var(--ink)}
.abf-statement[data-t=m]{font-size:clamp(2rem,6.4vw,5rem);line-height:1.02}.abf-statement[data-t=l]{font-size:clamp(1.7rem,4.8vw,3.6rem);line-height:1.08}
.site:lang(hi) .abf-statement{line-height:1.3;letter-spacing:0;font-weight:var(--display-w-hi)}
.abf-qm{display:block;height:.46em;font-size:1.3em;line-height:1;color:var(--accent);opacity:.9}
.abf-grid{display:grid;gap:var(--s6);align-items:start}
.abf-p1,.abf-p2{position:relative;margin:0;overflow:hidden;border-radius:var(--r-tile);background:var(--paper-2)}
.abf-p1{aspect-ratio:4/5}.abf-p2{aspect-ratio:1;width:62%;margin-left:auto}
.abf-hit,.abb-hit{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in}
.abf-text{display:grid;gap:var(--s5);align-content:start}
.abf-two{column-gap:clamp(1.5rem,3vw,3rem)}.abf-cols p{orphans:3;widows:3}
.site:lang(en) .abf-cols>p:first-child::first-letter{float:left;font-family:var(--font-display);font-size:4em;line-height:.8;padding:.07em .1em 0 0;color:var(--accent)}
@media (min-width:900px){
.abf-grid{grid-template-columns:minmax(0,4fr) minmax(0,5fr) minmax(0,3fr);gap:clamp(1.5rem,3vw,3rem)}
.abf-solo{grid-template-columns:minmax(0,1fr)}.abf-solo .abf-text{max-width:60rem}
.abf-p1{aspect-ratio:3/4}.abf-p2{width:100%;aspect-ratio:3/4;margin-top:clamp(3rem,9vw,8rem)}
.abf-text{padding-top:clamp(1rem,3vw,2.5rem)}
.abf-two{column-count:1}
}
@media (min-width:1200px){.abf-grid{grid-template-columns:minmax(0,4fr) minmax(0,6fr) minmax(0,3fr)}}

/* ---- chapters ---- */
.abch{display:grid;gap:var(--s6)}
.abch-stage{display:none;position:relative}
.abch-frame{position:relative;aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.abch-img{position:absolute;inset:0;opacity:0;transform:scale(1.06);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform 1.4s cubic-bezier(.2,.7,.2,1)}
.abch-img[data-on]{opacity:1;transform:none}
.abch-count{position:absolute;left:var(--s4);bottom:var(--s4);padding:.35em .8em;border-radius:var(--r-pill);background:color-mix(in srgb,var(--hero-ink) 58%,transparent);color:var(--hero-text);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums lining-nums;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.abch-count i{font-style:normal;opacity:.7;font-weight:500}
.abch-stamp{position:absolute;right:var(--s3);top:var(--s3);--st:92px}
.abch-title{font-size:clamp(2rem,4.8vw,3.6rem)}
.abch-list{list-style:none;margin:clamp(1.5rem,4vw,2.5rem) 0 0;padding:0;display:grid;gap:clamp(2.25rem,6vw,3.5rem)}
.abch-item{position:relative;display:grid;gap:var(--s3);padding-top:var(--s4);border-top:1px solid var(--line);transition:opacity .5s}
.abch-pic{aspect-ratio:16/10;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2);margin-bottom:var(--s3)}
.abch-no{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.6rem,7vw,4.4rem);line-height:.9;color:var(--accent);font-variant-numeric:lining-nums;letter-spacing:var(--display-tr)}
.abch-lead{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.4rem,3vw,2.15rem);line-height:1.14;letter-spacing:var(--display-tr);text-wrap:balance}
.abch-lead[data-t=l]{font-size:clamp(1.2rem,2.3vw,1.6rem);line-height:1.25}
.site:lang(hi) .abch-lead{line-height:1.4;letter-spacing:0;font-weight:var(--display-w-hi)}
.abch-body{margin:0;max-width:56ch}
.abch-chips{margin-top:clamp(2rem,5vw,3rem)}
@media (min-width:900px){
.abch:not(.abch-bare){grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:clamp(2.5rem,6vw,6rem);align-items:start}
.abch-stage{display:block;position:sticky;top:clamp(72px,12vh,120px)}
.abch-stamp{right:-12%;top:8%;--st:100px}
.abch-pic{display:none}
.abch-item{min-height:clamp(12rem,28vh,20rem);align-content:start;opacity:.55}
.abch-item[data-on]{opacity:1}
.abch-bare .abch-item{opacity:1;min-height:0}.abch-bare .abch-main{max-width:56rem}
}
@media (prefers-reduced-motion:reduce){.abch-item{opacity:1!important}}
.site[data-motion=none] .abch-item{opacity:1!important}

/* ---- founder-letter ---- */
.abl{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.abl-who{position:relative;margin:0;display:grid;gap:var(--s4);max-width:360px}
.abl-pic{position:relative;aspect-ratio:4/5;border-radius:999px 999px var(--r-tile) var(--r-tile);overflow:hidden;background:var(--paper-2)}
.site[data-shape=sharp] .abl-pic{border-radius:var(--r-tile) var(--r-tile) 0 0}
.abl-plate{display:grid;gap:2px;padding-left:var(--s4);border-left:2px solid var(--accent)}
.abl-plate b{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.4rem;line-height:1.15;letter-spacing:var(--display-tr)}
.abl-plate span{font-size:var(--t-meta);color:var(--muted)}
.abl-stamp{position:absolute;right:var(--s3);top:var(--s3);--st:88px}
.abl-letter{position:relative;padding:clamp(1.5rem,4.5vw,3.5rem);border-radius:var(--r-tile);background:var(--paper-2);border:1px solid var(--line)}
.adv-sec[data-tone=alt] .abl-letter{background:var(--paper)}
.abl-letter::before{content:"\\201C";position:absolute;top:-.12em;right:.18em;font-family:var(--font-display);font-size:clamp(7rem,16vw,12rem);line-height:1;color:var(--accent);opacity:.16;pointer-events:none}
.abl-lead{margin:var(--s4) 0 0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.7rem,4vw,3rem);line-height:1.08;letter-spacing:var(--display-tr);text-wrap:balance}
.abl-lead[data-t=m]{font-size:clamp(1.5rem,3.2vw,2.3rem)}.abl-lead[data-t=l]{font-size:clamp(1.3rem,2.6vw,1.8rem);line-height:1.2}
.site:lang(hi) .abl-lead{line-height:1.35;letter-spacing:0;font-weight:var(--display-w-hi)}
.abl-text{margin-top:var(--s5);max-width:60ch}
.abl-sign{margin:var(--s5) 0 0;font-family:var(--font-display);font-style:italic;font-size:clamp(1.6rem,3vw,2.2rem);line-height:1.1;color:var(--accent)}
.site:lang(hi) .abl-sign{font-style:normal}
.abl-foot{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s4);margin-top:var(--s5);padding-top:var(--s5);border-top:1px solid var(--line)}
.abl-bare .abl-letter{max-width:52rem}
@media (min-width:900px){
.abl:not(.abl-bare){grid-template-columns:minmax(0,4fr) minmax(0,7fr);align-items:center}
.abl-who{max-width:none}
.abl-stamp{right:-16%;top:6%;--st:96px}
.abl-letter{margin-left:calc(-1 * clamp(2rem,5vw,4.5rem));padding-left:clamp(3rem,7vw,6rem)}
.abl-bare .abl-letter{margin-left:0}
}

/* ---- banner-columns ---- */
.abb{position:relative}
.abb-banner{position:relative;aspect-ratio:16/10;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.abb-stamp{position:absolute;left:var(--s5);bottom:calc(var(--s5) + 2.5rem);--st:96px;z-index:2}
.abb-panel{position:relative;margin:calc(-1 * clamp(2.5rem,9vw,5rem)) var(--s3) 0;padding:clamp(1.5rem,4.5vw,3.5rem);border-radius:var(--r-tile);background:var(--paper);border:1px solid var(--line);box-shadow:var(--e-1);display:grid;gap:var(--s6)}
.abb-h{font-size:clamp(1.8rem,4.4vw,3.2rem);line-height:1.06;text-wrap:balance}
.abb-h[data-t=m]{font-size:clamp(1.6rem,3.6vw,2.5rem)}.abb-h[data-t=l]{font-size:clamp(1.4rem,3vw,2rem);line-height:1.15}
.site:lang(hi) .abb-h{line-height:1.35}
.abb-text p:last-child{margin-bottom:0}
.abb-list{list-style:none;margin:0;padding:0;display:grid;gap:0;align-content:start}
.abb-list li{display:grid;grid-template-columns:2.4rem 1fr;gap:var(--s3);align-items:baseline;padding:var(--s3) 0;border-bottom:1px solid var(--line);font-size:var(--t-body);line-height:1.4}
.abb-list li:first-child{border-top:1px solid var(--line)}
.abb-list span{font-family:var(--font-display);font-size:1.15rem;color:var(--accent);font-variant-numeric:lining-nums}
.abb-bare .abb-panel{margin:0}
@media (min-width:900px){
.abb-banner{aspect-ratio:21/9}
.abb-panel{margin:calc(-1 * clamp(4rem,9vw,8rem)) clamp(1.5rem,5vw,4.5rem) 0;grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,3fr);gap:clamp(1.5rem,3.5vw,3.5rem);align-items:start}
.abb-bare .abb-panel{margin:0}
.abb-stamp{bottom:auto;top:var(--s5);left:auto;right:var(--s5)}
}
@media (min-width:900px) and (max-width:1179px){.abb-panel{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.abb-list{grid-column:1 / -1}}
`;
