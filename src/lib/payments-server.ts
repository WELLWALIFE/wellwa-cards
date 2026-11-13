import "server-only";
// Flexible payments, server side (src/lib/payments.ts has the shared shape; migration 0079). Everything goes through the service role.
//   createRequest()   a new payable thing with its /pay/<code> link
//   requestByCode()   what the pay page shows
//   settleRequest()   a verified Razorpay payment for a request: mark paid and APPLY it — N months of the plan (Premium: + the Premium
//                     website), the advance ledger, or just the record — once, however many times verify / webhook call it
//   advanceBalance()  the rupees an account holds in advance; spendAdvance() pays a plan from it
import crypto from "node:crypto";
import { restAsService } from "@/lib/poster-server";
import { SAAS_PLANS, PREMIUM_FIRST_PAISE } from "@/lib/billing";
import { grantAdvanced } from "@/lib/advanced-access";
import { franchiseEarning } from "@/lib/franchise-server";
import { reportPaidToPartner } from "@/lib/partner-link";
import { notify } from "@/lib/notify";
import { SITE_PKG, pkgOfNote } from "@/lib/site-order";
import { applyPackage } from "@/lib/site-order-server";
import { newPayCode, PAY_MAX_PAISE, PAY_MIN_PAISE, requestTitle, rupeesOf, type PaymentRequest, type PayKind, type PayTier } from "@/lib/payments";

const COLS = "id,code,owner_id,created_by,created_role,kind,tier,months,amount_paise,title,note,status,order_id,payment_id,paid_at,expires_at,created_at";
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export type NewRequest = { ownerId: string; createdBy: string | null; createdRole: "self" | "admin" | "franchise"; kind: PayKind; tier?: PayTier | null; months?: number; amountPaise: number; title?: string; note?: string; expiresInDays?: number };

/** The price a plan request would normally be: the admin may type any amount, the user's own request uses this. */
export const planListPrice = (tier: PayTier, months: number) => (tier === "premium" ? PREMIUM_FIRST_PAISE + SAAS_PLANS.growth.amount * Math.max(0, months - 1) : SAAS_PLANS.growth.amount * months);

