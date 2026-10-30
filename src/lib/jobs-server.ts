import "server-only";
// Orders & job cards — server side. Every call goes through the service role; the role checks live here:
//   the owner → everything; a staff login (the CRM team, crm_agents) → the rights the owner gave it in Orders → Staff
//   (src/lib/jobs.ts RIGHTS); without "all_jobs" only the jobs given to them or booked by them.
import { NextResponse } from "next/server";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { addonGate } from "@/lib/addons-server";
import { bridge, ownerPlanExpiry, resolveScope, type Scope } from "@/lib/crm-server";
import { businessContext } from "@/lib/reviews-server";
import { cloudAccount, sendCloud } from "@/lib/wa-cloud";
import { ALL_RIGHTS, DEFAULT_SETUP, JOB_COLS, cleanSetup, readyMessage, stepLabel, type JobAccess, type JobRow, type JobSetup, type Right } from "@/lib/jobs";
import { notify } from "@/lib/notify";
import { SITE_URL } from "@/lib/site-url";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** The person's own name for the history ("Ramesh (tailor)"). */
export async function personName(userId: string): Promise<string> {
  const p = list(await restAsService<{ full_name: string | null }[]>(`profiles?id=eq.${userId}&select=full_name&limit=1`))[0];
  return (p?.full_name || "").trim().slice(0, 60);
}

/** The person's rights in this shop: the owner all; a staff login what Orders → Staff gave it (a CRM manager with
 *  nothing set there gets all, an agent with nothing set books and measures). */
export async function accessOf(scope: Scope, setup: JobSetup): Promise<JobAccess> {
  if (scope.role === "owner") return { title: "Owner", rights: ALL_RIGHTS, agentId: null, owner: true };
  const row = list(await restAsService<{ id: string; name: string }[]>(`crm_agents?owner_id=eq.${scope.ownerId}&agent_user_id=eq.${scope.userId}&active=is.true&select=id,name&limit=1`))[0];
  const st = row ? setup.staff[row.id] : undefined;
  const rights: Right[] = st ? st.rights : scope.role === "manager" ? ALL_RIGHTS : ["book", "measure"];
  return { title: st?.title || (scope.role === "manager" ? "Manager" : "Staff"), rights, agentId: row?.id ?? null, owner: false };
}
export const has = (a: JobAccess, r: Right) => a.rights.includes(r);

/** Steps with nobody fixed: a job waiting there with nobody on it is open for any staff to pick ("I'll do this"). */
export const poolSteps = (setup: JobSetup) => setup.steps.filter((x) => !x.who).map((x) => x.key);
export function canSee(scope: Scope, access: JobAccess, job: Pick<JobRow, "assigned_to" | "created_by" | "status">, setup?: JobSetup): boolean {
  return has(access, "all_jobs") || job.assigned_to === scope.userId || job.created_by === scope.userId || (!!setup && !job.assigned_to && poolSteps(setup).includes(job.status));
}
/** The PostgREST "or" list of the jobs a person without "all_jobs" sees (theirs, booked by them, and the open pool). */
export function ownFilter(scope: Scope, setup: JobSetup): string {
  const pool = poolSteps(setup);
  return `assigned_to.eq.${scope.userId},created_by.eq.${scope.userId}${pool.length ? `,and(assigned_to.is.null,status.in.(${pool.join(",")}))` : ""}`;
}
/** Without "money" the charges are not shown. */
export function forView<T extends Partial<JobRow>>(access: JobAccess, j: T): T {
  return has(access, "money") ? j : { ...j, amount_paise: 0, advance_paise: 0 };
}

