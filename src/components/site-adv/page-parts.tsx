"use client";
// The pieces the advanced site's inner pages share (pages.tsx composes them): the masthead every inner page opens with, an item
// card in four layouts, the "browse all" band the home page uses to lead into a page, the enquiry form, and the share button.
// Colour, corner and type come from the root's tokens, like every variant; a masthead style and an item layout are chosen from
// the spec, so the pages of two businesses do not look alike.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Search, Send, Share2 } from "lucide-react";
import type { AdvancedSpec } from "@/lib/site-advanced";
import type { AdvItem } from "@/lib/site-advanced";
import type { FormField } from "@/lib/types";
import { Pic } from "@/components/pic";
import { Icon } from "@/components/site-icons";
import { parsePrice } from "@/components/card-view";
import { ctaLabel, recipeFor } from "@/lib/site-recipes";
import { Photo, type SiteContent } from "@/components/site-adv/shared";
import { Crumbs, type AdvCtxPlus, type Chrome } from "@/components/site-adv/nav";

/* ================= small helpers ================= */

/** "₹58,900" with its struck-through "₹64,500" and the saving as a percentage, when both are numbers and the offer is lower. */
export function priceOf(it: { price?: string; mrp?: string }) {
  const price = (it.price ?? "").trim(), mrp = (it.mrp ?? "").trim();
  const p = parsePrice(price), m = parsePrice(mrp);
  const off = p && m && m > p ? Math.round(((m - p) / m) * 100) : 0;
  return { price, mrp: off ? mrp : "", off, num: p };
}
/** The item's photos: the first is the cover. */
export const photosOf = (it: { images?: string[]; imageUrl?: string }) => [...(it.images ?? []), ...(it.imageUrl ? [it.imageUrl] : [])].filter((u, i, a) => u && a.indexOf(u) === i);

/** The opening of every item enquiry: the business, that the visitor came from the website, and the item with its price. */
export function askText(x: AdvCtxPlus, c: SiteContent, name: string, price?: string): string {
  const n = x.t(name);
  return x.hi
    ? `नमस्ते ${c.name}, मैंने आपकी website देखी — मुझे "${n}"${price ? ` (${price})` : ""} के बारे में जानकारी चाहिए।`
    : `Hi ${c.name}, I saw your website — I'd like to know more about "${n}"${price ? ` (${price})` : ""}.`;
}
/** The button's words: the owner's own for the item, else the trade's ("Order on WhatsApp", "Book an appointment"). */
/** "₹1,099 / kg" stays on one line ("/" glued to its unit); a longer price ("₹9,500 for 100 guests") may wrap at its spaces. */
export const nbUnit = (s: string) => s.replace(/\s*\/\s*/g, "\u00a0/\u00a0");
export function enquireLabel(x: AdvCtxPlus, it: { ctaLabel?: string }, cat: string | undefined): string {
  const own = (it.ctaLabel ?? "").trim();
  return own ? x.t(own) : ctaLabel(recipeFor(cat ?? "").cta, x.hi ? "hi" : "en");
}

/* ================= masthead ================= */

export function Masthead({ x, chrome, kicker, title, lede, trail, image, aside, name }: {
  x: AdvCtxPlus; chrome: Chrome; kicker?: string; title: string; lede?: string; trail: { label: string; slug?: string }[]; image?: string; aside?: ReactNode;
  /** The business's name: the type style's ribbon repeats it. */
  name: string;
}) {
  // A split masthead needs a picture; without one it becomes the type style (never an empty frame).
  const kind = chrome.mast === "split" && !image ? "type" : chrome.mast;
  const ribbon = [name, kicker, title].filter(Boolean) as string[];
  return (
    <section className={`mh ${kind === "ink" ? "hero-dark" : ""}`} data-kind={kind} aria-labelledby="mh-title">
      {kind === "ink" && (
        <>
          {image && <div className="mh-bg" aria-hidden="true"><Photo src={image} eager sizes="100vw" /></div>}
          <i className="mh-glow" aria-hidden="true" />
        </>
      )}
      <div className="adv-wrap adv-wide mh-in">
        <div className="mh-crumb"><Crumbs x={x} trail={trail} /></div>
        <div className="mh-grid">
          <div className="mh-words">
            {kicker && <p className="kicker">{kicker}</p>}
            <h1 id="mh-title" className="mh-title">{title}</h1>
            {lede && <p className="mh-lede">{lede}</p>}
            {aside && <div className="mh-aside">{aside}</div>}
          </div>
          {kind === "split" && image && (
            <div className="mh-frame"><span className="mh-block" aria-hidden="true" /><div className="mh-pic"><Photo src={image} eager sizes="(min-width:900px) 40vw, 90vw" /></div></div>
          )}
        </div>
      </div>
      {kind === "type" && (
        <div className="mh-ribbon" aria-hidden="true">
          <div>{[0, 1].map((k) => <span key={k}>{ribbon.map((r, i) => <em key={i}>{r}</em>)}</span>)}</div>
        </div>
      )}
    </section>
  );
}

