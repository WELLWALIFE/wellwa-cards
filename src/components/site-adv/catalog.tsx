"use client";
// Advanced-site SERVICES / PRODUCTS (offerings) variants - the catalog (owner's Rs 5,999 segment, 15-16 Oct 2026):
//   feature-cards   large cards, photo over words, the first one a wide lead when the count is odd
//   price-list      a compact ruled list: a small photo, name + line, price, a round ask button; the title sticks beside it
//   magazine        a four-column editorial grid, one 2x2 lead tile, captions over the photos
//   scroller        a horizontal, scroll-snapping shelf with arrows and a progress hairline
//   category-tabs   tabs built from what the card has (the owner's badges, else price bands, else "on offer")
//   menu-leaders    a printed menu: name ....... price with dotted leaders, in columns
//   tiers           comparison columns: price large, the description as ticks, one lifted tier when the owner badged it
// All seven draw the same `c.offerings` (photo, name, line, price, MRP, badge, own page) and give every item its own
// WhatsApp enquiry (a call link when the card has no WhatsApp). No offerings -> nothing is drawn (the renderer hides the
// section). An item without a photo is drawn without one - never a grey placeholder.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/site-icons";
import { linkHref } from "@/components/link-icon";
import { Head, Photo, Sec, type AdvCtx, type Offering, type SiteContent, type VariantProps } from "@/components/site-adv/shared";

type Off = NonNullable<SiteContent["offerings"]>;

/* ---------- small shared pieces ---------- */

