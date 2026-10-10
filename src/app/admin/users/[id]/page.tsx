"use client";
// Super Admin → one user: complete profile (login identity, plan, cards, leads,
// poster profiles, payments, credits, connected services) + Login as / Edit.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, KeyRound, LoaderCircle, RefreshCw } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditProfile } from "@/components/admin/edit-profile";
import { displayLogin } from "@/lib/phone";

type Row = Record<string, unknown>;
type Data = {
  auth: { id: string; email: string; phone: string; providers: string[]; created_at?: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null; phone_confirmed_at?: string | null; banned_until?: string | null; is_demo?: boolean; contact_email?: string; name: string; avatar: string; identities: { provider: string; email?: string; phone?: string; last_sign_in_at?: string }[] };
  profile: Row; cards: Row[]; leads: Row[]; posterProfiles: Row[]; payments: Row[]; subscriptions: Row[]; credits: number; ledger: Row[]; devices: Row[];
  google: Row | null; cloud: Row | null; social: Row[]; agents: Row[]; jobs: Row[]; whatsapp: Row | null;
};

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try { const sb = getBrowserSupabase(); const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } }; if (data.session?.access_token) h["x-owner-token"] = data.session.access_token; } catch { /* ignore */ }
  return h;
}
const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const d = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const s = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-surface p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2>{right}</div>{children}</section>;
}
function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-xs text-muted pt-0.5">{k}</dt><dd className="break-all">{v}</dd></div>)}</dl>;
}
function Table({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="text-xs text-faint">None</p>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-faint">{cols.map((c) => <th key={c} className="py-1 pr-3 font-medium">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="py-1.5 pr-3 align-top">{c}</td>)}</tr>)}</tbody></table></div>;
}
const Pill = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-good/10 text-good" : "bg-surface2 text-muted"}`}>{children}</span>;

export default function AdminUserProfile() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [loginInfo, setLoginInfo] = useState<{ mode: string; link?: string; password?: string; phone?: string; email?: string; login_url?: string } | null>(null);
  const [edit, setEdit] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [plan, setPlan] = useState("free");
  const [mobile, setMobile] = useState("");
  const [months, setMonths] = useState(1);
  // "Edit profile" opens straight away when the Users list sent us here with ?edit=profile.
  const [editProfile, setEditProfile] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("edit") === "profile") setEditProfile(true); } catch { /* ignore */ } }, []);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/users/${id}`, { headers: await adminHeaders(), cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || `Error ${r.status}`); return; }
    setData(j); setEmail(j.auth.email); setPlan(String(j.profile?.plan ?? "free"));
    setMobile((String(j.auth.email ?? "").match(/^p91(\d{10})@phone\./)?.[1]) ?? "");
  }, [id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  async function loginAs() {
    setBusy("login");
    const r = await fetch("/api/admin/users", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ action: "login_as", id }) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { alert(j.error || "Failed"); return; }
    setLoginInfo(j);
  }
  const isMobileLogin = /@phone\./.test(data?.auth.email ?? "");
  const currentMobile = (data?.auth.email ?? "").match(/^p91(\d{10})@phone\./)?.[1] ?? "";
  async function save() {
    setBusy("save");
    // The login mobile goes first and on its own: it changes the sign-in address, so the rest is sent after it.
    const newMobile = mobile.replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
    if (newMobile && newMobile !== currentMobile) {
      const rm = await fetch("/api/admin/users", { method: "PATCH", headers: await adminHeaders(), body: JSON.stringify({ id, mobile: newMobile }) });
      const jm = await rm.json().catch(() => ({}));
      if (!rm.ok) { setBusy(""); alert(jm.error || "Could not change the mobile"); return; }
    }
    const body: Row = { id }; if (!isMobileLogin && email && email !== data?.auth.email) body.email = email; if (password) body.password = password; if (plan !== String(data?.profile?.plan ?? "free")) { body.plan = plan; body.months = months; }
    const r = Object.keys(body).length > 1 ? await fetch("/api/admin/users", { method: "PATCH", headers: await adminHeaders(), body: JSON.stringify(body) }) : null;
    const j = r ? await r.json().catch(() => ({})) : {}; setBusy("");
    if (r && !r.ok) { alert(j.error || "Failed"); return; }
    setPassword(""); setEdit(false); void load();
  }
  async function suspend(v: boolean) {
    if (!confirm(v ? "Suspend every card of this user?" : "Reinstate this user's cards?")) return;
    setBusy("susp");
    await fetch("/api/admin/users", { method: "PATCH", headers: await adminHeaders(), body: JSON.stringify({ id, suspend: v }) });
    setBusy(""); void load();
  }
  /** "Clear all data": cards, posters, products, connections, CRM — the login, username, partner ID, plan, credits
   *  and wallet stay. For a demo / test account that must start again from a fresh setup. */
  async function clearData() {
    const who = String(data?.profile?.username ?? "") || data?.auth.email || "";
    const typed = prompt(`Clear ALL data of ${who}?\n\nDeleted for ever: V-Cards, posters, products, reviews, Facebook / Google / WhatsApp connections, leads, videos.\nKept: login, username, name, mobile, partner ID + team, plan, credits, wallet.\n\nType ${who} to confirm:`);
    if (!typed) return;
    setBusy("clear");
    const r = await fetch("/api/admin/reset", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ id, confirm: typed }) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok && r.status !== 207) { alert(j.error || "Failed"); return; }
    const parts = Object.entries((j.cleared ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`);
    setNote(`${r.status === 207 ? "Partly cleared" : "All data cleared"} — ${parts.join(", ") || "nothing was there"}. Setup starts again at the next login.`);
    void load();
  }
  /** Demo account on / off: the app shows this login a "Reset demo" pill that wipes everything back to fresh. */
  async function toggleDemo() {
    const on = !data?.auth.is_demo;
    if (!confirm(on ? "Mark this account as the DEMO account?\n\nA red \"Reset demo\" button appears in the app for this login; one tap wipes its cards, products, connections and setup (the login, plan and partner ID stay)." : "Remove the demo mark? The Reset button disappears from the app.")) return;
    setBusy("demo");
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: await adminHeaders(), body: JSON.stringify({ id, demo: on }) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { alert(j.error || "Failed"); return; }
    setNote(on ? "Demo account: the Reset demo button is now in the app for this login." : "Demo mark removed.");
    void load();
  }
  /** One more V-Card year by hand (a ₹1,499 renewal paid in cash / offline) — from the later of today and the current end. */
  async function addCardYear() {
    if (!confirm("Add 1 year to this user's V-Card? (Use this when the ₹1,499 renewal was paid outside the app.)")) return;
    setBusy("card");
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: await adminHeaders(), body: JSON.stringify({ id, cardYears: 1 }) });
    const j = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) { alert(j.error || "Failed"); return; }
    setNote(`V-Card extended — now valid till ${d(j.cardUntil)}.`);
    void load();
  }
  async function giveCredits() {
    const raw = prompt("Credits to add (negative to deduct):", "500"); const amount = Math.trunc(Number(raw)); if (!amount) return;
    const r = await fetch("/api/admin/credits", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ userId: id, amount }) });
    if (!r.ok) alert("Failed"); void load();
  }

  if (err) return <div className="p-6"><Link href="/admin/users" className="text-sm text-muted">← Users</Link><p className="mt-4 text-danger">{err}</p></div>;
  if (!data) return <div className="grid h-64 place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const { auth, profile, cards, leads, posterProfiles, payments, subscriptions, credits, ledger, devices, google, cloud, social, agents, jobs, whatsapp } = data;
  const suspended = cards.length > 0 && cards.every((c) => c.active === false);
  const displayName = auth.name || String(profile.full_name ?? "") || String(posterProfiles[0]?.name ?? "") || (/@phone\./i.test(auth.email) ? displayLogin(auth.email) : auth.email) || (auth.phone ? `+${auth.phone}` : "User");
  const wa = whatsapp as { state?: string; me?: { id?: string; name?: string } } | null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Users</Link>
        <div className="flex-1" />
        <button onClick={() => void load()} className="rounded-lg border border-border p-2" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
        <button onClick={() => setEditProfile(true)} className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink">Edit profile</button>
        <button onClick={() => setEdit(true)} className="rounded-lg border border-border px-3 py-2 text-sm">Edit login / plan</button>
        <button onClick={() => suspend(!suspended)} disabled={busy === "susp" || !cards.length} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40">{suspended ? "Reinstate" : "Suspend"}</button>
        <button onClick={toggleDemo} disabled={busy === "demo"} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-40 ${data.auth.is_demo ? "border-danger/40 bg-danger/10 text-danger" : "border-border"}`} title="A demo account gets a Reset button in the app that wipes it back to fresh">{busy === "demo" ? "…" : data.auth.is_demo ? "🧹 Demo account: ON" : "Mark as demo"}</button>
        <button onClick={clearData} disabled={busy === "clear"} className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger disabled:opacity-40" title="Delete cards, posters, products and connections — keep the login, username, partner ID, plan and credits">{busy === "clear" ? "Clearing…" : "Clear all data"}</button>
        <button onClick={loginAs} disabled={busy === "login"} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><KeyRound className="h-4 w-4" />{busy === "login" ? "…" : "Login as this user"}</button>
      </div>

      {note && <p className="rounded-xl border border-good/40 bg-good/10 px-4 py-2.5 text-sm text-good">{note}</p>}
      {editProfile && <EditProfile id={id} headers={adminHeaders} onClose={() => setEditProfile(false)} onSaved={(m) => { setEditProfile(false); setNote(m); void load(); }} />}

      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        {auth.avatar || posterProfiles[0]?.photo_url ? <img src={auth.avatar || String(posterProfiles[0]?.photo_url)} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-xl font-bold text-brand-ink">{displayName.slice(0, 1).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{displayName}</h1>
          <p className="text-xs text-muted mono break-all">{auth.id}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Pill ok={!suspended}>{suspended ? "Suspended" : "Active"}</Pill>
            <Pill ok={String(profile.plan) !== "free"}>Card plan: {s(profile.plan)}{profile.plan_source ? ` (${s(profile.plan_source)})` : ""}</Pill>
            <Pill ok={String(profile.poster_plan ?? "free") !== "free"}>Poster plan: {s(profile.poster_plan ?? "free")}</Pill>
            <Pill ok={credits > 0}>{credits} credits</Pill>
            {auth.banned_until && <Pill ok={false}>Banned until {d(auth.banned_until)}</Pill>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Login details">
          <KV rows={[
            /@phone\./i.test(auth.email) ? ["Login", <>📱 {displayLogin(auth.email)} <Pill ok>mobile sign-up</Pill></>] : ["Email", auth.email ? <>{auth.email} {auth.email_confirmed_at ? <Pill ok>verified</Pill> : <Pill ok={false}>unverified</Pill>}</> : "—"],
            ...(/@phone\./i.test(auth.email) ? [["Contact email", auth.contact_email || <span key="ce" className="text-muted">— (set in “Edit profile”)</span>] as [string, React.ReactNode]] : []),
            ["Phone", auth.phone ? <>+{auth.phone} {auth.phone_confirmed_at ? <Pill ok>verified</Pill> : <Pill ok={false}>unverified</Pill>}</> : "—"],
            ["Sign-in method", auth.providers.join(", ") || "—"],
            ["Identities", auth.identities.length ? auth.identities.map((i, k) => <div key={k} className="text-xs">{i.provider}: {i.email || (i.phone ? `+${i.phone}` : "")} · last {dt(i.last_sign_in_at)}</div>) : "—"],
            ["Password", <span key="pw" className="text-xs text-muted">Never shown. Use “Login as” (magic link / temporary password) or “Edit login” to set a new one.</span>],
            ["Signed up", dt(auth.created_at)],
            ["Last sign-in", dt(auth.last_sign_in_at)],
            ["Referral code", s(profile.referral_code)],
            ["Brand", s(profile.brand_id)],
          ]} />
        </Card>
        <Card title="Plan & billing" right={<button onClick={giveCredits} className="text-xs font-semibold text-brand-ink">+ credits</button>}>
          <KV rows={[
            ["Card plan", `${s(profile.plan)} · source ${s(profile.plan_source)} · expires ${d(profile.plan_expires_at)}`],
            ["Trial started", d(profile.trial_started_at)],
            ["Poster plan", `${s(profile.poster_plan ?? "free")} · expires ${d(profile.poster_plan_expires_at)}`],
            ["V-Card year", <span key="cy">{profile.card_expires_at ? `till ${d(profile.card_expires_at)} (+7 days grace, then paused unless a paid plan covers it)` : "—"} <button onClick={addCardYear} disabled={busy === "card"} className="ml-1 text-xs font-semibold text-brand-ink disabled:opacity-40">{busy === "card" ? "…" : "+1 year"}</button></span>],
            ["Credits", `${credits}`],
          ]} />
          <h3 className="mt-3 mb-1 text-xs font-semibold text-muted">Poster payments</h3>
          <Table cols={["Date", "Plan", "Amount", "Payment id"]} rows={payments.map((p) => [d(p.created_at), s(p.plan), `₹${(Number(p.amount_paise) / 100).toFixed(0)}`, <span key="i" className="mono">{s(p.razorpay_payment_id)}</span>])} />
          <h3 className="mt-3 mb-1 text-xs font-semibold text-muted">Card subscriptions</h3>
          <Table cols={["Date", "Plan", "Status", "Amount", "Until", "Ref"]} rows={subscriptions.map((p) => [d(p.created_at), s(p.plan), s(p.status), p.amount ? `₹${(Number(p.amount) / 100).toFixed(0)}` : "—", d(p.current_end), <span key="r" className="mono">{s(p.provider_ref)}</span>])} />
          <h3 className="mt-3 mb-1 text-xs font-semibold text-muted">Credit ledger (last 20)</h3>
          <Table cols={["Date", "Δ", "Reason", "Ref"]} rows={ledger.map((l) => [dt(l.created_at), <span key="d" className={Number(l.delta) >= 0 ? "text-good" : "text-danger"}>{Number(l.delta) >= 0 ? "+" : ""}{s(l.delta)}</span>, s(l.reason), <span key="r" className="mono">{s(l.ref)}</span>])} />
        </Card>
      </div>

      <Card title={`Cards (${cards.length})`}>
        <Table cols={["Username", "Name", "Company", "Plan", "Views", "Leads", "Status", "Created", ""]} rows={cards.map((c) => [<span key="u" className="mono">/{s(c.username)}</span>, s(c.name), s(c.company), s(c.plan ?? "free"), s(c.views), String(c.leads), <Pill key="p" ok={c.active !== false}>{c.active === false ? "blocked" : "live"}</Pill>, d(c.created_at), <a key="a" href={`/${c.username}`} target="_blank" rel="noreferrer" className="text-brand-ink"><ExternalLink className="h-3.5 w-3.5" /></a>])} />
        {leads.length > 0 && <><h3 className="mt-3 mb-1 text-xs font-semibold text-muted">Latest leads</h3><Table cols={["Date", "Name", "Phone", "Source", "Status"]} rows={leads.map((l) => [dt(l.created_at), s(l.name), s(l.phone), s(l.source), s(l.status)])} /></>}
      </Card>

      <Card title={`Poster profiles (${posterProfiles.length})`}>
        <Table cols={["Name", "Firm / tagline", "Persona", "Category", "Style", "Lang", "City", "Phone", "Logo", "Posters", "Default"]} rows={posterProfiles.map((p) => [s(p.name), s(p.tagline), s(p.persona), s(p.category), s(p.style), s(p.lang), s(p.city), s(p.phone), p.logo_url ? "✓" : "—", s(p.posters), p.is_default ? "✓" : ""])} />
        <p className="mt-2 text-xs text-muted">App devices: {devices.length ? devices.map((v, i) => <span key={i}>{s(v.platform)} ({s(v.lang)}, seen {d(v.last_seen)}){i < devices.length - 1 ? ", " : ""}</span>) : "none"}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Connected services">
          <KV rows={[
            ["WhatsApp (QR)", wa ? <>{<Pill ok={wa.state === "connected"}>{s(wa.state)}</Pill>} {wa.me?.name ? ` ${wa.me.name}` : ""} {wa.me?.id ? <span className="text-xs text-muted">+{String(wa.me.id).split(":")[0].split("@")[0]}</span> : null}</> : <span className="text-xs text-muted">not started (plan free/expired or bridge idle)</span>],
            ["WhatsApp Cloud API", cloud ? <>{<Pill ok>connected</Pill>} {s(cloud.verified_name)} {s(cloud.display_phone)} · quality {s(cloud.quality_rating)} · limit {s(cloud.messaging_limit)}</> : "—"],
            ["Google Business", google ? <>{<Pill ok={google.status === "ok"}>{s(google.status)}</Pill>} {s(google.location_title)} · auto-post {google.auto_post ? "on" : "off"} · auto-reply {google.auto_reply ? "on" : "off"}</> : "—"],
            ["Facebook / Instagram", social.length ? social.map((a, i) => <div key={i} className="text-xs">{s(a.provider)}: {s(a.name)} {a.username ? `@${a.username}` : ""} · token till {d(a.token_expires_at)}</div>) : "—"],
            ["CRM team", agents.length ? agents.map((a, i) => <div key={i} className="text-xs">{s(a.name)} ({s(a.role)}) {s(a.phone)} · {a.agent_user_id ? "joined" : "pending"}{a.active === false ? " · inactive" : ""}</div>) : "—"],
          ]} />
        </Card>
        <Card title="AI Studio jobs (last 10)">
          <Table cols={["Date", "Kind", "Status", "Cost"]} rows={jobs.map((j) => [dt(j.created_at), s(j.kind), s(j.status), s(j.cost)])} />
        </Card>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setEdit(false)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Edit login / plan</h3>
            <label className="block"><span className="mb-1 block text-xs text-muted">Login mobile (10 digits){isMobileLogin ? " — this is the sign-in" : " — shown in the app; the email stays the sign-in"}</span><input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="numeric" placeholder="98765 43210" className="w-full rounded-lg border border-border bg-surface px-3 py-2" /></label>
            {mobile.replace(/\D/g, "").slice(-10) !== currentMobile && mobile.trim() && <p className="text-xs text-lead">The user will sign in with +91 {mobile.replace(/\D/g, "").slice(-10)} from now on; the Call / WhatsApp buttons on their cards and the poster number change too. Tell them.</p>}
            {!isMobileLogin && <label className="block"><span className="mb-1 block text-xs text-muted">Email (sign-in)</span><input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2" /></label>}
            <label className="block"><span className="mb-1 block text-xs text-muted">New password (leave blank to keep)</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2" autoComplete="new-password" /></label>
            <div className="flex gap-2">
              <label className="block flex-1"><span className="mb-1 block text-xs text-muted">Plan</span><select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2"><option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option></select></label>
              <label className="block w-28"><span className="mb-1 block text-xs text-muted">For months</span><input type="number" min={1} max={24} value={months} disabled={plan === "free"} onChange={(e) => setMonths(Number(e.target.value))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 disabled:opacity-40" /></label>
            </div>
            <p className="text-xs text-muted">Unlocks AI Studio, Studio, WhatsApp and Analytics for this user straight away, counted from today. &ldquo;Free&rdquo; takes it all back.</p>
            <div className="flex gap-2"><button onClick={() => setEdit(false)} className="flex-1 rounded-lg border border-border px-3 py-2">Cancel</button><button onClick={save} disabled={busy === "save"} className="flex-1 rounded-lg bg-brand px-3 py-2 font-semibold text-white disabled:opacity-60">Save</button></div>
          </div>
        </div>
      )}
      {loginInfo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setLoginInfo(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-surface p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Login as {displayName}</h3>
            {loginInfo.mode === "link" ? (<>
              <p className="text-xs text-muted">Magic link for <b>{loginInfo.email}</b>. Open it in a <b>private / incognito window</b> so this admin session stays signed in. Single use, short-lived.</p>
              <a href={loginInfo.link} target="_blank" rel="noreferrer" className="block w-full rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white">Open login link ↗</a>
              <button onClick={() => navigator.clipboard?.writeText(loginInfo.link ?? "")} className="w-full rounded-lg border border-border px-3 py-2">Copy link</button>
            </>) : (<>
              <p className="text-xs text-muted">Phone account — a temporary password was set. Log in at <code>{loginInfo.login_url}</code> in a private window:</p>
              <div className="rounded-lg bg-surface2 p-3"><div>Phone: <b>+{loginInfo.phone}</b></div><div>Password: <b className="mono">{loginInfo.password}</b></div></div>
              <button onClick={() => navigator.clipboard?.writeText(loginInfo.password ?? "")} className="w-full rounded-lg border border-border px-3 py-2">Copy password</button>
            </>)}
            <button onClick={() => setLoginInfo(null)} className="w-full rounded-lg border border-border px-3 py-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
