// Items: GET every item with its stock (counted qty, or IMEIs in stock for a serial item) — the bill screen keeps this list and
// searches it on the phone; ?imei= finds one unit for the scan box; ?units=<item id> lists an item's IMEIs.
// POST: add or change an item ({id?…}), or { action: "adjust", id, qty, note } to correct a count, or { action: "units", id, imeis }
// to add IMEIs by hand (opening stock).
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { ITEM_COLS, UNIT_COLS, cleanCode, cleanItemFields, validImei, type ItemRow, type UnitRow } from "@/lib/mobile";
import { branchQtys, hideCost, itemsOf, msCtx, msDenied, msHas, qtyAdd, qtyAt, unitByImei, unitCounts } from "@/lib/mobile-server";
import { isUuid } from "@/lib/jewellery-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await msCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  const { scope, access } = c;
  const imei = sp.get("imei");
  if (imei !== null) {
    const u = await unitByImei(scope.ownerId, imei);
    if (!u) return NextResponse.json({ error: `${cleanCode(imei, 20)} is not in your stock.` }, { status: 404 });
    const item = list(await restAsService<ItemRow[]>(`ms_items?id=eq.${u.item_id}&owner_id=eq.${scope.ownerId}&select=${ITEM_COLS}&limit=1`))[0];
    return NextResponse.json({ unit: msHas(access, "cost") ? u : { ...u, cost_paise: 0 }, item: item ? hideCost(item, access) : null });
  }
  const of = sp.get("units");
  if (of !== null) {
    if (!isUuid(of)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const units = list(await restAsService<UnitRow[]>(`ms_units?owner_id=eq.${scope.ownerId}&item_id=eq.${of}&select=${UNIT_COLS}&order=created_at.desc&limit=2000`));
    return NextResponse.json({ units: units.map((u) => (msHas(access, "cost") ? u : { ...u, cost_paise: 0 })) });
  }
  if (sp.get("instock") === "1") {
    const units = list(await restAsService<{ imei1: string; item_id: string }[]>(`ms_units?owner_id=eq.${scope.ownerId}&status=eq.in_stock&select=imei1,item_id&limit=20000`));
    return NextResponse.json({ units });
  }
  const [items, units] = await Promise.all([itemsOf(scope.ownerId, sp.get("all") === "1"), unitCounts(scope.ownerId)]);
  if (!c.setup.stores.length) return NextResponse.json({ items: items.map((i) => ({ ...hideCost(i, access), stock: i.serial ? units[i.id] ?? 0 : i.qty })), access, setup: c.setup });
  // With branches: the stock of each place, and `stock` = the place asked for (?store=; a branch login sees its own), else all.
  const asked = sp.get("store");
  const at = access.store || (asked !== null && (asked === "" || c.setup.stores.some((s) => s.id === asked)) ? asked : null);
  const places = ["", ...c.setup.stores.map((s) => s.id)];
  const [branches, unitRows] = await Promise.all([branchQtys(scope.ownerId), restAsService<{ item_id: string; store: string }[]>(`ms_units?owner_id=eq.${scope.ownerId}&status=eq.in_stock&select=item_id,store&limit=20000`)]);
  const uAt: Record<string, Record<string, number>> = {};
  for (const u of list(unitRows)) { const m = (uAt[u.item_id] ??= {}); m[u.store || ""] = (m[u.store || ""] ?? 0) + 1; }
  return NextResponse.json({ store: at, access, setup: c.setup, items: items.map((i) => {
    const byPlace = Object.fromEntries(places.map((p) => [p, i.serial ? uAt[i.id]?.[p] ?? 0 : qtyAt(i, p, branches)]));
    return { ...hideCost(i, access), stock: at === null ? (i.serial ? units[i.id] ?? 0 : i.qty) : byPlace[at] ?? 0, places: byPlace };
  }) });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, access } = c;
  if (!msHas(access, "stock")) return msDenied("change items and stock");
  const o = scope.ownerId, now = new Date().toISOString();
  // With branches, a count is the count of one place (the login's own branch, or the one picked); the whole stock moves by the difference.
  const multi = c.setup.stores.length > 0;
  const place = access.store || (typeof b.store === "string" && c.setup.stores.some((s) => s.id === b.store) ? b.store : "");
  const setCount = async (it: ItemRow, qty: number, branches: Record<string, Record<string, number>>) => {
    const delta = qty - qtyAt(it, place, branches);
    if (delta) await qtyAdd(o, it.id, delta, undefined, place);
    return delta !== 0;
  };
  const one = async (id: string) => list(await restAsService<ItemRow[]>(`ms_items?id=eq.${id}&owner_id=eq.${o}&select=${ITEM_COLS}&limit=1`))[0] ?? null;

  if (b.action === "adjust") {
    const it = isUuid(b.id) ? await one(b.id) : null;
    if (!it || it.serial) return NextResponse.json({ error: "Pick a counted item." }, { status: 400 });
    const qty = Math.round(Number(b.qty));
    if (!Number.isFinite(qty) || qty < 0 || qty > 1e6) return NextResponse.json({ error: "Type the count." }, { status: 400 });
    if (multi) {
      await setCount(it, qty, await branchQtys(o));
      const after = (await one(it.id)) ?? it;
      return NextResponse.json({ item: { ...hideCost(after, access), stock: qtyAt(after, place, await branchQtys(o)) } });
    }
    const r = await restAsService<ItemRow[]>(`ms_items?id=eq.${it.id}&owner_id=eq.${o}&select=${ITEM_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ qty, updated_at: now }) });
    const next = list(r)[0];
    return next ? NextResponse.json({ item: { ...hideCost(next, access), stock: next.qty } }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  if (b.action === "stocktake") {
    // The shelf was counted: set the count of each counted item (only those sent; nothing else is touched).
    const counts = (Array.isArray(b.counts) ? b.counts : []).slice(0, 2000).map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : {})).filter((c) => isUuid(c.id) && Number.isFinite(Number(c.qty)) && Number(c.qty) >= 0 && Number(c.qty) <= 1e6);
    if (!counts.length) return NextResponse.json({ error: "Nothing was counted." }, { status: 400 });
    const rows = list(await restAsService<ItemRow[]>(`ms_items?owner_id=eq.${o}&serial=is.false&id=in.(${counts.map((c) => c.id).join(",")})&select=${ITEM_COLS}`));
    let changed = 0;
    if (multi) {
      const branches = await branchQtys(o);
      for (const it of rows) if (await setCount(it, Math.round(Number(counts.find((c) => c.id === it.id)?.qty)), branches)) changed += 1;
      return NextResponse.json({ ok: true, changed });
    }
    for (const it of rows) {
      const qty = Math.round(Number(counts.find((c) => c.id === it.id)?.qty));
      if (qty === it.qty) continue;
      const r = await restAsService(`ms_items?id=eq.${it.id}&owner_id=eq.${o}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ qty, updated_at: now }) });
      if (r.ok) changed += 1;
    }
    return NextResponse.json({ ok: true, changed });
  }
  if (b.action === "barcode") {
    // Give our own barcode to items that have none, so a label can be printed and scanned at the counter.
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x): x is string => isUuid(x)).slice(0, 200);
    const rows = ids.length ? list(await restAsService<ItemRow[]>(`ms_items?owner_id=eq.${o}&id=in.(${ids.join(",")})&select=${ITEM_COLS}`)) : [];
    const out: Record<string, string> = {};
    for (const it of rows) {
      if (it.barcode) { out[it.id] = it.barcode; continue; }
      for (let tries = 0; tries < 5; tries++) {
        const code = `S${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
        const r = await restAsService(`ms_items?id=eq.${it.id}&owner_id=eq.${o}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ barcode: code, updated_at: now }) });
        if (r.ok) { out[it.id] = code; break; }
      }
    }
    return NextResponse.json({ barcodes: out });
  }
  if (b.action === "units") {
    const it = isUuid(b.id) ? await one(b.id) : null;
    if (!it || !it.serial) return NextResponse.json({ error: "Pick an IMEI item." }, { status: 400 });
    const imeis = [...new Set((Array.isArray(b.imeis) ? b.imeis : []).map((x) => cleanCode(x, 20)).filter(Boolean))].slice(0, 500);
    if (!imeis.length) return NextResponse.json({ error: "Scan or type at least one IMEI." }, { status: 400 });
    const bad = it.kind === "phone" ? imeis.filter((x) => /^\d{15}$/.test(x) && !validImei(x)) : [];
    if (bad.length) return NextResponse.json({ error: `Check this IMEI, a digit looks wrong: ${bad[0]}` }, { status: 400 });
    const had = list(await restAsService<{ imei1: string }[]>(`ms_units?owner_id=eq.${o}&imei1=in.(${imeis.join(",")})&select=imei1`)).map((x) => x.imei1);
    const fresh = imeis.filter((x) => !had.includes(x));
    if (fresh.length) await restAsService("ms_units", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fresh.map((x) => ({ owner_id: o, item_id: it.id, imei1: x, cost_paise: it.cost_paise, store: place }))) });
    return NextResponse.json({ added: fresh.length, already: had });
  }

  const f = cleanItemFields(b);
  if (!f.name) return NextResponse.json({ error: "Type the item's name." }, { status: 400 });
  if (!msHas(access, "cost")) delete (f as Partial<typeof f>).cost_paise;
  if (f.barcode) {
    const clash = list(await restAsService<{ id: string; name: string }[]>(`ms_items?owner_id=eq.${o}&barcode=eq.${encodeURIComponent(f.barcode)}&select=id,name&limit=1`))[0];
    if (clash && clash.id !== b.id) return NextResponse.json({ error: `This barcode is already on "${clash.name}".` }, { status: 400 });
  }
  if (isUuid(b.id)) {
    const it = await one(b.id);
    if (!it) return NextResponse.json({ error: "Not found." }, { status: 404 });
    // An item does not switch between counted and IMEI once it has stock (its history would not add up).
    const patch = { ...f, serial: it.serial, kind: it.serial ? it.kind : f.kind, ...(typeof b.active === "boolean" ? { active: b.active } : {}), updated_at: now };
    const r = await restAsService<ItemRow[]>(`ms_items?id=eq.${it.id}&owner_id=eq.${o}&select=${ITEM_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    const next = list(r)[0];
    return next ? NextResponse.json({ item: hideCost(next, access) }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  const open = f.serial ? 0 : Math.max(0, Math.min(1e6, Math.round(Number(b.qty) || 0)));
  const r = await restAsService<ItemRow[]>(`ms_items?select=${ITEM_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...f, owner_id: o, qty: open }) });
  const made = list(r)[0];
  // Opening stock typed in a branch belongs to that branch.
  if (made && multi && place && open) await restAsService("rpc/ms_store_qty_add", { method: "POST", body: JSON.stringify({ p_owner: o, p_item: made.id, p_store: place, p_delta: open }) });
  return made ? NextResponse.json({ item: { ...hideCost(made, access), stock: made.qty } }) : NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
}
