import { NextResponse } from "next/server";
import { getNotificationSettings, isNotificationType, notify } from "@/lib/notify";

// Server-to-server: the background jobs (poster, CRM reminders) send notifications through here,
// and read the admin switches before sending their own WhatsApp/app messages. Needs the cron key.
const ok = (r: Request) => !!process.env.CRON_KEY && r.headers.get("x-cron-key") === process.env.CRON_KEY;

export async function GET(request: Request) {
  if (!ok(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getNotificationSettings(true));
}

export async function POST(request: Request) {
  if (!ok(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/.test(String(b.userId ?? "")) || !isNotificationType(String(b.type ?? "")) || !b.title) {
    return NextResponse.json({ error: "userId, type and title are required" }, { status: 400 });
  }
  const result = await notify(b.userId, b.type, { title: String(b.title), body: String(b.body ?? ""), path: b.path, ref: b.ref, whatsappText: b.whatsappText, channels: b.channels });
  return NextResponse.json({ ok: true, result });
}
