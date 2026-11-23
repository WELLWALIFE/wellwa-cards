// Shubhora Mobile Shop — the shared, pure part (owner, 23 Nov 2026 — plan https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd).
// For an accessory + repair shop first (most small-town shops), and for a shop that sells phones too: an item is either counted
// (accessories, parts: qty) or serial-tracked (phones: one row per IMEI). Phase 1: items, IMEI units, purchases, fast bills,
// payments and udhaar, day close. Tested in mobile.test.mjs.
//
// Units: money in PAISE, GST in BASIS POINTS (18% = 1800). Retail prices are tax-INCLUSIVE (MRP style): the tax is worked out
// from inside the price, per line, so a bill of ₹299 is ₹299 for the customer. A shop without GST registration bills without tax.
import type { Payment } from "@/lib/jewellery";

export type ItemKind = "accessory" | "phone" | "part" | "service";
export const ITEM_KINDS: { key: ItemKind; en: string; hi: string }[] = [
  { key: "accessory", en: "Accessory", hi: "एक्सेसरी" },
  { key: "phone", en: "Phone (IMEI)", hi: "फ़ोन (IMEI)" },
  { key: "part", en: "Spare part", hi: "स्पेयर पार्ट" },
  { key: "service", en: "Service", hi: "सर्विस" },
];
/** Common categories with their HSN (all 18% today — the shop can change the rate per item). */
export const CATEGORIES: { key: string; en: string; hi: string; hsn: string; kind: ItemKind }[] = [
  { key: "cover", en: "Cover / case", hi: "कवर", hsn: "3926", kind: "accessory" },
  { key: "glass", en: "Tempered glass", hi: "टेम्पर्ड ग्लास", hsn: "7007", kind: "accessory" },
  { key: "charger", en: "Charger / adapter", hi: "चार्जर", hsn: "8504", kind: "accessory" },
  { key: "cable", en: "Cable", hi: "केबल", hsn: "8544", kind: "accessory" },
  { key: "earphone", en: "Earphone / earbuds", hi: "ईयरफ़ोन / बड्स", hsn: "8518", kind: "accessory" },
  { key: "powerbank", en: "Power bank", hi: "पावर बैंक", hsn: "8507", kind: "accessory" },
  { key: "memory", en: "Memory card / pendrive", hi: "मेमोरी कार्ड", hsn: "8523", kind: "accessory" },
  { key: "watch", en: "Smartwatch", hi: "स्मार्टवॉच", hsn: "8517", kind: "accessory" },
  { key: "speaker", en: "Speaker", hi: "स्पीकर", hsn: "8518", kind: "accessory" },
  { key: "phone", en: "Mobile phone", hi: "मोबाइल फ़ोन", hsn: "8517", kind: "phone" },
  { key: "display", en: "Display / folder", hi: "डिस्प्ले", hsn: "8517", kind: "part" },
  { key: "battery", en: "Battery", hi: "बैटरी", hsn: "8507", kind: "part" },
  { key: "part", en: "Other part", hi: "अन्य पार्ट", hsn: "8517", kind: "part" },
  { key: "appliance", en: "Small appliance", hi: "छोटा उपकरण", hsn: "8516", kind: "accessory" },
  { key: "other", en: "Other", hi: "अन्य", hsn: "", kind: "accessory" },
];

export const MS_RIGHTS = [
  { key: "bill", en: "Make bills and estimates", hi: "बिल और estimate बनाना" },
  { key: "stock", en: "Add items, stock and purchases", hi: "item, स्टॉक और ख़रीद चढ़ाना" },
  { key: "repair", en: "Take and work on repair jobs", hi: "रिपेयर job लेना और उन पर काम करना" },
  { key: "discount", en: "Give a discount above the counter limit", hi: "counter limit से ज़्यादा छूट देना" },
  { key: "cancel", en: "Cancel a bill", hi: "बिल रद्द करना" },
  { key: "cost", en: "See cost and profit", hi: "लागत और मुनाफ़ा देखना" },
  { key: "reports", en: "See all bills, day close and money", hi: "सारे बिल, डे क्लोज़ और पैसे देखना" },
  { key: "setup", en: "Change settings", hi: "Settings बदलना" },
] as const;
export type MsRight = (typeof MS_RIGHTS)[number]["key"];
export const MS_ALL_RIGHTS: MsRight[] = MS_RIGHTS.map((r) => r.key);

