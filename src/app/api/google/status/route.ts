// GET (bearer) → connection state, locations, rating, insights (cached 6h).
// PATCH { auto_post?, auto_reply?, location_name?, refresh? }. DELETE → disconnect (keeps nothing).
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { googleCreds, googleRow, googleToken, listReviews, fetchInsights, patchRow, friendlyGoogleError, GOOGLE_REDIRECT } from "@/lib/google-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const g = await googleRow(me.id);
  const creds = await googleCreds(me.id);
  const connected = !!g && !!g.refresh_token;
  let rating = g?.rating ?? null, review_count = g?.review_count ?? 0, insights = g?.insights ?? {}, last_error = g?.last_error ?? "";
  // refresh the summary + insights at most every 6 h, best effort
  if (connected && g && g.status === "ok" && (!g.insights_at || Date.now() - new Date(g.insights_at).getTime() > 6 * 3600_000)) {
    try {
      const tok = await googleToken(g);
      const [rv, ins] = await Promise.all([listReviews(tok, g.location_name).catch(() => null), fetchInsights(tok, g.location_name).catch(() => null)]);
      if (rv) { rating = rv.averageRating; review_count = rv.totalReviewCount; }
      if (ins) insights = ins;
      await patchRow(me.id, { rating, review_count, insights, insights_at: new Date().toISOString(), last_error: "" });
      last_error = "";
    } catch (e) { last_error = friendlyGoogleError(e); await patchRow(me.id, { last_error }); }
  }
  return NextResponse.json({
    configured: creds.source !== "none", source: creds.source, own_client: !!g?.client_id, connected, title: g?.location_title ?? "", status: connected ? g!.status : "none",
    auto_post: !!g?.auto_post, auto_reply: !!g?.auto_reply, connected_at: g?.connected_at ?? null,
    address: g?.address ?? "", phone: g?.phone ?? "", maps_url: g?.maps_url ?? "", rating, review_count, insights, last_error,
    locations: g?.locations ?? [], location_name: g?.location_name ?? "", redirect_uri: GOOGLE_REDIRECT,
  });
}
export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const g = await googleRow(me.id);
  if (!g) return NextResponse.json({ error: "Google not connected." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b.auto_post === "boolean") patch.auto_post = b.auto_post;
  if (typeof b.auto_reply === "boolean") patch.auto_reply = b.auto_reply;
  if (typeof b.location_name === "string") {
    const loc = (g.locations ?? []).find((l) => l.name === b.location_name);
    if (!loc) return NextResponse.json({ error: "Unknown location." }, { status: 400 });
    Object.assign(patch, { location_name: loc.name, location_title: loc.title, address: loc.address, phone: loc.phone, maps_url: loc.maps, rating: null, review_count: 0, insights: {}, insights_at: null });
  }
  if (b.refresh === true) patch.insights_at = null;
  if (b.forget_client === true) Object.assign(patch, { client_id: "", client_secret: "" });
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to change" }, { status: 400 });
  await patchRow(me.id, patch);
  return NextResponse.json({ ok: true });
}
export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  await restAsService(`google_accounts?user_id=eq.${me.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  return NextResponse.json({ ok: true });
}
