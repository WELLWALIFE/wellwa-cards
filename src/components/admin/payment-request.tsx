"use client";
// "Request a payment" (Admin v2; owner, 1 Nov 2026): a payment link for one user at ANY agreed amount — N months of Standard or
// Premium, an advance, or a custom item (module set-up, custom work). Used from the Users page, a franchise's user list and the
// Payment links page. The link opens /pay/<code>; what it buys is applied by itself the moment it is paid (lib/payments-server.ts).
import { useEffect, useState } from "react";
import { IndianRupee, Link2, MessageCircle } from "lucide-react";
import { adminApi } from "@/lib/admin-client";
import { Btn, CopyBtn, Field, Modal, inputCls, toast } from "@/components/admin/ui";
import { KIND_LABEL, TIER_LABEL, rupeesOf, type PayKind, type PayTier, type PaymentRequest } from "@/lib/payments";
import { SAAS_PLANS, PREMIUM_FIRST_PAISE } from "@/lib/billing";

export type Made = PaymentRequest & { label: string; link: string };

export function PaymentRequestModal({ user, onClose, onMade }: { user: { id: string; name: string; phone?: string | null } | null; onClose: () => void; onMade?: (r: Made) => void }) {
  const [kind, setKind] = useState<PayKind>("plan");
  const [tier, setTier] = useState<PayTier>("growth");
  const [months, setMonths] = useState(1);
  const [rupees, setRupees] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  // The list price, as a starting point the admin can change (the whole point: the payment may differ from the package).
  const listPrice = kind === "plan" ? (tier === "premium" ? PREMIUM_FIRST_PAISE + SAAS_PLANS.growth.amount * Math.max(0, months - 1) : SAAS_PLANS.growth.amount * months) : 0;
  useEffect(() => { if (kind === "plan") setRupees(String(Math.round(listPrice / 100))); }, [kind, tier, months, listPrice]);
  useEffect(() => { if (!user) { setMade(null); setKind("plan"); setTier("growth"); setMonths(1); setTitle(""); setNote(""); } }, [user]);
  if (!user) return null;
  const amountPaise = Math.round(Number(rupees.replace(/[^\d.]/g, "")) * 100) || 0;
  const off = listPrice && amountPaise ? Math.round((1 - amountPaise / listPrice) * 100) : 0;

  async function make() {
    setBusy(true);
    const r = await adminApi<{ request: Made }>("/api/admin/v2/payments", { json: { user_id: user!.id, kind, tier: kind === "plan" ? tier : undefined, months: kind === "plan" ? months : 1, amount_paise: amountPaise, title, note } });
    setBusy(false);
    if (!r.ok) { toast(r.data.error || "Could not make the link.", "err"); return; }
    setMade(r.data.request); onMade?.(r.data.request);
  }
  const waText = made ? `Hi ${user.name.split(" ")[0] || ""}, your Shubhora payment link: ${made.link}\n${made.label} — ${rupeesOf(made.amount_paise)}${note ? `\n${note}` : ""}` : "";
  const waHref = made ? `https://wa.me/${(user.phone ?? "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(waText)}` : "";

  return (
    <Modal open title={made ? "Payment link ready" : "Request a payment"} sub={<>For <b>{user.name}</b></>} onClose={onClose}
      footer={made
        ? <Btn variant="primary" onClick={onClose}>Done</Btn>
        : <><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon={Link2} loading={busy} disabled={amountPaise < 10000} onClick={make}>Make the link</Btn></>}>
      {made ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-border bg-surface2 p-3">
            <p className="font-semibold">{made.label} · {rupeesOf(made.amount_paise)}</p>
            <p className="mt-1 break-all font-mono text-xs text-brand-ink">{made.link}</p>
            <div className="mt-2 flex flex-wrap gap-2"><CopyBtn text={made.link} label="Copy link" /><a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> Send on WhatsApp</a></div>
          </div>
          <p className="text-xs text-muted">The user opens the link, logs in with their own account and pays. {made.kind === "plan" ? "The plan starts by itself the moment it is paid." : made.kind === "advance" ? "The amount sits on their account as an advance and pays for a plan when they take one." : "You will see it as paid here; nothing else happens by itself."} Open links expire in 14 days.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_LABEL) as PayKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${kind === k ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}>
                {k === "plan" ? "Plan (Standard / Premium)" : k === "advance" ? "Advance / booking" : "Custom (module, work)"}
              </button>
            ))}
          </div>
          {kind === "plan" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan">
                <select value={tier} onChange={(e) => setTier(e.target.value as PayTier)} className={inputCls}>
                  {(Object.keys(TIER_LABEL) as PayTier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Months">
                <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={inputCls}>
                  {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          )}
          <Field label="Amount (₹)" hint={kind === "plan" ? <>List price {rupeesOf(listPrice)}{off > 0 ? <> · this is <b>{off}% off</b></> : off < 0 ? <> · {Math.abs(off)}% above list</> : null}</> : "Minimum ₹100"}>
            <div className="relative"><IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={rupees} onChange={(e) => setRupees(e.target.value)} inputMode="numeric" className={`${inputCls} pl-9`} placeholder="2999" /></div>
          </Field>
          <Field label={kind === "custom" ? "What is it for" : "Title (optional)"} hint="Shown to the user on the pay page and in the WhatsApp message">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={inputCls} placeholder={kind === "custom" ? "e.g. Orders · Silai set-up" : kind === "advance" ? "e.g. Advance for Premium" : "e.g. Standard — Diwali offer"} />
          </Field>
          <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={inputCls} placeholder="Anything agreed on the phone" /></Field>
        </div>
      )}
    </Modal>
  );
}
