"use client";
// One customer, everything from here (docs/crm-pro.md 3.3): header with stage and assignee, the action bar
// (Call · WhatsApp · Task · Note · Booking · Payment), the next action, then Chat (the existing thread, embedded),
// Activity (one timeline: messages, notes, calls, tasks, bookings) and Details (the profile).
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone, MessageCircle, CalendarClock, StickyNote, CalendarPlus, IndianRupee, LoaderCircle, Plus, ExternalLink, Check, Mic } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/poster-client";
import { Thread, STAGES } from "@/components/crm/crm";
import { useShell, waLink, inputCls, Chip, Avatar, StagePill, BottomSheet, fmtWhen, ago, rupees, isPast, CLOSED, type LeadPro, type Task, type Call } from "@/components/crm/shared";
import { STAGE_LABEL, OUTCOME_LABEL } from "@/components/crm/i18n";
import { TaskSheet, TaskRow } from "@/components/crm/tasks";
import { SalesTab, SaleSheet } from "@/components/crm/sales";

type TimelineItem = { id: string; at: string; kind: "message" | "event" | "call" | "task" | "task_done" | "booking"; icon: string; text: string; sub?: string; data?: Record<string, unknown> };
type Full = { lead: LeadPro; tasks: Task[]; calls: Call[]; timeline: TimelineItem[] };

