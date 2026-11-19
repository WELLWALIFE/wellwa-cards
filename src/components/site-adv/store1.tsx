"use client";
// Bridal Design 1 — "The Couture House" as a full fashion STORE (owner, 17 Nov 2026: "Koskii jaisi site, multi pages"). Written from scratch
// on the layout of a big Indian ethnic-wear store (no code, words or pictures of any real brand): an offer ticker, a centred logo with the
// category menu under it, a sliding banner, arched category frames, the wedding-occasion jharokhas, wide gold-edged banners, a shop-by-budget
// row, real reviews only, the product grid; a collection page with filters and sorting, a product page (photos left, buying right), about
// and visit pages. Everything is read from the card (SiteContent + the items): a section with nothing to show is left out.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Card } from "@/lib/types";
import type { AdvItem, AdvancedSpec } from "@/lib/site-advanced";
import type { SiteContent } from "@/components/site-adv/content";
import type { AdvCtxPlus, AdvPageEntry } from "@/components/site-adv/nav";
import type { AdvRoute } from "@/components/site-adv/pages";
import { Photo } from "@/components/site-adv/shared";
import { Icon } from "@/components/site-icons";
import { ChevronRight, Heart, Plus } from "lucide-react";
import { linkHref } from "@/components/link-icon";

/** The spec of Bridal Design 1 (the fixed template "bridal-couture-house"). */
export const isStore1 = (spec: AdvancedSpec): boolean => typeof spec.seed === "string" && spec.seed.includes("|fix:bridal-couture-house");
/** Bridal Design 2 — "The Bridal Lookbook" as a personal design studio (owner, 17 Nov 2026: a studio site, dark and quiet, appointment first). */
export const isStore2 = (spec: AdvancedSpec): boolean => typeof spec.seed === "string" && spec.seed.includes("|fix:bridal-lookbook");
export type StoreLook = "store" | "studio";

type Props = { card: Card; c: SiteContent; x: AdvCtxPlus; items: AdvItem[]; route: AdvRoute; open: (slug: string) => void; logo: ReactNode; lang: ReactNode; fallback: ReactNode; look?: StoreLook; /** The owner's own colour (hue, chroma) and corners, when chosen in the editor. */ tint?: { h: number; c: number } | null; corners?: string };

const amount = (s?: string): number | null => { const m = /\d[\d,]*(?:\.\d+)?/.exec(s ?? ""); if (!m) return null; const n = Number(m[0].replace(/,/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const inr = (n: number) => { const s = String(Math.round(n)); return s.length <= 3 ? `₹${s}` : `₹${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${s.slice(-3)}`; };
const imgsOf = (it: AdvItem) => [...(it.item.images ?? []), ...(it.item.imageUrl ? [it.item.imageUrl] : [])].filter((u, i, a) => u && a.indexOf(u) === i);
const offPct = (it: AdvItem) => { const p = amount(it.item.price), m = amount(it.item.mrp); return p && m && m > p ? Math.round((1 - p / m) * 100) : 0; };

/** A photo box of a fixed shape; no photo -> a soft tile with the first letter. */
function Pic({ src, alt = "", ratio, eager = false, sizes, name = "" }: { src?: string; alt?: string; ratio: string; eager?: boolean; sizes?: string; name?: string }) {
  return <div className="s1-pic" style={{ aspectRatio: ratio }}>{src ? <Photo src={src} alt={alt} eager={eager} sizes={sizes} /> : <span className="s1-noimg">{Array.from(name)[0] ?? ""}</span>}</div>;
}

function useStore(props: Props) {
  const { card, c, x, items, open } = props;
  const cat = x.pages.byRole("catalogue");
  const about = x.pages.byRole("about");
  const contact = x.pages.byRole("contact");
  const go = (slug?: string) => (e: React.MouseEvent) => { if (!slug) return; e.preventDefault(); open(slug); };
  const products = items.filter((i) => i.kind === "product");
  // The home page's featured few are the catalogue's own items again: each product once, in the catalogue's order (the demo showed
  // "Silk sarees" twice in the categories and the Bestsellers, 17 Nov 2026).
  const all = products.length ? products : items;
  const catSlug = cat?.slug;
  const seen = new Set<string>();
  const shop = [...all.filter((i) => i.page === catSlug && !i.twin), ...all.filter((i) => i.page !== catSlug && !i.twin), ...all.filter((i) => i.twin)].filter((i) => {
    const k = (i.item.name ?? "").trim().toLowerCase(); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true;
  });
  const wa = (text?: string) => x.waHref(text);
  const call = x.phone ? linkHref(x.phone.type, x.phone.value) : "";
  return { card, c, x, cat, about, contact, go, shop, items, wa, call };
}
type S = ReturnType<typeof useStore>;

/* ================= the shell: ticker, header, drawer, footer, floating WhatsApp ================= */

function Header({ s, logo, lang }: { s: S; logo: ReactNode; lang: ReactNode }) {
  const { c, x, go } = s;
  const tick = [...(c.offer ? [c.offer.title || c.offer.text] : []), ...c.highlights, `${x.t(c.trade)}${c.city ? ` · ${x.t(c.city)}` : ""}`, ...(x.wa ? [x.ui("Order on WhatsApp", "WhatsApp पर ऑर्डर करें")] : [])].filter(Boolean).slice(0, 5);
  const nav = x.pages.list.filter((e) => e.role !== "home");
  const link = (e: AdvPageEntry) => <a key={e.slug} href={e.href} onClick={go(e.slug)} data-on={x.pages.active === e.slug ? "" : undefined}>{e.owner ? x.t(e.label) : e.label}</a>;
  return (
    <>
      {tick.length > 0 && <div className="s1-tick" aria-hidden="true"><div className="s1-tick-in">{[...tick, ...tick].map((t, i) => <span key={i}>{x.t(t)}</span>)}</div></div>}
      <header className="s1-hd">
        <div className="s1-hd-row">
          <div className="s1-hd-l">{lang}</div>
          <a className="s1-logo" href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)}>{logo}</a>
          <div className="s1-hd-r">
            {s.call && <a className="s1-ib s1-hide-sm" href={s.call} aria-label={x.ui("Call", "कॉल")} onClick={() => x.track("s1-call")}><Icon name="phone" size={20} /></a>}
            {x.wa && <a className="s1-ib s1-wa" href={s.wa()} target="_blank" rel="noreferrer" aria-label="WhatsApp" onClick={() => x.track("s1-wa")}><Icon name="whatsapp" size={21} /></a>}
          </div>
        </div>
        <nav className="s1-nav"><a href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)} data-on={x.pages.active === x.pages.home ? "" : undefined}>{x.ui("Home", "होम")}</a>{nav.map(link)}</nav>
      </header>
    </>
  );
}

function Footer({ s }: { s: S }) {
  const { c, x, go, card } = s;
  const pages = x.pages.list;
  const pops = [...new Set([...s.shop.map((i) => i.item.category ?? ""), ...s.shop.map((i) => i.item.name)].filter(Boolean))].slice(0, 10);
  return (
    <footer className="s1-ft">
      <div className="s1-wrap s1-ft-cols">
        <div><h4>{x.ui("Shop", "शॉप")}</h4>{pages.map((e) => <a key={e.slug} href={e.href} onClick={go(e.slug)}>{e.role === "home" ? x.ui("Home", "होम") : e.owner ? x.t(e.label) : e.label}</a>)}</div>
        <div><h4>{x.ui("Visit us", "हमसे मिलें")}</h4>
          {c.visit?.address && <p className="s1-ft-line"><Icon name="pin" size={16} />{x.t(c.visit.address)}</p>}
          {(c.visit?.hours ?? []).slice(0, 3).map((h, i) => <p key={i} className="s1-ft-line">{x.t(h.day)} · {x.t(h.time)}</p>)}
          {x.phone && <p className="s1-ft-line"><Icon name="phone" size={16} />{x.phone.value}</p>}
        </div>
        <div><h4>{x.ui("Stay in touch", "जुड़े रहें")}</h4><p>{x.ui("New collections and offers, straight to your WhatsApp.", "नए कलेक्शन और ऑफ़र, सीधे आपके WhatsApp पर।")}</p>
          {x.wa && <a className="s1-btn s1-btn-dark" href={s.wa(x.ui("Hi, please send me your new collection", "नमस्ते, अपना नया कलेक्शन भेजिए"))} target="_blank" rel="noreferrer" onClick={() => x.track("s1-footer-wa")}><Icon name="whatsapp" size={18} />{x.ui("Get updates on WhatsApp", "WhatsApp पर अपडेट पाएँ")}</a>}
        </div>
      </div>
      {pops.length > 2 && <div className="s1-wrap s1-ft-pop"><h5>{x.ui("Popular searches", "लोकप्रिय खोजें")}</h5><p>{pops.map((p, i) => <span key={i}>{i > 0 && " | "}<a href={s.cat?.href ?? "#"} onClick={go(s.cat?.slug)}>{x.t(p)}{c.city ? ` ${x.ui("in", "")} ${x.t(c.city)}`.replace(/ {2}/g, " ") : ""}</a></span>)}</p></div>}
      <div className="s1-wrap s1-ft-bottom">© {new Date().getFullYear()} {x.t(c.name)}{card.seo?.city ? ` · ${x.t(card.seo.city)}` : ""}</div>
    </footer>
  );
}

/* ================= product card ================= */

