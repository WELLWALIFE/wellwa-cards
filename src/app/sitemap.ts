import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getPublicSupabase, fetchCardExpired } from "@/lib/supabase/public";
import { sampleCards } from "@/lib/sample-data";
import { SERVICES } from "@/lib/services";
import { PLATFORM_HOSTS } from "@/lib/site-url";
import { cardUrls, searchListed, type Row } from "@/lib/seo-urls";
import { cities } from "@/lib/directory";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const COLS = "username, pages:data->pages, site:data->site, about:data->about, language:data->language";
/** Super Admin's Pause lives in its own column; the site object carries it the way the public read does. */
const withPaused = (r: Row & { site_paused?: boolean }): Row => (r.site_paused === true && r.site ? { ...r, site: { ...r.site, paused: true } } : r);

// Always generated fresh — a prerendered sitemap would keep advertising cards
// that have since been deleted, and miss ones just published.
export const dynamic = "force-dynamic";

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
      const { data } = await sb.from("cards").select(`${COLS}, site_paused`).eq("username", username).eq("active", true).maybeSingle();
      const row = data ? withPaused(data as Row & { site_paused?: boolean }) : null;
      return row && searchListed(row) && !(await fetchCardExpired(username)) ? cardUrls(`https://${host}`, row) : [];
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
        sb.from("cards").select(`${COLS}, site_paused`).eq("active", true).limit(5000),
        sb.from("card_domains").select("username").eq("verified", true),
      ]);
      // A card on its own domain is listed in that domain's sitemap, not here (its canonical address is there).
      const elsewhere = new Set(((own ?? []) as { username: string }[]).map((r) => r.username));
      // Standard and Premium websites, once live (lib/seo-urls.ts searchListed); owner, 12 Nov 2026.
      rows = ((data ?? []) as (Row & { site_paused?: boolean })[]).map(withPaused).filter((r) => r.username && !elsewhere.has(r.username) && searchListed(r));
      // Google is for subscribed websites only (owner, 14 Oct 2026): a free or lapsed card is noindex, so it is not listed either.
      const keep: Row[] = [];
      for (let i = 0; i < rows.length; i += 40) {
        const part = rows.slice(i, i + 40);
        const gone = await Promise.all(part.map((r) => fetchCardExpired(r.username)));
        part.forEach((r, j) => { if (!gone[j]) keep.push(r); });
      }
      rows = keep;
    } catch { /* ignore */ }
  }
  // Only fall back to samples in demo mode — never list deleted cards.
  if (!rows.length && !sb) rows = sampleCards.map((c) => ({ username: c.username, pages: c.pages }));

  // The city directory: /in, each city, each trade in it.
  const dir: MetadataRoute.Sitemap = [{ url: `${SITE}/in`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.7 }];
  for (const c of await cities().catch(() => [])) {
    // A Hindi city or trade name keeps its Devanagari in the slug: a sitemap <loc> must be a percent-encoded URL.
    dir.push({ url: `${SITE}/in/${encodeURIComponent(c.slug)}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.7 });
    for (const k of c.categories) dir.push({ url: `${SITE}/in/${encodeURIComponent(c.slug)}/${encodeURIComponent(k.slug)}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6 });
  }
  return [...staticPages, ...dir, ...rows.flatMap((r) => cardUrls(`${SITE}/c/${r.username}`, r))];
}
