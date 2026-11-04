# Backlog: AI search (AEO / GEO) — ChatGPT & Gemini visibility

Status: NOT STARTED — owner asked to build later (noted 4 Nov 2026).

## Already in the software (foundation)
- LocalBusiness / Person structured data (JSON-LD) on every card and website — src/lib/seo.ts
- FAQPage structured data from FAQ blocks — src/lib/seo.ts, src/app/(marketing)
- sitemap.xml + robots.txt (AI bots are not blocked) — src/app/sitemap.ts, src/app/robots.ts

## To build later
1. llms.txt per website/card (business summary, services, area, contact, key pages) for AI crawlers.
2. Auto FAQ: generate 8–12 real customer questions + answers per business (in its language), kept fresh.
3. Monthly "AI visibility" report: ask ChatGPT/Gemini/Perplexity sample local questions
   ("best <category> in <city>") and show whether the business appears; tips to improve.
4. Optional: explicit robots rules allowing GPTBot, OAI-SearchBot, Google-Extended, PerplexityBot, ClaudeBot.
5. Add to the ₹2,999/month subscription as "AI search (AEO/GEO)".

## Wording rule (until built)
- Do NOT promise "found on ChatGPT & Gemini". Use: "Ready for AI search — ChatGPT & Gemini".
