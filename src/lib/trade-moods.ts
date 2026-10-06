// Each trade's mood brief (docs/website-looks-v2.md §5): which blueprint suits it first, second, third; the mood the
// designer AI starts from; which Bento tiles and which home order a customer of that trade wants. The AI decides
// for THIS business over it; when the AI is off, slow or wrong, the brief alone yields three good plans
// (moodPlans), so no build ever comes out without its three looks.
//
// The brief also carries the hero's words (docs/premium-look.md §3.1): a headline that is a claim, not the name, and
// one line of benefit, in English and Hindi, so a card the AI did not write a claim for still opens like a brand —
// at zero AI cost. Plus the type set (§2.1), whether the trade is `luxe` (ivory / espresso / gold line) and the hero
// variant per blueprint (§3.7).
//
// Isomorphic: no 'use client', no 'server-only' — the designer (server), the compose step and the trade check use it.
import type { HeroVariant, SiteStyle } from "@/lib/types";
import { BLUEPRINTS, type BlueprintKey, type TileKey } from "@/lib/site-blueprints";
import type { HomeKind } from "@/lib/site-recipes";

/** A line in both website languages (Hindi in Devanagari). */
export type Bi = { en: string; hi: string };
/** Keys of FONT_SETS (site-style.ts, §2.1): the display / text pair with its Devanagari faces. */
export type FontSetKey = "luxury" | "elegant" | "editorial" | "warm" | "clinic" | "honest" | "bold" | "tech" | "hindi";

export type TradeMood = {
  blueprints: [BlueprintKey, BlueprintKey, BlueprintKey];
  /** Mood words for the designer: tone, warmth, energy; what to avoid. */
  mood: string;
  tiles?: TileKey[];
  order?: HomeKind[];
  /** The hero's claim when the AI wrote none (≤ 6 words, never the name): "Hallmarked gold, honest prices". */
  headline: Bi;
  /** One line of benefit under it (≤ 70 chars, so "<benefit>. <City>." stays under 90). */
  benefit: Bi;
  /** Ivory paper, espresso ink, gold as a 1 px line only (§2.3): jewellery, bridal, hotels, banquets. */
  luxe?: boolean;
  fontSet: FontSetKey;
  /** The hero per blueprint (§3.7). Ship-first variants only; the no-photo fallbacks are picked at render (site-hero.ts). */
  heroVariant: Record<BlueprintKey, HeroVariant>;
};

const B = (a: BlueprintKey, b: BlueprintKey, c: BlueprintKey): [BlueprintKey, BlueprintKey, BlueprintKey] => [a, b, c];
const SHOP: TileKey[] = ["photo", "name", "contact", "open", "rating", "map", "offer", "product", "since"];
const SERVICE: TileKey[] = ["photo", "name", "contact", "open", "rating", "since", "map", "booking", "offer"];
const PERSON: TileKey[] = ["photo", "name", "contact", "rating", "booking", "since", "map", "open"];
const bi = (en: string, hi: string): Bi => ({ en, hi });
/** Ship-first heroes: the board, the full-bleed cover, the converting first slide. */
// Three patterns a phone tells apart at a glance (owner, 6 Oct 2026: "teeno same ban rahi hai — 3 alag design ka pattern
// banao"): Bento = a paper board, Cinematic = words over the photo, Story = the photo on top and a paper panel under it.
const HERO: Record<BlueprintKey, HeroVariant> = { bento: "board", cinematic: "cover", story: "slide-duo" };

