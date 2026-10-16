"use client";
// An item's own page on the advanced website (owner, 16 Oct 2026: "a real, complete, multi-page premium site" - the product page is
// where a visitor decides). Three layouts, chosen from what the item is, never from the owner's choice:
//   shop   an item with photos: a swipeable gallery (thumbs, hover zoom, lightbox), a sticky buy panel (price, saving, quantity,
//          the WhatsApp enquiry built from it), the highlights and the specifications, reviews, and a rail of similar items
//   dish   a food item with photos: an ink stage with the dish large, a stamp, the order stepper, "what is in it" tiles, and the
//          rest of the menu as ruled rows
//   offer  a service / course / plan (or any item without a photo): a typographic stage with the price as a ticket, what is
//          included, how it works as a timeline, a booking card (day + time chips that write the message), other offerings
// Nothing is invented: the trust row is the owner's own "good to know" lines, then plain facts about how to reach the shop (never a
// warranty, a delivery time or a stock figure); a rating is never drawn. Colour, corner and type come from the root tokens.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { AdvItem, AdvancedSpec } from "@/lib/site-advanced";
import { catalogLabel, recipeFor } from "@/lib/site-recipes";
import { Pic } from "@/components/pic";
import { Icon, iconFor, type IconName } from "@/components/site-icons";
import { linkHref } from "@/components/link-icon";
import { Photo, Sec, Stars, splitUnit, type SiteContent } from "@/components/site-adv/shared";
import { Crumbs, type AdvCtxPlus, type AdvPageEntry } from "@/components/site-adv/nav";
import { Cover, ItemCard, ShareBtn, askText, enquireLabel, photosOf, priceOf } from "@/components/site-adv/page-parts";

type Props = { c: SiteContent; x: AdvCtxPlus; item: AdvItem; items: AdvItem[]; entry?: AdvPageEntry; spec?: AdvancedSpec };
type Mode = "shop" | "dish" | "offer";
type Money = ReturnType<typeof priceOf>;

/* ================= small helpers ================= */

