// GET (bearer) ?as=<ownerId> → leads for the CRM inbox + workspace info.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { inbox, waPlanExpiry, ownerPlanExpiry, bridge, resolveScope, memberships, agentsFor } from "@/lib/crm-server";
import { cloudAccount } from "@/lib/wa-cloud";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "You are not a member of that team." }, { status: 403 });
  const [leads, exp, teams, agents] = await Promise.all([
    inbox(me.token, scope.ownerId),
    scope.role === "owner" ? waPlanExpiry(me.token) : ownerPlanExpiry(scope.ownerId),
    memberships(me.token, me.id),
    agentsFor(me.token, scope.ownerId, scope.role),
  ]);
  // Connection state is best-effort: the inbox must render even when the bridge is down.
  const cloud = await cloudAccount(scope.ownerId);
  const st = cloud?.enabled ? null : exp ? await bridge(scope.ownerId, exp, "status") : null;
  // UPI id + payee name from the owner's card (for "Payment request" links in chat).
  const card = (await restAsService<{ data: { links?: { type: string; value: string }[]; company?: string; name?: string } }[]>(`cards?owner_id=eq.${scope.ownerId}&order=created_at.desc&limit=1&select=data`)).data?.[0]?.data;
  const upi = card?.links?.find((l) => l.type === "upi" && /@/.test(l.value))?.value ?? "";
  const payee = card?.company || card?.name || "";
  const wa = cloud?.enabled ? "connected" : !exp ? "plan" : !st?.ok ? "offline" : st.data.state === "connected" ? "connected" : "disconnected";
  const channel = cloud?.enabled ? "cloud" : "qr";
  return NextResponse.json({ leads, wa, channel, role: scope.role, ownerId: scope.ownerId, me: me.id, teams, upi, payee, agents: agents.map((a) => ({ id: a.agent_user_id, name: a.name || a.phone, role: a.role, joined: !!a.agent_user_id })).filter((a) => a.id) });
}
