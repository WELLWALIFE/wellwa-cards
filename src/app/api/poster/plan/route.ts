// The signed-in customer's subscription: tier, days left, credits, and the payment history.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser } from "@/lib/poster-server";
import { SAAS_PLANS, type SaasTier } from "@/lib/billing";

type Saas = { tier: string; expires_at: string | null; days_left: number; state: "none" | "active" | "grace" | "expired"; monthly_credits: number; pack_credits: number };
/** The V-Card's year (migration 0057): included in a paid plan, free / renewed year running, 7-day grace, or paused. */
/** Growth by autopay (migration 0058): the newest mandate and where it stands. */
type Autopay = { id: string; status: string; charge_at: string | null; paid_count: number };
type CardYear = { state: "included" | "active" | "grace" | "paused"; until: string | null; days_left: number | null; pause_on: string | null; renewed: boolean };

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [saasRes, trialRes, payRes, cardRes, autoRes] = await Promise.all([
    restAsUser<Saas[]>(me.token, `rpc/my_saas`, { method: "POST", body: "{}" }),
    restAsUser<{ plan: string; is_trial: boolean; days_left: number; expired: boolean }[]>(me.token, `rpc/my_plan`, { method: "POST", body: "{}" }),
    restAsUser<{ amount: number; created_at: string; provider_ref: string; plan?: string }[]>(me.token, `subscriptions?select=amount,created_at,provider_ref,plan&order=created_at.desc&limit=12`),
    // Before migration 0057 has run this call fails — then there is simply no card year to show.
    restAsUser<CardYear[]>(me.token, `rpc/my_card`, { method: "POST", body: "{}" }).catch(() => ({ data: null })),
    // Before migration 0058 has run this call fails — then there is no autopay to show.
    restAsUser<Autopay[]>(me.token, `saas_autopay?select=id,status,charge_at,paid_count&order=created_at.desc&limit=1`).catch(() => ({ data: null })),
  ]);
  const saas = saasRes.data?.[0] ?? null;
  const trial = trialRes.data?.[0] ?? null;
  const tier = saas && saas.tier !== "none" ? (saas.tier as SaasTier) : null;
  return NextResponse.json({
    tier, plan: tier ? SAAS_PLANS[tier] : null,
    state: saas?.state ?? "none",
    expires_at: saas?.expires_at ?? null,
    days_left: saas?.days_left ?? 0,
    credits: { monthly: saas?.monthly_credits ?? 0, packs: saas?.pack_credits ?? 0, total: (saas?.monthly_credits ?? 0) + (saas?.pack_credits ?? 0) },
    trial: trial && trial.is_trial ? { days_left: trial.days_left, expired: trial.expired } : null,
    payments: payRes.data ?? [],
    card: (Array.isArray(cardRes.data) ? cardRes.data[0] : null) ?? null,
    autopay: (Array.isArray(autoRes.data) ? autoRes.data[0] : null) ?? null,
  });
}
