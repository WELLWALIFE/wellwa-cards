"use client";
// WhatsApp Business (Cloud API) mode: the user connects their own Meta
// credentials, then gets templates, broadcasts and the green-tick checklist.
// Bearer routes under /api/wa-cloud/* (works inside the Shubhora shell and the dashboard).
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Copy, Check, RefreshCw, Send, Plus, Trash2, BadgeCheck, Megaphone, FileText, Plug, X } from "lucide-react";
import { api } from "@/lib/poster-client";

type Account = { phone_number_id: string; waba_id: string; access_token: string; app_secret: string; verify_token: string; display_phone: string; verified_name: string; quality_rating: string; messaging_limit: string; official: boolean; enabled: boolean; ai_enabled: boolean; last_error: string; connected_at: string };
type Tpl = { id: string; name: string; status: string; category: string; language: string; components: { type: string; format?: string; text?: string; buttons?: { type: string; text: string; url?: string }[] }[]; rejected_reason?: string };
type Bc = { id: string; name: string; template_name: string; status: string; total: number; sent: number; delivered: number; read: number; failed: number; created_at: string; scheduled_at: string | null };

const inputCls = "w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand";
const Copyable = ({ v }: { v: string }) => { const [ok, setOk] = useState(false); return <button type="button" onClick={() => { navigator.clipboard?.writeText(v); setOk(true); setTimeout(() => setOk(false), 1500); }} className="p-1 text-muted" aria-label="Copy">{ok ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}</button>; };
const tierLabel = (t: string) => ({ TIER_50: "50 / day (test)", TIER_250: "250 / day", TIER_1K: "1,000 / day", TIER_10K: "10,000 / day", TIER_100K: "100,000 / day", TIER_UNLIMITED: "Unlimited" } as Record<string, string>)[t] ?? (t || "—");
const bodyOf = (t: Tpl) => t.components.find((c) => c.type === "BODY")?.text ?? "";
const varsOf = (t: Tpl) => (bodyOf(t).match(/\{\{\d+\}\}/g) ?? []).length;

