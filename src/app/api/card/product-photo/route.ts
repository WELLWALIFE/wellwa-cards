// POST (bearer) { photo_url, product?, brand?, product_id?, allowPaid? } → the owner's OWN product photo made "studio"
// clean: the exact same product, a clean soft background and good light (never a different product, never a photo
// from the internet — brand photos belong to the brand). The product's own labels and logos are kept as they are.
// PER_PHOTO credits each, only when the owner taps the button (new accounts start with welcome credits); a failed
// photo is refunded. The original photo stays usable either way ("Use original").
// With product_id (one of the owner's saved products) the studio photo is also saved on that product, first in its
// photos, so the V-Card, website and posters use it → { ok, url, charged, saved }.
import { NextResponse } from "next/server";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { SUPA_URL } from "@/lib/admin-guard";
import { storeImage } from "@/lib/media/ai-image";
import { rateLimited } from "@/lib/api-security";

export const maxDuration = 120;
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-image";
const PER_PHOTO = 5;
const UUID = /^[0-9a-f-]{36}$/i;
type Photo = { url?: unknown; view?: unknown; role?: unknown };

/** Puts the studio photo first on the owner's own product; the older photos stay. False when it is not theirs. */
async function saveOnProduct(productId: string, userId: string, out: string): Promise<boolean> {
  const cur = await restAsService<{ photo_url: string | null; photos: Photo[] | null }[]>(`poster_products?id=eq.${productId}&user_id=eq.${userId}&select=photo_url,photos`);
  const row = cur.data?.[0];
  if (!row) return false;
  let old = (Array.isArray(row.photos) ? row.photos : []).filter((p) => !!p && typeof p.url === "string" && p.url !== out);
  if (!old.length && row.photo_url) old = [{ url: row.photo_url, view: "front", role: "identity" }]; // a row from before photos[]
  const w = await restAsService(`poster_products?id=eq.${productId}&user_id=eq.${userId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ photo_url: out, photos: [{ url: out, view: "generated", role: "context" }, ...old].slice(0, 6) }),
  });
  return w.ok;
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  if (rateLimited(`product-photo:${me.id}`, 12, 60 * 60_000)) return NextResponse.json({ error: "Please wait a few minutes and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const url = String(b.photo_url ?? "");
  const product = String(b.product ?? "").slice(0, 80), brand = String(b.brand ?? "").slice(0, 50);
  const productId = typeof b.product_id === "string" && UUID.test(b.product_id) ? b.product_id : "";
  // Only the owner's own uploads.
  if (!url.startsWith(`${SUPA_URL}/storage/v1/object/public/media/`) || !url.includes(me.id)) return NextResponse.json({ error: "Upload the photo first." }, { status: 400 });

  // Charged only on the owner's tap (the button shows the price).
  if (b.allowPaid !== true) return NextResponse.json({ error: "Tap the studio button to use credits." }, { status: 400 });
  const ref = `product-photo:${me.id}:${Date.now()}`;
  const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: PER_PHOTO, p_reason: "product-photo", p_ref: ref }) });
  if (!spend.ok) return NextResponse.json({ error: `You need ${PER_PHOTO} credits for a studio photo. Your own photo is kept.`, needCredits: PER_PHOTO }, { status: 402 });
  const refund = () => restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: PER_PHOTO, p_reason: "product-photo-refund", p_ref: ref }) });

  try {
    const src = await fetch(url);
    const buf = src.ok ? Buffer.from(await src.arrayBuffer()) : null;
    if (!buf || buf.length > 8 * 1024 * 1024) { await refund(); return NextResponse.json({ error: "Could not read the photo. Try a smaller one." }, { status: 400 }); }
    const what = [brand, product].filter(Boolean).join(" ") || "the product";
    const prompt = `Photorealistic professional product photograph of the EXACT product in the reference photo (${what}). Keep it exactly the same product: same shape, colours, parts, labels and printing — do not change, add or remove anything on the product. Only improve the photo: clean soft light-grey to white studio background, soft even lighting, a faint natural shadow, product centred and sharp, filling most of the frame. Do not add any new text, logos, watermarks or props. Keep the product's own labels, logos and printing exactly as they are.`;
    const r = await fetch(`${GEMINI}/${IMG_MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(90_000),
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: src.headers.get("content-type") || "image/jpeg", data: buf.toString("base64") } }, { text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } } }),
    });
    const d = await r.json().catch(() => null);
    const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: { data?: string } }) => x.inlineData?.data);
    const out = part?.inlineData?.data ? await storeImage(me.id, "product-studio", Buffer.from(part.inlineData.data, "base64")) : null;
    if (!out) { await refund(); return NextResponse.json({ error: "The AI could not improve this photo. Your original photo is kept." }, { status: 502 }); }
    // Saved on the owner's product (when it is theirs), first in its photos; the older photos stay.
    const saved = productId ? await saveOnProduct(productId, me.id, out).catch(() => false) : false;
    return NextResponse.json({ ok: true, url: out, charged: PER_PHOTO, saved });
  } catch {
    await refund();
    return NextResponse.json({ error: "The AI could not improve this photo. Your original photo is kept." }, { status: 502 });
  }
}
