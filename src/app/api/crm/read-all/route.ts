// POST (bearer) { as? } → every unread chat in this workspace marked read (owner, 26 Oct 2026: "151 unread ka dher" — mostly replies to a
// broadcast). An agent clears only the chats assigned to them (scopeFilter).
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { scopeFilter } from "@/lib/crm-pro";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const r = await restAsService(`leads?${scopeFilter(scope)}&unread=gt.0`, { method: "PATCH", body: JSON.stringify({ unread: 0 }), headers: { Prefer: "return=minimal" } });
  if (!r.ok) return NextResponse.json({ error: "Could not mark them read. Please try again." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
