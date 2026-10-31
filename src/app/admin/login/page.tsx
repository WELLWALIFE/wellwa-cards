"use client";
// The admin panel's own login (Admin v2): e-mail or mobile + password — the same Shubhora account — then the authenticator
// code when 2-step is set up. Whether this account is an admin, and what it may do, the shell asks the server next.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, LoaderCircle, Lock, ShieldCheck } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { inputCls } from "@/components/admin/ui";

const loginAddress = (login: string) => {
  const s = login.trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return s;
  const d = s.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? `p91${d}@phone.neuraledge.me` : "";
};
const safeNext = (n: string | null) => (n && /^\/admin(\/[a-zA-Z0-9/_-]*)?(\?[a-zA-Z0-9/_=&%.-]*)?$/.test(n) && !n.startsWith("/admin/login") ? n : "/admin");

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [login, setLogin] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [factorId, setFactorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(true);

  // Already logged in → straight to the panel (the shell decides whether this account is an admin).
  useEffect(() => { (async () => {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session) router.replace(next); else setChecking(false);
  })(); }, [next, router]);

  async function afterLogin() {
    const sb = getBrowserSupabase()!;
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      const f = await sb.auth.mfa.listFactors();
      const totp = f.data?.totp?.find((x) => x.status === "verified") ?? f.data?.totp?.[0];
      if (totp) { setFactorId(totp.id); setStep("mfa"); setBusy(false); return; }
    }
    router.replace(next.includes("?") ? `${next}&login=1` : `${next}?login=1`);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const email = loginAddress(login);
    if (!email) { setErr("Write your e-mail or 10-digit mobile."); return; }
    if (!pw) { setErr("Write your password."); return; }
    const sb = getBrowserSupabase(); if (!sb) { setErr("Login is not available right now."); return; }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { setBusy(false); setErr(/invalid/i.test(error.message) ? "Wrong e-mail / mobile or password." : /rate|too many/i.test(error.message) ? "Too many tries. Wait a few minutes." : error.message); return; }
    await afterLogin();
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const sb = getBrowserSupabase()!;
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) { setErr("The code has 6 digits."); return; }
    setBusy(true);
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: c });
    if (error) { setBusy(false); setErr("That code did not match. Codes change every 30 seconds — try the current one."); return; }
    router.replace(next.includes("?") ? `${next}&login=1` : `${next}?login=1`);
  }

  if (checking) return <LoaderCircle className="h-6 w-6 animate-spin text-muted" />;
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/app-192.png" alt="" className="h-11 w-11 rounded-xl shadow-sm" />
        <div><h1 className="text-lg font-semibold tracking-tight text-ink">Shubhora Admin</h1><p className="text-xs text-muted">Staff, franchise and owner logins</p></div>
      </div>
      <form onSubmit={step === "login" ? submit : verify} className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-float">
        {step === "login" ? (
          <>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">E-mail or mobile</span>
              <input autoFocus autoComplete="username" value={login} onChange={(e) => { setLogin(e.target.value); setErr(""); }} className={inputCls} placeholder="you@company.com or 98765 43210" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">Password</span>
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-bg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
                <span className="pl-3 text-faint"><Lock className="h-4 w-4" /></span>
                <input type={show ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} className="h-10 flex-1 bg-transparent px-3 text-sm outline-none" placeholder="••••••••" />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide" : "Show"} className="px-3 text-muted">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div></label>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-ink"><ShieldCheck className="h-4 w-4" /> 2-step verification: open your authenticator app and type the 6-digit code for Shubhora.</div>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">6-digit code</span>
              <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }} className={`${inputCls} text-center text-xl tracking-[0.4em]`} placeholder="••••••" /></label>
          </>
        )}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button type="submit" disabled={busy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg grad-brand text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}{step === "login" ? "Log in" : "Verify"}
        </button>
        {step === "login"
          ? <p className="text-center text-xs text-muted"><Link href="/forgot" className="font-semibold text-brand-ink">Forgot password?</Link></p>
          : <p className="text-center text-xs text-muted">Lost the app? Ask the Super Admin to reset your 2-step under Staff & roles.</p>}
      </form>
      <p className="mt-4 text-center text-[11px] text-faint">Every login and every action in this panel is recorded.</p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <Suspense fallback={<LoaderCircle className="h-6 w-6 animate-spin text-muted" />}><LoginForm /></Suspense>
    </div>
  );
}
