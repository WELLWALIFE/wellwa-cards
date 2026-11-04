# Billing v4 — website yearly + Growth monthly (PLAN ONLY, owner approval needed)

Date: 4 Nov 2026. Today the Suite bills ONE monthly plan (`SAAS_PLANS.growth` ₹2,999/month, Premium = +₹3,000 on the first
debit, autopay mandate). The site now shows the new model (commit c7ef42e) with buy buttons on WhatsApp until this is built.

## Target
| Product | Price | Period | Gives |
|---|---|---|---|
| Website Standard | ₹2,999 incl. GST | 1 year | dynamic site ≤5 pages, SEO/AI-search, catalogue + WA order, Ad Studio/Reels (credits), Growth 1st month free |
| Website Premium | ₹5,999 incl. GST | 1 year | dynamic & progressive site (PWA), rest as Standard, Growth 1st month free |
| Growth Plan | ₹2,999 incl. GST | 1 month, autopay | posters, FB/IG auto-post, WA AI, CRM, Google profile, broadcasts, AI search, report |
| Upgrade Std → Premium | ₹3,000 | — | within the running year |
| Credits | ₹10 each | — | no free credits |

Free digital card: owner to decide — keep "free 1 year then ₹1,499" or make it ₹0 for ever (PPT shows ₹0).

## Changes
1. `src/lib/billing.ts`: `SITE_PLANS` { standard 299900/yr, premium 599900/yr }, `GROWTH_PLAN` 299900/month, `UPGRADE_PAISE` 300000, `GROWTH_FREE_MONTHS` 1. Keep `SAAS_PLANS` for existing subscribers until migrated.
2. DB (migration): `subscriptions` → add `product` (`site_standard` | `site_premium` | `growth`), `period` (`year`|`month`), `valid_until`; a user may hold one site row + one growth row. Entitlement helpers: `hasSite(user)`, `hasGrowth(user)`.
3. Checkout (`/api/billing/*`, Razorpay): website = one-time yearly order (no mandate); Growth = autopay mandate as today; on website payment → create growth row valid 1 month, `source = 'free_month'`; mandate starts after it. Growth checkout refused without an active site row.
4. Feature gates: posters/social/WA-AI/CRM/Google/broadcasts → `hasGrowth`; website builder/publish, catalogue, PWA (premium) → `hasSite`. Site expired → site paused (reuse `site_paused`), card stays.
5. Renewals: cron 7 days before `valid_until` → WhatsApp + email; website renewal = new yearly order; on renewal → another free Growth month.
6. Pricing/home/features pages: replace WhatsApp buttons with real checkout (`SubscribeButton` with product).
7. Partner link (`/api/link`): accept `product` + `period_to` from the partner app and set the matching row (see `shubhora-partner/docs/plan-v4-income.md` §6).
8. Existing monthly subscribers: owner's call — keep on the old monthly plan until their mandate ends, or move to Growth monthly + a free website year.

Effort ≈ 5–6 days incl. tests. Depends on Partner Plan v4 decisions (same launch date).
