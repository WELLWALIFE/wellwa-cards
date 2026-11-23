import "server-only";
// Shubhora Jewellery, phase 2 — orders, repairs and the karigar ledger, server side. Service role only; the rights checks are in
// the API routes (jwCtx / jwHas from lib/jewellery-server.ts).
import { restAsService } from "@/lib/poster-server";
import { shopName, shopSend } from "@/lib/jobs-server";
import type { Scope } from "@/lib/crm-server";
import { SITE_URL } from "@/lib/site-url";
import { finYear } from "@/lib/jewellery";
import { istDay, isUuid, linkCustomerPhone } from "@/lib/jewellery-server";
import {
  ORDER_COLS, TXN_COLS, karigarBalance, orderMessage,
  type Karigar, type KarigarBalance, type KarigarTxn, type OrderKind, type OrderRow,
} from "@/lib/jewellery-orders";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

/* ---------------- orders ---------------- */

async function nextOrderNumber(ownerId: string, kind: OrderKind, fy: string): Promise<number> {
  const last = list(await restAsService<{ number: number }[]>(`jw_orders?owner_id=eq.${ownerId}&kind=eq.${kind}&fin_year=eq.${fy}&select=number&order=number.desc&limit=1`))[0];
  return (last?.number ?? 0) + 1;
}

export type NewOrder = Pick<OrderRow, "customer_name" | "customer_phone" | "items" | "est_paise" | "payments" | "rate_lock" | "due_date" | "karigar_id" | "notes" | "created_by" | "created_by_name">;

export async function createOrder(scope: Scope, kind: OrderKind, f: NewOrder): Promise<OrderRow | null> {
  const fy = finYear(new Date(`${istDay()}T12:00:00`));
  const prefix = kind === "order" ? "ORD" : "REP";
  for (let tries = 0; tries < 4; tries++) {
    const number = await nextOrderNumber(scope.ownerId, kind, fy);
    const row = {
      ...f, owner_id: scope.ownerId, kind, number, fin_year: fy, code: `${prefix}/${fy}/${number}`,
      status: f.karigar_id ? "karigar" : "booked",
      events: [{ at: new Date().toISOString(), by: f.created_by_name, text: kind === "order" ? "Order booked" : "Repair received" }],
    };
    const r = await restAsService<OrderRow[]>(`jw_orders?select=${ORDER_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (r.ok) {
      const o = list(r)[0] ?? null;
      if (o?.customer_phone) await linkCustomerPhone(scope.ownerId, o.customer_phone, o.customer_name, `💍 ${kind === "order" ? "Order" : "Repair"} ${o.code}`, kind === "order" ? "interested" : null).catch((e) => console.error("[jewellery] crm link", e));
      return o;
    }
    if (r.status !== 409 && !/duplicate key/i.test(r.text)) { console.error("[jewellery] order save", r.status, r.text.slice(0, 200)); return null; }
  }
  return null;
}

export async function orderById(ownerId: string, id: string): Promise<OrderRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<OrderRow[]>(`jw_orders?id=eq.${id}&owner_id=eq.${ownerId}&select=${ORDER_COLS}&limit=1`))[0] ?? null;
}

export async function patchOrder(ownerId: string, id: string, patch: Record<string, unknown>): Promise<OrderRow | null> {
  const r = await restAsService<OrderRow[]>(`jw_orders?id=eq.${id}&owner_id=eq.${ownerId}&select=${ORDER_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  return r.ok ? list(r)[0] ?? null : null;
}

/** The customer's own receipt (no login): /jo/<id>?t=<token>. */
export const orderLink = (o: Pick<OrderRow, "id" | "token">) => `${SITE_URL}/jo/${o.id}?t=${o.token}`;

/** Sends the step's message from the shop's WhatsApp; else hands back a wa.me link to send by hand. */
export async function sendOrder(scope: Scope, o: OrderRow): Promise<{ sent: boolean; link: string; error?: string }> {
  const shop = await shopName(scope.ownerId);
  const text = orderMessage(o, shop || "हमारी दुकान", orderLink(o));
  const link = o.customer_phone ? `https://wa.me/${o.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!o.customer_phone) return { sent: false, link, error: "No customer number on this order." };
  if (!(await shopSend(scope, o.customer_phone, text))) return { sent: false, link, error: "The shop's WhatsApp is not linked — send it with the button." };
  return { sent: true, link };
}

/* ---------------- karigars ---------------- */

export async function karigarsOf(ownerId: string, all = false): Promise<Karigar[]> {
  return list(await restAsService<Karigar[]>(`jw_karigars?owner_id=eq.${ownerId}${all ? "" : "&active=is.true"}&select=id,owner_id,name,phone,skill,active,created_at&order=name&limit=300`));
}
export async function karigarById(ownerId: string, id: string): Promise<Karigar | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<Karigar[]>(`jw_karigars?id=eq.${id}&owner_id=eq.${ownerId}&select=id,owner_id,name,phone,skill,active,created_at&limit=1`))[0] ?? null;
}
export async function txnsOf(ownerId: string, karigarId?: string, limit = 500): Promise<KarigarTxn[]> {
  return list(await restAsService<KarigarTxn[]>(`jw_karigar_txns?owner_id=eq.${ownerId}${karigarId ? `&karigar_id=eq.${karigarId}` : ""}&select=${TXN_COLS}&order=created_at.desc&limit=${limit}`));
}
/** Every karigar's balance, by id (one read of the owner's ledger). */
export async function balancesOf(ownerId: string): Promise<Record<string, KarigarBalance>> {
  const rows = await txnsOf(ownerId, undefined, 5000);
  const by: Record<string, KarigarTxn[]> = {};
  for (const t of rows) (by[t.karigar_id] ??= []).push(t);
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, karigarBalance(v)]));
}
