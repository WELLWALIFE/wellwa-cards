"use client";
// Headers for the /api/admin/* routes from the Super Admin pages: the unlock password (x-admin-key) and/or the owner's
// own session (x-owner-token) — the same pair src/lib/admin-guard.ts accepts.
import { getBrowserSupabase } from "@/lib/supabase/browser";

export async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* private mode */ }
  try {
    const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* signed out */ }
  return h;
}

/** Save platform-wide AI settings through the admin API. Returns an error message, or null when saved. */
export async function savePlatformSettings(row: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch("/api/admin/platform-settings", { method: "POST", headers: await adminHeaders(), body: JSON.stringify(row) });
    if (r.ok) return null;
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return j.error || `Could not save (${r.status}).`;
  } catch {
    return "No internet — please try again.";
  }
}
