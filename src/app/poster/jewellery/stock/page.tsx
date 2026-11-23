"use client";
// Stock: what is in hand by purity (pieces, net and fine weight), the pieces by status, search by tag / HUID, and labels for the
// pieces picked.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Printer, Search } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { grams, type JwSetup } from "@/lib/jewellery";
import { STOCK_STATUSES, type StockRow, type StockStatus } from "@/lib/jewellery-stock";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { items: StockRow[]; summary: { purity: string; label: string; pieces: number; gross: number; net: number; fine: number }[]; count: number; setup: JwSetup; error?: string };

function StockList() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [status, setStatus] = useState(sp.get("status") || "sellable");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q);
    p.set("status", status);
    if (type) p.set("type", type);
    if (q.trim()) p.set("q", q.trim());
    const r = await api<Ans>(`/api/jewellery/stock?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [ws.q, status, type, q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  const label = useMemo(() => Object.fromEntries((d?.setup.purities ?? []).map((p) => [p.key, p.label])), [d]);
  const typeName = useMemo(() => Object.fromEntries((d?.setup.items ?? []).map((i) => [i.key, hi ? i.hi : i.en])), [d, hi]);

  const asQ = ws.q ? `?${ws.q}` : "";
  const amp = ws.q ? `?${ws.q}&` : "?";
  const tabs: [string, string][] = [["sellable", T("In stock", "स्टॉक में")], ["approval", T("On approval", "पसंद पर")], ["sold", T("Sold", "बिके")], ["melted", T("Melted", "गलाए")], ["returned", T("Returned", "वापस")]];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stName = (s: StockStatus) => { const x = STOCK_STATUSES.find((y) => y.key === s); return x ? (hi ? x.hi : x.en) : s; };

  return (
    <div className="space-y-3 pb-16">
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{T("Stock", "स्टॉक")}</h1>
        <Link href={`/poster/jewellery/stock/new${asQ}`} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {T("Add stock", "स्टॉक चढ़ाएँ")}</Link>
      </div>
      <PageHelp k="stock" />
      {d && d.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {d.summary.map((s) => (
            <div key={s.purity} className="rounded-2xl border border-border bg-surface p-3">
              <p className="text-[11px] text-muted">{s.label} · {s.pieces} {T("pcs", "पीस")}</p>
              <p className="text-base font-bold tabular-nums">{grams(s.net)}</p>
              <p className="text-[11px] text-muted">{T("fine", "fine")} {grams(s.fine)} · {T("gross", "कुल")} {grams(s.gross)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface2/50 p-1">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => { setStatus(k); setPicked([]); }} className={`shrink-0 flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${status === k ? "bg-surface shadow-card" : "text-muted"}`}>{l}</button>)}
      </div>
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Tag, HUID or name", "टैग, HUID या नाम")} className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-border bg-surface px-2 text-sm"><option value="">{T("All items", "सब item")}</option>{(d?.setup.items ?? []).map((i) => <option key={i.key} value={i.key}>{hi ? i.hi : i.en}</option>)}</select>
      </div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {!d ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : d.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{status === "sellable" && !q ? T("No stock yet. “Add stock” gives every piece a tag and a barcode label.", "अभी स्टॉक नहीं। “स्टॉक चढ़ाएँ” से हर पीस को टैग और बारकोड लेबल मिलेगा।") : T("Nothing here.", "यहाँ कुछ नहीं।")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {d.items.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 shrink-0" aria-label={`Pick ${s.tag}`} />
              <Link href={`/poster/jewellery/stock/${s.id}${asQ}`} className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.tag} <span className="font-normal text-muted">· {typeName[s.item_type] ?? s.item_type} {label[s.purity] ?? s.purity}</span></span>
                  <span className="block truncate text-[11px] text-muted">{[s.descr, s.huid && `HUID ${s.huid}`, s.size && `${T("size", "साइज़")} ${s.size}`, s.counter, status !== "sellable" ? "" : s.status === "approval" ? stName(s.status) : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{grams(s.net_mg)}<span className="block text-[10px] font-normal text-muted">{T("gross", "कुल")} {grams(s.gross_mg)}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {d && d.items.length > 0 && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur">
          <button type="button" onClick={() => setPicked(picked.length === d.items.length ? [] : d.items.map((s) => s.id))} className="text-xs font-semibold text-brand-ink">{picked.length === d.items.length ? T("Pick none", "कोई नहीं") : T("Pick all", "सब चुनें")}</button>
          <Link href={picked.length ? `/poster/jewellery/stock/labels${amp}ids=${picked.join(",")}` : "#"} aria-disabled={!picked.length} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ${picked.length ? "grad-brand text-white" : "pointer-events-none border border-border text-muted"}`}><Printer className="h-4 w-4" /> {T(`Print labels (${picked.length})`, `लेबल छापें (${picked.length})`)}</Link>
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><StockList /></Suspense>;
}
