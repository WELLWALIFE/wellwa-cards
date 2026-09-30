"use client";
// The setup journey. The six free steps come first and build on each other; the two paid ones underneath put the
// business on autopilot and are part of the subscription. Progress counts the free steps only, so a free account
// really can reach "All set".
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, Crown, LoaderCircle } from "lucide-react";
import { isLoggedIn } from "@/lib/poster-client";
import { useJourney, type Step } from "@/lib/journey";
import { UnlockDialog, useAiAccess } from "@/lib/ai-access";
import { PushSetting } from "@/components/push-toggle";

export default function SetupPage() {
  const router = useRouter();
  const { steps, freeDone, freeTotal, nextFree } = useJourney();
  const access = useAiAccess();
  const [locked, setLocked] = useState<Step | null>(null);
  useEffect(() => { isLoggedIn().then((ok) => { if (!ok) router.push("/login?next=/poster/setup"); }); }, [router]);
  if (!steps) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;

  const free = steps.filter((s) => !s.premium);
  const paid = steps.filter((s) => s.premium);
  const allDone = freeDone === freeTotal;

  function row(s: Step, n: number) {
    const isNext = nextFree?.key === s.key;
    const needsPlan = s.premium && !access.loading && !access.subscribed;
    const body = (
      <>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-good text-white" : isNext ? "grad-brand text-white" : "bg-surface2 text-muted"}`}>{s.done ? <Check className="h-5 w-5" /> : n}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">{s.title}
            {s.premium ? <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber"><Crown className="h-3 w-3" />Plan</span>
              : <span className="rounded-full bg-good/10 px-1.5 py-0.5 text-[10px] font-bold text-good">Free</span>}
          </span>
          <span className="block text-xs text-muted">{s.sub}</span>
        </span>
        {!s.done && <ChevronRight className="h-5 w-5 text-muted" />}
      </>
    );
    const cls = `flex items-center gap-3 rounded-2xl border p-3.5 text-left w-full ${s.done ? "border-good/30 bg-surface2/60" : isNext ? "border-brand bg-brand-soft/50" : "border-border bg-surface"}`;
    return (
      <li key={s.key}>
        {needsPlan && !s.done
          ? <button type="button" onClick={() => setLocked(s)} className={cls}>{body}</button>
          : <Link href={s.href} className={cls}>{body}</Link>}
      </li>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-2xl grad-brand p-5 text-white">
        <p className="text-xs font-semibold tracking-widest opacity-80">YOUR SETUP</p>
        <h1 className="text-2xl font-bold mt-1">{allDone ? "All set! 🎉" : nextFree ? `Next: ${nextFree.title}` : "Let's set up"}</h1>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${freeTotal ? (freeDone / freeTotal) * 100 : 0}%` }} /></div>
        <p className="text-sm opacity-90 mt-1.5">{freeDone} of {freeTotal} free steps done</p>
      </div>

      <ol className="space-y-2">{free.map((s, i) => row(s, i + 1))}</ol>

      {paid.length > 0 && (
        <>
          <p className="pt-1 text-sm font-semibold text-muted">Grow more (with a plan)</p>
          <ol className="space-y-2">{paid.map((s, i) => row(s, free.length + i + 1))}</ol>
        </>
      )}

      <PushSetting />
      <Link href="/poster" className="block text-center rounded-2xl border border-border px-4 py-3.5 text-sm font-semibold">{allDone ? "Go to today's poster" : "Later — go to my home"}</Link>
      {locked && <UnlockDialog title={locked.title} subscriptionOnly reason={`${locked.sub}. This runs your business on autopilot and is part of the subscription.`} onClose={() => setLocked(null)} />}
    </div>
  );
}
