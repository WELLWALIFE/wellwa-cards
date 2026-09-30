"use client";

// Checkout for the all-in-one subscription. Signed out → /signup first.
// Growth is taken only by autopay (owner's call, 27 Sep 2026): Razorpay opens with a subscription, the customer approves
// the mandate in their UPI app (PhonePe, Google Pay, Paytm, …) or with a card, the first month is debited at once and
// every month after that on its own. Pro (only for those already on it) stays a one-month payment.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { SAAS_PLANS, rupees, type SaasTier } from "@/lib/billing";
import { BRAND } from "@/lib/site-brand";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Razorpay?: any } }
const loadScript = (src: string) => new Promise<boolean>((resolve) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
  const s = document.createElement("script"); s.src = src; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
});
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export function SubscribeButton({ tier, className, children, onDone }: { tier: SaasTier; className?: string; children: React.ReactNode; onDone?: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const plan = SAAS_PLANS[tier];
  const autopay = tier === "growth";

  const finished = (text: string) => {
    setState("done"); setMsg(text);
    if (onDone) onDone(); else setTimeout(() => router.push("/poster"), 1800);
  };

  async function start() {
    setState("busy"); setMsg("");
    try {
      const o = autopay ? await post("/api/billing/autopay", {}) : await post("/api/billing/order", { plan: `saas:${tier}` });
      if (o.error === "sign in required") { router.push(`/signup?next=/pricing&plan=${tier}`); return; }
      if (o.error) throw new Error(o.error);
      if (o.already) { finished(`You are on ${plan.label}.`); return; }
      if (o.demo) { setState("error"); setMsg("Payments are not live on this environment."); return; }
      if (!(await loadScript("https://checkout.razorpay.com/v1/checkout.js")) || !window.Razorpay) { setState("error"); setMsg("Could not load the payment page."); return; }
      new window.Razorpay({
        key: o.keyId, name: BRAND, theme: { color: "#0e9e90" },
        ...(autopay
          ? { subscription_id: o.subscriptionId, description: `${plan.label} — ${rupees(plan.amount)} / month` }
          : { amount: o.amount, currency: "INR", order_id: o.orderId, description: `${plan.label} plan — 1 month` }),
        handler: async (resp: any) => {
          const v = await post(autopay ? "/api/billing/autopay/verify" : "/api/billing/verify", resp);
          if (v.ok) finished(`You are on ${plan.label}.`);
          else { setState("error"); setMsg("We could not confirm the payment. If money was deducted, contact support with the payment id."); }
        },
        modal: { ondismiss: () => setState("idle") },
      }).open();
      setState("idle");
    } catch (e) { setState("error"); setMsg(e instanceof Error ? e.message : "Something went wrong."); }
  }

  // Partners pay here too: every debit is reported to the partner panel, so it counts for the team.
  if (state === "done") return <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check className="h-4 w-4" /> {msg}</p>;
  return (
    <div>
      <button type="button" onClick={start} disabled={state === "busy"} className={className}>
        {state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {children}
      </button>
      {state === "error" && <p className="mt-1 text-[11px] text-danger">{msg}</p>}
    </div>
  );
}
