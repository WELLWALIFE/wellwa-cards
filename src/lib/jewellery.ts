// Shubhora Jewellery (owner, 23 Nov 2026: "complete list banao… tailor ki tarah add karo… competitors se better"): the shared
// part — settings, metals and purities, the price engine and the messages. Used by the API (src/lib/jewellery-server.ts) and
// the app (/poster/jewellery). Plan: https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK
//
// Units, so nothing is lost to rounding: money in PAISE, weights in MILLIGRAMS, rates in paise per GRAM, percentages in BASIS
// POINTS (1% = 100). Fineness is parts per 1000 (22K = 916). Every function here is pure and tested (jewellery.test.mjs).

import { DEFAULT_PLANS, cleanPlan, type SchemePlan } from "@/lib/jewellery-finance";
export type Metal = "gold" | "silver" | "platinum";
export const METALS: { key: Metal; en: string; hi: string }[] = [
  { key: "gold", en: "Gold", hi: "सोना" },
  { key: "silver", en: "Silver", hi: "चाँदी" },
  { key: "platinum", en: "Platinum", hi: "प्लैटिनम" },
];

/** A purity the shop sells. `fine` = parts per 1000. The shop can add its own (e.g. "22K KDM"). */
export type Purity = { key: string; metal: Metal; label: string; fine: number; on: boolean };
export const DEFAULT_PURITIES: Purity[] = [
  { key: "g24", metal: "gold", label: "24K (999)", fine: 999, on: true },
  { key: "g995", metal: "gold", label: "24K (995)", fine: 995, on: false },
  { key: "g22", metal: "gold", label: "22K (916)", fine: 916, on: true },
  { key: "g20", metal: "gold", label: "20K (833)", fine: 833, on: false },
  { key: "g18", metal: "gold", label: "18K (750)", fine: 750, on: true },
  { key: "g14", metal: "gold", label: "14K (585)", fine: 585, on: false },
  { key: "g9", metal: "gold", label: "9K (375)", fine: 375, on: false },
  { key: "s999", metal: "silver", label: "Silver 999", fine: 999, on: true },
  { key: "s925", metal: "silver", label: "Silver 925", fine: 925, on: true },
  { key: "s800", metal: "silver", label: "Silver 800", fine: 800, on: false },
  { key: "p950", metal: "platinum", label: "Platinum 950", fine: 950, on: false },
];

/** How making is charged. per_g: paise per gram of net weight · pct: basis points of the metal value · piece: paise per piece. */
export type MakingKind = "per_g" | "pct" | "piece";
export type ItemType = { key: string; en: string; hi: string; making: MakingKind; makingValue: number; wastageBp: number; hsn: string };
export const DEFAULT_ITEM_TYPES: ItemType[] = [
  { key: "ring", en: "Ring", hi: "अंगूठी", making: "per_g", makingValue: 50000, wastageBp: 0, hsn: "7113" },
  { key: "chain", en: "Chain", hi: "चेन", making: "per_g", makingValue: 40000, wastageBp: 0, hsn: "7113" },
  { key: "bangle", en: "Bangle / Kada", hi: "चूड़ी / कड़ा", making: "per_g", makingValue: 45000, wastageBp: 0, hsn: "7113" },
  { key: "necklace", en: "Necklace / Set", hi: "हार / सेट", making: "pct", makingValue: 1200, wastageBp: 0, hsn: "7113" },
  { key: "mangalsutra", en: "Mangalsutra", hi: "मंगलसूत्र", making: "per_g", makingValue: 50000, wastageBp: 0, hsn: "7113" },
  { key: "earring", en: "Earrings / Tops", hi: "झुमके / टॉप्स", making: "per_g", makingValue: 55000, wastageBp: 0, hsn: "7113" },
  { key: "pendant", en: "Pendant", hi: "पेंडेंट", making: "per_g", makingValue: 50000, wastageBp: 0, hsn: "7113" },
  { key: "nose", en: "Nose pin / Nath", hi: "नथ / लौंग", making: "piece", makingValue: 30000, wastageBp: 0, hsn: "7113" },
  { key: "payal", en: "Payal / Anklet", hi: "पायल", making: "per_g", makingValue: 2000, wastageBp: 0, hsn: "7113" },
  { key: "coin", en: "Coin / Bar", hi: "सिक्का / बिस्किट", making: "piece", makingValue: 0, wastageBp: 0, hsn: "7108" },
  { key: "utensil", en: "Silver article", hi: "चाँदी के बर्तन", making: "per_g", makingValue: 1500, wastageBp: 0, hsn: "7114" },
  { key: "other", en: "Other", hi: "अन्य", making: "per_g", makingValue: 40000, wastageBp: 0, hsn: "7113" },
];

