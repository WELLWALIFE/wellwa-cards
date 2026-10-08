// Festival wishes — 9:00 am IST every day from cron (deploy.sh writes /etc/cron.d/shubhora-festival-wishes →
// scripts/festival-wishes.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/festival-wishes
// On a festival day (src/lib/festivals.ts), every owner who switched wishes on (owner_prefs.festival_wishes) has the
// wish sent to all their CRM customers from their own linked WhatsApp, with the business name and link; the owner is
// told how many went. Once per festival per owner (notification_log on the owner's own notice).
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { notify } from "@/lib/notify";
import { festivalOn } from "@/lib/festivals";
import { blast, businessOf, cardOf, hindiCard, siteOf } from "@/lib/customer-send";
import { istToday } from "@/lib/bookings";

export const maxDuration = 285;

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const date = new URL(request.url).searchParams.get("date") ?? istToday();
  const f = festivalOn(date);
  if (!f) return NextResponse.json({ ok: true, date, festival: null });
  const owners = (await restAsService<{ owner_id: string }[]>("owner_prefs?festival_wishes=is.true&select=owner_id&limit=2000")).data ?? [];
  let sentOwners = 0, messages = 0;
  for (const { owner_id } of owners) {
    const ref = `${f.key}:${date}`;
    const done = await restAsService<{ id: string }[]>(`notification_log?user_id=eq.${owner_id}&type=eq.festival_wishes&ref=eq.${encodeURIComponent(ref)}&ok=is.true&select=id&limit=1`);
    if (done.data?.length) continue;
    const c = await cardOf(owner_id);
    const hindi = hindiCard(c);
    const biz = businessOf(c);
    const text = hindi ? `🪔 ${f.wishHi}\n\n— *${biz}* की ओर से, पूरे परिवार को ${f.hi} की हार्दिक शुभकामनाएँ 🙏\n${siteOf(c)}` : `🪔 ${f.wishEn}\n\n— Warm ${f.en} wishes from *${biz}* to you and your family 🙏\n${siteOf(c)}`;
    const r = await blast(owner_id, text, { max: 150 });
    messages += r.sent;
    if (r.sent) sentOwners++;
    // The owner's own notice doubles as the "done" mark for this festival.
    await notify(owner_id, "festival_wishes", {
      title: hindi ? `🪔 ${f.hi} की शुभकामनाएँ भेज दीं` : `🪔 ${f.en} wishes sent`,
      body: r.linked ? (hindi ? `${r.sent} ग्राहकों को आपके नाम से मैसेज गया।` : `Sent to ${r.sent} customers in your name.`) : (hindi ? "WhatsApp लिंक नहीं है — Leads → WhatsApp में लिंक करें, अगली बार अपने-आप जाएगा।" : "WhatsApp is not linked — link it under Leads → WhatsApp and next time it goes by itself."),
      path: "/poster/leads", ref, channels: ["push", "whatsapp"],
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, date, festival: f.key, owners: owners.length, sentOwners, messages });
}
