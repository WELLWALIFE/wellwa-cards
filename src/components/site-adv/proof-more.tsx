"use client";
// Advanced-site GALLERY, PROOF and TRUST variants, the second set (owner, 16 Oct 2026: "it still needs a LOT of hard work ... the
// user's mouth must say WOW"). Ideas taken from the sites the research visited: Nham's tilted numbered "crime scene" photos, Allemande's
// visible hairline grid, the receipt-style testimonials, Caveau's two opposing marquees, a pinned sideways gallery, a stage with a rail.
//
// GALLERY (the business's own photos; the lightbox is the page's, through x.zoom)
//   scrapbook      taped, slightly tilted prints in staggered columns, each with its number and the owner's caption
//   rooms          a visible hairline grid, one big cell, every cell numbered "(01)" with its caption under the photo
//   pinned-reel    the page stops and the photos slide sideways as you scroll (a plain swipe strip without scripting or with
//                  reduced motion), counter and progress line
//   stage          one large photo at a time with its caption, arrows and a rail of thumbnails
// PROOF (the owner's reviews, all of them read from the card)
//   receipt        the reviews itemised on a paper till receipt, an average as the total, a barcode
//   marquee-cards  two rows of review cards drifting in opposite directions (a wrapped grid under reduced motion)
//   spotlight      one review huge on the ink field, the other reviewers as a list to pick from
// TRUST (the card's own numbers, 2-4 facts)
//   bento          one huge number on the accent field, the rest on ink and paper tiles, laid out by how many facts there are
//   hairline       a ruled grid, each cell numbered, the figure large at the foot of the cell
//
// Every variant draws nothing when its slice is too thin and leaves out any part it has no material for. Colours, corners, spacing and
// faces come only from the spec's tokens (shared.tsx). Motion starts from the finished look (a keyframe has only a `from`), so a
// browser that skips animations, the server's HTML, a print and prefers-reduced-motion all show the finished page.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CountUp } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { Btn, Eyebrow, Head, Photo, Sec, Stars, type VariantProps } from "@/components/site-adv/shared";
import {
  AvgLine, FrameBtn, Mono, Rail, countLabel, css, factIcon, framesOf, lenOf, pad2, reducedMotion, reviewsOf, MASONRY_AR,
} from "@/components/site-adv/proof";

/* ================= GALLERY ================= */

/* ---------- scrapbook ---------- */
const TILT = [-1.7, 1.2, -.8, 1.9, -1.1, .7, -1.9, 1.1, -.6, 1.5, -1.3, .9];
export function GalleryScrapbook({ c, x }: VariantProps) {
  const fr = framesOf(c, x, 12);
  if (fr.length < 3) return null;
  const urls = fr.map((f) => f.url);
  return (
    <Sec k="gallery" tone="alt" wide className="gsb-sec">
      <div className="gsb-top">
        <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("Moments, framed", "कुछ यादगार पल")} />
        <p className="gsb-count" aria-hidden="true"><b>{pad2(fr.length)}</b> {x.ui("prints", "फ़ोटो")}</p>
      </div>
      <div className="gsb-board" data-cols={fr.length % 4 === 0 || fr.length > 6 ? 4 : 3} style={css({ "--cols": fr.length % 4 === 0 || fr.length > 6 ? 4 : 3 })}>
        {fr.map((f, i) => {
          const cap = f.label ? x.t(f.label) : "";
          return (
            <figure key={f.url} className="gsb-print" style={css({ "--rot": `${TILT[i % TILT.length]}deg`, "--ar": MASONRY_AR[(i + 2) % MASONRY_AR.length] })}>
              <button
                type="button" className="gsb-btn" onClick={() => { x.track("gallery-zoom"); x.zoom(urls, i, cap || c.name); }}
                aria-label={cap || x.ui(`Open photo ${i + 1} of ${urls.length}`, `फ़ोटो ${i + 1} / ${urls.length} खोलें`)}
              >
                <span className="gsb-ph"><Photo src={f.url} alt="" sizes="(min-width:1200px) 24vw, (min-width:768px) 32vw, 48vw" /></span>
              </button>
              <figcaption><b>{pad2(i + 1)}</b>{cap && <span>{cap}</span>}</figcaption>
            </figure>
          );
        })}
      </div>
    </Sec>
  );
}

