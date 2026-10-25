"use client";
// How the advanced page ends (owner, 15-16 Oct 2026: a Rs 5,999 site must not close the way every site closes): sixteen
// variants for the four closing sections, so two businesses rarely finish the same way.
//   faq     numbered-accordion, two-column, searchable, chat-bubble
//   visit   map-hours, hours-timeline, address-poster, branch-list
//   cta     wide-band, floating-card, split-qr, sticky-ribbon
//   footer  mega, minimal, big-wordmark, link-grid
// The first (default) variant of each section is the plain one in basics.tsx; these sit beside it. Every variant reads only the
// shared props (shared.tsx) and the page's content (content.ts), draws nothing when its slice is empty, and takes every
// colour, radius and font from the spec's tokens. CLOSE_CSS rides in the page's one inline <style> (registry.ts).
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Download, Search, X } from "lucide-react";
import { Icon } from "@/components/site-icons";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { Pic } from "@/components/pic";
import type { HoursRow, LinkType } from "@/lib/types";
import type { SectionKey } from "@/lib/site-advanced";
import type { AdvCtxPlus } from "@/components/site-adv/nav";
import { sectionHasContent } from "@/components/site-adv/content";
import { Btn, Head, Photo, Sec, type AdvCtx, type SiteContent, type VariantProps } from "@/components/site-adv/shared";

/* ================= small helpers shared by the four sections ================= */

/** The business's clock: India time whatever the visitor's phone says (owner, 16 Oct 2026: "Open now" must be true for the shop, not
 *  for the visitor's time zone). Read after mount so the server and the first client paint agree; ticks once a minute. */
