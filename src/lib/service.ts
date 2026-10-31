// The service-role Supabase caller (server only — never expose). admin-guard.ts re-exports these; new code imports from here
// so the guard can itself import src/lib/admin-v2.ts without a cycle.
export const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
export function serviceConfigured() {
  return Boolean(SUPA_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
/** One REST call with the service role: { ok, status, data (parsed JSON or null), text }. */
export async function svc<T = unknown>(pathAndQuery: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; text: string; count: number | null }> {
  const r = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...serviceHeaders(), ...(init?.headers ?? {}) }, cache: "no-store" });
  const text = await r.text();
  let data: T | null = null;
  try { data = text ? (JSON.parse(text) as T) : null; } catch { data = null; }
  const cr = r.headers.get("content-range");              // "0-9/123" with Prefer: count=exact
  const count = cr && /\/(\d+)$/.test(cr) ? Number(cr.match(/\/(\d+)$/)![1]) : null;
  return { ok: r.ok, status: r.status, data, text, count };
}
/** How many rows match (no rows fetched). */
export async function svcCount(pathAndQuery: string): Promise<number> {
  const r = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, { method: "HEAD", headers: { ...serviceHeaders(), Prefer: "count=exact" }, cache: "no-store" });
  const cr = r.headers.get("content-range") ?? "";
  const m = cr.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}
