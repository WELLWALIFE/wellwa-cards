// Razorpay → Shubhora: what happens to autopay mandates after checkout.
//
//   Razorpay Dashboard → Account & Settings → Webhooks → https://shubhora.com/api/billing/webhook
//   events: subscription.* (charged, activated, authenticated, pending, halted, cancelled, completed, paused, resumed)
//   secret: RAZORPAY_WEBHOOK_SECRET in the server's .env.local (scripts/set-razorpay-webhook.sh sets both sides up)
//
// subscription.charged = a monthly debit went through → one more month of Growth + partner BV (applyAutopayCharge,
// counted once even if Razorpay sends the event again). Every event also stores the mandate's state, so we always know
// the truth (active, stopped from the UPI app, failing …). A debit that fails simply adds no month — the plan ends as usual.
// Always answers 200 for what it has understood or safely ignored — Razorpay retries anything else.
import crypto from "node:crypto";
import { AUTOPAY_TIER, applyAutopayCharge, saveAutopay } from "@/lib/autopay";

type Entity = Record<string, unknown> & { id?: string; notes?: Record<string, string> | null };
type Event = { event?: string; payload?: { subscription?: { entity?: Entity }; payment?: { entity?: Entity } } };

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret) return Response.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  let ev: Event;
  try { ev = JSON.parse(raw) as Event; } catch { return Response.json({ ok: true, ignored: "bad json" }); }
  const name = String(ev.event ?? "");
  const sub = ev.payload?.subscription?.entity;
  if (!name.startsWith("subscription.") || !sub?.id) return Response.json({ ok: true, ignored: name || "no event" });
  const owner = String(sub.notes?.owner_id ?? "");
  if (!owner || String(sub.notes?.saas ?? "") !== AUTOPAY_TIER) return Response.json({ ok: true, ignored: "not a Shubhora autopay" });

  try {
    await saveAutopay({
      id: String(sub.id), owner_id: owner, status: String(sub.status ?? name.split(".")[1]),
      charge_at: typeof sub.charge_at === "number" ? sub.charge_at : null,
      paid_count: typeof sub.paid_count === "number" ? sub.paid_count : undefined,
    });

    if (name === "subscription.charged") {
      const pay = ev.payload?.payment?.entity;
      if (pay?.id && ["captured", "authorized"].includes(String(pay.status))) {
        const res = await applyAutopayCharge(owner, { paymentId: String(pay.id), subscriptionId: String(sub.id), amount: Number(pay.amount) });
        return Response.json({ ok: true, event: name, applied: res.applied, reason: res.reason });
      }
    }

    return Response.json({ ok: true, event: name });
  } catch (e) {
    console.error("[autopay] webhook failed", name, sub.id, e);
    return Response.json({ error: "temporary failure" }, { status: 500 }); // Razorpay tries again
  }
}
