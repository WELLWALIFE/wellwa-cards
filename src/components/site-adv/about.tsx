"use client";
// Advanced-site ABOUT and PROCESS variants, second set (owner, 16 Oct 2026: every business's layout must differ, so a
// section has several real compositions, not one with new colours).
//
// ABOUT (the owner's story, founder note)
//   editorial-split   a sticky title and the "good to know" list on the left; a large opening line, a wide photo, the story on the right
//   pull-quote        the opening sentence as a big centred pull-quote with a signature, the rest of the story in columns below
//   year-timeline     the years the owner mentions as a rail (else the story's paragraphs as chapters), a tall photo beside it
//   owner-card        "meet the owner": a portrait with a name plate, the opening line, the story, one message button
//   numbers-led       the card's own numbers set huge across the top, the statement and the story under them
//   photo-collage     two or three of the business's own photos overlapping, the story beside them
// PROCESS (how it works; the owner's numbered services block)
//   numbered-list     big numerals and ruled rows, the title sticky beside them
//   timeline-h        a rail with numbered nodes, across on a wide screen and down on a phone
//   icon-cards        one card per step, an icon picked from what the step says
//   step-accordion    steps that open one at a time, keyboard navigable
//
// Every variant draws nothing when its slice of the content is empty, and leaves out any part (photo, list, button) it has no
// material for rather than showing a placeholder. Colours, corners, spacing and faces come only from the spec's tokens.
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon, iconFor, type IconName } from "@/components/site-icons";
import { linkHref } from "@/components/link-icon";
import { Btn, Eyebrow, H2, Head, Photo, Sec, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";

/* ================= shared helpers ================= */

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

/** The first sentence of the story (<= 170 chars) and everything after it. A story with no usable first sentence leads with its title. */
function splitLead(paras: string[], title: string): { statement: string; rest: string[] } {
  if (!paras.length) return { statement: title, rest: [] };
  const first = sentencesOf(paras[0]);
  if (first.length && first[0].length >= 20 && first[0].length <= 170) {
    const tail = first.slice(1).join(" ");
    return { statement: first[0], rest: [...(tail ? [tail] : []), ...paras.slice(1)] };
  }
  return paras[0].length <= 170 ? { statement: paras[0], rest: paras.slice(1) } : { statement: title, rest: paras };
}

type Story = { title: string; eyebrow: string; paras: string[]; statement: string; rest: string[]; image?: string };
/** The About block in the visitor's language: null when the page has no story. */
function readStory(c: SiteContent, x: AdvCtx): Story | null {
  const a = c.about; if (!a) return null;
  const title = x.t(a.title);
  const paras = a.paras.map((p) => x.t(p)).filter(Boolean);
  const { statement, rest } = splitLead(paras, title);
  // A story with no words leads with the block's title; the eyebrow must not say the same thing twice.
  return { title, eyebrow: statement === title ? x.ui("Our story", "हमारी कहानी") : title, paras, statement, rest, image: a.image };
}

/** Pictures for a variant that wants several: the About photo, then the page's others, the hero's own picture last. */
function storyPhotos(c: SiteContent, x: AdvCtx, max: number): string[] {
  const cover = x.card.coverUrl;
  const list = [c.about?.image, ...c.photos.filter((u) => u !== cover), cover].filter((u): u is string => !!u);
  return list.filter((u, i) => list.indexOf(u) === i).slice(0, max);
}

/** A photo that opens the lightbox: a real button, so the keyboard reaches it. `list`/`at` are the lightbox's pictures and place. */
function Zoomable({ src, list, at = 0, x, name, sizes, className = "" }: { src: string; list: string[]; at?: number; x: AdvCtx; name: string; sizes?: string; className?: string }) {
  return (
    <button type="button" className={`abx-zoom ${className}`} onClick={() => x.zoom(list, at, name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")}>
      <Photo src={src} alt="" sizes={sizes} />
    </button>
  );
}

/** The person behind the business, from the card: a name only when the card names someone other than the business. */
function ownerOf(c: SiteContent, x: AdvCtx) {
  const { card } = x;
  const person = (card.name ?? "").trim();
  const isPerson = !!person && person.toLowerCase() !== c.name.trim().toLowerCase() && person.toLowerCase() !== (card.company ?? "").trim().toLowerCase();
  const name = isPerson ? person : c.name;
  const role = isPerson ? x.t((card.jobTitle ?? "").trim()) || c.name : c.trade;
  const first = Array.from(name.split(/\s+/).filter((w) => !/^(dr|mr|mrs|ms|shri|smt)\.?$/i.test(w))[0] ?? name).join("");
  const avatar = card.avatarUrl && card.avatarShape !== "square" ? card.avatarUrl : undefined;
  return { isPerson, name, role, first, avatar };
}

/** Highlights as a ticked list (the owner's "good to know" line). */
function Ticks({ items, x, className = "" }: { items: string[]; x: AdvCtx; className?: string }) {
  if (!items.length) return null;
  return <ul className={`abx-ticks ${className}`} role="list">{items.slice(0, 6).map((h, i) => <li key={i}><Icon name="check" size={16} />{x.t(h)}</li>)}</ul>;
}

/* ================= about: editorial-split ================= */

export function AboutEditorialSplit({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const photo = s.image || storyPhotos(c, x, 1)[0];
  const long = s.rest.join(" ").length > 560;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="abe">
        <div className="abe-side">
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <hr className="adv-rule" />
          <H2 className="abe-title">{s.title}</H2>
          <Ticks items={c.highlights} x={x} className="abe-ticks" />
        </div>
        <div className="abe-main">
          {s.statement !== s.title && <p className="abe-lede">{s.statement}</p>}
          {photo && <figure className="abe-fig"><Zoomable src={photo} list={[photo]} x={x} name={c.name} sizes="(min-width: 960px) 62vw, 100vw" /></figure>}
          {s.rest.length > 0 && <div className={`adv-body abe-text ${long ? "abe-cols" : ""}`}>{s.rest.map((p, i) => <p key={i}>{p}</p>)}</div>}
        </div>
      </div>
    </Sec>
  );
}

/* ================= about: pull-quote ================= */

export function AboutPullQuote({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const o = ownerOf(c, x);
  const long = s.rest.join(" ").length > 520;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"}>
      <figure className="abq">
        <span className="abq-mark" aria-hidden="true">&ldquo;</span>
        <Eyebrow className="abq-eyebrow">{s.eyebrow}</Eyebrow>
        <blockquote className="abq-quote"><p>{s.statement}</p></blockquote>
        <figcaption className="abq-sign">
          {o.avatar && <span className="abq-avatar"><Photo src={o.avatar} alt="" sizes="48px" /></span>}
          <span><b>{o.name}</b>{o.role && o.role !== o.name && <small>{o.role}</small>}</span>
        </figcaption>
      </figure>
      {(s.rest.length > 0 || c.highlights.length > 0) && (
        <div className="abq-after">
          {s.rest.length > 0 && <div className={`adv-body abq-text ${long ? "abq-cols" : ""}`}>{s.rest.map((p, i) => <p key={i}>{p}</p>)}</div>}
          {c.highlights.length > 0 && <ul className="abq-chips" role="list">{c.highlights.slice(0, 6).map((h, i) => <li key={i} className="adv-chip">{x.t(h)}</li>)}</ul>}
        </div>
      )}
    </Sec>
  );
}

/* ================= about: year-timeline ================= */

const YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/;
type Beat = { label: string; text: string };

/** The story as beats. Sentences that name a year become dated beats (two or more years make a timeline); the undated ones are the
 *  intro. A story with fewer than two years falls back to chapters: its paragraphs (or, for a short one, its sentences in pairs). */
function beatsOf(paras: string[]): { dated: boolean; intro: string; beats: Beat[] } {
  const now = new Date().getFullYear();
  const sents = paras.flatMap(sentencesOf);
  const byYear = new Map<number, string[]>();
  const plain: string[] = [];
  for (const s of sents) {
    const m = YEAR.exec(s);
    if (m && Number(m[1]) <= now) byYear.set(Number(m[1]), [...(byYear.get(Number(m[1])) ?? []), s]);
    else plain.push(s);
  }
  if (byYear.size >= 2) {
    const beats = [...byYear.entries()].sort((a, b) => a[0] - b[0]).slice(0, 7).map(([y, t]) => ({ label: String(y), text: t.join(" ") }));
    return { dated: true, intro: plain.slice(0, 5).join(" "), beats };
  }
  const chunks = paras.length >= 3 ? paras.slice() : Array.from({ length: Math.ceil(sents.length / 2) }, (_, i) => sents.slice(i * 2, i * 2 + 2).join(" "));
  const kept = chunks.length > 6 ? [...chunks.slice(0, 5), chunks.slice(5).join(" ")] : chunks;
  return { dated: false, intro: "", beats: kept.filter(Boolean).map((text, i) => ({ label: String(i + 1).padStart(2, "0"), text })) };
}

export function AboutYearTimeline({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const { dated, intro, beats } = beatsOf(s.paras);
  const photo = s.image || storyPhotos(c, x, 1)[0];
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <div className={`aby-grid ${photo ? "aby-photo" : ""}`}>
        <div className="aby-main">
          <Head eyebrow={s.eyebrow} title={s.statement} className="aby-head" />
          {intro && <p className="adv-body aby-intro">{intro}</p>}
          {beats.length >= 2 ? (
            <ol className={`aby ${dated ? "aby-dated" : "aby-chapters"}`} role="list">
              {beats.map((b, i) => (
                <li key={i}>
                  <span className="aby-dot" aria-hidden="true" />
                  <span className="aby-label">{b.label}</span>
                  <p className="aby-text">{b.text}</p>
                </li>
              ))}
            </ol>
          ) : beats[0] && <p className="adv-body aby-intro">{beats[0].text}</p>}
          <Ticks items={c.highlights} x={x} className="aby-ticks" />
        </div>
        {photo && <figure className="aby-fig"><Zoomable src={photo} list={[photo]} x={x} name={c.name} sizes="(min-width: 1000px) 34vw, 100vw" /></figure>}
      </div>
    </Sec>
  );
}

/* ================= about: owner-card ================= */

export function AboutOwnerCard({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const o = ownerOf(c, x);
  const portrait = o.avatar || s.image || storyPhotos(c, x, 1)[0];
  const msg = o.isPerson ? x.ui(`Message ${o.first}`, `${o.first} को मैसेज करें`) : x.ui("Message us", "हमें मैसेज करें");
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="abw">
        <div className="abw-who">
          <div className="abw-frame">
            {portrait ? <Zoomable src={portrait} list={[portrait]} x={x} name={o.name} sizes="(min-width: 900px) 40vw, 100vw" /> : <Photo fallback={o.name} />}
          </div>
          <div className="abw-plate">
            <b>{o.name}</b>
            {o.role && o.role !== o.name && <span>{o.role}</span>}
            {c.city && <span className="abw-city"><Icon name="pin" size={13} />{c.city}</span>}
          </div>
        </div>
        <div className="abw-note">
          <Eyebrow>{o.isPerson ? x.ui("Meet the owner", "मालिक से मिलिए") : s.eyebrow}</Eyebrow>
          <H2 className="abw-statement mt-3">{s.statement}</H2>
          {s.rest.length > 0 && <div className="adv-body abw-text">{s.rest.map((p, i) => <p key={i}>{p}</p>)}</div>}
          <Ticks items={c.highlights} x={x} className="abw-ticks" />
          {(x.wa || x.phone) && (
            <div className="adv-btn-row abw-btns">
              {x.wa && <Btn href={x.waHref()} external data-kind="whatsapp" onClick={() => x.track("about-whatsapp")}><Icon name="whatsapp" /> {msg}</Btn>}
              {x.phone && <Btn kind={x.wa ? "link" : "primary"} href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("about-call")}>{!x.wa && <Icon name="phone" />}{x.ui("Call", "कॉल करें")}{x.wa && <Icon name="arrow-right" />}</Btn>}
            </div>
          )}
        </div>
      </div>
    </Sec>
  );
}

/* ================= about: numbers-led ================= */

export function AboutNumbersLed({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const facts = c.facts.slice(0, 4);
  const long = s.rest.join(" ").length > 480;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <Eyebrow>{s.eyebrow}</Eyebrow>
      {facts.length >= 2 && (
        <dl className="abn-facts" style={{ "--n": facts.length } as CSSProperties}>
          {facts.map((f, i) => <div key={i} className="abn-fact"><dd className="abn-val">{x.t(f.value)}</dd><dt className="abn-lab">{x.t(f.label)}</dt></div>)}
        </dl>
      )}
      <div className={`abn ${s.rest.length || c.highlights.length ? "" : "abn-solo"}`}>
        <H2 className="abn-statement">{s.statement}</H2>
        {(s.rest.length > 0 || c.highlights.length > 0) && (
          <div className="abn-body">
            {s.rest.length > 0 && <div className={`adv-body ${long ? "abn-cols" : ""}`}>{s.rest.map((p, i) => <p key={i}>{p}</p>)}</div>}
            <Ticks items={c.highlights} x={x} className="abn-ticks" />
          </div>
        )}
      </div>
    </Sec>
  );
}

/* ================= about: photo-collage ================= */

export function AboutPhotoCollage({ c, x, index }: VariantProps) {
  const s = readStory(c, x); if (!s) return null;
  const pics = storyPhotos(c, x, 3);
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <div className={`abc ${pics.length ? "" : "abc-bare"}`}>
        {pics.length > 0 && (
          <div className="abc-art" data-n={pics.length}>
            {pics.map((u, i) => <div key={u} className={`abc-tile abc-${"abc"[i]}`}><Zoomable src={u} list={pics} at={i} x={x} name={c.name} sizes="(min-width: 900px) 34vw, 70vw" /></div>)}
          </div>
        )}
        <div className="abc-copy">
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <H2 className="mt-3 abc-title">{s.statement}</H2>
          {s.rest.length > 0 && <div className="adv-body abc-text">{s.rest.slice(0, 4).map((p, i) => <p key={i}>{p}</p>)}</div>}
          <Ticks items={c.highlights} x={x} className="abc-ticks" />
        </div>
      </div>
    </Sec>
  );
}

/* ================= process helpers ================= */

type Step = { name: string; desc: string };
/** The owner's steps in the visitor's language. */
function readSteps(c: SiteContent, x: AdvCtx): Step[] {
  return c.steps.slice(0, 6).map((s) => ({ name: x.t(s.name), desc: s.desc ? x.t(s.desc) : "" })).filter((s) => s.name);
}
const num = (i: number) => String(i + 1).padStart(2, "0");

/** The icon a step's words suggest, from what the owner wrote (so Hindi steps work too); null when none fits, and the card shows the number. */
function stepIcon(s: { name: string; desc: string }): IconName | null {
  const t = `${s.name} ${s.desc}`.toLowerCase();
  if (/\b(call|whatsapp|message|enquir|inquir|contact|talk|chat|requirement)|कॉल|बात|मैसेज|संपर्क|जरूरत|ज़रूरत/.test(t)) return "whatsapp";
  const i = iconFor(t);
  if (i && i !== "clock" && i !== "star") return i;
  if (/\b(visit|store|shop|site|measure|survey|location|address)|विज़िट|दुकान|नाप|पता/.test(t)) return "pin";
  if (/\b(confirm|approve|finali[sz]e|ready|complete|done|handover|hand over|enjoy|result)|पक्का|तैयार|पूरा|हो गया/.test(t)) return "check";
  return null;
}

/** The two words of the process head, per variant. */
const PROCESS_HEAD = {
  list: ["How we work", "हम कैसे काम करते हैं"],
  rail: ["Step by step", "कदम दर कदम"],
  cards: ["What happens next", "आगे क्या होता है"],
} as const;

/* ================= process: numbered-list ================= */

export function ProcessNumberedList({ c, x, index }: VariantProps) {
  const steps = readSteps(c, x); if (!steps.length) return null;
  return (
    <Sec k="process" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="pcl">
        <div className="pcl-side">
          <Head eyebrow={x.ui("How it works", "कैसे काम करते हैं")} title={x.ui(...PROCESS_HEAD.list)} />
          {x.wa && <Btn href={x.waHref()} external data-kind="whatsapp" onClick={() => x.track("process-whatsapp")}><Icon name="whatsapp" /> {x.ui("Start on WhatsApp", "WhatsApp पर शुरू करें")}</Btn>}
        </div>
        <ol className="pcl-list" role="list">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="pcl-no" aria-hidden="true">{num(i)}</span>
              <div><h3>{s.name}</h3>{s.desc && <p>{s.desc}</p>}</div>
            </li>
          ))}
        </ol>
      </div>
    </Sec>
  );
}

