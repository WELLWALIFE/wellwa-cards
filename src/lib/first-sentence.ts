/** The first sentence of an offer, at most ~80 characters: the phone strip shows this, the Offer section below shows the whole text
 *  (owner, 31 Oct 2026: a strip that ran to five lines on a phone). Pure: both website renderers use it. */
export function firstSentence(text: string): string {
  const t = (text ?? "").trim();
  const m = t.match(/^[^.!?।]{3,}[.!?।]/);
  const first = (m ? m[0] : t).trim();
  return first.length > 84 ? `${first.slice(0, 81).replace(/\s+\S*$/, "")}…` : first;
}
