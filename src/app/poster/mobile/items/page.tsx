"use client";
// Items and stock: everything the shop sells, with price, the phones an accessory fits, and how many are left. A counted item
// (covers, glasses, parts) has a number; a phone is kept one IMEI at a time.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Pencil, Plus, Search, X } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { FieldTip } from "@/components/field-tip";
import { inr, paiseOf } from "@/lib/jewellery";
import { CATEGORIES, ITEM_KINDS, itemMatches, itemTitle, type ItemKind, type ItemRow, type MsSetup, type UnitRow } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { MsHelp } from "@/components/mobile/page-help";

type Item = ItemRow & { stock: number };
type Loaded = { items: Item[]; setup: MsSetup; access: MsAccess; error?: string };
type Form = { id: string; kind: ItemKind; category: string; name: string; brand: string; model: string; variant: string; price: string; mrp: string; cost: string; barcode: string; low: string; fits: string; warranty: string; gst: string; hsn: string; qty: string; serial: boolean; active: boolean };
const BLANK: Form = { id: "", kind: "accessory", category: "cover", name: "", brand: "", model: "", variant: "", price: "", mrp: "", cost: "", barcode: "", low: "", fits: "", warranty: "", gst: "18", hsn: "", qty: "", serial: false, active: true };
const rs = (p: number) => (p ? String(p / 100) : "");

