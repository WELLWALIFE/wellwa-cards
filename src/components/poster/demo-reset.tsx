"use client";
// The demo account's own "Reset demo" pill (owner's call, 2 Oct 2026): after showing someone the app, one tap wipes
// the account back to fresh — cards, products, connections, setup — and opens the congratulations page, so the next
// demo starts from the very beginning with the same login. Shown only on an account Super Admin marked as demo.
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { api } from "@/lib/poster-client";

export function DemoReset() {
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getBrowserSupabase()?.auth.getUser().then(({ data }) => setDemo(data.user?.user_metadata?.is_demo === true)).catch(() => undefined);
  }, []);
  if (!demo) return null;
  async function reset() {
    if (!confirm("Reset the demo account?\n\nEverything made in it is deleted — card, website, products, connections, leads. The login stays. The app opens fresh, at the congratulations page.")) return;
    setBusy(true);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/demo/reset", { method: "POST", json: {} });
      if (!r.ok && r.status !== 207) { alert(r.data.error || "Could not reset. Try again."); setBusy(false); return; }
      // This phone's own leftovers: drafts, form backups, the hidden setup bar, the introducer.
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
      window.location.href = "/poster/welcome";
    } catch { alert("No internet — try again."); setBusy(false); }
  }
  return (
    <button type="button" onClick={reset} disabled={busy} title="Demo account — wipe everything and start fresh"
      className="fixed z-[100] inline-flex items-center gap-1 rounded-full bg-[#b91c1c] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl disabled:opacity-60"
      style={{ top: "calc(8px + env(safe-area-inset-top))", left: "max(8px, calc(50% - 14rem + 8px))" }}>
      {busy ? "Resetting…" : "🧹 Reset demo"}
    </button>
  );
}
