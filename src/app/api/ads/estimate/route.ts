// POST (bearer) { targeting, placements } → Meta's reach estimate for the audience (null when it will not say).
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { fbAccount, currentAdAccount, estimate } from "@/lib/ads-server";
import { cleanTargeting } from "@/lib/ads-shared";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ estimate: null });
  try {
    const acct = await currentAdAccount(fb);
    return NextResponse.json({ estimate: await estimate(fb, acct, cleanTargeting(b.targeting), b.placements === "feeds" || b.placements === "stories" ? b.placements : "auto") });
  } catch { return NextResponse.json({ estimate: null }); }
}
