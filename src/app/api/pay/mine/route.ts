// The account's own flexible payments (bearer; src/lib/payments-server.ts).
//   GET → open requests made for me (by Shubhora / my franchise / myself), my advance balance and its lines
//   POST { op: "advance", amount_paise, note? }  → a request of my own: money kept on the account (then pay it at /api/pay/<code>)
//   POST { op: "use", months }                   → Standard for N months paid from the advance balance
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { SAAS_PLANS } from "@/lib/billing";
import { advanceBalance, advanceLines, cancelRequest, createRequest, requestsOf, spendAdvance, isOpen } from "@/lib/payments-server";
import { requestEffect, requestTitle } from "@/lib/payments";
import { CUSTOM_MARK, SITE_PKG, isSitePkg, pkgNote } from "@/lib/site-order";
import { openPackageRequests, orderState, sameOrder } from "@/lib/site-order-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const hi = new URL(request.url).searchParams.get("lang") === "hi";
  const [all, balance, lines] = await Promise.all([requestsOf(me.id), advanceBalance(me.id), advanceLines(me.id)]);
  const open = all.filter(isOpen).map((r) => ({ code: r.code, kind: r.kind, tier: r.tier, months: r.months, amount_paise: r.amount_paise, title: requestTitle(r, hi), effect: requestEffect(r, hi), note: r.note, created_role: r.created_role, created_at: r.created_at }));
  const paid = all.filter((r) => r.status === "paid").slice(0, 10).map((r) => ({ code: r.code, kind: r.kind, amount_paise: r.amount_paise, title: requestTitle(r, hi), paid_at: r.paid_at }));
  return NextResponse.json({ open, paid, balance, lines, standardPaise: SAAS_PLANS.growth.amount });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`pay-mine:${me.id}`, 10, 60_000)) return NextResponse.json({ error: "Too many tries. Please wait a minute." }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { op?: string; amount_paise?: number; note?: string; months?: number; pkg?: string; custom?: boolean };
  // A website package (lib/site-order.ts): one request per plan, used again however many times the plans page is opened.
  if (b.op === "package") {
    if (!isSitePkg(b.pkg)) return NextResponse.json({ error: "Choose Website Standard or Website Premium." }, { status: 400 });
    const st = await orderState(me.id);
    if (st.pkg === "site_premium" || st.pkg === "custom" || st.pkg === b.pkg) return NextResponse.json({ already: true, stage: st.stage });
    // One order at a time: the same one is used again (its time stays — the 24 hours run from the first tap); another choice replaces it.
    const custom = b.pkg === "site_premium" && b.custom === true;
    const open = await openPackageRequests(me.id);
    const have = open.find((r) => sameOrder(r, b.pkg as "site_standard" | "site_premium", custom));
    await Promise.all(open.filter((r) => r !== have).map((r) => cancelRequest(r.id)));
    if (have) return NextResponse.json({ ok: true, code: have.code, amount_paise: have.amount_paise });
    const made = await createRequest({ ownerId: me.id, createdBy: me.id, createdRole: "self", kind: "custom", amountPaise: SITE_PKG[b.pkg].amount, title: custom ? "Website Premium + Customise — 1 year (customising charged as per the work)" : SITE_PKG[b.pkg].title, note: custom ? `${pkgNote(b.pkg)} ${CUSTOM_MARK}` : pkgNote(b.pkg) });
    if (!made.ok) return NextResponse.json({ error: made.error }, { status: 400 });
    return NextResponse.json({ ok: true, code: made.request.code, amount_paise: made.request.amount_paise });
  }
  if (b.op === "advance") {
    const made = await createRequest({ ownerId: me.id, createdBy: me.id, createdRole: "self", kind: "advance", amountPaise: Number(b.amount_paise), note: b.note, expiresInDays: 7 });
    if (!made.ok) return NextResponse.json({ error: made.error }, { status: 400 });
    return NextResponse.json({ ok: true, code: made.request.code });
  }
  if (b.op === "use") {
    const r = await spendAdvance(me.id, Number(b.months) || 1);
    if (!r.ok) return NextResponse.json({ error: r.error, balance: r.balance }, { status: 400 });
    return NextResponse.json({ ok: true, expires: r.expires, balance: r.balance });
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
