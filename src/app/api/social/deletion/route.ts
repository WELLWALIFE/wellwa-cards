// Meta "Data deletion callback URL" (App settings → Basic → User data deletion). Meta POSTs a signed_request when a
// Facebook user asks Meta to delete the data Shubhora got from them; we delete it (src/lib/social-server.ts →
// deleteMetaUserData) and answer with a status URL + confirmation code, exactly the shape Meta expects.
import { NextResponse } from "next/server";
import { parseSignedRequest, deleteMetaUserData, SITE_URL } from "@/lib/social-server";

export const maxDuration = 30;

async function signedRequestFrom(request: Request): Promise<string> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) { const j = await request.json().catch(() => ({})); return String(j?.signed_request ?? ""); }
  const f = await request.formData().catch(() => null);
  return String(f?.get("signed_request") ?? "");
}

export async function POST(request: Request) {
  const sr = await signedRequestFrom(request);
  const p = parseSignedRequest(sr);
  if (!p) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });
  try {
    const { code } = await deleteMetaUserData(p.user_id);
    return NextResponse.json({ url: `${SITE_URL}/data-deletion?code=${encodeURIComponent(code)}`, confirmation_code: code });
  } catch (e) {
    console.error("[social/deletion]", e);
    return NextResponse.json({ error: "deletion failed" }, { status: 500 });
  }
}

// A browser (or Meta's URL check) opening it: point at the human page.
export async function GET() {
  return NextResponse.redirect(`${SITE_URL}/data-deletion`, 302);
}
