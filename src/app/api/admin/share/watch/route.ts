// GET ?token&after&epoch&v — the admin's long poll on one help request: the same relay the share link uses, so it is as quick as the link is.
import { adminAllowedFor } from "@/lib/admin-guard";
import { findShare, watch } from "@/lib/live-share";

const none = { "Cache-Control": "no-store, no-transform" };
export async function GET(request: Request) {
  if (!(await adminAllowedFor(request, "support"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const u = new URL(request.url);
  const s = findShare(u.searchParams.get("token") ?? "");
  if (!s || s.kind !== "admin") return Response.json({ status: "notfound" }, { status: 404, headers: none });
  const vid = `a${(u.searchParams.get("v") ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 20) || "dmin"}`;
  const after = Math.max(0, Number(u.searchParams.get("after")) || 0), epoch = Number(u.searchParams.get("epoch")) || 0;
  return Response.json(await watch(s, vid, after, epoch, u.searchParams.get("ask") === "1" ? 0 : 20_000, u.searchParams.get("ask") === "1"), { headers: none });
}
