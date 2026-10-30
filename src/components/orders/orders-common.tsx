"use client";
// Shared bits of the Orders screens: the workspace (own shop, or a shop the person joined as a tailor — the CRM team),
// the status badge, and the measurement form.
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/poster-client";
import { MEASURE_FIELDS, MEASURE_GARMENTS, STATUS_LABEL, type JobStatus, type Measurement } from "@/lib/jobs";

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

export function MeasurementView({ m, hi }: { m: Measurement; hi: boolean }) {
  const entries = Object.entries(m.values ?? {});
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold">{m.garment} <span className="text-xs font-normal text-muted">({m.unit === "cm" ? "cm" : hi ? "इंच" : "inch"})</span></p>
        <p className="text-[11px] text-muted">{new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{m.taken_by_name ? ` · ${m.taken_by_name}` : ""}</p>
      </div>
      {entries.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {entries.map(([k, v]) => <p key={k} className="flex justify-between gap-2 border-b border-dashed border-border py-1 text-sm"><span className="text-muted">{k}</span><b>{v}</b></p>)}
        </div>
      )}
      {m.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{m.notes}</p>}
    </div>
  );
}

/** The tailor notes the customer's measurements: pick the garment, fill what applies. */
export function MeasureForm({ hi, q, phone, name, jobId, onSaved, onCancel }: { hi: boolean; q: string; phone: string; name: string; jobId?: string; onSaved: (m: Measurement) => void; onCancel?: () => void }) {
  const [garment, setGarment] = useState("Blouse");
  const [unit, setUnit] = useState<"inch" | "cm">("inch");
  const [values, setValues] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<{ k: string; v: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fields = MEASURE_FIELDS[garment] ?? [];
  async function save() {
    setErr(""); setBusy(true);
    const all: Record<string, string> = { ...values };
    for (const e of extra) if (e.k.trim() && e.v.trim()) all[e.k.trim()] = e.v.trim();
    const r = await api<{ measurement?: Measurement; error?: string }>(`/api/jobs/measurements`, { method: "POST", json: { as: new URLSearchParams(q).get("as") || undefined, customer_phone: phone, customer_name: name, garment, unit, values: all, notes, job_id: jobId } });
    setBusy(false);
    if (!r.ok || !r.data.measurement) { setErr(r.data.error || (hi ? "सेव नहीं हुआ।" : "Could not save.")); return; }
    onSaved(r.data.measurement);
  }
  const field = "w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-3 rounded-2xl border border-brand/30 bg-brand-soft/30 p-3">
      <div className="flex flex-wrap gap-1.5">
        {MEASURE_GARMENTS.map((g) => <button key={g} type="button" onClick={() => setGarment(g)} className={`rounded-full border px-3 py-1.5 text-xs ${garment === g ? "border-brand bg-brand text-white font-semibold" : "border-border bg-surface"}`}>{g}</button>)}
        <span className="ml-auto inline-flex overflow-hidden rounded-full border border-border text-xs">
          {(["inch", "cm"] as const).map((u) => <button key={u} type="button" onClick={() => setUnit(u)} className={`px-3 py-1.5 ${unit === u ? "bg-brand text-white font-semibold" : "bg-surface"}`}>{u === "inch" ? (hi ? "इंच" : "inch") : "cm"}</button>)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map((f) => (
          <label key={f} className="text-[11px] font-semibold text-muted">{f}
            <input inputMode="decimal" value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} className={field} />
          </label>
        ))}
      </div>
      {extra.map((e, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <input placeholder={hi ? "नाप का नाम" : "Name"} value={e.k} onChange={(ev) => setExtra(extra.map((x, j) => (j === i ? { ...x, k: ev.target.value } : x)))} className={field} />
          <input placeholder={hi ? "नाप" : "Value"} value={e.v} onChange={(ev) => setExtra(extra.map((x, j) => (j === i ? { ...x, v: ev.target.value } : x)))} className={field} />
        </div>
      ))}
      <button type="button" onClick={() => setExtra([...extra, { k: "", v: "" }])} className="text-xs font-semibold text-brand-ink underline">+ {hi ? "और नाप" : "Another measurement"}</button>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={hi ? "Note — जैसे: गला गहरा, बाजू में piping, dori back में" : "Notes — e.g. deep neck, piping on sleeves, back dori"} className={field} />
      {err && <p className="text-xs font-semibold text-danger">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{hi ? "नाप सेव करें" : "Save measurements"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2 text-sm">{hi ? "रहने दें" : "Cancel"}</button>}
      </div>
    </div>
  );
}
