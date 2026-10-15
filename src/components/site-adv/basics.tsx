"use client";
// The first (default) variant of every section that has no richer one yet: trust, services, gallery, proof, process, faq,
// visit, cta, footer. Complete and correct on their own, so a spec always renders end to end; a designer adds more
// variants beside these (registry.ts slots) and the AI/seed picks among them. Kept plain on purpose.
import { Download } from "lucide-react";
import { CountUp, Wordmark } from "@/components/site-smart";
import { Icon } from "@/components/site-icons";
import { LinkIcon, linkHref } from "@/components/link-icon";
import { Pic } from "@/components/pic";
import { Btn, H2, Head, Photo, Sec, Stars, type VariantProps } from "@/components/site-adv/shared";

/* ---------- trust: the card's own numbers in one ruled row ---------- */
export function TrustStrip({ c, x }: VariantProps) {
  return (
    <section id="adv-trust" data-sec="trust" data-reveal className="atr" aria-label={x.ui("In numbers", "एक नज़र में")}>
      <ul className="adv-wrap atr-list">
        {c.facts.map((f, i) => (
          <li key={i}><CountUp value={x.t(f.value)} className="atr-num" /><span>{x.t(f.label)}</span></li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- services: products or services as a grid ---------- */
export function ServicesGrid({ c, x, index }: VariantProps) {
  const o = c.offerings; if (!o) return null;
  const products = o.kind === "products";
  const imgs = o.items.map((it) => it.images[0]).filter((u): u is string => !!u);
  return (
    <Sec k="services" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={products ? x.ui("Products", "प्रोडक्ट") : x.ui("Services", "सेवाएँ")} title={x.t(o.title)} />
      <div className={products ? "asv-grid" : "asv-rows"}>
        {o.items.map((it, i) => {
          const ask = x.waHref(x.hi ? `नमस्ते ${c.name}, मुझे "${it.name}" के बारे में जानना है` : `Hi ${c.name}, I'd like to know about "${it.name}"`);
          return products ? (
            <article key={i} className="adv-card adv-lift asv-item">
              <button type="button" className="asv-img" onClick={() => it.images.length && x.zoom(imgs, Math.max(0, imgs.indexOf(it.images[0])), it.name)} aria-label={x.t(it.name)} disabled={!it.images.length}>
                <Photo src={it.images[0]} alt={x.t(it.name)} fallback={it.name} sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw" eager={i < 3} />
                {it.badge && <span className="asv-badge">{x.t(it.badge)}</span>}
              </button>
              <div className="asv-info">
                <h3 className="asv-name">{x.t(it.name)}</h3>
                {it.desc && <p className="asv-desc">{x.t(it.desc)}</p>}
                <div className="asv-foot">
                  {it.price && <p className="asv-price">{it.price}{it.mrp && <s>{it.mrp}</s>}</p>}
                  <div className="adv-btn-row">
                    {x.wa && <a href={ask} target="_blank" rel="noreferrer" className="btn-link" onClick={() => x.track("product-ask")}><Icon name="whatsapp" /> {x.ui("Ask", "पूछें")}</a>}
                    {it.slug && x.goto && <a href={x.hrefFor(it.slug)} className="btn-link" onClick={(e) => { e.preventDefault(); x.goto!(it.slug!); }}>{x.ui("Details", "डिटेल")} <Icon name="arrow-right" /></a>}
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <article key={i} className="asv-row">
              <span className="asv-no">{String(i + 1).padStart(2, "0")}</span>
              <div><h3 className="asv-name">{x.t(it.name)}</h3>{it.desc && <p className="asv-desc">{x.t(it.desc)}</p>}</div>
            </article>
          );
        })}
      </div>
      {o.total > o.items.length && x.wa && (
        <p className="asv-more"><a href={x.waHref()} target="_blank" rel="noreferrer" className="btn-link" onClick={() => x.track("services-more")}>{x.hi ? `और ${o.total - o.items.length} देखने के लिए पूछें` : `${o.total - o.items.length} more - ask us`} <Icon name="arrow-right" /></a></p>
      )}
    </Sec>
  );
}

/* ---------- gallery: one large tile and a ring of small ones ---------- */
export function GalleryMosaic({ c, x, index }: VariantProps) {
  const urls = c.gallery.map((g) => g.url);
  return (
    <Sec k="gallery" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("Gallery", "फ़ोटो")} title={x.ui("A look inside", "एक झलक")} />
      <div className="agl">
        {c.gallery.map((g, i) => (
          <button key={g.url} type="button" className="agl-tile" data-big={i === 0 ? "" : undefined} onClick={() => x.zoom(urls, i, g.label || c.name)} aria-label={g.label || x.ui("Open photo", "फ़ोटो खोलें")}>
            <Photo src={g.url} alt={g.label} sizes={i === 0 ? "(min-width: 900px) 50vw, 100vw" : "(min-width: 900px) 25vw, 50vw"} />
          </button>
        ))}
      </div>
    </Sec>
  );
}

/* ---------- proof: up to three reviews as quote cards ---------- */
export function ProofCards({ c, x, index }: VariantProps) {
  const r = c.reviews;
  return (
    <Sec k="proof" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="apr-head">
        <Head eyebrow={x.ui("Reviews", "रिव्यू")} title={x.ui("What customers say", "ग्राहक क्या कहते हैं")} />
        {r.total >= 3 && (
          <p className="apr-avg"><b>{r.avg.toFixed(1)}</b><Stars n={r.avg} size={16} /><span>{x.hi ? `${r.total} रिव्यू` : `${r.total} reviews`}</span></p>
        )}
      </div>
      <div className="apr-grid">
        {r.items.map((q, i) => (
          <figure key={i} className="adv-card adv-lift apr-card">
            <Stars n={q.rating} />
            <blockquote>{x.t(q.text)}</blockquote>
            {q.name && <figcaption>{x.t(q.name)}</figcaption>}
          </figure>
        ))}
      </div>
    </Sec>
  );
}

/* ---------- process: numbered steps in a row ---------- */
export function ProcessSteps({ c, x, index }: VariantProps) {
  return (
    <Sec k="process" tone={index % 2 ? "alt" : "paper"} wide>
      <Head eyebrow={x.ui("How it works", "कैसे काम करते हैं")} title={x.ui("Simple, in steps", "आसान, कुछ ही कदम में")} />
      <ol className="apc">
        {c.steps.map((s, i) => (
          <li key={i}><span className="apc-no">{String(i + 1).padStart(2, "0")}</span><h3>{x.t(s.name)}</h3>{s.desc && <p>{x.t(s.desc)}</p>}</li>
        ))}
      </ol>
    </Sec>
  );
}

/* ---------- faq: questions that open ---------- */
export function FaqAccordion({ c, x, index }: VariantProps) {
  return (
    <Sec k="faq" tone={index % 2 ? "alt" : "paper"}>
      <div className="afq">
        <Head eyebrow="FAQ" title={x.ui("Questions, answered", "आपके सवाल, हमारे जवाब")} />
        <div className="afq-list">
          {c.faq.map((f, i) => (
            <details key={i}><summary>{x.t(f.q)}<Icon name="chevron-down" /></summary><p>{x.t(f.a)}</p></details>
          ))}
        </div>
      </div>
    </Sec>
  );
}

/* ---------- visit: address, buttons and timings ---------- */
export function VisitSplit({ c, x, index }: VariantProps) {
  const v = c.visit; if (!v) return null;
  const dir = v.mapUrl || (v.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address)}` : "");
  return (
    <Sec k="visit" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="avs">
        <div>
          <Head eyebrow={x.ui("Visit us", "हमसे मिलें")} title={c.city ? (x.hi ? `${c.city} में हमसे मिलें` : `Find us in ${c.city}`) : x.ui("Come and see us", "आइए, मिलिए")} />
          {v.address && <p className="avs-addr"><Icon name="pin" size={20} /><span>{x.t(v.address)}</span></p>}
          <div className="adv-btn-row avs-btns">
            {dir && <Btn href={dir} external onClick={() => x.track("visit-directions")}><Icon name="directions" /> {x.ui("Get directions", "रास्ता देखें")}</Btn>}
            {x.phone && <Btn kind="ghost" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("visit-call")}><Icon name="phone" /> {x.ui("Call", "कॉल करें")}</Btn>}
          </div>
        </div>
        {v.hours.length > 0 && (
          <div className="adv-card avs-hours">
            <p className="kicker">{x.ui("Timings", "समय")}</p>
            <table><tbody>{v.hours.map((r, i) => <tr key={i}><td>{x.t(r.day)}</td><td>{x.t(r.time)}</td></tr>)}</tbody></table>
          </div>
        )}
      </div>
    </Sec>
  );
}

/* ---------- cta: the closing ink band ---------- */
export function CtaBand({ c, x }: VariantProps) {
  return (
    <Sec k="cta" tone="ink" wide>
      <div className="acb">
        <div>
          <H2>{x.ui("Talk to us today", "आज ही बात करें")}</H2>
          <p className="adv-lede">{x.t(x.card.tagline || x.ui("Usually replies within a few hours on WhatsApp.", "आमतौर पर कुछ घंटों में WhatsApp पर जवाब।"))}</p>
        </div>
        <div className="adv-btn-row">
          {x.wa && <Btn href={x.waHref()} external data-kind="whatsapp" onClick={() => x.track("cta-whatsapp")}><Icon name="whatsapp" /> {x.t(x.card.site?.hero?.ctaLabel || c.hm.primary.label)}</Btn>}
          {x.phone && <Btn kind="link" href={linkHref(x.phone.type, x.phone.value)} onClick={() => x.track("cta-phone")}>{x.ui("Call", "कॉल करें")} <Icon name="arrow-right" /></Btn>}
        </div>
      </div>
    </Sec>
  );
}

/* ---------- footer: wordmark + blurb + QR, the ways to reach, the timings, the copyright line ---------- */
export function FooterColumns({ c, x }: VariantProps) {
  const { card } = x;
  const digits = (v: string) => (v ?? "").replace(/\D/g, "").slice(-10);
  const same = !!x.wa && !!x.phone && digits(x.wa.value) === digits(x.phone.value);
  const links = card.links.filter((l) => l.value.trim() && !(same && l.type === "phone"));
  const blurb = (card.tagline ?? "").trim() || (card.about ?? "").trim().replace(/\s+/g, " ").slice(0, 180);
  const v = c.visit;
  return (
    <footer id="adv-footer" data-sec="footer" className="hero-dark aft">
      <div className="adv-wrap adv-wide aft-grid">
        <div>
          {c.hm.logo ? <Pic src={c.hm.logo} alt="" className="aft-logo" w={180} /> : <Wordmark name={x.t(c.name)} trade={x.t(c.trade)} lang={x.lang} className="aft-mark" />}
          {blurb && <p className="aft-blurb">{x.t(blurb)}</p>}
          {card.gstin?.trim() && <p className="aft-small mono">GSTIN {card.gstin.trim()}</p>}
          <div className="aft-qr">
            {x.qr && <Pic src={x.qr} alt="QR code" className="aft-qrimg" w={80} />}
            <div>
              {x.qr && <p className="aft-small">{x.t("Scan to open this site on your phone")}</p>}
              {x.shareUrl && <p className="aft-small mono">{x.shareUrl.replace(/^https?:\/\//, "")}</p>}
              <div className="adv-btn-row">
                <a href={`/c/${card.username}/vcf`} className="btn-ghost btn-xs" onClick={() => x.track("vcard")}><Download size={14} /> {x.t("Save contact")}</a>
                <a href="?view=card" className="btn-ghost btn-xs">{x.t("Digital card")}</a>
              </div>
            </div>
          </div>
        </div>
        <div>
          <p className="kicker">{x.t("Contact")}</p>
          <ul className="aft-list">
            {links.map((l) => (
              <li key={l.id}>
                {l.type === "upi"
                  // upi:// does nothing in a desktop browser: the ID is shown as text.
                  ? <span><LinkIcon type={l.type} className="h-4 w-4" /> {l.value}</span>
                  : <a href={l.type === "whatsapp" ? x.waHref() : linkHref(l.type, l.value)} target="_blank" rel="noreferrer" onClick={() => x.track(`footer-${l.type}`)}>
                    <LinkIcon type={l.type} className="h-4 w-4" /><span>{l.value || l.label}</span>{same && l.type === "whatsapp" && <small>· {x.t("WhatsApp & call")}</small>}
                  </a>}
              </li>
            ))}
          </ul>
        </div>
        {v && (v.address || v.hours.length > 0) && (
          <div>
            <p className="kicker">{x.ui("Visit us", "हमसे मिलें")}</p>
            {v.address && <p className="aft-addr">{x.t(v.address)}</p>}
            {v.hours.length > 0 && <table className="aft-hours"><tbody>{v.hours.map((r, i) => <tr key={i}><td>{x.t(r.day)}</td><td>{x.t(r.time)}</td></tr>)}</tbody></table>}
          </div>
        )}
      </div>
      <div className="aft-legal-wrap">
        <div className="adv-wrap adv-wide aft-legal">
          <span>© {new Date().getFullYear()} {x.t(c.name)}. {x.hi ? "सर्वाधिकार सुरक्षित।" : "All rights reserved."}</span>
          <span className="mono">{x.brand ? (x.brand.hideBranding ? "" : `Powered by ${x.brand.name}`) : "Powered by Shubhora"}</span>
        </div>
      </div>
    </footer>
  );
}

export const BASICS_CSS = `
.atr{border-block:1px solid var(--line);background:var(--paper)}
.atr-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s5) var(--s4);list-style:none;margin:0 auto;padding-block:clamp(1.5rem,4vw,2.5rem)}
.atr-list li{display:flex;flex-direction:column;gap:.35rem}
.atr-num{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(1.7rem,4.4vw,2.8rem);line-height:1;letter-spacing:var(--display-tr);font-variant-numeric:lining-nums tabular-nums;color:var(--ink)}
.atr-list span:not(.atr-num){font-size:var(--t-meta);color:var(--muted)}
@media (min-width:768px){.atr-list{grid-template-columns:repeat(auto-fit,minmax(0,1fr))}.atr-list li+li{border-left:1px solid var(--line);padding-left:var(--s5)}}

.asv-grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))}
.asv-item{display:flex;flex-direction:column}
.asv-img{position:relative;display:block;aspect-ratio:4/5;padding:0;border:0;background:var(--paper-2);cursor:zoom-in;overflow:hidden}
.asv-img:disabled{cursor:default}
.asv-badge{position:absolute;top:var(--s3);left:var(--s3);padding:.3em .75em;border-radius:var(--r-pill);background:var(--accent);color:var(--on-accent);font-size:12px;font-weight:600}
.asv-info{display:flex;flex-direction:column;gap:var(--s2);padding:var(--s4) var(--s4) var(--s5);flex:1}
.asv-name{font-family:var(--font-text);font-size:1.0625rem;font-weight:600;line-height:1.3}
.asv-desc{margin:0;font-size:var(--t-meta);line-height:1.5;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.asv-foot{margin-top:auto;padding-top:var(--s3);display:flex;flex-direction:column;gap:var(--s2)}
.asv-price{margin:0;font-size:1.0625rem;font-weight:600;font-variant-numeric:tabular-nums lining-nums}.asv-price s{margin-left:.6em;font-weight:400;font-size:.85em;color:var(--muted)}
.asv-rows{display:grid;gap:0 var(--s7);border-top:1px solid var(--line)}
.asv-row{display:flex;gap:var(--s4);padding:var(--s5) 0;border-bottom:1px solid var(--line)}
.asv-no{font-family:var(--font-display);font-size:1.5rem;color:var(--accent);min-width:2.2ch;font-variant-numeric:lining-nums}
.asv-more{margin:var(--s5) 0 0}
@media (min-width:900px){.asv-rows{grid-template-columns:1fr 1fr}}

.agl{display:grid;gap:var(--s2);grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(0,1fr)}
.agl-tile{position:relative;padding:0;border:0;overflow:hidden;aspect-ratio:1;border-radius:var(--r-img);background:var(--paper-2);cursor:zoom-in}
.agl-tile[data-big]{grid-column:span 2;aspect-ratio:16/10}
.agl-tile .adv-photo{transition:transform .6s cubic-bezier(.2,.7,.2,1)}.agl-tile:hover .adv-photo{transform:scale(1.04)}
@media (min-width:900px){.agl{grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s3)}.agl-tile[data-big]{grid-column:span 2;grid-row:span 2;aspect-ratio:auto}}