/** 1234567 -> "12,34,567": the Indian grouping, written by hand so the server and the browser always agree. */
function inr(n: number): string {
  const s = String(Math.round(n));
  return s.length <= 3 ? s : `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${s.slice(-3)}`;
}
/** A number written like `sample` ("₹499" -> "₹1,497"), so the total keeps the owner's currency sign. */
function like(sample: string, n: number): string {
  const cur = (/^[^\d]*/.exec(sample)?.[0] ?? "").trim();
  return `${cur || "₹"}${inr(n)}`;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
/** What the item is, from the trade's catalogue word and whether it has a photo. */
function modeOf(item: AdvItem, cat: string | undefined, photos: string[]): Mode {
  if (!photos.length || item.kind === "service") return "offer";
  const word = recipeFor(cat ?? "").catalog;
  // Food gets the dish stage, things you buy get the shop layout; a treatment, course, plan or project reads as an offer.
  return word === "menu" ? "dish" : word === "products" ? "shop" : "offer";
}
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The id of the last section whose top has passed the sticky bars: one observer wakes the check, no scroll handler. */
function useActive(ids: string[]): string {
  const [on, setOn] = useState(ids[0] ?? "");
  const key = ids.join("|");
  useEffect(() => {
    const els = key.split("|").map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const check = () => {
      const passed = els.filter((e) => e.getBoundingClientRect().top <= 160);
      setOn((passed[passed.length - 1] ?? els[0]).id);
    };
    const io = new IntersectionObserver(check, { rootMargin: "-130px 0px -50% 0px", threshold: [0, 0.01, 0.5, 1] });
    els.forEach((e) => io.observe(e));
    check();
    return () => io.disconnect();
  }, [key]);
  return on;
}

/** The quantity and what it writes: the enquiry text and the total, from the item's price when it is a number. */
function useOrder(x: AdvCtxPlus, c: SiteContent, name: string, pr: Money, fixedText?: string) {
  const [qty, setQty] = useState(1);
  const n = x.t(name);
  const text = fixedText ?? (qty > 1
    ? (x.hi ? `नमस्ते ${c.name}, मैंने आपकी website देखी — मुझे "${n}" की ${qty} नग चाहिए${pr.price ? ` (${pr.price} प्रति)` : ""}।` : `Hi ${c.name}, I saw your website — I'd like ${qty} × "${n}"${pr.price ? ` (${pr.price} each)` : ""}.`)
    : askText(x, c, name, pr.price));
  const total = pr.num && qty > 1 ? like(pr.price, pr.num * qty) : "";
  return { qty, setQty, total, text, link: x.wa ? x.waHref(text) : "" };
}

/* ================= gallery: swipe, thumbnails, hover zoom, lightbox ================= */

function Gallery({ photos, label, x, tags, aspect = "shop" }: { photos: string[]; label: string; x: AdvCtxPlus; tags?: ReactNode; aspect?: "shop" | "dish" }) {
  const track = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const [i, setI] = useState(0);
  const many = photos.length > 1;
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = track.current; if (!el || !el.clientWidth) return;
      const k = Math.round(el.scrollLeft / el.clientWidth);
      setI((p) => (p === k ? p : k));
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const go = useCallback((k: number) => {
    const el = track.current; if (!el) return;
    const to = (k + photos.length) % photos.length;
    el.scrollTo({ left: to * el.clientWidth, behavior: reduced() ? "auto" : "smooth" });
  }, [photos.length]);
  const aim = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--ox", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--oy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div className="pg" data-aspect={aspect}>
      <div className="pg-stage">
        <div ref={track} className="pg-track" onScroll={onScroll} tabIndex={many ? 0 : undefined} role={many ? "group" : undefined} aria-roledescription={many ? "carousel" : undefined}
          aria-label={many ? `${label} - ${x.ui("photos", "फ़ोटो")}` : undefined}
          onKeyDown={(e) => { if (!many) return; if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); } }}>
          {photos.map((p, k) => (
            <div key={p} className="pg-slide" aria-label={many ? `${k + 1} / ${photos.length}` : undefined}>
              <button type="button" className="pg-zoom" onClick={() => x.zoom(photos, k, label)} onMouseMove={aim} aria-label={`${label}: ${x.ui("view larger", "बड़ा देखें")}`}>
                <Cover fallback={label}><Pic src={p} alt={k === 0 ? label : ""} className="adv-photo" eager={k === 0} priority={k === 0} sizes="(min-width:900px) 52vw, 100vw" /></Cover>
              </button>
            </div>
          ))}
        </div>
        {tags}
        {many && (
          <>
            <button type="button" className="pg-arrow" data-dir="prev" onClick={() => go(i - 1)} aria-label={x.ui("Previous photo", "पिछली फ़ोटो")}><ChevronLeft size={20} /></button>
            <button type="button" className="pg-arrow" data-dir="next" onClick={() => go(i + 1)} aria-label={x.ui("Next photo", "अगली फ़ोटो")}><ChevronRight size={20} /></button>
            <span className="pg-count" aria-hidden="true">{pad2(i + 1)}<i> / {pad2(photos.length)}</i></span>
          </>
        )}
        <span className="pg-hint" aria-hidden="true">{x.ui("Tap to zoom", "बड़ा करें")}</span>
      </div>
      {many && (
        <ul className="pg-thumbs" aria-label={x.ui("Photos", "फ़ोटो")}>
          {photos.map((p, k) => (
            <li key={p}>
              <button type="button" aria-label={`${x.ui("Photo", "फ़ोटो")} ${k + 1}`} aria-current={k === i ? "true" : undefined} onClick={() => go(k)}><Photo src={p} sizes="96px" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================= pieces of the buy panel ================= */

function Tags({ badge, off, x }: { badge?: string; off: number; x: AdvCtxPlus }) {
  if (!badge && !off) return null;
  return <span className="ic-tags">{badge && <em>{x.t(badge)}</em>}{off > 0 && <em data-off="">{off}% {x.ui("off", "छूट")}</em>}</span>;
}

function PriceBlock({ pr, x, big = false }: { pr: Money; x: AdvCtxPlus; big?: boolean }) {
  if (!pr.price && !pr.mrp) return <p className="pd-noprice">{x.ui("Price on request", "दाम पूछकर बताया जाएगा")}</p>;
  const was = pr.mrp ? Number(pr.mrp.replace(/[^0-9.]/g, "")) : 0;
  const save = was && pr.num && was > pr.num ? was - pr.num : 0;
  const unit = splitUnit(pr.price);
  return (
    <div className="pd-price" data-big={big ? "" : undefined}>
      <p className="pd-now"><b>{x.t(unit ? unit.fig : pr.price)}</b>{unit && <span className="pd-unit">{x.t(unit.unit)}</span>}{pr.mrp && <s><span className="sr-only">{x.ui("Original price", "असली दाम")} </span>{pr.mrp}</s>}</p>
      {save > 0 && <p className="pd-save"><Icon name="tag" size={14} /> {x.ui(`You save ${like(pr.price, save)} (${pr.off}%)`, `आपकी बचत ${like(pr.price, save)} (${pr.off}%)`)}</p>}
    </div>
  );
}

function Qty({ v, set, x, total }: { v: number; set: (n: number) => void; x: AdvCtxPlus; total: string }) {
  return (
    <div className="pd-qty">
      <span id="pd-qty-l" className="pd-qty-l">{x.ui("Quantity", "मात्रा")}</span>
      <div className="pd-step" role="group" aria-labelledby="pd-qty-l">
        <button type="button" onClick={() => set(Math.max(1, v - 1))} disabled={v <= 1} aria-label={x.ui("One less", "एक कम")}><Minus size={16} /></button>
        <output aria-live="polite">{v}</output>
        <button type="button" onClick={() => set(Math.min(99, v + 1))} aria-label={x.ui("One more", "एक और")}><Plus size={16} /></button>
      </div>
      {total && <span className="pd-total">{x.ui("Total", "कुल")} <b>{total}</b></span>}
    </div>
  );
}

/** The call to act: the WhatsApp enquiry (or a call when the card has no WhatsApp), a call and the share. */
function Acts({ x, c, it, cat, link, label, share }: { x: AdvCtxPlus; c: SiteContent; it: { ctaLabel?: string }; cat?: string; link: string; label: string; share: string }) {
  void c;
  return (
    <div className="pd-acts">
      {x.wa
        ? <a className="btn-primary pd-wa" href={link} target="_blank" rel="noreferrer" onClick={() => x.track("item-enquire")}><Icon name="whatsapp" size={20} /> {enquireLabel(x, it, cat)}</a>
        : x.phone && <a className="btn-primary pd-wa" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("item-call")}><Icon name="phone" size={20} /> {x.ui("Call to order", "कॉल करें")}</a>}
      <div className="pd-acts-2">
        {x.wa && x.phone && <a className="btn-ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("item-call")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</a>}
        <ShareBtn x={x} title={share} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Three reassurances: the owner's own lines first, then plain facts about reaching the shop (nothing promised that the card did not say). */
function Trust({ c, x }: { c: SiteContent; x: AdvCtxPlus }) {
  const own = c.highlights.slice(0, 3).map((h) => ({ text: x.t(h), icon: (iconFor(h) ?? "check") as IconName }));
  const plain: { text: string; icon: IconName }[] = [
    ...(x.wa ? [{ text: x.ui("Ask anything on WhatsApp", "कुछ भी WhatsApp पर पूछें"), icon: "whatsapp" as IconName }] : []),
    ...(x.phone ? [{ text: x.ui("Or call the shop directly", "या सीधे दुकान को कॉल करें"), icon: "phone" as IconName }] : []),
    ...(c.visit?.address ? [{ text: x.ui("Visit and see it in person", "आकर खुद देखें"), icon: "pin" as IconName }] : []),
  ];
  const rows = [...own, ...plain].slice(0, 3);
  if (!rows.length) return null;
  return (
    <ul className="pd-trust" aria-label={x.ui("Good to know", "जानने लायक")}>
      {rows.map((r, k) => <li key={k}><span aria-hidden="true"><Icon name={r.icon} size={18} /></span>{r.text}</li>)}
    </ul>
  );
}

/** How to order and where to find the shop: two closed rows in the panel (native <details>: keyboard and screen reader for free). */
function Fold({ c, x, mode }: { c: SiteContent; x: AdvCtxPlus; mode: Mode }) {
  const steps = c.steps.length >= 2
    ? c.steps.slice(0, 4).map((s) => ({ name: x.t(s.name), desc: s.desc ? x.t(s.desc) : "" }))
    : mode === "offer"
      ? [{ name: x.ui("Message us", "हमें मैसेज करें"), desc: "" }, { name: x.ui("We confirm the details and the time", "हम जानकारी और समय बताएँगे"), desc: "" }, { name: x.ui("We take it from there", "आगे का काम हम संभालेंगे"), desc: "" }]
      : [{ name: x.ui("Send us the item on WhatsApp", "आइटम WhatsApp पर भेजें"), desc: "" }, { name: x.ui("We confirm the price and availability", "हम दाम और उपलब्धता बताएँगे"), desc: "" }, { name: x.ui("Pick it up or ask for delivery", "खुद आकर लें या डिलीवरी पूछें"), desc: "" }];
  const v = c.visit;
  const map = v?.mapUrl || x.mapLink?.value;
  return (
    <div className="pd-fold">
      <details>
        <summary>{x.ui("How to order", "ऑर्डर कैसे करें")}<Icon name="chevron-down" size={18} /></summary>
        <ol>{steps.map((s, k) => <li key={k}><b>{s.name}</b>{s.desc && <span>{s.desc}</span>}</li>)}</ol>
      </details>
      {(v?.address || v?.hours.length) && (
        <details>
          <summary>{x.ui("Visit the shop", "दुकान पर आएँ")}<Icon name="chevron-down" size={18} /></summary>
          <div className="pd-visit">
            {v.address && <p><Icon name="pin" size={16} /><span>{x.t(v.address)}</span></p>}
            {v.hours.slice(0, 3).map((h, k) => <p key={k} className="pd-hrs"><span>{x.t(h.day)}</span><b>{h.time}</b></p>)}
            {map && <a className="btn-link" href={map} target="_blank" rel="noreferrer" onClick={() => x.track("item-directions")}>{x.ui("Get directions", "रास्ता देखें")} <Icon name="arrow-up-right" size={14} /></a>}
          </div>
        </details>
      )}
    </div>
  );
}

/* ================= sections under the item ================= */

function Highlights({ feats, x, id, title }: { feats: string[]; x: AdvCtxPlus; id: string; title: string }) {
  if (!feats.length) return null;
  return (
    <section id={id} className="pd-sec" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="pd-h">{title}</h2>
      <ol className="pd-feats">
        {feats.map((f, k) => <li key={k}><span className="pd-feat-n" aria-hidden="true">{pad2(k + 1)}</span><span>{x.t(f)}</span></li>)}
      </ol>
    </section>
  );
}

function Specs({ specs, x, id, title, tiles = false }: { specs: { label: string; value: string }[]; x: AdvCtxPlus; id: string; title: string; tiles?: boolean }) {
  if (!specs.length) return null;
  return (
    <section id={id} className="pd-sec" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="pd-h">{title}</h2>
      {tiles ? (
        <dl className="pd-tiles">{specs.map((s, k) => <div key={k}><dd data-long={s.value.length > 22 ? "" : undefined}>{x.t(s.value)}</dd><dt>{x.t(s.label)}</dt></div>)}</dl>
      ) : (
        <dl className="pd-specs">{specs.map((s, k) => <div key={k}><dt>{x.t(s.label)}</dt><dd>{x.t(s.value)}</dd></div>)}</dl>
      )}
    </section>
  );
}

function Reviews({ c, x, id }: { c: SiteContent; x: AdvCtxPlus; id: string }) {
  const r = c.reviews;
  if (!r.items.length) return null;
  return (
    <section id={id} className="pd-sec" aria-labelledby={`${id}-h`}>
      <div className="pd-rev-head">
        <h2 id={`${id}-h`} className="pd-h">{x.ui("What customers say", "ग्राहक क्या कहते हैं")}</h2>
        {r.avg > 0 && r.total >= 2 && <p className="pd-avg"><Stars n={r.avg} size={15} /><b>{r.avg.toFixed(1)}</b><span>{x.hi ? `${r.total} रिव्यू` : `${r.total} reviews`}</span></p>}
      </div>
      <ul className="pd-revs">
        {r.items.map((t, k) => (
          <li key={k}>
            {t.rating > 0 && <Stars n={t.rating} size={13} />}
            <blockquote>{x.t(t.text)}</blockquote>
            <p><b>{x.t(t.name)}</b></p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A swipeable shelf of other items of the same page (arrows on a laptop, a swipe on a phone). */
function Rail({ list, c, x, cat, title, entry, ids }: { list: AdvItem[]; c: SiteContent; x: AdvCtxPlus; cat?: string; title: string; entry?: AdvPageEntry; ids?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const sync = useCallback(() => {
    const el = track.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const n = { start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 };
    setEdge((e) => (e.start === n.start && e.end === n.end ? e : n));
  }, []);
  useEffect(() => {
    sync();
    const el = track.current; if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    const ro = "ResizeObserver" in window ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", sync); ro?.disconnect(); };
  }, [sync, list.length]);
  const go = (d: 1 | -1) => track.current?.scrollBy({ left: d * Math.max(260, (track.current?.clientWidth ?? 0) * 0.8), behavior: reduced() ? "auto" : "smooth" });
  if (!list.length) return null;
  return (
    <Sec k="related" tone="alt" wide label={title}>
      <div id={ids} className="pd-rail-head">
        <h2 className="adv-h2">{title}</h2>
        <div className="pd-rail-nav">
          {entry && <a className="btn-link" href={entry.href} onClick={(e) => { e.preventDefault(); x.goto?.(entry.slug); }}>{x.ui("See all", "सभी देखें")} <Icon name="arrow-right" /></a>}
          {list.length > 2 && (
            <>
              <button type="button" className="pd-rb" onClick={() => go(-1)} disabled={edge.start} aria-label={x.ui("Previous", "पिछला")}><ChevronLeft size={18} /></button>
              <button type="button" className="pd-rb" onClick={() => go(1)} disabled={edge.end} aria-label={x.ui("Next", "अगला")}><ChevronRight size={18} /></button>
            </>
          )}
        </div>
      </div>
      <div ref={track} className="pd-rail" tabIndex={0} role="group" aria-label={`${title} - ${x.ui("scroll sideways", "बगल में स्क्रोल करें")}`}>
        {list.map((o, i) => <div key={o.slug} className="pd-rail-i"><ItemCard it={o} x={x} c={c} layout="cards" i={i} cat={cat} /></div>)}
      </div>
    </Sec>
  );
}

/** Previous and next item of the same page, as two big links: the visitor keeps browsing without going back. */
function Neighbours({ item, items, x }: { item: AdvItem; items: AdvItem[]; x: AdvCtxPlus }) {
  const row = items.filter((o) => o.page === item.page && o.kind === item.kind);
  const at = row.findIndex((o) => o.slug === item.slug);
  if (row.length < 3 || at < 0) return null;
  const prev = row[(at - 1 + row.length) % row.length], next = row[(at + 1) % row.length];
  const link = (o: AdvItem, dir: "prev" | "next") => (
    <a href={x.hrefFor(o.slug)} data-dir={dir} onClick={(e) => { e.preventDefault(); x.goto?.(o.slug); }}>
      <small>{dir === "prev" ? x.ui("Previous", "पिछला") : x.ui("Next", "अगला")}</small>
      <span>{x.t(o.item.name)}</span>
      <Icon name="arrow-right" size={22} />
    </a>
  );
  return <nav className="pd-nb" aria-label={x.ui("More items", "और आइटम")}><div className="adv-wrap adv-wide">{link(prev, "prev")}{link(next, "next")}</div></nav>;
}

/** The closing band: the one thing to do next. */
function EndBand({ c, x, link, item }: { c: SiteContent; x: AdvCtxPlus; link: string; item: string }) {
  if (!x.wa && !x.phone) return null;
  return (
    <section className="pd-end hero-dark" aria-label={x.ui("Ask us", "हमसे पूछें")}>
      <div className="adv-wrap adv-wide pd-end-in">
        <p>{x.ui("Interested in", "आपको पसंद आया")}<b>{item}</b></p>
        <div className="adv-btn-row">
          {x.wa && <a className="btn-primary" href={link} target="_blank" rel="noreferrer" onClick={() => x.track("item-end-enquire")}><Icon name="whatsapp" /> {x.ui("Message us", "मैसेज करें")}</a>}
          {x.phone && <a className="btn-ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("item-end-call")}><Icon name="phone" /> {x.hi ? `${c.name} को कॉल करें` : `Call ${c.name}`}</a>}
        </div>
      </div>
    </section>
  );
}

/** The in-page tab bar: where the visitor is, and a way to jump (the shop layout, from the research on Shopify's product pages). */
function Tabs({ tabs, x }: { tabs: { id: string; label: string }[]; x: AdvCtxPlus }) {
  const on = useActive(tabs.map((t) => t.id));
  if (tabs.length < 3) return null;
  return (
    <nav className="pd-tabs" aria-label={x.ui("On this page", "इस पेज पर")}>
      <div className="adv-wrap adv-wide">
        <ul>
          {tabs.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} aria-current={on === t.id ? "true" : undefined}
                onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); }}>{t.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/* ================= the page ================= */

export function ProductPage({ c, x, item, items, entry }: Props) {
  const it = item.item;
  const photos = photosOf(it);
  const pr = priceOf(it);
  const cat = x.card.seo?.categoryKey;
  const mode = modeOf(item, cat, photos);
  const label = x.t(it.name);
  const feats = (it.features ?? []).map((f) => f.trim()).filter(Boolean);
  const specs = (it.specs ?? []).filter((s) => s.label?.trim() && s.value?.trim());
  const word = catalogLabel(recipeFor(cat ?? "").catalog, x.hi ? "hi" : "en");
  const catEntry = entry ?? x.pages.byRole("catalogue");
  const wantQty = mode !== "offer" && !!pr.num && recipeFor(cat ?? "").cta === "order";
  const related = useMemo(() => {
    const others = items.filter((o) => o.slug !== item.slug && o.kind === item.kind);
    const same = others.filter((o) => (o.item.category ?? "") === (it.category ?? "") && o.page === item.page);
    return [...same, ...others.filter((o) => !same.includes(o))].slice(0, 8);
  }, [items, item, it.category]);
  const trail = [...(catEntry ? [{ label: x.t(catEntry.label), slug: catEntry.slug }] : [{ label: word }]), { label }];
  // Its place among the items of its page, for the big numeral of the offer stage.
  const num = Math.max(1, items.filter((o) => o.page === item.page && o.kind === item.kind).findIndex((o) => o.slug === item.slug) + 1);
  const ctx = { c, x, item, items, entry: catEntry, label, photos, pr, feats, specs, word, cat, wantQty, related, trail, mode, num };
  // The phone's sticky enquiry bar is for when the page's own button has scrolled away: while that button is on screen the bar steps
  // aside (a flag on <body> that the CSS reads), so the first screen never shows two enquiry buttons.
  useEffect(() => {
    const btn = document.querySelector(".pd-wa");
    if (!btn || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([r]) => { document.body.toggleAttribute("data-pdcta", r.isIntersecting); }, { rootMargin: "0px 0px -56px 0px" });
    io.observe(btn);
    return () => { io.disconnect(); document.body.removeAttribute("data-pdcta"); };
  }, [item.slug]);
  return (
    <>
      {mode === "shop" ? <Shop {...ctx} /> : mode === "dish" ? <Dish {...ctx} /> : <Offer {...ctx} />}
      <Neighbours item={item} items={items} x={x} />
    </>
  );
}

type Ctx = {
  c: SiteContent; x: AdvCtxPlus; item: AdvItem; items: AdvItem[]; entry?: AdvPageEntry; label: string; photos: string[]; pr: Money;
  feats: string[]; specs: { label: string; value: string }[]; word: string; cat?: string; wantQty: boolean; related: AdvItem[]; trail: { label: string; slug?: string }[]; mode: Mode; num: number;
};

/* ---------- shop ---------- */

function Shop({ c, x, item, entry, label, photos, pr, feats, specs, word, cat, wantQty, related, trail }: Ctx) {
  const it = item.item;
  const o = useOrder(x, c, it.name, pr);
  const tabs = [
    { id: "pd-top", label: x.ui("Overview", "एक नज़र") },
    ...(feats.length ? [{ id: "pd-feats", label: x.ui("Highlights", "खासियतें") }] : []),
    ...(specs.length ? [{ id: "pd-specs", label: x.ui("Details", "विवरण") }] : []),
    ...(c.reviews.items.length ? [{ id: "pd-revs", label: x.ui("Reviews", "रिव्यू") }] : []),
    ...(related.length ? [{ id: "pd-more", label: x.ui("Similar", "मिलते-जुलते") }] : []),
  ];
  return (
    <>
      <Tabs tabs={tabs} x={x} />
      <section id="pd-top" className="pd" data-mode="shop" aria-labelledby="pd-title">
        <div className="adv-wrap adv-wide">
          <div className="pd-crumb"><Crumbs x={x} trail={trail} /></div>
          <div className="pd-grid">
            <div className="pd-gal"><Gallery photos={photos} label={label} x={x} tags={<Tags badge={it.badge} off={pr.off} x={x} />} /></div>
            <div className="pd-pan">
              <p className="kicker">{x.t(it.category || entry?.label || word)}</p>
              <h1 id="pd-title" className="pd-title">{label}</h1>
              <PriceBlock pr={pr} x={x} />
              {it.desc && <p className="pd-desc">{x.t(it.desc)}</p>}
              {wantQty && <Qty v={o.qty} set={o.setQty} x={x} total={o.total} />}
              <Acts x={x} c={c} it={it} cat={cat} link={o.link} label={label} share={`${label} — ${c.name}`} />
              <Trust c={c} x={x} />
              <Fold c={c} x={x} mode="shop" />
            </div>
            <div className="pd-more">
              <Highlights feats={feats} x={x} id="pd-feats" title={x.ui("Why you will like it", "क्यों पसंद आएगा")} />
              <Specs specs={specs} x={x} id="pd-specs" title={x.ui("Details", "विवरण")} />
              <Reviews c={c} x={x} id="pd-revs" />
            </div>
          </div>
        </div>
      </section>
      <Rail list={related} c={c} x={x} cat={cat} title={x.ui("You may also like", "ये भी देखिए")} entry={entry} ids="pd-more" />
      <EndBand c={c} x={x} link={o.link} item={label} />
    </>
  );
}

/* ---------- dish ---------- */

function Dish({ c, x, item, entry, label, photos, pr, feats, specs, word, cat, wantQty, related, trail }: Ctx) {
  const it = item.item;
  const o = useOrder(x, c, it.name, pr);
  const stamp = (it.badge ?? "").trim() || (pr.off > 0 ? `${pr.off}% ${x.ui("off", "छूट")}` : "");
  return (
    <>
      <section id="pd-top" className="pd pd-dish hero-dark" data-mode="dish" aria-labelledby="pd-title">
        <div className="adv-wrap adv-wide">
          <div className="pd-crumb"><Crumbs x={x} trail={trail} /></div>
          <div className="pd-dish-grid">
            <div className="pd-dish-words">
              <p className="kicker">{x.t(it.category || entry?.label || word)}</p>
              <h1 id="pd-title" className="pd-title">{label}</h1>
              {it.desc && <p className="pd-desc">{x.t(it.desc)}</p>}
              <PriceBlock pr={pr} x={x} big />
              {wantQty && <Qty v={o.qty} set={o.setQty} x={x} total={o.total} />}
              <Acts x={x} c={c} it={it} cat={cat} link={o.link} label={label} share={`${label} — ${c.name}`} />
            </div>
            <div className="pd-dish-pic">
              <Gallery photos={photos} label={label} x={x} aspect="dish" />
              {stamp && <span className="pd-stamp" aria-hidden="true"><span>{x.t(stamp)}</span></span>}
            </div>
          </div>
        </div>
      </section>
      {(feats.length > 0 || specs.length > 0) && (
        <section className="pd pd-body">
          <div className="adv-wrap adv-wide pd-dish-body">
            <Highlights feats={feats} x={x} id="pd-feats" title={x.ui("What is in it", "इसमें क्या है")} />
            <Specs specs={specs} x={x} id="pd-specs" title={x.ui("At a glance", "एक नज़र में")} tiles />
          </div>
        </section>
      )}
      <section className="pd pd-body pd-two">
        <div className="adv-wrap adv-wide pd-dish-body">
          <Trust c={c} x={x} />
          <Fold c={c} x={x} mode="dish" />
        </div>
      </section>
      {related.length > 0 && (
        <Sec k="related" tone="alt" wide label={x.ui("More from the menu", "मेन्यू में और")}>
          <div className="pd-rail-head"><h2 className="adv-h2">{x.ui("More from the menu", "मेन्यू में और")}</h2>
            {entry && <a className="btn-link" href={entry.href} onClick={(e) => { e.preventDefault(); x.goto?.(entry.slug); }}>{x.ui("Full menu", "पूरा मेन्यू")} <Icon name="arrow-right" /></a>}
          </div>
          <div className="cg-grid" data-layout="list">
            {related.slice(0, 5).map((r, i) => <ItemCard key={r.slug} it={r} x={x} c={c} layout="list" i={i} cat={cat} />)}
          </div>
        </Sec>
      )}
      <EndBand c={c} x={x} link={o.link} item={label} />
    </>
  );
}

/* ---------- offer (service, course, plan, or anything without a photo) ---------- */

const DAYS: [string, string][] = [["Today", "आज"], ["Tomorrow", "कल"], ["This weekend", "इस वीकेंड"], ["Any day", "कोई भी दिन"]];
const TIMES: [string, string][] = [["Morning", "सुबह"], ["Afternoon", "दोपहर"], ["Evening", "शाम"]];

function Offer({ c, x, item, entry, label, photos, pr, feats, specs, word, cat, related, trail, num }: Ctx) {
  const it = item.item;
  const [day, setDay] = useState(-1);
  const [time, setTime] = useState(-1);
  const when = [day >= 0 && x.ui(DAYS[day][0], DAYS[day][1]), time >= 0 && x.ui(TIMES[time][0], TIMES[time][1])].filter(Boolean).join(", ");
  const base = askText(x, c, it.name, pr.price);
  const text = when ? `${base} ${x.ui("Preferred time", "पसंदीदा समय")}: ${when}.` : base;
  const link = x.wa ? x.waHref(text) : "";
  const book = cat && recipeFor(cat).cta === "book";
  // Day and time chips make sense for work done at a time (a service, a treatment, a class), not for a thing you buy.
  const scheduled = item.kind === "service" || !(["products", "menu"] as string[]).includes(recipeFor(cat ?? "").catalog);
  const faq = c.faq.slice(0, 4);
  const steps = c.steps.slice(0, 5);
  const pic = photos[0];
  return (
    <>
      <section id="pd-top" className="pd pd-offer hero-dark" data-mode="offer" aria-labelledby="pd-title">
        {pic && <div className="pd-offer-bg" aria-hidden="true"><Pic src={pic} alt="" className="adv-photo" eager sizes="60vw" /></div>}
        <div className="pd-offer-glow" aria-hidden="true" />
        <div className="adv-wrap adv-wide">
          <div className="pd-crumb"><Crumbs x={x} trail={trail} /></div>
          <div className="pd-offer-grid">
            <div className="pd-offer-words">
              <p className="pd-offer-no" aria-hidden="true">{pad2(num)}</p>
              <p className="kicker">{x.t(it.category || (item.kind === "service" ? c.trade : word))}</p>
              <h1 id="pd-title" className="pd-title">{label}</h1>
              {it.desc && <p className="pd-desc">{x.t(it.desc)}</p>}
              {it.badge && <p className="pd-offer-badge">{x.t(it.badge)}</p>}
            </div>
            <aside className="pd-ticket" aria-label={x.ui("Price and booking", "दाम और बुकिंग")}>
              <p className="pd-ticket-k">{x.ui("Price", "दाम")}</p>
              {(pr.price || pr.mrp)
                ? <PriceBlock pr={pr} x={x} big />
                : <p className="pd-ticket-ask">{x.ui("On request - tell us what you need and we will quote it", "बताइए क्या चाहिए, हम दाम बताएँगे")}</p>}
              {(x.wa || x.phone) && (
                <>
                  {scheduled && (
                  <fieldset className="pd-chips">
                    <legend>{book ? x.ui("When would you like to come?", "कब आना चाहेंगे?") : x.ui("When would you like it?", "कब चाहिए?")}</legend>
                    <div role="group" aria-label={x.ui("Day", "दिन")}>
                      {DAYS.map((d, k) => <button key={d[0]} type="button" aria-pressed={day === k} onClick={() => setDay(day === k ? -1 : k)}>{x.ui(d[0], d[1])}</button>)}
                    </div>
                    <div role="group" aria-label={x.ui("Time of day", "समय")}>
                      {TIMES.map((d, k) => <button key={d[0]} type="button" aria-pressed={time === k} onClick={() => setTime(time === k ? -1 : k)}>{x.ui(d[0], d[1])}</button>)}
                    </div>
                  </fieldset>
                  )}
                  <Acts x={x} c={c} it={it} cat={cat} link={link} label={label} share={`${label} — ${c.name}`} />
                </>
              )}
            </aside>
          </div>
        </div>
      </section>
      <section className="pd pd-body" aria-label={x.ui("About this", "इसके बारे में")}>
        <div className="adv-wrap adv-wide pd-offer-body">
          <div className="pd-offer-main">
            {photos.length > 1 && (
              <figure className="pd-offer-fig">
                <Cover fallback={label}><Pic src={photos[1]} alt={label} className="adv-photo" sizes="(min-width:900px) 52vw, 100vw" /></Cover>
              </figure>
            )}
            {feats.length > 0 && (
              <section id="pd-feats" className="pd-sec" aria-labelledby="pd-feats-h">
                <h2 id="pd-feats-h" className="pd-h">{x.ui("What is included", "इसमें क्या मिलता है")}</h2>
                <ul className="pd-incl">
                  {feats.map((f, k) => <li key={k}><span aria-hidden="true"><Icon name="check" size={16} strokeWidth={2} /></span>{x.t(f)}</li>)}
                </ul>
              </section>
            )}
            <Specs specs={specs} x={x} id="pd-specs" title={x.ui("Details", "विवरण")} tiles />
            {steps.length >= 2 && (
              <section id="pd-steps" className="pd-sec" aria-labelledby="pd-steps-h">
                <h2 id="pd-steps-h" className="pd-h">{x.ui("How it works", "कैसे काम होता है")}</h2>
                <ol className="pd-time">
                  {steps.map((s, k) => <li key={k}><span className="pd-time-n" aria-hidden="true">{pad2(k + 1)}</span><div><b>{x.t(s.name)}</b>{s.desc && <p>{x.t(s.desc)}</p>}</div></li>)}
                </ol>
              </section>
            )}
          </div>
          <div className="pd-offer-side">
            <Trust c={c} x={x} />
            {faq.length > 0 && (
              <section className="pd-sec" aria-labelledby="pd-faq-h">
                <h2 id="pd-faq-h" className="pd-h">{x.ui("Common questions", "आम सवाल")}</h2>
                <div className="pd-fold pd-faq">
                  {faq.map((q, k) => <details key={k}><summary>{x.t(q.q)}<Icon name="chevron-down" size={18} /></summary><p>{x.t(q.a)}</p></details>)}
                </div>
              </section>
            )}
            <Fold c={c} x={x} mode="offer" />
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <Sec k="related" tone="alt" wide label={x.ui("More to choose from", "और विकल्प")}>
          <div className="pd-rail-head">
            <h2 className="adv-h2">{x.ui("More to choose from", "और विकल्प")}</h2>
            {entry && <a className="btn-link" href={entry.href} onClick={(e) => { e.preventDefault(); x.goto?.(entry.slug); }}>{x.ui("See all", "सभी देखें")} <Icon name="arrow-right" /></a>}
          </div>
          <div className="cg-grid" data-layout="list">
            {related.slice(0, 6).map((r, i) => <ItemCard key={r.slug} it={r} x={x} c={c} layout="list" i={i} cat={cat} />)}
          </div>
        </Sec>
      )}
      <EndBand c={c} x={x} link={link} item={label} />
    </>
  );
}
/* ================= CSS ================= */

export const PRODUCT_CSS = `
/* ---- item page: shared ---- */
/* The dark stages re-point the colour tokens at the hero's ink, as a dark section does, so every child written for paper reads right. */
.pd-dish,.pd-offer,.pd-end{--ink:var(--hero-text);--muted:var(--hero-muted);--line:var(--hero-line);--paper:var(--hero-ink);--paper-2:color-mix(in srgb,var(--hero-ink) 86%,#fff)}
.pd-dish .pd-save,.pd-offer .pd-save{background:color-mix(in srgb,var(--accent) 30%,transparent)}
.pd-dish .pd-save svg,.pd-offer .pd-save svg{color:var(--hero-text)}
.pd{position:relative;background:var(--paper);padding-block:clamp(1rem,3vw,2rem) clamp(2.5rem,6vw,5rem)}
.pd-crumb{margin-bottom:clamp(1.25rem,3vw,2.25rem)}
.pd-title{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.1rem,5vw,3.9rem);line-height:1.02;letter-spacing:var(--display-tr);text-wrap:balance;overflow-wrap:anywhere;margin:0}
.site:lang(hi) .pd-title{line-height:1.25;letter-spacing:0;font-weight:var(--display-w-hi)}
.pd .kicker{margin:0}
.pd-desc{margin:0;font-size:var(--t-sub);line-height:1.6;color:var(--muted);text-wrap:pretty;max-width:54ch}
.pd-h{font-family:var(--font-text);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 var(--s4);display:flex;align-items:center;gap:var(--s3)}
.pd-h::after{content:"";flex:1;height:1px;background:var(--line)}
.pd-sec{scroll-margin-top:130px;margin-top:clamp(2rem,5vw,3.5rem)}
.pd-sec:first-child{margin-top:0}
/* price */
.pd-price{display:grid;gap:var(--s2)}
.pd-now{display:flex;align-items:baseline;flex-wrap:wrap;gap:.2em .75em;margin:0;font-variant-numeric:tabular-nums lining-nums}
.pd-now b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2rem,4vw,2.9rem);line-height:1;letter-spacing:var(--display-tr)}
.pd-price[data-big] .pd-now b{font-size:clamp(2.6rem,6vw,4.4rem)}
.pd-now s{font-size:1.15rem;color:var(--muted)}
.pd-unit{font-size:1.1rem;color:var(--muted);font-weight:500}
.pd-noprice{margin:0;font-family:var(--font-display);font-size:1.5rem;line-height:1.2;color:var(--muted)}
.pd-save{display:inline-flex;align-items:center;gap:.5em;width:fit-content;margin:0;padding:.4em .9em;border-radius:var(--r-pill);background:var(--accent-soft);color:var(--ink);font-size:13.5px;font-weight:600}
.pd-save svg{color:var(--accent)}
/* quantity */
.pd-qty{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.pd-qty-l{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.pd-step{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:var(--r-pill);overflow:hidden}
.pd-step button{display:grid;place-items:center;width:48px;height:48px;border:0;background:none;color:var(--ink);cursor:pointer;transition:background .2s}
.pd-step button:hover:not(:disabled){background:var(--accent-soft)}
.pd-step button:disabled{opacity:.35;cursor:default}
.pd-step output{min-width:2.4em;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}
.pd-total{font-size:14px;color:var(--muted)}.pd-total b{color:var(--ink);font-size:1.15rem;font-variant-numeric:tabular-nums}
/* actions */
.pd-acts{display:grid;gap:var(--s2)}
.pd-wa{width:100%;min-height:58px!important;font-size:16.5px!important;gap:.6em}
.pd-wa:hover{background:color-mix(in srgb,var(--wa) 68%,#000)!important;color:#fff!important;filter:none!important}
.pd-acts-2{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)}
.pd-acts-2 .btn-ghost{flex:1 1 140px;justify-content:center}
.pd-acts-2 .pp-share{flex:none}
/* trust */
.pd-trust{display:grid;gap:var(--s3);margin:0;padding:var(--s4) 0 0;list-style:none;border-top:1px solid var(--line)}
.pd-trust li{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:var(--s3);font-size:var(--t-meta);line-height:1.4;color:var(--ink)}
.pd-trust li>span{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent-soft);color:var(--accent)}
/* fold */
.pd-fold{border-top:1px solid var(--line)}
.pd-fold details{border-bottom:1px solid var(--line)}
.pd-fold summary{display:flex;align-items:center;justify-content:space-between;gap:var(--s4);min-height:52px;padding-block:.5em;cursor:pointer;list-style:none;font-weight:600;font-size:15px}
.pd-fold summary::-webkit-details-marker{display:none}
.pd-fold summary svg{flex:none;transition:transform .3s;color:var(--muted)}
.pd-fold details[open] summary svg{transform:rotate(180deg)}
.pd-fold details>:not(summary){padding-bottom:var(--s4)}
.pd-fold ol{display:grid;gap:var(--s3);margin:0;padding:0 0 var(--s4);list-style:none;counter-reset:s}
.pd-fold ol li{display:grid;gap:2px;position:relative;padding-left:2.6rem;counter-increment:s;font-size:var(--t-meta);line-height:1.45}
.pd-fold ol li::before{content:counter(s);position:absolute;left:0;top:0;display:grid;place-items:center;width:1.8rem;height:1.8rem;border-radius:50%;border:1px solid var(--accent);color:var(--accent);font-size:12.5px;font-weight:600}
.pd-fold ol li span{color:var(--muted)}
.pd-fold p{margin:0;font-size:var(--t-meta);line-height:1.6;color:var(--muted)}
.pd-visit{display:grid;gap:var(--s2);font-size:var(--t-meta);color:var(--muted);line-height:1.5}
.pd-visit p{display:flex;gap:var(--s3);align-items:flex-start}
.pd-visit svg{flex:none;margin-top:3px;color:var(--accent)}
.pd-hrs{justify-content:space-between}.pd-hrs b{color:var(--ink);font-weight:500;font-variant-numeric:tabular-nums}
.pd-visit .btn-link{width:fit-content}
/* highlights, specs, reviews */
.pd-feats{display:grid;gap:0;margin:0;padding:0;list-style:none;counter-reset:f;border-top:1px solid var(--line)}
.pd-feats li{display:grid;grid-template-columns:3.2rem 1fr;align-items:baseline;gap:var(--s3);padding-block:var(--s4);border-bottom:1px solid var(--line);font-size:var(--t-body);line-height:1.5}
.pd-feat-n{font-family:var(--font-display);font-size:1.4rem;color:var(--accent);font-variant-numeric:tabular-nums}
@media (min-width:700px){.pd-feats{grid-template-columns:1fr 1fr;column-gap:var(--s7)}}
.pd-specs{margin:0;border-top:1px solid var(--line)}
.pd-specs>div{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:var(--s4);padding:.9em 0;border-bottom:1px solid var(--line);font-size:var(--t-body)}
.pd-specs dt{color:var(--muted)}.pd-specs dd{margin:0;font-weight:500}
.pd-tiles{display:grid;gap:var(--s3);margin:0;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.pd-tiles>div{display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:6px;padding:var(--s5);border:1px solid var(--line);border-radius:var(--r-card);background:var(--paper)}
.pd-tiles dd{margin:0;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.3rem,2.6vw,1.8rem);line-height:1.1;letter-spacing:var(--display-tr)}
/* A sentence as a value (a fee note, a timing) is set as text, not as a headline; an odd last tile on a phone takes the whole row (16 Oct 2026 QA). */
.pd-tiles dd[data-long]{font-size:clamp(1.05rem,2vw,1.2rem);line-height:1.35}
@media (max-width:560px){.pd-tiles>div:last-child:nth-child(odd){grid-column:1/-1}}
.pd-tiles dt{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pd-rev-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:var(--s3)}
.pd-rev-head .pd-h{flex:1 1 auto}
.pd-avg{display:flex;align-items:center;gap:.6em;margin:0 0 var(--s4);font-size:14px;color:var(--muted)}.pd-avg b{color:var(--ink);font-size:1.1rem}
.pd-revs{display:grid;gap:var(--s4);margin:0;padding:0;list-style:none}
@media (min-width:700px){.pd-revs{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}
.pd-revs li{display:grid;gap:var(--s3);align-content:start;padding:var(--s5);border:1px solid var(--line);border-radius:var(--r-card);background:var(--paper-2)}
.pd-revs blockquote{margin:0;font-size:var(--t-body);line-height:1.55;text-wrap:pretty}
.pd-revs p{margin:0;font-size:var(--t-meta);color:var(--muted)}.pd-revs p b{color:var(--ink)}
/* ---- gallery ---- */
.pg{display:grid;gap:var(--s3);min-width:0}
.pg-stage{position:relative;border-radius:var(--r-tile);overflow:hidden;background:var(--accent-soft);isolation:isolate}
.pg-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;aspect-ratio:4/5}
.pg-track::-webkit-scrollbar{display:none}
.pg-track:focus-visible{outline-offset:-3px}
.pg[data-aspect=dish] .pg-track{aspect-ratio:1/1}
.pg-slide{flex:0 0 100%;scroll-snap-align:center;min-width:0;position:relative}
.pg-zoom{display:block;position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in;overflow:hidden;--ox:50%;--oy:50%}
.pg-zoom .adv-photo{position:absolute;inset:0;transform-origin:var(--ox) var(--oy);transition:transform .5s cubic-bezier(.2,.7,.2,1)}
@media (hover:hover) and (pointer:fine){.pg-zoom:hover .adv-photo{transform:scale(1.9);transition-duration:.25s}}
.pg-stage .ic-tags{top:16px;left:16px;right:auto;z-index:3}
.pg-arrow{position:absolute;top:50%;z-index:3;display:none;place-items:center;width:44px;height:44px;margin-top:-22px;border:0;border-radius:50%;background:color-mix(in srgb,var(--paper) 90%,transparent);color:var(--ink);cursor:pointer;backdrop-filter:blur(8px);opacity:0;transition:opacity .2s,transform .2s}
.pg-arrow[data-dir=prev]{left:12px}.pg-arrow[data-dir=next]{right:12px}
@media (hover:hover) and (pointer:fine){.pg-arrow{display:grid}.pg-stage:hover .pg-arrow,.pg-arrow:focus-visible{opacity:1}}
.pg-arrow:hover{transform:scale(1.08)}
.pg-count{position:absolute;left:14px;bottom:14px;z-index:3;padding:.35em .8em;border-radius:var(--r-pill);background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);font-size:12.5px;font-weight:700;letter-spacing:.06em;font-variant-numeric:tabular-nums}
.pg-count i{font-style:normal;font-weight:500;opacity:.55}
.pg-hint{position:absolute;right:14px;bottom:14px;z-index:3;padding:.35em .8em;border-radius:var(--r-pill);background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);font-size:12px;font-weight:600;pointer-events:none}
@media (hover:none){.pg-hint{display:none}}
.pg-thumbs{display:flex;gap:var(--s3);margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
.pg-thumbs li{flex:none}
.pg-thumbs button{display:block;position:relative;width:76px;height:76px;padding:0;border:2px solid transparent;border-radius:var(--r-img);overflow:hidden;background:var(--accent-soft);cursor:pointer;opacity:.62;transition:opacity .2s,border-color .2s}
.pg-thumbs button[aria-current=true],.pg-thumbs button:hover{opacity:1;border-color:var(--accent)}
/* ---- shop layout ---- */
.pd-grid{display:grid;gap:clamp(1.5rem,3vw,2.25rem) clamp(2rem,4.5vw,4.5rem);grid-template-areas:"gal" "pan" "more"}
.pd-gal{grid-area:gal;min-width:0}
.pd-pan{grid-area:pan;display:grid;gap:var(--s4);align-content:start;min-width:0}
.pd-more{grid-area:more;min-width:0}
@media (min-width:900px){
  .pd-grid{grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);grid-template-areas:"gal pan" "more pan";align-items:start}
  .pd-pan{position:sticky;top:96px}
  .pd-track{aspect-ratio:1/1.06}
}
.pd-tabs{position:sticky;top:57px;z-index:20;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.pd-tabs ul{display:flex;gap:var(--s5);margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
.pd-tabs ul::-webkit-scrollbar{display:none}
.pd-tabs a{display:block;padding:.95em 0;font-size:13.5px;font-weight:600;color:var(--muted);text-decoration:none;white-space:nowrap;border-bottom:2px solid transparent;transition:color .2s,border-color .2s}
.pd-tabs a:hover{color:var(--ink)}
.pd-tabs a[aria-current=true]{color:var(--ink);border-bottom-color:var(--accent)}
.pd-rail-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s3) var(--s5);margin-bottom:clamp(1.5rem,4vw,2.5rem);scroll-margin-top:120px}
.pd-rail-nav{display:flex;align-items:center;gap:var(--s3)}
.pd-rb{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:transparent;color:var(--ink);cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.pd-rb:hover:not(:disabled){background:var(--ink);color:var(--paper);border-color:var(--ink)}
.pd-rb:disabled{opacity:.3;cursor:default}
.pd-rail{display:flex;gap:var(--gap);margin-inline:calc(var(--gutter) * -1);padding:var(--s2) var(--gutter) var(--s4);overflow-x:auto;scroll-snap-type:x proximity;scroll-padding-inline:var(--gutter);scrollbar-width:none;overscroll-behavior-x:contain}
.pd-rail::-webkit-scrollbar{display:none}
.pd-rail-i{flex:0 0 clamp(210px,62vw,290px);scroll-snap-align:start;display:flex}
.pd-rail-i>.ic{width:100%}
/* ---- dish layout ---- */
.pd-dish{padding-block:clamp(1rem,3vw,2rem) clamp(3rem,7vw,6rem)}
.pd-dish-grid{display:grid;gap:clamp(2rem,5vw,4rem);align-items:center}
.pd-dish-words{display:grid;gap:var(--s5);align-content:center;min-width:0}
.pd-dish .pd-title{font-size:clamp(2.6rem,7.4vw,6rem);line-height:.96}
.site:lang(hi) .pd-dish .pd-title{line-height:1.2}
.pd-dish .pd-step{border-color:var(--line)}
.pd-dish .kicker{color:var(--hero-text);opacity:.8}
.pd-dish-pic{position:relative;min-width:0;max-width:560px;width:100%;justify-self:center}
.pd-dish-pic .pg-stage{border-radius:var(--r-tile)}
.pd-stamp{position:absolute;right:-6px;top:-18px;z-index:4;display:grid;place-items:center;width:clamp(92px,17vw,128px);aspect-ratio:1;border-radius:50%;background:var(--accent);color:var(--on-accent);transform:rotate(-10deg);text-align:center;box-shadow:0 10px 30px -12px rgb(0 0 0/.5);pointer-events:none}
.pd-stamp::before{content:"";position:absolute;inset:6px;border:1.5px dashed color-mix(in srgb,var(--on-accent) 55%,transparent);border-radius:50%}
.pd-stamp span{padding:0 14px;font-family:var(--font-display);font-size:clamp(.95rem,2vw,1.2rem);line-height:1.1;letter-spacing:var(--display-tr);text-wrap:balance}
@media (max-width:899px){.pd-dish-pic{order:-1}}
@media (min-width:900px){.pd-dish-grid{grid-template-columns:1.05fr .95fr}.pd-dish-pic{justify-self:end}}
.pd-body{padding-block:clamp(2.5rem,6vw,4.5rem) 0}
.pd-body+.pd-body{padding-top:clamp(2rem,5vw,3rem)}
.pd-dish-body{display:grid;gap:clamp(1.5rem,3.4vw,2.5rem);align-items:start}
@media (min-width:900px){.pd-dish-body{grid-template-columns:1.2fr .8fr}.pd-two .pd-dish-body{grid-template-columns:1fr 1fr;gap:var(--s7)}}
.pd-two{padding-bottom:clamp(2.5rem,6vw,4.5rem)}
.pd-two .pd-trust{border-top:0;padding-top:0}
/* ---- offer layout ---- */
.pd-offer{overflow:hidden;padding-block:clamp(1rem,3vw,2rem) clamp(3rem,7vw,6rem)}
.pd-offer-bg{position:absolute;inset:0 0 0 30%;opacity:.42;-webkit-mask-image:linear-gradient(90deg,transparent,#000 60%);mask-image:linear-gradient(90deg,transparent,#000 60%)}
.pd-offer-bg .adv-photo{filter:saturate(.8) contrast(1.05)}
@media (max-width:700px){.pd-offer-bg{inset:0;opacity:.3;-webkit-mask-image:linear-gradient(0deg,transparent,#000 70%);mask-image:linear-gradient(0deg,transparent,#000 70%)}}
.pd-offer-glow{position:absolute;inset:0;background:radial-gradient(60% 70% at 88% 0%,color-mix(in srgb,var(--accent) 36%,transparent),transparent 70%),radial-gradient(40% 50% at 0% 100%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 70%);pointer-events:none}
.pd-offer .adv-wrap{position:relative}
.pd-offer-grid{display:grid;gap:clamp(2rem,5vw,3.5rem);align-items:end}
.pd-offer-words{display:grid;gap:var(--s4);min-width:0;position:relative}
.pd-offer-no{margin:0 0 var(--s2);font-family:var(--font-display);font-size:clamp(5rem,16vw,12rem);line-height:.82;color:transparent;-webkit-text-stroke:1.5px color-mix(in srgb,var(--accent) 65%,transparent);letter-spacing:var(--display-tr);font-variant-numeric:lining-nums}
.pd-offer .pd-title{font-size:clamp(2.4rem,6.4vw,5.2rem);line-height:.98}
.site:lang(hi) .pd-offer .pd-title{line-height:1.2}
.pd-offer .kicker{color:var(--hero-text);opacity:.8}
.pd-offer-badge{margin:0;width:fit-content;padding:.35em .9em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent);font-size:12.5px;font-weight:700;letter-spacing:.04em}
.pd-ticket{position:relative;display:grid;gap:var(--s4);padding:clamp(1.25rem,3vw,2rem);border-radius:var(--r-tile);background:color-mix(in srgb,var(--hero-text) 7%,transparent);border:1px solid var(--hero-line);backdrop-filter:blur(10px)}
.pd-ticket-k{margin:0;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--hero-muted)}
.pd-ticket-ask{margin:0;font-family:var(--font-display);font-size:1.4rem;line-height:1.2;text-wrap:balance}
.pd-chips{display:grid;gap:var(--s3);margin:0;padding:var(--s4) 0 0;border:0;border-top:1px dashed var(--hero-line);min-width:0}
.pd-chips legend{padding:0;margin-bottom:var(--s3);font-size:13.5px;font-weight:600;float:left;width:100%}
.pd-chips legend+div{clear:both}
.pd-chips div{display:flex;flex-wrap:wrap;gap:var(--s2)}
.pd-chips button{min-height:44px;padding:0 1.1em;border:1px solid var(--hero-line);border-radius:var(--r-pill);background:transparent;color:var(--ink);font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.pd-chips button:hover{border-color:var(--ink)}
.pd-chips button[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.pd-offer .pd-ticket .btn-ghost{color:var(--ink);border-color:var(--hero-line)}
@media (min-width:900px){.pd-offer-grid{grid-template-columns:1.2fr .8fr}}
.pd-offer-body{display:grid;gap:clamp(2rem,5vw,4rem);align-items:start}
@media (min-width:900px){.pd-offer-body{grid-template-columns:1.25fr .75fr}.pd-offer-side{position:sticky;top:96px}}
.pd-offer-main,.pd-offer-side{min-width:0;display:grid;gap:0}
.pd-offer-side .pd-sec{margin-top:var(--s6)}
.pd-offer-side>.pd-fold{margin-top:var(--s6)}
.pd-offer-fig{margin:0 0 clamp(2rem,5vw,3rem);aspect-ratio:16/10;border-radius:var(--r-tile);overflow:hidden;position:relative;background:var(--accent-soft)}
.pd-offer-fig .adv-photo{position:absolute;inset:0}
.pd-incl{display:grid;gap:var(--s3);margin:0;padding:0;list-style:none}
@media (min-width:700px){.pd-incl{grid-template-columns:1fr 1fr}}
.pd-incl li{display:grid;grid-template-columns:auto 1fr;gap:var(--s3);align-items:start;padding:var(--s4);border:1px solid var(--line);border-radius:var(--r-card);font-size:var(--t-body);line-height:1.45}
.pd-incl li>span{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--on-accent)}
.pd-time{display:grid;gap:0;margin:0;padding:0;list-style:none;position:relative}
.pd-time::before{content:"";position:absolute;left:1.55rem;top:1.5rem;bottom:1.5rem;width:1px;background:var(--line)}
.pd-time li{display:grid;grid-template-columns:3.1rem 1fr;gap:var(--s4);padding-block:var(--s3);position:relative}
.pd-time-n{display:grid;place-items:center;width:3.1rem;height:3.1rem;border-radius:50%;background:var(--paper);border:1px solid var(--accent);color:var(--accent);font-family:var(--font-display);font-size:1.1rem;position:relative;z-index:1}
.pd-time b{display:block;font-size:var(--t-body);margin-top:.35em}
.pd-time p{margin:4px 0 0;font-size:var(--t-meta);color:var(--muted);line-height:1.5}
.pd-faq details>p{padding-bottom:var(--s4)}
/* Hindi has no capitals and spreads badly with tracking: the small labels go back to plain type. */
.site:lang(hi) .pd-h,.site:lang(hi) .pd-qty-l,.site:lang(hi) .pd-tiles dt,.site:lang(hi) .pd-ticket-k,.site:lang(hi) .pd-nb small,.site:lang(hi) .pd-end-in>p{letter-spacing:0;text-transform:none;font-size:14px}
.site:lang(hi) .pd-save,.site:lang(hi) .pd-offer-badge{letter-spacing:0}
/* ---- neighbours and the closing band ---- */
body[data-pdcta] .nv-bar{transform:translateY(110%)}
.pd-nb{border-top:1px solid var(--line);background:var(--paper)}
.pd-nb .adv-wrap{display:grid;grid-template-columns:1fr 1fr}
.pd-nb a{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;align-items:center;column-gap:var(--s3);padding:clamp(1.25rem,3.5vw,2.5rem) 0;color:inherit;text-decoration:none;min-width:0;transition:color .2s}
.pd-nb a[data-dir=next]{border-left:1px solid var(--line);padding-left:clamp(1rem,3vw,2.5rem)}
.pd-nb a[data-dir=prev]{padding-right:clamp(1rem,3vw,2.5rem)}
.pd-nb a[data-dir=prev] svg{transform:scaleX(-1);order:-1;grid-row:1/3}
.pd-nb a[data-dir=prev]{grid-template-columns:auto 1fr}
.pd-nb small{grid-column:1/-1;font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.pd-nb a[data-dir=prev] small{grid-column:2}
.pd-nb span{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1rem,2.4vw,1.8rem);line-height:1.15;letter-spacing:var(--display-tr);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.pd-nb a[data-dir=prev] span{grid-column:2}
.pd-nb a:hover{color:var(--accent)}
.pd-nb svg{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.pd-nb a[data-dir=next]:hover svg{transform:translateX(6px)}
.pd-nb a[data-dir=prev]:hover svg{transform:scaleX(-1) translateX(6px)}
@media (max-width:520px){.pd-nb svg{display:none}.pd-nb a[data-dir=prev]{grid-template-columns:1fr}.pd-nb a[data-dir=prev] small,.pd-nb a[data-dir=prev] span{grid-column:1}}
.pd-end{background:var(--hero-ink);color:var(--hero-text)}
.pd-end-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s5) var(--s7);padding-block:clamp(2rem,5vw,3.5rem)}
.pd-end-in>p{margin:0;flex:1 1 320px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--hero-muted)}
.pd-end b{display:block;margin-top:.5em;max-width:24ch;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.6rem,4vw,3rem);line-height:1.08;letter-spacing:0;text-transform:none;color:var(--hero-text);overflow-wrap:break-word}
@media (max-width:767px){.pd-end{padding-bottom:64px}}
@media (max-width:767px){.pd-nb+.pd-end,.pd-end{margin-bottom:0}}
`;
