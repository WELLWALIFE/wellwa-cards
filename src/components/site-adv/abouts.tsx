"use client";
// Advanced-site ABOUT variants:
//   story-columns  the opening sentence set large on the left, the rest of the story in two columns beside it, a small inset photo
//   overlap-card   a big photo with a text card overlapping its edge; the owner's "good to know" list as ticks under the text
import { Icon } from "@/components/site-icons";
import { Eyebrow, H2, Photo, Sec, type VariantProps } from "@/components/site-adv/shared";

/** The first sentence of the story (<= 170 chars) and everything after it. A story with no usable first sentence leads with its title. */
function lead(paras: string[], title: string): { statement: string; rest: string[] } {
  if (!paras.length) return { statement: title, rest: [] };
  const m = /^(.{20,170}?[.!?।])(\s+|$)/.exec(paras[0]);
  if (!m) return paras[0].length <= 170 ? { statement: paras[0], rest: paras.slice(1) } : { statement: title, rest: paras };
  const tail = paras[0].slice(m[0].length).trim();
  return { statement: m[1], rest: [...(tail ? [tail] : []), ...paras.slice(1)] };
}

export function AboutStoryColumns({ c, x, index }: VariantProps) {
  const a = c.about; if (!a) return null;
  const { statement, rest } = lead(a.paras.map((p) => x.t(p)), x.t(a.title));
  const long = rest.join(" ").length > 520;
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <div className="aba">
        <div className="aba-lead">
          <Eyebrow>{x.t(a.title)}</Eyebrow>
          <H2 className="aba-statement mt-3">{statement}</H2>
          <hr className="adv-rule" />
          {a.image && <figure className="aba-inset"><button type="button" className="abx-zoom" onClick={() => x.zoom([a.image!], 0, c.name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")}><Photo src={a.image} alt="" sizes="(min-width: 900px) 280px, 60vw" /></button></figure>}
        </div>
        <div className={`aba-body adv-body ${long ? "aba-cols" : ""}`}>
          {rest.map((p, i) => <p key={i}>{p}</p>)}
          {c.highlights.length > 0 && <ul className="aba-chips">{c.highlights.slice(0, 6).map((h, i) => <li key={i} className="adv-chip">{x.t(h)}</li>)}</ul>}
        </div>
      </div>
    </Sec>
  );
}

export function AboutOverlapCard({ c, x, index }: VariantProps) {
  const a = c.about; if (!a) return null;
  // The photo: the About image, else a picture the page owns that is not the hero's.
  const photo = a.image || c.photos.find((u) => u !== x.card.coverUrl);
  return (
    <Sec k="about" tone={index % 2 ? "alt" : "paper"} wide>
      <div className={`abo ${photo ? "" : "abo-bare"}`}>
        {photo && <div className="abo-photo"><button type="button" className="abx-zoom" onClick={() => x.zoom([photo], 0, c.name)} aria-label={x.ui("View photo larger", "फ़ोटो बड़ी करके देखें")}><Photo src={photo} alt="" sizes="(min-width: 900px) 58vw, 100vw" /></button></div>}
        <div className="abo-card">
          <Eyebrow>{x.ui("About us", "हमारे बारे में")}</Eyebrow>
          <H2 className="mt-3">{x.t(a.title)}</H2>
          <div className="adv-body abo-text">{a.paras.slice(0, 4).map((p, i) => <p key={i}>{x.t(p)}</p>)}</div>
          {c.highlights.length > 0 && (
            <ul className="abo-ticks">{c.highlights.slice(0, 6).map((h, i) => <li key={i}><Icon name="check" size={16} />{x.t(h)}</li>)}</ul>
          )}
        </div>
      </div>
    </Sec>
  );
}

export const ABOUTS_CSS = `
/* the photo is a real button (keyboard + screen reader); .abx-zoom (about.tsx) fills the frame */
.aba-inset,.abo-photo{position:relative}
.aba{display:grid;gap:clamp(1.75rem,4vw,3rem)}
.aba-lead{display:flex;flex-direction:column;gap:var(--s4);align-items:flex-start}
.aba-statement{font-size:clamp(1.7rem,4.4vw,3.1rem);line-height:1.12;max-width:20ch}
.site:lang(hi) .aba-statement{line-height:1.35;max-width:24ch}
.aba-inset{margin:var(--s4) 0 0;width:min(100%,260px);aspect-ratio:4/5;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.aba-cols{column-gap:clamp(1.5rem,3vw,3rem)}
.aba-body p{break-inside:avoid-column}
.aba-chips{display:flex;flex-wrap:wrap;gap:var(--s2);margin:var(--s5) 0 0;padding:0;list-style:none;column-span:all}
.site:lang(en) .aba-cols>p:first-child::first-letter{float:left;font-family:var(--font-display);font-size:3.6em;line-height:.82;padding:.06em .1em 0 0;color:var(--accent)}
@media (min-width:900px){.aba{grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:start}.aba-cols{column-count:2}}

.abo{display:grid;position:relative}
.abo-photo{aspect-ratio:4/3;border-radius:var(--r-tile);overflow:hidden;background:var(--paper-2)}
.abo-card{position:relative;margin:calc(-1 * clamp(2rem,10vw,4rem)) var(--s4) 0;padding:clamp(1.5rem,4vw,2.75rem);border-radius:var(--r-tile);background:var(--paper);border:1px solid var(--line);box-shadow:var(--e-1)}
.abo-text{margin-top:var(--s4)}
.abo-ticks{list-style:none;margin:var(--s5) 0 0;padding:var(--s5) 0 0;border-top:1px solid var(--line);display:grid;gap:var(--s3);font-size:var(--t-body)}
.abo-ticks li{display:flex;align-items:flex-start;gap:var(--s3)}.abo-ticks svg{flex:none;margin-top:.2em;color:var(--accent)}
.abo-bare .abo-card{margin:0;max-width:44rem;border-left:3px solid var(--accent);box-shadow:none}
@media (min-width:900px){
.abo{grid-template-columns:repeat(12,minmax(0,1fr));align-items:center}
.abo-photo{grid-column:1 / span 8;grid-row:1;aspect-ratio:auto;min-height:540px;height:100%}
.abo-card{grid-column:7 / span 6;grid-row:1;margin:0;z-index:1}
.abo-bare .abo-card{grid-column:2 / span 8}
}
`;
