"use client";
// Shared bits of the Orders screens: the workspace (own shop, or a shop the person joined as a tailor — the CRM team),
// the status badge, the fold-away card, the shop's setup and the measurement editor.
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { DEFAULT_SETUP, STATUS_LABEL, fieldsFor, itemTypeOf, type JobSetup, type JobStatus, type Measurement } from "@/lib/jobs";

export const WS_KEY = "akp-crm-ws";   // the same choice as the Customers (CRM) screen
export type Team = { owner_id: string; role: "agent" | "manager"; owner_name: string };
export type Member = { id: string; name: string; role: "agent" | "manager" };

/** Which shop the person is working in: their own (as = null) or one they joined. */
export function useWorkspace() {
  const [as, setAsState] = useState<string | null>(() => { try { return localStorage.getItem(WS_KEY); } catch { return null; } });
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => { (async () => {
    const r = await api<{ teams?: Team[] }>(`/api/crm/workspace${as ? `?as=${as}` : ""}`);
    if (r.ok) setTeams(r.data.teams ?? []);
    else if (as) { setAsState(null); try { localStorage.removeItem(WS_KEY); } catch { /* ignore */ } }
  })(); }, [as]);
  const setAs = useCallback((id: string | null) => { setAsState(id); try { if (id) localStorage.setItem(WS_KEY, id); else localStorage.removeItem(WS_KEY); } catch { /* ignore */ } }, []);
  const q = as ? `as=${as}` : "";
  return { as, setAs, teams, q };
}

export function WorkspaceSwitch({ as, setAs, teams, hi }: { as: string | null; setAs: (id: string | null) => void; teams: Team[]; hi: boolean }) {
  if (!teams.length) return null;
  return (
    <select value={as ?? ""} onChange={(e) => setAs(e.target.value || null)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
      <option value="">{hi ? "मेरी दुकान" : "My shop"}</option>
      {teams.map((t) => <option key={t.owner_id} value={t.owner_id}>{t.owner_name}</option>)}
    </select>
  );
}

export function StatusBadge({ status, hi }: { status: JobStatus; hi: boolean }) {
  const s = STATUS_LABEL[status];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${s.tone}`}>{hi ? s.hi : s.en}</span>;
}

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** A card that folds away (owner: "minimise ka button lagao"): the header always shows, with a short summary when folded. */
export function Fold({ title, icon, summary, open, onToggle, hi, right, children, tone = "card" }: {
  title: React.ReactNode; icon?: React.ReactNode; summary?: React.ReactNode; open: boolean; onToggle: () => void; hi: boolean;
  right?: React.ReactNode; children: React.ReactNode; tone?: "card" | "inner";
}) {
  const box = tone === "card" ? "rounded-2xl border border-border bg-surface shadow-card" : "rounded-xl border border-border bg-bg";
  return (
    <section className={box}>
      <div className="flex items-center gap-2 px-3.5 py-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          {icon}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{title}</span>
            {!open && summary && <span className="block truncate text-xs text-muted">{summary}</span>}
          </span>
        </button>
        {right}
        <button type="button" onClick={onToggle} className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-muted">
          {open ? <><ChevronUp className="h-3.5 w-3.5" />{hi ? "छोटा करें" : "Minimise"}</> : <><ChevronDown className="h-3.5 w-3.5" />{hi ? "खोलें" : "Open"}</>}
        </button>
      </div>
      {open && <div className="space-y-3 border-t border-border px-3.5 pb-3.5 pt-3">{children}</div>}
    </section>
  );
}

/** The shop's items / measurement fields / kinds of work. The owner or a manager can add to them right where they are needed. */
export function useJobSetup(q: string, initial?: JobSetup | null) {
  const [setup, setSetup] = useState<JobSetup>(initial ?? DEFAULT_SETUP);
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => { (async () => {
    const r = await api<{ setup: JobSetup; canEdit: boolean }>(`/api/jobs/setup${q ? `?${q}` : ""}`, { fresh: true });
    if (r.ok) { setSetup(r.data.setup); setCanEdit(r.data.canEdit); }
  })(); }, [q]);
  const save = useCallback(async (next: JobSetup) => {
    setSetup(next);
    const r = await api<{ setup?: JobSetup }>("/api/jobs/setup", { method: "PUT", json: { as: new URLSearchParams(q).get("as") || undefined, setup: next } });
    if (r.ok && r.data.setup) setSetup(r.data.setup);
    return r.ok;
  }, [q]);
  const addItem = useCallback((name: string) => {
    const n = name.trim(); if (!n || itemTypeOf(setup, n)) return;
    void save({ ...setup, items: [...setup.items, { name: n, fields: [] }] });
  }, [setup, save]);
  const addWork = useCallback((name: string) => {
    const n = name.trim(); if (!n || setup.works.some((w) => w.toLowerCase() === n.toLowerCase())) return;
    void save({ ...setup, works: [...setup.works, n] });
  }, [setup, save]);
  const addField = useCallback((item: string, field: string) => {
    const f = field.trim(), it = itemTypeOf(setup, item); if (!f) return;
    const items = it
      ? setup.items.map((x) => (x === it && !x.fields.some((y) => y.toLowerCase() === f.toLowerCase()) ? { ...x, fields: [...x.fields, f] } : x))
      : [...setup.items, { name: item.trim(), fields: [f] }];
    void save({ ...setup, items });
  }, [setup, save]);
  return { setup, canEdit, save, addItem, addWork, addField };
}
export type SetupApi = ReturnType<typeof useJobSetup>;

/** Chips to pick from, plus "+ New" that types a new one (kept in the shop's list when the person may change the setup). */
export function PickChips({ options, value, onPick, onAdd, hi, newLabel }: { options: string[]; value: string; onPick: (v: string) => void; onAdd?: (v: string) => void; hi: boolean; newLabel: string }) {
  const [adding, setAdding] = useState(false); const [v, setV] = useState("");
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand text-white font-semibold" : "border-border bg-surface"}`;
  const custom = value && !options.some((o) => o.toLowerCase() === value.toLowerCase());
  const done = () => { const n = v.trim(); if (n) { onPick(n); onAdd?.(n); } setV(""); setAdding(false); };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => <button key={o} type="button" onClick={() => onPick(value === o ? "" : o)} className={chip(value === o)}>{o}</button>)}
      {custom && <button type="button" onClick={() => onPick("")} className={chip(true)}>{value}</button>}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); done(); } if (e.key === "Escape") setAdding(false); }}
            placeholder={newLabel} className="w-36 rounded-full border border-brand bg-surface px-3 py-1.5 text-xs outline-none" />
          <button type="button" onClick={done} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">{hi ? "जोड़ें" : "Add"}</button>
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-brand px-3 py-1.5 text-xs font-semibold text-brand-ink"><Plus className="h-3 w-3" />{hi ? "नया" : "New"}</button>
      )}
    </div>
  );
}

