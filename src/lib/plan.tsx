"use client";

// Plan limits + the upgrade prompt shown when a locked feature is tapped.
//
// Every account starts on the free plan: the digital V-Card, free for its first year and then ₹1,499 a year
// (migration 0057 — a running paid plan covers it). The paid plan adds the things that run the business for them —
// website, daily posters, WhatsApp AI, auto-posting, monthly credits. A lapsed paid plan simply reads back as "free".

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Sparkles, X, Check } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { planPrice } from "@/lib/billing";
import type { Plan } from "@/lib/types";

export type Feature =
  | "ai-studio" | "ai-chat" | "whatsapp" | "bot-training" | "followup"
  | "analytics" | "extra-cards" | "extra-pages" | "custom-domain"
  | "remove-branding" | "lead-export" | "templates";

/** What each plan unlocks. Free is deliberately generous on basics, locked on AI. */
export const PLAN_FEATURES: Record<Plan, Feature[]> = {
  // Free plan: the card, all its pages, and the owner's own domain (the card's first year free, then ₹1,499 a year).
  // The website and the AI need the plan.
  free: ["templates", "extra-pages", "custom-domain"],
  pro: [
    "ai-studio", "ai-chat", "whatsapp", "bot-training", "followup", "analytics",
    "extra-cards", "extra-pages", "custom-domain", "remove-branding", "lead-export", "templates",
  ],
  team: [
    "ai-studio", "ai-chat", "whatsapp", "bot-training", "followup", "analytics",
    "extra-cards", "extra-pages", "custom-domain", "remove-branding", "lead-export", "templates",
  ],
};

export const PLAN_LIMITS: Record<Plan, { cards: number; pages: number; products: number }> = {
  // One account = one link = one card, on every plan (owner's call, 24 Sep 2026): the card's link is the
  // person's name and the partner/referral identity hangs off the same account, so a second card would only
  // split their leads and confuse the link. Templates change the LOOK of that one card instead.
  free: { cards: 1, pages: 20, products: 20 },
  pro: { cards: 1, pages: 20, products: 50 },
  team: { cards: 1, pages: 20, products: 50 },
};

export const FEATURE_LABEL: Record<Feature, string> = {
  "ai-studio": "AI Studio", "ai-chat": "AI chat on your card", whatsapp: "WhatsApp auto-reply",
  "bot-training": "AI bot training", followup: "AI auto follow-up", analytics: "Advanced analytics",
  "extra-cards": "More than 1 card", "extra-pages": "More pages", "custom-domain": "Custom domain",
  "remove-branding": "Remove branding", "lead-export": "Lead export", templates: "Templates",
};

export type PlanState = {
  plan: Plan;
  loading: boolean;
  expiresAt: string | null;
  /** Whole days until the plan lapses; 0 once it has. */
  daysLeft: number;
  isTrial: boolean;
  expired: boolean;
  /** Re-reads my_plan() — call right after a payment verifies so paid
   *  features unlock immediately instead of waiting for a page reload. */
  refresh: () => Promise<void>;
};

