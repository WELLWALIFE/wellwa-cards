"use client";

// The one login for everything: the app, the card and the Business (partner) section.
// Username, mobile number or email + password — the server works out which one was typed (/api/login).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo, BrandWelcome } from "@/components/brand-context";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { GoogleButton } from "@/components/google-button";

export default function LoginPage() {
  const router = useRouter();
  const sb = getBrowserSupabase();
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ?next=… — where to land after login (a card's gear icon, the Business section, the partner panel hand-off).
  // Only same-site paths are honoured; a query string is allowed (e.g. /api/partner-panel?next=/team).
  function nextPath(): string {
    try {
      const n = new URLSearchParams(window.location.search).get("next") || "";
      // Always the app (owner's call, 2 Oct 2026: the whole system runs in the app, on a computer too); the desktop
      // dashboard stays one tap away under Settings → Advanced.
      const home = "/poster";
      return /^\/[a-zA-Z0-9/_-]*(\?[a-zA-Z0-9/_=&%.-]*)?$/.test(n) && !n.startsWith("//") ? n : home;
    } catch { return "/poster"; }
  }

  // An API route (e.g. /api/partner-panel, which hands the person into the partner panel) needs a real page load.
  function go(path: string, replace = false) {
    if (path.startsWith("/api/")) { window.location.assign(path); return; }
    if (replace) router.replace(path); else router.push(path);
  }

  // Already signed in? Skip the form and go straight on.
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => { if (data.session) go(nextPath(), true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ident, password }) });
      const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
      if (!r.ok || !j.access_token || !j.refresh_token) { setError(j.error || "Could not log in. Please try again."); setBusy(false); return; }
      const { error } = await sb.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
      if (error) { setError(error.message); setBusy(false); return; }
      go(nextPath());
    } catch {
      setError("No internet connection. Please try again.");
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><BrandLogo /></div>
        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
          <p className="text-sm text-muted mt-1"><BrandWelcome /></p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Username, mobile number or email</span>
              <input type="text" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={ident} onChange={(e) => setIdent(e.target.value)}
                placeholder="sharma_kirana · 98765 43210 · you@example.com" className={field} />
            </label>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Password</span>
              <span className="flex items-center rounded-lg border border-border bg-surface focus-within:border-brand">
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  className="w-0 min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} className="inline-flex items-center gap-1 px-3 text-xs font-semibold text-brand-ink">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showPw ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            {sb ? (
              <button type="submit" disabled={busy}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Log in <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <Link href="/dashboard" className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">
                  Continue (demo) <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-xs text-faint">Cloud login activates once Supabase keys are set.</p>
              </>
            )}
            <p className="text-right text-sm"><Link href="/forgot" className="font-medium text-brand-ink">Forgot password?</Link></p>
          </div>

          {sb && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <GoogleButton label="Log in with Google" divider={false} />
              <p className="mt-2 text-center text-[11px] text-faint">New here? Google makes your account — by continuing you accept the <a href="/terms" target="_blank" className="underline">Terms</a>, <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and <a href="/partners/legal/agreement" target="_blank" className="underline">Partner Agreement</a>.</p>
            </>
          )}
        </form>
        <p className="text-center text-sm text-muted mt-5">
          New to Shubhora? <Link href="/signup" className="text-brand-ink font-medium">Create your account</Link>
        </p>
      </div>
    </div>
  );
}
