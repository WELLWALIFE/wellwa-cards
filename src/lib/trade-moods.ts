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
import { recipeFor, type HomeKind } from "@/lib/site-recipes";

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
// banao"): Bento = a paper board, Cinematic = words over the photo, Poster = a colour block with the photo as a hanging card.
const HERO: Record<BlueprintKey, HeroVariant> = { bento: "board", cinematic: "cover", story: "poster", wordmark: "mark", shop: "shelf", collage: "collage" };

type Rule = { re: RegExp; mood: TradeMood };
const RULES: Rule[] = [
  // Trades the shared rules below word wrongly (15 Oct 2026 sweep of the released sites): a medicine shop is not "fresh stock", a
  // saree shop has no "fittings", a housing society is not a builder, a courier gives no "advice". Same looks, their own words.
  { re: /^(medical)$/, mood: { blueprints: B("bento", "story", "cinematic"), mood: "a medicine shop: calm green / teal, trust and speed — genuine medicines checked by a pharmacist, timings, call, home delivery; nothing loud", tiles: SHOP, order: ["catalog", "trust", "whyUs", "offer", "photos", "reviews", "about"] , headline: bi("Genuine medicines, on time", "असली दवाइयाँ, समय पर"), benefit: bi("Checked by a pharmacist, fair prices and home delivery", "फ़ार्मासिस्ट की जाँच, सही दाम और होम डिलीवरी"), fontSet: "clinic", heroVariant: HERO } },
  { re: /^(textile)$/, mood: { blueprints: B("story", "cinematic", "bento"), mood: "a cloth shop: photos first, silk / rose / ivory, elegant type; the fabrics carry the page — sarees, suiting, dress material, wholesale rates", tiles: ["photo", "name", "contact", "offer", "product", "open", "rating", "map"], order: ["photos", "catalog", "offer", "reviews", "about", "whyUs"] , headline: bi("Fabrics for every occasion", "हर मौके के लिए कपड़ा"), benefit: bi("Sarees, suiting and dress fabric — wholesale and retail", "साड़ी, सूटिंग और ड्रेस का कपड़ा — थोक और फुटकर"), fontSet: "elegant", heroVariant: HERO } },
  { re: /^(housing)$/, mood: { blueprints: B("bento", "story", "cinematic"), mood: "a residents' society: calm blue / green, trust first — notices, accounts, complaints, facility booking and the guard's number; no showroom airs", tiles: SERVICE, order: ["trust", "services", "whyUs", "photos", "reviews", "about", "booking"] , headline: bi("A society that runs smoothly", "सोसाइटी का हर काम आसान"), benefit: bi("Maintenance, complaints and notices — all in one place", "मेंटेनेंस, शिकायत और नोटिस — सब एक जगह"), fontSet: "honest", heroVariant: HERO } },
  { re: /^(optical|footwear|hardware|mobile|gift)$/, mood: { blueprints: B("bento", "story", "cinematic"), mood: "practical, quick, trustworthy; the range, the price and a person who helps choose — timings, call, map; saturated trade colour, round corners; no luxury airs", tiles: SHOP, order: ["catalog", "trust", "whyUs", "offer", "photos", "reviews", "about"] , headline: bi("Good choice, honest prices", "अच्छी पसंद, सही दाम"), benefit: bi("Genuine products, fair prices and help choosing the right one", "असली सामान, सही दाम और सही चुनने में मदद"), fontSet: "honest", heroVariant: HERO } },
  { re: /^(courier|security|cleaning|printing)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "a service done on time: steel / midnight / pearl, modern type, soft corners, calm; what is done, the price, the person who picks up, a strong call to action", tiles: PERSON, order: ["services", "trust", "whyUs", "steps", "reviews", "about", "booking"] , headline: bi("Done on time, done right", "समय पर, सही काम"), benefit: bi("A clear price, work on time and a person who picks up", "साफ़ दाम, समय पर काम और फ़ोन उठाने वाला इंसान"), fontSet: "honest", heroVariant: HERO } },
  { re: /^(transport)$/, mood: { blueprints: B("bento", "cinematic", "story"), mood: "hands-on: saffron / steel / crimson, heavy type, diagonal or grid pattern; call and open-now first, vehicles and rates, work photos, reviews", tiles: SERVICE, order: ["services", "trust", "photos", "whyUs", "reviews", "steps", "about"] , headline: bi("On time, every trip", "हर बार समय पर"), benefit: bi("Clear rates, a driver who calls and goods that arrive safe", "साफ़ रेट, फ़ोन करने वाला ड्राइवर और सही सलामत सामान"), fontSet: "bold", heroVariant: HERO } },
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

/** The blueprints that suit each trade, best first (16 Oct 2026, trade-logic pass). The mood rules above only ever named the first three
 *  blueprints (tile board, full photo, colour poster), so a wholesaler or a clinic never met the order shop or the photo collage the
 *  other three were built for. Reading the blueprints' own blurbs: the ORDER SHOP is a category row, a promo banner and products with
 *  Order buttons (catalogue trades); the COLLAGE is words and quick actions beside photos (booking and visit trades); the FULL PHOTO
 *  carries places and work that photograph well; the BIG NAME carries a short brand name and a few photos; the POSTER is colour and
 *  warmth; the BOARD is facts at a glance (professionals, practical services). */
