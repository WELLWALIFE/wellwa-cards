// Every template the server knows: the hand-written built-ins (templates.ts, small, also on the client) plus the five
// generated per trade (template-gen.ts, large, server only — clients read /api/templates). Import this on the server;
// never from a "use client" file.
import { BUILT_IN_TEMPLATES, type CardTemplateDef } from "./templates";
import { allTradeTemplates, type TradeTemplateData } from "./template-gen";
import { makeVariants } from "./template-variants";
import data from "./trade-templates/data.json";

export const TRADE_TEMPLATES: CardTemplateDef[] = allTradeTemplates(data as unknown as TradeTemplateData);
/** The restaurant / salon pilot of 12 Oct 2026 (hand-made; superseded by the generated ones as they land). A pilot variant whose
 *  key a generated template now carries is dropped: `salon-studio-collage` existed twice and findTemplate() served the pilot's,
 *  so the released design could never be opened or applied by its key (15 Oct 2026 sweep). */
const TRADE_KEYS = new Set(TRADE_TEMPLATES.map((t) => t.key));
const PILOT = makeVariants(BUILT_IN_TEMPLATES).filter((t) => !TRADE_KEYS.has(t.key)).map((t) => ({ ...t, draft: true }));
/** A trade with its own five released designs no longer lists the older hand-written template of that trade beside them:
 *  those carry the first design's drawn pictures, and a sixth card of the old look is what made the new ones read as
 *  "the same as before" (owner, 14 Oct 2026). Brand templates and the blank one stay. The old key still works for a
 *  card that already uses it; only the picker's list changes. */
const RELEASED = new Set(TRADE_TEMPLATES.filter((t) => !t.draft).map((t) => t.data.seo?.categoryKey ?? t.key.split("-")[0]));
const BUILT_IN_LISTED = BUILT_IN_TEMPLATES.map((t) => (!t.brand && t.key !== "blank" && RELEASED.has(t.data.seo?.categoryKey ?? t.key.split("-")[0]) ? { ...t, draft: true } : t));
export const ALL_TEMPLATES: CardTemplateDef[] = [...BUILT_IN_LISTED, ...PILOT, ...TRADE_TEMPLATES];
export const findTemplate = (key: string): CardTemplateDef | undefined => ALL_TEMPLATES.find((t) => t.key === key);
/** Trades that have templates, with how many: the review board's index. */
export const TEMPLATE_TRADES: { trade: string; count: number }[] = Object.entries(
  [...PILOT, ...TRADE_TEMPLATES].reduce<Record<string, number>>((m, t) => { const k = t.data.seo?.categoryKey ?? t.key.split("-")[0]; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
).map(([trade, count]) => ({ trade, count })).sort((a, b) => a.trade.localeCompare(b.trade));
