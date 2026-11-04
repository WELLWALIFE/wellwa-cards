# Plan: Google Health Check ("Apni dukaan ka Google score dekho")

Status: PLAN ONLY — owner approval needed before any code. (4 Nov 2026)

## Kya banega
Dukaan ka naam + shehar daalo → 1 minute mein report: Google par ye business kahan khada hai.

Report mein (public data se, bina login):
1. Google Business Profile: hai/nahi, rating, reviews count, category, photos, timing, phone, website.
2. Maps rank: 3–5 keywords par ("<category> near me", "<category> in <city>") kaunse number par.
3. Competitors: paas ke top 3, rating + reviews side-by-side.
4. Website: speed, mobile score, basic SEO (title/description/schema) — Google PageSpeed API (free).
5. AI search: ChatGPT/Gemini mein naam aata hai ya nahi (GEO backlog se judta hai; phase 2).
6. Google score 0–100 + 3 sabse zaroori sudhaar.
7. Report ke neeche CTA: Website plan / Growth Plan (WhatsApp button).

## Kahan dikhega
- Phase 1: public page `/google-check` (lead magnet; half report free, full report ke liye WhatsApp number) + home page box.
- Phase 1: partner panel mein same tool ("customer ke saamne dikhao").
- Phase 2: customer dashboard card, monthly refresh (Growth Plan ki "Monthly report").
- Phase 3: WhatsApp par "CHECK <naam> <shehar>".

## Software mein kya hai / kya nahi
- Hai: GBP OAuth + reviews/posts/insights (src/lib/google-server.ts) — par Google approval chahiye, aur ye sirf apne business ke liye hai, kisi aur ka nahi.
- Hai: SEO helpers (src/lib/seo.ts), WhatsApp link (waLink), partner/franchise panel.
- Nahi: Google Places API (New) client, SERP/rank API client, PageSpeed client, report engine, score logic, caching table, rate limit.

## Build items (approx)
1. `src/lib/google-check/places.ts` — Places Text Search + Place Details (rating, reviews, photos, hours, website).
2. `src/lib/google-check/rank.ts` — SERP API (DataForSEO ya SerpApi) se Maps/local pack rank, 3–5 keywords.
3. `src/lib/google-check/pagespeed.ts` — PageSpeed Insights (mobile), free.
4. `src/lib/google-check/score.ts` — 0–100 score + sudhaar list (rules, no AI needed).
5. DB table `google_checks` (query, place_id, result JSON, created_at, lead phone) — cache 7 din, same business dobara = free.
6. API `POST /api/google-check` — rate limit: public 3/din per IP, partner 20/din, customer unlimited (cached).
7. Pages: `/google-check` (public), partner panel tab, (phase 2) dashboard card.
8. Admin: har report ka kharcha + leads list.

Time: phase 1 lagbhag 4–6 din kaam.

## Kharcha per report (anumaan — asli rate sign-up par confirm karna)
- Places API: 2–3 calls ≈ ₹2–4 (Google har mahine kuch calls free deta hai; shuru mein lagbhag ₹0).
- Rank API: 5 keywords — DataForSEO ≈ ₹1, SerpApi ≈ ₹6–7. Sujhav: DataForSEO.
- PageSpeed: free.
- Kul: ≈ ₹3–5 per nayi report; cache ki wajah se repeat = ₹0.
- 1,000 free reports/mahina ≈ ₹3,000–5,000. Ek Website plan bikne par wasool.

## Limits (customer ko batana hoga)
- Rank "lagbhag" hai — jagah/device se badalta hai.
- Google search page scrape nahi karenge (Google ke niyam); sirf API.
- Jo business Google par hai hi nahi, uske liye report: "Profile nahi mili → sabse pehle GBP banao" (yahi sale ka mauka hai).

## Owner se chahiye
- Google Cloud project mein Places API + PageSpeed API on (billing card owner lagayega).
- DataForSEO / SerpApi account (owner sign-up karega).
- Haan/na: public page par phone number maangna hai ya nahi.
