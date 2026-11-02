// POST (bearer) AdSpec-like body → the campaign on the owner's ad account (PAUSED unless start_now) + our record of it.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { rateLimited } from "@/lib/api-security";
import { discardCampaign } from "@/lib/social-server";
import { fbAccount, createAd, saveCampaign, isPermissionError, myCampaigns, searchCities, type AdGoal } from "@/lib/ads-server";
import { cleanTargeting, AD_BUDGET, waMismatchText, startAtFor } from "@/lib/ads-shared";
import { standardRunning } from "@/lib/advanced-access";
import { ownerPlanExpiry } from "@/lib/crm-server";

export const maxDuration = 120;
const https = (u: unknown) => (typeof u === "string" && /^https:\/\/.{5,600}$/.test(u) ? u : "");

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`ad-create:${me.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "You have made 10 ads in the last hour. Please wait a little." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const fb = await fbAccount(me.id);
  if (!fb) return NextResponse.json({ error: "Connect a Facebook Page first (Connections)." }, { status: 400 });
  // Ads come with the Standard plan; the first ad is free to try (the screen says so). Checked here, not only in the screen.
  if (!(await standardRunning(me.id)) && !(await ownerPlanExpiry(me.id))) {
    const made = await myCampaigns(me.id);
    if (made.length >= 1) return NextResponse.json({ error: "Your first ad was free. To make more, take the Standard plan (My plan) — the ad money itself always goes to Facebook from your own ad account.", code: "plan" }, { status: 402 });
  }
  const goal: AdGoal = ["whatsapp", "calls", "website"].includes(b.goal) ? b.goal : "whatsapp";
  const url = https(b.creative?.url), thumbUrl = https(b.creative?.thumbUrl);
  if (!url) return NextResponse.json({ error: "Pick a picture or a video for the ad." }, { status: 400 });
  const phone = String(b.phone ?? "").replace(/\D/g, "").slice(-10);
  if (goal !== "website" && phone.length !== 10) return NextResponse.json({ error: "Add your WhatsApp / phone number in the profile first." }, { status: 400 });
  const dailyRupees = Math.min(AD_BUDGET.maxDaily, Math.max(AD_BUDGET.minDaily, Math.round(Number(b.daily_rupees) || AD_BUDGET.defaultDaily)));
  const days = Math.min(AD_BUDGET.maxDays, Math.max(1, Math.round(Number(b.days) || 5)));
  const primaryText = String(b.primary_text ?? "").trim().slice(0, 1500);
  const headline = String(b.headline ?? "").trim().slice(0, 40);
  if (!primaryText || !headline) return NextResponse.json({ error: "Write the ad text and a headline." }, { status: 400 });
  // A town picked before Facebook was connected has only its name (the ad was made first, Facebook joined at the end):
  // it is looked up now, with the owner's own Facebook, and dropped if Facebook does not know it.
  if (fb && b.targeting && Array.isArray(b.targeting.cities)) {
    b.targeting.cities = (await Promise.all((b.targeting.cities as Record<string, unknown>[]).map(async (c) => {
      if (/^[0-9]{1,20}$/.test(String(c?.key ?? ""))) return c;
      const name = String(c?.name ?? "").trim(); if (name.length < 2) return null;
      const hit = (await searchCities(fb, name).catch(() => []))[0];
      return hit ? { ...c, key: hit.key, name: hit.name, type: hit.type === "region" ? "region" : "city" } : null;
    }))).filter(Boolean);
  }
  const spec = {
    name: String(b.name ?? headline).trim().slice(0, 60) || headline,
    goal, creative: { kind: b.creative?.kind === "video" ? "video" as const : "image" as const, url, thumbUrl: thumbUrl || undefined },
    primaryText, headline, description: String(b.description ?? "").trim().slice(0, 30),
    link: https(b.link), phone, dailyPaise: dailyRupees * 100, days,
    targeting: cleanTargeting(b.targeting), startNow: b.start_now === true,
    placements: (b.placements === "feeds" || b.placements === "stories" ? b.placements : "auto") as "auto" | "feeds" | "stories",
    startAt: startAtFor(typeof b.start_date === "string" ? b.start_date : null),
  };
  try {
    const r = await createAd(fb, spec);
    const row = await saveCampaign({
      user_id: me.id, ad_account: r.adAccount, campaign_id: r.campaignId, adset_id: r.adsetId, ad_id: r.adId, creative_id: r.creativeId,
      name: spec.name, goal, creative_url: url, creative_kind: spec.creative.kind, primary_text: primaryText, headline,
      daily_paise: spec.dailyPaise, days, status: r.status, targeting: spec.targeting,
      // v2 (0082): what the owner chose and the dates, so "run again", "extend" and the sync have everything.
      placements: spec.placements, description: spec.description || null, link: spec.link || null, phone: phone || null, thumb_url: thumbUrl || null,
      start_time: r.startTime, end_time: r.endTime, effective_status: r.status, told: {},
    });
    if (!row) {
      // Without our record the ad would not show under "My ads" and could not be paused from the app: take it back.
      if (fb.user_token) await discardCampaign(fb.user_token, r.campaignId);
      return NextResponse.json({ error: "The ad could not be saved. Nothing was started. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...r, row });
  } catch (e) {
    const msg = (e as Error).message;
    const wa = waMismatchText(msg); if (wa) return NextResponse.json({ error: wa }, { status: 400 });
    return NextResponse.json({ error: isPermissionError(msg) ? "Facebook has not allowed ads for this login yet. Open Connections → disconnect Facebook → connect again and allow 'Manage ads'." : msg.slice(0, 300) }, { status: 400 });
  }
}
