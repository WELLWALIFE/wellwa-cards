// Ads v2 sync — from cron (deploy.sh writes /etc/cron.d/shubhora-ads-sync → scripts/ads-sync.sh):
//   hourly  curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/ads-sync            (status, spend, live / rejected / ending / ended messages)
//   20:00   curl -H "x-cron-key: $CRON_KEY" "http://127.0.0.1:3001/api/cron/ads-sync?mode=daily" (one "today's ads" line per owner who spent)
import { NextResponse } from "next/server";
import { serviceConfigured } from "@/lib/admin-guard";
import { syncAds } from "@/lib/ads-sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const mode = new URL(request.url).searchParams.get("mode") === "daily" ? "daily" : "hourly";
  const t = Date.now();
  const rep = await syncAds(mode);
  return NextResponse.json({ ok: true, mode, ...rep, ms: Date.now() - t });
}
