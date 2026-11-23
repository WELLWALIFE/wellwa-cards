"use client";
// One gold scheme member: the passbook, take an instalment (WhatsApp the receipt), use it on a bill, or close it early with a note.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Ban, Check, LoaderCircle, MessageCircle, Printer, ReceiptText } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr, paiseOf, type JwSetup, type Payment } from "@/lib/jewellery";
import type { SchemeRow, SchemeState } from "@/lib/jewellery-finance";
import { SchemePassbook } from "@/components/jewellery/finance-docs";

type Ans = { scheme: SchemeRow; state: SchemeState; today: string; link: string; shop: string; error?: string };

function Member() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [setup, setSetup] = useState<JwSetup | null>(null);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState({ mode: "cash" as Payment["mode"], amount: "", ref: "", send: true });
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string; link?: string } | null>(sp.get("new") ? { ok: true, t: T("✅ Member added.", "✅ मेंबर जुड़ गया।") } : null);
  const asQ = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  const load = useCallback(async () => {
    const [r, h] = await Promise.all([api<Ans>(`/api/jewellery/schemes/${id}${asQ}`, { fresh: true }), api<{ setup: JwSetup }>(`/api/jewellery${asQ}`)]);
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setD(r.data); if (h.ok) setSetup(h.data.setup);
    setPay((p) => (p.amount ? p : { ...p, amount: String(r.data.scheme.plan.monthlyPaise / 100) }));
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setMsg(null);
    const r = await api<{ scheme?: SchemeRow; state?: SchemeState; sent?: { sent: boolean; link: string; error?: string } | null; error?: string; link?: string }>(`/api/jewellery/schemes/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } });
    setBusy("");
    if (!r.ok) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    if (action === "send") { const s = r.data as { sent?: boolean; link?: string; error?: string }; setMsg(s.sent ? { ok: true, t: T("✅ Sent.", "✅ भेज दिया।") } : { ok: false, t: s.error || "", link: s.link }); return; }
    if (r.data.scheme && r.data.state) setD((x) => (x ? { ...x, scheme: r.data.scheme!, state: r.data.state! } : x));
    const s = r.data.sent;
    setMsg(s && !s.sent ? { ok: false, t: `${T("Saved, WhatsApp not sent", "Save हुआ, WhatsApp नहीं गया")}: ${s.error ?? ""}`, link: s.link } : { ok: true, t: T("✅ Saved.", "✅ Save हो गया।") });
    setClosing(false);
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d || !setup) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { scheme: s, state: st } = d;
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } .jw-doc, .jw-doc * { visibility: visible !important; } .jw-doc { position: absolute; left: 0; top: 0; width: 100%; } @page { margin: 10mm; } }`}</style>
      <Link href={`/poster/jewellery/schemes${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted print:hidden"><ArrowLeft className="h-4 w-4" /> {T("Gold scheme", "गोल्ड स्कीम")}</Link>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" disabled={!!busy} onClick={() => void act("send")} className={`${btn} !border-[#25D366] !text-[#128C7E]`}><MessageCircle className="h-4 w-4" /> {T("Send passbook", "पासबुक भेजें")}</button>
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-4 w-4" /> {T("Print", "Print")}</button>
        {s.status === "active" && <Link href={`/poster/jewellery/bill${amp}scheme=${s.id}`} className={`${btn} grad-brand !border-transparent text-white`}><ReceiptText className="h-4 w-4" /> {T("Use on a bill", "बिल में लगाएँ")}</Link>}
        {s.status === "active" && <button type="button" onClick={() => setClosing(!closing)} className={`${btn} text-danger`}><Ban className="h-4 w-4" /> {T("Close early", "बीच में बंद")}</button>}
      </div>
      {s.status === "active" && !st.complete && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 print:hidden">
          <p className="text-sm font-bold">{T("Take an instalment", "किस्त लें")} <span className="font-normal text-muted">· {st.installments}/{s.plan.months}{st.behind ? ` · ${st.behind} ${T("behind", "बाकी")}` : ""}</span></p>
          <div className="flex flex-wrap gap-2">
            <select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })} className="rounded-lg border border-border bg-surface px-2 py-2 text-sm"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option></select>
            <input value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} inputMode="decimal" className="w-28 rounded-lg border border-border bg-surface px-2 py-2 text-sm" placeholder="₹" />
            <input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} className="w-28 rounded-lg border border-border bg-surface px-2 py-2 text-sm" placeholder="Ref / UTR" />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={pay.send} onChange={(e) => setPay({ ...pay, send: e.target.checked })} /> WhatsApp</label>
            <button type="button" disabled={!!busy || paiseOf(pay.amount) <= 0} onClick={() => void act("pay", { payment: { mode: pay.mode, paise: paiseOf(pay.amount), ref: pay.ref }, send: pay.send })} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "pay" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Save", "Save")}</button>
          </div>
        </section>
      )}
      {s.status === "active" && st.complete && <p className="rounded-xl bg-good/10 px-3 py-2 text-sm font-semibold text-good print:hidden">{st.matured ? T(`All paid and matured — ${inr(st.value)} can go on a bill (with the bonus).`, `सब जमा और समय पूरा — ${inr(st.value)} बिल में लग सकता है (बोनस के साथ)।`) : T(`All paid. The bonus comes on ${st.maturity}; using it earlier gives the deposits only.`, `सब जमा। बोनस ${st.maturity} से मिलेगा; पहले लगाने पर सिर्फ़ जमा रकम।`)}</p>}
      {closing && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm" placeholder={T("How were the deposits settled? (returned in cash / …)", "जमा पैसे कैसे निपटाए? (नकद लौटाए / …)")} />
          <button type="button" disabled={!note.trim() || !!busy} onClick={() => void act("close", { note })} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Close the scheme", "स्कीम बंद करें")}</button>
        </div>
      )}
      {msg && <p className={`text-sm font-semibold print:hidden ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t} {msg.link && <a href={msg.link} target="_blank" rel="noreferrer" className="underline">{T("Send it yourself →", "खुद भेजें →")}</a>}</p>}
      {s.close_note && <p className="text-xs text-muted print:hidden">{s.close_note}</p>}
      <div className="overflow-x-auto rounded-2xl border border-border"><SchemePassbook s={s} st={st} setup={setup} shop={d.shop} /></div>
    </div>
  );
}

export default function MemberPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Member /></Suspense>;
}
