"use client";
// The demo account's own "Reset demo" pill (owner's call, 2 Oct 2026): after showing someone the app, one tap wipes
// the account back to fresh — cards, products, connections, setup — and opens the congratulations page, so the next
// demo starts from the very beginning with the same login. Shown only on an account Super Admin marked as demo.
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { announceLocalReset } from "@/lib/local-reset";

export function DemoReset() {
  const { lang } = useT();
  const T = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(""); // what went wrong, shown right under the pill (not in a pop-up)
  useEffect(() => {
    getBrowserSupabase()?.auth.getUser().then(({ data }) => setDemo(data.user?.user_metadata?.is_demo === true)).catch(() => undefined);
  }, []);
  if (!demo) return null;
  async function reset() {
    if (!confirm(T(
      "Reset the demo account?\n\nEverything made in it is deleted — card, website, products, connections, leads. The login stays. The app opens fresh, at the congratulations page.",
      "Demo account reset करें?\n\nइसमें बना सब कुछ मिट जाएगा — card, website, products, connections, leads। Login रहेगा। App नए सिरे से, बधाई वाले page पर खुलेगा।",
    ))) return;
    setBusy(true); setNote("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/demo/reset", { method: "POST", json: {} });
      if (!r.ok && r.status !== 207) { setNote(r.data.error || T("Could not reset. Try again.", "Reset नहीं हो पाया। दोबारा try करें।")); setBusy(false); return; }
      if (r.status === 207) setNote(T("Most of it was cleared, but a few parts could not be. If old things still show, press Reset again.", "ज़्यादातर साफ़ हो गया, पर कुछ हिस्से नहीं हो पाए। पुरानी चीज़ें दिखें तो Reset फिर दबाएँ।"));
      // A set-up screen that is open stops writing its draft first (its page-hide save put the OLD answers back right after
      // the clear below), and every other tab of this phone reloads.
      announceLocalReset();
      // This phone's own leftovers: drafts, form backups, the hidden setup bar, the introducer. Anything a screen still
      // writes after this is dropped again by the next page (the account carries a new "cleared" stamp: lib/local-reset.ts).
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
      window.location.replace("/poster/welcome");
    } catch { setNote(T("No internet — try again.", "Internet नहीं है — दोबारा try करें।")); setBusy(false); }
  }
  return (
    <>
    <button type="button" onClick={reset} disabled={busy} title={T("Demo account — wipe everything and start fresh", "Demo account — सब मिटाकर नए सिरे से शुरू करें")}
      className="app-pin fixed z-[100] inline-flex items-center gap-1 rounded-full bg-[#b91c1c] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl disabled:opacity-60"
      style={{ top: "calc(8px + env(safe-area-inset-top))", left: "max(8px, calc(50% - 14rem + 8px))" }}>
      {busy ? T("Resetting…", "Reset हो रहा है…") : T("🧹 Reset demo", "🧹 Demo reset")}
    </button>
    {note && (
      <p role="alert" className="app-pin fixed z-[100] max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger shadow-xl"
        style={{ top: "calc(40px + env(safe-area-inset-top))", left: "max(8px, calc(50% - 14rem + 8px))" }}>{note}</p>
    )}
    </>
  );
}
