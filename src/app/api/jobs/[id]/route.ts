// One job card (bearer; ?as= / body.as for a team workspace).
//   GET → { job, events, measurement, measurements, karigars, team, role }
//   PATCH { action, … } →
//     status   { status, note? }            (ready → { notify:true } also sends the customer's WhatsApp)
//     assign   { karigar_id?, assigned_to? } (owner / manager)
//     cloth_out / cloth_in { karigar_id?, pieces?, meters?, note? }  — cloth given to / taken back from a karigar
//     payment  { amount, note? }            note { note }      notify {}      edit { due_date?, amount?, details?, measurement_id? }
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { addonGate } from "@/lib/addons-server";
import { resolveScope, agentsFor } from "@/lib/crm-server";
import { isTeamMember } from "@/lib/crm-pro";
import { isUuid, jobById, jobSetup, logEvent, notifyReady, personName, setStatus, shopName } from "@/lib/jobs-server";
import { JOB_COLS, JOB_STATUSES, cleanPhone, rupees, toPaise, type JobEvent, type JobRow, type JobStatus, type Karigar, type Measurement } from "@/lib/jobs";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const MCOLS = "id,customer_phone,customer_name,garment,unit,values:sizes,notes,taken_by_name,created_at";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params;
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return gate;
  const job = await jobById(scope, id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const [events, karigars, team, ms, setup, shop] = await Promise.all([
    restAsService<JobEvent[]>(`job_events?job_id=eq.${job.id}&owner_id=eq.${scope.ownerId}&select=id,job_id,kind,status,karigar_id,karigar,pieces,meters,amount_paise,note,by_name,at&order=at`),
    restAsService<Karigar[]>(`job_karigars?owner_id=eq.${scope.ownerId}&select=id,name,phone,skill,active&order=name`),
    agentsFor(me.token, scope.ownerId, scope.role === "agent" ? "manager" : scope.role).catch(() => []),
    job.customer_phone
      ? restAsService<Measurement[]>(`job_measurements?owner_id=eq.${scope.ownerId}&customer_phone=eq.${encodeURIComponent(job.customer_phone)}&select=${MCOLS}&order=created_at.desc&limit=20`)
      : Promise.resolve({ data: [] as Measurement[] }),
    jobSetup(scope.ownerId),
    shopName(scope.ownerId),
  ]);
  const measurements = list(ms);
  let measurement = measurements.find((m) => m.id === job.measurement_id) ?? null;
  if (!measurement && job.measurement_id) measurement = list(await restAsService<Measurement[]>(`job_measurements?id=eq.${job.measurement_id}&owner_id=eq.${scope.ownerId}&select=${MCOLS}`))[0] ?? null;
  return NextResponse.json({
    job, events: list(events), measurement, measurements, karigars: list(karigars), role: scope.role, setup, shop,
    team: team.filter((a) => a.agent_user_id && a.active).map((a) => ({ id: a.agent_user_id as string, name: a.name || a.phone || "Team member", role: a.role })),
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const { id } = await ctx.params;
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const gate = await addonGate(scope.ownerId, "orders"); if (gate) return gate;
  const job = await jobById(scope, id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const byName = (await personName(me.id)) || (scope.role === "owner" ? "Owner" : "Team");
  const boss = scope.role !== "agent";
  const update = async (patch: Record<string, unknown>) => list(await restAsService<JobRow[]>(`job_orders?id=eq.${job.id}&owner_id=eq.${scope.ownerId}&select=${JOB_COLS}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  }))[0] ?? null;
  const karigarOf = async (kid: unknown) => (isUuid(kid) ? list(await restAsService<Karigar[]>(`job_karigars?id=eq.${kid}&owner_id=eq.${scope.ownerId}&select=id,name,phone,skill,active`))[0] ?? null : null);

  switch (b.action) {
    case "status": {
      const status = b.status as JobStatus;
      if (!(JOB_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
      if (status === "cancelled" && !boss) return NextResponse.json({ error: "Only the owner can cancel a job." }, { status: 403 });
      const next = await setStatus(scope, job, status, byName, txt(b.note, 300));
      if (!next) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
      const notice = status === "ready" && b.notify !== false ? await notifyReady(scope, next, byName) : null;
      return NextResponse.json({ job: notice?.sent ? { ...next, notified_at: new Date().toISOString() } : next, notice });
    }
    case "assign": {
      if (!boss) return NextResponse.json({ error: "Only the owner or a manager can assign." }, { status: 403 });
      const patch: Record<string, unknown> = {};
      let label = "";
      if ("karigar_id" in b) { const k = await karigarOf(b.karigar_id); patch.karigar_id = k?.id ?? null; label = k ? `Karigar: ${k.name}` : "Karigar removed"; }
      if ("assigned_to" in b) {
        if (b.assigned_to && !(isUuid(b.assigned_to) && (await isTeamMember(scope.ownerId, b.assigned_to)))) return NextResponse.json({ error: "That person is not in your team." }, { status: 400 });
        patch.assigned_to = b.assigned_to || null;
        label = [label, b.assigned_to ? `Tailor: ${txt(b.assigned_name, 60) || "team member"}` : "Tailor removed"].filter(Boolean).join(" · ");
      }
      const next = await update(patch);
      if (!next) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
      await logEvent(scope, job.id, { kind: "assign", karigar_id: next.karigar_id, note: label }, byName);
      return NextResponse.json({ job: next });
    }
    case "cloth_out":
    case "cloth_in": {
      const k = await karigarOf(b.karigar_id ?? job.karigar_id);
      const pieces = Math.max(0, Math.min(999, Math.round(Number(b.pieces) || 0))) || null;
      const meters = Math.max(0, Math.min(9999, Number(b.meters) || 0)) || null;
      if (!pieces && !meters && !txt(b.note, 10)) return NextResponse.json({ error: "Write the pieces, the metres or a note." }, { status: 400 });
      await logEvent(scope, job.id, { kind: b.action, karigar_id: k?.id ?? null, karigar: k?.name ?? txt(b.karigar, 60), pieces, meters, note: txt(b.note, 300) }, byName);
      // Cloth handed to a karigar the job had none for: that karigar now has it.
      const next = b.action === "cloth_out" && k && job.karigar_id !== k.id && boss ? await update({ karigar_id: k.id }) : await update({});
      return NextResponse.json({ job: next ?? job });
    }
    case "payment": {
      const amount = toPaise(b.amount);
      if (!amount) return NextResponse.json({ error: "Write the amount received." }, { status: 400 });
      const next = await update({ advance_paise: (job.advance_paise || 0) + amount });
      await logEvent(scope, job.id, { kind: "payment", amount_paise: amount, note: txt(b.note, 200) || "Payment" }, byName);
      return NextResponse.json({ job: next ?? job });
    }
    case "note": {
      const note = txt(b.note, 1000);
      if (!note) return NextResponse.json({ error: "Write the note." }, { status: 400 });
      await logEvent(scope, job.id, { kind: "note", note }, byName);
      return NextResponse.json({ job });
    }
    case "notify": {
      const notice = await notifyReady(scope, job, byName);
      return NextResponse.json({ job: notice.sent ? { ...job, notified_at: new Date().toISOString() } : job, notice });
    }
    case "edit": {
      // Anything on the job card can be corrected; the history says what changed.
      const patch: Record<string, unknown> = {};
      const said: string[] = [];
      const fmtDate = (v: unknown) => (typeof v === "string" && v ? new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");
      if ("due_date" in b) { patch.due_date = typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null; if (patch.due_date !== job.due_date) said.push(`Due ${fmtDate(job.due_date)} → ${fmtDate(patch.due_date)}`); }
      if ("details" in b) { patch.details = txt(b.details, 1000); if (patch.details !== job.details) said.push("Details changed"); }
      if ("item" in b) { patch.item = txt(b.item, 60); if (patch.item !== job.item) said.push(`Item: ${patch.item || "—"}`); }
      if ("work" in b) { patch.work = txt(b.work, 60); if (patch.work !== job.work) said.push(`Work: ${patch.work || "—"}`); }
      if ("qty" in b) { patch.qty = Math.max(1, Math.min(99, Number(b.qty) || 1)); if (patch.qty !== job.qty) said.push(`Pieces: ${patch.qty}`); }
      if ("customer_name" in b) { const n = txt(b.customer_name, 80); if (!n) return NextResponse.json({ error: "Write the customer's name." }, { status: 400 }); patch.customer_name = n; if (n !== job.customer_name) said.push(`Name: ${n}`); }
      if ("customer_phone" in b) {
        const p = b.customer_phone ? cleanPhone(b.customer_phone) : "";
        if (b.customer_phone && !p) return NextResponse.json({ error: "That mobile number does not look right (10 digits)." }, { status: 400 });
        patch.customer_phone = p; if (p !== job.customer_phone) said.push(`Mobile: ${p || "—"}`);
      }
      if ("measurement_id" in b) { patch.measurement_id = isUuid(b.measurement_id) ? b.measurement_id : null; if (patch.measurement_id !== job.measurement_id) said.push("Measurement attached"); }
      if ("amount" in b && boss) { patch.amount_paise = toPaise(b.amount); if (patch.amount_paise !== job.amount_paise) said.push(`Charge: ${rupees(patch.amount_paise as number)}`); }
      if (!Object.keys(patch).length) return NextResponse.json({ job });
      const next = await update(patch);
      if (!next) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 502 });
      if (said.length) await logEvent(scope, job.id, { kind: "note", note: `Edited — ${said.join(" · ")}` }, byName);
      return NextResponse.json({ job: next });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
