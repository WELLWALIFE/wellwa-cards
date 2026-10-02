"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, Smartphone, Building2, RefreshCw, LogOut, Check, Plus, X, Bot, Send, LoaderCircle,
  CalendarClock, Sparkles,
} from "lucide-react";
import { useFeature } from "@/lib/plan";
import { WaCloudPanel } from "@/components/wa-cloud-panel";
import { api } from "@/lib/poster-client";

import { authHeaders } from "@/lib/auth-headers";
import { getBrowserSupabase } from "@/lib/supabase/browser";
/** Our WhatsApp API with the session as a Bearer token too — the cookie copy alone failed on phones ("Please sign in again"). */
const waFetch = async (url: string, init?: RequestInit) => fetch(url, { ...init, headers: { ...(await authHeaders()), ...((init?.headers as Record<string, string> | undefined) ?? {}) } });

type Mode = "mobile" | "api";
type Status = {
  state: string; me?: { id: string; name: string } | null; aiConfigured: boolean; enabled: boolean; aiActive?: boolean;
  /** "Link with phone number": the number a code was asked for, and the code once WhatsApp gave it. */
  pairPhone?: string | null; pairCode?: string | null;
};
type Rule = { keywords: string[]; reply: string };
type Followup = { enabled: boolean; businessStart: number; businessEnd: number; maxPerTick?: number };
type Config = {
  enabled: boolean; cardUsername: string; businessName: string;
  welcome: string; rules: Rule[]; fallback: string; aiEnabled: boolean;
  replyMode?: "ai" | "ai-only" | "rules";
  followup?: Followup;
  /** Numbers the assistant never answers (family, friends) — kept by the bridge as digits. */
  neverReply?: string[];
};

const MODES: { id: "ai" | "ai-only" | "rules"; label: string; desc: string }[] = [
  { id: "ai", label: "AI-primary", desc: "Menu digits (1/2/3) → fixed reply; everything else → AI. Recommended." },
  { id: "ai-only", label: "AI only", desc: "Every message answered by AI (most natural; more API usage)." },
  { id: "rules", label: "Rules only", desc: "Keyword rules first, AI as backup (fewer API calls)." },
];

const FEATURES: { f: string; qr: boolean | "partial"; api: boolean | "partial" }[] = [
  { f: "AI auto-reply + Menu bot + CRM chat log", qr: true, api: true },
  { f: "Reply / photo / PDF from CRM, team inbox", qr: true, api: true },
  { f: "Use your existing personal number", qr: true, api: false },
  { f: "Voice note understanding (Whisper)", qr: true, api: false },
  { f: "Post to WhatsApp Status daily", qr: true, api: false },
  { f: "Follow-up reminders in your own chat", qr: true, api: "partial" },
  { f: "Broadcast campaigns with delivery / read reports", qr: false, api: true },
  { f: "Approved templates (message after 24 h)", qr: false, api: true },
  { f: "Green tick (Official Business Account)", qr: false, api: true },
  { f: "No ban risk, Meta-official, Click-to-WhatsApp ads", qr: false, api: true },
];
function FeatureTable() {
  const cell = (v: boolean | "partial") => (v === true ? <Check className="mx-auto h-4 w-4 text-good" /> : v === "partial" ? <span className="text-[10px] text-lead">app push</span> : <span className="text-faint">—</span>);
  return (
    <details className="rounded-xl border border-border bg-surface2/40 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-ink">Which features work in which mode?</summary>
      <table className="mt-2 w-full"><thead><tr className="text-left text-[10px] uppercase text-faint"><th className="py-1">Feature</th><th className="text-center">Mobile (QR)</th><th className="text-center">Business API</th></tr></thead>
        <tbody>{FEATURES.map((r) => <tr key={r.f} className="border-t border-border"><td className="py-1 text-muted">{r.f}</td><td className="text-center">{cell(r.qr)}</td><td className="text-center">{cell(r.api)}</td></tr>)}</tbody></table>
    </details>
  );
}