/** A photo that may not load (a deleted upload, a dead link): the quiet tile with the item's first letter takes its place, instead of
 *  an empty frame. Catches the error of the picture inside, and the ones that failed before the page woke up. */
export function Cover({ fallback, children }: { fallback: string; children: ReactNode }) {
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const img = ref.current?.querySelector("img");
    if (img && img.complete && img.naturalWidth === 0) setBad(true);
  }, []);
  if (bad) return <Photo fallback={fallback} />;
  return <span ref={ref} className="cv" onErrorCapture={() => setBad(true)}>{children}</span>;
}

/* ================= an item in a catalogue ================= */

export type CardLayout = "cards" | "wide" | "editorial" | "list";
/** Layout of a catalogue from the section variant the spec chose for the home page's catalogue: the business keeps its character. */
export function layoutFor(spec: AdvancedSpec, items: AdvItem[]): CardLayout {
  const v = spec.sections.services ?? "grid";
  const pics = items.some((i) => photosOf(i.item).length > 0);
  if (!pics) return "list";
  if (v === "magazine") return "editorial";
  if (v === "price-list" || v === "menu-leaders") return "list";
  if (v === "feature-cards") return "wide";
  return "cards";
}

export function ItemCard({ it, x, c, layout, i, cat }: { it: AdvItem; x: AdvCtxPlus; c: SiteContent; layout: CardLayout; i: number; cat?: string }) {
  const photos = photosOf(it.item);
  const pr = priceOf(it.item);
  const href = x.hrefFor(it.slug);
  const open = (e: React.MouseEvent) => { e.preventDefault(); x.goto?.(it.slug); };
  const label = x.t(it.item.name);
  const badge = (it.item.badge ?? "").trim();
  const ask = x.wa ? (
    <a className="ic-ask" href={x.waHref(askText(x, c, it.item.name, pr.price))} target="_blank" rel="noreferrer" onClick={() => x.track(`item-ask-${i}`)} aria-label={`${enquireLabel(x, it.item, cat)}: ${label}`}>
      <Icon name="whatsapp" /><span>{enquireLabel(x, it.item, cat)}</span>
    </a>
  ) : null;
  if (layout === "list") {
    return (
      <article className="ic ic-list" data-reveal style={{ ["--d" as string]: `${Math.min(i, 8) * 40}ms` }}>
        <a className="ic-no" href={href} onClick={open} aria-hidden="true" tabIndex={-1}>{photos[0] ? <span className="ic-thumb"><Cover fallback={label}><Photo src={photos[0]} sizes="96px" /></Cover></span> : <b>{String(i + 1).padStart(2, "0")}</b>}</a>
        <div className="ic-txt">
          <h3><a href={href} onClick={open}>{label}</a></h3>
          {it.item.desc && <p>{x.t(it.item.desc)}</p>}
        </div>
        <span className="ic-dots" aria-hidden="true" />
        {pr.price && <span className="ic-price"><b>{nbUnit(x.t(pr.price))}</b>{pr.mrp && <s>{pr.mrp}</s>}</span>}
        {x.wa
          ? <a className="ic-round" href={x.waHref(askText(x, c, it.item.name, pr.price))} target="_blank" rel="noreferrer" aria-label={`${enquireLabel(x, it.item, cat)}: ${label}`} onClick={() => x.track(`item-ask-${i}`)}><Icon name="whatsapp" /></a>
          : <a className="ic-round" href={href} onClick={open} aria-label={label}><Icon name="arrow-right" /></a>}
      </article>
    );
  }
  return (
    <article className={`ic ic-${layout}`} data-reveal data-lead={layout === "editorial" && i === 0 ? "" : undefined} style={{ ["--d" as string]: `${Math.min(i, 8) * 45}ms` }}>
      <a className="ic-media" href={href} onClick={open} aria-label={label} tabIndex={-1}>
        {photos[0]
          ? <><Cover fallback={label}><Photo src={photos[0]} alt="" sizes={layout === "wide" ? "(min-width:900px) 50vw, 100vw" : "(min-width:1100px) 25vw, (min-width:700px) 33vw, 50vw"} /></Cover>{photos[1] && <Photo className="ic-alt" src={photos[1]} alt="" sizes="(min-width:700px) 33vw, 50vw" />}</>
          : <Photo fallback={label} />}
        {(badge || pr.off > 0) && (
          <span className="ic-tags">
            {badge && <em>{x.t(badge)}</em>}
            {pr.off > 0 && <em data-off="">{pr.off}% {x.ui("off", "छूट")}</em>}
          </span>
        )}
      </a>
      <div className="ic-body">
        {it.item.category && <p className="kicker">{x.t(it.item.category)}</p>}
        <h3><a href={href} onClick={open}>{label}</a></h3>
        {it.item.desc && <p className="ic-desc">{x.t(it.item.desc)}</p>}
        <div className="ic-foot">
          {pr.price && <span className="ic-price"><b>{nbUnit(x.t(pr.price))}</b>{pr.mrp && <s>{pr.mrp}</s>}</span>}
          <span className="ic-acts">
            {ask}
            <a className="ic-more" href={href} onClick={open} aria-label={`${x.ui("Details", "डिटेल")}: ${label}`}><Icon name="arrow-right" /></a>
          </span>
        </div>
      </div>
    </article>
  );
}

