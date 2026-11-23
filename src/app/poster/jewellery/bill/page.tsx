"use client";
// New bill / estimate (?kind=estimate). Built for the counter: pick the item type and purity, type the weights, and everything else
// — today's rate, making, wastage, GST, old gold, balance — is filled and worked out at once (the same billTotals the server and
// the printed bill use). Save, and the bill goes to the customer's WhatsApp.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Send, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import {
  billTotals, fineBuyRate, grams, inr, mgOf, paiseOf, sellRate,
  type BillLine, type BillRow, type MakingKind, type Metal, type OldGoldLine, type Payment, type JwSetup, type RateBook,
} from "@/lib/jewellery";

type Home = { setup: JwSetup; rate: RateBook | null; today: string; error?: string };
/** A line as typed: weights in grams, money in rupees, percentages as numbers — turned into paise / mg for the maths. */
type LineDraft = { itemType: string; desc: string; purity: string; pieces: string; gross: string; stone: string; net: string; rate: string; wastage: string; making: MakingKind; makingValue: string; stoneRs: string; otherRs: string; huid: string; tag: string };
type OldDraft = { desc: string; metal: Metal; gross: string; less: string; touch: string; rate: string };
type PayDraft = { mode: Payment["mode"]; amount: string; ref: string };

const num = (s: string) => Number(String(s).replace(/,/g, "")) || 0;

function toLine(l: LineDraft, setup: JwSetup): BillLine {
  return {
    desc: l.desc, itemType: l.itemType, purity: l.purity, pieces: Math.max(1, Math.round(num(l.pieces)) || 1),
    grossMg: mgOf(l.gross), stoneMg: mgOf(l.stone), netMg: mgOf(l.net), rate: Math.round(paiseOf(l.rate) / 10),
    wastageBp: Math.round(num(l.wastage) * 100), making: l.making,
    makingValue: l.making === "pct" ? Math.round(num(l.makingValue) * 100) : paiseOf(l.makingValue),
    stonePaise: paiseOf(l.stoneRs), otherPaise: paiseOf(l.otherRs), huid: l.huid.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    hsn: setup.items.find((i) => i.key === l.itemType)?.hsn ?? "7113", tag: l.tag,
  };
}
const toOld = (o: OldDraft): OldGoldLine => ({ desc: o.desc, metal: o.metal, grossMg: mgOf(o.gross), lessMg: mgOf(o.less), touchBp: Math.round(num(o.touch) * 100), rate: Math.round(paiseOf(o.rate) / 10) });