/* ================= process: timeline-h ================= */

export function ProcessTimelineH({ c, x, index }: VariantProps) {
  const steps = readSteps(c, x); if (!steps.length) return null;
  return (
    <Sec k="process" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("How it works", "कैसे काम करते हैं")} title={x.ui(...PROCESS_HEAD.rail)} />
      <ol className="pch" role="list" data-n={steps.length} style={{ "--n": steps.length } as CSSProperties}>
        {steps.map((s, i) => (
          <li key={i}>
            <span className="pch-node" aria-hidden="true">{num(i)}</span>
            <h3>{s.name}</h3>
            {s.desc && <p>{s.desc}</p>}
          </li>
        ))}
      </ol>
    </Sec>
  );
}

/* ================= process: icon-cards ================= */

export function ProcessIconCards({ c, x, index }: VariantProps) {
  const steps = readSteps(c, x); if (!steps.length) return null;
  return (
    <Sec k="process" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("How it works", "कैसे काम करते हैं")} title={x.ui(...PROCESS_HEAD.cards)} />
      <ol className="pci" role="list">
        {steps.map((s, i) => {
          const ic = stepIcon(s);
          return (
            <li key={i} className="adv-card pci-card adv-lift">
              <span className="pci-badge" aria-hidden="true">{ic ? <Icon name={ic} size={22} /> : num(i)}</span>
              <span className="pci-no" aria-hidden="true">{num(i)}</span>
              <h3>{s.name}</h3>
              {s.desc && <p>{s.desc}</p>}
            </li>
          );
        })}
      </ol>
    </Sec>
  );
}

