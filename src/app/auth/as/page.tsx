"use client";

// Super Admin → Users → "Login as": signs this browser straight into that user's account and opens their app.
// The one-time token comes from /api/admin/users (Supabase generate_link → hashed_token) and is redeemed here with
// verifyOtp, so no redirect settings or e-mail are involved. The owner's own session is kept aside first, so the
// "Back to admin" bar (components/admin-return-bar.tsx) can switch this browser back in one tap.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isOwnerEmail } from "@/lib/owner-emails";
import { ADMIN_RETURN_KEY } from "@/components/admin-return-bar";

function LoginAs() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = params.get("t");
      const sb = getBrowserSupabase();
      if (!token || !sb) { setError("This login link is not valid."); return; }
      // Keep the owner's session so they can come back without logging in again. (No signOut: that would end the
      // owner's session everywhere.)
      try {
        const { data } = await sb.auth.getSession();
        const cur = data.session;
        if (cur && isOwnerEmail(cur.user.email)) {
          localStorage.setItem(ADMIN_RETURN_KEY, JSON.stringify({
            access_token: cur.access_token, refresh_token: cur.refresh_token, email: cur.user.email, as: params.get("n") || "",
          }));
        }
      } catch { /* the bar just won't appear */ }
      const { error: e } = await sb.auth.verifyOtp({ token_hash: token, type: "magiclink" });
      if (e) { setError("This login link has expired or was already used. Press “Login as” again."); return; }
      // A full load, so every part of the app starts with the new account.
      const next = params.get("next") || "";
      window.location.replace(/^\/(?!\/)[\w\-/?=&.]*$/.test(next) ? next : "/poster");   // same-site paths only
    })();
  }, [params]);

  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : <p className="text-sm text-muted">Opening the account…</p>}
    </div>
  );
}

export default function Page() {
  return <Suspense><LoginAs /></Suspense>;
}
