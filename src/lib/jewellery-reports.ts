// Shubhora Jewellery, phase 4 — reports (plan https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK): sale, GST (B2B / B2C / HSN),
// money in by mode, old gold taken, purity-wise weight, day by day, and the day close — plus CSV files Excel opens (and Tally
// import utilities read). Pure functions over the saved bills and orders; every figure is worked out again with billTotals, the
// same maths as the printed bill. Tested in jewellery-reports.test.mjs.
//
// Rules: a cancelled bill is not a sale and its money is not counted (it was given back); estimates are never sales. Money in
// is counted on the day it was received (a payment's own date), from bills and from order / repair advances, so a later
// payment on an old bill shows on the day it came. An order bill's "advance" is not counted again (it was counted as the
// order's payment).
import { billInputOf, billTotals, type BillRow, type JwSetup, type Metal, type Payment } from "@/lib/jewellery";

export type Range = { from: string; to: string };   // India dates, both included
/** The India date of a moment: "2026-11-23". */
export const istDate = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
export const inRange = (day: string, r: Range) => day >= r.from && day <= r.to;

type OrderLike = { code: string; status: string; payments: Payment[] };
type Money = Record<Payment["mode"], number>;
const zeroMoney = (): Money => ({ cash: 0, upi: 0, card: 0, bank: 0, cheque: 0, other: 0 });

export type HsnRow = { hsn: string; pieces: number; netMg: number; taxable: number; cgst: number; sgst: number; igst: number };
export type B2bRow = { code: string; day: string; name: string; gstin: string; state: string; taxable: number; cgst: number; sgst: number; igst: number; total: number };
export type Report = {
  range: Range;
  bills: number; total: number; taxable: number; making: number; discount: number; cgst: number; sgst: number; igst: number; gst: number; roundOff: number;
  oldValue: number; oldFine: Record<Metal, number>;
  money: Money; moneyTotal: number; fromBills: number; fromOrders: number;
  byDay: { day: string; bills: number; total: number; gst: number; money: number }[];
  byPurity: { purity: string; label: string; pieces: number; netMg: number; fineMg: number; amount: number }[];
  hsn: HsnRow[]; b2b: B2bRow[];
  b2c: { state: string; taxable: number; cgst: number; sgst: number; igst: number }[];
  sales: { code: string; day: string; name: string; phone: string; gstin: string; taxable: number; cgst: number; sgst: number; igst: number; total: number; oldValue: number; paid: number; balance: number }[];
};

/** Split an amount over weights, whole paise, the remainder on the last share (so the parts always add up). */
export function split(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map((_, i) => (i === weights.length - 1 ? amount : 0));
  let left = amount;
  return weights.map((w, i) => { if (i === weights.length - 1) return left; const x = Math.round((amount * w) / sum); left -= x; return x; });
}

