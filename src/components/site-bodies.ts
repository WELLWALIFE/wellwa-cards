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
.site[data-bp="wordmark"] main section[data-reveal]:not(.hero-dark):nth-of-type(3n+2){background:var(--p-soft)!important}
.site[data-bp="wordmark"] main section[data-reveal]:not(.hero-dark):nth-of-type(3n){background:var(--paper)!important}
.site[data-bp="wordmark"] main .s-card{border:0;box-shadow:none;background:transparent;border-radius:0}
.site[data-bp="wordmark"] main .s-card .p-img{aspect-ratio:1;border-radius:var(--r-img);background:var(--paper-2)}
.site[data-bp="wordmark"] main .s-card>.p-5{padding-left:0;padding-right:0}
.site[data-bp="wordmark"] main .p-name{font-family:var(--font-display,var(--look-head));font-size:1.35rem;letter-spacing:-.01em}
.site[data-bp="wordmark"] main .p-price{font-family:var(--font-display,var(--look-head));font-size:1.35rem}
.site[data-bp="wordmark"] main .p-wa{border-radius:999px}
.site[data-bp="wordmark"] main .rev-q{font-family:var(--font-display,var(--look-head));font-size:1.5rem;line-height:1.3}
.site[data-bp="wordmark"] main .icon-box{border-radius:999px}
.site[data-bp="wordmark"] main .ledger{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.site[data-bp="wordmark"] main .ledger li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:var(--s4);align-items:center;padding:var(--s4) 0;border-bottom:1px solid var(--line)}
.site[data-bp="wordmark"] main .ledger-th{width:64px;height:64px;border-radius:var(--r-img);overflow:hidden;background:var(--paper-2)}
.site[data-bp="wordmark"] main .ledger-row{display:flex;align-items:baseline;gap:var(--s3);min-width:0}
.site[data-bp="wordmark"] main .ledger-name{font-family:var(--font-display,var(--look-head));font-size:1.2rem;line-height:1.2;letter-spacing:-.01em;color:var(--ink);text-decoration:none;min-width:0}
.site[data-bp="wordmark"] main .ledger-dots{flex:1 1 16px;min-width:16px;border-bottom:2px dotted var(--line);transform:translateY(-.3em)}
.site[data-bp="wordmark"] main .ledger-price{font-family:var(--font-display,var(--look-head));font-size:1.2rem;white-space:nowrap;color:var(--ink)}
.site[data-bp="wordmark"] main .ledger-price s{margin-left:.4em;font-size:.75em;color:var(--muted)}
.site[data-bp="wordmark"] main .ledger-sub{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s3);margin-top:4px;font-size:13px;color:var(--muted)}
.site[data-bp="wordmark"] main .ledger-desc{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;flex:1 1 200px;min-width:0}
.site[data-bp="wordmark"] main .ledger-badge{font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--accent)}
.site[data-bp="wordmark"] main .ledger-wa{display:inline-flex;align-items:center;gap:.3em;font-weight:600;color:var(--accent);text-decoration:none;white-space:nowrap}
@media (min-width:1024px){.site[data-bp="wordmark"] main .ledger{columns:2;column-gap:var(--s8)}.site[data-bp="wordmark"] main .ledger li{break-inside:avoid;grid-template-columns:72px minmax(0,1fr)}.site[data-bp="wordmark"] main .ledger-th{width:72px;height:72px}}
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
.site[data-bp="shop"] main .p-price{color:var(--accent);font-weight:700;font-size:1rem;text-align:left}
@media (max-width:767px){.site[data-bp="shop"] main .s-card .flex.items-start.justify-between{flex-direction:column;gap:2px}.site[data-bp="shop"] main .p-wa{font-size:12px;line-height:1.2;padding:.5rem .6rem}}
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
.site[data-bp="collage"] main section[data-reveal]:not(.hero-dark):nth-of-type(2n){background:var(--paper-2)!important}
`;

/** The Poster body (Nham / Axiom): heavy uppercase headings, one section as a full accent band, photos with a hard
 *  offset shadow like a pinned print, square corners. */
const POSTER = `
.site[data-bp="story"] main .sec-h2{text-transform:uppercase;font-size:clamp(2rem,8vw,3.5rem);line-height:.95;letter-spacing:-.02em;max-width:14ch}
.site[data-bp="story"] main .sec-h2:lang(hi){text-transform:none;letter-spacing:0;line-height:1.15}
.site[data-bp="story"] main .kicker{letter-spacing:.18em}
.site[data-bp="story"] main section[data-reveal]:not(.hero-dark):nth-of-type(3n+1){background:var(--accent)!important;color:var(--on-accent);--ink:var(--on-accent);--muted:color-mix(in srgb,var(--on-accent) 78%,transparent);--line:color-mix(in srgb,var(--on-accent) 25%,transparent);--surface:color-mix(in srgb,var(--on-accent) 10%,transparent);--paper-2:color-mix(in srgb,var(--on-accent) 8%,transparent)}
.site[data-bp="story"] main section[data-reveal]:not(.hero-dark):nth-of-type(3n+1) .kicker{color:var(--on-accent);opacity:.8}
.site[data-bp="story"] main section[data-reveal]:not(.hero-dark):nth-of-type(3n+1) .p-wa{background:var(--on-accent);color:var(--accent)}
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
.site[data-body="dark"] header.site-head .btn-primary{background:var(--p-accent);color:var(--p-deep)}
.site[data-body="dark"] .hero-dark .btn-primary{background:var(--p-accent);color:var(--p-deep)}
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
.site[data-bp] main .p-price{white-space:normal}
.site[data-bp] main iframe[title="Map"]{background:var(--paper-2)}
.site[data-bp] main .p-img .kicker,.site[data-bp] main .p-img .num,.site[data-bp="story"] main section[data-reveal] .p-img .kicker{background:#fff;color:#1a1a1a;padding:3px 8px;border-radius:999px;font-size:10px;letter-spacing:.08em}
@media (max-width:767px){.site[data-bp] main .rev-q{font-size:1.125rem;line-height:1.45}.site[data-bp] main .hl-grid .text-\\[15px\\]{font-size:13px}}
.site[data-bp] main .p-img>button{padding:0}
.site[data-bp] main .p-img img{object-fit:cover}
.site[data-bp] main .p-img{background:var(--paper-2)}
`;
/** The classic page with the split hero (words on paper beside a 4:5 photo — clinics, schools, CAs): calm bands in the
 *  palette's soft tint between paper sections, serif-weight headings, so it is a page of its own and not "the old
 *  site in a new colour" (review, 13 Oct 2026). */
const SPLIT = `
.site[data-bp="split"] main .sec-h2{font-size:clamp(1.9rem,6.5vw,2.75rem);letter-spacing:-.02em}
.site[data-bp="split"] main section[data-reveal]:not(.hero-dark):nth-of-type(2n){background:var(--p-soft)!important}
.site[data-bp="split"] main .s-card{border:1px solid var(--line);box-shadow:none;border-radius:var(--r-tile)}
.site[data-bp="split"] main .icon-box{border-radius:999px;background:var(--p-soft);color:var(--accent)}
.site[data-bp="split"] main .p-wa{border-radius:999px}
.site[data-bp="split"] main .rev-q{font-size:1.1rem;line-height:1.55}
`;
/** The Bento body: tile-shaped cards with a line, sections alternating the soft tint, so the board feeling carries down the page. */
const BENTO = `
.site[data-bp="bento"] main .s-card{border:1px solid var(--line);box-shadow:none;border-radius:var(--r-tile)}
.site[data-bp="bento"] main section[data-reveal]:not(.hero-dark):nth-of-type(2n+1){background:var(--p-soft)!important}
.site[data-bp="bento"] main .sec-h2{font-size:clamp(1.75rem,6vw,2.5rem);letter-spacing:-.02em}
.site[data-bp="bento"] main .icon-box{border-radius:var(--r-ctl);background:var(--p-soft);color:var(--accent)}
`;
/** "Why choose us" drawn differently per look: the one section that was a boxed 3+2 grid in every one of them
 *  (live check, 13 Oct 2026: "almost the same as before"). */
const WHY = `
.site[data-bp="wordmark"] main .hl-grid{display:block!important;border-top:1px solid var(--line);counter-reset:why}
.site[data-bp="wordmark"] main .hl-grid>div{border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;padding:16px 0!important;counter-increment:why}
.site[data-bp="wordmark"] main .hl-grid>div::before{content:counter(why,decimal-leading-zero);font-family:var(--font-display,var(--look-head));font-size:1.4rem;color:var(--accent);min-width:2.2em}
.site[data-bp="wordmark"] main .hl-grid>div>span:first-child{display:none}
.site[data-bp="cinematic"] main .hl-grid{display:flex!important;flex-wrap:wrap;gap:0!important}
.site[data-bp="cinematic"] main .hl-grid>div{flex:1 1 200px;border:0!important;border-left:1px solid var(--line)!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;padding:8px 20px!important}
.site[data-bp="shop"] main .hl-grid{display:flex!important;flex-wrap:wrap;gap:10px!important}
.site[data-bp="shop"] main .hl-grid>div{border-radius:999px!important;padding:8px 16px!important;width:auto!important}
.site[data-bp="story"] main .hl-grid{display:block!important}
.site[data-bp="story"] main .hl-grid>div{margin-bottom:10px;border-width:2px!important}
`;
/** The sections' own composition per look — the heading's place, the FAQ, the About picture and the gallery frames —
 *  so below the hero the six looks are six pages and not one page in six colours (live check, 14 Oct 2026: the
 *  section heights of all six looks were within 5% of each other). */
const SECTIONS = `
.site[data-bp="cinematic"] main section[data-reveal]:not(.hero-dark)>div>.flex.flex-wrap:first-child{justify-content:center;text-align:center}
.site[data-bp="cinematic"] main section[data-reveal]:not(.hero-dark)>div>.flex.flex-wrap:first-child .max-w-2xl{margin-inline:auto}
.site[data-bp="cinematic"] main .faq summary{text-transform:uppercase;letter-spacing:.08em;font-size:.9rem}
.site[data-bp="cinematic"] main img.rounded-3xl,.site[data-bp="cinematic"] main .group{border-radius:0}
.site[data-bp="cinematic"] main .columns-2,.site[data-bp="cinematic"] main .grid.grid-cols-2.gap-3{gap:2px}
.site[data-bp="cinematic"] main .columns-2>*{margin-bottom:2px}
.site[data-bp="story"] main .faq{border:0}
.site[data-bp="story"] main .faq details{border:2px solid var(--ink);box-shadow:5px 5px 0 0 var(--ink);margin-bottom:16px;padding:0 16px;background:var(--surface)}
.site[data-bp="story"] main img.rounded-3xl{border-radius:0;border:2px solid var(--ink);box-shadow:10px 10px 0 0 var(--ink);transform:rotate(-1.5deg)}
.site[data-bp="story"] main .group{border-radius:0;border:2px solid var(--ink)}
.site[data-bp="wordmark"] main .faq summary{font-family:var(--font-display,var(--look-head));font-size:1.45rem;letter-spacing:-.01em;padding-block:22px}
.site[data-bp="wordmark"] main img.rounded-3xl{border-radius:var(--r-img);aspect-ratio:4/5;max-height:640px;object-fit:cover}
.site[data-bp="wordmark"] main .group{border-radius:0}
.site[data-bp="shop"] main section[data-reveal]:not(.hero-dark)>div>.flex.flex-wrap:first-child{justify-content:center;text-align:center}
.site[data-bp="shop"] main section[data-reveal]:not(.hero-dark)>div>.flex.flex-wrap:first-child .max-w-2xl{margin-inline:auto}
.site[data-bp="shop"] main section[data-reveal]:not(.hero-dark) .sec-h2::after{content:"";display:block;width:48px;height:4px;border-radius:4px;background:var(--accent);margin:12px auto 0}
.site[data-bp="shop"] main .faq{border:0}
.site[data-bp="shop"] main .faq details{border:1px solid var(--line);border-radius:var(--r-card);margin-bottom:10px;padding:0 16px;background:var(--surface)}
.site[data-bp="shop"] main img.rounded-3xl{border-radius:var(--r-card)}
.site[data-bp="collage"] main .faq{border:0}
.site[data-bp="collage"] main .faq details{border:0;background:var(--p-soft);border-radius:var(--r-tile);margin-bottom:10px;padding:0 20px}
.site[data-bp="collage"] main img.rounded-3xl{border-radius:var(--r-tile);padding:10px;background:var(--surface);border:1px solid var(--line);box-shadow:0 12px 30px -18px rgb(0 0 0/.35)}
.site[data-bp="collage"] main .group{border-radius:var(--r-tile)}
`;
export const BODY_CSS: Record<string, string> = { split: PHOTOS + SPLIT, wordmark: PHOTOS + WORDMARK + WHY + SECTIONS, shop: PHOTOS + SHOP + WHY + SECTIONS, collage: PHOTOS + COLLAGE + SECTIONS, story: PHOTOS + POSTER + WHY + SECTIONS, cinematic: PHOTOS + CINEMATIC_DARK + WHY + SECTIONS, bento: PHOTOS + BENTO };
