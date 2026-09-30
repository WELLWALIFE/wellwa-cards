# NeuralEdge AI Studio — "Right the first time" realistic-ad pipeline: FINAL IMPLEMENTATION SPEC (post-review)

Codebase: `/Users/jsrao/Desktop/Wellwa Life/wellwa-cards` (Next.js 16 + `bridge/` Node workers, one 3.6 GB VPS, pm2 worker `neuraledge-media`). Paths are repo-relative. Facts verified in the repo on 2026-09-17: latest migration is `0043_poster_more.sql`; `IMG_MODEL = gemini-2.5-flash-image` with `imageConfig{aspectRatio}`; Kling = `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` (`image_url`, `cfg_scale 0.5`, poll via returned `status_url`/`response_url`); `ad-engine.mjs fam()` and `realistic-engine.mjs captionOverlay` know only Devanagari vs Latin; `caption-engine.mjs` already lists the 9 Noto families; `poster-categories.ts` has 78 keys in 9 groups (Retail, Food, Health, Services, Education, Sales, Industry, Community, Personal; `water` is in Health); `deploy.sh` restarts only `neuraledge-app`; `spend_credits(p_user,p_amount,p_reason,p_ref)` exists and `ad/route.ts` passes `p_ref:null`; `media_jobs` has table-level `grant select to authenticated`; the worker deletes the job dir on success and keeps only the last FAILED dir in `os.tmpdir()/ad-last-failed`. ChatGPT also edits this repo: re-read every file before editing and re-check the next free migration number.

---

## 1. Goal & non-negotiables

