// Udhaar reminders by themselves — every day at 11:00 IST, for each mobile shop that switched them on (Mobile → Settings →
// "Remind udhaar every N days"). Each customer gets one WhatsApp with all their due bills, at most once every N days, and only
// from the shop's own linked WhatsApp (nothing goes out from a shop that did not link it). From cron (deploy.sh writes
// /etc/cron.d/shubhora-mobile-remind → scripts/mobile-remind.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/mobile-remind
import { NextResponse } from "next/server";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { cleanMsSetup } from "@/lib/mobile";
import { sendReminders } from "@/lib/mobile-server";

export const maxDuration = 3600;

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const rows = await fetch(`${SUPA_URL}/rest/v1/owner_prefs?crm->mobileSetup->>remindDays=gt.0&select=owner_id,crm&limit=2000`, { headers: serviceHeaders(), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) as { owner_id: string; crm: Record<string, unknown> | null }[];
  let shops = 0, sent = 0, manual = 0;
  for (const row of rows) {
    const setup = cleanMsSetup(row.crm?.mobileSetup);
    if (!setup.remindDays) continue;
    try {
      const r = await sendReminders({ ownerId: row.owner_id, role: "owner", userId: row.owner_id, token: "" }, setup, { minDays: setup.remindDays, max: 200 });
      shops += 1; sent += r.sent; manual += r.manual.length;
    } catch (e) { console.error("[mobile-remind]", row.owner_id, e); }
  }
  return NextResponse.json({ ok: true, shops, sent, notLinked: manual });
}
