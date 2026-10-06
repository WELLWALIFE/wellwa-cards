// Auto-post: every morning (pm2 cron 02:30 UTC = 08:00 IST) post today's
// poster to every social account that has auto_post on (4 AM IST cron); with
// --prerender (noon IST cron) it only prepares TOMORROW's poster + status video. One post per
// account per day (last_auto_post guards re-runs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPoster, themeFor, istDate, effectiveStyle, offerFor, isWaterProduct, isCardDay, OUT_DIR } from "./poster-engine.mjs";
import { writeCaption, statusCaption } from "./poster-caption.mjs";
import { renderStatusVideo, suggestVoiceScript, musicFor, voiceWanted, voiceLangOf } from "./poster-video.mjs";
import { ensureStockClip, rosterKind } from "./stock-art.mjs";
import { planFor, publishStory, publishReel, prepareBusinessDay, productOfDay, unpostedVideo, queuePhotoReel, waitForReel } from "./social-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* no env file */ }
  return env;
}
const env = loadEnv();
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = (env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com").replace(/\/$/, "");
const GRAPH = "https://graph.facebook.com/v21.0";
const GEMINI_KEY = env.GEMINI_API_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(q, init) { const r = await fetch(`${SUPA}/rest/v1/${q}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } }); const t = await r.text(); try { return JSON.parse(t); } catch { return null; } }
async function graph(p, params) { const r = await fetch(`${GRAPH}/${p}`, { method: "POST", body: new URLSearchParams(params) }); const j = await r.json().catch(() => ({})); if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; } return j; }
/** Caption for a post: the shared writer in poster-caption.mjs (the app's own posts use the same one) — the selling
 *  lines about the day's product / plan, then the number and the owner's V-Card link, then hashtags. */
async function genCaption({ name, tagline, phone, lang, theme, offer = "", product = null, link = "", join = "", kind = "" }) {
  return writeCaption({ key: GEMINI_KEY, name, tagline, phone, lang, theme, offer, product, link, join, kind });
}
/** The owner's joining link (their account username): "make your free card" under every post. "" when the account
 *  has no username yet. */
const joinCache = new Map();
async function joinLinkFor(userId) {
  if (joinCache.has(userId)) return joinCache.get(userId);
  const u = (await rest(`profiles?id=eq.${userId}&select=username`))?.[0]?.username;
  const out = u ? `${SITE}/signup?by=${encodeURIComponent(u)}` : "";
  joinCache.set(userId, out);
  return out;
}
/** The owner's V-Card: the profile's own card first, else their first live card. url = the tap-to-open link for
 *  captions, show = the same link as printed on the poster, data = the card itself (for the visiting-card poster). */
const cardCache = new Map();
async function cardLinkFor(userId, prof) {
  const cid = String(prof?.card_facts?.primaryCardId ?? "");
  const key = `${userId}|${cid}`;
  if (cardCache.has(key)) return cardCache.get(key);
  let row = null;
  if (/^[0-9a-f-]{36}$/i.test(cid)) row = (await rest(`cards?id=eq.${cid}&owner_id=eq.${userId}&active=eq.true&select=username,data`))?.[0] ?? null;
  if (!row) row = (await rest(`cards?owner_id=eq.${userId}&active=eq.true&order=created_at.asc&limit=1&select=username,data`))?.[0] ?? null;
  // ?view=card: the caption says "my digital card", so the tap opens the card on a computer too (without it a
  // computer gets the website version of the same card — owner's review, 25 Sep 2026)
  const out = row?.username ? { url: `${SITE}/c/${row.username}?view=card`, show: `${SITE.replace(/^https?:\/\//, "")}/c/${row.username}`, data: row.data && typeof row.data === "object" ? row.data : {} } : null;
  cardCache.set(key, out);
  return out;
}
/* ---- tell the owner when an auto-post fails: WhatsApp self-note (bridge) + app push (FCM) ---- */
import crypto from "node:crypto";
let fcmTok = null;
async function fcmInit() {
  const SA = env.FCM_SERVICE_ACCOUNT_JSON; if (!SA || !fs.existsSync(SA)) return null;
  const sa = JSON.parse(fs.readFileSync(SA, "utf8")); const b64 = (x) => Buffer.from(x).toString("base64url"); const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })), c = b64(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: sa.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${c}`), sa.private_key).toString("base64url");
  const r = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${h}.${c}.${sig}` }) });
  const j = await r.json().catch(() => ({})); return j.access_token ? { projectId: sa.project_id, bearer: j.access_token } : null;
}
/** WhatsApp Status free for 14 days (owner's call, 29 Sep 2026): a free account that has linked WhatsApp and switched
 *  the daily Status on gets the AI status — Signature poster + voice video — for 14 days from the day it switched it on.
 *  `profiles.status_trial_until` holds the end; it starts here on the first morning if the app did not start it.
 *  Returns { active, until, started } — active = post today as a paid account would. */
