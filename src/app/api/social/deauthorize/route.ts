// Meta "Deauthorize callback URL" (Facebook Login → Settings). Meta POSTs a signed_request when a user removes
// Shubhora under Facebook → Settings → Apps and websites. Every token from that login is dead from that moment, so
// the connected rows are marked "reconnect" and auto-post is switched off (src/lib/social-server.ts).
import { NextResponse } from "next/server";
import { parseSignedRequest, deauthorizeMetaUser, SITE_URL } from "@/lib/social-server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const ct = request.headers.get("content-type") ?? "";
  let sr = "";
  if (ct.includes("application/json")) { const j = await request.json().catch(() => ({})); sr = String(j?.signed_request ?? ""); }
  else { const f = await request.formData().catch(() => null); sr = String(f?.get("signed_request") ?? ""); }
  const p = parseSignedRequest(sr);
  if (!p) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });
  const n = await deauthorizeMetaUser(p.user_id).catch((e) => { console.error("[social/deauthorize]", e); return 0; });
  return NextResponse.json({ ok: true, accounts: n });
}

export async function GET() {
  return NextResponse.redirect(`${SITE_URL}/data-deletion`, 302);
}
