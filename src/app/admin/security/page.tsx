"use client";
// Security (Admin v2): the person's own password and 2-step verification (an authenticator app), and "log out everywhere".
// Also where the shell sends someone who must first set a password (a new login) or enter / set up 2-step.
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { adminApi, useAdminMe } from "@/lib/admin-client";
import { Btn, Card, CopyBtn, Field, PageHeader, Spinner, inputCls, toast } from "@/components/admin/ui";

type Factor = { id: string; status: string; friendly_name?: string; created_at?: string };
const bump = () => window.dispatchEvent(new Event("admin-me-changed"));

function SecurityInner() {
  const router = useRouter();
  const params = useSearchParams();
  const need = params.get("need");
  const next = params.get("next") && params.get("next")!.startsWith("/admin") ? params.get("next")! : "/admin";
  const { me, status } = useAdminMe();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [aal, setAal] = useState<"aal1" | "aal2">("aal1");
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const sb = getBrowserSupabase(); if (!sb) return;
    const f = await sb.auth.mfa.listFactors();
    setFactors((f.data?.all ?? []) as Factor[]);
    const a = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal(a.data?.currentLevel === "aal2" ? "aal2" : "aal1");
  }, []);
  useEffect(() => { void load(); }, [load]);

  const verified = (factors ?? []).filter((f) => f.status === "verified");
  const enrolled = verified.length > 0;
  const done = () => { bump(); if (need) router.replace(next); };

  async function startEnroll() {
    setErr(""); setBusy("enroll");
    const sb = getBrowserSupabase()!;
    for (const f of (factors ?? []).filter((x) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Shubhora Admin" });
    setBusy("");
    if (error || !data) { setErr(error?.message?.includes("not enabled") || error?.message?.includes("disabled") ? "2-step is not switched on in the Supabase project yet (Authentication → Multi-factor → TOTP). Ask the owner." : error?.message || "Could not start."); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function finishEnroll(e: React.FormEvent) {
    e.preventDefault(); if (!enroll) return;
    const c = code.replace(/\D/g, ""); if (c.length !== 6) { setErr("The code has 6 digits."); return; }
    setErr(""); setBusy("verify");
    const { error } = await getBrowserSupabase()!.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: c });
    setBusy("");
    if (error) { setErr("That code did not match. Scan again or try the current code."); return; }
    setEnroll(null); setCode(""); toast("2-step verification is on."); await load(); done();
  }
  async function verifyNow(e: React.FormEvent) {
    e.preventDefault();
    const c = code.replace(/\D/g, ""); if (c.length !== 6) { setErr("The code has 6 digits."); return; }
    setErr(""); setBusy("verify");
    const { error } = await getBrowserSupabase()!.auth.mfa.challengeAndVerify({ factorId: verified[0].id, code: c });
    setBusy("");
    if (error) { setErr("That code did not match."); return; }
    setCode(""); await load(); done();
  }
  async function removeMfa() {
    if (!confirm("Switch 2-step off for your login? You can set it up again any time.")) return;
    setBusy("remove");
    const sb = getBrowserSupabase()!;
    for (const f of factors ?? []) { const { error } = await sb.auth.mfa.unenroll({ factorId: f.id }); if (error) { setBusy(""); setErr(error.message.includes("AAL2") || error.message.includes("aal2") ? "Enter your current code first (below), then remove." : error.message); return; } }
    setBusy(""); toast("2-step switched off.", "info"); await load(); bump();
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (pw.a.length < 10) { setErr("Use at least 10 characters."); return; }
    if (pw.a !== pw.b) { setErr("The two passwords differ."); return; }
    setBusy("pw");
    const { error } = await getBrowserSupabase()!.auth.updateUser({ password: pw.a });
    if (error) { setBusy(""); setErr(error.message.includes("AAL2") || error.message.includes("aal2") ? "Enter your 2-step code first (above), then change the password." : error.message); return; }
    await adminApi("/api/admin/v2/me", { method: "PATCH", json: { password_changed: true } });
    setBusy(""); setPw({ a: "", b: "" }); toast("Password changed."); done();
  }
  async function logoutEverywhere() {
    if (!confirm("Log out of every device and browser (this one too)?")) return;
    await getBrowserSupabase()!.auth.signOut({ scope: "global" });
    router.replace("/admin/login");
  }

  if (status === "loading" || factors === null) return <Spinner />;
  const mustMfa = need === "mfa_required";
  const mustPw = need === "password_change_required";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Security" sub={me ? `${me.name} · ${me.email}` : ""} />
      {(mustMfa || mustPw) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {mustPw ? <><b>Welcome.</b> Set your own password first — the temporary one was for this first login only.</> : enrolled ? <><b>Enter your 2-step code</b> to open the panel.</> : <><b>2-step verification is required</b> for admin logins. Set it up below (2 minutes).</>}
        </div>
      )}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}

      {/* 2-step */}
      <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> 2-step verification (authenticator app)</span>}
        sub="Google Authenticator, Microsoft Authenticator, Authy — a 6-digit code at every login, so a stolen password alone opens nothing.">
        {enrolled && aal !== "aal2" && (
          <form onSubmit={verifyNow} className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-bg p-3">
            <Field label="Your current code" className="flex-1"><input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className={`${inputCls} tracking-[0.3em]`} placeholder="123456" /></Field>
            <Btn type="submit" variant="primary" loading={busy === "verify"}>Verify</Btn>
          </form>
        )}
        {enrolled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> <b>On</b> <span className="text-muted">· set up {verified[0].created_at ? new Date(verified[0].created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>{aal === "aal2" && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">verified this session</span>}</p>
            <Btn variant="danger" size="sm" icon={ShieldOff} loading={busy === "remove"} onClick={() => void removeMfa()}>Switch off</Btn>
          </div>
        ) : enroll ? (
          <form onSubmit={finishEnroll} className="space-y-4">
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2"><b>1.</b> Open your authenticator app and tap <b>+</b> / Scan a QR code.</li>
              <li className="flex gap-2"><b>2.</b> Scan this:</li>
            </ol>
            <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qr} alt="QR code" className="h-44 w-44" />
              <div className="min-w-0 flex-1 text-xs text-muted">
                <p>Cannot scan? Type this key in the app instead:</p>
                <p className="mt-1 break-all rounded bg-surface2 px-2 py-1 font-mono text-[11px] text-ink">{enroll.secret}</p>
                <div className="mt-2"><CopyBtn text={enroll.secret} label="Copy key" /></div>
              </div>
            </div>
            <Field label="3. Type the 6-digit code the app shows"><input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className={`${inputCls} max-w-xs tracking-[0.3em]`} placeholder="123456" /></Field>
            <div className="flex gap-2"><Btn type="submit" variant="primary" loading={busy === "verify"}>Turn on 2-step</Btn><Btn onClick={() => { setEnroll(null); setCode(""); }}>Cancel</Btn></div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> <b>Off</b> <span className="text-muted">· your password alone opens the panel</span></p>
            <Btn variant="primary" icon={Smartphone} loading={busy === "enroll"} onClick={() => void startEnroll()}>Set up 2-step</Btn>
          </div>
        )}
      </Card>

      {/* password */}
      <Card title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-brand" /> Password</span>} sub="At least 10 characters. Use a password you use nowhere else.">
        <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
          <Field label="New password"><input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} className={inputCls} /></Field>
          <Field label="Again"><input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} className={inputCls} /></Field>
          <div className="sm:col-span-2"><Btn type="submit" variant="primary" loading={busy === "pw"}>Change password</Btn></div>
        </form>
      </Card>

      <Card title={<span className="flex items-center gap-2"><LogOut className="h-4 w-4 text-brand" /> Sessions</span>} sub="If you logged in on a shared computer, or lost a phone, log out everywhere and log in again here.">
        <Btn variant="danger" onClick={() => void logoutEverywhere()}>Log out of all devices</Btn>
      </Card>
    </div>
  );
}
export default function SecurityPage() { return <Suspense fallback={<Spinner />}><SecurityInner /></Suspense>; }
