"use client";
// A tab left open across a deploy keeps running the OLD code until it is reloaded (owner, 15 Oct 2026: a button did what it did before
// the update, because the tab was never refreshed). This asks the server which release it is on, now and whenever the tab comes back
// into view; when it differs, a slim bar offers the refresh. Nothing reloads by itself, so nobody loses what they were typing.
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DEPLOY_ID } from "@/lib/deploy-id";
import { useT } from "@/lib/poster-i18n";

export function UpdateWatcher() {
  const { lang } = useT(); const hi = lang !== "en";
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!DEPLOY_ID) return;
    let alive = true;
    const check = async () => {
      try {
        // One question per minute for the whole tab, however many screens mount this (each round trip is a far one).
        const w = window as unknown as { __shDeploy?: { at: number; p: Promise<{ deploy?: string }> } };
        if (!w.__shDeploy || Date.now() - w.__shDeploy.at > 60_000) {
          w.__shDeploy = { at: Date.now(), p: fetch("/api/health", { cache: "no-store" }).then((r) => r.json() as Promise<{ deploy?: string }>) };
        }
        const j = await w.__shDeploy.p;
        if (alive && j.deploy && j.deploy !== DEPLOY_ID) setStale(true);
      } catch { /* offline: ask again later */ }
    };
    void check();
    const onShow = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    const t = setInterval(check, 5 * 60_000);
    return () => { alive = false; document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); clearInterval(t); };
  }, []);
  if (!stale) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[max(0.4rem,env(safe-area-inset-top))]">
      <button type="button" onClick={() => window.location.reload()} className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-float">
        <RefreshCw className="h-4 w-4" /> {hi ? "नया version आ गया है — दबाकर update करें" : "A new version is ready — tap to update"}
      </button>
    </div>
  );
}
