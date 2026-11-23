// Mobile shop reports for a period (?from=YYYY-MM-DD&to=YYYY-MM-DD, India dates): sale, returns, GST by HSN, profit, money in by
// mode, best sellers, repair work — worked out in lib/mobile-reports.ts. Needs the "reports" right; profit needs "cost".
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { istDay } from "@/lib/jewellery-server";
import { BILL_COLS, type BillRow } from "@/lib/mobile";
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
  const [bills, jobs, due, shop] = await Promise.all([
    restAsService<BillRow[]>(`ms_bills?owner_id=eq.${o}&kind=in.(sale,return)&updated_at=gte.${start}&select=${BILL_COLS}&order=created_at&limit=20000`),
    restAsService<Pick<JobRow, "status" | "payments" | "bill_id" | "created_at" | "delivered_at" | "labour_paise">[]>(`ms_jobs?owner_id=eq.${o}&updated_at=gte.${start}&select=status,payments,bill_id,created_at,delivered_at,labour_paise&limit=20000`).catch(() => ({ data: [] })),
    restAsService<{ balance_paise: number }[]>(`ms_bills?owner_id=eq.${o}&kind=eq.sale&status=eq.open&balance_paise=gt.0&select=balance_paise&limit=10000`),
    shopOf(o, setup),
  ]);
  const report = buildMsReport(list(bills), list(jobs as { data: Pick<JobRow, "status" | "payments" | "bill_id" | "created_at" | "delivered_at" | "labour_paise">[] | null }), setup.stateCode, { from, to });
  const cost = msHas(access, "cost");
  if (!cost) { report.profit = 0; report.items = report.items.map((i) => ({ ...i, profit: 0 })); }
  return NextResponse.json({ report, shop, today, gstOn: setup.gstOn, cost, dueTotal: list(due).reduce((a, b) => a + Number(b.balance_paise || 0), 0) });
}
