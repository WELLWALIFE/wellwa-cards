# Codex ke liye: website design ka review aur update

Repo: `/Users/jsrao/Desktop/Wellwa Life/wellwa-cards` (Next.js 16 + Supabase). Isi folder ko Codex me kholo.
Ye file batati hai ki website kahan se banti hai, kaunsi file kya karti hai, aur Codex ko kya karne dena hai.

## 1. Codex ko ye prompt do (copy-paste)

> You are reviewing the website builder of a SaaS (Shubhora). Every customer gets 12 website designs from the same content:
> 6 "Premium" (src/components/site-adv) and 6 "Standard" (src/components/site-view.tsx and its blueprints).
> Read work/CODEX-REVIEW.md first. Goal: each of the 12 designs must look clearly different in LAYOUT (not only colour/font)
> and look agency-made. Review the files listed there, list the 10 most important design problems with file + line, then fix
> them. Rules: keep every change general for all customers (no business-specific defaults); do not change saved data or the
> database; do not touch .env*, supabase keys, auth or payment code; keep TypeScript strict; after changes run
> `npx tsc --noEmit` and `npx eslint <changed files>` and `node --test bridge/shubhora-agent.test.mjs`. Explain every change in
> one line.

## 2. Kaunsi file kya karti hai

### Premium designs (Design 1 to 6, "with motion")
| File | Kya hai |
| --- | --- |
| `src/components/site-adv/heroes.tsx` | Sabhi Premium banner/hero layouts aur unka CSS (full-bleed, glass-card, split-frame, editorial-marquee, parallax-collage, diagonal, storefront...) |
| `src/components/site-adv/hero-slides.tsx` | 3 banners ka slider, floating app-cards (chips) |
| `src/components/site-adv/page-more.tsx` | Story sections: stats, split, bento, flow (timeline) + unka CSS |
| `src/components/site-adv/shared.tsx` | Section ka dhancha, spacing, dark/light section |
| `src/components/site-adv/theme.ts` | Rang, font, kone (shape), spacing (density) |
| `src/components/site-adv/registry.ts` | Kaunsa hero id kis component se banta hai |
| `src/components/site-adv/content.ts` | Kaunsi photo kahan lagegi |
| `src/app/api/card/advanced/route.ts` | 6 Premium designs ki list; `PREMIUM_TOPS` aur `TOP_FEEL` har design ka hero aur feel tay karte hain |
| `src/lib/site-advanced.ts` | Premium design ka data format (spec) |
| `src/lib/site-advanced-archetypes.ts` | Har dhandhe ke ready design (archetypes) |
| `src/lib/site-advanced-ai.ts` | AI jo Premium design aur headings likhta hai (prompt + rules) |

### Standard designs (Design 7 to 12)
| File | Kya hai |
| --- | --- |
| `src/components/site-view.tsx` | Standard website ka main renderer: sections, story, grids, andar ke pages ka header, CSS (`VIEW_CSS`) |
| `src/components/site-bodies.ts` | 6 Standard looks ka alag CSS (story, cinematic, collage, wordmark, shop, bento) |
| `src/components/site-bento.tsx` | Design 8 "Tile Board" ka hero |
| `src/components/site-shop.tsx` | Design 12 "Order Shop" ka hero |
| `src/components/site-cinematic.tsx` | Design 9 "Full Photo" ka hero |
| `src/components/site-collage.tsx` | Design 10 "Photo Collage" ka hero |
| `src/components/site-wordmark.tsx` | Design 11 "Big Name" ka hero |
| `src/components/site-smart.tsx` | Hero photo, crop, Ken Burns motion |
| `src/components/site-sections.ts` | Section heading aur product card ka CSS |
| `src/lib/site-home.ts` | Homepage pe sections ka order |
| `src/lib/site-recipes.ts` | Har dhandhe ki priority (kaunsa section pehle) |
| `src/lib/site-designer.ts` | AI jo Standard look chunta hai |
| `src/lib/site-hero.ts` | Banner ki heading, sub-line, photo focus |

### Sab designs pe lagne wala
| File | Kya hai |
| --- | --- |
| `src/lib/site-quality.ts` | Website check: apne-aap fix + owner ke liye sujhav |
| `src/components/site-check.tsx` | Edit screen pe "Website check" patti |
| `src/lib/shubhora-page.ts` | Shubhora partner ki site ka order, headings, safai (sirf partner sites) |
| `src/lib/templates.ts` | Templates; `vcard-reseller` = Shubhora partner ka content |
| `src/app/poster/site/choose/page.tsx` | 12 designs chunne wali screen |

## 3. Abhi ki jaani hui kamiyan (Codex se yahi theek karwao)
1. Design 7 (Colour Poster): hero me bada khaali neela hissa, photo chhoti neeche kone me. (`site-view.tsx` hero + `site-bodies.ts`)
2. Design 9 (Full Photo): photo bahut lambi, heading neeche; homepage 12,000px tak lamba. (`site-cinematic.tsx`)
3. Design 10 (Photo Collage): hero me photo + infographic + phone screens ki bheed. (`site-collage.tsx`)
4. Design 11 (Big Name): sabse bada cheez naam hai, product/fayda nahi. (`site-wordmark.tsx`)
5. Standard 7-12 aapas me sirf hero me alag hain; neeche ke sections lagbhag ek jaise. (`site-view.tsx`, `site-bodies.ts`)
6. Premium 1, 2, 3 teeno andheri photo-hero hain; aur alag dhancha chahiye. (`heroes.tsx`, `route.ts` TOP_FEEL)
7. Phone pe Showcase (6 cards) ek column me bahut lamba. (`site-view.tsx` `.fitg`)

## 4. Codex ko kya NAHI karna
- `.env`, `.env.local`, Supabase keys, Google OAuth, payment, login code ko haath nahi lagana.
- Database / `supabase/migrations` me kuch nahi badalna.
- Nakli reviews, nakli number, mashhoor logon ki photo nahi.
- Kisi ek customer ke liye alag default nahi; rule sab ke liye.
- `git push` ya deploy khud nahi; deploy aap karte ho.

## 5. Codex ke kaam ke baad check aur deploy
```
cd "/Users/jsrao/Desktop/Wellwa Life/wellwa-cards"
npx tsc --noEmit
node --test bridge/shubhora-agent.test.mjs
npm run build && git add -A src && git commit -m "Design review fixes (Codex)" && bash deploy.sh
```
Deploy ke baad dekho: https://shubhora.com/poster/site/choose (12 designs) aur https://shubhora.com/c/jai-dev-rajwal