export type Ist = { day: number; min: number };
function istNow(): Ist {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: EN_DAYS.get(get("weekday").toLowerCase()) ?? new Date().getDay(), min: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
}
export function useIst(): Ist | null {
  const [t, setT] = useState<Ist | null>(null);
  useEffect(() => {
    const tick = () => setT(istNow());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}
/** Today's weekday (0 = Sunday), India time, null until mounted. */
function useToday(): number | null { return useIst()?.day ?? null; }

const EN_DAYS = new Map<string, number>([
  ["sun", 0], ["sunday", 0], ["mon", 1], ["monday", 1], ["tue", 2], ["tues", 2], ["tuesday", 2], ["wed", 3], ["weds", 3], ["wednesday", 3],
  ["thu", 4], ["thur", 4], ["thurs", 4], ["thursday", 4], ["fri", 5], ["friday", 5], ["sat", 6], ["saturday", 6],
]);
const HI_DAYS: [string, number][] = [["रवि", 0], ["सोम", 1], ["मंगल", 2], ["बुध", 3], ["गुरु", 4], ["शुक्र", 5], ["शनि", 6]];
const RANGE_WORDS = new Set(["-", "–", "—", "to", "till", "through", "thru", "से", "तक"]);
const dayNo = (w: string) => EN_DAYS.get(w) ?? HI_DAYS.find(([p]) => w.startsWith(p))?.[1];
/** The weekdays an owner's "Mon-Sat" / "सोम से शनि" / "Daily" / "Sunday" label means, or null when it cannot be read with
 *  confidence (the row is then simply not marked as today). */
export function daysOf(label: string): number[] | null {
  const s = (label ?? "").toLowerCase();
  if (/\b(daily|everyday|every day|all days|all week|7 days)\b|रोज़?|प्रतिदिन|हर दिन|सातों/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/\bweekdays?\b/.test(s)) return [1, 2, 3, 4, 5];
  if (/\bweekends?\b/.test(s)) return [0, 6];
  const toks = s.match(/[a-zऀ-ॿ]+|[-–—]/g) ?? [];
  const out = new Set<number>();
  for (let i = 0; i < toks.length; i++) {
    const a = dayNo(toks[i]);
    if (a === undefined) continue;
    if (RANGE_WORDS.has(toks[i + 1] ?? "")) {
      const b = i + 2 < toks.length ? dayNo(toks[i + 2]) : undefined;
      if (b !== undefined) { for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; } i += 2; continue; }
    }
    out.add(a);
  }
  return out.size ? [...out] : null;
}
/** The first timing row that covers `day`, else -1. */
function todayRow(rows: HoursRow[], day: number | null): number {
  if (day === null) return -1;
  return rows.findIndex((r) => daysOf(r.day)?.includes(day));
}

const digitsOf = (s: string) => (s ?? "").replace(/\D/g, "");
/** "+919876543210" -> "+91 98765 43210"; ten digits -> "98765 43210"; anything else as the owner wrote it. */
export function prettyPhone(v: string): string {
  const d = digitsOf(v);
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return v.trim();
}

/** What a contact link says on screen: a phone prettified, a social link as its handle ("@shubhora") and a map link as its label, never the
 *  raw address ("https://maps.google.com/?q=..." was printed in two footers, 16 Oct 2026 QA). */
export function shownValue(l: { type: string; value: string; label?: string }): string {
  const v = (l.value ?? "").trim();
  if (l.type === "whatsapp" || l.type === "phone") return prettyPhone(v);
  if (l.type === "location") return (l.label ?? "").trim() || "Find us";
  if (!/^https?:\/\//i.test(v) && !/^www\./i.test(v)) return v;
  const bare = v.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/$/, "");
  const handle = /^(?:instagram\.com|twitter\.com|x\.com)\/@?([\w.]+)$/i.exec(bare);
  return handle ? `@${handle[1]}` : bare;
}

/* ---------- open now / closed, read from the owner's timings ---------- */
/** "9 AM - 6 PM", "09:00 to 21:30", "11:00 – 23:00", "Open 24 hours", "Closed" -> minutes since midnight; null when it cannot be read. */
function rangeOf(time: string): { start: number; end: number } | "closed" | null {
  const s = (time ?? "").toLowerCase();
  if (/\b(closed|holiday)\b|बंद|अवकाश/.test(s)) return "closed";
  if (/\b24\s*(hours?|hrs?|x\s*7)\b|open 24|all day|round the clock|२४|24 घंटे/.test(s)) return { start: 0, end: 1440 };
  const toks = [...s.matchAll(/(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/g)];
  if (toks.length < 2) return null;
  const at = (i: number, mer?: string) => {
    const h = Number(toks[i][1]), m = Number(toks[i][2] ?? 0), ap = (toks[i][3] ?? mer ?? "")[0];
    if (h > 24 || m > 59) return null;
    return ((ap === "p" ? (h % 12) + 12 : ap === "a" ? h % 12 : h) % 24) * 60 + m;
  };
  const endMer = toks[1][3];
  let a = at(0, toks[0][3] ? undefined : endMer);
  const b = at(1);
  if (a === null || b === null) return null;
  // "9 - 6 PM": the opening hour borrows PM from the closing one and lands after it, so it must have been the morning.
  if (!toks[0][3] && endMer && a >= b && a >= 12 * 60) a -= 12 * 60;
  return { start: a, end: b <= a ? b + 1440 : b };
}
export type OpenState = { open: boolean; en: string; hi: string };
const clock = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};
/** Is the business open at `now`? Only rows whose weekday label can be read count (a row like "Lunch thali" is not a day); null
 *  when no row gives a day and a time, so the page never claims anything it cannot read. */
export function openStatus(rows: HoursRow[], now: Ist | null): OpenState | null {
  if (!now) return null;
  const slots: { day: number; start: number; end: number }[] = [];
  let known = false;
  for (const r of rows) {
    const days = daysOf(r.day), rg = rangeOf(r.time);
    if (!days || !rg) continue;
    known = true;
    if (rg !== "closed") for (const d of days) slots.push({ day: d, ...rg });
  }
  if (!known) return null;
  const yest = (now.day + 6) % 7;
  for (const sl of slots) {
    const inToday = sl.day === now.day && now.min >= sl.start && now.min < sl.end;
    const inFromYesterday = sl.day === yest && sl.end > 1440 && now.min + 1440 < sl.end;
    if (inToday || inFromYesterday) {
      const to = clock(sl.end);
      return { open: true, en: `Open now · until ${to}`, hi: `अभी खुला है · ${to} तक` };
    }
  }
  for (let off = 0; off < 8; off++) {
    const d = (now.day + off) % 7;
    const next = slots.filter((sl) => sl.day === d && (off > 0 || sl.start > now.min)).sort((p, q) => p.start - q.start)[0];
    if (next) {
      const at = clock(next.start);
      const when = off === 0 ? "" : off === 1 ? "tomorrow " : ["Sun ", "Mon ", "Tue ", "Wed ", "Thu ", "Fri ", "Sat "][d];
      const whenHi = off === 0 ? "" : off === 1 ? "कल " : ["रवि ", "सोम ", "मंगल ", "बुध ", "गुरु ", "शुक्र ", "शनि "][d];
      return { open: false, en: `Closed · opens ${when}${at}`, hi: `अभी बंद है · ${whenHi}${at} को खुलेगा` };
    }
  }
  return { open: false, en: "Closed right now", hi: "अभी बंद है" };
}
/** A small live pill: a green dot and "Open now · until 11 pm", or "Closed · opens 11 am". Reserves its line before the clock is read. */
export function OpenPill({ rows, x, className = "" }: { rows: HoursRow[]; x: AdvCtx; className?: string }) {
  const now = useIst();
  const st = openStatus(rows, now);
  if (!rows.length) return null;
  if (now && !st) return null;
  return (
    <span className={`op-pill ${className}`} data-state={st ? (st.open ? "open" : "closed") : "wait"} role={st ? "status" : undefined} aria-hidden={st ? undefined : true}>
      <i aria-hidden="true" />{st ? (x.hi ? st.hi : st.en) : "Open now · until 11 pm"}
    </span>
  );
}

const dirOf = (v: NonNullable<SiteContent["visit"]>) => v.mapUrl || (v.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}` : "");
const visitTitle = (c: SiteContent, x: AdvCtx) => (c.city ? (x.hi ? `${c.city} में हमसे मिलें` : `Find us in ${c.city}`) : x.ui("Come and see us", "आइए, मिलिए"));
const tone = (index: number) => (index % 2 ? "alt" : "paper") as "alt" | "paper";

/** "Still have a question?" with the WhatsApp (else call) button: the way out of every FAQ variant. Nothing without a contact. */
function Ask({ c, x, lead = true }: { c: SiteContent; x: AdvCtx; lead?: boolean }) {
  if (!x.wa && !x.phone) return null;
  return (
    <div className="qa-ask">
      {lead && <p>{x.ui("Still have a question?", "कोई और सवाल है?")}</p>}
      {x.wa
        ? <Btn kind="ghost" href={x.waHref(x.hi ? `नमस्ते ${c.name}, मेरा एक सवाल है: ` : `Hi ${c.name}, I have a question: `)} external onClick={() => x.track("faq-ask")}><Icon name="whatsapp" /> {x.ui("Ask on WhatsApp", "WhatsApp पर पूछें")}</Btn>
        : <Btn kind="ghost" href={linkHref(x.phone!.type, x.phone!.value)} onClick={() => x.track("faq-call")}><Icon name="phone" /> {x.ui("Call us", "कॉल करें")}</Btn>}
    </div>
  );
}

/** One accordion panel: opens by sliding (rows 0fr -> 1fr), keeps closed content out of the tab order. */
function Panel({ id, labelledBy, children }: { id: string; labelledBy: string; children: React.ReactNode }) {
  return <div id={id} role="region" aria-labelledby={labelledBy} className="qa-panel"><div>{children}</div></div>;
}

/* ================= FAQ ================= */

/* ---------- numbered-accordion: a sticky title beside numbered questions that open one at a time ---------- */
export function FaqNumbered({ c, x, index }: VariantProps) {
  const [open, setOpen] = useState(0);
  const uid = useId();
  const items = c.faq;
  if (!items.length) return null;
  return (
    <Sec k="faq" tone={tone(index)}>
      <div className="qa-num">
        <div className="qa-side">
          <Head eyebrow="FAQ" title={x.ui("Questions, answered", "आपके सवाल, हमारे जवाब")} lede={x.ui("The things people ask us most.", "जो सवाल लोग सबसे ज़्यादा पूछते हैं।")} />
          <Ask c={c} x={x} />
        </div>
        <ul className="qa-list">
          {items.map((f, i) => {
            const on = open === i, id = `${uid}-${i}`;
            return (
              <li key={i} data-open={on ? "" : undefined}>
                <h3>
                  <button type="button" id={`${id}-b`} className="qa-btn" aria-expanded={on} aria-controls={`${id}-p`} onClick={() => setOpen(on ? -1 : i)}>
                    <span className="qa-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <span className="qa-q">{x.t(f.q)}</span>
                    <span className="qa-pm" aria-hidden="true" />
                  </button>
                </h3>
                <Panel id={`${id}-p`} labelledBy={`${id}-b`}><p>{x.t(f.a)}</p></Panel>
              </li>
            );
          })}
        </ul>
      </div>
    </Sec>
  );
}

/* ---------- two-column: every answer in view, as a pair of columns of cards ---------- */
export function FaqTwoColumn({ c, x, index }: VariantProps) {
  if (!c.faq.length) return null;
  return (
    <Sec k="faq" tone={tone(index)} wide>
      <Head eyebrow="FAQ" title={x.ui("Good to know before you ask", "पूछने से पहले जान लें")} />
      <div className="qa-two">
        {c.faq.map((f, i) => (
          <article key={i} className="adv-card adv-lift qa-card">
            <span className="qa-mark" aria-hidden="true">{x.ui("Q", "प्र")}</span>
            <h3>{x.t(f.q)}</h3>
            <p>{x.t(f.a)}</p>
          </article>
        ))}
      </div>
      <Ask c={c} x={x} />
    </Sec>
  );
}

/* ---------- searchable: a search box over the questions; matches open and are marked ---------- */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s: string) => s.normalize("NFC").toLocaleLowerCase();
function Hit({ text, re }: { text: string; re: RegExp | null }) {
  if (!re) return <>{text}</>;
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}
export function FaqSearch({ c, x, index }: VariantProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(-1);
  const uid = useId();
  const items = c.faq;
  if (!items.length) return null;
  // A search box over two or three questions is noise: below four the variant is a plain accordion.
  const searchable = items.length >= 4;
  const term = q.trim();
  const needle = fold(term);
  const searching = searchable && needle.length > 0;
  const re = searching ? new RegExp(`(${esc(term)})`, "i") : null;
  const shown = items.map((f, i) => ({ f, i, q: x.t(f.q), a: x.t(f.a) })).filter((r) => !searching || fold(`${r.q} ${r.a}`).includes(needle));
  return (
    <Sec k="faq" tone={tone(index)}>
      <Head eyebrow="FAQ" title={x.ui("Find your answer", "अपना जवाब ढूँढें")} lede={searchable ? x.ui("Type a word - a price, a timing, a service.", "कोई शब्द लिखें - दाम, समय, सेवा।") : undefined} />
      {searchable && (
        <div className="qa-find" role="search">
          <label htmlFor={`${uid}-s`} className="sr-only">{x.ui("Search the questions", "सवालों में खोजें")}</label>
          <Search size={20} aria-hidden="true" />
          <input
            id={`${uid}-s`} type="search" value={q} autoComplete="off" spellCheck={false} enterKeyHint="search"
            placeholder={x.ui("Search questions", "सवाल खोजें")}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
          />
          {q && <button type="button" className="qa-clear" onClick={() => setQ("")} aria-label={x.ui("Clear search", "खोज हटाएँ")}><X size={18} aria-hidden="true" /></button>}
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">{searching ? (shown.length ? x.ui(`${shown.length} answers found`, `${shown.length} जवाब मिले`) : x.ui("No answers found", "कोई जवाब नहीं मिला")) : ""}</p>
      {shown.length > 0 ? (
        <ul className="qa-s">
          {shown.map((r) => {
            const on = searching || open === r.i, id = `${uid}-${r.i}`;
            return (
              <li key={r.i} data-open={on ? "" : undefined}>
                <h3>
                  <button type="button" id={`${id}-b`} className="qa-btn qa-btn-s" aria-expanded={on} aria-controls={`${id}-p`} onClick={() => setOpen(open === r.i ? -1 : r.i)}>
                    <span className="qa-q"><Hit text={r.q} re={re} /></span>
                    <span className="qa-chev" aria-hidden="true"><Icon name="chevron-down" size={20} /></span>
                  </button>
                </h3>
                <Panel id={`${id}-p`} labelledBy={`${id}-b`}><p><Hit text={r.a} re={re} /></p></Panel>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="qa-empty">
          <p>{x.hi ? `“${term}” का जवाब हमारे पास अभी नहीं है।` : `We have no answer for “${term}” yet.`}</p>
          <Ask c={c} x={x} lead={false} />
        </div>
      )}
      {shown.length > 0 && <Ask c={c} x={x} />}
    </Sec>
  );
}

/* ---------- chat-bubble: each question as a message from the visitor, each answer a reply from the business ---------- */
export function FaqChat({ c, x, index }: VariantProps) {
  if (!c.faq.length) return null;
  const letter = Array.from(c.name)[0] ?? "";
  const open = x.wa ? { href: x.waHref(), ext: true } : x.phone ? { href: linkHref(x.phone.type, x.phone.value), ext: false } : null;
  return (
    <Sec k="faq" tone={tone(index)}>
      <div className="qa-chat">
        <Head eyebrow="FAQ" title={x.ui("Ask us anything", "कुछ भी पूछिए")} lede={x.ui("The questions we hear most, answered the way we would on a call.", "सबसे ज़्यादा पूछे जाने वाले सवाल, वैसे ही जवाब जैसे हम फ़ोन पर देते हैं।")} />
        <ol className="qa-thread">
          {c.faq.map((f, i) => (
            <li key={i}>
              <div className="qa-msg qa-me"><h3 className="qa-bub">{x.t(f.q)}</h3></div>
              <div className="qa-msg qa-them">
                <span className="qa-av" aria-hidden="true">{c.hm.logo ? <Pic src={c.hm.logo} alt="" w={36} /> : letter}</span>
                <p className="qa-bub">{x.t(f.a)}</p>
              </div>
            </li>
          ))}
        </ol>
        {open && (
          <a className="qa-compose" href={open.href} {...(open.ext ? { target: "_blank", rel: "noreferrer" } : {})} onClick={() => x.track("faq-compose")}>
            <span>{x.ui("Type your own question…", "अपना सवाल लिखिए…")}</span>
            <b aria-hidden="true"><Icon name="arrow-right" size={18} /></b>
            <span className="sr-only">{x.wa ? x.ui("Opens WhatsApp", "WhatsApp खुलेगा") : x.ui("Calls the business", "कॉल लगेगी")}</span>
          </a>
        )}
      </div>
    </Sec>
  );
}

/* ================= VISIT ================= */

function HoursTable({ rows, x, today, className = "" }: { rows: HoursRow[]; x: AdvCtx; today: number | null; className?: string }) {
  const at = todayRow(rows, today);
  return (
    <table className={`vz-hours ${className}`}>
      <caption className="sr-only">{x.ui("Opening hours", "खुलने का समय")}</caption>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} data-today={i === at ? "" : undefined}>
            <th scope="row">{x.t(r.day)}{i === at && <em>{x.ui("Today", "आज")}</em>}</th>
            <td>{x.t(r.time)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A quiet street-map drawing (no tiles, no third-party request): roads in paper over the accent wash, one pin. */
export function MapArt() {
  return (
    <svg className="vz-map" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className="bg" width="400" height="300" />
      <g className="bl"><rect x="78" y="20" width="70" height="52" rx="4" /><rect x="168" y="150" width="60" height="70" rx="4" /><rect x="296" y="34" width="72" height="60" rx="4" /><rect x="20" y="170" width="52" height="64" rx="4" /><rect x="318" y="180" width="62" height="50" rx="4" /><rect x="120" y="236" width="80" height="44" rx="4" /></g>
      <g className="rd">
        <path d="M-10 224 C 90 184, 160 244, 262 152 S 380 92, 420 62" strokeWidth="15" />
        <path d="M62 -10 L 112 310" strokeWidth="10" />
        <path d="M-10 94 L 420 134" strokeWidth="9" />
        <path d="M252 -10 L 304 310" strokeWidth="7" />
        <path d="M-10 272 L 420 244" strokeWidth="6" />
        <path d="M168 -10 L 176 120" strokeWidth="5" />
      </g>
    </svg>
  );
}

/* ---------- map-hours: a map card with the address under it, beside a timings table ---------- */
export function VisitMapHours({ c, x, index }: VariantProps) {
  const today = useToday();
  const v = c.visit;
  if (!v) return null;
  const dir = dirOf(v);
  if (!v.address && !dir && !v.hours.length) return null;
  const hasMap = !!(v.address || dir);
  const cap = (
    <span className="vz-cap">
      <span className="vz-addr">{v.address ? <><Icon name="pin" size={20} /><span>{x.t(v.address)}</span></> : <span>{x.ui("Find us on the map", "नक्शे पर हमें ढूँढें")}</span>}</span>
      {dir && <span className="btn-link">{x.ui("Open in Maps", "Maps में खोलें")} <Icon name="arrow-up-right" /></span>}
    </span>
  );
  const art = <span className="vz-art"><MapArt /><span className="vz-pin"><Icon name="pin" size={24} strokeWidth={1.8} /></span></span>;
  return (
    <Sec k="visit" tone={tone(index)} wide>
      <Head eyebrow={x.ui("Visit us", "हमसे मिलें")} title={visitTitle(c, x)} />
      <div className="vz-mh" data-solo={v.hours.length || !hasMap ? undefined : ""}>
        {hasMap && (dir
          ? <a className="vz-mapcard" href={dir} target="_blank" rel="noreferrer" onClick={() => x.track("visit-directions")} aria-label={`${x.ui("Get directions", "रास्ता देखें")}${v.address ? `: ${x.t(v.address)}` : ""}`}>{art}{cap}</a>
          : <div className="vz-mapcard">{art}{cap}</div>)}
        {v.hours.length > 0 && (
          <div className="adv-card vz-hoursbox">
            <p className="kicker">{x.ui("Timings", "समय")}</p>
            <OpenPill rows={v.hours} x={x} />
            <HoursTable rows={v.hours} x={x} today={today} />
            {x.phone && <Btn kind="ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("visit-call")}><Icon name="phone" /> {x.ui("Call before you come", "आने से पहले कॉल करें")}</Btn>}
          </div>
        )}
      </div>
    </Sec>
  );
}

/* ---------- hours-timeline: the timings first, as a rail with today lit, and where to go beside it ---------- */
export function VisitTimeline({ c, x, index }: VariantProps) {
  const today = useToday();
  const v = c.visit;
  if (!v) return null;
  const dir = dirOf(v);
  const hasWhere = !!(v.address || dir || x.phone);
  if (!v.hours.length && !hasWhere) return null;
  const at = todayRow(v.hours, today);
  return (
    <Sec k="visit" tone={tone(index)} wide>
      <div className="vz-tlw" data-solo={v.hours.length && hasWhere ? undefined : ""}>
        <div>
          <Head eyebrow={v.hours.length ? x.ui("Timings", "समय") : x.ui("Visit us", "हमसे मिलें")} title={v.hours.length ? x.ui("When to find us", "हम कब मिलेंगे") : visitTitle(c, x)} />
          {v.hours.length > 0 && <OpenPill rows={v.hours} x={x} className="vz-tl-open" />}
          {v.hours.length > 0 && (
            <ol className="vz-tl" aria-label={x.ui("Opening hours", "खुलने का समय")}>
              {v.hours.map((r, i) => (
                <li key={i} data-today={i === at ? "" : undefined}>
                  <span className="vz-day">{x.t(r.day)}{i === at && <em>{x.ui("Today", "आज")}</em>}</span>
                  <span className="vz-time">{x.t(r.time)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {hasWhere && (
          <aside className="vz-where hero-dark" aria-label={x.ui("Where to find us", "हम कहाँ हैं")}>
            <p className="kicker">{x.ui("Find us", "यहाँ आइए")}</p>
            {v.address && <address className="vz-where-addr">{x.t(v.address)}</address>}
            {!v.address && c.city && <p className="vz-where-addr">{c.city}</p>}
            <div className="vz-where-btns">
              {dir && <Btn href={dir} external onClick={() => x.track("visit-directions")}><Icon name="directions" /> {x.ui("Get directions", "रास्ता देखें")}</Btn>}
              {x.phone && <Btn kind="ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("visit-call")}><Icon name="phone" /> {x.ui("Call", "कॉल करें")}</Btn>}
            </div>
          </aside>
        )}
      </div>
    </Sec>
  );
}

/* ---------- address-poster: the address set as a poster on the ink field, the timings as chips ---------- */
/** "Shop 12, Main Market, Rewari, Haryana 123401" -> at most four lines, the tail folded into the last. */
function posterLines(address: string): string[] {
  const parts = address.split(/\s*[,\n]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 4) return parts;
  return [...parts.slice(0, 3), parts.slice(3).join(", ")];
}
export function VisitPoster({ c, x }: VariantProps) {
  const today = useToday();
  const v = c.visit;
  if (!v) return null;
  const dir = dirOf(v);
  if (!v.address && !dir && !v.hours.length) return null;
  const lines = posterLines(x.t(v.address));
  const at = todayRow(v.hours, today);
  return (
    <Sec k="visit" tone="ink" wide>
      <div className="vz-poster">
        <p className="kicker">{c.city ? (x.hi ? `${c.city} में हमसे मिलें` : `Visit us · ${c.city}`) : x.ui("Visit us", "हमसे मिलें")}</p>
        {lines.length > 0
          ? <address className="vz-lines" data-long={lines.join("").length > 90 ? "" : undefined}>{lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 ? "," : ""}</span>)}</address>
          : <h2 className="vz-lines"><span>{visitTitle(c, x)}</span></h2>}
        <div className="vz-poster-foot">
          {dir && (
            <a className="vz-go" href={dir} target="_blank" rel="noreferrer" onClick={() => x.track("visit-directions")}>
              <b aria-hidden="true"><Icon name="arrow-up-right" size={28} strokeWidth={1.6} /></b>
              <span>{x.ui("Get directions", "रास्ता देखें")}</span>
            </a>
          )}
          {v.hours.length > 0 && (
            <ul className="vz-chips" aria-label={x.ui("Opening hours", "खुलने का समय")}>
              {v.hours.map((r, i) => <li key={i} data-today={i === at ? "" : undefined}><b>{x.t(r.day)}</b> {x.t(r.time)}{i === at && <em className="sr-only"> ({x.ui("today", "आज")})</em>}</li>)}
            </ul>
          )}
        </div>
      </div>
    </Sec>
  );
}

/* ---------- branch-list: every place the business has, as ruled rows with their own buttons ---------- */
type Branch = { name: string; address: string; dir: string };
function branchesOf(c: SiteContent, x: AdvCtx): Branch[] {
  const hidden = new Set(x.card.site?.hidden ?? []);
  const out: Branch[] = [];
  for (const p of x.card.pages) {
    if (p.hidden || hidden.has(p.slug)) continue;
    for (const b of p.blocks) {
      if (b.kind !== "location") continue;
      const address = (b.address ?? "").trim();
      const map = /^https?:\/\//i.test((b.mapUrl ?? "").trim()) ? (b.mapUrl ?? "").trim() : "";
      if (!address && !map) continue;
      const dir = map || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      if (out.some((o) => o.address === address && o.dir === dir)) continue;
      out.push({ name: (b.title ?? "").trim(), address, dir });
    }
  }
  if (!out.length && c.visit && (c.visit.address || c.visit.mapUrl)) out.push({ name: "", address: c.visit.address, dir: dirOf(c.visit) });
  return out.slice(0, 8);
}
export function VisitBranches({ c, x, index }: VariantProps) {
  const today = useToday();
  const v = c.visit;
  if (!v) return null;
  const branches = branchesOf(c, x);
  if (!branches.length && !v.hours.length) return null;
  const many = branches.length > 1;
  const at = todayRow(v.hours, today);
  return (
    <Sec k="visit" tone={tone(index)} wide>
      <Head eyebrow={x.ui("Visit us", "हमसे मिलें")} title={many ? x.ui(`${branches.length} places to find us`, `हमारी ${branches.length} जगहें`) : visitTitle(c, x)} />
      {branches.length > 0 && (
        <ol className="vz-br">
          {branches.map((b, i) => (
            <li key={i}>
              <span className="vz-br-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div className="vz-br-txt">
                <h3>{b.name ? x.t(b.name) : many ? `${x.t(c.name)} · ${i + 1}` : x.t(c.name)}</h3>
                {b.address ? <address>{x.t(b.address)}</address> : <address>{x.ui("Open the map for the exact spot.", "सही जगह के लिए नक्शा खोलें।")}</address>}
              </div>
              <div className="vz-br-act">
                <Btn kind="ghost" className="vz-sm" href={b.dir} external onClick={() => x.track("visit-directions")}><Icon name="directions" /> {x.ui("Directions", "रास्ता")}</Btn>
                {x.phone && <Btn kind="link" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("visit-call")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</Btn>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {v.hours.length > 0 && (
        <div className="vz-brh">
          <p className="kicker">{many ? x.ui("Timings, all branches", "समय, सभी जगह") : x.ui("Timings", "समय")}</p>
          <ul className="vz-hgrid">
            {v.hours.map((r, i) => (
              <li key={i} data-today={i === at ? "" : undefined}>
                <span>{x.t(r.day)}{i === at && <em>{x.ui("Today", "आज")}</em>}</span>
                <b>{x.t(r.time)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sec>
  );
}

/* ================= CTA ================= */

/** The one primary action: WhatsApp (the owner's own button label when set), else a call. Null with no contact. */
export function mainAction(c: SiteContent, x: AdvCtx) {
  if (x.wa) {
    const own = (x.card.site?.hero?.ctaLabel ?? "").trim();
    const label = own || (c.hm.primary.kind === "whatsapp" ? c.hm.primary.label : x.ui("Chat on WhatsApp", "WhatsApp पर बात करें"));
    return { href: x.waHref(), label: x.t(label), icon: "whatsapp" as const, ext: true, id: "whatsapp" };
  }
  if (x.phone) return { href: linkHref(x.phone.type, x.phone.value), label: x.ui("Call us", "कॉल करें"), icon: "phone" as const, ext: false, id: "phone" };
  return null;
}
/** The line under a closing title: the owner's tagline, else a sentence true for the contact the page has. */
export const ctaLede = (x: AdvCtx) => (x.card.tagline ?? "").trim()
  ? x.t(x.card.tagline)
  : x.wa ? x.ui("Usually replies within a few hours on WhatsApp.", "आमतौर पर कुछ घंटों में WhatsApp पर जवाब।") : x.ui("Call us - we are glad to help.", "हमें कॉल करें - हमें मदद करके ख़ुशी होगी।");
/** The call button, only when WhatsApp leads (otherwise the call is already the primary one). */
function CallBtn({ x, kind = "ghost", where }: { x: AdvCtx; kind?: "ghost" | "link"; where: string }) {
  if (!x.wa || !x.phone) return null;
  return <Btn kind={kind} href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track(`${where}-phone`)}><Icon name="phone" /> {x.ui("Call", "कॉल करें")}</Btn>;
}
function MainBtn({ c, x, where }: { c: SiteContent; x: AdvCtx; where: string }) {
  const a = mainAction(c, x);
  if (!a) return null;
  return <Btn href={a.href} {...(a.ext ? { external: true } : {})} data-kind={a.id} onClick={() => x.track(`${where}-${a.id}`)}><Icon name={a.icon} /> {a.label}</Btn>;
}
/** Which sections the page draws, in the spec's order: a variant that joins the footer needs to know whether it is the last. */
function drawnKeys(c: SiteContent, x: AdvCtx, spec: VariantProps["spec"]): SectionKey[] {
  const contact = !!(x.wa || x.phone);
  return spec.order.filter((k) => k !== "footer" && sectionHasContent(k, c, contact));
}

/* ---------- wide-band: a full-bleed accent field, a very large line, the ways to reach in ruled rows ---------- */
type Row = { id: string; type: string; label: string; text: string; href: string; ext: boolean };
function reachRows(x: AdvCtx): Row[] {
  const digits = (s: string) => (s ?? "").replace(/\D/g, "").slice(-10);
  const same = !!x.wa && !!x.phone && digits(x.wa.value) === digits(x.phone.value);
  const rows: Row[] = [];
  for (const l of x.card.links) {
    const v = l.value.trim();
    if (!v) continue;
    if (l.type === "whatsapp") rows.push({ id: l.id, type: l.type, label: same ? x.ui("WhatsApp & call", "WhatsApp और कॉल") : "WhatsApp", text: prettyPhone(v), href: x.waHref(), ext: true });
    else if (l.type === "phone" && !same) rows.push({ id: l.id, type: l.type, label: x.ui("Call", "कॉल"), text: prettyPhone(v), href: linkHref(l.type, v), ext: false });
    else if (l.type === "email") rows.push({ id: l.id, type: l.type, label: x.ui("Email", "ईमेल"), text: v, href: linkHref(l.type, v), ext: false });
  }
  return rows.slice(0, 3);
}
export function CtaWideBand({ c, x }: VariantProps) {
  if (!mainAction(c, x)) return null;
  const rows = reachRows(x);
  return (
    <section id="adv-cta" data-sec="cta" data-tone="paper" data-reveal className="adv-sec cx-wide">
      <div className="adv-wrap adv-wide cx-wide-in">
        <div className="cx-wide-head">
          <p className="kicker">{x.ui("Get in touch", "संपर्क करें")}</p>
          <h2 className="adv-display">{x.ui("Let's talk.", "बात करते हैं।")}</h2>
        </div>
        <div className="cx-wide-side">
          <p className="adv-lede">{ctaLede(x)}</p>
          <div className="adv-btn-row"><MainBtn c={c} x={x} where="cta" /><CallBtn x={x} kind="link" where="cta" /></div>
        </div>
        {rows.length > 0 && (
          <ul className="cx-rows">
            {rows.map((r) => (
              <li key={r.id}>
                <a href={r.href} {...(r.ext ? { target: "_blank", rel: "noreferrer" } : {})} onClick={() => x.track(`cta-row-${r.type}`)}>
                  <small>{r.label}</small><span>{r.text}</span><Icon name="arrow-up-right" size={22} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- floating-card: an accent card straddling the page and the footer, a photo beside the words ---------- */
export function CtaFloatingCard({ c, x, spec }: VariantProps) {
  if (!mainAction(c, x)) return null;
  const drawn = drawnKeys(c, x, spec);
  const last = drawn[drawn.length - 1] === "cta";
  const photo = c.photos[1] ?? c.photos[0];
  return (
    <section id="adv-cta" data-sec="cta" data-tone="paper" data-reveal className="adv-sec cx-float" data-last={last ? "" : undefined}>
      <div className="adv-wrap adv-wide">
        <div className="cx-fc" data-photo={photo ? "" : undefined}>
          <div className="cx-fc-body">
            <p className="kicker">{x.ui("Say hello", "नमस्ते कहिए")}</p>
            <h2 className="adv-h2">{x.ui("Ready when you are", "आप जब कहें, हम तैयार हैं")}</h2>
            <p className="adv-lede">{ctaLede(x)}</p>
            <div className="adv-btn-row"><MainBtn c={c} x={x} where="cta" /><CallBtn x={x} where="cta" /></div>
          </div>
          {photo && <div className="cx-fc-photo" aria-hidden="true"><Photo src={photo} sizes="(min-width: 900px) 36vw, 0px" /></div>}
        </div>
      </div>
    </section>
  );
}

/* ---------- split-qr: the words and buttons on one side, the site's QR on a card on the other ---------- */
export function CtaSplitQr({ c, x, index }: VariantProps) {
  if (!mainAction(c, x)) return null;
  const { card } = x;
  return (
    <Sec k="cta" tone={tone(index)} wide>
      <div className="cx-qr" data-qr={x.qr ? "" : undefined}>
        <div>
          <p className="kicker">{x.ui("Keep us close", "हमें पास रखिए")}</p>
          <h2 className="adv-h2 mt-3">{x.ui("Take us with you", "हमें अपने साथ ले जाइए")}</h2>
          <p className="adv-lede">{ctaLede(x)}</p>
          <div className="adv-btn-row cx-qr-btns"><MainBtn c={c} x={x} where="cta" /><CallBtn x={x} where="cta" /></div>
        </div>
        {x.qr && (
          <div className="adv-card cx-qr-card">
            <Pic src={x.qr} alt={x.ui("QR code that opens this website", "QR कोड, जो यह वेबसाइट खोलता है")} className="cx-qr-img" w={168} />
            <div className="cx-qr-txt">
              <p>{x.ui("Scan to open this site on your phone", "फ़ोन पर यह साइट खोलने के लिए स्कैन करें")}</p>
              {x.shareUrl && <p className="mono cx-qr-url">{x.shareUrl.replace(/^https?:\/\//, "")}</p>}
              <a href={`/c/${card.username}/vcf`} className="btn-ghost vz-sm" onClick={() => x.track("vcard")}><Download size={16} aria-hidden="true" /> {x.ui("Save contact", "कॉन्टैक्ट सेव करें")}</a>
            </div>
          </div>
        )}
      </div>
    </Sec>
  );
}

/* ---------- sticky-ribbon: a closing block, and a slim ribbon that follows the visitor down a wide screen until it is reached ---------- */
export function CtaRibbon({ c, x, index }: VariantProps) {
  const [past, setPast] = useState(false);
  const [reached, setReached] = useState(false);
  const act = mainAction(c, x);
  useEffect(() => {
    const on = () => setPast(window.scrollY > (window.innerHeight || 800) * 0.8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // The ribbon steps aside once the closing block it repeats is on screen (or already passed).
  useEffect(() => {
    const el = document.getElementById("adv-cta");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e) setReached(e.isIntersecting || e.boundingClientRect.top < 0); });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (!act) return null;
  return (
    <>
      {/* Always on paper: the footer under it is dark, and a dark closing block ran into it as one slab (owner, 20 Oct 2026). */}
      <Sec k="cta" tone="paper">
        <div className="cx-end">
          <p className="kicker">{x.ui("Get in touch", "संपर्क करें")}</p>
          <h2 className="adv-h2 mt-3">{x.ui("Talk to us today", "आज ही बात करें")}</h2>
          <p className="adv-lede">{ctaLede(x)}</p>
          <div className="adv-btn-row cx-end-btns"><MainBtn c={c} x={x} where="cta" /><CallBtn x={x} kind="link" where="cta" /></div>
        </div>
      </Sec>
      <div className="cx-rib" data-on={past && !reached ? "" : undefined} aria-hidden={past && !reached ? undefined : true}>
        <div className="cx-rib-bar">
          <p>{(x.card.tagline ?? "").trim() ? x.t(x.card.tagline) : x.ui(`Questions? ${c.name} is a message away.`, `सवाल है? ${c.name} बस एक मैसेज दूर है।`)}</p>
          <div className="adv-btn-row">
            <Btn href={act.href} {...(act.ext ? { external: true } : {})} className="vz-sm" onClick={() => x.track(`ribbon-${act.id}`)}><Icon name={act.icon} /> {act.label}</Btn>
            {x.wa && x.phone && <Btn kind="link" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("ribbon-phone")}><Icon name="phone" /> {x.phone.value}</Btn>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= FOOTER ================= */

const NAV_LABEL: Partial<Record<SectionKey, [string, string]>> = {
  about: ["About", "हमारे बारे में"], services: ["Products", "प्रोडक्ट"], gallery: ["Gallery", "फ़ोटो"], proof: ["Reviews", "रिव्यू"],
  process: ["How it works", "कैसे काम करते हैं"], faq: ["FAQ", "सवाल"], visit: ["Visit", "पता"], cta: ["Contact", "संपर्क"],
};
type Item = { id: string; type: LinkType; label: string; text: string; href: string; ext: boolean; note?: string };
type Social = { id: string; type: LinkType; label: string; href: string };
type QuickLink = { key: string; label: string; href: string; slug?: string };
type FooterModel = { quick: QuickLink[]; contact: Item[]; social: Social[]; address: string; dir: string; hours: HoursRow[]; blurb: string };

/** A social link's address: a full link as written, a bare domain given https, a bare handle sent to the platform. Anything
 *  else (a javascript: link, a stray word) is dropped rather than rendered. */
export function socialHref(type: LinkType, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return "";
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(v)) return `https://${v}`;
  const h = v.replace(/^@/, "");
  if (!/^[\w.-]+$/.test(h)) return "";
  return type === "instagram" ? `https://instagram.com/${h}` : type === "facebook" ? `https://facebook.com/${h}` : type === "youtube" ? `https://youtube.com/@${h}` : type === "linkedin" ? `https://linkedin.com/in/${h}` : "";
}
export const SOCIAL_NAME: Partial<Record<LinkType, string>> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", website: "Website" };

