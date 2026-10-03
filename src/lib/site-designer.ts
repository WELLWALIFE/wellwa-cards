// The website's designer (owner's call, 2 Oct 2026: "site ke design ke liye ek senior AI ko train karo —
// category aur data ke hisaab se, latest design ke hisaab se").
//
// One AI call per build, in parallel with the copy-writer: a senior web designer's brief about THIS business
// (trade, its own answers, what it has — products, photos, portrait, reviews — language, reach) and the exact
// menu the renderer can draw (15 palettes, 8 font pairs, 6 hero layouts, 3 corner radii, the home sections).
// It returns a design plan; every value is checked against that menu, and anything the content cannot carry
// (a photo hero with no banner, a product mosaic with two photos) is dropped. The plan sits between the trade's
// default look and the owner's own choices: a reference website or a hand-picked look always wins over it, and
// when the AI is slow or down the trade's default look stands, so no build ever waits on the designer.
//
// Server only (reads GEMINI_API_KEY).
import { categoryOf } from "@/lib/poster-categories";
import { recipeFor, type HomeKind } from "@/lib/site-recipes";
import { FONT_PAIRS, HERO_LAYOUTS, RADII, SITE_PALETTES, cleanLayouts, type HeroLayout } from "@/lib/site-style";
import { tradeAnswerLines } from "@/lib/trade-questions";
import { logUsage } from "@/lib/ai-usage";
import type { CardFacts, SetupInfo, SavedProduct } from "@/lib/card-facts";
import type { SiteStyle } from "@/lib/types";

export type SiteDesignPlan = {
  style: SiteStyle;
  /** Home sections, first to last (the composer's HomeKind words). */
  order?: HomeKind[];
  /** One line on why — logged, shown nowhere. */
  why: string;
};

const MODEL = "gemini-3.5-flash-lite";
const HOME_KINDS: HomeKind[] = ["trust", "catalog", "services", "whyUs", "steps", "about", "offer", "booking", "photos", "reviews"];

/** What the designer is told about the business. */
export type DesignBrief = {
  setup: SetupInfo;
  facts: CardFacts;
  products: SavedProduct[];
  reviews: number;
  /** The default look the trade would get without the designer. */
  defaults: SiteStyle;
  /** A website the owner likes (measured / read): taste to take into account and improve on, never a template
   *  (owner's call, 3 Oct 2026: the reference is a hint to the designer, the designer decides). */
  liked?: { url: string; colors?: string[]; fonts?: string[]; dark?: boolean; heroImage?: boolean; sections?: string[] } | null;
};

const PRINCIPLES = `Design principles you follow (current, 2026):
- One strong accent colour on calm neutrals; generous white space; large, confident headlines; short lines.
- The hero shows the business itself: a real photo when there is one, the product when it sells things, the person when customers come for the person.
- Serif (elegant / luxury / editorial) for premium, heritage, clinics and learning; rounded (friendly) for food, families, kids, local shops; heavy (bold) for fitness, construction, auto, sales; geometric (tech) for IT and gadgets.
- Light palettes (ivory, pearl) only for premium, calm or editorial brands with good photos; dark, saturated palettes for energy and trust (ocean / teal for health and education, emerald for agriculture and nature, saffron / crimson for temples, food and festivals, gold / noir for jewellery and luxury, steel for builders and law, royal / rose for beauty and fashion).
- Corners: round for friendly and kids, soft for most, sharp for luxury, law, editorial and industrial.
- Order the home page by what a new customer wants first: a shop shows what it sells, a service shows what it does and why, a professional shows who they are, a school shows classes and why parents choose it; reviews near the end, the offer where it helps.
- Never pick a layout the content cannot fill.`;

function menu(): string {
  const pals = SITE_PALETTES.filter((p) => p.key !== "brand").map((p) => `${p.key} (${p.tone}, ${p.mid})`).join(", ");
  const fonts = FONT_PAIRS.filter((f) => f.key !== "look").map((f) => `${f.key} — ${f.blurb}`).join("; ");
  const heroes = HERO_LAYOUTS.map((h) => `${h.key} — ${h.blurb}`).join("; ");
  const radii = RADII.map((r) => r.key).join(", ");
  return `The renderer can draw exactly these (use these words only):
- palette: one of ${pals}; or "brand" with "color": "#rrggbb" when the business has a clear own colour (its logo, its trade's traditional colour).
- font: one of ${fonts}.
- hero: one of ${heroes}.
- radius: one of ${radii}.
- order: the home sections, first to last, from: ${HOME_KINDS.join(", ")} (trust = facts strip; catalog = products / menu / courses; services; whyUs; steps = how it works; about; offer; booking = appointment; photos = work photos; reviews). Leave out any the business has nothing for.
- layouts (optional, each one only when you have a reason): about: photo-left | photo-right | statement (short centred text, no photo) | columns (long editorial text); services: rows (1-3 big rows) | cards (3-6) | list (many, tidy checklist); products: showcase (1-4 premium items, big) | grid | dense (many items, four across); faq: open (few questions, shown open) | accordion; reviews: quote (one big quote) | pair | cards; gallery: mosaic | masonry. The renderer ignores a layout the content cannot carry.`;
}

