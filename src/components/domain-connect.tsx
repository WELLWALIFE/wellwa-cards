"use client";

// Put the website on the owner's own domain with as little work as possible:
// type the domain → we detect who hosts its DNS and show that company's exact steps and records (with copy buttons
// and a direct link) → we keep checking DNS and, the moment it points here, fit the security certificate and switch
// the site live. The owner can close the page: a background job finishes it and sends a notification.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Globe, LoaderCircle, MessageCircle, RefreshCw, Trash2, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Rec = { host: string; type: string; name: string; value: string; current: string[]; ok: boolean };
type Status = { domain: string; provider: { name: string; dnsUrl: string; steps: string[] }; records: Rec[]; ready: boolean; live?: string[]; lastError?: string | null };

async function call(method: string, url: string, body?: object) {
  const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) return { ok: false, j: { error: "Please log in again." } as Record<string, unknown> };
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

export function DomainConnect({ cardId, username, initialDomain, onChange }: { cardId: string; username: string; initialDomain?: string; onChange?: (d: string) => void }) {
  const [input, setInput] = useState(initialDomain ?? "");
  const [status, setStatus] = useState<Status | null>(null);
  const [live, setLive] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [next, setNext] = useState(20);
  const verifyAt = useRef(0);

  const refresh = useCallback(async (domain: string) => {
    const r = await call("GET", `/api/domains?domain=${encodeURIComponent(domain)}`);
    if (!r.ok) return null;
    const s = r.j as unknown as Status;
    setStatus(s); setLive(s.live ?? []);
    return s;
  }, []);

  useEffect(() => { if (initialDomain) refresh(initialDomain); }, [initialDomain, refresh]);

  const isLive = !!status && live.includes(status.domain);

  const verify = useCallback(async (domain: string) => {
    verifyAt.current = Date.now();
    setBusy("verify"); setErr("");
    const r = await call("PUT", "/api/domains", { domain });
    setBusy("");
    const s = r.j as unknown as Status & { error?: string };
    if (s.records) setStatus((old) => ({ ...(old as Status), ...s }));
    setLive((s.live as string[]) ?? []);
    if (!r.ok) setErr(String(s.error ?? "Not ready yet."));
  }, []);

  // Keep checking until live: every 20 s; as soon as DNS is right, fit the certificate automatically.
  useEffect(() => {
    if (!status || isLive) return;
    const t = setInterval(() => setNext((n) => (n <= 1 ? 20 : n - 1)), 1000);
    return () => clearInterval(t);
  }, [status, isLive]);
  useEffect(() => {
    if (!status || isLive || next !== 20) return;
    (async () => {
      const s = await refresh(status.domain);
      if (s?.ready && !(s.live ?? []).includes(s.domain) && Date.now() - verifyAt.current > 60_000) verify(s.domain);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next]);

  async function connect() {
    // Your own domain works on the free plan too (the card lives there; the website needs the plan).
    setBusy("connect"); setErr("");
    const r = await call("POST", "/api/domains", { domain: input, cardId, username });
    setBusy("");
    if (!r.ok) { setErr(String(r.j.error ?? "Could not add that domain.")); return; }
    const s = r.j as unknown as Status;
    setStatus(s); setLive([]); setInput(s.domain); onChange?.(s.domain); setNext(20);
    if (s.ready) verify(s.domain);
  }

  async function remove() {
    if (!status || !confirm(`Disconnect ${status.domain}? Your ${username} link keeps working.`)) return;
    setBusy("remove");
    await call("DELETE", `/api/domains?domain=${encodeURIComponent(status.domain)}`);
    setBusy(""); setStatus(null); setLive([]); setInput(""); onChange?.("");
  }

  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => { setCopied(v); setTimeout(() => setCopied(""), 1500); }).catch(() => {}); };
  const shareText = status ? `Please connect my domain ${status.domain} to my Shubhora website. In the DNS settings (${status.provider.name}) add:\n${status.records.map((r) => `${r.type}  ${r.name}  →  ${r.value}`).join("\n")}\nDelete any other A record for @. Thanks!` : "";

  if (!status) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value.trim().toLowerCase())} placeholder="yourbusiness.com" inputMode="url"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" />
          <button type="button" onClick={connect} disabled={!input || !!busy} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Connect
          </button>
        </div>
        <p className="text-[11px] text-muted">Already own a domain? Type it here. We show the exact steps for your domain company, then finish everything else ourselves — including the free security certificate (https).</p>
        {err && <p className="text-xs text-danger">{err}</p>}
      </div>
    );
  }

  if (isLive) {
    return (
      <div className="rounded-xl border border-good/40 bg-good/5 p-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-good"><Check className="h-4 w-4" /> Your website is live</p>
        {live.map((h) => <a key={h} href={`https://${h}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-brand-ink font-medium">https://{h} <ExternalLink className="h-3.5 w-3.5" /></a>)}
        {status.records.slice(1).some((r) => !live.includes(r.host)) && <p className="text-[11px] text-muted">www.{status.domain} will join automatically once its record is added.</p>}
        <button type="button" onClick={remove} disabled={busy === "remove"} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /> Disconnect</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-brand" />
        <p className="flex-1 text-sm font-semibold">{status.domain}</p>
        <button type="button" onClick={remove} className="text-muted hover:text-danger" aria-label="Disconnect"><X className="h-4 w-4" /></button>
      </div>
      <div className="rounded-xl border border-border bg-surface2/50 p-3 space-y-2">
        <p className="text-xs font-semibold">Your domain is with <b>{status.provider.name}</b>. Do this once:</p>
        <ol className="list-decimal pl-5 space-y-1 text-xs text-muted">{status.provider.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        {status.provider.dnsUrl && (
          <a href={status.provider.dnsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold">
            Open {status.provider.name} DNS settings <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted border-b border-border"><th className="p-2 font-medium">Type</th><th className="p-2 font-medium">Name / Host</th><th className="p-2 font-medium">Value / Points to</th><th className="p-2 font-medium">Now</th></tr></thead>
          <tbody>
            {status.records.map((r) => (
              <tr key={r.host} className="border-b border-border last:border-0">
                <td className="p-2 font-semibold">{r.type}</td>
                <td className="p-2"><button type="button" onClick={() => copy(r.name)} className="inline-flex items-center gap-1 mono">{r.name} {copied === r.name ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3 text-faint" />}</button></td>
                <td className="p-2"><button type="button" onClick={() => copy(r.value)} className="inline-flex items-center gap-1 mono break-all">{r.value} {copied === r.value ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3 text-faint" />}</button></td>
                <td className="p-2">{r.ok ? <span className="text-good font-semibold">✓ Done</span> : r.current.length ? <span className="text-amber">Points to {r.current.join(", ")}</span> : <span className="text-muted">Waiting</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {busy === "verify"
          ? <span className="inline-flex items-center gap-1.5 text-brand-ink font-semibold"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> DNS is right — fitting the security certificate…</span>
          : <span className="inline-flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking automatically · next check in {next}s</span>}
        <button type="button" onClick={() => { setNext(20); refresh(status.domain).then((s) => { if (s?.ready) verify(s.domain); }); }} className="inline-flex items-center gap-1 font-semibold text-brand-ink"><RefreshCw className="h-3.5 w-3.5" /> Check now</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-ink"><MessageCircle className="h-3.5 w-3.5" /> Send these steps on WhatsApp</a>
      </div>
      {err && <p className="text-xs text-amber">{err}</p>}
      <p className="text-[11px] text-faint">Changes usually show within 5–30 minutes (sometimes a few hours). You can close this page: we keep checking and send you a notification when your website is live.</p>
    </div>
  );
}
