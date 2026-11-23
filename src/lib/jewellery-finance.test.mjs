// node --test src/lib/jewellery-finance.test.mjs — gold scheme and girvi, worked out by hand.
import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../", import.meta.url).pathname } });
const F = await jiti.import("./jewellery-finance.ts");
const pay = (paise, at, o = {}) => ({ mode: "cash", paise, ref: "", at, ...o });

test("months: 31 Jan + 1 = 28 Feb; 15 Nov + 11 = 15 Oct", () => {
  assert.equal(F.addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(F.addMonths("2026-11-15", 11), "2027-10-15");
  assert.equal(F.addDays("2026-11-30", 2), "2026-12-02");
});

test("scheme: ₹2,000 × 11 with a ₹2,000 bonus — behind, maturity, and the bonus only when complete and matured", () => {
  const plan = { key: "p11", name: "11+1", months: 11, monthlyPaise: 200000, bonusPaise: 200000, on: true };
  const s = { plan, start_day: "2026-01-10", payments: [pay(200000, "2026-01-10T06:00:00Z"), pay(400000, "2026-03-12T06:00:00Z")] };
  const a = F.schemeState(s, "2026-04-15");
  assert.equal(a.paid, 600000); assert.equal(a.installments, 3); assert.equal(a.dueInstallments, 4); assert.equal(a.behind, 1);
  assert.equal(a.nextDue, "2026-04-10"); assert.equal(a.maturity, "2026-12-10"); assert.equal(a.value, 600000); assert.equal(a.bonus, 0);
  const full = { ...s, payments: Array.from({ length: 11 }, (_, k) => pay(200000, `2026-${String(k + 1).padStart(2, "0")}-10T06:00:00Z`)) };
  assert.equal(F.schemeState(full, "2026-12-09").bonus, 0);              // complete, not matured yet
  const m = F.schemeState(full, "2026-12-10");
  assert.equal(m.complete, true); assert.equal(m.matured, true); assert.equal(m.bonus, 200000); assert.equal(m.value, 2400000); assert.equal(m.nextDue, null);
});

test("plans are cleaned: no plan without a monthly amount, bonus at most 3 instalments", () => {
  assert.equal(F.cleanPlan({ months: 11 }), null);
  const p = F.cleanPlan({ months: 999, monthlyPaise: 100000, bonusPaise: 9e9 });
  assert.equal(p.months, 60); assert.equal(p.bonusPaise, 300000);
});

test("girvi: ₹50,000 at 1.5% a month — 60 days of interest by the day", () => {
  const g = { loan_paise: 5000000, rate_bp: 150, min_days: 0, start_day: "2026-01-01", due_day: "2026-04-01", payments: [] };
  const st = F.girviState(g, "2026-03-02");
  assert.equal(st.days, 60); assert.equal(st.interest, 147945); assert.equal(st.principal, 5000000); assert.equal(st.overdue, false);
  assert.equal(F.girviState(g, "2026-04-02").overdue, true);
});

test("girvi: a payment clears interest first, then principal; interest then runs on the smaller principal", () => {
  const sp = F.splitPayment(1000000, { interest: 73973, principal: 5000000 });
  assert.deepEqual(sp, { interest: 73973, principal: 926027, extra: 0 });
  const g = { loan_paise: 5000000, rate_bp: 150, min_days: 0, start_day: "2026-01-01", due_day: "2026-06-01",
    payments: [{ ...pay(1000000, "2026-01-31T06:00:00Z"), interest: 73973, principal: 926027 }] };
  const st = F.girviState(g, "2026-03-02");
  assert.equal(st.principal, 4073973); assert.equal(st.interest, 60272); assert.equal(st.due, 4134245);
  assert.deepEqual(F.splitPayment(5000000, st), { interest: 60272, principal: 4073973, extra: 865755 });
});

test("girvi: the minimum days are charged even when it is closed early", () => {
  const g = { loan_paise: 5000000, rate_bp: 150, min_days: 30, start_day: "2026-01-01", due_day: "2026-04-01", payments: [] };
  assert.equal(F.girviState(g, "2026-01-11").interest, 73973);           // 10 days used, 30 charged
  assert.equal(F.girviState(g, "2026-03-02").interest, 147945);          // past the minimum: by the day
});

test("girvi items: fine = net × touch; nothing without a weight", () => {
  assert.equal(F.cleanGirviItem({ grossMg: 0 }), null);
  assert.deepEqual(F.cleanGirviItem({ desc: "Chain", grossMg: 10500, netMg: 10000, touchBp: 9160 }), { desc: "Chain", metal: "gold", grossMg: 10500, netMg: 10000, touchBp: 9160, fineMg: 9160, pieces: 1 });
  assert.match(F.girviMessage("notice", { code: "GV/1", customer_name: "Ram", loan_paise: 5000000, due_day: "2026-04-01", rate_bp: 150 }, { due: 5147945, principal: 5000000, interest: 147945 }, "Shop", "L"), /₹51,479/);
});
