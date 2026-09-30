// V-Card renewal reminders — once a day (deploy.sh writes /etc/cron.d/shubhora-card-renewals → scripts/card-renewals.sh).
//
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/card-renewals
//
// The free V-Card runs 1 year, then ₹1,499 a year; a running Growth / Pro plan covers it (owner's call, 27 Sep 2026).
// Free-plan accounts that have a card hear from us 30, 7 and 1 day before the year ends, on the end day (7 days'
// grace start), 2 days before the pause and at the pause — push + WhatsApp as the Super Admin switches allow
// (type "V-Card renewal"), and email. Each reminder goes once per channel (notification_log), so a missed or a
// repeated run never sends twice. ?dry=1 lists what would be sent without sending.

import { NextResponse } from "next/server";
import { notify, getNotificationSettings } from "@/lib/notify";
import { SITE_URL } from "@/lib/site-url";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { cardRenewalMail, realEmail, sendMail } from "@/lib/mailer";
import { CARD_RENEWAL, rupees } from "@/lib/billing";
import { DAY_MS, cardReminderText, markFor } from "@/lib/card-year";

const CRON_KEY = process.env.CRON_KEY ?? "";
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPA_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers ?? {}) }, cache: "no-store" });
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export async function GET(request: Request) {
  // A cron key, not the admin password: this runs unattended from the server.
  if (!CRON_KEY || request.headers.get("x-cron-key") !== CRON_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 400 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const r = await rest("rpc/cards_ending", { method: "POST", body: JSON.stringify({ p_days: 30 }) });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 400 });
  const rows = (await r.json()) as { user_id: string; email: string | null; until: string }[];

  const now = Date.now();
  const settings = await getNotificationSettings(true);
  const path = "/poster/plan?renew=card";
  const out: { user: string; mark: string; push?: boolean; whatsapp?: boolean; email?: boolean | string }[] = [];

  for (const row of rows) {
    const until = Date.parse(row.until);
    if (!Number.isFinite(until)) continue;
    const due = markFor(until, now);
    if (!due) continue;
    const ref = `card-${due.mark}-${new Date(until).toISOString().slice(0, 10)}`;
    const { title, body } = cardReminderText(due.mark, until, due.left);
    if (dry) { out.push({ user: row.user_id, mark: due.mark }); continue; }

    const res = await notify(row.user_id, "card_renewal", { title, body, path, ref, whatsappText: `*${title}*\n${body}\n\n${SITE_URL}${path}` });
    const line: (typeof out)[number] = { user: row.user_id, mark: due.mark, push: !!res.push?.ok, whatsapp: !!res.whatsapp?.ok };

    // Email: once per reminder (logged like push / WhatsApp); off when the Super Admin has switched all notifications off.
    if (settings.enabled && realEmail(row.email)) {
      const seen = await rest(`notification_log?user_id=eq.${row.user_id}&type=eq.card_renewal&channel=eq.email&ref=eq.${encodeURIComponent(ref)}&ok=is.true&select=id&limit=1`)
        .then((x) => (x.ok ? x.json() : [])).catch(() => []);
      if (Array.isArray(seen) && seen.length) line.email = "already sent";
      else {
        const mail = cardRenewalMail({ mark: due.mark, until: fmt(until), pauseOn: fmt(until + CARD_RENEWAL.graceDays * DAY_MS), left: due.left, price: rupees(CARD_RENEWAL.amount) });
        const sent = await sendMail({ to: row.email!, ...mail });
        line.email = sent.ok;
        if (!sent.skipped) {
          await rest("notification_log", { method: "POST", headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ user_id: row.user_id, type: "card_renewal", channel: "email", ref, ok: sent.ok, error: sent.error ?? null }) }).catch(() => undefined);
        }
      }
    }
    out.push(line);
  }

  return NextResponse.json({ ok: true, dry, considered: rows.length, due: out.length, sent: out });
}
