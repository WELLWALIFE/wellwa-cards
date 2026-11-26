// Remind every customer with udhaar on WhatsApp, in one tap (Bills → Udhaar → Remind all): one message per customer with all
// the bills they owe on and their links (each link has the UPI QR). A customer reminded in the last 3 days is skipped, so a
// second tap does not send twice. When the shop's WhatsApp is not linked, the wa.me links come back to send by hand.
import { NextResponse } from "next/server";
import { msCtx, msDenied, msHas, sendReminders } from "@/lib/mobile-server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { as?: string } | null;
  const c = await msCtx(request, b?.as ?? null);
  if (!c.ok) return c.res;
  if (!msHas(c.access, "reports")) return msDenied("remind customers of udhaar");
  const r = await sendReminders(c.scope, c.setup, { minDays: 3, max: 60 });
  return NextResponse.json(r);
}
