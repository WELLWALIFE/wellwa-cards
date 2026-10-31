import "server-only";
// The waiting time's server side (src/lib/site-ready.ts): who is let off it. A demo account (Super Admin → Users → Demo,
// user_metadata.is_demo) shows its website at once — a demo cannot wait a day (owner, 31 Oct 2026).
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";
export { readyIn, sitePending, advancedPending } from "@/lib/site-ready";

export async function isDemoAccount(userId: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
    if (!r.ok) return false;
    const u = (await r.json()) as { user_metadata?: { is_demo?: unknown } };
    return u.user_metadata?.is_demo === true;
  } catch { return false; }
}