function WhatsappPageInner({ free = false }: { free?: boolean }) {
  const [mode, setMode] = useState<Mode | null>(null);
  // Default to the mode that is actually connected (Cloud API account → API; else QR).
  useEffect(() => { (async () => { try { const r = await api<{ account: { enabled: boolean } | null }>("/api/wa-cloud/account"); setMode(r.ok && r.data.account?.enabled ? "api" : "mobile"); } catch { setMode("mobile"); } })(); }, []);
  if (!mode) return <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="h-12 w-12 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "var(--good)" }}>
          <MessageCircle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Auto-Reply</h1>
          <p className="text-muted mt-1 max-w-2xl">
            A 24/7 assistant answers your WhatsApp automatically — powered by AI when a key is set,
            with keyword rules as a fallback. Every chat is captured as a lead.
          </p>
        </div>
      </div>

      {/* mode switch */}
      <div className="flex gap-1 p-1 rounded-xl border border-border bg-surface2/50 w-fit">
        <button onClick={() => setMode("mobile")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${mode === "mobile" ? "bg-surface shadow-card" : "text-muted"}`}>
          <Smartphone className="h-4 w-4" /> My mobile (QR)
        </button>
        <button onClick={() => setMode("api")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${mode === "api" ? "bg-surface shadow-card" : "text-muted"}`}>
          <Building2 className="h-4 w-4" /> Business API
        </button>
      </div>

      <FeatureTable />
      {mode === "mobile" ? <MobileMode free={free} /> : <ApiMode />}
    </div>
  );
}

/* ================= Mode 1: own mobile via QR ================= */
/** The free plan's box instead of the bot settings: the number is linked, the AI auto-reply comes with Growth. */
function GrowthForAi() {
  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-5">
      <h2 className="font-semibold">🤖 AI auto-reply — with the Growth plan</h2>
      <p className="mt-1 text-sm text-muted">Link your number now: post to your WhatsApp Status from the app, and every customer who messages you is saved in your CRM.</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li>✓ The AI answers every customer 24×7 from your own number</li>
        <li>✓ Menu, prices, your card link and the next step — like a salesman</li>
        <li>✓ Follow-ups to people who went quiet</li>
      </ul>
      <a href="/poster/plan" className="mt-4 inline-flex items-center gap-1.5 rounded-xl grad-brand px-4 py-2.5 text-sm font-semibold text-white"><Sparkles className="h-4 w-4" /> See the Growth plan</a>
    </section>
  );
}