function Card1({ s, it, eager = false }: { s: S; it: AdvItem; eager?: boolean }) {
  const { x, go, c } = s;
  const [fav, setFav] = useState(false);
  const im = imgsOf(it); const pc = offPct(it);
  const mrpShow = it.item.mrp && it.item.price && (amount(it.item.mrp) ?? 0) > (amount(it.item.price) ?? 0);
  return (
    <div className="s1-pc">
      <a href={x.hrefFor(it.slug)} onClick={go(it.slug)} className="s1-pc-media">
        <Pic src={im[0]} alt={x.t(it.item.name)} ratio="3/4" eager={eager} sizes="(min-width:1024px) 20vw, 50vw" name={it.item.name} />
        {im[1] && <div className="s1-pc-alt"><Photo src={im[1]} alt="" sizes="(min-width:1024px) 20vw, 50vw" /></div>}
        {it.item.badge && <span className="s1-tag">{x.t(it.item.badge)}</span>}
      </a>
      <button type="button" className="s1-heart" data-on={fav ? "" : undefined} onClick={() => setFav(!fav)} aria-label={x.ui("Save", "सेव करें")}><Heart size={18} /></button>
      <div className="s1-pc-body">
        <a href={x.hrefFor(it.slug)} onClick={go(it.slug)} className="s1-pc-name">{x.t(it.item.name)}</a>
        {it.item.price && <div className="s1-pc-price">{mrpShow && <s>{it.item.mrp}</s>}<b>{it.item.price}</b>{pc >= 5 && <span className="s1-off">{pc}% {x.ui("OFF", "छूट")}</span>}</div>}
      </div>
      {x.wa && <a className="s1-pc-wa" href={s.wa(x.hi ? `नमस्ते ${c.name}, मुझे "${it.item.name}" के बारे में जानना है` : `Hi ${c.name}, I'd like to know about "${it.item.name}"`)} target="_blank" rel="noreferrer" aria-label={`WhatsApp: ${x.t(it.item.name)}`} onClick={() => x.track("s1-item-wa")}><Icon name="whatsapp" size={19} /></a>}
    </div>
  );
}

/* ================= HOME ================= */

const OCCASIONS: [string, string][] = [["Haldi", "हल्दी"], ["Mehendi", "मेहंदी"], ["Sangeet", "संगीत"], ["Cocktail", "कॉकटेल"], ["Wedding", "शादी"], ["Reception", "रिसेप्शन"]];

function Home({ s }: { s: S }) {
  const { c, x, go, card, shop } = s;
  const [at, setAt] = useState(0);
  const slides = useMemo(() => {
    const own = (card.site?.hero?.slides ?? []).filter((sl) => sl && sl.headline).slice(0, 3);
    if (own.length) return own.map((sl) => ({ img: sl.imageUrl || c.hm.photo?.src, title: sl.headline, sub: sl.sub ?? "" }));
    const pool = [c.hm.photo?.src, ...c.gallery.map((g) => g.url), ...c.photos].filter((u): u is string => !!u).filter((u, i, a) => a.indexOf(u) === i);
    const out = [{ img: pool[0], title: c.hm.headline, sub: c.hm.sub }];
    const cats = [...new Set(shop.map((i) => i.item.category ?? i.item.name))];
    if (pool[1] && cats[0]) out.push({ img: pool[1], title: cats[0], sub: x.ui("Explore the collection", "कलेक्शन देखें") });
    if (pool[2] && cats[1]) out.push({ img: pool[2], title: cats[1], sub: x.ui("New this season", "इस सीज़न में नया") });
    return out;
  }, [card, c, shop, x]);
  const n = slides.length;
  useEffect(() => {
    let reduce = false; try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old browser */ }
    if (reduce || n < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % n), 5000); return () => clearInterval(t);
  }, [n]);
  // categories: the owner's product categories (with their first photo), else the items themselves
  const cats = useMemo(() => {
    const byCat = new Map<string, AdvItem>();
    for (const it of shop) { const k = (it.item.category ?? "").trim(); if (k && !byCat.has(k)) byCat.set(k, it); }
    return byCat.size >= 3 ? [...byCat.entries()].map(([k, it]) => ({ label: k, it, slug: s.cat?.slug })) : shop.slice(0, 6).map((it) => ({ label: it.item.name, it, slug: it.slug }));
  }, [shop, s.cat]);
  const pool = [...c.gallery.map((g) => g.url), ...c.photos].filter((u, i, a) => u && a.indexOf(u) === i);
  const occ = pool.length >= 6 ? OCCASIONS : pool.length >= 3 ? OCCASIONS.slice(3) : [];
  const priced = shop.map((i) => amount(i.item.price)).filter((n): n is number => n !== null).sort((a, b) => a - b);
  const budgets = priced.length >= 4 ? [...new Set([0.25, 0.5, 0.75, 1].map((q) => { const v = priced[Math.min(priced.length - 1, Math.floor(q * (priced.length - 1)))]; const m = 10 ** Math.max(2, Math.floor(Math.log10(v)) - 1); return Math.ceil(v / m) * m; }))] : [];
  const revs = c.reviews.items.filter((r) => !r.sample);
  // Bestsellers in full rows on every screen (5 on a computer left 3+2 on a tablet and one alone on a phone): 10, 6 or 4.
  const best = shop.length >= 10 ? 10 : shop.length >= 6 ? 6 : Math.min(4, shop.length);
  const catHref = s.cat?.href ?? "#"; const toCat = go(s.cat?.slug);
  const bandImg = pool[3] ?? pool[0];
  const trialImg = c.about?.image ?? pool[4] ?? pool[1];
  const slide = slides[at] ? at : 0;
  return (
    <>
      <section className="s1-hero">
        <div className="s1-hero-track" style={{ transform: `translateX(${-100 * slide}%)` }}>
          {slides.map((sl, i) => (
            <div className="s1-slide" key={i}>
              <Pic src={sl.img} ratio="16/7" eager={i === 0} sizes="100vw" name={c.name} />
              <div className={`s1-slide-txt ${i % 2 ? "r" : ""}`}><p className="s1-ey">{x.t(c.trade)}{c.city ? ` · ${x.t(c.city)}` : ""}</p><h1 className="s1-h1">{x.t(sl.title)}</h1>{sl.sub && <p>{x.t(sl.sub)}</p>}
                <a className="s1-btn s1-btn-light" href={catHref} onClick={toCat}>{x.ui("Shop now", "अभी देखें")}</a></div>
            </div>
          ))}
        </div>
        {slides.length > 1 && <div className="s1-dots">{slides.map((_, i) => <button key={i} type="button" data-on={i === slide ? "" : undefined} onClick={() => setAt(i)} aria-label={`${i + 1}`} />)}</div>}
      </section>

      {cats.length >= 3 && <section className="s1-sec"><div className="s1-wrap s1-cats">{cats.slice(0, 6).map((k, i) => (
        <a key={i} className="s1-cat" href={k.slug ? x.hrefFor(k.slug) : catHref} onClick={go(k.slug ?? s.cat?.slug)}><div className="s1-arch"><Pic src={imgsOf(k.it)[0]} ratio="4/5" sizes="200px" name={k.label} /></div><span>{x.t(k.label)}</span></a>))}</div></section>}

      {occ.length > 0 && <section className="s1-sec"><h2 className="s1-st">{x.ui("Wedding occasion wardrobe", "शादी के हर मौके के लिए")}</h2><div className="s1-wrap s1-occ">{occ.map(([en, hi], i) => (
        <a key={en} className="s1-jh" href={catHref} onClick={toCat}><span className="s1-marigold" aria-hidden="true" /><Pic src={pool[i % pool.length]} ratio="4/5" sizes="(min-width:1024px) 30vw, 50vw" name={en} /><b>{x.ui(en, hi)}</b></a>))}</div></section>}

      {bandImg && <section className="s1-sec"><div className="s1-wrap"><a className="s1-band" href={catHref} onClick={toCat}><Pic src={bandImg} ratio="3/1" sizes="100vw" name={c.name} />
        <div className="s1-band-txt"><p className="s1-script">{x.ui("Just arrived", "अभी-अभी आया")}</p><h2>{c.offer ? x.t(c.offer.title || c.offer.text) : x.ui("The New Collection", "नया कलेक्शन")}</h2><span className="s1-btn s1-btn-light">{x.ui("Shop now", "अभी देखें")}</span></div></a></div></section>}

      {budgets.length >= 3 && <section className="s1-sec"><h2 className="s1-st">{x.ui("Shop by budget", "बजट के हिसाब से")}</h2><div className="s1-wrap s1-bud">{budgets.map((b) => (
        <a key={b} className="s1-budc" href={catHref} onClick={toCat}><small>{x.ui("Under", "तक")}</small><b>{inr(b)}</b><span>{x.ui("Shop now →", "देखें →")}</span></a>))}</div></section>}

      {x.wa && <section className="s1-sec"><div className="s1-wrap"><a className="s1-band" href={s.wa(x.ui("Hi, I'd like to book a trial appointment", "नमस्ते, मुझे ट्रायल अपॉइंटमेंट बुक करना है"))} target="_blank" rel="noreferrer" onClick={() => x.track("s1-trial")}>
        <Pic src={trialImg} ratio="3/1" sizes="100vw" name={c.name} /><div className="s1-band-txt l"><p className="s1-script">{x.ui("Your day, your fit", "आपका दिन, आपकी फ़िटिंग")}</p><h2>{x.ui("Book a Trial Appointment", "ट्रायल अपॉइंटमेंट बुक करें")}</h2><span className="s1-btn s1-btn-light">{x.ui("Book on WhatsApp", "WhatsApp पर बुक करें")}</span></div></a></div></section>}

      {revs.length > 0 && <section className="s1-sec"><h2 className="s1-st">{x.ui("What our customers say", "हमारे ग्राहक क्या कहते हैं")}</h2><div className="s1-wrap s1-rev">{revs.slice(0, 6).map((r, i) => (
        <div key={i} className="s1-revc"><span className="s1-stars">{"★★★★★".slice(0, Math.max(1, Math.round(r.rating || 5)))}</span><p>“{x.t(r.text)}”</p><b>{x.t(r.name).toUpperCase()}</b></div>))}</div></section>}

      {shop.length > 0 && <section className="s1-sec"><h2 className="s1-st">{x.ui("Bestsellers", "सबसे ज़्यादा पसंद")}</h2><div className="s1-grid5" data-n={best}>{shop.slice(0, best).map((it, i) => <Card1 key={it.slug} s={s} it={it} eager={i < 5} />)}</div>
        {s.cat && shop.length > best && <div className="s1-center"><a className="s1-btn s1-btn-outline" href={catHref} onClick={toCat}>{x.ui("View all", "सभी देखें")}</a></div>}</section>}

      {c.about && <section className="s1-sec"><div className="s1-wrap s1-about"><div><h2 className="s1-st l">{x.t(c.about.title)}</h2>{c.about.paras.slice(0, 2).map((p, i) => <p key={i}>{x.t(p)}</p>)}
        {s.about && <a className="s1-btn s1-btn-outline" href={s.about.href} onClick={go(s.about.slug)}>{x.ui("Our story", "हमारी कहानी")}</a>}</div>
        <Pic src={c.about.image ?? pool[2]} ratio="4/3" sizes="50vw" name={c.name} /></div></section>}
    </>
  );
}
/* ================= COLLECTION ================= */

