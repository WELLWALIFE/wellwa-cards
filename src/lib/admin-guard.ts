// Shared guard for the /api/admin/* routes. A call is allowed when it carries
// EITHER the super-admin password (x-admin-key) OR a Supabase access token
// belonging to one of the platform-owner emails (x-owner-token) — the panel
// unlocks both ways, so the APIs must accept both.

import { timingSafeEqual } from "node:crypto";
import { isOwnerEmail } from "./owner-emails";
import { verifyAdminToken, type AdminScope } from "./admin-token";

export type { AdminScope };

export const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** What the x-admin-key header grants, and who it says is holding it. */
function keyHolder(request: Request): { scope: AdminScope; sub: string } | null {
  const sent = request.headers.get("x-admin-key") ?? "";
  const expected = process.env.SUPER_ADMIN_PASSWORD ?? "";
  // Constant-time compare: this key opens every /api/admin route (owner's review, 28 Sep 2026).
  if (sent.length > 0 && expected.length > 0 && sent.length === expected.length && timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) return { scope: "all", sub: "owner" };
  // Or a session token issued when someone came in from the associate admin. The owner's opens everything;
  // a Staff Admin member sent over to help a card holder carries scope "support" and opens only Live help.
  if (!sent.startsWith("v1.")) return null;
  return verifyAdminToken(sent, "session");
}

function passwordOk(request: Request): boolean {
  return keyHolder(request)?.scope === "all";
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

/** Full check — password OR verified owner session. Prefer this.
 *  This stays FULL admin: a support-scoped staff session is not allowed through here, so every existing
 *  /api/admin route keeps meaning "the platform owner only". */
export async function adminAllowed(request: Request): Promise<boolean> {
  if (passwordOk(request)) return true;
  return ownerTokenOk(request);
}

/** Who is calling and how much they may do: "all" for the owner, "support" for a Staff Admin member sent
 *  over for Live help, null for nobody. `sub` is the name the staff handoff was minted for — trust that over
 *  anything the browser sends, so a staff member cannot help under someone else's name. */
export async function adminIdentity(request: Request): Promise<{ scope: AdminScope; sub: string } | null> {
  const fromKey = keyHolder(request);
  if (fromKey?.scope === "all") return fromKey;
  if (await ownerTokenOk(request)) return { scope: "all", sub: "owner" };
  return fromKey;                                  // support-scoped, or null
}

export async function adminScope(request: Request): Promise<AdminScope | null> {
  return (await adminIdentity(request))?.scope ?? null;
}

/** A route an owner may use and a support-scoped staff member may use too. */
export async function adminAllowedFor(request: Request, need: AdminScope): Promise<boolean> {
  const have = await adminScope(request);
  return have === "all" || have === need;
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
