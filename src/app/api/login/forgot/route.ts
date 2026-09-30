// Forgot password: POST { id } — username, mobile number or email. If the account has a real inbox, Supabase mails
// a reset link (it opens /auth/reset). The answer is the same whether or not the account exists, so nothing can be
// probed; mobile-only accounts have no inbox and are told to message support.
import { NextResponse } from "next/server";
import { SUPA_URL } from "@/lib/admin-guard";
import { clientIp } from "@/lib/api-security";
import { restAsService } from "@/lib/poster-server";
import { SITE_URL } from "@/lib/site-url";

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const recent = new Map<string, number>();

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = String(b.id ?? "").trim().slice(0, 120);
  if (!id) return NextResponse.json({ error: "Enter your username, mobile number or email." }, { status: 400 });
  const ip = clientIp(request); // the last X-Forwarded-For entry — the first one is whatever the visitor typed
  const last = recent.get(ip) ?? 0;
  if (Date.now() - last < 20_000) return NextResponse.json({ ok: true, throttled: true });
  recent.set(ip, Date.now());
  if (recent.size > 5000) recent.clear();

  let email = "";
  const r = await restAsService<string>("rpc/auth_email_for", { method: "POST", body: JSON.stringify({ p: id }) });
  if (r.ok && typeof r.data === "string") email = r.data.toLowerCase();
  if (!email && id.includes("@")) email = id.toLowerCase();
  const inbox = !!email && !/@phone\./.test(email);
  if (inbox) {
    await fetch(`${SUPA_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(`${SITE_URL}/auth/reset`)}`, {
      method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ email, gotrue_meta_security: {} }), cache: "no-store",
    }).catch(() => undefined);
  }
  // `mobileOnly` is only ever true for an account that exists without an inbox — the person typing it already knows that.
  return NextResponse.json({ ok: true, mobileOnly: !!email && !inbox });
}