const FIT: Record<string, [BlueprintKey, BlueprintKey, BlueprintKey]> = {
  // retail and supply
  kirana: B("shop", "bento", "story"), "grocery-online": B("shop", "story", "bento"), wholesale: B("shop", "wordmark", "bento"), distributor: B("shop", "bento", "wordmark"),
  dairy: B("shop", "story", "bento"), agri: B("shop", "bento", "story"), manufacturer: B("bento", "shop", "cinematic"), medical: B("shop", "bento", "collage"),
  water: B("shop", "bento", "collage"), wellness: B("shop", "story", "bento"), pharma: B("bento", "shop", "wordmark"), gift: B("story", "shop", "wordmark"),
  footwear: B("shop", "bento", "story"), optical: B("shop", "wordmark", "bento"), hardware: B("shop", "bento", "collage"), mobile: B("shop", "bento", "collage"),
  textile: B("story", "shop", "wordmark"), garments: B("story", "wordmark", "shop"), furniture: B("cinematic", "shop", "wordmark"), jewellery: B("cinematic", "wordmark", "story"),
  printing: B("shop", "wordmark", "bento"),
  // food and hospitality
  sweets: B("story", "shop", "wordmark"), cafe: B("wordmark", "story", "cinematic"), restaurant: B("cinematic", "story", "wordmark"), tiffin: B("story", "shop", "bento"),
  catering: B("cinematic", "story", "collage"), hotel: B("cinematic", "collage", "wordmark"), travel: B("cinematic", "shop", "story"),
  // health and beauty
  doctor: B("collage", "bento", "wordmark"), hospital: B("collage", "bento", "cinematic"), dentist: B("collage", "bento", "wordmark"), ayurveda: B("collage", "wordmark", "bento"),
  gym: B("cinematic", "collage", "story"), salon: B("story", "collage", "wordmark"), spa: B("cinematic", "collage", "wordmark"), mehndi: B("story", "wordmark", "collage"),
  // services
  ca: B("bento", "wordmark", "collage"), lawyer: B("wordmark", "bento", "cinematic"), insurance: B("bento", "collage", "story"), finance: B("bento", "collage", "wordmark"),
  it: B("bento", "wordmark", "collage"), realestate: B("cinematic", "collage", "bento"), builder: B("cinematic", "bento", "collage"), interior: B("wordmark", "cinematic", "bento"),
  transport: B("bento", "cinematic", "collage"), auto: B("collage", "bento", "cinematic"), electrician: B("collage", "bento", "story"), photography: B("wordmark", "cinematic", "collage"),
  event: B("cinematic", "story", "wordmark"), security: B("bento", "collage", "cinematic"), cleaning: B("collage", "bento", "story"), courier: B("bento", "collage", "story"),
  tailor: B("wordmark", "story", "collage"), astro: B("wordmark", "story", "bento"), housing: B("bento", "collage", "story"),
  // learning
  school: B("story", "collage", "bento"), playschool: B("story", "collage", "bento"), coaching: B("bento", "collage", "story"), college: B("cinematic", "bento", "collage"),
  computer: B("bento", "collage", "story"), teacher: B("story", "bento", "wordmark"), dance: B("collage", "story", "cinematic"),
  // community and people
  temple: B("cinematic", "wordmark", "bento"), samaj: B("cinematic", "collage", "bento"), ngo: B("collage", "story", "cinematic"), club: B("collage", "cinematic", "story"),
  political: B("story", "cinematic", "bento"), mla: B("story", "cinematic", "bento"), union: B("bento", "story", "collage"),
  personal: B("story", "wordmark", "bento"), student: B("story", "wordmark", "bento"), employee: B("story", "wordmark", "bento"), govt: B("bento", "wordmark", "story"),
  army: B("bento", "wordmark", "story"), influencer: B("wordmark", "story", "collage"), mlm: B("story", "shop", "bento"), sales: B("story", "bento", "shop"), agent: B("story", "bento", "shop"),
  other: B("bento", "collage", "wordmark"),
};
const FILL: BlueprintKey[] = ["bento", "collage", "wordmark", "story", "shop", "cinematic"];
/** An order shop sells and takes orders: a trade whose catalogue is treatments, plans of a person, services or projects has nothing to put in it. */
const noShop = (category: string): boolean => /^(treatments|work|services|projects)$/.test(recipeFor(category).catalog);

/** All six blueprints for a trade, the ones that suit it first (its three, then the rest in a calm order), the ones that never fit
 *  it (an order shop for a doctor) last. The look picker and the WhatsApp onboarding both read this. */
