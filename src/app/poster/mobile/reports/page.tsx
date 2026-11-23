"use client";
// Mobile shop reports: pick a period — sale and returns, GST by HSN, profit, money in by mode, best sellers, repair work — with
// the day close for WhatsApp and CSV files for Excel / the CA.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, LoaderCircle, MessageCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import { toCsv } from "@/lib/jewellery-reports";
import { itemTitle, type ItemRow } from "@/lib/mobile";
import { msCloseText, msDaysCsv, msHsnCsv, msItemsCsv, msSalesCsv, type MsReport } from "@/lib/mobile-reports";
import { MsHelp } from "@/components/mobile/page-help";

type Ans = { report: MsReport; shop: string; today: string; gstOn: boolean; cost: boolean; dueTotal: number; error?: string };
type Pick = "today" | "yesterday" | "month" | "last" | "fy" | "custom";
const shift = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
function rangeOf(p: Pick, today: string, c: { from: string; to: string }) {
  const [y, m] = today.split("-").map(Number);
  if (p === "yesterday") return { from: shift(today, -1), to: shift(today, -1) };
  if (p === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (p === "last") { const ly = m === 1 ? y - 1 : y, lm = m === 1 ? 12 : m - 1; const from = `${ly}-${String(lm).padStart(2, "0")}-01`; return { from, to: shift(`${today.slice(0, 8)}01`, -1) }; }
  if (p === "fy") return { from: `${m >= 4 ? y : y - 1}-04-01`, to: today };
  if (p === "custom" && c.from) return { from: c.from, to: c.to || c.from };
  return { from: today, to: today };
}
function save(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function MobileReports() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [pick, setPick] = useState<Pick>("today");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: Pick, c: { from: string; to: string }) => {
    setBusy(true);
    try {
      const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
      const r0 = rangeOf(p, today, c);
      const r = await api<Ans>(`/api/mobile/reports?from=${r0.from}&to=${r0.to}${ws.q ? `&${ws.q}` : ""}`, { fresh: true });
      if (!r.ok) setErr(r.data?.error || "Could not load."); else { setErr(""); setD(r.data); }
    } catch { setErr("No internet."); }
    setBusy(false);
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } })(); }, [router]);
  useEffect(() => { if (pick !== "custom" || custom.from) { const t = setTimeout(() => void load(pick, custom), 0); return () => clearTimeout(t); } }, [pick, custom, load]);

  async function stockCsv() {
    const r = await api<{ items?: (ItemRow & { stock: number })[] }>(`/api/mobile/items?all=1${ws.q ? `&${ws.q}` : ""}`, { fresh: true }).catch(() => null);
    if (!r?.ok) return;
    const rows = (r.data.items ?? []).filter((i) => i.kind !== "service");
    save("stock.csv", toCsv([["Item", "Category", "Barcode", "Stock", "Selling price", ...(d?.cost ? ["Cost", "Stock value at cost"] : [])],
      ...rows.map((i) => [itemTitle(i), i.category, i.barcode, i.stock, (i.price_paise / 100).toFixed(2), ...(d?.cost ? [(i.cost_paise / 100).toFixed(2), ((i.cost_paise * Math.max(0, i.stock)) / 100).toFixed(2)] : [])])]));
  }

  const chip = (p: Pick, label: string) => <button type="button" onClick={() => setPick(p)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pick === p ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{label}</button>;
  const r = d?.report;
  const tag = r ? (r.range.from === r.range.to ? r.range.from : `${r.range.from}_${r.range.to}`) : "";
  const tile = "rounded-2xl border border-border bg-surface p-3";
  const card = "space-y-2 rounded-2xl border border-border bg-surface p-3";
  const inp = "rounded-lg border border-border bg-surface px-2 py-2 text-sm";
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{T("Reports", "रिपोर्ट")}</h1>
      <MsHelp k="reports" />
      <div className="flex flex-wrap gap-2">{chip("today", T("Today", "आज"))}{chip("yesterday", T("Yesterday", "कल"))}{chip("month", T("This month", "ये महीना"))}{chip("last", T("Last month", "पिछला महीना"))}{chip("fy", T("This fin. year", "ये वित्त वर्ष"))}{chip("custom", T("Dates", "तारीख़ें"))}</div>
      {pick === "custom" && <div className="flex flex-wrap items-center gap-2 text-sm"><input type="date" className={inp} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /> → <input type="date" className={inp} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>}
      {err && <p className="py-8 text-center font-semibold">{err}</p>}
      {!err && (!r || busy) && <div className="grid place-items-center py-10"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
      {!err && r && d && !busy && <>
        <p className="text-[12px] text-muted">{r.range.from === r.range.to ? r.range.from : `${r.range.from} → ${r.range.to}`}</p>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={tile}><p className="text-[11px] text-muted">{T("Sale (after returns)", "बिक्री (वापसी घटाकर)")}</p><p className="text-lg font-bold tabular-nums">{inr(r.net)}</p><p className="text-[11px] text-muted">{r.bills} {T("bills", "बिल")} · {r.qty} {T("pcs", "पीस")}{r.returns ? ` · ${T("returns", "वापसी")} ${inr(r.returns)}` : ""}</p></div>
          <div className={tile}><p className="text-[11px] text-muted">{T("Money in", "आए पैसे")}</p><p className="text-lg font-bold tabular-nums text-good">{inr(r.moneyTotal)}</p><p className="text-[11px] text-muted">Cash {inr(r.money.cash)} · UPI {inr(r.money.upi)}{r.money.card ? ` · Card ${inr(r.money.card)}` : ""}{r.money.other ? ` · EMI/Other ${inr(r.money.other)}` : ""}{r.money.bank ? ` · Bank ${inr(r.money.bank)}` : ""}</p></div>
          {d.cost && <div className={tile}><p className="text-[11px] text-muted">{T("Profit", "मुनाफ़ा")}</p><p className="text-lg font-bold tabular-nums">{inr(r.profit)}</p><p className="text-[11px] text-muted">{T("sale without tax − cost", "बिना tax की बिक्री − लागत")}</p></div>}
          <div className={tile}><p className="text-[11px] text-muted">{T("Udhaar given", "उधार दिया")}</p><p className="text-lg font-bold tabular-nums text-danger">{inr(r.udhaarGiven)}</p><p className="text-[11px] text-muted">{T("total udhaar now", "अभी कुल उधार")} {inr(d.dueTotal)}</p></div>
        </section>
        {(r.repair.received > 0 || r.repair.delivered > 0) && <section className={card}><h2 className="text-sm font-bold">🔧 {T("Repair", "रिपेयर")}</h2><p className="text-sm">{r.repair.received} {T("phones came in", "फ़ोन आए")} · {r.repair.delivered} {T("given back", "दिए")} · {T("repair charge earned", "repair charge कमाया")} <b>{inr(r.repair.income)}</b></p></section>}
        {d.gstOn && <section className={card}>
          <h2 className="text-sm font-bold">GST</h2>
          <p className="text-sm">{T("Taxable", "Taxable")} <b>{inr(r.taxable, true)}</b> · CGST <b>{inr(r.cgst, true)}</b> · SGST <b>{inr(r.sgst, true)}</b>{r.igst ? <> · IGST <b>{inr(r.igst, true)}</b></> : null}</p>
          {r.hsn.length > 0 && <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="text-left text-muted"><th className="py-1">HSN</th><th>%</th><th className="text-right">Qty</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead>
            <tbody>{r.hsn.map((h) => <tr key={`${h.hsn}${h.gstBp}`} className="border-t border-border"><td className="py-1">{h.hsn || "—"}</td><td>{h.gstBp / 100}</td><td className="text-right">{h.qty}</td><td className="text-right tabular-nums">{inr(h.taxable, true)}</td><td className="text-right tabular-nums">{inr(h.cgst + h.sgst + h.igst, true)}</td></tr>)}</tbody></table></div>}
        </section>}
        <section className={card}>
          <h2 className="text-sm font-bold">{T("What sold most", "सबसे ज़्यादा क्या बिका")}</h2>
          {r.items.length === 0 && <p className="text-sm text-muted">{T("No sale in this period.", "इस अवधि में कोई बिक्री नहीं।")}</p>}
          {r.items.slice(0, 15).map((i) => <p key={i.name} className="flex justify-between gap-2 text-sm"><span className="min-w-0 truncate">{i.name} <span className="text-muted">×{i.qty}</span></span><span className="shrink-0 tabular-nums"><b>{inr(i.amount)}</b>{d.cost ? <span className="text-[11px] text-muted"> · {T("profit", "मुनाफ़ा")} {inr(i.profit)}</span> : null}</span></p>)}
        </section>
        <section className={card}>
          <h2 className="text-sm font-bold">{T("Share and download", "भेजें और डाउनलोड")}</h2>
          <a href={`https://wa.me/?text=${encodeURIComponent(msCloseText(r, d.shop, d.dueTotal, d.cost))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#25D366] px-3 py-2 text-sm font-semibold text-[#128C7E]"><MessageCircle className="h-4 w-4" /> {T("Send this summary on WhatsApp", "ये सार WhatsApp पर भेजें")}</a>
          <div className="flex flex-wrap gap-2">
            {([["sales", T("Sales register", "बिक्री रजिस्टर"), () => msSalesCsv(r)], ...(d.gstOn ? [["hsn", T("HSN summary", "HSN सार"), () => msHsnCsv(r)] as [string, string, () => string]] : []), ["items", T("Item-wise sale", "item-वार बिक्री"), () => msItemsCsv(r, d.cost)], ["days", T("Day by day", "रोज़ का"), () => msDaysCsv(r)]] as [string, string, () => string][]).map(([k, l, f]) => (
              <button key={k} type="button" onClick={() => save(`${k}_${tag}.csv`, f())} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> {l}</button>))}
            <button type="button" onClick={() => void stockCsv()} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> {T("Stock list (today)", "स्टॉक list (आज की)")}</button>
          </div>
          <p className="text-[11px] text-muted">{T("CSV files open in Excel and Google Sheets — give them to your CA. A direct Tally file and GST e-invoice are not made here.", "CSV फ़ाइलें Excel और Google Sheets में खुलती हैं — अपने CA को दें। सीधी Tally फ़ाइल और GST e-invoice यहाँ नहीं बनते।")}</p>
        </section>
      </>}
    </div>
  );
}
