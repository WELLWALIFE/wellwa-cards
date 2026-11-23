// One karigar's ledger: GET the entries, the balance and the orders with them; POST an entry (gold given, work received with the
// wastage allowed, labour, money paid) or void a wrong one (never deleted: a voided entry stays, struck through, with who voided it).
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { isUuid, istDay, jwCtx, jwDenied, jwHas } from "@/lib/jewellery-server";
import { ORDER_COLS, TXN_COLS, cleanTxn, karigarBalance, type KarigarTxn, type OrderRow } from "@/lib/jewellery-orders";
import { karigarById, orderById, txnsOf } from "@/lib/jewellery-orders-server";

type Ctx = { params: Promise<{ id: string }> };
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "karigar")) return jwDenied("see the karigar ledger");
  const k = await karigarById(c.scope.ownerId, id);
  if (!k) return NextResponse.json({ error: "Karigar not found." }, { status: 404 });
  const [txns, orders] = await Promise.all([
    txnsOf(c.scope.ownerId, k.id, 1000),
    restAsService<OrderRow[]>(`jw_orders?owner_id=eq.${c.scope.ownerId}&karigar_id=eq.${k.id}&status=in.(karigar,ready)&select=${ORDER_COLS}&order=due_date.asc.nullslast&limit=100`),
  ]);
  return NextResponse.json({ karigar: k, txns, balance: karigarBalance(txns), orders: list(orders), today: istDay(), setup: c.setup, access: c.access });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "karigar")) return jwDenied("write in the karigar ledger");
  const k = await karigarById(c.scope.ownerId, id);
  if (!k) return NextResponse.json({ error: "Karigar not found." }, { status: 404 });

  if (typeof b.void === "string") {
    if (!isUuid(b.void)) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    const why = String(b.reason ?? "").trim().slice(0, 120);
    if (!why) return NextResponse.json({ error: "Write why this entry is wrong." }, { status: 400 });
    const t = list(await restAsService<KarigarTxn[]>(`jw_karigar_txns?id=eq.${b.void}&owner_id=eq.${c.scope.ownerId}&karigar_id=eq.${k.id}&select=${TXN_COLS}&limit=1`))[0];
    if (!t) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    const r = await restAsService(`jw_karigar_txns?id=eq.${t.id}&owner_id=eq.${c.scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ voided: true, note: `${t.note ? `${t.note} · ` : ""}VOID: ${why} — ${c.access.name}`.slice(0, 300) }) });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  const t = cleanTxn(b.txn);
  if (!t) return NextResponse.json({ error: "Type the weight (or the amount)." }, { status: 400 });
  if ((t.kind === "issue" || t.kind === "receive") && t.gross_mg > 0 && !t.touch_bp) return NextResponse.json({ error: "Type the purity (touch %)." }, { status: 400 });
  const order = typeof b.order_id === "string" && b.order_id ? await orderById(c.scope.ownerId, b.order_id) : null;
  const day = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) && b.day <= istDay() ? b.day : istDay();
  const r = await restAsService<KarigarTxn[]>(`jw_karigar_txns?select=${TXN_COLS}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    ...t, owner_id: c.scope.ownerId, karigar_id: k.id, order_id: order?.id ?? null, day, created_by_name: c.access.name,
  }) });
  const row = list(r)[0];
  return row ? NextResponse.json({ txn: row }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
}
