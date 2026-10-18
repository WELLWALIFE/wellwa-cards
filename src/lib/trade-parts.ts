// A category that joins two or more different kinds of work ("Pest control / cleaning") is a list of PARTS the owner ticks: one, or all.
// (Owner, 18 Oct 2026: "combine ho to combine select kar sake, single ho to single".) Nothing ticked, or every part ticked, is the
// combined trade exactly as before, so every existing card is unchanged. A single part gets its own seeds (trade-data/parts.ts), its own
// tick list and its own name, and that name reaches the photos, the research, the writer and the website through tradeLabelOf.
//
// The answer is kept in card facts `tradeAnswers.parts` as the parts' English names. To give another category parts: add it here, write
// its parts' data in trade-data/parts.ts, and tag its "what you do" ticks in PART_TICKS.
// Isomorphic: no 'use client', no 'server-only'.

/** `label` / `labelHi`: how the business is NAMED when only this part is ticked (default: `en` / `hi`). */
export type TradePart = { key: string; en: string; hi: string; label?: string; labelHi?: string };
export const PARTS_KEY = "parts";

export const TRADE_PARTS: Record<string, TradePart[]> = {
  cleaning: [
    { key: "pest", en: "Pest control", hi: "पेस्ट कंट्रोल" },
    { key: "cleaning", en: "Cleaning", hi: "क्लीनिंग" },
  ],
  cleanprod: [
    { key: "make", en: "We make them", hi: "हम बनाते हैं", label: "Cleaning products manufacturer", labelHi: "क्लीनिंग प्रोडक्ट्स निर्माता" },
    { key: "supply", en: "We sell / supply them", hi: "हम बेचते / सप्लाई करते हैं", label: "Cleaning products supplier", labelHi: "क्लीनिंग प्रोडक्ट्स सप्लायर" },
  ],
};

/** Which of a category's "what you do" ticks belong to which part (a tick named in no part belongs to all). */
export const PART_TICKS: Record<string, Record<string, string[]>> = {
  cleaning: {
    pest: ["Pest control", "Termite", "Sanitization"],
    cleaning: ["Deep cleaning", "Sofa / carpet", "Water tank", "Sanitization", "Office cleaning"],
  },
};

export const partsOf = (categoryKey: string | null | undefined): TradePart[] => (categoryKey ? TRADE_PARTS[categoryKey] ?? [] : []);

type Answers = Record<string, string[]> | undefined;

/** The parts the owner ticked, when that is some but not all of them; null = the whole trade (nothing ticked yet, or all). */
export function chosenParts(categoryKey: string | null | undefined, answers: Answers): TradePart[] | null {
  const all = partsOf(categoryKey);
  if (all.length < 2) return null;
  const said = new Set((answers?.[PARTS_KEY] ?? []).map((s) => s.trim().toLowerCase()));
  if (!said.size) return null;
  const got = all.filter((p) => said.has(p.en.toLowerCase()));
  return got.length > 0 && got.length < all.length ? got : null;
}

/** "Cleaning" / "Pest control + Cleaning" for a strict choice, else null (the category's own name stands). */
export function partsLabel(categoryKey: string | null | undefined, answers: Answers, hi = false): string | null {
  const g = chosenParts(categoryKey, answers);
  return g ? g.map((p) => (hi ? p.labelHi ?? p.hi : p.label ?? p.en)).join(" + ") : null;
}

/** The ticks of a "what you do" question that fit the chosen parts. */
export function tickFitsParts(categoryKey: string, answers: Answers, tick: string): boolean {
  const g = chosenParts(categoryKey, answers);
  const map = PART_TICKS[categoryKey];
  if (!g || !map) return true;
  const owners = Object.entries(map).filter(([, ticks]) => ticks.includes(tick)).map(([k]) => k);
  return !owners.length || owners.some((k) => g.some((p) => p.key === k));
}
