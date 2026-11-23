"use client";
// One bill in a list: customer, number, time, total and its state (paid, due, estimate, cancelled).
import Link from "next/link";
import { inr, type BillRow } from "@/lib/jewellery";

export function BillRowLink({ b, hi, q }: { b: BillRow; hi: boolean; q: string }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const tone = b.status === "cancelled" ? "bg-red-100 text-red-700" : b.status === "converted" ? "bg-slate-100 text-slate-600" : b.kind === "estimate" ? "bg-blue-100 text-blue-800" : b.balance_paise > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  const label = b.status === "cancelled" ? T("Cancelled", "रद्द") : b.status === "converted" ? T("Billed", "बिल बना") : b.kind === "estimate" ? T("Estimate", "Estimate") : b.balance_paise > 0 ? T(`Due ${inr(b.balance_paise)}`, `बाकी ${inr(b.balance_paise)}`) : T("Paid", "भुगतान पूरा");
  return (
    <Link href={`/poster/jewellery/bill/${b.id}${q}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm">{b.customer_name || T("Walk-in customer", "ग्राहक")} <span className="font-normal text-muted">· {b.code}</span></b>
        <span className="block text-[11px] text-muted">{new Date(b.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{b.created_by_name ? ` · ${b.created_by_name}` : ""}</span>
      </span>
      <span className="text-right"><b className="block text-sm tabular-nums">{inr(b.total_paise)}</b><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{label}</span></span>
    </Link>
  );
}
