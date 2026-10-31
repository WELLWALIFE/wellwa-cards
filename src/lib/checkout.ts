"use client";
// Razorpay's checkout script, loaded once, and its types — shared by the pay page and the plan page's flexible payments
// (components/poster/plan-pay.tsx keeps its own copy for the older plan buttons).
export type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
export type RzpOptions = {
  key: string; amount: number; currency: string; order_id: string; name: string; description: string;
  prefill?: { contact?: string; email?: string; name?: string }; theme: { color: string }; handler: (r: RzpResponse) => void; modal: { ondismiss: () => void };
};
export type RzpCtor = new (o: RzpOptions) => { open: () => void };
const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";

export function loadCheckout(): Promise<RzpCtor | null> {
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
