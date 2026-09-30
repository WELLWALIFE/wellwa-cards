# NeuralEdge — project overview

A single document to hand to another reviewer (ChatGPT or a developer) so they
can understand the whole system without reading the code first.

> **Before you share this:** it contains no passwords, API keys or tokens, and
> it must stay that way. Never paste `.env.local`, the Supabase service-role
> key, the admin password or the SSH key into a chat tool — those grant full
> control of the live system and the customer database.

---

## 1. What it is

A digital business card SaaS for Indian small businesses. A card holder gets a
public page (`neuraledge.me/c/their-name`) carrying their products, prices,
photos, video and an AI assistant that answers customer questions 24/7 in the
customer's own language, on the card and over WhatsApp.

Built for Wellwa Life's water-ionizer distributors first, but sold to any trade
— doctor, real estate, restaurant, salon, gym, consultant.

**Three kinds of user:**
| Role | Where | Does what |
|---|---|---|
| Card holder | `/dashboard` | Builds their card, sees leads, runs ads |
| White-label partner | `/partner` | Runs the platform on their own domain, activates members from a prepaid wallet |
| Super admin | `/admin` | Users, cards, templates, partners, funds, AI training, pricing |

---

## 2. Where the code lives

**Local (developer machine, macOS):**
```
/Users/jsrao/Desktop/Wellwa Life/wellwa-cards
```

**Live server (GoDaddy VPS, AlmaLinux 9 + cPanel/WHM):**
```
Host   148.72.247.91
Path   /opt/neuraledge/app
Node   Next.js app on 127.0.0.1:3001, run by pm2 as "neuraledge-app"
        Multi-tenant WhatsApp manager on 127.0.0.1:8787, pm2 "neuraledge-bridge"
        (one isolated Baileys worker + auth/config/follow-up store per user)
Web    Apache reverse-proxies neuraledge.me -> 127.0.0.1:3001
```

**Live URL:** https://neuraledge.me

Roughly 126 source files (~900 KB of `src`), excluding dependencies.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.12 (App Router, Turbopack), React 19 |
| Language | TypeScript, strict |
| Styling | Tailwind v4, CSS custom properties for theming |
| Database / auth / storage | Supabase (Postgres + RLS) |
| AI | Anthropic Claude (`claude-sonnet-5`) |
| WhatsApp | Multi-tenant manager + isolated Baileys QR workers — `bridge/manager.mjs`, `bridge/index.mjs` |
| Voice notes | Transcribed on the VPS itself — whisper.cpp (base model) + static ffmpeg at `/opt/neuraledge/whisper`, no external STT API |
| Payments | Razorpay |
| Hosting | Self-hosted on a VPS. **Not Vercel** |

---

## 4. Folder map

```
src/
  app/
    (marketing)/         public site — home, pricing, features, about, contact
    (dashboard)/         card holder area — dashboard, cards, leads, ads,
                         analytics, ai, whatsapp, tools, settings, partner
    admin/               super admin — users, cards, templates, ai, brands,
                         wallets, plans, site
    c/[username]/        THE PUBLIC CARD (+ /vcf, opengraph-image)
    templates/           public template gallery, no login needed
    api/                 chat, ai/*, admin/*, billing, leads, health, domains,
                         partner, join, wa/*, cron/*
  components/            card-view, card-pixels, editor/*, share-kit, sidebar…
  lib/                   types, cloud, plan, templates, ai-training,
                         ad-templates, track, brand, supabase/*
bridge/                  WhatsApp service (own process, own pm2 app)
supabase/migrations/     18 SQL migrations, 0001 → 0018
scripts/gen-art.mjs      generates public/art/*.svg (template artwork)
server/                  add-domain.sh, add-brand.sh (run on the VPS via sudo)
public/art/              57 generated SVG images
```

---

## 5. Database (18 tables)

```
profiles          user + plan + plan_expires_at + plan_source + brand_id
cards             the card document (JSONB `data`), username is the public slug
leads             pipeline, notes, next follow-up, value + UTM attribution
card_events       views/clicks with campaign attribution
card_domains      custom domains (card.theirbusiness.com)
brands            white-label partners (domain, branding, AI training, pixels)
brand_admins      who may run a partner account
partner_wallets   prepaid balance per partner
wallet_ledger     append-only money history
topup_requests    partner adds funds → super admin approves
plan_rates        list price + exact partner price
platform_settings global AI persona/knowledge
card_templates    admin-editable templates (built-ins live in code)
card_translations cached visitor-language translations
subscriptions     verified Razorpay payment ledger (provider refs are unique)
admin_vault       retired/empty legacy table; passwords are never stored
card_links / card_sections   legacy, superseded by cards.data
```

Access control is Postgres RLS. Anything a public page needs but RLS would hide
goes through a `security definer` function that returns only that one fact —
`username_available`, `card_owner_state`, `card_tracking`, `card_ai_context`,
`resolve_brand_host`.

---

## 6. The parts worth understanding

### Plans — one source of truth
`profiles.plan` + `plan_expires_at`. `effective_plan()` applies expiry;
`my_plan()` is what the app calls.

There is **no free tier**. Every signup starts a **14-day Pro trial**
(`plan_source='trial'`). Three ways to become paid: Razorpay (`record_payment`),
partner wallet (`partner_activate`), or admin grant (`admin_set_plan`).

**Pricing:** ₹1,999/month list. ₹1,180/month for white-label partners (an exact
amount in `plan_rates.partner_price_paise`, not a percentage).

