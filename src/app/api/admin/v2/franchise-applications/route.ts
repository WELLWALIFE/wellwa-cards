// Franchise applications (Admin v2; owner, 1 Nov 2026: "site per become a franchise, form, admin approve kare tab start").
//   GET  ?status=new|contacted|approved|rejected|all → { applications }                      ("franchises.view"; not for a franchise login)
//   PATCH { id, status?: new|contacted|rejected, note? } → { application }                   ("franchises.manage")
//   POST  { id, code, login?, commission_first_pct?, commission_renewal_pct?, can_activate?, company?, email?, area?, city?, state? }
//         → approve: the franchise row, its Franchise-role login with the password the applicant chose in the form (bcrypt hash, 0081;
//           an existing Shubhora account keeps its own password), the application marked approved
//         → { franchise, login, created, hasAccount, loginError, message }                     ("franchises.manage", sensitive)
import { requireAdmin, audit, getSettings, createAuthUserWithHash, loginAddress, adminRow, ADMIN_COLS, type AdminRow } from "@/lib/admin-v2";
import { ROLES } from "@/lib/admin-rights";
import { svc } from "@/lib/service";
import { cleanCode, franchisePatch, FR_COLS, type FranchiseRow } from "@/lib/franchise-server";
import { APP_COLS, type ApplicationStatus, type FranchiseApplication } from "@/lib/franchise-apply";
import { SITE_URL } from "@/lib/site-url";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const STATUSES: ApplicationStatus[] = ["new", "contacted", "approved", "rejected"];

