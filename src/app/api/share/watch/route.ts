// GET ?token&after&epoch&v — what a viewer has not seen yet (long poll). The link is the only key, and it only ever lets a viewer READ.
import { NextResponse } from "next/server";
import { clientKey, rateLimited } from "@/lib/api-security";
import { findShare, watch } from "@/lib/live-share";

const none = { "Cache-Control": "no-store, no-transform", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  const u = new URL(request.url);
  if (rateLimited(clientKey(request, "share-watch"), 240, 60_000)) return NextResponse.json({ error: "slow down" }, { status: 429, headers: none });
  const s = findShare(u.searchParams.get("token") ?? "");
  if (!s) return NextResponse.json({ status: "notfound" }, { status: 404, headers: none });
  const vid = (u.searchParams.get("v") ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 24) || "anon";
  const after = Math.max(0, Number(u.searchParams.get("after")) || 0), epoch = Number(u.searchParams.get("epoch")) || 0;
  const r = await watch(s, vid, after, epoch, u.searchParams.get("ask") === "1" ? 0 : 20_000, u.searchParams.get("ask") === "1");
  return NextResponse.json(r, { headers: none });
}
