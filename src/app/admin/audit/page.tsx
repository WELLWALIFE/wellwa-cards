"use client";
// The audit log (Admin v2): every admin action — who, when, what, on whom, before → after.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { adminApi, fmtDate } from "@/lib/admin-client";
import { Badge, Btn, Card, ErrorBox, Modal, PageHeader, Table, inputCls, td } from "@/components/admin/ui";

type Row = { id: number; at: string; actor_id: string | null; actor_email: string; actor_role: string; action: string; target_type: string; target_id: string; target_label: string; before: unknown; after: unknown; note: string; ip: string };
const tone = (a: string) => (/delete|remove|block|reject|reset/.test(a) ? "danger" : /create|unblock|paid|approved|on$/.test(a) ? "good" : /login/.test(a) ? "neutral" : "brand");
const link = (r: Row) => (r.target_type === "user" && r.target_id ? `/admin/users/${r.target_id}` : r.target_type === "franchise" ? `/admin/franchises/${r.target_id}` : r.target_type === "staff" ? "/admin/staff" : "");

export default function AuditPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [f, setF] = useState({ q: "", action: "", type: "", from: "", to: "" });
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const load = useCallback(async (p = 0) => {
    const qs = new URLSearchParams({ page: String(p), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    const r = await adminApi<{ rows: Row[]; more: boolean }>(`/api/admin/v2/audit?${qs}`);
    if (!r.ok) { setErr(r.data.error || "Could not load."); setRows([]); return; }
    setRows(r.data.rows); setMore(r.data.more); setPage(p); setErr("");
  }, [f]);
  useEffect(() => { const t = setTimeout(() => void load(0), 300); return () => clearTimeout(t); }, [load]);
  const exportCsv = () => {
    if (!rows) return;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["at,actor,role,action,target_type,target_id,target_label,note,ip", ...rows.map((r) => [r.at, r.actor_email, r.actor_role, r.action, r.target_type, r.target_id, r.target_label, r.note, r.ip].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" sub="Everything done in this panel, newest first. Lines are never edited or deleted." actions={<Btn icon={Download} onClick={exportCsv} disabled={!rows?.length}>Export this page</Btn>} />
      <Card pad={false}>
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-5">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 sm:col-span-2"><Search className="h-4 w-4 text-muted" /><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search person, target, note…" className="h-9 flex-1 bg-transparent text-sm outline-none" /></label>
          <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">Any target</option>{["user", "franchise", "staff", "payout", "setting"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <input type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <input type="date" className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </div>
        {err && <div className="p-4"><ErrorBox>{err}</ErrorBox></div>}
        <Table head={["When", "Who", "Action", "Target", "Note", ""]} loading={rows === null} minW={820} empty="No actions match.">
          {(rows ?? []).map((r) => (
            <tr key={r.id} className="hover:bg-surface2/50">
              <td className={`${td} whitespace-nowrap text-xs text-muted`}>{fmtDate(r.at, true)}</td>
              <td className={td}><p className="text-xs font-semibold text-ink">{r.actor_email || "system"}</p><p className="text-[11px] text-muted">{r.actor_role}{r.ip ? ` · ${r.ip}` : ""}</p></td>
              <td className={td}><Badge tone={tone(r.action)}>{r.action}</Badge></td>
              <td className={`${td} text-xs`}>{link(r) ? <Link href={link(r)} className="font-semibold text-brand-ink hover:underline">{r.target_label || r.target_id.slice(0, 8)}</Link> : <span>{r.target_label || r.target_id}</span>}{r.target_type && <span className="ml-1 text-muted">({r.target_type})</span>}</td>
              <td className={`${td} max-w-[240px] truncate text-xs text-muted`} title={r.note}>{r.note}</td>
              <td className={`${td} text-right`}>{(r.before !== null && r.before !== undefined) || (r.after !== null && r.after !== undefined) ? <Btn size="sm" variant="ghost" onClick={() => setOpen(r)}>Details</Btn> : null}</td>
            </tr>
          ))}
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted">
          <span>Page {page + 1}</span>
          <div className="flex gap-2"><Btn size="sm" disabled={page === 0} onClick={() => void load(page - 1)}>Previous</Btn><Btn size="sm" disabled={!more} onClick={() => void load(page + 1)}>Next</Btn></div>
        </div>
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.action ?? ""} sub={open ? `${open.actor_email} · ${fmtDate(open.at, true)}` : ""} width="max-w-2xl">
        {open && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="mb-1 text-xs font-semibold text-muted">Before</p><pre className="max-h-72 overflow-auto rounded-xl bg-bg p-3 text-[11px]">{JSON.stringify(open.before ?? null, null, 2)}</pre></div>
            <div><p className="mb-1 text-xs font-semibold text-muted">After</p><pre className="max-h-72 overflow-auto rounded-xl bg-bg p-3 text-[11px]">{JSON.stringify(open.after ?? null, null, 2)}</pre></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
