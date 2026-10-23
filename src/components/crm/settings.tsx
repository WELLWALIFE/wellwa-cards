"use client";
// Settings (docs/crm-pro.md 6, 3.13): calling behaviour + the existing sheets (quick replies, team, menu bot,
// integrations, import, export). Reports = the existing analytics sheet, inline, plus a calls line.
import { useEffect, useState } from "react";
import { Zap, Users, GitBranch, Plug, Upload, Download, UserCheck, LoaderCircle, Check, PhoneCall } from "lucide-react";
import { api } from "@/lib/poster-client";
import { Templates, TeamSheet, ImportSheet, FlowSheet, IntegrationsSheet, AnalyticsSheet } from "@/components/crm/crm";
import { useShell, inputCls, Chip, type Prefs } from "@/components/crm/shared";
import { DuplicatesSheet, ContactsImport, Leaderboard } from "@/components/crm/sales";

export function SettingsSection({ onChanged }: { onChanged: () => void }) {
  const { L, ws, ctx, as } = useShell();
  const [sheet, setSheet] = useState<"" | "tpl" | "team" | "import" | "flow" | "integrations" | "dups">("");
  const [p, setP] = useState<Prefs>(ws.prefs);
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [err, setErr] = useState("");
  const owner = ctx.role === "owner";
  async function save() {
    setBusy(true); setOk(false); setErr("");
    const r = await api<{ prefs: Prefs; error?: string }>("/api/crm/automations", { method: "PUT", json: { ...p, sales_target_k: undefined } });   // the target is set on Reports
    setBusy(false); if (!r.ok) { setErr(r.data.error || L.failed); return; } setP(r.data.prefs); setOk(true); onChanged();
  }
  async function exportCsv() {
    const rows = [["Name", "Phone", "City", "Business", "Stage", "Kind", "Tags", "Score", "Value", "Follow-up", "Source", "Calls", "Last activity", "Notes", "Created"]];
    for (let page = 0; page < 40; page += 1) {
      const r = await api<{ leads: Record<string, unknown>[]; more: boolean }>(`/api/crm/leads?page=${page}${as ? `&as=${as}` : ""}`);
      if (!r.ok) break;
      for (const l of r.data.leads) rows.push([l.name, l.phone, l.city, l.business, l.status, l.kind, (l.tags as string[] ?? []).join(" "), l.score, Number(l.value_paise ?? 0) / 100, l.next_follow_up ?? "", l.source, l.calls_count, l.last_activity_at, l.notes, l.created_at].map((v) => String(v ?? "")));
      if (!r.data.more) break;
    }
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }
  const btn = (I: typeof Zap, t: string, f: () => void) => <button key={t} type="button" onClick={f} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-ink"><I className="h-4 w-4 text-brand" />{t}</button>;
  return (
    <div className="space-y-4">
      {ctx.role !== "agent" && <PersonalNumbers />}
      {owner && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 text-sm">
          <h3 className="flex items-center gap-1.5 font-bold text-ink"><PhoneCall className="h-4 w-4 text-brand" /> {L.stCalling}</h3>
          <label className="flex items-center justify-between gap-3 text-xs text-ink">{L.stAskOutcome}<input type="checkbox" checked={p.ask_outcome} onChange={(e) => setP({ ...p, ask_outcome: e.target.checked })} /></label>
          <label className="block text-xs text-ink">{L.stRetry}<input type="number" min={15} max={1440} value={p.retry_after_min} onChange={(e) => setP({ ...p, retry_after_min: Math.max(15, parseInt(e.target.value || "180", 10)) })} className={inputCls + " mt-1 w-28"} /></label>
          <label className="flex items-center justify-between gap-3 text-xs text-ink">{L.stMissedWa}<input type="checkbox" checked={p.missed_call_wa} onChange={(e) => setP({ ...p, missed_call_wa: e.target.checked })} /></label>
          {p.missed_call_wa && <textarea value={p.missed_call_text} onChange={(e) => setP({ ...p, missed_call_text: e.target.value.slice(0, 1000) })} rows={3} className={inputCls} />}
          <label className="block text-xs text-ink">{L.stTarget}<input type="number" min={0} max={500} value={p.call_target} onChange={(e) => setP({ ...p, call_target: Math.max(0, parseInt(e.target.value || "0", 10)) })} className={inputCls + " mt-1 w-28"} /></label>
          {err && <p className="text-xs text-danger">{err}</p>}
          <button type="button" disabled={busy} onClick={save} className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null} {ok ? L.saved : L.save}</button>
        </section>
      )}
      {owner && (
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 text-sm">
          <h3 className="font-bold text-ink">⚙️ {L.stAutomations}</h3>
          {([
            ["auto_task_new_lead", L.hi ? "नया lead आते ही \"10 मिनट में call\" task बने" : "New lead → a \"call within 10 min\" task"],
            ["round_robin", L.hi ? "नए lead agents में बारी-बारी बँटें (round-robin)" : "New leads go to agents in turn (round-robin)"],
            ["daily_summary", L.hi ? "रोज़ रात 8 बजे WhatsApp पर दिन की summary" : "Daily summary at 8 pm on WhatsApp"],
            ["birthday_wish", L.hi ? "जन्मदिन / सालगिरह पर ग्राहक को शुभकामना (आपके नंबर से)" : "Birthday / anniversary wish to the customer (from your number)"],
          ] as const).map(([k, t]) => <label key={k} className="flex items-center justify-between gap-3 text-xs text-ink">{t}<input type="checkbox" checked={!!p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} /></label>)}
          <label className="block text-xs text-ink">{L.hi ? "इतने दिन चुप रहे तो \"ठंडा पड़ रहा\" याद दिलाएँ (0 = नहीं)" : "Nudge me when a lead is quiet for (days, 0 = off)"}<input type="number" min={0} max={60} value={p.stale_days} onChange={(e) => setP({ ...p, stale_days: Math.max(0, parseInt(e.target.value || "0", 10)) })} className={inputCls + " mt-1 w-28"} /></label>
          <button type="button" disabled={busy} onClick={save} className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : ok ? <Check className="h-4 w-4" /> : null} {ok ? L.saved : L.save}</button>
          <p className="text-[11px] text-muted">{L.hi ? "Review माँगना और त्योहार की शुभकामनाएँ Social → Reviews / Customers tools में हैं।" : "Review ask and festival wishes live under Social → Reviews / customer tools."}</p>
        </section>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {btn(Zap, L.stTemplates, () => setSheet("tpl"))}
        {owner && btn(Users, L.stTeam, () => setSheet("team"))}
        {owner && btn(GitBranch, L.stBot, () => setSheet("flow"))}
        {owner && btn(Plug, L.stIntegrations, () => setSheet("integrations"))}
        {ctx.role !== "agent" && btn(Upload, L.stImport, () => setSheet("import"))}
        {ctx.role !== "agent" && btn(Users, L.hi ? "एक ही ग्राहक दो बार — मिलाएँ" : "Duplicate customers — merge", () => setSheet("dups"))}
        {btn(Download, L.stExport, exportCsv)}
        {!as && !owner && btn(UserCheck, L.stJoin, () => setSheet("team"))}
        {!as && owner && btn(UserCheck, L.stJoin, () => setSheet("team"))}
      </div>
      {sheet === "tpl" && <Templates ctx={ctx} onClose={() => setSheet("")} />}
      {sheet === "team" && <TeamSheet ctx={ctx} onClose={() => setSheet("")} onChanged={onChanged} />}
      {sheet === "import" && <ImportSheet ctx={ctx} onClose={() => setSheet("")} onDone={() => { setSheet(""); onChanged(); }} />}
      {sheet === "flow" && <FlowSheet onClose={() => setSheet("")} />}
      {sheet === "integrations" && <IntegrationsSheet onClose={() => setSheet("")} />}
      {sheet === "dups" && <DuplicatesSheet onClose={() => setSheet("")} onChanged={onChanged} />}
      <ContactsImport onDone={onChanged} />
    </div>
  );
}

