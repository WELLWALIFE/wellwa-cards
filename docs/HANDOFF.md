# Shubhora — hand-off for a new Claude Code session (desktop)

Read this first. It is the state of the project on 12 Oct 2026, written for a session running on the owner's Mac.

## The owner and how to talk
- Owner: Shubhora (Wellwa Life), writes Hinglish; **reply in Devanagari Hindi** with everyday Hinglish words
  (प्राइस, डिलीवरी, डिटेल्स), brand/model/app names in English letters. Short, practical, no pure Hindi.
- The owner is not a developer. Give commands ready to paste. The Mac user is **not a sudoer**.

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