/* ---------- rooms: the hairline grid ---------- */
export function GalleryRooms({ c, x, index }: VariantProps) {
  const all = framesOf(c, x, 24);
  if (all.length < 3) return null;
  // One big cell plus a ring of small ones that fills a four-column grid with no hole: 5 or 9 photos; fewer than five, an even row.
  const shown = all.length >= 9 ? all.slice(0, 9) : all.length >= 5 ? all.slice(0, 5) : all;
  const big = shown.length >= 5;
  const urls = all.map((f) => f.url);
  const rest = all.length - shown.length;
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide className="grm-sec">
      <div className="grm-head"><Head eyebrow={x.ui("The space", "हमारी जगह")} title={x.ui("A look around", "एक नज़र, चारों ओर")} /></div>
      <ul className="grm" data-n={shown.length} data-big={big ? "" : undefined}>
        {shown.map((f, i) => {
          const cap = f.label ? x.t(f.label) : "";
          const last = i === shown.length - 1 && rest > 0;
          return (
            <li key={f.url} className="grm-cell" data-lead={big && i === 0 ? "" : undefined}>
              <button
                type="button" className="grm-btn" onClick={() => { x.track("gallery-zoom"); x.zoom(urls, i, cap || c.name); }}
                aria-label={last ? x.ui(`Open photo ${i + 1} of ${urls.length}: see all`, `फ़ोटो ${i + 1} / ${urls.length}: सब देखें`) : cap || x.ui(`Open photo ${i + 1} of ${urls.length}`, `फ़ोटो ${i + 1} / ${urls.length} खोलें`)}
              >
                <span className="grm-ph"><Photo src={f.url} alt="" sizes={big && i === 0 ? "(min-width:900px) 50vw, 100vw" : "(min-width:900px) 25vw, 50vw"} />{last && <span className="grm-more" aria-hidden="true">+{rest + 1}</span>}</span>
                <span className="grm-cap"><i aria-hidden="true">({pad2(i + 1)})</i><span>{cap}</span><Icon name="arrow-up-right" size={16} /></span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sec>
  );
}

/* ---------- pinned reel ---------- */
const REEL_AR = [.8, 1.35, 1, .75, 1.5, .9];
export function GalleryReel({ c, x }: VariantProps) {
  const fr = framesOf(c, x, 12);
  const sec = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const cnt = useRef<HTMLElement>(null);
  const n = fr.length;
  // The page scrolls vertically and the strip slides sideways: the section is made as tall as the strip is long, a sticky stage holds
  // the strip, and each frame of scroll sets the strip's offset. Without scripting, with reduced motion or with the spec's motion
  // "none" the section stays an ordinary swipe strip (`data-pin` is never set).
  useEffect(() => {
    const el = sec.current, tr = track.current;
    if (!el || !tr || n < 3 || reducedMotion() || el.closest("[data-motion=none]")) return;
    let max = 0, raf = 0, live = false;
    const measure = () => {
      const stage = tr.parentElement as HTMLElement;
      max = Math.max(0, tr.scrollWidth - stage.clientWidth);
      el.style.setProperty("--reel-h", `${Math.round(window.innerHeight + max * 0.9)}px`);
    };
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.max(0, Math.min(1, -r.top / span));
      tr.style.transform = `translate3d(${(-p * max).toFixed(1)}px,0,0)`;
      const fill = bar.current?.firstElementChild as HTMLElement | null;
      if (fill) fill.style.transform = `scaleX(${(0.04 + p * 0.96).toFixed(4)})`;
      if (cnt.current) cnt.current.textContent = pad2(Math.min(n, 1 + Math.floor(p * n * 0.999)));
    };
    const on = () => { if (live && !raf) raf = requestAnimationFrame(update); };
    const resize = () => { measure(); on(); };
    el.dataset.pin = "";
    // A frame reached by keyboard: scroll the page to where the strip has that frame in the middle (the box itself never scrolls sideways).
    const onFocus = (e: FocusEvent) => {
      const f = (e.target as HTMLElement).closest<HTMLElement>(".grl-frame");
      const view = tr.parentElement as HTMLElement;
      if (!f) return;
      view.scrollLeft = 0;
      const p = max > 0 ? Math.max(0, Math.min(1, (f.offsetLeft - (view.clientWidth - f.offsetWidth) / 2) / max)) : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + p * Math.max(0, el.offsetHeight - window.innerHeight), behavior: "auto" });
    };
    el.addEventListener("focusin", onFocus);
    measure(); update();
    const io = new IntersectionObserver((es) => { live = es.some((e) => e.isIntersecting); if (live) on(); }, { rootMargin: "25% 0px 25% 0px" });
    io.observe(el);
    window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", resize);
    // The pictures arrive after the first measure: measure again once they have.
    const late = window.setTimeout(resize, 1200);
    return () => {
      io.disconnect(); window.removeEventListener("scroll", on); window.removeEventListener("resize", resize); el.removeEventListener("focusin", onFocus);
      cancelAnimationFrame(raf); window.clearTimeout(late); delete el.dataset.pin; el.style.removeProperty("--reel-h"); tr.style.transform = "";
    };
  }, [n]);
  if (n < 3) return null;
  const urls = fr.map((f) => f.url);
  return (
    <section ref={sec} id="adv-gallery" data-sec="gallery" data-tone="ink" data-reveal className="adv-sec hero-dark grl">
      <div className="grl-stage">
        <div className="adv-wrap adv-wide grl-top">
          <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("Take a closer look", "ज़रा क़रीब से देखें")} />
          <p className="grl-count" aria-hidden="true"><b ref={cnt}>01</b><i>/ {pad2(n)}</i></p>
        </div>
        <div className="grl-view" tabIndex={0} role="region" aria-label={x.ui("Photo reel", "फ़ोटो रील")}>
          <div ref={track} className="grl-track">
            {fr.map((f, i) => (
              <FrameBtn key={f.url} f={f} i={i} urls={urls} x={x} name={c.name} cls="grl-frame" style={css({ "--ar": REEL_AR[i % REEL_AR.length] })} sizes="(min-width:768px) 40vw, 76vw" />
            ))}
          </div>
        </div>
        <div className="adv-wrap adv-wide"><span ref={bar} className="grl-prog" aria-hidden="true"><i /></span></div>
      </div>
    </section>
  );
}

