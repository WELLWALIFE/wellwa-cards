# Shubhora — hand-off for a new Claude Code session (desktop)

Read this first. It is the state of the project on 12 Oct 2026, written for a session running on the owner's Mac.

## The owner and how to talk
- Owner: Shubhora (Wellwa Life), writes Hinglish; **reply in Devanagari Hindi** with everyday Hinglish words
  (प्राइस, डिलीवरी, डिटेल्स), brand/model/app names in English letters. Short, practical, no pure Hindi.
- The owner is not a developer. Give commands ready to paste. The Mac user is **not a sudoer**.
- **Every text in the app: short and simple** (owner, 24 Oct 2026: "customer badi mahabharat nahi padhta"). One short line, not a
  paragraph; ticks instead of explanations; no "how it works" essays on a screen. Applies to every new screen and every change.
- **Ask for the least data that works** (owner, 24 Oct 2026: "jitana kam se kaam chal sake utana kam data lena chahiye"). If the AI
  can work it out (buyers, about text) or it can be added later (offer, GST, timings), it is not asked in set-up.
- **Show every change on screen at once** (owner, 24 Oct 2026: "jo change kar raha hai usko sath ke sath dikhana chahiye"). Wherever
  the owner picks a colour, font, banner, text or photo, a live preview on the same screen updates as they tap — no Save-then-open.
- **The flow, start to finish** (owner, 24 Oct 2026: "ek step complete ho to next jiski jarurat hai wo hi aaye"). Set-up: About you →
  Website? → Your business → About your trade → Make (Free / Standard). After the build: Design → Colours → Link → Ready (a 4-step bar on
  each). Then "Website पूरी करें" (/poster/site/next, lib/site-finish.ts): Products → Photos & banner → Map & timings → UPI & social →
  Reviews → Google, one step on screen, ✓ when the card shows it, "बाद में" to skip, "हो गया, आगे" on list pages. Products are NOT in set-up.
- **Every page: a premium, professional look** (owner, 24 Oct 2026: "sabhi page ka look premium chahiye", "professional look banao").
  Rounded cards with a soft shadow, a gradient head where it fits, big clear tiles, compact fields. A form screen fits one phone
  screen with no scroll where possible. Optional fields stay closed behind a tick box and open only when ticked
  (e.g. "WhatsApp number अलग है", "एक और number जोड़ें" on About you).
- **Set-up: "Who is this website for?" is part of the website screen** (owner, 24 Oct 2026: "dono page ko mila kar ek"). Partners see
  three chips (My business / Shubhora / Both) on top of "Do you have a website?"; Shubhora hides the website rows. The old "promote"
  step key is always skipped and redirects to "site".
- **Set-up is 4 screens + Make** (owner, 24 Oct 2026: "minimum steps, easy steps"): About you → Website → Your business (logo, name,
  work, city, address, map pin) → About your trade (taps; ticks open hours/delivery and since/post/degree) → Save → Make.
  "Where & when" and "About & logo" are `later` (edit screens only); the AI writes the About in the background (Next on Your
  business, one more try on Save). The sub domain is not asked in set-up: the "Select your domain" screen (`DomainPick`,
  components/poster/domain-pick.tsx, after Colours and fonts, before Congratulations) offers the two free links, a typed one, and the own domain inline.

## Where things are
- Repo on the Mac: `/Users/jsrao/Desktop/Wellwa Life/wellwa-cards`
- Branch: `claude/dreamy-faraday-0864zl` (all work lives here; `main` is behind). Always commit and push here.
- Deploy (from the Mac):
  `cd "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards" && git pull origin claude/dreamy-faraday-0864zl && bash deploy.sh`
  deploy.sh rsyncs to the server, builds, restarts pm2 `neuraledge-app`, restarts the WhatsApp bridge
  (`neuraledge-bridge`) when `bridge/` changed, installs cron jobs (`/etc/cron.d`).
- Server: `root@148.72.247.91`, app at `/opt/neuraledge/app`, env in its own `.env.local` (never synced).
  Logs: `pm2 logs neuraledge-app`, `pm2 logs neuraledge-bridge`.
- Live site: https://shubhora.com. Supabase: migrations in `supabase/migrations/` (0001–0067 all run by the owner).
- Local dev: `npx next dev -p 3103` (stop with `fuser -k 3103/tcp`). Checks: `npx tsc --noEmit -p .`,
  `npx eslint <files>`, `node --check bridge/index.mjs`, full `npx next build` before a risky deploy.
  Mock walk: `scripts/trade-check/setup-walk.mjs` with fake Supabase env.

## Stack in one paragraph
Next.js 16 App Router + TypeScript + Tailwind. Supabase (auth admin API, PostgREST via `restAsService` /
`restAsUser` in `src/lib/supabase-rest.ts`, storage bucket `media`). Gemini via `geminiComplete` (`src/lib/gemini.ts`),
Gemini Live for phone. Two WhatsApp paths: **Cloud API** multi-tenant webhook (`src/app/api/whatsapp/webhook/route.ts`
→ `src/lib/wa-cloud.ts`; Shubhora's own number → `src/lib/wa-onboard.ts`) and the **linked-device bridge** (Baileys,
`bridge/index.mjs`, pm2 `neuraledge-bridge`). Shared AI prompt: `src/lib/wa-ai.ts` (`buildSystem`), language rules
in `src/lib/ai-training.ts` (`replyLanguage`, `languageLock`, `HINDI_STYLE`).

