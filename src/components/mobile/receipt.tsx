// The printable mobile-shop bill: a 58 / 80 mm thermal slip or an A5 / A4 sheet (Settings → paper). The same component draws the
// shop's copy and the customer's link (/mb). Cost and profit are never drawn.
import { inr, inWords } from "@/lib/jewellery";
import { billInputOf, billTotals, lineAmounts, type BillRow, type MsSetup } from "@/lib/mobile";

const day = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", cheque: "Cheque", other: "Other" };

export function Receipt({ bill, setup, shop }: { bill: BillRow; setup: MsSetup; shop: string }) {
  const t = billTotals(billInputOf(bill), { gstOn: bill.gst_on, stateCode: setup.stateCode });
  const slip = setup.paper === "58" || setup.paper === "80";
  const width = setup.paper === "58" ? "58mm" : setup.paper === "80" ? "80mm" : setup.paper === "a5" ? "148mm" : "100%";
  const est = bill.kind === "estimate", ret = bill.kind === "return";
  return (
    <article className="ms-doc mx-auto bg-white text-black" style={{ width, maxWidth: "100%", padding: slip ? "3mm" : "8mm", fontSize: slip ? (setup.paper === "58" ? 10 : 11) : 12, fontFamily: "Arial, sans-serif" }}>
      <header className="text-center">
        <h1 style={{ fontSize: slip ? 15 : 20 }} className="font-bold leading-tight">{setup.shopName || shop}</h1>
        {setup.address && <p className="whitespace-pre-line">{setup.address}</p>}
        <p>{[setup.phone && `Ph: ${setup.phone}`, bill.gst_on && setup.gstin && `GSTIN: ${setup.gstin}`].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 border-y border-dashed border-black py-0.5 font-bold uppercase">{est ? "Estimate" : ret ? (bill.gst_on ? "Credit Note" : "Return") : bill.gst_on ? "Tax Invoice" : "Bill"}</p>
      </header>
      <div className="mt-1 flex justify-between gap-2"><span><b>{bill.code}</b></span><span>{day(bill.created_at)}</span></div>
      {(bill.customer_name || bill.customer_phone) && <p>{[bill.customer_name, bill.customer_phone, bill.customer_gstin && `GSTIN ${bill.customer_gstin}`].filter(Boolean).join(" · ")}</p>}
      {bill.status === "cancelled" && <p className="border border-black text-center font-bold">CANCELLED</p>}
      <table className="mt-1 w-full border-collapse">
        <thead><tr className="border-y border-black text-left"><th className="py-0.5">Item</th><th className="pl-2 text-right">Qty</th><th className="pl-2 text-right">Rate</th><th className="pl-2 text-right">Amt</th></tr></thead>
        <tbody>
          {(bill.lines ?? []).map((l, i) => (
            <tr key={i} className="border-b border-dashed border-neutral-400 align-top">
              <td className="py-0.5 pr-1">{l.name}{bill.gst_on && l.hsn ? <span className="opacity-70"> · HSN {l.hsn}</span> : null}
                {l.imei && <span className="block">IMEI {l.imei}</span>}
                {l.warrantyMonths > 0 && <span className="block opacity-80">Warranty {l.warrantyMonths} months</span>}
                {l.discount > 0 && <span className="block opacity-80">Disc − {inr(l.discount)}</span>}</td>
              <td className="pl-2 text-right">{l.qty}</td><td className="whitespace-nowrap pl-2 text-right">{inr(l.price)}</td><td className="whitespace-nowrap pl-2 text-right font-semibold">{inr(lineAmounts(l, false).net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 space-y-0.5">
        {t.billDiscount > 0 && <p className="flex justify-between"><span>Discount</span><span>− {inr(t.billDiscount)}</span></p>}
        {bill.gst_on && <>
          <p className="flex justify-between"><span>Taxable</span><span>{inr(t.taxable, true)}</span></p>
          {t.igst > 0 ? <p className="flex justify-between"><span>IGST</span><span>{inr(t.igst, true)}</span></p> : <><p className="flex justify-between"><span>CGST</span><span>{inr(t.cgst, true)}</span></p><p className="flex justify-between"><span>SGST</span><span>{inr(t.sgst, true)}</span></p></>}
        </>}
        <p className="flex justify-between border-y border-black py-0.5 font-bold" style={{ fontSize: slip ? 13 : 15 }}><span>{est ? "Estimate total" : ret ? "Returned" : "Total"} ({t.qty} pcs)</span><span>{inr(t.total)}</span></p>
        {!est && (bill.payments ?? []).map((p, i) => <p key={i} className="flex justify-between"><span>{ret ? "Given back · " : ""}{MODE[p.mode] ?? p.mode}{p.ref && !ret ? ` (${p.ref})` : ""}</span><span>{inr(p.paise)}</span></p>)}
        {!est && !ret && t.balance > 0 && <p className="flex justify-between font-bold"><span>Balance due</span><span>{inr(t.balance)}</span></p>}
      </div>
      {!slip && <p className="mt-1 italic">{inWords(t.total)}</p>}
      {bill.gst_on && <p className="mt-1 opacity-70">Prices include GST.</p>}
      {bill.notes && <p className="mt-1">Note: {bill.notes}</p>}
      {setup.upi && !est && !ret && <p className="mt-1">UPI: {setup.upi}</p>}
      {setup.terms && <p className="mt-1 whitespace-pre-line opacity-80">{setup.terms}</p>}
      <p className="mt-2 text-center">Thank you 🙏</p>
      <p className="text-center opacity-60" style={{ fontSize: 9 }}>Made with Shubhora · shubhora.com</p>
    </article>
  );
}