export function ReportsSection() {
  const { L, ctx, as } = useShell();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [r, setR] = useState<Rep | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let dead = false;   // switching 7 / 30 / 90 quickly: only the last answer counts
    setR(null); setErr("");
    api<Rep & { error?: string }>(`/api/crm/reports?days=${days}${as ? `&as=${as}` : ""}`).then((x) => { if (dead) return; if (x.ok) setR(x.data); else setErr(x.data.error || L.failed); }).catch(() => { if (!dead) setErr(L.failed); });
    return () => { dead = true; };
  }, [days, as, retry, L.failed]);
  const agentName = (id: string) => (id === ctx.me ? (L.hi ? "मैं" : "me") : ctx.agents.find((a) => a.id === id)?.name ?? (L.hi ? "मालिक" : "owner"));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const kpi = (l: string, v: string | number, s?: string) => <div key={l} className="rounded-xl border border-border bg-surface p-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{l}</div><div className="text-lg font-bold text-ink">{v}</div>{s && <div className="text-[10px] text-faint">{s}</div>}</div>;
  const maxDay = Math.max(1, ...(r?.calls.byDay.map((d) => d.made) ?? [1]));
  return (
    <div className="space-y-3">
      <TargetCard agentName={agentName} />
      <div className="flex gap-1.5">{([7, 30, 90] as const).map((d) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{d} {L.hi ? "दिन" : "days"}</Chip>)}</div>
      {err ? <div className="space-y-2 py-6 text-center"><p className="text-xs text-danger">{err}</p><button type="button" onClick={() => setRetry((n) => n + 1)} className="rounded-xl border border-border px-3 py-1.5 text-xs">↻</button></div>
        : !r ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {kpi(`${L.callsReport} · ${L.callsMade}`, r.calls.made, `${r.calls.connected} ${L.callsConnected}`)}
            {kpi(L.callsConnected, r.calls.made ? `${Math.round((r.calls.connected / r.calls.made) * 100)}%` : "—", r.calls.avgSeconds ? `${L.avgDuration} ${mmss(r.calls.avgSeconds)}` : "")}
            {kpi(L.hi ? "Follow-up समय पर" : "Follow-ups on time", r.tasks.done ? `${Math.round((r.tasks.onTime / r.tasks.done) * 100)}%` : "—", `${r.tasks.done} ${L.doneTasks.toLowerCase()} · ${r.tasks.overdueOpen} ${L.overdueTag}`)}
            {kpi(L.hi ? "नए lead" : "New leads", r.leads.newInRange, `${r.leads.total} ${L.hi ? "कुल" : "total"}`)}
            {kpi(L.won, r.leads.wonInRange, r.leads.wonValue ? `₹${(r.leads.wonValue / 100).toLocaleString("en-IN")}` : "")}
            {kpi(L.hi ? "7 दिन से चुप" : "Quiet 7+ days", r.leads.idle7, `${r.leads.customers} ${L.customer.toLowerCase()}`)}
          </div>
          {r.calls.byDay.length > 1 && (
            <div className="rounded-xl border border-border bg-surface p-2.5">
              <div className="mb-1 text-xs font-semibold text-muted">{L.callsReport}</div>
              <div className="flex h-20 items-end gap-px">{r.calls.byDay.map((d) => <div key={d.day} className="flex flex-1 flex-col justify-end" title={`${d.day}: ${d.made} / ${d.connected}`}><div className="w-full rounded-t-sm bg-brand/30" style={{ height: `${(d.made / maxDay) * 72}px` }}><div className="w-full rounded-t-sm bg-brand" style={{ height: `${d.made ? (d.connected / d.made) * 100 : 0}%` }} /></div></div>)}</div>
              <div className="mt-1 flex justify-between text-[10px] text-faint"><span>{r.calls.byDay[0].day.slice(5)}</span><span>{L.today}</span></div>
            </div>
          )}
          {r.calls.byAgent.length > 1 && (
            <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase text-faint"><th className="py-1">{L.hi ? "कौन" : "Who"}</th><th>{L.callsMade}</th><th>{L.callsConnected}</th><th>{L.avgDuration}</th></tr></thead>
              <tbody>{r.calls.byAgent.map((a) => <tr key={a.id} className="border-t border-border"><td className="py-1.5 font-semibold text-ink">{agentName(a.id)}</td><td>{a.made}</td><td>{a.connected}</td><td>{a.connected ? mmss(Math.round(a.seconds / a.connected)) : "—"}</td></tr>)}</tbody></table>
          )}
          <div className="rounded-xl border border-border bg-surface p-2.5">
            <div className="mb-1 text-xs font-semibold text-muted">{L.hi ? "कहाँ से आए, कितने बिके" : "By source"}</div>
            {r.bySource.map((s) => <div key={s.source} className="flex items-center gap-2 py-0.5 text-xs"><span className="w-24 truncate text-ink">{s.source}</span><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand/70" style={{ width: `${(s.leads / Math.max(1, r.bySource[0].leads)) * 100}%` }} /></div><span className="w-20 text-right text-muted">{s.leads} · <b className="text-good">{s.won}</b></span></div>)}
          </div>
          <Leaderboard days={days} />
          {r.lost.length > 0 && <div className="rounded-xl border border-border bg-surface p-2.5"><div className="mb-1 text-xs font-semibold text-muted">{L.lostReason}</div><div className="flex flex-wrap gap-1.5 text-xs">{r.lost.map((x) => <span key={x.reason} className="rounded-full border border-border px-2 py-0.5"><b className="text-ink">{x.count}</b> <span className="text-muted">{x.reason}</span></span>)}</div></div>}
          {ctx.role !== "agent" && <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-border px-3 py-2 text-xs text-muted">{L.hi ? "WhatsApp / reply-time analytics (30 दिन)" : "WhatsApp / reply-time analytics (30 days)"}</button>}
          {open && ctx.role !== "agent" && <AnalyticsSheet ctx={ctx} onClose={() => setOpen(false)} />}
        </>
      )}
    </div>
  );
}
type Rep = { days: number; calls: { made: number; connected: number; avgSeconds: number; byDay: { day: string; made: number; connected: number }[]; byAgent: { id: string; made: number; connected: number; seconds: number }[]; outcomes: { outcome: string; count: number }[] }; tasks: { done: number; onTime: number; overdueOpen: number; openTotal: number }; bySource: { source: string; leads: number; won: number; value: number }[]; lost: { reason: string; count: number }[]; stages: { stage: string; count: number; value: number }[]; leads: { total: number; newInRange: number; wonInRange: number; wonValue: number; customers: number; idle7: number } };

/** Personal numbers (lib/crm-block.ts): never in the CRM, never answered by the AI. Add one by number, or bring one back. */
function PersonalNumbers() {
  const { L, as, reload } = useShell();
  const T = (en: string, hi: string) => (L.hi ? hi : en);
  const [nums, setNums] = useState<string[] | null>(null);
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const qs = as ? `?as=${as}` : "";
  async function load() { const r = await api<{ numbers: string[] }>(`/api/crm/block${qs}`).catch(() => null); setNums(r?.ok ? r.data.numbers : []); }
  useEffect(() => { if (open && nums === null) void load(); });
  async function block() {
    const d = add.replace(/\D/g, "").slice(-10);
    if (d.length !== 10) { setErr(T("Enter a 10-digit mobile number.", "10 अंकों का mobile number डालें।")); return; }
    setBusy("add"); setErr("");
    const r = await api<{ error?: string }>("/api/crm/block", { method: "POST", json: { phone: d, as: as ?? undefined } }).catch(() => null);
    setBusy(""); if (!r?.ok) { setErr(r?.data.error || L.failed); return; }
    setAdd(""); reload(); void load();
  }
  async function unblock(n: string) {
    setBusy(n); setErr("");
    const r = await api<{ error?: string }>(`/api/crm/block?phone=${n}${as ? `&as=${as}` : ""}`, { method: "DELETE" }).catch(() => null);
    setBusy(""); if (!r?.ok) { setErr(r?.data.error || L.failed); return; }
    void load();
  }
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left font-bold text-ink">🚫 {T("Personal numbers (not in CRM, no AI)", "Personal numbers (CRM में नहीं, AI बंद)")}<span className="text-xs text-muted">{open ? "▲" : "▼"}</span></button>
      {open && (
        <>
          <p className="text-[11px] text-muted">{T("Family and friends: never saved in the CRM and the AI never replies to them on WhatsApp.", "परिवार और दोस्त: CRM में कभी save नहीं होंगे और WhatsApp पर AI इन्हें कभी जवाब नहीं देगा।")}</p>
          <div className="flex gap-2">
            <input value={add} onChange={(e) => setAdd(e.target.value.slice(0, 20))} inputMode="tel" placeholder={T("Mobile number", "Mobile number")} className={inputCls} />
            <button type="button" disabled={busy === "add"} onClick={() => void block()} className="shrink-0 rounded-xl bg-danger px-3 text-xs font-semibold text-white disabled:opacity-60">{busy === "add" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : T("Add", "जोड़ें")}</button>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          {nums === null ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" />
            : nums.length === 0 ? <p className="text-xs text-muted">{T("None yet.", "अभी कोई नहीं।")}</p>
            : <ul className="divide-y divide-border rounded-xl border border-border">{nums.map((n) => (
                <li key={n} className="flex items-center justify-between px-3 py-2"><span className="font-mono text-xs text-ink">+91 {n.slice(0, 5)} {n.slice(5)}</span>
                  <button type="button" disabled={busy === n} onClick={() => void unblock(n)} className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-ink disabled:opacity-60">{busy === n ? "…" : T("Bring back", "वापस लाएँ")}</button></li>
              ))}</ul>}
        </>
      )}
    </section>
  );
}

