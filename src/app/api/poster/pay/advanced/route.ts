// Advanced website (Rs 5,999, owner 15-16 Oct 2026). Flags are documented in src/lib/advanced-access.ts:
// ADVANCED_SITE_OPEN=1 lets reviewers in free; ADVANCED_SITE_SELL=1 lets the order be created (default: closed, 503).
// GET → {allowed, reason, price, openForReview}; POST {} → Razorpay order; POST {orderId,paymentId,signature} → verify + grant.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { ADVANCED_PRICE_PAISE, ADVANCED_UPGRADE_PAISE, advancedPriceFor, isAdvancedAllowed, readAdvancedMeta, grantAdvanced } from "@/lib/advanced-access";
const KEY = process.env.RAZORPAY_KEY_ID ?? "", SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const PRODUCT = "advanced-site";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const a = await isAdvancedAllowed(me.id);
  const pr = await advancedPriceFor(me.token);
  const triesLeft = a.allowed ? (await readAdvancedMeta(me.id))?.triesLeft : undefined;
  return NextResponse.json({ allowed: a.allowed, reason: a.reason ?? null, price: pr.rupees, growth: pr.growth, triesLeft, openForReview: process.env.ADVANCED_SITE_OPEN === "1", selling: process.env.ADVANCED_SITE_SELL === "1" });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const verifying = !!b.paymentId;
  // Closed until the owner has reviewed the feature. A payment already made is still verified below, so money taken is never orphaned.
  if (!verifying && process.env.ADVANCED_SITE_SELL !== "1") return NextResponse.json({ error: "advanced_closed" }, { status: 503 });
  if (!KEY || !SECRET) return NextResponse.json({ error: "not_configured", message: "Online payment is being set up — WhatsApp par sampark karein." }, { status: 503 });
  const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  if (!verifying) {
    const have = await readAdvancedMeta(me.id);
    // lookup failed: do not open a second order for someone who may have paid already
    if (have === undefined) return NextResponse.json({ error: "Please try again in a moment." }, { status: 503 });
    if (have?.paid === true) return NextResponse.json({ error: "already_paid" }, { status: 409 });
    // amount is fixed here on the server (the difference for a running Growth plan); nothing the client sends is used
    const pr = await advancedPriceFor(me.token);
    const r = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ amount: pr.paise, currency: "INR", receipt: `adv-${me.id.slice(0, 8)}-${Date.now()}`, notes: { user_id: me.id, product: PRODUCT, ...(pr.growth ? { growth: "1" } : {}) } }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r || !j) return NextResponse.json({ error: "Could not reach the payment service. Please try again." }, { status: 502 });
    if (!r.ok) return NextResponse.json({ error: j.error?.description ?? "order failed" }, { status: 502 });
    return NextResponse.json({ orderId: j.id, amount: j.amount, currency: j.currency, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || KEY, price: pr.rupees, growth: pr.growth });
  }
  const { orderId, paymentId, signature } = b;
  if (typeof orderId !== "string" || typeof paymentId !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const want = crypto.createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  if (typeof signature !== "string" || want.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(signature))) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const or = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: auth } }).catch(() => null);
  if (!or) return NextResponse.json({ error: "Could not reach the payment service. Please try again." }, { status: 502 });
  const o = or.ok ? await or.json().catch(() => null) : null;
  if (!o || o.notes?.user_id !== me.id || o.notes?.product !== PRODUCT || ![ADVANCED_PRICE_PAISE, ADVANCED_UPGRADE_PAISE].includes(Number(o.amount)) || (Number(o.amount) === ADVANCED_UPGRADE_PAISE && o.notes?.growth !== "1") || o.currency !== "INR") return NextResponse.json({ error: "order mismatch" }, { status: 400 });
  // idempotent: the same paymentId (or an account already paid) never re-grants or resets the tries
  const meta = await readAdvancedMeta(me.id);
  if (meta === undefined) return NextResponse.json({ error: "Please try again in a moment." }, { status: 503 });
  if (meta?.paid === true) return NextResponse.json({ ok: true, already: true });
  const dup = await restAsService<{ id: string }[]>(`credit_ledger?reason=eq.advanced-site&ref=eq.${encodeURIComponent(paymentId)}&select=id`);
  if (!dup.data?.length) {
    // audit row only (delta 0, no credits move); best effort, the metadata below is the entitlement
    await restAsService("credit_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: me.id, delta: 0, reason: "advanced-site", ref: paymentId }) }).catch(() => null);
  }
  if (!(await grantAdvanced(me.id, paymentId))) return NextResponse.json({ error: "grant failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
