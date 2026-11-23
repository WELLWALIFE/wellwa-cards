"use client";
// Stock take ("milaan"): count what is really on the shelf and set the stock to it. Scan a barcode (one scan = one piece) or
// type a count; scan phones by IMEI. The count is kept on this phone until it is finished, so the work can stop and go on.
// Only items that were counted are changed; phones are only reported (found / not found), never changed here.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, LoaderCircle, ScanLine, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { toCsv } from "@/lib/jewellery-reports";
import { cleanCode, itemMatches, itemTitle, type ItemRow } from "@/lib/mobile";
import { MsHelp } from "@/components/mobile/page-help";

type Item = ItemRow & { stock: number };
type Unit = { imei1: string; item_id: string };
type Kept = { counts: Record<string, number>; imeis: string[]; unknown: string[]; at: number };
const KEY = (ws: string | null) => `ms.stocktake.${ws || "me"}`;
const EMPTY: Kept = { counts: {}, imeis: [], unknown: [], at: 0 };

export default function StockTake() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [items, setItems] = useState<Item[] | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [k, setK] = useState<Kept>(EMPTY);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [last, setLast] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const amp = ws.q ? `&${ws.q}` : "";
      const [a, b] = await Promise.all([api<{ items?: Item[]; error?: string }>(`/api/mobile/items?all=1${amp}`, { fresh: true }), api<{ units?: Unit[] }>(`/api/mobile/items?instock=1${amp}`, { fresh: true })]);
      if (!a.ok) { setErr(a.data?.error || "Could not load."); return; }
      setItems((a.data.items ?? []).filter((i) => i.kind !== "service")); setUnits(b.ok ? b.data.units ?? [] : []);
      try { const v = localStorage.getItem(KEY(ws.as)); if (v) setK({ ...EMPTY, ...(JSON.parse(v) as Kept) }); } catch { /* a fresh count */ }
    } catch { setErr("No internet. Open this page with the network; after that the counting itself is kept on the phone."); }
  }, [ws.q, ws.as]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);
  const keep = (v: Kept) => { setK(v); try { localStorage.setItem(KEY(ws.as), JSON.stringify(v)); } catch { /* stays in memory */ } };

  const found = useMemo(() => (items && q.trim() ? items.filter((i) => !i.serial && itemMatches(i, q)).slice(0, 12) : []), [items, q]);
  function bump(i: Item, by = 1) { keep({ ...k, counts: { ...k.counts, [i.id]: Math.max(0, (k.counts[i.id] ?? 0) + by) } }); setLast({ ok: true, t: `${itemTitle(i)} → ${(k.counts[i.id] ?? 0) + by}` }); setQ(""); box.current?.focus(); }
  function onEnter() {
    if (!items) return;
    const code = cleanCode(q);
    if (!code) return;
    const it = items.find((i) => !i.serial && i.barcode && i.barcode === code);
    if (it) { bump(it); return; }
    const u = units.find((x) => x.imei1 === code);
    if (u) { if (!k.imeis.includes(code)) keep({ ...k, imeis: [...k.imeis, code] }); const ph = items.find((i) => i.id === u.item_id); setLast({ ok: true, t: `IMEI ${code} ✓ ${ph ? itemTitle(ph) : ""}` }); setQ(""); return; }
    if (found.length === 1) { bump(found[0]); return; }
    if (/^[A-Z0-9-]{8,20}$/.test(code)) { if (!k.unknown.includes(code)) keep({ ...k, unknown: [...k.unknown, code] }); setLast({ ok: false, t: T(`${code} is not in your stock records.`, `${code} आपके स्टॉक रिकॉर्ड में नहीं है।`) }); setQ(""); }
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!items) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const counted = items.filter((i) => !i.serial && k.counts[i.id] !== undefined);
  const diff = counted.filter((i) => k.counts[i.id] !== i.stock);
  const missing = units.filter((u) => !k.imeis.includes(u.imei1));
  const nameOf = (id: string) => { const i = items.find((x) => x.id === id); return i ? itemTitle(i) : ""; };
  const started = counted.length > 0 || k.imeis.length > 0 || k.unknown.length > 0;
  function download() {
    const csv = toCsv([["Item / IMEI", "In records", "Counted", "Difference"], ...counted.map((i) => [itemTitle(i), i.stock, k.counts[i.id], k.counts[i.id] - i.stock]),
      ...(k.imeis.length ? missing.map((u) => [`${nameOf(u.item_id)} IMEI ${u.imei1}`, 1, 0, -1]) : []), ...k.unknown.map((c) => [`Unknown code ${c}`, 0, 1, 1])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `stock_count_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function apply() {
    setBusy(true); setLast(null);
    try {
      const r = await api<{ changed?: number; error?: string }>("/api/mobile/items", { method: "POST", json: { as: ws.as || undefined, action: "stocktake", counts: diff.map((i) => ({ id: i.id, qty: k.counts[i.id] })) } });
      setBusy(false); setSure(false);
      if (!r.ok) { setLast({ ok: false, t: r.data?.error || T("Could not save.", "Save नहीं हुआ।") }); return; }
      keep({ ...EMPTY }); try { localStorage.removeItem(KEY(ws.as)); } catch { /* fine */ }
      setLast({ ok: true, t: T(`✅ Stock set for ${r.data.changed ?? 0} items. The count is finished.`, `✅ ${r.data.changed ?? 0} items का स्टॉक ठीक कर दिया। मिलान पूरा।`) }); void load();
    } catch { setBusy(false); setLast({ ok: false, t: T("No internet. Your count is safe on this phone — try again later.", "इंटरनेट नहीं है। आपकी गिनती इस फ़ोन में सुरक्षित है — बाद में फिर करें।") }); }
  }
  const small = "rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";
  const card = "space-y-2 rounded-2xl border border-border bg-surface p-3";
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile/items${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Items & stock", "Items और स्टॉक")}</Link>
      <h1 className="text-lg font-bold">{T("Count the stock", "स्टॉक मिलान")}</h1>
      <MsHelp k="stocktake" />
      <div className="relative">
        <ScanLine className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
        <input ref={box} autoFocus className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} placeholder={T("Scan barcode / IMEI, or type the item's name", "barcode / IMEI scan करें, या item का नाम लिखें")} />
      </div>
      {q.trim() && found.length > 0 && <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5">{found.map((i) => <button key={i.id} type="button" onClick={() => bump(i)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-bg"><span className="truncate font-semibold">{itemTitle(i)}</span><span className="shrink-0 text-[11px] text-muted">+1</span></button>)}</div>}
      {last && <p className={`text-sm font-semibold ${last.ok ? "text-good" : "text-danger"}`}>{last.t}</p>}
      {!started && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("Start scanning. Nothing changes in your stock until you press the button at the end.", "scan करना शुरू करें। आख़िर में बटन दबाने तक आपके स्टॉक में कुछ नहीं बदलता।")}</p>}

      {counted.length > 0 && <section className={card}>
        <h2 className="text-sm font-bold">{T("Counted", "गिने गए")} ({counted.length}) · <span className={diff.length ? "text-danger" : "text-good"}>{diff.length} {T("different", "में फ़र्क़")}</span></h2>
        {counted.map((i) => { const c = k.counts[i.id], dlt = c - i.stock; return (
          <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0"><span className="block truncate font-semibold">{itemTitle(i)}</span><span className="block text-[11px] text-muted">{T("In records", "रिकॉर्ड में")} {i.stock}{dlt !== 0 && <b className={dlt < 0 ? " text-danger" : " text-amber-700"}> · {dlt > 0 ? "+" : ""}{dlt}</b>}</span></span>
            <span className="flex shrink-0 items-center gap-1.5"><input className={`${small} w-16 text-center`} inputMode="numeric" value={c} onChange={(e) => keep({ ...k, counts: { ...k.counts, [i.id]: Math.max(0, Math.min(1e6, Math.round(Number(e.target.value)) || 0)) } })} />
              <button type="button" aria-label="Remove" onClick={() => { const next = { ...k.counts }; delete next[i.id]; keep({ ...k, counts: next }); }} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button></span>
          </div>); })}
      </section>}

      {units.length > 0 && (k.imeis.length > 0 || k.unknown.length > 0) && <section className={card}>
        <h2 className="text-sm font-bold">{T("Phones (IMEI)", "फ़ोन (IMEI)")}: {k.imeis.length}/{units.length} {T("found", "मिले")}</h2>
        {missing.length > 0 && <><p className="text-[12px] font-semibold text-danger">{T("Not scanned yet", "अभी scan नहीं हुए")} ({missing.length}):</p>
          <ul className="max-h-40 overflow-y-auto font-mono text-[12px]">{missing.slice(0, 200).map((u) => <li key={u.imei1}>{u.imei1} <span className="font-sans text-muted">{nameOf(u.item_id)}</span></li>)}</ul>
          <p className="text-[11px] text-muted">{T("Phones are not changed here. If one is really lost, look into it and then correct it in Items.", "फ़ोन यहाँ से नहीं बदलते। कोई सच में गुम है तो जाँचकर Items में ठीक करें।")}</p></>}
      </section>}
      {k.unknown.length > 0 && <section className={card}><h2 className="text-sm font-bold text-amber-700">{T("Scanned but not in your records", "scan हुए पर रिकॉर्ड में नहीं")} ({k.unknown.length})</h2><p className="break-all font-mono text-[12px]">{k.unknown.join(", ")}</p><p className="text-[11px] text-muted">{T("Add these in Items / Purchase if they are yours.", "अगर ये आपके हैं तो Items / ख़रीद में चढ़ाएँ।")}</p></section>}

      {started && <section className="space-y-2 rounded-2xl border-2 border-brand/40 bg-surface p-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> {T("Download the count (Excel)", "गिनती डाउनलोड (Excel)")}</button>
          <button type="button" onClick={() => { keep({ ...EMPTY }); setLast(null); setSure(false); }} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-danger">{T("Throw this count away", "ये गिनती हटाएँ")}</button>
        </div>
        {diff.length > 0 && (!sure
          ? <button type="button" onClick={() => setSure(true)} className="w-full rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white">{T(`Set stock to my count (${diff.length} items change)`, `स्टॉक मेरी गिनती जितना करें (${diff.length} items बदलेंगे)`)}</button>
          : <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3"><p className="text-sm font-semibold">{T(`${diff.length} items will get the counted number as their stock. This cannot be undone by itself. Download the count first if you want a record.`, `${diff.length} items का स्टॉक गिनी हुई संख्या हो जाएगा। ये अपने-आप वापस नहीं होता। रिकॉर्ड चाहिए तो पहले गिनती डाउनलोड करें।`)}</p>
              <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void apply()} className="inline-flex items-center gap-2 rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Yes, set the stock", "हाँ, स्टॉक ठीक करें")}</button><button type="button" onClick={() => setSure(false)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">{T("Not now", "अभी नहीं")}</button></div></div>)}
        {diff.length === 0 && counted.length > 0 && <p className="text-sm font-semibold text-good">{T("Everything counted matches the records.", "जो गिना वो रिकॉर्ड से मिलता है।")}</p>}
      </section>}
    </div>
  );
}
