// Mobile shop reports for a period (?from=YYYY-MM-DD&to=YYYY-MM-DD, India dates): sale, returns, GST by HSN, profit, money in by
// mode, best sellers, repair work — worked out in lib/mobile-reports.ts. Needs the "reports" right; profit needs "cost".
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { istDay } from "@/lib/jewellery-server";
import { BILL_COLS, EXPENSE_COLS, staffTotals, type BillRow, type ExpenseRow } from "@/lib/mobile";
import type { JobRow } from "@/lib/mobile-repair";
import { buildMsReport } from "@/lib/mobile-reports";
import { msCtx, msDenied, msHas, shopOf } from "@/lib/mobile-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await msCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!msHas(access, "reports")) return msDenied("see reports");
  const today = istDay();
  let from = isDay(sp.get("from")) ? sp.get("from")! : today, to = isDay(sp.get("to")) ? sp.get("to")! : from;
  if (to > today) to = today;
  if (from > to) from = to;
  const start = new Date(`${from}T00:00:00+05:30`).toISOString();
  const o = scope.ownerId;
  // Anything made or paid in the period was updated in or after it.
  // One branch only (?store=; "" = the main shop), or every place (no store).
  const sq = sp.get("store");
  const store = sq !== null && (sq === "" || setup.stores.some((s) => s.id === sq)) ? sq : null;
  const at = store === null ? "" : `&store=eq.${encodeURIComponent(store)}`;
  type J = Pick<JobRow, "status" | "payments" | "bill_id" | "created_at" | "delivered_at" | "labour_paise" | "tech_id">;
  const [bills, jobs, due, shop, exp, agents] = await Promise.all([
    restAsService<BillRow[]>(`ms_bills?owner_id=eq.${o}&kind=in.(sale,return)&updated_at=gte.${start}${at}&select=${BILL_COLS}&order=created_at&limit=20000`),
    restAsService<J[]>(`ms_jobs?owner_id=eq.${o}&updated_at=gte.${start}${at}&select=status,payments,bill_id,created_at,delivered_at,labour_paise,tech_id&limit=20000`).catch(() => ({ data: [] })),
    restAsService<{ balance_paise: number }[]>(`ms_bills?owner_id=eq.${o}&kind=eq.sale&status=eq.open&balance_paise=gt.0${at}&select=balance_paise&limit=10000`),
    shopOf(o, setup),
    restAsService<ExpenseRow[]>(`ms_expenses?owner_id=eq.${o}&day=gte.${from}&day=lte.${to}${at}&select=${EXPENSE_COLS}&limit=10000`).catch(() => ({ data: [] })),
    restAsService<{ id: string; agent_user_id: string | null; name: string }[]>(`crm_agents?owner_id=eq.${o}&select=id,agent_user_id,name&limit=500`),
  ]);
  const jobRows = list(jobs as { data: J[] | null });
  const report = buildMsReport(list(bills), jobRows, setup.stateCode, { from, to });
  // Expenses of the period by head, and what is left of the profit after them.
  const expenses = list(exp as { data: ExpenseRow[] | null });
  const expByCat: Record<string, number> = {};
  for (const e of expenses) expByCat[e.category] = (expByCat[e.category] ?? 0) + e.amount_paise;
  const expTotal = expenses.reduce((a, e) => a + e.amount_paise, 0);
  const expCash = expenses.filter((e) => e.mode === "cash").reduce((a, e) => a + e.amount_paise, 0);
  // Each person's sale, target and commission: bills made in the period, jobs given back in it.
  const istDayOf = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const inRange = (iso: string | null) => !!iso && istDayOf(iso) >= from && istDayOf(iso) <= to;
  const staff = staffTotals(list(bills).filter((b) => inRange(b.created_at)), jobRows.filter((j) => inRange(j.delivered_at)), list(agents), setup, o);
  const cost = msHas(access, "cost");
  if (!cost) { report.profit = 0; report.items = report.items.map((i) => ({ ...i, profit: 0 })); for (const s of staff) s.profit = 0; }
  return NextResponse.json({ report, shop, today, gstOn: setup.gstOn, cost, dueTotal: list(due).reduce((a, b) => a + Number(b.balance_paise || 0), 0),
    expenses: { total: expTotal, cash: expCash, byCat: expByCat }, staff: access.owner || msHas(access, "setup") ? staff : [], stores: setup.stores, store });
}
