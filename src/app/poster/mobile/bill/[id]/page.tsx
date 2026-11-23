"use client";
// One bill or estimate: the slip itself, and what the counter does next — print, WhatsApp, take the udhaar payment, turn an
// estimate into a bill, or cancel it with a reason (its stock comes back; a bill is never deleted).
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Check, Undo2, FileCheck2, Link2, LoaderCircle, MessageCircle, Plus, Printer, Wallet } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { Receipt } from "@/components/mobile/receipt";
import { MsHelp } from "@/components/mobile/page-help";
import { FieldTip } from "@/components/field-tip";
import { inr, paiseOf, type Payment } from "@/lib/jewellery";
import type { BillRow, MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";

type Ans = { bill: BillRow; setup: MsSetup; access: MsAccess; shop: string; link: string; returned?: number[]; returns?: { id: string; code: string; total_paise: number }[]; from?: { id: string; code: string } | null; error?: string };

function BillView() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const made = sp.get("new");
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState<{ ok: boolean; t: string; link?: string; open?: string } | null>(
    made === "sent" ? { ok: true, t: T("✅ Saved and sent on WhatsApp.", "✅ Save हुआ और WhatsApp पर भेज दिया।") }
      : made === "notsent" ? { ok: false, t: T("Saved. But it did not go on WhatsApp — use the button below.", "Save हो गया। पर WhatsApp पर नहीं गया — नीचे के बटन से भेजें।") }
      : made ? { ok: true, t: T("✅ Saved.", "✅ Save हो गया।") } : null);
  const [busy, setBusy] = useState("");
  const [pay, setPay] = useState({ mode: "cash" as Payment["mode"], amount: "" });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [ret, setRet] = useState<{ open: boolean; qty: Record<number, string>; mode: Payment["mode"]; why: string }>({ open: false, qty: {}, mode: "cash", why: "" });
  const asQ = ws.q ? `?${ws.q}` : "";

  const load = useCallback(async () => {
    try {
      const r = await api<Ans>(`/api/mobile/bills/${id}${asQ}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setD(r.data);
    } catch { setErr("No internet. Saved bills open when the network is back."); }
  }, [id, asQ]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setNote(null);
    let r: { ok: boolean; data: { bill?: BillRow; sent?: boolean; link?: string; error?: string } };
    try { r = await api(`/api/mobile/bills/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } }); }
    catch { setBusy(""); setNote({ ok: false, t: T("No internet. Try again when the network is back.", "इंटरनेट नहीं है। नेटवर्क आने पर फिर करें।") }); return; }
    setBusy("");
    if (action === "send") {
      setNote(r.data.sent ? { ok: true, t: T("✅ Sent on WhatsApp.", "✅ WhatsApp पर भेज दिया।") } : { ok: false, t: r.data.error || T("Not sent.", "नहीं गया।"), link: r.data.link });
      return;
    }
    if (!r.ok) { setNote({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    if (action === "return" && r.data.bill) { setRet({ open: false, qty: {}, mode: "cash", why: "" }); router.push(`/poster/mobile/bill/${r.data.bill.id}${asQ ? `${asQ}&` : "?"}new=1`); return; }
    if (action === "convert" && r.data.bill) { router.push(`/poster/mobile/bill/${r.data.bill.id}${asQ ? `${asQ}&` : "?"}new=1`); return; }
    if (r.data.bill) setD((x) => (x ? { ...x, bill: r.data.bill! } : x));
    setNote({ ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
    setPay({ mode: "cash", amount: "" }); setCancelling(false);
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { bill, setup, access } = d;
  const can = (r: string) => access.owner || access.rights.includes(r as never);
  const open = bill.status === "open";
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const inp = "rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  const slip = setup.paper === "58" || setup.paper === "80";

  return (
    <div className="space-y-3">
      {/* Only the slip goes to paper. */}
      <style>{`@media print { body * { visibility: hidden !important; } .ms-doc, .ms-doc * { visibility: visible !important; } .ms-doc { position: absolute; left: 0; top: 0; } @page { margin: ${slip ? "2mm" : "8mm"}; } }`}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
        {can("bill") && <Link href={`/poster/mobile/bill${asQ}`} className="inline-flex items-center gap-1 rounded-xl grad-brand px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {T("Next bill", "अगला बिल")}</Link>}
      </div>
      <MsHelp k="billView" />

      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-4 w-4" /> Print</button>
        <button type="button" disabled={!!busy || !bill.customer_phone} onClick={() => void act("send")} className={`${btn} !border-[#25D366] !text-[#128C7E]`}>{busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {T("Send on WhatsApp", "WhatsApp पर भेजें")}</button>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(d.link).catch(() => {}); setNote({ ok: true, t: T("✅ Customer link copied.", "✅ ग्राहक का लिंक कॉपी हो गया।"), open: d.link }); }} className={btn}><Link2 className="h-4 w-4" /> {T("Copy link", "लिंक कॉपी")}</button>
        {bill.kind === "estimate" && open && can("bill") && <button type="button" disabled={!!busy} onClick={() => void act("convert")} className={`${btn} grad-brand !border-transparent text-white`}><FileCheck2 className="h-4 w-4" /> {T("Make the bill", "बिल बनाएँ")}</button>}
        {bill.kind === "sale" && bill.status !== "cancelled" && can("cancel") && <button type="button" onClick={() => setRet({ ...ret, open: !ret.open })} className={btn}><Undo2 className="h-4 w-4" /> {T("Return items", "सामान वापसी")}</button>}
        {bill.kind !== "return" && bill.status !== "cancelled" && bill.status !== "converted" && can("cancel") && <button type="button" onClick={() => setCancelling(!cancelling)} className={`${btn} text-danger`}><Ban className="h-4 w-4" /> {T("Cancel", "रद्द करें")}</button>}
      </div>
      {!bill.customer_phone && <p className="text-[12px] text-muted print:hidden">{T("No mobile on this bill, so WhatsApp is off. Copy link still works.", "इस बिल पर मोबाइल नहीं है, इसलिए WhatsApp बंद है। लिंक कॉपी चलेगा।")}</p>}
      {note && <p className={`text-sm font-semibold print:hidden ${note.ok ? "text-good" : "text-danger"}`}>{note.t} {note.link && <a href={note.link} target="_blank" rel="noreferrer" className="underline">{T("Send it yourself →", "खुद भेजें →")}</a>}{note.open && <a href={note.open} target="_blank" rel="noreferrer" className="underline">{T("Open →", "खोलें →")}</a>}</p>}

      {cancelling && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 print:hidden">
          <p className="w-full text-[12px] text-muted">{T("Cancel is for a bill made by mistake.", "रद्द करना गलती से बने बिल के लिए है।")}<FieldTip lang={lang} en="The whole bill is cancelled, all its stock comes back, and it leaves today's sale. The bill stays in the list marked Cancelled, with your reason and name." hi="पूरा बिल रद्द होता है, उसका सारा स्टॉक वापस आता है, और वो आज की बिक्री से हट जाता है। बिल list में 'रद्द' लिखा रहता है, आपकी वजह और नाम के साथ।" /></p>
          <input className={`${inp} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T("Why is it cancelled?", "क्यों रद्द कर रहे हैं?")} />
          <button type="button" disabled={!reason.trim() || !!busy} onClick={() => void act("cancel", { reason })} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Cancel this bill", "ये बिल रद्द करें")}</button>
        </div>
      )}

      {d.from && <p className="text-sm print:hidden">{T("Return against bill", "इस बिल की वापसी")}: <Link href={`/poster/mobile/bill/${d.from.id}${asQ}`} className="font-semibold text-brand-ink">{d.from.code} →</Link></p>}
      {(d.returns ?? []).length > 0 && <p className="text-sm print:hidden">{T("Returned", "वापस आया")}: {d.returns!.map((x) => <Link key={x.id} href={`/poster/mobile/bill/${x.id}${asQ}`} className="mr-2 font-semibold text-brand-ink">{x.code} ({inr(x.total_paise)}) →</Link>)}</p>}
      {ret.open && bill.kind === "sale" && (
        <section className="space-y-2 rounded-xl border border-border bg-surface p-3 print:hidden">
          <p className="text-sm font-bold">{T("What came back?", "क्या वापस आया?")}<FieldTip lang={lang} en="Use this when the customer brings back some items of a correct bill. If the whole bill was made by mistake, use Cancel instead." hi="ये तब इस्तेमाल करें जब सही बने बिल का कुछ सामान ग्राहक वापस लाए। पूरा बिल ही गलती से बना हो तो 'रद्द करें' इस्तेमाल करें।" /></p>
          <p className="text-[12px] text-muted">{T("Type how many pieces of each. The stock goes back in. If this bill has udhaar, the return first clears it; the rest is given back to the customer.", "हर item के कितने पीस वापस आए लिखें। स्टॉक वापस चढ़ जाएगा। इस बिल पर उधार हो तो वापसी पहले उधार घटाती है; बाकी ग्राहक को लौटाना है।")}</p>
          {(bill.lines ?? []).map((l, i) => { const left = l.qty - (d.returned?.[i] ?? 0); return (
            <label key={i} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{l.name}{l.imei ? ` · ${l.imei}` : ""} <span className="text-muted">({T("can return", "वापस हो सकते हैं")} {left})</span></span>
              <input className={`${inp} w-16 text-center`} inputMode="numeric" disabled={left <= 0} value={ret.qty[i] ?? ""} onChange={(e) => setRet({ ...ret, qty: { ...ret.qty, [i]: e.target.value } })} placeholder="0" /></label>); })}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{T("Give money back by", "पैसा कैसे लौटाएँ")}</span>
            <select className={inp} value={ret.mode} onChange={(e) => setRet({ ...ret, mode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select>
            <input className={`${inp} min-w-0 flex-1`} value={ret.why} onChange={(e) => setRet({ ...ret, why: e.target.value })} placeholder={T("Why? (optional)", "क्यों? (optional)")} />
            <button type="button" disabled={!!busy || !(bill.lines ?? []).some((_, i) => Number(ret.qty[i]) > 0)} onClick={() => void act("return", { qty: (bill.lines ?? []).map((_, i) => Number(ret.qty[i]) || 0), mode: ret.mode, reason: ret.why })} className="rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Take the return", "वापसी लें")}</button>
          </div>
        </section>
      )}
      {bill.kind === "return" && (bill.payments ?? []).length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">{T("No money was given back: this return was set against the bill's udhaar.", "पैसा नहीं लौटाया गया: ये वापसी बिल के उधार में से घटा दी गई।")}</p>}

      {bill.kind === "sale" && open && bill.balance_paise > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-3 print:hidden">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Wallet className="h-4 w-4" /> {T("Udhaar left", "उधार बाकी")}: <span className="text-danger">{inr(bill.balance_paise)}</span><FieldTip lang={lang} en="When the customer pays: pick how (Cash / UPI…), type the amount (or tap Full) and tap Take payment. Part payments are fine." hi="ग्राहक पैसा दे तब: कैसे दिया (Cash / UPI…) चुनें, रक़म लिखें (या 'पूरा' दबाएँ) और Take payment दबाएँ। थोड़ा-थोड़ा भी ले सकते हैं।" /></p>
          <div className="flex flex-wrap items-center gap-1.5">
            <select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option></select>
            <input className={`${inp} w-32`} inputMode="decimal" placeholder="₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <button type="button" onClick={() => setPay({ ...pay, amount: String(bill.balance_paise / 100) })} className="text-xs font-semibold text-brand-ink">{T("Full", "पूरा")}</button>
            <button type="button" disabled={!paiseOf(pay.amount) || !!busy} onClick={() => void act("pay", { payment: { mode: pay.mode, paise: paiseOf(pay.amount), ref: "" } })} className="inline-flex items-center gap-1 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" /> {T("Take payment", "पेमेंट लें")}</button>
          </div>
        </section>
      )}
      {bill.status === "cancelled" && bill.cancel_reason && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{T("Cancelled", "रद्द")}: {bill.cancel_reason}</p>}
      {can("cost") && bill.kind === "sale" && bill.status !== "cancelled" && <p className="text-[12px] text-muted print:hidden">{T("Profit on this bill", "इस बिल का मुनाफ़ा")}: <b>{inr(bill.profit_paise)}</b> <span>({T("only you see this", "ये सिर्फ़ आपको दिखता है")})</span></p>}

      <div className="overflow-x-auto rounded-2xl border border-border bg-neutral-100 py-3 shadow-card print:border-0 print:bg-white print:py-0 print:shadow-none"><Receipt bill={bill} setup={setup} shop={d.shop} /></div>
    </div>
  );
}

export default function BillPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><BillView /></Suspense>;
}
