// Shubhora Jewellery, phase 2 — customer orders and repairs, and the karigar's fine-gold ledger (owner, 23 Nov 2026: "do it").
// The shared, pure part (tested in jewellery.test.mjs). Same units as src/lib/jewellery.ts: paise, milligrams, basis points.
//
// An ORDER is a piece to be made: booked with an advance (and, if the customer wants, today's rate locked for it), given to a
// karigar, ready, and delivered with a GST bill (the bill builder opens filled from the order, the advance already counted).
// A REPAIR is the customer's own piece left with the shop: its weight when received is written down (proof for both sides), the
// charge is agreed, and it is delivered against the charge.
// The KARIGAR LEDGER keeps what every karigar holds of the shop's metal, in fine weight: gold issued (gross × touch), work received
// back (gross × touch), and the wastage allowed on it. Labour earned and money paid run in rupees beside it.
import { cleanPayment, inr, type Metal, type Payment } from "@/lib/jewellery";

export type OrderKind = "order" | "repair";
export type OrderStatus = "booked" | "karigar" | "ready" | "delivered" | "cancelled";
export const ORDER_STATUSES: { key: OrderStatus; en: string; hi: string }[] = [
  { key: "booked", en: "Booked", hi: "बुक" },
  { key: "karigar", en: "With karigar", hi: "कारीगर के पास" },
  { key: "ready", en: "Ready", hi: "तैयार" },
  { key: "delivered", en: "Delivered", hi: "दे दिया" },
  { key: "cancelled", en: "Cancelled", hi: "रद्द" },
];

/** One piece of an order or a repair. weightMg: the expected weight (order) or the weight when received (repair). */
export type OrderItem = { desc: string; itemType: string; purity: string; weightMg: number; size: string; work: string; pieces: number };
export type RateLock = { purity: string; rate: number; day: string };
export type OrderEvent = { at: string; by: string; text: string };

export type OrderRow = {
  id: string; owner_id: string; kind: OrderKind; number: number; fin_year: string; code: string; status: OrderStatus;
  customer_name: string; customer_phone: string; items: OrderItem[]; est_paise: number; payments: Payment[];
  rate_lock: RateLock | null; due_date: string | null; karigar_id: string | null; notes: string; events: OrderEvent[];
  bill_id: string | null; token: string; created_by: string | null; created_by_name: string; cancel_reason: string;
  delivered_at: string | null; created_at: string; updated_at: string;
};
export const ORDER_COLS = "id,owner_id,kind,number,fin_year,code,status,customer_name,customer_phone,items,est_paise,payments,rate_lock,due_date,karigar_id,notes,events,bill_id,token,created_by,created_by_name,cancel_reason,delivered_at,created_at,updated_at";

export type Karigar = { id: string; owner_id: string; name: string; phone: string; skill: string; active: boolean; created_at: string };
export type TxnKind = "issue" | "receive" | "labour" | "payment";
export const TXN_KINDS: { key: TxnKind; en: string; hi: string; help: string }[] = [
  { key: "issue", en: "Gold given", hi: "सोना दिया", help: "Metal handed to the karigar (gross weight and its purity)." },
  { key: "receive", en: "Work received", hi: "माल आया", help: "Finished piece or metal back from the karigar, with the wastage you allow." },
  { key: "labour", en: "Labour (majdoori)", hi: "मज़दूरी", help: "What you owe the karigar for the work." },
  { key: "payment", en: "Money paid", hi: "पैसे दिए", help: "Money you paid the karigar." },
];
export type KarigarTxn = {
  id: string; owner_id: string; karigar_id: string; order_id: string | null; kind: TxnKind; metal: Metal;
  gross_mg: number; touch_bp: number; fine_mg: number; wastage_mg: number; paise: number; note: string; day: string;
  voided: boolean; created_by_name: string; created_at: string;
};
export const TXN_COLS = "id,owner_id,karigar_id,order_id,kind,metal,gross_mg,touch_bp,fine_mg,wastage_mg,paise,note,day,voided,created_by_name,created_at";

const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Fine weight of `grossMg` at `touchBp` (9160 = 91.6%), to the milligram. */
export const fineOf = (grossMg: number, touchBp: number) => Math.round((Math.max(0, grossMg) * Math.max(0, Math.min(10000, touchBp))) / 10000);

export function cleanOrderItem(v: unknown): OrderItem {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { desc: txt(x.desc, 80), itemType: txt(x.itemType, 20), purity: txt(x.purity, 20), weightMg: int(x.weightMg, 0, 1e8, 0), size: txt(x.size, 30), work: txt(x.work, 160), pieces: int(x.pieces, 1, 999, 1) };
}
export function cleanRateLock(v: unknown): RateLock | null {
  const x = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
  if (!x) return null;
  const rate = int(x.rate, 0, 1e9, 0);
  if (!rate || !txt(x.purity, 20)) return null;
  return { purity: txt(x.purity, 20), rate, day: /^\d{4}-\d{2}-\d{2}$/.test(String(x.day)) ? String(x.day) : "" };
}
export const cleanPayments = (v: unknown): Payment[] => (Array.isArray(v) ? v.slice(0, 50).map(cleanPayment).filter((p): p is Payment => !!p) : []);

/** Advance paid on an order so far. */
export const orderPaid = (o: Pick<OrderRow, "payments">) => (o.payments ?? []).reduce((a, p) => a + (p.paise || 0), 0);

