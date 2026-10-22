// Tasks (bearer; ?as= / body.as for a team workspace).
//   GET  ?lead=<id> | ?from=&to= (calendar) | ?open=1          → { tasks }
//   POST { lead_id, kind, title, text?, due_at, assigned_to?, remind_at? } → { task }
//   PATCH { id, done?, outcome?, snooze_to?, due_at?, title?, kind?, text?, assigned_to? } → { task }
//   DELETE ?id=
// leads.next_follow_up follows the earliest open task (trigger in migration 0068), so the reminder cron and the old
// screens stay in step.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { createTask, patchTask, deleteTask, isUuid, isTeamMember, TASK_COLS, TASK_KINDS, type TaskKind, type TaskRow } from "@/lib/crm-pro";

const enc = encodeURIComponent;
const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const f = [`owner_id=eq.${scope.ownerId}`];
  if (scope.role === "agent") f.push(`assigned_to=eq.${scope.userId}`);
  const lead = p.get("lead"); if (isUuid(lead)) f.push(`lead_id=eq.${lead}`);
  const from = iso(p.get("from")), to = iso(p.get("to"));
  if (from) f.push(`due_at=gte.${enc(from)}`); if (to) f.push(`due_at=lt.${enc(to)}`);
  if (p.get("open")) f.push("done_at=is.null");
  // leads(name,phone) rides along (FK embed) so the calendar can name the customer without a second call.
  const r = await restAsService<(TaskRow & { leads?: { name: string; phone: string } | null })[]>(`crm_tasks?${f.join("&")}&select=${TASK_COLS},leads(name,phone)&order=due_at&limit=500`);
  return NextResponse.json({ tasks: Array.isArray(r.data) ? r.data : [] });
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const due = iso(b.due_at);
  if (!due) return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  const kind: TaskKind = (TASK_KINDS as readonly string[]).includes(b.kind) ? b.kind : "call";
  const lead_id = isUuid(b.lead_id) ? b.lead_id : null;
  if (lead_id) {
    const ok = (await restAsService<{ id: string }[]>(`leads?id=eq.${lead_id}&owner_id=eq.${scope.ownerId}${scope.role === "agent" ? `&assigned_to=eq.${scope.userId}` : ""}&select=id&limit=1`)).data?.[0];
    if (!ok) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  // An agent's task is always their own; the owner / a manager may hand it to someone in the team (and nobody else).
  const assigned_to = scope.role !== "agent" && isUuid(b.assigned_to) ? b.assigned_to : undefined;
  if (assigned_to && !(await isTeamMember(scope.ownerId, assigned_to))) return NextResponse.json({ error: "That person is not in your team." }, { status: 400 });
  const task = await createTask(scope, { lead_id, kind, title: String(b.title ?? "").trim(), text: typeof b.text === "string" ? b.text : "", due_at: due, assigned_to, remind_at: iso(b.remind_at), source: b.source === "ai" ? "ai" : "manual" });
  if (!task) return NextResponse.json({ error: "Could not save the task. Please try again." }, { status: 502 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope || !isUuid(b.id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (scope.role !== "agent" && isUuid(b.assigned_to) && !(await isTeamMember(scope.ownerId, b.assigned_to))) return NextResponse.json({ error: "That person is not in your team." }, { status: 400 });
  const task = await patchTask(scope, b.id, { done: typeof b.done === "boolean" ? b.done : undefined, outcome: typeof b.outcome === "string" ? b.outcome : undefined, snooze_to: iso(b.snooze_to) ?? undefined, due_at: iso(b.due_at) ?? undefined, title: typeof b.title === "string" ? b.title : undefined, kind: (TASK_KINDS as readonly string[]).includes(b.kind) ? b.kind : undefined, text: typeof b.text === "string" ? b.text : undefined, assigned_to: b.assigned_to === null ? null : isUuid(b.assigned_to) ? b.assigned_to : undefined });
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const scope = await resolveScope(me, p.get("as"));
  const id = p.get("id");
  if (!scope || !isUuid(id)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json({ ok: await deleteTask(scope, id) });
}