export async function jobById(scope: Scope, access: JobAccess, id: string, setup?: JobSetup): Promise<JobRow | null> {
  if (!isUuid(id)) return null;
  const j = list(await restAsService<JobRow[]>(`job_orders?id=eq.${id}&owner_id=eq.${scope.ownerId}&select=${JOB_COLS}&limit=1`))[0];
  return j && canSee(scope, access, j, setup) ? j : null;
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

/** A WhatsApp from the shop's own number (Cloud API, else the linked WhatsApp). false when neither can send. */
export async function shopSend(scope: Scope, phone: string, text: string): Promise<boolean> {
  if (!phone) return false;
  try {
    const cloud = await cloudAccount(scope.ownerId);
    if (cloud?.enabled) { await sendCloud(cloud, phone, { text }); return true; }
  } catch { /* fall through to the linked WhatsApp */ }
  const exp = await ownerPlanExpiry(scope.ownerId);
  if (!exp) return false;
  const r = await bridge(scope.ownerId, exp, "send", { to: phone, text, asOwner: true, sentBy: scope.role === "owner" ? undefined : scope.userId });
  return r.ok;
}

/** The person behind a step's "who": a staff login (team row) or a karigar. */
export type Person = { kind: "a" | "k"; id: string; userId: string | null; name: string; phone: string };
export async function personOf(ownerId: string, who: string): Promise<Person | null> {
  const m = /^([ak]):([0-9a-f-]{36})$/i.exec(who); if (!m) return null;
  if (m[1] === "a") {
    const r = list(await restAsService<{ id: string; agent_user_id: string | null; name: string; phone: string; active: boolean }[]>(`crm_agents?id=eq.${m[2]}&owner_id=eq.${ownerId}&select=id,agent_user_id,name,phone,active&limit=1`))[0];
    return r && r.active ? { kind: "a", id: r.id, userId: r.agent_user_id, name: r.name || r.phone, phone: r.phone } : null;
  }
  const k = list(await restAsService<{ id: string; name: string; phone: string; active: boolean }[]>(`job_karigars?id=eq.${m[2]}&owner_id=eq.${ownerId}&select=id,name,phone,active&limit=1`))[0];
  return k && k.active ? { kind: "k", id: k.id, userId: null, name: k.name, phone: k.phone } : null;
}

/** Tell the person who now has the job: in the app (push) for a staff login, and on WhatsApp from the shop's number. */
export async function tellPerson(scope: Scope, setup: JobSetup, job: JobRow, p: Person): Promise<string> {
  const step = stepLabel(setup, job.status, true);
  const due = job.due_date ? new Date(`${job.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
  const link = p.kind === "a" ? `${SITE_URL}/poster/orders/${job.id}?as=${scope.ownerId}` : "";
  const what = [job.item, job.work].filter(Boolean).join(" · ");
  const text = [`🧵 नया काम — Job #${job.number}`, `${what}${job.qty > 1 ? ` × ${job.qty}` : ""}`, `काम: ${step}`, `ग्राहक: ${job.customer_name}`, due ? `देना है: ${due}` : "", job.details ? `Detail: ${job.details.slice(0, 200)}` : "", link ? `खोलें: ${link}` : ""].filter(Boolean).join("\n");
  const said: string[] = [];
  if (p.userId) {
    const r = await notify(p.userId, "job_step", { title: `नया काम: #${job.number} ${what}`, body: `${step} · ${job.customer_name}${due ? ` · देना है ${due}` : ""}`, path: `/poster/orders/${job.id}?as=${scope.ownerId}`, ref: `${job.id}:${job.status}`, channels: ["push"] }).catch(() => ({}));
    if ((r as Record<string, { ok?: boolean; skipped?: string }>).push?.ok && !(r as Record<string, { skipped?: string }>).push?.skipped) said.push("app");
  }
  if (p.phone && (await shopSend(scope, p.phone, text))) said.push("WhatsApp");
  return said.length ? `${p.name} को बताया (${said.join(" + ")})` : `${p.name} — message नहीं जा सका (shop का WhatsApp जुड़ा नहीं)`;
}

/** Move a job to a step. The step's person (if set, and `assign` is true) gets the job and is told; at "ready" the
 *  customer is told (unless notifyCustomer is false). Returns the job, the customer notice and who was told. */
export async function moveTo(scope: Scope, setup: JobSetup, job: JobRow, status: string, byName: string, o: { note?: string; assign?: boolean; notifyCustomer?: boolean } = {}) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "delivered") patch.delivered_at = new Date().toISOString();
  const step = setup.steps.find((x) => x.key === status);
  // The step's person gets the job; a step with nobody fixed leaves it open for any staff to pick (or to be given).
  const p = step?.who && o.assign !== false ? await personOf(scope.ownerId, step.who) : null;
  if (p?.kind === "a") patch.assigned_to = p.userId;
  if (p?.kind === "k") { patch.karigar_id = p.id; patch.assigned_to = null; }
  if (step && !step.who && o.assign !== false) patch.assigned_to = null;
  const r = await restAsService<JobRow[]>(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}&select=${JOB_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
  const next = list(r)[0] ?? null;
  if (!next) return { job: null, notice: null, told: "" };
  // The person who now has it: the step's person, else whoever the job was already given to (a staff login or a karigar).
  let who = p;
  if (!who && step && o.assign === false) {
    if (next.assigned_to) { const a = list(await restAsService<{ id: string }[]>(`crm_agents?owner_id=eq.${scope.ownerId}&agent_user_id=eq.${next.assigned_to}&active=is.true&select=id&limit=1`))[0]; if (a) who = await personOf(scope.ownerId, `a:${a.id}`); }
    if (!who && next.karigar_id) who = await personOf(scope.ownerId, `k:${next.karigar_id}`);
  }
  const told = who && step && (who.kind === "k" || who.userId !== scope.userId) ? await tellPerson(scope, setup, next, who) : "";
  await logEvent(scope, job.id, { kind: "status", status, note: [o.note, told].filter(Boolean).join(" · ") }, byName);
  const notice = status === "ready" && o.notifyCustomer !== false ? await notifyReady(scope, next, byName) : null;
  return { job: notice?.sent ? { ...next, notified_at: new Date().toISOString() } : next, notice, told };
}

/** "Ready" on WhatsApp from the shop's own number (Cloud API or the linked WhatsApp). Falls back to a wa.me link the
 *  person taps themselves when the shop's WhatsApp is not connected. */
export async function notifyReady(scope: Scope, job: JobRow, byName: string): Promise<{ sent: boolean; link: string; error?: string }> {
  const shop = await shopName(scope.ownerId);
  const text = readyMessage(job, shop);
  const link = job.customer_phone ? `https://wa.me/${job.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!job.customer_phone) return { sent: false, link, error: "No customer number on this job." };
  if (!(await shopSend(scope, job.customer_phone, text))) return { sent: false, link, error: "The shop's WhatsApp is not linked (or needs the Standard plan) — send it yourself with the button." };
  await restAsService(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
  await logEvent(scope, job.id, { kind: "notify", note: text }, byName);
  return { sent: true, link };
}

/** The shop's items, measurement fields and kinds of work (owner_prefs.crm.jobSetup), or the defaults. */
export async function jobSetup(ownerId: string): Promise<JobSetup> {
  const r = list(await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`))[0];
  return r?.crm?.jobSetup ? cleanSetup(r.crm.jobSetup) : DEFAULT_SETUP;
}
export async function saveJobSetup(ownerId: string, setup: JobSetup): Promise<boolean> {
  const crm = list(await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`))[0]?.crm ?? {};
  const r = await restAsService("owner_prefs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: ownerId, crm: { ...crm, jobSetup: cleanSetup(setup) }, updated_at: new Date().toISOString() }) });
  return r.ok;
}
/** The shop's name for the customer's messages. */
export async function shopName(ownerId: string): Promise<string> {
  return (await businessContext(ownerId).catch(() => null))?.name ?? "";
}

/** One measurement row from a request body ({ garment, unit, values, notes, person }); null when nothing was filled. */
export function measureRow(scope: Scope, b: Record<string, unknown>, phone: string, fallbackName: string, byName: string): Record<string, unknown> | null {
  const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const values: Record<string, string> = {};
  if (b.values && typeof b.values === "object") {
    for (const [k, v] of Object.entries(b.values as Record<string, unknown>).slice(0, 50)) {
      const key = txt(k, 40), val = txt(v, 20);
      if (key && val) values[key] = val;
    }
  }
  if (!Object.keys(values).length && !txt(b.notes, 5)) return null;
  return {
    owner_id: scope.ownerId, customer_phone: phone, customer_name: txt(b.person, 80) || fallbackName, garment: txt(b.garment, 40) || "Other",
    unit: b.unit === "cm" ? "cm" : "inch", sizes: values, notes: txt(b.notes, 500), taken_by: scope.userId, taken_by_name: byName,
  };
}

/** Every Orders route starts here: logged in, a member of the shop, Orders switched on for the shop, its setup and the person's rights. */
export async function jobsCtx(request: Request, as: string | null): Promise<
  { ok: true; me: NonNullable<Awaited<ReturnType<typeof userFromRequest>>>; scope: Scope; setup: JobSetup; access: JobAccess } | { ok: false; res: NextResponse }> {
  const me = await userFromRequest(request);
  if (!me) return { ok: false, res: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  const scope = await resolveScope(me, as);
  if (!scope) return { ok: false, res: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return { ok: false, res: gate };
  const setup = await jobSetup(scope.ownerId);
  return { ok: true, me, scope, setup, access: await accessOf(scope, setup) };
}
export const denied = (what: string) => NextResponse.json({ error: `You do not have the right to ${what}. Ask the owner (Orders → Staff).` }, { status: 403 });