export default function ItemsPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [d, setD] = useState<Loaded | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "low">("all");
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [imeis, setImeis] = useState("");
  const [count, setCount] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<Loaded>(`/api/mobile/items?all=1${ws.q ? `&${ws.q}` : ""}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setD(r.data);
    } catch { setErr("No internet."); }
  }, [ws.q]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const shown = useMemo(() => (d?.items ?? []).filter((i) => itemMatches(i, q) && (only === "all" || (i.active && i.kind !== "service" && (i.low_qty > 0 ? i.stock <= i.low_qty : i.stock <= 0)))), [d, q, only]);

  async function loadUnits(id: string) {
    setUnits(null);
    const r = await api<{ units?: UnitRow[] }>(`/api/mobile/items?units=${id}${ws.q ? `&${ws.q}` : ""}`, { fresh: true }).catch(() => null);
    setUnits(r?.ok ? r.data.units ?? [] : []);
  }
  function edit(i: Item) {
    setNote(""); setImeis(""); setCount(String(i.stock));
    setF({ id: i.id, kind: i.kind, category: i.category, name: i.name, brand: i.brand, model: i.model, variant: i.variant, price: rs(i.price_paise), mrp: rs(i.mrp_paise), cost: rs(i.cost_paise), barcode: i.barcode, low: i.low_qty ? String(i.low_qty) : "", fits: (i.fits ?? []).join(", "), warranty: i.warranty_months ? String(i.warranty_months) : "", gst: String(i.gst_bp / 100), hsn: i.hsn, qty: "", serial: i.serial, active: i.active });
    if (i.serial) void loadUnits(i.id);
  }
  async function post(json: Record<string, unknown>) {
    setBusy(true); setNote("");
    try {
      const r = await api<{ item?: Item; added?: number; already?: string[]; error?: string }>("/api/mobile/items", { method: "POST", json: { as: ws.as || undefined, ...json } });
      setBusy(false);
      if (!r.ok) { setNote(r.data?.error || T("Could not save.", "Save नहीं हुआ।")); return null; }
      return r.data;
    } catch { setBusy(false); setNote(T("No internet.", "इंटरनेट नहीं है।")); return null; }
  }
  async function save() {
    if (!f) return;
    if (!f.name.trim()) { setNote(T("Type the item's name.", "item का नाम लिखें।")); return; }
    if (f.kind !== "service" && !paiseOf(f.price)) { setNote(T("Type the selling price.", "बेचने का दाम लिखें।")); return; }
    const r = await post({ id: f.id || undefined, kind: f.kind, category: f.category, name: f.name, brand: f.brand, model: f.model, variant: f.variant, price_paise: paiseOf(f.price), mrp_paise: paiseOf(f.mrp), cost_paise: paiseOf(f.cost), barcode: f.barcode, low_qty: Number(f.low) || 0, fits: f.fits, warranty_months: Number(f.warranty) || 0, gst_bp: Math.round((Number(f.gst) || 0) * 100), hsn: f.hsn, serial: f.kind === "phone", qty: Number(f.qty) || 0, active: f.active });
    if (r) { setF(null); void load(); }
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const can = (r: string) => d.access.owner || d.access.rights.includes(r as never);
  const inp = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm";
  const lab = "block text-[12px] font-semibold text-muted";
  const tip = (en: string, h: string) => <FieldTip lang={lang} en={en} hi={h} />;

  if (f) {
    const cats = CATEGORIES.filter((c) => c.kind === f.kind || c.key === "other");
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h1 className="text-lg font-bold">{f.id ? T("Change item", "item बदलें") : T("Add item", "item जोड़ें")}</h1><button type="button" aria-label="Close" onClick={() => setF(null)} className="p-2 text-muted"><X className="h-5 w-5" /></button></div>
        <section className="grid gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-2">
          {!f.id && <div className="sm:col-span-2"><span className={lab}>{T("What is it?", "ये क्या है?")}{tip("Accessory / part = counted by number. Phone = each piece has its own IMEI. Service = a charge, no stock.", "Accessory / part = गिनती से। फ़ोन = हर पीस का अपना IMEI। Service = सिर्फ़ charge, स्टॉक नहीं।")}</span>
            <div className="mt-1 flex flex-wrap gap-2">{ITEM_KINDS.map((k) => <button key={k.key} type="button" onClick={() => setF({ ...f, kind: k.key, category: CATEGORIES.find((c) => c.kind === k.key)?.key ?? "other" })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${f.kind === k.key ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{hi ? k.hi : k.en}</button>)}</div></div>}
          {f.kind !== "service" && <label className={lab}>Category<select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, hsn: "" })}>{cats.map((c) => <option key={c.key} value={c.key}>{hi ? c.hi : c.en}</option>)}</select></label>}
          <label className={lab}>{T("Name", "नाम")}{tip("As you call it at the counter, e.g. 'Back cover silicone' or 'Redmi 13 5G'.", "जैसा आप counter पर बोलते हैं, जैसे 'Back cover silicone' या 'Redmi 13 5G'।")}<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className={lab}>Brand <span className="font-normal">(optional)</span><input className={inp} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></label>
          <label className={lab}>{T("Variant / colour", "Variant / रंग")} <span className="font-normal">(optional)</span><input className={inp} value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })} placeholder={f.kind === "phone" ? "8/128 Blue" : "Black"} /></label>
          <label className={lab}>{T("Selling price ₹", "बेचने का दाम ₹")}{tip("What the customer pays for one. You can still change it on the bill.", "एक पीस का ग्राहक से लेने वाला दाम। बिल पर बदल भी सकते हैं।")}<input className={inp} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
          {can("cost") && f.kind !== "service" && <label className={lab}>{T("Cost ₹", "लागत ₹")}{tip("What one cost you. Only you (and staff you allow) see it. It is used to show profit.", "एक पीस आपको कितने में पड़ा। ये सिर्फ़ आपको (और जिसे आप हक़ दें) दिखता है। मुनाफ़ा इसी से निकलता है।")}<input className={inp} inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></label>}
          {f.kind !== "service" && f.kind !== "phone" && <label className={`${lab} sm:col-span-2`}>{T("Fits which phones?", "किस-किस फ़ोन का है?")}{tip("Type phone models with commas: Redmi 13, Redmi Note 13 Pro. Then searching 'redmi 13' on the bill finds this item.", "फ़ोन model comma लगाकर लिखें: Redmi 13, Redmi Note 13 Pro। फिर बिल पर 'redmi 13' खोजने से ये item मिल जाएगा।")}<input className={inp} value={f.fits} onChange={(e) => setF({ ...f, fits: e.target.value })} placeholder="Redmi 13, Vivo Y28" /></label>}
          {!f.id && f.kind !== "service" && f.kind !== "phone" && <label className={lab}>{T("How many do you have now?", "अभी कितने हैं?")}{tip("Opening stock. Count once and type it. Later, new stock is added from Purchase.", "शुरुआती स्टॉक। एक बार गिनकर लिखें। बाद में नया माल ख़रीद से चढ़ेगा।")}<input className={inp} inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>}
          {f.kind !== "service" && <label className={lab}>{T("Low stock at", "कम स्टॉक कब माने")}{tip("When this many or fewer are left, the item shows in the Low stock list. Leave empty for none.", "इतने या कम बचें तो item 'कम स्टॉक' सूची में दिखेगा। खाली छोड़ें तो नहीं दिखेगा।")}<input className={inp} inputMode="numeric" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} /></label>}
          {f.kind !== "service" && <label className={lab}>Barcode <span className="font-normal">(optional)</span>{tip("Click here and scan the pack's barcode. Then scanning on the bill adds this item.", "यहाँ click करके pack का barcode scan करें। फिर बिल पर scan करते ही ये item जुड़ेगा।")}<input className={inp} value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></label>}
          {f.kind !== "service" && <label className={lab}>{T("Warranty (months)", "वारंटी (महीने)")} <span className="font-normal">(optional)</span><input className={inp} inputMode="numeric" value={f.warranty} onChange={(e) => setF({ ...f, warranty: e.target.value })} /></label>}
          {f.kind !== "service" && <label className={lab}>MRP ₹ <span className="font-normal">(optional)</span><input className={inp} inputMode="decimal" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} /></label>}
          {d.setup.gstOn && <>
            <label className={lab}>GST %{tip("The tax inside the selling price. Most mobile items are 18%.", "बेचने के दाम में शामिल tax। ज़्यादातर mobile सामान पर 18%।")}<input className={inp} inputMode="decimal" value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} /></label>
            <label className={lab}>HSN <span className="font-normal">({T("empty = by category", "खाली = category से")})</span><input className={inp} inputMode="numeric" value={f.hsn} onChange={(e) => setF({ ...f, hsn: e.target.value })} /></label>
          </>}
          {f.id && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {T("Show on the bill screen (untick to stop selling it)", "बिल screen पर दिखाएँ (बेचना बंद हो तो हटाएँ)")}</label>}
        </section>
        {f.kind === "phone" && !f.id && <p className="rounded-xl bg-bg px-3 py-2 text-[12px] text-muted">{T("Save the phone model first. Then add its IMEIs from Purchase (or here, for stock you already have).", "पहले फ़ोन model save करें। फिर IMEI ख़रीद से चढ़ाएँ (या जो माल पहले से है, उसके यहीं से)।")}</p>}
        {note && <p className="text-sm font-semibold text-danger">{note}</p>}
        <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Save</button>

        {f.id && !f.serial && f.kind !== "service" && (
          <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-sm">
            <span className="font-semibold">{T("Correct the count", "गिनती ठीक करें")}{tip("Counted the shelf and the number is different? Type the real count here. For new stock use Purchase.", "shelf गिनी और संख्या अलग निकली? असली गिनती यहाँ लिखें। नए माल के लिए ख़रीद इस्तेमाल करें।")}</span>
            <input className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
            <button type="button" disabled={busy || count.trim() === ""} onClick={async () => { const r = await post({ action: "adjust", id: f.id, qty: Number(count) }); if (r) { setNote(T("✅ Count saved.", "✅ गिनती save हो गई।")); void load(); } }} className="rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-50">{T("Save count", "गिनती save")}</button>
          </section>
        )}
        {f.id && f.serial && (
          <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 text-sm">
            <p className="font-semibold">IMEI ({(units ?? []).filter((u) => u.status === "in_stock").length} {T("in stock", "स्टॉक में")})</p>
            {!units ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : <ul className="max-h-48 space-y-0.5 overflow-y-auto font-mono text-[12px]">{units.map((u) => <li key={u.id} className="flex justify-between"><span>{u.imei1}</span><span className={u.status === "in_stock" ? "text-good" : "text-muted"}>{u.status === "in_stock" ? T("in stock", "स्टॉक में") : u.status}</span></li>)}{units.length === 0 && <li className="font-sans text-muted">{T("No IMEI yet.", "अभी कोई IMEI नहीं।")}</li>}</ul>}
            <label className={lab}>{T("Add IMEIs you already have (one per line)", "जो फ़ोन पहले से हैं उनके IMEI जोड़ें (एक line में एक)")}<textarea className={`${inp} font-mono`} rows={3} value={imeis} onChange={(e) => setImeis(e.target.value)} /></label>
            <button type="button" disabled={busy || !imeis.trim()} onClick={async () => { const r = await post({ action: "units", id: f.id, imeis: imeis.split(/[\s,]+/).filter(Boolean) }); if (r) { setImeis(""); setNote(`✅ ${r.added ?? 0} ${T("added", "जुड़े")}${r.already?.length ? ` · ${r.already.length} ${T("were already there", "पहले से थे")}` : ""}`); void loadUnits(f.id); void load(); } }} className="rounded-lg border border-border px-3 py-1.5 font-semibold disabled:opacity-50">{T("Add IMEIs", "IMEI जोड़ें")}</button>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <div className="flex items-center justify-between gap-2"><h1 className="text-lg font-bold">{T("Items & stock", "Items और स्टॉक")}</h1>
        {can("stock") && <button type="button" onClick={() => { setNote(""); setF({ ...BLANK }); }} className="inline-flex items-center gap-1 rounded-xl grad-brand px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {T("Add item", "item जोड़ें")}</button>}</div>
      <MsHelp k="items" />
      {can("stock") && d.items.length > 0 && <Link href={`/poster/mobile/labels${asQ}`} className="mr-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-ink">{T("Print barcode labels →", "Barcode label print करें →")}</Link>}
      {can("stock") && d.items.length > 0 && <Link href={`/poster/mobile/stocktake${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink">{T("Count the stock →", "स्टॉक गिनें (मिलान) →")}</Link>}
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search name, brand, phone model, barcode", "नाम, brand, फ़ोन model, barcode खोजें")} /></div>
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setOnly("all")} className={`rounded-xl border px-3 py-1.5 font-semibold ${only === "all" ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{T("All", "सभी")} ({d.items.length})</button>
        <button type="button" onClick={() => setOnly("low")} className={`rounded-xl border px-3 py-1.5 font-semibold ${only === "low" ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{T("Low stock", "कम स्टॉक")}</button>
      </div>
      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{d.items.length ? T("Nothing matches.", "कुछ नहीं मिला।") : T("No items yet. Tap “Add item”.", "अभी कोई item नहीं। “item जोड़ें” दबाएँ।")}</p>}
      <div className="space-y-2">
        {shown.map((i) => (
          <button key={i.id} type="button" disabled={!can("stock")} onClick={() => edit(i)} className={`flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2.5 text-left ${i.active ? "" : "opacity-50"}`}>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{itemTitle(i)}{!i.active && ` (${T("off", "बंद")})`}</span>
              <span className="block truncate text-[11px] text-muted">{(hi ? CATEGORIES.find((c) => c.key === i.category)?.hi : CATEGORIES.find((c) => c.key === i.category)?.en) ?? ""}{i.fits?.length ? ` · ${i.fits.slice(0, 3).join(", ")}${i.fits.length > 3 ? "…" : ""}` : ""}</span></span>
            <span className="flex shrink-0 items-center gap-3 text-right"><span><span className="block text-sm font-bold tabular-nums">{inr(i.price_paise)}</span>
              {i.kind !== "service" && <span className={`text-[11px] font-semibold ${i.stock <= i.low_qty && i.low_qty > 0 || i.stock <= 0 ? "text-danger" : "text-muted"}`}>{T("Stock", "स्टॉक")} {i.stock}</span>}</span>{can("stock") && <Pencil className="h-3.5 w-3.5 text-muted" />}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
