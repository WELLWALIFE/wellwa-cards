"use client";

// Super Admin → Templates. Manage the ready-made cards users pick from when
// they create a card. Built-in templates ship with the app; anything saved
// here is stored in the database and overrides a built-in of the same key.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutTemplate, Plus, Pencil, Trash2, X, Search, Eye, LoaderCircle, Check, Copy,
} from "lucide-react";
import type { CardTemplateDef } from "@/lib/templates";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Row = CardTemplateDef & { sort?: number; active?: boolean; custom?: boolean };

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

export default function AdminTemplates() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/templates", { headers: await adminHeaders() });
    const d = await r.json();
    setRows(d.templates ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(t: Row) {
    if (!t.custom) { setErr(`"${t.name}" is built into the app and can't be deleted — edit it instead to override.`); return; }
    if (!confirm(`Delete the "${t.name}" template?`)) return;
    await fetch("/api/templates", { method: "DELETE", headers: await adminHeaders(), body: JSON.stringify({ key: t.key }) });
    load();
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !rows) return rows ?? [];
    return rows.filter((t) =>
      t.name.toLowerCase().includes(s) || t.category.toLowerCase().includes(s) || t.key.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LayoutTemplate className="h-6 w-6" style={{ color: "var(--amber)" }} /> Templates
          </h1>
          <p className="text-muted mt-1">Ready-made cards your users pick from. They only edit a few details after choosing.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 w-full sm:w-64 focus-within:ring-1 focus-within:ring-brand">
            <Search className="h-4 w-4 text-faint shrink-0" />
            <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search templates…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button
            onClick={() => setEditing({ key: "", name: "", category: "", description: "", emoji: "✨", data: {} as CardTemplateDef["data"], sort: 100, active: true, custom: true })}
            className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-sm font-semibold text-white shadow-card whitespace-nowrap">
            <Plus className="h-4 w-4" /> New template
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-amber-600">{err}</p>}

      {rows === null ? (
        <div className="py-16 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((t) => (
            <div key={t.key} className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col">
              <div className="flex items-start justify-between">
                <span className="text-3xl leading-none">{t.emoji}</span>
                <span className={`mono text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${t.custom ? "bg-ai-soft text-ai" : "bg-surface2 text-faint"}`}>
                  {t.custom ? "custom" : "built-in"}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{t.name}</h3>
              <p className="text-xs text-muted mono">{t.category}</p>
              <p className="text-sm text-muted mt-2 flex-1">{t.description}</p>
              <p className="text-[11px] text-faint mono mt-3">
                {(t.data?.pages?.length ?? 0)} pages · {(t.data?.pages ?? []).reduce((n, p) => n + p.blocks.length, 0)} blocks
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setEditing(t)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface2">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <Link href={`/templates/${t.key}`} target="_blank"
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface2" title="Preview this template">
                  <Eye className="h-3.5 w-3.5" />
                </Link>
                <button onClick={() => remove(t)} className="ed-icon hover:text-danger" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="text-muted col-span-full py-8 text-center">No templates match &ldquo;{q}&rdquo;.</p>}
        </div>
      )}

      {editing && (
        <TemplateEditor
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setErr(""); load(); }}
        />
      )}
    </div>
  );
}

/* ---------------- template editor ---------------- */
function TemplateEditor({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    key: row.key, name: row.name, category: row.category,
    description: row.description, emoji: row.emoji, sort: row.sort ?? 100,
  });
  const [json, setJson] = useState(() => JSON.stringify(row.data ?? {}, null, 2));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    let data: unknown;
    try { data = JSON.parse(json); }
    catch { setErr("Card content isn't valid JSON — check for a missing comma or bracket."); return; }
    if (!f.key.trim()) { setErr("A key is required (lowercase, no spaces — e.g. dental-clinic)."); return; }

    setBusy(true);
    const r = await fetch("/api/templates", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ ...f, key: f.key.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"), data }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json())?.error ?? "Could not save."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-float space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{row.key ? "Edit template" : "New template"}</h2>
          <button type="button" onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted">Name</span>
            <input className="ed-input mt-1" value={f.name} placeholder="Dental Clinic"
              onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Key <span className="text-faint">(url-safe, unique)</span></span>
            <input className="ed-input mt-1 mono" value={f.key} placeholder="dental-clinic"
              onChange={(e) => setF({ ...f, key: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Category</span>
            <input className="ed-input mt-1" value={f.category} placeholder="Healthcare"
              onChange={(e) => setF({ ...f, category: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted">Emoji</span>
              <input className="ed-input mt-1" value={f.emoji} maxLength={4}
                onChange={(e) => setF({ ...f, emoji: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Order</span>
              <input type="number" className="ed-input mt-1" value={f.sort}
                onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted">Description <span className="text-faint">(shown on the picker)</span></span>
          <textarea className="ed-input mt-1 min-h-16 resize-y" value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted">Card content</span>
            <button type="button"
              onClick={async () => { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink">
              {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />} Copy
            </button>
          </div>
          <textarea
            className="ed-input min-h-[280px] resize-y mono text-[11px] leading-relaxed"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
          />
          <p className="text-[11px] text-faint mt-1">
            The card this template creates — name, tagline, links, pages and blocks. Easiest way to build a new one:
            copy an existing template&apos;s content and change the wording.
          </p>
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-surface2">Cancel</button>
          <button type="submit" disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save template
          </button>
        </div>
      </form>
    </div>
  );
}
