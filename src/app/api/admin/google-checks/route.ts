// Super Admin → Google checks (owner, 25 Nov 2026: "admin me lead ka option kaha hai?"): every free Google check that was run, and
// every lead it brought (the visitor's number) with the card that got it. Read only.
// The funnel (owner, 26 Nov 2026: "hamara maksad hai wo hamare saath jude"): checks → leads → joined (an account with the lead's
// mobile) → paying (a plan running now), for the last 30 days and per partner card. Joined is matched by mobile number only.
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

type Check = { created_at: string; name: string; city: string; score: number; phone: string | null; query: string | null; user_id: string | null };
type Lead = { created_at: string; name: string; phone: string; message: string; card_id: string };
type Prof = { id: string; plan: string | null; plan_expires_at: string | null; saas_expires_at: string | null; poster_plan_expires_at: string | null };
const last10 = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "").slice(-10);
const live = (d: string | null) => !!d && new Date(d).getTime() > Date.now();

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const list = <T,>(x: unknown) => (Array.isArray(x) ? (x as T[]) : []);
  // The Monday check of connected businesses (lib/google-health) is kept in the same table: not a visitor's check.
  const checks = list<Check>((await restAsService<Check[]>("google_checks?query=neq.weekly%20health&select=created_at,name,city,score,phone,query,user_id&order=created_at.desc&limit=500")).data);
  const leads = list<Lead>((await restAsService<Lead[]>("leads?src=eq.google-check&select=created_at,name,phone,message,card_id&order=created_at.desc&limit=500")).data);
  const ids = [...new Set(leads.map((l) => l.card_id).filter(Boolean))];
  const cards = ids.length ? list<{ id: string; username: string }>((await restAsService<{ id: string; username: string }[]>(`cards?id=in.(${ids.join(",")})&select=id,username`)).data) : [];
  const nameOf = new Map(cards.map((c) => [c.id, c.username]));

  // Accounts by mobile: the sign-in phone (or the phone-login address) and the poster profile's number.
  const byPhone = new Map<string, string>();
  const admin = getAdminSupabase();
  if (admin) {
    for (let page = 1; page <= 10; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      for (const u of users) { const m = last10(u.phone) || (/^p?\d{10,13}@phone\./.test(u.email ?? "") ? last10(u.email) : ""); if (m.length === 10) byPhone.set(m, u.id); }
      if (users.length < 1000) break;
    }
  }
  for (const pp of list<{ user_id: string; phone: string | null }>((await restAsService("poster_profiles?select=user_id,phone&limit=10000")).data)) {
    const m = last10(pp.phone); if (m.length === 10 && !byPhone.has(m)) byPhone.set(m, pp.user_id);
  }
  const joinedIds = [...new Set(leads.map((l) => byPhone.get(last10(l.phone))).filter((x): x is string => !!x))];
  const profs = joinedIds.length ? list<Prof>((await restAsService(`profiles?id=in.(${joinedIds.join(",")})&select=id,plan,plan_expires_at,saas_expires_at,poster_plan_expires_at`)).data) : [];
  const paying = new Set(profs.filter((p) => (["pro", "team"].includes(p.plan ?? "") && (!p.plan_expires_at || live(p.plan_expires_at))) || live(p.saas_expires_at) || live(p.poster_plan_expires_at)).map((p) => p.id));

  const rows = leads.map((l) => { const uid = byPhone.get(last10(l.phone)); return { ...l, card: nameOf.get(l.card_id) ?? "", stage: uid ? (paying.has(uid) ? "paying" : "joined") : "lead" }; });
  const since = Date.now() - 30 * 86_400_000;
  const recent = rows.filter((l) => new Date(l.created_at).getTime() >= since);
  const funnel = {
    checks: checks.filter((c) => new Date(c.created_at).getTime() >= since).length,
    leads: recent.length,
    joined: recent.filter((l) => l.stage !== "lead").length,
    paying: recent.filter((l) => l.stage === "paying").length,
  };
  const per = new Map<string, { card: string; leads: number; joined: number; paying: number }>();
  for (const l of recent) { const k = l.card || "—"; const x = per.get(k) ?? { card: k, leads: 0, joined: 0, paying: 0 }; x.leads++; if (l.stage !== "lead") x.joined++; if (l.stage === "paying") x.paying++; per.set(k, x); }
  return NextResponse.json({ checks: checks.slice(0, 200), leads: rows.slice(0, 200), funnel, byCard: [...per.values()].sort((a, b) => b.leads - a.leads) });
}
