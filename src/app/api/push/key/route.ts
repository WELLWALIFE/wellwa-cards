import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/notify";

// Public half of the web-push key; the browser needs it to subscribe.
export async function GET() {
  return NextResponse.json({ key: vapidPublicKey() || null });
}
