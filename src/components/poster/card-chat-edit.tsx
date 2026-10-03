"use client";
// "Change karna hai? Bolo." — the agency's revision loop without the agency (owner's call, 3 Oct 2026). The owner
// types what to change; the AI picks checked operations (card-edits.ts); the owner sees the list of changes,
// taps Apply, and the website is live with them. Undo brings the previous version back in one tap.
import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles, Undo2, Check, X } from "lucide-react";
import { api } from "@/lib/poster-client";
import { publishCard } from "@/lib/cloud";
import { applyEdits, type EditOp } from "@/lib/card-edits";
import { useT } from "@/lib/poster-i18n";
import type { Card } from "@/lib/types";
import { PremiumSheet } from "@/components/poster/premium-lock";
import { Lock } from "lucide-react";

const undoKey = (id: string) => `card-undo:${id}`;

export function CardChatEdit({ card, onChanged, locked = false }: { card: Card; onChanged?: (c: Card) => void; /** Free account: the box shows, a tap opens the Premium sheet. */ locked?: boolean }) {
  const [sheet, setSheet] = useState(false);
  const { lang } = useT();
  const hi = lang === "hi";
  const T = (en: string, h: string) => (hi ? h : en);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"ask" | "apply" | "undo" | "">("");
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState<{ next: Card; notes: string[]; summary: string } | null>(null);
  const [done, setDone] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => { try { setCanUndo(!!localStorage.getItem(undoKey(card.id))); } catch { /* ignore */ } }, [card.id]);

  const EXAMPLES = hi
    ? ["fees wala section hata do", "about me likho ki hum CBSE school hain", "reviews ko upar le jao", "look thoda premium karo"]
    : ["remove the offer section", "say in the about that we are CBSE affiliated", "move reviews above the FAQ", "make the look more premium"];

  async function ask() {
    if (locked) { setSheet(true); return; }
    const q = text.trim(); if (!q) return;
    setBusy("ask"); setErr(""); setPlan(null); setDone("");
    try {
      const r = await api<{ ops?: EditOp[]; summary?: string; error?: string }>("/api/card/edit", { method: "POST", json: { card, instruction: q, lang } });
      if (!r.ok) { setErr(r.data?.error || T("The AI did not respond. Please try again.", "AI ने जवाब नहीं दिया। दोबारा try करें।")); return; }
      const ops = r.data.ops ?? [];
      const { card: next, notes, applied } = applyEdits(card, ops, lang);
      if (!applied) { setErr(r.data.summary || T("Could not do that from here — try saying it differently, or use Edit website.", "ये यहाँ से नहीं हो पाया — दूसरे शब्दों में कहें, या Edit website से करें।")); return; }
      setPlan({ next, notes, summary: r.data.summary ?? "" });
    } catch { setErr(T("No internet — please try again.", "internet नहीं — दोबारा try करें।")); }
    finally { setBusy(""); }
  }
  async function apply() {
    if (!plan) return;
    setBusy("apply"); setErr("");
    try {
      const r = await publishCard(plan.next);
      if (!r.ok) { setErr(r.error); return; }
      try { localStorage.setItem(undoKey(card.id), JSON.stringify(card)); setCanUndo(true); } catch { /* ignore */ }
      setDone(T("Live. Open your website to see it.", "Live हो गया। website खोल कर देखें।"));
      setPlan(null); setText("");
      onChanged?.(plan.next);
    } catch { setErr(T("Could not publish. Please try again.", "publish नहीं हुआ। दोबारा try करें।")); }
    finally { setBusy(""); }
  }
  async function undo() {
    setBusy("undo"); setErr("");
    try {
      const raw = localStorage.getItem(undoKey(card.id)); if (!raw) return;
      const prev = JSON.parse(raw) as Card;
      const r = await publishCard(prev);
      if (!r.ok) { setErr(r.error); return; }
      localStorage.removeItem(undoKey(card.id)); setCanUndo(false);
      setDone(T("Previous version is back.", "पिछला version वापस आ गया।"));
      onChanged?.(prev);
    } catch { setErr(T("Could not undo.", "undo नहीं हुआ।")); }
    finally { setBusy(""); }
  }

  return (
    <section className="rounded-2xl border-2 border-brand/30 bg-brand-soft/30 p-3 space-y-2">
      <p className="flex items-center gap-2 text-[15px] font-bold"><Sparkles className="h-4 w-4 text-brand" /> {T("Want to change something? Just say it.", "कुछ बदलना है? बस बोल दो।")}{locked && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#12144a] px-2 py-0.5 text-[10px] font-bold text-[#ffd54a]"><Lock className="h-3 w-3" /> Premium</span>}</p>
      {sheet && <PremiumSheet feature={T("AI edits", "AI से बदलाव")} onClose={() => setSheet(false)} />}
      <p className="text-xs text-muted">{T("Sections, text, order, look — say it in your words; we show the changes before they go live.", "section, text, order, look — अपने शब्दों में कहो; live होने से पहले बदलाव दिखाएँगे।")}</p>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => setText(e)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]">{e}</button>)}
      </div>
      <div className="flex gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={T("e.g. remove the offer section, and write CBSE in the about", "जैसे offer section हटा दो, और about में CBSE लिखो")} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
        <button type="button" onClick={() => void ask()} disabled={!!busy || (!locked && !text.trim())} className="shrink-0 self-end inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "ask" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {T("Go", "करो")}</button>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      {done && <p className="text-sm font-semibold text-good">{done}</p>}
      {plan && (
        <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
          <p className="text-sm font-semibold">{T("This will change:", "ये बदलेगा:")}</p>
          <ul className="space-y-1 text-sm">{plan.notes.map((n, i) => <li key={i} className="flex gap-1.5"><span className="text-brand">•</span><span>{n}</span></li>)}</ul>
          {plan.summary && <p className="text-xs text-muted">{plan.summary}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setPlan(null)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"><X className="h-4 w-4" /> {T("No", "नहीं")}</button>
            <button type="button" onClick={() => void apply()} disabled={busy === "apply"} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === "apply" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {T("Apply and go live", "लगाओ, live करो")}</button>
          </div>
        </div>
      )}
      {canUndo && !plan && <button type="button" onClick={() => void undo()} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><Undo2 className="h-3.5 w-3.5" /> {T("Undo the last change", "पिछला बदलाव वापस लो")}</button>}
    </section>
  );
}
