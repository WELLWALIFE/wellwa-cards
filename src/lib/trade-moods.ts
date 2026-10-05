// Each trade's mood brief (docs/website-looks-v2.md §5): which blueprint suits it first, second, third; the mood the
// designer AI starts from; which Bento tiles and which home order a customer of that trade wants. The AI decides
// for THIS business over it; when the AI is off, slow or wrong, the brief alone yields three good plans
// (moodPlans), so no build ever comes out without its three looks.
//
// Isomorphic: no 'use client', no 'server-only' — the designer (server), the compose step and the trade check use it.
import type { SiteStyle } from "@/lib/types";
import { BLUEPRINTS, type BlueprintKey, type TileKey } from "@/lib/site-blueprints";
import type { HomeKind } from "@/lib/site-recipes";

export type TradeMood = {
  blueprints: [BlueprintKey, BlueprintKey, BlueprintKey];
  /** Mood words for the designer: tone, warmth, energy; what to avoid. */
  mood: string;
  tiles?: TileKey[];
  order?: HomeKind[];
};

const B = (a: BlueprintKey, b: BlueprintKey, c: BlueprintKey): [BlueprintKey, BlueprintKey, BlueprintKey] => [a, b, c];
const SHOP: TileKey[] = ["photo", "name", "contact", "open", "rating", "map", "offer", "product", "since"];
const SERVICE: TileKey[] = ["photo", "name", "contact", "open", "rating", "since", "map", "booking", "offer"];
const PERSON: TileKey[] = ["photo", "name", "contact", "rating", "booking", "since", "map", "open"];

type Rule = { re: RegExp; mood: TradeMood };
const RULES: Rule[] = [
  { re: /^(kirana|grocery-online|gift|optical|footwear|hardware|mobile|medical|wholesale|distributor|dairy|agri)$/, mood: { blueprints: B("bento", "story", "cinematic"), mood: "practical, quick, trustworthy; everything a customer needs at a glance — timings, call, map, what is in stock; saturated trade colour, round corners; no luxury airs", tiles: SHOP, order: ["catalog", "trust", "whyUs", "offer", "photos", "reviews", "about"] } },
  { re: /^(garments|textile|tailor|boutique)$/, mood: { blueprints: B("story", "cinematic", "bento"), mood: "fashion: photos first, warm rose or ivory, elegant type, lively motion; the garments carry the page", tiles: ["photo", "name", "contact", "offer", "product", "open", "rating", "map"], order: ["photos", "catalog", "offer", "reviews", "about", "whyUs"] } },
  { re: /^(jewellery)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "luxury: ivory / gold or noir, fine serif, sharp or soft corners, rings pattern, calm motion; big product showcase; never playful", tiles: ["photo", "name", "contact", "product", "rating", "since", "map", "open"], order: ["catalog", "trust", "about", "whyUs", "photos", "reviews", "offer"] } },
  { re: /^(furniture|interior|builder|realestate|housing)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "spaces and finish: big photos, cocoa / steel / pearl, editorial or heavy type, generous white space; show the work", order: ["photos", "services", "whyUs", "steps", "reviews", "about", "booking"] } },
  { re: /^(sweets|cafe|tiffin|restaurant|catering)$/, mood: { blueprints: B("story", "bento", "cinematic"), mood: "food: warm saffron / crimson / cocoa, rounded friendly type, photos and the menu first, lively; an offer up top", tiles: ["photo", "name", "contact", "open", "offer", "product", "rating", "map"], order: ["catalog", "offer", "photos", "reviews", "whyUs", "about"] } },
  { re: /^(hotel|spa|travel)$/, mood: { blueprints: B("cinematic", "story", "bento"), mood: "hospitality: full-screen photo, ocean / teal / gold, serif or luxury type, calm; rooms or packages as a rail; booking visible", tiles: ["photo", "name", "contact", "booking", "rating", "map", "offer", "open"], order: ["photos", "catalog", "whyUs", "reviews", "booking", "about"] } },
  { re: /^(doctor|hospital|dentist|ayurveda|pharma|water|wellness)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "health: calm teal / ocean / pearl, clean modern type, trust first — timings, booking, qualifications, reviews; nothing loud", tiles: SERVICE, order: ["trust", "services", "booking", "whyUs", "reviews", "about", "steps"] } },
  { re: /^(gym)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "energy: dark (noir / midnight / crimson), neon accent, heavy type, lively motion; plans as a rail, transformation photos, bold CTAs", tiles: ["photo", "name", "contact", "offer", "product", "open", "rating", "map"], order: ["catalog", "whyUs", "photos", "reviews", "steps", "booking", "about"] } },
  { re: /^(salon|mehndi|photography|dance|event)$/, mood: { blueprints: B("story", "cinematic", "bento"), mood: "creative: photos lead, rose / royal / gold, elegant type, lively motion, rounded; portfolio before words; booking easy", tiles: ["photo", "name", "contact", "booking", "rating", "offer", "map", "open"], order: ["photos", "services", "reviews", "offer", "booking", "about", "whyUs"] } },
  { re: /^(ca|lawyer|insurance|finance|courier|security|cleaning|it|printing)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "professional: steel / midnight / pearl, modern or tech type, soft corners, calm; services and why-us clear, the person's credentials, a strong call to action", tiles: PERSON, order: ["services", "trust", "whyUs", "steps", "reviews", "about", "booking"] } },
  { re: /^(electrician|auto|transport|manufacturer)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "hands-on: saffron / steel / crimson, heavy type, diagonal or grid pattern; call and open-now first, services, work photos, reviews", tiles: SERVICE, order: ["services", "trust", "photos", "whyUs", "reviews", "steps", "about"] } },
  { re: /^(school|playschool|coaching|college|computer|teacher)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "learning: ocean / emerald / royal, editorial or friendly type (friendly for small children), calm; classes, why parents choose us, steps to join, reviews", tiles: ["photo", "name", "contact", "booking", "rating", "since", "map", "open"], order: ["catalog", "whyUs", "steps", "photos", "reviews", "about", "booking"] } },
  { re: /^(astro|temple|samaj|ngo|political|mla|union|club)$/, mood: { blueprints: B("cinematic", "bento", "story"), mood: "community and faith: saffron / gold / crimson, editorial serif, rings or waves pattern, calm, dignified; about and the work before anything sold", tiles: PERSON, order: ["about", "services", "photos", "whyUs", "reviews", "booking"] } },
  { re: /^(mlm|sales|agent|influencer|personal|employee|govt|army|student)$/, mood: { blueprints: B("story", "bento", "cinematic"), mood: "a person: their portrait, one colour, modern type; what they do, proof, how to reach them — short", tiles: ["photo", "name", "contact", "rating", "since", "map"], order: ["about", "services", "whyUs", "reviews", "photos"] } },
];
const DEFAULT: TradeMood = { blueprints: B("bento", "cinematic", "story"), mood: "clear and modern: one trade colour, clean type, soft corners, calm motion; the business's facts at a glance", tiles: SHOP };

