// Booking reminders — every 15 minutes from cron (deploy.sh writes /etc/cron.d/shubhora-booking-reminders →
// scripts/booking-reminders.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/booking-reminders
// For every booking still "booked":
//   • the customer hears a day before and two hours before — from the owner's own WhatsApp when it is linked (the
//     bridge), else the owner gets the reminder with the message ready to forward in one tap;
//   • the owner hears two hours before (push + WhatsApp, type "Booking reminder"), with the customer's number.
// Each reminder is stamped on the row, so it goes once.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { serviceConfigured } from "@/lib/admin-guard";
import { notify } from "@/lib/notify";
import { bridge, ownerPlanExpiry } from "@/lib/crm-server";
import { BOOKING_COLS, customerReminder, fmtWhen, relDay, tapLink, type Booking } from "@/lib/bookings";

type CardRow = { id: string; owner_id: string; company: string | null; name: string | null; data: { language?: string; tagline?: string; about?: string } | null };
const H = 3600_000;

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const now = Date.now();
  const list = (await restAsService<Booking[]>(`bookings?status=eq.booked&starts_at=gte.${new Date(now).toISOString()}&starts_at=lte.${new Date(now + 26 * H).toISOString()}&order=starts_at.asc&limit=500&select=${BOOKING_COLS}`)).data ?? [];
  const cards = new Map<string, CardRow>();
  const stats = { customer: 0, handed: 0, owner: 0 };
  for (const b of list) {
    const ahead = new Date(b.starts_at).getTime() - now;
    const want24 = !b.reminded_customer_24h && ahead <= 25 * H && ahead > 22 * H;
    const want2 = !b.reminded_customer_2h && ahead <= 2.25 * H && ahead > 1 * H;
    const wantOwner = !b.reminded_owner_at && ahead <= 2.25 * H && ahead > 1 * H;
    if (!want24 && !want2 && !wantOwner) continue;
    if (!cards.has(b.owner_id)) {
      const c = (await restAsService<CardRow[]>(`cards?owner_id=eq.${b.owner_id}&order=created_at.asc&limit=1&select=id,owner_id,company,name,data`)).data?.[0];
      if (c) cards.set(b.owner_id, c);
    }
    const c = cards.get(b.owner_id);
    const hindi = !c || c.data?.language === "hi" || /[ऀ-ॿ]/.test(`${c?.data?.tagline ?? ""} ${c?.data?.about ?? ""} ${b.name} ${b.service}`);
    const business = c?.company || c?.name || "Shubhora";
    const stamp: Record<string, string> = {};
    const nowIso = new Date(now).toISOString();

    if ((want24 || want2) && b.phone.replace(/\D/g, "").length >= 10) {
      const text = customerReminder(b, business, hindi);
      const expiry = await ownerPlanExpiry(b.owner_id);
      let sent = false;
      if (expiry) {
        const num = b.phone.replace(/\D/g, "");
        const r = await bridge(b.owner_id, expiry, "send", { to: num.length === 10 ? `91${num}` : num, text });
        sent = r.ok;
      }
      if (sent) stats.customer++;
      else {
        // No linked WhatsApp: the owner forwards it in one tap.
        const link = tapLink(b.phone, text);
        await notify(b.owner_id, "booking_reminder", {
          title: hindi ? `⏰ ${b.name || "ग्राहक"} को याद दिलाएँ` : `⏰ Remind ${b.name || "the customer"}`,
          body: `${fmtWhen(b.starts_at, hindi)}${b.service ? ` · ${b.service}` : ""}`.slice(0, 160), path: "/poster/leads?tab=bookings", ref: `cust:${b.id}:${want24 ? "24h" : "2h"}`,
          whatsappText: hindi
            ? `⏰ *बुकिंग रिमाइंडर भेजें*\n${b.name || b.phone} — ${fmtWhen(b.starts_at, true)}${b.service ? ` · ${b.service}` : ""}\n\nएक टैप में मैसेज भेजें:\n${link || b.phone}`
            : `⏰ *Send the booking reminder*\n${b.name || b.phone} — ${fmtWhen(b.starts_at, false)}${b.service ? ` · ${b.service}` : ""}\n\nSend it in one tap:\n${link || b.phone}`,
        }).catch(() => undefined);
        stats.handed++;
      }
      if (want24) stamp.reminded_customer_24h = nowIso;
      if (want2) stamp.reminded_customer_2h = nowIso;
    } else if (want24 || want2) {
      if (want24) stamp.reminded_customer_24h = nowIso;
      if (want2) stamp.reminded_customer_2h = nowIso;
    }

    if (wantOwner) {
      const who = `${b.name || (hindi ? "ग्राहक" : "Customer")}${b.phone ? ` · ${b.phone}` : ""}`;
      await notify(b.owner_id, "booking_reminder", {
        title: hindi ? `📅 ${relDay(b.starts_at, true)} ${fmtWhen(b.starts_at, true).split(", ")[1]} — ${b.name || "बुकिंग"}` : `📅 ${relDay(b.starts_at, false)} ${fmtWhen(b.starts_at, false).split(", ")[1]} — ${b.name || "booking"}`,
        body: `${who}${b.service ? ` · ${b.service}` : ""}`.slice(0, 160), path: "/poster/leads?tab=bookings", ref: `own:${b.id}`,
        whatsappText: hindi
          ? `📅 *2 घंटे में बुकिंग*\n${who}\n${fmtWhen(b.starts_at, true)}${b.service ? ` · ${b.service}` : ""}${b.note ? `\n${b.note}` : ""}${b.phone ? `\n\nकॉल / WhatsApp: ${b.phone}` : ""}`
          : `📅 *Booking in 2 hours*\n${who}\n${fmtWhen(b.starts_at, false)}${b.service ? ` · ${b.service}` : ""}${b.note ? `\n${b.note}` : ""}${b.phone ? `\n\nCall / WhatsApp: ${b.phone}` : ""}`,
      }).catch(() => undefined);
      stamp.reminded_owner_at = nowIso;
      stats.owner++;
    }
    if (Object.keys(stamp).length) await restAsService(`bookings?id=eq.${b.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(stamp) });
  }
  return NextResponse.json({ ok: true, checked: list.length, ...stats });
}
