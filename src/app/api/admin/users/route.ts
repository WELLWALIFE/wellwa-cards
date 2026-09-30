// Super-admin user management (server-side, service-role).
//   GET    → real auth users + their cards, plan and subscription
//   PATCH  → update a user (email / password / plan / V-Card years)
//   DELETE → remove a user account
// Every call must carry the super-admin password in x-admin-key.

import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";
import { partnerCall } from "@/lib/partner-link";

/** One partner ID as the partner panel reports it (action "members"). */
type PartnerRow = {
  code: string; username: string | null; name: string; mobile: string | null; email: string | null; status: "red" | "green";
  blocked: boolean; leg: "L" | "R" | null; suiteUserId: string | null; isRoot: boolean; joined: string;
  subValidUntil: string | null; sponsor: string | null; parent: string | null; directs: number;
};
const partnerOf = (p: PartnerRow) => ({
  code: p.code, username: p.username, status: p.status, blocked: p.blocked, leg: p.leg, isRoot: p.isRoot,
  sponsor: p.sponsor, parent: p.parent, directs: p.directs, subValidUntil: p.subValidUntil,
});

/** Every auth user, page by page (the admin API returns at most 1,000 a call). */
async function allAuthUsers(h: Record<string, string>): Promise<AuthUser[]> {
  const out: AuthUser[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: h, cache: "no-store" });
    if (!r.ok) { if (page === 1) throw new Error(`auth users: ${r.status}`); break; }
    const j = await r.json();
    const list: AuthUser[] = j.users ?? [];
    out.push(...list);
    if (list.length < 1000) break;
  }
  return out;
}

