// Is each part of the card filled in? (owner, 25 Oct 2026: "har line par bhara hai / khali hai"). Pure: the edit screens' list
// shows ✓ or an orange "Empty" from this, and the top line counts them. A part with no "filled" idea (look, text, pages …) has none.
import type { Card, CardBlock } from "./types";

export type PartState = "ok" | "empty";
type Kind = CardBlock["kind"];

const blocks = (c: Card): CardBlock[] => (c.pages ?? []).flatMap((p) => p.blocks ?? []);
const has = (c: Card, kinds: Kind[], full: (b: CardBlock) => boolean = () => true) => blocks(c).some((b) => kinds.includes(b.kind) && full(b));
const items = (b: CardBlock): number => ("items" in b && Array.isArray(b.items) ? b.items.length : "images" in b && Array.isArray(b.images) ? b.images.length : "rows" in b && Array.isArray(b.rows) ? b.rows.length : 0);
const link = (c: Card, types: string[]) => (c.links ?? []).some((l) => types.includes(l.type) && l.value?.trim());

export function partState(c: Card, key: string): PartState | undefined {
  const s = (ok: boolean): PartState => (ok ? "ok" : "empty");
  switch (key) {
    case "photos": return s(!!c.coverUrl || has(c, ["gallery", "image", "carousel"], (b) => items(b) > 0));
    case "products": return s(has(c, ["product", "services", "showcase"], (b) => items(b) > 0));
    case "about": return s(!!c.about?.trim() || has(c, ["about"], (b) => "body" in b && !!b.body?.trim()));
    case "details": return s(has(c, ["highlights", "services"], (b) => items(b) > 0));
    case "reviews": return s(has(c, ["testimonials"], (b) => items(b) > 0));
    case "you": return s(!!c.name?.trim() && !!c.avatarUrl && link(c, ["phone", "whatsapp"]));
    case "where": return s(has(c, ["location"], (b) => "address" in b && !!b.address?.trim()) || has(c, ["hours"], (b) => items(b) > 0) || link(c, ["location"]));
    case "links": return s(link(c, ["upi", "instagram", "facebook", "youtube", "linkedin"]));
    case "buttons": return s((c.links ?? []).some((l) => l.value?.trim()));
    case "trade": return s(!!c.company?.trim() && !!(c.seo?.category || c.jobTitle?.trim()));
    case "seo": return s(!!c.seo?.city?.trim());
    default: return undefined;
  }
}

/** Blocks with a screen of their own that edits exactly that block; every other block opens the full editor right at it. */
const BY_KIND: Partial<Record<Kind, string>> = {
  about: "about", product: "products", testimonials: "reviews", gallery: "photos", hours: "where", location: "where",
};
/** A website section the site draws by itself (not one of the card's blocks): known by the words of its heading. */
const WORDS: [RegExp, string][] = [
  [/visit|find us|locat|address|direction|map|timing|hours|open|पता|समय|मिलें/i, "where"],
  [/review|tell others|testimonial|customers say|rating|feedback|राय|समीक्षा/i, "reviews"],
  [/photo|gallery|तस्वीर|फ़ोटो/i, "photos"],
  [/product|price|menu|shop|catalog|दाम|सामान/i, "products"],
  [/about|story|who we are|परिचय|हमारे बारे/i, "about"],
  [/talk|contact|call|reach|get in touch|whatsapp|enquir|बात|संपर्क/i, "you"],
];
const byWords = (text: string) => WORDS.find(([re]) => re.test(text))?.[1];

export type PartTarget = { key: string; blockId?: string };
/** The part to open for a ✏️ tapped in the preview: a card part (profile, buttons, a block) or a website section by its heading.
 *  A block without its own screen ("Our promise", "How to order" …) opens Text & pages scrolled to that very block. */
export function partFor(c: Card, t: { kind: string; blockId?: string; text?: string }, site: boolean): PartTarget {
  if (t.kind === "profile") return { key: "you" };
  if (t.kind === "links") return { key: "buttons" };
  if (t.kind === "hero") return { key: site ? "hero" : "photos" };
  if (t.kind === "footer") return { key: "where" };
  const all = blocks(c);
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
  const b = t.kind === "block" ? all.find((x) => x.id === t.blockId)
    : t.text ? all.find((x) => norm(x.title ?? "") === norm(t.text!)) ?? all.find((x) => x.title && norm(t.text!).includes(norm(x.title))) : undefined;
  if (!b) return { key: (t.text && byWords(t.text)) || "text" };
  // Several blocks of one kind (two "highlights" lists): only the first is the one the own screen edits.
  const own = BY_KIND[b.kind];
  const first = all.find((x) => x.kind === b.kind);
  return own && first?.id === b.id ? { key: own } : { key: "text", blockId: b.id };
}
