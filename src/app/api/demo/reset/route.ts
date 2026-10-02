// POST (bearer) → the DEMO account wipes itself back to fresh (owner's call, 2 Oct 2026: "demo dikhane ke baad
// clear dabao, ek dum fresh"). Only an account Super Admin marked as demo (user_metadata.is_demo) may do this;
// everyone else gets 403. Same wipe as Super Admin's "Clear all data"; the login, username, partner ID, plan and
// credits stay, so the next demo starts at the congratulations page with the same login.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { serviceConfigured, serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { rateLimited } from "@/lib/api-security";
import { wipeMemberData } from "@/lib/member-wipe";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "service key missing" }, { status: 400 });
  if (rateLimited(`demo-reset:${me.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "Too many resets. Please wait." }, { status: 429 });
  const h = serviceHeaders();
  const ur = await fetch(`${SUPA_URL}/auth/v1/admin/users/${me.id}`, { headers: h, cache: "no-store" });
  if (!ur.ok) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const u = (await ur.json()) as { user_metadata?: Record<string, unknown> };
  if (u.user_metadata?.is_demo !== true) return NextResponse.json({ error: "Not a demo account." }, { status: 403 });
  const { ok, cleared } = await wipeMemberData(me.id, h, u.user_metadata);
  return NextResponse.json({ ok, cleared }, { status: ok ? 200 : 207 });
}
