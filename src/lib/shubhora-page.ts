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

import { getTemplate, SHUBHORA_SERVICE_PICS, SHUBHORA_SLIDES } from "@/lib/templates";
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

/** A card whose WHOLE business is Shubhora (the seller template): known by what it says — company or name Shubhora,
 *  "Shubhora partner" as the job title — never by the `kb` flag alone. A flag left on a card from an earlier
 *  "Sell Shubhora" choice (kb: "shubhora" on a school's card, 2 Oct 2026) must not switch the cleanup off. */
export function isShubhoraSellerCard(card: { company?: string; name?: string; jobTitle?: string; tagline?: string }): boolean {
  return /shubhora/i.test(String(card.company ?? "")) || /^shubhora$/i.test(String(card.name ?? "").trim()) || /shubhora partner/i.test(`${card.jobTitle ?? ""} ${card.tagline ?? ""}`);
}

/** Whether a Shubhora seller card draws its stored Premium design.
 *
 *  31 Oct 2026: a set-up switched from a tailor's card to the Shubhora card kept the tailor's Premium layout, so a seller card stopped
 *  drawing any Premium spec. The set-up now starts the seller card's website fresh, so a leftover can no longer come along — but the
 *  blanket rule also hid a Premium design a partner made FOR their Shubhora card (jaidevrajwal.com, 12 Nov 2026: the editor showed the
 *  Premium look, the live site the basic one, and every design change seemed to do nothing).
 *  A spec the designer wrote for this card speaks of what the card sells — Shubhora, the V-Card, digital tools — in its notes or its
 *  archetype; a tailor's or a sweet shop's does not, and stays hidden as before. Used by the public page and the editor's preview, so
 *  the two always agree. */
export function sellerDrawsPremium(site: unknown): boolean {
  const adv = site && typeof site === "object" ? (site as { advanced?: { notes?: unknown; archetype?: unknown } }).advanced : null;
  if (!adv || typeof adv !== "object") return false;
  // A design the partner picked on the choose screen (designChosenAt, api/card/advanced) was picked FOR this card: drawn (20 Nov 2026).
  if ((site as { designChosenAt?: unknown }).designChosenAt) return true;
  return /shubhora|v-?card|visiting card|digital (card|tools?|solutions?)|\btech\b|software|saas|\bai\b/i.test(`${String(adv.notes ?? "")} ${String(adv.archetype ?? "")}`);
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
    const offers = /\b(v-?card|digital (visiting |business )?card|daily poster|status video|ai assistant|whatsapp ai|account manager|custom software|any software|software (&|and) automation|auto-?post)/i.test(t);
    const costs = /2,?999|free for 1 year|worth ₹?1,?499|on request|any software|growth plan|standard plan|premium plan|custom solutions|free digital/i.test(t);
    return offers && costs;
  };
  // The seller template's other plan blocks and words: "Free vs Growth", "About the plans", "Not sure which plan?".
  const planWords = /shubhora|v-?card|growth plan|growth ₹|standard plan|standard ₹|premium plan|premium ₹|₹\s?2,?999|custom solutions|ai credits|digital (visiting |business )?card|which plan|the plans?\b/i;
  const pages = card.pages.map((p) => {
    // The Shubhora page itself stays off the tab row: the small icon and the strip are its only doors (owner's call).
    if (p.slug === SHUBHORA_PAGE_SLUG) return p.hidden ? p : { ...p, hidden: true };
    if (p.hidden) return p;
    const blocks = p.blocks.flatMap((b): CardBlock[] => {
      if (b.kind === "product") { const items = b.items.filter((i) => !ours(planText(i)) && !ours(i.imageUrl) && !(i.images ?? []).some(ours) && !isPlan(i)); return items.length ? [{ ...b, items }] : []; }
      if (b.kind === "showcase") { const items = b.items.filter((i) => !ours(i.label) && !ours(i.imageUrl) && !ours(i.url)); return items.length ? [{ ...b, items }] : []; }
      if (b.kind === "video" && (ours(b.url) || ours(b.title))) return [];
      if (b.kind === "pdf" && (ours(b.fileUrl) || ours(b.title))) return [];
      if (b.kind === "cta" && (ours(b.title) || ours(b.body) || /signup|join/i.test(b.joinUrl))) return [];
      if (b.kind === "gallery") { const images = b.images.filter((i) => !ours(i.url) && !ours(i.label)); return images.length ? [{ ...b, images }] : []; }
      if (b.kind === "image" || b.kind === "carousel") { const images = b.images.filter((i) => !ours(i.url) && !ours(i.caption)); return images.length ? [{ ...b, images }] : []; }
      if (b.kind === "faq" && planWords.test(b.title)) return [];
      if (b.kind === "faq") { const items = b.items.filter((i) => !ours(i.q) && !ours(i.a) && !planWords.test(`${i.q} ${i.a}`)); return items.length ? [{ ...b, items }] : []; }
      if (b.kind === "compare" && planWords.test(`${b.title} ${b.leftLabel} ${b.rightLabel} ${b.rows.map((r) => r.feature).join(" ")}`)) return [];
      if (b.kind === "contact" && planWords.test(`${b.title} ${b.note ?? ""}`)) return [];
      if (b.kind === "offer" && planWords.test(`${b.title} ${b.text}`)) return [];
      if (b.kind === "highlights") { const items = b.items.filter((i) => !planWords.test(i)); return items.length ? [{ ...b, items }] : []; }
      return [b];
    });
    return { ...p, blocks };
  });
  return { ...card, pages };
}

