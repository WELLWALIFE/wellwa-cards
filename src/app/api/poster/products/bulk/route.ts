// Saves the items the owner kept from "Add many at once" as products, in one go. Items already on the list (same name) are skipped.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";

const S = (v: unknown, n: number) => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, n);
const money = (v: unknown) => S(v, 30).replace(/^(?:₹|rs\.?|inr)\s*/i, "").trim();

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
    rows.push({ user_id: me.id, name, photo_url: null, benefits: [], offer: "", category: S(o.category, 30), active: true, brand_id: null, ...(money(o.price) ? { price: money(o.price) } : {}) });
  }
  if (!rows.length) return NextResponse.json({ added: 0, skipped: true });
  let r = await restAsUser<unknown[]>(me.token, "poster_products", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows) });
  // Before migration 0050 the price column does not exist: save the names rather than nothing.
  if (!r.ok && r.status === 400 && /\bprice\b/i.test(r.text)) r = await restAsUser<unknown[]>(me.token, "poster_products", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows.map(({ price: _p, ...rest }) => (void _p, rest))) });
  if (!r.ok) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 400 });
  return NextResponse.json({ added: rows.length });
}
