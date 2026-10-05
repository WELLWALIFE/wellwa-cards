import "server-only";
import { logUsage } from "@/lib/ai-usage";
// AI card writer: turns what the owner tells us about the business (plus an optional reference website) into the
// WORDS of a card — trade line, tagline, about, services, FAQ, timings, section titles, button text — and, if asked,
// AI photos. It never decides facts: prices, photos, trust tiles and which blocks exist are placed by code
// (card-compose.ts for the free V-Card, assembleCard below for the paid AI card).
// The result is NOT saved here: the owner checks it and publishes.
import { aiImage, storeImage } from "@/lib/media/ai-image";
import type { Reference } from "@/lib/reference-site";
import type { CardBlock, CardLink, CardPage, FaqItem, HoursRow, ServiceItem } from "@/lib/types";
import type { TemplateCard } from "@/lib/templates";
import { TITLE_KEYS, fallbackTitles, titlesFor, type TitleKey } from "@/lib/card-compose";

export type { TitleKey } from "@/lib/card-compose";
import type { ThinSpot } from "@/lib/card-text";

export type CardBrief = {
  business: string;      // business / brand name
  person?: string;       // owner's name (optional)
  category: string;      // what they do, e.g. "Dentist", "Sweet shop"
  city?: string;
  phone?: string;        // WhatsApp / call number
  email?: string;
  details: string;       // the owner's own words (+ their own website's text): products/services, prices, timings, speciality
  lang?: "en" | "hi" | "hinglish";
  persona?: string;      // the category's persona, e.g. "business", "professional"
  booking?: boolean;     // a trade that takes appointments (doctor, salon, CA …)
  products?: string[];   // the exact product names on the card
  /** The business's OWN website was read: the trade above was confirmed from it, and its words lead. */
  ownSite?: string;
  /** The trade's guide (site-recipes.ts): what the about must explain, the usual services, why-us points, steps
   *  and customer questions of this trade — in English; the AI adapts them to the facts and the card language. */
  guide?: TradeGuide;
};

export type TradeGuide = {
  catalog: string;          // what the things are called: "products", "menu", "treatments", "courses"…
  explain: string[];
  services: string[];       // "name — what the customer gets"
  whyUs: string[];
  steps: string[];          // "name — desc"
  faq: string[];            // questions
};

/** The words the AI writes for a card. Every field is checked and capped before it is returned. */
export type CardCopy = {
  jobTitle: string;
  tagline: string;
  about: string;
  color: string;
  highlights: string[];
  services: ServiceItem[];
  offer: { title: string; text: string } | null;
  hours: HoursRow[];
  faq: FaqItem[];
  contactNote: string;
  /** Soft promises without numbers ("Clear pricing", "Reply on WhatsApp within the hour") — 4-6 short points. */
  promise: string[];
  /** "How it works" — 3-5 steps a new customer goes through, in this trade. */
  steps: ServiceItem[];
  /** One more paragraph for the website and the About page: what such a business does for its customers. */
  more: string;
  titles: Partial<Record<TitleKey, string>>;
  cta: string;
  hero: { sub: string };
  productLines: Record<string, string>;
  seoTitle: string;
  seoDescription: string;
};

