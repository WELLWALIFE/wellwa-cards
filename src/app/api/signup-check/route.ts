// Sign-up form: is this mobile / email already registered? GET ?mobile=9876543210&email=a@b.com
//   → { mobile?: boolean, email?: boolean }   (a field left out = not checked, e.g. the database function is missing)
// Only yes / no — never whose account it is. Rate-limited per IP so it cannot be used to sweep numbers.
import { NextResponse } from "next/server";
import { clientKey, rateLimited } from "@/lib/api-security";
import { SUPA_URL, serviceHeaders, serviceConfigured } from "@/lib/admin-guard";

export async function GET(request: Request) {
  if (rateLimited(clientKey(request, "signup-check"), 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many checks — wait a few minutes." }, { status: 429 });
  }
  const q = new URL(request.url).searchParams;
  const mobile = String(q.get("mobile") ?? "").replace(/\D/g, "").slice(-10);
  const email = String(q.get("email") ?? "").trim().toLowerCase().slice(0, 160);
  const wantMobile = /^[6-9]\d{9}$/.test(mobile);
  const wantEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!serviceConfigured() || (!wantMobile && !wantEmail)) return NextResponse.json({});
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/signup_taken`, {
      method: "POST", headers: serviceHeaders(), cache: "no-store",
      body: JSON.stringify({ p_mobile: wantMobile ? mobile : "", p_email: wantEmail ? email : "" }),
    });
    if (!r.ok) return NextResponse.json({});   // SQL 0059 not run yet: the form still works, just without the check
    const d = (await r.json()) as { mobile?: boolean; email?: boolean };
    return NextResponse.json({ ...(wantMobile ? { mobile: !!d.mobile } : {}), ...(wantEmail ? { email: !!d.email } : {}) });
  } catch {
    return NextResponse.json({});
  }
}
