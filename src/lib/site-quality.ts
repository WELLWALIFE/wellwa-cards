import type { Card, CardBlock, CardPage } from "@/lib/types";
import { isEmptyBlock } from "@/lib/site-home";

/**
 * The website check (plan Phase 2, 21 Nov 2026): rules every generated site is held to before a visitor sees it.
 * `withQuality` makes the safe fixes at render time (nothing saved is changed); `checkSite` lists what is left for
 * the owner, shown on the website edit screen. Same rules for every user and every trade.
 */

/** An address that is no place at all: "All India", "Pan India", "Online". A map of it is a pin in the middle of the country. */
export function vagueAddress(a?: string | null): boolean {
  return /\b(all|pan)[\s-]*india\b|\bnation\s*wide\b|\bonline\b|\bacross india\b|पूरे भारत|ऑनलाइन/i.test((a ?? "").trim());
}

/** Only a town or a state, no street: the map works but finds the town, not the shop. Noted for the owner, never hidden. */
export function townOnly(a?: string | null): boolean {
  const s = (a ?? "").trim();
  return !!s && !vagueAddress(s) && !/\d/.test(s) && s.split(/[\s,]+/).filter(Boolean).length <= 2;
}

/** A price card drawn as a picture ("plan-standard.jpg"): artwork about a plan, not a photo of anything. It never stands in for a
 *  product photo at the top of a page (the 12-design review, 21 Nov 2026: four price cards opened Tile Board and Order Shop). */
export const isPlanArt = (u?: string | null): boolean => /\/(shubhora-)?plan-[\w-]+\.(jpe?g|png|webp)/i.test(u ?? "");

const isLoc = (b: CardBlock): b is Extract<CardBlock, { kind: "location" }> => b.kind === "location";

function pageWithQuality(p: CardPage): CardPage {
  // A map of "All India" (a pin in the middle of the country) with "Get directions" read as unfinished: the section goes.
  if (!p.blocks.some((b) => isLoc(b) && !b.mapUrl && vagueAddress(b.address))) return p;
  return { ...p, blocks: p.blocks.filter((b) => !(isLoc(b) && !b.mapUrl && vagueAddress(b.address))) };
}

/** The old default name of a gallery ("Photos" / "फ़ोटो"), which the owner never chose. A name the owner typed stays. */
const OLD_GALLERY = /^\s*(photos?|photo gallery|फ़ोटो|फोटो|फ़ोटोज़|तस्वीरें)\s*$/i;
const galleryWord = (s: string) => (/[\u0900-\u097F]/.test(s) ? "गैलरी" : "Gallery");

/** Every card calls its photo album "Gallery" (owner, 22 Nov 2026: "photo ki jagah gallery, by default sabhi me"): a page or a
 *  gallery section still under the old default name "Photos" is shown as "Gallery". Pure; the saved card is never changed. */
export function galleryNamed(card: Card): Card {
  let changed = false;
  const pages = card.pages.map((p) => {
    if (!p.blocks.some((b) => b.kind === "gallery")) return p;
    const label = OLD_GALLERY.test(p.label ?? "") ? galleryWord(p.label) : p.label;
    const blocks = p.blocks.map((b) => (b.kind === "gallery" && OLD_GALLERY.test(b.title ?? "") ? { ...b, title: galleryWord(b.title) } : b));
    if (label === p.label && blocks.every((b, i) => b === p.blocks[i])) return p;
    changed = true;
    return { ...p, label, blocks };
  });
  return changed ? { ...card, pages } : card;
}

/** The safe fixes, for the page as drawn. The saved card is never changed. */
export function withQuality(card: Card): Card {
  card = galleryNamed(card);
  const pages = card.pages.map(pageWithQuality);
  return pages.every((p, i) => p === card.pages[i]) ? card : { ...card, pages };
}

export interface QualityNote {
  /** Where the owner mends it: a section of "Text & pages" (blockId) or a part of the editor (part). */
  blockId?: string; part?: string;
  /** "fixed": the site already handles it; "todo": something only the owner can give. */
  level: "fixed" | "todo";
  page: string;
  en: string;
  hi: string;
}

