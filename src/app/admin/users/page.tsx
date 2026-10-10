"use client";
import { PARTNER_URL } from "@/lib/site-url";

// Super Admin → Users. EVERY account: app accounts from Supabase Auth, each joined to its partner ID, plus the partner
// IDs that have no app account, newest first (owner's calls, 24 and 27 Sep 2026: "show every user, even the root ID",
// "newest on top"). Edit / delete / plan / credits work on app accounts; partner-only IDs open in Staff Admin.
// Passwords are never stored or displayed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban, CircleCheck, Search, KeyRound, Trash2,
  Pencil, X, LoaderCircle, RefreshCw, CreditCard, ExternalLink, Coins, History, Crown, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { displayLogin } from "@/lib/phone";

/** Mobile sign-ups log in with an internal address (p91…@phone.…) — show their mobile number instead, never that address. */
const mobileLogin = (email?: string) => /@phone\./i.test(email ?? "");
const loginOf = (email?: string) => (mobileLogin(email) ? `📱 ${displayLogin(email ?? "")}` : email ?? "");
const who = (u: { name: string; email: string }) => (u.name ? `${u.name} (${loginOf(u.email)})` : loginOf(u.email));

const planStyle: Record<string, string> = {
  free: "bg-surface2 text-muted",
  pro: "bg-brand-soft text-brand-ink",
  team: "bg-ai-soft text-ai",
};

type Partner = {
  code: string; username: string | null; status: "red" | "green"; blocked: boolean; leg: "L" | "R" | null; isRoot: boolean;
  sponsor: string | null; parent: string | null; directs: number; subValidUntil: string | null;
};

type User = {
  id: string;
  /** "account" = an app login (Supabase); "partner" = a partner ID with no app login (the root, Staff-Admin-made IDs). */
  kind?: "account" | "partner";
  username?: string | null;
  partner?: Partner | null;
  email: string;
  /** A mobile sign-up's real email (user_metadata.contact_email); its login email is a placeholder. */
  contactEmail?: string;
  phone?: string;
  /** Every mobile the account is known by, 10 digits each (login, metadata, poster profiles, partner ID). */
  phones?: string[];
  provider?: string;
  posterProfiles?: string[];
  posterPlan?: string;
  name: string;
  associate?: string;
  joined: string;
  lastSeen?: string;
  cards: number;
  usernames?: string[];
  plan: string;
  subscription?: { plan: string; status: string; renews: string; amount: number | null } | null;
  status: string;
  credits?: number;
};

/** Auth for the admin APIs: the unlock password and/or the owner's session
 *  token (the panel can be opened either way). */
async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

