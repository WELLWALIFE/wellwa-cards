// One piece: GET it (with the bill it was sold on); PATCH to edit it (until it is sold) or move it: back in stock, out on approval,
// melted / broken, returned to the supplier (with a note). "Sold" is only ever set by a bill.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { jwCtx, jwDenied, jwHas } from "@/lib/jewellery-server";
import { stockById } from "@/lib/jewellery-stock-server";
import { STOCK_COLS, cleanStockFields, type StockRow, type StockStatus } from "@/lib/jewellery-stock";

type Ctx = { params: Promise<{ id: string }> };
const MOVES: StockStatus[] = ["in_stock", "approval", "melted", "returned"];

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "stock")) return jwDenied("see the stock");
  const item = await stockById(c.scope.ownerId, id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const bill = item.bill_id ? (await restAsService<{ id: string; code: string; customer_name: string }[]>(`jw_bills?id=eq.${item.bill_id}&owner_id=eq.${c.scope.ownerId}&select=id,code,customer_name&limit=1`)).data?.[0] ?? null : null;
  return NextResponse.json({ item: c.access.owner ? item : { ...item, cost_paise: 0 }, bill, setup: c.setup, access: c.access });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!jwHas(access, "stock")) return jwDenied("change the stock");
  const item = await stockById(scope.ownerId, id);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let patch: Partial<StockRow>;
  if (b.action === "edit") {
    if (item.status === "sold") return NextResponse.json({ error: "A sold piece cannot be changed. Cancel its bill first." }, { status: 400 });
    const f = cleanStockFields(b);
    if (!f.gross_mg) return NextResponse.json({ error: "Type the gross weight." }, { status: 400 });
    if (!setup.purities.some((p) => p.key === f.purity)) return NextResponse.json({ error: "Pick the purity." }, { status: 400 });
    if (f.huid && f.huid.length !== 6) return NextResponse.json({ error: "HUID is 6 letters / digits." }, { status: 400 });
    // The tag stays as printed (its item code does not change with the type); only the owner sees or sets the cost.
    patch = { ...f, cost_paise: access.owner ? f.cost_paise : item.cost_paise };
  } else if (b.action === "move") {
    const to = MOVES.find((m) => m === b.status);
    if (!to) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    if (item.status === "sold") return NextResponse.json({ error: "A sold piece comes back only by cancelling its bill." }, { status: 400 });
    const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (to !== "in_stock" && !note) return NextResponse.json({ error: to === "approval" ? "Write who took it on approval." : "Write a short note why." }, { status: 400 });
    patch = { status: to, status_note: note ? `${note} — ${access.name}` : "" };
  } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const r = await restAsService<StockRow[]>(`jw_stock?id=eq.${item.id}&owner_id=eq.${scope.ownerId}&select=${STOCK_COLS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  const next = Array.isArray(r.data) ? r.data[0] : null;
  return next ? NextResponse.json({ item: access.owner ? next : { ...next, cost_paise: 0 } }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
}