/** The first number in a price string ("₹1,299 onwards" -> 1299); null when there is none. */
function amount(s?: string): number | null {
  const m = /\d[\d,]*(?:\.\d+)?/.exec(s ?? "");
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Percent off when both figures are numbers and the MRP is the higher one; else 0. */
function offPct(it: Offering): number {
  const p = amount(it.price), m = amount(it.mrp);
  return p && m && m > p ? Math.round((1 - p / m) * 100) : 0;
}
/** An MRP is shown when it is above the price, or when it cannot be compared (the owner wrote it, so it stays). */
function showMrp(it: Offering): boolean {
  if (!it.price || !it.mrp) return false;
  const p = amount(it.price), m = amount(it.mrp);
  return !(p && m && m <= p);
}
/** 1234567 -> "12,34,567" (the Indian grouping, no Intl so the server and the browser always agree). */
function inr(n: number): string {
  const s = String(Math.round(n));
  return s.length <= 3 ? s : `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${s.slice(-3)}`;
}
const kindLabel = (o: Off, x: AdvCtx) => (o.kind === "products" ? x.ui("Products", "प्रोडक्ट") : x.ui("Services", "सेवाएँ"));
const pad2 = (i: number) => String(i + 1).padStart(2, "0");

function Price({ it, x, className = "" }: { it: Offering; x: AdvCtx; className?: string }) {
  if (!it.price) return null;
  const pc = offPct(it);
  return (
    <p className={`cz-price ${className}`}>
      <span className="cz-now">{it.price}</span>
      {showMrp(it) && <s className="cz-mrp"><span className="sr-only">{x.ui("Original price", "असली दाम")} </span>{it.mrp}</s>}
      {pc >= 5 && <span className="cz-off">{x.hi ? `${pc}% की छूट` : `${pc}% off`}</span>}
    </p>
  );
}

/** The item's own WhatsApp enquiry; a call link when the card has no WhatsApp; nothing when it has neither. `icon` = a round
 *  icon-only button (the label stays for screen readers). */
function Ask({ it, c, x, kind = "ghost", icon = false, label, className = "" }: {
  it: Offering; c: SiteContent; x: AdvCtx; kind?: "primary" | "ghost" | "link"; icon?: boolean; label?: string; className?: string;
}) {
  const wa = !!x.wa;
  if (!wa && !x.phone) return null;
  const href = wa
    ? x.waHref(x.hi ? `नमस्ते ${c.name}, मुझे "${it.name}" के बारे में जानना है` : `Hi ${c.name}, I'd like to know about "${it.name}"`)
    : linkHref(x.phone!.type, x.phone!.value);
  const text = label ?? (wa ? x.ui("Ask", "पूछें") : x.ui("Call", "कॉल करें"));
  const cls = icon ? "cz-iconbtn" : kind === "primary" ? "btn-primary cz-sm" : kind === "link" ? "btn-link" : "btn-ghost cz-sm";
  return (
    <a href={href} {...(wa ? { target: "_blank", rel: "noreferrer" } : {})} className={`${cls} ${className}`} aria-label={`${text}: ${x.t(it.name)}`}
      onClick={() => x.track(wa ? "product-ask" : "product-call")}>
      <Icon name={wa ? "whatsapp" : "phone"} size={icon ? 18 : 16} />{!icon && text}
    </a>
  );
}

/** The item's own page, when the website has one. */
function Details({ it, x, className = "" }: { it: Offering; x: AdvCtx; className?: string }) {
  const go = x.goto, slug = it.slug;
  if (!slug || !go) return null;
  return (
    <a href={x.hrefFor(slug)} className={`btn-link ${className}`} aria-label={`${x.ui("Details", "डिटेल")}: ${x.t(it.name)}`} onClick={(e) => { e.preventDefault(); go(slug); }}>
      {x.ui("Details", "डिटेल")} <Icon name="arrow-right" size={16} />
    </a>
  );
}

/** The cover photo as a button that opens the item's photos in the lightbox; nothing when the item has no photo. The box that
 *  holds it (a class from the variant) sets the size, so the page never shifts when the picture arrives. */
function Cover({ it, x, className = "", eager = false, sizes, badge = true }: {
  it: Offering; x: AdvCtx; className?: string; eager?: boolean; sizes: string; badge?: boolean;
}) {
  if (!it.images[0]) return null;
  return (
    <button type="button" className={`cz-cover ${className}`} onClick={() => x.zoom(it.images, 0, x.t(it.name))} aria-label={`${x.ui("View photo", "फ़ोटो देखें")}: ${x.t(it.name)}`}>
      <Photo src={it.images[0]} alt="" sizes={sizes} eager={eager} />
      {badge && it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}
    </button>
  );
}

/** "12 more - ask us" under the list, when the card has more than the page draws. */
function More({ o, x }: { o: Off; x: AdvCtx }) {
  const n = o.total - o.items.length;
  if (n <= 0 || !x.wa) return null;
  return (
    <p className="cz-more">
      <a href={x.waHref()} target="_blank" rel="noreferrer" className="btn-link" onClick={() => x.track("services-more")}>
        {x.hi ? `और ${n} देखने के लिए पूछें` : `${n} more - ask us`} <Icon name="arrow-right" size={16} />
      </a>
    </p>
  );
}

/* ================= feature-cards ================= */

export function ServicesFeatureCards({ c, x, index }: VariantProps) {
  const o = c.offerings; if (!o) return null;
  // An odd count lets the first card lead across the full width and the rest pair up with no hole.
  const lead = o.items.length % 2 === 1;
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} />
      <div className="cfc">
        {o.items.map((it, i) => {
          const big = lead && i === 0;
          return (
            <article key={i} className="adv-card adv-lift cfc-card" data-lead={big ? "" : undefined} data-photo={it.images[0] ? "" : undefined}>
              <Cover it={it} x={x} className="cfc-media" eager={i < 2} sizes={big ? "(min-width: 900px) 55vw, 100vw" : "(min-width: 900px) 46vw, 100vw"} />
              <div className="cfc-body">
                <div className="cfc-top">
                  <span className="cfc-no" aria-hidden="true">{pad2(i)}</span>
                  {!it.images[0] && it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}
                </div>
                <h3 className="cz-name">{x.t(it.name)}</h3>
                {it.desc && <p className="cz-desc cfc-desc">{x.t(it.desc)}</p>}
                <div className="cfc-foot">
                  <Price it={it} x={x} />
                  <div className="adv-btn-row">
                    <Ask it={it} c={c} x={x} kind="primary" />
                    <Details it={it} x={x} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <More o={o} x={x} />
    </Sec>
  );
}

/* ================= price-list ================= */

export function ServicesPriceList({ c, x, index }: VariantProps) {
  const o = c.offerings; if (!o) return null;
  // One thumbnail column for the whole list as soon as any item has a photo (rows without one keep an empty slot, so the names line up).
  const thumbs = o.items.some((it) => it.images[0]);
  const part = o.total > o.items.length;
  const count = x.hi
    ? (part ? `${o.total} में से ${o.items.length} यहाँ` : `${o.total} ${o.kind === "products" ? "आइटम" : "सेवाएँ"}`)
    : (part ? `${o.items.length} of ${o.total} shown` : `${o.total} ${o.kind === "products" ? "items" : "services"}`);
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="cpl">
        <div className="cpl-aside">
          <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} />
          <p className="cpl-count">{count}</p>
          <More o={o} x={x} />
        </div>
        <ul className="cpl-list">
          {o.items.map((it, i) => (
            <li key={i} className="cpl-row" data-thumbs={thumbs ? "" : undefined}>
              {thumbs && (it.images[0]
                ? <Cover it={it} x={x} className="cpl-thumb" eager={i < 4} sizes="72px" badge={false} />
                : <span className="cpl-thumb cpl-gap" aria-hidden="true" />)}
              <div className="cpl-main">
                <h3 className="cz-name cpl-name">{x.t(it.name)}{it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}</h3>
                {it.desc && <p className="cz-desc cpl-desc">{x.t(it.desc)}</p>}
                <Details it={it} x={x} className="cpl-details" />
              </div>
              <div className="cpl-end">
                <Price it={it} x={x} className="cpl-p" />
                <Ask it={it} c={c} x={x} icon />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Sec>
  );
}

/* ================= magazine ================= */

/** How many columns / rows each tile spans on the four-column desktop grid, so the last row never has a hole: tile 0 is the
 *  2x2 lead; the tiles beside it fill the 2x2 block to its right; later rows hold four, and a short last row stretches to fill. */
function spansFor(n: number): { cs: number; rs: number }[] {
  const one = { cs: 1, rs: 1 };
  if (n === 1) return [{ cs: 4, rs: 2 }];
  const out = [{ cs: 2, rs: 2 }];
  let left = n - 1;
  // Beside the lead: a 2-column, 2-row block. One tile fills it; two stack as wide strips; three put one wide strip above two.
  const beside = Math.min(4, left);
  out.push(...(beside === 1 ? [{ cs: 2, rs: 2 }] : beside === 2 ? [{ cs: 2, rs: 1 }, { cs: 2, rs: 1 }] : beside === 3 ? [{ cs: 2, rs: 1 }, one, one] : [one, one, one, one]));
  left -= beside;
  // Then rows of four; a short last row stretches (one -> full width, two -> halves, three -> a wide one and two).
  while (left > 0) {
    const k = Math.min(4, left);
    out.push(...(k === 1 ? [{ cs: 4, rs: 1 }] : k === 2 ? [{ cs: 2, rs: 1 }, { cs: 2, rs: 1 }] : k === 3 ? [{ cs: 2, rs: 1 }, one, one] : [one, one, one, one]));
    left -= k;
  }
  return out;
}

export function ServicesMagazine({ c, x, index }: VariantProps) {
  const o = c.offerings; if (!o) return null;
  const spans = spansFor(o.items.length);
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="cmg-head">
        <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} />
        <More o={o} x={x} />
      </div>
      <div className="cmg">
        {o.items.map((it, i) => {
          const lead = i === 0;
          const photo = !!it.images[0];
          return (
            <article key={i} className="cmg-tile" data-i={i} data-photo={photo ? "" : undefined} data-cs={spans[i].cs} data-rs={spans[i].rs}>
              <Cover it={it} x={x} className="cmg-cover" eager={i < 3} sizes={lead ? "(min-width: 900px) 50vw, 100vw" : "(min-width: 900px) 25vw, 50vw"} />
              <div className="cmg-cap">
                {!photo && it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}
                <h3 className="cz-name cmg-name">{x.t(it.name)}</h3>
                {lead && it.desc && <p className="cmg-desc">{x.t(it.desc)}</p>}
                <div className="cmg-row">
                  <Price it={it} x={x} className="cmg-price" />
                  <div className="cmg-act">
                    <Details it={it} x={x} className="cmg-details" />
                    <Ask it={it} c={c} x={x} icon />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Sec>
  );
}

/* ================= scroller ================= */

function ScrollerInner({ c, x, o, index }: { c: SiteContent; x: AdvCtx; o: Off; index: number }) {
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false, fit: false });
  const sync = useCallback(() => {
    const el = track.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2, fit: max <= 2 };
    setEdge((e) => (e.start === next.start && e.end === next.end && e.fit === next.fit ? e : next));
    if (bar.current) bar.current.style.transform = `scaleX(${max > 2 ? Math.min(1, Math.max(0.08, (el.scrollLeft + el.clientWidth) / el.scrollWidth)) : 1})`;
  }, []);
  useEffect(() => {
    const el = track.current; if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const ro = "ResizeObserver" in window ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); ro?.disconnect(); };
  }, [sync, o.items.length]);
  const go = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="csc-head">
        <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} />
        <div className="csc-nav" data-fit={edge.fit ? "" : undefined}>
          <button type="button" className="cz-iconbtn" onClick={() => go(-1)} disabled={edge.start} aria-label={x.ui("Previous", "पिछला")}><Icon name="arrow-right" size={18} className="csc-prev" /></button>
          <button type="button" className="cz-iconbtn" onClick={() => go(1)} disabled={edge.end} aria-label={x.ui("Next", "अगला")}><Icon name="arrow-right" size={18} /></button>
        </div>
      </div>
      <div ref={track} className="csc-track" tabIndex={0} role="group" aria-label={`${x.t(o.title)} - ${x.ui("scroll sideways", "बगल में स्क्रोल करें")}`}>
        <ul className="csc-list">
          {o.items.map((it, i) => (
            <li key={i} className="csc-item">
              <article className="adv-card adv-lift csc-card">
                <Cover it={it} x={x} className="csc-media" eager={i < 3} sizes="(min-width: 640px) 320px, 72vw" />
                <div className="csc-body">
                  {!it.images[0] && <span className="cfc-no" aria-hidden="true">{pad2(i)}</span>}
                  {!it.images[0] && it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}
                  <h3 className="cz-name csc-name">{x.t(it.name)}</h3>
                  {it.desc && <p className="cz-desc csc-desc">{x.t(it.desc)}</p>}
                  <div className="csc-foot">
                    <Price it={it} x={x} />
                    <div className="csc-act">
                      <Details it={it} x={x} />
                      <Ask it={it} c={c} x={x} icon />
                    </div>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
      <div className="csc-prog" aria-hidden="true" data-fit={edge.fit ? "" : undefined}><span ref={bar} /></div>
      <More o={o} x={x} />
    </Sec>
  );
}
export function ServicesScroller(p: VariantProps) {
  const o = p.c.offerings; if (!o) return null;
  return <ScrollerInner c={p.c} x={p.x} o={o} index={p.index} />;
}

/* ================= category-tabs ================= */

type Group = { key: string; label: string; idx: number[] };

/** The tabs this card can honestly offer, or null when it has no useful split (then the items are simply laid out, no tabs).
 *  The card has no category field, so the split comes from what exists: the owner's own badges, else three price bands, else
 *  "on offer". "All" is always first. */
function groupsFor(o: Off, x: AdvCtx): Group[] | null {
  const items = o.items;
  if (items.length < 4) return null;
  const all: Group = { key: "all", label: x.ui("All", "सभी"), idx: items.map((_, i) => i) };

  const badges = new Map<string, Group>();
  items.forEach((it, i) => {
    const b = (it.badge ?? "").trim(); if (!b) return;
    const k = b.toLowerCase();
    const g = badges.get(k) ?? { key: `b-${badges.size}`, label: x.t(b), idx: [] };
    g.idx.push(i); badges.set(k, g);
  });
  if (badges.size >= 2 && badges.size <= 5) return [all, ...badges.values()];

  const priced = items.map((it, i) => ({ i, p: amount(it.price) })).filter((r): r is { i: number; p: number } => r.p !== null);
  if (priced.length >= 6) {
    const sorted = priced.map((r) => r.p).sort((a, b) => a - b);
    // Two cut points at the thirds, rounded to two significant digits so the labels read like a shopper's ("Under 500").
    const nice = (n: number) => { const m = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.round(n / m) * m; };
    const b1 = nice(sorted[Math.floor(sorted.length / 3)]), b2 = nice(sorted[Math.floor((sorted.length * 2) / 3)]);
    if (b1 > 0 && b2 > b1) {
      const cur = (/^[^\d]*/.exec(items.find((it) => amount(it.price))?.price ?? "")?.[0] ?? "").trim() || "₹";
      const f = (n: number) => `${cur}${cur.length > 1 ? " " : ""}${inr(n)}`;
      const bands: Group[] = [
        { key: "p0", label: x.hi ? `${f(b1)} से कम` : `Under ${f(b1)}`, idx: priced.filter((r) => r.p < b1).map((r) => r.i) },
        { key: "p1", label: `${f(b1)} - ${f(b2)}`, idx: priced.filter((r) => r.p >= b1 && r.p < b2).map((r) => r.i) },
        { key: "p2", label: x.hi ? `${f(b2)} से ऊपर` : `${f(b2)} & up`, idx: priced.filter((r) => r.p >= b2).map((r) => r.i) },
      ];
      if (bands.every((g) => g.idx.length > 0)) return [all, ...bands];
    }
  }

  const deals = items.map((it, i) => (offPct(it) > 0 ? i : -1)).filter((i) => i >= 0);
  if (deals.length >= 2 && deals.length < items.length) return [all, { key: "deal", label: x.ui("On offer", "ऑफ़र पर"), idx: deals }];
  return null;
}

function TabItem({ it, c, x, eager }: { it: Offering; c: SiteContent; x: AdvCtx; eager: boolean }) {
  return (
    <article className="adv-card adv-lift ctb-item" data-photo={it.images[0] ? "" : undefined}>
      <Cover it={it} x={x} className="ctb-media" eager={eager} sizes="(min-width: 640px) 140px, 112px" badge={false} />
      <div className="ctb-body">
        {it.badge && <span className="cz-badge ctb-badge">{x.t(it.badge)}</span>}
        <h3 className="cz-name ctb-name">{x.t(it.name)}</h3>
        {it.desc && <p className="cz-desc ctb-desc">{x.t(it.desc)}</p>}
        <div className="ctb-foot">
          <Price it={it} x={x} />
          <div className="ctb-act">
            <Details it={it} x={x} />
            <Ask it={it} c={c} x={x} icon />
          </div>
        </div>
      </div>
    </article>
  );
}

function TabsInner({ c, x, o, index }: { c: SiteContent; x: AdvCtx; o: Off; index: number }) {
  const uid = useId();
  const groups = groupsFor(o, x);
  const [picked, setPicked] = useState("all");
  // A tab that no longer exists (the language changed what the card splits on) falls back to "All".
  const active = groups?.some((g) => g.key === picked) ? picked : "all";
  const pick = (key: string) => {
    setPicked(key);
    // Keep the chosen tab in view in a scrolling tab bar, without moving the page.
    window.requestAnimationFrame(() => document.getElementById(`${uid}-t-${key}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));
  };
  const onKey = (e: React.KeyboardEvent, at: number) => {
    if (!groups) return;
    const to = e.key === "ArrowRight" ? (at + 1) % groups.length : e.key === "ArrowLeft" ? (at - 1 + groups.length) % groups.length : e.key === "Home" ? 0 : e.key === "End" ? groups.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault(); pick(groups[to].key); document.getElementById(`${uid}-t-${groups[to].key}`)?.focus();
  };
  const card = (it: Offering, i: number) => <TabItem key={i} it={it} c={c} x={x} eager={i < 4} />;
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} />
      {groups ? (
        <>
          <div className="ctb-tabs" role="tablist" aria-label={x.t(o.title)}>
            {groups.map((g, at) => (
              <button key={g.key} id={`${uid}-t-${g.key}`} type="button" role="tab" className="ctb-tab" aria-selected={active === g.key} aria-controls={`${uid}-p-${g.key}`}
                tabIndex={active === g.key ? 0 : -1} onClick={() => pick(g.key)} onKeyDown={(e) => onKey(e, at)}>
                {g.label}<span className="ctb-n" aria-hidden="true">{g.idx.length}</span>
              </button>
            ))}
          </div>
          {/* Every panel sits in the same grid cell: the box is as tall as the tallest, so switching tabs never moves the page. */}
          <div className="ctb-panels">
            {groups.map((g) => (
              <div key={g.key} id={`${uid}-p-${g.key}`} role="tabpanel" aria-labelledby={`${uid}-t-${g.key}`} className="ctb-panel" data-on={active === g.key ? "" : undefined} inert={active !== g.key}>
                <div className="ctb-grid">{g.idx.map((i) => card(o.items[i], i))}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="ctb-grid">{o.items.map((it, i) => card(it, i))}</div>
      )}
      <More o={o} x={x} />
    </Sec>
  );
}
export function ServicesCategoryTabs(p: VariantProps) {
  const o = p.c.offerings; if (!o) return null;
  return <TabsInner c={p.c} x={p.x} o={o} index={p.index} />;
}

/* ================= menu-leaders ================= */

export function ServicesMenuLeaders({ c, x, index }: VariantProps) {
  const o = c.offerings; if (!o) return null;
  // Round thumbnails only when at least half the items have a photo (a menu with two pictures among ten reads as a mistake).
  const thumbs = o.items.filter((it) => it.images[0]).length * 2 >= o.items.length;
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"}>
      <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} className="cml-head" />
      <ul className="cml-list">
        {o.items.map((it, i) => (
          <li key={i} className="cml-item" data-thumbs={thumbs ? "" : undefined}>
            {thumbs && (it.images[0]
              ? <Cover it={it} x={x} className="cml-thumb" eager={i < 4} sizes="56px" badge={false} />
              : <span className="cml-thumb cml-gap" aria-hidden="true" />)}
            <div className="cml-main">
              <div className="cml-line">
                <h3 className="cz-name cml-name">{x.t(it.name)}</h3>
                {it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}
                <span className="cml-dots" aria-hidden="true" />
                {it.price ? <Price it={it} x={x} className="cml-price" /> : <Ask it={it} c={c} x={x} kind="link" />}
              </div>
              {it.desc && <p className="cz-desc cml-desc">{x.t(it.desc)}</p>}
              {it.price && (
                <div className="cml-act">
                  <Ask it={it} c={c} x={x} kind="link" />
                  <Details it={it} x={x} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="cml-more"><More o={o} x={x} /></div>
    </Sec>
  );
}

/* ================= tiers ================= */

/** A product line as a short list of points: split on new lines, bullets, ";" or "|" (and on commas when it is a run of short
 *  items); a plain sentence stays a sentence. */
function pointsOf(desc?: string): { list: string[]; text?: string } {
  const d = (desc ?? "").trim();
  if (!d) return { list: [] };
  let parts = d.split(/\n+|\s*[•·|;]\s*/).map((s) => s.replace(/^[-–—✓✔*]\s*/, "").trim()).filter(Boolean);
  if (parts.length < 2) {
    const commas = d.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
    if (commas.length >= 3 && commas.every((s) => s.length <= 40)) parts = commas;
  }
  return parts.length >= 2 ? { list: parts.slice(0, 7) } : { list: [], text: d };
}

export function ServicesTiers({ c, x, index }: VariantProps) {
  const o = c.offerings; if (!o) return null;
  // Only a tier the owner badged is lifted: the page never invents a "most popular".
  const feat = o.items.findIndex((it) => !!it.badge);
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={kindLabel(o, x)} title={x.t(o.title)} className="ctr-headline" />
      <div className="ctr">
        {o.items.map((it, i) => {
          const { list, text } = pointsOf(it.desc);
          const on = i === feat;
          return (
            <article key={i} className={`ctr-tier ${on ? "ctr-feat hero-dark" : ""}`}>
              <Cover it={it} x={x} className="ctr-media" eager={i < 3} sizes="(min-width: 900px) 380px, 100vw" badge={false} />
              <div className="ctr-body">
                <div className="ctr-top">
                  <span className="ctr-no" aria-hidden="true">{pad2(i)}</span>
                  {it.badge && <span className="cz-badge">{x.t(it.badge)}</span>}
                </div>
                <h3 className="cz-name ctr-name">{x.t(it.name)}</h3>
                <Price it={it} x={x} className="ctr-price" />
                {text && <p className="cz-desc ctr-text">{x.t(text)}</p>}
                {list.length > 0 && (
                  <ul className="ctr-points">
                    {list.map((p, k) => <li key={k}><Icon name="check" size={16} strokeWidth={2} /><span>{x.t(p)}</span></li>)}
                  </ul>
                )}
                <div className="ctr-cta">
                  <Ask it={it} c={c} x={x} kind={on ? "primary" : "ghost"} label={x.wa ? x.ui("Enquire on WhatsApp", "WhatsApp पर पूछें") : undefined} className="ctr-ask" />
                  <Details it={it} x={x} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <More o={o} x={x} />
    </Sec>
  );
}

/* ================= CSS ================= */

export const CATALOG_CSS = `
.site[data-adv] .cz-sm{min-height:44px;padding:0 var(--s4);font-size:14px}
.cz-cover{position:relative;display:block;width:100%;padding:0;border:0;background:var(--paper-2);color:inherit;cursor:zoom-in;overflow:hidden}
.cz-cover:focus-visible{outline-offset:-3px}
.cz-cover .adv-photo{position:absolute;inset:0;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
.cz-cover:hover .adv-photo{transform:scale(1.045)}
.cz-badge{display:inline-flex;align-items:center;align-self:flex-start;padding:.3em .8em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent);font-size:12px;font-weight:600;line-height:1.25;letter-spacing:.02em;white-space:nowrap}
.cz-cover .cz-badge{position:absolute;top:var(--s3);left:var(--s3)}
.cz-name{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.2rem,2.2vw,1.55rem);line-height:1.15;letter-spacing:var(--display-tr);margin:0;text-wrap:balance}
.site:lang(hi) .cz-name{line-height:1.38;letter-spacing:0;font-weight:var(--display-w-hi)}
.cz-desc{margin:0;font-size:.9375rem;line-height:1.6;color:var(--muted);text-wrap:pretty}
.cz-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:.1em .6em;margin:0;font-variant-numeric:tabular-nums lining-nums}
.cz-now{font-size:1.125rem;font-weight:600;color:var(--ink)}
.cz-mrp{font-size:.875rem;color:var(--muted)}
.cz-off{padding:.15em .65em;border-radius:var(--r-pill);background:var(--accent-soft);color:var(--ink);font-size:12px;font-weight:600;line-height:1.4}
.cz-iconbtn{display:inline-grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:1px solid var(--line);border-radius:var(--r-pill);background:transparent;color:var(--ink);cursor:pointer;text-decoration:none;transition:background .15s,color .15s,border-color .15s}
.cz-iconbtn:hover:not(:disabled){background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.cz-iconbtn:disabled{opacity:.35;cursor:default}
.cz-more{margin:var(--s5) 0 0}
.cfc-card,.csc-card,.ctb-item{transition:border-color .25s,box-shadow .25s}
.cfc-card:hover,.cfc-card:focus-within,.csc-card:hover,.csc-card:focus-within,.ctb-item:hover,.ctb-item:focus-within{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}

/* feature-cards */
.cfc{display:grid;gap:var(--gap);grid-template-columns:minmax(0,1fr)}
.cfc-card{display:flex;flex-direction:column}
.cfc-media{aspect-ratio:4/3}
.cfc-body{display:flex;flex-direction:column;gap:var(--s3);flex:1;padding:clamp(1.25rem,3vw,2rem)}
.cfc-top{display:flex;align-items:center;gap:var(--s3);min-height:1.2em}
.cfc-no{font-size:var(--t-meta);font-weight:600;letter-spacing:.14em;color:var(--accent);font-variant-numeric:tabular-nums}
.cfc-desc{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.cfc-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s3) var(--s4);margin-top:auto;padding-top:var(--s4);border-top:1px solid var(--line)}
.cfc-foot .cz-now{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.4rem,2.6vw,1.8rem)}
@media (min-width:900px){
  .cfc{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cfc-card[data-lead]{grid-column:1/-1}
  .cfc-card[data-lead][data-photo]{display:grid;grid-template-columns:1.15fr 1fr}
  .cfc-card[data-lead] .cfc-media{aspect-ratio:auto;height:100%;min-height:440px}
  .cfc-card[data-lead] .cz-name{font-size:clamp(1.8rem,3.4vw,2.6rem)}
  .cfc-card[data-lead] .cfc-desc{-webkit-line-clamp:7}
  .cfc-card[data-lead] .cfc-body{justify-content:center;padding:clamp(2rem,4vw,3.5rem)}
  .cfc-card[data-lead] .cfc-foot{margin-top:var(--s4)}
}

/* price-list */
.cpl{display:grid;gap:clamp(1.5rem,4vw,3rem)}
.cpl-aside .adv-head{margin-bottom:var(--s4)}
.cpl-count{margin:0;font-size:var(--t-meta);color:var(--muted)}
.cpl-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.cpl-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--s2) var(--s4);padding:var(--s4) var(--s2);border-bottom:1px solid var(--line);transition:background .2s}
.cpl-row[data-thumbs]{grid-template-columns:56px minmax(0,1fr) auto}
.cpl-row:hover,.cpl-row:focus-within{background:color-mix(in srgb,var(--accent) 6%,transparent)}
.cpl-thumb{width:56px;height:56px;border-radius:var(--r-img);flex:none}
.cpl-gap{display:block;background:none}
.cpl-main{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
.cpl-name{display:flex;flex-wrap:wrap;align-items:center;gap:.2em .6em;font-size:clamp(1.05rem,1.8vw,1.25rem)}
.cpl-name .cz-badge{font-size:11px}
.cpl-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cpl-details{font-size:14px}
.cpl-end{display:flex;flex-direction:column;align-items:flex-end;gap:var(--s2);text-align:right}
.cpl-p{justify-content:flex-end;flex-direction:column;align-items:flex-end;gap:2px}
@media (min-width:640px){.cpl-row[data-thumbs]{grid-template-columns:72px minmax(0,1fr) auto}.cpl-thumb{width:72px;height:72px}.cpl-end{flex-direction:row;align-items:center;gap:var(--s4)}}
@media (min-width:1000px){.cpl{grid-template-columns:minmax(0,4fr) minmax(0,8fr);align-items:start}.cpl-aside{position:sticky;top:96px}}

/* magazine */
.cmg-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s3) var(--s5)}
.cmg-head .cz-more{margin:0 0 clamp(2rem,5vw,3.5rem)}
.cmg{display:grid;gap:var(--s2);grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:clamp(220px,58vw,320px)}
.cmg-tile{position:relative;isolation:isolate;overflow:hidden;border-radius:var(--r-card);background:var(--accent-soft);color:var(--ink)}
.cmg-tile[data-i="0"]{grid-column:1/-1}
@media (max-width:899px){.cmg-tile:last-child:nth-child(even){grid-column:1/-1}}
.cmg-cover{position:absolute;inset:0;width:100%;height:100%}
.cmg-tile[data-photo]::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to top,color-mix(in srgb,var(--hero-ink) 90%,transparent) 0%,color-mix(in srgb,var(--hero-ink) 45%,transparent) 40%,transparent 68%)}
.cmg-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;flex-direction:column;gap:var(--s2);padding:clamp(.9rem,2vw,1.4rem);pointer-events:none}
.cmg-tile:not([data-photo]) .cmg-cap{top:0;justify-content:flex-end}
.cmg-cap a,.cmg-cap button{pointer-events:auto}
.cmg-tile[data-photo] .cmg-cap{color:var(--hero-text)}
.cmg-tile[data-photo] .cz-now,.cmg-tile[data-photo] .cz-name{color:var(--hero-text)}
.cmg-tile[data-photo] .cz-mrp{color:var(--hero-muted)}
.cmg-tile[data-photo] .cz-off{background:rgb(255 255 255/.16);color:var(--hero-text)}
.cmg-tile[data-photo] .cz-iconbtn{border-color:rgb(255 255 255/.4);color:var(--hero-text);background:rgb(0 0 0/.18)}
.cmg-tile[data-photo] .btn-link{color:var(--hero-text)}
.cmg-name{font-size:clamp(1.05rem,2.2vw,1.35rem)}
.cmg-tile[data-i="0"] .cmg-name{font-size:clamp(1.6rem,4.4vw,2.9rem);max-width:18ch}
.cmg-desc{margin:0;max-width:46ch;font-size:.9375rem;line-height:1.55;color:var(--hero-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cmg-tile:not([data-photo]) .cmg-desc{color:var(--muted)}
.cmg-row{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--s3)}
.cmg-act{display:flex;align-items:center;gap:var(--s3);margin-left:auto}
.cmg-details{font-size:14px}
.cmg-cap .cz-now{font-size:1rem}
.cmg-tile[data-i="0"] .cz-now{font-size:clamp(1.3rem,2.6vw,1.8rem)}
@media (min-width:900px){
  .cmg{grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s3);grid-auto-rows:clamp(250px,22vw,330px)}
  .cmg-tile{grid-column:span 1;grid-row:span 1}
  .cmg-tile[data-cs="2"]{grid-column:span 2}.cmg-tile[data-cs="4"]{grid-column:span 4}
  .cmg-tile[data-rs="2"]{grid-row:span 2}
}
@media (max-width:1199px) and (min-width:900px){.cmg-details{display:none}}

