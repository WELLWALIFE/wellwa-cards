"use client";

// Who may use the paid AI tools, and what they see.
//   active   = subscription running, or credits in hand (pay-as-you-go)
//   inactive = nothing of those: credit prices stay hidden and every AI button opens the unlock popup
//              ("Activate your subscription" or "Add credits"; associates activate in the partner panel).
import { useCallback, useEffect, useState } from "react";
import { Coins, LoaderCircle, Sparkles, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { PARTNER_ACTIVATE } from "@/lib/associate";
import { AddCredits } from "@/components/poster/add-credits";
import { planPrice } from "@/lib/billing";

export type AiAccess = { loading: boolean; active: boolean; subscribed: boolean; balance: number; associate: boolean; refresh: () => void };

let cached: Promise<Omit<AiAccess, "loading" | "refresh">> | null = null;
async function load(): Promise<Omit<AiAccess, "loading" | "refresh">> {
  const sb = getBrowserSupabase();
  if (!sb) return { active: false, subscribed: false, balance: 0, associate: false };
  const [{ data: plan }, { data: credits }, { data: user }] = await Promise.all([
    sb.rpc("my_plan"), sb.rpc("my_credits"), sb.auth.getUser(),
  ]);
  const row = Array.isArray(plan) ? plan[0] : plan;
  const subscribed = !!row && !row.expired && row.plan !== "free";
  const balance = typeof credits === "number" ? credits : 0;
  const associate = typeof user.user?.user_metadata?.associate_id === "string" && !!user.user.user_metadata.associate_id;
  return { active: subscribed || balance > 0, subscribed, balance, associate };
}

export function useAiAccess(): AiAccess {
  const [s, setS] = useState<Omit<AiAccess, "refresh">>({ loading: true, active: false, subscribed: false, balance: 0, associate: false });
  const refresh = useCallback(() => {
    cached = load().catch(() => ({ active: false, subscribed: false, balance: 0, associate: false }));
    cached.then((v) => setS({ ...v, loading: false }));
  }, []);
  useEffect(() => {
    if (!cached) cached = load().catch(() => ({ active: false, subscribed: false, balance: 0, associate: false }));
    cached.then((v) => setS({ ...v, loading: false }));
  }, []);
  return { ...s, refresh };
}

/** "Unlock AI tools": subscribe, or buy credits and pay as you go. */
export function UnlockDialog({ reason, onClose, title = "Unlock the AI tools", subscriptionOnly = false }: { reason?: string; onClose: () => void; title?: string; subscriptionOnly?: boolean }) {
  const a = useAiAccess();
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-float space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl grad-brand text-white"><Sparkles className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted">{reason || "AI photos, AI cards and websites, videos and more."}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        {a.loading ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : (
          <>
            <a href={a.associate ? PARTNER_ACTIVATE : "/poster/plan"} className="block rounded-xl border-2 border-brand bg-brand-soft p-4">
              <p className="font-semibold text-ink">Activate your subscription <span className="font-normal text-muted">· {planPrice("growth")}/month incl. GST</span></p>
              <p className="text-sm text-muted mt-0.5">Everything included: website, daily posters, WhatsApp AI, CRM — plus AI credit packs at the lowest price.</p>
            </a>
            {!a.associate && !subscriptionOnly && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Coins className="h-4 w-4 text-brand" /> Or pay as you go: add credits</p>
                <AddCredits onDone={() => { a.refresh(); onClose(); }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A price like "· 8 credits" — shown only to users who can use the tools. */
export function CreditPrice({ credits, prefix = " · " }: { credits: number; prefix?: string }) {
  const a = useAiAccess();
  if (a.loading || !a.active) return null;
  return <>{prefix}{credits} credits</>;
}

/** Wraps a whole AI tool page: users who can use it see the page; everyone else sees what it does and one button
 *  that opens the unlock popup — no prices or credit counts. */
export function AiPageGate({ title, reason, children }: { title: string; reason: string; children: React.ReactNode }) {
  const a = useAiAccess();
  const [open, setOpen] = useState(false);
  if (a.loading) return <div className="py-24 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (a.active) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md py-10 text-center space-y-4">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl grad-brand text-white"><Sparkles className="h-7 w-7" /></span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">{reason}</p>
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl grad-brand py-4 text-base font-semibold text-white">Unlock</button>
      {open && <UnlockDialog reason={reason} onClose={() => { setOpen(false); a.refresh(); }} />}
    </div>
  );
}
