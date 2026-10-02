// How each section of the website is laid out, decided from what it holds — the visual half of the design
// manager (site-recipes.ts decides WHICH sections a trade's page carries; this decides what shape each one
// takes). Two photos are not a grid, seven services are not seven cards, one review is a quote, not a card.
//
// Pure module: no React, no DOM. The renderer (site-view.tsx) reads these; a layout the owner never sees
// is still deterministic, so the same card always renders the same way.

export type AboutLayout = "photo-left" | "photo-right" | "statement" | "columns";
/** With a photo the picture alternates sides down the page; without one, a short text becomes a centred
 *  statement and a long one a two-column editorial spread. */
export function aboutLayout(block: { body?: string | null; imageUrl?: string | null }, index = 0): AboutLayout {
  if (block.imageUrl) return index % 2 ? "photo-right" : "photo-left";
  const body = (block.body ?? "").trim();
  const paras = body.split(/\n+/).filter((x) => x.trim()).length;
  return body.length <= 260 && paras <= 1 ? "statement" : "columns";
}

export type ServicesLayout = "rows" | "cards" | "list";
/** One or two services get a full-width row each; a long list (7+) or one without descriptions is a tidy
 *  two-column checklist; three to six are the cards. */
export function servicesLayout(items: { name: string; desc?: string }[]): ServicesLayout {
  const list = items.filter((s) => (s.name ?? "").trim());
  if (list.length <= 2) return "rows";
  const described = list.filter((s) => (s.desc ?? "").trim()).length;
  if (list.length >= 7 || described < list.length / 2) return "list";
  return "cards";
}

export type GalleryLayout = "single" | "pair" | "mosaic" | "masonry";
export function galleryLayout(count: number): GalleryLayout {
  if (count <= 1) return "single";
  if (count === 2) return "pair";
  if (count <= 5) return "mosaic";
  return "masonry";
}

export type FaqLayout = "open" | "accordion";
/** Up to three questions are shown open — nothing to click for so little; more fold into an accordion. */
export const faqLayout = (count: number): FaqLayout => (count <= 3 ? "open" : "accordion");

export type ProductsLayout = "showcase" | "grid" | "dense";
/** One or two products each get a full showcase (big photo, price, features); nine or more go four across. */
export function productsLayout(count: number): ProductsLayout {
  if (count <= 2) return "showcase";
  if (count >= 9) return "dense";
  return "grid";
}

export type ReviewsLayout = "quote" | "pair" | "cards";
export function reviewsLayout(count: number): ReviewsLayout {
  if (count <= 1) return "quote";
  if (count === 2) return "pair";
  return "cards";
}
