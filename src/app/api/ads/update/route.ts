// POST (bearer) { id, daily_rupees?, extend_days?, end_date? } → change the money / the days of one of the owner's ads (Ads v2, 1 Nov 2026).
// The change goes to the ad set on Meta first; our row follows. An ended ad cannot be changed — "run again" makes a new one.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { fbAccount, updateCampaign, isPermissionError, type CampaignRow } from "@/lib/ads-server";
import { AD_BUDGET } from "@/lib/ads-shared";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.id !== "string" || !/^[0-9a-f-]{36}$/i.test(b.id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const row = (await restAsService<CampaignRow[]>(`ad_campaigns?id=eq.${b.id}&user_id=eq.${me.id}&select=*`)).data?.[0];
  if (!row) return NextResponse.json({ error: "Ad not found." }, { status: 404 });
  if (row.ended_at) return NextResponse.json({ error: "This ad has ended. Use “Run again” to make a new one with the same settings." }, { status: 409 });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ error: "Connect Facebook first." }, { status: 400 });
  const patch: { dailyPaise?: number; endTime?: string } = {};
  const our: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.daily_rupees !== undefined) {
    const d = Math.round(Number(b.daily_rupees) || 0);
    if (d < AD_BUDGET.minDaily || d > AD_BUDGET.maxDaily) return NextResponse.json({ error: `Spend between ₹${AD_BUDGET.minDaily} and ₹${AD_BUDGET.maxDaily} a day.` }, { status: 400 });
    patch.dailyPaise = d * 100; our.daily_paise = d * 100;
  }
  const now = Date.now();
  const curEnd = row.end_time ? Date.parse(row.end_time) : NaN;
  if (b.extend_days !== undefined || b.end_date !== undefined) {
    let end: number;
    if (b.end_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.end_date))) return NextResponse.json({ error: "bad date" }, { status: 400 });
      end = Date.parse(`${b.end_date}T23:59:00+05:30`);
    } else {
      const ext = Math.round(Number(b.extend_days) || 0);
      if (ext < 1 || ext > AD_BUDGET.maxDays) return NextResponse.json({ error: `Extend by 1 to ${AD_BUDGET.maxDays} days.` }, { status: 400 });
      end = Math.max(Number.isFinite(curEnd) ? curEnd : now, now) + ext * 86400_000;
    }
    if (end < now + 3600_000) return NextResponse.json({ error: "The end must be at least an hour from now." }, { status: 400 });
    if (end > now + 90 * 86400_000) return NextResponse.json({ error: "An ad can run for at most 90 days from today." }, { status: 400 });
    patch.endTime = new Date(end).toISOString(); our.end_time = patch.endTime;
    const start = row.start_time ? Date.parse(row.start_time) : Date.parse(row.created_at);
    our.days = Math.max(1, Math.round((end - start) / 86400_000));
    our.ended_at = null;
  }
  if (!patch.dailyPaise && !patch.endTime) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    await updateCampaign(fb, row, patch);
    await restAsService(`ad_campaigns?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(our) });
    return NextResponse.json({ ok: true, daily_paise: our.daily_paise ?? row.daily_paise, end_time: our.end_time ?? row.end_time, days: our.days ?? row.days });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: isPermissionError(msg) ? "Facebook has not allowed ads for this login yet — reconnect Facebook in Connections." : msg.slice(0, 300) }, { status: 400 });
  }
}