export function CustomerScreen({ id, onBack, initialTab = "chat" }: { id: string; onBack: () => void; initialTab?: "chat" | "activity" | "details" | "sales" }) {
  const { L, ws, ctx, as, startCall, version } = useShell();
  const [data, setData] = useState<Full | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"chat" | "activity" | "details" | "sales">(initialTab);
  const [sheet, setSheet] = useState<"" | "task" | "note" | "stage" | "sale">("");
  const [tplOpen, setTplOpen] = useState(false);
  const [hdrErr, setHdrErr] = useState("");
  const load = useCallback(async (quiet = false) => {
    const r = await api<Full & { error?: string }>(`/api/crm/lead/${id}${as ? `?as=${as}` : ""}`);
    if (!r.ok) { if (!quiet) setErr(r.data.error || L.failed); return; }
    setData(r.data); setErr("");
  }, [id, as, L.failed]);
  useEffect(() => { load(version > 0); }, [load, version]);
  const patch = useCallback(async (p: Record<string, unknown>) => {
    setHdrErr("");
    const r = await api<{ lead: LeadPro; error?: string }>("/api/crm/lead", { method: "PATCH", json: { id, as: as ?? undefined, ...p } });
    if (!r.ok) { setHdrErr(r.data.error || L.failed); return false; }
    setData((d) => (d ? { ...d, lead: { ...d.lead, ...r.data.lead } } : d)); load(true); return true;
  }, [id, as, load, L.failed]);
  const l = data?.lead;
  const openTasks = useMemo(() => (data?.tasks ?? []).filter((t) => !t.done_at).sort((a, b) => (a.due_at < b.due_at ? -1 : 1)), [data]);
  const nextTask = openTasks[0];
  if (err && !data) return <div className="space-y-3 py-8 text-center"><p className="text-sm text-danger">{err}</p><button type="button" onClick={onBack} className="rounded-xl border border-border px-4 py-2 text-sm">{L.back}</button></div>;
  if (!l) return <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const closed = CLOSED.includes(l.status);
  const openWhatsApp = () => {
    setTab("chat");
    // Give the Chat tab a moment to draw, then use its reply box if WhatsApp can send from here.
    window.setTimeout(() => {
      const box = document.querySelector<HTMLTextAreaElement>('textarea[data-crm-reply="on"]');
      if (box) { box.scrollIntoView({ behavior: "smooth", block: "center" }); box.focus(); return; }
      const digits = String(l.phone ?? "").replace(/\D/g, "");
      if (digits.length >= 10) window.open(`https://wa.me/${digits.length === 10 ? "91" + digits : digits}`, "_blank", "noopener");
    }, 150);
  };
  const tabBtn = (k: typeof tab, label: string) => <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${tab === k ? "grad-brand text-white" : "text-muted"}`}>{label}</button>;
  return (
    <div className="space-y-2">
      {/* header */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-surface2" aria-label={L.back}><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={l.name} phone={l.phone} size={10} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{l.name || l.phone}</p>
          <p className="truncate text-[11px] text-muted">{l.phone}{l.city ? ` · ${l.city}` : ""}{l.business ? ` · ${l.business}` : ""}</p>
        </div>
        <button type="button" onClick={() => setSheet("stage")} className="shrink-0"><StagePill status={l.status} hi={L.hi} /></button>
      </div>
      {ctx.role !== "agent" && ctx.agents.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted">{L.assigned}
          <select value={l.assigned_to ?? ""} onChange={(e) => patch({ assigned_to: e.target.value || null })} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink"><option value="">{L.nobody}</option>{ctx.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </div>
      )}
      {hdrErr && <p role="alert" className="text-[11px] text-danger">{hdrErr}</p>}

      {/* action bar */}
      {/* WhatsApp: the Chat tab was already open, so the button looked dead (owner, 23 Oct 2026). Now it goes to the reply box
          when WhatsApp is linked here; otherwise it opens the customer's chat in the WhatsApp app. */}
      <div className="grid grid-cols-6 gap-1 text-[10px] font-semibold text-ink">
        {[
          { k: "call", I: Phone, t: L.call, f: () => startCall(l, () => load(true)), cls: "text-brand" },
          { k: "wa", I: MessageCircle, t: L.whatsapp, f: openWhatsApp, cls: "text-good" },
          { k: "task", I: CalendarClock, t: L.task, f: () => setSheet("task"), cls: "text-lead" },
          { k: "note", I: StickyNote, t: L.note, f: () => setSheet("note"), cls: "text-ai" },
          { k: "book", I: CalendarPlus, t: L.book, href: `/poster/leads?tab=bookings`, cls: "text-brand-ink" },
          { k: "pay", I: IndianRupee, t: L.sales, f: () => setTab("sales"), cls: "text-good" },
        ].map((a) => a.href ? (
          <Link key={a.k} href={a.href} className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface py-2"><a.I className={`h-4 w-4 ${a.cls}`} />{a.t}</Link>
        ) : (
          <button key={a.k} type="button" onClick={a.f} className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface py-2"><a.I className={`h-4 w-4 ${a.cls}`} />{a.t}</button>
        ))}
      </div>

      {/* next action */}
      {!closed && (
        nextTask ? <TaskRow task={nextTask} onChanged={() => load(true)} />
        : <button type="button" onClick={() => setSheet("task")} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted"><Plus className="h-3.5 w-3.5" /> {L.noNext}</button>
      )}

      <div className="flex rounded-full border border-border bg-surface p-0.5">{tabBtn("chat", L.chat)}{tabBtn("activity", `${L.activity}${data ? ` · ${data.timeline.length}` : ""}`)}{tabBtn("details", L.details)}{tabBtn("sales", L.sales)}</div>

      {tab === "chat" && <Thread id={id} seed={l} wa={ws.wa} ctx={ctx} embedded onBack={onBack} onLead={(x) => setData((d) => (d ? { ...d, lead: { ...d.lead, ...x } } : d))} onTemplates={() => setTplOpen(true)} tplOpen={tplOpen} closeTpl={() => setTplOpen(false)} />}
      {tab === "activity" && <Activity items={data!.timeline} openTasks={openTasks} onChanged={() => load(true)} />}
      {tab === "details" && <Details lead={l} onSave={patch} />}
      {tab === "sales" && <SalesTab lead={l} onChanged={() => load(true)} />}
      {sheet === "sale" && <SaleSheet leadId={id} onClose={() => setSheet("")} onSaved={() => { load(true); setTab("sales"); }} />}

      {sheet === "task" && <TaskSheet leadId={id} onClose={() => setSheet("")} onSaved={() => load(true)} />}
      {sheet === "note" && <NoteSheet onClose={() => setSheet("")} onSave={async (n) => { const ok = await patch({ note: n }); if (ok) setSheet(""); }} />}
      {sheet === "stage" && (
        <BottomSheet title={L.stage} onClose={() => setSheet("")}>
          <div className="flex flex-wrap gap-2">{STAGES.map((s) => <Chip key={s.key} on={l.status === s.key || (s.key === "converted" && l.status === "won")} tone={s.key === "converted" ? "good" : s.key === "lost" ? "danger" : "brand"} onClick={async () => { const ok = await patch({ status: s.key }); if (ok) setSheet(s.key === "converted" ? "sale" : ""); }}>{STAGE_LABEL[s.key][L.lang]}</Chip>)}</div>
          <p className="mt-3 text-[11px] text-muted">{L.convertedHint}</p>
        </BottomSheet>
      )}
    </div>
  );
}

function NoteSheet({ onClose, onSave }: { onClose: () => void; onSave: (n: string) => Promise<void> }) {
  const { L } = useShell();
  const [n, setN] = useState(""); const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false);
  const speak = () => {
    const W = window as unknown as { webkitSpeechRecognition?: new () => { lang: string; onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null; onend: (() => void) | null; start: () => void } };
    const R = W.webkitSpeechRecognition; if (!R) return; const r = new R(); r.lang = L.hi ? "hi-IN" : "en-IN"; r.onresult = (e) => setN((x) => `${x ? x + " " : ""}${e.results[0][0].transcript}`); r.onend = () => setListening(false); setListening(true); r.start();
  };
  return (
    <BottomSheet title={L.note} onClose={onClose}>
      <textarea value={n} onChange={(e) => setN(e.target.value.slice(0, 500))} rows={4} autoFocus className={inputCls} placeholder={L.callNotePh} />
      <div className="mt-2 flex gap-2">
        {typeof window !== "undefined" && "webkitSpeechRecognition" in window && <button type="button" onClick={speak} className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs ${listening ? "border-danger text-danger" : "border-border text-muted"}`}><Mic className="h-4 w-4" />{listening ? L.listening : L.speak}</button>}
        <button type="button" disabled={!n.trim() || busy} onClick={async () => { setBusy(true); await onSave(n.trim()); setBusy(false); }} className="grad-brand flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50">{L.save}</button>
      </div>
    </BottomSheet>
  );
}

