// The WhatsApp bot (bridge/index.mjs alertOwner, QR WhatsApp) asks for the owner's alert with a sound: a push notification
// and a WhatsApp from the company number (lib/owner-alert.ts). Called only from the same server:
//   POST http://127.0.0.1:3001/api/cron/owner-alert   x-cron-key: $CRON_KEY   { owner, name, phone, alert, inbound }
import { NextResponse } from "next/server";
import { ownerAlert } from "@/lib/owner-alert";

export async function POST(request: Request) {
  if (!process.env.CRON_KEY || request.headers.get("x-cron-key") !== process.env.CRON_KEY) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { owner?: string; name?: string; phone?: string; alert?: string; inbound?: string };
  const owner = String(b.owner ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(owner) || !String(b.alert ?? "").trim()) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const out = await ownerAlert(owner, { name: String(b.name ?? "").slice(0, 80), phone: String(b.phone ?? "").slice(0, 20), alert: String(b.alert).slice(0, 300), inbound: String(b.inbound ?? "").slice(0, 300) });
  return NextResponse.json({ ok: true, out });
}