function footerModel(c: SiteContent, x: AdvCtx, spec: VariantProps["spec"]): FooterModel {
  const drawn = drawnKeys(c, x, spec);
  // The real pages of the website when the shell gives them (owner, 16 Oct 2026: a footer of #anchors was a one-page site's footer);
  // a bare section list otherwise (the editor's single-page preview).
  const pages = (x as Partial<AdvCtxPlus>).pages;
  const quick: QuickLink[] = pages?.list.length
    ? pages.list.map((e) => ({ key: e.slug, slug: e.slug, href: e.href, label: e.role === "home" ? x.ui("Home", "होम") : e.owner ? x.t(e.label) : e.label }))
    : [
      { key: "top", label: x.ui("Home", "होम"), href: "#" },
      ...drawn.filter((k) => NAV_LABEL[k]).map((k) => {
        const [en, h] = NAV_LABEL[k]!;
        return { key: k as string, href: `#adv-${k}`, label: k === "services" && c.offerings?.kind === "services" ? x.ui("Services", "सेवाएँ") : x.ui(en, h) };
      }),
    ];
  const links = x.card.links.filter((l) => l.value.trim());
  const digits = (s: string) => (s ?? "").replace(/\D/g, "").slice(-10);
  const same = !!x.wa && !!x.phone && digits(x.wa.value) === digits(x.phone.value);
  const contact: Item[] = [];
  for (const l of links) {
    const v = l.value.trim();
    if (l.type === "whatsapp") contact.push({ id: l.id, type: l.type, label: "WhatsApp", text: prettyPhone(v), href: x.waHref(), ext: true, note: same ? x.ui("WhatsApp & call", "WhatsApp और कॉल") : undefined });
    else if (l.type === "phone" && !same) contact.push({ id: l.id, type: l.type, label: x.ui("Call", "कॉल"), text: prettyPhone(v), href: linkHref(l.type, v), ext: false });
    else if (l.type === "email") contact.push({ id: l.id, type: l.type, label: x.ui("Email", "ईमेल"), text: v, href: linkHref(l.type, v), ext: false });
    // upi:// does nothing in a desktop browser: the ID is shown as text, without a link.
    else if (l.type === "upi") contact.push({ id: l.id, type: l.type, label: "UPI", text: v, href: "", ext: false });
  }
  const social: Social[] = [];
  for (const l of links) {
    if (!SOCIAL_NAME[l.type]) continue;
    const href = socialHref(l.type, l.value);
    if (href) social.push({ id: l.id, type: l.type, label: SOCIAL_NAME[l.type]!, href });
  }
  const v = c.visit;
  const blurb = (x.card.tagline ?? "").trim() || (x.card.about ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  return { quick, contact, social, address: v?.address ?? "", dir: v ? dirOf(v) : "", hours: v?.hours ?? [], blurb };
}

function FtLogo({ c, x }: { c: SiteContent; x: AdvCtx }) {
  // No logo: the name set in the display face, with the trade as a light line (the shared Wordmark's second line was lost on the ink field).
  return c.hm.logo
    ? <Pic src={c.hm.logo} alt={x.t(c.name)} className="ft-logo" w={180} />
    : <p className="ft-name"><b>{x.t(c.name)}</b>{c.trade && <small>{x.t(c.trade)}</small>}</p>;
}
/** One footer link: a real page opens through the shell (curtain, scroll to top), a section anchor scrolls. */
function quickClick(q: QuickLink, x: AdvCtx) {
  return (e: React.MouseEvent) => {
    x.track(`footer-nav-${q.key}`);
    if (q.slug && x.goto) { e.preventDefault(); x.goto(q.slug); }
    else if (!q.slug) { e.preventDefault(); x.jump(q.key); }
  };
}
function FtQuick({ m, x, className = "" }: { m: FooterModel; x: AdvCtx; className?: string }) {
  if (m.quick.length < 2) return null;
  return (
    <nav aria-label={x.ui("Pages", "पेज")} className={className}>
      <ul className="ft-list">
        {m.quick.map((q) => <li key={q.key}><a href={q.href} onClick={quickClick(q, x)}>{q.label}</a></li>)}
      </ul>
    </nav>
  );
}
function FtContact({ m, x, className = "" }: { m: FooterModel; x: AdvCtx; className?: string }) {
  if (!m.contact.length) return null;
  return (
    <ul className={`ft-list ft-contact ${className}`}>
      {m.contact.map((i) => (
        <li key={i.id}>
          {i.href
            ? <a href={i.href} {...(i.ext ? { target: "_blank", rel: "noreferrer" } : {})} onClick={() => x.track(`footer-${i.type}`)}><LinkIcon type={i.type} className="h-4 w-4" /><span>{i.text}</span>{i.note && <small>· {i.note}</small>}</a>
            : <span className="ft-plain"><LinkIcon type={i.type} className="h-4 w-4" /><span>{i.text}</span></span>}
        </li>
      ))}
    </ul>
  );
}
function FtSocial({ m, x }: { m: FooterModel; x: AdvCtx }) {
  if (!m.social.length) return null;
  return (
    <ul className="ft-soc" aria-label={x.ui("Follow us", "हमें फ़ॉलो करें")}>
      {m.social.map((s) => (
        <li key={s.id}><a href={s.href} target="_blank" rel="noreferrer noopener" aria-label={s.label} title={s.label} onClick={() => x.track(`footer-${s.type}`)}><LinkIcon type={s.type} className="h-4 w-4" /></a></li>
      ))}
    </ul>
  );
}
function FtVisit({ m, x }: { m: FooterModel; x: AdvCtx }) {
  if (!m.address && !m.hours.length && !m.dir) return null;
  return (
    <div>
      <p className="kicker ft-h">{x.ui("Visit us", "हमसे मिलें")}</p>
      {m.hours.length > 0 && <OpenPill rows={m.hours} x={x} className="ft-open" />}
      {m.address && <address className="ft-addr">{x.t(m.address)}</address>}
      {m.dir && <a className="btn-link ft-dir" href={m.dir} target="_blank" rel="noreferrer" onClick={() => x.track("footer-directions")}>{x.ui("Get directions", "रास्ता देखें")} <Icon name="arrow-up-right" /></a>}
      {m.hours.length > 0 && (
        <table className="ft-hours">
          <caption className="sr-only">{x.ui("Opening hours", "खुलने का समय")}</caption>
          <tbody>{m.hours.map((r, i) => <tr key={i}><th scope="row">{x.t(r.day)}</th><td>{x.t(r.time)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
/** The closing line of every footer. The copyright wording and the "Powered by" line are the same in all four variants. */
function Legal({ c, x }: { c: SiteContent; x: AdvCtx }) {
  return (
    <div className="ft-legal-wrap">
      <div className="adv-wrap adv-wide ft-legal">
        <span>© {new Date().getFullYear()} {x.t(c.name)}. {x.hi ? "सर्वाधिकार सुरक्षित।" : "All rights reserved."}</span>
        <button type="button" className="ft-top" onClick={() => x.jump("top")}><Icon name="arrow-right" size={14} className="ft-up" /> {x.ui("Back to top", "ऊपर जाएँ")}</button>
        <span className="mono">{x.brand ? (x.brand.hideBranding ? "" : `Powered by ${x.brand.name}`) : "Powered by Shubhora"}</span>
      </div>
    </div>
  );
}
const gstin = (x: AdvCtx) => (x.card.gstin ?? "").trim();

/* ---------- mega: brand and social, quick links, contact, then address and timings ---------- */
export function FooterMega({ c, x, spec }: VariantProps) {
  const m = footerModel(c, x, spec);
  const { card } = x;
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark ft">
      <div className="adv-wrap adv-wide ft-mega">
        <div className="ft-brand">
          <FtLogo c={c} x={x} />
          {m.blurb && <p className="ft-blurb">{x.t(m.blurb)}</p>}
          <FtSocial m={m} x={x} />
          {gstin(x) && <p className="ft-small mono">GSTIN {gstin(x)}</p>}
          {x.qr && (
            <div className="ft-qr">
              <Pic src={x.qr} alt={x.ui("QR code that opens this website", "QR कोड, जो यह वेबसाइट खोलता है")} className="ft-qrimg" w={72} />
              <div>
                <p className="ft-small">{x.ui("Scan to open this site on your phone", "फ़ोन पर यह साइट खोलने के लिए स्कैन करें")}</p>
                <div className="adv-btn-row">
                  <a href={`/c/${card.username}/vcf`} className="btn-ghost ft-xs" onClick={() => x.track("vcard")}><Download size={14} aria-hidden="true" /> {x.ui("Save contact", "कॉन्टैक्ट सेव करें")}</a>
                  <a href="?view=card" className="btn-ghost ft-xs">{x.ui("Digital card", "डिजिटल कार्ड")}</a>
                </div>
              </div>
            </div>
          )}
        </div>
        <div><p className="kicker ft-h">{x.ui("Explore", "देखें")}</p><FtQuick m={m} x={x} /></div>
        {m.contact.length > 0 && <div><p className="kicker ft-h">{x.ui("Contact", "संपर्क")}</p><FtContact m={m} x={x} /></div>}
        <FtVisit m={m} x={x} />
      </div>
      <Legal c={c} x={x} />
    </footer>
  );
}

/* ---------- minimal: one quiet row of name, links and social, one line of contact and timings ---------- */
export function FooterMinimal({ c, x, spec }: VariantProps) {
  const m = footerModel(c, x, spec);
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark ft ft-min">
      <div className="adv-wrap adv-wide">
        <div className="ft-min-row">
          <FtLogo c={c} x={x} />
          <FtQuick m={m} x={x} className="ft-nav-in" />
          <FtSocial m={m} x={x} />
        </div>
        <div className="ft-min-mid">
          <FtContact m={m} x={x} className="ft-inline" />
          {(m.address || m.dir) && (
            <p className="ft-min-addr">
              <Icon name="pin" size={16} />
              {m.address ? <span>{x.t(m.address)}</span> : null}
              {m.dir && <a href={m.dir} target="_blank" rel="noreferrer" onClick={() => x.track("footer-directions")}>{x.ui("Directions", "रास्ता")}</a>}
            </p>
          )}
          {m.hours.length > 0 && (
            <p className="ft-min-hrs">
              <Icon name="clock" size={16} />
              <span className="sr-only">{x.ui("Opening hours", "खुलने का समय")}: </span>
              {m.hours.map((r, i) => <span key={i}>{x.t(r.day)} <b>{x.t(r.time)}</b></span>)}
            </p>
          )}
          {gstin(x) && <p className="ft-small mono">GSTIN {gstin(x)}</p>}
        </div>
      </div>
      <Legal c={c} x={x} />
    </footer>
  );
}

/* ---------- big-wordmark: three compact columns, then the business's name as a very large mark ---------- */
export function FooterBigWordmark({ c, x, spec }: VariantProps) {
  const m = footerModel(c, x, spec);
  const name = x.t(c.name);
  const len = Math.max(6, Array.from(name).length);
  // Sized so the name fits one line in the container: viewport-relative on a phone, capped in px on a wide screen.
  const vars = { "--wm": `${(146 / len).toFixed(2)}vw`, "--wmx": `${Math.round(2120 / len)}px` } as React.CSSProperties;
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark ft">
      <div className="adv-wrap adv-wide">
        <div className="ft-bw">
          <div className="ft-bw-lead">
            {m.blurb && <p className="ft-blurb">{x.t(m.blurb)}</p>}
            <FtSocial m={m} x={x} />
          </div>
          <div><p className="kicker ft-h">{x.ui("Explore", "देखें")}</p><FtQuick m={m} x={x} /></div>
          {m.contact.length > 0 && <div><p className="kicker ft-h">{x.ui("Contact", "संपर्क")}</p><FtContact m={m} x={x} /></div>}
          <FtVisit m={m} x={x} />
        </div>
        <FitName text={name} className="ft-wm" style={vars} />
        {gstin(x) && <p className="ft-small mono ft-gst">GSTIN {gstin(x)}</p>}
      </div>
      <Legal c={c} x={x} />
    </footer>
  );
}

/* ---------- link-grid: the footer as a grid of tiles - links, ways to reach, the address, the timings ---------- */
export function FooterLinkGrid({ c, x, spec }: VariantProps) {
  const m = footerModel(c, x, spec);
  const quick = m.quick;
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark ft">
      <div className="adv-wrap adv-wide ft-lg">
        <div className="ft-tile ft-t-brand">
          <FtLogo c={c} x={x} />
          {m.blurb && <p className="ft-blurb">{x.t(m.blurb)}</p>}
          <FtSocial m={m} x={x} />
        </div>
        {quick.length > 1 && (
          <nav className="ft-t-nav" aria-label={x.ui("Quick links", "क्विक लिंक")}>
            {quick.map((q) => (
              <a key={q.key} className="ft-tile ft-link" href={q.href} onClick={quickClick(q, x)}>
                <span>{q.label}</span><Icon name="arrow-up-right" size={20} />
              </a>
            ))}
          </nav>
        )}
        {m.contact.map((i) => {
          const body = (<><small>{i.note ?? i.label}</small><span className="ft-val"><LinkIcon type={i.type} className="h-4 w-4" />{i.text}</span></>);
          return i.href
            ? <a key={i.id} className="ft-tile ft-link ft-t-contact" href={i.href} {...(i.ext ? { target: "_blank", rel: "noreferrer" } : {})} onClick={() => x.track(`footer-${i.type}`)}>{body}</a>
            : <div key={i.id} className="ft-tile ft-t-contact">{body}</div>;
        })}
        {(m.address || m.hours.length > 0 || m.dir) && (
          <div className="ft-tile ft-t-visit"><FtVisit m={m} x={x} /></div>
        )}
        {gstin(x) && <p className="ft-small mono ft-t-gst">GSTIN {gstin(x)}</p>}
      </div>
      <Legal c={c} x={x} />
    </footer>
  );
}



/** The business's name set so it spans its box exactly (owner, 16 Oct 2026: a "very large name" that stops short of the edge looks
 *  unfinished). Measured in the browser, once fonts are in and on every resize; until then the CSS size from the name's length shows. */
function FitName({ text, className, style }: { text: string; className: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner || !el.clientWidth) return;
      el.style.fontSize = "100px";
      const w = inner.getBoundingClientRect().width;
      if (w > 0) el.style.fontSize = `${Math.min(340, Math.max(28, (100 * el.clientWidth * 0.985) / w)).toFixed(1)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text]);
  return <p ref={ref} className={className} style={style} aria-hidden="true"><span>{text}</span></p>;
}

/* ---------- atelier: a ticker of what we do, the name set very large on top, then the columns ---------- */
/** The words that run along the ticker: what the business sells (its own items), else its tagline and trade. */
function tickerWords(c: SiteContent, x: AdvCtx): string[] {
  const items = (c.offerings?.items ?? []).map((o) => x.t(o.name)).slice(0, 8);
  if (items.length >= 3) return items;
  return [...new Set([x.t(c.name), c.trade && x.t(c.trade), (x.card.tagline ?? "").trim() && x.t(x.card.tagline), c.city].filter(Boolean) as string[])];
}
export function FooterAtelier({ c, x, spec }: VariantProps) {
  const m = footerModel(c, x, spec);
  const name = x.t(c.name);
  const len = Math.max(6, Array.from(name).length);
  const vars = { "--wm": `${(150 / len).toFixed(2)}vw`, "--wmx": `${Math.round(2200 / len)}px` } as React.CSSProperties;
  const words = tickerWords(c, x);
  const act = mainAction(c, x);
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark ft ft-at">
      <div className="at-tick" aria-hidden="true">
        <div className="at-track">{[0, 1].map((k) => <ul key={k}>{[...words, ...words].map((w, i) => <li key={i}>{w}<span>✦</span></li>)}</ul>)}</div>
      </div>
      <div className="adv-wrap adv-wide">
        <FitName text={name} className="at-wm" style={vars} />
        <div className="at-lead">
          {m.blurb && <p className="ft-blurb at-blurb">{x.t(m.blurb)}</p>}
          {act && <Btn href={act.href} {...(act.ext ? { external: true } : {})} data-kind={act.id} onClick={() => x.track(`footer-cta-${act.id}`)}><Icon name={act.icon} /> {act.label}</Btn>}
        </div>
        <div className="at-cols">
          <div><p className="kicker ft-h">{x.ui("Explore", "देखें")}</p><FtQuick m={m} x={x} /></div>
          {m.contact.length > 0 && <div><p className="kicker ft-h">{x.ui("Contact", "संपर्क")}</p><FtContact m={m} x={x} /></div>}
          <FtVisit m={m} x={x} />
          <div className="at-end">
            {x.qr && <Pic src={x.qr} alt={x.ui("QR code that opens this website", "QR कोड, जो यह वेबसाइट खोलता है")} className="ft-qrimg" w={96} />}
            <FtSocial m={m} x={x} />
            <a href={`/c/${x.card.username}/vcf`} className="btn-ghost ft-xs" onClick={() => x.track("vcard")}><Download size={14} aria-hidden="true" /> {x.ui("Save contact", "कॉन्टैक्ट सेव करें")}</a>
            {gstin(x) && <p className="ft-small mono">GSTIN {gstin(x)}</p>}
          </div>
        </div>
      </div>
      <Legal c={c} x={x} />
    </footer>
  );
}

/* ---------- hotline: the phone number is the footer - set huge, with the one-tap actions and the timings beside it ---------- */
export function FooterHotline({ c, x, spec }: VariantProps) {
  const m = footerModel(c, x, spec);
  const num = x.phone?.value ?? x.wa?.value ?? "";
  const numHref = x.phone ? linkHref(x.phone.type, x.phone.value) : x.wa ? x.waHref() : "";
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark ft ft-hl">
      <div className="adv-wrap adv-wide">
        <div className="hl-top">
          <div className="hl-call">
            <p className="kicker">{x.phone ? x.ui("Call us", "कॉल करें") : x.ui("Message us", "मैसेज करें")}</p>
            {num && <a className="hl-num" href={numHref} {...(x.phone ? {} : { target: "_blank", rel: "noreferrer" })} onClick={() => x.track("footer-hotline")}>{prettyPhone(num)}</a>}
            <div className="adv-btn-row hl-btns">
              {x.wa && <Btn href={x.waHref()} external data-kind="whatsapp" onClick={() => x.track("footer-whatsapp")}><Icon name="whatsapp" /> {x.ui("WhatsApp us", "WhatsApp करें")}</Btn>}
              {m.dir && <Btn kind="ghost" href={m.dir} external onClick={() => x.track("footer-directions")}><Icon name="directions" /> {x.ui("Directions", "रास्ता")}</Btn>}
            </div>
            {m.hours.length > 0 && <OpenPill rows={m.hours} x={x} className="hl-open" />}
          </div>
          <div className="hl-side">
            <FtLogo c={c} x={x} />
            {m.blurb && <p className="ft-blurb">{x.t(m.blurb)}</p>}
            {m.address && <address className="ft-addr hl-addr">{x.t(m.address)}</address>}
            <FtSocial m={m} x={x} />
          </div>
        </div>
        <div className="hl-cols">
          <div><p className="kicker ft-h">{x.ui("Explore", "देखें")}</p><FtQuick m={m} x={x} className="hl-quick" /></div>
          {m.hours.length > 0 && (
            <div>
              <p className="kicker ft-h">{x.ui("Timings", "समय")}</p>
              <table className="ft-hours hl-hours"><caption className="sr-only">{x.ui("Opening hours", "खुलने का समय")}</caption><tbody>{m.hours.map((r, i) => <tr key={i}><th scope="row">{x.t(r.day)}</th><td>{x.t(r.time)}</td></tr>)}</tbody></table>
            </div>
          )}
          {x.qr && (
            <div className="hl-qr">
              <Pic src={x.qr} alt={x.ui("QR code that opens this website", "QR कोड, जो यह वेबसाइट खोलता है")} className="ft-qrimg" w={88} />
              <p className="ft-small">{x.ui("Scan to open this site on your phone", "फ़ोन पर यह साइट खोलने के लिए स्कैन करें")}</p>
              {gstin(x) && <p className="ft-small mono">GSTIN {gstin(x)}</p>}
            </div>
          )}
        </div>
      </div>
      <Legal c={c} x={x} />
    </footer>
  );
}

/* ================= FAQ: spotlight ================= */
/* ---------- spotlight: the questions as a large list, the chosen answer set big beside it (on a phone it opens under its question) ---------- */
export function FaqSpotlight({ c, x, index }: VariantProps) {
  const [open, setOpen] = useState(0);
  const uid = useId();
  const items = c.faq;
  if (!items.length) return null;
  const cur = items[Math.min(open, items.length - 1)];
  return (
    <Sec k="faq" tone={tone(index)} wide>
      <Head eyebrow="FAQ" title={x.ui("Ask away", "बेझिझक पूछिए")} lede={x.ui("Pick a question - the answer is right here.", "कोई सवाल चुनिए - जवाब यहीं है।")} />
      <div className="sp">
        <ul className="sp-list">
          {items.map((f, i) => {
            const on = open === i, id = `${uid}-${i}`;
            return (
              <li key={i} data-open={on ? "" : undefined}>
                <h3>
                  <button type="button" id={`${id}-b`} className="sp-btn" aria-expanded={on} aria-controls={`${id}-p`} onClick={() => setOpen(i)}>
                    <span className="qa-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <span className="sp-q">{x.t(f.q)}</span>
                    <span className="sp-ar" aria-hidden="true"><Icon name="arrow-right" size={20} /></span>
                  </button>
                </h3>
                <Panel id={`${id}-p`} labelledBy={`${id}-b`}><p className="sp-inline">{x.t(f.a)}</p></Panel>
              </li>
            );
          })}
        </ul>
        <aside className="sp-card" aria-live="polite" key={open}>
          <span className="sp-mark" aria-hidden="true">{x.ui("A", "उ")}</span>
          <p className="sp-q2">{x.t(cur.q)}</p>
          <p className="sp-a">{x.t(cur.a)}</p>
          <Ask c={c} x={x} lead={false} />
        </aside>
      </div>
    </Sec>
  );
}

/* ================= CSS ================= */

export const CLOSE_CSS = `
/* ---- faq: shared ---- */
.qa-ask{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5);margin-top:var(--s6)}
.qa-ask p{margin:0;font-weight:600}
.qa-list,.qa-s{list-style:none;margin:0;padding:0}
.qa-list h3,.qa-s h3{margin:0;font:inherit}
.qa-btn{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:baseline;gap:var(--s4);width:100%;padding:var(--s5) 0;background:none;border:0;color:inherit;text-align:left;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}
.qa-q{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.1rem,2.1vw,1.4rem);line-height:1.3;letter-spacing:var(--display-tr);text-wrap:pretty;transition:color .2s}
.site:lang(hi) .qa-q{font-weight:var(--display-w-hi);line-height:1.5;letter-spacing:0}
.qa-btn:hover .qa-q{color:var(--accent)}
.qa-panel{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .38s cubic-bezier(.2,.7,.2,1),visibility 0s linear .38s}
.qa-panel>div{min-height:0;overflow:hidden}
li[data-open]>.qa-panel{grid-template-rows:1fr;visibility:visible;transition-delay:0s,0s}
.qa-panel p{margin:0;padding:0 var(--s6) var(--s5) 0;font-size:var(--t-body);line-height:var(--body-lh);color:var(--muted);max-width:62ch;text-wrap:pretty}

/* ---- faq: numbered-accordion ---- */
.qa-num{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.qa-side .adv-head{margin-bottom:0}
.qa-list{border-top:1px solid var(--ink)}
.qa-list>li{border-bottom:1px solid var(--line)}
.qa-n{min-width:2.2rem;font-family:var(--font-display);font-size:.95rem;color:var(--accent);font-variant-numeric:lining-nums tabular-nums}
.qa-pm{position:relative;width:20px;height:20px;align-self:center;color:var(--muted);transition:color .2s}
.qa-btn:hover .qa-pm{color:var(--accent)}
.qa-pm::before,.qa-pm::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:1.5px;margin:-.75px 0 0 -7px;background:currentColor;transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.qa-pm::after{transform:rotate(90deg)}
li[data-open]>h3 .qa-pm::after{transform:rotate(0)}
.qa-num .qa-panel p{padding-left:calc(2.2rem + var(--s4))}
@media (min-width:900px){.qa-num{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(3rem,7vw,6rem);align-items:start}.qa-side{position:sticky;top:96px}}

/* ---- faq: two-column ---- */
.qa-two{columns:1;column-gap:var(--gap)}
.qa-card{position:relative;break-inside:avoid;margin:0 0 var(--gap);padding:var(--s5) var(--s5) var(--s6)}
.qa-mark{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 .5em;margin-bottom:var(--s4);border-radius:var(--r-pill);background:var(--accent-soft);color:var(--accent);font:700 13px/1 var(--font-text)}
.site[data-adv] .qa-card h3{margin:0;font-family:var(--font-text);font-weight:600;font-size:1.0625rem;line-height:1.4;letter-spacing:0;text-wrap:pretty}
.qa-card p{margin:var(--s3) 0 0;font-size:var(--t-meta);line-height:1.65;color:var(--muted);text-wrap:pretty}
@media (min-width:760px){.qa-two{columns:2}.qa-card{padding:var(--s6) var(--s6) calc(var(--s6) + var(--s2))}}

/* ---- faq: searchable ---- */
.qa-find{position:relative;max-width:36rem;margin-bottom:var(--s6)}
.qa-find>svg{position:absolute;left:1.1rem;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.qa-find input{display:block;width:100%;height:56px;padding:0 3.25rem;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--paper);color:var(--ink);font:inherit;font-size:max(16px,1rem);transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;appearance:none}
.qa-find input::placeholder{color:var(--muted)}
.qa-find input::-webkit-search-cancel-button{display:none}
.qa-find input:hover{border-color:color-mix(in srgb,var(--ink) 35%,transparent)}
.qa-find input:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 24%,transparent)}
.qa-clear{position:absolute;right:.4rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:var(--r-ctl);background:none;color:var(--muted);cursor:pointer}
.qa-clear:hover{color:var(--ink)}
.qa-s{border-top:1px solid var(--line)}
.qa-s>li{border-bottom:1px solid var(--line)}
.qa-btn-s{grid-template-columns:minmax(0,1fr) auto;align-items:center}
.qa-chev{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:var(--r-pill);color:var(--muted);transition:transform .35s cubic-bezier(.2,.7,.2,1),background .2s,color .2s,border-color .2s}
.qa-btn-s:hover .qa-chev{border-color:var(--accent);color:var(--accent)}
li[data-open]>h3 .qa-chev{transform:rotate(180deg);background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.qa-btn-s:hover .qa-chev{border-color:var(--accent)}
.qa-find~.qa-s mark,.qa-s mark{padding:0 .12em;border-radius:3px;background:color-mix(in srgb,var(--accent) 22%,transparent);color:inherit}
.qa-empty{padding:var(--s7) 0;border-top:1px solid var(--line)}
.qa-empty p{margin:0;font-size:var(--t-sub);color:var(--muted)}

/* ---- faq: chat-bubble ---- */
.qa-chat{max-width:46rem;margin-inline:auto}
.qa-chat .adv-head{margin-inline:auto;text-align:center}
.qa-chat .adv-lede{margin-inline:auto}
.qa-thread{list-style:none;margin:0;padding:0;display:grid;gap:var(--s6)}
.qa-thread>li{display:grid;gap:var(--s3)}
.qa-msg{display:flex;align-items:flex-end;gap:var(--s3);min-width:0}
.qa-me{justify-content:flex-end}
.qa-bub{margin:0;padding:.85rem 1.15rem;border-radius:var(--r-card);font-size:var(--t-body);line-height:1.55;max-width:min(36rem,88%);overflow-wrap:anywhere;text-wrap:pretty}
.site[data-adv] h3.qa-bub{font-family:var(--font-text);font-weight:600;letter-spacing:0}
.qa-me .qa-bub{background:var(--accent);color:var(--on-accent);border-bottom-right-radius:min(6px,var(--r-card))}
.qa-them .qa-bub{background:color-mix(in srgb,var(--ink) 5%,var(--paper));border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:min(6px,var(--r-card))}
.qa-av{position:relative;flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;overflow:hidden;background:var(--accent-soft);color:var(--accent);font-family:var(--font-display);font-size:1rem}
.qa-av img{width:100%;height:100%;object-fit:contain;background:#fff}
.qa-compose{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);margin-top:var(--s7);padding:.45rem .45rem .45rem 1.25rem;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--paper);color:var(--muted);text-decoration:none;transition:border-color .2s,box-shadow .2s}
.qa-compose:hover{border-color:var(--accent);box-shadow:var(--e-1)}
.qa-compose b{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:var(--r-ctl);background:var(--accent);color:var(--on-accent);transition:transform .2s}
.qa-compose:hover b{transform:translateX(3px)}

/* ---- visit: shared ---- */
.vz-sm{min-height:40px;padding:0 var(--s4);font-size:14px}
.vz-hours{width:100%;border-collapse:collapse;font-size:var(--t-body)}
.vz-hours th,.vz-hours td{padding:.8rem 0;border-bottom:1px solid var(--line);font-weight:500;vertical-align:baseline;text-align:left}
.vz-hours tr:last-child>*{border-bottom:0}
.vz-hours td{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.vz-hours tr[data-today]>*{color:var(--ink);font-weight:700}
.vz-hours em,.vz-day em,.vz-hgrid em{margin-left:.6em;padding:.2em .6em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent);font-style:normal;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;vertical-align:.12em;white-space:nowrap}
.site:lang(hi) .vz-hours em,.site:lang(hi) .vz-day em,.site:lang(hi) .vz-hgrid em{letter-spacing:0;text-transform:none}

/* ---- visit: map-hours ---- */
.vz-mh{display:grid;gap:var(--gap);align-items:stretch}
.vz-mapcard{display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:var(--r-tile);background:var(--paper);color:inherit;text-decoration:none;transition:box-shadow .3s,border-color .3s}
a.vz-mapcard:hover{box-shadow:var(--e-1);border-color:color-mix(in srgb,var(--ink) 28%,transparent)}
.vz-art{position:relative;display:block;aspect-ratio:16/10;overflow:hidden;background:var(--accent-soft)}
.vz-map{position:absolute;inset:0;width:100%;height:100%}
.vz-map .bg{fill:var(--accent-soft)}
.vz-map .bl rect{fill:var(--accent);opacity:.09}
.vz-map .rd path{fill:none;stroke:var(--paper);stroke-linecap:round}
.vz-pin{position:absolute;left:50%;top:48%;display:grid;place-items:center;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:var(--accent);color:var(--on-accent);box-shadow:0 8px 20px color-mix(in srgb,var(--accent) 40%,transparent)}
.vz-pin::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--accent);animation:vz-ping 2.6s cubic-bezier(.2,.7,.2,1) infinite}
@keyframes vz-ping{from{transform:scale(1);opacity:.7}to{transform:scale(2.3);opacity:0}}
.vz-cap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s3) var(--s5);padding:var(--s5)}
.vz-addr{display:flex;align-items:flex-start;gap:var(--s3);font-size:var(--t-sub);line-height:1.45;min-width:0}
.vz-addr svg{flex:none;margin-top:.22em;color:var(--accent)}
a.vz-mapcard:hover .btn-link{text-decoration:underline}
.vz-hoursbox{display:flex;flex-direction:column;gap:var(--s4);padding:var(--s6)}
.vz-hoursbox .btn-ghost{align-self:flex-start;margin-top:auto}
@media (min-width:900px){.vz-mh{grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr)}.vz-mh[data-solo]{grid-template-columns:minmax(0,1fr)}.vz-art{flex:1;aspect-ratio:auto;min-height:340px}}

