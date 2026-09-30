// GET (bearer) → the owner's campaigns with live spend / reach / clicks from Facebook.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { fbAccount, myCampaigns, liveCampaigns } from "@/lib/ads-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const rows = await myCampaigns(me.id);
  const fb = await fbAccount(me.id);
  let live: Record<string, unknown> = {}, liveError = "";
  if (fb && rows.length) {
    const byAcct = new Map<string, string[]>();
    for (const r of rows) byAcct.set(r.ad_account, [...(byAcct.get(r.ad_account) ?? []), r.campaign_id]);
    for (const [acct, ids] of byAcct) { try { live = { ...live, ...(await liveCampaigns(fb, acct, ids)) }; } catch (e) { liveError = (e as Error).message.slice(0, 200); } }
  }
  return NextResponse.json({ campaigns: rows, live, liveError, managerUrl: rows[0] ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${rows[0].ad_account.replace("act_", "")}` : "" });
}
