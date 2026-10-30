"use client";
// Orders & job cards (owner, 30 Oct 2026 — a saree showroom: fall-pico, blouse stitching, alterations by karigars and
// tailors; every garment's status at a glance). The list, the filters and "New order".
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, Plus, Ruler, Search, Trash2, Users, X } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { ITEM_PICKS, STATUS_LABEL, WORK_PICKS, rupees, type JobRow, type JobStatus, type Karigar, type Measurement } from "@/lib/jobs";
import { MeasureForm, MeasurementView, StatusBadge, WorkspaceSwitch, useWorkspace, type Member } from "@/components/orders/orders-common";

type ListAnswer = { jobs: JobRow[]; role: "owner" | "manager" | "agent"; karigars: Karigar[]; team: Member[]; counts: Record<string, number>; error?: string };
const FILTERS: ("open" | JobStatus | "all")[] = ["open", "received", "cutting", "stitching", "finishing", "ready", "delivered", "all"];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function OrdersPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const ws = useWorkspace();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<ListAnswer | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { (async () => { if (!(await isLoggedIn())) { router.replace("/login?next=/poster/orders"); return; } setReady(true); })(); }, [router]);
  const load = useCallback(async () => {
    const p = new URLSearchParams(ws.q);
    if (filter !== "all") p.set("status", filter);
    if (q.trim()) p.set("q", q.trim());
    const r = await api<ListAnswer>(`/api/jobs?${p}`, { fresh: true });
    if (!r.ok) { setErr(r.data?.error || T("Could not load. Please try again.", "Load नहीं हुआ। फिर try करें।")); return; }
    setErr(""); setData(r.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.q, filter, q]);
  useEffect(() => { if (!ready) return; const t = setTimeout(() => void load(), q ? 300 : 0); return () => clearTimeout(t); }, [ready, load, q]);

  if (!ready || (!data && !err)) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const counts = data?.counts ?? {};
  const openCount = Object.entries(counts).filter(([s]) => s !== "delivered" && s !== "cancelled").reduce((a, [, n]) => a + n, 0);
  const boss = data?.role !== "agent";
  const kName = (id: string | null) => data?.karigars.find((k) => k.id === id)?.name ?? "";
  const tName = (id: string | null) => data?.team.find((m) => m.id === id)?.name ?? "";

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-lg font-bold">🧵 {T("Orders & job cards", "Orders · Silai")}</h1>
        <WorkspaceSwitch as={ws.as} setAs={ws.setAs} teams={ws.teams} hi={hi} />
        {boss && <Link href={`/poster/orders/karigars`} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"><Users className="h-4 w-4" /> {T("Karigars", "कारीगर")}</Link>}
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-xl grad-brand px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {T("New order", "नया order")}</button>
      </div>

      {creating && data && <NewOrder hi={hi} q={ws.q} data={data} onClose={() => setCreating(false)} onSaved={(jobs) => { setCreating(false); if (jobs.length === 1) router.push(`/poster/orders/${jobs[0].id}`); else void load(); }} />}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const n = f === "open" ? openCount : f === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[f] ?? 0;
          const label = f === "open" ? T("In work", "चालू") : f === "all" ? T("All", "सब") : hi ? STATUS_LABEL[f].hi : STATUS_LABEL[f].en;
          return <button key={f} type="button" onClick={() => setFilter(f)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === f ? "border-brand bg-brand text-white font-semibold" : "border-border bg-surface"}`}>{label} <span className="opacity-70">{n}</span></button>;
        })}
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Name, mobile, job number, item…", "नाम, मोबाइल, job नंबर, item…")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {data && data.jobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {T("No orders here yet. Tap “New order” when a customer gives a saree or blouse for work.", "अभी कोई order नहीं। ग्राहक साड़ी या blouse काम के लिए दे तो “नया order” दबाएँ।")}
        </div>
      )}
      <ul className="space-y-2">
        {data?.jobs.map((j) => {
          const late = j.due_date && j.due_date < today() && !["ready", "delivered", "cancelled"].includes(j.status);
          return (
            <li key={j.id}>
              <Link href={`/poster/orders/${j.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-black text-brand-ink">#{j.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-sm">{j.customer_name}</b><StatusBadge status={j.status} hi={hi} /></span>
                  <span className="block truncate text-xs text-muted">{[j.item, j.work].filter(Boolean).join(" · ")}{kName(j.karigar_id) ? ` · ${kName(j.karigar_id)}` : ""}{tName(j.assigned_to) ? ` · ${tName(j.assigned_to)}` : ""}</span>
                  {j.due_date && <span className={`block text-[11px] ${late ? "font-bold text-danger" : "text-muted"}`}>{late ? T("Late — due ", "देर — देना था ") : T("Due ", "देना है ")}{new Date(`${j.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                </span>
                {j.amount_paise > 0 && <span className="shrink-0 text-right text-xs"><b>{rupees(j.amount_paise)}</b>{j.amount_paise > j.advance_paise && <span className="block text-[11px] text-amber-700">{T("due", "बाकी")} {rupees(j.amount_paise - j.advance_paise)}</span>}</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Item = { item: string; work: string; details: string; amount: string; karigar_id: string; assigned_to: string; qty: string };
const blank = (): Item => ({ item: "", work: "", details: "", amount: "", karigar_id: "", assigned_to: "", qty: "1" });

function NewOrder({ hi, q, data, onClose, onSaved }: { hi: boolean; q: string; data: ListAnswer; onClose: () => void; onSaved: (jobs: JobRow[]) => void }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [due, setDue] = useState(""); const [advance, setAdvance] = useState("");
  const [items, setItems] = useState<Item[]>([blank()]);
  const [past, setPast] = useState<Measurement[]>([]);
  const [measureId, setMeasureId] = useState("");
  const [measuring, setMeasuring] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const boss = data.role !== "agent";
  const ten = phone.replace(/\D/g, "").slice(-10);

  // A returning customer: their saved measurements come up as soon as the number is typed.
  useEffect(() => {
    if (ten.length !== 10) { setPast([]); return; }
    let off = false;
    (async () => {
      const p = new URLSearchParams(q); p.set("phone", ten);
      const r = await api<{ measurements: Measurement[] }>(`/api/jobs/measurements?${p}`, { fresh: true });
      if (!off && r.ok) { setPast(r.data.measurements); setMeasureId(r.data.measurements[0]?.id ?? ""); }
    })();
    return () => { off = true; };
  }, [ten, q]);

  const set = (i: number, patch: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  async function save() {
    setErr(""); setBusy(true);
    const r = await api<{ jobs?: JobRow[]; error?: string }>("/api/jobs", { method: "POST", json: {
      as: new URLSearchParams(q).get("as") || undefined, customer_name: name, customer_phone: phone, due_date: due || undefined, advance,
      items: items.map((x) => ({ ...x, measurement_id: measureId || undefined, karigar_id: x.karigar_id || undefined, assigned_to: x.assigned_to || undefined })),
    } });
    setBusy(false);
    if (!r.ok || !r.data.jobs) { setErr(r.data.error || T("Could not save.", "सेव नहीं हुआ।")); return; }
    onSaved(r.data.jobs);
  }
  const field = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand";
  const chip = (on: boolean) => `shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-brand bg-brand-soft font-semibold text-brand-ink" : "border-border bg-surface"}`;
  return (
    <section className="space-y-3 rounded-2xl border border-brand/40 bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between"><h2 className="font-bold">{T("New order", "नया order")}</h2><button type="button" onClick={onClose} aria-label="Close" className="text-muted"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={field} placeholder={T("Customer name", "ग्राहक का नाम")} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder={T("Mobile (for WhatsApp updates)", "मोबाइल (WhatsApp update के लिए)")} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="text-[11px] font-semibold text-muted">{T("Delivery date", "देने की तारीख")}<input type="date" className={field} value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <label className="text-[11px] font-semibold text-muted">{T("Advance received ₹", "Advance मिला ₹")}<input inputMode="decimal" className={field} value={advance} onChange={(e) => setAdvance(e.target.value)} /></label>
      </div>

      {ten.length === 10 && (
        <div className="space-y-2 rounded-xl bg-bg p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Ruler className="h-4 w-4 text-brand" /> {T("Measurements", "नाप")}</p>
          {past.length > 0 && (
            <>
              <select value={measureId} onChange={(e) => setMeasureId(e.target.value)} className={field}>
                <option value="">{T("Don't attach", "नाप न जोड़ें")}</option>
                {past.map((m) => <option key={m.id} value={m.id}>{m.garment} · {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</option>)}
              </select>
              {measureId && past.find((m) => m.id === measureId) && <MeasurementView m={past.find((m) => m.id === measureId)!} hi={hi} />}
            </>
          )}
          {measuring
            ? <MeasureForm hi={hi} q={q} phone={phone} name={name} onSaved={(m) => { setPast([m, ...past]); setMeasureId(m.id); setMeasuring(false); }} onCancel={() => setMeasuring(false)} />
            : <button type="button" onClick={() => setMeasuring(true)} className="text-xs font-semibold text-brand-ink underline">+ {past.length ? T("Take new measurements", "नया नाप लें") : T("Take measurements", "नाप लें")}</button>}
        </div>
      )}

      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between"><p className="text-xs font-bold text-muted">{T("Item", "Item")} {i + 1}</p>{items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove" className="text-muted"><Trash2 className="h-4 w-4" /></button>}</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">{ITEM_PICKS.map((p) => <button key={p} type="button" onClick={() => set(i, { item: p })} className={chip(it.item === p)}>{p}</button>)}</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">{WORK_PICKS.map((p) => <button key={p} type="button" onClick={() => set(i, { work: p })} className={chip(it.work === p)}>{p}</button>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder={T("Item (e.g. Saree)", "Item (जैसे साड़ी)")} value={it.item} onChange={(e) => set(i, { item: e.target.value })} />
            <input className={field} placeholder={T("Work (e.g. Fall-pico)", "काम (जैसे Fall-pico)")} value={it.work} onChange={(e) => set(i, { work: e.target.value })} />
          </div>
          <textarea className={field} rows={2} placeholder={T("Details — colour, design, lining, photo reference…", "Detail — रंग, design, lining, photo reference…")} value={it.details} onChange={(e) => set(i, { details: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} inputMode="decimal" placeholder={T("Charge ₹", "Charge ₹")} value={it.amount} onChange={(e) => set(i, { amount: e.target.value })} />
            <input className={field} inputMode="numeric" placeholder={T("Pieces", "Pieces")} value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} />
            {boss && (
              <select className={field} value={it.karigar_id} onChange={(e) => set(i, { karigar_id: e.target.value })}>
                <option value="">{T("Karigar (later)", "कारीगर (बाद में)")}</option>
                {data.karigars.filter((k) => k.active).map((k) => <option key={k.id} value={k.id}>{k.name}{k.skill ? ` · ${k.skill}` : ""}</option>)}
              </select>
            )}
            {boss && data.team.length > 0 && (
              <select className={field} value={it.assigned_to} onChange={(e) => set(i, { assigned_to: e.target.value })}>
                <option value="">{T("Tailor in the app (later)", "App वाला tailor (बाद में)")}</option>
                {data.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, blank()])} className="text-sm font-semibold text-brand-ink underline">+ {T("Another item", "एक और item")}</button>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{T("Save order", "Order सेव करें")}</button>
    </section>
  );
}
