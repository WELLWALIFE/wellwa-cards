import "server-only";
// Orders & job cards — server side. Every call goes through the service role; the role checks live here:
//   owner / manager → every job of the shop;  agent (a tailor or counter staff with the app) → the jobs assigned to
//   them or created by them. Team = the CRM team (crm_agents): the same join code puts a tailor in the shop's app.
import { restAsService } from "@/lib/poster-server";
import { bridge, ownerPlanExpiry, type Scope } from "@/lib/crm-server";
import { businessContext } from "@/lib/reviews-server";
import { cloudAccount, sendCloud } from "@/lib/wa-cloud";
import { JOB_COLS, readyMessage, type JobRow, type JobStatus } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** The person's own name for the history ("Ramesh (tailor)"). */
export async function personName(userId: string): Promise<string> {
  const p = list(await restAsService<{ full_name: string | null }[]>(`profiles?id=eq.${userId}&select=full_name&limit=1`))[0];
  return (p?.full_name || "").trim().slice(0, 60);
}

export function canSee(scope: Scope, job: Pick<JobRow, "assigned_to" | "created_by">): boolean {
  return scope.role !== "agent" || job.assigned_to === scope.userId || job.created_by === scope.userId;
}

export async function jobById(scope: Scope, id: string): Promise<JobRow | null> {
  if (!isUuid(id)) return null;
  const j = list(await restAsService<JobRow[]>(`job_orders?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${JOB_COLS}&limit=1`))[0];
  return j && canSee(scope, j) ? j : null;
}

/** The next job number of the shop (#101 onwards). */
export async function nextNumber(ownerId: string): Promise<number> {
  const last = list(await restAsService<{ number: number }[]>(`job_orders?owner_id=eq.${ownerId}&select=number&order=number.desc&limit=1`))[0];
  return Math.max(100, last?.number ?? 100) + 1;
}

export async function logEvent(scope: Scope, jobId: string, e: Record<string, unknown>, byName: string) {
  await restAsService("job_events", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ owner_id: scope.ownerId, job_id: jobId, by_user: scope.userId, by_name: byName, ...e }),
  }).catch(() => undefined);
}

export async function setStatus(scope: Scope, job: JobRow, status: JobStatus, byName: string, note = ""): Promise<JobRow | null> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "delivered") patch.delivered_at = new Date().toISOString();
  const r = await restAsService<JobRow[]>(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}&select=${JOB_COLS}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch),
  });
  const next = list(r)[0] ?? null;
  if (next) await logEvent(scope, job.id, { kind: "status", status, note }, byName);
  return next;
}

/** "Ready" on WhatsApp from the shop's own number (Cloud API or the linked WhatsApp). Falls back to a wa.me link the
 *  person taps themselves when the shop's WhatsApp is not connected. */
export async function notifyReady(scope: Scope, job: JobRow, byName: string): Promise<{ sent: boolean; link: string; error?: string }> {
  const shop = (await businessContext(scope.ownerId).catch(() => null))?.name ?? "";
  const text = readyMessage(job, shop);
  const link = job.customer_phone ? `https://wa.me/${job.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!job.customer_phone) return { sent: false, link, error: "No customer number on this job." };
  const mark = async () => {
    await restAsService(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
    await logEvent(scope, job.id, { kind: "notify", note: text }, byName);
  };
  try {
    const cloud = await cloudAccount(scope.ownerId);
    if (cloud?.enabled) { await sendCloud(cloud, job.customer_phone, { text }); await mark(); return { sent: true, link }; }
  } catch { /* fall through to the linked WhatsApp */ }
  const exp = await ownerPlanExpiry(scope.ownerId);
  if (!exp) return { sent: false, link, error: "Automatic WhatsApp needs the Standard plan — send it yourself with the button." };
  const r = await bridge(scope.ownerId, exp, "send", { to: job.customer_phone, text, asOwner: true, sentBy: scope.role === "owner" ? undefined : scope.userId });
  if (!r.ok) return { sent: false, link, error: r.data.error === "not connected" ? "The shop's WhatsApp is not linked — send it yourself with the button." : "WhatsApp could not send right now — send it yourself with the button." };
  await mark();
  return { sent: true, link };
}
