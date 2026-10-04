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
  school: ["vidyalaya", "vidya mandir", "public school", "high school", "senior secondary", "cbse", "icse", "rbse", "convent", "academy", "gurukul"],
  playschool: ["play school", "pre school", "preschool", "pre-school", "kindergarten", "kg", "nursery", "montessori", "daycare", "day care", "creche", "kids school", "playway"],
  college: ["university", "mahavidyalaya", "degree college", "polytechnic"],
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

/**
 * The 2-3 trades a few typed letters most likely mean, best first — the picker's drop-down (owner's call,
 * 2 Oct 2026: "search kare, suggested name 2/3 aa jaaye, user ek select kar le"). A word of the English name,
 * the Hindi name or an everyday alias that STARTS with the typed text counts most; a phrase that merely contains
 * it counts less. "school" → School, Play school, (Coaching via "school subjects" would not — aliases must start).
 */
/** Edit distance, capped: "collage" → "college" is 1. Typed words are short, so this is cheap. */
function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let left = i, best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, left + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev[j - 1] = left; left = v; best = Math.min(best, v);
    }
    prev[b.length] = left;
    if (best > cap) return cap + 1;
  }
  return prev[b.length];
}
/** A typed word that is a near miss of a real word: "collage" ~ "college", "resturant" ~ "restaurant",
 *  "parlar" ~ "parlour". One slip in a short word, two in a long one. */
export function nearWord(typed: string, word: string): boolean {
  if (typed.length < 5 || word.length < 4) return false;
  const allow = typed.length >= 7 ? 2 : 1;
  if (editDistance(typed, word, allow) <= allow) return true;
  // The typed text is the start of the word with a slip: "colleg" / "collage" against "college / university".
  return word.length > typed.length && editDistance(typed, word.slice(0, typed.length), allow) <= allow;
}

export function suggestCategories(q: string, n = 3): string[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const sHi = q.trim();
  const scored: { key: string; score: number }[] = [];
  for (const c of CATEGORIES) {
    let score = 0;
    const en = c.en.toLowerCase();
    const enWords = en.split(/[^a-z0-9]+/).filter(Boolean);
    if (en.startsWith(s)) score = Math.max(score, 10);
    else if (enWords.some((w) => w.startsWith(s))) score = Math.max(score, 8);
    else if (s.length >= 3 && en.includes(s)) score = Math.max(score, 4);
    if (c.key === s) score = Math.max(score, 10);
    else if (c.key.startsWith(s)) score = Math.max(score, 7);
    const hiWords = c.hi.split(/[\s/()]+/).filter(Boolean);
    if (hiWords.some((w) => w.startsWith(sHi))) score = Math.max(score, 8);
    else if (sHi.length >= 2 && c.hi.includes(sHi)) score = Math.max(score, 4);
    for (const a of ALIASES[c.key] ?? []) {
      if (a === s) score = Math.max(score, 9);
      else if (a.startsWith(s)) score = Math.max(score, 7);
      else if (a.split(" ").some((w) => w.startsWith(s)) && s.length >= 2) score = Math.max(score, 6);
      else if (s.length >= 4 && a.includes(s)) score = Math.max(score, 3);
    }
    // A typo still finds the trade (owner's call, 4 Oct 2026: "collage" found nothing): a near miss of a word of the
    // English name, the key or an alias counts, below any exact start.
    if (!score && s.length >= 4 && /^[a-z0-9 ]+$/.test(s)) {
      const pool = [...enWords, c.key, ...(ALIASES[c.key] ?? []).flatMap((a) => a.split(" "))];
      if (pool.some((w) => nearWord(s, w))) score = 5;
    }
    // "Other" only when nothing better is typed for
    if (c.key === "other" && score < 10) score = 0;
    if (score) scored.push({ key: c.key, score });
  }
  scored.sort((a, b) => b.score - a.score || CATEGORIES.findIndex((c) => c.key === a.key) - CATEGORIES.findIndex((c) => c.key === b.key));
  return scored.slice(0, n).map((x) => x.key);
}
