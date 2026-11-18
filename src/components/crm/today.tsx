"use client";
// Today (docs/crm-pro.md 3.1): what to do now — overdue, due today, unread, fresh untouched leads, today's bookings,
// call-backs, leads going cold. Every row: Call · WhatsApp · Done. "Start calling" walks the due ones (CallList).
import { useCallback, useEffect, useState } from "react";
import { Phone, MessageCircle, Check, LoaderCircle, PhoneCall, ChevronDown } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useShell, waLink, telLink, Avatar, StagePill, fmtTime, fmtWhen, ago, type LeadPro, type Task, waClick, Stars, starsOf, previewOf, tempOf, TempPill } from "@/components/crm/shared";
import type { CallListItem } from "@/components/crm/call";
import { OUTCOME_LABEL } from "@/components/crm/i18n";

type Item = { lead: LeadPro; task?: Task; booking?: { id: string; service: string; starts_at: string }; why: string };
type Today = { overdue: Item[]; due: Item[]; unread: Item[]; fresh: Item[]; bookings: Item[]; callbacks: Item[]; cold: Item[]; counts: { due: number; unread: number; fresh: number; hot: number; calledToday: number; target: number } };

export function TodayScreen({ onCallList, firstName }: { onCallList: (items: CallListItem[]) => void; firstName: string }) {
  const { L, as, openCustomer, startCall, version, reload } = useShell();
  const [d, setD] = useState<Today | null>(null);
  const [readBusy, setReadBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** The moment of the last load (refreshed every 30 s): what counts as "its time has come". */
  const [nowMs, setNowMs] = useState(0);
  const load = useCallback(async () => {
    const r = await api<Today & { error?: string }>(`/api/crm/today?x=1${as ? `&as=${as}` : ""}`).catch(() => null);
    if (!r?.ok) { setNowMs(Date.now()); setErr(r?.data.error || L.failed); setD((x) => x ?? { overdue: [], due: [], unread: [], fresh: [], bookings: [], callbacks: [], cold: [], counts: { due: 0, unread: 0, fresh: 0, hot: 0, calledToday: 0, target: 0 } }); return; }
    setErr(""); setD(r.data); setNowMs(Date.now());
  }, [as, L.failed]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load, version]);
  if (!d) return <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  // The call list, in a fixed order (owner, 23 Oct 2026: "har baar 1st number hi aata hai, jabki uska time abhi nahi aaya"):
  //   1. follow-ups whose time has come (the oldest first; a 6 pm one joins at 6 pm, not before),
  //   2. AI-answered calls that asked for a call back, 3. new leads nobody has called yet.
  // Visits and meetings are not calls; a customer called in the last 30 minutes waits (the call they just had counts).
  const calledJustNow = (x: Item) => !!x.lead.last_call_at && nowMs - new Date(x.lead.last_call_at).getTime() < 30 * 60_000;
  const dueNow = [...d.overdue, ...d.due].filter((x) => x.task && (x.task.kind === "call" || x.task.kind === "whatsapp" || x.task.kind === "other") && new Date(x.task.due_at).getTime() <= nowMs).sort((a, b) => (a.task!.due_at < b.task!.due_at ? -1 : 1));
  const laterToday = d.due.filter((x) => x.task && new Date(x.task.due_at).getTime() > nowMs);
  const callable: CallListItem[] = [...dueNow, ...d.callbacks, ...[...d.fresh].reverse()]
    .filter((x, i, a) => a.findIndex((y) => y.lead.id === x.lead.id) === i && x.lead.phone && !calledJustNow(x))
    .map((x) => ({ lead: x.lead, task: x.task, why: x.why }));
  // "Who first?" (owner, 18 Nov 2026): the five people worth the first calls of the day, each with the reason in words. Worked out from
  // what the CRM already knows - how late the follow-up is, hot / stars, the unread message, the deal's value, the AI's score and its
  // suggested next step - so it costs nothing and is there the moment the screen opens.
  const first = (() => {
    const seen = new Map<string, { x: Item; pts: number; why: string[] }>();
    const add = (x: Item, pts: number, why: string) => {
      if (!x.lead.phone || x.lead.id.startsWith("b-") || calledJustNow(x)) return;
      const e = seen.get(x.lead.id) ?? { x, pts: 0, why: [] as string[] };
      e.pts += pts; if (why && !e.why.includes(why)) e.why.push(why); if (x.task && !e.x.task) e.x = x;
      seen.set(x.lead.id, e);
    };
    for (const x of d.overdue) { const days = x.task ? Math.max(0, Math.floor((nowMs - new Date(x.task.due_at).getTime()) / 864e5)) : 0; add(x, 40 + Math.min(20, days * 4), days >= 1 ? (L.hi ? `follow-up ${days} दिन late` : `follow-up ${days} day${days === 1 ? "" : "s"} late`) : (L.hi ? "follow-up का समय निकल गया" : "follow-up time has passed")); }
    for (const x of dueNow) add(x, 30, L.hi ? "आज का follow-up" : "follow-up due today");
    for (const x of d.callbacks) add(x, 34, L.hi ? "call back माँगा था" : "asked for a call back");
    for (const x of d.unread) add(x, 22, L.hi ? "message का जवाब बाकी" : "message waiting for a reply");
    for (const x of d.fresh) add(x, 18, L.hi ? "नया lead, अभी call नहीं हुई" : "new lead, not called yet");
    for (const x of d.cold) add(x, 8, L.hi ? "ठंडा पड़ रहा है" : "going cold");
    for (const e of seen.values()) {
      const l = e.x.lead, t = tempOf(l), st = starsOf(l.tags);
      if (t === "hot") { e.pts += 25; e.why.push("🔥 Hot"); } else if (t === "warm") e.pts += 8;
      if (st) { e.pts += st * 5; e.why.push(`${st}⭐`); }
      if (l.value_paise > 0) { e.pts += Math.min(15, Math.log10(l.value_paise / 100 + 1) * 3); e.why.push(`₹${Math.round(l.value_paise / 100).toLocaleString("en-IN")}`); }
      e.pts += Math.min(10, (l.score ?? 0) / 10);
    }
    return [...seen.values()].sort((a, b) => b.pts - a.pts).slice(0, 5);
  })();
  const nextLater = laterToday.map((x) => x.task!.due_at).sort()[0];
  const total = d.overdue.length + d.due.length + d.unread.length + d.fresh.length + d.bookings.length + d.callbacks.length + d.cold.length;
  const date = new Date().toLocaleDateString(L.hi ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
  const preview = (l: LeadPro) => previewOf(l, L.hi, (o) => OUTCOME_LABEL[o]?.[L.lang] ?? o);
  /** Starred and hot first in a section (owner, 26 Oct 2026: "Hot / zaruri upar"). */
  const rank = (l: LeadPro) => starsOf(l.tags) * 10 + (tempOf(l) === "hot" ? 5 : tempOf(l) === "warm" ? 2 : 0);
  const sec = (k: string, title: string, items: Item[], tone?: string, render?: (x: Item) => string) => items.length === 0 ? null : (
    <section key={k} className="overflow-hidden rounded-2xl border border-border bg-surface">
      <button type="button" onClick={() => setOpen((o) => ({ ...o, [k]: !(o[k] ?? true) }))} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide ${tone ?? "text-muted"}`}>{title}<span className="rounded-full bg-surface2 px-1.5 text-[10px] text-ink">{items.length}</span><ChevronDown className={`ml-auto h-4 w-4 transition ${(open[k] ?? true) ? "" : "-rotate-90"}`} /></button>
      {(open[k] ?? true) && <ul className="divide-y divide-border">{items.map((x) => <Row key={`${k}-${x.lead.id}-${x.task?.id ?? x.booking?.id ?? ""}`} x={x} sub={render ? render(x) : x.why} onOpen={() => x.lead.id.startsWith("b-") ? null : openCustomer(x.lead.id)} onCall={() => { if (x.lead.id.startsWith("b-")) window.location.href = telLink(x.lead.phone); else startCall(x.lead, load); }} onDone={x.task ? async () => { await api("/api/crm/tasks", { method: "PATCH", json: { id: x.task!.id, as: as ?? undefined, done: true } }); load(); } : undefined} />)}</ul>}
    </section>
  );
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-muted">{date}</p>
        <h2 className="text-lg font-bold text-ink">{L.greeting(firstName)}</h2>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[{ l: L.due, v: d.counts.due, hot: d.counts.due > 0 }, { l: L.unread, v: d.counts.unread }, { l: L.fresh, v: d.counts.fresh }, { l: L.called, v: d.counts.target ? `${d.counts.calledToday}/${d.counts.target}` : d.counts.calledToday }].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-surface px-2 py-2"><div className={`text-[10px] font-semibold uppercase tracking-wide ${s.hot ? "text-lead" : "text-muted"}`}>{s.l}</div><div className="mt-0.5 text-lg font-bold leading-none text-ink">{s.v}</div></div>
        ))}
      </div>
      {callable.length > 0 && <button type="button" onClick={() => onCallList(callable)} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"><PhoneCall className="h-4 w-4" /> {L.startCalling(callable.length)}</button>}
      {first.length >= 2 && (
        <section className="overflow-hidden rounded-2xl border border-ai/30 bg-ai/5">
          <p className="px-3 pt-2 text-xs font-bold uppercase tracking-wide text-ai">✨ {L.hi ? "सबसे पहले इन्हें" : "Call these first"}</p>
          <ol className="divide-y divide-border/60">
            {first.map((e, i) => (
              <li key={e.x.lead.id} className="flex items-center gap-2 px-3 py-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ai/15 text-[11px] font-bold text-ai">{i + 1}</span>
                <button type="button" onClick={() => openCustomer(e.x.lead.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-ink">{e.x.lead.name || e.x.lead.phone}</p>
                  <p className="truncate text-[11px] text-muted">{e.why.slice(0, 4).join(" · ")}</p>
                  {e.x.lead.ai_next && <p className="truncate text-[11px] text-ai">→ {e.x.lead.ai_next}</p>}
                </button>
                <button type="button" onClick={() => startCall(e.x.lead, load)} className="rounded-lg bg-brand-soft p-2 text-brand-ink" aria-label={L.call}><Phone className="h-4 w-4" /></button>
              </li>
            ))}
          </ol>
        </section>
      )}
      {laterToday.length > 0 && nextLater && <p className="text-center text-[11px] text-muted">{L.hi ? `⏳ आज बाद में ${laterToday.length} call — अपने समय पर list में आएँगे (अगली ${fmtTime(nextLater, true)} बजे)` : `⏳ ${laterToday.length} more call${laterToday.length === 1 ? "" : "s"} later today — they join the list at their time (next at ${fmtTime(nextLater, false)})`}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
      {total === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">{L.allClear}</p>}
      {sec("overdue", L.overdue, d.overdue, "text-danger", (x) => `${x.task?.title || x.why} · ${fmtWhen(x.task!.due_at, L.hi)}`)}
      {sec("due", L.dueToday, d.due, "text-lead", (x) => `${x.task?.title || x.why} · ${fmtTime(x.task!.due_at, L.hi)}`)}
      {d.unread.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-muted">
          <span>{L.hi ? "⭐ स्टार और 🔥 Hot वाले ऊपर" : "⭐ Starred and 🔥 Hot first"}</span>
          <button type="button" disabled={readBusy} onClick={async () => { setReadBusy(true); try { const r = await api("/api/crm/read-all", { method: "POST", json: { as: as ?? undefined } }); if (r.ok) reload(); } finally { setReadBusy(false); } }}
            className="rounded-full border border-border bg-surface px-2.5 py-1 font-semibold text-ink disabled:opacity-50">✓ {L.hi ? "सब पढ़ा हुआ करें" : "Mark all read"}</button>
        </div>
      )}
      {sec("unread", L.unreadChats, [...d.unread].sort((a, b) => rank(b.lead) - rank(a.lead)), undefined, (x) => preview(x.lead))}
      {sec("fresh", L.freshLeads, d.fresh, undefined, (x) => `${preview(x.lead)} · ${ago(x.lead.created_at, L.hi)}`)}
      {sec("bookings", L.todaysBookings, d.bookings, undefined, (x) => `${x.booking?.service || ""} · ${x.booking ? fmtTime(x.booking.starts_at, L.hi) : ""}`)}
      {sec("callbacks", L.callbacks, d.callbacks, undefined)}
      {sec("cold", L.goingCold, d.cold, undefined, (x) => `${preview(x.lead)} · ${ago(x.lead.last_activity_at, L.hi)}`)}
    </div>
  );
}

function Row({ x, sub, onOpen, onCall, onDone }: { x: Item; sub: string; onOpen: () => void; onCall: () => void; onDone?: () => Promise<void> }) {
  const { L } = useShell();
  const [busy, setBusy] = useState(false);
  const l = x.lead;
  return (
    <li className="flex items-center gap-2 px-2.5 py-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <Avatar name={l.name} phone={l.phone} size={9} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{l.name || l.phone}{l.unread > 0 && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{l.unread}</span>}</p>
          <p className="truncate text-[11px] text-muted">{sub}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5"><StagePill status={l.status} hi={L.hi} /><TempPill temp={tempOf(l)} hi={L.hi} />{starsOf(l.tags) > 0 && <Stars value={starsOf(l.tags)} size={11} />}<span className="text-[10px] text-faint">📞 {l.last_call_at ? ago(l.last_call_at, L.hi) : (L.hi ? "call नहीं की" : "not called")}</span></div>
        </div>
      </button>
      {l.phone && <button type="button" onClick={onCall} className="rounded-lg bg-brand-soft p-2 text-brand-ink" aria-label={L.call}><Phone className="h-4 w-4" /></button>}
      {l.phone && <a href={waLink(l.phone)} onClick={waClick(l.phone)} target="_blank" rel="noreferrer" className="rounded-lg bg-good/10 p-2 text-good" aria-label={L.whatsapp}><MessageCircle className="h-4 w-4" /></a>}
      {onDone && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onDone(); } finally { setBusy(false); } }} className="rounded-lg border border-border p-2 text-muted" aria-label={L.done}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>}
    </li>
  );
}
