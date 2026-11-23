import "server-only";
// Shubhora Jewellery, phase 5 — gold scheme and girvi, server side. Service role only; the routes check the switch (Settings) and
// the rights ("scheme" / "girvi") first (financeCtx).
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { shopName, shopSend } from "@/lib/jobs-server";
import type { Scope } from "@/lib/crm-server";
import { SITE_URL } from "@/lib/site-url";
import { finYear } from "@/lib/jewellery";
import { istDay, isUuid, jwCtx, jwDenied, jwHas, linkCustomerPhone } from "@/lib/jewellery-server";
import { GIRVI_COLS, SCHEME_COLS, type GirviRow, type SchemeRow } from "@/lib/jewellery-finance";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

/** jwCtx plus the feature's switch and right. */
export async function financeCtx(request: Request, as: string | null, what: "scheme" | "girvi") {
  const c = await jwCtx(request, as);
  if (!c.ok) return c;
  if (what === "scheme" && !c.setup.schemeOn) return { ok: false as const, res: NextResponse.json({ error: "Gold scheme is off. The owner can switch it on in Jewellery → Settings.", code: "off" }, { status: 403 }) };
  if (what === "girvi" && !c.setup.girviOn) return { ok: false as const, res: NextResponse.json({ error: "Girvi is off. The owner can switch it on in Jewellery → Settings (with the money-lender licence).", code: "off" }, { status: 403 }) };
  if (!jwHas(c.access, what)) return { ok: false as const, res: jwDenied(what === "scheme" ? "run the gold scheme" : "give girvi loans") };
  return c;
}

async function insertNumbered<T>(table: string, cols: string, ownerId: string, prefix: string, row: Record<string, unknown>): Promise<T | null> {
  const fy = finYear(new Date(`${istDay()}T12:00:00`));
  for (let tries = 0; tries < 4; tries++) {
    const last = list(await restAsService<{ number: number }[]>(`${table}?owner_id=eq.${ownerId}&fin_year=eq.${fy}&select=number&order=number.desc&limit=1`))[0];
    const number = (last?.number ?? 0) + 1;
    const r = await restAsService<T[]>(`${table}?select=${cols}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...row, owner_id: ownerId, number, fin_year: fy, code: `${prefix}/${fy}/${number}` }) });
    if (r.ok) return list(r)[0] ?? null;
    if (r.status !== 409 && !/duplicate key/i.test(r.text)) { console.error(`[jewellery] ${table} save`, r.status, r.text.slice(0, 200)); return null; }
  }
  return null;
}

/* ---------------- scheme ---------------- */

export async function createScheme(scope: Scope, row: Record<string, unknown>): Promise<SchemeRow | null> {
  const s = await insertNumbered<SchemeRow>("jw_schemes", SCHEME_COLS, scope.ownerId, "GS", row);
  if (s?.customer_phone) await linkCustomerPhone(scope.ownerId, s.customer_phone, s.customer_name, `🪙 Gold scheme ${s.code}`, "interested").catch(() => undefined);
  return s;
}
export async function schemeById(ownerId: string, id: string): Promise<SchemeRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<SchemeRow[]>(`jw_schemes?id=eq.${id}&owner_id=eq.${ownerId}&select=${SCHEME_COLS}&limit=1`))[0] ?? null;
}
export async function patchScheme(ownerId: string, id: string, patch: Record<string, unknown>): Promise<SchemeRow | null> {
  const r = await restAsService<SchemeRow[]>(`jw_schemes?id=eq.${id}&owner_id=eq.${ownerId}&select=${SCHEME_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  return r.ok ? list(r)[0] ?? null : null;
}
export const schemeLink = (s: Pick<SchemeRow, "id" | "token">) => `${SITE_URL}/js/${s.id}?t=${s.token}`;

/* ---------------- girvi ---------------- */

export async function createGirvi(scope: Scope, row: Record<string, unknown>): Promise<GirviRow | null> {
  // Girvi customers are not put in the sales CRM (a loan is not a sale lead).
  return insertNumbered<GirviRow>("jw_girvi", GIRVI_COLS, scope.ownerId, "GV", row);
}
export async function girviById(ownerId: string, id: string): Promise<GirviRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<GirviRow[]>(`jw_girvi?id=eq.${id}&owner_id=eq.${ownerId}&select=${GIRVI_COLS}&limit=1`))[0] ?? null;
}
export async function patchGirvi(ownerId: string, id: string, patch: Record<string, unknown>): Promise<GirviRow | null> {
  const r = await restAsService<GirviRow[]>(`jw_girvi?id=eq.${id}&owner_id=eq.${ownerId}&select=${GIRVI_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  return r.ok ? list(r)[0] ?? null : null;
}
export const girviLink = (g: Pick<GirviRow, "id" | "token">) => `${SITE_URL}/jg/${g.id}?t=${g.token}`;

/** Sends a line to the customer from the shop's WhatsApp; else a wa.me link to send by hand. */
export async function sendLine(scope: Scope, phone: string, text: string): Promise<{ sent: boolean; link: string; error?: string }> {
  const link = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
  if (!phone) return { sent: false, link, error: "No customer number." };
  if (!(await shopSend(scope, phone, text))) return { sent: false, link, error: "The shop's WhatsApp is not linked — send it with the button." };
  return { sent: true, link };
}
export const shopOf = async (ownerId: string, setupName: string) => setupName || (await shopName(ownerId)) || "हमारी दुकान";
