// One bill: GET it; PATCH to take a payment, cancel (with a reason — its stock comes back), send on WhatsApp, or turn an estimate
// into a bill. A bill is never deleted.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPayment } from "@/lib/jewellery";
import { BILL_COLS, type BillRow } from "@/lib/mobile";
import { billById, billLink, createBill, hideBillCost, moveStock, msCtx, msDenied, msHas, sendBill, shopOf, trueLines, withTotals } from "@/lib/mobile-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await msCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  const bill = await billById(c.scope.ownerId, id);
  if (!bill || (!msHas(c.access, "reports") && bill.created_by !== c.scope.userId)) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  return NextResponse.json({ bill: hideBillCost(bill, c.access), setup: c.setup, access: c.access, shop: await shopOf(c.scope.ownerId, c.setup), link: billLink(bill) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const bill = await billById(scope.ownerId, id);
  if (!bill || (!msHas(access, "reports") && bill.created_by !== scope.userId)) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  const save = async (patch: Partial<BillRow>) => {
    const next = { ...bill, ...patch } as BillRow;
    // A saved bill keeps the tax choice it was made with.
    const r = await restAsService<BillRow[]>(`ms_bills?id=eq.${bill.id}&owner_id=eq.${scope.ownerId}&select=${BILL_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, ...withTotals(next, bill.gst_on, setup.stateCode), updated_at: new Date().toISOString() }) });
    return Array.isArray(r.data) ? r.data[0] ?? null : null;
  };
  const out = (x: BillRow | null) => (x ? NextResponse.json({ bill: hideBillCost(x, access) }) : NextResponse.json({ error: "Could not save." }, { status: 500 }));
  switch (b.action) {
    case "pay": {
      if (bill.kind !== "sale" || bill.status === "cancelled") return NextResponse.json({ error: "Payments go on an open bill." }, { status: 400 });
      const p = cleanPayment(b.payment);
      if (!p) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
      if (p.paise > bill.balance_paise) return NextResponse.json({ error: `Only ₹${Math.round(bill.balance_paise / 100).toLocaleString("en-IN")} is due.` }, { status: 400 });
      return out(await save({ payments: [...(bill.payments ?? []), { ...p, at: new Date().toISOString() }] }));
    }
    case "cancel": {
      if (!msHas(access, "cancel")) return msDenied("cancel bills");
      if (bill.status === "cancelled") return NextResponse.json({ error: "Already cancelled." }, { status: 400 });
      const reason = String(b.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!reason) return NextResponse.json({ error: "Write why it is cancelled." }, { status: 400 });
      const next = await save({ status: "cancelled", cancel_reason: `${reason} — ${access.name}` });
      if (next && bill.kind === "sale") await moveStock(scope.ownerId, bill, 1).catch(() => undefined);
      return out(next);
    }
    case "send":
      return NextResponse.json(await sendBill(scope, setup, bill));
    case "convert": {
      if (bill.kind !== "estimate" || bill.status !== "open") return NextResponse.json({ error: "Only an open estimate becomes a bill." }, { status: 400 });
      if (!msHas(access, "bill")) return msDenied("make bills");
      const tl = await trueLines(scope.ownerId, bill.lines ?? [], "sale");
      if ("error" in tl) return NextResponse.json({ error: tl.error }, { status: 400 });
      const sale = await createBill(scope, setup, "sale", { customer_name: bill.customer_name, customer_phone: bill.customer_phone, customer_gstin: bill.customer_gstin, customer_state: bill.customer_state, lines: tl.lines, payments: [], discount_paise: bill.discount_paise, notes: bill.notes, due_date: null, client_id: null, created_by: scope.userId, created_by_name: access.name });
      if (!sale) return NextResponse.json({ error: "Could not make the bill." }, { status: 500 });
      await save({ status: "converted" });
      return NextResponse.json({ bill: hideBillCost(sale, access) });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