const PlanCtx = createContext<PlanState>({
  plan: "free", loading: true, expiresAt: null, daysLeft: 0, isTrial: false, expired: false,
  refresh: async () => {},
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState(0);
  const [isTrial, setIsTrial] = useState(false);
  const [expired, setExpired] = useState(false);

  const load = async () => {
    const sb = getBrowserSupabase();
    if (!sb) { setPlan("pro"); setLoading(false); return; } // demo mode → everything open
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { setLoading(false); return; }
    // my_plan() is the single source of truth and applies expiry, so a lapsed
    // plan can't keep paid features unlocked. This used to read
    // cards.data.plan, which the Razorpay path never wrote — a real payment
    // unlocked nothing.
    const { data } = await sb.rpc("my_plan");
    const row = Array.isArray(data) ? data[0] : data;
    let p = row?.plan as Plan | undefined;
    let expiresAt: string | null = row?.expires_at ?? null, daysLeft: number = row?.days_left ?? 0, isTrial = Boolean(row?.is_trial), expired = Boolean(row?.expired);
    if (p !== "pro" && p !== "team") {
      // A running Shubhora subscription (Growth / Pro) unlocks the same features as the card's pro plan —
      // the upsell screens promise exactly that ("included in Growth and Pro").
      const { data: sd } = await sb.rpc("my_saas");
      const saas = Array.isArray(sd) ? sd[0] : sd;
      if (saas && saas.tier && saas.tier !== "none" && ["active", "grace"].includes(String(saas.state))) {
        p = "pro"; expiresAt = saas.expires_at ?? null; daysLeft = saas.days_left ?? 0; isTrial = false; expired = false;
      }
    }
    setPlan(p === "pro" || p === "team" ? p : "free");
    setExpiresAt(expiresAt);
    setDaysLeft(daysLeft);
    setIsTrial(isTrial);
    setExpired(expired);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <PlanCtx.Provider value={{ plan, loading, expiresAt, daysLeft, isTrial, expired, refresh: load }}>
      {children}
    </PlanCtx.Provider>
  );
}

export function usePlan() {
  return useContext(PlanCtx);
}

export function useFeature(f: Feature) {
  const { plan, loading } = usePlan();
  return { allowed: PLAN_FEATURES[plan].includes(f), plan, loading };
}

/* ---------------------------------------------------------------- *
 * Wrap any paid control. Free users see a lock and get the upgrade
 * sheet on click instead of the feature.
 * ---------------------------------------------------------------- */
export function Gate({
  feature, children, mode = "overlay",
}: {
  feature: Feature;
  children: React.ReactNode;
  mode?: "overlay" | "hide";
}) {
  const { allowed, loading } = useFeature(feature);
  const [ask, setAsk] = useState(false);

  if (loading || allowed) return <>{children}</>;
  if (mode === "hide") return null;

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[1.5px]">{children}</div>
        <button
          onClick={() => setAsk(true)}
          className="absolute inset-0 grid place-items-center rounded-xl bg-surface/40 backdrop-blur-[1px] group"
          aria-label={`${FEATURE_LABEL[feature]} — upgrade required`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink text-bg px-3 py-1.5 text-xs font-semibold shadow-float group-hover:scale-105 transition-transform">
            <Lock className="h-3.5 w-3.5" /> Pro
          </span>
        </button>
      </div>
      {ask && <UpgradeSheet feature={feature} onClose={() => setAsk(false)} />}
    </>
  );
}

/** Programmatic check — returns a function that opens the sheet when locked. */
export function useUpgradeGate(feature: Feature) {
  const { allowed } = useFeature(feature);
  const [ask, setAsk] = useState(false);
  const sheet = ask ? <UpgradeSheet feature={feature} onClose={() => setAsk(false)} /> : null;
  /** Returns true if the caller may proceed; otherwise opens the upgrade sheet. */
  const check = () => {
    if (allowed) return true;
    setAsk(true);
    return false;
  };
  return { allowed, check, sheet };
}

export function UpgradeSheet({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  const perks = [
    "AI Studio + AI chat on your card",
    "WhatsApp auto-reply & AI follow-up",
    "AI bot training (text + PDF)",
    "Unlimited pages, products & analytics",
    "Custom domain, no Shubhora branding",
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-float animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-xl grad-brand text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <button onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          {FEATURE_LABEL[feature]} is included in Growth
        </h2>
        <p className="mt-1 text-sm text-muted">
          The free plan does not include this. Choose Growth to unlock:
        </p>
        <ul className="mt-4 space-y-2">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-brand" /> <span>{p}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/poster/plan"
          className="mt-5 flex items-center justify-center rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white shadow-card"
        >
          See plans — from {planPrice("growth")} a month (incl. GST)
        </Link>
        <button onClick={onClose} className="mt-2 w-full text-center text-xs text-muted hover:text-ink">
          Not now
        </button>
      </div>
    </div>
  );
}
