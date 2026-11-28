// Single services for the bridge's own jobs (CRM reminders, the 4 AM auto-post, Google replies) — the same rule as
// src/lib/single-services-server.ts: a service bought alone runs until its paid end (profiles.svc_<key>_until, migration 0101) plus
// the Growth Plan's 7 grace days. Read in its own request; a database without 0101 (or any error) means "no single service", so
// every job keeps exactly its old plan check. Plain JS: the bridge is not compiled.

export const SERVICE_GRACE_MS = 7 * 24 * 3600_000;

/** Is this single service running for the user? `rest(path)` → parsed JSON rows, or null/undefined on error (each job has its own). */
export async function serviceRunning(rest, userId, key, now = Date.now()) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId || "")) || !/^(wa_ai|crm|posters|google)$/.test(key)) return false;
  try {
    const rows = await rest(`profiles?id=eq.${userId}&select=svc_${key}_until`);
    const v = Array.isArray(rows) ? rows[0]?.[`svc_${key}_until`] : null;
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) && t + SERVICE_GRACE_MS > now;
  } catch { return false; }
}

/** The same as an ISO date the bridge manager accepts as a plan expiry (paid end + grace), or null. */
export async function serviceUntil(rest, userId, key, now = Date.now()) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId || "")) || !/^(wa_ai|crm|posters|google)$/.test(key)) return null;
  try {
    const rows = await rest(`profiles?id=eq.${userId}&select=svc_${key}_until`);
    const v = Array.isArray(rows) ? rows[0]?.[`svc_${key}_until`] : null;
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) && t + SERVICE_GRACE_MS > now ? new Date(t + SERVICE_GRACE_MS).toISOString() : null;
  } catch { return null; }
}
