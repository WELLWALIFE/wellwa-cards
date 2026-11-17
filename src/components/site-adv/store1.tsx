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

type Props = { card: Card; c: SiteContent; x: AdvCtxPlus; items: AdvItem[]; route: AdvRoute; open: (slug: string) => void; logo: ReactNode; lang: ReactNode; fallback: ReactNode };

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
  const shop = products.length ? products : items;
  const wa = (text?: string) => x.waHref(text);
  const call = x.phone ? linkHref(x.phone.type, x.phone.value) : "";
  return { card, c, x, cat, about, contact, go, shop, wa, call };
}
type S = ReturnType<typeof useStore>;

/* ================= the shell: ticker, header, drawer, footer, floating WhatsApp ================= */

function Header({ s, logo, lang }: { s: S; logo: ReactNode; lang: ReactNode }) {
  const { c, x, go } = s;
  const [menu, setMenu] = useState(false);
  const tick = [...(c.offer ? [c.offer.title || c.offer.text] : []), ...c.highlights, `${x.t(c.trade)}${c.city ? ` · ${x.t(c.city)}` : ""}`, ...(x.wa ? [x.ui("Order on WhatsApp", "WhatsApp पर ऑर्डर करें")] : [])].filter(Boolean).slice(0, 5);
  const nav = x.pages.list.filter((e) => e.role !== "home");
  const link = (e: AdvPageEntry) => <a key={e.slug} href={e.href} onClick={(ev) => { setMenu(false); go(e.slug)(ev); }} data-on={x.pages.active === e.slug ? "" : undefined}>{e.owner ? x.t(e.label) : e.label}</a>;
  return (
    <>
      {tick.length > 0 && <div className="s1-tick" aria-hidden="true"><div className="s1-tick-in">{[...tick, ...tick].map((t, i) => <span key={i}>{x.t(t)}</span>)}</div></div>}
      <header className="s1-hd">
        <div className="s1-hd-row">
          <div className="s1-hd-l"><button type="button" className="s1-ib" onClick={() => setMenu(true)} aria-label={x.ui("Menu", "मेनू")}><Icon name="menu" size={20} /><span>{x.ui("MENU", "मेनू")}</span></button><span className="s1-hide-sm">{lang}</span></div>
          <a className="s1-logo" href={x.hrefFor(x.pages.home)} onClick={go(x.pages.home)}>{logo}</a>
          <div className="s1-hd-r">
            {s.call && <a className="s1-ib s1-hide-sm" href={s.call} aria-label={x.ui("Call", "कॉल")} onClick={() => x.track("s1-call")}><Icon name="phone" size={20} /></a>}
            {x.wa && <a className="s1-ib s1-wa" href={s.wa()} target="_blank" rel="noreferrer" aria-label="WhatsApp" onClick={() => x.track("s1-wa")}><Icon name="whatsapp" size={21} /></a>}
          </div>
        </div>
        <nav className="s1-nav">{nav.map(link)}</nav>
      </header>
      <div className="s1-drawer" data-open={menu ? "" : undefined}>
        <button type="button" className="s1-drawer-x" onClick={() => setMenu(false)} aria-label={x.ui("Close", "बंद करें")}>×</button>
        <a href={x.hrefFor(x.pages.home)} onClick={(ev) => { setMenu(false); go(x.pages.home)(ev); }}>{x.ui("Home", "होम")}</a>
        {nav.map(link)}
        <div className="s1-drawer-lang">{lang}</div>
      </div>
      <div className="s1-scrim" data-open={menu ? "" : undefined} onClick={() => setMenu(false)} />
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
        {it.item.sample && <span className="s1-tag s1-tag-s">{x.ui("Sample", "नमूना")}</span>}
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

      {shop.length > 0 && <section className="s1-sec"><h2 className="s1-st">{x.ui("Bestsellers", "सबसे ज़्यादा पसंद")}</h2><div className="s1-grid5">{shop.slice(0, 10).map((it, i) => <Card1 key={it.slug} s={s} it={it} eager={i < 5} />)}</div>
        {s.cat && shop.length > 10 && <div className="s1-center"><a className="s1-btn s1-btn-outline" href={catHref} onClick={toCat}>{x.ui("View all", "सभी देखें")}</a></div>}</section>}

      {c.about && <section className="s1-sec"><div className="s1-wrap s1-about"><div><h2 className="s1-st l">{x.t(c.about.title)}</h2>{c.about.paras.slice(0, 2).map((p, i) => <p key={i}>{x.t(p)}</p>)}
        {s.about && <a className="s1-btn s1-btn-outline" href={s.about.href} onClick={go(s.about.slug)}>{x.ui("Our story", "हमारी कहानी")}</a>}</div>
        <Pic src={c.about.image ?? pool[2]} ratio="4/3" sizes="50vw" name={c.name} /></div></section>}
    </>
  );
}
/* ================= COLLECTION ================= */

