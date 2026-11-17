"use client";
// Advanced-site variants for a FASHION STORE (owner, 17 Nov 2026: "ye corporate style hai, lehenga chunne wali website nahi").
// Drawn after how wedding-wear stores are laid out: photographs lead, words are few, small spaced capitals, centred heads.
//   trust:usp-bar          one hairline row of the owner's short facilities, small capitals, no boxes
//   gallery:portrait-row   "the lookbook": tall portrait photographs four across, no captions
//   process:atelier-band   one photograph edge to edge, "book your appointment", the steps as a single line, one button
//   faq:fold               "good to know": a narrow centred fold of a few questions, the rest behind WhatsApp
import { Icon } from "@/components/site-icons";
import { linkHref } from "@/components/link-icon";
import { Photo, Sec, type VariantProps } from "@/components/site-adv/shared";

export function TrustUspBar({ c, x }: VariantProps) {
  const items = (c.highlights.length >= 2 ? c.highlights : c.facts.map((f) => `${f.value} ${f.label}`.trim())).filter(Boolean).slice(0, 4);
  if (items.length < 2) return null;
  return (
    <section id="adv-trust" data-sec="trust" data-reveal className="sub-bar" aria-label={x.ui("At a glance", "एक नज़र में")}>
      <ul className="adv-wrap adv-wide sub-list">{items.map((s, i) => <li key={i}>{x.t(s)}</li>)}</ul>
    </section>
  );
}

export function GalleryPortraitRow({ c, x }: VariantProps) {
  // Full rows only (owner's demo, 17 Nov 2026: six photos left a half-empty second row): 8 in fours, 6 in threes, else 4, 3 or 2.
  const n0 = c.gallery.length;
  const g = c.gallery.slice(0, n0 >= 8 ? 8 : n0 >= 6 ? 6 : n0 >= 4 ? 4 : n0);
  if (g.length < 2) return null;
  const urls = c.gallery.map((p) => p.url);
  return (
    <Sec k="gallery" wide className="spr">
      <h2 className="st-h">{x.ui("The lookbook", "लुकबुक")}</h2>
      <ul className="spr-row" data-n={g.length === 6 ? 3 : g.length >= 4 ? 4 : g.length}>
        {g.map((p, i) => (
          <li key={i}>
            <button type="button" className="spr-tile" onClick={() => x.zoom(urls, i, x.t(p.label))} aria-label={`${x.ui("View photo", "फ़ोटो देखें")} ${i + 1}`}>
              <Photo src={p.url} alt={x.t(p.label)} sizes="(min-width: 1024px) 25vw, 50vw" />
            </button>
          </li>
        ))}
      </ul>
    </Sec>
  );
}

export function ProcessAtelierBand({ c, x }: VariantProps) {
  const wa = !!x.wa;
  if (!c.steps.length && !wa && !x.phone) return null;
  const photo = c.gallery[1]?.url ?? c.photos[1] ?? c.photos[0];
  const href = wa
    ? x.waHref(x.hi ? `नमस्ते ${c.name}, मुझे अपॉइंटमेंट बुक करना है` : `Hi ${c.name}, I'd like to book an appointment`)
    : x.phone ? linkHref(x.phone.type, x.phone.value) : "";
  return (
    <section id="adv-process" data-sec="process" data-reveal className="sab hero-dark" aria-label={x.ui("Book your appointment", "अपॉइंटमेंट बुक करें")}>
      {photo && <div className="sab-photo"><Photo src={photo} alt="" sizes="100vw" /></div>}
      <div className="adv-wrap sab-inner">
        <h2 className="sab-h">{x.ui("Book your appointment", "अपॉइंटमेंट बुक करें")}</h2>
        {c.steps.length > 0 && <p className="sab-steps">{c.steps.slice(0, 4).map((s) => x.t(s.name)).join("  ·  ")}</p>}
        {href && (
          <a href={href} {...(wa ? { target: "_blank", rel: "noreferrer" } : {})} className="sab-btn" onClick={() => x.track(wa ? "appointment-wa" : "appointment-call")}>
            <Icon name={wa ? "whatsapp" : "phone"} size={16} />{wa ? x.ui("Book on WhatsApp", "WhatsApp पर बुक करें") : x.ui("Call to book", "कॉल करके बुक करें")}
          </a>
        )}
      </div>
    </section>
  );
}

