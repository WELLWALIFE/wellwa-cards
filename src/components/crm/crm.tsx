"use client";
import { SITE_URL } from "@/lib/site-url";
// WhatsApp CRM for Shubhora: inbox of every lead (WhatsApp, card form, QR,
// manual), the full chat thread with the bot's and the owner's messages, AI
// insight (intent / summary / next step / suggested reply), stage pipeline,
// tags, notes, follow-up reminders and quick-reply templates.
// Talks only to /api/crm/* (bearer via api()).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Search, Plus, Phone, MessageCircle, ArrowLeft, Send, Sparkles, LoaderCircle, X, Zap, Tag, CalendarClock,
  ChevronDown, ExternalLink, Bot, User, RefreshCw, Trash2, Pencil, Columns3, List, BellRing, IndianRupee, Check,
  Paperclip, BarChart3, Users, MoreVertical, Download, Upload, Copy, UserCheck, GitBranch, Plug, ArrowRight,
} from "lucide-react";
import { api, authHeaders } from "@/lib/poster-client";

/* ---------------- types ---------------- */
type Lead = {
  id: string; name: string; phone: string; email: string; message: string; source: string; status: string; score: number;
  notes: string; next_follow_up: string | null; value_paise: number; lost_reason: string; tags: string[]; last_message_at: string | null; unread: number;
  ai_intent: string; ai_sentiment: string; ai_summary: string; ai_next: string; ai_at: string | null; city: string; created_at: string; _aiTags?: string[];
  assigned_to: string | null;
};
type Agent = { id: string; name: string; role: "agent" | "manager"; joined: boolean };
type Team = { owner_id: string; role: "agent" | "manager"; owner_name: string };
type Role = "owner" | "manager" | "agent";
type Ctx = { as: string | null; role: Role; me: string; agents: Agent[]; upi?: string; payee?: string };
const q_as = (c: Ctx) => (c.as ? `&as=${c.as}` : "");
const WS_KEY = "akp-crm-ws";
type Msg = { id: string; direction: "in" | "out"; sender: "customer" | "bot" | "owner"; kind: string; text: string; sent_at: string };
type Ev = { id: string; kind: string; text: string; created_at: string };
type Tpl = { id: string; name: string; shortcut: string; body: string; uses: number };
type Wa = "connected" | "disconnected" | "offline" | "plan";

const STAGES = [
  { key: "new", label: "New", cls: "bg-surface2 text-muted" },
  { key: "contacted", label: "Contacted", cls: "bg-ai/10 text-ai" },
  { key: "interested", label: "Interested", cls: "bg-brand-soft text-brand-ink" },
  { key: "follow_up", label: "Follow-up", cls: "bg-lead/15 text-lead" },
  { key: "converted", label: "Won", cls: "bg-good/15 text-good" },
  { key: "lost", label: "Lost", cls: "bg-surface2 text-faint" },
] as const;
const stage = (k: string) => STAGES.find((s) => s.key === k) ?? (k === "hot" ? STAGES[2] : k === "warm" ? STAGES[1] : k === "won" ? STAGES[4] : STAGES[0]);

const IST = "Asia/Kolkata";
function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400 && d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" });
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const digits = (p: string) => p.replace(/[^0-9]/g, "");
const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const isOverdue = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();
const initial = (l: Lead) => (l.name || "").trim().charAt(0).toUpperCase() || "#";
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const rupees = (p: number) => (p ? "₹" + (p / 100).toLocaleString("en-IN") : "");
const sentimentDot: Record<string, string> = { positive: "🙂", neutral: "😐", negative: "😟" };

