// Product poster mode: the member's products (photo + rotating benefit lines).
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService } from "@/lib/poster-server";
import { isOwnMedia } from "@/lib/card-inputs";
const UUID = /^[0-9a-f-]{36}$/i;
const VIEWS = ["in_use", "front", "three_quarter", "back", "output_closeup", "installed", "packaging", "generated", "other"];
/**
 * A photo this owner uploaded to OUR media bucket (isOwnMedia checks the host, not just the path), or an
 * old same-site path. A picture on someone else's website is never saved: the V-Card and the public website
 * show these rows, so it would put another company's image on the card, leak every visitor's IP to that
 * host, and break or change whenever they like.
 */
function ownPhoto(v: unknown, uid: string): string | null {
  if (typeof v !== "string" || !v || v.length >= 500) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v; // a path saved before photos held full URLs
  return isOwnMedia(v, uid) ? v : null;
}
/** ≤6 photos, only files this user uploaded to our media bucket; role is derived from the view (context photos never reach the image model). */
function cleanPhotos(list: unknown[], uid: string) {
  return list.map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => !!x && !!ownPhoto(x.url, uid))
    .slice(0, 6)
    .map((x) => { const view = VIEWS.includes(String(x.view)) ? String(x.view) : "other"; return { url: x.url as string, view, role: view === "installed" || view === "generated" ? "context" : "identity", ...(x.generated_crop ? { generated_crop: true } : {}) }; });
}
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const r = await restAsUser<unknown[]>(me.token, `poster_products?user_id=eq.${me.id}&order=sort,created_at&select=*`);
  const admin = (await restAsService<{ brand_id: string }[]>(`brand_admins?user_id=eq.${me.id}&select=brand_id`)).data?.[0]?.brand_id ?? null;
  return NextResponse.json({ products: r.data ?? [], brand_admin_of: admin });
}
/** A price as the owner typed it, without a leading ₹ / Rs (the card adds ₹): "₹ 900/kg" → "900/kg". */
const money = (v: unknown) => String(v ?? "").trim().replace(/^(?:₹|rs\.?|inr)\s*/i, "").slice(0, 30).trim();

// POST { id?, name, photo_url?, photos?, benefits?, offer?, category?, active?, price?, mrp?, brand?, for_brand? }
// Without id: a new product. With id: ONLY the keys present in the body change, so a partial save (a price from
// the V-Card form, a photo, a toggle) can never wipe benefits, offer, category or the brand link.
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const raw = await request.json().catch(() => ({}));
  const b: Record<string, unknown> = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;
  const id = typeof b.id === "string" && UUID.test(b.id) ? b.id : null;
  const all = !id; // a new product gets every field (with defaults); an update only what was sent

  const row: Record<string, unknown> = all ? { user_id: me.id } : {};
  if (all || has("name")) row.name = String(b.name ?? "").trim().slice(0, 60);
  if (all || has("photo_url")) row.photo_url = ownPhoto(b.photo_url, me.id);
  if (all || has("benefits")) row.benefits = (Array.isArray(b.benefits) ? b.benefits : []).map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean).slice(0, 12);
  if (all || has("offer")) row.offer = String(b.offer ?? "").trim().slice(0, 60);
  if (all || has("category")) row.category = String(b.category ?? "").trim().slice(0, 30);
  if (Array.isArray(b.photos)) row.photos = cleanPhotos(b.photos, me.id);
  if (all || has("active")) row.active = b.active !== false;
  if (has("price")) row.price = money(b.price);
  if (has("mrp")) row.mrp = money(b.mrp);
  if (has("brand")) row.brand = String(b.brand ?? "").trim().slice(0, 40);
  if (all) row.brand_id = null;
  if (has("for_brand")) {
    if (b.for_brand) {
      const admin = (await restAsService<{ brand_id: string }[]>(`brand_admins?user_id=eq.${me.id}&select=brand_id`)).data?.[0]?.brand_id;
      if (!admin) return NextResponse.json({ error: "Not a brand admin" }, { status: 403 });
      row.brand_id = admin;
    } else row.brand_id = null;
  }
  if ("name" in row && !row.name) return NextResponse.json({ error: "Product name required" }, { status: 400 });
  const ph = row.photos as { url: string; view: string }[] | undefined;
  if (ph?.length) row.photo_url = (ph.find((x) => x.view === "front") ?? ph.find((x) => x.view !== "installed" && x.view !== "output_closeup") ?? ph[0]).url.split("?")[0];
  if (!Object.keys(row).length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const path = id ? `poster_products?id=eq.${id}&user_id=eq.${me.id}` : `poster_products`;
  const send = (body: Record<string, unknown>) =>
    restAsUser<unknown[]>(me.token, path, { method: id ? "PATCH" : "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  let r = await send(row);
  // Until migration 0050 has run, PostgREST refuses price/mrp/brand. Save everything else rather than
  // nothing, so the photo, name and benefits are never lost (the same fallback as /api/card/build).
  if (!r.ok && r.status === 400 && /\b(price|mrp|brand)\b/i.test(r.text)) {
    const rest = { ...row };
    delete rest.price; delete rest.mrp; delete rest.brand;
    if (Object.keys(rest).length) r = await send(rest);
  }
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) }, { status: 400 });
  return NextResponse.json({ product: r.data?.[0] ?? null });
}
export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await restAsUser(me.token, `poster_products?id=eq.${id}&user_id=eq.${me.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