export function MeasurementView({ m, hi, onEdit, action }: { m: Measurement; hi: boolean; onEdit?: () => void; action?: React.ReactNode }) {
  const entries = Object.entries(m.values ?? {});
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{m.garment} <span className="text-xs font-normal text-muted">({m.unit === "cm" ? "cm" : hi ? "इंच" : "inch"}){m.customer_name ? ` · ${m.customer_name}` : ""}</span></p>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-muted">{dateOf(m.created_at)}{m.taken_by_name ? ` · ${m.taken_by_name}` : ""}</span>
          {onEdit && <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold"><Pencil className="h-3 w-3" />{hi ? "नाप बदलें" : "Change"}</button>}
          {action}
        </span>
      </div>
      {entries.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {entries.map(([k, v]) => <p key={k} className="flex justify-between gap-2 border-b border-dashed border-border py-1 text-sm"><span className="text-muted">{k}</span><b>{v}</b></p>)}
        </div>
      )}
      {m.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">📝 {m.notes}</p>}
    </div>
  );
}

/** A measurement being written (not saved yet). */
export type MeasureDraft = { unit: "inch" | "cm"; values: Record<string, string>; notes: string; person: string };
export const blankDraft = (unit: "inch" | "cm" = "inch"): MeasureDraft => ({ unit, values: {}, notes: "", person: "" });
export const draftFrom = (m: Measurement): MeasureDraft => ({ unit: m.unit, values: { ...(m.values ?? {}) }, notes: m.notes ?? "", person: "" });
export const draftFilled = (d: MeasureDraft) => Object.values(d.values).some((v) => v.trim()) || !!d.notes.trim();

/** The measurement fields of one item, from the shop's setup. "+ Field" adds one here — and, for the owner / a manager,
 *  can keep it in this item's list for next time. Fields filled earlier that are no longer in the list still show. */
