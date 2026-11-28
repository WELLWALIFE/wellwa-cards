"use client";
// "The Showroom" — a whole-page design for a showroom or dealer (owner, 28 Nov 2026: "ekdam perfect, classic — dekhte hi kahe wah",
// reference: a big Indian electric-scooter maker's own website). Written from scratch on what makes such a site feel premium — no code,
// words or pictures of any real brand:
//   • the product is the page: a large photograph under a two-to-four-word headline and ONE line of proof;
//   • very few words: every model is a big rounded card with its name, one line and a price, nothing more;
//   • trust as facts the owner gave (a dealership, a year, a count) — never adjectives, never a list of chips;
//   • a clear next step everywhere: a test ride / an enquiry on WhatsApp, a call, the way to the showroom;
//   • one quiet type face, a pale page, black pill buttons, much air.
// Everything is read from the card (SiteContent + the items); a part with nothing to show is left out.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Card } from "@/lib/types";
import type { AdvItem, AdvancedSpec } from "@/lib/site-advanced";
import type { SiteContent } from "@/components/site-adv/content";
import type { AdvCtxPlus, AdvPageEntry } from "@/components/site-adv/nav";
import type { AdvRoute } from "@/components/site-adv/pages";
import { Photo } from "@/components/site-adv/shared";
import { Icon } from "@/components/site-icons";
import { linkHref } from "@/components/link-icon";
import { cleanPoints } from "@/lib/site-points";

/** The spec of the Showroom design (the fixed template "<group>-showroom"). */
export const isShowroom = (spec: AdvancedSpec): boolean => typeof spec.seed === "string" && /\|fix:[a-z]+-showroom\b/.test(spec.seed);

type Props = { card: Card; c: SiteContent; x: AdvCtxPlus; items: AdvItem[]; route: AdvRoute; open: (slug: string) => void; logo: ReactNode; lang: ReactNode; fallback: ReactNode };

const MOTORS = /^(auto|bike|car|ev|showroom|garage|tyre|transport|motors?)/;
/** "+919024088376" → "+91 90240 88376"; anything else as written. */
const phoneText = (v?: string) => {
  const d = (v ?? "").replace(/[^\d+]/g, "");
  const m = /^(?:\+?91)?([6-9]\d{4})(\d{5})$/.exec(d);
  return m ? `+91 ${m[1]} ${m[2]}` : (v ?? "");
};
const imgsOf = (it: AdvItem) => [...(it.item.images ?? []), ...(it.item.imageUrl ? [it.item.imageUrl] : [])].filter((u, i, a) => u && a.indexOf(u) === i);
/** "Range 120 km. Top speed 25 km/h. Comes in…" → "Range 120 km" — one line on a card, never a paragraph. */
const oneLine = (s?: string) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const first = t.split(/(?<=[.!?।])\s|\s[·|•]\s/)[0].replace(/[.।]$/, "");
  return first.length <= 64 ? first : `${first.slice(0, 60).replace(/\s+\S*$/, "")}…`;
};

function useShowroom(p: Props) {
  const { card, c, x, items, open } = p;
  const go = (slug?: string) => (e: React.MouseEvent) => { if (!slug) return; e.preventDefault(); open(slug); };
  const cat = x.pages.byRole("catalogue");
  const products = items.filter((i) => i.kind === "product");
  const seen = new Set<string>();
  const models = (products.length ? products : items).filter((i) => !i.twin).filter((i) => {
    const k = (i.item.name ?? "").trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true;
  });
  const motors = MOTORS.test(card.seo?.categoryKey ?? "");
  const call = x.phone ? linkHref(x.phone.type, x.phone.value) : "";
  const map = x.mapLink?.value?.trim() || c.visit?.mapUrl || "";
  const ask = (what?: string) => x.waHref(what
    ? (x.hi ? `नमस्ते ${c.name}, मुझे "${what}" के बारे में जानना है${motors ? " — टेस्ट राइड भी चाहिए" : ""}` : `Hi ${c.name}, I'd like to know about "${what}"${motors ? " and book a test ride" : ""}`)
    : undefined);
  const primary = motors ? x.ui("Book a test ride", "टेस्ट राइड बुक करें") : x.ui("Enquire now", "अभी पूछें");
  return { card, c, x, go, cat, models, motors, call, map, ask, primary };
}
type S = ReturnType<typeof useShowroom>;

