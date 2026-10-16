// The gallery's place on a business that has no photograph at all (16 Oct 2026, empty-state pass): a photographer or an event
// planner without pictures used to get no gallery and a bare page. Now three to five of its own services are set as a board of
// typographic tiles — a big number, the service in the display face, its first line on the lead tile — each over a drawn shape
// of the trade (site-heroart.tsx) in the palette's own tokens (accent, soft, ink, paper). Nothing in it tells a visitor that
// something is missing; it is a designed fill, not a placeholder. Pure markup + CSS: no hooks, no request.
import { HeroArt, artKind, type ArtKind } from "@/components/site-heroart";

/** The drawings the tiles take in turn, the trade's own first. */
const TURN: ArtKind[] = ["arch", "rings", "grid", "wave", "blobs", "plate", "blade", "pulse"];

export function NoPhotoReel({ items, categoryKey, t }: { items: { name: string; desc: string }[]; categoryKey?: string; t: (s: string) => string }) {
  // The lead tile gets a drawing with round edges: the waves' flat fill shows its cut sides inside a tile, so they go last.
  const first = artKind(categoryKey) === "wave" ? "rings" : artKind(categoryKey);
  const kinds: ArtKind[] = [first, ...TURN.filter((k) => k !== first && k !== "wave"), "wave"];
  return (
    <ul className="nph" data-n={items.length}>
      {items.map((x, i) => (
        <li key={x.name} data-i={i + 1}>
          <HeroArt kind={kinds[i % kinds.length]} tone="light" />
          <span className="nph-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <div className="nph-t">
            <h3>{t(x.name)}</h3>
            {i === 0 && x.desc && <p>{t(x.desc)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export const NOPHOTO_CSS = `
.site .nph{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(168px,auto);gap:12px}
.site .nph li{position:relative;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;justify-content:space-between;gap:var(--s3);padding:16px;border-radius:var(--r-tile);border:1px solid var(--line);background:var(--surface);color:var(--ink)}
.site .nph li:nth-child(1){grid-column:1/-1;min-height:240px;background:var(--accent);color:var(--on-accent);border-color:transparent}
.site .nph li:nth-child(2){background:var(--p-soft)}
.site .nph li:nth-child(3){background:var(--p-foot);color:var(--p-foot-ink);border-color:transparent}
.site .nph li:nth-child(4){background:var(--paper-2)}
.site .nph[data-n="4"] li:nth-child(4){grid-column:1/-1}
.site .nph .hart{--hart-ink:currentColor;top:-30%;bottom:auto;right:-16%;width:74%;transform:none;z-index:-1}
.site .nph li:nth-child(1) .hart{width:52%;right:-3%;top:-14%}
@media (max-width:899px){.site .nph li:nth-child(1) .hart{width:62%;top:-22%}}
.site .nph-n{font-size:12px;font-weight:600;letter-spacing:.16em;font-variant-numeric:tabular-nums;opacity:.7}
.site .nph li:nth-child(1) .nph-n{font-family:var(--font-display,var(--look-head));font-size:clamp(2.6rem,12vw,4.5rem);font-weight:var(--display-w,600);letter-spacing:0;line-height:1;opacity:.9}
.site .nph h3{margin:0;font-size:1.08rem;line-height:1.22;font-weight:700;overflow-wrap:break-word;text-wrap:balance}
.site .nph li:nth-child(1) h3{font-size:clamp(1.5rem,6vw,2.1rem);line-height:1.12;max-width:16ch}
.site .nph p{margin:8px 0 0;max-width:34ch;font-size:14px;line-height:1.5;opacity:.88}
.site .nph:lang(hi) h3,.site .nph:lang(hi) p{line-height:1.5}
@media (min-width:900px){
.site .nph{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(190px,auto);gap:14px}
.site .nph li{padding:22px}
.site .nph li:nth-child(1){grid-column:span 2;grid-row:span 2;min-height:0}
.site .nph[data-n="3"] li:nth-child(n+2){grid-column:span 2}
.site .nph[data-n="4"] li:nth-child(2){grid-column:span 2}
.site .nph[data-n="4"] li:nth-child(4){grid-column:auto}
.site .nph h3{font-size:1.2rem}
.site .nph li:nth-child(1) h3{font-size:clamp(2rem,3vw,2.6rem)}
.site .nph li:nth-child(1) .nph-n{font-size:clamp(3.5rem,6vw,5.5rem)}
}
.site[data-motion=none] .nph .hart .l,.site[data-motion=none] .nph .hart .f{animation:none}
`;
