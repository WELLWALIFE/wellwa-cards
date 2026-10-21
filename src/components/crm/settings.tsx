"use client";
// Settings (docs/crm-pro.md 6, 3.13): calling behaviour + the existing sheets (quick replies, team, menu bot,
// integrations, import, export). Reports = the existing analytics sheet, inline, plus a calls line.
import { useEffect, useState } from "react";
import { Zap, Users, GitBranch, Plug, Upload, Download, UserCheck, LoaderCircle, Check, PhoneCall } from "lucide-react";
import { api } from "@/lib/poster-client";
import { Templates, TeamSheet, ImportSheet, FlowSheet, IntegrationsSheet, AnalyticsSheet } from "@/components/crm/crm";
import { useShell, inputCls, type Prefs, type Call } from "@/components/crm/shared";

export function SettingsSection({ onChanged }: { onChanged: () => void }) {
  const { L, ws, ctx, as } = useShell();
  const [sheet, setSheet] = useState<"" | "tpl" | "team" | "import" | "flow" | "integrations">("");
  const [p, setP] = useState<Prefs>(ws.prefs);
  const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false); const [err, setErr] = useState("");
  const owner = ctx.role === "owner";
  async function save() {
    setBusy(true); setOk(false); setErr("");
    const r = await api<{ prefs: Prefs; error?: string }>("/api/crm/automations", { method: "PUT", json: p });
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
  const Btn = ({ I, t, f }: { I: typeof Zap; t: string; f: () => void }) => <button type="button" onClick={f} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-ink"><I className="h-4 w-4 text-brand" />{t}</button>;
  return (
    <div className="space-y-4">
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
          <p className="text-[11px] text-muted">{L.stAutoSoon}</p>
        </section>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Btn I={Zap} t={L.stTemplates} f={() => setSheet("tpl")} />
        {owner && <Btn I={Users} t={L.stTeam} f={() => setSheet("team")} />}
        {owner && <Btn I={GitBranch} t={L.stBot} f={() => setSheet("flow")} />}
        {owner && <Btn I={Plug} t={L.stIntegrations} f={() => setSheet("integrations")} />}
        {ctx.role !== "agent" && <Btn I={Upload} t={L.stImport} f={() => setSheet("import")} />}
        <Btn I={Download} t={L.stExport} f={exportCsv} />
        {!as && !owner && <Btn I={UserCheck} t={L.stJoin} f={() => setSheet("team")} />}
        {!as && owner && <Btn I={UserCheck} t={L.stJoin} f={() => setSheet("team")} />}
      </div>
      {sheet === "tpl" && <Templates ctx={ctx} onClose={() => setSheet("")} />}
      {sheet === "team" && <TeamSheet ctx={ctx} onClose={() => setSheet("")} onChanged={onChanged} />}
      {sheet === "import" && <ImportSheet ctx={ctx} onClose={() => setSheet("")} onDone={() => { setSheet(""); onChanged(); }} />}
      {sheet === "flow" && <FlowSheet onClose={() => setSheet("")} />}
      {sheet === "integrations" && <IntegrationsSheet onClose={() => setSheet("")} />}
    </div>
  );
}

export function ReportsSection() {
  const { L, ctx, as } = useShell();
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<Call[] | null>(null);
  useEffect(() => { api<{ calls: Call[] }>(`/api/crm/calls?days=30${as ? `&as=${as}` : ""}`).then((r) => setCalls(r.ok ? r.data.calls : [])); }, [as]);
  const made = calls?.length ?? 0, conn = calls?.filter((c) => c.outcome === "connected").length ?? 0, avg = conn ? Math.round(calls!.filter((c) => c.outcome === "connected").reduce((n, c) => n + c.seconds, 0) / conn) : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[{ l: `${L.callsReport} · ${L.callsMade}`, v: made }, { l: L.callsConnected, v: made ? `${Math.round((conn / made) * 100)}%` : "—" }, { l: L.avgDuration, v: avg ? `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, "0")}` : "—" }].map((k) => <div key={k.l} className="rounded-xl border border-border bg-surface p-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k.l}</div><div className="text-lg font-bold text-ink">{calls === null ? "…" : k.v}</div></div>)}
      </div>
      <p className="text-[11px] text-muted">{L.reportsHint}</p>
      {open && ctx.role !== "agent" && <AnalyticsSheet ctx={ctx} onClose={() => setOpen(false)} />}
      {!open && <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-border px-3 py-2 text-sm">{L.reports}</button>}
    </div>
  );
}
