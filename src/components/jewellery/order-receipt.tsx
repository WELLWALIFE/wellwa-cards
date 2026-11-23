// The order / repair receipt (the customer's copy: printed at the counter and the WhatsApp link /jo/<id>). For a repair it carries
// the weight of the customer's piece when received — proof for both sides.
import { grams, inr, type JwSetup } from "@/lib/jewellery";
import { ORDER_STATUSES, orderPaid, type OrderRow } from "@/lib/jewellery-orders";

const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", cheque: "Cheque", other: "Other" };

export function OrderReceipt({ order: o, setup, shop }: { order: OrderRow; setup: JwSetup; shop: string }) {
  const repair = o.kind === "repair";
  const purity = (k: string) => setup.purities.find((p) => p.key === k)?.label ?? k;
  const type = (k: string) => setup.items.find((i) => i.key === k)?.en ?? "";
  const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const paid = orderPaid(o);
  const status = ORDER_STATUSES.find((s) => s.key === o.status)?.en ?? o.status;
  const th = "border-b border-black/30 px-1.5 py-1 text-left font-semibold";
  const td = "border-b border-black/10 px-1.5 py-1 align-top";
  return (
    <article className="jw-invoice mx-auto w-full max-w-[800px] bg-white p-6 text-[12px] leading-snug text-black print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{setup.shopName || shop}</h1>
          {setup.address && <p className="whitespace-pre-line">{setup.address}</p>}
          <p>{[setup.phone && `Ph: ${setup.phone}`, setup.gstin && `GSTIN: ${setup.gstin}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold uppercase">{repair ? "Repair receipt" : "Order receipt"}</p>
          <p><b>{o.code}</b></p>
          <p>{day(o.created_at)}</p>
          <p className={`mt-1 inline-block rounded border px-1 font-bold ${o.status === "cancelled" ? "border-red-600 text-red-600" : "border-black"}`}>{status.toUpperCase()}</p>
        </div>
      </header>
      <section className="mt-3 flex flex-wrap justify-between gap-2">
        <div><p className="text-[10px] uppercase text-black/60">Customer</p><p className="font-semibold">{o.customer_name || "—"}</p>{o.customer_phone && <p>{o.customer_phone}</p>}</div>
        {o.due_date && <div className="text-right"><p className="text-[10px] uppercase text-black/60">{repair ? "Ready by" : "Delivery by"}</p><p className="font-semibold">{day(o.due_date)}</p></div>}
      </section>
      <table className="mt-3 w-full border-collapse">
        <thead><tr><th className={th}>#</th><th className={th}>Item</th><th className={th}>Purity</th><th className={`${th} text-right`}>{repair ? "Weight received" : "Approx. weight"}</th><th className={th}>Size</th><th className={th}>{repair ? "Work" : "Details"}</th></tr></thead>
        <tbody>{o.items.map((i, k) => (
          <tr key={k}><td className={td}>{k + 1}</td><td className={td}><b>{i.desc || type(i.itemType) || "Item"}</b>{i.pieces > 1 ? ` × ${i.pieces}` : ""}</td><td className={td}>{i.purity ? purity(i.purity) : "—"}</td><td className={`${td} text-right tabular-nums`}>{i.weightMg ? grams(i.weightMg) : "—"}</td><td className={td}>{i.size || "—"}</td><td className={td}>{i.work || "—"}</td></tr>
        ))}</tbody>
      </table>
      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          {o.rate_lock && <p><b>Rate locked:</b> {purity(o.rate_lock.purity)} @ {inr(o.rate_lock.rate * 10)} / 10 g{o.rate_lock.day ? ` (rate of ${day(o.rate_lock.day)})` : ""}</p>}
          {o.payments.length > 0 && <div><p className="font-semibold">Advance</p>{o.payments.map((p, k) => <p key={k}>{day(p.at)} · {MODE[p.mode] ?? p.mode}{p.ref ? ` (${p.ref})` : ""}: {inr(p.paise, true)}</p>)}</div>}
          {o.notes && <p className="whitespace-pre-line"><b>Note:</b> {o.notes}</p>}
        </div>
        <div className="space-y-1 sm:text-right">
          {o.est_paise > 0 && <p>{repair ? "Repair charge" : "Estimate"}: <b>{inr(o.est_paise)}</b></p>}
          <p>Advance paid: <b>{inr(paid, true)}</b></p>
          {repair && o.est_paise > 0 && <p>Balance: <b>{inr(Math.max(0, o.est_paise - paid), true)}</b></p>}
          {!repair && <p className="text-[11px] text-black/60">The final bill is made at delivery on the actual weight{o.rate_lock ? " at the locked rate" : " at that day's rate"}, with GST; the advance is adjusted in it.</p>}
        </div>
      </section>
      {o.status === "cancelled" && o.cancel_reason && <p className="mt-2 font-semibold text-red-600">Cancelled: {o.cancel_reason}</p>}
      <footer className="mt-6 flex items-end justify-between gap-4 border-t border-black/30 pt-3 text-[11px]">
        <p className="max-w-[60%] text-black/70">Please bring this receipt when you collect.{repair ? " Weight noted above was checked in front of the customer." : ""}</p>
        <p className="text-right">For {setup.shopName || shop}<br /><br />______________</p>
      </footer>
      <p className="mt-3 text-center text-[10px] text-black/50 print:hidden">Made with Shubhora · shubhora.com</p>
    </article>
  );
}
