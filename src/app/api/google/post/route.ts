// POST (bearer) { poster_id } → publish that poster as a Google Business update (local post).
// POST { text, image_url?, cta?, url? } → custom update. GET → last 10 updates.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService, ensurePosterCaption, dayPlan, squarePosterUrl } from "@/lib/poster-server";
import { SITE_URL } from "@/lib/social-server";
import { googleRow, googleToken, createLocalPost, listLocalPosts, friendlyGoogleError } from "@/lib/google-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const g = await googleRow(me.id); if (!g?.refresh_token) return NextResponse.json({ posts: [] });
  try { return NextResponse.json({ posts: await listLocalPosts(await googleToken(g), g.location_name) }); }
  catch (e) { return NextResponse.json({ posts: [], error: friendlyGoogleError(e) }); }
}
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const g = await googleRow(me.id); if (!g?.refresh_token) return NextResponse.json({ error: "Google not connected." }, { status: 400 });
  try {
    if (typeof b.text === "string" && b.text.trim()) {
      const image = typeof b.image_url === "string" && /^https:\/\//.test(b.image_url) ? b.image_url : undefined;
      const cta = ["CALL", "LEARN_MORE", "BOOK", "ORDER"].includes(b.cta) ? b.cta : undefined;
      const url = typeof b.url === "string" && /^https:\/\//.test(b.url) ? b.url : undefined;
      const r = await createLocalPost(await googleToken(g), g.location_name, { summary: b.text.trim(), imageUrl: image, phone: g.phone, cta, url });
      return NextResponse.json({ ok: true, name: r.name });
    }
    const posterId = String(b.poster_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(posterId)) return NextResponse.json({ error: "bad poster" }, { status: 400 });
    const poster = (await restAsService<{ id: string; url: string; title: string; caption: string | null; profile_id: string; for_date: string }[]>(`posters?id=eq.${posterId}&select=id,url,title,caption,profile_id,for_date`)).data?.[0];
    if (!poster) return NextResponse.json({ error: "Poster not found." }, { status: 404 });
    const prof = (await restAsService<{ name: string; tagline: string | null; phone: string | null; lang: string }[]>(`poster_profiles?id=eq.${poster.profile_id}&user_id=eq.${me.id}&select=name,tagline,phone,lang`)).data?.[0];
    if (!prof) return NextResponse.json({ error: "Poster not found." }, { status: 404 });
    const plan = await dayPlan(me.id, poster.profile_id, poster.for_date);
    const offer = plan.offer;
    const caption = (await ensurePosterCaption(posterId, { name: prof.name, tagline: prof.tagline, phone: prof.phone, lang: prof.lang, theme: poster.title, offer }).catch(() => null)) ?? poster.caption ?? poster.title;
    // Google shows local-post photos square: a Signature poster has its own 1:1 cut next to the 4:5 master
    const posterUrl = await squarePosterUrl(poster.url);
    const imageUrl = posterUrl.startsWith("http") ? posterUrl : `${SITE_URL}${posterUrl}`;
    const r = await createLocalPost(await googleToken(g), g.location_name, { summary: String(caption ?? poster.title), imageUrl, phone: prof.phone ?? g.phone, lang: prof.lang });
    return NextResponse.json({ ok: true, name: r.name });
  } catch (e) { return NextResponse.json({ error: friendlyGoogleError(e) }, { status: 502 }); }
}
