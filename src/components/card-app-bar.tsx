"use client";
// A way back when the card is showing inside the installed Shubhora app (PWA, standalone): Android opens shubhora.com
// links in the installed app, which has no browser back button, and reopens on the last page — so a card opened once
// stayed on the screen (owner's report, 30 Sep 2026). In a browser tab, or inside the app's own card sheet (an iframe),
// nothing is drawn.
import { useEffect, useState } from "react";

export function CardAppBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setShow(standalone && window.top === window.self);
    } catch { /* ignore */ }
  }, []);
  if (!show) return null;
  const back = () => {
    // came here from an app screen → back to it; opened from outside (a WhatsApp link) → the app's home
    try { const ref = document.referrer; if (window.history.length > 1 && ref && new URL(ref).origin === location.origin && !/\/c\//.test(new URL(ref).pathname)) { history.back(); return; } } catch { /* ignore */ }
    location.href = "/poster";
  };
  return (
    <div className="sticky top-0 z-[90] flex items-center justify-between bg-[#12144a] px-3 py-2 text-white" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      <button type="button" onClick={back} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">‹ Shubhora App</button>
      <span className="text-xs text-white/70">Card preview</span>
    </div>
  );
}
