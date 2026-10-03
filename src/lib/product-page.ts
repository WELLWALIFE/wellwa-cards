// One product, one address: /c/<user>/p-kaju-katli (or /p-kaju-katli on the owner's own domain). A product the
// owner can send on WhatsApp by itself, and one Google can index with its name, picture and price — until now
// every product sat behind a grid on the products page (owner's call, 1 Oct 2026).
//
// The address is derived from the product's name, so nothing new has to be stored: the same name always gives
// the same link, and a renamed product simply gets a new one.
//
// Isomorphic: no 'use client', no 'server-only'.
import type { Card, CardPage, ProductItem } from "@/lib/types";

export const PRODUCT_PREFIX = "p-";

/** "Kaju Katli – Premium Sweet" → "p-kaju-katli-premium-sweet". Devanagari names fall back to their position. */
export function productSlug(name: string, index = 0): string {
  const s = (name ?? "").toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return `${PRODUCT_PREFIX}${s || `item-${index + 1}`}`;
}

export const isProductSlug = (slug: string | null | undefined) => !!slug && slug.startsWith(PRODUCT_PREFIX);

/** Every product on the card, with the address each one answers at. */
export function cardProducts(card: Card): { item: ProductItem; slug: string; page: string }[] {
  const out: { item: ProductItem; slug: string; page: string }[] = [];
  const seen = new Set<string>();
  for (const pg of card.pages) {
    if (pg.hidden) continue;   // the Shubhora page's plans are not this business's products
    for (const b of pg.blocks) {
      if (b.kind !== "product") continue;
      for (const item of b.items) {
        let slug = productSlug(item.name, out.length);
        // Two products with the same name still need two addresses.
        if (seen.has(slug)) slug = `${slug}-${out.length + 1}`;
        seen.add(slug);
        out.push({ item, slug, page: pg.slug });
      }
    }
  }
  return out;
}

export function findProduct(card: Card, slug: string | null | undefined) {
  return isProductSlug(slug) ? cardProducts(card).find((p) => p.slug === slug) ?? null : null;
}

/** The product shown as a page of its own: the card's nav stays, the page holds this one in full and a few
 *  others under it — a visitor who landed here from a search or a shared link sees there is more to buy. */
export function productPageOf(card: Card, found: { item: ProductItem; slug: string }): CardPage {
  const others = cardProducts(card).filter((x) => x.slug !== found.slug && x.item.name !== found.item.name).slice(0, 4);
  const hi = card.language === "hi";
  return {
    id: `prod-${found.slug}`,
    slug: found.slug,
    label: found.item.name.slice(0, 40),
    blocks: [
      { id: `prodb-${found.slug}`, kind: "product", title: found.item.name, items: [found.item] },
      ...(others.length >= 2 ? [{ id: `prodmore-${found.slug}`, kind: "product" as const, title: hi ? "और भी देखिए" : "More from this shop", items: others.map((x) => x.item) }] : []),
    ],
  };
}
