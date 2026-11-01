"use client";
// The job slip / tag for the counter (owner, 1 Nov 2026): one small card per job — job number, customer, item · work, due date,
// total / advance / balance, the measurement, the shop's name — printed and pinned to the cloth, or saved as a PDF.
// /poster/orders/slip?ids=<job id>,<job id>…  (one order's jobs from "Order booked", or one job from its card)
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, LoaderCircle, Printer } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { balanceOf, fmtDay, rupees, stepLabel, type JobRow, type JobSetup, type Measurement } from "@/lib/jobs";
import { useWorkspace } from "@/components/orders/orders-common";

type Detail = { job: JobRow; measurement: Measurement | null; setup: JobSetup; shop: string; me: { rights: string[] }; error?: string };
const PRINT = "@media print { body * { visibility: hidden !important; } #job-slips, #job-slips * { visibility: visible !important; } #job-slips { position: absolute; left: 0; top: 0; width: 100%; } .slip { break-inside: avoid; page-break-inside: avoid; } @page { margin: 8mm; } }";

export default function SlipPage() {
  return <Suspense fallback={<div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>}><Slips /></Suspense>;
}

function Slips() {
  const sp = useSearchParams();
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const ids = (sp.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 20);
  const [rows, setRows] = useState<Detail[] | null>(null);
  const [err, setErr] = useState("");
  const [size, setSize] = useState<"tag" | "a5">("tag");

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
      if (!ids.length) { setErr(T("No job to print.", "Print करने को कोई job नहीं।")); return; }
      const got = await Promise.all(ids.map((id) => api<Detail>(`/api/jobs/${id}${ws.q ? `?${ws.q}` : ""}`, { fresh: true })));
      const ok = got.filter((r) => r.ok).map((r) => r.data);
      if (!ok.length) { setErr(got[0]?.data?.error || T("Could not load.", "Load नहीं हुआ।")); return; }
      setRows(ok);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get("ids"), ws.q]);

  if (err) return <p className="py-16 text-center text-sm text-danger">{err}</p>;
  if (!rows) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const money = rows[0]?.me.rights.includes("money");
  const first = rows[0].job;
  const total = rows.reduce((a, r) => a + (r.job.amount_paise || 0), 0), adv = rows.reduce((a, r) => a + (r.job.advance_paise || 0), 0);
  const tag = size === "tag";

  return (
    <div className="space-y-4 pb-12">
      <style>{PRINT}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={rows.length === 1 ? `/poster/orders/${first.id}` : "/poster/orders"} className="text-muted" aria-label={T("Back", "पीछे")}><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-lg font-bold">{T("Job slip / tag", "Job slip / tag")}</h1>
        <span className="inline-flex overflow-hidden rounded-full border border-border text-xs">
          {(["tag", "a5"] as const).map((k) => <button key={k} type="button" onClick={() => setSize(k)} className={`px-3 py-1.5 ${size === k ? "bg-brand font-semibold text-white" : "bg-surface"}`}>{k === "tag" ? T("Small tag", "छोटा tag") : T("Full slip", "पूरी slip")}</button>)}
        </span>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white"><Printer className="h-4 w-4" /> {T("Print / save PDF", "Print / PDF")}</button>
      </div>
      <p className="text-xs text-muted print:hidden">{T("Print it and pin it to the cloth — the karigar sees the job number, the item, the date and the measurement without opening the app. On a phone, “Print” saves it as a PDF too.", "Print करके कपड़े पर लगा दें — कारीगर को बिना app खोले job नंबर, item, तारीख और नाप दिखेगा। फ़ोन पर “Print” से PDF भी बन जाती है।")}</p>

      <div id="job-slips" className={tag ? "grid gap-3 sm:grid-cols-2 print:grid-cols-2" : "space-y-3"}>
        {rows.map(({ job, measurement, setup, shop }) => {
          const vals = Object.entries(measurement?.values ?? {});
          const bal = balanceOf(job);
          return (
            <article key={job.id} className={`slip rounded-2xl border-2 border-dashed border-slate-400 bg-white p-4 text-slate-900 ${tag ? "" : "mx-auto w-full max-w-lg"}`}>
              <header className="flex items-start justify-between gap-2 border-b border-slate-300 pb-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{shop || T("Job slip", "Job slip")}</p>
                  <p className="truncate text-base font-bold">{job.customer_name}</p>
                  {job.customer_phone && <p className="text-xs text-slate-600">{job.customer_phone.replace(/^\+91/, "")}</p>}
                </div>
                <p className="shrink-0 rounded-xl bg-slate-900 px-3 py-1.5 text-xl font-black text-white">#{job.number}</p>
              </header>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <p className="text-base font-bold">{[job.item, job.work].filter(Boolean).join(" · ")}{job.qty > 1 ? ` × ${job.qty}` : ""}</p>
                <p className="shrink-0 text-right text-sm"><span className="text-xs text-slate-500">{T("Due", "देना है")}</span> <b>{fmtDay(job.due_date)}</b></p>
              </div>
              {job.details && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{job.details}</p>}
              {vals.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{measurement?.garment} · {measurement?.unit === "cm" ? "cm" : T("inch", "इंच")}{measurement?.customer_name && measurement.customer_name !== job.customer_name ? ` · ${measurement.customer_name}` : ""}</p>
                  <div className={`mt-1 grid gap-x-3 gap-y-0.5 text-xs ${tag ? "grid-cols-2" : "grid-cols-3"}`}>
                    {vals.map(([k, v]) => <p key={k} className="flex justify-between gap-1 border-b border-dotted border-slate-300"><span className="truncate text-slate-500">{k}</span><b>{v}</b></p>)}
                  </div>
                  {measurement?.notes && <p className="mt-1 text-[11px] text-slate-700">📝 {measurement.notes}</p>}
                </div>
              )}
              <footer className="mt-2 flex items-end justify-between gap-2 border-t border-slate-300 pt-2 text-xs">
                <p className="text-slate-500">{T("Booked", "बुक")} {fmtDay(job.created_at.slice(0, 10))} · {stepLabel(setup, job.status, hi)}</p>
                {money && job.amount_paise > 0 && <p className="text-right"><span className="text-slate-500">{T("Total", "कुल")}</span> <b>{rupees(job.amount_paise)}</b>{job.advance_paise > 0 && <> · <span className="text-slate-500">{T("Adv", "Adv")}</span> {rupees(job.advance_paise)}</>}{bal > 0 && <> · <span className="font-bold">{T("Due", "बाकी")} {rupees(bal)}</span></>}</p>}
              </footer>
            </article>
          );
        })}
        {rows.length > 1 && money && total > 0 && (
          <p className={`slip rounded-xl bg-slate-100 px-4 py-2 text-center text-sm text-slate-900 ${tag ? "sm:col-span-2" : "mx-auto max-w-lg"}`}>
            {T("Order total", "Order कुल")} <b>{rupees(total)}</b> · {T("Advance", "Advance")} <b>{rupees(adv)}</b> · {T("Balance", "बाकी")} <b>{rupees(Math.max(0, total - adv))}</b>
          </p>
        )}
      </div>
    </div>
  );
}