export async function GET(request: Request) {
  const g = await requireAdmin(request, "franchises.view"); if (!g.ok) return g.res;
  if (g.me.franchise) return Response.json({ error: "Not for a franchise login." }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status") ?? "all";
  const f = STATUSES.includes(status as ApplicationStatus) ? `&status=eq.${status}` : "";
  const r = await svc<FranchiseApplication[]>(`franchise_applications?select=${APP_COLS}${f}&order=created_at.desc&limit=500`);
  if (!r.ok) return Response.json({ error: /franchise_applications/.test(r.text) ? "Run migration 0080 in Supabase (franchise applications)." : "Could not load." }, { status: 502 });
  return Response.json({ applications: list(r) });
}

export async function PATCH(request: Request) {
  const g = await requireAdmin(request, "franchises.manage"); if (!g.ok) return g.res;
  const { me } = g;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isUuid(b.id)) return Response.json({ error: "Which application?" }, { status: 400 });
  const was = list(await svc<FranchiseApplication[]>(`franchise_applications?id=eq.${b.id}&select=${APP_COLS}&limit=1`))[0];
  if (!was) return Response.json({ error: "Application not found." }, { status: 404 });
  if (was.status === "approved") return Response.json({ error: "This application is already approved — change the franchise itself." }, { status: 409 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("note" in b) patch.note = String(b.note ?? "").trim().slice(0, 2000);
  if ("status" in b) {
    const st = String(b.status);
    if (!["new", "contacted", "rejected"].includes(st)) return Response.json({ error: "Approve with the Approve button." }, { status: 400 });
    patch.status = st;
    if (st === "rejected") { patch.decided_by = me.id || null; patch.decided_at = new Date().toISOString(); }
  }
  const row = list(await svc<FranchiseApplication[]>(`franchise_applications?id=eq.${b.id}&select=${APP_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }))[0];
  if (!row) return Response.json({ error: "Could not save." }, { status: 502 });
  if (patch.status && patch.status !== was.status) await audit(me, `franchise_application.${patch.status}`, { type: "franchise", id: row.id, label: `${row.name} · ${row.city}`, before: { status: was.status }, after: { status: patch.status } }, request);
  return Response.json({ application: row });
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, "franchises.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isUuid(b.id)) return Response.json({ error: "Which application?" }, { status: 400 });
  const app = list(await svc<FranchiseApplication[]>(`franchise_applications?id=eq.${b.id}&select=${APP_COLS}&limit=1`))[0];
  if (!app) return Response.json({ error: "Application not found." }, { status: 404 });
  if (app.status === "approved" && app.franchise_id) return Response.json({ error: "Already approved." }, { status: 409 });
  const code = cleanCode(b.code);
  if (!/^[A-Z0-9]{3,16}$/.test(code)) return Response.json({ error: "Code: 3–16 letters / digits, e.g. AJMER01." }, { status: 400 });
  const login = loginAddress(String(b.login ?? app.phone.replace(/^\+91/, "")));
  if (!login) return Response.json({ error: "Write a valid e-mail or 10-digit mobile for the login." }, { status: 400 });

  // 1 · the franchise, from the application plus what the admin changed on the approval form
  const s = await getSettings();
  const p = franchisePatch({
    name: app.name, phone: app.phone, email: app.email, company: app.company, city: app.city, state: app.state, area: app.area, notes: `From the website application of ${app.created_at.slice(0, 10)}.${app.background ? ` Background: ${app.background}` : ""}`.slice(0, 2000),
    ...b, code: undefined, id: undefined, login: undefined,
  }, { first: s.commission_first_pct, renewal: s.commission_renewal_pct });
  if (!p.name || !p.phone) return Response.json({ error: "The application has no name or mobile." }, { status: 400 });
  const row = { code, commission_first_pct: s.commission_first_pct, commission_renewal_pct: s.commission_renewal_pct, can_activate: s.franchise_can_activate, ...p, status: "active", created_by: me.id || null };
  const fr = list(await svc<FranchiseRow[]>(`franchises?select=${FR_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) }))[0];
  if (!fr) {
    const taken = !!list(await svc<{ id: string }[]>(`franchises?code=eq.${code}&select=id&limit=1`)).length;
    return Response.json({ error: taken ? `The code ${code} is already taken — choose another.` : "Could not create the franchise." }, { status: taken ? 409 : 502 });
  }
  await audit(me, "franchise.create", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}`, after: row, note: `approved application ${app.id}` }, request);

  // 2 · its login (Franchise role) with the password they chose in the application; a mobile that already had a Shubhora login keeps its password
  const phone = /^p91(\d{10})@phone\./.test(login) ? login.slice(3, 13) : app.phone.replace(/\D/g, "").slice(-10);
  const secret = list(await svc<{ password_hash: string }[]>(`franchise_applications?id=eq.${app.id}&select=password_hash&limit=1`))[0]?.password_hash ?? "";
  const auth = await createAuthUserWithHash(login, app.name, phone, secret);
  let created = false, loginError = "";
  if ("error" in auth) loginError = auth.error;
  else {
    const have = await adminRow(auth.id);
    if (have) loginError = `${have.name || have.email} already has admin access (${have.role}) — give them this franchise under Staff & roles.`;
    else {
      const member = list(await svc<AdminRow[]>(`admin_users?select=${ADMIN_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id: auth.id, email: login, name: app.name, phone, role: "franchise", rights: ROLES.find((r) => r.key === "franchise")!.rights, franchise_id: fr.id, active: true, must_change_password: false, created_by: me.id || null }) }))[0];
      if (!member) loginError = "Could not make the login — make it under Logins on the franchise page.";
      else {
        created = auth.created;
        await svc(`franchises?id=eq.${fr.id}&owner_user_id=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_user_id: auth.id }) });
        await audit(me, "staff.create", { type: "staff", id: member.id, label: `${app.name} <${login}>`, after: { role: "franchise", franchise_id: fr.id } }, request);
      }
    }
  }
  // The hash has done its work: it is not kept.
  await svc(`franchise_applications?id=eq.${app.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ password_hash: "" }) });

  // 3 · the application is done
  await svc(`franchise_applications?id=eq.${app.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "approved", franchise_id: fr.id, decided_by: me.id || null, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  await audit(me, "franchise_application.approved", { type: "franchise", id: app.id, label: `${app.name} · ${app.city}`, after: { franchise_id: fr.id, code } }, request);

  const shownLogin = /^p91(\d{10})@phone\./.test(login) ? login.slice(3, 13) : login;
  const hasAccount = !("error" in auth) && !auth.created;
  const message = [
    `Namaste ${app.name.split(" ")[0]} ji 🙏`, `Welcome to the Shubhora franchise family — *${fr.code}* (${[fr.area || fr.city, fr.state].filter(Boolean).join(", ")}) is yours.`, "",
    `*Your franchise panel*`, `${SITE_URL}/admin/login`, `User: ${shownLogin}`, hasAccount ? "Password: the one of your Shubhora account" : "Password: the one you set in your application", "At the first login, set up 2-step verification (authenticator app).", "",
    `*Your sign-up link* — every business that joins through it is your customer:`, `${SITE_URL}/start?f=${fr.code}`, "",
    `Commission: ${fr.commission_first_pct}% on the first payment, ${fr.commission_renewal_pct}% on renewals (on the amount without GST). Earnings and payouts show in your panel.`,
  ].join("\n");
  return Response.json({ franchise: fr, login: shownLogin, created, hasAccount, loginError, message });
}
