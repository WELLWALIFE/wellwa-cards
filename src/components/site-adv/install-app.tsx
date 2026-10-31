"use client";
// "Get our app" on a Premium website (owner, 31 Oct 2026: "Premium mein app ka option — site se download kar sake"): the website installed
// on the customer's phone as the business's own app, from the site itself — no Play Store. Chrome / Edge / Samsung (Android, computer): the
// browser's own install box (the page carries the business's manifest, see app/c/[username]/manifest.webmanifest). iPhone: Apple has no
// install button, the "Add to Home Screen" steps are shown. Opened inside WhatsApp / Instagram: "open in Chrome" with a copy button.
// Already installed / running as the app: nothing is shown.
import { useEffect, useState } from "react";
import { Check, Copy, Download, Share, Smartphone, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __bip?: BIP | null } }
type Env = "prompt" | "installed" | "ios" | "inapp" | "manual";

function detect(): Env {
  if (typeof window === "undefined") return "manual";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (window.__bip) return "prompt";
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document)) return "ios";
  return "manual";
}

export function InstallSiteApp({ name, hi, accent, onTrack }: { name: string; hi: boolean; accent: string; onTrack?: (k: string) => void }) {
  const [env, setEnv] = useState<Env>("manual");
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const update = () => setEnv(detect());
    update();
    const onReady = () => setEnv("prompt");
    const onInstalled = () => { window.__bip = null; setEnv("installed"); };
    window.addEventListener("bip-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    // A service worker makes the site installable on every Chrome (the app's own worker, scope /, covers /c/… too).
    if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistration("/").then((r) => { if (!r) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }).catch(() => undefined);
    return () => { window.removeEventListener("bip-ready", onReady); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (env === "installed") return null;
  const T = (en: string, h: string) => (hi ? h : en);
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?view=site` : "";
  async function tap() {
    onTrack?.("install-app");
    const e = window.__bip;
    if (e) {
      await e.prompt();
      const r = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      window.__bip = null;
      if (r.outcome === "accepted") { setEnv("installed"); return; }
      setEnv(detect());
      return;
    }
    setHelp(true);
  }
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  return (
    <>
      <div className="adv-app" style={{ ["--app-accent" as string]: accent }}>
        <div className="adv-app-in">
          <span className="adv-app-ic" aria-hidden="true"><Smartphone size={20} /></span>
          <span className="adv-app-txt">
            <b>{T(`Get the ${name} app`, `${name} का app लें`)}</b>
            <small>{T("Install from here in one tap — no Play Store. Opens from your home screen.", "यहीं से एक tap में install — Play Store नहीं चाहिए। home screen से खुलेगा।")}</small>
          </span>
          <button type="button" onClick={tap} className="adv-app-btn"><Download size={16} /> {T("Install app", "App install करें")}</button>
        </div>
      </div>
      {help && (
        <div className="adv-app-help" onClick={() => setHelp(false)} role="dialog" aria-modal="true">
          <div className="adv-app-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="adv-app-head"><b>{T(`Add ${name} to your home screen`, `${name} को home screen पर लगाएँ`)}</b><button type="button" onClick={() => setHelp(false)} aria-label={T("Close", "बंद करें")}><X size={18} /></button></div>
            {env === "ios" ? (
              <ol>
                <li>{T("Tap the Share button", "नीचे Share button दबाएँ")} <Share size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> {T("at the bottom of Safari.", "(Safari में)।")}</li>
                <li>{T("Scroll and tap \"Add to Home Screen\".", "नीचे जाकर \"Add to Home Screen\" दबाएँ।")}</li>
                <li>{T("Tap Add. The app is on your home screen.", "Add दबाएँ। App home screen पर आ गया।")}</li>
              </ol>
            ) : env === "inapp" ? (
              <>
                <p>{T("This browser (inside WhatsApp / Instagram) cannot install apps. Open the link in Chrome, then tap Install app.", "ये browser (WhatsApp / Instagram के अंदर) app install नहीं कर सकता। link Chrome में खोलें, फिर Install app दबाएँ।")}</p>
                <button type="button" onClick={copy} className="adv-app-btn">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? T("Copied", "Copy हो गया") : T("Copy link", "Link copy करें")}</button>
              </>
            ) : (
              <ol>
                <li>{T("Open the browser menu (⋮ at the top right).", "Browser का menu खोलें (ऊपर दाएँ ⋮)।")}</li>
                <li>{T("Tap \"Install app\" or \"Add to Home screen\".", "\"Install app\" या \"Add to Home screen\" दबाएँ।")}</li>
                <li>{T("Confirm. The app is on your home screen.", "Confirm करें। App home screen पर आ गया।")}</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export const INSTALL_APP_CSS = `
.adv-app{padding:14px 20px;background:var(--app-accent);color:#fff}
.adv-app-in{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.adv-app-ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.18);flex:none}
.adv-app-txt{flex:1;min-width:200px;display:flex;flex-direction:column;gap:2px;line-height:1.3}
.adv-app-txt b{font-size:15px;font-weight:700}.adv-app-txt small{font-size:12px;opacity:.9}
.adv-app-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;background:#fff;color:#111;font-weight:700;font-size:13px;border:0;cursor:pointer}
.adv-app-help{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:640px){.adv-app-help{align-items:center;padding:16px}}
.adv-app-sheet{width:100%;max-width:440px;background:#fff;color:#111;border-radius:24px 24px 0 0;padding:20px 20px max(20px,env(safe-area-inset-bottom));font-size:14px;line-height:1.5}
@media(min-width:640px){.adv-app-sheet{border-radius:24px}}
.adv-app-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:16px}
.adv-app-head button{border:0;background:#f1f3f8;border-radius:10px;padding:6px;cursor:pointer;color:#111}
.adv-app-sheet ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}
.adv-app-sheet p{margin:0 0 10px}
.adv-app-sheet .adv-app-btn{background:var(--app-accent,#2f5bf5);color:#fff}
`;
