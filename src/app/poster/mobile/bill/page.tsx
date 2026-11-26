"use client";
// New bill / estimate — the counter screen. The item list sits on the phone, so the search is instant ("cover redmi 13" finds the
// cover that fits it) and a barcode scanner (it types the code and presses Enter) adds the item by itself. A phone is added by
// scanning its IMEI. With no internet the bill is kept on the phone and sent later (lib/mobile-offline.ts).
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, MessageCircle, Minus, Plus, Printer, ScanLine, Search, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { inr, paiseOf, type Payment } from "@/lib/jewellery";
import { billTotals, cleanCode, comboOff, itemMatches, itemTitle, storeName, validUpi, type BillLine, type BillRow, type ItemRow, type MsSetup, type UnitRow } from "@/lib/mobile";
import { UpiQr } from "@/components/mobile/upi-qr";
import type { MsAccess } from "@/lib/mobile-types";
import { MsHelp } from "@/components/mobile/page-help";
import { OfflineBar } from "@/components/mobile/offline-bar";
import { Receipt } from "@/components/mobile/receipt";
import { enqueue, keepItems, keptItems, newClientId } from "@/lib/mobile-offline";

type Item = ItemRow & { stock: number };
type Loaded = { items: Item[]; setup: MsSetup; access: MsAccess; store?: string | null; error?: string };
type Cust = { name: string; bills: number; due: { count: number; paise: number }; points: { balance: number; worth: number; min: number } | null };
const STORE_KEY = "shubhora.ms-store";
const keptStore = () => { try { return localStorage.getItem(STORE_KEY) ?? ""; } catch { return ""; } };
type CL = { key: string; itemId: string; name: string; qty: number; price: string; disc: string; imei: string; serial: boolean; gstBp: number; stock: number | null };
type PayMode = "cash" | "upi" | "card" | "emi" | "part";

let seq = 0;
const lineOf = (c: CL): BillLine => ({ itemId: c.itemId, name: c.name.trim(), hsn: "", qty: Math.max(1, c.qty), price: paiseOf(c.price), discount: paiseOf(c.disc), gstBp: c.gstBp, imei: cleanCode(c.imei, 20), unitId: "", warrantyMonths: 0, cost: 0 });

