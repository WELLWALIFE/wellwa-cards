// GET (bearer) ?as= → this month's sales against the monthly target, per person, and what is in the pipeline
// (owner, 23 Oct 2026: "professional CRM" — sales target + expected sales).
//   { month: "2026-10", target_paise, sold_paise, sales, byAgent: [{ id, sold_paise, sales }], pipeline: { paise, leads } }
// An agent sees their own numbers only.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { prefsOf, scopeFilter } from "@/lib/crm-pro";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  // The month in IST.
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const startIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1);
  const since = new Date(startIst - 5.5 * 3600_000).toISOString();
  const agentF = scope.role === "agent" ? `&agent_id=eq.${scope.userId}` : "";
  const [sales, open, prefs] = await Promise.all([
    restAsService<{ agent_id: string | null; amount_paise: number }[]>(`crm_sales?owner_id=eq.${scope.ownerId}${agentF}&status=neq.refunded&sold_at=gte.${encodeURIComponent(since)}&select=agent_id,amount_paise&limit=5000`),
    // Expected: customers who are interested or in follow-up, at their deal value (else their budget).
    restAsService<{ value_paise: number | null; budget_paise: number | null }[]>(`leads?${scopeFilter(scope)}&status=in.(interested,follow_up)&tags=not.cs.%7Bpersonal%7D&select=value_paise,budget_paise&limit=5000`),
    prefsOf(scope.ownerId),
  ]);
  const rows = Array.isArray(sales.data) ? sales.data : [];
  const by = new Map<string, { id: string; sold_paise: number; sales: number }>();
  for (const r of rows) { const id = r.agent_id ?? scope.ownerId; const x = by.get(id) ?? { id, sold_paise: 0, sales: 0 }; x.sold_paise += Number(r.amount_paise) || 0; x.sales += 1; by.set(id, x); }
  const pipe = Array.isArray(open.data) ? open.data : [];
  return NextResponse.json({
    month: `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`,
    target_paise: scope.role === "agent" ? 0 : (prefs.sales_target_k || 0) * 100_000,
    sold_paise: rows.reduce((n, r) => n + (Number(r.amount_paise) || 0), 0),
    sales: rows.length,
    byAgent: [...by.values()].sort((a, b) => b.sold_paise - a.sold_paise),
    pipeline: { paise: pipe.reduce((n, l) => n + (Number(l.value_paise) || Number(l.budget_paise) || 0), 0), leads: pipe.length },
  }, { headers: { "Cache-Control": "no-store" } });
}
