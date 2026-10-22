"use client";
// Tasks (docs/crm-pro.md 3.8): the New-task sheet (kind, what, when — quick chips first), one task row with
// Done / Snooze, and the Calendar section (tasks + bookings by day).
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Phone, MessageCircle, Footprints, Handshake, CircleDot, Clock, Trash2 } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useShell, quickMoments, inputCls, Chip, BottomSheet, fmtWhen, fmtTime, isPast, toLocalInput, type Task } from "@/components/crm/shared";
import { Bookings } from "@/components/poster/bookings";

export const KIND_ICON = { call: Phone, whatsapp: MessageCircle, visit: Footprints, meeting: Handshake, other: CircleDot } as const;
export function kindLabel(L: ReturnType<typeof useShell>["L"], k: Task["kind"]) { return k === "call" ? L.kCall : k === "whatsapp" ? L.kWhatsapp : k === "visit" ? L.kVisit : k === "meeting" ? L.kMeeting : L.kOther; }

export function TaskSheet({ leadId, task, onClose, onSaved }: { leadId: string | null; task?: Task; onClose: () => void; onSaved: (t: Task) => void }) {
  const { L, as } = useShell();
  const moments = quickMoments();
  const [kind, setKind] = useState<Task["kind"]>(task?.kind ?? "call");
  const [title, setTitle] = useState(task?.title ?? "");
  const [key, setKey] = useState<string>(task ? "custom" : "tomorrow11");
  const [custom, setCustom] = useState(task ? toLocalInput(task.due_at) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const due = key === "custom" ? (custom ? new Date(custom).toISOString() : "") : moments.find((m) => m.key === key)?.iso ?? "";
  async function save() {
    if (!due || busy) return; setBusy(true); setErr("");
    const r = task
      ? await api<{ task: Task; error?: string }>("/api/crm/tasks", { method: "PATCH", json: { id: task.id, as: as ?? undefined, kind, title: title.trim(), due_at: due } })
      : await api<{ task: Task; error?: string }>("/api/crm/tasks", { method: "POST", json: { lead_id: leadId, as: as ?? undefined, kind, title: title.trim() || kindLabel(L, kind), due_at: due } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || L.failed); return; }
    onSaved(r.data.task); onClose();
  }
  return (
    <BottomSheet title={task ? L.edit : L.newTask} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div><div className="mb-1 text-xs text-muted">{L.taskKind}</div><div className="flex flex-wrap gap-1.5">{(["call", "whatsapp", "visit", "meeting", "other"] as const).map((k) => { const I = KIND_ICON[k]; return <Chip key={k} on={kind === k} onClick={() => setKind(k)}><I className="mr-1 inline h-3 w-3" />{kindLabel(L, k)}</Chip>; })}</div></div>
        <label className="block text-xs text-muted">{L.taskTitle}<input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder={L.taskTitlePh} className={inputCls} /></label>
        <div><div className="mb-1 text-xs text-muted">{L.when}</div>
          <div className="flex flex-wrap gap-1.5">{moments.map((m) => <Chip key={m.key} on={key === m.key} onClick={() => setKey(m.key)}>{m.key === "today6" ? L.quickToday6 : m.key === "tomorrow11" ? L.quickTomorrow11 : m.key === "d3" ? L.quick3d : L.quickWeek}</Chip>)}<Chip on={key === "custom"} onClick={() => setKey("custom")}>{L.pick}</Chip></div>
          {key === "custom" && <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className={inputCls + " mt-1.5"} />}
          {due && <p className="mt-1 text-[11px] text-muted">→ {fmtWhen(due, L.hi)}</p>}
        </div>
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        <button type="button" disabled={!due || busy} onClick={save} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {L.save}</button>
      </div>
    </BottomSheet>
  );
}

/** One task line with Done · Snooze (1 h / tomorrow 11) · delete. */
export function TaskRow({ task, onChanged, showLead }: { task: Task; onChanged: (t: Task | null) => void; showLead?: string }) {
  const { L, as } = useShell();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const I = KIND_ICON[task.kind] ?? CircleDot;
  async function patch(json: Record<string, unknown>, tag: string) {
    setBusy(tag); setErr("");
    const r = await api<{ task: Task; error?: string }>("/api/crm/tasks", { method: "PATCH", json: { id: task.id, as: as ?? undefined, ...json } }).catch(() => null);
    setBusy(""); if (!r?.ok) { setErr(r?.data.error || L.failed); return; } onChanged(r.data.task);
  }
  async function remove() {
    setBusy("del"); const r = await api<{ ok: boolean }>(`/api/crm/tasks?id=${task.id}${as ? `&as=${as}` : ""}`, { method: "DELETE" }); setBusy(""); if (r.ok) onChanged(null); else setErr(L.failed);
  }
  const done = !!task.done_at, late = !done && isPast(task.due_at);
  const tomorrow11 = quickMoments().find((m) => m.key === "tomorrow11")?.iso ?? "";
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-border px-2.5 py-2 text-xs ${done ? "opacity-60" : ""}`}>
      <button type="button" disabled={!!busy} onClick={() => patch({ done: !done }, "done")} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-good bg-good text-white" : "border-border"}`} aria-label={L.done}>{busy === "done" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3 w-3" /> : null}</button>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1 font-semibold text-ink ${done ? "line-through" : ""}`}><I className="h-3.5 w-3.5 text-brand" /> {task.title || kindLabel(L, task.kind)}{showLead && <span className="font-normal text-muted">· {showLead}</span>}</p>
        <p className={`${late ? "text-danger" : "text-muted"}`}>{fmtWhen(task.due_at, L.hi)}{late ? ` · ${L.overdueTag}` : ""}{task.outcome ? ` · ${task.outcome}` : ""}</p>
        {err && <p className="text-danger">{err}</p>}
      </div>
      {!done && (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" disabled={!!busy} onClick={() => patch({ snooze_to: new Date(Date.now() + 3600_000).toISOString() }, "s1")} className="rounded-lg border border-border px-1.5 py-1 text-[10px] text-muted" title={L.snooze1h}><Clock className="mr-0.5 inline h-3 w-3" />1h</button>
          <button type="button" disabled={!!busy} onClick={() => patch({ snooze_to: tomorrow11 }, "s2")} className="rounded-lg border border-border px-1.5 py-1 text-[10px] text-muted" title={L.snoozeTomorrow}>{L.hi ? "कल" : "Tmrw"}</button>
          <button type="button" disabled={!!busy} onClick={remove} className="p-1 text-faint" aria-label={L.delete}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

/* ---------------- calendar section ---------------- */
export function CalendarSection() {
  const { L, as, openCustomer, version } = useShell();
  const [day, setDay] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  type Row = Task & { leads?: { name: string; phone: string } | null };
  const [tasks, setTasks] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const seq = useRef(0);
  const load = useCallback(async (d: string) => {
    const my = ++seq.current;
    const from = new Date(`${d}T00:00:00+05:30`).toISOString(), to = new Date(new Date(`${d}T00:00:00+05:30`).getTime() + 86400000).toISOString();
    const r = await api<{ tasks: Row[]; error?: string }>(`/api/crm/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${as ? `&as=${as}` : ""}`).catch(() => null);
    if (my !== seq.current) return;   // a quicker tap on ‹ › already asked for another day
    setErr(r?.ok ? "" : r?.data.error || L.failed);
    setTasks(r?.ok ? r.data.tasks : []);
  }, [as, L.failed]);
  useEffect(() => { setTasks(null); load(day); }, [day, load, version]);
  // IST has no DST: whole days are 24 h. (setDate() works in the device's zone and slips a day across a DST change.)
  const shift = (n: number) => { const d = new Date(new Date(`${day}T12:00:00+05:30`).getTime() + n * 86400000); setDay(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })); };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => shift(-1)} className="rounded-lg border border-border px-2 py-1 text-sm">‹</button>
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1 text-sm" />
        <button type="button" onClick={() => shift(1)} className="rounded-lg border border-border px-2 py-1 text-sm">›</button>
        <button type="button" onClick={() => setDay(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))} className="ml-auto rounded-lg border border-border px-2 py-1 text-xs text-muted">{L.today}</button>
      </div>
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{L.tasks}</h3>
        {err && <p role="alert" className="mb-1.5 text-xs text-danger">{err}</p>}
        {tasks === null ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : tasks.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">{L.calendarEmpty}</p> : (
          <div className="space-y-1.5">{tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[11px] text-muted">{fmtTime(t.due_at, L.hi)}</span>
              <div className="min-w-0 flex-1"><TaskRow task={t} showLead={t.leads ? t.leads.name || t.leads.phone : undefined} onChanged={(n) => setTasks((xs) => (xs ?? []).flatMap((x) => (x.id === t.id ? (n ? [{ ...x, ...n }] : []) : [x])))} /></div>
              {t.lead_id && <button type="button" onClick={() => openCustomer(t.lead_id as string)} className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] text-brand-ink">›</button>}
            </div>
          ))}</div>
        )}
      </section>
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{L.bookings}</h3>
        <Bookings />
      </section>
    </div>
  );
}
