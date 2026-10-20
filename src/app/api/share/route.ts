// POST (login required) { kind?: "admin" } → a new Share Screen link for this account: { token, secret, url, expiresAt }. The secret is what lets THIS
// app push its screen; it is shown to the sender's browser and is never part of the link (lib/live-share.ts). kind "admin" is the same link, listed in
// the admin console as a request for help, so the admin sees it at once.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited, sameOrigin } from "@/lib/api-security";
import { createShare } from "@/lib/live-share";
import { SITE_URL } from "@/lib/site-url";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`share-create:${me.id}`, 12, 60 * 60_000)) return NextResponse.json({ error: "Too many links made. Please wait a little." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "admin" ? "admin" : "link";
  let who: { name: string; phone: string } | null = null;
  if (kind === "admin") {
    // The admin console shows who is asking (name and number from their own account), never anything from the screen.
    const u = await fetch(`${SUPA_URL}/auth/v1/admin/users/${me.id}`, { headers: serviceHeaders(), cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const md = (u?.user_metadata ?? {}) as Record<string, unknown>;
    who = { name: str(md.display_name || md.full_name, 60), phone: str(u?.phone || md.phone, 20) };
  }
  const { token, secret, expiresAt } = createShare(me.id, kind, who);
  return NextResponse.json({ token, secret, expiresAt, url: `${SITE_URL}/watch/${token}` }, { headers: { "Cache-Control": "no-store" } });
}