export function rankBlueprints(category: string | undefined): BlueprintKey[] {
  const key = (category ?? "").toLowerCase();
  const first = (FIT[key] ?? tradeMood(key).blueprints) as BlueprintKey[];
  const rest = FILL.filter((k) => !first.includes(k));
  const bad: BlueprintKey[] = noShop(key) && !first.includes("shop") ? ["shop"] : [];
  return [...first, ...rest.filter((k) => !bad.includes(k)), ...bad];
}
/** The blueprints worth putting a customer on without asking: the trade's three. */
export const goodBlueprints = (category: string | undefined): BlueprintKey[] => rankBlueprints(category).slice(0, 3);

type Line = { headline: Bi; benefit: Bi };
/** The hero's words for the trades that shared one line with their neighbours (15 Oct 2026 sweep: four service trades all opened
 *  "Done on time, done right", four health trades "Care you can walk in for"). One line of its own each, for the days the AI
 *  writes none; a trade with several pairs gives one of them by the business name, so two neighbours do not open alike. The headline
 *  is 3 to 6 words, the benefit under 70 characters; everyday words, English and Hindi. 16 Oct 2026 (trade-logic): every trade now has
 *  its own — a travel agent was told "Clean rooms, warm service", a water purifier "Qualified doctors", a wholesaler "Fresh stock",
 *  a dance class "Skilled hands … a look that lasts". Nothing here claims a certificate, a number or a guarantee the owner did not give. */
