// One login for both admins: the Shubhora Super Admin → the partner (MLM) admin, without its password.
// Answers a 60-second, single-use pass signed with the shared link secret; the panel's /auth/admin-link swaps it
// for an admin session (mirror of the panel's /admin/shubhora, which sends the owner the other way).
import crypto from "node:crypto";
import { adminAllowed, SUPA_URL } from "@/lib/admin-guard";
import { isOwnerEmail } from "@/lib/owner-emails";

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const secret = process.env.LINK_SECRET ?? "";
  if (!secret) return Response.json({ error: "partner panel not linked" }, { status: 503 });
  // Who: the owner e-mail when the panel opened on the owner's app login; "owner" for the password / handoff gate.
  let sub = "owner";
  const tok = request.headers.get("x-owner-token") ?? "";
  if (tok && SUPA_URL) {
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${tok}` }, cache: "no-store" });
      const u = r.ok ? await r.json() : null;
      if (isOwnerEmail(u?.email)) sub = String(u.email).trim().toLowerCase();
    } catch { /* password gate */ }
  }
  const body = Buffer.from(JSON.stringify({ sub, typ: "panel-admin", exp: Math.floor(Date.now() / 1000) + 60, n: crypto.randomBytes(6).toString("hex") })).toString("base64url");
  const t = `v1.${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`;
  const base = (process.env.PARTNER_PUBLIC_URL || "/partners").replace(/\/$/, "");
  return Response.json({ url: `${base}/auth/admin-link?t=${encodeURIComponent(t)}` });
}