function Collection({ s, entry }: { s: S; entry: AdvPageEntry }) {
  const { c, x, go } = s;
  const all = s.shop.filter((i) => i.page === entry.slug).length ? s.shop.filter((i) => i.page === entry.slug) : s.shop;
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
        <aside className="s1-filters">
          <div className="s1-fl-head">{x.ui("FILTER", "फ़िल्टर")}</div>
          {cats.length > 1 && <details className="s1-fl" open><summary>{x.ui("Category", "कैटेगरी")}</summary><div>
            <label><input type="radio" name="s1cat" checked={!catSel} onChange={() => setCat("")} /> {x.ui("All", "सभी")}</label>
            {cats.map((k) => <label key={k}><input type="radio" name="s1cat" checked={catSel === k} onChange={() => setCat(k)} /> {x.t(k)}</label>)}</div></details>}
          {bands.length > 1 && <details className="s1-fl" open><summary>{x.ui("Price", "दाम")}</summary><div>
            <label><input type="radio" name="s1p" checked={!under} onChange={() => setUnder(0)} /> {x.ui("Any price", "कोई भी दाम")}</label>
            {bands.map((b) => <label key={b}><input type="radio" name="s1p" checked={under === b} onChange={() => setUnder(b)} /> {x.ui("Under", "तक")} {inr(b)}</label>)}</div></details>}
        </aside>
        <div className="s1-coll-main">
          <h1 className="s1-coll-h">{title}</h1>
          <p className="s1-coll-intro">{x.t(c.hm.sub)}</p>
          {cats.length > 1 && <div className="s1-chips"><button type="button" data-on={!catSel ? "" : undefined} onClick={() => setCat("")}>{x.ui("All", "सभी")}</button>{cats.map((k) => <button type="button" key={k} data-on={catSel === k ? "" : undefined} onClick={() => setCat(k)}>{x.t(k)}</button>)}</div>}
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

/* ================= the site ================= */

export function Store1(props: Props) {
  const s = useStore(props);
  const { route, fallback } = props;
  let body: ReactNode = fallback;
  if (route.kind === "home") body = <Home s={s} />;
  else if (route.kind === "item") body = <Product s={s} it={route.item} />;
  else if (route.entry.role === "catalogue") body = <Collection s={s} entry={route.entry} />;
  else if (route.entry.role === "about") body = <About s={s} entry={route.entry} />;
  else if (route.entry.role === "contact") body = <Contact s={s} entry={route.entry} />;
  return (
    <div className="s1">
      <Header s={s} logo={props.logo} lang={props.lang} />
      <main id="adv-main" tabIndex={-1} key={route.kind === "item" ? route.item.slug : route.kind === "page" ? route.entry.slug : "home"}>{body}</main>
      <Footer s={s} />
      {s.x.wa && <a className="s1-wa-float" href={s.wa()} target="_blank" rel="noreferrer" aria-label="WhatsApp" onClick={() => s.x.track("s1-float")}><Icon name="whatsapp" size={28} /></a>}
    </div>
  );
}

export const STORE1_CSS = `
.s1{--m:#7a1f2e;--m2:#9b2c3e;--g:#c8a04a;--bl:#fbe2da;--ink:#2a2226;--mu:#76696e;--ln:#ece4e1;--rd:#d8443c;--gr:#1f9d55;background:#fff;color:var(--ink);font-family:var(--font-text);font-size:14px;line-height:1.55;overflow-x:clip}
.s1 a{color:inherit;text-decoration:none}
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
.s1-grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:2px}
.s1-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
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
.s1-coll{display:grid;grid-template-columns:230px minmax(0,1fr);gap:34px;padding-top:18px;padding-bottom:50px}
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
@media (max-width:1024px){.s1-nav{display:none}.s1-cats{grid-template-columns:repeat(3,1fr)}.s1-grid5,.s1-grid4{grid-template-columns:repeat(3,1fr)}.s1-coll{grid-template-columns:minmax(0,1fr)}.s1-filters{display:none}.s1-rev{grid-template-columns:1fr 1fr}}
@media (max-width:720px){
 .s1-wrap{padding:0 14px}.s1-hd-row{padding:0 12px;height:58px}.s1-hide-sm{display:none}.s1-ib span{display:none}.s1-logo .hero-wordmark b{font-size:20px}
 .s1-sec{padding:30px 0}.s1-slide .s1-pic{min-height:0;aspect-ratio:4/5!important}
 .s1-slide-txt,.s1-slide-txt.r{align-items:flex-start;text-align:left;justify-content:flex-end;padding:0 18px 54px;background:linear-gradient(0deg,rgba(40,14,20,.78),transparent 62%)}
 .s1-cats{display:flex;overflow-x:auto;gap:14px;scroll-snap-type:x mandatory}.s1-cat{flex:0 0 31%;scroll-snap-align:start;font-size:10px}
 .s1-occ{grid-template-columns:repeat(2,1fr);gap:14px}.s1-marigold{transform:translateX(-50%) scale(.7)}
 .s1-band .s1-pic{aspect-ratio:4/3!important}.s1-band-txt,.s1-band-txt.l{align-items:flex-start;text-align:left;justify-content:flex-end;padding:22px;background:linear-gradient(0deg,rgba(40,14,20,.72),transparent 66%)}
 .s1-bud{grid-template-columns:repeat(2,1fr);gap:10px}.s1-budc b{font-size:20px}
 .s1-rev{grid-template-columns:1fr}
 .s1-grid5,.s1-grid4{grid-template-columns:repeat(2,1fr);gap:8px}
 .s1-pdp,.s1-about,.s1-contact{grid-template-columns:minmax(0,1fr);gap:22px}.s1-gal{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.s1-gal-i{flex:0 0 86%;scroll-snap-align:start}.s1-info{position:relative;top:0}
 .s1-btns{grid-template-columns:1fr}.s1-steps{grid-template-columns:repeat(2,1fr)}.s1-ft-cols{grid-template-columns:1fr;gap:26px}
}
`;
