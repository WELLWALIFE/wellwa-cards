// "Find a matching picture" for one product: a clean, recent stock photo chosen by the product's name. 1 credit
// (owner, 14 Oct 2026: changing a photo costs one credit); given back when nothing good was found.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { userFromRequest, restAsService, restAsUser } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { stockPhotoForProduct } from "@/lib/media/product-stock";

export const maxDuration = 90;
const CREDITS = 1;
const inFlight = new Set<string>();

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = (typeof b.name === "string" ? b.name : "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Write the product name first." }, { status: 400 });
  if (rateLimited(`product-stock-photo:${me.id}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Too many tries in an hour. Please wait a little." }, { status: 429 });
  if (inFlight.has(me.id)) return NextResponse.json({ error: "One picture is still being found. Please wait a moment." }, { status: 409 });
  inFlight.add(me.id);
  try {
    const ref = `pstock-${me.id.slice(0, 8)}-${randomUUID()}`;
    const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: CREDITS, p_reason: "product-stock-photo", p_ref: ref }) });
    if (!spend.ok) return spend.status >= 500 ? NextResponse.json({ error: "Could not start just now. Nothing was charged. Please try again." }, { status: 503 }) : NextResponse.json({ error: "Not enough credits.", needCredits: CREDITS }, { status: 402 });
    const refund = () => restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: CREDITS, p_reason: "product-stock-photo-refund", p_ref: ref }) });
    try {
      const prof = (await restAsUser<{ category: string | null; tagline: string | null }[]>(me.token, `poster_profiles?user_id=eq.${me.id}&select=category,tagline&order=is_default.desc&limit=1`).catch(() => ({ data: null }))).data?.[0];
      const url = await stockPhotoForProduct(me.id, name, prof?.tagline || prof?.category || "");
      if (!url) { await refund().catch(() => undefined); return NextResponse.json({ error: "No good matching picture was found. Nothing was charged — you can try again or add your own photo." }, { status: 404 }); }
      return NextResponse.json({ url });
    } catch {
      await refund().catch(() => undefined);
      return NextResponse.json({ error: "Something went wrong. Nothing was charged. Please try again." }, { status: 502 });
    }
  } finally { inFlight.delete(me.id); }
}
