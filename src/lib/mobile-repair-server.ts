import "server-only";
// Mobile Shop repair jobs — server side: read, number and save a job, its customer link and its WhatsApp messages.
import { restAsService } from "@/lib/poster-server";
import type { Scope } from "@/lib/crm-server";
import { shopSend } from "@/lib/jobs-server";
import { SITE_URL } from "@/lib/site-url";
import { finYear } from "@/lib/jewellery";
import { istDay, isUuid, linkCustomerPhone } from "@/lib/jewellery-server";
import type { MsSetup } from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";
import { JOB_COLS, jobMessage, type JobEvent, type JobNote, type JobRow } from "@/lib/mobile-repair";
import { msHas, qtyAdd, shopOf } from "@/lib/mobile-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function jobById(ownerId: string, id: string): Promise<JobRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<JobRow[]>(`ms_jobs?id=eq.${id}&owner_id=eq.${ownerId}&select=${JOB_COLS}&limit=1`))[0] ?? null;
}
export const jobLink = (j: Pick<JobRow, "id" | "token">) => `${SITE_URL}/mr/${j.id}?t=${j.token}`;
export const jobEvent = (by: string, text: string): JobEvent => ({ at: new Date().toISOString(), by, text: text.slice(0, 200) });
/** Cost of parts is for those with the "cost" right. */
export const hideJobCost = (j: JobRow, a: MsAccess): JobRow => (msHas(a, "cost") ? j : { ...j, parts: (j.parts ?? []).map((p) => ({ ...p, cost: 0 })) });

export type NewJob = Pick<JobRow, "customer_name" | "customer_phone" | "device" | "imei" | "problems" | "problem_note" | "condition" | "accessories" | "lock_code" | "est_paise" | "payments" | "due_date" | "tech_id" | "tech_name" | "notes" | "created_by" | "created_by_name">;

export async function createJob(scope: Scope, setup: MsSetup, f: NewJob): Promise<JobRow | null> {
  const fy = finYear(new Date(`${istDay()}T12:00:00`));
  for (let tries = 0; tries < 4; tries++) {
    const last = list(await restAsService<{ number: number }[]>(`ms_jobs?owner_id=eq.${scope.ownerId}&fin_year=eq.${fy}&select=number&order=number.desc&limit=1`))[0];
    const number = (last?.number ?? 0) + 1;
    const row = { ...f, owner_id: scope.ownerId, number, fin_year: fy, code: `${setup.jobPrefix}/${fy}/${number}`, warranty_days: setup.repairWarrantyDays, events: [jobEvent(f.created_by_name, "Phone received")] };
    const r = await restAsService<JobRow[]>(`ms_jobs?select=${JOB_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (r.ok) {
      const job = list(r)[0] ?? null;
      if (job?.customer_phone) await linkCustomerPhone(scope.ownerId, job.customer_phone, job.customer_name, `🔧 Repair ${job.code} · ${job.device}`, "interested", 0).catch(() => undefined);
      return job;
    }
    if (r.status !== 409 && !/duplicate key/i.test(r.text)) { console.error("[mobile] job save", r.status, r.text.slice(0, 200)); return null; }
  }
  return null;
}

export async function saveJob(ownerId: string, id: string, patch: Partial<JobRow>): Promise<JobRow | null> {
  const r = await restAsService<JobRow[]>(`ms_jobs?id=eq.${id}&owner_id=eq.${ownerId}&select=${JOB_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  return list(r)[0] ?? null;
}

/** The parts on a job go back on the shelf (the job is cancelled or returned unrepaired). */
export async function partsBack(ownerId: string, j: Pick<JobRow, "parts">): Promise<void> {
  for (const p of j.parts ?? []) if (p.itemId) await qtyAdd(ownerId, p.itemId, p.qty);
}

export async function sendJob(scope: Scope, setup: MsSetup, j: JobRow, what: JobNote): Promise<{ sent: boolean; link: string; error?: string }> {
  const text = jobMessage(j, await shopOf(scope.ownerId, setup), jobLink(j), what);
  const link = j.customer_phone ? `https://wa.me/${j.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!j.customer_phone) return { sent: false, link, error: "No customer number on this job." };
  if (!(await shopSend(scope, j.customer_phone, text))) return { sent: false, link, error: "The shop's WhatsApp is not linked — send it with the button." };
  return { sent: true, link };
}
