// Headings for gallery albums ("Opening ceremony", "Seminar"…), offered to the owner by trade (owner, 14 Oct 2026: group
// the gallery photos under headings that suit the business). Isomorphic.
const BASE = ["Opening ceremony", "Seminar", "Our team", "Awards", "Customer visit", "Festival celebration", "Our shop"];
const BY_TRADE: { re: RegExp; ideas: string[] }[] = [
  { re: /sweet|bakery|cake|restaurant|cafe|food|kitchen|catering|dairy|kirana|grocery|namkeen/i, ideas: ["Our kitchen", "Festival boxes", "Wedding & bulk orders", "Fresh today", "Happy customers"] },
  { re: /hardware|paint|sanitary|tile|cement|plywood|electric|building|construction|furniture/i, ideas: ["Site delivery", "Dealer meet", "New arrivals", "Our godown", "Completed work"] },
  { re: /school|coaching|tuition|institute|college|academy|class|education|training|course/i, ideas: ["Annual day", "Results & toppers", "Workshop", "Classroom", "Sports day"] },
  { re: /clinic|doctor|dentist|hospital|pharma|medical|lab|health|physio|ayurved|optical/i, ideas: ["Health camp", "Awareness seminar", "Our clinic", "Our doctors", "Equipment"] },
  { re: /salon|parlour|beauty|spa|gym|yoga|fitness|makeup|barber|tattoo/i, ideas: ["Before & after", "Bridal work", "Our studio", "Training session", "Offers & events"] },
  { re: /car|bike|auto|garage|vehicle|tyre|mechanic|showroom|transport/i, ideas: ["Delivery day", "Our workshop", "New models", "Service camp", "Happy owners"] },
  { re: /photo|studio|event|wedding|decor|tent|dj|travel|tour/i, ideas: ["Wedding", "Birthday & parties", "Corporate event", "Behind the scenes", "Client stories"] },
];
/** Headings that suit this trade first, then the ones every business can use. */
export function albumIdeas(tradeKeyOrLabel: string | null | undefined): string[] {
  const hit = BY_TRADE.find((x) => x.re.test(tradeKeyOrLabel ?? ""));
  return [...new Set([...(hit?.ideas ?? []), ...BASE])].slice(0, 12);
}
