"use client";
// Direct call, phase 1 (docs/crm-pro.md 3.6): tap Call → the phone's dialer; back in the app the outcome sheet asks what
// happened, saves the call, the next step and (optional) a WhatsApp — one tap each. CallList (3.5) walks today's calls
// one lead at a time. Phase 2 (Exotel click-to-call) plugs into startCall without changing these screens.
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, MessageCircle, LoaderCircle, Mic, Check, Copy, SkipForward, Sparkles, ClipboardPaste, UserPlus, X, AlertTriangle, ChevronDown, Search } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useShell, quickMoments, telLink, waLink, inputCls, Chip, Avatar, StagePill, BottomSheet, fmtWhen, type LeadPro, type Task, waClick, Stars, starsOf, LastCallBox, type LastCall } from "@/components/crm/shared";
import { OUTCOME_LABEL, STAGE_LABEL } from "@/components/crm/i18n";

export type PendingCall = { leadId: string; name: string; phone: string; status: string; startedAt: number; onLogged?: boolean; callId?: string };
const KEY = "akp-crm-pending-call";
const nowMs = () => Date.now();
export const readPending = (): PendingCall | null => { try { const v = sessionStorage.getItem(KEY); return v ? (JSON.parse(v) as PendingCall) : null; } catch { return null; } };
export const writePending = (p: PendingCall | null) => {
  try { if (p) sessionStorage.setItem(KEY, JSON.stringify(p)); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("akp-crm-unlogged")); } catch { /* ignore */ }   // the "calls to fill" list shows a call once its sheet is gone
};
/** Calls dialled from the CRM whose outcome was never saved (owner, 23 Oct 2026: "call ke baad ka pop-up fill karna miss ho jata hai").
 *  Kept on this phone until the outcome is saved or the owner removes it; the Today and Customers screens list them with "Fill now". */
const UNLOGGED_KEY = "akp-crm-unlogged-calls";
const UNLOGGED_DAYS = 7;
export function readUnlogged(): PendingCall[] {
  try {
    const v = JSON.parse(localStorage.getItem(UNLOGGED_KEY) || "[]") as PendingCall[];
    const cut = Date.now() - UNLOGGED_DAYS * 86400_000;
    return Array.isArray(v) ? v.filter((x) => x && x.leadId && x.startedAt > cut) : [];
  } catch { return []; }
}
function writeUnlogged(list: PendingCall[]) {
  try { localStorage.setItem(UNLOGGED_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("akp-crm-unlogged")); } catch { /* ignore */ }
}
export function addUnlogged(p: PendingCall) { writeUnlogged([p, ...readUnlogged().filter((x) => !(x.leadId === p.leadId && x.startedAt === p.startedAt))]); }
/** The outcome was saved (or the owner removed it): this call and any older unsaved call to the same customer are done. */
export function dropUnlogged(p: Pick<PendingCall, "leadId" | "startedAt">) { writeUnlogged(readUnlogged().filter((x) => !(x.leadId === p.leadId && x.startedAt <= p.startedAt))); }
export const isPhoneDevice = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Opens the dialer and remembers the call; on a laptop (no dialer) the sheet opens straight away with the number to dial.
 *  Only the dialer path is remembered for CallReturnWatcher — on a laptop the caller's sheet is already open, and a second
 *  sheet from the watcher (on the next window focus) would log the same call twice. */
