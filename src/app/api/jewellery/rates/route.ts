// Today's rate: GET the latest and the last 30 days, POST a day's sell (and buy) rates in paise per gram by purity key.
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { istDay, jwCtx, jwDenied, jwHas, rateHistory, rateOf } from "@/lib/jewellery-server";

export async function GET(request: Request) {
  const c = await jwCtx(request, new URL(request.url).searchParams.get("as"));
  if (!c.ok) return c.res;
  const [rate, history, card] = await Promise.all([rateOf(c.scope.ownerId), rateHistory(c.scope.ownerId, 30),
    restAsService<{ username: string }[]>(`cards?owner_id=eq.${c.scope.ownerId}&select=username&order=created_at&limit=1`).catch(() => null)]);
  // The shop's card name, for the rate poster's address (/api/jewellery/rate-poster/<username>).
  const username = Array.isArray(card?.data) ? card.data[0]?.username ?? "" : "";
  return NextResponse.json({ rate, history, today: istDay(), setup: c.setup, username });
}

const clean = (v: unknown, keys: Set<string>) => {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const n = Math.round(Number(x));
    if (keys.has(k) && Number.isFinite(n) && n > 0 && n < 1e9) out[k] = n;
  }
  return out;
};

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { as?: string; day?: string; sell?: unknown; buy?: unknown } | null;
  const c = await jwCtx(request, b?.as ?? null);
  if (!c.ok) return c.res;
  if (!jwHas(c.access, "rate")) return jwDenied("set the rate");
  const today = istDay();
  // Today, or a correction for one of the last 7 days; never a future day.
  const day = typeof b?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day) && b.day <= today && b.day >= istDay(new Date(Date.now() - 7 * 86400_000)) ? b.day : today;
  const keys = new Set(c.setup.purities.map((p) => p.key));
  const sell = clean(b?.sell, keys), buy = clean(b?.buy, keys);
  if (!Object.keys(sell).length) return NextResponse.json({ error: "Type at least one rate." }, { status: 400 });
  const r = await restAsService("jw_rates", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ owner_id: c.scope.ownerId, day, sell, buy, set_by: c.scope.userId, set_by_name: c.access.name, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) return NextResponse.json({ error: "Could not save the rate. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, rate: { day, sell, buy } });
}
