// POST { token, cmds } — a helper's taps / words / scroll for the sender's screen. Accepted only while the SENDER allows help by tapping
// (they switch it on or off on their phone) and the screen is being shared; the sender's app does them itself (lib/live-share.ts).
import { NextResponse } from "next/server";
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { addCmds, findShare } from "@/lib/live-share";

const none = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(clientKey(request, "share-control"), 240, 60_000)) return NextResponse.json({ error: "slow down" }, { status: 429, headers: none });
  const b = (await request.json().catch(() => ({}))) as { token?: string; cmds?: unknown[] };
  const s = findShare(typeof b.token === "string" ? b.token : "");
  if (!s) return NextResponse.json({ error: "gone" }, { status: 404, headers: none });
  if (!s.control) return NextResponse.json({ error: "They have not allowed help by tapping." }, { status: 403, headers: none });
  const n = addCmds(s, Array.isArray(b.cmds) ? b.cmds : []);
  return NextResponse.json({ ok: n > 0, queued: n }, { headers: none });
}