/* ---------- stage ---------- */
export function GalleryStage({ c, x, index }: VariantProps) {
  const fr = framesOf(c, x, 18);
  const [cur, setCur] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const uid = useId();
  if (fr.length < 3) return null;
  const n = fr.length;
  const urls = fr.map((f) => f.url);
  const go = (to: number) => {
    const i = (to + n) % n;
    setCur(i);
    // Keep the chosen thumbnail in view inside the rail, without moving the page.
    const el = rail.current; const k = el?.children[i] as HTMLElement | undefined;
    if (el && k) el.scrollTo({ left: k.offsetLeft - (el.clientWidth - k.clientWidth) / 2, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
  };
  const f = fr[cur];
  const cap = f.label ? x.t(f.label) : "";
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="gst-top">
        <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("A closer look", "ज़रा क़रीब से")} />
        <div className="gst-ctl">
          <button type="button" className="gx-round" data-flip="" onClick={() => go(cur - 1)} aria-label={x.ui("Previous photo", "पिछली फ़ोटो")}><Icon name="arrow-right" size={18} /></button>
          <button type="button" className="gx-round" onClick={() => go(cur + 1)} aria-label={x.ui("Next photo", "अगली फ़ोटो")}><Icon name="arrow-right" size={18} /></button>
        </div>
      </div>
      <div className="gst" role="group" aria-roledescription="carousel" aria-label={x.ui("Photos", "फ़ोटो")} onKeyDown={onKey}>
        <button
          type="button" className="gst-stage" key={f.url} onClick={() => { x.track("gallery-zoom"); x.zoom(urls, cur, cap || c.name); }}
          aria-label={x.ui(`Photo ${cur + 1} of ${n}: view larger`, `फ़ोटो ${cur + 1} / ${n}: बड़ी करके देखें`)}
        >
          <Photo src={f.url} alt="" sizes="(min-width:1200px) 1100px, 100vw" eager={cur === 0} />
          <span className="gst-no" aria-hidden="true">{pad2(cur + 1)} <i>/ {pad2(n)}</i></span>
          {cap && <span className="gst-cap">{cap}</span>}
        </button>
        <div ref={rail} className="gst-rail" role="tablist" aria-label={x.ui("Choose a photo", "फ़ोटो चुनें")}>
          {fr.map((q, i) => (
            <button
              key={q.url} type="button" role="tab" id={`${uid}-${i}`} aria-selected={i === cur} tabIndex={i === cur ? 0 : -1}
              className="gst-thumb" onClick={() => go(i)} aria-label={q.label ? x.t(q.label) : x.ui(`Photo ${i + 1}`, `फ़ोटो ${i + 1}`)}
            >
              <Photo src={q.url} alt="" sizes="120px" />
            </button>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* ================= PROOF ================= */

/* ---------- receipt ---------- */
export function ProofReceipt({ c, x, index }: VariantProps) {
  const r = reviewsOf(c, x);
  if (!r.total) return null;
  const items = r.all.slice(0, 4);
  const day = (x.hi ? "ग्राहक रिव्यू" : "CUSTOMER REVIEWS");
  return (
    <Sec k="proof" tone={index % 2 ? "alt" : "paper"} wide className="rcp-sec">
      <div className="rcp">
        <div className="rcp-words">
          <Head eyebrow={x.ui("Reviews", "रिव्यू")} title={x.ui("Itemised, and happy to show it", "पर्ची में सब दर्ज, और हमें गर्व है")} />
          <AvgLine r={r} x={x} />
          {x.wa && <p className="rcp-cta"><Btn kind="ghost" href={x.waHref(x.hi ? `नमस्ते ${c.name}, मैं अपना अनुभव बताना चाहता हूँ` : `Hi ${c.name}, I'd like to share my experience`)} external onClick={() => x.track("proof-share")}><Icon name="whatsapp" /> {x.ui("Share your experience", "अपना अनुभव बताएँ")}</Btn></p>}
        </div>
        <div className="rcp-wrap">
          <article className="rcp-paper" aria-label={x.ui("Customer reviews", "ग्राहकों के रिव्यू")}>
            <i className="rcp-edge" aria-hidden="true" />
            <div className="rcp-in mono">
              <p className="rcp-brand">{x.t(c.name)}</p>
              <p className="rcp-sub">{[c.city, day].filter(Boolean).join(" · ")}</p>
              <hr className="rcp-dash" />
              <ol className="rcp-lines">
                {items.map((q, i) => (
                  <li key={i}>
                    <div className="rcp-row"><span>{pad2(i + 1)} {q.name ? x.t(q.name) : x.ui("Customer", "ग्राहक")}</span><Stars n={q.rating} size={12} /></div>
                    <p>{x.t(q.text)}</p>
                  </li>
                ))}
              </ol>
              <hr className="rcp-dash" />
              {r.rated >= 1 && <p className="rcp-total"><span>{x.ui("AVERAGE", "औसत")}</span><b>{r.avg.toFixed(1)} / 5</b></p>}
              <p className="rcp-meta"><span>{x.ui("REVIEWS", "रिव्यू")}</span><span>{r.total}</span></p>
              <p className="rcp-thanks">{x.ui("THANK YOU - PLEASE VISIT AGAIN", "धन्यवाद - फिर पधारें")}</p>
              <i className="rcp-bars" aria-hidden="true" />
            </div>
            <i className="rcp-edge" data-end="" aria-hidden="true" />
          </article>
        </div>
      </div>
    </Sec>
  );
}

/* ---------- two opposing rows of cards ---------- */
export function ProofMarquee({ c, x, index }: VariantProps) {
  const r = reviewsOf(c, x);
  if (!r.total) return null;
  const list = r.all.slice(0, 10);
  // Two rows that do not show the same card at the same place: the second row starts half a lap in.
  const half = Math.ceil(list.length / 2);
  const second = list.length > 2 ? [...list.slice(half), ...list.slice(0, half)] : [...list].reverse();
  const card = (q: (typeof list)[number], k: string) => (
    <figure key={k} className="adv-card prm-card">
      <Stars n={q.rating} />
      <blockquote>{x.t(q.text)}</blockquote>
      {q.name && <figcaption><Mono name={q.name} /><span>{x.t(q.name)}</span></figcaption>}
    </figure>
  );
  return (
    <section id="adv-proof" data-sec="proof" data-tone={index % 2 ? "alt" : "paper"} data-reveal className="adv-sec prm">
      <div className="adv-wrap adv-wide prf-top">
        <Head eyebrow={x.ui("Reviews", "रिव्यू")} title={x.ui("People keep saying it", "लोग यही कहते हैं")} />
        <AvgLine r={r} x={x} />
      </div>
      {list.length < 3 ? (
        // One or two reviews would only repeat themselves in a ribbon: show them as still cards.
        <div className="prm-still">{list.map((q, i) => card(q, `s${i}`))}</div>
      ) : (<>
      <ul className="sr-only">{list.map((q, i) => <li key={i}>{q.name ? `${x.t(q.name)}: ` : ""}{x.t(q.text)}</li>)}</ul>
      <div className="prm-rows">
        <Rail items={list.map((q, i) => card(q, `a${i}`))} min={7} speed={70} />
        <Rail items={second.map((q, i) => card(q, `b${i}`))} min={7} speed={84} reverse />
      </div></>)}
    </section>
  );
}

/* ---------- spotlight ---------- */
export function ProofSpotlight({ c, x }: VariantProps) {
  const r = reviewsOf(c, x);
  const uid = useId();
  const [cur, setCur] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (!r.total) return null;
  const items = r.all.slice(0, 6);
  const n = items.length;
  const at = Math.min(cur, n - 1);
  const q = items[at];
  const pick = (i: number) => { const j = (i + n) % n; setCur(j); refs.current[j]?.focus(); };
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); pick(i + 1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); pick(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); pick(0); } else if (e.key === "End") { e.preventDefault(); pick(n - 1); }
  };
  const L = q.text.length;
  return (
    <Sec k="proof" tone="ink" wide>
      <div className="psp" data-n={n}>
        <div className="psp-main">
          <Eyebrow>{x.ui("Reviews", "रिव्यू")}</Eyebrow>
          <div className="psp-panel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t${at}`} aria-live="polite" key={at}>
            <span className="psp-qm" aria-hidden="true">&ldquo;</span>
            <blockquote data-l={L <= 120 ? "l" : L <= 240 ? "m" : "s"}>{x.t(q.text)}</blockquote>
            <p className="psp-by"><Stars n={q.rating} size={16} />{q.name && <span><Mono name={q.name} />{x.t(q.name)}</span>}</p>
          </div>
        </div>
        {n > 1 && <div className="psp-side">
          {r.rated >= 3 && <p className="psp-avg"><b>{r.avg.toFixed(1)}</b><Stars n={r.avg} size={14} /><span>{countLabel(x, r.total)}</span></p>}
          <div className="psp-list" role="tablist" aria-label={x.ui("Reviewers", "रिव्यू देने वाले")}>
            {items.map((it, i) => (
              <button
                key={i} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${uid}-t${i}`} aria-selected={i === at} aria-controls={`${uid}-p`}
                tabIndex={i === at ? 0 : -1} className="psp-tab" onClick={() => setCur(i)} onKeyDown={(e) => onKey(e, i)}
              >
                <Mono name={it.name || x.ui("Customer", "ग्राहक")} />
                <span className="psp-tx"><b>{it.name ? x.t(it.name) : x.ui("Customer", "ग्राहक")}</b><small>{x.t(it.text)}</small></span>
              </button>
            ))}
          </div>
        </div>}
      </div>
    </Sec>
  );
}

/* ================= TRUST ================= */

/* ---------- bento ---------- */
export function TrustBento({ c, x, index }: VariantProps) {
  if (c.facts.length < 2) return null;
  const n = Math.min(4, c.facts.length);
  return (
    <Sec k="trust" tone={index % 2 ? "alt" : "paper"} wide className="trv-sec" label={x.ui("In numbers", "एक नज़र में")}>
      <ul className="tbn" data-n={n}>
        {c.facts.slice(0, n).map((f, i) => (
          <li key={i} className="tbn-card" data-i={i} data-l={lenOf(f.value)}>
            <span className="tbn-ico"><Icon name={factIcon(f)} size={i === 0 ? 24 : 20} /></span>
            <span className="tbn-tx"><CountUp value={x.t(f.value)} className="tbn-num" /><span className="tbn-lab">{x.t(f.label)}</span></span>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

/* ---------- hairline ---------- */
export function TrustHairline({ c, x, index }: VariantProps) {
  if (c.facts.length < 2) return null;
  return (
    <Sec k="trust" tone={index % 2 ? "alt" : "paper"} wide className="trv-sec" label={x.ui("In numbers", "एक नज़र में")}>
      <ul className="thl" data-n={c.facts.length} style={css({ "--n": c.facts.length })}>
        {c.facts.map((f, i) => (
          <li key={i} className="thl-cell" data-l={lenOf(f.value)}>
            <span className="thl-top"><i aria-hidden="true">({pad2(i + 1)})</i><Icon name={factIcon(f)} size={18} /></span>
            <span className="thl-bot"><CountUp value={x.t(f.value)} className="thl-num" /><span className="thl-lab">{x.t(f.label)}</span></span>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

/* ================= CSS ================= */

export const PROOF_MORE_CSS = `
/* ---- gallery: scrapbook ---- */
.gsb-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s5)}
.gsb-top .adv-head{margin-bottom:0}
.gsb-count{margin:0;font-size:var(--t-meta);color:var(--muted);letter-spacing:.04em}
.gsb-count b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.2rem,5vw,3.4rem);line-height:1;color:var(--ink);margin-right:.2em;font-variant-numeric:lining-nums}
.gsb-board{margin-top:clamp(2rem,5vw,3.5rem);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s5) var(--s3);align-items:start}
.gsb-print:nth-child(even){margin-top:var(--s6)}
.gsb-print{position:relative;margin:0;padding:8px 8px 0;background:var(--paper);border:1px solid var(--line);border-radius:var(--r-img);box-shadow:var(--e-1);transition:transform .45s cubic-bezier(.2,.7,.2,1),box-shadow .45s}
.gsb-print::before{content:"";position:absolute;top:-9px;left:50%;width:64px;height:20px;margin-left:-32px;background:color-mix(in srgb,var(--accent) 22%,var(--paper-2));opacity:.88;transform:rotate(calc(var(--rot,0deg)*-1.6));z-index:2;box-shadow:0 1px 2px rgb(0 0 0/.08)}
.gsb-btn{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in}
.gsb-ph{display:block;aspect-ratio:var(--ar,4/5);overflow:hidden;border-radius:calc(var(--r-img)*.6);background:var(--paper-2)}
.gsb-ph .adv-photo{transition:transform .9s cubic-bezier(.2,.7,.2,1)}.gsb-btn:hover .adv-photo{transform:scale(1.04)}
.gsb-print figcaption{display:flex;align-items:baseline;gap:.7em;min-height:2.6rem;padding:.65rem .15rem .75rem;font-size:var(--t-meta);line-height:1.3;color:var(--muted)}
.gsb-print figcaption b{font-family:var(--font-display);font-weight:var(--display-w);font-size:1.15rem;color:var(--accent);font-variant-numeric:lining-nums}
.gsb-print figcaption span{color:var(--ink);font-weight:500}
@media (min-width:768px){
.gsb-board{grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:var(--s6) var(--s5)}
.gsb-print:nth-child(even){margin-top:0}
.gsb-print:nth-child(3n+2){margin-top:var(--s7)}.gsb-print:nth-child(3n){margin-top:var(--s5)}
.gsb-board[data-cols="4"] .gsb-print:nth-child(n){margin-top:0}.gsb-board[data-cols="4"] .gsb-print:nth-child(4n+2){margin-top:var(--s7)}.gsb-board[data-cols="4"] .gsb-print:nth-child(4n+4){margin-top:var(--s6)}
.gsb-print{transform:rotate(var(--rot,0deg))}
.gsb-print:hover,.gsb-print:focus-within{transform:rotate(0deg) translateY(-6px) scale(1.015);box-shadow:0 18px 40px rgb(0 0 0/.14);z-index:3}
}

/* ---- gallery: rooms (hairline grid) ---- */
.grm{--g:1px;list-style:none;margin:0;padding:var(--g);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--g);background:var(--line);border:1px solid var(--line)}
.grm-cell{min-width:0;background:var(--paper);display:flex}
.adv-sec[data-tone=alt] .grm-cell{background:var(--paper)}
.grm-btn{position:relative;display:flex;flex-direction:column;width:100%;padding:var(--s3);border:0;background:none;color:var(--ink);text-align:left;cursor:zoom-in;font:inherit}
.grm-ph{display:block;position:relative;flex:1;aspect-ratio:1;overflow:hidden;background:var(--paper-2);border-radius:var(--r-img)}
.grm-ph .adv-photo{transition:transform 1s cubic-bezier(.2,.7,.2,1)}.grm-btn:hover .adv-photo,.grm-btn:focus-visible .adv-photo{transform:scale(1.05)}
.grm-cap{display:flex;align-items:center;gap:.7em;min-height:2.75rem;padding:var(--s3) .1rem .1rem;font-size:var(--t-meta);font-weight:500;line-height:1.3}
.grm-cap i{font-style:normal;font-variant-numeric:tabular-nums lining-nums;letter-spacing:.06em;color:var(--muted)}
.grm-cap span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grm-cap svg{flex:none;opacity:0;transform:translate(-4px,4px);transition:opacity .25s,transform .25s;color:var(--accent)}
.grm-btn:hover .grm-cap svg,.grm-btn:focus-visible .grm-cap svg{opacity:1;transform:none}
@media (hover:none){.grm-cap svg{opacity:1;transform:none}}
.grm-more{position:absolute;z-index:2;inset:0;display:grid;place-items:center;background:color-mix(in srgb,var(--hero-ink) 62%,transparent);color:var(--hero-text);font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.8rem,5vw,3rem);letter-spacing:var(--display-tr);font-variant-numeric:lining-nums}
.grm[data-big] .grm-cell[data-lead]{grid-column:1 / -1}
.grm[data-big] .grm-cell[data-lead] .grm-ph{aspect-ratio:4/3}
.grm-head{margin-bottom:0}
.grm[data-n="3"] .grm-cell:last-child{grid-column:1 / -1}
@media (min-width:768px){
.grm{grid-template-columns:repeat(4,minmax(0,1fr))}
.grm[data-n="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.grm[data-n="3"] .grm-cell:last-child{grid-column:auto}
.grm[data-big] .grm-cell[data-lead]{grid-column:span 2;grid-row:span 2}
.grm[data-big] .grm-cell[data-lead] .grm-ph{aspect-ratio:auto;min-height:320px}
}

/* ---- gallery: pinned reel ---- */
.grl{padding-block:0;overflow:visible}
.grl-stage{display:flex;flex-direction:column;justify-content:center;gap:clamp(1.25rem,3vw,2rem);padding-block:clamp(4rem,9vw,7rem)}
.grl-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s5)}
.grl-top .adv-head{margin-bottom:0}
.grl-count{margin:0;display:flex;align-items:baseline;gap:.5rem;color:var(--muted);font-variant-numeric:tabular-nums lining-nums}
.grl-count b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.6rem,6vw,4.4rem);line-height:1;color:var(--ink)}
.grl-count i{font-style:normal;font-size:var(--t-meta)}
.grl-view{overflow-x:auto;scrollbar-width:none;scroll-snap-type:x proximity;padding-inline:var(--gutter);overscroll-behavior-x:contain}
.grl-view::-webkit-scrollbar{display:none}
.grl-track{display:flex;gap:var(--s4);width:max-content;will-change:transform}
.grl-track .grl-frame{--fh:clamp(280px,56vw,520px);flex:none;width:calc(var(--fh) * var(--ar,.8));max-width:84vw;height:var(--fh);scroll-snap-align:start}
.grl-prog{display:block;height:2px;border-radius:2px;background:var(--line);overflow:hidden}
.grl-prog i{display:block;height:100%;background:var(--accent);transform-origin:left;transform:scaleX(.04)}
.grl[data-pin]{height:var(--reel-h,auto)}
.grl[data-pin] .grl-stage{position:sticky;top:0;height:100vh;height:100svh;padding-block:calc(72px + var(--s4)) var(--s6);box-sizing:border-box}
.grl[data-pin] .grl-view{overflow:hidden;scroll-snap-type:none;pointer-events:none}
.grl[data-pin] .grl-view .gx-tile{pointer-events:auto}
.grl[data-pin] .grl-track .grl-frame{--fh:clamp(220px,calc(100svh - 360px),560px)}
.grl[data-pin] .grl-prog i{transition:none}
.grl:not([data-pin]) .grl-prog{display:none}
@media (prefers-reduced-motion:reduce){.grl[data-pin]{height:auto}}