/* ---------------- root ---------------- */
export function CrmInbox() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [wa, setWa] = useState<Wa>("disconnected");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [sheet, setSheet] = useState<"" | "analytics" | "team" | "import" | "flow" | "integrations">("");
  const [menu, setMenu] = useState(false);
  const [ws, setWs] = useState<string | null>(() => { try { return localStorage.getItem(WS_KEY); } catch { return null; } });
  const [teams, setTeams] = useState<Team[]>([]);
  const [ctx, setCtx] = useState<Ctx>({ as: null, role: "owner", me: "", agents: [] });

  const load = useCallback(async () => {
    const r = await api<{ leads: Lead[]; wa: Wa; role: Role; ownerId: string; me: string; teams: Team[]; agents: Agent[]; upi?: string; payee?: string; error?: string }>(`/api/crm/inbox?x=1${ws ? `&as=${ws}` : ""}`);
    if (!r.ok) { if (r.status === 403 && ws) { setWs(null); try { localStorage.removeItem(WS_KEY); } catch { /* ignore */ } return; } setErr(r.data.error || "Could not load leads."); setLeads([]); return; }
    setLeads(r.data.leads); setWa(r.data.wa); setErr(""); setTeams(r.data.teams ?? []);
    AGENT_NAMES = Object.fromEntries((r.data.agents ?? []).map((a) => [a.id, a.name]));
    setCtx({ as: r.data.ownerId === r.data.me ? null : r.data.ownerId, role: r.data.role, me: r.data.me, agents: r.data.agents ?? [], upi: r.data.upi, payee: r.data.payee });
  }, [ws]);
  useEffect(() => { load(); }, [load]);
  const switchWs = (id: string | null) => { setWs(id); setLeads(null); setFilter("all"); try { if (id) localStorage.setItem(WS_KEY, id); else localStorage.removeItem(WS_KEY); } catch { /* ignore */ } };
  useEffect(() => { if (openId) return; const t = setInterval(load, 20000); return () => clearInterval(t); }, [load, openId]);

  const patchLocal = useCallback((l: Lead) => setLeads((xs) => (xs ?? []).map((x) => (x.id === l.id ? { ...x, ...l } : x))), []);

  const allTags = useMemo(() => { const m = new Map<string, number>(); for (const l of leads ?? []) for (const t of l.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]); }, [leads]);

  const stats = useMemo(() => {
    const xs = leads ?? []; const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
    return {
      due: xs.filter((l) => l.next_follow_up && (isToday(l.next_follow_up) || isOverdue(l.next_follow_up)) && !["converted", "lost"].includes(l.status)).length,
      unread: xs.reduce((n, l) => n + (l.unread || 0), 0),
      hot: xs.filter((l) => l.score >= 70 && !["converted", "lost"].includes(l.status)).length,
      won: xs.filter((l) => ["converted", "won"].includes(l.status) && new Date(l.created_at) >= m0).length,
      wonValue: xs.filter((l) => ["converted", "won"].includes(l.status)).reduce((n, l) => n + (l.value_paise || 0), 0),
    };
  }, [leads]);

  const shown = useMemo(() => {
    let xs = leads ?? [];
    const s = q.trim().toLowerCase();
    if (s) xs = xs.filter((l) => [l.name, l.phone, l.message, l.city, l.ai_intent, ...(l.tags ?? [])].join(" ").toLowerCase().includes(s));
    if (filter === "unread") xs = xs.filter((l) => l.unread > 0);
    else if (filter === "today") xs = xs.filter((l) => l.next_follow_up && (isToday(l.next_follow_up) || isOverdue(l.next_follow_up)) && !["converted", "lost"].includes(l.status));
    else if (filter === "hot") xs = xs.filter((l) => l.score >= 70 && !["converted", "lost"].includes(l.status));
    else if (filter === "mine") xs = xs.filter((l) => l.assigned_to === ctx.me);
    else if (filter === "unassigned") xs = xs.filter((l) => !l.assigned_to);
    else if (filter.startsWith("agent:")) { const k = filter.slice(6); xs = xs.filter((l) => l.assigned_to === k); }
    else if (filter.startsWith("stage:")) { const k = filter.slice(6); xs = xs.filter((l) => stage(l.status).key === k); }
    else if (filter.startsWith("tag:")) { const k = filter.slice(4); xs = xs.filter((l) => (l.tags ?? []).includes(k)); }
    return xs;
  }, [leads, q, filter, ctx.me]);

  function exportCsv() {
    const rows = [["Name", "Phone", "City", "Stage", "Tags", "Score", "AI intent", "Value", "Follow-up", "Source", "Last message", "Notes", "Created"]];
    for (const l of leads ?? []) rows.push([l.name, l.phone, l.city, stage(l.status).label, (l.tags ?? []).join(" "), String(l.score), l.ai_intent, String((l.value_paise || 0) / 100), l.next_follow_up ? when(l.next_follow_up) : "", l.source, l.message, l.notes, when(l.created_at)]);
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  if (openId) {
    const l = (leads ?? []).find((x) => x.id === openId);
    return <Thread id={openId} seed={l} wa={wa} ctx={ctx} onBack={() => { setOpenId(null); load(); }} onLead={patchLocal} onTemplates={() => setTplOpen(true)} tplOpen={tplOpen} closeTpl={() => setTplOpen(false)} />;
  }

  return (
    <div className="space-y-3">
      {(teams.length > 0 || ctx.as) && (
        <div className="flex gap-1.5 overflow-x-auto text-xs [scrollbar-width:none]">
          <button type="button" onClick={() => switchWs(null)} className={`shrink-0 rounded-full border px-2.5 py-1 font-semibold ${!ws ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>My CRM</button>
          {teams.map((t) => <button key={t.owner_id} type="button" onClick={() => switchWs(t.owner_id)} className={`shrink-0 rounded-full border px-2.5 py-1 font-semibold ${ws === t.owner_id ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}><Users className="mr-1 inline h-3 w-3" />{t.owner_name} · {t.role}</button>)}
        </div>
      )}
      {/* stats */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Follow-ups" value={stats.due} accent={stats.due > 0} icon={<BellRing className="h-3.5 w-3.5" />} onClick={() => setFilter(filter === "today" ? "all" : "today")} active={filter === "today"} />
        <Stat label="Unread" value={stats.unread} icon={<MessageCircle className="h-3.5 w-3.5" />} onClick={() => setFilter(filter === "unread" ? "all" : "unread")} active={filter === "unread"} />
        <Stat label="Hot" value={stats.hot} icon={<Zap className="h-3.5 w-3.5" />} onClick={() => setFilter(filter === "hot" ? "all" : "hot")} active={filter === "hot"} />
        <Stat label="Won" value={stats.won} sub={rupees(stats.wonValue)} icon={<Check className="h-3.5 w-3.5" />} onClick={() => setFilter(filter === "stage:converted" ? "all" : "stage:converted")} active={filter === "stage:converted"} />
      </div>

      {wa !== "connected" && (
        <div className="rounded-xl border border-border bg-surface2/60 px-3 py-2 text-xs text-muted">
          {wa === "plan" ? "WhatsApp sending comes with the Growth plan — leads and notes still work." : wa === "offline" ? "WhatsApp service is offline right now. Replies from here will send once it is back." : "WhatsApp not connected — open the WhatsApp AI tab and scan the QR to reply from here."}
        </div>
      )}

      {/* search + actions */}
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, tag…" className="w-full bg-transparent outline-none placeholder:text-faint" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear"><X className="h-4 w-4 text-muted" /></button>}
        </label>
        <button type="button" onClick={() => setView(view === "list" ? "pipeline" : "list")} className="rounded-xl border border-border bg-surface p-2 text-muted" aria-label="Toggle view">{view === "list" ? <Columns3 className="h-4 w-4" /> : <List className="h-4 w-4" />}</button>
        {ctx.role !== "agent" && <button type="button" onClick={() => setSheet("analytics")} className="rounded-xl border border-border bg-surface p-2 text-muted" aria-label="Analytics"><BarChart3 className="h-4 w-4" /></button>}
        <div className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} className="rounded-xl border border-border bg-surface p-2 text-muted" aria-label="More"><MoreVertical className="h-4 w-4" /></button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-surface text-sm shadow-card" onMouseLeave={() => setMenu(false)}>
              {[
                { l: "Quick replies", i: <Zap className="h-4 w-4" />, f: () => setTplOpen(true) },
                ...(ctx.role === "owner" ? [
                  { l: "Team inbox", i: <Users className="h-4 w-4" />, f: () => setSheet("team") },
                  { l: "Menu bot", i: <GitBranch className="h-4 w-4" />, f: () => setSheet("flow") },
                  { l: "Integrations", i: <Plug className="h-4 w-4" />, f: () => setSheet("integrations") },
                ] : []),
                ...(ctx.role !== "agent" ? [{ l: "Import leads", i: <Upload className="h-4 w-4" />, f: () => setSheet("import") }] : []),
                { l: "Export CSV", i: <Download className="h-4 w-4" />, f: exportCsv },
                ...(!ctx.as ? [{ l: "Join a team", i: <UserCheck className="h-4 w-4" />, f: () => setSheet("team") }] : []),
              ].map((m) => <button key={m.l} type="button" onClick={() => { setMenu(false); m.f(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-surface2">{m.i}{m.l}</button>)}
            </div>
          )}
        </div>
        {ctx.role !== "agent" && <button type="button" onClick={() => setAdding(true)} className="grad-brand rounded-xl p-2 text-white" aria-label="Add lead"><Plus className="h-4 w-4" /></button>}
      </div>

      {/* filter chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-xs [scrollbar-width:none]">
        {[{ k: "all", l: "All" }, ...(ctx.agents.length || ctx.as ? [{ k: "mine", l: "👤 Mine" }] : []), ...(ctx.role !== "agent" && ctx.agents.length ? [{ k: "unassigned", l: "Unassigned" }, ...ctx.agents.map((a) => ({ k: `agent:${a.id}`, l: `@${a.name}` }))] : []), ...STAGES.map((s) => ({ k: `stage:${s.key}`, l: s.label })), ...allTags.map((t) => ({ k: `tag:${t}`, l: `#${t}` }))].map((c) => (
          <button key={c.k} type="button" onClick={() => setFilter(filter === c.k ? "all" : c.k)} className={`shrink-0 rounded-full border px-2.5 py-1 font-medium ${filter === c.k ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{c.l}</button>
        ))}
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}
      {leads === null ? (
        <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : view === "pipeline" ? (
        <Pipeline leads={shown} onOpen={setOpenId} />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {leads.length === 0 ? <>No leads yet. Share your card, connect WhatsApp AI, or add a lead with <b>+</b>.</> : "Nothing matches this filter."}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {shown.map((l) => <Row key={l.id} l={l} onClick={() => setOpenId(l.id)} />)}
        </ul>
      )}

      {adding && <AddLead ctx={ctx} onClose={() => setAdding(false)} onAdded={(l) => { setLeads((xs) => [l, ...(xs ?? [])]); setAdding(false); setOpenId(l.id); }} />}
      {tplOpen && <Templates ctx={ctx} onClose={() => setTplOpen(false)} />}
      {sheet === "analytics" && <AnalyticsSheet ctx={ctx} onClose={() => setSheet("")} />}
      {sheet === "team" && <TeamSheet ctx={ctx} onClose={() => setSheet("")} onChanged={load} />}
      {sheet === "import" && <ImportSheet ctx={ctx} onClose={() => setSheet("")} onDone={() => { setSheet(""); load(); }} />}
      {sheet === "flow" && <FlowSheet onClose={() => setSheet("")} />}
      {sheet === "integrations" && <IntegrationsSheet onClose={() => setSheet("")} />}
    </div>
  );
}

function Stat({ label, value, sub, icon, onClick, active, accent }: { label: string; value: number; sub?: string; icon: ReactNode; onClick: () => void; active?: boolean; accent?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-2 py-2 text-left ${active ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}>
      <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${accent ? "text-lead" : "text-muted"}`}>{icon}{label}</div>
      <div className="mt-0.5 text-lg font-bold leading-none text-ink">{value}{sub ? <span className="ml-1 text-[10px] font-medium text-muted">{sub}</span> : null}</div>
    </button>
  );
}

let AGENT_NAMES: Record<string, string> = {};
const agentName = (id: string) => AGENT_NAMES[id] ?? "agent";
function Row({ l, onClick }: { l: Lead; onClick: () => void }) {
  const st = stage(l.status);
  const due = l.next_follow_up && !["converted", "lost"].includes(l.status) ? (isOverdue(l.next_follow_up) ? "overdue" : isToday(l.next_follow_up) ? "today" : "later") : null;
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-surface2/60">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-white" style={{ background: `hsl(${hue(l.phone || l.id)} 55% 50%)` }}>
          {initial(l)}
          {l.score >= 70 && !["converted", "lost"].includes(l.status) && <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-lead text-[9px] text-white">🔥</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`truncate text-sm ${l.unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>{l.name || l.phone || "Unknown"}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{ago(l.last_message_at || l.created_at)}</span>
          </div>
          <p className={`truncate text-xs ${l.unread ? "text-ink" : "text-muted"}`}>{l.message || l.ai_intent || "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
            {l.ai_intent && <span className="rounded-full bg-ai/10 px-1.5 py-0.5 text-[10px] font-medium text-ai">✦ {l.ai_intent}</span>}
            {(l.tags ?? []).slice(0, 2).map((t) => <span key={t} className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">#{t}</span>)}
            {l.assigned_to && <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">@{agentName(l.assigned_to)}</span>}
            {due && <span className={`ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium ${due === "overdue" ? "text-danger" : due === "today" ? "text-lead" : "text-muted"}`}><CalendarClock className="h-3 w-3" />{due === "later" ? ago(l.next_follow_up) : due}</span>}
          </div>
        </div>
        {l.unread > 0 && <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{l.unread}</span>}
      </button>
    </li>
  );
}

function Pipeline({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
      {STAGES.map((s) => {
        const xs = leads.filter((l) => stage(l.status).key === s.key);
        const val = xs.reduce((n, l) => n + (l.value_paise || 0), 0);
        return (
          <div key={s.key} className="w-[68vw] max-w-[260px] shrink-0 rounded-2xl border border-border bg-surface2/40 p-2">
            <div className="flex items-center justify-between px-1 pb-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${s.cls}`}>{s.label} · {xs.length}</span>
              {val > 0 && <span className="text-faint">{rupees(val)}</span>}
            </div>
            <div className="space-y-1.5">
              {xs.map((l) => (
                <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="w-full rounded-xl border border-border bg-surface p-2 text-left">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-ink"><span className="truncate">{l.name || l.phone}</span>{l.score >= 70 && <span className="text-[10px]">🔥</span>}{l.unread > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-brand" />}</div>
                  <p className="truncate text-[11px] text-muted">{l.ai_next || l.ai_intent || l.message}</p>
                  {l.next_follow_up && <p className={`mt-0.5 text-[10px] ${isOverdue(l.next_follow_up) ? "text-danger" : "text-faint"}`}>⏰ {when(l.next_follow_up)}</p>}
                </button>
              ))}
              {xs.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-faint">Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- thread ---------------- */
function Thread({ id, seed, wa, ctx, onBack, onLead, onTemplates, tplOpen, closeTpl }: { id: string; seed?: Lead; wa: Wa; ctx: Ctx; onBack: () => void; onLead: (l: Lead) => void; onTemplates: () => void; tplOpen: boolean; closeTpl: () => void }) {
  const [lead, setLead] = useState<Lead | null>(seed ?? null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "send" | "ai" | "refresh">("");
  const [err, setErr] = useState("");
  const [sheet, setSheet] = useState<"" | "profile">("");
  const [aiOpen, setAiOpen] = useState(true);
  const [attach, setAttach] = useState<{ url: string; kind: "image" | "pdf"; name: string } | null>(null);
  const [pay, setPay] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (quiet = false) => {
    const r = await api<{ lead: Lead; messages: Msg[]; events: Ev[]; templates: Tpl[]; error?: string }>(`/api/crm/thread?lead=${id}${q_as(ctx)}`);
    if (!r.ok) { if (!quiet) setErr(r.data.error || "Could not open this chat."); return; }
    setLead(r.data.lead); onLead(r.data.lead); setMsgs(r.data.messages); setEvents(r.data.events); setTpls(r.data.templates);
  }, [id, onLead, ctx]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => load(true), 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs?.length]);

  const update = useCallback(async (patch: Record<string, unknown>) => {
    const r = await api<{ lead: Lead; error?: string }>("/api/crm/lead", { method: "PATCH", json: { id, as: ctx.as ?? undefined, ...patch } });
    if (!r.ok) { setErr(r.data.error || "Could not save."); return null; }
    setLead(r.data.lead); onLead(r.data.lead); load(true); return r.data.lead;
  }, [id, onLead, load, ctx.as]);

  async function pickFile(f: File | undefined) {
    if (!f) return; setUploading(true); setErr("");
    const h = await authHeaders(); delete h["content-type"];
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/crm/upload", { method: "POST", headers: h, body: fd });
    const j = await r.json().catch(() => ({}));
    setUploading(false);
    if (!r.ok) { setErr(j.error || "Upload failed."); return; }
    setAttach({ url: j.url, kind: j.kind, name: j.name });
  }
  async function send(tplId?: string) {
    const body = text.trim(); if ((!body && !attach) || busy) return;
    setBusy("send"); setErr("");
    const r = await api<{ ok: boolean; text: string; error?: string }>("/api/crm/send", { method: "POST", json: { lead_id: id, as: ctx.as ?? undefined, text: body, template_id: tplId, imageUrl: attach?.kind === "image" ? attach.url : undefined, fileUrl: attach?.kind === "pdf" ? attach.url : undefined, fileName: attach?.kind === "pdf" ? attach.name : undefined } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || "Send failed."); return; }
    setText(""); setAttach(null);
    setMsgs((m) => [...(m ?? []), { id: `tmp-${Date.now()}`, direction: "out", sender: "owner", kind: "text", text: r.data.text, sent_at: new Date().toISOString() }]);
    setTimeout(() => load(true), 1500);
  }
  async function suggest(hint?: string) {
    if (busy) return; setBusy("ai"); setErr("");
    const r = await api<{ text: string; error?: string }>("/api/crm/ai", { method: "POST", json: { lead_id: id, as: ctx.as ?? undefined, action: "suggest", hint } });
    setBusy("");
    if (!r.ok) { setErr(r.data.error || "AI is busy."); return; }
    setText(r.data.text); taRef.current?.focus();
  }
  async function refreshAi() {
    if (busy) return; setBusy("refresh");
    await api("/api/crm/ai", { method: "POST", json: { lead_id: id, as: ctx.as ?? undefined, action: "refresh" } });
    await load(true); setBusy("");
  }

  // "/shortcut" → template picker
  const slash = text.startsWith("/") && !text.includes("\n") ? text.slice(1).toLowerCase() : null;
  const slashMatches = slash !== null ? tpls.filter((t) => !slash || t.shortcut.startsWith(slash) || t.name.toLowerCase().includes(slash)).slice(0, 6) : [];

  const l = lead;
  const st = l ? stage(l.status) : STAGES[0];
  const canSend = wa === "connected";
  const suggestedTags = (l?._aiTags ?? []).filter((t) => !(l?.tags ?? []).includes(t));

  return (
    <div className="-mx-3 flex h-[calc(100dvh-12.5rem)] min-h-[420px] flex-col overflow-hidden rounded-t-2xl border border-border bg-surface md:mx-0">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-muted hover:bg-surface2" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => setSheet("profile")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: `hsl(${hue(l?.phone || id)} 55% 50%)` }}>{l ? initial(l) : "#"}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink">{l?.name || l?.phone || "…"}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted"><span className="truncate">{l?.phone?.startsWith("+") ? l.phone : "number hidden"}</span>{l?.city && <span>· {l.city}</span>}<ChevronDown className="h-3 w-3" /></div>
          </div>
        </button>
        {l?.phone?.startsWith("+") && (
          <>
            <a href={`tel:${l.phone}`} onClick={() => update({ note: "📞 Called" })} className="rounded-lg p-2 text-brand hover:bg-surface2" aria-label="Call"><Phone className="h-4 w-4" /></a>
            <a href={`https://wa.me/${digits(l.phone)}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-good hover:bg-surface2" aria-label="Open in WhatsApp"><ExternalLink className="h-4 w-4" /></a>
          </>
        )}
      </div>

      {/* stage strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-2 py-1.5 text-[11px] [scrollbar-width:none]">
        {STAGES.map((s) => (
          <button key={s.key} type="button" onClick={() => update({ status: s.key })} className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${st.key === s.key ? s.cls + " ring-1 ring-current" : "text-faint"}`}>{s.label}</button>
        ))}
        {l?.next_follow_up && !["converted", "lost"].includes(l.status) && <span className={`ml-auto inline-flex shrink-0 items-center gap-1 ${isOverdue(l.next_follow_up) ? "text-danger" : "text-lead"}`}><CalendarClock className="h-3 w-3" />{when(l.next_follow_up)}</span>}
      </div>
      {ctx.role !== "agent" && ctx.agents.length > 0 && l && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-muted">
          <Users className="h-3.5 w-3.5" /> Assigned to
          <select value={l.assigned_to ?? ""} onChange={(e) => update({ assigned_to: e.target.value || null })} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink">
            <option value="">Nobody (me)</option>
            {ctx.agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>
        </div>
      )}

      {/* AI insight */}
      {l && (l.ai_summary || l.ai_intent) && (
        <div className="border-b border-border bg-ai/5 px-3 py-2 text-xs">
          <button type="button" onClick={() => setAiOpen((v) => !v)} className="flex w-full items-center gap-1.5 text-left font-semibold text-ai">
            <Sparkles className="h-3.5 w-3.5" /> {l.ai_intent || "AI insight"} {sentimentDot[l.ai_sentiment] ?? ""} <span className="ml-1 rounded-full bg-ai/10 px-1.5 text-[10px]">{l.score}/100</span>
            <ChevronDown className={`ml-auto h-3.5 w-3.5 transition ${aiOpen ? "" : "-rotate-90"}`} />
          </button>
          {aiOpen && (
            <div className="mt-1 space-y-1.5 text-ink">
              {l.ai_summary && <p className="text-muted">{l.ai_summary}</p>}
              {l.ai_next && <p><b>Next:</b> {l.ai_next}</p>}
              {suggestedTags.length > 0 && <div className="flex flex-wrap gap-1">{suggestedTags.map((t) => <button key={t} type="button" onClick={() => update({ tags: [...(l.tags ?? []), t] })} className="rounded-full border border-dashed border-ai/40 px-1.5 py-0.5 text-[10px] text-ai">+ #{t}</button>)}</div>}
              <div className="flex gap-1.5 pt-0.5">
                <button type="button" disabled={!!busy} onClick={() => suggest()} className="inline-flex items-center gap-1 rounded-lg bg-ai px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60">{busy === "ai" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Write reply for me</button>
                <button type="button" disabled={!!busy} onClick={refreshAi} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted" aria-label="Refresh insight"><RefreshCw className={`h-3 w-3 ${busy === "refresh" ? "animate-spin" : ""}`} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* messages */}
      <div className="flex-1 space-y-1.5 overflow-y-auto bg-surface2/30 px-3 py-3">
        {msgs === null ? (
          <div className="grid h-full place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
        ) : msgs.length === 0 ? (
          <div className="mx-auto max-w-xs py-8 text-center text-xs text-muted">
            {l?.message ? <><p className="mb-2 rounded-xl bg-surface px-3 py-2 text-left text-ink shadow-card">“{l.message}”</p><p>from {l.source}{l.created_at ? ` · ${when(l.created_at)}` : ""}</p></> : "No WhatsApp messages yet. Messages appear here from the moment the CRM is on."}
          </div>
        ) : msgs.map((m, i) => {
          const mine = m.direction === "out";
          const showDay = i === 0 || new Date(m.sent_at).toDateString() !== new Date(msgs[i - 1].sent_at).toDateString();
          return (
            <div key={m.id}>
              {showDay && <div className="my-2 text-center text-[10px] font-medium text-faint">{new Date(m.sent_at).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" })}</div>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm ${mine ? (m.sender === "bot" ? "rounded-br-sm bg-ai/10 text-ink" : "grad-brand rounded-br-sm text-white") : "rounded-bl-sm bg-surface text-ink"}`}>
                  {mine && <div className={`mb-0.5 flex items-center gap-1 text-[10px] font-semibold ${m.sender === "bot" ? "text-ai" : "text-white/80"}`}>{m.sender === "bot" ? <><Bot className="h-3 w-3" /> AI bot</> : <><User className="h-3 w-3" /> You</>}</div>}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <div className={`mt-0.5 text-right text-[10px] ${mine && m.sender !== "bot" ? "text-white/70" : "text-faint"}`}>{new Date(m.sent_at).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" })}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="border-t border-border bg-surface p-2">
        {err && <p className="mb-1 px-1 text-[11px] text-danger">{err}</p>}
        {slashMatches.length > 0 && (
          <div className="mb-1 overflow-hidden rounded-xl border border-border">
            {slashMatches.map((t) => (
              <button key={t.id} type="button" onClick={() => { setText(t.body); taRef.current?.focus(); }} className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-surface2">
                <span className="shrink-0 font-semibold text-brand">/{t.shortcut || t.name.toLowerCase().replace(/\s+/g, "")}</span><span className="truncate text-muted">{t.body}</span>
              </button>
            ))}
          </div>
        )}
        {attach && (
          <div className="mb-1 flex items-center gap-2 rounded-xl border border-border bg-surface2/60 px-2 py-1.5 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {attach.kind === "image" ? <img src={attach.url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-lg">📄</span>}
            <span className="truncate text-ink">{attach.name}</span>
            <button type="button" onClick={() => setAttach(null)} className="ml-auto p-1 text-muted" aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" disabled={uploading || !canSend} onClick={() => fileRef.current?.click()} className="rounded-xl p-2 text-muted hover:bg-surface2 disabled:opacity-40" aria-label="Attach photo or PDF">{uploading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}</button>
          <button type="button" onClick={onTemplates} className="rounded-xl p-2 text-muted hover:bg-surface2" aria-label="Quick replies"><Zap className="h-5 w-5" /></button>
          <button type="button" onClick={() => setPay(true)} className="rounded-xl p-2 text-muted hover:bg-surface2" aria-label="Payment request"><IndianRupee className="h-5 w-5" /></button>
          <button type="button" disabled={!!busy} onClick={() => suggest()} className="rounded-xl p-2 text-ai hover:bg-surface2 disabled:opacity-50" aria-label="AI reply">{busy === "ai" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}</button>
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(5, Math.max(1, text.split("\n").length))}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
            placeholder={canSend ? "Type a reply… (/ for quick replies)" : "Connect WhatsApp to reply from here"}
            className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand" />
          <button type="button" disabled={(!text.trim() && !attach) || busy === "send" || !canSend} onClick={() => send()} className="grad-brand rounded-xl p-2.5 text-white disabled:opacity-40" aria-label="Send">{busy === "send" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
        </div>
      </div>

      {pay && l && <PaySheet ctx={ctx} lead={l} onClose={() => setPay(false)} onUse={(t) => { setText(t); setPay(false); taRef.current?.focus(); }} />}
      {sheet === "profile" && l && <Profile lead={l} events={events} onClose={() => setSheet("")} onSave={async (p) => { const r = await update(p); if (r) setSheet(""); }} />}
      {tplOpen && <Templates ctx={ctx} onClose={() => { closeTpl(); load(true); }} onPick={(t) => { setText(t.body); closeTpl(); taRef.current?.focus(); }} />}
    </div>
  );
}

/* ---------------- profile sheet ---------------- */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-xl md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-ink">{title}</h3><button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface2" aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}
const inputCls = "w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand";
const quickDates = (): { l: string; v: string }[] => {
  const at = (d: number, h: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x; };
  const iso = (x: Date) => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return [{ l: "Today 6 pm", v: iso(at(0, 18)) }, { l: "Tomorrow 11 am", v: iso(at(1, 11)) }, { l: "In 3 days", v: iso(at(3, 11)) }, { l: "Next week", v: iso(at(7, 11)) }];
};

function Profile({ lead, events, onClose, onSave }: { lead: Lead; events: Ev[]; onClose: () => void; onSave: (p: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ name: lead.name, city: lead.city, status: stage(lead.status).key as string, tags: lead.tags ?? [], notes: lead.notes, value: lead.value_paise ? String(lead.value_paise / 100) : "", lost_reason: lead.lost_reason, next: lead.next_follow_up ? new Date(new Date(lead.next_follow_up).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "", note: "" });
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const addTag = () => { const t = tag.trim().replace(/^#/, "").slice(0, 24); if (t && !f.tags.includes(t)) setF({ ...f, tags: [...f.tags, t] }); setTag(""); };
  async function save() {
    setSaving(true);
    await onSave({ name: f.name, city: f.city, status: f.status, tags: f.tags, notes: f.notes, lost_reason: f.lost_reason, value_paise: Math.round((parseFloat(f.value) || 0) * 100), next_follow_up: f.next ? new Date(f.next).toISOString() : null, note: f.note || undefined });
    setSaving(false);
  }
  return (
    <Sheet title="Lead details" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></label>
          <label className="text-xs text-muted">City<input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={inputCls} /></label>
        </div>
        <div>
          <div className="mb-1 text-xs text-muted">Stage</div>
          <div className="flex flex-wrap gap-1.5">{STAGES.map((s) => <button key={s.key} type="button" onClick={() => setF({ ...f, status: s.key })} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.status === s.key ? s.cls + " ring-1 ring-current" : "bg-surface2 text-faint"}`}>{s.label}</button>)}</div>
        </div>
        {f.status === "lost" && <label className="block text-xs text-muted">Lost reason<input value={f.lost_reason} onChange={(e) => setF({ ...f, lost_reason: e.target.value })} placeholder="Price / no response / bought elsewhere" className={inputCls} /></label>}
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs text-muted"><Tag className="h-3 w-3" /> Tags</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {f.tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-ink">#{t}<button type="button" onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })} aria-label="Remove"><X className="h-3 w-3" /></button></span>)}
            <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="+ add tag" className="min-w-24 flex-1 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-xs outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted"><span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Deal value</span><input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} inputMode="decimal" placeholder="e.g. 45000" className={inputCls} /></label>
          <label className="text-xs text-muted"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Follow-up</span><input type="datetime-local" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className={inputCls} /></label>
        </div>
        <div className="flex flex-wrap gap-1.5">{quickDates().map((d) => <button key={d.l} type="button" onClick={() => setF({ ...f, next: d.v })} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">{d.l}</button>)}{f.next && <button type="button" onClick={() => setF({ ...f, next: "" })} className="rounded-full px-2 py-0.5 text-[11px] text-danger">Clear</button>}</div>
        <label className="block text-xs text-muted">Notes<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} placeholder="Anything to remember about this customer" className={inputCls} /></label>
        <label className="block text-xs text-muted">Add to timeline<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Called, demo fixed for Sunday" className={inputCls} /></label>
        <button type="button" disabled={saving} onClick={save} className="grad-brand w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>

        <div className="pt-2">
          <div className="mb-1 text-xs font-semibold text-muted">Timeline</div>
          {events.length === 0 ? <p className="text-xs text-faint">No activity yet.</p> : (
            <ul className="space-y-1.5 border-l border-border pl-3 text-xs">
              {events.map((e) => <li key={e.id} className="relative"><span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-border" /><span className="text-ink">{e.kind === "sent" ? "📤 " : e.kind === "status" ? "🏷 " : e.kind === "followup" ? "⏰ " : e.kind === "note" ? "📝 " : ""}{e.text}</span><span className="ml-1 text-faint">· {ago(e.created_at)}</span></li>)}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- add lead ---------------- */
function AddLead({ ctx, onClose, onAdded }: { ctx: Ctx; onClose: () => void; onAdded: (l: Lead) => void }) {
  const [f, setF] = useState({ name: "", phone: "", city: "", note: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function add() {
    setBusy(true); setErr("");
    const r = await api<{ lead: Lead; error?: string; id?: string }>("/api/crm/lead", { method: "POST", json: { ...f, as: ctx.as ?? undefined } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || "Could not add."); return; }
    onAdded(r.data.lead);
  }
  return (
    <Sheet title="Add lead" onClose={onClose}>
      <div className="space-y-2 text-sm">
        <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="Mobile number *" className={inputCls} autoFocus />
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className={inputCls} />
        <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="City" className={inputCls} />
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="What do they want?" className={inputCls} />
        {err && <p className="text-xs text-danger">{err}</p>}
        <button type="button" disabled={busy || !f.phone} onClick={add} className="grad-brand w-full rounded-xl py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Adding…" : "Add lead"}</button>
      </div>
    </Sheet>
  );
}

/* ---------------- templates ---------------- */
const STARTER: Omit<Tpl, "id" | "uses">[] = [
  { name: "Intro", shortcut: "intro", body: "Namaste {name} ji 🙏 Main {business} se. Aapne humse contact kiya tha — batayein, kaise madad karun?\nHamari details: {card}" },
  { name: "Price", shortcut: "price", body: "{name} ji, price aur offers ki poori jaankari yahan hai: {card}\nAap chahein to main call karke samjha dun — kab baat karna theek rahega?" },
  { name: "Demo", shortcut: "demo", body: "{name} ji, kya aap free demo lena chahenge? Aap apna area aur suvidha ka samay bata dein, main slot fix kar deta hoon." },
  { name: "Follow-up", shortcut: "fu", body: "Namaste {name} ji, aapne {business} ke baare me poocha tha. Koi sawaal ho to zaroor batayein — main yahin hoon 🙂" },
  { name: "Thank you", shortcut: "thanks", body: "Dhanyavaad {name} ji! 🙏 Aap par bharosa karne ke liye shukriya. Koi bhi help chahiye to seedha message karein." },
];
function Templates({ ctx, onClose, onPick }: { ctx: Ctx; onClose: () => void; onPick?: (t: Tpl) => void }) {
  const [tpls, setTpls] = useState<Tpl[] | null>(null);
  const [edit, setEdit] = useState<Partial<Tpl> | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = ctx.role === "owner";
  const load = useCallback(async () => { const r = await api<{ templates: Tpl[] }>(`/api/crm/templates?x=1${q_as(ctx)}`); setTpls(r.ok ? r.data.templates : []); }, [ctx]);
  useEffect(() => { load(); }, [load]);
  async function save() {
    if (!edit?.name || !edit?.body) return; setBusy(true);
    await api("/api/crm/templates", { method: "POST", json: edit }); setBusy(false); setEdit(null); load();
  }
  async function remove(id: string) { await api(`/api/crm/templates?id=${id}`, { method: "DELETE" }); load(); }
  async function addStarters() { setBusy(true); for (const t of STARTER) await api("/api/crm/templates", { method: "POST", json: t }); setBusy(false); load(); }
  return (
    <Sheet title="Quick replies" onClose={onClose}>
      {edit ? (
        <div className="space-y-2 text-sm">
          <input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Name (e.g. Price list)" className={inputCls} />
          <input value={edit.shortcut ?? ""} onChange={(e) => setEdit({ ...edit, shortcut: e.target.value })} placeholder="Shortcut (type /price in chat)" className={inputCls} />
          <textarea value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={5} placeholder="Message… use {name} {business} {card} {phone}" className={inputCls} />
          <p className="text-[11px] text-faint">{"{name}"} = customer&apos;s first name, {"{business}"} = your business, {"{card}"} = your card link.</p>
          <div className="flex gap-2"><button type="button" onClick={() => setEdit(null)} className="flex-1 rounded-xl border border-border py-2">Cancel</button><button type="button" disabled={busy} onClick={save} className="grad-brand flex-1 rounded-xl py-2 font-semibold text-white">Save</button></div>
        </div>
      ) : tpls === null ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : (
        <div className="space-y-2">
          {tpls.length === 0 && canEdit && <button type="button" disabled={busy} onClick={addStarters} className="w-full rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 p-3 text-sm text-brand-ink">{busy ? "Adding…" : "✨ Add 5 ready-made replies (Intro, Price, Demo, Follow-up, Thanks)"}</button>}
          {tpls.map((t) => (
            <div key={t.id} className="rounded-xl border border-border p-2.5 text-sm">
              <div className="flex items-center gap-2"><b className="text-ink">{t.name}</b>{t.shortcut && <span className="text-xs text-brand">/{t.shortcut}</span>}<span className="ml-auto text-[10px] text-faint">{t.uses} used</span>
                {canEdit && <><button type="button" onClick={() => setEdit(t)} className="p-1 text-muted" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => remove(t.id)} className="p-1 text-muted" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></>}</div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{t.body}</p>
              {onPick && <button type="button" onClick={() => onPick(t)} className="mt-1.5 rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">Use this</button>}
            </div>
          ))}
          {canEdit && <button type="button" onClick={() => setEdit({ name: "", shortcut: "", body: "" })} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-muted"><Plus className="h-4 w-4" /> New quick reply</button>}
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- analytics ---------------- */
type An = {
  days: { day: string; leads: number; in: number; out: number }[];
  funnel: { stage: string; count: number; value: number }[];
  sources: { source: string; count: number }[];
  totals: { leads30: number; leadsPrev30: number; won30: number; wonValue30: number; conversion: number; unread: number; overdue: number; msgsIn30: number; msgsOut30: number; botShare: number };
  response: { botMin: number | null; humanMin: number | null; answered: number; unanswered: number };
  agents: { id: string; name: string; assigned: number; open: number; sent: number; won: number }[];
};
const mins = (m: number | null) => (m === null ? "—" : m < 1 ? "<1 min" : m < 60 ? `${Math.round(m)} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`);
function AnalyticsSheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [a, setA] = useState<An | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { (async () => { const r = await api<An & { error?: string }>(`/api/crm/analytics?x=1${q_as(ctx)}`); if (!r.ok) setErr(r.data.error || "Could not load."); else setA(r.data); })(); }, [ctx]);
  const max = Math.max(1, ...(a?.days.map((d) => Math.max(d.leads, d.in + d.out)) ?? [1]));
  const delta = a ? a.totals.leads30 - a.totals.leadsPrev30 : 0;
  return (
    <Sheet title="CRM analytics · last 30 days" onClose={onClose}>
      {err && <p className="text-xs text-danger">{err}</p>}
      {!a ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "New leads", v: a.totals.leads30, s: delta === 0 ? "same as before" : `${delta > 0 ? "+" : ""}${delta} vs prev 30d` },
              { l: "Won", v: a.totals.won30, s: rupees(a.totals.wonValue30) || "no value set" },
              { l: "Conversion", v: `${a.totals.conversion}%`, s: "won ÷ closed" },
              { l: "Bot reply time", v: mins(a.response.botMin), s: "median, first reply" },
              { l: "Your reply time", v: mins(a.response.humanMin), s: "median, first reply" },
              { l: "Unanswered", v: a.response.unanswered, s: `${a.response.answered} answered` },
            ].map((k) => <div key={k.l} className="rounded-xl border border-border p-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k.l}</div><div className="text-lg font-bold text-ink">{k.v}</div><div className="text-[10px] text-faint">{k.s}</div></div>)}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted"><span>Last 14 days</span><span className="font-normal"><span className="mr-2 inline-block h-2 w-2 rounded-sm bg-brand" />leads <span className="mx-1 inline-block h-2 w-2 rounded-sm bg-ai/50" />messages</span></div>
            <div className="flex h-24 items-end gap-1">
              {a.days.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-px" title={`${d.day}: ${d.leads} leads, ${d.in} in / ${d.out} out`}>
                  <div className="w-full rounded-t-sm bg-ai/40" style={{ height: `${((d.in + d.out) / max) * 80}px` }} />
                  <div className="w-full rounded-t-sm bg-brand" style={{ height: `${(d.leads / max) * 80}px` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-faint"><span>{a.days[0]?.day.slice(5)}</span><span>today</span></div>
            <p className="mt-1 text-[11px] text-muted">{a.totals.msgsIn30} messages received · {a.totals.msgsOut30} sent ({a.totals.botShare}% by the AI bot)</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">Pipeline</div>
            {a.funnel.map((f) => { const tot = Math.max(1, a.funnel.reduce((n, x) => n + x.count, 0)); const st = stage(f.stage); return (
              <div key={f.stage} className="mb-1 flex items-center gap-2 text-xs"><span className={`w-20 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${st.cls}`}>{st.label}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand/70" style={{ width: `${(f.count / tot) * 100}%` }} /></div><span className="w-16 shrink-0 text-right text-ink">{f.count}{f.value ? <span className="text-faint"> · {rupees(f.value)}</span> : null}</span></div>); })}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">Where leads come from</div>
            <div className="flex flex-wrap gap-1.5 text-xs">{a.sources.map((s) => <span key={s.source} className="rounded-full border border-border px-2 py-0.5"><b className="text-ink">{s.count}</b> <span className="text-muted">{s.source}</span></span>)}</div>
          </div>
          {a.agents.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted">Team</div>
              <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase text-faint"><th className="py-1">Agent</th><th>Assigned</th><th>Open</th><th>Sent 30d</th><th>Won</th></tr></thead>
                <tbody>{a.agents.map((g) => <tr key={g.id} className="border-t border-border"><td className="py-1.5 font-semibold text-ink">{g.name}</td><td>{g.assigned}</td><td>{g.open}</td><td>{g.sent}</td><td className="text-good">{g.won}</td></tr>)}</tbody></table>
            </div>
          )}
          {a.totals.overdue > 0 && <p className="rounded-xl bg-lead/10 px-3 py-2 text-xs text-lead">⏰ {a.totals.overdue} follow-up{a.totals.overdue > 1 ? "s" : ""} overdue — open the Follow-ups filter.</p>}
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- team ---------------- */
type AgentFull = { id: string; agent_user_id: string | null; name: string; phone: string; role: "agent" | "manager"; join_code: string; active: boolean; joined_at: string | null };
function TeamSheet({ ctx, onClose, onChanged }: { ctx: Ctx; onClose: () => void; onChanged: () => void }) {
  const [agents, setAgents] = useState<AgentFull[] | null>(null);
  const [f, setF] = useState({ name: "", phone: "", role: "agent" as "agent" | "manager" });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await api<{ agents: AgentFull[] }>("/api/crm/team"); setAgents(r.ok ? r.data.agents : []); }, []);
  useEffect(() => { load(); }, [load]);
  async function add() {
    if (!f.name.trim()) return; setBusy(true); setMsg("");
    const r = await api<{ agent: AgentFull; error?: string }>("/api/crm/team", { method: "POST", json: f });
    setBusy(false); if (!r.ok) { setMsg(r.data.error || "Could not add."); return; }
    setF({ name: "", phone: "", role: "agent" }); load(); onChanged();
  }
  async function patch(id: string, p: Record<string, unknown>) { await api("/api/crm/team", { method: "PATCH", json: { id, ...p } }); load(); onChanged(); }
  async function remove(id: string) { if (!confirm("Remove this agent from your team?")) return; await api(`/api/crm/team?id=${id}`, { method: "DELETE" }); load(); onChanged(); }
  async function join() {
    if (!code.trim()) return; setBusy(true); setMsg("");
    const r = await api<{ ok: boolean; error?: string }>("/api/crm/team", { method: "POST", json: { join: code } });
    setBusy(false); setMsg(r.ok ? "Joined! Switch to the team from the top of the CRM." : r.data.error || "Invalid code.");
    if (r.ok) { setCode(""); onChanged(); }
  }
  const shareInvite = (a: AgentFull) => {
    const t = `You are invited to our WhatsApp CRM team on Shubhora.\n1. Open ${SITE_URL}/poster and log in (or sign up)\n2. Go to CRM → ⋮ → Join a team\n3. Enter code: ${a.join_code}`;
    const d = a.phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${d ? (d.length === 10 ? "91" + d : d) : ""}?text=${encodeURIComponent(t)}`, "_blank");
  };
  return (
    <Sheet title="Team inbox" onClose={onClose}>
      <div className="space-y-4 text-sm">
        {ctx.role === "owner" && (
          <>
            <p className="text-xs text-muted">Add your sales agents. Each gets a join code; they log in to Shubhora with their own number and enter it. <b>Agents</b> see only leads you assign to them, <b>managers</b> see everything. Replies go out from your WhatsApp number.</p>
            {agents === null ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" /> : agents.map((a) => (
              <div key={a.id} className={`rounded-xl border border-border p-2.5 ${a.active ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{a.name} <span className="text-[10px] font-medium text-muted">· {a.role}</span></div><div className="text-[11px] text-muted">{a.phone || "no number"} · {a.agent_user_id ? <span className="text-good">joined</span> : <span className="text-lead">not joined yet</span>}</div></div>
                  <button type="button" onClick={() => patch(a.id, { role: a.role === "agent" ? "manager" : "agent" })} className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted">{a.role === "agent" ? "Make manager" : "Make agent"}</button>
                  <button type="button" onClick={() => patch(a.id, { active: !a.active })} className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted">{a.active ? "Pause" : "Resume"}</button>
                  <button type="button" onClick={() => remove(a.id)} className="p-1 text-muted" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
                {!a.agent_user_id && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface2/60 px-2 py-1.5 text-xs">
                    <span className="text-muted">Join code</span><b className="tracking-widest text-ink">{a.join_code}</b>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(a.join_code)} className="p-1 text-muted" aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => shareInvite(a)} className="ml-auto rounded-lg bg-good/15 px-2 py-1 font-semibold text-good">Send on WhatsApp</button>
                  </div>
                )}
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-border p-2.5">
              <div className="mb-1 text-xs font-semibold text-muted">Add agent</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className={inputCls} />
                <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="WhatsApp number" className={inputCls} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "agent" | "manager" })} className="rounded-xl border border-border bg-surface px-2 py-2 text-xs"><option value="agent">Agent (assigned leads only)</option><option value="manager">Manager (all leads)</option></select>
                <button type="button" disabled={busy || !f.name.trim()} onClick={add} className="grad-brand ml-auto rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add</button>
              </div>
            </div>
          </>
        )}
        {!ctx.as && (
          <div className="rounded-xl border border-border p-2.5">
            <div className="mb-1 text-xs font-semibold text-muted">Join someone&apos;s team</div>
            <div className="flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6-letter code" className={inputCls + " tracking-widest"} maxLength={8} /><button type="button" disabled={busy || code.length < 6} onClick={join} className="rounded-xl border border-brand px-3 py-2 text-xs font-semibold text-brand-ink disabled:opacity-50">Join</button></div>
          </div>
        )}
        {msg && <p className={`text-xs ${/Joined/.test(msg) ? "text-good" : "text-danger"}`}>{msg}</p>}
      </div>
    </Sheet>
  );
}

/* ---------------- import ---------------- */
function parseRows(text: string): { name: string; phone: string; city: string; tags: string[]; note: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const split = (l: string) => (sep === "," ? (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()).filter((_, i, a) => i < a.length - 1 || _ !== "") : l.split("\t").map((c) => c.trim()));
  const first = split(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = first.some((c) => /name|phone|mobile|number|city|tag|note/.test(c));
  const idx = (re: RegExp, fallback: number) => { const i = first.findIndex((c) => re.test(c)); return hasHeader && i >= 0 ? i : fallback; };
  const iName = idx(/name/, 0), iPhone = idx(/phone|mobile|number|whatsapp/, 1), iCity = idx(/city|area|location/, 2), iTags = idx(/tag|product|interest/, 3), iNote = idx(/note|message|remark|comment/, 4);
  const out: ReturnType<typeof parseRows> = [];
  for (const l of hasHeader ? lines.slice(1) : lines) {
    const c = split(l); if (!c.length) continue;
    let phone = c[iPhone] ?? "", name = c[iName] ?? "";
    if (!/\d{10}/.test(phone.replace(/\D/g, ""))) { const alt = c.find((x) => /\d{10}/.test(x.replace(/\D/g, ""))); if (!alt) continue; phone = alt; if (name === alt) name = ""; }
    out.push({ name, phone, city: c[iCity] ?? "", tags: (c[iTags] ?? "").split(/[;|/]/).map((t) => t.trim()).filter(Boolean), note: c[iNote] ?? "" });
  }
  return out;
}
function ImportSheet({ ctx, onClose, onDone }: { ctx: Ctx; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState("");
  const rows = useMemo(() => parseRows(text), [text]);
  async function importRows() {
    setBusy(true); setRes("");
    const r = await api<{ added: number; skipped: number; error?: string }>("/api/crm/lead", { method: "POST", json: { as: ctx.as ?? undefined, leads: rows } });
    setBusy(false);
    if (!r.ok) { setRes(r.data.error || "Import failed."); return; }
    setRes(`Added ${r.data.added} lead${r.data.added === 1 ? "" : "s"}${r.data.skipped ? `, skipped ${r.data.skipped} already present` : ""}.`);
    setTimeout(onDone, 1200);
  }
  return (
    <Sheet title="Import leads" onClose={onClose}>
      <div className="space-y-2 text-sm">
        <p className="text-xs text-muted">Paste from Excel / Google Sheets (select cells → copy → paste here) or choose a CSV. Columns: <b>Name, Phone, City, Tags, Note</b> — a header row is optional; the phone column is found automatically.</p>
        <input type="file" accept=".csv,text/csv,text/plain" className="text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"Rajesh Kumar\t9876543210\tDelhi\tAura Plus\tWants demo"} className={inputCls + " font-mono text-xs"} />
        {rows.length > 0 && (
          <div className="rounded-xl border border-border p-2 text-xs">
            <div className="mb-1 font-semibold text-ink">{rows.length} lead{rows.length === 1 ? "" : "s"} found</div>
            {rows.slice(0, 5).map((r, i) => <div key={i} className="truncate text-muted">{r.name || "—"} · {r.phone}{r.city ? ` · ${r.city}` : ""}{r.tags.length ? ` · #${r.tags.join(" #")}` : ""}</div>)}
            {rows.length > 5 && <div className="text-faint">…and {rows.length - 5} more</div>}
          </div>
        )}
        {res && <p className={`text-xs ${/Added/.test(res) ? "text-good" : "text-danger"}`}>{res}</p>}
        <button type="button" disabled={busy || !rows.length} onClick={importRows} className="grad-brand w-full rounded-xl py-2.5 font-semibold text-white disabled:opacity-50">{busy ? "Importing…" : `Import ${rows.length || ""} leads`}</button>
      </div>
    </Sheet>
  );
}

/* ---------------- payment request (UPI link) ---------------- */
function PaySheet({ ctx, lead, onClose, onUse }: { ctx: Ctx; lead: Lead; onClose: () => void; onUse: (t: string) => void }) {
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const first = (lead.name || "").split(/\s+/)[0] || "";
  const amount = Math.max(0, Math.round((parseFloat(amt) || 0) * 100) / 100);
  const link = ctx.upi ? `upi://pay?pa=${encodeURIComponent(ctx.upi)}&pn=${encodeURIComponent(ctx.payee || "Payment")}${amount ? `&am=${amount.toFixed(2)}` : ""}&cu=INR${note ? `&tn=${encodeURIComponent(note.slice(0, 40))}` : ""}` : "";
  const msg = `${first ? `${first} ji, ` : ""}${amount ? `₹${amount.toLocaleString("en-IN")} ` : ""}payment ke liye:\n\n💳 UPI ID: ${ctx.upi}${amount ? `\n💰 Amount: ₹${amount.toLocaleString("en-IN")}` : ""}${note ? `\n📝 ${note}` : ""}\n\nTap to pay (any UPI app): ${link}\n\nPayment ke baad screenshot bhej dein 🙏`;
  return (
    <Sheet title="Payment request" onClose={onClose}>
      {!ctx.upi ? (
        <p className="text-sm text-muted">Add your <b>UPI ID</b> to your digital card (Card → Links → UPI) and it will be used here. Razorpay payment links come once the gateway is connected.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-xs text-muted">Sends a UPI pay link (works in GPay / PhonePe / Paytm on the customer&apos;s phone) to <b>{ctx.upi}</b>.</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="Amount ₹ (optional)" className={inputCls} autoFocus />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For (e.g. Aura Plus advance)" className={inputCls} />
          </div>
          <pre className="whitespace-pre-wrap rounded-xl bg-surface2/60 p-2.5 text-xs text-ink">{msg}</pre>
          <button type="button" onClick={() => onUse(msg)} className="grad-brand w-full rounded-xl py-2.5 font-semibold text-white">Put in message box</button>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- menu bot (flow builder) ---------------- */
type FOpt = { label: string; action: "menu" | "text" | "ai" | "human"; target?: string; reply?: string };
type FNode = { id: string; title: string; text: string; options: FOpt[] };
type FlowData = { greetNew: boolean; triggers: string[]; nodes: FNode[] };
const DEFAULT_FLOW = (): FlowData => ({
  greetNew: true, triggers: [],
  nodes: [
    { id: "main", title: "Main menu", text: "Namaste 🙏 {business} me aapka swagat hai. Main kaise madad karun?", options: [
      { label: "Products & prices", action: "menu", target: "products" },
      { label: "Book a free demo", action: "human", reply: "Zaroor! Hamari team aapko jald call karegi. Aap apna area aur suvidha ka samay likh dein 🙂" },
      { label: "Ask a question", action: "ai" },
      { label: "Talk to a person", action: "human" },
    ] },
    { id: "products", title: "Products", text: "Hamare products:", options: [
      { label: "Price list", action: "text", reply: "Poori price list aur offers yahan dekhein: {card}" },
      { label: "Ask about a product", action: "ai" },
      { label: "Talk to a person", action: "human" },
    ] },
  ],
});
const nid = () => Math.random().toString(36).slice(2, 8);
function FlowSheet({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState<FlowData | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { (async () => { const r = await api<{ enabled: boolean; data: FlowData | null }>("/api/crm/flow"); setEnabled(!!r.data?.enabled); setData(r.data?.data && r.data.data.nodes?.length ? r.data.data : null); })(); }, []);
  async function save(en = enabled) {
    if (!data) return; setBusy(true); setMsg("");
    const r = await api<{ ok: boolean; error?: string }>("/api/crm/flow", { method: "PUT", json: { enabled: en, data } });
    setBusy(false); setMsg(r.ok ? (en ? "Saved — menu bot is ON (live within a minute)." : "Saved — menu bot is OFF.") : r.data.error || "Could not save.");
    if (r.ok) setEnabled(en);
  }
  const node = data?.nodes[sel];
  const setNode = (n: FNode) => setData((d) => d && { ...d, nodes: d.nodes.map((x, i) => (i === sel ? n : x)) });
  const setOpt = (i: number, o: Partial<FOpt>) => node && setNode({ ...node, options: node.options.map((x, j) => (j === i ? { ...x, ...o } : x)) });
  const preview = node ? `${node.text}\n\n${node.options.map((o, i) => `${["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"][i]} ${o.label}`).join("\n")}\n\n_Reply with a number_` : "";
  return (
    <Sheet title="Menu bot" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted">A numbered menu customers see when they say <b>hi / menu</b> or message for the first time. Each option can open another menu, send a fixed text, hand over to the AI assistant, or hand over to you (bot pauses, you get pinged). Anything typed that isn&apos;t a menu number goes to the AI as usual.</p>
        {!data ? (
          <button type="button" onClick={() => setData(DEFAULT_FLOW())} className="w-full rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 p-3 text-brand-ink">✨ Start with a ready-made menu (Products, Demo, Ask, Talk to a person)</button>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-good" : "bg-faint"}`} /><span className="flex-1 text-ink">Menu bot is <b>{enabled ? "ON" : "OFF"}</b></span>
              <button type="button" disabled={busy} onClick={() => save(!enabled)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${enabled ? "border border-border text-muted" : "grad-brand text-white"}`}>{enabled ? "Turn off" : "Turn on"}</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={data.greetNew} onChange={(e) => setData({ ...data, greetNew: e.target.checked })} /> Show the main menu to every new contact automatically</label>
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {data.nodes.map((n, i) => <button key={n.id} type="button" onClick={() => setSel(i)} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${i === sel ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>{i === 0 ? "🏠 " : ""}{n.title || `Menu ${i + 1}`}</button>)}
              <button type="button" onClick={() => { const n = { id: nid(), title: `Menu ${data.nodes.length + 1}`, text: "", options: [] }; setData({ ...data, nodes: [...data.nodes, n] }); setSel(data.nodes.length); }} className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted">+ Menu</button>
            </div>
            {node && (
              <div className="space-y-2 rounded-xl border border-border p-2.5">
                <div className="flex gap-2">
                  <input value={node.title} onChange={(e) => setNode({ ...node, title: e.target.value })} placeholder="Menu name (internal)" className={inputCls} />
                  {sel > 0 && <button type="button" onClick={() => { setData({ ...data, nodes: data.nodes.filter((_, i) => i !== sel) }); setSel(0); }} className="rounded-xl border border-border px-2 text-danger" aria-label="Delete menu"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <textarea value={node.text} onChange={(e) => setNode({ ...node, text: e.target.value })} rows={2} placeholder="Message shown above the options ({business} and {card} work here)" className={inputCls} />
                <div className="text-xs font-semibold text-muted">Options (customer replies with the number)</div>
                {node.options.map((o, i) => (
                  <div key={i} className="rounded-lg bg-surface2/50 p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 text-center text-xs font-bold text-brand">{i + 1}</span>
                      <input value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} placeholder="Option text" className={inputCls + " py-1.5"} />
                      <button type="button" onClick={() => setNode({ ...node, options: node.options.filter((_, j) => j !== i) })} className="p-1 text-muted" aria-label="Remove"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6 text-xs">
                      <ArrowRight className="h-3 w-3 text-faint" />
                      <select value={o.action} onChange={(e) => setOpt(i, { action: e.target.value as FOpt["action"] })} className="rounded-lg border border-border bg-surface px-2 py-1">
                        <option value="menu">Open another menu</option><option value="text">Send a fixed reply</option><option value="ai">Hand over to AI assistant</option><option value="human">Hand over to me (human)</option>
                      </select>
                      {o.action === "menu" && <select value={o.target ?? ""} onChange={(e) => setOpt(i, { target: e.target.value })} className="rounded-lg border border-border bg-surface px-2 py-1"><option value="">choose menu…</option>{data.nodes.filter((_, j) => j !== sel).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</select>}
                    </div>
                    {(o.action === "text" || o.action === "human" || o.action === "ai") && <textarea value={o.reply ?? ""} onChange={(e) => setOpt(i, { reply: e.target.value })} rows={2} placeholder={o.action === "text" ? "Reply text ({card} = your card link)" : "Optional message before handing over"} className={inputCls + " mt-1.5 text-xs"} />}
                  </div>
                ))}
                {node.options.length < 9 && <button type="button" onClick={() => setNode({ ...node, options: [...node.options, { label: "", action: "ai" }] })} className="rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted">+ Option</button>}
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-semibold text-muted">Preview (as the customer sees it)</div>
              <pre className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface2/70 p-3 text-xs text-ink">{preview}</pre>
            </div>
            {msg && <p className={`text-xs ${/Saved/.test(msg) ? "text-good" : "text-danger"}`}>{msg}</p>}
            <button type="button" disabled={busy} onClick={() => save()} className="grad-brand w-full rounded-xl py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save menu"}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- integrations ---------------- */
type Integ = { inbound_token: string; inbound_url: string; outbound_url: string; outbound_secret: string; outbound_events: string[]; active: boolean; events: string[]; recent: { id: number; event: string; created_at: string; delivered_at: string | null; attempts: number; last_error: string }[] };
const SHEETS_SCRIPT = `function doPost(e) {
  var b = JSON.parse(e.postData.contents);
  var d = b.data || {};
  var sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sh.getLastRow() === 0) sh.appendRow(["Time", "Event", "Name", "Phone", "City", "Stage", "Tags", "Source", "Message / Text", "Score", "Value"]);
  sh.appendRow([new Date(), b.event, d.name || "", d.phone || "", d.city || "", d.stage || d.previous_stage || "", (d.tags || []).join(" "), d.source || d.sender || "", d.message || d.text || "", d.score || "", d.value || ""]);
  return ContentService.createTextOutput("ok");
}`;
function IntegrationsSheet({ onClose }: { onClose: () => void }) {
  const [it, setIt] = useState<Integ | null>(null);
  const [tab, setTab] = useState<"in" | "out" | "sheets">("in");
  const [f, setF] = useState({ outbound_url: "", outbound_secret: "", outbound_events: [] as string[], active: false });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await api<Integ & { error?: string }>("/api/crm/integrations"); if (!r.ok) { setMsg(r.data.error || "Could not load."); return; } setIt(r.data); setF({ outbound_url: r.data.outbound_url, outbound_secret: r.data.outbound_secret, outbound_events: r.data.outbound_events, active: r.data.active }); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { setBusy(true); setMsg(""); const r = await api<{ ok: boolean; error?: string }>("/api/crm/integrations", { method: "PUT", json: f }); setBusy(false); setMsg(r.ok ? "Saved." : r.data.error || "Could not save."); load(); }
  async function test() { setBusy(true); const r = await api<{ ok: boolean; note?: string; error?: string }>("/api/crm/integrations", { method: "POST", json: { test: true } }); setBusy(false); setMsg(r.ok ? r.data.note || "Test queued." : r.data.error || "Failed."); setTimeout(load, 65000); }
  async function regen() { if (!confirm("Old incoming URL will stop working. Continue?")) return; await api("/api/crm/integrations", { method: "PUT", json: { regenerate: true } }); load(); }
  const copy = (t: string) => { navigator.clipboard?.writeText(t); setMsg("Copied."); };
  const ex = it ? `curl -X POST "${it.inbound_url}" -H "Content-Type: application/json" -d '{"name":"Rajesh","phone":"9876543210","message":"Wants demo","source":"website","city":"Delhi"}'` : "";
  return (
    <Sheet title="Integrations" onClose={onClose}>
      {!it ? (msg ? <p className="text-xs text-danger">{msg}</p> : <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-muted" />) : (
        <div className="space-y-3 text-sm">
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-xs font-semibold">
            {([["in", "Leads in"], ["out", "Webhook out"], ["sheets", "Google Sheets"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3 py-1.5 ${tab === k ? "grad-brand text-white" : "text-muted"}`}>{l}</button>)}
          </div>
          {tab === "in" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">Send leads into this CRM from anywhere: your website form, <b>Zapier / Make</b> (Facebook Lead Ads, IndiaMART, JustDial, Google Forms), or any server. POST JSON or a form with <b>phone</b> (required), name, message, source, city, tags.</p>
              <div className="flex items-center gap-2 rounded-xl bg-surface2/60 p-2 text-xs"><code className="flex-1 truncate text-ink">{it.inbound_url}</code><button type="button" onClick={() => copy(it.inbound_url)} className="p-1 text-muted" aria-label="Copy"><Copy className="h-4 w-4" /></button></div>
              <pre className="overflow-x-auto rounded-xl bg-ink p-2.5 text-[11px] text-bg">{ex}</pre>
              <p className="text-[11px] text-faint">Zapier: Action “Webhooks by Zapier → POST”, Payload type JSON, map name / phone / message. Make: HTTP → Make a request.</p>
              <button type="button" onClick={regen} className="text-xs text-danger">Regenerate URL (revoke old)</button>
            </div>
          )}
          {tab === "out" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">We POST every event to your URL (Zapier Catch Hook, Make, n8n, your CRM/ERP). Body: <code>{"{event, id, created_at, data}"}</code>; header <code>X-Shubhora-Signature</code> = HMAC-SHA256 of the body with your secret.</p>
              <input value={f.outbound_url} onChange={(e) => setF({ ...f, outbound_url: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/…" className={inputCls} />
              <div className="flex items-center gap-2"><input value={f.outbound_secret} onChange={(e) => setF({ ...f, outbound_secret: e.target.value })} placeholder="Secret" className={inputCls + " font-mono text-xs"} /><button type="button" onClick={() => copy(f.outbound_secret)} className="p-1 text-muted" aria-label="Copy"><Copy className="h-4 w-4" /></button></div>
              <div className="flex flex-wrap gap-1.5 text-xs">{it.events.map((e) => <label key={e} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${f.outbound_events.includes(e) ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}><input type="checkbox" className="hidden" checked={f.outbound_events.includes(e)} onChange={(ev) => setF({ ...f, outbound_events: ev.target.checked ? [...f.outbound_events, e] : f.outbound_events.filter((x) => x !== e) })} />{e}</label>)}</div>
              <label className="flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Webhook ON</label>
              <div className="flex gap-2"><button type="button" disabled={busy} onClick={save} className="grad-brand flex-1 rounded-xl py-2 font-semibold text-white disabled:opacity-60">Save</button><button type="button" disabled={busy || !it.active} onClick={test} className="rounded-xl border border-border px-3 py-2 text-xs text-muted disabled:opacity-50">Send test</button></div>
              {it.recent.length > 0 && (
                <div className="text-xs"><div className="mb-1 font-semibold text-muted">Recent deliveries</div>
                  {it.recent.map((r) => <div key={r.id} className="flex items-center gap-2 border-t border-border py-1"><span className={`h-2 w-2 rounded-full ${r.delivered_at ? (r.last_error ? "bg-faint" : "bg-good") : r.attempts ? "bg-danger" : "bg-lead"}`} /><span className="text-ink">{r.event}</span><span className="ml-auto text-faint">{ago(r.created_at)}</span>{r.last_error && <span className="truncate text-danger" title={r.last_error}>{r.last_error.slice(0, 30)}</span>}</div>)}
                </div>
              )}
            </div>
          )}
          {tab === "sheets" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">Live copy of every lead/message in a Google Sheet, no login needed. 5 steps:</p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-ink">
                <li>Open a new Google Sheet → <b>Extensions → Apps Script</b>.</li>
                <li>Delete the sample code, paste the script below, save.</li>
                <li><b>Deploy → New deployment → Web app</b>: Execute as <b>Me</b>, Who has access <b>Anyone</b> → Deploy → copy the Web app URL.</li>
                <li>Paste that URL in the <b>Webhook out</b> tab, tick the events you want, switch ON, Save.</li>
                <li>Press <b>Send test</b> — a row appears in the sheet within a minute.</li>
              </ol>
              <div className="relative"><pre className="max-h-48 overflow-auto rounded-xl bg-ink p-2.5 text-[11px] text-bg">{SHEETS_SCRIPT}</pre><button type="button" onClick={() => copy(SHEETS_SCRIPT)} className="absolute right-2 top-2 rounded-lg bg-surface px-2 py-1 text-[11px] text-ink">Copy</button></div>
            </div>
          )}
          {msg && <p className={`text-xs ${/Saved|Copied|queued|Queued/.test(msg) ? "text-good" : "text-danger"}`}>{msg}</p>}
        </div>
      )}
    </Sheet>
  );
}
