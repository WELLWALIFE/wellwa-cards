"use client";
// Barcode labels for the shelf: pick items and how many stickers of each; an item with no barcode gets one of ours. 50×25 mm
// stickers (label printer) or the same on an A4 sticker sheet. Only the labels go to paper.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Printer, Search, Trash2 } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import { itemMatches, itemTitle, type ItemRow, type MsSetup } from "@/lib/mobile";
import { Barcode } from "@/components/jewellery/barcode";
import { MsHelp } from "@/components/mobile/page-help";

type Item = ItemRow & { stock: number };
type Row = { id: string; n: string };

export default function LabelsPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [items, setItems] = useState<Item[] | null>(null);
  const [setup, setSetup] = useState<MsSetup | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ items?: Item[]; setup?: MsSetup; error?: string }>(`/api/mobile/items${asQ}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setItems(r.data.items ?? []); setSetup(r.data.setup ?? null);
    } catch { setErr("No internet."); }
  }, [asQ]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } void load(); })(); }, [router, load]);

  const found = useMemo(() => (items && q.trim() ? items.filter((i) => !i.serial && i.kind !== "service" && itemMatches(i, q)).slice(0, 15) : []), [items, q]);
  const picked = rows.map((r) => ({ r, it: items?.find((i) => i.id === r.id) })).filter((x): x is { r: Row; it: Item } => !!x.it);
  const missing = picked.filter((x) => !x.it.barcode);
  const labels = picked.flatMap((x) => (x.it.barcode ? Array.from({ length: Math.max(0, Math.min(200, Math.round(Number(x.r.n)) || 0)) }, () => x.it) : []));

  async function giveCodes() {
    setBusy(true); setNote("");
    try {
      const r = await api<{ barcodes?: Record<string, string>; error?: string }>("/api/mobile/items", { method: "POST", json: { as: ws.as || undefined, action: "barcode", ids: missing.map((x) => x.it.id) } });
      if (!r.ok) setNote(r.data?.error || T("Could not save.", "Save नहीं हुआ।")); else await load();
    } catch { setNote(T("No internet.", "इंटरनेट नहीं है।")); }
    setBusy(false);
  }

  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!items) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const small = "rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";
  return (
    <div className="space-y-3">
      <style>{`@media print { body * { visibility: hidden !important; } .ms-labels, .ms-labels * { visibility: visible !important; } .ms-labels { position: absolute; left: 0; top: 0; } @page { margin: 4mm; } }`}</style>
      <div className="space-y-3 print:hidden">
        <Link href={`/poster/mobile/items${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Items & stock", "Items और स्टॉक")}</Link>
        <h1 className="text-lg font-bold">{T("Barcode labels", "Barcode label")}</h1>
        <MsHelp k="labels" />
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search the item to label", "जिस item का label चाहिए वो खोजें")} /></div>
        {q.trim() && <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5">
          {found.map((i) => <button key={i.id} type="button" onClick={() => { setRows((x) => (x.some((y) => y.id === i.id) ? x : [...x, { id: i.id, n: String(Math.max(1, Math.min(50, i.stock))) }])); setQ(""); }} className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-bg"><span className="truncate font-semibold">{itemTitle(i)}</span><span className="shrink-0 text-[11px] text-muted">{T("Stock", "स्टॉक")} {i.stock}</span></button>)}
          {!found.length && <p className="px-2 py-2 text-sm text-muted">{T("Nothing found. (Phones are labelled by their own IMEI.)", "कुछ नहीं मिला। (फ़ोन का label उसका अपना IMEI है।)")}</p>}
        </div>}
        {picked.map(({ r, it }) => (
          <div key={it.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm">
            <span className="min-w-0"><span className="block truncate font-semibold">{itemTitle(it)}</span><span className="block text-[11px] text-muted">{it.barcode || T("no barcode yet", "अभी barcode नहीं")} · {inr(it.price_paise)}</span></span>
            <span className="flex shrink-0 items-center gap-2"><input className={`${small} w-16 text-center`} inputMode="numeric" value={r.n} onChange={(e) => setRows((x) => x.map((y) => (y.id === it.id ? { ...y, n: e.target.value } : y)))} /><button type="button" aria-label="Remove" onClick={() => setRows((x) => x.filter((y) => y.id !== it.id))} className="p-1 text-muted"><Trash2 className="h-4 w-4" /></button></span>
          </div>
        ))}
        {missing.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{T(`${missing.length} item(s) have no barcode.`, `${missing.length} item का barcode नहीं है।`)} <button type="button" disabled={busy} onClick={() => void giveCodes()} className="ml-1 rounded-lg border border-amber-400 bg-white px-2 py-1 text-xs font-semibold">{busy ? "…" : T("Give them a barcode", "इन्हें barcode दें")}</button></div>}
        {note && <p className="text-sm font-semibold text-danger">{note}</p>}
        {labels.length > 0 && <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-bold text-white"><Printer className="h-4 w-4" /> {T(`Print ${labels.length} labels`, `${labels.length} label print करें`)}</button>}
      </div>
      <div className="ms-labels flex flex-wrap gap-[2mm]" style={{ background: "#fff" }}>
        {labels.map((it, i) => (
          <div key={i} className="flex flex-col items-center justify-between overflow-hidden border border-dashed border-neutral-300 bg-white text-black print:border-0" style={{ width: "50mm", height: "25mm", padding: "1.2mm", fontFamily: "Arial, sans-serif", breakInside: "avoid" }}>
            <p className="w-full truncate text-center font-bold" style={{ fontSize: "7.5pt", lineHeight: 1.1 }}>{itemTitle(it)}</p>
            <Barcode value={it.barcode} height={30} className="h-[9mm] w-[44mm]" />
            <p className="flex w-full items-baseline justify-between" style={{ fontSize: "7pt", lineHeight: 1 }}><span className="font-mono">{it.barcode}</span><span className="font-bold" style={{ fontSize: "10pt" }}>{inr(it.price_paise)}</span></p>
            {setup?.shopName ? <p className="w-full truncate text-center" style={{ fontSize: "5.5pt", lineHeight: 1 }}>{setup.shopName}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