function Collection({ s, entry }: { s: S; entry: AdvPageEntry }) {
  const { c, x, go } = s;
  const own = s.items.filter((i) => i.page === entry.slug && !i.twin);
  const all = own.length ? own : s.shop;
  const cats = [...new Set(all.map((i) => (i.item.category ?? "").trim()).filter(Boolean))];
  const priced = all.map((i) => amount(i.item.price)).filter((n): n is number => n !== null);
  const max = priced.length ? Math.max(...priced) : 0;
  const bands = max ? [0.25, 0.5, 1].map((q) => Math.ceil((max * q) / 1000) * 1000).filter((v, i, a) => a.indexOf(v) === i) : [];
  const [catSel, setCat] = useState<string>("");
  const [under, setUnder] = useState<number>(0);
  const [sort, setSort] = useState("featured");
  let list = all.filter((i) => (!catSel || (i.item.category ?? "").trim() === catSel) && (!under || (amount(i.item.price) ?? Infinity) <= under));
  if (sort !== "featured") list = [...list].sort((a, b) => ((amount(a.item.price) ?? 1e12) - (amount(b.item.price) ?? 1e12)) * (sort === "low" ? 1 : -1));
  const title = entry.owner ? x.t(entry.label) : entry.label;
  return (
    <>
      <div className="s1-wrap s1-crumb"><a href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)}>{x.ui("Home", "होम")}</a><ChevronRight size={12} /><span>{title}</span></div>
      <div className="s1-wrap s1-coll">
        <div className="s1-coll-main">
          <h1 className="s1-coll-h">{title}</h1>
          <p className="s1-coll-intro">{x.t(c.hm.sub)}</p>
          {(cats.length > 1 || bands.length > 1) && <div className="s1-chips"><button type="button" data-on={!catSel && !under ? "" : undefined} onClick={() => { setCat(""); setUnder(0); }}>{x.ui("All", "सभी")}</button>{cats.length > 1 && cats.map((k) => <button type="button" key={k} data-on={catSel === k ? "" : undefined} onClick={() => setCat(k)}>{x.t(k)}</button>)}{bands.length > 1 && bands.map((b) => <button type="button" key={`u${b}`} data-on={under === b ? "" : undefined} onClick={() => setUnder(under === b ? 0 : b)}>{x.ui("Under", "तक")} {inr(b)}</button>)}</div>}
          <div className="s1-coll-bar"><span>{list.length} {x.ui(list.length === 1 ? "product" : "products", "प्रोडक्ट")}</span>
            {priced.length > 1 && <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={x.ui("Sort", "क्रम")}><option value="featured">{x.ui("Sort: Featured", "क्रम: खास")}</option><option value="low">{x.ui("Price: low to high", "दाम: कम से ज़्यादा")}</option><option value="high">{x.ui("Price: high to low", "दाम: ज़्यादा से कम")}</option></select>}</div>
          <div className="s1-grid4">{list.map((it, i) => <Card1 key={it.slug} s={s} it={it} eager={i < 4} />)}</div>
        </div>
      </div>
    </>
  );
}

/* ================= PRODUCT ================= */

function Product({ s, it }: { s: S; it: AdvItem }) {
  const { c, x, go } = s;
  const im = imgsOf(it); const pc = offPct(it);
  const entry = x.pages.list.find((e) => e.slug === it.page) ?? s.cat;
  const more = s.shop.filter((o) => o.slug !== it.slug).slice(0, 4);
  const name = x.t(it.item.name);
  const waText = x.hi ? `नमस्ते ${c.name}, मुझे "${it.item.name}"${it.item.price ? ` (${it.item.price})` : ""} चाहिए` : `Hi ${c.name}, I'd like to order "${it.item.name}"${it.item.price ? ` (${it.item.price})` : ""}`;
  const mrpShow = it.item.mrp && it.item.price && (amount(it.item.mrp) ?? 0) > (amount(it.item.price) ?? 0);
  return (
    <>
      <div className="s1-wrap s1-crumb"><a href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)}>{x.ui("Home", "होम")}</a><ChevronRight size={12} />
        {entry && <><a href={entry.href} onClick={go(entry.slug)}>{entry.owner ? x.t(entry.label) : entry.label}</a><ChevronRight size={12} /></>}<span>{name}</span></div>
      <div className="s1-wrap s1-pdp">
        <div className="s1-gal" data-n={Math.min(im.length, 4)}>
          {(im.length ? im : [""]).slice(0, 4).map((u, i) => <button key={i} type="button" className="s1-gal-i" onClick={() => u && x.zoom(im, i, name)} aria-label={x.ui("View photo", "फ़ोटो देखें")}><Pic src={u || undefined} ratio="3/4" eager={i < 2} sizes="(min-width:1024px) 30vw, 90vw" name={it.item.name} /></button>)}
        </div>
        <div className="s1-info">
          <h1>{name}</h1>
          {it.item.category && <p className="s1-muted">{x.t(it.item.category)}</p>}
          {it.item.price && <div className="s1-price">{mrpShow && <><small>MRP</small><s>{it.item.mrp}</s></>}<b>{it.item.price}</b>{pc >= 5 && <span className="s1-off">{pc}% {x.ui("OFF", "छूट")}</span>}</div>}
          {it.item.price && <p className="s1-muted">{x.ui("Inclusive of all taxes", "सभी टैक्स सहित")}</p>}
          <div className="s1-btns">
            {x.wa && <a className="s1-btn s1-btn-solid" href={s.wa(waText)} target="_blank" rel="noreferrer" onClick={() => x.track("s1-order")}><Icon name="whatsapp" size={18} />{x.ui("Order on WhatsApp", "WhatsApp पर ऑर्डर")}</a>}
            {s.contact ? <a className="s1-btn s1-btn-ghost" href={s.contact.href} onClick={go(s.contact.slug)}>{x.ui("Visit the store", "स्टोर आएँ")}</a>
              : s.call ? <a className="s1-btn s1-btn-ghost" href={s.call}>{x.ui("Call us", "कॉल करें")}</a> : null}
          </div>
          {c.highlights.length > 0 && <div className="s1-trust">{c.highlights.slice(0, 3).map((h, i) => <span key={i}>✓ {x.t(h)}</span>)}</div>}
          {(it.item.desc || it.item.features.length > 0 || it.item.specs.length > 0) && (
            <details className="s1-acc" open><summary>{x.ui("Details", "डिटेल")}<Plus size={16} /></summary><div>
              {it.item.desc && <p>{x.t(it.item.desc)}</p>}
              {it.item.features.length > 0 && <ul>{it.item.features.map((f, i) => <li key={i}>{x.t(f)}</li>)}</ul>}
              {it.item.specs.length > 0 && <div className="s1-spec">{it.item.specs.map((r, i) => <span key={i}>{x.t(r.label)}<b>{x.t(r.value)}</b></span>)}</div>}
              <p className="s1-note">{x.ui("Colour may look slightly different because of lighting and screen settings.", "रोशनी और स्क्रीन की वजह से रंग थोड़ा अलग दिख सकता है।")}</p>
            </div></details>)}
          {c.visit && <details className="s1-acc"><summary>{x.ui("Visit & delivery", "स्टोर और डिलीवरी")}<Plus size={16} /></summary><div>
            {c.visit.address && <p>{x.t(c.visit.address)}</p>}{c.visit.hours.slice(0, 3).map((h, i) => <p key={i}>{x.t(h.day)} · {x.t(h.time)}</p>)}
            {x.wa && <p>{x.ui("Ask on WhatsApp for delivery to your city.", "अपने शहर में डिलीवरी के लिए WhatsApp पर पूछें।")}</p>}</div></details>}
          {c.faq.length > 0 && <details className="s1-acc"><summary>{x.ui("Good to know", "जानने लायक़")}<Plus size={16} /></summary><div>{c.faq.slice(0, 3).map((f, i) => <p key={i}><b>{x.t(f.q)}</b><br />{x.t(f.a)}</p>)}</div></details>}
        </div>
      </div>
      {more.length > 0 && <section className="s1-sec"><h2 className="s1-st">{x.ui("You may also like", "ये भी देखें")}</h2><div className="s1-wrap s1-grid4">{more.map((o) => <Card1 key={o.slug} s={s} it={o} />)}</div></section>}
    </>
  );
}

/* ================= ABOUT + CONTACT ================= */

function About({ s, entry }: { s: S; entry: AdvPageEntry }) {
  const { c, x } = s;
  const img = c.about?.image ?? c.photos[1] ?? c.photos[0];
  return (
    <>
      <section className="s1-pagehero"><Pic src={img} ratio="16/6" eager sizes="100vw" name={c.name} /><div className="s1-pagehero-txt"><p className="s1-script">{entry.owner ? x.t(entry.label) : entry.label}</p><h1>{x.t(c.name)}</h1></div></section>
      {c.about && <section className="s1-sec s1-wrap s1-about"><div><h2 className="s1-st l">{x.t(c.about.title)}</h2>{c.about.paras.map((p, i) => <p key={i}>{x.t(p)}</p>)}</div>
        {c.facts.length > 0 ? <div className="s1-facts">{c.facts.slice(0, 4).map((f, i) => <div key={i}><b>{x.t(f.value)}</b><span>{x.t(f.label)}</span></div>)}</div> : <Pic src={c.photos[2] ?? img} ratio="4/3" sizes="50vw" name={c.name} />}</section>}
      {c.steps.length >= 2 && <section className="s1-sec s1-wrap"><h2 className="s1-st">{x.ui("How it works", "कैसे होता है")}</h2><div className="s1-steps">{c.steps.slice(0, 4).map((st, i) => <div key={i}><i>{i + 1}</i><b>{x.t(st.name)}</b>{st.desc && <span>{x.t(st.desc)}</span>}</div>)}</div></section>}
      {c.faq.length > 0 && <section className="s1-sec s1-wrap s1-faq"><h2 className="s1-st">{x.ui("Good to know", "जानने लायक़")}</h2>{c.faq.map((f, i) => <details key={i} className="s1-acc"><summary>{x.t(f.q)}<Plus size={16} /></summary><div><p>{x.t(f.a)}</p></div></details>)}</section>}
    </>
  );
}

