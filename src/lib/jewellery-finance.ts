// Shubhora Jewellery, phase 5 — the gold saving scheme and girvi (gold loan), both OFF until the shop switches them on in Settings
// with the legal warning (plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK; owner, 23 Nov 2026: "complete karo").
// Pure functions (tested in jewellery-finance.test.mjs). Units as in lib/jewellery.ts: paise, milligrams, basis points.
//
// SCHEME: the customer pays a fixed amount every month for N months; at maturity the deposits (and the shop's bonus, if the plan
// has one) are taken off a jewellery bill. The software never promises a return or interest: the bonus is the shop's discount
// on that bill. Deposits by companies can fall under the Companies (Acceptance of Deposits) Rules — the shop decides with its CA.
//
// GIRVI: a loan against the customer's gold. Simple interest at the shop's monthly rate, by the day, with a minimum number of
// days; a payment pays the interest due first, then the principal. Needs a money-lender licence in most states, and the state's
// interest limit — the shop types its licence before it can switch girvi on.
import type { Metal, Payment } from "@/lib/jewellery";

const DAY = 86400_000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** The same date n months on (31 Jan + 1 month = 28 / 29 Feb). */
export function addMonths(d: string, n: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(dd, last));
  return t.toISOString().slice(0, 10);
}
const istDay = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);

/* ---------------- gold saving scheme ---------------- */

/** A plan as the shop sets it up. bonusPaise: the shop's discount at maturity (0 = none). */
export type SchemePlan = { key: string; name: string; months: number; monthlyPaise: number; bonusPaise: number; on: boolean };
export const DEFAULT_PLANS: SchemePlan[] = [
  { key: "p11", name: "11 + 1", months: 11, monthlyPaise: 200000, bonusPaise: 200000, on: true },
];
export type SchemeStatus = "active" | "redeemed" | "closed";
export type SchemeRow = {
  id: string; owner_id: string; number: number; fin_year: string; code: string; status: SchemeStatus;
  plan: SchemePlan; customer_name: string; customer_phone: string; customer_address: string; nominee: string;
  start_day: string; payments: Payment[]; bill_id: string | null; close_note: string; token: string;
  created_by_name: string; created_at: string; updated_at: string;
};
export const SCHEME_COLS = "id,owner_id,number,fin_year,code,status,plan,customer_name,customer_phone,customer_address,nominee,start_day,payments,bill_id,close_note,token,created_by_name,created_at,updated_at";

export type SchemeState = {
  paid: number; installments: number; dueInstallments: number; behind: number; nextDue: string | null;
  maturity: string; matured: boolean; complete: boolean; bonus: number; value: number;
};
/** Where a member stands on a day: deposits, how many instalments are paid / due, maturity, and what can go on a bill. */
export function schemeState(s: Pick<SchemeRow, "plan" | "start_day" | "payments">, today: string): SchemeState {
  const plan = s.plan;
  const paid = (s.payments ?? []).reduce((a, p) => a + Math.max(0, p.paise || 0), 0);
  const installments = plan.monthlyPaise > 0 ? Math.min(plan.months, Math.floor(paid / plan.monthlyPaise)) : 0;
  // Instalment k (0-based) is due on start + k months; the first is due on the start day.
  let dueInstallments = 0;
  for (let k = 0; k < plan.months; k++) if (addMonths(s.start_day, k) <= today) dueInstallments = k + 1;
  const maturity = addMonths(s.start_day, plan.months);
  const complete = installments >= plan.months;
  const matured = today >= maturity;
  return {
    paid, installments, dueInstallments, behind: Math.max(0, dueInstallments - installments),
    nextDue: complete ? null : addMonths(s.start_day, installments), maturity, matured, complete,
    // The bonus only when every instalment is paid and the plan has run its months.
    bonus: complete && matured ? plan.bonusPaise : 0,
    value: paid + (complete && matured ? plan.bonusPaise : 0),
  };
}