const OWN_LINES: Record<string, Line | Line[]> = {
  auto: { headline: bi("Car care you can trust", "आपकी गाड़ी, भरोसे के हाथों में"), benefit: bi("Genuine parts, a clear price first and pickup from your door", "असली पार्ट्स, पहले से साफ़ दाम और घर से पिकअप") },
  electrician: [
    { headline: bi("Power fixed, safely and fast", "बिजली का काम, सही और जल्दी"), benefit: bi("A trained electrician, a clear price and a bill for every job", "ट्रेंड इलेक्ट्रीशियन, साफ़ दाम और हर काम का बिल") },
    { headline: bi("Lights on, worry off", "बत्ती जली, चिंता गई"), benefit: bi("Wiring, AC and plumbing fixed at your door, price told first", "वायरिंग, AC और प्लंबिंग का काम घर पर, दाम पहले बताकर") },
  ],
  doctor: [
    { headline: bi("Your family doctor, close by", "आपका अपना डॉक्टर, पास ही"), benefit: bi("Time to listen, a clear plan and easy appointments", "ध्यान से सुनना, साफ़ इलाज और आसान अपॉइंटमेंट") },
    { headline: bi("Care that starts with listening", "इलाज की शुरुआत, ध्यान से सुनकर"), benefit: bi("A clear diagnosis, a plain explanation and a visit that is not rushed", "साफ़ जाँच, सरल भाषा में समझाना और बिना जल्दबाज़ी की मुलाक़ात") },
  ],
  hospital: { headline: bi("Care for the whole family", "पूरे परिवार की देखभाल"), benefit: bi("Doctors, tests and emergency help, all under one roof", "डॉक्टर, जाँच और इमरजेंसी — सब एक ही छत के नीचे") },
  dentist: { headline: bi("A healthy smile, without worry", "सेहतमंद मुस्कान, बिना डर के"), benefit: bi("Gentle treatment, clear prices and no rush", "आराम से इलाज, साफ़ दाम और कोई जल्दबाज़ी नहीं") },
  ayurveda: { headline: bi("Natural care for the whole person", "प्राकृतिक इलाज, पूरे इंसान का"), benefit: bi("A vaidya who listens, genuine medicines and a diet plan", "ध्यान से सुनने वाले वैद्य, असली दवाइयाँ और डाइट प्लान") },
  spa: { headline: bi("Time to rest, at last", "आराम का वक़्त, आख़िरकार"), benefit: bi("Skilled therapists, a calm room and easy booking", "माहिर थेरेपिस्ट, शांत कमरा और आसान बुकिंग") },
  salon: [
    { headline: bi("Look good, feel better", "ख़ूबसूरत दिखें, अच्छा महसूस करें"), benefit: bi("Skilled stylists, clean tools and a look that suits you", "माहिर स्टाइलिस्ट, साफ़ औज़ार और आप पर जँचने वाला लुक") },
    { headline: bi("Your style, done your way", "आपका स्टाइल, आपके अंदाज़ में"), benefit: bi("Hair, skin and bridal looks by hands that listen first", "हेयर, स्किन और ब्राइडल लुक — पहले आपकी सुनने वाले हाथों से") },
  ],
  restaurant: [
    { headline: bi("Come hungry, leave happy", "भूख लेकर आइए, ख़ुश होकर जाइए"), benefit: bi("Fresh food, fair prices and quick service, dine in or take away", "ताज़ा खाना, सही दाम और तेज़ सर्विस — यहीं खाइए या ले जाइए") },
    { headline: bi("Good food, good company", "अच्छा खाना, अच्छा साथ"), benefit: bi("Dine in, take away or order home, hot and on time", "यहीं खाइए, ले जाइए या घर मँगाइए — गरम और समय पर") },
  ],
  furniture: { headline: bi("Furniture made to last", "ऐसा फ़र्नीचर, जो सालों चले"), benefit: bi("A strong build, honest prices and delivery to your door", "मज़बूत बनावट, सही दाम और घर तक डिलीवरी") },
  interior: { headline: bi("Homes that feel like you", "ऐसे घर, जो आपके जैसे लगें"), benefit: bi("Design, material and finish — one team, on time", "डिज़ाइन, सामान और फ़िनिश — एक टीम, समय पर") },
  builder: { headline: bi("Built right, handed over on time", "सही बना, समय पर चाबी हाथ में"), benefit: bi("A clear plan, branded material and an engineer on site every day", "साफ़ प्लान, ब्रांडेड सामान और रोज़ साइट पर इंजीनियर") },
  realestate: { headline: bi("Find the right home with us", "सही घर, सही जगह"), benefit: bi("Checked properties, clear papers and honest advice", "जाँची हुई प्रॉपर्टी, साफ़ कागज़ात और ईमानदार सलाह") },
  "grocery-online": { headline: bi("Groceries at your door", "राशन, सीधे आपके दरवाज़े"), benefit: bi("Fresh stock, fair prices and delivery on time", "ताज़ा सामान, सही दाम और समय पर डिलीवरी") },
  tailor: { headline: bi("Stitched to fit you perfectly", "आपके नाप की सिलाई, एकदम सही"), benefit: bi("Careful measuring, a neat finish and delivery on the day promised", "सही नाप, साफ़ फ़िनिश और तय दिन पर डिलीवरी") },
  courier: { headline: bi("Delivered on time, every time", "समय पर डिलीवरी, हर बार"), benefit: bi("Clear rates, easy pickup and a person who picks up your call", "साफ़ रेट, आसान पिकअप और फ़ोन उठाने वाला इंसान") },
  security: { headline: bi("Safe, day and night", "दिन-रात, पूरी सुरक्षा"), benefit: bi("Trained guards, on-time duty and a supervisor who checks daily", "ट्रेंड गार्ड, समय पर ड्यूटी और रोज़ चेक करने वाला सुपरवाइज़र") },
  cleaning: { headline: bi("A spotless home, done right", "साफ़-सुथरा घर, पूरी सफ़ाई"), benefit: bi("A trained team, safe products and a price fixed before we start", "ट्रेंड टीम, सुरक्षित प्रोडक्ट और काम से पहले तय दाम") },
  printing: { headline: bi("Printed sharp, delivered on time", "साफ़ छपाई, समय पर डिलीवरी"), benefit: bi("Clear proofs, fair rates and fast turnaround", "पहले प्रूफ़, सही रेट और तेज़ काम") },
  footwear: { headline: bi("Comfortable shoes, honest prices", "आरामदायक जूते, सही दाम"), benefit: bi("Right fit, genuine brands and help choosing the pair", "सही फ़िट, असली ब्रांड और सही जोड़ी चुनने में मदद") },
  optical: { headline: bi("See clearly, look good", "साफ़ देखिए, अच्छे दिखिए"), benefit: bi("An eye check, genuine frames and quick delivery", "आँखों की जाँच, असली फ़्रेम और जल्दी डिलीवरी") },
  hardware: [
    { headline: bi("Everything for your building work", "घर बनाने का हर सामान"), benefit: bi("Genuine brands, fair prices and delivery to your site", "असली ब्रांड, सही दाम और साइट तक डिलीवरी") },
    { headline: bi("Paint, pipes and fittings, sorted", "पेंट, पाइप और फ़िटिंग, सब एक जगह"), benefit: bi("The right material, a fair rate and advice from people who know", "सही सामान, सही रेट और जानकार लोगों की सलाह") },
  ],
  mobile: { headline: bi("The right phone, right price", "सही फ़ोन, सही दाम पर"), benefit: bi("Genuine phones with bill and warranty, plus quick repairs", "बिल और वारंटी वाले असली फ़ोन, और जल्दी रिपेयर") },
  gift: { headline: bi("Gifts that say it well", "ऐसे गिफ़्ट, जो दिल की बात कहें"), benefit: bi("Ready hampers, your own message and wrapped with care", "तैयार हैम्पर, आपका अपना संदेश और प्यार से पैक") },
  // retail and supply
  kirana: [
    { headline: bi("Everything for your kitchen", "आपकी रसोई का सारा सामान"), benefit: bi("Daily essentials, fair prices and delivery nearby", "रोज़ का राशन, सही दाम और आस-पास डिलीवरी") },
    { headline: bi("Your store for daily needs", "रोज़ की ज़रूरत का आपका स्टोर"), benefit: bi("Send your list on WhatsApp, we pack it and bring it over", "लिस्ट WhatsApp करें, हम पैक करके पहुँचा देंगे") },
  ],
  wholesale: [
    { headline: bi("Wholesale rates, straight from us", "थोक के रेट, सीधे हमसे"), benefit: bi("Bulk prices, steady stock and quick quotes on WhatsApp", "बल्क रेट, हमेशा स्टॉक और WhatsApp पर जल्दी कोटेशन") },
    { headline: bi("Buy in bulk, save more", "थोक में लीजिए, ज़्यादा बचाइए"), benefit: bi("Clear rates, regular supply and dispatch to your shop", "साफ़ रेट, लगातार सप्लाई और आपकी दुकान तक डिस्पैच") },
  ],
  distributor: { headline: bi("Your steady supply partner", "आपका भरोसेमंद सप्लाई पार्टनर"), benefit: bi("Regular stock, clear rates and timely supply to your shop", "लगातार स्टॉक, साफ़ रेट और दुकान तक समय पर सप्लाई") },
  dairy: { headline: bi("Fresh from the dairy, daily", "डेयरी से सीधे, रोज़ ताज़ा"), benefit: bi("Pure milk and dairy products, at your door each morning", "शुद्ध दूध और डेयरी प्रोडक्ट, हर सुबह दरवाज़े तक") },
  agri: { headline: bi("Everything the farm needs", "खेती की हर ज़रूरत का सामान"), benefit: bi("Seeds, inputs and honest advice for a better harvest", "बीज, खाद-दवा और अच्छी फ़सल की ईमानदार सलाह") },
  manufacturer: { headline: bi("Made with care, sent on time", "ध्यान से बना, समय पर रवाना"), benefit: bi("Steady quality, clear rates and bulk orders handled directly", "एक-सी क्वालिटी, साफ़ रेट और बल्क ऑर्डर सीधे हमसे") },
  pharma: { headline: bi("Trusted products, steady supply", "भरोसेमंद प्रोडक्ट, पक्की सप्लाई"), benefit: bi("The range, clear rates and a representative who replies", "पूरी रेंज, साफ़ रेट और जवाब देने वाला प्रतिनिधि") },
  water: { headline: bi("Clean drinking water, at home", "घर में साफ़ पीने का पानी"), benefit: bi("Purifiers and ionizers with installation and service support", "प्यूरीफ़ायर और आयोनाइज़र — इंस्टॉलेशन और सर्विस सपोर्ट के साथ") },
  wellness: { headline: bi("Everyday health, made simple", "रोज़ की सेहत, आसान तरीक़े से"), benefit: bi("Wellness products explained honestly, with advice that fits you", "वेलनेस प्रोडक्ट की ईमानदार जानकारी और आपके हिसाब की सलाह") },
  garments: { headline: bi("Dressed for every occasion", "हर मौके के लिए तैयार"), benefit: bi("New styles every season and help finding the right fit", "हर सीज़न नए स्टाइल और सही फ़िट चुनने में मदद") },
  jewellery: [
    { headline: bi("Hallmarked gold, honest prices", "हॉलमार्क सोना, सही दाम"), benefit: bi("Bridal sets, daily wear and 22K BIS-hallmarked jewellery", "ब्राइडल सेट, डेली वियर और 22K BIS हॉलमार्क ज्वेलरी") },
    { headline: bi("Jewellery for life's good days", "ज़िंदगी के ख़ास दिनों की ज्वेलरी"), benefit: bi("Bridal and everyday pieces, shown with honest weight and rates", "ब्राइडल और रोज़ पहनने के गहने, ईमानदार वज़न और रेट के साथ") },
  ],
  // food and hospitality
  sweets: [
    { headline: bi("Sweets made fresh, every day", "रोज़ ताज़ी बनी मिठाई"), benefit: bi("Pure ingredients, festive boxes and orders for every occasion", "शुद्ध सामान, त्योहार के डिब्बे और हर मौके का ऑर्डर") },
    { headline: bi("Mithai the way you remember", "वही मिठाई, जो बचपन याद दिला दे"), benefit: bi("Fresh batches daily, packed to gift or to share at home", "रोज़ नई खेप, गिफ़्ट या घर के लिए पैक") },
  ],
  cafe: [
    { headline: bi("Coffee, tea and a good table", "चाय-कॉफ़ी और बैठने की अच्छी जगह"), benefit: bi("Fresh bakes, a warm corner and a menu worth returning for", "ताज़ा बेक, आरामदेह कोना और बार-बार आने वाला मेन्यू") },
    { headline: bi("Your corner for a good cup", "अच्छी चाय-कॉफ़ी का आपका कोना"), benefit: bi("Made to order, served warm and ready to take away", "ऑर्डर पर बना, गरम परोसा और टेक-अवे भी") },
  ],
  tiffin: { headline: bi("Home-style meals, at your door", "घर जैसा खाना, दरवाज़े तक"), benefit: bi("Cooked fresh each day, simple, tasty and on time", "रोज़ ताज़ा बना, सादा, स्वादिष्ट और समय पर") },
  catering: { headline: bi("Feasts for every occasion", "हर मौके की दावत"), benefit: bi("Menus for weddings and parties, cooked fresh and served on time", "शादी-पार्टी के मेन्यू, ताज़ा बना और समय पर सर्व") },
  travel: { headline: bi("Trips planned, stress left out", "सफ़र की प्लानिंग, बिना झंझट"), benefit: bi("Tickets, hotels and tours handled by one person you can call", "टिकट, होटल और टूर — एक ही इंसान, जिसे आप फ़ोन कर सकें") },
  // health and fitness
  gym: [
    { headline: bi("Stronger every week", "हर हफ़्ते और मज़बूत"), benefit: bi("Trainers who guide you, a plan that fits and steady results", "गाइड करने वाले ट्रेनर, आपके हिसाब का प्लान और पक्का असर") },
    { headline: bi("Train with a plan", "प्लान के साथ ट्रेनिंग"), benefit: bi("Equipment that works, coaching on the floor and a routine you can keep", "काम करने वाले उपकरण, फ़्लोर पर कोचिंग और निभने वाला रूटीन") },
  ],
  mehndi: { headline: bi("Henna that tells your story", "मेहंदी, जो आपकी कहानी कहे"), benefit: bi("Bridal and festive designs, drawn neatly and on time", "दुल्हन और त्योहार के डिज़ाइन, सफ़ाई से और समय पर") },
  photography: { headline: bi("Moments you will want to keep", "वो पल, जो हमेशा साथ रहें"), benefit: bi("Weddings, events and portraits shot with care, delivered on time", "शादी, इवेंट और पोर्ट्रेट — ध्यान से खींचे, समय पर डिलीवर") },
  dance: { headline: bi("Learn to move with joy", "ख़ुशी से थिरकना सीखिए"), benefit: bi("Friendly teachers, small batches and a stage for every learner", "अपनापन भरे टीचर, छोटे बैच और हर सीखने वाले के लिए मंच") },
  event: { headline: bi("Your day, beautifully done", "आपका दिन, ख़ूबसूरती से"), benefit: bi("Planning, decor and sound with one team, start to finish", "प्लानिंग, डेकोर और साउंड — एक टीम, शुरू से आख़िर तक") },
  // professionals
  ca: { headline: bi("Your numbers, in safe hands", "आपका हिसाब, सही हाथों में"), benefit: bi("Tax, GST and accounts handled on time and explained plainly", "टैक्स, GST और अकाउंट समय पर, सीधी भाषा में समझाकर") },
  lawyer: { headline: bi("Clear legal advice, calmly given", "साफ़ क़ानूनी सलाह, शांति से"), benefit: bi("Know where you stand before you decide: a first talk, an honest view", "फ़ैसले से पहले अपनी स्थिति समझिए — पहली मुलाक़ात, ईमानदार राय") },
  insurance: { headline: bi("Cover that fits your family", "आपके परिवार के हिसाब का कवर"), benefit: bi("Plans compared plainly, with help at claim time", "प्लान की सीधी तुलना और क्लेम के वक़्त पूरी मदद") },
  finance: { headline: bi("Loans and savings, explained", "लोन और बचत, आसान भाषा में"), benefit: bi("Compare options, understand the cost and decide with confidence", "विकल्प देखिए, ख़र्च समझिए और भरोसे से फ़ैसला लीजिए") },
  it: { headline: bi("Software that works for you", "ऐसा सॉफ़्टवेयर, जो आपके काम आए"), benefit: bi("Websites, apps and marketing built to bring you customers", "वेबसाइट, ऐप और मार्केटिंग — जो आपको ग्राहक दिलाए") },
  astro: { headline: bi("Guidance for the days ahead", "आने वाले दिनों की सही राह"), benefit: bi("Kundli, vastu and muhurat explained simply, heard with patience", "कुंडली, वास्तु और मुहूर्त — सरल भाषा में, धैर्य से सुनकर") },
  // learning
  school: [
    { headline: bi("A school where children thrive", "जहाँ बच्चे खिलते हैं"), benefit: bi("Caring teachers, a safe campus and parents kept in the loop", "ध्यान देने वाले शिक्षक, सुरक्षित कैंपस और माता-पिता से लगातार बात") },
    { headline: bi("Strong basics, bright futures", "पक्की बुनियाद, रोशन भविष्य"), benefit: bi("Classes, activities and a team that knows every child by name", "कक्षाएँ, गतिविधियाँ और हर बच्चे को नाम से जानने वाली टीम") },
  ],
  playschool: { headline: bi("A happy first step in school", "स्कूल का ख़ुशनुमा पहला क़दम"), benefit: bi("Play-led learning, gentle teachers and a safe, bright room", "खेल से सीखना, प्यार भरे टीचर और सुरक्षित, रोशन कमरे") },
  coaching: { headline: bi("Results start with right guidance", "सही गाइडेंस से शुरू होते हैं नतीजे"), benefit: bi("Small batches, regular tests and teachers who track progress", "छोटे बैच, नियमित टेस्ट और प्रगति पर नज़र रखने वाले शिक्षक") },
  college: { headline: bi("Your career starts here", "आपका करियर यहीं से शुरू"), benefit: bi("Courses, faculty and campus life, everything before you apply", "कोर्स, फ़ैकल्टी और कैंपस — अप्लाई करने से पहले सब जानिए") },
  computer: { headline: bi("Learn skills that get you work", "वो हुनर सीखिए, जो काम दिलाए"), benefit: bi("Hands-on classes, from the first click to real projects", "प्रैक्टिकल क्लास — पहले क्लिक से असली प्रोजेक्ट तक") },
  teacher: { headline: bi("Learning that finally clicks", "सीखना, जो आख़िरकार समझ आए"), benefit: bi("Personal attention, patient teaching and clear progress", "हर बच्चे पर ध्यान, धैर्य से पढ़ाई और साफ़ प्रगति") },
  // community and people
  temple: { headline: bi("A place of peace and faith", "शांति और आस्था का स्थान"), benefit: bi("Aarti timings, festivals and how you can take part", "आरती का समय, त्योहार और सेवा में जुड़ने का तरीक़ा") },
  samaj: { headline: bi("Our community, together", "हमारा समाज, एक साथ"), benefit: bi("Events, notices and members' news in one place", "कार्यक्रम, सूचनाएँ और सदस्यों की ख़बरें — एक जगह") },
  ngo: { headline: bi("Small steps, real change", "छोटे क़दम, असली बदलाव"), benefit: bi("See our work, meet the people behind it and join in", "हमारा काम देखिए, उसके पीछे के लोगों से मिलिए और जुड़िए") },
  club: { headline: bi("Meet, play and belong", "मिलिए, खेलिए, जुड़िए"), benefit: bi("Events, activities and how to become a member", "कार्यक्रम, गतिविधियाँ और सदस्य बनने का तरीक़ा") },
  political: { headline: bi("Working for you, every day", "आपके लिए, हर दिन"), benefit: bi("Our work, our promises and how to reach us directly", "हमारा काम, हमारे वादे और सीधे संपर्क का तरीक़ा") },
  mla: { headline: bi("Your representative, within reach", "आपका प्रतिनिधि, आपकी पहुँच में"), benefit: bi("Work in the area, meeting times and how to reach the office", "इलाक़े का काम, मिलने का समय और दफ़्तर से संपर्क") },
  union: { headline: bi("Stronger together, always", "साथ मिलकर, हमेशा मज़बूत"), benefit: bi("Members' rights, news and how to join", "सदस्यों के अधिकार, ख़बरें और जुड़ने का तरीक़ा") },
  army: { headline: bi("Discipline you can rely on", "अनुशासन, जिस पर भरोसा हो"), benefit: bi("Experience, integrity and a straight answer every time", "अनुभव, ईमानदारी और हर बार सीधा जवाब") },
  govt: { headline: bi("Public service, plainly explained", "सरकारी सेवा, सरल भाषा में"), benefit: bi("Information, services and how to reach the office", "जानकारी, सेवाएँ और दफ़्तर से संपर्क का तरीक़ा") },
  student: { headline: bi("Learning, building, growing", "सीखना, बनाना, आगे बढ़ना"), benefit: bi("My projects, my skills and how to reach me", "मेरे प्रोजेक्ट, मेरे हुनर और मुझसे संपर्क") },
  employee: { headline: bi("Skills built, work delivered", "हुनर भी पक्का, काम भी"), benefit: bi("My experience, my work and how to reach me", "मेरा अनुभव, मेरा काम और मुझसे संपर्क") },
  influencer: { headline: bi("Stories worth sharing", "ऐसी कहानियाँ, जो साझा हों"), benefit: bi("My content, my collaborations and how to work with me", "मेरा कंटेंट, मेरे कोलैबोरेशन और साथ काम करने का तरीक़ा") },
  mlm: { headline: bi("Build something of your own", "अपना कुछ खड़ा कीजिए"), benefit: bi("Products explained honestly, with training and support to begin", "प्रोडक्ट की ईमानदार जानकारी, शुरू करने में ट्रेनिंग और साथ") },
  sales: { headline: bi("Honest advice, quick follow-up", "ईमानदार सलाह, जल्दी जवाब"), benefit: bi("The products I offer, what suits you and how to reach me", "मेरे प्रोडक्ट, आपके काम की सही चीज़ और संपर्क का तरीक़ा") },
  agent: { headline: bi("Good deals, handled for you", "अच्छी डील, आपके लिए संभाली हुई"), benefit: bi("Options shown clearly, paperwork handled, one person to call", "विकल्प साफ़, काग़ज़ी काम संभाला, फ़ोन करने को एक इंसान") },
};

