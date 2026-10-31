// Franchises (Admin v2). "franchises.view" to see (a franchise login sees only its own), "franchises.manage" to create.
//   GET → { franchises: [{ …row, users, paid, balance, pendingPayouts, loginEmail }], settings }
//   POST { code, name, company?, phone, email?, area?, city?, state?, commission_first_pct?, commission_renewal_pct?, can_activate?, … } → { franchise }
import { requireAdmin, audit, getSettings } from "@/lib/admin-v2";
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
      svc<Record<string, unknown>[]>("payouts?status=in.(paid,rejected)&select=id,franchise_id,amount_paise,status,utr,note,requested_at,decided_at,paid_at&order=decided_at.desc&limit=50"),
      svc<{ id: string; code: string; name: string; bank: Record<string, string> }[]>("franchises?select=id,code,name,bank"),
    ]);
    const fm = new Map(list(frs).map((f) => [f.id, f]));
    const dress = (p: Record<string, unknown>) => ({ ...p, franchise: fm.get(String(p.franchise_id)) ?? null });
    return Response.json({ open: list(open).map(dress), done: list(done).map(dress) });
  }
  const own = me.franchise ? `&id=eq.${me.franchise.id}` : "";
  const [frs, counts, paid, ledger, pend, logins, s] = await Promise.all([
    svc<FranchiseRow[]>(`franchises?select=${FR_COLS}${own}&order=created_at.desc`),
    svc<{ franchise_id: string }[]>(`profiles?franchise_id=not.is.null${me.franchise ? `&franchise_id=eq.${me.franchise.id}` : ""}&select=franchise_id&limit=50000`),
    svc<{ franchise_id: string }[]>(`profiles?franchise_id=not.is.null&saas_tier=neq.none&saas_expires_at=gte.${new Date().toISOString()}&select=franchise_id&limit=50000`),
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
    return { ...f, users: (c.get(f.id) ?? []).length, paid: (pd.get(f.id) ?? []).length, earned, balance, pendingPayouts: (pn.get(f.id) ?? []).reduce((a, r) => a + Number(r.amount_paise), 0), logins: (lo.get(f.id) ?? []).map((l) => ({ email: l.email, active: l.active })) };
  });
  return Response.json({ franchises: out, settings: { first: s.commission_first_pct, renewal: s.commission_renewal_pct, canActivate: s.franchise_can_activate, payoutMin: s.payout_min_paise } });
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, "franchises.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const s = await getSettings();
  const code = cleanCode(b.code);
  if (!/^[A-Z0-9]{3,16}$/.test(code)) return Response.json({ error: "Code: 3–16 letters / digits, e.g. JAIPUR01." }, { status: 400 });
  const p = franchisePatch(b, { first: s.commission_first_pct, renewal: s.commission_renewal_pct });
  if (!p.name) return Response.json({ error: "Write the franchise owner's name." }, { status: 400 });
  if (!p.phone) return Response.json({ error: "Write their mobile number." }, { status: 400 });
  const row = { code, commission_first_pct: s.commission_first_pct, commission_renewal_pct: s.commission_renewal_pct, can_activate: s.franchise_can_activate, ...p, created_by: me.id || null };
  const r = await svc<FranchiseRow[]>(`franchises?select=${FR_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const fr = list(r)[0];
  if (!fr) return Response.json({ error: r.status === 409 || /duplicate|unique/i.test(r.text) ? `The code ${code} is already taken.` : /franchises/.test(r.text) ? "Admin v2 is not set up yet — run migration 0078 in Supabase." : "Could not save." }, { status: r.status === 409 ? 409 : 502 });
  await audit(me, "franchise.create", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}`, after: row }, request);
  return Response.json({ franchise: fr });
}