/* scroller */
.csc-head{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--s4)}
.csc-nav{display:flex;gap:var(--s2);margin-bottom:clamp(2rem,5vw,3.5rem)}
.csc-nav[data-fit]{visibility:hidden}
.csc-prev{transform:scaleX(-1)}
.csc-track{margin-inline:calc(var(--gutter) * -1);padding:var(--s3) var(--gutter) var(--s5);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scroll-padding-inline:var(--gutter);scrollbar-width:none}
.csc-track::-webkit-scrollbar{display:none}
.csc-list{display:flex;gap:var(--gap);list-style:none;margin:0;padding:0}
.csc-item{flex:0 0 clamp(250px,72vw,330px);scroll-snap-align:start;display:flex}
.csc-card{display:flex;flex-direction:column;width:100%}
.csc-media{aspect-ratio:4/5}
.csc-body{display:flex;flex-direction:column;gap:var(--s2);flex:1;padding:var(--s4) var(--s4) var(--s4)}
.csc-name{font-size:clamp(1.1rem,1.8vw,1.3rem)}
.csc-desc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:.875rem}
.csc-foot{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);margin-top:auto;padding-top:var(--s3)}
.csc-act{display:flex;align-items:center;gap:var(--s3)}
.csc-prog{height:2px;margin-top:var(--s2);background:var(--line);border-radius:2px;overflow:hidden}
.csc-prog[data-fit]{visibility:hidden}
.csc-prog span{display:block;height:100%;background:var(--accent);transform-origin:left;transform:scaleX(.3);transition:transform .15s linear}

