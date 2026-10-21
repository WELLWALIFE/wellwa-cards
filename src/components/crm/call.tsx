"use client";
// Direct call, phase 1 (docs/crm-pro.md 3.6): tap Call → the phone's dialer; back in the app the outcome sheet asks what
// happened, saves the call, the next step and (optional) a WhatsApp — one tap each. CallList (3.5) walks today's calls
// one lead at a time. Phase 2 (Exotel click-to-call) plugs into startCall without changing these screens.
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, MessageCircle, LoaderCircle, Mic, Check, Copy, SkipForward, Sparkles } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useShell, quickMoments, telLink, waLink, inputCls, Chip, Avatar, StagePill, BottomSheet, fmtWhen, type LeadPro, type Task } from "@/components/crm/shared";
import { OUTCOME_LABEL, STAGE_LABEL } from "@/components/crm/i18n";

export type PendingCall = { leadId: string; name: string; phone: string; status: string; startedAt: number; onLogged?: boolean };
const KEY = "akp-crm-pending-call";
export const readPending = (): PendingCall | null => { try { const v = sessionStorage.getItem(KEY); return v ? (JSON.parse(v) as PendingCall) : null; } catch { return null; } };
export const writePending = (p: PendingCall | null) => { try { if (p) sessionStorage.setItem(KEY, JSON.stringify(p)); else sessionStorage.removeItem(KEY); } catch { /* ignore */ } };
export const isPhoneDevice = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Opens the dialer and remembers the call; on a laptop (no dialer) the sheet opens straight away with the number to dial. */
export function dial(lead: Pick<LeadPro, "id" | "name" | "phone" | "status">, onNoDialer: () => void) {
  writePending({ leadId: lead.id, name: lead.name, phone: lead.phone, status: lead.status, startedAt: Date.now() });
  if (isPhoneDevice()) { window.location.href = telLink(lead.phone); return; }
  onNoDialer();
}

/** Mounted once at the CRM root: when the app comes back after a call, shows the outcome sheet. */
export function CallReturnWatcher() {
  const { notifyLogged } = useShell();
  const [pending, setPending] = useState<PendingCall | null>(null);
  const check = useCallback(() => { const p = readPending(); if (p && Date.now() - p.startedAt >= 5000) setPending(p); }, []);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", onVis); window.addEventListener("pageshow", onVis);
    const t = setTimeout(check, 1500);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); window.removeEventListener("pageshow", onVis); clearTimeout(t); };
  }, [check]);
  if (!pending) return null;
  return <CallOutcomeSheet pending={pending} onSaved={notifyLogged} onClose={() => { writePending(null); setPending(null); }} />;
}

