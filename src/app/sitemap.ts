import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getPublicSupabase } from "@/lib/supabase/public";
import { sampleCards } from "@/lib/sample-data";
import { SERVICES } from "@/lib/services";
import { PLATFORM_HOSTS } from "@/lib/site-url";
import { cardProducts } from "@/lib/product-page";
import type { Card, CardPage } from "@/lib/types";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// Always generated fresh — a prerendered sitemap would keep advertising cards
// that have since been deleted, and miss ones just published.
export const dynamic = "force-dynamic";

type Row = { username: string; pages: CardPage[] | null };

/** Every page of a card that has something on it: home first, then /<slug>, then each product at its own
 *  address (/p-kaju-katli) — Google indexes a product only when the sitemap lists it. */
function cardUrls(home: string, r: Row): MetadataRoute.Sitemap {
  const pages = (r.pages ?? []).filter((p, i) => i === 0 || (p.blocks ?? []).length > 0);
  const lastModified = new Date();
  const products = cardProducts({ username: r.username, pages } as Card).filter((p) => p.item.name?.trim());
  return [
    ...pages.map((p, i) => ({
      url: i === 0 ? home : `${home}/${encodeURIComponent(p.slug)}`,
      lastModified, changeFrequency: "weekly" as const, priority: i === 0 ? 0.9 : 0.7,
    })),
    ...products.map((p) => ({ url: `${home}/${encodeURIComponent(p.slug)}`, lastModified, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}

/** Automatic sitemap, per host: on Shubhora the marketing pages and every published card (all its pages); on an
 *  owner's own domain only that card's pages at that domain. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];
  const sb = getPublicSupabase();

  if (host && !PLATFORM_HOSTS.has(host) && !host.startsWith("localhost") && sb) {
    try {
      const { data: d } = await sb.from("card_domains").select("username").eq("domain", host).eq("verified", true).maybeSingle();
      let username = (d as { username?: string } | null)?.username ?? null;
      if (!username) {
        const { data: b } = await sb.rpc("resolve_brand_host", { p_host: host });
        username = (Array.isArray(b) ? b[0] : b)?.username ?? null;
      }
      if (!username) return [];
      const { data } = await sb.from("cards").select("username, pages:data->pages").eq("username", username).eq("active", true).maybeSingle();
      return data ? cardUrls(`https://${host}`, data as Row) : [];
    } catch { return []; }
  }

  const staticPages = [
    "", "/solutions", "/work", "/features", "/pricing", "/about", "/contact", "/templates", "/privacy", "/terms", "/refund", "/shipping", "/grievance", "/disclaimer", "/company",
    ...SERVICES.map((s) => `/solutions/${s.slug}`),
  ].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : p.startsWith("/solutions/") ? 0.8 : 0.7,
  }));

  let rows: Row[] = [];
  if (sb) {
    try {
      const [{ data }, { data: own }] = await Promise.all([
        sb.from("cards").select("username, pages:data->pages").eq("active", true).limit(5000),
        sb.from("card_domains").select("username").eq("verified", true),
      ]);
      // A card on its own domain is listed in that domain's sitemap, not here (its canonical address is there).
      const elsewhere = new Set(((own ?? []) as { username: string }[]).map((r) => r.username));
      rows = ((data ?? []) as Row[]).filter((r) => r.username && !elsewhere.has(r.username));
    } catch { /* ignore */ }
  }
  // Only fall back to samples in demo mode — never list deleted cards.
  if (!rows.length && !sb) rows = sampleCards.map((c) => ({ username: c.username, pages: c.pages }));

  return [...staticPages, ...rows.flatMap((r) => cardUrls(`${SITE}/c/${r.username}`, r))];
}
