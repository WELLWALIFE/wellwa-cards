// POST (bearer) { return_to?, client_id?, client_secret? } → { url } to start Google Business Profile OAuth.
// Optional client_id/secret = the user's own Google Cloud OAuth client ("advanced"); otherwise the platform client.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { signState } from "@/lib/social-server";
import { googleCreds, googleAuthUrl, googleRow } from "@/lib/google-server";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const cid = typeof b.client_id === "string" ? b.client_id.trim().slice(0, 200) : "", csec = typeof b.client_secret === "string" ? b.client_secret.trim().slice(0, 200) : "";
  if (cid || csec) {
    if (!/\.apps\.googleusercontent\.com$/.test(cid) || !csec) return NextResponse.json({ error: "Client ID must end with .apps.googleusercontent.com and the secret is required." }, { status: 400 });
    const existing = await googleRow(me.id);
    const r = existing ? await restAsService(`google_accounts?user_id=eq.${me.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ client_id: cid, client_secret: csec }) })
      : await restAsService("google_accounts", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: me.id, client_id: cid, client_secret: csec, status: "reconnect" }) });
    if (!r.ok) return NextResponse.json({ error: r.text.slice(0, 200) || "Could not save client (run migration 0040?)." }, { status: 502 });
  }
  const creds = await googleCreds(me.id);
  if (creds.source === "none") return NextResponse.json({ error: "Google Business setup pending — the platform's Google OAuth client is not configured yet.", configured: false }, { status: 503 });
  const returnTo = typeof b.return_to === "string" && /^\/[a-zA-Z0-9/_?=&-]*$/.test(b.return_to) ? b.return_to : "/poster/social?tab=google";
  return NextResponse.json({ url: googleAuthUrl(creds, signState(me.id, returnTo, "google")) });
}