export function CallOutcomeSheet({ pending, onClose, onSaved, dialHint }: { pending: PendingCall; onClose: () => void; onSaved?: () => void; dialHint?: boolean }) {
  const { L, ws, as, reload } = useShell();
  const [outcome, setOutcome] = useState<string>("");
  const [secs, setSecs] = useState<number>(() => Math.max(0, Math.round((Date.now() - pending.startedAt) / 1000) - 8));
  const [note, setNote] = useState("");
  const [nextKey, setNextKey] = useState<string>("");
  const [customNext, setCustomNext] = useState("");
  const [stage, setStage] = useState<string>("");
  const [sendWa, setSendWa] = useState(false);
  const [waText, setWaText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const moments = quickMoments();
  const first = (pending.name || "").split(/\s+/)[0] || "";
  const missedText = ws.prefs.missed_call_text.replace("{name}", first || "").replace("{business}", ws.business || "").replace(/\s+ji/, first ? " ji" : "");

  // Picking an outcome pre-fills the sensible next step; the owner changes anything before saving.
  function pick(o: string) {
    setOutcome(o);
    if (o === "no_answer" || o === "busy" || o === "switched_off") { setNextKey("retry"); setSendWa(ws.prefs.missed_call_wa && ws.wa === "connected"); setWaText(missedText); }
    else if (o === "call_back") { setNextKey("tomorrow11"); setSendWa(false); }
    else if (o === "connected") { setNextKey(""); setSendWa(false); if (pending.status === "new") setStage("contacted"); }
    else { setNextKey(""); setSendWa(false); }
  }
  const nextIso = nextKey === "retry" ? new Date(Date.now() + Math.max(15, ws.prefs.retry_after_min) * 60000).toISOString() : nextKey === "custom" ? (customNext ? new Date(customNext).toISOString() : "") : moments.find((m) => m.key === nextKey)?.iso ?? "";

  function speak() {
    const W = window as unknown as { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec };
    const R = W.SpeechRecognition || W.webkitSpeechRecognition; if (!R) return;
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const r = new R(); r.lang = L.hi ? "hi-IN" : "en-IN"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results?.[0]?.[0]?.transcript ?? ""; if (t) setNote((n) => (n ? `${n} ${t}` : t)); };
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  }
  async function save() {
    if (!outcome || busy) return; setBusy(true); setErr("");
    const body: Record<string, unknown> = { lead_id: pending.leadId, as: as ?? undefined, outcome, seconds: outcome === "connected" ? secs : 0, note: note.trim(), started_at: new Date(pending.startedAt).toISOString() };
    if (nextIso) body.next = { kind: "call", title: nextKey === "retry" ? (L.hi ? "फिर call करें" : "Call again") : L.hi ? "Follow-up call" : "Follow-up call", due_at: nextIso };
    if (stage) body.stage = stage;
    if (sendWa && waText.trim()) body.wa_text = waText.trim();
    const r = await api<{ error?: string; sent?: boolean | null }>("/api/crm/calls", { method: "POST", json: body });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || L.failed); return; }
    writePending(null); onSaved?.(); reload(); onClose();
  }
  const hasSpeech = typeof window !== "undefined" && !!((window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition || (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition);
  return (
    <BottomSheet title={L.callOutcome} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3"><Avatar name={pending.name} phone={pending.phone} size={10} /><div className="min-w-0"><p className="truncate font-semibold text-ink">{pending.name || pending.phone}</p><p className="text-xs text-muted">{pending.phone}</p></div>
          {dialHint && <button type="button" onClick={() => { navigator.clipboard?.writeText(pending.phone); setCopied(true); }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted"><Copy className="h-3.5 w-3.5" />{copied ? L.copied : L.dialHint}</button>}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(["connected", "no_answer", "busy", "switched_off", "wrong_number", "call_back"] as const).map((o) => (
            <button key={o} type="button" onClick={() => pick(o)} className={`rounded-xl border px-2 py-2 text-xs font-semibold ${outcome === o ? (o === "connected" ? "border-good bg-good/10 text-good" : "border-brand bg-brand-soft text-brand-ink") : "border-border bg-surface text-ink"}`}>{OUTCOME_LABEL[o][L.lang]}</button>
          ))}
        </div>
        {outcome === "connected" && (
          <label className="flex items-center gap-2 text-xs text-muted">{L.duration}
            <input value={Math.floor(secs / 60)} onChange={(e) => setSecs(Math.max(0, parseInt(e.target.value || "0", 10)) * 60 + (secs % 60))} inputMode="numeric" className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-center text-ink" /> min
            <input value={secs % 60} onChange={(e) => setSecs(Math.floor(secs / 60) * 60 + Math.min(59, Math.max(0, parseInt(e.target.value || "0", 10))))} inputMode="numeric" className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-center text-ink" /> sec
          </label>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>{L.callNote}</span>{hasSpeech && <button type="button" onClick={speak} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${listening ? "border-danger text-danger" : "border-border text-muted"}`}><Mic className="h-3 w-3" />{listening ? L.listening : L.speak}</button>}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2} placeholder={L.callNotePh} className={inputCls} />
        </div>
        {outcome && outcome !== "wrong_number" && (
          <div>
            <div className="mb-1 text-xs text-muted">{L.nextStep}</div>
            <div className="flex flex-wrap gap-1.5">
              {(outcome === "no_answer" || outcome === "busy" || outcome === "switched_off") && <Chip on={nextKey === "retry"} onClick={() => setNextKey(nextKey === "retry" ? "" : "retry")}>⏰ {Math.round(ws.prefs.retry_after_min / 60) || 1}h</Chip>}
              {moments.map((m) => <Chip key={m.key} on={nextKey === m.key} onClick={() => setNextKey(nextKey === m.key ? "" : m.key)}>{m.key === "today6" ? L.quickToday6 : m.key === "tomorrow11" ? L.quickTomorrow11 : m.key === "d3" ? L.quick3d : L.quickWeek}</Chip>)}
              <Chip on={nextKey === "custom"} onClick={() => setNextKey(nextKey === "custom" ? "" : "custom")}>{L.pick}</Chip>
            </div>
            {nextKey === "custom" && <input type="datetime-local" value={customNext} onChange={(e) => setCustomNext(e.target.value)} className={inputCls + " mt-1.5"} />}
          </div>
        )}
        {outcome && (
          <div>
            <div className="mb-1 text-xs text-muted">{L.moveStage}</div>
            <div className="flex flex-wrap gap-1.5">{["contacted", "interested", "follow_up", "converted", "lost"].map((s) => <Chip key={s} on={stage === s} onClick={() => setStage(stage === s ? "" : s)} tone={s === "converted" ? "good" : s === "lost" ? "danger" : "brand"}>{STAGE_LABEL[s][L.lang]}</Chip>)}</div>
          </div>
        )}
        {outcome && outcome !== "connected" && outcome !== "wrong_number" && (
          <div className="rounded-xl border border-border p-2.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink"><input type="checkbox" checked={sendWa} disabled={ws.wa !== "connected"} onChange={(e) => { setSendWa(e.target.checked); if (!waText) setWaText(missedText); }} /> {L.sendWa} · {L.waMissedYou}</label>
            {ws.wa !== "connected" && <p className="mt-1 text-[11px] text-muted">{L.waNotLinked}</p>}
            {sendWa && <textarea value={waText} onChange={(e) => setWaText(e.target.value.slice(0, 1500))} rows={3} className={inputCls + " mt-1.5"} />}
          </div>
        )}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        <div className="flex gap-2">
          <a href={waLink(pending.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-good"><MessageCircle className="h-4 w-4" /> {L.whatsapp}</a>
          <button type="button" disabled={!outcome || busy} onClick={save} className="grad-brand inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {L.saveCall}</button>
        </div>
      </div>
    </BottomSheet>
  );
}
type SpeechRec = { lang: string; interimResults: boolean; maxAlternatives: number; onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };

/* ---------------- call list: one lead at a time ---------------- */
export type CallListItem = { lead: LeadPro; task?: Task; why: string };
export function CallList({ items, onExit }: { items: CallListItem[]; onExit: () => void }) {
  const { L, startCall, openCustomer } = useShell();
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [msgs, setMsgs] = useState<{ direction: string; text: string; sent_at: string }[] | null>(null);
  const cur = items[i];
  useEffect(() => {
    setMsgs(null);
    if (!cur) return;
    api<{ messages?: { direction: string; text: string; sent_at: string }[] }>(`/api/crm/thread?lead=${cur.lead.id}`).then((r) => setMsgs(r.ok ? (r.data.messages ?? []).slice(-2) : []));
  }, [cur]);
  if (!cur) return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-lg font-bold text-ink">{L.callListEmpty}</p>
      <p className="mt-1 text-xs text-muted">{done.size} {L.called.toLowerCase()}</p>
      <button type="button" onClick={onExit} className="mt-4 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-ink">{L.back}</button>
    </div>
  );
  const l = cur.lead;
  const advance = () => { setDone((s) => new Set(s).add(l.id)); setI((x) => x + 1); };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted"><button type="button" onClick={onExit} className="rounded-lg border border-border px-2 py-1 font-semibold text-ink">← {L.back}</button><span className="font-semibold">{L.callList} · {i + 1} / {items.length}</span></div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <button type="button" onClick={() => openCustomer(l.id)} className="flex w-full items-center gap-3 text-left">
          <Avatar name={l.name} phone={l.phone} size={12} />
          <div className="min-w-0 flex-1"><p className="truncate text-lg font-bold text-ink">{l.name || l.phone}</p><p className="text-xs text-muted">{l.phone}{l.city ? ` · ${l.city}` : ""}{l.business ? ` · ${l.business}` : ""}</p><div className="mt-1 flex items-center gap-1.5"><StagePill status={l.status} hi={L.hi} />{l.score >= 70 && <span className="text-[10px]">🔥</span>}</div></div>
        </button>
        <p className="mt-3 rounded-xl bg-lead/10 px-3 py-2 text-xs font-semibold text-lead">⏰ {cur.why}{cur.task ? ` · ${fmtWhen(cur.task.due_at, L.hi)}` : ""}</p>
        {(l.ai_summary || l.ai_next || l.message) && (
          <div className="mt-3 rounded-xl bg-ai/5 px-3 py-2 text-xs">
            <p className="mb-1 flex items-center gap-1 font-semibold text-ai"><Sparkles className="h-3.5 w-3.5" /> {L.talkingPoints}</p>
            {l.ai_summary && <p className="text-ink">{l.ai_summary}</p>}
            {l.ai_next && <p className="text-ink"><b>→</b> {l.ai_next}</p>}
            {!l.ai_summary && l.message && <p className="text-ink">“{l.message}”</p>}
          </div>
        )}
        {msgs && msgs.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] font-semibold text-muted">{L.lastMessages}</p>
            {msgs.map((m, k) => <p key={k} className={`rounded-xl px-3 py-1.5 text-xs ${m.direction === "in" ? "bg-surface2 text-ink" : "bg-brand-soft text-brand-ink"}`}>{m.text.slice(0, 160)}</p>)}
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => startCall(l, advance)} className="grad-brand inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"><Phone className="h-4 w-4" /> {L.call}</button>
          <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-good/40 bg-good/10 py-3 text-sm font-semibold text-good"><MessageCircle className="h-4 w-4" /> {L.whatsapp}</a>
          <button type="button" onClick={() => setI((x) => x + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted"><SkipForward className="h-4 w-4" /> {L.skip}</button>
        </div>
      </div>
    </div>
  );
}