export type MsSetup = {
  shopName: string; address: string; phone: string;
  /** GST: off for an unregistered shop (a plain bill, no tax lines). */
  gstOn: boolean; gstin: string; stateCode: string;
  billPrefix: string; estimatePrefix: string;
  /** Printed bill: 58 mm or 80 mm thermal roll, or A5 / A4 paper. */
  paper: "58" | "80" | "a5" | "a4";
  /** The most discount a counter login may give without the "discount" right, in basis points of the bill. */
  counterDiscountBp: number;
  terms: string; upi: string;
  /** Repair: job number prefix, warranty given on a repair (days, printed on its bill), and the terms on the job slip. */
  jobPrefix: string; repairWarrantyDays: number; repairTerms: string;
  staff: Record<string, { title: string; rights: MsRight[] }>;
};
export const DEFAULT_MS_SETUP: MsSetup = {
  shopName: "", address: "", phone: "", gstOn: false, gstin: "", stateCode: "", billPrefix: "MB", estimatePrefix: "ME", paper: "80",
  counterDiscountBp: 500, terms: "No return on accessories once opened. Warranty as per the brand.", upi: "",
  jobPrefix: "MJ", repairWarrantyDays: 30, repairTerms: "Data is the customer's responsibility — please take a backup. Collect the phone within 30 days of the ready message. Warranty is on the part changed only, not on water or physical damage.",
  staff: {},
};

const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function cleanMsSetup(v: unknown): MsSetup {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const staff: MsSetup["staff"] = {};
  if (s.staff && typeof s.staff === "object") {
    for (const [id, st] of Object.entries(s.staff as Record<string, unknown>).slice(0, 100)) {
      const x = (st ?? {}) as Record<string, unknown>;
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      staff[id] = { title: txt(x.title, 30) || "Staff", rights: (Array.isArray(x.rights) ? x.rights : []).filter((r): r is MsRight => MS_ALL_RIGHTS.includes(r as MsRight)) };
    }
  }
  const gstin = txt(s.gstin, 15).toUpperCase();
  return {
    shopName: txt(s.shopName, 80), address: String(s.address ?? "").slice(0, 300), phone: txt(s.phone, 30),
    // Tax lines only with a GSTIN typed: an unregistered shop must not charge GST.
    gstOn: s.gstOn === true && gstin.length === 15, gstin,
    stateCode: /^\d{2}$/.test(String(s.stateCode ?? "")) ? String(s.stateCode) : /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : "",
    billPrefix: String(s.billPrefix ?? "").replace(/[^A-Za-z0-9/-]/g, "").slice(0, 8) || "MB",
    estimatePrefix: String(s.estimatePrefix ?? "").replace(/[^A-Za-z0-9/-]/g, "").slice(0, 8) || "ME",
    paper: s.paper === "58" || s.paper === "a5" || s.paper === "a4" ? s.paper : "80",
    counterDiscountBp: int(s.counterDiscountBp, 0, 10000, 500),
    terms: String(s.terms ?? DEFAULT_MS_SETUP.terms).slice(0, 400), upi: txt(s.upi, 80),
    jobPrefix: String(s.jobPrefix ?? "").replace(/[^A-Za-z0-9/-]/g, "").slice(0, 8) || "MJ",
    repairWarrantyDays: int(s.repairWarrantyDays, 0, 730, 30), repairTerms: String(s.repairTerms ?? DEFAULT_MS_SETUP.repairTerms).slice(0, 500), staff,
  };
}

