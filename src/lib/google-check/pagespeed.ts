import "server-only";
// Google PageSpeed Insights (free) for the Google Health Check: how the business's website does on a phone.
// PAGESPEED_KEY is optional (a key only raises the free quota).
export type SiteCheck = { performance: number; seo: number; title: boolean; description: boolean; https: boolean; checked: boolean };
export const NO_SITE: SiteCheck = { performance: 0, seo: 0, title: false, description: false, https: false, checked: false };

export async function siteCheck(url: string): Promise<SiteCheck> {
  if (!/^https?:\/\//i.test(url)) return NO_SITE;
  const q = new URLSearchParams({ url, strategy: "mobile" }); q.append("category", "performance"); q.append("category", "seo");
  const key = (process.env.PAGESPEED_KEY ?? "").trim(); if (key) q.set("key", key);
  const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!r.ok) return NO_SITE;
  const j = (await r.json()) as { lighthouseResult?: { categories?: Record<string, { score?: number }>; audits?: Record<string, { score?: number | null }> } };
  const cat = j.lighthouseResult?.categories ?? {}; const a = j.lighthouseResult?.audits ?? {};
  const pct = (s?: number) => Math.round((s ?? 0) * 100);
  return {
    performance: pct(cat.performance?.score), seo: pct(cat.seo?.score),
    title: a["document-title"]?.score === 1, description: a["meta-description"]?.score === 1,
    https: a["is-on-https"]?.score === 1 || url.startsWith("https://"), checked: true,
  };
}
