"use client";
// New order (?kind=repair for a repair). Built for the counter: the customer, what is to be made (type, purity, approx. weight, size,
// design) or what came in for repair (its weight now — proof for both sides — and the work), the date, the estimate / charge, the
// advance, and — for an order — "lock today's rate". Saves, and can send the receipt on WhatsApp.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Send, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr, mgOf, paiseOf, sellRate, type JwSetup, type Payment, type RateBook } from "@/lib/jewellery";
import type { Karigar, OrderRow } from "@/lib/jewellery-orders";
import { JwTip } from "@/components/jewellery/jw-tip";

type Home = { setup: JwSetup; rate: RateBook | null; today: string; error?: string };
type ItemDraft = { itemType: string; desc: string; purity: string; weight: string; size: string; work: string; pieces: string };

function OrderForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const kind = sp.get("kind") === "repair" ? "repair" : "order";
  const repair = kind === "repair";
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [h, setH] = useState<Home | null>(null);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [err, setErr] = useState("");
  const [cust, setCust] = useState({ name: "", phone: "" });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [est, setEst] = useState("");
  const [due, setDue] = useState("");
  const [karigar, setKarigar] = useState("");
  const [pay, setPay] = useState({ mode: "cash" as Payment["mode"], amount: "", ref: "" });
  const [lock, setLock] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const q = ws.q ? `?${ws.q}` : "";
    const [r, o] = await Promise.all([api<Home>(`/api/jewellery${q}`), api<{ karigars: Karigar[] }>(`/api/jewellery/orders${q ? `${q}&` : "?"}view=none&limit=1`)]);
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setH(r.data);
    if (o.ok) setKarigars((o.data.karigars ?? []).filter((k) => k.active));
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; } void load(); })(); }, [router, load]);

  const setup = h?.setup;
  const purities = useMemo(() => (setup?.purities ?? []).filter((p) => p.on), [setup]);
  const blank = useCallback((): ItemDraft => ({ itemType: setup?.items[0]?.key ?? "", desc: "", purity: (purities.find((p) => p.key === "g22") ?? purities[0])?.key ?? "", weight: "", size: "", work: "", pieces: "1" }), [setup, purities]);
  useEffect(() => { if (setup && !items.length) setItems([blank()]); }, [setup, items.length, blank]);

  if (err && !h) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!h || !setup) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const q = ws.q ? `?${ws.q}` : "";
  const inp = "w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-brand";
  const lab = "mb-0.5 block text-[11px] font-semibold text-muted";
  const setI = (i: number, p: Partial<ItemDraft>) => setItems((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const todayRate = h.rate && h.rate.day === h.today ? h.rate : null;
  const lockPurity = items.find((i) => i.purity)?.purity ?? "";
  const lockRate = todayRate && lockPurity ? sellRate(todayRate, setup, lockPurity) : 0;
  const typeName = (k: string) => { const it = setup.items.find((x) => x.key === k); return it ? (hi ? it.hi : it.en) : ""; };

  async function save(send: boolean) {
    setBusy(true); setErr("");
    const r = await api<{ order?: OrderRow; error?: string; sent?: { sent: boolean } | null }>("/api/jewellery/orders", {
      method: "POST",
      json: {
        as: ws.as || undefined, kind, send, customer_name: cust.name, customer_phone: cust.phone,
        items: items.map((i) => ({ itemType: i.itemType, desc: i.desc || typeName(i.itemType), purity: i.purity, weightMg: mgOf(i.weight), size: i.size, work: i.work, pieces: Number(i.pieces) || 1 })),
        est_paise: paiseOf(est), due_date: due || undefined, karigar_id: karigar || undefined, notes,
        payments: paiseOf(pay.amount) > 0 ? [{ mode: pay.mode, paise: paiseOf(pay.amount), ref: pay.ref, at: new Date().toISOString() }] : [],
        lock_rate: !repair && lock,
      },
    });
    setBusy(false);
    if (!r.ok || !r.data.order) { setErr(r.data.error || T("Could not save.", "Save नहीं हुआ।")); return; }
    router.replace(`/poster/jewellery/order/${r.data.order.id}${q ? `${q}&` : "?"}new=1`);
  }

  return (
    <div className="space-y-4 pb-4">
      <Link href={`/poster/jewellery/orders${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Orders & repairs", "ऑर्डर और रिपेयर")}</Link>
      <h1 className="text-lg font-bold">{repair ? T("New repair", "नया रिपेयर") : T("New order", "नया ऑर्डर")}</h1>

      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <label><span className={lab}>{T("Customer name", "ग्राहक का नाम")}<JwTip k="Customer name" /></span><input className={inp} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></label>
        <label><span className={lab}>{T("Mobile (WhatsApp)", "मोबाइल (WhatsApp)")}<JwTip k="Mobile (WhatsApp)" /></span><input className={inp} inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="98765 43210" /></label>
      </section>

      {items.map((it, i) => (
        <section key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{repair ? T("Piece", "आइटम") : T("Item", "आइटम")} {i + 1}</h2>{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, k) => k !== i))} className="text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}</div>
          <div className="flex flex-wrap gap-1.5">
            {setup.items.map((x) => <button key={x.key} type="button" onClick={() => setI(i, { itemType: x.key })} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${it.itemType === x.key ? "border-brand bg-brand/10 text-brand-ink" : "border-border"}`}>{hi ? x.hi : x.en}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label><span className={lab}>{T("Purity", "Purity")}<JwTip k="Purity" /></span><select className={inp} value={it.purity} onChange={(e) => setI(i, { purity: e.target.value })}><option value="">—</option>{purities.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
            <label><span className={lab}>{repair ? T("Weight now (g)", "अभी का वज़न (g)") : T("Approx. weight (g)", "लगभग वज़न (g)")}</span><input className={inp} inputMode="decimal" value={it.weight} onChange={(e) => setI(i, { weight: e.target.value })} placeholder="0.000" /></label>
            <label><span className={lab}>{T("Size", "साइज़")}<JwTip k="Size" /></span><input className={inp} value={it.size} onChange={(e) => setI(i, { size: e.target.value })} placeholder={T("e.g. 14, 2.6", "जैसे 14, 2.6")} /></label>
            <label><span className={lab}>{T("Pieces", "नग")}<JwTip k="Pieces" /></span><input className={inp} inputMode="numeric" value={it.pieces} onChange={(e) => setI(i, { pieces: e.target.value.replace(/\D/g, "") })} /></label>
          </div>
          <label className="block"><span className={lab}>{T("Name on the receipt", "रसीद पर नाम")}<JwTip k="Name on the receipt" /></span><input className={inp} value={it.desc} onChange={(e) => setI(i, { desc: e.target.value })} placeholder={typeName(it.itemType) || T("e.g. Ladies ring", "जैसे लेडीज़ अंगूठी")} /></label>
          <label className="block"><span className={lab}>{repair ? T("Work to be done", "क्या काम करना है") : T("Design / details", "डिज़ाइन / जानकारी")}</span><input className={inp} value={it.work} onChange={(e) => setI(i, { work: e.target.value })} placeholder={repair ? T("e.g. solder the broken link, polish", "जैसे टूटी कड़ी जोड़ना, पॉलिश") : T("e.g. same as photo, ruby stone", "जैसे फ़ोटो जैसा, रूबी स्टोन")} /></label>
        </section>
      ))}
      <button type="button" onClick={() => setItems([...items, blank()])} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-sm font-semibold"><Plus className="h-4 w-4" /> {T("Add item", "आइटम जोड़ें")}</button>

      <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 shadow-card">
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lab}>{repair ? T("Repair charge ₹", "रिपेयर चार्ज ₹") : T("Estimate ₹ (optional)", "अनुमान ₹ (ज़रूरी नहीं)")}</span><input className={inp} inputMode="decimal" value={est} onChange={(e) => setEst(e.target.value)} /></label>
          <label><span className={lab}>{repair ? T("Ready by", "कब तक तैयार") : T("Delivery by", "डिलीवरी की तारीख़")}</span><input type="date" className={inp} value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
        {karigars.length > 0 && (
          <label className="block"><span className={lab}>{T("Give to karigar (optional)", "कारीगर को दें (ज़रूरी नहीं)")}<JwTip k="Give to karigar (optional)" /></span><select className={inp} value={karigar} onChange={(e) => setKarigar(e.target.value)}><option value="">{T("Not yet", "अभी नहीं")}</option>{karigars.map((k) => <option key={k.id} value={k.id}>{k.name}{k.skill ? ` · ${k.skill}` : ""}</option>)}</select></label>
        )}
        <p className="pt-1 text-[11px] font-semibold text-muted">{T("Advance received", "एडवांस मिला")}</p>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
          <select className={inp} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value as Payment["mode"] })}>{(["cash", "upi", "card", "bank", "cheque"] as const).map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select>
          <input className={inp} inputMode="decimal" placeholder="₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <input className={inp} placeholder="Ref / UTR" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} />
        </div>
        {!repair && (
          <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">
            <input type="checkbox" checked={lock} disabled={!lockRate} onChange={(e) => setLock(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>{lockRate ? T(`Lock today's rate for this order: ${setup.purities.find((p) => p.key === lockPurity)?.label} @ ${inr(lockRate * 10)} / 10 g. The bill at delivery uses this rate.`, `इस ऑर्डर के लिए आज का रेट lock करें: ${setup.purities.find((p) => p.key === lockPurity)?.label} @ ${inr(lockRate * 10)} / 10 g। डिलीवरी के बिल में यही रेट लगेगा।`) : T("Set today's rate to lock it for this order.", "रेट lock करने के लिए पहले आज का रेट डालें।")}</span>
          </label>
        )}
        <label className="block"><span className={lab}>{T("Note", "नोट")}<JwTip k="Note" /></span><input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </section>

      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <button type="button" disabled={busy} onClick={() => void save(false)} className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin" /> : T("Save", "Save")}</button>
        <button type="button" disabled={busy || !cust.phone.trim()} onClick={() => void save(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> {T("Save & WhatsApp", "Save और WhatsApp")}</button>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><OrderForm /></Suspense>;
}
