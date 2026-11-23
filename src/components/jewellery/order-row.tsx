"use client";
// One order or repair in a list: customer, number, what, the date it is due (red when late), the karigar and its state.
import Link from "next/link";
import { inr } from "@/lib/jewellery";
import { ORDER_STATUSES, orderPaid, overdue, type OrderRow } from "@/lib/jewellery-orders";

const TONE: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800", karigar: "bg-violet-100 text-violet-800", ready: "bg-emerald-100 text-emerald-800",
  delivered: "bg-slate-100 text-slate-600", cancelled: "bg-red-100 text-red-700",
};

export function OrderRowLink({ o, hi, q, today, karigar }: { o: OrderRow; hi: boolean; q: string; today: string; karigar?: string }) {
  const T = (en: string, h: string) => (hi ? h : en);
  const st = ORDER_STATUSES.find((s) => s.key === o.status);
  const late = overdue(o, today);
  const what = o.items.map((i) => i.desc).filter(Boolean).slice(0, 2).join(", ");
  const paid = orderPaid(o);
  return (
    <Link href={`/poster/jewellery/order/${o.id}${q}`} className={`flex items-center gap-3 rounded-2xl border bg-surface p-3 ${late ? "border-red-300" : "border-border"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2 text-lg">{o.kind === "repair" ? "🔧" : "💍"}</span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm">{o.customer_name || o.customer_phone || T("Customer", "ग्राहक")} <span className="font-normal text-muted">· {o.code}</span></b>
        <span className="block truncate text-[11px] text-muted">{[what, karigar && `👷 ${karigar}`].filter(Boolean).join(" · ")}</span>
        {o.due_date && <span className={`block text-[11px] ${late ? "font-bold text-danger" : "text-muted"}`}>{late ? T("Late · was due ", "देर · तारीख़ थी ") : T("Due ", "तारीख़ ")}{new Date(`${o.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
      </span>
      <span className="text-right">
        {paid > 0 && <b className="block text-xs tabular-nums">{T("Adv", "एडवांस")} {inr(paid)}</b>}
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[o.status] ?? ""}`}>{st ? (hi ? st.hi : st.en) : o.status}</span>
      </span>
    </Link>
  );
}