const FAR = "2999-12-31T23:59:59.000Z";
async function statusTrial(userId, pl) {
  const until = pl?.status_trial_until ? new Date(pl.status_trial_until) : null;
  if (until) return { active: until > new Date(), until, started: false };
  const end = new Date(Date.now() + 14 * 86400_000);
  // rest() gives the updated rows with Prefer: return=representation; an error object means the column is not there yet
  const r = await rest(`profiles?id=eq.${userId}&status_trial_until=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status_trial_until: end.toISOString() }) });
  if (!Array.isArray(r)) return { active: false, until: null, started: false };   // SQL not run yet → no trial
  if (!r.length) { const again = (await rest(`profiles?id=eq.${userId}&select=status_trial_until`))?.[0]; const u = again?.status_trial_until ? new Date(again.status_trial_until) : null; return { active: !!u && u > new Date(), until: u, started: false }; }
  return { active: true, until: end, started: true };
}
async function notifyOwner(userId, title, body) {
  try {
    const pl = (await rest(`profiles?id=eq.${userId}&select=plan,plan_expires_at`))?.[0];
    if (pl && ["pro", "team"].includes(pl.plan)) await fetch("http://127.0.0.1:8787/self-note", { method: "POST", headers: { "content-type": "application/json", "x-neuraledge-user": userId, "x-neuraledge-plan-expires": pl.plan_expires_at || "2999-12-31T23:59:59.000Z" }, body: JSON.stringify({ text: `⚠️ *${title}*\n${body}\n\nOpen Shubhora → Social → History for details.` }), signal: AbortSignal.timeout(15000) }).catch(() => {});
    if (fcmTok === null) fcmTok = (await fcmInit().catch(() => null)) || false;
    if (fcmTok) for (const d of (await rest(`poster_devices?user_id=eq.${userId}&select=token`)) ?? []) fetch(`https://fcm.googleapis.com/v1/projects/${fcmTok.projectId}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${fcmTok.bearer}`, "content-type": "application/json" }, body: JSON.stringify({ message: { token: d.token, notification: { title, body: body.slice(0, 120) }, data: { url: "/poster/social" }, android: { priority: "high" } } }) }).catch(() => {});
  } catch { /* best effort */ }
}
async function publish(a, url, caption) {
  if (a.provider === "facebook") { const r = await graph(`${a.account_id}/photos`, { url, message: caption, access_token: a.access_token }); return r.post_id || r.id; }
  const c = await graph(`${a.account_id}/media`, { image_url: url, caption, access_token: a.access_token });
  for (let i = 0; i < 6; i++) { try { return (await graph(`${a.account_id}/media_publish`, { creation_id: c.id, access_token: a.access_token })).id; } catch (e) { if (e.code !== 9007 && e.code !== 4) throw e; await new Promise((r) => setTimeout(r, 3000)); } }
  throw new Error("Instagram still processing");
}

/** Everything for one profile on one date: calendar/offers/style → poster file, posters row, caption. null = skip day.
 *  redo: make the product poster again (see --redo-products below); every other profile is skipped (null). */
