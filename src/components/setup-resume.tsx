"use client";

// "Finish your setup" — stays on every screen until the free setup (profile → business → V-Card → website → products
// → posters) is done, so a new owner who taps Back or closes the app always finds the way back to the next step.
//   variant "float"  — the phone app: a slim bar just above the bottom tabs
//   variant "banner" — the desktop dashboard: a line at the top of the page
// Closing it hides it for this visit only.
// Previous = the screen the owner was just on (lib/nav-back); only when the app has no earlier screen does it use the journey's
// previous step. Continue = the next unfinished step, never the screen the owner is on, never the same page as Previous
// (owner, 15 Oct 2026: both buttons used to open Products on the Card & Website screen). When the screen the owner just came from IS
// the page Continue opens, Previous is left out: one button for one page.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useJourney } from "@/lib/journey";
import { canGoBackInApp, goBack, useNavTracker } from "@/lib/nav-back";
import { useT } from "@/lib/poster-i18n";

const KEY = "setup-resume-hidden";

export function SetupResume({ variant }: { variant: "float" | "banner" }) {
  const path = usePathname();
  const router = useRouter();
  const { lang } = useT();
  // The phone app follows the app language; the desktop dashboard around the banner is English-only and has no language switch.
  const hi = variant === "float" && lang === "hi";
  const T = (en: string, h: string) => (hi ? h : en);
  // The dashboard layout has no move counter of its own: without it Previous could not tell "an earlier screen" from "none".
  useNavTracker();
  const { freeDone, freeTotal, nextFree, prevFree, continueTo, continueHref } = useJourney(path);
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(sessionStorage.getItem(KEY) === "1"); } catch { setHidden(false); } }, []);
  // The page the owner was on before this one, when they got here by a forward move (a tap): Previous then opens exactly that page.
  // After a browser Back the earlier screen is not known, so nothing is assumed ("").
  const [cameFrom, setCameFrom] = useState("");
  const last = useRef(path);
  const popped = useRef(false);
  useEffect(() => {
    const onPop = () => { if (window.location.pathname !== last.current) popped.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useLayoutEffect(() => {   // layout effect: Previous is decided before the screen is painted, so it never flashes
    if (last.current === path) return;
    setCameFrom(popped.current ? "" : last.current);
    popped.current = false;
    last.current = path;
  }, [path]);

  // Not on the setup screens themselves, and not while editing a card (the editor needs the whole screen).
  // Also not on the plan page and the products page: both have their own "next" button, and two different
  // "Continue" buttons on one screen confused new owners (owner's review, 25 Sep 2026).
  // The website editor has its own Save bar in the same place (30 Sep 2026).
  // The Business screens (/poster/business and every page under it): the bar sat over their buttons and lists (14 Oct 2026).
  const onSetupScreens = /^\/poster\/(welcome|setup|onboard|start|d\/editor|card\/build|plan|products|website\/edit|explainer\/edit|ads)(\/|$)/.test(path) || /^\/poster\/business(\/|$)/.test(path) || path === "/dashboard" || /^\/cards\/[^/]+$/.test(path);
  // The Home screen of a brand-new account has its own one big button ("Make my website"): a second "Continue" bar made two buttons for one job.
  if (path === "/poster" && freeDone === 0) return null;
  if (hidden || !nextFree || onSetupScreens) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ } };
  const pct = Math.round((freeDone / freeTotal) * 100);

  // What "Next:" names, and where the title and Continue go. The exact set-up screen the owner left wins (owner's call, 7 Oct 2026);
  // when the only unfinished step is on the very screen the owner is on there is no Continue, and the title opens the list.
  const nextStep = continueTo ?? nextFree;
  const nextTitle = hi ? nextStep.titleHi : nextStep.title;
  const goTo = continueHref ?? "/poster/setup";
  // Previous: the screen the owner was just on. With no earlier screen in the app it falls back to the journey's previous step, else
  // Home (the banner: the dashboard) — and never to the page Continue opens. Home itself is the root: nothing comes before it.
  const home = variant === "banner" ? "/dashboard" : "/poster";
  const fallbackRaw = path === "/poster" ? null : prevFree?.href ?? home;
  const fallback = fallbackRaw && fallbackRaw.split("?")[0] !== goTo.split("?")[0] ? fallbackRaw : null;
  // Came from the very page Continue opens: Previous would open it too, so only Continue is shown.
  const samePage = !!continueHref && cameFrom !== "" && cameFrom === continueHref.split("?")[0];
  const showPrevious = !samePage && (canGoBackInApp() || !!fallback);
  const previous = () => goBack(router, fallback ?? home);

  if (variant === "banner") {
    return (
      <div className="mb-5 rounded-xl border border-brand/30 bg-brand-soft/40 p-3">
        <div className="flex items-center gap-3">
          <Ring pct={pct} label={T("done", "पूरा")} />
          <p className="min-w-0 flex-1 text-sm leading-snug"><b>{T("Finish your setup", "Setup पूरा करें")} · {freeDone}/{freeTotal}</b><span className="block truncate text-muted sm:inline"> <span className="hidden sm:inline">— </span>{T("Next", "अगला")}: {nextTitle}</span></p>
          <button type="button" onClick={close} aria-label={T("Hide for now", "अभी छिपाएँ")} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {showPrevious && <button type="button" onClick={previous} className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> {T("Previous", "पीछे")}</button>}
          {continueHref && <Link href={continueHref} className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white">{T("Continue", "आगे बढ़ें")} <ChevronRight className="h-4 w-4" /></Link>}
          <Link href="/poster/setup" className="w-full text-center text-xs text-muted underline sm:w-auto">{T("All steps", "सारे steps")}</Link>
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
            <Ring pct={pct} label={T("done", "पूरा")} />
            <Link href={goTo} className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight">{T("Finish setup", "Setup पूरा करें")} · {freeDone}/{freeTotal}</p>
              <p className="truncate text-[11.5px] text-muted leading-tight">{T("Next", "अगला")}: {nextTitle}</p>
            </Link>
            <button type="button" onClick={close} aria-label={T("Hide for now", "अभी छिपाएँ")} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface2"><X className="h-4 w-4" /></button>
          </div>
          {(showPrevious || continueHref) && (
            <div className="mt-2 flex gap-2">
              {showPrevious && (
                <button type="button" onClick={previous} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold">
                  <ChevronLeft className="h-4 w-4" /> {T("Previous", "पीछे")}
                </button>
              )}
              {continueHref && (
                <Link href={continueHref} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl grad-brand px-3 py-2 text-sm font-semibold text-white">
                  {T("Continue", "आगे बढ़ें")} <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 14; const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0" aria-label={`${pct}% ${label}`}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 18 18)" />
      <text x="18" y="21.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--ink)">{pct}%</text>
    </svg>
  );
}
