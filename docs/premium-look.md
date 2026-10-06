# Premium look — hero first (build plan, Oct 2026)

Owner's brief (5 Oct 2026): "look of website is not premium — isko premium look do" and "main hero banner style ko
professional banao". This file is the whole plan; a fresh session builds from it. Nothing here adds AI calls, credits, JS
libraries or runtime dependencies.

## Status (6 Oct 2026)

Built: step 0(a) (hero photo = `coverUrl` only), fixtures in `scripts/trade-check/cards/` (stock poster banners, a Hindi card, a
no-photo card), steps 1–7 (tokens, self-hosted fonts with Devanagari, `HeroModel`, trade copy, icons, shared hero pieces,
Cinematic cover + cover-ink, Bento board + board-statement + board-ink, Story slide-photo + slide-ink + slide-duo + slide-type),
step 8 as a light re-skin (`ClassicHero` stays inside site-view.tsx: cover / split / ink), step 10 (designer menu, `derive`,
blueprint defaults, design-review prompt, LookTweaks labels), §4 sections, §5 removals, §4.10 preview strip, `look-shots.mjs`
with `?shot=1` and Hindi shots. The owner kept the Cinematic composition ("cinematic design bahut acha hai") and asked for Bento
and Story to change — both were rebuilt. Not yet: step 9 (`heroMedia` → `lqip`/`bright`/per-photo `focus` at every `coverUrl`
write; the heroes already read the fields), step 11's remaining variants (board-photo-first, board-still, cover-split,
cover-centre), step 12's SSR speed route and the 79-trade sweep.

## Owner's summary (short)

- **Hero banner, first**: one big headline (a claim, not "Name / trade / trade"), the trade and city once in a small line above it,
  one line of benefit, a quiet trust row (★ rating · Est. year · Open now), ONE filled button (WhatsApp) + one plain one (Call).
  No pile of pill badges, no emoji, no monogram square, no full dark wash over the photo — only the bottom of the photo is dimmed
  where the text sits.
- **Three looks stay three**: Bento = calm paper board; Cinematic = full-bleed photo cover; Story = one converting first slide.
  Each has a proper version when there is no photo.
- **Premium = restraint**: ink + one accent + warm paper, serif/sans pairs per trade (jeweller ≠ gym ≠ clinic), gold only as a
  thin line, no gradients, no neon tiles, no "AI purple". Hindi text gets its own real fonts.
- **No new cost**: no AI calls, no credits, no libraries; fonts self-hosted; first paint on a slow phone stays under 1.5 s.
- **Build order**: §6 — root causes, tokens, copy model, shared pieces, then Cinematic → Bento → Story → Classic; screenshots
  after each step (§7). §8 lists the five decisions only the owner can make.

(The audit screenshots are in the session scratchpad, not in the repo; step 0 commits proper fixtures to `scripts/trade-check/cards/`.)

## 0. What "premium" means here (each rule with its test)

| # | Rule | One-line test |
|---|---|---|
| 1 | **Type leads, photo supports.** Headline = largest, darkest, first-painted object. | Cover the photo: the hero still looks designed. |
| 2 | **Copy sells, data sits in one line.** Headline = claim or name; trade once, in the kicker; never the slug. | Trade word ≤ 1× on screen one; no "/" in a heading. |
| 3 | **Three control shapes.** Filled primary (`--r-ctl`), ghost secondary, plain meta. | `grep rounded-full` = 0 in `site-hero.ts`, `site-icons.tsx`, blueprint files, `ClassicHero` (avatar, open-dot excepted). |
| 4 | **Ink + one accent + warm paper.** Accent only on primary CTA, kicker, one hairline. | ≤ 2 saturated fills above the fold (primary CTA, WhatsApp). |
| 5 | **Photo dimmed only where text sits.** Bottom/side tinted-ink scrim; never a full wash or blur. | Top 40 % of a cinematic hero ≥ 90 % native brightness. |
| 6 | **Paper, not white; ink, not black.** Every surface and text is a tint of the hue. | No `#fff`/`#000` in `--paper`/`--ink`; sub ≥ 4.5:1. |
| 7 | **Devanagari is first-class.** Family resolves on first visit, H1 lh ≥ 1.22, tracking 0, no uppercase. | `?lang=hi` shot: Tiro/Mukta glyphs, matras intact. |
| 8 | **Fast first.** HTML + inline CSS + one image paint the hero; fonts swap without shift; motion = opacity/transform. | `speed.mjs`: FCP ≤ 1.5 s, LCP ≤ 2.5 s, CLS < 0.02. |
| 9 | **Three blueprints stay three.** Board (paper) vs cover (full-bleed) vs slide (snap). | Same card, three heroes: no shared layout. |

Scope: ship **one default hero + one no-photo fallback per blueprint**, screenshot the 8 audit cards, then §3.7's "Then" column.

## 1. Audit — evidence in `scratchpad/look-audit/*.png`

1. **Same photo under every trade** (all eight): the water-ioniser frame, blurred, 35–40 % black. Root cause: the fixtures have
   no `coverUrl`, and `site-view.tsx:179` (`heroImg = hero.imageUrl ?? firstProductPhoto(card)`) + `:409-416`
   (`photo={card.coverUrl || heroImg}`) promote the placeholder *product* image to the hero. (`warm-trade-media.mjs` has no banner
   key; `card-compose.ts:672` sets `coverUrl` = `facts.bannerUrl || /api/stock/banners/<cat>.jpg || coverArtFor()`.)