## What was built in Oct 2026 (all pushed; owner deploys)
- WhatsApp → website bot (`src/lib/wa-onboard.ts`, docs/whatsapp-onboard.md). Needs owner setup: Shubhora Cloud
  API number connected in CRM → Integrations, server env `WA_ONBOARD_OWNER_ID=<that account's uuid>`.
- AI salesman: `[[ORDER: {...}]]` tag → lead + booking + owner notify + UPI/WhatsApp/Call buttons
  (`src/app/api/chat/[username]/route.ts`, `src/components/card-chat.tsx`, `src/lib/wa-cloud.ts`).
- Bookings + reminders (`src/lib/bookings.ts`, `bookings-server.ts`, `/api/bookings`, cron
  `/api/cron/booking-reminders` every 15 min, UI `src/components/poster/bookings.tsx`).
- Weekly WhatsApp report (cron Mon 04:00 UTC), follow-up engine, review collector (`src/lib/customer-send.ts`),
  festival wishes (`src/lib/festivals.ts`, cron 03:30 UTC), offer-to-everyone, city directory (`/in/...`).
- Starter ₹999 plan (`SaasTier = starter|growth|pro`, migration 0066).
- One-button Cloud API connect = Meta Embedded Signup (`src/app/api/wa-cloud/embedded/route.ts`,
  docs/whatsapp-embedded.md). Needs `NEXT_PUBLIC_META_WA_CONFIG_ID`, `META_APP_ID/SECRET`, App Review.
- AI phone receptionist (`bridge/phone-worker.mjs`, pm2 `neuraledge-phone` via `ecosystem.config.cjs`,
  docs/phone-receptionist.md). Needs Exotel number + Apache `ProxyPass /phone/stream ws://127.0.0.1:8790/stream`
  + `phone_lines` row. Not yet set up by the owner.
- Admin: change a user's login mobile, search users by mobile.
- Bot "own website" + bot files (brochure photos, PDFs, YouTube demo link) on Create → Card & Website
  (`src/components/poster/bot-site-box.tsx`; `card.botSite`, `card.botFiles` in `src/lib/types.ts`).
  Bot sends the owner's site (alkafresh.in for the 8708275430 account), never the card page, when set.
- Language policy: Hindi (Devanagari, Hinglish words) for every customer until they ask for another language.
- Demo video: `botFiles` kind `link`; shared on demo talk (`ensureDemoLink` in wa-ai.ts, `ensureDemo` in bridge).

## Open items (owner's list)
1. Deploy the latest commits (last pushed: cba0af2) and test per the checklist the owner has.
2. Owner setups above: Shubhora Cloud API number + `WA_ONBOARD_OWNER_ID`; Embedded Signup; Exotel phone line.
3. "Owner-style training" of the bot — owner said do this LAST ("training baad me").
4. Offered, not decided: "AI से बात करो" WebRTC voice button on the card (voice without Exotel).
5. **CRM Pro (owner, 21 Oct 2026: "professional CRM — direct call, sab kuch wahi se").** Spec in `docs/crm-pro.md`. **Phase 1 is built
   (22 Oct 2026, not yet deployed/tested live):** `/poster/crm` (Today · Customers · Calendar · Reports · Settings; the bottom tab points
   here, `/poster/leads` keeps Bookings/Phone/WhatsApp/Teach bot), `src/components/crm/{i18n,shared,call,tasks,customer,list,today,settings}.tsx`,
   `src/lib/crm-pro.ts`, routes `/api/crm/{today,leads,lead/[id],tasks,calls,automations,workspace}`, migration **0068** (owner must run it
   BEFORE deploying: leads columns, crm_tasks, crm_calls, triggers, backfill of follow-ups into tasks), `bridge/crm-reminders.mjs` now
   reminds per task. Tap-to-call: `tel:` + outcome sheet on return (sessionStorage `akp-crm-pending-call`); call list; follow-up = task
   (`leads.next_follow_up` mirrors the earliest open task by trigger). **Phase 2 is built too (22 Oct 2026, same status):** Exotel click-to-call
   (`/api/crm/call`, callback `/api/phone/status?k=CRON_KEY`, `bridge/call-recordings.mjs` hourly via pm2; needs EXOTEL_SID / EXOTEL_API_KEY /
   EXOTEL_API_TOKEN / EXOTEL_SUBDOMAIN in server env and a `phone_lines` row with `outbound=true`, `caller_id` — until then the app dials with tel:),
   desktop two-pane Customers, bulk actions (`/api/crm/bulk`: assign / stage / tag / WhatsApp to a selection), Automations (owner_prefs.crm:
   auto task on new lead + round-robin as DB triggers in **migration 0069**, birthday/anniversary wish + "going cold" nudge + daily 8 pm summary
   via `/api/cron/crm-daily` → `scripts/crm-daily.sh`, cron.d written by deploy.sh), Reports v2 (`/api/crm/reports`). Owner runs 0068 then 0069,
   then deploys, then `pm2 start ecosystem.config.cjs --only neuraledge-recordings && pm2 save` on the server. **Phase 3 built (22 Oct 2026):** migration **0070**
   (crm_sales, crm_quotes, crm_next_quote_number, crm_merge_leads), `src/lib/crm-pro3.ts`, routes `/api/crm/{duplicates,merge,sales,quotes,products,leaderboard}`,
   `src/components/crm/sales.tsx` (customer Sales tab: new sale — Won asks "what was sold", quotation → A4 PDF via `htmlToPdf` in render-page.ts on the
   server's Chromium → sent on WhatsApp through /api/crm/send; Accepted makes the sale), Settings → duplicates merge + phone-contacts import (Contact Picker,
   Android), Reports → leaderboard. Left from the spec: saved segments, scheduled WhatsApp tasks, Meta Lead Ads direct, Android dialer-role call log.
