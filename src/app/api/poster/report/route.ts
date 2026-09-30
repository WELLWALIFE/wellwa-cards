import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { buildReport, reportText } from "@/lib/report-server";
export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const days = Math.min(90, Math.max(7, Number(new URL(request.url).searchParams.get("days")) || 30));
  const r = await buildReport(me.id, days);
  return NextResponse.json({ report: r, text: reportText(r, "आपकी", true) });
}
