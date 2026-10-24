// "Website पूरी करें" — the guided finish after the website is made (owner, 24 Oct 2026: "jab ek step complete hota hai to next step
// jiski jarurat hai wo hi aaye … user one by one step apne se chalta jaaye aur web site complete ho jaaye"). One ordered list; each step
// is done when the card itself shows it, so a step filled anywhere else counts too. Every step's page returns to FINISH_HREF after Save,
// and that screen opens the next one still to do. Isomorphic: no 'use client'.
import type { Card, CardBlock } from "@/lib/types";

export const FINISH_HREF = "/poster/site/next";
const back = `back=${encodeURIComponent(FINISH_HREF)}`;

export type FinishKey = "products" | "photos" | "where" | "links" | "reviews" | "seo";
export type FinishStep = { key: FinishKey; done: boolean; href: string; en: string; hi: string; sub: string; subHi: string; icon: "plus" | "camera" | "map" | "phone" | "star" | "search" };

/** Only what a visitor sees: a hidden page (the Shubhora plans page) never makes a step look done. */
const blocksOf = (card: Card): CardBlock[] => card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks);
const has = <K extends CardBlock["kind"]>(card: Card, kind: K) => blocksOf(card).filter((b): b is Extract<CardBlock, { kind: K }> => b.kind === kind);

/** The steps in order, each with whether it is done. `products`: how many products the owner's list has (the list lives outside the card). */
export function finishSteps(card: Card, products = 0): FinishStep[] {
  const gallery = has(card, "gallery").reduce((n, b) => n + b.images.length, 0);
  const ownBanner = !!card.coverUrl && !card.coverUrl.startsWith("/api/stock/");
  const where = has(card, "location").some((b) => (b.address ?? "").trim() || (b.mapUrl ?? "").trim());
  const links = card.links.some((l) => ["upi", "instagram", "facebook", "youtube", "linkedin"].includes(l.type) && (l.value ?? "").trim());
  const reviews = has(card, "testimonials").some((b) => b.items.length > 0);
  const seo = card.seo;
  return [
    { key: "products", icon: "plus", done: products > 0, /* only the owner's own products count, never the services the AI wrote (owner, 24 Oct 2026: "2nd") */ href: `/poster/products?${back}`, en: "Products / services", hi: "Products / services", sub: "Name, price, photo", subHi: "नाम, दाम, photo" },
    { key: "photos", icon: "camera", done: ownBanner && gallery >= 2, href: `/poster/onboard?step=extras&part=photos&${back}`, en: "Photos & banner", hi: "Photos और banner", sub: "Yours, or made by AI", subHi: "आपकी, या AI से" },
    { key: "where", icon: "map", done: where, /* the address or the map pin is enough; timings are optional (least data, 24 Oct 2026) */ href: `/poster/onboard?step=where&${back}`, en: "Map & timings", hi: "Map और समय", sub: "Easy to find you", subHi: "ग्राहक आसानी से पहुँचें" },
    { key: "links", icon: "phone", done: links, href: `/poster/onboard?step=extras&part=links&${back}`, en: "UPI & social links", hi: "UPI और social links", sub: "Pay and follow", subHi: "Pay और follow" },
    { key: "reviews", icon: "star", done: reviews, href: `/poster/testimonials?${back}`, en: "Customer reviews", hi: "ग्राहकों की राय", sub: "Builds trust", subHi: "भरोसा बढ़ता है" },
    { key: "seo", icon: "search", done: !!(seo?.city || seo?.keywords?.length), href: `/poster/site/seo?${back}`, en: "Show on Google", hi: "Google पर दिखें", sub: "City and keywords", subHi: "शहर और keywords" },
  ];
}

/** The skipped steps ("बाद में") of this card, on this phone only — a convenience, never a lost answer. */
const skipKey = (cardId: string) => `site-finish-skip:${cardId}`;
export function skippedSteps(cardId: string): FinishKey[] {
  try { const v = JSON.parse(localStorage.getItem(skipKey(cardId)) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function skipStep(cardId: string, k: FinishKey) {
  try { localStorage.setItem(skipKey(cardId), JSON.stringify([...new Set([...skippedSteps(cardId), k])])); } catch { /* private mode */ }
}
export function clearSkips(cardId: string) { try { localStorage.removeItem(skipKey(cardId)); } catch { /* ignore */ } }
