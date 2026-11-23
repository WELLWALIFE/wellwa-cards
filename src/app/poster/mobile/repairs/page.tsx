"use client";
// Repair jobs: what is in the shop, what is ready and not collected, what is late — and search by name, mobile, job number,
// phone model or IMEI.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Plus, Search } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { useWorkspace } from "@/components/orders/orders-common";
import { inr } from "@/lib/jewellery";
import { MsHelp } from "@/components/mobile/page-help";
import { jobLate, jobStatus, jobTotals, problemText, type JobRow } from "@/lib/mobile-repair";

type View = "open" | "ready" | "late" | "done";

function Jobs() {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const asQ = ws.q ? `?${ws.q}` : "";
  const v0 = sp.get("view");
  const [view, setView] = useState<View>(v0 === "ready" || v0 === "late" || v0 === "done" ? v0 : "open");
  const [q, setQ] = useState("");
  const [d, setD] = useState<{ jobs: JobRow[]; today: string } | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async (v: View, text: string) => {
    try {
      const r = await api<{ jobs?: JobRow[]; today?: string; error?: string }>(`/api/mobile/jobs?view=${text.trim() ? "all" : v}${text.trim() ? `&q=${encodeURIComponent(text.trim())}` : ""}${ws.q ? `&${ws.q}` : ""}`, { fresh: true });
      if (!r.ok) { setErr(r.data?.error || "Could not load."); return; }
      setErr(""); setD({ jobs: r.data.jobs ?? [], today: r.data.today ?? "" });
    } catch { setErr("No internet."); }
  }, [ws.q]);
  useEffect(() => { (async () => { if (!(await isLoggedIn())) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`); })(); }, [router]);
  useEffect(() => { const t = setTimeout(() => void load(view, q), q ? 350 : 0); return () => clearTimeout(t); }, [view, q, load]);

  const tab = (v: View, label: string) => <button type="button" onClick={() => { setD(null); setView(v); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${view === v && !q.trim() ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}>{label}</button>;
  return (
    <div className="space-y-3">
      <Link href={`/poster/mobile${asQ}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" /> {T("Mobile shop", "मोबाइल दुकान")}</Link>
      <div className="flex items-center justify-between gap-2"><h1 className="text-lg font-bold">🔧 {T("Repair jobs", "रिपेयर jobs")}</h1>
        <Link href={`/poster/mobile/repair${asQ}`} className="inline-flex items-center gap-1 rounded-xl grad-brand px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {T("New job", "नया job")}</Link></div>
      <MsHelp k="repairs" />
      <div className="flex flex-wrap gap-2">{tab("open", T("In the shop", "दुकान में"))}{tab("ready", T("Ready", "तैयार"))}{tab("late", T("Late", "देर"))}{tab("done", T("Closed", "बंद"))}</div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile, job no., model or IMEI", "नाम, मोबाइल, job नंबर, model या IMEI")} /></div>
      {err && <p className="py-8 text-center font-semibold">{err}</p>}
      {!err && !d && <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}
      {!err && d && d.jobs.length === 0 && <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">{T("Nothing here.", "यहाँ कुछ नहीं है।")}</p>}
      <div className="space-y-2">
        {(d?.jobs ?? []).map((j) => { const st = jobStatus(j.status); const t = jobTotals(j); return (
          <Link key={j.id} href={`/poster/mobile/repair/${j.id}${asQ}`} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2.5">
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{j.device} <span className="font-normal text-muted">· {j.code}</span></span>
              <span className="block truncate text-[11px] text-muted">{j.customer_name || j.customer_phone} · {problemText(j, hi)}{j.tech_name ? ` · ${j.tech_name}` : ""}</span>
              {jobLate(j, d!.today) && <span className="text-[11px] font-semibold text-danger">{T("Late — promised", "देर — वादा था")} {j.due_date}</span>}</span>
            <span className="shrink-0 text-right"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${st.tone}`}>{hi ? st.hi : st.en}</span>
              {t.total > 0 && <span className="block text-[12px] font-semibold tabular-nums">{inr(t.total)}</span>}</span>
          </Link>); })}
      </div>
    </div>
  );
}

export default function JobsPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Jobs /></Suspense>;
}
