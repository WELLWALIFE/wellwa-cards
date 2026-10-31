// One payment request (/pay/<code>; src/lib/payments-server.ts).
//   GET  → what it is (anyone with the link), plus `mine` when the bearer is the account it applies to
//   POST { op: "order" }                                  → a Razorpay order for its amount (the payer, logged in)
//   POST { op: "verify", orderId, paymentId, signature }  → verify, mark paid, apply (plan months / advance / record)
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { publicRazorpayKey, razorpayConfigured } from "@/lib/billing";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { requestByCode, rememberOrder, settleRequest, signatureOk, isOpen } from "@/lib/payments-server";
import { requestEffect, requestTitle } from "@/lib/payments";

const rzp = () => new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await requestByCode(code);
  if (!r) return NextResponse.json({ error: "This payment link does not exist." }, { status: 404 });
  const me = await userFromRequest(request);
  const owner = (await restAsService<{ full_name: string | null; username: string | null }[]>(`profiles?id=eq.${r.owner_id}&select=full_name,username&limit=1`)).data?.[0];
  const hi = new URL(request.url).searchParams.get("lang") === "hi";
  return NextResponse.json({
    request: { code: r.code, kind: r.kind, tier: r.tier, months: r.months, amount_paise: r.amount_paise, title: requestTitle(r, hi), effect: requestEffect(r, hi), note: r.note, status: isOpen(r) ? "open" : r.status === "open" ? "expired" : r.status, paid_at: r.paid_at, created_role: r.created_role },
    for: { name: owner?.full_name ?? "", username: owner?.username ?? "" },
    mine: !!me && me.id === r.owner_id,
    loggedIn: !!me,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`pay:${me.id}`, 20, 60_000)) return NextResponse.json({ error: "Too many tries. Please wait a minute." }, { status: 429 });
  const r = await requestByCode(code);
  if (!r) return NextResponse.json({ error: "This payment link does not exist." }, { status: 404 });
  // The link applies to one account: the person must be logged in as that account (a franchise cannot pay in a user's place here).
  if (r.owner_id !== me.id) return NextResponse.json({ error: "This payment link was made for another account. Log in with that account to pay.", code: "other_account" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { op?: string; orderId?: string; paymentId?: string; signature?: string };
  if (!razorpayConfigured()) return NextResponse.json({ error: "Payments are temporarily unavailable." }, { status: 503 });

  if (b.op === "order") {
    if (!isOpen(r)) return NextResponse.json({ error: r.status === "paid" ? "This request is already paid." : "This payment link is closed." }, { status: 400 });
    try {
      const order = await rzp().orders.create({ amount: r.amount_paise, currency: "INR", receipt: `flex_${r.code}_${Date.now()}`.slice(0, 40), notes: { flex: r.code, owner_id: r.owner_id, kind: r.kind } });
      await rememberOrder(r.id, order.id);
      return NextResponse.json({ orderId: order.id, amount: r.amount_paise, keyId: publicRazorpayKey(), title: requestTitle(r, false) });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start the payment." }, { status: 502 }); }
  }

  if (b.op === "verify") {
    const { orderId, paymentId, signature } = b;
    if (!orderId || !paymentId || !signature) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (!signatureOk(orderId, paymentId, signature)) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    try {
      const [order, payment] = await Promise.all([rzp().orders.fetch(orderId), rzp().payments.fetch(paymentId)]);
      const amount = Number(order.amount);
      if (String(order.notes?.flex ?? "") !== r.code || String(order.notes?.owner_id ?? "") !== r.owner_id || amount !== r.amount_paise || order.currency !== "INR" ||
          payment.order_id !== orderId || Number(payment.amount) !== amount || !["authorized", "captured"].includes(payment.status)) {
        return NextResponse.json({ error: "payment details do not match" }, { status: 400 });
      }
      const s = await settleRequest(r, { paymentId, orderId, amount });
      if (!s.ok) return NextResponse.json({ error: s.error }, { status: 500 });
      return NextResponse.json({ ok: true, replayed: s.replayed, applied: s.applied });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "verification failed" }, { status: 500 }); }
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
