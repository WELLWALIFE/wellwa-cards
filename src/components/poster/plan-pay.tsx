"use client";
// "Pay ₹199 / ₹499" button for the Shubhora plan cards: creates a Razorpay
// order, opens checkout, verifies server-side, then reloads so the new plan shows.
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpOptions = {
  key: string; amount: number; currency: string; order_id: string; name: string; description: string;
  theme: { color: string }; handler: (r: RzpResponse) => void; modal: { ondismiss: () => void };
};
type RzpCtor = new (o: RzpOptions) => { open: () => void };
const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<RzpCtor | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { Razorpay?: RzpCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const done = () => resolve(w.Razorpay ?? null);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_JS}"]`);
    if (existing) { existing.addEventListener("load", done); existing.addEventListener("error", () => resolve(null)); return; }
    const s = document.createElement("script");
    s.src = CHECKOUT_JS; s.async = true; s.onload = done; s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

export function PlanPayButton({ plan, label, className = "" }: { plan: "personal" | "business"; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "verifying" | "error">("idle");
  const [err, setErr] = useState("");
  const { t } = useT();

  async function pay() {
    setState("busy"); setErr("");
    try {
      const o = await api<{ orderId?: string; amount?: number; currency?: string; keyId?: string; error?: string }>("/api/poster/pay/order", { method: "POST", json: { plan } });
      if (!o.ok || !o.data.orderId || !o.data.keyId) throw new Error(o.data.error || t.payUnavailable);
      const Razorpay = await loadCheckout();
      if (!Razorpay) throw new Error(t.payLoadFail);
      new Razorpay({
        key: o.data.keyId, amount: o.data.amount ?? 0, currency: o.data.currency ?? "INR", order_id: o.data.orderId,
        name: "Shubhora", description: `${plan === "business" ? "Business" : "Personal"} plan · 1 month`, theme: { color: "#0e9e90" },
        handler: async (r) => {
          setState("verifying");
          const v = await api<{ ok: boolean; error?: string }>("/api/poster/pay/verify", {
            method: "POST", json: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature, plan },
          });
          if (v.ok && v.data.ok) { window.location.reload(); return; }
          setState("error"); setErr(t.payVerifyFail);
        },
        modal: { ondismiss: () => setState("idle") },
      }).open();
    } catch (e) {
      setState("error"); setErr(e instanceof Error ? e.message : t.error);
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={pay} disabled={state === "busy" || state === "verifying"}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {state === "busy" || state === "verifying" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {state === "verifying" ? t.payVerifying : label}
      </button>
      {state === "error" && err ? <p className="mt-1 text-[11px] text-danger">{err}</p> : null}
    </div>
  );
}
