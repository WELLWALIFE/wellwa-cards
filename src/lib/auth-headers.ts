"use client";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** Authorization header for our own API routes (empty when signed out). */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}
