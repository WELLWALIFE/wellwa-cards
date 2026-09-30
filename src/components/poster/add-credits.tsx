"use client";
// "Credits kam hain" box with packs → Razorpay checkout → credits granted.
import { useEffect, useState } from "react";
import { LoaderCircle, Coins } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
type Rz = { open: () => void };
export function AddCredits({ need, have, onDone }: { need?: number; have?: number; onDone?: () => void }) {
  const { lang } = useT(); const hi = lang !== "en";
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  // The server decides the price list: subscribers get the cheaper packs.
  const [packs, setPacks] = useState<{ credits: number; price: string }[]>([]);
  const [subscribed, setSubscribed] = useState(true);
  useEffect(() => {
    api<{ subscribed?: boolean; packs?: { credits: number; paise: number }[] }>("/api/poster/pay/credits").then((r) => {
      if (!r.ok) return;
      setSubscribed(!!r.data.subscribed);
      setPacks((r.data.packs ?? []).map((p) => ({ credits: p.credits, price: `₹${(p.paise / 100).toLocaleString("en-IN")}` })));
    });
  }, []);
  async function buy(credits: number) {
    setBusy(credits); setMsg("");
    const o = await api<{ orderId?: string; amount?: number; currency?: string; keyId?: string; message?: string; error?: string }>("/api/poster/pay/credits", { method: "POST", json: { pack: credits } });
    if (!o.ok || !o.data.orderId) { setMsg(o.data.message || o.data.error || "Payment unavailable"); setBusy(null); return; }
    if (!document.querySelector('script[src*="checkout.razorpay.com"]')) { await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(); s.onerror = () => rej(new Error("load")); document.body.appendChild(s); }).catch(() => setMsg("Checkout load nahi hua")); }
    const RZ = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => Rz }).Razorpay; if (!RZ) { setBusy(null); return; }
    new RZ({ key: o.data.keyId, amount: o.data.amount, currency: o.data.currency, name: "Shubhora", description: `${credits} credits`, order_id: o.data.orderId, theme: { color: "#0e9e90" },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await api<{ ok?: boolean; error?: string }>("/api/poster/pay/credits", { method: "POST", json: { pack: credits, orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature } });
        setBusy(null); setMsg(v.ok ? (hi ? `✅ ${credits} credits जुड़ गए` : `✅ ${credits} credits added`) : (v.data.error || "verify failed")); onDone?.();
      }, modal: { ondismiss: () => setBusy(null) } }).open();
  }
  return (
    <div className="rounded-xl border border-brand bg-brand-soft/50 p-3 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5"><Coins className="h-4 w-4 text-brand" /> {need !== undefined && have !== undefined ? (hi ? `Credits कम हैं — चाहिए ${need}, हैं ${have}` : `Not enough credits — need ${need}, have ${have}`) : (hi ? "Credits जोड़ें" : "Add credits")}</p>
      <p className="text-[11px] text-muted">{subscribed ? "Subscriber price · credits never expire" : "Pay-as-you-go price · subscribers pay about a third less per credit"}</p>
      <div className="grid grid-cols-3 gap-2">{packs.map((p) => <button key={p.credits} type="button" disabled={busy !== null} onClick={() => buy(p.credits)} className="rounded-lg bg-surface border border-border px-2 py-2 text-center disabled:opacity-60"><span className="block text-sm font-bold">{busy === p.credits ? <LoaderCircle className="h-4 w-4 animate-spin mx-auto" /> : p.credits}</span><span className="block text-[11px] text-muted">{p.price}</span></button>)}</div>
      {msg && <p className="text-xs">{msg}</p>}
      <a href="https://wa.me/917665669888?text=Shubhora%20credits%20chahiye" className="block text-[11px] text-brand-ink">{hi ? "या WhatsApp पर credits लें →" : "or get credits on WhatsApp →"}</a>
    </div>
  );
}
