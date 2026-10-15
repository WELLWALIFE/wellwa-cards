import "server-only";
// Who may use the ADVANCED website (the Rs 5,999 segment, owner 15-16 Oct 2026). Two gates, both server side:
//   1. the flag - ADVANCED_SITE_OPEN=1 in the server's .env.local opens it for everybody (the owner's testing, a launch
//      offer). While it is off nobody is charged for something half-built (owner's rule), and nobody is let in either;
//   2. the entitlement - the account's auth APP metadata `advanced_site.paid` is true (set by the payment route once the
//      Rs 5,999 is received). It must be app_metadata, never user_metadata: a signed-in user can write their own
//      user_metadata from the browser (supabase.auth.updateUser), so a paid flag there could be faked for free.
//
// ENV FLAGS (server .env.local; both default to off):
//   ADVANCED_SITE_OPEN=1  reviewers use the advanced website for free, no payment needed. Payment is not asked.
//   ADVANCED_SITE_SELL=1  the Rs 5,999 order may be created (/api/poster/pay/advanced POST). Without it the route answers
//                         503 advanced_closed, so nobody can pay for a half-built product. The owner flips this only
//                         after reviewing the feature. Verifying an already-made payment is never blocked by it.
// Written first by the engine task because the redesign route has to import it; the payment task may extend it
// (an expiry date, an admin grant) but must keep this signature.
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

export const ADVANCED_PRICE_RUPEES = 5999;
export const ADVANCED_PRICE_PAISE = ADVANCED_PRICE_RUPEES * 100;
/** Redesign tries a paying customer starts with (owner: not unlimited, each try costs AI). */
export const ADVANCED_TRIES = 3;

export type AdvancedMeta = { paid?: boolean; paymentId?: string; at?: string; triesLeft?: number };

export type AdvancedAccess = { allowed: boolean; reason?: "flag" | "unpaid" };

export async function isAdvancedAllowed(userId: string): Promise<AdvancedAccess> {
  if (process.env.ADVANCED_SITE_OPEN === "1") return { allowed: true };
  const m = await readAdvancedMeta(userId);
  if (m?.paid === true) return { allowed: true };
  return { allowed: false, reason: "unpaid" };
}

/** The account's advanced_site metadata; null when the account has none; undefined when the lookup itself failed
 *  (access checks treat both as "not paid", but the payment route must not grant again on a failed lookup). */
export async function readAdvancedMeta(userId: string): Promise<AdvancedMeta | null | undefined> {
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(), cache: "no-store" });
    if (!r.ok) return undefined;
    const u = await r.json() as { app_metadata?: { advanced_site?: AdvancedMeta } };
    return u.app_metadata?.advanced_site ?? null;
  } catch { return undefined; }
}

/** Marks the account paid. The admin PUT merges top-level app_metadata keys, so other keys (provider...) are left alone. */
export async function grantAdvanced(userId: string, paymentId: string): Promise<boolean> {
  const advanced_site: AdvancedMeta = { paid: true, paymentId, at: new Date().toISOString(), triesLeft: ADVANCED_TRIES };
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ app_metadata: { advanced_site } }) });
    return r.ok;
  } catch { return false; }
}

/** Tries a paying account has left; null when no limit applies (reviewers let in free, an admin grant without a count).
 *  The payment route has always told the phone `triesLeft`, but nothing took one off: the "3 layouts per payment" rule lived only in
 *  the phone's storage, so a cleared browser or a second phone meant unlimited AI runs (review, 16 Oct 2026). */
export async function advancedTriesLeft(userId: string): Promise<number | null> {
  if (process.env.ADVANCED_SITE_OPEN === "1") return null;
  const m = await readAdvancedMeta(userId);
  return m?.paid === true && typeof m.triesLeft === "number" ? Math.max(0, m.triesLeft) : null;
}

/** One finished design is one try (a failed job costs nothing). The admin PUT replaces the whole `advanced_site` key, so the rest of it is sent back. */
export async function spendAdvancedTry(userId: string): Promise<void> {
  if (process.env.ADVANCED_SITE_OPEN === "1") return;
  const m = await readAdvancedMeta(userId);
  if (m?.paid !== true || typeof m.triesLeft !== "number") return;
  const advanced_site: AdvancedMeta = { ...m, triesLeft: Math.max(0, m.triesLeft - 1) };
  try { await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, { method: "PUT", headers: serviceHeaders(), body: JSON.stringify({ app_metadata: { advanced_site } }) }); } catch { /* the design is made; a missed count is the lesser harm */ }
}