6. Meta App Review (docs/meta-app-review.md): 7 of 11 permissions complete on 21 Oct 2026; pending = Meta's test-call data (24 h),
   screencast Video 2 for the three comment permissions, a `metareview` test login, Submit. FB + Instagram auto-reply was switched OFF
   on 21 Oct for the recording — switch it ON again after Video 2. Details in docs/crm-pro.md section 11.
7. Own domain fully automatic — LATER (owner, 24 Oct 2026: "baad me karege"). Today DomainConnect detects the DNS host and shows
   its steps; the owner adds 2 records, then SSL + go-live are automatic. Options discussed: (a) buy the domain inside the app via a
   domain reseller (100% automatic, margin; owner to choose the reseller and the price), (b) the Domain Connect standard / a paid
   aggregator for existing domains at big registrars, (c) never ask users for registrar passwords or API keys.

## Code review, night of 22 Oct 2026
Full review (CRM, money/auth/admin, WhatsApp/AI/bridge, public site, member app, workers). ~45 bugs fixed; tsc, eslint, bridge tests and a
production build pass. Owner must run two new migrations in Supabase (both safe to re-run): **0071_crm_fixes.sql** (merge keeps an empty
last-message date instead of 1970) and **0072_payment_safety.sql** (apply_saas_payment locks before its replay check; unique purchase ref
in credit_ledger). New bridge file `bridge/url-guard.mjs` (server-side fetches refuse private hosts). Left open on purpose: unsigned Cloud
webhooks for manual accounts without app_secret; automated bridge sends mute the bot 15 min; festival-wish cron too slow for 150/owner;
chat route may join two visitors' leads (needs a conversation id).

## Advanced website (Rs 5,999)
Owner's new segment (15-16 Oct 2026): an AI review of the finished site, redesigned with a layout different for every business.
- Flags (server env, both default off; documented in `src/lib/advanced-access.ts`): `ADVANCED_SITE_OPEN=1` = reviewers use it
  free; `ADVANCED_SITE_SELL=1` = the Rs 5,999 order may be created. Without SELL the order POST answers 503 `advanced_closed`
  (owner flips it after reviewing the feature; never charge for something half-built).
- Files: `src/lib/advanced-access.ts` (price, `isAdvancedAllowed`, `grantAdvanced`), `src/app/api/poster/pay/advanced/route.ts`
  (GET status; POST {} order; POST {orderId,paymentId,signature} verify). Feature files: `src/app/api/card/advanced/`,
  `src/components/site-adv/`, `src/lib/site-advanced*.ts`.
- Flow: order amount fixed server side (599900 paise, notes user_id + product `advanced-site`) → Razorpay checkout → verify HMAC,
  re-fetch the order, check user/amount/product, then auth `user_metadata.advanced_site = {paid, paymentId, at, triesLeft:3}`.
  Idempotent: an already-paid account is not re-granted. A zero-delta `credit_ledger` row (reason `advanced-site`, ref paymentId) is the audit.
- Unverified: no live Razorpay run (order, signature, metadata write via admin PUT merge); `triesLeft` is set but decrementing is
  the redesign route's job; no client checkout UI for this product yet; ledger insert untested against RLS/constraints.

### The advanced website is a whole website (16 Oct 2026)
Owner's test of the first version: "looks nice but you made only ONE page; make it perfect and COMPLETE". It is now a multi-page site
that replaces the blueprint on EVERY page of a card with a valid `site.advanced` (not only home).
- Pages: Home (sections in `spec.order`, each in the variant the spec names), the catalogue (Products / Menu / Services / Packages,
  named per trade by `catalogLabel`; search, category chips, price sort, four item-card layouts), an item's own page at `/p-<slug>`
  (products AND services; three layouts chosen from the item: shop, dish, offer), About, Gallery, Contact (big number, enquiry form that
  is a real lead, map card, live timings), Updates when the card has posters, and the card's other pages (FAQ, admissions, custom) drawn block by block.
  About and Gallery are added at request time when the card has the material but no such page (`withAdvancedPages`); each item also gets a
  hidden stub page (`advancedItemStubs`, pass its slugs as `unlisted`) so every item opens without a reload.
- Shell (`nav.tsx`): announcement + offer strips, header that condenses on scroll (layout picked from the spec seed), full-screen menu on
  phones, progress hairline, breadcrumbs, phone action bar, footer variant, chat/popups/Shubhora strip. Motion (`motion.tsx`) is CSS first,
  starts from the finished look, so reduced motion / no-JS / print show the finished page.
- Files: `src/lib/site-advanced.ts` (spec, `activeAdvanced`, `withAdvancedPages`, `advancedItems`, `findAdvancedItem`, `advancedItemStubs`,
  `pageRole`, `livePages`), `site-advanced-archetypes.ts` (327 archetypes / 34 trade groups, `specFromSeed`), `site-advanced-ai.ts` (the redesign
  engine; unchanged by the multi-page work). Renderer `src/components/site-adv/`: `index.tsx` (AdvancedSite, home composition), `pages.tsx`
  (routeOf + AdvPageBody), `nav.tsx`, `theme.ts` (palettes, 12 font pairings, shape language), `motion.tsx`, `registry.ts` (variant ids
  -> components; never rename or reorder an id, stored specs name them), `shared.tsx`, `content.ts`, home variants (`heroes`, `abouts`, `about`,
  `basics`, `catalog`, `proof`, `proof-more`, `close`), page files (`page-catalog`, `page-more`, `page-parts`, `product`, `contactpage`).
