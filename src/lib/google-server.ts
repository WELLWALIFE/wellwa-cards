// Google Business Profile: OAuth connect, locations, reviews (+ replies),
// local posts, insights. Credentials resolve in this order:
//   1. the user's own OAuth client (google_accounts.client_id/secret, "advanced"),
//   2. the platform client set by the super admin (platform_secrets),
//   3. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env.
// Google gates the Business Profile APIs behind an access request per Cloud
// project, so a client without approval fails at the locations call with a
// clear "API not enabled / access not granted" message.
import { restAsService } from "@/lib/poster-server";
import { SITE_URL } from "@/lib/social-server";

export const GOOGLE_REDIRECT = `${SITE_URL}/api/google/callback`;
const SCOPE = "https://www.googleapis.com/auth/business.manage";
const V4 = "https://mybusiness.googleapis.com/v4";
const ACCT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const PERF = "https://businessprofileperformance.googleapis.com/v1";

export type Creds = { client_id: string; client_secret: string; source: "user" | "platform" | "env" | "none" };
const one = <T,>(r: { data: T[] | null }): T | null => (Array.isArray(r.data) ? r.data[0] ?? null : null);

export async function platformCreds(): Promise<Creds> {
  const p = one(await restAsService<{ google_client_id: string; google_client_secret: string }[]>("platform_secrets?id=eq.1&select=google_client_id,google_client_secret"));
  if (p?.google_client_id && p.google_client_secret) return { client_id: p.google_client_id, client_secret: p.google_client_secret, source: "platform" };
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, source: "env" };
  return { client_id: "", client_secret: "", source: "none" };
}
export async function googleCreds(userId?: string): Promise<Creds> {
  if (userId) {
    const u = one(await restAsService<{ client_id: string; client_secret: string }[]>(`google_accounts?user_id=eq.${userId}&select=client_id,client_secret`));
    if (u?.client_id && u.client_secret) return { client_id: u.client_id, client_secret: u.client_secret, source: "user" };
  }
  return platformCreds();
}
export const googleConfigured = async (userId?: string) => (await googleCreds(userId)).source !== "none";

