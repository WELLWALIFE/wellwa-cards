// Shubhora Mobile Shop — reports, the pure part (phase 3 of https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd): one period's
// sale, returns, GST by HSN, profit, money in by mode, best-selling items and repair work, plus the CSV files for Excel / the CA
// and the day-close text for WhatsApp. Money in paise. Tested in mobile-reports.test.mjs.
import type { Payment } from "@/lib/jewellery";
import { inRange, istDate, toCsv, type Range } from "@/lib/jewellery-reports";
import { billInputOf, billTotals, isReturnAdjust, type BillRow } from "@/lib/mobile";
import type { JobRow } from "@/lib/mobile-repair";

export type MsHsnRow = { hsn: string; gstBp: number; qty: number; taxable: number; cgst: number; sgst: number; igst: number };
export type MsItemRow = { name: string; qty: number; amount: number; profit: number };
export type MsSaleRow = { day: string; code: string; kind: "sale" | "return"; name: string; phone: string; gstin: string; taxable: number; cgst: number; sgst: number; igst: number; round: number; total: number; paid: number; balance: number };
/** Money movements by day, for the accounts file: money in by mode, money given back on returns, old phones taken in exchange. */
export type MsCashRow = { day: string; kind: "in" | "refund" | "exchange"; mode: string; paise: number };
export type MsReport = {
  range: Range; bills: number; qty: number; sale: number; returns: number; net: number;
  taxable: number; cgst: number; sgst: number; igst: number; gst: number; profit: number; udhaarGiven: number;
  money: Record<Payment["mode"], number>; moneyTotal: number;
  hsn: MsHsnRow[]; items: MsItemRow[]; rows: MsSaleRow[]; cash: MsCashRow[]; days: { day: string; sale: number; money: number }[];
  repair: { received: number; delivered: number; income: number };
};
type JobLike = Pick<JobRow, "status" | "payments" | "bill_id" | "created_at" | "delivered_at" | "labour_paise">;