/* category-tabs */
.ctb-tabs{display:flex;gap:var(--s2);margin:0 calc(var(--gutter) * -1) clamp(1.5rem,3vw,2.25rem);padding:4px var(--gutter);overflow-x:auto;scrollbar-width:none}
.ctb-tabs::-webkit-scrollbar{display:none}
.ctb-tab{display:inline-flex;align-items:center;gap:.55em;flex:none;min-height:44px;padding:0 var(--s4);border:1px solid var(--line);border-radius:var(--r-pill);background:transparent;color:var(--muted);font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}
.ctb-tab:hover{border-color:var(--ink);color:var(--ink)}
.ctb-tab[aria-selected=true]{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.ctb-n{font-size:11px;font-weight:600;opacity:.65;font-variant-numeric:tabular-nums}
.ctb-panels{display:grid}
.ctb-panel{grid-area:1/1;visibility:hidden;opacity:0;transition:opacity .25s}
.ctb-panel[data-on]{visibility:visible;opacity:1}
.ctb-grid{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));align-content:start}
.ctb-item{display:flex;align-items:stretch}
.ctb-media{flex:none;width:112px;min-height:136px;align-self:stretch}
.ctb-body{display:flex;flex-direction:column;gap:var(--s2);flex:1;min-width:0;padding:var(--s4)}
.ctb-badge{font-size:11px}
.ctb-name{font-size:clamp(1.05rem,1.8vw,1.2rem)}
.ctb-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.875rem}
.ctb-foot{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);margin-top:auto;padding-top:var(--s2)}
.ctb-act{display:flex;align-items:center;gap:var(--s3)}
@media (min-width:640px){.ctb-media{width:140px}}

