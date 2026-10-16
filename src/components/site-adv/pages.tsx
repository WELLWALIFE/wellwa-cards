"use client";
// The advanced site's pages: which page an address means (routeOf) and the body each one draws (AdvPageBody). The home page is
// composed by index.tsx from the spec's section order; every other page is composed here from page templates (page-catalog.tsx,
// page-more.tsx) and the SAME section variants the home page uses.
//
// CONTRACT for other files:
//   - a variant keeps the registry contract (registry.ts): `({ c, spec, x, index }) => <Sec k="..."> ...`. It is drawn on the home page
//     and, for about / trust / process / proof / faq / visit / cta / gallery, again on the inner pages. Never assume it is on home.
//   - `x` also carries `pages` and `sectionHref` at run time (AdvCtxPlus, nav.tsx): a footer or a "see all" link reads them.
//   - `x.jump(key)` is page-aware: it scrolls when the section is on this page, else opens the page that holds it.
import type { ReactNode } from "react";
import type { Card, CardPage } from "@/lib/types";
import { isProductSlug } from "@/lib/product-page";
import { advancedItems, type AdvItem, type AdvancedSpec, type SectionKey } from "@/lib/site-advanced";
import type { SiteUpdate } from "@/components/site-view";
import type { SiteContent } from "@/components/site-adv/shared";
import type { AdvCtxPlus, AdvPageEntry, AdvPages, Chrome } from "@/components/site-adv/nav";
import { CATALOG_PAGE_CSS, CataloguePage } from "@/components/site-adv/page-catalog";
import { ProductPage } from "@/components/site-adv/product";
import { AboutPage, ContactPage, GalleryPage, GenericPage, MORE_CSS, UpdatesPage, type Slot } from "@/components/site-adv/page-more";
import { Masthead, PARTS_CSS } from "@/components/site-adv/page-parts";

export type AdvRoute =
  | { kind: "home" }
  | { kind: "item"; item: AdvItem }
  | { kind: "page"; entry: AdvPageEntry; page?: CardPage };

/** The page an address means. An unknown address is the home page (the basic site does the same). */
export function routeOf(slug: string, pages: AdvPages, card: Card, items: AdvItem[]): AdvRoute {
  if (isProductSlug(slug)) {
    const item = items.find((i) => i.slug === slug);
    if (item) return { kind: "item", item };
  }
  const entry = pages.list.find((e) => e.slug === slug);
  if (!entry || entry.role === "home") return { kind: "home" };
  return { kind: "page", entry, page: card.pages.find((p) => p.slug === entry.slug) };
}

/** The items of the site (every product and service with its own address), memoised by the caller. */
export const itemsOf = (card: Card): AdvItem[] => advancedItems(card);

/** The page entry an item belongs to (its catalogue), for the active mark in the menu. */
export const catalogueOf = (route: AdvRoute, pages: AdvPages): AdvPageEntry | undefined =>
  route.kind === "item" ? pages.list.find((e) => e.slug === route.item.page) ?? pages.byRole("catalogue") : route.kind === "page" ? route.entry : undefined;

type BodyProps = {
  route: Exclude<AdvRoute, { kind: "home" }>;
  c: SiteContent; spec: AdvancedSpec; x: AdvCtxPlus; chrome: Chrome; slot: Slot; has: (k: SectionKey) => boolean;
  items: AdvItem[]; updates: SiteUpdate[];
};

/** The body of an inner page (everything between the header and the footer). */
export function AdvPageBody({ route, c, spec, x, chrome, slot, has, items, updates }: BodyProps): ReactNode {
  if (route.kind === "item") {
    return <ProductPage c={c} spec={spec} x={x} item={route.item} items={items} entry={x.pages.list.find((e) => e.slug === route.item.page)} />;
  }
  const { entry, page } = route;
  const common = { c, spec, x, chrome, slot, has };
  switch (entry.role) {
    case "catalogue": return <CataloguePage {...common} entry={entry} items={items} />;
    case "about": return <AboutPage {...common} entry={entry} />;
    case "gallery": return <GalleryPage {...common} entry={entry} />;
    case "contact": return <ContactPage {...common} entry={entry} page={page} />;
    case "updates": return <UpdatesPage c={c} x={x} chrome={chrome} entry={entry} updates={updates} />;
    case "faq": return (
      <>
        <Masthead x={x} chrome={chrome} name={c.name} kicker={x.t(c.trade)} title={x.t(entry.label)} image={c.hm.photo?.src ?? c.photos[0]} trail={[{ label: x.t(entry.label) }]} />
        {has("faq") ? slot("faq", 1) : <GenericPage {...common} entry={entry} page={page} />}
        {has("cta") && slot("cta", 2)}
      </>
    );
    default: return <GenericPage {...common} entry={entry} page={page} />;
  }
}

export const PAGES_CSS = [PARTS_CSS, CATALOG_PAGE_CSS, MORE_CSS].join("\n");
