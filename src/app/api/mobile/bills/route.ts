// Bills and estimates: GET the list (search, kind, money due), POST a new one. Totals, cost, HSN and tax always come from the
// server and the stock (lib/mobile.ts billTotals, lib/mobile-server.ts trueLines), never from the app.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { cleanPayment, type Payment } from "@/lib/jewellery";
import { BILL_COLS, billTotals, cleanLine, type BillKind, type BillRow } from "@/lib/mobile";
import { createBill, hideBillCost, msCtx, msDenied, msHas, sendBill, trueLines } from "@/lib/mobile-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const c = await msCtx(request, u.get("as"));
  if (!c.ok) return c.res;
  const all = msHas(c.access, "reports");
  const p: string[] = [`owner_id=eq.${c.scope.ownerId}`, `select=${BILL_COLS}`, "order=created_at.desc", `limit=${Math.min(200, Number(u.get("limit")) || 60)}`];
  if (!all) p.push(`created_by=eq.${c.scope.userId}`);
  const view = u.get("view");
  if (view === "due") p.push("kind=eq.sale", "status=eq.open", "balance_paise=gt.0");
  else p.push(`kind=eq.${view === "estimates" ? "estimate" : view === "returns" ? "return" : "sale"}`);
  const q = (u.get("q") ?? "").replace(/[^A-Za-z0-9 ऀ-ॿ/]/g, "").trim().slice(0, 30);
  if (q) p.push(`or=(customer_name.ilike.*${encodeURIComponent(q)}*,customer_phone.ilike.*${encodeURIComponent(q.replace(/\D/g, "") || q)}*,code.ilike.*${encodeURIComponent(q)}*)`);
  const r = await restAsService<BillRow[]>(`ms_bills?${p.join("&")}`);
  return NextResponse.json({ bills: list(r).map((b) => hideBillCost(b, c.access)), access: c.access });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!msHas(access, "bill")) return msDenied("make bills");
  const kind: BillKind = b.kind === "estimate" ? "estimate" : "sale";
  const raw = (Array.isArray(b.lines) ? b.lines : []).slice(0, 100).map(cleanLine).filter((l) => l.name || l.itemId);
  if (!raw.length) return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
  // The same bill sent twice (a retry after a lost answer, or an offline bill sent again): hand back the one already saved.
  const cid = typeof b.client_id === "string" && /^[A-Za-z0-9-]{8,60}$/.test(b.client_id) ? b.client_id : null;
  if (cid) {
    const had = list(await restAsService<BillRow[]>(`ms_bills?owner_id=eq.${scope.ownerId}&client_id=eq.${encodeURIComponent(cid)}&select=${BILL_COLS}&limit=1`))[0];
    if (had) return NextResponse.json({ bill: hideBillCost(had, access), sent: null });
  }
  const tl = await trueLines(scope.ownerId, raw, kind);
  if ("error" in tl) return NextResponse.json({ error: tl.error, code: "stock" }, { status: 400 });
  const payments = kind === "estimate" ? [] : (Array.isArray(b.payments) ? b.payments : []).slice(0, 10).map(cleanPayment).filter((x): x is Payment => !!x).map((p) => ({ ...p, at: new Date().toISOString() }));
  const fields = {
    customer_name: txt(b.customer_name, 80), customer_phone: cleanPhone(b.customer_phone), customer_gstin: txt(b.customer_gstin, 15).toUpperCase(),
    customer_state: /^\d{2}$/.test(String(b.customer_state ?? "")) ? String(b.customer_state) : "",
    lines: tl.lines, payments, discount_paise: Math.max(0, Math.round(Number(b.discount_paise) || 0)), notes: txt(b.notes, 300),
    due_date: typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null,
    client_id: cid,
    created_by: scope.userId, created_by_name: access.name,
  };
  const t = billTotals({ lines: fields.lines, payments, discountPaise: fields.discount_paise, customerState: fields.customer_state }, setup);
  // A counter may give discounts up to the shop's limit; more needs the "discount" right.
  if (t.lineDiscount + t.billDiscount > Math.round((t.gross * setup.counterDiscountBp) / 10000) && !msHas(access, "discount")) {
    return NextResponse.json({ error: `This discount is more than you may give (${setup.counterDiscountBp / 100}% of the bill). Ask the owner.`, code: "discount" }, { status: 403 });
  }
  if (t.paid > t.total) return NextResponse.json({ error: "The money received is more than the bill." }, { status: 400 });
  if (kind === "sale" && t.balance > 0 && !fields.customer_phone) return NextResponse.json({ error: "For udhaar (money left), type the customer's mobile." }, { status: 400 });
  const bill = await createBill(scope, setup, kind, fields);
  if (!bill) return NextResponse.json({ error: "Could not save the bill. Please try again." }, { status: 500 });
  const sent = b.send === true && bill.customer_phone ? await sendBill(scope, setup, bill) : null;
  return NextResponse.json({ bill: hideBillCost(bill, access), sent });
}
