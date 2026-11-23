// Shubhora Mobile Shop — reports, the pure part (phase 3 of https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd): one period's
// sale, returns, GST by HSN, profit, money in by mode, best-selling items and repair work, plus the CSV files for Excel / the CA
// and the day-close text for WhatsApp. Money in paise. Tested in mobile-reports.test.mjs.
import type { Payment } from "@/lib/jewellery";
import { inRange, istDate, toCsv, type Range } from "@/lib/jewellery-reports";
import { billInputOf, billTotals, isReturnAdjust, type BillRow } from "@/lib/mobile";
import type { JobRow } from "@/lib/mobile-repair";

export type MsHsnRow = { hsn: string; gstBp: number; qty: number; taxable: number; cgst: number; sgst: number; igst: number };
export type MsItemRow = { name: string; qty: number; amount: number; profit: number };
export type MsSaleRow = { day: string; code: string; kind: "sale" | "return"; name: string; phone: string; gstin: string; taxable: number; cgst: number; sgst: number; igst: number; total: number; paid: number; balance: number };
export type MsReport = {
  range: Range; bills: number; qty: number; sale: number; returns: number; net: number;
  taxable: number; cgst: number; sgst: number; igst: number; gst: number; profit: number; udhaarGiven: number;
  money: Record<Payment["mode"], number>; moneyTotal: number;
  hsn: MsHsnRow[]; items: MsItemRow[]; rows: MsSaleRow[]; days: { day: string; sale: number; money: number }[];
  repair: { received: number; delivered: number; income: number };
};
type JobLike = Pick<JobRow, "status" | "payments" | "bill_id" | "created_at" | "delivered_at" | "labour_paise">;

