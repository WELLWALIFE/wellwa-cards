// The customer approved the autopay mandate in Razorpay checkout: check Razorpay's signature, then apply the first
// month. The webhook (subscription.charged) may bring the same payment too — apply_saas_payment counts it once.
import crypto from "node:crypto";
import { razorpayConfigured } from "@/lib/billing";
import { requireUser, sameOrigin } from "@/lib/api-security";
import { applyAutopayCharge, growthPlanId, razorpay, saveAutopay } from "@/lib/autopay";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ ok: false, error: "sign in required" }, { status: 401 });
  if (!razorpayConfigured()) return Response.json({ ok: false, error: "Payments are not configured." }, { status: 503 });

  const b = (await request.json().catch(() => ({}))) as { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string };
  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subId, razorpay_signature: sig } = b;
  if (!paymentId || !subId || !sig) return Response.json({ ok: false, error: "missing fields" }, { status: 400 });

  // Razorpay signs "<payment id>|<subscription id>" with the key secret.
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${paymentId}|${subId}`).digest("hex");
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return Response.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  try {
    const rzp = razorpay();
    const [sub, payment, plan] = await Promise.all([rzp.subscriptions.fetch(subId), rzp.payments.fetch(paymentId), growthPlanId()]);
    if (String(sub.notes?.owner_id ?? "") !== session.user.id || sub.plan_id !== plan ||
        !["authorized", "captured"].includes(payment.status)) {
      return Response.json({ ok: false, error: "payment details do not match" }, { status: 400 });
    }
    await saveAutopay({ id: sub.id, owner_id: session.user.id, status: sub.status, charge_at: sub.charge_at ?? null, paid_count: sub.paid_count ?? 0 });
    const res = await applyAutopayCharge(session.user.id, { paymentId, subscriptionId: subId, amount: Number(payment.amount) });
    return Response.json({ ok: true, applied: res.applied, expires: res.expires ?? null, status: sub.status });
  } catch (e) {
    console.error("[autopay] verify failed", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "verification failed" }, { status: 500 });
  }
}
