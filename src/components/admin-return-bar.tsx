"use client";

// Shown while the owner is inside someone else's account through Super Admin → "Login as".
// One tap puts the owner's own session back and returns to the user list.
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const ADMIN_RETURN_KEY = "shubhora.admin.return";
type Saved = { access_token: string; refresh_token: string; email: string; as?: string };

export function AdminReturnBar() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      let s: Saved | null = null;
      try { s = JSON.parse(localStorage.getItem(ADMIN_RETURN_KEY) || "null"); } catch { s = null; }
      if (!s?.refresh_token) return;
      const sb = getBrowserSupabase();
      const email = sb ? (await sb.auth.getUser()).data.user?.email ?? "" : "";
      // Already back in the owner's own account (or logged out): nothing to show.
      if (!email || email.toLowerCase() === s.email.toLowerCase()) { try { localStorage.removeItem(ADMIN_RETURN_KEY); } catch { /* ignore */ } return; }
      setWho(s.as || email);
      setSaved(s);
    })();
  }, []);

  async function back() {
    if (!saved) return;
    setBusy(true);
    const sb = getBrowserSupabase();
    const r = sb ? await sb.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token }) : null;
    try { localStorage.removeItem(ADMIN_RETURN_KEY); } catch { /* ignore */ }
    window.location.href = r && !r.error ? "/admin/users" : "/login?next=/admin/users";
  }

  if (!saved) return null;
  return (
    <div className="fixed bottom-3 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-full bg-[#12144a] px-4 py-2 text-xs text-white shadow-xl"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <span>Super Admin · viewing as <b>{who}</b></span>
      <button onClick={back} disabled={busy} className="rounded-full bg-white px-3 py-1 font-semibold text-[#12144a] disabled:opacity-60">
        {busy ? "…" : "← Back to admin"}
      </button>
    </div>
  );
}