/* ================= process: step-accordion ================= */

/** The list is its own component so its state and refs sit above no early return. */
function StepAccordion({ steps }: { steps: Step[] }) {
  const id = useId();
  const [open, setOpen] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  // Arrow keys, Home and End move between the headers (the accordion pattern); Tab still walks them all.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const btns = Array.from(box.current?.querySelectorAll<HTMLButtonElement>("button[data-pca]") ?? []);
    const at = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0 || !btns.length) return;
    e.preventDefault();
    const to = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (at + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length;
    btns[to].focus();
  };
  return (
    <div className="pca-list" ref={box} onKeyDown={onKey}>
      {steps.map((s, i) => {
        const isOpen = open === i;
        if (!s.desc) return <div key={i} className="pca-item"><h3 className="pca-static"><span className="pca-no" aria-hidden="true">{num(i)}</span><span className="pca-name">{s.name}</span></h3></div>;
        return (
          <div key={i} className="pca-item" data-open={isOpen ? "" : undefined}>
            <h3>
              <button type="button" data-pca="" id={`${id}-b${i}`} aria-expanded={isOpen} aria-controls={`${id}-p${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                <span className="pca-no" aria-hidden="true">{num(i)}</span>
                <span className="pca-name">{s.name}</span>
                <Icon name="chevron-down" size={20} className="pca-chev" />
              </button>
            </h3>
            <div id={`${id}-p${i}`} role="region" aria-labelledby={`${id}-b${i}`} className="pca-panel">
              <div className="pca-inner"><p>{s.desc}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProcessStepAccordion({ c, x, index }: VariantProps) {
  const steps = readSteps(c, x); if (!steps.length) return null;
  return (
    <Sec k="process" tone={index % 2 ? "alt" : "paper"}>
      <div className="pca">
        <div className="pca-side">
          <Head eyebrow={x.ui("How it works", "कैसे काम करते हैं")} title={x.ui(...PROCESS_HEAD.list)} />
          {x.wa && <Btn kind="ghost" href={x.waHref()} external data-kind="whatsapp" onClick={() => x.track("process-whatsapp")}><Icon name="whatsapp" /> {x.ui("Ask a question", "सवाल पूछें")}</Btn>}
        </div>
        <StepAccordion steps={steps} />
      </div>
    </Sec>
  );
}

/* ================= css ================= */

/** The rail laid across: used from the width at which `n` steps still have room (4 steps from 860 px, 5-6 from 1180 px). */
const horizontal = (sel: string) => `
${sel}{grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:0 var(--gap)}
${sel} li{padding:68px 0 0}
${sel} li:not(:last-child)::after{left:60px;right:calc(-1 * var(--gap) + 12px);top:23.5px;bottom:auto;width:auto;height:1px;background:linear-gradient(90deg,var(--accent),var(--line))}
${sel.split(",").map((q) => `${q} li>h3`).join(",")}{padding-top:0}`;

export const ABOUT_CSS = `
.site[data-adv] .abx-zoom{position:absolute;inset:0;display:block;width:100%;height:100%;padding:0;border:0;background:var(--paper-2);cursor:zoom-in;overflow:hidden;border-radius:inherit;color:inherit}
.abx-zoom .adv-photo{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.abx-zoom:hover .adv-photo{transform:scale(1.035)}
.site[data-adv] .abx-zoom:focus-visible{outline-offset:-4px}
.abx-ticks{list-style:none;margin:0;padding:0;display:grid;gap:var(--s3);font-size:var(--t-body);line-height:1.45;color:var(--ink)}
.abx-ticks li{display:flex;align-items:flex-start;gap:var(--s3)}
.abx-ticks svg{flex:none;margin-top:.2em;color:var(--accent)}
.site:lang(hi) :is(.abe-title,.abe-lede,.abq-quote,.aby-label,.abw-statement,.abn-val,.abc-title,.pcl-no,.pch-node,.pci-no,.pca-no){line-height:1.3;letter-spacing:0;font-weight:var(--display-w-hi)}

.abe{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.abe-side{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.abe-title{font-size:clamp(2rem,5vw,3.6rem);line-height:1.04;max-width:13ch}
.abe-ticks{width:100%;margin-top:var(--s4);padding-top:var(--s4);border-top:1px solid var(--line)}
.abe-main{min-width:0}
.abe-lede{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.35rem,2.7vw,2.1rem);line-height:1.3;letter-spacing:var(--display-tr);color:var(--ink);text-wrap:pretty}
.abe-fig{position:relative;margin:clamp(1.5rem,4vw,2.5rem) 0;aspect-ratio:16/10;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.abe-cols{column-gap:clamp(1.5rem,3vw,3rem)}
.abe-text p{break-inside:avoid-column}
.site:lang(en) .abe-lede~.abe-text>p:first-child::first-letter,.site:lang(en) .abe-fig~.abe-text>p:first-child::first-letter{float:left;font-family:var(--font-display);font-size:3.5em;line-height:.8;padding:.07em .1em 0 0;color:var(--accent)}
@media (min-width:960px){.abe{grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:clamp(3rem,6vw,6rem)}.abe-side{position:sticky;top:96px;align-self:start}.abe-cols{column-count:2}}

.abq{margin:0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--s4)}
.abq-mark{font-family:var(--font-display);font-size:clamp(5rem,14vw,9rem);line-height:.7;height:.5em;color:var(--accent);opacity:.9}
.abq-quote{margin:0;max-width:24ch}
.abq-quote p{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.75rem,4.8vw,3.5rem);line-height:1.14;letter-spacing:var(--display-tr);color:var(--ink);text-wrap:balance}
.site:lang(hi) .abq-quote p{line-height:1.35}
.abq-sign{display:flex;align-items:center;gap:var(--s3);margin-top:var(--s3);text-align:left}
.abq-sign b{display:block;font-size:var(--t-body);font-weight:600;color:var(--ink)}
.abq-sign small{display:block;margin-top:2px;font-size:var(--t-meta,13px);color:var(--muted)}
.abq-avatar{position:relative;flex:none;width:48px;height:48px;border-radius:999px;overflow:hidden;background:var(--paper-2)}
.abq-after{margin:clamp(2.5rem,6vw,4.5rem) auto 0;max-width:62rem;padding-top:clamp(1.75rem,4vw,2.75rem);border-top:1px solid var(--line)}
.abq-cols{column-gap:clamp(1.5rem,4vw,3.5rem)}
.abq-text p{break-inside:avoid-column}
.abq-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--s2);margin:var(--s5) 0 0;padding:0;list-style:none}
@media (min-width:800px){.abq-cols{column-count:2}}

.aby-grid{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.aby-head{margin-bottom:clamp(1.25rem,3vw,2rem)}
.aby-head .adv-h2{font-size:clamp(1.8rem,4.2vw,3rem)}
.aby-intro{max-width:60ch;margin:0 0 clamp(1.5rem,4vw,2.5rem)}
.aby{--aby-fs:clamp(1.5rem,3.6vw,2.4rem);--aby-x:10px;position:relative;list-style:none;margin:0;padding:0;display:grid;gap:clamp(1.5rem,3.5vw,2.5rem)}
.aby::before{content:"";position:absolute;left:calc(var(--aby-x) - .5px);top:calc(var(--aby-fs) / 2);bottom:.75rem;width:1px;background:linear-gradient(var(--accent),var(--line))}
.aby li{position:relative;display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:var(--s3);row-gap:var(--s2)}
.aby-dot{grid-column:1;grid-row:1;align-self:center;justify-self:center;width:11px;height:11px;border-radius:999px;background:var(--paper);border:2px solid var(--accent);transition:background .2s,transform .2s;z-index:1}
.aby li:hover .aby-dot{background:var(--accent);transform:scale(1.2)}
.aby-label{grid-column:2;grid-row:1;font-family:var(--font-display);font-weight:var(--display-w);font-size:var(--aby-fs);line-height:1;letter-spacing:var(--display-tr);color:var(--accent);font-variant-numeric:lining-nums}
.aby-chapters .aby-label{font-family:var(--font-text);font-size:var(--t-meta,13px);font-weight:600;letter-spacing:.12em;color:var(--muted)}
.aby-text{grid-column:2;grid-row:2;margin:0;font-size:var(--t-body);line-height:var(--body-lh,1.65);color:var(--muted);text-wrap:pretty;max-width:60ch}
.aby li:hover .aby-text{color:var(--ink)}
.aby-ticks{margin-top:clamp(1.75rem,4vw,2.75rem);padding-top:var(--s5);border-top:1px solid var(--line)}
.aby-fig{position:relative;aspect-ratio:4/5;max-width:440px;width:100%;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
@media (min-width:640px){
.aby{--aby-x:calc(6.5rem + 14px)}
.aby li{grid-template-columns:6.5rem 28px minmax(0,1fr)}
.aby-label{grid-column:1;grid-row:1}
.aby-dot{grid-column:2;grid-row:1;align-self:start;margin-top:calc(var(--aby-fs) / 2 - 5.5px)}
.aby-text{grid-column:3;grid-row:1;padding-top:.15em}
}
@media (min-width:1000px){.aby-photo{grid-template-columns:minmax(0,7fr) minmax(0,5fr);align-items:start}.aby-fig{position:sticky;top:96px;justify-self:end}}

.abw{display:grid;gap:clamp(2.25rem,5vw,3.5rem);align-items:center}
.abw-who{position:relative;padding-bottom:2.25rem;max-width:460px;width:100%}
.abw-frame{position:relative;aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.abw-plate{position:absolute;left:1rem;right:1rem;bottom:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px var(--s3);padding:.9rem 1.1rem;border-radius:var(--r-card);background:var(--paper);border:1px solid var(--line);box-shadow:var(--e-1)}
.abw-plate b{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.25rem;line-height:1.2;color:var(--ink);flex-basis:100%}
.abw-plate span{font-size:var(--t-meta,13px);color:var(--muted)}
.abw-city{display:inline-flex;align-items:center;gap:.3em}
.abw-statement{font-size:clamp(1.7rem,4vw,2.9rem);line-height:1.12;max-width:20ch}
.abw-text{margin-top:var(--s5);max-width:58ch}
.abw-ticks{margin-top:var(--s5);padding-top:var(--s5);border-top:1px solid var(--line)}
.abw-btns{margin-top:var(--s6)}
@media (min-width:900px){.abw{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(3rem,6vw,6rem)}}

.abn-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));margin:clamp(1.5rem,4vw,2.75rem) 0 0;padding:0;border-top:1px solid var(--ink);border-bottom:1px solid var(--line)}
.abn-fact{padding:clamp(1.1rem,2.6vw,1.9rem) clamp(.75rem,2vw,1.5rem) clamp(1.1rem,2.6vw,1.9rem) 0;min-width:0}
.abn-val{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.9rem,4.6vw,3.4rem);line-height:1.05;letter-spacing:var(--display-tr);color:var(--accent);font-variant-numeric:lining-nums;overflow-wrap:anywhere}
.abn-lab{margin-top:var(--s2);font-size:var(--t-meta,13px);line-height:1.4;color:var(--muted)}
.abn{display:grid;gap:clamp(1.5rem,4vw,3rem);margin-top:clamp(2rem,5vw,3.5rem)}
.abn-statement{font-size:clamp(1.7rem,4.2vw,3rem);line-height:1.12;max-width:22ch}
.abn-solo .abn-statement{max-width:30ch}
.abn-cols{column-gap:clamp(1.5rem,3vw,3rem)}
.abn-body .adv-body p{break-inside:avoid-column}
.abn-ticks{margin-top:var(--s5)}
@media (min-width:900px){.abn{grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:clamp(3rem,6vw,6rem);align-items:start}.abn-solo{grid-template-columns:1fr}.abn-cols{column-count:2}}
@media (min-width:900px) and (max-width:1100px){.abn-cols{column-count:1}}

.abc{display:grid;gap:clamp(2.25rem,5vw,3.5rem);align-items:center}
.abc-art{--abc-bg:var(--paper);display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:repeat(12,minmax(0,1fr));aspect-ratio:1/1;width:100%;max-width:560px}
[data-tone=alt] .abc-art{--abc-bg:var(--paper-2)}
.abc-tile{position:relative;overflow:hidden;border-radius:var(--r-tile);background:var(--paper-2);min-width:0;min-height:0}
.abc-art[data-n="3"] .abc-a{grid-area:1/1/9/8}
.abc-art[data-n="3"] .abc-b{grid-area:5/6/13/13;z-index:1;box-shadow:0 0 0 6px var(--abc-bg)}
.abc-art[data-n="3"] .abc-c{grid-area:9/1/13/5;z-index:2;box-shadow:0 0 0 6px var(--abc-bg)}
.abc-art[data-n="2"] .abc-a{grid-area:1/1/10/9}
.abc-art[data-n="2"] .abc-b{grid-area:5/5/13/13;z-index:1;box-shadow:0 0 0 6px var(--abc-bg)}
.abc-art[data-n="1"]{aspect-ratio:4/5;max-width:460px}
.abc-art[data-n="1"] .abc-a{grid-area:1/1/13/13}
.abc-tile:hover{z-index:3}
.abc-title{font-size:clamp(1.7rem,4vw,2.9rem);line-height:1.12;max-width:20ch}
.abc-text{margin-top:var(--s5);max-width:56ch}
.abc-ticks{margin-top:var(--s5);padding-top:var(--s5);border-top:1px solid var(--line)}
.abc-bare{max-width:48rem}
@media (min-width:900px){.abc{grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:clamp(3rem,6vw,6rem)}.abc-bare{grid-template-columns:1fr}}

.pcl{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.pcl-side{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s6)}
.pcl-side .adv-head{margin-bottom:0}
.pcl-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--ink)}
.pcl-list li{display:grid;grid-template-columns:clamp(3.25rem,9vw,5.5rem) minmax(0,1fr);gap:var(--s4);padding:clamp(1.25rem,3vw,2rem) 0;border-bottom:1px solid var(--line);transition:padding-left .3s cubic-bezier(.2,.7,.2,1)}
.pcl-no{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2rem,5vw,3.6rem);line-height:1;letter-spacing:var(--display-tr);color:var(--muted);font-variant-numeric:lining-nums;transition:color .25s}
.pcl-list li:hover .pcl-no,.pcl-list li:focus-within .pcl-no{color:var(--accent)}
.site[data-adv][data-motion=rich] .pcl-list li:hover{padding-left:var(--s3)}
.pcl-list h3{font-family:var(--font-text);font-size:clamp(1.1rem,2vw,1.35rem);font-weight:600;line-height:1.3;color:var(--ink)}
.pcl-list p{margin:var(--s2) 0 0;font-size:var(--t-body);line-height:var(--body-lh,1.65);color:var(--muted);max-width:56ch}
@media (min-width:960px){.pcl{grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:clamp(3rem,6vw,6rem)}.pcl-side{position:sticky;top:96px;align-self:start}}

.pch{list-style:none;margin:0;padding:0;display:grid;gap:var(--s6)}
.pch li{position:relative;padding-left:68px;min-height:48px;min-width:0}
.pch-node{position:absolute;left:0;top:0;z-index:1;display:grid;place-items:center;width:48px;height:48px;border-radius:999px;background:var(--paper);border:1px solid var(--accent);color:var(--accent);font-family:var(--font-display);font-weight:var(--display-w);font-size:1.1rem;line-height:1;font-variant-numeric:lining-nums;transition:background .25s,color .25s}
.pch li:hover .pch-node,.pch li:focus-within .pch-node{background:var(--accent);color:var(--on-accent)}
.pch li:not(:last-child)::after{content:"";position:absolute;left:23.5px;top:52px;bottom:calc(-1 * var(--s6) + 4px);width:1px;background:linear-gradient(var(--accent),var(--line))}
.pch h3{font-family:var(--font-text);font-size:clamp(1.05rem,1.8vw,1.25rem);font-weight:600;line-height:1.3;color:var(--ink);padding-top:.7rem}
.pch p{margin:var(--s2) 0 0;font-size:var(--t-body);line-height:1.6;color:var(--muted);text-wrap:pretty}
.pch li>h3:first-of-type{overflow-wrap:anywhere}
@media (min-width:860px){${horizontal('.pch[data-n="2"],.pch[data-n="3"],.pch[data-n="4"]')}}
@media (min-width:1180px){${horizontal('.pch[data-n="5"],.pch[data-n="6"],.pch[data-n="1"]')}}

.pci{list-style:none;margin:0;padding:0;display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))}
.pci-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;padding:clamp(1.25rem,2.6vw,1.9rem);transition:border-color .25s,background .25s}
.pci-card:hover,.pci-card:focus-within{border-color:color-mix(in srgb,var(--accent) 55%,var(--line))}
.pci-badge{display:grid;place-items:center;width:52px;height:52px;border-radius:var(--r-card);background:var(--accent-soft);color:var(--accent);font-family:var(--font-display);font-weight:var(--display-w);font-size:1.2rem;transition:background .25s,color .25s}
.pci-card:hover .pci-badge{background:var(--accent);color:var(--on-accent)}
.pci-no{position:absolute;top:clamp(1.25rem,2.6vw,1.9rem);right:clamp(1.25rem,2.6vw,1.9rem);font-family:var(--font-display);font-weight:var(--display-w);font-size:1.5rem;line-height:1;color:var(--line);color:color-mix(in srgb,var(--ink) 22%,transparent);font-variant-numeric:lining-nums}
.pci-card h3{margin-top:var(--s5);font-family:var(--font-text);font-size:1.125rem;font-weight:600;line-height:1.3;color:var(--ink)}
.pci-card p{margin:var(--s2) 0 0;font-size:var(--t-body);line-height:1.6;color:var(--muted);text-wrap:pretty}

