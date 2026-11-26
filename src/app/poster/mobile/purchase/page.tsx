"use client";
// Purchase: stock that came in from a supplier. Counted items go up by their number and take the new cost; a phone gets one
// unit for every IMEI scanned.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, MessageCircle, PackageCheck, Search, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { inr, paiseOf } from "@/lib/jewellery";
import { itemMatches, itemTitle, type ItemRow, type MsSetup, type PurchaseLine } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { MsHelp } from "@/components/mobile/page-help";

type Item = ItemRow & { stock: number };
type Loaded = { items: Item[]; setup: MsSetup; access: MsAccess; error?: string };
type PL = { key: string; itemId: string; name: string; serial: boolean; qty: string; cost: string; imeis: string };
type Past = { id: string; supplier_name: string; supplier_phone: string; bill_no: string; bill_date: string | null; lines: PurchaseLine[]; total_paise: number; paid_paise: number; created_at: string; status?: string; notes?: string };
/** The order as the supplier reads it on WhatsApp. */
const poText = (shop: string, p: Pick<Past, "lines">, hi: boolean) => [hi ? `नमस्ते 🙏 ${shop} का order:` : `Hello 🙏 Order from ${shop}:`, ...(p.lines ?? []).map((l) => `• ${l.name} × ${l.qty}`), hi ? "कृपया उपलब्धता और रेट बताएँ। धन्यवाद।" : "Please confirm availability and rates. Thank you."].join("\n");
const waTo = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
let seq = 0;
const imeiList = (s: string) => s.split(/[\s,]+/).filter(Boolean);

