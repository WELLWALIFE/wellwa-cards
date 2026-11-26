// node --test bridge/shop-desk.test.mjs — the shop's counter on WhatsApp: what is asked, and the answers from the books.
import test from "node:test";
import assert from "node:assert/strict";
import { bookDays, deskBill, deskDue, deskIntent, deskStatus, findCode, freeSlots, statusLine } from "./shop-desk.mjs";

test("intent: counter questions are caught; conversation and long messages are left to the AI", () => {
  assert.equal(deskIntent("mera phone ban gaya?"), "status");
  assert.equal(deskIntent("मेरा फ़ोन बन गया क्या"), "status");
  assert.equal(deskIntent("MJ/2026-27/14"), "status");
  assert.equal(deskIntent("#102"), "status");
  assert.equal(deskIntent("kab tak milega"), "status");
  assert.equal(deskIntent("mera kitna baki hai"), "due");
  assert.equal(deskIntent("कितना बाकी है मेरा"), "due");
  assert.equal(deskIntent("bill bhej do"), "bill");
  assert.equal(deskIntent("बिल भेज दो"), "bill");
  assert.equal(deskIntent("appointment chahiye"), null);
  assert.equal(deskIntent("appointment chahiye", { book: true }), "book");
  assert.equal(deskIntent("hello"), null);
  assert.equal(deskIntent("redmi 13 ka cover kitne ka hai"), null);
  assert.equal(deskIntent("iPhone 13 ki display ka price batao"), null);
  assert.equal(deskIntent("2"), null);
  assert.equal(deskIntent("mera phone ban gaya? " + "x".repeat(100)), null);
});

test("job number: full codes and the tailoring '#102'", () => {
  assert.deepEqual(findCode("mj/2026-27/14 ka status"), { code: "MJ/2026-27/14", number: 14 });
  assert.deepEqual(findCode("ORD / 2026-27 / 4"), { code: "ORD/2026-27/4", number: 4 });
  assert.deepEqual(findCode("job no 102"), { code: "", number: 102 });
  assert.deepEqual(findCode("#7"), { code: "", number: 7 });
  assert.equal(findCode("2 cover chahiye"), null);
});

const site = "https://x.test";
const msJob = { id: "j1", code: "MJ/2026-27/4", status: "ready", device: "Redmi 13 black", parts: [{ qty: 1, price: 220000 }], labour_paise: 30000, payments: [{ paise: 50000 }], due_date: null, token: "tok", customer_phone: "+919000000021" };

