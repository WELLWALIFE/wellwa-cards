"use client";
// All bills: bills, estimates, or only the udhaar ones; search by name, mobile or bill number.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Search } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import type { BillRow } from "@/lib/mobile";
import { BillLink } from "@/components/mobile/bill-link";

type View = "sale" | "estimates" | "due";

function Bills() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const [view, setView] = useState<View>(sp.get("view") === "due" ? "due" : sp.get("view") === "estimates" ? "estimates" : "sale");
  const [q, setQ] = useState("");
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async (v: View, text: string) => {
    try {
      const r = await api<{ bills?: BillRow[]; error?: string }>(`/api/mobile/bills?view=${v}&limit=100${text.trim() ? `&q=${encodeURIComponent(text.trim())}` : ""}${ws.q ? `&${ws.q}` : ""}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setBills(r.data.bills ?? []);
    } catch { setErr("No internet."); }
  }, [ws.q]);
  useEffect(() => { (async () => { if (navigator.onLine && !(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); return; } })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(view, q), q ? 350 : 0); return () => clearTimeout(t); }, [view, q, load]);

  const tab = (v: View, label: string) => <button type="button" onClick={() => { setBills(null); setView(v); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${view === v ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{label}</button>;
  const due = (bills ?? []).reduce((a, b) => a + Math.max(0, b.balance_paise), 0);
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <h1 className="text-lg font-bold">{T("Bills", "बिल")}</h1>
      <div className="flex flex-wrap gap-2">{tab("sale", T("Bills", "बिल"))}{tab("due", T("Udhaar", "उधार"))}{tab("estimates", "Estimates")}</div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile or bill number", "नाम, मोबाइल या बिल नंबर")} /></div>
      {view === "due" && bills && bills.length > 0 && <p className="text-sm font-semibold">{T("Total udhaar", "कुल उधार")}: <span className="text-danger">{inr(due)}</span> · {bills.length} {T("bills", "बिल")}</p>}
      {err && <p className="py-8 text-center font-semibold">{err}</p>}
      {!err && !bills && <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
      {!err && bills && bills.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("Nothing here.", "यहाँ कुछ नहीं है।")}</p>}
      <div className="space-y-2">{(bills ?? []).map((b) => <BillLink key={b.id} b={b} hi={hi} q={asQ} />)}</div>
    </div>
  );
}

export default function BillsPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Bills /></Suspense>;
}
