// Jewellery home: today's rate, today's sale, money due, open estimates and the latest bills — one call for the first screen.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { BILL_COLS, type BillRow } from "@/lib/jewellery";
import { istDay, jwCtx, jwHas, rateOf } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request) {
  const as = new URL(request.url).searchParams.get("as");
  const c = await jwCtx(request, as);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const today = istDay();
  const all = jwHas(access, "reports");
  const mine = all ? "" : `&created_by=eq.${scope.userId}`;
  // India's midnight in UTC: today's bills.
  const from = new Date(new Date(`${today}T00:00:00+05:30`).getTime()).toISOString();
  const [rate, todayBills, due, recent, shop, orders] = await Promise.all([
    rateOf(scope.ownerId),
    restAsService<{ total_paise: number; kind: string; status: string }[]>(`jw_bills?owner_id=eq.${scope.ownerId}&created_at=gte.${from}${mine}&select=total_paise,kind,status`),
    all ? restAsService<{ balance_paise: number }[]>(`jw_bills?owner_id=eq.${scope.ownerId}&kind=eq.sale&status=eq.open&balance_paise=gt.0&select=balance_paise`) : Promise.resolve({ data: [] as { balance_paise: number }[] }),
    restAsService<BillRow[]>(`jw_bills?owner_id=eq.${scope.ownerId}${mine}&select=${BILL_COLS}&order=created_at.desc&limit=15`),
    shopName(scope.ownerId),
    // Orders and repairs still in the shop (phase 2) — counted for the home tile; an empty list if the 0093 tables are not there yet.
    jwHas(access, "orders") ? restAsService<{ status: string; due_date: string | null }[]>(`jw_orders?owner_id=eq.${scope.ownerId}&status=in.(booked,karigar,ready)${all ? "" : `&created_by=eq.${scope.userId}`}&select=status,due_date&limit=2000`) : Promise.resolve({ data: [] as { status: string; due_date: string | null }[] }),
  ]);
  const open = list(orders as { data: { status: string; due_date: string | null }[] | null });
  const sales = list(todayBills).filter((b) => b.kind === "sale" && b.status !== "cancelled");
  const dueRows = list(due as { data: { balance_paise: number }[] | null });
  return NextResponse.json({
    shop, setup, access, rate, today,
    stats: {
      todaySales: sales.length,
      todayPaise: sales.reduce((a, b) => a + Number(b.total_paise || 0), 0),
      todayEstimates: list(todayBills).filter((b) => b.kind === "estimate").length,
      dueCount: dueRows.length,
      duePaise: dueRows.reduce((a, b) => a + Number(b.balance_paise || 0), 0),
      ordersOpen: open.length,
      ordersReady: open.filter((o) => o.status === "ready").length,
      ordersLate: open.filter((o) => o.status !== "ready" && !!o.due_date && o.due_date < today).length,
    },
    recent: list(recent),
  });
}
