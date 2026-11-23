// Mobile shop home: today's close (sale, money by mode, profit), money due, low stock and the latest bills — one call.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { BILL_COLS, dayClose, type BillRow } from "@/lib/mobile";
import { hideBillCost, itemsOf, msCtx, msHas, shopOf, unitCounts } from "@/lib/mobile-server";
import { istDay } from "@/lib/jewellery-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await msCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const today = istDay(), day = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("day") ?? "") && sp.get("day")! <= today ? sp.get("day")! : today;
  const all = msHas(access, "reports");
  const from = new Date(`${day}T00:00:00+05:30`).toISOString();
  const mine = all ? "" : `&created_by=eq.${scope.userId}`;
  const [touched, recent, due, items, units, shop] = await Promise.all([
    restAsService<BillRow[]>(`ms_bills?owner_id=eq.${scope.ownerId}&kind=eq.sale&updated_at=gte.${from}${mine}&select=${BILL_COLS}&limit=5000`),
    restAsService<BillRow[]>(`ms_bills?owner_id=eq.${scope.ownerId}${mine}&select=${BILL_COLS}&order=created_at.desc&limit=15`),
    all ? restAsService<{ balance_paise: number }[]>(`ms_bills?owner_id=eq.${scope.ownerId}&kind=eq.sale&status=eq.open&balance_paise=gt.0&select=balance_paise&limit=5000`) : Promise.resolve({ data: [] as { balance_paise: number }[] }),
    itemsOf(scope.ownerId), unitCounts(scope.ownerId), shopOf(scope.ownerId, setup),
  ]);
  const close = dayClose(list(touched), day);
  if (!msHas(access, "cost")) close.profit = 0;
  const stockOf = (i: { id: string; serial: boolean; qty: number }) => (i.serial ? units[i.id] ?? 0 : i.qty);
  const low = items.filter((i) => i.kind !== "service" && i.low_qty > 0 && stockOf(i) <= i.low_qty).map((i) => ({ id: i.id, name: i.name, brand: i.brand, variant: i.variant, stock: stockOf(i), low: i.low_qty }));
  const dueRows = list(due as { data: { balance_paise: number }[] | null });
  return NextResponse.json({
    shop, setup, access, today, day, close, items: items.length, low: low.slice(0, 50),
    due: { count: dueRows.length, paise: dueRows.reduce((a, b) => a + Number(b.balance_paise || 0), 0) },
    recent: list(recent).map((b) => hideBillCost(b, access)),
  });
}
