// Three looks for one website (docs/website-looks-v2.md): the same words, pictures and sections on three different
// BLUEPRINTS (site-blueprints.ts) — a tile board, full-screen scenes, swipe slides — never the same page in three
// colours (owner's call, 5 Oct 2026: "look ka matlab design change, colour hi nahi"). The first is the designer's
// pick for this business; the other two are the remaining blueprints with that plan's palette and type, the
// cinematic one always on a dark palette (a full-screen photo needs a dark page under it). Applied on the spot:
// only site.style (+ the board's tiles and the home order) changes, so no build runs and nothing is paid.
//
// Until the designer AI returns three plans of its own (looks v2 step 5), the three are derived here.
// Isomorphic: no 'use client', no 'server-only'.
import type { Card, SiteStyle } from "@/lib/types";
import { BLUEPRINTS, type BlueprintKey, type TileKey } from "@/lib/site-blueprints";
import { HERO_VARIANTS_BY_BP } from "@/lib/site-hero";
import { goodBlueprints, rankBlueprints, tradeMood } from "@/lib/trade-moods";
import { groupOf } from "@/lib/site-advanced-archetypes";
import { paletteFits, tradeColours, type TradeColours } from "@/lib/trade-colours";

export type LookKey = BlueprintKey;
export type Look = { key: LookKey; name: string; hi: string; blurb: string; blurbHi: string; style: SiteStyle; order?: string[]; tiles?: TileKey[] };

/** A plan the designer AI (or the trade's mood brief) made for one blueprint. */
export type LookPlan = { blueprint: BlueprintKey; style: SiteStyle; order?: string[]; tiles?: TileKey[]; why?: string };

const LIGHT = new Set(["ivory", "pearl"]);
const WARM = new Set(["saffron", "gold", "cocoa", "crimson", "rose", "ivory"]);

/** Does the website's own style wear a colour of its trade (trade-colours.ts)? The business's own colour ("brand") always does. */
export function styleFitsTrade(card: Pick<Card, "site"> & Partial<Pick<Card, "seo">>): boolean {
  const pal = card.site?.style?.palette;
  return pal === "brand" || paletteFits(tradeColours(card.seo?.categoryKey, groupOf(card.seo?.categoryKey)), pal);
}

/** The three, for this card: from the build's plans when it carried them, else derived from the designer's style. */
export function threeLooks(card: Pick<Card, "site"> & Partial<Pick<Card, "seo">>, designer: SiteStyle | undefined, plans?: LookPlan[]): Look[] {
  const d: SiteStyle = { ...(designer ?? card.site?.style ?? {}) };
  // The trade's own colours (trade-colours.ts): a website made in another trade's palette (cream and brown on a cleaning company) is
  // shown in the trade's first; the business's own colour ("brand") stays.
  const tc = tradeColours(card.seo?.categoryKey, groupOf(card.seo?.categoryKey));
  if (d.palette !== "brand" && !paletteFits(tc, d.palette)) { d.palette = tc.palettes[0]; delete d.color; }
  // The "Colour poster" is the first look and the one a new website opens on (owner, 14 Oct 2026); the designer's own pick follows it.
  const category = card.seo?.categoryKey;
  // After the poster and the designer's pick, the rest in the order they suit THIS trade (trade-moods.ts rankBlueprints) — a wholesaler's
  // next looks are the order shop and the big name, a clinic's the photo collage and the board; they used to follow the list's own order (16 Oct 2026).
  const designerPick = d.blueprint ?? rankBlueprints(category).find((k) => k !== "story") ?? "bento";
  const want: BlueprintKey[] = ["story", ...[designerPick, ...rankBlueprints(category)].filter((k, i, a) => k !== "story" && a.indexOf(k) === i)];
  const byKey = new Map((plans ?? []).map((p) => [p.blueprint, p]));
  return dressApart(tc, want.map((key) => {
    const bp = BLUEPRINTS.find((b) => b.key === key)!;
    const plan = byKey.get(key);
    // A plan from the designer AI carries its own few choices; the look's section layouts (the blueprint's defaults) fill
    // every key it left out, so six looks are six compositions and not six hero shapes over one page (live check, 13 Oct 2026).
    const style: SiteStyle = plan ? withHeroVariant({ ...plan.style, blueprint: key, layouts: { ...(bp.defaults.layouts ?? {}), ...(plan.style.layouts ?? {}) } }, key, category) : derive(d, key, category);
    // The plan's tile list may omit the photo (a board with no picture on a business that has one): the photo tile leads.
    const tiles = plan?.tiles ? (plan.tiles.includes("photo") ? plan.tiles : (["photo", ...plan.tiles] as typeof plan.tiles)) : undefined;
    return { key, name: bp.name, hi: bp.hi, blurb: bp.blurb, blurbHi: bp.blurbHi, style, ...(plan?.order ? { order: plan.order } : {}), ...(tiles ? { tiles } : {}) };
  }));
}

/** Six looks must look like six (owner, 16 Nov 2026: "12 design hai lekin sab same se lag rahe hai"): the first look keeps the website's
 *  own colours and type; every other look wears a palette and a font set of its own, so the difference shows at a glance — classic
 *  cream, green, bold red, ocean, plum and sage; the full-photo (cinematic) look is the dark one (black and gold, dark page). A Hindi website keeps its
 *  Hindi fonts on every look. */
