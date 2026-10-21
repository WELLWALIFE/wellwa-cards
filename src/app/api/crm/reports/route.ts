// GET (bearer) ?as=&days=7|30|90 → reports v2 (docs/crm-pro.md 3.12): calls, follow-up discipline, source funnel, lost reasons.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { reports } from "@/lib/crm-pro2";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const days = [7, 30, 90].includes(Number(p.get("days"))) ? Number(p.get("days")) : 30;
  return NextResponse.json(await reports(scope, days));
}