/* ================= shell ================= */

function Header({ s, logo, lang }: { s: S; logo: ReactNode; lang: ReactNode }) {
  const { x, go } = s;
  const [openMenu, setOpen] = useState(false);
  const nav = x.pages.list.filter((e) => e.role !== "home").slice(0, 5);
  const link = (e: AdvPageEntry) => <a key={e.slug} href={e.href} onClick={(ev) => { setOpen(false); go(e.slug)(ev); }} data-on={x.pages.active === e.slug ? "" : undefined}>{e.owner ? x.t(e.label) : e.label}</a>;
  return (
    <header className="sr-hd">
      <div className="sr-hd-bar">
        <a className="sr-logo" href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)}>{logo}</a>
        <nav className="sr-nav">{nav.map(link)}</nav>
        <div className="sr-hd-r">
          {x.wa && <a className="sr-pill sr-pill-dark sr-hd-cta" href={s.ask()} target="_blank" rel="noreferrer" onClick={() => x.track("sr-enquire")}>{x.ui("Enquire now", "अभी पूछें")}</a>}
          {s.map && <a className="sr-round sr-hide-sm" href={s.map} target="_blank" rel="noreferrer" aria-label={x.ui("Directions", "रास्ता")} onClick={() => x.track("sr-map")}><Icon name="pin" size={18} /></a>}
          <button type="button" className="sr-round" onClick={() => setOpen(!openMenu)} aria-expanded={openMenu} aria-label={x.ui("Menu", "मेनू")}><Icon name="menu" size={18} /></button>
        </div>
      </div>
      {openMenu && (
        <div className="sr-menu">
          <a href={x.hrefFor(x.pages.home)} onClick={(ev) => { setOpen(false); go(x.pages.home)(ev); }}>{x.ui("Home", "होम")}</a>
          {x.pages.list.filter((e) => e.role !== "home").map(link)}
          <div className="sr-menu-lang">{lang}</div>
        </div>
      )}
    </header>
  );
}

function Footer({ s }: { s: S }) {
  const { c, x, go, card } = s;
  return (
    <footer className="sr-ft">
      <div className="sr-wrap sr-ft-in">
        <div>
          <p className="sr-ft-name">{x.t(c.name)}</p>
          {c.visit?.address && <p className="sr-ft-line">{x.t(c.visit.address)}</p>}
          {x.phone && <p className="sr-ft-line">{phoneText(x.phone.value)}</p>}
        </div>
        <nav className="sr-ft-nav">{x.pages.list.map((e) => <a key={e.slug} href={e.href} onClick={go(e.slug)}>{e.role === "home" ? x.ui("Home", "होम") : e.owner ? x.t(e.label) : e.label}</a>)}</nav>
      </div>
      <div className="sr-wrap sr-ft-bottom">© {new Date().getFullYear()} {x.t(c.name)}{card.seo?.city ? ` · ${x.t(card.seo.city)}` : ""}</div>
    </footer>
  );
}

/* ================= home ================= */

