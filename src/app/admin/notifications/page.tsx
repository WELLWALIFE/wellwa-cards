"use client";

// Super Admin → Notifications. One master switch, one switch per channel (browser push, WhatsApp) and one per
// notification type and channel. Every switch saves immediately.
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle2, LoaderCircle, Megaphone, MessageCircle, Send, TriangleAlert } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Settings = { enabled: boolean; push: boolean; whatsapp: boolean; types: Record<string, { push: boolean; whatsapp: boolean }> };
type Info = {
  settings: Settings; types: Record<string, { label: string; hint: string }>; tableReady: boolean; pushReady: boolean;
  whatsappSender: "company" | "own"; stats: { browsers: number; pushOk: number; waOk: number; failed: number };
};

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-brand" : "bg-border-strong"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function NotificationsAdmin() {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [test, setTest] = useState({ email: "", type: "announcement", busy: false, msg: "" });
  const [ann, setAnn] = useState({ title: "", body: "", busy: false, msg: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/notifications", { headers: await adminHeaders() });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || "Could not load."); return; }
    setInfo(j);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (s: Settings) => {
    setInfo((i) => (i ? { ...i, settings: s } : i));
    setSaved("Saving…");
    const r = await fetch("/api/admin/notifications", { method: "PUT", headers: await adminHeaders(), body: JSON.stringify(s) });
    const j = await r.json().catch(() => ({}));
    setSaved(r.ok ? "Saved" : j.error || "Could not save");
    if (r.ok) setTimeout(() => setSaved(""), 1500);
  };

  if (err) return <p className="text-sm text-danger">{err}</p>;
  if (!info) return <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</p>;
  const s = info.settings;
  const setType = (k: string, ch: "push" | "whatsapp", v: boolean) => save({ ...s, types: { ...s.types, [k]: { ...s.types[k], [ch]: v } } });

  const post = async (body: object) => {
    const r = await fetch("/api/admin/notifications", { method: "POST", headers: await adminHeaders(), body: JSON.stringify(body) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  };
  const describe = (res: Record<string, { ok: boolean; error?: string; skipped?: string }>) =>
    Object.entries(res ?? {}).map(([ch, v]) => `${ch === "push" ? "Browser" : "WhatsApp"}: ${v.ok ? (v.skipped ? v.skipped : "sent") : v.skipped || v.error || "not sent"}`).join(" · ") || "Nothing to send.";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted mt-1">Alerts to your users in the browser and on WhatsApp. Each switch saves at once.</p>
        </div>
        {saved && <span className="inline-flex items-center gap-1.5 text-sm text-good"><CheckCircle2 className="h-4 w-4" />{saved}</span>}
      </div>

      {(!info.tableReady || !info.pushReady) && (
        <div className="rounded-xl border border-amber/40 bg-amber-soft p-4 text-sm space-y-1">
          <p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" /> Setup needed</p>
          {!info.tableReady && <p>Run <code className="mono">supabase/migrations/0048_notifications.sql</code> once in Supabase → SQL editor. Until then switches cannot be saved.</p>}
          {!info.pushReady && <p>Browser notification keys are not set on the server yet.</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-3">
        {[["Browsers signed up", info.stats.browsers], ["Browser alerts (24h)", info.stats.pushOk], ["WhatsApp alerts (24h)", info.stats.waOk], ["Failed (24h)", info.stats.failed]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface divide-y divide-border">
        <div className="flex items-center gap-4 p-4">
          <Bell className="h-5 w-5 text-brand" />
          <div className="flex-1"><p className="font-semibold">All notifications</p><p className="text-xs text-muted">Master switch. Off stops every notification on every channel.</p></div>
          <Switch label="All notifications" on={s.enabled} onChange={(v) => save({ ...s, enabled: v })} />
        </div>
        <div className="flex items-center gap-4 p-4">
          <Bell className="h-5 w-5 text-muted" />
          <div className="flex-1"><p className="font-semibold">Browser notifications</p><p className="text-xs text-muted">Pop-up alerts on phones and computers where the user allowed them.</p></div>
          <Switch label="Browser notifications" on={s.push} disabled={!s.enabled} onChange={(v) => save({ ...s, push: v })} />
        </div>
        <div className="flex items-center gap-4 p-4">
          <MessageCircle className="h-5 w-5 text-muted" />
          <div className="flex-1">
            <p className="font-semibold">WhatsApp notifications</p>
            <p className="text-xs text-muted">{info.whatsappSender === "company"
              ? "Sent from the company WhatsApp number."
              : "Sent to the user's own WhatsApp (their 'message yourself' chat) when they have linked WhatsApp. To send from the company number, link it and ask the developer to set it as the sender."}</p>
          </div>
          <Switch label="WhatsApp notifications" on={s.whatsapp} disabled={!s.enabled} onChange={(v) => save({ ...s, whatsapp: v })} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted border-b border-border">
            <th className="p-3 font-medium">Notification</th><th className="p-3 font-medium w-24 text-center">Browser</th><th className="p-3 font-medium w-24 text-center">WhatsApp</th>
          </tr></thead>
          <tbody>
            {Object.entries(info.types).map(([k, t]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <td className="p-3"><p className="font-medium">{t.label}</p><p className="text-xs text-muted">{t.hint}</p></td>
                <td className="p-3"><div className="flex justify-center"><Switch label={`${t.label} browser`} on={!!s.types[k]?.push} disabled={!s.enabled || !s.push} onChange={(v) => setType(k, "push", v)} /></div></td>
                <td className="p-3"><div className="flex justify-center">{k === "announcement" ? <span className="text-xs text-faint">—</span>
                  : <Switch label={`${t.label} WhatsApp`} on={!!s.types[k]?.whatsapp} disabled={!s.enabled || !s.whatsapp} onChange={(v) => setType(k, "whatsapp", v)} />}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <form className="rounded-xl border border-border bg-surface p-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setTest((t) => ({ ...t, busy: true, msg: "" }));
          const { ok, j } = await post({ action: "test", email: test.email, type: test.type });
          setTest((t) => ({ ...t, busy: false, msg: ok ? describe(j.result) : j.error || "Could not send." }));
        }}>
          <p className="font-semibold flex items-center gap-2"><Send className="h-4 w-4 text-brand" /> Send a test</p>
          <input required type="email" placeholder="Shubhora login email" value={test.email} onChange={(e) => setTest({ ...test, email: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <select value={test.type} onChange={(e) => setTest({ ...test, type: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            {Object.entries(info.types).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
          <button disabled={test.busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {test.busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send test
          </button>
          {test.msg && <p className="text-xs text-muted">{test.msg}</p>}
        </form>

        <form className="rounded-xl border border-border bg-surface p-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); if (!confirm("Send this to every user who turned on browser notifications?")) return;
          setAnn((a) => ({ ...a, busy: true, msg: "" }));
          const { ok, j } = await post({ action: "announce", title: ann.title, body: ann.body });
          setAnn((a) => ({ ...a, busy: false, msg: ok ? `Sent to ${j.sent} of ${j.users} users.` : j.error || "Could not send." }));
        }}>
          <p className="font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4 text-brand" /> Announcement to everyone</p>
          <input required maxLength={80} placeholder="Title, e.g. New festival posters are ready" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <textarea required maxLength={240} rows={2} placeholder="Message" value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          <button disabled={ann.busy || !s.enabled || !s.push || !s.types.announcement?.push} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {ann.busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send to all
          </button>
          {ann.msg && <p className="text-xs text-muted">{ann.msg}</p>}
        </form>
      </div>
    </div>
  );
}