/** The rights of a staff login in Jewellery (the owner has all). */
export const JW_RIGHTS = [
  { key: "bill", en: "Make bills and estimates", hi: "बिल और estimate बनाना" },
  { key: "rate", en: "Set today's rate", hi: "आज का रेट डालना" },
  { key: "orders", en: "Book orders and repairs", hi: "ऑर्डर और रिपेयर बुक करना" },
  { key: "karigar", en: "Karigar ledger (gold given and received)", hi: "कारीगर का हिसाब (सोना दिया-लिया)" },
  { key: "stock", en: "Stock: add pieces, print tags", hi: "स्टॉक: माल चढ़ाना, टैग छापना" },
  { key: "scheme", en: "Gold scheme: members and instalments", hi: "गोल्ड स्कीम: मेंबर और किस्त" },
  { key: "girvi", en: "Girvi: loans, interest, release", hi: "गिरवी: लोन, ब्याज, छुड़ाना" },
  { key: "discount", en: "Give a discount above the counter limit", hi: "counter limit से ज़्यादा discount देना" },
  { key: "cancel", en: "Cancel a bill", hi: "बिल रद्द करना" },
  { key: "reports", en: "See all bills, sales and money", hi: "सारे बिल, बिक्री और पैसे देखना" },
  { key: "setup", en: "Change settings", hi: "Settings बदलना" },
] as const;
export type JwRight = (typeof JW_RIGHTS)[number]["key"];
export const JW_ALL_RIGHTS: JwRight[] = JW_RIGHTS.map((r) => r.key);

/** The shop's Jewellery settings (owner_prefs.crm.jewelSetup). */
export type JwSetup = {
  purities: Purity[];
  items: ItemType[];
  /** GST on metal, stones and wastage, and on making, in basis points. A finished-jewellery sale is one supply at 3%;
   *  the making rate stays a setting until the shop's CA confirms (see the plan's legal points). */
  gstBp: number;
  gstMakingBp: number;
  /** Two-digit GST state code of the shop ("06" Haryana); a customer in another state pays IGST. */
  stateCode: string;
  gstin: string;
  /** BIS registration, printed on the bill. */
  bis: string;
  /** Invoice and estimate number prefixes. */
  billPrefix: string;
  estimatePrefix: string;
  /** Round the bill to the nearest ₹1 or ₹10. */
  roundTo: 1 | 10;
  /** The most discount a counter login may give without the "discount" right, in basis points of the making charge. */
  counterDiscountBp: number;
  /** Ask for PAN when the bill (or the cash on it) is at least this, in paise. */
  panAbovePaise: number;
  /** The rate for old gold: this many basis points below today's 24K sell rate, unless the buy rate is set. */
  oldGoldDeductBp: number;
  /** Printed under the bill. */
  terms: string;
  bank: string;
  /** The bill's heading: the shop's address and phone (the name comes from the business profile unless typed here). */
  shopName: string;
  address: string;
  phone: string;
  /** Staff rights by team row id (crm_agents.id). */
  staff: Record<string, { title: string; rights: JwRight[] }>;
  /** Today's rate is shown on the shop's website and V-Card (and the rate poster can be shared). */
  showRate: boolean;
  /** The stock (pieces in stock) on the shop's website with a "from ₹" price at today's rate (phase 6). */
  showCatalogue: boolean;
  /** Gold saving scheme (phase 5): off until the shop switches it on after the legal note; its plans. */
  schemeOn: boolean;
  plans: SchemePlan[];
  /** Girvi (phase 5): off until switched on with the money-lender licence; interest a month (bp), minimum days, loan limit
   *  as a share of the valuation (bp), the usual term in months. */
  girviOn: boolean;
  girviLicence: string;
  girviRateBp: number;
  girviMinDays: number;
  girviLtvBp: number;
  girviMonths: number;
};
export const DEFAULT_TERMS = "Goods once sold can be exchanged as per shop policy. Weights and purity as per the bill. Subject to local jurisdiction.";
export const DEFAULT_JW_SETUP: JwSetup = {
  purities: DEFAULT_PURITIES, items: DEFAULT_ITEM_TYPES, gstBp: 300, gstMakingBp: 300, stateCode: "", gstin: "", bis: "",
  billPrefix: "INV", estimatePrefix: "EST", roundTo: 1, counterDiscountBp: 1000, panAbovePaise: 20000000, oldGoldDeductBp: 200,
  terms: DEFAULT_TERMS, bank: "", shopName: "", address: "", phone: "", staff: {}, showRate: true, showCatalogue: true,
  schemeOn: false, plans: DEFAULT_PLANS, girviOn: false, girviLicence: "", girviRateBp: 150, girviMinDays: 30, girviLtvBp: 7500, girviMonths: 12,
};

