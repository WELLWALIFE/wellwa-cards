"use client";
// The catalogue page (every product / service / menu item of one page of the card, with a search box, category chips and a
// sort) and an item's own page (gallery, price, description, benefits, specs, enquiry, share, related items). Both are drawn from
// advancedItems() (src/lib/site-advanced.ts), so a service has a page like a product has.
import { useMemo, useState } from "react";
import type { AdvItem } from "@/lib/site-advanced";
import { catalogLabel, recipeFor } from "@/lib/site-recipes";
import { linkHref } from "@/components/link-icon";
import { Icon } from "@/components/site-icons";
import { Photo, Sec, type SiteContent } from "@/components/site-adv/shared";
import type { AdvCtxPlus, AdvPageEntry, Chrome } from "@/components/site-adv/nav";
import { Crumbs } from "@/components/site-adv/nav";
import { Cover, ItemCard, Masthead, SearchBox, ShareBtn, ZoomPhoto, askText, enquireLabel, layoutFor, photosOf, priceOf } from "@/components/site-adv/page-parts";
import type { AdvancedSpec } from "@/lib/site-advanced";

type PageProps = { c: SiteContent; spec: AdvancedSpec; x: AdvCtxPlus; chrome: Chrome };

/** "₹499 – ₹72,500" from the items that carry a number, else "". */
function priceRange(items: AdvItem[]): string {
  const nums = items.map((i) => priceOf(i.item)).filter((p) => p.num).sort((a, b) => a.num! - b.num!);
  if (nums.length < 2) return "";
  const a = nums[0].price, b = nums[nums.length - 1].price;
  return a === b ? "" : `${a} – ${b}`;
}

/* ================= the catalogue ================= */

