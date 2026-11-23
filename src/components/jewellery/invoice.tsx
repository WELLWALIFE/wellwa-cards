// The printed bill / estimate (A4, or A5 with the page set to A5): used by the shop's app and by the customer's link (/jb/<id>).
// Everything shown is worked out again from the saved lines by billTotals, so the paper and the screen always agree.
import { billInputOf, billTotals, grams, inWords, inr, pct, type BillRow, type JwSetup } from "@/lib/jewellery";

const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", cheque: "Cheque", other: "Other" };

export function Invoice({ bill, setup, shop }: { bill: BillRow; setup: JwSetup; shop: string }) {
  const t = billTotals(billInputOf(bill), setup);
  const est = bill.kind === "estimate";
  const purity = (k: string) => setup.purities.find((p) => p.key === k)?.label ?? k;
  const type = (k: string) => setup.items.find((i) => i.key === k)?.en ?? "";
  const day = new Date(bill.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const th = "border-b border-black/30 px-1.5 py-1 text-left font-semibold";
  const td = "border-b border-black/10 px-1.5 py-1 align-top";
  const r = "text-right tabular-nums sm:whitespace-nowrap print:whitespace-nowrap";
  return (
    <article className="jw-invoice mx-auto w-full max-w-[800px] bg-white p-6 text-[12px] leading-snug text-black print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{setup.shopName || shop}</h1>
          {setup.address && <p className="whitespace-pre-line">{setup.address}</p>}
          <p>{[setup.phone && `Ph: ${setup.phone}`, setup.gstin && `GSTIN: ${setup.gstin}`, setup.bis && `BIS: ${setup.bis}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold uppercase">{est ? "Estimate" : setup.gstBp > 0 || setup.gstMakingBp > 0 ? "Tax Invoice" : "Bill of Supply"}</p>
          <p><b>{bill.code}</b></p>
          <p>{day}</p>
          {est && bill.valid_till && <p>Valid till {new Date(`${bill.valid_till}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>}
          {bill.status === "cancelled" && <p className="mt-1 rounded border border-red-600 px-1 font-bold text-red-600">CANCELLED</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-black/30 py-2">
        <div>
          <p className="text-[10px] uppercase text-black/60">Customer</p>
          <p className="font-semibold">{bill.customer_name || "—"}</p>
          {bill.customer_phone && <p>{bill.customer_phone}</p>}
          {bill.customer_address && <p>{bill.customer_address}</p>}
        </div>
        <div className="text-right">
          {bill.customer_gstin && <p>GSTIN: {bill.customer_gstin}</p>}
          {bill.customer_pan && <p>PAN: {bill.customer_pan.slice(0, 2)}XXXX{bill.customer_pan.slice(6)}</p>}
          {bill.rate_day && <p>Rate of {new Date(`${bill.rate_day}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>}
        </div>
      </section>

      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>#</th><th className={th}>Item</th><th className={th}>HSN</th><th className={`${th} ${r}`}>Gross</th><th className={`${th} ${r}`}>Stone</th><th className={`${th} ${r}`}>Net</th>
            <th className={`${th} ${r}`}>Rate/g</th><th className={`${th} ${r}`}>Metal</th><th className={`${th} ${r}`}>Making</th><th className={`${th} ${r}`}>Stone ₹</th><th className={`${th} ${r}`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((l, i) => {
            const a = t.lines[i];
            return (
              <tr key={i}>
                <td className={td}>{i + 1}</td>
                <td className={td}>
                  <b>{l.desc || type(l.itemType) || "Item"}</b>{l.pieces > 1 ? ` × ${l.pieces}` : ""}<br />
                  <span className="text-black/70">{purity(l.purity)}{l.huid ? ` · HUID ${l.huid}` : ""}{l.tag ? ` · Tag ${l.tag}` : ""}{l.wastageBp ? ` · VA ${pct(l.wastageBp)}` : ""}</span>
                </td>
                <td className={td}>{l.hsn}</td>
                <td className={`${td} ${r}`}>{grams(l.grossMg)}</td>
                <td className={`${td} ${r}`}>{l.stoneMg ? grams(l.stoneMg) : "—"}</td>
                <td className={`${td} ${r}`}>{grams(a.netMg)}</td>
                <td className={`${td} ${r}`}>{inr(l.rate, true)}</td>
                <td className={`${td} ${r}`}>{inr(a.metal + a.wastage, true)}</td>
                <td className={`${td} ${r}`}>{inr(a.making, true)}</td>
                <td className={`${td} ${r}`}>{a.stone + a.other ? inr(a.stone + a.other, true) : "—"}</td>
                <td className={`${td} ${r} font-semibold`}>{inr(a.total, true)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="mt-3 grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <p><b>Total weight:</b> {grams(t.netMg)} net · {grams(t.fineMg)} fine</p>
          {bill.old_gold.length > 0 && (
            <div>
              <p className="font-semibold">Old gold / silver taken</p>
              {bill.old_gold.map((o, i) => (
                <p key={i}>{o.desc || o.metal}: {grams(t.old[i].netMg)} net × {pct(o.touchBp)} = {grams(t.old[i].fineMg)} fine @ {inr(o.rate, true)}/g = <b>{inr(t.old[i].value, true)}</b></p>
              ))}
            </div>
          )}
          {bill.payments.length > 0 && (
            <div>
              <p className="font-semibold">Payments</p>
              {bill.payments.map((p, i) => <p key={i}>{MODE[p.mode] ?? p.mode}{p.ref ? ` (${p.ref})` : ""}: {inr(p.paise, true)}</p>)}
            </div>
          )}
          <p className="italic">{inWords(t.total)}</p>
          {bill.notes && <p>Note: {bill.notes}</p>}
        </div>
        <table className="w-full border-collapse self-start">
          <tbody>
            <tr><td className="py-0.5">Metal, wastage, stones</td><td className={r}>{inr(t.goods, true)}</td></tr>
            <tr><td className="py-0.5">Making charges</td><td className={r}>{inr(t.making, true)}</td></tr>
            {t.discount > 0 && <tr><td className="py-0.5">Discount{bill.discount_on === "making" ? " (on making)" : ""}</td><td className={r}>− {inr(t.discount, true)}</td></tr>}
            <tr><td className="py-0.5">Taxable value</td><td className={r}>{inr(t.taxable, true)}</td></tr>
            {t.igst > 0 ? <tr><td className="py-0.5">IGST</td><td className={r}>{inr(t.igst, true)}</td></tr> : (
              <>
                <tr><td className="py-0.5">CGST</td><td className={r}>{inr(t.cgst, true)}</td></tr>
                <tr><td className="py-0.5">SGST</td><td className={r}>{inr(t.sgst, true)}</td></tr>
              </>
            )}
            {t.roundOff !== 0 && <tr><td className="py-0.5">Round off</td><td className={r}>{t.roundOff > 0 ? "" : "− "}{inr(Math.abs(t.roundOff), true)}</td></tr>}
            <tr className="border-t-2 border-black text-[14px] font-bold"><td className="py-1">{est ? "Estimate total" : "Bill total"}</td><td className={r}>{inr(t.total, true)}</td></tr>
            {t.oldValue > 0 && <tr><td className="py-0.5">Less old gold</td><td className={r}>− {inr(t.oldValue, true)}</td></tr>}
            {t.advance > 0 && <tr><td className="py-0.5">Less advance</td><td className={r}>− {inr(t.advance, true)}</td></tr>}
            {!est && t.paid > 0 && <tr><td className="py-0.5">Paid</td><td className={r}>− {inr(t.paid, true)}</td></tr>}
            {!est && <tr className="font-bold"><td className="py-0.5">{t.balance < 0 ? "To pay the customer" : "Balance due"}</td><td className={r}>{inr(Math.abs(t.balance), true)}</td></tr>}
          </tbody>
        </table>
      </section>

      <footer className="mt-6 grid grid-cols-2 gap-6 border-t border-black/30 pt-2 text-[10.5px]">
        <div>
          {setup.bank && <p className="whitespace-pre-line"><b>Bank / UPI:</b> {setup.bank}</p>}
          <p className="mt-1 whitespace-pre-line text-black/70">{setup.terms}</p>
        </div>
        <div className="flex flex-col items-end justify-end">
          <p className="mt-8 border-t border-black px-6 pt-1">For {setup.shopName || shop}</p>
        </div>
      </footer>
      <p className="mt-3 text-center text-[9px] text-black/50">Made with Shubhora · shubhora.com</p>
    </article>
  );
}