const VARIETY_FONTS = ["elegant", "honest", "bold", "tech", "luxury", "editorial", "warm"];
function dressApart(tc: TradeColours, looks: Look[]): Look[] {
  if (looks.length < 2) return looks;
  const first = looks[0].style;
  const hindi = first.font === "hindi";
  // Only the trade's own palettes (17 Nov 2026: a cleaning company's looks came in crimson, plum and saffron).
  const variety = tc.palettes.map((palette, i) => ({ palette, font: VARIETY_FONTS[i % VARIETY_FONTS.length] }));
  const festive = tc.palettes.includes("saffron") ? "saffron" : null;
  // A trade that is never dark (cleaning, clinics, schools) has no black look at all: its full-photo look wears a colour of the family.
  const pool = variety.filter((v) => v.palette !== first.palette && v.palette !== festive && !(tc.lightOnly && v.palette === tc.dark));
  return looks.map((l, i) => {
    if (i === 0 || !pool.length) return l;
    const { color: _c, ...rest } = l.style; void _c;
    // The pages are paper under every other blueprint, so a dark palette would only darken the text there: the dark one is the cinematic look's.
    if (l.key === "cinematic" && !tc.lightOnly && first.palette !== tc.dark) return { ...l, style: { ...rest, palette: tc.dark, font: hindi ? "hindi" : "luxury", body: "dark" } };
    // The festive, local one (owner's list, 16 Nov 2026), for the trades saffron belongs to: saffron and a rangoli-like ring pattern.
    if (l.key === "collage" && festive && first.palette !== festive) return { ...l, style: { ...rest, palette: festive, font: hindi ? "hindi" : "honest", pattern: "rings" } };
    // The full-photo look needs a colour that carries white type: never the paper-white palettes.
    const at = l.key === "cinematic" ? pool.findIndex((v) => !LIGHT.has(v.palette)) : 0;
    const pick = (at >= 0 ? pool.splice(at, 1)[0] : pool.shift()) ?? variety[i % variety.length];
    const font = pick.font === first.font ? VARIETY_FONTS[(i + 3) % VARIETY_FONTS.length] : pick.font;
    return { ...l, style: { ...rest, palette: pick.palette, font: hindi ? "hindi" : font } };
  });
}

/** The designer's plan carried onto another blueprint: its palette and type, the blueprint's own structure and the
 *  hero variant the trade's mood brief wants for it (docs/premium-look.md §3.7) — a variant of another blueprint
 *  (`cover` on a bento board) never travels. */
function derive(d: SiteStyle, key: BlueprintKey, category?: string): SiteStyle {
  const bp = BLUEPRINTS.find((b) => b.key === key)!;
  const { hero: _h, layouts: _l, heroVariant: _v, ...paint } = d; void _h; void _l; void _v;
  const s: SiteStyle = { ...paint, ...bp.defaults, blueprint: key };
  if (key === "cinematic" && (LIGHT.has(d.palette ?? "") || !d.palette)) s.palette = WARM.has(d.palette ?? "") ? "cocoa" : "midnight";
  if (key === "cinematic") { delete s.color; if (d.palette === "brand" && d.color) { s.palette = "brand"; s.color = d.color; } }
  return withHeroVariant(s, key, category);
}

/** The style with a hero variant of ITS blueprint: the AI's when it named one that fits, else the trade's. */
export function withHeroVariant(s: SiteStyle, key: BlueprintKey, category?: string): SiteStyle {
  const fits = s.heroVariant && HERO_VARIANTS_BY_BP[key].includes(s.heroVariant);
  return fits ? s : { ...s, heroVariant: tradeMood(category).heroVariant[key] };
}

/** The card wearing this look: the website's style (and, for a plan, its tiles and section order) changes; words,
 *  pictures and pages stay. */
export function applyLook<T extends Pick<Card, "site">>(card: T, look: Look): T {
  if (!card.site) return card;
  const hero = card.site.hero ? { ...card.site.hero, ...(look.tiles ? { tiles: look.tiles } : {}) } : card.site.hero;
  const home = look.order ? { ...(card.site.home ?? {}), order: look.order } : card.site.home;
  return { ...card, site: { ...card.site, style: { ...look.style }, ...(hero ? { hero } : {}), ...(home ? { home } : {}) } };
}

/** The looks worth putting a customer on without asking (the WhatsApp onboarding picks one by their number): the trade's own three blueprints,
 *  and the designer's pick; never "any of six" — a lawyer on the Order shop, a wholesaler on the Photo collage. */
export function fitLooks(looks: Look[], category: string | undefined): Look[] {
  const good = new Set<string>(goodBlueprints(category));
  const fit = looks.filter((l, i) => good.has(l.key) || i === 1);
  return fit.length ? fit : looks;
}

/** The look a NEW website opens on. The Colour poster is the owner's choice for a first build (14 Oct 2026) and stays so for every trade a poster
 *  suits — it is one of the trade's two best blueprints; for a trade it does not (a wholesaler's catalogue, a clinic's quick actions, a lawyer's
 *  name), the trade's own first blueprint opens instead (16 Oct 2026). Never applied to a rewrite: that keeps the look it was asked for. */
export function openingLook(looks: Look[], category: string | undefined): Look | undefined {
  const [first, second] = goodBlueprints(category);
  const story = looks.find((l) => l.key === "story");
  if (story && (first === "story" || second === "story")) return story;
  return looks.find((l) => l.key === first) ?? story ?? looks[0];
}
