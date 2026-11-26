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

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222", C = "33333333-3333-3333-3333-333333333333";

test("combo: off once per full set; an item counts in one combo only; half a set gets nothing", () => {
  const combos = [{ id: "c1", name: "Cover + glass", items: [A, B], off: 5000 }, { id: "c2", name: "Glass + charger", items: [B, C], off: 3000 }];
  assert.deepEqual(M.comboOff([{ itemId: A, qty: 2 }, { itemId: B, qty: 1 }], combos), { off: 5000, names: ["Cover + glass"] });
  assert.deepEqual(M.comboOff([{ itemId: A, qty: 2 }, { itemId: B, qty: 3 }, { itemId: C, qty: 1 }], combos), { off: 2 * 5000 + 3000, names: ["Cover + glass ×2", "Glass + charger"] });
  assert.equal(M.comboOff([{ itemId: A, qty: 1 }], combos).off, 0);
  assert.equal(M.comboOff([{ itemId: "", qty: 1 }, { itemId: B, qty: 1 }], combos).off, 0);
});

test("points: earned per full ₹100, taken back on returns, minus what was used; cancelled bills do not count", () => {
  const p = { on: true, per100: 1, worth: 100, min: 50 };
  assert.equal(M.pointsEarned(129900, p), 12);
  assert.equal(M.pointsEarned(9900, p), 0);
  assert.equal(M.pointsEarned(129900, { ...p, on: false }), 0);
  const bills = [
    { kind: "sale", status: "paid", total_paise: 1000000, payments: [] },                                         // +100
    { kind: "sale", status: "paid", total_paise: 500000, payments: [{ mode: "other", paise: 6000, ref: "Points 60" }] }, // +50, −60
    { kind: "return", status: "paid", total_paise: 200000, payments: [] },                                         // −20
    { kind: "sale", status: "cancelled", total_paise: 900000, payments: [] },                                      // nothing
  ];
  assert.deepEqual(M.pointsBalance(bills, p), { earned: 130, used: 60, balance: 70 });
});

test("points / exchange / return lines are not money in the day close", () => {
  assert.equal(M.isReturnAdjust({ ref: "Points 60" }), true);
  assert.equal(M.isReturnAdjust({ ref: "Exchange Redmi 9" }), true);
  assert.equal(M.isReturnAdjust({ ref: "" }), false);
});

test("UPI: ID check and the pay link with the exact amount", () => {
  assert.equal(M.validUpi("shop.name@okaxis"), true);
  assert.equal(M.validUpi("9876543210@ybl"), true);
  assert.equal(M.validUpi("shop name@ok"), false);
  assert.equal(M.validUpi("shop@"), false);
  assert.equal(M.upiLink("shop@okaxis", "Sunita Mobile", 29950, "MB/2026-27/5"), "upi://pay?pa=shop%40okaxis&pn=Sunita%20Mobile&am=299.50&cu=INR&tn=MB%2F2026-27%2F5");
  assert.equal(M.upiLink("shop@okaxis", "S", 0), "upi://pay?pa=shop%40okaxis&pn=S&cu=INR");
});

test("setup: branches, combos, points and staff commission are cleaned; a staff branch that does not exist is dropped", () => {
  const s = M.cleanMsSetup({
    stores: [{ id: "b1", name: "Station Road", address: "x" }, { id: "b1", name: "dup" }, { id: "", name: "no id" }],
    combos: [{ id: "c1", name: "Cover+glass", items: [A, B], off: 5000 }, { id: "c2", name: "one item", items: [A], off: 100 }, { id: "c3", name: "no off", items: [A, B], off: 0 }],
    points: { on: true, per100: 2, worth: 50, min: 10 }, remindDays: 7,
    staff: { "44444444-4444-4444-4444-444444444444": { title: "Counter", rights: ["bill", "expense", "nope"], store: "b9", commissionBp: 200, target: 5000000 } },
  });
  assert.deepEqual(s.stores.map((x) => x.id), ["b1"]);
  assert.deepEqual(s.combos.map((x) => x.id), ["c1"]);
  assert.deepEqual(s.points, { on: true, per100: 2, worth: 50, min: 10 });
  assert.equal(s.remindDays, 7);
  const st = s.staff["44444444-4444-4444-4444-444444444444"];
  assert.deepEqual(st.rights, ["bill", "expense"]); assert.equal(st.store, ""); assert.equal(st.commissionBp, 200); assert.equal(st.target, 5000000);
  assert.equal(M.cleanMsSetup({}).remindDays, 0);
  assert.equal(M.storeName(s, "b1"), "Station Road");
});

test("staff totals: sale after returns, repairs as technician, commission from the owner's settings", () => {
  const agents = [{ id: "a1", agent_user_id: "u1", name: "Ravi" }, { id: "a2", agent_user_id: "u2", name: "Tech" }];
  const setup = { staff: { a1: { title: "", rights: [], store: "", commissionBp: 100, repairBp: 0, target: 10000000 }, a2: { title: "", rights: [], store: "", commissionBp: 0, repairBp: 2000, target: 0 } } };
  const bills = [
    { kind: "sale", status: "paid", total_paise: 1000000, profit_paise: 100000, created_by: "u1", created_by_name: "Ravi" },
    { kind: "return", status: "paid", total_paise: 200000, profit_paise: 20000, created_by: "u1", created_by_name: "Ravi" },
    { kind: "sale", status: "cancelled", total_paise: 999900, profit_paise: 0, created_by: "u1", created_by_name: "Ravi" },
    { kind: "sale", status: "open", total_paise: 300000, profit_paise: 50000, created_by: "own", created_by_name: "Owner" },
  ];
  const jobs = [{ tech_id: "a2", labour_paise: 50000, status: "delivered" }, { tech_id: "a2", labour_paise: 90000, status: "ready" }];
  const t = M.staffTotals(bills, jobs, agents, setup, "own");
  const ravi = t.find((x) => x.userId === "u1"), tech = t.find((x) => x.userId === "u2"), own = t.find((x) => x.userId === "own");
  assert.equal(ravi.sale, 800000); assert.equal(ravi.bills, 1); assert.equal(ravi.commission, 8000); assert.equal(ravi.target, 10000000);
  assert.equal(tech.repairs, 1); assert.equal(tech.repairCharge, 50000); assert.equal(tech.commission, 10000);
  assert.equal(own.name, "Owner"); assert.equal(own.commission, 0);
});

test("udhaar reminder: one message, every due bill with its link, the total and the UPI ID", () => {
  const t = M.remindMessage("Ramesh", "Sunita Mobile", [
    { code: "MB/2026-27/3", balance_paise: 50000, created_at: "2026-11-01T06:00:00Z", link: "https://x/mb/1" },
    { code: "MB/2026-27/9", balance_paise: 25000, created_at: "2026-11-10T06:00:00Z", link: "https://x/mb/2" },
  ], "shop@okaxis");
  assert.match(t, /Ramesh जी/); assert.match(t, /₹750 बाकी/); assert.match(t, /MB\/2026-27\/3/); assert.match(t, /https:\/\/x\/mb\/2/); assert.match(t, /shop@okaxis/);
});
