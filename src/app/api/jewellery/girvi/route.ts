// Girvi (gold loan): GET the loans (open / closed / auctioned, overdue first) with what is due today; POST to give a loan against
// the customer's pieces. The shop's rate, minimum days and loan limit (a share of the valuation) come from Settings. Only with
// girvi switched on (with the money-lender licence) and the "girvi" right.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPayment } from "@/lib/jewellery";
import { cleanPhone } from "@/lib/jobs";
import { istDay } from "@/lib/jewellery-server";
import { createGirvi, financeCtx, girviLink, sendLine, shopOf } from "@/lib/jewellery-finance-server";
import { GIRVI_COLS, addMonths, cleanGirviItem, girviMessage, girviState, type GirviItem, type GirviRow } from "@/lib/jewellery-finance";

const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** Only the kind of ID and its last 4 digits are kept (never the full number). */
const idProof = (kind: unknown, num: unknown) => {
  const k = txt(kind, 20); const last = String(num ?? "").replace(/\D/g, "").slice(-4);
  return [k, last ? `xx${last}` : ""].filter(Boolean).join(" ");
};

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await financeCtx(request, sp.get("as"), "girvi");
  if (!c.ok) return c.res;
  const view = sp.get("view") ?? "open";
  const p = [`owner_id=eq.${c.scope.ownerId}`, `select=${GIRVI_COLS}`, "order=due_day", "limit=2000"];
  if (["open", "closed", "auctioned"].includes(view)) p.push(`status=eq.${view}`);
  const q = (sp.get("q") ?? "").replace(/[^A-Za-z0-9 ऀ-ॿ/]/g, "").trim().slice(0, 30);
  if (q) p.push(`or=(customer_name.ilike.*${encodeURIComponent(q)}*,customer_phone.ilike.*${encodeURIComponent(q.replace(/\D/g, "") || q)}*,code.ilike.*${encodeURIComponent(q)}*)`);
  const r = await restAsService<GirviRow[]>(`jw_girvi?${p.join("&")}`);
  const today = istDay();
  const rows = (Array.isArray(r.data) ? r.data : []).map((g) => ({ ...g, state: girviState(g, today) }));
  const open = rows.filter((g) => g.status === "open");
  return NextResponse.json({
    loans: rows, today, access: c.access,
    totals: { count: open.length, principal: open.reduce((a, g) => a + g.state.principal, 0), interest: open.reduce((a, g) => a + g.state.interest, 0), overdue: open.filter((g) => g.state.overdue).length },
    rules: { rateBp: c.setup.girviRateBp, minDays: c.setup.girviMinDays, ltvBp: c.setup.girviLtvBp, months: c.setup.girviMonths, licence: c.setup.girviLicence },
  });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await financeCtx(request, typeof b.as === "string" ? b.as : null, "girvi");
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const name = txt(b.customer_name, 80), phone = cleanPhone(b.customer_phone);
  if (!name || !phone) return NextResponse.json({ error: "Name and mobile are needed." }, { status: 400 });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map(cleanGirviItem).filter((x): x is GirviItem => !!x);
  if (!items.length) return NextResponse.json({ error: "Add the pieces kept, with their weight." }, { status: 400 });
  const valuation = Math.max(0, Math.round(Number(b.valuation_paise) || 0));
  const loan = Math.max(0, Math.round(Number(b.loan_paise) || 0));
  if (!valuation || !loan) return NextResponse.json({ error: "Type the valuation and the loan amount." }, { status: 400 });
  const limit = Math.floor((valuation * setup.girviLtvBp) / 10000);
  if (loan > limit) return NextResponse.json({ error: `The loan can be at most ${setup.girviLtvBp / 100}% of the valuation: ₹${Math.floor(limit / 100).toLocaleString("en-IN")}.` }, { status: 400 });
  const today = istDay();
  const due = typeof b.due_day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_day) && b.due_day > today ? b.due_day : addMonths(today, setup.girviMonths);
  const g = await createGirvi(scope, {
    status: "open", customer_name: name, customer_phone: phone, customer_address: txt(b.customer_address, 200), id_proof: idProof(b.id_kind, b.id_number),
    items, valuation_paise: valuation, loan_paise: loan, rate_bp: setup.girviRateBp, min_days: setup.girviMinDays,
    start_day: today, due_day: due, payments: [], notices: [], created_by: scope.userId, created_by_name: access.name,
  });
  if (!g) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  // How the loan was paid out is noted on the timeline of the receipt only (cash / bank), not as a payment.
  const out = cleanPayment(b.payout);
  const sent = b.send === true ? await sendLine(scope, g.customer_phone, girviMessage("given", g, girviState(g, today), await shopOf(scope.ownerId, setup.shopName), girviLink(g))) : null;
  return NextResponse.json({ girvi: g, payout: out?.mode ?? "cash", sent });
}
