"use client";
// The profile, one bar on every set-up screen (owner's call, 5 Oct 2026: "steps clear and easy, professional"):
// four chapters — you → business → products → make — and under them ONE count, "Step 4 of 10", for the screens
// inside the chapters (setup-steps.ts). The bar shows how far the profile is, takes the owner back to the screen they were
// just on, and every screen keeps what it already saved, so nothing is typed twice.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
import { catalogCopyFor, orgWordFor } from "@/lib/catalog-copy";
import { flowOf, LAST_ONBOARD_SCREEN, SETUP_HOME, SETUP_SCREENS, screenHref, screenNo, type ScreenKey } from "@/lib/setup-steps";

export type ProfileStepKey = "you" | "business" | "products" | "make";
export const PROFILE_STEPS: { key: ProfileStepKey; en: string; hi: string; href: string }[] = [
  { key: "you", en: "You", hi: "आप", href: "/poster/onboard?step=you" },
  { key: "business", en: "Business", hi: "Business", href: "/poster/onboard?step=site" },
  { key: "make", en: "Make", hi: "बनाएँ", href: "/poster/card/build?make=1" },
];
/** Where "Back" goes from a chapter ONLY when the app has no earlier screen to go back to (a link opened fresh, a reload): the LAST screen
 *  of the chapter before (the chips above open a chapter at its first screen, which for Make was the website question — four screens
 *  too far back). Otherwise Back is the screen the owner was just on (lib/nav-back). */
const BACK_HREF: Record<ProfileStepKey, string> = {
  you: SETUP_HOME,
  business: screenHref("you"),
  products: screenHref(LAST_ONBOARD_SCREEN),
  make: screenHref(LAST_ONBOARD_SCREEN),
};

/** `category`: the trade, so the chapters are called what they are for that trade — Courses for a school, Menu for
 *  a restaurant. `screen`: which screen inside the chapter (the onboarding passes it; the products and make pages
 *  are one screen each). `onBack`: a screen's own back (inside the onboarding) instead of the default one. */
// "Card for" is part of the Website screen now (onboard skips it always): left out of the count here too, so the Make screen does not
// say "Step 6 of 6" right after "Step 4 of 5" (found on the live walk, 24 Oct 2026).
export function ProfileSteps({ current, category, screen, onBack, skipped = ["promote"] }: { current: ProfileStepKey; category?: string; screen?: ScreenKey; onBack?: () => void; skipped?: ScreenKey[] }) {
  const { lang } = useT();
  const router = useRouter();
  const hi = lang === "hi";
  const copy = catalogCopyFor(category);
  const org = orgWordFor(category);
  const name = (s: { key: ProfileStepKey; en: string; hi: string }) =>
    s.key === "products" ? (hi ? copy.shortHi : copy.short) : s.key === "business" && category ? (hi ? org.hi.replace(/^./, (c) => c.toUpperCase()) : org.En) : hi ? s.hi : s.en;
  const { steps } = useJourney();
  const done = (k: ProfileStepKey) => {
    const j = (key: string) => !!steps?.find((s) => s.key === key)?.done;
    return k === "you" ? j("you") : k === "business" ? j("business") : k === "products" ? j("products") : k === "make" ? j("card") : false;
  };
  const at = PROFILE_STEPS.findIndex((s) => s.key === current);
  const key: ScreenKey = screen ?? (current === "products" ? "products" : current === "make" ? "make" : current === "you" ? "you" : "trade");
  const n = screenNo(key, skipped), total = flowOf(skipped).length;
  const here = SETUP_SCREENS.find((s) => s.key === key);
  const pct = Math.min(100, Math.round(((n - 1) / total) * 100));
  const backCls = "inline-flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-ink";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Always "Back": it goes to the screen the owner was just on, which is not always the chapter before (the old label named it). */}
        <button type="button" onClick={onBack ?? (() => goBack(router, BACK_HREF[current]))} className={backCls}><ChevronLeft className="h-4 w-4" /> {hi ? "पीछे" : "Back"}</button>
        <span className="ml-auto text-xs font-semibold text-muted">{hi ? `Step ${n} / ${total}` : `Step ${n} of ${total}`}{here ? ` · ${hi ? here.hi : here.en}` : ""}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full grad-brand transition-[width]" style={{ width: `${pct}%` }} /></div>
      <ol className="flex items-center gap-1 text-[11px] font-semibold">
        {PROFILE_STEPS.map((s, i) => {
          const isCur = i === at, isDone = done(s.key);
          const cls = `min-w-0 flex-1 truncate rounded-full px-1.5 py-1.5 text-center ${isCur ? "bg-brand text-white" : isDone ? "bg-good/10 text-good" : "bg-surface2 text-muted"}`;
          const label = <>{isDone && !isCur ? <Check className="mr-0.5 inline h-3 w-3" /> : null}{name(s)}</>;
          return <li key={s.key} className="min-w-0 flex-1">{isCur ? <span className={`block ${cls}`}>{label}</span> : <Link href={s.href} className={`block ${cls}`}>{label}</Link>}</li>;
        })}
      </ol>
    </div>
  );
}