/** bills: every sale and return that was made or took money in the period. jobs: those touched in it. */
export function buildMsReport(bills: BillRow[], jobs: JobLike[], stateCode: string, range: Range): MsReport {
  const r: MsReport = { range, bills: 0, qty: 0, sale: 0, returns: 0, net: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, profit: 0, udhaarGiven: 0,
    money: { cash: 0, upi: 0, card: 0, bank: 0, cheque: 0, other: 0 }, moneyTotal: 0, hsn: [], items: [], rows: [], cash: [], days: [], repair: { received: 0, delivered: 0, income: 0 } };
  const hsn = new Map<string, MsHsnRow>(), items = new Map<string, MsItemRow>(), days = new Map<string, { day: string; sale: number; money: number }>();
  const dayOf = (d: string) => { let x = days.get(d); if (!x) { x = { day: d, sale: 0, money: 0 }; days.set(d, x); } return x; };
  const moves = new Map<string, MsCashRow>();
  const move = (day: string, kind: MsCashRow["kind"], mode: string, paise: number) => { const k = `${day}|${kind}|${mode}`, x = moves.get(k) ?? { day, kind, mode, paise: 0 }; x.paise += paise; moves.set(k, x); };
  const cash = (p: Payment, sign: 1 | -1, d: string) => { r.money[p.mode] = (r.money[p.mode] ?? 0) + sign * p.paise; r.moneyTotal += sign * p.paise; dayOf(d).money += sign * p.paise; };
  for (const b of bills) {
    if (b.status === "cancelled" || (b.kind !== "sale" && b.kind !== "return")) continue;
    const made = istDate(b.created_at), sign = b.kind === "return" ? -1 : 1;
    if (inRange(made, range)) {
      const t = billTotals(billInputOf(b), { gstOn: b.gst_on, stateCode });
      if (b.kind === "sale") { r.bills += 1; r.sale += t.total; r.udhaarGiven += Math.max(0, b.balance_paise); } else r.returns += t.total;
      r.qty += sign * t.qty; r.taxable += sign * t.taxable; r.cgst += sign * t.cgst; r.sgst += sign * t.sgst; r.igst += sign * t.igst; r.gst += sign * t.gst; r.profit += sign * t.profit;
      dayOf(made).sale += sign * t.total;
      r.rows.push({ day: made, code: b.code, kind: b.kind, name: b.customer_name, phone: b.customer_phone, gstin: b.customer_gstin, taxable: sign * t.taxable, cgst: sign * t.cgst, sgst: sign * t.sgst, igst: sign * t.igst, round: sign * t.roundOff, total: sign * t.total, paid: b.kind === "sale" ? t.paid : 0, balance: b.kind === "sale" ? Math.max(0, b.balance_paise) : 0 });
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
    if (b.kind === "return") { if (inRange(made, range)) for (const p of b.payments ?? []) if (p.paise > 0) { cash(p, -1, made); move(made, "refund", p.mode, p.paise); } }
    else for (const p of b.payments ?? []) {
      const d = p.at ? istDate(p.at) : made;
      if (p.paise <= 0 || !inRange(d, range)) continue;
      if (/^Exchange /.test(p.ref || "")) move(d, "exchange", "exchange", p.paise);
      else if (!isReturnAdjust(p)) { cash(p, 1, d); move(d, "in", /^EMI/.test(p.ref || "") ? "emi" : p.mode, p.paise); }
    }
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
  r.cash = [...moves.values()].sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.mode.localeCompare(b.mode));
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

/* ---------------- Tally ---------------- */
// Two XML files for TallyPrime (Import → Masters, then Import → Transactions), in the shapes of Tally's own samples
// (help.tallysolutions.com/sample-xml). Accounting vouchers only, no stock items. One clearing ledger, "Shubhora Counter Sales",
// takes every bill (debit) and every receipt (credit), so its balance in Tally is the udhaar still to come. Debit = negative
// amount with ISDEEMEDPOSITIVE Yes; credit = positive with No — every voucher adds up to zero (tested).
export const TALLY_LEDGERS: { name: string; parent: string }[] = [
  { name: "Shubhora Counter Sales", parent: "Sundry Debtors" },
  { name: "Sales - Mobile Shop", parent: "Sales Accounts" },
  { name: "Sales Return - Mobile Shop", parent: "Sales Accounts" },
  { name: "Output CGST", parent: "Duties & Taxes" },
  { name: "Output SGST", parent: "Duties & Taxes" },
  { name: "Output IGST", parent: "Duties & Taxes" },
  { name: "Round Off", parent: "Indirect Expenses" },
  { name: "UPI Collection", parent: "Bank Accounts" },
  { name: "Card Collection", parent: "Bank Accounts" },
  { name: "Bank Collection", parent: "Bank Accounts" },
  { name: "EMI Finance Receivable", parent: "Sundry Debtors" },
  { name: "Other Collection", parent: "Sundry Debtors" },
  { name: "Old Phone Exchange", parent: "Purchase Accounts" },
];
const MODE_LEDGER: Record<string, string> = { cash: "Cash", upi: "UPI Collection", card: "Card Collection", bank: "Bank Collection", cheque: "Bank Collection", emi: "EMI Finance Receivable", other: "Other Collection", exchange: "Old Phone Exchange" };
const xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function msTallyMastersXml(): string {
  return `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA>\n`
    + TALLY_LEDGERS.map((l) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER Action="Create"><NAME>${xml(l.name)}</NAME><PARENT>${xml(l.parent)}</PARENT></LEDGER></TALLYMESSAGE>`).join("\n")
    + `\n</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>\n`;
}

export type TallyEntry = { ledger: string; /** paise: debit is negative, credit positive */ amount: number };
export type TallyVoucher = { date: string; type: "Sales" | "Credit Note" | "Receipt" | "Payment" | "Journal"; number: string; narration: string; entries: TallyEntry[] };
/** The period as vouchers. Each one balances to zero. */
export function msTallyVouchers(r: MsReport): TallyVoucher[] {
  const out: TallyVoucher[] = [];
  const CTR = "Shubhora Counter Sales";
  const add = (v: TallyVoucher) => { v.entries = v.entries.filter((e) => e.amount !== 0); if (v.entries.length >= 2) out.push(v); };
  for (const x of r.rows) {
    const who = [x.name, x.phone].filter(Boolean).join(" ") || "Counter sale";
    if (x.kind === "sale") add({ date: x.day, type: "Sales", number: x.code, narration: who, entries: [{ ledger: CTR, amount: -x.total }, { ledger: "Sales - Mobile Shop", amount: x.taxable }, { ledger: "Output CGST", amount: x.cgst }, { ledger: "Output SGST", amount: x.sgst }, { ledger: "Output IGST", amount: x.igst }, { ledger: "Round Off", amount: x.round }] });
    // A return row carries negative numbers: turn them round.
    else add({ date: x.day, type: "Credit Note", number: x.code, narration: `Return · ${who}`, entries: [{ ledger: CTR, amount: -x.total }, { ledger: "Sales Return - Mobile Shop", amount: x.taxable }, { ledger: "Output CGST", amount: x.cgst }, { ledger: "Output SGST", amount: x.sgst }, { ledger: "Output IGST", amount: x.igst }, { ledger: "Round Off", amount: x.round }] });
  }
  r.cash.forEach((c, i) => {
    const led = MODE_LEDGER[c.mode] ?? "Other Collection", no = `SH-${c.day.replace(/-/g, "")}-${i + 1}`;
    if (c.kind === "in") add({ date: c.day, type: "Receipt", number: no, narration: `Counter collection (${c.mode})`, entries: [{ ledger: led, amount: -c.paise }, { ledger: CTR, amount: c.paise }] });
    else if (c.kind === "refund") add({ date: c.day, type: "Payment", number: no, narration: `Money given back on returns (${c.mode})`, entries: [{ ledger: CTR, amount: -c.paise }, { ledger: led, amount: c.paise }] });
    else add({ date: c.day, type: "Journal", number: no, narration: "Old phones taken in exchange", entries: [{ ledger: "Old Phone Exchange", amount: -c.paise }, { ledger: CTR, amount: c.paise }] });
  });
  return out;
}
export function msTallyVouchersXml(r: MsReport): string {
  const amt = (p: number) => (p / 100).toFixed(2);
  const body = msTallyVouchers(r).map((v) => `<TALLYMESSAGE><VOUCHER><DATE>${v.date.replace(/-/g, "")}</DATE><VOUCHERTYPENAME>${v.type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xml(v.number)}</VOUCHERNUMBER><NARRATION>${xml(v.narration)}</NARRATION><PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW><ISINVOICE>No</ISINVOICE>`
    + v.entries.map((e, i) => `<LEDGERENTRIES.LIST><LEDGERNAME>${xml(e.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${e.amount < 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>${i === 0 ? `<ISPARTYLEDGER>Yes</ISPARTYLEDGER><ISLASTDEEMEDPOSITIVE>${e.amount < 0 ? "Yes" : "No"}</ISLASTDEEMEDPOSITIVE>` : ""}<AMOUNT>${amt(e.amount)}</AMOUNT></LEDGERENTRIES.LIST>`).join("")
    + `</VOUCHER></TALLYMESSAGE>`).join("\n");
  return `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Import</TALLYREQUEST><TYPE>Data</TYPE><ID>Vouchers</ID></HEADER><BODY><DESC></DESC><DATA>\n${body}\n</DATA></BODY></ENVELOPE>\n`;
}
