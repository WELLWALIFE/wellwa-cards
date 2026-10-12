// What the PAGE BODY looks like on each blueprint (docs/website-looks-v3.md §4): the sections under the hero — their
// backgrounds, headings, cards, product grid, gallery and reviews — so a Wordmark site is not a Bento site with a
// different hero (owner, 12 Oct 2026: "abhi bhi purane wale jaisa hi lag raha hai"). Tokens only; every rule is
// scoped to `.site[data-bp=…] main`, so a site without that blueprint renders exactly as before.
//
// Pure module: a string of CSS per blueprint, inlined by site-view.tsx after the hero CSS.

/** The Wordmark body (the bakery / boutique sites of the review): big display headings, sections that alternate paper,
 *  the soft tint and one ink band, square photos, prices in the display face, no card lines. */
const WORDMARK = `
.site[data-bp="wordmark"] main .sec-h2{font-size:clamp(2.25rem,8vw,4.5rem);line-height:.95;letter-spacing:-.03em;max-width:14ch}
.site[data-bp="wordmark"] main .sec-h2:lang(hi){letter-spacing:0;line-height:1.15}
.site[data-bp="wordmark"] main .lede{font-size:1.125rem}
.site[data-bp="wordmark"] main section[data-reveal]:nth-of-type(3n+2){background:var(--p-soft)!important}
.site[data-bp="wordmark"] main section[data-reveal]:nth-of-type(3n){background:var(--paper)!important}
.site[data-bp="wordmark"] main .s-card{border:0;box-shadow:none;background:transparent;border-radius:0}
.site[data-bp="wordmark"] main .s-card .p-img{aspect-ratio:1;border-radius:var(--r-img);background:var(--paper-2)}
.site[data-bp="wordmark"] main .s-card>.p-5{padding-left:0;padding-right:0}
.site[data-bp="wordmark"] main .p-name{font-family:var(--font-display,var(--look-head));font-size:1.35rem;letter-spacing:-.01em}
.site[data-bp="wordmark"] main .p-price{font-family:var(--font-display,var(--look-head));font-size:1.35rem}
.site[data-bp="wordmark"] main .p-wa{border-radius:999px}
.site[data-bp="wordmark"] main .rev-q{font-family:var(--font-display,var(--look-head));font-size:1.5rem;line-height:1.3}
.site[data-bp="wordmark"] main .icon-box{border-radius:999px}
@media (min-width:1024px){.site[data-bp="wordmark"] main .sec-h2{font-size:clamp(3rem,5vw,5rem)}}
`;

/** The Shop body (Haldiram's / Chaayos / Urban Company): tight headings with the kicker as a tab, products two across on
 *  a phone with the price bold in the accent and a full-width Order pill, chips for the facilities, bordered review cards. */
const SHOP = `
.site[data-bp="shop"] main .sec-h2{font-size:clamp(1.5rem,5.5vw,2rem);letter-spacing:-.01em}
.site[data-bp="shop"] main .sec-pad{padding-top:var(--s7);padding-bottom:var(--s7)}
.site[data-bp="shop"] main .mb-10,.site[data-bp="shop"] main .mb-12{margin-bottom:var(--s5)}
.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img){grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3)}
.site[data-bp="shop"] main .s-card{border:1px solid var(--line);box-shadow:none;border-radius:var(--r-card)}
.site[data-bp="shop"] main .s-card .p-img{aspect-ratio:1}
.site[data-bp="shop"] main .s-card>.p-5{padding:var(--s3)}
.site[data-bp="shop"] main .p-name{font-size:.95rem;line-height:1.25}
.site[data-bp="shop"] main .p-price{color:var(--accent);font-weight:700;font-size:1rem}
.site[data-bp="shop"] main .s-card .line-clamp-2{font-size:12px;display:none}
.site[data-bp="shop"] main .s-card details{display:none}
.site[data-bp="shop"] main .s-card .mt-auto{padding-top:var(--s2)}
.site[data-bp="shop"] main .p-wa{width:100%;justify-content:center;border-radius:999px;background:var(--accent);color:var(--on-accent);padding:.55rem .75rem;font-size:13px}
.site[data-bp="shop"] main .s-card .mt-auto>a[aria-label]{display:none}
.site[data-bp="shop"] main .gtk li{border:1px solid var(--line);border-radius:999px;padding:.3rem .7rem}
.site[data-bp="shop"] main .gtk{border:0;gap:var(--s2)}
.site[data-bp="shop"] main figure{border:1px solid var(--line);border-radius:var(--r-card);padding:var(--s4);background:var(--surface)}
.site[data-bp="shop"] main .rev-q{font-size:1rem;line-height:1.5}
@media (min-width:768px){
.site[data-bp="shop"] main .grid.sm\\:grid-cols-2:has(.p-img){grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s4)}
.site[data-bp="shop"] main .s-card .line-clamp-2{display:-webkit-box;font-size:13px}
.site[data-bp="shop"] main .p-name{font-size:1rem}
}
`;