2. **Upgrade strip eats the hero**: 290 of 844 px.
3. **Pill soup**: 5–7 identical 9999 px chips per hero (`doctor-en-phone-hero`: 7 controls, headline 27 %).
4. **Emoji + numeric-fallback icons** (📍💳 `jewellery-bento-desk-hero`; "5", "6" `jewellery-cin`).
5. **Slug copy**: "Test Cafe / tea stall" ×3 (`cafe-story-phone-hero`), "Test Gym / fitness / yoga" wrapping on "/", no "Dr.".
6. **Monogram gradient square** twice above the fold (`jewellery-bento-*`, `cafe-story-desk-hero`).
7. **Neon tiles**: `#25D366` + orange CTA tiles; three WhatsApp affordances.
8. **Gradients everywhere**: radial glow, lavender `#eef0ff`, purple WhatsApp button, H2 underline, dots.
9. **Fonts fall through**: body in a DejaVu-like sans (stylesheet in `<body>`, 400–800 per family, `site-style.ts:140-144`).
10. **Stats "0★ / 0+"** without JS.
11. **Story desktop duplicates the hero**: two headlines, "arrow keys" dev UI, dynamic island; slide 1 lacks a CTA.
12. **Classic builds**: navy multiply wash, `+919876543210` pill, yellow WhatsApp button, truncated nav title.

## 2. Design tokens

`siteDesign()` (`src/lib/site-style.ts:199-218`) emits tokens into the inline `<style>` at `site-view.tsx:335`; static rules sit
in `globals.css` under `.site`. Every name it emits today (`:206-215`) and `--tc` (`site-view.tsx:338`) stays as an alias for
one release, so classic sites and `site-view.tsx` sections keep their colour: `--p-deep → --hero-ink`, `--p-mid/--p-accent/--p-mark/--tc → --accent`,
`--p-glow → --accent-soft`, `--p-ink → --hero-text`, `--p-on → --on-accent`, `--p-soft → --paper-2`, `--p-foot → --hero-ink`,
`--p-foot-ink → --hero-text`, `--r → --r-card`, `--look-head/--look-body/--head-w` → the set's faces and weight.
`--grad` is deleted (every use → `var(--accent)`); the `--tc` dark-mode `<style>` at `:340` goes (§2.3).

### 2.1 Fonts — `FONT_SETS` (new; `FONT_PAIRS` keys stay as aliases for `cleanStyle` / reference mapping)

| key (alias of) | Display Latin, weight | Text Latin | Devanagari display / text | Default trades |
|---|---|---|---|---|
| `luxury` | Instrument Serif 400 + ital | Inter 400;500;600 | Tiro Devanagari Hindi / Noto Sans Devanagari | jewellery, boutique, hotel |
| `elegant` | Playfair Display 400;500 | Inter | Tiro Devanagari Hindi / Hind | bridal, salon, garments, events |
| `editorial` | Newsreader 400;500 (static) | Inter | Noto Serif Devanagari / Mukta | CA, lawyer, coaching, ayurveda |
| `warm` (friendly) | Fraunces 400;500 (static, no axes) | Manrope 400;600 | Yatra One / Mukta | cafe, sweets, bakery, restaurant |
| `clinic` (new) | DM Serif Display 400 | DM Sans 400;500 | Noto Serif Devanagari / Hind | doctor, dentist, hospital, lab |
| `honest` (new) | Lora 500 | Mukta 400;600 | Mukta 600 / Mukta | kirana, dairy, agri, hardware |
| `bold` | Bricolage Grotesque 600;700 (static) | Inter | Hind 700 / Hind | gym, electronics, auto |
| `tech` (modern) | Space Grotesk 600 | Inter | Hind 600 / Hind | IT, repair, courier |
| `hindi` | Tiro Devanagari Hindi 400 | Mukta | native | Hindi-first (not Baloo 2) |

Rules. Serif display ≤ 500; sans display 600–700 with `-0.02em`. Two families, three weights max. Devanagari kicker:
`:lang(hi) .kicker { letter-spacing: 0; text-transform: none }` (tracking breaks conjunct shaping; uppercase is a no-op), 600,
13 px. Hindi H1 ×0.88, `--display-lh: 1.22`, `--display-tr: 0`, body lh 1.65 — via `:lang(hi)`, `lang` on `.site`.

Loading — **self-hosted** (decision): `fonts.gstatic.com` URLs are versioned and UA-dependent, and a remote stylesheet's faces
take no `unicode-range`. `scripts/fetch-fonts.mjs` (dev) downloads the latin + devanagari static subsets into
`public/fonts/<family>-<wght>[-deva].woff2` and writes the `@font-face` block into `globals.css` under `.site`: one face per file,
`unicode-range: U+0900-097F, U+1CD0-1CFF, U+A8E0-A8FF` on Devanagari files (downloaded **only when a Devanagari glyph paints**),
`font-display: swap` everywhere (never `optional`). The Devanagari text family is **always** in the
stack — `"<Deva text>", "<Latin text>", SansFb` — because the visitor `LanguagePicker` (`site-view.tsx:189,387`) switches `L.lang`
at runtime; `card.language` (`hiLang`, `:156`) is only the build language, and `lang` on `.site` = `L.lang`. The Devanagari display face joins the H1 stack when `card.language === "hi"` or the name matches `/[ऀ-ॿ]/`; else Hindi H1 uses
the Deva text face at 600. CLS: per-family `size-adjust`/`ascent-override`/`descent-override`/`line-gap-override` in
`FONT_METRICS` (`site-style.ts`), computed once by `scripts/font-metrics.mjs` (woff2 `hhea`/`OS/2` via `fontkit`, devDependency)
against Arial (sans) and Times New Roman / Android Noto Serif (serif) — one `SerifFb` over Georgia cannot fit six serifs, and Android
lacks Georgia. `fontHref()` (400–800, `site-style.ts:140-144`) → `fontCss(set)` + `fontPreload(set)` (URLs for
`<link rel="preload" as="font" type="font/woff2" crossorigin>` in `app/c/[username]/render.tsx`). **First-paint budget**: preload
2 files — display 400 latin static (~28–36 KB) + text as **one variable file** (`Inter[wght]` latin ~45 KB; Manrope/DM Sans/Mukta
likewise, wght 400–600); the Devanagari text file (~55–70 KB) downloads only when Hindi paints; display italic (reviews) and
500/600 never preloaded. Gate: ≤ 2 preloaded, ≤ 3 downloaded, ≤ 150 KB.

