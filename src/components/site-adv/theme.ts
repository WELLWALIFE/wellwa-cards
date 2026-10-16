// The ADVANCED website's design system, in one place that is pure data + one CSS string (no React, no DOM): the curated
// palettes, the twelve font pairings, and THEME_CSS - the fluid type scale, the section rhythm and the SHAPE LANGUAGE
// (owner, 16 Oct 2026: "confident art direction ... a layout that is different for every business").
//
// Why the art direction hangs off the spec's `shape` (sharp / soft / pill) and not off new spec fields: the renderer root already carries
// data-shape / data-density / data-motion and the colour tokens, and the spec schema must not change. So one choice of corners
// also chooses the section edge (a slant, a dome, a wave), the kicker (a number, a dot, a chip), the button voice (printed caps,
// soft, round) and the grain (paper, none). An archetype therefore only has to pick a shape to get a complete silhouette.
//
// A variant never hard-codes any of this: it wears the root tokens and the shared classes (`.adv-sec`, `.adv-head`, `.kicker`,
// `.adv-h2`, `.btn-*`, `.adv-card`) and the system re-dresses it. The utility classes at the end (`.adv-grain`, `.adv-arch`, ...)
// are for variants that want a shape of their own.
import { luminance } from "@/lib/color";
import { ADV_FONTS, BODY_FONTS } from "@/lib/site-advanced";

/* ================= curated palettes ================= */
// SITE_PALETTES has fifteen keys, and validateSpec only keeps those (plus "brand" with an explicit hex). A curated palette is
// therefore a "brand" palette with a chosen colour: oklchVars() turns its hue into the whole token set (paper, ink, muted, line,
// accent, accent-soft, hero-ink ...) for light and dark, with the contrast rules of docs/premium-look.md §2.3. The names are for
// people and the designer AI; the data is {key:"brand", color, tone}.

export type CuratedPalette = { id: string; name: string; /** #rrggbb, the colour oklchVars() reads the hue and chroma from. */ color: string; /** Which tone it looks best in. */ tone: "light" | "dark"; mood: string };
export const CURATED_PALETTES: CuratedPalette[] = [
  { id: "terracotta", name: "Terracotta", color: "#b4532a", tone: "light", mood: "baked clay, warm and earthy: sweets, cafes, pottery" },
  { id: "indigo", name: "Indigo ink", color: "#3f3fa8", tone: "light", mood: "block-print blue: education, finance, craft" },
  { id: "petrol", name: "Petrol", color: "#0f6070", tone: "dark", mood: "deep teal-blue: clinics at night, tech, hotels" },
  { id: "plum", name: "Plum", color: "#7d2a62", tone: "dark", mood: "wine and berry: salons, bridal, boutiques" },
  { id: "pistachio", name: "Pistachio", color: "#5a8a2e", tone: "light", mood: "fresh green: grocery, dairy, organic, yoga" },
  { id: "brass", name: "Brass", color: "#b08a3e", tone: "dark", mood: "champagne gold on ink: jewellers, heritage, hotels, bridal" },
  { id: "oxblood", name: "Oxblood", color: "#7a1a26", tone: "dark", mood: "dark red leather: restaurants, jewellers, heritage" },
  { id: "sage", name: "Sage", color: "#5f8068", tone: "light", mood: "grey-green calm: ayurveda, spa, interiors" },
  { id: "clay", name: "Clay", color: "#a2613f", tone: "light", mood: "soft brown-orange: furniture, bakery, tailors" },
  { id: "lagoon", name: "Lagoon", color: "#0c8590", tone: "light", mood: "clear water: travel, water, dental, cleaning" },
  { id: "blush", name: "Blush", color: "#c4566f", tone: "light", mood: "dusty pink: beauty, gifts, boutiques" },
  { id: "cobalt", name: "Cobalt", color: "#2150d9", tone: "light", mood: "bright trusted blue: shops, services, coaching" },
  { id: "olive", name: "Olive", color: "#6d6d22", tone: "dark", mood: "olive grove: farms, agri, outdoor, artisans" },
  { id: "slate", name: "Slate blue", color: "#3f5f80", tone: "light", mood: "calm grey-blue: law, CA, consultants" },
  { id: "copper", name: "Copper", color: "#b3622a", tone: "dark", mood: "burnished metal on dark: workshops, auto, brewing" },
  { id: "violet", name: "Violet night", color: "#6a3fd6", tone: "dark", mood: "electric violet on ink: gyms, events, creators" },
];
export const CURATED_BY_ID: Record<string, CuratedPalette> = Object.fromEntries(CURATED_PALETTES.map((p) => [p.id, p]));
/** The palette object of the spec for a curated id ("terracotta" -> {key:"brand", color, tone}). */
export function curatedPalette(id: string, tone?: "light" | "dark", luxe = false) {
  const p = CURATED_BY_ID[id];
  if (!p) return null;
  return { key: "brand", color: p.color, tone: tone ?? p.tone, ...(luxe ? { luxe: true } : {}) } as { key: string; color: string; tone: "light" | "dark"; luxe?: true };
}

