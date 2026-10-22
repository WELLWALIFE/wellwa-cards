import "server-only";
// Facebook / Instagram ads from inside the app (owner's call, 30 Sep 2026): one wizard — picture or video, goal,
// audience, budget, words — creates a real campaign on the owner's own ad account through the Marketing API.
// Money rules: every campaign is created PAUSED unless the owner explicitly taps "Start now"; the daily budget and
// the end date are always set, so nothing can run for ever; Start / Pause work from the app and Ads Manager alike.
// Needs the Facebook login to carry ads_management + ads_read (SCOPES in social-server.ts).
import { discardCampaign, graph, graphStep, listAccounts, uploadAdImage, type AccountRow } from "@/lib/social-server";
import { restAsService } from "@/lib/poster-server";
import { geminiComplete } from "@/lib/gemini";
import { SITE_URL } from "@/lib/site-url";

export type AdGoal = "whatsapp" | "calls" | "website";
export type AdTargeting = {
  /** Meta city / region keys with a radius (km, cities only); empty = whole of India. */
  cities: { key: string; name: string; radius: number; type?: "city" | "region" }[];
  ageMin: number; ageMax: number;
  gender: "all" | "men" | "women";
  interests: { id: string; name: string }[];
};
export type AdSpec = {
  name: string;
  goal: AdGoal;
  creative: { kind: "image" | "video"; url: string; thumbUrl?: string };
  primaryText: string; headline: string; description?: string;
  link: string;      // the card / website
  phone: string;     // WhatsApp / call number
  dailyPaise: number; days: number;
  targeting: AdTargeting;
  startNow: boolean;
  placements: "auto" | "feeds" | "stories";
};
export type AdAccountInfo = { id: string; name: string; status: number; currency: string; spent: string; funding: string; ok: boolean };

