// node --test src/lib/jewellery.test.mjs — the jewellery price engine against bills worked out by hand.
// Loads the TypeScript through jiti (already in node_modules), so no build is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const J = await jiti.import("./jewellery.ts");
const { billTotals, lineAmounts, oldAmounts, sellRate, fineBuyRate, publicRate, rateMessage, inWords, grams, mgOf, inr, finYear, cleanJwSetup, cleanLine, DEFAULT_JW_SETUP } = J;

const setup = { ...DEFAULT_JW_SETUP, stateCode: "06" };
const ring = (o = {}) => cleanLine({ desc: "Ring", itemType: "ring", purity: "g22", pieces: 1, grossMg: 5200, stoneMg: 200, rate: 650000, making: "per_g", makingValue: 50000, stonePaise: 100000, ...o });
const bill = (o = {}) => ({ lines: [ring()], old: [], payments: [], discountPaise: 0, discountOn: "making", customerState: "06", advancePaise: 0, ...o });

test("22K ring: net = gross − stone, metal, making per gram, stone, 3% GST split CGST/SGST", () => {
  const a = lineAmounts(ring(), setup);
  assert.equal(a.netMg, 5000);
  assert.equal(a.metal, 3250000);         // ₹6,500 × 5.000 g = ₹32,500
  assert.equal(a.making, 250000);         // ₹500 × 5 g
  assert.equal(a.fineMg, 4580);           // 5 g × 916
  const t = billTotals(bill(), setup);
  assert.equal(t.gst, 108000);            // 3% of ₹33,500 + 3% of ₹2,500
  assert.equal(t.cgst, 54000); assert.equal(t.sgst, 54000); assert.equal(t.igst, 0);
  assert.equal(t.total, 3708000);         // ₹37,080
  assert.equal(t.balance, 3708000);
});

test("discount on making only lowers the making and its tax", () => {
  const t = billTotals(bill({ discountPaise: 50000 }), setup);
  assert.equal(t.taxableMaking, 200000);
  assert.equal(t.gst, 106500);
  assert.equal(t.total, 3656500);
  // a making discount can never go below zero making
  assert.equal(billTotals(bill({ discountPaise: 9999999 }), setup).taxableMaking, 0);
});

test("discount on the total is split over metal and making by their share", () => {
  const t = billTotals(bill({ discountPaise: 360000, discountOn: "total" }), setup);
  assert.equal(t.discount, 360000);
  assert.equal(t.taxableGoods + t.taxableMaking, 3600000 - 360000 + 0); // ₹36,000 − ₹3,600
  assert.equal(t.taxableMaking, 225000);  // 2,500 of 36,000 → ₹250 off making
});

test("making as a % of metal + wastage, and per piece", () => {
  const pctLine = cleanLine({ purity: "g22", grossMg: 20000, rate: 650000, wastageBp: 500, making: "pct", makingValue: 1200 });
  const a = lineAmounts(pctLine, setup);
  assert.equal(a.metal, 13000000);        // ₹1,30,000
  assert.equal(a.wastage, 650000);        // 5%
  assert.equal(a.making, 1638000);        // 12% of ₹1,36,500
  const piece = lineAmounts(cleanLine({ purity: "g22", grossMg: 1000, rate: 650000, making: "piece", makingValue: 30000, pieces: 2 }), setup);
  assert.equal(piece.making, 60000);
});

test("customer in another state pays IGST", () => {
  const t = billTotals(bill({ customerState: "07" }), setup);
  assert.equal(t.igst, 108000); assert.equal(t.cgst, 0); assert.equal(t.sgst, 0);
});

test("rounding to ₹10 with the round-off shown", () => {
  const t = billTotals(bill({ discountPaise: 50000 }), { ...setup, roundTo: 10 });
  assert.equal(t.total, 3657000);         // ₹36,565 → ₹36,570
  assert.equal(t.roundOff, 500);
});

test("old gold exchange: net = gross − less, fine by touch, value at the fine buy rate, off the balance", () => {
  const o = oldAmounts({ desc: "Old chain", metal: "gold", grossMg: 10000, lessMg: 500, touchBp: 9160, rate: 700000 });
  assert.equal(o.netMg, 9500); assert.equal(o.fineMg, 8702); assert.equal(o.value, 6091400);
  const t = billTotals(bill({ old: [{ desc: "Old chain", metal: "gold", grossMg: 10000, lessMg: 500, touchBp: 9160, rate: 700000 }], payments: [{ mode: "upi", paise: 1000000, ref: "", at: "" }], advancePaise: 200000 }), setup);
  assert.equal(t.oldValue, 6091400);
  assert.equal(t.balance, 3708000 - 6091400 - 200000 - 1000000); // negative = the shop pays back
});

test("today's rate: 22K from 24K by fineness; old-gold rate = 24K fine less the deduction", () => {
  const book = { day: "2026-11-23", sell: { g24: 720000 }, buy: {} };
  assert.equal(sellRate(book, setup, "g22"), 660180);
  assert.equal(sellRate(book, setup, "g24"), 720000);
  assert.equal(fineBuyRate(book, setup, "gold"), 706306);
  assert.equal(fineBuyRate({ ...book, buy: { g22: 640000 } }, setup, "gold"), 698690); // ₹6,400 at 916 → per fine gram
  assert.equal(sellRate(null, setup, "g22"), 0);
});

