# WhatsApp → website (Shubhora's own number)

"Hi bhejo, 10 minute me website" — the bot in `src/lib/wa-onboard.ts`. It runs only on Shubhora's OWN WhatsApp Cloud
API number; every seller's own number keeps the CRM menu bot / AI reply (`src/lib/wa-cloud.ts`).

## What it does
1. Talks the business through what the website needs (name, trade, city, owner; optionally about, hours, offer,
   address, UPI, products) — one question at a time, in the language they write in. Voice notes are transcribed.
2. Makes their account (mobile = login, no OTP) and poster profile as soon as the four required facts are in.
3. Takes 2–5 photos: a rate list is read into products with prices, a shop photo becomes the banner, a logo is kept.
4. Runs the app's own build (`/api/card/build`, as that user), publishes under a link from the business name
   (`sharma-sweets`, then `-city`, then number digits) wearing one of the three looks picked per number.
5. Sends a screenshot, the link, the look menu (1/2/3) and a one-tap login (`/auth/link?t=…&to=/poster/site?edit=1`).
6. From then on the chat edits the live website through the app's checked operations (`src/lib/card-edit-ai.ts`):
   "timing 10 se 8 karo", "offer lagao 20% off", "mera naam theek karo"; a photo joins the gallery; "dobara banao"
   rebuilds on the same link; "login" resends the app link.

State: one `wa_onboard` row per number (migration 0063) — stage (`new | asking | photos | building | live`) and data.
Every message is also logged to `wa_messages` under the platform account, so the CRM shows the chats.

## Set-up (once)
1. Run `supabase/migrations/0063_wa_onboard.sql`.
2. Log in to Shubhora as the account that will own the company number (any Shubhora-owned account), open
   CRM → Integrations → WhatsApp Cloud API and connect the number (phone number id, WABA id, permanent token,
   app secret). The webhook URL is the same for everyone: `https://shubhora.com/api/whatsapp/webhook`.
3. Put that account's user id in the server env: `WA_ONBOARD_OWNER_ID=<uuid>` and restart.
4. Needs `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`
   (the build and the app routes are called on that URL as the user).

## Notes
- Replies go out inside Meta's 24-hour customer-service window (the person wrote first), so no template is needed.
  A build that finishes after the window would need an approved template — builds take 3–5 minutes, so this is rare.
- The look index is a hash of the number, so two shops of the same trade do not get the same website; the words,
  pictures and sections are written per business by the build itself.
- Abuse limits: 60 inbound messages and 40 edits per number per hour; the build keeps the app's 6-per-hour rule.