const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** A saved setup made safe: unknown keys dropped, numbers in range, the defaults for anything missing. */
export function cleanJwSetup(v: unknown): JwSetup {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const purities = Array.isArray(s.purities) ? s.purities.slice(0, 40).map((p) => {
    const x = (p ?? {}) as Record<string, unknown>;
    const metal = METALS.some((m) => m.key === x.metal) ? (x.metal as Metal) : "gold";
    return { key: txt(x.key, 20).replace(/[^a-z0-9_]/gi, "") || `p${Math.random().toString(36).slice(2, 7)}`, metal, label: txt(x.label, 30) || "Purity", fine: int(x.fine, 1, 1000, 916), on: x.on !== false };
  }) : DEFAULT_PURITIES;
  const items = Array.isArray(s.items) ? s.items.slice(0, 60).map((p) => {
    const x = (p ?? {}) as Record<string, unknown>;
    const making: MakingKind = x.making === "pct" || x.making === "piece" ? x.making : "per_g";
    return { key: txt(x.key, 20).replace(/[^a-z0-9_]/gi, "") || `i${Math.random().toString(36).slice(2, 7)}`, en: txt(x.en, 40) || "Item", hi: txt(x.hi, 40) || txt(x.en, 40) || "Item", making, makingValue: int(x.makingValue, 0, 1e9, 0), wastageBp: int(x.wastageBp, 0, 5000, 0), hsn: txt(x.hsn, 8) || "7113" };
  }) : DEFAULT_ITEM_TYPES;
  const staff: JwSetup["staff"] = {};
  if (s.staff && typeof s.staff === "object") {
    for (const [id, st] of Object.entries(s.staff as Record<string, unknown>).slice(0, 100)) {
      const x = (st ?? {}) as Record<string, unknown>;
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      staff[id] = { title: txt(x.title, 30) || "Staff", rights: (Array.isArray(x.rights) ? x.rights : []).filter((r): r is JwRight => JW_ALL_RIGHTS.includes(r as JwRight)) };
    }
  }
  return {
    purities: purities.length ? purities : DEFAULT_PURITIES,
    items: items.length ? items : DEFAULT_ITEM_TYPES,
    gstBp: int(s.gstBp, 0, 2800, 300),
    gstMakingBp: int(s.gstMakingBp, 0, 2800, 300),
    stateCode: /^\d{2}$/.test(String(s.stateCode ?? "")) ? String(s.stateCode) : "",
    gstin: txt(s.gstin, 15).toUpperCase(),
    bis: txt(s.bis, 30),
    billPrefix: String(s.billPrefix ?? "").replace(/[^A-Za-z0-9/-]/g, "").slice(0, 8) || "INV",
    estimatePrefix: String(s.estimatePrefix ?? "").replace(/[^A-Za-z0-9/-]/g, "").slice(0, 8) || "EST",
    roundTo: s.roundTo === 10 ? 10 : 1,
    counterDiscountBp: int(s.counterDiscountBp, 0, 10000, 1000),
    panAbovePaise: int(s.panAbovePaise, 0, 1e12, 20000000),
    oldGoldDeductBp: int(s.oldGoldDeductBp, 0, 3000, 200),
    terms: String(s.terms ?? DEFAULT_TERMS).slice(0, 600),
    bank: String(s.bank ?? "").slice(0, 300),
    shopName: txt(s.shopName, 80), address: String(s.address ?? "").slice(0, 300), phone: txt(s.phone, 30),
    staff,
    showRate: s.showRate !== false,
    showCatalogue: s.showCatalogue !== false,
    plans: Array.isArray(s.plans) ? s.plans.slice(0, 10).map(cleanPlan).filter((p): p is SchemePlan => !!p) : DEFAULT_PLANS,
    girviLicence: txt(s.girviLicence, 60),
    girviRateBp: int(s.girviRateBp, 0, 1000, 150),
    girviMinDays: int(s.girviMinDays, 0, 365, 30),
    girviLtvBp: int(s.girviLtvBp, 1000, 10000, 7500),
    girviMonths: int(s.girviMonths, 1, 60, 12),
    // On only by the shop's own choice; girvi also needs the licence typed.
    schemeOn: s.schemeOn === true,
    girviOn: s.girviOn === true && txt(s.girviLicence, 60).length >= 3,
  };
}

