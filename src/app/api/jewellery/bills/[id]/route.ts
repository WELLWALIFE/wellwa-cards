// One bill: GET it, PATCH to add a payment, set the due date, cancel (with a reason), send on WhatsApp, or turn an estimate
// into a bill. A bill is never deleted — a cancelled one stays with its reason.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { BILL_COLS, cleanPayment, type BillRow } from "@/lib/jewellery";
import { billById, billLink, createBill, jwCtx, jwDenied, jwHas, sendBill, withTotals } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  const bill = await billById(c.scope.ownerId, id);
  if (!bill || (!jwHas(c.access, "reports") && bill.created_by !== c.scope.userId)) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  return NextResponse.json({ bill, setup: c.setup, access: c.access, shop: await shopName(c.scope.ownerId), link: billLink(bill) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const bill = await billById(scope.ownerId, id);
  if (!bill || (!jwHas(access, "reports") && bill.created_by !== scope.userId)) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  const save = async (patch: Partial<BillRow>) => {
    const next = { ...bill, ...patch } as BillRow;
    const r = await restAsService<BillRow[]>(`jw_bills?id=eq.${bill.id}&owner_id=eq.${scope.ownerId}&select=${BILL_COLS}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, ...withTotals(next, setup), updated_at: new Date().toISOString() }),
    });
    return Array.isArray(r.data) ? r.data[0] ?? null : null;
  };

  switch (b.action) {
    case "pay": {
      if (bill.kind !== "sale" || bill.status === "cancelled") return NextResponse.json({ error: "Payments go on an open bill." }, { status: 400 });
      const p = cleanPayment(b.payment);
      if (!p) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
      const next = await save({ payments: [...(bill.payments ?? []), p] });
      return next ? NextResponse.json({ bill: next }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
    case "due": {
      const d = typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null;
      const next = await save({ due_date: d, notes: typeof b.notes === "string" ? b.notes.slice(0, 400) : bill.notes });
      return next ? NextResponse.json({ bill: next }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
    case "cancel": {
      if (!jwHas(access, "cancel")) return jwDenied("cancel bills");
      const reason = String(b.reason ?? "").trim().slice(0, 200);
      if (!reason) return NextResponse.json({ error: "Write why it is cancelled." }, { status: 400 });
      const next = await save({ status: "cancelled", cancel_reason: `${reason} — ${access.name}` });
      return next ? NextResponse.json({ bill: next }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
    case "send": {
      const r = await sendBill(scope, bill);
      return NextResponse.json(r);
    }
    case "convert": {
      if (bill.kind !== "estimate" || bill.status !== "open") return NextResponse.json({ error: "Only an open estimate becomes a bill." }, { status: 400 });
      if (!jwHas(access, "bill")) return jwDenied("make bills");
      const sale = await createBill(scope, setup, "sale", {
        customer_name: bill.customer_name, customer_phone: bill.customer_phone, customer_pan: bill.customer_pan, customer_gstin: bill.customer_gstin,
        customer_state: bill.customer_state, customer_address: bill.customer_address, lines: bill.lines, old_gold: bill.old_gold, payments: [],
        discount_paise: bill.discount_paise, discount_on: bill.discount_on, advance_paise: bill.advance_paise, rate_day: bill.rate_day,
        notes: bill.notes, due_date: null, valid_till: null, from_estimate: bill.id, created_by: scope.userId, created_by_name: access.name,
      });
      if (!sale) return NextResponse.json({ error: "Could not make the bill." }, { status: 500 });
      await save({ status: "converted" });
      return NextResponse.json({ bill: sale });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