async function prepareDay(userId, prof, date, paid, { redo = false } = {}) {
  const theme = themeFor(date);
  const cal = (await rest(`poster_calendar?profile_id=eq.${prof.id}&for_date=eq.${date}&select=kind,product_id,overrides`))?.[0];
  const offers = await rest(`poster_offers?user_id=eq.${userId}&active=is.true&starts=lte.${date}&ends=gte.${date}&select=text,starts,ends,scope,product_ids,categories,active`);
  if (cal?.kind === "skip") { console.log(`  skip ${prof.name}: calendar skip`); return null; }
  let testimonial = null;
  if (cal?.kind === "testimonial") {
    const list = await rest(`poster_testimonials?user_id=eq.${userId}&approved=eq.true&order=created_at&select=*`);
    if (Array.isArray(list) && list.length) testimonial = list[Math.floor(new Date(date + "T00:00:00Z").getTime() / 86400000) % list.length];
  }
  if (cal && cal.kind !== "auto") prof.mode = testimonial ? "testimonial" : (cal.kind === "product" || cal.kind === "offer") ? "product" : "greeting";
  let products = prof.mode === "product" ? ((await rest(`poster_products?user_id=eq.${userId}&brand_id=is.null&active=eq.true&order=sort,created_at&select=*`)) ?? []) : [];
  if (prof.mode === "product" && Array.isArray(products) && !products.length) {
    const bid = (await rest(`profiles?id=eq.${userId}&select=brand_id`))?.[0]?.brand_id;
    if (bid) products = (await rest(`poster_products?brand_id=eq.${bid}&active=eq.true&order=sort,created_at&select=*`)) ?? [];
  }
  if (cal?.product_id && Array.isArray(products)) { const one = products.find((p) => p.id === cal.product_id); if (one) products = [one]; }
  const ov = cal?.overrides && typeof cal.overrides === "object" ? cal.overrides : {};
  const style = effectiveStyle(prof, date, ov.style);
  // The product that is ON the poster — the engine's own pick (products[day % n]); its offer, caption and voice follow it.
  // (products[0] was used here, so the offer / voice could be about a different product than the picture.)
  const pList = Array.isArray(products) ? products : [];
  const dayProd = prof.mode === "product" && !testimonial && pList.length ? pList[Math.floor(new Date(date + "T00:00:00Z").getTime() / 86400000) % pList.length] : null;
  // The owner's V-Card: its link goes on the poster and in the caption; on Sundays the poster IS the card.
  const link = await cardLinkFor(userId, prof);
  const join = await joinLinkFor(userId);
  const cardDay = !!link && (!cal || cal.kind === "auto") && !testimonial && isCardDay(date, theme);
  const custom = ov.custom || offerFor(offers, date, dayProd?.id ?? null, dayProd?.category ?? "");
  // The day's own heading / small line / accent (the app's "Only today" poster edit) sit over the profile's
  // layout for this render only — the same rule as /api/poster/today, so the 4 AM post matches what was edited.
  const baseLayout = prof.layout && typeof prof.layout === "object" ? prof.layout : {};
  const dayProf = (ov.title || ov.sub || ov.accent) ? { ...prof, layout: { ...baseLayout, ...(ov.title ? { title: ov.title } : {}), ...(ov.sub ? { sub: ov.sub } : {}), ...(ov.accent ? { accent: ov.accent } : {}) } } : prof;
  if (redo && cardDay) return null;
  if (redo) {
    // Only product posters of non-water businesses: those got the water scenes before 25 Sep 2026.
    if (!dayProd || isWaterProduct(dayProd, prof)) return null;
    console.log(`  redo ${prof.name}: ${dayProd.name}`);
  }
  // What the owner saw in the app is what gets posted (owner's review, 25 Sep 2026). The day's poster may already be
  // made — the noon preview, or the owner's own Edit / style change in the app, which is saved under a different file
  // name. Making a fresh one here used to post the old noon file over the owner's edit. A watermarked file from a
  // free-plan day is never reused for a paid post, nor one in another style than the day's (the app re-makes those too).
  const seenRow = redo ? null : (await rest(`posters?profile_id=eq.${prof.id}&for_date=eq.${date}&select=url,style`))?.[0];
  const seen = seenRow?.url && (seenRow.style || "classic") === style ? path.join(OUT_DIR, path.basename(String(seenRow.url).split("?")[0])) : "";
  const reuse = !!seen && seen.endsWith(".jpg") && fs.existsSync(seen) && !(paid && seen.endsWith("-w.jpg"));
  // A real stock photo for the trade and the day first (the same as the app's /api/poster/today — what the owner saw
  // is what goes out); the AI painting only when no fitting photo was found. Until 29 Sep 2026 this path skipped
  // `stock`, so every 4 AM / noon poster paid for an AI painting per trade group per day.
  const stock = { category: String(prof.category ?? dayProd?.category ?? ""), kind: theme.kind === "occasion" ? "festival" : (dayProd && !cardDay) ? "product" : "greeting" };
  const file = reuse ? seen : await renderPoster(date, dayProf, { force: redo, watermark: !paid, products: Array.isArray(products) ? products : [], premium: !!paid, testimonial, style, custom, stock, link: link?.show ?? "", card: cardDay ? link.data : null });
  const url = `${SITE}/api/poster/img/${path.basename(file)}`;
  // make sure the poster row exists (history / share counts)
  await rest(`posters?on_conflict=profile_id,for_date`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ profile_id: prof.id, for_date: date, occasion_slug: theme.slug, title: theme.hi, url: `/api/poster/img/${path.basename(file)}`, style }) });
  const poster = (await rest(`posters?profile_id=eq.${prof.id}&for_date=eq.${date}&select=id`))?.[0];
  const storedCap = poster?.id ? (await rest(`posters?id=eq.${poster.id}&select=caption`))?.[0]?.caption : null;
  const kind = cardDay ? "card" : dayProd ? "product" : "";
  const cardLinkFix = (c) => { if (!c || !link?.url) return c; const base = link.url.split("?")[0]; return c.includes(link.url) || !c.includes(base) ? c : c.split(base).join(link.url); };
  const fixedCap = cardLinkFix(storedCap);
  if (fixedCap !== storedCap && poster?.id && !custom && !redo) await rest(`posters?id=eq.${poster.id}`, { method: "PATCH", body: JSON.stringify({ caption: fixedCap }) });
  const caption = (fixedCap && !custom && !redo) ? fixedCap : await genCaption({ name: prof.name, tagline: prof.tagline, phone: prof.phone, lang: prof.lang, theme: theme.hi, offer: custom, product: kind === "product" ? dayProd : null, link: link?.url ?? "", join, kind });
  if ((!storedCap || redo) && poster?.id) await rest(`posters?id=eq.${poster.id}`, { method: "PATCH", body: JSON.stringify({ caption }) });
  // dayProd = the product ON the poster (none on a visiting-card day), for the status video's voice
  // cal travels with the day: main() marks the calendar entry done after posting. (It read a `cal` that only existed
  // in here — "cal is not defined" — so every WhatsApp Status that went out was also logged and notified as FAILED.)
  return { file, url, poster, caption, custom, ov, theme, products, testimonial, dayProd: cardDay ? null : dayProd, link, join, cal: cal ?? null };
}

