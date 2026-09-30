// Super admin: fund approvals and manual plan grants.
//   GET                  → every wallet, pending top-ups, recent ledger
//   POST ?do=approve     → approve a top-up (credits the wallet)
//   POST ?do=reject      → reject one
//   POST ?do=adjust      → credit/debit a wallet by hand
//   POST ?do=set-plan    → grant or clear a plan for any user, no wallet involved

import { NextResponse } from "next/server";
import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

const rpc = (fn: string, args: unknown) =>
  fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: serviceHeaders(), body: JSON.stringify(args), cache: "no-store",
  });

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ configured: false, wallets: [], topups: [] });

  const get = (p: string) => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: serviceHeaders(), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);

  const [brands, wallets, topups, ledger, rates] = await Promise.all([
    get("brands?select=id,name,base_domain,rate_discount_pct,active"),
    get("partner_wallets?select=brand_id,balance_paise,updated_at"),
    get("topup_requests?select=*&order=created_at.desc&limit=100"),
    get("wallet_ledger?select=*&order=created_at.desc&limit=100"),
    get("plan_rates?select=plan,price_paise"),
  ]);

  type Brand = { id: string; name: string; base_domain: string; rate_discount_pct: number; active: boolean };
  type Wallet = { brand_id: string; balance_paise: number };
  const byBrand = new Map((wallets as Wallet[]).map((w) => [w.brand_id, w.balance_paise]));

  return NextResponse.json({
    configured: true, rates, ledger,
    wallets: (brands as Brand[]).map((b) => ({ ...b, balance_paise: byBrand.get(b.id) ?? 0 })),
    topups,
  });
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 400 });

  const action = new URL(request.url).searchParams.get("do");
  const b = await request.json().catch(() => ({}));

  const call = async (fn: string, args: unknown) => {
    const r = await rpc(fn, args);
    const d = await r.json().catch(() => null);
    if (!r.ok) return NextResponse.json({ error: "Request failed." }, { status: 400 });
    if (d && d.ok === false) return NextResponse.json({ error: d.error }, { status: 400 });
    return NextResponse.json(d ?? { ok: true });
  };

  switch (action) {
    case "approve":
      return call("admin_approve_topup", { p_request: b.id, p_admin_note: b.note ?? null });
    case "reject":
      return call("admin_reject_topup", { p_request: b.id, p_admin_note: b.note ?? null });
    case "adjust":
      return call("admin_adjust_wallet", {
        p_brand: b.brandId,
        p_amount: Math.round(Number(b.amount) * 100),   // rupees in, paise stored
        p_note: b.note ?? "Manual adjustment",
      });
    case "set-plan":
      return call("admin_set_plan", { p_user: b.userId, p_plan: b.plan, p_months: Number(b.months) || 12 });
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