type Rule = { re: RegExp; mood: TradeMood };
const RULES: Rule[] = [
  { re: /^(kirana|grocery-online|gift|optical|footwear|hardware|mobile|medical|wholesale|distributor|dairy|agri)$/, mood: { blueprints: B("bento", "story", "cinematic"), mood: "practical, quick, trustworthy; everything a customer needs at a glance — timings, call, map, what is in stock; saturated trade colour, round corners; no luxury airs", tiles: SHOP, order: ["catalog", "trust", "whyUs", "offer", "photos", "reviews", "about"] , headline: bi("Everything you need, close by", "सब ज़रूरी सामान, पास ही"), benefit: bi("Fresh stock, fair prices and home delivery", "ताज़ा स्टॉक, सही दाम और होम डिलीवरी"), fontSet: "honest", heroVariant: HERO } },
  { re: /^(garments|textile|tailor|boutique)$/, mood: { blueprints: B("story", "cinematic", "bento"), mood: "fashion: photos first, warm rose or ivory, elegant type, lively motion; the garments carry the page", tiles: ["photo", "name", "contact", "offer", "product", "open", "rating", "map"], order: ["photos", "catalog", "offer", "reviews", "about", "whyUs"] , headline: bi("Dressed for every occasion", "हर मौके के लिए तैयार"), benefit: bi("New styles every season, fittings done right", "हर सीज़न नया कलेक्शन, फ़िटिंग एकदम सही"), fontSet: "elegant", heroVariant: HERO } },
  { re: /^(jewellery)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "luxury: ivory / gold or noir, fine serif, sharp or soft corners, rings pattern, calm motion; big product showcase; never playful", tiles: ["photo", "name", "contact", "product", "rating", "since", "map", "open"], order: ["catalog", "trust", "about", "whyUs", "photos", "reviews", "offer"] , headline: bi("Hallmarked gold, honest prices", "हॉलमार्क सोना, सही दाम"), benefit: bi("Bridal sets, daily wear and 22K BIS-hallmarked jewellery", "ब्राइडल सेट, डेली वियर और 22K BIS हॉलमार्क ज्वेलरी"), luxe: true, fontSet: "luxury", heroVariant: HERO } },
  { re: /^(furniture|interior|builder|realestate|housing)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "spaces and finish: big photos, cocoa / steel / pearl, editorial or heavy type, generous white space; show the work", order: ["photos", "services", "whyUs", "steps", "reviews", "about", "booking"] , headline: bi("Spaces built to last", "ऐसे घर, जो बरसों साथ दें"), benefit: bi("Design, material and finish — one team, on time", "डिज़ाइन, सामान और फ़िनिश — एक टीम, समय पर"), fontSet: "editorial", heroVariant: HERO } },
  { re: /^(sweets|cafe|tiffin|restaurant|catering)$/, mood: { blueprints: B("story", "bento", "cinematic"), mood: "food: warm saffron / crimson / cocoa, rounded friendly type, photos and the menu first, lively; an offer up top", tiles: ["photo", "name", "contact", "open", "offer", "product", "rating", "map"], order: ["catalog", "offer", "photos", "reviews", "whyUs", "about"] , headline: bi("Fresh every morning", "हर सुबह ताज़ा"), benefit: bi("Made in our own kitchen daily, served hot and on time", "रोज़ अपनी रसोई में बना, गरम और समय पर"), fontSet: "warm", heroVariant: HERO } },
  { re: /^(hotel|spa|travel)$/, mood: { blueprints: B("cinematic", "story", "bento"), mood: "hospitality: full-screen photo, ocean / teal / gold, serif or luxury type, calm; rooms or packages as a rail; booking visible", tiles: ["photo", "name", "contact", "booking", "rating", "map", "offer", "open"], order: ["photos", "catalog", "whyUs", "reviews", "booking", "about"] , headline: bi("Rest, the way it should be", "आराम, जैसा होना चाहिए"), benefit: bi("Clean rooms, warm service and easy booking", "साफ़ कमरे, अपनापन और आसान बुकिंग"), luxe: true, fontSet: "luxury", heroVariant: HERO } },
  { re: /^(doctor|hospital|dentist|ayurveda|pharma|water|wellness)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "health: calm teal / ocean / pearl, clean modern type, trust first — timings, booking, qualifications, reviews; nothing loud", tiles: SERVICE, order: ["trust", "services", "booking", "whyUs", "reviews", "about", "steps"] , headline: bi("Care you can walk in for", "देखभाल, जिस पर भरोसा हो"), benefit: bi("Qualified doctors, clear advice and appointments on time", "योग्य डॉक्टर, साफ़ सलाह और समय पर अपॉइंटमेंट"), fontSet: "clinic", heroVariant: HERO } },
  { re: /^(gym)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "energy: dark (noir / midnight / crimson), neon accent, heavy type, lively motion; plans as a rail, transformation photos, bold CTAs", tiles: ["photo", "name", "contact", "offer", "product", "open", "rating", "map"], order: ["catalog", "whyUs", "photos", "reviews", "steps", "booking", "about"] , headline: bi("Stronger every week", "हर हफ़्ते और मज़बूत"), benefit: bi("Certified trainers, a plan for you and steady results", "प्रमाणित ट्रेनर, आपके लिए प्लान और पक्का असर"), fontSet: "bold", heroVariant: HERO } },
  { re: /^(salon|mehndi|photography|dance|event)$/, mood: { blueprints: B("story", "cinematic", "bento"), mood: "creative: photos lead, rose / royal / gold, elegant type, lively motion, rounded; portfolio before words; booking easy", tiles: ["photo", "name", "contact", "booking", "rating", "offer", "map", "open"], order: ["photos", "services", "reviews", "offer", "booking", "about", "whyUs"] , headline: bi("Your day, beautifully done", "आपका दिन, ख़ूबसूरती से"), benefit: bi("Skilled hands, on time and a look that lasts", "माहिर हाथ, समय की पाबंदी और टिकाऊ निखार"), fontSet: "elegant", heroVariant: HERO } },
  { re: /^(ca|lawyer|insurance|finance|courier|security|cleaning|it|printing)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "professional: steel / midnight / pearl, modern or tech type, soft corners, calm; services and why-us clear, the person's credentials, a strong call to action", tiles: PERSON, order: ["services", "trust", "whyUs", "steps", "reviews", "about", "booking"] , headline: bi("Advice you can act on", "सलाह, जिस पर भरोसा हो"), benefit: bi("Clear answers, work done on time and a person who picks up", "साफ़ जवाब, समय पर काम और फ़ोन पर मौजूद इंसान"), fontSet: "editorial", heroVariant: HERO } },
  { re: /^(electrician|auto|transport|manufacturer)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "hands-on: saffron / steel / crimson, heavy type, diagonal or grid pattern; call and open-now first, services, work photos, reviews", tiles: SERVICE, order: ["services", "trust", "photos", "whyUs", "reviews", "steps", "about"] , headline: bi("Fixed right the first time", "पहली बार में ही सही काम"), benefit: bi("Skilled work, genuine parts and a price agreed upfront", "माहिर काम, असली पार्ट्स और दाम पहले से तय"), fontSet: "bold", heroVariant: HERO } },
  { re: /^(school|playschool|coaching|college|computer|teacher)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "learning: ocean / emerald / royal, editorial or friendly type (friendly for small children), calm; classes, why parents choose us, steps to join, reviews", tiles: ["photo", "name", "contact", "booking", "rating", "since", "map", "open"], order: ["catalog", "whyUs", "steps", "photos", "reviews", "about", "booking"] , headline: bi("Where learning takes root", "जहाँ सीख जड़ पकड़ती है"), benefit: bi("Small batches, caring teachers and steady results", "छोटे बैच, ध्यान देने वाले शिक्षक और पक्के परिणाम"), fontSet: "editorial", heroVariant: HERO } },
  { re: /^(astro|temple|samaj|ngo|political|mla|union|club)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "community and faith: saffron / gold / crimson, editorial serif, rings or waves pattern, calm, dignified; about and the work before anything sold", tiles: PERSON, order: ["about", "services", "photos", "whyUs", "reviews", "booking"] , headline: bi("Together, for the community", "साथ मिलकर, समाज के लिए"), benefit: bi("Our work, our people and how you can take part", "हमारा काम, हमारे लोग और आप कैसे जुड़ सकते हैं"), fontSet: "editorial", heroVariant: HERO } },
  { re: /^(mlm|sales|agent|influencer|personal|employee|govt|army|student)$/, mood: { blueprints: B("story", "bento", "cinematic"), mood: "a person: their portrait, one colour, modern type; what they do, proof, how to reach them — short", tiles: ["photo", "name", "contact", "rating", "since", "map"], order: ["about", "services", "whyUs", "reviews", "photos"] , headline: bi("Let's work together", "आइए, साथ काम करें"), benefit: bi("What I do, who I have helped and how to reach me", "मेरा काम, मेरे ग्राहक और मुझसे संपर्क का तरीका"), fontSet: "tech", heroVariant: HERO } },
];
const DEFAULT: TradeMood = { blueprints: B("bento", "cinematic", "story"), mood: "clear and modern: one trade colour, clean type, soft corners, calm motion; the business's facts at a glance", tiles: SHOP, headline: bi("Good work, done properly", "अच्छा काम, पूरी ज़िम्मेदारी से"), benefit: bi("Fair prices, on time, every time", "सही दाम, समय पर, हर बार"), fontSet: "tech", heroVariant: HERO };