function Hero({ s }: { s: S }) {
  const { c, x, card, cat, go } = s;
  const slides = useMemo(() => {
    const own = (card.site?.hero?.slides ?? []).filter((sl) => sl && (sl.imageUrl || sl.headline)).slice(0, 4)
      .map((sl) => ({ img: sl.imageUrl || c.hm.photo?.src, title: (sl.headline ?? "").trim() || c.hm.headline, sub: (sl.sub ?? "").trim() }));
    if (own.length) return own;
    return [{ img: c.hm.photo?.src ?? c.photos[0], title: c.hm.headline, sub: "" }];
  }, [card, c]);
  const [at, setAt] = useState(0);
  const n = slides.length;
  useEffect(() => {
    let reduce = false; try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old browser */ }
    if (reduce || n < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % n), 6000); return () => clearInterval(t);
  }, [n]);
  const sl = slides[at] ?? slides[0];
  // ONE line of proof under the headline: the slide's own line, else the owner's strongest fact ("Authorised Chitraka dealer",
  // "Since 2012"), else the hero's line. Never a list.
  const fact = c.facts[0] ? `${x.t(c.facts[0].value)} ${x.t(c.facts[0].label)}` : "";
  const proof = sl.sub || c.highlights.find((h) => /dealer|authori[sz]ed|official|since|से/i.test(h)) || fact || c.hm.sub;
  return (
    <section className="sr-hero">
      <div className="sr-wrap sr-hero-txt">
        <h1 key={`h${at}`} className="sr-h1">{x.t(sl.title)}</h1>
        {proof && <p className="sr-proof">{x.t(proof.replace(/^[^\p{L}\p{N}]+/u, ""))}</p>}
      </div>
      <div className="sr-wrap">
        <div className="sr-hero-pic">
          {slides.map((x0, i) => <div key={i} className="sr-hero-slide" data-on={i === at ? "" : undefined} aria-hidden={i !== at}>{x0.img ? <Photo src={x0.img} alt="" eager={i === 0} priority={i === 0} sizes="(min-width:1200px) 1160px, 100vw" /> : null}</div>)}
          <div className="sr-hero-btns">
            {x.wa && <a className="sr-pill sr-pill-dark" href={s.ask()} target="_blank" rel="noreferrer" onClick={() => x.track("sr-hero-primary")}>{s.primary}</a>}
            {cat && s.models.length > 0 && <a className="sr-pill sr-pill-light" href={cat.href} onClick={go(cat.slug)}>{s.motors ? x.ui("Explore models", "मॉडल देखें") : x.ui("See all", "सब देखें")}</a>}
          </div>
          {n > 1 && <div className="sr-dots">{slides.map((_, i) => <button key={i} type="button" data-on={i === at ? "" : undefined} onClick={() => setAt(i)} aria-label={`${i + 1} / ${n}`} />)}</div>}
        </div>
      </div>
    </section>
  );
}

function QuickActions({ s }: { s: S }) {
  const { x, cat, go } = s;
  const acts: { key: string; icon: Parameters<typeof Icon>[0]["name"]; label: string; href: string; ext?: boolean; onClick?: (e: React.MouseEvent) => void }[] = [];
  if (x.wa) acts.push({ key: "wa", icon: s.motors ? "calendar" : "whatsapp", label: s.motors ? x.ui("Test ride", "टेस्ट राइड") : x.ui("WhatsApp", "WhatsApp"), href: s.ask(), ext: true });
  if (s.call) acts.push({ key: "call", icon: "phone", label: x.ui("Call us", "कॉल करें"), href: s.call });
  if (s.map) acts.push({ key: "map", icon: "directions", label: s.motors ? x.ui("Visit showroom", "शोरूम आएँ") : x.ui("Directions", "रास्ता"), href: s.map, ext: true });
  if (cat && s.models.length) acts.push({ key: "cat", icon: "tag", label: x.ui("Prices", "प्राइस"), href: cat.href, onClick: go(cat.slug) });
  if (acts.length < 2) return null;
  return (
    <section className="sr-sec sr-qa-sec">
      <div className="sr-wrap">
        <h2 className="sr-h2 sr-c">{x.ui("Quick actions", "जल्दी करें")}</h2>
        <div className="sr-qa" data-n={acts.length}>
          {acts.map((a) => <a key={a.key} className="sr-qa-tile" href={a.href} {...(a.ext ? { target: "_blank", rel: "noreferrer" } : {})} onClick={(e) => { x.track(`sr-qa-${a.key}`); a.onClick?.(e); }}><Icon name={a.icon} size={20} /><span>{a.label}</span></a>)}
        </div>
      </div>
    </section>
  );
}

