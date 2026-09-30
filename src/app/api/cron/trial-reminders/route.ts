// Trial reminders — run once a day from cron.
//
//   curl -H "x-cron-key: $CRON_KEY" https://shubhora.com/api/cron/trial-reminders
//
// Sends a nudge on the days that matter (4 days left, then 1) over the WhatsApp
// bridge when it's connected. The dashboard banner is the reliable channel and
// always shows regardless; this is the extra push for people who aren't logging
// in. Each user is reminded at most once per day-mark, tracked in the profile.

import { SITE_URL } from "@/lib/site-url";
import { NextResponse } from "next/server";
import { notify } from "@/lib/notify";
import { serviceHeaders, serviceConfigured, SUPA_URL } from "@/lib/admin-guard";

const CRON_KEY = process.env.CRON_KEY ?? "";
/** Days-left marks we send on. */
const MARKS = [3, 1];

export async function GET(request: Request) {
  // A cron key, not the admin password: this runs unattended from the server.
  if (!CRON_KEY || request.headers.get("x-cron-key") !== CRON_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 400 });

  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/trials_ending`, {
    method: "POST", headers: serviceHeaders(), body: JSON.stringify({ p_days: 5 }), cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });

  const rows = (await r.json()) as { user_id: string; email: string; days_left: number; expires_at: string }[];
  const due = rows.filter((x) => MARKS.includes(x.days_left));

  // Browser + WhatsApp, as the Super Admin switches allow ("Plan ending soon"). Sent once per day-mark.
  let sent = 0;
  for (const u of due) {
    const text = u.days_left <= 1
      ? "Your Shubhora trial ends tomorrow. Renew to keep your products, gallery and AI chat. Your card stays online either way."
      : `Your Shubhora trial has ${u.days_left} days left. Pick a plan to keep everything running.`;
    const res = await notify(u.user_id, "plan_expiry", {
      title: u.days_left <= 1 ? "Your trial ends tomorrow" : `${u.days_left} days left in your trial`,
      body: text, path: "/settings", ref: `trial-${u.days_left}-${u.expires_at.slice(0, 10)}`,
      whatsappText: `${text} ${SITE_URL}/settings`,
    });
    if (res.push?.ok || res.whatsapp?.ok) sent++;
  }

  return NextResponse.json({ ok: true, considered: rows.length, due: due.length, sent });
}
