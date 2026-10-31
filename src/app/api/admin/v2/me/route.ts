// Who is logged in to the admin panel (Admin v2). Always answers for a logged-in admin, with what they still have to do:
//   GET ?login=1 → { me, need: null | "mfa_required" | "password_change_required", settings, alerts }
//   PATCH { name? , password_changed?: true } → { ok }   (the person's own row; allowed before the first password change)
import { identify, getSettings, audit, forgetIdentity } from "@/lib/admin-v2";
import { svc, svcCount } from "@/lib/service";

export async function GET(request: Request) {
  const me = await identify(request);
  if (!me) return Response.json({ error: "Please log in to the admin panel.", code: "unauthorized" }, { status: 401 });
  const s = await getSettings();
  const mustMfa = me.via === "session" && (s.enforce_mfa || me.mfaEnrolled) && me.aal !== "aal2";
  const need = mustMfa ? "mfa_required" : me.mustChangePassword ? "password_change_required" : null;
  me.mfaRequired = me.via === "session" && (s.enforce_mfa || me.mfaEnrolled);
  const url = new URL(request.url);
  if (url.searchParams.get("login") === "1" && me.id) {
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 60);
    await svc(`admin_users?id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_login_at: new Date().toISOString(), last_ip: ip }) });
    await audit(me, "admin.login", { type: "staff", id: me.id, label: me.email, note: need ? `pending: ${need}` : "" }, request);
  }
  const alerts = { payouts: 0, pending: 0 };
  if (!need) {
    if (me.rights.includes("franchises.payouts")) alerts.payouts = await svcCount("payouts?status=eq.requested&select=id");
    else if (me.franchise) alerts.payouts = await svcCount(`payouts?franchise_id=eq.${me.franchise.id}&status=in.(requested,approved)&select=id`);
  }
  const { franchiseId: _f, ...pub } = me; void _f;
  return Response.json({ me: pub, need, settings: { enforce_mfa: s.enforce_mfa }, alerts });
}

export async function PATCH(request: Request) {
  const me = await identify(request);
  if (!me) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!me.id) return Response.json({ error: "This login has no admin record to change." }, { status: 400 });
  const b = (await request.json().catch(() => ({}))) as { name?: string; password_changed?: boolean };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
  if (b.password_changed === true) patch.must_change_password = false;
  await svc(`admin_users?id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  forgetIdentity(me.id);
  if (b.password_changed) await audit(me, "admin.password_changed", { type: "staff", id: me.id, label: me.email }, request);
  return Response.json({ ok: true });
}