const LANG = { en: "simple Indian English", hi: "Hindi (Devanagari)", hinglish: "Hinglish (Hindi in Roman letters)" } as const;
const COLORS = ["#2f5bf5", "#0e9e90", "#c2410c", "#7c3aed", "#be185d", "#15803d", "#0369a1", "#b45309"];
// The card's words decide whether it looks premium, so they come from the stronger model (owner's call, 27 Sep 2026:
// "AI expert jaisa card banaye, ek baar me hi accha"); the light model is the fallback when it does not answer.
const MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
const endpoint = (m: string) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
const uid = () => Math.random().toString(36).slice(2, 10);

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {});
/** Trimmed text of at most n characters, never ending in half an emoji. */
const S = (v: unknown, n: number) => {
  let s = (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim().slice(0, n);
  const last = s.charCodeAt(s.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1);
  return s.trim();
};
/** At most n characters, cut at a word boundary. */
const words = (v: unknown, n: number) => {
  const s = S(v, 2000).replace(/\s+/g, " ");
  if (s.length <= n) return s;
  const cut = s.slice(0, n + 1);
  const sp = cut.lastIndexOf(" ");
  return S(sp > n * 0.6 ? cut.slice(0, sp) : cut.slice(0, n), n).replace(/[,;:\-–—]+$/, "").trim();
};
const strs = (a: unknown, n: number, len: number) => (Array.isArray(a) ? a.map((x) => S(x, len)).filter(Boolean).slice(0, n) : []);

/* The list's last entry, "Other", is not a trade and is never written (owner's test, 5 Oct 2026: the prompt read
   "a complete website of a Other"). In a sentence such a business is "a local business"; as a label, "Business". */
const isOther = (c: string) => !c.trim() || /^(other|others|अन्य)$/i.test(c.trim());
const tradeIn = (b: CardBrief) => (isOther(b.category) ? "local business" : b.category);
const tradeLabel = (b: CardBrief) => (isOther(b.category) ? "Business" : b.category);

/* A number the owner never gave (a year, "500+ customers", "10 years") is an invented fact. The prompt forbids them;
   this is the check behind it: every number in the free text must also be in the facts, or that sentence goes. */
const DEV_DIGITS = "०१२३४५६७८९";
const numbersIn = (s: string) => (s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d))).replace(/(\d),(?=\d)/g, "$1").match(/\d+/g) ?? []);
/** The number test for one set of facts. `backed(text)` is true when every number in it was given by the
 *  owner; `keep(text)` is that text without the sentences carrying a number the facts do not have.
 *  Exported so the paid website writer checks its words exactly the way the free V-Card does. */
export function numberCheck(facts: string) {
  const known = new Set(numbersIn(facts)
    .flatMap((n) => [n, String(Number(n)), ...(Number(n) >= 1 && Number(n) <= 12 ? [String(Number(n) + 12)] : [])])); // 8 PM → 20:00
  const backed = (s: string) => numbersIn(s).every((n) => n === "00" || known.has(n) || known.has(String(Number(n))));
  /** The text without the sentences that carry a number the facts do not have. */
  const keep = (text: string) => text.split(/\n+/)
    .map((par) => (backed(par) ? par.trim() : (par.match(/(?:[^.!?।]|[.!?।](?!\s|$))+[.!?।]*/g) ?? []).map((x) => x.trim()).filter((x) => x && backed(x)).join(" ")))
    .filter(Boolean).join("\n\n");
  return { backed, keep };
}

/** Everything the owner told us, as one string, for numberCheck. */
const briefFacts = (brief: CardBrief) =>
  [brief.details, brief.business, brief.person, brief.city, brief.phone, brief.email, ...(brief.products ?? [])].filter(Boolean).join(" ");

/** Words built by code from the facts alone. Used only when the AI's tagline or about was thrown away for
 *  carrying an invented number ("since 1985" for a shop that never gave a year): a card that says just what
 *  the owner told us is far better than a failed build, which would also cost one of the 6 builds an hour. */
function plainCopy(brief: CardBrief, lang: keyof typeof LANG): { tagline: string; about: string } {
  const where = brief.city ? (lang === "en" ? ` in ${brief.city}` : `, ${brief.city}`) : "";
  const line = `${brief.business}${isOther(brief.category) ? "" : ` — ${brief.category}`}${where}`.replace(/\s+/g, " ").trim();
  return { tagline: words(line, 90), about: `${line}${lang === "hi" ? "।" : "."}` };
}

