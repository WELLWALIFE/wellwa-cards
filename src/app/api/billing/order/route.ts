// Create a Razorpay order for a plan upgrade.
// Demo mode (no keys): returns { demo: true } so the client can simulate success.

import Razorpay from "razorpay";
import { CARD_RENEWAL, PLAN_PRICE, SAAS_PLANS, razorpayConfigured, publicRazorpayKey, type PaidPlan, type SaasTier } from "@/lib/billing";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `billing-order:${session.user.id}`), 10, 60_000)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }
  const { plan } = (await request.json()) as { plan: PaidPlan | `saas:${SaasTier}` | "card" };
  // "saas:growth" / "saas:pro" = the all-in-one subscription; plain "pro" / "team" stay the older card plans;
  // "card" = one more year of the V-Card after its free year (₹1,499, not partner business).
  const card = plan === "card";
  const tier = !card && typeof plan === "string" && plan.startsWith("saas:") ? (plan.slice(5) as SaasTier) : null;
  const price = card ? CARD_RENEWAL : tier ? SAAS_PLANS[tier] : PLAN_PRICE[plan as PaidPlan];
  if (!price) return Response.json({ error: "invalid plan" }, { status: 400 });
  // Growth is taken only by autopay now (owner's call, 27 Sep 2026) — /api/billing/autopay.
  if (tier === "growth") return Response.json({ error: "Growth is now taken with autopay — please refresh the page and try again." }, { status: 400 });

  if (!razorpayConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      return Response.json({ demo: true, plan, amount: price.amount });
    }
    return Response.json({ error: "Payments are temporarily unavailable." }, { status: 503 });
  }

  try {
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
    const order = await rzp.orders.create({
      amount: price.amount,
      currency: "INR",
      receipt: `wellwa_${String(plan).replace(":", "_")}_${Date.now()}`,
      notes: { plan: String(plan), owner_id: session.user.id, ...(tier ? { saas: tier } : {}), ...(card ? { card: "1" } : {}) },
    });
    return Response.json({
      demo: false,
      orderId: order.id,
      amount: price.amount,
      keyId: publicRazorpayKey(),
      plan,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "order failed" }, { status: 500 });
  }
}
