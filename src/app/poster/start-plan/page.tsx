"use client";
// Where "Start with Standard / Premium" lands after sign-up or login (owner, 16 Oct 2026): the payment opens by itself, and when it
// goes through the card set-up opens. If the payment window is closed, the button below opens it again.
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SubscribeButton } from "@/components/subscribe-button";
import { PREMIUM_FIRST_PAISE, SAAS_PLANS, rupees } from "@/lib/billing";

function StartPlan() {
  const router = useRouter();
  const premium = useSearchParams().get("plan") === "premium";
  const root = useRef<HTMLDivElement>(null);
  // Opens the payment once, by pressing the button that is already on this page.
  useEffect(() => { const t = setTimeout(() => root.current?.querySelector("button")?.click(), 400); return () => clearTimeout(t); }, []);
  return (
    <div ref={root} className="mx-auto max-w-md space-y-5 py-12 text-center">
      <h1 className="text-2xl font-bold">{premium ? "Premium" : "Standard"}</h1>
      <p className="text-sm text-muted">
        {premium
          ? `${rupees(PREMIUM_FIRST_PAISE)} for the first month only, then ${rupees(SAAS_PLANS.growth.amount)} a month from the 2nd month.`
          : `${rupees(SAAS_PLANS.growth.amount)} a month.`} GST included.
      </p>
      <SubscribeButton tier="growth" premium={premium} onDone={() => router.replace("/poster/onboard")} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white">
        {premium ? "Pay and start Premium" : "Pay and start Standard"}
      </SubscribeButton>
      <Link href="/poster/welcome" className="block text-xs text-muted underline">Not now — make my free card</Link>
    </div>
  );
}

export default function StartPlanPage() {
  return <Suspense fallback={null}><StartPlan /></Suspense>;
}