export function FaqFold({ c, x }: VariantProps) {
  if (!c.faq.length) return null;
  return (
    <Sec k="faq" className="sfq">
      <h2 className="st-h">{x.ui("Good to know", "जानने लायक़")}</h2>
      <div className="sfq-list">
        {c.faq.slice(0, 5).map((f, i) => (
          <details key={i}><summary><span>{x.t(f.q)}</span><i aria-hidden="true" /></summary><p>{x.t(f.a)}</p></details>
        ))}
      </div>
      {x.wa && <p className="sfq-ask"><a href={x.waHref()} target="_blank" rel="noreferrer" className="btn-link" onClick={() => x.track("faq-ask")}>{x.ui("Ask us anything on WhatsApp", "WhatsApp पर कुछ भी पूछिए")} <Icon name="arrow-right" size={16} /></a></p>}
    </Sec>
  );
}

export const STORE_CSS = `
.st-h{font-size:clamp(1.05rem,2vw,1.4rem)!important;letter-spacing:.24em;text-transform:uppercase;font-weight:500!important;text-align:center;line-height:1.4;margin:0 0 clamp(1.6rem,4vw,2.6rem)!important}
.site:lang(hi) .st-h{letter-spacing:0;font-size:clamp(1.3rem,2.6vw,1.7rem)!important}
.sub-bar{border-block:1px solid var(--line);background:var(--paper)}
.sub-list{list-style:none;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem 2.2rem;padding-block:.95rem}
.sub-list li{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);font-weight:500;white-space:nowrap}
.site:lang(hi) .sub-list li{letter-spacing:0;font-size:13px}
.spr-row{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.spr-tile{display:block;width:100%;aspect-ratio:3/4;padding:0;border:0;background:var(--paper-2);overflow:hidden;cursor:zoom-in;border-radius:var(--r-img)}
.spr-tile .adv-photo{transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.spr-tile:hover .adv-photo{transform:scale(1.04)}
@media (min-width:1024px){.spr-row{grid-template-columns:repeat(4,1fr);gap:16px}.spr-row[data-n="3"]{grid-template-columns:repeat(3,1fr)}.spr-row[data-n="2"]{grid-template-columns:repeat(2,1fr);max-width:820px;margin-inline:auto}}
.sab{position:relative;display:grid;place-items:center;min-height:clamp(340px,52vw,560px);background:var(--hero-ink);color:#fff;overflow:hidden;text-align:center}
.sab-photo{position:absolute;inset:0}
.sab-photo::after{content:"";position:absolute;inset:0;background:rgba(12,8,6,.5)}
.sab-inner{position:relative;z-index:1;display:grid;justify-items:center;gap:1rem;padding-block:3rem}
.site[data-adv] .sab-h{font-size:clamp(1.3rem,3vw,2.1rem);letter-spacing:.2em;text-transform:uppercase;font-weight:500;color:#fff;line-height:1.3}
.site:lang(hi) .sab-h{letter-spacing:0}
.sab-steps{margin:0;font-size:13px;letter-spacing:.08em;color:rgba(255,255,255,.86);max-width:60ch;line-height:1.7}
.sab-btn{display:inline-flex;align-items:center;gap:.55em;min-height:46px;padding:0 1.7rem;margin-top:.4rem;background:#fff;color:#141414;font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;text-decoration:none;border-radius:var(--r-ctl)}
.site:lang(hi) .sab-btn{letter-spacing:0;font-size:14px}
.sfq .adv-wrap{max-width:760px}
.sfq-list{border-top:1px solid var(--line)}
.sfq-list details{border-bottom:1px solid var(--line)}
.sfq-list summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.05rem 0;cursor:pointer;list-style:none;font-size:15px;font-weight:500;color:var(--ink)}
.sfq-list summary::-webkit-details-marker{display:none}
.sfq-list summary i{flex:none;width:11px;height:11px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:rotate(45deg);transition:transform .25s;margin-right:4px}
.sfq-list details[open] summary i{transform:rotate(225deg)}
.sfq-list p{margin:0 0 1.1rem;font-size:14.5px;line-height:1.7;color:var(--muted);max-width:62ch}
.sfq-ask{text-align:center;margin:1.6rem 0 0}
`;
