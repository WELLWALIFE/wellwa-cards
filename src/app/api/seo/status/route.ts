// GET (bearer) → the owner's Google SEO checklist. Search is for the Standard and the Premium website once live (owner, 12 Nov 2026; lib/seo-urls.ts
// searchListed): anyone else gets { premium: false } ("premium" = listed on Google; the name is kept for the page).
import { NextResponse } from "next/server";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { isPremiumRow, searchListed, type Row } from "@/lib/seo-urls";
import { cardProducts } from "@/lib/product-page";
import { advancedItems, withAdvancedPages } from "@/lib/site-advanced";
import { SITE_URL } from "@/lib/site-url";
import type { Card } from "@/lib/types";

type Data = { pages?: Row["pages"]; site?: Row["site"]; about?: string; language?: string; seo?: { city?: string; category?: string; areas?: string[]; googleVerify?: string } };
export type SeoItem = { key: string; ok: boolean; optional?: boolean; en: string; hi: string; href: string };

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsService<{ username: string; site_paused?: boolean; data: Data }[]>(`cards?owner_id=eq.${me.id}&select=username,site_paused,data&order=created_at.asc&limit=10`);
  const rows = (r.data ?? []).map((c) => ({ c, row: { username: c.username, pages: c.data?.pages ?? null, site: c.data?.site ? { ...c.data.site, ...(c.site_paused === true ? { paused: true } : {}) } : null, about: c.data?.about ?? null, language: c.data?.language ?? null } as Row }));
  const mine = rows.find((x) => isPremiumRow(x.row) && searchListed(x.row)) ?? rows.find((x) => searchListed(x.row));
  if (!mine) return NextResponse.json({ premium: false });
  const st = await restAsService<{ expired?: boolean }[] | { expired?: boolean }>("rpc/card_owner_state", { method: "POST", body: JSON.stringify({ p_username: mine.c.username }) }).catch(() => null);
  const own = Array.isArray(st?.data) ? st?.data[0] : st?.data;
  if (own?.expired === true) return NextResponse.json({ premium: false });
  const isPremium = isPremiumRow(mine.row);
  const d = mine.c.data, seo = d.seo ?? {};
  const domains = await restAsService<{ domain: string }[]>(`card_domains?username=eq.${encodeURIComponent(mine.c.username)}&verified=eq.true&select=domain&limit=1`);
  const domain = domains.data?.[0]?.domain ?? "";
  const full = withAdvancedPages({ username: mine.c.username, pages: d.pages ?? [], site: d.site, about: d.about ?? "", language: d.language ?? "en" } as Card);
  const count = new Set([...cardProducts(full).map((p) => p.slug), ...advancedItems(full).map((i) => i.slug)]).size;
  const edit = "/poster/website/edit";
  const items: SeoItem[] = [
    { key: "live", ok: true, en: isPremium ? "Your Premium website is live" : "Your website is live", hi: isPremium ? "आपकी Premium website live है" : "आपकी website live है", href: isPremium ? "/poster/site/advanced" : "/poster/site" },
    { key: "city", ok: !!(seo.city ?? "").trim(), en: "Your city is filled in", hi: "आपका शहर भरा है", href: edit },
    { key: "type", ok: !!(seo.category ?? "").trim(), en: "Your type of business is filled in", hi: "आपका काम (business type) भरा है", href: edit },
    { key: "areas", ok: (seo.areas ?? []).filter(Boolean).length > 0, en: "The areas you serve are filled in", hi: "जिन इलाक़ों में सेवा देते हैं वो भरे हैं", href: edit },
    { key: "items", ok: count >= 3, en: "At least 3 products or services are listed", hi: "कम से कम 3 products या services जुड़े हैं", href: "/poster/products" },
    { key: "about", ok: (d.about ?? "").trim().length >= 80, en: "The About text is written (a few lines)", hi: "About का text लिखा है (कुछ लाइनें)", href: edit },
    { key: "domain", ok: !!domain, optional: true, en: "Your own domain is connected", hi: "आपका अपना domain जुड़ा है", href: "/poster/site/link" },
    { key: "gsc", ok: !!(seo.googleVerify ?? "").trim(), optional: true, en: "Google Search Console tag is added", hi: "Google Search Console का tag जुड़ा है", href: edit },
  ];
  const home = domain ? `https://${domain}` : `${SITE_URL}/c/${mine.c.username}`;
  return NextResponse.json({ premium: true, username: mine.c.username, sitemap: `${domain ? `https://${domain}` : SITE_URL}/sitemap.xml`, home, items });
}
