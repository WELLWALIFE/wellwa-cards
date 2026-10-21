// POST (bearer) { video_url, thumb_url?, caption, account_ids: [] } → publish the owner's OWN video (uploaded with
// /api/poster/upload kind=video) to each selected Facebook Page / Instagram account. "Apni video" (owner, 21 Oct 2026).
// Only files from our own storage are accepted, so nobody can make a Page post out of a stranger's URL.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { SUPA_URL } from "@/lib/admin-guard";
import { listAccounts, publishVideo, SITE_URL } from "@/lib/social-server";

export const maxDuration = 300;

const ours = (u: unknown): string => {
  const s = typeof u === "string" ? u.trim() : "";
  if (!/^https:\/\/.{5,600}$/.test(s)) return "";
  return (SUPA_URL && s.startsWith(`${SUPA_URL}/storage/v1/object/public/media/`)) || s.startsWith(`${SITE_URL}/`) ? s : "";
};

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const videoUrl = ours(b.video_url), thumbUrl = ours(b.thumb_url);
  const caption = String(b.caption ?? "").trim().slice(0, 2000);
  const ids: string[] = Array.isArray(b.account_ids) ? b.account_ids.map(String).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (!videoUrl) return NextResponse.json({ error: "Upload the video first." }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Pick a Facebook Page or Instagram account." }, { status: 400 });
  // The video must be the caller's own upload (the storage key carries the user id).
  if (videoUrl.startsWith(SUPA_URL) && !videoUrl.includes(`/media/poster/${me.id}/`)) return NextResponse.json({ error: "That video is not yours." }, { status: 403 });

  const accounts = (await listAccounts(me.id)).filter((a) => ids.includes(a.id) && a.is_active && (a.provider === "facebook" || a.provider === "instagram"));
  if (!accounts.length) return NextResponse.json({ error: "Connect Facebook or Instagram first." }, { status: 400 });
  const results: { id: string; provider: string; name: string; ok: boolean; error?: string }[] = [];
  for (const a of accounts) {
    try {
      const remote = await publishVideo(a, videoUrl, caption, thumbUrl || undefined);
      // Our history row; a video has no poster, so poster_id stays empty. Never let the record fail a post that went out.
      await restAsService("social_posts", { method: "POST", body: JSON.stringify({ user_id: me.id, account_id: a.id, provider: a.provider, caption, remote_id: remote, status: "ok" }) }).catch(() => null);
      results.push({ id: a.id, provider: a.provider, name: a.name, ok: true });
    } catch (e) {
      const err = e as Error & { code?: number };
      if (err.code === 190) await restAsService(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "reconnect" }) });
      await restAsService("social_posts", { method: "POST", body: JSON.stringify({ user_id: me.id, account_id: a.id, provider: a.provider, caption, status: "error", error: String(err.message).slice(0, 500) }) }).catch(() => null);
      results.push({ id: a.id, provider: a.provider, name: a.name, ok: false, error: err.code === 190 ? "Please reconnect this account." : String(err.message).slice(0, 200) });
    }
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