/* ---- visit: hours-timeline ---- */
.vz-tlw{display:grid;gap:clamp(2.5rem,6vw,4rem)}
.vz-tl{position:relative;list-style:none;margin:0;padding:0 0 0 var(--s6)}
.vz-tl::before{content:"";position:absolute;left:5px;top:1.2rem;bottom:1.2rem;width:1px;background:var(--line)}
.vz-tl li{position:relative;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--s1) var(--s5);padding:var(--s4) 0;border-bottom:1px solid var(--line)}
.vz-tl li:last-child{border-bottom:0}
.vz-tl li::before{content:"";position:absolute;left:calc(-1 * var(--s6));top:calc(var(--s4) + .72rem);width:11px;height:11px;border-radius:50%;background:var(--paper);border:1.5px solid var(--muted)}
.vz-tl li[data-today]::before{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 22%,transparent)}
.vz-day{font-size:var(--t-sub);color:var(--muted)}
.vz-tl li[data-today] .vz-day{color:var(--ink);font-weight:600}
.vz-time{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.3rem,2.8vw,2rem);line-height:1.2;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums}
.site:lang(hi) .vz-time{font-weight:var(--display-w-hi);letter-spacing:0}
.vz-where{display:flex;flex-direction:column;gap:var(--s4);padding:clamp(1.5rem,4vw,2.5rem);border-radius:var(--r-tile)}
.vz-where-addr{margin:0;font-style:normal;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.35rem,2.6vw,1.9rem);line-height:1.3;letter-spacing:var(--display-tr);text-wrap:balance}
.site:lang(hi) .vz-where-addr{font-weight:var(--display-w-hi);letter-spacing:0;line-height:1.5}
.vz-where-btns{display:flex;flex-wrap:wrap;gap:var(--s3);margin-top:var(--s3)}
@media (min-width:900px){.vz-tlw{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(3rem,7vw,6rem);align-items:start}.vz-tlw[data-solo]{grid-template-columns:minmax(0,1fr)}.vz-where{position:sticky;top:96px}}