export function CataloguePage({ c, spec, x, chrome, entry, items }: PageProps & { entry: AdvPageEntry; items: AdvItem[] }) {
  const mine = items.filter((i) => i.page === entry.slug);
  const products = mine.filter((i) => i.kind === "product");
  const services = mine.filter((i) => i.kind === "service");
  // What the page lists first: the products; a page of services only has the services as its main list.
  const main = products.length ? products : services;
  const extra = products.length ? services : [];
  const cat = recipeFor(x.card.seo?.categoryKey ?? "");
  const label = catalogLabel(cat.catalog, x.hi ? "hi" : "en");
  // "8 menu" / "14 collection" is not English: a count needs a plural noun (16 Oct 2026 QA).
  const word = /^(menu|catalogue|catalog|collection|मेन्यू|कलेक्शन|कैटलॉग)$/i.test(label.trim()) ? x.ui("items", "आइटम") : label;

  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [sort, setSort] = useState<"" | "low" | "high">("");
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of main) { const k = (i.item.category ?? "").trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()];
  }, [main]);
  const priced = main.filter((i) => priceOf(i.item).num).length;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = main.filter((i) => (!pick || (i.item.category ?? "").trim() === pick) && (!needle || `${i.item.name} ${i.item.desc ?? ""} ${i.item.category ?? ""}`.toLowerCase().includes(needle)));
    if (sort) list = [...list].sort((a, b) => ((priceOf(a.item).num ?? 1e12) - (priceOf(b.item).num ?? 1e12)) * (sort === "low" ? 1 : -1));
    return list;
  }, [main, q, pick, sort]);
  const layout = layoutFor(spec, main);
  const range = priceRange(main);
  const lead = main.map((i) => photosOf(i.item)[0]).find(Boolean) ?? c.hm.photo?.src ?? c.photos[0];
  const filtering = !!(q.trim() || pick);

  return (
    <>
      <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)} image={lead}
        trail={[{ label: x.t(entry.label) }]}
        lede={x.hi ? `${main.length} ${word}${range ? ` · ${range}` : ""}` : `${main.length} ${word.toLowerCase()}${range ? ` · ${range}` : ""}`}
        aside={x.wa ? <a className="btn-primary" href={x.waHref()} target="_blank" rel="noreferrer" onClick={() => x.track("cat-enquire")}><Icon name="whatsapp" /> {enquireLabel(x, {}, x.card.seo?.categoryKey)}</a> : undefined} />
      <section className="cg" aria-label={x.t(entry.label)}>
        <div className="adv-wrap adv-wide">
          {(main.length >= 6 || cats.length >= 2 || priced >= 4) && (
            <div className="cg-tools">
              {main.length >= 6 && <SearchBox value={q} onChange={setQ} label={x.ui("Search", "खोजें")} placeholder={x.ui(`Search ${main.length} ${word.toLowerCase()}`, `${main.length} ${word} में खोजें`)} />}
              {priced >= 4 && (
                <label className="cg-sort"><span className="sr-only">{x.ui("Sort", "क्रम")}</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                    <option value="">{x.ui("Featured", "खास पहले")}</option>
                    <option value="low">{x.ui("Price: low to high", "कीमत: कम से ज़्यादा")}</option>
                    <option value="high">{x.ui("Price: high to low", "कीमत: ज़्यादा से कम")}</option>
                  </select>
                </label>
              )}
              {cats.length >= 2 && (
                <div className="cg-chips" role="group" aria-label={x.ui("Categories", "श्रेणियाँ")}>
                  <button type="button" aria-pressed={!pick} onClick={() => setPick("")}>{x.ui("All", "सभी")} <small>{main.length}</small></button>
                  {cats.map(([k, n]) => <button key={k} type="button" aria-pressed={pick === k} onClick={() => setPick(pick === k ? "" : k)}>{x.t(k)} <small>{n}</small></button>)}
                </div>
              )}
            </div>
          )}
          <p className="cg-count" role="status" aria-live="polite">{filtering ? x.ui(`Showing ${shown.length} of ${main.length}`, `${main.length} में से ${shown.length}`) : ""}</p>
          {shown.length > 0 ? (
            <div className="cg-grid" data-layout={layout} key={`${pick}|${sort}|${q ? 1 : 0}`}>
              {shown.map((it, i) => <ItemCard key={it.slug} it={it} x={x} c={c} layout={layout} i={i} cat={x.card.seo?.categoryKey} />)}
            </div>
          ) : (
            <div className="cg-empty">
              <p>{x.ui("Nothing matches that yet.", "इससे मिलता कुछ नहीं मिला।")}</p>
              <div className="adv-btn-row">
                <button type="button" className="btn-ghost" onClick={() => { setQ(""); setPick(""); }}>{x.ui("Clear the filters", "फ़िल्टर हटाएँ")}</button>
                {x.wa && <a className="btn-primary" href={x.waHref(x.hi ? `नमस्ते ${c.name}, मैं "${q}" ढूँढ रहा/रही हूँ। ` : `Hi ${c.name}, I'm looking for "${q}". `)} target="_blank" rel="noreferrer"><Icon name="whatsapp" /> {x.ui("Ask us on WhatsApp", "WhatsApp पर पूछें")}</a>}
              </div>
            </div>
          )}
        </div>
      </section>
      {extra.length > 0 && (
        <section className="cg cg-extra" aria-label={x.ui("Services", "सेवाएँ")}>
          <div className="adv-wrap adv-wide">
            <h2 className="adv-h2">{x.ui("Services", "सेवाएँ")}</h2>
            <div className="cg-grid" data-layout="list">{extra.map((it, i) => <ItemCard key={it.slug} it={it} x={x} c={c} layout="list" i={i} cat={x.card.seo?.categoryKey} />)}</div>
          </div>
        </section>
      )}
      {(x.wa || x.phone) && (
        <section className="cg-ask" aria-label={x.ui("Ask us", "हमसे पूछें")}>
          <div className="adv-wrap adv-wide cg-ask-in">
            <p>{x.ui("Cannot see what you want?", "जो चाहिए वो नहीं दिख रहा?")} <b>{x.ui("Tell us, we will find it.", "बताइए, हम ढूँढ देंगे।")}</b></p>
            {x.wa
              ? <a className="btn-primary" href={x.waHref()} target="_blank" rel="noreferrer" onClick={() => x.track("cat-ask")}><Icon name="whatsapp" /> {x.ui("Message us", "मैसेज करें")}</a>
              : <a className="btn-primary" href={linkHref(x.phone!.type, x.phone!.value)}><Icon name="phone" /> {x.ui("Call us", "कॉल करें")}</a>}
          </div>
        </section>
      )}
    </>
  );
}

