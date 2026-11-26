// Stock transfer between the main shop ("") and the branches: GET the latest transfers; POST one — counted items move by their
// number (the whole stock stays the same; only where it is changes), phones move by IMEI. Needs the "stock" right.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanCode, storeName } from "@/lib/mobile";
import { branchQtys, itemsByIds, msCtx, msDenied, msHas, qtyAt } from "@/lib/mobile-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
type TLine = { itemId: string; name: string; qty: number; imeis: string[] };

export async function GET(request: Request) {
  const c = await msCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!msHas(c.access, "stock")) return msDenied("see stock transfers");
  const r = await restAsService<Record<string, unknown>[]>(`ms_transfers?owner_id=eq.${c.scope.ownerId}&select=id,from_store,to_store,lines,note,created_by_name,created_at&order=created_at.desc&limit=50`);
  return NextResponse.json({ transfers: list(r), setup: c.setup, access: c.access });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await msCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!msHas(access, "stock")) return msDenied("move stock");
  const place = (v: unknown) => { const s = typeof v === "string" ? v : ""; return s === "" || setup.stores.some((x) => x.id === s) ? s : null; };
  const from = place(b.from), to = place(b.to);
  if (from === null || to === null) return NextResponse.json({ error: "Pick where the stock goes from and to." }, { status: 400 });
  if (from === to) return NextResponse.json({ error: "From and To are the same place." }, { status: 400 });
  const raw = (Array.isArray(b.lines) ? b.lines : []).slice(0, 200).map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}));
  const lines: TLine[] = raw.map((x) => ({
    itemId: /^[0-9a-f-]{36}$/i.test(String(x.itemId ?? "")) ? String(x.itemId) : "", name: "",
    qty: Math.max(0, Math.min(100000, Math.round(Number(x.qty) || 0))),
    imeis: [...new Set((Array.isArray(x.imeis) ? x.imeis : []).map((i) => cleanCode(i, 20)).filter(Boolean))].slice(0, 500),
  })).filter((l) => l.itemId && (l.qty || l.imeis.length));
  if (!lines.length) return NextResponse.json({ error: "Add the items to move, with how many." }, { status: 400 });
  const o = scope.ownerId;
  const [items, branches] = await Promise.all([itemsByIds(o, lines.map((l) => l.itemId)), branchQtys(o)]);
  const unitIds: string[] = [];
  for (const l of lines) {
    const it = items.find((i) => i.id === l.itemId);
    if (!it) return NextResponse.json({ error: "An item was not found." }, { status: 400 });
    l.name = it.name;
    if (it.serial) {
      if (!l.imeis.length) return NextResponse.json({ error: `Scan the IMEIs of ${it.name} that are moving.` }, { status: 400 });
      const units = list(await restAsService<{ id: string; imei1: string; store: string; status: string }[]>(`ms_units?owner_id=eq.${o}&item_id=eq.${it.id}&imei1=in.(${l.imeis.join(",")})&select=id,imei1,store,status&limit=500`));
      for (const im of l.imeis) {
        const u = units.find((x) => x.imei1 === im);
        if (!u || u.status !== "in_stock") return NextResponse.json({ error: `IMEI ${im} is not in stock of ${it.name}.` }, { status: 400 });
        if ((u.store || "") !== from) return NextResponse.json({ error: `IMEI ${im} is not at ${storeName(setup, from)}.` }, { status: 400 });
        unitIds.push(u.id);
      }
      l.qty = l.imeis.length;
    } else {
      l.imeis = [];
      const have = qtyAt(it, from, branches);
      if (l.qty > have) return NextResponse.json({ error: `${storeName(setup, from)} has only ${Math.max(0, have)} of ${it.name}.` }, { status: 400 });
    }
  }
  const saved = list(await restAsService<{ id: string }[]>("ms_transfers?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    owner_id: o, from_store: from, to_store: to, lines, note: String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200), created_by: scope.userId, created_by_name: access.name }) }))[0];
  if (!saved) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  const add = (item: string, store: string, delta: number) => restAsService("rpc/ms_store_qty_add", { method: "POST", body: JSON.stringify({ p_owner: o, p_item: item, p_store: store, p_delta: delta }) });
  for (const l of lines) {
    if (l.imeis.length) continue;
    if (from) await add(l.itemId, from, -l.qty);
    if (to) await add(l.itemId, to, l.qty);
  }
  if (unitIds.length) await restAsService(`ms_units?owner_id=eq.${o}&id=in.(${unitIds.join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ store: to }) });
  return NextResponse.json({ ok: true, id: saved.id });
}
