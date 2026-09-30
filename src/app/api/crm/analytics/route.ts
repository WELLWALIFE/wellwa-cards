// GET ?as= (bearer, owner/manager) → CRM analytics for the last 30 days.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { analytics, agentsFor, resolveScope } from "@/lib/crm-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope || scope.role === "agent") return NextResponse.json({ error: "Owner or manager only." }, { status: 403 });
  const agents = await agentsFor(me.token, scope.ownerId, scope.role);
  return NextResponse.json(await analytics(scope.ownerId, agents));
}
