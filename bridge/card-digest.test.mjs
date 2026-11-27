// node --test bridge/card-digest.test.mjs — the offer worked out by the app for the assistants.
import test from "node:test";
import assert from "node:assert/strict";
import { currentOffers, offerPriceLines, cardDigest } from "./card-digest.mjs";

const card = { notice: { text: "Festive offer: 10% off on silk sarees" }, pages: [{ blocks: [{ kind: "product", items: [{ name: "Banarasi Silk Saree", price: "2499", mrp: "2999" }, { name: "Cotton Kurti", price: "799" }] }] }] };

test("offer: '10% off on silk sarees' covers the silk saree only, with the totals worked out", () => {
  const l = offerPriceLines(card, "2026-11-27");
  assert.equal(l.length, 1);
  assert.ok(l[0].includes("Banarasi Silk Saree") && l[0].includes("₹2,249 each") && l[0].includes("2 = ₹4,498") && l[0].includes("3 = ₹6,747"));
  assert.ok(cardDigest(card).includes("OFFER PRICES"));
});
test("offer: past date, no object, or no percent → nothing worked out", () => {
  assert.equal(offerPriceLines({ ...card, notice: { ...card.notice, until: "2026-11-01" } }, "2026-11-27").length, 0);
  assert.deepEqual(currentOffers({ notice: { text: "Flat 10% off" } }, "2026-11-27"), []);
  assert.deepEqual(currentOffers({ notice: { text: "Buy 2 get 1 free" } }, "2026-11-27"), []);
  assert.ok(!cardDigest({ ...card, notice: { text: "Diwali sale" } }).includes("OFFER PRICES"));
});
test("offer: 'on everything' and an offer block count; plural / singular match", () => {
  assert.equal(currentOffers({ notice: { text: "20% off on everything" } }, "2026-11-27")[0].on, "all");
  const c2 = { pages: [{ blocks: [{ kind: "offer", text: "15% off on dresses" }, { kind: "product", items: [{ name: "Party Dress", price: "1,000" }] }] }] };
  assert.ok(offerPriceLines(c2, "2026-11-27")[0].includes("₹850 each"));
});
