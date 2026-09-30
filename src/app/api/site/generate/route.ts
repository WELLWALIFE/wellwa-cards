// POST (bearer) { card_id?, lang?, photos?, reference? } → AI writes the whole website for the user's card (and,
// if asked, makes AI photos), then switches website mode on. Paid in credits on every build:
// text SITE_TEXT_CREDITS + SITE_PHOTO_CREDITS per photo. Photos that fail are refunded; if the AI fails, everything is.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { rateLimited, clientKey } from "@/lib/api-security";
import { generateSite, siteStatus } from "@/lib/site-server";
import { readReference } from "@/lib/reference-site";
import { SITE_MAX_PHOTOS, SITE_PHOTO_CREDITS, siteAiCost } from "@/lib/site-pricing";

export const maxDuration = 180;

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(clientKey(request, `site-gen:${me.id}`), 6, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const cardId = typeof b.card_id === "string" ? b.card_id : undefined;
  const photos = Math.max(0, Math.min(SITE_MAX_PHOTOS, Math.trunc(Number(b.photos ?? 0)) || 0));
  const cost = siteAiCost(photos);

  // Read the reference site first, so a bad link costs nothing.
  let reference = null;
  if (typeof b.reference === "string" && b.reference.trim()) {
    reference = await readReference(b.reference.slice(0, 300));
    if (!reference) return NextResponse.json({ error: "We could not open that reference website. Check the link, or leave it empty." }, { status: 400 });
  }

  const ref = `site:${me.id}:${Date.now()}`;
  const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: cost, p_reason: "ai-website", p_ref: ref }) });
  if (!spend.ok) return NextResponse.json({ error: spend.text.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${cost} needed).` : "Could not charge credits.", cost }, { status: 402 });
  const refund = (amount: number, why: string) => amount > 0
    ? restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: amount, p_reason: why, p_ref: ref }) })
    : Promise.resolve(null);

  try {
    const lang = typeof b.lang === "string" ? b.lang : undefined;
    const details = typeof b.details === "string" ? b.details.slice(0, 4000) : undefined;
    const r = await generateSite(me.id, lang, cardId, { photos, reference, details });
    const missed = photos - r.photosMade;
    if (missed > 0) await refund(missed * SITE_PHOTO_CREDITS, "ai-website-photo-refund");
    return NextResponse.json({ ok: true, charged: cost - missed * SITE_PHOTO_CREDITS, photos: r.photosMade, status: await siteStatus(me.id, cardId) });
  } catch (e) {
    await refund(cost, "ai-website-refund");
    const msg = (e as Error).message;
    if (msg === "NO_CARD") return NextResponse.json({ error: "Create your digital card first (Create → My digital card)." }, { status: 400 });
    return NextResponse.json({ error: "The AI did not respond. Your credits were returned — please try again." }, { status: 502 });
  }
}
