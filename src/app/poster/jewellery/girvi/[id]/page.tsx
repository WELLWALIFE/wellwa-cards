"use client";
// One girvi loan: the receipt with what is due today, take a payment (interest first), release the pieces, remind, send a notice
// after the due date, extend the date, or record an auction (only 14 days after a notice).
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bell, Check, CalendarClock, Gavel, LoaderCircle, MessageCircle, PackageOpen, Printer } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr, paiseOf, type JwSetup, type Payment } from "@/lib/jewellery";
import type { GirviRow, GirviState } from "@/lib/jewellery-finance";
import { GirviReceipt } from "@/components/jewellery/finance-docs";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { girvi: GirviRow; state: GirviState; today: string; link: string; shop: string; licence: string; error?: string };

function Loan() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [setup, setSetup] = useState<JwSetup | null>(null);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState({ mode: "cash" as Payment["mode"], amount: "", ref: "" });
  const [panel, setPanel] = useState<"" | "extend" | "auction">("");
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string; link?: string } | null>(sp.get("new") ? { ok: true, t: T("✅ Loan saved.", "✅ लोन Save हुआ।") } : null);
  const asQ = ws.q ? `?${ws.q}` : "";
  const load = useCallback(async () => {
    const [r, h] = await Promise.all([api<Ans>(`/api/jewellery/girvi/${id}${asQ}`, { fresh: true }), api<{ setup: JwSetup }>(`/api/jewellery${asQ}`)]);
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setD(r.data); if (h.ok) setSetup(h.data.setup);
  }, [id, asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setMsg(null);
    const r = await api<{ girvi?: GirviRow; state?: GirviState; sent?: { sent: boolean; link: string; error?: string }; split?: { interest: number; principal: number }; error?: string; link?: string }>(`/api/jewellery/girvi/${id}`, { method: "PATCH", json: { as: ws.as || undefined, action, ...extra } });
    setBusy("");
    if (!r.ok) { setMsg({ ok: false, t: r.data.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
    if (action === "reminder" || action === "send") { const s = r.data as { sent?: boolean; link?: string; error?: string }; setMsg(s.sent ? { ok: true, t: T("✅ Sent.", "✅ भेज दिया।") } : { ok: false, t: s.error || "", link: s.link }); return; }
    if (r.data.girvi && r.data.state) setD((x) => (x ? { ...x, girvi: r.data.girvi!, state: r.data.state! } : x));
    const sp2 = r.data.split;
    const sent = r.data.sent;
    setMsg(sent && !sent.sent ? { ok: false, t: `${T("Notice saved, WhatsApp not sent", "नोटिस दर्ज, WhatsApp नहीं गया")}: ${sent.error ?? ""}`, link: sent.link }
      : { ok: true, t: sp2 ? T(`✅ Saved: interest ${inr(sp2.interest, true)}, principal ${inr(sp2.principal, true)}.`, `✅ Save: ब्याज ${inr(sp2.interest, true)}, मूल ${inr(sp2.principal, true)}।`) : T("✅ Saved.", "✅ Save हो गया।") });
    setPay({ mode: "cash", amount: "", ref: "" }); setPanel(""); setVal("");
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d || !setup) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { girvi: g, state: st } = d;
  const open = g.status === "open";
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } .jw-doc, .jw-doc * { visibility: visible !important; } .jw-doc { position: absolute; left: 0; top: 0; width: 100%; } @page { margin: 10mm; } }`}</style>
      <Link href={`/poster/jewellery/girvi${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted print:hidden"><ArrowLeft className="h-4 w-4" /> {T("Girvi", "गिरवी")}</Link>
      <PageHelp k="girviView" />
      {open && (
        <section className={`grid grid-cols-3 gap-2 rounded-2xl border p-3 print:hidden ${st.overdue ? "border-danger/50 bg-red-50/50" : "border-border bg-surface"}`}>
          <p><span className="block text-[11px] text-muted">{T("Principal", "मूल")}</span><b className="tabular-nums">{inr(st.principal, true)}</b></p>
          <p><span className="block text-[11px] text-muted">{T("Interest till today", "आज तक ब्याज")}</span><b className="tabular-nums">{inr(st.interest, true)}</b></p>
          <p><span className="block text-[11px] text-muted">{T("To release today", "आज छुड़ाने पर")}</span><b className="tabular-nums text-brand-ink">{inr(st.due, true)}</b></p>
          <p className="col-span-3 text-[11px] text-muted">{st.days} {T("days", "दिन")} · {T("due", "तारीख़")} {g.due_day}{st.overdue ? ` · ${T("OVERDUE", "तारीख़ निकल गई")}` : ""}{g.notices.length ? ` · ${T("notices", "नोटिस")}: ${g.notices.map((n) => n.day).join(", ")}` : ""}</p>
        </section>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-4 w-4" /> {T("Print receipt", "रसीद Print")}</button>
        <button type="button" disabled={!!busy} onClick={() => void act(open ? "reminder" : "send")} className={`${btn} !border-[#25D366] !text-[#128C7E]`}><MessageCircle className="h-4 w-4" /> {open ? T("Send reminder", "याद दिलाएँ") : T("Send receipt", "रसीद भेजें")}</button>
        {open && st.due === 0 && <button type="button" disabled={!!busy} onClick={() => void act("close")} className={`${btn} grad-brand !border-transparent text-white`}><PackageOpen className="h-4 w-4" /> {T("Release the pieces", "सामान लौटाएँ")}</button>}
        {open && <button type="button" onClick={() => setPanel(panel === "extend" ? "" : "extend")} className={btn}><CalendarClock className="h-4 w-4" /> {T("Extend date", "तारीख़ बढ़ाएँ")}</button>}
        {open && st.overdue && <button type="button" disabled={!!busy} onClick={() => void act("notice")} className={`${btn} text-amber-800`}><Bell className="h-4 w-4" /> {T("Send notice", "नोटिस भेजें")}</button>}
        {open && st.overdue && g.notices.length > 0 && <button type="button" onClick={() => setPanel(panel === "auction" ? "" : "auction")} className={`${btn} text-danger`}><Gavel className="h-4 w-4" /> {T("Record auction", "नीलामी दर्ज")}</button>}
      </div>
      {open && st.due > 0 && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 print:hidden">
          <p className="text-sm font-bold">{T("Take a payment", "पैसे लें")} <span className="font-normal text-muted">· {T("interest first, then principal", "पहले ब्याज, फिर मूल")}</span></p>
          <div className="flex flex-wrap gap-2">
            <select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })} className="rounded-lg border border-border bg-surface px-2 py-2 text-sm"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></select>
            <input value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} inputMode="decimal" className="w-28 rounded-lg border border-border bg-surface px-2 py-2 text-sm" placeholder="₹" />
            <button type="button" onClick={() => setPay({ ...pay, amount: String(st.interest / 100) })} className="text-xs font-semibold text-brand-ink">{T("Interest only", "सिर्फ़ ब्याज")}</button>
            <button type="button" onClick={() => setPay({ ...pay, amount: String(st.due / 100) })} className="text-xs font-semibold text-brand-ink">{T("Full", "पूरा")}</button>
            <button type="button" disabled={!!busy || paiseOf(pay.amount) <= 0} onClick={() => void act("pay", { payment: { mode: pay.mode, paise: paiseOf(pay.amount), ref: pay.ref } })} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "pay" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Save", "Save")}</button>
          </div>
        </section>
      )}
      {panel === "extend" && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <input type="date" value={val} onChange={(e) => setVal(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-2 text-sm" />
          <button type="button" disabled={!val || !!busy} onClick={() => void act("extend", { due_day: val })} className="rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Save date", "तारीख़ Save")}</button>
        </div>
      )}
      {panel === "auction" && (
        <div className="space-y-2 rounded-2xl border border-danger/40 bg-red-50/40 p-3 print:hidden">
          <p className="text-xs text-danger">{T("Record an auction only after following your state's law and licence conditions (notice, waiting time, public sale). Write the sale amount and how the balance was settled with the customer.", "नीलामी तभी दर्ज करें जब राज्य के क़ानून और लाइसेंस की शर्तें (नोटिस, इंतज़ार, सार्वजनिक बिक्री) पूरी हों। बिक्री की रकम और ग्राहक से बचा हिसाब कैसे निपटा, लिखें।")}</p>
          <input value={val} onChange={(e) => setVal(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm" placeholder={T("Sold for ₹…, balance ₹… returned to the customer on …", "₹… में बिका, बचे ₹… ग्राहक को … को लौटाए")} />
          <button type="button" disabled={val.trim().length < 10 || !!busy} onClick={() => void act("auction", { note: val })} className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{T("Record auction", "नीलामी दर्ज करें")}</button>
        </div>
      )}
      {msg && <p className={`text-sm font-semibold print:hidden ${msg.ok ? "text-good" : "text-danger"}`}>{msg.t} {msg.link && <a href={msg.link} target="_blank" rel="noreferrer" className="underline">{T("Send it yourself →", "खुद भेजें →")}</a>}</p>}
      <div className="overflow-x-auto rounded-2xl border border-border"><GirviReceipt g={g} st={st} setup={setup} shop={d.shop} licence={d.licence} /></div>
    </div>
  );
}

export default function LoanPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Loan /></Suspense>;
}
