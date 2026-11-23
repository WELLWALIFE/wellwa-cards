"use client";
// Labels for the pieces picked (?ids=…): the barbell tag (95 × 12 mm, one under the other for a tag printer) or 50 × 25 mm stickers
// (label printer, or an A4 sticker sheet). Only the labels go to paper.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Printer } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { StockLabel, type LabelSize } from "@/components/jewellery/stock-label";
import type { JwSetup } from "@/lib/jewellery";
import type { StockRow } from "@/lib/jewellery-stock";
import { PageHelp } from "@/components/jewellery/page-help";

type Ans = { items: StockRow[]; setup: JwSetup; shop: string; error?: string };
const KEY = "jw-label-size";

function Labels() {
  const router = useRouter();
  const sp = useSearchParams();
  const idsKey = sp.get("ids") ?? "";
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [size, setSize] = useState<LabelSize>("tag");
  const [copies, setCopies] = useState(1);
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s === "tag" || s === "sticker") setSize(s); } catch { /* private mode */ } }, []);
  const pick = (s: LabelSize) => { setSize(s); try { localStorage.setItem(KEY, s); } catch { /* private mode */ } };
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q);
    p.set("ids", idsKey);
    const r = await api<Ans>(`/api/jewellery/stock?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setD(r.data);
  }, [ws.q, idsKey]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } if (idsKey) void load(); })(); }, [router, load, idsKey]);
  const label = useMemo(() => Object.fromEntries((d?.setup.purities ?? []).map((p) => [p.key, p.label])), [d]);
  // Printed in the order they were picked.
  const items = useMemo(() => (d ? idsKey.split(",").filter(Boolean).map((id) => d.items.find((s) => s.id === id)).filter((s): s is StockRow => !!s) : []), [d, idsKey]);

  const asQ = ws.q ? `?${ws.q}` : "";
  if (err) return <p className="py-16 text-center font-semibold">{err}</p>;
  if (!d) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="space-y-4">
      <style>{`@media print { body * { visibility: hidden !important; } .jw-labels, .jw-labels * { visibility: visible !important; } .jw-labels { position: absolute; left: 0; top: 0; } @page { margin: ${size === "tag" ? "0" : "4mm"}; } }`}</style>
      <Link href={`/poster/jewellery/stock${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted print:hidden"><ArrowLeft className="h-4 w-4" /> {T("Stock", "स्टॉक")}</Link>
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-3 print:hidden">
        <h1 className="text-lg font-bold">{T(`Labels (${items.length})`, `लेबल (${items.length})`)}</h1>
        <PageHelp k="labels" />
        <div className="flex flex-wrap gap-2">
          {([["tag", T("Jewellery tag 95 × 12 mm", "ज्वेलरी टैग 95 × 12 mm")], ["sticker", T("Sticker 50 × 25 mm", "स्टिकर 50 × 25 mm")]] as [LabelSize, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => pick(k)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${size === k ? "border-brand bg-brand/10 text-brand-ink" : "border-border"}`}>{l}</button>
          ))}
          <label className="flex items-center gap-1.5 rounded-xl border border-border px-3 text-sm">{T("Copies", "कॉपी")}<select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="bg-transparent py-2">{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <p className="text-xs text-muted">{T("In the print box, pick your label printer and its label size, scale 100% (no “fit to page”). A4 sticker sheets: pick Sticker.", "Print box में अपना label printer और लेबल साइज़ चुनें, scale 100% (fit to page नहीं)। A4 स्टिकर शीट हो तो Sticker चुनें।")}</p>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-5 py-2.5 text-sm font-semibold text-white"><Printer className="h-4 w-4" /> {T("Print", "Print करें")}</button>
      </div>
      <div className={`jw-labels ${size === "tag" ? "flex flex-col gap-0" : "flex flex-wrap gap-[2mm]"}`} style={{ background: "#fff" }}>
        {items.flatMap((s) => Array.from({ length: copies }, (_, k) => <div key={`${s.id}-${k}`} className="border border-dashed border-gray-300 print:border-0"><StockLabel s={s} purity={label[s.purity] ?? s.purity} shop={d.shop} size={size} /></div>))}
      </div>
    </div>
  );
}

export default function LabelsPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Labels /></Suspense>;
}
