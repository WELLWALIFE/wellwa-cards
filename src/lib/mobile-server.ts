import "server-only";
// Shubhora Mobile Shop — server side (plan https://claude.ai/artifact/Ji6XdzU2WzSU8eHGgmjEyd). Every call goes through the service
// role; the rights checks live here, like Jewellery (lib/jewellery-server.ts): the owner → everything; a staff login → the rights
// the owner gave it in Mobile → Settings (a manager with nothing set gets all, an agent can make bills).
import { NextResponse } from "next/server";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { addonGate } from "@/lib/addons-server";
import { resolveScope, type Scope } from "@/lib/crm-server";
import { shopName, shopSend } from "@/lib/jobs-server";
import { SITE_URL } from "@/lib/site-url";
import { finYear } from "@/lib/jewellery";
import { istDay, isUuid, linkCustomerPhone } from "@/lib/jewellery-server";
import {
  BILL_COLS, DEFAULT_MS_SETUP, ITEM_COLS, MS_ALL_RIGHTS, UNIT_COLS, billInputOf, billMessage, billTotals, cleanCode, cleanMsSetup,
  type BillKind, type BillLine, type BillRow, type ItemRow, type MsRight, type MsSetup, type UnitRow,
} from "@/lib/mobile";
import type { MsAccess } from "@/lib/mobile-types";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const setupMemo = new Map<string, { v: MsSetup; until: number }>();

export async function msSetup(ownerId: string): Promise<MsSetup> {
  const hit = setupMemo.get(ownerId);
  if (hit && hit.until > Date.now()) return hit.v;
  const r = list(await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`))[0];
  const v = r?.crm?.mobileSetup ? cleanMsSetup(r.crm.mobileSetup) : DEFAULT_MS_SETUP;
  setupMemo.set(ownerId, { v, until: Date.now() + 60_000 });
  return v;
}
export async function saveMsSetup(ownerId: string, setup: MsSetup): Promise<boolean> {
  const crm = list(await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`))[0]?.crm ?? {};
  const clean = cleanMsSetup(setup);
  const r = await restAsService("owner_prefs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: ownerId, crm: { ...crm, mobileSetup: clean }, updated_at: new Date().toISOString() }) });
  if (r.ok) setupMemo.set(ownerId, { v: clean, until: Date.now() + 60_000 });
  return r.ok;
}

export const msHas = (a: MsAccess, right: MsRight) => a.owner || a.rights.includes(right);
export const msDenied = (what: string) => NextResponse.json({ error: `You do not have the right to ${what}. Ask the owner (Mobile shop → Settings → Staff).` }, { status: 403 });

