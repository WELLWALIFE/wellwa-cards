// POST { token } (login required, and it must be YOUR link) → start sharing again on the same link: a new push secret. The owner's own app calls this
// only after its owner said yes to the "share your screen?" question.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited, sameOrigin } from "@/lib/api-security";
import { resumeShare, shareOf } from "@/lib/live-share";
import { SITE_URL } from "@/lib/site-url";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`share-resume:${me.id}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Please wait a little." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const s = shareOf(me.id);
  if (!s || s.token !== body.token) return NextResponse.json({ error: "This link is over. Make a new one." }, { status: 410 });
  const r = resumeShare(s);
  if (!r) return NextResponse.json({ error: "This link is over. Make a new one." }, { status: 410 });
  return NextResponse.json({ token: s.token, secret: r.secret, expiresAt: s.expiresAt, url: `${SITE_URL}/watch/${s.token}` }, { headers: { "Cache-Control": "no-store" } });
}
