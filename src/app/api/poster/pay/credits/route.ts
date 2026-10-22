// Buy credits in-app (Razorpay). GET → the packs this user can buy (subscribers get the cheaper list);
// POST {pack} → order; POST {orderId,paymentId,signature,pack} → verify + grant.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { packsFor } from "@/lib/media/ad-pricing";
/** Payments being granted right now (this process): a double tap or a retry must not grant the same payment twice. */
const granting = new Set<string>();
const KEY = process.env.RAZORPAY_KEY_ID ?? "", SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
/** Subscribed = trial or paid plan still running (profiles), which earns the cheaper credit price. */
async function isSubscribed(userId: string): Promise<boolean> {
  const r = await restAsService<{ plan: string | null; plan_expires_at: string | null; saas_expires_at: string | null }[]>(`profiles?id=eq.${userId}&select=plan,plan_expires_at,saas_expires_at`);
  const p = r.data?.[0];
  const until = Math.max(...[p?.plan_expires_at, p?.saas_expires_at].map((d) => (d ? new Date(d).getTime() : 0)));
  return !!p && p.plan !== "free" && until > Date.now();
}

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const subscribed = await isSubscribed(me.id);
  return NextResponse.json({ subscribed, packs: packsFor(subscribed).map((p) => ({ credits: p.credits, paise: p.paise })) });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!KEY || !SECRET) return NextResponse.json({ error: "not_configured", message: "Online payment is being set up — WhatsApp par credits lein." }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  if (!b.paymentId) {
    const pack = packsFor(await isSubscribed(me.id)).find((p) => p.credits === Number(b.pack));
    if (!pack) return NextResponse.json({ error: "bad pack" }, { status: 400 });
    const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ amount: pack.paise, currency: "INR", receipt: `cr-${me.id.slice(0, 8)}-${Date.now()}`, notes: { user_id: me.id, credits: String(pack.credits) } }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r || !j) return NextResponse.json({ error: "Could not reach the payment service. Please try again." }, { status: 502 });
    if (!r.ok) return NextResponse.json({ error: j.error?.description ?? "order failed" }, { status: 502 });
    return NextResponse.json({ orderId: j.id, amount: j.amount, currency: j.currency, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || KEY, credits: pack.credits });
  }
  const { orderId, paymentId, signature } = b;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || !orderId || !paymentId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const want = crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  if (typeof signature !== "string" || Buffer.byteLength(signature) !== want.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(signature))) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const o = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: auth } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // The pack is the one the ORDER was made for (its notes and amount), not today's price list: a plan that ran out
  // (or began) between paying and verifying must not turn a paid order into "order mismatch".
  const pack = [...packsFor(true), ...packsFor(false)].find((p) => String(p.credits) === String(o?.notes?.credits ?? "") && p.paise === Number(o?.amount));
  if (!o || o.notes?.user_id !== me.id || o.currency !== "INR" || !pack) return NextResponse.json({ error: "order mismatch" }, { status: 400 });
  if (granting.has(paymentId)) return NextResponse.json({ error: "Already being added — please wait a moment." }, { status: 409 });
  granting.add(paymentId);
  try {
    // idempotent via the ledger reference
    const dup = await restAsService<{ id: string }[]>(`credit_ledger?ref=eq.${encodeURIComponent(paymentId)}&select=id`);
    if (!dup.ok) return NextResponse.json({ error: "Please try again in a moment." }, { status: 503 });
    if (!dup.data?.length) {
      const g = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/grant_credits`, { method: "POST", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_user: me.id, p_amount: pack.credits, p_reason: "purchase", p_ref: paymentId }) }).catch(() => null);
      if (!g?.ok) return NextResponse.json({ error: "grant failed" }, { status: 500 });
    }
  } finally { granting.delete(paymentId); }
  return NextResponse.json({ ok: true, credits: pack.credits });
}