/* ================= one item ================= */

export function ItemPage({ c, x, item, items, entry }: Pick<PageProps, "c" | "x"> & { item: AdvItem; items: AdvItem[]; entry?: AdvPageEntry }) {
  const it = item.item;
  const photos = photosOf(it);
  const pr = priceOf(it);
  const [idx, setIdx] = useState(0);
  const hasPhoto = photos.length > 0;
  const cat = x.card.seo?.categoryKey;
  const feats = (it.features ?? []).map((f) => f.trim()).filter(Boolean);
  const specs = (it.specs ?? []).filter((s) => s.label?.trim() && s.value?.trim());
  const isService = item.kind === "service";
  const related = useMemo(() => {
    const others = items.filter((o) => o.slug !== item.slug && o.kind === item.kind);
    const same = others.filter((o) => (o.item.category ?? "") === (it.category ?? "") && o.page === item.page);
    return [...same, ...others.filter((o) => !same.includes(o))].slice(0, 4);
  }, [items, item, it.category]);
  const catEntry = entry ?? x.pages.byRole("catalogue");
  const label = x.t(it.name);
  const waLink = x.wa ? x.waHref(askText(x, c, it.name, pr.price)) : "";
  const num = items.findIndex((o) => o.slug === item.slug) + 1;
  const word = catalogLabel(recipeFor(cat ?? "").catalog, x.hi ? "hi" : "en");

  return (
    <>
      <section className="ip" aria-labelledby="ip-title">
        <div className="adv-wrap adv-wide">
          <div className="ip-crumb">
            <Crumbs x={x} trail={[...(catEntry ? [{ label: x.t(catEntry.label), slug: catEntry.slug }] : [{ label: word }]), { label }]} />
          </div>
          <div className="ip-grid">
            <div className="ip-gallery">
              {hasPhoto ? (
                <>
                  <div className="ip-main">
                    <Cover key={idx} fallback={label}><ZoomPhoto src={photos[idx]} alt={label} sizes="(min-width:900px) 52vw, 100vw" onOpen={() => x.zoom(photos, idx, label)} /></Cover>
                    {(it.badge || pr.off > 0) && (
                      <span className="ic-tags">{it.badge && <em>{x.t(it.badge)}</em>}{pr.off > 0 && <em data-off="">{pr.off}% {x.ui("off", "छूट")}</em>}</span>
                    )}
                    <span className="ip-hint" aria-hidden="true">{x.ui("Tap to zoom", "बड़ा करें")}</span>
                  </div>
                  {photos.length > 1 && (
                    <ul className="ip-thumbs" aria-label={x.ui("Photos", "फ़ोटो")}>
                      {photos.map((p, k) => (
                        <li key={p}><button type="button" aria-label={`${x.ui("Photo", "फ़ोटो")} ${k + 1}`} aria-current={k === idx ? "true" : undefined} onClick={() => setIdx(k)}><Photo src={p} sizes="96px" /></button></li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="ip-art" aria-hidden="true">
                  <span className="ip-art-n">{String(num).padStart(2, "0")}</span>
                  <span className="ip-art-l">{Array.from(it.name.trim())[0]}</span>
                  <small>{x.t(it.category || c.trade)}</small>
                </div>
              )}
            </div>
            <div className="ip-info">
              <p className="kicker">{x.t(it.category || (isService ? c.trade : word))}</p>
              <h1 id="ip-title" className="ip-title">{label}</h1>
              {(pr.price || pr.mrp) && (
                <p className="ip-price">
                  <b>{x.t(pr.price)}</b>{pr.mrp && <s>{pr.mrp}</s>}{pr.off > 0 && <em>{x.ui(`Save ${pr.off}%`, `${pr.off}% की बचत`)}</em>}
                </p>
              )}
              {it.desc && <p className="ip-desc">{x.t(it.desc)}</p>}
              {feats.length > 0 && (
                <ul className="ip-feat">
                  {feats.map((f, k) => <li key={k}><span aria-hidden="true"><Icon name="check" size={15} strokeWidth={2} /></span>{x.t(f)}</li>)}
                </ul>
              )}
              <div className="ip-acts">
                {x.wa
                  ? <a className="btn-primary ip-wa" href={waLink} target="_blank" rel="noreferrer" onClick={() => x.track("item-enquire")}><Icon name="whatsapp" /> {enquireLabel(x, it, cat)}</a>
                  : x.phone && <a className="btn-primary ip-wa" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("item-call")}><Icon name="phone" /> {x.ui("Call to order", "कॉल करें")}</a>}
                {x.wa && x.phone && <a className="btn-ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("item-call")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</a>}
                <ShareBtn x={x} title={`${label} — ${c.name}`} />
              </div>
              {c.highlights.length > 0 && (
                <ul className="ip-chips" aria-label={x.ui("Good to know", "जानने लायक")}>{c.highlights.slice(0, 4).map((h, k) => <li key={k}>{x.t(h)}</li>)}</ul>
              )}
              {specs.length > 0 && (
                <div className="ip-specs">
                  <h2>{x.ui("Details", "विवरण")}</h2>
                  <dl>{specs.map((s, k) => <div key={k}><dt>{x.t(s.label)}</dt><dd>{x.t(s.value)}</dd></div>)}</dl>
                </div>
              )}
              {isService && c.steps.length >= 2 && (
                <div className="ip-steps">
                  <h2>{x.ui("How it works", "कैसे काम होता है")}</h2>
                  <ol>{c.steps.slice(0, 4).map((s, k) => <li key={k}><b>{x.t(s.name)}</b>{s.desc && <span>{x.t(s.desc)}</span>}</li>)}</ol>
                </div>
              )}
              {c.visit?.address && (
                <p className="ip-visit"><Icon name="pin" /><span>{x.ui("See it at", "यहाँ देखें")} <b>{x.t(c.visit.address)}</b></span></p>
              )}
            </div>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <Sec k="related" tone="alt" wide label={x.ui("More like this", "और देखें")}>
          <div className="ip-rel-head">
            <h2 className="adv-h2">{x.ui("You may also like", "ये भी देखिए")}</h2>
            {catEntry && <a className="btn-link" href={catEntry.href} onClick={(e) => { e.preventDefault(); x.goto?.(catEntry.slug); }}>{x.ui("See all", "सभी देखें")} <Icon name="arrow-right" /></a>}
          </div>
          <div className="cg-grid" data-layout="cards">
            {related.map((o, i) => <ItemCard key={o.slug} it={o} x={x} c={c} layout="cards" i={i} cat={cat} />)}
          </div>
        </Sec>
      )}
    </>
  );
}

export const CATALOG_PAGE_CSS = `
/* ---- the catalogue ---- */
.cg{padding-block:clamp(1.5rem,4vw,3rem) var(--section-pad);background:var(--paper)}
.cg-extra{padding-top:0}.cg-extra .adv-h2{margin-bottom:var(--s5)}
.cg-tools{display:grid;gap:var(--s3);margin-bottom:var(--s5);background:var(--paper);padding-block:var(--s3);margin-inline:calc(var(--gutter) * -1);padding-inline:var(--gutter)}
/* Sticky only on a laptop: on a phone search + sort + chips stacked to 190 px that rode over every product (16 Oct 2026 QA) */
@media (min-width:900px){.cg-tools{position:sticky;z-index:5;grid-template-columns:minmax(0,320px) auto 1fr;align-items:center;top:58px}.cg-chips{justify-content:flex-end}}
.cg-sort select{min-height:48px;padding:0 2.2em 0 1em;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--paper);color:var(--ink);font:inherit;font-size:14.5px;font-weight:500}
.cg-chips{display:flex;gap:var(--s2);overflow-x:auto;scrollbar-width:none;padding-block:2px}
.cg-chips::-webkit-scrollbar{display:none}
.cg-chips button{flex:none;display:inline-flex;align-items:center;gap:.5em;min-height:44px;padding:0 1.1em;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--paper);color:var(--ink);font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background .25s,color .25s,border-color .25s}
.cg-chips button small{font-size:11.5px;opacity:.6}
.cg-chips button:hover{border-color:var(--ink)}
.cg-chips button[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.cg-count{min-height:1.4em;margin:0 0 var(--s3);font-size:var(--t-meta);color:var(--muted)}
.cg-grid{display:grid;gap:clamp(1.75rem,3.4vw,3rem) var(--gap);grid-template-columns:repeat(2,minmax(0,1fr))}
.cg-grid>*{animation:cg-in .7s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--d,0ms)}
@keyframes cg-in{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@media (min-width:760px){.cg-grid[data-layout=cards]{grid-template-columns:repeat(3,minmax(0,1fr))}.cg-grid[data-layout=editorial]{grid-template-columns:repeat(4,minmax(0,1fr))}.cg-grid[data-layout=wide]{grid-template-columns:1fr;gap:clamp(2.5rem,5vw,4.5rem)}}
@media (min-width:1180px){.cg-grid[data-layout=cards]{grid-template-columns:repeat(4,minmax(0,1fr))}}
.cg-grid[data-layout=wide]{grid-template-columns:1fr}
.cg-grid[data-layout=list]{grid-template-columns:1fr;gap:0}
@media (min-width:1100px){.cg-grid[data-layout=list]{grid-template-columns:1fr 1fr;column-gap:clamp(2rem,5vw,5rem)}}
@media (max-width:759px){.ic-editorial[data-lead]{grid-column:span 2;grid-row:auto}.ic-editorial[data-lead] .ic-media{aspect-ratio:4/3;height:auto;min-height:0}}
.cg-empty{display:grid;justify-items:start;gap:var(--s4);padding-block:var(--s8);color:var(--muted);font-size:var(--t-sub)}
.cg-ask{background:var(--paper-2);border-top:1px solid var(--line)}
.cg-ask-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s4) var(--s6);padding-block:clamp(1.75rem,4vw,3rem)}
.cg-ask p{margin:0;font-family:var(--font-display);font-size:clamp(1.3rem,2.6vw,2rem);line-height:1.2;color:var(--muted);max-width:30ch}
.cg-ask b{display:block;font-weight:var(--display-w);color:var(--ink)}
/* ---- one item ---- */
.ip{padding-block:clamp(1rem,3vw,2rem) var(--section-pad);background:var(--paper)}
.ip-crumb{margin-bottom:clamp(1.25rem,3vw,2.25rem)}
.ip-grid{display:grid;gap:clamp(1.75rem,4vw,4.5rem)}
@media (min-width:900px){.ip-grid{grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);align-items:start}.ip-gallery{position:sticky;top:84px}}
.ip-main{position:relative;aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;background:var(--accent-soft)}
@media (min-width:900px){.ip-main{aspect-ratio:1/1.08}}
.ip-main .zp .adv-photo{transition:transform 1.1s cubic-bezier(.2,.7,.2,1)}
.ip-main:hover .zp .adv-photo{transform:scale(1.04)}
.ip-main .ic-tags{top:16px;left:16px}
.ip-hint{position:absolute;right:14px;bottom:14px;padding:.4em .85em;border-radius:var(--r-pill);background:color-mix(in srgb,var(--paper) 86%,transparent);backdrop-filter:blur(8px);font-size:12px;font-weight:600;color:var(--ink);pointer-events:none}
@media (hover:none){.ip-hint{display:none}}
.ip-thumbs{display:flex;gap:var(--s3);margin:var(--s3) 0 0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
.ip-thumbs li{flex:none}
.ip-thumbs button{display:block;position:relative;width:78px;height:78px;padding:0;border:2px solid transparent;border-radius:var(--r-img);overflow:hidden;background:var(--accent-soft);cursor:pointer;opacity:.7;transition:opacity .2s,border-color .2s}
.ip-thumbs button[aria-current=true],.ip-thumbs button:hover{opacity:1;border-color:var(--accent)}
.ip-art{position:relative;aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 70% 24%,color-mix(in srgb,var(--accent) 22%,var(--paper-2)),var(--accent-soft) 70%)}
.ip-art::before,.ip-art::after{content:"";position:absolute;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-radius:50%}
.ip-art::before{width:78%;aspect-ratio:1;left:11%;top:11%}.ip-art::after{width:116%;aspect-ratio:1;left:-8%;top:-8%}
.ip-art-l{font-family:var(--font-display);font-size:clamp(9rem,26vw,18rem);line-height:1;color:var(--accent);text-transform:uppercase}
.ip-art-n{position:absolute;top:22px;left:24px;font-size:13px;font-weight:600;letter-spacing:.12em;color:var(--accent)}
.ip-art small{position:absolute;bottom:22px;left:24px;right:24px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600}
.ip-info{display:grid;gap:var(--s4);align-content:start;min-width:0}
.ip-info .kicker{margin:0}
.ip-title{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.2rem,5.4vw,4.2rem);line-height:1;letter-spacing:var(--display-tr);text-wrap:balance;overflow-wrap:anywhere;margin:0}
.site:lang(hi) .ip-title{line-height:1.25;letter-spacing:0;font-weight:var(--display-w-hi)}
.ip-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:.4em .8em;margin:0;font-variant-numeric:tabular-nums}
.ip-price b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.9rem,3.6vw,2.6rem);line-height:1}
.ip-price s{font-size:1.1rem;color:var(--muted)}
.ip-price em{font-style:normal;font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.4em .8em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent)}
.ip-desc{margin:0;font-size:var(--t-sub);line-height:1.55;color:var(--muted);text-wrap:pretty;max-width:52ch}
.ip-feat{display:grid;gap:var(--s3);margin:var(--s2) 0 0;padding:0;list-style:none}
.ip-feat li{display:grid;grid-template-columns:auto 1fr;gap:var(--s3);align-items:start;font-size:var(--t-body);line-height:1.5}
.ip-feat li span{display:grid;place-items:center;width:24px;height:24px;margin-top:1px;border-radius:50%;background:var(--accent-soft);color:var(--accent)}
.ip-acts{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3);margin-top:var(--s3);padding-top:var(--s5);border-top:1px solid var(--line)}
.ip-wa{flex:1 1 220px;min-height:56px!important;font-size:16px!important}
.ip-wa:hover{background:color-mix(in srgb,var(--wa) 68%,#000)!important;color:#fff!important;filter:none!important}
.ip-chips{display:flex;flex-wrap:wrap;gap:var(--s2);margin:0;padding:0;list-style:none}
.ip-chips li{padding:.4em .9em;border:1px solid var(--line);border-radius:var(--r-pill);font-size:var(--t-meta);color:var(--muted)}
.ip-specs h2,.ip-steps h2{font-family:var(--font-text);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 var(--s3)}
.ip-specs dl{margin:0;border-top:1px solid var(--line)}
.ip-specs dl>div{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:var(--s4);padding:.85em 0;border-bottom:1px solid var(--line);font-size:var(--t-body)}
.ip-specs dt{color:var(--muted)}.ip-specs dd{margin:0;font-weight:500}
.ip-steps ol{display:grid;gap:var(--s4);margin:0;padding:0;list-style:none;counter-reset:s}
.ip-steps li{display:grid;gap:2px;padding-left:3rem;position:relative;counter-increment:s;font-size:var(--t-body);line-height:1.5}
.ip-steps li::before{content:counter(s);position:absolute;left:0;top:0;display:grid;place-items:center;width:2.1rem;height:2.1rem;border-radius:50%;border:1px solid var(--accent);color:var(--accent);font-weight:600;font-size:14px}
.ip-steps li span{color:var(--muted);font-size:var(--t-meta)}
.ip-visit{display:flex;align-items:flex-start;gap:var(--s3);margin:0;padding:var(--s4);border-radius:var(--r-card);background:var(--paper-2);font-size:var(--t-meta);color:var(--muted);line-height:1.5}
.ip-visit svg{flex:none;margin-top:2px;color:var(--accent)}.ip-visit b{color:var(--ink);font-weight:500}
.ip-rel-head{display:flex;align-items:end;justify-content:space-between;gap:var(--s4);margin-bottom:clamp(1.75rem,4vw,3rem)}
`;
