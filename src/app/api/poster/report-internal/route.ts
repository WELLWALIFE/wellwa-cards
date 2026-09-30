// Server-to-server: the monthly cron asks for a user's report text.
import { NextResponse } from "next/server";
import { buildReport, reportText } from "@/lib/report-server";
export async function GET(request: Request) {
  const key = request.headers.get("x-internal-key") ?? "";
  const expected = process.env.INTERNAL_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!expected || key !== expected) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = new URL(request.url).searchParams.get("user") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(user)) return NextResponse.json({ error: "bad user" }, { status: 400 });
  const r = await buildReport(user, 30);
  return NextResponse.json({ report: r, text: reportText(r, "आपकी", true) });
}
