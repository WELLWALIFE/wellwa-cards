"use client";
// The proof and the close of the standard website (16 Oct 2026, "proof-footer" pass): a reviewer's initial and place, the
// opening-hours list that marks today, the map frame (a skeleton under the iframe, so a slow map is never a blank hole), the
// "still have a question?" strip after the FAQ, the closing band's facts and the footer's social row. Parts only: the page
// (site-view.tsx) decides where they sit; PROOF_CSS is added to its style tag. Nothing here is invented: every line comes from
// the card (address, hours, number) and each part draws nothing when its fact is missing.
import { useEffect, useState } from "react";
import { Icon } from "@/components/site-icons";
import { OpenNowChip } from "@/components/site-smart";
import { useT } from "@/components/card-view";
import { rowDays, type HoursRow } from "@/lib/open-now";
import { trackClick } from "@/lib/track";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

/** "Priya Sharma, Rewari" → { who: "Priya Sharma", where: "Rewari" }: the owner types the place after a comma or a dash. */
export function splitReviewer(raw: string): { who: string; where: string } {
  const s = (raw ?? "").trim();
  const m = /^(.*?)\s*(?:,|\s[–—-]\s|\|)\s*(.+)$/.exec(s);
  return m && m[1] ? { who: m[1].trim(), where: m[2].trim() } : { who: s, where: "" };
}

