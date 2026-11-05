import "server-only";
// Admin v2 — who is calling an /api/admin route and what they may do (owner, 31 Oct 2026). See src/lib/admin-rights.ts.
//   identify(request)     → the admin behind the call (their Shubhora login + their admin_users row), or null
//   requireAdmin(req, r)  → 401 / 403 answers ready to return, or { ok, me }; checks 2-step and the right
//   audit(me, action, …)  → one line in audit_log (never throws)
//   getSettings()         → platform settings with defaults (admin_settings)
// A login is the app's own Supabase session (Bearer / x-owner-token). Its JWT says whether 2-step was done this
// session (aal2). The owner's own e-mails are Super Admin even before a row exists (seeded on first use), so the
// panel never locks the owner out. Two more ways in, both logged as such: a v1 handoff token from the partner panel
// (the owner = Super Admin; a staff member = Live help only) and the emergency password (SUPER_ADMIN_PASSWORD).
import crypto from "node:crypto";
import { SUPA_URL, serviceHeaders, svc } from "@/lib/service";
import { isOwnerEmail } from "@/lib/owner-emails";
import { verifyAdminToken } from "@/lib/admin-token";
import { ALL_RIGHTS, RIGHTS, ROLES, type AdminMe, type Right, type Role } from "@/lib/admin-rights";

/** franchiseId: the login's own franchise ("none" = a franchise login with no live franchise). franchiseIds: every franchise whose users it
 *  may see — its own and its sub-franchises' (migration 0088); null = everyone. */
export type Identity = AdminMe & { franchiseId: string | null; franchiseIds: string[] | null };
export type AdminRow = { id: string; email: string; name: string; phone: string; role: Role; rights: Right[]; franchise_id: string | null; active: boolean; must_change_password: boolean; last_login_at: string | null; created_at: string };
export const ADMIN_COLS = "id,email,name,phone,role,rights,franchise_id,active,must_change_password,last_login_at,last_ip,created_at,updated_at";
type Fr = { id: string; code: string; name: string; can_activate: boolean; status: string; parent_id: string | null };

const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

/* ---------------- the Supabase session ---------------- */
type AuthUser = { id: string; email?: string; phone?: string; user_metadata?: Record<string, unknown>; factors?: { id: string; factor_type: string; status: string }[] };
async function sessionUser(token: string): Promise<AuthUser | null> {
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: anonKey(), Authorization: `Bearer ${token}` }, cache: "no-store" });
    return r.ok ? ((await r.json()) as AuthUser) : null;
  } catch { return null; }
}
/** The assurance level inside the JWT: "aal2" once the authenticator code was entered this session. The token was just
 *  accepted by /auth/v1/user, so its claims can be read without a second verification. */
function jwtAal(token: string): "aal1" | "aal2" {
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { aal?: string };
    return p.aal === "aal2" ? "aal2" : "aal1";
  } catch { return "aal1"; }
}

