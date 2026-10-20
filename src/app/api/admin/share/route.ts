// Admin → Live help: everyone who tapped "Admin" in Help and is inside their 15 minutes (GET), and a nudge to a paused one to share again (POST).
import { adminAllowedFor } from "@/lib/admin-guard";
import { adminShares, findShare, knock, viewerCount } from "@/lib/live-share";

const none = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!(await adminAllowedFor(request, "support"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  return Response.json({
    requests: adminShares().map((s) => ({ token: s.token, name: s.who?.name ?? "", phone: s.who?.phone ?? "", since: s.at, expiresAt: s.expiresAt, state: s.paused ? "paused" : "live", why: s.paused, viewers: viewerCount(s), idleMs: now - s.lastBeat })),
  }, { headers: none });
}
export async function POST(request: Request) {
  if (!(await adminAllowedFor(request, "support"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { token?: string; action?: string };
  const s = findShare(typeof b.token === "string" ? b.token : "");
  if (!s || s.kind !== "admin") return Response.json({ error: "gone" }, { status: 404 });
  if (b.action === "knock") return Response.json({ ok: true, asked: knock(s) }, { headers: none });
  return Response.json({ error: "unknown" }, { status: 400 });
}