/* ---------------- items and units ---------------- */

export type ItemRow = {
  id: string; owner_id: string; kind: ItemKind; name: string; brand: string; model: string; variant: string; category: string;
  hsn: string; gst_bp: number; price_paise: number; mrp_paise: number; cost_paise: number; barcode: string;
  qty: number; low_qty: number; fits: string[]; serial: boolean; warranty_months: number; active: boolean; created_at: string; updated_at: string;
};
export const ITEM_COLS = "id,owner_id,kind,name,brand,model,variant,category,hsn,gst_bp,price_paise,mrp_paise,cost_paise,barcode,qty,low_qty,fits,serial,warranty_months,active,created_at,updated_at";
export type UnitStatus = "in_stock" | "sold" | "returned" | "demo";
export type UnitRow = { id: string; owner_id: string; item_id: string; imei1: string; imei2: string; serial_no: string; status: UnitStatus; cost_paise: number; purchase_id: string | null; bill_id: string | null; sold_at: string | null; created_at: string };
export const UNIT_COLS = "id,owner_id,item_id,imei1,imei2,serial_no,status,cost_paise,purchase_id,bill_id,sold_at,created_at";

/** A scanned or typed code, as stored: capitals and digits only. */
export const cleanCode = (v: unknown, n = 40) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, n);
/** An IMEI is 15 digits with a Luhn check digit. "" is not valid. */
export function validImei(v: string): boolean {
  if (!/^\d{15}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) { let d = Number(v[i]); if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0;
}
/** Phone models an accessory fits, as typed ("Redmi 13, redmi note 13 pro") → clean, de-duplicated tags. */
export function cleanFits(v: unknown): string[] {
  const list = Array.isArray(v) ? v : String(v ?? "").split(/[,\n]/);
  const out: string[] = [];
  for (const x of list) { const t = txt(x, 40); if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t); }
  return out.slice(0, 40);
}

export function cleanItemFields(b: Record<string, unknown>) {
  const kind: ItemKind = ITEM_KINDS.some((k) => k.key === b.kind) ? (b.kind as ItemKind) : "accessory";
  const cat = CATEGORIES.find((c) => c.key === b.category);
  const serial = kind === "phone" ? b.serial !== false : b.serial === true;
  return {
    kind, name: txt(b.name, 100), brand: txt(b.brand, 40), model: txt(b.model, 60), variant: txt(b.variant, 60), category: cat?.key ?? "other",
    hsn: txt(b.hsn, 8).replace(/\D/g, "") || cat?.hsn || "", gst_bp: int(b.gst_bp, 0, 2800, 1800),
    price_paise: int(b.price_paise, 0, 1e11, 0), mrp_paise: int(b.mrp_paise, 0, 1e11, 0), cost_paise: int(b.cost_paise, 0, 1e11, 0),
    barcode: cleanCode(b.barcode), low_qty: int(b.low_qty, 0, 100000, 0), fits: cleanFits(b.fits), serial,
    warranty_months: int(b.warranty_months, 0, 120, 0),
  };
}

/** The item's name as the bill and the lists print it. */
export const itemTitle = (i: Pick<ItemRow, "name" | "brand" | "model" | "variant">) => [i.brand, i.name || i.model, i.name && i.model && !i.name.toLowerCase().includes(i.model.toLowerCase()) ? i.model : "", i.variant].filter(Boolean).join(" ");

