// One bill in a list (home, all bills).
import Link from "next/link";
import { inr } from "@/lib/jewellery";
import type { BillRow } from "@/lib/mobile";

export function BillLink({ b, hi, q }: { b: BillRow; hi: boolean; q: string }) {
  const when = new Date(b.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <Link href={`/poster/mobile/bill/${b.id}${q}`} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-2.5">
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{b.customer_name || (hi ? "नकद ग्राहक" : "Walk-in")} <span className="font-normal text-muted">· {b.code}</span></span><span className="block truncate text-[11px] text-muted">{when} · {(b.lines ?? []).map((l) => l.name).join(", ")}</span></span>
      <span className="shrink-0 text-right"><span className="block text-sm font-bold tabular-nums">{inr(b.total_paise)}</span>
        <span className={`text-[11px] font-semibold ${b.status === "cancelled" ? "text-muted" : b.kind === "sale" && b.balance_paise > 0 ? "text-danger" : "text-good"}`}>{b.status === "cancelled" ? (hi ? "रद्द" : "Cancelled") : b.kind === "estimate" ? (b.status === "converted" ? (hi ? "बिल बना" : "Billed") : "Estimate") : b.balance_paise > 0 ? `${hi ? "बाकी" : "Due"} ${inr(b.balance_paise)}` : (hi ? "पूरा" : "Paid")}</span></span>
    </Link>
  );
}