function NewBill() {
  const router = useRouter();
  const sp = useSearchParams();
  const kind = sp.get("kind") === "estimate" ? "estimate" : "sale";
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [d, setD] = useState<Loaded | null>(null);
  const [stale, setStale] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CL[]>([]);
  const [cust, setCust] = useState({ name: "", phone: "" });
  const [mode, setMode] = useState<PayMode>("cash");
  const [part, setPart] = useState({ amount: "", mode: "cash" as Payment["mode"] });
  const [disc, setDisc] = useState("");
  const [emi, setEmi] = useState("");
  const [ex, setEx] = useState({ open: false, model: "", imei: "", value: "" });
  const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState({ open: false, name: "", price: "" });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [offlineBill, setOfflineBill] = useState<BillRow | null>(null);
  const [tick, setTick] = useState(0);
  const [store, setStore] = useState<string>(() => (typeof window === "undefined" ? "" : keptStore()));
  const [known, setKnown] = useState<Cust | null>(null);
  const [usePts, setUsePts] = useState("");
  const clientId = useRef(newClientId());
  const box = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Loaded>(`/api/mobile/items${asQ ? `${asQ}&` : "?"}store=${encodeURIComponent(store)}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      keepItems(ws.as, r.data); setStale(false); setD(r.data);
    } catch {
      const kept = keptItems<Loaded>(ws.as);
      if (kept) { setD(kept.data); setStale(true); } else setErr(T("No internet, and this phone has not loaded your items yet. Open this page once with internet.", "इंटरनेट नहीं है, और इस फ़ोन में अभी items नहीं आए हैं। एक बार इंटरनेट के साथ ये पेज खोलिए।"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asQ, ws.as, store]);
  // The customer, once 10 digits are typed: name from the last bill, old udhaar, and points.
  const ten = cust.phone.replace(/\D/g, "").slice(-10);
  useEffect(() => {
    setKnown(null); setUsePts("");
    if (ten.length !== 10 || kind !== "sale") return;
    let on = true;
    const t = setTimeout(async () => {
      try {
        const r = await api<Cust>(`/api/mobile/customer${asQ ? `${asQ}&` : "?"}phone=${ten}`, { fresh: true });
        if (!on || !r.ok) return;
        setKnown(r.data);
        if (r.data.name) setCust((c) => (c.name.trim() ? c : { ...c, name: r.data.name }));
      } catch { /* offline: billing goes on without it */ }
    }, 300);
    return () => { on = false; clearTimeout(t); };
  }, [ten, asQ, kind]);
  useEffect(() => { (async () => {
    if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    void load();
  })(); }, [router, load]);

  const setup = d?.setup;
  const found = useMemo(() => (d && q.trim() ? d.items.filter((i) => i.active && itemMatches(i, q)).slice(0, 30) : []), [d, q]);
  // Combo offers are worked out the same way the server does, so the screen shows the real total.
  const combo = useMemo(() => comboOff(cart.map(lineOf), setup?.combos ?? []), [cart, setup]);
  const totals = useMemo(() => billTotals({ lines: cart.map(lineOf), payments: [], discountPaise: paiseOf(disc) + combo.off, customerState: "" }, { gstOn: !!setup?.gstOn, stateCode: setup?.stateCode ?? "" }), [cart, disc, setup, combo]);
  const pts = known?.points && kind === "sale" ? Math.max(0, Math.min(known.points.balance, Math.round(Number(usePts) || 0))) : 0;
  const ptsPaise = known?.points ? pts * known.points.worth : 0;

  function add(i: Item, imei = "") {
    setNote("");
    setCart((c) => {
      if (!i.serial) {
        const at = c.findIndex((x) => x.itemId === i.id);
        if (at >= 0) return c.map((x, n) => (n === at ? { ...x, qty: x.qty + 1 } : x));
      } else if (imei && c.some((x) => x.imei === imei)) return c;
      return [...c, { key: `l${++seq}`, itemId: i.id, name: itemTitle(i), qty: 1, price: String(i.price_paise / 100), disc: "", imei, serial: i.serial, gstBp: i.gst_bp, stock: i.serial ? null : i.stock }];
    });
    setQ(""); box.current?.focus();
  }
  const change = (key: string, p: Partial<CL>) => setCart((c) => c.map((x) => (x.key === key ? { ...x, ...p } : x)));

  /** Enter in the search box: a scanner's barcode, an IMEI, or the only item found. */
  async function onEnter() {
    if (!d) return;
    const code = cleanCode(q);
    const byCode = code ? d.items.find((i) => i.active && i.barcode && i.barcode === code) : undefined;
    if (byCode) { add(byCode); return; }
    if (found.length === 1 && !found[0].serial) { add(found[0]); return; }
    if (/^[A-Z0-9-]{8,20}$/.test(code)) {
      setBusy("scan");
      try {
        const r = await api<{ unit?: UnitRow; item?: Item | null; error?: string }>(`/api/mobile/items${asQ ? `${asQ}&` : "?"}imei=${encodeURIComponent(code)}`, { fresh: true });
        if (r.ok && r.data.unit && r.data.item) {
          if (r.data.unit.status !== "in_stock" && kind === "sale") setNote(T(`IMEI ${code} is already ${r.data.unit.status}.`, `IMEI ${code} पहले ही ${r.data.unit.status === "sold" ? "बिक चुका" : r.data.unit.status} है।`));
          else add({ ...r.data.item, stock: 1 }, r.data.unit.imei1);
        } else if (!found.length) setNote(r.data?.error || T("Nothing found for this code.", "इस code से कुछ नहीं मिला।"));
      } catch { setNote(T("IMEI lookup needs internet. Tap the phone's name and type the IMEI on the line.", "IMEI खोजने के लिए इंटरनेट चाहिए। फ़ोन का नाम दबाकर line में IMEI लिखें।")); }
      setBusy("");
    }
  }

  async function save(send: boolean) {
    if (!d || !setup || !cart.length) return;
    setNote("");
    const lines = cart.map(lineOf);
    const noName = lines.find((l) => !l.name); if (noName) { setNote(T("A line has no name.", "एक line में नाम नहीं है।")); return; }
    const noImei = cart.find((c) => c.serial && !cleanCode(c.imei, 20)); if (noImei) { setNote(T(`Scan or type the IMEI of ${noImei.name}.`, `${noImei.name} का IMEI scan करें या लिखें।`)); return; }
    const phone = cust.phone.replace(/\D/g, "").slice(-10);
    if (cust.phone.trim() && phone.length !== 10) { setNote(T("The mobile number needs 10 digits.", "मोबाइल नंबर 10 अंकों का चाहिए।")); return; }
    const exPaise = kind === "sale" && ex.open ? paiseOf(ex.value) : 0;
    if (kind === "sale" && ex.open && (!ex.model.trim() || !exPaise)) { setNote(T("For the exchange, type the old phone's model and its value (or close the exchange box).", "Exchange के लिए पुराने फ़ोन का model और उसकी क़ीमत लिखें (या exchange box बंद करें)।")); return; }
    if (exPaise > totals.total) { setNote(T("The old phone's value is more than the bill.", "पुराने फ़ोन की क़ीमत बिल से ज़्यादा है।")); return; }
    if (pts && known?.points && pts < known.points.min) { setNote(T(`Use at least ${known.points.min} points.`, `कम-से-कम ${known.points.min} points इस्तेमाल करें।`)); return; }
    if (exPaise + ptsPaise > totals.total) { setNote(T("The points (and old phone) are worth more than the bill — use fewer points.", "points (और पुराने फ़ोन) की क़ीमत बिल से ज़्यादा है — कम points लगाएँ।")); return; }
    const toPay = totals.total - exPaise - ptsPaise;
    const payments = kind === "estimate" ? [] : mode === "part" ? (paiseOf(part.amount) ? [{ mode: part.mode, paise: paiseOf(part.amount), ref: "" }] : []) : mode === "emi" ? (toPay ? [{ mode: "other" as const, paise: toPay, ref: `EMI ${emi.trim()}`.trim().slice(0, 40) }] : []) : toPay ? [{ mode, paise: toPay, ref: "" }] : [];
    const paid = payments.reduce((a, p) => a + p.paise, 0);
    if (paid > toPay) { setNote(T("The money received is more than the bill.", "मिले पैसे बिल से ज़्यादा हैं।")); return; }
    if (kind === "sale" && paid < toPay && phone.length !== 10) { setNote(T("For udhaar (money left), type the customer's mobile.", "उधार (बाकी पैसे) के लिए ग्राहक का मोबाइल लिखें।")); return; }
    if (send && phone.length !== 10) { setNote(T("To send on WhatsApp, type the customer's mobile.", "WhatsApp पर भेजने के लिए ग्राहक का मोबाइल लिखें।")); return; }
    const body = { as: ws.as || undefined, kind, client_id: clientId.current, lines, payments, customer_name: cust.name.trim(), customer_phone: phone, discount_paise: paiseOf(disc), notes: notes.trim(), send, store: setup.stores.length ? (d.access.store || store) : undefined, points: pts || undefined, exchange: exPaise ? { model: ex.model.trim(), imei: ex.imei.trim(), paise: exPaise } : undefined };
    setBusy(send ? "send" : "save");
    try {
      const r = await api<{ bill?: BillRow; sent?: { sent?: boolean; error?: string } | null; error?: string }>("/api/mobile/bills", { method: "POST", json: body });
      setBusy("");
      if (!r.ok || !r.data.bill) { setNote(r.data?.error || T("Could not save.", "Save नहीं हुआ।")); return; }
      router.push(`/poster/mobile/bill/${r.data.bill.id}${asQ ? `${asQ}&` : "?"}new=${send ? (r.data.sent?.sent ? "sent" : "notsent") : "1"}`);
    } catch {
      // No network: keep the bill on the phone. It goes to the server, with the same client_id, when the network is back.
      setBusy("");
      const now = new Date().toISOString();
      if (!enqueue({ client_id: clientId.current, at: now, body: { ...body, send: false }, total: totals.total, name: cust.name.trim() })) { setNote(T("No internet, and this phone could not keep the bill (storage is full or blocked). Write it on paper.", "इंटरनेट नहीं है, और ये फ़ोन बिल नहीं रख पाया (storage भरा या बंद है)। काग़ज़ पर लिख लें।")); return; }
      // The phone's own list shows the stock that just went out.
      const next = { ...d, items: d.items.map((i) => { const n = cart.filter((c) => c.itemId === i.id).reduce((a, c) => a + c.qty, 0); return n && kind === "sale" ? { ...i, stock: i.stock - n, qty: i.serial ? i.qty : i.qty - n } : i; }) };
      keepItems(ws.as, next); setD(next);
      setOfflineBill({ id: clientId.current, owner_id: "", kind, number: 0, fin_year: "", code: T("OFFLINE (number comes after sync)", "OFFLINE (नंबर sync के बाद)"), status: "open", customer_name: body.customer_name, customer_phone: phone, customer_gstin: "", customer_state: "",
        lines, payments: [...(exPaise ? [{ mode: "other" as const, paise: exPaise, ref: `Exchange ${ex.model.trim()}`.slice(0, 40), at: now }] : []), ...(pts ? [{ mode: "other" as const, paise: ptsPaise, ref: `Points ${pts}`, at: now }] : []), ...payments.map((p) => ({ ...p, at: now }))], discount_paise: body.discount_paise + combo.off, total_paise: totals.total, gst_paise: totals.gst, balance_paise: toPay - paid, profit_paise: 0, gst_on: setup.gstOn, notes: body.notes, due_date: null, token: "", client_id: clientId.current, ref_bill_id: null, created_by: null, created_by_name: "", cancel_reason: "", created_at: now, updated_at: now, store: body.store ?? "", reminded_at: null });
      setTick((t) => t + 1);
    }
  }
  function fresh() {
    clientId.current = newClientId();
    setCart([]); setCust({ name: "", phone: "" }); setKnown(null); setUsePts(""); setMode("cash"); setEmi(""); setEx({ open: false, model: "", imei: "", value: "" }); setPart({ amount: "", mode: "cash" }); setDisc(""); setNotes(""); setNote(""); setOfflineBill(null);
  }

  if (err) return <div className="space-y-3 py-16 text-center"><p className="font-semibold">{err}</p><Link href={`/poster/mobile${asQ}`} className="text-sm font-semibold text-brand-ink">← {T("Mobile shop", "मोबाइल दुकान")}</Link></div>;
  if (!d || !setup) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const inp = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm";
  const small = "rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";
  const chip = (on: boolean) => `rounded-xl border px-3 py-2 text-sm font-semibold ${on ? "border-brand bg-brand text-white" : "border-border bg-surface"}`;

  if (offlineBill) return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } .ms-doc, .ms-doc * { visibility: visible !important; } .ms-doc { position: absolute; left: 0; top: 0; } @page { margin: 3mm; } }`}</style>
      <OfflineBar as={ws.as} tick={tick} />
      <p className="rounded-2xl border border-good/40 bg-good/10 px-3 py-2 text-sm font-semibold text-good print:hidden">{T("✅ Kept on this phone. It will be saved to your account when the internet is back — keep the app open then.", "✅ इस फ़ोन में रख लिया। इंटरनेट आते ही आपके खाते में save हो जाएगा — तब app खुला रखें।")}</p>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" /> Print</button>
        <button type="button" onClick={fresh} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {T("Next bill", "अगला बिल")}</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border py-3 shadow-card print:border-0 print:shadow-none"><Receipt bill={offlineBill} setup={setup} shop={setup.shopName} /></div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{kind === "estimate" ? "Estimate" : T("New bill", "नया बिल")}</h1>
      <MsHelp k="bill" />
      <OfflineBar as={ws.as} tick={tick} onSynced={() => void load()} />
      {stale && <p className="text-[12px] text-muted">{T("Showing the item list saved on this phone.", "इस फ़ोन में रखी item list दिख रही है।")}</p>}
      {setup.stores.length > 0 && (d.access.store
        ? <p className="text-[12px] font-semibold text-muted">🏪 {storeName(setup, d.access.store, hi)}</p>
        : <label className="flex items-center gap-2 text-[12px] font-semibold text-muted">🏪 {T("Billing at", "बिल कहाँ से")}<FieldTip lang={lang} en="Which shop this bill is from. Its stock goes out of that place, and the bill prints that branch's address." hi="ये बिल किस दुकान से है। स्टॉक उसी जगह से घटेगा, और बिल पर उसी ब्रांच का पता छपेगा।" />
          <select className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" value={store} onChange={(e) => { setStore(e.target.value); try { localStorage.setItem(STORE_KEY, e.target.value); } catch { /* ignore */ } setCart([]); }}>
            <option value="">{storeName(setup, "", hi)}</option>{setup.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>)}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
        <input ref={box} autoFocus className={`${inp} pl-9 pr-10`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onEnter(); } }}
          placeholder={T("Search item / phone model, or scan barcode / IMEI", "item / फ़ोन model खोजें, या barcode / IMEI scan करें")} />
        <span className="absolute right-3 top-2.5 text-muted">{busy === "scan" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}</span>
      </div>
      <p className="text-[11px] text-muted">{T("How to search", "कैसे खोजें")}<FieldTip lang={lang} en="Type part of the name, the brand, or the phone it fits — like 'cover redmi 13'. With a scanner: click this box and scan; the item is added by itself. For a phone, scan its IMEI." hi="नाम का हिस्सा, brand, या किस फ़ोन का है लिखें — जैसे 'cover redmi 13'। Scanner हो तो: इस box पर click करके scan करें; item अपने-आप जुड़ जाता है। फ़ोन के लिए उसका IMEI scan करें।" /></p>
      {q.trim() && (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5">
          {found.map((i) => (
            <button key={i.id} type="button" onClick={() => add(i)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-bg">
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{itemTitle(i)}</span><span className="block truncate text-[11px] text-muted">{i.serial ? "IMEI" : ""}{i.fits?.length ? ` ${T("Fits", "फ़िट")}: ${i.fits.slice(0, 4).join(", ")}` : ""}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-bold tabular-nums">{inr(i.price_paise)}</span><span className={`text-[11px] ${i.kind !== "service" && i.stock <= 0 ? "font-semibold text-danger" : "text-muted"}`}>{i.kind === "service" ? "" : `${T("Stock", "स्टॉक")} ${i.stock}`}</span></span>
            </button>
          ))}
          {!found.length && <p className="px-2 py-2 text-sm text-muted">{T("Not in your items. Press Enter if it is a barcode / IMEI, or add it as a custom line below.", "आपके items में नहीं है। barcode / IMEI हो तो Enter दबाएँ, या नीचे custom line से जोड़ें।")}</p>}
        </div>
      )}

      <section className="space-y-2">
        {cart.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("Search or scan to add items.", "item जोड़ने के लिए खोजें या scan करें।")}</p>}
        {cart.map((c) => (
          <div key={c.key} className="space-y-1.5 rounded-2xl border border-border bg-surface p-2.5">
            <div className="flex items-start justify-between gap-2">
              {c.itemId ? <p className="text-sm font-semibold">{c.name}</p> : <input className={`${small} flex-1`} value={c.name} onChange={(e) => change(c.key, { name: e.target.value })} placeholder={T("Item / work", "item / काम")} />}
              <button type="button" aria-label="Remove" onClick={() => setCart((x) => x.filter((y) => y.key !== c.key))} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button>
            </div>
            {c.serial && <label className="block text-[11px] text-muted">IMEI<FieldTip lang={lang} en="The IMEI of the exact phone you are handing over. Scan it from the box, or dial *#06# on the phone. It must be one that is in your stock." hi="जो फ़ोन आप दे रहे हैं ठीक उसी का IMEI। डिब्बे से scan करें, या फ़ोन पर *#06# दबाएँ। ये आपके स्टॉक में होना चाहिए।" /><input className={`${small} mt-0.5 w-full font-mono`} value={c.imei} onChange={(e) => change(c.key, { imei: e.target.value })} placeholder="IMEI" inputMode="numeric" /></label>}
            <div className="flex flex-wrap items-center gap-2">
              {!c.serial && <span className="inline-flex items-center rounded-lg border border-border">
                <button type="button" aria-label="Less" onClick={() => change(c.key, { qty: Math.max(1, c.qty - 1) })} className="p-2"><Minus className="h-3.5 w-3.5" /></button>
                <input className="w-10 bg-transparent text-center text-sm font-bold" inputMode="numeric" value={c.qty} onChange={(e) => change(c.key, { qty: Math.max(1, Math.min(9999, Math.round(Number(e.target.value)) || 1)) })} />
                <button type="button" aria-label="More" onClick={() => change(c.key, { qty: c.qty + 1 })} className="p-2"><Plus className="h-3.5 w-3.5" /></button>
              </span>}
              <label className="flex items-center gap-1 text-[11px] text-muted">₹ <input className={`${small} w-24`} inputMode="decimal" value={c.price} onChange={(e) => change(c.key, { price: e.target.value })} /></label>
              <label className="flex items-center gap-1 text-[11px] text-muted">{T("Disc ₹", "छूट ₹")}<FieldTip lang={lang} en="Rupees off this one line (for all its pieces together). For a discount on the whole bill, use the box below." hi="सिर्फ़ इस line पर रुपयों की छूट (सारे पीस मिलाकर)। पूरे बिल पर छूट के लिए नीचे का box इस्तेमाल करें।" /> <input className={`${small} w-20`} inputMode="decimal" value={c.disc} onChange={(e) => change(c.key, { disc: e.target.value })} /></label>
              <span className="ml-auto text-sm font-bold tabular-nums">{inr(Math.max(0, c.qty * paiseOf(c.price) - paiseOf(c.disc)))}</span>
            </div>
            {kind === "sale" && c.stock !== null && c.qty > c.stock && <p className="text-[11px] font-semibold text-amber-700">{T(`Stock shows only ${c.stock}. The bill will still save.`, `स्टॉक में सिर्फ़ ${c.stock} दिख रहे हैं। बिल फिर भी बन जाएगा।`)}</p>}
          </div>
        ))}
        {custom.open ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2.5">
            <input autoFocus className={`${small} min-w-0 flex-1`} value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder={T("Name (e.g. glass fitting)", "नाम (जैसे glass लगाई)")} />
            <input className={`${small} w-24`} inputMode="decimal" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} placeholder="₹" />
            <button type="button" disabled={!custom.name.trim() || !paiseOf(custom.price)} onClick={() => { setCart((c) => [...c, { key: `l${++seq}`, itemId: "", name: custom.name.trim(), qty: 1, price: custom.price, disc: "", imei: "", serial: false, gstBp: 1800, stock: null }]); setCustom({ open: false, name: "", price: "" }); }} className="rounded-lg grad-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{T("Add", "जोड़ें")}</button>
          </div>
        ) : <button type="button" onClick={() => setCustom({ ...custom, open: true })} className="text-sm font-semibold text-brand-ink">+ {T("Custom line (not in items)", "Custom line (items में नहीं)")}<FieldTip lang={lang} en="For something you sell or do once and have not added to Items — like a fitting charge. It does not change stock." hi="जो चीज़ या काम एक बार का है और Items में नहीं जोड़ा — जैसे fitting charge। इससे स्टॉक नहीं बदलता।" /></button>}
      </section>

      {cart.length > 0 && (
        <>
          <section className="grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold text-muted">{T("Customer name", "ग्राहक का नाम")} <span className="font-normal">(optional)</span><input className={`${inp} mt-1`} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></label>
            <label className="text-[12px] font-semibold text-muted">{T("Mobile", "मोबाइल")}<FieldTip lang={lang} en="Needed for udhaar and to send the bill on WhatsApp. The customer is also saved in your Customers list." hi="उधार और WhatsApp पर बिल भेजने के लिए ज़रूरी। ग्राहक आपकी Customers list में भी जुड़ जाता है।" /><input className={`${inp} mt-1`} inputMode="numeric" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="10 digits" /></label>
            {known && (known.due.paise > 0 || known.points) && (
              <div className="space-y-1.5 rounded-xl bg-bg px-3 py-2 text-[13px] sm:col-span-2">
                {known.due.paise > 0 && <p className="font-semibold text-danger">{T(`Old udhaar: ${inr(known.due.paise)} on ${known.due.count} bill(s)`, `पुराना उधार: ${inr(known.due.paise)} (${known.due.count} बिल)`)}</p>}
                {known.points && kind === "sale" && <div className="flex flex-wrap items-center gap-2"><span>⭐ {T("Points", "Points")}: <b>{known.points.balance}</b> <span className="text-muted">({T("worth", "क़ीमत")} {inr(known.points.balance * known.points.worth)})</span></span>
                  {known.points.balance >= known.points.min && known.points.balance > 0 ? <>
                    <input className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-sm" inputMode="numeric" value={usePts} onChange={(e) => setUsePts(e.target.value)} placeholder="0" />
                    <button type="button" onClick={() => setUsePts(String(Math.min(known.points!.balance, Math.floor(totals.total / known.points!.worth))))} className="text-xs font-semibold text-brand-ink">{T("Use all", "सारे लगाएँ")}</button>
                    {pts > 0 && <span className="font-semibold text-good">− {inr(ptsPaise)}</span>}</>
                    : <span className="text-[11px] text-muted">{T(`Can be used from ${known.points.min} points.`, `${known.points.min} points होने पर इस्तेमाल होंगे।`)}</span>}</div>}
              </div>
            )}
            <label className="text-[12px] font-semibold text-muted">{T("Discount on the bill ₹", "पूरे बिल पर छूट ₹")}<FieldTip lang={lang} en="A round-off or bargain on the whole bill. Staff can give up to the limit set in Settings." hi="पूरे बिल पर मोल-भाव या round-off की छूट। Staff Settings में तय limit तक ही दे सकता है।" /><input className={`${inp} mt-1`} inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} /></label>
            <label className="text-[12px] font-semibold text-muted">{T("Note on the bill", "बिल पर नोट")} <span className="font-normal">(optional)</span><input className={`${inp} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </section>

          {kind === "sale" && (ex.open ? (
            <section className="space-y-2 rounded-2xl border border-border bg-surface p-3">
              <p className="flex items-center justify-between text-[12px] font-semibold text-muted"><span>{T("Old phone taken in exchange", "Exchange में लिया पुराना फ़ोन")}<FieldTip lang={lang} en="Its value comes off what the customer pays. The old phone goes into your stock as 'Used <model>' at this value — sell it later like any phone." hi="इसकी क़ीमत ग्राहक के देने वाले पैसों से घटती है। पुराना फ़ोन इसी क़ीमत पर 'Used <model>' नाम से आपके स्टॉक में आ जाता है — बाद में किसी भी फ़ोन की तरह बेचें।" /></span><button type="button" onClick={() => setEx({ open: false, model: "", imei: "", value: "" })} className="text-xs font-semibold text-muted">{T("Remove", "हटाएँ")}</button></p>
              <div className="flex flex-wrap gap-2">
                <input className={`${small} min-w-0 flex-1`} value={ex.model} onChange={(e) => setEx({ ...ex, model: e.target.value })} placeholder={T("Model (e.g. Redmi 9 blue)", "Model (जैसे Redmi 9 blue)")} />
                <input className={`${small} w-40 font-mono`} inputMode="numeric" value={ex.imei} onChange={(e) => setEx({ ...ex, imei: e.target.value })} placeholder="IMEI" />
                <input className={`${small} w-28`} inputMode="decimal" value={ex.value} onChange={(e) => setEx({ ...ex, value: e.target.value })} placeholder={T("Value ₹", "क़ीमत ₹")} />
              </div>
            </section>
          ) : <button type="button" onClick={() => setEx({ ...ex, open: true })} className="text-sm font-semibold text-brand-ink">+ {T("Old phone in exchange", "पुराना फ़ोन exchange में")}</button>)}

          {kind === "sale" && (
            <section className="space-y-2 rounded-2xl border border-border bg-surface p-3">
              <p className="text-[12px] font-semibold text-muted">{T("Payment", "पेमेंट")}<FieldTip lang={lang} en="Cash, UPI or Card = the full bill is paid that way. Part / udhaar = type what came now; the rest shows as udhaar." hi="Cash, UPI या Card = पूरा बिल उसी से चुका। कुछ / उधार = अभी जो मिला वो लिखें; बाकी उधार में दिखेगा।" /></p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMode("cash")} className={chip(mode === "cash")}>Cash</button>
                <button type="button" onClick={() => setMode("upi")} className={chip(mode === "upi")}>UPI</button>
                <button type="button" onClick={() => setMode("card")} className={chip(mode === "card")}>Card</button>
                <button type="button" onClick={() => setMode("emi")} className={chip(mode === "emi")}>EMI</button>
                <button type="button" onClick={() => setMode("part")} className={chip(mode === "part")}>{T("Part / udhaar", "कुछ / उधार")}</button>
              </div>
              {mode === "emi" && <label className="flex flex-wrap items-center gap-2 text-sm">{T("Finance company", "Finance कंपनी")}<FieldTip lang={lang} en="The whole bill is paid by the finance company (Bajaj, HDB, TVS…). It shows as EMI in your day's money, apart from cash and UPI. A down payment in cash? Use Part / udhaar and take the rest when the finance money comes." hi="पूरा बिल finance कंपनी (Bajaj, HDB, TVS…) से चुकता है। दिन के पैसों में ये EMI में अलग दिखता है, cash और UPI से अलग। Down payment cash में हो? कुछ / उधार चुनें और finance का पैसा आने पर बाकी लें।" /><input className={`${small} w-40`} value={emi} onChange={(e) => setEmi(e.target.value)} placeholder="Bajaj Finserv" /></label>}
              {mode === "part" && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{T("Received now ₹", "अभी मिला ₹")}</span>
                  <input className={`${small} w-28`} inputMode="decimal" value={part.amount} onChange={(e) => setPart({ ...part, amount: e.target.value })} placeholder="0" />
                  <select className={small} value={part.mode} onChange={(e) => setPart({ ...part, mode: e.target.value as Payment["mode"] })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select>
                  <span className="font-semibold text-danger">{T("Udhaar", "उधार")}: {inr(Math.max(0, totals.total - (ex.open ? paiseOf(ex.value) : 0) - ptsPaise - paiseOf(part.amount)))}</span>
                </div>
              )}
              {validUpi(setup.upi) && (mode === "upi" || (mode === "part" && part.mode === "upi" && paiseOf(part.amount) > 0)) && (
                <div className="rounded-xl border border-border bg-white p-2 text-black"><UpiQr upi={setup.upi} name={setup.shopName} paise={mode === "upi" ? Math.max(0, totals.total - (ex.open ? paiseOf(ex.value) : 0) - ptsPaise) : paiseOf(part.amount)} size={150} /></div>
              )}
              {mode === "upi" && !validUpi(setup.upi) && <p className="text-[11px] text-muted">{T("Add your UPI ID in Settings to show a QR for the exact amount here.", "यहाँ सही रक़म का QR दिखाने के लिए Settings में अपनी UPI ID डालें।")}</p>}
            </section>
          )}

          <section className="space-y-2 rounded-2xl border-2 border-brand/40 bg-surface p-3">
            {combo.off > 0 && <p className="flex justify-between text-sm font-semibold text-good"><span>🎁 {T("Combo offer", "Combo offer")}: {combo.names.join(", ")}</span><span>− {inr(combo.off)}</span></p>}
            {(totals.lineDiscount + totals.billDiscount > 0) && <p className="flex justify-between text-sm text-muted"><span>{T("Discount", "छूट")}{combo.off > 0 ? ` (${T("with combo", "combo मिलाकर")})` : ""}</span><span>− {inr(totals.lineDiscount + totals.billDiscount)}</span></p>}
            {setup.gstOn && <p className="flex justify-between text-[12px] text-muted"><span>{T("GST inside the price", "दाम में शामिल GST")}</span><span>{inr(totals.gst, true)}</span></p>}
            <p className="flex items-baseline justify-between"><span className="text-sm font-semibold">{T("Total", "कुल")} · {totals.qty} {T("pcs", "पीस")}</span><span className="text-2xl font-bold tabular-nums">{inr(totals.total)}</span></p>
            {kind === "sale" && ((ex.open && paiseOf(ex.value) > 0) || pts > 0) && <p className="flex justify-between text-sm"><span>{ex.open && paiseOf(ex.value) > 0 ? `${T("Old phone", "पुराना फ़ोन")} − ${inr(paiseOf(ex.value))} ` : ""}{pts > 0 ? `· Points − ${inr(ptsPaise)}` : ""}</span><span className="font-bold">{T("Customer pays", "ग्राहक देगा")} {inr(Math.max(0, totals.total - (ex.open ? paiseOf(ex.value) : 0) - ptsPaise))}</span></p>}
            {note && <p className="text-sm font-semibold text-danger">{note}</p>}
            <p className="text-[11px] text-muted">{T("Save or Save & WhatsApp?", "Save या Save & WhatsApp?")}<FieldTip lang={lang} en="Save = the bill is made; print it on the next screen. Save & WhatsApp = it is also sent to the customer's mobile (type the mobile above). The stock reduces either way." hi="Save = बिल बन जाता है; अगली screen पर print करें। Save & WhatsApp = साथ में ग्राहक के मोबाइल पर भी जाता है (ऊपर मोबाइल लिखें)। दोनों में स्टॉक घटता है।" /></p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!!busy} onClick={() => void save(false)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-3 text-sm font-bold disabled:opacity-50">{busy === "save" && <LoaderCircle className="h-4 w-4 animate-spin" />} Save</button>
              <button type="button" disabled={!!busy} onClick={() => void save(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === "send" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Save &amp; WhatsApp</button>
            </div>
          </section>
        </>
      )}
      {note && cart.length === 0 && <p className="text-sm font-semibold text-danger">{note}</p>}
    </div>
  );
}

export default function NewBillPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><NewBill /></Suspense>;
}
