# Live help from Staff Admin

How the partner panel (`/partners`, the separate app on 127.0.0.1:3002) sends one of its staff members into
Shubhora's Live help console.

Live help itself lives in this repo: `/admin/support`, backed by `/api/admin/support`, with the card holder's
side in `src/components/poster/help-dock.tsx`. This note is only about getting a staff member in there.

## What the panel has to do

One signed server-to-server call — the same `LINK_SECRET` HMAC the panel already uses for `ensure`, `grant`,
`login` and the rest. Add a "Help this customer" button for whichever of your roles should have it, and on
click:

```
POST  https://shubhora.com/api/link
      x-link-signature: HMAC-SHA256(LINK_SECRET, raw body)

{ "action": "support-link", "staff": "Priya (support)", "ts": 1760000000000 }

→ 200  { "url": "https://shubhora.com/admin-link?t=<one-time>&to=support" }
```

Then send the staff member's browser to that `url` (redirect, or open in a new tab).

- `staff` is the name the **card holder sees** in the banner while being helped, so help never arrives from
  "somebody". Put something a customer will understand — a first name and your company, not a staff id.
- The address is single use and expires in **60 seconds**, so fetch it on the click, not in advance.
- `ts` must be within 5 minutes, like every other action on this route.

## What the staff member gets

Only Live help. The address becomes an 8-hour session scoped to `support`, which means:

- `/api/admin/support` — allowed. This is the whole feature: see who needs help, take a request, offer help
  to a username, see the screen they are on, send them to another screen, end the session.
- every other `/api/admin/*` route — refused. Users, Cards, Funds, Plans, Templates, White label, AI
  training, Notifications, Site settings and the hand-back into Staff Admin all require the platform owner.
- the Super Admin menu shows Live help and nothing else, and any other `/admin/...` address bounces back to
  it, so nobody lands on a page that would only say "unauthorized".

The scope is inside the signed token (`src/lib/admin-token.ts`), so it cannot be edited on the way: stripping
it to promote `support` to `all` breaks the signature. The staff name is read from that token too, not from
the browser, so a staff member cannot help under a colleague's name.

## Who may press the button

That is the panel's decision, in its own `server/auth/session.ts` PERMS — this side only checks that the call
is signed. `support` is the natural fit for it.

## The card holder's side, for anyone answering the phone

- A session **never** starts on its own. Either the person taps "Live help बुलाएँ" in the app's Help sheet,
  or a staff member offers and a question appears on the person's phone; nothing is reported until they say
  yes. An offer nobody answers expires in 5 minutes.
- While it runs they see a banner with the helper's name and an "End" button, and can also end it from the
  Help sheet.
- What a staff member sees is **which screen** the person is on, what that screen is for, and their card as
  it stands. Not what they type. This is not a screen recording.

## Before any of this works

`supabase/migrations/0061_live_help.sql` must have been run.
