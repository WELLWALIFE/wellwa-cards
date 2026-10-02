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
import type { Card, CardBlock, CardPage } from "@/lib/types";
import { ownNotes, ownPersona } from "../../bridge/shubhora-kb.mjs";

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

/** Shubhora's own artwork, put on the card by the seller template. */
const SHUBHORA_ART = /\/art\/brand\/shubhora-/i;

/** Turn a partner whose WHOLE card is Shubhora (`kb: "shubhora"`) into a "both" card, so they can add their
 *  own business without losing the Shubhora side.
 *
 *  Their Shubhora pages are replaced by the one standard Shubhora page, which keeps every bit of that content
 *  alive on its own link (/c/<user>/shubhora) and keeps it updating with the template. What comes off is the
 *  identity the seller template gave them — Shubhora's company name, job title, tagline, about, logo, banner,
 *  pop-up, search words and its own links — because from here the card is their own business. Their link,
 *  username, domain, number, buttons, their photo and anything they wrote themselves all stay.
 *
 *  The card is left with an empty home page on purpose: the caller sends them straight to the business form
 *  and the AI card builder, which fill it. */
export function toBothFromShubhora(card: Card, own?: { photo?: string | null }): Card {
  const page = shubhoraPage();
  const home: CardPage = { id: "p1", slug: "home", label: "Home", blocks: [] };
  // The seller template's own links (shubhora.com, the Shubhora videos) come off; the owner's phone,
  // WhatsApp and email — which they filled in themselves — stay. Matching the template's own values is
  // exact, so a link they added or edited is never dropped by accident.
  const tplLinks = new Set(
    (getTemplate("vcard-reseller")?.data.links ?? [])
      .map((l) => l.value)
      .filter((v) => v && !/^\+91$/.test(v) && !/you@example\.com/i.test(v)),
  );
  const avatarWasTheirs = !SHUBHORA_ART.test(card.avatarUrl ?? "");
  return {
    ...card,
    kb: "both",
    company: "", jobTitle: "", tagline: "", about: "",
    avatarUrl: avatarWasTheirs ? card.avatarUrl : (own?.photo || ""),
    ...(avatarWasTheirs ? {} : { avatarShape: undefined }),
    coverUrl: SHUBHORA_ART.test(card.coverUrl ?? "") ? "" : card.coverUrl,
    popup: undefined,
    // Their own words are kept; the template's defaults, which spoke for Shubhora, are not.
    botPersona: ownPersona(card.botPersona),
    botKnowledge: ownNotes(card.botKnowledge),
    // These described Shubhora on Google. The builder writes new ones for their business.
    seoTitle: "", seoDescription: "",
    links: card.links.filter((l) => !tplLinks.has(l.value)),
    pages: page ? [home, page] : [home],
  };
}

/** Shubhora's own material that reached a "both" card's OWN pages (built before 2 Oct 2026, when the build still took
 *  the Shubhora plans as the owner's products and shubhora.com as their website): the plan products, the Shubhora
 *  demo videos / PDFs and the "Register free" call. Taken off the visible pages at render time; the hidden Shubhora
 *  page keeps all of it. Rebuilding the card makes this a no-op. */
export function withoutShubhoraLeaks<T extends { pages: CardPage[] }>(card: T): T {
  const ours = (s: unknown) => /shubhora/i.test(String(s ?? "")) || /\/api\/stock\/vcard\//i.test(String(s ?? ""));
  // The three plans as the build renamed and re-hosted them ("Growth plan ₹2,999 a month", "Free for 1 year", "Custom
  // solutions — on request", their pictures copied into the owner's bucket): what they offer plus what they cost.
  const planText = (i: { name?: string; desc?: string; badge?: string; price?: string; mrp?: string; features?: string[] }) =>
    [i.name, i.desc, i.badge, i.price, i.mrp, ...(i.features ?? [])].map((x) => String(x ?? "")).join(" | ");
  const isPlan = (i: { name?: string; desc?: string; badge?: string; price?: string; mrp?: string; features?: string[] }) => {
    const t = planText(i);
    const offers = /\b(v-?card|digital (visiting |business )?card|daily poster|status video|ai assistant|whatsapp ai|account manager|custom software|auto-?post)/i.test(t);
    const costs = /2,?999|free for 1 year|worth ₹?1,?499|on request|any software|growth plan|custom solutions|free digital/i.test(t);
    return offers && costs;
  };
  const pages = card.pages.map((p) => {
    // The Shubhora page itself stays off the tab row: the small icon and the strip are its only doors (owner's call).
    if (p.slug === SHUBHORA_PAGE_SLUG) return p.hidden ? p : { ...p, hidden: true };
    if (p.hidden) return p;
    const blocks = p.blocks.flatMap((b): CardBlock[] => {
      if (b.kind === "product") { const items = b.items.filter((i) => !ours(i.name) && !ours(i.imageUrl) && !(i.images ?? []).some(ours) && !isPlan(i)); return items.length ? [{ ...b, items }] : []; }
      if (b.kind === "showcase") { const items = b.items.filter((i) => !ours(i.label) && !ours(i.imageUrl) && !ours(i.url)); return items.length ? [{ ...b, items }] : []; }
      if (b.kind === "video" && (ours(b.url) || ours(b.title))) return [];
      if (b.kind === "pdf" && (ours(b.fileUrl) || ours(b.title))) return [];
      if (b.kind === "cta" && (ours(b.title) || ours(b.body) || /signup|join/i.test(b.joinUrl))) return [];
      return [b];
    });
    return { ...p, blocks };
  });
  return { ...card, pages };
}
