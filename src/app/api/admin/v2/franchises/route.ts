// Franchises (Admin v2). "franchises.view" to see (a franchise login sees only its own), "franchises.manage" to create.
//   GET → { franchises: [{ …row, users, paid, balance, pendingPayouts, loginEmail }], settings }
//   POST { code, name, company?, phone, email?, area?, city?, state?, commission_first_pct?, commission_renewal_pct?, can_activate?, … } → { franchise }
//   POST as a franchise login, or with parent_id from Super Admin → a SUB-FRANCHISE under it (migration 0088; owner, 6 Nov 2026): its
//        percents and "may activate plans" never above the parent's, one level only; { password } makes its panel login (mobile + password).
import { requireAdmin, audit, getSettings, findAuthUser, createOrResetAuthUser, loginAddress, adminRow } from "@/lib/admin-v2";
import { ROLES } from "@/lib/admin-rights";
import { svc } from "@/lib/service";
import { cleanCode, franchisePatch, FR_COLS, type FranchiseRow } from "@/lib/franchise-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
export async function GET(request: Request) {
  const g = await requireAdmin(request, "franchises.view"); if (!g.ok) return g.res;
  const { me } = g;
  // ?payouts=1 → every payout waiting (and the latest decided), across franchises — the Payouts tab ("franchises.payouts").
  if (new URL(request.url).searchParams.get("payouts") === "1") {
    if (!me.rights.includes("franchises.payouts")) return Response.json({ error: "You do not have the right to see payouts." }, { status: 403 });
    const [open, done, frs] = await Promise.all([
      svc<Record<string, unknown>[]>("payouts?status=in.(requested,approved)&select=id,franchise_id,amount_paise,status,note,requested_at&order=requested_at"),
      svc<Record<string, unknown>[]>("payouts?status=in.(paid,rejected)&select=*&order=decided_at.desc&limit=50"),
      svc<{ id: string; code: string; name: string; bank: Record<string, string>; kyc: { status?: string } | null }[]>("franchises?select=id,code,name,bank,kyc"),
    ]);
    const fm = new Map(list(frs).map((f) => [f.id, { id: f.id, code: f.code, name: f.name, bank: f.bank, kyc: f.kyc?.status ?? "none" }]));
    const dress = (p: Record<string, unknown>) => ({ ...p, franchise: fm.get(String(p.franchise_id)) ?? null });
    return Response.json({ open: list(open).map(dress), done: list(done).map(dress) });
  }
  // ?board=YYYY-MM → the month's leaderboard: new users, payments, sales (amount without GST), target, earnings — Super Admin sees all,
  // a franchise login sees itself and its sub-franchises.
  const board = new URL(request.url).searchParams.get("board");
  if (board && /^\d{4}-\d{2}$/.test(board)) return Response.json(await leaderboard(me, board));
  const own = me.franchise ? `&id=in.(${(me.franchiseIds?.length ? me.franchiseIds : [me.franchise.id]).join(",")})` : "";
  const [frs, counts, paid, ledger, pend, logins, s] = await Promise.all([
    svc<FranchiseRow[]>(`franchises?select=${FR_COLS}${own}&order=created_at.desc`),
    svc<{ franchise_id: string; franchise_joined_at: string | null }[]>(`profiles?franchise_id=not.is.null${me.franchise ? `&franchise_id=in.(${(me.franchiseIds?.length ? me.franchiseIds : [me.franchise.id]).join(",")})` : ""}&select=franchise_id,franchise_joined_at&limit=50000`),
    // "Paid" = a running growth plan OR a plan with an end date ahead (website / package set by an admin) — same as the dashboard.
    svc<{ franchise_id: string }[]>(`profiles?franchise_id=not.is.null&or=(and(saas_tier.neq.none,saas_expires_at.gte.${new Date().toISOString()}),plan_expires_at.gte.${new Date().toISOString()})&select=franchise_id&limit=50000`),
    svc<{ franchise_id: string; kind: string; amount_paise: number }[]>(`franchise_ledger?select=franchise_id,kind,amount_paise&limit=50000`),
    svc<{ franchise_id: string; amount_paise: number }[]>(`payouts?status=in.(requested,approved)&select=franchise_id,amount_paise`),
    svc<{ franchise_id: string; email: string; active: boolean }[]>(`admin_users?franchise_id=not.is.null&select=franchise_id,email,active`),
    getSettings(),
  ]);
  if (!frs.ok) return Response.json({ error: /franchises/.test(frs.text) ? "Admin v2 is not set up yet — run migration 0078 in Supabase." : "Could not load." }, { status: 502 });
  const by = <T extends { franchise_id: string }>(rows: T[]) => rows.reduce((m, r) => (m.set(r.franchise_id, [...(m.get(r.franchise_id) ?? []), r]), m), new Map<string, T[]>());
  const c = by(list(counts)), pd = by(list(paid)), lg = by(list(ledger)), pn = by(list(pend)), lo = by(list(logins));
  const out = list(frs).map((f) => {
    const rows = lg.get(f.id) ?? [];
    const earned = rows.filter((r) => r.kind === "earning").reduce((a, r) => a + Number(r.amount_paise), 0);
    const balance = rows.reduce((a, r) => a + Number(r.amount_paise), 0);
    // Last time a user joined through it (or when it was made): "quiet" after 30 days without a new user (owner, 6 Nov 2026).
    const lastJoin = (c.get(f.id) ?? []).reduce((m, u) => (u.franchise_joined_at && u.franchise_joined_at > m ? u.franchise_joined_at : m), "");
    const since = lastJoin || String(f.created_at ?? "");
    const quietDays = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000) : 0;
    return { ...f, bank: me.franchise ? undefined : f.bank, kyc: (f.kyc as { status?: string } | null)?.status ?? "none", lastJoin: lastJoin || null, quietDays, users: (c.get(f.id) ?? []).length, paid: (pd.get(f.id) ?? []).length, earned, balance, pendingPayouts: (pn.get(f.id) ?? []).reduce((a, r) => a + Number(r.amount_paise), 0), logins: (lo.get(f.id) ?? []).map((l) => ({ email: l.email, active: l.active })) };
  });
  return Response.json({ franchises: out, settings: { first: s.commission_first_pct, renewal: s.commission_renewal_pct, canActivate: s.franchise_can_activate, payoutMin: s.payout_min_paise } });
}

