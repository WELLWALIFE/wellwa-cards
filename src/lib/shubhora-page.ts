// The Shubhora side of a card whose owner ALSO runs their own business (`kb: "both"`).
//
// Owner's call: many partners do two things — their own shop, clinic or service, and selling Shubhora.
// Before this, the two choices at set-up replaced each other: turning on the Shubhora seller card
// overwrote the owner's own pages on the same link. Now both live in one account without ever mixing:
//
//   /c/rajesh            the owner's own business  (their pages, their AI, their daily posters)
//   /c/rajesh/shubhora   Shubhora                  (this page, its own AI, its own link and QR)
//
// The Shubhora page is `hidden`, so it is never on the owner's tab row: a customer who opens the card
// for sweets or a check-up never sees Shubhora, and the owner shares the second link only with people
// they are actually talking to about Shubhora.

import { getTemplate } from "@/lib/templates";
import type { Card, CardPage } from "@/lib/types";

/** The slug the Shubhora side lives on: /c/<user>/shubhora. */
export const SHUBHORA_PAGE_SLUG = "shubhora";

/** Which of the seller template's pages make up that one page, in reading order: what it is, what it
 *  costs, and the partner plan. */
const FROM_RESELLER = ["home", "plans", "business"] as const;

/** The Shubhora sales page.
 *
 *  The blocks are taken from the "Digital V-Card Seller" template (`vcard-reseller` in
 *  src/lib/templates.ts) instead of being written again here, so there is one source of truth: when
 *  that template's prices, videos or plan rules are corrected, every "both" card's Shubhora page is
 *  corrected with it.
 *
 *  `visible: true` puts it on the owner's tab row as well (the editor's "Show the Shubhora tab" switch);
 *  the default keeps it off, reachable only by its own address. */
export function shubhoraPage(opts: { visible?: boolean } = {}): CardPage | null {
  const tpl = getTemplate("vcard-reseller");
  if (!tpl) return null;
  const blocks = FROM_RESELLER
    .flatMap((slug) => tpl.data.pages.find((p) => p.slug === slug)?.blocks ?? [])
    // Block ids have to be unique inside a card, and the owner's own blocks already carry the ids their
    // own template gave them — so re-key every Shubhora block under one prefix and they can never clash.
    .map((b, i) => ({ ...b, id: `sh-${i + 1}` }));
  if (!blocks.length) return null;
  return {
    id: "p-shubhora",
    slug: SHUBHORA_PAGE_SLUG,
    label: "Shubhora",
    blocks,
    ...(opts.visible ? {} : { hidden: true }),
  };
}

/** Is the Shubhora page on this card? */
export function hasShubhoraPage(card: { pages?: CardPage[] }): boolean {
  return (card.pages ?? []).some((p) => p.slug === SHUBHORA_PAGE_SLUG);
}

/** Add the Shubhora page to a card — or refresh an existing one to the current template — and mark the
 *  card `kb: "both"`. The owner's own pages, identity, links, theme, SEO and domain are left exactly as
 *  they are; the page is appended last, so their own home page stays the one the card opens on. */
export function withShubhoraPage<T extends { pages: CardPage[]; kb?: Card["kb"] }>(
  card: T,
  opts: { visible?: boolean } = {},
): T {
  const page = shubhoraPage(opts);
  if (!page) return card;
  const mine = card.pages.filter((p) => p.slug !== SHUBHORA_PAGE_SLUG);
  return { ...card, kb: "both", pages: [...mine, page] };
}

/** Take the Shubhora page off a card and hand it back to being just the owner's own business. */
export function withoutShubhoraPage<T extends { pages: CardPage[]; kb?: Card["kb"] }>(card: T): T {
  const mine = card.pages.filter((p) => p.slug !== SHUBHORA_PAGE_SLUG);
  return { ...card, kb: undefined, pages: mine };
}
