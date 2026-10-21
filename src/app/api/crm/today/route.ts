// GET (bearer) ?as=<ownerId> → the Today screen buckets (docs/crm-pro.md 3.1): overdue and due tasks, unread chats,
// fresh untouched leads, today's bookings, call-backs the AI receptionist took, leads going cold, and the counters.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { today } from "@/lib/crm-pro";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "You are not a member of that team." }, { status: 403 });
  try { return NextResponse.json(await today(scope)); }
  catch (e) { return NextResponse.json({ error: String((e as Error).message || e).slice(0, 200) }, { status: 502 }); }
}
