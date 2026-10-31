"use client";
// One franchise, in full (Admin v2): overview and profile, its users, its account (ledger), payouts and logins.
// The same component serves the admin (/admin/franchises/[id]) and the franchise itself (/admin/earnings, `mine`).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Link2, MessageCircle, Plus, Save, Search, UserPlus, Users } from "lucide-react";
import { adminApi, ago, fmtDate, useAdminMe } from "@/lib/admin-client";
import { Badge, Btn, Card, CopyBtn, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Table, Tabs, Toggle, inputCls, money, td, toast, useConfirm } from "@/components/admin/ui";

type Fr = { id: string; code: string; name: string; company: string; phone: string; email: string; gstin: string; pan: string; area: string; city: string; state: string; pincode: string; commission_first_pct: number; commission_renewal_pct: number; can_activate: boolean; status: "active" | "paused" | "ended"; bank: Record<string, string>; agreement_at: string | null; target_paise: number; notes: string; created_at: string };
type User = { id: string; full_name: string | null; username: string | null; plan: string; saas_tier: string | null; saas_expires_at: string | null; created_at: string; franchise_joined_at: string | null };
type Ledger = { id: number; user: string; kind: string; amount_paise: number; base_paise: number | null; pct: number | null; payment_ref: string; note: string; at: string };
type Payout = { id: string; amount_paise: number; status: string; utr: string; note: string; requested_at: string; decided_at: string | null; paid_at: string | null };
type Login = { id: string; email: string; name: string; active: boolean; last_login_at: string | null };
type Detail = { franchise: Fr; balance: { earned: number; paid: number; adjusted: number; balance: number; pending: number; thisMonth: number }; users: User[]; ledger: Ledger[]; payouts: Payout[]; logins: Login[]; settings: { payoutMin: number }; signupLink: string };
type Tab = "overview" | "users" | "account" | "payouts" | "logins";
const planOf = (u: User) => (u.saas_tier && u.saas_tier !== "none" && u.saas_expires_at && new Date(u.saas_expires_at) > new Date() ? u.saas_tier : u.plan && u.plan !== "free" ? u.plan : "free");

export function FranchiseDetail({ id, mine = false }: { id: string; mine?: boolean }) {
  const { me } = useAdminMe();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [form, setForm] = useState<Partial<Fr> | null>(null);
  const [busy, setBusy] = useState("");
  const [confirm, dialog] = useConfirm();
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
        sub={<>Franchise code <b className="font-mono text-ink">{f.code}</b>{f.company ? ` · ${f.company}` : ""}{f.city ? ` · ${f.city}` : ""} · commission {f.commission_first_pct}% first / {f.commission_renewal_pct}% renewal</>}
        actions={<><CopyBtn size="md" text={d.signupLink} label="Copy sign-up link" /><a href={share} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> Share on WhatsApp</a></>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={d.users.length} hint={`${d.users.filter((u) => planOf(u) !== "free").length} on a paid plan`} icon={Users} />
        <Stat label="Earned this month" value={money(d.balance.thisMonth)} hint={`${money(d.balance.earned)} in all`} icon={ArrowDownLeft} tone="good" />
        <Stat label="Paid out" value={money(d.balance.paid)} hint={d.balance.pending ? `${money(d.balance.pending)} in process` : "nothing in process"} icon={ArrowUpRight} tone="neutral" />
        <Stat label="Balance" value={money(d.balance.balance)} hint={`available ${money(Math.max(0, d.balance.balance - d.balance.pending))}`} icon={Banknote} tone="brand" />
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ key: "overview", label: mine ? "Profile & bank" : "Profile" }, { key: "users", label: "Users", count: d.users.length }, { key: "account", label: "Account", count: d.ledger.length }, { key: "payouts", label: "Payouts", count: d.payouts.filter((p) => p.status === "requested" || p.status === "approved").length }, ...(mine ? [] : [{ key: "logins" as Tab, label: "Logins", count: d.logins.length }])]} />

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
              <Field label="Commission on renewals (%)"><input type="number" min={0} max={100} step={0.5} className={inputCls} disabled={!canManage} value={form.commission_renewal_pct ?? 0} onChange={(e) => setForm({ ...form, commission_renewal_pct: Number(e.target.value) })} /></Field>
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
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-bg p-3 text-xs text-muted"><Link2 className="h-4 w-4 text-brand" /> Sign-up link: <span className="font-mono text-ink">{d.signupLink}</span><CopyBtn text={d.signupLink} /> <span>Users who sign up through it (or enter the code) belong to this franchise.</span></div>
        </Card>
      )}

      {tab === "users" && <UsersTab d={d} canManage={canManage} act={act} />}

      {tab === "account" && (
        <Card title="Account" sub="Every rupee earned (per payment of your users), paid out, or adjusted." pad={false}
          actions={canPay ? <AdjustBtn act={act} /> : undefined}>
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
  const [utr, setUtr] = useState<Record<string, string>>({});
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
              <td className={`${td} text-xs text-muted`}>{p.utr && <span className="font-mono text-ink">{p.utr}</span>}{p.note && <span className="block">{p.note}</span>}</td>
              <td className={`${td} text-right`}>
                {canPay && (p.status === "requested" || p.status === "approved") && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <input className={`${inputCls} h-8 w-36 text-xs`} placeholder="UTR after transfer" value={utr[p.id] ?? ""} onChange={(e) => setUtr({ ...utr, [p.id]: e.target.value })} />
                    <Btn size="sm" variant="primary" disabled={!(utr[p.id] ?? "").trim()} onClick={async () => { if (await confirm({ title: `Mark ${money(p.amount_paise)} as paid?`, body: "Only after the bank transfer is done. This takes the amount out of the franchise's balance.", ok: "Mark paid" })) void act({ op: "payout_decide", payout_id: p.id, status: "paid", utr: utr[p.id] }, "Marked paid."); }}>Paid</Btn>
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
  const [open, setOpen] = useState(false); const [login, setLogin] = useState(franchise.phone || franchise.email || ""); const [name, setName] = useState(franchise.name); const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ password: string } | null>(null);
  return (
    <>
      <Btn size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>Create login</Btn>
      <Modal open={open} onClose={() => { setOpen(false); setSecret(null); }} title={`Login for ${franchise.code}`} sub="A Franchise-role login tied to this franchise. The temporary password is shown once." width="max-w-md"
        footer={secret ? <Btn variant="primary" onClick={() => { setOpen(false); setSecret(null); onDone(); }}>Done</Btn> : <><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" loading={busy} onClick={async () => { setBusy(true); const r = await adminApi<{ password?: string }>("/api/admin/v2/staff", { json: { login, name, role: "franchise", franchise_id: franchise.id } }); setBusy(false); if (!r.ok) { toast(r.data.error || "Could not create.", "err"); return; } setSecret({ password: r.data.password ?? "" }); }}>Create</Btn></>}>
        {secret ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Login</p><p className="font-semibold">{login}</p></div>
            <div className="rounded-xl bg-bg p-3"><p className="text-xs text-muted">Temporary password</p><p className="font-mono text-lg font-semibold">{secret.password || "(existing account — password unchanged)"}</p></div>
            <CopyBtn size="md" text={`Shubhora Franchise panel\nLogin: ${location.origin}/admin/login\nUser: ${login}\nTemporary password: ${secret.password}\nChange it at first login and set up 2-step.`} label="Copy message" />
          </div>
        ) : (
          <div className="space-y-3"><Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Login: mobile or e-mail"><input className={inputCls} value={login} onChange={(e) => setLogin(e.target.value)} /></Field></div>
        )}
      </Modal>
    </>
  );
}
