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

/* ---------------- phase 4: stock answers and an order in the chat ---------------- */
import { shopItems, cardItems, matchItems, asksStock, stockAnswer, orderList, orderMenu, parseQty, orderTurn, orderDoneText, orderOwnerLine, formTurn, bookTurn } from "./shop-desk.mjs";

const stockRest = async (q) => {
  if (q.startsWith("ms_items")) return [
    { id: "a", name: "Back Cover Redmi 13", brand: "", model: "", variant: "", category: "Cover", price_paise: 19900, qty: 4, fits: ["Redmi 13"], serial: false },
    { id: "b", name: "Tempered Glass", brand: "", model: "", variant: "", category: "Glass", price_paise: 9900, qty: 0, fits: ["Redmi 13", "Redmi 13C"], serial: false },
    { id: "c", name: "", brand: "Samsung", model: "Galaxy A15", variant: "6/128", category: "Phone", price_paise: 1499900, qty: 0, fits: [], serial: true },
  ];
  if (q.startsWith("ms_units")) return [{ item_id: "c" }, { item_id: "c" }];
  return [];
};

test("stock: the shop's items, matched by the customer's words, answered without the count", async () => {
  const items = await shopItems({ owner: "o", rest: stockRest });
  assert.equal(items.length, 3);
  assert.equal(items[2].name, "Samsung Galaxy A15 6/128");
  assert.equal(items[2].stock, 2);                                  // a serial item is counted by its IMEIs in stock
  assert.ok(asksStock("Redmi 13 ka cover hai kya?"));
  assert.ok(asksStock("Redmi 13 का cover है क्या"));
  assert.ok(!asksStock("kal aata hu"));
  const f = matchItems("Redmi 13 ka cover hai kya?", items);
  assert.equal(f[0].id, "a");
  const a = stockAnswer(f, { order: true });
  assert.ok(a.text.includes("Back Cover Redmi 13") && a.text.includes("₹199") && !a.out);
  assert.ok(!/\b4\b/.test(a.text));                                 // never how many are left
  const g = stockAnswer(matchItems("tempered glass redmi 13 available?", items));
  assert.ok(g.out && g.text.includes("stock में नहीं"));
  assert.deepEqual(matchItems("iphone 15 hai kya", items), []);     // not kept → the AI answers
  assert.deepEqual(matchItems("13", items), []);
  assert.equal(matchItems("samsung a15 price", items)[0].id, "c");
  assert.equal(stockAnswer([]), null);
});

test("order: item → quantity → address → confirm", async () => {
  const shop = await shopItems({ owner: "o", rest: stockRest });
  const items = orderList({ pages: [] }, shop);
  assert.deepEqual(items.map((i) => i.id), ["a", "c"]);            // only what is in stock and priced
  assert.ok(orderMenu(items).includes("1. Back Cover Redmi 13 — ₹199"));
  let r = orderTurn({ step: "item", items }, "1");
  assert.equal(r.st.step, "qty");
  r = orderTurn(r.st, "pata nahi");
  assert.equal(r.st.miss, 1);                                       // asked once more
  r = orderTurn(r.st, "2 pcs");
  assert.equal(r.st.step, "addr");
  r = orderTurn(r.st, "12, Gandhi Nagar, Jaipur");
  assert.equal(r.st.step, "ok");
  assert.ok(r.say.includes("₹398"));
  r = orderTurn(r.st, "haan");
  assert.deepEqual(r.done, { name: "Back Cover Redmi 13", itemId: "a", qty: 2, price: 19900, total: 39800, pickup: false, addr: "12, Gandhi Nagar, Jaipur" });
  assert.ok(orderDoneText(r.done, { upi: "shop@upi" }).includes("shop@upi"));
  assert.ok(orderOwnerLine(r.done).includes("× 2 = ₹398"));
  // by name, pickup, cancel
  r = orderTurn({ step: "item", items }, "samsung a15");
  assert.equal(r.st.item.id, "c");
  r = orderTurn({ ...r.st, step: "addr", qty: 1 }, "pickup");
  assert.equal(r.st.pickup, true);
  assert.equal(orderTurn(r.st, "2").end, true);
  assert.equal(orderTurn({ step: "qty", items, item: items[0] }, "0").end, true);
  assert.equal(orderTurn({ step: "qty", items, item: items[0], miss: 1 }, "kya rate hai").pass, true);
  assert.equal(parseQty("do"), 2); assert.equal(parseQty("3"), 3); assert.equal(parseQty("abc"), 0); assert.equal(parseQty("0"), 0);
  // the card's own products come first
  const card = { pages: [{ blocks: [{ kind: "product", items: [{ name: "Kurti", price: "1,299" }] }] }] };
  assert.deepEqual(cardItems(card).map((i) => [i.name, i.price]), [["Kurti", 129900]]);
  assert.equal(orderList(card, shop)[0].name, "Kurti");
  // nothing to list → the customer types what they want
  r = orderTurn({ step: "item", items: [] }, "2 kg kaju katli");
  assert.equal(r.st.item.name, "2 kg kaju katli");
});

test("form and appointment as plain steps (Business API path)", async () => {
  const qs = [{ key: "name", q: "नाम?" }, { key: "city", q: "शहर?" }];
  let f = formTurn({ qs, answers: [] }, "Ravi");
  assert.equal(f.say, "शहर?");
  f = formTurn(f.st, "Jaipur");
  assert.deepEqual(f.done.patch, { name: "Ravi", address: "Jaipur" });
  assert.equal(formTurn({ qs, answers: [] }, "0").end, true);
  const now = new Date("2026-11-26T10:00:00+05:30").getTime();
  const days = [{ ymd: "2026-11-27", label: "कल" }];
  const rest = async (q) => (q.includes("starts_at=eq.") ? [] : [{ starts_at: "2026-11-27T04:30:00.000Z" }]);   // 10:00 IST is taken
  let b = await bookTurn({ step: "day", days }, "1", { owner: "o", rest, now });
  assert.equal(b.st.step, "slot");
  assert.ok(!b.st.slots.some((s) => s.hour === 10));
  b = await bookTurn(b.st, "1", { owner: "o", rest, now });
  assert.equal(b.done.day, "2026-11-27");
  assert.equal((await bookTurn({ step: "day", days }, "kal aaunga", { owner: "o", rest, now })).end, true);
});