type View = "all" | "accounts" | "ids" | "partner" | "green" | "red" | "paid" | "check";
const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All" }, { id: "accounts", label: "App accounts" }, { id: "ids", label: "Partner IDs" }, { id: "partner", label: "Partner-only IDs" },
  { id: "green", label: "Green IDs" }, { id: "red", label: "Red IDs" }, { id: "paid", label: "Paid plan" },
  { id: "check", label: "Check: same name / email / mobile" },
];
/** The account says one ID but is tied to another (or to none) — the old email-matching link left it mixed. */
const mixed = (u: User) => u.kind !== "partner" && (u.associate || "") !== (u.partner?.code || "");
const norm = (v?: string | null) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const digits = (v?: string | null) => String(v ?? "").replace(/\D/g, "").slice(-10);
/** Monthly price per plan for the MRR estimate when no subscription amount is on record (Growth ₹2,999). */
const PLAN_MRR: Record<string, number> = { pro: 2999, team: 4999 };
const isAccount = (u: User) => u.kind !== "partner";

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [partnerNote, setPartnerNote] = useState("");
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [viewingCredits, setViewingCredits] = useState<User | null>(null);

  // Real data only: an error is shown as an error, never replaced by sample users.
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/admin/users", { headers: await adminHeaders() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.configured && Array.isArray(d.users)) {
        setUsers(d.users);
        setLive(true);
        setPartnerNote(d.partnerLinked === false ? `Partner IDs could not be loaded (${d.partnerError ?? "partner panel not reachable"}) — app accounts only.` : "");
      } else {
        setLive(false);
        setErr(r.status === 401 ? "Not authorised — unlock the panel again." : d.configured === false ? "SUPABASE_SERVICE_ROLE_KEY is missing on the server." : d.error ?? `Could not load users (${r.status}).`);
      }
    } catch {
      setLive(false);
      setErr("No internet or the server did not answer — press Refresh.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(u: User) {
    if (!confirm(`Permanently delete "${who(u)}"?\n\nTheir cards and leads will be removed too.`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: await adminHeaders(),
      body: JSON.stringify({ id: u.id }),
    });
    load();
  }

  async function giveCredits(u: User) {
    const raw = prompt(`"${who(u)}" ko kitne credits dene hain?\n(negative likhkar wapas bhi le sakte hain)`, "500");
    if (!raw) return;
    const amount = Math.trunc(Number(raw));
    if (!amount) return;
    const r = await fetch("/api/admin/credits", {
      method: "POST",
      headers: await adminHeaders(),
      body: JSON.stringify({ userId: u.id, amount }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, credits: d.balance } : x)));
    alert(r.ok ? `Ho gaya — naya balance: ${d.balance} credits` : `Failed: ${d.error ?? r.status}`);
  }

  const [busyLogin, setBusyLogin] = useState("");
  const [loginInfo, setLoginInfo] = useState<{ user: User; mode: string; link?: string; password?: string; phone?: string; email?: string; login_url?: string } | null>(null);
  async function loginAs(u: User) {
    setBusyLogin(u.id);
    const r = await fetch("/api/admin/users", { method: "POST", headers: await adminHeaders(), body: JSON.stringify({ action: "login_as", id: u.id }) });
    const j = await r.json().catch(() => ({}));
    setBusyLogin("");
    if (!r.ok) { alert(j.error || "Failed"); return; }
    setLoginInfo({ user: u, ...j });
  }
  async function setPlan(u: User, plan: string) {
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, plan } : x)));
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: await adminHeaders(),
      body: JSON.stringify({ id: u.id, plan }),
    });
  }

  async function toggleSuspend(u: User) {
    const suspend = u.status !== "suspended";
    if (!confirm(suspend
      ? `Block "${who(u)}"?\n\nUnki card(s) turant band ho jayengi — public page, WhatsApp bot aur naye leads sab ruk jayenge.`
      : `Unblock "${who(u)}"? Unki card(s) wapas live ho jayengi.`)) return;
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, status: suspend ? "suspended" : "active" } : x)));
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: await adminHeaders(),
      body: JSON.stringify({ id: u.id, suspend }),
    });
  }

  // Rows that share a name, email or mobile with another row — the place to spot one person with two IDs.
  const twins = useMemo(() => {
    const count = new Map<string, number>();
    const keys = (u: User) => [norm(u.name) && `n:${norm(u.name)}`, norm(u.email) && `e:${norm(u.email)}`, norm(u.contactEmail ?? "") && `e:${norm(u.contactEmail ?? "")}`, digits(u.phone).length === 10 && `m:${digits(u.phone)}`, ...(u.phones ?? []).map((d) => `m:${d}`)].filter(Boolean) as string[];
    for (const u of users) for (const k of keys(u)) count.set(k, (count.get(k) ?? 0) + 1);
    return new Set(users.filter((u) => keys(u).some((k) => (count.get(k) ?? 0) > 1)).map((u) => u.id));
  }, [users]);

  const [linkNote, setLinkNote] = useState("");
  async function links(body: Record<string, unknown>, done: (d: Record<string, unknown>) => string) {
    setLinkNote("Working…");
    const r = await fetch("/api/admin/users/links", { method: "POST", headers: await adminHeaders(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setLinkNote(r.ok ? done(d) : `Not done: ${d.error ?? r.status}`);
    if (r.ok) load();
  }
  const repairLinks = () => links({ op: "repair" }, (d) => {
    const c = (d.changes as { email: string; from: string; to: string }[]) ?? [];
    return c.length ? `Fixed ${c.length}: ${c.map((x) => `${x.email} ${x.from || "none"} → ${x.to || "none"}`).join(" · ")}` : "All links were already correct.";
  });
  function unlinkId(u: User) {
    const code = u.partner?.code; if (!code) return;
    if (!confirm(`Unlink ${code} from the app account ${who(u)}?\n\nThe ID stays as it is (team, wallet, income). Only the app login is detached — link it again to the right account afterwards.`)) return;
    void links({ op: "unlink", code }, () => `${code} unlinked from ${who(u)}.`);
  }
  function linkId(u: User) {
    if (isAccount(u)) {
      const code = prompt(`Link which partner ID to ${who(u)}? (e.g. SH100053)`, u.associate || "")?.trim().toUpperCase();
      if (code) void links({ op: "link", code, account: u.id }, () => `${code} linked to ${who(u)}.`);
    } else {
      const code = u.partner?.code; if (!code) return;
      const account = prompt(`Link ${code} to which app account? Enter its login email.`, u.email || "")?.trim();
      if (account) void links({ op: "link", code, account }, () => `${code} linked to ${account}.`);
    }
  }

  const listTop = useRef<HTMLDivElement>(null);
  /** A summary card was clicked: its list, and the page scrolls down to it. */
  function pick(v: View) {
    setView(v); setQ("");
    requestAnimationFrame(() => listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const inView = users.filter((u) =>
      view === "all" ? true
        : view === "accounts" ? isAccount(u)
        : view === "ids" ? !!u.partner
        : view === "partner" ? !isAccount(u)
        : view === "green" ? u.partner?.status === "green"
        : view === "red" ? u.partner?.status === "red"
        : view === "check" ? twins.has(u.id) || mixed(u)
        : u.plan !== "free");
    if (!s) return inView;
    // A number typed in any form (+91 87082 75430, 8708275430, 75430) matches every mobile the account is known by.
    const sd = s.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    return inView.filter((u) =>
      [u.name, u.email, u.contactEmail, loginOf(u.email), u.phone, u.username, u.associate, u.plan, u.status, u.partner?.code, u.partner?.username, u.partner?.sponsor, u.partner?.isRoot ? "root" : ""]
        .some((v) => String(v ?? "").toLowerCase().includes(s)) ||
      (u.usernames ?? []).some((n) => n.toLowerCase().includes(s)) ||
      (sd.length >= 4 && (u.phones ?? []).some((d) => d.includes(sd))),
    );
  }, [users, q, view, twins]);

  const accounts = users.filter(isAccount);
  const partnerIds = users.filter((u) => u.partner);
  const revenue = accounts
    .filter((u) => u.plan === "pro" || u.plan === "team")
    .reduce((sum, u) => sum + (u.subscription?.amount ?? PLAN_MRR[u.plan] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted mt-1">
            Every app account with its partner ID, plus partner IDs without an app login — newest first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={repairLinks} disabled={!live} title="Make every app account show the partner ID it is really tied to"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-surface2 disabled:opacity-40">
            Fix ID links{users.some(mixed) ? ` (${users.filter(mixed).length})` : ""}
          </button>
          <button onClick={load} className="ed-icon" title="Refresh" aria-label="Refresh">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 w-full sm:w-72 focus-within:ring-1 focus-within:ring-brand">
            <Search className="h-4 w-4 text-faint shrink-0" />
            <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search name, username, SH code, mobile (any form), email…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{err}</span>
        </div>
      )}
      {linkNote && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
          <span>{linkNote}</span><button onClick={() => setLinkNote("")} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
      )}
      {partnerNote && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" /> <span>{partnerNote}</span>
        </div>
      )}

      {/* Summary — each card opens its own list (owner's call, 28 Sep 2026); "N green" opens the green IDs. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Everyone listed" value={users.length} on={view === "all"} onClick={() => pick("all")} />
        <Stat label="App accounts" value={accounts.length} on={view === "accounts"} onClick={() => pick("accounts")} />
        <Stat label="Partner IDs" value={partnerIds.length} on={view === "ids" || view === "green"} onClick={() => pick("ids")}
          extra={<button type="button" onClick={(e) => { e.stopPropagation(); pick("green"); }}
            className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${view === "green" ? "bg-good text-white" : "bg-good/10 text-good hover:bg-good/20"}`}>
            {partnerIds.filter((u) => u.partner?.status === "green").length} green</button>} />
        <Stat label="Paid plan" value={accounts.filter((u) => u.plan !== "free").length} on={view === "paid"} onClick={() => pick("paid")} />
        <Stat label="MRR (est.)" value={`₹${revenue.toLocaleString("en-IN")}`} accent on={false} onClick={() => pick("paid")} hint="Paid accounts" />
      </div>

      <div ref={listTop} className="flex flex-wrap gap-2 scroll-mt-20">
        {VIEWS.map((v) => {
          const on = view === v.id;
          return (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${on ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted hover:text-ink"}`}>
              {v.label}
            </button>
          );
        })}
        <span className="self-center text-xs text-faint ml-1">{shown.length} shown</span>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1040px]">
            <thead>
              <tr className="text-left text-faint mono text-xs uppercase tracking-wide border-b border-border">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Partner ID</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Subscription</th>
                <th className="px-4 py-3 font-semibold">Cards</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((u) => {
                const acct = isAccount(u);
                const p = u.partner;
                return (
                <tr key={u.id} className={`hover:bg-surface2/50 ${p?.isRoot ? "bg-amber-500/5" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {acct
                        ? <Link href={`/admin/users/${u.id}`} className="font-medium text-brand-ink hover:underline">{u.name}</Link>
                        : <span className="font-medium">{u.name}</span>}
                      {p?.isRoot && <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"><Crown className="h-3 w-3" /> ROOT ID</span>}
                      {!acct && <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">no app login</span>}
                    </div>
                    {u.username && <p className="text-xs font-semibold text-ink mono">@{u.username}</p>}
                    <p className="text-xs text-muted mono">{mobileLogin(u.email) ? <>{loginOf(u.email)}{u.contactEmail ? ` · ${u.contactEmail}` : ""}</> : <>{u.email || "—"}{u.phone ? ` · +${u.phone.replace(/^\+/, "")}` : ""}</>}</p>
                    <p className="text-[11px] text-faint">{mobileLogin(u.email) ? "signed up with mobile" : u.provider ? `via ${u.provider}` : ""}{u.posterProfiles?.length ? ` · profiles: ${u.posterProfiles.join(", ")}` : ""}{u.posterPlan && u.posterPlan !== "free" ? ` · poster ${u.posterPlan}` : ""}</p>
                    {acct ? (
                      <>
                        <button onClick={() => loginAs(u)} disabled={!live || busyLogin === u.id} className="mt-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-40">{busyLogin === u.id ? "…" : "Login as"}</button>
                        <Link href={`/admin/users/${u.id}`} className="ml-1 inline-flex rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold hover:bg-surface2">Profile</Link>
                    <Link href={`/admin/users/${u.id}?edit=profile`} className="ml-1 inline-flex rounded-md border border-brand/40 bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">Edit</Link>
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {p ? (
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <a href={`${PARTNER_URL}/admin/members/${p.code}`} target="_blank" rel="noreferrer" className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-ink mono hover:underline">{p.code}</a>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${p.status === "green" ? "bg-good/15 text-good" : "bg-danger/10 text-danger"}`}>{p.status}</span>
                          {p.blocked && <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">blocked</span>}
                        </div>
                        <p className="text-muted">{p.isRoot ? "Top of the tree" : <>Sponsor <b className="text-ink">{p.sponsor ?? "—"}</b>{p.leg ? <> · {p.leg === "L" ? "Left" : "Right"} of {p.parent ?? "—"}</> : null}</>}</p>
                        <p className="text-faint">{p.directs} direct{p.directs === 1 ? "" : "s"}{p.subValidUntil ? ` · valid till ${p.subValidUntil}` : ""}</p>
                        {mixed(u) && <p className="font-semibold text-amber-700">⚠ app shows {u.associate || "no ID"} — press Fix ID links</p>}
                        {twins.has(u.id) && <p className="font-semibold text-amber-700">Same name / email / mobile as another row</p>}
                        {!p.isRoot && (acct
                          ? <button onClick={() => unlinkId(u)} disabled={!live} className="mt-0.5 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold hover:bg-surface2 disabled:opacity-40">Unlink ID</button>
                          : <button onClick={() => linkId(u)} disabled={!live} className="mt-0.5 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold hover:bg-surface2 disabled:opacity-40">Link app account</button>)}
                      </div>
                    ) : (
                      <div className="text-xs text-faint space-y-0.5">
                        <span>{u.associate ? <><span className="mono">{u.associate}</span> <b className="text-amber-700">⚠ not tied — press Fix ID links</b></> : "not registered"}</span>
                        {acct && <div><button onClick={() => linkId(u)} disabled={!live} className="rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold hover:bg-surface2 disabled:opacity-40">Link ID</button></div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan}
                      onChange={(e) => setPlan(u, e.target.value)}
                      disabled={!live || !acct}
                      className={`mono text-[11px] font-semibold uppercase px-1.5 py-1 rounded border-0 outline-none appearance-none ${live ? "cursor-pointer" : ""} ${planStyle[u.plan] ?? planStyle.free}`}
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="team">team</option>
                    </select>
                    <div className="mt-1 flex items-center gap-1.5">
                      <button onClick={() => giveCredits(u)} disabled={!live || !acct}
                        className="text-[11px] font-semibold text-amber-600 hover:underline disabled:opacity-40">
                        + credits
                      </button>
                      <button onClick={() => setViewingCredits(u)} disabled={!live || !acct}
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted hover:text-ink disabled:opacity-40" title="Balance & history">
                        <Coins className="h-3 w-3 text-amber-500" /> {u.credits ?? 0}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.plan === "free" ? (
                      <span className="text-xs text-faint">—</span>
                    ) : (
                      <div className="text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-good">
                          <CreditCard className="h-3.5 w-3.5" />
                          ₹{(u.subscription?.amount ?? PLAN_MRR[u.plan] ?? 0).toLocaleString("en-IN")}/mo
                        </span>
                        <p className="text-faint mt-0.5">
                          {u.subscription?.renews ? `renews ${u.subscription.renews}` : "manual (admin set)"}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="tabular-nums">{u.cards}</span>
                    {u.usernames?.length ? (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {u.usernames.slice(0, 2).map((n) => (
                          <Link key={n} href={`/c/${n}`} target="_blank"
                            className="inline-flex items-center gap-0.5 text-[10px] mono text-muted hover:text-ink">
                            /{n} <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted mono text-xs">{u.joined}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSuspend(u)} disabled={!live || !acct}
                      title={u.status === "active" ? "Click to block this user's cards" : "Click to unblock"}
                      className={`inline-flex items-center gap-1 text-xs font-medium disabled:opacity-40 ${u.status === "active" ? "text-good hover:text-danger" : "text-danger hover:text-good"}`}>
                      {u.status === "active" ? <CircleCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      {u.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {acct ? (
                      <>
                        <Link href={`/admin/users/${u.id}?edit=profile`}
                          className="ed-icon inline-grid" title="Edit profile (name, username, mobile, business…)" aria-label="Edit profile">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button onClick={() => setEditing(u)} disabled={!live}
                          className="ed-icon disabled:opacity-40 ml-1" title="Login / plan (email, password, plan)" aria-label="Edit login and plan">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(u)} disabled={!live || !!p?.isRoot}
                          className="ed-icon hover:text-danger disabled:opacity-40 ml-1" title={p?.isRoot ? "The root ID's account cannot be deleted here" : "Delete"} aria-label="Delete user">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : p ? (
                      <a href={`${PARTNER_URL}/admin/members/${p.code}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-surface2">
                        Open in Staff Admin <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </td>
                </tr>
                );
              })}
              {shown.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">{q ? <>No users match &ldquo;{q}&rdquo;.</> : err ? "Nothing to show." : "No users in this view."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {editing && (
        <EditUser
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {viewingCredits && (
        <CreditsHistory user={viewingCredits} onClose={() => setViewingCredits(null)} />
      )}

      <PasswordSecurityNotice />
      {loginInfo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setLoginInfo(null)}>
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Login as {loginInfo.user.name}</h3>
            {loginInfo.mode === "link" ? (
              <>
                <p className="text-muted text-xs">Opens <b>{loginInfo.user.name}</b>&apos;s app, already logged in as <b>{loginOf(loginInfo.email)}</b>. This browser switches to their account — a <b>“← Back to admin”</b> bar at the bottom brings you back to your own account in one tap. The link works once, for a short time.</p>
                <div className="flex items-center gap-2 rounded-lg bg-surface2 p-2 text-xs"><code className="flex-1 truncate">{loginInfo.link}</code><button onClick={() => navigator.clipboard?.writeText(loginInfo.link ?? "")} className="rounded border border-border px-2 py-1">Copy</button></div>
                <a href={loginInfo.link} className="block w-full rounded-lg bg-brand px-3 py-2 text-center font-semibold text-white">Log in as {loginInfo.user.name} →</a>
                <p className="text-[11px] text-faint">Want to stay here as well? Copy the link and open it in a private / incognito window instead.</p>
              </>
            ) : (
              <>
                <p className="text-muted text-xs">This account signs in with a <b>phone number</b>, so a temporary password was set. Log in at <code>{loginInfo.login_url}</code> (private window) with:</p>
                <div className="rounded-lg bg-surface2 p-3 text-sm"><div>Phone: <b>+{loginInfo.phone}</b></div><div>Password: <b className="mono">{loginInfo.password}</b> <button onClick={() => navigator.clipboard?.writeText(loginInfo.password ?? "")} className="ml-2 rounded border border-border px-2 py-0.5 text-xs">Copy</button></div></div>
                <p className="text-[11px] text-lead">Tell the user their password changed, or change it back from the Edit action.</p>
              </>
            )}
            <button onClick={() => setLoginInfo(null)} className="w-full rounded-lg border border-border px-3 py-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, on, onClick, extra, hint }: {
  label: string; value: string | number; accent?: boolean; on: boolean; onClick: () => void; extra?: React.ReactNode; hint?: string;
}) {
  // A div, not a button: the Partner IDs card holds its own "N green" button inside.
  return (
    <div role="button" tabIndex={0} onClick={onClick} title={hint ? `Show: ${hint}` : `Show: ${label}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`group cursor-pointer rounded-xl border bg-surface p-4 text-left transition-colors hover:border-brand/50 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        on ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30" : "border-border"}`}>
      <p className="flex items-center justify-between text-xs text-muted">{label}<span className="text-faint opacity-0 transition-opacity group-hover:opacity-100">→</span></p>
      <p className={`mt-1 flex items-center text-xl font-semibold tabular-nums ${accent ? "text-brand-ink" : ""}`}>{value}{extra}</p>
    </div>
  );
}

/* ---------------- edit user (email / password / plan) ---------------- */
function EditUser({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState(user.plan);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: await adminHeaders(),
      body: JSON.stringify({ id: user.id, email, password: password || undefined, plan }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Update failed"); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={save} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-float space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Edit user</h2>
          <button type="button" onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted">Email</span>
          <input className="ed-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">New password <span className="text-faint">(blank = unchanged)</span></span>
          <input className="ed-input mt-1" value={password} placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Plan</span>
          <select className="ed-input mt-1" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="free">Free</option>
            <option value="pro">Full access (Pro)</option>
            <option value="team">White label</option>
          </select>
        </label>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-lg grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- credit balance + ledger ---------------- */
type LedgerRow = { delta: number; reason: string; ref: string | null; created_at: string };

function CreditsHistory({ user, onClose }: { user: User; onClose: () => void }) {
  const [balance, setBalance] = useState(user.credits ?? 0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const h = await adminHeaders();
      const r = await fetch(`/api/admin/credits?userId=${user.id}`, { headers: h });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setBalance(d.balance ?? 0); setLedger(d.ledger ?? []); }
      setLoading(false);
    })();
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-float space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-1.5"><History className="h-4 w-4" /> Credit history</h2>
            <p className="text-xs text-muted mt-0.5">{loginOf(user.email)}</p>
          </div>
          <button type="button" onClick={onClose} className="ed-icon" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-500" />
          <span className="text-lg font-semibold tabular-nums">{balance}</span>
          <span className="text-xs text-muted">credits</span>
        </div>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : ledger.length === 0 ? (
          <p className="text-sm text-muted">Koi transaction abhi tak nahi.</p>
        ) : (
          <div className="divide-y divide-border -mx-2">
            {ledger.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2 text-sm">
                <div>
                  <p className="font-medium">{l.reason}</p>
                  <p className="text-[11px] text-faint mono">{new Date(l.created_at).toLocaleString("en-IN")}</p>
                </div>
                <span className={`tabular-nums font-semibold ${l.delta >= 0 ? "text-good" : "text-danger"}`}>
                  {l.delta >= 0 ? "+" : ""}{l.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordSecurityNotice() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-good/10 text-good">
          <KeyRound className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-semibold">Passwords are protected by Supabase Auth</h2>
          <p className="mt-1 text-sm text-muted">
            Shubhora does not store or display customer passwords. Use Edit user only to set a new password when the customer requests help.
          </p>
        </div>
      </div>
    </section>
  );
}
