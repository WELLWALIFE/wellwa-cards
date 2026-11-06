import "server-only";
import { GST_PCT } from "@/lib/billing";
// Franchises (owner, 31 Oct 2026): a user belongs to the franchise whose link / code they signed up with (profiles.franchise_id),
// and every payment that user makes earns the franchise its commission — written here, once per payment, into franchise_ledger.
// Money never moves from the app: the ledger is the account, a payout is paid by hand and marked paid with its UTR.
import { svc, svcCount } from "@/lib/service";
import { notify } from "@/lib/notify";
import { cleanPhone } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
export type FranchiseRow = {
  id: string; code: string; name: string; company: string; phone: string; email: string; gstin: string; pan: string; area: string; city: string; state: string; pincode: string;
  commission_first_pct: number; commission_renewal_pct: number; can_activate: boolean; status: "active" | "paused" | "ended";
  /** The franchise this one is a sub-franchise of (migration 0088); null for a top-level franchise. */
  parent_id?: string | null;
  bank: Record<string, string>; kyc: Record<string, unknown>; agreement_at: string | null; target_paise: number; notes: string; owner_user_id: string | null; created_at: string; updated_at: string;
};
export const FR_COLS = "id,code,name,company,phone,email,gstin,pan,area,city,state,pincode,commission_first_pct,commission_renewal_pct,can_activate,status,bank,kyc,agreement_at,target_paise,notes,owner_user_id,parent_id,created_at,updated_at";
export const cleanCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

export async function franchiseByCode(code: string): Promise<FranchiseRow | null> {
  const c = cleanCode(code); if (c.length < 3) return null;
  return list(await svc<FranchiseRow[]>(`franchises?code=eq.${c}&select=${FR_COLS}&limit=1`))[0] ?? null;
}

/** A new sign-up (or a user with no franchise yet) joins the franchise of this code. Never moves a user who already has one. */
export async function attachFranchise(userId: string, code: string): Promise<{ ok: boolean; franchise?: FranchiseRow; reason?: string }> {
  const fr = await franchiseByCode(code);
  if (!fr) return { ok: false, reason: "unknown code" };
  if (fr.status !== "active") return { ok: false, reason: "franchise not active" };
  const r = await svc<{ id: string }[]>(`profiles?id=eq.${userId}&franchise_id=is.null&select=id`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ franchise_id: fr.id, franchise_joined_at: new Date().toISOString() }) });
  if (!list(r).length) return { ok: false, reason: "already has a franchise" };
  void (async () => {
    const who = list(await svc<{ full_name: string | null; username: string | null }[]>(`profiles?id=eq.${userId}&select=full_name,username&limit=1`))[0];
    const name = who?.full_name || (who?.username ? `@${who.username}` : "A new user");
    await notifyFranchise(fr.id, { title: `New user: ${name}`, body: `${name} signed up with your link (${fr.code}).`, ref: `join:${userId}` });
    if (fr.parent_id) await notifyFranchise(fr.parent_id, { title: `New user via ${fr.code}`, body: `${name} signed up with your sub-franchise ${fr.code} · ${fr.name}.`, ref: `join:${userId}` });
  })().catch(() => undefined);
  return { ok: true, franchise: fr };
}

/** Tells every active login of a franchise (push + WhatsApp, as the Super Admin's notification switches allow). Never throws. */
export async function notifyFranchise(frId: string, n: { title: string; body: string; ref: string }): Promise<void> {
  try {
    const logins = list(await svc<{ id: string }[]>(`admin_users?franchise_id=eq.${frId}&active=is.true&select=id&limit=20`));
    await Promise.all(logins.map((l) => notify(l.id, "franchise_update", { ...n, path: "/admin/earnings" })));
  } catch { /* a message that fails never fails the action */ }
}

/** Is this account under a franchise? (Owner, 1 Nov 2026: franchise users never see the partner programme — they are consumers.) */
export async function franchiseOf(userId: string): Promise<string | null> {
  const prof = list(await svc<{ franchise_id: string | null }[]>(`profiles?id=eq.${userId}&select=franchise_id&limit=1`))[0];
  return prof?.franchise_id ?? null;
}

/** Called after every verified payment: the user's franchise earns its percent (first payment % or renewal %). Once per payment ref.
 *  A sub-franchise's user (migration 0088): the sub earns its own percent and its parent earns the difference (parent % − sub %) as an
 *  override — both written once per payment (the unique index is per franchise). */
