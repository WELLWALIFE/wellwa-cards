// Super admin: view a user's credit balance + recent ledger, and grant (or
// claw back with a negative amount) credits.

import { NextResponse } from "next/server";
import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });

  const userId = new URL(request.url).searchParams.get("userId") ?? "";
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const [balRes, ledgerRes] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/user_credits?user_id=eq.${userId}&select=balance`, { headers: serviceHeaders() }),
    fetch(`${SUPA_URL}/rest/v1/credit_ledger?user_id=eq.${userId}&select=delta,reason,ref,created_at&order=created_at.desc&limit=25`, { headers: serviceHeaders() }),
  ]);
  const bal = balRes.ok ? await balRes.json() : [];
  const ledger = ledgerRes.ok ? await ledgerRes.json() : [];
  return NextResponse.json({ balance: bal?.[0]?.balance ?? 0, ledger });
}

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const userId = String(b.userId ?? "");
  const amount = Math.trunc(Number(b.amount ?? 0));
  if (!userId || !amount || Math.abs(amount) > 100000) {
    return NextResponse.json({ error: "userId and a non-zero amount are required." }, { status: 400 });
  }
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/grant_credits`, {
    method: "POST", headers: serviceHeaders(),
    body: JSON.stringify({ p_user: userId, p_amount: amount, p_reason: "admin-grant", p_ref: null }),
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
  return NextResponse.json({ ok: true, balance: await r.json() });
}