/* ---------------- today's rate ---------------- */

/** Rates of one day: paise per gram, sell and buy, by purity key. */
export type RateBook = { day: string; sell: Record<string, number>; buy: Record<string, number> };

/** The sell rate for a purity: typed, else worked out from the 24K rate of the same metal by fineness. */
export function sellRate(book: RateBook | null, setup: JwSetup, purityKey: string): number {
  if (!book) return 0;
  if (book.sell[purityKey]) return book.sell[purityKey];
  const p = setup.purities.find((x) => x.key === purityKey);
  if (!p) return 0;
  const base = setup.purities.filter((x) => x.metal === p.metal && book.sell[x.key]).sort((a, b) => b.fine - a.fine)[0];
  return base ? Math.round((book.sell[base.key] * p.fine) / base.fine) : 0;
}
/** Paise per gram of FINE metal (999) for old metal of this kind: the buy rate typed for it, else the top sell rate less the deduction. */
export function fineBuyRate(book: RateBook | null, setup: JwSetup, metal: Metal): number {
  if (!book) return 0;
  const top = setup.purities.filter((x) => x.metal === metal).sort((a, b) => b.fine - a.fine);
  for (const p of top) if (book.buy[p.key]) return Math.round((book.buy[p.key] * 1000) / p.fine);
  const s = top.find((p) => book.sell[p.key]);
  if (!s) return 0;
  const fine = (book.sell[s.key] * 1000) / s.fine;
  return Math.round(fine * (10000 - setup.oldGoldDeductBp) / 10000);
}

/* ---------------- the bill ---------------- */

export type BillLine = {
  desc: string; itemType: string; purity: string; pieces: number;
  grossMg: number; stoneMg: number; netMg: number;
  /** paise per gram used for this line (today's rate unless changed) */
  rate: number;
  wastageBp: number;
  making: MakingKind; makingValue: number;
  stonePaise: number; otherPaise: number;
  huid: string; hsn: string; tag: string;
};
export type OldGoldLine = { desc: string; metal: Metal; grossMg: number; lessMg: number; touchBp: number; rate: number };
export type Payment = { mode: "cash" | "upi" | "card" | "bank" | "cheque" | "other"; paise: number; ref: string; at: string };

export type LineAmounts = { netMg: number; fineMg: number; metal: number; wastage: number; making: number; stone: number; other: number; goods: number; total: number };
/** One line: net = gross − stones (unless typed), metal = rate × net, wastage on the metal, making by its rule. */
export function lineAmounts(l: BillLine, setup?: Pick<JwSetup, "purities">): LineAmounts {
  const netMg = l.netMg > 0 ? l.netMg : Math.max(0, l.grossMg - l.stoneMg);
  const fine = setup?.purities.find((p) => p.key === l.purity)?.fine ?? 0;
  const metal = Math.round((l.rate * netMg) / 1000);
  const wastage = Math.round((metal * l.wastageBp) / 10000);
  const making = l.making === "pct" ? Math.round(((metal + wastage) * l.makingValue) / 10000)
    : l.making === "piece" ? l.makingValue * Math.max(1, l.pieces)
    : Math.round((l.makingValue * netMg) / 1000);
  const goods = metal + wastage + l.stonePaise + l.otherPaise;
  return { netMg, fineMg: Math.round((netMg * fine) / 1000), metal, wastage, making, stone: l.stonePaise, other: l.otherPaise, goods, total: goods + making };
}