### 2.2 Type scale (vars on `.site`)

| Role | Phone 390 | Desktop 1440 | lh / tracking / weight |
|---|---|---|---|
| `--t-display` H1 | `clamp(2.5rem, 11vw, 3.25rem)` 40–52 px | `clamp(4.5rem, 6vw, 5.5rem)` 72–88 px | .98 / −.02em serif, −.03em sans; hi 1.22 / 0 |
| `--t-h2` | 30 px | 44 px | 1.05 / −.015em |
| `--t-kicker` | 11 px | 12 px | 1 / +.12em uppercase / 600 (hi: 13 px, tracking 0, no uppercase) |
| `--t-sub` | 17 px | 19 px | 1.45; `max-width: 34ch`; `text-wrap: pretty` |
| `--t-body` | 15 px | 16 px | 1.6 (hi 1.65) |
| `--t-meta` trust | 13 px / 500 | 13 px | 1.4, `--muted`, `tabular-nums` |
| `--t-cta` | 15 px / 600 | 15 px | tracking 0 |
| `--t-stat` | 26 px | 28 px | `lining-nums tabular-nums`, 12 px label |

H1: `text-wrap: balance`, ≤ 2 lines; `data-len="long"` (≥ 28 chars) → 44/72 px.

### 2.3 Colour — derived per hue

Input `h` = hue of `palette.mid` (or logo colour), `tone` light|dark → `oklchVars(h, tone)` in `site-style.ts`. **Every colour
is emitted as sRGB hex first, OKLCH second** (`oklchToHex()` ≈ 40 lines, no dependency): Chrome/WebView < 111 drops OKLCH. No
`color-mix(in oklch)`.

```
--h: <hue>
--paper      oklch(97% .012 h)        --paper-2   oklch(94% .018 h)
--ink        oklch(22% .025 h)        --muted     ink / .64        --line  ink / .10
--accent     oklch(48% min(C,.13) h)  (C ≤ .09 for h in [70,100]: gold is a line, never a fill)
--accent-soft oklch(93% .04 h)        --on-accent  by contrast (paper or ink)
--hero-ink   oklch(15% .02 h)         --hero-text  oklch(97% .01 h / .94)   dark-muted / .64   dark-line white / .12
--wa         #1faa5c on paper, #25D366 on dark — WhatsApp control only
--scrim-bot  hero-ink / .82 (bright photo: .90)   --scrim-mid / .45   --scrim-top transparent
--star       var(--accent) (never #f5b301)

tone: dark   --paper oklch(18% .02 h)  --paper-2 oklch(22% .025 h)  --ink oklch(95% .01 h)  --muted ink/.70  --line ink/.14
             --accent oklch(72% min(C,.13) h)  --accent-soft oklch(30% .05 h)  --on-accent = light-row ink  --hero-* unchanged
```

`SITE_PALETTES` (`site-style.ts:68-84`): the 15 keys **survive as hue + tone presets** — each gains `h` (hue of `mid`), keeps
`tone`; `oklchVars(h, tone)` derives the rest, so stored styles, `menu()` (`site-designer.ts:74-75`), `cleanStyle()` (`:254`) and
`otherTone()` (`components/poster/look-tweaks.tsx:15-26`) are unchanged; hex fields stay for the phone card.

**App theme is ignored by the website.** `globals.css:37-45,81-83` flip `--surface/--border/--ink` under
`prefers-color-scheme: dark` / `[data-theme=dark]`; `.site` paints `var(--surface)` (`site-view.tsx:337`) and tiles use
`bg-surface/text-ink/border-border` — navy under "paper" tiles. `.site` redefines `--surface: var(--paper);
--surface-2: var(--paper-2); --border/--border-strong: var(--line); --ink; --muted; --faint: var(--muted)` and sets
`color-scheme: light` (`dark` for `tone: dark`).

Luxury preset (`luxe: true` in the mood brief: jewellery, bridal, hotel, banquet): `--paper oklch(96% .015 85)` ivory,
`--ink oklch(24% .03 60)` espresso, `--gold oklch(72% .09 85)` **only** for 1 px rules, kicker text, icon strokes — no gold fills or
gold on black. 60-30-10: paper/ink 60, photo 30, accent 10. Accent never on headline text, never a gradient. Dark heroes (cover,
slide, `*-ink`) use `--hero-ink` + `--hero-text`; bento and classic use paper.

### 2.4 Radius, elevation, spacing, icons

- Radius: `--r-ctl 12px` (controls), `--r-card 16px`, `--r-tile 20px`, `--r-img 8px`; `RADII` keys → sharp 4/8/12/4, soft
  12/16/20/8, round 16/24/28/12. 9999 px only for avatars and the open-dot; the `.rounded-*` overrides (`site-view.tsx:335`) map onto these.
- Elevation per blueprint `--elev: line | shadow | none` (bento line, cinematic shadow, story none, classic line): `.s-card`
  renders **either** `border: 1px solid var(--line)` **or** `box-shadow: 0 1px 2px ink/.06, 0 8px 24px ink/.06`, never both.
  `--e-1` (shadow) only for floating sheets and the sticky bar.
- Spacing `--s1..--s9` = 4 8 12 16 24 32 48 64 96; section `padding-block: clamp(3rem, 8vw, 6rem)`; gutter 20 / 64 px; content
  1120 px; hero text column ≤ 560 px.
- Icons: new `src/components/site-icons.tsx`, 18 inline SVG line icons (pin, phone, whatsapp, clock, star, rupee, truck, receipt,
  check, arrow-right, arrow-up-right, chevron-down, directions, calendar, shield, tag, map, menu), 16 px, 1.5 px, `currentColor`. `stripEmoji()` (`/\p{Extended_Pictographic}/u`) on highlights; keyword → icon or dropped. Lucide only in the nav.