/* ================= twelve font pairings (all self-hosted: public/fonts) ================= */
// A pair is {heading, body}; both are checked against ADV_FONTS / BODY_FONTS by the self-test, so a pairing can never name a
// family that would be a request to Google. Devanagari falls to Tiro Devanagari Hindi (serif headings) / Hind (sans) and
// Noto Sans Devanagari for text (advancedVars), so a Hindi site keeps the same voice.

export type FontPairing = { id: string; heading: string; body: string; voice: string };
export const FONT_PAIRINGS: FontPairing[] = [
  { id: "warm-editorial", heading: "Fraunces", body: "DM Sans", voice: "soft, wonky, friendly: sweets, cafes, wellness" },
  { id: "classic-luxe", heading: "Playfair Display", body: "Inter", voice: "high-contrast and formal: jewellers, hotels, law" },
  { id: "gallery-quiet", heading: "Instrument Serif", body: "Inter", voice: "tall, quiet, fashion-magazine: boutiques, photographers, studios" },
  { id: "journal", heading: "Newsreader", body: "DM Sans", voice: "bookish and calm: clinics, schools, advisers" },
  { id: "bold-serif", heading: "DM Serif Display", body: "Manrope", voice: "heavy, confident serif: bridal, celebration, heritage retail" },
  { id: "homely", heading: "Lora", body: "Mukta", voice: "sturdy and kind: neighbourhood shops, tiffin, family clinics" },
  { id: "loud-friendly", heading: "Bricolage Grotesque", body: "Inter", voice: "chunky grotesque with character: restaurants, gyms, kids" },
  { id: "technical", heading: "Space Grotesk", body: "Inter", voice: "geometric and exact: builders, tech, workshops, wholesale" },
  { id: "clean-modern", heading: "Manrope", body: "Inter", voice: "neutral and modern: hospitals, colleges, services" },
  { id: "neutral-sans", heading: "DM Sans", body: "Inter", voice: "plain and fast: shops, price lists, utilities" },
  { id: "friendly-grotesque", heading: "Bricolage Grotesque", body: "DM Sans", voice: "playful but tidy: salons, coaching, community" },
  { id: "bridal-hindi", heading: "Playfair Display", body: "Mukta", voice: "classic serif with a warm Devanagari body: weddings, sarees, sweets" },
];
/** Names a pairing that does not exist as a self-hosted pair (empty = fine). */
export function checkPairings(): string[] {
  const bad: string[] = [];
  for (const p of FONT_PAIRINGS) {
    if (!ADV_FONTS[p.heading]) bad.push(`pairing ${p.id}: heading ${p.heading} is not self-hosted`);
    if (!(BODY_FONTS as readonly string[]).includes(p.body)) bad.push(`pairing ${p.id}: body ${p.body} is not self-hosted`);
  }
  return bad;
}

/* ================= contrast helper (the self-test and the palette audit use it) ================= */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* ================= THEME_CSS ================= */
// Rides after the tokens (advancedVars) and the shared design-system CSS, inside ADV_BASE_CSS (shared.tsx).

