// POST (bearer) { poster_id, daily_rupees, days } → PAUSED click-to-WhatsApp campaign on the user's Facebook ad account.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { listAccounts, createPausedBoost, SITE_URL } from "@/lib/social-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const posterId = String(b.poster_id ?? "");
  const daily = Math.min(5000, Math.max(100, Number(b.daily_rupees) || 200));
  const days = Math.min(30, Math.max(1, Number(b.days) || 3));
  if (!/^[0-9a-f-]{36}$/i.test(posterId)) return NextResponse.json({ error: "poster_id required" }, { status: 400 });
  const fb = (await listAccounts(me.id)).find((a) => a.provider === "facebook" && a.is_active);
  if (!fb) return NextResponse.json({ error: "Connect a Facebook Page first." }, { status: 400 });
  const p = (await restAsService<{ url: string; title: string; poster_profiles: { user_id: string; phone: string | null; name: string } }[]>(`posters?id=eq.${posterId}&select=url,title,poster_profiles!inner(user_id,phone,name)`)).data?.[0];
  if (!p || p.poster_profiles.user_id !== me.id) return NextResponse.json({ error: "poster not found" }, { status: 404 });
  if (!p.poster_profiles.phone) return NextResponse.json({ error: "Add your WhatsApp number to the profile first." }, { status: 400 });
  try {
    const r = await createPausedBoost(fb, { imageUrl: p.url.startsWith("http") ? p.url : `${SITE_URL}${p.url}`, caption: `${p.title} — ${p.poster_profiles.name}`, phone: p.poster_profiles.phone, dailyPaise: daily * 100, days, name: p.title });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: /permission|ads_management|\(#200\)|\(#10\)/i.test(msg) ? "Ads permission not granted yet — reconnect Facebook after Meta approves ads access." : msg.slice(0, 200) }, { status: 400 });
  }
}
