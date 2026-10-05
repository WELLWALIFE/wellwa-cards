# Website looks v2 — three blueprints, stock first, AI pictures at Final

Owner's brief (5 Oct 2026): "ekdum latest and new look chahiye. Look ka matlab design change, colour hi nahi. 3 look rakho,
trade ke hisaab se; add / remove ke option do; pehle stock image, final par AI image." This file is the whole plan, so
nothing is built from memory. Code comments point here.

## 1. What the owner gets

1. "Make my website" builds ONE website's content (words, products, stock photos, clip on Premium) — 1 to 2 minutes, as
   today, now as a server job (`src/lib/card-jobs.ts`).
2. The designer AI returns **three plans** for that content, each on a **different blueprint** (§3). The phone shows the
   three as thumbnails; a tap swaps the whole design on the spot (no build, no credit, no wait).
3. The owner adjusts the chosen look (§6): tiles and sections on / off, order, dark / light, photo swaps, words (editor).
4. **Final** ("Make it live"): the site goes live at once with its stock pictures. On Premium a background job then makes
   the AI banner (and up to two gallery pictures when the owner has fewer than two of their own) **in the chosen look's
   colour and mood**, swaps it in, re-runs the banner focus, and tells the owner (push / WhatsApp). The owner can Keep,
   Make another (credits), or go Back to stock.
5. Another look later: "Write again" (Premium, credits) — words and/or a new plan; never pictures by itself.

Cost per website stays what it is today: one copy call, one design call (three plans instead of one — a longer output,
not another call), one design review (on the chosen look only), one banner on Premium (made once, at Final, never for a
rejected look). Stock photos are the trade's cache. Nothing is paid for a look the owner does not keep.

## 2. Hard rules (so there are no mistakes)

- **The AI never writes code or HTML.** It picks from the renderer's menu (blueprint, palette, font, hero, sections, layouts,
  tiles) and writes words. Every site is drawn by our components, so edit, preview, looks, speed and safety hold for all.
- **Three plans, three different blueprints**, every time. Plan 1 is the designer's pick for this business.
- **Content is built once.** A look is `site.style` (+ `site.home.order`, `site.hero.tiles`); swapping it touches nothing else.
- **No picture is paid for before Final.** `referenceImages` is never called inside the build. Free never calls it at all.
- **Everything degrades.** A tile / slide / scene whose content is missing is not drawn; a blueprint that cannot fill its
  hero (no photo at all) falls back to the next blueprint, never to a blank.
- **Cheap phones first.** Each blueprint ≤ 2 s to first content on a 4× CPU-slowdown / slow-4G profile; animations are
  CSS (`transform`/`opacity` only), honour `prefers-reduced-motion`, and no new library over 10 KB gzipped.
