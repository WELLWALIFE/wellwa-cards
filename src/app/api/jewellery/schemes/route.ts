// Gold scheme members: GET the list (active / redeemed / closed, search) with where each stands; POST to enrol a member on a plan
// (with the first instalment if paid now). Only with the scheme switched on (Settings) and the "scheme" right.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPayment, type Payment } from "@/lib/jewellery";
import { cleanPhone } from "@/lib/jobs";
import { istDay } from "@/lib/jewellery-server";
import { createScheme, financeCtx, schemeLink, sendLine, shopOf } from "@/lib/jewellery-finance-server";
import { SCHEME_COLS, schemeMessage, schemeState, type SchemeRow } from "@/lib/jewellery-finance";

const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = await financeCtx(request, sp.get("as"), "scheme");
  if (!c.ok) return c.res;
  const view = sp.get("view") ?? "active";
  const p = [`owner_id=eq.${c.scope.ownerId}`, `select=${SCHEME_COLS}`, "order=created_at.desc", "limit=1000"];
  if (["active", "redeemed", "closed"].includes(view)) p.push(`status=eq.${view}`);
  const q = (sp.get("q") ?? "").replace(/[^A-Za-z0-9 ऀ-ॿ/]/g, "").trim().slice(0, 30);
  if (q) p.push(`or=(customer_name.ilike.*${encodeURIComponent(q)}*,customer_phone.ilike.*${encodeURIComponent(q.replace(/\D/g, "") || q)}*,code.ilike.*${encodeURIComponent(q)}*)`);
  const r = await restAsService<SchemeRow[]>(`jw_schemes?${p.join("&")}`);
  const today = istDay();
  const rows = (Array.isArray(r.data) ? r.data : []).map((s) => ({ ...s, state: schemeState(s, today) }));
  return NextResponse.json({ schemes: rows, plans: c.setup.plans.filter((x) => x.on), today, access: c.access });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await financeCtx(request, typeof b.as === "string" ? b.as : null, "scheme");
  if (!c.ok) return c.res;
  const { scope, setup, access } = c;
  const plan = setup.plans.find((p) => p.on && p.key === b.plan);
  if (!plan) return NextResponse.json({ error: "Pick a plan." }, { status: 400 });
  const name = txt(b.customer_name, 80), phone = cleanPhone(b.customer_phone);
  if (!name || !phone) return NextResponse.json({ error: "Name and mobile are needed for a scheme member." }, { status: 400 });
  const today = istDay();
  const start = typeof b.start_day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.start_day) && b.start_day <= today ? b.start_day : today;
  const first = cleanPayment(b.payment);
  const payments: Payment[] = first ? [{ ...first, at: new Date().toISOString() }] : [];
  const s = await createScheme(scope, {
    status: "active", plan, customer_name: name, customer_phone: phone, customer_address: txt(b.customer_address, 200), nominee: txt(b.nominee, 80),
    start_day: start, payments, created_by: scope.userId, created_by_name: access.name,
  });
  if (!s) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  const sent = b.send === true && first ? await sendLine(scope, s.customer_phone, schemeMessage(s, schemeState(s, today), first.paise, await shopOf(scope.ownerId, setup.shopName), schemeLink(s))) : null;
  return NextResponse.json({ scheme: s, sent });
}