export type OldAmounts = { netMg: number; fineMg: number; value: number };
/** Old metal: net = gross − less (stones, dirt), fine = net × touch, value = fine × the fine buy rate. */
export function oldAmounts(o: OldGoldLine): OldAmounts {
  const netMg = Math.max(0, o.grossMg - o.lessMg);
  const fineMg = Math.round((netMg * o.touchBp) / 10000);
  return { netMg, fineMg, value: Math.round((o.rate * fineMg) / 1000) };
}

export type BillInput = {
  lines: BillLine[]; old: OldGoldLine[]; payments: Payment[];
  /** discount in paise; "making" takes it off the making charge, "total" off the whole bill before tax */
  discountPaise: number; discountOn: "making" | "total";
  /** the customer's GST state code; another state than the shop's means IGST */
  customerState: string;
  /** an advance already paid on an order, taken off */
  advancePaise: number;
};
export type BillTotals = {
  lines: LineAmounts[]; old: OldAmounts[];
  goods: number; making: number; discount: number; taxableGoods: number; taxableMaking: number; taxable: number;
  cgst: number; sgst: number; igst: number; gst: number;
  roundOff: number; total: number; oldValue: number; advance: number; paid: number; balance: number;
  netMg: number; fineMg: number;
};
/** The whole bill, step by step, the way a jeweller works it on paper. */
export function billTotals(b: BillInput, setup: Pick<JwSetup, "gstBp" | "gstMakingBp" | "stateCode" | "roundTo" | "purities">): BillTotals {
  const lines = b.lines.map((l) => lineAmounts(l, setup));
  const old = b.old.map(oldAmounts);
  const goods = lines.reduce((a, x) => a + x.goods, 0);
  const making = lines.reduce((a, x) => a + x.making, 0);
  const disc = Math.max(0, Math.round(b.discountPaise));
  let taxableGoods = goods, taxableMaking = making, discount = 0;
  if (b.discountOn === "making") {
    discount = Math.min(disc, making);
    taxableMaking = making - discount;
  } else {
    discount = Math.min(disc, goods + making);
    // split over goods and making by their share, so each keeps its own tax rate
    const offMaking = goods + making ? Math.round((discount * making) / (goods + making)) : 0;
    taxableMaking = making - offMaking;
    taxableGoods = goods - (discount - offMaking);
  }
  const taxGoods = Math.round((taxableGoods * setup.gstBp) / 10000);
  const taxMaking = Math.round((taxableMaking * setup.gstMakingBp) / 10000);
  const gst = taxGoods + taxMaking;
  const inter = !!setup.stateCode && !!b.customerState && b.customerState !== setup.stateCode;
  const igst = inter ? gst : 0;
  const cgst = inter ? 0 : Math.floor(gst / 2);
  const sgst = inter ? 0 : gst - cgst;
  const before = taxableGoods + taxableMaking + gst;
  const step = setup.roundTo * 100;
  const total = Math.round(before / step) * step;
  const oldValue = old.reduce((a, x) => a + x.value, 0);
  const advance = Math.max(0, Math.round(b.advancePaise));
  const paid = b.payments.reduce((a, p) => a + Math.max(0, Math.round(p.paise)), 0);
  return {
    lines, old, goods, making, discount, taxableGoods, taxableMaking, taxable: taxableGoods + taxableMaking,
    cgst, sgst, igst, gst, roundOff: total - before, total, oldValue, advance, paid,
    balance: total - oldValue - advance - paid,
    netMg: lines.reduce((a, x) => a + x.netMg, 0), fineMg: lines.reduce((a, x) => a + x.fineMg, 0),
  };
}

/* ---------------- what the screens and the API share ---------------- */

