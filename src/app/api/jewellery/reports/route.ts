// Reports for a range of India dates (?from=&to=, default today; at most 400 days): sale, GST, money in, old gold, purity,
// HSN, B2B / B2C and day by day — the maths in lib/jewellery-reports.ts. Needs the "reports" right.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { BILL_COLS, type BillRow, type Payment } from "@/lib/jewellery";
import { istDay, jwCtx, jwDenied, jwHas } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { buildReport } from "@/lib/jewellery-reports";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
/** The UTC moment India's day starts. */
const startOf = (day: string) => new Date(`${day}T00:00:00+05:30`).toISOString();
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await jwCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!jwHas(access, "reports")) return jwDenied("see reports");
  const today = istDay();
  let from = isDay(sp.get("from")) ? sp.get("from")! : today;
  let to = isDay(sp.get("to")) ? sp.get("to")! : from;
  if (to < from) [from, to] = [to, from];
  if (to > today) to = today;
  if (Date.parse(to) - Date.parse(from) > 400 * 86400_000) return NextResponse.json({ error: "Pick at most 400 days." }, { status: 400 });
  const a = startOf(from), b = startOf(nextDay(to));
  const o = scope.ownerId;
  // Sale bills made in the range, and any bill touched since (a payment taken later counts on its own day).
  const [bills, orders, due, shop, schemes, girvi] = await Promise.all([
    restAsService<BillRow[]>(`jw_bills?owner_id=eq.${o}&kind=eq.sale&or=(and(created_at.gte.${a},created_at.lt.${b}),updated_at.gte.${a})&select=${BILL_COLS}&order=created_at&limit=10000`),
    restAsService<{ code: string; status: string; payments: Payment[] }[]>(`jw_orders?owner_id=eq.${o}&or=(created_at.gte.${a},updated_at.gte.${a})&select=code,status,payments&limit=10000`),
    restAsService<{ balance_paise: number }[]>(`jw_bills?owner_id=eq.${o}&kind=eq.sale&status=eq.open&balance_paise=gt.0&select=balance_paise&limit=20000`),
    shopName(o),
    // Gold scheme instalments and girvi money (phase 5); an empty list when those tables are not there yet.
    restAsService<{ status: string; payments: Payment[] }[]>(`jw_schemes?owner_id=eq.${o}&or=(created_at.gte.${a},updated_at.gte.${a})&select=status,payments&limit=10000`).catch(() => ({ data: [] })),
    restAsService<{ status: string; loan_paise: number; start_day: string; payments: (Payment & { interest?: number; principal?: number })[] }[]>(`jw_girvi?owner_id=eq.${o}&or=(created_at.gte.${a},updated_at.gte.${a})&select=status,loan_paise,start_day,payments&limit=10000`).catch(() => ({ data: [] })),
  ]);
  if (!bills.ok) return NextResponse.json({ error: "Could not load the bills." }, { status: 500 });
  const report = buildReport(list(bills), list(orders), setup, { from, to }, { schemes: list(schemes as { data: { status: string; payments: Payment[] }[] | null }), girvi: list(girvi as { data: { status: string; loan_paise: number; start_day: string; payments: (Payment & { interest?: number; principal?: number })[] }[] | null }) });
  const dueRows = list(due);
  return NextResponse.json({
    report, today, shop: setup.shopName || shop, stateCode: setup.stateCode, gstin: setup.gstin,
    due: { count: dueRows.length, paise: dueRows.reduce((s, r) => s + Number(r.balance_paise || 0), 0) },
    capped: list(bills).length >= 10000,
  });
}