export default function PurchasePage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [d, setD] = useState<Loaded | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<PL[]>([]);
  const [sup, setSup] = useState({ name: "", phone: "", bill_no: "", bill_date: "", paid: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null);
  const [pay, setPay] = useState<{ id: string; amount: string }>({ id: "", amount: "" });
  const [order, setOrder] = useState(false);
  const [poId, setPoId] = useState("");
  const [sendPo, setSendPo] = useState<{ phone: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api<Loaded>(`/api/mobile/items${asQ}`, { fresh: true }), api<{ purchases?: Past[] }>(`/api/mobile/purchases${asQ}`, { fresh: true })]);
      if (!a.ok) { setErr(a.data?.error || "Could not load."); return; }
      setErr(""); setD(a.data); setPast(b.ok ? b.data.purchases ?? [] : []);
    } catch { setErr("No internet. Purchases need the network."); }
  }, [asQ]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const found = useMemo(() => (d && q.trim() ? d.items.filter((i) => i.active && i.kind !== "service" && itemMatches(i, q)).slice(0, 20) : []), [d, q]);

  const change = (key: string, p: Partial<PL>) => setLines((c) => c.map((x) => (x.key === key ? { ...x, ...p } : x)));
  function add(i: Item) {
    setNote(null); setQ("");
    setLines((c) => (c.some((x) => x.itemId === i.id) ? c : [...c, { key: `p${++seq}`, itemId: i.id, name: itemTitle(i), serial: i.serial, qty: "", cost: i.cost_paise ? String(i.cost_paise / 100) : "", imeis: "" }]));
  }
  async function save() {
    setNote(null);
    const body = lines.map((l) => ({ itemId: l.itemId, name: l.name, qty: Math.max(0, Math.round(Number(l.qty)) || 0), cost: paiseOf(l.cost), imeis: l.serial ? imeiList(l.imeis) : [] }));
    const empty = lines.find((l, n) => !(l.serial && !order ? body[n].imeis.length : body[n].qty));
    if (empty) { setNote({ ok: false, t: empty.serial && !order ? T(`Scan the IMEIs of ${empty.name}.`, `${empty.name} के IMEI scan करें।`) : order ? T(`Type how many to order: ${empty.name}.`, `कितने मँगाने हैं लिखें: ${empty.name}।`) : T(`Type how many came: ${empty.name}.`, `कितने आए लिखें: ${empty.name}।`) }); return; }
    setBusy(true);
    let store = "";
    try { store = localStorage.getItem("shubhora.ms-store") ?? ""; } catch { /* ignore */ }
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/mobile/purchases", { method: "POST", json: { as: ws.as || undefined, supplier_name: sup.name, supplier_phone: sup.phone, bill_no: sup.bill_no, bill_date: sup.bill_date || undefined, paid_paise: order ? 0 : paiseOf(sup.paid), lines: body.map((l) => (order ? { ...l, imeis: [] } : l)), order, po_id: poId || undefined, store } });
      setBusy(false);
      if (!r.ok) { setNote({ ok: false, t: r.data?.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
      const phone = sup.phone.replace(/\D/g, "").slice(-10);
      setSendPo(order && phone.length === 10 ? { phone: `91${phone}`, text: poText(d?.setup.shopName || "", { lines: body }, hi) } : null);
      setLines([]); setSup({ name: "", phone: "", bill_no: "", bill_date: "", paid: "" }); setPoId("");
      setNote({ ok: true, t: order ? T("✅ Order saved. Send it to the supplier; when the goods come, tap 'Goods came' on it.", "✅ Order save हो गया। सप्लायर को भेजें; माल आने पर उस पर 'माल आ गया' दबाएँ।") : T("✅ Saved. The stock has gone up.", "✅ Save हो गया। स्टॉक बढ़ गया।") }); void load();
    } catch { setBusy(false); setNote({ ok: false, t: T("No internet.", "इंटरनेट नहीं है।") }); }
  }

  async function paySupplier() {
    setBusy(true); setNote(null);
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/mobile/purchases", { method: "PATCH", json: { as: ws.as || undefined, id: pay.id, paise: paiseOf(pay.amount) } });
      setBusy(false);
      if (!r.ok) { setNote({ ok: false, t: r.data?.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
      setPay({ id: "", amount: "" }); setNote({ ok: true, t: T("✅ Payment noted.", "✅ पेमेंट दर्ज हो गया।") }); void load();
    } catch { setBusy(false); setNote({ ok: false, t: T("No internet.", "इंटरनेट नहीं है।") }); }
  }
  async function cancelPo(id: string) {
    setBusy(true);
    try { const r = await api<{ error?: string }>("/api/mobile/purchases", { method: "PATCH", json: { as: ws.as || undefined, action: "cancel", id } }); if (!r.ok) setNote({ ok: false, t: r.data?.error || "" }); else void load(); } catch { /* offline */ }
    setBusy(false);
  }
  function receive(p: Past) {
    if (!d) return;
    setOrder(false); setPoId(p.id); setSendPo(null); setNote(null);
    setSup({ name: p.supplier_name, phone: p.supplier_phone.replace(/^\+91/, ""), bill_no: "", bill_date: "", paid: "" });
    setLines((p.lines ?? []).map((l) => { const it = d.items.find((i) => i.id === l.itemId); return { key: `p${++seq}`, itemId: l.itemId, name: it ? itemTitle(it) : l.name, serial: !!it?.serial, qty: String(l.qty), cost: l.cost ? String(l.cost / 100) : it?.cost_paise ? String(it.cost_paise / 100) : "", imeis: "" }; }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const total = lines.reduce((a, l) => a + (l.serial && !order ? imeiList(l.imeis).length : Math.max(0, Math.round(Number(l.qty)) || 0)) * paiseOf(l.cost), 0);
  const orders = past.filter((p) => p.status === "ordered");
  const done = past.filter((p) => !p.status || p.status === "received");
  // What the shop owes, supplier by supplier.
  const owed = new Map<string, number>();
  for (const p of done) { const due = p.total_paise - p.paid_paise; if (due > 0) owed.set(p.supplier_name || "—", (owed.get(p.supplier_name || "—") ?? 0) + due); }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const can = (r: string) => d.access.owner || d.access.rights.includes(r as never);
  const inp = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm";
  const small = "rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";
  const lab = "block text-[12px] font-semibold text-muted";
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{T("Purchase (stock in)", "ख़रीद (माल आया)")}</h1>
      <MsHelp k="purchase" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setOrder(false); setSendPo(null); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${!order ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{T("Stock came in", "माल आया")}</button>
        <button type="button" onClick={() => { setOrder(true); setPoId(""); setSendPo(null); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${order ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{T("Order to supplier (PO)", "सप्लायर को order (PO)")}</button>
        <FieldTip lang={lang} en="Order = a list of what you want from a supplier, sent on WhatsApp. Stock does not change until the goods come — then tap 'Goods came' on the order." hi="Order = सप्लायर से जो चाहिए उसकी list, WhatsApp पर भेजी जाती है। माल आने तक स्टॉक नहीं बदलता — तब order पर 'माल आ गया' दबाएँ।" />
      </div>
      {poId && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink">{T("Receiving an order: check the numbers, scan phone IMEIs, then Save.", "Order का माल चढ़ा रहे हैं: गिनती जाँचें, फ़ोन के IMEI scan करें, फिर Save करें।")} <button type="button" onClick={() => { setPoId(""); setLines([]); }} className="ml-1 text-xs underline">{T("Stop", "छोड़ें")}</button></p>}
      {sendPo && <a href={waTo(sendPo.phone, sendPo.text)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366] bg-surface px-3 py-2 text-sm font-semibold text-[#128C7E]"><MessageCircle className="h-4 w-4" /> {T("Send the order to the supplier on WhatsApp", "Order सप्लायर को WhatsApp पर भेजें")}</a>}
      {orders.length > 0 && !poId && (
        <section className="space-y-2 rounded-2xl border border-brand/40 bg-surface p-3">
          <h2 className="text-sm font-bold">{T("Open orders", "खुले order")} ({orders.length})</h2>
          {orders.map((p) => (
            <div key={p.id} className="rounded-xl border border-border px-3 py-2 text-sm">
              <p className="flex justify-between gap-2"><span className="truncate font-semibold">{p.supplier_name || T("Supplier", "सप्लायर")}</span><span className="shrink-0 text-[11px] text-muted">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></p>
              <p className="truncate text-[11px] text-muted">{(p.lines ?? []).map((l) => `${l.name} ×${l.qty}`).join(", ")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => receive(p)} className="inline-flex items-center gap-1 rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white"><PackageCheck className="h-3.5 w-3.5" /> {T("Goods came", "माल आ गया")}</button>
                {p.supplier_phone && <a href={waTo(p.supplier_phone, poText(d.setup.shopName || "", p, hi))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#25D366] px-3 py-1.5 text-xs font-semibold text-[#128C7E]"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
                <button type="button" disabled={busy} onClick={() => void cancelPo(p.id)} className="text-xs font-semibold text-muted">{T("Cancel order", "Order रद्द")}</button>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2">
        <label className={lab}>{T("Supplier", "सप्लायर")} <span className="font-normal">(optional)</span><input className={inp} value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} /></label>
        <label className={lab}>{T("Supplier's mobile", "सप्लायर का मोबाइल")} <span className="font-normal">({order ? T("to send the order", "order भेजने के लिए") : "optional"})</span><input className={inp} inputMode="numeric" value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} /></label>
        {!order && <label className={lab}>{T("Supplier's bill no.", "सप्लायर का बिल नंबर")} <span className="font-normal">(optional)</span><FieldTip lang={lang} en="The number on the supplier's own bill, so you can match it later." hi="सप्लायर के अपने बिल का नंबर, ताकि बाद में मिला सकें।" /><input className={inp} value={sup.bill_no} onChange={(e) => setSup({ ...sup, bill_no: e.target.value })} /></label>}
        {!order && <label className={lab}>{T("Bill date", "बिल की तारीख")} <span className="font-normal">(optional)</span><input type="date" className={inp} value={sup.bill_date} onChange={(e) => setSup({ ...sup, bill_date: e.target.value })} /></label>}
        {!order && <label className={lab}>{T("Paid to supplier ₹", "सप्लायर को दिया ₹")}<FieldTip lang={lang} en="How much of this bill you have paid. It is kept as a note for you; the rest is what you owe." hi="इस बिल में से कितना चुका दिया। ये आपकी जानकारी के लिए है; बाकी आपकी देनदारी है।" /><input className={inp} inputMode="decimal" value={sup.paid} onChange={(e) => setSup({ ...sup, paid: e.target.value })} /></label>}
      </section>

      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search the item that came", "जो item आया वो खोजें")} /></div>
      {q.trim() && (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5">
          {found.map((i) => <button key={i.id} type="button" onClick={() => add(i)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-bg"><span className="truncate font-semibold">{itemTitle(i)}</span><span className="shrink-0 text-[11px] text-muted">{T("Stock", "स्टॉक")} {i.stock}</span></button>)}
          {!found.length && <p className="px-2 py-2 text-sm text-muted">{T("Not found. Add it in Items first.", "नहीं मिला। पहले Items में जोड़ें।")} <Link href={`/poster/mobile/items${asQ}`} className="font-semibold text-brand-ink">Items →</Link></p>}
        </div>
      )}

      <section className="space-y-2">
        {lines.map((l) => (
          <div key={l.key} className="space-y-1.5 rounded-2xl border border-border bg-surface p-2.5">
            <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{l.name}</p><button type="button" aria-label="Remove" onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button></div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
              {(!l.serial || order) && <label className="flex items-center gap-1">{T("Qty", "गिनती")}<FieldTip lang={lang} en="How many pieces came now. This number is added to the stock." hi="अभी कितने पीस आए। ये संख्या स्टॉक में जुड़ जाती है।" /> <input className={`${small} w-20`} inputMode="numeric" value={l.qty} onChange={(e) => change(l.key, { qty: e.target.value })} /></label>}
              {can("cost") && <label className="flex items-center gap-1">{T("Cost of one ₹", "एक की लागत ₹")}<FieldTip lang={lang} en="What you paid for one piece this time. It becomes the item's cost, and profit is worked out from it." hi="इस बार एक पीस कितने में पड़ा। यही item की लागत बन जाती है, और मुनाफ़ा इसी से निकलता है।" /> <input className={`${small} w-24`} inputMode="decimal" value={l.cost} onChange={(e) => change(l.key, { cost: e.target.value })} /></label>}
            </div>
            {l.serial && !order && <label className={lab}>IMEI ({imeiList(l.imeis).length}) — {T("scan each, one per line", "हर एक scan करें, एक line में एक")}<textarea className={`${inp} font-mono`} rows={3} value={l.imeis} onChange={(e) => change(l.key, { imeis: e.target.value })} /></label>}
          </div>
        ))}
      </section>
      {note && <p className={`text-sm font-semibold ${note.ok ? "text-good" : "text-danger"}`}>{note.t}</p>}
      {lines.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-brand/40 bg-surface p-3">
          <span className="text-sm font-semibold">{can("cost") ? <>{T("Total", "कुल")}: <b className="tabular-nums">{inr(total)}</b></> : `${lines.length} items`}</span>
          <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {order ? T("Save order", "Order save करें") : "Save"}</button>
        </div>
      )}

      {can("cost") && owed.size > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
          <p className="text-sm font-bold text-amber-900">{T("To pay suppliers", "सप्लायर को देना बाकी")}: {inr([...owed.values()].reduce((a, b) => a + b, 0))}<FieldTip lang={lang} en="Purchases you have not fully paid for. When you pay, tap 'Note a payment to the supplier' on that purchase below." hi="जिन ख़रीद का पूरा पैसा नहीं दिया। पैसा दें तो नीचे उसी ख़रीद पर 'सप्लायर को दिया पैसा दर्ज करें' दबाएँ।" /></p>
          <ul className="mt-1 text-[13px]">{[...owed.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => <li key={n} className="flex justify-between"><span>{n === "—" ? T("No name", "बिना नाम") : n}</span><b className="tabular-nums">{inr(v)}</b></li>)}</ul>
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">{T("Past purchases", "पिछली ख़रीद")}</h2>
          {done.slice(0, 30).map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm">
              <p className="flex justify-between gap-2"><span className="truncate font-semibold">{p.supplier_name || T("Supplier", "सप्लायर")}{p.bill_no ? ` · ${p.bill_no}` : ""}</span>{can("cost") && <b className="shrink-0 tabular-nums">{inr(p.total_paise)}</b>}</p>
              <p className="truncate text-[11px] text-muted">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {(p.lines ?? []).map((l) => `${l.name} ×${l.qty}`).join(", ")}{can("cost") && p.total_paise > p.paid_paise ? ` · ${T("to pay", "देना बाकी")} ${inr(p.total_paise - p.paid_paise)}` : ""}</p>
              {can("cost") && p.total_paise > p.paid_paise && (pay.id === p.id
                ? <span className="mt-1 flex flex-wrap items-center gap-1.5"><input autoFocus className={`${small} w-28`} inputMode="decimal" placeholder="₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /><button type="button" disabled={busy || !paiseOf(pay.amount)} onClick={() => void paySupplier()} className="rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{T("Paid", "दे दिया")}</button><button type="button" onClick={() => setPay({ id: "", amount: "" })} className="text-xs text-muted">{T("Close", "बंद")}</button></span>
                : <button type="button" onClick={() => setPay({ id: p.id, amount: String((p.total_paise - p.paid_paise) / 100) })} className="mt-1 text-xs font-semibold text-brand-ink">{T("Note a payment to the supplier →", "सप्लायर को दिया पैसा दर्ज करें →")}</button>)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