/* ---- gallery: stage ---- */
.gst-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s5)}
.gst-top .adv-head{margin-bottom:0}
.gst-ctl{display:flex;gap:var(--s3)}
.gst{margin-top:clamp(1.75rem,4vw,2.75rem);display:grid;gap:var(--s3)}
.gst-stage{position:relative;display:block;width:100%;aspect-ratio:4/3;padding:0;border:0;overflow:hidden;border-radius:var(--r-tile);background:var(--paper-2);cursor:zoom-in;color:var(--hero-text);animation:gst-in .6s cubic-bezier(.2,.7,.2,1)}
.gst-stage .adv-photo{transition:transform 1.4s cubic-bezier(.2,.7,.2,1)}.gst-stage:hover .adv-photo{transform:scale(1.03)}
.gst-no{position:absolute;top:var(--s4);right:var(--s4);padding:.35em .85em;border-radius:var(--r-pill);background:color-mix(in srgb,var(--hero-ink) 58%,transparent);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums lining-nums;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.gst-no i{font-style:normal;opacity:.7;font-weight:500}
.gst-cap{position:absolute;inset:auto 0 0 0;padding:3.5rem var(--s5) var(--s5);background:linear-gradient(transparent,var(--scrim-bot));font-size:clamp(1rem,2vw,1.25rem);font-weight:500;line-height:1.35;text-align:left}
.gst-rail{display:flex;gap:var(--s2);overflow-x:auto;scrollbar-width:none;padding:3px}
.gst-rail::-webkit-scrollbar{display:none}
.gst-thumb{position:relative;flex:none;width:clamp(72px,16vw,112px);aspect-ratio:4/3;padding:0;border:0;border-radius:var(--r-img);overflow:hidden;background:var(--paper-2);cursor:pointer;opacity:.5;transition:opacity .25s,transform .25s}
.gst-thumb:hover{opacity:.85}
.gst-thumb[aria-selected=true]{opacity:1;outline:2px solid var(--accent);outline-offset:2px}
@keyframes gst-in{from{opacity:.4}}
@media (min-width:900px){.gst-stage{aspect-ratio:21/10}}

/* ---- proof: receipt ---- */
.rcp-sec{overflow:hidden}
.rcp{display:grid;gap:clamp(2rem,5vw,4rem);align-items:center}
.rcp-words .adv-head{margin-bottom:var(--s5)}
.rcp-cta{margin:var(--s5) 0 0}
.rcp-wrap{display:flex;justify-content:center}
.rcp-paper{position:relative;width:min(100%,25rem);color:#1c1a17;filter:drop-shadow(0 18px 30px rgb(0 0 0/.16)) drop-shadow(0 2px 3px rgb(0 0 0/.1));transform:rotate(1.2deg)}
.rcp-edge{display:block;height:10px;background:#fbf8f1;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='10'%3E%3Cpath d='M0 10 10 0 20 10Z'/%3E%3C/svg%3E") repeat-x bottom/20px 10px;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='10'%3E%3Cpath d='M0 10 10 0 20 10Z'/%3E%3C/svg%3E") repeat-x bottom/20px 10px}
.rcp-edge[data-end]{transform:scaleY(-1)}
.rcp-in{background:#fbf8f1;padding:var(--s5) clamp(1.25rem,4vw,1.75rem);font-size:12.5px;line-height:1.55;letter-spacing:.01em}
.rcp-brand{margin:0;text-align:center;font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.rcp-sub{margin:.35rem 0 0;text-align:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b655b}
.rcp-dash{margin:var(--s4) 0;border:0;border-top:1.5px dashed #b9b2a4}
.rcp-lines{list-style:none;margin:0;padding:0;display:grid;gap:var(--s4)}
.rcp-row{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:11.5px}
.rcp-row .adv-stars{color:#b45309}
.rcp-lines p{margin:.3rem 0 0;color:#3b372f;text-wrap:pretty}
.rcp-total{display:flex;align-items:baseline;justify-content:space-between;margin:0;font-size:15px;font-weight:700;letter-spacing:.08em}
.rcp-total b{font-size:22px;letter-spacing:0}
.rcp-meta{display:flex;justify-content:space-between;margin:.3rem 0 0;font-size:11.5px;letter-spacing:.08em;color:#6b655b}
.rcp-thanks{margin:var(--s5) 0 0;text-align:center;font-size:11px;font-weight:700;letter-spacing:.16em}
.rcp-bars{display:block;height:38px;margin:var(--s4) auto 0;width:78%;background:repeating-linear-gradient(90deg,#1c1a17 0 2px,transparent 2px 4px,#1c1a17 4px 5px,transparent 5px 9px,#1c1a17 9px 12px,transparent 12px 14px)}
.site:lang(hi) .rcp-in{font-size:13.5px;line-height:1.7}
@media (min-width:900px){.rcp{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}.rcp-wrap{justify-content:flex-end}}
@media (prefers-reduced-motion:reduce){.rcp-paper{transform:none}}

/* ---- proof: opposing marquees ---- */
.prm{overflow:hidden}
.prm-rows{display:grid;gap:var(--s4);margin-top:clamp(2rem,5vw,3.5rem);--rl-gap:var(--s4)}
.prm-card{width:clamp(17rem,78vw,23rem);margin:0;padding:var(--s5);display:flex;flex-direction:column;gap:var(--s4);white-space:normal;align-self:stretch}
.prm-card blockquote{margin:0;font-family:var(--font-display);font-weight:400;font-size:1.1rem;line-height:1.42;text-wrap:pretty;display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden}
.site:lang(hi) .prm-card blockquote{line-height:1.65}
.prm-card figcaption{margin-top:auto;display:flex;align-items:center;gap:var(--s3);font-size:var(--t-meta);font-weight:600;color:var(--muted)}
.prm-still{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--s4);margin-top:clamp(2rem,5vw,3.5rem);padding-inline:var(--gutter)}
.prm .rl-copy{align-items:stretch}.prm .rl-set>li{align-items:stretch}
@media (prefers-reduced-motion:reduce){.prm-rows .rl-copy{padding-inline:var(--gutter)}}

/* ---- proof: spotlight ---- */
.psp{display:grid;gap:clamp(1.75rem,4vw,3rem)}
.psp[data-n="1"] .psp-panel{max-width:52rem}
.psp-panel{margin-top:var(--s5);animation:psp-in .55s cubic-bezier(.2,.7,.2,1)}
@keyframes psp-in{from{opacity:0;transform:translateY(10px)}}
.psp-qm{display:block;height:clamp(2.6rem,6vw,4.4rem);font-family:var(--font-display);font-size:clamp(5rem,12vw,9rem);line-height:.9;color:var(--accent)}
.psp-panel blockquote{margin:var(--s4) 0 0;font-family:var(--font-display);font-weight:var(--display-w);line-height:1.12;letter-spacing:var(--display-tr);text-wrap:balance;font-size:clamp(1.3rem,3vw,2rem);color:var(--ink)}
.psp-panel blockquote[data-l=l]{font-size:clamp(1.9rem,5vw,3.6rem);line-height:1.05}.psp-panel blockquote[data-l=m]{font-size:clamp(1.5rem,3.6vw,2.5rem)}
.site:lang(hi) .psp-panel blockquote{line-height:1.45;letter-spacing:0;font-weight:var(--display-w-hi)}
.psp-by{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5);margin:var(--s5) 0 0}
.psp .adv-stars,.prf-feat .adv-stars{color:color-mix(in srgb,var(--accent) 55%,var(--hero-text))}
.psp-by>span{display:inline-flex;align-items:center;gap:var(--s3);font-size:var(--t-meta);font-weight:600;color:var(--muted)}
.psp-avg{display:flex;align-items:center;gap:var(--s3);margin:0 0 var(--s4);font-size:var(--t-meta);color:var(--muted)}
.psp-avg b{font-family:var(--font-display);font-weight:var(--display-w);font-size:2rem;line-height:1;color:var(--ink);font-variant-numeric:lining-nums tabular-nums}
.psp-list{display:grid;gap:var(--s2)}
.psp-tab{display:flex;align-items:center;gap:var(--s3);width:100%;padding:var(--s3) var(--s4);border:1px solid var(--line);border-radius:var(--r-card);background:transparent;color:var(--ink);text-align:left;font:inherit;cursor:pointer;transition:background .25s,border-color .25s}
.psp-tab:hover{border-color:color-mix(in srgb,var(--ink) 40%,var(--line))}
.psp-tab[aria-selected=true]{background:color-mix(in srgb,var(--ink) 9%,transparent);border-color:var(--accent)}
.psp-tx{display:grid;min-width:0;gap:1px}
.psp-tx b{font-size:var(--t-meta);font-weight:600}
.psp-tx small{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.psp-tab .prf-av{flex:none}
@media (min-width:900px){.psp{grid-template-columns:minmax(0,7fr) minmax(16rem,4fr);gap:clamp(2.5rem,6vw,5rem);align-items:start}.psp-side{padding-top:var(--s7)}}

/* ---- trust: bento ---- */
.tbn{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3);list-style:none;margin:0;padding:0}
.tbn-card{position:relative;display:flex;flex-direction:column;justify-content:space-between;gap:var(--s6);min-height:clamp(9rem,26vw,12rem);padding:clamp(1.1rem,3vw,1.75rem);border-radius:var(--r-tile);background:var(--paper-2);border:1px solid var(--line);color:var(--ink);overflow:hidden;transition:transform .4s cubic-bezier(.2,.7,.2,1)}
.tbn-card:hover{transform:translateY(-4px)}
.adv-sec[data-tone=alt] .tbn-card{background:var(--paper)}
.tbn .tbn-card[data-i="0"]{grid-column:1 / -1;background:var(--accent);border-color:transparent;color:var(--on-accent);min-height:clamp(12rem,40vw,18rem)}
.tbn .tbn-card[data-i="1"]{background:var(--hero-ink);border-color:transparent;color:var(--hero-text)}
.tbn-ico{display:grid;place-items:center;width:44px;height:44px;border-radius:999px;background:color-mix(in srgb,currentColor 12%,transparent)}
.tbn-num{display:block;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.1rem,7vw,3.4rem);line-height:.95;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums;color:inherit}
.tbn-card[data-i="0"] .tbn-num{font-size:clamp(3.4rem,15vw,8rem)}
.tbn-card[data-l=m] .tbn-num{font-size:clamp(1.7rem,5.4vw,2.6rem)}.tbn-card[data-l=l] .tbn-num{font-size:clamp(1.4rem,4.4vw,2rem)}
.tbn-card[data-i="0"][data-l=m] .tbn-num{font-size:clamp(2.6rem,10vw,5.5rem)}.tbn-card[data-i="0"][data-l=l] .tbn-num{font-size:clamp(2rem,7vw,3.6rem)}
.tbn-lab{display:block;margin-top:.6rem;font-size:var(--t-meta);line-height:1.4;opacity:.8}
.tbn-card[data-i="0"] .tbn-lab{font-size:clamp(.95rem,2vw,1.15rem);opacity:.9}
.tbn[data-n="3"] .tbn-card[data-i="2"],.tbn[data-n="4"] .tbn-card[data-i="3"]{grid-column:1 / -1}
.tbn[data-n="2"] .tbn-card[data-i="0"]{grid-column:auto}
@media (min-width:900px){
.tbn{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,minmax(11rem,auto));gap:var(--s4)}
.tbn .tbn-card[data-i="0"]{grid-column:span 2;grid-row:span 2;min-height:0}
.tbn .tbn-card[data-i="1"]{grid-column:span 2}
.tbn[data-n="3"] .tbn-card[data-i="2"]{grid-column:span 2}
.tbn[data-n="4"] .tbn-card[data-i="3"]{grid-column:auto}
.tbn[data-n="2"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(16rem,auto)}
.tbn[data-n="2"] .tbn-card[data-i="0"]{grid-column:auto;grid-row:auto}.tbn[data-n="2"] .tbn-card[data-i="1"]{grid-column:auto}
}

/* ---- trust: hairline ---- */
.thl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;gap:1px;background:var(--line)}
.thl-cell{display:flex;flex-direction:column;justify-content:space-between;gap:var(--s6);min-height:clamp(10rem,32vw,13rem);padding:clamp(1rem,3vw,1.75rem);background:var(--paper);transition:background .35s}
.adv-sec[data-tone=alt] .thl-cell{background:var(--paper)}
.thl-cell:hover{background:var(--accent-soft)}
.thl-top{display:flex;align-items:center;justify-content:space-between;color:var(--muted)}
.thl-top i{font-style:normal;font-size:12px;font-weight:600;letter-spacing:.1em;font-variant-numeric:tabular-nums lining-nums}
.thl-top svg{color:var(--accent)}
.thl-num{display:block;font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.2rem,8vw,4.6rem);line-height:.95;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums;color:var(--ink)}
.thl-cell[data-l=m] .thl-num{font-size:clamp(1.8rem,6vw,3.2rem)}.thl-cell[data-l=l] .thl-num{font-size:clamp(1.4rem,4.6vw,2.2rem)}
.thl-lab{display:block;margin-top:.6rem;font-size:var(--t-meta);line-height:1.4;color:var(--muted)}
.thl[data-n="3"] .thl-cell:last-child{grid-column:1 / -1}
@media (min-width:900px){.thl{grid-template-columns:repeat(var(--n,4),minmax(0,1fr))}.thl[data-n="3"] .thl-cell:last-child{grid-column:auto}.thl-cell{min-height:15rem}}
`;
