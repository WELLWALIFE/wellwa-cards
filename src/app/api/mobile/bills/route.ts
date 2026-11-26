// Bills and estimates: GET the list (search, kind, money due), POST a new one. Totals, cost, HSN and tax always come from the
// server and the stock (lib/mobile.ts billTotals, lib/mobile-server.ts trueLines), never from the app.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { cleanPayment, type Payment } from "@/lib/jewellery";
import { BILL_COLS, ITEM_COLS, UNIT_COLS, billTotals, cleanCode, cleanLine, comboOff, itemTitle, pointsBalance, validImei, type BillKind, type BillRow, type ItemRow, type UnitRow } from "@/lib/mobile";
import { JOB_COLS, type JobRow } from "@/lib/mobile-repair";
import { createBill, customerBills, hideBillCost, msCtx, msDenied, msHas, sendBill, trueLines } from "@/lib/mobile-server";

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
  // An IMEI typed in the search: every bill it is on, and the phone's whole story (bought from whom, sold on which bill, repairs).
  const code = cleanCode(q, 20);
  let imei: Record<string, unknown> | null = null;
  let extra: BillRow[] = [];
  if (/^[A-Z0-9]{8,20}$/.test(code) && (code.match(/\d/g) ?? []).length >= 8) {
    const o = c.scope.ownerId;
    const [byLine, units, jobs] = await Promise.all([
      restAsService<BillRow[]>(`ms_bills?owner_id=eq.${o}&lines=cs.${encodeURIComponent(JSON.stringify([{ imei: code }]))}&select=${BILL_COLS}&order=created_at.desc&limit=20`),
      restAsService<UnitRow[]>(`ms_units?owner_id=eq.${o}&or=(imei1.eq.${code},imei2.eq.${code},serial_no.eq.${code})&select=${UNIT_COLS}&limit=1`),
      msHas(c.access, "repair") || all ? restAsService<JobRow[]>(`ms_jobs?owner_id=eq.${o}&imei=eq.${code}&select=${JOB_COLS}&order=created_at.desc&limit=10`) : Promise.resolve({ data: [] as JobRow[] }),
    ]);
    extra = list(byLine).filter((b) => all || b.created_by === c.scope.userId);
    const unit = list(units)[0];
    const item = unit ? list(await restAsService<ItemRow[]>(`ms_items?id=eq.${unit.item_id}&owner_id=eq.${o}&select=${ITEM_COLS}&limit=1`))[0] : undefined;
    const pur = unit?.purchase_id && msHas(c.access, "stock") ? list(await restAsService<{ supplier_name: string; bill_no: string; bill_date: string | null; created_at: string }[]>(`ms_purchases?id=eq.${unit.purchase_id}&owner_id=eq.${o}&select=supplier_name,bill_no,bill_date,created_at&limit=1`))[0] : undefined;
    const jl = list(jobs as { data: JobRow[] | null });
    if (unit || extra.length || jl.length) imei = {
      code, item: item ? itemTitle(item) : "", status: unit?.status ?? "", store: unit?.store ?? "", in: unit?.created_at ?? "",
      purchase: pur ? { supplier: pur.supplier_name, bill_no: pur.bill_no, day: pur.bill_date || pur.created_at.slice(0, 10) } : null,
      jobs: jl.map((j) => ({ id: j.id, code: j.code, status: j.status, device: j.device, at: j.created_at })),
    };
  }
  const seen = new Set<string>();
  const bills = [...extra, ...list(r)].filter((b) => !seen.has(b.id) && seen.add(b.id));
  return NextResponse.json({ bills: bills.map((b) => hideBillCost(b, c.access)), access: c.access, imei });
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
  // The branch: a staff login set to a branch bills there; the owner / an unassigned login picks one (or the main shop).
  const asked = typeof b.store === "string" ? b.store : "";
  const store = access.store || (setup.stores.some((s) => s.id === asked) ? asked : "");
  const tl = await trueLines(scope.ownerId, raw, kind, kind === "sale" && setup.stores.length ? store : null);
  if ("error" in tl) return NextResponse.json({ error: tl.error, code: "stock" }, { status: 400 });
  const payments = kind === "estimate" ? [] : (Array.isArray(b.payments) ? b.payments : []).slice(0, 10).map(cleanPayment).filter((x): x is Payment => !!x).map((p) => ({ ...p, at: new Date().toISOString() }));
  // An old phone taken in exchange: its value comes off what the customer pays (it is not money), and the phone goes into stock.
  const exRaw = kind === "sale" && b.exchange && typeof b.exchange === "object" ? (b.exchange as Record<string, unknown>) : null;
  const ex = exRaw ? { model: txt(exRaw.model, 60), imei: cleanCode(exRaw.imei, 20), paise: Math.max(0, Math.round(Number(exRaw.paise) || 0)) } : null;
  if (ex) {
    if (!ex.model || !ex.paise) return NextResponse.json({ error: "For an exchange, type the old phone's model and its value." }, { status: 400 });
    if (!msHas(access, "stock") && !access.owner) return msDenied("take a phone in exchange");
    if (/^\d{15}$/.test(ex.imei) && !validImei(ex.imei)) return NextResponse.json({ error: `Check the old phone's IMEI, a digit looks wrong: ${ex.imei}` }, { status: 400 });
    if (ex.imei) {
      const had = list(await restAsService<{ imei1: string }[]>(`ms_units?owner_id=eq.${scope.ownerId}&imei1=eq.${ex.imei}&select=imei1&limit=1`))[0];
      if (had) return NextResponse.json({ error: `IMEI ${ex.imei} is already in your records.` }, { status: 400 });
    }
    payments.push({ mode: "other", paise: ex.paise, ref: `Exchange ${ex.model}`.slice(0, 40), at: new Date().toISOString() });
  }
  // Combo offers: worked out here from the true lines, never taken from the app.
  const combo = comboOff(tl.lines, setup.combos);
  const typedDiscount = Math.max(0, Math.round(Number(b.discount_paise) || 0));
  // Loyalty points used as money: checked against the customer's real balance.
  const usePts = kind === "sale" ? Math.max(0, Math.round(Number(b.points) || 0)) : 0;
  const phoneNow = cleanPhone(b.customer_phone);
  if (usePts) {
    if (!setup.points.on) return NextResponse.json({ error: "Points are switched off in Settings." }, { status: 400 });
    if (!phoneNow) return NextResponse.json({ error: "To use points, type the customer's mobile." }, { status: 400 });
    if (usePts < setup.points.min) return NextResponse.json({ error: `At least ${setup.points.min} points can be used at a time.` }, { status: 400 });
    const bal = pointsBalance(await customerBills(scope.ownerId, phoneNow), setup.points).balance;
    if (usePts > bal) return NextResponse.json({ error: `This customer has only ${bal} points.` }, { status: 400 });
    payments.push({ mode: "other", paise: usePts * setup.points.worth, ref: `Points ${usePts}`, at: new Date().toISOString() });
  }
  const fields = {
    customer_name: txt(b.customer_name, 80), customer_phone: cleanPhone(b.customer_phone), customer_gstin: txt(b.customer_gstin, 15).toUpperCase(),
    customer_state: /^\d{2}$/.test(String(b.customer_state ?? "")) ? String(b.customer_state) : "",
    lines: tl.lines, payments, discount_paise: typedDiscount + combo.off, notes: [txt(b.notes, 300), combo.names.length ? `Combo offer: ${combo.names.join(", ")}` : ""].filter(Boolean).join(" · ").slice(0, 400),
    due_date: typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null,
    client_id: cid, store,
    created_by: scope.userId, created_by_name: access.name,
  };
  const t = billTotals({ lines: fields.lines, payments, discountPaise: fields.discount_paise, customerState: fields.customer_state }, setup);
  // A counter may give discounts up to the shop's limit; more needs the "discount" right.
  if (t.lineDiscount + t.billDiscount - Math.min(combo.off, t.billDiscount) > Math.round((t.gross * setup.counterDiscountBp) / 10000) && !msHas(access, "discount")) {
    return NextResponse.json({ error: `This discount is more than you may give (${setup.counterDiscountBp / 100}% of the bill). Ask the owner.`, code: "discount" }, { status: 403 });
  }
  if (t.paid > t.total) return NextResponse.json({ error: "The money received is more than the bill." }, { status: 400 });
  if (kind === "sale" && t.balance > 0 && !fields.customer_phone) return NextResponse.json({ error: "For udhaar (money left), type the customer's mobile." }, { status: 400 });
  const bill = await createBill(scope, setup, kind, fields);
  if (!bill) return NextResponse.json({ error: "Could not save the bill. Please try again." }, { status: 500 });
  if (ex) {
    // The old phone: a "Used <model>" item (made once), one unit with its IMEI at the exchange value, and a purchase line for the record.
    const o = scope.ownerId, name = `Used ${ex.model}`;
    let item = list(await restAsService<ItemRow[]>(`ms_items?owner_id=eq.${o}&serial=is.true&name=eq.${encodeURIComponent(name)}&select=${ITEM_COLS}&limit=1`))[0];
    if (!item) item = list(await restAsService<ItemRow[]>(`ms_items?select=${ITEM_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: o, kind: "phone", serial: true, name, category: "phone", hsn: "8517", gst_bp: 1800, price_paise: ex.paise, cost_paise: ex.paise }) }))[0];
    const imei = ex.imei || `USED${Date.now().toString().slice(-9)}`;
    if (item) {
      const pr = list(await restAsService<{ id: string }[]>("ms_purchases?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: o, supplier_name: bill.customer_name || "Exchange customer", supplier_phone: bill.customer_phone, bill_no: bill.code, lines: [{ itemId: item.id, name, qty: 1, cost: ex.paise, imeis: [imei] }], total_paise: ex.paise, paid_paise: ex.paise, notes: `Old phone taken in exchange on bill ${bill.code}`, created_by: scope.userId, created_by_name: access.name }) }))[0];
      const u = await restAsService("ms_units", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: o, item_id: item.id, imei1: imei, cost_paise: ex.paise, purchase_id: pr?.id ?? null, store: bill.store || "" }) });
      if (!u.ok) console.error("[mobile] exchange unit", u.status, u.text.slice(0, 200));
    } else console.error("[mobile] exchange item not made for", bill.code);
  }
  const sent = b.send === true && bill.customer_phone ? await sendBill(scope, setup, bill) : null;
  return NextResponse.json({ bill: hideBillCost(bill, access), sent });
}