export type BillKind = "sale" | "estimate";
export type BillStatus = "open" | "paid" | "cancelled" | "converted";
export type BillRow = {
  id: string; owner_id: string; kind: BillKind; number: number; code: string; status: BillStatus;
  customer_name: string; customer_phone: string; customer_pan: string; customer_gstin: string; customer_state: string; customer_address: string;
  lines: BillLine[]; old_gold: OldGoldLine[]; payments: Payment[];
  discount_paise: number; discount_on: "making" | "total"; advance_paise: number;
  total_paise: number; balance_paise: number; gst_paise: number;
  rate_day: string; notes: string; due_date: string | null; valid_till: string | null;
  from_estimate: string | null; token: string;
  created_by: string | null; created_by_name: string; cancel_reason: string;
  created_at: string; updated_at: string;
};
export const BILL_COLS = "id,owner_id,kind,number,code,status,customer_name,customer_phone,customer_pan,customer_gstin,customer_state,customer_address,lines,old_gold,payments,discount_paise,discount_on,advance_paise,total_paise,balance_paise,gst_paise,rate_day,notes,due_date,valid_till,from_estimate,token,created_by,created_by_name,cancel_reason,created_at,updated_at";

export const billInputOf = (b: Pick<BillRow, "lines" | "old_gold" | "payments" | "discount_paise" | "discount_on" | "customer_state" | "advance_paise">): BillInput => ({
  lines: b.lines ?? [], old: b.old_gold ?? [], payments: b.payments ?? [], discountPaise: b.discount_paise ?? 0,
  discountOn: b.discount_on === "total" ? "total" : "making", customerState: b.customer_state ?? "", advancePaise: b.advance_paise ?? 0,
});

/** One line from a request or a draft, made safe (numbers whole, in range). */
export function cleanLine(v: unknown): BillLine {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const making: MakingKind = x.making === "pct" || x.making === "piece" ? x.making : "per_g";
  return {
    desc: txt(x.desc, 80), itemType: txt(x.itemType, 20), purity: txt(x.purity, 20), pieces: int(x.pieces, 1, 999, 1),
    grossMg: int(x.grossMg, 0, 1e8, 0), stoneMg: int(x.stoneMg, 0, 1e8, 0), netMg: int(x.netMg, 0, 1e8, 0),
    rate: int(x.rate, 0, 1e9, 0), wastageBp: int(x.wastageBp, 0, 5000, 0), making, makingValue: int(x.makingValue, 0, 1e10, 0),
    stonePaise: int(x.stonePaise, 0, 1e11, 0), otherPaise: int(x.otherPaise, 0, 1e10, 0),
    huid: txt(x.huid, 12).toUpperCase().replace(/[^A-Z0-9]/g, ""), hsn: txt(x.hsn, 8) || "7113", tag: txt(x.tag, 30),
  };
}
export function cleanOld(v: unknown): OldGoldLine {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const metal: Metal = METALS.some((m) => m.key === x.metal) ? (x.metal as Metal) : "gold";
  return { desc: txt(x.desc, 80), metal, grossMg: int(x.grossMg, 0, 1e8, 0), lessMg: int(x.lessMg, 0, 1e8, 0), touchBp: int(x.touchBp, 0, 10000, 9160), rate: int(x.rate, 0, 1e9, 0) };
}
export function cleanPayment(v: unknown): Payment | null {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const paise = int(x.paise, 0, 1e12, 0);
  if (!paise) return null;
  const mode = (["cash", "upi", "card", "bank", "cheque", "other"] as const).find((m) => m === x.mode) ?? "cash";
  return { mode, paise, ref: txt(x.ref, 40), at: typeof x.at === "string" && !Number.isNaN(Date.parse(x.at)) ? x.at : new Date().toISOString() };
}

/* ---------------- formatting ---------------- */

