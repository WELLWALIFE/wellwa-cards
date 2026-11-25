// The weekly Google + website check of every connected business (lib/google-health.ts) — Monday 1:30 am IST, before the 9:30 weekly
// report, which then carries the score. From cron (deploy.sh writes /etc/cron.d/shubhora-google-health → scripts/google-health.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/google-health
import { NextResponse } from "next/server";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { runHealthAll } from "@/lib/google-health";

export const maxDuration = 3600;

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const rows = await fetch(`${SUPA_URL}/rest/v1/google_accounts?status=eq.ok&refresh_token=neq.&select=user_id&limit=500`, { headers: serviceHeaders(), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) as { user_id: string }[];
  const r = await runHealthAll(rows.map((x) => x.user_id));
  return NextResponse.json({ ok: true, owners: rows.length, ...r });
}
