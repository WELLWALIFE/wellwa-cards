// The colours a trade may wear (owner, 17 Nov 2026: a cleaning-products company came out in plum, rust and wedding maroon —
// "sabhi trade ke liye saari cheez specific honi chahiye, mix na ho"). Every design of a website — the Premium compositions and the
// basic looks — takes its colour from the trade's own family: cleaning and clinics in clear blues, teals and greens; sweets and
// restaurants in warm reds and saffron; bridal and jewellery in maroon, plum and gold; and so on. A business's OWN colour (its logo)
// is always allowed. Pure module, no imports: the callers pass the category key and its trade group (site-advanced-archetypes.ts).

export type TradeHex = { color: string; tone: "light" | "dark" };
export type TradeColours = {
  family: string;
  /** Colours for the Premium designs ("brand" palette with this hex), the most typical first. */
  hexes: TradeHex[];
  /** Named palettes (site-style.ts SITE_PALETTES) for the basic looks, the most typical first. */
  palettes: string[];
  /** The dark palette of the full-photo look. */
  dark: string;
};

const L = (color: string): TradeHex => ({ color, tone: "light" });
const D = (color: string): TradeHex => ({ color, tone: "dark" });

const FAMILIES: Record<string, Omit<TradeColours, "family">> = {
  // clean water, hygiene, health: blues, teals, fresh greens
  fresh: { hexes: [L("#0d95d2"), L("#0c8590"), L("#2150d9"), D("#0f6070"), L("#1e8a5a"), L("#3f5f80"), D("#1763b8"), D("#0a7a6a")], palettes: ["ocean", "teal", "pearl", "emerald", "steel", "sage", "midnight"], dark: "midnight" },
  // stock, rates, machines, repairs: trusted blues and steel, one working orange
  trade: { hexes: [L("#2150d9"), L("#3f5f80"), D("#0f6070"), L("#c2410c"), L("#3f3fa8"), L("#0c8590"), D("#334155"), D("#b3622a")], palettes: ["steel", "ocean", "midnight", "pearl", "teal", "saffron", "emerald"], dark: "midnight" },
  // appetite: baked clay, deep red, saffron, a leaf green
  food: { hexes: [L("#b4532a"), D("#7a1a26"), L("#c2410c"), D("#b08a3e"), L("#a2613f"), L("#5a8a2e"), D("#8a1c1c"), D("#b3622a")], palettes: ["saffron", "crimson", "cocoa", "gold", "ivory", "clay", "emerald"], dark: "cocoa" },
  // fresh produce, farms, natural products: greens and earth
  nature: { hexes: [L("#5a8a2e"), L("#5f8068"), L("#1e8a5a"), D("#6d6d22"), L("#a2613f"), L("#0c8590"), L("#b4532a"), D("#b08a3e")], palettes: ["emerald", "sage", "gold", "ivory", "clay", "teal", "saffron"], dark: "cocoa" },
  // weddings, jewellery, fashion, beauty: maroon, plum, gold, blush
  luxe: { hexes: [D("#7a1a26"), D("#7d2a62"), D("#b08a3e"), L("#c4566f"), L("#a2613f"), L("#5f8068"), L("#86307f"), D("#8a1c1c")], palettes: ["rose", "plum", "gold", "ivory", "crimson", "royal", "sage"], dark: "noir" },
  // homes, hotels, travel, photography: calm naturals and deep water
  living: { hexes: [D("#0f6070"), L("#a2613f"), L("#5f8068"), D("#b08a3e"), L("#0c8590"), L("#3f5f80"), L("#b4532a"), D("#7d2a62")], palettes: ["ivory", "sage", "cocoa", "teal", "gold", "ocean", "clay"], dark: "noir" },
  // advisers, institutes, professionals: ink blues, slate, one quiet green
  pro: { hexes: [L("#3f3fa8"), L("#3f5f80"), L("#2150d9"), D("#0f6070"), L("#5f8068"), D("#b08a3e"), L("#1e8a5a"), D("#334155")], palettes: ["pearl", "steel", "ocean", "midnight", "emerald", "teal", "royal"], dark: "midnight" },
  // children and schools: bright, friendly primaries
  kids: { hexes: [L("#2150d9"), L("#0c8590"), L("#5a8a2e"), L("#c2410c"), L("#c4566f"), L("#0d95d2"), D("#6a3fd6"), L("#b4532a")], palettes: ["ocean", "emerald", "saffron", "royal", "pearl", "rose", "teal"], dark: "midnight" },
  // temples, samaj, astrology: saffron, maroon, gold, indigo
  faith: { hexes: [L("#c2410c"), D("#7a1a26"), D("#b08a3e"), L("#3f3fa8"), L("#b4532a"), L("#a2613f"), D("#7d2a62"), L("#5a8a2e")], palettes: ["saffron", "gold", "crimson", "ivory", "royal", "cocoa", "emerald"], dark: "cocoa" },
  // gyms and energy: strong, dark, electric
  energy: { hexes: [D("#6a3fd6"), L("#2150d9"), D("#7a1a26"), L("#c2410c"), D("#0f6070"), D("#334155"), L("#1e8a5a"), D("#b3622a")], palettes: ["crimson", "midnight", "steel", "royal", "saffron", "ocean", "emerald"], dark: "noir" },
};

const GROUP_FAMILY: Record<string, string> = {
  sweets: "food", dining: "food", grocery: "nature", farm: "nature", wellness: "nature",
  bridal: "luxe", jewellery: "luxe", fashion: "luxe", beauty: "luxe", gifts: "luxe",
  decor: "living", stay: "living", travel: "living", creative: "living",
  clinic: "fresh", pharmacy: "fresh",
  wholesale: "trade", industry: "trade", buildmat: "trade", shop: "trade", motors: "trade", homeservice: "trade", tech: "trade",
  advisory: "pro", property: "pro", college: "pro", coaching: "pro", personal: "pro", leader: "pro", general: "pro",
  school: "kids", playschool: "kids", astro: "faith", community: "faith", fitness: "energy",
};
/** A trade whose own nature says more than its group: cleaning products sit with the wholesalers, but they are about hygiene. */
const KEY_FAMILY: Record<string, string> = {
  cleanprod: "fresh", cleaning: "fresh", water: "fresh", dentist: "fresh", dairy: "fresh",
  ayurveda: "nature", spa: "living", security: "pro", it: "pro", courier: "trade", printing: "trade",
};

export function tradeColours(categoryKey: string | undefined | null, group: string | undefined | null): TradeColours {
  const key = (categoryKey ?? "").trim().toLowerCase();
  const family = KEY_FAMILY[key] ?? GROUP_FAMILY[(group ?? "").trim().toLowerCase()] ?? "pro";
  return { family, ...FAMILIES[family] };
}

/** Is this named palette one the trade may wear? */
export const paletteFits = (tc: TradeColours, palette: string | undefined | null): boolean =>
  !!palette && (tc.palettes.includes(palette) || palette === tc.dark);
/** Is this hex one of the trade's own? */
export const hexFits = (tc: TradeColours, hex: string | undefined | null): boolean =>
  !!hex && tc.hexes.some((h) => h.color.toLowerCase() === hex.toLowerCase());