/* menu-leaders */
.adv-head.cml-head{margin-inline:auto;text-align:center}
.cml-head .adv-lede{margin-inline:auto}
.cml-head .adv-h2{text-wrap:balance}
.cml-head::after{content:"";display:block;width:44px;height:2px;background:var(--accent);margin:var(--s5) auto 0}
.cml-list{list-style:none;margin:0 auto;padding:0;max-width:1000px;columns:1;column-gap:clamp(2.5rem,6vw,5rem)}
.cml-item{display:flex;align-items:flex-start;gap:var(--s4);break-inside:avoid;padding:var(--s4) 0}
.cml-thumb{width:56px;height:56px;border-radius:var(--r-pill);flex:none}
.cml-gap{display:block;background:none}
.cml-main{flex:1;min-width:0}
.cml-line{display:flex;align-items:baseline;gap:var(--s2)}
.cml-name{font-size:clamp(1.05rem,1.8vw,1.25rem);min-width:0}
.cml-dots{flex:1;min-width:1.25rem;align-self:baseline;border-bottom:2px dotted color-mix(in srgb,var(--muted) 55%,transparent);transform:translateY(-.3em)}
.cml-price{flex:none;justify-content:flex-end}
.cml-price .cz-off{display:none}
.cml-price .cz-now{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.1rem,1.8vw,1.3rem)}
.cml-desc{margin-top:4px;max-width:48ch;font-size:.875rem}
.cml-act{display:flex;align-items:center;gap:var(--s4);margin-top:var(--s2);font-size:14px}
.cml-act .btn-link,.cml-line .btn-link{font-size:14px}
.cml-more{text-align:center}
@media (min-width:900px){.cml-list{columns:2}}