function prompt(brief: CardBrief, lang: keyof typeof LANG, ref?: Reference | null): string {
  const products = (brief.products ?? []).filter(Boolean).slice(0, 12);
  const en = fallbackTitles("en");
  const titleMeaning = TITLE_KEYS.map((k) => `${k} = "${en[k]}"`).join("; ");
  const trade = tradeIn(brief);
  const tradeFact = isOther(brief.category) ? "not named — a local business; take what it does or sells from the owner's words below" : brief.category;
  return `You are a senior brand copywriter and web designer. You write the words for the digital business card (V-Card) of a small business in India, so that it looks and reads like a premium brand's website — the owner is not an expert, you are, and it must be excellent on the first try. Write every text value in ${LANG[lang]}. Return ONLY JSON.

QUALITY (what makes it premium)
- Specific, never generic: use this business's own product names, services, specialities, city and website details. Every line must be true of THIS business, not of any shop.
- Banned filler: "one-stop solution", "best quality", "customer satisfaction is our priority", "we are committed to excellence", "wide range of", "top-notch", "state-of-the-art", "world-class", "trusted by thousands", "look no further".
- Lead with what the customer gets (taste, comfort, time saved, peace of mind, a better look, a job done right) — then how.
- Confident, warm, calm: short sentences, concrete nouns, no exclamation marks, no emojis, no ALL CAPS, no hype.
- The tagline is memorable and specific (4-8 words): the craft, the benefit or the place — like a premium brand's line.
- Section titles are short and inviting, never dull labels.
- When the owner's website gives products, specifications or services, use them fully and accurately — they are the owner's own words.

FACTS (the only source of truth)
Business name: ${brief.business}
Owner: ${brief.person || "(not given)"}
Trade: ${tradeFact}${brief.ownSite ? " (confirmed from the business's own website — the site's words describe what it sells or does; older form notes that disagree are wrong)" : ""}
City: ${brief.city || "(not given)"}
Booking business: ${brief.booking ? "yes" : "no"}
Products on the card (exact names): ${products.length ? products.join(" | ") : "(none)"}
In the owner's words (and, if given, text from the owner's OWN website — its facts may be used):
${brief.details.slice(0, 8000)}
${ref ? `
REFERENCE WEBSITE the owner likes (${ref.url}) — only for tone and the kind of sections. Never copy its sentences, names, prices or claims.
${ref.summary}
` : ""}${brief.guide ? `
TRADE GUIDE — what a complete website of a ${trade} covers (adapt to THIS business's facts; keep what applies; the owner's own items always come first; write in the card language):
- The ${brief.guide.catalog} are what this business offers; call them that.
- The about must explain: ${brief.guide.explain.join("; ")}.
- Usual services of the trade: ${brief.guide.services.join(" | ")}
- Why customers choose a good ${trade}: ${brief.guide.whyUs.join(" | ")}
- How a new customer works with such a business: ${brief.guide.steps.join(" | ")}
- Questions new customers ask: ${brief.guide.faq.join(" | ")}
` : ""}
JSON shape:
{"jobTitle":"","tagline":"","about":"","hero":{"sub":""},"color":"<one of ${COLORS.join(", ")} that suits the business>",
 "highlights":[""],"services":[{"name":"","desc":""}],"offer":{"title":"","text":""},
 "hours":[{"day":"","time":""}],"faq":[{"q":"","a":""}],"contactNote":"","cta":"",
 "promise":[""],"steps":[{"name":"","desc":""}],"more":"",
 "titles":{${TITLE_KEYS.map((k) => `"${k}":""`).join(",")}},
 "productLines":{${products.map((p) => `${JSON.stringify(p)}:""`).join(",")}},
 "seoTitle":"","seoDescription":""}

RULES
1. Use ONLY the facts above. If the facts do not say something, leave it out.
2. Never invent prices, discounts, years, numbers, awards, certifications, customer counts, qualifications, medical specialisations, reviews or guarantees.
3. No health, cure or income claims.
4. jobTitle: at most 5 words — the trade in plain words (e.g. "Sweets & Namkeen"), never a qualification or speciality.
5. tagline: at most 10 words, no claims.
6. about: 110-170 words in 2-3 short paragraphs (separate with a blank line), first person plural ("we"). Paragraph 1: who we are and what we offer, from the facts. Paragraph 2: how we work with customers in this trade — written in general words that are true of any good ${trade} (care, quality, honest advice, timely service), with no numbers and no claims. Paragraph 3 (optional): where we are and how to reach us. Never pad with adjectives; every sentence must say something.
7. hero.sub: at most 25 words — what they offer and where, worded differently from "about".
8. services: 5-7 items. Use the services the owner named (and the ones the website shows); then the usual services of this trade from the TRADE GUIDE that fit, worded for THIS business (the owner can delete any). Never repeat a product name, never a price. desc at most 20 words, explaining what the customer gets. Never a vague item like "Connect with us" or "Explore options" — every item is a real service.
9. highlights: 0-4 short points, only from the facts.
9b. promise: 5-7 points of at most 6 words each — why customers choose this business: first the ones the facts support (ghee, hallmark, degree, areas, timings, delivery, warranty — without numbers), then the trade's usual reasons from the guide. NO numbers, awards or guarantees.
9c. steps: 3-4 steps of how a new customer works with us in this trade, in order ("Message us on WhatsApp" → … → the result), name at most 5 words, desc at most 18 words, no numbers; specific to the trade (a sweet shop: pick, order, packed, delivered; a clinic: book, visit, treatment, follow-up), never "Connect with us / Explore options / Finalise".
9d. more: 60-110 words for the website's About section — what customers in this city or trade look for and how we help, worded differently from "about", no numbers or claims.
10. offer: only when the owner gave an offer, else {"title":"","text":""}.
11. hours: only when timings were given, else [].
12. faq: 6-8 questions a new customer of a ${trade} asks. First the ones answered by the facts (timings, payment, delivery, areas served, since when, offer, address, booking). Then the trade's usual questions (TRADE GUIDE) answered in general words with NO numbers, prices, durations or guarantees unless the facts give them; when in doubt the answer says "message us on WhatsApp and we will tell you". Answers 15-40 words.
13. contactNote: 1 short sentence inviting a WhatsApp message or a call.
14. cta: a 2-4 word button text in the card language: "Book" wording for a booking business, "Order" wording for shops that sell products, otherwise "Enquire" wording (e.g. "Order on WhatsApp").
15. titles: fill every key with a short heading in the card language. Meaning in English: ${titleMeaning}.
16. productLines: for each exact product name, at most 18 words taken from the facts, or "" when nothing is known about it.
17. seoTitle at most 60 characters; seoDescription at most 155 characters.
18. Write prices only as the owner gave them, with the ₹ sign.`;
}