/** Is this user's WhatsApp number actually linked? Same rule as bridge/manager.mjs isLinked: Baileys writes `me` and
 *  `account` into the tenant's creds.json when linking succeeds. A row in social_accounts only says auto-post is ON. */
const waLinked = (userId) => {
  try { const c = JSON.parse(fs.readFileSync(path.join(__dirname, "tenants", userId, "auth", "creds.json"), "utf8")); return Boolean(c?.me?.id && c?.account); }
  catch { return false; }
};
/** What each user has connected for auto-posting — the only reason to make a poster or a video at all (owner's call,
 *  29 Sep 2026: "agar connect hi nahi hai fir kyon banani?"). wa = WhatsApp auto-post on AND the number linked;
 *  page = Facebook / Instagram auto-post on; google = Business Profile auto-post on. */
async function channelsFor() {
  const out = new Map();
  const get = (id) => { if (!out.has(id)) out.set(id, { wa: false, page: false, google: false }); return out.get(id); };
  for (const a of (await rest("social_accounts?auto_post=eq.true&is_active=eq.true&status=eq.ok&select=user_id,provider")) ?? []) {
    if (a.provider === "whatsapp") { if (waLinked(a.user_id)) get(a.user_id).wa = true; }
    else get(a.user_id).page = true;
  }
  for (const g of (await rest("google_accounts?auto_post=eq.true&select=user_id,refresh_token")) ?? []) if (g.refresh_token) get(g.user_id).google = true;
  return out;
}

/** The day's status video for one profile: the poster over a stock clip (or the gradient), music picked for the day,
 *  and the AI voice line — on by default, off only when the owner switched it off in the app (owner's call,
 *  29 Sep 2026: the daily WhatsApp poster is a 10–15 s video with voice; its length follows the spoken line).
 *  Same rules as the app's own "Make video". Returns the mp4 path. */
async function statusVideoFor(prof, day, date) {
  const L = prof.layout && typeof prof.layout === "object" ? prof.layout : {};
  const { file, ov, theme, dayProd, poster, custom } = day;
  const voiceOn = ov.voice ? ov.voice === "on" : voiceWanted(L);
  let voice = null;
  if (voiceOn) {
    const product = dayProd ? { name: dayProd.name, offer: dayProd.offer, benefits: dayProd.benefits } : null;
    const brand = prof.persona === "personal" || prof.persona === "student" ? prof.name : (prof.tagline || prof.name);
    const text = await suggestVoiceScript({ theme, lang: voiceLangOf(prof.layout), brand, name: prof.name, phone: prof.phone || "", product, custom, category: prof.category || "" });
    if (text) voice = { text, gender: L.voice?.gender || "female", lang: voiceLangOf(prof.layout) };
    else console.log(`  ${prof.name}: no voice line today → music only`);
  }
  // A moving stock clip behind the poster (chosen for the trade and the day, cached per trade) — the gradient if none.
  // A Signature poster (spec json beside it) becomes a full-frame video of its own 9:16 layout — no clip behind it.
  let clip = null;
  if (!fs.existsSync(`${file}.spec.json`)) try {
    const kind = rosterKind(theme, date, { hasProducts: prof.mode === "product" });
    clip = (await ensureStockClip({ theme, category: String(prof.category ?? ""), kind, dateStr: date }))?.file ?? null;
  } catch (e) { console.log(`  clip skipped for ${prof.name}: ${e.message}`); }
  const music = ov.music || musicFor(theme, dayProd ? "product" : "");
  const mp4 = await renderStatusVideo(file, { music, voice, clip });
  if (poster?.id) await rest(`posters?id=eq.${poster.id}`, { method: "PATCH", body: JSON.stringify({ video_url: `/api/poster/img/${path.basename(mp4)}`, music, voice_text: voice?.text ?? "", voice_gender: voice?.gender ?? "" }) });
  return mp4;
}

