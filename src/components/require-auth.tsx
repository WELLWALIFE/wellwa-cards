"use client";

// Locks the user dashboard behind a real login. When Supabase is configured
// and there's no session, redirect to /login. In pure demo mode (no Supabase
// env), everything stays open so the app is still explorable.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function RequireAuth() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return; // demo mode — no auth to enforce
    let cancelled = false;
    sb.auth.getUser().then(({ data }) => {
      if (!cancelled && !data.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
      }
    });
    return () => { cancelled = true; };
  }, [router, pathname]);

  return null;
}