/** The free V-Card is over (owner, 20 Nov 2026: "free wala option band kar diya hai — jahan bhi free aata tha, hata dijiye"). Cards
 *  built from the Shubhora template before that still carry the offer in their stored text — the "Free V-Card" offer, the free plan,
 *  "Is the V-Card really free?", the Free column, the "Make free card" popup. Taken out here at render time, on Shubhora's own
 *  material only (a seller's card, or the Shubhora page of any card): an ordinary business's own "free" offers are never touched. */
const FREE_CARD = /free (digital )?(v-?card|card|visiting card|business card)|free for (you for )?(1|one|a full) year|worth ₹?\s?1,?499|make (my|your|yours|mine) (own )?free|no card details|free card|फ्री (कार्ड|v-?card)|मुफ़्त (digital )?card/i;
const FREE_SAY: [RegExp, string][] = [
  [/the free digital V-Card/gi, "the digital V-Card"],
  [/free digital V-Card/gi, "digital V-Card"],
  [/Your digital card and the leads it brings are free for your first year\.\s*/g, "Your digital card and the leads it brings come with every website plan. "],
  [/,? and make theirs free on the spot/g, " and set theirs up on the spot"],
  [/,? on your phone, free\./g, ", on your phone."],
  [/ · tap to make yours, free/g, " · tap to make yours"],
  [/ before you decide — free\./g, " before you decide."],
  [/makes your own card in that design, free — /g, "starts your own website in that design — "],
  [/ — free on every plan\./g, " — on every plan."],
  // The "one link" picture said FREE on the V-Card and "Start free — worth ₹1,499": redrawn without it under a new name (old copies cached).
  [/\/art\/shubhora\/one-link(-v2)?\.jpg/g, "/art/shubhora/plan-overview.jpg"],
  // The plan pictures were drawn left-aligned and lost their first letters in a narrow tile: redrawn with everything in the middle.
  [/\/art\/shubhora\/plan-(website-standard|website-premium|growth|custom)\.jpg/g, "/art/shubhora/plan-$1-v2.jpg"],
  // Nothing is "live in 10 minutes" any more: the team makes the website within 24 to 48 hours.
  [/This page IS the product/g, "This website IS the product"],
  [/Most people have theirs live in about 10 minutes\./g, "Ours is ready for you in 24 to 48 hours."],
  [/About 10 minutes, on a phone/g, "Ready in 24 to 48 hours"],
  [/is set up on their own phone in about 10 minutes/g, "is ready in 24 to 48 hours"],
];
const brandPhoto = (value: string) => value
  .replace(/\/art\/shubhora\/ai\/(hero-[123]|get-(?:link|contact|products|leads|website|ai|poster|ads)|biz-(?:demo|team))\.jpg(?=["\s?#]|$)/g, "/art/shubhora/brand-v2/$1.webp")
  .replace(/\/art\/shubhora\/hero\.jpg(?=["\s?#]|$)/g, "/art/shubhora/brand-v2/hero-1.webp");

const sayNoFree = (s: string) => FREE_SAY.reduce((t, [re, to]) => t.replace(re, to), s);

/** The Shubhora home page as it was before the story sections (20 Nov 2026): its "One link" ticks, the "Five tools" poster and the "This
 *  page IS the product" box are swapped for the template's facts strip, problem → answer, four-tools tiles and how-it-works steps; the
 *  "Made for your kind of business" tiles and "Start in three steps" are added once. Everything else on the page stays as it is. */
function homeWithStory(p: CardPage): CardPage {
  if (p.slug !== "home" || p.blocks.some((b) => b.kind === "story")) return p;
  const tpl = getTemplate("vcard-reseller")?.data.pages.find((x) => x.slug === "home")?.blocks ?? [];
  const story = tpl.filter((b) => b.kind === "story");
  if (!story.length) return p;
  const [stats, split, bento, flow, ...afterVideo] = story;
  const kinds = tpl.find((b) => b.kind === "showcase" && /kind of business/i.test(b.title));
  const old = (b: CardBlock) => (b.kind === "highlights" && /one link/i.test(b.title)) || (b.kind === "image" && /five tools/i.test(b.title)) || (b.kind === "cta" && /is the product/i.test(b.title));
  const out: CardBlock[] = [stats, split, bento, flow].filter(Boolean) as CardBlock[];
  for (const b of p.blocks) {
    if (old(b)) continue;
    if (b.kind === "services" && /what you get/i.test(b.title)) { out.push({ ...b, title: "Everything in one link" }); if (kinds) out.push(kinds); continue; }
    out.push(b);
    if (b.kind === "video") out.push(...afterVideo);
  }
  if (!p.blocks.some((b) => b.kind === "video")) out.push(...afterVideo);
  return { ...p, blocks: out.map((b, k) => ({ ...b, id: b.id || `sh-story-${k}` })) };
}

function pageWithoutFreeCard(p: CardPage): CardPage {
  const hit = (...xs: unknown[]) => FREE_CARD.test(xs.map((x) => String(x ?? "")).join(" | "));
  const blocks = p.blocks.flatMap((b0): CardBlock[] => {
    const b = JSON.parse(brandPhoto(sayNoFree(JSON.stringify(b0)))) as CardBlock;
    switch (b.kind) {
      case "offer": return hit(b.title, b.text) ? [] : [b];
      case "compare": return /^free$/i.test(b.rightLabel.trim()) || /^free$/i.test(b.leftLabel.trim()) ? [] : [b];
      case "product": { const items = b.items.filter((i) => !/^\s*free\b/i.test(i.price ?? "") && !hit(i.name, i.desc, i.price, i.badge)); return items.length ? [{ ...b, items }] : []; }
      case "services": { const items = b.items.filter((i) => !hit(i.name, i.desc)).map((i) => (!i.imageUrl && SHUBHORA_SERVICE_PICS[i.name.trim()] ? { ...i, imageUrl: SHUBHORA_SERVICE_PICS[i.name.trim()] } : i)); return items.length ? [{ ...b, items }] : []; }
      case "about": return !b.imageUrl && b.title.trim() === "Why this business" ? [{ ...b, imageUrl: "/art/shubhora/brand-v2/biz-demo.webp" }] : [b];
      case "faq": { const items = b.items.filter((i) => !hit(i.q, i.a)); return items.length ? [{ ...b, items }] : []; }
      case "highlights": { const items = b.items.filter((i) => !hit(i)); return items.length ? [{ ...b, items }] : []; }
      default: return [b];
    }
  });
  return { ...p, blocks };
}

export function withoutFreeCard<T extends { pages: CardPage[]; popup?: Card["popup"] }>(card: T, seller: boolean): T {
  const pages = card.pages.map((p) => (seller ? homeWithStory(pageWithoutFreeCard(p)) : p.slug === SHUBHORA_PAGE_SLUG ? pageWithoutFreeCard(p) : p));
  const pp = card.popup;
  const old = !!pp && (/^(make free card|see your own card, free)$/i.test(pp.title.trim()) || (seller && FREE_CARD.test(`${pp.title} | ${pp.subtitle ?? ""} | ${pp.ctaLabel} | ${pp.terms ?? ""}`)));
  const popup = pp && old
    ? { ...pp, title: "Get your website", subtitle: "Leave your number and I will help you get your own website and digital card.", ctaLabel: "Call me back", terms: "" }
    : pp;
  return withSellerHome(withSellerSlides({ ...card, pages, popup } as T, seller), seller);
}

/* ---------- the partner's home page, in the order a buyer reads it (plan Phase 6, 21 Nov 2026) ----------
   ChatGPT's review of a live partner site: the plans came right under the banner, five sections said the same thing, and a map
   of "All India" and festival posters sat on a product page. The home now runs: trust figures -> the problem and the answer ->
   the four tools -> how it works -> the film -> designs for each trade -> plans -> six questions -> the form. Only drawn this
   way; nothing stored changes, and the partner's other pages are left as they are. */

/** Old headings -> the agency's (the old ones were taken word for word from the first template). */
const SELLER_HEADS: Record<string, string> = {
  // ChatGPT's second review (21 Nov 2026): the WhatsApp-enquiry story is the strongest promise, so it is the headline now and
  // this section, which said the same, tells the before and after instead.
  "stop losing customers you never saw": "From scattered chats to organised growth",
  "turn every enquiry into a customer": "From scattered chats to organised growth",
  "ask me anything": "Get a demo made for your business",
  "four tools. one link.": "Everything your business needs, working together",
  "how it works together": "From first click to customer",
  "made for your kind of business": "A professional website for every business",
  "good to know": "Before you get started",
};
const SELLER_HEADLINE_OLD = "your whole business on one link";
// Six words at most: the hero drops a longer line for its own default (lib/site-hero.ts aiHeadline).
const SELLER_HEADLINE = "Turn WhatsApp enquiries into paying customers";
/** Earlier company lines a partner may still carry: they become the current one. */
const SELLER_HEADLINES_OLD = new Set([SELLER_HEADLINE_OLD, "your entire business. one smart platform"]);

function sellerRank(b: CardBlock, seen: { flow: number }): number | null {
  switch (b.kind) {
    case "story":
      if (b.style === "stats") return 10;
      if (b.style === "split") return 20;
      if (b.style === "bento") return 30;
      // The first run of steps is how the product works; a second one ("Start in three steps") said the same again.
      return seen.flow++ === 0 ? 40 : null;
    case "video": return 50;
    case "showcase": return 60;
    // "Everything in one link" repeated the four tools as a list: the Features page keeps the full list.
    case "services": return /everything in one link|what you get/i.test(b.title) ? null : 65;
    case "product": case "table": case "compare": return 70;
    case "testimonials": return 75;
    case "faq": return 80;
    case "location": case "hours": return 85;
    case "contact": case "form": case "appointment": return 90;
    default: return 66;
  }
}

/** The partner's inner pages (plan Phase 6): one comparison on "Why" instead of two (the paper-card one is the old V-Card pitch), the
 *  template steps as a numbered timeline, and the questions under the company's heading everywhere. */
function sellerInnerPage(p: CardPage): CardPage {
  const blocks = p.blocks.flatMap((b): CardBlock[] => {
    if (b.kind === "compare" && /paper visiting card/i.test(b.title)) return [];
    if (b.kind === "services" && /how a template becomes/i.test(b.title) && b.items.length >= 2 && b.items.length <= 6) {
      return [{ id: b.id, kind: "story", style: "flow", title: b.title, items: b.items.map((it) => ({ title: it.name.replace(/^\d+[.)]\s*/, ""), ...(it.desc ? { text: it.desc } : {}) })) }];
    }
    if (b.kind === "faq" && /^good to know$/i.test(b.title.trim())) return [{ ...b, title: SELLER_HEADS["good to know"] }];
    return [b];
  });
  return blocks.length === p.blocks.length && blocks.every((b, i) => b === p.blocks[i]) ? p : { ...p, blocks };
}

function sellerHomePage(p: CardPage): CardPage {
  if (p.slug !== "home") return p;
  const seen = { flow: 0 };
  const ranked = p.blocks.map((b, i) => ({ b, i, r: sellerRank(b, seen) })).filter((x) => x.r !== null) as { b: CardBlock; i: number; r: number }[];
  ranked.sort((x, y) => x.r - y.r || x.i - y.i);
  const blocks = ranked.map(({ b }) => {
    const t = "title" in b ? SELLER_HEADS[(b.title ?? "").trim().toLowerCase()] : undefined;
    const out = (t ? { ...b, title: t } : b) as CardBlock;
    // Six questions on the home page; the rest stay on the page that has them.
    return out.kind === "faq" && out.items.length > 6 ? { ...out, items: out.items.slice(0, 6) } : out;
  });
  return { ...p, blocks };
}

/** The home's order as section keys: its own blocks, and the sections the website pulls in from other pages (the plans from the Plans
 *  page come in as "featured") placed by the same ranks, so a pulled section cannot jump to the top. */
function sellerOrder(home: CardPage): string[] {
  const seen = { flow: 0 };
  const own = home.blocks.map((b, i) => ({ k: b.id, r: sellerRank(b, seen) ?? 66, i }));
  const pulled = [["gallery", 62], ["featured", 70], ["reviews", 75], ["faq", 80], ["visit", 85]].map(([k, r], j) => ({ k: k as string, r: r as number, i: 1000 + j }));
  return [...own, ...pulled].sort((x, y) => x.r - y.r || x.i - y.i).map((x) => x.k);
}

function withSellerHome<T extends { pages: CardPage[] }>(card: T, seller: boolean): T {
  if (!seller) return card;
  const c = card as T & { site?: Card["site"]; company?: string };
  const pages = card.pages.map((p) => sellerHomePage(sellerInnerPage(p)));
  const home = pages.find((p) => p.slug === "home");
  const site = c.site;
  const hero = site?.hero;
  const key = (h?: string) => (h ?? "").replace(/\s+/g, " ").trim().replace(/[.!]$/, "").toLowerCase();
  const fresh = (h?: string) => (SELLER_HEADLINES_OLD.has(key(h)) ? SELLER_HEADLINE : h);
  const slides = hero?.slides?.map((sl, i) => (i === 0 ? { ...sl, headline: fresh(sl.headline) ?? sl.headline } : sl));
  const nextSite = site ? {
    ...site,
    hero: hero ? { ...hero, headline: fresh(hero.headline) ?? hero.headline, ...(slides ? { slides } : {}) } : hero,
    // This order wins over the partner's saved one and the trade's own (which put the plans first): the company's page.
    home: { ...(site.home ?? {}), order: home ? sellerOrder(home) : site.home?.order, hidden: [...new Set([...(site.home?.hidden ?? []), "updates", "ask-review"])] },
  } as Card["site"] : site;
  // "Shubhora Digital V-Card" was the first product name; the company sells a website first now.
  const company = c.company && /digital\s*v-?card/i.test(c.company) ? "Shubhora · Website, Digital Card & AI" : c.company;
  const seoT = (c as { seoTitle?: string }).seoTitle;
  const seoTitle = seoT && /digital\s*v-?card/i.test(seoT) ? seoT.replace(/(shubhora\s*)?digital\s*v-?card/i, "Shubhora · Website, Digital Card & AI") : seoT;
  return { ...card, pages, site: nextSite, ...(c.company !== undefined ? { company } : {}), ...(seoT !== undefined ? { seoTitle } : {}) } as T;
}

/** A Shubhora card made before the three banners gets them when it is drawn: its own first banner (the partner's picture and line stay),
 *  then the website and the AI banners. A card that already has banners of its own is left alone. */
function withSellerSlides<T extends { pages: CardPage[] }>(card: T, seller: boolean): T {
  const c = card as T & { site?: Card["site"]; coverUrl?: string };
  if (!seller || !c.site) return card;
  const hero = c.site.hero;
  const coverUrl = c.coverUrl ? brandPhoto(c.coverUrl) : c.coverUrl;
  if (hero?.slides && hero.slides.length >= 2) {
    const slides = hero.slides.map((slide, index) => {
      if (!slide.imageUrl) return slide;
      const imageUrl = brandPhoto(slide.imageUrl);
      const currentBrandSlide = SHUBHORA_SLIDES[index]?.imageUrl === imageUrl;
      return { ...slide, imageUrl, ...(currentBrandSlide ? { chips: SHUBHORA_SLIDES[index].chips } : {}) };
    });
    return { ...card, coverUrl, site: { ...c.site, hero: { ...hero, imageUrl: hero.imageUrl ? brandPhoto(hero.imageUrl) : hero.imageUrl, slides } } };
  }
  // Shubhora's own three banners (owner, 20 Nov 2026): the partner's picture stays on the card, it is not the website's banner — a
  // headline over a face read badly. The partner's own first line is kept when they wrote one.
  const first = { ...SHUBHORA_SLIDES[0], headline: c.site.hero?.headline || SHUBHORA_SLIDES[0].headline, sub: c.site.hero?.sub || SHUBHORA_SLIDES[0].sub };
  return { ...card, coverUrl, site: { ...c.site, hero: { ...(c.site.hero ?? {}), ...(hero?.imageUrl ? { imageUrl: brandPhoto(hero.imageUrl) } : {}), slides: [first, SHUBHORA_SLIDES[1], SHUBHORA_SLIDES[2]] } } };
}
