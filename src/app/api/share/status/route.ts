// GET (login required) → this account's own link, if it is still inside its 15 minutes: its state, and whether somebody is waiting for the app to start
// sharing again. Only the owner's own app asks; it never shows anything of a viewer except how many there are.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { senderView, shareOf } from "@/lib/live-share";
import { SITE_URL } from "@/lib/site-url";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const s = shareOf(me.id);
  return NextResponse.json({ link: s ? { ...senderView(s), url: `${SITE_URL}/watch/${s.token}` } : null }, { headers: { "Cache-Control": "no-store" } });
}