/* ---- visit: address-poster ---- */
.vz-poster{display:grid;gap:clamp(1.75rem,4vw,3rem)}
.vz-lines{margin:0;font-style:normal;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.1rem,7.2vw,5.6rem);line-height:var(--display-lh,1);letter-spacing:var(--display-tr);text-wrap:balance;overflow-wrap:break-word}
.vz-lines[data-long]{font-size:clamp(1.7rem,5vw,3.6rem)}
.vz-lines span{display:block}
.vz-lines span+span{color:var(--muted)}
.site:lang(hi) .vz-lines{line-height:1.3;letter-spacing:0;font-weight:var(--display-w-hi)}
.vz-poster-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s5) var(--s7);padding-top:clamp(1.25rem,3vw,2rem);border-top:1px solid var(--line)}
.vz-go{display:inline-flex;align-items:center;gap:var(--s4);color:inherit;text-decoration:none;font-size:var(--t-sub);font-weight:600}
.vz-go b{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;border:1px solid var(--line);transition:background .25s,color .25s,transform .35s cubic-bezier(.2,.7,.2,1),border-color .25s}
.vz-go:hover b{background:var(--ink);color:var(--paper);border-color:var(--ink);transform:rotate(45deg)}
.vz-chips{display:flex;flex-wrap:wrap;gap:var(--s2);list-style:none;margin:0;padding:0}
.vz-chips li{padding:.5em 1em;border:1px solid var(--line);border-radius:var(--r-pill);font-size:var(--t-meta);color:var(--muted);font-variant-numeric:tabular-nums}
.vz-chips b{color:var(--ink);font-weight:600}
.vz-chips li[data-today]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.vz-chips li[data-today] b{color:inherit}

