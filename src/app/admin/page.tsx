"use client";
// The dashboard (Admin v2): the platform today — users, money, franchises, payouts, the server — or, for a franchise login,
// their own users, earnings and payouts. Real numbers from /api/admin/v2/dashboard.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CreditCard, IndianRupee, ScrollText, Server, Store, TrendingUp, Users, Wallet } from "lucide-react";
import { adminApi, ago, fmtDate, useAdminMe } from "@/lib/admin-client";
import { Badge, Card, Delta, ErrorBox, PageHeader, Spinner, Stat, Table, money, td } from "@/components/admin/ui";

type Newest = { id: string; full_name: string | null; username: string | null; plan: string; saas_tier: string | null; created_at: string; franchise?: string };
type Platform = {
  kind: "platform";
  users: { total: number; today: number; week: number; month: number; lastMonth: number; paid: number; paidSaas: number; paidGiven: number };
  revenue: { month: number; lastMonth: number; mrr: number; byTier: Record<string, number> };
  franchises: { active: number; total: number }; payouts: { requested: number; approved: number };
  newest: Newest[]; audit: { id: number; at: string; actor_email: string; action: string; target_type: string; target_label: string }[];
  health: { load: number[]; cpus: number; mem: { total: number; used: number }; disk: { total: number; free: number } | null; uptime: number; appUptime: number; node: string; bridge: string } | null;
  rights: { audit: boolean; system: boolean; billing: boolean; franchises: boolean };
};
type Franchise = {
  kind: "franchise"; franchise: { code: string; name: string; status: string; commission_first_pct: number; commission_renewal_pct: number } | null;
  users: { total: number; thisMonth: number; week: number; paid: number }; newest: Newest[];
  payouts: { id: string; amount_paise: number; status: string; utr: string; requested_at: string; paid_at: string | null }[];
  balance: { earned: number; paid: number; balance: number; pending: number; thisMonth: number };
};
const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
const days = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} m`);
const planOf = (u: Newest) => (u.saas_tier && u.saas_tier !== "none" ? u.saas_tier : u.plan && u.plan !== "free" ? u.plan : "free");

export default function AdminDashboard() {
  const { me } = useAdminMe();
  const [d, setD] = useState<Platform | Franchise | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { (async () => {
    const r = await adminApi<Platform | Franchise>("/api/admin/v2/dashboard");
    if (r.ok) setD(r.data); else setErr(r.data.error || "Could not load the dashboard.");
  })(); }, []);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!d) return <Spinner />;

  if (d.kind === "franchise") {
    const f = d.franchise;
    return (
      <div className="space-y-6">
        <PageHeader title={`${hello}, ${me?.name?.split(" ")[0] ?? ""}`} sub={f ? <>Franchise <b>{f.code}</b> · {f.name} · {f.status === "active" ? <Badge tone="good" dot>Active</Badge> : <Badge tone="warn">{f.status}</Badge>}</> : "Your franchise"} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="My users" value={d.users.total} hint={`${d.users.thisMonth} new this month · ${d.users.week} this week`} icon={Users} href="/admin/users" />
          <Stat label="On a paid plan" value={d.users.paid} hint={`${d.users.total ? Math.round((d.users.paid / d.users.total) * 100) : 0}% of my users`} icon={TrendingUp} tone="good" />
          <Stat label="Earned this month" value={money(d.balance.thisMonth)} hint={`Total earned ${money(d.balance.earned)}`} icon={IndianRupee} tone="good" href="/admin/earnings" />
          <Stat label="Balance" value={money(d.balance.balance)} hint={d.balance.pending ? `${money(d.balance.pending)} payout in process` : "Ask for a payout under My earnings"} icon={Wallet} tone="brand" href="/admin/earnings" />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Newest users" className="lg:col-span-2" pad={false} actions={<Link href="/admin/users" className="text-xs font-semibold text-brand-ink">All users →</Link>}>
            <Table head={["User", "Plan", "Joined"]} minW={420} empty="No users yet — share your link from My earnings.">
              {d.newest.map((u) => (
                <tr key={u.id} className="hover:bg-surface2/50">
                  <td className={td}><Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-brand-ink">{u.full_name || u.username || "User"}</Link>{u.username && <span className="ml-1 text-xs text-muted">@{u.username}</span>}</td>
                  <td className={td}><Badge tone={planOf(u) === "free" ? "neutral" : "good"}>{planOf(u)}</Badge></td>
                  <td className={`${td} text-muted`}>{ago(u.created_at)}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Payouts" pad={false} actions={<Link href="/admin/earnings" className="text-xs font-semibold text-brand-ink">Earnings →</Link>}>
            <Table head={["Amount", "Status", "When"]} minW={300} empty="No payouts yet.">
              {d.payouts.map((p) => (
                <tr key={p.id}><td className={`${td} font-semibold`}>{money(p.amount_paise)}</td><td className={td}><Badge tone={p.status === "paid" ? "good" : p.status === "rejected" ? "danger" : "warn"}>{p.status}</Badge></td><td className={`${td} text-muted`}>{fmtDate(p.paid_at || p.requested_at)}</td></tr>
              ))}
            </Table>
          </Card>
        </div>
      </div>
    );
  }

  const h = d.health;
  const memPct = h ? Math.round((h.mem.used / h.mem.total) * 100) : 0;
  const diskPct = h?.disk ? Math.round(((h.disk.total - h.disk.free) / h.disk.total) * 100) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title={`${hello}, ${me?.name?.split(" ")[0] ?? ""}`} sub="Everything on Shubhora, right now." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Stat label="Users" value={d.users.total.toLocaleString("en-IN")} hint={<>+{d.users.today} today · +{d.users.week} this week · <Delta now={d.users.month} before={d.users.lastMonth} /></>} icon={Users} href="/admin/users" />
        <Stat label="Paid plans" value={d.users.paid} hint={`${d.users.paidSaas} subscribed · ${d.users.paidGiven} given by admin`} icon={TrendingUp} tone="good" />
        {d.rights.billing && <Stat label="Revenue this month" value={money(d.revenue.month)} hint={<Delta now={d.revenue.month} before={d.revenue.lastMonth} />} icon={IndianRupee} tone="good" />}
        {d.rights.billing && <Stat label="MRR" value={money(d.revenue.mrr)} hint={Object.entries(d.revenue.byTier).map(([t, n]) => `${n} ${t}`).join(" · ") || "no running subscriptions"} icon={CreditCard} tone="brand" />}
        {d.rights.franchises && <Stat label="Franchises" value={d.franchises.active} hint={`${d.franchises.total} in all`} icon={Store} tone="violet" href="/admin/franchises" />}
        {d.rights.franchises && <Stat label="Payouts waiting" value={d.payouts.requested + d.payouts.approved} hint={`${d.payouts.requested} to decide · ${d.payouts.approved} approved, to pay`} icon={Wallet} tone={d.payouts.requested ? "warn" : "neutral"} href="/admin/franchises?tab=payouts" />}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Newest sign-ups" className="lg:col-span-2" pad={false} actions={<Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-ink">All users <ArrowUpRight className="h-3 w-3" /></Link>}>
          <Table head={["User", "Plan", "Franchise", "Joined"]} minW={520} empty="No sign-ups yet.">
            {d.newest.map((u) => (
              <tr key={u.id} className="hover:bg-surface2/50">
                <td className={td}><Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-brand-ink">{u.full_name || u.username || "User"}</Link>{u.username && <span className="ml-1 text-xs text-muted">@{u.username}</span>}</td>
                <td className={td}><Badge tone={planOf(u) === "free" ? "neutral" : "good"}>{planOf(u)}</Badge></td>
                <td className={`${td} text-muted`}>{u.franchise || "—"}</td>
                <td className={`${td} text-muted`}>{ago(u.created_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <div className="space-y-5">
          {h && (
            <Card title={<span className="flex items-center gap-2"><Server className="h-4 w-4 text-brand" /> Server</span>} actions={<Link href="/admin/system" className="text-xs font-semibold text-brand-ink">Details →</Link>}>
              <div className="space-y-3 text-sm">
                <Meter label="RAM" pct={memPct} right={`${gb(h.mem.used)} / ${gb(h.mem.total)}`} />
                {h.disk && <Meter label="Disk" pct={diskPct} right={`${gb(h.disk.total - h.disk.free)} / ${gb(h.disk.total)}`} />}
                <Meter label={`CPU load (${h.cpus} cores)`} pct={Math.min(100, Math.round((h.load[0] / h.cpus) * 100))} right={h.load.join(" · ")} />
                <div className="flex items-center justify-between text-xs text-muted"><span>WhatsApp bridge</span>{h.bridge === "up" ? <Badge tone="good" dot>running</Badge> : h.bridge === "down" ? <Badge tone="danger" dot>down</Badge> : <Badge>unknown</Badge>}</div>
                <div className="flex items-center justify-between text-xs text-muted"><span>Up for</span><span>{days(h.uptime)} · app {days(h.appUptime)}</span></div>
              </div>
            </Card>
          )}
          {d.rights.audit && (
            <Card title={<span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-brand" /> Latest admin actions</span>} actions={<Link href="/admin/audit" className="text-xs font-semibold text-brand-ink">Audit log →</Link>} pad={false}>
              <ul className="divide-y divide-border">
                {d.audit.length === 0 && <li className="px-5 py-6 text-center text-xs text-muted">Nothing recorded yet.</li>}
                {d.audit.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-xs">
                    <span className="font-semibold text-ink">{a.actor_email || "system"}</span> <span className="text-muted">{a.action}</span>{a.target_label && <span className="text-muted"> · {a.target_label}</span>}
                    <span className="block text-[11px] text-faint">{ago(a.at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {!h && !d.rights.audit && <p className="flex items-center gap-2 text-xs text-muted"><Activity className="h-3.5 w-3.5" /> Ask the Super Admin for the System health and Audit log rights to see more here.</p>}
    </div>
  );
}
function Meter({ label, pct, right }: { label: string; pct: number; right: string }) {
  const tone = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="text-muted">{label}</span><span className="tabular-nums text-ink">{right} <span className="text-muted">({pct}%)</span></span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}
