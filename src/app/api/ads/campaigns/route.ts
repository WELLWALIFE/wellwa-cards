// GET (bearer) → the owner's campaigns with live spend / reach / clicks from Facebook.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { fbAccount, myCampaigns, liveCampaigns, type CampaignLive } from "@/lib/ads-server";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const rows = await myCampaigns(me.id);
  const fb = await fbAccount(me.id);
  let live: Record<string, CampaignLive> = {}, liveError = "";
  // Campaigns deleted or archived in Ads Manager are not shown. Facebook leaves them out of its campaign list, so a campaign
  // missing from an account that DID answer is gone (one made in the last 15 minutes may not be listed yet, so it stays).
  const gone = new Set<string>();
  if (fb && rows.length) {
    const byAcct = new Map<string, string[]>();
    for (const r of rows) byAcct.set(r.ad_account, [...(byAcct.get(r.ad_account) ?? []), r.campaign_id]);
    for (const [acct, ids] of byAcct) {
      try {
        const got = await liveCampaigns(fb, acct, ids);
        live = { ...live, ...got };
        for (const id of ids) if (!got[id]) gone.add(id);
      } catch (e) { liveError = (e as Error).message.slice(0, 200); }
    }
  }
  const fresh = Date.now() - 15 * 60_000;
  const shown = rows.filter((r) => {
    const st = (live[r.campaign_id]?.status ?? r.status ?? "").toUpperCase();
    if (st === "DELETED" || st === "ARCHIVED") return false;
    return !(gone.has(r.campaign_id) && new Date(r.created_at).getTime() < fresh);
  });
  return NextResponse.json({ campaigns: shown, live, liveError, managerUrl: shown[0] ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${shown[0].ad_account.replace("act_", "")}` : "" });
}
