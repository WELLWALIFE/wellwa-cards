// POST (bearer) { provider, kind, author, text, rating } → { reply } — AI-drafted
// reply the user can edit before sending. Nothing is posted here.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited, clientKey } from "@/lib/api-security";
import { businessContext, draftReply } from "@/lib/reviews-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(clientKey(request, `review-draft:${me.id}`), 60, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const ctx = await businessContext(me.id);
  const reply = await draftReply(ctx, { provider: String(b.provider ?? "facebook"), kind: b.kind === "review" ? "review" : "comment", author: String(b.author ?? "").slice(0, 80), text: String(b.text ?? "").slice(0, 1000), rating: typeof b.rating === "number" ? b.rating : null });
  if (!reply) return NextResponse.json({ error: "The AI could not write a reply — please try again." }, { status: 502 });
  return NextResponse.json({ reply });
}
