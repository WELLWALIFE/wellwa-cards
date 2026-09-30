"use client";
// "Install app" — the website installed as the Shubhora app (PWA). Owner's call, 24 Sep 2026: this replaces the APK.
// Chrome / Edge / Samsung Internet (Android, computer): one tap opens the browser's own install box.
// iPhone / iPad: Apple has no install button for sites — the steps for "Add to Home Screen" are shown instead.
// Opened inside WhatsApp / Instagram / Facebook: those browsers cannot install — "open in Chrome" with a copy button.
// Already installed (or running as the app): the button says so / hides.
import { useEffect, useState } from "react";
import { Check, Copy, Download, Share, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __bip?: BIP | null } }

type Env = "prompt" | "installed" | "ios" | "inapp" | "manual";

function detect(): Env {
  if (typeof window === "undefined") return "manual";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  try { if (localStorage.getItem("shubhora.installed") === "1") return "installed"; } catch { /* ignore */ }
  if (window.__bip) return "prompt";
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)) return "ios";
  return "manual";
}

export function useInstall() {
  const [env, setEnv] = useState<Env>("manual");
  useEffect(() => {
    const update = () => setEnv(detect());
    update();
    const onReady = () => setEnv("prompt");
    const onInstalled = () => { try { localStorage.setItem("shubhora.installed", "1"); } catch { /* ignore */ } window.__bip = null; setEnv("installed"); };
    window.addEventListener("bip-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    // The service worker makes the site installable everywhere and carries the lead notifications.
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration("/").then((r) => { if (!r) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }).catch(() => undefined);
    return () => { window.removeEventListener("bip-ready", onReady); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  async function install(): Promise<"done" | "help"> {
    const e = window.__bip;
    if (!e) return "help";
    await e.prompt();
    const r = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    window.__bip = null;
    if (r.outcome === "accepted") { try { localStorage.setItem("shubhora.installed", "1"); } catch { /* ignore */ } setEnv("installed"); return "done"; }
    setEnv(detect());
    return "help";
  }
  return { env, install };
}

/** The steps for browsers without the one-tap install (iPhone, in-app browsers, others). */
export function InstallHelp({ env, onClose }: { env: Env; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/poster` : "https://shubhora.com/poster";
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-surface p-5 space-y-3 text-sm text-ink" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <p className="flex items-center gap-2 text-base font-bold"><img src="/icons/app-192.png" alt="" className="h-8 w-8 rounded-lg" /> Install Shubhora</p>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-surface2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {env === "ios" && (
          <ol className="space-y-2">
            <li>1. Open <b>shubhora.com</b> in <b>Safari</b>.</li>
            <li>2. Tap the <Share className="inline h-4 w-4 align-text-bottom" /> <b>Share</b> button (bottom of the screen).</li>
            <li>3. Scroll and tap <b>Add to Home Screen</b> → <b>Add</b>.</li>
            <li className="text-muted">The Shubhora icon appears on your home screen and opens full-screen, like any app.</li>
          </ol>
        )}
        {env === "inapp" && (
          <>
            <p>This page is open inside another app (WhatsApp / Instagram / Facebook), which cannot install apps.</p>
            <ol className="space-y-2">
              <li>1. Tap <b>⋮</b> (top right) → <b>Open in Chrome</b> (or <b>Open in browser</b>).</li>
              <li>2. Tap <b>Install app</b> there.</li>
            </ol>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* ignore */ } }} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
              {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? "Link copied — paste it in Chrome" : "Copy link to open in Chrome"}
            </button>
          </>
        )}
        {env === "manual" && (
          <ol className="space-y-2">
            <li>1. Open <b>shubhora.com</b> in <b>Chrome</b>.</li>
            <li>2. Tap the <b>⋮</b> menu (top right).</li>
            <li>3. Tap <b>Install app</b> (or <b>Add to Home screen</b>) → <b>Install</b>.</li>
            <li className="text-muted">On a computer: the install icon ⊕ at the right end of Chrome&apos;s address bar.</li>
          </ol>
        )}
        {env === "installed" && <p>Shubhora is already installed on this device — open it from your home screen or app list.</p>}
        <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">No download, no Play Store — it updates itself, always the latest version.</p>
      </div>
    </div>
  );
}

/** The install button. `variant`: "nav" (header), "hero" (big, the /app page), "card" (inside the app, Me tab). */
export function InstallAppButton({ variant = "nav", className = "" }: { variant?: "nav" | "navMobile" | "hero" | "card"; className?: string }) {
  const { env, install } = useInstall();
  const [help, setHelp] = useState(false);
  async function click() { if ((await install()) === "help") setHelp(true); }

  if (variant === "card" && env === "installed") return null;
  const label = env === "installed" ? "App installed" : "Install app";
  const cls =
    variant === "hero" ? "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-lg font-semibold text-white hover:opacity-90"
    : variant === "navMobile" ? "inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white"
    : variant === "card" ? "flex w-full items-center justify-between rounded-2xl border border-brand/40 bg-brand-soft/40 p-4 text-left"
    : "inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft/70";
  return (
    <>
      <button type="button" onClick={env === "installed" ? () => setHelp(true) : click} className={`${cls} ${className}`}>
        {variant === "card" ? (
          <>
            <span className="min-w-0">
              <span className="block text-base font-bold">Install the Shubhora app</span>
              <span className="block text-xs text-muted">One tap — on your home screen, full screen, always the latest</span>
            </span>
            <Download className="h-5 w-5 shrink-0 text-brand" />
          </>
        ) : (
          <>{env === "installed" ? <Check className={variant === "hero" ? "h-5 w-5" : "h-4 w-4"} /> : <Download className={variant === "hero" ? "h-5 w-5" : variant === "navMobile" ? "h-3.5 w-3.5" : "h-4 w-4"} />} {variant === "navMobile" ? (env === "installed" ? "App" : "Install") : label}</>
        )}
      </button>
      {help && <InstallHelp env={env} onClose={() => setHelp(false)} />}
    </>
  );
}
