"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, isLoggedIn } from "@/lib/poster-client";

// When the page runs inside the Capacitor WebView (the Android app), wire the
// hardware back button to in-app navigation, hide the splash once React is
// up, tint the status bar, and register the device for the daily push. In a
// normal browser `window.Capacitor` is absent and this does nothing.
type Sub = { remove?: () => void } | undefined;
type Cap = { isNativePlatform?: () => boolean; Plugins?: Record<string, { addListener?: (e: string, cb: (d: { canGoBack: boolean }) => void) => unknown; hide?: () => Promise<void>; exitApp?: () => Promise<void>; setBackgroundColor?: (o: { color: string }) => Promise<void>; setStyle?: (o: { style: string }) => Promise<void> }> };

// The slice of @capacitor/push-notifications we use. Typed by hand so the
// web build never has to resolve the package (it only exists in the app).
type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  createChannel?: (c: { id: string; name: string; description?: string; importance?: number; visibility?: number }) => Promise<void>;
  addListener: (event: string, cb: (payload: unknown) => void) => Promise<Sub> | Sub;
};
type PushEventUrl = { notification?: { data?: { url?: string } } };

async function loadPush(cap: Cap): Promise<PushPlugin | null> {
  // With a remote server.url the native plugins are exposed on window.Capacitor.Plugins.
  const fromWindow = (cap.Plugins as Record<string, unknown> | undefined)?.PushNotifications as PushPlugin | undefined;
  if (fromWindow?.register) return fromWindow;
  try {
    // Variable specifier: the bundler leaves this alone and it only runs inside the app.
    const mod = "@capacitor/push-notifications";
    const m = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ mod)) as { PushNotifications?: PushPlugin };
    return m?.PushNotifications ?? null;
  } catch { return null; }
}

const REG_KEY = "akp-push-token";

async function setupPush(cap: Cap, go: (url: string) => void): Promise<Sub[]> {
  const subs: Sub[] = [];
  try {
    const push = await loadPush(cap);
    if (!push) return subs;
    const perm = await push.checkPermissions().catch(() => ({ receive: "prompt" }));
    const state = perm.receive === "granted" ? perm : await push.requestPermissions().catch(() => ({ receive: "denied" }));
    if (state.receive !== "granted") return subs;
    await push.createChannel?.({ id: "daily", name: "Daily poster", description: "Aaj ka poster taiyaar hai", importance: 4, visibility: 1 }).catch(() => {});
    subs.push(await push.addListener("registration", async (t) => {
      try {
        const token = (t as { value?: string })?.value;
        if (!token || !(await isLoggedIn())) return;
        let lang = "hi";
        try { lang = localStorage.getItem("akp-ui-lang") ?? "hi"; } catch { /* ignore */ }
        const r = await api("/api/poster/devices", { method: "POST", json: { token, platform: "android", lang } });
        if (r.ok) { try { localStorage.setItem(REG_KEY, token); } catch { /* ignore */ } }
      } catch { /* ignore */ }
    }));
    subs.push(await push.addListener("registrationError", (e) => { console.warn("[push] registration failed", e); }));
    subs.push(await push.addListener("pushNotificationActionPerformed", (ev) => {
      const url = (ev as PushEventUrl)?.notification?.data?.url;
      go(typeof url === "string" && url.startsWith("/") ? url : "/poster");
    }));
    await push.register();
  } catch (e) { console.warn("[push] setup skipped", e); }
  return subs;
}

export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const P = cap.Plugins ?? {};
    P.SplashScreen?.hide?.().catch(() => {});
    P.StatusBar?.setBackgroundColor?.({ color: "#0e9e90" }).catch(() => {});
    P.StatusBar?.setStyle?.({ style: "DARK" }).catch(() => {});
    const sub = P.App?.addListener?.("backButton", () => {
      if (window.location.pathname === "/poster" || window.location.pathname === "/poster/") P.App?.exitApp?.();
      else if (window.history.length > 1) router.back();
      else router.push("/poster");
    });
    return () => { (sub as Sub)?.remove?.(); };
  }, [router, pathname]);

  // Push registration: once per mount of the shell, not on every route change.
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    let subs: Sub[] = [];
    let alive = true;
    setupPush(cap, (url) => router.push(url)).then((s) => { if (alive) subs = s; else s.forEach((x) => x?.remove?.()); });
    return () => { alive = false; subs.forEach((x) => x?.remove?.()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
