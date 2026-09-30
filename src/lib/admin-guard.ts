// Shared guard for the /api/admin/* routes. A call is allowed when it carries
// EITHER the super-admin password (x-admin-key) OR a Supabase access token
// belonging to one of the platform-owner emails (x-owner-token) — the panel
// unlocks both ways, so the APIs must accept both.

import { timingSafeEqual } from "node:crypto";
import { isOwnerEmail } from "./owner-emails";
import { verifyAdminToken } from "./admin-token";

export const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function passwordOk(request: Request): boolean {
  const sent = request.headers.get("x-admin-key") ?? "";
  const expected = process.env.SUPER_ADMIN_PASSWORD ?? "";
  // Constant-time compare: this key opens every /api/admin route (owner's review, 28 Sep 2026).
  if (sent.length > 0 && expected.length > 0 && sent.length === expected.length && timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) return true;
  // Or a session token issued when the owner came in from the associate admin.
  return sent.startsWith("v1.") && verifyAdminToken(sent, "session") !== null;
}

async function ownerTokenOk(request: Request): Promise<boolean> {
  const token = request.headers.get("x-owner-token") ?? "";
  if (!token || !SUPA_URL) return false;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!r.ok) return false;
    const u = await r.json();
    return isOwnerEmail(u?.email);
  } catch {
    return false;
  }
}

/** Synchronous password-only check (kept for simple routes). */
export function adminKeyOk(request: Request): boolean {
  return passwordOk(request);
}

/** Full check — password OR verified owner session. Prefer this. */
export async function adminAllowed(request: Request): Promise<boolean> {
  if (passwordOk(request)) return true;
  return ownerTokenOk(request);
}

/** Service-role Supabase REST/Auth caller (server-side only — never expose). */
export function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function serviceConfigured() {
  return Boolean(SUPA_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
