// node --test src/lib/mobile.test.mjs — the mobile shop's bill maths and cleaners, worked out by hand.
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const M = await jiti.import("./mobile.ts");
const line = (o = {}) => M.cleanLine({ itemId: "", name: "Cover", qty: 1, price: 29900, gstBp: 1800, cost: 12000, ...o });
const bill = (o = {}) => ({ lines: [line()], payments: [], discountPaise: 0, customerState: "", ...o });
const gst = { gstOn: true, stateCode: "22" }, plain = { gstOn: false, stateCode: "" };

test("price is tax-inclusive: ₹299 at 18% = ₹253.39 + ₹45.61; without GST no tax", () => {
  const a = M.lineAmounts(line(), true);
  assert.equal(a.net, 29900); assert.equal(a.taxable, 25339); assert.equal(a.gst, 4561);
  assert.equal(M.lineAmounts(line(), false).gst, 0);
  const t = M.billTotals(bill(), gst);
  assert.equal(t.total, 29900); assert.equal(t.cgst, 2280); assert.equal(t.sgst, 2281); assert.equal(t.igst, 0);
  assert.equal(M.billTotals(bill({ customerState: "27" }), gst).igst, 4561);
  assert.equal(M.billTotals(bill(), plain).gst, 0);
});

test("discounts: line discount, then the bill discount spread by share; totals stay whole rupees; profit = taxable − cost", () => {
  const b = bill({ lines: [line({ qty: 2, discount: 1800 }), line({ name: "Glass", price: 10000, cost: 3000 })], discountPaise: 5000 });
  const t = M.billTotals(b, plain);
  assert.equal(t.gross, 69800); assert.equal(t.lineDiscount, 1800); assert.equal(t.billDiscount, 5000);
  assert.equal(t.total, 63000);                       // 598 − 18 − 50 + 100 = ₹630
  assert.equal(t.cost, 27000); assert.equal(t.profit, 36000);
  assert.equal(M.billTotals(bill({ discountPaise: 9999999 }), plain).total, 0);   // never below zero
  const paid = M.billTotals(bill({ payments: [{ mode: "cash", paise: 20000, ref: "", at: "" }] }), plain);
  assert.equal(paid.balance, 9900);
});

test("IMEI: 15 digits with the Luhn check", () => {
  assert.equal(M.validImei("490154203237518"), true);
  assert.equal(M.validImei("490154203237519"), false);
  assert.equal(M.validImei("12345"), false);
  assert.equal(M.cleanCode(" 4901-5420 3237518\n"), "4901-54203237518");
});

test("items: fits tags cleaned, search by the phone it fits, phones are serial-tracked, HSN from the category", () => {
  assert.deepEqual(M.cleanFits("Redmi 13, redmi 13 ,Realme C55\nVivo Y28"), ["Redmi 13", "Realme C55", "Vivo Y28"]);
  const f = M.cleanItemFields({ kind: "accessory", name: "Back cover", category: "cover", fits: "Redmi 13", price_paise: 19900, gst_bp: 99999 });
  assert.equal(f.hsn, "3926"); assert.equal(f.gst_bp, 2800); assert.equal(f.serial, false);
  assert.equal(M.cleanItemFields({ kind: "phone", name: "Redmi 13" }).serial, true);
  const it = { name: "Back cover", brand: "", model: "", variant: "Black", barcode: "", category: "cover", fits: ["Redmi 13", "Poco M6"] };
  assert.equal(M.itemMatches(it, "cover poco"), true);
  assert.equal(M.itemMatches(it, "cover samsung"), false);
  assert.equal(M.itemTitle({ brand: "Boat", name: "Airdopes 141", model: "", variant: "Black" }), "Boat Airdopes 141 Black");
});

test("setup: GST only with a 15-character GSTIN; state code from it", () => {
  assert.equal(M.cleanMsSetup({ gstOn: true }).gstOn, false);
  const s = M.cleanMsSetup({ gstOn: true, gstin: "22abcde1234f1z5", paper: "x" });
  assert.equal(s.gstOn, true); assert.equal(s.stateCode, "22"); assert.equal(s.paper, "80");
});

test("purchase lines: IMEIs de-duplicated and counted; nothing without an item", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  assert.equal(M.cleanPurchaseLine({ qty: 5 }), null);
  const p = M.cleanPurchaseLine({ itemId: id, imeis: ["490154203237518", "490154203237518", "356938035643809"], cost: 900000 });
  assert.equal(p.qty, 2); assert.equal(p.imeis.length, 2);
  assert.equal(M.cleanPurchaseLine({ itemId: id, qty: 20, cost: 5000 }).qty, 20);
});

test("day close: today's bills, money on the day it came, cancelled left out; the customer never sees cost", () => {
  const mk = (o) => ({ kind: "sale", status: "paid", total_paise: 30000, gst_paise: 0, profit_paise: 18000, balance_paise: 0, lines: [line()], payments: [], created_at: "2026-11-23T06:00:00Z", ...o });
  const d = M.dayClose([
    mk({ payments: [{ mode: "upi", paise: 30000, ref: "", at: "2026-11-23T06:01:00Z" }] }),
    mk({ status: "cancelled", payments: [{ mode: "cash", paise: 30000, ref: "", at: "2026-11-23T06:01:00Z" }] }),
    mk({ created_at: "2026-11-20T06:00:00Z", status: "open", balance_paise: 10000, payments: [{ mode: "cash", paise: 20000, ref: "", at: "2026-11-23T10:00:00Z" }] }),
    mk({ status: "open", balance_paise: 30000 }),
  ], "2026-11-23");
  assert.equal(d.bills, 2); assert.equal(d.sale, 60000); assert.equal(d.money.upi, 30000); assert.equal(d.money.cash, 20000);
  assert.equal(d.moneyTotal, 50000); assert.equal(d.udhaarGiven, 30000); assert.equal(d.profit, 36000);
  const pub = M.publicBill({ lines: [line()], profit_paise: 500 });
  assert.equal(pub.lines[0].cost, 0); assert.equal(pub.profit_paise, 0);
});
