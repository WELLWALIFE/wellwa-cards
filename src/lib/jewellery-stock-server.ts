import "server-only";
// Shubhora Jewellery, phase 3 — stock by the piece, server side. Service role only; the rights checks are in the API routes.
// A bill's tags are checked before it is saved (checkTags) and marked sold once it is (markSold, from createBill); a cancelled bill
// puts its pieces back (returnToStock).
import { restAsService } from "@/lib/poster-server";
import type { BillLine } from "@/lib/jewellery";
import { SELLABLE, STOCK_COLS, cleanTag, tagCode, type StockRow, type StockStatus } from "@/lib/jewellery-stock";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** A new piece with the next tag. Retries when two counters add at the same moment. */
export async function createStock(ownerId: string, fields: Record<string, unknown>, by: { id: string; name: string }): Promise<StockRow | null> {
  for (let tries = 0; tries < 5; tries++) {
    const last = list(await restAsService<{ seq: number }[]>(`jw_stock?owner_id=eq.${ownerId}&select=seq&order=seq.desc&limit=1`))[0];
    const seq = (last?.seq ?? 0) + 1;
    const row = { ...fields, owner_id: ownerId, seq, tag: tagCode(String(fields.item_type ?? ""), seq), created_by: by.id, created_by_name: by.name };
    const r = await restAsService<StockRow[]>(`jw_stock?select=${STOCK_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (r.ok) return list(r)[0] ?? null;
    if (r.status !== 409 && !/duplicate key/i.test(r.text)) { console.error("[jewellery] stock save", r.status, r.text.slice(0, 200)); return null; }
  }
  return null;
}

export async function stockById(ownerId: string, id: string): Promise<StockRow | null> {
  if (!isUuid(id)) return null;
  return list(await restAsService<StockRow[]>(`jw_stock?id=eq.${id}&owner_id=eq.${ownerId}&select=${STOCK_COLS}&limit=1`))[0] ?? null;
}
export async function stockByTag(ownerId: string, tag: string): Promise<StockRow | null> {
  const t = cleanTag(tag);
  if (!t) return null;
  return list(await restAsService<StockRow[]>(`jw_stock?owner_id=eq.${ownerId}&tag=eq.${t}&select=${STOCK_COLS}&limit=1`))[0] ?? null;
}

export type StockFilter = { status?: string; type?: string; purity?: string; q?: string; ids?: string[]; limit?: number };
export async function stockList(ownerId: string, f: StockFilter): Promise<StockRow[]> {
  const p = [`owner_id=eq.${ownerId}`, `select=${STOCK_COLS}`, "order=seq.desc", `limit=${Math.min(2000, Math.max(1, f.limit ?? 500))}`];
  const ids = (f.ids ?? []).filter(isUuid).slice(0, 200);
  if (ids.length) p.push(`id=in.(${ids.join(",")})`);
  else if (f.status === "sellable") p.push(`status=in.(${SELLABLE.join(",")})`);
  else if (f.status && /^[a-z_]+$/.test(f.status)) p.push(`status=eq.${f.status}`);
  if (f.type && /^[a-z0-9_]+$/i.test(f.type)) p.push(`item_type=eq.${f.type}`);
  if (f.purity && /^[a-z0-9_]+$/i.test(f.purity)) p.push(`purity=eq.${f.purity}`);
  const q = (f.q ?? "").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 30);
  if (q) p.push(`or=(tag.ilike.*${encodeURIComponent(q.replace(/ /g, ""))}*,huid.ilike.*${encodeURIComponent(q.replace(/ /g, ""))}*,descr.ilike.*${encodeURIComponent(q)}*)`);
  return list(await restAsService<StockRow[]>(`jw_stock?${p.join("&")}`));
}

/** Weights in hand for the summary (every sellable piece, only the columns needed). */
export async function stockInHand(ownerId: string) {
  return list(await restAsService<Pick<StockRow, "status" | "purity" | "pieces" | "gross_mg" | "net_mg" | "item_type">[]>(`jw_stock?owner_id=eq.${ownerId}&status=in.(${SELLABLE.join(",")})&select=status,purity,pieces,gross_mg,net_mg,item_type&limit=20000`));
}

/** The bill's tags: each known, sellable and only once on the bill. Returns the problem in plain words, or null. */
export async function checkTags(ownerId: string, lines: Pick<BillLine, "tag">[]): Promise<string | null> {
  const tags = lines.map((l) => cleanTag(l.tag)).filter(Boolean);
  if (!tags.length) return null;
  const dup = tags.find((t, i) => tags.indexOf(t) !== i);
  if (dup) return `Tag ${dup} is on the bill twice.`;
  const rows = list(await restAsService<{ tag: string; status: StockStatus }[]>(`jw_stock?owner_id=eq.${ownerId}&tag=in.(${tags.join(",")})&select=tag,status`));
  for (const t of tags) {
    const r = rows.find((x) => x.tag === t);
    if (!r) return `Tag ${t} is not in your stock.`;
    if (!SELLABLE.includes(r.status)) return `Tag ${t} is already ${r.status === "sold" ? "sold" : r.status.replace("_", " ")}.`;
  }
  return null;
}

export async function markSold(ownerId: string, billId: string, lines: Pick<BillLine, "tag">[]): Promise<void> {
  const tags = [...new Set(lines.map((l) => cleanTag(l.tag)).filter(Boolean))];
  if (!tags.length) return;
  const now = new Date().toISOString();
  await restAsService(`jw_stock?owner_id=eq.${ownerId}&tag=in.(${tags.join(",")})&status=in.(${SELLABLE.join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "sold", bill_id: billId, sold_at: now, updated_at: now }) });
}

export async function returnToStock(ownerId: string, billId: string): Promise<void> {
  if (!isUuid(billId)) return;
  await restAsService(`jw_stock?owner_id=eq.${ownerId}&bill_id=eq.${billId}&status=eq.sold`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "in_stock", bill_id: null, sold_at: null, status_note: "Back from a cancelled bill", updated_at: new Date().toISOString() }) });
}