- **Old sites keep working.** A card without `site.style.blueprint` renders as before (`classic` = today's renderer).
  Shared pieces (§4) that read content only (sticky bar, open-now, product sheet) appear on old sites too.

## 3. The three blueprints

`SiteStyle.blueprint: "bento" | "cinematic" | "story"` (unset = `classic`, today's page). A blueprint sets the page's
**structure**; palette, font, radius, pattern, motion stay the designer's per-business choices on top of it.

### 3.1 Bento — "sab kuch ek nazar mein"
- **Hero = tile board** (2 columns on phone, 4 on desktop), tiles drawn only when the card has the content:
  `photo` (big, 2×2; the cover / first stock photo; Ken Burns; the clip on Premium), `name` (business, one line, city chip,
  logo), `rating` (Google ⭐ avg · count), `open` (open-now from hours, §4.2), `call`, `whatsapp`, `map` (address → directions),
  `offer` (current offer), `product` (first product, price), `since` (years in business), `booking` (appointment CTA).
  Default order: photo, name, call+whatsapp (one 2×1 tile), open, rating, map, offer, product, since.
  `site.hero.tiles?: TileKey[]` overrides which and in what order (owner's controls, §6).
- **Nav**: transparent over the board, then frosted glass (`backdrop-filter`, 60% bg) once scrolled; logo, three anchors,
  Call button.
- **Sections**: glass cards on an **aurora** background (two soft radial gradients from the palette's mid + accent, drifting
  slowly; still under reduced motion). Products in a 2-col card grid with the product sheet (§4.3); services as cards;
  reviews as a marquee (§4.5); stats as count-up (§4.4).
- **Fits**: shops, services, clinics, mobile, hardware, kirana — the all-rounder; the designer's default for most trades.

### 3.2 Cinematic — "film jaisa"
- **Hero = full viewport** (`100svh`): the cover photo (Ken Burns, 20 s ease) or the clip (Premium, muted, loop) under a
  bottom-to-top dark gradient; the headline rises from the bottom (one `translateY` + fade), the sub-line and two CTAs
  follow; a thin scroll cue. Text side from `site.hero.textSide`.
- **Nav**: hidden until the hero is 60% scrolled, then slides in on glass.
- **Sections = scenes**: each section full-width with a parallax image band between scenes (`background-attachment`
  avoided — a `transform`-based parallax at 0.3×, off under reduced motion); large heading (serif or heavy per font pair);
  **products in a horizontal rail** (scroll-snap cards, 1.5 visible on phone) with the product sheet; reviews as one big
  quote that crossfades; photos as full-bleed mosaic.
- **Fits**: hotel, restaurant, gym, jewellery, car dealer, events, salon, wedding, real estate — premium and "dum" trades.
- **Needs**: at least one landscape photo (always true: stock). Clip only on Premium.

### 3.3 Story — "Instagram jaisa, phone ke liye"
- **Phone**: vertical `scroll-snap` full-screen slides, progress dots on top (one per slide, fills as you go), tap right /
  swipe to advance; each slide is one thing: `cover` (photo + name + city), `what` (what we do / sell, 3 lines), `products`
  (3 at a time, swipe sideways), `why` (why-us points), `photos`, `reviews` (one per slide, max 3), `offer`, `contact`
  (Call · WhatsApp · Map · hours, big). Slides the card lacks are skipped.
- **Desktop**: the same slides inside a phone frame (390×844) centred, beside the business name, the key facts and the QR;
  arrow keys / wheel move slides.
- **Fits**: cafes, bakeries, garments, boutiques, salons, photographers, tuition, fitness trainers, home businesses —
  anything customers reach from Instagram / WhatsApp.
- **Needs**: nothing beyond the card. Every card can wear it.

### 3.4 What a blueprint fixes vs what the designer still chooses

| | Bento | Cinematic | Story |
|---|---|---|---|
| Hero structure | tile board | full-screen scene | cover slide |
| Nav | glass on scroll | hidden → glass | none (dots) |
| Products | grid + sheet | rail + sheet | product slides |
| Reviews | marquee | big quote | review slides |
| Photos | mosaic tiles | full-bleed band | photo slide |
| Background | aurora | dark gradient scenes | per-slide photo / palette |
| Designer chooses | palette, font, radius, tiles, order | palette, font, order | palette, font, slide order |

## 4. Shared smart pieces (every blueprint, old sites too where content-only)

1. **Sticky bottom bar** (phones): Call · WhatsApp · Direction — from the card's phone, WhatsApp link and address; hidden
   while a sheet is open; safe-area padded. Not on Story (its contact slide and dots own the bottom).
2. **Open now**: from the card's hours block (IST): "Open now · till 8 pm" / "Opens 10 am" / "Closed today"; a green or
   amber dot; recomputed every minute on the client; absent when there are no hours.
3. **Product sheet**: tap a product → bottom sheet (photos swipe, name, price / MRP, benefits, "Ask on WhatsApp" with the
   product name prefilled); URL hash `#p=<id>` so Back closes it; no page change.
4. **Count-up stats**: only facts the card has (years since `since`, customers, Google rating/count, products count);
   count from 0 on first view (IntersectionObserver), instant under reduced motion. Never invents a number.
5. **Marquee**: a slow continuous strip (photos or reviews) with `animation-play-state: paused` on hover/touch and off
   under reduced motion; duplicates the track for a seamless loop.
6. **Reveal**: sections and cards fade + rise + un-blur once (stagger 60 ms, max 6 per group); one observer for the page.
7. **Ken Burns**: a 20 s slow zoom/pan on hero photos; off under reduced motion; never on the clip.

## 5. The designer AI (`src/lib/site-designer.ts`)

- **Input** stays the brief (business, trade, city, products, reviews, photos, hours, liked site, logo colour) plus a
  **trade mood brief** from `src/lib/trade-moods.ts`: per trade key — default blueprint ranking (3 of 3 in order), mood
  words, palette family, font family, tile picks, section order hints, what to avoid. Example: `gym`: cinematic > bento >
  story; dark, neon accent, heavy type; tiles: photo, name, offer, call/whatsapp, open; order: catalog (plans), whyUs,
  photos, reviews. `jewellery`: cinematic > bento > story; ivory/gold, serif, showcase products, rings pattern.
  `cafe`: story > bento > cinematic; warm, rounded, photos first, offer.
- **Output** (JSON): `{ plans: [ {blueprint, palette, color?, font, hero?, radius, motion, pattern, tiles?, order, layouts?,
  why}, ×3 ], why }` — three different blueprints; plan 1 is the pick. `cleanPlans()` validates every field against the
  menu, drops duplicates, and **fills in** from the mood brief when the AI returns fewer than three or an invalid one
  (never fails the build; a build with no AI plan gets the mood brief's three).
- **Applied**: `card-compose` applies plan 1 (as today), the build response carries `looks: Plan[3]`; the phone's picker
  shows the three (name = blueprint, swatch = palette, blurb = why), and `applyLook` sets `site.style` + `site.home.order`
  + `site.hero.tiles` from the chosen plan. The chosen plan is saved on the card (`site.style.blueprint`); the other two
  are kept in the draft so switching back needs no call.
- **Review** (`design-review.ts`) runs on plan 1 only, with a blueprint-aware checklist (§8).

## 6. Owner controls (preview and Edit website; instant; no build; no credit)

- **Tiles** (Bento): on/off chips for each tile the card can fill; drag or ▲▼ to reorder → `site.hero.tiles`.
- **Sections** (all): on/off and reorder for the home sections → `site.home.order` (the editor's page tools stay for pages).
- **Dark / light**: swaps the palette to its sibling (each palette names a `dark` / `light` partner in `site-style.ts`).
- **Clip / photo** (Premium): hero uses the clip or the photo → `site.hero.video: boolean`.
- **Photo swap**: pick another of the trade's twelve, or upload — as today.
- **Words**: the editor as today; "Write again" for AI words (credits).
- Publish saves; "Make it live" for the first site is automatic as today.

## 7. Stock first, AI pictures at Final (Premium)

- Build: `/api/card/build` never calls `referenceImages`. The preview on Premium shows, on the hero, a small tag:
  "✨ Final karne par aapka Premium banner isi look mein banega".
- Final: `publish()` / `goLive()` → after the card is live, `POST /api/card/banner { card }` starts a job
  (`card-jobs.ts`, kind `banner`): `referenceImages(me.id, { trade, brand, city, dark: palette.dark, color: palette.mid,
  banner: true, count: 1 + (ownPhotos < 2 ? 2 : 0) })` → store → patch the live card's `coverUrl` / `site.hero.imageUrl`
  (+ gallery when made) → `bannerFocus` → publish → notify `website_ready` ("Aapka Premium banner lag gaya").
- The preview / Card & Website screen shows "Banner ban raha hai…" while the job runs and, when it lands: **Keep** ·
  **Make another** (credits, `writeAgainCredits` for one picture) · **Back to stock**.
- Write again: words and plan only; "new banner / new photos" wants go through the same banner job, charged as today.

## 8. Quality gates

- **Design review** prompt knows the blueprint: Bento — no empty or repeated tile, every tile's text fits, the board
  reads top-left to bottom-right; Cinematic — headline legible on the photo (gradient strong enough), rail cards whole;
  Story — every slide full, no slide with only a heading. Screenshots at 390 px (phone) and 1280 px.
- **Speed**: Playwright on the demo card per blueprint, 4× CPU slowdown, slow 4G: first contentful ≤ 2 s, no layout shift
  from fonts (preload the pair), hero image `fetchpriority=high`, the rest lazy.
- **Trade check** (`scripts/trade-check`): every trade's mood brief yields three valid, different plans without AI.

## 9. Build order (and what the owner sees when)

1. **Plumbing** — `blueprint` on `SiteStyle`, blueprints registry, three looks from plans, picker shows three. *(nothing visible yet)*
2. **Shared pieces** (§4) — sticky bar, open-now, product sheet, count-up, marquee, reveal, Ken Burns. *(old sites improve)*
3. **Bento** — hero board, glass nav, aurora, sections. *(first demo on the demo account)* ← owner confirms direction here
4. **Cinematic**, then **Story**.
5. **Designer AI** — three plans, mood briefs for all 79 trades, picker wired to plans.
6. **Stock first / banner at Final** (§7).
7. **Owner controls** (§6).
8. **Quality gates** (§8) and the trade check.

Each step is one commit and a deploy; nothing waits for the whole.