/* ================= the home page's lead into a page ================= */

export function SeeMore({ x, href, slug, label, count }: { x: AdvCtxPlus; href: string; slug: string; label: string; count?: string }) {
  return (
    <div className="sm" data-reveal>
      <a className="adv-wrap adv-wide sm-in" href={href} onClick={(e) => { e.preventDefault(); x.goto?.(slug); }}>
        <span className="sm-t">{label}</span>
        {count && <span className="sm-n">{count}</span>}
        <span className="sm-a" aria-hidden="true"><Icon name="arrow-right" size={22} /></span>
      </a>
    </div>
  );
}

/* ================= share ================= */

export function ShareBtn({ x, title, className = "" }: { x: AdvCtxPlus; title: string; className?: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = window.location.href.split("#")[0];
    x.track("share");
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true); window.setTimeout(() => setDone(false), 2200);
    } catch { /* the visitor cancelled the sheet */ }
  };
  return (
    <button type="button" className={`pp-share ${className}`} onClick={share}>
      {done ? <Check size={16} /> : <Share2 size={16} />}<span>{done ? x.ui("Link copied", "लिंक कॉपी हुआ") : x.ui("Share", "शेयर करें")}</span>
      <span className="sr-only" role="status" aria-live="polite">{done ? x.ui("Link copied", "लिंक कॉपी हुआ") : ""}</span>
    </button>
  );
}

/* ================= the enquiry form ================= */

const DEFAULT_FIELDS: FormField[] = [
  { key: "name", label: "Your name", type: "text", required: true },
  { key: "phone", label: "Phone", type: "phone", required: true },
  { key: "message", label: "How can we help?", type: "textarea" },
];
const DEFAULT_HI: Record<string, string> = { "Your name": "आपका नाम", Phone: "फ़ोन", "How can we help?": "हम कैसे मदद करें?" };