.apr-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:var(--s5)}
.apr-avg{display:flex;align-items:center;gap:var(--s3);margin:0 0 clamp(2rem,5vw,3.5rem);font-size:var(--t-meta);color:var(--muted)}
.apr-avg b{font-family:var(--font-display);font-weight:var(--display-w);font-size:clamp(2.2rem,5vw,3.4rem);line-height:1;color:var(--ink)}
.apr-grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.apr-card{margin:0;padding:var(--s5);display:flex;flex-direction:column;gap:var(--s4)}
.apr-card blockquote{margin:0;font-family:var(--font-display);font-weight:400;font-size:clamp(1.1rem,2vw,1.35rem);line-height:1.4;text-wrap:pretty}
.site:lang(hi) .apr-card blockquote{line-height:1.6}
.apr-card figcaption{margin-top:auto;font-size:var(--t-meta);font-weight:600;color:var(--muted)}

.apc{display:grid;gap:var(--s6) var(--gap);list-style:none;margin:0;padding:0;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
.apc li{border-top:2px solid var(--ink);padding-top:var(--s4)}
.apc-no{display:block;font-family:var(--font-display);font-size:clamp(2rem,4vw,3rem);line-height:1;color:var(--accent);font-variant-numeric:lining-nums}
.apc h3{margin-top:var(--s3);font-family:var(--font-text);font-size:1.0625rem;font-weight:600}
.apc p{margin:var(--s2) 0 0;font-size:var(--t-meta);line-height:1.55;color:var(--muted)}

.afq{display:grid;gap:var(--s5)}
.afq-list{border-top:1px solid var(--line)}
.afq details{border-bottom:1px solid var(--line)}
.afq summary{display:flex;align-items:center;justify-content:space-between;gap:var(--s4);cursor:pointer;list-style:none;padding:var(--s4) 0;font-size:1.0625rem;font-weight:600}
.afq summary::-webkit-details-marker{display:none}
.afq summary svg{flex:none;color:var(--muted);transition:transform .2s}.afq details[open] summary svg{transform:rotate(180deg)}
.afq details p{margin:0;padding:0 0 var(--s5);font-size:var(--t-body);line-height:var(--body-lh);color:var(--muted);max-width:65ch}

.avs{display:grid;gap:clamp(2rem,5vw,3.5rem);align-items:start}
.avs-addr{display:flex;gap:var(--s3);align-items:flex-start;margin:0 0 var(--s5);font-size:var(--t-sub);line-height:1.5}.avs-addr svg{flex:none;margin-top:.2em;color:var(--accent)}
.avs-hours{padding:var(--s5)}
.avs-hours table,.aft-hours{width:100%;border-collapse:collapse;margin-top:var(--s3);font-size:var(--t-meta)}
.avs-hours td{padding:.55rem 0;border-bottom:1px solid var(--line)}.avs-hours tr:last-child td{border-bottom:0}.avs-hours td+td{text-align:right;font-variant-numeric:tabular-nums}
@media (min-width:900px){.avs{grid-template-columns:1.1fr .9fr}}

.acb{display:grid;gap:var(--s6);align-items:end}
.acb .adv-lede{max-width:40ch}
@media (min-width:900px){.acb{grid-template-columns:1fr auto}}

.aft{padding-top:clamp(3rem,7vw,5rem);border-top:1px solid var(--hero-line)}
.aft-grid{display:grid;gap:var(--s7);font-size:var(--t-meta)}
.aft-logo{height:40px;width:auto;max-width:180px;object-fit:contain;background:rgb(255 255 255/.9);border-radius:var(--r-img);padding:4px;margin-bottom:var(--s4)}
.aft .aft-mark{font-size:19px}
.aft-blurb{margin:var(--s4) 0 0;max-width:34rem;line-height:1.6;color:var(--hero-muted)}
.aft-small{margin:var(--s2) 0 0;font-size:12px;color:var(--hero-muted);word-break:break-all}
.aft-qr{display:flex;align-items:center;gap:var(--s4);margin-top:var(--s5)}
.aft-qrimg{height:80px;width:80px;border-radius:var(--r-img);background:#fff;padding:6px}
.aft-list{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.aft-list a,.aft-list span{display:inline-flex;align-items:center;gap:var(--s2);color:inherit;text-decoration:none;opacity:.88;max-width:100%}.aft-list a:hover{opacity:1}
.aft-list small{opacity:.65}
.aft-addr{margin:var(--s4) 0 0;line-height:1.6;opacity:.88}
.aft-hours td{padding:.2rem 0;opacity:.88}.aft-hours td+td{text-align:right}
.aft-legal-wrap{margin-top:clamp(2rem,5vw,3.5rem);border-top:1px solid var(--hero-line)}
.aft-legal{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--s2);padding-block:var(--s4) 4.5rem;font-size:12px;color:var(--hero-muted)}
@media (min-width:768px){.aft-grid{grid-template-columns:1.3fr 1fr 1fr}.aft-legal{padding-bottom:var(--s4)}}
`;