async function leaderboard(me: { franchise?: { id: string } | null; franchiseIds?: string[] | null }, month: string) {
  const from = new Date(`${month}-01T00:00:00+05:30`), to = new Date(from); to.setMonth(to.getMonth() + 1);
  const ids = me.franchise ? (me.franchiseIds?.length ? me.franchiseIds : [me.franchise.id]) : null;
  const scope = ids ? `&franchise_id=in.(${ids.join(",")})` : "";
  const range = (col: string) => `${col}=gte.${from.toISOString()}&${col}=lt.${to.toISOString()}`;
  const [frs, joined, led] = await Promise.all([
    svc<FranchiseRow[]>(`franchises?select=id,code,name,city,status,parent_id,target_paise,commission_first_pct,commission_renewal_pct${ids ? `&id=in.(${ids.join(",")})` : ""}&status=neq.ended&order=code`),
    svc<{ franchise_id: string }[]>(`profiles?franchise_id=not.is.null${scope}&${range("franchise_joined_at")}&select=franchise_id&limit=50000`),
    svc<{ franchise_id: string; user_id: string | null; amount_paise: number; base_paise: number | null; note: string; payment_ref: string }[]>(`franchise_ledger?kind=eq.earning${scope}&${range("at")}&select=franchise_id,user_id,amount_paise,base_paise,note,payment_ref&limit=50000`),
  ]);
  const rows = list(frs).map((f) => {
    const mine = list(led).filter((l) => l.franchise_id === f.id);
    const own = mine.filter((l) => !String(l.note).startsWith("Override"));
    const sales = own.reduce((a, l) => a + Number(l.base_paise ?? 0), 0);
    return {
      id: f.id, code: f.code, name: f.name, city: f.city, status: f.status, parent_id: f.parent_id ?? null, target_paise: Number(f.target_paise) || 0,
      newUsers: list(joined).filter((j) => j.franchise_id === f.id).length,
      payments: new Set(own.map((l) => l.payment_ref)).size, sales,
      earned: own.reduce((a, l) => a + Number(l.amount_paise), 0),
      override: mine.filter((l) => String(l.note).startsWith("Override")).reduce((a, l) => a + Number(l.amount_paise), 0),
    };
  });
  return { month, rows };
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, ["franchises.manage", "franchises.view"], { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = await getSettings();
  // Who is the parent: a franchise login makes sub-franchises under itself; Super Admin may pass parent_id; else a top-level franchise.
  let parent: FranchiseRow | null = null;
  if (me.franchise) {
    if (me.franchise.parentId) return Response.json({ error: "A sub-franchise cannot make sub-franchises." }, { status: 403 });
    parent = list(await svc<FranchiseRow[]>(`franchises?id=eq.${me.franchise.id}&select=${FR_COLS}&limit=1`))[0] ?? null;
    if (!parent || parent.status !== "active") return Response.json({ error: "Your franchise is not active." }, { status: 403 });
  } else {
    if (!me.rights.includes("franchises.manage")) return Response.json({ error: "You do not have the right to create franchises." }, { status: 403 });
    if (typeof b.parent_id === "string" && /^[0-9a-f-]{36}$/i.test(b.parent_id)) {
      parent = list(await svc<FranchiseRow[]>(`franchises?id=eq.${b.parent_id}&select=${FR_COLS}&limit=1`))[0] ?? null;
      if (!parent) return Response.json({ error: "Parent franchise not found." }, { status: 404 });
      if (parent.parent_id) return Response.json({ error: "That franchise is itself a sub-franchise — only one level is allowed." }, { status: 400 });
    }
  }
  const code = cleanCode(b.code);
  if (!/^[A-Z0-9]{3,16}$/.test(code)) return Response.json({ error: "Code: 3–16 letters / digits, e.g. JAIPUR01." }, { status: 400 });
  const p = franchisePatch(b, { first: s.commission_first_pct, renewal: s.commission_renewal_pct });
  if (!p.name) return Response.json({ error: "Write the franchise owner's name." }, { status: 400 });
  if (!p.phone) return Response.json({ error: "Write their mobile number." }, { status: 400 });
  const row: Record<string, unknown> = { code, commission_first_pct: s.commission_first_pct, commission_renewal_pct: s.commission_renewal_pct, can_activate: s.franchise_can_activate, ...p, created_by: me.id || null };
  if (parent) {
    // A sub-franchise: never more than its parent earns or may do; the parent keeps the difference as its override.
    row.parent_id = parent.id;
    const first = Number(row.commission_first_pct), renewal = Number(row.commission_renewal_pct);
    if (!("commission_first_pct" in p) || first > Number(parent.commission_first_pct)) row.commission_first_pct = Math.min(first, Number(parent.commission_first_pct));
    if (!("commission_renewal_pct" in p) || renewal > Number(parent.commission_renewal_pct)) row.commission_renewal_pct = Math.min(renewal, Number(parent.commission_renewal_pct));
    if ("commission_first_pct" in p && first > Number(parent.commission_first_pct)) return Response.json({ error: `First-payment commission can be at most ${parent.commission_first_pct}% (the parent's).` }, { status: 400 });
    if ("commission_renewal_pct" in p && renewal > Number(parent.commission_renewal_pct)) return Response.json({ error: `Renewal commission can be at most ${parent.commission_renewal_pct}% (the parent's).` }, { status: 400 });
    if (!parent.can_activate) row.can_activate = false;
    if (me.franchise) row.status = "active";
  }
  const password = typeof b.password === "string" ? b.password : "";
  const login = loginAddress(String(b.login ?? p.phone ?? ""));
  if (me.franchise && !login) return Response.json({ error: "Write the sub-franchise's 10-digit mobile for its login." }, { status: 400 });
  const existing = login ? await findAuthUser(login).catch(() => null) : null;
  if (me.franchise && !existing && password.length < 8) return Response.json({ error: "Choose a login password of at least 8 characters for the sub-franchise." }, { status: 400 });
  if (existing && (await adminRow(existing.id))) return Response.json({ error: "That mobile already has an admin / franchise login. Use another mobile." }, { status: 409 });

  const r = await svc<FranchiseRow[]>(`franchises?select=${FR_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const fr = list(r)[0];
  if (!fr) return Response.json({ error: r.status === 409 || /duplicate|unique/i.test(r.text) ? `The code ${code} is already taken.` : /parent_id/.test(r.text) ? "Run migration 0088 in Supabase (sub-franchises)." : /franchises/.test(r.text) ? "Admin v2 is not set up yet — run migration 0078 in Supabase." : "Could not save." }, { status: r.status === 409 ? 409 : 502 });
  await audit(me, parent ? "franchise.create_sub" : "franchise.create", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}${parent ? ` (under ${parent.code})` : ""}`, after: row }, request);

  // Its panel login (Franchise role) — the password typed here, or the person's existing Shubhora password.
  let loginMade = "", loginError = "";
  if (login && (existing || password.length >= 8)) {
    const phone = String(p.phone ?? "").replace(/\D/g, "").slice(-10);
    const auth = existing ? { id: existing.id, created: false } : await createOrResetAuthUser(login, String(p.name), phone, password);
    if ("error" in auth) loginError = auth.error;
    else {
      const role = ROLES.find((x) => x.key === "franchise")!;
      const made = list(await svc<{ id: string }[]>("admin_users?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id: auth.id, email: login, name: p.name, phone, role: "franchise", rights: role.rights, franchise_id: fr.id, active: true, must_change_password: false, created_by: me.id || null }) }))[0];
      if (made) { loginMade = /^p91(\d{10})@phone\./.test(login) ? login.slice(3, 13) : login; await audit(me, "staff.create", { type: "staff", id: made.id, label: `${p.name} <${login}>`, after: { role: "franchise", franchise_id: fr.id } }, request); }
      else loginError = "Could not make the login — Super Admin can make it under Logins.";
    }
  }
  return Response.json({ franchise: fr, login: loginMade, existingAccount: !!existing, loginError });
}