/** Facebook / Instagram: the weekly business plan (daily Story, 4 product posts, 3 reels) — greetings stay on WhatsApp. */
async function runPlan(a, prof, paid, date) {
  const link = await cardLinkFor(a.user_id, prof);
  const ctx = { rest, userId: a.user_id, site: SITE, geminiKey: GEMINI_KEY, log: (m) => console.log(m), link: link?.show ?? "" };
  const plan = planFor(date);
  const day = plan.story || plan.feed ? await prepareBusinessDay(ctx, prof, date, paid) : { product: await productOfDay(rest, a.user_id, date), custom: "" };
  const themeLine = day?.file && day?.product ? `${day.product.name}${day.product.benefits?.[0] ? ` — ${day.product.benefits[0]}` : ""}` : day?.theme?.hi ?? "";
  const caption = day?.file ? await genCaption({ name: prof.name, tagline: prof.tagline, phone: prof.phone, lang: prof.lang, theme: themeLine, offer: day.custom, product: day.product ?? null, link: link?.url ?? "", join: await joinLinkFor(a.user_id), kind: day.product ? "product" : "" }) : "";
  const log = async (kind, remote, jobId = null) => {
    await rest(`social_posts`, { method: "POST", body: JSON.stringify({ user_id: a.user_id, account_id: a.id, provider: a.provider, kind, caption, remote_id: String(remote ?? ""), media_job_id: jobId, status: "ok" }) });
    console.log(`  ok ${a.provider} ${a.name} ${kind} → ${remote}`);
  };
  const step = async (kind, col, fn) => {
    if (a[col] === date) return;
    try { const id = await fn(); if (id !== undefined) { await log(kind, id, fn.jobId ?? null); await rest(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ [col]: date }) }); } }
    catch (e) {
      console.log(`  FAIL ${a.provider} ${a.name} ${kind}: ${e.message}`);
      await rest(`social_posts`, { method: "POST", body: JSON.stringify({ user_id: a.user_id, account_id: a.id, provider: a.provider, kind, caption: "", status: "error", error: String(e.message).slice(0, 500) }) });
      if (e.code === 190) { await rest(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "reconnect" }) }); throw e; }
    }
  };
  if (day?.file && plan.story) await step("story", "last_story", () => publishStory(a, { imageUrl: day.url, videoUrl: day.videoUrl }));
  if (day?.file && plan.feed) await step("feed", "last_feed", () => publish(a, day.url, caption));
  if (plan.reel) {
    let vid = await unpostedVideo(rest, a.user_id, date); let jobId = vid?.id ?? null;
    if (!vid) { // nothing of the owner's own this week → build a photo reel from today's product
      const id = await queuePhotoReel(ctx, prof, day?.product ?? null, day?.custom ?? "", plan.reelAi);
      if (id) { jobId = id; try { vid = await waitForReel(rest, id); } catch (e) { console.log(`  reel build failed: ${e.message}`); } }
    }
    if (vid?.url) { const f = () => publishReel(a, vid.url, vid.caption || caption); f.jobId = jobId; await step("reel", "last_reel", f); }
    else console.log(`  skip ${a.name} reel: nothing ready`);
  }
}

