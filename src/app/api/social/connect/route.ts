// POST (bearer) { return_to? } → { url } — the Facebook OAuth dialog URL for
// this user. The client navigates there; Meta comes back to /api/social/callback.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { authDialogUrl, metaConfigured, signState } from "@/lib/social-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!metaConfigured()) return NextResponse.json({ error: "not_configured", message: "Facebook/Instagram connect is being set up. Please try again in a few days." }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const returnTo = /^\/[a-z0-9/_-]*$/i.test(String(b.return_to ?? "")) ? String(b.return_to) : "/poster/social";
  const provider = b.provider === "instagram" ? "instagram" : "facebook";
  return NextResponse.json({ url: authDialogUrl(signState(me.id, returnTo, provider)) });
}