/* ---- visit: branch-list ---- */
.vz-br{list-style:none;margin:0;padding:0;border-top:1px solid var(--ink)}
.vz-br>li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--s3) var(--s5);align-items:start;margin-inline:calc(-1 * var(--s3));padding:var(--s6) var(--s3);border-bottom:1px solid var(--line);transition:background .2s}
.vz-br>li:hover{background:color-mix(in srgb,var(--accent-soft) 55%,transparent)}
.vz-br-no{font-family:var(--font-display);font-size:clamp(1.5rem,3vw,2.3rem);line-height:1;color:var(--accent);font-variant-numeric:lining-nums;min-width:2ch}
.vz-br-txt h3{font-size:clamp(1.2rem,2.4vw,1.6rem);line-height:1.2;letter-spacing:var(--display-tr)}
.site:lang(hi) .vz-br-txt h3{line-height:1.45;letter-spacing:0;font-weight:var(--display-w-hi)}
.vz-br-txt address{margin:var(--s2) 0 0;font-style:normal;font-size:var(--t-body);line-height:1.55;color:var(--muted);max-width:52ch}
.vz-br-act{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.vz-brh{display:grid;gap:var(--s4);margin-top:clamp(2rem,5vw,3.5rem)}
.vz-hgrid{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));list-style:none;margin:0;padding:0}
.vz-hgrid li{display:flex;flex-direction:column;gap:.3rem;padding:var(--s4);border:1px solid var(--line);border-radius:var(--r-card);font-size:var(--t-meta);color:var(--muted)}
.vz-hgrid b{font-size:var(--t-body);font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums lining-nums}
.vz-hgrid li[data-today]{border-color:var(--accent);background:var(--accent-soft)}
.vz-hgrid em{align-self:flex-start;margin:0 0 0 .5em}
@media (min-width:900px){.vz-br>li{grid-template-columns:4.5rem minmax(0,1fr) auto;align-items:center}.vz-br-act{grid-column:auto;justify-content:flex-end}}

