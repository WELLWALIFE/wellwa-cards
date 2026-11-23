// node --test src/lib/jewellery-reports.test.mjs — the reports against bills worked out by hand.
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const R = await jiti.import("./jewellery-reports.ts");
const J = await jiti.import("./jewellery.ts");
const setup = { ...J.DEFAULT_JW_SETUP, stateCode: "06" };
const ring = { desc: "Ring", itemType: "ring", purity: "g22", pieces: 1, grossMg: 5200, stoneMg: 200, netMg: 0, rate: 650000, wastageBp: 0, making: "per_g", makingValue: 50000, stonePaise: 100000, otherPaise: 0, huid: "", hsn: "7113", tag: "" };
let n = 0;
const bill = (o = {}) => ({ id: `b${++n}`, kind: "sale", status: "open", code: `INV/${n}`, customer_name: "A", customer_phone: "", customer_gstin: "", customer_state: "", lines: [ring], old_gold: [], payments: [], discount_paise: 0, discount_on: "making", advance_paise: 0, created_at: "2026-11-23T06:00:00Z", ...o });

test("India date: 23 Nov 20:00 UTC is already 24 Nov in India", () => {
  assert.equal(R.istDate("2026-11-23T20:00:00Z"), "2026-11-24");
  assert.equal(R.istDate("2026-11-23T18:29:00Z"), "2026-11-23");
});

test("split keeps the paise: parts always add up", () => {
  assert.deepEqual(R.split(100, [1, 1, 1]), [33, 33, 34]);
  assert.deepEqual(R.split(5, [0, 0]), [0, 5]);
});

test("sale, GST and money: cancelled bills and estimates left out; money on the day it came, orders included", () => {
  const bills = [
    bill({ payments: [{ mode: "upi", paise: 1000000, ref: "", at: "2026-11-23T07:00:00Z" }] }),
    bill({ status: "cancelled", payments: [{ mode: "cash", paise: 3708000, ref: "", at: "2026-11-23T07:00:00Z" }] }),
    bill({ kind: "estimate" }),
    bill({ created_at: "2026-11-20T06:00:00Z", payments: [{ mode: "cash", paise: 500000, ref: "", at: "2026-11-23T09:00:00Z" }] }),   // old bill, paid today
    bill({ customer_gstin: "06ABCDE1234F1Z5", customer_state: "07" }),                                                                  // B2B, another state → IGST
  ];
  const orders = [{ code: "ORD/1", status: "booked", payments: [{ mode: "cash", paise: 200000, ref: "", at: "2026-11-23T05:00:00Z" }] }, { code: "ORD/2", status: "cancelled", payments: [{ mode: "cash", paise: 999900, ref: "", at: "2026-11-23T05:00:00Z" }] }];
  const r = R.buildReport(bills, orders, setup, { from: "2026-11-23", to: "2026-11-23" });
  assert.equal(r.bills, 2);
  assert.equal(r.total, 3708000 * 2);
  assert.equal(r.gst, 108000 * 2);
  assert.equal(r.cgst, 54000); assert.equal(r.sgst, 54000); assert.equal(r.igst, 108000);
  assert.equal(r.money.upi, 1000000); assert.equal(r.money.cash, 500000 + 200000);
  assert.equal(r.moneyTotal, 1700000); assert.equal(r.fromOrders, 200000);
  assert.equal(r.b2b.length, 1); assert.equal(r.b2b[0].igst, 108000);
  assert.equal(r.hsn.length, 1); assert.equal(r.hsn[0].taxable, 3600000 * 2); assert.equal(r.hsn[0].netMg, 10000);
  const [g22] = r.byPurity; assert.equal(g22.netMg, 10000); assert.equal(g22.fineMg, 9160);
});

test("old gold taken: value and fine weight", () => {
  const r = R.buildReport([bill({ old_gold: [{ desc: "old", metal: "gold", grossMg: 10000, lessMg: 500, touchBp: 9160, rate: 700000 }] })], [], setup, { from: "2026-11-23", to: "2026-11-23" });
  assert.equal(r.oldValue, 6091400); assert.equal(r.oldFine.gold, 8702);
});

test("CSV: quoted where needed, a formula is never run, Excel's BOM first", () => {
  const csv = R.toCsv([["a,b", '"q"', "=SUM(A1)", 5]]);
  assert.equal(csv, '﻿"a,b","""q""",\'=SUM(A1),5\r\n');
  const r = R.buildReport([bill()], [], setup, { from: "2026-11-23", to: "2026-11-23" });
  assert.match(R.salesCsv(r), /INV\/\d+,2026-11-23,A,,,36000\.00,540\.00,540\.00,0\.00,37080\.00/);
  assert.match(R.hsnCsv(r), /7113,Articles of jewellery,GMS,1,5\.000,36000\.00/);
  assert.match(R.dayCloseText(r, "Shop", 0), /Sale ₹37,080/);
});
