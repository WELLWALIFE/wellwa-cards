// Stock: GET the pieces (filters) with what is in hand by purity, or one piece by its tag (?tag=, for the bill's scan box);
// POST to add a piece (it gets the next tag).
import { NextResponse } from "next/server";
import { jwCtx, jwDenied, jwHas } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { createStock, stockByTag, stockInHand, stockList } from "@/lib/jewellery-stock-server";
import { cleanStockFields, stockSummary, type StockRow } from "@/lib/jewellery-stock";

/** What the shop paid is the owner's business only. */
const forStaff = (r: StockRow, owner: boolean): StockRow => (owner ? r : { ...r, cost_paise: 0 });

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await jwCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const tag = sp.get("tag");
  if (tag !== null) {
    if (!jwHas(access, "bill") && !jwHas(access, "stock")) return jwDenied("look up stock");
    const item = await stockByTag(scope.ownerId, tag);
    return item ? NextResponse.json({ item: forStaff(item, access.owner) }) : NextResponse.json({ error: `Tag ${tag.toUpperCase()} is not in your stock.` }, { status: 404 });
  }
  if (!jwHas(access, "stock")) return jwDenied("see the stock");
  const [items, hand, shop] = await Promise.all([
    stockList(scope.ownerId, { ids: (sp.get("ids") ?? "").split(",").filter(Boolean), status: sp.get("status") ?? "sellable", type: sp.get("type") ?? "", purity: sp.get("purity") ?? "", q: sp.get("q") ?? "", limit: 500 }),
    stockInHand(scope.ownerId),
    shopName(scope.ownerId),
  ]);
  return NextResponse.json({ items: items.map((r) => forStaff(r, access.owner)), summary: stockSummary(hand, setup), count: hand.length, setup, access, shop: setup.shopName || shop });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!jwHas(access, "stock")) return jwDenied("add stock");
  const f = cleanStockFields(b);
  if (!f.gross_mg) return NextResponse.json({ error: "Type the gross weight." }, { status: 400 });
  if (!setup.purities.some((p) => p.key === f.purity)) return NextResponse.json({ error: "Pick the purity." }, { status: 400 });
  if (f.huid && f.huid.length !== 6) return NextResponse.json({ error: "HUID is 6 letters / digits." }, { status: 400 });
  if (!access.owner) f.cost_paise = 0;
  const item = await createStock(scope.ownerId, f, { id: scope.userId, name: access.name });
  return item ? NextResponse.json({ item: forStaff(item, access.owner) }) : NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
}