/** One ledger entry made safe; the fine weight is always worked out here, never taken from the app. */
export function cleanTxn(v: unknown): Pick<KarigarTxn, "kind" | "metal" | "gross_mg" | "touch_bp" | "fine_mg" | "wastage_mg" | "paise" | "note"> | null {
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const kind = TXN_KINDS.find((k) => k.key === x.kind)?.key;
  if (!kind) return null;
  const metal: Metal = x.metal === "silver" || x.metal === "platinum" ? x.metal : "gold";
  const note = txt(x.note, 160);
  if (kind === "labour" || kind === "payment") {
    const paise = int(x.paise, 0, 1e11, 0);
    return paise ? { kind, metal, gross_mg: 0, touch_bp: 0, fine_mg: 0, wastage_mg: 0, paise, note } : null;
  }
  const gross = int(x.gross_mg, 0, 1e9, 0);
  const touch = int(x.touch_bp, 0, 10000, 0);
  const wastage = kind === "receive" ? int(x.wastage_mg, 0, 1e8, 0) : 0;
  if (!gross && !wastage) return null;
  return { kind, metal, gross_mg: gross, touch_bp: touch, fine_mg: fineOf(gross, touch), wastage_mg: wastage, paise: 0, note };
}

export type KarigarBalance = { fine: Record<Metal, number>; money: number; issued: Record<Metal, number>; received: Record<Metal, number>; wastage: Record<Metal, number> };
/** What the karigar holds of the shop's metal (fine mg; positive = the karigar owes it back) and what the shop owes the karigar
 *  in money (positive = to pay). Voided entries do not count. */
export function karigarBalance(txns: Pick<KarigarTxn, "kind" | "metal" | "fine_mg" | "wastage_mg" | "paise" | "voided">[]): KarigarBalance {
  const z = (): Record<Metal, number> => ({ gold: 0, silver: 0, platinum: 0 });
  const b: KarigarBalance = { fine: z(), money: 0, issued: z(), received: z(), wastage: z() };
  for (const t of txns) {
    if (t.voided) continue;
    const m: Metal = t.metal === "silver" || t.metal === "platinum" ? t.metal : "gold";
    if (t.kind === "issue") { b.fine[m] += t.fine_mg; b.issued[m] += t.fine_mg; }
    else if (t.kind === "receive") { b.fine[m] -= t.fine_mg + t.wastage_mg; b.received[m] += t.fine_mg; b.wastage[m] += t.wastage_mg; }
    else if (t.kind === "labour") b.money += t.paise;
    else if (t.kind === "payment") b.money -= t.paise;
  }
  return b;
}

/** Orders still in the shop's hands, by urgency: late first, then due soonest, then the rest. */
export function overdue(o: Pick<OrderRow, "status" | "due_date">, today: string): boolean {
  return !!o.due_date && o.due_date < today && (o.status === "booked" || o.status === "karigar");
}

const dayText = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

/** The customer's WhatsApp line at each step. */
export function orderMessage(o: Pick<OrderRow, "kind" | "code" | "customer_name" | "est_paise" | "due_date" | "status" | "payments" | "items">, shop: string, link: string, hi = true): string {
  const name = o.customer_name?.trim() ? `${o.customer_name.trim()} जी` : "";
  const what = o.items.map((i) => i.desc).filter(Boolean).slice(0, 3).join(", ") || (o.kind === "repair" ? "repair" : "order");
  const paid = orderPaid(o);
  const due = Math.max(0, o.est_paise - paid);
  if (o.status === "ready") {
    return hi
      ? [`नमस्ते ${name} 🙏`, `${shop}: आपका ${o.kind === "repair" ? "repair" : "order"} ${o.code} (${what}) तैयार है ✨`, o.kind === "repair" && due > 0 ? `बाकी: ${inr(due)}` : "", "दुकान पर आकर ले जाइए।", `Receipt: ${link}`].filter(Boolean).join("\n")
      : [`Hello ${o.customer_name || ""} 🙏`, `${shop}: your ${o.kind} ${o.code} (${what}) is ready ✨`, o.kind === "repair" && due > 0 ? `Balance: ${inr(due)}` : "", "Please collect it from the shop.", `Receipt: ${link}`].filter(Boolean).join("\n");
  }
  if (o.status === "delivered") {
    return hi ? [`धन्यवाद ${name} 🙏`, `${shop}: ${o.code} आपको दे दिया गया। फिर से सेवा का मौका दें।`].join("\n") : [`Thank you ${o.customer_name || ""} 🙏`, `${shop}: ${o.code} has been delivered.`].join("\n");
  }
  return hi
    ? [`नमस्ते ${name} 🙏`, `${shop} में आपका ${o.kind === "repair" ? "repair" : "order"} ${o.code} बुक हो गया: ${what}`, paid ? `Advance मिला: ${inr(paid)}` : "", o.due_date ? `तैयार होने की तारीख़: ${dayText(o.due_date)}` : "", `Receipt: ${link}`].filter(Boolean).join("\n")
    : [`Hello ${o.customer_name || ""} 🙏`, `Your ${o.kind} ${o.code} at ${shop} is booked: ${what}`, paid ? `Advance received: ${inr(paid)}` : "", o.due_date ? `Ready by: ${dayText(o.due_date)}` : "", `Receipt: ${link}`].filter(Boolean).join("\n");
}
