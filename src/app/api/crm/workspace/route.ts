// GET (bearer) ?as=<ownerId> → who the caller is in this workspace and what is connected: role, team roster, WhatsApp
// state, UPI for payment links. The same facts /api/crm/inbox sends with the 500 leads — here without the leads, for the
// CRM Pro screens that page their own lists.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { waPlanExpiry, ownerPlanExpiry, bridge, resolveScope, memberships, agentsFor } from "@/lib/crm-server";
import { cloudAccount } from "@/lib/wa-cloud";
import { prefsOf } from "@/lib/crm-pro";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "You are not a member of that team." }, { status: 403 });
  const [exp, teams, agents, cloud, card, prefs] = await Promise.all([
    scope.role === "owner" ? waPlanExpiry(me.token) : ownerPlanExpiry(scope.ownerId),
    memberships(me.token, me.id),
    agentsFor(me.token, scope.ownerId, scope.role),
    cloudAccount(scope.ownerId),
    restAsService<{ data: { links?: { type: string; value: string }[]; company?: string; name?: string } }[]>(`cards?owner_id=eq.${scope.ownerId}&order=created_at.desc&limit=1&select=data`),
    prefsOf(scope.ownerId),
  ]);
  const st = cloud?.enabled ? null : exp ? await bridge(scope.ownerId, exp, "status") : null;
  const c = card.data?.[0]?.data;
  const upi = c?.links?.find((l) => l.type === "upi" && /@/.test(l.value))?.value ?? "";
  const wa = cloud?.enabled ? "connected" : !exp ? "plan" : !st?.ok ? "offline" : st.data.state === "connected" ? "connected" : "disconnected";
  return NextResponse.json({ wa, channel: cloud?.enabled ? "cloud" : "qr", role: scope.role, ownerId: scope.ownerId, me: me.id, teams, upi, payee: c?.company || c?.name || "", business: c?.company || c?.name || "", prefs,
    agents: agents.map((a) => ({ id: a.agent_user_id, name: a.name || a.phone, role: a.role, joined: !!a.agent_user_id })).filter((a) => a.id) });
}