/** Initials of the first two words (Devanagari too: its first letter, matras left out). */
export function initialsOf(name: string): string {
  const words = (name ?? "").replace(/[^\p{L}\p{M}\s.'-]/gu, "").split(/\s+/).filter((w) => /\p{L}/u.test(w) && !/^(mr|mrs|ms|dr|shri|smt)\.?$/i.test(w));
  const first = (w: string) => Array.from(w.replace(/^[^\p{L}]+/u, ""))[0] ?? "";
  const letters = (words.length > 1 ? [words[0], words[1]] : [words[0] ?? ""]).map((w) => first(w)).join("");
  return letters.toUpperCase() || "★";
}

/** A reviewer: a round initial in the page's own colour (currentColor tint, so it suits paper, ink and colour blocks alike),
 *  the name, and the place under it when the owner wrote one. */
export function ReviewBy({ name, className = "" }: { name: string; className?: string }) {
  const { who, where } = splitReviewer(name);
  return (
    <span className={`rv-by ${className}`}>
      <span className="rv-av" aria-hidden="true">{initialsOf(who)}</span>
      <span className="rv-id"><b>{who}</b>{where && <small>{where}</small>}</span>
    </span>
  );
}

/* ---------- opening hours ---------- */

const istDow = () => { const n = new Date(); return new Date(n.getTime() + (n.getTimezoneOffset() + 330) * 60_000).getDay(); };

/** The hours as a ruled list. A row with the hours inside its day ("Mon–Sat 10am–8pm", nothing in `time`) is one line; the row
 *  of today (IST, worked out after mount so the server and the browser agree) carries a small "Today". */
export function HoursList({ rows, hi, dark = false }: { rows: HoursRow[]; hi: boolean; dark?: boolean }) {
  const t = useT();
  const [dow, setDow] = useState<number | null>(null);
  useEffect(() => { setDow(istDow()); }, []);
  const list = rows.filter((r) => (r.day ?? "").trim() || (r.time ?? "").trim());
  const mark = list.length > 1 || list.some((r) => rowDays(r.day).length < 7);
  return (
    <ul className={`hrs ${dark ? "hrs-dark" : ""}`}>
      {list.map((r, i) => {
        const day = (r.day ?? "").trim(), time = (r.time ?? "").trim();
        const days = rowDays(day);
        const today = mark && dow !== null && days.length > 0 && days.includes(dow);
        const closed = /closed|बंद|छुट्टी/i.test(time || day);
        return (
          <li key={i} data-today={today ? "" : undefined} data-closed={closed ? "" : undefined}>
            {time ? <><span className="hrs-d">{t(day)}{today && <em>{hi ? "आज" : t("Today")}</em>}</span><span className="hrs-t">{t(time)}</span></> : <span className="hrs-one">{t(day)}{today && <em>{hi ? "आज" : t("Today")}</em>}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- the map ---------- */

/** The map in a frame of its own: a street-grid skeleton and a pin sit under the iframe (a Google embed is see-through until it
 *  loads, so a slow network shows a drawn map, not a white hole), and "Open in Maps" sits on the corner. The height is fixed, so
 *  nothing moves when the map arrives. */
export function MapCard({ q, href, hi, title }: { q: string; href?: string; hi: boolean; title?: string }) {
  const t = useT();
  return (
    <div className="map-card">
      <div className="map-skel" aria-hidden="true"><Icon name="pin" size={30} strokeWidth={1.6} /></div>
      <iframe title={title || "Map"} src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      {href && <a href={href} target="_blank" rel="noreferrer" className={`map-open ${FOCUS}`}><Icon name="arrow-up-right" size={14} /> {hi ? "मैप में खोलें" : t("Open in Maps")}</a>}
    </div>
  );
}

/** The address and the timings beside (or, with no map, next to) each other: three buttons on the address, the open-now chip on the hours. */
export function VisitPanel({ username, address, dir, mapQ, hours, hoursTitle, phoneHref, waHref, hi }: {
  username: string; address: string; dir: string; mapQ: string; hours?: HoursRow[]; hoursTitle?: string; phoneHref?: string; waHref?: string; hi: boolean;
}) {
  const t = useT();
  const rows = hours ?? [];
  const hasAddr = !!(address || dir);
  const cards = (
    <div className="visit-cards">
      {hasAddr && (
        <div className="s-card visit-card">
          <div className="flex items-start gap-4">
            <span className="icon-box"><Icon name="pin" size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="kicker">{hi ? "पता" : t("Address")}</p>
              {address && <p className="mt-2 text-[17px] leading-relaxed font-medium">{t(address)}</p>}
            </div>
          </div>
          <div className="visit-acts">
            {dir && <a href={dir} target="_blank" rel="noreferrer" onClick={() => trackClick(username, "site-visit-directions")} className={`btn-primary ${FOCUS}`}><Icon name="directions" /> {hi ? "रास्ता देखें" : t("Get directions")}</a>}
            {phoneHref && <a href={phoneHref} onClick={() => trackClick(username, "site-visit-call")} className={`btn-ghost ${FOCUS}`}><Icon name="phone" /> {hi ? "कॉल करें" : t("Call")}</a>}
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" onClick={() => trackClick(username, "site-visit-whatsapp")} className={`btn-ghost ${FOCUS}`}><Icon name="whatsapp" /> WhatsApp</a>}
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="s-card visit-card">
          <div className="flex flex-wrap items-center gap-3">
            <span className="icon-box"><Icon name="clock" size={18} /></span>
            <p className="font-semibold">{t(hoursTitle || "Opening hours")}</p>
            <OpenNowChip rows={rows} hi={hi} className="ml-auto" />
          </div>
          <div className="mt-3"><HoursList rows={rows} hi={hi} /></div>
        </div>
      )}
    </div>
  );
  return (
    <div className={`visit-grid ${mapQ ? "has-map" : ""}`}>
      {cards}
      {mapQ && <MapCard q={mapQ} href={dir || undefined} hi={hi} title={hi ? "नक्शा" : "Map"} />}
    </div>
  );
}

/* ---------- after the FAQ ---------- */

/** "Still have a question?" — the last objection answered by a person, one tap into WhatsApp (or the phone when there is no WhatsApp). */
export function FaqAsk({ href, hi, username, kind = "whatsapp" }: { href: string; hi: boolean; username: string; kind?: "whatsapp" | "phone" }) {
  const t = useT();
  return (
    <div className="faq-ask">
      <div className="min-w-0">
        <p className="faq-ask-h">{hi ? "कोई और सवाल है?" : t("Still have a question?")}</p>
        <p className="faq-ask-p">{kind === "phone" ? (hi ? "सीधे हमें कॉल कीजिए, हम बताएँगे।" : t("Call us and we will tell you straight.")) : (hi ? "WhatsApp पर पूछिए, हम जल्दी जवाब देते हैं।" : t("Ask on WhatsApp. We reply as soon as we can."))}</p>
      </div>
      <a href={href} target={kind === "whatsapp" ? "_blank" : undefined} rel="noreferrer" onClick={() => trackClick(username, "site-faq-ask")} className={`btn-primary ${FOCUS}`}>
        <Icon name={kind === "whatsapp" ? "whatsapp" : "phone"} /> {kind === "whatsapp" ? (hi ? "WhatsApp पर पूछें" : t("Ask on WhatsApp")) : (hi ? "कॉल करें" : t("Call us"))}
      </a>
    </div>
  );
}

/* ---------- the closing band's facts ---------- */

/** Under the closing line: open now (or closed, and when it opens), the address, the number — what a visitor wants to know before
 *  tapping. Draws nothing when the card has none of them. */
export function ClosingFacts({ rows, address, phone, phoneHref, dir, hi }: { rows?: HoursRow[]; address?: string; phone?: string; phoneHref?: string; dir?: string; hi: boolean }) {
  const t = useT();
  const has = (rows?.length ?? 0) > 0 || !!address || !!phone;
  if (!has) return null;
  return (
    <ul className="close-facts">
      {rows && rows.length > 0 && <li><OpenNowChip rows={rows} hi={hi} tone="dark" /></li>}
      {address && <li>{dir ? <a href={dir} target="_blank" rel="noreferrer" className={FOCUS}><Icon name="pin" size={15} /> {t(address)}</a> : <span><Icon name="pin" size={15} /> {t(address)}</span>}</li>}
      {phone && <li>{phoneHref ? <a href={phoneHref} className={FOCUS}><Icon name="phone" size={15} /> <span className="tabular-nums">{phone}</span></a> : <span><Icon name="phone" size={15} /> {phone}</span>}</li>}
    </ul>
  );
}

/* ---------- the footer ---------- */

/** A footer blurb cut at a sentence or a word, never mid-word ("…takes responsib"). */
export function tidyBlurb(s: string, max = 160): string {
  const x = (s ?? "").replace(/\s+/g, " ").trim();
  if (x.length <= max) return x;
  const head = x.slice(0, max);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("। "), head.lastIndexOf("! "));
  if (stop > max * 0.5) return head.slice(0, stop + 1);
  return head.replace(/[\s,;:–—-]*\S*$/, "").replace(/[.,;:–—-]+$/, "") + "…";
}

export const SOCIAL_TYPES = new Set(["instagram", "facebook", "linkedin", "youtube", "website"]);

/** "Top of the page": a footer's last courtesy on a long page. */
export function BackToTop({ hi }: { hi: boolean }) {
  const t = useT();
  return (
    <a href="#top" onClick={(e) => { e.preventDefault(); try { window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } catch { window.scrollTo(0, 0); } }} className={`foot-top ${FOCUS}`}>
      <Icon name="arrow-up-right" size={13} style={{ transform: "rotate(-45deg)" }} /> {hi ? "ऊपर जाएँ" : t("Back to top")}
    </a>
  );
}

/** The CSS of the parts above; the page adds it after its own, so these rules win on equal weight. */
export const PROOF_CSS = `
.site .rv-by{display:inline-flex;align-items:center;gap:10px;text-transform:none;letter-spacing:0;font-weight:inherit;min-width:0}
.site .rv-av{flex:none;display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;font-size:12px;font-weight:700;letter-spacing:.02em;line-height:1;color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 22%,transparent)}
.site[data-bp] .col-revs figcaption .rv-av{font-family:inherit;font-size:12px;line-height:1;margin:0}
.site[data-bp] .col-revs figcaption .rv-by,.site[data-bp] .col-revs figcaption .rv-id{font-family:inherit;font-size:12px;line-height:1.25}
.site .col-revs .rv-av{color:inherit;background:color-mix(in srgb,currentColor 14%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 30%,transparent)}
.site .rv-id{display:grid;min-width:0;line-height:1.25;text-align:left}
.site .rv-id b{font-weight:650;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.site .col-revs .rv-id b{color:inherit}
.site .rv-id small{font-size:12px;font-weight:500;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.site .col-revs .rv-id small{color:inherit;opacity:.7}
.site .rv-fig{display:flex;flex-direction:column;height:100%;margin:0}
.site .rv-fig figcaption{margin-top:auto;padding-top:18px}
/* the plain look's reviews sit on cards with a quiet quote mark, so the row reads as a wall of voices, not three loose paragraphs */
.site .rv-fig:not(.rv-big){position:relative;padding:26px 26px 24px;border-radius:var(--r-card);background:var(--surface);border:1px solid var(--line)}
.site .rv-fig:not(.rv-big)::before{content:"\\201C";position:absolute;right:20px;top:6px;font-family:var(--font-display,var(--look-head));font-size:88px;line-height:1;color:color-mix(in srgb,var(--accent) 16%,transparent);pointer-events:none}
.site .rv-fig:not(.rv-big) .rev-q{font-size:21px;line-height:1.38}
.site .rv-fig:not(.rv-big) .rev-rule{display:none}
.site .rv-fig:not(.rv-big) figcaption{border-top:1px solid var(--line);margin-top:auto}
.site .rv-fig:not(.rv-big) blockquote{margin-bottom:22px}

/* on a phone three or more reviews are a swipe row (a stack of three tall cards pushed the FAQ a screen away) */
@media (max-width:639px){
  .site .rv-wall{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -20px;padding:0 20px 8px;scrollbar-width:none}
  .site .rv-wall::-webkit-scrollbar{display:none}
  .site .rv-wall>.rv-fig{flex:0 0 min(84%,340px);scroll-snap-align:start;height:auto}
}

/* hours */
.site .hrs{list-style:none;margin:0;padding:0}
.site .hrs li{display:flex;align-items:baseline;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:15px}
.site .hrs li:last-child{border-bottom:0}
.site .hrs-d{display:flex;align-items:center;gap:8px;font-weight:600}
.site .hrs-d::after,.site .hrs-one::after{content:none}
.site .hrs-t{margin-left:auto;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.site .hrs-one{display:flex;align-items:center;gap:8px;font-weight:600;font-variant-numeric:tabular-nums}
.site .hrs em{font-style:normal;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:99px;color:var(--on-accent);background:var(--accent)}
.site .hrs li[data-today] .hrs-t{color:var(--ink);font-weight:600}
.site .hrs li[data-closed] .hrs-t{color:var(--danger,#b42318)}

/* the visit block */
.site .visit-grid{display:grid;gap:16px}
.site .visit-grid>*{min-width:0}
.site .visit-cards{display:grid;gap:16px;align-content:start}
.site .visit-card{padding:22px}
.site .visit-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.site .visit-acts>a{flex:1 1 calc(50% - 5px);min-width:130px}
.site .visit-acts>a:first-child{flex-basis:100%}
.site .visit-acts>a:first-child:nth-last-child(1){flex-basis:100%}
.site .map-card{position:relative;overflow:hidden;border-radius:var(--r-card);border:1px solid var(--line);background:color-mix(in srgb,var(--accent) 7%,var(--surface));min-height:300px;height:100%}
.site .map-skel{position:absolute;inset:0;display:grid;place-items:center;color:var(--accent);background-image:linear-gradient(color-mix(in srgb,var(--ink) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--ink) 7%,transparent) 1px,transparent 1px),linear-gradient(115deg,transparent 46%,color-mix(in srgb,var(--accent) 16%,transparent) 46%,color-mix(in srgb,var(--accent) 16%,transparent) 54%,transparent 54%);background-size:44px 44px,44px 44px,100% 100%}
.site .map-card iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent}
.site .map-open{position:absolute;right:12px;bottom:12px;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:99px;font-size:13px;font-weight:650;color:var(--ink);background:var(--paper);border:1px solid var(--line);box-shadow:0 6px 18px -8px rgb(0 0 0/.35);text-decoration:none}
.site .map-open:hover{border-color:var(--accent)}
@media (min-width:860px){
  .site .visit-grid.has-map{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);align-items:stretch}
  .site .visit-grid:not(.has-map){grid-template-columns:1fr}
  .site .visit-grid:not(.has-map) .visit-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .site .visit-grid:not(.has-map) .visit-cards:has(>:only-child){grid-template-columns:minmax(0,640px)}
}
@media (max-width:859px){.site .map-card{min-height:0;height:auto;aspect-ratio:4/3}}

/* the FAQ */
.site .faq summary{min-height:56px;padding:var(--s3) 0;transition:color .15s}
.site .faq summary:hover{color:var(--accent)}
.site .faq summary svg{width:30px;height:30px;padding:6px;border-radius:50%;background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent)}
.site .faq details[open] summary{color:var(--ink)}
@supports (selector(::details-content)){
  .site .faq details::details-content{block-size:0;overflow:hidden;transition:block-size .28s ease,content-visibility .28s allow-discrete}
  .site .faq details[open]::details-content{block-size:auto}
}
@supports (interpolate-size:allow-keywords){.site .faq{interpolate-size:allow-keywords}}
@media (prefers-reduced-motion:reduce){.site .faq details::details-content{transition:none}}
.site .faq-ask{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 24px;margin-top:var(--s7,40px);padding:22px 24px;border-radius:var(--r-card);background:var(--paper);color:var(--ink);border:1px solid color-mix(in srgb,var(--accent) 22%,var(--line));box-shadow:0 14px 30px -24px rgb(0 0 0/.4)}
.site .faq-ask-h{margin:0;font-family:var(--font-display,var(--look-head));font-size:1.25rem;font-weight:var(--head-w,600);line-height:1.2}
.site .faq-ask .faq-ask-h{text-transform:none;letter-spacing:0;color:var(--ink)!important}
.site .faq-ask .faq-ask-p{color:color-mix(in srgb,var(--ink) 68%,transparent)!important}
.site .faq-ask-p{margin:6px 0 0;color:var(--muted);font-size:15px;line-height:1.5}
/* the poster look flips --ink inside its coloured bands, so there the strip takes the footer's own pair (always legible) */
.site[data-bp="story"] .faq-ask{background:var(--p-foot);color:var(--p-foot-ink);border-color:var(--p-foot-ink)}
.site[data-bp="story"] .faq-ask .faq-ask-h{color:var(--p-foot-ink)!important}
.site[data-bp="story"] .faq-ask .faq-ask-p{color:color-mix(in srgb,var(--p-foot-ink) 72%,transparent)!important}
.site[data-bp="story"] .faq-ask .btn-primary{background:var(--p-foot-ink);color:var(--p-foot)}
@media (max-width:600px){.site .faq-ask{padding:20px}.site .faq-ask>a{width:100%}}

/* the closing band */
.site .close-band{position:relative;isolation:isolate}
.site .close-band::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60% 90% at 88% 0%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 70%),radial-gradient(45% 70% at 0% 100%,color-mix(in srgb,var(--p-foot-ink) 9%,transparent),transparent 70%)}
.site .close-facts{list-style:none;margin:var(--s6,28px) 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;font-size:14px;color:var(--hero-muted)}
.site .close-facts li{display:inline-flex;min-width:0}
.site .close-facts a,.site .close-facts span:not(.rounded-full){display:inline-flex;align-items:center;gap:7px;color:inherit;text-decoration:none;min-height:32px}
.site .close-facts a:hover{color:var(--hero-text);text-decoration:underline;text-underline-offset:.2em}
.site .close-facts li>span.inline-flex{color:var(--hero-text)}

/* the phone's action bar: a soft lift off the page, and out of the way while a form field has the keyboard */
.site .site-bar{box-shadow:0 -10px 28px -16px rgb(0 0 0/.35)}
body:has(input:focus,textarea:focus,select:focus) .site-bar{transform:translateY(110%)!important}

/* the footer */
.site .foot-cols{display:grid;gap:36px 40px}
@media (min-width:768px){.site .foot-cols{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1024px){.site .foot-cols.has-visit{grid-template-columns:1.5fr .8fr 1.1fr 1.1fr}.site .foot-cols:not(.has-visit){grid-template-columns:1.3fr 1fr 1fr}}
@media (max-width:767px){.site .foot-pages{display:block;columns:2;column-gap:24px}.site .foot-pages>li{margin:0 0 12px!important;break-inside:avoid}}
/* Phone: every footer link and small button is a 44px target (the page links were 17px tall, the buttons 32 — QA pass, 16 Oct 2026). */
@media (max-width:767px){.site footer .foot-pages>li{margin:0!important}.site footer .foot-pages a,.site footer ul>li>a{display:inline-flex;align-items:center;min-height:44px}.site footer .btn-xs{min-height:44px}}
.site .foot-social{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.site .foot-social a{display:inline-grid;place-items:center;width:42px;height:42px;border-radius:50%;border:1px solid var(--hero-line);color:var(--hero-text);transition:background .15s,border-color .15s,transform .1s}
.site .foot-social a:hover{background:color-mix(in srgb,var(--hero-text) 12%,transparent);border-color:currentColor}
.site .foot-social a:active{transform:scale(.94)}
.site .foot-hrs{margin-top:12px}
.site .foot-hrs li{padding:7px 0;font-size:13px;border-color:var(--hero-line)}
.site .foot-hrs .hrs-t{color:var(--hero-muted)}
.site .foot-hrs li[data-today] .hrs-t{color:var(--hero-text)}
.site .foot-hrs em{background:var(--hero-text);color:var(--hero-ink)}
.site .foot-top{display:inline-flex;align-items:center;gap:6px;color:inherit;text-decoration:none;opacity:.8;min-height:32px}
.site .foot-top:hover{opacity:1;text-decoration:underline;text-underline-offset:.2em}
`;
