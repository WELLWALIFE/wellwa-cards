"use client";
// All bills: search by name, mobile or number; Bills / Estimates / Money due; a date range; the total of what is shown.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Search } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { BillRowLink } from "@/components/jewellery/bill-row";
import { inr, type BillRow } from "@/lib/jewellery";
import { PageHelp } from "@/components/jewellery/page-help";

function BillsList() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [tab, setTab] = useState<string>(sp.get("view") === "due" ? "due" : "sale");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q);
    if (tab === "due") p.set("view", "due"); else p.set("kind", tab);
    if (q.trim()) p.set("q", q.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await api<{ bills: BillRow[]; error?: string }>(`/api/jewellery/bills?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setBills(r.data.bills);
  }, [ws.q, tab, q, from, to]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const asQ = ws.q ? `?${ws.q}` : "";
  const live = (bills ?? []).filter((b) => b.status !== "cancelled");
  const sum = tab === "due" ? live.reduce((a, b) => a + b.balance_paise, 0) : live.reduce((a, b) => a + b.total_paise, 0);
  const tabs = [["sale", T("Bills", "बिल")], ["estimate", T("Estimates", "Estimate")], ["due", T("Money due", "बाकी पैसे")]];
  return (
    <div className="space-y-3">
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <PageHelp k="bills" />
      <div className="flex gap-1 rounded-xl border border-border bg-surface2/50 p-1">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-surface shadow-card" : "text-muted"}`}>{l}</button>)}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile or bill number", "नाम, मोबाइल या बिल नंबर")} className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted">{T("From", "से")}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5" /><span className="text-muted">{T("to", "तक")}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5" /></div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {!bills ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : (
        <>
          <p className="text-sm"><b>{live.length}</b> {tab === "due" ? (live.length === 1 ? T("customer owes", "ग्राहक पर बाकी") : T("customers owe", "ग्राहकों पर बाकी")) : T("shown, total", "दिख रहे, कुल")} <b className="tabular-nums">{inr(sum)}</b></p>
          {bills.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("Nothing here.", "यहाँ कुछ नहीं।")}</p>}
          <div className="space-y-2">{bills.map((b) => <BillRowLink key={b.id} b={b} hi={hi} q={asQ} />)}</div>
        </>
      )}
    </div>
  );
}

export default function BillsPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><BillsList /></Suspense>;
}