/** The main button's words per trade (16 Oct 2026): a hotel's said "Book an appointment", a jeweller's "Order on WhatsApp", a school's
 *  "Enquire on WhatsApp". Only trades whose generic wording reads wrong are here; the rest keep the recipe's (site-recipes.ts ctaLabel). */
const TRADE_CTA: Record<string, Bi> = {
  hotel: bi("Book a room", "कमरा बुक करें"), travel: bi("Plan my trip", "मेरी ट्रिप प्लान करें"), jewellery: bi("See designs on WhatsApp", "डिज़ाइन WhatsApp पर देखें"),
  wholesale: bi("Get rates on WhatsApp", "WhatsApp पर रेट पूछें"), distributor: bi("Get rates on WhatsApp", "WhatsApp पर रेट पूछें"), manufacturer: bi("Ask for a quote", "कोटेशन माँगें"),
  school: bi("Ask about admission", "एडमिशन के बारे में पूछें"), playschool: bi("Ask about admission", "एडमिशन के बारे में पूछें"), college: bi("Ask about admission", "एडमिशन के बारे में पूछें"),
  coaching: bi("Ask about batches", "बैच के बारे में पूछें"), computer: bi("Ask about courses", "कोर्स के बारे में पूछें"), dance: bi("Join a class", "क्लास में जुड़ें"), teacher: bi("Book a class", "क्लास बुक करें"),
  salon: bi("Book a slot", "स्लॉट बुक करें"), spa: bi("Book a slot", "स्लॉट बुक करें"), mehndi: bi("Book a date", "तारीख़ बुक करें"),
  photography: bi("Check your date", "अपनी तारीख़ पूछें"), event: bi("Check your date", "अपनी तारीख़ पूछें"), catering: bi("Ask for a menu quote", "मेन्यू का कोटेशन माँगें"),
  builder: bi("Book a site visit", "साइट विज़िट बुक करें"), realestate: bi("Book a site visit", "साइट विज़िट बुक करें"), interior: bi("Ask for a quote", "कोटेशन माँगें"),
  electrician: bi("Book a visit", "विज़िट बुक करें"), auto: bi("Book a service", "सर्विस बुक करें"), cleaning: bi("Book a service", "सर्विस बुक करें"),
  transport: bi("Ask for a quote", "कोटेशन माँगें"), courier: bi("Book a pickup", "पिकअप बुक करें"), security: bi("Ask for a quote", "कोटेशन माँगें"), printing: bi("Ask for a quote", "कोटेशन माँगें"),
  ca: bi("Book a consultation", "कंसल्टेशन बुक करें"), lawyer: bi("Book a consultation", "कंसल्टेशन बुक करें"), astro: bi("Book a consultation", "कंसल्टेशन बुक करें"),
  ayurveda: bi("Book a consultation", "कंसल्टेशन बुक करें"), insurance: bi("Ask for a plan", "प्लान के बारे में पूछें"), finance: bi("Ask about a loan", "लोन के बारे में पूछें"),
  it: bi("Discuss your project", "अपने प्रोजेक्ट पर बात करें"), tailor: bi("Book a fitting", "फ़िटिंग बुक करें"), optical: bi("Ask on WhatsApp", "WhatsApp पर पूछें"),
  ngo: bi("Get involved", "जुड़ें"), union: bi("Join us", "हमसे जुड़ें"), club: bi("Become a member", "सदस्य बनें"), housing: bi("Contact the office", "दफ़्तर से संपर्क करें"),
  political: bi("Contact the office", "दफ़्तर से संपर्क करें"), mla: bi("Contact the office", "दफ़्तर से संपर्क करें"),
};
/** The trade's own button words, or null when the recipe's stand (`hinglish` reads the English: a button is short). */
export function tradeCta(category: string | undefined, lang: "en" | "hi" | "hinglish" | string): string | null {
  const w = TRADE_CTA[(category ?? "").toLowerCase()];
  return w ? (lang === "hi" ? w.hi : w.en) : null;
}
/** The generic button words the composer writes when neither the AI nor the owner chose any (site-recipes.ts ctaLabel, card-compose.ts
 *  BOOK_CTA, the templates' own): only such a stored label may be replaced by the trade's. A line somebody wrote stays. */
