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
/** What Google says about the connected location that we keep: its "write a review" box (metadata.newReviewUri, else built from
 *  the place id) and its Maps place id (the weekly profile check reads the public profile by it). Kept in insights so Google is asked
 *  once; a location switch clears insights, so they are read again. Empty when Google is not connected or does not say. */
async function locationMeta(userId: string): Promise<{ review_url: string; place_id: string }> {
  const g = await googleRow(userId);
  if (!g?.refresh_token || !g.location_name || g.status !== "ok") return { review_url: "", place_id: "" };
  const kept = (g.insights ?? {}) as { review_url?: unknown; place_id?: unknown };
  if (typeof kept.review_url === "string" && kept.review_url && typeof kept.place_id === "string" && kept.place_id) return { review_url: kept.review_url, place_id: kept.place_id };
  try {
    const loc = g.location_name.replace(/^accounts\/[^/]+\//, "");
    const m = await gget<{ metadata?: { newReviewUri?: string; placeId?: string } }>(`${INFO}/${loc}?readMask=metadata`, await googleToken(g));
    const place_id = m.metadata?.placeId ?? "";
    const review_url = m.metadata?.newReviewUri || (place_id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place_id)}` : "");
    if (review_url || place_id) await patchRow(userId, { insights: { ...(g.insights ?? {}), review_url, place_id } });
    return { review_url, place_id };
  } catch (e) { console.error("[google] location meta", e instanceof Error ? e.message : e); return { review_url: "", place_id: "" }; }
}
export const reviewUrlFor = async (userId: string) => (await locationMeta(userId)).review_url;
export const placeIdFor = async (userId: string) => (await locationMeta(userId)).place_id;
/* ---- The profile itself (owner, 26 Nov 2026: "SaaS hai, sab kuch app se hona chahiye") ----
 * Read and change what a shop owner keeps up to date: category, description, phone, website, opening hours, service options.
 * The name and address are shown but not changed here: Google asks a business to verify again when they change. */
export type GTime = { hours?: number; minutes?: number };
export type GPeriod = { openDay: string; openTime?: GTime; closeDay: string; closeTime?: GTime };
export type GProfile = {
  title: string; address: string;
  primaryCategory: { name: string; displayName: string } | null;
  additionalCategories: { name: string; displayName: string }[];
  description: string; phone: string; additionalPhones: string[]; website: string;
  periods: GPeriod[]; pendingEdits: boolean;
  special: GSpecial[];
};
export type GDate = { year: number; month: number; day: number };
/** A holiday or a one-off day: closed, or open at other times. */
export type GSpecial = { startDate: GDate; endDate?: GDate; closed?: boolean; openTime?: GTime; closeTime?: GTime };
const locPath = (locationName: string) => locationName.replace(/^accounts\/[^/]+\//, "");
const PROFILE_MASK = "title,storefrontAddress,categories,profile,phoneNumbers,websiteUri,regularHours,specialHours,metadata";

export async function getProfile(token: string, locationName: string): Promise<GProfile> {
  type L = { title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
    categories?: { primaryCategory?: { name: string; displayName?: string }; additionalCategories?: { name: string; displayName?: string }[] };
    profile?: { description?: string }; phoneNumbers?: { primaryPhone?: string; additionalPhones?: string[] }; websiteUri?: string;
    regularHours?: { periods?: GPeriod[] }; specialHours?: { specialHourPeriods?: GSpecial[] }; metadata?: { hasPendingEdits?: boolean } };
  const l = await gget<L>(`${INFO}/${locPath(locationName)}?readMask=${PROFILE_MASK}`, token);
  const a = l.storefrontAddress;
  const cat = (c?: { name: string; displayName?: string }) => (c ? { name: c.name, displayName: c.displayName ?? c.name.replace(/^categories\/gcid:/, "").replace(/_/g, " ") } : null);
  return {
    title: l.title ?? "", address: a ? [...(a.addressLines ?? []), a.locality, a.administrativeArea, a.postalCode].filter(Boolean).join(", ") : "",
    primaryCategory: cat(l.categories?.primaryCategory), additionalCategories: (l.categories?.additionalCategories ?? []).map((c) => cat(c)!),
    description: l.profile?.description ?? "", phone: l.phoneNumbers?.primaryPhone ?? "", additionalPhones: l.phoneNumbers?.additionalPhones ?? [],
    website: l.websiteUri ?? "", periods: l.regularHours?.periods ?? [], pendingEdits: !!l.metadata?.hasPendingEdits,
    special: l.specialHours?.specialHourPeriods ?? [],
  };
}

/** Google's category list, searched by name ("water", "jewel"). */
export async function searchCategories(token: string, q: string, lang: "en" | "hi" = "en"): Promise<{ name: string; displayName: string }[]> {
  const f = encodeURIComponent(`displayName=${q.replace(/["\\]/g, "").slice(0, 40)}`);
  const r = await gget<{ categories?: { name: string; displayName: string }[] }>(`${INFO}/categories?regionCode=IN&languageCode=${lang}&view=BASIC&pageSize=100&filter=${f}`, token);
  return (r.categories ?? []).map((c) => ({ name: c.name, displayName: c.displayName }));
}

export type ProfilePatch = {
  description?: string; phone?: string; website?: string; periods?: GPeriod[]; special?: GSpecial[];
  primaryCategory?: string; additionalCategories?: string[];
};
/** Send only what changed; Google may hold an edit for review before it shows (metadata.hasPendingEdits). */
export async function updateProfile(token: string, locationName: string, p: ProfilePatch, keep: GProfile): Promise<void> {
  const body: Record<string, unknown> = {}; const mask: string[] = [];
  if (p.description !== undefined) { body.profile = { description: p.description.slice(0, 750) }; mask.push("profile.description"); }
  if (p.phone !== undefined) { body.phoneNumbers = { primaryPhone: p.phone, additionalPhones: keep.additionalPhones }; mask.push("phoneNumbers"); }
  if (p.website !== undefined) { body.websiteUri = p.website; mask.push("websiteUri"); }
  if (p.periods !== undefined) { body.regularHours = { periods: p.periods }; mask.push("regularHours"); }
  if (p.special !== undefined) { body.specialHours = { specialHourPeriods: p.special }; mask.push("specialHours"); }
  if (p.primaryCategory !== undefined || p.additionalCategories !== undefined) {
    const primary = p.primaryCategory ?? keep.primaryCategory?.name;
    if (!primary) throw new Error("Pick the main category first.");
    const extra = (p.additionalCategories ?? keep.additionalCategories.map((c) => c.name)).filter((n) => n && n !== primary).slice(0, 9);
    body.categories = { primaryCategory: { name: primary }, additionalCategories: extra.map((name) => ({ name })) };
    mask.push("categories");
  }
  if (!mask.length) return;
  await gsend(`${INFO}/${locPath(locationName)}?updateMask=${mask.join(",")}`, token, "PATCH", body);
}

/* Service options and other yes/no facts Google asks per category ("Delivery", "Accepts UPI", "Wheelchair-accessible entrance"). Only the
 * yes/no ones are offered here — they are most of them; the rest stay on business.google.com. */
export type GAttrMeta = { name: string; displayName: string; group: string };
export async function attributeOptions(token: string, locationName: string): Promise<{ meta: GAttrMeta[]; values: Record<string, boolean> }> {
  const loc = locPath(locationName);
  type M = { parent: string; valueType: string; displayName?: string; groupDisplayName?: string; deprecated?: boolean };
  const [m, v] = await Promise.all([
    gget<{ attributeMetadata?: M[] }>(`${INFO}/attributes?parent=${loc}&languageCode=en&regionCode=IN&pageSize=200`, token),
    gget<{ attributes?: { name: string; valueType?: string; values?: unknown[] }[] }>(`${INFO}/${loc}/attributes`, token).catch(() => ({ attributes: [] })),
  ]);
  const meta = (m.attributeMetadata ?? []).filter((x) => x.valueType === "BOOL" && !x.deprecated && x.displayName)
    .map((x) => ({ name: x.parent, displayName: x.displayName!, group: x.groupDisplayName ?? "" }));
  const values: Record<string, boolean> = {};
  for (const a of v.attributes ?? []) if (a.valueType === "BOOL" && typeof a.values?.[0] === "boolean") values[a.name] = a.values[0] as boolean;
  return { meta, values };
}
export async function updateAttributes(token: string, locationName: string, changes: Record<string, boolean>): Promise<void> {
  const names = Object.keys(changes).filter((n) => /^attributes\/[\w.-]+$/.test(n)).slice(0, 60);
  if (!names.length) return;
  const loc = locPath(locationName);
  await gsend(`${INFO}/${loc}/attributes?attributeMask=${names.join(",")}`, token, "PATCH",
    { name: `${loc}/attributes`, attributes: names.map((name) => ({ name, valueType: "BOOL", values: [changes[name]] })) });
}

/** Photos on the profile: how many there are, and adding one from a public address (Google copies it). */
export async function profilePhotoCount(token: string, locationName: string): Promise<number> {
  const r = await gget<{ totalMediaItemCount?: number; mediaItems?: unknown[] }>(`${V4}/${locationName}/media?pageSize=1`, token);
  return r.totalMediaItemCount ?? r.mediaItems?.length ?? 0;
}
export const addProfilePhoto = (token: string, locationName: string, sourceUrl: string) =>
  gsend(`${V4}/${locationName}/media`, token, "POST", { mediaFormat: "PHOTO", locationAssociation: { category: "ADDITIONAL" }, sourceUrl });

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
/** Of the newest reviews Google gave us (50 at most): how many the owner has answered. Counted, never guessed. */
export type ReplyCount = { of: number; answered: number };
export const replyCount = (reviews: GReview[]): ReplyCount => ({ of: reviews.length, answered: reviews.filter((r) => !!r.reviewReply?.comment).length });
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