/* ---- cta: shared accent surfaces ---- */
.cx-wide,.cx-fc{background:var(--accent);color:var(--on-accent);--ink:var(--on-accent);--muted:color-mix(in srgb,var(--on-accent) 82%,transparent);--line:color-mix(in srgb,var(--on-accent) 32%,transparent)}
.cx-wide .kicker,.cx-fc .kicker{color:var(--on-accent);opacity:.82}
.cx-wide .btn-primary,.cx-fc .btn-primary{background:var(--on-accent);color:var(--accent)}
.cx-wide .btn-ghost:hover,.cx-fc .btn-ghost:hover{background:color-mix(in srgb,var(--on-accent) 12%,transparent)}

/* ---- cta: wide-band ---- */
.cx-wide{overflow:hidden;isolation:isolate}
.cx-wide::before{content:"";position:absolute;z-index:-1;right:-14vw;top:50%;width:min(64vw,760px);aspect-ratio:1;transform:translateY(-50%);border-radius:50%;box-shadow:0 0 0 clamp(24px,4vw,60px) color-mix(in srgb,var(--on-accent) 7%,transparent),0 0 0 clamp(48px,8vw,120px) color-mix(in srgb,var(--on-accent) 5%,transparent)}
.cx-wide-in{display:grid;gap:clamp(2rem,5vw,3.5rem)}
.cx-wide-head .adv-display{margin-top:var(--s4)}
.cx-wide-side .adv-lede{margin-top:0;margin-bottom:var(--s5)}
.cx-rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.cx-rows a{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--s1) var(--s4);padding:var(--s4) 0;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;font-family:var(--font-display);font-size:clamp(1.15rem,2.6vw,1.9rem);line-height:1.2;overflow-wrap:anywhere;transition:padding .25s cubic-bezier(.2,.7,.2,1)}
.cx-rows a small{grid-column:1/-1;font:600 12px/1 var(--font-text);letter-spacing:.1em;text-transform:uppercase;opacity:.8}
.site:lang(hi) .cx-rows a small{letter-spacing:0;text-transform:none;font-size:13px}
.cx-rows a:hover{padding-inline:var(--s3)}
.cx-rows a svg{transition:transform .25s}.cx-rows a:hover svg{transform:translate(3px,-3px)}
@media (min-width:900px){.cx-wide-in{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:end}.cx-rows{grid-column:1/-1}}

/* ---- cta: floating-card ---- */
.cx-float{z-index:2;margin-top:calc(var(--section-pad) * -.35);padding-block:0;background:transparent}
.cx-float[data-last]{background:linear-gradient(to bottom,transparent 50%,var(--hero-ink) 50%)}
.cx-fc{position:relative;overflow:hidden;isolation:isolate;display:grid;gap:var(--s6);padding:clamp(1.75rem,5vw,4rem);border-radius:var(--r-tile);box-shadow:var(--e-1),0 40px 80px -40px color-mix(in srgb,var(--accent) 60%,transparent)}
.cx-fc::before{content:"";position:absolute;z-index:-1;left:-8%;bottom:-40%;width:60%;aspect-ratio:1;border-radius:50%;background:color-mix(in srgb,var(--on-accent) 8%,transparent)}
.cx-fc .adv-h2{margin-top:var(--s3)}
.cx-fc .adv-lede{margin-bottom:var(--s5)}
.cx-fc-photo{display:none;position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:var(--r-card);background:color-mix(in srgb,var(--on-accent) 14%,transparent)}
@media (min-width:900px){.cx-fc[data-photo]{grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);align-items:center}.cx-fc-photo{display:block}}

/* ---- cta: split-qr ---- */
.cx-qr{display:grid;gap:clamp(2rem,5vw,4rem);align-items:center}
.cx-qr .adv-lede{margin-bottom:var(--s5)}
.cx-qr-card{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s5);padding:var(--s5);box-shadow:var(--e-1)}
.cx-qr-img{display:block;flex:none;width:168px;height:168px;padding:10px;border-radius:var(--r-card);background:#fff}
.cx-qr-txt{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s3);flex:1 1 11rem;min-width:0}
.cx-qr-txt p{margin:0;font-size:var(--t-meta);line-height:1.5;color:var(--muted)}
.cx-qr-txt .cx-qr-url{word-break:break-all;font-size:12px}
@media (min-width:900px){.cx-qr[data-qr]{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}.cx-qr-card{justify-self:end;max-width:30rem}}

/* ---- cta: sticky-ribbon ---- */
.cx-end{max-width:44rem;margin-inline:auto;text-align:center}
.cx-end .adv-lede{margin-inline:auto;margin-bottom:var(--s5)}
.cx-end-btns{justify-content:center}
.cx-rib{position:sticky;bottom:0;z-index:25;height:0;pointer-events:none}
.cx-rib-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:var(--s4) var(--s6);padding:.7rem max(var(--gutter),88px) .7rem var(--gutter);background:var(--ink);color:var(--paper);box-shadow:0 -10px 30px color-mix(in srgb,var(--ink) 16%,transparent);opacity:0;visibility:hidden;transform:translateY(100%);transition:transform .4s cubic-bezier(.2,.7,.2,1),opacity .25s,visibility 0s linear .4s}
.cx-rib[data-on] .cx-rib-bar{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition-delay:0s}
.cx-rib-bar p{margin:0;min-width:0;font-size:var(--t-meta);font-weight:500;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cx-rib-bar .adv-btn-row{flex:none;flex-wrap:nowrap}
.cx-rib-bar .btn-primary{background:var(--paper);color:var(--ink)}
.cx-rib-bar .btn-link{color:var(--paper)}
@media (max-width:767px){.cx-rib{display:none}}

/* ---- footer: shared ---- */
.ft{padding-top:clamp(3.25rem,7vw,5.5rem)}
.ft a{color:inherit;text-decoration:none}
.ft-h{margin:0 0 var(--s4)}
.ft-logo{display:block;height:40px;width:auto;max-width:180px;object-fit:contain;background:rgb(255 255 255/.92);border-radius:var(--r-img);padding:4px}
.ft .ft-mark{font-size:19px}
.ft-blurb{margin:var(--s4) 0 0;max-width:34rem;font-size:var(--t-meta);line-height:1.65;color:var(--hero-muted);text-wrap:pretty}
.ft-small{margin:var(--s3) 0 0;font-size:12px;line-height:1.5;color:var(--hero-muted);word-break:break-all}
.ft-list{list-style:none;margin:0;padding:0;display:grid;gap:var(--s1);font-size:var(--t-meta)}
.ft-list a,.ft-plain{display:inline-flex;align-items:center;gap:var(--s2);max-width:100%;padding-block:.35rem;opacity:.88;overflow-wrap:anywhere;transition:opacity .15s}
.ft-list a:hover{opacity:1;text-decoration:underline;text-underline-offset:.22em}
.ft-list small{opacity:.7}
@media (max-width:767px){.ft-list a,.ft-top{min-height:40px}}
.ft-addr{margin:0;font-style:normal;font-size:var(--t-meta);line-height:1.65;opacity:.88}
.ft-dir{margin-top:var(--s2);font-size:var(--t-meta)}
.ft-hours{width:100%;border-collapse:collapse;margin-top:var(--s4);font-size:var(--t-meta)}
.ft-hours th,.ft-hours td{padding:.28rem 0;font-weight:400;text-align:left;opacity:.88}
.ft-hours td{text-align:right;font-variant-numeric:tabular-nums}
.ft-soc{display:flex;flex-wrap:wrap;gap:var(--s2);list-style:none;margin:var(--s5) 0 0;padding:0}
.ft-soc a{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--hero-line);border-radius:var(--r-ctl);color:var(--hero-text);transition:background .2s,color .2s,border-color .2s}
.ft-soc a:hover{background:var(--hero-text);color:var(--hero-ink);border-color:var(--hero-text)}
.ft-xs{min-height:34px;padding:0 var(--s3);font-size:12.5px;gap:.35rem}
.ft-legal-wrap{margin-top:clamp(2.5rem,6vw,4rem);border-top:1px solid var(--hero-line)}
.ft-legal{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s2) var(--s5);padding-block:var(--s5) 5rem;font-size:12px;color:var(--hero-muted)}
.ft-top{display:inline-flex;align-items:center;gap:.4rem;padding:.4rem 0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;transition:color .15s}
.ft-top:hover{color:var(--hero-text)}
.ft-up{transform:rotate(-90deg)}
@media (min-width:768px){.ft-legal{padding-bottom:var(--s5)}}

/* ---- footer on a phone: closer and tidier (owner, 25 Oct 2026: "footer ke link bade khule khule, mobile me unmanaged") ----
   Links sit closer (still a 34px tap row), headings nearer their lists, and the short "Explore" list shares a row with the next
   column instead of each column taking the whole width. */
@media (max-width:767px){
  .ft{padding-top:2.5rem}
  .ft-h{margin:0 0 var(--s2)}
  .ft-list{gap:0}
  .ft-list a,.ft-plain{padding-block:.15rem;min-height:30px}
  .ft-blurb{margin-top:var(--s3)}
  .ft-soc{margin-top:var(--s4)}
  .ft-soc a{width:40px;height:40px}
  .ft-qr{margin-top:var(--s4)}
  .ft-legal-wrap{margin-top:var(--s6)}
  .ft-hours{margin-top:var(--s2)}
}
/* ---- footer: mega ---- */
.ft-mega{display:grid;gap:var(--s7) var(--s6);grid-template-columns:repeat(2,minmax(0,1fr))}
.ft-brand{grid-column:1/-1;min-width:0}
.ft-qr{display:flex;align-items:center;gap:var(--s4);margin-top:var(--s5)}
.ft-qrimg{flex:none;width:72px;height:72px;padding:5px;border-radius:var(--r-img);background:#fff}
.ft-qr .adv-btn-row{margin-top:var(--s2)}
@media (min-width:900px){.ft-mega{grid-template-columns:1.5fr .8fr 1.1fr 1.2fr}.ft-brand{grid-column:auto}}
@media (max-width:767px){.ft-mega{gap:var(--s6) var(--s5)}}
@media (max-width:560px){.ft-mega>div:has(.ft-contact){grid-column:1/-1;order:1}}

/* ---- footer: minimal ---- */
.ft-min{padding-top:clamp(2.5rem,5vw,3.5rem)}
.ft-min-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s5) var(--s6)}
.ft-min .ft-nav-in .ft-list{display:flex;flex-wrap:wrap;gap:0 var(--s5)}
.ft-min .ft-soc{margin:0}
.ft-min-mid{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s6);margin-top:var(--s6);padding-top:var(--s5);border-top:1px solid var(--hero-line);font-size:var(--t-meta)}
.ft-inline{display:flex;flex-wrap:wrap;gap:0 var(--s5)}
.ft-min-addr,.ft-min-hrs{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem var(--s3);margin:0;line-height:1.5;opacity:.88}
.ft-min-addr svg,.ft-min-hrs svg{flex:none}
.ft-min-addr a{display:inline-flex;align-items:center;min-height:40px;text-decoration:underline;text-underline-offset:.22em}
.ft-min-hrs b{font-weight:600;font-variant-numeric:tabular-nums}
.ft-min .ft-small{margin:0}
.ft-min .ft-legal-wrap{margin-top:clamp(1.5rem,4vw,2.5rem)}