export function WaCloudPanel() {
  const [tab, setTab] = useState<"connect" | "templates" | "broadcast" | "tick">("connect");
  const [acc, setAcc] = useState<Account | null | undefined>(undefined);
  const [hook, setHook] = useState({ url: "", verify: "" });
  const load = useCallback(async () => {
    const r = await api<{ account: Account | null; webhook_url: string; verify_token: string; error?: string }>("/api/wa-cloud/account");
    if (r.ok) { setAcc(r.data.account); setHook({ url: r.data.webhook_url, verify: r.data.verify_token }); } else setAcc(null);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (acc === undefined) return <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-full border border-border bg-surface p-0.5 text-xs font-semibold">
        {([["connect", "Connect", Plug], ["templates", "Templates", FileText], ["broadcast", "Broadcast", Megaphone], ["tick", "Green tick", BadgeCheck]] as const).map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${tab === k ? "grad-brand text-white" : "text-muted"}`}><I className="h-3.5 w-3.5" />{l}</button>
        ))}
      </div>
      {tab === "connect" && <Connect acc={acc} hook={hook} onChange={load} />}
      {tab === "templates" && (acc ? <Templates acc={acc} /> : <NeedConnect />)}
      {tab === "broadcast" && (acc ? <Broadcast acc={acc} /> : <NeedConnect />)}
      {tab === "tick" && <GreenTick acc={acc} onRefresh={load} />}
    </div>
  );
}
const NeedConnect = () => <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Connect your Cloud API number first (Connect tab).</p>;

/* ---------------- connect ---------------- */
function Connect({ acc, hook, onChange }: { acc: Account | null; hook: { url: string; verify: string }; onChange: () => void }) {
  const [f, setF] = useState({ phone_number_id: acc?.phone_number_id ?? "", waba_id: acc?.waba_id ?? "", access_token: "", app_secret: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [test, setTest] = useState({ to: "", text: "", out: "" });
  const [edit, setEdit] = useState(!acc);
  async function save() {
    setBusy(true); setMsg("");
    const body: Record<string, unknown> = { phone_number_id: f.phone_number_id, waba_id: f.waba_id };
    if (f.access_token) body.access_token = f.access_token; if (f.app_secret) body.app_secret = f.app_secret;
    const r = await api<{ ok: boolean; error?: string }>("/api/wa-cloud/account", { method: "PUT", json: body });
    setBusy(false); setMsg(r.ok ? "Connected ✓ — now register the webhook below (one time)." : r.data.error || "Could not connect.");
    if (r.ok) { setEdit(false); setF({ ...f, access_token: "", app_secret: "" }); onChange(); }
  }
  async function toggle(k: "enabled" | "ai_enabled", v: boolean) { await api("/api/wa-cloud/account", { method: "PATCH", json: { [k]: v } }); onChange(); }
  async function disconnect() { if (!confirm("Disconnect the Cloud API number? Replies and broadcasts will stop.")) return; await api("/api/wa-cloud/account", { method: "DELETE" }); onChange(); setEdit(true); }
  async function sendTest(template?: boolean) {
    setBusy(true); setTest({ ...test, out: "" });
    const r = await api<{ ok: boolean; error?: string }>("/api/wa-cloud/account", { method: "POST", json: template ? { to: test.to, template: "hello_world", lang: "en_US" } : { to: test.to, text: test.text } });
    setBusy(false); setTest({ ...test, out: r.ok ? "Sent ✓ — check the phone." : r.data.error || "Failed." });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <h3 className="font-semibold">1 · Your Meta credentials</h3>
        {acc && !edit ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${acc.enabled ? "bg-good" : "bg-faint"}`} /><b className="text-ink">{acc.display_phone || acc.phone_number_id}</b>{acc.verified_name && <span className="text-muted">· {acc.verified_name}</span>}{acc.official && <span className="rounded-full bg-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-good">✓ Official</span>}</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>Quality: <b className="text-ink">{acc.quality_rating || "—"}</b></div><div>Limit: <b className="text-ink">{tierLabel(acc.messaging_limit)}</b></div>
              <div>Phone number ID: <span className="mono">{acc.phone_number_id}</span></div><div>WABA ID: <span className="mono">{acc.waba_id || "—"}</span></div>
              <div>Token: <span className="mono">{acc.access_token}</span></div><div>App secret: {acc.app_secret ? "set ✓" : <span className="text-lead">not set</span>}</div>
            </div>
            {acc.last_error && <p className="rounded-lg bg-danger/10 px-2 py-1 text-xs text-danger">Last error: {acc.last_error}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={acc.enabled} onChange={(e) => toggle("enabled", e.target.checked)} /> API mode ON</label>
              <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={acc.ai_enabled} onChange={(e) => toggle("ai_enabled", e.target.checked)} /> AI auto-reply</label>
              <button type="button" onClick={() => setEdit(true)} className="ml-auto rounded-lg border border-border px-2 py-1 text-xs text-muted">Edit</button>
              <button type="button" onClick={disconnect} className="rounded-lg border border-border px-2 py-1 text-xs text-danger">Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted">From <b>developers.facebook.com → your app → WhatsApp → API setup</b>. Use a <b>permanent</b> System User token (Business settings → System users → Generate token with whatsapp_business_messaging + whatsapp_business_management).</p>
            <input value={f.phone_number_id} onChange={(e) => setF({ ...f, phone_number_id: e.target.value })} placeholder="Phone number ID *" className={inputCls} inputMode="numeric" />
            <input value={f.waba_id} onChange={(e) => setF({ ...f, waba_id: e.target.value })} placeholder="WhatsApp Business Account ID (for templates & broadcasts)" className={inputCls} inputMode="numeric" />
            <input value={f.access_token} onChange={(e) => setF({ ...f, access_token: e.target.value })} placeholder={acc ? "Access token (leave blank to keep current)" : "Permanent access token *"} className={inputCls + " mono text-xs"} type="password" />
            <input value={f.app_secret} onChange={(e) => setF({ ...f, app_secret: e.target.value })} placeholder={acc?.app_secret ? "App secret (leave blank to keep current)" : "App secret (recommended — verifies webhooks)"} className={inputCls + " mono text-xs"} type="password" />
            <div className="flex gap-2">{acc && <button type="button" onClick={() => setEdit(false)} className="rounded-xl border border-border px-3 py-2 text-xs text-muted">Cancel</button>}<button type="button" disabled={busy || !f.phone_number_id || (!acc && !f.access_token)} onClick={save} className="grad-brand flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Checking with Meta…" : acc ? "Save" : "Connect"}</button></div>
          </div>
        )}
        {msg && <p className={`text-xs ${/Connected|✓/.test(msg) ? "text-good" : "text-danger"}`}>{msg}</p>}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <h3 className="font-semibold">2 · Webhook (one time, in Meta)</h3>
        <p className="text-xs text-muted">Meta app → WhatsApp → <b>Configuration</b> → Webhook → Edit. Paste these, click <b>Verify and save</b>, then <b>Subscribe</b> to <b>messages</b>.</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 rounded-lg bg-surface2/60 p-2"><span className="w-20 shrink-0 text-muted">Callback URL</span><code className="flex-1 truncate text-ink">{hook.url}</code><Copyable v={hook.url} /></div>
          <div className="flex items-center gap-2 rounded-lg bg-surface2/60 p-2"><span className="w-20 shrink-0 text-muted">Verify token</span><code className="flex-1 truncate text-ink">{hook.verify || "(connect first)"}</code>{hook.verify && <Copyable v={hook.verify} />}</div>
        </div>
        <p className="text-[11px] text-faint">Same URL for every user — we route by your phone number ID. Add the app secret above so we can verify Meta&apos;s signature.</p>
        {acc && (
          <div className="space-y-2 border-t border-border pt-3">
            <h4 className="text-sm font-semibold">3 · Test</h4>
            <input value={test.to} onChange={(e) => setTest({ ...test, to: e.target.value })} placeholder="Your own number with country code, e.g. 919876543210" className={inputCls} inputMode="tel" />
            <input value={test.text} onChange={(e) => setTest({ ...test, text: e.target.value })} placeholder="Text (only works within 24 h of the customer's last message)" className={inputCls} />
            <div className="flex gap-2"><button type="button" disabled={busy || test.to.length < 10} onClick={() => sendTest(true)} className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold text-ink disabled:opacity-50">Send “hello_world” template</button><button type="button" disabled={busy || test.to.length < 10 || !test.text} onClick={() => sendTest(false)} className="grad-brand inline-flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Send text</button></div>
            {test.out && <p className={`text-xs ${/✓/.test(test.out) ? "text-good" : "text-danger"}`}>{test.out}</p>}
            <p className="text-[11px] text-faint">Then message this number from another phone: the AI (or your Menu bot) replies and the chat shows in CRM.</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- templates ---------------- */
const STATUS_CLS: Record<string, string> = { APPROVED: "bg-good/15 text-good", PENDING: "bg-lead/15 text-lead", REJECTED: "bg-danger/10 text-danger", PAUSED: "bg-surface2 text-muted", DISABLED: "bg-surface2 text-faint" };
function Templates({ acc }: { acc: Account }) {
  const [tpls, setTpls] = useState<Tpl[] | null>(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: "", category: "MARKETING", language: "en", header_text: "", body: "", footer: "", buttons: [] as { type: string; text: string; url?: string }[], examples: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await api<{ templates: Tpl[]; error?: string }>("/api/wa-cloud/templates"); if (r.ok) { setTpls(r.data.templates); setErr(""); } else { setTpls([]); setErr(r.data.error || "Could not load."); } }, []);
  useEffect(() => { load(); }, [load]);
  async function create() {
    setBusy(true); setErr("");
    const r = await api<{ ok: boolean; status?: string; error?: string }>("/api/wa-cloud/templates", { method: "POST", json: { ...f, examples: f.examples.split("|").map((s) => s.trim()).filter(Boolean) } });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error || "Meta rejected the template."); return; }
    setCreating(false); setF({ name: "", category: "MARKETING", language: "en", header_text: "", body: "", footer: "", buttons: [], examples: "" }); load();
  }
  async function remove(name: string) { if (!confirm(`Delete template "${name}" in Meta?`)) return; await api(`/api/wa-cloud/templates?name=${encodeURIComponent(name)}`, { method: "DELETE" }); load(); }
  const vars = (f.body.match(/\{\{\d+\}\}/g) ?? []).length;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Templates are pre-approved messages (Meta reviews them, usually within minutes to a few hours). You need one to message a customer <b>after 24 h</b> of silence and for broadcasts. Use <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code> for variables (name, city, offer…).</p>
      {!acc.waba_id && <p className="rounded-xl bg-lead/10 px-3 py-2 text-xs text-lead">Add your WABA ID in Connect → Edit to manage templates.</p>}
      {err && <p className="text-xs text-danger">{err}</p>}
      {creating ? (
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm shadow-card">
          <div className="grid grid-cols-2 gap-2">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="name_like_this (lowercase, _)" className={inputCls} />
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inputCls}><option value="MARKETING">Marketing (offers, promos)</option><option value="UTILITY">Utility (order/booking updates)</option></select>
            <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} className={inputCls}><option value="en">English</option><option value="en_US">English (US)</option><option value="hi">Hindi</option><option value="mr">Marathi</option><option value="gu">Gujarati</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="kn">Kannada</option><option value="bn">Bengali</option><option value="pa">Punjabi</option></select>
            <input value={f.header_text} onChange={(e) => setF({ ...f, header_text: e.target.value })} placeholder="Header (optional, short bold line)" className={inputCls} />
          </div>
          <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={4} placeholder={"Namaste {{1}} ji! Is hafte {{2}} par special offer hai. Details ke liye reply karein ya call karein."} className={inputCls} />
          {vars > 0 && <input value={f.examples} onChange={(e) => setF({ ...f, examples: e.target.value })} placeholder={`Example values for review, separated by | (${vars} needed) e.g. Rajesh | Aura Plus`} className={inputCls} />}
          <input value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} placeholder="Footer (optional) e.g. Reply STOP to opt out" className={inputCls} />
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted">Buttons (up to 3)</div>
            {f.buttons.map((b, i) => (
              <div key={i} className="flex gap-1.5">
                <select value={b.type} onChange={(e) => setF({ ...f, buttons: f.buttons.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })} className="rounded-xl border border-border bg-surface px-2 text-xs"><option value="QUICK_REPLY">Quick reply</option><option value="URL">Website link</option><option value="PHONE_NUMBER">Call</option></select>
                <input value={b.text} onChange={(e) => setF({ ...f, buttons: f.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Button text" className={inputCls} />
                {b.type === "URL" && <input value={b.url ?? ""} onChange={(e) => setF({ ...f, buttons: f.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://…" className={inputCls} />}
                {b.type === "PHONE_NUMBER" && <input value={b.url ?? ""} onChange={(e) => setF({ ...f, buttons: f.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value, phone_number: e.target.value } as typeof x : x)) })} placeholder="+91…" className={inputCls} />}
                <button type="button" onClick={() => setF({ ...f, buttons: f.buttons.filter((_, j) => j !== i) })} className="p-1 text-muted" aria-label="Remove"><X className="h-4 w-4" /></button>
              </div>
            ))}
            {f.buttons.length < 3 && <button type="button" onClick={() => setF({ ...f, buttons: [...f.buttons, { type: "QUICK_REPLY", text: "" }] })} className="rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted">+ Button</button>}
          </div>
          <div className="flex gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-border px-3 py-2 text-xs text-muted">Cancel</button><button type="button" disabled={busy || !f.name || !f.body} onClick={create} className="grad-brand flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting to Meta…" : "Submit for approval"}</button></div>
        </div>
      ) : (
        <div className="flex gap-2"><button type="button" disabled={!acc.waba_id} onClick={() => setCreating(true)} className="grad-brand inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> New template</button><button type="button" onClick={load} className="rounded-xl border border-border px-3 py-2 text-xs text-muted" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button></div>
      )}
      {tpls === null ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : tpls.length === 0 ? <p className="text-xs text-faint">No templates yet.</p> : (
        <div className="grid gap-2 md:grid-cols-2">
          {tpls.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex items-center gap-2"><b className="truncate text-ink">{t.name}</b><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLS[t.status] ?? "bg-surface2 text-muted"}`}>{t.status}</span><span className="text-[10px] text-faint">{t.language} · {t.category}</span><button type="button" onClick={() => remove(t.name)} className="ml-auto p-1 text-muted" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{bodyOf(t)}</p>
              {t.rejected_reason && t.rejected_reason !== "NONE" && <p className="mt-1 text-[11px] text-danger">Rejected: {t.rejected_reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- broadcast ---------------- */
const STAGES = ["new", "contacted", "interested", "follow_up", "converted", "lost"];
function Broadcast({ acc }: { acc: Account }) {
  const [list, setList] = useState<Bc[] | null>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [f, setF] = useState({ name: "", template: "", all: true, stages: [] as string[], tags: "", params: [] as { source: string; value: string }[], header_image: "", scheduled_at: "" });
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await api<{ broadcasts: Bc[] }>("/api/wa-cloud/broadcast"); setList(r.ok ? r.data.broadcasts : []); }, []);
  useEffect(() => { load(); (async () => { const r = await api<{ templates: Tpl[] }>("/api/wa-cloud/templates"); if (r.ok) setTpls(r.data.templates.filter((t) => t.status === "APPROVED")); })(); }, [load]);
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const tpl = useMemo(() => tpls.find((t) => `${t.name}|${t.language}` === f.template), [tpls, f.template]);
  const nVars = tpl ? varsOf(tpl) : 0;
  const hasImageHeader = !!tpl?.components.find((c) => c.type === "HEADER" && c.format === "IMAGE");
  useEffect(() => { setF((x) => ({ ...x, params: Array.from({ length: nVars }, (_, i) => x.params[i] ?? { source: i === 0 ? "name" : "custom", value: "" }) })); }, [nVars]);
  useEffect(() => { (async () => { const q = new URLSearchParams({ preview: "1", all: f.all ? "1" : "0", stages: f.stages.join(","), tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean).join(",") }); const r = await api<{ count: number }>(`/api/wa-cloud/broadcast?${q}`); setCount(r.ok ? r.data.count : null); })(); }, [f.all, f.stages, f.tags]);
  async function send() {
    if (!tpl) return; if (!confirm(`Send "${tpl.name}" to ${count} customers${f.scheduled_at ? " at the scheduled time" : " now"}?`)) return;
    setBusy(true); setMsg("");
    const r = await api<{ ok: boolean; total: number; error?: string }>("/api/wa-cloud/broadcast", { method: "POST", json: { name: f.name || tpl.name, template_name: tpl.name, template_lang: tpl.language, params: f.params, header_image: hasImageHeader ? f.header_image : "", audience: { all: f.all, stages: f.stages, tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean) }, scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : undefined } });
    setBusy(false); setMsg(r.ok ? `Queued for ${r.data.total} customers — sending starts within a minute.` : r.data.error || "Failed."); if (r.ok) { setF({ ...f, name: "" }); load(); }
  }
  async function cancel(id: string) { await api("/api/wa-cloud/broadcast", { method: "PATCH", json: { id, action: "cancel" } }); load(); }
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Send an <b>approved template</b> to many leads at once. Meta charges per marketing conversation (~₹0.8) and limits new numbers to <b>{tierLabel(acc.messaging_limit)}</b>; customers who reply STOP are skipped automatically.</p>
      <section className="space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm shadow-card">
        <h3 className="font-semibold">New campaign</h3>
        {tpls.length === 0 ? <p className="text-xs text-lead">No approved templates yet — create one in the Templates tab.</p> : (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Campaign name (internal)" className={inputCls} />
              <select value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })} className={inputCls}><option value="">Choose template…</option>{tpls.map((t) => <option key={t.id} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</option>)}</select>
            </div>
            {tpl && <pre className="whitespace-pre-wrap rounded-xl bg-surface2/60 p-2.5 text-xs text-ink">{bodyOf(tpl)}</pre>}
            {f.params.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs"><span className="w-10 shrink-0 font-mono text-muted">{`{{${i + 1}}}`}</span>
                <select value={p.source} onChange={(e) => setF({ ...f, params: f.params.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })} className="rounded-lg border border-border bg-surface px-2 py-1"><option value="name">Customer first name</option><option value="city">City</option><option value="custom">Fixed text</option></select>
                {p.source === "custom" && <input value={p.value} onChange={(e) => setF({ ...f, params: f.params.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="Text" className={inputCls + " py-1"} />}
              </div>
            ))}
            {hasImageHeader && <input value={f.header_image} onChange={(e) => setF({ ...f, header_image: e.target.value })} placeholder="Header image URL (https, jpg/png)" className={inputCls} />}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1"><input type="radio" checked={f.all} onChange={() => setF({ ...f, all: true })} /> All leads</label>
              <label className="inline-flex items-center gap-1"><input type="radio" checked={!f.all} onChange={() => setF({ ...f, all: false })} /> Filter:</label>
              {!f.all && STAGES.map((s) => <button key={s} type="button" onClick={() => setF({ ...f, stages: f.stages.includes(s) ? f.stages.filter((x) => x !== s) : [...f.stages, s] })} className={`rounded-full border px-2 py-0.5 ${f.stages.includes(s) ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>{s.replace("_", " ")}</button>)}
              {!f.all && <input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="tags, comma separated" className={inputCls + " max-w-48 py-1"} />}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted">Schedule (optional)</span><input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} className={inputCls + " max-w-56 py-1"} /><span className="ml-auto font-semibold text-ink">{count === null ? "…" : `${count} customers`}</span></div>
            <button type="button" disabled={busy || !tpl || !count} onClick={send} className="grad-brand inline-flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Megaphone className="h-4 w-4" /> {f.scheduled_at ? "Schedule broadcast" : "Send broadcast"}</button>
            {msg && <p className={`text-xs ${/Queued/.test(msg) ? "text-good" : "text-danger"}`}>{msg}</p>}
          </>
        )}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Campaigns</h3>
        {list === null ? <LoaderCircle className="h-5 w-5 animate-spin text-muted" /> : list.length === 0 ? <p className="text-xs text-faint">No campaigns yet.</p> : list.map((b) => {
          const pct = b.total ? Math.round(((b.sent + b.failed) / b.total) * 100) : 0;
          return (
            <div key={b.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex items-center gap-2"><b className="truncate text-ink">{b.name}</b><span className="text-[10px] text-faint">{b.template_name}</span><span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${b.status === "done" ? "bg-good/15 text-good" : b.status === "sending" ? "bg-ai/10 text-ai" : b.status === "scheduled" ? "bg-lead/15 text-lead" : "bg-surface2 text-muted"}`}>{b.status}</span>{["scheduled", "sending"].includes(b.status) && <button type="button" onClick={() => cancel(b.id)} className="text-[11px] text-danger">Cancel</button>}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted"><span>Total <b className="text-ink">{b.total}</b></span><span>Sent <b className="text-ink">{b.sent}</b></span><span>Delivered <b className="text-ink">{b.delivered}</b></span><span>Read <b className="text-good">{b.read}</b></span><span>Failed <b className={b.failed ? "text-danger" : "text-ink"}>{b.failed}</b></span>{b.scheduled_at && b.status === "scheduled" && <span>⏰ {new Date(b.scheduled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* ---------------- green tick ---------------- */
function GreenTick({ acc, onRefresh }: { acc: Account | null; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); await api("/api/wa-cloud/account", { method: "PATCH", json: { refresh: true } }); setBusy(false); onRefresh(); }
  const steps = [
    { t: "Business verification in Meta Business Manager", d: "Business settings → Security centre → Start verification. Needs GST / company registration / utility bill with the business name and address. 2-10 days.", ok: !!acc?.verified_name },
    { t: "Display name approved", d: "Your WhatsApp display name must match the verified business. Check WhatsApp Manager → Phone numbers.", ok: acc?.verified_name ? true : false },
    { t: "Good messaging quality", d: "Keep quality rating GREEN: no spam, use templates people opted in for, respect STOP.", ok: acc?.quality_rating === "GREEN" },
    { t: "Two-step verification ON", d: "WhatsApp Manager → Phone numbers → Two-step verification.", ok: undefined },
    { t: "Request Official Business Account (green tick)", d: "WhatsApp Manager → Phone numbers → your number → “Request official business account”. Meta reviews notability (website, press, social presence). Free — never pay an agency for it.", ok: !!acc?.official },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm shadow-card">
        <div className="flex items-center gap-2"><BadgeCheck className={`h-5 w-5 ${acc?.official ? "text-good" : "text-faint"}`} /><b className="text-ink">{acc?.official ? "Green tick active ✓" : "Green tick not yet"}</b>{acc && <button type="button" disabled={busy} onClick={refresh} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted"><RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> Re-check</button>}</div>
        {acc && <p className="mt-1 text-xs text-muted">{acc.display_phone} · name: <b>{acc.verified_name || "—"}</b> · quality: <b>{acc.quality_rating || "—"}</b> · limit: <b>{tierLabel(acc.messaging_limit)}</b></p>}
        {!acc && <p className="mt-1 text-xs text-muted">Connect your Cloud API number first. The green tick (Official Business Account) is only possible on the official API, not on the QR/mobile connection.</p>}
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${s.ok ? "bg-good/15 text-good" : "bg-surface2 text-muted"}`}>{s.ok ? "✓" : i + 1}</span>
            <div><div className="font-semibold text-ink">{s.t}</div><div className="text-xs text-muted">{s.d}</div></div>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-faint">Tip: the green tick is granted by Meta only; a strong website (your card/website link), consistent business name across Google/Facebook/Instagram and some press or directory listings help the notability check.</p>
    </div>
  );
}
