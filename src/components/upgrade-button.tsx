"use client";

import { useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import type { PaidPlan } from "@/lib/billing";
import { usePlan } from "@/lib/plan";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { Razorpay?: any }
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function UpgradeButton({
  plan, className, children,
}: {
  plan: PaidPlan;
  amount: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const { refresh } = usePlan();

  async function upgrade() {
    setState("busy");
    setMsg("");
    try {
      const order = await fetch("/api/billing/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }).then((r) => r.json());

      if (order.error) throw new Error(order.error);

      // Local development only; production never activates plans in demo mode.
      if (order.demo) {
        setState("error");
        setMsg("Demo checkout does not activate a paid plan.");
        return;
      }

      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok || !window.Razorpay) { setState("error"); setMsg("Could not load payment gateway."); return; }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: "INR",
        order_id: order.orderId,
        name: "Shubhora",
        description: `${plan.toUpperCase()} plan`,
        theme: { color: "#0e9e90" },
        handler: async (resp: any) => {
          const v = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resp),
          }).then((r) => r.json());
          if (v.ok) {
            setState("done");
            setMsg("Payment successful — you're on the " + plan.toUpperCase() + " plan!");
            await refresh(); // unlock gated features now, no reload needed
          } else {
            setState("error");
            setMsg("Payment verification failed. If money was deducted, contact support.");
          }
        },
        modal: { ondismiss: () => setState("idle") },
      });
      rzp.open();
      setState("idle"); // checkout modal is open; result comes via handler
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (state === "done") {
    return (
      <div className={className}>
        <span className="inline-flex items-center gap-1.5 text-good font-semibold text-sm">
          <Check className="h-4 w-4" /> On {plan.toUpperCase()}
        </span>
        {msg && <p className="text-[11px] text-muted mt-1">{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      <button onClick={upgrade} disabled={state === "busy"} className={className}>
        {state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {children}
      </button>
      {state === "error" && <p className="text-[11px] text-danger mt-1">{msg}</p>}
    </div>
  );
}
