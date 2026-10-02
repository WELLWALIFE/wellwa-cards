"use client";

// Where the password-reset email lands. Supabase puts a short session in the address (#access_token…&type=recovery);
// the browser client picks it up, and the person chooses a new password here. Then straight into the app.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-context";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function ResetPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "expired">("checking");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) { setReady("expired"); return; }
    let settled = false;
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      if (event === "PASSWORD_RECOVERY" || (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION"))) { settled = true; setReady("ok"); }
    });
    // The hash is read when the client starts; give it a moment, then decide.
    const t = setTimeout(async () => {
      if (settled) return;
      const { data } = await sb.auth.getSession();
      settled = true;
      setReady(data.session ? "ok" : "expired");
    }, 1500);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (pw.length < 6) { setError("At least 6 characters."); return; }
    setBusy(true); setError("");
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setError(error.message); return; }
    try { history.replaceState(null, "", "/auth/reset"); } catch { /* ignore */ }
    router.replace("/poster");
  }

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><BrandLogo /></div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          {ready === "checking" && <p className="text-sm text-muted inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking your link…</p>}
          {ready === "expired" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight">This link has expired</h1>
              <p className="mt-2 text-sm text-muted">Reset links work once and for a short time. Ask for a new one.</p>
              <Link href="/forgot" className="mt-5 inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">New reset link <ArrowRight className="h-4 w-4" /></Link>
            </>
          )}
          {ready === "ok" && (
            <form onSubmit={submit}>
              <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
              <p className="mt-1 text-sm text-muted">At least 6 characters. You will use it for the app, your card and your Business section.</p>
              <span className="mt-5 flex items-center rounded-lg border border-border bg-surface focus-within:border-brand">
                <input type={show ? "text" : "password"} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password"
                  className="w-0 min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
                <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1 px-3 text-xs font-semibold text-brand-ink">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {show ? "Hide" : "Show"}</button>
              </span>
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
              <button type="submit" disabled={busy} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Save and log in <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
