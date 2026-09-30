"use client";
// A "← Back" row at the top of every app page that is not one of the five main tabs (owner's call, 24 Sep 2026:
// "many pages have no back button — people get stuck"). Pages that already draw their own back arrow are skipped,
// so there is never a double arrow. Back = the previous screen when there is one inside the app, else the page's
// natural parent (a link opened fresh from WhatsApp still has somewhere to go).
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

/** The five tabs of the bottom menu (and "Me") — their own home, no back row. */
const TAB_ROOTS = /^\/poster(\/(create|leads|business|more|settings))?\/?$/;
/** Full-screen steps, and pages that already have their own back arrow in their heading. */
const OWN_BACK = /^\/poster\/(start|onboard|brand|explainer|plan|products|reel|website|guide|d\/|text-video|card\/build)/;

/** Where "Back" goes when there is no earlier screen in this tab. */
function parentOf(p: string): string {
  if (p.startsWith("/poster/card/")) return "/poster/card";
  if (/^\/poster\/(card|video|calendar|testimonials|photoshoot|social|report)/.test(p)) return "/poster/create";
  if (/^\/poster\/(profiles|setup|connect)/.test(p)) return "/poster/more";
  if (p.startsWith("/poster/learn")) return "/poster/leads";
  if (p.startsWith("/poster/share")) return "/poster";
  return "/poster";
}

export function BackBar() {
  const p = usePathname() || "";
  const router = useRouter();
  const { lang } = useT();
  if (TAB_ROOTS.test(p) || OWN_BACK.test(p)) return null;

  function back() {
    let inApp = false;
    try { inApp = window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { /* no referrer */ }
    if (inApp) router.back(); else router.push(parentOf(p));
  }

  return (
    <button type="button" onClick={back}
      className="mb-3 -ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-sm active:scale-95">
      <ChevronLeft className="h-4 w-4" /> {lang === "en" ? "Back" : "पीछे"}
    </button>
  );
}
