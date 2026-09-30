"use client";

// The same setup journey the phone app shows (lib/journey.ts), for the desktop overview. Hidden once complete.
import Link from "next/link";
import { Check, ChevronRight, Crown } from "lucide-react";
import { useJourney } from "@/lib/journey";

export function SetupChecklist() {
  const { steps, done, total, next } = useJourney();
  if (!steps || !next) return null;
  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Finish setting up · {done}/{total}</p>
          <p className="text-sm text-muted">Next: {next.title} — {next.sub}</p>
        </div>
        <Link href={next.href} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white">Continue <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {steps.map((s, i) => (
          <Link key={s.key} href={s.href} className={`flex items-center gap-2.5 rounded-xl border bg-surface p-2.5 ${s.done ? "border-good/40" : s.key === next.key ? "border-brand" : "border-border hover:border-brand"}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? "bg-good text-white" : "bg-surface2 text-muted"}`}>{s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
            {s.premium && !s.done && <Crown className="h-3.5 w-3.5 text-amber" />}
          </Link>
        ))}
      </div>
    </section>
  );
}