function ModelCard({ s, it, big = false, shared }: { s: S; it: AdvItem; big?: boolean; shared: Set<string> }) {
  const { x, go } = s;
  const im = imgsOf(it);
  // A line every model carries (the brand's slogan copied onto each) says nothing about this one: left out.
  const line0 = oneLine(it.item.desc);
  const line = shared.has(line0.toLowerCase()) ? "" : line0;
  const price = (it.item.price ?? "").trim();
  const mrp = (it.item.mrp ?? "").trim();
  return (
    <article className={`sr-model${big ? " sr-model-big" : ""}`}>
      <a className="sr-model-pic" href={x.hrefFor(it.slug)} onClick={go(it.slug)} aria-label={x.t(it.item.name)}>
        {im[0] ? <Photo src={im[0]} alt={x.t(it.item.name)} sizes={big ? "(min-width:1200px) 1160px, 100vw" : "(min-width:900px) 560px, 100vw"} /> : <span className="sr-noimg">{Array.from(it.item.name)[0] ?? ""}</span>}
      </a>
      <div className="sr-model-txt">
        <h3>{x.t(it.item.name)}</h3>
        {line && <p className="sr-model-line">{x.t(line)}</p>}
        {price ? <p className="sr-model-price"><span>{x.ui("Price", "प्राइस")}</span> <b>{price}</b>{mrp && mrp !== price ? <s>{mrp}</s> : null}</p>
          : mrp ? <p className="sr-model-price"><span>MRP</span> <b>{mrp}</b></p> : null}
        <div className="sr-model-btns">
          {x.wa && <a className="sr-pill sr-pill-dark" href={s.ask(it.item.name)} target="_blank" rel="noreferrer" onClick={() => x.track("sr-model-wa")}>{s.motors ? x.ui("Test ride", "टेस्ट राइड") : x.ui("Enquire", "पूछें")}</a>}
          <a className="sr-pill sr-pill-light" href={x.hrefFor(it.slug)} onClick={go(it.slug)}>{x.ui("Explore", "देखें")}</a>
        </div>
      </div>
    </article>
  );
}

function Models({ s }: { s: S }) {
  const { x, c, cat, go, models } = s;
  if (!models.length) return null;
  const [first, ...rest] = models.slice(0, 7);
  const lines = models.map((m) => oneLine(m.item.desc).toLowerCase()).filter(Boolean);
  const shared = new Set(lines.filter((l, i) => lines.indexOf(l) !== i));
  const title = s.motors ? x.ui(`The ${c.name} range`, `${c.name} के मॉडल`) : x.t(c.offerings?.title || x.ui("What we offer", "हमारे प्रोडक्ट"));
  return (
    <section className="sr-sec" id="sr-models">
      <div className="sr-wrap">
        <h2 className="sr-h2">{title}</h2>
        <ModelCard s={s} it={first} big shared={shared} />
        {rest.length > 0 && <div className="sr-models">{rest.map((it) => <ModelCard key={it.slug} s={s} it={it} shared={shared} />)}</div>}
        {cat && models.length > 7 && <p className="sr-c sr-more"><a className="sr-pill sr-pill-light" href={cat.href} onClick={go(cat.slug)}>{x.ui(`See all ${models.length}`, `सभी ${models.length} देखें`)}</a></p>}
      </div>
    </section>
  );
}

/** The reasons, as facts: the owner's numbers first (big), then up to four concrete points (filler never; lib/site-points.ts). */
function Advantage({ s }: { s: S }) {
  const { c, x } = s;
  const facts = c.facts.slice(0, 4);
  const points = cleanPoints(c.highlights).slice(0, 4);
  if (facts.length + points.length < 2) return null;
  return (
    <section className="sr-sec sr-adv">
      <div className="sr-wrap">
        <h2 className="sr-h2">{x.ui(`Why ${c.name}`, `${c.name} ही क्यों`)}</h2>
        <div className="sr-adv-grid">
          {facts.map((f, i) => <div key={`f${i}`} className="sr-adv-tile"><b>{x.t(f.value)}</b><span>{x.t(f.label)}</span></div>)}
          {points.map((p, i) => <div key={`p${i}`} className="sr-adv-tile sr-adv-pt"><Icon name="check" size={18} strokeWidth={2} /><span>{x.t(p.replace(/^[^\p{L}\p{N}]+/u, ""))}</span></div>)}
        </div>
      </div>
    </section>
  );
}