/* tiers */
.adv-head.ctr-headline{margin-inline:auto;text-align:center}
.ctr-headline .adv-lede{margin-inline:auto}
.ctr{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--gap)}
.ctr-tier{display:flex;flex-direction:column;flex:1 1 270px;min-width:0;max-width:400px;border:1px solid var(--line);border-radius:var(--r-card);background:var(--paper);overflow:hidden;transition:border-color .25s,box-shadow .25s}
.ctr-tier:hover,.ctr-tier:focus-within{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));box-shadow:var(--e-1)}
.ctr-feat{--ink:var(--hero-text);--muted:var(--hero-muted);--line:var(--hero-line);--paper:var(--hero-ink);border-color:var(--hero-ink)}
.ctr-feat:hover,.ctr-feat:focus-within{border-color:var(--accent)}
.ctr-media{aspect-ratio:16/10}
.ctr-body{display:flex;flex-direction:column;gap:var(--s3);flex:1;padding:clamp(1.25rem,2.6vw,1.75rem)}
.ctr-top{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);min-height:1.4em}
.ctr-no{font-size:var(--t-meta);font-weight:600;letter-spacing:.14em;color:var(--muted);font-variant-numeric:tabular-nums}
.ctr-name{font-size:clamp(1.3rem,2.4vw,1.65rem)}
.ctr-price{flex-direction:row;padding-bottom:var(--s4);border-bottom:1px solid var(--line)}
.ctr-price .cz-now{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2rem,4vw,2.75rem);line-height:1.05;letter-spacing:var(--display-tr)}
.ctr-text{flex:1}
.ctr-points{list-style:none;margin:0;padding:0;display:grid;gap:var(--s2);flex:1;align-content:start}
.ctr-points li{display:flex;gap:var(--s3);align-items:flex-start;font-size:.9375rem;line-height:1.5;color:var(--ink)}
.ctr-points svg{flex:none;margin-top:.2em;color:var(--accent)}
.ctr-cta{display:flex;flex-direction:column;align-items:stretch;gap:var(--s3);margin-top:auto;padding-top:var(--s4)}
.ctr-cta .ctr-ask{width:100%}
.ctr-cta .btn-link{justify-content:center}
.ctr-feat .ctr-points svg{color:var(--hero-text)}
@media (min-width:900px){.ctr-feat{box-shadow:var(--e-1)}}
`;