### An expired card must never 404
Links already forwarded on WhatsApp have to keep working. When a plan lapses the
card **shrinks** — name, phone, WhatsApp and Save Contact stay; products,
gallery, extra pages and the AI chat go. `card_owner_state()` fails **open** (it
shows the full card) so a lookup failure can never hide someone's card.

### White label
A partner points `*.theirdomain.com` at the server (one wildcard DNS record).
Middleware resolves `member.theirdomain.com` → that member's card and
**rewrites** (never redirects), so the partner's domain stays in the address bar.
Their logo replaces NeuralEdge branding. Members are attached at signup by
`/api/join`, which reads the **real Host header** — never a client-supplied brand.

### Partner wallet
Partner deposits → super admin approves → balance credits. Each activation
debits it inside one transaction (`SELECT … FOR UPDATE`), so the wallet can never
be charged for an activation that didn't happen. Double-approval is refused.

### AI — three layers, precedence Card > Brand > Platform
```
PLATFORM (super admin)  HOW to answer: language, length, safety
BRAND    (white label)  WHAT the company sells: products, specs, FAQ
CARD     (the user)     WHO this seller is
```
Both the website chat and the WhatsApp bridge build the prompt the same way, so
a customer gets the same answer on either channel.

House rules (in `src/lib/ai-training.ts`, applied whether or not anyone edits
anything): reply in the customer's exact language and script; 2–4 short lines;
**always end with exactly one question**; be specific with real numbers; admit
what you don't know; never invent reviews or testimonials; never claim a product
treats or cures disease.

Language is detected server-side and appended as the **last** instruction —
writing "mirror the customer's language" in the prompt was not enough, because
the model copied the language of the Hinglish FAQ examples.

### Ads
`/ads` walks through seven steps in order. Pixels (Facebook / GA4 / Google Ads)
are optional — the built-in UTM tracking works with no setup at all. Conversion
events are mapped so that **a WhatsApp tap reports as a Lead**, which is the real
conversion on this product. UTMs are carried onto the lead row, so the Leads
table shows which ad produced which customer.

---

## 7. Running it locally

```bash
export PATH="$HOME/.local/opt/node-current/bin:$PATH"
cd "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards"
npm install
npm run dev        # http://localhost:3000
```

`.env.local` (not in the repo) holds: the Supabase URL + anon key + service-role
key, `ANTHROPIC_API_KEY`, the Razorpay keys, `ADMIN_EMAILS`, `CRON_KEY` and
`NEXT_PUBLIC_SITE_URL`.

---

## 8. How deploys work

```bash
./deploy.sh
```
production build on the Mac → rsync source + compiled release → locked dependency
install on VPS → `pm2 restart` → homepage + database health checks. Building
locally avoids saturating the nano VPS.

`.env.local` is **excluded** — the server keeps its own production env. (Syncing
the dev env over it once broke live SEO by publishing a dead tunnel URL.)

Database changes are SQL files in `supabase/migrations/`, applied to the live
project through the Supabase Management API.

WhatsApp code is synced with the app, while `bridge/tenants/` is excluded from
deploys. PM2 runs `bridge/manager.mjs`; it creates one isolated worker and
server-side state directory per authenticated user. A request carries the
server-verified user id and current plan expiry, so sessions cannot be shared
across accounts and automation pauses when the trial or paid plan expires.

---

## 9. Honest status

**Working and live:** cards, 7 templates, public card pages, SEO/OG/vCard, AI
chat, manual social post + 7-day campaign tools, WhatsApp auto-reply/follow-up
writing, leads CRM with AI scoring/notes/reminders/value, analytics, ads tooling,
custom domains, white label, partner wallet, trial + verified billing, super admin.

**Security hardening live:** dashboard AI and WhatsApp bridge routes require an
authenticated owner, public lead capture is server-validated/rate-limited,
payments activate only after server-side Razorpay verification, admin passwords
have no fallback, the plaintext password vault is retired, and common browser
security headers are enabled.

**Switched on 2026-08-16:**
- Wellwa white label is LIVE — `*.wellwalife.com` wildcard DNS + per-member
  certificates; e.g. niteen-rajput.wellwalife.com serves that member's card
- Trial reminder cron runs daily (04:30 UTC crontab on the VPS)
- Card links auto-build from the person's name on first publish (editable)
- The Wellwa AI is fully trained: product range + USPs, demo flow
  (online → video → physical, location-first with owner confirmation),
  the official direct-selling plan (5 incomes), and real media replies
  (videos/photos/PDFs sent as actual WhatsApp media, with typing pacing)

**Still pending:**
- No partner login has been created yet (Super Admin → White label → add admin)
- Razorpay has never been run end-to-end with a real card

**Deliberately not built:** automatic ad publishing (needs Meta Marketing API
app review), WhatsApp Business Calling (needs Tier 2 volume), voice agents.

**Known caution:** product facts in the Wellwa template were partly written from
assumption rather than the official site. Two were wrong and have been corrected
(warranty is 1 year on the machine + 4 years on plates only; there is **no EMI
scheme**, though credit card is accepted). The rest of the brand knowledge should
be read through by someone who knows the product.

---

## 10. Good questions for a reviewer

- Is the RLS + `security definer` split airtight? Any function leaking more than
  the one fact it should?
- Money paths: can `partner_activate` or `admin_approve_topup` be made to
  double-spend or double-credit under concurrency?
- Is `/api/join` (Host-header based) safe against a member being attached to a
  partner they don't belong to?
- The card document is one JSONB blob — where does that start to hurt?
- Pixel IDs are interpolated into an inline script tag after regex validation —
  is that validation tight enough?
- Trial → expired → renew: any state where a paying customer loses their card?
