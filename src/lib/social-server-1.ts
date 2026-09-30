// Meta (Facebook Page + Instagram Business) connect & publish helpers.
//
// Flow: POST /api/social/connect (bearer) → signed state → Facebook OAuth
// dialog → GET /api/social/callback → long-lived user token → pages + their
// Instagram business accounts → rows in social_accounts (page tokens).
// Posting: FB  POST /{page}/photos {url, message}
//          IG  POST /{ig}/media {image_url, caption} → /{ig}/media_publish
import crypto from "node:crypto";
import { restAsService } from "@/lib/poster-server";

export const GRAPH = "https://graph.facebook.com/v21.0";
export const META_APP_ID = process.env.META_APP_ID ?? "";
export const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://shubhora.com").replace(/\/$/, "");
export const REDIRECT_URI = `${SITE_URL}/api/social/callback`;
export const SCOPES = [
  "pages_show_list", "pages_manage_posts", "pages_read_engagement",
  "instagram_basic", "instagram_content_publish",
  // business_management dropped for App Review (1 Oct 2026): nothing in the app calls a Business endpoint, and
  // Meta rejects it more than any other permission. Tokens already granted keep working without it.
  // Reviews inbox (2026-09-14): read Page reviews, reply to FB comments, read/reply IG comments.
  // With a Facebook-Login-for-Business config_id these must ALSO be added to the config in the Meta dashboard.
  "pages_read_user_content", "pages_manage_engagement", "instagram_manage_comments",
  // Ads from inside the app (30 Sep 2026): create / start / pause campaigns and read their spend on the owner's ad account.
  "ads_management", "ads_read",
];

export function metaConfigured() { return Boolean(META_APP_ID && META_APP_SECRET); }

const STATE_SECRET = META_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev";
function b64u(s: string | Buffer) { return Buffer.from(s).toString("base64url"); }

/** state = base64url(userId.exp.returnTo).sig — proves the callback belongs to this user. */
export function signState(userId: string, returnTo: string, provider = ""): string {
  const body = b64u(JSON.stringify({ u: userId, e: Date.now() + 15 * 60_000, r: returnTo, p: provider }));
  const sig = crypto.createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyState(state: string): { userId: string; returnTo: string; provider: string } | null {
  const [body, sig] = String(state ?? "").split(".");
  if (!body || !sig) return null;
  const want = crypto.createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const j = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!j?.u || !j?.e || j.e < Date.now()) return null;
    return { userId: String(j.u), returnTo: String(j.r || "/poster/social"), provider: String(j.p || "") };
  } catch { return null; }
}

