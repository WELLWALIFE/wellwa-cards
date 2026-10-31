// One franchise (Admin v2): its users, account (ledger), payouts and logins.
//   GET → { franchise, balance, users, ledger, payouts, logins, settings, signupLink }
//   PATCH { …fields } → { franchise }                                     ("franchises.manage")
//   POST { op: "assign_user", user_id } | { op: "remove_user", user_id }   ("franchises.manage")
//        { op: "payout_request", amount, note? }                           (the franchise itself, or "franchises.payouts")
//        { op: "payout_decide", payout_id, status: approved|rejected|paid, utr?, note? }   ("franchises.payouts")
//        { op: "adjustment", amount (+/−), note }                            ("franchises.payouts")
import { requireAdmin, audit, getSettings, userInScope } from "@/lib/admin-v2";
import { svc, svcCount } from "@/lib/service";
import { franchiseBalance, franchisePatch, FR_COLS, type FranchiseRow } from "@/lib/franchise-server";
import { SITE_URL } from "@/lib/site-url";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const paise = (v: unknown) => { const n = Math.round(Number(String(v ?? "").replace(/[^\d.-]/g, "")) * 100); return Number.isFinite(n) ? n : 0; };

async function load(id: string): Promise<FranchiseRow | null> {
  return isUuid(id) ? list(await svc<FranchiseRow[]>(`franchises?id=eq.${id}&select=${FR_COLS}&limit=1`))[0] ?? null : null;
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(request, "franchises.view"); if (!g.ok) return g.res;
  const { me } = g;
  const { id } = await ctx.params;
  if (me.franchise && me.franchise.id !== id) return Response.json({ error: "Not your franchise." }, { status: 403 });
  const fr = await load(id); if (!fr) return Response.json({ error: "Franchise not found." }, { status: 404 });
  const money = me.rights.includes("billing.view") || me.rights.includes("franchises.payouts") || !!me.franchise;
  const [balance, users, ledger, payouts, logins, s] = await Promise.all([
    franchiseBalance(fr.id),
    svc<{ id: string; full_name: string | null; username: string | null; plan: string; saas_tier: string | null; saas_expires_at: string | null; created_at: string; franchise_joined_at: string | null }[]>(`profiles?franchise_id=eq.${fr.id}&select=id,full_name,username,plan,saas_tier,saas_expires_at,created_at,franchise_joined_at&order=created_at.desc&limit=500`),
    money ? svc<Record<string, unknown>[]>(`franchise_ledger?franchise_id=eq.${fr.id}&select=id,user_id,kind,amount_paise,base_paise,pct,payment_ref,note,payout_id,at&order=at.desc&limit=300`) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    svc<Record<string, unknown>[]>(`payouts?franchise_id=eq.${fr.id}&select=id,amount_paise,status,utr,note,requested_at,decided_at,paid_at&order=requested_at.desc&limit=100`),
    svc<{ id: string; email: string; name: string; active: boolean; last_login_at: string | null }[]>(`admin_users?franchise_id=eq.${fr.id}&select=id,email,name,active,last_login_at`),
    getSettings(),
  ]);
  const names = new Map(list(users).map((u) => [u.id, u.full_name || u.username || "User"]));
  return Response.json({
    franchise: me.franchise ? { ...fr, bank: fr.bank, kyc: undefined } : fr, balance, users: list(users),
    ledger: list(ledger).map((l) => ({ ...l, user: l.user_id ? names.get(String(l.user_id)) ?? "" : "" })), payouts: list(payouts), logins: list(logins),
    settings: { payoutMin: s.payout_min_paise }, signupLink: `${SITE_URL}/start?f=${fr.code}`,
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { id } = await ctx.params;
  // A franchise login may change its own bank details and contact (and nothing else); everything else needs "franchises.manage".
  const ownOnly = Object.keys(b).every((k) => ["bank", "email", "phone", "pincode", "pan", "gstin"].includes(k));
  const g = await requireAdmin(request, ownOnly ? "franchises.view" : "franchises.manage", { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  if (me.franchise ? me.franchise.id !== id || !ownOnly : !me.rights.includes("franchises.manage")) return Response.json({ error: "You do not have the right to change this." }, { status: 403 });
  const was = await load(id); if (!was) return Response.json({ error: "Franchise not found." }, { status: 404 });
  const s = await getSettings();
  const p = franchisePatch(b, { first: s.commission_first_pct, renewal: s.commission_renewal_pct });
  if ("name" in p && !p.name) return Response.json({ error: "The name cannot be empty." }, { status: 400 });
  if (!Object.keys(p).length) return Response.json({ franchise: was });
  const r = await svc<FranchiseRow[]>(`franchises?id=eq.${was.id}&select=${FR_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...p, updated_at: new Date().toISOString() }) });
  const fr = list(r)[0]; if (!fr) return Response.json({ error: "Could not save." }, { status: 502 });
  const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
  for (const k of Object.keys(p)) { before[k] = (was as Record<string, unknown>)[k]; after[k] = (fr as Record<string, unknown>)[k]; }
  await audit(me, "franchise.update", { type: "franchise", id: fr.id, label: `${fr.code} · ${fr.name}`, before, after }, request);
  return Response.json({ franchise: fr });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(request, ["franchises.manage", "franchises.payouts", "franchises.view"], { sensitive: true }); if (!g.ok) return g.res;
  const { me } = g;
  const { id } = await ctx.params;
  if (me.franchise && me.franchise.id !== id) return Response.json({ error: "Not your franchise." }, { status: 403 });
  const fr = await load(id); if (!fr) return Response.json({ error: "Franchise not found." }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const label = `${fr.code} · ${fr.name}`;
  const deny = (what: string) => Response.json({ error: `You do not have the right to ${what}.` }, { status: 403 });

  switch (b.op) {
    case "assign_user":
    case "remove_user": {
      if (!me.rights.includes("franchises.manage")) return deny("assign users");
      if (!isUuid(b.user_id)) return Response.json({ error: "Bad user." }, { status: 400 });
      if (!(await userInScope(me, b.user_id))) return Response.json({ error: "That user is outside your scope." }, { status: 403 });
      const was = list(await svc<{ franchise_id: string | null; full_name: string | null }[]>(`profiles?id=eq.${b.user_id}&select=franchise_id,full_name&limit=1`))[0];
      if (!was) return Response.json({ error: "User not found." }, { status: 404 });
      const assign = b.op === "assign_user";
      await svc(`profiles?id=eq.${b.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(assign ? { franchise_id: fr.id, franchise_joined_at: new Date().toISOString() } : { franchise_id: null }) });
      await audit(me, assign ? "franchise.assign_user" : "franchise.remove_user", { type: "user", id: b.user_id, label: was.full_name ?? "", before: { franchise_id: was.franchise_id }, after: { franchise_id: assign ? fr.id : null }, note: label }, request);
      return Response.json({ ok: true });
    }
    case "payout_request": {
      if (!(me.franchise?.id === fr.id || me.rights.includes("franchises.payouts"))) return deny("ask for a payout");
      const amount = paise(b.amount);
      const s = await getSettings();
      const bal = await franchiseBalance(fr.id);
      if (amount <= 0) return Response.json({ error: "Write the amount." }, { status: 400 });
      if (amount < s.payout_min_paise) return Response.json({ error: `The minimum payout is ₹${Math.round(s.payout_min_paise / 100).toLocaleString("en-IN")}.` }, { status: 400 });
      if (amount > bal.balance - bal.pending) return Response.json({ error: `Only ₹${Math.round((bal.balance - bal.pending) / 100).toLocaleString("en-IN")} is available (earned − paid − already requested).` }, { status: 400 });
      if (!fr.bank?.account && !fr.bank?.upi) return Response.json({ error: "Add the bank account or UPI first (Profile → Bank)." }, { status: 400 });
      const r = await svc<{ id: string }[]>("payouts?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ franchise_id: fr.id, amount_paise: amount, note: String(b.note ?? "").slice(0, 300), requested_by: me.id || null }) });
      const po = list(r)[0]; if (!po) return Response.json({ error: "Could not save." }, { status: 502 });
      await audit(me, "payout.request", { type: "payout", id: po.id, label, after: { amount_paise: amount } }, request);
      return Response.json({ ok: true, id: po.id });
    }
    case "payout_decide": {
      if (!me.rights.includes("franchises.payouts")) return deny("decide payouts");
      if (!isUuid(b.payout_id)) return Response.json({ error: "Bad payout." }, { status: 400 });
      const po = list(await svc<{ id: string; amount_paise: number; status: string }[]>(`payouts?id=eq.${b.payout_id}&franchise_id=eq.${fr.id}&select=id,amount_paise,status&limit=1`))[0];
      if (!po) return Response.json({ error: "Payout not found." }, { status: 404 });
      const status = String(b.status);
      const allowed: Record<string, string[]> = { requested: ["approved", "rejected", "paid"], approved: ["paid", "rejected"] };
      if (!(allowed[po.status] ?? []).includes(status)) return Response.json({ error: `A ${po.status} payout cannot become ${status}.` }, { status: 400 });
      const utr = String(b.utr ?? "").trim().slice(0, 40);
      if (status === "paid" && !utr) return Response.json({ error: "Write the UTR / transaction reference of the bank transfer." }, { status: 400 });
      const now = new Date().toISOString();
      await svc(`payouts?id=eq.${po.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, utr, note: String(b.note ?? "").slice(0, 300), decided_by: me.id || null, decided_at: now, ...(status === "paid" ? { paid_at: now } : {}) }) });
      if (status === "paid") {
        // The ledger line that takes the money out of the balance (once per payout — the unique index on payment_ref guards a double click).
        await svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ franchise_id: fr.id, kind: "payout", amount_paise: -Number(po.amount_paise), payment_ref: `payout:${po.id}`, note: `Paid · UTR ${utr}`, payout_id: po.id, created_by: me.id || null }) });
      }
      await audit(me, `payout.${status}`, { type: "payout", id: po.id, label, before: { status: po.status }, after: { status, utr, amount_paise: po.amount_paise } }, request);
      return Response.json({ ok: true });
    }
    case "adjustment": {
      if (!me.rights.includes("franchises.payouts")) return deny("adjust the account");
      const amount = paise(b.amount);
      const note = String(b.note ?? "").trim().slice(0, 300);
      if (!amount) return Response.json({ error: "Write the amount (+ to add, − to take back)." }, { status: 400 });
      if (!note) return Response.json({ error: "Write why." }, { status: 400 });
      await svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ franchise_id: fr.id, kind: "adjustment", amount_paise: amount, note, created_by: me.id || null }) });
      await audit(me, "franchise.adjustment", { type: "franchise", id: fr.id, label, after: { amount_paise: amount, note } }, request);
      return Response.json({ ok: true });
    }
    case "stats": {
      return Response.json({ users: await svcCount(`profiles?franchise_id=eq.${fr.id}&select=id`) });
    }
    default:
      return Response.json({ error: "Unknown action." }, { status: 400 });
  }
}
