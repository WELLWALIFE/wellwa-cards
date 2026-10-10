// Weekly website report — Monday 9:30 am IST from cron (deploy.sh writes /etc/cron.d/shubhora-weekly-report →
// scripts/weekly-report.sh):
//   curl -H "x-cron-key: $CRON_KEY" http://127.0.0.1:3001/api/cron/weekly-report
// Every owner with a live card hears, on push and their WhatsApp (as the Super Admin switches allow, type "Weekly
// report"), what their website did in the last 7 days: people who saw it, who tapped WhatsApp / call, enquiries, and
// orders or bookings the AI salesman took — so they never have to open the app to know it is working (owner's call,
// 8 Oct 2026). Sent once per week per owner (notification_log).
import { NextResponse } from "next/server";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";
import { getNotificationSettings, notify } from "@/lib/notify";
import { SITE_URL } from "@/lib/site-url";

const rest = (path: string) => fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { ...serviceHeaders(), Prefer: "count=exact" }, cache: "no-store" });
const count = async (path: string) => Number(((await rest(`${path}&select=id&limit=1`)).headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
type CardRow = { id: string; owner_id: string; username: string; company: string | null; name: string | null; data: { language?: string; tagline?: string; about?: string } | null; created_at: string };

export async function GET(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const s = await getNotificationSettings(true);
  if (!s.enabled || !s.types.weekly_report || (!s.types.weekly_report.push && !s.types.weekly_report.whatsapp)) return NextResponse.json({ ok: true, skipped: "off" });

  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const week = new Date().toISOString().slice(0, 10);
  const cards = await rest("cards?active=eq.true&select=id,owner_id,username,company,name,data,created_at&order=created_at.asc&limit=5000").then((r) => (r.ok ? r.json() : [])).catch(() => []) as CardRow[];
  // One report per owner: their first (primary) card.
  const byOwner = new Map<string, CardRow>();
  for (const c of cards) if (!byOwner.has(c.owner_id)) byOwner.set(c.owner_id, c);

  let sent = 0, quiet = 0;
  for (const [owner, c] of byOwner) {
    const u = encodeURIComponent(c.username);
    const [views, taps, enquiries, orders] = await Promise.all([
      count(`card_events?username=eq.${u}&kind=eq.view&created_at=gte.${since}`),
      count(`card_events?username=eq.${u}&kind=eq.click&or=(target.ilike.*whatsapp*,target.ilike.*phone*,target.ilike.*call*)&created_at=gte.${since}`),
      count(`leads?owner_id=eq.${owner}&created_at=gte.${since}`),
      count(`leads?owner_id=eq.${owner}&created_at=gte.${since}&tags=ov.{order,booking,callback}`),
    ]);
    // A week with nothing at all is not worth a message (a card nobody has shared yet).
    if (!views && !taps && !enquiries) { quiet++; continue; }
    const hindi = c.data?.language !== "en";
    const biz = c.company || c.name || c.username;
    const link = `${SITE_URL}/c/${c.username}`;
    const body = hindi
      ? `${views} लोगों ने देखा · ${taps} ने WhatsApp/कॉल किया · ${enquiries} पूछताछ · ${orders} ऑर्डर/बुकिंग`
      : `${views} people saw it · ${taps} tapped WhatsApp/call · ${enquiries} enquiries · ${orders} orders/bookings`;
    const tip = hindi
      ? (views < 20 ? "\n\n💡 लिंक अपने WhatsApp स्टेटस और ग्रुप में डालें — हर हफ़्ते नए ग्राहक आएँगे।" : enquiries && !orders ? "\n\n💡 पूछताछ आई पर ऑर्डर नहीं — CRM में फ़ॉलो-अप करें, एक टैप में मैसेज तैयार है।" : "")
      : (views < 20 ? "\n\n💡 Put the link on your WhatsApp status and in groups — new customers every week." : enquiries && !orders ? "\n\n💡 Enquiries but no orders yet — follow up from the CRM, the message is ready in one tap." : "");
    const whatsappText = hindi
      ? `📊 *${biz} — इस हफ़्ते की रिपोर्ट*\n\n👀 ${views} लोगों ने वेबसाइट देखी\n💬 ${taps} ने WhatsApp / कॉल बटन दबाया\n📥 ${enquiries} पूछताछ\n🛒 ${orders} ऑर्डर / बुकिंग AI सेल्समैन ने लिए\n\n${link}${tip}\n\n— Shubhora`
      : `📊 *${biz} — this week's report*\n\n👀 ${views} people saw the website\n💬 ${taps} tapped WhatsApp / call\n📥 ${enquiries} enquiries\n🛒 ${orders} orders / bookings taken by the AI salesman\n\n${link}${tip}\n\n— Shubhora`;
    const res = await notify(owner, "weekly_report", { title: hindi ? `📊 ${biz} — इस हफ़्ते` : `📊 ${biz} — this week`, body, path: "/leads", ref: `week:${week}`, whatsappText });
    if (res.push?.ok || res.whatsapp?.ok) sent++;
  }
  return NextResponse.json({ ok: true, owners: byOwner.size, sent, quiet });
}
