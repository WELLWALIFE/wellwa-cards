// POST { orderId, paymentId, signature, plan } → verify the Razorpay signature,
// record the payment (idempotent on payment id) and extend the plan by 1 month
// from max(now, current expiry). Bearer auth; writes use the service role.
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { userFromRequest, restAsService } from "@/lib/poster-server";

type PosterPaidPlan = "personal" | "business";
/** Amounts in paise — must match ../order/route.ts. */
const POSTER_PLAN_PAISE: Record<PosterPaidPlan, number> = { personal: 19900, business: 49900 };

type PaymentRow = { id: string; user_id: string; plan: string };
type ProfileRow = { poster_plan: string; poster_plan_expires_at: string | null };

/** Same calendar day next month (clamped: Jan 31 → Feb 28/29). */
function plusOneMonth(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  const keyId = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return NextResponse.json({ ok: false, error: "Online payment is not available right now." }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const orderId = String(b.orderId ?? ""), paymentId = String(b.paymentId ?? ""), signature = String(b.signature ?? "");
  const plan = b.plan as PosterPaidPlan;
  const amount = POSTER_PLAN_PAISE[plan];
  if (!orderId || !paymentId || !signature || !amount) return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });

  // 1. HMAC-SHA256(order|payment, secret) must equal the signature Razorpay handed the client.
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  try {
    // 2. The order must be ours, for this user and this plan's price.
    const rzp = new Razorpay({ key_id: keyId, key_secret: secret });
    const order = await rzp.orders.fetch(orderId);
    if (Number(order.amount) !== amount || order.currency !== "INR" || String(order.notes?.user_id ?? "") !== me.id || String(order.notes?.plan ?? "") !== plan) {
      return NextResponse.json({ ok: false, error: "Payment details do not match." }, { status: 400 });
    }

    // 3. Idempotent: an already-recorded payment returns the current state without extending again.
    const seen = await restAsService<PaymentRow[]>(`poster_payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&select=id,user_id,plan`);
    const prof = await restAsService<ProfileRow[]>(`profiles?id=eq.${me.id}&select=poster_plan,poster_plan_expires_at`);
    const cur = prof.data?.[0];
    if (seen.data?.[0]) return NextResponse.json({ ok: true, plan: cur?.poster_plan ?? plan, expires_at: cur?.poster_plan_expires_at ?? null, repeated: true });

    const ins = await restAsService(`poster_payments`, {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: me.id, plan, amount_paise: amount, razorpay_order_id: orderId, razorpay_payment_id: paymentId }),
    });
    if (!ins.ok) {
      if (ins.status === 409) return NextResponse.json({ ok: true, plan: cur?.poster_plan ?? plan, expires_at: cur?.poster_plan_expires_at ?? null, repeated: true });
      throw new Error(ins.text || "Could not record payment.");
    }

    // 4. Extend: +1 month from whichever is later, now or the current expiry.
    const now = Date.now();
    const curExp = cur?.poster_plan_expires_at ? new Date(cur.poster_plan_expires_at).getTime() : 0;
    const expiresAt = plusOneMonth(new Date(Math.max(now, curExp))).toISOString();
    const upd = await restAsService<ProfileRow[]>(`profiles?id=eq.${me.id}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ poster_plan: plan, poster_plan_expires_at: expiresAt }),
    });
    if (!upd.ok) throw new Error(upd.text || "Could not activate plan.");
    return NextResponse.json({ ok: true, plan, expires_at: expiresAt });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Verification failed." }, { status: 500 });
  }
}