export function dial(lead: Pick<LeadPro, "id" | "name" | "phone" | "status">, onNoDialer: (p: PendingCall) => void) {
  const p: PendingCall = { leadId: lead.id, name: lead.name, phone: lead.phone, status: lead.status, startedAt: Date.now() };
  addUnlogged(p);
  if (isPhoneDevice()) { writePending(p); window.location.href = telLink(lead.phone); return; }
  writePending(null);
  onNoDialer(p);
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
  const [secs, setSecs] = useState<number>(0);
  // Filled in late (from "calls to fill"): the time since dialling is not the call's length, so it starts at 0 for the owner to set.
  useEffect(() => { const gone = Math.round((Date.now() - pending.startedAt) / 1000); setSecs(gone > 45 * 60 ? 0 : Math.max(0, gone - 8)); }, [pending.startedAt]);
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
    else if (o === "not_interested") { setNextKey(""); setSendWa(false); setStage("lost"); }
    else { setNextKey(""); setSendWa(false); }
  }
  const nextIsoAt = (now: number) => nextKey === "retry" ? new Date(now + Math.max(15, ws.prefs.retry_after_min) * 60000).toISOString() : nextKey === "custom" ? (customNext ? new Date(customNext).toISOString() : "") : moments.find((m) => m.key === nextKey)?.iso ?? "";

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
    const nextIso = nextIsoAt(nowMs());
    const body: Record<string, unknown> = { lead_id: pending.leadId, as: as ?? undefined, outcome, seconds: outcome === "connected" ? secs : 0, note: note.trim(), started_at: new Date(pending.startedAt).toISOString() };
    if (nextIso) body.next = { kind: "call", title: nextKey === "retry" ? (L.hi ? "फिर call करें" : "Call again") : L.hi ? "Follow-up call" : "Follow-up call", due_at: nextIso };
    if (stage) body.stage = stage;
    if (sendWa && waText.trim()) body.wa_text = waText.trim();
    if (pending.callId) body.call_id = pending.callId;
    const r = await api<{ error?: string; sent?: boolean | null }>("/api/crm/calls", { method: "POST", json: body }).catch(() => null);
    setBusy(false);
    if (!r || !r.ok) { setErr(r?.data.error || L.failed); return; }
    writePending(null); dropUnlogged(pending); onSaved?.(); reload(); onClose();
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
          {/* Not interested (owner, 23 Oct 2026): the customer is marked lost and gets no more automatic messages. */}
          <button type="button" onClick={() => pick("not_interested")} className={`col-span-3 rounded-xl border px-2 py-2 text-xs font-semibold ${outcome === "not_interested" ? "border-danger bg-danger/10 text-danger" : "border-border bg-surface text-ink"}`}>🚫 {OUTCOME_LABEL.not_interested[L.lang]}</button>
        </div>
        {outcome === "not_interested" && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[11px] font-semibold text-danger">{L.hi ? "ये ग्राहक 'गया' (Lost) में चला जाएगा, उसके follow-up बंद होंगे, और AI / अपने-आप जाने वाले सारे messages (reply, follow-up, wishes, broadcast) इसे नहीं जाएँगे। बाद में ग्राहक की screen से फिर चालू कर सकते हैं।" : "The customer moves to Lost, their follow-ups close, and no automatic message (AI replies, follow-ups, wishes, broadcasts) goes to them. You can turn it back on from their screen."}</p>}
        {outcome === "connected" && (
          <label className="flex items-center gap-2 text-xs text-muted">{L.duration}
            <input value={Math.floor(secs / 60)} onChange={(e) => setSecs(Math.max(0, parseInt(e.target.value, 10) || 0) * 60 + (secs % 60))} inputMode="numeric" className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-center text-ink" /> min
            <input value={secs % 60} onChange={(e) => setSecs(Math.floor(secs / 60) * 60 + Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))} inputMode="numeric" className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-center text-ink" /> sec
          </label>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>{L.callNote}</span>{hasSpeech && <button type="button" onClick={speak} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${listening ? "border-danger text-danger" : "border-border text-muted"}`}><Mic className="h-3 w-3" />{listening ? L.listening : L.speak}</button>}</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={2} placeholder={L.callNotePh} className={inputCls} />
        </div>
        {outcome && outcome !== "wrong_number" && outcome !== "not_interested" && (
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
        {outcome && outcome !== "not_interested" && (
          <div>
            <div className="mb-1 text-xs text-muted">{L.moveStage}</div>
            <div className="flex flex-wrap gap-1.5">{["contacted", "interested", "follow_up", "converted", "lost"].map((s) => <Chip key={s} on={stage === s} onClick={() => setStage(stage === s ? "" : s)} tone={s === "converted" ? "good" : s === "lost" ? "danger" : "brand"}>{STAGE_LABEL[s][L.lang]}</Chip>)}</div>
          </div>
        )}
        {outcome && outcome !== "connected" && outcome !== "wrong_number" && outcome !== "not_interested" && (
          <div className="rounded-xl border border-border p-2.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink"><input type="checkbox" checked={sendWa} disabled={ws.wa !== "connected"} onChange={(e) => { setSendWa(e.target.checked); if (!waText) setWaText(missedText); }} /> {L.sendWa} · {L.waMissedYou}</label>
            {ws.wa !== "connected" && <p className="mt-1 text-[11px] text-muted">{L.waNotLinked}</p>}
            {sendWa && <textarea value={waText} onChange={(e) => setWaText(e.target.value.slice(0, 1500))} rows={3} className={inputCls + " mt-1.5"} />}
          </div>
        )}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        <div className="flex gap-2">
          <a href={waLink(pending.phone)} onClick={waClick(pending.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-good"><MessageCircle className="h-4 w-4" /> {L.whatsapp}</a>
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
  const { L, as, startCall, openCustomer } = useShell();
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<{ text: string; at: string; call: boolean } | null>(null);
  const [lastCall, setLastCall] = useState<LastCall>(null);
  const [loaded, setLoaded] = useState("");
  /** Stars set here, before the list reloads (owner, 26 Oct 2026: "star dena"). */
  const [stars, setStars] = useState<Record<string, number>>({});
  const cur = items[i];
  useEffect(() => {
    setNote(null); setLastCall(null); setLoaded("");
    if (!cur) return;
    let dead = false;
    // ?as= so a team workspace reads the owner's thread (without it the lead is "not found" for an agent / manager).
    api<{ lastNote?: { text: string; at: string; call: boolean } | null; lastCall?: LastCall }>(`/api/crm/thread?lead=${cur.lead.id}${as ? `&as=${as}` : ""}`)
      .then((r) => { if (dead) return; setNote(r.ok ? r.data.lastNote ?? null : null); setLastCall(r.ok ? r.data.lastCall ?? null : null); setLoaded(cur.lead.id); })
      .catch(() => { if (!dead) setLoaded(cur.lead.id); });
    return () => { dead = true; };
  }, [cur, as]);
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
          <div className="min-w-0 flex-1"><p className="truncate text-lg font-bold text-ink">{l.name || l.phone}</p><p className="text-xs text-muted">{l.name ? l.phone : ""}{l.city ? ` · ${l.city}` : ""}{l.business ? ` · ${l.business}` : ""}</p><div className="mt-1 flex items-center gap-1.5"><StagePill status={l.status} hi={L.hi} />{l.score >= 70 && <span className="text-[10px]">🔥</span>}</div></div>
        </button>
        <div className="mt-2 flex items-center gap-2 pl-[3.75rem]">
          <Stars value={stars[l.id] ?? starsOf(l.tags)} hi={L.hi} onChange={(n) => {
            setStars((x) => ({ ...x, [l.id]: n }));
            void api("/api/crm/lead", { method: "PATCH", json: { id: l.id, as: as ?? undefined, rating: n } }).then((r) => { if (!r.ok) setStars((x) => { const y = { ...x }; delete y[l.id]; return y; }); });
          }} />
          <span className="text-[11px] text-faint">{L.hi ? "ज़रूरी हो तो स्टार दें" : "Star the important ones"}</span>
        </div>
        {/* Why this call now (a follow-up that is due), only when there is something to say. */}
        {(cur.why?.trim() || cur.task) && <p className="mt-3 rounded-xl bg-lead/10 px-3 py-2 text-xs font-semibold text-lead">⏰ {cur.why}{cur.task ? `${cur.why?.trim() ? " · " : ""}${fmtWhen(cur.task.due_at, L.hi)}` : ""}</p>}
        {/* The last call and its note come first (owner, 26 Oct 2026); the WhatsApp chat is one tap away on the WhatsApp button. */}
        <div className="mt-3">
          {loaded === l.id
            ? <LastCallBox call={lastCall} note={note && !note.call ? { text: note.text, at: note.at } : null} hi={L.hi} outcomeLabel={(o) => OUTCOME_LABEL[o]?.[L.lang] ?? o} />
            : <div className="h-20 animate-pulse rounded-xl bg-surface2" />}
        </div>
        {l.ai_next && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-ai/5 px-3 py-2 text-xs text-ink"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" /> <span><b className="text-ai">{L.hi ? "अगला कदम:" : "Next step:"}</b> {l.ai_next}</span></p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => startCall(l, advance)} className="grad-brand inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"><Phone className="h-4 w-4" /> {L.call}</button>
          <a href={waLink(l.phone)} onClick={waClick(l.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-good/40 bg-good/10 py-3 text-sm font-semibold text-good"><MessageCircle className="h-4 w-4" /> {L.whatsapp}</a>
          <button type="button" onClick={() => setI((x) => x + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted"><SkipForward className="h-4 w-4" /> {L.skip}</button>
        </div>
        <PersonalButton key={l.id} lead={l} onDone={() => setI((x) => x + 1)} className="mt-3 w-full" />
      </div>
    </div>
  );
}

/* ---------------- phase 2: through the Shubhora number (Exotel) ---------------- */
type LiveCall = { id: string; status: string; seconds: number; outcome: string; recording_url: string | null; started_at: string };
export function CloudCallSheet({ lead, onFallback, onClose }: { lead: Pick<LeadPro, "id" | "name" | "phone" | "status">; onFallback: () => void; onClose: () => void }) {
  const { L, as, ws, notifyLogged } = useShell();
  const [call, setCall] = useState<LiveCall | null>(null);
  const [err, setErr] = useState("");
  const [outcome, setOutcome] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Placing the call is not idempotent (Exotel rings the phone): once per lead for this sheet, however often the effect
  // re-runs (a new onFallback arrow from the parent on every render, React's dev double-invoke).
  const placed = useRef<string | null>(null);
  const fallbackRef = useRef(onFallback);
  const alive = useRef(false);
  useEffect(() => { fallbackRef.current = onFallback; }, [onFallback]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const failedText = L.failed;
  useEffect(() => {
    if (placed.current === lead.id) return;
    placed.current = lead.id;
    (async () => {
      const r = await api<{ call?: LiveCall; error?: string }>("/api/crm/call", { method: "POST", json: { lead_id: lead.id, as: as ?? undefined } }).catch(() => null);
      if (!alive.current) return;   // the sheet was closed while the call was being placed
      if (!r) { setErr(failedText); return; }
      if (r.status === 409) { fallbackRef.current(); return; }
      if (!r.ok || !r.data.call) { setErr(r.data.error || failedText); return; }
      setCall(r.data.call);
    })();
  }, [lead.id, as, failedText]);
  useEffect(() => {
    if (!call || call.status === "done" || call.status === "failed") return;
    const t = setInterval(async () => {
      const r = await api<{ call: LiveCall }>(`/api/crm/calls/${call.id}${as ? `?as=${as}` : ""}`).catch(() => null);
      if (r?.ok) { setCall(r.data.call); setElapsed(Math.max(0, Math.round((Date.now() - new Date(r.data.call.started_at).getTime()) / 1000))); }
    }, 3000);
    return () => clearInterval(t);
  }, [call, as]);
  if (outcome && call) {
    return <CallOutcomeSheet pending={{ leadId: lead.id, name: lead.name, phone: lead.phone, status: lead.status, startedAt: new Date(call.started_at).getTime(), callId: call.id }} onSaved={notifyLogged} onClose={onClose} />;
  }
  return (
    <BottomSheet title={`${L.call} · ${ws.line?.label || ws.line?.caller_id || "Shubhora"}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3"><Avatar name={lead.name} phone={lead.phone} size={10} /><div><p className="font-semibold text-ink">{lead.name || lead.phone}</p><p className="text-xs text-muted">{lead.phone}</p></div></div>
        {err ? <p className="text-xs text-danger">{err}</p>
          : !call ? <p className="flex items-center gap-2 text-xs text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> …</p>
          : call.status === "failed" ? <p className="text-xs text-danger">{L.failed}</p>
          : call.status === "done" ? <p className="text-xs text-good">{OUTCOME_LABEL[call.outcome]?.[L.lang] ?? call.outcome}{call.seconds ? ` · ${Math.floor(call.seconds / 60)}:${String(call.seconds % 60).padStart(2, "0")}` : ""}</p>
          : <p className="flex items-center gap-2 text-xs text-ink"><LoaderCircle className="h-4 w-4 animate-spin text-brand" /> {call.status === "in_progress" ? `${L.connected} · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : (L.hi ? "आपका फ़ोन बज रहा है — उठाइए, फिर customer से जुड़ेगा" : "Your phone is ringing — pick up, then the customer is dialled")}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-3 py-2 text-xs">{L.close}</button>
          {call && (call.status === "done" || elapsed > 20) && <button type="button" onClick={() => setOutcome(true)} className="grad-brand flex-1 rounded-xl py-2 text-sm font-semibold text-white">{L.callOutcome}</button>}
        </div>
      </div>
    </BottomSheet>
  );
}

/* ---------------- calls whose outcome was not filled ---------------- */
/** "N calls to fill": every call dialled from here whose outcome sheet was closed or missed. One tap opens the same sheet. */
export function UnloggedCalls() {
  const { L, notifyLogged } = useShell();
  const [list, setList] = useState<PendingCall[]>([]);
  const [open, setOpen] = useState(false);
  const [fill, setFill] = useState<PendingCall | null>(null);
  useEffect(() => {
    const read = () => setList(readUnlogged().filter((x) => { const p = readPending(); return !(p && p.leadId === x.leadId && p.startedAt === x.startedAt); }));
    read();
    window.addEventListener("akp-crm-unlogged", read); window.addEventListener("focus", read); document.addEventListener("visibilitychange", read);
    return () => { window.removeEventListener("akp-crm-unlogged", read); window.removeEventListener("focus", read); document.removeEventListener("visibilitychange", read); };
  }, []);
  if (!list.length && !fill) return null;
  const T = (en: string, hi: string) => (L.hi ? hi : en);
  return (
    <>
      {list.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-lead/40 bg-lead/10">
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-ink">
            <AlertTriangle className="h-4 w-4 shrink-0 text-lead" />
            <span className="min-w-0 flex-1">{T(`${list.length} call${list.length === 1 ? "" : "s"}: what happened is not filled`, `${list.length} call का हाल भरना बाकी है`)}<span className="block text-[11px] font-normal text-muted">{T("Fill it so it is saved in the CRM", "भर दें ताकि CRM में record रहे")}</span></span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "" : "-rotate-90"}`} />
          </button>
          {open && (
            <ul className="divide-y divide-border border-t border-border bg-surface">
              {list.map((c) => (
                <li key={`${c.leadId}-${c.startedAt}`} className="flex items-center gap-2 px-2.5 py-2">
                  <Avatar name={c.name} phone={c.phone} size={9} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{c.name || c.phone}</p><p className="text-[11px] text-muted">{c.phone} · {fmtWhen(new Date(c.startedAt).toISOString(), L.hi)}</p></div>
                  <button type="button" onClick={() => setFill(c)} className="grad-brand rounded-lg px-3 py-1.5 text-xs font-semibold text-white">{T("Fill now", "अभी भरें")}</button>
                  <button type="button" onClick={() => dropUnlogged(c)} className="rounded-lg border border-border p-1.5 text-muted" aria-label={T("Remove", "हटाएँ")}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {fill && <CallOutcomeSheet pending={fill} onSaved={notifyLogged} onClose={() => setFill(null)} />}
    </>
  );
}

/* ---------------- dial a number: search it, or add it and call ---------------- */
const tenOf = (v: string) => { const d = v.replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };
/** A number typed or pasted (from WhatsApp, a message…): if it is already a customer, call them from here; if not, add it and call,
 *  so the call and its outcome are saved in the CRM either way (owner, 23 Oct 2026). */
export function DialSheet({ onClose }: { onClose: () => void }) {
  const { L, ctx, as, startCall, openCustomer } = useShell();
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [found, setFound] = useState<LeadPro[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pasteFail, setPasteFail] = useState(false);
  const T = (en: string, hi: string) => (L.hi ? hi : en);
  const ten = tenOf(num);
  const valid = ten.length === 10;
  useEffect(() => {
    setErr("");
    if (ten.length < 4) { setFound(null); return; }
    let dead = false;
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ q: ten, page: "0" }); if (as) sp.set("as", as);
      const r = await api<{ leads: LeadPro[] }>(`/api/crm/leads?${sp}`).catch(() => null);
      if (!dead) setFound(r?.ok ? r.data.leads.filter((l) => tenOf(l.phone).includes(ten) || tenOf(l.alt_phone || "").includes(ten)).slice(0, 6) : []);
    }, 250);
    return () => { dead = true; clearTimeout(t); };
  }, [ten, as]);
  const exact = found?.find((l) => tenOf(l.phone) === ten) ?? null;
  async function paste() {
    setPasteFail(false);
    try { const t = await navigator.clipboard.readText(); if (t) setNum(t.replace(/[^\d+\s-]/g, "").trim().slice(0, 20)); else setPasteFail(true); } catch { setPasteFail(true); }
  }
  function call(l: Pick<LeadPro, "id" | "name" | "phone" | "status">) { onClose(); startCall(l); }
  async function addAndCall() {
    if (!valid || busy) return;
    setBusy(true); setErr("");
    const r = await api<{ lead?: LeadPro; id?: string; error?: string }>("/api/crm/lead", { method: "POST", json: { phone: ten, name: name.trim(), as: as ?? undefined, note: T("Added from Dial", "Dial से जोड़ा") } }).catch(() => null);
    setBusy(false);
    if (r?.ok && r.data.lead) { call(r.data.lead); return; }
    if (r?.status === 409 && r.data.id) { call({ id: r.data.id, name: name.trim(), phone: `+91${ten}`, status: "new" }); return; }
    setErr(r?.data.error || L.failed);
  }
  return (
    <BottomSheet title={T("Dial a number", "Number dial करें")} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex gap-2">
          <input value={num} onChange={(e) => setNum(e.target.value.slice(0, 20))} inputMode="tel" autoFocus placeholder={T("Mobile number", "Mobile number")} className={`${inputCls} text-lg font-semibold tracking-wide`} />
          <button type="button" onClick={() => void paste()} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold text-brand-ink"><ClipboardPaste className="h-4 w-4" /> {T("Paste", "Paste")}</button>
        </div>
        {pasteFail && <p className="text-[11px] text-muted">{T("Could not read the copied number. Press and hold the box, then Paste.", "Copy किया number नहीं पढ़ पाए। box को दबाकर रखें, फिर Paste करें।")}</p>}
        {ten.length >= 4 && found === null && <p className="flex items-center gap-2 text-xs text-muted"><Search className="h-3.5 w-3.5" /> {T("Searching your customers…", "आपके ग्राहकों में खोज रहे हैं…")}</p>}
        {found && found.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted">{T("Already in your CRM", "पहले से CRM में है")}</p>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {found.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-2.5 py-2">
                  <button type="button" onClick={() => { onClose(); openCustomer(l.id); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Avatar name={l.name} phone={l.phone} size={9} />
                    <span className="min-w-0"><span className="block truncate font-semibold text-ink">{l.name || l.phone}</span><span className="block text-[11px] text-muted">{l.phone}</span></span>
                  </button>
                  <button type="button" onClick={() => call(l)} className="grad-brand inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"><Phone className="h-3.5 w-3.5" /> {L.call}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {valid && found !== null && !exact && (
          <div className="space-y-2 rounded-xl border border-dashed border-border p-2.5">
            <p className="text-xs font-semibold text-ink">{T("New number: it will be added to your CRM, then called", "नया number: पहले CRM में जुड़ेगा, फिर call होगी")}</p>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={T("Name (optional)", "नाम (optional)")} className={inputCls} />
            {ctx.role === "agent"
              ? <a href={telLink(`91${ten}`)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 font-semibold text-ink"><Phone className="h-4 w-4" /> {T("Call (not saved in the CRM)", "Call करें (CRM में save नहीं होगा)")}</a>
              : <button type="button" disabled={busy} onClick={() => void addAndCall()} className="grad-brand inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {T("Add & call", "जोड़ें और call करें")}</button>}
          </div>
        )}
        {num && !valid && ten.length > 0 && <p className="text-[11px] text-muted">{T("Enter the full 10-digit mobile number.", "पूरा 10 अंकों का mobile number डालें।")}</p>}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      </div>
    </BottomSheet>
  );
}

/* ---------------- personal number: out of the CRM, away from the AI, for good ---------------- */
/** "Personal number" (owner, 23 Oct 2026): family / friends. Asks once, then removes the customer (and their chat) from the CRM
 *  and puts the number on the never-reply list, so the AI never answers it and it never comes back as a lead. */
export function PersonalButton({ lead, onDone, className = "" }: { lead: Pick<LeadPro, "id" | "name" | "phone">; onDone: () => void; className?: string }) {
  const { L, ctx, as, reload } = useShell();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (ctx.role === "agent" || !lead.phone) return null;
  const T = (en: string, hi: string) => (L.hi ? hi : en);
  async function go() {
    setBusy(true); setErr("");
    const r = await api<{ ok?: boolean; error?: string }>("/api/crm/block", { method: "POST", json: { lead_id: lead.id, as: as ?? undefined } }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setErr(r?.data.error || L.failed); return; }
    setAsk(false); dropUnlogged({ leadId: lead.id, startedAt: Date.now() }); reload(); onDone();
  }
  return (
    <>
      <button type="button" onClick={() => setAsk(true)} className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-danger ${className}`}>🚫 {T("Personal number — remove from CRM", "Personal number — CRM से हटाएँ")}</button>
      {ask && (
        <BottomSheet title={T("Personal number?", "Personal number है?")} onClose={() => setAsk(false)}>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-ink">{lead.name || lead.phone} · {lead.phone}</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              <li>{T("Removed from the CRM for good, with its chat, tasks and calls.", "CRM से हमेशा के लिए हट जाएगा — chat, tasks और calls के साथ।")}</li>
              <li>{T("The AI never replies to this number on WhatsApp, and sends no follow-up, wish or broadcast.", "WhatsApp पर AI इस number को कभी जवाब नहीं देगा, न follow-up, wishes या broadcast भेजेगा।")}</li>
              <li>{T("New messages from it are not saved as a lead. You still see them in your own WhatsApp.", "इसके नए message lead नहीं बनेंगे। आपके अपने WhatsApp में message दिखते रहेंगे।")}</li>
              <li>{T("You can bring the number back from CRM → Settings → Personal numbers (the old history does not come back).", "CRM → Settings → Personal numbers से number वापस ला सकते हैं (पुरानी history वापस नहीं आएगी)।")}</li>
            </ul>
            {err && <p role="alert" className="text-xs text-danger">{err}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAsk(false)} className="rounded-xl border border-border py-2.5 font-semibold text-ink">{T("Cancel", "रहने दें")}</button>
              <button type="button" disabled={busy} onClick={() => void go()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger py-2.5 font-semibold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {T("Yes, remove", "हाँ, हटाएँ")}</button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