/* ---------------- rows ---------------- */
export async function adminRow(userId: string): Promise<AdminRow | null> {
  return list(await svc<AdminRow[]>(`admin_users?id=eq.${userId}&select=${ADMIN_COLS}&limit=1`))[0] ?? null;
}
export async function franchiseById(id: string | null): Promise<Fr | null> {
  if (!id) return null;
  return list(await svc<Fr[]>(`franchises?id=eq.${id}&select=id,code,name,can_activate,status,parent_id&limit=1`))[0] ?? null;
}
/** The owner's e-mail opens the panel as Super Admin even before Admin v2 was set up: the row is made on first use. */
async function seedOwner(u: AuthUser): Promise<AdminRow | null> {
  const md = u.user_metadata ?? {};
  const row = { id: u.id, email: u.email ?? "", name: String(md.display_name ?? md.full_name ?? md.name ?? "Owner").slice(0, 80), role: "super_admin", rights: ALL_RIGHTS, active: true };
  await svc("admin_users", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
  return adminRow(u.id);
}
export const rightsOf = (row: Pick<AdminRow, "role" | "rights">): Right[] =>
  row.role === "super_admin" ? ALL_RIGHTS : (row.rights ?? []).filter((r): r is Right => (ALL_RIGHTS as string[]).includes(r));

/** The franchise part of an identity: the franchise, and the ids whose users it sees (its own + its sub-franchises'). */
async function franchiseScope(fr: Fr): Promise<{ franchise: NonNullable<AdminMe["franchise"]>; franchiseIds: string[] }> {
  const subs = fr.parent_id ? [] : list(await svc<{ id: string }[]>(`franchises?parent_id=eq.${fr.id}&status=neq.ended&select=id&limit=500`)).map((r) => r.id);
  return { franchise: { id: fr.id, code: fr.code, name: fr.name, canActivate: fr.can_activate, parentId: fr.parent_id ?? null, subs: subs.length }, franchiseIds: [fr.id, ...subs] };
}

/* ---------------- identify ---------------- */
const cache = new Map<string, { at: number; v: Identity | null }>();
const TTL = 20_000;
function sha(s: string) { return crypto.createHash("sha256").update(s).digest("hex").slice(0, 40); }

export async function identify(request: Request): Promise<Identity | null> {
  const me = await identifyReal(request);
  return me ? viewAsFranchise(me, request) : null;
}

/** "Open as this franchise" (owner, 5 Nov 2026): a Super Admin (anyone with franchises.manage) sends x-admin-view-as: <franchise id>
 *  and the panel answers as that franchise's login would — its users, earnings, payouts, nothing else. Read-only in spirit: every
 *  write still carries the real person in the audit (actor = the admin; `viewAs` tells the panel to show the banner). A franchise
 *  login, or a staff member without the right, is unaffected by the header. */
async function viewAsFranchise(me: Identity, request: Request): Promise<Identity> {
  const want = (request.headers.get("x-admin-view-as") ?? "").trim();
  if (!want || !/^[0-9a-f-]{36}$/i.test(want)) return me;
  // Super Admin (franchises.manage) may open any franchise; a franchise login only its own sub-franchises (owner, 6 Nov 2026).
  if (me.franchise ? want === me.franchise.id : !me.rights.includes("franchises.manage")) return me;
  const fr = await franchiseById(want);
  if (!fr || fr.status === "ended") return me;
  if (me.franchise && fr.parent_id !== me.franchise.id) return me;
  const role = ROLES.find((r) => r.key === "franchise");
  // The panel shows the FRANCHISE's name and login everywhere (owner, 5 Nov 2026: "jis account me login ho uska hi sab kuch dikhe");
  // the real person stays in `viewAs` for the banner and the audit log.
  const login = list(await svc<{ name: string; email: string }[]>(`admin_users?franchise_id=eq.${fr.id}&active=is.true&select=name,email&order=created_at.asc&limit=1`))[0];
  const shownEmail = login?.email ? (/^p91(\d{10})@phone\./.test(login.email) ? login.email.slice(3, 13) : login.email) : "";
  const sc = await franchiseScope(fr);
  return { ...me, name: fr.name, email: shownEmail, role: "franchise", rights: role ? [...role.rights] : [], franchise: sc.franchise, franchiseId: fr.id, franchiseIds: sc.franchiseIds, viewAs: { by: me.viewAs?.by ?? `${me.name || me.email}${me.franchise ? ` (${me.franchise.code})` : me.email && me.name ? ` <${me.email}>` : ""}`, parent: !!me.franchise } };
}

async function identifyReal(request: Request): Promise<Identity | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (request.headers.get("x-owner-token") ?? "").trim();
  if (token && SUPA_URL) {
    const key = `t:${sha(token)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) { if (hit.v) return hit.v; }
    else {
      const u = await sessionUser(token);
      let me: Identity | null = null;
      if (u) {
        const row = (await adminRow(u.id)) ?? (isOwnerEmail(u.email) ? await seedOwner(u) : null);
        if (row && row.active) {
          const fr = await franchiseById(row.franchise_id);
          const enrolled = (u.factors ?? []).some((f) => f.status === "verified");
          const live = fr && fr.status !== "ended" ? await franchiseScope(fr) : null;
          me = {
            id: row.id, email: row.email || u.email || "", name: row.name || (u.email ?? "").split("@")[0], role: row.role, rights: rightsOf(row),
            franchise: live ? live.franchise : null,
            franchiseId: live ? live.franchise.id : row.role === "franchise" ? "none" : null,
            franchiseIds: live ? live.franchiseIds : row.role === "franchise" ? [] : null,
            mfaEnrolled: enrolled, mfaRequired: false, aal: jwtAal(token), mustChangePassword: row.must_change_password, via: "session",
          };
          // A franchise login whose franchise was ended sees nothing of anyone.
          if (row.role === "franchise" && !me.franchise) me.rights = [];
        }
      }
      cache.set(key, { at: Date.now(), v: me });
      if (cache.size > 2000) for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
      if (me) return me;
    }
  }
  // The partner panel's handoff (owner → everything; a staff member → Live help only) and the emergency password.
  const k = (request.headers.get("x-admin-key") ?? "").trim();
  if (!k) return null;
  if (k.startsWith("v1.")) {
    const t = verifyAdminToken(k, "session");
    if (!t) return null;
    return t.scope === "all"
      ? { id: "", email: t.sub, name: t.sub, role: "super_admin", rights: ALL_RIGHTS, franchise: null, franchiseId: null, franchiseIds: null, mfaEnrolled: true, mfaRequired: false, aal: "aal2", mustChangePassword: false, via: "handoff" }
      : { id: "", email: "", name: t.sub || "Staff", role: "support", rights: ["support.live"], franchise: null, franchiseId: null, franchiseIds: null, mfaEnrolled: true, mfaRequired: false, aal: "aal2", mustChangePassword: false, via: "handoff" };
  }
  const want = process.env.SUPER_ADMIN_PASSWORD ?? "";
  const a = Buffer.from(k), b = Buffer.from(want);
  if (want.length >= 12 && a.length === b.length && crypto.timingSafeEqual(a, b)) {
    return { id: "", email: "", name: "Emergency password", role: "super_admin", rights: ALL_RIGHTS, franchise: null, franchiseId: null, franchiseIds: null, mfaEnrolled: true, mfaRequired: false, aal: "aal2", mustChangePassword: false, via: "key" };
  }
  return null;
}
/** Forget a cached identity (after the row changed: rights, active, franchise). */
export function forgetIdentity(userId: string) { for (const [k, v] of cache) if (v.v?.id === userId) cache.delete(k); }

/* ---------------- settings ---------------- */
export type Settings = {
  enforce_mfa: boolean;                 // every admin login must have 2-step done (else they may until they enrol)
  commission_first_pct: number;         // defaults for a new franchise
  commission_renewal_pct: number;
  franchise_can_activate: boolean;
  payout_min_paise: number;             // a payout can be asked for from this balance
  signup_alert: boolean;
};
export const DEFAULT_SETTINGS: Settings = { enforce_mfa: false, commission_first_pct: 20, commission_renewal_pct: 10, franchise_can_activate: false, payout_min_paise: 100000, signup_alert: true };
let settingsCache: { at: number; v: Settings } | null = null;
export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.v;
  const rows = list(await svc<{ key: string; value: unknown }[]>("admin_settings?select=key,value"));
  const v = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) v[r.key] = r.value;
  settingsCache = { at: Date.now(), v: v as Settings };
  return settingsCache.v;
}
export async function setSettings(patch: Partial<Settings>, by: string | null): Promise<Settings> {
  const rows = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS).map(([key, value]) => ({ key, value, updated_by: by || null, updated_at: new Date().toISOString() }));
  if (rows.length) await svc("admin_settings", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  return getSettings(true);
}

/* ---------------- the guard ---------------- */
export type Guard = { ok: true; me: Identity } | { ok: false; res: Response };
const rightLabel = (r: Right) => RIGHTS.find((x) => x.key === r)?.label ?? r;

/** `right`: the right needed (any one of a list). `o.sensitive`: a step that must have 2-step done when the person has it set up
 *  (delete, money, rights). `o.pending`: allowed even before the first password change (the security page itself). */
export async function requireAdmin(request: Request, right?: Right | Right[], o: { sensitive?: boolean; pending?: boolean } = {}): Promise<Guard> {
  const me = await identify(request);
  if (!me) return { ok: false, res: Response.json({ error: "Please log in to the admin panel.", code: "unauthorized" }, { status: 401 }) };
  if (me.via === "session") {
    const s = await getSettings();
    me.mfaRequired = s.enforce_mfa || me.mfaEnrolled;
    if (me.mfaRequired && me.aal !== "aal2" && (me.mfaEnrolled || s.enforce_mfa)) {
      return { ok: false, res: Response.json({ error: me.mfaEnrolled ? "Enter your 2-step code to continue." : "2-step verification is required for admin logins. Set it up to continue.", code: "mfa_required", enrolled: me.mfaEnrolled }, { status: 403 }) };
    }
    if (me.mustChangePassword && !o.pending) return { ok: false, res: Response.json({ error: "Set your own password first.", code: "password_change_required" }, { status: 403 }) };
    if (o.sensitive && me.mfaEnrolled && me.aal !== "aal2") return { ok: false, res: Response.json({ error: "Enter your 2-step code for this.", code: "mfa_required", enrolled: true }, { status: 403 }) };
  }
  if (right) {
    const need = Array.isArray(right) ? right : [right];
    if (!need.some((r) => me.rights.includes(r))) {
      return { ok: false, res: Response.json({ error: `You do not have the right to do this (${need.map(rightLabel).join(" / ")}). Ask the Super Admin.`, code: "forbidden" }, { status: 403 }) };
    }
  }
  return { ok: true, me };
}

/* ---------------- scope ---------------- */
/** A franchise login sees only its own users. null = everyone. "none" = a franchise login with no franchise → nobody. */
/** null = everyone; otherwise the franchise ids whose users this login sees (its own + its sub-franchises'; [] = nobody). */
export const scopeOf = (me: Identity): string[] | null => me.franchiseIds;
/** A PostgREST filter for the users in scope: "" (everyone) or "&franchise_id=in.(…)" (or one that matches nothing). */
export const scopeFilter = (me: Identity, col = "franchise_id"): string =>
  !me.franchiseIds ? "" : me.franchiseIds.length ? `&${col}=in.(${me.franchiseIds.join(",")})` : `&${col}=eq.00000000-0000-0000-0000-000000000000`;
export async function userInScope(me: Identity, userId: string): Promise<boolean> {
  if (!me.franchiseIds) return true;
  if (!me.franchiseIds.length) return false;
  const row = list(await svc<{ franchise_id: string | null }[]>(`profiles?id=eq.${userId}&select=franchise_id&limit=1`))[0];
  return !!row?.franchise_id && me.franchiseIds.includes(row.franchise_id);
}

/* ---------------- audit ---------------- */
export type AuditTarget = { type?: string; id?: string; label?: string; before?: unknown; after?: unknown; note?: string };
export async function audit(me: Identity | null, action: string, t: AuditTarget = {}, request?: Request): Promise<void> {
  try {
    const ip = request ? (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 60) : "";
    const ua = request ? (request.headers.get("user-agent") ?? "").slice(0, 160) : "";
    await svc("audit_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      actor_id: me?.id || null, actor_email: me?.viewAs ? `${me.viewAs.by} (as ${me.franchise?.code ?? "franchise"})` : (me?.email || me?.name || ""), actor_role: me ? (me.via === "session" ? me.role : `${me.role} (${me.via})`) : "system",
      action, target_type: t.type ?? "", target_id: String(t.id ?? ""), target_label: String(t.label ?? "").slice(0, 160),
      before: t.before ?? null, after: t.after ?? null, note: String(t.note ?? "").slice(0, 500), ip, ua,
    }) });
  } catch { /* an audit line that fails never fails the action */ }
}

/* ---------------- auth users (for staff logins) ---------------- */
export const phoneEmail = (mobile: string) => `p91${mobile}@phone.neuraledge.me`;
/** "9876543210" / "+91 98765 43210" → the app's login address for it; an e-mail stays an e-mail; "" when neither. */
export function loginAddress(login: string): string {
  const s = login.trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return s;
  const d = s.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? phoneEmail(d) : "";
}
type GoUser = { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string };
export async function findAuthUser(email: string): Promise<GoUser | null> {
  const h = serviceHeaders();
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(email)}`, { headers: h, cache: "no-store" });
    const j = r.ok ? ((await r.json()) as { users?: GoUser[] }) : { users: [] };
    const hit = (j.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    // Older GoTrue ignores `filter`: look through the pages (only when the filter found nothing).
    for (let page = 1; page <= 20; page++) {
      const p = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: h, cache: "no-store" });
      if (!p.ok) break;
      const us = ((await p.json()) as { users?: GoUser[] }).users ?? [];
      const f = us.find((u) => (u.email ?? "").toLowerCase() === email);
      if (f) return f;
      if (us.length < 1000) break;
    }
  } catch { /* not found */ }
  return null;
}
export function tempPassword(): string {
  const words = ["Shubh", "Ora", "Admin", "Team", "Work", "Desk"];
  return `${words[Math.floor(Math.random() * words.length)]}-${crypto.randomBytes(3).toString("hex")}-${Math.floor(100 + Math.random() * 900)}`;
}
/** Makes the login (e-mail confirmed, a temporary password) or sets a new temporary password on an existing one. */
export async function createOrResetAuthUser(email: string, name: string, phone: string, chosen?: string): Promise<{ id: string; password: string; created: boolean } | { error: string }> {
  const h = serviceHeaders();
  const password = chosen && chosen.length >= 8 ? chosen : tempPassword();
  const have = await findAuthUser(email);
  if (have) {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${have.id}`, { method: "PUT", headers: h, body: JSON.stringify({ password }) });
    return r.ok ? { id: have.id, password, created: false } : { error: "Could not set a password on that account." };
  }
  const body = { email, password, email_confirm: true, user_metadata: { full_name: name, display_name: name, ...(phone ? { phone } : {}) } };
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { id?: string; msg?: string; message?: string };
  if (!r.ok || !j.id) return { error: j.msg || j.message || "Could not create the login." };
  return { id: j.id, password, created: true };
}
/** The login with a password the person chose themselves (kept only as a bcrypt hash — GoTrue takes `password_hash`). An account that
 *  already exists for that address keeps its own password. */
export async function createAuthUserWithHash(email: string, name: string, phone: string, passwordHash: string): Promise<{ id: string; created: boolean } | { error: string }> {
  const have = await findAuthUser(email);
  if (have) return { id: have.id, created: false };
  if (!/^\$2[aby]\$\d\d\$/.test(passwordHash)) return { error: "No password was set in the application." };
  const body = { email, password_hash: passwordHash, email_confirm: true, user_metadata: { full_name: name, display_name: name, ...(phone ? { phone } : {}) } };
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: "POST", headers: serviceHeaders(), body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { id?: string; msg?: string; message?: string };
  if (!r.ok || !j.id) return { error: j.msg || j.message || "Could not create the login." };
  return { id: j.id, created: true };
}
/** Removes every 2-step factor of an account (they set it up again on next login). */
export async function resetFactors(userId: string): Promise<boolean> {
  const h = serviceHeaders();
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}/factors`, { headers: h, cache: "no-store" });
    const fs = r.ok ? ((await r.json()) as { id: string }[]) : [];
    for (const f of fs) await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}/factors/${f.id}`, { method: "DELETE", headers: h });
    return true;
  } catch { return false; }
}
export { ROLES };
