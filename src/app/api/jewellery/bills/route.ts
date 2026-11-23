// Bills and estimates: GET the list (search, kind, money due), POST a new one. The totals are always worked out here from the
// lines (src/lib/jewellery.ts billTotals), never taken from the app.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { BILL_COLS, billTotals, cleanLine, cleanOld, cleanPayment, type BillKind, type BillRow, type Payment } from "@/lib/jewellery";
import { createBill, istDay, jwCtx, jwDenied, jwHas, rateOf, sendBill } from "@/lib/jewellery-server";
import { orderPaid } from "@/lib/jewellery-orders";
import { orderById, patchOrder } from "@/lib/jewellery-orders-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const c = await jwCtx(request, u.get("as"));
  if (!c.ok) return c.res;
  const all = jwHas(c.access, "reports");
  const p: string[] = [`owner_id=eq.${c.scope.ownerId}`, `select=${BILL_COLS}`, "order=created_at.desc", `limit=${Math.min(200, Number(u.get("limit")) || 60)}`];
  if (!all) p.push(`created_by=eq.${c.scope.userId}`);
  const kind = u.get("kind");
  if (kind === "sale" || kind === "estimate") p.push(`kind=eq.${kind}`);
  if (u.get("view") === "due") p.push("kind=eq.sale", "status=eq.open", "balance_paise=gt.0");
  const phone = u.get("phone");
  if (phone) p.push(`customer_phone=eq.${encodeURIComponent(cleanPhone(phone))}`);
  const q = txt(u.get("q"), 40).replace(/[^\p{L}\p{N} /+-]/gu, "");
  if (q) p.push(`or=(customer_name.ilike.*${encodeURIComponent(q)}*,customer_phone.ilike.*${encodeURIComponent(q.replace(/\D/g, "") || q)}*,code.ilike.*${encodeURIComponent(q)}*)`);
  const from = u.get("from"), to = u.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) p.push(`created_at=gte.${new Date(`${from}T00:00:00+05:30`).toISOString()}`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) p.push(`created_at=lt.${new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400_000).toISOString()}`);
  const r = await restAsService<BillRow[]>(`jw_bills?${p.join("&")}`);
  return NextResponse.json({ bills: list(r) });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!jwHas(access, "bill")) return jwDenied("make bills");
  const kind: BillKind = b.kind === "estimate" ? "estimate" : "sale";
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 60).map(cleanLine).filter((l) => l.grossMg > 0 || l.netMg > 0 || l.otherPaise > 0 || l.stonePaise > 0);
  if (!lines.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
  const old_gold = (Array.isArray(b.old_gold) ? b.old_gold : []).slice(0, 30).map(cleanOld).filter((o) => o.grossMg > 0);
  const payments = (Array.isArray(b.payments) ? b.payments : []).slice(0, 20).map(cleanPayment).filter((x): x is Payment => !!x);
  // A bill made from an order: the order's advance counts here (read from the order, never typed), and the order is delivered with it.
  const order = kind === "sale" && typeof b.order_id === "string" && b.order_id ? await orderById(scope.ownerId, b.order_id) : null;
  if (order && (order.kind !== "order" || order.status === "delivered" || order.status === "cancelled")) return NextResponse.json({ error: "This order is already closed." }, { status: 400 });
  const fields = {
    customer_name: txt(b.customer_name, 80), customer_phone: cleanPhone(b.customer_phone), customer_pan: txt(b.customer_pan, 10).toUpperCase(),
    customer_gstin: txt(b.customer_gstin, 15).toUpperCase(), customer_state: /^\d{2}$/.test(String(b.customer_state ?? "")) ? String(b.customer_state) : "",
    customer_address: txt(b.customer_address, 200),
    lines, old_gold, payments: kind === "estimate" ? [] : payments,
    discount_paise: Math.max(0, Math.round(Number(b.discount_paise) || 0)), discount_on: (b.discount_on === "total" ? "total" : "making") as "making" | "total",
    advance_paise: order ? orderPaid(order) : Math.max(0, Math.round(Number(b.advance_paise) || 0)),
    rate_day: (await rateOf(scope.ownerId))?.day ?? istDay(), notes: txt(b.notes, 400),
    due_date: typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null,
    valid_till: kind === "estimate" && typeof b.valid_till === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.valid_till) ? b.valid_till : null,
    from_estimate: null, created_by: scope.userId, created_by_name: access.name,
  };
  const t = billTotals({ lines, old: old_gold, payments: fields.payments, discountPaise: fields.discount_paise, discountOn: fields.discount_on, customerState: fields.customer_state, advancePaise: fields.advance_paise }, setup);
  // A counter may give a discount up to the shop's limit (a share of the making); more needs the "discount" right.
  if (t.discount > Math.round((t.making * setup.counterDiscountBp) / 10000) && !jwHas(access, "discount")) {
    return NextResponse.json({ error: `This discount is more than you may give (${setup.counterDiscountBp / 100}% of making). Ask the owner.`, code: "discount" }, { status: 403 });
  }
  // A sale at or above the shop's limit needs the customer's PAN (Income Tax rules on high-value sales).
  if (kind === "sale" && setup.panAbovePaise > 0 && t.total >= setup.panAbovePaise && !/^[A-Z]{5}\d{4}[A-Z]$/.test(fields.customer_pan)) {
    return NextResponse.json({ error: "This bill needs the customer's PAN (10 letters/digits, e.g. ABCDE1234F).", code: "pan" }, { status: 400 });
  }
  const bill = await createBill(scope, setup, kind, fields);
  if (!bill) return NextResponse.json({ error: "Could not save the bill. Please try again." }, { status: 500 });
  if (order) {
    await restAsService(`jw_bills?id=eq.${bill.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: order.id }) });
    await patchOrder(scope.ownerId, order.id, { status: "delivered", bill_id: bill.id, delivered_at: new Date().toISOString(),
      events: [...(order.events ?? []), { at: new Date().toISOString(), by: access.name, text: `Delivered with bill ${bill.code}` }] });
  }
  const sent = b.send === true && bill.customer_phone ? await sendBill(scope, bill) : null;
  return NextResponse.json({ bill, sent });
}