/** This month: sales against the target, per person, and the expected sales in the pipeline (owner, 23 Oct 2026). */
type Targets = { month: string; target_paise: number; sold_paise: number; sales: number; byAgent: { id: string; sold_paise: number; sales: number }[]; pipeline: { paise: number; leads: number } };
function TargetCard({ agentName }: { agentName: (id: string) => string }) {
  const { L, ctx, as } = useShell();
  const T = (en: string, hi: string) => (L.hi ? hi : en);
  const [t, setT] = useState<Targets | null>(null);
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => { api<Targets>(`/api/crm/targets${as ? `?as=${as}` : ""}`).then((r) => { if (r.ok) setT(r.data); }).catch(() => undefined); }, [as, tick]);
  if (!t) return null;
  const rs = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");
  const pct = t.target_paise ? Math.min(100, Math.round((t.sold_paise / t.target_paise) * 100)) : 0;
  async function save() {
    const k = Math.round((parseFloat(val.replace(/[^\d.]/g, "")) || 0) / 1000);
    setBusy(true); setErr("");
    const r = await api<{ error?: string }>("/api/crm/automations", { method: "PUT", json: { sales_target_k: k } }).catch(() => null);
    setBusy(false); if (!r?.ok) { setErr(L.failed); return; }
    setEdit(false); setTick((n) => n + 1);
  }
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink">🎯 {T("This month's sales", "इस महीने की बिक्री")}</h3>
        {ctx.role === "owner" && <button type="button" onClick={() => { setEdit((v) => !v); setVal(t.target_paise ? String(t.target_paise / 100) : ""); }} className="text-xs font-semibold text-brand-ink">{t.target_paise ? T("Change target", "Target बदलें") : T("Set target", "Target लगाएँ")}</button>}
      </div>
      <p className="text-xl font-bold text-ink">{rs(t.sold_paise)}{t.target_paise > 0 && <span className="text-sm font-semibold text-muted"> / {rs(t.target_paise)}</span>} <span className="text-xs font-normal text-muted">· {t.sales} {T("sales", "बिक्री")}</span></p>
      {t.target_paise > 0 && (
        <div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-[11px] text-muted">{pct}% {T("of the target", "target का")}{t.sold_paise < t.target_paise ? ` · ${T("left", "बाकी")} ${rs(t.target_paise - t.sold_paise)}` : " 🎉"}</p>
        </div>
      )}
      {edit && (
        <div className="flex gap-2">
          <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" placeholder={T("Monthly target ₹, e.g. 500000", "महीने का target ₹, जैसे 500000")} className={inputCls} />
          <button type="button" disabled={busy} onClick={() => void save()} className="grad-brand shrink-0 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? "…" : L.save}</button>
        </div>
      )}
      {err && <p className="text-xs text-danger">{err}</p>}
      <p className="rounded-xl bg-brand-soft/40 px-3 py-2 text-xs text-ink">{T("Expected (interested + follow-up):", "उम्मीद (रुचि + follow-up वाले):")} <b>{rs(t.pipeline.paise)}</b> · {t.pipeline.leads} {T("customers", "ग्राहक")}{t.pipeline.paise === 0 && t.pipeline.leads > 0 ? ` — ${T("add a deal value on their Details to see it", "Details में deal की कीमत डालें तो दिखेगा")}` : ""}</p>
      {t.byAgent.length > 1 && (
        <ul className="space-y-1 text-xs">{t.byAgent.map((a) => <li key={a.id} className="flex justify-between"><span className="text-ink">{agentName(a.id)}</span><span className="font-semibold text-ink">{rs(a.sold_paise)} · {a.sales}</span></li>)}</ul>
      )}
    </section>
  );
}
