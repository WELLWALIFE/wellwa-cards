// Super-admin gate: verifies the platform-owner password server-side so it
// never ships in the client bundle. Production fails closed when the secret
// is not configured.

import crypto from "node:crypto";
import { clientKey, rateLimited, sameOrigin } from "@/lib/api-security";
import { signAdminToken, verifyAdminToken } from "@/lib/admin-token";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (rateLimited(clientKey(request, "admin-auth"), 5, 15 * 60_000)) {
    return Response.json({ ok: false }, { status: 429 });
  }
  let body: { password?: string; handoff?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  // Coming from the associate admin: swap the one-time handoff for an 8-hour session key.
  if (typeof body.handoff === "string") {
    const who = verifyAdminToken(body.handoff, "handoff");
    if (!who) return Response.json({ ok: false }, { status: 401 });
    return Response.json({ ok: true, key: signAdminToken(who, "session", 8 * 3600) });
  }
  const expected = process.env.SUPER_ADMIN_PASSWORD ?? "";
  const supplied = typeof body.password === "string" ? body.password : "";
  const ok = expected.length >= 12 && supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!ok) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true });
}