/** "12.345 g" from milligrams (3 decimals, as a jeweller writes it). */
export const grams = (mg: number) => `${(mg / 1000).toFixed(3)} g`;
/** Milligrams from what was typed in grams ("12.345" → 12345). */
export const mgOf = (g: string | number) => Math.max(0, Math.round(Number(String(g).replace(/,/g, "")) * 1000) || 0);
/** "₹1,23,456.78", Indian grouping; whole rupees drop the paise. */
export function inr(paise: number, withPaise = false): string {
  const neg = paise < 0; const v = Math.abs(paise) / 100;
  const s = v.toLocaleString("en-IN", { minimumFractionDigits: withPaise ? 2 : 0, maximumFractionDigits: withPaise ? 2 : 0 });
  return `${neg ? "−" : ""}₹${s}`;
}
export const paiseOf = (r: string | number) => Math.max(0, Math.round(Number(String(r).replace(/[,₹\s]/g, "")) * 100) || 0);
export const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 ? 2 : 0)}%`;

/** Rupees in Indian words for the bill ("One Lakh Twenty Three Thousand … Rupees Only"). */
export function inWords(paise: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`);
  const three = (n: number) => `${n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? " " : ""}` : ""}${n % 100 ? two(n % 100) : ""}`;
  let r = Math.floor(Math.abs(paise) / 100);
  if (!r) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(r / 1e7); r %= 1e7;
  const lakh = Math.floor(r / 1e5); r %= 1e5;
  const thousand = Math.floor(r / 1000); r %= 1000;
  if (crore) parts.push(`${crore >= 100 ? three(crore) : two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (r) parts.push(three(r));
  return `${parts.join(" ")} Rupees Only`;
}

/** Indian financial year of a date ("2026-27"), for bill numbers. */
export function finYear(d = new Date()): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

/** The WhatsApp to the customer with the bill (or estimate) and its link. */
export function billMessage(b: Pick<BillRow, "kind" | "code" | "customer_name" | "total_paise" | "balance_paise">, shop: string, link: string, hi = true): string {
  const name = b.customer_name?.trim() ? `${b.customer_name.trim()} जी` : "";
  if (b.kind === "estimate") {
    return hi
      ? [`नमस्ते ${name} 🙏`, `${shop} से आपका estimate ${b.code}: ${inr(b.total_paise)}`, `पूरा estimate देखें: ${link}`, "रेट आज के हिसाब से है।"].join("\n")
      : [`Hello ${b.customer_name || ""} 🙏`, `Your estimate ${b.code} from ${shop}: ${inr(b.total_paise)}`, `See it here: ${link}`, "Prices are at today's rate."].join("\n");
  }
  const due = b.balance_paise > 0 ? (hi ? `बाकी: ${inr(b.balance_paise)}` : `Balance due: ${inr(b.balance_paise)}`) : (hi ? "पूरा भुगतान मिल गया ✅" : "Fully paid ✅");
  return hi
    ? [`नमस्ते ${name} 🙏`, `${shop} से खरीदारी के लिए धन्यवाद।`, `बिल ${b.code}: ${inr(b.total_paise)}`, due, `बिल देखें / डाउनलोड करें: ${link}`].join("\n")
    : [`Hello ${b.customer_name || ""} 🙏`, `Thank you for shopping at ${shop}.`, `Bill ${b.code}: ${inr(b.total_paise)}`, due, `View / download: ${link}`].join("\n");
}

/** "Today's rate" for WhatsApp, the card and the poster. */
/** The rate as the public sees it (website, V-Card, poster): the shop's switched-on purities that have a rate, gold and platinum
 *  per 10 g, silver per 1 kg (how shops quote it). At most 6 rows. */
export type PublicRate = { day: string; rows: { label: string; metal: Metal; paise: number; unit: "10 g" | "1 kg" }[] };
export function publicRate(book: RateBook | null, setup: JwSetup): PublicRate | null {
  if (!book) return null;
  const rows = setup.purities.filter((p) => p.on).map((p) => {
    const g = sellRate(book, setup, p.key);
    return { label: p.label, metal: p.metal, paise: p.metal === "silver" ? g * 1000 : g * 10, unit: (p.metal === "silver" ? "1 kg" : "10 g") as "10 g" | "1 kg" };
  }).filter((x) => x.paise > 0).slice(0, 6);
  return rows.length ? { day: book.day, rows } : null;
}

export function rateMessage(book: RateBook, setup: JwSetup, shop: string): string {
  const lines = (publicRate(book, setup)?.rows ?? []).map((r) => `${r.label}: ${inr(r.paise)} / ${r.unit}`);
  return [`✨ ${shop} — आज का रेट (${new Date(`${book.day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`, ...lines, "GST अलग।"].join("\n");
}
