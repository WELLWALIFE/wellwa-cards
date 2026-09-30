"use client";
// Super Admin → Google Business: the platform OAuth client every user's
// "Connect Google Business" button uses. Saved in platform_secrets (server-only).
import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, Copy } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try { const sb = getBrowserSupabase(); const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } }; if (data.session?.access_token) h["x-owner-token"] = data.session.access_token; } catch { /* ignore */ }
  return h;
}
type St = { client_id: string; has_secret: boolean; env_fallback: boolean; redirect_uri: string; connected_users: { user_id: string; location_title: string; status: string; connected_at: string }[]; table_ok: boolean };

export default function GoogleAdmin() {
  const [st, setSt] = useState<St | null>(null);
  const [f, setF] = useState({ client_id: "", client_secret: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/admin/google", { headers: await adminHeaders(), cache: "no-store" }); if (r.ok) { const j = await r.json(); setSt(j); setF((x) => ({ ...x, client_id: j.client_id })); } }, []);
  useEffect(() => { load(); }, [load]);
  async function save() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/google", { method: "PUT", headers: await adminHeaders(), body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok ? "Saved — users can now click Connect Google Business." : j.error || "Failed."); setF((x) => ({ ...x, client_secret: "" })); load();
  }
  if (!st) return <div className="py-16 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Google Business Profile</h1><p className="text-muted mt-1">One Google Cloud OAuth client for the whole platform. Every user then connects their own Google Business in one click (Social → Google).</p></div>
      {!st.table_ok && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Table platform_secrets missing — run migration 0040 first.</p>}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
        <h2 className="font-semibold">OAuth client</h2>
        <div className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${st.client_id && st.has_secret ? "bg-good" : st.env_fallback ? "bg-lead" : "bg-faint"}`} />{st.client_id && st.has_secret ? "Configured" : st.env_fallback ? "Using .env.local values (GOOGLE_CLIENT_ID)" : "Not configured — Connect button is disabled for users"}</div>
        <label className="block text-sm"><span className="text-muted text-xs">Client ID</span><input value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })} placeholder="1234-abc.apps.googleusercontent.com" className="mt-1 w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 mono text-xs" /></label>
        <label className="block text-sm"><span className="text-muted text-xs">Client secret {st.has_secret && "(leave blank to keep)"}</span><input value={f.client_secret} onChange={(e) => setF({ ...f, client_secret: e.target.value })} type="password" placeholder="GOCSPX-…" className="mt-1 w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 mono text-xs" /></label>
        <div className="rounded-lg bg-surface2/60 p-2 text-xs"><span className="text-muted">Authorised redirect URI (paste in Google Cloud → Credentials):</span><div className="mt-1 flex items-center gap-2"><code className="flex-1 truncate">{st.redirect_uri}</code><button type="button" onClick={() => navigator.clipboard?.writeText(st.redirect_uri)} className="p-1 text-muted" aria-label="Copy"><Copy className="h-4 w-4" /></button></div></div>
        <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</button>
        {msg && <p className={`text-xs ${/Saved/.test(msg) ? "text-good" : "text-danger"}`}>{msg}</p>}
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-2 text-sm">
        <h2 className="font-semibold">Setup (one time, ~20 min + Google approval)</h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-muted">
          <li><b className="text-ink">console.cloud.google.com</b> → New project “Shubhora”.</li>
          <li>APIs &amp; Services → Library → enable: <b className="text-ink">My Business Account Management API</b>, <b className="text-ink">My Business Business Information API</b>, <b className="text-ink">Business Profile Performance API</b>, <b className="text-ink">Google My Business API</b> (v4, reviews/posts).</li>
          <li>OAuth consent screen → External → app name Shubhora, support email, logo, privacy policy <span className="mono text-xs">https://shubhora.com/privacy</span>. Scope: <span className="mono text-xs">…/auth/business.manage</span>. Add your Gmail as a test user (testing mode = up to 100 users; publish + verification later for everyone).</li>
          <li>Credentials → Create → OAuth client ID → Web application → Authorised redirect URI = the URL above → copy Client ID + secret here.</li>
          <li><b className="text-ink">Request Business Profile API access</b>: the APIs stay quota-0 until Google approves your project — fill the form at <span className="mono text-xs">developers.google.com/my-business/content/prereqs</span> (business name, website, why you need it: “Managing reviews and posts for our SMB customers”). Usually 1-2 weeks.</li>
          <li>Users: Social → Google → Connect. Reviews auto-reply and daily post then work.</li>
        </ol>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card text-sm">
        <h2 className="font-semibold mb-2">Connected users ({st.connected_users.length})</h2>
        {st.connected_users.length === 0 ? <p className="text-muted text-xs">None yet.</p> : st.connected_users.map((u) => <div key={u.user_id} className="flex items-center gap-2 border-t border-border py-1.5 text-xs"><span className="text-ink">{u.location_title || u.user_id.slice(0, 8)}</span><span className={u.status === "ok" ? "text-good" : "text-lead"}>{u.status}</span><span className="ml-auto text-faint">{new Date(u.connected_at).toLocaleDateString("en-IN")}</span></div>)}
      </section>
    </div>
  );
}
