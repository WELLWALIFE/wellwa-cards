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
      // The way back is ALWAYS remembered, so the bar is always there. When the browser happens to be logged
      // into the app as the owner, their session is kept too and one tap puts it straight back (no signOut:
      // that would end the owner's session everywhere). When it is not — Super Admin unlocked with the admin
      // password, which is the usual way — there is no session to keep, and the bar simply walks back to the
      // admin page. Before, nothing was saved in that case and the bar never appeared at all.
      const from = params.get("from") || "";
      const back = /^\/admin(\/[\w\-/]*)?$/.test(from) ? from : "/admin/users";
      try {
        const { data } = await sb.auth.getSession();
        const cur = data.session;
        const owner = cur && isOwnerEmail(cur.user.email) ? cur : null;
        localStorage.setItem(ADMIN_RETURN_KEY, JSON.stringify({
          ...(owner ? { access_token: owner.access_token, refresh_token: owner.refresh_token, email: owner.user.email } : {}),
          as: params.get("n") || "", back,
        }));
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
