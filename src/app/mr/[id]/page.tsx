// The customer's page for a repair job (the WhatsApp link): /mr/<id>?t=<token> — where the phone stands, the estimate, the
// advance. No login; the token is the key. The lock code, shop notes and costs are stripped before anything is drawn. Not indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { restAsService } from "@/lib/poster-server";
import { inr } from "@/lib/jewellery";
import { JOB_COLS, JOB_STATUSES, conditionText, jobOpen, jobTotals, problemText, publicJob, type JobRow } from "@/lib/mobile-repair";
import { msSetup, shopOf } from "@/lib/mobile-server";

export const metadata: Metadata = { title: "Repair status", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CustomerJob({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !t || !/^[0-9a-f]{16,40}$/i.test(t)) notFound();
  const r = await restAsService<JobRow[]>(`ms_jobs?id=eq.${id}&token=eq.${t}&select=${JOB_COLS}&limit=1`);
  const row = Array.isArray(r.data) ? r.data[0] : null;
  if (!row) notFound();
  const job = publicJob(row);
  const setup = await msSetup(row.owner_id);
  const shop = await shopOf(row.owner_id, setup);
  const m = jobTotals(job);
  const steps = JOB_STATUSES.filter((s) => jobOpen(s.key) || s.key === "delivered");
  const at = steps.findIndex((s) => s.key === job.status);
  const closed = job.status === "returned" || job.status === "cancelled";
  const line = (k: string, v: string) => (v ? <p className="flex justify-between gap-3 border-b border-neutral-100 py-1.5 text-sm"><span className="text-neutral-500">{k}</span><span className="text-right font-semibold">{v}</span></p> : null);
  return (
    <main className="min-h-screen bg-neutral-100 px-3 py-6 text-neutral-900">
      <div className="mx-auto max-w-md space-y-3">
        <header className="rounded-2xl bg-white p-4 text-center shadow">
          <h1 className="text-lg font-bold">{shop}</h1>
          {setup.phone && <a href={`tel:${setup.phone}`} className="text-sm font-semibold text-blue-700">📞 {setup.phone}</a>}
          <p className="mt-2 text-sm text-neutral-500">रिपेयर job / Repair job</p>
          <p className="text-xl font-black">{job.code}</p>
          <p className="text-sm font-semibold">{job.device}</p>
        </header>
        <section className="rounded-2xl bg-white p-4 shadow">
          {closed ? <p className="text-center text-base font-bold">{job.status === "returned" ? "बिना बने वापस / Returned, not repaired" : "रद्द / Cancelled"}</p> : (
            <ol className="space-y-2">{steps.map((s, i) => (
              <li key={s.key} className={`flex items-center gap-3 ${i <= at ? "" : "opacity-40"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i < at ? "bg-emerald-600 text-white" : i === at ? "bg-blue-600 text-white" : "bg-neutral-200"}`}>{i < at ? "✓" : i + 1}</span>
                <span className={`text-sm ${i === at ? "font-bold" : ""}`}>{s.hi} / {s.en}</span>
              </li>))}</ol>
          )}
          {job.status === "ready" && <p className="mt-3 rounded-xl bg-emerald-50 p-2 text-center text-sm font-semibold text-emerald-800">आपका फ़ोन तैयार है — दुकान से ले जाएँ। / Your phone is ready to collect.</p>}
        </section>
        <section className="rounded-2xl bg-white p-4 shadow">
          {line("ख़राबी / Problem", problemText(job, true))}
          {line("हालत / Condition", conditionText(job, true))}
          {line("साथ आया / Came with", job.accessories)}
          {line("कब तक / Ready by", job.due_date ?? "")}
          {line("अंदाज़ / Estimate", job.est_paise ? inr(job.est_paise) : "")}
          {m.total > 0 && line("कुल / Total", inr(m.total))}
          {line("Advance", m.paid ? inr(m.paid) : "")}
          {m.total > 0 && jobOpen(job.status) && line("देना बाकी / To pay", inr(Math.max(0, m.due)))}
        </section>
        {setup.repairTerms && <p className="px-2 text-[12px] text-neutral-500">{setup.repairTerms}</p>}
        <p className="text-center text-[11px] text-neutral-400">Made with Shubhora · shubhora.com</p>
      </div>
    </main>
  );
}
