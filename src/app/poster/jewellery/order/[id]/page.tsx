"use client";
// One order or repair: where it is (Booked → With karigar → Ready → Delivered), the next step in one button, the advance, the date,
// the karigar entries for it, its timeline, and the receipt (print / customer link / WhatsApp). An order is delivered by making its
// bill (the builder opens filled, the advance counted); a repair against its charge.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Check, Hammer, Link2, LoaderCircle, MessageCircle, PackageCheck, Printer, ReceiptText, Wallet } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { grams, inr, paiseOf, type JwSetup, type Payment } from "@/lib/jewellery";
import { ORDER_STATUSES, TXN_KINDS, orderPaid, overdue, type Karigar, type KarigarTxn, type OrderRow } from "@/lib/jewellery-orders";
import type { JwAccess } from "@/lib/jewellery-types";
import { OrderReceipt } from "@/components/jewellery/order-receipt";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { order: OrderRow; karigars: Karigar[]; txns: KarigarTxn[]; setup: JwSetup; access: JwAccess; shop: string; link: string; error?: string };
const STEPS = ["booked", "karigar", "ready", "delivered"] as const;

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState<{ ok: boolean; t: string; link?: string; open?: string } | null>(sp.get("new") ? { ok: true, t: T("✅ Saved.", "✅ Save हो गया।") } : null);
  const [busy, setBusy] = useState("");
  const [pay, setPay] = useState({ mode: "cash" as Payment["mode"], amount: "", ref: "" });
  const [kg, setKg] = useState("");
  const [sendToo, setSendToo] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const asQ = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";

  const load = useCallback(async () => {
    const r = await api<Ans>(`/api/jewellery/orders/${id}${asQ}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setD(r.data); setKg(r.data.order.karigar_id ?? "");
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);
  const kname = useMemo(() => Object.fromEntries((d?.karigars ?? []).map((k) => [k.id, k.name])), [d]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setNote(null);
    const r = await api<{ order?: OrderRow; sent?: { sent: boolean; link: string; error?: string } | null; link?: string; error?: string }>(`/api/jewellery/orders/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } });
    setBusy("");
    if (!r.ok) { setNote({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    if (action === "send") {
      const s = r.data as { sent?: boolean; link?: string; error?: string };
      setNote(s.sent ? { ok: true, t: T("✅ Sent on WhatsApp.", "✅ WhatsApp पर भेज दिया।") } : { ok: false, t: s.error || T("Not sent.", "नहीं गया।"), link: s.link });
      return;
    }
    if (r.data.order) setD((x) => (x ? { ...x, order: r.data.order! } : x));
    const s = r.data.sent;
    setNote(s && !s.sent ? { ok: false, t: `${T("Saved, but WhatsApp not sent", "Save हुआ, पर WhatsApp नहीं गया")}: ${s.error ?? ""}`, link: s.link } : { ok: true, t: s?.sent ? T("✅ Saved and sent on WhatsApp.", "✅ Save हुआ और WhatsApp पर भेज दिया।") : T("✅ Saved.", "✅ Save हो गया।") });
    setPay({ mode: "cash", amount: "", ref: "" }); setCancelling(false);
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const o = d.order;
  const can = (r: string) => d.access.owner || d.access.rights.includes(r as never);
  const repair = o.kind === "repair";
  const open = o.status !== "delivered" && o.status !== "cancelled";
  const paid = orderPaid(o);
  const left = Math.max(0, o.est_paise - paid);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const inp = "rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  // A piece made or mended in the shop itself never went to a karigar: that step is left out.
  const steps = STEPS.filter((s) => s !== "karigar" || !!o.karigar_id || o.status === "karigar");
  const stepAt = steps.indexOf(o.status as (typeof STEPS)[number]);

  return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } .jw-invoice, .jw-invoice * { visibility: visible !important; } .jw-invoice { position: absolute; left: 0; top: 0; width: 100%; } @page { margin: 10mm; } }`}</style>
      <Link href={`/poster/jewellery/orders${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted print:hidden"><ArrowLeft className="h-4 w-4" /> {T("Orders & repairs", "ऑर्डर और रिपेयर")}</Link>

      <div className="print:hidden">
        <h1 className="text-lg font-bold">{repair ? "🔧" : "💍"} {o.code} <span className="text-sm font-normal text-muted">· {o.customer_name || o.customer_phone}</span></h1>
        {o.status === "cancelled" ? <p className="mt-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{T("Cancelled", "रद्द")}: {o.cancel_reason}</p> : (
          <ol className={`mt-2 grid ${steps.length === 4 ? "grid-cols-4" : "grid-cols-3"} gap-1 text-center text-[11px] font-semibold`}>
            {steps.map((s, i) => { const st = ORDER_STATUSES.find((x) => x.key === s)!; return <li key={s} className={`rounded-lg px-1 py-1.5 ${i <= stepAt ? "bg-brand/15 text-brand-ink" : "bg-surface2 text-muted"}`}>{i < stepAt ? "✓ " : ""}{hi ? st.hi : st.en}</li>; })}
          </ol>
        )}
        {overdue(o, today) && <p className="mt-1 text-xs font-bold text-danger">{T("Late — the customer was promised ", "देर — ग्राहक को तारीख़ दी थी ")}{o.due_date}</p>}
      </div>
      <PageHelp k="orderView" />

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" disabled={!!busy || !o.customer_phone} onClick={() => void act("send")} className={`${btn} !border-[#25D366] !text-[#128C7E]`}><MessageCircle className="h-4 w-4" /> {T("Send on WhatsApp", "WhatsApp पर भेजें")}</button>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(d.link).catch(() => {}); setNote({ ok: true, t: T("✅ Receipt link copied.", "✅ रसीद का लिंक कॉपी हो गया।"), open: d.link }); }} className={btn}><Link2 className="h-4 w-4" /> {T("Copy link", "लिंक कॉपी")}</button>
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-4 w-4" /> {T("Print receipt", "रसीद print")}</button>
        {open && can("cancel") && <button type="button" onClick={() => setCancelling(!cancelling)} className={`${btn} text-danger`}><Ban className="h-4 w-4" /> {T("Cancel", "रद्द करें")}</button>}
      </div>
      {note && <p className={`text-sm font-semibold print:hidden ${note.ok ? "text-good" : "text-danger"}`}>{note.t} {note.link && <a href={note.link} target="_blank" rel="noreferrer" className="underline">{T("Send it yourself →", "खुद भेजें →")}</a>}{note.open && <a href={note.open} target="_blank" rel="noreferrer" className="underline">{T("Open →", "खोलें →")}</a>}</p>}
      {cancelling && (
        <div className="flex gap-2 print:hidden">
          <input className={`${inp} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T("Why is it cancelled?", "क्यों रद्द कर रहे हैं?")} />
          <button type="button" disabled={!reason.trim() || !!busy} onClick={() => void act("cancel", { reason })} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Cancel it", "रद्द करें")}</button>
        </div>
      )}
      {o.status === "cancelled" && paid > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 print:hidden">{T(`Advance ${inr(paid)} was taken — return it or adjust it in the customer's next bill.`, `एडवांस ${inr(paid)} लिया था — लौटाएँ या ग्राहक के अगले बिल में adjust करें।`)}</p>}

      {/* The next step. */}
      {open && (
        <section className="space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-3 print:hidden">
          {(o.status === "booked" || o.status === "karigar") && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1"><span className="mb-0.5 block text-[11px] font-semibold text-muted">{T("Karigar", "कारीगर")}</span>
                  <select className={`${inp} w-full`} value={kg} onChange={(e) => setKg(e.target.value)}><option value="">{T("Not given yet", "अभी नहीं दिया")}</option>{d.karigars.filter((k) => k.active || k.id === o.karigar_id).map((k) => <option key={k.id} value={k.id}>{k.name}{k.skill ? ` · ${k.skill}` : ""}</option>)}</select>
                </label>
                <button type="button" disabled={!!busy || kg === (o.karigar_id ?? "")} onClick={() => void act("karigar", { karigar_id: kg || null })} className={btn}><Hammer className="h-4 w-4" /> {T("Save", "Save")}</button>
              </div>
              {d.karigars.length === 0 && can("karigar") && <Link href={`/poster/jewellery/karigars${asQ}`} className="text-xs font-semibold text-brand-ink">{T("+ Add your karigars first", "+ पहले अपने कारीगर जोड़ें")}</Link>}
              {o.karigar_id && can("karigar") && <Link href={`/poster/jewellery/karigars/${o.karigar_id}${amp}order=${o.id}`} className="block text-xs font-semibold text-brand-ink">{T(`Write gold given to / work received from ${kname[o.karigar_id] ?? "the karigar"} →`, `${kname[o.karigar_id] ?? "कारीगर"} को दिया सोना / आया माल लिखें →`)}</Link>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={!!busy} onClick={() => void act("ready", { send: sendToo })} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "ready" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Mark ready", "तैयार हो गया")}</button>
                {o.customer_phone && <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={sendToo} onChange={(e) => setSendToo(e.target.checked)} /> {T("Tell the customer on WhatsApp", "ग्राहक को WhatsApp पर बताएँ")}</label>}
              </div>
            </>
          )}
          {o.status === "ready" && !repair && (
            can("bill")
              ? <Link href={`/poster/jewellery/bill${amp}order=${o.id}`} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white"><ReceiptText className="h-4 w-4" /> {T("Make the bill and deliver", "बिल बनाएँ और दें")}</Link>
              : <p className="text-sm">{T("Ready. Someone with the billing right makes the bill to deliver it.", "तैयार है। बिल बनाने वाला बिल बनाकर देगा।")}</p>
          )}
          {o.status === "ready" && repair && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{T("Deliver", "ग्राहक को दें")}{left > 0 ? ` · ${T("balance", "बाकी")} ${inr(left)}` : ""}</p>
              <div className="flex flex-wrap gap-2">
                <select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })}>{(["cash", "upi", "card", "bank"] as const).map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select>
                <input className={`${inp} w-28`} inputMode="decimal" placeholder="₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                {left > 0 && <button type="button" onClick={() => setPay({ ...pay, amount: String(left / 100) })} className="text-xs font-semibold text-brand-ink">{T("Full", "पूरा")}</button>}
                <button type="button" disabled={!!busy} onClick={() => void act("deliver", { send: sendToo, payment: paiseOf(pay.amount) > 0 ? { mode: pay.mode, paise: paiseOf(pay.amount), ref: pay.ref } : undefined })} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><PackageCheck className="h-4 w-4" /> {T("Delivered", "दे दिया")}</button>
              </div>
            </div>
          )}
        </section>
      )}
      {o.bill_id && <Link href={`/poster/jewellery/bill/${o.bill_id}${asQ}`} className="block text-sm font-semibold text-brand-ink print:hidden">{T("See the bill →", "बिल देखें →")}</Link>}

      {/* Advance and date (a ready repair takes its money in the Deliver box above). */}
      {open && !(repair && o.status === "ready") && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 print:hidden">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Wallet className="h-4 w-4" /> {T("Advance", "एडवांस")}: {inr(paid)}{o.est_paise > 0 ? <span className="font-normal text-muted"> / {repair ? T("charge", "चार्ज") : T("estimate", "अनुमान")} {inr(o.est_paise)}</span> : null}</p>
          <div className="flex flex-wrap gap-2">
            <select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })}>{(["cash", "upi", "card", "bank", "cheque"] as const).map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select>
            <input className={`${inp} w-28`} inputMode="decimal" placeholder="₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <input className={`${inp} w-28`} placeholder="Ref" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} />
            <button type="button" disabled={!!busy || paiseOf(pay.amount) <= 0} onClick={() => void act("pay", { payment: { mode: pay.mode, paise: paiseOf(pay.amount), ref: pay.ref } })} className={btn}>{T("Take advance", "एडवांस लें")}</button>
          </div>
          <label className="flex items-center gap-2 text-xs"><span className="text-muted">{repair ? T("Ready by", "कब तक तैयार") : T("Delivery by", "डिलीवरी")}</span><input type="date" className={inp} defaultValue={o.due_date ?? ""} onChange={(e) => void act("edit", { due_date: e.target.value || null })} /></label>
        </section>
      )}

      {d.txns.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-3 print:hidden">
          <h2 className="mb-1 text-sm font-bold">{T("Karigar entries for this order", "इस ऑर्डर की कारीगर entries")}</h2>
          {d.txns.map((t) => { const k = TXN_KINDS.find((x) => x.key === t.kind); return <p key={t.id} className={`text-xs ${t.voided ? "text-muted line-through" : ""}`}>{t.day} · {kname[t.karigar_id] ?? ""} · {k ? (hi ? k.hi : k.en) : t.kind} · {t.paise ? inr(t.paise) : `${grams(t.gross_mg)} @ ${t.touch_bp / 100}% = ${grams(t.fine_mg)} fine${t.wastage_mg ? ` + ${grams(t.wastage_mg)} wastage` : ""}`}</p>; })}
        </section>
      )}

      <details className="rounded-2xl border border-border bg-surface p-3 print:hidden">
        <summary className="cursor-pointer text-sm font-bold">{T("Timeline", "क्या-क्या हुआ")}</summary>
        <ul className="mt-2 space-y-1">{[...(o.events ?? [])].reverse().map((e, i) => <li key={i} className="text-xs"><span className="text-muted">{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> · {e.text}{e.by ? <span className="text-muted"> — {e.by}</span> : null}</li>)}</ul>
      </details>

      <div className="overflow-x-auto rounded-2xl border border-border print:border-0"><OrderReceipt order={o} setup={d.setup} shop={d.shop} /></div>
    </div>
  );
}

export default function OrderPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><OrderView /></Suspense>;
}
