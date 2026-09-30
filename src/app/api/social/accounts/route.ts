// GET (bearer) → { accounts: [...] } without tokens.  DELETE { id } → disconnect.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService, posterQuota } from "@/lib/poster-server";
import { listAccounts, metaConfigured, activateAccount } from "@/lib/social-server";

/** WhatsApp Status free for 14 days (owner's call, 29 Sep 2026): a free account's trial state, from profiles.status_trial_until.
 *  Missing column (SQL not run yet) → null, and nothing else changes. */
async function statusTrial(userId: string, plan: string): Promise<{ free: boolean; until: string | null; active: boolean; days_left: number } | null> {
  const r = await restAsService<{ status_trial_until: string | null }[]>(`profiles?id=eq.${userId}&select=status_trial_until`);
  if (!r.ok || !Array.isArray(r.data)) return null;
  const until = r.data[0]?.status_trial_until ?? null;
  const left = until ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400_000)) : 14;
  return { free: plan === "free", until, active: plan === "free" && (!until || new Date(until).getTime() > Date.now()), days_left: left };
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const rows = await listAccounts(me.id);
  const quota = await posterQuota(me.token, me.id).catch(() => ({ plan: "free", used: 0, limit: 0 }));
  const status_trial = await statusTrial(me.id, quota.plan).catch(() => null);
  return NextResponse.json({
    configured: metaConfigured(),
    plan: quota.plan,
    status_trial,
    accounts: rows.map(({ id, provider, account_id, name, username, picture, status, connected_at, is_active, auto_post, auto_post_profile, auto_reply, plan_on }) => ({ id, provider, account_id, name, username, picture, status, connected_at, is_active, auto_post, auto_post_profile, auto_reply: !!auto_reply, plan_on: plan_on !== false })),
  });
}

export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await restAsService(`social_accounts?id=eq.${id}&user_id=eq.${me.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}

// PATCH { id, action: "activate" } | { id, action: "auto_post", value: bool, profile_id? }
export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (b.action === "wa_enable") {
    const on = !!b.value;
    // a free account switching the daily Status on starts its 14 free days (once; the 4 AM post starts it too if this did not run)
    if (on) { const q = await posterQuota(me.token, me.id).catch(() => null); if (q?.plan === "free") await restAsService(`profiles?id=eq.${me.id}&status_trial_until=is.null`, { method: "PATCH", body: JSON.stringify({ status_trial_until: new Date(Date.now() + 14 * 86400_000).toISOString() }) }).catch(() => null); }
    const rows = await restAsService<{ id: string }[]>(`social_accounts?user_id=eq.${me.id}&provider=eq.whatsapp&select=id`);
    if (rows.data?.[0]) await restAsService(`social_accounts?id=eq.${rows.data[0].id}`, { method: "PATCH", body: JSON.stringify({ auto_post: on, is_active: true, status: "ok" }) });
    else await restAsService("social_accounts", { method: "POST", body: JSON.stringify({ user_id: me.id, provider: "whatsapp", account_id: me.id, name: "WhatsApp Status", username: "", access_token: "-", is_active: true, auto_post: on }) });
    return NextResponse.json({ ok: true });
  }
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (b.action === "activate") {
    const row = await activateAccount(me.id, id);
    return row ? NextResponse.json({ ok: true, account: { id: row.id, provider: row.provider, name: row.name } }) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (b.action === "auto_post") {
    const patch: Record<string, unknown> = { auto_post: !!b.value };
    if (b.profile_id && /^[0-9a-f-]{36}$/i.test(String(b.profile_id))) patch.auto_post_profile = String(b.profile_id);
    await restAsService(`social_accounts?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "plan_on") {
    await restAsService(`social_accounts?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ plan_on: !!b.value }) });
    return NextResponse.json({ ok: true });
  }
  if (b.action === "auto_reply") {
    await restAsService(`social_accounts?id=eq.${id}&user_id=eq.${me.id}`, { method: "PATCH", body: JSON.stringify({ auto_reply: !!b.value }) });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "bad action" }, { status: 400 });
}
