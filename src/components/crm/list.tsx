"use client";
// Customers (docs/crm-pro.md 3.2): searched and paged on the server, filters as chips, list or pipeline view,
// Call / WhatsApp on every row, "Call these" to walk a filtered set.
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Plus, Phone, MessageCircle, Columns3, List, LoaderCircle, PhoneCall, SlidersHorizontal, CheckSquare, Square } from "lucide-react";
import { api } from "@/lib/poster-client";
import { Pipeline, AddLead } from "@/components/crm/crm";
import { useShell, waLink, inputCls, Chip, Avatar, StagePill, ago, isPast, isToday, CLOSED, type LeadPro } from "@/components/crm/shared";
import { STAGE_LABEL } from "@/components/crm/i18n";

type Q = { q: string; stage: string; kind: string; assigned: string; due: string; idle: number; sort: string };
const EMPTY: Q = { q: "", stage: "", kind: "", assigned: "", due: "", idle: 0, sort: "" };

export function CustomersList({ onCallThese }: { onCallThese: (leads: LeadPro[]) => void }) {
  const { L, ctx, as, openCustomer, startCall, version } = useShell();
  const [qy, setQy] = useState<Q>(EMPTY);
  const [leads, setLeads] = useState<LeadPro[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState(false);
  const [sel, setSel] = useState<Set<string> | null>(null);   // null = not selecting
  const [err, setErr] = useState("");
  const seq = useRef(0);
  const load = useCallback(async (p: number, append: boolean) => {
    const my = ++seq.current;
    const sp = new URLSearchParams({ page: String(p) });
    if (as) sp.set("as", as);
    for (const [k, v] of Object.entries(qy)) if (v) sp.set(k, String(v));
    const r = await api<{ leads: LeadPro[]; more: boolean; error?: string }>(`/api/crm/leads?${sp}`);
    if (my !== seq.current) return;
    if (!r.ok) { setErr(r.data.error || L.failed); setLeads((x) => x ?? []); return; }
    setErr(""); setMore(r.data.more); setPage(p); setLeads((x) => (append ? [...(x ?? []), ...r.data.leads] : r.data.leads));
  }, [qy, as, L.failed]);
  useEffect(() => { const t = setTimeout(() => load(0, false), qy.q ? 250 : 0); return () => clearTimeout(t); }, [load, qy.q, version]);
  const set = (p: Partial<Q>) => setQy((x) => ({ ...x, ...p }));
  const toggle = (k: keyof Q, v: string | number) => set({ [k]: qy[k] === v ? (typeof v === "number" ? 0 : "") : v } as Partial<Q>);
  const active = Object.entries(qy).filter(([k, v]) => k !== "q" && k !== "sort" && v).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted" /><input value={qy.q} onChange={(e) => set({ q: e.target.value })} placeholder={L.search} className="w-full bg-transparent outline-none placeholder:text-faint" />
          {qy.q && <button type="button" onClick={() => set({ q: "" })} aria-label="x"><X className="h-4 w-4 text-muted" /></button>}
        </label>
        <button type="button" onClick={() => setFilters((v) => !v)} className={`relative rounded-xl border p-2 ${filters || active ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`} aria-label="filters"><SlidersHorizontal className="h-4 w-4" />{active > 0 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-[9px] text-white">{active}</span>}</button>
        {ctx.role !== "agent" && <button type="button" onClick={() => setSel(sel ? null : new Set())} className={`rounded-xl border p-2 ${sel ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`} aria-label="select">{sel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button>}
        <button type="button" onClick={() => setView(view === "list" ? "pipeline" : "list")} className="rounded-xl border border-border bg-surface p-2 text-muted" aria-label="view">{view === "list" ? <Columns3 className="h-4 w-4" /> : <List className="h-4 w-4" />}</button>
        {ctx.role !== "agent" && <button type="button" onClick={() => setAdding(true)} className="grad-brand rounded-xl p-2 text-white" aria-label={L.addLead}><Plus className="h-4 w-4" /></button>}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        <Chip on={!qy.stage && !qy.kind && !qy.due && !qy.idle && !qy.assigned} onClick={() => setQy({ ...EMPTY, q: qy.q, sort: qy.sort })}>{L.all}</Chip>
        <Chip on={qy.due === "any"} onClick={() => toggle("due", "any")}>⏰ {L.filterDue}</Chip>
        <Chip on={qy.idle === 7} onClick={() => toggle("idle", 7)}>{L.filterIdle}</Chip>
        {(ctx.agents.length > 0 || as) && <Chip on={qy.assigned === "me"} onClick={() => toggle("assigned", "me")}>👤 {L.mine}</Chip>}
        {Object.keys(STAGE_LABEL).map((s) => <Chip key={s} on={qy.stage === s} onClick={() => toggle("stage", s)}>{STAGE_LABEL[s][L.lang]}</Chip>)}
      </div>
      {filters && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted">{L.lifecycle}:</span>{(["lead", "customer", "lost"] as const).map((k) => <Chip key={k} on={qy.kind === k} onClick={() => toggle("kind", k)}>{k === "lead" ? L.lead : k === "customer" ? L.customer : L.lost}</Chip>)}</div>
          {ctx.role !== "agent" && ctx.agents.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted">{L.assigned}:</span><Chip on={qy.assigned === "none"} onClick={() => toggle("assigned", "none")}>{L.unassigned}</Chip>{ctx.agents.map((a) => <Chip key={a.id} on={qy.assigned === a.id} onClick={() => toggle("assigned", a.id)}>@{a.name}</Chip>)}</div>}
          <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted">{L.sort}:</span>{([["", L.sortActivity], ["newest", L.sortNewest], ["followup", L.sortFollowup], ["value", L.sortValue], ["score", L.sortScore]] as const).map(([k, t]) => <Chip key={k} on={qy.sort === k} onClick={() => set({ sort: k })}>{t}</Chip>)}</div>
        </div>
      )}
      {err && <p className="text-xs text-danger">{err}</p>}
      {leads === null ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
        : leads.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">{active || qy.q ? L.nothing : L.noLeads}</div>
        : view === "pipeline" ? <Pipeline leads={leads} onOpen={openCustomer} />
        : (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted"><span>{leads.length}{more ? "+" : ""}</span>{leads.some((l) => !CLOSED.includes(l.status)) && <button type="button" onClick={() => onCallThese(leads.filter((l) => !CLOSED.includes(l.status)))} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-semibold text-brand-ink"><PhoneCall className="h-3 w-3" /> {L.callList}</button>}</div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {leads.map((l) => <Row key={l.id} l={l} selected={sel ? sel.has(l.id) : undefined} onToggle={() => setSel((x) => { const n = new Set(x ?? []); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} onOpen={() => openCustomer(l.id)} onCall={() => startCall(l)} />)}
            </ul>
            {more && <button type="button" onClick={() => load(page + 1, true)} className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-muted">{L.loadMore}</button>}
          </>
        )}
      {adding && <AddLead ctx={ctx} onClose={() => setAdding(false)} onAdded={(l) => { setAdding(false); openCustomer(l.id); }} />}
      {sel && <BulkBar ids={[...sel]} all={() => setSel(new Set((leads ?? []).map((l) => l.id)))} clear={() => setSel(null)} onDone={() => { setSel(null); load(0, false); }} />}
    </div>
  );
}

function Row({ l, onOpen, onCall, selected, onToggle }: { l: LeadPro; onOpen: () => void; onCall: () => void; selected?: boolean; onToggle: () => void }) {
  const { L } = useShell();
  const open = !CLOSED.includes(l.status);
  const due = open && l.next_follow_up ? (isPast(l.next_follow_up) ? "overdue" : isToday(l.next_follow_up) ? "today" : "later") : null;
  return (
    <li className={`flex items-center gap-2 px-2.5 py-2.5 ${selected ? "bg-brand-soft/40" : ""}`}>
      {selected !== undefined && <button type="button" onClick={onToggle} className="shrink-0 text-brand-ink" aria-label="select">{selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-faint" />}</button>}
      <button type="button" onClick={selected !== undefined ? onToggle : onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <div className="relative"><Avatar name={l.name} phone={l.phone} size={11} />{l.score >= 70 && open && <span className="absolute -right-0.5 -top-0.5 text-[10px]">🔥</span>}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2"><span className={`truncate text-sm ${l.unread ? "font-bold" : "font-semibold"} text-ink`}>{l.name || l.phone || "—"}</span><span className="ml-auto shrink-0 text-[11px] text-faint">{ago(l.last_activity_at || l.created_at, L.hi)}</span></div>
          <p className={`truncate text-xs ${l.unread ? "text-ink" : "text-muted"}`}>{l.ai_next || l.message || l.ai_intent || l.city || "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <StagePill status={l.status} hi={L.hi} />
            {l.kind === "customer" && <span className="rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] text-good">★</span>}
            {(l.tags ?? []).slice(0, 2).map((t) => <span key={t} className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">#{t}</span>)}
            {due && <span className={`ml-auto text-[10px] font-medium ${due === "overdue" ? "text-danger" : due === "today" ? "text-lead" : "text-muted"}`}>⏰ {due === "overdue" ? L.overdueTag : due === "today" ? L.todayTag : ago(l.next_follow_up, L.hi)}</span>}
            {l.unread > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{l.unread}</span>}
          </div>
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        <button type="button" onClick={onCall} className="rounded-lg bg-brand-soft p-2 text-brand-ink" aria-label={L.call}><Phone className="h-4 w-4" /></button>
        <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className="rounded-lg bg-good/10 p-2 text-good" aria-label={L.whatsapp}><MessageCircle className="h-4 w-4" /></a>
      </div>
    </li>
  );
}

/* ---------------- bulk actions (docs/crm-pro.md 3.2) ---------------- */
function BulkBar({ ids, all, clear, onDone }: { ids: string[]; all: () => void; clear: () => void; onDone: () => void }) {
  const { L, ctx, as, ws } = useShell();
  const [mode, setMode] = useState<"" | "assign" | "stage" | "tag" | "send">("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState("");
  async function run(action: string, v: string | null) {
    if (!ids.length || busy) return; setBusy(true); setRes("");
    const r = await api<{ done: number; failed: number; skipped: number; error?: string }>("/api/crm/bulk", { method: "POST", json: { ids, action, value: v, as: as ?? undefined } });
    setBusy(false);
    if (!r.ok) { setRes(r.data.error || L.failed); return; }
    setRes(`✓ ${r.data.done}${r.data.failed ? ` · ✗ ${r.data.failed}` : ""}${r.data.skipped ? ` · – ${r.data.skipped}` : ""}`);
    setTimeout(onDone, 900);
  }
  const hi = L.hi;
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-lg px-3 md:bottom-4">
      <div className="rounded-2xl border border-border bg-surface p-2.5 shadow-xl">
        <div className="flex items-center gap-2 text-xs">
          <b className="text-ink">{ids.length}</b><button type="button" onClick={all} className="text-brand-ink">{L.all}</button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {ctx.agents.length > 0 && <Chip on={mode === "assign"} onClick={() => setMode(mode === "assign" ? "" : "assign")}>{L.assigned}</Chip>}
            <Chip on={mode === "stage"} onClick={() => setMode(mode === "stage" ? "" : "stage")}>{L.stage}</Chip>
            <Chip on={mode === "tag"} onClick={() => setMode(mode === "tag" ? "" : "tag")}>#tag</Chip>
            <Chip on={mode === "send"} onClick={() => setMode(mode === "send" ? "" : "send")} tone="good">{L.whatsapp}</Chip>
            <button type="button" onClick={clear} className="p-1 text-muted" aria-label={L.close}><X className="h-4 w-4" /></button>
          </div>
        </div>
        {mode === "assign" && <div className="mt-2 flex flex-wrap gap-1.5"><Chip onClick={() => run("assign", null)}>{L.nobody}</Chip>{ctx.agents.map((a) => <Chip key={a.id} onClick={() => run("assign", a.id)}>@{a.name}</Chip>)}</div>}
        {mode === "stage" && <div className="mt-2 flex flex-wrap gap-1.5">{Object.keys(STAGE_LABEL).map((s) => <Chip key={s} onClick={() => run("stage", s)} tone={s === "converted" ? "good" : s === "lost" ? "danger" : "brand"}>{STAGE_LABEL[s][L.lang]}</Chip>)}</div>}
        {mode === "tag" && <div className="mt-2 flex gap-2"><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="#tag" className={inputCls} /><button type="button" disabled={!value.trim() || busy} onClick={() => run("tag", value)} className="grad-brand rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-50">{L.add}</button><button type="button" disabled={!value.trim() || busy} onClick={() => run("untag", value)} className="rounded-xl border border-border px-3 text-xs">−</button></div>}
        {mode === "send" && (
          <div className="mt-2 space-y-1.5">
            <textarea value={value} onChange={(e) => setValue(e.target.value.slice(0, 900))} rows={3} placeholder={hi ? "नमस्ते {name} जी 🙏 …" : "Hi {name} 🙏 …"} className={inputCls} />
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted"><span>{ws.wa !== "connected" ? L.waNotLinked : hi ? "{name} की जगह ग्राहक का नाम · opt-out छोड़ दिए जाते हैं" : "{name} = first name · opted-out customers are skipped"}</span><button type="button" disabled={ws.wa !== "connected" || value.trim().length < 10 || busy} onClick={() => run("send", value)} className="grad-brand rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "…" : `${L.whatsapp} → ${ids.length}`}</button></div>
          </div>
        )}
        {res && <p className="mt-1.5 text-xs font-semibold text-brand-ink">{res}</p>}
      </div>
    </div>
  );
}