- Grain: inline **SVG** data-URI (`<svg><filter id=n><feTurbulence type=fractalNoise baseFrequency=.8 numOctaves=2
  stitchTiles=stitch/></filter><rect width=100% height=100% filter=url(#n)/></svg>`, ~350 B; a noise PNG is 10–20 KB) as
  `.hero-grain { opacity:.07; mix-blend-mode:overlay }`, dark heroes, **inside `@media (min-width:768px)` only** (SVG filters are
  paint-heavy).

## 3. The hero system

### 3.1 `HeroModel` — new `src/lib/site-hero.ts`

```ts
export type HeroModel = {
  kicker: string;                 // "JEWELLER · REWARI" | "DR · DERMATOLOGIST · JAIPUR" | "ज्वेलर · रेवाड़ी"
  name: string;                   // website-only sanitised; "Dr." per honorific(); never "/"
  headline: string;               // AI (≤ 6 words, ≠ name) else TRADE_HEADLINE[group][lang]
  sub: string;                    // ≤ 90 chars; never "<Trade> in <City> since <Y>."
  trust: { rating?: {v:number; n:number}; since?: number; city?: string; open?: {state:"open"|"closed"; until:string} };
  primary: { label: string; href: string; kind: "whatsapp"|"call"|"book" };
  secondary?: { label: string; href: string };            // "Call +91 98765 43210" (fmtPhone)
  photo?: { src: string; focus: string; lqip?: string; bright: boolean; dark: boolean };
  clip?: { url: string; poster: string };                 // Premium clip (card.site.hero.video !== false)
  logo?: string; wordmark: boolean;                       // wordmark when no owner logo
  variant: HeroVariant;                                   // style.heroVariant, §3.7
};
```

`heroModel(card, lang)` is the **only** source for all four heroes:
- **Name sanitiser** runs **only here**: `"Test Gym / fitness / yoga"` → `Test Gym`, first alt → kicker label.
  `card-compose.ts:636` (`setup.business` → `company`, vCard, SEO, `botKnowledge`) stays untouched.
