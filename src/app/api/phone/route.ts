// The owner's phone receptionist (bearer): GET → { line, calls } — their assigned number (if any) and the last calls.
import { NextResponse } from "next/server";
import { restAsUser, userFromRequest } from "@/lib/poster-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [lines, calls] = await Promise.all([
    restAsUser<{ number: string; provider: string; label: string; active: boolean }[]>(me.token, `phone_lines?owner_id=eq.${me.id}&select=number,provider,label,active&limit=3`),
    restAsUser<Record<string, unknown>[]>(me.token, `phone_calls?owner_id=eq.${me.id}&select=id,caller,started_at,seconds,summary,intent,lead_id,booking_id,transcript&order=started_at.desc&limit=60`),
  ]);
  if (!lines.ok && /relation|does not exist/i.test(lines.text)) return NextResponse.json({ line: null, calls: [], ready: false });
  return NextResponse.json({ line: lines.data?.[0] ?? null, calls: calls.data ?? [], ready: true });
}
