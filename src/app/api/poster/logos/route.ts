// GET → every logo this owner already has in the app, so a reel (or anything else) picks one instead of asking
// for a new upload (owner, 27 Oct 2026: "logo agar app me hai to waha se lena chahieye").
// Sources: each poster profile's logo, each card's website logo, the brand's logo (a distributor's products),
// and the logo kits made in Brand kit. Deduplicated, newest kit files last.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { myCards } from "@/lib/site-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import sharp from "sharp";

/** A "logo" that is only one filled block (27 Oct 2026: a profile logo saved as a plain black strip) is not offered:
 *  its visible pixels are one colour AND fill their own bounding box. A one-colour wordmark does not fill its box. */
async function isBlock(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) }); if (!r.ok) return true;
    const { data, info } = await sharp(Buffer.from(await r.arrayBuffer())).resize(80, 80, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, sr = 0, sr2 = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4; if (data[i + 3] < 40) continue;
      const v = data[i] + data[i + 1] + data[i + 2]; if (v > 735) continue; // white background counts as empty
      n++; sr += v; sr2 += v * v; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    if (n < 20) return true; // empty
    const sd = Math.sqrt(Math.max(0, sr2 / n - (sr / n) ** 2)); const fill = n / ((maxX - minX + 1) * (maxY - minY + 1));
    return sd < 6 && fill > 0.93;
  } catch { return false; }
}

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
  // The website's logo first: it is the one the owner set most recently and sees every day.
  for (const c of cards) add((c.data as { site?: { logoUrl?: string } })?.site?.logoUrl, "Website", "website");
  for (const p of profiles) add(p.logo_url, p.name, "profile");
  const brandIds = [...new Set(products.map((p) => p.brand_id).filter(Boolean))].slice(0, 10);
  if (brandIds.length) {
    const brands = (await restAsService<{ name: string; logo_url: string | null }[]>(`brands?id=in.(${brandIds.join(",")})&select=name,logo_url`)).data ?? [];
    for (const b of brands) add(b.logo_url, b.name, "brand");
  }
  for (const f of kit) if (/^stacked-.*\.png$/i.test(f.name)) add(`${SUPA_URL}/storage/v1/object/public/media/poster/${me.id}/logo/${f.name}`, "Brand kit", "kit");
  const list = out.slice(0, 10);
  const bad = await Promise.all(list.map((l) => isBlock(l.url)));
  return NextResponse.json({ logos: list.filter((_, i) => !bad[i]) });
}
