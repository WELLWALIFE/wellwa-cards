"use client";

// Shown while the owner is inside someone else's account through Super Admin → "Login as".
// One tap puts the owner's own session back and returns to the user list.
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export const ADMIN_RETURN_KEY = "shubhora.admin.return";
/** `access_token`/`refresh_token`/`email` are there only when the browser was logged into the app as the
 *  owner at the time. Without them the bar still shows and still walks back to the admin page — it just
 *  cannot put an owner session back, because there was none. */
type Saved = { access_token?: string; refresh_token?: string; email?: string; as?: string; back?: string };

export function AdminReturnBar() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      let s: Saved | null = null;
      try { s = JSON.parse(localStorage.getItem(ADMIN_RETURN_KEY) || "null"); } catch { s = null; }
      if (!s) return;
      const sb = getBrowserSupabase();
      const email = sb ? (await sb.auth.getUser()).data.user?.email ?? "" : "";
      // Logged out, or already back in the owner's own account: nothing to show.
      if (!email || (s.email && email.toLowerCase() === s.email.toLowerCase())) { try { localStorage.removeItem(ADMIN_RETURN_KEY); } catch { /* ignore */ } return; }
      setWho(s.as || email);
      setSaved(s);
    })();
  }, []);

  async function back() {
    if (!saved) return;
    setBusy(true);
    const to = saved.back || "/admin/users";
    // An owner session was kept: put it back, so the app is the owner's again as well.
    if (saved.access_token && saved.refresh_token) {
      const sb = getBrowserSupabase();
      const r = sb ? await sb.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token }) : null;
      try { localStorage.removeItem(ADMIN_RETURN_KEY); } catch { /* ignore */ }
      window.location.href = r && !r.error ? to : `/login?next=${encodeURIComponent(to)}`;
      return;
    }
    // Nothing was kept (Super Admin was unlocked with the password): go back to the console, which runs on
    // that password and not on this browser's app login. The app stays signed in as the customer until the
    // owner logs in again — there was never an owner session here to restore.
    try { localStorage.removeItem(ADMIN_RETURN_KEY); } catch { /* ignore */ }
    window.location.href = to;
  }

  if (!saved) return null;
  return (
    // A small pill in the top-right corner (owner's call, 2 Oct 2026): the wide bar at the foot sat on the app's
    // Home / Create / Leads tabs. The name is in the tooltip; the pill says only "← Admin".
    <button onClick={back} disabled={busy} title={`Super Admin · viewing as ${who} — back to admin`}
      className="fixed right-2 z-[100] inline-flex items-center gap-1 rounded-full bg-[#12144a] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl disabled:opacity-60"
      style={{ top: "calc(8px + env(safe-area-inset-top))" }}>
      {busy ? "…" : <>← Admin</>}
    </button>
  );
}
