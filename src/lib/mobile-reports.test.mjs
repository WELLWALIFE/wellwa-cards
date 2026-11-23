// Run: node --test src/lib/mobile-reports.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const M = await jiti.import("./mobile.ts");
const R = await jiti.import("./mobile-reports.ts");

const L = (o = {}) => ({ itemId: "", name: "Cover", hsn: "3926", qty: 2, price: 11800, discount: 0, gstBp: 1800, imei: "", unitId: "", warrantyMonths: 0, cost: 5000, ...o });
const B = (o = {}) => ({ kind: "sale", status: "paid", code: "MB/1", customer_name: "", customer_phone: "", customer_gstin: "", customer_state: "", lines: [L()], payments: [], discount_paise: 0, total_paise: 23600, gst_paise: 3600, balance_paise: 0, profit_paise: 10000, gst_on: true, created_at: "2026-11-23T06:00:00Z", ...o });
const day = { from: "2026-11-23", to: "2026-11-23" };

test("return lines: pieces come back at what was really paid, and never more than were sold", () => {
  const bill = B({ lines: [L(), L({ name: "Glass", qty: 1, price: 10000 })], discount_paise: 3360 });   // ₹336 off ₹336: 10% → cover 212.40, glass 90
  assert.equal(M.returnLines(bill, [0, 0], [3, 0]), null);
  assert.equal(M.returnLines(bill, [0, 0], [0, 0]), null);
  const r = M.returnLines(bill, [1, 0], [1, 1]);
  assert.equal(r.length, 2); assert.equal(r[0].ref, 0); assert.equal(r[0].qty, 1);
  const t = M.billTotals({ lines: r, payments: [], discountPaise: 0, customerState: "" }, { gstOn: true, stateCode: "" });
  assert.equal(t.lines[0].net, 10620); assert.equal(t.lines[1].net, 9000);
  assert.deepEqual(M.returnedQty(bill, [{ status: "paid", lines: r }, { status: "cancelled", lines: r }]), [1, 1]);
});

test("report: sale less return, GST by HSN, money by mode; a return-adjust payment is not money", () => {
  const sale = B({ payments: [{ mode: "cash", paise: 11800, ref: "", at: "2026-11-23T06:00:00Z" }, { mode: "other", paise: 11800, ref: "Return CN/1", at: "2026-11-23T07:00:00Z" }] });
  const ret = B({ kind: "return", code: "CN/1", lines: [L({ qty: 1, ref: 0 })], total_paise: 11800, payments: [] });
  const old = B({ code: "MB/0", created_at: "2026-11-20T06:00:00Z", payments: [{ mode: "upi", paise: 5000, ref: "", at: "2026-11-23T08:00:00Z" }] });
  const jobs = [{ status: "received", bill_id: null, created_at: "2026-11-23T05:00:00Z", delivered_at: null, labour_paise: 0, payments: [{ mode: "cash", paise: 20000, ref: "", at: "2026-11-23T05:00:00Z" }] }];
  const r = R.buildMsReport([sale, ret, old], jobs, "22", day);
  assert.equal(r.sale, 23600); assert.equal(r.returns, 11800); assert.equal(r.net, 11800); assert.equal(r.bills, 1); assert.equal(r.qty, 1);
  assert.equal(r.taxable, 10000); assert.equal(r.gst, 1800); assert.equal(r.profit, 5000);
  assert.equal(r.money.cash, 31800); assert.equal(r.money.upi, 5000); assert.equal(r.money.other, 0); assert.equal(r.moneyTotal, 36800);
  assert.equal(r.hsn.length, 1); assert.equal(r.hsn[0].taxable, 10000); assert.equal(r.hsn[0].cgst + r.hsn[0].sgst, 1800);
  assert.equal(r.items[0].qty, 1); assert.equal(r.repair.received, 1);
  assert.match(R.msSalesCsv(r), /CN\/1,Return/);
});

test("day close: a return today comes off today's sale and drawer", () => {
  const ret = B({ kind: "return", lines: [L({ qty: 1 })], total_paise: 11800, gst_paise: 1800, profit_paise: 5000, payments: [{ mode: "cash", paise: 11800, ref: "", at: "2026-11-23T07:00:00Z" }] });
  const c = M.dayClose([B({ payments: [{ mode: "cash", paise: 23600, ref: "", at: "2026-11-23T06:00:00Z" }] }), ret], "2026-11-23");
  assert.equal(c.sale, 11800); assert.equal(c.money.cash, 11800); assert.equal(c.profit, 5000); assert.equal(c.qty, 1);
});
