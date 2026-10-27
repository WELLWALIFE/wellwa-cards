// GET → every logo this owner already has in the app, so a reel (or anything else) picks one instead of asking
// for a new upload (owner, 27 Oct 2026: "logo agar app me hai to waha se lena chahieye").
// Sources: each poster profile's logo, each card's website logo, the brand's logo (a distributor's products),
// and the logo kits made in Brand kit. Deduplicated, newest kit files last.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { myCards } from "@/lib/site-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

type Logo = { url: string; label: string; from: "profile" | "website" | "brand" | "kit" };
const ok = (u: unknown): u is string => typeof u === "string" && /^https:\/\/.{8,500}$/.test(u);

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [profiles, cards, products, kit] = await Promise.all([
    restAsService<{ name: string; logo_url: string | null; is_default: boolean }[]>(`poster_profiles?user_id=eq.${me.id}&order=is_default.desc,created_at&select=name,logo_url,is_default`).then((r) => r.data ?? []),
    myCards(me.id).catch(() => []),
    restAsService<{ brand_id: string | null }[]>(`poster_products?user_id=eq.${me.id}&brand_id=not.is.null&select=brand_id&limit=50`).then((r) => r.data ?? []),
    fetch(`${SUPA_URL}/storage/v1/object/list/media`, { method: "POST", headers: { ...serviceHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ prefix: `poster/${me.id}/logo`, limit: 12, sortBy: { column: "created_at", order: "desc" } }) })
      .then(async (r) => (r.ok ? ((await r.json()) as { name: string }[]) : [])).catch(() => []),
  ]);
  const out: Logo[] = [];
  const add = (url: unknown, label: string, from: Logo["from"]) => { if (ok(url) && !out.some((x) => x.url.split("?")[0] === url.split("?")[0])) out.push({ url, label, from }); };
  for (const p of profiles) add(p.logo_url, p.name, "profile");
  for (const c of cards) add((c.data as { site?: { logoUrl?: string } })?.site?.logoUrl, "Website", "website");
  const brandIds = [...new Set(products.map((p) => p.brand_id).filter(Boolean))].slice(0, 10);
  if (brandIds.length) {
    const brands = (await restAsService<{ name: string; logo_url: string | null }[]>(`brands?id=in.(${brandIds.join(",")})&select=name,logo_url`)).data ?? [];
    for (const b of brands) add(b.logo_url, b.name, "brand");
  }
  for (const f of kit) if (/^stacked-.*\.png$/i.test(f.name)) add(`${SUPA_URL}/storage/v1/object/public/media/poster/${me.id}/logo/${f.name}`, "Brand kit", "kit");
  return NextResponse.json({ logos: out.slice(0, 12) });
}
