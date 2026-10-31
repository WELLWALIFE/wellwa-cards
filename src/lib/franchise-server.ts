import "server-only";
// Franchises (owner, 31 Oct 2026): a user belongs to the franchise whose link / code they signed up with (profiles.franchise_id),
// and every payment that user makes earns the franchise its commission — written here, once per payment, into franchise_ledger.
// Money never moves from the app: the ledger is the account, a payout is paid by hand and marked paid with its UTR.
import { svc, svcCount } from "@/lib/service";
import { cleanPhone } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
export type FranchiseRow = {
  id: string; code: string; name: string; company: string; phone: string; email: string; gstin: string; pan: string; area: string; city: string; state: string; pincode: string;
  commission_first_pct: number; commission_renewal_pct: number; can_activate: boolean; status: "active" | "paused" | "ended";
  bank: Record<string, string>; kyc: Record<string, unknown>; agreement_at: string | null; target_paise: number; notes: string; owner_user_id: string | null; created_at: string; updated_at: string;
};
export const FR_COLS = "id,code,name,company,phone,email,gstin,pan,area,city,state,pincode,commission_first_pct,commission_renewal_pct,can_activate,status,bank,kyc,agreement_at,target_paise,notes,owner_user_id,created_at,updated_at";
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
  return list(r).length ? { ok: true, franchise: fr } : { ok: false, reason: "already has a franchise" };
}

/** Called after every verified payment: the user's franchise earns its percent (first payment % or renewal %). Once per payment ref. */
export async function franchiseEarning(userId: string, p: { paise: number; ref: string; what?: string }): Promise<void> {
  try {
    if (!p.paise || !p.ref) return;
    const prof = list(await svc<{ franchise_id: string | null }[]>(`profiles?id=eq.${userId}&select=franchise_id&limit=1`))[0];
    if (!prof?.franchise_id) return;
    const fr = list(await svc<FranchiseRow[]>(`franchises?id=eq.${prof.franchise_id}&select=${FR_COLS}&limit=1`))[0];
    if (!fr || fr.status !== "active") return;
    const earlier = await svcCount(`franchise_ledger?franchise_id=eq.${fr.id}&user_id=eq.${userId}&kind=eq.earning&select=id`);
    const pct = Number(earlier === 0 ? fr.commission_first_pct : fr.commission_renewal_pct);
    const amount = Math.round((p.paise * pct) / 100);
    if (amount <= 0) return;
    await svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      franchise_id: fr.id, user_id: userId, kind: "earning", amount_paise: amount, base_paise: p.paise, pct, payment_ref: p.ref,
      note: `${earlier === 0 ? "First payment" : "Renewal"}${p.what ? ` · ${p.what}` : ""}`,
    }) });   // a second copy of the same payment hits the unique index and is simply refused
  } catch { /* never fails a payment */ }
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