export function tradeMood(category: string | undefined): TradeMood {
  const key = (category ?? "").toLowerCase();
  return RULES.find((r) => r.re.test(key))?.mood ?? DEFAULT;
}

export type MoodPlan = { blueprint: BlueprintKey; style: SiteStyle; order?: HomeKind[]; tiles?: TileKey[]; why: string };

const LIGHT = new Set(["ivory", "pearl"]);
const WARM = new Set(["saffron", "gold", "cocoa", "crimson", "rose", "ivory"]);
/** Three plans from the brief alone — the trade's first blueprint with `base` (the trade's / designer's style), then
 *  the other two carrying base's palette and type; Cinematic always on a dark palette. */
export function moodPlans(category: string | undefined, base: SiteStyle): MoodPlan[] {
  const m = tradeMood(category);
  return m.blueprints.map((key, i) => {
    const bp = BLUEPRINTS.find((b) => b.key === key)!;
    const { hero: _h, layouts: _l, ...paint } = base; void _h; void _l;
    const style: SiteStyle = { ...paint, ...bp.defaults, blueprint: key };
    if (i === 0 && base.hero) style.hero = base.hero;
    if (key === "cinematic" && (!style.palette || LIGHT.has(style.palette))) style.palette = WARM.has(base.palette ?? "") ? "cocoa" : "midnight";
    if (key === "cinematic" && style.palette !== "brand") delete style.color;
    return { blueprint: key, style, ...(m.order ? { order: m.order } : {}), ...(key === "bento" && m.tiles ? { tiles: m.tiles } : {}), why: i === 0 ? `${bp.name}: the usual fit for this trade.` : `${bp.name}: a second take on the same website.` };
  });
}
