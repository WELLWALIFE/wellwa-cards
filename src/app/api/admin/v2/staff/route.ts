// Staff & roles (Admin v2): the people who may open the admin panel and what each may do. Needs "staff.manage".
//   GET → { staff, franchises }
//   POST { login (e-mail or mobile), name, role, rights?, franchise_id? } → { member, password? }  password: shown ONCE when a new login was made
//   POST { op: "reset_password" | "reset_mfa", id } → { ok, password? }
//   PATCH { id, name?, role?, rights?, active?, franchise_id? } → { member }
//   DELETE ?id= → { ok }   (removes the admin access; the Shubhora account itself stays)
import { requireAdmin, audit, forgetIdentity, createOrResetAuthUser, loginAddress, resetFactors, adminRow, ADMIN_COLS, type AdminRow } from "@/lib/admin-v2";
import { ALL_RIGHTS, ROLES, type Right, type Role } from "@/lib/admin-rights";
import { svc } from "@/lib/service";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ROLE_KEYS = ROLES.map((r) => r.key);
const rightsOf = (v: unknown): Right[] => (Array.isArray(v) ? v.filter((r): r is Right => (ALL_RIGHTS as string[]).includes(r)) : []);
const view = (r: AdminRow) => ({ ...r, rights: r.role === "super_admin" ? ALL_RIGHTS : r.rights });

