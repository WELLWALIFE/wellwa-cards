// Campaigns made in Facebook Ads Manager (not in the app) on the owner's chosen ad account.
// GET (bearer) → the ones the app does not list yet. POST (bearer) { campaign_id } → add it to "My ads" (start / pause / numbers).
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { fbAccount, myCampaigns, outerCampaigns, saveCampaign, isPermissionError } from "@/lib/ads-server";

const errText = (msg: string) => (isPermissionError(msg) ? "Facebook has not allowed ads for this login yet — reconnect Facebook in Connections." : msg.slice(0, 300));

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ error: "Connect Facebook first." }, { status: 400 });
  try {
    const known = new Set((await myCampaigns(me.id)).map((r) => r.campaign_id));
    const { list } = await outerCampaigns(fb, known);
    return NextResponse.json({ campaigns: list });
  } catch (e) { return NextResponse.json({ error: errText((e as Error).message) }, { status: 400 }); }
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.campaign_id ?? "");
  if (!/^\d{5,25}$/.test(id)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ error: "Connect Facebook first." }, { status: 400 });
  try {
    const mine = await myCampaigns(me.id);
    if (mine.some((r) => r.campaign_id === id)) return NextResponse.json({ ok: true, already: true });
    // Only a campaign that really is on this login's chosen ad account (the list Facebook gives back) can be added.
    const { acct, list } = await outerCampaigns(fb, new Set());
    const c = list.find((x) => x.campaign_id === id);
    if (!c) return NextResponse.json({ error: "This campaign is not on your ad account." }, { status: 404 });
    const st = c.status === "ACTIVE" ? "ACTIVE" : "PAUSED";
    const row = await saveCampaign({ user_id: me.id, ad_account: acct, campaign_id: c.campaign_id, adset_id: c.adset_id, ad_id: c.ad_id, name: c.name.slice(0, 120), goal: c.goal, creative_url: null, creative_kind: null, primary_text: null, headline: null, daily_paise: c.daily_paise, days: c.days, status: st });
    if (!row) return NextResponse.json({ error: "Could not add it. Please try again." }, { status: 500 });
    if (st === "ACTIVE") await restAsService(`ad_campaigns?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ started_at: new Date().toISOString() }) });
    return NextResponse.json({ ok: true, row });
  } catch (e) { return NextResponse.json({ error: errText((e as Error).message) }, { status: 400 }); }
}
