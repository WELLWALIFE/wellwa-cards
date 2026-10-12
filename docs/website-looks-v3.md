# Website looks v3 — three more structures, from the market review (Oct 2026)

Owner's brief (12 Oct 2026): "market ke best templates banao; jo template wali sites hain unko visit karo, har field ki
badi company ki site ka review karo; har trade ke 5 template; is baar missing nahi chalegi." The first pass had only
re-painted the three v2 blueprints (same layout, new colours) and was rejected: "lagbhag same hi hai".

So the review was done with real screenshots, phone and desktop, viewed one by one (scratchpad `research/<trade>/`,
ten sites per trade: Indian leaders, world-class sites, Wix's newest designs, one local business). Three page
structures came up again and again that none of the v2 blueprints could draw. They are added here as blueprints 4–6;
the v2 rules (docs/website-looks-v2.md §2) hold for them too: the AI never writes HTML, content is built once, every
piece degrades, cheap phones first, old sites unchanged.

## 1. Wordmark (`wordmark`, hero `mark` / `mark-ink`) — src/components/site-wordmark.tsx
Seen on: Wix's newest bakery / café / burger designs (the name set as the whole hero, a strip of photos under it with
one colour tile), independent boutiques and studios.
- The business NAME is the hero: display font, clamp(3.25rem, 17vw, 5.5rem) on a phone, up to 11rem on desktop,
  stepping down for long names (`data-len`). Kicker (trade · city) above it; the claim, the benefit line and the trust
  row beside it (desktop) or under it (phone).
- Under it a strip: photo · photo · colour tile · photo (2×2 on a phone, 4 across on desktop). The tile is the
  accent colour and carries the ONE button (paper-filled), the open state, the address and the second action.
- No photo at all → `mark-ink`: the name on the ink field, the buttons under the words, no strip.
- Fits: cafés, sweets, restaurants, garments, boutiques, photographers, interiors, events, dance, printing.

## 2. Shop (`shop`, hero `shelf` / `shelf-ink`) — src/components/site-shop.tsx
Seen on: Haldiram's, Chaayos, Urban Company, Blue Tokai (the Indian pattern customers already know from apps).
- A row of round chips you scroll sideways: the card's products with their pictures when it has four or more, else
  the quick actions (WhatsApp, Call, Directions, Book, Offer).
- A promo banner: photo on one side (top on a phone), kicker · headline · benefit · the Order button on the other.
  No photo → `shelf-ink`: a solid deep-to-mid gradient of the palette.
- A fact strip under it: rating · open now · since · the offer. The products follow as the first section.
- Fits: kirana, sweets, garments, mobile, medical, gift, footwear, optical, hardware, furniture, online store, wholesale, dairy.

## 3. Collage (`collage`, hero `collage` / `collage-ink`) — src/components/site-collage.tsx
Seen on: Urban Company (words + a tile grid of services beside a 2×2 photo collage, the rating strip under it),
Practo-style clinic pages, home-services sites.
- Left: kicker · headline · benefit, then a card of quick-action tiles (4 across: WhatsApp, Call, Directions, Book,
  then the first services), the trust row and the buttons.
- Right (under, on a phone): a 2×2 collage of the card's photos (cover first; 3 → one tall + two; 2 → a pair; 1 → wide).
- No photo → `collage-ink`: the words and the tiles take the width.
- Fits: salons, spas, doctors, dentists, gyms, electricians, cleaning, auto, schools, coaching, hospitals, hotels.

## 4. What was wired
- `types.ts` (blueprint union, HERO_VARIANTS), `site-style.ts` (BLUEPRINT_KEYS), `site-blueprints.ts` (the three
  entries with `fits`), `site-hero.ts` (variants per blueprint, no-photo fallbacks, the tile-shaped focus pull),
  `trade-moods.ts` (default variant per blueprint), `site-designer.ts` (variant blurbs for the designer AI),
  `card-facts.ts` (looks type), `site-view.tsx` (hero switch and CSS include), `site-photos.ts` (the photo list).
- `site-server.ts applySiteTemplate`: a template that carries `site.style` / `site.home` now applies its DESIGN too
  (before, only the colour came along — the reason every template looked the same).
- `/templates/<key>/site`: a template drawn as the real website (the phone card preview was never the website).
- Templates per trade: `src/lib/template-variants.ts` — five designs per trade on five different structures, each with
  its own Pexels photos (`public/art/tpl/<trade>/`, free licence, credits.json beside them).

## 5. Still to do after the pilot
- Trade moods: `blueprints` is still a tuple of three; the designer's "three looks" should pick from six.
- The design review (`design-review.ts`) describes only the first three blueprints to the reviewer.
- Owner controls for the new heroes (which photos the strip / collage show; chip order on the shelf).