function Contact({ s, entry }: { s: S; entry: AdvPageEntry }) {
  const { c, x } = s;
  return (
    <section className="s1-sec s1-wrap s1-contact">
      <div>
        <h1 className="s1-coll-h">{entry.owner ? x.t(entry.label) : entry.label}</h1>
        <p className="s1-coll-intro">{x.ui("Come in for a trial, or message us on WhatsApp.", "ट्रायल के लिए आइए, या WhatsApp पर मैसेज कीजिए।")}</p>
        <div className="s1-clist">
          {x.wa && <a href={s.wa()} target="_blank" rel="noreferrer" onClick={() => x.track("s1-contact-wa")}><Icon name="whatsapp" size={24} /><span><b>WhatsApp</b>{x.wa.value}</span></a>}
          {x.phone && <a href={s.call}><Icon name="phone" size={24} /><span><b>{x.ui("Call", "कॉल")}</b>{x.phone.value}</span></a>}
          {c.visit?.address && <a href={c.visit.mapUrl || "#"} target={c.visit.mapUrl ? "_blank" : undefined} rel="noreferrer"><Icon name="pin" size={24} /><span><b>{x.ui("Store", "स्टोर")}</b>{x.t(c.visit.address)}</span></a>}
        </div>
        {c.visit && c.visit.hours.length > 0 && <table className="s1-hours"><tbody>{c.visit.hours.map((h, i) => <tr key={i}><td>{x.t(h.day)}</td><td>{x.t(h.time)}</td></tr>)}</tbody></table>}
        {x.wa && <a className="s1-btn s1-btn-solid" href={s.wa(x.ui("Hi, I'd like to book a trial appointment", "नमस्ते, मुझे ट्रायल अपॉइंटमेंट बुक करना है"))} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={18} />{x.ui("Book a trial on WhatsApp", "WhatsApp पर ट्रायल बुक करें")}</a>}
      </div>
      <Pic src={c.photos[0]} ratio="4/5" sizes="50vw" name={c.name} />
    </section>
  );
}


/* ================= DESIGN 2: the personal studio ================= */

const nameParts = (name: string): [string, string] => { const w = name.trim().split(/\s+/); return w.length > 1 ? [w[0], w.slice(1).join(" ")] : [name, ""]; };

function StudioHeader({ s, lang }: { s: S; lang: ReactNode }) {
  const { c, x, go } = s;
  const [a, b] = nameParts(x.t(c.name));
  const nav = x.pages.list.filter((e) => e.role !== "home");
  const book = s.contact ? { href: s.contact.href, onClick: go(s.contact.slug) } : x.wa ? { href: s.wa(x.ui("Hi, I'd like to book an appointment", "नमस्ते, मुझे अपॉइंटमेंट बुक करना है")), target: "_blank", rel: "noreferrer" } : null;
  return (
    <header className="s2-hd">
      <div className="s2-hd-row">
        <a className="s2-name" href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)}>{a}{b && <em> {b}</em>}</a>
        <nav className="s2-nav"><a href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)} data-on={x.pages.active === x.pages.home ? "" : undefined}>{x.ui("Home", "होम")}</a>
          {nav.map((e) => <a key={e.slug} href={e.href} onClick={go(e.slug)} data-on={x.pages.active === e.slug ? "" : undefined}>{e.owner ? x.t(e.label) : e.label}</a>)}</nav>
        <div className="s2-hd-r"><span className="s2-lang">{lang}</span>{book && <a className="s2-btn s2-btn-line" {...book} onClick={(book as { onClick?: (e: React.MouseEvent) => void }).onClick ?? (() => x.track("s2-book"))}>{x.ui("Book appointment", "अपॉइंटमेंट")}</a>}</div>
      </div>
    </header>
  );
}