/* ---- footer: big-wordmark ---- */
.ft-bw{display:grid;gap:var(--s7) var(--s6);grid-template-columns:repeat(2,minmax(0,1fr))}
.ft-bw-lead{grid-column:1/-1}
@media (min-width:900px){.ft-bw{grid-template-columns:1.4fr .8fr 1fr 1.1fr}.ft-bw-lead{grid-column:auto}}
@media (max-width:767px){.ft-bw{gap:var(--s6) var(--s5)}}
@media (max-width:560px){.ft-bw>div:has(.ft-contact){grid-column:1/-1;order:1}}
.ft-bw .ft-soc{margin-top:var(--s4)}
.ft-wm{margin:clamp(2.5rem,6vw,4.5rem) 0 0;padding-bottom:.06em;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.4rem,min(var(--wm,12vw),var(--wmx,170px)),15rem);line-height:.86;letter-spacing:-.04em;overflow-wrap:break-word;color:var(--hero-text);opacity:.95;user-select:none;-webkit-mask-image:linear-gradient(to bottom,#000 52%,transparent 99%);mask-image:linear-gradient(to bottom,#000 52%,transparent 99%)}
.site:lang(hi) .ft-wm{line-height:1.2;letter-spacing:0;font-weight:var(--display-w-hi)}
.ft-gst{margin-top:var(--s4)}

/* ---- footer: link-grid ---- */
.ft-lg{display:grid;gap:var(--s3);grid-template-columns:repeat(2,minmax(0,1fr))}
.ft-tile{position:relative;display:flex;flex-direction:column;gap:var(--s4);min-width:0;padding:var(--s5);border:1px solid var(--hero-line);border-radius:var(--r-card);font-size:var(--t-meta)}
.ft-tile .ft-blurb{margin-top:0}
.ft-tile .ft-soc{margin-top:auto}
.ft-tile .ft-hours{margin-top:var(--s3)}
a.ft-link{justify-content:space-between;min-height:104px;transition:background .25s,border-color .25s}
a.ft-link:hover{background:color-mix(in srgb,var(--hero-text) 7%,transparent);border-color:color-mix(in srgb,var(--hero-text) 38%,transparent)}
a.ft-link>svg{align-self:flex-end;margin-top:auto;transition:transform .25s}
a.ft-link:hover>svg{transform:translate(3px,-3px)}
.ft-link>span:first-child{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.15rem,2.2vw,1.5rem);line-height:1.2;letter-spacing:var(--display-tr)}
.site:lang(hi) .ft-link>span:first-child{font-weight:var(--display-w-hi);letter-spacing:0}
.ft-t-contact{justify-content:space-between;min-height:104px}
.ft-t-contact small{font:600 11px/1 var(--font-text);letter-spacing:.1em;text-transform:uppercase;color:var(--hero-muted)}
.site:lang(hi) .ft-t-contact small{letter-spacing:0;text-transform:none;font-size:13px}
.ft-val{display:flex;align-items:center;gap:var(--s2);font-size:1rem;font-weight:500;overflow-wrap:anywhere}
.ft-val svg{flex:none}
.ft-t-brand,.ft-t-visit{grid-column:1/-1}
.ft-t-nav{display:contents}
.ft-t-gst{grid-column:1/-1;margin:0}
@media (min-width:768px){.ft-lg{grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s4)}.ft-t-brand{grid-column:span 2;grid-row:span 2}.ft-t-visit{grid-column:span 2}}

/* ---- open now pill (every variant that shows timings) ---- */
.op-pill{display:inline-flex;align-items:center;gap:.55em;align-self:flex-start;padding:.42em .95em .42em .8em;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--paper);color:var(--ink);font-size:13px;font-weight:600;line-height:1.2;white-space:nowrap}
.op-pill i{position:relative;flex:none;width:9px;height:9px;border-radius:50%;background:var(--muted)}
.op-pill[data-state=open] i{background:var(--wa)}
.op-pill[data-state=open] i::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--wa);animation:op-ping 2.2s ease-out infinite}
.op-pill[data-state=closed] i{background:#c4443a}
.op-pill[data-state=wait]{visibility:hidden}
@keyframes op-ping{from{transform:scale(1);opacity:.6}to{transform:scale(2.8);opacity:0}}
.hero-dark .op-pill,.ft .op-pill{background:transparent;border-color:var(--hero-line);color:var(--hero-text)}
.ft-open,.vz-tl-open{margin-bottom:var(--s4)}
.vz-tl-open{margin-bottom:var(--s5)}
.vz-hoursbox .op-pill{margin-bottom:calc(-1 * var(--s1))}
.ft-name{margin:0;display:grid;gap:.15rem}
.ft-name b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.5rem,3vw,2rem);line-height:1.1;letter-spacing:var(--display-tr)}
.ft-name small{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--hero-muted)}
.site:lang(hi) .ft-name b{font-weight:var(--display-w-hi);letter-spacing:0;line-height:1.35}
.site:lang(hi) .ft-name small{letter-spacing:0;text-transform:none;font-size:13px}

/* ---- footer: atelier ---- */
.ft-at{padding-top:0;overflow:hidden}
.at-tick{border-bottom:1px solid var(--hero-line);overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.at-track{display:flex;width:max-content;animation:at-run 46s linear infinite}
.at-tick:hover .at-track{animation-play-state:paused}
.at-track ul{display:flex;flex:none;align-items:center;margin:0;padding:1.05rem 0;list-style:none}
.at-track li{display:inline-flex;align-items:center;font-family:var(--font-display);font-size:clamp(1.1rem,2.2vw,1.6rem);letter-spacing:var(--display-tr);color:var(--hero-muted)}
.at-track li span{margin-inline:clamp(1.25rem,3vw,2.5rem);font-size:.6em;color:var(--accent)}
@keyframes at-run{to{transform:translateX(-50%)}}
.at-wm span,.ft-wm span{white-space:nowrap}
.at-wm{display:block;margin:clamp(2rem,5vw,4rem) 0 0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.6rem,min(var(--wm,12vw),var(--wmx,190px)),16rem);line-height:.92;letter-spacing:-.045em;overflow-wrap:break-word;color:transparent;-webkit-text-stroke:1.5px var(--hero-text);transition:color .5s,-webkit-text-stroke-color .5s}
.at-wm:hover{color:var(--hero-text)}
@media (hover:none){.at-wm{color:var(--hero-text);-webkit-text-stroke:0}}
.site:lang(hi) .at-wm{line-height:1.25;letter-spacing:0;font-weight:var(--display-w-hi)}
.at-lead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s5);margin-top:clamp(1.5rem,3vw,2.25rem);padding-bottom:clamp(2rem,5vw,3.5rem);border-bottom:1px solid var(--hero-line)}
.at-blurb{margin:0;max-width:36rem;font-size:var(--t-sub)}
.at-cols{display:grid;gap:var(--s7) var(--s6);grid-template-columns:repeat(2,minmax(0,1fr));padding-top:clamp(2rem,5vw,3.5rem)}
.at-end{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4)}
.at-end .ft-soc{margin:0}
@media (min-width:900px){.at-cols{grid-template-columns:.8fr 1.1fr 1.3fr .9fr}}
@media (max-width:560px){.at-cols>div{grid-column:1/-1}}

/* ---- footer: hotline ---- */
.hl-top{display:grid;gap:clamp(2rem,5vw,3.5rem);padding-bottom:clamp(2rem,5vw,3.5rem);border-bottom:1px solid var(--hero-line)}
.hl-call{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s4);min-width:0}
.hl-num{display:block;max-width:100%;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.1rem,9.4vw,7rem);line-height:1;letter-spacing:-.01em;font-variant-numeric:lining-nums;color:var(--hero-text);text-decoration:none;overflow-wrap:anywhere;background:linear-gradient(var(--accent),var(--accent)) 0 100%/0 .06em no-repeat;transition:background-size .5s cubic-bezier(.2,.7,.2,1)}
.hl-num:hover{background-size:100% .06em}
.hl-btns{margin-top:var(--s2)}
.hl-side{display:grid;gap:var(--s4);align-content:start}
.hl-side .ft-blurb,.hl-side .ft-soc{margin:0}
.hl-addr{max-width:26rem}
.hl-cols{display:grid;gap:var(--s7) var(--s6);grid-template-columns:repeat(2,minmax(0,1fr));padding-top:clamp(2rem,5vw,3rem)}
.hl-qr{display:flex;flex-direction:column;gap:var(--s2)}
.hl-qr p{max-width:15rem}
@media (min-width:900px){.hl-top{grid-template-columns:minmax(0,1.6fr) minmax(0,.9fr);align-items:end}.hl-cols{grid-template-columns:1fr 1.3fr 1fr}}
@media (max-width:560px){.hl-cols>div{grid-column:1/-1}}

/* ---- faq: spotlight ---- */
.sp{display:grid;gap:var(--gap)}
.sp-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--ink)}
.sp-list>li{border-bottom:1px solid var(--line)}
.sp-list h3{margin:0;font:inherit}
.sp-btn{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:baseline;gap:var(--s4);width:100%;padding:var(--s5) var(--s2);background:none;border:0;color:inherit;text-align:left;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent;transition:padding .3s cubic-bezier(.2,.7,.2,1),color .2s}
.sp-q{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.15rem,2.2vw,1.55rem);line-height:1.25;letter-spacing:var(--display-tr);text-wrap:pretty}
.site:lang(hi) .sp-q{font-weight:var(--display-w-hi);line-height:1.5;letter-spacing:0}
.sp-ar{align-self:center;color:var(--muted);transition:transform .3s,color .2s}
.sp-btn:hover .sp-q,.sp-list>li[data-open] .sp-q{color:var(--accent)}
.sp-list>li[data-open] .sp-ar{color:var(--accent);transform:rotate(90deg)}
.sp-inline{padding-left:calc(2.2rem + var(--s4)) !important}
.sp-card,.sp-card *{min-width:0}
.sp-card{display:none}
@media (min-width:900px){
  .sp{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(2.5rem,6vw,5rem);align-items:start}
  .sp-list .qa-panel{display:none}
  .sp-btn:hover{padding-left:var(--s4)}.sp-list>li[data-open] .sp-btn{padding-left:var(--s4)}.sp-list>li[data-open] .sp-ar{transform:none}
  .sp-card{position:sticky;top:96px;display:block;padding:clamp(1.75rem,3.5vw,3rem);border-radius:var(--r-tile);background:var(--accent);color:var(--on-accent);overflow:hidden;animation:sp-in .5s cubic-bezier(.2,.7,.2,1) both;--ink:var(--on-accent);--muted:color-mix(in srgb,var(--on-accent) 82%,transparent);--line:color-mix(in srgb,var(--on-accent) 32%,transparent)}
  .sp-card .btn-ghost{color:var(--on-accent);border-color:var(--line)}
  .sp-mark{position:absolute;right:-.06em;top:-.22em;font-family:var(--font-display);font-size:clamp(9rem,16vw,15rem);line-height:1;opacity:.12;pointer-events:none;user-select:none}
  .sp-q2{position:relative;margin:0 0 var(--s5);font-size:var(--t-meta);font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.82}
  .sp-a{position:relative;margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.4rem,2.4vw,2rem);line-height:1.3;letter-spacing:var(--display-tr);text-wrap:pretty}
  .sp-card .qa-ask{position:relative;margin-top:var(--s6)}
}
.site:lang(hi) .sp-q2{letter-spacing:0;text-transform:none;font-size:14px}
.site:lang(hi) .sp-a{line-height:1.6;letter-spacing:0;font-weight:var(--display-w-hi)}
@keyframes sp-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
`;
