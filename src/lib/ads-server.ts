import "server-only";
// Facebook / Instagram ads from inside the app (owner's call, 30 Sep 2026): one wizard — picture or video, goal,
// audience, budget, words — creates a real campaign on the owner's own ad account through the Marketing API.
// Money rules: every campaign is created PAUSED unless the owner explicitly taps "Start now"; the daily budget and
// the end date are always set, so nothing can run for ever; Start / Pause work from the app and Ads Manager alike.
// Needs the Facebook login to carry ads_management + ads_read (SCOPES in social-server.ts).
import { graph, listAccounts, type AccountRow } from "@/lib/social-server";
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
const objectiveFor = (): string => "OUTCOME_TRAFFIC";

async function uploadVideo(acct: string, ut: string, fileUrl: string, name: string): Promise<string> {
  const v = await graph<{ id: string }>(`${acct}/advideos`, { file_url: fileUrl, name, access_token: ut }, "POST");
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
  const wa = `https://wa.me/91${digits}?text=${encodeURIComponent("Hi, I saw your ad")}`;
  const link = spec.goal === "whatsapp" ? wa : spec.link || `${SITE_URL}`;
  const cta = spec.goal === "whatsapp" ? { type: "WHATSAPP_MESSAGE", value: { link: wa } } : spec.goal === "calls" ? { type: "CALL_NOW", value: { link: `tel:+91${digits}` } } : { type: "LEARN_MORE", value: { link } };
  const status = spec.startNow ? "ACTIVE" : "PAUSED";
  const name = `${CAMPAIGN_PREFIX}${S(spec.name, 60)}`;
  const start = new Date(Date.now() + 10 * 60_000), end = new Date(start.getTime() + spec.days * 86400_000);

  const camp = await graph<{ id: string }>(`${acct}/campaigns`, { name, objective: objectiveFor(), status, special_ad_categories: "[]", access_token: ut }, "POST");
  const adset = await graph<{ id: string }>(`${acct}/adsets`, {
    name: `${name} · audience`, campaign_id: camp.id, status,
    daily_budget: String(spec.dailyPaise), billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    start_time: start.toISOString(), end_time: end.toISOString(),
    targeting: JSON.stringify(targetingSpec(spec.targeting, spec.placements)), access_token: ut,
  }, "POST");

  let creativeId: string;
  const message = S(spec.primaryText, 1500).replace(/ {2,}/g, " ");
  if (spec.creative.kind === "video") {
    const videoId = await uploadVideo(acct, ut, spec.creative.url, name);
    const thumb = spec.creative.thumbUrl || `${SITE_URL}/og-shubhora.jpg`;
    creativeId = (await graph<{ id: string }>(`${acct}/adcreatives`, { name: `${name} · creative`, object_story_spec: JSON.stringify({ page_id: fb.page_id, video_data: { video_id: videoId, image_url: thumb, message, title: S(spec.headline, 40), link_description: S(spec.description, 30), call_to_action: cta } }), access_token: ut }, "POST")).id;
  } else {
    const img = await graph<{ images: Record<string, { hash: string }> }>(`${acct}/adimages`, { url: spec.creative.url, access_token: ut }, "POST");
    const hash = Object.values(img.images ?? {})[0]?.hash; if (!hash) throw new Error("Facebook could not read the picture.");
    creativeId = (await graph<{ id: string }>(`${acct}/adcreatives`, { name: `${name} · creative`, object_story_spec: JSON.stringify({ page_id: fb.page_id, link_data: { image_hash: hash, link, message, name: S(spec.headline, 40), description: S(spec.description, 30), call_to_action: cta } }), access_token: ut }, "POST")).id;
  }
  const ad = await graph<{ id: string }>(`${acct}/ads`, { name, adset_id: adset.id, creative: JSON.stringify({ creative_id: creativeId }), status, access_token: ut }, "POST");
  return { adAccount: acct, campaignId: camp.id, adsetId: adset.id, adId: ad.id, creativeId, managerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acct.replace("act_", "")}`, status };
}

/** Start / pause a whole campaign (ad set and ad follow the campaign's status in delivery). */
export async function setCampaignStatus(fb: AccountRow, campaignId: string, status: "ACTIVE" | "PAUSED") {
  const ut = fb.user_token; if (!ut) throw new Error("Reconnect Facebook to allow ads.");
  await graph(`${campaignId}`, { status, access_token: ut }, "POST");
}

export type CampaignRow = { id: string; user_id: string; ad_account: string; campaign_id: string; adset_id: string | null; ad_id: string | null; name: string; goal: AdGoal; creative_url: string | null; creative_kind: string | null; primary_text: string | null; headline: string | null; daily_paise: number; days: number; status: string; created_at: string };
export type CampaignLive = { campaign_id: string; status: string; effective_status: string; spend: number; impressions: number; reach: number; clicks: number; results: number; resultLabel: string; start?: string; stop?: string };

/** Live numbers for the owner's campaigns (spend, people reached, clicks, results). */
export async function liveCampaigns(fb: AccountRow, acct: string, ids: string[]): Promise<Record<string, CampaignLive>> {
  const ut = fb.user_token; const out: Record<string, CampaignLive> = {};
  if (!ut || !ids.length) return out;
  const r = await graph<{ data: { id: string; status: string; effective_status: string; start_time?: string; stop_time?: string; insights?: { data: { spend: string; impressions: string; reach: string; clicks: string; actions?: { action_type: string; value: string }[] }[] } }[] }>(`${acct}/campaigns`, {
    access_token: ut, limit: "50",
    fields: "id,status,effective_status,start_time,stop_time,insights.date_preset(maximum){spend,impressions,reach,clicks,actions}",
    filtering: JSON.stringify([{ field: "id", operator: "IN", value: ids }]),
  });
  for (const c of r.data ?? []) {
    const i = c.insights?.data?.[0];
    const act = (t: string) => Number(i?.actions?.find((a) => a.action_type === t)?.value ?? 0);
    const results = act("link_click") || Number(i?.clicks ?? 0);
    out[c.id] = { campaign_id: c.id, status: c.status, effective_status: c.effective_status, spend: Number(i?.spend ?? 0), impressions: Number(i?.impressions ?? 0), reach: Number(i?.reach ?? 0), clicks: Number(i?.clicks ?? 0), results, resultLabel: "clicks", start: c.start_time, stop: c.stop_time };
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
