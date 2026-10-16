// The middle of the standard website — heading rhythm, the shop-grade product card, the section pieces that
// every blueprint shares (16 Oct 2026, "sections" pass). Tokens only; the six looks (site-bodies.ts) restyle these
// classes on top, because their rules are scoped to `.site[data-bp=…] main` and so win on specificity.
//
// Pure module: a string of CSS, inlined by site-view.tsx after VIEW_CSS.

export const MID_CSS = `
/* Heading rhythm: the kicker, the heading and its lede keep one gap on every look. (The heading's own "margin:0" in
   VIEW_CSS beat the mt-3 the markup asked for, so a kicker sat on the line under it and a heading on the cards below it.) */
.site .kicker+.sec-h2{margin-top:var(--s3)}
.site .sec-h2.mb-6{margin-bottom:var(--s5)}
.site .sec-h2+.lede{margin-top:var(--s3)}

/* The product card (Haldiram's / Blue Tokai): the name, one quiet line, up to three chips, the price with the old price and the
   percent saved, then ONE full-width button. The whole card opens the product (the name's link is stretched over it). */
.site .p-card{position:relative}
.site .p-body{display:flex;flex-direction:column;gap:6px;flex:1;padding:var(--s4) var(--s4) var(--s4)}
@media (min-width:768px){.site .p-body{padding:var(--s5)}}
.site .p-stretch{display:block;text-align:left;background:none;border:0;padding:0;color:inherit}
.site .p-stretch::after{content:"";position:absolute;inset:0;z-index:0}
.site .p-card:has(.p-stretch):hover .p-name{color:var(--accent)}
.site .p-card:active{scale:.99}
.site .p-desc{margin:0;color:var(--muted);font-size:14px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.site .p-chips{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 0;padding:0;list-style:none;position:relative;z-index:1}
.site .p-chips li{font-size:11px;line-height:1;padding:5px 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted)}
.site .p-priceRow{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;margin:4px 0 0}
.site .p-card .p-price{font-size:17px;font-weight:700}
.site .p-mrp{color:var(--muted);font-size:13px;font-weight:400;font-variant-numeric:tabular-nums lining-nums}
.site .p-off{align-self:center;font-size:11px;font-weight:700;letter-spacing:.02em;line-height:1;padding:4px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent)}
.site .p-ask{margin:4px 0 0;font-size:13px;color:var(--muted)}
.site .p-specs{position:relative;z-index:1}
.site .p-actions{margin-top:auto;padding-top:var(--s3);position:relative;z-index:1}
.site .p-wa.p-buy{display:flex;width:100%;justify-content:center;align-items:center;gap:.45em;min-height:44px;padding:0 var(--s4);text-align:center;line-height:1.2;font-size:14px;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--surface);transition:background 150ms ease,color 150ms ease,border-color 150ms ease,scale 80ms ease}
.site .p-wa.p-buy:hover{background:var(--accent);color:var(--on-accent);border-color:var(--accent);text-decoration:none}
.site .p-wa.p-buy:hover svg{color:currentColor}
.site .p-wa.p-buy:active{scale:.97}
@media (max-width:639px){
.site .p-grid[data-two]:not(.site-rail){grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3)}
.site .p-grid[data-two] .p-body{padding:var(--s3)}
.site .p-grid[data-two] .p-chips{display:none}
.site .p-grid[data-two] .p-desc{font-size:12.5px;-webkit-line-clamp:2}
.site .p-grid[data-two] .p-name{font-size:14px}
.site .p-grid[data-two] .p-card .p-price{font-size:15px}
.site .p-grid[data-two] .p-wa.p-buy{font-size:12.5px;min-height:40px;padding:0 var(--s2)}
.site .p-grid[data-two] .p-img{aspect-ratio:1}
.site .p-grid[data-two] .p-ph{font-size:48px}
/* An odd last card would sit alone beside an empty cell: it takes the full row, picture left, words right. */
.site .p-grid[data-two]:not(.site-rail) .p-card:last-child:nth-child(odd){grid-column:1/-1;flex-direction:row}
.site .p-grid[data-two]:not(.site-rail) .p-card:last-child:nth-child(odd) .p-img{width:42%;flex:none;aspect-ratio:auto;min-height:150px}
.site .p-grid[data-two]:not(.site-rail) .p-card:last-child:nth-child(odd) .p-body{justify-content:center}
}
/* The shop's swipe row snaps its cards to the left edge; without scroll padding it snapped 20px in and cut the first card off. */
.site .p-grid,.site .site-rail,.site .tile-row,.site .rev-row{scroll-padding-inline:20px}
@media (prefers-reduced-motion:reduce){.site .p-card:active,.site .p-wa.p-buy:active{scale:none}}
`;