/** One AI call → the parsed JSON object. Throws on a network error, an HTTP error or a reply that is not JSON. */
async function ask(key: string, text: string, timeoutMs: number, model = MODELS[0]): Promise<Obj> {
  const r = await fetch(endpoint(model), {
    method: "POST", signal: AbortSignal.timeout(timeoutMs),
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.35, maxOutputTokens: 6000 } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`AI error ${r.status}`);
  logUsage("card-copy", model, j?.usageMetadata);
  const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { text?: unknown; thought?: unknown }[];
  const out = parts.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text as string).join("").trim();
  try {
    const v = JSON.parse(out);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Obj;
  } catch { /* try the outermost {…} below */ }
  const a = out.indexOf("{"), b = out.lastIndexOf("}");
  const v = a >= 0 && b > a ? JSON.parse(out.slice(a, b + 1)) : null; // throws when it is still not JSON
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("AI reply was not JSON");
  return v as Obj;
}

/** The raw AI JSON → a checked, capped CardCopy. */
function toCopy(raw: Obj, brief: CardBrief): CardCopy {
  const products = (brief.products ?? []).filter(Boolean);
  const productSet = new Set(products.map((p) => p.toLowerCase()));
  const rawTitles = obj(raw.titles);
  const titles: Partial<Record<TitleKey, string>> = {};
  for (const k of TITLE_KEYS) {
    const v = S(rawTitles[k], 60).replace(/\s+/g, " ");
    if (v && v.length <= 40) titles[k] = v;
  }
  const rawLines = obj(raw.productLines);
  const { backed, keep } = numberCheck(briefFacts(brief));
  const productLines: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawLines).slice(0, 24)) {
    const name = products.find((p) => p.toLowerCase() === k.trim().toLowerCase()) ?? (products.length ? "" : S(k, 80));
    const line = keep(S(v, 160).replace(/\s+/g, " "));
    if (name && line) productLines[name] = line;
  }
  const offer = obj(raw.offer);
  const cta = S(raw.cta, 60).replace(/\s+/g, " ");
  return {
    jobTitle: [S(raw.jobTitle, 60)].filter((x) => backed(x) && !isOther(x))[0] || tradeLabel(brief).slice(0, 60),
    tagline: keep(S(raw.tagline, 90)), about: keep(S(raw.about, 1400)),
    color: typeof raw.color === "string" && COLORS.includes(raw.color) ? raw.color : COLORS[0],
    highlights: strs(raw.highlights, 8, 40).filter(backed).slice(0, 4),
    services: (Array.isArray(raw.services) ? raw.services : []).map((x) => ({ name: S(obj(x).name, 60), desc: keep(S(obj(x).desc, 160)) }))
      .filter((x) => x.name && backed(x.name) && !productSet.has(x.name.toLowerCase())).slice(0, 6),
    offer: S(offer.text, 200) && backed(`${S(offer.title, 60)} ${S(offer.text, 200)}`) ? { title: S(offer.title, 60) || "Offer", text: S(offer.text, 200) } : null,
    hours: (Array.isArray(raw.hours) ? raw.hours : []).map((x) => ({ day: S(obj(x).day, 30), time: S(obj(x).time, 30) })).filter((x) => x.day && x.time).slice(0, 7),
    faq: (Array.isArray(raw.faq) ? raw.faq : []).map((x) => ({ q: S(obj(x).q, 120), a: S(obj(x).a, 320) })).filter((x) => x.q && x.a && backed(`${x.q} ${x.a}`)).slice(0, 8),
    contactNote: keep(S(raw.contactNote, 160)),
    promise: strs(raw.promise, 8, 48).filter((x) => !/\d/.test(x)).slice(0, 6),
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map((x) => ({ name: S(obj(x).name, 50), desc: S(obj(x).desc, 140) })).filter((x) => x.name && !/\d/.test(`${x.name} ${x.desc}`)).slice(0, 5),
    more: keep(S(raw.more, 900)),
    titles,
    cta: cta.length <= 32 ? cta : "",
    hero: { sub: keep(words(obj(raw.hero).sub, 200)) },
    productLines,
    seoTitle: [words(raw.seoTitle, 60)].filter(backed)[0] ?? "",
    seoDescription: keep(words(raw.seoDescription, 155)),
  };
}

