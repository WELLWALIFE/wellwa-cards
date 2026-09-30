// GET ?poster_id=<uuid> (bearer) → which providers this exact poster has
// already been posted to successfully, so the app can show "Posted ✓"
// instead of letting someone repost blind.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const posterId = new URL(request.url).searchParams.get("poster_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(posterId)) return NextResponse.json({ error: "bad poster_id" }, { status: 400 });
  const r = await restAsService<{ provider: string; created_at: string }[]>(
    `social_posts?user_id=eq.${me.id}&poster_id=eq.${posterId}&status=eq.ok&select=provider,created_at&order=created_at.desc`
  );
  const posted: Record<string, string> = {};
  for (const row of r.data ?? []) if (!posted[row.provider]) posted[row.provider] = row.created_at;
  return NextResponse.json({ posted });
}
