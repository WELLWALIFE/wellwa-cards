import "server-only";
// Growth by autopay — Razorpay Subscriptions with a UPI Autopay (PhonePe, Google Pay, Paytm, …) or card mandate
// (owner's call, 27 Sep 2026: Growth is taken only this way). One Razorpay plan "Shubhora Growth — ₹2,999 a month" is
// found or made once; each customer gets a subscription on it. Every debit — the first one at checkout, and each month
// after that through the webhook — goes through applyAutopayCharge(): one more month of Growth (apply_saas_payment,
// safe to call twice for the same payment), the partner panel's BV, and a "payment received" message.
import Razorpay from "razorpay";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
import { SAAS_PLANS, type SaasTier } from "@/lib/billing";
import { notify } from "@/lib/notify";
import { reportPaidToPartner } from "@/lib/partner-link";

export const AUTOPAY_TIER: SaasTier = "growth";
/** Monthly debits a mandate allows before the customer is asked again (5 years). */
const TOTAL_COUNT = 60;
/** Razorpay states in which the mandate is (or is about to be) debiting every month. */
export const LIVE_STATES = ["authenticated", "active", "pending"];

export type AutopayRow = { id: string; owner_id: string; tier: string; status: string; charge_at: string | null; paid_count: number; created_at: string; updated_at: string };

export function razorpay(): Razorpay {
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });
}

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPA_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers ?? {}) }, cache: "no-store" });

const PLAN_KEY = `shubhora-${AUTOPAY_TIER}-${SAAS_PLANS[AUTOPAY_TIER].amount}`;
let planId: string | null = process.env.RAZORPAY_PLAN_GROWTH || null;

/** The Razorpay plan for Growth: RAZORPAY_PLAN_GROWTH if set, else the one we made before (notes.key), else a new one.
 *  The key carries the price, so a price change makes a fresh plan and never moves running mandates. */
export async function growthPlanId(): Promise<string> {
  if (planId) return planId;
  const rzp = razorpay();
  for (let skip = 0; skip < 500; skip += 100) {
    const page = await rzp.plans.all({ count: 100, skip });
    const hit = page.items.find((p) => String(p.notes?.key ?? "") === PLAN_KEY && p.period === "monthly" && Number(p.item?.amount) === SAAS_PLANS[AUTOPAY_TIER].amount);
    if (hit) return (planId = hit.id);
    if (page.items.length < 100) break;
  }
  const p = SAAS_PLANS[AUTOPAY_TIER];
  const made = await rzp.plans.create({
    period: "monthly", interval: 1,
    item: { name: `Shubhora ${p.label}`, amount: p.amount, currency: "INR", description: `${p.label} plan — every month, GST included` },
    notes: { key: PLAN_KEY },
  });
  return (planId = made.id);
}

/** This customer's newest autopay, or null. */
export async function latestAutopay(ownerId: string): Promise<AutopayRow | null> {
  const r = await rest(`saas_autopay?owner_id=eq.${ownerId}&order=created_at.desc&limit=1`);
  const rows = r.ok ? ((await r.json()) as AutopayRow[]) : [];
  return rows[0] ?? null;
}

/** Save what Razorpay says about a subscription (insert or update). */
export async function saveAutopay(s: { id: string; owner_id: string; status: string; charge_at?: number | null; paid_count?: number }) {
  const row: Record<string, unknown> = { id: s.id, owner_id: s.owner_id, tier: AUTOPAY_TIER, status: s.status, updated_at: new Date().toISOString() };
  if (s.charge_at !== undefined) row.charge_at = s.charge_at ? new Date(s.charge_at * 1000).toISOString() : null;
  if (s.paid_count !== undefined) row.paid_count = s.paid_count;
  const r = await rest("saas_autopay?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
  if (!r.ok) console.error("[autopay] save failed", s.id, r.status, await r.text().catch(() => ""));
}

/** A new mandate for this customer. */
export async function createAutopay(ownerId: string) {
  const sub = await razorpay().subscriptions.create({
    plan_id: await growthPlanId(), total_count: TOTAL_COUNT, quantity: 1, customer_notify: 1,
    notes: { owner_id: ownerId, saas: AUTOPAY_TIER },
  });
  await saveAutopay({ id: sub.id, owner_id: ownerId, status: sub.status, charge_at: sub.charge_at ?? null, paid_count: sub.paid_count ?? 0 });
  return sub;
}

/** One debit of the mandate → one more month of Growth. Returns whether this call applied it (false = already done). */
export async function applyAutopayCharge(ownerId: string, p: { paymentId: string; subscriptionId: string; amount: number }) {
  const plan = SAAS_PLANS[AUTOPAY_TIER];
  if (p.amount !== plan.amount) return { applied: false, reason: "not a monthly debit" as const };
  const r = await rest("rpc/apply_saas_payment", {
    method: "POST",
    body: JSON.stringify({ p_user: ownerId, p_tier: AUTOPAY_TIER, p_ref: p.paymentId, p_order_ref: p.subscriptionId, p_amount: p.amount, p_credits: plan.credits }),
  });
  if (!r.ok) throw new Error(`apply_saas_payment: ${r.status} ${await r.text().catch(() => "")}`);
  const data = (await r.json()) as { replayed?: boolean; expires?: string };
  if (data.replayed) return { applied: false, reason: "already applied" as const, expires: data.expires ?? null };
  // Every month's debit is Growth business for the partner panel — the first as a new sale, later ones as renewals
  // (the panel tells them apart). Logged, never shown as a failed payment.
  await reportPaidToPartner(ownerId, { totalPaise: p.amount, tier: AUTOPAY_TIER, ref: p.paymentId }).catch(() => undefined);
  const until = data.expires ? new Date(data.expires).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
  await notify(ownerId, "payment", {
    title: "Payment received",
    body: `Thank you. Your ${plan.label} plan is active${until ? ` till ${until}` : ""}.`,
    path: "/poster/plan", ref: p.paymentId,
  }).catch(() => undefined);
  return { applied: true, reason: "ok" as const, expires: data.expires ?? null };
}