- Hooks: `src/components/site-view.tsx` renders `AdvancedSite` whenever `activeAdvanced(card.site, username)` is set, passing `page={active}`;
  public route `src/app/c/[username]/render.tsx` (`loadCard` adds the About/Gallery pages, `itemAt` resolves a service as well as a product,
  a phone gets the website not the card when advanced); `/preview/site` (`view.tsx`) does the same from localStorage and takes `?page=<slug>`.
- Flags: `site.advancedOn === false` shows the basic site (both designs stay stored); no flag = on. Server env flags are above (OPEN / SELL).
  Basic renderer and the six basic blueprints are untouched and still render (checked 16 Oct 2026).
- QA: `node scripts/check-advanced.mjs` (5,800 checks: garbage specs, 40 fake cards, registry ids, archetype library, SSR of 28 pages, AA
  contrast of every palette). Visual: put a full card (a trade template + `specFromSeed(card)` as `site.advanced`) in localStorage and open
  `/preview/site?k=<key>&page=<slug>&lang=hi|en&shot=1` at 1440x900 and 390x844 with puppeteer-core and Chrome.
- Known gaps: (1) [fixed 16 Oct 2026] `src/app/sitemap.ts` now lists the About/Gallery pages and every product AND service page of an advanced card. (2) The public `/c/<username>` route was not exercised
  end to end (the dev DB has no advanced card; routing, item lookup and the advancedOn flag were checked on the same functions in Node and
  the page itself through /preview/site). (3) Photos are what the card holds: trade-template sample photos are generic stock and often do
  not match the trade (a water purifier site showing a jeweller's shop) until the owner uploads real ones; the layout does not hide that.
  (4) Hindi: the card's own text (names, descriptions, page labels) is translated by `/api/translate/<username>`, which a preview or demo
  user does not have (404), so those lines stay English in the preview; all fixed UI text is bilingual. (5) Tap targets: a few secondary text links are under 44px on phones (the breadcrumb "Home" / "होम" is 18px wide, a footer "Visit" 26px, item-title links inside cards that also have a larger arrow button). (6) The redesign is still
  closed by default (flags above); no live Razorpay run.

## Flexible payments (1 Nov 2026)
Owner: "payment Standard package se alag ho sakti hai — admin / franchise payment link banaye; user khud bhi advance / booking de paaye, admin
ko kuch na bhejna pade". Migration **0079** (`payment_requests`, `advance_ledger`, `apply_flex_plan(N months)`, `use_advance_for_plan`,
`advance_balance`; tested on local Postgres). `lib/payments.ts` (shape, labels, link) + `lib/payments-server.ts` (create / settle / balance).
- A request = kind `plan` (tier growth|premium × months, ANY amount) | `advance` (money kept on the account) | `custom` (recorded only), with a
  link `/pay/<code>` (`app/pay/[code]`, must be logged in as that account). `/api/pay/[code]` GET/POST order+verify; Razorpay notes `flex=<code>`;
  the webhook settles `payment.captured` with that note if verify never came. settleRequest: claim by unique payment_id → apply (plan: rpc +
  grantAdvanced for premium + partner BV; advance: ledger) → franchiseEarning → notify. Idempotent ("replayed").
- Admin v2: right `payments.request` (franchise role has it, scope applies) → `/admin/payments` (list, New link with user search, cancel) and
  "₹ link" on each Users row (`components/admin/payment-request.tsx`: plan / advance / custom, list price shown with % off).
- User: plan page `FlexPayments` — requests waiting (pay here), advance balance (+ "Standard N months" from balance when enough, rpc
  use_advance_for_plan), "Pay a different amount" (own advance request, ₹100+). Premium cannot be taken from balance (its first month is a mandate).
- Not run against live Razorpay yet (no real money through the new routes). Needs 0079 in Supabase before deploy.

## The app on a computer (1 Nov 2026)
Owner: "desktop par website ki tarah khule, mobile par app ki tarah". Below 1024px nothing changed (phone column, bottom tab bar). At lg:
`components/poster/nav.tsx` draws a 260px sidebar (logo, the five sections, Quick open, and the account foot = the phone's round account
button: settings, plan, connections, share links, language, log out); `app/poster/layout.tsx` + `globals.css .app-shell` turn the column into
a 1040px page beside it, scoped with `:has(.app-side)` (the start screen keeps the phone column); `[data-topmenu]` is hidden at lg; fixed bars
carry `.app-bar` (follow the page column) / `.app-bar-up` (drop to the foot) / `.app-pin` (demo pill). Two-column pages at lg: Home (poster
right, sticky), Card & Website (boxes in two columns), Website edit (preview left tall via `--pv-h`, controls right), Premium page (design left,
controls right; the frame scales to the measured box height), Create (3 tiles a row). Other screens are the phone layout at page width — if
one reads badly on a computer, give it its own lg layout the same way.

## Advanced features (add-on modules, 30-31 Oct 2026)
Modules customised for one kind of business and paid separately (`src/lib/addons.ts`: ADDONS — Orders · Silai first; `addons-server.ts`:
flags in auth `app_metadata.addons`, `premiumActive`, `fitsBusiness`, `addonGate`; Super Admin → Users → "🧵 Orders" toggle). The box
(`components/poster/advanced-features.tsx`, on Card & Website and Settings) is shown to EVERY account whose business fits (owner, 31 Oct 2026:
Standard and Premium both see it); three states per module: ON → open; Premium but off → "ask the price" (WhatsApp) + guide; not Premium →
"Upgrade to Premium" (→ /poster/site/advanced) + guide + price. Using a module still needs the flag ON (addonGate). Guide: `/help/orders`.
Premium page (`/poster/site/advanced`): fold "Font · top of the page · corners" under the three designs, sent as `tweak` with accept.
`AdvancedEntry` on the congratulations screen turns into the loud "Make my Premium website now" when Premium is paid and no design exists.