export function cleanPlan(v: unknown): SchemePlan | null {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const int = (n: unknown, lo: number, hi: number, d: number) => { const k = Math.round(Number(n)); return Number.isFinite(k) ? Math.min(hi, Math.max(lo, k)) : d; };
  const months = int(x.months, 1, 60, 11), monthly = int(x.monthlyPaise, 0, 1e10, 0);
  if (!monthly) return null;
  return {
    key: String(x.key ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 20) || `p${Math.random().toString(36).slice(2, 7)}`,
    name: String(x.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || `${months} months`,
    months, monthlyPaise: monthly, bonusPaise: int(x.bonusPaise, 0, monthly * 3, 0), on: x.on !== false,
  };
}

export function schemeMessage(s: Pick<SchemeRow, "code" | "customer_name" | "plan">, st: SchemeState, last: number, shop: string, link: string): string {
  const inr = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  const name = s.customer_name?.trim() ? `${s.customer_name.trim()} जी` : "";
  return [
    `नमस्ते ${name} 🙏`, `${shop} — गोल्ड स्कीम ${s.code}`, `आज मिला: ${inr(last)}`,
    `कुल जमा: ${inr(st.paid)} (${st.installments}/${s.plan.months} किस्त)`,
    st.nextDue ? `अगली किस्त: ${st.nextDue}` : "सारी किस्तें पूरी ✅", `पासबुक: ${link}`,
  ].join("\n");
}

/* ---------------- girvi ---------------- */

export type GirviItem = { desc: string; metal: Metal; grossMg: number; netMg: number; touchBp: number; fineMg: number; pieces: number };
/** A payment on a girvi: the money, and how it was used (interest first, then principal). */
export type GirviPayment = Payment & { interest: number; principal: number };
export type GirviStatus = "open" | "closed" | "auctioned";
export type GirviRow = {
  id: string; owner_id: string; number: number; fin_year: string; code: string; status: GirviStatus;
  customer_name: string; customer_phone: string; customer_address: string; id_proof: string;
  items: GirviItem[]; valuation_paise: number; loan_paise: number; rate_bp: number; min_days: number;
  start_day: string; due_day: string; payments: GirviPayment[]; notices: { day: string; by: string }[];
  close_note: string; closed_at: string | null; token: string; created_by_name: string; created_at: string; updated_at: string;
};
export const GIRVI_COLS = "id,owner_id,number,fin_year,code,status,customer_name,customer_phone,customer_address,id_proof,items,valuation_paise,loan_paise,rate_bp,min_days,start_day,due_day,payments,notices,close_note,closed_at,token,created_by_name,created_at,updated_at";

/** Simple interest on a principal for some days at a monthly rate (bp a month): × 12 months / 365 days. */
export const interestFor = (principal: number, rateBp: number, days: number) => Math.round((principal * rateBp * 12 * Math.max(0, days)) / (10000 * 365));

export type GirviState = { principal: number; interest: number; due: number; days: number; paidInterest: number; paidPrincipal: number; overdue: boolean };
/**
 * Where a loan stands on a day. Interest runs by the day on the principal still out; each payment (on its own day) first clears
 * the interest run up to then, then the principal. The shop's minimum days (e.g. 30) apply to the first period: a loan closed
 * on day 10 still pays 30 days.
 */
export function girviState(g: Pick<GirviRow, "loan_paise" | "rate_bp" | "min_days" | "start_day" | "due_day" | "payments">, today: string): GirviState {
  let principal = g.loan_paise, accrued = 0, from = g.start_day, paidInterest = 0, paidPrincipal = 0;
  const pays = [...(g.payments ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  for (const p of pays) {
    const d = istDay(p.at);
    if (d > from) { accrued += interestFor(principal, g.rate_bp, dayNum(d) - dayNum(from)); from = d; }
    paidInterest += p.interest || 0; paidPrincipal += p.principal || 0;
    accrued = Math.max(0, accrued - (p.interest || 0));
    principal = Math.max(0, principal - (p.principal || 0));
  }
  if (today > from) accrued += interestFor(principal, g.rate_bp, dayNum(today) - dayNum(from));
  // The minimum: at least min_days of interest on the loan, counting what was already paid.
  const days = Math.max(0, dayNum(today) - dayNum(g.start_day));
  const minimum = interestFor(g.loan_paise, g.rate_bp, g.min_days);
  if (paidInterest + accrued < minimum && principal + accrued > 0) accrued = minimum - paidInterest;
  return { principal, interest: accrued, due: principal + accrued, days, paidInterest, paidPrincipal, overdue: today > g.due_day && principal > 0 };
}

/** A payment split: interest first, then principal (never more than what is due). */
export function splitPayment(amount: number, st: Pick<GirviState, "interest" | "principal">): { interest: number; principal: number; extra: number } {
  const interest = Math.min(amount, st.interest);
  const principal = Math.min(amount - interest, st.principal);
  return { interest, principal, extra: amount - interest - principal };
}

export function cleanGirviItem(v: unknown): GirviItem | null {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const int = (n: unknown, lo: number, hi: number, d: number) => { const k = Math.round(Number(n)); return Number.isFinite(k) ? Math.min(hi, Math.max(lo, k)) : d; };
  const grossMg = int(x.grossMg, 0, 1e8, 0);
  if (!grossMg) return null;
  const netMg = Math.min(grossMg, int(x.netMg, 0, 1e8, 0) || grossMg);
  const touchBp = int(x.touchBp, 0, 10000, 9160);
  const metal: Metal = x.metal === "silver" || x.metal === "platinum" ? x.metal : "gold";
  return { desc: String(x.desc ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "Item", metal, grossMg, netMg, touchBp, fineMg: Math.round((netMg * touchBp) / 10000), pieces: int(x.pieces, 1, 99, 1) };
}

/** The customer's lines: on giving the loan, and the reminder / notice before the due date or an auction. */
export function girviMessage(kind: "given" | "reminder" | "notice", g: Pick<GirviRow, "code" | "customer_name" | "loan_paise" | "due_day" | "rate_bp">, st: GirviState, shop: string, link: string): string {
  const inr = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  const name = g.customer_name?.trim() ? `${g.customer_name.trim()} जी` : "";
  if (kind === "given") return [`नमस्ते ${name} 🙏`, `${shop} — गिरवी ${g.code}`, `लोन: ${inr(g.loan_paise)} · ब्याज ${(g.rate_bp / 100).toFixed(2)}% महीना`, `आख़िरी तारीख़: ${g.due_day}`, `रसीद: ${link}`].join("\n");
  if (kind === "reminder") return [`नमस्ते ${name} 🙏`, `${shop} — गिरवी ${g.code}`, `आज तक बकाया: ${inr(st.due)} (मूल ${inr(st.principal)} + ब्याज ${inr(st.interest)})`, `आख़िरी तारीख़: ${g.due_day}`, `रसीद: ${link}`].join("\n");
  return [
    `सूचना — ${shop}`, `${name}, आपकी गिरवी ${g.code} की तारीख़ ${g.due_day} निकल चुकी है।`,
    `आज तक बकाया: ${inr(st.due)} (मूल ${inr(st.principal)} + ब्याज ${inr(st.interest)})।`,
    "कृपया जल्द आकर भुगतान करें और सामान छुड़ा लें। नियम के अनुसार समय पर न छुड़ाने पर आगे की कार्रवाई हो सकती है।", `रसीद: ${link}`,
  ].join("\n");
}
