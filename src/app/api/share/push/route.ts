// POST { token, secret, events?, end? } — the sender's app pushes its screen (or ends the link). Only the holder of the push secret can write; a viewer
// has no way to (lib/live-share.ts). Same-origin only; the batch size is capped.
import { NextResponse } from "next/server";
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { findShare, pushEvents, secretOk, setControl, stopShare, takeCmds } from "@/lib/live-share";

const none = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(clientKey(request, "share-push"), 600, 60_000)) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const text = await request.text();
  if (text.length > 900_000) return NextResponse.json({ error: "too big" }, { status: 413 });
  let b: { token?: string; secret?: string; events?: unknown[]; end?: boolean; control?: boolean } | null = null;
  try { b = JSON.parse(text); } catch { /* below */ }
  const s = b && typeof b.token === "string" ? findShare(b.token) : null;
  // The same answer for "no such link" and "wrong secret": nothing to learn by trying.
  if (!s || !secretOk(s, b?.secret)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: none });
  if (b?.end) { stopShare(s); return NextResponse.json({ ok: true, paused: "stopped" }, { headers: none }); }
  // The sender says, with every push, whether helpers may tap (lib/live-share.ts); what they asked for comes back to be done.
  if (typeof b?.control === "boolean") setControl(s, b.control);
  const r = pushEvents(s, Array.isArray(b?.events) ? b!.events! : []);
  return NextResponse.json({ ok: true, ...r, cmds: takeCmds(s) }, { headers: none });
}
