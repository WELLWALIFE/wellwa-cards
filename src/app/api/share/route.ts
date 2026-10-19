// POST (login required) → a new live-screen link for this account: { token, secret, url }. The secret is what lets THIS app push its screen; it is
// shown to the sender's browser once and is never part of the link (lib/live-share.ts).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited, sameOrigin } from "@/lib/api-security";
import { createShare } from "@/lib/live-share";
import { SITE_URL } from "@/lib/site-url";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`share-create:${me.id}`, 8, 60 * 60_000)) return NextResponse.json({ error: "Too many links made. Please wait a little." }, { status: 429 });
  const { token, secret } = createShare(me.id);
  return NextResponse.json({ token, secret, url: `${SITE_URL}/watch/${token}` }, { headers: { "Cache-Control": "no-store" } });
}
