"use client";
// The profile, in five steps (owner's call, 2 Oct 2026: "profile bharo, site apne aap banegi"): you → business →
// products → details & website → make. The same bar sits on top of each step's screen, shows how much of the
// profile is done and takes the owner back a step; every screen underneath keeps what it already saved, so
// nothing is typed twice.
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useT } from "@/lib/poster-i18n";

export type ProfileStepKey = "you" | "business" | "products" | "details" | "make";
export const PROFILE_STEPS: { key: ProfileStepKey; en: string; hi: string; href: string }[] = [
  { key: "you", en: "You", hi: "आप", href: "/poster/onboard?step=you&back=/poster/welcome" },
  { key: "business", en: "Business", hi: "Business", href: "/poster/onboard?step=site" },
  { key: "products", en: "Products", hi: "Products", href: "/poster/products?setup=1" },
  { key: "details", en: "Details & website", hi: "जानकारी व website", href: "/poster/card/build" },
  { key: "make", en: "Make", hi: "बनाएँ", href: "/poster/card/build#make" },
];

export function ProfileSteps({ current }: { current: ProfileStepKey }) {
  const { lang } = useT();
  const hi = lang === "hi";
  const { steps } = useJourney();
  const done = (k: ProfileStepKey) => {
    const j = (key: string) => !!steps?.find((s) => s.key === key)?.done;
    return k === "you" ? j("you") : k === "business" ? j("business") : k === "products" ? j("products") : k === "make" ? j("card") : false;
  };
  const at = PROFILE_STEPS.findIndex((s) => s.key === current);
  const finished = PROFILE_STEPS.filter((s) => done(s.key)).length;
  // the step being filled counts as half, so the bar moves as soon as a screen opens
  const pct = Math.min(100, Math.round(((finished + (done(current) ? 0 : 0.5)) / PROFILE_STEPS.length) * 100));
  const prev = at > 0 ? PROFILE_STEPS[at - 1] : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {prev ? <Link href={prev.href} className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-ink"><ChevronLeft className="h-4 w-4" /> {hi ? prev.hi : prev.en}</Link> : <span />}
        <span className="ml-auto text-xs font-semibold text-muted">{hi ? "प्रोफ़ाइल" : "Profile"} · {pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full grad-brand transition-[width]" style={{ width: `${pct}%` }} /></div>
      <ol className="flex items-center gap-1 text-[11px] font-semibold">
        {PROFILE_STEPS.map((s, i) => {
          const isCur = i === at, isDone = done(s.key);
          const cls = `min-w-0 flex-1 truncate rounded-full px-1.5 py-1.5 text-center ${isCur ? "bg-brand text-white" : isDone ? "bg-good/10 text-good" : "bg-surface2 text-muted"}`;
          const label = <>{isDone && !isCur ? <Check className="mr-0.5 inline h-3 w-3" /> : `${i + 1}. `}{hi ? s.hi : s.en}</>;
          return <li key={s.key} className="min-w-0 flex-1">{isCur ? <span className={`block ${cls}`}>{label}</span> : <Link href={s.href} className={`block ${cls}`}>{label}</Link>}</li>;
        })}
      </ol>
    </div>
  );
}