const STOCK_CTA = new Set([
  "order on whatsapp", "enquire on whatsapp", "book an appointment", "join now", "get in touch", "book on whatsapp", "whatsapp us", "contact us", "chat on whatsapp",
  "whatsapp par order karein", "whatsapp par poochhein", "appointment book karein", "abhi join karein", "sampark karein", "whatsapp par book karein",
  "whatsapp पर ऑर्डर करें", "whatsapp पर पूछें", "अपॉइंटमेंट बुक करें", "अभी जुड़ें", "संपर्क करें", "whatsapp पर बुक करें", "whatsapp करें",
]);
export const isStockCta = (label: string | undefined | null): boolean => !(label ?? "").trim() || STOCK_CTA.has((label ?? "").trim().toLowerCase());

/** A stable number from a name, for choosing among a trade's variants (the same business always gets the same line). */
export function nameSeed(s: string | undefined | null): number {
  let h = 2166136261;
  for (const ch of (s ?? "").toLowerCase()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** The trade's mood brief. `seed` (a number from the business name, `nameSeed`) picks among a trade's variant hero lines; without
 *  one the first stands, so the designer, the editor and the trade check always read the same line. */
export function tradeMood(category: string | undefined, seed?: number): TradeMood {
  const key = (category ?? "").toLowerCase();
  const mood = RULES.find((r) => r.re.test(key))?.mood ?? DEFAULT;
  const fit = FIT[key];
  const base = fit ? { ...mood, blueprints: fit } : mood;
  const raw = OWN_LINES[key];
  // (the hash's low bits repeat for similar names, and the same name must not pick variant 2 in every trade: the trade's own hash is mixed in and the high bits used)
  const own = Array.isArray(raw) ? raw[seed === undefined ? 0 : (((seed ^ nameSeed(key)) >>> 9) % raw.length)] : raw;
  return own ? { ...base, ...own } : base;
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
