import { NextResponse } from "next/server";
import { requireUser, sameOrigin } from "@/lib/api-security";
import { SUPA_URL, serviceConfigured, serviceHeaders } from "@/lib/admin-guard";

// Save (POST) or remove (DELETE) this browser's push subscription for the signed-in user.
type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const b = (await request.json().catch(() => ({}))) as { subscription?: Sub };
  const s = b.subscription;
  if (!s?.endpoint?.startsWith("https://") || !s.keys?.p256dh || !s.keys?.auth || s.endpoint.length > 1000) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  const r = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: "POST", headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ endpoint: s.endpoint, user_id: session.user.id, p256dh: s.keys.p256dh, auth: s.keys.auth,
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300), last_seen: new Date().toISOString() }),
  });
  if (!r.ok) return NextResponse.json({ error: "could not save" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!b.endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(b.endpoint)}&user_id=eq.${session.user.id}`, {
    method: "DELETE", headers: serviceHeaders(),
  });
  return NextResponse.json({ ok: true });
}