export async function createRequest(n: NewRequest): Promise<{ ok: true; request: PaymentRequest } | { ok: false; error: string }> {
  const amount = Math.round(Number(n.amountPaise) || 0);
  if (amount < PAY_MIN_PAISE || amount > PAY_MAX_PAISE) return { ok: false, error: `The amount must be between ${rupeesOf(PAY_MIN_PAISE)} and ${rupeesOf(PAY_MAX_PAISE)}.` };
  const months = Math.max(1, Math.min(36, Math.round(Number(n.months) || 1)));
  if (n.kind === "plan" && !n.tier) return { ok: false, error: "Choose the plan." };
  const row = {
    code: newPayCode(), owner_id: n.ownerId, created_by: n.createdBy, created_role: n.createdRole,
    kind: n.kind, tier: n.kind === "plan" ? n.tier : null, months: n.kind === "plan" ? months : 1, amount_paise: amount,
    title: (n.title ?? "").trim().slice(0, 80), note: (n.note ?? "").trim().slice(0, 300),
    expires_at: n.expiresInDays ? new Date(Date.now() + n.expiresInDays * 86400_000).toISOString() : null,
  };
  const r = await restAsService<PaymentRequest[]>("payment_requests", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const made = list(r)[0];
  if (!r.ok || !made) return { ok: false, error: "Could not save the request." };
  return { ok: true, request: made };
}

export async function requestByCode(code: string): Promise<PaymentRequest | null> {
  if (!/^[a-z0-9]{6,16}$/i.test(code)) return null;
  return list(await restAsService<PaymentRequest[]>(`payment_requests?code=eq.${encodeURIComponent(code)}&select=${COLS}&limit=1`))[0] ?? null;
}
export async function requestById(id: string): Promise<PaymentRequest | null> {
  return list(await restAsService<PaymentRequest[]>(`payment_requests?id=eq.${encodeURIComponent(id)}&select=${COLS}&limit=1`))[0] ?? null;
}
export async function requestsOf(ownerId: string, status?: "open" | "paid" | "cancelled"): Promise<PaymentRequest[]> {
  return list(await restAsService<PaymentRequest[]>(`payment_requests?owner_id=eq.${ownerId}${status ? `&status=eq.${status}` : ""}&select=${COLS}&order=created_at.desc&limit=50`));
}
export async function cancelRequest(id: string): Promise<boolean> {
  const r = await restAsService(`payment_requests?id=eq.${id}&status=eq.open`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "cancelled" }) });
  return r.ok;
}
export async function rememberOrder(id: string, orderId: string): Promise<void> {
  await restAsService(`payment_requests?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: orderId }) });
}

export const isOpen = (r: PaymentRequest) => r.status === "open" && (!r.expires_at || Date.parse(r.expires_at) > Date.now());

/** Razorpay's HMAC over "<order>|<payment>" with the key secret. */
export function signatureOk(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const want = Buffer.from(crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"));
  const got = Buffer.from(String(signature));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export type Settled = { ok: true; replayed: boolean; applied: string } | { ok: false; error: string };

/** A verified payment for a request: mark it paid (the unique payment_id makes this run once) and apply what it buys. */
export async function settleRequest(req: PaymentRequest, p: { paymentId: string; orderId: string; amount: number }): Promise<Settled> {
  // Claim the request with this payment: a second verify / the webhook finds payment_id set and answers "replayed".
  const claim = await restAsService<PaymentRequest[]>(`payment_requests?id=eq.${req.id}&status=eq.open`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "paid", payment_id: p.paymentId, order_id: p.orderId, paid_at: new Date().toISOString() }),
  });
  const claimed = list(claim)[0];
  if (!claimed) {
    const now = await requestById(req.id);
    if (now?.status === "paid" && now.payment_id === p.paymentId) return { ok: true, replayed: true, applied: now.kind };
    return { ok: false, error: now?.status === "paid" ? "This request was already paid." : "This request is no longer open." };
  }
  const hi = false;
  const what = requestTitle(req, hi);
  // Only the account's own request at the list price is a package: a hand-made "custom" request never opens one by its note.
  const pkg0 = req.kind === "custom" && req.created_role === "self" ? pkgOfNote(req.note) : null;
  const pkg = pkg0 && p.amount === SITE_PKG[pkg0].amount ? pkg0 : null;
  if (req.kind === "plan" && req.tier) {
    const rpc = await restAsService<{ ok?: boolean; replayed?: boolean }>("rpc/apply_flex_plan", { method: "POST", body: JSON.stringify({ p_user: req.owner_id, p_tier: "growth", p_months: req.months, p_ref: p.paymentId, p_order_ref: p.orderId, p_amount: p.amount, p_credits: SAAS_PLANS.growth.credits }) });
    if (!rpc.ok) return { ok: false, error: `Paid, but the plan could not be applied (${rpc.status}). Shubhora will set it by hand.` };
    if (req.tier === "premium") await grantAdvanced(req.owner_id, p.paymentId).catch(() => false);
    await reportPaidToPartner(req.owner_id, { totalPaise: p.amount, tier: "growth", ref: p.paymentId }).catch(() => undefined);
  } else if (pkg) {
    // A website package (lib/site-order.ts): the year, a month of the Growth features, Premium's website. The build starts from the app.
    if (!(await applyPackage(req.owner_id, pkg, p.paymentId))) return { ok: false, error: "Paid, but the package could not be set. Shubhora will set it by hand." };
  } else if (req.kind === "advance") {
    const led = await restAsService("advance_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: req.owner_id, delta_paise: p.amount, reason: what, ref: p.paymentId }) });
    if (!led.ok && led.status !== 409) return { ok: false, error: `Paid, but the advance could not be recorded (${led.status}). Shubhora will set it by hand.` };
  }
  // The user's franchise earns on every payment that reaches Shubhora (src/lib/franchise-server.ts), once per payment id.
  await franchiseEarning(req.owner_id, { paise: p.amount, ref: p.paymentId, what: `${req.kind}:${what}` });
  await notify(req.owner_id, "payment", {
    title: "Payment received", body: pkg ? `Thank you. ${rupeesOf(p.amount)} — ${what}. Your website will be ready within 24–48 hours.` : `Thank you. ${rupeesOf(p.amount)} — ${what}.`, path: pkg ? "/poster/site/order" : "/poster/plan", ref: p.paymentId,
    whatsappText: `*Payment received — ${rupeesOf(p.amount)}* ✅\n${what}\n\n${pkg ? "धन्यवाद! हमारी team आपकी website पर काम कर रही है — 24–48 घंटे में तैयार होगी। Live होते ही WhatsApp पर बताएँगे।" : req.kind === "plan" ? "आपका plan चालू हो गया है।" : req.kind === "advance" ? "रकम आपके account में advance की तरह जमा है — plan लेते समय इसी से कटेगी।" : "Shubhora team को खबर मिल गई है।"}`,
  }).catch(() => undefined);
  return { ok: true, replayed: false, applied: req.kind };
}

export async function advanceBalance(ownerId: string): Promise<number> {
  const r = await restAsService<number>("rpc/advance_balance", { method: "POST", body: JSON.stringify({ p_user: ownerId }) });
  return typeof r.data === "number" ? r.data : 0;
}
export type LedgerLine = { id: number; delta_paise: number; reason: string; ref: string | null; created_at: string };
export async function advanceLines(ownerId: string): Promise<LedgerLine[]> {
  return list(await restAsService<LedgerLine[]>(`advance_ledger?owner_id=eq.${ownerId}&select=id,delta_paise,reason,ref,created_at&order=created_at.desc&limit=30`));
}

/** Standard for N months, paid from the advance balance (Premium is not taken this way: its first month is a Razorpay mandate). */
export async function spendAdvance(ownerId: string, months: number): Promise<{ ok: true; expires: string; balance: number } | { ok: false; error: string; balance?: number }> {
  const m = Math.max(1, Math.min(12, Math.round(months) || 1));
  const amount = SAAS_PLANS.growth.amount * m;
  const r = await restAsService<{ ok?: boolean; reason?: string; balance?: number; expires?: string }>("rpc/use_advance_for_plan", { method: "POST", body: JSON.stringify({ p_user: ownerId, p_tier: "growth", p_months: m, p_amount: amount, p_credits: SAAS_PLANS.growth.credits }) });
  if (!r.ok || !r.data) return { ok: false, error: "Could not use the balance. Please try again." };
  if (r.data.ok === false) return { ok: false, error: `Your balance is short: ${rupeesOf(r.data.balance ?? 0)} of ${rupeesOf(amount)} needed.`, balance: r.data.balance };
  await notify(ownerId, "payment", { title: "Plan active", body: `Standard for ${m} month${m === 1 ? "" : "s"}, paid from your advance.`, path: "/poster/plan", ref: `advance-use:${ownerId}:${Date.now()}` }).catch(() => undefined);
  return { ok: true, expires: String(r.data.expires ?? ""), balance: Number(r.data.balance ?? 0) };
}