/** The Collage body (Urban Company): everything in soft cards with a line and a shadow, icons in tinted boxes, services
 *  two across on a phone, a rounded gallery. */
const COLLAGE = `
.site[data-bp="collage"] main .sec-h2{font-size:clamp(1.75rem,6vw,2.5rem);letter-spacing:-.02em}
.site[data-bp="collage"] main .s-card{border:1px solid var(--line);box-shadow:0 8px 24px -16px rgb(0 0 0/.25);border-radius:var(--r-tile)}
.site[data-bp="collage"] main .icon-box{border-radius:var(--r-ctl);background:var(--p-soft);color:var(--accent)}
.site[data-bp="collage"] main .grid.sm\\:grid-cols-2:has(.s-card){gap:var(--s4)}
.site[data-bp="collage"] main .p-img{aspect-ratio:4/3}
.site[data-bp="collage"] main .p-wa{border-radius:999px}
.site[data-bp="collage"] main .rev-q{font-size:1.05rem;line-height:1.55}
.site[data-bp="collage"] main figure{border:1px solid var(--line);border-radius:var(--r-tile);padding:var(--s4);background:var(--surface)}
.site[data-bp="collage"] main section[data-reveal]:nth-of-type(2n){background:var(--paper-2)!important}
`;

/** The Poster body (Nham / Axiom): heavy uppercase headings, one section as a full accent band, photos with a hard
 *  offset shadow like a pinned print, square corners. */
const POSTER = `
.site[data-bp="story"] main .sec-h2{text-transform:uppercase;font-size:clamp(2rem,8vw,3.5rem);line-height:.95;letter-spacing:-.02em;max-width:14ch}
.site[data-bp="story"] main .sec-h2:lang(hi){text-transform:none;letter-spacing:0;line-height:1.15}
.site[data-bp="story"] main .kicker{letter-spacing:.18em}
.site[data-bp="story"] main section[data-reveal]:nth-of-type(3n+1){background:var(--accent)!important;color:var(--on-accent);--ink:var(--on-accent);--muted:color-mix(in srgb,var(--on-accent) 78%,transparent);--line:color-mix(in srgb,var(--on-accent) 25%,transparent);--surface:color-mix(in srgb,var(--on-accent) 10%,transparent);--paper-2:color-mix(in srgb,var(--on-accent) 8%,transparent)}
.site[data-bp="story"] main section[data-reveal]:nth-of-type(3n+1) .kicker{color:var(--on-accent);opacity:.8}
.site[data-bp="story"] main section[data-reveal]:nth-of-type(3n+1) .p-wa{background:var(--on-accent);color:var(--accent)}
.site[data-bp="story"] main .s-card{border:2px solid var(--ink);border-radius:var(--r-img);box-shadow:6px 6px 0 0 var(--ink);background:var(--surface)}
.site[data-bp="story"] main .s-card .p-img{border-bottom:2px solid var(--ink)}
.site[data-bp="story"] main .p-name{text-transform:uppercase;letter-spacing:.02em;font-size:1rem}
.site[data-bp="story"] main .p-price{font-size:1.25rem}
.site[data-bp="story"] main .p-wa{border-radius:0;border:2px solid currentColor;padding:.5rem .9rem}
.site[data-bp="story"] main .rev-q{font-weight:600;font-size:1.25rem;line-height:1.35}
.site[data-bp="story"] main .icon-box{border-radius:0;border:2px solid var(--ink);background:transparent;color:var(--ink)}
@media (min-width:1024px){.site[data-bp="story"] main .sec-h2{font-size:clamp(2.75rem,4.5vw,4.5rem)}}
`;

