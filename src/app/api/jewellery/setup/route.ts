// Jewellery settings: purities, item types, making, GST, invoice, staff rights. GET also lists the shop's staff logins.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { cleanJwSetup } from "@/lib/jewellery";
import { jwCtx, jwDenied, jwHas, saveJwSetup } from "@/lib/jewellery-server";

export async function GET(request: Request) {
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  const staff = jwHas(c.access, "setup")
    ? (await restAsService<{ id: string; name: string; phone: string; role: string; active: boolean }[]>(`crm_agents?owner_id=eq.${c.scope.ownerId}&active=is.true&select=id,name,phone,role,active&order=name`)).data ?? []
    : [];
  return NextResponse.json({ setup: c.setup, access: c.access, staff });
}

export async function PUT(request: Request) {
  const b = (await request.json().catch(() => null)) as { as?: string; setup?: unknown } | null;
  if (!b?.setup) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const c = await jwCtx(request, b.as ?? null);
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "setup")) return jwDenied("change settings");
  const next = cleanJwSetup(b.setup);
  // Only the owner gives staff rights.
  if (!c.access.owner) next.staff = c.setup.staff;
  // The gold scheme and girvi carry legal duties: only the owner switches them, sets their plans, licence and interest.
  if (!c.access.owner) {
    next.schemeOn = c.setup.schemeOn; next.plans = c.setup.plans; next.girviOn = c.setup.girviOn; next.girviLicence = c.setup.girviLicence;
    next.girviRateBp = c.setup.girviRateBp; next.girviMinDays = c.setup.girviMinDays; next.girviLtvBp = c.setup.girviLtvBp; next.girviMonths = c.setup.girviMonths;
  }
  if (!(await saveJwSetup(c.scope.ownerId, next))) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, setup: next });
}
