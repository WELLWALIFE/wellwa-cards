"use client";
// Super Admin → Leads: every lead from the platform's own website — "Contact / Start a project" form and the free Google check —
// with a WhatsApp / call / email button and a status (New → Contacted → Closed).
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Phone, Mail } from "lucide-react";
import { adminHeaders } from "@/lib/admin-client";

type Lead = { id: number; created_at: string; source: string; name: string; phone: string; email: string; message: string; card: string; status: string };
const SOURCE: Record<string, string> = { "website-contact": "Website form", "google-check": "Google check" };
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const wa = (p: string) => { const d = p.replace(/\D/g, ""); return `https://wa.me/${d.length === 10 ? `91${d}` : d}`; };

export default function AdminLeads() {
  const [list, setList] = useState<Lead[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [src, setSrc] = useState("");
  const [st, setSt] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/leads", { headers: await adminHeaders(), cache: "no-store" });
    const j = r.ok ? await r.json() : { leads: [] };
    setList(j.leads ?? []); setMissing(!!j.missing);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function mark(id: number, status: string) {
    setList((l) => (l ?? []).map((x) => (x.id === id ? { ...x, status } : x)));
    await fetch("/api/admin/leads", { method: "PATCH", headers: await adminHeaders(), body: JSON.stringify({ id, status }) });
  }
  if (!list) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  const shown = list.filter((l) => (!src || l.source === src) && (!st || l.status === st));
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface"}`;
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-muted">Everyone who left a number or email on the Shubhora website: the contact form and the free Google check. A lead that came through a partner&apos;s website also shows in that partner&apos;s own Leads.</p>
      </div>
      {missing && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Table site_leads missing — run migration 0100_site_leads.sql in Supabase first.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(!src)} onClick={() => setSrc("")}>All ({list.length})</button>
        {Object.entries(SOURCE).map(([k, v]) => <button key={k} type="button" className={chip(src === k)} onClick={() => setSrc(k)}>{v} ({list.filter((l) => l.source === k).length})</button>)}
        <span className="mx-1 text-border">|</span>
        {["", "new", "contacted", "closed"].map((k) => <button key={k || "any"} type="button" className={chip(st === k)} onClick={() => setSt(k)}>{k ? k[0].toUpperCase() + k.slice(1) : "Any status"}</button>)}
      </div>
      {shown.length === 0 ? <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">No leads yet.</p> : (
        <div className="space-y-2">
          {shown.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{l.name || "—"} <span className="ml-2 rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">{SOURCE[l.source] ?? l.source}</span></p>
                  <p className="text-xs text-muted">{when(l.created_at)}{l.card ? <> · also in <a className="text-brand underline" href={`/c/${l.card}`} target="_blank" rel="noreferrer">{l.card}</a></> : ""}</p>
                </div>
                <select value={l.status} onChange={(e) => void mark(l.id, e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs">
                  <option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option>
                </select>
              </div>
              {l.message && <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{l.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {l.phone && <a href={wa(l.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp {l.phone}</a>}
                {l.phone && <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"><Phone className="h-3.5 w-3.5" /> Call</a>}
                {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"><Mail className="h-3.5 w-3.5" /> {l.email}</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
