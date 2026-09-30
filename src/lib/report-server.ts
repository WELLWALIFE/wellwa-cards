// Marketing report for one user over the last N days (agency-style summary).
import { restAsService } from "@/lib/poster-server";
import { graph } from "@/lib/social-server";

export type Report = {
  days: number; since: string;
  posters: number; posts: { facebook: number; instagram: number; whatsapp: number }; reach: number | null;
  leads: number; leadsHot: number; videos: number; learned: number; calendarPlanned: number;
};

export async function buildReport(userId: string, days = 30): Promise<Report> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [posters, posts, leads, videos, learned, cal, accts] = await Promise.all([
    restAsService<{ id: string }[]>(`posters?select=id,poster_profiles!inner(user_id)&poster_profiles.user_id=eq.${userId}&created_at=gte.${since}`),
    restAsService<{ provider: string; remote_id: string | null; status: string }[]>(`social_posts?user_id=eq.${userId}&status=eq.ok&created_at=gte.${since}&select=provider,remote_id,status`),
    restAsService<{ status: string; score: number | null }[]>(`leads?owner_id=eq.${userId}&created_at=gte.${since}&select=status,score`),
    restAsService<{ id: string }[]>(`media_jobs?owner_id=eq.${userId}&kind=eq.ad&status=eq.done&created_at=gte.${since}&select=id`),
    restAsService<{ id: string }[]>(`bot_learning?user_id=eq.${userId}&status=eq.approved&created_at=gte.${since}&select=id`),
    restAsService<{ id: string }[]>(`poster_calendar?user_id=eq.${userId}&for_date=gte.${new Date().toISOString().slice(0, 10)}&status=eq.planned&select=id`),
    restAsService<{ provider: string; access_token: string; is_active: boolean }[]>(`social_accounts?user_id=eq.${userId}&provider=eq.facebook&is_active=eq.true&select=provider,access_token,is_active`),
  ]);
  const p = { facebook: 0, instagram: 0, whatsapp: 0 };
  for (const x of posts.data ?? []) if (x.provider in p) p[x.provider as keyof typeof p]++;
  // Facebook reach: sum of unique impressions per post we published (best effort, capped)
  let reach: number | null = null;
  const fb = accts.data?.[0];
  if (fb) {
    const ids = (posts.data ?? []).filter((x) => x.provider === "facebook" && x.remote_id).map((x) => x.remote_id as string).slice(0, 40);
    if (ids.length) {
      reach = 0;
      for (const id of ids) {
        try { const r = await graph<{ data: { values: { value: number }[] }[] }>(`${id}/insights`, { metric: "post_impressions_unique", access_token: fb.access_token }); reach += Number(r.data?.[0]?.values?.[0]?.value ?? 0); } catch { /* skip */ }
      }
    }
  }
  const L = leads.data ?? [];
  return { days, since, posters: posters.data?.length ?? 0, posts: p, reach, leads: L.length, leadsHot: L.filter((l) => l.status === "hot" || l.status === "interested" || (l.score ?? 0) >= 70).length, videos: videos.data?.length ?? 0, learned: learned.data?.length ?? 0, calendarPlanned: cal.data?.length ?? 0 };
}

export function reportText(r: Report, name: string, hi = true): string {
  const total = r.posts.facebook + r.posts.instagram + r.posts.whatsapp;
  return hi
    ? `📊 *${name} — पिछले ${r.days} दिन की marketing report*\n\n🖼️ Posters बने: ${r.posters}\n📣 Posts हुईं: ${total} (Facebook ${r.posts.facebook} · Instagram ${r.posts.instagram} · Status ${r.posts.whatsapp})${r.reach !== null ? `\n👀 Facebook reach: ${r.reach.toLocaleString("en-IN")}` : ""}\n🎬 Video ads: ${r.videos}\n📥 नई leads: ${r.leads} (hot: ${r.leadsHot})\n🤖 Bot ने नया सीखा: ${r.learned}\n📅 आगे planned: ${r.calendarPlanned} दिन\n\nखर्च: ₹0 agency fee 😊 — Shubhora`
    : `📊 *${name} — last ${r.days} days marketing report*\n\n🖼️ Posters made: ${r.posters}\n📣 Posts published: ${total} (Facebook ${r.posts.facebook} · Instagram ${r.posts.instagram} · Status ${r.posts.whatsapp})${r.reach !== null ? `\n👀 Facebook reach: ${r.reach.toLocaleString("en-IN")}` : ""}\n🎬 Video ads: ${r.videos}\n📥 New leads: ${r.leads} (hot: ${r.leadsHot})\n🤖 Bot learned: ${r.learned}\n📅 Planned ahead: ${r.calendarPlanned} days\n\nAgency fee: ₹0 😊 — Shubhora`;
}