export async function franchiseEarning(userId: string, p: { paise: number; ref: string; what?: string }): Promise<void> {
  try {
    if (!p.paise || !p.ref) return;
    const prof = list(await svc<{ franchise_id: string | null }[]>(`profiles?id=eq.${userId}&select=franchise_id&limit=1`))[0];
    if (!prof?.franchise_id) return;
    const fr = list(await svc<FranchiseRow[]>(`franchises?id=eq.${prof.franchise_id}&select=${FR_COLS}&limit=1`))[0];
    if (!fr) return;
    const earlier = await svcCount(`franchise_ledger?franchise_id=eq.${fr.id}&user_id=eq.${userId}&kind=eq.earning&select=id`);
    const first = earlier === 0;
    // Owner, 1 Nov 2026: the percent is always on the amount WITHOUT GST — the tax part of a payment is the government's, not revenue.
    const net = Math.round(p.paise / (1 + GST_PCT / 100));
    const rupees = (x: number) => `₹${Math.round(x / 100).toLocaleString("en-IN")}`;
    const pct = Number(first ? fr.commission_first_pct : fr.commission_renewal_pct);
    const write = (franchiseId: string, percent: number, note: string) => {
      const amount = Math.round((net * percent) / 100);
      if (amount <= 0) return Promise.resolve();
      return svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
        franchise_id: franchiseId, user_id: userId, kind: "earning", amount_paise: amount, base_paise: net, pct: percent, payment_ref: p.ref, note,
      }) }).then((r) => {   // a second copy of the same payment hits the unique index and is simply refused (and not told twice)
        if (r.ok) void notifyFranchise(franchiseId, { title: `Earned ${rupees(amount)}`, body: `${note.startsWith("Override") ? "Override: " : ""}${what} — ${percent}% of ${rupees(net)}.`, ref: `earn:${p.ref}` });
      });
    };
    const what = `${first ? "First payment" : "Renewal"}${p.what ? ` · ${p.what}` : ""}`;
    const base = `${rupees(net)} (${rupees(p.paise)} less ${GST_PCT}% GST)`;
    if (fr.status === "active") await write(fr.id, pct, `${what} · ${pct}% of ${base}`);
    if (fr.parent_id) {
      const parent = list(await svc<FranchiseRow[]>(`franchises?id=eq.${fr.parent_id}&select=${FR_COLS}&limit=1`))[0];
      if (parent && parent.status === "active") {
        const ppct = Number(first ? parent.commission_first_pct : parent.commission_renewal_pct);
        const diff = Math.round((ppct - (fr.status === "active" ? pct : 0)) * 100) / 100;
        if (diff > 0) await write(parent.id, diff, `Override from ${fr.code} · ${what} · ${diff}% (${ppct}% − ${fr.status === "active" ? pct : 0}%) of ${base}`);
      }
    }
  } catch { /* never fails a payment */ }
}

/** The sub-franchises of a franchise (one level), not ended. */
export async function subFranchiseIds(frId: string): Promise<string[]> {
  return list(await svc<{ id: string }[]>(`franchises?parent_id=eq.${frId}&status=neq.ended&select=id&limit=500`)).map((r) => r.id);
}

export type Balance = { earned: number; paid: number; adjusted: number; balance: number; pending: number; thisMonth: number };
/** The franchise's account: earned − paid out (+ adjustments), and what is asked for but not paid yet. */
export async function franchiseBalance(frId: string): Promise<Balance> {
  const rows = list(await svc<{ kind: string; amount_paise: number; at: string }[]>(`franchise_ledger?franchise_id=eq.${frId}&select=kind,amount_paise,at&limit=20000`));
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const b: Balance = { earned: 0, paid: 0, adjusted: 0, balance: 0, pending: 0, thisMonth: 0 };
  for (const r of rows) {
    const a = Number(r.amount_paise) || 0;
    if (r.kind === "earning") { b.earned += a; if (new Date(r.at) >= month) b.thisMonth += a; }
    else if (r.kind === "payout") b.paid += -a;
    else b.adjusted += a;
  }
  b.balance = b.earned - b.paid + b.adjusted;
  const pend = list(await svc<{ amount_paise: number }[]>(`payouts?franchise_id=eq.${frId}&status=in.(requested,approved)&select=amount_paise`));
  b.pending = pend.reduce((s, p) => s + Number(p.amount_paise || 0), 0);
  return b;
}

const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const pct = (v: unknown, d: number) => { const n = Number(v); return v === undefined || v === "" || !Number.isFinite(n) ? d : Math.min(100, Math.max(0, Math.round(n * 100) / 100)); };

/** The fields an admin may write on a franchise (create / update), cleaned. */
export function franchisePatch(b: Record<string, unknown>, d: { first: number; renewal: number }): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if ("name" in b) p.name = txt(b.name, 80);
  for (const k of ["company", "area", "city", "state", "notes"] as const) if (k in b) p[k] = txt(b[k], k === "notes" ? 2000 : 80);
  if ("phone" in b) p.phone = cleanPhone(b.phone) || txt(b.phone, 20);
  if ("email" in b) p.email = txt(b.email, 120).toLowerCase();
  if ("gstin" in b) p.gstin = txt(b.gstin, 15).toUpperCase();
  if ("pan" in b) p.pan = txt(b.pan, 10).toUpperCase();
  if ("pincode" in b) p.pincode = txt(b.pincode, 6).replace(/\D/g, "");
  if ("commission_first_pct" in b) p.commission_first_pct = pct(b.commission_first_pct, d.first);
  if ("commission_renewal_pct" in b) p.commission_renewal_pct = pct(b.commission_renewal_pct, d.renewal);
  if ("can_activate" in b) p.can_activate = b.can_activate === true;
  if ("status" in b && ["active", "paused", "ended"].includes(String(b.status))) p.status = b.status;
  if ("agreement_at" in b) p.agreement_at = typeof b.agreement_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.agreement_at) ? b.agreement_at : null;
  if ("target_paise" in b) { const n = Math.round(Number(b.target_paise)); p.target_paise = Number.isFinite(n) && n >= 0 ? n : 0; }
  if (b.bank && typeof b.bank === "object") { const bk = b.bank as Record<string, unknown>; p.bank = Object.fromEntries(["holder", "bank", "account", "ifsc", "upi"].map((k) => [k, txt(bk[k], 60)])); }
  return p;
}