export const META_LOGIN_CONFIG_ID = process.env.META_LOGIN_CONFIG_ID ?? "";
export function authDialogUrl(state: string): string {
  // "Facebook Login for Business" apps use a configuration (config_id) instead
  // of a scope list; plain Facebook Login apps still take scope.
  const q = new URLSearchParams({
    client_id: META_APP_ID, redirect_uri: REDIRECT_URI, state, response_type: "code",
    ...(META_LOGIN_CONFIG_ID ? { config_id: META_LOGIN_CONFIG_ID, override_default_response_type: "true" } : { scope: SCOPES.join(","), auth_type: "rerequest" }),
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`;
}

type G = Record<string, unknown>;
export async function graph<T = G>(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T> {
  const q = new URLSearchParams(params);
  const url = method === "GET" ? `${GRAPH}/${path}?${q}` : `${GRAPH}/${path}`;
  const r = await fetch(url, method === "GET" ? { cache: "no-store" } : { method: "POST", body: q, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as G & { error?: { message?: string; code?: number; type?: string } };
  if (!r.ok || j.error) {
    const e = j.error ?? {};
    const err = new Error(String(e.message ?? `Graph ${r.status}`)) as Error & { code?: number };
    err.code = Number(e.code ?? r.status);
    throw err;
  }
  return j as T;
}

export type ConnectedAccount = {
  provider: "facebook" | "instagram" | "whatsapp"; account_id: string; name: string; username: string;
  picture: string | null; page_id: string | null; access_token: string; user_token?: string;
  /** The Facebook user (app-scoped id) who connected it — what Meta's deauthorize / data-deletion callbacks send us. */
  meta_user_id?: string | null;
};

/** OAuth code → long-lived user token → all pages (+ IG business accounts). */
export async function accountsFromCode(code: string): Promise<ConnectedAccount[]> {
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: REDIRECT_URI, code,
  });
  const long = await graph<{ access_token: string }>("oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: short.access_token,
  });
  const pages = await graph<{ data: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string } }[] }>(
    "me/accounts", { access_token: long.access_token, fields: "id,name,access_token,picture{url},instagram_business_account", limit: "50" },
  );
  const meta_user_id = await graph<{ id: string }>("me", { access_token: long.access_token, fields: "id" }).then((m) => m.id).catch(() => null);
  const out: ConnectedAccount[] = [];
  for (const p of pages.data ?? []) {
    out.push({ provider: "facebook", account_id: p.id, name: p.name, username: "", picture: p.picture?.data?.url ?? null, page_id: p.id, access_token: p.access_token, user_token: long.access_token, meta_user_id });
    const igId = p.instagram_business_account?.id;
    if (igId) {
      const ig = await graph<{ id: string; username?: string; name?: string; profile_picture_url?: string }>(igId, { access_token: p.access_token, fields: "id,username,name,profile_picture_url" }).catch(() => null);
      out.push({ provider: "instagram", account_id: igId, name: ig?.name ?? ig?.username ?? "Instagram", username: ig?.username ?? "", picture: ig?.profile_picture_url ?? null, page_id: p.id, access_token: p.access_token, meta_user_id });
    }
  }
  return out;
}

/** Save OAuth results as candidates (is_active=false); a previously active
 *  account of the same provider stays active until the user picks another. */
export async function saveAccounts(userId: string, accounts: ConnectedAccount[]) {
  for (const a of accounts) {
    const row = { user_id: userId, ...a, status: "ok", connected_at: new Date().toISOString() };
    const r = await restAsService("social_accounts?on_conflict=user_id,provider,account_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(row),
    });
    // Before sql/2026-10-01-app-review.sql is run the column does not exist yet: save without it, connect still works.
    if (!r.ok && /meta_user_id/.test(r.text)) {
      const { meta_user_id: _drop, ...legacy } = row; void _drop;
      await restAsService("social_accounts?on_conflict=user_id,provider,account_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(legacy) });
    }
  }
}

// ---- Meta callbacks (App Review requires both) ---------------------------------------------------------------
// Meta POSTs `signed_request` = <base64url HMAC-SHA256>.<base64url JSON{ user_id, algorithm, issued_at }>, signed
// with the app secret, when a user removes the app (deauthorize) or asks Meta to delete their data (data deletion).

export function parseSignedRequest(sr: string): { user_id: string; issued_at?: number } | null {
  if (!META_APP_SECRET) return null;
  const [sig, payload] = sr.split(".", 2);
  if (!sig || !payload) return null;
  const want = crypto.createHmac("sha256", META_APP_SECRET).update(payload).digest();
  let got: Buffer;
  try { got = Buffer.from(sig, "base64url"); } catch { return null; }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const j = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user_id?: unknown; issued_at?: unknown; algorithm?: unknown };
    if (String(j.algorithm ?? "HMAC-SHA256").toUpperCase() !== "HMAC-SHA256") return null;
    if (typeof j.user_id !== "string" || !/^\d{1,32}$/.test(j.user_id)) return null;
    return { user_id: j.user_id, issued_at: typeof j.issued_at === "number" ? j.issued_at : undefined };
  } catch { return null; }
}

type MetaRow = { id: string; user_id: string };
async function rowsOfMetaUser(metaUserId: string): Promise<MetaRow[]> {
  const r = await restAsService<MetaRow[]>(`social_accounts?meta_user_id=eq.${encodeURIComponent(metaUserId)}&select=id,user_id`);
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

/** Deauthorize: the user removed Shubhora on Facebook, so every token from that login is dead. Mark the rows so the
 *  app shows "Reconnect" instead of failing silently at 4 AM; tokens are blanked, rows kept for the user to see. */
export async function deauthorizeMetaUser(metaUserId: string): Promise<number> {
  const rows = await rowsOfMetaUser(metaUserId);
  if (!rows.length) return 0;
  const ids = rows.map((x) => x.id).join(",");
  await restAsService(`social_accounts?id=in.(${ids})`, { method: "PATCH", body: JSON.stringify({ status: "reconnect", access_token: "", user_token: null, auto_post: false }) });
  return rows.length;
}

/** Data deletion: remove everything we hold that came from Meta for that Facebook user — the connected Page /
 *  Instagram rows (tokens, ids, names, pictures), the post log and the ad-campaign log tied to them. The user's own
 *  Shubhora account, posters and leads are theirs and stay; deleting those is the account-deletion flow. Returns a
 *  confirmation code Meta shows the user; /data-deletion?code=… reports the status. */
export async function deleteMetaUserData(metaUserId: string): Promise<{ code: string; removed: number }> {
  const rows = await rowsOfMetaUser(metaUserId);
  const code = `SH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  let removed = 0;
  if (rows.length) {
    const ids = rows.map((x) => x.id).join(",");
    const users = [...new Set(rows.map((x) => x.user_id))];
    await restAsService(`social_posts?account_id=in.(${ids})`, { method: "DELETE" });
    for (const u of users) await restAsService(`ad_campaigns?user_id=eq.${u}`, { method: "DELETE" }).catch(() => {});
    const d = await restAsService<MetaRow[]>(`social_accounts?id=in.(${ids})`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    removed = Array.isArray(d.data) ? d.data.length : rows.length;
  }
  await restAsService("data_deletion_requests", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ code, provider: "meta", external_id: metaUserId, user_ids: [...new Set(rows.map((x) => x.user_id))], removed, status: "done" }),
  }).catch(() => {});
  return { code, removed };
}