function Activity({ items, openTasks, onChanged }: { items: TimelineItem[]; openTasks: Task[]; onChanged: () => void }) {
  const { L } = useShell();
  const [f, setF] = useState<"all" | "call" | "message" | "task" | "event">("all");
  const shown = items.filter((x) => f === "all" || (f === "task" ? x.kind === "task" || x.kind === "task_done" : x.kind === f));
  return (
    <div className="space-y-2">
      {openTasks.length > 1 && <div className="space-y-1.5"><p className="text-[11px] font-semibold text-muted">{L.openTasks}</p>{openTasks.slice(1).map((t) => <TaskRow key={t.id} task={t} onChanged={onChanged} />)}</div>}
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">{([["all", L.tlAll], ["call", L.tlCalls], ["message", L.tlChats], ["task", L.tlTasks], ["event", L.tlNotes]] as const).map(([k, t]) => <Chip key={k} on={f === k} onClick={() => setF(k)}>{t}</Chip>)}</div>
      {shown.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">{L.noActivity}</p> : (
        <ul className="space-y-1.5 border-l border-border pl-3 text-xs">
          {shown.map((x) => (
            <li key={x.id} className="relative">
              <span className={`absolute -left-[15px] top-1.5 h-2 w-2 rounded-full ${x.kind === "call" ? "bg-brand" : x.kind === "message" ? "bg-good" : x.kind === "task" || x.kind === "task_done" ? "bg-lead" : "bg-border"}`} />
              <p className="text-ink">{x.icon} {x.kind === "call" ? (OUTCOME_LABEL[x.text]?.[L.lang] ?? x.text) : x.kind === "message" ? L.messages(parseInt(x.text, 10) || 0) : x.text}{x.kind === "task" && x.data?.due_at ? ` · ${fmtWhen(String(x.data.due_at), L.hi)}` : ""}</p>
              {x.sub && x.kind !== "task" && <p className="text-muted">{x.sub}</p>}
              {x.kind === "call" && typeof x.data?.recording_url === "string" && x.data.recording_url && <audio controls src={x.data.recording_url} className="mt-1 h-8 w-full" />}
              <p className="text-[10px] text-faint">{ago(x.at, L.hi)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Details({ lead, onSave }: { lead: LeadPro; onSave: (p: Record<string, unknown>) => Promise<boolean> }) {
  const { L } = useShell();
  const [f, setF] = useState({ name: lead.name, alt_phone: lead.alt_phone ?? "", business: lead.business ?? "", city: lead.city, address: lead.address ?? "", pincode: lead.pincode ?? "", email: lead.email ?? "", birthday: lead.birthday ?? "", anniversary: lead.anniversary ?? "", lang: lead.lang ?? "", budget: lead.budget_paise ? String(lead.budget_paise / 100) : "", value: lead.value_paise ? String(lead.value_paise / 100) : "", tags: lead.tags ?? [], notes: lead.notes, lost_reason: lead.lost_reason, opted_out: !!lead.opted_out });
  const [tag, setTag] = useState(""); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const addTag = () => { const t = tag.trim().replace(/^#/, "").slice(0, 24); if (t && !f.tags.includes(t)) setF({ ...f, tags: [...f.tags, t] }); setTag(""); };
  async function save() {
    setBusy(true); setOk(false);
    const done = await onSave({ name: f.name, alt_phone: f.alt_phone, business: f.business, city: f.city, address: f.address, pincode: f.pincode, email: f.email, birthday: f.birthday || null, anniversary: f.anniversary || null, lang: f.lang, budget_paise: Math.round((parseFloat(f.budget) || 0) * 100), value_paise: Math.round((parseFloat(f.value) || 0) * 100), tags: f.tags, notes: f.notes, lost_reason: f.lost_reason, opted_out: f.opted_out });
    setBusy(false); setOk(done);
  }
  const row = (k: keyof typeof f, label: string, type = "text", ph?: string) => <label className="text-xs text-muted">{label}<input type={type} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} className={inputCls} /></label>;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">{row("name", L.name)}{row("business", L.business)}</div>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted">{L.phone}<input value={lead.phone} readOnly className={inputCls + " opacity-70"} /></label>{row("alt_phone", L.altPhone, "tel")}</div>
      <div className="grid grid-cols-2 gap-2">{row("city", L.city)}{row("pincode", L.pincode)}</div>
      {row("address", L.address)}
      <div className="grid grid-cols-2 gap-2">{row("email", L.email, "email")}<label className="text-xs text-muted">{L.langPref}<select value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })} className={inputCls}><option value="">—</option><option value="hi">हिंदी</option><option value="en">English</option></select></label></div>
      <div className="grid grid-cols-2 gap-2">{row("birthday", L.birthday, "date")}{row("anniversary", L.anniversary, "date")}</div>
      <div className="grid grid-cols-2 gap-2">{row("budget", L.budget, "text", "25000")}{row("value", L.dealValue, "text", "45000")}</div>
      <div>
        <div className="mb-1 text-xs text-muted">{L.tags}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {f.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-ink">#{t}<button type="button" onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })} aria-label="x">✕</button></span>)}
          <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} onBlur={addTag} placeholder={L.addTag} className="min-w-24 flex-1 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-xs outline-none" />
        </div>
      </div>
      {lead.status === "lost" && row("lost_reason", L.lostReason)}
      <label className="block text-xs text-muted">{L.notes}<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} placeholder={L.notesPh} className={inputCls} /></label>
      <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={f.opted_out} onChange={(e) => setF({ ...f, opted_out: e.target.checked })} /> {L.optOut}</label>
      <p className="text-[11px] text-faint">{L.source}: {lead.source} · {L.scoreHint} {lead.score}/100 · {ago(lead.created_at, L.hi)}{lead.calls_count ? ` · ${lead.calls_count} ${L.callsReport.toLowerCase()}` : ""}{lead.next_follow_up && isPast(lead.next_follow_up) ? ` · ⏰ ${L.overdueTag}` : ""}{lead.value_paise ? ` · ${rupees(lead.value_paise)}` : ""}</p>
      <button type="button" disabled={busy} onClick={save} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null} {ok ? L.saved : L.save}</button>
      <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-good"><ExternalLink className="h-3.5 w-3.5" /> {L.openWa}</a>
    </div>
  );
}