function Gallery({ s }: { s: S }) {
  const { c, x } = s;
  const shots = c.gallery.filter((g) => g.url);
  if (shots.length < 3) return null;
  const urls = shots.map((g) => g.url);
  return (
    <section className="sr-sec">
      <div className="sr-wrap"><h2 className="sr-h2">{x.ui("At the showroom", "शोरूम से")}</h2></div>
      <div className="sr-strip" role="list">
        {shots.slice(0, 9).map((g, i) => <button key={g.url} type="button" role="listitem" className="sr-strip-pic" onClick={() => x.zoom(urls, i, g.label)} aria-label={g.label || `${x.ui("Photo", "फ़ोटो")} ${i + 1}`}><Photo src={g.url} alt={g.label} sizes="(min-width:900px) 380px, 80vw" /></button>)}
      </div>
    </section>
  );
}

function Reviews({ s }: { s: S }) {
  const { c, x } = s;
  const revs = c.reviews.items.filter((r) => !r.sample && (r.text ?? "").trim());
  if (revs.length < 2) return null;
  return (
    <section className="sr-sec">
      <div className="sr-wrap">
        <h2 className="sr-h2">{c.reviews.total >= 3 ? x.ui(`${c.reviews.avg.toFixed(1)}★ from ${c.reviews.total} customers`, `${c.reviews.total} ग्राहकों से ${c.reviews.avg.toFixed(1)}★`) : x.ui("What customers say", "ग्राहक क्या कहते हैं")}</h2>
        <div className="sr-revs">{revs.slice(0, 3).map((r, i) => <figure key={i} className="sr-rev"><blockquote>{x.t(r.text)}</blockquote><figcaption>{r.name}</figcaption></figure>)}</div>
      </div>
    </section>
  );
}