export type AccountRow = ConnectedAccount & { id: string; user_id: string; status: "ok" | "reconnect"; connected_at: string; is_active: boolean; auto_post: boolean; auto_post_profile: string | null; ad_account_id?: string | null; auto_reply?: boolean; plan_on?: boolean };

/** Boost: a PAUSED click-to-WhatsApp campaign from one poster image. Nothing is
 *  spent until the user switches it on in Ads Manager. Needs ads_management. */
export async function createPausedBoost(a: AccountRow, opts: { imageUrl: string; caption: string; phone: string; dailyPaise: number; days: number; name: string }) {
  const ut = a.user_token; if (!ut) throw new Error("Reconnect Facebook to allow ads.");
  let acct = a.ad_account_id;
  if (!acct) {
    const r = await graph<{ data: { id: string; name: string; account_status: number }[] }>("me/adaccounts", { access_token: ut, fields: "id,name,account_status", limit: "10" });
    acct = (r.data ?? []).find((x) => x.account_status === 1)?.id ?? r.data?.[0]?.id ?? null;
    if (!acct) throw new Error("No ad account found on this Facebook login.");
    await restAsService(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ ad_account_id: acct }) });
  }
  const start = new Date(Date.now() + 3600_000), end = new Date(start.getTime() + opts.days * 86400_000);
  const camp = await graph<{ id: string }>(`${acct}/campaigns`, { name: `Shubhora · ${opts.name}`, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: "[]", access_token: ut }, "POST");
  const adset = await graph<{ id: string }>(`${acct}/adsets`, {
    name: `Shubhora · ${opts.name} · set`, campaign_id: camp.id, status: "PAUSED", daily_budget: String(opts.dailyPaise), billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    start_time: start.toISOString(), end_time: end.toISOString(), targeting: JSON.stringify({ geo_locations: { countries: ["IN"] }, age_min: 21, age_max: 60, publisher_platforms: ["facebook", "instagram"] }), access_token: ut,
  }, "POST");
  const img = await graph<{ images: Record<string, { hash: string }> }>(`${acct}/adimages`, { url: opts.imageUrl, access_token: ut }, "POST");
  const hash = Object.values(img.images ?? {})[0]?.hash; if (!hash) throw new Error("Image upload failed");
  const wa = `https://wa.me/91${opts.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent("Hi, I saw your ad")}`;
  const creative = await graph<{ id: string }>(`${acct}/adcreatives`, { name: `Shubhora · ${opts.name} · creative`, object_story_spec: JSON.stringify({ page_id: a.page_id, link_data: { image_hash: hash, link: wa, message: opts.caption.slice(0, 500), call_to_action: { type: "WHATSAPP_MESSAGE", value: { link: wa } } } }), access_token: ut }, "POST");
  const ad = await graph<{ id: string }>(`${acct}/ads`, { name: `Shubhora · ${opts.name}`, adset_id: adset.id, creative: JSON.stringify({ creative_id: creative.id }), status: "PAUSED", access_token: ut }, "POST");
  return { campaignId: camp.id, adId: ad.id, adAccount: acct, managerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acct.replace("act_", "")}` };
}

/** Make one account THE account for its provider; drop the other candidates. */
export async function activateAccount(userId: string, id: string): Promise<AccountRow | null> {
  const rows = await listAccounts(userId);
  const pick = rows.find((r) => r.id === id);
  if (!pick) return null;
  await restAsService(`social_accounts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_active: true }) });
  await restAsService(`social_accounts?user_id=eq.${userId}&provider=eq.${pick.provider}&id=neq.${id}`, { method: "DELETE" });
  return { ...pick, is_active: true };
}
export async function listAccounts(userId: string): Promise<AccountRow[]> {
  const r = await restAsService<AccountRow[]>(`social_accounts?user_id=eq.${userId}&select=*&order=provider,name`);
  return r.data ?? [];
}

/** Publish one image (public https URL) to one account. Returns the remote post id. */
export async function publishImage(a: AccountRow, imageUrl: string, caption: string): Promise<string> {
  if (a.provider === "facebook") {
    const r = await graph<{ id?: string; post_id?: string }>(`${a.account_id}/photos`, { url: imageUrl, message: caption, access_token: a.access_token }, "POST");
    return String(r.post_id ?? r.id ?? "");
  }
  const c = await graph<{ id: string }>(`${a.account_id}/media`, { image_url: imageUrl, caption, access_token: a.access_token }, "POST");
  // IG processes the image asynchronously; publish usually succeeds at once, retry briefly if not ready.
  for (let i = 0; i < 6; i++) {
    try {
      const p = await graph<{ id: string }>(`${a.account_id}/media_publish`, { creation_id: c.id, access_token: a.access_token }, "POST");
      return p.id;
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code !== 9007 && code !== 4 && i === 5) throw e;
      if (code !== 9007 && code !== 4) throw e;
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
  throw new Error("Instagram is still processing the image, try again in a minute.");
}