/** bills: every sale and return that was made or took money in the period. jobs: those touched in it. */
export function buildMsReport(bills: BillRow[], jobs: JobLike[], stateCode: string, range: Range): MsReport {
  const r: MsReport = { range, bills: 0, qty: 0, sale: 0, returns: 0, net: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, profit: 0, udhaarGiven: 0,
    money: { cash: 0, upi: 0, card: 0, bank: 0, cheque: 0, other: 0 }, moneyTotal: 0, hsn: [], items: [], rows: [], days: [], repair: { received: 0, delivered: 0, income: 0 } };
  const hsn = new Map<string, MsHsnRow>(), items = new Map<string, MsItemRow>(), days = new Map<string, { day: string; sale: number; money: number }>();
  const dayOf = (d: string) => { let x = days.get(d); if (!x) { x = { day: d, sale: 0, money: 0 }; days.set(d, x); } return x; };
  const cash = (p: Payment, sign: 1 | -1, d: string) => { r.money[p.mode] = (r.money[p.mode] ?? 0) + sign * p.paise; r.moneyTotal += sign * p.paise; dayOf(d).money += sign * p.paise; };
  for (const b of bills) {
    if (b.status === "cancelled" || (b.kind !== "sale" && b.kind !== "return")) continue;
    const made = istDate(b.created_at), sign = b.kind === "return" ? -1 : 1;
    if (inRange(made, range)) {
      const t = billTotals(billInputOf(b), { gstOn: b.gst_on, stateCode });
      if (b.kind === "sale") { r.bills += 1; r.sale += t.total; r.udhaarGiven += Math.max(0, b.balance_paise); } else r.returns += t.total;
      r.qty += sign * t.qty; r.taxable += sign * t.taxable; r.cgst += sign * t.cgst; r.sgst += sign * t.sgst; r.igst += sign * t.igst; r.gst += sign * t.gst; r.profit += sign * t.profit;
      dayOf(made).sale += sign * t.total;
      r.rows.push({ day: made, code: b.code, kind: b.kind, name: b.customer_name, phone: b.customer_phone, gstin: b.customer_gstin, taxable: sign * t.taxable, cgst: sign * t.cgst, sgst: sign * t.sgst, igst: sign * t.igst, total: sign * t.total, paid: b.kind === "sale" ? t.paid : 0, balance: b.kind === "sale" ? Math.max(0, b.balance_paise) : 0 });
      (b.lines ?? []).forEach((l, i) => {
        const a = t.lines[i]; if (!a) return;
        const it = items.get(l.name) ?? { name: l.name, qty: 0, amount: 0, profit: 0 };
        it.qty += sign * l.qty; it.amount += sign * a.net; it.profit += sign * (a.taxable - l.qty * (l.cost || 0)); items.set(l.name, it);
        if (b.gst_on) {
          const k = `${l.hsn}|${l.gstBp}`, h = hsn.get(k) ?? { hsn: l.hsn, gstBp: l.gstBp, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
          const half = Math.floor(a.gst / 2);
          h.qty += sign * l.qty; h.taxable += sign * a.taxable;
          if (t.igst > 0) h.igst += sign * a.gst; else { h.cgst += sign * half; h.sgst += sign * (a.gst - half); }
          hsn.set(k, h);
        }
      });
    }
    if (b.kind === "return") { if (inRange(made, range)) for (const p of b.payments ?? []) if (p.paise > 0) cash(p, -1, made); }
    else for (const p of b.payments ?? []) { const d = p.at ? istDate(p.at) : made; if (p.paise > 0 && !isReturnAdjust(p) && inRange(d, range)) cash(p, 1, d); }
  }
  for (const j of jobs) {
    if (inRange(istDate(j.created_at), range)) r.repair.received += 1;
    if (j.status === "delivered" && j.delivered_at && inRange(istDate(j.delivered_at), range)) { r.repair.delivered += 1; r.repair.income += j.labour_paise || 0; }
    // An advance on a job that has no bill yet is money in the drawer; once billed, the bill carries it.
    if (!j.bill_id) for (const p of j.payments ?? []) { const d = p.at ? istDate(p.at) : ""; if (p.paise > 0 && d && inRange(d, range)) cash(p, 1, d); }
  }
  r.net = r.sale - r.returns;
  r.hsn = [...hsn.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.gstBp - b.gstBp);
  r.items = [...items.values()].filter((i) => i.qty !== 0 || i.amount !== 0).sort((a, b) => b.amount - a.amount);
  r.rows.sort((a, b) => a.day.localeCompare(b.day) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  r.days = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  return r;
}

const rupees = (p: number) => (p / 100).toFixed(2);
export const msSalesCsv = (r: MsReport) => toCsv([["Date", "Bill no", "Type", "Customer", "Mobile", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total", "Received", "Balance"],
  ...r.rows.map((x) => [x.day, x.code, x.kind === "return" ? "Return" : "Sale", x.name, x.phone, x.gstin, rupees(x.taxable), rupees(x.cgst), rupees(x.sgst), rupees(x.igst), rupees(x.total), rupees(x.paid), rupees(x.balance)])]);
export const msHsnCsv = (r: MsReport) => toCsv([["HSN", "GST %", "Qty", "Taxable", "CGST", "SGST", "IGST", "Total tax"],
  ...r.hsn.map((h) => [h.hsn, h.gstBp / 100, h.qty, rupees(h.taxable), rupees(h.cgst), rupees(h.sgst), rupees(h.igst), rupees(h.cgst + h.sgst + h.igst)])]);
export const msItemsCsv = (r: MsReport, withProfit: boolean) => toCsv([["Item", "Qty sold", "Amount", ...(withProfit ? ["Profit"] : [])],
  ...r.items.map((i) => [i.name, i.qty, rupees(i.amount), ...(withProfit ? [rupees(i.profit)] : [])])]);
export const msDaysCsv = (r: MsReport) => toCsv([["Date", "Sale", "Money in"], ...r.days.map((d) => [d.day, rupees(d.sale), rupees(d.money)])]);

export function msCloseText(r: MsReport, shop: string, dueTotal: number, withProfit: boolean): string {
  const rs = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  const when = r.range.from === r.range.to ? r.range.from : `${r.range.from} → ${r.range.to}`;
  return [`📱 ${shop} — ${when}`, `Sale: ${rs(r.net)} (${r.bills} bills, ${r.qty} pcs)${r.returns ? ` · returns ${rs(r.returns)}` : ""}`,
    `Money in: ${rs(r.moneyTotal)} — Cash ${rs(r.money.cash)}, UPI ${rs(r.money.upi)}${r.money.card ? `, Card ${rs(r.money.card)}` : ""}${r.money.other ? `, EMI/Other ${rs(r.money.other)}` : ""}`,
    withProfit ? `Profit: ${rs(r.profit)}` : "", r.repair.received || r.repair.delivered ? `Repair: ${r.repair.received} in, ${r.repair.delivered} given back` : "",
    `Udhaar given: ${rs(r.udhaarGiven)} · total udhaar: ${rs(dueTotal)}`].filter(Boolean).join("\n");
}
