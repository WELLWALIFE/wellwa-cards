"use client";
// "Change karna hai? Bolo." — the agency's revision loop without the agency (owner's call, 3 Oct 2026). The owner
// types what to change; the AI picks checked operations (card-edits.ts); the owner sees the list of changes,
// taps Apply, and the website is live with them. Undo brings the previous version back in one tap.
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles, Undo2, Check, X, Mic, MicOff, Globe } from "lucide-react";
import { api } from "@/lib/poster-client";
import { publishCard } from "@/lib/cloud";
import { applyEdits, type EditOp } from "@/lib/card-edits";
import { useT } from "@/lib/poster-i18n";
import type { Card } from "@/lib/types";
import { PremiumSheet } from "@/components/poster/premium-lock";
import { Lock } from "lucide-react";

const undoKey = (id: string) => `card-undo:${id}`;

/** The browser's speech recognition, where it exists (Chrome on Android, Safari): a mic beside the box. */
type Recognizer = { lang: string; interimResults: boolean; maxAlternatives: number; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
function speechCtor(): (new () => Recognizer) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CardChatEdit({ card, onChanged, locked = false, url, autoFocus }: { card: Card; onChanged?: (c: Card) => void; /** Free account: the box shows, a tap opens the Premium sheet. */ locked?: boolean; /** The live link, for "Open website" after a change. */ url?: string; /** The box opens with the cursor in it. */ autoFocus?: boolean }) {
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
  // Speak instead of type (owner's call, 7 Oct 2026): Hindi or English by the app's language; the words land in the box.
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognizer | null>(null);
  useEffect(() => { setCanSpeak(!!speechCtor()); }, []);
  const box = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { if (autoFocus) box.current?.focus(); }, [autoFocus]);
  function speak() {
    if (locked) { setSheet(true); return; }
    if (listening) { rec.current?.stop(); return; }
    const Ctor = speechCtor(); if (!Ctor) return;
    const r = new Ctor();
    r.lang = hi ? "hi-IN" : "en-IN"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript?.trim(); if (t) setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t)); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); }
  }

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
      setDone(T("Changed and live.", "बदल गया, live है।"));
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
        <textarea ref={box} id="ai-edit-box" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={listening ? T("Listening… say what to change", "सुन रहे हैं… बोलें क्या बदलना है") : T("e.g. remove the offer section, and write CBSE in the about", "जैसे offer section हटा दो, और about में CBSE लिखो")} className={`w-full rounded-xl border bg-surface px-3 py-2 text-sm outline-none focus:border-brand ${listening ? "border-brand" : "border-border"}`} />
        <div className="flex shrink-0 flex-col justify-end gap-1.5">
          {canSpeak && <button type="button" onClick={speak} disabled={!!busy} aria-label={listening ? T("Stop", "रोकें") : T("Speak", "बोलें")} aria-pressed={listening} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold ${listening ? "border-danger bg-danger/10 text-danger" : "border-brand/40 bg-surface text-brand-ink"}`}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {listening ? T("Stop", "रोकें") : T("Speak", "बोलें")}</button>}
          <button type="button" onClick={() => void ask()} disabled={!!busy || (!locked && !text.trim())} className="inline-flex items-center justify-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "ask" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {T("Go", "करो")}</button>
        </div>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      {done && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm">
          <span className="font-semibold text-good">✓ {done}</span>
          {url && <a href={`${url}?view=site`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold"><Globe className="h-3.5 w-3.5 text-brand" /> {T("Open website", "Website खोलें")}</a>}
          {canUndo && <button type="button" onClick={() => void undo()} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold"><Undo2 className="h-3.5 w-3.5" /> {T("Undo", "वापस लो")}</button>}
        </div>
      )}
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
      {canUndo && !plan && !done && <button type="button" onClick={() => void undo()} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><Undo2 className="h-3.5 w-3.5" /> {T("Undo the last change", "पिछला बदलाव वापस लो")}</button>}
    </section>
  );
}
