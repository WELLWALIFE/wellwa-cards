import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone, Share, Bell, Zap, ShieldCheck, RefreshCw, Monitor } from "lucide-react";
import { pageMeta } from "@/lib/site-brand";
import { InstallAppButton } from "@/components/install-app";

export const metadata: Metadata = pageMeta("/app", {
  title: "Install the Shubhora app — one tap, no download",
  description: "Install Shubhora on your phone or computer in one tap: your card, posters, leads and team, full-screen, always the latest version.",
});

// The app page (owner's call, 24 Sep 2026): the APK is gone — Shubhora installs straight from the browser (PWA).
export default function AppPage() {
  return (
    <div>
      <section className="max-w-6xl mx-auto px-5 py-14 md:py-20">
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
          <div>
            <span className="text-xs mono uppercase tracking-wide text-faint">Shubhora on your phone</span>
            <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-balance">One tap to your card, posters, leads and team.</h1>
            <p className="mt-5 text-lg text-muted leading-relaxed">Install Shubhora straight from this page — no Play Store, no file to download. It sits on your home screen with its own icon, opens full-screen and is always the latest version.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 items-start">
              <InstallAppButton variant="hero" />
              <a href="#iphone" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-4 text-base font-semibold hover:bg-surface2">
                <Smartphone className="h-5 w-5" /> iPhone steps
              </a>
            </div>
            <p className="mt-3 text-xs text-muted">Free · works on Android, iPhone and computers · about 1 MB on your phone.</p>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl border border-border bg-surface p-4"><Zap className="h-5 w-5 text-brand" /><p className="mt-2 font-semibold">One tap</p><p className="mt-1 text-muted">No download, no “unknown apps” warning.</p></div>
              <div className="rounded-xl border border-border bg-surface p-4"><RefreshCw className="h-5 w-5 text-brand" /><p className="mt-2 font-semibold">Always latest</p><p className="mt-1 text-muted">Updates by itself — never install again.</p></div>
              <div className="rounded-xl border border-border bg-surface p-4"><Bell className="h-5 w-5 text-brand" /><p className="mt-2 font-semibold">Lead alerts</p><p className="mt-1 text-muted">A notification when a customer reaches out.</p></div>
              <div className="rounded-xl border border-border bg-surface p-4"><ShieldCheck className="h-5 w-5 text-brand" /><p className="mt-2 font-semibold">Same account</p><p className="mt-1 text-muted">Card, posters, CRM and the User Panel.</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <p className="text-sm font-semibold">Android (Chrome)</p>
            <ol className="mt-3 space-y-3 text-sm text-muted">
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">1</span><span>Tap <b className="text-ink">Install app</b> on this page.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">2</span><span>Tap <b className="text-ink">Install</b> in the box that opens. The Shubhora icon appears with your other apps.</span></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">3</span><span>Open it and log in once — you stay logged in.</span></li>
            </ol>
            <p className="mt-3 text-xs text-muted">No Install box? Chrome menu <b>⋮</b> → <b>Install app</b> (or <b>Add to Home screen</b>). Opened from WhatsApp? Tap <b>⋮</b> → <b>Open in Chrome</b> first.</p>
            <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-ink"><b>Had the old downloaded (APK) Shubhora app?</b> Uninstall it (long-press the icon → Uninstall) and install from here — this one has the new look and updates itself.</p>
            <div id="iphone" className="mt-8 border-t border-border pt-6">
              <p className="text-sm font-semibold">iPhone / iPad (Safari)</p>
              <ol className="mt-3 space-y-3 text-sm text-muted">
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">1</span><span>Open <b className="text-ink">shubhora.com</b> in <b className="text-ink">Safari</b>.</span></li>
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">2</span><span>Tap the <Share className="inline h-4 w-4 align-text-bottom" /> <b className="text-ink">Share</b> button at the bottom.</span></li>
                <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">3</span><span>Choose <b className="text-ink">Add to Home Screen</b> → <b className="text-ink">Add</b>.</span></li>
              </ol>
            </div>
            <div className="mt-8 border-t border-border pt-6">
              <p className="text-sm font-semibold flex items-center gap-2"><Monitor className="h-4 w-4" /> Computer</p>
              <p className="mt-2 text-sm text-muted">Chrome or Edge: <b className="text-ink">Install app</b> above, or the ⊕ install icon at the right of the address bar.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/poster" className="rounded-lg border border-border px-3.5 py-2 font-medium hover:bg-surface2">Use it in the browser instead</Link>
              <Link href="/signup" className="rounded-lg bg-brand-soft px-3.5 py-2 font-medium text-brand-ink">New here? Start free</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