export function MeasureEditor({ hi, item, draft, onChange, setup, showPerson = true }: { hi: boolean; item: string; draft: MeasureDraft; onChange: (d: MeasureDraft) => void; setup: SetupApi; showPerson?: boolean }) {
  const [adding, setAdding] = useState(false); const [nf, setNf] = useState(""); const [keep, setKeep] = useState(true);
  const base = fieldsFor(setup.setup, item);
  const extra = Object.keys(draft.values).filter((k) => !base.some((b) => b.toLowerCase() === k.toLowerCase()));
  const fields = [...base, ...extra];
  const set = (k: string, v: string) => onChange({ ...draft, values: { ...draft.values, [k]: v } });
  const drop = (k: string) => { const values = { ...draft.values }; delete values[k]; onChange({ ...draft, values }); };
  const addF = () => {
    const f = nf.trim(); if (!f) return;
    if (!fields.some((x) => x.toLowerCase() === f.toLowerCase())) onChange({ ...draft, values: { ...draft.values, [f]: "" } });
    if (keep && setup.canEdit && item.trim()) setup.addField(item, f);
    setNf(""); setAdding(false);
  };
  const input = "w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showPerson && <input value={draft.person} onChange={(e) => onChange({ ...draft, person: e.target.value })} placeholder={hi ? "किसका नाप? (खाली = ग्राहक)" : "Whose? (blank = customer)"} className={`${input} min-w-0 flex-1`} />}
        <span className="ml-auto inline-flex overflow-hidden rounded-full border border-border text-xs">
          {(["inch", "cm"] as const).map((u) => <button key={u} type="button" onClick={() => onChange({ ...draft, unit: u })} className={`px-3 py-1.5 ${draft.unit === u ? "bg-brand font-semibold text-white" : "bg-surface"}`}>{u === "inch" ? (hi ? "इंच" : "inch") : "cm"}</button>)}
        </span>
      </div>
      {fields.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fields.map((f) => (
            <label key={f} className="relative text-[11px] font-semibold text-muted">
              <span className="flex items-center justify-between">{f}{extra.includes(f) && <button type="button" onClick={() => drop(f)} aria-label="Remove" className="text-muted"><X className="h-3 w-3" /></button>}</span>
              <input inputMode="decimal" value={draft.values[f] ?? ""} onChange={(e) => set(f, e.target.value)} className={input} />
            </label>
          ))}
        </div>
      ) : <p className="text-xs text-muted">{hi ? "इस item के लिए कोई नाप-field नहीं — नीचे “+ Field” से जोड़ें।" : "No measurement fields for this item — add with “+ Field”."}</p>}
      {adding ? (
        <div className="space-y-2 rounded-lg border border-dashed border-brand p-2">
          <div className="flex gap-2">
            <input autoFocus value={nf} onChange={(e) => setNf(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addF(); } }} placeholder={hi ? "Field का नाम (जैसे Neck depth)" : "Field name (e.g. Neck depth)"} className={input} />
            <button type="button" onClick={addF} className="shrink-0 rounded-lg bg-brand px-3 text-xs font-semibold text-white">{hi ? "जोड़ें" : "Add"}</button>
            <button type="button" onClick={() => setAdding(false)} className="shrink-0 text-muted" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          {setup.canEdit && item.trim() && <label className="flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />{hi ? `हमेशा के लिए “${item}” के नाप में जोड़ें` : `Keep it in “${item}” for next time`}</label>}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink"><Plus className="h-3.5 w-3.5" />{hi ? "Field जोड़ें" : "Add a field"}</button>
      )}
      <textarea value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} rows={2} placeholder={hi ? "Note — जैसे: गला गहरा, बाजू में piping, dori back में" : "Notes — e.g. deep neck, piping on sleeves, back dori"} className={input} />
    </div>
  );
}

/** Take or change a measurement on its own (the job card). Changing saves a new copy; the old one stays in the history. */
export function MeasureForm({ hi, q, phone, name, jobId, item, setup, from, onSaved, onCancel }: {
  hi: boolean; q: string; phone: string; name: string; jobId?: string; item: string; setup: SetupApi; from?: Measurement | null;
  onSaved: (m: Measurement) => void; onCancel?: () => void;
}) {
  const withFields = setup.setup.items.filter((i) => i.fields.length > 0).map((i) => i.name);
  const [garment, setGarment] = useState(from?.garment || item || withFields[0] || "");
  const [draft, setDraft] = useState<MeasureDraft>(from ? { ...draftFrom(from), person: from.customer_name !== name ? from.customer_name : "" } : blankDraft(setup.setup.unit));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function save() {
    setErr(""); setBusy(true);
    const r = await api<{ measurement?: Measurement; error?: string }>(`/api/jobs/measurements`, { method: "POST", json: {
      as: new URLSearchParams(q).get("as") || undefined, customer_phone: phone, customer_name: name, person: draft.person, garment,
      unit: draft.unit, values: draft.values, notes: draft.notes, job_id: jobId, base_id: from?.id,
    } });
    setBusy(false);
    if (!r.ok || !r.data.measurement) { setErr(r.data.error || (hi ? "सेव नहीं हुआ।" : "Could not save.")); return; }
    onSaved(r.data.measurement);
  }
  return (
    <div className="space-y-3 rounded-2xl border border-brand/30 bg-brand-soft/20 p-3">
      <p className="text-xs font-bold text-brand-ink">{from ? (hi ? "नाप बदलें — पुराना नाप history में रहेगा" : "Change the measurement — the old one stays in history") : (hi ? "नया नाप" : "New measurement")}</p>
      {!from && <PickChips hi={hi} options={withFields} value={garment} onPick={setGarment} newLabel={hi ? "Item का नाम" : "Item name"} />}
      {garment
        ? <MeasureEditor hi={hi} item={garment} draft={draft} onChange={setDraft} setup={setup} />
        : <p className="text-xs text-muted">{hi ? "पहले चुनें किस चीज़ का नाप है।" : "First pick what it is for."}</p>}
      {err && <p className="text-xs font-semibold text-danger">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || !garment || !draftFilled(draft)} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{hi ? "नाप सेव करें" : "Save measurement"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm">{hi ? "रहने दें" : "Cancel"}</button>}
      </div>
    </div>
  );
}
