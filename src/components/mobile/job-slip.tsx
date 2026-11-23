// The repair job slip the customer takes home (and the copy that stays with the phone): thermal or sheet, by Settings → paper.
// The lock code, internal notes and costs are never drawn.
import { inr } from "@/lib/jewellery";
import type { MsSetup } from "@/lib/mobile";
import { conditionText, jobStatus, jobTotals, problemText, type JobRow } from "@/lib/mobile-repair";

const day = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const date = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function JobSlip({ job, setup, shop }: { job: JobRow; setup: MsSetup; shop: string }) {
  const t = jobTotals(job);
  const slip = setup.paper === "58" || setup.paper === "80";
  const width = setup.paper === "58" ? "58mm" : setup.paper === "80" ? "80mm" : setup.paper === "a5" ? "148mm" : "100%";
  const row = (k: string, v: string) => (v ? <p className="flex gap-2"><span className="shrink-0 opacity-70">{k}:</span><span className="font-semibold">{v}</span></p> : null);
  return (
    <article className="ms-doc mx-auto bg-white text-black" style={{ width, maxWidth: "100%", padding: slip ? "3mm" : "8mm", fontSize: slip ? (setup.paper === "58" ? 10 : 11) : 12, fontFamily: "Arial, sans-serif" }}>
      <header className="text-center">
        <h1 style={{ fontSize: slip ? 15 : 20 }} className="font-bold leading-tight">{setup.shopName || shop}</h1>
        {setup.address && <p className="whitespace-pre-line">{setup.address}</p>}
        {setup.phone && <p>Ph: {setup.phone}</p>}
        <p className="mt-1 border-y border-dashed border-black py-0.5 font-bold uppercase">Repair job</p>
      </header>
      <div className="mt-1 flex justify-between gap-2"><b style={{ fontSize: slip ? 13 : 15 }}>{job.code}</b><span>{day(job.created_at)}</span></div>
      <div className="mt-1 space-y-0.5">
        {row("Customer", [job.customer_name, job.customer_phone].filter(Boolean).join(" · "))}
        {row("Phone", job.device)}
        {row("IMEI", job.imei)}
        {row("Problem", problemText(job))}
        {row("Condition", conditionText(job))}
        {row("Came with", job.accessories)}
        {row("Ready by", job.due_date ? date(job.due_date) : "")}
        {row("Status", jobStatus(job.status).en)}
      </div>
      <div className="mt-1 space-y-0.5 border-y border-black py-0.5">
        {job.est_paise > 0 && <p className="flex justify-between"><span>Estimate</span><span>{inr(job.est_paise)}</span></p>}
        {t.total > 0 && <p className="flex justify-between"><span>Charge so far</span><span>{inr(t.total)}</span></p>}
        <p className="flex justify-between font-bold"><span>Advance received</span><span>{inr(t.paid)}</span></p>
      </div>
      {job.est_paise > 0 && <p className="mt-1 opacity-80">The estimate can change after the phone is opened; we will ask you first.</p>}
      {setup.repairTerms && <p className="mt-1 whitespace-pre-line opacity-80">{setup.repairTerms}</p>}
      <div className="mt-6 flex justify-between gap-4"><span className="border-t border-black pt-0.5">Customer&apos;s sign</span><span className="border-t border-black pt-0.5">For {setup.shopName || shop}</span></div>
      <p className="mt-2 text-center opacity-60" style={{ fontSize: 9 }}>Made with Shubhora · shubhora.com</p>
    </article>
  );
}