export function googleAuthUrl(c: Creds, state: string): string {
  const q = new URLSearchParams({ client_id: c.client_id, redirect_uri: GOOGLE_REDIRECT, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type Tokens = { access_token: string; refresh_token?: string; expires_in: number };
async function tokenPost(c: Creds, params: Record<string, string>): Promise<Tokens> {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, ...params }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || `Google token ${r.status}`);
  return j as Tokens;
}
export const exchangeCode = (c: Creds, code: string) => tokenPost(c, { code, grant_type: "authorization_code", redirect_uri: GOOGLE_REDIRECT });

export type GLocation = { name: string; title: string; address: string; phone: string; maps: string };
export type GoogleRow = {
  user_id: string; account_name: string; location_name: string; location_title: string; access_token: string; refresh_token: string; token_expires_at: string | null;
  status: "ok" | "reconnect"; auto_post: boolean; auto_reply: boolean; last_auto_post: string | null; connected_at: string;
  client_id: string; client_secret: string; locations: GLocation[]; address: string; phone: string; maps_url: string; rating: number | null; review_count: number; insights: Record<string, unknown>; insights_at: string | null; last_error: string;
};
export async function googleRow(userId: string): Promise<GoogleRow | null> {
  return one(await restAsService<GoogleRow[]>(`google_accounts?user_id=eq.${userId}&select=*`)); // error object (table missing) → null
}
export const patchRow = (userId: string, patch: Record<string, unknown>) => restAsService(`google_accounts?user_id=eq.${userId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });

/** A valid access token for this row, refreshing (and persisting) when it is about to expire. */
export async function googleToken(row: GoogleRow): Promise<string> {
  const exp = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && exp - Date.now() > 60_000) return row.access_token;
  if (!row.refresh_token) throw new Error("Google needs to be reconnected.");
  try {
    const t = await tokenPost(await googleCreds(row.user_id), { refresh_token: row.refresh_token, grant_type: "refresh_token" });
    await patchRow(row.user_id, { access_token: t.access_token, token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), status: "ok" });
    return t.access_token;
  } catch (e) { await patchRow(row.user_id, { status: "reconnect", last_error: (e as Error).message.slice(0, 200) }); throw e; }
}

export function friendlyGoogleError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if (/has not been used in project|is disabled|not enabled/i.test(m)) return "Google API not enabled for this OAuth client — enable the Business Profile APIs in Google Cloud (see setup guide).";
  if (/PERMISSION_DENIED|does not have access|not been approved|quota/i.test(m)) return "Google has not approved Business Profile API access for this project yet (apply via the access form — see setup guide).";
  if (/invalid_grant/i.test(m)) return "Google session expired — reconnect.";
  if (/No Google Business account/i.test(m)) return "This Google login has no Business Profile. Create one at business.google.com first, then connect with that Google account.";
  return m.slice(0, 200);
}

async function gget<T>(url: string, token: string): Promise<T> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Google ${r.status}`);
  return j as T;
}
async function gsend<T>(url: string, token: string, method: "POST" | "PUT" | "DELETE" | "PATCH", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Google ${r.status}`);
  return j as T;
}

/** Every location across the user's accounts (v4 names "accounts/x/locations/y"). */
export async function listLocations(token: string): Promise<{ account: string; locations: GLocation[] }> {
  const acc = await gget<{ accounts?: { name: string }[] }>(`${ACCT}/accounts`, token);
  const accounts = (acc.accounts ?? []).map((a) => a.name);
  if (!accounts.length) throw new Error("No Google Business account on this login.");
  const locations: GLocation[] = [];
  for (const account of accounts.slice(0, 5)) {
    const loc = await gget<{ locations?: { name: string; title: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string }; phoneNumbers?: { primaryPhone?: string }; metadata?: { mapsUri?: string } }[] }>(`${INFO}/${account}/locations?readMask=name,title,storefrontAddress,phoneNumbers,metadata&pageSize=50`, token).catch(() => ({ locations: [] }));
    for (const l of loc.locations ?? []) locations.push({ name: `${account}/${l.name}`, title: l.title, address: [...(l.storefrontAddress?.addressLines ?? []), l.storefrontAddress?.locality, l.storefrontAddress?.administrativeArea].filter(Boolean).join(", "), phone: l.phoneNumbers?.primaryPhone ?? "", maps: l.metadata?.mapsUri ?? "" });
  }
  if (!locations.length) throw new Error("No business location found on this Google account.");
  return { account: accounts[0], locations };
}

export type GReview = { name: string; reviewId: string; reviewer?: { displayName?: string; profilePhotoUrl?: string }; starRating?: string; comment?: string; createTime: string; updateTime?: string; reviewReply?: { comment: string; updateTime?: string } };
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const starsOf = (s?: string) => (s && STARS[s]) || null;

export async function listReviews(token: string, locationName: string): Promise<{ reviews: GReview[]; averageRating: number | null; totalReviewCount: number }> {
  const r = await gget<{ reviews?: GReview[]; averageRating?: number; totalReviewCount?: number }>(`${V4}/${locationName}/reviews?pageSize=50&orderBy=updateTime%20desc`, token);
  return { reviews: r.reviews ?? [], averageRating: r.averageRating ?? null, totalReviewCount: r.totalReviewCount ?? 0 };
}
export const replyReview = (token: string, reviewName: string, comment: string) => gsend(`${V4}/${reviewName}/reply`, token, "PUT", { comment: comment.slice(0, 4000) });
export const deleteReply = (token: string, reviewName: string) => gsend(`${V4}/${reviewName}/reply`, token, "DELETE");

export async function createLocalPost(token: string, locationName: string, o: { summary: string; imageUrl?: string; phone?: string; lang?: string; cta?: "CALL" | "LEARN_MORE" | "BOOK" | "ORDER"; url?: string }) {
  const body: Record<string, unknown> = { languageCode: o.lang === "hi" ? "hi" : "en", topicType: "STANDARD", summary: o.summary.slice(0, 1500) };
  if (o.imageUrl) body.media = [{ mediaFormat: "PHOTO", sourceUrl: o.imageUrl }];
  if (o.cta === "CALL" || (!o.cta && o.phone)) body.callToAction = { actionType: "CALL" };
  else if (o.cta && o.url) body.callToAction = { actionType: o.cta, url: o.url };
  return gsend<{ name: string }>(`${V4}/${locationName}/localPosts`, token, "POST", body);
}
export async function listLocalPosts(token: string, locationName: string) {
  const r = await gget<{ localPosts?: { name: string; summary?: string; createTime: string; state?: string; media?: { googleUrl?: string }[] }[] }>(`${V4}/${locationName}/localPosts?pageSize=10`, token);
  return r.localPosts ?? [];
}

/** 28-day performance: impressions, website clicks, calls, direction requests. */
export type Insights = { days: number; impressions: number; website: number; calls: number; directions: number; series: { day: string; impressions: number }[] };
export async function fetchInsights(token: string, locationName: string): Promise<Insights> {
  const loc = locationName.replace(/^accounts\/[^/]+\//, ""); // performance API wants "locations/123"
  const end = new Date(Date.now() - 2 * 86400000), start = new Date(end.getTime() - 27 * 86400000);
  const range = (k: "start" | "end", x: Date) => `dailyRange.${k}Date.year=${x.getFullYear()}&dailyRange.${k}Date.month=${x.getMonth() + 1}&dailyRange.${k}Date.day=${x.getDate()}`;
  type TS = { timeSeries?: { datedValues?: { date: { year: number; month: number; day: number }; value?: string }[] } };
  const metric = async (m: string): Promise<{ total: number; series: { day: string; v: number }[] }> => {
    const j: TS = await gget<TS>(`${PERF}/${loc}:getDailyMetricsTimeSeries?dailyMetric=${m}&${range("start", start)}&${range("end", end)}`, token).catch(() => ({} as TS));
    const series = (j.timeSeries?.datedValues ?? []).map((x) => ({ day: `${x.date.year}-${String(x.date.month).padStart(2, "0")}-${String(x.date.day).padStart(2, "0")}`, v: Number(x.value ?? 0) }));
    return { total: series.reduce((n, x) => n + x.v, 0), series };
  };
  const [maps, search, mapsD, searchD, web, calls, dirs] = await Promise.all(["BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "WEBSITE_CLICKS", "CALL_CLICKS", "BUSINESS_DIRECTION_REQUESTS"].map(metric));
  const byDay = new Map<string, number>();
  for (const s of [maps, search, mapsD, searchD]) for (const x of s.series) byDay.set(x.day, (byDay.get(x.day) ?? 0) + x.v);
  return { days: 28, impressions: maps.total + search.total + mapsD.total + searchD.total, website: web.total, calls: calls.total, directions: dirs.total, series: [...byDay.entries()].sort().map(([day, impressions]) => ({ day, impressions })) };
}
