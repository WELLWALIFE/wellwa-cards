"use client";

// Wraps a whole dashboard page that requires a paid plan. Free users see a
// clean upsell screen instead of the feature (no half-broken UI).

import Link from "next/link";
import { Lock, Sparkles, Check, ArrowLeft } from "lucide-react";
import { useFeature, FEATURE_LABEL, type Feature } from "@/lib/plan";
import { planPrice } from "@/lib/billing";

export function PaidPage({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { allowed, loading } = useFeature(feature);
  if (loading || allowed) return <>{children}</>;

  const perks = [
    "AI Studio — taglines, bios, translations",
    "AI chat + AI bot training on your card",
    "WhatsApp auto-reply & AI follow-up",
    "Advanced analytics with lead sources",
    "Custom domain & no Shubhora branding",
  ];

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface2 text-muted">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {FEATURE_LABEL[feature]} — included in Growth
        </h1>
        <p className="mt-2 text-sm text-muted">
          This feature is part of the Growth plan.
        </p>

        <ul className="mt-6 space-y-2.5 text-left">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-brand" /> <span>{p}</span>
            </li>
          ))}
        </ul>

        <a
          href="/poster/plan"
          className="mt-7 flex items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white shadow-card hover:-translate-y-0.5 transition-transform"
        >
          <Sparkles className="h-4 w-4" /> See plans — from {planPrice("growth")} a month (incl. GST)
        </a>
        <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
