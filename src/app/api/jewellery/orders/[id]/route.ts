// One order or repair: GET it (with its karigar entries), PATCH to take an advance, give it to a karigar, mark it ready, deliver it,
// change the date / estimate, cancel it (with a reason) or send the customer's WhatsApp. An order is never deleted.
import { NextResponse } from "next/server";
import { cleanPayment } from "@/lib/jewellery";
import { jwCtx, jwDenied, jwHas } from "@/lib/jewellery-server";
import { shopName } from "@/lib/jobs-server";
import { cleanOrderItem, orderPaid, type OrderEvent, type OrderRow } from "@/lib/jewellery-orders";
import { askForReview } from "@/lib/customer-send";
import { karigarById, karigarsOf, orderById, orderLink, patchOrder, sendOrder, txnsOf } from "@/lib/jewellery-orders-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "orders")) return jwDenied("see orders");
  const o = await orderById(c.scope.ownerId, id);
  if (!o || (!jwHas(c.access, "reports") && o.created_by !== c.scope.userId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const [karigars, txns, shop] = await Promise.all([
    karigarsOf(c.scope.ownerId, true),
    jwHas(c.access, "karigar") ? txnsOf(c.scope.ownerId).then((t) => t.filter((x) => x.order_id === o.id)) : Promise.resolve([]),
    shopName(c.scope.ownerId),
  ]);
  return NextResponse.json({ order: o, karigars, txns, setup: c.setup, access: c.access, shop, link: orderLink(o) });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  const { scope, access } = c;
  if (!jwHas(access, "orders")) return jwDenied("change orders");
  const o = await orderById(scope.ownerId, id);
  if (!o || (!jwHas(access, "reports") && o.created_by !== scope.userId)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const ev = (text: string): OrderEvent[] => [...(o.events ?? []), { at: new Date().toISOString(), by: access.name, text: text.slice(0, 200) }].slice(-60);
  const done = async (patch: Partial<OrderRow>, send = false) => {
    const next = await patchOrder(scope.ownerId, o.id, patch);
    if (!next) return NextResponse.json({ error: "Could not save." }, { status: 500 });
    const sent = send && next.customer_phone ? await sendOrder(scope, next) : null;
    return NextResponse.json({ order: next, sent });
  };
  const closed = o.status === "delivered" || o.status === "cancelled";

  switch (b.action) {
    case "pay": {
      if (closed) return NextResponse.json({ error: "This order is closed." }, { status: 400 });
      const p = cleanPayment(b.payment);
      if (!p) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
      return done({ payments: [...(o.payments ?? []), p], events: ev(`Advance ₹${Math.round(p.paise / 100).toLocaleString("en-IN")} (${p.mode})`) });
    }
    case "karigar": {
      if (closed) return NextResponse.json({ error: "This order is closed." }, { status: 400 });
      const k = typeof b.karigar_id === "string" && b.karigar_id ? await karigarById(scope.ownerId, b.karigar_id) : null;
      return done({ karigar_id: k?.id ?? null, status: k ? (o.status === "booked" ? "karigar" : o.status) : o.status === "karigar" ? "booked" : o.status, events: ev(k ? `Given to karigar ${k.name}` : "Taken back from the karigar") });
    }
    case "ready": {
      if (closed) return NextResponse.json({ error: "This order is closed." }, { status: 400 });
      return done({ status: "ready", events: ev("Ready") }, b.send === true);
    }
    case "deliver": {
      // An order is delivered by making its bill (the bill builder does it); a repair here, against its charge.
      if (closed) return NextResponse.json({ error: "This order is closed." }, { status: 400 });
      if (o.kind === "order" && b.without_bill !== true) return NextResponse.json({ error: "Make the bill to deliver an order." }, { status: 400 });
      const p = cleanPayment(b.payment);
      const payments = p ? [...(o.payments ?? []), p] : o.payments ?? [];
      const res = await done({ status: "delivered", delivered_at: new Date().toISOString(), payments, events: ev(p ? `Delivered · ₹${Math.round(p.paise / 100).toLocaleString("en-IN")} (${p.mode})` : "Delivered") }, b.send === true);
      // Handed over: thank-you + review link (owner, 25 Nov 2026; the owner's switch decides).
      if (res.status === 200 && o.customer_phone) void askForReview(scope.ownerId, { name: o.customer_name, phone: o.customer_phone }, `jw:${o.id}`);
      return res;
    }
    case "edit": {
      if (closed) return NextResponse.json({ error: "This order is closed." }, { status: 400 });
      const patch: Partial<OrderRow> = {};
      if ("due_date" in b) patch.due_date = typeof b.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null;
      if ("est_paise" in b) patch.est_paise = Math.max(0, Math.min(1e12, Math.round(Number(b.est_paise) || 0)));
      if ("notes" in b) patch.notes = String(b.notes ?? "").slice(0, 400);
      if (Array.isArray(b.items)) { const items = b.items.slice(0, 30).map(cleanOrderItem).filter((i) => i.desc || i.itemType || i.weightMg > 0); if (items.length) patch.items = items; }
      return done({ ...patch, events: ev("Details changed") });
    }
    case "cancel": {
      if (!jwHas(access, "cancel")) return jwDenied("cancel orders");
      if (o.status === "delivered") return NextResponse.json({ error: "A delivered order cannot be cancelled." }, { status: 400 });
      const reason = String(b.reason ?? "").trim().slice(0, 200);
      if (!reason) return NextResponse.json({ error: "Write why it is cancelled." }, { status: 400 });
      const paid = orderPaid(o);
      return done({ status: "cancelled", cancel_reason: `${reason} — ${access.name}`, events: ev(`Cancelled: ${reason}${paid ? ` (advance ₹${Math.round(paid / 100).toLocaleString("en-IN")} to return or adjust)` : ""}`) });
    }
    case "send": {
      return NextResponse.json(await sendOrder(scope, o));
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
