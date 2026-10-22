// Festival wishes — 9:00 am IST every day from cron (deploy.sh writes /etc/cron.d/shubhora-festival-wishes →
// scripts/festival-wishes.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/festival-wishes   (repeated while it answers more: true)
// On a festival day (src/lib/festivals.ts), every owner who switched wishes on (owner_prefs.festival_wishes) has the
// wish sent to all their CRM customers from their own linked WhatsApp, with the business name and link; the owner is
// told how many went. Once per festival per owner (notification_log on the owner's own notice).
// 150 customers at ~3 s each is more than one run can hold, so a run stops starting sends after BUDGET_MS and answers
// `more: true`; the cron script calls again and the next run carries on. Every number is claimed in festival_sends
// (0073, unique per owner + festival + phone) before its send, so a rerun or an overlapping run never wishes anyone
// twice. Owners are taken in a rotating order (by date) so no one is always last, PARALLEL of them at a time.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { notify } from "@/lib/notify";
import { festivalOn } from "@/lib/festivals";
import { blast, businessOf, cardOf, hindiCard, siteOf } from "@/lib/customer-send";
import { istToday } from "@/lib/bookings";

export const maxDuration = 285;
const BUDGET_MS = 240_000;
const PARALLEL = 4;   // every owner has their own bridge, so a few owners can go at once

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const date = new URL(request.url).searchParams.get("date") ?? istToday();
  const f = festivalOn(date);
  if (!f) return NextResponse.json({ ok: true, date, festival: null });
  const started = Date.now();
  const until = started + BUDGET_MS;
  const festival = `${f.key}:${date}`;
  // Without the 0073 table there is no way to tell who already got the wish — refuse instead of risking doubles.
  const probe = await restAsService("festival_sends?select=phone&limit=1");
  if (!probe.ok) return NextResponse.json({ error: "festival_sends missing — run migration 0073" }, { status: 503 });
  const all = (await restAsService<{ owner_id: string }[]>("owner_prefs?festival_wishes=is.true&select=owner_id&order=owner_id.asc&limit=2000")).data ?? [];
  const shift = all.length ? Number(date.replace(/\D/g, "")) % all.length : 0;
  const owners = [...all.slice(shift), ...all.slice(0, shift)];
  let sentOwners = 0, messages = 0, more = false, next = 0;
  const one = async (owner_id: string) => {
    const done = await restAsService<{ id: string }[]>(`notification_log?user_id=eq.${owner_id}&type=eq.festival_wishes&ref=eq.${encodeURIComponent(festival)}&ok=is.true&select=id&limit=1`);
    if (done.data?.length) return;
    const c = await cardOf(owner_id);
    const hindi = hindiCard(c);
    const biz = businessOf(c);
    const text = hindi ? `🪔 ${f.wishHi}\n\n— *${biz}* की ओर से, पूरे परिवार को ${f.hi} की हार्दिक शुभकामनाएँ 🙏\n${siteOf(c)}` : `🪔 ${f.wishEn}\n\n— Warm ${f.en} wishes from *${biz}* to you and your family 🙏\n${siteOf(c)}`;
    const claim = async (phone: string) => {
      const r = await restAsService<unknown[]>("festival_sends?on_conflict=owner_id,festival,phone", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ owner_id, festival, phone }) });
      return r.ok && (r.data?.length ?? 0) > 0;   // nothing back = already claimed (sent, or being sent by another run)
    };
    const release = async (phone: string) => { await restAsService(`festival_sends?owner_id=eq.${owner_id}&festival=eq.${encodeURIComponent(festival)}&phone=eq.${phone}`, { method: "DELETE" }); };
    const r = await blast(owner_id, text, { max: 150, until, claim, release });
    messages += r.sent;
    if (r.sent) sentOwners++;
    if (!r.complete) { more = true; return; }   // the next run carries on with this owner; the notice waits till then
    // Everyone this festival across all runs, for the owner's notice.
    const total = r.linked ? ((await restAsService<unknown[]>(`festival_sends?owner_id=eq.${owner_id}&festival=eq.${encodeURIComponent(festival)}&select=phone&limit=5000`)).data?.length ?? r.sent) : 0;
    // The owner's own notice doubles as the "done" mark for this festival.
    await notify(owner_id, "festival_wishes", {
      title: hindi ? `🪔 ${f.hi} की शुभकामनाएँ भेज दीं` : `🪔 ${f.en} wishes sent`,
      body: r.linked ? (hindi ? `${total} ग्राहकों को आपके नाम से मैसेज गया।` : `Sent to ${total} customers in your name.`) : (hindi ? "WhatsApp लिंक नहीं है — Leads → WhatsApp में लिंक करें, अगली बार अपने-आप जाएगा।" : "WhatsApp is not linked — link it under Leads → WhatsApp and next time it goes by itself."),
      path: "/poster/leads", ref: festival, channels: ["push", "whatsapp"],
    }).catch(() => undefined);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, owners.length) }, async () => {
    while (next < owners.length) {
      if (Date.now() > until) { more = true; return; }
      const { owner_id } = owners[next++];
      await one(owner_id).catch((e) => { more = true; console.error("[festival-wishes]", owner_id, e instanceof Error ? e.message : e); });
    }
  }));
  return NextResponse.json({ ok: true, date, festival: f.key, owners: owners.length, sentOwners, messages, more, seconds: Math.round((Date.now() - started) / 1000) });
}