const S = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export const isPermissionError = (msg: string) => /permission|ads_management|ads_read|\(#200\)|\(#10\)|\(#3\)|not authorized|does not have the capability/i.test(msg);

/** The owner's active Facebook connection (its user token is what the Marketing API wants). */
export async function fbAccount(userId: string): Promise<AccountRow | null> {
  return (await listAccounts(userId)).find((a) => a.provider === "facebook" && a.is_active) ?? null;
}

/** The ad accounts this login can use. Status 1 = active; others are disabled / unsettled / in review. */
export async function adAccounts(fb: AccountRow): Promise<AdAccountInfo[]> {
  const ut = fb.user_token; if (!ut) throw new Error("Reconnect Facebook to allow ads.");
  const r = await graph<{ data: { id: string; name: string; account_status: number; currency: string; amount_spent: string; funding_source_details?: { display_string?: string } }[] }>("me/adaccounts", { access_token: ut, fields: "id,name,account_status,currency,amount_spent,funding_source_details", limit: "25" });
  return (r.data ?? []).map((x) => ({ id: x.id, name: x.name, status: x.account_status, currency: x.currency, spent: x.amount_spent ?? "0", funding: x.funding_source_details?.display_string ?? "", ok: x.account_status === 1 }));
}

/** Remember the chosen ad account on the Facebook connection row. */
export async function chooseAdAccount(fb: AccountRow, id: string) {
  await restAsService(`social_accounts?id=eq.${fb.id}`, { method: "PATCH", body: JSON.stringify({ ad_account_id: id }) });
}

/** The ad account to use: the chosen one, else the first active one (remembered). */
export async function currentAdAccount(fb: AccountRow): Promise<string> {
  if (fb.ad_account_id) return fb.ad_account_id;
  const list = await adAccounts(fb);
  const pick = list.find((a) => a.ok)?.id ?? list[0]?.id;
  if (!pick) throw new Error("No ad account found on this Facebook login. Create one in Meta Business Suite → Ads Manager first.");
  await chooseAdAccount(fb, pick);
  return pick;
}

/** City search for the audience ("Rewari" → the Meta key it needs). */
export async function searchCities(fb: AccountRow, q: string) {
  const ut = fb.user_token; if (!ut) return [];
  const r = await graph<{ data: { key: string; name: string; region?: string; country_name?: string; type: string }[] }>("search", { access_token: ut, type: "adgeolocation", location_types: JSON.stringify(["city", "region"]), country_code: "IN", q: q.slice(0, 60), limit: "8" });
  return (r.data ?? []).map((x) => ({ key: x.key, name: x.name, region: x.region ?? "", type: x.type }));
}
/** Interest search (optional narrowing; broad + local usually does better for a shop's WhatsApp ad). */
export async function searchInterests(fb: AccountRow, q: string) {
  const ut = fb.user_token; if (!ut) return [];
  const r = await graph<{ data: { id: string; name: string; audience_size_lower_bound?: number }[] }>("search", { access_token: ut, type: "adinterest", q: q.slice(0, 60), limit: "8" });
  return (r.data ?? []).map((x) => ({ id: x.id, name: x.name, size: x.audience_size_lower_bound ?? 0 }));
}

/** Meta's targeting spec from the wizard's answers. */
export function targetingSpec(t: AdTargeting, placements: AdSpec["placements"]) {
  const cities = t.cities.filter((c) => c.type !== "region").map((c) => ({ key: c.key, radius: Math.min(80, Math.max(10, c.radius || 25)), distance_unit: "kilometer" }));
  const regions = t.cities.filter((c) => c.type === "region").map((c) => ({ key: c.key }));
  const geo: Record<string, unknown> = t.cities.length ? { ...(cities.length ? { cities } : {}), ...(regions.length ? { regions } : {}) } : { countries: ["IN"] };
  const spec: Record<string, unknown> = {
    geo_locations: geo,
    age_min: Math.max(18, Math.min(65, t.ageMin || 21)),
    age_max: Math.max(18, Math.min(65, t.ageMax || 60)),
    ...(t.gender === "men" ? { genders: [1] } : t.gender === "women" ? { genders: [2] } : {}),
    ...(t.interests.length ? { flexible_spec: [{ interests: t.interests.map((i) => ({ id: i.id, name: i.name })) }] } : {}),
    publisher_platforms: ["facebook", "instagram"],
    // Meta refuses a new ad set without the Advantage+ audience flag ("Invalid parameter", 21 Oct 2026). 0 = exactly the
    // audience the owner chose; their city and age range stay as they set them.
    targeting_automation: { advantage_audience: 0 },
    ...(placements === "feeds" ? { facebook_positions: ["feed"], instagram_positions: ["stream"] } : placements === "stories" ? { facebook_positions: ["story"], instagram_positions: ["story", "reels"] } : {}),
  };
  return spec;
}

/** Meta's own estimate of how many people the ad can reach a day at this budget (null when it will not say). */
export async function estimate(fb: AccountRow, acct: string, t: AdTargeting, placements: AdSpec["placements"]) {
  const ut = fb.user_token; if (!ut) return null;
  try {
    const r = await graph<{ data: { estimate_dau?: number; estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number; estimate_ready?: boolean }[] }>(`${acct}/delivery_estimate`, { access_token: ut, optimization_goal: "LINK_CLICKS", targeting_spec: JSON.stringify(targetingSpec(t, placements)) });
    const d = r.data?.[0]; if (!d) return null;
    return { daily: d.estimate_dau ?? 0, monthlyLow: d.estimate_mau_lower_bound ?? 0, monthlyHigh: d.estimate_mau_upper_bound ?? 0 };
  } catch { return null; }
}

/* ---------------- the words ---------------- */
export type AdCopy = { primaryText: string; headline: string; description: string };
const LANGS: Record<string, string> = { en: "simple Indian English", hi: "Hindi (Devanagari)", hinglish: "Hinglish (Hindi in Roman letters)" };
/** Primary text + headline for the ad, from the owner's own facts only. Falls back to plain lines built by code. */
export async function writeAdCopy(o: { business: string; trade: string; city: string; goal: AdGoal; product?: { name: string; price?: string; benefits?: string[]; offer?: string } | null; offer?: string; lang: string; phone: string; usps?: string[] }): Promise<AdCopy> {
  const key = process.env.GEMINI_API_KEY;
  const goalLine = o.goal === "whatsapp" ? "The button opens WhatsApp — end with an invitation to message." : o.goal === "calls" ? "The button calls the number — end with an invitation to call." : "The button opens the website — end with an invitation to see it.";
  const fallback = (): AdCopy => {
    const what = o.product?.name ? `${o.product.name}${o.product.price ? ` — ₹${o.product.price}` : ""}` : o.trade;
    const offer = o.offer || o.product?.offer || "";
    return {
      primaryText: [`${o.business}${o.city ? `, ${o.city}` : ""}: ${what}.`, ...(o.product?.benefits?.slice(0, 3).map((b) => `✓ ${b}`) ?? []), offer ? `🎁 ${offer}` : "", o.goal === "whatsapp" ? "WhatsApp par message karein 👇" : o.goal === "calls" ? `Call karein: ${o.phone}` : "Website dekhein 👇"].filter(Boolean).join("\n"),
      headline: S(o.product?.name || o.business, 40),
      description: S(offer || o.trade, 30),
    };
  };
  if (!key) return fallback();
  const prompt = `Write a Facebook/Instagram ad for a small Indian business in ${LANGS[o.lang] ?? LANGS.hinglish}. Return ONLY JSON {"primaryText":"...","headline":"...","description":"..."}.
Business: ${o.business} | Trade: ${o.trade} | City: ${o.city || "(not given)"} | Phone: ${o.phone}
${o.product ? `Product: ${o.product.name}${o.product.price ? ` (₹${o.product.price})` : ""}${o.product.offer ? ` — offer: ${o.product.offer}` : ""}; benefits: ${(o.product.benefits ?? []).slice(0, 5).join("; ")}` : ""}
${o.offer ? `Offer to feature: ${o.offer}` : ""}
${o.usps?.length ? `Why customers choose them: ${o.usps.join("; ")}` : ""}
Rules: primaryText 3-5 short lines (max 80 words), the first line is a hook a local customer stops for, one emoji per line at most, a clear benefit, the offer if any, then the call to action. ${goalLine} headline max 40 characters, description max 30 characters. Only the facts above — never invent prices, discounts, awards or numbers. No hype words like "best in the world".`;
  try {
    const r = await geminiComplete({ apiKey: key, contents: [{ role: "user", parts: [{ text: prompt }] }], maxOutputTokens: 500, temperature: 0.7 });
    const m = r.text.match(/\{[\s\S]*\}/); if (!m) return fallback();
    const j = JSON.parse(m[0]);
    const out: AdCopy = { primaryText: S(j.primaryText, 700).replace(/ \| /g, "\n"), headline: S(j.headline, 40), description: S(j.description, 30) };
    if (typeof j.primaryText === "string") out.primaryText = String(j.primaryText).trim().slice(0, 700);
    return out.primaryText && out.headline ? out : fallback();
  } catch { return fallback(); }
}

/* ---------------- creating the campaign ---------------- */
const CAMPAIGN_PREFIX = "Shubhora · ";
// A WhatsApp ad is a click-to-WhatsApp ad: Meta optimises for people who START a chat (owner, 22 Oct 2026: a traffic ad
// with a WhatsApp button gave 73 link clicks and 1 message). Calls and website stay traffic ads.
const objectiveFor = (goal: AdGoal): string => (goal === "whatsapp" ? "OUTCOME_ENGAGEMENT" : "OUTCOME_TRAFFIC");

/** The WhatsApp number linked to the Facebook Page (digits; "" when none is linked; null when it could not be read). Meta sends EVERY WhatsApp ad
 *  button of the Page to this number, whatever link the ad carries — so the ad must use it. */
export async function pageWhatsApp(fb: AccountRow): Promise<string | null> {
  if (!fb.page_id) return null;
  for (const token of [fb.access_token, fb.user_token]) {
    if (!token) continue;
    try {
      const r = await graph<{ whatsapp_number?: string }>(fb.page_id, { fields: "whatsapp_number", access_token: token });
      return String(r.whatsapp_number ?? "").replace(/\D/g, "");
    } catch { /* try the other token */ }
  }
  return null; // could not read it (permission / network): unknown, not "none"
}
const last10 = (s: string) => s.replace(/\D/g, "").slice(-10);

async function uploadVideo(acct: string, ut: string, fileUrl: string, name: string): Promise<string> {
  const v = await graphStep<{ id: string }>("video upload", `${acct}/advideos`, { file_url: fileUrl, name, access_token: ut }, "POST");
  // Meta processes the upload for a while; the creative needs it ready.
  for (let i = 0; i < 20; i++) {
    const s = await graph<{ status?: { video_status?: string } }>(`${v.id}`, { access_token: ut, fields: "status" });
    const st = s.status?.video_status ?? "";
    if (st === "ready") return v.id;
    if (st === "error") throw new Error("Facebook could not process the video.");
    await new Promise((r) => setTimeout(r, 3000));
  }
  return v.id; // usually ready by now; the ad review will say otherwise
}

/** Creates campaign → ad set → creative → ad on the owner's ad account. PAUSED unless startNow. */
export async function createAd(fb: AccountRow, spec: AdSpec): Promise<{ adAccount: string; campaignId: string; adsetId: string; adId: string; creativeId: string; managerUrl: string; status: string }> {
  const ut = fb.user_token; if (!ut) throw new Error("Reconnect Facebook to allow ads.");
  if (!fb.page_id) throw new Error("Connect a Facebook Page first.");
  const acct = await currentAdAccount(fb);
  const digits = spec.phone.replace(/\D/g, "").slice(-10);
  if (spec.goal === "whatsapp") {
    // Meta ignores the number in the link and opens the Page's linked WhatsApp. Refuse an ad that would send people elsewhere.
    const linked = await pageWhatsApp(fb);
    if (linked === "") throw new Error("WA_NOT_LINKED");
    if (linked && last10(linked) !== digits) throw new Error(`WA_NUMBER_MISMATCH:${last10(linked)}`);
  }
  const wa = "https://api.whatsapp.com/send";
  const link = spec.goal === "whatsapp" ? wa : spec.link || `${SITE_URL}`;
  const cta = spec.goal === "whatsapp" ? { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } } : spec.goal === "calls" ? { type: "CALL_NOW", value: { link: `tel:+91${digits}` } } : { type: "LEARN_MORE", value: { link } };
  const status = spec.startNow ? "ACTIVE" : "PAUSED";
  const name = `${CAMPAIGN_PREFIX}${S(spec.name, 60)}`;
  const start = new Date(Date.now() + 10 * 60_000), end = new Date(start.getTime() + spec.days * 86400_000);

  const camp = await graphStep<{ id: string }>("campaign", `${acct}/campaigns`, { name, objective: objectiveFor(spec.goal), status, special_ad_categories: "[]", is_adset_budget_sharing_enabled: "false", access_token: ut }, "POST");
  const adset = await graphStep<{ id: string }>("ad set", `${acct}/adsets`, {
    name: `${name} · audience`, campaign_id: camp.id, status,
    daily_budget: String(spec.dailyPaise), billing_event: "IMPRESSIONS", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    ...(spec.goal === "whatsapp"
      ? { optimization_goal: "CONVERSATIONS", destination_type: "WHATSAPP", promoted_object: JSON.stringify({ page_id: fb.page_id }) }
      : { optimization_goal: "LINK_CLICKS" }),
    start_time: start.toISOString(), end_time: end.toISOString(),
    targeting: JSON.stringify(targetingSpec(spec.targeting, spec.placements)), access_token: ut,
  }, "POST");

  let creativeId: string;
  const message = S(spec.primaryText, 1500).replace(/ {2,}/g, " ");
  try {
  if (spec.creative.kind === "video") {
    const videoId = await uploadVideo(acct, ut, spec.creative.url, name);
    const thumb = spec.creative.thumbUrl || `${SITE_URL}/og-shubhora.jpg`;
    creativeId = (await graphStep<{ id: string }>("video creative", `${acct}/adcreatives`, { name: `${name} · creative`, object_story_spec: JSON.stringify({ page_id: fb.page_id, video_data: { video_id: videoId, image_url: thumb, message, title: S(spec.headline, 40), link_description: S(spec.description, 30), call_to_action: cta } }), access_token: ut }, "POST")).id;
  } else {
    const hash = await uploadAdImage(acct, ut, spec.creative.url);
    creativeId = (await graphStep<{ id: string }>("creative", `${acct}/adcreatives`, { name: `${name} · creative`, object_story_spec: JSON.stringify({ page_id: fb.page_id, link_data: { image_hash: hash, link, message, name: S(spec.headline, 40), description: S(spec.description, 30), call_to_action: cta } }), access_token: ut }, "POST")).id;
  }
  const ad = await graphStep<{ id: string }>("ad", `${acct}/ads`, { name, adset_id: adset.id, creative: JSON.stringify({ creative_id: creativeId }), status, access_token: ut }, "POST");
  return { adAccount: acct, campaignId: camp.id, adsetId: adset.id, adId: ad.id, creativeId, managerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acct.replace("act_", "")}`, status };
  } catch (e) { await discardCampaign(ut, camp.id); throw e; }
}

/** Start / pause a whole campaign. A campaign saved as "do not start" has its ad set and ad PAUSED too, and Meta does
 *  not switch those on when the campaign goes ACTIVE (Ads Manager then shows "Ad set off" and nothing runs), so the
 *  ad set and the ad get the same status. Pausing only the campaign is enough to stop delivery, but we keep all three
 *  in step so the owner sees one clear state. */
export async function setCampaignStatus(fb: AccountRow, campaignId: string, status: "ACTIVE" | "PAUSED") {
  const ut = fb.user_token; if (!ut) throw new Error("Reconnect Facebook to allow ads.");
  type Kid = { id: string; status?: string };
  const kids = async (): Promise<Kid[]> => {
    const [sets, ads] = await Promise.all([
      graphStep<{ data: Kid[] }>("ad sets", `${campaignId}/adsets`, { access_token: ut, fields: "id,status", limit: "50" }),
      graphStep<{ data: Kid[] }>("ads", `${campaignId}/ads`, { access_token: ut, fields: "id,status", limit: "50" }),
    ]);
    // a deleted / archived ad set or ad cannot change state (Meta refuses it), and one already in that state needs no call
    return [...(sets.data ?? []), ...(ads.data ?? [])].filter((x) => x.status !== "DELETED" && x.status !== "ARCHIVED" && x.status !== status);
  };
  if (status === "PAUSED") {
    // Pausing the campaign alone stops all spending, so it goes first and its failure is the only fatal one; the ad sets
    // and ads follow on a best-effort basis (a failure there leaves them ACTIVE under a PAUSED campaign: nothing runs).
    await graphStep("campaign", `${campaignId}`, { status, access_token: ut }, "POST");
    const list = await kids().catch(() => [] as Kid[]);
    await Promise.allSettled(list.map((x) => graph(`${x.id}`, { status, access_token: ut }, "POST")));
    return;
  }
  // Starting: the ad sets and ads first, the campaign last, and any failure stops before the campaign goes ACTIVE, so the
  // owner never sees "Running" while Meta still has the ad set or the ad off (or the opposite: money spent unasked).
  const list = await kids();
  const res = await Promise.allSettled(list.map((x) => graph(`${x.id}`, { status, access_token: ut }, "POST")));
  const bad = res.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (bad) throw bad.reason instanceof Error ? bad.reason : new Error(String(bad.reason));
  await graphStep("campaign", `${campaignId}`, { status, access_token: ut }, "POST");
}

export type CampaignRow = { id: string; user_id: string; ad_account: string; campaign_id: string; adset_id: string | null; ad_id: string | null; name: string; goal: AdGoal; creative_url: string | null; creative_kind: string | null; primary_text: string | null; headline: string | null; daily_paise: number; days: number; status: string; created_at: string };
export type CampaignLive = { campaign_id: string; status: string; effective_status: string; spend: number; impressions: number; reach: number; clicks: number; results: number; resultLabel: string; chats?: number; linkClicks?: number; start?: string; stop?: string };

/** Live numbers for the owner's campaigns (spend, people reached, clicks, results). */
export async function liveCampaigns(fb: AccountRow, acct: string, ids: string[]): Promise<Record<string, CampaignLive>> {
  const ut = fb.user_token; const out: Record<string, CampaignLive> = {};
  if (!ut || !ids.length) return out;
  const r = await graph<{ data: { id: string; status: string; effective_status: string; start_time?: string; stop_time?: string; insights?: { data: { spend: string; impressions: string; reach: string; clicks: string; actions?: { action_type: string; value: string }[] }[] } }[] }>(`${acct}/campaigns`, {
    access_token: ut, limit: "50",
    fields: "id,status,effective_status,start_time,stop_time,insights.date_preset(maximum){spend,impressions,reach,clicks,actions}",
    filtering: JSON.stringify([{ field: "id", operator: "IN", value: ids }]),
  });
  // The ad's own effective status is the truth about delivery: a campaign can be ACTIVE while its ad set or ad is
  // still PAUSED (Ads Manager: "Ad set off"), and the ad is also where "in review" / "disapproved" show up.
  const adState: Record<string, string> = {};
  try {
    const a = await graph<{ data: { campaign_id: string; effective_status: string }[] }>(`${acct}/ads`, { access_token: ut, limit: "100", fields: "campaign_id,effective_status", filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: ids }]) });
    for (const x of a.data ?? []) if (!adState[x.campaign_id] || x.effective_status === "ACTIVE") adState[x.campaign_id] = x.effective_status;
  } catch { /* the campaign status is still shown */ }
  for (const c of r.data ?? []) {
    const i = c.insights?.data?.[0];
    const act = (t: string) => Number(i?.actions?.find((a) => a.action_type === t)?.value ?? 0);
    const chats = act("onsite_conversion.messaging_conversation_started_7d");
    const results = chats || act("link_click") || Number(i?.clicks ?? 0);
    const eff = c.effective_status === "ACTIVE" && adState[c.id] && adState[c.id] !== "ACTIVE" ? adState[c.id] : c.effective_status;
    out[c.id] = { campaign_id: c.id, status: c.status, effective_status: eff, spend: Number(i?.spend ?? 0), impressions: Number(i?.impressions ?? 0), reach: Number(i?.reach ?? 0), clicks: Number(i?.clicks ?? 0), results, resultLabel: chats ? "chats" : "clicks", chats, linkClicks: act("link_click"), start: c.start_time, stop: c.stop_time };
  }
  return out;
}

/** Our own record of a campaign (the app's list works even when Facebook is slow). */
export async function saveCampaign(row: Omit<CampaignRow, "id" | "created_at"> & { targeting?: unknown; creative_id?: string }) {
  const r = await restAsService<CampaignRow[]>("ad_campaigns", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  return r.data?.[0] ?? null;
}
export async function myCampaigns(userId: string): Promise<CampaignRow[]> {
  const r = await restAsService<CampaignRow[]>(`ad_campaigns?user_id=eq.${userId}&order=created_at.desc&limit=40&select=*`);
  return r.data ?? [];
}
