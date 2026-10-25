// The small shape of a template for the public pages (gallery, home): no sample content, so the page stays light
// (owner, 25 Oct 2026: show the templates of every trade on the main site).
import type { CardTemplateDef } from "./templates";

export type TemplateLite = { key: string; name: string; /** The line of work ("Salon / beauty"). */ trade: string; /** Its family ("Services"). */ group: string; category: string; description: string; emoji: string; accent: string; cover: string; pages: number; blocks: number };

export const toLite = (t: CardTemplateDef): TemplateLite => ({
  key: t.key, name: t.name, category: t.category, trade: t.name.split(" — ")[0].trim(), group: t.category.split(" · ")[0].trim(), description: t.description, emoji: t.emoji,
  accent: t.data?.themeColor ?? "#0e9e90", cover: t.data?.coverUrl ?? "",
  pages: t.data?.pages?.length ?? 0,
  blocks: (t.data?.pages ?? []).reduce((n, p) => n + p.blocks.length, 0),
});

/** Lines of work (or families) with how many designs each has, biggest first. */
export const countBy = (list: TemplateLite[], by: "trade" | "group"): { name: string; count: number }[] =>
  Object.entries(list.reduce<Record<string, number>>((m, t) => { m[t[by]] = (m[t[by]] ?? 0) + 1; return m; }, {}))
    .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