type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: { provider?: string; providers?: string[] };
};
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com";

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ users: [], configured: false });

  try {
    const h = serviceHeaders();
    const [authUsers, cRes, sRes, crRes, ppRes, prRes, pm] = await Promise.all([
      allAuthUsers(h),
      fetch(`${SUPA_URL}/rest/v1/cards?select=id,username,owner_id,active,data`, { headers: h, cache: "no-store" }),
      fetch(`${SUPA_URL}/rest/v1/subscriptions?select=*`, { headers: h, cache: "no-store" }).catch(() => null),
      fetch(`${SUPA_URL}/rest/v1/user_credits?select=user_id,balance`, { headers: h, cache: "no-store" }).catch(() => null),
      fetch(`${SUPA_URL}/rest/v1/poster_profiles?select=user_id,name,phone,is_default`, { headers: h, cache: "no-store" }).catch(() => null),
      fetch(`${SUPA_URL}/rest/v1/profiles?select=id,username,full_name,plan,plan_expires_at,poster_plan,poster_plan_expires_at`, { headers: h, cache: "no-store" }).catch(() => null),
      partnerCall<{ members?: PartnerRow[] }>("members", {}, 15000),
    ]);
    const partners: PartnerRow[] = pm.ok && Array.isArray(pm.data.members) ? pm.data.members : [];
    const partnerByUser = new Map(partners.filter((p) => p.suiteUserId).map((p) => [p.suiteUserId as string, p]));
    const pprofiles: { user_id: string; name: string; phone: string | null; is_default: boolean }[] = ppRes && ppRes.ok ? await ppRes.json() : [];
    const profileRows: { id: string; username?: string | null; full_name: string | null; plan: string; plan_expires_at: string | null; poster_plan: string | null; poster_plan_expires_at: string | null }[] = prRes && prRes.ok ? await prRes.json() : [];

    const cards: { id: string; username: string; owner_id: string; active: boolean; data?: { plan?: string } }[] =
      cRes.ok ? await cRes.json() : [];
    const subs: { owner_id?: string; user_id?: string; plan?: string; status?: string; current_period_end?: string; amount?: number }[] =
      sRes && sRes.ok ? await sRes.json() : [];
    const credits: { user_id: string; balance: number }[] = crRes && crRes.ok ? await crRes.json() : [];

    const users = authUsers.map((u) => {
      const mine = cards.filter((c) => c.owner_id === u.id);
      const sub = subs.find((s) => (s.owner_id ?? s.user_id) === u.id);
      const plan = sub?.plan ?? mine[0]?.data?.plan ?? "free";
      const pp = pprofiles.filter((x) => x.user_id === u.id);
      const pr = profileRows.find((x) => x.id === u.id);
      const partner = partnerByUser.get(u.id) ?? null;
      return {
        id: u.id,
        kind: "account" as const,
        username: pr?.username ?? partner?.username ?? null,
        partner: partner ? partnerOf(partner) : null,
        email: u.email ?? "",
        phone: u.phone ?? pp.find((x) => x.is_default)?.phone ?? pp[0]?.phone ?? "",
        provider: (u.app_metadata?.providers ?? [u.app_metadata?.provider]).filter(Boolean).join(", ") || (u.phone ? "phone" : "email"),
        posterProfiles: pp.map((x) => x.name),
        posterPlan: pr?.poster_plan ?? "free",
        planExpires: (pr?.plan_expires_at ?? "").slice(0, 10),
        name: (u.user_metadata?.name as string) || (u.user_metadata?.full_name as string) || pr?.full_name || pp.find((x) => x.is_default)?.name || pp[0]?.name || (u.email ?? "").split("@")[0] || (u.phone ? `+${u.phone}` : "user"),
        associate: (u.user_metadata?.associate_id as string) || "",
        joined: (u.created_at ?? "").slice(0, 10),
        joinedAt: u.created_at ?? "",
        lastSeen: u.last_sign_in_at ? u.last_sign_in_at.slice(0, 10) : "",
        cards: mine.length,
        usernames: mine.map((c) => c.username),
        plan: pr?.plan ?? plan,
        subscription: sub
          ? { plan: sub.plan ?? plan, status: sub.status ?? "active", renews: (sub.current_period_end ?? "").slice(0, 10), amount: sub.amount ?? null }
          : null,
        status: mine.length > 0 && mine.every((c) => c.active === false) ? "suspended" : "active",
        credits: credits.find((c) => c.user_id === u.id)?.balance ?? 0,
      };
    });


    // Partner IDs with no app account — the company's root ID, and any ID made by hand in Staff Admin. Listed too
    // (owner's call, 24 Sep 2026: "every user, even the root ID"), marked so nobody tries app actions on them.
    const known = new Set(authUsers.map((u) => u.id));
    const partnerOnly = partners.filter((p) => !p.suiteUserId || !known.has(p.suiteUserId)).map((p) => ({
      id: `partner:${p.code}`,
      kind: "partner" as const,
      username: p.username,
      partner: partnerOf(p),
      email: p.email ?? "",
      phone: p.mobile ?? "",
      provider: p.isRoot ? "company root ID" : "partner panel only",
      posterProfiles: [] as string[],
      posterPlan: "free",
      planExpires: "",
      name: p.name,
      associate: p.code,
      joined: p.joined,
      joinedAt: p.joined,
      lastSeen: "",
      cards: 0,
      usernames: [] as string[],
      plan: "free",
      subscription: null,
      status: p.blocked ? "suspended" : "active",
      credits: 0,
    }));

    return Response.json({
      // Newest first everywhere (owner's call, 27 Sep 2026) — by the exact sign-up time, so the same day is in order too;
      // the company root ID, the oldest of all, ends up at the bottom.
      users: [...users, ...partnerOnly].sort((a, b) => (b.joinedAt || "").localeCompare(a.joinedAt || "")),
      configured: true, subsTable: Boolean(sRes && sRes.ok),
      partnerLinked: pm.ok, partnerError: pm.ok ? null : pm.data.error ?? `status ${pm.status}`,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

/** POST { action: "login_as", id } → for email accounts a one-click magic link (open it in a private window);
 *  for phone-only accounts a temporary password is set and returned (log in with phone + that password). */
export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as { action?: string; id?: string };
  if (b.action !== "login_as" || !b.id) return Response.json({ error: "bad request" }, { status: 400 });
  const h = serviceHeaders();
  const ur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${b.id}`, { headers: h, cache: "no-store" });
  if (!ur.ok) return Response.json({ error: "user not found" }, { status: 404 });
  const u = (await ur.json()) as AuthUser;
  if (u.email) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: u.email, options: { redirect_to: `${SITE}/poster` } }) });
    const j = await r.json().catch(() => ({}));
    const hashed: string = j.hashed_token ?? j.properties?.hashed_token ?? "";
    if (!r.ok || (!hashed && !j.action_link)) return Response.json({ error: j.msg || j.error_description || "could not create link" }, { status: 400 });
    // Our own sign-in page redeems the token in the browser (verifyOtp) and opens the app as that user — the raw
    // Supabase link only landed on the website's home page (redirect settings), never inside the account.
    const md = u.user_metadata ?? {};
    const who = String(md.display_name ?? md.full_name ?? md.name ?? u.email ?? "").slice(0, 60);
    const link = hashed ? `${SITE}/auth/as?t=${encodeURIComponent(hashed)}&n=${encodeURIComponent(who)}` : j.action_link;
    return Response.json({ ok: true, mode: "link", email: u.email, link });
  }
  const temp = "Tmp-" + Math.random().toString(36).slice(2, 8) + Math.floor(100 + Math.random() * 900);
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${b.id}`, { method: "PUT", headers: h, body: JSON.stringify({ password: temp }) });
  if (!r.ok) return Response.json({ error: (await r.json())?.msg ?? "could not set password" }, { status: 400 });
  return Response.json({ ok: true, mode: "password", phone: u.phone ?? "", password: temp, login_url: `${SITE}/login` });
}

export async function PATCH(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });

  const { id, email, password, plan, months, suspend, cardYears } = (await request.json()) as {
    id?: string; email?: string; password?: string; plan?: string; months?: number; suspend?: boolean; cardYears?: number;
  };
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (plan && !["free", "pro", "team"].includes(plan)) return Response.json({ error: "unknown plan" }, { status: 400 });

  const h = serviceHeaders();
  // V-Card years by hand (a ₹1,499 renewal paid in cash / offline): from the later of today and the current end.
  // Not partner business — nothing is reported to the partner panel.
  if (cardYears !== undefined) {
    const years = Math.round(Number(cardYears));
    if (!(years >= 1 && years <= 5)) return Response.json({ error: "cardYears must be 1 to 5" }, { status: 400 });
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/admin_extend_card`, { method: "POST", headers: h, body: JSON.stringify({ p_user: id, p_years: years }) });
    if (!r.ok) return Response.json({ error: `Could not extend the V-Card: ${await r.text()}` }, { status: 400 });
    return Response.json({ ok: true, cardUntil: await r.json() });
  }
  try {
    const patch: Record<string, unknown> = {};
    if (email) patch.email = email;
    if (password) patch.password = password;
    if (Object.keys(patch).length) {
      const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, {
        method: "PUT", headers: h, body: JSON.stringify(patch),
      });
      if (!r.ok) return Response.json({ error: (await r.json())?.msg ?? "update failed" }, { status: 400 });
    }
    // Suspend/reinstate every card this user owns — the public page, lead
    // capture and the WhatsApp bot all read the same `active` column, so
    // this is a real platform-wide kill switch, not a cosmetic flag.
    if (typeof suspend === "boolean") {
      const cr = await fetch(`${SUPA_URL}/rest/v1/cards?owner_id=eq.${id}&select=id`, { headers: h });
      const cards: { id: string }[] = cr.ok ? await cr.json() : [];
      await Promise.all(cards.map((c) =>
        fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${c.id}`, {
          method: "PATCH", headers: h,
          body: JSON.stringify({ active: !suspend }),
        }),
      ));
    }
    // profiles.plan + plan_expires_at is what my_plan() reads, and my_plan() is what every paid screen asks —
    // AI Studio, Studio, WhatsApp, Analytics. Writing only cards.data.plan (below) left all of those locked, so a
    // plan given here did nothing. Both are written now: the profile decides access, the card carries the label.
    if (plan) {
      const paidMonths = Math.min(24, Math.max(1, Math.round(Number(months) || 1)));
      const until = new Date(); until.setMonth(until.getMonth() + paidMonths);
      const pr = await fetch(`${SUPA_URL}/rest/v1/profiles?id=eq.${id}`, {
        method: "PATCH", headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify(plan === "free"
          ? { plan: "free", plan_expires_at: null, plan_source: "admin" }
          : { plan, plan_expires_at: until.toISOString(), plan_source: "admin" }),
      });
      if (!pr.ok) return Response.json({ error: `Could not set the plan: ${await pr.text()}` }, { status: 400 });
    }
    // The same plan on the user's cards (data.plan), which the public page and the WhatsApp bridge read.
    if (plan) {
      const cr = await fetch(`${SUPA_URL}/rest/v1/cards?owner_id=eq.${id}&select=id,data`, { headers: h });
      const cards: { id: string; data: Record<string, unknown> }[] = cr.ok ? await cr.json() : [];
      await Promise.all(cards.map((c) =>
        fetch(`${SUPA_URL}/rest/v1/cards?id=eq.${c.id}`, {
          method: "PATCH", headers: h,
          body: JSON.stringify({ data: { ...c.data, plan } }),
        }),
      ));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });

  const { id } = (await request.json()) as { id?: string };
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE", headers: serviceHeaders(),
    });
    if (!r.ok) return Response.json({ error: "delete failed" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
