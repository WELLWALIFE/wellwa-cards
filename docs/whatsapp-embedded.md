# Seller's own number on the official API — one button (Embedded Signup)

Leads → WhatsApp → Cloud API → **Connect with Facebook**. The seller logs in to Facebook, picks (or creates) their
WhatsApp Business account and number inside Meta's window, and comes back connected: their own number, Meta's
official API, no tokens to copy, no QR, no ban risk. `src/app/api/wa-cloud/embedded/route.ts` finishes it on the
server (code → business token, subscribe our app to the account, register the number, save as a Cloud API account);
from there everything already built for Cloud API applies (AI replies, salesman, templates, broadcasts, CRM).

The manual form (phone number id + token) stays underneath for sellers who already have their own Meta app.

## Set-up (once, Meta App Dashboard — Shubhora's existing Meta app, the one Facebook/Instagram posting uses)
1. Add the **WhatsApp** product to the app. Under WhatsApp → Configuration set the webhook callback URL to
   `https://shubhora.com/api/whatsapp/webhook` with the verify token from the server env `WHATSAPP_VERIFY_TOKEN`
   (any long random string; set it in `.env.local` first). Subscribe to the `messages` field.
2. WhatsApp → **Embedded Signup** → create a configuration (default settings are fine) → copy its **Configuration ID**.
3. Server env: `NEXT_PUBLIC_META_WA_CONFIG_ID=<configuration id>`. `META_APP_ID` / `META_APP_SECRET` are already set
   for social posting; the connect button appears only when all three are present.
4. App Review: the app needs `whatsapp_business_management` and `whatsapp_business_messaging` with Advanced Access,
   and the business must be verified. Until Meta grants these, the button works only for numbers of businesses that
   are admins/testers of the app.
5. Optional: apply as a **Tech Provider** so the seller's WABA is created under Shubhora's partner umbrella (same button,
   better limits and support).

## Notes
- Signature checks for these accounts use Shubhora's own `META_APP_SECRET`, because the account came through our app.
- A number currently active on the WhatsApp or WhatsApp Business app cannot be used; Meta asks the seller to use a
  different number or delete the app account first. The connect box says so.
- Deferred (owner's call, 8 Oct 2026): "owner-style training" — teaching each seller's AI to write the way the owner
  does — comes after phase 3.
