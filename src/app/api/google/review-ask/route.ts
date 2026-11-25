// GET (bearer) → what the "Ask for a review" button needs: the review helper page of the owner's card, whether a Google review
// box is known (connected profile, else the card's Maps link), the business name and the message language.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { businessOf, cardOf, googleReviewUrl, hindiCard, reviewPage, siteOf } from "@/lib/customer-send";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const c = await cardOf(me.id);
  if (!c) return NextResponse.json({ error: "Make your card first — the review link opens on it." }, { status: 400 });
  const google = await googleReviewUrl(me.id, c);
  return NextResponse.json({ page: reviewPage(c), google: !!google, biz: businessOf(c), hindi: hindiCard(c), site: siteOf(c) });
}
