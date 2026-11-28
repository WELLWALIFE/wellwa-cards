import "server-only";
// Until when an account may use one single service (src/lib/single-services.ts; migration 0101). Every gate that a single service opens
// asks here: a running Growth / Pro / card plan (ownerPlanExpiry) covers every service; otherwise the service's own paid end plus
// its 7 grace days. Read with the service role, in its own request — a database without 0101 (or any read error) simply has no
// single services, and the plan check stays exactly as before.
import { restAsService } from "@/lib/poster-server";
import { ownerPlanExpiry } from "@/lib/crm-server";
import { SERVICE_GRACE_DAYS, SERVICE_KEYS, serviceColumn, type ServiceKey } from "@/lib/single-services";

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; until: Partial<Record<ServiceKey, string>> }>();

/** The paid end of each single service this account holds (no grace added). {} when none or unreadable. */
export async function serviceDates(ownerId: string): Promise<Partial<Record<ServiceKey, string>>> {
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return {};
  const hit = cache.get(ownerId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.until;
  const until: Partial<Record<ServiceKey, string>> = {};
  try {
    const r = await restAsService<Record<string, string | null>[]>(`profiles?id=eq.${ownerId}&select=${SERVICE_KEYS.map(serviceColumn).join(",")}`);
    const row = r.ok && Array.isArray(r.data) ? r.data[0] : null;
    for (const k of SERVICE_KEYS) { const v = row?.[serviceColumn(k)]; if (v) until[k] = v; }
  } catch { /* no single services */ }
  cache.set(ownerId, { at: Date.now(), until });
  return until;
}

/** A service's paid end plus grace, as an ISO date, when it is still running; else null. */
export function runningUntil(paidEnd: string | undefined | null): string | null {
  if (!paidEnd) return null;
  const t = Date.parse(paidEnd);
  if (!Number.isFinite(t)) return null;
  const end = t + SERVICE_GRACE_DAYS * 86400_000;
  return end > Date.now() ? new Date(end).toISOString() : null;
}

/** Until when this account may use the service: the plan's end when a plan runs, else the service's own (with grace); null = not. */
export async function serviceExpiry(ownerId: string, key: ServiceKey): Promise<string | null> {
  const plan = await ownerPlanExpiry(ownerId).catch(() => null);
  if (plan) return plan;
  return runningUntil((await serviceDates(ownerId))[key]);
}

/** Which single services run on this account right now (not counting a plan) — for the plan page and the admin panel. */
export async function runningServices(ownerId: string): Promise<Partial<Record<ServiceKey, string>>> {
  const d = await serviceDates(ownerId);
  const out: Partial<Record<ServiceKey, string>> = {};
  for (const k of SERVICE_KEYS) { const u = runningUntil(d[k]); if (u) out[k] = u; }
  return out;
}

/** Forget the cached dates (right after a payment applies a service). */
export const forgetServiceDates = (ownerId: string) => cache.delete(ownerId);