export async function GET(request: Request) {
  const g = await requireAdmin(request, "staff.manage"); if (!g.ok) return g.res;
  const [rows, frs] = await Promise.all([
    svc<AdminRow[]>(`admin_users?select=${ADMIN_COLS}&order=created_at`),
    svc<{ id: string; code: string; name: string }[]>("franchises?select=id,code,name&status=neq.ended&order=code"),
  ]);
  return Response.json({ staff: list(rows).map(view), franchises: list(frs) });
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, "staff.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.op === "reset_password" || b.op === "reset_mfa") {
    if (!isUuid(b.id)) return Response.json({ error: "Bad id." }, { status: 400 });
    const row = await adminRow(b.id); if (!row) return Response.json({ error: "Not found." }, { status: 404 });
    if (row.role === "super_admin" && me.role !== "super_admin") return Response.json({ error: "Only a Super Admin can do this for a Super Admin." }, { status: 403 });
    if (b.op === "reset_mfa") {
      if (!(await resetFactors(row.id))) return Response.json({ error: "Could not reset 2-step." }, { status: 502 });
      forgetIdentity(row.id);
      await audit(me, "staff.reset_mfa", { type: "staff", id: row.id, label: row.email }, request);
      return Response.json({ ok: true });
    }
    const r = await createOrResetAuthUser(row.email, row.name, row.phone);
    if ("error" in r) return Response.json({ error: r.error }, { status: 502 });
    await svc(`admin_users?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ must_change_password: true, updated_at: new Date().toISOString() }) });
    forgetIdentity(row.id);
    await audit(me, "staff.reset_password", { type: "staff", id: row.id, label: row.email }, request);
    return Response.json({ ok: true, password: r.password });
  }
  const email = loginAddress(String(b.login ?? ""));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const role = String(b.role ?? "custom") as Role;
  if (!email) return Response.json({ error: "Write a valid e-mail or 10-digit mobile for the login." }, { status: 400 });
  if (!name) return Response.json({ error: "Write the person's name." }, { status: 400 });
  if (!ROLE_KEYS.includes(role)) return Response.json({ error: "Unknown role." }, { status: 400 });
  if (role === "super_admin" && me.role !== "super_admin") return Response.json({ error: "Only a Super Admin can make a Super Admin." }, { status: 403 });
  const franchise_id = role === "franchise" ? (isUuid(b.franchise_id) ? b.franchise_id : null) : null;
  if (role === "franchise" && !franchise_id) return Response.json({ error: "Pick the franchise this login belongs to." }, { status: 400 });
  const phone = /^p91(\d{10})@phone\./.test(email) ? email.slice(3, 13) : String(b.phone ?? "").replace(/\D/g, "").slice(-10);
  const auth = await createOrResetAuthUser(email, name, phone);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: 502 });
  const have = await adminRow(auth.id);
  if (have) return Response.json({ error: `${have.name || have.email} already has admin access (${have.role}). Change it in the list.` }, { status: 409 });
  const rights = role === "custom" ? rightsOf(b.rights) : (Array.isArray(b.rights) && b.rights.length ? rightsOf(b.rights) : ROLES.find((r) => r.key === role)!.rights);
  const row = { id: auth.id, email, name, phone, role, rights, franchise_id, active: true, must_change_password: true, created_by: me.id || null };
  const r = await svc<AdminRow[]>(`admin_users?select=${ADMIN_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const member = list(r)[0];
  if (!member) return Response.json({ error: /admin_users/.test(r.text) ? "Admin v2 is not set up yet — run migration 0078 in Supabase." : "Could not save." }, { status: 502 });
  if (franchise_id) await svc(`franchises?id=eq.${franchise_id}&owner_user_id=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_user_id: auth.id }) });
  await audit(me, "staff.create", { type: "staff", id: member.id, label: `${name} <${email}>`, after: { role, rights, franchise_id } }, request);
  return Response.json({ member: view(member), password: auth.password, created: auth.created });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin(request, "staff.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isUuid(b.id)) return Response.json({ error: "Bad id." }, { status: 400 });
  const was = await adminRow(b.id); if (!was) return Response.json({ error: "Not found." }, { status: 404 });
  if (was.role === "super_admin" && me.role !== "super_admin") return Response.json({ error: "Only a Super Admin can change a Super Admin." }, { status: 403 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
  if (typeof b.role === "string" && ROLE_KEYS.includes(b.role as Role)) {
    if (b.role === "super_admin" && me.role !== "super_admin") return Response.json({ error: "Only a Super Admin can make a Super Admin." }, { status: 403 });
    patch.role = b.role;
    if (!("rights" in b)) patch.rights = ROLES.find((r) => r.key === b.role)!.rights;
  }
  if ("rights" in b) patch.rights = rightsOf(b.rights);
  if (typeof b.active === "boolean") patch.active = b.active;
  if ("franchise_id" in b) patch.franchise_id = isUuid(b.franchise_id) ? b.franchise_id : null;
  // Nobody locks themselves (or the last Super Admin) out.
  const role = (patch.role as Role | undefined) ?? was.role, active = (patch.active as boolean | undefined) ?? was.active;
  if (was.id === me.id && (role !== "super_admin" && was.role === "super_admin" || !active)) return Response.json({ error: "You cannot remove your own Super Admin access." }, { status: 400 });
  if (was.role === "super_admin" && (role !== "super_admin" || !active)) {
    const others = list(await svc<{ id: string }[]>(`admin_users?role=eq.super_admin&active=is.true&id=neq.${was.id}&select=id&limit=1`)).length;
    if (!others) return Response.json({ error: "This is the only Super Admin. Make another one first." }, { status: 400 });
  }
  const r = await svc<AdminRow[]>(`admin_users?id=eq.${was.id}&select=${ADMIN_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
  const member = list(r)[0]; if (!member) return Response.json({ error: "Could not save." }, { status: 502 });
  forgetIdentity(was.id);
  await audit(me, "staff.update", { type: "staff", id: was.id, label: was.email, before: { role: was.role, rights: was.rights, active: was.active, franchise_id: was.franchise_id }, after: { role: member.role, rights: member.rights, active: member.active, franchise_id: member.franchise_id } }, request);
  return Response.json({ member: view(member) });
}

export async function DELETE(request: Request) {
  const g = await requireAdmin(request, "staff.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const id = new URL(request.url).searchParams.get("id");
  if (!isUuid(id)) return Response.json({ error: "Bad id." }, { status: 400 });
  const was = await adminRow(id); if (!was) return Response.json({ ok: true });
  if (was.id === me.id) return Response.json({ error: "You cannot remove yourself." }, { status: 400 });
  if (was.role === "super_admin" && me.role !== "super_admin") return Response.json({ error: "Only a Super Admin can remove a Super Admin." }, { status: 403 });
  await svc(`admin_users?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  forgetIdentity(id);
  await audit(me, "staff.remove", { type: "staff", id, label: was.email, before: { role: was.role } }, request);
  return Response.json({ ok: true });
}
