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

const BY_KIND: Partial<Record<Kind, string>> = {
  about: "about", highlights: "details", services: "products", product: "products", showcase: "products",
  gallery: "photos", image: "photos", carousel: "photos", testimonials: "reviews", hours: "where", location: "where", contact: "you",
};
/** The part to open for a ✏️ tapped in the preview: a card part (profile, buttons, a block) or a website section by its heading. */
export function partFor(c: Card, t: { kind: string; blockId?: string; text?: string }, site: boolean): string {
  if (t.kind === "profile") return "you";
  if (t.kind === "links") return "buttons";
  if (t.kind === "hero") return site ? "hero" : "photos";
  if (t.kind === "footer") return "where";
  const all = blocks(c);
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
  const b = t.kind === "block" ? all.find((x) => x.id === t.blockId)
    : t.text ? all.find((x) => norm(x.title ?? "") === norm(t.text!)) ?? all.find((x) => x.title && norm(t.text!).includes(norm(x.title))) : undefined;
  return (b && BY_KIND[b.kind]) || "text";
}