/** The Cinematic body with `style.body = "dark"` (Dishoom / Behrouz): every section on the ink field, light type, the
 *  accent only on rules and prices — the page stays a dark room from top to bottom. Default cinematic sites keep paper. */
const CINEMATIC_DARK = `
/* The dark room covers the header and the footer too, and the accent becomes the palette's light accent (noir: gold) —
   its mid is near-black, which left the buttons and the nav unreadable (review, 13 Oct 2026). */
.site[data-body="dark"]{--accent:var(--p-accent);--on-accent:var(--p-deep);--tc:var(--p-accent)}
.site[data-body="dark"] header.site-head{background:color-mix(in srgb,var(--hero-ink) 86%,transparent);border-color:color-mix(in srgb,var(--hero-text) 14%,transparent);color:var(--hero-text);--ink:var(--hero-text);--muted:color-mix(in srgb,var(--hero-text) 70%,transparent);--surface:color-mix(in srgb,var(--hero-ink) 90%,white);--border:color-mix(in srgb,var(--hero-text) 18%,transparent)}
.site[data-body="dark"] header.site-head a,.site[data-body="dark"] header.site-head button{color:var(--hero-text)}
.site[data-body="dark"] footer{--ink:var(--hero-text);--muted:color-mix(in srgb,var(--hero-text) 70%,transparent)}
.site[data-bp="cinematic"][data-body="dark"] main{--paper:var(--hero-ink);--paper-2:color-mix(in srgb,var(--hero-ink) 88%,white);--surface:color-mix(in srgb,var(--hero-ink) 90%,white);--ink:var(--hero-text);--muted:color-mix(in srgb,var(--hero-text) 70%,transparent);--line:color-mix(in srgb,var(--hero-text) 18%,transparent);--p-soft:color-mix(in srgb,var(--hero-text) 10%,transparent);background:var(--hero-ink);color:var(--hero-text)}
.site[data-bp="cinematic"][data-body="dark"] main .sec-h2{color:var(--hero-text);font-weight:400;font-size:clamp(2rem,7vw,3rem);letter-spacing:-.01em}
.site[data-bp="cinematic"][data-body="dark"] main .kicker{color:var(--gold,var(--accent))}
.site[data-bp="cinematic"][data-body="dark"] main .s-card{background:var(--surface);border:1px solid var(--line);box-shadow:none}
.site[data-bp="cinematic"][data-body="dark"] main .p-price{color:var(--gold,var(--accent))}
.site[data-bp="cinematic"][data-body="dark"] main .p-wa{border:1px solid var(--gold,var(--accent));color:var(--hero-text);background:transparent;border-radius:0}
.site[data-bp="cinematic"][data-body="dark"] main .gtk{border-color:var(--line)}
.site[data-bp="cinematic"][data-body="dark"] main .icon-box{background:var(--p-soft);color:var(--gold,var(--accent))}
.site[data-bp="cinematic"][data-body="dark"] main .rev-q{color:var(--hero-text)}
`;

/** On every blueprint a product PHOTOGRAPH fills its frame (cover), instead of floating inside it with padding like a
 *  cut-out on white — the trade templates and most owners' photos are photographs (review, 13 Oct 2026). */
const PHOTOS = `
.site[data-bp] main .p-price{white-space:normal;max-width:9ch}
.site[data-bp] main .p-img .kicker,.site[data-bp] main .p-img .num{background:var(--surface);color:var(--ink);padding:3px 8px;border-radius:999px;font-size:10px;letter-spacing:.08em}
@media (max-width:767px){.site[data-bp] main .rev-q{font-size:1.125rem;line-height:1.45}}
.site[data-bp] main .p-img>button{padding:0}
.site[data-bp] main .p-img img{object-fit:cover}
.site[data-bp] main .p-img{background:var(--paper-2)}
`;
export const BODY_CSS: Record<string, string> = { wordmark: PHOTOS + WORDMARK, shop: PHOTOS + SHOP, collage: PHOTOS + COLLAGE, story: PHOTOS + POSTER, cinematic: PHOTOS + CINEMATIC_DARK, bento: PHOTOS };
