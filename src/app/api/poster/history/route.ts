// GET ?profile=<id> → last 30 posters for the profile
import { NextResponse } from "next/server";
import { userFromRequest, ownProfile, restAsService } from "@/lib/poster-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get("profile") ?? "";
  const profile = await ownProfile(me.token, profileId);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const r = await restAsService<unknown[]>(`posters?profile_id=eq.${profile.id}&select=id,for_date,occasion_slug,title,url,shares,style,video_url,music,caption&order=for_date.desc&limit=30`);
  return NextResponse.json({ posters: r.data ?? [] });
}