/** The text fields a card cannot do without, and whether this copy has them. The lists (services, promise,
 *  steps, FAQ) are not here: the composer fills those from the trade's own seeds, which costs nothing. */
const TEXT_GAPS = ["tagline", "about", "more", "hero"] as const;
function textGaps(c: CardCopy): string[] {
  return TEXT_GAPS.filter((k) => (k === "hero" ? !c.hero.sub : !c[k]) || (k === "about" && c.about.split(/\s+/).length < 60));
}

/** One short, text-only second ask for the fields the first reply left empty or too short (owner's call,
 *  1 Oct 2026: a thin reply used to go through unnoticed). Same facts, the light model, a few hundred tokens. */
function gapPrompt(brief: CardBrief, lang: keyof typeof LANG, gaps: string[]): string {
  const want = gaps.map((g) => g === "hero" ? `"hero":{"sub":""} — at most 25 words: what they offer and where` : g === "about" ? `"about":"" — 110-170 words in 2-3 short paragraphs, first person plural, from the facts only${brief.guide ? `, and it must explain: ${brief.guide.explain.join("; ")}` : ""}` : g === "more" ? `"more":"" — 60-110 words for the website's About section, worded differently from the about` : `"tagline":"" — 4-8 memorable words, no claims`).join("\n");
  return `You write the words for a small Indian business's website. Write in ${LANG[lang]}. Use ONLY these facts; never invent numbers, years, prices, awards or claims. Return ONLY a JSON object with exactly these keys:
${want}

Business: ${brief.business}${brief.person ? ` (owner ${brief.person})` : ""}
Trade: ${tradeIn(brief)}
City: ${brief.city || "(not given)"}
Facts:
${brief.details.slice(0, 5000)}`;
}

