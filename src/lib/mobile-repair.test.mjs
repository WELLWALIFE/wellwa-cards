// Run: node --test src/lib/mobile-repair.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("..", import.meta.url).pathname } });
const m = await jiti.import("./mobile-repair.ts");

const job = { code: "MJ/2026-27/1", customer_name: "Ravi", device: "Redmi 13", status: "ready", est_paise: 150000, problems: ["display", "other"], problem_note: "line on screen",
  parts: [{ itemId: "a", name: "Display Redmi 13", qty: 1, price: 120000, cost: 80000 }], labour_paise: 30000, payments: [{ mode: "cash", paise: 50000, ref: "", at: "2026-11-23T10:00:00Z" }] };

test("job money: parts + labour, less the advance", () => {
  const t = m.jobTotals(job);
  assert.equal(t.total, 150000); assert.equal(t.paid, 50000); assert.equal(t.due, 100000); assert.equal(t.cost, 80000);
});
test("bill lines: one per part and one repair line; a job with nothing still gets a repair line", () => {
  const l = m.jobBillLines(job);
  assert.equal(l.length, 2); assert.equal(l[0].itemId, "a"); assert.equal(l[1].price, 30000); assert.match(l[1].name, /Repair: Redmi 13/);
  assert.equal(m.jobBillLines({ ...job, parts: [], labour_paise: 0 }).length, 1);
  assert.equal(m.jobBillLines({ ...job, labour_paise: 0 }).length, 1);
});
test("the customer's copy hides the lock code, notes and cost", () => {
  const p = m.publicJob({ ...job, lock_code: "1234", notes: "x", events: [{ at: "", by: "Amit", text: "t" }] });
  assert.equal(p.lock_code, ""); assert.equal(p.notes, ""); assert.equal(p.parts[0].cost, 0); assert.equal(p.events[0].by, "");
});
test("clean fields keep only known problems and a clean IMEI", () => {
  const f = m.cleanJobFields({ problems: ["display", "hack"], condition: ["sim", 5], imei: "35-6938 0356", est_paise: -5, due_date: "bad" });
  assert.deepEqual(f.problems, ["display"]); assert.deepEqual(f.condition, ["sim"]); assert.equal(f.imei, "3569380356"); assert.equal(f.est_paise, 0); assert.equal(f.due_date, null);
});
test("messages and late", () => {
  assert.match(m.jobMessage(job, "SSM", "L", "ready", false), /To pay: ₹1,000/);
  assert.match(m.jobMessage({ ...job, payments: [] }, "SSM", "L", "received", true), /अंदाज़न ख़र्च: ₹1,500/);
  assert.equal(m.jobLate({ status: "repairing", due_date: "2026-11-20" }, "2026-11-23"), true);
  assert.equal(m.jobLate({ status: "ready", due_date: "2026-11-20" }, "2026-11-23"), false);
});
