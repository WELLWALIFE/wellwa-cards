"use client";
// One franchise, in full (Admin v2): overview and profile, its users, its account (ledger), payouts and logins.
// The same component serves the admin (/admin/franchises/[id]) and the franchise itself (/admin/earnings, `mine`).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, FileCheck2, Upload, ArrowDownLeft, ArrowUpRight, Banknote, Download, Eye, KeyRound, Link2, MessageCircle, Network, Pencil, Plus, Save, Search, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { adminApi, adminHeaders, ago, fmtDate, useAdminMe, viewAsFranchise } from "@/lib/admin-client";
import { FranchiseBoard, Progress } from "@/components/admin/franchise-board";
import { Badge, Btn, Card, CopyBtn, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Table, Tabs, Toggle, inputCls, money, td, toast, useConfirm } from "@/components/admin/ui";

type Fr = { id: string; code: string; name: string; company: string; phone: string; email: string; gstin: string; pan: string; area: string; city: string; state: string; pincode: string; commission_first_pct: number; commission_renewal_pct: number; can_activate: boolean; status: "active" | "paused" | "ended"; bank: Record<string, string>; agreement_at: string | null; target_paise: number; notes: string; created_at: string; parent_id?: string | null; kyc?: KycView };
type KycView = { status: "none" | "submitted" | "verified" | "rejected"; note: string; decided_at: string | null; decided_by: string; docs: Record<string, { name: string; at: string }> };
type User = { id: string; full_name: string | null; username: string | null; plan: string; saas_tier: string | null; saas_expires_at: string | null; created_at: string; franchise_joined_at: string | null };
type Ledger = { id: number; user: string; kind: string; amount_paise: number; base_paise: number | null; pct: number | null; payment_ref: string; note: string; at: string };
type Payout = { id: string; tds_paise?: number; amount_paise: number; status: string; utr: string; note: string; requested_at: string; decided_at: string | null; paid_at: string | null };
type Login = { id: string; email: string; name: string; active: boolean; last_login_at: string | null };
type CreditGift = { id: string; user: string; delta: number; by: string; at: string };
type SubLogin = { id: string; email: string; name: string; active: boolean; last_login_at: string | null };
type Sub = { id: string; code: string; name: string; phone: string; area: string; city: string; status: Fr["status"]; can_activate: boolean; commission_first_pct: number; commission_renewal_pct: number; created_at: string; users: number; earned: number; balance: number; override: number; logins: SubLogin[] };
type Detail = { subs?: Sub[]; parent?: { id: string; code: string; name: string } | null; franchise: Fr; balance: { earned: number; paid: number; adjusted: number; balance: number; pending: number; thisMonth: number }; users: User[]; ledger: Ledger[]; payouts: Payout[]; logins: Login[]; settings: { payoutMin: number }; signupLink: string; credits?: CreditGift[] };
type Tab = "overview" | "users" | "account" | "payouts" | "logins" | "credits" | "subs" | "activity";
const planOf = (u: User) => (u.saas_tier && u.saas_tier !== "none" && u.saas_expires_at && new Date(u.saas_expires_at) > new Date() ? u.saas_tier : u.plan && u.plan !== "free" ? u.plan : "free");

