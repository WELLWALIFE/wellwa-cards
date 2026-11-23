// Orders and repairs: GET the list (open / ready / delivered / all, search), POST a new one. A counter login sees the ones it booked
// unless it has the "reports" right.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { istDay, jwCtx, jwDenied, jwHas, rateOf } from "@/lib/jewellery-server";
import { sellRate } from "@/lib/jewellery";
import { ORDER_COLS, cleanOrderItem, cleanPayments, type OrderKind, type OrderRow } from "@/lib/jewellery-orders";
import { createOrder, karigarById, karigarsOf, sendOrder } from "@/lib/jewellery-orders-server";

const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const VIEWS: Record<string, string> = {
  open: "status=in.(booked,karigar,ready)", ready: "status=eq.ready", karigar: "status=eq.karigar", booked: "status=eq.booked",
  delivered: "status=eq.delivered", cancelled: "status=eq.cancelled",
};

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const c = await jwCtx(request, u.get("as"));
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "orders")) return jwDenied("see orders");
  const p: string[] = [`owner_id=eq.${c.scope.ownerId}`, `select=${ORDER_COLS}`, "order=due_date.asc.nullslast,created_at.desc", `limit=${Math.min(300, Number(u.get("limit")) || 150)}`];
  if (!jwHas(c.access, "reports")) p.push(`created_by=eq.${c.scope.userId}`);
  const view = u.get("view") ?? "open";
  if (VIEWS[view]) p.push(VIEWS[view]);
  if (view === "late") p.push("status=in.(booked,karigar)", `due_date=lt.${istDay()}`);
  const kind = u.get("kind");
  if (kind === "order" || kind === "repair") p.push(`kind=eq.${kind}`);
  const karigar = u.get("karigar");
  if (karigar && /^[0-9a-f-]{36}$/i.test(karigar)) p.push(`karigar_id=eq.${karigar}`);
  const q = txt(u.get("q"), 40).replace(/[^\p{L}\p{N} /+-]/gu, "");
  if (q) p.push(`or=(customer_name.ilike.*${encodeURIComponent(q)}*,customer_phone.ilike.*${encodeURIComponent(q.replace(/\D/g, "") || q)}*,code.ilike.*${encodeURIComponent(q)}*)`);
  const [orders, karigars] = await Promise.all([restAsService<OrderRow[]>(`jw_orders?${p.join("&")}`), karigarsOf(c.scope.ownerId, true)]);
  return NextResponse.json({ orders: list(orders), karigars, today: istDay(), access: c.access, setup: c.setup });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  if (!jwHas(access, "orders")) return jwDenied("book orders");
  const kind: OrderKind = b.kind === "repair" ? "repair" : "order";
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map(cleanOrderItem).filter((i) => i.desc || i.itemType || i.weightMg > 0);
  if (!items.length) return NextResponse.json({ error: "Write what is to be made or repaired." }, { status: 400 });
  const name = txt(b.customer_name, 80), phone = cleanPhone(b.customer_phone);
  if (!name && !phone) return NextResponse.json({ error: "Write the customer's name or mobile." }, { status: 400 });
  // The booking rate is locked at TODAY's rate of the chosen purity, worked out here — never a rate typed in the app.
  let rate_lock = null;
  if (kind === "order" && b.lock_rate === true) {
    const book = await rateOf(scope.ownerId);
    const purity = items.find((i) => i.purity)?.purity ?? "";
    const rate = book && book.day === istDay() && purity ? sellRate(book, setup, purity) : 0;
    if (!rate) return NextResponse.json({ error: "Set today's rate first to lock it for this order." }, { status: 400 });
    rate_lock = { purity, rate, day: book!.day };
  }
  const karigar = typeof b.karigar_id === "string" ? await karigarById(scope.ownerId, b.karigar_id) : null;
  const o = await createOrder(scope, kind, {
    customer_name: name, customer_phone: phone, items,
    est_paise: Math.max(0, Math.min(1e12, Math.round(Number(b.est_paise) || 0))),
    payments: cleanPayments(b.payments), rate_lock,
    due_date: typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null,
    karigar_id: karigar?.id ?? null, notes: txt(b.notes, 400), created_by: scope.userId, created_by_name: access.name,
  });
  if (!o) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  const sent = b.send === true && o.customer_phone ? await sendOrder(scope, o) : null;
  return NextResponse.json({ order: o, sent });
}
