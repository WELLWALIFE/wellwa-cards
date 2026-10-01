"use client";

// "Finish your setup" — stays on every screen until the free setup (profile → business → products → card → website
// → posters) is done, so a new owner who taps Back or closes the app always finds the way back to the next step.
//   variant "float"  — the phone app: a slim bar just above the bottom tabs
//   variant "banner" — the desktop dashboard: a line at the top of the page
// Closing it hides it for this visit only.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useJourney } from "@/lib/journey";

const KEY = "setup-resume-hidden";

export function SetupResume({ variant }: { variant: "float" | "banner" }) {
  const path = usePathname();
  const { freeDone, freeTotal, nextFree: firstOpen, prevFree, continueTo } = useJourney(path);
  const nextFree = continueTo ?? firstOpen;
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(sessionStorage.getItem(KEY) === "1"); } catch { setHidden(false); } }, []);

  // Not on the setup screens themselves, and not while editing a card (the editor needs the whole screen).
  // Also not on the plan page and the products page: both have their own "next" button, and two different
  // "Continue" buttons on one screen confused new owners (owner's review, 25 Sep 2026).
  // The website editor has its own Save bar in the same place (30 Sep 2026).
  const onSetupScreens = /^\/poster\/(setup|onboard|start|d\/editor|card\/build|plan|products|website\/edit|explainer\/edit|ads)/.test(path) || path === "/dashboard" || /^\/cards\/[^/]+$/.test(path);
  if (hidden || !nextFree || onSetupScreens) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ } };
  const pct = Math.round((freeDone / freeTotal) * 100);

  if (variant === "banner") {
    return (
      <div className="mb-5 rounded-xl border border-brand/30 bg-brand-soft/40 p-3">
        <div className="flex items-center gap-3">
          <Ring pct={pct} />
          <p className="min-w-0 flex-1 text-sm leading-snug"><b>Finish your setup · {freeDone}/{freeTotal}</b><span className="block truncate text-muted sm:inline"> <span className="hidden sm:inline">— </span>Next: {nextFree.title}</span></p>
          <button type="button" onClick={close} aria-label="Hide for now" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {prevFree && <Link href={prevFree.href} className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Previous</Link>}
          <Link href={nextFree.href} className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white">Continue <ChevronRight className="h-4 w-4" /></Link>
          <Link href="/poster/setup" className="w-full text-center text-xs text-muted underline sm:w-auto">All steps</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-28" aria-hidden />
      {/* pr-16 leaves the bottom-right corner to the Help button (components/poster/help-dock.tsx). */}
      <div className="fixed left-1/2 z-30 w-full max-w-md -translate-x-1/2 pl-3 pr-16" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        <div className="rounded-2xl border border-brand/30 bg-surface p-2.5 shadow-float">
          <div className="flex items-center gap-2.5">
            <Ring pct={pct} />
            <Link href={nextFree.href} className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight">Finish setup · {freeDone}/{freeTotal}</p>
              <p className="truncate text-[11.5px] text-muted leading-tight">Next: {nextFree.title}</p>
            </Link>
            <button type="button" onClick={close} aria-label="Hide for now" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 flex gap-2">
            {prevFree && (
              <Link href={prevFree.href} title={`Previous: ${prevFree.title}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold">
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            )}
            <Link href={nextFree.href} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl grad-brand px-3 py-2 text-sm font-semibold text-white">
              Continue <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 14; const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0" aria-label={`${pct}% done`}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 18 18)" />
      <text x="18" y="21.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--ink)">{pct}%</text>
    </svg>
  );
}