**Goal.** A shop owner picks a product, picks one of three scripts, watches a free storyboard animatic of QC-passed stills with the real voice-over, and only then pays to animate. The 2026-09-16 failure (water from a separate kitchen tap instead of the Wellwa unit's own outlet hose) must be impossible to plan, draw, pass or animate.

**Non-negotiables**

1. **Product correctness is data, rendered by code.** `poster_products.facts` (small, owner-confirmed, frozen per job). Code in `bridge/prompt-builders.mjs` writes every fidelity sentence. Prompts never name an object we do not want drawn (no "tap", "sink", "faucet" in any positive prompt). A two-stage vision judge (blind inventory, then code comparison) sits between the cheap still and the ₹30 Kling clip. The owner is the final gate until calibration numbers hold.
2. **Copy that works first try.** Three structurally different scripts (different first picture), deterministic gates, claims grounded in facts, one non-lite judge pass that ranks them. The owner sees "Ready" / "Needs a fix" + one reason, never a numeric score.
3. **One-viewing clarity.** Beat spine, brand by scene 2, one idea per scene, keyword caption cards AND word captions rendered by default, variable scene length cut to the voice, CTA shown large for the whole end card.
4. **No wasted credits.** Realistic: nothing charged until **Animate**. Free storyboard with preview-only stills and a small deposit after the daily free quota. Free **Reassemble** (line/voice/music/hook/CTA) and per-scene **Redo** after the first render. Refunds are capped by what was paid, from the ledger only.
5. **English-only UI**, including API error strings. Output language selectable.
6. **12 output languages** (`hi, hinglish, en, mr, gu, pa, bn, ta, te, kn, ml, or`) stored, budgeted, pronounced and rendered (fonts) correctly.
7. **Native-script TTS kept** (`bridge/tts-script.mjs`), with per-language pronunciations. English style preamble only; skipped on mixed-script lines as today.
8. **Existing credits system reused**; every ledger write carries `p_ref` = job id (generated before the spend).
9. **VPS safety.** One pm2 process, two slots: `busyRender` (anything with ffmpeg or Kling) and `busyStoryboard` (network + sharp only). The storyboard phase never runs ffmpeg; all audio work there is pure JS on PCM.
10. **v1 scope.** Pipeline 2 = realistic tier for physical products only (`size_class != "service"`). Template, presenter and testimonial stay on legacy `processAd`, charged at creation, and gain only: new planner/gates (without `shot`), glossary TTS, full voice-over audition before charge, English strings, fonts.

---

## 2. User flow

### Screen A — "Make an ad"

```
Make an ad
Product   [ Wellwa Alkaline Ionizer ▼ ]  [+ New product]     Product check ✓ confirmed 12 Sep · 4 photos  [View / edit]
          (unconfirmed) ⚠ Answer 3 quick questions about your product — the video obeys them.  [Start]
What should the ad do?  (● WhatsApp leads) ( Push an offer ) ( Introduce ) ( Festival ) ( Before → After )
Video style  [ Template · from 20 credits ] [ ● Realistic AI · storyboard first · 20 s = 40 credits ] [ Presenter · 20 s = 40 credits ]
Length       ( 10 s · 20 cr ) ( ● 20 s · 40 cr ) ( 30 s · 60 cr )     Realistic max 30 s
Language     [ Hinglish ▼ ]
Formats      (● Reel 9:16) ( Square — framed ) ( Wide — framed )   "Square and Wide are made from the vertical video inside a blurred frame."
Voice Warm male · Music Calm · Look Clean · Captions on · 1 video · Speak phone number: off      [Change]
                         [ Write my 3 scripts (free) ]
```

- Realistic is enabled only when the product has confirmed facts, ≥2 identity photos and `size_class != "service"`. Services see: "Realistic scenes for services — coming soon. Template and Presenter work today."
- `[+ New product]` is an inline name + category + photos form (creates a `poster_products` row). Template, presenter and testimonial work with `product_id: null` (category-group defaults only); realistic requires a product row.
- `editJob` for legacy jobs (`input.v` missing): fields re-hydrate as today; a free-text product name with no row shows "Create a product to use Realistic".

### Screen A2 — "Product check" (three visual questions, not a form)

1. **"Tap where the result comes out."** The owner's front/three-quarter photo is shown; one tap stores `output.point {photo, x, y}` and the server crops a 40% box around it as an extra identity ref (`view:"output_closeup"`, `generated_crop:true`). Skipped when the draft says `output: null`.
2. **Yes/No card**, rendered from the draft: "Water comes out of **the hose on top of the unit** and from nowhere else — correct?" No → a one-line text box "Where does it come out?" which replaces `output.part`.
3. **"Must never show"** chips; the draft's top 3 preselected; owner can remove or add. Removals persist in `facts.removed_defaults[]`.

Also on this screen: photo strip with view chips (**Working / in use** — "most useful: a photo of it working" · Front · Three-quarter · Output close-up · Installed · Packaging · Other) and "How to say the brand" (auto-filled per language, editable). Everything else (appearance, idle look, benefits, proof numbers, never-claim) sits under **Advanced**, pre-filled. `[Confirm]` is blocked while any shown value is still marked unverified. Facts are stored in English; the planner localises.

### Screen B — "Pick a script"

```
Pick a script                                                                   [Re-write all 3]
✓ Ready · PRODUCT FIRST · pain point                                             [Use this]   ≈ 18 s total
Promise: Ghar par hi alkaline paani — ek button se
Why this works: Opens on a cost every family knows, names Wellwa by second 4, shows the unit pouring, ends with one WhatsApp action.
1 "Har mahine paani ki bottles par kitna kharcha?"              Bottle ka kharcha?            2.8 / 3.8 s
2 "Wellwa ionizer: ek button, aur alkaline paani ghar par."      Ek button. Alkaline paani.    3.4 / 3.8 s
3 "Har glass mein mineral-rich paani, poore parivaar ke liye."   Poore parivaar ke liye        3.4 / 3.8 s
4 "5,000+ gharon ka bharosa. Free home demo bhi."                5,000+ ghar · Free demo       3.8 / 3.8 s
CTA "Abhi WhatsApp karein — number screen par hai."              WhatsApp 98xxx xxxxx
[▶ Hear scene 1]  [Edit lines]  [3 more hooks]      (3 videos chosen) Extra hooks: "…" · "…"
⚠ Needs a fix · PERSON FIRST …  reason: scene 3 repeats scene 2                   [Use this]
```

- Meters show estimated seconds (§6.1), turning red over budget. "Edit lines" edits line, caption and creative shot fields; fidelity is locked ("From your product check"). Gates re-run client-side on every edit; the LLM judge re-runs only on "Use this" if the text changed.
- "Use this" → `POST /api/media/ad`. Realistic → Screen C. Other tiers → a sheet "Play full voice-over" (all lines via tts-preview) with **Create — N credits**.

### Screen C — "Your storyboard"

```
Your storyboard — Realistic · 4 scenes · ≈ 18 s            [▶ Play preview]  (pictures + real voice + captions + end card)
Storyboard: free. Animate: 40 credits (you have 120). Nothing is charged until you tap Animate.
[still 1] Scene 1 · "Har mahine…"     ✓ Checked: no text · 1 person
[still 2] Scene 2 · "Wellwa ionizer…" ✓ Checked: one unit · water from the unit's hose only
[still 3] Scene 3 · …                 ✓ Checked   ◦ Note: a hand is cropped at the edge — your call
[still 4] Scene 4 · …                 ⚠ Shown as a simple product shot — we could not verify the planned picture.
   each tile: [Redraw] (first free, then 1 credit)  [Change picture…]  [Use my own photo]  [Edit line]
Voice ✓ all lines fit.   Scene 4 line was shortened to fit: "…old…" → "…new…"   [Keep] [Edit]
[ ] This ad will not show the product working. (appears only if the in-use scene is a simple product shot)
                           [ Animate my ad — 40 credits ]        [Discard]
```

- **Play preview** is a client-side animatic (HTML/JS, no ffmpeg): stills crossfade under the real VO wavs at each scene's slot length and tempo, with keyword cards, word captions and the CTA card. This is the one-viewing test before paying.
- Stills on this screen are 720 px watermarked previews; originals are private until Animate.
- Animate is disabled when any scene is `needs_owner` or `line_too_long`, or when the acknowledgement box is required and unticked. Safe shots otherwise do not block. Any substitution or line change after scoring sets `scorecard.stale = true` and shows "Script changed since it was checked".
- **Change picture…**: three chips (Closer · Different room from your list · No people) plus an optional note ≤80 chars. The note is translated to English, screened by the same banned-word list as G11 plus `must_not_show` nouns, and rejected with "That would show the product incorrectly" on a hit. It maps only to `shot.setting_desc` / `people` / `framing`; G10/G11 re-run. It never touches fidelity text.
- **Use my own photo**: upload → image model extends the canvas to 9:16 keeping the photo region → judged like any still → animated. Fallback if the judge fails it twice: centre-crop to 9:16 with sharp and use as is.
- **Edit line** → re-gates, re-TTS of that line only, no redraw.
- While animating: "Animating 4 scenes… about 7 minutes. You can close this." with Cancel (disabled once assembly starts).
- If the in-use scene fails clip QC twice, the job pauses in `review` and asks: **Use photo motion for this scene (scene share refunded)** · **Try once more (free)** (once) · **Pick a different approved still**. Idle scenes fall back to photo motion automatically with the scene-share refund and a note.

### Screen D — "Your videos"

Rows show stage text and progress. Done rows: video, Share/Download per format, real duration, notes ("Scene 3 delivered as photo motion · 10 credits returned"), and for 7 days: **Change line / voice / music / hook / CTA (free)** and **Redo scene N (10 credits)**. Review rows: "Waiting for your approval" → Open. `src/app/(dashboard)/studio/page.tsx` filters `kind=ad` out of its list (it prints "refund ho gaya" and raw status text today).

Waits (20 s realistic): scripts ≤25 s · storyboard 60–150 s when the storyboard slot is free (queue position shown otherwise) · animate 6–9 min.

---

## 3. Product knowledge (`poster_products.facts`)

### 3.1 SQL (part of the single migration, §8.1)

```sql
alter table public.poster_products
  add column if not exists photos jsonb not null default '[]'::jsonb,   -- [{url, view, role, w, h, generated_crop?}]
  add column if not exists facts jsonb not null default '{}'::jsonb,
  add column if not exists facts_version int not null default 0,
  add column if not exists facts_confirmed_at timestamptz;
update public.poster_products set photos = jsonb_build_array(jsonb_build_object('url', photo_url, 'view','front','role','identity'))
  where photos = '[]'::jsonb and coalesce(photo_url,'') <> '';
```
`view ∈ in_use | front | three_quarter | back | output_closeup | installed | packaging | generated | other`. `role = "context"` for `installed` and `generated`, else `"identity"`. Context photos are used **only** in the T1 draft, never sent to the image model. `photo_url` stays the front photo. Photo size is checked server-side (fetch + sharp metadata, short side ≥720 px); uploads are already capped at 1400 px by `/api/poster/upload`.

### 3.2 `ProductFacts` (types in `src/lib/media/product-facts.ts`)

```ts
export type Archetype = "appliance_with_output" | "item_used_by_person" | "static_item";
export type ProductFacts = {
  v: 1;
  label: string;            // generic noun for every prompt, never the brand: "the water ionizer"
  name: string;
  category_key: string; category_group: string;
  archetype: Archetype;     // derived: output != null → appliance_with_output; size_class wearable|consumable|handheld → item_used_by_person; else static_item
  what_it_is: string;
  size_class: "handheld"|"tabletop"|"countertop"|"floor"|"wall"|"wearable"|"consumable"|"vehicle"|"service";
  appearance: string;       // ≤60 words, only what is visible
  stage_positive: string;   // where it stands, written WITHOUT naming unwanted objects: "on a clear stretch of kitchen counter against a plain tiled wall"
  idle_positive: string;    // "stands switched on with its display lit, the hose resting in its normal position"
  use_positive: string | null;   // item_used_by_person only: "a woman wears the saree, pallu draped over the left shoulder"
  output: { part: string; part_short: string; medium: "water"|"air"|"light"|"sound"|"heat"|"food"|"none";
            receptacle: string;            // "a clear glass held directly beneath the end of the hose"
            action_positive: string;       // one positive sentence, names the part, names no other object
            point?: { photo: number; x: number; y: number } } | null;
  fixed_parts: string[];    // short names that must stay identical: ["outlet hose","front panel"]
  must_show: string[];      // POSITIVE truths about the product only
  must_not_show: string[];  // noun phrases; used by the judge comparison and Kling negatives only — never in a positive prompt
  removed_defaults: string[];
  hands: "none"|"edge"|"operating";
  people_default: string; settings: string[];
  benefits: string[]; proof: { text: string; number?: string; source: string }[]; offers: string[];
  claims_allowed: string[]; // seeded from benefits + what_it_is + proof; the ONLY assertions copy may make
  banned_claims: string[];
  pronunciations: Record<string /*lang*/, Record<string,string>>;  // {hi:{Wellwa:"वेलवा"}, ta:{Wellwa:"வெல்வா"}, latin_hint:{Wellwa:"VEL-vaa"}}
  unverified: string[];     // field names the draft inferred; not rendered into prompts until the owner confirms them
  confirmed_by_owner: boolean;
};
```
Removed after review: `connections[]`, the `parts[]` matrix, `forbidden_objects` (merged into `must_not_show`), `logo.placement`, `owner_edited`, `source_hash`, `missing_views`, `where_it_lives` (replaced by `stage_positive`). Frozen per job as `input.facts` + `input.refs`.

### 3.3 Defaults (`src/lib/media/product-defaults.ts`)

Group-level seeds keyed by `Category.group`, plus six overrides. Free-text `poster_products.category` is mapped with `categoryKeyFor(text)` (exact key → `en`/`hi` label match → `"other"`). Seeds only fill empty fields; lists are unioned **minus** `removed_defaults`. No default assumes a hose, glass or panel — `output.*` always comes from the vision draft plus the owner's tap.

```ts
export const GROUP_DEFAULTS = {
  Retail:   { size_class:"tabletop", hands:"edge", must_not_show:["a second copy of the product","legible price tags","other companies' brand names"], banned_claims:["No.1","cheapest in India","guaranteed"] },
  Food:     { size_class:"consumable", hands:"operating", must_not_show:["other companies' brand names"], banned_claims:["No.1","guaranteed"] },
  Health:   { size_class:"service", hands:"operating", must_not_show:["blood","needles","before/after body or skin changes"], banned_claims:["cures","guaranteed","100%","permanent","doctor-recommended"] },
  Services: { size_class:"service", hands:"operating", banned_claims:["guaranteed","No.1"] },
  Education:{ size_class:"service", banned_claims:["guaranteed marks","100% result"] },
  Sales:{ size_class:"service", banned_claims:["guaranteed income"] }, Industry:{ size_class:"floor", hands:"edge" },
  Community:{ size_class:"service" }, Personal:{ size_class:"service" },
};
export const KEY_OVERRIDES = {
  water:    { size_class:"countertop", hands:"edge", must_not_show:["liquid leaving any tap, faucet or spout that is not part of the product","a second appliance","a bottle, jug or pitcher pouring"], banned_claims:["cures","doctor-recommended","100% pure","No.1"] },
  kirana:   { size_class:"consumable", hands:"operating" }, garments:{ size_class:"wearable", hands:"operating", must_not_show:["changed fabric pattern or colour","different garment cut"] },
  dentist:  { must_not_show:["blood","needles","fake before/after teeth"], banned_claims:["100% painless","permanent cure"] },
  salon:    { must_not_show:["skin-tone change"] }, gym:{ must_not_show:["exaggerated before/after bodies"], banned_claims:["guaranteed weight loss"] },
};
```
`water` covers RO dealers and jar suppliers too, which is why it names no hose and does not ban bottles outright ("a bottle… pouring" only); the owner can delete any chip and the deletion sticks.

### 3.4 T1 — facts draft (`POST /api/poster/products/[id]/facts`; model `JUDGE_MODEL`; JSON mode; temperature 0.2; maxOutputTokens 2000)

Parts: every photo including context (≤1024 px, real MIME), each preceded by `Image {k}: {view|"untagged"}`, then:

```
You are documenting one physical product sold by a small Indian business so a film crew can photograph and animate it correctly. Images 1-{n} are the owner's photos. Write every value in plain English.
Product name: {name}. Category: {category_en}. Owner benefit lines: {benefits_joined|"-"}. Owner notes: {notes|"-"}.
Seed values (keep unless the photos contradict them): {seed_json}

Return ONLY JSON with exactly these keys:
{"label":"<generic noun phrase, 2-4 words, never the brand, e.g. 'the water ionizer'>",
 "what_it_is":"<one sentence a stranger understands>",
 "size_class":"handheld|tabletop|countertop|floor|wall|wearable|consumable|vehicle|service",
 "appearance":"<≤60 words: colour, shape, approximate size, controls, hoses or ports, materials, where the brand is printed — only what is visible>",
 "stage_positive":"<where it naturally stands or is shown, describing ONLY the surface and backdrop, e.g. 'on a clear stretch of kitchen counter against a plain tiled wall'. Do not mention sinks, taps, other appliances or clutter.>",
 "idle_positive":"<how it looks when nobody is using it, one clause>",
 "use_positive":"<only for things a person wears, eats or holds: one sentence showing correct use; else null>",
 "output":{"part":"<the ONE part through which the product delivers its result, and where on the body it is>","part_short":"<2-4 words>","medium":"water|air|light|sound|heat|food|none","receptacle":"<what receives the result and where it is held, e.g. 'a clear glass held directly beneath the end of the hose'>","action_positive":"<one sentence of correct use as it looks on camera. Name the part and the receptacle. Mention no other object.>"} or null if the product emits nothing,
 "fixed_parts":["<2-5 short part names that must always look identical>"],
 "must_show":["<2-4 positive truths about the product itself when in use>"],
 "must_not_show":["<3-6 wrong depictions an image model is likely to produce for this product, as noun phrases without the word 'no'>"],
 "hands":"none|edge|operating","people_default":"<typical user, Indian context>","settings":["<2-4 rooms or places>"],
 "benefits":["<≤6 outcomes in the viewer's words, English>"],"banned_claims":["<claims this category must never make>"],
 "photo_views":[{"index":1,"view":"in_use|front|three_quarter|back|output_closeup|installed|packaging|other"}],
 "inferred":["<names of the keys above whose value you guessed rather than saw>"]}
Rules: describe only what is visible or stated by the owner. Never invent model numbers, prices, awards, certifications or numbers. Countertop, floor and wall products are never held in a hand.
```
Server: merge seeds (minus `removed_defaults`), derive `archetype`, reject any `stage_positive`/`action_positive` containing `/\b(tap|faucet|sink|spout of the sink)\b/i` (re-ask once, else blank it and mark unverified), `inferred` → `unverified[]` (no "CONFIRM:" string prefixes anywhere), seed `claims_allowed`, ≤8 items per list, `confirmed_by_owner:false`. At confirm, one call (T1b, lite model) fills `pronunciations[lang]` for the ad languages the owner uses:
```
Write how an Indian ad narrator pronounces each of these words, spelled phonetically in {script_name} script. Return ONLY JSON {"<word>":"<spelling>"}. Words: {brand_words + COMMON_WORDS}
```
`COMMON_WORDS = [WhatsApp, demo, offer, free, home]`; results are cached per language in `bridge/common-pronunciations.json` (generated once by script, reviewed by the owner for hi).

### 3.5 Wellwa ionizer — filled example (`facts_version 3`)

```json
{"v":1,"label":"the water ionizer","name":"Wellwa Alkaline Ionizer","category_key":"water","category_group":"Health","archetype":"appliance_with_output",
 "what_it_is":"Countertop alkaline water ionizer that dispenses alkaline water from its own hose at the press of a button",
 "size_class":"countertop",
 "appearance":"white glossy rectangular body about 35 cm tall and 25 cm wide, dark touch display centred on the front with a ring of blue light, three silver buttons below the display, brand name printed small at the top centre of the front, a flexible white hose rising from the top and curving forward and down",
 "stage_positive":"on a clear stretch of white kitchen counter against a plain light tiled wall",
 "idle_positive":"stands switched on with its display lit, the white hose resting in its normal curved position",
 "use_positive":null,
 "output":{"part":"the flexible white hose on top of the unit","part_short":"white hose on top","medium":"water","receptacle":"a clear glass held directly beneath the end of the hose","action_positive":"a steady clear stream of water flows from the end of the flexible white hose on top of the unit into a clear glass held directly beneath it","point":{"photo":1,"x":0.62,"y":0.18}},
 "fixed_parts":["white hose on top","front display","three silver buttons"],
 "must_show":["the stream of water starts at the end of the unit's white hose","the front display is lit"],
 "must_not_show":["liquid leaving any tap, faucet or spout that is not part of the product","a second appliance or purifier","a bottle, jug or pitcher pouring","extra pipes or plumbing on the unit","the unit held in someone's hands","steam"],
 "removed_defaults":[],"hands":"edge","people_default":"Indian family, 30–45, everyday home clothing","settings":["kitchen","dining room","office pantry"],
 "benefits":["alkaline water at one button","mineral-rich water in every glass","for the whole family","saves the cost of bottled water"],
 "proof":[{"text":"5,000+ Indian homes","number":"5000","source":"company sales records"},{"text":"free home demo","source":"owner"}],
 "offers":["Free home demo"],
 "claims_allowed":["alkaline water at one button","mineral-rich water","for the whole family","saves the cost of bottled water","5,000+ Indian homes","free home demo"],
 "banned_claims":["cures","doctor-recommended","100% pure","No.1","guaranteed"],
 "pronunciations":{"hi":{"Wellwa":"वेलवा","ionizer":"आयोनाइज़र","alkaline":"अल्कलाइन"},"hinglish":{"Wellwa":"वेलवा","ionizer":"आयोनाइज़र","alkaline":"अल्कलाइन"},"ta":{"Wellwa":"வெல்வா"},"latin_hint":{"Wellwa":"VEL-vaa"}},
 "unverified":[],"confirmed_by_owner":true}
```
`photos`: front (identity), three_quarter (identity), output_closeup (identity, crop from the owner's tap), installed (**context — draft only; it shows the real tap with the diverter**). Most-wanted missing view: `in_use`.

---

## 4. Pipeline stage machine

### 4.1 State diagram

```
Free (Next routes): product check ─► plan (3 parallel scripts → gates → one judge/rank) ─► tts-preview
POST /api/media/ad (realistic) ─► media_jobs{pipeline:2, phase:"storyboard", status:"queued", cost:0} + media_job_scenes rows
  storyboard slot: validate ─► tts (JS silence-trim, fit ladder, variant hooks) ─► room plates ─► stills (all scenes 3-wide: generate → judge → 1 edit-mode retry → safe shot)
      ─► status="review", stage="await"
  review:  approve ─► spend ─► phase="animate", queued      redraw / own photo / edit line ─► queued (storyboard, flagged scenes only) ─► review
           discard or 48 h sweep ─► status="failed", error="Discarded" (deposit, if any, is kept)
  render slot: clips (write-ahead fal URLs → poll → clip QC) ─► assemble (variable slots, punch-in, xfade, CTA) ─► captions ─► reframe ─► upload ─► done
      in-use scene fails clip QC twice ─► status="review", stage="scene_choice"
      technical failure ─► status="review", stage="render_failed" (credits held): Retry render (free) | Discard (refund, capped); auto-refund after 72 h
  done (≤7 days, clips cached): reassemble (free) | redo scene (scene share) ─► same job row, queued, phase="animate", stage="reassemble"|"redo"
Template / presenter / testimonial: pipeline 1 (legacy processAd), charged at creation with p_ref = pre-generated job id.
```

### 4.2 Stage table

Vendor prices (₹84/$): still ≈ ₹4 (`gemini-2.5-flash-image`); judge pair of calls ≈ ₹0.5; Kling 2.5 Turbo Pro 5 s ≈ ₹30; TTS ≈ ₹0.2/line.

| # | Stage | Where | Output | Idempotency | Retry / cap |
|---|---|---|---|---|---|
| S0 | product check | `POST/PUT /api/poster/products/[id]/facts` | `facts`, `photos` | — | 1 re-ask on bad JSON |
| S1 | plan | `POST /api/media/ad-plan` | ≤3 scripts + verdicts | — | 25 s wall clock; returns what is ready (≥1) |
| S2 | tts-preview | `POST /api/media/tts-preview` | WAV url + sec | `media/ai-media/<uid>/tts/<sha1(lang|voice|TTS_STYLE_v|glossaryHash|text)>.wav` | existing ladder |
| S3 | create | `POST /api/media/ad` | job + scene rows | id = `crypto.randomUUID()` | — |
| W1 | validate | storyboard slot | normalised input | — | contract error → failed (nothing charged) |
| W2 | tts | storyboard slot | `assets.wavs[{i,url,sec,tempo,text_final,shortened_from?}]` incl. variant hooks | reuses S2 WAV by hash | fit ladder §6.5; hard TTS failure → failed before any spend |
| W3 | plates | storyboard slot | one empty-room plate per distinct `shot.setting` | `sha1(setting_desc+ratio)` | inventory-judged; 1 retry; else no plate |
| W4 | stills | storyboard slot | per scene: private original + public preview, verdict | `sha1(facts_version+shot+ratio+attempt)` | §6.3; ≤2n+2 auto stills per job |
| W5 | await | — | `status:"review"` | — | 48 h sweep |
| S4 | approve | `POST /api/media/ad/[id]/approve` | spend, `phase:"animate"` | ledger unique index; status-guarded PATCH | 402 / 409 |
| W6 | clips | render slot | `media_job_scenes.clip`, local cache by `clip_hash` | write-ahead `{request_id,status_url,response_url,submitted_at}`; resume polls if <12 h old | 1 retry; ≤n+2 Kling calls/job |
| W7 | clip QC | inside W6 | verdict → `media_job_qc` | — | enforce only the hard triggers (§6.4) |
| W8 | assemble → upload | render slot (ffmpeg under systemd-run) | `outputs{}`, `input.rendered_lines` | overwrite | 1 retry, then `render_failed` |

Artefacts: originals of stills → private bucket `ad-work` (service role only) + local cache; previews and WAVs → public `media/ai-media/<uid>/jobs/<jobId>/`; raw Kling clips → **local only** at `/opt/neuraledge/media-cache/clips/<clip_hash>.mp4` (cross-job; an identical still + prompt never buys Kling twice) and job working files at `/opt/neuraledge/media-cache/ad-<jobId>/`. The worker sweeps the cache at boot and daily (files >7 days) and deletes a discarded job's storage folder.

### 4.3 Worker mechanics (one process, no leases)

- `tick()` runs two independent pickers: `busyStoryboard` claims `pipeline=eq.2&phase=eq.storyboard`; `busyRender` claims everything else (reels, legacy ads, animate/reassemble/redo). Claim = the existing status-guarded PATCH `status=eq.queued → running` with `Prefer: return=representation`; it writes `attempts = row.attempts + 1` from the row just read. `attempts > 3` → failed + capped refund.
- Boot-time requeue stays, made safe: before requeuing, kill leftover `systemd-run` scopes named `ne-ffmpeg-*` (ffmpeg can outlive a pm2 restart); resumed animate jobs poll stored fal URLs, never resubmit while a pending record <12 h old exists.
- The worker upserts `media_worker_status {id:1, caps:{ad_v2:true}, beat_at}` at boot and every 60 s.
- Every route PATCH that changes `status` is status-guarded with `return=representation` and acts only when exactly one row comes back.
- One queued/running job per user per slot; at most one `review` job per user (starting a new storyboard asks to discard the old one).
- Node `--max-old-space-size=640` goes into a new committed `ecosystem.config.cjs` (pm2 start flags live nowhere today); `sharp.concurrency(1)`, `sharp.cache({memory:64})`. `deploy.sh` restarts `neuraledge-media` only when no `running` job exists (else prints a warning and skips).
- Stage timeouts: tts 4 min, plates+stills 8 min (on timeout the job still goes to `review` with finished tiles; unfinished scenes are `needs_owner`), clips 20 min, assemble 12 min, upload 5 min.

---

## 5. Prompt templates (exact text)

Pure builders in `bridge/prompt-builders.mjs`. Every `{x}` is code-filled; a clause is emitted only when its fact exists (no literal "null"). Builders switch on `facts.archetype`. Models: `PLAN_MODEL` and `JUDGE_MODEL` default `gemini-3.5-flash` (non-lite; verify with one call in PR2; fallback constant `gemini-2.5-flash`); lite model only for T7, T1b, T11.

### (a) T2 — script planner: **three parallel calls, one per angle** (JSON mode, temperature 0.8, maxOutputTokens 2500)

```
You are a senior Indian performance-ad copywriter and director. Write ONE {length}-second vertical {tier_word} ad for the product below. Return ONLY JSON (shape at the end). Spoken lines and captions in: {LANG_RULE}. Everything else in English.

PRODUCT FACTS — the only facts you may use. Never invent numbers, prices, awards, certifications or health outcomes.
{facts_planner_json}   (label, name, what_it_is, size_class, settings, people_default, benefits, proof, offers, claims_allowed, banned_claims, output.action_positive, hands)

BRIEF
Goal: {goal} ({goal_definition})   Audience: {audience|people_default}   Tone: {tone}   Brand: {brand}
Offer: {offer|"(none — do not invent one)"}   Phone: {phone ? "shown on the end card" : "(none)"}   Speak the number aloud: {speak_number}
Owner notes: {notes|"-"}

THIS SCRIPT
Hook angle: {angle}.   First picture: {first_visual}   ← product_first = "scene 1 shows the product working" | person_first = "scene 1 shows a person with the problem, product not visible" | offer_first = "scene 1 shows the offer or number as the idea"
Exactly {scenes} scenes + 1 CTA. Scene roles in order: {beat_spine}
{tier_rule}
  realistic: "Each scene becomes ONE short video clip made from ONE still photo: one moment, one place, one action. Each spoken line must be sayable in {speech_max} seconds — about {max_words} words. Shorter is better; scenes are cut to the length of the line."
  other tiers: "Each scene lasts as long as its line; keep the whole ad near {length} seconds (about {total_words} words before the CTA)."

RULES
1. One promise, written first in "promise" (≤12 words). Every scene ladders to it.
2. One idea per scene: line, caption and picture say the SAME thing.
3. Scene 1 = hook: a number or a concrete noun in the first 4 words; the brand name "{brand_token}" must NOT appear; naming the product category is good.
4. Scene 2 says the brand once (scene 1 if there are only 2 scenes).
5. Benefit language, not specs. Specs go into "features" (4 labels of 2-3 English words).
6. Every factual statement must be one of claims_allowed, the offer, or a proof item. Questions and everyday situations are fine. Never criticise another product, brand or technology (no "RO", no competitor names).
7. Numbers only from proof, offers or the brief's offer. Small counts and times (1 button, 2 minutes, 24 hours) are allowed only if true in the facts.
8. Only the CTA mentions calling/WhatsApp. {speak_number ? "CTA = verb + channel + the number." : "CTA = verb + channel + 'the number is on screen' in the ad's language. Do not write the digits."} ≤10 words.
9. "caption": 2-5 words, ≤32 characters, digits as digits, not identical to the line.
{realistic ? RULE_10_SHOT : ""}
11. No clichés ("best quality", "sabse behtar", "No.1"); none of: {banned_claims}.
12. "why": one English sentence ≤25 words for the owner.
13. If something essential is missing, add ≤2 short questions in ENGLISH in "questions" and still return the script.

RULE_10_SHOT (realistic only):
10. "shot" holds ONLY creative choices, in English. The product's look and how it works are added by the production system — do not describe them. Fill:
   setting: one of {settings_list}; setting_desc ≤20 words (surfaces, wall, light direction; describe only what should be seen)
   people: {faces: 0-3, desc ≤15 words, Indian}; hands_visible: true|false
   framing: close_up|medium|wide ; lens "35mm"|"50mm" ; lighting ≤8 words
   product: {visible: true|false, in_use: true|false, placement ≤12 words, frame_share 0.25-0.6}
   hero_motion: ONE thing that moves, ≤15 words, one verb, nothing new enters the frame, matches the line
   camera: static|slow_push_in|subtle_parallax when product.visible, else also gentle_handheld
   Product visible in at least {min_visible} scenes, always in the product_in_use scene; exactly one or two scenes have in_use=true and they use close_up or medium framing. In hook/problem/benefit scenes the product may be absent. Never write text on screen.

JSON SHAPE
{"angle":"","first_visual":"","promise":"","headline":"<≤6 words>","why":"",
 "scenes":[{"role":"hook|problem|product_in_use|benefit|proof|offer","text":"","caption":""{realistic ? ',"shot":{"setting":"","setting_desc":"","people":{"faces":1,"desc":""},"hands_visible":false,"framing":"medium","lens":"35mm","lighting":"","product":{"visible":true,"in_use":false,"placement":"","frame_share":0.35},"hero_motion":"","camera":"slow_push_in"}' : ""}}],
 "cta":{"text":"","caption":""},"post_caption":"","features":["","","",""],
 "voice":"male|female","music":"upbeat-corporate|festive-diwali|calm-ambient|energetic-promo|inspiring-motivational|indian-sitar","template":"bold|clean|festive|offer|trust|fresh","questions":[]}
```
Angle/first-visual pairs per goal come from a fixed table (e.g. leads: pain_point + person_first, question + product_first, bold_number + offer_first). Beat spines: 2 → hook, product_in_use · 3 → hook, product_in_use, proof · 4 → hook, product_in_use, benefit, proof_or_offer · 5 → hook, problem, product_in_use, benefit, proof_or_offer · 6 → hook, problem, product_in_use, benefit, proof, offer. `min_visible` = 1 when n=2, else 2.

**T2b — gate fix (one pass per script, in parallel, temperature 0.3)**
```
This ad script failed these production checks:
{gate_errors_bulleted}
Fix ONLY the listed violations and keep everything else identical (same language and script, same promise, same scene order, same shots unless a shot check failed). Return ONLY the corrected script JSON in the same shape.
Script: {script_json}
```

**T7 — line shortener (lite, temperature 0.2)**
```
Shorten this spoken ad line so it can be said in {max_sec} seconds (about {max_words} words). Keep the same language and script, the same meaning, the same number(s), and the brand name if present. Output only the line.
Line: "{text}"
```
T7 output is re-gated (G2, G6–G9) and always shown to the owner as "Shortened to fit".

**T9 — one judge call for all scripts (`JUDGE_MODEL`, JSON, temperature 0; replaces the numeric scorecard, the recall test and both re-score loops)**
```
You review short vertical ads for a viewer who sees them ONCE on a phone, often muted. For each script answer yes/no with one short reason. Return ONLY JSON {"scripts":[{"i":0,"three_second_test":true,"single_promise":true,"visual_verbal_match":true,"claims_grounded":true,"ungrounded":["<line: claim>"],"sound_off_sentence":"<from ON-SCREEN TEXT and pictures only: what is sold, what is promised, what to do>","sound_off_ok":true,"cta_clear":true,"natural":true,"verdict":"ready|needs_fix","reason":"<≤18 words, plain English, names the scene>"}],"ranking":[0,1,2]}
three_second_test: from scene 1's line, caption and picture alone, can the viewer name the product category or the problem? claims_grounded: every factual assertion in every line maps to CLAIMS ALLOWED, the offer or a proof item; any criticism of another product or technology = false. sound_off_ok: your sound_off_sentence matches the promise and the action. natural: reads like a real {lang} speaker.
CLAIMS ALLOWED: {claims_allowed + offers + proof}   PROMISE/ACTION per script: {promises}
ON-SCREEN TEXT per script (exactly what will be rendered): {caption_cards + cta_card_text}
SCRIPTS: {scripts_json}
```
`claims_grounded:false` hard-fails a script (dropped). Other `needs_fix` scripts are shown with their reason. Scores are never shown.

### (b) T3 — scene still (`IMG_MODEL` default `gemini-2.5-flash-image`, `generationConfig:{responseModalities:["IMAGE"], imageConfig:{aspectRatio:"{ratio}"}}`; other models or 2K only via env after the logged paid check)

**Reference selection (code, 2–3 refs, never `role:"context"`, no separate logo image):** in-use scene → `in_use` photo if any, else `front` + `output_closeup`; other product-visible scenes → `three_quarter` + `front`. Then the room plate for this `shot.setting` (if any). Edit mode adds the failed still last. Max 5 images. Each ref is preceded by `Image {k}: {view}`.

**T3-A — `appliance_with_output`, product visible**
```
Photorealistic advertising still, {ratio}, editorial product photography, shot on a {lens} lens, natural skin texture.

REFERENCE IMAGES
{ref_lines}     e.g. "- Image 1: {label}, front view. - Image 2: close-up of {output.part}."
{plate ? "- Image {k}: the room. Use only its counter, wall, window and light. Ignore everything else in it." : ""}

THE PRODUCT — identical to the reference images
{label}: {appearance}. It stands {stage_positive}. Exactly one is in the picture, fully inside the frame, in sharp focus, about {frame_share*100}% of the frame width. {in_use ? "It is switched on and working: " + output.action_positive + "." : "It " + idle_positive + "."}

SCENE
[Subject] {faces > 0 ? people.desc + " (Indian, " + people_default + ")" : "no people"}.
[Action] {in_use ? output.action_positive + hands_clause : hero_motion_as_still}.
   hands_clause: edge → "; a hand at the edge of the frame holds " + receptacle_noun · operating → "; one hand touches the controls without covering them" · none → "; nobody touches it"
[Location] {setting_desc}; the product is {placement}; the surface around it is bare and tidy.
[Composition] {framing} shot; {in_use ? "the end of " + output.part_short + " and " + receptacle_noun + " are the visual centre" : "the product is the visual centre"}; important detail sits in the middle band of the frame — the top quarter and the bottom third show only plain wall and surface.
[Style] {lighting}, {tone_style_words}.

KEEP EXACTLY AS IN THE REFERENCES: body shape, colour, proportions, {fixed_parts_joined}, and where the brand name is printed. The product has only the parts the references show.
{in_use ? "Visible in this shot: " + must_show_joined + "." : ""}
The scene is complete as described: the product, {receptacle_noun|""}, {people_phrase}, the bare surface and the wall. The picture contains no lettering other than what is printed on the product in the references. All people are Indian.
{corrections ? "CORRECTION TO THE LAST IMAGE: " + fix_instruction + " Change only that; keep composition, people and lighting." : ""}
```
Rules enforced by unit test: the rendered text never contains tap/faucet/sink/bottle/jug/purifier (unwanted objects are excluded by a closed positive inventory, not by naming them); no "null"/"undefined"; no brand token outside `appearance`.

**T3-B — `item_used_by_person`**: same skeleton; product block ends with `{in_use ? use_positive : idle_positive}`; [Composition] "the {label} is fully visible and unobstructed"; KEEP line lists pattern, colour, cut/pack design. **T3-C — `static_item`**: product block uses `idle_positive`; no output clauses. **T3-N — product not visible**: no product refs, no product block; SCENE block + plate + closing line "The picture contains no lettering. No branded products or appliances are in the frame. All people are Indian."

**T3-plate**: `Photorealistic empty interior, {ratio}: {setting_desc}. A clear bare {surface_word} in the foreground against a plain wall, soft {lighting}. Nothing stands on the surfaces. No people. No lettering.` — inventory-judged; any emitter, appliance or text → one retry, else no plate.

**Safe shot** (`buildStillPromptSafe(facts, k)`): T3-A/B/C with no people, `in_use:false`, static; variant k=0 "medium three-quarter view", k=1 "close detail of the front, shallow depth of field" so two safe shots differ. Text comes from `idle_positive`; nothing ionizer-specific.

**T3-own** (owner photo): `Extend this photograph to a {ratio} frame. Keep the original photograph exactly as it is in the centre; continue its surface, wall and light naturally above and below. Add no objects, no people, no lettering.`

### (c) T4 — still QC: blind inventory → identity crop → code comparison (temperature 0, `responseSchema`)

**Call A — inventory (`JUDGE_MODEL`; candidate only, ≤1536 px; NO facts, NO expected answer).** `{watch_list}` = `[output.part_short, receptacle noun, …nouns from must_not_show, archetype extras]`, shuffled, e.g. "white hose, glass, tap or faucet, bottle, jug or pitcher, second appliance, extra pipes, steam".
```
Describe this picture as a careful inspector. Report only what is visible. Return ONLY JSON:
{"appliances":[{"what":"","count":1,"bbox":[x0,y0,x1,y1]}],
 "emitters":[{"kind":"tap_or_faucet|hose_or_tube|spout_on_appliance|bottle|jug_or_pitcher|kettle|shower|other","attached_to":"main_appliance|wall_or_sink|held_by_person|freestanding","emitting":true,"what_is_emitted":"","lands_in":""}],
 "stream_origin":"<if any liquid, air, light or steam is moving: exactly where does it start? else ''>",
 "watch":[{"item":"<each of: {watch_list}>","present":true}],
 "faces":0,"hands_visible":0,"hands_touching":"","held_objects":[""],
 "readable_text":[{"text":"","on":"main_appliance|product_pack|elsewhere"}],
 "main_subject_bbox":[x0,y0,x1,y1],"main_subject_fully_in_frame":true,
 "defects":["<warped shapes, duplicated parts, extra fingers, melted edges — or empty>"]}
List EVERY tap, faucet, spout, hose, nozzle, bottle, jug and kettle, even small or in the background, and say for each whether anything is coming out of it.
```

**Call A2 — identity (product-visible scenes only; parts: 2 refs + full-resolution crop of `main_subject_bbox` padded 12%).**
```
Images 1-2 are photographs of a real product. Image 3 is a crop from a generated picture that should show the same product. Ignore angle and lighting.
Return ONLY JSON {"same_body":true,"same_colour":true,"parts_missing":[""],"parts_added":[""],"fixed_parts_ok":{"<each of {fixed_parts}>":true},"brand_text_in_refs":"","brand_text_in_crop":"","brand_text_legible":true,"notes":""}
```

**Step B — code (`compareToFacts(A, A2, facts, shot)` in `bridge/qc-judge.mjs`), no LLM:**

| tier | check | rule |
|---|---|---|
| CRITICAL | `usage_correct` | in_use: ≥1 emitter `emitting` AND every emitting emitter has `attached_to == "main_appliance"`; not in_use: no emitter is emitting. `output:null` → true |
| CRITICAL | `no_forbidden_objects` | product visible: no `tap_or_faucet` present at all (the counter is staged without one), no `watch` item from `must_not_show` present, no `held_objects` containing the product unless handheld |
| CRITICAL | `single_unit` | exactly one appliance/product of the label's kind |
| CRITICAL | `same_product` | `same_body && same_colour && parts_missing/added empty && all fixed_parts_ok` |
| CRITICAL | `no_text` | no `readable_text` with `on == "elsewhere"` (text printed on the product or pack in the refs is allowed) |
| COSMETIC | `logo_ok` | `brand_text_in_crop` absent/illegible-and-small, or equals `brand_text_in_refs` (case-insensitive). A legible misspelling → retry with "make the printed name small and softly out of focus" |
| COSMETIC | `people_ok` / `hands_ok` | `faces == shot.people.faces` (hands are counted separately via `hands_visible`); no hand defect in `defects` |
| COSMETIC | `product_prominent`, `photo_quality` | `main_subject_fully_in_frame`, bbox width ≥ (frame_share − 0.12); `defects` empty |

Output `{checks, critical_ok, cosmetic_notes[], fix_instruction, owner_summary, tap_visible, visible_objects[]}`. `fix_instruction` is composed by code from the failing rule (for the tap case: "Remove the {kind} entirely so the wall and counter are plain; the stream starts at the end of the {output.part_short} and falls into the {receptacle noun}; keep the hand, counter and light."). `owner_summary` comes from a code table of the passed critical checks. Scenes with `product.visible:false` run Call A only (`no_text`, people, quality, and "no appliance of the product's kind").

**T4-clip — clip QC (`JUDGE_MODEL`; the 5 s mp4 inline as video — typically 3–8 MB, under the inline limit; fallback: a 3×3 contact sheet of 9 frames at ≥1280 px if video input is rejected). Blind, no facts:**
```
Watch this 5-second clip. Return ONLY JSON {"first_half_second_moves":true,"objects_appearing":[{"what":"","at_sec":0}],"emitters":[{"kind":"tap_or_faucet|hose_or_tube|spout_on_appliance|bottle|jug_or_pitcher|other","attached_to":"main_appliance|wall_or_sink|held_by_person|freestanding","emitting":true}],"stream_origin_constant":true,"appliance_count_max":1,"appliance_changes_shape":false,"text_appears":false,"defects":[""]}
Report anything that appears, morphs or disappears at ANY moment, even briefly.
```
Code derives `usage_correct`, `single_unit`, `same_product` (= !appliance_changes_shape), `stream_origin_constant`; everything else is logged only (§6.4).

### (d) T5/T6 — Kling prompt, negative, settings

`buildKlingPrompt(facts, shot, verdict, {retry})` — 25–55 words, never the brand, **mentions only objects the approved still's inventory contains**:
```
{camera_phrase}. {Label} stays exactly as shown — same shape, colours and {fixed_parts_joined}; it does not move or change. {hero_sentence}. {motion_truths}The background stays completely still; nothing new enters the frame. Real-time speed, smooth, sharp, photographic.{retry ? " " + failed_sentence : ""}
```
- `camera_phrase`: static → "Static camera, locked off, tripod shot" · slow_push_in → "Slow push-in toward the product" · subtle_parallax → "Subtle parallax, the camera drifts a few centimetres" · gentle_handheld (only when product not visible) → "Gentle handheld, barely moving". Pull-back, pans and tilt are removed (they force Kling to invent what is revealed). Static is forced for any in-use shot with a liquid medium, and on every retry.
- `hero_sentence` for in-use shots is written by code as ONE event: "A steady clear stream of {medium} flows from the end of the {output.part_short} into the {receptacle noun}; the {medium} level rises slightly." Otherwise the planner's `hero_motion`.
- `motion_truths`: from `must_show`, rendered only when the named thing is in `visible_objects` ("The display stays lit. "). No sentence about taps or sinks ever; approved stills have `tap_visible:false` by rule.
- Product-not-visible scenes drop the second sentence.

`buildKlingNegative(facts, shot, verdict)`:
```
blur, distortion, low quality, flicker, morphing, warped lettering, duplicate product, {scene_negatives}, floating objects, camera shake, watermark, subtitles{hands === "none" ? ", hands" : ", extra fingers, warped hands"}
```
`scene_negatives` (≤8, single nouns from `must_not_show`): Wellwa → "faucet, tap, sink, second appliance, bottle, jug, extra pipes, steam". Code-enforced: no term whose stem appears in the positive prompt (so never "water", "hose", "glass" here); one term per synonym group only when the positive has none of the group; ≤18 terms; never the bare word "text".

**Endpoint (`bridge/kling.mjs`)**: one verified default + one constant.
| key | endpoint | body |
|---|---|---|
| `v2.5-turbo` (default, in production today) | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | `{image_url, prompt, negative_prompt, duration:"5", cfg_scale:0.5}` (retry: 0.7) |
| `KLING_NEXT` (env; off until one paid call is logged in `bridge/ENDPOINT-CHECKS.md`) | e.g. `…/v2.6/pro/image-to-video` | field names recorded in that file at verification time |
`submitClip` returns and persists `{request_id, status_url, response_url, submitted_at}`; `pollClip` uses the stored URLs only. v3/elements, `end_image_url` and the escalation path are out of v1. Still sent as JPEG data URI at 1080 px, q92.

### (e) TTS style + native script (shared, side-effect-free `bridge/tts.mjs`: `ttsOnce, ttsLine, VOICES, wavHeader, mixedScript, trimSilence, TTS_STYLE`)

- `en`: `Read this aloud as a warm, confident Indian ad narrator. Natural pace, clear diction, friendly energy. Do not add any words of your own: `
- others: `Read this aloud as a warm, confident {language_name} ad narrator speaking to a family. Natural pace, clear pronunciation of every word, friendly energy, no accent shift on English words. Do not add any words of your own: `
- **Phone number [decision]:** spoken number is an owner toggle, default **off**; the CTA says "…number screen par hai" and the number is shown large for the whole end card plus a small chip on the last scene. When on: digits are written as single digits separated by commas and normal spaces ("9, 8, 7, 6, …"), no preamble change, no thin spaces, no pairs; verified live in PR4 before the toggle is exposed. The CTA line is elastic and never shortened.

`nativeScript(text, lang, key, {glossary})` prompt:
```
Rewrite this line in {script} script for a text-to-speech engine. Keep the meaning and word order exactly, do not translate or add words. Write English words and brand names phonetically as pronounced in English. Use EXACTLY these spellings when these words appear: {glossary_for_lang}. {latin_hints ? "Pronunciation hints for words without a spelling above: " + latin_hints + "." : ""} Keep digits as digits. Output only the rewritten line.

{t}
```
`glossary_for_lang = facts.pronunciations[lang] ∪ common-pronunciations[lang]` (same script as the target, always). After the call: the dominant Unicode block of the output must equal `SCRIPT[lang]`; otherwise retry once without the glossary. Cache key `lang|glossaryHash|text`.

### (f) T11 — hooks (`/api/media/ad-hook`, and the 2 variant hooks generated at "Use this" when 3 videos are chosen; lite, JSON, temperature 0.9)
```
Write {k} alternative opening lines for this ad, same language and script: {LANG_RULE}.
Product: {name} ({label}). Promise: "{promise}". Claims you may use: {claims_allowed}. Numbers you may use: {proof_numbers|"(none)"}. Banned: {banned_claims}.
The picture on screen during this line is: {scene1_shot_summary}. The line must fit that picture.
Each line: sayable in {speech_max} seconds (about {max_words} words), a number or concrete noun in the first 4 words, no brand name, no criticism of other products, a different angle from "{current}" and from each other. For each, a 2-5 word caption.
Return ONLY JSON {"hooks":[{"text":"","caption":""}]}
```
Variant hooks pass G2, G6–G9, are shown on Screen B and C, are TTS'd in W2 and reuse all clips. If variant generation fails, the job is created with 1 video at the 1× price.

### Filled Wellwa example — 20 s realistic, Hinglish, goal leads

**(a) Script A** (angle pain_point, first_visual person_first; promise "Ghar par hi alkaline paani — ek button se"):

| # | role | line (est. s) | caption | shot |
|---|---|---|---|---|
| 1 | hook | "Har mahine paani ki bottles par kitna kharcha?" (2.8) | Bottle ka kharcha? | product **not visible**; kitchen; "woman about 35 in a cotton kurta sets a heavy pack of water bottles on the counter and sighs"; faces 1; medium 35mm; hero "she lowers the pack onto the counter"; gentle_handheld |
| 2 | product_in_use | "Wellwa ionizer: ek button, aur alkaline paani ghar par." (3.4) | Ek button. Alkaline paani. | visible, in_use; kitchen; faces 0, hands_visible true; close_up 50mm; placement "centre of the counter"; frame_share 0.5; static (forced) |
| 3 | benefit | "Har glass mein mineral-rich paani, poore parivaar ke liye." (3.4) | Poore parivaar ke liye | product **not visible**; dining room; faces 3 "parents and a child drinking water at the table"; wide 35mm; hero "the child drinks and grins"; gentle_handheld |
| 4 | proof_or_offer | "5,000+ gharon ka bharosa. Free home demo bhi." (3.8) | 5,000+ ghar · Free demo | visible, idle; kitchen; faces 1 "the same woman beside the unit smiling at the camera with a full glass"; medium 35mm; frame_share 0.35; slow_push_in |
| CTA | — | "Abhi WhatsApp karein — number screen par hai." | WhatsApp 98xxx xxxxx | end card ≈3.5 s |

Gates: brand absent from scene 1, present in 2; "5,000" normalises to proof 5000; every assertion ∈ `claims_allowed`; one in-use scene; product visible in 2 scenes (two fidelity-risk stills instead of four). T9: ready — "Opens on a cost every family knows; Wellwa named by second 4; one WhatsApp action." Real length ≈ 3.1+3.7+3.7+4.1+3.5 = 18.1 s, shown on Screen B.

**(b) Still prompt as sent for scene 2** (parts: front.png, hose-crop.png, kitchen plate, text):
```
Photorealistic advertising still, 9:16, editorial product photography, shot on a 50mm lens, natural skin texture.

REFERENCE IMAGES
- Image 1: the water ionizer, front view. - Image 2: close-up of the flexible white hose on top of the unit.
- Image 3: the room. Use only its counter, wall, window and light. Ignore everything else in it.

THE PRODUCT — identical to the reference images
the water ionizer: white glossy rectangular body about 35 cm tall and 25 cm wide, dark touch display centred on the front with a ring of blue light, three silver buttons below the display, brand name printed small at the top centre of the front, a flexible white hose rising from the top and curving forward and down. It stands on a clear stretch of white kitchen counter against a plain light tiled wall. Exactly one is in the picture, fully inside the frame, in sharp focus, about 50% of the frame width. It is switched on and working: a steady clear stream of water flows from the end of the flexible white hose on top of the unit into a clear glass held directly beneath it.

SCENE
[Subject] no people.
[Action] a steady clear stream of water flows from the end of the flexible white hose on top of the unit into a clear glass held directly beneath it; a hand at the edge of the frame holds the glass.
[Location] bright modern Indian kitchen, white counter, plain light tiled wall, window light from the left; the product is centre of the counter; the surface around it is bare and tidy.
[Composition] close_up shot; the end of the white hose on top and the glass are the visual centre; important detail sits in the middle band of the frame — the top quarter and the bottom third show only plain wall and surface.
[Style] soft morning daylight, warm and clean.

KEEP EXACTLY AS IN THE REFERENCES: body shape, colour, proportions, white hose on top, front display, three silver buttons, and where the brand name is printed. The product has only the parts the references show.
Visible in this shot: the stream of water starts at the end of the unit's white hose; the front display is lit.
The scene is complete as described: the product, the glass, one hand at the frame edge, the bare surface and the wall. The picture contains no lettering other than what is printed on the product in the references. All people are Indian.
```

**(c) What the original tap render receives.** Call A (blind): `emitters:[{kind:"tap_or_faucet",attached_to:"wall_or_sink",emitting:true,what_is_emitted:"water",lands_in:"glass"},{kind:"hose_or_tube",attached_to:"main_appliance",emitting:false}]`, `stream_origin:"the chrome faucet at the sink"`. Step B: `usage_correct:false` (an emitting emitter is not attached to the product), `no_forbidden_objects:false` (`tap_or_faucet` present), `tap_visible:true` → `fix_instruction`: "Remove the faucet entirely so the wall and counter are plain; the stream starts at the end of the white hose on top and falls into the glass; keep the hand, counter and light." → attempt 2 in edit mode → pass, `owner_summary` "one unit · water from the unit's hose only · no text". A second failure → safe shot + the "will not show the product working" acknowledgement. Nothing reaches fal without `critical_ok`. (The archived sample is a frame grabbed from the delivered mp4 with burned-in captions, so `no_text` is ignored for that fixture.)

**(d) Kling request for the passed still:**
```
prompt: "Static camera, locked off, tripod shot. The water ionizer stays exactly as shown — same shape, colours and white hose on top, front display, three silver buttons; it does not move or change. A steady clear stream of water flows from the end of the white hose on top into the glass; the water level rises slightly. The display stays lit. The background stays completely still; nothing new enters the frame. Real-time speed, smooth, sharp, photographic."
negative_prompt: "blur, distortion, low quality, flicker, morphing, warped lettering, duplicate product, faucet, tap, sink, second appliance, bottle, jug, extra pipes, steam, floating objects, camera shake, watermark, subtitles, extra fingers, warped hands"
body: {"image_url":"data:image/jpeg;base64,…","prompt":"…","negative_prompt":"…","duration":"5","cfg_scale":0.5}
```
Clip QC (video in): a `tap_or_faucet` emitter at any moment, or `stream_origin_constant:false` → one retry (cfg 0.7, `failed_sentence` "The stream always starts at the end of the white hose.") → second failure → `scene_choice` pause (this is the in-use scene).

**TTS scene 2:** glossary (hinglish) → "वेलवा आयोनाइज़र: एक बटन, और अल्कलाइन पानी घर पर।" → silence-trimmed 3.5 s ≤ 3.8 → tempo 1.0 → slot 3.8 s.

---

## 6. Quality gates & thresholds

### 6.1 Speech budget (`bridge/ad-rules.mjs`)

Clips are 5 s; each is cut from a 0.4 s head offset (skips Kling's frozen start) and every clip, including the last, crossfades 0.4 s into the next element (this matches `realistic-engine.mjs`). So `clipLen ≤ 4.55`, `slotSec = clamp(speechSec + 0.3, 2.4, 4.1)`, `clipLen = slotSec + 0.4`, `SPEECH_MAX = 3.8`. One exported `slotSec()` is used by the worker's `sceneDur`, by `durs` in `renderRealisticAd` (replacing `clips.map(() => 5)`), and by the animatic. A free punch-in (crop 1.0 → 1.12) is applied at the midpoint of any slot >3.2 s. CTA slot = `max(3.5, ctaSec + 0.6)`.

Budget unit = estimated seconds: `estSec(text, lang) = spokenUnits(text, lang) / RATE[lang]`. `spokenUnits` = syllables: Latin text → vowel groups per word (min 1); Indic → aksharas (independent vowels + consonants not followed by a virama; ZWJ/ZWNJ ignored); numbers <100 → 3, 100–99,999 → 5, "+" → +3, "₹" → +2, "%" → +3, a ≥7-digit run → 2 per digit; hyphenated words split. `RATE` (syllables/s) lives in `bridge/tts-rates.json`, seeded by the one-off `bridge/tts-calibrate.mjs` (20 lines × 12 languages through real TTS after silence trim, ≈₹50, run in PR4 and re-run by hand when voices change). Placeholder values until the script runs: en 4.6, hi/hinglish 5.0, mr/gu/pa/bn/or 5.0, ta/te/kn/ml 5.6. Planner guidance `max_words`: en 10, hi/hinglish 8, mr/gu/pa/bn/or 7, ta/te/kn/ml 6. No runtime calibration table.

### 6.2 Deterministic gates (client meters, `ad-plan`, and re-run in `POST /api/media/ad` → 400)

- G1 scene count = `scenesFor(tier, length)` (realistic 10→2, 20→4, 30→6; template 10→2, 20→3, 30→4, 45→5, 60→6). Realistic real length = Σ slots + CTA must be ≤ length + 2 (shown to the owner); no Σ`seconds` field.
- G2 realistic scene line: `estSec ≤ 3.8`. Other tiers: Σ `estSec` of non-CTA lines ≤ 0.85 × length. The CTA is excluded everywhere.
- G3 caption: 2–5 words, ≤32 chars, not identical to the line, digits as digits.
- G4 exactly one CTA. "No call/WhatsApp in non-CTA lines" is checked with `CHANNEL_TOKENS[lang]` for en/hi/hinglish; for regional languages it is part of T9 (`cta_clear`).
- G5 phone digits appear in the CTA text iff `speak_number`; no other ≥7-digit run anywhere.
- G6 banned claims: `\b`-bounded Latin list `(cure[sd]?|ilaaj|guarantee[d]?|100\s*%|no\.?\s*1|doctor[- ]recommended|best in|sabse behtar|world'?s)` ∪ per-script lists in `BANNED_NATIVE` (गारंटी, इलाज, உத்தரவாதம், গ্যারান্টি, ગેરંટી, ਗਾਰੰਟੀ, హామీ, ಖಾತರಿ, ഗ്യാരണ്ടി, ଗ୍ୟାରେଣ୍ଟି …) ∪ `facts.banned_claims`. Exempt when the phrase occurs in `facts.proof[].text`, `facts.offers[]` or `brief.offer` ("1 saal ki warranty", "100% cotton"); the UI hint says "Add it to Numbers I vouch for to use it".
- G7 numbers: only numbers with ≥3 digits or carrying ₹/%/x/+ are checked; normalise commas, "+", Indic digits and number words up to ten; each must appear in proof ∪ offers ∪ brief.offer ∪ phone.
- G8 script: `hinglish` → no Devanagari; `hi`/regional → ≥60% of letters in the target block **after removing** brand tokens, glossary words and digits.
- G9 brand token (distinctive word of `facts.name`, in Latin or any `pronunciations` spelling) absent from scene 1, present in scene 2 (scene 1 allowed when n=2). Category nouns are welcome in the hook.
- G10 (realistic only) shot: camera in the whitelist for its visibility; `hands ≤ facts.hands`; 1–2 in-use scenes, each `visible`, close_up|medium; product visible in ≥ `min_visible` scenes; `frame_share ∈ [0.25,0.6]`; not handheld ⇒ no "hold(s|ing) the {label}".
- G11 (realistic only) `hero_motion` ≤15 words, none of `/orbit|rotat|spin|whip|dolly|zoom out|pull back|pan|fast|dramatic|cinematic/i`; **when `product.visible`**, none of `/\b(tap|faucet|sink|bottle|jug|purifier)\b/i` in `setting_desc`, `placement` or `hero_motion`.

Template/presenter/testimonial scripts carry no `shot`; G10/G11 are skipped. Presenter: only G2-total, G4–G9 (one monologue TTS pass; no per-line fit). Flow: gates → one T2b pass → still failing → script dropped. No regenerate loops.

### 6.3 Still QC policy

- Judge = Call A (+A2) + code, §5(c). `critical_ok` required for a pass. Enforced from day one with the owner as the final gate; `QC_ENFORCE=0` exists only for calibration runs.
- Attempt 1: one candidate. Critical fail → attempt 2 in edit mode with the code-written `fix_instruction` (a visible tap always means redraw). Second critical fail, or `same_product:false` twice → safe shot (k-th variant), judged once; fail → `needs_owner` (blocks Animate; tile offers Redraw / Use my own photo).
- Cosmetic fail → one retry; then accepted with an amber note on the tile. Cosmetic checks never trigger a safe shot.
- An in-use scene that ends as a safe shot requires the acknowledgement checkbox and sets `scorecard.stale`.
- Budgets are separate: **auto** ≤3 attempts/scene and ≤2n+2 stills/job; **owner redraws** (first per scene free, then 1 credit) are outside the auto cap, ≤6 per scene, and a paid redraw never returns a safe shot (failure refunds the credit).
- Calibration (`bridge/qc-calibrate.mjs`): fixtures in `bridge/qc-fixtures/` — the faucet frame grabbed from the delivered mp4 (flag `ignore:["no_text"]`), ~30 stills from `--make-legacy` (old `sceneImage` prompt across the SHOTS presets), and ≥30 deliberate bad stills from `--make-bad` (one per `must_not_show` item: tap pouring, two units, held in hand, jug), labelled by the owner in `labels.json`. Report precision/recall on `usage_correct` and `same_product` **with Wilson 95% intervals**. Until the lower bounds exceed 0.8 there is no talk of skipping owner approval. Legacy `processAd` also uploads its stills from now on so real failures accumulate.

### 6.4 Clip QC policy
Shadow by default (log to `media_job_qc`). Hard triggers only: `usage_correct:false`, `single_unit:false`, `same_product:false`, `stream_origin_constant:false`, or `first_half_second_moves:false` on the hook clip (→ head offset 0.8 s for that clip, no re-buy). A hard trigger → one retry (static camera, cfg 0.7, `failed_sentence`). Second failure: idle scene → photo motion (`renderKenBurns`, zoom 1.0→1.06) + scene-share refund; in-use scene → `scene_choice` pause (§2); a frozen stream under a zoom is never shipped silently. Cap `MAX_KLING_CALLS_PER_JOB = n + 2`.

### 6.5 Voice fit ladder (W2, pure JS on PCM16 24 kHz)
`trimSilence` (RMS threshold, 60 ms pads) → measure from byte length → ≤3.8 s: ok · over by ≤12%: `tempo = sec / 3.8` stored with the wav (the animatic uses `audio.playbackRate`, assembly uses `atempo`) · otherwise T7 (≤2 rounds, re-gated, shown as "Shortened to fit" with old and new text; captions use `text_final`) · still over → scene `line_too_long`, owner edits the line. Never a hard trim. Realistic scene lines only; never the CTA, never other tiers. A hard TTS failure fails the job before any spend. `wordCues` spreads words over the trimmed speech span, not the whole slot.

### 6.6 Assembly sanity
ffprobe duration within ±0.5 s of Σ slots; audio present; file >200 KB; else one retry, then `render_failed`.

### 6.7 Captions / CTA
Both layers render by default (`captions:"words"`): **keyword card** (the 2–5-word caption, large, centred at 0.22·H reel / 0.16·H square and wide, first 1.6 s of each scene; whole scene when `captions:"off"`) and **word-highlight captions** (3 words per group for Indic, 4 for Latin, ≤32 chars, digit runs never split) at 0.68·H reel, 0.80·H square and wide. T3's composition rule keeps the top quarter and bottom third plain so neither covers the pour. The brand chip stays top-left; the keyword card sits below it. T9 is fed exactly these rendered strings. Square/wide are `reframe()` letterboxes of the vertical master; captions for those formats are drawn after reframing at the format's own sizes. CTA card: verb + channel, number ≥6% of frame height, offer line, held for the whole CTA slot; `CTA_LABELS[lang]` and `OFFER_LABELS[lang]` tables for all 12 languages with English fallback replace the hard-coded Devanagari strings in `ad-engine.mjs`. Fonts: one exported `fontFamilyFor(text)` (Unicode block → Noto family) used by `ad-engine.fam()`, `realistic-engine.captionOverlay` and `caption-engine`; deploy step `apt-get install -y fonts-noto-core fonts-noto-extra` + `fc-list | grep -c "Noto Sans Tamil"` check.

---

## 7. Credits & billing

Pricing unchanged (`adCredits(len) = max(20, ceil(len/5)×10)`, ×1.5 for 3 videos). Ledger is the only source of truth.

| Event | User pays | Reason (`ref`) |
|---|---|---|
| Product check, scripts, hooks, judge, tts-preview | 0 (rate-limited) | — |
| Storyboard | 0 for the first 2 per product and 4 per user per IST day; then a **5-credit deposit**, credited toward Animate for that job, kept if discarded. Requires balance ≥ animate cost. **[decision — see §12 Q1]** | `ad-storyboard` (jobId) |
| Owner redraw / own photo | first per scene free, then 1 credit (refunded if it fails) | `ad-redraw` (jobId:scene:n) |
| Edit line (re-TTS) | 0, ≤10 per job | — |
| Animate | `ceil(adCredits(len) × (videos===3 ? 1.5 : 1))` minus the deposit | `ad-animate` (jobId) |
| Scene delivered as photo motion | refund full scene share `floor(cost/n)` | `ad-scene-refund` (jobId:scene) |
| Cancel during clips | before any clip accepted → full refund; otherwise `floor(cost/n)` × scenes not yet accepted. Disabled from assembly onward. In-flight fal calls are cancelled only while IN_QUEUE | `ad-cancel-refund` (jobId) |
| Technical failure | credits held; Retry render free; Discard → refund; auto-refund after 72 h in `render_failed` | `ad-refund` (jobId) |
| Reassemble (line, voice, music, hook, CTA, captions) ≤7 days | 0, ≤5 per job | — |
| Redo scene N ≤7 days | `ceil(cost/n)`; refunded if the new clip fails QC twice | `ad-scene-redo` (jobId:scene:k) |
| Template / presenter / testimonial | at creation, after the voice-over audition; refund on failure | `ad-builder` / `ad-refund` (jobId) |

`refundCapped(jobId, userId, reason, credits, ref)` (shared helper in `src/lib/media/ad-credits.ts` and `bridge/ad-credits.mjs`): reads ledger rows whose `ref` starts with the job id, grants `min(credits, paid − refunded)`, and treats Postgres 23505 as "already applied, continue". Partial unique index on `credit_ledger(reason, ref) where ref is not null and reason like 'ad-%'`. Approve: spend → guarded PATCH; if the PATCH returns 0 rows, `refundCapped` the spend. The job id is generated with `crypto.randomUUID()` before any spend and inserted explicitly. Caps in `bridge/ad-caps.mjs`: attempts/scene 3, auto stills `2n+2`, owner redraws/scene 6, Kling calls `n+2`, storyboards/day 2 per product and 4 per user free, reassembles 5. Vendor cost is logged as a console line per job (`[ad-cost] job stills=… kling=…`); no paise accounting tables, no daily Kling cap machinery.

---

## 8. Data model & API

### 8.1 One migration: `supabase/migrations/0044_ad_pipeline_v2.sql` (re-check the number; applied by hand in the SQL editor like the others; ends with `select 'ok' as status`)

```sql
-- poster_products columns + photos backfill: see §3.1
alter table public.media_jobs drop constraint if exists media_jobs_status_check;
alter table public.media_jobs add constraint media_jobs_status_check check (status in ('queued','running','review','done','failed'));
alter table public.media_jobs
  add column if not exists pipeline int not null default 1,
  add column if not exists phase text not null default 'animate',
  add column if not exists stage text not null default '',
  add column if not exists progress jsonb not null default '{}'::jsonb,
  add column if not exists assets jsonb not null default '{}'::jsonb,     -- worker-only writer: {wavs[], plates{}, outputs_at}
  add column if not exists attempts int not null default 0;

create table if not exists public.media_job_scenes (
  job_id uuid not null references public.media_jobs(id) on delete cascade, i int not null,
  status text not null default 'pending',          -- pending|pass|pass_with_notes|safe_shot|needs_owner|line_too_long
  preview_url text, original_key text,             -- public 720 px watermarked preview; private ad-work key
  owner_summary text, notes jsonb not null default '[]'::jsonb, tap_visible boolean, visible_objects jsonb,
  redraw_requested boolean not null default false, redraw_mode text, redraw_note text, own_photo_url text, redraws int not null default 0,
  line jsonb,                                      -- {text_final, shortened_from, sec, tempo}
  clip jsonb, clip_pending jsonb,                  -- {hash, fallback, qc} / {request_id,status_url,response_url,submitted_at}
  updated_at timestamptz default now(), primary key (job_id, i));
alter table public.media_job_scenes enable row level security;
create policy "own job scenes" on public.media_job_scenes for select using (exists (select 1 from public.media_jobs j where j.id = job_id and j.owner_id = auth.uid()));
grant select (job_id,i,status,preview_url,owner_summary,notes,redraws,line,clip) on public.media_job_scenes to authenticated;

create table if not exists public.media_job_qc (id bigserial primary key, job_id uuid not null, scene int, stage text, attempt int, model text, verdict jsonb, ms int, created_at timestamptz default now());  -- insert-only, service role only
create table if not exists public.media_worker_status (id int primary key, caps jsonb not null default '{}'::jsonb, beat_at timestamptz);
create unique index if not exists credit_ledger_ad_reason_ref_uidx on public.credit_ledger(reason, ref) where ref is not null and reason like 'ad-%';
insert into storage.buckets (id, name, public) values ('ad-work','ad-work', false) on conflict do nothing;
```
Row-per-scene removes every read-modify-write race: the redraw route PATCHes `redraw_*` on one row, the worker PATCHes `status/preview_url/…` on the same row, and QC verdicts are inserts. No JSONB arrays are mutated concurrently; no RPCs are needed. Frozen facts live in `input`, which the owner may read (it is their own data); judge internals are not readable.

### 8.2 `media_jobs.input` v2 (written once at creation; the worker never overwrites `script`)

```ts
{ v: 2, product_id: string|null, facts_version: number, facts: ProductFacts, refs: Photo[],
  brief: { tier, length, lang, goal, audience, tone, offer, phone, brandName, website, logoUrl, notes, category },
  script: { angle, first_visual, promise, headline, why, scenes: [{ role, text, caption, shot? }], cta: { text, caption }, features: string[4], post_caption },
  variant_hooks: [{ text, caption }],
  options: { voiceStyle, voice, music, template, formats, captions, videos: 1|3, speak_number: boolean },
  scorecard: { verdict, reason, stale: boolean },
  // written by the worker at the end:
  rendered_lines?: string[], outputs?: Record<string,string>, duration_sec?: number }
```
`legacyView(input)` in `bridge/ad-rules.mjs` → `{product, scenes:[{text, caption_text}], cta: string, script: string[], …brief, …options}` feeds `renderAd`, presenter and testimonial, so `String(inp.cta)` never sees an object. `editJob` branches on `input.v`.

### 8.3 Routes

Auth: `/api/poster/*` stays Bearer (`userFromRequest`); `/api/media/*` stays cookie `requireUser` + `sameOrigin`. Media routes read `poster_products` with the admin client filtered by `user_id = session.user.id` (brand-shared products: out of v1). All error strings English — replace "Credits kam hain…", "Product ka naam zaroori hai.", "Testimonial text zaroori hai.", "Aapki (presenter ki) photo zaroori hai.", "Product ka naam likhein.", "id chahiye.".

- `POST|PUT|GET /api/poster/products/[id]/facts` — draft / confirm (rejects while `unverified` contains a core field: `output`, `stage_positive`, `appearance`, `must_not_show`) / read. `POST|PUT /api/poster/products` accept `photos[]` (≤6, under `media/poster/<uid>/`, server-side ≥720 px check).
- `POST /api/media/ad-plan` `{product_id|null, product_name?, tier, length, lang, goal, audience?, tone, offer?, phone?, speak_number?, brandName?, notes?}` → `{scripts:[{script, gates:{ok,errors[]}, verdict:"ready"|"needs_fix", reason, est:{per_scene_sec[], total_sec}}], questions:[], budgets, facts_version}`; ranked; 25 s wall clock; ≥1 script else 502 "Could not write scripts — try again".
- `POST /api/media/ad-hook`, `POST /api/media/tts-preview` `{text, lang, voiceStyle, product_id?}` → `{url (wav), sec}` (imports `bridge/tts.mjs`; 20/10 min).
- `POST /api/media/ad` — input v2. Re-runs gates; if the text differs from what T9 saw, runs T9 once. Realistic: requires `AD_PIPELINE_V2=1` **and** `media_worker_status.caps.ad_v2` with `beat_at` < 2 min old (else 503 "Video service is updating — try again in a minute"); checks quota/deposit and balance; inserts job `{id, pipeline:2, phase:"storyboard", cost:0}` + scene rows; returns `{id, animate_cost, deposit}`. Other tiers: spend with `p_ref = id`, insert `{pipeline:1}`.
- `POST /api/media/ad/[id]/approve` `{ack_no_in_use?}` · `/redraw` `{scene, mode:"redraw"|"change"|"own_photo"|"safe", chips?, note?, photo_url?}` · `/line` `{scene, text, caption?}` · `/scene-choice` `{scene, choice:"photo_motion"|"retry"|"other_still"}` · `/discard` · `/retry-render` · `/reassemble` `{lines?, cta?, voiceStyle?, music?, hook?, captions?}` · `/redo-scene` `{scene, note?}`. All status-guarded.
- `GET /api/media/jobs` — slim list (`id, kind, status, phase, stage, progress, output_url, cost, error, created_at` + a few `input` fields picked server-side); `GET /api/media/jobs?id=` — full job + scene rows + signed nothing (previews are public, originals never leave). The page polls the detail endpoint every 4 s only for the active job. The 48 h review sweep and 72 h `render_failed` auto-refund run in the worker's daily sweep (admin rights), not on listing. `DELETE` — guarded by `status=in.(queued,running)` with `return=representation`; refund via `refundCapped`.

### 8.4 Shared code location
`bridge/ad-rules.mjs` (zero-dep ESM: `LANGS, LANG_RULE, scenesFor, beatSpine, spokenUnits, estSec, slotSec, gates, validateAdInput, legacyView, CTA_LABELS, OFFER_LABELS, fontFamilyFor, CAMERA_WHITELIST`) and `bridge/tts.mjs` live **in `bridge/`**; Next imports them through a tsconfig path alias `@bridge/*` → `./bridge/*` (`allowJs` is on). PR1 proves with `next build` that Turbopack resolves the alias; if not, `scripts/sync-shared.mjs` copies the two files into `src/lib/media/shared/` at `prebuild` (generated, git-ignored). One source of truth either way.

---

## 9. Worker changes

Keep: `ttsOnce/ttsLine` ladder (moved), `fetchPhoto`, systemd-run guard, `buildVo`, `captioned`, `reframe`, upload helpers, CTA card renderer, variants rotation, presenter/testimonial engines, reels.

- **`bridge/tts.mjs`** (new, side-effect-free; `media-worker.mjs` has `process.exit`, timers and boot requeue at top level and cannot be imported by Next).
- **`bridge/prompt-builders.mjs`** (new, pure) + `prompt-builders.test.mjs` with three fixtures (Wellwa appliance, saree `item_used_by_person`, atta pack `static_item`). Assertions: Wellwa in-use still prompt contains `output.action_positive` and every `must_show`, and **no** `tap|faucet|sink|bottle|jug|purifier`; saree and atta prompts contain no `glass|panel|display|water|hose`; no "null"/"undefined"; at most 5 images and never a `context` photo; Kling prompt has exactly one whitelist camera phrase, one hero sentence with a single ";" clause pair, 25–55 words, no brand token, no object absent from `visible_objects`; negative has no stem shared with the positive, contains "faucet" for Wellwa, ≤18 terms; static forced for liquid in-use.
- **`bridge/qc-judge.mjs`**: `inventory()`, `identity()`, `compareToFacts()` (pure, unit-tested with recorded inventories incl. the faucet case), `judgeClip()`. **`bridge/qc-calibrate.mjs`** with `--make-legacy`, `--make-bad`, Wilson intervals. **`bridge/tts-calibrate.mjs`**.
- **`bridge/kling.mjs`**: `submitClip`, `pollClip(urls)`, clip cache lookup by `clip_hash = sha1(still_sha + prompt + negative + endpoint)`.
- **`bridge/realistic-engine.mjs`**: `generateStill()` (ref selection, plate, edit mode, own-photo mode), `renderStoryboard(job)` (plates → all scenes 3-wide; per-scene row PATCH; preview = sharp 720 px + tiled 8%-opacity "PREVIEW" watermark; original → `ad-work`), `renderClips(job)`, assembly using `slotSec()` for every clip slot, head offset 0.4 s, punch-in, `atempo` per line, `fontFamilyFor` in `captionOverlay`, both caption layers. The ionizer `SHOTS` table and the legacy realistic branch are deleted at cut-over (PR3); no-plan fallback = `defaultShots(facts)`.
- **`bridge/media-worker.mjs`**: two-slot `tick()`; `processAdV2` = `runStoryboard` / `runAnimate` / `runReassemble` / `runRedoScene`; legacy `processAd` claims only `pipeline=eq.1` (**added in PR0, before any route can emit pipeline 2**), reads input through `legacyView`, writes `rendered_lines` instead of overwriting `script`, passes `p_ref = job.id`, uses reason `ad-refund`; boot: kill orphan ffmpeg scopes, idempotent requeue, cache sweep, status beat; `kling:` boot log reads `FAL_KEY`.
- **`bridge/ad-engine.mjs`**: `fam()` → `fontFamilyFor`; label tables; `renderKenBurns`. **`bridge/caption-engine.mjs`**: per-format baselines, speech-span cues. **`bridge/presenter-engine.mjs`**: `ctaSec = max(3.5, …)`; CTA card shows `cta.text`; total-words gate only.
- **Ops**: `ecosystem.config.cjs`; `deploy.sh` conditional worker restart + fonts check; env `AD_PIPELINE_V2, IMG_MODEL, PLAN_MODEL, JUDGE_MODEL, KLING_NEXT, QC_ENFORCE`.

---

## 10. UI changes

`src/app/poster/video/page.tsx` — extended in place, not rewritten: remove Hindi `useT()` branches; add `ProductPicker` (+ inline New product), `ProductCheckSheet` (Screen A2, also opened from `src/app/poster/products/page.tsx`, which gains the ≤6-photo picker with view chips), `ScriptCards` (Ready/Needs-a-fix pill, reason, seconds meters, real total length, variant hooks), `StoryboardGrid` (tiles, notes, Change picture sheet, Use my own photo, Edit line, shortened-line banner, acknowledgement box, cost card), `Animatic` (HTML/JS: `<img>` crossfades, `Audio` per line with `playbackRate = tempo`, keyword card, 3/4-word caption groups timed over the speech span, CTA card div), `SceneChoiceSheet`, history actions (Reassemble sheet, Redo scene). The voice-over audition sheet serves template/presenter/testimonial. Presenter: client-side check of the source photo (≥720 px, one face via the browser `FaceDetector` when available; otherwise size only) with the message "Use a clear, front-facing photo". `src/lib/media/ad-defaults.ts`: `defaultsFor(product, profile, facts)`; tier defaults to template unless the product is eligible for realistic. `src/app/(dashboard)/studio/page.tsx`: exclude `kind=ad`.

---

## 11. Implementation order and tests

| PR | Scope | Test |
|---|---|---|
| **PR0 — safety + bug fixes (deploy the worker first, then the app)** | Migration 0044; legacy worker claims `pipeline=eq.1` only; status beat; `ecosystem.config.cjs`; conditional worker restart in `deploy.sh`; orphan-ffmpeg cleanup; `crypto.randomUUID()` job id + `p_ref`; `ad-refund` reason; status-guarded DELETE; 12 `lang` codes stored; `cta`, `category`, `goal`, `audience`, `tone`, `notes` stored; `scenes ≤6`, `script ≤7`, `features ≤4`; English API errors; legacy stills uploaded for the fixture set; grab the faucet frame from yesterday's mp4 into `bridge/qc-fixtures/`. | Insert a `pipeline:2` row by hand → legacy worker ignores it. Double-tap cancel → one refund row. Tamil job stored as `ta`. |
| **PR1 — facts + rules** | `bridge/ad-rules.mjs` + alias proof; `product-facts.ts`; defaults by group; facts routes (T1, T1b); `ProductCheckSheet`; photos picker incl. `in_use` view. | Wellwa draft from 4 photos: `output.part` names the hose; `stage_positive` has no sink/tap; tap-to-point stores a crop; confirm blocked while core fields unverified; RO-dealer product in `water` gets no hose default and can delete "bottle". Gate unit tests: script A passes; one mutant per gate fails exactly that gate; "secure" does not trip G6; "1 saal ki warranty" in offers passes; "5,000+" matches 5000; "2 din" passes G7. |
| **PR2 — builders + judge + calibration** | `prompt-builders`, `qc-judge`, `qc-calibrate` (`--make-legacy`, `--make-bad`), model verification calls logged in `bridge/ENDPOINT-CHECKS.md`. Judge runs in shadow on legacy stills. | Builder tests (three archetypes). `compareToFacts` on the recorded faucet inventory → `usage_correct:false`, `tap_visible:true`. Calibration report with Wilson intervals delivered to the owner. |
| **PR3 — storyboard before money (the fix for yesterday's bug; cut-over)** | `tts.mjs` extraction; two-slot worker; `runStoryboard`/`runAnimate`; plates; previews + private originals; `kling.mjs` with persisted URLs + clip cache; clip QC hard triggers; `scene_choice`; routes create/approve/redraw/line/discard/retry-render/scene-choice; Screen C + animatic; `AD_PIPELINE_V2=1`; delete `SHOTS` and the legacy realistic branch. Uses the existing planner output mapped into v2 until PR4. | Kill the worker mid-Kling → resume polls stored URLs, fal dashboard shows no second submit. Storyboard runs while another user's animate job polls. Approve with `needs_owner` → 409; insufficient balance → 402, status unchanged. Forced double clip-QC failure on the in-use scene → job pauses with three choices. Refund sum never exceeds `cost`. |
| **PR4 — planner, voice fit, languages** | T2 ×3 parallel, T2b, T9, T11 at plan time; `estSec`, `tts-calibrate` → `tts-rates.json`; fit ladder; per-language pronunciations + script-block validation; spoken-number toggle verified live; voice-over audition for other tiers. | Plan returns within 25 s with ≥2 scripts, three different first visuals; a script with "RO paani acidic" is dropped by `claims_grounded`. Tamil line with glossary → output is Tamil block only. A 4.2 s line → tempo 1.10, no shortening; a 5 s line → "Shortened to fit" shown, captions match the new text. |
| **PR5 — captions, fonts, labels** | Both caption layers + per-format layout; `fontFamilyFor`; Noto install + `fc-list` check; `CTA_LABELS`/`OFFER_LABELS` ×12; presenter CTA; Screen A format note. | Render one template CTA card + caption strip per script (9 scripts) → no tofu (visual check of 9 PNGs). Reel: keyword card at 0.22·H, word captions at 0.68·H, pour visible between them. |
| **PR6 — credit-savers after the first render** | Reassemble, Redo scene, Use my own photo, storyboard quota + deposit, daily sweeps (48 h review, 72 h render_failed, 7-day cache). | Change music on a done job → new mp4, zero Kling calls, zero credits. Re-order an identical job within 7 days → clip cache hits. Third storyboard of the day for one product asks for the 5-credit deposit and deducts it at Animate. |

### End-to-end test plan (owner's account)
1. **Ionizer tap case.** Unit: scene-2 still prompt contains the hose sentence and none of tap/faucet/sink; Kling negative contains "faucet", positive does not. Judge: the fixture frame → `usage_correct:false`. Pipeline: run the 20 s Hinglish storyboard twice; every product-visible tile has `tap_visible:false`; inject the fixture as attempt 1 → edit-mode attempt 2 with the code-written correction; animate; final video shows water only from the hose, real length ≈18 s displayed, CTA number large for the whole end card.
2. **Dental clinic (service).** Realistic card disabled with the "coming soon" line; template plan has no `shot`; G6 blocks "100% painless"; voice-over audition plays before the 20-credit charge; no AI-generated staff anywhere.
3. **Kirana offer ("10 kg atta ₹399 till Sunday").** `static_item` archetype; hook "Sirf 2 din: 10 kg atta ₹399" passes G7 (399 from the offer; 2 and 10 are below the checked range); the pack's printed label does not trip `no_text` (text on the product in refs is allowed), a legible shelf price tag does; caption "10 kg ₹399".
4. **Saree (garments).** `item_used_by_person`; prompts contain no glass/panel/water; judge `same_product` compares pattern and colour on the crop.
5. **Regression.** Reels untouched; presenter speaks the CTA and holds the card ≥3.5 s; 60 s template keeps 6 scenes + CTA; legacy jobs open in `editJob`.

---

## 12. Open questions for the owner (recommended defaults)

1. **Free storyboards:** 2 per product and 4 per account per day free, then a 5-credit deposit that counts toward Animate; stills shown as watermarked previews until you pay. Recommended **yes** — it stops people using storyboards as a free photoshoot.
2. **A scene delivered as photo motion:** refund the full scene share (recommended; one simple rule the customer understands) or half?
3. **Speak the phone number aloud?** Recommended **off** by default (saves ~4 s of static end card; the number is shown large). Toggle per ad.
4. **Newer Kling / image models:** stay on the verified production models; switch by env only after one logged paid test each. Recommended **yes**.
5. **Square/Wide formats:** keep as "framed" versions of the vertical video in v1 (clearly labelled), native re-composition later. Recommended **yes**.

---

## Changes made after review

- **No unwanted nouns in positive prompts.** Removed every tap/sink/faucet mention from still and Kling prompts; staging sentence keeps the sink out of frame; in-use shots forced to close/medium; Kling truths and negatives derive from the approved still's inventory; synonym clashes between positive and negative removed; the pour sentence is one event; pull-back/pan/tilt cameras removed.
- **References:** 2–3 per still chosen by shot, never `context` (the installed photo with the real tap is draft-only), no separate logo image, empty-room plates per setting instead of scene 0 as anchor (also removes the scene-0 bottleneck); new `in_use` photo view, tap-to-point output crop, and "Use my own photo".
- **Judge rebuilt:** blind inventory with a non-lite model at ≤1536 px + full-resolution identity crop + deterministic code comparison; severity tiers (cosmetic issues never cause safe shots); faces and hands counted separately; dropped pair candidates, "two agreeing calls" and confidence re-calls; clip QC watches the mp4, shadow mode with a few hard triggers.
- **Story:** product may be absent from hook/problem/benefit scenes (≥2 visible incl. in-use); the ungrounded "RO paani acidic" example replaced; `claims_allowed` + `claims_grounded` hard fail; no disparagement; G6 word boundaries, native-script lists and offer exemptions; G7 only checks claim-type numbers with normalisation; G8/G9 fixed for brand tokens; G3 made computable; G1/G2 rewritten so the spec's own example passes.
- **Copy stack cut:** three parallel single-script calls with different first visuals, one gate-fix pass, one ranking judge (recall folded in), Ready/Needs-a-fix instead of "★ 86", 25 s wall clock, non-lite planner/judge.
- **Pacing/voice:** variable scene slots cut to the voice, 0.4 s head offset, punch-in, real duration shown; all clip slots share one `slotSec()` (fixes the 4.8 s last-clip desync); silence trim in JS, tempo ≤1.12, shortening shown and re-gated, never a hard trim, CTA and other tiers exempt; budgets in estimated seconds from syllables/aksharas with a seeded constants file (no calibration table).
- **Languages:** pronunciations per language with script-block validation; phone number off by default, single-digit format when on; one font selector for all nine scripts + Noto install; label tables replace hard-coded Devanagari; English API errors and English planner questions.
- **Captions:** keyword cards and word captions both render by default with a per-format layout and a composition rule that keeps them off the product; T9 sees exactly the rendered text; square/wide expectations stated.
- **Archetypes:** three data-driven builder archetypes with `stage_positive`, `idle_positive`, `use_positive`, `receptacle`; realistic limited to physical products in v1; group-level defaults (9 groups + 6 overrides) as seeds only, with persistent deletions; facts cut from 25 to the fields that matter; confirmation reduced to three visual questions; no "CONFIRM:" strings.
- **Credits:** watermarked previews + private originals; daily free quota then deposit; refunds capped from the ledger with pre-generated job ids and status-guarded PATCHes; single cancel rule; full scene-share refund; in-use photo-motion is an owner choice, never silent; Reassemble, Redo scene and cross-job clip cache moved into v1; 72 h auto-refund for stuck failures.
- **Engineering corrections:** PR0 guard so a legacy worker can never render a cost-0 v2 row; worker capability beat; storyboard phase truly ffmpeg-free; `bridge/tts.mjs` extraction and WAV previews; fal `status_url`/`response_url` persisted; `media_job_scenes` rows and insert-only `media_job_qc` replace concurrent JSONB mutation; column-level privacy; slim list + detail polling; input v2 schema with `legacyView`; two worker slots; orphan-ffmpeg cleanup and conditional restart; shared code lives in `bridge/` behind an alias; verified production models stay default; single migration with photos backfill; fixtures built from the delivered mp4 plus generated bad/legacy sets with confidence intervals.
- **Removed as over-engineering:** leases/heartbeats/sweepStale, auto mode, Kling v3 elements escalation and the three-endpoint table, side-by-side pipeline week, numeric scorecards and re-score loops, the separate recall call, vendor paise accounting and daily Kling cap alerts, TTS calibration table, `charges[]` mirror, pro-rated half-share maths, twelve extra `media_jobs` columns, 78 hand-written category entries, raw clip uploads, the full page rewrite, and the 9-PR plan (now 7, with the owner's fix live at PR3).
