"use client";
// Franchise leaderboard + tree (owner, 6 Nov 2026, Phase 3): one month — new users, payments, sales (amount without GST) against the
// monthly target, and earnings. Main franchises are ranked; each one's sub-franchises sit under it, and the main row shows team totals.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { adminApi } from "@/lib/admin-client";
import { Badge, Card, ErrorBox, Spinner, Table, inputCls, money, td } from "@/components/admin/ui";

type Row = { id: string; code: string; name: string; city: string; status: string; parent_id: string | null; target_paise: number; newUsers: number; payments: number; sales: number; earned: number; override: number };
const thisMonth = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

export function Progress({ value, target }: { value: number; target: number }) {
  if (!target) return <span className="text-[11px] text-faint">no target</span>;
  const p = Math.round((value / target) * 100);
  return (
    <div className="min-w-[110px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : p >= 50 ? "bg-brand" : "bg-amber-500"}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
      <div className="mt-0.5 text-[11px] text-muted">{p}% of {money(target)}</div>
    </div>
  );
}

export function FranchiseBoard({ link = true, title = "Leaderboard" }: { link?: boolean; title?: string }) {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState("");
  useEffect(() => { setRows(null); void (async () => { const r = await adminApi<{ rows: Row[] }>(`/api/admin/v2/franchises?board=${month}`); if (!r.ok) setErr(r.data.error || "Could not load."); else { setErr(""); setRows(r.data.rows); } })(); }, [month]);
  if (err) return <ErrorBox>{err}</ErrorBox>;
  const all = rows ?? [];
  const subsOf = (id: string) => all.filter((r) => r.parent_id === id);
  // A main franchise counts its team (itself + subs) for ranking and target; a sub whose parent is not in the list stands alone.
  const team = (r: Row) => { const t = [r, ...subsOf(r.id)]; return { newUsers: t.reduce((a, x) => a + x.newUsers, 0), payments: t.reduce((a, x) => a + x.payments, 0), sales: t.reduce((a, x) => a + x.sales, 0) }; };
  const tops = all.filter((r) => !r.parent_id || !all.some((p) => p.id === r.parent_id)).sort((a, b) => team(b).sales - team(a).sales || team(b).newUsers - team(a).newUsers);
  const name = (r: Row) => (link ? <Link href={`/admin/franchises/${r.id}`} className="font-semibold text-brand-ink hover:underline">{r.code}</Link> : <b>{r.code}</b>);
  return (
    <Card title={<span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-amber-500" /> {title}</span>} sub="Sales = what their users paid, without GST. A main franchise's row counts its sub-franchises too (team)." pad={false}
      actions={<select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} h-8 w-36 text-xs`}>{lastMonths(12).map((m) => <option key={m} value={m}>{new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</option>)}</select>}>
      {rows === null ? <Spinner /> : (
        <Table head={["#", "Franchise", "New users", "Payments", "Sales", "Target", "Earned", "Override"]} minW={860} empty="No franchise yet.">
          {tops.flatMap((r, i) => {
            const t = team(r); const subs = subsOf(r.id);
            return [
              <tr key={r.id} className="hover:bg-surface2/50">
                <td className={`${td} font-bold tabular-nums ${i < 3 ? "text-amber-600" : "text-muted"}`}>{i + 1}</td>
                <td className={td}>{name(r)} <span className="text-xs text-muted">{r.name}{r.city ? ` · ${r.city}` : ""}</span>{subs.length > 0 && <Badge tone="violet">{subs.length} sub</Badge>}{r.status !== "active" && <Badge tone="warn">{r.status}</Badge>}</td>
                <td className={`${td} tabular-nums`}>{t.newUsers}</td>
                <td className={`${td} tabular-nums`}>{t.payments}</td>
                <td className={`${td} font-semibold tabular-nums`}>{money(t.sales)}</td>
                <td className={td}><Progress value={t.sales} target={r.target_paise} /></td>
                <td className={`${td} tabular-nums text-emerald-700`}>{money(r.earned)}</td>
                <td className={`${td} tabular-nums text-emerald-700`}>{r.override ? money(r.override) : "—"}</td>
              </tr>,
              ...subs.sort((a, b) => b.sales - a.sales).map((s) => (
                <tr key={s.id} className="bg-surface2/30">
                  <td className={td} />
                  <td className={`${td} pl-8`}><span className="mr-1 text-faint">└</span>{name(s)} <span className="text-xs text-muted">{s.name}{s.city ? ` · ${s.city}` : ""}</span>{s.status !== "active" && <Badge tone="warn">{s.status}</Badge>}</td>
                  <td className={`${td} tabular-nums text-xs`}>{s.newUsers}</td>
                  <td className={`${td} tabular-nums text-xs`}>{s.payments}</td>
                  <td className={`${td} tabular-nums text-xs`}>{money(s.sales)}</td>
                  <td className={td}><Progress value={s.sales} target={s.target_paise} /></td>
                  <td className={`${td} tabular-nums text-xs text-emerald-700`}>{money(s.earned)}</td>
                  <td className={td} />
                </tr>
              )),
            ];
          })}
        </Table>
      )}
    </Card>
  );
}
