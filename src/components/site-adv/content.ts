// What the advanced page has to say, read once from the card: every variant draws from this one object, so a section
// is hidden when its slice is empty and no variant has to know how the card stores things. Pure (no React).
//
// Reads the same material the basic site shows (isEmptyBlock / trustFacts / heroModel), only all of it: the basic home
// previews four products, an advanced one-page site shows the catalogue.
import type { Card, CardBlock, FaqItem, HoursRow, TestimonialItem } from "@/lib/types";
import { heroModel, tradeLabel, type HeroModel } from "@/lib/site-hero";
import { isEmptyBlock, trustFacts, type TrustFact } from "@/lib/site-home";
import { cardProducts } from "@/lib/product-page";
import { splitGlyph } from "@/components/card-view";

export type Offering = {
  name: string; desc?: string; price?: string; mrp?: string; badge?: string;
  /** All photos of the item, first is the cover. */
  images: string[];
  /** The product's own page (a products page address), when it has one. */
  slug?: string;
};
export type SiteContent = {
  /** The hero as one model (kicker, claim, line, trust, the two buttons, the photo) in the visitor's language. */
  hm: HeroModel;
  name: string;
  trade: string;
  city: string;
  facts: TrustFact[];
  /** "UPI accepted", "Home delivery"... the owner's short facilities, emoji stripped. */
  highlights: string[];
  about?: { title: string; paras: string[]; image?: string };
  offerings?: { kind: "products" | "services"; title: string; items: Offering[]; total: number };
  steps: { name: string; desc: string }[];
  gallery: { url: string; label: string }[];
  reviews: { items: TestimonialItem[]; avg: number; total: number };
  faq: FaqItem[];
  visit?: { address: string; mapUrl: string; hours: HoursRow[] };
  /** The offer the owner is running right now (the strip under the header). */
  offer?: { title: string; text: string };
  /** Distinct photos the page owns (cover, products, gallery, about) for variants that want a picture. */
  photos: string[];
};

const paras = (s?: string | null) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
/** "3. Pick up" -> "Pick up". */
const unstep = (s: string) => s.replace(/^\s*\d+[.)]\s*/, "").trim();
const mapOk = (u?: string) => !!u && /^https?:\/\//i.test(u.trim());

