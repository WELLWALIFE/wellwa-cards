// What each AI call cost, in the server log (owner's call, 3 Oct 2026: "asli hisaab dikhe, andaaza nahi").
// Gemini returns usageMetadata with every reply; this prints one line per call —
//   [ai] card-copy gemini-3.5-flash in=8123 out=3410 ≈₹1.42
// Rates are rupees per million tokens, approximate (set from Google's price list; change here when it changes).
const RATE: Record<string, { in: number; out: number }> = {
  "gemini-3.5-flash": { in: 42, out: 250 },
  "gemini-3.5-flash-lite": { in: 8.4, out: 34 },
  "gemini-3.1-flash-image": { in: 42, out: 250 },
  "gemini-3.1-flash-lite-image": { in: 8.4, out: 34 },
};
/** Approximate rupees per generated picture (image models bill per image, not per token). */
export const IMAGE_RUPEES: Record<string, number> = { "gemini-3.1-flash-image": 3.4, "gemini-3.1-flash-lite-image": 1.7 };

export type Usage = { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number };

/** One log line for a call; returns the rupee estimate (0 when the model is unknown). */
export function logUsage(tag: string, model: string, usage: Usage | undefined | null): number {
  const inT = Number(usage?.promptTokenCount ?? 0), outT = Number(usage?.candidatesTokenCount ?? 0) + Number(usage?.thoughtsTokenCount ?? 0);
  const r = RATE[model];
  const rupees = r ? (inT * r.in + outT * r.out) / 1_000_000 : 0;
  console.log(`[ai] ${tag} ${model} in=${inT} out=${outT}${r ? ` ≈₹${rupees.toFixed(2)}` : ""}`);
  return rupees;
}

/** One log line for pictures made. */
export function logImages(tag: string, model: string, count: number): number {
  const rupees = (IMAGE_RUPEES[model] ?? 3.4) * count;
  if (count) console.log(`[ai] ${tag} ${model} images=${count} ≈₹${rupees.toFixed(2)}`);
  return rupees;
}
