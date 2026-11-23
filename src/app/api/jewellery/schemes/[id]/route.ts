// One scheme member: GET with where they stand; PATCH to take an instalment ("pay"), send the passbook ("send"), or close the
// account early ("close": the deposits are given back or adjusted — the note says which; no bonus). Using it on a bill is done
// by the bill (bill builder ?scheme=<id>), which marks it redeemed.
import { NextResponse } from "next/server";
import { cleanPayment } from "@/lib/jewellery";
import { istDay } from "@/lib/jewellery-server";
import { financeCtx, patchScheme, schemeById, schemeLink, sendLine, shopOf } from "@/lib/jewellery-finance-server";
import { schemeMessage, schemeState } from "@/lib/jewellery-finance";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await financeCtx(request, new URL(request.url).searchParams.get("as"), "scheme");
  if (!c.ok) return c.res;
  const s = await schemeById(c.scope.ownerId, id);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const today = istDay();
  return NextResponse.json({ scheme: s, state: schemeState(s, today), today, link: schemeLink(s), shop: await shopOf(c.scope.ownerId, c.setup.shopName), access: c.access });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await financeCtx(request, typeof b.as === "string" ? b.as : null, "scheme");
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const s = await schemeById(scope.ownerId, id);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const today = istDay();
  const shop = () => shopOf(scope.ownerId, setup.shopName);
  switch (b.action) {
    case "pay": {
      if (s.status !== "active") return NextResponse.json({ error: "This scheme is closed." }, { status: 400 });
      const p = cleanPayment(b.payment);
      if (!p) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
      const st0 = schemeState(s, today);
      const left = s.plan.monthlyPaise * s.plan.months - st0.paid;
      if (p.paise > left) return NextResponse.json({ error: `Only ₹${Math.round(left / 100).toLocaleString("en-IN")} is left to pay on this plan.` }, { status: 400 });
      const next = await patchScheme(scope.ownerId, s.id, { payments: [...(s.payments ?? []), { ...p, at: new Date().toISOString(), ref: `${p.ref}${p.ref ? " · " : ""}${access.name}`.slice(0, 60) }] });
      if (!next) return NextResponse.json({ error: "Could not save." }, { status: 500 });
      const sent = b.send === true ? await sendLine(scope, next.customer_phone, schemeMessage(next, schemeState(next, today), p.paise, await shop(), schemeLink(next))) : null;
      return NextResponse.json({ scheme: next, state: schemeState(next, today), sent });
    }
    case "send": {
      const st = schemeState(s, today);
      const last = s.payments?.length ? s.payments[s.payments.length - 1].paise : 0;
      return NextResponse.json(await sendLine(scope, s.customer_phone, schemeMessage(s, st, last, await shop(), schemeLink(s))));
    }
    case "close": {
      if (s.status !== "active") return NextResponse.json({ error: "This scheme is already closed." }, { status: 400 });
      const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!note) return NextResponse.json({ error: "Write how the deposits were settled (returned in cash / adjusted…)." }, { status: 400 });
      const next = await patchScheme(scope.ownerId, s.id, { status: "closed", close_note: `${note} — ${access.name}` });
      return next ? NextResponse.json({ scheme: next, state: schemeState(next, today) }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