.pca{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.pca-side{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s6)}
.pca-side .adv-head{margin-bottom:0}
.pca-list{border-top:1px solid var(--ink);min-width:0}
.pca-item{border-bottom:1px solid var(--line)}
.pca-item h3{font-family:var(--font-text)}
.pca-item button,.pca-static{display:grid;grid-template-columns:clamp(2.5rem,7vw,3.5rem) minmax(0,1fr) 20px;align-items:center;gap:var(--s3);width:100%;padding:clamp(1rem,2.4vw,1.5rem) 0;margin:0;border:0;background:none;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.pca-static{grid-template-columns:clamp(2.5rem,7vw,3.5rem) minmax(0,1fr);cursor:default}
.pca-item button:hover .pca-name{color:var(--accent)}
.site[data-adv] .pca-item button:focus-visible{outline-offset:2px;border-radius:var(--r-ctl)}
.pca-no{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.4rem,3vw,2rem);line-height:1;color:var(--muted);font-variant-numeric:lining-nums;transition:color .25s}
.pca-item[data-open] .pca-no{color:var(--accent)}
.pca-name{font-size:clamp(1.05rem,1.9vw,1.3rem);font-weight:600;line-height:1.3;transition:color .2s;overflow-wrap:anywhere}
.pca-chev{color:var(--muted);transition:transform .3s cubic-bezier(.2,.7,.2,1),color .2s}
.pca-item[data-open] .pca-chev{transform:rotate(180deg);color:var(--accent)}
.pca-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s cubic-bezier(.2,.7,.2,1)}
.pca-item[data-open] .pca-panel{grid-template-rows:1fr}
.pca-inner{min-height:0;overflow:hidden;visibility:hidden;transition:visibility .35s}
.pca-item[data-open] .pca-inner{visibility:visible}
.pca-inner p{margin:0;padding:0 var(--s5) clamp(1.1rem,2.6vw,1.6rem) calc(clamp(2.5rem,7vw,3.5rem) + var(--s3));font-size:var(--t-body);line-height:var(--body-lh,1.65);color:var(--muted);max-width:62ch;text-wrap:pretty}
@media (min-width:960px){.pca{grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:clamp(3rem,6vw,6rem)}.pca-side{position:sticky;top:96px;align-self:start}}
@media print{.pca-panel{grid-template-rows:1fr}.pca-inner{visibility:visible}}
`;
