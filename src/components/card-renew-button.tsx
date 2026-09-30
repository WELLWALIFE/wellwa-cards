"use client";

// ₹1,499 V-Card renewal checkout: one more year, from the later of today and the current end (renewing early loses
// nothing). Not partner business — /api/billing/verify never reports it to the partner panel (no BV).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import { CARD_RENEWAL } from "@/lib/billing";
import { BRAND } from "@/lib/site-brand";
import { api } from "@/lib/poster-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Razorpay?: any } }
const loadScript = (src: string) => new Promise<boolean>((resolve) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
  const s = document.createElement("script"); s.src = src; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
});
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Order = { error?: string; demo?: boolean; keyId?: string; amount?: number; orderId?: string };
type Verified = { ok?: boolean; result?: { expires?: string } };

export function CardRenewButton({ className, children, en = true, onDone }: {
  className?: string; children: React.ReactNode; en?: boolean; onDone?: (until: string | null) => void;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function start() {
    setState("busy"); setMsg("");
    try {
      const o = await api<Order>("/api/billing/order", { method: "POST", json: { plan: "card" } });
      if (o.status === 401) { router.push(`/login?next=${encodeURIComponent("/poster/plan?renew=card")}`); return; }
      if (!o.ok || o.data.error) throw new Error(o.data.error || (en ? "Could not start the payment." : "Payment शुरू नहीं हुआ।"));
      if (o.data.demo) { setState("error"); setMsg("Payments are not live on this environment."); return; }
      if (!(await loadScript("https://checkout.razorpay.com/v1/checkout.js")) || !window.Razorpay) {
        setState("error"); setMsg(en ? "Could not load the payment page." : "Payment page नहीं खुला।"); return;
      }
      new window.Razorpay({
        key: o.data.keyId, amount: o.data.amount, currency: "INR", order_id: o.data.orderId,
        name: BRAND, description: `${CARD_RENEWAL.label} — 1 year`, theme: { color: "#0e9e90" },
        handler: async (resp: any) => {
          const v = await api<Verified>("/api/billing/verify", { method: "POST", json: resp });
          if (v.ok && v.data.ok) {
            const until = v.data.result?.expires ?? null;
            setState("done");
            setMsg(until
              ? (en ? `Renewed — your V-Card is active till ${day(until)}.` : `Renew हो गया — आपका V-Card ${day(until)} तक चालू है।`)
              : (en ? "Renewed — your V-Card is active for one more year." : "Renew हो गया — आपका V-Card 1 साल और चालू है।"));
            onDone?.(until);
          } else {
            setState("error");
            setMsg(en ? "We could not confirm the payment. If money was deducted, contact support with the payment id." : "Payment confirm नहीं हुआ। पैसे कटे हों तो payment id के साथ support को बताएँ।");
          }
        },
        modal: { ondismiss: () => setState("idle") },
      }).open();
      setState("idle");
    } catch (e) { setState("error"); setMsg(e instanceof Error ? e.message : "Something went wrong."); }
  }

  if (state === "done") return <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check className="h-4 w-4 shrink-0" /> {msg}</p>;
  return (
    <div>
      <button type="button" onClick={start} disabled={state === "busy"} className={className}>
        {state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {children}
      </button>
      {state === "error" && <p className="mt-1 text-[11px] text-danger">{msg}</p>}
    </div>
  );
}
