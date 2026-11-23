import "server-only";
// Shubhora Jewellery — server side (plan: https://claude.ai/artifact/D3MQLcLvzGoopx3P4BiKtK). Every call goes through the service
// role; the rights checks live here, the same way as Orders (src/lib/jobs-server.ts): the owner → everything; a staff login →
// the rights the owner gave it in Jewellery → Settings → Staff (a manager with nothing set gets all, an agent can make bills).
import { NextResponse } from "next/server";
import { restAsService, userFromRequest } from "@/lib/poster-server";
import { addonGate } from "@/lib/addons-server";
import { resolveScope, type Scope } from "@/lib/crm-server";
import { shopName, shopSend } from "@/lib/jobs-server";
import { SITE_URL } from "@/lib/site-url";
import {
  BILL_COLS, DEFAULT_JW_SETUP, JW_ALL_RIGHTS, billInputOf, billMessage, billTotals, cleanJwSetup, finYear,
  type BillKind, type BillRow, type JwRight, type JwSetup, type RateBook,
} from "@/lib/jewellery";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** India's date today ("2026-11-23"): the rate and the financial year follow the shop's clock, not the server's (UTC). */
export function istDay(d = new Date()): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

const memo = new Map<string, { v: unknown; until: number }>();
async function remember<T>(key: string, ttl: number, get: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.v as T;
  const v = await get();
  memo.set(key, { v, until: Date.now() + ttl });
  return v;
}