/** An enquiry form of the owner's own fields (a `form` block) or the three plain ones; a submission is a lead like any other. */
export function AdvForm({ x, fields, title, button, note, interest }: { x: AdvCtxPlus; fields?: FormField[]; title: string; button?: string; note?: string; interest?: string[] }) {
  const own = !!fields?.some((f) => f.label);
  const list = (own ? fields! : DEFAULT_FIELDS).filter((f) => f.label);
  const [v, setV] = useState<Record<string, string>>({});
  const [pick, setPick] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const set = (k: string, val: string) => setV((o) => ({ ...o, [k]: val }));
  const labelOf = (f: FormField) => (own ? x.t(f.label) : x.hi ? DEFAULT_HI[f.label] ?? f.label : f.label);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of list) if (f.required && !(v[f.key] ?? "").trim()) { setErr(`${labelOf(f)} — ${x.ui("required", "ज़रूरी है")}`); setState("error"); return; }
    setState("busy"); setErr("");
    const nameF = list.find((f) => f.key === "name" || (f.type === "text" && /name|नाम/i.test(f.label)));
    const phoneF = list.find((f) => f.type === "phone");
    const emailF = list.find((f) => f.type === "email");
    const rest = list.filter((f) => f !== nameF && f !== phoneF && f !== emailF).map((f) => `${f.label}: ${(v[f.key] ?? "").trim()}`).filter((l) => !/:\s*$/.test(l));
    const msg = [pick && `${x.ui("Interested in", "रुचि")}: ${pick}`, ...rest].filter(Boolean).join("\n");
    const { submitLead } = await import("@/lib/cloud");
    const res = await submitLead(x.card.username, { name: (nameF && v[nameF.key]) || "", phone: (phoneF && v[phoneF.key]) || "", email: (emailF && v[emailF.key]) || "", message: own ? `📝 ${title}\n${msg}`.trim() : msg, source: "form" });
    if (res.ok || res.error === "demo") { setState("done"); x.track("form-sent"); return; }
    setErr(res.error ?? x.ui("Something went wrong. Try WhatsApp instead.", "कुछ गड़बड़ हुई। WhatsApp पर भेजें।")); setState("error");
  }
  if (state === "done") {
    return (
      <div className="af-done" role="status">
        <span><Check size={26} /></span>
        <h3>{x.ui("Message sent", "संदेश भेज दिया")}</h3>
        <p>{x.t(note || x.ui("We will get back to you soon.", "हम जल्दी ही आपसे संपर्क करेंगे।"))}</p>
      </div>
    );
  }
  return (
    <form className="af" onSubmit={submit} noValidate>
      {!own && interest && interest.length > 1 && (
        <label className="af-f">
          <span>{x.ui("I am interested in", "मुझे चाहिए")}</span>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{x.ui("Just a general question", "बस एक सामान्य सवाल")}</option>
            {interest.map((n) => <option key={n} value={n}>{x.t(n)}</option>)}
          </select>
        </label>
      )}
      {list.map((f) => (
        <label key={f.key} className="af-f">
          <span>{labelOf(f)}{f.required && <i aria-hidden="true"> *</i>}</span>
          {f.type === "textarea" ? <textarea rows={4} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            : f.type === "select" ? <select value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}><option value="">{x.ui("Choose", "चुनें")}</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{x.t(o)}</option>)}</select>
            : <input type={f.type === "phone" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"} inputMode={f.type === "phone" ? "tel" : undefined} autoComplete={f.type === "phone" ? "tel" : f.key === "name" ? "name" : undefined} value={v[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} aria-required={f.required || undefined} />}
        </label>
      ))}
      {err && <p className="af-err" role="alert">{err}</p>}
      <button type="submit" className="btn-primary af-go" disabled={state === "busy"}><Send size={16} /> {state === "busy" ? x.ui("Sending…", "भेज रहे हैं…") : x.t(button || x.ui("Send message", "संदेश भेजें"))}</button>
      {note && <p className="af-note">{x.t(note)}</p>}
    </form>
  );
}

/* ================= a search box with chips (the catalogue's tools) ================= */

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="cg-search">
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} enterKeyHint="search" />
    </label>
  );
}

/** A picture that opens the lightbox: a button around the photo, so a keyboard can reach it. */
export function ZoomPhoto({ src, alt, onOpen, className = "", sizes }: { src: string; alt: string; onOpen: () => void; className?: string; sizes?: string }) {
  return (
    <button type="button" className={`zp ${className}`} onClick={onOpen} aria-label={alt ? `${alt} — ${"zoom"}` : "zoom"}>
      <Pic src={src} alt={alt} className="adv-photo" sizes={sizes ?? "(min-width:900px) 33vw, 50vw"} />
    </button>
  );
}

/* ================= CSS ================= */

