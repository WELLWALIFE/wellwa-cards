"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { SITE_HOST } from "@/lib/site-url";

// "Continue with Google". On shubhora.com it is Google's own button (Google Identity Services): the Google popup then
// says "Sign in to Shubhora" instead of showing the Supabase server address, and the ID token is handed to Supabase.
// On any other host (white-label, local) it falls back to the redirect flow. Shown only when the Google provider is on
// in Supabase (checked live, so turning it on there is enough — no rebuild).
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "906291434331-ba23gt4eefd00ktl4e752gt80jqhj0v6.apps.googleusercontent.com";

type Gsi = {
  accounts: { id: {
    initialize: (o: Record<string, unknown>) => void;
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  } };
};
declare global { interface Window { google?: Gsi } }

let enabled: Promise<boolean> | null = null;
function googleEnabled(): Promise<boolean> {
  if (!enabled) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    enabled = url && key
      ? fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json()).then((j) => !!j?.external?.google).catch(() => false)
      : Promise.resolve(false);
  }
  return enabled;
}

let gsi: Promise<Gsi | null> | null = null;
function loadGsi(): Promise<Gsi | null> {
  if (!gsi) gsi = new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
    sc.onload = () => resolve(window.google ?? null);
    sc.onerror = () => resolve(null);
    document.head.appendChild(sc);
  });
  return gsi;
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function GoogleButton({ label = "Continue with Google", divider = true }: { label?: string; divider?: boolean }) {
  const sb = getBrowserSupabase();
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [native, setNative] = useState<boolean | null>(null);   // Google's own button rendered?
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { googleEnabled().then(setOn); }, []);

  useEffect(() => {
    if (!on || !sb) return;
    if (window.location.hostname !== SITE_HOST) { setNative(false); return; }
    let cancelled = false;
    (async () => {
      const g = await loadGsi();
      if (cancelled) return;
      if (!g || !box.current) { setNative(false); return; }
      const raw = crypto.randomUUID() + crypto.randomUUID();
      const hashed = await sha256Hex(raw);
      g.accounts.id.initialize({
        client_id: CLIENT_ID, nonce: hashed, ux_mode: "popup", context: label.startsWith("Sign up") ? "signup" : "signin",
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return;
          setBusy(true); setErr("");
          const { error } = await sb.auth.signInWithIdToken({ provider: "google", token: resp.credential, nonce: raw });
          if (error) { setBusy(false); setErr(error.message); return; }
          // Same landing as the redirect flow: welcome for new accounts, then setup or the app.
          router.push("/auth/start");
        },
      });
      box.current.replaceChildren();                // render once, even if the effect runs again
      const width = Math.min(400, Math.max(200, box.current.offsetWidth || 320));
      g.accounts.id.renderButton(box.current, { type: "standard", theme: "outline", size: "large", shape: "rectangular", logo_alignment: "center", text: label.startsWith("Sign up") ? "signup_with" : "signin_with", width });
      setNative(true);
    })();
    return () => { cancelled = true; };
  }, [on, sb, label, router]);

  if (!sb || !on) return null;

  async function redirect() {
    setErr("");
    // /auth/start gives new accounts their welcome (credits + email) and opens the setup; others go to the app.
    const { error } = await sb!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/start` },
    });
    if (error) setErr(error.message);
  }

  return (
    <div className="space-y-2">
      <div ref={box} className={`w-full flex justify-center min-h-[44px] ${native === false ? "hidden" : ""}`} />
      {native === false && (
        <button type="button" onClick={redirect}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface2">
          <GoogleIcon /> {label}
        </button>
      )}
      {busy && <p className="text-xs text-muted text-center">Signing you in…</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
      {divider && <div className="flex items-center gap-3 !my-4"><span className="h-px flex-1 bg-border" /><span className="text-xs text-faint">or</span><span className="h-px flex-1 bg-border" /></div>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c11 0 19.5-8 19.5-19.5 0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.9l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.7-2 13.1-5.2l-6.1-5c-1.9 1.4-4.3 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4.1 5.3l6.1 5C40.9 35.5 43.5 30.3 43.5 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
