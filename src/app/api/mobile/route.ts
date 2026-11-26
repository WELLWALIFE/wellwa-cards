// Mobile shop home: today's close (sale, money by mode, profit), money due, low stock and the latest bills — one call.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { BILL_COLS, dayClose, type BillRow } from "@/lib/mobile";
import { hideBillCost, itemsOf, msCtx, msHas, shopOf, unitCounts } from "@/lib/mobile-server";
import { istDay } from "@/lib/jewellery-server";
import type { Payment } from "@/lib/jewellery";

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
  const seeJobs = all || msHas(access, "repair");
  const seeExp = all || msHas(access, "expense");
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+05:30`).toISOString();
  const target = access.agentId ? setup.staff[access.agentId]?.target ?? 0 : 0;
  const [touched, recent, due, items, units, shop, jobRows, exp, mine30] = await Promise.all([
    restAsService<BillRow[]>(`ms_bills?owner_id=eq.${scope.ownerId}&kind=in.(sale,return)&updated_at=gte.${from}${mine}&select=${BILL_COLS}&limit=5000`),
    restAsService<BillRow[]>(`ms_bills?owner_id=eq.${scope.ownerId}${mine}&select=${BILL_COLS}&order=created_at.desc&limit=15`),
    all ? restAsService<{ balance_paise: number }[]>(`ms_bills?owner_id=eq.${scope.ownerId}&kind=eq.sale&status=eq.open&balance_paise=gt.0&select=balance_paise&limit=5000`) : Promise.resolve({ data: [] as { balance_paise: number }[] }),
    itemsOf(scope.ownerId), unitCounts(scope.ownerId), shopOf(scope.ownerId, setup),
    // Jobs still in the shop, and those closed without a bill today (their advance is today's money too).
    seeJobs ? restAsService<{ status: string; due_date: string | null; payments: Payment[] | null; bill_id: string | null }[]>(`ms_jobs?owner_id=eq.${scope.ownerId}&or=(status.in.(received,repairing,waiting,ready),updated_at.gte.${from})&select=status,due_date,payments,bill_id&limit=3000`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    seeExp ? restAsService<{ amount_paise: number }[]>(`ms_expenses?owner_id=eq.${scope.ownerId}&day=eq.${day}${all ? "" : `&created_by=eq.${scope.userId}`}&select=amount_paise&limit=1000`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    // A staff login's own sale this month, against the target the owner set.
    !access.owner ? restAsService<{ total_paise: number; kind: string }[]>(`ms_bills?owner_id=eq.${scope.ownerId}&created_by=eq.${scope.userId}&kind=in.(sale,return)&status=neq.cancelled&created_at=gte.${monthStart}&select=total_paise,kind&limit=5000`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
  ]);
  const close = dayClose(list(touched), day);
  if (!msHas(access, "cost")) close.profit = 0;
  // Advances on jobs that have no bill yet: money in the drawer today. (Once the bill is made, the bill carries them.)
  const jobs = { open: 0, ready: 0, late: 0 };
  const ist = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
  for (const j of list(jobRows as { data: { status: string; due_date: string | null; payments: Payment[] | null; bill_id: string | null }[] | null })) {
    const live = ["received", "repairing", "waiting", "ready"].includes(j.status);
    if (live) { jobs.open += 1; if (j.status === "ready") jobs.ready += 1; else if (j.due_date && j.due_date < today) jobs.late += 1; }
    if (!j.bill_id && all) for (const p of j.payments ?? []) if (p.at && ist(p.at) === day && p.paise > 0) { close.money[p.mode] = (close.money[p.mode] ?? 0) + p.paise; close.moneyTotal += p.paise; }
  }
  const stockOf = (i: { id: string; serial: boolean; qty: number }) => (i.serial ? units[i.id] ?? 0 : i.qty);
  const low = items.filter((i) => i.kind !== "service" && i.low_qty > 0 && stockOf(i) <= i.low_qty).map((i) => ({ id: i.id, name: i.name, brand: i.brand, variant: i.variant, stock: stockOf(i), low: i.low_qty }));
  const dueRows = list(due as { data: { balance_paise: number }[] | null });
  return NextResponse.json({
    shop, setup, access, today, day, close, jobs, seeJobs, items: items.length, low: low.slice(0, 50),
    due: { count: dueRows.length, paise: dueRows.reduce((a, b) => a + Number(b.balance_paise || 0), 0) },
    recent: list(recent).map((b) => hideBillCost(b, access)),
    expenses: seeExp ? list(exp as { data: { amount_paise: number }[] | null }).reduce((a, e) => a + e.amount_paise, 0) : null,
    month: access.owner ? null : { sale: list(mine30 as { data: { total_paise: number; kind: string }[] | null }).reduce((a, b) => a + (b.kind === "return" ? -b.total_paise : b.total_paise), 0), target },
    stores: setup.stores.length,
  });
}