export function FranchiseDetail({ id, mine = false }: { id: string; mine?: boolean }) {
  const { me } = useAdminMe();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  // ?tab=logins opens the Logins tab straight away (the list's "no login · create" link).
  const [tab, setTab] = useState<Tab>(() => { try { const t = new URLSearchParams(window.location.search).get("tab"); return (["overview", "users", "account", "payouts", "logins", "credits", "subs", "activity"] as Tab[]).includes(t as Tab) ? (t as Tab) : "overview"; } catch { return "overview"; } });
  const [form, setForm] = useState<Partial<Fr> | null>(null);
  const [busy, setBusy] = useState("");
  const [confirm, dialog] = useConfirm();
  const router = useRouter();
  const canManage = !!me?.rights.includes("franchises.manage") && !mine;
  const canPay = !!me?.rights.includes("franchises.payouts") && !mine;

  const load = useCallback(async () => {
    const r = await adminApi<Detail>(`/api/admin/v2/franchises/${id}`);
    if (!r.ok) { setErr(r.data.error || "Could not load."); return; }
    setD(r.data); setForm(r.data.franchise); setErr("");
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const act = useCallback(async (json: Record<string, unknown>, ok: string) => {
    const r = await adminApi(`/api/admin/v2/franchises/${id}`, { json });
    if (!r.ok) { toast(r.data.error || "Could not do that.", "err"); return false; }
    toast(ok); await load(); return true;
  }, [id, load]);

  /** Gone for good — after typing the code (owner, 1 Nov 2026: "confirmation pop up ke saath"). */
  async function removeFranchise() {
    if (!d) return;
    const f = d.franchise;
    const owed = d.balance.balance - d.balance.pending;
    const ok = await confirm({
      title: `Delete franchise ${f.code}?`, danger: true, ok: "Delete for good", ask: f.code,
      body: <div className="space-y-1 text-sm"><p>{f.name}{f.city ? ` · ${f.city}` : ""} — <b>{d.users.length}</b> user{d.users.length === 1 ? "" : "s"}, earned <b>{money(d.balance.earned)}</b>, balance <b>{money(d.balance.balance)}</b>.</p>{owed > 0 && <p className="font-semibold text-danger">₹{Math.round(owed / 100).toLocaleString("en-IN")} is still owed to this franchise and will not be payable after deletion.</p>}<p className="text-muted">Its account and payouts are deleted; its users stay in the app without a franchise; its logins are switched off. This cannot be undone — type the code to confirm.</p></div>,
    });
    if (!ok) return;
    setBusy("delete");
    const r = await adminApi<{ ok?: boolean }>(`/api/admin/v2/franchises/${id}`, { method: "DELETE" });
    setBusy("");
    if (!r.ok) { toast(r.data.error || "Could not delete.", "err"); return; }
    toast(`Franchise ${f.code} deleted.`);
    router.replace("/admin/franchises");
  }

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!d || !form) return <Spinner />;
  const f = d.franchise;
  const share = `https://wa.me/?text=${encodeURIComponent(`Shubhora par apna business online karein — card, website, posters, WhatsApp AI. Yahan se shuru karein: ${d.signupLink}`)}`;

  async function saveProfile() {
    setBusy("save");
    const body = mine ? { bank: form!.bank, email: form!.email, phone: form!.phone, pincode: form!.pincode, pan: form!.pan, gstin: form!.gstin } : form;
    const r = await adminApi<{ franchise: Fr }>(`/api/admin/v2/franchises/${id}`, { method: "PATCH", json: body });
    setBusy("");
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    toast("Saved."); await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader crumbs={mine ? undefined : [{ href: "/admin/franchises", label: "Franchises" }, { label: f.code }]}
        title={<span className="flex items-center gap-2">{mine ? "My earnings" : f.name} <Badge tone={f.status === "active" ? "good" : f.status === "paused" ? "warn" : "danger"} dot>{f.status}</Badge></span>}
        sub={<>{d.parent ? <>Sub-franchise of {mine || !canManage ? <b className="text-ink">{d.parent.code}</b> : <Link href={`/admin/franchises/${d.parent.id}`} className="font-semibold text-brand-ink">{d.parent.code}</Link>} · </> : null}Franchise code <b className="font-mono text-ink">{f.code}</b>{f.company ? ` · ${f.company}` : ""}{f.city ? ` · ${f.city}` : ""} · commission {f.commission_first_pct}% first / {f.commission_renewal_pct}% renewal</>}
        actions={<>{me?.rights.includes("franchises.manage") && !me.franchise && d.franchise.status !== "ended" && (
          <button type="button" onClick={() => { viewAsFranchise(d.franchise.id); window.location.href = "/admin"; }} title="See the panel exactly as this franchise sees it" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-surface2"><Eye className="h-4 w-4" /> Open as this franchise</button>
        )}<CopyBtn size="md" text={d.signupLink} label="Copy sign-up link" /><a href={share} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Share on WhatsApp</a></>} />

      {!mine && canManage && d.logins.length === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1"><b>Step 2 — give the franchise its login.</b> Without it {f.name.split(" ")[0]} cannot open the panel. Create it, then send the message (link, user, temporary password) on WhatsApp.</span>
          <Btn size="sm" variant="primary" icon={Plus} onClick={() => setTab("logins")}>Create login</Btn>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={d.users.length} hint={`${d.users.filter((u) => planOf(u) !== "free").length} on a paid plan`} icon={Users} />
        <Stat label="Earned this month" value={money(d.balance.thisMonth)} hint={`${money(d.balance.earned)} in all`} icon={ArrowDownLeft} tone="good" />
        <Stat label="Paid out" value={money(d.balance.paid)} hint={d.balance.pending ? `${money(d.balance.pending)} in process` : "nothing in process"} icon={ArrowUpRight} tone="neutral" />
        <Stat label="Balance" value={money(d.balance.balance)} hint={`available ${money(Math.max(0, d.balance.balance - d.balance.pending))}`} icon={Banknote} tone="brand" />
      </div>
      {f.target_paise > 0 && (() => {
        const ist = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 7);
        const m = ist(new Date().toISOString());
        const sales = d.ledger.filter((l) => l.kind === "earning" && !l.note.startsWith("Override") && ist(l.at) === m).reduce((a, l) => a + (l.base_paise ?? 0), 0);
        return <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm"><span className="font-semibold">This month&apos;s target</span><span className="text-muted">sales {money(sales)} (own users, without GST)</span><div className="flex-1"><Progress value={sales} target={f.target_paise} /></div></div>;
      })()}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ key: "overview", label: mine ? "Profile & bank" : "Profile" }, { key: "users", label: "Users", count: d.users.length }, { key: "account", label: "Account", count: d.ledger.length }, { key: "payouts", label: "Payouts", count: d.payouts.filter((p) => p.status === "requested" || p.status === "approved").length }, { key: "credits", label: "Credits given", count: (d.credits ?? []).length }, ...(!f.parent_id ? [{ key: "subs" as Tab, label: "Sub-franchises", count: (d.subs ?? []).length }] : []), ...(mine ? [] : [{ key: "logins" as Tab, label: "Logins", count: d.logins.length }]), { key: "activity", label: "Activity" }]} />
      {tab === "activity" && <ActivityTab id={id} staff={!me?.franchise} />}

      {tab === "overview" && (
        <Card title={mine ? "Your details" : "Profile"} sub={mine ? "Your bank details are used for payouts. Everything else is set by Shubhora." : "What the franchise is, where, and on what terms."}
          actions={<Btn variant="primary" icon={Save} loading={busy === "save"} onClick={() => void saveProfile()}>Save</Btn>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Owner's name"><input className={inputCls} disabled={mine} value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Company / firm"><input className={inputCls} disabled={mine} value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="Mobile"><input className={inputCls} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="E-mail"><input className={inputCls} value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="GSTIN"><input className={inputCls} value={form.gstin ?? ""} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="PAN"><input className={inputCls} value={form.pan ?? ""} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></Field>
            <Field label="Area / territory" className="sm:col-span-2"><input className={inputCls} disabled={mine} value={form.area ?? ""} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Jaipur city, Sikar district" /></Field>
            <Field label="City"><input className={inputCls} disabled={mine} value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="State"><input className={inputCls} disabled={mine} value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            <Field label="Pincode"><input className={inputCls} value={form.pincode ?? ""} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></Field>
            {!mine && <>
              <Field label="Commission on first payment (%)"><input type="number" min={0} max={100} step={0.5} className={inputCls} disabled={!canManage} value={form.commission_first_pct ?? 0} onChange={(e) => setForm({ ...form, commission_first_pct: Number(e.target.value) })} /></Field>
              <Field label="Commission on renewals (%)" hint={<>Both percents are of the amount <b>without GST</b> (₹2,999 paid → on ₹2,541).</>}><input type="number" min={0} max={100} step={0.5} className={inputCls} disabled={!canManage} value={form.commission_renewal_pct ?? 0} onChange={(e) => setForm({ ...form, commission_renewal_pct: Number(e.target.value) })} /></Field>
              <Field label="Monthly target (₹)"><input type="number" min={0} step={1000} className={inputCls} disabled={!canManage} value={Math.round((form.target_paise ?? 0) / 100)} onChange={(e) => setForm({ ...form, target_paise: Math.round(Number(e.target.value) * 100) })} /></Field>
              <Field label="Agreement date"><input type="date" className={inputCls} disabled={!canManage} value={form.agreement_at ?? ""} onChange={(e) => setForm({ ...form, agreement_at: e.target.value || null })} /></Field>
              <Field label="Status"><select className={inputCls} disabled={!canManage} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Fr["status"] })}><option value="active">Active</option><option value="paused">Paused — no new earnings</option><option value="ended">Ended — logins closed</option></select></Field>
              <div className="sm:col-span-2 lg:col-span-3"><Toggle on={!!form.can_activate} disabled={!canManage} onChange={(v) => setForm({ ...form, can_activate: v })} label="May activate plans for its users" hint="For payments the franchise takes by hand (cash / UPI). Off: only Shubhora activates plans." /></div>
              <Field label="Notes (Shubhora only)" className="sm:col-span-2 lg:col-span-3"><textarea rows={2} className={inputCls} disabled={!canManage} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </>}
          </div>
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-faint">Bank details for payouts</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {([["holder", "Account holder"], ["bank", "Bank"], ["account", "Account number"], ["ifsc", "IFSC"], ["upi", "UPI ID"]] as const).map(([k, l]) => (
              <Field key={k} label={l}><input className={inputCls} value={form.bank?.[k] ?? ""} onChange={(e) => setForm({ ...form, bank: { ...(form.bank ?? {}), [k]: e.target.value } })} /></Field>
            ))}
          </div>
          {canManage && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-muted">
              <span><b className="text-ink">Delete this franchise.</b> Its account and payouts go for good; its users stay in the app (no franchise); its logins are switched off. Prefer <b>Status: ended</b> to keep the record.</span>
              <Btn size="sm" variant="danger" icon={Trash2} loading={busy === "delete"} onClick={() => void removeFranchise()}>Delete franchise</Btn>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-bg p-3 text-xs text-muted"><Link2 className="h-4 w-4 text-brand" /> Sign-up link: <span className="font-mono text-ink">{d.signupLink}</span><CopyBtn text={d.signupLink} /> <span>Users who sign up through it (or enter the code) belong to this franchise.</span></div>
        </Card>
      )}

      {tab === "overview" && f.kyc && <KycCard id={id} kyc={f.kyc} mine={mine} canVerify={canManage} reload={load} />}

      {tab === "users" && <UsersTab d={d} canManage={canManage} act={act} />}

      {tab === "credits" && (
        <Card title="Credits given by this franchise" sub="Every AI credit this franchise gave one of its users (from Users → + credits), with who gave it. ₹10 a credit is taken from the franchise balance (see Account)." pad={false}>
          <Table head={["When", "User", "Credits", "Given by"]} minW={520} empty="No credits given yet.">
            {(d.credits ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-surface2/50">
                <td className={`${td} whitespace-nowrap text-xs text-muted`}>{fmtDate(c.at, true)}</td>
                <td className={`${td} text-sm`}>{c.user}</td>
                <td className={`${td} text-right font-semibold tabular-nums text-emerald-700`}>+{c.delta}</td>
                <td className={`${td} text-xs text-muted`}>{c.by || "—"}</td>
              </tr>
            ))}
          </Table>
          {(d.credits ?? []).length > 0 && <p className="px-4 py-3 text-xs text-muted">Total: <b>{(d.credits ?? []).reduce((n, c) => n + c.delta, 0)}</b> credits · {(d.credits ?? []).length} time{(d.credits ?? []).length === 1 ? "" : "s"}</p>}
        </Card>
      )}

      {tab === "account" && (
        <Card title="Account" sub="Every rupee earned (per payment of your users), paid out, or adjusted." pad={false}
          actions={<><Statement d={d} />{canPay && <AdjustBtn act={act} />}</>}>
          <Table head={["When", "What", "User", "Base", "%", "Amount"]} minW={620} empty="No earnings yet — they appear here when a user of this franchise pays.">
            {d.ledger.map((l) => (
              <tr key={l.id} className="hover:bg-surface2/50">
                <td className={`${td} whitespace-nowrap text-xs text-muted`}>{fmtDate(l.at, true)}</td>
                <td className={td}><Badge tone={l.kind === "earning" ? "good" : l.kind === "payout" ? "neutral" : "warn"}>{l.kind}</Badge>{l.note && <span className="ml-2 text-xs text-muted">{l.note}</span>}</td>
                <td className={`${td} text-xs`}>{l.user || "—"}</td>
                <td className={`${td} text-xs text-muted`}>{l.base_paise ? money(l.base_paise) : "—"}</td>
                <td className={`${td} text-xs text-muted`}>{l.pct ? `${l.pct}%` : "—"}</td>
                <td className={`${td} text-right font-semibold tabular-nums ${l.amount_paise < 0 ? "text-red-600" : "text-emerald-700"}`}>{l.amount_paise < 0 ? "−" : "+"}{money(Math.abs(l.amount_paise))}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === "subs" && !f.parent_id && <SubsTab d={d} mine={mine} canCreate={(mine && f.status === "active") || canManage} reload={load} confirm={confirm} />}
      {tab === "payouts" && <PayoutsTab d={d} mine={mine} canPay={canPay} act={act} confirm={confirm} />}

      {tab === "logins" && !mine && (
        <Card title="Logins" sub="People who open this panel as this franchise: they see only its users and earnings." actions={canManage && me?.rights.includes("staff.manage") ? <CreateLogin franchise={f} onDone={load} /> : undefined} pad={false}>
          <Table head={["Person", "Login", "Status", "Last login"]} minW={520} empty="No login yet. Create one so the franchise can see its users and earnings.">
            {d.logins.map((l) => <tr key={l.id}><td className={`${td} font-semibold`}>{l.name}</td><td className={`${td} text-xs text-muted`}>{/^p91(\d{10})@phone\./.test(l.email) ? `+91 ${l.email.slice(3, 13)}` : l.email}</td><td className={td}>{l.active ? <Badge tone="good" dot>Active</Badge> : <Badge tone="danger">Stopped</Badge>}</td><td className={`${td} text-xs text-muted`}>{l.last_login_at ? ago(l.last_login_at) : "never"}</td></tr>)}
          </Table>
          <p className="px-4 py-2 text-[11px] text-muted">Rights, password and 2-step resets for these logins: <Link href="/admin/staff" className="font-semibold text-brand-ink">Staff & roles</Link>.</p>
        </Card>
      )}
      {dialog}
    </div>
  );
}

function UsersTab({ d, canManage, act }: { d: Detail; canManage: boolean; act: (j: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [hits, setHits] = useState<{ id: string; title: string; sub: string }[]>([]);
  const [sq, setSq] = useState("");
  useEffect(() => {
    if (!adding || sq.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => { const r = await adminApi<{ hits: { type: string; id: string; title: string; sub: string }[] }>(`/api/admin/v2/search?q=${encodeURIComponent(sq.trim())}`); setHits(r.ok ? r.data.hits.filter((h) => h.type === "user") : []); }, 250);
    return () => clearTimeout(t);
  }, [sq, adding]);
  const rows = d.users.filter((u) => !q || `${u.full_name ?? ""} ${u.username ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card pad={false} title={`Users (${d.users.length})`} actions={<>
      <label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-bg px-2"><Search className="h-3.5 w-3.5 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="w-28 bg-transparent text-xs outline-none" /></label>
      {canManage && <Btn size="sm" variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>Assign a user</Btn>}
    </>}>
      <Table head={["User", "Plan", "Joined Shubhora", "In franchise since", ""]} minW={640} empty={<Empty icon={Users} title="No users yet" sub="Share the sign-up link — everyone who joins through it lands here." />}>
        {rows.map((u) => (
          <tr key={u.id} className="hover:bg-surface2/50">
            <td className={td}><Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-brand-ink">{u.full_name || u.username || "User"}</Link>{u.username && <span className="ml-1 text-xs text-muted">@{u.username}</span>}</td>
            <td className={td}><Badge tone={planOf(u) === "free" ? "neutral" : "good"}>{planOf(u)}</Badge></td>
            <td className={`${td} text-xs text-muted`}>{fmtDate(u.created_at)}</td>
            <td className={`${td} text-xs text-muted`}>{fmtDate(u.franchise_joined_at ?? u.created_at)}</td>
            <td className={`${td} text-right`}>{canManage && <Btn size="sm" variant="ghost" onClick={() => { if (confirm("Take this user out of the franchise? Past earnings stay.")) void act({ op: "remove_user", user_id: u.id }, "Removed from the franchise."); }}>Remove</Btn>}</td>
          </tr>
        ))}
      </Table>
      <Modal open={adding} onClose={() => setAdding(false)} title="Assign a user to this franchise" sub="Search by name, mobile, e-mail or username. Their future payments earn this franchise its commission." width="max-w-md">
        <input autoFocus className={inputCls} value={sq} onChange={(e) => setSq(e.target.value)} placeholder="Search…" />
        <ul className="mt-3 divide-y divide-border">
          {hits.map((h) => <li key={h.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{h.title}</span><span className="block truncate text-xs text-muted">{h.sub}</span></span><Btn size="sm" variant="primary" onClick={async () => { if (await act({ op: "assign_user", user_id: h.id }, "Assigned.")) { setAdding(false); setSq(""); } }}>Assign</Btn></li>)}
          {sq.trim().length >= 2 && !hits.length && <li className="py-6 text-center text-xs text-muted">No user found.</li>}
        </ul>
      </Modal>
    </Card>
  );
}

function AdjustBtn({ act }: { act: (j: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false); const [amount, setAmount] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <>
      <Btn size="sm" icon={Plus} onClick={() => setOpen(true)}>Adjustment</Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Adjust the account" sub="A bonus (+) or a correction (−), with the reason. Written in the ledger and the audit log." width="max-w-md"
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={async () => { setBusy(true); const ok = await act({ op: "adjustment", amount, note }, "Adjusted."); setBusy(false); if (ok) { setOpen(false); setAmount(""); setNote(""); } }}>Save</Btn></>}>
        <div className="space-y-3"><Field label="Amount (₹, − to take back)"><input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500 or -200" /></Field><Field label="Why"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Diwali bonus / refund of order #…" /></Field></div>
      </Modal>
    </>
  );
}

function PayoutsTab({ d, mine, canPay, act, confirm }: { d: Detail; mine: boolean; canPay: boolean; act: (j: Record<string, unknown>, ok: string) => Promise<boolean>; confirm: (o: { title: string; body?: string; ok?: string; danger?: boolean }) => Promise<boolean> }) {
  const [amount, setAmount] = useState(""); const [busy, setBusy] = useState("");
  const [utr, setUtr] = useState<Record<string, string>>({}); const [tds, setTds] = useState<Record<string, string>>({});
  const available = Math.max(0, d.balance.balance - d.balance.pending);
  const canAsk = mine || canPay;
  return (
    <div className="space-y-4">
      {canAsk && (
        <Card title="Ask for a payout" sub={`Available ${money(available)} · minimum ${money(d.settings.payoutMin)} · paid to the bank / UPI on the profile`}>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Amount (₹)"><input className={`${inputCls} w-40`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Btn variant="primary" loading={busy === "ask"} disabled={!amount} onClick={async () => { setBusy("ask"); if (await act({ op: "payout_request", amount }, "Payout requested.")) setAmount(""); setBusy(""); }}>Request</Btn>
            <Btn variant="ghost" onClick={() => setAmount(String(Math.floor(available / 100)))}>All available</Btn>
          </div>
        </Card>
      )}
      <Card title="Payouts" pad={false}>
        <Table head={["Requested", "Amount", "Status", "UTR / note", canPay ? "Decide" : ""]} minW={620} empty="No payouts yet.">
          {d.payouts.map((p) => (
            <tr key={p.id} className="hover:bg-surface2/50">
              <td className={`${td} text-xs text-muted`}>{fmtDate(p.requested_at, true)}</td>
              <td className={`${td} font-semibold tabular-nums`}>{money(p.amount_paise)}</td>
              <td className={td}><Badge tone={p.status === "paid" ? "good" : p.status === "rejected" ? "danger" : p.status === "approved" ? "brand" : "warn"}>{p.status}</Badge>{p.paid_at && <span className="ml-2 text-[11px] text-muted">{fmtDate(p.paid_at)}</span>}</td>
              <td className={`${td} text-xs text-muted`}>{p.utr && <span className="font-mono text-ink">{p.utr}</span>}{!!p.tds_paise && <span className="block">TDS {money(p.tds_paise)} · to bank {money(p.amount_paise - p.tds_paise)}</span>}{p.note && <span className="block">{p.note}</span>}</td>
              <td className={`${td} text-right`}>
                {canPay && (p.status === "requested" || p.status === "approved") && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <input className={`${inputCls} h-8 w-24 text-xs`} inputMode="decimal" placeholder="TDS ₹ (if any)" title="TDS deducted from this payout — the bank gets the rest. Ask your CA for the rate." value={tds[p.id] ?? ""} onChange={(e) => setTds({ ...tds, [p.id]: e.target.value })} />
                    <input className={`${inputCls} h-8 w-36 text-xs`} placeholder="UTR after transfer" value={utr[p.id] ?? ""} onChange={(e) => setUtr({ ...utr, [p.id]: e.target.value })} />
                    <Btn size="sm" variant="primary" disabled={!(utr[p.id] ?? "").trim()} onClick={async () => { if (await confirm({ title: `Mark ${money(p.amount_paise)} as paid?`, body: "Only after the bank transfer is done. This takes the amount out of the franchise's balance.", ok: "Mark paid" })) void act({ op: "payout_decide", payout_id: p.id, status: "paid", utr: utr[p.id], tds: tds[p.id] ?? "" }, "Marked paid."); }}>Paid</Btn>
                    {p.status === "requested" && <Btn size="sm" onClick={() => void act({ op: "payout_decide", payout_id: p.id, status: "approved" }, "Approved — transfer it, then mark paid.")}>Approve</Btn>}
                    <Btn size="sm" variant="danger" onClick={async () => { if (await confirm({ title: "Reject this payout?", danger: true, ok: "Reject" })) void act({ op: "payout_decide", payout_id: p.id, status: "rejected", note: "Rejected by admin" }, "Rejected."); }}>Reject</Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function CreateLogin({ franchise, onDone }: { franchise: Fr; onDone: () => void }) {
  // Owner, 1 Nov 2026: no generated passwords — the admin sets the first password here (agreed with the franchise on the phone);
  // the franchise changes it at the first login. Normally a franchise comes through the website form and sets its own.
  const [open, setOpen] = useState(false); const [login, setLogin] = useState(franchise.phone || franchise.email || ""); const [name, setName] = useState(franchise.name); const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [show, setShow] = useState(false);
  const [made, setMade] = useState<{ created: boolean } | null>(null);
  const bad = pw.length < 8 ? "At least 8 characters." : pw !== pw2 ? "The two passwords do not match." : "";
  return (
    <>
      <Btn size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>Create login</Btn>
      <Modal open={open} onClose={() => { setOpen(false); setMade(null); }} title={`Login for ${franchise.code}`} sub="A Franchise-role login tied to this franchise. Set the first password here; they change it at the first login." width="max-w-md"
        footer={made ? <Btn variant="primary" onClick={() => { setOpen(false); setMade(null); onDone(); }}>Done</Btn> : <><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" loading={busy} disabled={!!bad || !login.trim() || !name.trim()} onClick={async () => { setBusy(true); const r = await adminApi<{ created?: boolean }>("/api/admin/v2/staff", { json: { login, name, role: "franchise", franchise_id: franchise.id, password: pw } }); setBusy(false); if (!r.ok) { toast(r.data.error || "Could not create.", "err"); return; } setMade({ created: r.data.created !== false }); setPw(""); setPw2(""); }}>Create</Btn></>}>
        {made ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Login</p><p className="font-semibold">{login}</p></div>
            <p className="text-muted">{made.created ? "Login made with the password you set." : "This mobile already had a Shubhora account — the password you typed was set on it."} Tell them in your own words; nothing is sent by itself.</p>
            <CopyBtn size="md" text={`Shubhora Franchise panel\nLogin: ${location.origin}/admin/login\nUser: ${login}\nPassword: (as agreed on the phone)\nAt the first login set up 2-step verification.`} label="Copy message" />
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Login: mobile or e-mail"><input className={inputCls} value={login} onChange={(e) => setLogin(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First password" hint="At least 8 characters."><input type={show ? "text" : "password"} autoComplete="new-password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              <Field label="Again"><input type={show ? "text" : "password"} autoComplete="new-password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
            {pw && bad && <p className="text-xs font-semibold text-danger">{bad}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}

const showLogin = (e: string) => (/^p91(\d{10})@phone\./.test(e) ? `+91 ${e.slice(3, 13)}` : /^\d{10}$/.test(e) ? `+91 ${e}` : e);
const pctOk = (v: string, max: number) => v.trim() !== "" && Number(v) >= 0 && Number(v) <= max;

/** Sub-franchises of a top-level franchise (one level only). The parent makes them with their login, sets their share (never above its
 *  own — it keeps the difference as its override), resets their password, and can open their panel. Shubhora pays both directly. */
function SubsTab({ d, mine, canCreate, reload, confirm }: { d: Detail; mine: boolean; canCreate: boolean; reload: () => Promise<void>; confirm: (o: { title: string; body?: ReactNode; ok?: string; danger?: boolean }) => Promise<boolean> }) {
  const f = d.franchise; const subs = d.subs ?? [];
  const [edit, setEdit] = useState<Sub | null>(null);
  const [reset, setReset] = useState<{ sub: Sub; login: SubLogin } | null>(null);
  const overrideAll = subs.reduce((a, s) => a + s.override, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sub-franchises" value={subs.length} hint={`${subs.filter((s) => s.status === "active").length} active`} icon={Network} />
        <Stat label="Their users" value={subs.reduce((a, s) => a + s.users, 0)} hint="counted in your users too" icon={Users} />
        <Stat label="Your override" value={money(overrideAll)} hint="your % minus theirs, on their users' payments" icon={ArrowDownLeft} tone="good" />
        <Stat label="They earned" value={money(subs.reduce((a, s) => a + s.earned, 0))} hint="paid to them by Shubhora" icon={Banknote} tone="neutral" />
      </div>
      <Card title="Sub-franchises" sub={<>Your share: {f.commission_first_pct}% first / {f.commission_renewal_pct}% renewal. A sub-franchise gets what you set (up to this); you get the rest as override. Shubhora pays both directly.</>}
        actions={canCreate ? <NewSub parent={f} onDone={reload} /> : undefined} pad={false}>
        <Table head={["Sub-franchise", "Share", "Users", "Earned / balance", "Your override", "Login", "Status", ""]} minW={900} empty={<Empty title="No sub-franchise yet" sub={canCreate ? "Add one with “New sub-franchise”. They get their own login and see only their own users." : "None under this franchise."} />}>
          {subs.map((s) => (
            <tr key={s.id}>
              <td className={td}>{mine ? <b>{s.name}</b> : <Link href={`/admin/franchises/${s.id}`} className="font-semibold text-brand-ink">{s.name}</Link>}<div className="font-mono text-[11px] text-muted">{s.code}{s.city ? ` · ${s.city}` : ""}{s.area ? ` · ${s.area}` : ""}</div></td>
              <td className={`${td} text-xs tabular-nums`}>{s.commission_first_pct}% / {s.commission_renewal_pct}%{s.can_activate && <div className="text-[11px] text-muted">may activate</div>}</td>
              <td className={`${td} tabular-nums`}>{s.users}</td>
              <td className={`${td} text-xs tabular-nums`}>{money(s.earned)}<div className="text-muted">bal. {money(s.balance)}</div></td>
              <td className={`${td} font-semibold tabular-nums text-emerald-700`}>{money(s.override)}</td>
              <td className={`${td} text-xs`}>{s.logins.length ? s.logins.map((l) => <div key={l.id} className="flex items-center gap-1.5"><span>{showLogin(l.email)}</span>{!l.active && <Badge tone="danger">off</Badge>}<span className="text-muted">· {l.last_login_at ? ago(l.last_login_at) : "never logged in"}</span>{s.status !== "ended" && <button type="button" title="Set a new password" onClick={() => setReset({ sub: s, login: l })} className="text-brand-ink"><KeyRound className="h-3.5 w-3.5" /></button>}</div>) : <span className="text-muted">no login</span>}</td>
              <td className={td}><Badge tone={s.status === "active" ? "good" : s.status === "paused" ? "warn" : "danger"} dot>{s.status}</Badge></td>
              <td className={`${td} whitespace-nowrap text-right`}>
                {s.status !== "ended" && <Btn size="sm" icon={Pencil} onClick={() => setEdit(s)}>Edit</Btn>}{" "}
                {s.status !== "ended" && <Btn size="sm" icon={Eye} onClick={() => { viewAsFranchise(s.id); window.location.href = "/admin"; }}>Open</Btn>}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {mine && subs.length > 0 && <FranchiseBoard link={false} title="Ranking — you and your sub-franchises" />}
      {edit && <EditSub sub={edit} parent={f} onClose={() => setEdit(null)} onDone={async () => { setEdit(null); await reload(); }} confirm={confirm} />}
      {reset && <ResetSubLogin sub={reset.sub} login={reset.login} onClose={() => setReset(null)} onDone={async () => { setReset(null); await reload(); }} />}
    </div>
  );
}

function NewSub({ parent, onDone }: { parent: Fr; onDone: () => Promise<void> }) {
  const blank = { code: "", name: "", phone: "", area: "", city: parent.city || "", state: parent.state || "", first: String(Math.max(0, parent.commission_first_pct - 10)), renewal: String(Math.max(0, parent.commission_renewal_pct - 10)), can_activate: false, pw: "", pw2: "" };
  const [open, setOpen] = useState(false); const [v, setV] = useState(blank); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const [made, setMade] = useState<{ code: string; login: string; existing: boolean; error: string } | null>(null);
  const set = (k: keyof typeof blank, x: string | boolean) => setV((o) => ({ ...o, [k]: x }));
  const mobile = v.phone.replace(/\D/g, "").slice(-10);
  const bad = !/^[A-Z0-9]{3,16}$/.test(v.code) ? "Code: 3–16 letters / digits." : !v.name.trim() ? "Write the owner's name." : mobile.length !== 10 ? "Write a 10-digit mobile." : !pctOk(v.first, parent.commission_first_pct) ? `First-payment share: 0–${parent.commission_first_pct}%.` : !pctOk(v.renewal, parent.commission_renewal_pct) ? `Renewal share: 0–${parent.commission_renewal_pct}%.` : v.pw.length < 8 ? "Login password: at least 8 characters." : v.pw !== v.pw2 ? "The two passwords do not match." : "";
  async function save() {
    setBusy(true);
    const r = await adminApi<{ franchise?: Fr; login?: string; existingAccount?: boolean; loginError?: string }>("/api/admin/v2/franchises", { json: { parent_id: parent.id, code: v.code, name: v.name, phone: mobile, area: v.area, city: v.city, state: v.state, commission_first_pct: Number(v.first), commission_renewal_pct: Number(v.renewal), can_activate: parent.can_activate && v.can_activate, password: v.pw, status: "active" } });
    setBusy(false);
    if (!r.ok || !r.data.franchise) { toast(r.data.error || "Could not create.", "err"); return; }
    setMade({ code: r.data.franchise.code, login: r.data.login || "", existing: !!r.data.existingAccount, error: r.data.loginError || "" }); setV(blank);
  }
  const close = () => { setOpen(false); if (made) { setMade(null); void onDone(); } };
  return (
    <>
      <Btn size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>New sub-franchise</Btn>
      <Modal open={open} onClose={close} title={made ? `Sub-franchise ${made.code} made` : `New sub-franchise under ${parent.code}`} sub={made ? undefined : "Their panel login is their mobile + the password you set here (agreed with them on the phone)."} width="max-w-xl"
        footer={made ? <Btn variant="primary" onClick={close}>Done</Btn> : <><Btn onClick={close}>Cancel</Btn><Btn variant="primary" loading={busy} disabled={!!bad} onClick={() => void save()}>Create</Btn></>}>
        {made ? (
          <div className="space-y-3 text-sm">
            {made.login ? <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Login</p><p className="font-semibold">+91 {made.login}</p></div> : <p className="font-semibold text-danger">Login not made: {made.error || "unknown"}. Super Admin can make it under Logins.</p>}
            {made.login && <p className="text-muted">{made.existing ? "This mobile already had a Shubhora account — they log in with their own password." : "Login made with the password you set."} Tell them in your own words; nothing is sent by itself.</p>}
            {made.login && <CopyBtn size="md" text={`Shubhora Franchise panel\nLogin: ${location.origin}/admin/login\nUser: ${made.login}\nPassword: ${made.existing ? "your Shubhora password" : "(as agreed on the phone)"}\nAt the first login set up 2-step verification.`} label="Copy message" />}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" hint="Their sign-up link uses it, e.g. JAIPUR01A."><input className={`${inputCls} font-mono uppercase`} value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))} /></Field>
            <Field label="Owner's name"><input className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Mobile (also the login)"><input inputMode="numeric" className={inputCls} value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Area"><input className={inputCls} value={v.area} onChange={(e) => set("area", e.target.value)} /></Field>
            <Field label="City"><input className={inputCls} value={v.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="State"><input className={inputCls} value={v.state} onChange={(e) => set("state", e.target.value)} /></Field>
            <Field label="Their share — first payment %" hint={`Up to ${parent.commission_first_pct}%. You keep ${Math.max(0, parent.commission_first_pct - Number(v.first || 0))}%.`}><input inputMode="decimal" className={inputCls} value={v.first} onChange={(e) => set("first", e.target.value)} /></Field>
            <Field label="Their share — renewal %" hint={`Up to ${parent.commission_renewal_pct}%. You keep ${Math.max(0, parent.commission_renewal_pct - Number(v.renewal || 0))}%.`}><input inputMode="decimal" className={inputCls} value={v.renewal} onChange={(e) => set("renewal", e.target.value)} /></Field>
            <Field label="Login password" hint="At least 8 characters."><input type={show ? "text" : "password"} autoComplete="new-password" className={inputCls} value={v.pw} onChange={(e) => set("pw", e.target.value)} /></Field>
            <Field label="Again"><input type={show ? "text" : "password"} autoComplete="new-password" className={inputCls} value={v.pw2} onChange={(e) => set("pw2", e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
            {parent.can_activate && <div className="sm:col-span-2"><Toggle on={v.can_activate} onChange={(x) => set("can_activate", x)} label="May activate plans for its users" hint="For cash / UPI they take by hand. Off: only Shubhora activates." /></div>}
            {!bad && (Number(v.first) >= parent.commission_first_pct || Number(v.renewal) >= parent.commission_renewal_pct) && <p className="text-xs font-semibold text-amber-700 sm:col-span-2">At this share you keep 0% on {Number(v.first) >= parent.commission_first_pct ? "first payments" : "renewals"} of their users.</p>}
            {bad && (v.code || v.name || v.phone || v.pw) && <p className="text-xs font-semibold text-danger sm:col-span-2">{bad}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}

function EditSub({ sub, parent, onClose, onDone, confirm }: { sub: Sub; parent: Fr; onClose: () => void; onDone: () => Promise<void>; confirm: (o: { title: string; body?: ReactNode; ok?: string; danger?: boolean }) => Promise<boolean> }) {
  const [v, setV] = useState({ name: sub.name, phone: sub.phone, area: sub.area, city: sub.city, first: String(sub.commission_first_pct), renewal: String(sub.commission_renewal_pct), can_activate: sub.can_activate, status: sub.status });
  const [busy, setBusy] = useState(false);
  const bad = !v.name.trim() ? "Write the name." : !pctOk(v.first, parent.commission_first_pct) ? `First-payment share: 0–${parent.commission_first_pct}%.` : !pctOk(v.renewal, parent.commission_renewal_pct) ? `Renewal share: 0–${parent.commission_renewal_pct}%.` : "";
  async function save() {
    if (v.status === "ended" && !(await confirm({ title: `End sub-franchise ${sub.code}?`, danger: true, ok: "End it", body: <p className="text-sm">Its {sub.users} user{sub.users === 1 ? "" : "s"} move to you ({parent.code}), and its login is switched off. Money it already earned stays in its account.</p> }))) return;
    setBusy(true);
    const r = await adminApi(`/api/admin/v2/franchises/${sub.id}`, { method: "PATCH", json: { name: v.name, phone: v.phone, area: v.area, city: v.city, commission_first_pct: Number(v.first), commission_renewal_pct: Number(v.renewal), can_activate: parent.can_activate && v.can_activate, status: v.status } });
    setBusy(false);
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    toast("Saved."); await onDone();
  }
  const set = (k: keyof typeof v, x: string | boolean) => setV((o) => ({ ...o, [k]: x }));
  return (
    <Modal open onClose={onClose} title={`Edit ${sub.code}`} sub="Bank details are theirs to fill in from their own panel." width="max-w-xl"
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon={Save} loading={busy} disabled={!!bad} onClick={() => void save()}>Save</Btn></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Owner's name"><input className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Mobile"><input inputMode="numeric" className={inputCls} value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Area"><input className={inputCls} value={v.area} onChange={(e) => set("area", e.target.value)} /></Field>
        <Field label="City"><input className={inputCls} value={v.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Their share — first payment %" hint={`Up to ${parent.commission_first_pct}%.`}><input inputMode="decimal" className={inputCls} value={v.first} onChange={(e) => set("first", e.target.value)} /></Field>
        <Field label="Their share — renewal %" hint={`Up to ${parent.commission_renewal_pct}%.`}><input inputMode="decimal" className={inputCls} value={v.renewal} onChange={(e) => set("renewal", e.target.value)} /></Field>
        <Field label="Status"><select className={inputCls} value={v.status} onChange={(e) => set("status", e.target.value)}><option value="active">Active</option><option value="paused">Paused (no new earnings)</option><option value="ended">Ended (users move to you)</option></select></Field>
        {parent.can_activate && <div className="sm:col-span-2"><Toggle on={v.can_activate} onChange={(x) => set("can_activate", x)} label="May activate plans for its users" /></div>}
        {bad && <p className="text-xs font-semibold text-danger sm:col-span-2">{bad}</p>}
      </div>
    </Modal>
  );
}

function ResetSubLogin({ sub, login, onClose, onDone }: { sub: Sub; login: SubLogin; onClose: () => void; onDone: () => Promise<void> }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const bad = pw.length < 8 ? "At least 8 characters." : pw !== pw2 ? "The two passwords do not match." : "";
  return (
    <Modal open onClose={done ? () => void onDone() : onClose} title={`New password · ${sub.code}`} sub={`For ${login.name} (${showLogin(login.email)}). Agree it with them on the phone; they change it at the next login.`} width="max-w-md"
      footer={done ? <Btn variant="primary" onClick={() => void onDone()}>Done</Btn> : <><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" loading={busy} disabled={!!bad} onClick={async () => { setBusy(true); const r = await adminApi(`/api/admin/v2/franchises/${sub.id}`, { json: { op: "reset_login", admin_id: login.id, password: pw } }); setBusy(false); if (!r.ok) { toast(r.data.error || "Could not set it.", "err"); return; } setPw(""); setPw2(""); setDone(true); }}>Set password</Btn></>}>
      {done ? <p className="text-sm text-muted">Done — the password you typed is now set, and the login is on. Nothing is sent by itself; tell them yourself.</p> : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="New password" hint="At least 8 characters."><input type={show ? "text" : "password"} autoComplete="new-password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Field label="Again"><input type={show ? "text" : "password"} autoComplete="new-password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>
          {pw && bad && <p className="text-xs font-semibold text-danger">{bad}</p>}
        </div>
      )}
    </Modal>
  );
}

/** Monthly statement as a CSV file (Excel opens it): every ledger line of the month, with opening and closing balance. */
function Statement({ d }: { d: Detail }) {
  const months = [...new Set(d.ledger.map((l) => l.at.slice(0, 7)))].sort().reverse();
  const [m, setM] = useState(months[0] ?? "");
  if (!months.length) return null;
  function download() {
    const f = d.franchise;
    const rows = d.ledger.filter((l) => l.at.slice(0, 7) === m).sort((a, b) => a.at.localeCompare(b.at));
    const after = d.ledger.filter((l) => l.at.slice(0, 7) > m).reduce((a, l) => a + l.amount_paise, 0);
    const closing = d.balance.balance - after, opening = closing - rows.reduce((a, l) => a + l.amount_paise, 0);
    const rs = (p: number) => (p / 100).toFixed(2);
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const sum = (k: string) => rows.filter((l) => l.kind === k).reduce((a, l) => a + l.amount_paise, 0);
    const lines = [
      [`Shubhora franchise statement`], [`Franchise`, `${f.code} · ${f.name}`], [`Month`, m], [`Opening balance (Rs)`, rs(opening)],
      [`Earned`, rs(sum("earning"))], [`Paid out`, rs(sum("payout"))], [`Adjustments`, rs(sum("adjustment") + sum("reversal"))], [`Closing balance (Rs)`, rs(closing)], [],
      [`Date`, `Type`, `User`, `Base without GST (Rs)`, `%`, `Amount (Rs)`, `Note`, `Payment ref`],
      ...rows.map((l) => [l.at.slice(0, 10), l.kind, l.user, l.base_paise ? rs(l.base_paise) : "", l.pct ?? "", rs(l.amount_paise), l.note, l.payment_ref]),
    ];
    const blob = new Blob(["﻿" + lines.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `statement-${f.code}-${m}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <select value={m} onChange={(e) => setM(e.target.value)} className={`${inputCls} h-8 w-32 text-xs`}>{months.map((x) => <option key={x} value={x}>{new Date(`${x}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</option>)}</select>
      <Btn size="sm" icon={Download} onClick={download}>Statement</Btn>
    </span>
  );
}

type Act = { logins: { id: number; at: string; who: string; ok: boolean; reason: string; device: string; ip: string }[]; actions: { id: number; at: string; by: string; mine: boolean; action: string; target: string; note: string; ip: string }[]; missing: string };
const ACTION: Record<string, string> = {
  "user.plan": "Set a plan", "user.package": "Set a package", "user.credits": "Gave credits", "user.kind": "Changed user type", "user.addon_on": "Turned an add-on on", "user.addon_off": "Turned an add-on off",
  "user.delete": "Deleted a user", "user.login_as": "Opened a user's app", "website.live": "Put a website live", "payment.request": "Sent a payment link", "payment.cancel": "Cancelled a payment link",
  "franchise.create": "Franchise made", "franchise.create_sub": "Made a sub-franchise", "franchise.update": "Profile changed", "franchise.end_sub": "Ended a sub-franchise", "franchise.delete": "Franchise deleted",
  "franchise.assign_user": "User added", "franchise.remove_user": "User removed", "franchise.adjustment": "Balance adjusted", "franchise_application.approved": "Application approved",
  "payout.request": "Asked for a payout", "payout.approved": "Payout approved", "payout.paid": "Payout paid", "payout.rejected": "Payout rejected",
  "franchise.kyc_upload": "Uploaded a KYC document", "franchise.kyc_verified": "KYC verified", "franchise.kyc_rejected": "KYC sent back",
  "staff.create": "Login made", "staff.update": "Login changed", "staff.remove": "Login removed", "staff.reset_password": "Password set", "staff.reset_mfa": "2-step reset", "admin.password_changed": "Changed own password",
};
const actionLabel = (a: string) => ACTION[a] ?? a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Track record: who logged in when (and failed tries), and what was done by or to this franchise. */
function ActivityTab({ id, staff }: { id: string; staff: boolean }) {
  const [a, setA] = useState<Act | null>(null); const [err, setErr] = useState("");
  useEffect(() => { void (async () => { const r = await adminApi<Act>(`/api/admin/v2/franchises/${id}?activity=1`); if (!r.ok) setErr(r.data.error || "Could not load."); else setA(r.data); })(); }, [id]);
  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!a) return <Spinner />;
  const failed = a.logins.filter((l) => !l.ok).length;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Login history" sub={a.missing || `Last ${a.logins.length} logins${failed ? ` · ${failed} failed tr${failed === 1 ? "y" : "ies"}` : ""}.`} pad={false}>
        <Table head={["When", "Who", "Result", "Device", ...(staff ? ["IP"] : [])]} minW={480} empty="No login recorded yet (recording started on 6 Nov 2026).">
          {a.logins.map((l) => (
            <tr key={l.id}>
              <td className={`${td} whitespace-nowrap text-xs`}>{fmtDate(l.at, true)}<div className="text-muted">{ago(l.at)}</div></td>
              <td className={`${td} text-xs font-semibold`}>{l.who}</td>
              <td className={td}>{l.ok ? <Badge tone="good" dot>Logged in</Badge> : <Badge tone="danger">{l.reason || "failed"}</Badge>}{l.ok && l.reason && <div className="text-[11px] text-muted">{l.reason}</div>}</td>
              <td className={`${td} text-xs text-muted`}>{l.device || "—"}</td>
              {staff && <td className={`${td} font-mono text-[11px] text-muted`}>{l.ip || "—"}</td>}
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={<span className="flex items-center gap-1.5"><Activity className="h-4 w-4" /> Actions</span>} sub="What its logins did, and what Shubhora did on this franchise." pad={false}>
        <Table head={["When", "By", "What"]} minW={480} empty="Nothing yet.">
          {a.actions.map((x) => (
            <tr key={x.id}>
              <td className={`${td} whitespace-nowrap text-xs`}>{fmtDate(x.at, true)}</td>
              <td className={`${td} text-xs`}>{x.mine ? <b>{x.by}</b> : <span className="text-muted">{x.by}</span>}</td>
              <td className={`${td} text-xs`}><b>{actionLabel(x.action)}</b>{x.target && <span className="text-muted"> · {x.target}</span>}{x.note && <div className="text-[11px] text-muted">{x.note}</div>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

const KYC_DOCS: [string, string, boolean][] = [["pan", "PAN card", true], ["bank", "Cancelled cheque / passbook", true], ["aadhaar_front", "Aadhaar front", false], ["aadhaar_back", "Aadhaar back", false], ["gst", "GST certificate (if any)", false]];
/** KYC documents: the franchise uploads them; Shubhora opens them (5-minute links) and verifies or sends back with a note. */
function KycCard({ id, kyc, mine, canVerify, reload }: { id: string; kyc: KycView; mine: boolean; canVerify: boolean; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(""); const [note, setNote] = useState("");
  const tone = kyc.status === "verified" ? "good" : kyc.status === "rejected" ? "danger" : kyc.status === "submitted" ? "warn" : "neutral";
  const label = { none: "Not sent", submitted: "Waiting for check", verified: "Verified", rejected: "Needs a fix" }[kyc.status];
  async function upload(kind: string, file: File) {
    setBusy(kind);
    const fd = new FormData(); fd.append("file", file); fd.append("kind", kind);
    const h = await adminHeaders(); delete h["content-type"];
    const r = await fetch(`/api/admin/v2/franchises/${id}/kyc`, { method: "POST", headers: h, body: fd }).catch(() => null);
    const j = ((await r?.json().catch(() => ({}))) ?? {}) as { error?: string };
    setBusy("");
    if (!r?.ok) { toast(j.error || "Could not upload.", "err"); return; }
    toast("Uploaded."); await reload();
  }
  async function open(kind: string) {
    const r = await adminApi<{ url: string }>(`/api/admin/v2/franchises/${id}/kyc?doc=${kind}`);
    if (!r.ok) { toast(r.data.error || "Could not open.", "err"); return; }
    window.open(r.data.url, "_blank", "noopener");
  }
  async function decide(status: "verified" | "rejected") {
    setBusy(status);
    const r = await adminApi(`/api/admin/v2/franchises/${id}/kyc`, { method: "PATCH", json: { status, note } });
    setBusy("");
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    toast(status === "verified" ? "KYC verified." : "Sent back to the franchise."); setNote(""); await reload();
  }
  return (
    <Card title={<span className="flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> KYC documents <Badge tone={tone} dot>{label}</Badge></span>}
      sub={mine ? "Needed for payouts and TDS. Photo (JPG / PNG) or PDF, up to 3 MB each. Only you and Shubhora can open them." : "Files open for 5 minutes through a private link."}>
      {kyc.status === "rejected" && kyc.note && <p className="mb-3 rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">To fix: {kyc.note}</p>}
      {kyc.status === "verified" && <p className="mb-3 text-xs text-muted">Verified {kyc.decided_at ? fmtDate(kyc.decided_at) : ""}{kyc.decided_by && !mine ? ` by ${kyc.decided_by}` : ""}.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KYC_DOCS.map(([k, l, must]) => {
          const doc = kyc.docs[k];
          return (
            <div key={k} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{l}{must && <span className="text-danger"> *</span>}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{doc ? `${doc.name} · ${fmtDate(doc.at)}` : "Not uploaded"}</p>
              <div className="mt-2 flex gap-1.5">
                {doc && <Btn size="sm" icon={Eye} onClick={() => void open(k)}>Open</Btn>}
                {(mine || canVerify) && (
                  <label className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold hover:bg-surface2 ${busy === k ? "opacity-60" : ""}`}>
                    <Upload className="h-3.5 w-3.5" /> {busy === k ? "Uploading…" : doc ? "Replace" : "Upload"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={!!busy} onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ""; if (fl) void upload(k, fl); }} />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canVerify && !mine && kyc.status !== "none" && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <Field label="Note (needed to send back)" className="min-w-[240px] flex-1"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. PAN photo is not clear" /></Field>
          <Btn variant="primary" loading={busy === "verified"} onClick={() => void decide("verified")}>Verify</Btn>
          <Btn variant="danger" loading={busy === "rejected"} disabled={!note.trim()} onClick={() => void decide("rejected")}>Send back</Btn>
        </div>
      )}
    </Card>
  );
}
