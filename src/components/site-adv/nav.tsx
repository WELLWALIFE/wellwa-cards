"use client";
// The advanced website's page shell (owner, 16 Oct 2026: "one scrolling page" was not a website): the list of pages and their
// addresses, a header that condenses once the visitor scrolls, a full-screen menu on phones, a scroll-progress hairline, the
// breadcrumb of inner pages and the phone's sticky action bar. Pages themselves are in pages.tsx, the composition in index.tsx.
//
// Everything here reads the spec's seed for its small choices (header layout, masthead style), so two businesses do not share a
// shell any more than they share a hero. No colour, radius or font is written here: the root's tokens (advancedVars) carry them.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Card, CardPage } from "@/lib/types";
import { hash32, livePages, pageRole, type AdvPageRole, type AdvancedSpec } from "@/lib/site-advanced";
import type { AdvCtx } from "@/components/site-adv/shared";
import { Icon } from "@/components/site-icons";
import { linkHref } from "@/components/link-icon";

/* ================= the list of pages ================= */

export type AdvPageEntry = {
  slug: string;
  role: AdvPageRole | "updates";
  /** The label as stored (the owner's words: run it through `t`) or, for pages made here, an `owner: false` interface string. */
  label: string;
  owner: boolean;
  href: string;
  /** Shown in the header menu (the footer and the phone menu list every page). */
  primary: boolean;
};
export type AdvPages = {
  /** Every page of the website in menu order, home first. */
  list: AdvPageEntry[];
  /** Slug of the home page. */
  home: string;
  /** Slug of the page on screen (an item's own page shows its catalogue as active). */
  active: string;
  byRole: (role: AdvPageEntry["role"]) => AdvPageEntry | undefined;
  /** The page a home-page section belongs to ("services" -> the catalogue, "visit" -> contact...), when the site has one. */
  forSection: (key: string) => AdvPageEntry | undefined;
};
/** What variants receive in `x` beyond AdvCtx: the page list and the address of a section's page. The renderer always passes it,
 *  so a variant may read `(x as AdvCtxPlus).pages` (e.g. a footer listing real pages, a "see all" link to the catalogue). */
export type AdvCtxPlus = AdvCtx & { pages: AdvPages; sectionHref: (key: string) => string };

/** Menu order: what is sold first, then who we are, the photos, any other page, the updates, and contact last. */
const RANK: Record<AdvPageEntry["role"], number> = { home: 0, catalogue: 1, about: 2, gallery: 3, page: 4, faq: 5, updates: 6, contact: 7 };
/** The page a home-page section links to. */
const SECTION_ROLE: Record<string, AdvPageEntry["role"]> = {
  about: "about", process: "about", trust: "about", services: "catalogue", gallery: "gallery", proof: "about", faq: "contact", visit: "contact", cta: "contact",
};

export function buildPages(card: Card, opts: { hrefFor: (slug: string) => string; hasUpdates: boolean; active: string; hi: boolean }): AdvPages {
  const live = livePages(card);
  const first = card.pages[0]?.slug ?? "home";
  const rows = live.map((p: CardPage, i): AdvPageEntry => {
    const role = i === 0 || p.slug === first ? "home" : pageRole(card, p);
    // The About and Gallery pages made for the advanced site (withAdvancedPages) are interface words, said in the visitor's language.
    const made = p.id === "adv-about" ? (opts.hi ? "हमारे बारे में" : "About") : p.id === "adv-gallery" ? (opts.hi ? "फ़ोटो" : "Gallery") : "";
    return { slug: p.slug, role, label: made || p.label, owner: !made, href: opts.hrefFor(p.slug), primary: false };
  });
  if (opts.hasUpdates) rows.push({ slug: "updates", role: "updates", label: opts.hi ? "अपडेट" : "Updates", owner: false, href: opts.hrefFor("updates"), primary: false });
  const list = [...rows].sort((a, b) => RANK[a.role] - RANK[b.role] || rows.indexOf(a) - rows.indexOf(b));
  // Six links fit a header; the first of each role leads, then the rest in order (a second catalogue page is kept: "Products" + "Services").
  list.forEach((e, i) => { e.primary = e.role !== "home" && i <= 6; });
  const home = list.find((e) => e.role === "home")?.slug ?? first;
  const byRole: AdvPages["byRole"] = (role) => list.find((e) => e.role === role);
  return { list, home, active: opts.active, byRole, forSection: (key) => (SECTION_ROLE[key] ? byRole(SECTION_ROLE[key]) : undefined) };
}

