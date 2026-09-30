/** Two letters for a name badge (owner's call, 25 Sep 2026: one letter like "D" said nothing).
 *  "Demo Shubhora" → "DS", "Rajesh Kumar Sharma" → "RK", "Niteen" → "NI". Works for Hindi names too. */
export function initials(name: string | null | undefined, fallback = "?"): string {
  const words = String(name ?? "").trim().split(/[\s._@-]+/).filter(Boolean);
  if (!words.length) return fallback;
  const first = (w: string) => Array.from(w)[0] ?? "";
  if (words.length >= 2) return (first(words[0]) + first(words[1])).toUpperCase();
  return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
}
