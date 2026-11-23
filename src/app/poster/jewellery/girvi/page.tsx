"use client";
// Girvi: loans out (overdue first), what is out and the interest run up today, and a new loan.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Search } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { grams, inr } from "@/lib/jewellery";
import type { GirviRow, GirviState } from "@/lib/jewellery-finance";
import { PageHelp } from "@/components/jewellery/page-help";

type Row = GirviRow & { state: GirviState };
type Ans = { loans: Row[]; today: string; totals: { count: number; principal: number; interest: number; overdue: number }; error?: string };

export default function Girvi() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [view, setView] = useState("open");
  const [q, setQ] = useState("");
  const [d, setD] = useState<Ans | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q); p.set("view", view); if (q.trim()) p.set("q", q.trim());
    const r = await api<Ans>(`/api/jewellery/girvi?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
    setErr(""); setD(r.data);
  }, [ws.q, view, q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  const asQ = ws.q ? `?${ws.q}` : "";
  const rows = d ? [...d.loans].sort((a, b) => Number(b.state.overdue) - Number(a.state.overdue)) : [];
  return (
    <div className="space-y-3">
      <Link href={`/poster/jewellery${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Jewellery", "ज्वेलरी")}</Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">{T("Girvi", "गिरवी")}</h1>
        <Link href={`/poster/jewellery/girvi/new${asQ}`} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {T("New loan", "नया लोन")}</Link>
      </div>
      <PageHelp k="girvi" />
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {d && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{T("Out", "बाहर")} · {d.totals.count}</p><p className="text-base font-bold tabular-nums">{inr(d.totals.principal)}</p></div>
          <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{T("Interest till today", "आज तक ब्याज")}</p><p className="text-base font-bold tabular-nums">{inr(d.totals.interest)}</p></div>
          <div className="rounded-2xl border border-border bg-surface p-3"><p className="text-[11px] text-muted">{T("Overdue", "तारीख़ निकली")}</p><p className={`text-base font-bold ${d.totals.overdue ? "text-danger" : ""}`}>{d.totals.overdue}</p></div>
        </div>
      )}
      <div className="flex gap-1 rounded-xl border border-border bg-surface2/50 p-1">
        {([["open", T("Open", "चालू")], ["closed", T("Released", "छुड़ाए")], ["auctioned", T("Auctioned", "नीलाम")]] as [string, string][]).map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${view === k ? "bg-surface shadow-card" : "text-muted"}`}>{l}</button>)}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile or number", "नाम, मोबाइल या नंबर")} className="w-full bg-transparent py-2.5 text-sm outline-none" /></label>
      {!d ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{T("Nothing here.", "यहाँ कुछ नहीं।")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((g) => (
            <li key={g.id}><Link href={`/poster/jewellery/girvi/${g.id}${asQ}`} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0"><span className="block text-sm font-bold">{g.customer_name} <span className="font-normal text-muted">· {g.code}</span></span>
                <span className="block text-[11px] text-muted">{grams(g.items.reduce((a, i) => a + i.fineMg, 0))} fine · {T("due", "तारीख़")} {g.due_day}{g.state.overdue ? <b className="text-danger"> · {T("overdue", "निकल गई")}</b> : ""}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{inr(g.status === "open" ? g.state.due : g.loan_paise)}</span><span className="text-[11px] text-muted">{g.status === "open" ? T("to release", "छुड़ाने के लिए") : T("loan", "लोन")}</span></span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
