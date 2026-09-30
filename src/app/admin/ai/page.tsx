"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Bot, MessageCircle, Send } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { savePlatformSettings } from "@/lib/admin-client";
import { DEFAULT_PLATFORM_RULES } from "@/lib/ai-training";
import { TrainAiPanel } from "@/components/editor/ai-fields";

/* Talk to any card's live bot exactly as a customer would — same API, same
 * training, same answer. The fastest way to catch a bad answer before a
 * customer does. */
function TestBot() {
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const q = input.trim();
    const u = username.trim().toLowerCase();
    if (!q || !u || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const r = await fetch(`/api/chat/${encodeURIComponent(u)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? data.error ?? "No reply." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error — try again." }]);
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-ai" /> Test the bot</h2>
      <p className="text-xs text-muted mt-1">
        Chat with any card&apos;s live assistant — identical to what a customer gets on the card and WhatsApp.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="mono text-xs text-faint shrink-0">card:</span>
        <input
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm mono"
          placeholder="niteen-rajput"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setMessages([]); }}
        />
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-xs text-muted hover:text-ink shrink-0">Clear</button>
        )}
      </div>
      <div ref={scroller} className="mt-3 h-72 overflow-y-auto rounded-xl border border-border bg-bg p-3 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-sm text-faint text-center py-8">
            Type a card link name above, then ask anything — price, demo, warranty, business plan, even tricky questions.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "bg-brand text-white rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-2xl bg-surface border border-border px-3.5 py-2.5"><Loader2 className="h-4 w-4 animate-spin text-muted" /></div></div>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          placeholder="Ask as a customer…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={busy || !input.trim() || !username.trim()}
          className="rounded-lg grad-brand px-3.5 py-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </section>
  );
}

// Super Admin → global AI bot training. This is the COMPANY-WIDE knowledge every
// distributor's bot inherits (e.g. Wellwa product range, warranty, business plan).
// Each user then adds their own per-card knowledge in the card editor.
export default function AdminAi() {
  const [persona, setPersona] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = getBrowserSupabase();
      if (!sb) { setLoading(false); return; }
      const { data } = await sb
        .from("platform_settings")
        .select("bot_persona, bot_knowledge")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setPersona(data.bot_persona ?? "");
        setKnowledge(data.bot_knowledge ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    // Saved through the admin API: the table no longer accepts writes from the browser (owner's review, 28 Sep 2026).
    const error = await savePlatformSettings({ bot_persona: persona, bot_knowledge: knowledge });
    if (error) setErr(error);
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  }

  const alwaysOn = DEFAULT_PLATFORM_RULES;
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-ai" /> Global AI bot training
          </h1>
          <p className="text-muted mt-1">
            Layer 1 of 3. This is how every assistant <em>behaves</em>; a white-label brand adds
            its products, and each card adds its own details on top.
          </p>
        </div>

      <details className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <summary className="text-sm font-medium cursor-pointer">
          Rules already applied to every card (built in)
        </summary>
        <p className="text-xs text-muted mt-2">
          These run on every answer whether or not you write anything below — language matching,
          short replies, always ending with a question, and the safety limits.
        </p>
        <pre className="mt-2 text-[11px] whitespace-pre-wrap text-muted bg-surface2/60 rounded-lg p-3 max-h-64 overflow-y-auto">{alwaysOn}</pre>
      </details>
        <button
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white shadow-card disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <TestBot />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        {loading ? (
          <p className="text-sm text-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : (
          <TrainAiPanel
            persona={persona}
            knowledge={knowledge}
            onPersona={setPersona}
            onKnowledge={setKnowledge}
          />
        )}
      </section>
    </div>
  );
}
