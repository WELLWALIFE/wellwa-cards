// Purchases: GET the latest; POST one supplier bill — counted items go up by their qty (and take the new cost), IMEI items get
// one unit per IMEI scanned. An IMEI already in stock is refused before anything is saved.
// Purchase orders (order: true): what you ask a supplier for — saved as 'ordered', no stock moves, sent on WhatsApp by the app.
// When the goods come, the purchase is saved with po_id and the order is marked received. PATCH { action: "cancel", id } drops one.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { cleanPurchaseLine, validImei, type PurchaseLine } from "@/lib/mobile";
import { itemsByIds, msCtx, msDenied, msHas, qtyAdd } from "@/lib/mobile-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const COLS = "id,supplier_name,supplier_phone,supplier_gstin,bill_no,bill_date,lines,total_paise,paid_paise,notes,created_by_name,created_at,status,store";

export async function GET(request: Request) {
  const c = await msCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!msHas(c.access, "stock")) return msDenied("see purchases");
  const r = await restAsService<Record<string, unknown>[]>(`ms_purchases?owner_id=eq.${c.scope.ownerId}&select=${COLS}&order=created_at.desc&limit=100`);
  return NextResponse.json({ purchases: list(r) });
}

/** Money paid to a supplier against one purchase: { id, paise }. */
export async function PATCH(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  if (!msHas(c.access, "stock") || !msHas(c.access, "cost")) return msDenied("pay suppliers");
  const o = c.scope.ownerId;
  const id = typeof b.id === "string" && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : "";
  if (b.action === "cancel") {
    const r = await restAsService<{ id: string }[]>(`ms_purchases?id=eq.${id || "00000000-0000-0000-0000-000000000000"}&owner_id=eq.${o}&status=eq.ordered&select=id`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "cancelled" }) });
    return list(r).length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const row = id ? list(await restAsService<{ id: string; total_paise: number; paid_paise: number; notes: string }[]>(`ms_purchases?id=eq.${id}&owner_id=eq.${o}&select=id,total_paise,paid_paise,notes&limit=1`))[0] : null;
  if (!row) return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  const paise = Math.round(Number(b.paise) || 0);
  const due = row.total_paise - row.paid_paise;
  if (paise <= 0 || paise > due) return NextResponse.json({ error: `Type an amount up to ₹${Math.round(due / 100).toLocaleString("en-IN")}.` }, { status: 400 });
  const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const r = await restAsService(`ms_purchases?id=eq.${row.id}&owner_id=eq.${o}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ paid_paise: row.paid_paise + paise, notes: `${row.notes ? `${row.notes} · ` : ""}Paid ₹${Math.round(paise / 100)} on ${day} (${c.access.name})`.slice(-300) }) });
  return r.ok ? NextResponse.json({ ok: true, paid_paise: row.paid_paise + paise }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, access, setup } = c;
  if (!msHas(access, "stock")) return msDenied("add purchases");
  const o = scope.ownerId;
  const order = b.order === true;
  const asked = typeof b.store === "string" ? b.store : "";
  const store = access.store || (setup.stores.some((s) => s.id === asked) ? asked : "");
  const poId = !order && typeof b.po_id === "string" && /^[0-9a-f-]{36}$/i.test(b.po_id) ? b.po_id : "";
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 200).map(cleanPurchaseLine).filter((l): l is PurchaseLine => !!l);
  if (!lines.length) return NextResponse.json({ error: "Add at least one item with its quantity." }, { status: 400 });
  const items = await itemsByIds(o, lines.map((l) => l.itemId));
  const all: string[] = [];
  for (const l of lines) {
    const it = items.find((i) => i.id === l.itemId);
    if (!it) return NextResponse.json({ error: "An item on this purchase was not found." }, { status: 400 });
    l.name = it.name;
    if (order) { l.imeis = []; continue; }   // an order is only names and numbers; IMEIs come with the goods
    if (it.serial) {
      if (!l.imeis.length) return NextResponse.json({ error: `Scan the IMEIs of ${it.name}.` }, { status: 400 });
      const bad = it.kind === "phone" ? l.imeis.find((x) => /^\d{15}$/.test(x) && !validImei(x)) : undefined;
      if (bad) return NextResponse.json({ error: `Check this IMEI, a digit looks wrong: ${bad}` }, { status: 400 });
      const dup = l.imeis.find((x) => all.includes(x));
      if (dup) return NextResponse.json({ error: `IMEI ${dup} is on this purchase twice.` }, { status: 400 });
      all.push(...l.imeis);
    } else l.imeis = [];
  }
  if (all.length) {
    const had = list(await restAsService<{ imei1: string }[]>(`ms_units?owner_id=eq.${o}&imei1=in.(${all.join(",")})&select=imei1&limit=5`));
    if (had.length) return NextResponse.json({ error: `IMEI ${had[0].imei1} is already in your stock.` }, { status: 400 });
  }
  const total = lines.reduce((a, l) => a + l.qty * l.cost, 0);
  const r = await restAsService<{ id: string }[]>("ms_purchases?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    owner_id: o, supplier_name: txt(b.supplier_name, 80), supplier_phone: cleanPhone(b.supplier_phone), supplier_gstin: txt(b.supplier_gstin, 15).toUpperCase(),
    bill_no: txt(b.bill_no, 40), bill_date: typeof b.bill_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.bill_date) ? b.bill_date : null,
    lines, total_paise: total, paid_paise: order ? 0 : Math.max(0, Math.min(total, Math.round(Number(b.paid_paise) || 0))), notes: txt(b.notes, 300),
    status: order ? "ordered" : "received", store,
    created_by: scope.userId, created_by_name: access.name,
  }) });
  const pid = list(r)[0]?.id;
  if (!pid) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  if (order) return NextResponse.json({ ok: true, id: pid, total_paise: total, order: true });
  if (poId) await restAsService(`ms_purchases?id=eq.${poId}&owner_id=eq.${o}&status=eq.ordered`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "received", notes: `Goods received on purchase ${pid.slice(0, 8)} (${access.name})` }) });
  for (const l of lines) {
    if (l.imeis.length) {
      await restAsService("ms_units", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(l.imeis.map((x) => ({ owner_id: o, item_id: l.itemId, imei1: x, cost_paise: l.cost, purchase_id: pid, store }))) });
      if (l.cost) await restAsService(`ms_items?id=eq.${l.itemId}&owner_id=eq.${o}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ cost_paise: l.cost, updated_at: new Date().toISOString() }) });
    } else await qtyAdd(o, l.itemId, l.qty, l.cost || undefined, store);
  }
  return NextResponse.json({ ok: true, id: pid, total_paise: total });
}
