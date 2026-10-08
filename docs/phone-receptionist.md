# AI phone receptionist (Pro)

A missed call rings the AI instead of going nowhere: it answers in Hindi / Hinglish / English with the owner's own
knowledge (the same as the WhatsApp and website assistant), takes orders, bookings and call-backs, and tells the
owner on WhatsApp what happened. Code: `bridge/phone-worker.mjs` (the live bridge), `bridge/phone-audio.mjs`,
`/api/phone/context`, `/api/phone/call`, `/api/phone`, the Phone tab on Leads, migration 0067.

## How a call flows
1. The customer calls the owner's Shubhora number (a virtual number from Exotel or Twilio). The owner's own phone can
   forward "when unanswered / busy" to it, so only missed calls reach the AI.
2. The provider streams the call's audio over a WebSocket to `wss://shubhora.com/phone/stream`.
3. The worker asks the app how to answer this line (`/api/phone/context`: prompt, greeting, voice) and opens a Gemini
   Live session; caller audio goes up, the AI's voice comes down; the caller can interrupt.
4. On hang-up the transcript goes to `/api/phone/call`: a short AI summary, the caller becomes a lead (source `phone`),
   a booking with a day and time goes on the calendar, the owner gets push + WhatsApp with the summary and the number.

## Set-up (once, by Shubhora)
1. Run `supabase/migrations/0067_phone.sql`.
2. Server env: `GEMINI_LIVE_MODEL` (a Gemini Live / native-audio model id available to the key), optional
   `GEMINI_LIVE_VOICE` (default Aoede), `PHONE_WS_PORT` (default 8790), `INTERNAL_APP_URL` (default http://127.0.0.1:3001).
3. Start the worker: `pm2 start ecosystem.config.cjs --only neuraledge-phone && pm2 save`. deploy.sh restarts it when
   its code changes.
4. Apache: proxy the WebSocket path to the worker (needs `proxy_wstunnel`):
   ```
   ProxyPass        /phone/stream ws://127.0.0.1:8790/stream
   ProxyPassReverse /phone/stream ws://127.0.0.1:8790/stream
   ```
5. Provider:
   - **Exotel** (India, ₹0.6–1.2/min): buy a virtual number; in the call flow add the *Voicebot* applet pointing at
     `wss://shubhora.com/phone/stream` (16-bit PCM 8 kHz, bidirectional). Our worker reads `start.from` / `start.to`.
   - **Twilio**: a TwiML `<Connect><Stream url="wss://shubhora.com/phone/stream">` with `<Parameter name="From"
     value="{{From}}"/>` and `<Parameter name="To" value="{{To}}"/>` (μ-law 8 kHz).
6. Assign the number to an owner: `insert into phone_lines (number, owner_id, provider, label) values
   ('91XXXXXXXXXX', '<owner uuid>', 'exotel', 'Main line');` — an admin screen for this can come later.

## Cost (per minute, as measured in the plan discussion)
Gemini Live ≈ ₹1 + telephony ₹0.6–1.2 → ₹2–3.5 all-in. Pro at ₹7,999 includes 300 minutes; `PHONE_MAX_CALL_MIN`
(default 10) caps one call.

## Deferred
"Owner-style training" (teaching each seller's AI to write and speak the way the owner does) — after phase 3,
owner's call 8 Oct 2026.