export async function msCtx(request: Request, as: string | null): Promise<{ ok: true; scope: Scope; setup: MsSetup; access: MsAccess } | { ok: false; res: NextResponse }> {
  const me = await userFromRequest(request);
  if (!me) return { ok: false, res: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  const scope = await resolveScope(me, as);
  if (!scope) return { ok: false, res: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  const [gate, setup, row, prof] = await Promise.all([
    addonGate(scope.ownerId, "mobile"),
    msSetup(scope.ownerId),
    scope.role === "owner" ? Promise.resolve(null) : restAsService<{ id: string; name: string }[]>(`crm_agents?owner_id=eq.${scope.ownerId}&agent_user_id=eq.${scope.userId}&active=is.true&select=id,name&limit=1`).then((r) => list(r)[0] ?? null),
    restAsService<{ full_name: string | null }[]>(`profiles?id=eq.${scope.userId}&select=full_name&limit=1`).then((r) => list(r)[0]?.full_name ?? ""),
  ]);
  if (gate) return { ok: false, res: gate };
  const name = (row?.name || prof || "").trim().slice(0, 60);
  if (scope.role === "owner") return { ok: true, scope, setup, access: { title: "Owner", rights: MS_ALL_RIGHTS, owner: true, name: name || "Owner" } };
  const st = row ? setup.staff[row.id] : undefined;
  const rights: MsRight[] = st ? st.rights : scope.role === "manager" ? MS_ALL_RIGHTS : ["bill"];
  return { ok: true, scope, setup, access: { title: st?.title || (scope.role === "manager" ? "Manager" : "Counter"), rights, owner: false, name } };
}

/** Cost and profit are for those with the "cost" right only. */
export const hideCost = <T extends ItemRow>(i: T, a: MsAccess): T => (msHas(a, "cost") ? i : { ...i, cost_paise: 0 });
export function hideBillCost(b: BillRow, a: MsAccess): BillRow {
  return msHas(a, "cost") ? b : { ...b, profit_paise: 0, lines: (b.lines ?? []).map((l) => ({ ...l, cost: 0 })) };
}

/* ---------------- items and units ---------------- */

export async function itemsOf(ownerId: string, all = false): Promise<ItemRow[]> {
  return list(await restAsService<ItemRow[]>(`ms_items?owner_id=eq.${ownerId}${all ? "" : "&active=is.true"}&select=${ITEM_COLS}&order=name&limit=5000`));
}
export async function itemsByIds(ownerId: string, ids: string[]): Promise<ItemRow[]> {
  const ok = [...new Set(ids.filter(isUuid))];
  if (!ok.length) return [];
  return list(await restAsService<ItemRow[]>(`ms_items?owner_id=eq.${ownerId}&id=in.(${ok.join(",")})&select=${ITEM_COLS}`));
}
/** How many units of each serial item are in stock. */
export async function unitCounts(ownerId: string): Promise<Record<string, number>> {
  const rows = list(await restAsService<{ item_id: string }[]>(`ms_units?owner_id=eq.${ownerId}&status=eq.in_stock&select=item_id&limit=20000`));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.item_id] = (out[r.item_id] ?? 0) + 1;
  return out;
}
export async function unitByImei(ownerId: string, imei: string): Promise<UnitRow | null> {
  const c = cleanCode(imei, 20);
  if (!c) return null;
  return list(await restAsService<UnitRow[]>(`ms_units?owner_id=eq.${ownerId}&or=(imei1.eq.${c},imei2.eq.${c},serial_no.eq.${c})&select=${UNIT_COLS}&limit=1`))[0] ?? null;
}
export async function qtyAdd(ownerId: string, itemId: string, delta: number, cost?: number): Promise<void> {
  await restAsService("rpc/ms_qty_add", { method: "POST", body: JSON.stringify({ p_owner: ownerId, p_item: itemId, p_delta: delta, p_cost: cost ?? null }) });
}

/* ---------------- bills ---------------- */

export type NewBill = Partial<Pick<BillRow, "ref_bill_id">> & Pick<BillRow, "customer_name" | "customer_phone" | "customer_gstin" | "customer_state" | "lines" | "payments" | "discount_paise" | "notes" | "due_date" | "client_id" | "created_by" | "created_by_name">;

/**
 * The bill's lines made true against the stock: cost, HSN, GST rate and warranty always come from the item (never from the app);
 * a serial item needs an IMEI that is in stock and belongs to it. Returns the problem in plain words, or the lines.
 */
export async function trueLines(ownerId: string, lines: BillLine[], kind: BillKind): Promise<{ error: string } | { lines: BillLine[] }> {
  const items = await itemsByIds(ownerId, lines.map((l) => l.itemId));
  const seen = new Set<string>();
  const out: BillLine[] = [];
  for (const l of lines) {
    const it = items.find((i) => i.id === l.itemId);
    if (!it) { out.push({ ...l, itemId: "", unitId: "", imei: "", cost: 0 }); continue; }   // a free-typed line (no stock)
    const base = { ...l, name: l.name || it.name, hsn: it.hsn, gstBp: it.gst_bp, warrantyMonths: it.warranty_months, cost: it.cost_paise };
    if (!it.serial) { out.push({ ...base, imei: "", unitId: "" }); continue; }
    if (!l.imei) return { error: `Scan the IMEI of ${it.name}.` };
    if (seen.has(l.imei)) return { error: `IMEI ${l.imei} is on the bill twice.` };
    seen.add(l.imei);
    const u = await unitByImei(ownerId, l.imei);
    if (!u || u.item_id !== it.id) return { error: `IMEI ${l.imei} is not in your stock of ${it.name}.` };
    if (kind === "sale" && u.status !== "in_stock") return { error: `IMEI ${l.imei} is already ${u.status === "sold" ? "sold" : u.status}.` };
    out.push({ ...base, qty: 1, imei: u.imei1, unitId: u.id, cost: u.cost_paise || it.cost_paise });
  }
  return { lines: out };
}

/** noStock: a repair bill — its parts already left the stock when they were put on the job. */
export async function createBill(scope: Scope, setup: MsSetup, kind: BillKind, f: NewBill, noStock = false): Promise<BillRow | null> {
  // A bill made offline and sent twice is saved once.
  if (f.client_id) {
    const had = list(await restAsService<BillRow[]>(`ms_bills?owner_id=eq.${scope.ownerId}&client_id=eq.${encodeURIComponent(f.client_id)}&select=${BILL_COLS}&limit=1`))[0];
    if (had) return had;
  }
  const t = billTotals(billInputOf(f), setup);
  const fy = finYear(new Date(`${istDay()}T12:00:00`));
  const prefix = kind === "sale" ? setup.billPrefix : kind === "return" ? "CN" : setup.estimatePrefix;
  for (let tries = 0; tries < 4; tries++) {
    const last = list(await restAsService<{ number: number }[]>(`ms_bills?owner_id=eq.${scope.ownerId}&kind=eq.${kind}&fin_year=eq.${fy}&select=number&order=number.desc&limit=1`))[0];
    const number = (last?.number ?? 0) + 1;
    const row = {
      ...f, owner_id: scope.ownerId, kind, number, fin_year: fy, code: `${prefix}/${fy}/${number}`, gst_on: setup.gstOn,
      // A return is settled as it is made: its payments are the money given back.
      status: kind === "return" || (kind === "sale" && t.balance <= 0) ? "paid" : "open", total_paise: t.total, gst_paise: t.gst, balance_paise: kind === "return" ? 0 : t.balance, profit_paise: t.profit,
    };
    const r = await restAsService<BillRow[]>(`ms_bills?select=${BILL_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (r.ok) {
      const bill = list(r)[0] ?? null;
      if (bill && kind === "sale" && !noStock) await moveStock(scope.ownerId, bill, -1).catch((e) => console.error("[mobile] stock out", e));
      if (bill && kind === "return") await moveStock(scope.ownerId, bill, 1).catch((e) => console.error("[mobile] stock back", e));
      if (bill?.customer_phone && kind !== "return") await linkCustomerPhone(scope.ownerId, bill.customer_phone, bill.customer_name, `📱 ${kind === "sale" ? "Bill" : "Estimate"} ${bill.code} · ₹${Math.round(bill.total_paise / 100).toLocaleString("en-IN")}`, kind === "sale" ? "converted" : "interested", kind === "sale" ? bill.total_paise : 0).catch(() => undefined);
      return bill;
    }
    if (r.status !== 409 && !/duplicate key/i.test(r.text)) { console.error("[mobile] bill save", r.status, r.text.slice(0, 200)); return null; }
  }
  return null;
}

/** Stock out on a sale (dir −1), back in on a cancel (dir +1): counted items by qty, serial items by their unit. */
export async function moveStock(ownerId: string, bill: BillRow, dir: 1 | -1): Promise<void> {
  const now = new Date().toISOString();
  for (const l of bill.lines ?? []) {
    if (!l.itemId) continue;
    if (l.unitId) {
      const patch = dir === -1 ? { status: "sold", bill_id: bill.id, sold_at: now } : { status: "in_stock", bill_id: null, sold_at: null };
      await restAsService(`ms_units?id=eq.${l.unitId}&owner_id=eq.${ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    } else await qtyAdd(ownerId, l.itemId, dir * l.qty);
  }
}

export function withTotals(b: BillRow, gstOn: boolean, stateCode: string): Pick<BillRow, "total_paise" | "gst_paise" | "balance_paise" | "profit_paise" | "status"> {
  const t = billTotals(billInputOf(b), { gstOn, stateCode });
  const status = b.status === "cancelled" || b.status === "converted" ? b.status : b.kind === "return" || (b.kind === "sale" && t.balance <= 0) ? "paid" : "open";
  return { total_paise: t.total, gst_paise: t.gst, balance_paise: t.balance, profit_paise: t.profit, status };
}
export async function billById(ownerId: string, id: string): Promise<BillRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<BillRow[]>(`ms_bills?id=eq.${id}&owner_id=eq.${ownerId}&select=${BILL_COLS}&limit=1`))[0] ?? null;
}
export const billLink = (b: Pick<BillRow, "id" | "token">) => `${SITE_URL}/mb/${b.id}?t=${b.token}`;
export const shopOf = async (ownerId: string, setup: MsSetup) => setup.shopName || (await shopName(ownerId)) || "हमारी दुकान";

export async function sendBill(scope: Scope, setup: MsSetup, b: BillRow): Promise<{ sent: boolean; link: string; error?: string }> {
  const text = billMessage(b, await shopOf(scope.ownerId, setup), billLink(b));
  const link = b.customer_phone ? `https://wa.me/${b.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!b.customer_phone) return { sent: false, link, error: "No customer number on this bill." };
  if (!(await shopSend(scope, b.customer_phone, text))) return { sent: false, link, error: "The shop's WhatsApp is not linked — send it with the button." };
  return { sent: true, link };
}