/* ================= small choices from the seed ================= */

export type Chrome = { header: "bar" | "split"; mast: "ink" | "type" | "split" | "poster" };
export function chromeOf(spec: AdvancedSpec): Chrome {
  const h = hash32(`${spec.seed}|chrome`);
  const hero = spec.hero;
  const luxe = !!spec.palette.luxe || spec.palette.tone === "dark";
  const mast: Chrome["mast"] =
    hero === "editorial-marquee" || hero === "masthead" ? "type"
    : hero === "centered-minimal" || hero === "stacked-poster" ? "poster"
    : hero === "split-frame" || hero === "mosaic" ? (h % 2 ? "split" : "type")
    : hero === "full-bleed" || hero === "glass-card" || hero === "video-first" || hero === "diagonal" ? (h % 3 === 0 ? "split" : "ink")
    : (["ink", "type", "split", "poster"] as const)[h % 4];
  return { header: luxe && h % 2 === 0 || hero === "masthead" || hero === "centered-minimal" ? "split" : "bar", mast };
}

/* ================= hooks ================= */

/** Scrolled past `at` px: the header condenses. Passive listener, one state flip. */
export function useScrolled(at = 24): boolean {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > at);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [at]);
  return s;
}

/** The scroll-progress hairline: `--nv-p` (0..1) is written straight to the element, so scrolling never re-renders the page. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const set = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty("--nv-p", h > 0 ? String(Math.min(1, Math.max(0, window.scrollY / h))) : "0");
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(set); };
    set(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className="nv-progress" aria-hidden="true"><i /></div>;
}

/* ================= header + menu ================= */

type HeaderProps = {
  x: AdvCtxPlus;
  name: string;
  logo?: ReactNode;
  scrolled: boolean;
  /** Show the WhatsApp button in the header (inner pages, or once the home hero has gone). */
  showCta: boolean;
  lang: ReactNode;
  chrome: Chrome;
  onHome: () => void;
};

