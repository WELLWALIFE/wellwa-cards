"use client";

// Super Admin → Shubhora AI. What every Shubhora partner's assistant knows about Shubhora itself — plans, prices,
// features, the app, the partner business. Partners never copy this: their card chat and WhatsApp read it live, so a
// change saved here reaches every partner's assistant within about 5 minutes (WhatsApp refreshes every 5 minutes;
// the card chat reads it on every question). An empty box means the built-in text (bridge/shubhora-kb.mjs).
import { useEffect, useRef, useState } from "react";
import { BellRing, Check, FileText, FlaskConical, Loader2, MessageCircle, Power, RotateCcw, Send, Sparkles } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { savePlatformSettings } from "@/lib/admin-client";
import { SHUBHORA_FAQ, SHUBHORA_KNOWLEDGE, SHUBHORA_PERSONA } from "../../../../bridge/shubhora-kb.mjs";

type Fields = { persona: string; knowledge: string; faq: string };
const BUILT_IN: Fields = { persona: SHUBHORA_PERSONA, knowledge: SHUBHORA_KNOWLEDGE, faq: SHUBHORA_FAQ };

export default function ShubhoraAi() {
  const [f, setF] = useState<Fields>(BUILT_IN);
  const [custom, setCustom] = useState(false);          // something is saved over the built-in text
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) { setLoading(false); return; }
      const { data, error } = await sb.from("platform_settings").select("shubhora_persona, shubhora_knowledge, shubhora_faq").eq("id", 1).maybeSingle();
      if (error) setErr("Run supabase/migrations/0055_shubhora_ai.sql in Supabase once — until then the built-in text is used and edits cannot be saved.");
      else if (data) {
        const saved = { persona: data.shubhora_persona ?? "", knowledge: data.shubhora_knowledge ?? "", faq: data.shubhora_faq ?? "" };
        setCustom(!!(saved.persona || saved.knowledge || saved.faq));
        setF({ persona: saved.persona || BUILT_IN.persona, knowledge: saved.knowledge || BUILT_IN.knowledge, faq: saved.faq || BUILT_IN.faq });
      }
      setLoading(false);
    })();
  }, []);

  async function save(values: Fields | null) {
    setSaving(true); setErr(""); setNote("");
    const sb = getBrowserSupabase();
    if (!sb) { setErr("Supabase is not connected."); setSaving(false); return; }
    // Text equal to the built-in is stored as empty, so a later built-in update (a deploy) still reaches it.
    const v = values ?? { persona: "", knowledge: "", faq: "" };
    const row = {
      shubhora_persona: v.persona.trim() === BUILT_IN.persona ? "" : v.persona.trim(),
      shubhora_knowledge: v.knowledge.trim() === BUILT_IN.knowledge ? "" : v.knowledge.trim(),
      shubhora_faq: v.faq.trim() === BUILT_IN.faq ? "" : v.faq.trim(),
      updated_at: new Date().toISOString(),
    };
    // Saved through the admin API: the table no longer accepts writes from the browser (owner's review, 28 Sep 2026).
    const error = await savePlatformSettings(row);
    if (error) setErr(error);
    else {
      setCustom(!!(row.shubhora_persona || row.shubhora_knowledge || row.shubhora_faq));
      if (!values) setF(BUILT_IN);
      setNote(values ? "Saved — every Shubhora partner's AI has it within 5 minutes." : "Back to the built-in text.");
    }
    setSaving(false);
  }

  const box = (key: keyof Fields, label: string, hint: string, rows: number) => (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="block text-xs text-muted mb-1">{hint}</span>
      <textarea className="ed-input w-full font-mono text-xs leading-relaxed" rows={rows} value={f[key]}
        onChange={(e) => setF((x) => ({ ...x, [key]: e.target.value }))} />
      <span className="text-[11px] text-faint">{f[key].length.toLocaleString("en-IN")} characters</span>
    </label>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Sparkles className="h-6 w-6 text-ai" /> Shubhora AI</h1>
          <p className="text-muted mt-1 text-sm">
            What every Shubhora partner&apos;s assistant knows about Shubhora — on their card and their WhatsApp. Partners who chose
            &ldquo;Promote Shubhora&rdquo; get it automatically; change it here and all of them are updated.
          </p>
          <p className="text-xs mt-1">{custom ? <b className="text-amber-700">Your edited text is in use.</b> : <span className="text-muted">Built-in text in use.</span>}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save(null)} disabled={saving || loading || !custom} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40">
            <RotateCcw className="h-4 w-4" /> Built-in text
          </button>
          <button onClick={() => save(f)} disabled={saving || loading} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
        </div>
      </div>

      {err && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{err}</p>}
      {note && <p className="rounded-lg border border-good/40 bg-good/10 px-3 py-2 text-sm">{note}</p>}

      <AiSwitch />

      <TestChats />

      <TestBot />

      {loading ? <p className="text-sm text-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p> : (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-5">
          {box("knowledge", "Shubhora facts", "Product, plans and prices, credits, payment and refund, app, partner plan, support. Write facts only — income only as the plan's own limits (pair value, daily cap), never as a promise. Empty = the built-in text.", 22)}
          {box("faq", "Questions and good answers", "Real questions people ask, with the answer you want. The AI copies the style and answers in the customer's language.", 16)}
          {box("persona", "Tone", "How the assistant speaks. A partner's own tone on their card wins over this.", 3)}
        </section>
      )}
    </div>
  );
}

