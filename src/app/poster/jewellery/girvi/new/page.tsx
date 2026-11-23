"use client";
// A new girvi loan: the borrower (name, mobile, address, ID kind + last 4 digits only), the pieces kept (weight, touch → fine),
// the valuation (suggested from today's buy rate) and the loan (at most the shop's % of the valuation).
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { fineBuyRate, grams, inr, mgOf, paiseOf, type JwSetup, type Metal, type RateBook } from "@/lib/jewellery";
import type { GirviRow } from "@/lib/jewellery-finance";
import { JwTip } from "@/components/jewellery/jw-tip";

type Home = { setup: JwSetup; rate: RateBook | null; error?: string };
type ItemDraft = { desc: string; metal: Metal; gross: string; net: string; touch: string; pieces: string };
const fine = (it: ItemDraft) => Math.round(((mgOf(it.net) || mgOf(it.gross)) * Math.round((Number(it.touch) || 0) * 100)) / 10000);
const blank = (): ItemDraft => ({ desc: "", metal: "gold", gross: "", net: "", touch: "91.6", pieces: "1" });

export default function NewGirvi() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [h, setH] = useState<Home | null>(null);
  const [c, setC] = useState({ name: "", phone: "", address: "", idKind: "Aadhaar", idNumber: "" });
  const [items, setItems] = useState<ItemDraft[]>([blank()]);
  const [valuation, setValuation] = useState("");
  const [loan, setLoan] = useState("");
  const [due, setDue] = useState("");
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const r = await api<Home>(`/api/jewellery${ws.q ? `?${ws.q}` : ""}`);
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setH(r.data);
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  // Suggested value: fine weight × today's buy rate for fine metal (paise per gram).
  const suggest = useMemo(() => (h ? items.reduce((a, it) => a + Math.round((fine(it) * fineBuyRate(h.rate, h.setup, it.metal)) / 1000), 0) : 0), [h, items]);
  if (!h) return <div className="grid place-items-center py-24">{err ? <p className="text-danger">{err}</p> : <LoaderCircle className="h-6 w-6 animate-spin text-muted" />}</div>;
  const s = h.setup;
  const val = paiseOf(valuation) || suggest;
  const limit = Math.floor((val * s.girviLtvBp) / 10000);
  const asQ = ws.q ? `?${ws.q}` : "";
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const setI = (i: number, p: Partial<ItemDraft>) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));

  async function save() {
    setBusy(true); setErr("");
    const r = await api<{ girvi?: GirviRow; error?: string }>("/api/jewellery/girvi", { method: "POST", json: {
      as: ws.as || undefined, customer_name: c.name, customer_phone: c.phone, customer_address: c.address, id_kind: c.idKind, id_number: c.idNumber,
      items: items.map((it) => ({ desc: it.desc, metal: it.metal, grossMg: mgOf(it.gross), netMg: mgOf(it.net), touchBp: Math.round((Number(it.touch) || 0) * 100), pieces: Number(it.pieces) || 1 })),
      valuation_paise: val, loan_paise: paiseOf(loan), due_day: due || undefined, send,
    } });
    setBusy(false);
    if (!r.ok || !r.data.girvi) { setErr(r.data.error || T("Could not save.", "Save नहीं हुआ।")); return; }
    router.replace(`/poster/jewellery/girvi/${r.data.girvi.id}${ws.q ? `?${ws.q}&` : "?"}new=1`);
  }

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery/girvi${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Girvi", "गिरवी")}</Link>
      <h1 className="text-lg font-bold">{T("New girvi loan", "नया गिरवी लोन")}</h1>
      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3">
        <label><span className={lab}>{T("Name", "नाम")}<JwTip k="Name" /></span><input className={inp} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
        <label><span className={lab}>{T("Mobile", "मोबाइल")}<JwTip k="Mobile" /></span><input className={inp} inputMode="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
        <label className="col-span-2"><span className={lab}>{T("Address", "पता")}<JwTip k="Address" /></span><input className={inp} value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></label>
        <label><span className={lab}>{T("ID seen", "पहचान पत्र")}<JwTip k="ID seen" /></span><select className={inp} value={c.idKind} onChange={(e) => setC({ ...c, idKind: e.target.value })}>{["Aadhaar", "PAN", "Voter ID", "Driving licence", "Passport"].map((k) => <option key={k}>{k}</option>)}</select></label>
        <label><span className={lab}>{T("Its last 4 digits only", "सिर्फ़ आख़िरी 4 अंक")}<JwTip k="Its last 4 digits only" /></span><input className={inp} inputMode="numeric" maxLength={4} value={c.idNumber} onChange={(e) => setC({ ...c, idNumber: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
      </section>
      {items.map((it, i) => (
        <section key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between"><p className="text-sm font-bold">{T("Piece", "सामान")} {i + 1}</p>{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, k) => k !== i))} className="text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <label className="col-span-2"><span className={lab}>{T("What", "क्या")}<JwTip k="What" /></span><input className={inp} value={it.desc} onChange={(e) => setI(i, { desc: e.target.value })} placeholder={T("Chain, bangles…", "चेन, चूड़ी…")} /></label>
            <label><span className={lab}>{T("Metal", "धातु")}<JwTip k="Metal" /></span><select className={inp} value={it.metal} onChange={(e) => setI(i, { metal: e.target.value as Metal, touch: e.target.value === "silver" ? "80" : "91.6" })}><option value="gold">{T("Gold", "सोना")}</option><option value="silver">{T("Silver", "चाँदी")}</option></select></label>
            <label><span className={lab}>{T("Gross (g)", "कुल (g)")}<JwTip k="Gross (g)" /></span><input className={inp} inputMode="decimal" value={it.gross} onChange={(e) => setI(i, { gross: e.target.value })} /></label>
            <label><span className={lab}>{T("Net (g)", "शुद्ध (g)")}<JwTip k="Net (g)" /></span><input className={inp} inputMode="decimal" value={it.net} onChange={(e) => setI(i, { net: e.target.value })} placeholder={it.gross || "0"} /></label>
            <label><span className={lab}>{T("Touch %", "टच %")}<JwTip k="Touch %" /></span><input className={inp} inputMode="decimal" value={it.touch} onChange={(e) => setI(i, { touch: e.target.value })} /></label>
          </div>
          <p className="text-[11px] text-muted">= {grams(fine(it))} fine</p>
        </section>
      ))}
      <button type="button" onClick={() => setItems([...items, blank()])} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-semibold"><Plus className="h-4 w-4" /> {T("Add a piece", "सामान जोड़ें")}</button>
      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3">
        <label><span className={lab}>{T("Valuation ₹", "क़ीमत ₹")}<JwTip k="Valuation ₹" /></span><input className={inp} inputMode="decimal" value={valuation} onChange={(e) => setValuation(e.target.value)} placeholder={String(Math.round(suggest / 100))} /></label>
        <label><span className={lab}>{T(`Loan ₹ (up to ${inr(limit)})`, `लोन ₹ (अधिकतम ${inr(limit)})`)}</span><input className={inp} inputMode="decimal" value={loan} onChange={(e) => setLoan(e.target.value)} /></label>
        <label><span className={lab}>{T("Due date", "आख़िरी तारीख़")}<JwTip k="Due date" /></span><input type="date" className={inp} value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <label className="flex items-end gap-2 pb-2 text-xs font-semibold"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> {T("Send the receipt on WhatsApp", "रसीद WhatsApp पर भेजें")}</label>
        <p className="col-span-2 text-[11px] text-muted">{T(`Valuation empty = fine weight × today's buy rate. Interest ${(s.girviRateBp / 100).toFixed(2)}% a month, by the day${s.girviMinDays ? `, at least ${s.girviMinDays} days` : ""}. Due date empty = ${s.girviMonths} months.`, `क़ीमत खाली = fine वज़न × आज का ख़रीद रेट। ब्याज ${(s.girviRateBp / 100).toFixed(2)}% महीना, रोज़ के हिसाब से${s.girviMinDays ? `, कम से कम ${s.girviMinDays} दिन` : ""}। तारीख़ खाली = ${s.girviMonths} महीने।`)}</p>
      </section>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Give the loan", "लोन दें")}</button>
    </div>
  );
}
