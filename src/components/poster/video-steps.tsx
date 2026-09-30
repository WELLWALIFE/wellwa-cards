"use client";
// One flow for every video in the Studio (owner's call, 30 Sep 2026: "har video me alag-alag flow, confusing"):
//   1 Type (the Video hub) → 2 Words → 3 Look & voice → 4 Make.
// Every video page draws this bar at the top with the step it is on, and the same cost line where the button is,
// so the owner always knows where they are and what it costs — whichever video they picked.
import Link from "next/link";
import { Coins } from "lucide-react";

export const VIDEO_STEPS = { en: ["Type", "Words", "Look & voice", "Make"], hi: ["Type", "Shabd", "Look & awaaz", "Banayein"] } as const;

export function VideoSteps({ step, hi = true, note }: { step: 1 | 2 | 3 | 4; hi?: boolean; note?: string }) {
  const labels = hi ? VIDEO_STEPS.hi : VIDEO_STEPS.en;
  return (
    <div className="space-y-1.5">
      <ol className="grid grid-cols-4 gap-1" aria-label="Steps">
        {labels.map((l, i) => {
          const n = i + 1, on = n === step, done = n < step;
          return (
            <li key={l} aria-current={on ? "step" : undefined} className={`flex h-9 items-center justify-center gap-1 rounded-lg text-xs font-bold ${on ? "grad-brand text-white" : done ? "bg-brand-soft text-brand-ink" : "bg-surface2 text-muted"}`}>
              <span>{done ? "✓" : n}</span><span className="hidden min-[360px]:inline">{l}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm font-semibold">{step}/4 · {labels[step - 1]}{note ? <span className="font-normal text-muted"> — {note}</span> : ""}</p>
    </div>
  );
}

/** "This video: 40 credits · you have 35 · Add credits" — the same line under every Make button. */
export function CostLine({ cost, balance, hi = true, free, range }: { cost: number; balance: number | null; hi?: boolean; free?: boolean; range?: string }) {
  const short = balance !== null && !free && cost > balance;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${short ? "text-danger" : "text-muted"}`}>
      <Coins className="h-3.5 w-3.5" />
      <span>{free ? (hi ? "Ye video free hai" : "This video is free") : `${hi ? "Ye video" : "This video"}: ${range || `${cost} credits`}`}</span>
      {balance !== null && <span>· {hi ? "Aapke paas" : "You have"} <b>{balance}</b></span>}
      {short && <Link href="/poster/video?credits=1" className="font-semibold underline">{hi ? "Credits lein" : "Add credits"}</Link>}
    </p>
  );
}
