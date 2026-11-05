// Super admin: view a user's credit balance + recent ledger, and grant (or
// claw back with a negative amount) credits.

import { NextResponse } from "next/server";
import { requireAdmin, audit, userInScope } from "@/lib/admin-v2";
import { adminAllowed, serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";
import { svc } from "@/lib/service";
import { franchiseBalance } from "@/lib/franchise-server";

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

/** What a credit costs a franchise (owner, 5 Nov 2026): ₹10. */
const CREDIT_PAISE = 1000;

export async function POST(request: Request) {
  // A franchise may give its own users credits too (owner, 5 Nov 2026): up to 200 a time, never a claw-back, and every grant is
  // written with the franchise and the person who gave it, so Super Admin sees "who gave whom how many" on the franchise page.
  const g = await requireAdmin(request, ["users.plan", "franchises.view"], { sensitive: true }); if (!g.ok) return g.res;
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const me = g.me;
  const franchise = me.franchise;
  if (!franchise && !me.rights.includes("users.plan")) return NextResponse.json({ error: "You do not have the right to give credits." }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const userId = String(b.userId ?? "");
  const amount = Math.trunc(Number(b.amount ?? 0));
  if (!userId || !amount || Math.abs(amount) > 100000) {
    return NextResponse.json({ error: "userId and a non-zero amount are required." }, { status: 400 });
  }
  if (franchise && (amount < 1 || amount > 200)) return NextResponse.json({ error: "A franchise can give 1 to 200 credits at a time." }, { status: 400 });
  if (!(await userInScope(me, userId))) return NextResponse.json({ error: "That user is outside your scope." }, { status: 403 });
  // Credits a franchise gives are paid from its own balance (owner, 5 Nov 2026): ₹10 a credit, written to the franchise ledger as an
  // adjustment. Not enough balance → no credits.
  const costPaise = franchise ? amount * CREDIT_PAISE : 0;
  if (franchise) {
    const bal = await franchiseBalance(franchise.id);
    if (bal.balance - bal.pending < costPaise) return NextResponse.json({ error: `Not enough balance: ${amount} credits cost ₹${(costPaise / 100).toLocaleString("en-IN")}, your balance is ₹${Math.max(0, Math.floor((bal.balance - bal.pending) / 100)).toLocaleString("en-IN")}.` }, { status: 402 });
  }
  await audit(me, "user.credits", { type: "user", id: userId, after: { amount, franchise: franchise?.code ?? null } }, request);
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/grant_credits`, {
    method: "POST", headers: serviceHeaders(),
    body: JSON.stringify({ p_user: userId, p_amount: amount, p_reason: franchise ? "franchise-grant" : "admin-grant", p_ref: `by:${me.id || me.email}${franchise ? `;fr:${franchise.id}` : ""}` }),
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
  if (franchise && costPaise > 0) {
    const who = (await svc<{ full_name: string | null; username: string | null }[]>(`profiles?id=eq.${userId}&select=full_name,username&limit=1`)).data?.[0];
    await svc("franchise_ledger", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      franchise_id: franchise.id, kind: "adjustment", amount_paise: -costPaise, user_id: userId,
      payment_ref: `credits:${userId}:${Date.now()}`, note: `${amount} credits to ${who?.full_name || who?.username || "user"} (₹10 a credit)`, created_by: me.id || null,
    }) });
  }
  return NextResponse.json({ ok: true, balance: await r.json(), charged_paise: costPaise });
}