function StudioFooter({ s }: { s: S }) {
  const { c, x, go, card } = s;
  const [a, b] = nameParts(x.t(c.name));
  const ig = card.links.find((l) => l.type === "instagram" && l.value.trim());
  return (
    <footer className="s2-ft"><div className="s1-wrap s2-ft-cols">
      <div><p className="s2-name">{a}{b && <em> {b}</em>}</p><p className="s2-muted">{x.t(c.hm.sub)}</p>{c.city && <p className="s2-muted">{x.t(c.trade)} · {x.t(c.city)}</p>}</div>
      <div><h4>{x.ui("Navigate", "पेज")}</h4>{x.pages.list.map((e) => <a key={e.slug} href={e.href} onClick={go(e.slug)}>{e.role === "home" ? x.ui("Home", "होम") : e.owner ? x.t(e.label) : e.label}</a>)}</div>
      <div><h4>{x.ui("Get in touch", "संपर्क")}</h4>{x.phone && <a href={s.call}>{x.phone.value}</a>}{x.wa && <a href={s.wa()} target="_blank" rel="noreferrer">WhatsApp</a>}{c.visit?.address && <p className="s2-muted">{x.t(c.visit.address)}</p>}{ig && <a href={ig.value.startsWith("http") ? ig.value : `https://instagram.com/${ig.value.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Instagram</a>}</div>
    </div><div className="s1-wrap s2-ft-bottom"><span>© {new Date().getFullYear()} {x.t(c.name)}</span>{c.city && <span>{x.t(c.city)}</span>}</div></footer>
  );
}

function StudioHome({ s }: { s: S }) {
  const { c, x, go, card, shop } = s;
  const pool = [c.hm.photo?.src, ...c.gallery.map((g) => g.url), ...c.photos].filter((u): u is string => !!u).filter((u, i, a) => a.indexOf(u) === i);
  const headline = x.t(c.hm.headline); const hw = headline.split(" "); const cut = Math.ceil(hw.length / 2);
  const catHref = s.cat?.href ?? "#"; const toCat = go(s.cat?.slug);
  const bookWa = s.wa(x.ui("Hi, I'd like to book an appointment", "नमस्ते, मुझे अपॉइंटमेंट बुक करना है"));
  // the collections: the owner's categories with their first item, else the first three items
  const byCat = new Map<string, AdvItem>();
  for (const it of shop) { const k = (it.item.category ?? "").trim(); if (k && !byCat.has(k)) byCat.set(k, it); }
  const cols = (byCat.size >= 2 ? [...byCat.entries()].map(([k, it]) => ({ title: k, it, slug: s.cat?.slug })) : shop.map((it) => ({ title: it.item.name, it, slug: it.slug as string | undefined }))).slice(0, 3);
  const marquee = [...new Set([...byCat.keys(), ...shop.map((i) => i.item.name)])].slice(0, 8);
  const points = c.steps.length >= 2 ? c.steps.slice(0, 4).map((p) => ({ t: p.name, d: p.desc })) : c.highlights.slice(0, 4).map((h) => ({ t: h, d: "" }));
  const revs = c.reviews.items.filter((r) => !r.sample).slice(0, 3);
  const ig = card.links.find((l) => l.type === "instagram" && l.value.trim());
  const [form, setForm] = useState({ name: "", occasion: "", date: "", msg: "" });
  const occ = [x.ui("Bridal", "दुल्हन"), x.ui("Groom", "दूल्हा"), x.ui("Sangeet / Mehendi", "संगीत / मेहंदी"), x.ui("Reception", "रिसेप्शन"), x.ui("Family / group", "परिवार / ग्रुप"), x.ui("Other", "अन्य")];
  const send = () => {
    const lines = [x.ui(`Hi ${c.name}, I'd like to book a consultation.`, `नमस्ते ${c.name}, मुझे कंसल्टेशन बुक करना है।`), form.name && `${x.ui("Name", "नाम")}: ${form.name}`, form.occasion && `${x.ui("Occasion", "मौका")}: ${form.occasion}`, form.date && `${x.ui("Event date", "तारीख़")}: ${form.date}`, form.msg].filter(Boolean).join("\n");
    x.track("s2-form"); window.open(s.wa(lines), "_blank", "noopener");
  };
  return (
    <>
      <section className="s2-hero">
        <Pic src={pool[0]} ratio="16/9" eager sizes="100vw" name={c.name} />
        <div className="s2-hero-frame" aria-hidden="true" />
        <div className="s2-hero-txt">
          <p className="s2-ey">{x.t(c.trade)}{c.city ? ` · ${x.t(c.city)}` : ""}</p>
          <h1>{hw.slice(0, cut).join(" ")}{hw.length > 1 && <><br /><em>{hw.slice(cut).join(" ")}</em></>}</h1>
          {c.hm.sub && <p className="s2-lede">{x.t(c.hm.sub)}</p>}
          <div className="s2-btns">{s.cat && <a className="s2-btn s2-btn-fill" href={catHref} onClick={toCat}>{x.ui("Explore collections", "कलेक्शन देखें")}</a>}
            {x.wa && <a className="s2-btn s2-btn-line" href={bookWa} target="_blank" rel="noreferrer" onClick={() => x.track("s2-hero-book")}>{x.ui("Book appointment", "अपॉइंटमेंट बुक करें")}</a>}</div>
        </div>
      </section>
      {marquee.length > 2 && <div className="s2-marq" aria-hidden="true"><div className="s2-marq-in">{[...marquee, ...marquee].map((m, i) => <span key={i}>{x.t(m)}</span>)}</div></div>}

      {cols.length > 0 && <section className="s2-sec"><div className="s2-head"><p className="s2-ey">{x.ui("Our collections", "हमारे कलेक्शन")}</p><h2>{x.ui("Dressed for Every Occasion", "हर मौके के लिए")}</h2><p className="s2-lede">{x.t(c.hm.sub)}</p></div>
        <div className="s1-wrap s2-cols" data-n={cols.length}>{cols.map((k, i) => (
          <div key={i} className="s2-col"><a href={k.slug ? x.hrefFor(k.slug) : catHref} onClick={go(k.slug ?? s.cat?.slug)}><Pic src={imgsOf(k.it)[0]} ratio="3/4" sizes="(min-width:1024px) 33vw, 100vw" name={k.title} /></a>
            <div className="s2-col-txt"><h3>{x.t(k.title)}</h3>{k.it.item.desc && <p>{x.t(k.it.item.desc)}</p>}
              {x.wa && <a className="s2-btn s2-btn-line" href={s.wa(x.ui(`Hi, I'd like to know about ${k.title}`, `नमस्ते, मुझे ${k.title} के बारे में जानना है`))} target="_blank" rel="noreferrer" onClick={() => x.track("s2-enquire")}>{x.ui("Enquire now", "पूछें")}</a>}</div></div>))}</div></section>}

      {c.about && <section className="s2-sec s2-alt"><div className="s1-wrap s2-story">
        <div className="s2-story-pic"><Pic src={c.about.image ?? pool[1]} ratio="4/5" sizes="(min-width:1024px) 40vw, 100vw" name={c.name} />{c.city && <span className="s2-badge">{x.t(c.city)}</span>}</div>
        <div><p className="s2-ey">{x.ui("Our story", "हमारी कहानी")}</p><h2>{x.t(c.about.title)}</h2>{c.about.paras.slice(0, 3).map((p, i) => <p key={i} className="s2-p">{x.t(p)}</p>)}
          {c.facts.length > 0 && <div className="s2-stats">{c.facts.slice(0, 3).map((f, i) => <div key={i}><b>{x.t(f.value)}</b><span>{x.t(f.label)}</span></div>)}</div>}
          {x.wa && <a className="s2-btn s2-btn-fill" href={bookWa} target="_blank" rel="noreferrer">{x.ui("Book a consultation", "कंसल्टेशन बुक करें")}</a>}</div></div></section>}

      {points.length >= 2 && <section className="s2-sec"><div className="s2-head"><p className="s2-ey">{x.ui("Why us", "हम क्यों")}</p><h2>{x.ui("Crafted With Intention", "दिल से बनाया")}</h2></div>
        <div className="s1-wrap s2-points" data-n={points.length}>{points.map((p, i) => <div key={i}><i>✦</i><h3>{x.t(p.t)}</h3>{p.d && <p>{x.t(p.d)}</p>}</div>)}</div></section>}

      {pool.length >= 3 && <section className="s2-sec s2-alt"><div className="s2-head"><p className="s2-ey">{x.ui("Lookbook", "लुकबुक")}</p><h2>{x.ui("A Glimpse of Our World", "हमारी दुनिया की एक झलक")}</h2></div>
        <div className="s1-wrap s2-look">{pool.slice(0, 6).map((u, i) => <button key={i} type="button" className={`s2-look-i s2-l${i}`} onClick={() => x.zoom(pool, i, c.name)} aria-label={x.ui("View photo", "फ़ोटो देखें")}><Photo src={u} alt="" sizes="(min-width:1024px) 33vw, 50vw" /></button>)}</div>
        {ig && <div className="s1-center"><a className="s2-btn s2-btn-line" href={ig.value.startsWith("http") ? ig.value : `https://instagram.com/${ig.value.replace(/^@/, "")}`} target="_blank" rel="noreferrer">{x.ui("View on Instagram", "Instagram पर देखें")}</a></div>}</section>}

      {revs.length > 0 && <section className="s2-sec"><div className="s2-head"><p className="s2-ey">{x.ui("Client love", "ग्राहकों का प्यार")}</p><h2>{x.ui("What Our Clients Say", "हमारे ग्राहक क्या कहते हैं")}</h2></div>
        <div className="s1-wrap s2-revs">{revs.map((r, i) => <div key={i} className="s2-rev"><span className="s2-stars">{"✦ ".repeat(Math.max(1, Math.round(r.rating || 5))).trim()}</span><p>“{x.t(r.text)}”</p><div className="s2-rev-who"><i>{Array.from(r.name)[0] ?? ""}</i><b>{x.t(r.name)}</b></div></div>)}</div></section>}

      {x.wa && <section className="s2-cta"><div className="s1-wrap s2-cta-in"><div><p className="s2-ey">{x.ui("Your celebration awaits", "आपका जश्न इंतज़ार में है")}</p><h2>{x.ui("Ready to Find Your", "अपना")}<br /><em>{x.ui("Perfect Ensemble?", "परफ़ेक्ट लुक पाइए")}</em></h2></div>
        <a className="s2-btn s2-btn-fill" href={bookWa} target="_blank" rel="noreferrer">{x.ui("Book an appointment", "अपॉइंटमेंट बुक करें")}</a></div></section>}

      {x.wa && <section className="s2-sec" id="s2-contact"><div className="s1-wrap s2-contact">
        <div><p className="s2-ey">{x.ui("Get in touch", "संपर्क करें")}</p><h2>{x.ui("Book Your", "अपना")}<br /><em>{x.ui("Consultation", "कंसल्टेशन बुक करें")}</em></h2>
          <p className="s2-p">{x.ui("Tell us about your celebration and we will reply on WhatsApp.", "अपने जश्न के बारे में बताइए, हम WhatsApp पर जवाब देंगे।")}</p>
          <div className="s2-clist">{x.phone && <a href={s.call}><Icon name="phone" size={18} />{x.phone.value}</a>}{c.visit?.address && <span><Icon name="pin" size={18} />{x.t(c.visit.address)}</span>}</div></div>
        <form className="s2-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label>{x.ui("Your name", "आपका नाम")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>{x.ui("Occasion", "मौका")}<select value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })}><option value="">{x.ui("Select an occasion", "मौका चुनें")}</option>{occ.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label>{x.ui("Event date (approx.)", "तारीख़ (लगभग)")}<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>{x.ui("Tell us more", "और बताइए")}<textarea rows={3} value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} /></label>
          <button type="submit" className="s2-btn s2-btn-fill"><Icon name="whatsapp" size={18} />{x.ui("Send on WhatsApp", "WhatsApp पर भेजें")}</button>
        </form></div></section>}
    </>
  );
}

/* ================= the site ================= */

export function Store1(props: Props) {
  const s = useStore(props);
  const { route, fallback } = props;
  let body: ReactNode = fallback;
  const studio = props.look === "studio";
  if (route.kind === "home") body = studio ? <StudioHome s={s} /> : <Home s={s} />;
  else if (route.kind === "item") body = <Product s={s} it={route.item} />;
  else if (route.entry.role === "catalogue") body = <Collection s={s} entry={route.entry} />;
  else if (route.entry.role === "about") body = <About s={s} entry={route.entry} />;
  else if (route.entry.role === "contact") body = <Contact s={s} entry={route.entry} />;
  return (
    <div className={`${studio ? "s1 s1-studio" : "s1"}${props.corners === "sharp" ? " s1-sharp" : props.corners === "pill" ? " s1-round" : ""}`}
      style={props.tint ? { "--m": `oklch(.36 ${Math.min(props.tint.c, .13)} ${props.tint.h})`, "--m2": `oklch(.45 ${Math.min(props.tint.c, .15)} ${props.tint.h})`, ...(studio ? {} : { "--bl": `oklch(.94 ${Math.min(props.tint.c, .035)} ${props.tint.h})` }) } as React.CSSProperties : undefined}>
      {studio ? <StudioHeader s={s} lang={props.lang} /> : <Header s={s} logo={props.logo} lang={props.lang} />}
      <main id="adv-main" tabIndex={-1} key={route.kind === "item" ? route.item.slug : route.kind === "page" ? route.entry.slug : "home"}>{body}</main>
      {studio ? <StudioFooter s={s} /> : <Footer s={s} />}
      {s.x.wa && <a className="s1-wa-float" href={s.wa()} target="_blank" rel="noreferrer" aria-label="WhatsApp" onClick={() => s.x.track("s1-float")}><Icon name="whatsapp" size={28} /></a>}
    </div>
  );
}

export const STORE1_CSS = `
.s1{--m:#7a1f2e;--m2:#9b2c3e;--g:#c8a04a;--bl:#fbe2da;--ink:#2a2226;--mu:#76696e;--ln:#ece4e1;--rd:#d8443c;--gr:#1f9d55;background:#fff;color:var(--ink);font-family:var(--font-text);font-size:14px;line-height:1.55;overflow-x:clip}
:where(.s1) a{color:inherit;text-decoration:none}
.s1 button{font:inherit;background:none;border:0;cursor:pointer;color:inherit}
.s1-wrap{max-width:1320px;margin:0 auto;padding:0 24px}
.s1-center{text-align:center;margin-top:30px}
.s1-muted{color:var(--mu);font-size:12px}
.s1-pic{position:relative;overflow:hidden;background:linear-gradient(135deg,#f6ece7,#efe1f0 55%,#f7efe2);width:100%}
.s1-pic .adv-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.s1-noimg{position:absolute;inset:0;display:grid;place-items:center;font:500 48px var(--font-display);color:#c9a9b1}
.s1-tick{background:var(--m);color:#fff;font-size:12px;letter-spacing:.06em;overflow:hidden;white-space:nowrap}
.s1-tick-in{display:inline-flex;gap:48px;padding:8px 0;animation:s1tick 40s linear infinite}
.s1-tick-in span:before{content:"✦";margin-right:48px;color:#e2c47a}
@keyframes s1tick{to{transform:translateX(-50%)}}
.s1-hd{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid var(--ln)}
.s1-hd-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:68px;padding:0 24px;max-width:1440px;margin:0 auto}
.s1-hd-l,.s1-hd-r{display:flex;gap:16px;align-items:center}.s1-hd-r{justify-content:flex-end}
.s1-ib{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.12em;font-weight:500}
.s1-wa{color:var(--gr)}
.s1-logo{display:flex;align-items:center;justify-content:center;max-width:46vw;color:var(--m)}
.s1-logo img{max-height:46px;width:auto}
.s1-logo .hero-wordmark b{font:600 26px/1.1 var(--font-display);color:var(--m);text-align:center;display:block}
.s1-nav{display:flex;justify-content:center;flex-wrap:wrap;gap:6px 34px;padding:0 24px 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:500}
.s1-nav a{position:relative;padding:4px 0}.s1-nav a:after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;background:var(--m);transform:scaleX(0);transition:.25s}.s1-nav a:hover:after,.s1-nav a[data-on]:after{transform:scaleX(1)}
.s1-drawer{position:fixed;top:0;left:0;bottom:0;width:300px;max-width:84vw;background:#fff;z-index:70;transform:translateX(-100%);transition:transform .3s;padding:64px 28px;display:flex;flex-direction:column;gap:18px;font-size:14px;letter-spacing:.08em;text-transform:uppercase}
.s1-drawer[data-open]{transform:none}
.s1-drawer-x{position:absolute;top:12px;right:16px;font-size:32px!important}
.s1-drawer-lang{margin-top:auto;text-transform:none}
.s1-scrim{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:60;opacity:0;pointer-events:none;transition:.3s}.s1-scrim[data-open]{opacity:1;pointer-events:auto}
.s1-sec{padding:44px 0}
.s1-st{text-align:center;color:var(--m);font:600 16px var(--font-text);letter-spacing:.14em;text-transform:uppercase;margin-bottom:28px}
.s1-st.l{text-align:left}
.s1-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 28px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;transition:.2s}
.s1-btn-light{background:#fff;color:var(--ink);box-shadow:0 6px 20px rgba(0,0,0,.18)}
.s1-btn-dark,.s1-btn-solid{background:var(--m);color:#fff}.s1-btn-solid:hover{background:var(--m2)}
.s1-btn-ghost{border:1.5px solid var(--m);color:var(--m)}
.s1-btn-outline{border:1.5px solid var(--ink)}
.s1-script{font:italic 500 26px var(--font-display)}
.s1-ey{font-size:12px;letter-spacing:.22em;text-transform:uppercase;opacity:.9}
.s1-hero{position:relative;overflow:hidden}
.s1-hero-track{display:flex;transition:transform .8s cubic-bezier(.6,.05,.3,1)}
.s1-slide{position:relative;flex:0 0 100%}
.s1-slide .s1-pic{min-height:420px}
.s1-slide-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:12px;padding:0 7%;color:#fff;background:linear-gradient(90deg,rgba(40,14,20,.62),rgba(40,14,20,0) 60%)}
.s1-slide-txt.r{align-items:flex-end;text-align:right;background:linear-gradient(270deg,rgba(40,14,20,.62),rgba(40,14,20,0) 60%)}
.s1-h1{font:italic 500 clamp(34px,5vw,72px)/1.05 var(--font-display);max-width:16ch;color:#fff}
.s1-slide-txt p{max-width:34ch;font-size:16px}
.s1-dots{position:absolute;bottom:16px;left:0;right:0;display:flex;justify-content:center;gap:8px}
.s1-dots button{width:28px;height:3px;border-radius:2px;background:rgba(255,255,255,.5)}.s1-dots button[data-on]{background:#fff}
.s1-cats{display:grid;grid-template-columns:repeat(6,1fr);gap:22px}
.s1-cat{text-align:center;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:500}
.s1-arch{border:3px solid var(--g);border-radius:46% 46% 16px 16px / 34% 34% 16px 16px;overflow:hidden;margin-bottom:12px;box-shadow:0 8px 22px rgba(122,31,46,.12);transition:transform .3s}
.s1-cat:hover .s1-arch{transform:translateY(-4px)}
.s1-occ{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;max-width:1020px}
.s1-jh{position:relative;display:block;border:4px solid var(--g);border-radius:50% 50% 10px 10px / 22% 22% 10px 10px;overflow:hidden;box-shadow:0 10px 30px rgba(122,31,46,.15);transition:transform .3s}
.s1-jh:hover{transform:translateY(-6px)}
.s1-jh:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(30,10,14,.6));z-index:1}
.s1-jh b{position:absolute;left:0;right:0;bottom:22px;z-index:2;text-align:center;color:#fff;font-size:clamp(18px,2.4vw,30px);letter-spacing:.2em;font-weight:600;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.s1-marigold{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:110px;height:34px;z-index:3;background:radial-gradient(circle at 20% 60%,#f6a623 12px,transparent 13px),radial-gradient(circle at 50% 40%,#f39c12 15px,transparent 16px),radial-gradient(circle at 80% 60%,#f6a623 12px,transparent 13px)}
.s1-band{position:relative;display:block;border:3px solid var(--g);border-radius:18px;overflow:hidden}
.s1-band-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:10px;padding:0 7%;color:#fff;text-align:right;background:linear-gradient(270deg,rgba(40,14,20,.62),transparent 62%)}
.s1-band-txt.l{align-items:flex-start;text-align:left;background:linear-gradient(90deg,rgba(40,14,20,.62),transparent 62%)}
.s1-band-txt h2{font:500 clamp(28px,4vw,56px)/1.05 var(--font-display);color:#fff;max-width:18ch}
.s1-bud{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:900px}
.s1-budc{border:2px solid var(--g);border-radius:14px;background:linear-gradient(180deg,#fff7f3,#fbe2da);text-align:center;padding:22px 10px;display:flex;flex-direction:column;gap:4px;transition:transform .25s}
.s1-budc:hover{transform:translateY(-4px)}
.s1-budc small{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mu)}
.s1-budc b{font:600 26px var(--font-display);color:var(--m)}
.s1-budc span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:var(--rd)}
.s1-rev{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.s1-revc{border:1px solid var(--ln);border-radius:14px;padding:22px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.05)}
.s1-stars{color:#e0a526;letter-spacing:2px}.s1-revc p{color:#4a4044;margin:10px 0}.s1-revc b{font-size:11px;letter-spacing:.12em}
.s1-grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:2px}.s1-grid5[data-n="6"]{grid-template-columns:repeat(3,1fr)}.s1-grid5[data-n="4"]{grid-template-columns:repeat(4,1fr)}.s1-grid5[data-n="1"],.s1-grid5[data-n="2"],.s1-grid5[data-n="3"]{grid-template-columns:repeat(3,1fr)}
.s1-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.s1-coll .s1-grid4{grid-template-columns:repeat(5,1fr)}
.s1-pc{position:relative;background:#fff}
.s1-pc-media{display:block;position:relative}
.s1-pc-alt{position:absolute;inset:0;opacity:0;transition:opacity .4s}.s1-pc-alt .adv-photo{width:100%;height:100%;object-fit:cover}
.s1-pc:hover .s1-pc-alt{opacity:1}
.s1-tag{position:absolute;left:8px;bottom:8px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:3px;background:linear-gradient(90deg,#d8a53c,#f2cf7a);color:#4a2a00}
.s1-tag-s{left:auto;right:8px;background:rgba(255,255,255,.9);color:var(--mu)}
.s1-heart{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.88)!important;display:grid;place-items:center}
.s1-heart[data-on]{color:var(--rd)!important}.s1-heart[data-on] svg{fill:currentColor}
.s1-pc-body{padding:10px 52px 14px 10px}
.s1-pc-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.4}
.s1-pc-price{margin-top:4px;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;font-size:13px}
.s1-pc-price s{color:var(--mu);font-size:12px}.s1-pc-price b{font-weight:600}
.s1-off{color:var(--rd);font-size:11px;font-weight:700}
.s1-pc-wa{position:absolute;right:10px;bottom:16px;width:36px;height:36px;border-radius:8px;background:var(--gr);color:#fff!important;display:grid;place-items:center}
.s1-about{display:grid;grid-template-columns:1.1fr 1fr;gap:48px;align-items:center}
.s1-about p{color:#4a4044;margin:0 0 12px;font-size:15px}
.s1-about .s1-pic{border:3px solid var(--g);border-radius:20px}
.s1-crumb{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mu);padding-top:18px;flex-wrap:wrap}.s1-crumb span{color:var(--rd)}
.s1-coll{display:block;padding-top:18px;padding-bottom:50px}
.s1-filters{position:sticky;top:130px;align-self:start}
.s1-fl-head{font-size:12px;letter-spacing:.14em;font-weight:600;padding-bottom:12px;border-bottom:1px solid var(--ln)}
.s1-fl{border-bottom:1px solid var(--ln)}
.s1-fl summary{padding:14px 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:500;cursor:pointer}
.s1-fl div{display:flex;flex-direction:column;gap:8px;padding-bottom:14px;font-size:13px}.s1-fl input{accent-color:var(--m);margin-right:6px}
.s1-coll-h{font:500 34px var(--font-display);color:var(--m)}
.s1-coll-intro{color:var(--mu);margin:6px 0 16px;max-width:80ch}
.s1-chips{display:flex;flex-wrap:wrap;gap:8px}
.s1-chips button{border:1px solid var(--m)!important;color:var(--m)!important;border-radius:999px;padding:5px 14px!important;font-size:12px}
.s1-chips button[data-on]{background:var(--m)!important;color:#fff!important}
.s1-coll-bar{display:flex;justify-content:space-between;align-items:center;margin:18px 0;font-size:12px;color:var(--mu)}
.s1-coll-bar select{border:1px solid var(--ln);border-radius:6px;padding:8px 12px;font:inherit;color:var(--ink);background:#fff}
.s1-pdp{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:40px;padding-top:16px;padding-bottom:40px}
.s1-gal{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-self:start}.s1-gal[data-n="1"]{grid-template-columns:1fr}
.s1-gal-i{display:block;cursor:zoom-in;padding:0!important}
.s1-info{position:sticky;top:130px;align-self:start}
.s1-info h1{font:500 24px/1.35 var(--font-text)}
.s1-price{display:flex;align-items:baseline;gap:10px;margin-top:12px}.s1-price small,.s1-price s{color:var(--mu)}.s1-price b{font-size:26px;font-weight:600}
.s1-btns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}
.s1-trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;font-size:12px;color:#2e8b57;font-weight:500}
.s1-acc{border-bottom:1px solid var(--ln)}
.s1-info .s1-acc:first-of-type{margin-top:24px;border-top:1px solid var(--ln)}
.s1-acc summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:15px 0;cursor:pointer;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
.s1-acc summary::-webkit-details-marker{display:none}.s1-acc summary svg{transition:transform .2s}.s1-acc[open] summary svg{transform:rotate(45deg)}
.s1-acc div{padding-bottom:16px;font-size:13px;color:#4a4044}.s1-acc p{margin:0 0 8px}.s1-acc ul{padding-left:18px;margin:0 0 8px}
.s1-spec{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.s1-spec span{font-size:12px;color:var(--mu)}.s1-spec b{display:block;color:var(--ink);font-weight:500;font-size:13px}
.s1-note{font-size:11px;font-style:italic;color:var(--mu)}
.s1-pagehero{position:relative}
.s1-pagehero-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;background:rgba(40,14,20,.45);text-align:center;padding:0 20px}
.s1-pagehero-txt h1{font:500 clamp(28px,4.4vw,56px) var(--font-display);color:#fff}
.s1-facts{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.s1-facts div{border:2px solid var(--g);border-radius:14px;padding:18px;background:#fff9f6}.s1-facts b{display:block;color:var(--m);font:600 22px var(--font-display)}.s1-facts span{font-size:12px;color:var(--mu)}
.s1-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.s1-steps div{text-align:center;padding:22px;border:1px solid var(--ln);border-radius:14px}
.s1-steps i{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 10px;border-radius:50%;background:var(--m);color:#fff;font-style:normal;font-weight:600}
.s1-steps b{display:block}.s1-steps span{font-size:12px;color:var(--mu)}
.s1-faq{max-width:820px}
.s1-contact{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.s1-contact .s1-pic{border:3px solid var(--g);border-radius:20px}
.s1-clist{display:flex;flex-direction:column;gap:12px;margin:20px 0}
.s1-clist a{display:flex;align-items:center;gap:14px;border:1px solid var(--ln);border-radius:12px;padding:14px 16px}
.s1-clist svg{color:var(--m)}.s1-clist b{display:block;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.s1-hours{width:100%;border-collapse:collapse;margin-bottom:22px;font-size:13px}.s1-hours td{padding:10px 0;border-bottom:1px solid var(--ln)}.s1-hours td:last-child{text-align:right;font-weight:600}
.s1-ft{background:var(--bl);padding:48px 0 26px;margin-top:20px}
.s1-ft-cols{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:40px}
.s1-ft h4{font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px;font-weight:600}
.s1-ft-cols>div>a:not(.s1-btn){display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:4px 0;color:#4a4044}
.s1-ft-cols p{font-size:13px;color:#4a4044;margin:0 0 12px}
.s1-ft-line{display:flex;gap:8px;align-items:flex-start}
.s1-ft-pop{border-top:1px solid #f0c9bd;margin-top:30px;padding-top:22px}
.s1-ft-pop h5{font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}.s1-ft-pop p{font-size:12px;color:#4a4044;line-height:2}.s1-ft-pop a{text-decoration:underline}
.s1-ft-bottom{text-align:center;font-size:11px;color:var(--mu);margin-top:22px}
.s1-wa-float{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:var(--gr);color:#fff!important;display:grid;place-items:center;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:45}
@media (max-width:1024px){.s1-nav{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;scrollbar-width:none;gap:24px;padding:0 16px 10px}.s1-nav::-webkit-scrollbar{display:none}.s1-nav a{white-space:nowrap}.s1-coll .s1-grid4{grid-template-columns:repeat(3,1fr)}.s1-cats{grid-template-columns:repeat(3,1fr)}.s1-grid4{grid-template-columns:repeat(3,1fr)}.s1-grid5{grid-template-columns:repeat(2,1fr)}.s1-grid5[data-n="6"]{grid-template-columns:repeat(3,1fr)}.s1-coll{grid-template-columns:minmax(0,1fr)}.s1-filters{display:none}.s1-rev{grid-template-columns:1fr 1fr}}
@media (max-width:720px){
 .s1-wrap{padding:0 14px}.s1-hd-row{padding:0 12px;height:58px}.s1-hide-sm{display:none}.s1-ib span{display:none}.s1-logo .hero-wordmark b{font-size:20px}
 .s1-sec{padding:30px 0}.s1-slide .s1-pic{min-height:0;aspect-ratio:4/5!important}
 .s1-slide-txt,.s1-slide-txt.r{align-items:flex-start;text-align:left;justify-content:flex-end;padding:0 18px 54px;background:linear-gradient(0deg,rgba(40,14,20,.78),transparent 62%)}
 .s1-cats{display:flex;overflow-x:auto;gap:14px;scroll-snap-type:x mandatory}.s1-cat{flex:0 0 31%;scroll-snap-align:start;font-size:10px}
 .s1-occ{grid-template-columns:repeat(2,1fr);gap:14px}.s1-marigold{transform:translateX(-50%) scale(.7)}
 .s1-band .s1-pic{aspect-ratio:4/3!important}.s1-band-txt,.s1-band-txt.l{align-items:flex-start;text-align:left;justify-content:flex-end;padding:22px;background:linear-gradient(0deg,rgba(40,14,20,.72),transparent 66%)}
 .s1-bud{grid-template-columns:repeat(2,1fr);gap:10px}.s1-budc b{font-size:20px}
 .s1-rev{grid-template-columns:1fr}
 .s1-grid5,.s1-grid5[data-n],.s1-grid4,.s1-coll .s1-grid4{grid-template-columns:repeat(2,1fr);gap:8px}
 .s1-pdp,.s1-about,.s1-contact{grid-template-columns:minmax(0,1fr);gap:22px}.s1-gal{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.s1-gal-i{flex:0 0 86%;scroll-snap-align:start}.s1-info{position:relative;top:0}
 .s1-btns{grid-template-columns:1fr}.s1-steps{grid-template-columns:repeat(2,1fr)}.s1-ft-cols{grid-template-columns:1fr;gap:26px}
}
/* ---- Design 2: the studio (ivory, sage, quiet serif). It was a black page; the owner, 18 Nov 2026: "completely black si dikh rahi hai" -
   so the page is ivory paper now, the sage kept; only the photograph's veil and the footer are deep green. --on is the text on a sage
   button, --bl the outline of a line button; the hero, the page hero and the footer re-set the inks for their dark ground. ---- */
.s1-sharp :is(.s1-btn,.s1-arch,.s1-jh,.s1-band,.s1-budc,.s1-revc,.s1-about .s1-pic,.s1-contact .s1-pic,.s1-chips button,.s1-facts div,.s1-steps div,.s1-clist a,.s1-pc-wa,.s1-coll-bar select,.s2-btn,.s2-form input,.s2-form select,.s2-form textarea){border-radius:0!important}
.s1-round :is(.s1-btn,.s1-pc-wa,.s2-btn,.s1-coll-bar select,.s2-form input,.s2-form select){border-radius:999px!important}
.s1-round :is(.s1-band,.s1-budc,.s1-revc,.s1-facts div,.s1-steps div,.s1-clist a,.s1-about .s1-pic,.s1-contact .s1-pic,.s2-form textarea){border-radius:28px!important}
.s1-studio{--bg:#f8f6f0;--bg2:#efece2;--ink:#1f2a22;--mu:#5b655d;--ln:rgba(31,42,34,.14);--m:#4a6e54;--m2:#3c5c45;--g:rgba(74,110,84,.4);--rd:#b4483c;--gr:#2f8a52;--on:#fff;--bl:rgba(31,42,34,.45);background:var(--bg);color:var(--ink);font-weight:300}
.s1-studio .s1-pic{background:linear-gradient(135deg,#e8e5da,#dedbd0)}
.s1-studio .s1-noimg{color:#a9ad9f}
.s2-ey{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--m);font-weight:500}
.s1-studio h1,.s1-studio h2,.s1-studio h3{font-family:var(--font-display);font-weight:400;color:var(--ink)}
.s1-studio em{font-style:italic;color:var(--m)}
.s2-lede{color:var(--mu);font-size:15px;max-width:52ch;line-height:1.8}
.s2-p{color:var(--mu);font-size:15px;line-height:1.85;margin:0 0 14px}
.s2-muted{color:var(--mu);font-size:13px;margin:6px 0}
.s2-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 26px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:500;border-radius:2px;transition:.25s;white-space:nowrap}
.s2-btn-fill{background:var(--m);color:var(--on)!important}.s2-btn-fill:hover{background:var(--m2)}
.s2-btn-line{border:1px solid var(--bl);color:var(--ink)}.s2-btn-line:hover{border-color:var(--m);color:var(--m)}
.s2-hd{position:sticky;top:0;z-index:40;background:rgba(248,246,240,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--ln)}
.s2-hd-row{display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:1320px;margin:0 auto;padding:14px 24px}
.s2-name{font:400 24px var(--font-display);letter-spacing:.04em;color:var(--ink)}
.s2-nav{display:flex;gap:28px;font-size:11px;letter-spacing:.2em;text-transform:uppercase}
.s2-nav a{color:var(--mu);padding:4px 0;border-bottom:1px solid transparent}.s2-nav a:hover,.s2-nav a[data-on]{color:var(--ink);border-color:var(--m)}
.s2-hd-r{display:flex;align-items:center;gap:14px}
.s2-lang{color:var(--mu)}
.s2-hero{position:relative;overflow:hidden}
.s2-hero .s1-pic{min-height:min(92svh,860px)}
.s2-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(22,34,26,.3),rgba(22,34,26,.55) 70%,rgba(22,34,26,.72))}
.s2-hero-frame{position:absolute;inset:28px;border:1px solid rgba(232,228,220,.18);z-index:1;pointer-events:none}
.s2-hero-txt,.s1-studio .s1-pagehero-txt{--ink:#f8f6f0;--mu:rgba(248,246,240,.86);--m:#c3dcbf;--m2:#d5e8d2;--on:#16221a;--bl:rgba(248,246,240,.6)}
.s2-hero-txt{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:center;gap:18px;max-width:1080px;margin:0 auto;padding:0 8%}
.s2-hero-txt h1{font-size:clamp(44px,7vw,96px);line-height:1.02;letter-spacing:-.01em}
.s2-btns{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px}
.s2-marq{border-block:1px solid var(--ln);overflow:hidden;white-space:nowrap;background:var(--bg)}
.s2-marq-in{display:inline-flex;gap:40px;padding:16px 0;animation:s1tick 45s linear infinite}
.s2-marq-in span{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--ink)}
.s2-marq-in span:after{content:"✦";margin-left:40px;color:var(--m)}
.s2-sec{padding:96px 0}
.s2-alt{background:var(--bg2)}
.s2-head{text-align:center;max-width:720px;margin:0 auto 54px;padding:0 20px}
.s2-head .s2-ey:after{content:"";display:block;width:40px;height:1px;background:var(--m);margin:16px auto 0;opacity:.6}
.s2-head h2{font-size:clamp(32px,4.2vw,52px);margin-top:18px;line-height:1.1}
.s2-head .s2-lede{margin:14px auto 0}
.s2-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}.s2-cols[data-n="2"]{grid-template-columns:repeat(2,1fr)}.s2-cols[data-n="1"]{grid-template-columns:1fr;max-width:520px}
.s2-col{background:var(--bg2);border:1px solid var(--ln)}
.s2-col .s1-pic .adv-photo{transition:transform 1.2s}.s2-col:hover .s1-pic .adv-photo{transform:scale(1.04)}
.s2-col-txt{padding:26px 26px 30px;display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.s2-col-txt h3{font-size:26px}.s2-col-txt p{color:var(--mu);font-size:14px;line-height:1.75;margin:0}
.s2-story{display:grid;grid-template-columns:1fr 1.1fr;gap:72px;align-items:center}
.s2-story h2{font-size:clamp(32px,4vw,48px);margin:16px 0 22px;line-height:1.1}
.s2-story-pic{position:relative}
.s2-badge{position:absolute;right:-18px;bottom:28px;background:var(--m);color:var(--on);font:400 20px var(--font-display);padding:14px 22px}
.s2-stats{display:flex;gap:0;margin:26px 0 28px;border-top:1px solid var(--ln);border-bottom:1px solid var(--ln)}
.s2-stats div{flex:1;text-align:center;padding:18px 8px}.s2-stats div+div{border-left:1px solid var(--ln)}
.s2-stats b{display:block;font:400 30px var(--font-display);color:var(--m)}.s2-stats span{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mu)}
.s2-points{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--ln)}.s2-points[data-n="3"]{grid-template-columns:repeat(3,1fr)}.s2-points[data-n="2"]{grid-template-columns:repeat(2,1fr)}
.s2-points div{padding:34px 26px}.s2-points div+div{border-left:1px solid var(--ln)}
.s2-points i{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--g);border-radius:50%;color:var(--m);font-style:normal;margin-bottom:18px}
.s2-points h3{font-size:22px;margin-bottom:8px}.s2-points p{color:var(--mu);font-size:14px;line-height:1.75;margin:0}
.s2-look{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:240px;gap:4px}
.s2-look-i{position:relative;overflow:hidden;padding:0!important;cursor:zoom-in}
.s2-look-i .adv-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1s}.s2-look-i:hover .adv-photo{transform:scale(1.05)}
.s2-l0{grid-row:span 2}.s2-l1{grid-column:span 2}.s2-l4{grid-column:span 2}
.s2-revs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.s2-rev{background:var(--bg2);border:1px solid var(--ln);padding:30px}
.s2-stars{color:var(--m);font-size:11px;letter-spacing:.2em}
.s2-rev p{font:italic 400 18px/1.7 var(--font-display);color:var(--ink);margin:16px 0 22px}
.s2-rev-who{display:flex;align-items:center;gap:12px;border-top:1px solid var(--ln);padding-top:16px}
.s2-rev-who i{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:rgba(143,174,139,.25);color:var(--m);font-style:normal}
.s2-rev-who b{font-weight:500;font-size:14px}
.s2-cta{background:linear-gradient(90deg,#e3eadd,#edf0e6);border-block:1px solid var(--ln);padding:72px 0}
.s2-cta-in{display:flex;align-items:center;justify-content:space-between;gap:30px;flex-wrap:wrap}
.s2-cta h2{font-size:clamp(30px,3.6vw,46px);line-height:1.15;margin-top:12px}
.s2-contact{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:start}
.s2-contact h2{font-size:clamp(32px,4vw,52px);line-height:1.1;margin:14px 0 18px}
.s2-clist{display:flex;flex-direction:column;gap:14px;margin-top:22px;color:var(--mu);font-size:14px}.s2-clist a,.s2-clist span{display:flex;gap:12px;align-items:center}.s2-clist svg{color:var(--m)}
.s2-form{background:var(--bg2);border:1px solid var(--ln);padding:32px;display:grid;gap:16px}
.s2-form label{display:grid;gap:8px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mu)}
.s2-form input,.s2-form select,.s2-form textarea{background:#fff;border:1px solid var(--ln);color:var(--ink);font:inherit;font-size:14px;letter-spacing:0;text-transform:none;padding:12px;border-radius:2px;outline:none;color-scheme:light}
.s2-form input:focus,.s2-form select:focus,.s2-form textarea:focus{border-color:var(--m)}
.s2-form .s2-btn{width:100%;margin-top:6px}
/* The form's button is a <button>: the site's button reset cleared its fill, so the label had no ground to stand on. */
.s1-studio .s2-form button.s2-btn-fill{background:var(--m);color:var(--on)!important}.s1-studio .s2-form button.s2-btn-fill:hover{background:var(--m2)}
.s2-ft{--ink:#f1efe8;--mu:rgba(241,239,232,.72);--m:#c3dcbf;--ln:rgba(255,255,255,.14);color:var(--ink);background:#22352a;border-top:1px solid var(--ln);padding:64px 0 24px}
.s2-ft-cols{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:40px}
.s2-ft h4{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--m);font-weight:500;margin-bottom:16px}
.s2-ft-cols>div>a{display:block;color:var(--mu);font-size:13px;padding:5px 0}.s2-ft-cols>div>a:hover{color:var(--ink)}
.s2-ft-bottom{display:flex;justify-content:space-between;border-top:1px solid var(--ln);margin-top:40px;padding-top:20px;font-size:12px;color:var(--mu)}
/* the shared inner pages in the studio's colours */
.s1-studio .s1-crumb span{color:var(--m)}
.s1-studio .s1-coll-h{color:var(--ink);font-weight:400}
.s1-studio .s1-chips button{border-color:var(--g)!important;color:var(--ink)!important;border-radius:2px}
.s1-studio .s1-chips button[data-on]{background:var(--m)!important;color:var(--on)!important}
.s1-studio .s1-coll-bar select{background:var(--bg2);color:var(--ink);border-color:var(--ln)}
.s1-studio .s1-pc{background:transparent}
.s1-studio .s1-pc-name{color:var(--ink)}
.s1-studio .s1-heart{background:rgba(255,255,255,.88)!important;color:var(--ink)}
.s1-studio .s1-tag{background:var(--m);color:var(--on)}
.s1-studio .s1-tag-s{background:rgba(255,255,255,.9);color:var(--mu)}
.s1-studio .s1-pc-wa{background:transparent;border:1px solid var(--g);color:var(--m)!important}
.s1-studio .s1-st{color:var(--m);font-weight:500;letter-spacing:.28em;font-size:12px}
.s1-studio .s1-info h1{font:400 32px/1.2 var(--font-display)}
.s1-studio .s1-btn{border-radius:2px;font-size:11px;letter-spacing:.2em}
.s1-studio .s1-btn-solid{background:var(--m);color:var(--on)}.s1-studio .s1-btn-solid:hover{background:var(--m2)}
.s1-studio .s1-btn-ghost{border-color:var(--bl);color:var(--ink)}
.s1-studio .s1-btn-outline{border-color:var(--bl)}
.s1-studio .s1-acc div,.s1-studio .s1-about p{color:var(--mu)}
.s1-studio .s1-spec b{color:var(--ink)}
.s1-studio .s1-trust{color:var(--m)}
.s1-studio .s1-pagehero-txt{background:rgba(22,34,26,.5)}
.s1-studio .s1-facts div{background:var(--bg2);border-color:var(--g)}.s1-studio .s1-facts b{color:var(--m)}
.s1-studio .s1-steps div{border-color:var(--ln)}.s1-studio .s1-steps i{background:var(--m);color:var(--on)}
.s1-studio .s1-clist a{border-color:var(--ln)}.s1-studio .s1-clist svg{color:var(--m)}
.s1-studio .s1-about .s1-pic,.s1-studio .s1-contact .s1-pic{border-color:var(--g);border-radius:2px}
.s1-studio .s1-hours td{border-color:var(--ln)}
.s1-studio .s1-wa-float{background:var(--m);color:var(--on)!important}
@media (max-width:1024px){.s2-nav{display:none}.s2-points,.s2-points[data-n="3"]{grid-template-columns:repeat(2,1fr)}.s2-points div:nth-child(3){border-left:0}.s2-points div:nth-child(n+3){border-top:1px solid var(--ln)}
 .s2-hd{display:block}.s2-hd + main{scroll-margin-top:0}}
@media (max-width:1024px){.s2-hd-row{flex-wrap:wrap}.s2-hd-row .s2-nav{display:flex;order:3;width:100%;overflow-x:auto;scrollbar-width:none;gap:22px}.s2-nav::-webkit-scrollbar{display:none}.s2-nav a{white-space:nowrap}}
@media (max-width:720px){
 .s2-hd-row{padding:10px 14px;gap:10px}.s2-name{font-size:20px}.s2-lang{display:none}.s2-hd-r .s2-btn{min-height:38px;padding:0 14px;font-size:10px;letter-spacing:.14em}
 .s2-hero .s1-pic{min-height:0;aspect-ratio:3/4!important}.s2-hero-frame{inset:14px}.s2-hero-txt{justify-content:flex-end;padding:0 26px 46px}.s2-btns .s2-btn{flex:1 1 auto}
 .s2-sec{padding:64px 0}.s2-cols,.s2-cols[data-n="2"]{grid-template-columns:1fr}.s2-story,.s2-contact{grid-template-columns:1fr;gap:34px}.s2-badge{right:10px}
 .s2-points,.s2-points[data-n="3"],.s2-points[data-n="2"]{grid-template-columns:1fr}.s2-points div+div{border-left:0;border-top:1px solid var(--ln)}
 .s2-look{grid-template-columns:repeat(2,1fr);grid-auto-rows:180px}.s2-l0{grid-row:auto}.s2-l0,.s2-l1,.s2-l4,.s2-l5{grid-column:span 2}
 .s2-revs{grid-template-columns:1fr}.s2-ft-cols{grid-template-columns:1fr;gap:28px}.s2-ft-bottom{flex-direction:column;gap:6px}
}
`;
