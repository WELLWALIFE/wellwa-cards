"use client";
// Admin v2 → Payment links (owner, 1 Nov 2026): every payment request — open, paid, cancelled — with its link, and "New link" for any
// user (search by name / mobile / username). A franchise sees its own users' links only (the API applies the scope).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Plus, Search, XCircle } from "lucide-react";
import { adminApi, ago, fmtDate } from "@/lib/admin-client";
import { Badge, Btn, Card, CopyBtn, Empty, ErrorBox, PageHeader, Spinner, Table, Tabs, inputCls, td, toast, useConfirm } from "@/components/admin/ui";
import { PaymentRequestModal, type Made } from "@/components/admin/payment-request";
import { rupeesOf } from "@/lib/payments";

type Row = Made & { user: { name: string; username: string } };
type Hit = { type: string; id: string; title: string; sub: string };

export default function PaymentsPage() {
  const [tab, setTab] = useState<"open" | "paid" | "cancelled">("open");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirm, dialog] = useConfirm();
  const load = useCallback(async () => {
    const r = await adminApi<{ requests: Row[] }>(`/api/admin/v2/payments?status=${tab}`);
    if (r.ok) { setRows(r.data.requests); setErr(""); } else setErr(r.data.error || "Could not load.");
  }, [tab]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  useEffect(() => {
    if (!pickOpen || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => { const r = await adminApi<{ hits: Hit[] }>(`/api/admin/v2/search?q=${encodeURIComponent(q.trim())}`); if (r.ok) setHits(r.data.hits.filter((h) => h.type === "user")); }, 250);
    return () => clearTimeout(t);
  }, [q, pickOpen]);
  async function cancel(r: Row) {
    if (!(await confirm({ title: "Cancel this payment link?", body: `${r.user.name} · ${r.label} · ${rupeesOf(r.amount_paise)}. The link stops working.`, danger: true, ok: "Cancel link" }))) return;
    const x = await adminApi("/api/admin/v2/payments", { method: "PATCH", json: { id: r.id, op: "cancel" } });
    if (x.ok) { toast("Cancelled."); void load(); } else toast(x.data.error || "Could not cancel.", "err");
  }
  return (
    <div className="space-y-5">
      {dialog}
      <PageHeader title="Payment links" sub="A payment at any agreed amount — a plan for N months, an advance, or a custom item. Paid links apply by themselves."
        actions={<Btn variant="primary" icon={Plus} onClick={() => { setPickOpen(true); setQ(""); }}>New link</Btn>} />
      {pickOpen && (
        <Card title="Who is paying?" actions={<Btn size="sm" onClick={() => setPickOpen(false)}>Close</Btn>}>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} pl-9`} placeholder="Name, mobile, username or business…" /></div>
          {hits.length > 0 && (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setTarget({ id: h.id, name: h.title }); setPickOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface2"><span><b>{h.title}</b>{h.sub && <span className="ml-2 text-xs text-muted">{h.sub}</span>}</span><Link2 className="h-4 w-4 text-muted" /></button></li>)}
            </ul>
          )}
          {q.trim().length >= 2 && hits.length === 0 && <p className="mt-2 text-xs text-muted">No user found.</p>}
        </Card>
      )}
      <PaymentRequestModal user={target} onClose={() => setTarget(null)} onMade={() => { setTab("open"); void load(); }} />
      <Tabs tabs={[{ key: "open", label: "Open" }, { key: "paid", label: "Paid" }, { key: "cancelled", label: "Cancelled" }]} value={tab} onChange={setTab} />
      {err && <ErrorBox>{err}</ErrorBox>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={Link2} title={tab === "open" ? "No open payment links" : `No ${tab} links`} sub="Make one with New link, or from a user's row on the Users page." /> : (
        <Card pad={false}>
          <Table head={["User", "For", "Amount", "By", tab === "paid" ? "Paid" : "Made", ""]} minW={760}>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface2/50">
                <td className={td}><Link href={`/admin/users/${r.owner_id}`} className="font-semibold hover:text-brand-ink">{r.user.name || "User"}</Link>{r.user.username && <span className="ml-1 text-xs text-muted">@{r.user.username}</span>}</td>
                <td className={td}><span className="font-medium">{r.label}</span>{r.note && <span className="block text-xs text-muted">{r.note}</span>}<span className="block font-mono text-[11px] text-faint">/pay/{r.code}</span></td>
                <td className={`${td} font-semibold tabular-nums`}>{rupeesOf(r.amount_paise)}</td>
                <td className={td}><Badge tone={r.created_role === "self" ? "neutral" : r.created_role === "franchise" ? "violet" : "brand"}>{r.created_role === "self" ? "user" : r.created_role}</Badge></td>
                <td className={`${td} text-muted`}>{tab === "paid" ? fmtDate(r.paid_at, true) : ago(r.created_at)}</td>
                <td className={`${td} text-right`}>
                  {r.status === "open" && <span className="inline-flex items-center gap-1"><CopyBtn text={r.link} label="Copy link" /><button type="button" onClick={() => cancel(r)} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger" title="Cancel"><XCircle className="h-4 w-4" /></button></span>}
                  {r.status === "paid" && r.payment_id && <span className="font-mono text-[11px] text-faint">{r.payment_id}</span>}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