const words = (s?: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

/** Does the section show a picture of its own? */
function hasPicture(b: CardBlock): boolean {
  switch (b.kind) {
    case "about": return !!b.imageUrl;
    case "services": return b.items.some((it) => it.imageUrl);
    // A timeline, a before/after or a strip of figures is a composition of its own, not a wall of words.
    case "story": return b.items.some((it) => it.imageUrl) || b.style !== "bento";
    // An icon grid and a folded list of questions read at a glance.
    case "highlights": case "faq": return true;
    case "product": return true;
    case "showcase": return b.items.some((it) => it.imageUrl);
    case "gallery": case "image": case "carousel": return b.images.length > 0;
    case "video": case "pdf": return true;
    // Sections that are a tool, not a read: a form, the map, the hours, a button.
    case "contact": case "form": case "location": case "hours": case "appointment": case "cta": case "offer": return true;
    default: return false;
  }
}

const title = (b: CardBlock) => ("title" in b ? (b.title ?? "").trim() : "");

export function checkSite(card: Card): QualityNote[] {
  const out: QualityNote[] = [];
  const hiddenPages = new Set(card.site?.hidden ?? []);
  const hiddenSections = new Set(card.site?.home?.hidden ?? []);
  const pages = card.pages.filter((page) => !page.hidden && !hiddenPages.has(page.slug));
  const contact = card.links.some(({ type, value }) => {
    if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    const digits = value.replace(/\D/g, "");
    if (type === "whatsapp") return /^\d{8,15}$/.test(digits);
    return type === "phone" && /^\d{6,15}$/.test(digits);
  });
  const contactSection = pages.some((page) => page.blocks.some((block) => {
    if (page.slug === "home" && hiddenSections.has(block.id)) return false;
    if (block.kind === "contact" || (block.kind === "form" && !isEmptyBlock(block))) return true;
    if (block.kind !== "appointment") return false;
    try {
      const url = new URL(block.url);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch { return false; }
  }));
  const personal = card.seo?.categoryKey === "personal";
  if (!personal && !contact && !contactSection) out.push({
    level: "todo", page: "Website", part: "you", en: "Add a working phone, WhatsApp, email, contact form or booking link so customers can reach you.",
    hi: "ग्राहक आपसे संपर्क कर सकें, इसके लिए सही फ़ोन, WhatsApp, ईमेल, संपर्क फ़ॉर्म या बुकिंग लिंक जोड़ें।",
  });
  for (const p of pages) {
    const name = p.label || p.slug;
    const blocks = p.blocks.filter((block) => !isEmptyBlock(block) && !(p.slug === "home" && hiddenSections.has(block.id)));
    if (p.slug === "home" && blocks.length > 11) out.push({ level: "todo", page: name, part: "home", en: `Home has ${blocks.length} sections. 9 to 11 read best; hide the ones that repeat.`, hi: `Home पर ${blocks.length} हिस्से हैं। 9 से 11 सबसे अच्छे लगते हैं; जो दोहराते हैं उन्हें छुपाएँ।` });
    blocks.forEach((b, i) => {
      const tt = title(b);
      if (tt && words(tt) > 8) out.push({ level: "todo", page: name, blockId: b.id, en: `"${tt}" is a long heading. Keep it to 8 words or fewer.`, hi: `"${tt}" लंबी heading है। 8 शब्द या कम रखें।` });
      if (b.kind === "faq" && p.slug === "home" && b.items.length > 6) out.push({ level: "todo", page: name, blockId: b.id, en: `${b.items.length} questions on Home. Keep the top 6; put the rest on a page of their own.`, hi: `Home पर ${b.items.length} सवाल हैं। सबसे ज़रूरी 6 रखें, बाक़ी अलग पेज पर।` });
      if (isLoc(b) && !b.mapUrl && vagueAddress(b.address)) out.push({ level: "fixed", page: name, part: "where", en: `The address "${b.address.trim()}" is not a place on a map, so the map is hidden. Add your full address to show it.`, hi: `पता "${b.address.trim()}" नक्शे पर कोई जगह नहीं है, इसलिए नक्शा छुपा दिया। पूरा पता डालें तो दिखेगा।` });
      if (isLoc(b) && !b.mapUrl && townOnly(b.address)) out.push({ level: "todo", page: name, part: "where", en: `The address "${b.address.trim()}" has no street, so the map finds the town, not you. Add the full address or a Google Maps link.`, hi: `पते "${b.address.trim()}" में गली/दुकान नहीं है, नक्शा सिर्फ़ शहर दिखाएगा। पूरा पता या Google Maps link डालें।` });
      // Three sections of words in a row is where a page starts to read like a document (two is normal on an inner page).
      const p1 = blocks[i - 1], p2 = blocks[i - 2];
      if (p1 && p2 && !hasPicture(p2) && !hasPicture(p1) && !hasPicture(b)) out.push({ level: "todo", page: name, blockId: p1.id, en: `"${title(p2) || p2.kind}", "${title(p1) || p1.kind}" and "${tt || b.kind}" are three sections of text in a row. Add a photo to the middle one.`, hi: `"${title(p2) || p2.kind}", "${title(p1) || p1.kind}" और "${tt || b.kind}" लगातार तीन हिस्से सिर्फ़ लिखाई के हैं। बीच वाले में फ़ोटो डालें।` });
      if (tt && blocks.slice(0, i).some((x) => title(x).toLowerCase() === tt.toLowerCase())) out.push({ level: "todo", page: name, blockId: b.id, en: `Two sections are called "${tt}". Rename or join them.`, hi: `दो हिस्सों का नाम "${tt}" है। एक का नाम बदलें या दोनों को जोड़ें।` });
    });
  }
  // One note per thing: the same pair can come up only once, but a long page could still list a lot; the first 8 are enough to act on.
  return out.slice(0, 8);
}
