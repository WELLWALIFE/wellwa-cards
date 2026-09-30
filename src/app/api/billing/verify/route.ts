// Verify a Razorpay payment signature server-side. Returns { ok: true } when
// the signature matches; the client then records the plan via record_payment.

import { notify } from "@/lib/notify";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { CARD_RENEWAL, PLAN_PRICE, SAAS_PLANS, razorpayConfigured, type PaidPlan, type SaasTier } from "@/lib/billing";
import { requireUser, sameOrigin } from "@/lib/api-security";
import { reportPaidToPartner } from "@/lib/partner-link";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ ok: false, error: "sign in required" }, { status: 401 });
  const body = (await request.json()) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpayConfigured()) {
    return Response.json({ ok: false, error: "Payments are not configured." }, { status: 503 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return Response.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected.length !== razorpay_signature.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
    return Response.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id),
    ]);
    const card = String(order.notes?.plan ?? "") === "card";
    const tier = (card ? "" : String(order.notes?.saas ?? "")) as SaasTier;
    const plan = String(order.notes?.plan ?? "") as PaidPlan;
    const expectedPrice = card ? CARD_RENEWAL : tier ? SAAS_PLANS[tier] : PLAN_PRICE[plan];
    const amount = Number(order.amount);
    if (!expectedPrice || amount !== expectedPrice.amount || order.currency !== "INR" ||
        String(order.notes?.owner_id ?? "") !== session.user.id ||
        payment.order_id !== razorpay_order_id || Number(payment.amount) !== amount ||
        !["authorized", "captured"].includes(payment.status)) {
      return Response.json({ ok: false, error: "payment details do not match" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("billing service is not configured");
    const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = card
      ? await admin.rpc("apply_card_renewal", { p_user: session.user.id, p_ref: razorpay_payment_id, p_order_ref: razorpay_order_id, p_amount: amount })
      : tier
      ? await admin.rpc("apply_saas_payment", { p_user: session.user.id, p_tier: tier, p_ref: razorpay_payment_id, p_order_ref: razorpay_order_id, p_amount: amount, p_credits: SAAS_PLANS[tier].credits })
      : await admin.rpc("apply_verified_payment", { p_user: session.user.id, p_plan: plan, p_ref: razorpay_payment_id, p_order_ref: razorpay_order_id, p_amount: amount });
    if (error) throw error;
    // Every account is a partner account: the payment turns their ID green (or renews it) and pays the team.
    // Reported after the plan is applied; a partner-side failure is logged, never shown as a failed payment.
    // A ₹1,499 V-Card renewal is NOT reported: BV comes only from Growth (owner's call, 27 Sep 2026).
    if (tier && !card) await reportPaidToPartner(session.user.id, { totalPaise: amount, tier, ref: razorpay_payment_id }).catch(() => undefined);
    const until = card && data?.expires ? new Date(String(data.expires)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
    await notify(session.user.id, "payment", card
      ? { title: "V-Card renewed", body: `Thank you. Your V-Card is active${until ? ` till ${until}` : " for one more year"}.`, path: "/poster/plan", ref: razorpay_payment_id }
      : { title: "Payment received", body: "Thank you. Your Shubhora plan is active.", path: "/settings", ref: razorpay_payment_id }).catch(() => undefined);
    return Response.json({ ok: true, paymentId: razorpay_payment_id, plan: card ? "card" : tier ? `saas:${tier}` : plan, result: data });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "verification failed" }, { status: 500 });
  }
}
