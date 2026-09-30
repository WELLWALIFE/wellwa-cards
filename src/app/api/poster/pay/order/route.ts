// POST { plan } → Razorpay order for a Shubhora plan (bearer auth).
// Prices live here and in verify (server-side only; the client never sets an amount).
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { userFromRequest } from "@/lib/poster-server";

type PosterPaidPlan = "personal" | "business";
/** Amounts in paise: Personal ₹199 / month, Business ₹499 / month. Keep in sync with ../verify/route.ts (route files may only export handlers). */
const POSTER_PLAN_PAISE: Record<PosterPaidPlan, number> = { personal: 19900, business: 49900 };

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const keyId = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return NextResponse.json({ error: "Online payment is not available right now." }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const plan = b.plan as PosterPaidPlan;
  const amount = POSTER_PLAN_PAISE[plan];
  if (!amount) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  try {
    const rzp = new Razorpay({ key_id: keyId, key_secret: secret });
    const order = await rzp.orders.create({
      amount, currency: "INR",
      receipt: `poster-${me.id.slice(0, 8)}-${Date.now()}`, // Razorpay caps receipts at 40 chars
      notes: { user_id: me.id, plan },
    });
    return NextResponse.json({ orderId: order.id, amount, currency: "INR", keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId, plan });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create order." }, { status: 500 });
  }
}
