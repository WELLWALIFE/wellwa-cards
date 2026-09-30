// Push-token registry for the Shubhora app (Android, FCM).
// POST   { token, platform?, lang? } → upsert my device row
// DELETE { token }                   → forget this device (logout / opt-out)
//
// The upsert runs with the service role on purpose: the same phone can log
// in as a different user, and RLS would refuse to re-point a row that the
// previous owner still "owns". Identity is still the verified bearer token.
import { NextResponse } from "next/server";
import { userFromRequest, restAsUser, restAsService } from "@/lib/poster-server";

const PLATFORMS = new Set(["android", "ios", "web"]);
const LANGS = new Set(["hi", "en", "hinglish"]);

function cleanToken(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length >= 20 && t.length <= 4096 && /^[A-Za-z0-9_:\-.]+$/.test(t) ? t : null;
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const token = cleanToken(b.token);
  if (!token) return NextResponse.json({ error: "Bad token." }, { status: 400 });
  const row = {
    token,
    user_id: me.id,
    platform: PLATFORMS.has(b.platform) ? b.platform : "android",
    lang: LANGS.has(b.lang) ? b.lang : "hi",
    last_seen: new Date().toISOString(),
  };
  const r = await restAsService("poster_devices?on_conflict=token", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!r.ok) return NextResponse.json({ error: "Could not save the device.", detail: r.text.slice(0, 200) }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const token = cleanToken(b.token);
  if (!token) return NextResponse.json({ error: "Bad token." }, { status: 400 });
  // RLS: only my own row can go.
  await restAsUser(me.token, `poster_devices?token=eq.${encodeURIComponent(token)}&user_id=eq.${me.id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}
