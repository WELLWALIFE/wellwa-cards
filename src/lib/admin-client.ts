"use client";
// Headers and a fetch helper for the /api/admin/* routes from the admin panel: the person's own Shubhora session
// (Authorization: Bearer — src/lib/admin-v2.ts reads it; x-owner-token is the same token for the older routes) and, when a
// partner-panel handoff or the emergency password put one there, x-admin-key.
import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { AdminMe } from "@/lib/admin-rights";

export async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { const k = sessionStorage.getItem("ne-admin-key") ?? ""; if (k) h["x-admin-key"] = k; } catch { /* private mode */ }
  try {
    const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) { h.Authorization = `Bearer ${data.session.access_token}`; h["x-owner-token"] = data.session.access_token; }
  } catch { /* signed out */ }
  return h;
}

export type ApiAnswer<T> = { ok: boolean; status: number; data: T & { error?: string; code?: string } };
/** One admin API call. A 401 sends the person to the login page; a 403 "mfa_required" / "password_change_required" to Security. */
export async function adminApi<T = Record<string, unknown>>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiAnswer<T>> {
  const { json, ...rest } = init;
  let r: Response;
  try {
    r = await fetch(path, { ...rest, method: rest.method ?? (json !== undefined ? "POST" : "GET"), headers: { ...(await adminHeaders()), ...(rest.headers ?? {}) }, body: json !== undefined ? JSON.stringify(json) : rest.body, cache: "no-store" });
  } catch {
    return { ok: false, status: 0, data: { error: "No internet — please try again." } as T & { error?: string } };
  }
  const data = ((await r.json().catch(() => ({}))) ?? {}) as T & { error?: string; code?: string };
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login") && !window.location.pathname.startsWith("/admin/security")) {
    if (r.status === 401) window.location.replace(`/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    else if (r.status === 403 && (data.code === "mfa_required" || data.code === "password_change_required")) window.location.replace(`/admin/security?need=${data.code}&next=${encodeURIComponent(window.location.pathname)}`);
  }
  return { ok: r.ok, status: r.status, data };
}

/** Save platform-wide AI settings through the admin API. Returns an error message, or null when saved. */
export async function savePlatformSettings(row: Record<string, string>): Promise<string | null> {
  const r = await adminApi("/api/admin/platform-settings", { method: "POST", json: row });
  return r.ok ? null : r.data.error || `Could not save (${r.status}).`;
}

export type MeAnswer = { me: AdminMe; need: null | "mfa_required" | "password_change_required"; settings: { enforce_mfa: boolean }; alerts: { payouts: number; pending: number } };
/** Who is logged in to the panel, from /api/admin/v2/me (shared by the shell and the pages). */
export function useAdminMe() {
  const [me, setMe] = useState<MeAnswer | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "anon" | "blocked" | "mfa" | "password">("loading");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    // ?login=1 on the page the login sent us to: this is a fresh login — the server records it (last login, audit), then the flag goes.
    let fresh = false;
    try { const u = new URL(window.location.href); if (u.searchParams.get("login") === "1") { fresh = true; u.searchParams.delete("login"); window.history.replaceState(null, "", u.toString()); } } catch { /* ignore */ }
    const r = await adminApi<MeAnswer>(`/api/admin/v2/me${fresh ? "?login=1" : ""}`);
    if (r.ok) { setMe(r.data); setError(""); setStatus(r.data.need === "mfa_required" ? "mfa" : r.data.need === "password_change_required" ? "password" : "ok"); return; }
    if (r.status === 401) setStatus("anon");
    else { setStatus("blocked"); setError(r.data.error || ""); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { me: me?.me ?? null, all: me, status, error, reload: load };
}

export const rupees = (paise: number | null | undefined) => `₹${Math.round((paise || 0) / 100).toLocaleString("en-IN")}`;
export const fmtDate = (iso: string | null | undefined, time = false) => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: "Asia/Kolkata" }) : "—";
export const ago = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; const d = Math.round(h / 24); return d < 30 ? `${d} d ago` : fmtDate(iso);
};
