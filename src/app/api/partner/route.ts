// White-label partner self-service.
//   GET               → wallet balance, rates, members, ledger, top-up requests
//   POST ?do=activate → activate a member's plan, debiting the wallet
//   POST ?do=topup    → request funds (super admin approves before crediting)
//
// Everything runs as the caller: RLS and my_brand() decide what they can touch,
// so this route never has to trust a brand id sent by the browser.

import { NextResponse } from "next/server";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function userHeaders(request: Request): Record<string, string> | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return { apikey: ANON, Authorization: auth, "Content-Type": "application/json" };
}

const rpc = (h: Record<string, string>, fn: string, args: unknown = {}) =>
  fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args), cache: "no-store" });

export async function GET(request: Request) {
  const h = userHeaders(request);
  if (!h) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const brandId = await rpc(h, "my_brand").then((r) => r.json()).catch(() => null);
  if (!brandId) return NextResponse.json({ partner: false });

  const get = (path: string) => fetch(`${SUPA}/rest/v1/${path}`, { headers: h, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  const [brandRows, walletRows, ledger, topups, rates] = await Promise.all([
    get(`brands?id=eq.${brandId}&select=id,name,base_domain,rate_discount_pct,active`),
    get(`partner_wallets?brand_id=eq.${brandId}&select=balance_paise,updated_at`),
    get(`wallet_ledger?brand_id=eq.${brandId}&select=*&order=created_at.desc&limit=100`),
    get(`topup_requests?brand_id=eq.${brandId}&select=*&order=created_at.desc&limit=50`),
    get(`plan_rates?select=plan,price_paise`),
  ]);

  // Members are read with the service-free path: profiles is readable by the
  // partner only through this brand filter, which RLS on profiles enforces.
  const members = await get(
    `profiles?brand_id=eq.${brandId}&select=id,full_name,plan,plan_expires_at&order=created_at.desc&limit=500`,
  );

  return NextResponse.json({
    partner: true,
    brand: brandRows[0] ?? null,
    balance: walletRows[0]?.balance_paise ?? 0,
    rates, members, ledger, topups,
  });
}

export async function POST(request: Request) {
  const h = userHeaders(request);
  if (!h) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const action = new URL(request.url).searchParams.get("do");
  const body = await request.json().catch(() => ({}));

  if (action === "activate") {
    const r = await rpc(h, "partner_activate", {
      p_member_email: String(body.email ?? "").trim(),
      p_plan: body.plan === "team" ? "team" : "pro",
      p_months: Math.max(1, Number(body.months) || 1),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return NextResponse.json({ error: "Activation failed." }, { status: 400 });
    if (!d?.ok) return NextResponse.json({ error: d?.error ?? "Activation failed." }, { status: 400 });
    return NextResponse.json(d);
  }

  if (action === "topup") {
    const rupees = Number(body.amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    }
    const brandId = await rpc(h, "my_brand").then((x) => x.json()).catch(() => null);
    if (!brandId) return NextResponse.json({ error: "Not a partner." }, { status: 403 });

    const r = await fetch(`${SUPA}/rest/v1/topup_requests`, {
      method: "POST",
      headers: { ...h, Prefer: "return=representation" },
      body: JSON.stringify({
        brand_id: brandId,
        amount_paise: Math.round(rupees * 100),
        method: body.method ?? "bank",
        reference: body.reference ?? null,
        note: body.note ?? null,
        status: "pending",
      }),
    });
    if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
    return NextResponse.json({ ok: true, request: (await r.json())[0] });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
