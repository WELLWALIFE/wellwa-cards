// POST (bearer) { card_id?, slot: "hero" | "about" } → one new AI photo for that part of the website.
// SITE_PHOTO_CREDITS per photo, refunded if the AI fails.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { rateLimited, clientKey } from "@/lib/api-security";
import { newSitePhoto } from "@/lib/site-server";
import { SITE_PHOTO_CREDITS } from "@/lib/site-pricing";

export const maxDuration = 120;

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(clientKey(request, `site-photo:${me.id}`), 12, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const slot = b.slot === "about" ? "about" : "hero";
  const ref = `site-photo:${me.id}:${Date.now()}`;
  const spend = await restAsService("rpc/spend_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: SITE_PHOTO_CREDITS, p_reason: "ai-website-photo", p_ref: ref }) });
  if (!spend.ok) return NextResponse.json({ error: spend.text.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${SITE_PHOTO_CREDITS} needed).` : "Could not charge credits." }, { status: 402 });
  let url: string | null = null;
  try { url = await newSitePhoto(me.id, slot, typeof b.card_id === "string" ? b.card_id : undefined); } catch { url = null; }
  if (!url) {
    await restAsService("rpc/grant_credits", { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: SITE_PHOTO_CREDITS, p_reason: "ai-website-photo-refund", p_ref: ref }) });
    return NextResponse.json({ error: "The AI could not make the photo. Your credits were returned." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url, charged: SITE_PHOTO_CREDITS });
}
