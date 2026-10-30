// The "Advanced features" box (bearer). GET → AddonsAnswer (src/lib/addons.ts): which advanced features this account
// may see (Premium + its kind of business, or already switched on), and whether a shop it works in has Orders on.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { memberships } from "@/lib/crm-server";
import { ADDONS, type AddonsAnswer } from "@/lib/addons";
import { addonOn, fitsBusiness, premiumActive, readAddons } from "@/lib/addons-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const [premium, flags, teams] = await Promise.all([
    premiumActive(me.id),
    readAddons(me.id),
    memberships(me.token, me.id).catch(() => [] as { owner_id: string }[]),
  ]);
  const list: AddonsAnswer["list"] = [];
  for (const a of ADDONS) {
    const on = flags[a.key]?.on === true;
    const fits = on || (premium && (await fitsBusiness(me.id, a)));
    if (on || fits) list.push({ key: a.key, on, fits });
  }
  let teamOrders = false;
  for (const t of (teams as { owner_id: string }[]).slice(0, 10)) if (await addonOn(t.owner_id, "orders")) { teamOrders = true; break; }
  const out: AddonsAnswer = { premium, list, teamOrders };
  return NextResponse.json(out);
}