test("words, grams, rupees, financial year", () => {
  assert.equal(inWords(12345600), "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only");
  assert.equal(inWords(370800000), "Thirty Seven Lakh Eight Thousand Rupees Only");
  assert.equal(inWords(1250000000), "One Crore Twenty Five Lakh Rupees Only");
  assert.equal(grams(5000), "5.000 g");
  assert.equal(mgOf("12.345"), 12345);
  assert.equal(inr(3708000), "₹37,080");
  assert.equal(finYear(new Date("2026-11-23")), "2026-27");
  assert.equal(finYear(new Date("2027-02-01")), "2026-27");
});

test("a saved setup is cleaned: numbers in range, defaults kept", () => {
  const s = cleanJwSetup({ gstBp: 99999, stateCode: "6", billPrefix: "A B<script>", purities: [{ key: "x", metal: "gold", label: "KDM", fine: 2000 }] });
  assert.equal(s.gstBp, 2800); assert.equal(s.stateCode, ""); assert.equal(s.billPrefix, "ABscript");
  assert.equal(s.purities[0].fine, 1000);
  assert.equal(cleanJwSetup(null).items.length > 5, true);
  const l = cleanLine({ grossMg: -5, huid: "ab-12 cd", making: "evil" });
  assert.equal(l.grossMg, 0); assert.equal(l.huid, "AB12CD"); assert.equal(l.making, "per_g");
});

test("public rate: switched-on purities, gold per 10 g, silver per kg; shown by default", () => {
  assert.equal(cleanJwSetup(null).showRate, true);
  assert.equal(cleanJwSetup({ showRate: false }).showRate, false);
  const r = publicRate({ day: "2026-11-23", sell: { g24: 720000, s999: 9000 }, buy: {} }, setup);
  const by = Object.fromEntries(r.rows.map((x) => [x.label, x]));
  assert.equal(r.rows.length <= 6, true);
  assert.equal(by["24K (999)"]?.paise ?? r.rows[0].paise, 7200000);   // ₹72,000 / 10 g
  const silver = r.rows.find((x) => x.metal === "silver");
  assert.equal(silver.unit, "1 kg"); assert.equal(silver.paise, 9000000); // ₹90,000 / kg
  assert.equal(publicRate(null, setup), null);
  assert.match(rateMessage({ day: "2026-11-23", sell: { g24: 720000 }, buy: {} }, setup, "Shop"), /₹72,000 \/ 10 g/);
});

const O = await jiti.import("./jewellery-orders.ts");

test("karigar ledger: gold given by touch, work back with wastage, labour less payments; voided entries do not count", () => {
  const issue = O.cleanTxn({ kind: "issue", metal: "gold", gross_mg: 50000, touch_bp: 9950 });   // 50 g of 99.5
  assert.equal(issue.fine_mg, 49750);
  const back = O.cleanTxn({ kind: "receive", metal: "gold", gross_mg: 52000, touch_bp: 9160, wastage_mg: 1200 }); // 52 g of 22K, 1.2 g wastage
  assert.equal(back.fine_mg, 47632);
  const labour = O.cleanTxn({ kind: "labour", paise: 520000 });
  const paid = O.cleanTxn({ kind: "payment", paise: 300000 });
  const wrong = { ...O.cleanTxn({ kind: "issue", gross_mg: 99999, touch_bp: 9950 }), voided: true };
  const b = O.karigarBalance([issue, back, labour, paid, wrong].map((t) => ({ voided: false, ...t })));
  assert.equal(b.fine.gold, 49750 - 47632 - 1200);   // 0.918 g still with the karigar
  assert.equal(b.wastage.gold, 1200);
  assert.equal(b.money, 220000);                      // ₹2,200 labour still to pay
  // nothing typed, or no amount: no entry
  assert.equal(O.cleanTxn({ kind: "issue" }), null);
  assert.equal(O.cleanTxn({ kind: "payment", paise: 0 }), null);
  assert.equal(O.cleanTxn({ kind: "steal", paise: 5 }), null);
  // wastage is only for work received
  assert.equal(O.cleanTxn({ kind: "issue", gross_mg: 1000, touch_bp: 9160, wastage_mg: 500 }).wastage_mg, 0);
});

test("orders: advance paid, late, items cleaned, the customer's messages", () => {
  const o = { kind: "order", code: "ORD/2026-27/1", customer_name: "Priya", est_paise: 5000000, due_date: "2026-11-20", status: "karigar",
    payments: [{ mode: "upi", paise: 1000000, ref: "", at: "" }, { mode: "cash", paise: 500000, ref: "", at: "" }],
    items: [O.cleanOrderItem({ desc: "Ladies ring", weightMg: "4500", pieces: 0 })] };
  assert.equal(O.orderPaid(o), 1500000);
  assert.equal(O.overdue(o, "2026-11-23"), true);
  assert.equal(O.overdue({ ...o, status: "ready" }, "2026-11-23"), false);
  assert.equal(o.items[0].pieces, 1); assert.equal(o.items[0].weightMg, 4500);
  assert.match(O.orderMessage(o, "Shop", "https://x/jo/1"), /Advance मिला: ₹15,000/);
  assert.match(O.orderMessage({ ...o, status: "ready" }, "Shop", "L"), /तैयार है/);
  assert.equal(O.cleanRateLock({ purity: "g22", rate: 0 }), null);
});