async function main() {
  const date = istDate();
  const theme = themeFor(date);
  // The weekly plan needs migration 0045 (plan_on / last_story / last_feed / last_reel, social_posts.kind).
  // Until it is applied, keep the old behaviour so a missing column can never break the daily post.
  const probe = await rest(`social_accounts?select=plan_on&limit=1`);
  const HAS_PLAN = Array.isArray(probe);
  if (!HAS_PLAN) console.log("[autopost] migration 0045 not applied yet → weekly content plan is off");
  const res = await rest(`social_accounts?auto_post=eq.true&is_active=eq.true&status=eq.ok&select=*`);
  if (!Array.isArray(res)) { console.log("[autopost] query failed (migration 0025 applied?)", JSON.stringify(res)); return; }
  const accts = res;
  console.log(`[autopost] ${date} ${accts.length} account(s)`);
  for (const a of accts) {
    if (a.last_auto_post === date) continue;
    // Auto-post ON but the number was never linked (or unlinked since): the bridge would refuse the post, so no
    // poster, no caption, no video is made for it (owner's call, 29 Sep 2026).
    if (a.provider === "whatsapp" && !waLinked(a.user_id)) { console.log(`  skip ${a.name}: WhatsApp not linked`); continue; }
    try {
      let prof = a.auto_post_profile ? (await rest(`poster_profiles?id=eq.${a.auto_post_profile}&select=*`))?.[0] : null;
      if (!prof) prof = (await rest(`poster_profiles?user_id=eq.${a.user_id}&order=is_default.desc,created_at&limit=1&select=*`))?.[0];
      if (!prof) { console.log(`  skip ${a.name}: no profile`); continue; }
      const plan = (await rest(`profiles?id=eq.${a.user_id}&select=poster_plan,poster_plan_expires_at,plan,plan_expires_at,saas_expires_at,status_trial_until`))?.[0]
        ?? (await rest(`profiles?id=eq.${a.user_id}&select=poster_plan,poster_plan_expires_at,plan,plan_expires_at,saas_expires_at`))?.[0];
      const future = (d) => !!d && new Date(d) > new Date();
      const suite = !!plan && ((["pro", "team"].includes(plan.plan) && (!plan.plan_expires_at || future(plan.plan_expires_at))) || future(plan.saas_expires_at));
      let paid = suite || (plan && plan.poster_plan !== "free" && (!plan.poster_plan_expires_at || new Date(plan.poster_plan_expires_at) > new Date()));
      // Free plan: WhatsApp Status for 14 days (trial), nothing else. Facebook / Instagram stay paid.
      let trial = null;
      if (!paid && a.provider === "whatsapp") {
        trial = await statusTrial(a.user_id, plan);
        if (trial.active) { paid = true; console.log(`  ${a.name}: free — Status trial${trial.started ? " starts today" : ""}, till ${trial.until.toISOString().slice(0, 10)}`); }
        else if (trial.until) {
          // the first morning after the trial: the daily Status is switched off and the owner told once (a Growth plan
          // switches it back on from the app)
          await rest(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ auto_post: false }) });
          await notifyOwner(a.user_id, "14 दिन का फ़्री WhatsApp Status पूरा हुआ", "रोज़ का AI Status जारी रखने के लिए Growth plan लें — app में Plans देखें।");
        }
      }
      if (!paid) { console.log(`  skip ${a.name}: free plan${trial?.until ? " (status trial over)" : ""}`); continue; }
      if (HAS_PLAN && a.provider !== "whatsapp" && a.plan_on !== false) { // business plan instead of the greeting poster
        await runPlan(a, prof, paid, date);
        await rest(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ last_auto_post: date }) });
        continue;
      }
      const day = await prepareDay(a.user_id, prof, date, paid);
      if (!day) continue;
      const { url, poster, caption, cal } = day;
      // WhatsApp gets the caption without hashtags and always with "my card" + "make your free card" (owner, 29 Sep 2026)
      const waCaption = statusCaption(caption, { phone: prof.phone || "", link: day.link?.url ?? "", join: day.join, lang: prof.lang });
      let remote;
      if (a.provider === "whatsapp") {
        const pl = (await rest(`profiles?id=eq.${a.user_id}&select=plan_expires_at`))?.[0];
        // Status video (voice + music, 10–15 s) instead of the image — paid plans, unless the user switched it off.
        let videoUrl = "";
        const L = prof.layout && typeof prof.layout === "object" ? prof.layout : {};
        if (paid && L.autoStatusVideo !== false) {
          try {
            const mp4 = await statusVideoFor(prof, day, date);
            videoUrl = `${SITE}/api/poster/img/${path.basename(mp4)}`;
          } catch (e) { console.log(`  status video failed for ${a.name}: ${e.message} → image`); }
        }
        // Three tries, two minutes apart: the socket may have been dropped overnight and be reconnecting at 4 AM
        // (29 Sep 2026: one try → "Connection Closed" → no status that day). The worker itself also waits and retries.
        let j = null, why = "";
        for (let attempt = 1; attempt <= 3 && !j; attempt += 1) {
          if (attempt > 1) { console.log(`  whatsapp ${a.name}: ${why} — trying again in 2 min (${attempt}/3)`); await new Promise((r) => setTimeout(r, 120_000)); }
          try {
            const r = await fetch("http://127.0.0.1:8787/status", { method: "POST", headers: { "content-type": "application/json", "x-neuraledge-user": a.user_id, "x-neuraledge-plan-expires": (pl?.plan_expires_at && new Date(pl.plan_expires_at) > new Date()) ? pl.plan_expires_at : FAR }, body: JSON.stringify(videoUrl ? { videoUrl, caption: waCaption } : { imageUrl: url, caption: waCaption }), signal: AbortSignal.timeout(400_000) });
            const body = await r.json().catch(() => ({}));
            if (r.ok) j = body;
            else if (r.status === 402) throw new Error(body.error || "plan_expired");
            else why = body.error || `status ${r.status}`;
          } catch (e) { if (/plan_expired/.test(e.message)) throw e; why = e.message; }
        }
        if (!j) throw new Error(why || "status failed");
        remote = `status:${j.audience ?? 0}`;
      } else remote = await publish(a, url, caption);
      await rest(`social_posts`, { method: "POST", body: JSON.stringify({ user_id: a.user_id, account_id: a.id, provider: a.provider, kind: a.provider === "whatsapp" ? "status" : "feed", poster_id: poster?.id ?? null, caption, remote_id: remote, status: "ok" }) });
      await rest(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ last_auto_post: date }) });
      if (cal) await rest(`poster_calendar?profile_id=eq.${prof.id}&for_date=eq.${date}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
      console.log(`  ok ${a.provider} ${a.name} → ${remote}`);
    } catch (e) {
      console.log(`  FAIL ${a.provider} ${a.name}: ${e.message}`);
      await notifyOwner(a.user_id, `Today's ${a.provider === "whatsapp" ? "WhatsApp Status" : a.provider === "facebook" ? "Facebook" : "Instagram"} post failed`, String(e.message).slice(0, 160));
      await rest(`social_posts`, { method: "POST", body: JSON.stringify({ user_id: a.user_id, account_id: a.id, provider: a.provider, caption: "", status: "error", error: String(e.message).slice(0, 500) }) });
      if (e.code === 190) await rest(`social_accounts?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "reconnect" }) });
    }
  }
}
/* ---- Google Business Profile: today's poster as a local post (google_accounts.auto_post) ---- */
let gCreds = null;
async function gToken(g) {
  const exp = g.token_expires_at ? new Date(g.token_expires_at).getTime() : 0;
  if (g.access_token && exp - Date.now() > 60_000) return g.access_token;
  let c = g.client_id && g.client_secret ? { id: g.client_id, secret: g.client_secret } : null;
  if (!c) { if (!gCreds) { const p = (await rest("platform_secrets?id=eq.1&select=google_client_id,google_client_secret"))?.[0]; gCreds = p?.google_client_id ? { id: p.google_client_id, secret: p.google_client_secret } : { id: env.GOOGLE_CLIENT_ID ?? "", secret: env.GOOGLE_CLIENT_SECRET ?? "" }; } c = gCreds; }
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: g.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) { await rest(`google_accounts?user_id=eq.${g.user_id}`, { method: "PATCH", body: JSON.stringify({ status: "reconnect" }) }); throw new Error(j.error_description || "google refresh failed"); }
  await rest(`google_accounts?user_id=eq.${g.user_id}`, { method: "PATCH", body: JSON.stringify({ access_token: j.access_token, token_expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString() }) });
  return j.access_token;
}
async function googleMain() {
  const date = istDate();
  const rows = await rest("google_accounts?auto_post=eq.true&status=eq.ok&select=*");
  if (!Array.isArray(rows) || !rows.length) return;
  for (const g of rows) {
    if (g.last_auto_post === date || !g.refresh_token) continue;
    try {
      const prof = (await rest(`poster_profiles?user_id=eq.${g.user_id}&order=is_default.desc,created_at&limit=1&select=*`))?.[0];
      if (!prof) continue;
      const poster = (await rest(`posters?profile_id=eq.${prof.id}&for_date=eq.${date}&select=id,url,title,caption`))?.[0];
      if (!poster) { console.log(`  google skip ${g.location_title}: no poster today yet`); continue; }
      const caption = poster.caption || await genCaption({ name: prof.name, tagline: prof.tagline, phone: prof.phone, lang: prof.lang, theme: poster.title, link: (await cardLinkFor(g.user_id, prof))?.url ?? "" });
      // Google shows local-post photos square: a Signature poster has its own 1:1 cut next to the 4:5 master
      const square = poster.url.replace(/\.jpg(\?.*)?$/, "-11.jpg");
      const posterUrl = square !== poster.url && fs.existsSync(path.join(OUT_DIR, path.basename(square.split("?")[0]))) ? square : poster.url;
      const url = posterUrl.startsWith("http") ? posterUrl : `${SITE}${posterUrl}`;
      const body = { languageCode: prof.lang === "hi" ? "hi" : "en", topicType: "STANDARD", summary: String(caption).slice(0, 1500), media: [{ mediaFormat: "PHOTO", sourceUrl: url }], ...(prof.phone || g.phone ? { callToAction: { actionType: "CALL" } } : {}) };
      const tok = await gToken(g);
      const r = await fetch(`https://mybusiness.googleapis.com/v4/${g.location_name}/localPosts`, { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message || `google ${r.status}`);
      await rest(`google_accounts?user_id=eq.${g.user_id}`, { method: "PATCH", body: JSON.stringify({ last_auto_post: date, last_error: "" }) });
      await rest("social_posts", { method: "POST", body: JSON.stringify({ user_id: g.user_id, provider: "google", poster_id: poster.id, caption, remote_id: j.name ?? "", status: "ok" }) }).catch(() => {});
      console.log(`  ok google ${g.location_title}`);
    } catch (e) {
      console.log(`  FAIL google ${g.location_title}: ${e.message}`);
      await notifyOwner(g.user_id, "Today's Google Business update failed", String(e.message).slice(0, 160));
      await rest(`google_accounts?user_id=eq.${g.user_id}`, { method: "PATCH", body: JSON.stringify({ last_error: String(e.message).slice(0, 200) }) });
    }
  }
}
/* ---- noon pre-render: tomorrow's poster (+ status video) for every active profile, so the owner can review/edit before the 4 AM post ----
 * --redo-products (run by hand): make tomorrow's PRODUCT posters again for every business that does not sell water, with
 * the current engine — for a day that was prepared before an engine fix (25 Sep 2026: water scenes on everyone's
 * products). Greeting posters and water products are left as they are. One new AI picture per product.
 *   node bridge/social-autopost.mjs --prerender --redo-products [--date=YYYY-MM-DD] */
