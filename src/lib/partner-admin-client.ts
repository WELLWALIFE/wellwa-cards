"use client";
// Browser side of "one login for both admins": asks /api/admin/partner-link for a one-time pass into the partner
// (MLM) admin, with whatever opened this Super Admin (the admin login, or the admin password / handoff key).
// 16 Nov 2026: the ADMIN panel's own session (adminHeaders), then the app's. It used to send only the app's session, so
// after "Login as this user" (the app session is then that user's) the button answered "is the panel linked?".
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { adminHeaders } from "@/lib/admin-client";

async function ask(h: Record<string, string>): Promise<string | null> {
  try {
    const r = await fetch("/api/admin/partner-link", { headers: h, cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { url?: string };
    return r.ok && j.url ? j.url : null;
  } catch { return null; }
}

export async function partnerAdminUrl(): Promise<string | null> {
  const first = await ask(await adminHeaders().catch(() => ({} as Record<string, string>)));
  if (first) return first;
  const h: Record<string, string> = {};
  try { const k = sessionStorage.getItem("ne-admin-key"); if (k) h["x-admin-key"] = k; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return ask(h);
}