function MobileMode({ free = false }: { free?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    try {
      // "?link=1": this page is where a number gets linked, so the bridge may start WhatsApp for it here.
      const response = await waFetch("/api/wa/status?link=1");
      const s = await response.json();
      if (response.status === 401) { setAccessError("Please sign in again to connect your WhatsApp number."); return; }
      if (response.status === 402) { setAccessError("WhatsApp AI is part of the paid plan. Subscribe to connect WhatsApp automation."); return; }
      if (!response.ok) { setAccessError(s.message || "Your WhatsApp session could not be loaded."); return; }
      setAccessError(null);
      if (s.error === "bridge_offline") { setOffline(true); return; }
      setOffline(false);
      setStatus(s);
      if (s.state === "awaiting_qr") {
        const q = await waFetch("/api/wa/qr").then((r) => r.json());
        setQr(q.qr);
      } else setQr(null);
    } catch { setOffline(true); }
  }

  useEffect(() => {
    poll();
    timer.current = setInterval(poll, 3000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  async function logout() {
    await waFetch("/api/wa/logout", { method: "POST" });
    poll();
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
      {/* connection card */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Connection</h2>
        {accessError ? (
          <div className="mt-4 rounded-xl border border-border bg-surface2/50 p-4 text-sm">
            <p className="font-medium text-danger">WhatsApp unavailable</p>
            <p className="text-muted mt-1">{accessError}</p>
          </div>
        ) : offline ? (
          <div className="mt-4 rounded-xl border border-border bg-surface2/50 p-4 text-sm">
            <p className="font-medium text-danger">Bridge not running</p>
            <p className="text-muted mt-1">Start the WhatsApp bridge in a terminal:</p>
            <pre className="mt-2 rounded-lg bg-ink text-bg px-3 py-2 text-xs overflow-x-auto mono">npm run wa</pre>
            <p className="text-muted mt-2 text-xs">Then this page connects automatically.</p>
          </div>
        ) : status?.state === "connected" ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-good text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-good animate-pulse" /> Connected
            </div>
            <p className="text-sm text-muted">Linked: <span className="mono text-ink">{status.me?.id?.split(":")[0]}</span></p>
            <p className="text-xs">AI replies: {status.aiActive === false
              ? <span className="text-muted">off — comes with the Growth plan</span>
              : status.aiConfigured
              ? <span className="text-ai font-medium">ON</span>
              : <span className="text-muted">off — keyword rules only</span>}</p>

            <div className="rounded-lg bg-amber-soft/60 border border-amber/30 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-lead">⚠️ How to test auto-reply</p>
              <p className="mt-1 text-muted">Message the linked number <b>from a different phone</b>. Messages you send from this same phone are <b>ignored</b> (otherwise the bot would reply to itself).</p>
            </div>

            <TestSend />

            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-danger hover:bg-surface2">
              <LogOut className="h-4 w-4" /> Unlink
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <UnofficialNotice />
            <LinkBox status={status} qr={qr} onChange={poll} />
          </div>
        )}
        <p className="mt-4 text-[11px] text-faint leading-relaxed">
          Works like WhatsApp Web (linked device). Official WhatsApp Cloud API option for Pro accounts is coming soon.
        </p>
      </section>

      {free ? <GrowthForAi /> : <AutoReplyEditor />}
    </div>
  );
}

/** Two ways to link (owner's call, 28 Sep 2026 — "no second phone"): an 8-letter code typed in WhatsApp on this same
 *  phone, or the QR for a laptop. A phone opens on the code, a computer on the QR. */
function LinkBox({ status, qr, onChange }: { status: Status | null; qr: string | null; onChange: () => void }) {
  // Opens on "On this phone" on a phone and on the QR on a computer (owner's call, 28 Sep 2026); the other is one tap away.
  const [way, setWay] = useState<"code" | "qr">("code");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const code = status?.pairCode ?? null;

  useEffect(() => {
    if (!/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)) setWay("qr");
    // The number to suggest: a mobile sign-up's own number, else the business profile's phone.
    (async () => {
      try {
        const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
        const m = data.session?.user.email?.match(/^p(\d{10,15})@phone\./);
        if (m) { setPhone((p) => p || m[1].slice(-10)); return; }
        const r = await api<{ profiles: { phone: string | null }[] }>("/api/poster/profiles");
        const ph = r.ok ? r.data.profiles.find((x) => x.phone)?.phone : null;
        if (ph) setPhone((p) => p || ph);
      } catch { /* the owner types it */ }
    })();
  }, []);
  useEffect(() => { if (status?.pairCode) setWay("code"); }, [status?.pairCode]);

  async function getCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await waFetch("/api/wa/pair", { method: "POST", body: JSON.stringify({ phone }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.message || (j.error === "already_connected" ? "Already linked." : "Could not get a code. Try again."));
      onChange();
    } catch { setErr("Could not get a code. Try again."); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await waFetch("/api/wa/pair", { method: "POST", body: JSON.stringify({ cancel: true }) }); } catch { /* next poll shows the state */ }
    setBusy(false); setErr(null); onChange();
  }
  function copy() {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  const tab = (id: "code" | "qr", label: string) => (
    <button type="button" onClick={() => setWay(id)}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${way === id ? "border-brand bg-brand-soft/50 font-semibold text-brand-ink ring-1 ring-brand shadow-card" : "border-border bg-surface/60 text-muted hover:border-brand/50 hover:text-ink"}`}>{label}</button>
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tab("code", "📱 On this phone")}
        {tab("qr", "💻 Scan QR")}
      </div>

      {way === "qr" ? (
        <>
          <p className="text-sm text-muted mb-3">Open WhatsApp → <b>Linked devices</b> → <b>Link a device</b>, then scan:</p>
          <div className="rounded-xl border border-border bg-white p-3 grid place-items-center aspect-square">
            {qr && !status?.pairPhone ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="WhatsApp QR" className="w-full" />
            ) : status?.pairPhone ? (
              <div className="text-center text-muted text-sm px-4">
                A code is out for +{status.pairPhone}.
                <button type="button" onClick={cancel} disabled={busy} className="mt-2 block w-full font-semibold text-brand-ink">Show the QR instead</button>
              </div>
            ) : (
              <div className="text-center text-muted text-sm">
                <LoaderCircle className="h-6 w-6 animate-spin mx-auto mb-2" />
                Generating QR…
              </div>
            )}
          </div>
        </>
      ) : code ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Your code for <b className="text-ink">+{status?.pairPhone}</b>:</p>
          <button type="button" onClick={copy} className="w-full rounded-xl border-2 border-good/40 bg-good/5 py-4 text-center">
            <span className="mono text-3xl font-bold tracking-[0.2em] text-ink">{code.slice(0, 4)}-{code.slice(4)}</span>
            <span className="mt-1 block text-xs text-muted">{copied ? "Copied ✓" : "Tap to copy"}</span>
          </button>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Open <b className="text-ink">WhatsApp</b> on this phone.</li>
            <li><b className="text-ink">⋮ (Android)</b> or <b className="text-ink">Settings (iPhone)</b> → <b className="text-ink">Linked devices</b> → <b className="text-ink">Link a device</b>.</li>
            <li>Tap <b className="text-ink">&ldquo;Link with phone number instead&rdquo;</b> and type the code.</li>
          </ol>
          <p className="text-xs text-faint">WhatsApp may also show a notification — tap it and type the code. This page turns green by itself once it is linked.</p>
          <div className="flex gap-4 text-sm">
            <button type="button" onClick={() => getCode()} disabled={busy} className="font-semibold text-brand-ink">{busy ? "Getting…" : "New code"}</button>
            <button type="button" onClick={cancel} disabled={busy} className="text-muted">Change number</button>
          </div>
        </div>
      ) : (
        <form onSubmit={getCode} className="space-y-3">
          <p className="text-sm text-muted">No second phone needed. Enter the WhatsApp number you want to link:</p>
          <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210"
            className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-lg tracking-wide outline-none focus:border-brand" />
          <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 10}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Getting your code…</> : "Get code"}
          </button>
          {err && <p className="text-sm text-danger">{err}</p>}
          <p className="text-xs text-faint">Outside India? Start with your country code, e.g. +971…</p>
        </form>
      )}
    </div>
  );
}

function UnofficialNotice() {
  return (
    <div className="mb-4 rounded-xl border border-border bg-surface2/50 p-3.5 text-xs leading-relaxed">
      <p className="font-semibold text-ink">💡 Good to know before you connect</p>
      <ul className="mt-1.5 space-y-1 text-muted list-disc pl-4">
        <li>This works like <b>WhatsApp Web</b> (a linked device), not the official WhatsApp Business API. It is quick, free and needs no approval.</li>
        <li>WhatsApp prefers automation through its official API, so we recommend linking a <b>dedicated business number</b> rather than your personal one.</li>
        <li>Best used for replying to people who message you. Bulk or marketing broadcasts are better done from the official API.</li>
      </ul>
      <p className="mt-2 text-muted">Want the fully official, Meta-approved setup? The <b>WhatsApp Cloud API</b> option is coming soon for Pro accounts.</p>
    </div>
  );
}

function TestSend() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  async function test() {
    setState("busy"); setMsg("");
    try {
      const s = await waFetch("/api/wa/status").then((r) => r.json());
      const num = s?.me?.id?.split(":")[0];
      if (!num) { setState("err"); setMsg("Not connected."); return; }
      const r = await waFetch("/api/wa/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: num, text: "✅ Shubhora auto-reply is connected! (test message)" }),
      });
      if (r.ok) { setState("done"); setMsg("Sent! Check your WhatsApp — you'll see the test message. This proves sending works; auto-reply fires when someone else messages you."); }
      else { setState("err"); setMsg("Send failed — is WhatsApp still linked?"); }
    } catch { setState("err"); setMsg("Bridge unreachable."); }
  }
  return (
    <div>
      <button onClick={test} disabled={state === "busy"}
        className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test to my WhatsApp
      </button>
      {msg && <p className={`text-xs mt-1.5 ${state === "err" ? "text-danger" : "text-good"}`}>{msg}</p>}
    </div>
  );
}

/* ================= Mode 2: Business API ================= */
function ApiMode() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface2/50 px-3 py-2 text-xs text-muted">
        Official Meta Cloud API with <b>your own</b> credentials: no ban risk, broadcasts, templates and the green tick. Meta bills per conversation (service replies within 24 h are free; marketing templates ≈ ₹0.8 each). The AI assistant, Menu bot and CRM work exactly like the QR mode.
      </div>
      <WaCloudPanel />
    </div>
  );
}

/* ================= shared: auto-reply config editor ================= */
function AutoReplyEditor() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState(false);
  const [offline, setOffline] = useState(false);
  const [neverText, setNeverText] = useState<string | null>(null);

  useEffect(() => {
    waFetch("/api/wa/config").then((r) => r.json()).then((c) => {
      if (c.error) { setOffline(true); return; }
      setConfig(c);
    }).catch(() => setOffline(true));
  }, []);

  async function save() {
    if (!config) return;
    await waFetch("/api/wa/config", { method: "POST", body: JSON.stringify(config) });
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  }

  if (offline) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2 mb-2"><Bot className="h-5 w-5 text-ai" /><h2 className="font-semibold">Auto-reply flows</h2></div>
        <p className="text-sm text-muted">Start the bridge (<span className="mono">npm run wa</span>) to edit the welcome message, keyword rules, and AI settings. Your saved config lives in <span className="mono">bridge/config.json</span>.</p>
      </section>
    );
  }
  if (!config) return <section className="rounded-2xl border border-border bg-surface p-6 shadow-card"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></section>;

  const patch = (p: Partial<Config>) => { setConfig({ ...config, ...p }); setSaved(false); };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-ai" />
          <h2 className="font-semibold">Auto-reply flows</h2>
        </div>
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white">
          {saved ? <Check className="h-4 w-4" /> : null} {saved ? "Saved" : "Save"}
        </button>
      </div>

      <label className="flex items-center gap-3">
        <button onClick={() => patch({ enabled: !config.enabled })}
          className={`relative h-6 w-10 rounded-full transition-colors shrink-0 ${config.enabled ? "bg-good" : "bg-surface2 border border-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-all ${config.enabled ? "left-[1.15rem]" : "left-0.5"}`} />
        </button>
        <span className="text-sm font-medium">Auto-reply {config.enabled ? "on" : "off"}</span>
      </label>

      {/* Reply mode selector */}
      <div>
        <p className="text-sm font-medium mb-2">Reply mode <span className="text-xs text-muted font-normal">— who answers on WhatsApp</span></p>
        <div className="grid gap-2">
          {MODES.map((m) => {
            const active = (config.replyMode ?? "ai") === m.id;
            return (
              <button key={m.id} onClick={() => patch({ replyMode: m.id })}
                className={`text-left rounded-xl border p-3 transition-colors ${active ? "border-ai ring-1 ring-ai bg-ai-soft/40" : "border-border hover:bg-surface2"}`}>
                <span className="flex items-center gap-2">
                  <span className={`h-4 w-4 rounded-full border-2 grid place-items-center ${active ? "border-ai" : "border-border"}`}>
                    {active && <span className="h-2 w-2 rounded-full bg-ai" />}
                  </span>
                  <span className="text-sm font-medium">{m.label}</span>
                </span>
                <span className="block text-xs text-muted mt-1 ml-6">{m.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-faint mt-1.5">AI needs <span className="mono">ANTHROPIC_API_KEY</span>. Uses your card&apos;s products/offers/FAQ as context.</p>
      </div>

      <FollowupSection
        value={config.followup ?? { enabled: true, businessStart: 9, businessEnd: 20 }}
        onChange={(f) => patch({ followup: f })}
      />

      <Field label={<span className="flex items-center gap-1.5">Never auto-reply to these numbers <span className="text-xs text-muted font-normal">(family, friends — one per line)</span></span>}>
        <textarea className="ed-input min-h-16 resize-y mono" placeholder={"98765 43210\n+91 91234 56789"}
          value={neverText ?? (config.neverReply ?? []).join("\n")}
          onChange={(e) => { setNeverText(e.target.value); patch({ neverReply: e.target.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean) }); }} />
        <span className="block text-[11px] text-faint mt-1">The assistant stays silent with them: no reply, no follow-up, not added to Leads. You chat with them as always.</span>
      </Field>

      <Field label="Welcome message (first contact)">
        <textarea className="ed-input min-h-24 resize-y" value={config.welcome} onChange={(e) => patch({ welcome: e.target.value })} />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Keyword rules</p>
          <button className="ed-add !w-auto" onClick={() => patch({ rules: [...config.rules, { keywords: [""], reply: "" }] })}>
            <Plus className="h-3.5 w-3.5" /> Add rule
          </button>
        </div>
        <div className="space-y-3">
          {config.rules.map((rule, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input className="ed-input" value={rule.keywords.join(", ")} placeholder="keywords, comma separated"
                  onChange={(e) => { const rules = config.rules.slice(); rules[i] = { ...rule, keywords: e.target.value.split(",").map((k) => k.trim()) }; patch({ rules }); }} />
                <button className="ed-icon hover:text-danger shrink-0" onClick={() => patch({ rules: config.rules.filter((_, x) => x !== i) })}><X className="h-4 w-4" /></button>
              </div>
              <textarea className="ed-input min-h-16 resize-y" value={rule.reply} placeholder="Reply text"
                onChange={(e) => { const rules = config.rules.slice(); rules[i] = { ...rule, reply: e.target.value }; patch({ rules }); }} />
            </div>
          ))}
        </div>
      </div>

      <Field label={<span className="flex items-center gap-1.5">Fallback <span className="text-xs text-muted font-normal">(no rule matched, AI off/unavailable)</span></span>}>
        <textarea className="ed-input min-h-16 resize-y" value={config.fallback} onChange={(e) => patch({ fallback: e.target.value })} />
      </Field>

      <p className="text-[11px] text-faint flex items-center gap-1.5"><Send className="h-3 w-3" /> Order: keyword rules → AI → welcome/fallback. Every incoming chat is also saved to Leads.</p>
    </section>
  );
}

function FollowupSection({ value, onChange }: { value: Followup; onChange: (f: Followup) => void }) {
  const [preview, setPreview] = useState<{ step: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function doPreview(step: number, lastMsg: string) {
    setBusy(true);
    setPreview(null);
    try {
      const r = await waFetch("/api/wa/followups/test", {
        method: "POST",
        body: JSON.stringify({ step, lastMsg }),
      }).then((x) => x.json());
      setPreview({ step, text: r.message || "(no message — is the bridge + AI key running?)" });
    } catch {
      setPreview({ step, text: "Could not reach the bridge. Run npm run wa." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-ai/30 bg-ai/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="h-5 w-5 text-ai mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">AI auto follow-up</p>
            <p className="text-xs text-muted mt-0.5">
              Automatically nurtures leads who message you: Day&nbsp;1, 3, 6 product reminders, then one gentle
              wellness message a week. Any reply restarts the cycle. Only contacts who messaged you first, business
              hours only, &ldquo;STOP&rdquo; opts out.
            </p>
          </div>
        </div>
        <button onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={`relative h-6 w-10 rounded-full transition-colors shrink-0 mt-0.5 ${value.enabled ? "bg-good" : "bg-surface2 border border-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-all ${value.enabled ? "left-[1.15rem]" : "left-0.5"}`} />
        </button>
      </div>

      {value.enabled && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">Send only between</span>
            <select className="ed-input !w-auto !py-1" value={value.businessStart}
              onChange={(e) => onChange({ ...value, businessStart: Number(e.target.value) })}>
              {hours().map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
            <span className="text-muted">and</span>
            <select className="ed-input !w-auto !py-1" value={value.businessEnd}
              onChange={(e) => onChange({ ...value, businessEnd: Number(e.target.value) })}>
              {hours().map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted mr-1">Preview:</span>
            <button disabled={busy} onClick={() => doPreview(0, "Aura Plus ka price kya hai?")}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> Day 1
            </button>
            <button disabled={busy} onClick={() => doPreview(2, "Payment kaise karna hoga?")}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> Day 6
            </button>
            <button disabled={busy} onClick={() => doPreview(3, "demo kab milega?")}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-surface disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> Weekly
            </button>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin text-ai" />}
          </div>

          {preview && (
            <div className="rounded-lg border border-border bg-surface p-2.5 text-sm">
              <p className="text-[11px] text-faint mb-1">{preview.step <= 2 ? `Day ${[1, 3, 6][preview.step]}` : "Weekly"} message:</p>
              <p className="whitespace-pre-wrap">{preview.text}</p>
            </div>
          )}

          <StartFollowups />
        </>
      )}
    </div>
  );
}

/* Pick existing WhatsApp chats and enroll them into the AI follow-up sequence.
   Safe by design: only 1-to-1 chats the account already has (no cold numbers),
   slow drip (3 new contacts/day), opt-out respected. */
function StartFollowups() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<{ phone: string; name: string; enrolled: boolean; optedOut: boolean }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setResult(null);
    try {
      const r = await waFetch("/api/wa/contacts").then((x) => x.json());
      setContacts(r.contacts ?? []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle(phone: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(phone)) n.delete(phone);
      else if (n.size < 20) n.add(phone); // keep batches small — safety
      return n;
    });
  }

  async function start() {
    if (!sel.size) return;
    setBusy(true);
    setResult(null);
    try {
      const chosen = contacts.filter((c) => sel.has(c.phone)).map((c) => ({ phone: c.phone, name: c.name }));
      const r = await waFetch("/api/wa/followups/start", {
        method: "POST",
        body: JSON.stringify({ contacts: chosen, perDay: 3 }),
      }).then((x) => x.json());
      setResult(`${r.started} contacts enrolled — 3 per day, business hours only.${r.skipped?.length ? ` Skipped ${r.skipped.length}.` : ""}`);
      setSel(new Set());
      load();
    } catch {
      setResult("Could not reach the bridge. Run npm run wa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Start follow-up for existing chats</p>
          <p className="text-[11px] text-muted">Select up to 20 people you already chat with — AI re-engages them gently, 3 per day.</p>
        </div>
        <button
          onClick={() => { setOpen((v) => !v); if (!open) load(); }}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2"
        >
          {open ? "Close" : "Choose contacts"}
        </button>
      </div>

      {open && (
        <>
          {loading ? (
            <p className="text-xs text-muted flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading your chats…</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-muted">No chats found yet. The list fills as your WhatsApp syncs / receives messages (bridge must be linked).</p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {contacts.map((c) => (
                <label key={c.phone} className={`flex items-center gap-2.5 px-3 py-2 text-sm ${c.enrolled || c.optedOut ? "opacity-50" : "cursor-pointer hover:bg-surface2"}`}>
                  <input
                    type="checkbox"
                    className="accent-[var(--brand)]"
                    disabled={c.enrolled || c.optedOut}
                    checked={sel.has(c.phone)}
                    onChange={() => toggle(c.phone)}
                  />
                  <span className="flex-1 truncate">{c.name || c.phone}</span>
                  <span className="mono text-[11px] text-faint">{c.phone}</span>
                  {c.enrolled && <span className="text-[10px] text-good font-medium">active</span>}
                  {c.optedOut && <span className="text-[10px] text-danger font-medium">opted out</span>}
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted">{sel.size}/20 selected</p>
            <button
              onClick={start}
              disabled={busy || !sel.size}
              className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Start AI follow-up
            </button>
          </div>
          {result && <p className="text-[11px] text-good">{result}</p>}
        </>
      )}
    </div>
  );
}

const hours = () => Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}

// Every account may link its WhatsApp (owner's call, 27 Sep 2026): the free plan gets the connection (Status posting,
// messages saved as leads); the AI auto-reply and its settings come with Growth.
// Both ways to connect are offered to everyone (owner's call, 2 Oct 2026): "My mobile" (QR / code, free) and the
// official Business API with the owner's own Meta credentials; the free plan only loses the AI settings.
export default function WhatsappPage() {
  const { allowed, loading } = useFeature("whatsapp");
  return <WhatsappPageInner free={!loading && !allowed} />;
}
