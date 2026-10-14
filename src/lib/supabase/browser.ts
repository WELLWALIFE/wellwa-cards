"use client";

// Singleton browser client. Returns null when env vars are missing so the
// whole app degrades gracefully to demo mode.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createBrowserClient(url, key) : null;
  if (client) speedUpGetUser(client);
  return client;
}

/** `auth.getUser()` asks the Supabase server every time, and a page asks it a dozen times (each screen, the menu, the plan, the
 *  guards…) at 2–7 seconds apiece on a busy hour — the whole app felt slow (owner, 14 Oct 2026). Calls made together share one
 *  answer, and a fresh answer is reused for 20 seconds; anything that changes the user (updateUser, signing in or out) clears it. */
function speedUpGetUser(sb: SupabaseClient) {
  type R = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>;
  const orig = sb.auth.getUser.bind(sb.auth);
  const origUpdate = sb.auth.updateUser.bind(sb.auth);
  let kept: { at: number; v: R } | null = null;
  let flying: Promise<R> | null = null;
  const forget = () => { kept = null; flying = null; };
  sb.auth.getUser = ((jwt?: string) => {
    if (jwt) return orig(jwt);
    if (kept && Date.now() - kept.at < 20_000) return Promise.resolve(kept.v);
    if (flying) return flying;
    const mine = orig().then((v) => { if (!v.error && v.data.user && flying === mine) kept = { at: Date.now(), v }; return v; }).finally(() => { if (flying === mine) flying = null; });
    flying = mine;
    return mine;
  }) as typeof sb.auth.getUser;
  sb.auth.updateUser = ((...a: Parameters<typeof origUpdate>) => { forget(); return origUpdate(...a).finally(forget); }) as typeof sb.auth.updateUser;
  sb.auth.onAuthStateChange(() => forget());
}