/** Does the item answer a search? Words match the name, brand, model, variant, barcode and the phones it fits. */
export function itemMatches(i: Pick<ItemRow, "name" | "brand" | "model" | "variant" | "barcode" | "fits" | "category">, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [i.name, i.brand, i.model, i.variant, i.barcode, i.category, ...(i.fits ?? [])].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/* ---------------- the bill ---------------- */

export type BillLine = {
  itemId: string; name: string; hsn: string; qty: number;
  /** price of one, tax included, in paise */
  price: number; discount: number; gstBp: number;
  imei: string; unitId: string; warrantyMonths: number;
  /** what one cost the shop (kept on the line for profit; never shown to the customer) */
  cost: number;
  /** on a return (credit note): which line of the original bill this is */
  ref?: number;
};
export type LineAmounts = { gross: number; net: number; taxable: number; gst: number };
/** One line: qty × price − discount is what the customer pays; the tax sits inside it when GST is on. */
export function lineAmounts(l: Pick<BillLine, "qty" | "price" | "discount" | "gstBp">, gstOn: boolean): LineAmounts {
  const gross = l.qty * l.price;
  const net = Math.max(0, gross - Math.max(0, l.discount));
  const taxable = gstOn && l.gstBp > 0 ? Math.round((net * 10000) / (10000 + l.gstBp)) : net;
  return { gross, net, taxable, gst: net - taxable };
}
export type BillInput = { lines: BillLine[]; payments: Payment[]; discountPaise: number; customerState: string };
export type BillTotals = {
  lines: LineAmounts[]; gross: number; lineDiscount: number; billDiscount: number; taxable: number; cgst: number; sgst: number; igst: number; gst: number;
  roundOff: number; total: number; paid: number; balance: number; cost: number; profit: number; qty: number;
};
/** The whole bill. A bill-level discount is spread over the lines by their share, so each keeps its own tax rate. */
export function billTotals(b: BillInput, setup: Pick<MsSetup, "gstOn" | "stateCode">): BillTotals {
  const first = b.lines.map((l) => lineAmounts(l, false));
  const sumNet = first.reduce((a, x) => a + x.net, 0);
  const billDiscount = Math.min(Math.max(0, Math.round(b.discountPaise)), sumNet);
  let left = billDiscount;
  const lines = b.lines.map((l, i) => {
    const share = i === b.lines.length - 1 ? left : sumNet ? Math.round((billDiscount * first[i].net) / sumNet) : 0;
    left -= share;
    return lineAmounts({ ...l, discount: Math.max(0, l.discount) + share }, setup.gstOn);
  });
  const taxable = lines.reduce((a, x) => a + x.taxable, 0), gst = lines.reduce((a, x) => a + x.gst, 0);
  const before = taxable + gst;
  const total = Math.round(before / 100) * 100;
  const inter = setup.gstOn && !!setup.stateCode && !!b.customerState && b.customerState !== setup.stateCode;
  const cgst = inter ? 0 : Math.floor(gst / 2);
  const paid = b.payments.reduce((a, p) => a + Math.max(0, Math.round(p.paise)), 0);
  const cost = b.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0);
  return {
    lines, gross: first.reduce((a, x) => a + x.gross, 0), lineDiscount: b.lines.reduce((a, l) => a + Math.max(0, l.discount), 0), billDiscount,
    taxable, cgst, sgst: inter ? 0 : gst - cgst, igst: inter ? gst : 0, gst, roundOff: total - before, total, paid, balance: total - paid,
    cost, profit: taxable - cost, qty: b.lines.reduce((a, l) => a + l.qty, 0),
  };
}

export function cleanLine(v: unknown): BillLine {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    itemId: /^[0-9a-f-]{36}$/i.test(String(x.itemId ?? "")) ? String(x.itemId) : "", name: txt(x.name, 120), hsn: txt(x.hsn, 8),
    qty: int(x.qty, 1, 9999, 1), price: int(x.price, 0, 1e11, 0), discount: int(x.discount, 0, 1e11, 0), gstBp: int(x.gstBp, 0, 2800, 1800),
    imei: cleanCode(x.imei, 20), unitId: /^[0-9a-f-]{36}$/i.test(String(x.unitId ?? "")) ? String(x.unitId) : "",
    warrantyMonths: int(x.warrantyMonths, 0, 120, 0), cost: int(x.cost, 0, 1e11, 0),
  };
}

