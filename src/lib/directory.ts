// The city directory (phase 2, owner's call 8 Oct 2026): every live card, found by city and trade at /in/<city> and
// /in/<city>/<trade> — new customers for the owners, and a Google landing for "<trade> in <city>". Read from the public
// cards (what the card itself publishes: name, tagline, trade and city), nothing private.
import { cache } from "react";
import { getPublicSupabase } from "@/lib/supabase/public";
import { categoryOf } from "@/lib/poster-categories";

export type DirCard = { username: string; name: string; company: string; tagline: string; avatarUrl: string; coverUrl: string; theme: string; city: string; citySlug: string; category: string; categoryKey: string; categorySlug: string; hindi: boolean };
export type CityEntry = { slug: string; name: string; count: number; categories: { slug: string; name: string; hi: string; count: number }[] };

export const slugOf = (s: string) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ऀ-ॿ]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

type Row = { username: string; name: string | null; company: string | null; tagline: string | null; avatar_url: string | null; cover_url: string | null; theme_color: string | null; seo: { city?: string; category?: string; categoryKey?: string } | null; language: string | null };

/** Every live card that names a city. Cached per request; the pages revalidate on their own schedule. */
export const directoryCards = cache(async (): Promise<DirCard[]> => {
  const sb = getPublicSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb.from("cards").select("username, name, company, tagline, avatar_url, cover_url, theme_color, seo:data->seo, language:data->language").eq("active", true).limit(5000);
    const out: DirCard[] = [];
    for (const r of (data ?? []) as Row[]) {
      const city = String(r.seo?.city ?? "").trim();
      if (!city || !r.username) continue;
      const key = String(r.seo?.categoryKey ?? "");
      const cat = key ? categoryOf(key) : null;
      const category = String(r.seo?.category ?? cat?.en ?? "Business").trim();
      out.push({
        username: r.username, name: r.name ?? "", company: r.company ?? "", tagline: r.tagline ?? "", avatarUrl: r.avatar_url ?? "", coverUrl: r.cover_url ?? "", theme: r.theme_color ?? "#6d28d9",
        city: titleCase(city.toLowerCase()), citySlug: slugOf(city), category, categoryKey: key, categorySlug: slugOf(cat?.en ?? category) || "business", hindi: r.language === "hi",
      });
    }
    return out.sort((a, b) => a.company.localeCompare(b.company));
  } catch { return []; }
});

/** Cities with cards, biggest first, each with its trades. */
export async function cities(): Promise<CityEntry[]> {
  const all = await directoryCards();
  const map = new Map<string, CityEntry>();
  for (const c of all) {
    const e = map.get(c.citySlug) ?? { slug: c.citySlug, name: c.city, count: 0, categories: [] };
    e.count++;
    const cat = e.categories.find((x) => x.slug === c.categorySlug);
    if (cat) cat.count++; else e.categories.push({ slug: c.categorySlug, name: c.category, hi: categoryOf(c.categoryKey)?.hi ?? c.category, count: 1 });
    map.set(c.citySlug, e);
  }
  return [...map.values()].map((e) => ({ ...e, categories: e.categories.sort((a, b) => b.count - a.count) })).sort((a, b) => b.count - a.count);
}
export async function cityBySlug(slug: string): Promise<CityEntry | null> { return (await cities()).find((c) => c.slug === slug) ?? null; }
export async function cardsIn(citySlug: string, categorySlug?: string): Promise<DirCard[]> {
  return (await directoryCards()).filter((c) => c.citySlug === citySlug && (!categorySlug || c.categorySlug === categorySlug));
}