// A 160x24 sine wave and a scallop as masks (one tile, repeated), a fractal-noise tile for grain. All data URIs: no request.
const WAVE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 24' preserveAspectRatio='none'%3E%3Cpath d='M0 12C20 0 60 0 80 12S140 24 160 12V24H0Z'/%3E%3C/svg%3E")`;
const SCALLOP = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 14' preserveAspectRatio='none'%3E%3Cpath d='M0 14V10A24 10 0 0 1 48 10V14Z'/%3E%3C/svg%3E")`;
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const THEME_CSS = `
/* ---- tokens: type scale (fluid 360 -> 1440), reading size, rhythm ---- */
.site[data-adv]{
  --adv-h1:clamp(2.9rem,1.1rem + 8vw,7.6rem);
  --adv-h2:clamp(2.15rem,1.25rem + 3.9vw,4.3rem);
  --adv-h3:clamp(1.3rem,1.05rem + .9vw,1.75rem);
  --t-sub:clamp(1.0625rem,1rem + .35vw,1.25rem);
  --t-body:clamp(1rem,.96rem + .14vw,1.0625rem);
  --t-kicker:12px;
  --gutter:clamp(20px,5vw,72px);
  --edge:clamp(22px,3.4vw,46px);
  --accent-2:var(--accent);
  --alt:color-mix(in oklab,var(--paper-2) 88%,var(--accent) 12%);
  --grain:${NOISE};
}
@supports (color:oklch(from red l c h)){.site[data-adv]{--accent-2:oklch(from var(--accent) l c calc(h + 36))}}
.site[data-adv][data-density=compact]{--edge:clamp(16px,2.4vw,30px)}
.site[data-adv]:lang(hi){--body-lh:1.72}
.site[data-adv] ::selection{background:var(--accent);color:var(--on-accent)}
.site[data-adv] p{text-wrap:pretty}
.site[data-adv] .adv-body,.site[data-adv] .adv-lede{hanging-punctuation:first}
.site[data-adv] :is(h1,h2,h3){font-optical-sizing:auto;text-wrap:balance}
.site[data-adv] :is(td,dd,.price,[data-num]){font-variant-numeric:tabular-nums}

/* ---- headings: bigger steps, one accent word ---- */
.adv-h2{font-size:var(--adv-h2);line-height:1.02;letter-spacing:var(--display-tr)}
.site[data-adv] :is(.adv-h2,.adv-display) em{font-style:normal;color:var(--accent)}
.site[data-adv] .adv-h3{font-family:var(--font-display);font-weight:var(--display-w);font-size:var(--adv-h3);line-height:1.15;letter-spacing:calc(var(--display-tr) * .6)}
.adv-head{margin-bottom:clamp(2.25rem,5.5vw,4rem)}
.adv-lede{font-size:var(--t-sub)}

/* ---- section rhythm: two neighbours of one tone share one gap, not two ---- */
.adv-sec[data-tone=paper]+.adv-sec[data-tone=paper],.adv-sec[data-tone=alt]+.adv-sec[data-tone=alt]{padding-top:calc(var(--section-pad) * .55)}
.site[data-adv][data-shape=sharp] .adv-sec[data-tone=paper]+.adv-sec[data-tone=paper]{border-top:1px solid var(--line)}
.site[data-adv] .adv-sec{background-clip:padding-box}

/* ---- the kicker above a title: a number (sharp), a dot (soft), a chip (pill) ---- */
.site[data-adv]{counter-reset:advsec}
.adv-sec{counter-increment:advsec}
.adv-head .kicker{display:inline-flex;align-items:center;gap:.75em}
.site[data-adv][data-shape=sharp] .adv-head .kicker::before{content:counter(advsec,decimal-leading-zero);font-variant-numeric:tabular-nums;font-weight:700;letter-spacing:.06em}
.site[data-adv][data-shape=sharp] .adv-head .kicker::after{content:"";width:clamp(1.5rem,4vw,3rem);height:1px;background:currentColor;opacity:.55}
.site[data-adv][data-shape=soft] .adv-head .kicker::before{content:"";flex:none;width:.5em;height:.5em;border-radius:50%;background:var(--accent-2);box-shadow:0 0 0 .3em color-mix(in oklab,var(--accent) 18%,transparent)}
.site[data-adv][data-shape=pill] .adv-head .kicker{padding:.55em 1.05em;border:1px solid color-mix(in oklab,var(--accent) 32%,transparent);border-radius:999px;background:var(--accent-soft)}
.site[data-adv][data-shape=pill] .adv-head .kicker::before{content:"";flex:none;width:.45em;height:.45em;border-radius:50%;background:var(--accent)}
.adv-sec[data-tone=ink] .adv-head .kicker{color:var(--hero-muted)}
.site[data-adv][data-shape=pill] .adv-sec[data-tone=ink] .adv-head .kicker{background:color-mix(in srgb,var(--hero-text) 10%,transparent);border-color:var(--hero-line)}
/* centred heads keep their chip centred */
.adv-head[style*="center"] .kicker,.adv-head.is-center .kicker{justify-content:center}
.adv-head.is-center{margin-inline:auto;text-align:center}.adv-head.is-center .adv-lede{margin-inline:auto}
@media (min-width:1000px){
  .adv-head.is-split{max-width:none;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.8fr);column-gap:clamp(2rem,6vw,6rem);align-items:end}
  .adv-head.is-split .kicker{grid-column:1/-1;justify-self:start}.adv-head.is-split .adv-h2{grid-column:1}.adv-head.is-split .adv-lede{grid-column:2;margin:0;padding-bottom:.5em}
}

/* ---- the section edge: the tinted sections grow their own top edge over the section above, so it works whatever sits there ---- */
.adv-sec[data-tone=alt]{background:var(--alt)}
.adv-sec[data-tone=ink]::before,.adv-sec[data-tone=alt]::before{content:"";position:absolute;z-index:1;left:0;right:0;bottom:calc(100% - 1px);height:var(--edge);pointer-events:none;background:var(--alt)}
.adv-sec[data-tone=ink]::before{background:var(--hero-ink)}
.site[data-adv][data-shape=sharp] .adv-sec[data-tone=ink]::before{clip-path:polygon(0 100%,100% 0,100% 100%)}
.site[data-adv][data-shape=sharp] .adv-sec[data-tone=alt]::before{display:none}
.site[data-adv][data-shape=sharp] .adv-sec[data-tone=alt]{border-top:1px solid var(--line)}
.site[data-adv][data-shape=soft] .adv-sec:is([data-tone=ink],[data-tone=alt])::before{left:-8%;right:-8%;border-radius:50% 50% 0 0/100% 100% 0 0}
.site[data-adv][data-shape=pill] .adv-sec:is([data-tone=ink],[data-tone=alt])::before{-webkit-mask:${WAVE} repeat-x 0 100%/clamp(120px,16vw,220px) 100%;mask:${WAVE} repeat-x 0 100%/clamp(120px,16vw,220px) 100%}
/* a band, a header strip or the first section of a page is not a section edge */
.adv-sec:first-child::before,.sm+.adv-sec::before,:is(.mh,.adv-hero,[data-sec=hero])+.adv-sec::before{display:none}

/* ---- ink: the field the dark sections stand on (a glow of the page's own hue, never a stock gradient) ---- */
.adv-sec[data-tone=ink]{background-image:radial-gradient(70% 90% at 100% 0%,color-mix(in oklab,var(--accent) 24%,transparent),transparent 62%),radial-gradient(55% 70% at 0% 100%,color-mix(in oklab,var(--accent-2) 14%,transparent),transparent 65%)}
.adv-sec[data-tone=ink] :focus-visible,.hero-dark :focus-visible{outline-color:var(--hero-text)}
/* On a light page the accent is a mid tone (about 3:1 on the ink field): inside ink it steps up to a light one, and what sits ON an accent fill turns to ink. */
@supports (color:oklch(from red l c h)){.site[data-adv]{--accent-ink:oklch(from var(--accent) max(l,.76) c h)}.adv-sec[data-tone=ink],.hero-dark{--accent:var(--accent-ink);--on-accent:var(--hero-ink)}}
@media (min-width:1024px){
  .adv-sec[data-tone=ink]::after,.site[data-adv][data-shape=sharp][data-density=airy] .adv-sec[data-tone=alt]::after{content:"";position:absolute;inset:0;pointer-events:none;background:var(--grain);opacity:.07}
  .site[data-adv][data-shape=sharp][data-density=airy] .adv-sec[data-tone=alt]::after{opacity:.045}
}

/* ---- controls: the shape chooses the voice ---- */
.site[data-adv] :is(.btn-primary,.btn-ghost){min-height:52px;padding-inline:clamp(1.25rem,2.4vw,1.75rem);font-weight:600}
.site[data-adv][data-shape=sharp] :is(.btn-primary,.btn-ghost){text-transform:uppercase;letter-spacing:.08em;font-size:12.5px;font-weight:700}
.site[data-adv]:lang(hi) :is(.btn-primary,.btn-ghost){text-transform:none;letter-spacing:0;font-size:var(--t-cta)}
.site[data-adv]:is([data-shape=soft],[data-shape=pill]) .btn-primary{box-shadow:inset 0 1px 0 rgb(255 255 255/.22),0 8px 20px -8px color-mix(in oklab,var(--accent) 70%,transparent)}
/* the basic hero paints a WhatsApp glyph in WhatsApp green (site-smart.tsx): on a filled accent button that is green on rust, so it follows the label */
.site[data-adv] .btn-primary svg,.site[data-adv] .hero-cta.btn-primary[data-kind=whatsapp] svg{color:inherit}
.site[data-adv] .btn-primary:hover{filter:none;transform:translateY(-1px);background:color-mix(in oklab,var(--accent) 88%,var(--ink))}
.site[data-adv] .btn-primary:active,.site[data-adv] .btn-ghost:active{transform:scale(.98)}
.site[data-adv] .btn-ghost:hover{background:color-mix(in oklab,var(--accent) 8%,transparent);border-color:var(--accent)}
.site[data-adv] .hero-dark .btn-primary:hover{background:color-mix(in oklab,var(--hero-text) 88%,var(--hero-ink))}

/* ---- cards and the placeholder tile ---- */
.site[data-adv]:is([data-shape=soft],[data-shape=pill]) .adv-card{box-shadow:var(--e-1)}
.site[data-adv][data-shape=sharp] .adv-card{box-shadow:0 0 0 1px var(--line),4px 4px 0 -1px color-mix(in oklab,var(--ink) 7%,transparent)}
.adv-tile{position:relative;overflow:hidden;background:radial-gradient(90% 90% at 18% 12%,color-mix(in oklab,var(--accent) 24%,var(--accent-soft)),transparent 70%),radial-gradient(80% 80% at 90% 100%,color-mix(in oklab,var(--accent-2) 22%,var(--accent-soft)),transparent 72%),var(--accent-soft)}
.adv-tile>span{position:relative;font-size:clamp(3rem,10vw,6.5rem);opacity:.55;line-height:1}
.adv-photo{background:var(--paper-2)}

/* ---- motion: the section rises (shared.tsx), and in "rich" its head rises in parts - kicker, title, lede - 80 ms apart ---- */
/* a plain link is 22 px tall: on a touch screen its hit area grows to 44 px (padding that a negative margin takes back, so nothing moves) */
@media (pointer:coarse){.site[data-adv] .btn-link{padding-block:11px;margin-block:-11px}}
.site[data-adv] .btn-link svg:last-child{transition:transform .2s cubic-bezier(.2,.7,.2,1)}
.site[data-adv] .btn-link:hover svg:last-child{transform:translateX(3px)}
@media (prefers-reduced-motion:no-preference){
  .site[data-adv][data-motion=rich].js .adv-sec[data-reveal] .adv-head>*{transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
  .site[data-adv][data-motion=rich].js .adv-sec[data-reveal]:not(.in) .adv-head>*{opacity:0;transform:translateY(18px)}
  .site[data-adv][data-motion=rich].js .adv-sec[data-reveal].in .adv-head>:nth-child(2){transition-delay:.08s}
  .site[data-adv][data-motion=rich].js .adv-sec[data-reveal].in .adv-head>:nth-child(3){transition-delay:.16s}
}

/* ---- utilities a variant may reach for ---- */
.adv-grain{position:relative}.adv-grain::after{content:"";position:absolute;inset:0;pointer-events:none;background:var(--grain);opacity:.07}
.adv-arch{border-radius:999px 999px var(--r-img) var(--r-img);overflow:hidden}
.adv-scallop-b{-webkit-mask:${SCALLOP} repeat-x 0 100%/48px 14px,linear-gradient(#000 0 0) 0 0/100% calc(100% - 13px) no-repeat;mask:${SCALLOP} repeat-x 0 100%/48px 14px,linear-gradient(#000 0 0) 0 0/100% calc(100% - 13px) no-repeat}
.adv-glow{background-image:radial-gradient(70% 90% at 100% 0%,color-mix(in oklab,var(--accent) 22%,transparent),transparent 62%)}
.adv-hair{border:1px solid var(--line)}
.adv-hair-grid{display:grid;gap:1px;background:var(--line);border:1px solid var(--line)}.adv-hair-grid>*{background:var(--paper)}
.adv-num{font-family:var(--font-display);font-variant-numeric:tabular-nums;line-height:.9;letter-spacing:var(--display-tr)}
`;