function BillBuilder() {
  const router = useRouter();
  const sp = useSearchParams();
  const kind = sp.get("kind") === "estimate" ? "estimate" : "sale";
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [h, setH] = useState<Home | null>(null);
  const [err, setErr] = useState("");
  const [cust, setCust] = useState({ name: "", phone: "", pan: "", gstin: "", state: "", address: "" });
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [olds, setOlds] = useState<OldDraft[]>([]);
  const [pays, setPays] = useState<PayDraft[]>([{ mode: "cash", amount: "", ref: "" }]);
  const [disc, setDisc] = useState({ amount: "", on: "making" as "making" | "total" });
  const [advance, setAdvance] = useState("");
  const [due, setDue] = useState("");
  const [validTill, setValidTill] = useState("");
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<Home>(`/api/jewellery${ws.q ? `?${ws.q}` : ""}`);
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setH(r.data);
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; } void load(); })(); }, [router, load]);

  const setup = h?.setup;
  const rate = h?.rate ?? null;
  const purities = useMemo(() => (setup?.purities ?? []).filter((p) => p.on), [setup]);
  // A new line: the first item type and the most common gold purity, at today's rate.
  const blankLine = useCallback((itemType?: string): LineDraft => {
    const it = setup?.items.find((i) => i.key === itemType) ?? setup?.items[0];
    const pur = purities.find((p) => p.key === "g22") ?? purities[0];
    const r = setup && pur ? sellRate(rate, setup, pur.key) : 0;
    return {
      itemType: it?.key ?? "", desc: "", purity: pur?.key ?? "", pieces: "1", gross: "", stone: "", net: "", rate: r ? String((r * 10) / 100) : "",
      wastage: it ? String(it.wastageBp / 100) : "0", making: it?.making ?? "per_g", makingValue: it ? String(it.making === "pct" ? it.makingValue / 100 : it.makingValue / 100) : "0",
      stoneRs: "", otherRs: "", huid: "", tag: "",
    };
  }, [setup, rate, purities]);
  useEffect(() => { if (setup && !lines.length) setLines([blankLine()]); }, [setup, lines.length, blankLine]);
  const blankOld = useCallback((): OldDraft => ({ desc: hi ? "पुराना सोना" : "Old gold", metal: "gold", gross: "", less: "", touch: "91.6", rate: setup ? String((fineBuyRate(rate, setup, "gold") * 10) / 100) : "" }), [setup, rate, hi]);

  const input = useMemo(() => setup ? {
    lines: lines.map((l) => toLine(l, setup)), old: olds.map(toOld),
    payments: kind === "sale" ? pays.filter((p) => paiseOf(p.amount) > 0).map((p) => ({ mode: p.mode, paise: paiseOf(p.amount), ref: p.ref, at: new Date().toISOString() })) : [],
    discountPaise: paiseOf(disc.amount), discountOn: disc.on, customerState: cust.state, advancePaise: paiseOf(advance),
  } : null, [setup, lines, olds, pays, disc, cust.state, advance, kind]);
  const t = useMemo(() => (input && setup ? billTotals(input, setup) : null), [input, setup]);

  async function save(send: boolean) {
    if (!input || !setup) return;
    setBusy(true); setErr("");
    const r = await api<{ bill?: BillRow; error?: string; sent?: { sent: boolean; link: string } | null }>("/api/jewellery/bills", {
      method: "POST",
      json: {
        as: ws.as || undefined, kind, send, customer_name: cust.name, customer_phone: cust.phone, customer_pan: cust.pan, customer_gstin: cust.gstin, customer_state: cust.state, customer_address: cust.address,
        lines: input.lines, old_gold: input.old, payments: input.payments, discount_paise: input.discountPaise, discount_on: input.discountOn, advance_paise: input.advancePaise,
        due_date: due || undefined, valid_till: validTill || undefined, notes,
      },
    });
    setBusy(false);
    if (!r.ok || !r.data.bill) { setErr(r.data.error || T("Could not save.", "Save नहीं हुआ।")); if (r.data && "code" in r.data && (r.data as { code?: string }).code === "pan") setMore(true); return; }
    router.replace(`/poster/jewellery/bill/${r.data.bill.id}${ws.q ? `?${ws.q}&` : "?"}new=1${r.data.sent && !r.data.sent.sent ? "&wa=1" : ""}`);
  }

  if (err && !h) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!h || !setup || !t) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const q = ws.q ? `?${ws.q}` : "";
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-brand";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const setL = (i: number, p: Partial<LineDraft>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const setO = (i: number, p: Partial<OldDraft>) => setOlds((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const noRate = !rate || rate.day !== h.today;

  return (
    <div className="space-y-4">
      <Link href={`/poster/jewellery${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <h1 className="text-lg font-bold">{kind === "estimate" ? T("New estimate", "नया estimate") : T("New bill", "नया बिल")}</h1>
      {noRate && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{T("Today's rate is not set — the rate box of each item is filled from the last rate. ", "आज का रेट नहीं डला — हर item में पिछला रेट भरा है। ")}<Link href={`/poster/jewellery/rate${q}`} className="underline">{T("Set it", "डालें")}</Link></p>}

      {/* Customer */}
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lab}>{T("Customer name", "ग्राहक का नाम")}</span><input className={inp} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></label>
          <label><span className={lab}>{T("Mobile (WhatsApp)", "मोबाइल (WhatsApp)")}</span><input className={inp} inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="98765 43210" /></label>
        </div>
        <button type="button" onClick={() => setMore(!more)} className="text-xs font-semibold text-brand-ink">{more ? "−" : "+"} {T("PAN, GSTIN, state, address", "PAN, GSTIN, state, पता")}</button>
        {more && (
          <div className="grid grid-cols-2 gap-2">
            <label><span className={lab}>PAN</span><input className={inp} value={cust.pan} maxLength={10} onChange={(e) => setCust({ ...cust, pan: e.target.value.toUpperCase() })} /></label>
            <label><span className={lab}>GSTIN</span><input className={inp} value={cust.gstin} maxLength={15} onChange={(e) => setCust({ ...cust, gstin: e.target.value.toUpperCase(), state: /^\d{2}/.test(e.target.value) ? e.target.value.slice(0, 2) : cust.state })} /></label>
            <label><span className={lab}>{T("State code (other state → IGST)", "State code (दूसरा state → IGST)")}</span><input className={inp} inputMode="numeric" maxLength={2} value={cust.state} placeholder={setup.stateCode || "06"} onChange={(e) => setCust({ ...cust, state: e.target.value.replace(/\D/g, "") })} /></label>
            <label><span className={lab}>{T("Address", "पता")}</span><input className={inp} value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} /></label>
          </div>
        )}
      </section>

      {/* Items */}
      {lines.map((l, i) => {
        const a = t.lines[i];
        return (
          <section key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{T("Item", "Item")} {i + 1}</p>
              {lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, k) => k !== i))} className="text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {setup.items.map((it) => (
                <button key={it.key} type="button" onClick={() => setL(i, { itemType: it.key, making: it.making, makingValue: String(it.making === "pct" ? it.makingValue / 100 : it.makingValue / 100), wastage: String(it.wastageBp / 100) })}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${l.itemType === it.key ? "border-brand bg-brand-soft text-brand-ink" : "border-border"}`}>{hi ? it.hi : it.en}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label><span className={lab}>{T("Purity", "शुद्धता")}</span>
                <select className={inp} value={l.purity} onChange={(e) => { const r = sellRate(rate, setup, e.target.value); setL(i, { purity: e.target.value, rate: r ? String((r * 10) / 100) : l.rate }); }}>
                  {purities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select></label>
              <label><span className={lab}>{T("Rate ₹ / 10 g", "रेट ₹ / 10 ग्राम")}</span><input className={inp} inputMode="decimal" value={l.rate} onChange={(e) => setL(i, { rate: e.target.value })} /></label>
              <label><span className={lab}>{T("Gross wt (g)", "कुल वज़न (g)")}</span><input className={`${inp} font-bold`} inputMode="decimal" value={l.gross} onChange={(e) => setL(i, { gross: e.target.value })} placeholder="0.000" /></label>
              <label><span className={lab}>{T("Stone wt (g)", "नग वज़न (g)")}</span><input className={inp} inputMode="decimal" value={l.stone} onChange={(e) => setL(i, { stone: e.target.value })} placeholder="0.000" /></label>
              <label><span className={lab}>{T("Net wt (g)", "शुद्ध वज़न (g)")}</span><input className={inp} inputMode="decimal" value={l.net} onChange={(e) => setL(i, { net: e.target.value })} placeholder={(a.netMg / 1000).toFixed(3)} /></label>
              <label><span className={lab}>{T("Making", "मेकिंग")}</span>
                <span className="flex gap-1">
                  <select className={`${inp} !w-auto`} value={l.making} onChange={(e) => setL(i, { making: e.target.value as MakingKind })}>
                    <option value="per_g">₹/g</option><option value="pct">%</option><option value="piece">₹/pc</option>
                  </select>
                  <input className={inp} inputMode="decimal" value={l.makingValue} onChange={(e) => setL(i, { makingValue: e.target.value })} />
                </span></label>
              <label><span className={lab}>{T("Wastage / VA %", "वेस्टेज / VA %")}</span><input className={inp} inputMode="decimal" value={l.wastage} onChange={(e) => setL(i, { wastage: e.target.value })} /></label>
              <label><span className={lab}>{T("Stone ₹", "नग ₹")}</span><input className={inp} inputMode="decimal" value={l.stoneRs} onChange={(e) => setL(i, { stoneRs: e.target.value })} /></label>
              <label><span className={lab}>HUID</span><input className={inp} maxLength={6} value={l.huid} onChange={(e) => setL(i, { huid: e.target.value.toUpperCase() })} placeholder="AB12CD" /></label>
              <label><span className={lab}>{T("Pieces", "नग")}</span><input className={inp} inputMode="numeric" value={l.pieces} onChange={(e) => setL(i, { pieces: e.target.value })} /></label>
              <label className="col-span-2"><span className={lab}>{T("Description (optional)", "विवरण (चाहें तो)")}</span><input className={inp} value={l.desc} onChange={(e) => setL(i, { desc: e.target.value })} placeholder={T("e.g. Ladies ring with stone", "जैसे लेडीज़ अंगूठी नग वाली")} /></label>
            </div>
            <p className="rounded-lg bg-surface2/70 px-2 py-1.5 text-xs tabular-nums">
              {grams(a.netMg)} × {inr(Math.round(paiseOf(l.rate) / 10), true)}/g = <b>{inr(a.metal)}</b>{a.wastage ? ` + VA ${inr(a.wastage)}` : ""} + {T("making", "मेकिंग")} <b>{inr(a.making)}</b>{a.stone ? ` + ${T("stone", "नग")} ${inr(a.stone)}` : ""} = <b>{inr(a.total)}</b>
            </p>
          </section>
        );
      })}
      <button type="button" onClick={() => setLines([...lines, blankLine(lines[lines.length - 1]?.itemType)])} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-semibold"><Plus className="h-4 w-4" /> {T("Add item", "Item जोड़ें")}</button>

      {/* Old gold */}
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <div className="flex items-center justify-between"><p className="text-sm font-bold">{T("Old gold / silver (exchange)", "पुराना सोना / चाँदी (exchange)")}</p><button type="button" onClick={() => setOlds([...olds, blankOld()])} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" /> {T("Add", "जोड़ें")}</button></div>
        {olds.map((o, i) => (
          <div key={i} className="space-y-1.5 rounded-xl bg-surface2/50 p-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-2"><span className={lab}>{T("What", "क्या")}</span><input className={inp} value={o.desc} onChange={(e) => setO(i, { desc: e.target.value })} /></label>
              <label><span className={lab}>{T("Metal", "धातु")}</span><select className={inp} value={o.metal} onChange={(e) => { const m = e.target.value as Metal; setO(i, { metal: m, touch: m === "silver" ? "80" : "91.6", rate: String((fineBuyRate(rate, setup, m) * 10) / 100) }); }}><option value="gold">{T("Gold", "सोना")}</option><option value="silver">{T("Silver", "चाँदी")}</option></select></label>
              <label><span className={lab}>{T("Gross (g)", "कुल (g)")}</span><input className={inp} inputMode="decimal" value={o.gross} onChange={(e) => setO(i, { gross: e.target.value })} /></label>
              <label><span className={lab}>{T("Less (g)", "कम (g)")}</span><input className={inp} inputMode="decimal" value={o.less} onChange={(e) => setO(i, { less: e.target.value })} /></label>
              <label><span className={lab}>{T("Touch %", "टच %")}</span><input className={inp} inputMode="decimal" value={o.touch} onChange={(e) => setO(i, { touch: e.target.value })} /></label>
              <label className="col-span-2"><span className={lab}>{T("Fine rate ₹ / 10 g", "शुद्ध रेट ₹ / 10 g")}</span><input className={inp} inputMode="decimal" value={o.rate} onChange={(e) => setO(i, { rate: e.target.value })} /></label>
            </div>
            <div className="flex items-center justify-between text-xs tabular-nums"><span>{grams(t.old[i]?.fineMg ?? 0)} {T("fine", "शुद्ध")} = <b>{inr(t.old[i]?.value ?? 0)}</b></span><button type="button" onClick={() => setOlds(olds.filter((_, k) => k !== i))} className="text-danger"><Trash2 className="h-4 w-4" /></button></div>
          </div>
        ))}
      </section>

      {/* Discount, advance, payment */}
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lab}>{T("Discount ₹", "छूट ₹")}</span><input className={inp} inputMode="decimal" value={disc.amount} onChange={(e) => setDisc({ ...disc, amount: e.target.value })} /></label>
          <label><span className={lab}>{T("Discount on", "छूट किस पर")}</span><select className={inp} value={disc.on} onChange={(e) => setDisc({ ...disc, on: e.target.value as "making" | "total" })}><option value="making">{T("Making only", "सिर्फ़ मेकिंग")}</option><option value="total">{T("Whole bill", "पूरा बिल")}</option></select></label>
          <label><span className={lab}>{T("Advance already paid ₹", "पहले दिया advance ₹")}</span><input className={inp} inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} /></label>
          {kind === "estimate"
            ? <label><span className={lab}>{T("Valid till", "कब तक मान्य")}</span><input type="date" className={inp} value={validTill} onChange={(e) => setValidTill(e.target.value)} /></label>
            : <label><span className={lab}>{T("Balance due date (udhaar)", "बाकी कब तक (उधार)")}</span><input type="date" className={inp} value={due} onChange={(e) => setDue(e.target.value)} /></label>}
        </div>
        {kind === "sale" && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold">{T("Payment received", "मिला पेमेंट")}</p>
            {pays.map((p, i) => (
              <div key={i} className="grid grid-cols-[6.5rem_1fr_1fr_auto] gap-1.5">
                <select className={inp} value={p.mode} onChange={(e) => setPays(pays.map((x, k) => (k === i ? { ...x, mode: e.target.value as Payment["mode"] } : x)))}>
                  <option value="cash">{T("Cash", "नकद")}</option><option value="upi">UPI</option><option value="card">{T("Card", "कार्ड")}</option><option value="bank">{T("Bank", "बैंक")}</option><option value="cheque">{T("Cheque", "चेक")}</option>
                </select>
                <input className={inp} inputMode="decimal" placeholder="₹" value={p.amount} onChange={(e) => setPays(pays.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} />
                <input className={inp} placeholder={T("Ref / UTR", "Ref / UTR")} value={p.ref} onChange={(e) => setPays(pays.map((x, k) => (k === i ? { ...x, ref: e.target.value } : x)))} />
                <button type="button" onClick={() => setPays(pays.length > 1 ? pays.filter((_, k) => k !== i) : [{ mode: "cash", amount: "", ref: "" }])} className="text-danger"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex gap-3 text-xs font-semibold">
              <button type="button" onClick={() => setPays([...pays, { mode: "upi", amount: "", ref: "" }])} className="text-brand-ink">+ {T("Another mode", "दूसरा तरीका")}</button>
              <button type="button" onClick={() => { const left = t.total - t.oldValue - t.advance - pays.slice(0, -1).reduce((a, p) => a + paiseOf(p.amount), 0); setPays(pays.map((x, k) => (k === pays.length - 1 ? { ...x, amount: String(Math.max(0, left) / 100) } : x))); }} className="text-brand-ink">{T("Fill the full amount", "पूरी रकम भरें")}</button>
            </div>
          </div>
        )}
        <label><span className={lab}>{T("Note on the bill", "बिल पर नोट")}</span><input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </section>

      {/* Totals, always in view */}
      <div className="sticky bottom-0 z-40 -mx-4 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(0,0,0,.3)] backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-xs tabular-nums">
            <p>{T("Taxable", "टैक्स योग्य")} {inr(t.taxable)} · GST {inr(t.gst)}{t.discount ? ` · ${T("disc", "छूट")} ${inr(t.discount)}` : ""}{t.oldValue ? ` · ${T("old gold", "पुराना सोना")} −${inr(t.oldValue)}` : ""}</p>
            <p className="text-lg font-bold">{inr(t.total)} {kind === "sale" && <span className={`text-sm font-semibold ${t.balance > 0 ? "text-danger" : "text-good"}`}>· {t.balance > 0 ? `${T("due", "बाकी")} ${inr(t.balance)}` : t.balance < 0 ? `${T("give back", "वापस दें")} ${inr(-t.balance)}` : T("paid", "पूरा")}</span>}</p>
            {err && <p className="font-semibold text-danger">{err}</p>}
          </div>
          <button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{T("Save", "Save")}</button>
          <button type="button" disabled={busy || !cust.phone} onClick={() => void save(true)} title={cust.phone ? "" : T("Add the customer's mobile to send", "भेजने के लिए मोबाइल डालें")} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {T("Save & WhatsApp", "Save और WhatsApp")}</button>
        </div>
      </div>
    </div>
  );
}

export default function NewBillPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><BillBuilder /></Suspense>;
}