/** Ask a partner's live card assistant — same answer a customer gets on the card (WhatsApp uses the same facts). */
function TestBot() {
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  async function send() {
    const q = input.trim(); const u = username.trim().toLowerCase();
    if (!q || !u || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const r = await fetch(`/api/chat/${encodeURIComponent(u)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const d = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: d.reply ?? d.error ?? "No reply." }]);
    } catch { setMessages((m) => [...m, { role: "assistant", content: "Network error — try again." }]); }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-ai" /> Test on a partner&apos;s card</h2>
      <p className="text-xs text-muted mt-1">Type a Shubhora partner&apos;s card name (the part after /c/) and ask like a customer. Save first to test new text.</p>
      <input className="mt-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm mono" placeholder="card name, e.g. niteen-rajput"
        value={username} onChange={(e) => { setUsername(e.target.value); setMessages([]); }} />
      <div ref={scroller} className="mt-3 h-64 overflow-y-auto rounded-xl border border-border bg-bg p-3 space-y-2.5">
        {messages.length === 0 && <p className="text-sm text-faint text-center py-8">Try: &ldquo;Growth plan me kya milta hai?&rdquo;, &ldquo;WhatsApp kaise connect kare?&rdquo;, &ldquo;kitna kama sakte hain?&rdquo;</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-brand text-white" : "bg-surface border border-border"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm" placeholder="Ask as a customer…" value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }} />
        <button onClick={send} disabled={busy || !input.trim() || !username.trim()} className="rounded-lg grad-brand px-3.5 py-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </section>
  );
}

/** Super Admin API calls carry the admin password (this tab) or the owner's login. */
async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

/** The new partner assistant's switch (platform_settings.ai_v2). WhatsApp picks a change up within 5 minutes, the
 *  card chat at once. */
function AiSwitch() {
  const [value, setValue] = useState<string | null>(null);
  const [pilot, setPilot] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) return;
      const { data, error } = await sb.from("platform_settings").select("ai_v2").eq("id", 1).maybeSingle();
      if (error) { setMissing(true); setValue("off"); return; }
      const v = String((data as { ai_v2?: string } | null)?.ai_v2 ?? "off");
      setValue(v);
      if (!["off", "shubhora", "all"].includes(v)) setPilot(v);
    })();
  }, []);

  const mode = value === null ? "" : ["off", "shubhora", "all"].includes(value) ? value : "pilot";
  async function save(next: string) {
    setSaving(true); setMsg("");
    const error = await savePlatformSettings({ ai_v2: next });
    if (error) setMsg(error);
    else { setValue(next); setMsg(next === "off" ? "Switched off — everything works as before." : "Saved — the card chat uses it now, WhatsApp within 5 minutes."); }
    setSaving(false);
  }

  const option = (id: string, title: string, hint: string) => (
    <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer ${mode === id ? "border-brand bg-brand/5" : "border-border"}`}>
      <input type="radio" name="aiv2" className="mt-1" checked={mode === id} disabled={saving || missing}
        onChange={() => (id === "pilot" ? setValue(pilot.trim() || "pilot") : save(id))} />
      <span><span className="text-sm font-semibold block">{title}</span><span className="text-xs text-muted">{hint}</span></span>
    </label>
  );

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
      <h2 className="font-semibold flex items-center gap-2"><Power className="h-4 w-4 text-ai" /> New AI for Shubhora partners</h2>
      <p className="text-xs text-muted">
        Menu for a new &ldquo;Hi&rdquo; (V-Card · services · custom software · partner programme), everyday Hindi in Devanagari, the PDF sent as a file,
        the partner&apos;s joining link, memory across days, and personal chats left alone. Run the test chats below first.
      </p>
      {missing && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">Run <b>supabase/migrations/0056_ai_v2.sql</b> in Supabase once — until then the new AI stays off.</p>}
      {value === null && !missing ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : (
        <div className="grid gap-2">
          {option("off", "Off", "Every assistant works exactly as before.")}
          {option("pilot", "Pilot — only these cards", "Try it on one or two partners' WhatsApp and card chat first.")}
          {mode === "pilot" && (
            <div className="flex gap-2 pl-7">
              <input className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm mono" placeholder="card names, e.g. niteen, next_level"
                value={pilot} onChange={(e) => setPilot(e.target.value)} />
              <button onClick={() => save(pilot.trim().toLowerCase())} disabled={saving || !pilot.trim()} className="rounded-lg grad-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
            </div>
          )}
          {option("shubhora", "On — all Shubhora partner cards", "Every partner who promotes Shubhora, on WhatsApp and on the card chat.")}
          {option("all", "On — all cards", "Shubhora partners get the new AI; every other card keeps its own AI and also gets the memory and the personal-message filter.")}
        </div>
      )}
      {msg && <p className="text-xs">{msg}</p>}
    </section>
  );
}

type Line = { who: "customer" | "assistant" | "note"; text: string; files?: string[]; alert?: string | null; why?: string; at: string };
type Run = { id: string; title: string; channel: string; lines: Line[] };

/** Scripted conversations answered by the new AI with the real model — on the server only, nothing is sent. */
function TestChats() {
  const [username, setUsername] = useState("niteen");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ card: string; seconds: number; flag: string; runs: Run[] } | null>(null);

  async function run() {
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await fetch("/api/admin/ai-test", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ username }) });
      const d = await r.json();
      if (!r.ok) setErr(d.error || `Error ${r.status}`);
      else setResult(d);
    } catch { setErr("Network error — try again."); }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="font-semibold flex items-center gap-2"><FlaskConical className="h-4 w-4 text-ai" /> Test chats — new AI (nothing is sent)</h2>
      <p className="text-xs text-muted mt-1">
        12 ready conversations (new &ldquo;Hi&rdquo;, PDF, rate, plan, next day, English, software, personal, good-morning, website chat) answered by the new AI
        with the real model, as a partner&apos;s WhatsApp would. Works whether the switch is on or off.
      </p>
      <div className="mt-3 flex gap-2">
        <input className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm mono" placeholder="partner card name, e.g. niteen"
          value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={run} disabled={busy || !username.trim()} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} {busy ? "Running… (about a minute)" : "Run test chats"}
        </button>
      </div>
      {err && <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{err}</p>}
      {result && (
        <div className="mt-4 space-y-4" id="ai-test-transcripts">
          <p className="text-xs text-muted">Card /c/{result.card} · switch: <b>{result.flag}</b> · {result.runs.length} chats in {result.seconds}s</p>
          {result.runs.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-bg p-3">
              <p className="text-sm font-semibold mb-2">{r.title} <span className="text-[10px] mono text-faint">{r.channel === "web" ? "card chat" : "WhatsApp"}</span></p>
              <div className="space-y-1.5">
                {r.lines.map((l, i) => l.who === "note" ? (
                  <p key={i} className="text-[11px] text-muted text-center">{l.text}{l.alert ? ` · 🔔 ${l.alert}` : ""}</p>
                ) : (
                  <div key={i} className={`flex ${l.who === "customer" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${l.who === "customer" ? "bg-[#dcf8c6] text-[#111]" : "bg-surface border border-border"}`}>
                      {l.text}
                      {l.files?.map((f) => <span key={f} className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold"><FileText className="h-3.5 w-3.5" /> PDF: {f.split("/").pop()}</span>)}
                      {l.alert && <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-700"><BellRing className="h-3.5 w-3.5" /> Alert to partner: {l.alert}</span>}
                      {l.why && <span className="block mt-1 text-[10px] text-faint mono">{l.why} · {l.at}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
