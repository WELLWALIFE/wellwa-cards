// Saves the items the owner kept from "Add many at once" as products, in one go. Items already on the list (same name) are skipped.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { stockPhotoForProduct } from "@/lib/media/product-stock";

export const maxDuration = 120;

const S = (v: unknown, n: number) => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, n);
const money = (v: unknown) => S(v, 30).replace(/^(?:₹|rs\.?|inr)\s*/i, "").trim();

/** The owner's trade, as the stock search should hear it ("Hardware / paint / sanitary"). */
async function tradeOf(token: string, uid: string): Promise<{ key: string; label: string }> {
  const prof = (await restAsUser<{ category: string | null; tagline: string | null }[]>(token, `poster_profiles?user_id=eq.${uid}&select=category,tagline&order=is_default.desc&limit=1`).catch(() => ({ data: null }))).data?.[0];
  return { key: prof?.category ?? "", label: prof?.tagline ?? "" };
}
/** Runs `fn` over the items, `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } }));
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`product-bulk:${me.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: "Too many tries in an hour. Please wait a little." }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { items?: unknown };
  const have = await restAsUser<{ name: string }[]>(me.token, `poster_products?user_id=eq.${me.id}&select=name`);
  const names = new Set((have.data ?? []).map((p) => (p.name ?? "").trim().toLowerCase()));
  const rows: Record<string, unknown>[] = [];
  for (const x of (Array.isArray(b.items) ? b.items : []).slice(0, 40)) {
    const o = (x ?? {}) as Record<string, unknown>;
    const name = S(o.name, 60);
    if (!name || names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    rows.push({ user_id: me.id, name, photo_url: null, benefits: [], offer: "", category: S(o.category, 30), active: true, brand_id: null, price: money(o.price) });   // every row carries the same keys (a batch insert needs that)
  }
  if (!rows.length) return NextResponse.json({ added: 0, skipped: true });
  // Each product gets a clean, recent photo that matches its NAME (owner, 14 Oct 2026); the ones nothing fits for get a photo of the
  // trade instead. Bounded: whatever is not found within the time falls back, so the list is never held up for long.
  const trade = await tradeOf(me.token, me.id);
  const deadline = Date.now() + 95_000;
  await pool(rows, 5, async (r) => {
    r.photo_url = Date.now() < deadline ? await stockPhotoForProduct(me.id, String(r.name), trade.label || trade.key) : null;
  });
  // A product with no clearly matching picture stays without one (a wrong picture is worse); "Find a picture" tries again.
  rows.forEach((r) => { if (!r.photo_url) r.photo_url = null; });
  let r = await restAsUser<unknown[]>(me.token, "poster_products", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows) });
  // Before migration 0050 the price column does not exist: save the names rather than nothing.
  if (!r.ok && r.status === 400 && /\bprice\b/i.test(r.text)) r = await restAsUser<unknown[]>(me.token, "poster_products", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows.map(({ price: _p, ...rest }) => (void _p, rest))) });
  if (!r.ok) { console.log("[bulk] failed", r.status, r.text.slice(0, 300)); return NextResponse.json({ error: "Could not save. Please try again." }, { status: 400 }); }
  return NextResponse.json({ added: rows.length });
}