- `kicker` = `${TRADE_LABEL} · ${city}`. `honorific()` prepends `Dr.` **only when `card.lead !== "business"` and
  `setup.category ∈ {doctor, dentist, ayurveda}`** (the mood group also matches `hospital|pharma|water|wellness` — never "Dr. City
  Hospital"). Speciality = first `facts.tradeAnswers` value, else omitted (`card.jobTitle` is only the trade label).
- `clip`: `cover` and `slide-photo` only (never bento or `-ink/-split/-centre/-duo`), **desktop only** on `cover` (phone shows the
  poster), `preload=metadata muted loop playsInline`; poster gets the LQIP/`bright` treatment; Ken Burns **off** while it plays
  (`<video>` today: `site-cinematic.tsx:25`, `site-story.tsx:71`).
- `headline`: `site.hero.headline` if AI-written, ≤ 6 words, ≠ name; else `TRADE_HEADLINE` — 14 rule groups × {en, hi} in
  `trade-moods.ts` (jewellery "Hallmarked gold, honest prices" / "हॉलमार्क सोना, सही दाम"; clinic "Care you can walk in for"; gym
  "Stronger every week"). Zero AI cost.
- `sub`: `site.hero.sub` if ≤ 90 chars and not the auto pattern; else `${benefit}. ${city}.` from the group.
- Trust row ≤ 3 items joined by `·`: `★ 4.7 (31)`, `Est. 2015`, `● Open · till 9 pm` (dot 8 px). Open state is in the **server
  HTML**: `useOpenNow` (`site-smart.tsx:14-24`) is effect-only today; seed with `useState(() => openNow(rows))` (IST,
  `open-now.ts:69`), tick afterwards. Facilities (UPI, GST, delivery) → §4.1 strip.
- One primary (WhatsApp, else Call, else Book) + one secondary. `fmtPhone()` → `+91 98765 43210`.
- No logo → wordmark (display face, 15 px, tracking .06em, trade line in small caps) in the nav; the monogram
  (`card-compose.ts:651`) leaves the website.

Shared pieces in `site-smart.tsx`: `<Kicker>`, `<Display>` (sets `data-len`), `<TrustRow>`, `<CtaPair>`, `<Wordmark>`, `<HeroPhoto>`
(LQIP, focus, scrim/grain). `HERO_CSS` (≈ 3 KB) joins the inline `<style>` (`site-view.tsx:335`).

### 3.2 Photo recipe (numbers)

- `.hero-ph { object-fit: cover; object-position: var(--focus, 50% 35%) }`; ratios: cinematic 9:16 phone / 16:9 desktop, bento
  tile 4:5 / 4:3, story 9:16, split 4:5. The card keeps **one** subject point (`hero.focus`); pure `bpFocus(focus, bp)` in
  `site-hero.ts` derives the crop at render (bento pulls y toward 50 %, cinematic keeps it, story toward 30 %), so `applyLook` (no
  build) works in the preview iframe, which cannot read a manifest. The pool JSON from `ensureCardMedia`
  (`bridge/stock-art.mjs:292,324`: `{ category, label, photos, clip, at }`) gains `focus.bento/cinematic/story` per photo — the warm
  script's assert and the server-render default when `hero.focus` is missing.
- Scrim (text-over-photo only): `linear-gradient(to top, var(--scrim-bot) 0%, var(--scrim-mid) 38%, transparent 70%)`; desktop
  adds `linear-gradient(to right, hero-ink/.35, transparent 60%)`. Never a full wash or blur.
- `hero.bright` (mean luminance of the bottom 45 % > 0.6, `photo-focus.ts`) → `--scrim-bot .90` + a **static**
  `filter: saturate(.92)`, Ken Burns off (a filter under a scaling layer repaints every frame). No other grading.
- `textSide` keeps `photo-focus.ts:49`: `px < 42 → right`, `> 58 → left`, else `center`.
- `focus`/`textSide`/`lqip`/`bright` come from one `heroMedia(coverUrl)` (`photo-focus.ts`), called **wherever `coverUrl` is
  written**: build (`api/card/build/route.ts:606`), AI-banner finisher (`api/card/banner/route.ts:112`, undo `:53`), merge
  (`card-compose.ts:786`).
- `*-still` vignette: `radial-gradient(120% 90% at 50% 40%, transparent 55%, oklch(0 0 0/.28))`.
- LQIP: `hero.lqip` = 24 px WebP base64 ≤ 600 B as a plain `background-image` on the wrapper (browser upscale, **no blur
  filter**); `<img decoding="async" sizes="100vw">` fades in 240 ms. `fetchpriority="high"` only where the image is the LCP
  (cinematic, story, classic `photo`); phone bento photo → `loading="lazy"`. Hero ≤ 120 KB at 1080 w, ≤ 220 KB at 1920 w.
- Ken Burns: `scale(1 → 1.06)` 20 s linear, desktop only; off under `prefers-reduced-motion`, `[data-motion=none]`, `saveData`.

### 3.3 Bento — "board" (`site-bento.tsx`)

Desktop `grid-template-columns: repeat(12, 1fr); grid-auto-rows: 120px; gap: 16px`. **Phone is not one grid** (a flowing brand
tile cannot share fixed rows): `.board-phone { display:flex; flex-direction:column; gap:12px }` → brand block (flows, never
clips) · CTA row 56 px · `repeat(2,1fr)` strip grid, `grid-auto-rows: 96px` · photo tile `aspect-ratio: 4/5`. Tiles flat `--paper`,
`--elev: line`, `--r-tile`; no glass, `backdrop-blur` or aurora (`BENTO_CSS :173-185` deleted). Phone y (390×844): nav 0–56 · brand
72–≈440 (kicker 16, H1 2×44, sub 2×25, trust 20) · CTA 452–508 · strips 520–616 · photo 628–≈1065 → **LCP = H1, photo lazy**.

```
PHONE 390
┌──────────────────────────────┐
│ Wordmark                 ≡   │ nav 56
├──────────────────────────────┤
│ brand block (flex, no clip)  │
│ JEWELLER · REWARI            │ kicker
│ Hallmarked gold,       44px  │ H1
│ honest prices.               │
│ Bridal sets, 22K BIS.  17px  │ sub
│ ★ 4.7 (31) · Est. 2015       │ trust
├──────────────────────────────┤
│ [wa] Order on WhatsApp    →  │ CTA 56px, accent fill
├──────────────┬───────────────┤
│ ● Open       │ Main market   │ strips 2 × 96px
│ till 9 pm    │ Directions →  │
├──────────────┴───────────────┤
│ photo (4:5, no overlay, lazy)│ below fold
└──────────────────────────────┘
```

Desktop 1440 (content 1120): nav = wordmark · links · [WhatsApp]; row 1 = brand `5×3` (paper, no border: kicker, H1 72 px, sub
19 px, trust, CTAs) + photo `7×3` 4:3 `--r-tile` (focus crop, no scrim, 12 px caption); row 2 = four `3×1` strips (open · rating ·
map · offer/booking); row 3 = products `12×2`, 4 real thumbs 1:1, name · ₹.

CTA tile: icon 16 + label + arrow, 56 px, accent fill (`--wa` only on the WhatsApp icon/dot, never a green slab); Call is a ghost
tile only without WhatsApp. `since` folds into the trust row; `contact` renders the CTA row; both **stay in `TILE_KEYS`**
(`site-blueprints.ts:42`), `bentoTiles()` keeps its signature, and the toggles still act: `since` off → "Est." leaves the trust row;
`contact` off → CTA row hides (sticky bar stays); `LookTweaks` relabels them "Years in business (trust row)" / "Call & WhatsApp
buttons". Product tile only with real thumbnails; the "I" placeholder → `--paper-2` block, wordmark initial at 20 %. No photo & no
clip → `board-statement`: brand tile 12×3, 1 px accent/gold rule under the kicker. No logo → wordmark.

### 3.4 Cinematic — "cover" (`CinematicHero` `site-cinematic.tsx:15-44`; `CINEMATIC_CSS :94-107`)

```
PHONE 390, 100svh
┌──────────────────────────────┐
│ (nav hidden until scroll)    │
│      PHOTO, focus 50% 35%    │ top 60 %: bright, no scrim
│ ░░ scrim starts at 70 % ░░░░ │
│ JEWELLER · REWARI      11px  │ hero-text
│ Hallmarked gold,       52px  │ 2 lines max
│ honest prices.               │
│ Bridal sets, 22K BIS.  17px  │ 34ch
│ ★ 4.7 · Est. 2015 · ● Open   │ 13px
│ [ WhatsApp us ]  Call →      │ 48px + ghost; pad 24 + safe-area
└──────────────────────────────┘
```

Desktop 1440, 88vh: photo 16:9 with Ken Burns, to-right scrim .35, nav = wordmark (paper 13 px) + Call · WA; text column x = 96,
width 560, bottom-anchored 96 px up: kicker, H1 88 px (2 lines), sub 19 px, trust row, CTAs, a 64 px gold/accent hairline; scroll cue
bottom-right = 1 px × 48 px accent line + 8 px "Scroll" kicker, no bounce.
Primary on a dark photo = **paper fill + ink text, always** (accent is fixed at L 48 %; no contrast switch); secondary = text +
arrow. `OpenNowChip` and pills leave the hero. `textSide: right` → mirrored; `center` only for `cover-centre` (hotels, banquets,
events: one centred block, nothing else centred).
No photo & no clip → `cover-ink`: `--hero-ink` field, grain (desktop), headline 96/52, still-life right on desktop / below the
text on phone **only from an owner-uploaded product image** (`ownUpload(url)`: the owner's storage path — never `/api/stock/…`,
`/art/…`, a `ref-N` AI file or a sample) as `object-contain` on `--paper-2`; else type only. `logoUrl`, `avatarUrl` and
`hero.imageUrl` (`card-compose.ts:688` writes `firstImage || setup.logo`) are **never** a hero picture. Sticky bar only after the
hero leaves the viewport (IO sentinel exists).

### 3.5 Story — "slide 1 converts" (`StoryView` `site-story.tsx:51-180`; `StoryTrack :183-217`; `STORY_CSS :219-225`)

```
PHONE 390, 100svh slide 1
┌──────────────────────────────┐
│ ▁▁▁ ▁▁▁ ▁▁▁ ▁▁▁  2px / 40 %  │ no "1/9"
│      PHOTO saturate(.85)     │ static duotone,
│      contrast(1.05) + accent │ multiply 20 %, no KB
│ ░░ scrim from 65 % ░░░░░░░░░ │
│ CAFÉ · REWARI                │ kicker
│ Fresh every            52px  │ 3 words/line
│ morning.                     │
│ Chai, snacks, a quiet corner.│ sub 17px
│ [ Order on WhatsApp ]  48px  │ ONE primary
│ ● Open till 9 pm · Main mkt  │ meta 13px
│            ⌃ swipe  12px/60% │ ≥ 70 % down
└──────────────────────────────┘
```

Desktop: plain `--hero-ink` field (radial at `:157` deleted); left = wordmark 15 px · trust row · QR 96 px "Scan to open on your
phone" · [WhatsApp] Call; right = the same slide 1 in a 390×780 plain 20 px frame, no dynamic island (`:174`), **no second headline**,
"arrow keys" → `title` attribute. Controls below the 55 % tap-zone line (`StoryTrack :209-211`). Progress 2 px, white 40 %, no
`mix-blend-mode`. Slides 2–9 keep their sections. Bright photo → `slide-duo`: photo top 55 % with a hard edge, paper panel below with kicker/H1 48 px/sub/CTA, no scrim. No photo →
`slide-ink`: `--hero-ink` field, headline 56 px, still-life 4:5 under the `ownUpload` rule.

### 3.6 Classic — `ClassicHero`, extracted from `site-view.tsx:422-559` into new `src/components/site-classic.tsx`

`HERO_LAYOUTS` keys stay. `photo` = cinematic `cover` at `min-height: 78svh`; `split` = `cover-split` (desktop
`grid: minmax(0,5fr) minmax(0,7fr)`, text on `--paper`, picture 4:5 right, no scrim; phone: picture 4:5 max 56svh above a paper text
block — never the 1150 px form). The picture is `coverUrl`, else an `ownUpload` product `object-contain` on `--paper-2`, else
`split` collapses to `cover-ink` — never a logo stretched to 4:5. Navy multiply wash (`:476-483`) and dots deleted. The other six
layouts get tokens only.

### 3.7 Variants (`SiteStyle.heroVariant` rides in `style`, so `applyLook()` needs no change)

| Blueprint | Ship first | Then | Gate |
|---|---|---|---|
| bento | `board`, `board-statement` (no photo) | `board-photo-first` (photo 12×3 on top: cafe, salon, garments), `board-ink` (dark brand tile: gym, electronics), `board-still` | `-still` needs ≥ 4 `ownUpload` products |
| cinematic | `cover`, `cover-ink` (no photo / dark mood) | `cover-split` (clinic, CA, school, kirana), `cover-centre` (hotel, banquet, events) | `-centre` only for `luxe` / events |
| story | `slide-photo`, `slide-ink` (no photo) | `slide-duo` (bright photo, garments, kirana), `slide-type` (paper, type-led: boutiques, persons) | — |

`moodPlans()` (`trade-moods.ts:54`) sets `heroVariant` per blueprint; `derive()` (`site-looks.ts:38-45`) fills it when the AI
omits it; `heroAllowed()` (`site-designer.ts:120`) gates on what the card can fill.

### 3.8 First-paint plan and motion

Server HTML (`/c/<username>`) carries kicker/H1/sub/CTA/trust with final numbers and open state; inline critical CSS (`HERO_CSS`
+ tokens ≈ 5 KB); LQIP + one hero `<img>` (§3.2); two fonts preloaded (§2.1); no `backdrop-filter`, blur or aurora on screen one;
zero new JS.
Entrance: kicker → H1 → sub → CTA, `translateY(12px)→0` + opacity, 520 ms, `cubic-bezier(.23,1,.32,1)`, 50 ms stagger; photo
opacity 240 ms; bento tiles 40 ms stagger. Reduced motion / `data-motion="none"` → opacity only. Hover 150 ms; press `scale(.97)`.

## 4. Sections below the hero

1. **"Good to know" strip** (`site-view.tsx:562-573`, replaces hero pills): 13 px row, `UPI · Home delivery · GST billing`, 16 px
   icons, hairlines.
2. **`Section()`** (`:723-756`): delete the 12 px underline (`:745`); kicker + H2 + lede; alternate `--paper`/`--paper-2`;
   `tone="band"` = `--hero-ink` + grain, no dots.
3. **`cls.card`** for the ~14 inline `rounded-3xl border border-border bg-surface` strings (`:612,775,834,939,1017,1058,1078,
   1139,1277,1358,1383,1396,1472,1482`, `site-story.tsx:95`) → `.s-card` with `--elev`.
4. **Buttons**: `.btn-primary` (accent fill, 48 px, `--r-ctl`), `.btn-ghost` (1 px `--line`), `.btn-link`; `.btn-grad` (`:229`) and
   the purple product button go; `--wa` only on WhatsApp.
5. **Products** (`:1165-1340`): image 4:5 `object-contain` on `--paper-2`, name 15/500, price 15/600 tabular, 13 px WhatsApp text
   link; fake bullets dropped; phone rail snaps.
6. **`CountUp`** (`site-smart.tsx`): final number in HTML; animate on IO + motion allowed; 26–28 px.
7. **Reviews** (`:1353-1400`): 26 px display italic + 1 px accent rule + 13 px name; `site-icons` stars; marquee only ≥ 6.
8. **FAQ**: `<details>`, hairlines, no cards. **Footer** (`:650-700`) and **closing band** (`:631-644`): ink field, wordmark, one primary.
9. **Sticky bar + bubble** (`:704`, `CardChat :715`): bar only after the hero exits; bubble removed. (The shots' "N" badge is the
   Next.js dev indicator `<nextjs-portal>`, not a site component — §7.1.)
10. **Upgrade strip** (`UpgradeBar`, `preview/site/view.tsx:37-46`): one 40 px line, 13 px text + "Upgrade" link, fixed at the
    **bottom, above the phone sticky bar** like `ShubhoraBar` (`aboveBar`, `shubhora-bar.tsx:53`:
    `bottom-[calc(52px+env(safe-area-inset-bottom))]`); its 40 px join `--site-top` (story, `site-story.tsx:155`) and `main`'s padding.

## 5. Remove list

Monogram on websites · `rounded-full` chips in heroes · emoji and numeric-fallback icons
· `--grad`, `.btn-grad`, hero radial mesh (`:471-473`), band gradient (`:737`), bento aurora, story desktop radial
(`site-story.tsx:157`), CTA-band gradient (`:631-644`), page-header gradient (`:577`), lavender `#eef0ff`, purple WhatsApp button ·
full-frame scrim, navy multiply wash, `filter: blur` on hero photos or `SMART_CSS` reveals · `backdrop-blur` on tiles (glass nav
may stay) · flat `#25D366`/orange tiles · H2 underline · dots · "Trade in City since YYYY." sub, "Name / alt / alt" slug · "1/9"
badge, dynamic island, "arrow keys" caption · WhatsApp bubble · empty "Since" tile, icon-top CTA tiles, letter placeholder · serif
700+, 800 anywhere · Baloo 2 · `font-display: optional` · Google-hosted font `<link>`.

## 6. Implementation plan (S ≤ ½ day, M ≈ 1 day, L ≈ 2 days)

| # | Step | Files | Size |
|---|---|---|---|
| 0 | **Root causes first.** (a) `site-view.tsx:179,409-416`: hero photo = `card.coverUrl` only; none → `*-ink`/`statement`, never `hero.imageUrl`, a product shot or the logo. (b) Commit the 8 audit fixtures to `scripts/trade-check/cards/<name>.json` with a real stock `coverUrl`, + `jewellery-hi.json` (`language: "hi"`) and `nophoto.json`. (c) Then `warm-trade-media.mjs` asserts each pool is the trade's own; `bridge/stock-art.mjs` writes per-photo `focus`. §4.10. Re-shoot. | `site-view.tsx`, `scripts/trade-check/cards/*`, `scripts/warm-trade-media.mjs`, `bridge/stock-art.mjs`, `preview/site/view.tsx` | S |
| 1 | **Tokens.** `oklchVars()`, `oklchToHex()`, luxury preset, `--elev`, radius/spacing/type vars, `--p-*` aliases, no `--grad`; `FONT_SETS` + aliases, `fetch-fonts.mjs` → `public/fonts`, `fontCss()`/`fontPreload()`, `FONT_METRICS`; `RADII` → four tokens; `SITE_PALETTES` gain `h`. `globals.css` `.site`: `:lang(hi)`, self-hosted `@font-face`, app-theme isolation, `.s-card`, `.btn-*`, `.trust-row`, `.hero-*`, keyframes. `types.ts`: `SiteStyle.heroVariant`, `hero.lqip/bright/kicker`; `cleanStyle()` validates. Nothing visible changes yet. | `site-style.ts`, `globals.css`, `types.ts` | M |
| 2 | **Head.** 2 font preloads in `<head>` of the live page only; `lang` on `<html>` from the build language, on `.site` from `L.lang`. The preview iframe reads the card from `localStorage` after hydration, so it keeps in-body faces (`site-view.tsx:334`) — **preview speed is not the gate**. | `app/c/[username]/render.tsx`, `site-view.tsx:334` | S |
| 3 | **Copy + model.** `site-hero.ts` (`heroModel`, `bpFocus`, `fmtPhone`, `honorific`, `stripEmoji`, `sanitiseName`, `ownUpload`); `trade-moods.ts`: `headline/benefit {en,hi}` per group, `luxe`, `fontSet`, `heroVariant`; `card-compose.ts:692` stops the auto-sub (`:636` untouched). | `site-hero.ts` (new), `trade-moods.ts`, `card-compose.ts` | M |
| 4 | **Shared pieces.** `site-icons.tsx`; `Kicker/Display/TrustRow/CtaPair/Wordmark/HeroPhoto` in `site-smart.tsx`; `CountUp` and `useOpenNow` SSR-seeded; `HERO_CSS` inline; `cls.card`. | `site-icons.tsx` (new), `site-smart.tsx`, `site-view.tsx:335` | M |
| 5 | **Cinematic** (`cover`, `cover-ink`): §3.4, scrim vars, `data-len`, bright rule, KB desktop-only, scroll cue. | `CinematicHero` + `CINEMATIC_CSS` (`site-cinematic.tsx:15-44, 94-107`) | M |
| 6 | **Bento** (`board`, `board-statement`): 12-col grid, phone flex column, horizontal CTA, strip tiles, product thumbs; no aurora/glass; `bentoTiles()` unchanged. | `site-bento.tsx` | L |
| 7 | **Story** (`slide-photo`, `slide-ink`): §3.5, 2 px progress, desktop frame panel, tap zones kept. | `StoryView`, `StoryTrack`, `STORY_CSS` (`site-story.tsx:51-225`) | M |
| 8 | **Classic** `ClassicHero` extracted (§3.6), `photo`/`split` re-skin, tokens for the other six; §4 items 1–9. | `site-classic.tsx` (new), `site-view.tsx:405-573, 631-756, 1109-1490` | L |
| 9 | **Media.** `heroMedia(coverUrl)` = `focus` + `textSide` + `lqip` + `bright` at every `coverUrl` write; `bpFocus()` at render. | `photo-focus.ts`, `api/card/build/route.ts:606-610`, `api/card/banner/route.ts:53,112`, `card-compose.ts:786`, `site-hero.ts` | S |
| 10 | **Designer / looks / review.** `menu()` lists `heroVariant` per blueprint with blurbs and gates; `heroAllowed()`; `derive()` fills it; `site-blueprints.ts` defaults; `design-review.ts` (§7.3) + `set_style(heroVariant)`; `LookTweaks` (`components/poster/look-tweaks.tsx`) relabels `since`/`contact`. | `site-designer.ts:74-128`, `site-looks.ts:38-45`, `site-blueprints.ts`, `design-review.ts:29-58` | M |
| 11 | **Remaining variants** (§3.7 "Then"), one per blueprint per day, behind its gate, screenshot after each. | blueprint files | M |
| 12 | **Sweep.** `look-shots.mjs` (`?shot=1`, `?lang=hi`, no `<nextjs-portal>`) on the 10 fixtures; `speed.mjs` → SSR route, prints the LCP element; `sweep.mjs` across 79 trades. | `scripts/trade-check/*`, `app/preview/ssr/[name]/page.tsx` (new, dev-only) | S |

Every step leaves classic and pre-Oct sites rendering (aliases, step 1); cinematic (5) is the flagship.

## 7. Quality gates

### 7.1 Screenshots
`node scripts/trade-check/look-shots.mjs <out> scripts/trade-check/cards/*.json` on :3103 (8 audit cards + `jewellery-hi.json` +
`nophoto.json`). Two params are **added** to `preview/site/view.tsx` (today only `k` is read; `look-shots.mjs:16-18` sets only
`k=shot`): `?shot=1` hides `UpgradeBar`, `?lang=hi|en` forces `L.lang` (`useCardLang` initial value); the script removes
`<nextjs-portal>` and shoots English cards in both. Per `*-hero.png`:
- [ ] Headline largest; ≥ 44 / 72 px; ≤ 2 lines; no "/"; trade word ≤ 1×; "Dr." on person-led clinics.
- [ ] 1 filled + 1 ghost; 0 pills; 0 emoji; 0 monograms; logo/wordmark once; CTA on screen one (bento ≤ 508 px).
- [ ] Trust row when a fact exists; facilities below; phone formatted.
- [ ] Photo trade-specific (hash differs); top 40 % unwashed; no blur; subject visible; three crops differ.
- [ ] ≤ 2 saturated fills above the fold; no gradients or purple/lavender; luxury = ivory + espresso + gold line.
- [ ] Contrast at pixel: headline and sub on scrim ≥ 4.5:1, trust ≥ 3:1.
- [ ] `hi` card and `?lang=hi` shots: Devanagari family in the font log (not a fallback), matras intact, H1 lh ≥ 1.22, kicker tracking 0.
- [ ] `nophoto` renders `*-ink`/`statement` + wordmark, no empty tile.
- [ ] Full page: one WhatsApp affordance per viewport; no sticky bar on screen one; cards border **or** shadow; no H2 underline.
- [ ] Same card × 3 blueprints: board / cover / slide differ structurally.
- [ ] `grep -c rounded-full src/lib/site-hero.ts src/components/site-icons.tsx src/components/site-{bento,cinematic,story,classic}.tsx`
  = 0 (avatar, open-dot excepted); `site-view.tsx` (43 today) and `site-smart.tsx` (5) are out of scope.

### 7.2 Speed (`speed.mjs`, 390 px, CPU 4×, 1.5 Mbps / 150 ms)
`speed.mjs` loads `/preview/site?k=…` today — a `"use client"` page rendering from `localStorage` after hydration
(`preview/site/view.tsx:19-57`), where server HTML and FCP cannot be checked. It points instead at a **dev-only SSR route**
`app/preview/ssr/[name]/page.tsx` (404 in production) rendering `scripts/trade-check/cards/<name>.json` through the `render.tsx`
head of `/c/<username>`, and prints the LCP element. Gates: FCP ≤ 1.5 s · LCP ≤ 2.5 s, element `<img>` on
cinematic/story/classic-photo, `<h1>` on bento · CLS < 0.02 · hero image ≤ 120 KB · ≤ 2 fonts preloaded, ≤ 3 downloaded, ≤ 150 KB
· hero CSS ≤ 8 KB · CSS delta ≤ 6 KB gzip · JS bundle unchanged · zero `backdrop-filter`/`filter: blur` on screen one · stats and
"● Open" real with JS disabled · `h1` present.

### 7.3 Design-review prompt (`design-review.ts`)
"Hero: no pill/chip shapes; headline a claim or the name, ≤ 2 lines, no slash; trade word once; one filled CTA + one ghost;
trust row (rating · est. · open); facilities below the hero; scrim bottom-only; no emoji; one logo/wordmark." Fixes gain
`set_style(heroVariant)` within the blueprint's list; `*-still` only with ≥ 4 product photos; `cover-centre` only luxe/events.

### 7.4 Editor
`LookTweaks` toggles and look switch stay instant; Upgrade strip ≤ 40 px above the sticky bar, never over the hero or a slide;
`?lang=hi` preview paints Devanagari; old classic sites render with tokens only.

## 8. Open questions

1. **Gold on jewellers**: ivory + espresso + gold *line* (plan), or gold fills?
2. **WhatsApp colour**: brand green only on the WhatsApp control (plan), or accent with a green icon?
3. **Ship order**: cinematic first (flagship), or bento first as most trades' default?
4. **Hindi name on an English site**: Devanagari wordmark + English claim (plan), or Hindi claim too?
5. **Story slide 1 CTA**: WhatsApp everywhere, or Call for clinics?
