"use client";

// Forgot password — username, mobile number or email. Accounts with an inbox get a reset link (it opens /auth/reset);
// mobile-only accounts have no inbox, so support resets those on WhatsApp.
import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-context";
import { ArrowRight, LoaderCircle, MailCheck, MessageCircle } from "lucide-react";

const SUPPORT = "https://wa.me/917665669888?text=";

export default function ForgotPage() {
  const [ident, setIdent] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { mobileOnly: boolean }>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/login/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ident }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; mobileOnly?: boolean; error?: string };
      if (!r.ok) { setError(j.error || "Please try again."); setBusy(false); return; }
      setDone({ mobileOnly: !!j.mobileOnly });
    } catch { setError("No internet connection. Please try again."); }
    setBusy(false);
  }

  return (
    <div className="flex-1 flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8"><BrandLogo /></div>
        {done ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-ink">{done.mobileOnly ? <MessageCircle className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}</span>
            {done.mobileOnly ? (
              <>
                <h1 className="mt-4 text-xl font-semibold tracking-tight">Reset on WhatsApp</h1>
                <p className="mt-2 text-sm text-muted">This account was made with a mobile number and has no email. Message support with your username or number — they will set a new password for you.</p>
                <a href={`${SUPPORT}${encodeURIComponent(`Shubhora password reset — ${ident}`)}`} className="mt-5 inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white">WhatsApp support <ArrowRight className="h-4 w-4" /></a>
              </>
            ) : (
              <>
                <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your email</h1>
                <p className="mt-2 text-sm text-muted">If an account matches <b>{ident}</b>, a reset link is on its way. Open it on this phone or computer and choose a new password. No email? Check spam, or message support on WhatsApp.</p>
                <a href={`${SUPPORT}${encodeURIComponent(`Shubhora password reset — ${ident}`)}`} className="mt-4 inline-block text-sm font-medium text-brand-ink">WhatsApp support</a>
              </>
            )}
            <p className="mt-6 text-sm"><Link href="/login" className="font-medium text-brand-ink">Back to log in</Link></p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6">
            <h1 className="text-xl font-semibold tracking-tight">Forgot your password?</h1>
            <p className="text-sm text-muted mt-1">Tell us who you are and we will help you back in.</p>
            <label className="block mt-5">
              <span className="text-sm font-medium mb-1.5 block">Username, mobile number or email</span>
              <input type="text" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={ident} onChange={(e) => setIdent(e.target.value)}
                placeholder="sharma_kirana · 98765 43210 · you@example.com" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand" />
            </label>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Send reset link <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-center text-sm"><Link href="/login" className="font-medium text-brand-ink">Back to log in</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
