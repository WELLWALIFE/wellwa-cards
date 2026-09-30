"use client";
// Super Admin → Staff (sub admins). Everyone who logs into Staff Admin (/partners/admin): their duty (role), status,
// two-step login, last login, how much work they did — and full control: add, change duty, disable, reset password,
// sign out everywhere, see every task they did and every login. Passwords are never readable (stored encrypted);
// a reset shows the new one once, to hand over. Owner's call, 24 Sep 2026.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCog, RefreshCw, LoaderCircle, KeyRound, Power, History, Copy, Check, X, ShieldCheck, ShieldOff, LogOut, Plus, AlertTriangle, Crown, ExternalLink,
} from "lucide-react";
import { PARTNER_URL } from "@/lib/site-url";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Staff = {
  id: number; username: string; name: string; role: string; active: boolean; twoStep: boolean; created: string;
  lastLogin: string | null; lastIp: string | null; failed7: number; actions: number; lastAction: string | null; online: boolean;
};
type Work = { at: string; action: string; label: string; member: string | null; reason: string | null; detail: Record<string, unknown> | null };
type Login = { at: string; ok: boolean; ip: string | null; device: string | null; note: string | null };

/** What each duty (role) may do in Staff Admin — the same rules the panel enforces (server/auth/session.ts PERMS). */
const DUTIES: { role: string; title: string; does: string[] }[] = [
  { role: "owner", title: "Owner", does: ["Everything below", "Plan settings, ranks, show / hide switches", "Staff logins"] },
  { role: "accounts", title: "Accounts", does: ["Activate IDs (free / paid / part / BV)", "Payments, refunds, manual payment requests", "Daily closing", "Withdrawals (approve / mark paid)", "Wallet changes and approvals", "Reports and GST"] },
  { role: "kyc", title: "KYC", does: ["Approve / reject KYC", "Bank details"] },
  { role: "support", title: "Support", does: ["Edit member details, tree moves", "Password requests, open member panel", "Support tickets", "News and downloads"] },
  { role: "ca", title: "CA", does: ["Reports, GST register, payments — view only"] },
  { role: "viewer", title: "Viewer", does: ["See everything, change nothing"] },
];
const ROLE_TITLE = Object.fromEntries(DUTIES.map((d) => [d.role, d.title]));
const ROLES = DUTIES.filter((d) => d.role !== "owner");
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}
async function call(op: string, body: Record<string, unknown> = {}) {
  const r = await fetch("/api/admin/staff", { method: "POST", headers: await headers(), body: JSON.stringify({ op, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
  return j;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(0);
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null);
  const [viewing, setViewing] = useState<Staff | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/admin/staff", { headers: await headers() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
      setStaff(j.staff ?? []);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(s: Staff, fn: () => Promise<unknown>, done: string) {
    setBusy(s.id); setErr(""); setMsg("");
    try { await fn(); setMsg(done); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy(0);
  }
  const loginUrl = `${PARTNER_URL}/admin/login`;
  const counts = useMemo(() => ({ total: staff.length, active: staff.filter((s) => s.active).length, online: staff.filter((s) => s.online).length, noTwo: staff.filter((s) => s.active && !s.twoStep).length }), [staff]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><UserCog className="h-6 w-6" /> Staff (sub admins)</h1>
          <p className="text-muted mt-1">Everyone who logs into Staff Admin — their duty, logins and work. Add, change, disable or reset any of them here.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="ed-icon" title="Refresh" aria-label="Refresh">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-3.5 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add sub admin</button>
        </div>
      </div>

      {err && <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {err}</div>}
      {msg && <div className="rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">{msg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Staff logins" value={counts.total} />
        <Tile label="Active" value={counts.active} />
        <Tile label="Logged in now" value={counts.online} />
        <Tile label="Active without two-step login" value={counts.noTwo} warn={counts.noTwo > 0} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">Staff log in at</span>
        <code className="rounded bg-surface2 px-2 py-1 text-xs">{loginUrl}</code>
        <CopyBtn text={loginUrl} />
        <a href={loginUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">Open <ExternalLink className="h-3 w-3" /></a>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="text-left text-faint mono text-xs uppercase tracking-wide border-b border-border">
                <th className="px-4 py-3">Sub admin</th><th className="px-4 py-3">Duty</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th><th className="px-4 py-3">Work done</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((s) => {
                const owner = s.role === "owner";
                return (
                  <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                    <td className="px-4 py-3">
                      <p className="font-medium flex items-center gap-1.5">{s.name}{owner && <Crown className="h-3.5 w-3.5 text-amber-600" />}{s.online && <span className="rounded bg-good/15 px-1.5 py-0.5 text-[10px] font-bold text-good">ONLINE</span>}</p>
                      <p className="text-xs text-muted mono">{s.username}</p>
                      <p className="text-[11px] text-faint">since {when(s.created)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {owner ? <span className="font-semibold">Owner</span> : (
                        <select value={s.role} disabled={busy === s.id}
                          onChange={(e) => { const role = e.target.value; if (confirm(`Change ${s.name}'s duty to ${ROLE_TITLE[role]}? They will be signed out and get the new duty at the next login.`)) void run(s, () => call("update", { id: s.id, role }), `${s.name} is now ${ROLE_TITLE[role]}.`); }}
                          className="ed-input py-1 text-xs">
                          {ROLES.map((r) => <option key={r.role} value={r.role}>{r.title}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs space-y-1">
                      <span className={`inline-flex rounded px-1.5 py-0.5 font-bold ${s.active ? "bg-good/15 text-good" : "bg-danger/10 text-danger"}`}>{s.active ? "Active" : "Disabled"}</span>
                      <p className={s.twoStep ? "text-good" : "text-amber-600"}>{s.twoStep ? "Two-step login on" : "No two-step login"}</p>
                      {s.failed7 > 0 && <p className="text-danger">{s.failed7} failed login{s.failed7 > 1 ? "s" : ""} (7 days)</p>}
                    </td>
                    <td className="px-4 py-3 text-xs"><p>{when(s.lastLogin)}</p>{s.lastIp && <p className="text-faint mono">{s.lastIp}</p>}</td>
                    <td className="px-4 py-3 text-xs">
                      <p><b className="text-sm">{s.actions}</b> task{s.actions === 1 ? "" : "s"}</p>
                      <p className="text-faint">last {when(s.lastAction)}</p>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <Btn onClick={() => setViewing(s)} icon={History} label="Work & logins" />
                      <Btn disabled={busy === s.id} onClick={() => { if (confirm(`Reset ${s.name}'s password? The old one stops working and they are signed out.`)) void (async () => { setBusy(s.id); setErr(""); try { const j = await call("reset", { id: s.id }); setSecret({ username: j.username, password: j.password }); } catch (e) { setErr((e as Error).message); } setBusy(0); })(); }} icon={KeyRound} label="Reset password" />
                      {s.twoStep && <Btn disabled={busy === s.id} onClick={() => { if (confirm(`Turn off two-step login for ${s.name}? (Use when they lost their phone.)`)) void run(s, () => call("reset2fa", { id: s.id }), "Two-step login turned off — ask them to set it again."); }} icon={ShieldOff} label="Reset 2-step" />}
                      {s.online && <Btn disabled={busy === s.id} onClick={() => void run(s, () => call("logout", { id: s.id }), `${s.name} signed out everywhere.`)} icon={LogOut} label="Sign out" />}
                      {!owner && <Btn danger={s.active} disabled={busy === s.id} onClick={() => { if (confirm(s.active ? `Disable ${s.name}? They are signed out and cannot log in.` : `Enable ${s.name} again?`)) void run(s, () => call("update", { id: s.id, active: !s.active }), s.active ? `${s.name} disabled.` : `${s.name} enabled.`); }} icon={Power} label={s.active ? "Disable" : "Enable"} />}
                    </td>
                  </tr>
                );
              })}
              {!loading && staff.length === 0 && !err && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No staff logins yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Duties — what each role can do</h2>
        <p className="text-xs text-muted mt-1">Every role can also <b>see</b> members, tree and closings. Every change a sub admin makes is saved with their name in the activity log (it cannot be edited or deleted).</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DUTIES.map((d) => (
            <div key={d.role} className="rounded-xl border border-border p-3">
              <p className="font-semibold">{d.title}<span className="ml-2 text-xs text-faint">{staff.filter((s) => s.role === d.role && s.active).length} active</span></p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted list-disc pl-4">{d.does.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {adding && <AddStaff onClose={() => setAdding(false)} onDone={(u, p) => { setAdding(false); setSecret({ username: u, password: p }); void load(); }} />}
      {secret && <SecretBox s={secret} loginUrl={loginUrl} onClose={() => setSecret(null)} />}
      {viewing && <Activity s={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Tile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return <div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${warn ? "text-amber-600" : ""}`}>{value}</p></div>;
}
function Btn({ onClick, icon: Icon, label, disabled, danger }: { onClick: () => void; icon: typeof History; label: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${danger ? "text-danger hover:bg-danger/10" : "hover:bg-surface2"}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs">{ok ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}{ok ? "Copied" : "Copy"}</button>;
}

function AddStaff({ onClose, onDone }: { onClose: () => void; onDone: (username: string, password: string) => void }) {
  const [name, setName] = useState(""); const [username, setUsername] = useState(""); const [role, setRole] = useState("accounts"); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const j = await call("create", { name, username, role, password: password || undefined }); onDone(j.username, j.password); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-float space-y-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Add sub admin</h2><button type="button" onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button></div>
        <label className="block"><span className="text-xs font-medium text-muted">Name</span><input className="ed-input mt-1" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi (accounts)" /></label>
        <label className="block"><span className="text-xs font-medium text-muted">Username (for login)</span><input className="ed-input mt-1 mono" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} placeholder="ravi.accounts" /></label>
        <label className="block"><span className="text-xs font-medium text-muted">Duty</span>
          <select className="ed-input mt-1" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r.role} value={r.role}>{r.title} — {r.does[0]}</option>)}</select>
        </label>
        <label className="block"><span className="text-xs font-medium text-muted">Password <span className="text-faint">(blank = a strong one is made for you)</span></span><input className="ed-input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="at least 10 characters" /></label>
        {err && <p className="text-xs text-danger">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create login"}</button>
      </form>
    </div>
  );
}

function SecretBox({ s, loginUrl, onClose }: { s: { username: string; password: string }; loginUrl: string; onClose: () => void }) {
  const text = `Shubhora Staff Admin\nLogin: ${loginUrl}\nUsername: ${s.username}\nPassword: ${s.password}\nPlease turn on two-step login after you sign in (My security).`;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-float space-y-3 text-sm">
        <h2 className="font-semibold">Login details — shown only once</h2>
        <p className="text-xs text-muted">Copy these now and send them to the staff member. The password is stored encrypted — nobody (not even you) can see it again; you can only reset it.</p>
        <div className="rounded-lg bg-surface2 p-3 space-y-1"><p>Username: <b className="mono">{s.username}</b></p><p>Password: <b className="mono select-all">{s.password}</b></p></div>
        <div className="flex gap-2">
          <CopyBtn text={text} />
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-[#25D366] px-2 py-1 text-xs font-semibold text-white">Send on WhatsApp</a>
        </div>
        <button onClick={onClose} className="w-full rounded-lg border border-border px-3 py-2">Done</button>
      </div>
    </div>
  );
}

function Activity({ s, onClose }: { s: Staff; onClose: () => void }) {
  const [tab, setTab] = useState<"work" | "logins">("work");
  const [data, setData] = useState<{ work: Work[]; logins: Login[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { call("activity", { id: s.id }).then(setData).catch((e) => setErr((e as Error).message)); }, [s.id]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto bg-surface p-5 shadow-float space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold">{s.name} <span className="text-xs text-muted mono">{s.username}</span></h2><p className="text-xs text-muted">{ROLE_TITLE[s.role] ?? s.role} · {s.actions} tasks</p></div>
          <button onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-2">
          {(["work", "logins"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tab === t ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>{t === "work" ? "Work done" : "Logins"}</button>)}
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        {!data && !err && <p className="text-sm text-muted inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading…</p>}
        {data && tab === "work" && (
          data.work.length === 0 ? <p className="text-sm text-muted">No tasks yet.</p> : (
            <div className="divide-y divide-border">
              {data.work.map((w, i) => (
                <div key={i} className="py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-3"><p className="font-medium">{w.label}{w.member && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-ink mono">{w.member}</span>}</p><span className="shrink-0 text-[11px] text-faint">{when(w.at)}</span></div>
                  {w.reason && <p className="text-xs text-muted">Reason: {w.reason}</p>}
                  {w.detail && <p className="text-[11px] text-faint mono break-all">{Object.entries(w.detail).filter(([, v]) => v !== null && v !== "").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}</p>}
                </div>
              ))}
            </div>
          ))}
        {data && tab === "logins" && (
          data.logins.length === 0 ? <p className="text-sm text-muted">No logins recorded.</p> : (
            <div className="divide-y divide-border">
              {data.logins.map((l, i) => (
                <div key={i} className="py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="w-40 shrink-0">{when(l.at)}</span>
                  <span className={l.ok ? "text-good font-semibold" : "text-danger font-semibold"}>{l.ok ? "Success" : `Failed${l.note ? ` (${l.note})` : ""}`}</span>
                  <span className="mono text-faint">{l.ip ?? ""}</span>
                  <span className="truncate text-faint max-w-xs">{l.device ?? ""}</span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