async function prerender() {
  const redo = process.argv.includes("--redo-products");
  const dArg = process.argv.find((a) => a.startsWith("--date="))?.slice(7) ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dArg) ? dArg : istDate(1);
  const profs = await rest("poster_profiles?select=*&order=created_at&limit=2000");
  if (!Array.isArray(profs)) return;
  const plans = new Map();
  const channels = await channelsFor();
  let n = 0, skipped = 0;
  for (const prof of profs) {
    try {
      if (!plans.has(prof.user_id)) {
        const pl = (await rest(`profiles?id=eq.${prof.user_id}&select=poster_plan,poster_plan_expires_at,plan,plan_expires_at,saas_expires_at`))?.[0];
        const future = (d) => !!d && new Date(d) > new Date();
        const suite = !!pl && ((["pro", "team"].includes(pl.plan) && (!pl.plan_expires_at || future(pl.plan_expires_at))) || future(pl.saas_expires_at));
        plans.set(prof.user_id, suite || !!(pl && pl.poster_plan !== "free" && (!pl.poster_plan_expires_at || future(pl.poster_plan_expires_at))));
      }
      let paid = plans.get(prof.user_id);
      // Nothing connected → nothing to post → nothing is made. WhatsApp linked → poster + status video.
      // Only Facebook / Instagram / Google Business → the poster image, no video (owner's call, 29 Sep 2026).
      const ch = channels.get(prof.user_id);
      if (!ch) { skipped += 1; continue; }
      // Free = the digital V-Card only (owner's call, 23 Sep 2026) — except the 14-day WhatsApp Status trial.
      if (!paid && ch.wa) { const t = await statusTrial(prof.user_id, (await rest(`profiles?id=eq.${prof.user_id}&select=status_trial_until`).catch(() => null))?.[0]); if (t.active) paid = true; }
      if (!paid) continue;
      const day = await prepareDay(prof.user_id, prof, date, paid, { redo });
      if (!day) continue;
      n += 1;
      const L = prof.layout && typeof prof.layout === "object" ? prof.layout : {};
      if (ch.wa && L.autoStatusVideo !== false) await statusVideoFor(prof, day, date);
      console.log(`  ready ${prof.name} → ${path.basename(day.file)}${ch.wa ? " + video" : " (image only: WhatsApp not linked)"}`);
    } catch (e) { console.log(`  prerender FAIL ${prof.name}: ${e.message}`); }
  }
  console.log(`[prerender] ${date}: ${n} poster(s) ${redo ? "made again" : "ready"}, ${skipped} paid profile(s) skipped (nothing connected)`);
}

const PRERENDER = process.argv.includes("--prerender");
(PRERENDER ? prerender() : main().then(() => googleMain())).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