/** The shop's Jewellery settings (owner_prefs.crm.jewelSetup), or the defaults. */
export async function jwSetup(ownerId: string): Promise<JwSetup> {
  return remember(`jw:setup:${ownerId}`, 60_000, async () => {
    const r = list(await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`))[0];
    return r?.crm?.jewelSetup ? cleanJwSetup(r.crm.jewelSetup) : DEFAULT_JW_SETUP;
  });
}
export async function saveJwSetup(ownerId: string, setup: JwSetup): Promise<boolean> {
  const crm = list(await restAsService<{ crm: Record<string, unknown> | null }[]>(`owner_prefs?owner_id=eq.${ownerId}&select=crm`))[0]?.crm ?? {};
  const r = await restAsService("owner_prefs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner_id: ownerId, crm: { ...crm, jewelSetup: cleanJwSetup(setup) }, updated_at: new Date().toISOString() }) });
  memo.delete(`jw:setup:${ownerId}`);
  return r.ok;
}

import type { JwAccess } from "@/lib/jewellery-types";
export type { JwAccess };
export const jwHas = (a: JwAccess, r: JwRight) => a.owner || a.rights.includes(r);

/** Every Jewellery route starts here: logged in, a member of the shop, Jewellery switched on, the settings and the person's rights. */
export async function jwCtx(request: Request, as: string | null): Promise<
  { ok: true; scope: Scope; setup: JwSetup; access: JwAccess } | { ok: false; res: NextResponse }> {
  const me = await userFromRequest(request);
  if (!me) return { ok: false, res: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  const scope = await resolveScope(me, as);
  if (!scope) return { ok: false, res: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  const [gate, setup, row, prof] = await Promise.all([
    addonGate(scope.ownerId, "jewellery"),
    jwSetup(scope.ownerId),
    scope.role === "owner" ? Promise.resolve(null) : restAsService<{ id: string; name: string }[]>(`crm_agents?owner_id=eq.${scope.ownerId}&agent_user_id=eq.${scope.userId}&active=is.true&select=id,name&limit=1`).then((r) => list(r)[0] ?? null),
    remember(`jw:name:${scope.userId}`, 5 * 60_000, async () => list(await restAsService<{ full_name: string | null }[]>(`profiles?id=eq.${scope.userId}&select=full_name&limit=1`))[0]?.full_name ?? ""),
  ]);
  if (gate) return { ok: false, res: gate };
  const name = (row?.name || prof || "").trim().slice(0, 60);
  if (scope.role === "owner") return { ok: true, scope, setup, access: { title: "Owner", rights: JW_ALL_RIGHTS, owner: true, name: name || "Owner" } };
  const st = row ? setup.staff[row.id] : undefined;
  const rights: JwRight[] = st ? st.rights : scope.role === "manager" ? JW_ALL_RIGHTS : ["bill"];
  return { ok: true, scope, setup, access: { title: st?.title || (scope.role === "manager" ? "Manager" : "Counter"), rights, owner: false, name } };
}
export const jwDenied = (what: string) => NextResponse.json({ error: `You do not have the right to ${what}. Ask the owner (Jewellery → Settings → Staff).` }, { status: 403 });

/* ---------------- rates ---------------- */

export async function rateOf(ownerId: string, day?: string): Promise<RateBook | null> {
  const q = day ? `&day=eq.${day}` : `&day=lte.${istDay()}&order=day.desc`;
  const r = list(await restAsService<{ day: string; sell: Record<string, number>; buy: Record<string, number> }[]>(`jw_rates?owner_id=eq.${ownerId}${q}&select=day,sell,buy&limit=1`))[0];
  return r ? { day: r.day, sell: r.sell ?? {}, buy: r.buy ?? {} } : null;
}
export async function rateHistory(ownerId: string, days = 30) {
  return list(await restAsService<{ day: string; sell: Record<string, number>; buy: Record<string, number>; set_by_name: string; updated_at: string }[]>(`jw_rates?owner_id=eq.${ownerId}&select=day,sell,buy,set_by_name,updated_at&order=day.desc&limit=${days}`));
}

/* ---------------- bills ---------------- */

/** The next number of this kind in this financial year (1, 2, 3…). */
async function nextNumber(ownerId: string, kind: BillKind, fy: string): Promise<number> {
  const last = list(await restAsService<{ number: number }[]>(`jw_bills?owner_id=eq.${ownerId}&kind=eq.${kind}&fin_year=eq.${fy}&select=number&order=number.desc&limit=1`))[0];
  return (last?.number ?? 0) + 1;
}

/** Saves a new bill or estimate with its totals worked out here (never taken from the app). Tries the next number again if two
 *  counters saved at the same moment. */
export async function createBill(scope: Scope, setup: JwSetup, kind: BillKind, fields: Omit<BillRow, "id" | "owner_id" | "kind" | "number" | "code" | "status" | "total_paise" | "balance_paise" | "gst_paise" | "token" | "created_at" | "updated_at" | "cancel_reason">): Promise<BillRow | null> {
  const t = billTotals(billInputOf(fields), setup);
  const fy = finYear(new Date(`${istDay()}T12:00:00`));
  const prefix = kind === "sale" ? setup.billPrefix : setup.estimatePrefix;
  for (let tries = 0; tries < 4; tries++) {
    const number = await nextNumber(scope.ownerId, kind, fy);
    const row = {
      ...fields, owner_id: scope.ownerId, kind, number, fin_year: fy, code: `${prefix}/${fy}/${number}`,
      status: kind === "sale" && t.balance <= 0 ? "paid" : "open",
      total_paise: t.total, gst_paise: t.gst, balance_paise: t.balance,
    };
    const r = await restAsService<BillRow[]>(`jw_bills?select=${BILL_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (r.ok) return list(r)[0] ?? null;
    if (r.status !== 409 && !/duplicate key/i.test(r.text)) { console.error("[jewellery] bill save", r.status, r.text.slice(0, 200)); return null; }
  }
  return null;
}

/** Re-works a saved bill's totals after its payments or status change. */
export function withTotals(b: BillRow, setup: JwSetup): Pick<BillRow, "total_paise" | "gst_paise" | "balance_paise" | "status"> {
  const t = billTotals(billInputOf(b), setup);
  const status = b.status === "cancelled" || b.status === "converted" ? b.status : b.kind === "sale" && t.balance <= 0 ? "paid" : "open";
  return { total_paise: t.total, gst_paise: t.gst, balance_paise: t.balance, status };
}

export async function billById(ownerId: string, id: string): Promise<BillRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<BillRow[]>(`jw_bills?id=eq.${id}&owner_id=eq.${ownerId}&select=${BILL_COLS}&limit=1`))[0] ?? null;
}

/** The customer's own link to the bill (no login): /jb/<id>?t=<token>. */
export const billLink = (b: Pick<BillRow, "id" | "token">) => `${SITE_URL}/jb/${b.id}?t=${b.token}`;

/** Sends the bill to the customer from the shop's WhatsApp; else hands back a wa.me link to send by hand. */
export async function sendBill(scope: Scope, b: BillRow): Promise<{ sent: boolean; link: string; error?: string }> {
  const shop = await shopName(scope.ownerId);
  const text = billMessage(b, shop || "हमारी दुकान", billLink(b));
  const link = b.customer_phone ? `https://wa.me/${b.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!b.customer_phone) return { sent: false, link, error: "No customer number on this bill." };
  if (!(await shopSend(scope, b.customer_phone, text))) return { sent: false, link, error: "The shop's WhatsApp is not linked — send it with the button." };
  return { sent: true, link };
}