export function tradeMood(category: string | undefined): TradeMood {
  const key = (category ?? "").toLowerCase();
  return RULES.find((r) => r.re.test(key))?.mood ?? DEFAULT;
}

export type MoodPlan = { blueprint: BlueprintKey; style: SiteStyle; order?: HomeKind[]; tiles?: TileKey[]; why: string };

const LIGHT = new Set(["ivory", "pearl"]);
const WARM = new Set(["saffron", "gold", "cocoa", "crimson", "rose", "ivory"]);
/** Three plans from the brief alone — the trade's first blueprint with `base` (the trade's / designer's style), then
 *  the other two carrying base's palette and type; Cinematic always on a dark palette. Each plan names its hero
 *  variant (§3.7), so `derive()` (site-looks.ts) and the editor never see a blueprint without one. */
export function moodPlans(category: string | undefined, base: SiteStyle): MoodPlan[] {
  const m = tradeMood(category);
  return m.blueprints.map((key, i) => {
    const bp = BLUEPRINTS.find((b) => b.key === key)!;
    const { hero: _h, layouts: _l, ...paint } = base; void _h; void _l;
    const style: SiteStyle = { ...paint, ...bp.defaults, blueprint: key, heroVariant: m.heroVariant[key] };
    if (i === 0 && base.hero) style.hero = base.hero;
    if (key === "cinematic" && (!style.palette || LIGHT.has(style.palette))) style.palette = WARM.has(base.palette ?? "") ? "cocoa" : "midnight";
    if (key === "cinematic" && style.palette !== "brand") delete style.color;
    return { blueprint: key, style, ...(m.order ? { order: m.order } : {}), ...(key === "bento" && m.tiles ? { tiles: m.tiles } : {}), why: i === 0 ? `${bp.name}: the usual fit for this trade.` : `${bp.name}: a second take on the same website.` };
  });
}