export const PARTS_CSS = `
/* ---- masthead: how an inner page opens ---- */
.mh{position:relative;overflow:hidden;background:var(--paper);padding-block:clamp(1.25rem,3vw,2.25rem) clamp(2.5rem,7vw,5.5rem)}
.mh-in{position:relative;z-index:2}
.mh-crumb{margin-bottom:clamp(2rem,6vw,4.5rem)}
.mh-title{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.9rem,10.5vw,8.6rem);line-height:.94;letter-spacing:var(--display-tr);text-wrap:balance;margin:0;overflow-wrap:anywhere}
.site:lang(hi) .mh-title{line-height:1.22;letter-spacing:0;font-weight:var(--display-w-hi);font-size:clamp(2.5rem,9vw,7rem)}
.mh .kicker{margin:0 0 var(--s4)}
.mh-lede{margin:var(--s5) 0 0;max-width:46ch;font-size:clamp(1.05rem,1.6vw,1.3rem);line-height:1.5;color:var(--muted);text-wrap:pretty}
.mh-aside{margin-top:var(--s6);display:flex;flex-wrap:wrap;gap:var(--s3)}
.mh[data-kind=ink]{background:var(--hero-ink);color:var(--hero-text);--ink:var(--hero-text);--muted:var(--hero-muted);--line:var(--hero-line);--paper:var(--hero-ink)}
.mh[data-kind=ink] .kicker{color:var(--hero-text);opacity:.8}
.mh-bg{position:absolute;inset:0 0 0 38%;opacity:.5;-webkit-mask-image:linear-gradient(90deg,transparent,#000 70%);mask-image:linear-gradient(90deg,transparent,#000 70%)}
.mh-bg .adv-photo{filter:saturate(.85) contrast(1.05)}
.mh-glow{position:absolute;inset:0;background:radial-gradient(60% 80% at 85% 10%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 70%);pointer-events:none}
@media (max-width:700px){.mh-bg{inset:0;opacity:.28;-webkit-mask-image:linear-gradient(0deg,transparent,#000 80%);mask-image:linear-gradient(0deg,transparent,#000 80%)}}
.mh[data-kind=type] .mh-title{font-size:clamp(3.1rem,12.5vw,10.5rem)}
.mh-ribbon{overflow:hidden;margin-top:clamp(2rem,5vw,3.5rem);border-block:1px solid var(--line);padding-block:.4em;white-space:nowrap;user-select:none}
.mh-ribbon>div{display:inline-flex;animation:mh-run 55s linear infinite;will-change:transform}
.mh-ribbon span{display:inline-flex;align-items:center}
.mh-ribbon em{font-style:normal;font-family:var(--font-display);font-size:clamp(2.6rem,7vw,5.6rem);line-height:1.1;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--ink) 38%,transparent);letter-spacing:var(--display-tr);padding-right:.5em}
.mh-ribbon em::after{content:"";display:inline-block;width:.22em;height:.22em;margin-left:.5em;background:var(--accent);border-radius:50%;vertical-align:.12em}
@keyframes mh-run{to{transform:translateX(-50%)}}
.mh[data-kind=split] .mh-grid{display:grid;gap:clamp(2rem,5vw,4rem);align-items:end}
@media (min-width:900px){.mh[data-kind=split] .mh-pic{aspect-ratio:1/1}.mh[data-kind=split] .mh-grid{grid-template-columns:1.15fr .85fr}.mh[data-kind=split] .mh-title{font-size:clamp(3rem,7.4vw,7rem)}}
.mh-frame{position:relative;max-width:480px;width:100%;justify-self:end}
/* Square on a laptop: the 4/5 frame was 600px tall beside a 110px title and pushed the page's content below the first screen (16 Oct 2026 QA). */
.mh-pic{position:relative;aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;background:var(--accent-soft)}
.mh-block{position:absolute;inset:auto -14px -14px auto;width:62%;height:62%;background:var(--accent);opacity:.9;border-radius:var(--r-tile);z-index:-1}
.mh-frame{z-index:0}
.mh[data-kind=poster]{text-align:center}
.mh[data-kind=poster] .mh-crumb{display:flex;justify-content:center}
.mh[data-kind=poster] .mh-title{font-size:clamp(2.7rem,9vw,7rem);margin-inline:auto;max-width:14ch}
.mh[data-kind=poster] .mh-lede{margin-inline:auto}
.mh[data-kind=poster] .mh-aside{justify-content:center}
.mh[data-kind=poster] .kicker{display:flex;align-items:center;justify-content:center;gap:var(--s4)}
.mh[data-kind=poster] .kicker::before,.mh[data-kind=poster] .kicker::after{content:"";width:clamp(28px,8vw,72px);height:1px;background:currentColor;opacity:.4}
/* ---- an item in a catalogue ---- */
.cv{display:contents}
.ic{position:relative;min-width:0;--d:0ms;display:flex;flex-direction:column}
.ic h3{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.15rem,1.7vw,1.45rem);line-height:1.15;letter-spacing:var(--display-tr);margin:0;text-wrap:balance}
.site:lang(hi) .ic h3{line-height:1.35;letter-spacing:0;font-weight:var(--display-w-hi)}
.ic h3 a{display:inline-block;padding-block:.2em;color:inherit;text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size .35s}
.ic h3 a:hover{background-size:100% 1px}
.ic-media{position:relative;display:block;overflow:hidden;aspect-ratio:4/5;border-radius:var(--r-card);background:var(--accent-soft);isolation:isolate}
.ic-media .adv-photo{position:absolute;inset:0;transition:transform .9s cubic-bezier(.2,.7,.2,1),opacity .5s}
.ic:hover .ic-media .adv-photo:first-child{transform:scale(1.05)}
.ic-alt{opacity:0}.ic:hover .ic-alt{opacity:1;transform:scale(1.02)}
.ic-media .adv-tile{position:absolute;inset:0}
.ic-tags{position:absolute;top:12px;left:12px;right:12px;display:flex;flex-wrap:wrap;gap:6px;z-index:2;pointer-events:none}
.ic-tags em{font-style:normal;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:.35em .75em;border-radius:var(--r-pill);background:var(--paper);color:var(--ink)}
.ic-tags em[data-off]{background:var(--accent);color:var(--on-accent)}
.ic-body{display:flex;flex-direction:column;flex:1;gap:var(--s2);padding-top:var(--s4)}
.ic-body .kicker{margin:0}
.ic-desc{margin:0;font-size:var(--t-meta);line-height:1.5;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ic-foot{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s3);margin-top:auto;padding-top:var(--s2)}
.ic-body{min-width:0}
@media (max-width:520px){.ic-more{display:none}.ic-body{padding-top:var(--s3)}.ic h3{font-size:1.05rem}.ic-desc{-webkit-line-clamp:2;font-size:12.5px}}
.ic-price{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:0 .5em;font-variant-numeric:tabular-nums}
.ic-price b{font-size:1.1rem;font-weight:600;overflow-wrap:anywhere}.ic-price s{font-size:.85rem;color:var(--muted);white-space:nowrap}
.ic-acts{display:flex;align-items:center;gap:var(--s2)}
.ic-ask{flex:1;min-width:0;justify-content:center;display:inline-flex;align-items:center;gap:.45em;min-height:44px;padding:0 .95em;border-radius:var(--r-ctl);border:1px solid var(--line);font-size:13.5px;font-weight:600;color:var(--ink);text-decoration:none;transition:background .25s,color .25s,border-color .25s}
.ic-ask:hover{background:color-mix(in srgb,var(--wa) 68%,#000);border-color:transparent;color:#fff}
.ic-more{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--ink);color:var(--paper);transition:transform .3s cubic-bezier(.2,.7,.2,1)}
.ic-more:hover{transform:translateX(3px)}
.ic-ask span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The label wraps to two lines in a two-column phone card: "Ask for a de..." cut the owner's own button words short (16 Oct 2026 QA). */
@media (max-width:520px){.ic-ask{padding:.3em .6em}.ic-ask svg{display:none}.ic-ask span{white-space:normal;overflow:visible;text-align:center;line-height:1.2}}
.ic-wide{display:grid;gap:var(--s4)}
@media (min-width:700px){.ic-wide{grid-template-columns:1.1fr 1fr;align-items:center;gap:var(--s6)}.ic-wide .ic-media{aspect-ratio:5/4}.ic-wide .ic-body{padding-top:0;gap:var(--s3)}.ic-wide h3{font-size:clamp(1.5rem,2.6vw,2.2rem)}.ic-wide .ic-desc{-webkit-line-clamp:4;font-size:var(--t-body)}.ic-wide:nth-child(even) .ic-media{order:2}}
.ic-editorial .ic-media{aspect-ratio:4/5}
.ic-editorial[data-lead]{grid-column:span 2;grid-row:span 2}
.ic-editorial[data-lead] .ic-media{aspect-ratio:auto;height:calc(100% - 118px);min-height:340px}
.ic-editorial[data-lead] h3{font-size:clamp(1.6rem,3vw,2.6rem)}
/* list rows: a printed price list */
.ic-list{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(24px,auto) auto auto;align-items:center;gap:var(--s4);padding:var(--s4) 0;border-bottom:1px solid var(--line)}
.ic-no{display:grid;place-items:center;width:64px;height:64px;color:var(--accent);text-decoration:none}
.ic-no b{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.7rem;opacity:.85}
.ic-thumb{position:relative;display:block;width:64px;height:64px;border-radius:var(--r-img);overflow:hidden}
.ic-list .ic-txt{min-width:0}
.ic-list .ic-txt h3 a{display:inline-flex;align-items:center;min-height:44px}
.ic-list .ic-txt p{margin:.25em 0 0;font-size:var(--t-meta);color:var(--muted);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ic-dots{align-self:end;margin-bottom:.9em;border-bottom:2px dotted var(--line);min-width:20px}
.ic-list .ic-price b{font-size:1.15rem}
.ic-round{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);color:var(--ink);transition:background .25s,color .25s,border-color .25s}
.ic-round:hover{background:color-mix(in srgb,var(--wa) 68%,#000);border-color:transparent;color:#fff}
@media (max-width:640px){.ic-list{grid-template-columns:auto minmax(0,1fr) auto;gap:var(--s3)}.ic-dots{display:none}.ic-list .ic-price{grid-column:2;grid-row:2}.ic-list .ic-round{grid-column:3;grid-row:1/3}.ic-no,.ic-thumb{width:52px;height:52px}}
/* ---- the home page's lead into a page: a band that is a link ---- */
.sm{background:var(--accent);color:var(--on-accent);overflow:hidden}
.sm-in{display:flex;align-items:center;gap:var(--s5);padding-block:clamp(1.1rem,2.6vw,1.9rem);color:inherit;text-decoration:none}
.sm-t{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.5rem,4.2vw,3rem);line-height:1.1;letter-spacing:var(--display-tr);margin-right:auto;text-wrap:balance}
.site:lang(hi) .sm-t{line-height:1.3;letter-spacing:0;font-weight:var(--display-w-hi)}
.sm-n{font-size:var(--t-meta);font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.8;white-space:nowrap}
.sm-a{display:grid;place-items:center;flex:none;width:clamp(44px,5vw,64px);height:clamp(44px,5vw,64px);border-radius:50%;border:1.5px solid currentColor;transition:transform .45s cubic-bezier(.2,.7,.2,1),background .3s,color .3s}
.sm-in:hover .sm-a{transform:translateX(8px) rotate(-45deg);background:var(--on-accent);color:var(--accent)}
@media (max-width:520px){.sm-n{display:none}}
/* ---- share ---- */
.pp-share{display:inline-flex;align-items:center;gap:.5em;min-height:48px;padding:0 var(--s4);border:0;background:none;color:var(--muted);font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;border-radius:var(--r-ctl);transition:color .2s}
.pp-share:hover{color:var(--ink)}
/* ---- the enquiry form ---- */
.af{display:grid;gap:var(--s4)}
.af-f{display:grid;gap:6px;font-size:13.5px;font-weight:600;color:var(--ink)}
.af-f i{color:var(--accent);font-style:normal}
.af-f input,.af-f textarea,.af-f select{width:100%;padding:.8em 1em;font:inherit;font-weight:400;font-size:16px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:var(--r-ctl);outline:none;transition:border-color .2s,box-shadow .2s;min-height:50px}
.af-f textarea{resize:vertical;min-height:120px}
.af-f input:focus,.af-f textarea:focus,.af-f select:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
.af-go{width:100%;border:0;cursor:pointer}.af-go:disabled{opacity:.6;cursor:progress}
.af-err{margin:0;font-size:14px;color:#b3261e}
.af-note{margin:0;text-align:center;font-size:var(--t-meta);color:var(--muted)}
.af-done{display:grid;justify-items:center;gap:var(--s3);padding:var(--s7) var(--s4);text-align:center}
.af-done span{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--accent);color:var(--on-accent)}
.af-done h3{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.6rem}.af-done p{margin:0;color:var(--muted)}
.cg-search{position:relative;display:flex;align-items:center;gap:.6em;min-height:48px;padding:0 1em;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--paper);color:var(--muted);transition:border-color .2s,box-shadow .2s}
.cg-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}
.cg-search input::placeholder{color:var(--muted);opacity:.8}
.cg-search input{flex:1;min-width:0;border:0;outline:none;background:none;font:inherit;font-size:16px;color:var(--ink)}
.zp{display:block;position:relative;width:100%;height:100%;padding:0;border:0;background:none;cursor:zoom-in;overflow:hidden;border-radius:inherit}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
`;