/** One short ask for exactly the spots the text manager found thin on the BUILT card (card-text.ts): a line under
 *  a service, an answer to a question, a product's line, the about text. id → text; a spot the AI skips is
 *  simply absent, and the caller fills it plainly. Light model, bounded; throws only on a dead connection. */
export async function fillThinText(brief: CardBrief, thin: ThinSpot[]): Promise<Record<string, string>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !thin.length) return {};
  const lang = brief.lang && LANG[brief.lang] ? brief.lang : "en";
  const list = thin.slice(0, 18).map((t) => `"${t.id}": ${t.want}${t.have ? ` (now: "${t.have.replace(/\s+/g, " ").slice(0, 160)}")` : ""}`).join("\n");
  const text = `You finish the words of a small Indian business's website. Write in ${LANG[lang]}. Use ONLY the facts below; never invent numbers, years, prices, awards or claims. No filler ("best quality", "one-stop solution", "customer satisfaction", "wide range", "top-notch"). Be specific to THIS business. Return ONLY a JSON object whose keys are exactly these ids and whose values are the text asked for:
${list}

Business: ${brief.business}${brief.person ? ` (owner ${brief.person})` : ""}
Trade: ${tradeIn(brief)}
City: ${brief.city || "(not given)"}
Products: ${(brief.products ?? []).slice(0, 12).join(", ") || "(none)"}
Facts:
${brief.details.slice(0, 5000)}`;
  const raw = await ask(key, text, 35_000, MODELS[MODELS.length - 1]);
  const { keep } = numberCheck(briefFacts(brief));
  const out: Record<string, string> = {};
  for (const t of thin) {
    const v = raw[t.id];
    if (typeof v !== "string") continue;
    const k = keep(S(v, t.id === "about" ? 1400 : 360));
    if (k) out[t.id] = k;
  }
  return out;
}

/** The card's words from the facts. One call; a short second one only for the text it left thin; then it throws. */
export async function writeCard(brief: CardBrief, ref?: Reference | null): Promise<CardCopy> {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("AI not configured");
  const lang = brief.lang && LANG[brief.lang] ? brief.lang : "en";
  const text = prompt(brief, lang, ref);
  let last: unknown = null;
  let partial: CardCopy | null = null;
  const score = (c: CardCopy) => (c.tagline ? 1 : 0) + (c.about ? 1 : 0);
  // Two tries inside the routes' 150 s limit (the second one is shorter, on the light model).
  for (const [i, timeout] of [55_000, 45_000].entries()) {
    try {
      const raw = await ask(key, text, timeout, MODELS[Math.min(i, MODELS.length - 1)]);
      let out = toCopy(raw, brief);
      if (out.tagline && out.about) {
        // Thin text (a short about, no hero line, no second paragraph): one bounded ask for just those fields.
        const gaps = textGaps(out);
        if (gaps.length) {
          try {
            const more = toCopy({ ...raw, ...(await ask(key, gapPrompt(brief, lang, gaps), 30_000, MODELS[MODELS.length - 1])) }, brief);
            out = {
              ...out,
              tagline: out.tagline || more.tagline,
              about: more.about.split(/\s+/).length > out.about.split(/\s+/).length ? more.about : out.about,
              more: out.more || more.more,
              hero: { sub: out.hero.sub || more.hero.sub },
            };
          } catch { /* the first reply stands */ }
        }
        return out;
      }
      // The AI DID write a tagline and an about text, but the invented-number filter emptied one of them.
      // An empty reply (a refusal, a safety block) is still a failure and is retried, then thrown.
      if (S(raw.tagline, 90) && S(raw.about, 1400) && (!partial || score(out) > score(partial))) partial = out;
      last = new Error("AI copy incomplete");
    } catch (e) { last = e; }
  }
  // The AI answered, but one invented number emptied the (single-sentence) tagline or the about text. That is a
  // content problem, not a broken connection: fill those two from the facts instead of failing the whole build.
  if (partial) {
    const plain = plainCopy(brief, lang);
    return { ...partial, tagline: partial.tagline || plain.tagline, about: partial.about || plain.about };
  }
  throw last instanceof Error ? last : new Error("AI did not respond");
}

