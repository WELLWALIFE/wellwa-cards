// A failed try at the admin login (owner, 6 Nov 2026: "login aur pura track record"). Public: the login page posts here when the
// password or the 2-step code is wrong. Recorded only for a login that belongs to an admin / franchise (no junk rows), rate-limited per IP.
//   POST { login, reason } → { ok }
import { loginAddress } from "@/lib/admin-v2";
import { svc } from "@/lib/service";
import { clientIp, rateLimited, sameOrigin } from "@/lib/api-security";

const REASONS: Record<string, string> = { password: "wrong password", mfa: "wrong 2-step code", rate: "too many tries" };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const ip = clientIp(request).slice(0, 60);
  if (rateLimited(`login-event:${ip}`, 20, 10 * 60_000)) return Response.json({ ok: false }, { status: 429 });
  const b = (await request.json().catch(() => ({}))) as { login?: unknown; reason?: unknown };
  const email = loginAddress(String(b.login ?? "").slice(0, 120));
  if (!email) return Response.json({ ok: true });
  const row = (await svc<{ id: string; franchise_id: string | null }[]>(`admin_users?email=eq.${encodeURIComponent(email)}&select=id,franchise_id&limit=1`)).data?.[0];
  if (!row) return Response.json({ ok: true });
  await svc("admin_login_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
    admin_id: row.id, login: email, franchise_id: row.franchise_id, ok: false, reason: REASONS[String(b.reason)] ?? "failed",
    ip, ua: (request.headers.get("user-agent") ?? "").slice(0, 160),
  }) }).catch(() => null);
  return Response.json({ ok: true });
}