test("status line: money and link only for the customer's own number", () => {
  const own = statusLine("ms", msJob, { own: true, site });
  assert.match(own, /Redmi 13 black/); assert.match(own, /तैयार है/); assert.match(own, /कुल ₹2,500 · advance ₹500 · बाकी ₹2,000/); assert.match(own, /x\.test\/mr\/j1\?t=tok/);
  const other = statusLine("ms", msJob, { own: false, site });
  assert.match(other, /तैयार है/); assert.doesNotMatch(other, /₹/); assert.doesNotMatch(other, /mr\/j1/);
  assert.match(statusLine("job", { number: 102, status: "stitching", item: "Blouse", work: "Stitching", amount_paise: 80000, advance_paise: 30000 }, { own: true, site }), /#102\): सिलाई चल रही है\n   बाकी ₹500/);
});

test("status: by phone lists the open work; by code from another phone shows the status only; nothing on record → null", async () => {
  const calls = [];
  const rest = async (q) => { calls.push(q); return q.startsWith("ms_jobs") ? [msJob] : []; };
  const byPhone = await deskStatus({ owner: "o1", phone: "919000000021", text: "mera phone ban gaya?", rest, site });
  assert.match(byPhone, /बाकी ₹2,000/);
  assert.ok(calls.some((q) => q.includes("customer_phone=eq.%2B919000000021")));
  const byCode = await deskStatus({ owner: "o1", phone: "919811111111", text: "MJ/2026-27/4", rest, site });
  assert.match(byCode, /तैयार है/); assert.doesNotMatch(byCode, /₹/);
  assert.equal(await deskStatus({ owner: "o1", phone: "919000000021", text: "status", rest: async () => [], site }), null);
});

test("due and bill: totals, links, and null when the books are clean", async () => {
  const rest = async (q) => (q.startsWith("ms_bills") ? [{ id: "b1", code: "MB/2026-27/10", total_paise: 32800, balance_paise: 22800, token: "t1", created_at: "2026-11-26T09:10:00Z" }] : []);
  const due = await deskDue({ owner: "o1", phone: "+919000000021", rest, site, upi: "shop@upi" });
  assert.match(due, /कुल बाकी: \*₹228\*/); assert.match(due, /x\.test\/mb\/b1\?t=t1/); assert.match(due, /shop@upi/);
  const bill = await deskBill({ owner: "o1", phone: "9000000021", rest, site });
  assert.match(bill, /MB\/2026-27\/10/); assert.match(bill, /₹328 · बाकी ₹228/);
  assert.equal(await deskDue({ owner: "o1", phone: "9000000021", rest: async () => [], site }), null);
  assert.equal(await deskDue({ owner: "o1", phone: "", rest, site }), null);
});

test("appointment: days start today only while an hour is left; taken and past hours are not offered", () => {
  const at = (h) => Date.parse(`2026-11-26T${String(h).padStart(2, "0")}:30:00+05:30`);
  assert.equal(bookDays({ now: at(11), end: 20 })[0].ymd, "2026-11-26");
  assert.equal(bookDays({ now: at(19), end: 20 })[0].ymd, "2026-11-27");
  assert.equal(bookDays({ now: at(11) }).length, 5);
  const today = freeSlots({ ymd: "2026-11-26", taken: ["2026-11-26T09:30:00Z"], start: 9, end: 20, now: at(11) });   // 15:00 IST is taken
  assert.deepEqual(today.map((s) => s.hour), [12, 13, 14, 16, 17, 18, 19]);
  assert.equal(today[0].label, "12:00 PM");
  assert.equal(today[0].iso, "2026-11-26T06:30:00.000Z");
  assert.equal(freeSlots({ ymd: "2026-11-27", start: 10, end: 13, now: at(11) }).length, 3);
});

import { autoTags, budgetPaise, cardAnswer, formQuestions, formResult, parseRating, ratingReply } from "./shop-desk.mjs";

test("card answers: address with map and timings, a live offer, products with prices and photos; null when the card has none", () => {
  const card = { links: [{ type: "phone", value: "9000000021" }], notice: { text: "Diwali sale", until: "2099-01-01" }, pages: [
    { blocks: [{ kind: "location", address: "Shop 12, MI Road", mapUrl: "https://maps.app/x" }, { kind: "hours", rows: [{ day: "Mon-Sat", time: "10-8" }] }, { kind: "offer", text: "10% off covers", code: "COV10" }] },
    { blocks: [{ kind: "product", items: [{ name: "Cover", price: "199", images: ["https://x/c.jpg"] }, { name: "Glass", mrp: "149" }] }] },
    { hidden: true, blocks: [{ kind: "product", items: [{ name: "Hidden", price: "1" }] }] },
  ] };
  const a = cardAnswer("address", card);
  assert.match(a, /MI Road/); assert.match(a, /maps\.app/); assert.match(a, /Mon-Sat 10-8/); assert.match(a, /9000000021/);
  const o = cardAnswer("offer", card);
  assert.match(o, /Diwali sale/); assert.match(o, /COV10/);
  const p = cardAnswer("products", card, { link: "https://shop.test" });
  assert.match(p, /• Cover — ₹199/); assert.match(p, /• Glass — ₹149/); assert.match(p, /\[MEDIA\] https:\/\/x\/c\.jpg/); assert.doesNotMatch(p, /Hidden/);
  assert.equal(cardAnswer("address", { pages: [] }), null);
  assert.equal(cardAnswer("offer", { notice: { text: "old", until: "2020-01-01" }, pages: [] }), null);
  assert.equal(cardAnswer("products", { pages: [] }), null);
});

test("enquiry form: the owner's questions, the budget as money, the answers onto the lead", () => {
  const qs = formQuestions({ ask: ["name", "city", "budget"], askOwn: "Kaun sa size?" });
  assert.deepEqual(qs.map((q) => q.key), ["name", "city", "budget", "own"]);
  assert.equal(formQuestions({}).length, 3);
  assert.equal(budgetPaise("50 hazar"), 5000000); assert.equal(budgetPaise("1.5 lakh tak"), 15000000); assert.equal(budgetPaise("₹20,000"), 2000000); assert.equal(budgetPaise("25k"), 2500000); assert.equal(budgetPaise("pata nahi"), 0);
  const r = formResult(qs, ["Rahul Sharma", "Jaipur, Malviya Nagar", "20 hazar", "XL"]);
  assert.deepEqual(r.patch, { name: "Rahul Sharma", address: "Jaipur, Malviya Nagar", budget_paise: 2000000 });
  assert.match(r.summary, /Name: Rahul Sharma · City: Jaipur, Malviya Nagar · Budget: 20 hazar · Kaun sa size\?: XL/);
});

test("auto tags: a rule's word in the message gives its tag; nothing matches → none", () => {
  const rules = [{ tag: "Repair", words: "repair, display, screen" }, { tag: "wholesale", words: "thok, wholesale\nbulk" }, { tag: "", words: "x" }];
  assert.deepEqual(autoTags("meri screen toot gayi", rules), ["repair"]);
  assert.deepEqual(autoTags("Thok me rate kya hai, display bhi", rules), ["repair", "wholesale"]);
  assert.deepEqual(autoTags("hello", rules), []);
});

test("rating: only a bare 1–5 or stars counts; happy ones get the review link, the others an apology", () => {
  assert.equal(parseRating("5"), 5); assert.equal(parseRating("4 star"), 4); assert.equal(parseRating("⭐⭐⭐"), 3); assert.equal(parseRating("5/5"), 5); assert.equal(parseRating("2."), 2);
  assert.equal(parseRating("5 cover chahiye"), null); assert.equal(parseRating("6"), null); assert.equal(parseRating("ok"), null);
  assert.match(ratingReply(5, "https://g.page/r/x"), /g\.page/); assert.doesNotMatch(ratingReply(2, "https://g.page/r/x"), /g\.page/); assert.match(ratingReply(2, ""), /माफ़/);
});
