// GET (bearer) ?as=&days=7|30|90 → per person: calls, connected, sales won, revenue, tasks done (docs/crm-pro.md 3.14).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { leaderboard } from "@/lib/crm-pro3";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const days = [7, 30, 90].includes(Number(p.get("days"))) ? Number(p.get("days")) : 30;
  return NextResponse.json({ board: await leaderboard(scope, days) });
}
