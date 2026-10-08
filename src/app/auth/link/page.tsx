"use client";

// Signs a person in from a one-time token (sent here by the company's associate panel, or by the WhatsApp bot's
// "open in the app" link), then opens the dashboard — or the page `to` names (an in-app path only).
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";

function LinkSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("t");
    const to = params.get("to") ?? "";
    const dest = /^\/(?!\/)[^\s]*$/.test(to) ? to : "/dashboard";
    const sb = getBrowserSupabase();
    if (!token || !sb) { setError("This sign-in link is not valid."); return; }
    sb.auth.verifyOtp({ token_hash: token, type: "magiclink" }).then(({ error: e }) => {
      if (e) setError("This sign-in link has expired. Please open it again.");
      else router.replace(dest);
    });
  }, [params, router]);

  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : <p className="text-sm text-muted">Signing you in…</p>}
    </div>
  );
}

export default function Page() {
  return <Suspense><LinkSignIn /></Suspense>;
}
