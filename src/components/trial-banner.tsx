"use client";

// Trial countdown / renewal prompt, shown across the dashboard.
//
// It gets louder as the trial runs down rather than nagging from day one: a
// quiet line for the first stretch, a warning in the last few days, and a firm
// (but not alarming) notice once it has lapsed.

import { useState } from "react";
import Link from "next/link";
import { Clock, AlertCircle, Sparkles } from "lucide-react";
import { usePlan } from "@/lib/plan";
import { useAssociate } from "@/lib/associate";
import { UnlockDialog } from "@/lib/ai-access";

export function TrialBanner() {
  const { loading, isTrial, expired, daysLeft, refresh } = usePlan();
  const associate = useAssociate();
  const [paying, setPaying] = useState(false);
  if (loading) return null;

  // Partners pay here too, in the app, with Razorpay (owner's call, 14 Oct 2026) — the same pay popup as everyone else,
  // so they never leave the app. Every debit is reported to the partner panel, so it still counts for their team.
  if (associate && expired) {
    return (
      <div className="mb-5 rounded-xl border border-brand/30 bg-brand-soft p-4">
        <p className="font-medium text-sm">You are on the free plan.</p>
        <p className="text-sm text-muted mt-1">Subscribe to get daily posters, social posting, WhatsApp AI, the CRM and AI credits. You pay here with Razorpay (UPI or card).</p>
        <button type="button" onClick={() => setPaying(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-sm font-medium text-white">
          <Sparkles className="h-4 w-4" /> Subscribe now
        </button>
        {paying && <UnlockDialog subscriptionOnly onClose={() => { setPaying(false); void refresh(); }} />}
      </div>
    );
  }

  if (expired) {
    return (
      <div className="mb-5 rounded-xl border border-amber/40 bg-amber/10 p-4">
        <p className="font-medium flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-amber shrink-0" />
          Your plan has ended — you are on the free plan now.
        </p>
        <p className="text-sm text-muted mt-1">
          Your card stays online. The website, daily posters, WhatsApp AI, auto-posting
          and AI chat are paused until you renew.
        </p>
        <Link href="/settings?upgrade=1"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-sm font-medium text-white">
          <Sparkles className="h-4 w-4" /> Renew my plan
        </Link>
      </div>
    );
  }

  if (!isTrial) return null;

  const urgent = daysLeft <= 4;
  return (
    <div className={`mb-5 rounded-xl border p-3.5 flex flex-wrap items-center gap-3 ${
      urgent ? "border-amber/40 bg-amber/10" : "border-border bg-surface"}`}>
      <Clock className={`h-4 w-4 shrink-0 ${urgent ? "text-amber" : "text-muted"}`} />
      <p className="text-sm flex-1 min-w-0">
        {daysLeft <= 0
          ? "Your trial ends today."
          : <>Free trial — <strong>{daysLeft} day{daysLeft === 1 ? "" : "s"}</strong> left.</>}
        <span className="text-muted"> Everything is unlocked until then.</span>
      </p>
      <Link href="/settings?upgrade=1"
        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
          urgent ? "grad-brand text-white" : "border border-border hover:bg-surface2"}`}>
        Choose a plan
      </Link>
    </div>
  );
}