export type BillKind = "sale" | "estimate" | "return";
export type BillStatus = "open" | "paid" | "cancelled" | "converted";
export type BillRow = {
  id: string; owner_id: string; kind: BillKind; number: number; fin_year: string; code: string; status: BillStatus;
  customer_name: string; customer_phone: string; customer_gstin: string; customer_state: string;
  lines: BillLine[]; payments: Payment[]; discount_paise: number; total_paise: number; gst_paise: number; balance_paise: number; profit_paise: number;
  gst_on: boolean; notes: string; due_date: string | null; token: string; client_id: string | null; ref_bill_id: string | null;
  created_by: string | null; created_by_name: string; cancel_reason: string; created_at: string; updated_at: string;
};
export const BILL_COLS = "id,owner_id,kind,number,fin_year,code,status,customer_name,customer_phone,customer_gstin,customer_state,lines,payments,discount_paise,total_paise,gst_paise,balance_paise,profit_paise,gst_on,notes,due_date,token,client_id,ref_bill_id,created_by,created_by_name,cancel_reason,created_at,updated_at";
export const billInputOf = (b: Pick<BillRow, "lines" | "payments" | "discount_paise" | "customer_state">): BillInput => ({ lines: b.lines ?? [], payments: b.payments ?? [], discountPaise: b.discount_paise ?? 0, customerState: b.customer_state ?? "" });

/** The bill without what the customer must not see (cost, profit) — for the public bill link. */
export function publicBill<T extends Pick<BillRow, "lines" | "profit_paise">>(b: T): T {
  return { ...b, profit_paise: 0, lines: (b.lines ?? []).map((l) => ({ ...l, cost: 0 })) };
}

