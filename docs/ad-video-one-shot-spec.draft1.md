# NeuralEdge AI Studio — "Right the first time" realistic-ad pipeline: FINAL IMPLEMENTATION SPEC

Codebase: `/Users/jsrao/Desktop/Wellwa Life/wellwa-cards` (Next.js 16 app + `bridge/` Node workers, one 3.6 GB VPS, pm2 worker `neuraledge-media`). This spec is the merge of the winning design (D2, "One-Tap Ad") with every idea the three judges marked MUST KEEP, minus everything they REJECTED. Where the judges disagreed the resolution is stated inline and marked **[decision]**. All paths are relative to the repo root. Line numbers refer to the 2026-09-16 audit.

---

## 1. Goal & non-negotiables

**Goal.** A shop owner picks a product, picks one of three scripts, approves a storyboard of QC-passed stills, and gets a 10–30 s realistic ad in which the product looks and behaves exactly as it does in life — on the first render. The 2026-09-16 failure (water pouring from a separate kitchen tap instead of the Wellwa ionizer's own outlet hose) must be impossible to plan, draw, pass or animate.

**Non-negotiables (every PR is checked against these):**

1. **One-shot product correctness.** Product truth is data (`poster_products.facts`, owner-confirmed, frozen per job). Code — never the LLM — renders every fidelity sentence in the planner, still, judge and Kling prompts (`bridge/prompt-builders.mjs`, unit-tested). A vision QC judge sits between the ₹5.6 still and the ₹30 Kling clip; nothing reaches fal without a passed still.
2. **First-try impressive copy.** Three scripts with three hook angles and three promises, deterministic gates (G1–G11), an LLM clarity judge (≥75 = Ready), a muted recall test, and a one-line "why this works" per script.
3. **One-viewing clarity.** 5-beat spine per length, hook without brand, brand spoken by scene 2, one idea per scene, 2–5-word caption cards that carry the story sound-off, CTA verb+channel+number spoken and shown ≥3.5 s.
4. **No wasted credits.** Realistic tier: nothing is charged until the owner taps **Animate** on QC-passed stills. Storyboards are free under daily caps. Platform-paid QC retries under hard caps. Ken-Burns fallback with automatic half-share refund. Pro-rated cancel. Free "Retry render" after a technical failure. Idempotent ledger writes.
5. **English-only UI.** All strings on `/poster/video` and the product facts screens are English (remove the Hindi `useT()` branches on these pages). Output language stays selectable.
6. **12 languages end-to-end.** `hi, hinglish, en, mr, gu, pa, bn, ta, te, kn, ml, or` accepted and stored by every route; per-language word budgets; per-language CTA-card labels.
7. **Native-script TTS kept.** `bridge/tts-script.mjs` `nativeScript()` stays; it gains a per-product pronunciation glossary so the brand is transliterated identically in every line. English style preamble per language (skipped on mixed-script lines as today). No native-script preamble (memory: TTS dies on preamble + Hinglish) — only behind a flag for testing.
8. **Existing credits system reused.** `spend_credits` / `grant_credits` RPCs, `credit_ledger`, `adCredits(len)` pricing table, `AddCredits` packs. New reason codes, `p_ref` always the job id.
9. **VPS safety.** Single worker slot (a job in `review` releases the slot). Storyboard phase never invokes ffmpeg. Node heap cap, sharp limits, image normalisation, existing `systemd-run` caps.
10. **Template/presenter/testimonial tiers keep today's short direct path** (charged at creation) and receive only the new planner, gates, TTS shortener/hard-trim, CTA card and language fixes. No storyboard pause for them.

---

## 2. User flow

Page `/poster/video` becomes three screens plus history. UI copy below is final English copy.

### Screen A — "Make an ad" (0 s wait)

```
Make an ad
Product        [ Wellwa Alkaline Ionizer ▼ ]        Product facts ✓ confirmed 12 Sep · 4 photos   [View / edit]
               (if unconfirmed) ⚠ Confirm product facts (about 1 minute) — the video obeys this card.  [Confirm now]

What should the ad do?   (● WhatsApp leads) ( Push an offer ) ( Introduce ) ( Festival ) ( Before → After )

Video style     [ Template · 40 s · from 20 credits ]  [ ● Realistic AI · film-like · storyboard first · 20 s = 40 credits ]  [ Presenter · talks to camera · 20 s = 40 credits ]
Length          ( 10 s · 20 cr ) ( ● 20 s · 40 cr ) ( 30 s · 60 cr )         Realistic max 30 s
Language        [ Hinglish ▼ ]  (12 languages)

Voice Warm male · Music Calm · Look Clean · Reel 9:16 · Captions on · 1 video       [Change]

                         [ Write my 3 scripts (free) ]
```

- **[decision]** Tier, length and language are visible on Screen A with their credit cost (judges rejected hiding price-setting choices behind "Change"). Tier defaults to `template` for service categories and to `realistic` only when the product has confirmed facts **and** the owner has completed a realistic job before; otherwise `template` is pre-selected and the realistic card carries "storyboard first — you approve the scenes before paying".
- Everything else (goal, tone, voice, music, look, formats, captions, variations, notes) is defaulted by `src/lib/media/ad-defaults.ts` from category + default poster profile + facts and shown as one summary line; "Change" opens a bottom sheet with the existing chips.
- Realistic requires `facts.confirmed_by_owner === true` and ≥2 photos with view tags. If not, the realistic card is disabled with "Confirm product facts and add 2+ photos first".
- Tap "Write my 3 scripts (free)" → `POST /api/media/ad-plan`. Spinner: "Reading your product facts… writing 3 scripts… checking each one for clarity" (8–15 s).

### Screen A2 — "Product facts" (once per product; ~1 minute; free)

Shown automatically the first time a product is used, or from the Products page.

```
Product facts — Wellwa Alkaline Ionizer
We read these from your photos. Fix anything wrong — you are the manufacturer; your word is the spec.

Photos   [front ✓] [three-quarter ✓] [outlet close-up — add this: it is the part the AI gets wrong most often] [installed ✓]   [+ Camera] [+ Gallery]
What it is         Countertop alkaline water ionizer that connects to the kitchen tap
Where it sits      On the kitchen counter next to the sink
Parts              outlet hose · top, curving down · alkaline water comes out here        [+ part]
                   front panel · front · pH buttons and display
                   inlet tube · back · brings tap water in
How it is used     1 Inlet tube brings tap water into the unit
                   2 Press a pH button on the front panel
                   3 Alkaline water flows from the unit's own outlet hose on top into the glass
Must show          • Water comes only from the unit's outlet hose into the glass
                   • The sink tap is closed and dry
                   • Front panel lit while in use
Must never show    • Water running from the kitchen sink tap or any other tap
                   • A second unit or purifier   • A bottle or jug pouring water
Hands              ( none ) ( ● at the edge of frame only ) ( operating the product )
Size               About the height of a kettle — never held in one hand
Benefits           Alkaline water at one button · Mineral-rich · For the whole family · Saves bottle cost
Numbers I vouch for   5,000+ homes (source: company records)                          [+ add]
Never claim        cures · doctor-recommended · 100% pure · No.1
How to say it      Wellwa → वेलवा   ionizer → आयोनाइज़र                                  [+ add]
                                                                     [ Confirm facts ]
```

Values the AI was unsure of are prefixed `CONFIRM:` and highlighted amber until edited. Confirm → `PUT /api/poster/products/[id]/facts` (bumps `facts_version`, sets `facts_confirmed_at`).

### Screen B — "Pick a script" (8–15 s wait for scripts; 0 s after)

```
Pick a script                                                                 [Re-write all 3]

★ 86 · DID YOU KNOW                                                            [Use this]
Promise: RO ka paani ek button se alkaline — poore ghar ke liye
Why this works: Opens with a question your customers already ask, names Wellwa by second 5, shows water coming from the unit itself, ends with one WhatsApp action.
1 "Kya aap jaante hain RO paani acidic ho sakta hai?"            RO paani acidic?              ▮▮▮▮▮▮▮▮░ 8/9
2 "Wellwa ionizer isi paani ko alkaline banata hai — ek button."   Ek button. Alkaline paani.    ▮▮▮▮▮▮▮▮▮ 9/9
3 "Har glass mein mineral-rich paani, poore parivaar ke liye."    Mineral-rich, har glass       ▮▮▮▮▮▮▮▮░ 8/9
4 "5,000+ gharon ka bharosa. Free home demo."                      Free home demo                ▮▮▮▮▮▮░░░ 6/9
CTA "Abhi WhatsApp karein — 98xxx xxxxx."                          WhatsApp 98xxx xxxxx
[▶ Hear scene 1 in this voice]   [Edit lines]   [3 more hooks]

  78 · PAIN POINT …                                                           [Use this]
  74 · BOLD NUMBER …                                                          [Use this]
```

- "Edit lines" exposes spoken line + caption per scene and the shot's **creative** fields (setting, people, framing). Fidelity fields are not shown as editable; a lock icon reads "From your product facts". Edits re-run gates client-side (word meter turns red) and a debounced `POST /api/media/ad-score` re-scores.
- "▶ Hear scene 1" → `POST /api/media/tts-preview` (free, cached by hash). "3 more hooks" → `POST /api/media/ad-hook` (now fed facts + promise).
- "Use this" → `POST /api/media/ad`. Realistic: creates a `phase:"storyboard"`, `cost:0` job → Screen C. Other tiers: charges as today → history (Screen D).

### Screen C — "Your storyboard" (60–150 s wait; then the gate)

```
Your storyboard — 20 s Realistic · 4 scenes
Storyboard: free. Animate: 40 credits (you have 120). Nothing is charged until you tap Animate.

[still 1]  Scene 1 · "Kya aap jaante hain…"       ✓ Checked: one unit · outlet hose visible · sink tap closed
[still 2]  Scene 2 · "Wellwa ionizer isi paani…"   ✓ Checked: water from outlet hose only · panel lit · one unit
[still 3]  Scene 3 · …                             ✓ Checked (2nd try: removed a second jug)
[still 4]  Scene 4 · …                             ⚠ Could not verify this scene — shown as an idle product shot instead.   [Redraw]
   under each: [Redraw] (first free, then 1 credit)   [Edit scene] (change the picture in plain English → redraw)

Voice ✓ 4 lines fit their 5-second scenes (longest 4.1 s)         End card: [preview]

                                      [ Animate my ad — 40 credits ]        [Discard]
```

- Progress line while running: "Recording the voice (4 lines)…", "Drawing scene 2 of 4…", "Checking scene 2 against your product facts…".
- **Animate** is disabled while any scene lacks a passed still ("Fix scene 4 first"). Tap → `POST /api/media/ad/[id]/approve` → `spend_credits` → animate phase. Copy: "Animating 4 scenes… about 7 minutes. You can close this; the video will be in Your videos." with **Cancel** (pro-rated refund, see §7).
- **Discard** costs nothing. Review jobs older than 48 h are auto-discarded.
- Auto mode (Settings, per user, default off, only visible when `QC_AUTO_ALLOWED=1`): "Skip my approval when every scene passes the product check on the first or second try." Even in auto mode the job pauses for a product's first realistic job and whenever any scene needed a third attempt.

### Screen D — "Your videos" (history)

Queued/running rows show `stage` text and a real progress bar with ETA ("Animating scene 3 of 4 · ~4 min left") and Cancel. Review rows show "Waiting for your approval" with an Open button. Done rows: video, per-format Share/Download (unchanged), storyboard thumbnails, note "Scene 3 delivered as photo motion · 5 credits returned" when applicable, and 👍/👎 with a one-tap reason (Product looked wrong / Script / Voice / Other). Phase 2 adds "Redo scene N (10 credits)" and "Change hook / CTA / music (free)".

**Approval summary:** facts (once, free) → script (free) → storyboard (free, the only gate before money) → Animate (charged) → optional per-scene redo.

**Wait times (20 s realistic):** scripts 8–15 s · storyboard 60–150 s · animate 6–9 min (owner may leave) · total ≈ 9–11 min.

---

## 3. Product knowledge ("Visual Bible" = `poster_products.facts`)

### 3.1 SQL

```sql
-- supabase/migrations/0044_product_facts.sql
alter table public.poster_products
  add column if not exists photos jsonb not null default '[]'::jsonb,
    -- [{url, view, role, kling_element, w, h, added_at}]
    -- view ∈ front | three_quarter | back | output_closeup | installed | packaging | generated | other
    -- role ∈ identity | context ; kling_element boolean (used for v3 elements escalation)
  add column if not exists facts jsonb not null default '{}'::jsonb,
  add column if not exists facts_version int not null default 0,
  add column if not exists facts_confirmed_at timestamptz;
-- photo_url stays = the "front" photo for daily posters (backward compatible).
```

### 3.2 `ProductFacts` (`src/lib/media/product-facts.ts`, types only; JSDoc mirror in `src/lib/media/ad-rules.mjs`)

```ts
export type ProductPart = { name: string; where: string; role: string; visible_in_use: boolean };
export type ProductFacts = {
  v: 1;
  label: string;                 // generic noun used in EVERY prompt, never the brand: "the water ionizer"
  name: string;                  // "Wellwa Alkaline Ionizer"
  category_key: string;          // real key from src/lib/poster-categories.ts (e.g. "water", "dentist", "kirana")
  what_it_is: string;            // one sentence a stranger understands
  size_class: "handheld"|"tabletop"|"countertop"|"floor"|"wall"|"wearable"|"consumable"|"vehicle"|"service";
  where_it_lives: string;        // "on the kitchen counter beside the sink"
  appearance: string;            // ≤60 words: colour, shape, size, panel, buttons, hoses/ports — what must be preserved
  parts: ProductPart[];
  connections: { from: string; to: string; via: string; direction: "in"|"out" }[];   // "kitchen tap" → "unit inlet" via "thin diverter tube", in
  how_it_is_used: string[];      // ordered plain-English steps
  output: { part: string; medium: "water"|"air"|"light"|"sound"|"heat"|"food"|"none"; action_positive: string } | null;
  must_show: string[];           // POSITIVE physical truths for in-use shots (also the source of BOUNDARIES)
  must_not_show: string[];       // wrong depictions as noun phrases (judge checks + Kling negatives only; never pasted into a positive prompt)
  forbidden_objects: string[];   // objects that must not be near the product
  hands: "none"|"edge"|"operating";   // default per size_class: countertop/floor/wall → "edge"; handheld → "operating"; service → "operating"
  logo: { placement: string | null };  // where the logo is printed ON the product; no generated corner chip (ffmpeg overlays the brand chip)
  people_default: string;        // "Indian family, 30–45, urban home"
  settings: string[];            // approved environments
  benefits: string[];            // ≤6 outcomes in viewer language
  proof: { text: string; number?: string; source: string }[];   // the ONLY numbers a script may use
  offers: string[];
  banned_claims: string[];
  pronunciations: Record<string,string>;   // {"Wellwa":"वेलवा"} — prepended to nativeScript
  missing_views: string[];       // computed from photos[].view
  confirmed_by_owner: boolean;
  owner_edited: string[];        // field names the owner changed; protected from re-draft
};
```

Frozen into every job: `media_jobs.input.facts` (this object) + `input.refs` (copy of `photos[]`) + `input.product_id` + `input.facts_version`.

### 3.3 Category defaults (`src/lib/media/product-defaults.ts`)

Keyed by the **real** keys in `src/lib/poster-categories.ts` (implementer: read that file; expected keys include `water, salon, dentist, doctor, kirana, garments, gym, furniture, mobile, jewellery, restaurant, other` — never invent keys). Defaults are merged under the AI draft; `must_not_show`, `forbidden_objects` and `banned_claims` are unioned. Minimum entries:

```ts
export const CATEGORY_DEFAULTS: Record<string, Partial<ProductFacts>> = {
  water: {
    size_class: "countertop", hands: "edge", where_it_lives: "on the kitchen counter beside the sink",
    output: { part: "the unit's own flexible outlet hose on top", medium: "water",
      action_positive: "water streams from the unit's own outlet hose into a glass held directly beneath it; the unit is the only source of water in the scene; the kitchen sink tap is closed and dry" },
    must_show: ["water comes only from the unit's outlet hose into the glass", "the sink tap is closed and dry", "the front panel is lit while in use"],
    must_not_show: ["water running from the kitchen sink tap or any separate tap or faucet", "a second unit or purifier", "a bottle, jug or pitcher pouring water", "thick pipes or plumbing added to the unit", "the unit held in someone's hands"],
    forbidden_objects: ["running faucet", "RO purifier", "water bottle", "jug", "kettle"],
    banned_claims: ["cures", "doctor-recommended", "100% pure", "No.1", "guaranteed"] },
  dentist: { size_class: "service", hands: "operating", output: null,
    must_not_show: ["blood", "visible needles", "fake before/after teeth"], banned_claims: ["100% painless", "guaranteed", "permanent cure"] },
  doctor:  { size_class: "service", hands: "operating", output: null, must_not_show: ["blood", "surgery close-ups"], banned_claims: ["cures", "guaranteed", "100%"] },
  salon:   { size_class: "service", hands: "operating", output: null, must_not_show: ["fake before/after skin tone change"], banned_claims: ["permanent", "guaranteed"] },
  gym:     { size_class: "service", hands: "operating", output: null, must_not_show: ["unsafe form", "exaggerated before/after bodies"], banned_claims: ["guaranteed weight loss", "lose N kg in N days"] },
  kirana:  { size_class: "consumable", hands: "operating", output: null, must_not_show: ["legible price tags", "other companies' brand names"], banned_claims: ["cheapest in India", "No.1"] },
  garments:{ size_class: "wearable", hands: "operating", output: null, must_not_show: ["altered fabric pattern or colour", "different garment cut"] },
  other:   { size_class: "tabletop", hands: "edge", output: null, must_not_show: ["a second copy of the product", "added attachments"] },
  // one entry per remaining real key, at least with must_not_show + banned_claims
};
```

The `water` default alone already carries "water comes only from the unit's outlet hose; the sink tap is closed and dry", so the original bug is prevented even for an unconfirmed product (template tier), while the realistic tier still requires confirmation.

### 3.4 Auto-draft from photos + category — exact Gemini vision prompt (T1)

Route `POST /api/poster/products/[id]/facts`. Model `gemini-3.5-flash-lite`, `responseMimeType: application/json`, `temperature 0.2`, `maxOutputTokens 2500`. Parts: each photo (sharp-normalised, real MIME, ≤1024 px) preceded by a text part `Image {k}: {view or "untagged"}`, then:

```
You are documenting one physical product (or service) sold by a small Indian business so that a film crew can photograph and animate it correctly. Images 1-{n} are the owner's photos of it; the view tag before each image was given by the owner ("untagged" means unknown — guess it).
Product name: {name}. Category: {category_label}. Owner benefit lines: {benefits_joined}. Owner notes: {notes | "-"}.
Start from these category defaults and correct or complete every field from what you can SEE. Keep any field listed in "owner_edited" unchanged.
{defaults_json}

Return ONLY JSON with exactly these keys:
{"v":1,"label":"<generic noun phrase for prompts, 2-4 English words, never the brand, e.g. 'the water ionizer'>",
 "name":"{name}","category_key":"{category_key}",
 "what_it_is":"<one plain sentence a stranger understands>",
 "size_class":"handheld|tabletop|countertop|floor|wall|wearable|consumable|vehicle|service",
 "where_it_lives":"<where it normally sits or is used>",
 "appearance":"<≤60 words: colour, shape, approximate size, panel, display, buttons, hoses or ports, materials, printed logo position — only what is visible>",
 "parts":[{"name":"","where":"<position on the body>","role":"<what it does>","visible_in_use":true}],
 "connections":[{"from":"","to":"","via":"","direction":"in|out"}],
 "how_it_is_used":["<ordered steps, one action each>"],
 "output":{"part":"<the ONE part through which the product delivers its result and where it is on the body>","medium":"water|air|light|sound|heat|food|none","action_positive":"<one positive sentence describing correct use as it looks on camera, naming the part and stating that nothing else in the scene produces that result>"} or null for services,
 "must_show":["<physical truths every in-use picture must obey, written POSITIVELY — for each likely mistake write what is true instead, e.g. 'the sink tap is closed and dry'>"],
 "must_not_show":["<3-6 wrong depictions an image model is likely to produce for this category, as noun phrases without the word 'no'>"],
 "forbidden_objects":["<objects that must not appear near the product>"],
 "hands":"none|edge|operating",
 "logo":{"placement":"<where a logo is printed on the product, or null>"},
 "people_default":"<typical user in one phrase, Indian context>",
 "settings":["<2-4 environments where it is naturally shown>"],
 "benefits":["<≤6 outcomes in the viewer's words>"],
 "proof":[],"offers":[],
 "banned_claims":["<claims this category must never make>"],
 "pronunciations":{},
 "photo_views":[{"index":1,"view":"front|three_quarter|back|output_closeup|installed|packaging|other"}],
 "missing_views":["<which of front, three_quarter, output_closeup, installed no photo shows>"]}
Rules: describe only what is visible in the photos or stated by the owner. For anything you are inferring rather than seeing, prefix the value with "CONFIRM: " so the owner can correct it. Leave proof and offers empty — only the owner adds numbers. Never invent model numbers, prices, awards or certifications. For hands: countertop, floor and wall products default to "edge"; the product is never held in a hand unless size_class is handheld.
```

Server post-processing: merge over `CATEGORY_DEFAULTS[category_key]` (union lists), strip a leading "no " from `must_not_show` items, validate `label` does not contain the brand token, `output.action_positive` mentions `output.part` when `output` is non-null, ≤12 items per list, compute `missing_views` from `photos[].view`, set `confirmed_by_owner:false`. `PUT` saves owner edits, records changed field names in `owner_edited`, bumps `facts_version`, sets `facts_confirmed_at`. Photoshoot outputs can be saved into `photos[]` with `view:"generated"`, `role:"context"`, `kling_element:false` (never identity refs).

### 3.5 Wellwa ionizer — filled example (owner-confirmed, `facts_version 3`)

```json
{"v":1,"label":"the water ionizer","name":"Wellwa Alkaline Ionizer","category_key":"water",
 "what_it_is":"Countertop alkaline water ionizer that connects to the kitchen tap and dispenses alkaline water from its own hose",
 "size_class":"countertop","where_it_lives":"on the kitchen counter beside the sink",
 "appearance":"white glossy rectangular body about 35 cm tall and 25 cm wide, dark touch display centred on the front panel with a ring of blue light, three silver buttons below the display, Wellwa logo printed top-centre of the panel, a flexible white outlet hose rising from the top and curving down, a thin clear inlet tube at the back",
 "parts":[{"name":"outlet hose","where":"flexible white hose about 30 cm long rising from the top of the unit and curving down","role":"alkaline water comes out here into the glass","visible_in_use":true},
          {"name":"front panel","where":"front face","role":"display and pH buttons","visible_in_use":true},
          {"name":"inlet tube","where":"thin clear tube at the back","role":"brings tap water in from the diverter","visible_in_use":false},
          {"name":"drain hose","where":"thin tube at the bottom rear","role":"acidic water drains to the sink","visible_in_use":false}],
 "connections":[{"from":"kitchen tap","to":"unit inlet at the back","via":"a small diverter valve and a thin clear tube","direction":"in"}],
 "how_it_is_used":["water enters the unit from the tap through the thin inlet tube at the back","press a pH button on the front panel","hold a glass under the end of the unit's own outlet hose","alkaline water streams from the outlet hose into the glass"],
 "output":{"part":"the unit's own flexible outlet hose on top","medium":"water","action_positive":"a clear stream of water flows from the end of the unit's own outlet hose on top into a glass held directly beneath it; the unit is the only source of water in the scene; the kitchen sink tap is closed and dry"},
 "must_show":["water comes only from the unit's outlet hose into the glass","the sink tap is closed and dry","the front panel display is lit while in use"],
 "must_not_show":["water running from the kitchen sink tap or any separate tap or faucet","a second unit or purifier","a bottle, jug or pitcher pouring water","thick pipes or plumbing added to the unit","the unit held in someone's hands","steam"],
 "forbidden_objects":["running faucet","RO purifier","water bottle","jug","kettle"],
 "hands":"edge",
 "logo":{"placement":"printed top-centre of the front panel"},
 "people_default":"Indian family, 30–45, everyday home clothing",
 "settings":["kitchen","dining room","office pantry"],
 "benefits":["alkaline paani ek button se","mineral-rich paani har glass","poore parivaar ke liye","bottle ka kharcha khatam"],
 "proof":[{"text":"5,000+ Indian homes","number":"5000","source":"company sales records"},{"text":"free home demo","source":"owner"}],
 "offers":["Free home demo"],
 "banned_claims":["cures","doctor-recommended","100% pure","No.1","guaranteed"],
 "pronunciations":{"Wellwa":"वेलवा","ionizer":"आयोनाइज़र","alkaline":"अल्कलाइन"},
 "missing_views":[],"confirmed_by_owner":true,"owner_edited":["must_not_show","proof","pronunciations"]}
```
`photos`: `[{url:…/front.png, view:"front", role:"identity", kling_element:true}, {…tq.png, "three_quarter", identity, true}, {…hose.png, "output_closeup", identity, true}, {…kitchen.png, "installed", context, false}]`.

---

## 4. Pipeline stage machine

### 4.1 State diagram (text)

```
Screen A/B (free, Next routes, no job row):
  facts draft/confirm ─► plan (3 scripts + gates + clarity judge + recall) ─► score-on-edit ─► tts-preview

POST /api/media/ad  (realistic)  ──► media_jobs { phase:"storyboard", status:"queued", cost:0 }
        │
        ▼ worker claims lease (status=running, worker_id, heartbeat_at)
  stage validate ─► tts (measure sec, shorten ≤2×, atrim hard-trim, calibration rows)
        ─► stills (scene 0 first → anchor; then 3-wide: candidates → judge → edit-mode → safe shot)
        ─► status="review", stage="await"  [worker busy flag released]
                 │
     ┌───────────┼──────────────────────────────┐
     ▼           ▼                              ▼
  approve      redraw scene i                 discard / 48 h auto-discard
  (spend_credits, phase="animate",           (status="failed", error="Discarded", nothing to refund)
   status="queued")                    (status="queued", phase stays "storyboard", only flagged scenes redrawn → back to review)
     │
     ▼ worker claims lease
  stage clips (write-ahead fal request_id → poll → clip_qc → 1 retry → Ken-Burns fallback + half-share refund)
        ─► assemble (trim 0.1 s head/tail, xfade, CTA card, mix) ─► captions ─► reframe ─► upload ─► status="done"
        │
        ├─ technical failure (fal outage, ffmpeg, upload, TTS hard fail) ─► status="review", stage="render_failed", credits held
        │        ├─ Retry render (free) ─► status="queued", phase="animate" (cached clips reused)
        │        └─ Discard ─► full refund of cost (platform's failure)
        └─ user Cancel during clips ─► status="failed", pro-rated refund (scenes without an accepted clip)

Template / presenter / testimonial: POST /api/media/ad charges at creation, phase="animate" directly (today's path + new planner/TTS rules).
```

### 4.2 Stage table

Legend: API = Next route (free, synchronous); W = worker. Vendor prices at ₹84/$: still `gemini-3.1-flash-image` 1K ≈ ₹5.6; judge call ≈ ₹0.1; Kling 2.6 Pro 5 s ≈ ₹30; Kling v3 Pro + elements 5 s ≈ ₹94; TTS ≈ ₹0.2/line.

| # | Stage | Where | Inputs → outputs (persisted) | Cache / idempotency | Retry | Cost | Shown |
|---|---|---|---|---|---|---|---|
| S0 | facts | API `POST/PUT /api/poster/products/[id]/facts` | photos + name + category + notes → `poster_products.facts` | `facts.source_hash = sha1(photo urls + name + notes)`; re-draft skipped if unchanged | 1 retry on malformed JSON | ₹0.3 once | Screen A2 |
| S1 | plan | API `POST /api/media/ad-plan` | brief + frozen facts + budgets → 3 scripts + scorecards | none; rate limit 40/10 min | gate-fix round-trip ×1 per script; regenerate angle if clarity <60 (×1) | ₹0.3 | Screen B |
| S2 | score | API `POST /api/media/ad-score` | edited script → gates + clarity | 10-min memo by `sha1(script)` | — | ₹0.05 | meters |
| S3 | tts-preview | API `POST /api/media/tts-preview` | one line → mp3 URL + sec | storage `media/ai-media/<uid>/tts/<sha1(lang|voice|text)>.mp3`; worker reuses | existing ladder | ₹0.2 | ▶ |
| S4 | create | API `POST /api/media/ad` | script + facts + options → job row (`phase:"storyboard"`, `cost:0`) | — | — | 0 | Screen C spinner |
| W1 | validate | W | `input` → normalised input; fail fast on contract error (`failed`, nothing to refund) | — | — | 0 | stage text |
| W2 | tts | W | lines → `assets.wavs[{i, url, sec, words, shortened}]` uploaded to `ai-media/<owner>/jobs/<jobId>/vo-<i>.wav`; calibration rows | skip if wav exists for `sha1(lang|voice|tts_text)` | shortener ≤2 → atrim; hard TTS failure → job `failed` before any Kling spend (never silent scenes) | ₹1 | "Recording the voice (3/5)…" |
| W3 | stills | W | facts + shot + refs + anchor → `storyboard[i].still.{url, attempt, verdict, owner_summary, safe_shot}` uploaded `…/still-<i>-<fmt>-a<n>.jpg`; `qc[]` | `spec_hash = sha1(facts_version + JSON(shot) + ratio + attempt)`; skip if a passed still exists | policy §6.3: ≤3 attempts/scene, ≤2n+2 stills/job | ₹5.6 per still, ₹0.1 per judge | tiles fill live |
| W4 | await | W sets `status:"review"`, releases `busy` | — | — | 48 h auto-discard | 0 | Screen C |
| S5 | approve | API `POST /api/media/ad/[id]/approve` | job in review, all scenes passed → `spend_credits(cost,'ad-animate',jobId)`, `phase:"animate"`, `status:"queued"` guarded `status=eq.review` | — | 402 on insufficient credits, nothing changes | user credits | cost card |
| W5 | clips | W | approved still + Kling prompt → `assets.clips[i].{url, endpoint, fal_request_id, attempt, fallback}` uploaded `…/clip-<i>-<fmt>-raw.mp4` | `clip_hash = sha1(still_hash + prompt + negative + endpoint)`; write-ahead `pending{scene, hash, fal_request_id}` before polling; on resume poll, never resubmit | 1 retry (§6.4) then Ken-Burns; Kling calls ≤ n+2, escalations ≤2 per job; fal outage back-off 1/4/10 min then `render_failed` | ₹30 (₹94 escalated) | "Animating scene 2 of 4 · ~6 min" |
| W6 | clip_qc | W (inside W5) | frames at 0.2/2.5/4.6 s → `clips[i].qc` | frame hashes | — | ₹0.2 | "Scene 3: photo motion" if fallback |
| W7 | assemble | W (ffmpeg under systemd-run) | clips + CTA card + vo + music → `ad-<fmt>.mp4` | overwrite | 1 retry; exit 137 → retry with `-threads 1` and 720p intermediates, then `render_failed` | 0 | "Adding captions…" |
| W8 | captions/reframe/upload | W (existing code) | → `outputs{}`, `output_url`, `input.outputs` | upsert path | 3× back-off | 0 | "Uploading…" |
| W9 | done | W | `status:"done"`, `vendor_cost_paise`, tmp dir deleted; storage folder kept 7 days | — | — | — | Screen D |

Storage is the source of truth for artefacts (`media/ai-media/<owner>/jobs/<jobId>/`); `os.tmpdir()/ad-<jobId>` is a cache rebuilt by `hydrateJobDir(job)` on resume.

### 4.3 Worker mechanics (single slot, lease-based)

- **Claim with lease:** `PATCH media_jobs?id=eq.X&status=eq.queued` → `{status:"running", worker_id, heartbeat_at:now(), attempts: attempts+1}` with `Prefer: return=representation`; zero rows = someone else has it. `worker_id = hostname:pid`.
- **Heartbeat** every 30 s while a job is active (timer; also inside the Kling poll loop). Every tick runs `sweepStale()`: `status=running AND heartbeat_at < now()-4min` → `queued` if `attempts < 3`, else `failed` with reason `stale` (refund policy §7). This **replaces** the boot-time blanket requeue (delete `tick()` L1031 requeue once PR5 ships).
- **Guarded writes:** every state PATCH uses `?id=eq.X&worker_id=eq.<me>&status=eq.running`; zero rows → throw `LeaseLost`, stop silently (no refund, no failure write).
- **Write-ahead:** before each vendor call PATCH `state.pending = {kind, scene, hash, fal_request_id?}`; after, PATCH the result and clear pending. On resume: pending still with no result → regenerate (cheap); pending clip with `fal_request_id` → poll it.
- **Busy flag:** released when a job enters `review`. Only one queued/running job per user (a `review` job does not count as active, but a user may hold at most one `review` job at a time; a new storyboard auto-discards the older review job after confirmation in the UI).
- **Budgets:** `bridge/ad-caps.mjs` constants (§7); `spend(kind, paise)` throws `BudgetExceeded` → graceful path (safe shot / Ken-Burns), never a hung job.
- **VPS safety:** pm2 `node --max-old-space-size=640`; `sharp.concurrency(1); sharp.cache({memory:64})`; refs ≤1536 px for generation, ≤768 px for judges, real MIME; storyboard phase never invokes ffmpeg (per-line wav duration comes from byte length as today); stage timeouts tts 4 min, stills 6 min, clips 20 min, assemble 12 min, upload 5 min.

---

## 5. Prompt templates (exact text)

All fidelity blocks are rendered by pure functions in `bridge/prompt-builders.mjs`. `{placeholder}` = filled by code. Image parts always precede the text part. `{LANG_RULE}` = the existing `LANG_RULE[lang]` map (moved to `src/lib/media/ad-rules.mjs`).

### (a) T2 — Script planner, 3 options (`gemini-3.5-flash-lite`, JSON mode, temperature 0.8, maxOutputTokens 4500)

```
You are a senior Indian performance-ad copywriter and director. Write THREE different {length}-second vertical {tier_word} ads for the product below. Return ONLY JSON (shape at the end). All spoken lines and on-screen captions in: {LANG_RULE}.

PRODUCT FACTS — the only facts you may use. Never invent numbers, prices, awards, certifications or medical outcomes.
{facts_planner_json}
(fields: label, name, what_it_is, size_class, where_it_lives, how_it_is_used, output.action_positive, hands, people_default, settings, benefits, proof, offers, banned_claims)

BRIEF
Goal: {goal} ({goal_definition})
Audience: {audience | people_default}   Tone: {tone}   Brand: {brand}
Offer: {offer | "(none — do not invent one)"}   Call/WhatsApp number: {phone | "(none)"}
Owner notes for this ad: {notes | "-"}
{owner_card_facts_block}

FORMAT
- Tier: {tier}. Exactly {scenes} scenes + 1 final CTA.
- {tier_rule}
  realistic: "Each scene becomes ONE 5-second video clip made from ONE still photo, so each scene is one moment, one place, one action. Its spoken line must be ≤ {per_scene_words} words so it finishes inside 4.3 seconds."
  template/presenter/testimonial: "Each scene lasts as long as its line; total spoken words ≤ {total_words}."
- Speaking rate for this language ≈ {wps} words/second. Count words before you answer.
- Scene roles in order for this length: {beat_spine}

THE THREE SCRIPTS use three different hook angles from: question | pain_point | bold_number | before_after | did_you_know | local_shoutout. Pick the three that fit the goal; each script also gets a different one-line PROMISE so the owner has a real choice, not rewordings.

RULES EVERY SCRIPT OBEYS
1. One promise per ad, written first in "promise" (≤12 words, viewer's language). Every scene ladders to it. No second message.
2. One idea per scene: the spoken line, the caption card and the shot say the SAME thing.
3. Scene 1 = hook: 6-12 words, a number or a concrete noun in the first 4 words, no brand name, and its caption must make sense with the sound off.
4. Scene 2 names the brand or product once (spoken) — brand within 5 seconds. (Scene 1 if there are only 2 scenes.)
5. Benefit language, not specs: say what changes for the viewer. Specs go into "features" (4 labels of 2-3 English words) for the end card.
6. At least one concrete number somewhere — ONLY from the facts' proof/offers or the brief's offer. If none exist, use a specific time or place instead ("ghar par demo", "ek hi sitting").
7. Only the final CTA may mention calling/WhatsApp/the number. CTA = verb + channel + number, ≤10 words.
8. "caption": 2-5 words, ≤32 characters, digits not words, carries the scene's number or benefit. Not a transcript.
9. "shot" describes ONLY the creative choices, in English. The product's appearance, how it works and what must never appear are added by the production system from the product facts — do not write them. Fill:
   - setting: one of {settings_list}; setting_desc: ≤20 words (room, surfaces, window and light direction)
   - people: {count: 0-3, desc: ≤15 words, Indian}
   - framing: close_up|medium|wide ; lens: "35mm"|"50mm"
   - lighting: ≤8 words
   - product: {in_use: true|false, placement: ≤15 words — where the unit sits relative to the people and surfaces, frame_share: 0.2-0.6}
   - hero_motion: ONE thing that moves during the 5 seconds, ≤20 words, physical verbs, no new object or person enters, matches the spoken line. If product.in_use is true the hero motion is the product doing its job.
   - secondary_motion: ≤8 words or ""
   - camera: static|slow_push_in|slow_pull_back|slow_pan_left|slow_pan_right|slow_tilt_up|subtle_parallax|gentle_handheld
   - hands: none|edge|operating — never more than the facts allow ({hands}); for size_class {size_class} the product is never held in a hand unless size_class is handheld.
   Product visible in every scene; at least one scene has in_use=true; at most two scenes have in_use=true. Never place a tap, bottle, jug or second appliance in the shot. Never write text on screen.
10. "seconds": realistic → 5 for every scene, CTA 3.5. Other tiers → words ÷ {wps} + 0.5, rounded to 0.5.
11. Register: {register_note}. No clichés ("best quality", "sabse behtar", "No.1"); no cure or guarantee words: {banned_claims}.
12. "why": one English sentence (≤25 words) for the owner explaining why this script works in one viewing (name the hook type, when the brand appears, the one action).
13. If something essential is missing, put ≤2 short questions in "questions" and still return your best scripts.

JSON SHAPE
{"scripts":[{"angle":"did_you_know","promise":"","headline":"<≤6 words>","why":"",
 "scenes":[{"role":"hook|problem|product_in_use|benefit|proof|offer","text":"","caption":"","seconds":5,
   "shot":{"setting":"","setting_desc":"","people":{"count":1,"desc":""},"framing":"medium","lens":"35mm","lighting":"",
           "product":{"in_use":false,"placement":"","frame_share":0.3},"hero_motion":"","secondary_motion":"","camera":"slow_push_in","hands":"edge"}}],
 "cta":{"text":"","caption":"","seconds":3.5},
 "post_caption":"<1-2 lines + 5 hashtags>","features":["","","",""],
 "voice":"male|female","music":"upbeat-corporate|festive-diwali|calm-ambient|energetic-promo|inspiring-motivational|indian-sitar","template":"bold|clean|festive|offer|trust|fresh",
 "self_check":{"words_per_scene":[],"numbers_used":[],"promise_in_every_scene":true}},{...},{...}],
 "questions":[]}
```

Beat spines (`beatSpine(tier, scenes)`): 2 → hook, product_in_use · 3 → hook, product_in_use, proof · 4 → hook, problem, product_in_use, proof_or_offer · 5 → hook, problem, product_in_use, benefit, proof_or_offer · 6 → hook, problem, product_in_use, benefit, proof, offer.

**T2b — gate fix round-trip** (same model, temperature 0.3):
```
This ad script failed these production checks:
{gate_errors_bulleted}
Fix ONLY the listed violations and keep everything else identical (same language and script, same promise, same scene order, same shots unless a shot check failed). Return ONLY the corrected script JSON in the same shape.
Script: {script_json}
```

**T7 — line shortener** (`gemini-3.5-flash-lite`, temperature 0.2, 100 tokens):
```
Shorten this spoken ad line so it takes at most {max_sec} seconds at about {wps} words per second (≤ {max_words} words). Keep the same language and script, the same meaning, the same number(s), and the brand name if present. Output only the line, nothing else.
Line: "{text}"
```

**T9 — clarity judge** (`gemini-3.5-flash-lite`, JSON, temperature 0):
```
Score this {length}-second vertical ad script for a viewer who sees it ONCE on a phone, probably muted for the first 3 seconds. Return ONLY JSON {"scores":{"three_second_test":0,"single_promise":0,"visual_verbal_match":0,"benefit_language":0,"concreteness":0,"sound_off_test":0,"cta_clarity":0,"naturalness":0},"total":0,"fixes":["<≤3 concrete edits, each naming the scene>"]}.
Max points: three_second_test 20 — from scene 1's text + caption + shot alone, can the viewer name the product category or the problem? single_promise 20 — do all scenes ladder to "{promise}" with no second message? visual_verbal_match 15 — does each shot show exactly what its line says, with the product doing its job (not decorative)? benefit_language 10 — outcomes for the viewer, not specs? concreteness 10 — a repeatable number/time/place, and is it from the product facts? sound_off_test 10 — do the caption cards alone tell hook → benefit → CTA? cta_clarity 10 — one action, one channel, number spoken and shown, verb first? naturalness 5 — reads like a real {lang} speaker, no ad-speak?
Script: {script_json}   Product facts: {facts_planner_json}
```

**T10 — recall test** (fresh call, sees no spoken lines, temperature 0):
```
You are watching a short Indian ad with the sound off. You see only these caption cards in order, and these one-line descriptions of the pictures:
{captions_and_shot_summaries_numbered}
In one sentence: what is being sold, what is promised, and what should you do next? Then compare with the intended promise "{promise}" and intended action "{cta_caption}". Return ONLY JSON {"sentence":"","product_named":true,"matches_promise":true,"matches_action":true}
```

### (b) T3 — Scene still (`IMG_MODEL` = `gemini-3.1-flash-image`, fallback `gemini-3.1-flash-image-preview`; `generationConfig: {responseModalities:["IMAGE"], responseFormat:{image:{aspectRatio:"{ratio}", imageSize:"1K"}}}`, on 400 retry with `imageConfig:{aspectRatio}`)

Parts order: identity refs (front, three_quarter, output_closeup, installed; ≤6, ≤1536 px, real MIME, each preceded by a text part `Image {k}: {view}`) → logo (if any) → anchor still (scenes ≥1) → previous failed still (edit mode only) → this text:

```
Photorealistic advertising still, {ratio}, editorial product photography, shot on a {lens} lens, natural skin texture, no retouching look.

REFERENCE IMAGES
{ref_lines}
  e.g. "- Image 1: {label}, front view. Image 2: three-quarter view. Image 3: close-up of {output.part} — this is the only place {output.medium} leaves the unit. Image 4: the unit installed in a real home."
{logo ? "- Image {k}: the brand logo. It appears only where the product itself carries it ({logo.placement}). Do not enlarge, redraw, move or duplicate it. Do not add it anywhere else." : ""}
{anchor ? "- Image {k}: the same room from the opening scene — reuse this exact counter, wall colour, window and light direction." : ""}

THE PRODUCT — identical to the reference images
{label}: {appearance}. It stands {where_it_lives}. {connections_sentence}   e.g. "It is connected to the kitchen tap through a small diverter valve and a thin clear tube at the back (water goes in there, never out)." {parts_visible_sentence}   e.g. "Its flexible white outlet hose on top and its lit front panel are visible." Exactly one unit is in the picture, fully inside the frame, in sharp focus, about {frame_share*100}% of the frame. {in_use ? "It is switched on and working: " + output.action_positive + "." : "It stands idle with its panel lit; nobody touches it."}

SCENE
[Subject] {people.count > 0 ? people.desc + " (Indian, South Asian features, " + people_default + ")" : "no people"}.
[Action] {in_use ? output.action_positive + hands_clause : hero_motion_as_still + "."}
  hands_clause: hands=="operating" → ", one hand operates the panel without covering it"; hands=="edge" → ", a hand visible only at the edge of the frame holding the glass"; hands=="none" → ", nobody touches the unit".
[Location] {setting_desc}; product placement: {product.placement}; the surfaces around the unit are bare and tidy.
[Composition] {framing} shot, {lens}; the product{in_use ? " and its " + output.part : ""} are the visual centre.
[Style] {lighting}, {tone_style_words}.

KEEP EXACTLY AS IN THE REFERENCES: body shape, colour, proportions, panel and display, buttons, {parts_names}, logo placement. Do not add pipes, hoses, attachments or accessories that the references do not show.
{in_use ? "Visible in this shot: " + must_show_sentences : ""}   e.g. "Visible in this shot: water comes only from the unit's outlet hose into the glass; the sink tap is closed and dry; the front panel display is lit."

BOUNDARIES (the scene is complete as described above): {boundary_sentences} no other appliance, product, bottle or jug is present; the frame contains no text, letters, numbers, labels, captions or watermarks other than the product's own printed logo. All people are Indian.
  boundary_sentences = must_show items rendered as "the only {medium} in the frame flows from the unit's {output.part};" + each must_show item as a clause + "the unit has only the hoses and parts shown in the references;"

{corrections ? "CORRECTIONS TO THE PREVIOUS ATTEMPT (the last image): " + fix_instruction + " Change only that; keep the composition, people and lighting the same." : ""}
```

**Safe-shot variant** (`buildStillPromptSafe`): same text with `people.count=0`, `in_use=false`, `hands="none"`, [Action] = "The unit stands on {where_it_lives} with its panel lit, {output.part} resting in its normal position, a clean empty glass beside it.", framing medium, camera static.

**[decision]** No generated corner logo chip (rejected by judges); the brand chip is overlaid in ffmpeg by `captionOverlay` as today. `must_not_show` is never pasted into the positive prompt; BOUNDARIES derive from the positive `must_show` list.

### (c) T4 — Still QC judge (`gemini-3.5-flash-lite`, temperature 0, `responseMimeType: application/json` + `responseSchema`; all images ≤768 px)

Parts: identity refs (≤4) → logo → candidate (pair mode: candidate A, candidate B) → text:

```
You are a strict product-fidelity inspector for advertising stills. Images 1-{n} are photographs of the REAL product. {logo ? "Image " + (n+1) + " is the brand logo." : ""} The next image is the CANDIDATE generated still{pair ? " (A); the last image is a second CANDIDATE (B)" : ""}. Judge only what is actually visible in the candidate; when unsure, mark the check false and say why.

PRODUCT FACTS
Name: {label}. Appearance: {appearance}. Stands {where_it_lives}. Connections: {connections_sentence}. Parts: {parts_list}.
{output ? "Its result (" + output.medium + ") leaves the unit ONLY through: " + output.part + ". Correct use looks like: " + output.action_positive + "." : "This product delivers no liquid, air, light or heat."}
Never acceptable: {must_not_show_joined}. Objects that must not be in the frame: {forbidden_objects_joined}.
Logo: {logo.placement | "none"}; no logo anywhere else. Hands rule: {hands} (none = no hands touch the unit; edge = at most a hand at the frame edge holding a glass; operating = one hand may operate the panel without covering it). The unit is {size_class === "handheld" ? "hand-held" : "never held in a hand"}.

SCENE BRIEF
{role} shot in {setting_desc}; expected people: {people.count} ({people.desc}); product {in_use ? "IN USE" : "idle"}; product should fill at least {frame_share*100 - 10}% of the frame.

STEP 1 — DESCRIBE the candidate factually in 3-5 sentences: the product shown and how many units; where any {output.medium | "result"} is coming from; every other object within arm's reach of the product; number of people and what their hands are doing; any readable text.

STEP 2 — CHECKS (true/false, each with one line of evidence from your description):
same_product: same body shape, colour, panel/display, buttons and {output.part | "parts"} as Images 1-{n} (ignore angle and lighting). False if any structural part is missing, added, moved or recoloured.
single_unit: exactly one unit.
usage_correct: if any {output.medium} is shown, it comes from {output.part} and nowhere else. True if none is shown{output ? "" : " (always true for this product)"}.
no_forbidden_objects: none of the never-acceptable items or forbidden objects is present.
no_text: no readable text, letters, numbers or watermarks except the product's own printed logo.
logo_ok: any visible logo matches the logo image, sits only where the facts say, and is not distorted or duplicated. True if absent.
people_ok: count matches the brief exactly; faces plausible; people look Indian.
hands_ok: any hands have five plausible fingers and respect the hands rule; the unit is not held.
product_prominent: product fully inside the frame, unobstructed, in focus, roughly the expected size.
photo_quality: photorealistic; no warping, duplication, melted edges or cartoon look.

STEP 3 — VERDICT
"pass" only if every check is true. "hard_fail" if same_product is false. Otherwise "retry".
fix_instruction: one imperative sentence ≤40 words naming exactly what to change and what to keep.
owner_summary: ≤12 English words a shop owner understands, listing what was verified, separated by " · " (e.g. "one unit · water from outlet hose · sink tap closed").
confidence: 0-1 for the verdict.
{pair ? "Judge both candidates. winner = the candidate with more true checks; on a tie prefer the one where usage_correct and same_product are true, then product_prominent. Report the winner's description, checks and evidence." : ""}
Return ONLY JSON: {"description":"","checks":{"same_product":true,"single_unit":true,"usage_correct":true,"no_forbidden_objects":true,"no_text":true,"logo_ok":true,"people_ok":true,"hands_ok":true,"product_prominent":true,"photo_quality":true},"evidence":{"<check>":"<one line>"},"verdict":"pass|retry|hard_fail","fix_instruction":"","owner_summary":"","confidence":0.0{pair ? ",\"winner\":\"A|B\"" : ""}}
```

**T4-clip — clip QC** (same model/settings; parts: front ref → frames A (0.2 s), B (2.5 s), C (4.6 s) → text):
```
Image 1 is a photograph of the real product. Images A, B, C are the first, middle and last frames of an AI-generated 5-second clip that began from an approved still.
PRODUCT FACTS: {label}: {appearance}. {output ? output.medium + " leaves the unit only through " + output.part + "." : ""} Never acceptable: {must_not_show_joined}. Forbidden objects: {forbidden_objects_joined}.
Describe in 2 sentences what changes from A to C. Then CHECKS (true/false with one line of evidence each, and each must hold in ALL three frames): same_product (unit identical to Image 1 in every frame), single_unit, usage_correct ({output.medium} only from {output.part}), no_forbidden_objects, no_new_objects (nothing — object, person, tap, hose, light source — appears in B or C that is absent in A), no_text_overlay, motion_sane (no melting, no limb or object morphing, no drastic camera move).
verdict "pass" only if all true, else "fail". failed_sentence: one sentence (≤20 words) stating what must stay fixed, for the retry prompt.
Return ONLY JSON {"description":"","checks":{...},"evidence":{...},"verdict":"pass|fail","failed_sentence":"","confidence":0.0}
```

### (d) T5/T6 — Kling motion prompt, negative prompt, settings

`buildKlingPrompt(facts, shot, {retry, escalate})` — 25–60 words, never the brand name, never re-describes the image:

```
{camera_phrase}. {Label} stays exactly as shown — same shape, colours, control panel and {fixed_parts_joined}; it does not move, turn or change. {hero_motion_sentence}. {secondary_motion ? secondary_motion + ". " : ""}{motion_truths}Background stays completely still; no new object, person or light source enters the frame. {speed_word}, smooth, sharp, photographic.{retry ? " " + failed_sentence : ""}
```
- `camera_phrase` map: static → "Static camera, locked off, tripod shot, no camera movement"; slow_push_in → "Slow push-in toward the product"; slow_pull_back → "Slow pull-back revealing the room"; slow_pan_left/right → "Slow pan left/right"; slow_tilt_up → "Slow tilt up"; subtle_parallax → "Subtle parallax, the camera drifts a few centimetres to the left"; gentle_handheld → "Gentle handheld, barely moving". **Static is forced** when `in_use` and `output.medium === "water"` (any liquid).
- `hero_motion_sentence`: for `in_use` shots code rewrites from `output` as source → destination → endpoint: "A clear stream of {medium} keeps flowing from the end of {output.part_short} into the glass directly below it, small bubbles rising, the glass slowly fills, then the stream settles". Otherwise the planner's `hero_motion` verbatim (≤20 words; banned words orbit/rotate/whip/dolly zoom/fast/dramatic are rejected by gate G11).
- `motion_truths`: each `must_show` item rendered as stillness, e.g. "The sink tap stays closed and still; no other water source appears. " (code map: "sink tap is closed and dry" → "The sink tap stays closed and still; no other water source appears."; other items → "{item} throughout.").
- `speed_word` = "Real-time speed" (default) | "Slow motion" (hero splash shots only).
- `fixed_parts_joined` = names of parts with `visible_in_use:true`.
- Escalation prefix: "@Element1 is {label}; keep it identical. ".

`buildKlingNegative(facts, shot)`:
```
blur, distort, low quality, flicker, morphing, warped label, mirrored text, second product, duplicate unit, {scene_negatives}, floating objects, camera shake, watermark, subtitles, caption overlay{hands === "none" ? ", hands, extra fingers" : ", extra fingers, warped hands"}
```
- `scene_negatives` = `forbidden_objects` ∪ short nouns from `must_not_show`, deduplicated, ≤8 terms (Wellwa: "running faucet, extra tap, faucet, extra hose, water from any other source, water bottle, jug, second purifier"). Rules enforced in code: never the bare word "text"; never a term that appears in the positive prompt (no "water" on a pour shot); ≤20 terms total.

**Endpoint adapter (`bridge/kling.mjs`)** — one table, all field-name differences live here; each endpoint verified with one paid call before enabling; env `KLING_MODEL` / `KLING_ESCALATE` / `KLING_LEGACY`:

| key | endpoint | still field | supports | body extras |
|---|---|---|---|---|
| `v2.6-pro` (default) | `fal-ai/kling-video/v2.6/pro/image-to-video` | `start_image_url` (+`end_image_url`) | negative_prompt yes, cfg_scale **no**, elements no | `generate_audio:false`, `duration:"5"` |
| `v3-pro` (escalation) | `fal-ai/kling-video/v3/pro/image-to-video` | `start_image_url` | negative yes, cfg_scale yes (0.7 on retry), elements yes | `generate_audio:false`, `duration:"5"`, `elements:[{frontal_image_url: front ref, reference_image_urls: ≤3 other identity refs with kling_element:true}]` |
| `v2.5-turbo` (legacy fallback) | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | `image_url` | negative yes, cfg_scale 0.5 | `duration:"5"` |

Still is sent as `data:image/jpeg;base64` at 1080 px width, q92 (as today). Polling every 6 s, 12-min cap (as today) with `fal_request_id` written ahead. **[decision]** `end_image_url = still` is used on the retry **only** for `in_use:false` product-only shots (pinning start=end collapses the hero motion on pour shots — engineering judge).

### (e) TTS style + native script

`TTS_STYLE[lang]` (replaces the single string at media-worker L211; skipped for mixed Devanagari+Latin lines as today; retry ladder unchanged):
- `en`: `Read this aloud as a warm, confident Indian ad narrator. Natural pace, clear diction, friendly energy. Do not add any words of your own: `
- `hi`, `hinglish`, regional: `Read this aloud as a warm, confident {language_name} ad narrator speaking to a family. Natural pace, clear pronunciation of every word, friendly energy, no accent shift on English words. Do not add any words of your own: `
- CTA lines (all languages) insert before the colon: ` Say the phone number slowly, digit by digit.` The phone number is also pre-split into digit pairs with thin spaces before TTS (`98 76 54 32 10`).
- Voice style adjectives per `voiceStyle` may replace "warm, confident" (existing VOICES keys).

`nativeScript()` prompt (`bridge/tts-script.mjs` L17) gains a glossary line, and its cache key includes the glossary hash:
```
Rewrite this line in {script} script for a text-to-speech engine. Keep the meaning and word order exactly, do not translate or add words. Write English words and brand/product names phonetically as they are pronounced in English. Use EXACTLY these spellings whenever these words appear: {glossary}   (e.g. Wellwa → वेलवा, ionizer → आयोनाइज़र, alkaline → अल्कलाइन, WhatsApp → व्हाट्सऐप, demo → डेमो). Keep digits (phone numbers, prices, %) as digits. Output only the rewritten line, nothing else.

{t}
```
`glossary` = `facts.pronunciations` ∪ a fixed common list (WhatsApp, demo, offer, free, home, pure, water). The 12-language `SCRIPT` map is used as-is now that routes store all codes.

### (f) T11 — Hook / variant generator (`/api/media/ad-hook` and the 3-variations hooks call in the worker; `gemini-3.5-flash-lite`, JSON, temperature 0.9)

```
Write 3 alternative opening lines for this ad, same language and script as the original: {LANG_RULE}.
Product: {name} ({label}). Promise of the ad: "{promise}". Benefits you may use: {benefits_joined}. Numbers you may use: {proof_numbers | "(none)"}. Banned words: {banned_claims}.
Each line: 6-12 words, a number or a concrete noun in the first 4 words, no brand name, understandable with the sound off, and a different angle from the original ("{current}") and from each other: one question, one bold number or fact, one pain point. Truthful — nothing outside the facts above.
Return ONLY JSON: {"hooks":["<question>","<number>","<pain point>"]}
```
Worker variants use the same template with `"Return 2 hooks"`; each variant swaps only line 0's wav, look and music, reusing all clips (as today).

### Fully filled Wellwa example — 20 s realistic, Hinglish, goal leads

**(a) Planner output, script A** (angle did_you_know; promise "RO ka paani ek button se alkaline, poore ghar ke liye"; why "Opens with a question your customers already ask, names Wellwa by second 5, shows water coming from the unit itself, ends with one WhatsApp action."):

| # | role | text (words) | caption | shot (creative fields only) |
|---|---|---|---|---|
| 1 | hook | "Kya aap jaante hain RO paani acidic ho sakta hai?" (9) | "RO paani acidic?" | kitchen; "bright modern Indian kitchen, white marble counter, window light from the left"; people 1 "woman about 35 in a cotton kurta looking doubtfully at a glass"; medium, 35mm; "soft morning daylight"; product {in_use:false, placement:"on the counter beside the sink, right of the woman, outlet hose over an empty glass", frame_share:0.3}; hero_motion "she lifts the glass a few centimetres and frowns at it"; camera slow_push_in; hands edge |
| 2 | product_in_use | "Wellwa ionizer isi paani ko alkaline banata hai — ek button." (9) | "Ek button. Alkaline paani." | kitchen; "same kitchen, counter beside the sink"; people 1 "the same woman, only her hand at the frame edge"; close_up, 50mm; "soft morning daylight"; product {in_use:true, placement:"centre frame on the counter, outlet hose curving down into a clear glass held at the frame edge", frame_share:0.5}; hero_motion "water streams from the outlet hose into the glass, small bubbles rising"; camera static (forced: liquid in use); hands edge |
| 3 | benefit | "Har glass mein mineral-rich paani, poore parivaar ke liye." (8) | "Mineral-rich, har glass" | dining room; "dining table by the kitchen opening, warm light"; people 3 "parents and one child drinking water"; wide, 35mm; product {in_use:false, placement:"on the kitchen counter behind them, hose over a glass", frame_share:0.2}; hero_motion "the child drinks and grins, the parents smile"; camera gentle_handheld; hands none |
| 4 | proof_or_offer | "5,000+ gharon ka bharosa. Free home demo bhi." (8) | "Free home demo" | kitchen; people 2 "a technician in a plain blue polo and the woman"; medium, 35mm; product {in_use:true, placement:"on the counter between them, outlet hose over the customer's glass held at the frame edge", frame_share:0.35}; hero_motion "water flows from the outlet hose into the glass as she watches"; camera static (forced); hands edge |
| CTA | cta | "Abhi WhatsApp karein — 98xxx xxxxx." | "WhatsApp 98xxx xxxxx" | end card, 3.5 s |

Gates: every line ≤9 words (hinglish budget); number 5000 ∈ facts.proof; hook has no brand; scene 2 names Wellwa; single CTA; in_use scenes = 2. Clarity 86 · recall test: "An alkaline water machine that turns RO water alkaline at one button; WhatsApp the number" → matches.

**(b) Still prompt as sent for scene 2** (parts: front.png, tq.png, hose.png, kitchen.png, logo.png, scene-0 anchor still, text):

```
Photorealistic advertising still, 9:16, editorial product photography, shot on a 50mm lens, natural skin texture, no retouching look.

REFERENCE IMAGES
- Image 1: the water ionizer, front view. Image 2: three-quarter view. Image 3: close-up of the unit's own flexible outlet hose on top — this is the only place water leaves the unit. Image 4: the unit installed in a real home.
- Image 5: the brand logo. It appears only where the product itself carries it (printed top-centre of the front panel). Do not enlarge, redraw, move or duplicate it. Do not add it anywhere else.
- Image 6: the same room from the opening scene — reuse this exact counter, wall colour, window and light direction.

THE PRODUCT — identical to the reference images
the water ionizer: white glossy rectangular body about 35 cm tall and 25 cm wide, dark touch display centred on the front panel with a ring of blue light, three silver buttons below the display, Wellwa logo printed top-centre of the panel, a flexible white outlet hose rising from the top and curving down, a thin clear inlet tube at the back. It stands on the kitchen counter beside the sink. It is connected to the kitchen tap through a small diverter valve and a thin clear tube at the back (water goes in there, never out). Its flexible white outlet hose on top and its lit front panel are visible. Exactly one unit is in the picture, fully inside the frame, in sharp focus, about 50% of the frame. It is switched on and working: a clear stream of water flows from the end of the unit's own outlet hose on top into a glass held directly beneath it; the unit is the only source of water in the scene; the kitchen sink tap is closed and dry.

SCENE
[Subject] the same woman, only her hand at the frame edge (Indian, South Asian features, Indian family, 30–45, everyday home clothing).
[Action] a clear stream of water flows from the end of the unit's own outlet hose on top into a glass held directly beneath it; the unit is the only source of water in the scene; the kitchen sink tap is closed and dry, a hand visible only at the edge of the frame holding the glass.
[Location] same kitchen, counter beside the sink; product placement: centre frame on the counter, outlet hose curving down into a clear glass held at the frame edge; the surfaces around the unit are bare and tidy.
[Composition] close_up shot, 50mm; the product and its the unit's own flexible outlet hose on top are the visual centre.
[Style] soft morning daylight, warm and clean.

KEEP EXACTLY AS IN THE REFERENCES: body shape, colour, proportions, panel and display, buttons, outlet hose, front panel, logo placement. Do not add pipes, hoses, attachments or accessories that the references do not show.
Visible in this shot: water comes only from the unit's outlet hose into the glass; the sink tap is closed and dry; the front panel display is lit while in use.

BOUNDARIES (the scene is complete as described above): the only water in the frame flows from the unit's outlet hose; water comes only from the unit's outlet hose into the glass; the sink tap is closed and dry; the front panel display is lit while in use; the unit has only the hoses and parts shown in the references; no other appliance, product, bottle or jug is present; the frame contains no text, letters, numbers, labels, captions or watermarks other than the product's own printed logo. All people are Indian.
```
(Builder must strip the duplicated article: `output.part_short` = "flexible outlet hose on top" is used after "its".)

**(c) Judge verdict the original tap render receives:**
```json
{"description":"One white ionizer with a lit blue display stands on a marble counter beside a sink. A chrome gooseneck faucet at the sink is running and filling a glass held by a woman's hand; the unit's white outlet hose hangs to the side, dry. No other objects near the unit. One person, hand only. No readable text.",
 "checks":{"same_product":true,"single_unit":true,"usage_correct":false,"no_forbidden_objects":false,"no_text":true,"logo_ok":true,"people_ok":true,"hands_ok":true,"product_prominent":true,"photo_quality":true},
 "evidence":{"usage_correct":"water comes from the chrome faucet, the unit's outlet hose is dry","no_forbidden_objects":"a running kitchen faucet is in the frame"},
 "verdict":"retry",
 "fix_instruction":"Turn the faucet off and dry; hold the glass directly under the unit's white outlet hose with water streaming from that hose into it; keep the woman's hand, counter and morning light unchanged.",
 "owner_summary":"redrawn: water was coming from the sink tap",
 "confidence":0.92}
```
→ attempt 2 runs T3 in edit mode with the failed still as the last image and this `fix_instruction` as CORRECTIONS → pass with `owner_summary` "one unit · water from outlet hose · sink tap closed · panel lit" (shown under the tile as "✓ Checked: …"). If attempt 2 also failed → safe shot (idle unit, no water, cannot show a wrong source). Nothing reaches fal until a pass.

**(d) Kling request for the passed still (v2.6-pro):**
```
prompt: "Static camera, locked off, tripod shot, no camera movement. The water ionizer stays exactly as shown — same shape, colours, control panel and outlet hose, front panel; it does not move, turn or change. A clear stream of water keeps flowing from the end of the flexible outlet hose on top into the glass directly below it, small bubbles rising, the glass slowly fills, then the stream settles. The sink tap stays closed and still; no other water source appears. The front panel display stays lit throughout. Background stays completely still; no new object, person or light source enters the frame. Real-time speed, smooth, sharp, photographic."
negative_prompt: "blur, distort, low quality, flicker, morphing, warped label, mirrored text, second product, duplicate unit, running faucet, extra tap, faucet, extra hose, water from any other source, water bottle, jug, second purifier, floating objects, camera shake, watermark, subtitles, caption overlay, extra fingers, warped hands"
body: {"start_image_url":"data:image/jpeg;base64,…","prompt":"…","negative_prompt":"…","duration":"5","generate_audio":false}
```
Clip QC on frames 0.2/2.5/4.6 s: if a tap appears in B or C → `no_new_objects:false` → one retry (v3-pro + elements because 3 identity views exist, `failed_sentence` appended, cfg 0.7) → else Ken-Burns of the approved still + 5-credit refund + note.

**TTS for scene 2:** `nativeScript` with glossary → "वेलवा आयोनाइज़र इसी पानी को अल्कलाइन बनाता है — एक बटन।" (pure Devanagari → preamble applied) → measured 3.9 s ≤ 4.3 s → accepted; row `(hinglish, warm, 9, 3.9)` appended to `media_tts_calibration`.

---

## 6. Quality gates & thresholds

### 6.1 Word budgets (`src/lib/media/ad-rules.mjs`)

`SCENE_SPEECH_SEC = 4.3` (5 s clip − 0.1 s head trim − 0.1 s tail trim − 0.4 s xfade = 4.4 s visible; 0.1 s breath).

| lang | wps | max words / realistic scene | total words 10/20/30 s (0.85 × length × wps) |
|---|---|---|---|
| en | 2.6 | 11 | 22 / 44 / 66 |
| hi, hinglish | 2.1 | 9 | 18 / 36 / 54 |
| mr, gu, pa, bn, or | 2.0 | 8 | 17 / 34 / 51 |
| ta, te, kn, ml | 1.7 | 7 | 14 / 29 / 43 |

Once `media_tts_calibration` has ≥30 rows for a language, `wps = median(words/sec) × 0.9` replaces the table (cached 1 h in the route).

### 6.2 Deterministic script gates (G1–G11; shared by client meters, `ad-plan`, `ad-score`, and re-run server-side in `POST /api/media/ad` → 400 on failure)

- G1 scene count = `scenesFor(tier, length)` (realistic 10→2, 20→4, 30→6; template 10→2, 20→3, 30→4, 45→5, 60→6); Σ seconds ≤ length + 1.
- G2 words per line ≤ `perSceneWords(lang, tier)`; Σ words ≤ `totalWords(lang, length)`.
- G3 caption 2–5 words, ≤32 chars, digits not words, contains a number or a benefit noun.
- G4 exactly one CTA; no call/WhatsApp/number/website/"abhi book" tokens in non-CTA lines.
- G5 phone digits appear in CTA iff `brief.phone`; no other ≥7-digit run anywhere.
- G6 banned-claim regex `/(cure|ilaaj\s+(pakka|guaranteed)|guarantee|100\s*%|no\.?\s*1|doctor[- ]recommended|best in|sabse behtar|world'?s)/i` ∪ `facts.banned_claims`, unless the exact phrase is in `facts.proof[].text`.
- G7 every number in the script ⊆ numbers in `facts.proof ∪ facts.offers ∪ brief.offer ∪ phone`.
- G8 script ratio: `hinglish` → no Devanagari; `hi`/regional → ≥80% of letters in the target Unicode block.
- G9 hook (scene 1) contains no brand/product token; scene 2 (or 1 when only 2 scenes) contains brand or product name.
- G10 shot spec: `camera ∈ CAMERA_WHITELIST`; `hands ≤ facts.hands` (none < edge < operating); `in_use` true for 1–2 scenes; `size_class !== "handheld"` ⇒ no "hold(s|ing) the {label}" in hero_motion/placement; `frame_share ∈ [0.2,0.6]`.
- G11 `hero_motion` ≤20 words, one verb clause, none of `/orbit|rotat|spin|whip|dolly zoom|fast|dramatic|cinematic/i`, no `must_not_show` noun; `secondary_motion` ≤8 words.

Fail → T2b fix round-trip ×1 → still failing → drop that script and regenerate with another angle (max 1 extra generation per plan call). `POST /api/media/ad` rejects a script that fails any hard gate.

### 6.3 Clarity + recall
Clarity judge (T9): ≥75 "Ready" (green); 60–74 apply `fixes` once and re-score (amber if still <75); <60 regenerate that script with a different angle (×1). Recall test (T10): `product_named && matches_promise && matches_action` else regenerate captions only (×1). Stored in `input.scorecard = {clarity:{scores,total}, recall:{…}, gates:"ok"}`.

### 6.4 Still QC policy (per scene; `QC_ENFORCE=1` after calibration, shadow mode before)
- Judge: temperature 0, `responseSchema`, images ≤768 px, 1 retry on malformed JSON. `pass` = all checks true; `hard_fail` = `same_product` false; else `retry`.
- Attempt 1: `in_use` scenes → 2 candidates in parallel + pair judge (winner must still pass); idle/lifestyle → 1 candidate + single judge.
- Attempt 2 (`retry`): edit mode — failed still as last ref + CORRECTIONS = `fix_instruction`.
- Attempt 3 or any `hard_fail`: safe shot (T3-safe), judged once. Fail → scene `needs_owner` (tile shows evidence, Animate disabled).
- Caps: 3 attempts/scene; `MAX_STILLS_PER_JOB = 2n + 2` (including owner redraws); beyond the cap a scene goes straight to safe shot.
- Scene 0 generated and judged first; its still is the anchor for scenes 1..n−1; then 3-wide parallel.
- Product's first realistic job (no prior `done` job at this `facts_version`): a `pass` requires two agreeing judge calls; `confidence < 0.6` on a pass triggers a second call for every job.
- Calibration before `QC_ENFORCE=1`: `bridge/qc-calibrate.mjs` over ≥30 labelled stills (≥10 known-bad incl. the faucet render in `ad-last-failed`); required: precision ≥0.9 and recall ≥0.9 on `usage_correct`, ≥0.85 on `same_product`; every verdict logged in `media_jobs.qc`. `QC_AUTO_ALLOWED=1` (auto mode visible) only after that.

### 6.5 Clip QC policy
Frames at 0.2 / 2.5 / 4.6 s (`ffmpeg -ss t -i clip -frames:v 1`). Fail → exactly one retry: `v3-pro` + `elements` when ≥2 identity photos have `kling_element:true`, else `v2.6-pro` again; `failed_sentence` appended to the prompt and its noun to the negative; `end_image_url = still` only for `in_use:false` product-only shots. Second fail → Ken-Burns of the approved still (`renderKenBurns()` in `bridge/ad-engine.mjs`, 5 s zoompan 1.0→1.06), `clips[i].fallback = "kenburns"`, half-share refund, visible note. Caps: `MAX_KLING_CALLS_PER_JOB = n + 2`, `MAX_ESCALATIONS_PER_JOB = 2`, `MAX_VENDOR_PAISE_PER_JOB = 45000`, global `KLING_DAILY_CAP` (env, default 60 calls/day, alert at 80% via log line + WhatsApp note to owner if the bridge exposes it).

### 6.6 Timing gate (worker W2)
Measured `sec > 4.3` (realistic scene) or `> seconds − 0.5` (other tiers) → T7 shorten → re-TTS, ≤2 rounds → still over → `atrim=0:4.3,afade=t=out:st=4.25:d=0.05` hard-trim with a `warning` event (sync can never drift). CTA hold = `max(3.5, ctaSec + 0.6)`. A hard TTS failure (all ladder steps) fails the job before any Kling spend (realistic: nothing to refund; other tiers: refund as today). No silent scenes anywhere in the new pipeline.

### 6.7 Assembly sanity
`ffprobe` duration within ±0.5 s of expected; audio stream present when voice on; file > 200 KB; else retry once, then `render_failed`.

### 6.8 Caption / CTA rules
Word-highlight captions: groups of 3 for Indic scripts, 4 for Latin; ≤32 chars per group; never split a digit run; baseline at 0.62·H (inside Meta's 14/35/6 safe zone). CTA card: verb + number at ≥5% of frame height, offer line when present, held ≥3.5 s; pill label per language (`CTA_LABELS[lang]`, English fallback for regional until localised).

---

## 7. Credits & billing rules

Pricing constants unchanged (`adCredits(len) = max(20, ceil(len/5)×10)`, ×1.5 for 3 variations, realistic ≤30 s). 1 credit = ₹10.

| Event | User pays | Ledger reason (`ref` = job id) | Platform pays | Notes |
|---|---|---|---|---|
| Facts draft/confirm, 3 scripts, re-write, score, hooks, recall | 0 | — | <₹1 | rate limit 40/10 min |
| TTS line preview | 0 | — | ₹0.2 | cached; 20/10 min |
| **Storyboard** (TTS dry-run + stills + QC) | **0** | — | ≈ ₹36–60 | limits: 3 per product/day, 6 per user/day (count `media_jobs` where `phase='storyboard'` and today); beyond → button reads "Storyboard: 5 credits" (`ad-storyboard-extra`). **[decision]** Storyboard requires `balance ≥ animate cost` (prevents zero-balance stills farming; see Open Q1). |
| Redraw a scene | first per scene 0, then **1 credit** | `ad-redraw` | ₹6–12 | counts against `2n+2` stills cap; beyond the cap every redraw costs 1 credit |
| Auto QC retries (candidates, edit mode, safe shot) | 0 | — | ₹5.6 each | per-job caps §6.4 |
| **Animate** (approve) | `ceil(adCredits(len) × (variants===3 ? 1.5 : 1))` | `ad-animate` | Kling ₹30/clip (₹94 escalated) | `spend_credits` at approve, guarded `status=eq.review`; `cost` written to the row then |
| Kling QC retry / escalation | 0 | — | ₹30–94 | caps §6.5 |
| Scene delivered as Ken-Burns | refund `ceil(cost / n / 2)` per fallback scene | `ad-scene-fallback` | — | automatic; shown on the job row |
| User cancel during animate | refund `round(cost / n) × (scenes without an accepted clip)`; accepted clips stay cached 7 days | `job-cancel-refund` | sunk clips | replaces all-or-nothing |
| Technical failure during animate (fal outage, ffmpeg, upload) | credits **held**; job → `review` with error banner; **Retry render (free)** resumes from cached clips; **Discard** after a failure → full refund | `ad-refund` | sunk | platform's failure → platform eats it |
| Stale lease exhausted (attempts ≥3) | same as technical failure of the current stage | | | |
| Discard at storyboard / 48 h auto-discard | 0 (nothing charged) | — | stills sunk | |
| Template / presenter / testimonial | charged at creation as today; refund on failure | `ad-builder` / `ad-refund` | | `reel-refund` no longer used for ads |
| Phase 2: Redo scene N | `ceil(cost / n)` | `ad-scene-redo` | still+judge+Kling | child job `parent_job_id`; re-assembly free |
| Phase 2: change hook/CTA/music/captions | 0 | — | TTS + ffmpeg | child job, no Kling |

Idempotency: every `spend_credits`/`grant_credits` call passes `p_ref = job id` (or `jobId:scene:n` for per-scene reasons). Migration adds a **partial** unique index `credit_ledger(reason, ref) where ref is not null and reason like 'ad-%'` — restricted to the new reason codes so existing duplicate rows (`job-cancel-refund`, `reel-refund`) cannot block the migration. A unique-violation on insert is treated as "already applied".

`bridge/ad-caps.mjs`: `MAX_STILL_ATTEMPTS_PER_SCENE=3, MAX_STILLS_PER_JOB=(n)=>2*n+2, MAX_KLING_CALLS_PER_JOB=(n)=>n+2, MAX_ESCALATIONS_PER_JOB=2, MAX_VENDOR_PAISE_PER_JOB=45000, STORYBOARDS_PER_PRODUCT_PER_DAY=3, STORYBOARDS_PER_USER_PER_DAY=6, STORYBOARD_EXTRA_CREDITS=5, REDRAW_CREDITS=1, REVIEW_AUTO_DISCARD_HOURS=48, KLING_DAILY_CAP=env|60`. `vendor_cost_paise` is accumulated per job from a price table (`PRICE_PAISE = {still:560, judge:10, kling_v26:3000, kling_v3_elements:9400, tts_line:20}`) so cost per accepted clip per endpoint can be queried.

---

## 8. Data model & API changes

### 8.1 Migration `supabase/migrations/0044_ad_pipeline_v2.sql`

```sql
-- products (see §3.1)
alter table public.poster_products
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists facts jsonb not null default '{}'::jsonb,
  add column if not exists facts_version int not null default 0,
  add column if not exists facts_confirmed_at timestamptz;

-- jobs
alter table public.media_jobs drop constraint if exists media_jobs_status_check;
alter table public.media_jobs add constraint media_jobs_status_check
  check (status in ('queued','running','review','done','failed'));
alter table public.media_jobs
  add column if not exists pipeline int not null default 1,                  -- 1 legacy processAd, 2 stage machine
  add column if not exists phase text not null default 'animate',            -- storyboard | animate
  add column if not exists stage text not null default '',                   -- validate|tts|stills|await|clips|assemble|captions|upload|render_failed
  add column if not exists progress jsonb not null default '{}'::jsonb,      -- {pct, label, scene_done, scene_total, eta_sec}
  add column if not exists mode text not null default 'review',              -- review | auto
  add column if not exists product_id uuid references public.poster_products(id),
  add column if not exists facts_version int,
  add column if not exists storyboard jsonb not null default '[]'::jsonb,    -- per scene {i, role, still{url,attempt,verdict,owner_summary,safe_shot,needs_owner}, redraw_requested, redraw_note, redraws}
  add column if not exists assets jsonb not null default '{}'::jsonb,        -- {wavs[], clips[], cta, vo, pending}
  add column if not exists qc jsonb not null default '[]'::jsonb,            -- append-only judge verdicts {scene, attempt, stage, verdict, checks, evidence, owner_summary, ms, model}
  add column if not exists charges jsonb not null default '[]'::jsonb,       -- [{reason, credits, ref, at}]
  add column if not exists vendor_cost_paise int not null default 0,
  add column if not exists worker_id text,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists attempts int not null default 0,
  add column if not exists approved_at timestamptz,
  add column if not exists parent_job_id uuid references public.media_jobs(id),
  add column if not exists feedback jsonb;
create index if not exists media_jobs_lease_idx on public.media_jobs(status, heartbeat_at) where status = 'running';
create index if not exists media_jobs_owner_phase_idx on public.media_jobs(owner_id, phase, created_at desc);

-- idempotent credits for the new reason codes only (existing duplicates untouched)
create unique index if not exists credit_ledger_ad_reason_ref_uidx
  on public.credit_ledger(reason, ref) where ref is not null and reason like 'ad-%';

-- TTS calibration
create table if not exists public.media_tts_calibration (
  id bigserial primary key, lang text not null, voice text, words int not null, sec numeric not null, created_at timestamptz default now());
create index if not exists media_tts_calibration_lang_idx on public.media_tts_calibration(lang, created_at desc);
```
RLS: `media_jobs` owner SELECT unchanged (new columns visible to owner); writes via service role. `media_tts_calibration` service role only.

### 8.2 Routes

**`POST /api/poster/products/[id]/facts`** — draft. Request `{notes?: string, force?: boolean}`. Response `{facts: ProductFacts, photos: Photo[], missing_views: string[]}`. **`PUT`** — request `{facts: ProductFacts, confirm: true}` → validates (§3.4), response `{facts, facts_version, facts_confirmed_at}`. **`GET`** → `{facts, photos, facts_version, facts_confirmed_at}`.

**`POST /api/poster/products`** / `PUT` — accept `photos: [{url, view, role?, kling_element?}]` (≤6, must be under `media/poster/<uid>/`, ≥720 px short side else 400 `{error:"photo_too_small", index}`); `photo_url` = first `front` (or first) photo.

**`POST /api/media/ad-plan`** — request `{product_id, tier, length, lang, goal, audience?, tone, offer?, phone?, brandName?, notes?}`. Response:
```json
{"scripts":[{"script":{...T2 script...},"score":{"total":86,"scores":{...},"fixes":[]},"recall":{"sentence":"...","matches_promise":true,"matches_action":true},"gates":{"ok":true,"errors":[]}}],
 "questions":[],"budgets":{"wps":2.1,"per_scene_words":9,"total_words":36},"facts_version":3,"scenes":4}
```
Sorted by score. Also accepts `{scene_only: i, script}` to re-plan one scene.

**`POST /api/media/ad-score`** — `{script, product_id, lang, length, tier}` → `{gates:{ok, errors[]}, score:{total, scores, fixes}}`.

**`POST /api/media/tts-preview`** — `{text, lang, voiceStyle, product_id?}` → `{url, sec, words}`; rate limit 20/10 min.

**`POST /api/media/ad`** — request `{product_id, tier, length, lang (12 codes), goal, audience, tone, offer, phone, brandName, website, logoUrl, notes, script: {promise, headline, why, scenes[], cta, post_caption, features[4], voice, music, template}, voiceStyle, voice, captions, formats, variants, mode?, presenterPhoto?, testimonial?}`. Server re-runs gates (400 `{error:"gates", errors[]}`), freezes `facts` + `refs` from the product row, stores everything (including `cta, category, goal, audience, tone, notes`). Realistic: checks storyboard daily caps and balance ≥ animate cost (402 `{error:"insufficient_credits", need}`), inserts `{pipeline:2, phase:"storyboard", status:"queued", cost:0, mode}`; response `{id, phase:"storyboard", animate_cost: 40}`. Other tiers: charge as today, `{pipeline:2, phase:"animate"}`; response `{id, cost}`. One queued/running job per user (429); a `review` job does not block.

**`POST /api/media/ad/[id]/approve`** — `{}` → verifies `status=review`, `phase=storyboard`, every `storyboard[i].still.verdict==="pass"`; `spend_credits(uid, cost, 'ad-animate', id)`; PATCH `{cost, phase:"animate", status:"queued", stage:"clips", approved_at}` guarded `status=eq.review`. Response `{ok:true, cost}`; 402 / 409.

**`POST /api/media/ad/[id]/redraw`** — `{scene: i, note?: string, safe?: boolean}` → free if `storyboard[i].redraws===0`, else `spend_credits(1,'ad-redraw', id+":"+i+":"+n)`; PATCH `storyboard[i].redraw_requested=true, redraw_note, status:"queued"` (phase stays storyboard). Response `{ok, charged}`.

**`POST /api/media/ad/[id]/discard`** — `{}` → `status:"failed", error:"Discarded at storyboard"` (review + phase storyboard → nothing to refund; review + stage render_failed → full `grant_credits(cost,'ad-refund')`).

**`POST /api/media/ad/[id]/retry-render`** — `{}` → allowed when `status=review && stage=render_failed`; PATCH `{status:"queued", phase:"animate", stage:"clips", error:null}`; no charge.

**`DELETE /api/media/jobs?id=`** — extended: `queued|running` in animate phase → pro-rated refund (§7); storyboard phase → discard; `review` → discard.

**`GET /api/media/jobs`** — rows now include `pipeline, phase, stage, progress, mode, storyboard (stills urls + verdict + owner_summary), assets.clips[].fallback, charges, scorecard, feedback`; auto-discards `review` jobs older than 48 h (storyboard phase) on listing.

**Phase 2:** `POST /api/media/ad/[id]/redo-scene {scene, note}`, `POST /api/media/ad/[id]/reassemble {hook?, cta?, music?, template?, captions?}`, `POST /api/media/jobs/[id]/feedback {thumbs, reason, note}`.

### 8.3 Shared rules module
`src/lib/media/ad-rules.mjs` (plain ESM, zero deps; tsconfig has `allowJs`): `LANGS`, `LANG_RULE`, `WPS`, `scenesFor`, `perSceneWords`, `totalWords`, `beatSpine`, `CAMERA_WHITELIST`, `MOTION_BANNED`, `BANNED_CLAIMS_RE`, `countWords` (script-aware), `gates(script, brief, facts)`, `validateAdInput(input)`, `CTA_LABELS`. Imported by Next routes and by the worker via relative path; `deploy.sh` copies it next to `bridge/` if the worker cannot resolve `src/` on the VPS. **One source of truth, no TS/MJS twins.**

---

## 9. Worker changes

Keep: `ttsOnce`/`ttsLine` ladder, `fetchPhoto`, `ffArr`/systemd-run guard, `buildVo`, `captioned`, `reframe`, upload helpers, `renderScene` CTA card, variants rotation, presenter/testimonial engines, `processJob` (reels).

**New files**
- `bridge/prompt-builders.mjs` (pure): `buildStillPrompt(facts, shot, ctx)`, `buildStillPromptSafe`, `buildJudgePrompt(facts, shot, n, {pair})`, `buildClipJudgePrompt`, `buildKlingPrompt(facts, shot, {retry, escalate, failed_sentence})`, `buildKlingNegative(facts, shot)`, `buildShortenPrompt`, `ttsStyle(lang, voiceStyle, isCta)`, `glossaryLine(facts)`, `motionTruths(facts)`, `boundarySentences(facts)`. Tests `bridge/prompt-builders.test.mjs` (node:test) with the Wellwa fixture: in-use still prompt contains `output.action_positive`, every `must_show`, the BOUNDARIES block and "the sink tap is closed and dry"; safe prompt has no people and no water; Kling prompt contains exactly one whitelist camera phrase, "stays exactly as shown", one hero sentence, "The sink tap stays closed and still", 25–60 words, and **not** "Wellwa"; negative contains "faucet", "extra tap", not the bare word "text", and no "water" on a pour shot; static camera forced for liquid in-use shots.
- `bridge/qc-judge.mjs`: `judgeStill(refs, logo, candidate, facts, shot)`, `judgeStillPair(...)`, `judgeClipFrames(frontRef, frames, facts)`, `extractFrames(ffmpeg, mp4, [0.2,2.5,4.6])`, sharp resize ≤768, `responseSchema`, temperature 0, 1 retry on malformed JSON, honours `QC_ENFORCE` (shadow: log + annotate, never block).
- `bridge/kling.mjs`: adapter table §5(d), `submitClip({tier, still, prompt, negative, cfg, elements, falKey})` → `{request_id, status_url, response_url}`, `pollClip(request_id)`, `klingClip(...)` composing both with write-ahead callback; `generate_audio:false` always; cost recorded.
- `bridge/ad-stages.mjs`: `claim(job)`, `heartbeat(job)`, `sweepStale()`, `guardedPatch(job, patch)`, `setStage(job, stage, progress)` (throttled ≤1 write/5 s), `spend(job, kind, paise)` with `BudgetExceeded`, `charge/refund(job, reason, credits, ref)` writing `charges[]`, `putArtifact(job, localPath, key)`, `hydrateJobDir(job)`, `ensureLocal(url)`.
- `bridge/ad-caps.mjs`: constants §7.
- `bridge/qc-calibrate.mjs`: runs `judgeStill` over a labelled folder (`{file, expected:{usage_correct:false,...}}`), prints precision/recall per check.

**`bridge/realistic-engine.mjs`**
- Replace `sceneImage` with `generateStill({gemini, facts, shot, refs, logo, anchor, failed, corrections, ratio, safe})` on `IMG_MODEL` (`responseFormat.image`, fallback `imageConfig` on 400), refs normalised via sharp ≤1536 px with real MIME, up to 6 identity refs + logo + anchor + failed.
- New `renderStoryboard(job, helpers)`: scene 0 → judge → anchor; scenes 1..n−1 3-wide; attempt policy §6.4; uploads each still; returns `storyboard[]`; updates `progress` per scene; honours redraw requests (only flagged scenes) and `MAX_STILLS_PER_JOB`.
- New `renderClips(job, helpers)`: per approved still `klingClip` via adapter with write-ahead `pending`, clip QC, one retry (escalate/negatives/`end_image_url` rule), Ken-Burns fallback via `renderKenBurns`, per-clip trim `-ss 0.1 -t 4.8` before the existing overlay/scale step, then existing assembly (`sceneDur` = 4.4 s for non-last clips, last 4.8 s, CTA `max(3.5, sec+0.6)`).
- Delete the ionizer `SHOTS` table in pipeline 2 (keep for pipeline 1 until cut-over); no-plan fallback = `defaultShots(facts)` producing structured shots from category.

**`bridge/media-worker.mjs`**
- `tick()`: `sweepStale()`, then `claim()` the oldest queued `reel|ad`; dispatch `job.pipeline===2 ? processAdV2 : processAd`. Remove the boot-time blanket requeue after PR5 ships. `busy` released when a job enters `review`.
- `processAdV2(job)`: `runStoryboard(job)` (validate → tts with shortener + `atrim` + calibration rows → `renderStoryboard` → PATCH `storyboard, qc, status:"review", stage:"await"`; failure with `cost=0` → `failed`, no refund) and `runAnimate(job)` (`hydrateJobDir` → `renderClips` → variants/captions/reframe/upload as today → `done`; technical failure → `status:"review", stage:"render_failed", error`; Ken-Burns → `refund(ceil(cost/n/2),'ad-scene-fallback', id+":"+i)`). Template/presenter/testimonial with `pipeline 2` run `runAnimate` directly using the existing tier branches plus the new TTS gate.
- TTS: `ttsLine(line, wav, voiceStyle, lang, {facts, isCta})` passes the glossary to `nativeScript`, uses `TTS_STYLE[lang]`, pre-splits phone digits for CTA lines; a per-line failure in pipeline 2 throws.
- Fix `refund()` reason to `ad-refund` for `kind:"ad"`; fix the `kling:` boot log to read `FAL_KEY`; log `IMG_MODEL`, `KLING_MODEL`.
- Heartbeat timer around every vendor wait.

**`bridge/tts-script.mjs`**: `nativeScript(text, lang, key, {glossary})`; cache key `lang|glossaryHash|text`; 12-language `SCRIPT` unchanged.

**`bridge/ad-engine.mjs`**: CTA card — verb + number at ≥5% H, `offer` line, per-language pill labels (`CTA_LABELS`), hold ≥3.5 s; new `renderKenBurns(stillPath, outMp4, {W,H,sec:5})` (zoompan 1.0→1.06, 24 fps, yuv420p); keyword card band at 30–35% H when `captions==="off"`.

**`bridge/caption-engine.mjs`**: `perGroup` 3 (Indic) / 4 (Latin), ≤32 chars per group, never split a digit run, baseline 0.62·H.

**`bridge/presenter-engine.mjs`**: unchanged rendering; monologue now = `[...scenes.text, cta.text]` with the CTA spoken; CTA card shows `cta.text` (fixes the "first three lines of the monologue" bug).

**Ops**: `deploy.sh` restarts `neuraledge-media` (known gap), sets `node --max-old-space-size=640`, copies `ad-rules.mjs` if needed; env `IMG_MODEL, KLING_MODEL, KLING_ESCALATE, KLING_LEGACY, QC_ENFORCE, QC_AUTO_ALLOWED, KLING_DAILY_CAP, AD_PIPELINE_V2, AD_PIPELINE_V2_USERS` (comma-separated owner ids for the side-by-side window).

---

## 10. UI changes

**`src/app/poster/video/page.tsx`** (rewrite; English-only strings)
- Components: `ProductPicker` (facts status chip, "Confirm now"), `FactsSheet` (Screen A2, reused from products page), `TierCards` (with credits per length), `LengthGrid`, `LangSelect`, `DefaultsLine` + `ChangeSheet`, `ScriptCards` (angle badge, promise, score pill Ready/Amber, why line, per-scene rows with word/char meters, caption-card preview, ▶ hear, Edit lines, 3 more hooks), `StoryboardGrid` (tiles: still, line, caption, ✓/⚠ badge with `owner_summary`, Redraw/Edit scene/Use safe shot, Voice ✓ line, End card preview, cost card, Animate/Discard, Cancel during animate, Retry render/Discard on render_failed), `JobRow` (stage text, progress bar with ETA, Cancel, storyboard thumbnails, fallback note, thumbs).
- States: `screen: "brief"|"facts"|"scripts"|"storyboard"|"history"`; `plan: {scripts[], selected}`; `job` polled every 4 s while `queued|running`, every 15 s while `review`.
- `editJob` re-hydrates from `input` (now including `cta`, `script`, `facts`, `product_id`).
- Copy strings are exactly those in §2.

**`src/app/poster/products/page.tsx`**: multi-photo picker (≤6) with view chips (Front · Three-quarter · Back · Output close-up · Installed · Packaging · Other), "Product facts" button → `FactsSheet`, confirmed badge, `missing_views` nag ("Add a close-up of the outlet hose — the part the AI gets wrong most often"). **`src/app/poster/photoshoot/page.tsx`**: "Save to product photos (as generated)" per shot.

**`src/lib/media/ad-defaults.ts`**: `defaultsFor(product, profile, facts, history)` → `{goal, lang, length, tier, tone, voiceStyle, music, template, formats, captions, variants}` with the tier rule from §2.

---

## 11. Implementation order (PR-sized, each deployable) and test plan

| PR | Scope | Test |
|---|---|---|
| **PR0 — Phase 0 bug fixes** | `ad/route.ts`: store `cta, category, goal, audience, tone, notes`; accept all 12 `lang`; `scenes.slice(0,6)`, `script.slice(0,7)`, `features.slice(0,4)`; worker L886 `lines = [...scenes.text, inp.cta || script[n]]`; refund reason `ad-refund`; `kling:` log → `FAL_KEY`; `uploadStudioRef` path `studio-refs/<uuid>.<ext>`; presenter monologue includes CTA; `deploy.sh` restarts `neuraledge-media`; `DELETE /api/media/jobs` extended to `review`. | Create a 30 s realistic job from the UI → job input has 6 scenes + 7 script lines + `cta`; Tamil plan stored as `ta`; a failed ad job refunds with reason `ad-refund`. |
| **PR1 — Schema + rules** | Migration 0044; `ad-rules.mjs`; `product-facts.ts`; `product-defaults.ts` (real category keys); `ad-caps.mjs`; `ad-pricing.ts` helpers. | node:test: `scenesFor`, `perSceneWords`, gates G1–G11 against the Wellwa script A (pass) and mutated copies (each gate fails exactly once); migration applies on a copy of prod. |
| **PR2 — Product facts** | Facts routes (T1 draft/confirm), products route `photos[]`, upload 720 px check, products page FactsSheet, photoshoot "Save to product photos", photoshoot `IMG_MODEL` → 3.1. | Draft facts for the Wellwa product from its 4 photos → `output.part` mentions the hose, `must_not_show` includes tap; confirm bumps `facts_version`; `missing_views` correct. |
| **PR3 — Builders + judge + adapter (shadow)** | `prompt-builders.mjs` + tests; `qc-judge.mjs`; `kling.mjs`; `qc-calibrate.mjs`; one paid call per endpoint (`v2.6-pro`, `v3-pro`, image model with `responseFormat` then `imageConfig`) logged in a `bridge/ENDPOINT-CHECKS.md`. Judge runs in shadow on the existing pipeline's stills (annotates `qc[]`, blocks nothing). | Builder tests green; `qc-calibrate` over ≥30 labelled stills incl. the faucet render → precision/recall ≥0.9 on `usage_correct`; adapter returns a clip from each endpoint. |
| **PR4 — Planner** | `ad-plan` (T2, gates, T2b, T9, T10; `product_id`), `ad-score`, `tts-preview`, `ad-hook` (T11), worker variants prompt (T11). | Plan for Wellwa/hinglish/20 s realistic → 3 scripts with 3 angles, all ≤9 words per line, no brand in hook, scores present; plan for a dentist (service, `output:null`) → no `in_use` water actions, banned "100% painless" rejected by G6; plan for kirana with offer "10 kg atta ₹399" → number 399 allowed only because it is in `brief.offer`. |
| **PR5 — Worker stage machine (flagged)** | `ad-stages.mjs` (lease/heartbeat/sweepStale/guarded/write-ahead), `processAdV2`, `renderStoryboard`, `renderClips`, Ken-Burns, TTS gate + atrim + calibration, glossary, `TTS_STYLE[lang]`, caps, `pipeline` dispatch; enabled only for `AD_PIPELINE_V2_USERS`. | Worker restart mid-Kling → job resumes by polling the stored `fal_request_id` (no second submit in fal dashboard); kill worker mid-stills → stale sweep requeues, passed stills reused from storage; forced TTS failure → job fails before any fal call; forced clip QC fail twice → Ken-Burns + half-share refund row. |
| **PR6 — Job API** | `ad/route.ts` (cost 0 storyboard, caps, balance check, freeze facts), approve/redraw/discard/retry-render, jobs GET/DELETE pro-rated. | Approve on a job with a `needs_owner` scene → 409; approve with insufficient balance → 402 and status unchanged; redraw twice → second charged 1 credit; cancel with 2 of 4 clips accepted → refund 20 of 40. |
| **PR7 — UI** | video page rewrite (Screens A/A2/B/C/D), English-only. | Manual walk-through on phone width: pick product → scripts → storyboard within 150 s → Animate → video; every string English; Animate disabled until all tiles ✓. |
| **PR8 — Captions/CTA/presenter polish** | caption-engine groups/baseline, CTA card verb+number/offer/12 labels, presenter CTA fix. | Render a Tamil template ad → CTA pill in English fallback, captions in 3-word groups, phone number never split. |
| **PR9 — Rollout** | `QC_ENFORCE=1`; `AD_PIPELINE_V2=1` for all; delete `SHOTS` + legacy realistic branch after one week of side-by-side numbers (cost per accepted clip per endpoint from `charges`/`vendor_cost_paise`, failure rate). Phase 2: redo-scene, reassemble, feedback route. | Query: `select avg(vendor_cost_paise)/count(clips accepted)` per endpoint; failure rate < legacy. |

### Test plan (end-to-end, owner's account)

1. **Ionizer tap case.** Product Wellwa (facts §3.5). (a) Unit: `buildStillPrompt` for scene 2 contains "the sink tap is closed and dry" and "the unit is the only source of water"; `buildKlingNegative` contains "faucet"; `buildKlingPrompt` has no "Wellwa". (b) Judge: the archived faucet render (`ad-last-failed`) → `usage_correct:false`, `no_forbidden_objects:false`, verdict `retry`, `fix_instruction` mentions the outlet hose. (c) Pipeline: run the 20 s hinglish storyboard twice; assert no passed still shows a running tap (manual), every tile carries an `owner_summary`; force a tap still by injecting the archived render as attempt 1 → edit-mode attempt 2 runs with CORRECTIONS; Animate → every clip QC passes or degrades to Ken-Burns with refund; final ad: water only from the hose; brand chip overlaid; captions 3-word groups; CTA ≥3.5 s.
2. **Dental clinic (`dentist`, service).** Facts: `output:null`, `hands:"operating"`, banned "100% painless". Plan (question angle expected among 3): G6 blocks "100% painless"; shots have `in_use` scenes with the dentist at the chair; still prompt has no water/boundary lines about output, judge `usage_correct` always true; `no_text` catches legible fee charts; template tier path (default for services) charges at creation, no storyboard pause.
3. **Kirana retail offer (`kirana`, goal offer, 12–20 s).** Offer "10 kg atta ₹399 till Sunday". Plan: bold_number hook "Sirf 2 din: 10 kg atta ₹399…" passes G7 (399, 10, 2 from offer/brief); CTA carries the phone; realistic storyboard: judge `no_text` fails a still with a legible price tag → edit mode; caption card "10 kg ₹399" ≤32 chars; TTS reads the phone in digit pairs.
4. **Regression:** reels (`processJob`) untouched; presenter ad speaks the CTA; a 60 s template ad keeps 6 scenes + CTA; Tamil ad stored as `ta` and CTA label English.

---

## 12. Open questions for the owner (recommended defaults)

1. **Free storyboard requires balance ≥ animate cost?** Recommended **yes** — keeps storyboards free for paying users while closing the "free AI photoshoot for zero-balance accounts" leak; the button reads "Storyboard: free · Animate later: 40 credits (you have 120)".
2. **Kling default endpoint: switch to 2.6 Pro now, or stay on 2.5 Turbo Pro until one week of side-by-side data?** Recommended **2.6 Pro** after the one paid verification call (same price, best documented SKU fidelity, `KLING_LEGACY` fallback one env flip away).
3. **Realistic surcharge if v3 escalations exceed ~15% of clips?** Recommended **none now**; revisit with `vendor_cost_paise` data after 50 realistic jobs.
4. **Auto mode (skip the storyboard approval) — offer at all in v1?** Recommended **off** (`QC_AUTO_ALLOWED=0`) until `qc-calibrate` shows ≥0.9 precision on `usage_correct`; always paused for a product's first job and on any third attempt.
5. **Ken-Burns fallback refund: half of the scene's credit share (recommended, e.g. 5 of 40) or the full share?** Recommended **half** — the owner still receives a finished, correct scene; a paid "Redo scene N" (Phase 2) gives the full-video option.