function Visit({ s }: { s: S }) {
  const { c, x } = s;
  const v = c.visit;
  if (!v && !s.call) return null;
  return (
    <section className="sr-sec">
      <div className="sr-wrap">
        <div className="sr-visit">
          <div>
            <h2 className="sr-h2">{s.motors ? x.ui("Visit the showroom", "शोरूम आइए") : x.ui("Visit us", "हमसे मिलिए")}</h2>
            {v?.address && <p className="sr-visit-line"><Icon name="pin" size={18} />{x.t(v.address)}</p>}
            {(v?.hours ?? []).slice(0, 4).map((h, i) => <p key={i} className="sr-visit-line sr-muted"><Icon name="clock" size={18} />{x.t(h.day)} · {x.t(h.time)}</p>)}
          </div>
          <div className="sr-visit-btns">
            {s.map && <a className="sr-pill sr-pill-dark" href={s.map} target="_blank" rel="noreferrer" onClick={() => x.track("sr-visit-map")}>{x.ui("Get directions", "रास्ता देखें")}</a>}
            {s.call && <a className="sr-pill sr-pill-light" href={s.call} onClick={() => x.track("sr-visit-call")}>{x.ui("Call", "कॉल")} {phoneText(x.phone?.value)}</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: S }) {
  const { c, x } = s;
  if (c.faq.length < 2) return null;
  return (
    <section className="sr-sec">
      <div className="sr-wrap sr-narrow">
        <h2 className="sr-h2 sr-c">{x.ui("Frequently asked questions", "अक्सर पूछे जाने वाले सवाल")}</h2>
        <div className="sr-faq">{c.faq.slice(0, 6).map((f, i) => <details key={i}><summary>{x.t(f.q)}</summary><p>{x.t(f.a)}</p></details>)}</div>
      </div>
    </section>
  );
}

function Talk({ s }: { s: S }) {
  const { c, x } = s;
  if (!x.wa && !s.call) return null;
  return (
    <section className="sr-sec">
      <div className="sr-wrap">
        <div className="sr-talk">
          <h2>{s.motors ? x.ui("Ready for a ride?", "राइड के लिए तैयार?") : x.ui("Let's talk", "बात करें")}</h2>
          <p>{x.ui(`${c.name} answers on WhatsApp and phone.`, `${c.name} WhatsApp और फ़ोन पर जवाब देते हैं।`)}</p>
          <div className="sr-talk-btns">
            {x.wa && <a className="sr-pill sr-pill-white" href={s.ask()} target="_blank" rel="noreferrer" onClick={() => x.track("sr-talk-wa")}><Icon name="whatsapp" size={18} />{s.primary}</a>}
            {s.call && <a className="sr-pill sr-pill-ghost" href={s.call} onClick={() => x.track("sr-talk-call")}><Icon name="phone" size={18} />{x.ui("Call now", "अभी कॉल करें")}</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Home({ s }: { s: S }) {
  return (<><Hero s={s} /><QuickActions s={s} /><Models s={s} /><Advantage s={s} /><Gallery s={s} /><Reviews s={s} /><Visit s={s} /><Faq s={s} /><Talk s={s} /></>);
}

export function Showroom(props: Props) {
  const s = useShowroom(props);
  const { route, fallback } = props;
  const body: ReactNode = route.kind === "home" ? <Home s={s} /> : fallback;
  return (
    <div className="sr">
      <Header s={s} logo={props.logo} lang={props.lang} />
      <main id="adv-main" tabIndex={-1} key={route.kind === "item" ? route.item.slug : route.kind === "page" ? route.entry.slug : "home"} className={route.kind === "home" ? "" : "sr-inner"}>{body}</main>
      <Footer s={s} />
      {s.x.wa && <a className="sr-wa-float" href={s.ask()} target="_blank" rel="noreferrer" aria-label="WhatsApp" onClick={() => s.x.track("sr-float")}><Icon name="whatsapp" size={26} /></a>}
    </div>
  );
}

export const SHOWROOM_CSS = `
.sr{--bg:#f2f2f0;--card:#fff;--ink:#161616;--mu:#6b6b6b;--ln:#e3e3e0;--r:22px;background:var(--bg);color:var(--ink);font-family:var(--font-text);font-size:16px;line-height:1.5;overflow-x:clip}
:where(.sr) a{color:inherit;text-decoration:none}
.sr button{font:inherit;background:none;border:0;cursor:pointer;color:inherit}
.sr-wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.sr-narrow{max-width:820px}
.sr-c{text-align:center}
.sr-muted{color:var(--mu)}
.sr-hd{position:sticky;top:0;z-index:40;padding:12px 12px 0}
.sr-hd-bar{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:16px;height:60px;padding:0 10px 0 20px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px rgba(0,0,0,.06)}
.sr-logo{display:flex;align-items:center;min-width:0}
.sr-logo img{max-height:36px;width:auto}
.sr-logo .hero-wordmark b{font:600 18px/1.1 var(--font-display);letter-spacing:.02em}
.sr-nav{display:flex;gap:26px;margin-left:auto;font-size:14px;color:var(--mu)}
.sr-nav a[data-on],.sr-nav a:hover{color:var(--ink)}
.sr-hd-r{display:flex;align-items:center;gap:8px;margin-left:auto}
.sr-nav+.sr-hd-r{margin-left:20px}
.sr-round{width:40px;height:40px;border-radius:999px;display:grid;place-items:center;border:1px solid var(--ln);background:#fff}
.sr-menu{max-width:1200px;margin:8px auto 0;background:#fff;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.1);padding:10px 20px 16px;display:flex;flex-direction:column}
.sr-menu a{padding:12px 0;border-bottom:1px solid var(--ln);font-size:16px}
.sr-menu-lang{padding-top:12px}
.sr-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 24px;border-radius:999px;font-size:15px;font-weight:500;white-space:nowrap;transition:transform .15s,background .15s}
.sr-pill:active{transform:scale(.98)}
.sr-pill-dark{background:var(--ink);color:#fff}.sr-pill-dark:hover{background:#333}
.sr-pill-light{background:#fff;color:var(--ink);border:1px solid var(--ln)}.sr-pill-light:hover{border-color:#bbb}
.sr-pill-white{background:#fff;color:var(--ink)}
.sr-pill-ghost{border:1px solid rgba(255,255,255,.45);color:#fff}
.sr-hd-cta{min-height:40px;padding:0 18px;font-size:14px}
.sr-hero{padding:40px 0 8px}
.sr-hero-txt{text-align:center}
.sr-h1{font:500 clamp(34px,6vw,64px)/1.05 var(--font-display);letter-spacing:-.02em;margin:0;animation:srUp .5s ease both}
.sr-proof{margin:12px auto 0;font-size:clamp(16px,2vw,19px);color:#3c3c3c;max-width:640px}
.sr-hero-pic{position:relative;margin-top:28px;border-radius:var(--r);overflow:hidden;aspect-ratio:16/7;background:#e6e6e3}
.sr-hero-slide{position:absolute;inset:0;opacity:0;transition:opacity .7s}
.sr-hero-slide[data-on]{opacity:1}
.sr-hero-slide .adv-photo{width:100%;height:100%;object-fit:cover}
.sr-hero-btns{position:absolute;left:0;right:0;bottom:28px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;padding:0 16px}
.sr-hero-pic:after{content:"";position:absolute;inset:auto 0 0;height:40%;background:linear-gradient(transparent,rgba(0,0,0,.28));pointer-events:none}
.sr-hero-btns{z-index:2}
.sr-dots{position:absolute;z-index:2;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:6px}
.sr-dots button{width:22px;height:3px;border-radius:2px;background:rgba(255,255,255,.5)}
.sr-dots button[data-on]{background:#fff}
.sr-sec{padding:56px 0 0}
.sr-h2{font:500 clamp(26px,3.4vw,36px)/1.15 var(--font-display);letter-spacing:-.015em;margin:0 0 24px}
.sr-qa{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sr-qa[data-n="2"]{grid-template-columns:repeat(2,1fr)}.sr-qa[data-n="3"]{grid-template-columns:repeat(3,1fr)}
.sr-qa-tile{display:flex;align-items:center;justify-content:center;gap:10px;height:64px;background:#fff;border:1px solid var(--ln);border-radius:16px;font-size:15px;transition:border-color .15s}
.sr-qa-tile:hover{border-color:#aaa}
.sr-model{position:relative;background:var(--card);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column}
.sr-model-pic{position:relative;display:block;aspect-ratio:4/3;background:#e9e9e6}
.sr-model-big .sr-model-pic{aspect-ratio:16/8;background:#fff}
.sr-model-big .sr-model-pic .adv-photo{object-fit:contain;padding:12px 0;background:transparent}
.sr-model-pic .adv-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sr-noimg{position:absolute;inset:0;display:grid;place-items:center;font:500 64px var(--font-display);color:#c9c9c4}
.sr-model-txt{padding:22px 24px 24px}
.sr-model-big{margin-bottom:16px}
.sr-model-big .sr-model-txt{display:grid;grid-template-columns:1fr auto;align-items:end;gap:6px 24px}
.sr-model-big .sr-model-btns{grid-row:1/4;grid-column:2}
.sr-model h3{font:500 24px/1.2 var(--font-display);margin:0}
.sr-model-big h3{font-size:clamp(26px,3vw,34px)}
.sr-model-line{margin:6px 0 0;color:var(--mu);font-size:15px}
.sr-model-price{margin:10px 0 0;font-size:15px;color:var(--mu)}
.sr-model-price b{color:var(--ink);font-size:20px;font-weight:600;margin-left:4px}
.sr-model-price s{margin-left:8px;font-size:14px}
.sr-model-btns{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.sr-model-big .sr-model-btns{margin-top:0;align-self:center}
.sr-models{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.sr-more{margin-top:24px}
.sr-adv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.sr-adv-tile{background:#fff;border-radius:18px;padding:24px;display:flex;flex-direction:column;gap:6px;min-height:132px;justify-content:flex-end}
.sr-adv-tile b{font:500 clamp(28px,3vw,38px)/1 var(--font-display);letter-spacing:-.02em}
.sr-adv-tile span{color:var(--mu);font-size:15px}
.sr-adv-pt{justify-content:space-between}
.sr-adv-pt span{color:var(--ink);font-size:17px;line-height:1.3}
.sr-strip{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 max(20px,calc((100vw - 1160px)/2)) 4px;scrollbar-width:none}
.sr-strip::-webkit-scrollbar{display:none}
.sr-strip-pic{flex:0 0 min(380px,80vw);aspect-ratio:4/3;border-radius:18px;overflow:hidden;position:relative;scroll-snap-align:start;background:#e6e6e3}
.sr-strip-pic .adv-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sr-revs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sr-rev{background:#fff;border-radius:18px;padding:24px;margin:0;display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.sr-rev blockquote{margin:0;font-size:17px;line-height:1.45}
.sr-rev figcaption{color:var(--mu);font-size:14px}
.sr-visit{background:#fff;border-radius:var(--r);padding:32px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end}
.sr-visit .sr-h2{margin-bottom:14px}
.sr-visit-line{display:flex;gap:10px;align-items:flex-start;margin:6px 0 0;font-size:16px}
.sr-visit-line svg{flex:none;margin-top:3px}
.sr-visit-btns{display:flex;gap:8px;flex-wrap:wrap}
.sr-faq details{background:#fff;border-radius:16px;margin-bottom:8px;padding:0 22px}
.sr-faq summary{list-style:none;cursor:pointer;padding:20px 0;font-size:17px;display:flex;justify-content:space-between;gap:16px}
.sr-faq summary::-webkit-details-marker{display:none}
.sr-faq summary:after{content:"+";font-size:22px;line-height:1;color:var(--mu)}
.sr-faq details[open] summary:after{content:"–"}
.sr-faq details p{margin:0 0 20px;color:var(--mu)}
.sr-talk{background:var(--ink);color:#fff;border-radius:var(--r);padding:56px 24px;text-align:center}
.sr-talk h2{font:500 clamp(28px,4vw,44px)/1.1 var(--font-display);margin:0;letter-spacing:-.02em}
.sr-talk p{margin:12px 0 0;color:rgba(255,255,255,.7)}
.sr-talk-btns{display:flex;justify-content:center;gap:10px;margin-top:28px;flex-wrap:wrap}
.sr-ft{margin-top:64px;padding:40px 0 28px;border-top:1px solid var(--ln)}
.sr-ft-in{display:flex;justify-content:space-between;gap:32px;flex-wrap:wrap}
.sr-ft-name{font:500 20px var(--font-display);margin:0 0 6px}
.sr-ft-line{margin:2px 0;color:var(--mu);font-size:14px;max-width:420px}
.sr-ft-nav{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:14px;color:var(--mu);align-content:flex-start}
.sr-ft-bottom{margin-top:28px;font-size:13px;color:var(--mu)}
.sr-wa-float{position:fixed;right:18px;bottom:18px;z-index:45;width:56px;height:56px;border-radius:999px;display:grid;place-items:center;background:#25d366;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.sr-inner{padding-top:16px}
/* The card chat's "Ask" button (card-chat.tsx: fixed, bottom 24px; 76px on a phone) sits in the same corner: the WhatsApp button goes above it. */
.site:has(> .shadow-float) .sr-wa-float{bottom:84px;right:24px}
@media (max-width:767px){.site:has(> .shadow-float) .sr-wa-float{bottom:136px;right:16px}}
@keyframes srUp{from{transform:translateY(8px)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.sr-h1{animation:none}.sr-hero-slide{transition:none}}
@media (max-width:900px){
  .sr-nav{display:none}
  .sr-nav+.sr-hd-r{margin-left:auto}
  .sr-hide-sm{display:none}
  .sr-hero{padding-top:28px}
  .sr-hero-pic{aspect-ratio:16/10;margin-top:20px;overflow:visible;background:none}
  .sr-hero-slide{border-radius:var(--r);overflow:hidden;background:#e6e6e3}
  .sr-hero-pic:after{display:none}
  .sr-hero-btns{position:absolute;top:calc(100% + 14px);bottom:auto;flex-direction:column;align-items:stretch;padding:0}
  .sr-hero{padding-bottom:132px}
  .sr-dots{bottom:10px}
  .sr-qa,.sr-qa[data-n="2"],.sr-qa[data-n="3"]{grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:8px}
  .sr-qa-tile{flex-direction:column;gap:6px;height:76px;font-size:13px;border-radius:14px;text-align:center;padding:0 4px}
  .sr-models,.sr-revs{grid-template-columns:1fr}
  .sr-adv-grid{grid-template-columns:repeat(2,1fr)}
  .sr-adv-grid>:last-child:nth-child(odd){grid-column:1/-1}
  .sr-model-big .sr-model-pic{aspect-ratio:4/3}
  .sr-model-big .sr-model-txt{display:block}
  .sr-model-big .sr-model-btns{margin-top:16px}
  .sr-visit{grid-template-columns:1fr;padding:24px}
  .sr-sec{padding-top:44px}
  .sr-hd-cta{display:none}
}
`;