## Orders · Silai — easier counter (1 Nov 2026)
Owner: "aur easy aur professional". `src/lib/jobs.ts`: `JobSetup.dueDays` (usual delivery time, default 7; `ItemType.days` per item; `daysFor`),
`isLate / isDueToday / isPending / balanceOf / fmtDay / isoPlus`. New order: mobile first → `/api/jobs/measurements?phone=` also answers
`customer` (name, orders, last, pendingPaise) → name autofills; photos of the cloth per item (`JobPhotos` in orders-common, `uploadImage(…,"wide")`,
saved in `job_orders.photos`, only the uploader's own media); the date starts at the shop's days (item days win until set by hand). List: tabs
Today (due today + late, red) · In work (steps as sub-chips) · Ready · Payment due · Delivered · All, a 3–4 tile "today" strip, late first
(`/api/jobs?view=today|pending`, counts today/late/pending/pendingPaise). Job card: photos, "Print tag", hand-over asks for the balance first
(`PATCH status delivered + collect` → payment event then the move), a reminder when delivered with money still due. `/poster/orders/slip?ids=…`:
printable tag / full slip per job (measurement on it). Setup: usual days (shop + per item).
Undo (owner, 1 Nov 2026 "galat ho jaye to"): a cancelled job can be deleted (`DELETE /api/jobs/[id]`, "cancel" right) or brought back
("edit"); a payment is reversed with a minus line (`PATCH undo {event_id}`, "money"); a note / cloth line is removed ("edit" or its writer);
a karigar is edited / deleted when no job is with them (`DELETE /api/jobs/karigars?id=`); a measurement not on any job is deleted
(`DELETE /api/jobs/measurements?id=`). Speed: flags / setup / names / shop name are remembered in-process (one pm2 app process), see jobs-server.ts.

## Brand + Month plan v2 (2 Nov 2026)
Owner, after looking at a content app (Scalio) from inside: "copy nahi karna, us se best banana hai" — chose "brand setup + month plan" in one go.
Migration **0083** (`poster_calendar.brief jsonb`, day kinds + tip / trust / about) must run before deploy.
- `lib/brand-plan.ts` (isomorphic): TONES, FOCUS, DAY_KINDS + KIND_TEXT, DayBrief + cleanBrief, palette presets, `brandReady`.
- Brand lives on the poster profile: `layout.accent / palette / tone / audience / usps` (+ name, tagline, lang, category, city, logo);
  photos in `card_facts.photos`. `/api/poster/brand` GET (`?suggest=1`: logo colour + AI tone / audience / USPs / tagline, only fills
  empty fields) and POST. `cleanLayout` in /api/poster/profiles keeps tone / audience / palette. Page `/poster/brand/setup` (website
  "Read" via /api/site/peek, logo, colours, tone, language, customers, why-us, photos, live preview tile; "Plan my month").
- `lib/content-plan.ts`: `brandSnapshot`, `suggestBrand`, `draftMonth` (two parallel gemini calls, one per half month; every posting
  day gets overrides.title / sub / custom for the POSTER + brief caption / hashtags / hook / why; festivals from the engine's occasions;
  only the owner's products and offers — nothing invented; anything the AI misses falls back to the old weekly mix), `redraftDay`.
- `/api/poster/calendar`: actions `plan` (8/day), `post` (owner edits words / kind / product / style / voice / music; clears that day's
  stored caption), `redo` (new idea with the owner's hint, 60/day); GET returns brief + the month's posters + planReady.
- The plan reaches the output: Signature posters now draw `layout.title / sub` (engine); the file name carries a hash of the day's words
  (changed words = new poster); the caption writer takes the day's brief as written (+ phone / card-link footer) and the brand's tone /
  audience otherwise — in the 4 AM auto-post (`prepareDay`, reads without `brief` until 0083 runs) and the app's posting (`ensurePosterCaption`).
- Free accounts may preview the first three planned posts (`/api/poster/today?preview=1&sample=1`, watermarked, never saved or posted).
- `/poster/calendar` rewritten: brand strip, plan card (focus chips, posts a week), stats, "Next 3 posts" previews, list + calendar grid,
  post sheet (real poster preview, heading, line, offer line, caption with copy, hashtags, why, New idea, style / voice / music), offers.
  Create → Poster door: new "Month plan" text + "My brand". Rendered with mocked APIs; the live AI plan was not run here.

## Ads v2 — Facebook / Instagram ads made perfect (1 Nov 2026)
Owner: "ad chalne wale part ko perfect aur professional banao; payment ka option kya rahega Meta ka?" Decision (owner said "jo best lage wo karo"):
**the money for ads goes to Facebook from the user's OWN ad account** (UPI prepaid or card in Meta's Payment settings) — Shubhora never holds ad
money, never pays Meta for a user, no GST-on-ad-spend headache. "Shubhora managed ads" (we run it from our account, the user pays us through the
advance wallet / a payment link) is Batch 2, a Premium service, NOT built. Pieces (migration **0082** must run before deploy):
- `lib/ads-shared.ts`: `billingUrl / managerUrl / NEW_AD_ACCOUNT_URL`, `adStateOf` (running · scheduled · review · rejected · paused · ended · issue),
  `friendlyAdError` (Meta error → plain Hindi/English + what to do), `costPer`, `startAtFor(day)` (10:00 IST). `lib/ads-image.ts`: `fitAdImage`
  — the poster is CONTAINED over a blurred copy in 1:1 (feeds/auto) or 9:16 (stories) with sharp; nothing is cropped. `social-server.uploadAdImage`
  takes a Buffer too.
- `lib/ads-server.ts`: `createAd` schedules (`startAt` ≥ 5 min ahead, else now + 10 min; PAUSED unless startNow), uses the fitted picture,
  returns start/end; `updateCampaign` (daily budget / end time PATCH on the ad set) → `/api/ads/update`; `liveCampaigns(.., preset)` also reads
  the ad set's budget + dates and `ad_review_feedback`. `/api/ads/accounts` adds `hasFunding`, `billingUrl`, `newAccountUrl`; `/api/ads/create`
  gates on the plan (free: one ad to try; 402 after) and saves the v2 columns.
- `lib/ads-sync.ts` + `/api/cron/ads-sync` (`scripts/ads-sync.sh hourly|daily`; deploy.sh writes /etc/cron.d/shubhora-ads-sync: `35 * * * *` and
  `30 14 * * *` UTC = 8 pm IST): every open campaign is read from Meta hourly; the row keeps status / reason / spend / results; the owner is told
  ONCE per turn (`ad_update` notify, ref `ad:live|rejected|ending|ended:<row>`): went live · not approved (+ Meta's reason) · ends tomorrow · ended
  (numbers + run again); the daily one sums today's spend per running ad. Gone from Meta → `ended_at` after a day. Log `/var/log/shubhora-ads-sync.log`.
- `bridge/index.mjs` `markAdLead`: a WhatsApp message that arrives from an ad (ctwa context) tags the lead `facebook-ad`, `src facebook_ad`,
  `leads.ad_title`; the CRM list shows "📣 From Facebook ad".
- Page `app/poster/ads/page.tsx` (desktop two columns, sticky "Your ad" summary): payment card when the account has no funding (3 steps + "Open
  Payment settings" + "Check again"), "make an ad account" steps when there is none, schedule chips (today / tomorrow / pick a day), placement
  ratio preview, friendly errors; My ads: totals strip, state badges, "Why Facebook stopped it" box, per-result cost, Pause/Start, "Money / days"
  edit (budget + extend end), "Run again" (prefills the wizard from the old row). Rendered locally with mocked APIs (Playwright), not run against
  Meta live: **ads_management / ads_read App Review is still pending** (owner's task, docs/meta-app-review.md) — until approved only the app's
  testers/admins can really create ads.

## Website waiting time (31 Oct 2026)
Owner: "user ko lagna chahiye ki kaam mein time lagta hai — 24–48 hr, customised 1 week, 24 hr baad auto". `src/lib/site-ready.ts`: a website made for
the FIRST time (card/build publish, `site.readyAt = now + 24h`) and the FIRST Premium design (`site.advancedReadyAt`, accept in /api/card/advanced; the
same moment as the website's when that one is still waiting) show to visitors only from that moment — `publicCard()` in `/c/[username]/render.tsx`
(enabled=false / advancedOn=false for the visitor's copy; `?view=site` too). The card is live at once; in-app previews (/preview/site) are not held;
improve / rebuild / later designs are not held. Hourly cron `/api/cron/site-live` (scripts/site-live.sh, deploy.sh writes /etc/cron.d/shubhora-site-live)
clears the fields and sends "your website is live" (push + WhatsApp, `website_ready`). Screens: congratulations (build), Card & Website strip, Premium done,
AdvancedEntry; Advanced features say "within 7 days". A DEMO account (user_metadata.is_demo) is never held (build page + accept route, `site-ready-server.ts`). The copy says "Shubhora is preparing it", never "our team is working" (nobody is).

## Plans and pricing (owner's structure, 16 Oct 2026)
Owner's words: Free = the digital card only; Standard Rs 2,999 a month; Premium Rs 5,999 for the FIRST month only, then Rs 2,999 a month;
Custom Solutions (any software or automation, price on request). Never write Rs 5,999 as if it were monthly.
- **Names.** "Growth" is now **Standard** in everything a customer sees (the internal tier key stays `"growth"`: DB, `SaasTier`, `saas:growth`).
  Starter (Rs 999) is no longer sold anywhere: no screen offers it, `/api/billing/order` refuses starter/pro unless the account is already on that plan
  (renewal). Pro (Rs 4,999) is hidden from new customers; running subscribers keep their plan. Source of truth for the wording: `src/app/(marketing)/pricing/page.tsx`
  and `src/lib/billing.ts` (`SAAS_PLANS`, `PREMIUM*`, `PRO_CUSTOM`).
- **Premium = one autopay.** `createAutopay(owner, premium)` (`src/lib/autopay.ts`) makes a Razorpay subscription on the Standard plan with an
  add-on of Rs 3,000, so the first debit is Rs 5,999 and every later one Rs 2,999. `notes.premium = "1"`. `applyAutopayCharge` accepts amount
  2,999 or (premium and 5,999) and the first Premium debit calls `grantAdvanced` (auth `app_metadata.advanced_site = {paid, paymentId, at, triesLeft}`).
  Verify route: `/api/billing/autopay/verify`; webhook: `/api/billing/webhook` (reads `notes.premium`). The checkout page showed "Payable now Rs 5,999,
  recurring Rs 2,999" for a test subscription (16 Oct 2026); no real money was run through the app's own flow yet.
- **Standard to Premium** (a running mandate): pays only the Rs 3,000 difference, one time, through `/api/poster/pay/advanced` (price decided on the server by
  `advancedPriceFor`; `notes.growth = "1"` on that order). `SubscribeButton premium` sends such a customer to `/poster/site/advanced`.
  Anyone without a running plan gets `402 premium_subscribe` from that route and must take the Premium subscription.
- **Razorpay plan name.** The checkout shows the Razorpay plan's name: a new plan "Shubhora Standard" (`notes.key = shubhora-standard-299900`) is made on first use;
  mandates on the old "Shubhora Growth" plan keep working (`isOurMonthlyPlan` accepts both).
- **Premium website keeps for one year** after the Premium payment even if the plan is stopped, and as long as Standard/Pro runs (`advancedWithinYear`,
  `standardRunning`, `isAdvancedAllowed` in `src/lib/advanced-access.ts`). Daily cron `scripts/advanced-expiry.sh` (deploy.sh writes
  `/etc/cron.d/shubhora-advanced-expiry`) calls `/api/cron/advanced-expiry`, which sets `site.advancedOn = false` when neither holds: the basic website and the card
  keep working, the Premium design stays stored. Accounts that never paid (reviewed while `ADVANCED_SITE_OPEN` was on) are left alone.
- **When a plan stops:** the card and the basic website keep working; every plan-gated feature (posters, social, ads, WhatsApp AI, CRM sending) is off by the
  existing plan checks. The owner's rule: "card and website stay, everything else stops".
- **A failed Premium build** costs nothing: `spendAdvancedTry` is only called for a finished design, so the customer simply runs it again (owner's rule: try again).
- **Free = card only (new accounts).** `src/lib/site-access.ts` (`hasPaidPlan`, `newWebsiteBlocked`) gates `/api/site/status`, `/template`, `/generate`, `/api/card/build`
  (a free build comes back with the website off) and the public `?view=site`. Existing free sites that are already on keep rendering. The card builder opens on the
  Card tab with a "Get a website with Standard" strip. Not run against a real free account yet: test with a fresh account.
- **Start with a plan:** the first-run Home (`src/app/poster/page.tsx`) offers "Start with Standard / Premium"; signup keeps `?plan=` and lands on
  `/poster/start-plan`, which opens the payment by itself and then the card set-up.
- **Manual payment links (Razorpay)** were made by hand for a party on 16 Oct 2026 (a subscription with the add-on, and a Rs 5,999 one-time payment link). They are NOT
  linked to a Shubhora account: after such a payment, open that person's Premium by hand (admin PUT of `app_metadata.advanced_site`, see `grantAdvanced`).
- **Env.** `ADVANCED_SITE_SELL=1` is on (sales open); `ADVANCED_SITE_OPEN` was removed (no free access). Gemini billing must be on for the Premium design (review, layout, copy).
- **Name clash fixed:** the card builder's old "Premium" (paid designs, banner) now says Standard / AI banner.
- **Standard "up to 5 pages"** is wording only: no code limit yet.

## Standard website QA (16 Oct 2026)
All 28 trades were looked at in 3 looks each, desktop and phone, with a Hindi pass (about 400 shots across the two nights). The six looks, palettes, hero focus
per stock banner (`BANNER_FOCUS` in `src/lib/site-hero.ts`), tap targets and Hindi fixes are in. Auto and footwear open in strong colours now (`tradeStyle`,
`src/lib/site-recipes.ts`). Scripts: `scripts/trade-check/` (shot.mjs, look-shots.mjs, run.cjs, sweep.mjs). Known: sample photos in templates are generic stock; auto/footwear
cards made before 16 Oct would keep a grey palette (none existed in the DB when checked).

## Video made simple (20 Oct 2026)
Owner: "video wala part bahut mushkil hai — bilkul simple, jo koi bhi bana sake". The simple screens are the doors; every old choice is one link away.
- `/poster/videos` = two buttons (Reel free, Video ad 20 credits). The old hub with all four kinds is `/poster/videos/all` ("more ways").
- `/poster/reel` = pick the kind (tip / offer / why us / festival), tap Make; everything else is chosen. Old Reel Maker = `/poster/reel/pro`.
- `/poster/video` = pick the product, tap Make: 10 s, Reel size, template tier, product photo, one price (adCredits(10)), idem key.
  Old wizard = `/poster/video/pro`; `?credits=1`, `?testimonial=`, and a photoshoot seed (`akp-ad-seed`) are forwarded there.
- `src/components/poster/back-bar.tsx`: `/poster/video` has its own Back; `/poster/video/pro` → `/poster/video`.
- Not run against the live API yet (no dev DB with products here): first test = make one free Reel and one 20-credit ad on the owner's account.

## Rules for commits
- Branch `claude/dreamy-faraday-0864zl` only. Clear messages. No model names in code or commits.
- Keep comments in the codebase's voice (why, dated owner decisions), no hype.


## Admin v2 (31 Oct 2026) — one professional admin panel
Owner: "professional admin panel, jugaad nahi; super admin, staff admin, franchise". Built as a new shell over the existing pages.
- **Login**: `/admin/login` — the app's own Supabase login (e-mail / mobile + password) + TOTP 2-step (Supabase MFA; **the owner must
  switch TOTP on in Supabase → Authentication → Multi-factor**). Password-unlock is gone from the UI; `SUPER_ADMIN_PASSWORD` stays only as a
  break-glass x-admin-key (logged as "Emergency password"). The owner e-mails (lib/owner-emails.ts) are seeded as Super Admin on first use.
- **Rights & roles**: `src/lib/admin-rights.ts` (26 rights, roles super_admin/admin/support/sales/content/franchise/custom, MENU by right).
  Server: `src/lib/admin-v2.ts` — `identify()`, `requireAdmin(req, right, {sensitive})`, `audit()`, `getSettings()`; `adminAllowed()` (legacy
  routes) now also accepts super_admin/admin logins. New routes under `/api/admin/v2/*` (me, staff, audit, dashboard, franchises, settings,
  search, system). Legacy users routes check rights + franchise scope + write audit lines.
- **Franchises**: `franchises`, `profiles.franchise_id`, `franchise_ledger`, `payouts` (migration **0078**). Sign-up link `/start?f=CODE`
  (→ `/api/account` `franchise`). Commission on every verified payment (`franchiseEarning()` in billing/verify, autopay, pay/advanced):
  first payment % / renewal % per franchise (defaults in Platform settings) — always on the amount WITHOUT GST (owner, 1 Nov 2026:
  `net = paise / 1.18`; `base_paise` in the ledger is the net amount and the note shows the working). Payout: request → approve → paid (UTR) → ledger line.
  A franchise login = admin_users row with role franchise + franchise_id: same panel, only its users (`scopeOf` / `userInScope`).
  **Become a franchise** (owner, 1 Nov 2026 "professional tarika"): `/franchise` (marketing page + `FranchiseApplyForm`, offer / steps / FAQ
  from `src/lib/franchise-apply.ts`) → `POST /api/franchise/apply` (same-origin, rate-limited, honeypot, one open application per mobile per
  30 days) → `franchise_applications` (migration **0080**) + push/WhatsApp to every Super Admin. Admin → Franchises → **Applications** tab
  (`components/admin/franchise-applications.tsx`, `/api/admin/v2/franchise-applications` GET/PATCH/POST): notes, contacted, reject, or
  **Approve** = franchise row + Franchise-role login + welcome message (login, sign-up link, commission) to send on WhatsApp. The applicant
  sets the panel password IN THE FORM (owner: "generate wala hata do"): kept as a bcrypt hash (`bcryptjs`, migration **0081**
  `password_hash`, `has_account`), the login is created with GoTrue admin `password_hash` and the hash is wiped; a mobile that already has a
  Shubhora account keeps its own password (`has_account`). Manual "Create login" on a franchise page: the admin types the first password
  (`/api/admin/v2/staff` POST `password`). Bell alert counts new applications. Link in the footer and a CTA on /pricing.
  **Delete a franchise**: `DELETE /api/admin/v2/franchises/[id]` (manage, sensitive) — typed-code confirm on the franchise page; ledger and
  payouts cascade, users stay (franchise_id null), its logins are switched off; audit keeps the row.
  **No partner programme for franchises** (owner, 1 Nov 2026 "franchise mein MLM nahi"): a user under a franchise is a CONSUMER whatever link
  they came by (`/api/account` forces kind consumer when `franchiseOf()`), Admin cannot "Make partner ID" for them (kind route), and the
  franchise's own panel shows no Partner ID column / views / stats (`meFr` in admin/users).
- **Pages**: dashboard (real counts + server health), Staff & roles, Audit log, Franchises (+ Payouts tab), franchise detail, My earnings
  (franchise), Platform settings, System health, Security (2-step, password, log out everywhere). Old partner-panel staff page →
  `/admin/partner-staff`. Shared UI: `src/components/admin/ui.tsx`.
- **Owner to do**: run 0078; enable TOTP in Supabase; log in at /admin/login with the owner account; set up 2-step; then Settings → require
  2-step for everyone. Left for later phases: Users page redesign (notes, timeline), billing/invoices, support tickets, reports, feature flags.

## Website plan after the card (2 Nov 2026)
Owner: "make my website dabane ke baad payment ka option aaye — aapka card ban gaya hai, website ke liye plan select kare; payment ke baad
confirm aur 24–48 hr ka page". Make screen (card/build, free account with no website = `freeMake`): ONE box "Make my website" (+ small "Only my
free card for now"). It builds the free card as before; on its preview the plan sheet opens by itself (`components/poster/website-plan.tsx`
`WebsitePlanSheet`: "Your card is ready" + Standard / Premium + Razorpay via `SubscribeButton` `onPaid`; "Not now" keeps the free card). The same
sheet opens from the preview's "Choose a plan for the website" and the finished screen's "Get my website". Paid → state `paid` → `PaidReceipt`
(plan, amount, payment id, date, 3 steps) → "Make my website now" builds the website (subscribed) → design / colours / link → finished screen,
where `SiteProgress` shows Payment ✓ → being made (readyText) → Live (WhatsApp). The wait itself is lib/site-ready.ts (24 h auto, above).
Rendered locally (sheet en/hi, receipt); no live Razorpay run.
- Same day: the free build's waiting screen says "Your card is being made". **Trade questions pre-ticked**: `lookupBusiness` asks the listing
  for short `facts` and a second text call (`tradeAnswersFrom`) maps them to the trade's chip options (`answers`, exact option names, only what
  is stated, cap MAX_TRADE_ANSWERS); /api/site/peek passes them; onboard `prefill` adds them to unanswered questions when the trade is the one
  they were made for. **One colour**: /api/card/build starts the website from the default poster profile's `layout.accent` (the set-up's
  "Your posters' look"; not on a write-again asking a new look), and every publish sends the website's colour back to the posters
  (`syncPosterColour` → /api/poster/brand).
