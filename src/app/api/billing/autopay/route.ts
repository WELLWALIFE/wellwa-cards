// Start Growth by autopay: a Razorpay subscription for the signed-in customer, opened in Razorpay checkout, where they
// approve the mandate in their UPI app (PhonePe, Google Pay, Paytm, …) or with a card. The first month is debited
// there and then; /api/billing/autopay/verify confirms it and /api/billing/webhook handles every month after.
import { SAAS_PLANS, publicRazorpayKey, razorpayConfigured } from "@/lib/billing";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";
import { AUTOPAY_TIER, LIVE_STATES, createAutopay, latestAutopay } from "@/lib/autopay";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `billing-autopay:${session.user.id}`), 6, 60_000)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }
  if (!razorpayConfigured()) {
    if (process.env.NODE_ENV !== "production") return Response.json({ demo: true });
    return Response.json({ error: "Payments are temporarily unavailable." }, { status: 503 });
  }
  try {
    const last = await latestAutopay(session.user.id);
    // Already debiting every month: never a second mandate.
    if (last && LIVE_STATES.includes(last.status)) return Response.json({ already: true, status: last.status });
    // A mandate opened in the last hour but not approved (checkout closed): reuse it instead of making another.
    const reuse = last && last.status === "created" && Date.now() - Date.parse(last.created_at) < 3600_000 ? last.id : null;
    const id = reuse ?? (await createAutopay(session.user.id)).id;
    const p = SAAS_PLANS[AUTOPAY_TIER];
    return Response.json({ demo: false, subscriptionId: id, keyId: publicRazorpayKey(), amount: p.amount, label: p.label });
  } catch (e) {
    console.error("[autopay] start failed", e);
    const msg = (e as { error?: { description?: string } })?.error?.description || (e instanceof Error ? e.message : "");
    return Response.json({ error: msg || "Could not start autopay." }, { status: 500 });
  }
}
