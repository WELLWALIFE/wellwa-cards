// A trade guessed from words — the category picker's search and the website peek both use it, so "mithai" finds
// Sweets on the picker and a site that says "sweets and namkeen since 1982" is guessed as Sweets at set-up.
//
// Isomorphic: no 'use client', no 'server-only'.
import { CATEGORIES } from "@/lib/poster-categories";

/** Everyday words (Hinglish and common English) people type for a trade, so "mithai" finds Sweets and "parlour" finds Salon. */
export const ALIASES: Record<string, string[]> = {
  sweets: ["mithai", "halwai", "sweet", "bakery", "cake", "namkeen"],
  kirana: ["dukaan", "dukan", "grocery", "general store", "supermarket"],
  garments: ["kapde", "kapda", "cloth", "readymade", "fashion", "apparel"],
  salon: ["parlour", "parlor", "beauty", "makeup"],
  doctor: ["clinic", "dr", "physician", "daktar"],
  medical: ["dawai", "dawa", "chemist", "pharmacy"],
  restaurant: ["dhaba", "khana", "food", "hotel", "biryani", "pizza"],
  coaching: ["tuition", "classes", "academy", "institute"],
  electrician: ["plumber", "ac repair", "bijli", "mistri", "electricals", "electrical", "electric works"],
  mobile: ["phone", "electronics", "repair", "smartphone", "gadgets"],
  jewellery: ["sunar", "gold", "jewelry", "jewellers", "jewelers", "zevar", "diamond"],
  tailor: ["darzi", "silai", "stitching", "boutique", "tailors", "tailoring"],
  realestate: ["property", "plot", "flat", "dealer", "apartments"],
  auto: ["garage", "mechanic", "car", "bike", "motors", "automobiles", "auto works"],
  dentist: ["dant", "teeth", "dental"],
  astro: ["jyotish", "pandit", "kundli", "vastu"],
  travel: ["tour", "ticket", "taxi", "holidays", "travels", "tours", "tour and travels"],
  printing: ["flex", "press", "banner"],
  furniture: ["sofa", "decor", "mattress", "furnishing"],
  hardware: ["paint", "sanitary", "tiles"],
  gym: ["yoga", "fitness"],
  catering: ["halwai", "caterer", "caterers", "tent house", "bhoj"],
  dairy: ["doodh", "milk"],
  agri: ["khad", "beej", "seeds", "fertilizer"],
  transport: ["truck", "logistics"],
  photography: ["photo studio", "wedding"],
  event: ["tent", "dj", "decoration"],
  tiffin: ["dabba", "home food"],
  water: ["ionizer", "ioniser", "purifier", "alkaline"],
  wellness: ["supplement", "nutrition", "ayurvedic products", "health products"],
  it: ["software", "website", "app development", "digital marketing", "seo"],
  interior: ["architect", "interiors"],
  hotel: ["resort", "lodge", "rooms"],
  footwear: ["shoes", "chappal", "sandals"],
  optical: ["chashma", "spectacles", "eyewear", "lens"],
  gift: ["stationery", "gifts"],
  school: ["play school", "kindergarten"],
  computer: ["skill centre", "typing"],
  manufacturer: ["factory", "manufacturing", "industries"],
  wholesale: ["trading", "traders", "wholesaler"],
  textile: ["saree", "sarees", "fabric", "suits"],
  insurance: ["lic", "policy"],
  finance: ["loan", "mutual fund", "emi"],
  ca: ["accountant", "tax", "gst filing", "audit"],
  lawyer: ["advocate", "legal"],
  builder: ["construction", "contractor"],
  cleaning: ["pest control", "housekeeping"],
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim()} `;

/**
 * The trade a piece of text most likely describes, or null when nothing in it is convincing. Scores every
 * category by its English words, its Hindi words and its everyday aliases (whole-word, so "dress" never finds
 * "dr"); longer phrases count more; the best wins only when it clearly beats the rest. Never guesses on one
 * weak hit — a wrong trade on the set-up form is worse than an empty picker.
 */
export function matchCategory(text: string): string | null {
  const t = norm(text ?? "");
  if (t.trim().length < 3) return null;
  const scores: { key: string; score: number }[] = [];
  for (const c of CATEGORIES) {
    if (c.key === "other" || c.key === "personal") continue;
    let score = 0;
    const words = new Set<string>();
    for (const part of c.en.split(/\s*\/\s*/)) { const w = part.toLowerCase().trim(); if (w.length >= 3) words.add(w); }
    for (const part of c.hi.split(/\s*\/\s*/)) { const w = part.trim(); if (w.length >= 2) words.add(w.toLowerCase()); }
    for (const a of ALIASES[c.key] ?? []) words.add(a.toLowerCase());
    if (c.key.length >= 4) words.add(c.key);
    for (const w of words) {
      const needle = ` ${norm(w).trim()} `;
      if (needle.trim().length < 2) continue;
      let i = -1, n = 0;
      while ((i = t.indexOf(needle, i + 1)) !== -1 && n < 5) n++;
      if (n) score += n * (w.includes(" ") ? 3 : 2);
    }
    if (score) scores.push({ key: c.key, score });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  // A page of website text is full of stray words, so it must say the trade twice (or in a phrase) to count.
  // A business NAME is three words with no noise — "Sharma Sweets", "City Dental Care" — and one whole-word
  // hit in it is the trade (owner's call, 1 Oct 2026: the person should not have to open the trade list).
  const short = t.trim().length <= 60;
  if (!best || best.score < (short ? 2 : 4)) return null;
  if (scores[1] && scores[1].score >= best.score) return null;   // a tie is not an answer
  return best.key;
}
