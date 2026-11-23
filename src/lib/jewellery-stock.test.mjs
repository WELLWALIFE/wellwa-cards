// node --test src/lib/jewellery-stock.test.mjs — tags, HUID, stock to a bill line, stock in hand, and the Code 128 barcode.
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const S = await jiti.import("./jewellery-stock.ts");
const J = await jiti.import("./jewellery.ts");
const setup = J.DEFAULT_JW_SETUP;

test("tag numbers: item code + five-digit running number; typed tags cleaned", () => {
  assert.equal(S.tagCode("ring", 17), "RI00017");
  assert.equal(S.tagCode("chain", 123456), "CH123456");
  assert.equal(S.tagCode("x", 1), "XX00001");
  assert.equal(S.cleanTag(" ri-00017\n"), "RI00017");
});

test("HUID: 6 letters / digits", () => {
  assert.equal(S.cleanHuid("ab-12 cd9"), "AB12CD");
  assert.equal(S.validHuid("AB12CD"), true);
  assert.equal(S.validHuid("AB12C"), false);
});

test("a piece's fields: net = gross − stone unless typed, stone never above gross", () => {
  const f = S.cleanStockFields({ gross_mg: 5200, stone_mg: 200, making: "evil", huid: "ab12cd", pieces: 0 });
  assert.equal(f.net_mg, 5000); assert.equal(f.making, ""); assert.equal(f.huid, "AB12CD"); assert.equal(f.pieces, 1);
  assert.equal(S.cleanStockFields({ gross_mg: 1000, stone_mg: 5000 }).stone_mg, 1000);
  assert.equal(S.cleanStockFields({ gross_mg: 5000, net_mg: 4800 }).net_mg, 4800);
});

test("a tag on the bill: the piece's weights and HUID, the item type's making unless the piece has its own", () => {
  const piece = { tag: "RI00001", item_type: "ring", descr: "", purity: "g22", pieces: 1, gross_mg: 5200, stone_mg: 200, net_mg: 5000, stone_paise: 100000, making: "", making_value: 0, wastage_bp: 0, huid: "AB12CD" };
  const l = S.lineFromStock(piece, setup, 650000);
  assert.equal(l.tag, "RI00001"); assert.equal(l.huid, "AB12CD"); assert.equal(l.making, "per_g"); assert.equal(l.makingValue, 50000);
  assert.equal(J.billTotals({ lines: [l], old: [], payments: [], discountPaise: 0, discountOn: "making", customerState: "", advancePaise: 0 }, { ...setup, stateCode: "06" }).total, 3708000);
  assert.equal(S.lineFromStock({ ...piece, making: "piece", making_value: 90000 }, setup, 650000).makingValue, 90000);
});

test("stock in hand by purity: sold pieces left out; fine by the purity's fineness", () => {
  const rows = [
    { status: "in_stock", purity: "g22", pieces: 1, gross_mg: 5200, net_mg: 5000 },
    { status: "approval", purity: "g22", pieces: 2, gross_mg: 10000, net_mg: 10000 },
    { status: "sold", purity: "g22", pieces: 1, gross_mg: 9000, net_mg: 9000 },
  ];
  const [g22] = S.stockSummary(rows, setup);
  assert.equal(g22.pieces, 3); assert.equal(g22.net, 15000); assert.equal(g22.fine, 13740);
});

test("Code 128-B: every symbol 11 modules, the stop 13; it decodes back to the text with the right check", () => {
  for (const p of S.C128_PATTERNS.slice(0, 106)) assert.equal([...p].reduce((a, c) => a + Number(c), 0), 11);
  assert.equal([...S.C128_PATTERNS[106]].reduce((a, c) => a + Number(c), 0), 13);
  const w = S.code128("RI00017");
  assert.equal(w.reduce((a, b) => a + b, 0), 11 * (7 + 2) + 13);
  // Decode: six widths a symbol.
  const syms = [];
  for (let i = 0; i + 6 <= w.length - 7; i += 6) syms.push(S.C128_PATTERNS.indexOf(w.slice(i, i + 6).join("")));
  assert.equal(syms[0], 104);
  const vals = syms.slice(1, -1);
  assert.equal(String.fromCharCode(...vals.map((v) => v + 32)), "RI00017");
  assert.equal(syms.at(-1), (104 + vals.reduce((a, v, i) => a + v * (i + 1), 0)) % 103);
  assert.throws(() => S.code128("é"));
});

test("website pieces: only in stock, 'from ₹' = net × today's rate rounded down to ₹10, no price without a rate; photos only from our storage", () => {
  const rows = [
    { id: "a", tag: "RI00001", status: "in_stock", item_type: "ring", descr: "", purity: "g22", net_mg: 5000, gross_mg: 5200, huid: "AB12CD", size: "14", photo: "" },
    { id: "b", tag: "RI00002", status: "sold", item_type: "ring", descr: "", purity: "g22", net_mg: 5000, gross_mg: 5000, huid: "", size: "", photo: "" },
  ];
  const [p, ...rest] = S.publicPieces(rows, setup, () => 660183);
  assert.equal(rest.length, 0);
  assert.equal(p.name, "Ring"); assert.equal(p.purity, "22K (916)");
  assert.equal(p.fromPaise, 3300000);                       // ₹6,601.83 × 5 g = ₹33,009.15 → ₹33,000
  assert.equal(S.publicPieces(rows, setup, () => 0)[0].fromPaise, 0);
  const base = "https://x.supabase.co";
  assert.equal(S.cleanPhotoUrl(`${base}/storage/v1/object/public/media/a.jpg`, base), `${base}/storage/v1/object/public/media/a.jpg`);
  assert.equal(S.cleanPhotoUrl("https://evil.com/a.jpg", base), "");
});
