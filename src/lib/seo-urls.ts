// The addresses of a card's website pages, for the sitemap and for IndexNow (lib/indexnow.ts). Google (and every search engine) lists the Standard
// website (home and main pages) and the Premium one (every page, product and service) — once really live: see searchListed and cardUrls.
import type { MetadataRoute } from "next";
import { advancedItems, activeAdvanced, livePages, withAdvancedPages } from "@/lib/site-advanced";
import { cardProducts } from "@/lib/product-page";
import { sitePaused, sitePending } from "@/lib/site-ready";
import type { Card, CardPage } from "@/lib/types";

export type Row = { username: string; pages: CardPage[] | null; site?: Card["site"] | null; about?: string | null; language?: string | null };

/** Every page of a card that has something on it: home first, then /<slug>, then each product at its own
 *  address (/p-kaju-katli) — Google indexes a product only when the sitemap lists it. */
export function cardUrls(home: string, r: Row, full = true): MetadataRoute.Sitemap {
  // `full` = a Premium website (lib/site-tier.ts): every product and service at its own address too. A Standard website lists its home
  // and main pages only (owner, 16 Nov 2026: "basic Google listing" for Standard, full SEO for Premium).
  // The Premium (advanced) website has pages the stored card does not: About and Gallery made at request time, and a page for every product AND
  // service. Google is told about all of them (owner, 16 Oct 2026: the Premium "Google SEO" promise).
  if (r.site?.advanced && (r.site as { advancedOn?: boolean }).advancedOn !== false) {
    const card = withAdvancedPages({ username: r.username, pages: r.pages ?? [], site: r.site, about: r.about ?? "", language: r.language ?? "en" } as Card);
    const lastModified = new Date();
    const pages = livePages(card);
    return [
      ...pages.map((p, i) => ({ url: i === 0 ? home : `${home}/${encodeURIComponent(p.slug)}`, lastModified, changeFrequency: "weekly" as const, priority: i === 0 ? 0.9 : 0.7 })),
      ...(full ? advancedItems(card) : []).map((it) => ({ url: `${home}/${encodeURIComponent(it.slug)}`, lastModified, changeFrequency: "weekly" as const, priority: 0.6 })),
    ];
  }
  const pages = (r.pages ?? []).filter((p, i) => i === 0 || (p.blocks ?? []).length > 0);
  const lastModified = new Date();
  const products = cardProducts({ username: r.username, pages } as Card).filter((p) => p.item.name?.trim());
  return [
    ...pages.map((p, i) => ({
      url: i === 0 ? home : `${home}/${encodeURIComponent(p.slug)}`,
      lastModified, changeFrequency: "weekly" as const, priority: i === 0 ? 0.9 : 0.7,
    })),
    ...(full ? products : []).map((p) => ({ url: `${home}/${encodeURIComponent(p.slug)}`, lastModified, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}


/** Is this stored card's website the Premium one, switched on? */
export const isPremiumRow = (r: Row): boolean => !!activeAdvanced(r.site, r.username);

/** Does this website go on Google (and the other search engines)? The moment it is really live to visitors:
 *  - a Premium website that is switched on, or a Standard website that is switched on and past its first-day wait (lib/site-ready.ts);
 *  - not paused by Super Admin, not a demo account's (site.noindex), and with something on it.
 *  The plan itself (a paid Standard / Premium, not free or lapsed) is checked by the caller (card_owner_state), as it needs the database. */
export function searchListed(r: Row, now = Date.now()): boolean {
  // Standard and Premium both go on Google (owner, 16 Nov 2026: basic listing for Standard); what is listed differs, see cardUrls `full`.
  const s = r.site;
  if (!s || s.noindex === true || sitePaused(s)) return false;
  if (isPremiumRow(r)) return true;
  if (s.enabled !== true || sitePending(s, now)) return false;
  return (r.pages ?? []).some((p) => (p.blocks ?? []).length > 0);
}
