// Karigars: GET the list with what each holds (fine gold / silver) and what the shop owes them; POST to add one or change one.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanPhone } from "@/lib/jobs";
import { jwCtx, jwDenied, jwHas } from "@/lib/jewellery-server";
import { balancesOf, karigarById, karigarsOf } from "@/lib/jewellery-orders-server";

const txt = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function GET(request: Request) {
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "karigar")) return jwDenied("see the karigar ledger");
  const [karigars, balances, open] = await Promise.all([
    karigarsOf(c.scope.ownerId, true), balancesOf(c.scope.ownerId),
    restAsService<{ karigar_id: string }[]>(`jw_orders?owner_id=eq.${c.scope.ownerId}&status=eq.karigar&select=karigar_id&limit=2000`),
  ]);
  const openBy: Record<string, number> = {};
  for (const r of Array.isArray(open.data) ? open.data : []) if (r.karigar_id) openBy[r.karigar_id] = (openBy[r.karigar_id] ?? 0) + 1;
  return NextResponse.json({ karigars, balances, open: openBy, access: c.access });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const c = await jwCtx(request, typeof b.as === "string" ? b.as : null);
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "karigar")) return jwDenied("change karigars");
  const name = txt(b.name, 60);
  const row = { name, phone: cleanPhone(b.phone), skill: txt(b.skill, 60), ...(typeof b.active === "boolean" ? { active: b.active } : {}) };
  if (typeof b.id === "string") {
    const k = await karigarById(c.scope.ownerId, b.id);
    if (!k) return NextResponse.json({ error: "Karigar not found." }, { status: 404 });
    const r = await restAsService(`jw_karigars?id=eq.${k.id}&owner_id=eq.${c.scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...row, name: name || k.name }) });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  if (!name) return NextResponse.json({ error: "Write the karigar's name." }, { status: 400 });
  const r = await restAsService<{ id: string }[]>("jw_karigars?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...row, owner_id: c.scope.ownerId }) });
  const id = Array.isArray(r.data) ? r.data[0]?.id : null;
  return id ? NextResponse.json({ id }) : NextResponse.json({ error: "Could not save." }, { status: 500 });
}
