// GET (bearer) /api/crm/lead/<id>?as= → the customer's whole picture: the lead, open and done tasks, calls, bookings and
// one timeline (messages per day, notes, stage changes, calls, tasks, bookings), newest first.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope, markRead } from "@/lib/crm-server";
import { isUuid, leadFull } from "@/lib/crm-pro";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "You are not a member of that team." }, { status: 403 });
  const full = await leadFull(scope, id);
  if (!full) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  if (full.lead.unread > 0) await markRead(scope.ownerId, id).catch(() => null);
  return NextResponse.json(full);
}
