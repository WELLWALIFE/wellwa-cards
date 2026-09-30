"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-context";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, Lock, MailCheck, UserRound, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { GoogleButton } from "@/components/google-button";
import { toE164, phoneEmail } from "@/lib/phone";
import { cleanAccountUsername, looksLikePartnerId, usernameOk, USERNAME_HINT, INTRODUCER_KEY, INTRODUCER_LEG_KEY } from "@/lib/username";

type Check = { state: "idle" | "checking" | "ok" | "bad"; reason?: string };

/** Whole years from a yyyy-mm-dd date to today, or null when the date is not real. */
/** Under the mobile / email box: "already registered — log in", or a small typing hint. */
function Taken({ what, on, hint }: { what: string; on: boolean; hint?: string }) {
  if (on) return (
    <span className="mt-1.5 block text-xs text-danger">
      This {what} is already registered. <Link href="/login" className="font-semibold underline">Log in</Link> or <Link href="/forgot" className="font-semibold underline">reset the password</Link>.
    </span>
  );
  return hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null;
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

export default function SignupPage() {
  return <Suspense fallback={<div className="flex-1 grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><SignupInner /></Suspense>;
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = getBrowserSupabase();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  // One account per mobile and per email (owner's call, 28 Sep 2026): checked while typing, and once more on Create.
  const [taken, setTaken] = useState<{ mobile?: boolean; email?: boolean }>({});
  const takenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  // Who introduced this person: from the link, else from an earlier visit. Shown by username only — never a name.
  // `by` is the resolved handle (an account username, or an older partner's SH code); `handleRef` keeps whatever
  // the link carried, so the introducer still reaches the server even when the lookup itself failed.
  const [by, setBy] = useState<string>("");
  const handleRef = useRef<string>("");
  const legRef = useRef<"L" | "R" | "">("");   // side from the link (partner panel's left / right links)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The username is suggested from the name (owner's call, 25 Sep 2026: inventing a free username was the hardest
  // field). Typing in the box takes over; the suggestion never overwrites what the person typed.
  const [userTouched, setUserTouched] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (userTouched || !sb) return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const words = name.trim().split(/\s+/).map((w) => cleanAccountUsername(w)).filter(Boolean);
    if (!words.length) return;
    const base0 = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("").slice(0, 16);
    const base = base0.length >= 4 ? base0 : `${base0}_in`.slice(0, 16);
    suggestTimer.current = setTimeout(async () => {
      const tries = [base, ...Array.from({ length: 4 }, () => `${base}${Math.floor(10 + Math.random() * 990)}`)];
      for (const u of tries) {
        if (!usernameOk(u)) continue;
        const { data, error } = await sb.rpc("account_username_available", { p_username: u });
        if (error) return;
        if (data === true) { setUsername(u); setCheck({ state: "ok" }); return; }
      }
    }, 600);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, userTouched]);

  useEffect(() => {
    const fromLink = (params.get("by") || params.get("ref") || "").trim().slice(0, 40);
    let stored = "";
    try { stored = localStorage.getItem(INTRODUCER_KEY) || ""; } catch { /* private mode */ }
    const legParam = params.get("leg");
    let storedLeg = "";
    try { storedLeg = localStorage.getItem(INTRODUCER_LEG_KEY) || ""; } catch { /* private mode */ }
    const leg = legParam === "L" || legParam === "R" ? legParam : fromLink ? "" : (storedLeg === "L" || storedLeg === "R" ? storedLeg : "");
    legRef.current = leg as "L" | "R" | "";
    try { if (leg) localStorage.setItem(INTRODUCER_LEG_KEY, leg); else if (fromLink) localStorage.removeItem(INTRODUCER_LEG_KEY); } catch { /* ignore */ }
    const handle = fromLink || stored;
    if (!handle) return;
    handleRef.current = handle;
    (async () => {
      try {
        const r = await fetch(`/api/introducer?by=${encodeURIComponent(handle)}`, { cache: "no-store" });
        const j = (await r.json()) as { by?: string | null };
        if (j.by) { setBy(j.by); try { localStorage.setItem(INTRODUCER_KEY, j.by); } catch { /* ignore */ } }
      } catch { /* offline: no chip, the link's handle is still sent with the sign-up */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Only digits, at most 10: a pasted +91 / 0 in front is dropped, never counted. */
  function onMobile(v: string) {
    let d = v.replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
    else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
    setMobile(d.slice(0, 10));
  }
  const mobileOk = /^[6-9]\d{9}$/.test(mobile);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  async function checkTaken(m: string, e: string): Promise<{ mobile?: boolean; email?: boolean }> {
    const qs = new URLSearchParams();
    if (/^[6-9]\d{9}$/.test(m)) qs.set("mobile", m);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) qs.set("email", e.trim());
    if (!qs.toString()) return {};
    try { const r = await fetch(`/api/signup-check?${qs}`, { cache: "no-store" }); return r.ok ? await r.json() : {}; } catch { return {}; }
  }
  useEffect(() => {
    if (takenTimer.current) clearTimeout(takenTimer.current);
    if (!mobileOk && !emailOk) { setTaken({}); return; }
    takenTimer.current = setTimeout(async () => setTaken(await checkTaken(mobile, email)), 450);
    return () => { if (takenTimer.current) clearTimeout(takenTimer.current); };
  }, [mobile, email, mobileOk, emailOk]);

  // Availability while typing — the database applies the rules (length, characters, reserved words, taken by any card or account).
  function onUsername(v: string) {
    const u = cleanAccountUsername(v);
    setUsername(u);
    if (timer.current) clearTimeout(timer.current);
    if (!u) { setCheck({ state: "idle" }); return; }
    if (!usernameOk(u)) { setCheck({ state: "bad", reason: looksLikePartnerId(u) ? "This looks like a partner ID — choose a name instead" : USERNAME_HINT }); return; }
    setCheck({ state: "checking" });
    timer.current = setTimeout(async () => {
      if (!sb) { setCheck({ state: "idle" }); return; }
      const { data, error } = await sb.rpc("account_username_available", { p_username: u });
      if (error) { setCheck({ state: "idle" }); return; }
      setCheck(data === true ? { state: "ok" } : { state: "bad", reason: "Taken — try another" });
    }, 350);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setError("");
    const phone = mobile.trim() ? toE164(mobile) : null;
    if (mobile.trim() && !phone) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (!phone) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    if (!dob || age(dob) === null) { setError("Enter your date of birth."); return; }
    if ((age(dob) ?? 0) < 18) { setError("You must be 18 or older to create a Shubhora account."); return; }
    if (!gender) { setError("Select your gender."); return; }
    if (!agree) { setError("Please accept the Terms, Privacy Policy and Partner Agreement to continue."); return; }
    if (!usernameOk(username)) { setError(`Choose a username: ${USERNAME_HINT}.`); return; }
    const t = await checkTaken(mobile, email);
    setTaken(t);
    if (t.mobile) { setError("This mobile number is already registered — log in instead."); return; }
    if (t.email) { setError("This email is already registered — log in instead."); return; }
    if (check.state === "bad") { setError("That username is not available — choose another."); return; }
    setBusy(true);
    // Mobile is the primary login when given (no OTP — password only); the email, if any, is stored on the profile.
    const { data, error } = await sb.auth.signUp({
      email: phone ? phoneEmail(phone) : email.trim().toLowerCase(),
      password,
      options: { data: { full_name: name, display_name: name, phone: phone ?? undefined, contact_email: email.trim() || undefined, wanted_username: username, introduced_by: by || handleRef.current || undefined, introduced_leg: legRef.current || undefined, dob, gender, agreed_at: new Date().toISOString() } },
    });
    if (error) { setBusy(false); setError(error.message); return; }
    if (data.session) {
      const auth = { Authorization: `Bearer ${data.session.access_token}` };
      // The username + introducer + partner account, in one call. A clash here (someone took the name a second ago)
      // is shown; the account itself already exists, so the person just picks another name.
      const r = await fetch("/api/account", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ username, by: by || handleRef.current || undefined, leg: legRef.current || undefined }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok && r.status === 409) { setBusy(false); setCheck({ state: "bad", reason: "Taken — try another" }); setError(j.error || "That username was just taken — choose another and press Create again."); return; }
      // Signed up on a white-label partner's domain? Attach them to that partner.
      await fetch("/api/join", { method: "POST", headers: auth }).catch(() => {});
      // Free credits to try the AI tools, then the plan, then the one-minute setup.
      await fetch("/api/welcome", { method: "POST", headers: auth }).catch(() => {});
      try { localStorage.removeItem(INTRODUCER_KEY); localStorage.removeItem(INTRODUCER_LEG_KEY); } catch { /* ignore */ }
      router.push("/poster/plan?welcome=1");
    } else {
      setBusy(false);
      setCheckEmail(true); // email confirmation is enabled on the project
    }
  }

  if (checkEmail) {
    return (
      <div className="flex-1 grid place-items-center px-5 py-16">
        <div className="w-full max-w-sm text-center rounded-2xl border border-border bg-surface p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-ink">
            <MailCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-muted">We sent a confirmation link to <b>{email}</b>. Click it, then log in — your username <b>{username}</b> is saved with your first login.</p>
          <Link href="/login" className="mt-5 inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">
            Go to login <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand";
  const usernameBorder = check.state === "ok" ? "border-good" : check.state === "bad" ? "border-danger" : "border-border";

  return (
    <div className="flex-1 grid place-items-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><BrandLogo /></div>

        {by && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand-ink"><UserRound className="h-4 w-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-medium text-muted">Introduced by</span>
              <span className="block truncate text-sm font-bold tracking-wide">{by}</span>
            </span>
            <Lock className="h-4 w-4 text-faint" aria-label="Set by the link you opened" />
          </div>
        )}

        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="text-xl font-semibold tracking-tight">Create your Shubhora account</h1>
          <p className="text-sm text-muted mt-1">Your digital card, website and WhatsApp assistant — free to start.</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Your name</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ram Kumar" autoComplete="name" className={field} />
            </label>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Mobile number</span>
              <input type="tel" inputMode="numeric" autoComplete="tel-national" required value={mobile} onChange={(e) => onMobile(e.target.value)} placeholder="9876543210" pattern="[6-9][0-9]{9}" title="10-digit mobile number"
                className={`${field} ${taken.mobile ? "!border-danger" : ""}`} />
              <Taken what="mobile number" on={!!taken.mobile} hint={mobile.length > 0 && mobile.length < 10 ? `${10 - mobile.length} more digit${mobile.length === 9 ? "" : "s"}` : mobile.length === 10 && !mobileOk ? "An Indian mobile starts with 6, 7, 8 or 9" : ""} />
            </label>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
                className={`${field} ${taken.email ? "!border-danger" : ""}`} />
              <Taken what="email" on={!!taken.email} />
            </label>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Your username {!userTouched && username ? <span className="font-normal text-muted">— made from your name</span> : null}</span>
              <span className={`flex items-center rounded-lg border bg-surface ${usernameBorder} focus-within:border-brand`}>
                <input value={username} onChange={(e) => { setUserTouched(true); onUsername(e.target.value); }} placeholder="e.g. Yadav_Aura" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20}
                  className="w-0 min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-semibold outline-none" />
                <span className="pr-3">
                  {check.state === "checking" && <LoaderCircle className="h-4 w-4 animate-spin text-muted" />}
                  {check.state === "ok" && <Check className="h-4 w-4 text-good" />}
                  {check.state === "bad" && <X className="h-4 w-4 text-danger" />}
                </span>
              </span>
              <span className={`mt-1.5 block text-xs ${check.state === "ok" ? "text-good font-semibold" : check.state === "bad" ? "text-danger" : "text-muted"}`}>
                {check.state === "ok" ? (userTouched ? `${username} is available` : `${username} is free and ready — you log in with it. Change it if you like.`) : check.state === "bad" ? check.reason : `4–20 letters or numbers. You log in with it; it cannot be changed later.`}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block">Date of birth</span>
                <input type="date" required value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className={field} />
              </label>
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block">Gender</span>
                <select required value={gender} onChange={(e) => setGender(e.target.value)} className={field}>
                  <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Password</span>
              <span className="flex items-center rounded-lg border border-border bg-surface focus-within:border-brand">
                <input type={showPw ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password"
                  className="w-0 min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} className="inline-flex items-center gap-1 px-3 text-xs font-semibold text-brand-ink">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showPw ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-xs text-muted">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#2f4bd8]" />
              <span>I am 18 or older and I accept the <a href="/terms" target="_blank" className="font-semibold text-brand-ink underline">Terms</a>, <a href="/privacy" target="_blank" className="font-semibold text-brand-ink underline">Privacy Policy</a> and the <a href="/partners/legal/agreement" target="_blank" className="font-semibold text-brand-ink underline">Partner Agreement</a>.</span>
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            {sb ? (
              <button type="submit" disabled={busy || check.state === "checking" || !agree || !!taken.mobile || !!taken.email}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Create my account <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <Link href="/dashboard" className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">
                  Continue (demo) <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-xs text-faint">Cloud signup activates once Supabase keys are set.</p>
              </>
            )}
          </div>

          {sb && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <GoogleButton label="Continue with Google" divider={false} />
              <p className="mt-2 text-center text-[11px] text-faint">By continuing with Google you accept the <a href="/terms" target="_blank" className="underline">Terms</a>, <a href="/privacy" target="_blank" className="underline">Privacy Policy</a> and <a href="/partners/legal/agreement" target="_blank" className="underline">Partner Agreement</a>. Your username and partner ID are made at once — the introducer stays the same.</p>
            </>
          )}
        </form>
        <p className="text-center text-sm text-muted mt-5">
          Already have an account? <Link href="/login" className="text-brand-ink font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