export async function makeCardPhotos(userId: string, brief: CardBrief, count: number) {
  // Scenes only: no people, no shop, no brand. A photo must never pretend to show the owner, their team or their place.
  const trade = isOther(brief.category) ? "small business" : brief.category.trim();
  const slots = [
    { key: "cover", ratio: "16:9" as const, prompt: `Wide, softly blurred ambience photograph suggesting a ${trade} in India — surfaces, light and colour only. No people, faces or hands, no text, no logos, no brand names, not a specific shop.` },
    { key: "about", ratio: "4:3" as const, prompt: `Close-up still-life photograph of everyday tools or materials of a ${trade}, soft light. No people, no text, no logos, no brand names.` },
  ].slice(0, Math.max(0, count));
  const made = await Promise.all(slots.map(async (s) => {
    const png = await aiImage(s.prompt, s.ratio);
    const url = png ? await storeImage(userId, `card-${s.key}`, png) : null;
    return url ? { key: s.key, url } : null;
  }));
  return made.filter((x): x is { key: string; url: string } => !!x);
}

/** Assemble the card document the editor opens (the paid AI card). */
export function assembleCard(brief: CardBrief, c: CardCopy, photos: { key: string; url: string }[]): TemplateCard {
  const lang = brief.lang ?? "en";
  const t = titlesFor(lang, c.titles, !!brief.booking);
  const photo = (k: string) => photos.find((p) => p.key === k)?.url;
  const digits = (brief.phone ?? "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `+91${digits}` : digits ? `+${digits}` : "+91";
  const links: CardLink[] = [
    { id: uid(), type: "whatsapp", label: "WhatsApp", value: phone },
    { id: uid(), type: "phone", label: "Call", value: phone },
    ...(brief.email ? [{ id: uid(), type: "email" as const, label: "Email", value: brief.email }] : []),
  ];
  const home: CardBlock[] = [
    { id: uid(), kind: "about", title: t.about, body: c.about, imageUrl: photo("about") },
    ...(c.highlights.length >= 2 ? [{ id: uid(), kind: "highlights" as const, title: t.highlights, items: c.highlights }] : []),
    ...(c.services.length ? [{ id: uid(), kind: "services" as const, title: t.services, items: c.services }] : []),
    ...(c.offer ? [{ id: uid(), kind: "offer" as const, title: c.offer.title || t.offer, text: c.offer.text, code: "", expires: "" }] : []),
    ...(c.hours.length ? [{ id: uid(), kind: "hours" as const, title: t.hours, rows: c.hours }] : []),
    { id: uid(), kind: "contact", title: t.contact, note: c.contactNote },
  ];
  const faq: CardBlock[] = c.faq.length >= 2 ? [{ id: uid(), kind: "faq", title: t.faq, items: c.faq }] : [];
  const visit: CardBlock[] = [
    ...(brief.city ? [{ id: uid(), kind: "location" as const, title: t.location, address: brief.city }] : []),
    { id: uid(), kind: "contact", title: t.contact, note: c.contactNote },
  ];
  const pages: CardPage[] = [
    { id: uid(), slug: "home", label: t.home, blocks: home },
    ...(faq.length ? [{ id: uid(), slug: "faq", label: lang === "hi" ? "सवाल" : "FAQ", blocks: faq }] : []),
    { id: uid(), slug: "contact", label: t.contactPage, blocks: visit },
  ];
  return {
    name: brief.person || brief.business, jobTitle: c.jobTitle, company: brief.person ? brief.business : "",
    tagline: c.tagline, about: c.about,
    avatarColor: c.color, themeColor: c.color, template: "gradient", verified: false,
    coverUrl: photo("cover"),
    links, pages,
    botKnowledge: `${brief.business} — ${tradeLabel(brief)}${brief.city ? `, ${brief.city}` : ""}.\n${brief.details.slice(0, 3000)}`,
    language: lang,
    seo: { category: tradeLabel(brief).slice(0, 60), ...(brief.city ? { city: brief.city.slice(0, 40) } : {}) },
  };
}
