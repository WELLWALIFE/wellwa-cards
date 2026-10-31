"use client";
// Franchises (Admin v2): every channel partner — their users, earnings and balance — and the payouts waiting to be paid.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Store, Wallet } from "lucide-react";
import { adminApi, fmtDate, useAdminMe } from "@/lib/admin-client";
import { Badge, Btn, Card, Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Table, Tabs, Toggle, inputCls, money, td, toast, useConfirm } from "@/components/admin/ui";

type Row = { id: string; code: string; name: string; company: string; phone: string; city: string; state: string; status: string; commission_first_pct: number; commission_renewal_pct: number; can_activate: boolean; users: number; paid: number; earned: number; balance: number; pendingPayouts: number; logins: { email: string; active: boolean }[] };
type Payout = { id: string; franchise_id: string; amount_paise: number; status: string; utr?: string; note: string; requested_at: string; decided_at?: string; paid_at?: string; franchise: { id: string; code: string; name: string; bank: Record<string, string> } | null };
type Settings = { first: number; renewal: number; canActivate: boolean; payoutMin: number };
type Tab = "list" | "payouts";

function FranchisesInner() {
  const params = useSearchParams();
  const { me } = useAdminMe();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "payouts" ? "payouts" : "list");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [payouts, setPayouts] = useState<{ open: Payout[]; done: Payout[] } | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [utr, setUtr] = useState<Record<string, string>>({});
  const [confirm, dialog] = useConfirm();
  const canManage = !!me?.rights.includes("franchises.manage"), canPay = !!me?.rights.includes("franchises.payouts");
  const blank = { code: "", name: "", company: "", phone: "", email: "", city: "", state: "", area: "", commission_first_pct: "", commission_renewal_pct: "", can_activate: false };
  const [form, setForm] = useState<typeof blank>(blank);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await adminApi<{ franchises: Row[]; settings: Settings }>("/api/admin/v2/franchises");
    if (!r.ok) { setErr(r.data.error || "Could not load."); setRows([]); return; }
    setRows(r.data.franchises); setSettings(r.data.settings); setErr("");
    if (canPay) { const p = await adminApi<{ open: Payout[]; done: Payout[] }>("/api/admin/v2/franchises?payouts=1"); if (p.ok) setPayouts(p.data); }
  }, [canPay]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true);
    const r = await adminApi<{ franchise: { id: string } }>("/api/admin/v2/franchises", { json: { ...form, commission_first_pct: form.commission_first_pct === "" ? undefined : form.commission_first_pct, commission_renewal_pct: form.commission_renewal_pct === "" ? undefined : form.commission_renewal_pct } });
    setBusy(false);
    if (!r.ok) { toast(r.data.error || "Could not create.", "err"); return; }
    toast("Franchise created. Now create its login under Logins."); setAdding(false); setForm(blank); await load();
    window.location.href = `/admin/franchises/${r.data.franchise.id}`;
  }
  async function decide(p: Payout, status: string) {
    const ok = status === "rejected" ? await confirm({ title: "Reject this payout?", danger: true, ok: "Reject" }) : status === "paid" ? await confirm({ title: `Mark ${money(p.amount_paise)} to ${p.franchise?.code} as paid?`, body: "Only after the bank transfer is done.", ok: "Mark paid" }) : true;
    if (!ok) return;
    const r = await adminApi(`/api/admin/v2/franchises/${p.franchise_id}`, { json: { op: "payout_decide", payout_id: p.id, status, utr: utr[p.id] ?? "", note: status === "rejected" ? "Rejected by admin" : "" } });
    if (!r.ok) { toast(r.data.error || "Could not save.", "err"); return; }
    toast(status === "paid" ? "Marked paid." : status === "approved" ? "Approved — transfer it, then mark paid." : "Rejected."); await load();
  }
  const list = (rows ?? []).filter((r) => !q || `${r.code} ${r.name} ${r.company} ${r.city} ${r.phone}`.toLowerCase().includes(q.toLowerCase()));
  const totals = (rows ?? []).reduce((a, r) => ({ users: a.users + r.users, paid: a.paid + r.paid, earned: a.earned + r.earned, balance: a.balance + r.balance }), { users: 0, paid: 0, earned: 0, balance: 0 });
  const suggestCode = (city: string) => { const base = city.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6); if (!base) return ""; const n = (rows ?? []).filter((r) => r.code.startsWith(base)).length + 1; return `${base}${String(n).padStart(2, "0")}`; };

  return (
    <div className="space-y-5">
      <PageHeader title="Franchises" sub="Channel partners who bring users. Each has a code and a sign-up link; every payment by their users earns them a commission."
        actions={canManage ? <Btn variant="primary" icon={Plus} onClick={() => setAdding(true)}>New franchise</Btn> : undefined} />
      {err && <ErrorBox>{err}</ErrorBox>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Franchises" value={(rows ?? []).filter((r) => r.status === "active").length} hint={`${rows?.length ?? 0} in all`} icon={Store} tone="violet" />
        <Stat label="Their users" value={totals.users} hint={`${totals.paid} on a paid plan`} icon={Store} />
        <Stat label="Earned in all" value={money(totals.earned)} icon={Wallet} tone="good" />
        <Stat label="Owed (balances)" value={money(totals.balance)} hint={payouts ? `${payouts.open.length} payout${payouts.open.length === 1 ? "" : "s"} waiting` : ""} icon={Wallet} tone={payouts?.open.length ? "warn" : "neutral"} />
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ key: "list", label: "All franchises", count: rows?.length }, ...(canPay ? [{ key: "payouts" as Tab, label: "Payouts to pay", count: payouts?.open.length }] : [])]} />

      {tab === "list" && (rows === null ? <Spinner /> : rows.length === 0 ? <Empty icon={Store} title="No franchise yet" sub="Create the first one: a code, the owner's details and the commission. Then create its login and share its sign-up link." action={canManage ? <Btn variant="primary" icon={Plus} onClick={() => setAdding(true)}>New franchise</Btn> : undefined} /> : (
        <Card pad={false} actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className={`${inputCls} h-8 w-44 text-xs`} />} title={`${list.length} franchise${list.length === 1 ? "" : "s"}`}>
          <Table head={["Code", "Franchise", "City", "Users", "Paid", "Earned", "Balance", "Commission", "Login", "Status"]} minW={960}>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-surface2/50">
                <td className={td}><Link href={`/admin/franchises/${r.id}`} className="font-mono text-sm font-bold text-brand-ink hover:underline">{r.code}</Link></td>
                <td className={td}><Link href={`/admin/franchises/${r.id}`} className="font-semibold hover:text-brand-ink">{r.name}</Link>{r.company && <span className="block text-xs text-muted">{r.company}</span>}</td>
                <td className={`${td} text-xs text-muted`}>{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                <td className={`${td} tabular-nums`}>{r.users}</td>
                <td className={`${td} tabular-nums`}>{r.paid}</td>
                <td className={`${td} tabular-nums text-emerald-700`}>{money(r.earned)}</td>
                <td className={`${td} tabular-nums font-semibold`}>{money(r.balance)}{r.pendingPayouts > 0 && <span className="block text-[10px] font-normal text-amber-700">{money(r.pendingPayouts)} requested</span>}</td>
                <td className={`${td} text-xs text-muted`}>{r.commission_first_pct}% / {r.commission_renewal_pct}%</td>
                <td className={td}>{r.logins.length ? <Badge tone={r.logins.some((l) => l.active) ? "good" : "danger"}>{r.logins.length} login{r.logins.length === 1 ? "" : "s"}</Badge> : <Badge tone="warn">no login</Badge>}</td>
                <td className={td}><Badge tone={r.status === "active" ? "good" : r.status === "paused" ? "warn" : "danger"} dot>{r.status}</Badge></td>
              </tr>
            ))}
          </Table>
        </Card>
      ))}

      {tab === "payouts" && (
        <div className="space-y-4">
          <Card title="Waiting" sub="Approve, transfer the money by bank / UPI, then mark paid with the UTR. The balance updates at “paid”." pad={false}>
            <Table head={["Franchise", "Amount", "Pay to", "Requested", "Status", "Decide"]} minW={860} empty="Nothing waiting.">
              {(payouts?.open ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-surface2/50">
                  <td className={td}><Link href={`/admin/franchises/${p.franchise_id}`} className="font-semibold text-brand-ink hover:underline">{p.franchise?.code}</Link><span className="block text-xs text-muted">{p.franchise?.name}</span></td>
                  <td className={`${td} font-semibold tabular-nums`}>{money(p.amount_paise)}</td>
                  <td className={`${td} text-xs text-muted`}>{p.franchise?.bank?.upi ? <span>UPI <b className="text-ink">{p.franchise.bank.upi}</b></span> : p.franchise?.bank?.account ? <span>{p.franchise.bank.bank} · {p.franchise.bank.account} · {p.franchise.bank.ifsc}<br />{p.franchise.bank.holder}</span> : <Badge tone="danger">no bank details</Badge>}</td>
                  <td className={`${td} text-xs text-muted`}>{fmtDate(p.requested_at)}{p.note && <span className="block">{p.note}</span>}</td>
                  <td className={td}><Badge tone={p.status === "approved" ? "brand" : "warn"}>{p.status}</Badge></td>
                  <td className={`${td} text-right`}>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <input className={`${inputCls} h-8 w-36 text-xs`} placeholder="UTR after transfer" value={utr[p.id] ?? ""} onChange={(e) => setUtr({ ...utr, [p.id]: e.target.value })} />
                      <Btn size="sm" variant="primary" disabled={!(utr[p.id] ?? "").trim()} onClick={() => void decide(p, "paid")}>Paid</Btn>
                      {p.status === "requested" && <Btn size="sm" onClick={() => void decide(p, "approved")}>Approve</Btn>}
                      <Btn size="sm" variant="danger" onClick={() => void decide(p, "rejected")}>Reject</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Recently decided" pad={false}>
            <Table head={["Franchise", "Amount", "Status", "UTR", "When"]} minW={560} empty="Nothing yet.">
              {(payouts?.done ?? []).map((p) => <tr key={p.id}><td className={`${td} font-semibold`}>{p.franchise?.code}</td><td className={`${td} tabular-nums`}>{money(p.amount_paise)}</td><td className={td}><Badge tone={p.status === "paid" ? "good" : "danger"}>{p.status}</Badge></td><td className={`${td} font-mono text-xs`}>{p.utr || "—"}</td><td className={`${td} text-xs text-muted`}>{fmtDate(p.paid_at || p.decided_at)}</td></tr>)}
            </Table>
          </Card>
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="New franchise" sub="The code goes in their sign-up link (shubhora.com/start?f=CODE). Short, in capitals, e.g. JAIPUR01." width="max-w-2xl"
        footer={<><Btn onClick={() => setAdding(false)}>Cancel</Btn><Btn variant="primary" loading={busy} disabled={!form.code || !form.name || !form.phone} onClick={() => void create()}>Create franchise</Btn></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Owner's name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Mobile"><input className={inputCls} inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, code: form.code && form.code !== suggestCode(form.city) ? form.code : suggestCode(e.target.value) })} /></Field>
          <Field label="Franchise code" hint="3–16 capital letters / digits. Cannot be changed later."><input className={`${inputCls} font-mono uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) })} /></Field>
          <Field label="Company / firm"><input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          <Field label="E-mail"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
          <Field label="Area / territory"><input className={inputCls} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Jaipur city" /></Field>
          <Field label={`Commission, first payment (%) · default ${settings?.first ?? 20}`}><input type="number" min={0} max={100} step={0.5} className={inputCls} value={form.commission_first_pct} onChange={(e) => setForm({ ...form, commission_first_pct: e.target.value })} placeholder={String(settings?.first ?? 20)} /></Field>
          <Field label={`Commission, renewals (%) · default ${settings?.renewal ?? 10}`}><input type="number" min={0} max={100} step={0.5} className={inputCls} value={form.commission_renewal_pct} onChange={(e) => setForm({ ...form, commission_renewal_pct: e.target.value })} placeholder={String(settings?.renewal ?? 10)} /></Field>
          <div className="sm:col-span-2"><Toggle on={form.can_activate} onChange={(v) => setForm({ ...form, can_activate: v })} label="May activate plans for its users" hint="For payments the franchise takes by hand. Can be changed later." /></div>
        </div>
      </Modal>
      {dialog}
    </div>
  );
}
export default function FranchisesPage() { return <Suspense fallback={<Spinner />}><FranchisesInner /></Suspense>; }
