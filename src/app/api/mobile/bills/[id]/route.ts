// One bill: GET it; PATCH to take a payment, cancel (with a reason — its stock comes back), send on WhatsApp, or turn an estimate
// into a bill. A bill is never deleted.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPayment } from "@/lib/jewellery";
import { BILL_COLS, billTotals, returnLines, returnedQty, type BillRow } from "@/lib/mobile";
import { billById, billLink, createBill, hideBillCost, moveStock, msCtx, msDenied, msHas, sendBill, sendReminders, shopOf, trueLines, withTotals } from "@/lib/mobile-server";

type Ctx = { params: Promise<{ id: string }> };
const returnsOf = async (ownerId: string, billId: string) => (await restAsService<BillRow[]>(`ms_bills?owner_id=eq.${ownerId}&kind=eq.return&ref_bill_id=eq.${billId}&status=neq.cancelled&select=${BILL_COLS}&limit=100`)).data ?? [];

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await msCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  const bill = await billById(c.scope.ownerId, id);
  if (!bill || (!msHas(c.access, "reports") && bill.created_by !== c.scope.userId)) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  const returns = bill.kind === "sale" ? await returnsOf(c.scope.ownerId, bill.id) : [];
  const from = bill.ref_bill_id ? await billById(c.scope.ownerId, bill.ref_bill_id) : null;
  return NextResponse.json({ returned: returnedQty(bill, returns), returns: returns.map((r) => ({ id: r.id, code: r.code, total_paise: r.total_paise })), from: from ? { id: from.id, code: from.code } : null,
    bill: hideBillCost(bill, c.access), setup: c.setup, access: c.access, shop: await shopOf(c.scope.ownerId, c.setup), link: billLink(bill) });
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
      if (bill.kind === "return") return NextResponse.json({ error: "A return is not cancelled. If it was a mistake, make a new bill for those items." }, { status: 400 });
      if (bill.kind === "sale" && (await returnsOf(scope.ownerId, bill.id)).length) return NextResponse.json({ error: "Items of this bill were already returned, so it cannot be cancelled. Return the rest instead." }, { status: 400 });
      const reason = String(b.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!reason) return NextResponse.json({ error: "Write why it is cancelled." }, { status: 400 });
      const next = await save({ status: "cancelled", cancel_reason: `${reason} — ${access.name}` });
      if (next && bill.kind === "sale") {
        // A repair bill: its parts stay on the job (they left the stock there), and the job opens again as "ready".
        const job = (await restAsService<{ id: string; events: unknown[] | null }[]>(`ms_jobs?owner_id=eq.${scope.ownerId}&bill_id=eq.${bill.id}&select=id,events&limit=1`)).data?.[0];
        if (job) await restAsService(`ms_jobs?id=eq.${job.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "ready", bill_id: null, delivered_at: null, updated_at: new Date().toISOString(), events: [...(job.events ?? []), { at: new Date().toISOString(), by: access.name, text: `Bill ${bill.code} cancelled — job open again` }] }) });
        else await moveStock(scope.ownerId, bill, 1).catch(() => undefined);
      }
      return out(next);
    }
    case "return": {
      // Goods come back: a credit note for those pieces at what was really paid. It first clears this bill's udhaar; the rest
      // is given back in cash / UPI. Stock goes back in. The original bill is not changed (only a payment line is added).
      if (!msHas(access, "cancel")) return msDenied("take returns");
      if (bill.kind !== "sale" || bill.status === "cancelled") return NextResponse.json({ error: "Returns are taken on a live bill." }, { status: 400 });
      const job = (await restAsService<{ id: string }[]>(`ms_jobs?owner_id=eq.${scope.ownerId}&bill_id=eq.${bill.id}&select=id&limit=1`)).data?.[0];
      if (job) return NextResponse.json({ error: "This is a repair bill. Cancel the bill instead — the job opens again." }, { status: 400 });
      const want = Array.isArray(b.qty) ? b.qty.map((x) => Math.round(Number(x) || 0)) : [];
      const lines = returnLines(bill, returnedQty(bill, await returnsOf(scope.ownerId, bill.id)), want);
      if (!lines) return NextResponse.json({ error: "Type how many pieces came back (not more than were sold)." }, { status: 400 });
      const total = billTotals({ lines, payments: [], discountPaise: 0, customerState: bill.customer_state }, { gstOn: bill.gst_on, stateCode: setup.stateCode }).total;
      const adjust = Math.min(total, Math.max(0, bill.balance_paise)), refund = total - adjust;
      const mode = (["cash", "upi", "card", "bank"] as const).find((m) => m === b.mode) ?? "cash";
      const now = new Date().toISOString();
      const note = String(b.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
      const cn = await createBill(scope, { ...setup, gstOn: bill.gst_on }, "return", { customer_name: bill.customer_name, customer_phone: bill.customer_phone, customer_gstin: bill.customer_gstin, customer_state: bill.customer_state, lines,
        payments: refund > 0 ? [{ mode, paise: refund, ref: "Refund", at: now }] : [], discount_paise: 0, notes: [`Return against ${bill.code}`, note].filter(Boolean).join(" · "), due_date: null, client_id: null, ref_bill_id: bill.id, store: bill.store || "", created_by: scope.userId, created_by_name: access.name });
      if (!cn) return NextResponse.json({ error: "Could not save the return." }, { status: 500 });
      if (adjust > 0) await save({ payments: [...(bill.payments ?? []), { mode: "other", paise: adjust, ref: `Return ${cn.code}`, at: now }] });
      return NextResponse.json({ bill: hideBillCost(cn, access), refund, adjust });
    }
    case "send":
      return NextResponse.json(await sendBill(scope, setup, bill));
    case "remind": {
      // The customer's udhaar on WhatsApp now: one message with every bill they owe on.
      if (bill.kind !== "sale" || bill.status !== "open" || bill.balance_paise <= 0) return NextResponse.json({ error: "Nothing is due on this bill." }, { status: 400 });
      if (!bill.customer_phone) return NextResponse.json({ error: "No customer number on this bill." }, { status: 400 });
      const r = await sendReminders(scope, setup, { ids: [bill.id], minDays: 0, max: 1 });
      return NextResponse.json(r.sent ? { sent: true } : { sent: false, link: r.manual[0]?.link ?? "", error: "The shop's WhatsApp is not linked — send it with the button." });
    }
    case "convert": {
      if (bill.kind !== "estimate" || bill.status !== "open") return NextResponse.json({ error: "Only an open estimate becomes a bill." }, { status: 400 });
      if (!msHas(access, "bill")) return msDenied("make bills");
      const tl = await trueLines(scope.ownerId, bill.lines ?? [], "sale", setup.stores.length ? bill.store || "" : null);
      if ("error" in tl) return NextResponse.json({ error: tl.error }, { status: 400 });
      const sale = await createBill(scope, setup, "sale", { customer_name: bill.customer_name, customer_phone: bill.customer_phone, customer_gstin: bill.customer_gstin, customer_state: bill.customer_state, lines: tl.lines, payments: [], discount_paise: bill.discount_paise, notes: bill.notes, due_date: null, client_id: null, store: bill.store || "", created_by: scope.userId, created_by_name: access.name });
      if (!sale) return NextResponse.json({ error: "Could not make the bill." }, { status: 500 });
      await save({ status: "converted" });
      return NextResponse.json({ bill: hideBillCost(sale, access) });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
