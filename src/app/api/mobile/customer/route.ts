// One customer, looked up by mobile while billing: their name from the last bill, what they owe, and their loyalty points.
import { NextResponse } from "next/server";
import { cleanPhone } from "@/lib/jobs";
import { pointsBalance } from "@/lib/mobile";
import { customerBills, msCtx, msDenied, msHas } from "@/lib/mobile-server";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await msCtx(request, sp.get("as"));
  if (!c.ok) return c.res;
  if (!msHas(c.access, "bill")) return msDenied("make bills");
  const phone = cleanPhone(sp.get("phone"));
  if (!phone) return NextResponse.json({ error: "Type a 10-digit mobile." }, { status: 400 });
  const bills = await customerBills(c.scope.ownerId, phone);
  const live = bills.filter((b) => b.status !== "cancelled");
  const due = live.filter((b) => b.kind === "sale" && b.status === "open" && b.balance_paise > 0);
  const p = c.setup.points;
  return NextResponse.json({
    name: live.find((b) => b.customer_name)?.customer_name ?? "",
    bills: live.filter((b) => b.kind === "sale").length,
    due: { count: due.length, paise: due.reduce((a, b) => a + b.balance_paise, 0) },
    points: p.on ? { ...pointsBalance(bills, p), worth: p.worth, min: p.min } : null,
  });
}