export function billMessage(b: Pick<BillRow, "kind" | "code" | "customer_name" | "total_paise" | "balance_paise">, shop: string, link: string, hi = true): string {
  const rs = (p: number) => `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
  const name = b.customer_name?.trim() ? (hi ? `${b.customer_name.trim()} जी` : b.customer_name.trim()) : "";
  if (b.kind === "return") return hi ? [`नमस्ते ${name} 🙏`, `${shop}: वापसी ${b.code} — ${rs(b.total_paise)}`, `देखें: ${link}`].join("\n") : [`Hello ${name} 🙏`, `${shop}: return ${b.code} — ${rs(b.total_paise)}`, `See it: ${link}`].join("\n");
  if (b.kind === "estimate") return hi ? [`नमस्ते ${name} 🙏`, `${shop} से आपका estimate ${b.code}: ${rs(b.total_paise)}`, `देखें: ${link}`].join("\n") : [`Hello ${name} 🙏`, `Your estimate ${b.code} from ${shop}: ${rs(b.total_paise)}`, `See it: ${link}`].join("\n");
  const due = b.balance_paise > 0 ? (hi ? `बाकी: ${rs(b.balance_paise)}` : `Balance due: ${rs(b.balance_paise)}`) : (hi ? "पूरा भुगतान मिल गया ✅" : "Fully paid ✅");
  return hi ? [`नमस्ते ${name} 🙏`, `${shop} से खरीदारी के लिए धन्यवाद।`, `बिल ${b.code}: ${rs(b.total_paise)}`, due, `बिल / वारंटी देखें: ${link}`].join("\n")
    : [`Hello ${name} 🙏`, `Thank you for shopping at ${shop}.`, `Bill ${b.code}: ${rs(b.total_paise)}`, due, `Bill / warranty: ${link}`].join("\n");
}

/* ---------------- returns (credit notes) ---------------- */

/** A payment put on a bill because goods came back (it cleared udhaar; no money came in). */
export const isReturnAdjust = (p: Pick<Payment, "ref">) => /^Return /.test(p.ref || "");
/** How many of each line of a bill have already come back. */
export function returnedQty(bill: Pick<BillRow, "lines">, returns: Pick<BillRow, "lines" | "status">[]): number[] {
  const out = (bill.lines ?? []).map(() => 0);
  for (const r of returns) if (r.status !== "cancelled") for (const l of r.lines ?? []) if (typeof l.ref === "number" && l.ref >= 0 && l.ref < out.length) out[l.ref] += l.qty;
  return out;
}
/**
 * The lines of a return: `want[i]` pieces of line i come back, at what the customer really paid for them (the line's own
 * discount and its share of the bill discount taken off, piece by piece). Null when nothing valid is asked.
 */
export function returnLines(bill: Pick<BillRow, "lines" | "payments" | "discount_paise" | "customer_state" | "gst_on">, already: number[], want: number[]): BillLine[] | null {
  const t = billTotals(billInputOf(bill), { gstOn: bill.gst_on, stateCode: "" });
  const out: BillLine[] = [];
  (bill.lines ?? []).forEach((l, i) => {
    const q = Math.round(Number(want[i]) || 0);
    if (q <= 0) return;
    if (q > l.qty - (already[i] ?? 0)) { out.push({ ...l, qty: -1 }); return; }
    const paid = Math.round((t.lines[i].net * q) / l.qty);   // what these pieces cost the customer
    out.push({ ...l, qty: q, discount: Math.max(0, q * l.price - paid), ref: i });
  });
  if (!out.length || out.some((l) => l.qty < 0)) return null;
  return out;
}

/* ---------------- purchases ---------------- */

export type PurchaseLine = { itemId: string; name: string; qty: number; cost: number; imeis: string[] };
export function cleanPurchaseLine(v: unknown): PurchaseLine | null {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const itemId = /^[0-9a-f-]{36}$/i.test(String(x.itemId ?? "")) ? String(x.itemId) : "";
  if (!itemId) return null;
  const imeis = [...new Set((Array.isArray(x.imeis) ? x.imeis : []).map((i) => cleanCode(i, 20)).filter(Boolean))].slice(0, 500);
  const qty = imeis.length || int(x.qty, 0, 100000, 0);
  return qty ? { itemId, name: txt(x.name, 120), qty, cost: int(x.cost, 0, 1e11, 0), imeis } : null;
}

/* ---------------- day close ---------------- */

export type DayClose = { bills: number; sale: number; gst: number; profit: number; money: Record<Payment["mode"], number>; moneyTotal: number; udhaarGiven: number; qty: number };
const istDate = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
/** One India day: sale bills made that day (not cancelled), and money received that day on any live bill. */
export function dayClose(bills: BillRow[], day: string): DayClose {
  const out: DayClose = { bills: 0, sale: 0, gst: 0, profit: 0, money: { cash: 0, upi: 0, card: 0, bank: 0, cheque: 0, other: 0 }, moneyTotal: 0, udhaarGiven: 0, qty: 0 };
  for (const b of bills) {
    if (b.status === "cancelled") continue;
    if (b.kind === "return") {
      // Goods that came back today come off today's sale; the money given back comes off the drawer.
      if (istDate(b.created_at) !== day) continue;
      out.sale -= b.total_paise; out.gst -= b.gst_paise; out.profit -= b.profit_paise || 0; out.qty -= (b.lines ?? []).reduce((a, l) => a + l.qty, 0);
      for (const p of b.payments ?? []) if (p.paise > 0) { out.money[p.mode] = (out.money[p.mode] ?? 0) - p.paise; out.moneyTotal -= p.paise; }
      continue;
    }
    if (b.kind !== "sale") continue;
    if (istDate(b.created_at) === day) {
      out.bills += 1; out.sale += b.total_paise; out.gst += b.gst_paise; out.profit += b.profit_paise || 0; out.udhaarGiven += Math.max(0, b.balance_paise);
      out.qty += (b.lines ?? []).reduce((a, l) => a + l.qty, 0);
    }
    for (const p of b.payments ?? []) if (p.at && istDate(p.at) === day && p.paise > 0 && !isReturnAdjust(p)) { out.money[p.mode] = (out.money[p.mode] ?? 0) + p.paise; out.moneyTotal += p.paise; }
  }
  return out;
}
