"use client";

// Locks the Super Admin panel. Two ways in:
//  1. Super-admin password (verified server-side via /api/admin/auth), kept in sessionStorage as the key every
//     admin page re-sends as x-admin-key, or
//  2. Already logged into the app with the platform-owner email — the page then sends that login's token instead.
// The gate opens ONLY when one of those two is actually in hand right now, never on a leftover "was open" flag:
// an open panel with no working credential is what made every page inside it say "unauthorized".

import { useEffect, useState } from "react";
import { ShieldCheck, Lock, LoaderCircle } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isOwnerEmail } from "@/lib/owner-emails";
import { partnerAdminUrl } from "@/lib/partner-admin-client";

const FLAG = "ne-superadmin-ok";
const KEY = "ne-admin-key";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Which account the browser is logged into — shown when it is not an owner one, because "log in as somebody
  // else and the panel still opens, empty" is impossible to guess from the outside.
  const [who, setWho] = useState("");

  useEffect(() => {
    (async () => {
      // The password, already checked once this tab session (/admin-link puts it here too).
      try {
        if (sessionStorage.getItem(KEY)) { setState("open"); return; }
      } catch { /* ignore */ }
      // Otherwise the owner must be logged in RIGHT NOW: the admin pages send that login's token, so a different
      // account (or none) means the panel would open onto nothing but errors.
      const sb = getBrowserSupabase();
      const email = sb ? (await sb.auth.getUser()).data.user?.email ?? "" : "";
      if (isOwnerEmail(email)) { setState("open"); return; }
      try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
      setWho(email);
      setState("locked");
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        try {
          sessionStorage.setItem(FLAG, "1");
          // The admin APIs (users / vault) re-send this as x-admin-key.
          sessionStorage.setItem(KEY, pw);
        } catch { /* ignore */ }
        setState("open");
      } else {
        setErr(r.status === 429 ? "wait" : "wrong");
      }
    } catch {
      setErr("wrong");
    } finally {
      setBusy(false);
    }
  }

  // "/admin?to=partners": the partner admin's login page sent the owner here to sign in with the app account —
  // as soon as the gate is open, hand them straight back into the partner admin.
  const [jumping, setJumping] = useState(false);
  useEffect(() => {
    if (state !== "open") return;
    let to = ""; try { to = new URLSearchParams(window.location.search).get("to") ?? ""; } catch { /* ignore */ }
    if (to !== "partners") return;
    setJumping(true);
    partnerAdminUrl().then((url) => { if (url) window.location.replace(url); else setJumping(false); });
  }, [state]);

  if (state === "open") return jumping
    ? <div className="min-h-screen grid place-items-center text-sm text-muted">Opening Staff Admin…</div>
    : <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: "var(--bg)" }}>
      {state === "checking" ? (
        <LoaderCircle className="h-6 w-6 animate-spin text-muted" />
      ) : (
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-float space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl text-white" style={{ background: "var(--amber)" }}>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-semibold tracking-tight">Super Admin</h1>
              <p className="text-xs text-muted">Platform owner only</p>
            </div>
          </div>
          {who && (
            <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">
              This browser is logged in as <b className="text-ink">{who}</b>, which is not an owner account. Type the
              admin password below, or log in with the owner account first.
            </p>
          )}
          <label className="block">
            <span className="text-xs font-medium text-muted">Admin password</span>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-surface overflow-hidden focus-within:ring-1 focus-within:ring-brand">
              <span className="px-3 text-faint"><Lock className="h-4 w-4" /></span>
              <input
                type="password"
                autoFocus
                className="flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setErr(""); }}
                placeholder="••••••••"
              />
            </div>
          </label>
          {err === "wrong" && <p className="text-xs text-red-500">Wrong password. Try again.</p>}
          {err === "wait" && <p className="text-xs text-amber-600">Too many attempts — try again after 15 minutes.</p>}
          <button
            type="submit"
            disabled={busy || !pw}
            className="w-full rounded-lg grad-brand py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-60"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
          <p className="text-[11px] text-faint text-center">
            Or log into the app with the owner account first — then this opens automatically.
          </p>
        </form>
      )}
    </div>
  );
}
