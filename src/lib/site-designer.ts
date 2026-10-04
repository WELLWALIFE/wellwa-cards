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
  /** The strongest colour of the owner's logo (#rrggbb): the business's own colour, which the website should wear. */
  logoColor?: string | null;
  /** A real photograph of the trade will stand in as the banner when the owner has none (the build adds it after the
   *  plan), so photo and editorial heroes are open to the designer even then (owner, 4 Oct 2026: "hero banner nahi aa raha"). */
  stockBanner?: boolean;
  /** The look the owner has just seen and asked to change ("Write again"): the plan must differ from it. */
  avoid?: SiteStyle | null;
  /** Which try this is (1 = the first "Write again"), so successive tries rotate through the choices. */
  round?: number;
  /** What the owner asked to change on "Write again": look (colours, type), layout (hero, order), or both when unset. */
  wants?: ("look" | "layout" | "banner" | "photos" | "words" | "pictures")[];
  /** The owner's own words about the change. */
  request?: string;
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
- motion: none (a still page), calm (sections rise in once — the default), lively (floating pictures, a moving photo strip — food, kids, events, fashion).
- pattern (the hero's faint background): none, dots, waves (food, water, calm), grid (tech, industry, construction), diagonal (sales, sports, energy), blobs (kids, beauty, creative), rings (premium, wellness).
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
    `Has: ${products.length} ${recipe.catalog} (${productPhotos} with photos), ${facts.photos.length} work photos, banner photo: ${facts.bannerUrl ? "yes (the owner's own)" : b.stockBanner ? "yes (a real photograph of the trade, provided)" : "no"}, logo: ${setup.logo ? "yes" : "no"}, owner portrait: ${setup.photo ? "yes" : "no"}, reviews: ${b.reviews}, timings: ${facts.hours ? "yes" : "no"}, since: ${facts.since || "—"}, experience: ${facts.experience ? `${facts.experience} years` : "—"}, offer: ${facts.offer ? "yes" : "no"}, home service: ${facts.homeService || "—"}.`,
    facts.special.length ? `What makes them special: ${facts.special.join(", ")}` : "",
    facts.customers.length ? `Customers: ${facts.customers.join(", ")}` : "",
    setup.about ? `About (owner's words): ${setup.about.slice(0, 400)}` : "",
    `Default look for this trade (change it only for a reason): ${JSON.stringify(b.defaults)}`,
    b.avoid ? (() => {
      const w = b.wants?.length ? b.wants : ["look", "layout"];
      const asks = [w.includes("look") ? "a clearly different palette (another tone if you can) and a different font pairing" : "KEEP the palette and the font pairing exactly", w.includes("layout") ? "a different hero and different section layouts and order" : "KEEP the hero, the section layouts and the order"].join("; ");
      return `THE OWNER SAW THIS LOOK AND ASKED FOR A CHANGE: ${JSON.stringify(b.avoid)}. They want: ${asks}.${b.request ? ` In their words: "${b.request}".` : ""} A second designer's take on what they asked, not a touch-up elsewhere. Keep what the business itself demands (its logo colour, Hindi type).`;
    })() : "",
    b.logoColor ? `The owner's LOGO colour is ${b.logoColor}: this is the business's own colour — wear it ("brand" with that color) unless it reads badly on screen, and keep the rest of the palette calm around it.` : "",
    b.liked ? `The owner likes this website: ${b.liked.url} — colours ${(b.liked.colors ?? []).slice(0, 3).join(", ") || "?"}; fonts ${(b.liked.fonts ?? []).slice(0, 2).join(", ") || "?"}; ${b.liked.dark ? "dark" : "light"} page; ${b.liked.heroImage ? "a big photo on top" : "no big photo on top"}${b.liked.sections?.length ? `; sections in order: ${b.liked.sections.join(" > ")}` : ""}. Take this as their TASTE (mood, warmth, formality) and pick the nearest good choices from the menu — improve on it, never copy a weak choice.` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

/** A hero the content can carry. */
function heroAllowed(h: string, b: DesignBrief): h is HeroLayout {
  const productPhotos = b.products.filter((p) => p.images.length || p.photo).length;
  return HERO_LAYOUTS.some((x) => x.key === h)
    && !(h === "photo" && !b.facts.bannerUrl && !b.stockBanner)
    && !(h === "grid" && productPhotos < 3)
    && !(h === "person" && !b.setup.photo)
    && !(h === "editorial" && !b.facts.bannerUrl && !b.stockBanner)
    && !(h === "marquee" && productPhotos + b.facts.photos.length < 4);
}

/** "Write again": whatever the designer said, the look must differ from the one the owner rejected — palette, font
 *  and hero at least (owner's call, 4 Oct 2026). Where the plan repeats the old choice, the next option is taken,
 *  rotating with the round so a third try differs from the second as well. Never throws. */
export function differentFrom(plan: SiteDesignPlan | null, b: DesignBrief): SiteDesignPlan {
  const avoid = b.avoid ?? {};
  const round = Math.max(1, b.round ?? 1);
  const wants = b.wants?.length ? b.wants : ["look", "layout"];
  const wantLook = wants.includes("look"), wantLayout = wants.includes("layout");
  const style: SiteStyle = { ...(plan?.style ?? {}) };
  // What was not asked for stays exactly as it was: the owner changes one thing at a time and sees it change.
  if (!wantLook) { style.palette = avoid.palette ?? style.palette; if (avoid.color) style.color = avoid.color; else delete style.color; style.font = avoid.font ?? style.font; }
  if (!wantLayout) { style.hero = avoid.hero ?? style.hero; style.pattern = avoid.pattern ?? style.pattern; style.radius = avoid.radius ?? style.radius; style.motion = avoid.motion ?? style.motion; if (avoid.layouts) style.layouts = avoid.layouts; }
  const guard = (plan?: SiteDesignPlan | null) => ({ style, ...(wantLayout && plan?.order ? { order: plan.order } : {}), why: plan?.why ? `${plan.why} (as asked)` : "Changed as asked." });
  if (!wantLook && !wantLayout) return guard(plan);
  const pick = <T,>(list: T[], same: (x: T) => boolean, i: number): T | undefined => { const rest = list.filter((x) => !same(x)); return rest.length ? rest[i % rest.length] : undefined; };
  // Palette: the logo's own colour is the business's and stays; otherwise another palette, another tone first.
  const oldPal = avoid.palette ?? b.defaults.palette;
  if (wantLook && !b.logoColor && (!style.palette || style.palette === oldPal)) {
    const oldTone = SITE_PALETTES.find((p) => p.key === oldPal)?.tone;
    const pals = SITE_PALETTES.filter((p) => p.key !== "brand");
    const other = pals.filter((p) => p.tone !== oldTone);
    const np = pick(other.length ? other : pals, (p) => p.key === oldPal, round * 3 + (b.setup.business.length % 5));
    if (np) { style.palette = np.key; delete style.color; }
  }
  // Font: another pairing (Hindi stays Hindi).
  const oldFont = avoid.font ?? b.defaults.font;
  if (wantLook && b.facts.lang !== "hi" && (!style.font || style.font === oldFont)) {
    const nf = pick(FONT_PAIRS.filter((f) => f.key !== "look" && f.key !== "hindi"), (f) => f.key === oldFont, round * 2 + (b.setup.city.length % 3));
    if (nf) style.font = nf.key;
  }
  // Hero: another the content can carry.
  const oldHero = avoid.hero ?? b.defaults.hero;
  if (wantLayout && (!style.hero || style.hero === oldHero)) {
    const nh = pick(HERO_LAYOUTS.filter((h) => heroAllowed(h.key, b)), (h) => h.key === oldHero, round);
    if (nh) style.hero = nh.key;
  }
  // Pattern and corners: a different one when the plan repeats the old.
  const patterns: NonNullable<SiteStyle["pattern"]>[] = ["none", "dots", "waves", "grid", "diagonal", "blobs", "rings"];
  if (wantLayout && avoid.pattern && (!style.pattern || style.pattern === avoid.pattern)) style.pattern = pick(patterns, (x) => x === avoid.pattern, round) ?? style.pattern;
  if (wantLayout && avoid.radius && (!style.radius || style.radius === avoid.radius)) style.radius = pick(RADII.map((r) => r.key), (x) => x === avoid.radius, round) ?? style.radius;
  return guard(plan);
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
  if (heroAllowed(hero, b)) style.hero = hero;
  const radius = typeof o.radius === "string" ? o.radius.trim().toLowerCase() : "";
  if (RADII.some((r) => r.key === radius)) style.radius = radius as SiteStyle["radius"];
  const order = Array.isArray(o.order)
    ? [...new Set(o.order.filter((k): k is HomeKind => typeof k === "string" && (HOME_KINDS as string[]).includes(k)))]
    : [];
  const layouts = cleanLayouts(o.layouts);
  if (layouts) style.layouts = layouts;
  const motion = typeof o.motion === "string" ? o.motion.trim().toLowerCase() : "";
  if ((["none", "calm", "lively"] as string[]).includes(motion)) style.motion = motion as SiteStyle["motion"];
  const pattern = typeof o.pattern === "string" ? o.pattern.trim().toLowerCase() : "";
  if ((["none", "dots", "waves", "grid", "diagonal", "blobs", "rings"] as string[]).includes(pattern)) style.pattern = pattern as SiteStyle["pattern"];
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
  const text = `${briefText(b)}\n\n${menu()}\n\nDecide the design for this business's website. Reply with JSON: {"palette": "...", "color": "#rrggbb or omit", "font": "...", "hero": "...", "radius": "...", "order": ["...", "..."], "pattern": "...", "motion": "...", "layouts": {"about": "...", "services": "...", "products": "...", "faq": "...", "reviews": "...", "gallery": "..."} (only the ones you choose), "why": "one line, at most 25 words"}.`;
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
