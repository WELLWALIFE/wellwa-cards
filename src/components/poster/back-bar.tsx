"use client";
// A "← Back" row at the top of every app page that is not one of the five main tabs (owner's call, 24 Sep 2026:
// "many pages have no back button — people get stuck"). Pages that already draw their own back arrow are skipped,
// so there is never a double arrow. Back = the previous screen when there is one inside the app, else the page's
// natural parent (a link opened fresh from WhatsApp still has somewhere to go).
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";

/** The five tabs of the bottom menu (and "Me") — their own home, no back row. */
const TAB_ROOTS = /^\/poster(\/(create|leads|business|more|settings))?\/?$/;
/** Pages that draw their own back arrow in their heading (a page listed here MUST have one in every state, or it has no Back at all;
 *  a page with an arrow that is missing here gets two), and full-screen steps with none: start, welcome (the first screens after
 *  sign-up — Back would land on the finished sign-up form). Pages left out get the row from here: ai, card, card/edit, card/looks,
 *  connect, setup, share, social, video (its own Back / Next at the bottom step the wizard; this row leaves the page). */
const OWN_BACK = /^\/poster\/(start|welcome|onboard|brand|ads|calendar|learn|report|video$|testimonials|photos|photoshoot|profiles|history|videos|explainer|plan|products|reel|website|guide|d|text-video|card\/build|card\/edit|business|site)(\/|$)/;

/** Where "Back" goes when there is no earlier screen in this tab (only for the pages that get this row). */
function parentOf(p: string): string {
  if (p.startsWith("/poster/card/")) return "/poster/card";
  if (p === "/poster/video") return "/poster/videos";
  if (p === "/poster/video/pro") return "/poster/video";
  if (/^\/poster\/(card|social|ai)(\/|$)/.test(p)) return "/poster/create";
  if (/^\/poster\/(setup|connect)(\/|$)/.test(p)) return "/poster/more";
  return "/poster";
}

/** The round "← Back" button. Also used by a tab root that was opened from another screen (Leads → WhatsApp, from Connections). */
export function BackPill({ fallback, className = "mb-3 -ml-1" }: { fallback: string; className?: string }) {
  const router = useRouter();
  const { lang } = useT();
  return (
    <button type="button" onClick={() => goBack(router, fallback)}
      className={`${className} inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-sm active:scale-95`}>
      <ChevronLeft className="h-4 w-4" /> {lang === "en" ? "Back" : "पीछे"}
    </button>
  );
}

export function BackBar() {
  const p = usePathname() || "";
  if (TAB_ROOTS.test(p) || OWN_BACK.test(p)) return null;
  return <BackPill fallback={parentOf(p)} />;
}
