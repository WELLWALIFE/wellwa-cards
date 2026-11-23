// One girvi loan: GET with what is due today; PATCH to take a payment (interest first, then principal), release the pieces
// ("close", only when nothing is due), send a reminder, send / record a notice (only after the due date), extend the due date, or
// record an auction (only after a notice at least 14 days old, with a note of the sale and the settlement).
import { NextResponse } from "next/server";
import { cleanPayment } from "@/lib/jewellery";
import { istDay } from "@/lib/jewellery-server";
import { financeCtx, girviById, girviLink, patchGirvi, sendLine, shopOf } from "@/lib/jewellery-finance-server";
import { addDays, girviMessage, girviState, splitPayment } from "@/lib/jewellery-finance";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const c = await financeCtx(request, new URL(request.url).searchParams.get("as"), "girvi");
  if (!c.ok) return c.res;
  const g = await girviById(c.scope.ownerId, id);
  if (!g) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const today = istDay();
  return NextResponse.json({ girvi: g, state: girviState(g, today), today, link: girviLink(g), shop: await shopOf(c.scope.ownerId, c.setup.shopName), licence: c.setup.girviLicence, access: c.access });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await financeCtx(request, typeof b.as === "string" ? b.as : null, "girvi");
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const g = await girviById(scope.ownerId, id);
  if (!g) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const today = istDay();
  const st = girviState(g, today);
  const shop = () => shopOf(scope.ownerId, setup.shopName);
  const done = async (patch: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const next = await patchGirvi(scope.ownerId, g.id, patch);
    return next ? NextResponse.json({ girvi: next, state: girviState(next, today), ...extra }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
  };
  if (g.status !== "open" && b.action !== "send") return NextResponse.json({ error: "This loan is closed." }, { status: 400 });
  switch (b.action) {
    case "pay": {
      const p = cleanPayment(b.payment);
      if (!p) return NextResponse.json({ error: "Type the amount." }, { status: 400 });
      const sp = splitPayment(p.paise, st);
      if (sp.extra > 0) return NextResponse.json({ error: `Only ₹${(st.due / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} is due today.` }, { status: 400 });
      return done({ payments: [...(g.payments ?? []), { ...p, at: new Date().toISOString(), ref: `${p.ref}${p.ref ? " · " : ""}${access.name}`.slice(0, 60), interest: sp.interest, principal: sp.principal }] }, { split: sp });
    }
    case "close": {
      if (st.due > 0) return NextResponse.json({ error: `₹${(st.due / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} is still due. Take it first, then release.` }, { status: 400 });
      return done({ status: "closed", closed_at: new Date().toISOString(), close_note: `Pieces returned to the customer — ${access.name}` });
    }
    case "extend": {
      const d = typeof b.due_day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_day) ? b.due_day : "";
      if (!d || d <= today) return NextResponse.json({ error: "Pick a date after today." }, { status: 400 });
      return done({ due_day: d });
    }
    case "reminder":
      return NextResponse.json(await sendLine(scope, g.customer_phone, girviMessage("reminder", g, st, await shop(), girviLink(g))));
    case "notice": {
      if (!st.overdue) return NextResponse.json({ error: "A notice goes only after the due date." }, { status: 400 });
      const sent = await sendLine(scope, g.customer_phone, girviMessage("notice", g, st, await shop(), girviLink(g)));
      return done({ notices: [...(g.notices ?? []), { day: today, by: access.name }] }, { sent });
    }
    case "send":
      return NextResponse.json(await sendLine(scope, g.customer_phone, girviMessage(g.status === "open" ? "reminder" : "given", g, st, await shop(), girviLink(g))));
    case "auction": {
      const first = (g.notices ?? [])[0]?.day;
      if (!st.overdue || !first || first > addDays(today, -14)) return NextResponse.json({ error: "An auction can be recorded only 14 days after a notice was sent, on an overdue loan. Follow your state's law and licence conditions." }, { status: 400 });
      const note = String(b.note ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
      if (note.length < 10) return NextResponse.json({ error: "Write the sale amount and how the balance was settled with the customer." }, { status: 400 });
      return done({ status: "auctioned", closed_at: new Date().toISOString(), close_note: `${note} — ${access.name}` });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
