# Wellwa Cards — Project Notes

> **Stale — Phase 1 only.** Kept for history. The current picture of the system
> is `../PROJECT-OVERVIEW.md`; read that first.

An advanced digital business card SaaS (a wCard.io alternative) with three
differentiators: an **AI layer**, a **lead-generation engine**, and
**WhatsApp auto-reply**. See the blueprint artifact for the full product review.

## Stack
- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind v4**
- **Supabase** (Postgres + auth + storage) — wired but not yet connected
- **lucide-react** icons, **qrcode** for QR generation
- Later: Claude API (AI), WhatsApp Business API, Stripe + Razorpay

> ⚠️ This is Next.js 16 — APIs differ from older versions. `params` is a
> `Promise` (await it). Docs are bundled at `node_modules/next/dist/docs/`.
> lucide-react has **removed brand icons** (Instagram/Facebook/LinkedIn/YouTube);
> we map social links to neutral glyphs in `src/components/link-icon.tsx`.

## Run locally
```bash
export PATH="$HOME/.local/opt/node-current/bin:$PATH"   # Node lives here
cd "wellwa-cards"
npm run dev            # http://localhost:3000
```

## What exists (Phase 1 — Foundation, expanded)
| Route | What it is |
|-------|------------|
| `/`, `/features`, `/pricing`, `/about`, `/contact` | Multi-page marketing site (hero/plans/video editable from /admin) |
| `/login`, `/signup` | Auth UI (demo — links to dashboard) |
| `/dashboard` | Overview: stats, recent leads, cards |
| `/cards`, `/cards/[id]` | Card list + **full editor**: pages/blocks/links DnD, uploads+crop, templates, settings |
| `/leads` | Lead table with AI score column |
| `/analytics` | Views chart + traffic sources |
| `/ai`, `/whatsapp` | Roadmap teasers for Phase 5 / 6 modules |
| `/tools` | **Email-signature generator + virtual meeting background (PNG)** |
| `/settings` | Account + plan |
| `/admin` (+ users/cards/plans/site) | **Super-Admin panel** — users, cards (verify/suspend), plans editor, site CMS |
| `/c/[username]` | **Public card** — multi-page, 14 block types, QR, vCard, share (Web Share/WhatsApp), day/night |
| `/c/[username]/vcf` | vCard (.vcf) download route |

Card block types: about(+photo), highlights, services, gallery, image, video (YT/Vimeo/mp4),
pdf (real upload ≤2.5MB), testimonials, faq, hours, appointment, location, offer/coupon, contact form.

Currently runs on **sample data** (`src/lib/sample-data.ts`) so the whole UI is
clickable without a database. The reference card `/c/alkafresh` recreates
wCard card #8796 (J. S. Rao / Wellwa Life).

## Next: Phase 2 — connect Supabase
1. Create a free project at supabase.com.
2. Copy `.env.example` → `.env.local` and fill the Supabase keys.
3. Run the migrations in the Supabase SQL editor, in order:
   `0001_init.sql`, `0002_grants.sql`, `0003_billing.sql`, `0004_platform.sql`.
   (0004 adds `platform_settings` — the global AI-bot training row used by
   Super Admin → AI bot training.)
4. Swap `sample-data.ts` reads for Supabase queries (`src/lib/supabase/`).

## Automatic SEO (no manual work)
Every published card is indexed automatically:
- `src/app/sitemap.ts` — lists all active cards from Supabase + marketing pages.
- `src/app/robots.ts` — allows crawl, points at the sitemap.
- `/c/[username]` — per-card `<title>`/description, OpenGraph + Twitter meta,
  canonical URL, JSON-LD `Person`/`Organization`, and a generated OG image
  (`/c/[username]/opengraph-image`).

## AI bot training
- Per-card: card editor → Settings → **Train AI bot** (persona + knowledge;
  paste text or upload a product PDF that Claude distills). Stored on the card.
- Global: Super Admin → **AI bot training** (company-wide knowledge every card
  inherits). Stored in `platform_settings`.
- Both feed the on-card chat (`/api/chat/[username]`) and the WhatsApp bridge.
- Inline **AI suggest** on tagline, About, and admin copy via `/api/ai/write`.

## Roadmap
1. Foundation ✅ 2. Card builder (real data) 3. Public card polish
4. Leads + analytics 5. AI layer 6. WhatsApp automation
7. Billing & plans 8. White-label & launch
