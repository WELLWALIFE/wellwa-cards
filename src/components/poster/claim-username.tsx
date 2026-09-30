"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authHeaders } from "@/lib/poster-client";
import { cleanAccountUsername, looksLikePartnerId, usernameOk, INTRODUCER_KEY, INTRODUCER_LEG_KEY, USERNAME_HINT } from "@/lib/username";

type Check = { state: "idle" | "checking" | "ok" | "bad"; reason?: string };

/** Accounts from before usernames (and Google sign-ups): pick the one name once, checked live. */
export function ClaimUsername({ onDone }: { onDone: () => Promise<unknown> }) {
  const sb = getBrowserSupabase();
  const [u, setU] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Google sign-ups skipped the form: date of birth, gender and the agreement are collected here instead.
  const [needDetails, setNeedDetails] = useState(false);
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    sb?.auth.getUser().then(({ data }) => { const md = (data.user?.user_metadata ?? {}) as Record<string, unknown>; setNeedDetails(!md.dob || !md.gender || !md.agreed_at); }).catch(() => {});
  }, [sb]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onChange(v: string) {
    const c = cleanAccountUsername(v); setU(c); setErr("");
    if (timer.current) clearTimeout(timer.current);
    if (!c) { setCheck({ state: "idle" }); return; }
    if (!usernameOk(c)) { setCheck({ state: "bad", reason: looksLikePartnerId(c) ? "This looks like a partner ID — choose a name instead" : USERNAME_HINT }); return; }
    setCheck({ state: "checking" });
    timer.current = setTimeout(async () => {
      const { data, error } = (await sb?.rpc("account_username_available", { p_username: c })) ?? { data: null, error: null };
      if (error) { setCheck({ state: "idle" }); return; }
      setCheck(data === true ? { state: "ok" } : { state: "bad", reason: "Taken — try another" });
    }, 350);
  }
  async function save() {
    if (!usernameOk(u) || check.state === "bad") { setErr("Choose an available username."); return; }
    if (needDetails) {
      const a = age(dob);
      if (a === null) { setErr("Enter your date of birth."); return; }
      if (a < 18) { setErr("You must be 18 or older."); return; }
      if (!gender) { setErr("Select your gender."); return; }
      if (!agree) { setErr("Please accept the Terms, Privacy Policy and Partner Agreement."); return; }
    }
    setBusy(true); setErr("");
    let by = "", leg = ""; try { by = localStorage.getItem(INTRODUCER_KEY) || ""; leg = localStorage.getItem(INTRODUCER_LEG_KEY) || ""; } catch { /* ignore */ }
    const r = await fetch("/api/account", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ username: u, by: by || undefined, leg: leg === "L" || leg === "R" ? leg : undefined, ...(needDetails ? { dob, gender, agree: true } : {}) }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Could not save. Try again."); return; }
    try { localStorage.removeItem(INTRODUCER_KEY); localStorage.removeItem(INTRODUCER_LEG_KEY); } catch { /* ignore */ }
    await onDone();
  }
  return (
    <div className="rounded-xl border border-brand/40 bg-brand-soft/20 p-3 space-y-2">
      <p className="text-sm font-semibold">Choose your unique username</p>
      <p className="text-[11px] text-muted">You log in with it and your team sees you by it — it never changes.</p>
      <span className={`flex items-center rounded-lg border bg-surface ${check.state === "ok" ? "border-good" : check.state === "bad" ? "border-danger" : "border-border"}`}>
        <input value={u} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Yadav_Aura" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20} className="w-0 min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none" />
        <span className="pr-3">{check.state === "checking" ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : check.state === "ok" ? <Check className="h-4 w-4 text-good" /> : check.state === "bad" ? <X className="h-4 w-4 text-danger" /> : null}</span>
      </span>
      <p className={`text-[11px] ${check.state === "ok" ? "text-good font-semibold" : check.state === "bad" ? "text-danger" : "text-muted"}`}>{check.state === "ok" ? "Available" : check.state === "bad" ? check.reason : "Letters, numbers and _ · 4 to 20 characters"}</p>
      {needDetails && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-medium">Date of birth</span><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-medium">Gender</span><select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
          </div>
          <label className="flex items-start gap-2 text-[11px] text-muted"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" /><span>I am 18 or older and I accept the <a href="/terms" target="_blank" className="font-semibold text-brand-ink underline">Terms</a>, <a href="/privacy" target="_blank" className="font-semibold text-brand-ink underline">Privacy Policy</a> and the <a href="/partners/legal/agreement" target="_blank" className="font-semibold text-brand-ink underline">Partner Agreement</a>.</span></label>
        </>
      )}
      {err && <p className="text-xs text-danger">{err}</p>}
      <button type="button" onClick={save} disabled={busy || check.state !== "ok"} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Save username</button>
    </div>
  );
}

function age(d: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const b = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(b.getTime()) || b.getFullYear() < 1900 || b > new Date()) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
