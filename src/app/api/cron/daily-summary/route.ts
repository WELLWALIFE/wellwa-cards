// Morning summary — once a day at 8 am IST from cron:
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/daily-summary
// To every user with an active plan who can be reached (a browser that allowed notifications, or WhatsApp when
// the admin has WhatsApp on for this type): yesterday's new leads and today's follow-ups. Sent once per day.
import { NextResponse } from "next/server";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { getNotificationSettings, notify } from "@/lib/notify";

const rest = (path: string) => fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { ...serviceHeaders(), Prefer: "count=exact" }, cache: "no-store" });
const count = async (path: string) => Number(((await rest(`${path}&select=id&limit=1`)).headers.get("content-range") ?? "*/0").split("/")[1]) || 0;

/** Start of today and yesterday in India time, as ISO instants. */
function istDays() {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const today = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600_000);
  return { today: today.toISOString(), yesterday: new Date(today.getTime() - 86400_000).toISOString(), tomorrow: new Date(today.getTime() + 86400_000).toISOString(), date: ist.toISOString().slice(0, 10) };
}

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const s = await getNotificationSettings(true);
  if (!s.enabled || !s.types.daily_summary || (!s.types.daily_summary.push && !s.types.daily_summary.whatsapp)) return NextResponse.json({ ok: true, skipped: "off" });

  const d = istDays();
  const users = new Set<string>();
  const subs = await rest("push_subscriptions?select=user_id").then((r) => (r.ok ? r.json() : [])).catch(() => []);
  for (const x of subs as { user_id: string }[]) users.add(x.user_id);
  if (s.whatsapp && s.types.daily_summary.whatsapp) {
    const active = await rest(`profiles?plan_expires_at=gt.${new Date().toISOString()}&select=id&limit=5000`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    for (const x of active as { id: string }[]) users.add(x.id);
  }

  let sent = 0;
  for (const id of users) {
    const [leads, due] = await Promise.all([
      count(`leads?owner_id=eq.${id}&created_at=gte.${d.yesterday}&created_at=lt.${d.today}`),
      count(`leads?owner_id=eq.${id}&next_follow_up=gte.${d.today}&next_follow_up=lt.${d.tomorrow}&status=not.in.(converted,lost,won)`),
    ]);
    const body = `${leads} new lead${leads === 1 ? "" : "s"} yesterday · ${due} follow-up${due === 1 ? "" : "s"} today.`;
    const res = await notify(id, "daily_summary", { title: "Good morning! Your Shubhora summary", body, path: due ? "/leads" : "/dashboard", ref: d.date });
    if (res.push?.ok || res.whatsapp?.ok) sent++;
  }
  return NextResponse.json({ ok: true, users: users.size, sent });
}
