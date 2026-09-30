// Super Admin: the platform's Google OAuth client (stored in platform_secrets, never public).
// GET → { client_id, has_secret, redirect_uri, connected_users }. PUT { client_id, client_secret? }.
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";
import { GOOGLE_REDIRECT } from "@/lib/google-server";

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = (await restAsService<{ google_client_id: string; google_client_secret: string }[]>("platform_secrets?id=eq.1&select=google_client_id,google_client_secret")).data?.[0];
  const users = (await restAsService<{ user_id: string; location_title: string; status: string; connected_at: string }[]>("google_accounts?refresh_token=neq.&select=user_id,location_title,status,connected_at&order=connected_at.desc&limit=50")).data;
  return NextResponse.json({ client_id: p?.google_client_id ?? "", has_secret: !!p?.google_client_secret, env_fallback: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), redirect_uri: GOOGLE_REDIRECT, connected_users: Array.isArray(users) ? users : [], table_ok: Array.isArray((await restAsService("platform_secrets?select=id")).data) });
}
export async function PUT(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const cid = String(b.client_id ?? "").trim().slice(0, 200);
  if (cid && !/\.apps\.googleusercontent\.com$/.test(cid)) return NextResponse.json({ error: "Client ID must end with .apps.googleusercontent.com" }, { status: 400 });
  const patch: Record<string, string> = { google_client_id: cid, updated_at: new Date().toISOString() };
  if (typeof b.client_secret === "string" && b.client_secret.trim()) patch.google_client_secret = b.client_secret.trim().slice(0, 200);
  if (!cid) patch.google_client_secret = "";
  const r = await restAsService("platform_secrets?id=eq.1", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save (run migration 0040?)." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
