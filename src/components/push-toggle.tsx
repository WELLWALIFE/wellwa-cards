"use client";

// Browser notifications for the signed-in user: a one-time invite on the dashboard and an on/off switch in Settings.
// Works in Chrome/Edge/Firefox on Android and computers; on iPhone only after "Add to Home Screen" (iOS 16.4+).
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle, X } from "lucide-react";

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true; }

export function usePush() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) { setState(isIos() && !isStandalone() ? "ios-install" : "unsupported"); return; }
    if (Notification.permission === "denied") { setState("blocked"); return; }
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => { refresh().catch(() => setState("unsupported")); }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const { key } = await fetch("/api/push/key").then((r) => r.json());
      if (!key) throw new Error("Notifications are not available yet. Please try later.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not turn on notifications.");
      setState("on");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not turn on notifications."); }
    finally { setBusy(false); }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } catch { setError("Could not turn off notifications."); }
    finally { setBusy(false); }
  }, []);

  return { state, busy, error, enable, disable };
}

const DISMISS_KEY = "shubhora-push-invite-dismissed";

/** Dashboard invite: shown once per browser until turned on or dismissed. */
export function PushInvite() {
  const { state, busy, error, enable } = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setHidden(false); } }, []);
  if (hidden || (state !== "off" && state !== "ios-install")) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } };
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3">
      <Bell className="h-5 w-5 text-brand-ink shrink-0" />
      <p className="flex-1 min-w-[220px] text-sm text-ink">
        {state === "ios-install"
          ? <>To get alerts on iPhone, tap <b>Share → Add to Home Screen</b>, open Shubhora from there and turn on notifications.</>
          : <>Get an alert the moment a new lead comes in, plus follow-up reminders and a morning summary.</>}
        {error && <span className="block text-danger text-xs mt-1">{error}</span>}
      </p>
      {state === "off" && (
        <button onClick={enable} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Turn on notifications
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
    </div>
  );
}

/** Settings row: this browser's notification switch. */
export function PushSetting() {
  const { state, busy, error, enable, disable } = usePush();
  const on = state === "on";
  const text: Record<State, string> = {
    loading: "Checking…",
    unsupported: "This browser cannot show notifications. Use Chrome on Android or a computer.",
    "ios-install": "On iPhone, add Shubhora to your Home Screen first (Share → Add to Home Screen), then open it from there.",
    blocked: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
    off: "Off on this device. Turn on to get new leads, follow-ups and your morning summary.",
    on: "On for this device.",
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
      {on ? <Bell className="h-5 w-5 text-brand" /> : <BellOff className="h-5 w-5 text-muted" />}
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold">Notifications on this device</p>
        <p className="text-xs text-muted mt-0.5">{text[state]}</p>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
      {(state === "on" || state === "off") && (
        <button role="switch" aria-checked={on} onClick={on ? disable : enable} disabled={busy}
          className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brand" : "bg-border-strong"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
          <span className="sr-only">{on ? "Turn off notifications" : "Turn on notifications"}</span>
        </button>
      )}
    </div>
  );
}
