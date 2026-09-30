"use client";
// Browser side of "one login for both admins": asks /api/admin/partner-link for a one-time pass into the partner
// (MLM) admin, with whatever opened this Super Admin (the owner's app login, or the admin password / handoff key).
import { getBrowserSupabase } from "@/lib/supabase/browser";

export async function partnerAdminUrl(): Promise<string | null> {
  const h: Record<string, string> = {};
  try { const k = sessionStorage.getItem("ne-admin-key"); if (k) h["x-admin-key"] = k; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  try {
    const r = await fetch("/api/admin/partner-link", { headers: h, cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { url?: string };
    return r.ok && j.url ? j.url : null;
  } catch { return null; }
}
