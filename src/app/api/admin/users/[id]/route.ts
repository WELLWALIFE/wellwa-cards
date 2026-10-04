// Super-admin: one user's complete profile (auth identity, plan, cards, leads,
// poster profiles, payments, credits, connected services). Tokens/secrets are
// never returned — only whether a service is connected.
import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

const BRIDGE = "http://127.0.0.1:8787";
type Row = Record<string, unknown>;

async function rows(path: string, h: Record<string, string>): Promise<Row[]> {
  try { const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: h, cache: "no-store" }); return r.ok ? await r.json() : []; } catch { return []; }
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return Response.json({ error: "service key missing" }, { status: 400 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const h = serviceHeaders();
  const ur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${id}`, { headers: h, cache: "no-store" });
  if (!ur.ok) return Response.json({ error: "user not found" }, { status: 404 });
  const u = await ur.json();

  const [profile, cards, leads, pprofiles, posters, payments, subs, credits, ledger, devices, google, cloud, social, agents, jobs, waSess] = await Promise.all([
    rows(`profiles?id=eq.${id}&select=*`, h),
    rows(`cards?owner_id=eq.${id}&select=id,username,name,company,job_title,active,views,data,created_at&order=created_at.desc`, h),
    rows(`leads?owner_id=eq.${id}&select=id,card_id,name,phone,source,status,created_at&order=created_at.desc&limit=10`, h),
    rows(`poster_profiles?user_id=eq.${id}&select=id,persona,name,tagline,phone,city,lang,is_default,logo_url,photo_url,category,style,created_at&order=created_at.asc`, h),
    rows(`posters?select=id,created_at,profile_id&profile_id=in.(select id from poster_profiles)&limit=0`, h).then(() => rows(`poster_profiles?user_id=eq.${id}&select=id,posters(count)`, h)),
    rows(`poster_payments?user_id=eq.${id}&select=plan,amount_paise,razorpay_payment_id,created_at&order=created_at.desc&limit=20`, h),
    rows(`subscriptions?owner_id=eq.${id}&select=plan,status,provider,provider_ref,amount,period,created_at,current_end&order=created_at.desc&limit=20`, h),
    rows(`user_credits?user_id=eq.${id}&select=balance`, h),
    rows(`credit_ledger?user_id=eq.${id}&select=delta,reason,ref,created_at&order=created_at.desc&limit=20`, h),
    rows(`poster_devices?user_id=eq.${id}&select=platform,lang,last_seen`, h),
    rows(`google_accounts?user_id=eq.${id}&select=location_title,status,auto_post,auto_reply,token_expires_at`, h),
    rows(`wa_cloud_accounts?owner_id=eq.${id}&select=display_phone,verified_name,quality_rating,messaging_limit,phone_number_id,created_at`, h),
    rows(`social_accounts?user_id=eq.${id}&select=provider,name,username,token_expires_at`, h),
    rows(`crm_agents?owner_id=eq.${id}&select=agent_user_id,name,phone,role,active,created_at`, h),
    rows(`media_jobs?owner_id=eq.${id}&select=id,kind,status,cost,created_at&order=created_at.desc&limit=10`, h),
    Promise.resolve(null),
  ]);
  // WhatsApp (QR) session state — only asked when the plan is live, exactly like the app itself (the manager starts a worker per request).
  const prof = profile[0] ?? {};
  const planLive = ["pro", "team"].includes(String(prof.plan)) && (!prof.plan_expires_at || new Date(String(prof.plan_expires_at)) > new Date());
  const whatsapp = planLive
    ? await fetch(`${BRIDGE}/status`, { headers: { "X-Shubhora-User": id, "X-Shubhora-Plan-Expires": String(prof.plan_expires_at || "2999-12-31T00:00:00Z") }, signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    : null;
  const leadCounts = await rows(`leads?owner_id=eq.${id}&select=card_id`, h);
  const p = profile[0] ?? {};
  const providers = (u.app_metadata?.providers ?? [u.app_metadata?.provider]).filter(Boolean) as string[];
  return Response.json({
    auth: {
      id: u.id, email: u.email ?? "", phone: u.phone ?? "", providers, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at, phone_confirmed_at: u.phone_confirmed_at, banned_until: u.banned_until ?? null,
      is_demo: u.user_metadata?.is_demo === true, contact_email: String(u.user_metadata?.contact_email ?? ""),
      name: u.user_metadata?.name || u.user_metadata?.full_name || "", avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || "",
      identities: (u.identities ?? []).map((i: Row) => ({ provider: i.provider, email: (i.identity_data as Row)?.email, phone: (i.identity_data as Row)?.phone, last_sign_in_at: i.last_sign_in_at })),
    },
    profile: p,
    cards: cards.map((c) => ({ ...c, leads: leadCounts.filter((l) => l.card_id === c.id).length, plan: (c.data as Row)?.plan })),
    leads, posterProfiles: pprofiles.map((pp) => ({ ...pp, posters: (posters.find((x) => x.id === pp.id)?.posters as { count: number }[] | undefined)?.[0]?.count ?? 0 })),
    payments, subscriptions: subs, credits: (credits[0]?.balance as number) ?? 0, ledger, devices,
    google: google[0] ?? null, cloud: cloud[0] ?? null, social, agents, jobs,
    whatsapp: whatsapp ?? waSess,
  });
}
