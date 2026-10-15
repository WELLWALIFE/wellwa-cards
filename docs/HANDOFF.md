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

## Rules for commits
- Branch `claude/dreamy-faraday-0864zl` only. Clear messages. No model names in code or commits.
- Keep comments in the codebase's voice (why, dated owner decisions), no hype.
