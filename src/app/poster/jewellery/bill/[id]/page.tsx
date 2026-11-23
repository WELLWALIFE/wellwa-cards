"use client";
// One bill or estimate: the printed bill itself, and what the counter does next — WhatsApp it, print it, take a payment, set the
// due date, turn an estimate into a bill, or cancel it with a reason (a bill is never deleted).
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Check, FileCheck2, Link2, LoaderCircle, MessageCircle, Printer, Wallet } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { Invoice } from "@/components/jewellery/invoice";
import { inr, paiseOf, type BillRow, type JwSetup, type Payment } from "@/lib/jewellery";
import type { JwAccess } from "@/lib/jewellery-types";

type Ans = { bill: BillRow; setup: JwSetup; access: JwAccess; shop: string; link: string; error?: string };

function BillView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState<{ ok: boolean; t: string; link?: string; open?: string } | null>(sp.get("new") ? { ok: true, t: T("✅ Saved.", "✅ Save हो गया।") } : null);
  const [busy, setBusy] = useState("");
  const [pay, setPay] = useState({ mode: "cash" as Payment["mode"], amount: "", ref: "" });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const asQ = ws.q ? `?${ws.q}` : "";

  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/bills/${id}${asQ}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setD(r.data);
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setNote(null);
    const r = await api<{ bill?: BillRow; sent?: boolean; link?: string; error?: string }>(`/api/jewellery/bills/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } });
    setBusy("");
    if (!r.ok) { setNote({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    if (action === "send") {
      setNote(r.data.sent ? { ok: true, t: T("✅ Sent on WhatsApp.", "✅ WhatsApp पर भेज दिया।") } : { ok: false, t: r.data.error || T("Not sent.", "नहीं गया।"), link: r.data.link });
      return;
    }
    if (action === "convert" && r.data.bill) { router.push(`/poster/jewellery/bill/${r.data.bill.id}${asQ ? `${asQ}&` : "?"}new=1`); return; }
    if (r.data.bill) setD((x) => (x ? { ...x, bill: r.data.bill! } : x));
    setNote({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
    setPay({ mode: "cash", amount: "", ref: "" }); setCancelling(false);
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { bill, setup, access } = d;
  const can = (r: string) => access.owner || access.rights.includes(r as never);
  const open = bill.status === "open";
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const inp = "rounded-lg border border-border bg-surface px-2 py-2 text-sm";

  return (
    <div className="space-y-3">
      {/* Only the bill goes to paper. */}
      <style>{`@media print { body * { visibility: hidden !important; } .jw-invoice, .jw-invoice * { visibility: visible !important; } .jw-invoice { position: absolute; left: 0; top: 0; width: 100%; } @page { margin: 10mm; } }`}</style>
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted print:hidden"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" disabled={!!busy || !bill.customer_phone} onClick={() => void act("send")} className={`${btn} !border-[#25D366] !text-[#128C7E]`}>{busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {T("Send on WhatsApp", "WhatsApp पर भेजें")}</button>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(d.link).catch(() => {}); setNote({ ok: true, t: T("✅ Customer link copied.", "✅ ग्राहक का लिंक कॉपी हो गया।"), open: d.link }); }} className={btn}><Link2 className="h-4 w-4" /> {T("Copy link", "लिंक कॉपी")}</button>
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-4 w-4" /> {T("Print / PDF", "Print / PDF")}</button>
        {bill.kind === "estimate" && open && can("bill") && <button type="button" disabled={!!busy} onClick={() => void act("convert")} className={`${btn} grad-brand !border-transparent text-white`}><FileCheck2 className="h-4 w-4" /> {T("Make the bill", "बिल बनाएँ")}</button>}
        {bill.status !== "cancelled" && can("cancel") && <button type="button" onClick={() => setCancelling(!cancelling)} className={`${btn} text-danger`}><Ban className="h-4 w-4" /> {T("Cancel", "रद्द करें")}</button>}
      </div>
      {note && <p className={`text-sm font-semibold print:hidden ${note.ok ? "text-good" : "text-danger"}`}>{note.t} {note.link && <a href={note.link} target="_blank" rel="noreferrer" className="underline">{T("Send it yourself →", "खुद भेजें →")}</a>}{note.open && <a href={note.open} target="_blank" rel="noreferrer" className="underline">{T("Open →", "खोलें →")}</a>}</p>}

      {cancelling && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 print:hidden">
          <input className={`${inp} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T("Why is it cancelled?", "क्यों रद्द कर रहे हैं?")} />
          <button type="button" disabled={!reason.trim() || !!busy} onClick={() => void act("cancel", { reason })} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Cancel this bill", "ये बिल रद्द करें")}</button>
        </div>
      )}

      {bill.kind === "sale" && open && bill.balance_paise > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-3 print:hidden">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Wallet className="h-4 w-4" /> {T("Balance due", "बाकी")}: <span className="text-danger">{inr(bill.balance_paise)}</span>{bill.due_date && <span className="font-normal text-muted">· {T("by", "तक")} {bill.due_date}</span>}</p>
          <div className="flex flex-wrap gap-1.5">
            <select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })}><option value="cash">{T("Cash", "नकद")}</option><option value="upi">UPI</option><option value="card">{T("Card", "कार्ड")}</option><option value="bank">{T("Bank", "बैंक")}</option><option value="cheque">{T("Cheque", "चेक")}</option></select>
            <input className={`${inp} w-32`} inputMode="decimal" placeholder="₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <input className={`${inp} w-32`} placeholder="Ref" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} />
            <button type="button" onClick={() => setPay({ ...pay, amount: String(bill.balance_paise / 100) })} className="text-xs font-semibold text-brand-ink">{T("Full", "पूरा")}</button>
            <button type="button" disabled={!paiseOf(pay.amount) || !!busy} onClick={() => void act("pay", { payment: { mode: pay.mode, paise: paiseOf(pay.amount), ref: pay.ref } })} className="inline-flex items-center gap-1 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" /> {T("Take payment", "पेमेंट लें")}</button>
          </div>
          <label className="flex items-center gap-2 text-xs">{T("Due date", "कब तक")}: <input type="date" className={inp} defaultValue={bill.due_date ?? ""} onBlur={(e) => { if ((e.target.value || null) !== bill.due_date) void act("due", { due_date: e.target.value }); }} /></label>
        </section>
      )}
      {bill.status === "cancelled" && bill.cancel_reason && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{T("Cancelled", "रद्द")}: {bill.cancel_reason}</p>}

      <div className="overflow-x-auto rounded-2xl border border-border shadow-card print:border-0 print:shadow-none"><Invoice bill={bill} setup={setup} shop={d.shop} /></div>
    </div>
  );
}

export default function BillPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><BillView /></Suspense>;
}