function briefText(b: DesignBrief): string {
  const { setup, facts, products } = b;
  const cat = categoryOf(setup.category);
  const recipe = recipeFor(setup.category);
  const productPhotos = products.filter((p) => p.images.length || p.photo).length;
  const lines = [
    `Business: ${setup.business || setup.person}${setup.person && setup.person !== setup.business ? ` (owner: ${setup.person})` : ""}`,
    `Trade: ${cat?.en ?? setup.categoryLabel ?? setup.category} — group ${cat?.group ?? "?"}; the card leads with the ${setup.role === "business" ? "business name" : "person"}; their things are called "${recipe.catalog}".`,
    `Where: ${setup.city || "—"}; reach: ${setup.reach}. Website language: ${facts.lang}.`,
    ...tradeAnswerLines(setup.category, facts.tradeAnswers),
    `Has: ${products.length} ${recipe.catalog} (${productPhotos} with photos), ${facts.photos.length} work photos, banner photo: ${facts.bannerUrl ? "yes" : "no"}, logo: ${setup.logo ? "yes" : "no"}, owner portrait: ${setup.photo ? "yes" : "no"}, reviews: ${b.reviews}, timings: ${facts.hours ? "yes" : "no"}, since: ${facts.since || "—"}, experience: ${facts.experience ? `${facts.experience} years` : "—"}, offer: ${facts.offer ? "yes" : "no"}, home service: ${facts.homeService || "—"}.`,
    facts.special.length ? `What makes them special: ${facts.special.join(", ")}` : "",
    facts.customers.length ? `Customers: ${facts.customers.join(", ")}` : "",
    setup.about ? `About (owner's words): ${setup.about.slice(0, 400)}` : "",
    `Default look for this trade (change it only for a reason): ${JSON.stringify(b.defaults)}`,
    b.liked ? `The owner likes this website: ${b.liked.url} — colours ${(b.liked.colors ?? []).slice(0, 3).join(", ") || "?"}; fonts ${(b.liked.fonts ?? []).slice(0, 2).join(", ") || "?"}; ${b.liked.dark ? "dark" : "light"} page; ${b.liked.heroImage ? "a big photo on top" : "no big photo on top"}${b.liked.sections?.length ? `; sections in order: ${b.liked.sections.join(" > ")}` : ""}. Take this as their TASTE (mood, warmth, formality) and pick the nearest good choices from the menu — improve on it, never copy a weak choice.` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** The plan, checked against the menu and the content. */
function clean(raw: unknown, b: DesignBrief): SiteDesignPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const style: SiteStyle = {};
  const palette = typeof o.palette === "string" ? o.palette.trim().toLowerCase() : "";
  const color = typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color.trim()) ? o.color.trim().toLowerCase() : "";
  if (palette === "brand" && color) { style.palette = "brand"; style.color = color; }
  else if (SITE_PALETTES.some((p) => p.key === palette && p.key !== "brand")) style.palette = palette;
  const font = typeof o.font === "string" ? o.font.trim().toLowerCase() : "";
  if (FONT_PAIRS.some((f) => f.key === font && f.key !== "look")) style.font = font;
  // A Hindi website reads best in the Devanagari pair, whatever the designer liked.
  if (b.facts.lang === "hi") style.font = "hindi";
  const hero = typeof o.hero === "string" ? o.hero.trim().toLowerCase() : "";
  const productPhotos = b.products.filter((p) => p.images.length || p.photo).length;
  const heroOk = (h: string): h is HeroLayout =>
    HERO_LAYOUTS.some((x) => x.key === h)
    && !(h === "photo" && !b.facts.bannerUrl)
    && !(h === "grid" && productPhotos < 3)
    && !(h === "person" && !b.setup.photo);
  if (heroOk(hero)) style.hero = hero;
  const radius = typeof o.radius === "string" ? o.radius.trim().toLowerCase() : "";
  if (RADII.some((r) => r.key === radius)) style.radius = radius as SiteStyle["radius"];
  const order = Array.isArray(o.order)
    ? [...new Set(o.order.filter((k): k is HomeKind => typeof k === "string" && (HOME_KINDS as string[]).includes(k)))]
    : [];
  const layouts = cleanLayouts(o.layouts);
  if (layouts) style.layouts = layouts;
  const why = typeof o.why === "string" ? o.why.trim().slice(0, 200) : "";
  if (!Object.keys(style).length && order.length < 3) return null;
  return { style, ...(order.length >= 3 ? { order } : {}), why };
}

/** The designer's plan for this business, or null (AI off, slow, or nothing usable) — the caller then keeps the
 *  trade's default look. Never throws. */
export async function designSite(b: DesignBrief, timeoutMs = 25_000): Promise<SiteDesignPlan | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const system = `You are a senior web designer with 15 years of agency work on small-business websites in India. You design for THIS business from its facts, never from a template. You answer with one JSON object and nothing else.\n\n${PRINCIPLES}`;
  const text = `${briefText(b)}\n\n${menu()}\n\nDecide the design for this business's website. Reply with JSON: {"palette": "...", "color": "#rrggbb or omit", "font": "...", "hero": "...", "radius": "...", "order": ["...", "..."], "layouts": {"about": "...", "services": "...", "products": "...", "faq": "...", "reviews": "...", "gallery": "..."} (only the ones you choose), "why": "one line, at most 25 words"}.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(timeoutMs),
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 600 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    logUsage("site-design", MODEL, j?.usageMetadata);
    const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { text?: unknown; thought?: unknown }[];
    const out = parts.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text as string).join("").trim();
    let v: unknown = null;
    try { v = JSON.parse(out); } catch { const a = out.indexOf("{"), z = out.lastIndexOf("}"); if (a >= 0 && z > a) { try { v = JSON.parse(out.slice(a, z + 1)); } catch { v = null; } } }
    return clean(v, b);
  } catch {
    return null;
  }
}