export function AdvHeader({ x, name, logo, scrolled, showCta, lang, chrome, onHome }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { pages } = x;
  // "Home" is always the first link (owner, 20 Oct 2026): the logo alone was not read as the way back to the first page.
  const homeEntry = pages.list.find((e) => e.role === "home");
  const items = [...(homeEntry && !homeEntry.primary ? [homeEntry] : []), ...pages.list.filter((e) => e.primary)];
  const go = (e: React.MouseEvent, slug: string) => {
    e.preventDefault(); setOpen(false);
    if (x.goto) x.goto(slug); else x.jump(slug);
  };
  // The menu locks the page behind it, closes on Escape, and hands focus back to the button.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    root.dataset.navOpen = "";
    // The links start under the header, wherever the header is (at the very top of a page it sits below the announcement strips).
    menuRef.current?.style.setProperty("--nv-hb", `${Math.round(headRef.current?.getBoundingClientRect().bottom ?? 60)}px`);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); burger.current?.focus(); } };
    window.addEventListener("keydown", key);
    const first = document.querySelector<HTMLElement>(".nv-menu a");
    first?.focus({ preventScroll: true });
    return () => { root.style.overflow = prev; delete root.dataset.navOpen; window.removeEventListener("keydown", key); };
  }, [open]);
  // A wide window has no menu: leaving it open across a resize would lock a page with nothing to close it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const label = (e: AdvPageEntry) => (e.role === "home" ? x.ui("Home", "होम") : e.owner ? x.t(e.label) : e.label);
  const link = (e: AdvPageEntry) => (
    <a key={e.slug} href={e.href} className="nv-link" aria-current={pages.active === e.slug ? "page" : undefined} onClick={(ev) => go(ev, e.slug)}>{label(e)}</a>
  );
  const half = Math.ceil(items.length / 2);
  const cta = x.wa
    ? <a href={x.waHref()} target="_blank" rel="noreferrer" className="nv-cta btn-primary btn-sm" data-show={showCta ? "" : undefined} tabIndex={showCta ? undefined : -1} aria-hidden={showCta ? undefined : true} onClick={() => x.track("nav-whatsapp")}><Icon name="whatsapp" /> {x.ui("Enquire", "पूछें")}</a>
    : x.phone ? <a href={linkHref(x.phone.type, x.phone.value)} className="nv-cta btn-primary btn-sm" data-show={showCta ? "" : undefined} tabIndex={showCta ? undefined : -1} aria-hidden={showCta ? undefined : true} onClick={() => x.track("nav-call")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</a> : null;
  const brand = (
    <a href={pages.list.find((e) => e.role === "home")?.href ?? "#"} className="nv-brand" aria-label={`${name} — ${x.ui("home", "होम")}`} onClick={(e) => { e.preventDefault(); onHome(); }}>{logo}</a>
  );
  return (
    <>
      <header ref={headRef} className="nv-head" data-style={chrome.header} data-scrolled={scrolled ? "" : undefined} data-open={open ? "" : undefined}>
        <div className="adv-wrap adv-wide nv-row">
          {chrome.header === "split" ? (
            <>
              <nav className="nv-links nv-left" aria-label={x.ui("Pages", "पेज")}>{items.slice(0, half).map(link)}</nav>
              {brand}
              <div className="nv-right">
                <nav className="nv-links nv-rightlinks" aria-label={x.ui("More pages", "और पेज")}>{items.slice(half).map(link)}</nav>
                <div className="nv-lang">{lang}</div>
                {cta}
              </div>
            </>
          ) : (
            <>
              {brand}
              <nav className="nv-links" aria-label={x.ui("Pages", "पेज")}>{items.map(link)}</nav>
              <div className="nv-right"><div className="nv-lang">{lang}</div>{cta}</div>
            </>
          )}
          <button ref={burger} type="button" className="nv-burger" aria-expanded={open} aria-controls="nv-menu" aria-label={open ? x.ui("Close menu", "मेन्यू बंद करें") : x.ui("Menu", "मेन्यू")} onClick={() => setOpen(!open)}>
            <i /><i />
          </button>
        </div>
        <ScrollProgress />
      </header>
      {/* The phone's menu: the whole screen, in the ink field, every page as a large numbered line. */}
      <div id="nv-menu" ref={menuRef} className="nv-menu hero-dark" data-open={open ? "" : undefined} inert={!open} role="dialog" aria-modal="true" aria-label={x.ui("Menu", "मेन्यू")}>
        <nav className="nv-menu-links" aria-label={x.ui("Pages", "पेज")}>
          {pages.list.map((e, i) => (
            <a key={e.slug} href={e.href} style={{ ["--i" as string]: i }} aria-current={pages.active === e.slug ? "page" : undefined} onClick={(ev) => go(ev, e.slug)}>
              <small aria-hidden="true">{String(i + 1).padStart(2, "0")}</small>{e.role === "home" ? x.ui("Home", "होम") : label(e)}
            </a>
          ))}
        </nav>
        <div className="nv-menu-foot" style={{ ["--i" as string]: pages.list.length }}>
          {addressOf(x) ? <p className="nv-menu-addr"><Icon name="pin" /> {addressOf(x)}</p> : null}
          <div className="nv-menu-act">
            {x.wa && <a className="btn-primary" href={x.waHref()} target="_blank" rel="noreferrer" onClick={() => x.track("menu-whatsapp")}><Icon name="whatsapp" /> WhatsApp</a>}
            {x.phone && <a className="btn-ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("menu-call")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</a>}
          </div>
          <div className="nv-menu-lang">{lang}</div>
        </div>
      </div>
    </>
  );
}

const addressOf = (x: AdvCtxPlus): string => {
  for (const p of x.card.pages) for (const b of p.blocks) if (b.kind === "location" && (b.address ?? "").trim()) return x.t(b.address.trim());
  return x.card.seo?.city ?? "";
};

/* ================= breadcrumb ================= */

export function Crumbs({ x, trail }: { x: AdvCtxPlus; trail: { label: string; slug?: string }[] }) {
  const home = x.pages.list.find((e) => e.role === "home");
  const all = [{ label: x.ui("Home", "होम"), slug: home?.slug }, ...trail];
  return (
    <nav className="nv-crumbs" aria-label={x.ui("Breadcrumb", "आप यहाँ हैं")}>
      <ol>
        {all.map((c, i) => {
          const last = i === all.length - 1;
          const href = c.slug ? x.pages.list.find((e) => e.slug === c.slug)?.href ?? x.hrefFor(c.slug) : undefined;
          return (
            <li key={i} aria-current={last ? "page" : undefined}>
              {href && !last
                ? <a href={href} onClick={(e) => { e.preventDefault(); if (x.goto) x.goto(c.slug!); }}>{c.label}</a>
                : <span>{c.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ================= the phone's sticky action bar ================= */

export function MobileBar({ x, shown, lead }: { x: AdvCtxPlus; shown: boolean; /** On an item's page: what it is and what it costs, with the enquiry as the one big button. */ lead?: { title: string; price?: string; waText: string } }) {
  const { wa, phone, mapLink } = x;
  if (!wa && !phone) return null;
  const n = [phone, wa, mapLink].filter(Boolean).length;
  return (
    <div className="nv-bar" data-shown={shown ? "" : undefined} data-lead={lead ? "" : undefined} style={{ ["--n" as string]: lead ? 2 : n }}>
      {lead ? (
        <>
          <div className="nv-bar-lead"><b>{lead.title}</b>{lead.price && <span>{lead.price}</span>}</div>
          {wa
            ? <a className="nv-bar-wa" href={x.waHref(lead.waText)} target="_blank" rel="noreferrer" onClick={() => x.track("bar-enquire")}><Icon name="whatsapp" /> {x.ui("Enquire", "पूछें")}</a>
            : <a className="nv-bar-wa" href={linkHref(phone!.type, phone!.value)} onClick={() => x.track("bar-call")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</a>}
        </>
      ) : (
        <>
          {phone && <a href={linkHref(phone.type, phone.value)} onClick={() => x.track("bar-phone")}><Icon name="phone" /> {x.ui("Call", "कॉल")}</a>}
          {wa && <a className="nv-bar-wa" href={x.waHref()} target="_blank" rel="noreferrer" onClick={() => x.track("bar-whatsapp")}><Icon name="whatsapp" /> WhatsApp</a>}
          {mapLink && <a href={linkHref(mapLink.type, mapLink.value)} target="_blank" rel="noreferrer" onClick={() => x.track("bar-map")}><Icon name="directions" /> {x.ui("Directions", "रास्ता")}</a>}
        </>
      )}
    </div>
  );
}

/* ================= CSS ================= */

export const NAV_CSS = `
.nv-skip{position:fixed;left:12px;top:-60px;z-index:100;padding:.7em 1.1em;border-radius:var(--r-ctl);background:var(--ink);color:var(--paper);font-size:14px;font-weight:600;text-decoration:none;transition:top .2s}
.nv-skip:focus{top:12px}
#adv-main:focus{outline:none}
/* ---- header: tall on arrival, condensed once the visitor scrolls ---- */
.nv-head{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--paper) 90%,transparent);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);box-shadow:0 1px 0 transparent;transition:box-shadow .3s,background .3s}
.nv-head[data-scrolled]{box-shadow:0 1px 0 var(--line),0 10px 30px -18px color-mix(in srgb,var(--ink) 45%,transparent);background:color-mix(in srgb,var(--paper) 94%,transparent)}
.nv-row{display:flex;align-items:center;gap:var(--s5);height:72px;transition:height .3s cubic-bezier(.2,.7,.2,1)}
.nv-head[data-scrolled] .nv-row{height:58px}
.nv-brand{display:flex;align-items:center;min-height:44px;min-width:0;max-width:260px;color:inherit;text-decoration:none;border-radius:var(--r-ctl);flex:none}
.nv-brand img{height:40px;width:auto;max-width:170px;object-fit:contain;transition:height .3s cubic-bezier(.2,.7,.2,1)}
.nv-head[data-scrolled] .nv-brand img{height:32px}
.nv-brand .hero-wordmark b{transition:font-size .3s}
.nv-head[data-scrolled] .nv-brand .hero-wordmark b{font-size:.92em}
.nv-links{display:none;align-items:center;gap:2px}
.nv-link{position:relative;padding:.55rem .85rem;font-size:14.5px;font-weight:500;color:var(--muted);text-decoration:none;border-radius:var(--r-ctl);transition:color .2s;white-space:nowrap}
.nv-link::after{content:"";position:absolute;left:.85rem;right:.85rem;bottom:.25rem;height:1.5px;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.nv-link:hover{color:var(--ink)}.nv-link:hover::after,.nv-link[aria-current=page]::after{transform:scaleX(1)}
.nv-link[aria-current=page]{color:var(--ink)}
.nv-right{display:none;align-items:center;gap:var(--s3);margin-left:auto}
.nv-cta{visibility:hidden;opacity:0;transform:translateY(-4px);transition:opacity .3s,transform .3s,visibility 0s .3s}
.nv-cta[data-show]{visibility:visible;opacity:1;transform:none;transition:opacity .3s,transform .3s}
.nv-cta.btn-primary{min-height:40px;padding:0 var(--s4);font-size:14px}
.nv-burger{margin-left:auto;position:relative;display:grid;place-content:center;gap:6px;width:44px;height:44px;border:1px solid var(--line);border-radius:var(--r-ctl);background:none;color:inherit;cursor:pointer}
/* open menu: the header turns transparent over the ink field and its words go light, so the logo and the close button stay */
.nv-head[data-open]{background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;color:var(--hero-text);transition:none}
.nv-head[data-open] .nv-progress{opacity:0}
.nv-burger i{display:block;width:20px;height:1.5px;background:currentColor;transition:transform .4s cubic-bezier(.2,.7,.2,1)}
.nv-burger[aria-expanded=true]{color:var(--hero-text);border-color:var(--hero-line)}
.nv-burger[aria-expanded=true] i:first-child{transform:translateY(3.75px) rotate(45deg)}
.nv-burger[aria-expanded=true] i:last-child{transform:translateY(-3.75px) rotate(-45deg)}
@media (min-width:900px){
  .nv-links,.nv-right{display:flex}.nv-burger,.nv-menu{display:none}
  .nv-head[data-style=bar] .nv-links{margin-left:auto}.nv-head[data-style=bar] .nv-right{margin-left:var(--s3)}
  .nv-head[data-style=split] .nv-row{display:grid;grid-template-columns:1fr auto 1fr;gap:var(--s6)}
  .nv-head[data-style=split] .nv-left{justify-self:start}
  .nv-head[data-style=split] .nv-brand{justify-self:center}
  .nv-head[data-style=split] .nv-right{justify-self:end;margin-left:0}
  .nv-head[data-style=split] .nv-brand .hero-wordmark{align-items:center;text-align:center}
}
@media (max-width:899px){.nv-row{height:60px}.nv-head[data-scrolled] .nv-row{height:54px}.nv-brand img{height:34px}}
.nv-progress{position:absolute;left:0;right:0;bottom:-1px;height:2px;pointer-events:none}
.nv-progress i{display:block;height:100%;background:var(--accent);transform-origin:0 50%;transform:scaleX(var(--nv-p,0))}
/* ---- the phone's menu: the whole screen, opened with a circle from the button ---- */
.nv-menu{position:fixed;inset:0;z-index:39;display:flex;flex-direction:column;justify-content:space-between;padding:calc(var(--nv-hb,60px) + 28px) var(--gutter) max(24px,env(safe-area-inset-bottom));overflow-y:auto;background:var(--hero-ink);color:var(--hero-text);clip-path:circle(0 at calc(100% - 42px) 38px);visibility:hidden;transition:clip-path .7s cubic-bezier(.7,0,.2,1),visibility 0s .7s}
.nv-menu[data-open]{clip-path:circle(150% at calc(100% - 42px) 38px);visibility:visible;transition:clip-path .7s cubic-bezier(.7,0,.2,1),visibility 0s}
.nv-menu-links{display:flex;flex-direction:column}
.nv-menu-links a{display:flex;align-items:baseline;gap:var(--s4);padding:.55rem 0;border-bottom:1px solid var(--hero-line);font-family:var(--font-display);font-size:clamp(2rem,9.5vw,3.2rem);line-height:1.1;letter-spacing:var(--display-tr);color:var(--hero-text);text-decoration:none;opacity:0;transform:translateY(22px);transition:opacity .5s,transform .6s cubic-bezier(.2,.7,.2,1);transition-delay:0s}
.site:lang(hi) .nv-menu-links a{line-height:1.35;letter-spacing:0}
.nv-menu[data-open] .nv-menu-links a{opacity:1;transform:none;transition-delay:calc(.28s + var(--i) * 55ms)}
.nv-menu-links a small{font-family:var(--font-text);font-size:12px;letter-spacing:.08em;color:var(--hero-muted);min-width:1.8em}
.nv-menu-links a[aria-current=page]{color:var(--accent)}
.nv-menu-foot{display:grid;gap:var(--s4);padding-top:var(--s6);opacity:0;transform:translateY(14px);transition:opacity .5s,transform .5s;transition-delay:0s}
.nv-menu[data-open] .nv-menu-foot{opacity:1;transform:none;transition-delay:calc(.28s + var(--i) * 55ms)}
.nv-menu-addr{display:flex;align-items:flex-start;gap:var(--s3);margin:0;font-size:var(--t-meta);line-height:1.5;color:var(--hero-muted)}.nv-menu-addr svg{flex:none;margin-top:3px}
.nv-menu-act{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)}.nv-menu-act:has(>:only-child){grid-template-columns:1fr}
.nv-menu .btn-ghost{border-color:var(--hero-line);color:var(--hero-text)}
.nv-menu .btn-primary{background:var(--hero-text);color:var(--hero-ink)}
/* ---- breadcrumb ---- */
.nv-crumbs ol{display:flex;flex-wrap:wrap;align-items:center;gap:.15rem .5rem;margin:0;padding:0;list-style:none;font-size:var(--t-meta);color:var(--muted)}
.nv-crumbs li{display:inline-flex;align-items:center;gap:.5rem;min-width:0}
.nv-crumbs li+li::before{content:"";width:5px;height:5px;border-top:1.5px solid currentColor;border-right:1.5px solid currentColor;transform:rotate(45deg);opacity:.5}
.nv-crumbs a{display:inline-flex;align-items:center;min-height:36px;color:inherit;text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size .3s,color .2s}
.nv-crumbs a:hover{color:var(--ink);background-size:100% 1px}
.nv-crumbs [aria-current=page]{color:var(--ink);font-weight:500;max-width:34ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ---- the phone's sticky bar ---- */
.nv-bar{position:fixed;left:0;right:0;bottom:0;z-index:45;display:grid;grid-template-columns:repeat(var(--n,2),1fr);gap:1px;background:var(--line);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom);transform:translateY(110%);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.nv-bar[data-shown]{transform:none}
body[data-sheet] .nv-bar,html[data-nav-open] .nv-bar{transform:translateY(110%)}
.nv-bar a{display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:52px;background:var(--paper);color:var(--ink);font-size:14.5px;font-weight:600;text-decoration:none}
/* white on the bright WhatsApp green is about 2:1: the bar's green is mixed down to read at 4.5:1 (16 Oct 2026 QA) */
.nv-bar a.nv-bar-wa{background:color-mix(in srgb,var(--wa) 68%,#000);color:#fff}
.nv-bar[data-lead]{grid-template-columns:1fr auto}
.nv-bar-lead{display:grid;align-content:center;gap:1px;padding:6px var(--gutter);background:var(--paper);min-width:0}
.nv-bar-lead b{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nv-bar-lead span{font-size:13px;color:var(--accent);font-weight:600}
.nv-bar[data-lead] a.nv-bar-wa{padding:0 var(--s6)}
@media (min-width:768px){.nv-bar{display:none}}
/* ---- one page leaves, the next arrives (CSS only: the page's wrapper is re-keyed by its slug) ---- */
.nv-page{animation:nv-in .6s cubic-bezier(.2,.7,.2,1) both}
@keyframes nv-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.nv-page.nv-curtain::before{content:"";position:fixed;inset:0;z-index:38;background:var(--hero-ink);pointer-events:none;animation:nv-lift .75s cubic-bezier(.7,0,.2,1) .05s both}
@keyframes nv-lift{from{clip-path:inset(0 0 0 0)}to{clip-path:inset(0 0 100% 0)}}
.nv-page.nv-curtain{animation-delay:.25s}
@media (prefers-reduced-motion:reduce){.nv-page.nv-curtain::before{display:none}.nv-page{animation:none}.nv-menu,.nv-menu *{transition-duration:.01ms!important;transition-delay:0s!important}}
.site[data-adv][data-motion=none] .nv-page{animation:none}.site[data-adv][data-motion=none] .nv-page.nv-curtain::before{display:none}
`;
