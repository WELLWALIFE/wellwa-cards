"use client";

// Shown when a user creates a card. Picking a template pre-fills the editor
// with a near-complete card so they only change a few details.

import { authHeaders } from "@/lib/auth-headers";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, ArrowRight, Search, Eye, Pencil, RotateCcw } from "lucide-react";
import type { CardTemplateDef } from "@/lib/templates";
import type { Card } from "@/lib/types";
import { fetchMyCards } from "@/lib/cloud";
import { AiCardForm } from "./ai-card-form";

export function TemplatePicker({
  onPick, draft, onResumeDraft, onDiscardDraft, onCancel,
}: {
  onPick: (t: CardTemplateDef) => void;
  /** Changing the design of an existing card: a way back without changing anything. */
  onCancel?: () => void;
  /** An unsaved /cards/new draft, offered here instead of auto-resuming. */
  draft?: Card | null;
  onResumeDraft?: () => void;
  onDiscardDraft?: () => void;
}) {
  const [rows, setRows] = useState<CardTemplateDef[] | null>(null);
  const [mine, setMine] = useState<Card[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    authHeaders().then((headers) => fetch("/api/templates", { headers }))
      .then((r) => r.json())
      .then((d) => setRows(d.templates ?? []))
      .catch(() => setRows([]));
    fetchMyCards().then(setMine).catch(() => {});
  }, []);

  const s = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((t) =>
    !s || t.name.toLowerCase().includes(s) || t.category.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));

  return (
    <div className="max-w-4xl mx-auto py-4">
      {onCancel && <button type="button" onClick={onCancel} className="mb-3 text-sm font-medium text-muted hover:text-ink">← Back to my card (keep it as it is)</button>}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Step 1 · Choose a design</h1>
        <p className="text-muted mt-1.5 max-w-lg mx-auto">
          Pick a free design closest to your work — it opens with your name, photo, number and business already
          filled in. Step 2: edit anything you like, then publish. Or let the AI write the whole card.
        </p>
      </div>


      {draft && (
        <div className="mt-7 rounded-2xl border p-4 flex flex-wrap items-center gap-3"
          style={{ borderColor: "var(--brand)", background: "var(--brand-soft)" }}>
          <RotateCcw className="h-5 w-5 shrink-0" style={{ color: "var(--brand-ink)" }} />
          <div className="min-w-0 flex-1 basis-[70%] sm:basis-auto">
            <p className="text-sm font-semibold">You have an unfinished card</p>
            <p className="text-xs text-muted truncate">
              {draft.name || "Untitled"}{draft.jobTitle ? ` — ${draft.jobTitle}` : ""} · not published yet
            </p>
          </div>
          <button onClick={onResumeDraft}
            className="rounded-lg grad-brand px-3.5 py-2 text-sm font-semibold text-white shadow-card">
            Continue editing
          </button>
          <button onClick={onDiscardDraft}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface2">
            Start fresh
          </button>
        </div>
      )}

      {mine.length > 0 && !onCancel && (
        <div className="mt-7 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted mb-2.5">Or keep editing a card you already have</p>
          <div className="flex flex-wrap gap-2">
            {mine.map((c) => (
              <Link key={c.id} href={`/cards/${c.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface2">
                <span className="grid h-6 w-6 place-items-center rounded-full text-white text-[11px] font-semibold shrink-0 overflow-hidden"
                  style={{ background: c.avatarColor }}>
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-contain bg-surface" />
                  ) : c.name.charAt(0)}
                </span>
                <span className="font-medium">{c.name}</span>
                <span className="mono text-[11px] text-faint">/{c.username}</span>
                <Pencil className="h-3.5 w-3.5 text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <label className="mt-6 mx-auto flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 max-w-sm focus-within:ring-1 focus-within:ring-brand">
        <Search className="h-4 w-4 text-faint shrink-0" />
        <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search — doctor, salon, property…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {rows === null ? (
        <div className="py-20 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((t) => {
            const pages = t.data?.pages?.length ?? 0;
            const blocks = (t.data?.pages ?? []).reduce((n, p) => n + p.blocks.length, 0);
            const accent = t.data?.themeColor ?? "#0e9e90";
            return (
              <div
                key={t.key}
                role="button"
                tabIndex={0}
                onClick={() => onPick(t)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(t); }}
                className="group cursor-pointer text-left rounded-2xl border border-border bg-surface overflow-hidden shadow-card hover:shadow-float hover:-translate-y-0.5 transition-all"
              >
                <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
                  <span className="absolute left-4 -bottom-4 grid h-11 w-11 place-items-center rounded-xl bg-surface ring-4 ring-surface text-2xl shadow-card">
                    {t.emoji}
                  </span>
                </div>
                <div className="p-4 pt-6">
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-[11px] mono text-muted">{t.category}</p>
                  <p className="text-sm text-muted mt-2 line-clamp-3">{t.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <a
                      href={`/templates/${t.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </a>
                    <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: accent }}>
                      Use <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="col-span-full text-center text-muted py-8">No templates match &ldquo;{q}&rdquo;.</p>}
        </div>
      )}

      <p className="mt-9 text-center text-xs mono uppercase tracking-wide text-faint">Or let the AI write the whole card</p>
      <div className="mt-3"><AiCardForm onReady={onPick} /></div>
    </div>
  );
}