export function buildReport(allBills: BillRow[], orders: OrderLike[], setup: Pick<JwSetup, "gstBp" | "gstMakingBp" | "stateCode" | "roundTo" | "purities">, range: Range): Report {
  const live = allBills.filter((b) => b.kind === "sale" && b.status !== "cancelled");
  const sales = live.filter((b) => inRange(istDate(b.created_at), range)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rep: Report = {
    range, bills: sales.length, total: 0, taxable: 0, making: 0, discount: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, roundOff: 0,
    oldValue: 0, oldFine: { gold: 0, silver: 0, platinum: 0 }, money: zeroMoney(), moneyTotal: 0, fromBills: 0, fromOrders: 0,
    byDay: [], byPurity: [], hsn: [], b2b: [], b2c: [], sales: [],
  };
  const days = new Map<string, { day: string; bills: number; total: number; gst: number; money: number }>();
  const dayRow = (d: string) => { let r = days.get(d); if (!r) { r = { day: d, bills: 0, total: 0, gst: 0, money: 0 }; days.set(d, r); } return r; };
  const pur = new Map<string, Report["byPurity"][number]>();
  const hsn = new Map<string, HsnRow>();
  const b2c = new Map<string, Report["b2c"][number]>();

  for (const b of sales) {
    const t = billTotals(billInputOf(b), setup);
    const day = istDate(b.created_at);
    rep.total += t.total; rep.taxable += t.taxable; rep.making += t.making; rep.discount += t.discount;
    rep.cgst += t.cgst; rep.sgst += t.sgst; rep.igst += t.igst; rep.gst += t.gst; rep.roundOff += t.roundOff; rep.oldValue += t.oldValue;
    (b.old_gold ?? []).forEach((o, i) => { rep.oldFine[o.metal] = (rep.oldFine[o.metal] ?? 0) + (t.old[i]?.fineMg ?? 0); });
    const dr = dayRow(day); dr.bills += 1; dr.total += t.total; dr.gst += t.gst;
    // Each line's share of the bill's taxable value and tax, for HSN and purity.
    const shares = t.lines.map((l) => l.total);
    const tx = split(t.taxable, shares), cg = split(t.cgst, shares), sg = split(t.sgst, shares), ig = split(t.igst, shares);
    (b.lines ?? []).forEach((l, i) => {
      const la = t.lines[i];
      const p = setup.purities.find((x) => x.key === l.purity);
      const pr = pur.get(l.purity) ?? { purity: l.purity, label: p?.label ?? (l.purity || "—"), pieces: 0, netMg: 0, fineMg: 0, amount: 0 };
      pr.pieces += l.pieces || 1; pr.netMg += la.netMg; pr.fineMg += la.fineMg; pr.amount += tx[i];
      pur.set(l.purity, pr);
      const code = l.hsn || "7113";
      const hr = hsn.get(code) ?? { hsn: code, pieces: 0, netMg: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      hr.pieces += l.pieces || 1; hr.netMg += la.netMg; hr.taxable += tx[i]; hr.cgst += cg[i]; hr.sgst += sg[i]; hr.igst += ig[i];
      hsn.set(code, hr);
    });
    const state = b.customer_state || setup.stateCode || "";
    if (b.customer_gstin) rep.b2b.push({ code: b.code, day, name: b.customer_name, gstin: b.customer_gstin, state, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.total });
    else { const r = b2c.get(state) ?? { state, taxable: 0, cgst: 0, sgst: 0, igst: 0 }; r.taxable += t.taxable; r.cgst += t.cgst; r.sgst += t.sgst; r.igst += t.igst; b2c.set(state, r); }
    rep.sales.push({ code: b.code, day, name: b.customer_name, phone: b.customer_phone, gstin: b.customer_gstin, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.total, oldValue: t.oldValue, paid: t.paid, balance: t.balance });
  }

  // Money in, on the day it came: bill payments (any live sale bill) and order / repair payments (not cancelled orders).
  const take = (p: Payment, from: "bill" | "order") => {
    if (!p?.at || !(p.paise > 0)) return;
    const d = istDate(p.at);
    if (!inRange(d, range)) return;
    rep.money[p.mode] = (rep.money[p.mode] ?? 0) + p.paise; rep.moneyTotal += p.paise;
    if (from === "bill") rep.fromBills += p.paise; else rep.fromOrders += p.paise;
    dayRow(d).money += p.paise;
  };
  for (const b of live) for (const p of b.payments ?? []) take(p, "bill");
  for (const o of orders) if (o.status !== "cancelled") for (const p of o.payments ?? []) take(p, "order");

  rep.byDay = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  rep.byPurity = [...pur.values()].sort((a, b) => b.netMg - a.netMg);
  rep.hsn = [...hsn.values()];
  rep.b2c = [...b2c.values()];
  return rep;
}

/* ---------------- CSV (Excel, Tally import tools) ---------------- */

const rs = (paise: number) => (paise / 100).toFixed(2);
const g3 = (mg: number) => (mg / 1000).toFixed(3);
/** One CSV text: every cell quoted when it needs it; a leading =,+,-,@ is made plain text so Excel never runs it as a formula. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    let s = String(v ?? "");
    if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function salesCsv(r: Report): string {
  return toCsv([
    ["Bill no", "Date", "Customer", "Mobile", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Bill total", "Old gold", "Paid on bill", "Balance"],
    ...r.sales.map((s) => [s.code, s.day, s.name, s.phone, s.gstin, rs(s.taxable), rs(s.cgst), rs(s.sgst), rs(s.igst), rs(s.total), rs(s.oldValue), rs(s.paid), rs(s.balance)]),
    ["Total", "", "", "", "", rs(r.taxable), rs(r.cgst), rs(r.sgst), rs(r.igst), rs(r.total), rs(r.oldValue), "", ""],
  ]);
}
export function hsnCsv(r: Report): string {
  return toCsv([
    ["HSN", "Description", "UQC", "Pieces", "Net weight (g)", "Taxable value", "CGST", "SGST", "IGST", "Total tax"],
    ...r.hsn.map((h) => [h.hsn, h.hsn === "7113" ? "Articles of jewellery" : h.hsn === "7114" ? "Articles of goldsmiths' or silversmiths' wares" : "", "GMS", h.pieces, g3(h.netMg), rs(h.taxable), rs(h.cgst), rs(h.sgst), rs(h.igst), rs(h.cgst + h.sgst + h.igst)]),
  ]);
}
export function b2bCsv(r: Report): string {
  return toCsv([
    ["GSTIN of buyer", "Buyer", "Invoice no", "Invoice date", "Place of supply (state code)", "Taxable value", "CGST", "SGST", "IGST", "Invoice value"],
    ...r.b2b.map((b) => [b.gstin, b.name, b.code, b.day, b.state, rs(b.taxable), rs(b.cgst), rs(b.sgst), rs(b.igst), rs(b.total)]),
  ]);
}
export function dayCsv(r: Report): string {
  return toCsv([["Date", "Bills", "Sale", "GST", "Money in"], ...r.byDay.map((d) => [d.day, d.bills, rs(d.total), rs(d.gst), rs(d.money)])]);
}

/** The day close for WhatsApp (the owner's own number): sale, GST, money in by mode, old gold taken. */
export function dayCloseText(r: Report, shop: string, dueTotal: number): string {
  const inr = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  const modes = (Object.entries(r.money) as [string, number][]).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()} ${inr(v)}`);
  const day = r.range.from === r.range.to ? r.range.from : `${r.range.from} → ${r.range.to}`;
  return [
    `📒 ${shop} — Day close ${day}`,
    `Bills: ${r.bills} · Sale ${inr(r.total)} (GST ${inr(r.gst)})`,
    `Money in: ${inr(r.moneyTotal)}${modes.length ? ` (${modes.join(", ")})` : ""}`,
    r.oldValue ? `Old gold taken: ${(r.oldFine.gold / 1000).toFixed(3)} g fine · ${inr(r.oldValue)}` : "",
    `Udhaar outstanding (all bills): ${inr(dueTotal)}`,
  ].filter(Boolean).join("\n");
}