export function buildContent(card: Card, lang: string): SiteContent {
  const hi = lang === "hi";
  const hiddenSlugs = new Set(card.site?.hidden ?? []);
  const pages = card.pages.filter((p) => !p.hidden && !hiddenSlugs.has(p.slug));
  const blocks: CardBlock[] = pages.flatMap((p) => p.blocks).filter((b) => !isEmptyBlock(b));
  const hm = heroModel(card, lang);
  const all = <K extends CardBlock["kind"]>(kind: K) => blocks.filter((b): b is Extract<CardBlock, { kind: K }> => b.kind === kind);

  /* ---- the offerings: products first (they have photos and prices), else the services ---- */
  const prodBlocks = all("product");
  const slugOf = new Map(cardProducts(card).map((p) => [p.item, p.slug]));
  const products = prodBlocks.flatMap((b) => b.items).filter((p) => (p.name ?? "").trim());
  const toOffering = (p: (typeof products)[number]): Offering => ({
    name: p.name.trim(), desc: (p.desc ?? "").trim() || undefined, price: (p.price ?? "").trim() || undefined, mrp: (p.mrp ?? "").trim() || undefined,
    badge: (p.badge ?? "").trim() || undefined,
    images: [...(p.images ?? []), ...(p.imageUrl ? [p.imageUrl] : [])].filter((u, i, a) => u && a.indexOf(u) === i),
    slug: slugOf.get(p),
  });
  // A services block whose first item starts "1. " is the owner's steps ("how it works"), not an offering.
  const isSteps = (b: Extract<CardBlock, { kind: "services" }>) => /^\s*1[.)]\s/.test(b.items[0]?.name ?? "");
  const serviceBlocks = all("services");
  const services = serviceBlocks.filter((b) => !isSteps(b)).flatMap((b) => b.items).filter((s) => (s.name ?? "").trim());
  const steps = serviceBlocks.filter(isSteps).flatMap((b) => b.items).filter((s) => (s.name ?? "").trim()).slice(0, 6).map((s) => ({ name: unstep(s.name), desc: (s.desc ?? "").trim() }));
  const offerings: SiteContent["offerings"] = products.length
    ? { kind: "products", title: prodBlocks[0]?.title?.trim() || (hi ? "हमारे प्रोडक्ट" : "Our products"), items: products.slice(0, 9).map(toOffering), total: products.length }
    : services.length
      ? { kind: "services", title: serviceBlocks.find((b) => !isSteps(b))?.title?.trim() || (hi ? "हमारी सेवाएँ" : "What we do"), items: services.slice(0, 9).map((s) => ({ name: s.name.trim(), desc: (s.desc ?? "").trim() || undefined, images: [] })), total: services.length }
      : undefined;

  /* ---- about ---- */
  const ab = all("about")[0];
  const aboutText = paras(ab?.body ?? card.about);
  const about: SiteContent["about"] = aboutText.length || ab?.imageUrl
    ? { title: ab?.title?.trim() || (hi ? "हमारे बारे में" : "Our story"), paras: aboutText, image: ab?.imageUrl || undefined }
    : undefined;

  /* ---- the rest ---- */
  const gallery = [
    ...all("gallery").flatMap((b) => b.images.map((i) => ({ url: i.url ?? "", label: (i.label ?? "").trim() }))),
    ...[...all("carousel"), ...all("image")].flatMap((b) => b.images.map((i) => ({ url: i.url, label: (i.caption ?? "").trim() }))),
  ].filter((g, i, a) => g.url && a.findIndex((x) => x.url === g.url) === i).slice(0, 9);

  const revItems = all("testimonials").flatMap((b) => b.items).filter((x) => (x.text ?? "").trim());
  const avg = revItems.length ? revItems.reduce((s, x) => s + (Number(x.rating) || 0), 0) / revItems.length : 0;
  const reviews = { items: [...revItems].sort((a, b) => (b.rating - a.rating) || (b.text.length - a.text.length)).slice(0, 3), avg, total: revItems.length };

  const faq = all("faq").flatMap((b) => b.items).filter((x) => (x.q ?? "").trim() && (x.a ?? "").trim()).slice(0, 8);

  const loc = all("location").find((b) => (b.address ?? "").trim() || mapOk(b.mapUrl));
  const hrs = all("hours").flatMap((b) => b.rows).filter((r) => (r.day ?? "").trim() && (r.time ?? "").trim()).slice(0, 7);
  const mapLink = card.links.find((l) => l.type === "location" && l.value.trim())?.value.trim() ?? "";
  const visit: SiteContent["visit"] = loc || hrs.length || mapLink
    ? { address: (loc?.address ?? "").trim(), mapUrl: mapOk(loc?.mapUrl) ? loc!.mapUrl!.trim() : mapOk(mapLink) ? mapLink : "", hours: hrs }
    : undefined;

  // The owner's "good to know" line: the first highlights block with 2-6 short items (the basic site's rule).
  const hl = pages.flatMap((p) => p.blocks).find((b): b is Extract<CardBlock, { kind: "highlights" }> => b.kind === "highlights" && !b.items.some((x) => (x ?? "").startsWith("✅")));
  const hlItems = (hl?.items ?? []).map((s) => splitGlyph((s ?? "").trim()).text.trim()).filter(Boolean);
  const highlights = hlItems.length >= 2 && hlItems.length <= 8 ? hlItems : [];

  let offer: SiteContent["offer"];
  for (const b of all("offer")) {
    if (!(b.text ?? "").trim()) continue;
    if (b.expires && !Number.isNaN(Date.parse(b.expires)) && Date.parse(b.expires) + 86_400_000 < Date.now()) continue;
    offer = { title: (b.title ?? "").trim(), text: b.text.trim() }; break;
  }

  const photos = [...new Set([
    ...(card.coverUrl ? [card.coverUrl] : []),
    ...(about?.image ? [about.image] : []),
    ...(offerings?.items ?? []).map((o) => o.images[0] ?? ""),
    ...gallery.map((g) => g.url),
  ].filter(Boolean))];

  return {
    hm, name: hm.name, trade: tradeLabel(card, hi), city: (card.seo?.city ?? "").trim(),
    facts: trustFacts(card), highlights, about, offerings, steps, gallery, reviews, faq, visit, offer, photos,
  };
}

/** Which sections have something to say - the renderer draws only these (hero and footer always). */
export function sectionHasContent(key: string, c: SiteContent, hasContact: boolean): boolean {
  switch (key) {
    case "hero": case "footer": return true;
    case "trust": return c.facts.length >= 2;
    case "about": return !!c.about;
    case "services": return !!c.offerings;
    case "gallery": return c.gallery.length >= 3;
    case "proof": return c.reviews.items.length >= 1;
    case "process": return c.steps.length >= 2;
    case "faq": return c.faq.length >= 2;
    case "visit": return !!c.visit;
    case "cta": return hasContact;
    default: return false;
  }
}
