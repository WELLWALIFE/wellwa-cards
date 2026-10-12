// Every template the server knows: the hand-written built-ins (templates.ts, small, also on the client) plus the five
// generated per trade (template-gen.ts, large, server only — clients read /api/templates). Import this on the server;
// never from a "use client" file.
import { BUILT_IN_TEMPLATES, type CardTemplateDef } from "./templates";
import { allTradeTemplates, type TradeTemplateData } from "./template-gen";
import { makeVariants } from "./template-variants";
import data from "./trade-templates/data.json";

export const TRADE_TEMPLATES: CardTemplateDef[] = allTradeTemplates(data as unknown as TradeTemplateData);
/** The restaurant / salon pilot of 12 Oct 2026 (hand-made; superseded by the generated ones as they land). */
const PILOT = makeVariants(BUILT_IN_TEMPLATES).map((t) => ({ ...t, draft: true }));
export const ALL_TEMPLATES: CardTemplateDef[] = [...BUILT_IN_TEMPLATES, ...PILOT, ...TRADE_TEMPLATES];
export const findTemplate = (key: string): CardTemplateDef | undefined => ALL_TEMPLATES.find((t) => t.key === key);
/** Trades that have templates, with how many: the review board's index. */
export const TEMPLATE_TRADES: { trade: string; count: number }[] = Object.entries(
  [...PILOT, ...TRADE_TEMPLATES].reduce<Record<string, number>>((m, t) => { const k = t.data.seo?.categoryKey ?? t.key.split("-")[0]; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
).map(([trade, count]) => ({ trade, count })).sort((a, b) => a.trade.localeCompare(b.trade));
