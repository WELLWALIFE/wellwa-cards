"use client";
// Pays one payment request (/pay/<code>; src/lib/payments.ts): Razorpay checkout for its amount, then the server verifies and applies it.
// Used by the pay page and by the plan page's "requests waiting for you" list.
import { useState } from "react";
import { LoaderCircle, Check } from "lucide-react";
import { api } from "@/lib/poster-client";
import { loadCheckout } from "@/lib/checkout";
import { payPrefill } from "@/lib/pay-prefill";

export function PayRequestButton({ code, amountPaise, label, hi, onPaid, className = "" }: { code: string; amountPaise: number; label?: string; hi: boolean; onPaid?: (applied: string) => void; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "verifying" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const T = (en: string, h: string) => (hi ? h : en);
  async function pay() {
    setState("busy"); setErr("");
    try {
      const o = await api<{ orderId?: string; amount?: number; keyId?: string; title?: string; error?: string }>(`/api/pay/${encodeURIComponent(code)}`, { method: "POST", json: { op: "order" } });
      if (!o.ok || !o.data.orderId || !o.data.keyId) throw new Error(o.data.error || T("Payments are not available right now.", "Payment अभी उपलब्ध नहीं है।"));
      const Razorpay = await loadCheckout();
      if (!Razorpay) throw new Error(T("Could not open the payment page.", "Payment page नहीं खुला।"));
      new Razorpay({
        key: o.data.keyId, amount: o.data.amount ?? amountPaise, currency: "INR", order_id: o.data.orderId,
        prefill: payPrefill(), name: "Shubhora", description: o.data.title || "Shubhora", theme: { color: "#2f5bf5" },
        handler: async (r) => {
          setState("verifying");
          const v = await api<{ ok?: boolean; applied?: string; error?: string }>(`/api/pay/${encodeURIComponent(code)}`, { method: "POST", json: { op: "verify", orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } }).catch(() => null);
          if (v?.ok && v.data.ok) { setState("done"); onPaid?.(v.data.applied ?? ""); return; }
          // The money is taken here: say so plainly — the webhook still settles it within minutes.
          setState("error"); setErr(v?.data.error || T("Payment taken, but it could not be confirmed yet. It will show within a few minutes; if not, message us on WhatsApp.", "Payment हो गया, पर अभी confirm नहीं हो पाया। कुछ मिनट में दिख जाएगा; नहीं तो WhatsApp करें।"));
        },
        modal: { ondismiss: () => setState("idle") },
      }).open();
    } catch (e) { setState("error"); setErr(e instanceof Error ? e.message : T("Something went wrong.", "कुछ गड़बड़ हुई।")); }
  }
  if (state === "done") return <p className={`inline-flex items-center gap-1.5 text-sm font-semibold text-good ${className}`}><Check className="h-4 w-4" /> {T("Paid", "Paid")}</p>;
  return (
    <div className={className}>
      <button type="button" onClick={pay} disabled={state === "busy" || state === "verifying"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
        {(state === "busy" || state === "verifying") && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {state === "verifying" ? T("Confirming…", "Confirm हो रहा है…") : label ?? T(`Pay ₹${Math.round(amountPaise / 100).toLocaleString("en-IN")}`, `₹${Math.round(amountPaise / 100).toLocaleString("en-IN")} दें`)}
      </button>
      {err && <p className="mt-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{err}</p>}
    </div>
  );
}
