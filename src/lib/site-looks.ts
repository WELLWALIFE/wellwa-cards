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
import { tradeMood } from "@/lib/trade-moods";

export type LookKey = BlueprintKey;
export type Look = { key: LookKey; name: string; hi: string; blurb: string; blurbHi: string; style: SiteStyle; order?: string[]; tiles?: TileKey[] };

/** A plan the designer AI (or the trade's mood brief) made for one blueprint. */
export type LookPlan = { blueprint: BlueprintKey; style: SiteStyle; order?: string[]; tiles?: TileKey[]; why?: string };

const LIGHT = new Set(["ivory", "pearl"]);
const WARM = new Set(["saffron", "gold", "cocoa", "crimson", "rose", "ivory"]);

/** The three, for this card: from the build's plans when it carried them, else derived from the designer's style. */
export function threeLooks(card: Pick<Card, "site"> & Partial<Pick<Card, "seo">>, designer: SiteStyle | undefined, plans?: LookPlan[]): Look[] {
  const d: SiteStyle = { ...(designer ?? card.site?.style ?? {}) };
  const first = d.blueprint ?? "bento";
  const rest = BLUEPRINTS.map((b) => b.key).filter((k) => k !== first);
  const want: BlueprintKey[] = [first, ...rest];
  const byKey = new Map((plans ?? []).map((p) => [p.blueprint, p]));
  const category = card.seo?.categoryKey;
  return want.map((key) => {
    const bp = BLUEPRINTS.find((b) => b.key === key)!;
    const plan = byKey.get(key);
    const style: SiteStyle = plan ? withHeroVariant({ ...plan.style, blueprint: key }, key, category) : derive(d, key, category);
    return { key, name: bp.name, hi: bp.hi, blurb: plan?.why || bp.blurb, blurbHi: plan?.why || bp.blurbHi, style, ...(plan?.order ? { order: plan.order } : {}), ...(plan?.tiles ? { tiles: plan.tiles } : {}) };
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
