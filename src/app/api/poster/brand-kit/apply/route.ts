// POST (bearer) { logo_url, tagline?, profile_id? } → set logo (and tagline if
// empty) on the given profile, or on all of the caller's profiles.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, ownProfile, type PosterProfile } from "@/lib/poster-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const logo = typeof b.logo_url === "string" ? b.logo_url.trim() : "";
  const tagline = typeof b.tagline === "string" ? b.tagline.trim().slice(0, 80) : "";
  const profileId = typeof b.profile_id === "string" ? b.profile_id : "";
  // Only accept logos that live in our own public media bucket.
  const bucket = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/media/poster/${me.id}/`;
  if (!logo || logo.length > 500 || !logo.startsWith(bucket)) return NextResponse.json({ error: "Bad logo_url." }, { status: 400 });

  let targets: PosterProfile[] = [];
  if (profileId) {
    const own = await ownProfile(me.token, profileId);
    if (own) targets = [own];
  }
  if (targets.length === 0) {
    const all = await restAsUser<PosterProfile[]>(me.token, `poster_profiles?user_id=eq.${me.id}&select=*`);
    targets = all.data ?? [];
  }
  if (targets.length === 0) return NextResponse.json({ error: "No profile yet." }, { status: 404 });

  let updated = 0;
  for (const p of targets) {
    const patch: Record<string, string> = { logo_url: logo };
    if (tagline && !(p.tagline ?? "").trim()) patch.tagline = tagline;
    const r = await restAsUser(me.token, `poster_profiles?id=eq.${p.id}&user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (r.ok) updated++;
  }
  if (!updated) return NextResponse.json({ error: "Could not update the profile." }, { status: 500 });
  return NextResponse.json({ ok: true, updated });
}
