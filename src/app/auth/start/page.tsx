"use client";

// Where "Log in with Google" comes back to. Joining with Google is off (/api/auth/google-gate turns a brand-new
// Google account away); an existing account goes to its usual home.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { INTRODUCER_KEY, INTRODUCER_LEG_KEY } from "@/lib/username";

export default function StartPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) { router.replace("/login"); return; }
      let { data: { session } } = await sb.auth.getSession();
      const code = new URLSearchParams(window.location.search).get("code");
      if (!session && code) session = (await sb.auth.exchangeCodeForSession(code)).data.session;
      if (!session) { setError("Google sign-in did not finish. Please try again."); return; }
      const auth = { Authorization: `Bearer ${session.access_token}` };
      // Joining with Google is off: Google only logs in accounts that already exist.
      const gate = await fetch("/api/auth/google-gate", { method: "POST", headers: auth }).then((r) => r.json()).catch(() => ({}));
      if (gate?.blocked) {
        await sb.auth.signOut().catch(() => {});
        setError("No Shubhora account with this Google email. Please create your account with email first.");
        return;
      }
      await fetch("/api/join", { method: "POST", headers: auth }).catch(() => {});
      // Username + partner ID straight away, under the introducer whose link they came from (kept in this browser).
      let by = "", leg = "";
      try { by = localStorage.getItem(INTRODUCER_KEY) || ""; leg = localStorage.getItem(INTRODUCER_LEG_KEY) || ""; } catch { /* private mode */ }
      const a = await fetch("/api/account", { method: "POST", headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ action: "auto", by: by || undefined, leg: leg === "L" || leg === "R" ? leg : undefined, agree: true }) }).catch(() => null);
      if (a?.ok) { try { localStorage.removeItem(INTRODUCER_KEY); localStorage.removeItem(INTRODUCER_LEG_KEY); } catch { /* ignore */ } }
      const w = await fetch("/api/welcome", { method: "POST", headers: auth }).then((r) => r.json()).catch(() => ({}));
      // A new account: congratulations, then the five profile steps; everyone else: the app (never the desktop
      // dashboard — owner's call, 2 Oct 2026).
      if (w?.fresh) { router.replace("/poster/welcome"); return; }
      router.replace("/poster");
    })();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      {error
        ? <p className="text-sm font-medium text-danger">{error} <a href="/signup" className="underline">Create account</a> · <a href="/login" className="underline">Back to log in</a></p>
        : <p className="text-sm text-muted">Signing you in…</p>}
    </div>
  );
}
