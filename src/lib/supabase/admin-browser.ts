"use client";
// The admin panel's OWN login (owner, 2 Nov 2026: "admin login kiya to app me demo account ki jagah mera account aa gaya — sahi karo").
// The app and /admin used one Supabase session per browser, so logging in to the panel replaced whoever was logged in to the app
// (the demo account on a sales call, a customer being helped). The panel now keeps its session in its own cookie
// (`sb-shubhora-admin`): the panel and the app can be two different people in the same browser, and logging out of one leaves
// the other. The admin API routes read the bearer token the panel sends (admin-client.ts), never the app's cookie.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getAdminSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createBrowserClient(url, key, { isSingleton: false, cookieOptions: { name: "sb-shubhora-admin" } }) : null;
  return client;
}
