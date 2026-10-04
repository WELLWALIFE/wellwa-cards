// Server helpers for "Shubhora" API routes.
//
// Reads go through Supabase REST *as the caller* (their bearer token, so RLS
// decides), writes that must bypass RLS (poster rows, uploads) use the
// service role. Rendering delegates to bridge/poster-engine.mjs — the same
// module the daily cron uses, so the app and the cron can never disagree.
import fs from "node:fs";
import path from "node:path";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";
import { SITE_URL } from "@/lib/site-url";

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type PosterProfile = {
  id: string; user_id: string; persona: string; name: string; tagline: string | null; phone: string | null;
  photo_url: string | null; logo_url: string | null; lang: string; city: string | null; is_default: boolean; kids_mode: boolean; mode?: string;
};

export async function userFromRequest(request: Request): Promise<{ id: string; token: string; email?: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7);
  const who = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth }, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return who?.id ? { id: who.id, token, email: who.email } : null;
}

export function userHeaders(token: string): Record<string, string> {
  return { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function restAsUser<T>(token: string, pathAndQuery: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const r = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...userHeaders(token), ...(init?.headers ?? {}) }, cache: "no-store" });
  const text = await r.text();
  let data: T | null = null;
  try { data = text ? (JSON.parse(text) as T) : null; } catch { /* not json */ }
  return { ok: r.ok, status: r.status, data, text };
}

export async function restAsService<T>(pathAndQuery: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const r = await fetch(`${SUPA_URL}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...serviceHeaders(), ...(init?.headers ?? {}) }, cache: "no-store" });
  const text = await r.text();
  let data: T | null = null;
  try { data = text ? (JSON.parse(text) as T) : null; } catch { /* not json */ }
  return { ok: r.ok, status: r.status, data, text };
}

/** The caller's own profile row, or null if it isn't theirs. */
export async function ownProfile(token: string, profileId: string): Promise<PosterProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return null;
  const r = await restAsUser<PosterProfile[]>(token, `poster_profiles?id=eq.${profileId}&select=*`);
  return r.data?.[0] ?? null;
}

/** Plan + poster allowance. Paid: unlimited (limit null). Free: none (limit 0). */
export async function posterQuota(token: string, userId: string): Promise<{ plan: string; used: number; limit: number | null }> {
  const prof = await restAsUser<{ poster_plan: string; poster_plan_expires_at: string | null; plan_expires_at: string | null; saas_expires_at: string | null }[]>(token, `profiles?id=eq.${userId}&select=poster_plan,poster_plan_expires_at,plan_expires_at,saas_expires_at`);
  let plan = prof.data?.[0]?.poster_plan ?? "free";
  const exp = prof.data?.[0]?.poster_plan_expires_at;
  if (plan !== "free" && exp && new Date(exp).getTime() < Date.now()) plan = "free";
  // A running Business Suite subscription removes the branding and unlocks previews and videos.
  const suiteUntil = [prof.data?.[0]?.plan_expires_at, prof.data?.[0]?.saas_expires_at].map((d) => (d ? new Date(d).getTime() : 0));
  if (plan === "free" && Math.max(...suiteUntil) > Date.now()) plan = "suite";
  if (plan !== "free") return { plan, used: 0, limit: null };
  // Free plan (owner's call, 23 Sep 2026): the digital V-Card and its leads only — posters, videos and the AI tools
  // are part of the subscription. limit 0 = "not on this plan" everywhere the quota is read.
  return { plan, used: 0, limit: 0 };
}

/** IST date string. */
export function istDate(offsetDays = 0): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

type Engine = {
  renderPoster: (date: string, profile: Record<string, unknown>, opts?: { force?: boolean; watermark?: boolean; products?: Record<string, unknown>[]; premium?: boolean; style?: string; custom?: string; testimonial?: Record<string, unknown> | null; stock?: { category: string; kind: string } | null; link?: string; card?: Record<string, unknown> | null }) => Promise<string>;
  /** Sundays that are not a festival: the poster is the owner's own V-Card. */
  isCardDay: (date: string, theme: { kind: string }) => boolean;
  effectiveStyle: (profile: Record<string, unknown>, date: string, override?: string) => string;
  /** Which Signature look ("vibrant" | "classic") a render gets, or null for the six original styles. */
  signatureLookFor: (profile: Record<string, unknown>, style: string, o?: { premium?: boolean; watermark?: boolean; card?: Record<string, unknown> | null }) => "vibrant" | "classic" | null;
  offerFor: (offers: Record<string, unknown>[], date: string, productId?: string | null, productCategory?: string) => string;
  themeFor: (date: string) => { kind: string; slug: string; hi: string; en: string; greet: string };
  rosterKind: (theme: { kind: string }, date: string, o?: { hasProducts?: boolean }) => string;
  OUT_DIR: string; BASE_DIR: string;
  STYLES: Record<string, unknown>;
};
export type CalRow = { kind: string; product_id: string | null; overrides?: { style?: string; voice?: "on" | "off"; music?: string; custom?: string; title?: string; sub?: string; accent?: string } };
/** Today's calendar row + the user's offers → what the engine needs for that day. */
export async function dayPlan(userId: string, profileId: string, date: string): Promise<{ cal: CalRow | null; offers: Record<string, unknown>[]; productCategory: string; offer: string }> {
  const [cal, offers] = await Promise.all([
    restAsService<CalRow[]>(`poster_calendar?profile_id=eq.${profileId}&for_date=eq.${date}&select=kind,product_id,overrides`),
    restAsService<Record<string, unknown>[]>(`poster_offers?user_id=eq.${userId}&active=is.true&starts=lte.${date}&ends=gte.${date}&order=created_at.desc&select=text,starts,ends,scope,product_ids,categories,active`),
  ]);
  const row = Array.isArray(cal.data) ? cal.data[0] ?? null : null;
  const list = Array.isArray(offers.data) ? offers.data : [];
  let productCategory = "";
  if (row?.product_id) productCategory = (await restAsService<{ category: string }[]>(`poster_products?id=eq.${row.product_id}&select=category`)).data?.[0]?.category ?? "";
  const eng = await posterEngine();
  const offer = row?.overrides?.custom || eng.offerFor(list, date, row?.product_id ?? null, productCategory);
  return { cal: row, offers: list, productCategory, offer };
}
type VideoEngine = {
  renderStatusVideo: (posterFile: string, opts?: { music?: string; force?: boolean; seconds?: number; voice?: { text: string; gender?: string; lang?: string } | null; clip?: string | null }) => Promise<string>;
  suggestVoiceScript: (o: { theme?: { hi?: string; en?: string; greet?: string } | null; lang?: string; brand?: string; name?: string; phone?: string; product?: { name?: string; offer?: string; benefits?: string[] } | null; includeName?: boolean; includePhone?: boolean; custom?: string; category?: string }) => Promise<string>;
  MUSIC: { key: string; label: string; mood: string }[];
  /** Music bed for the day: festive / upbeat / calm / inspiring / soft (bridge/poster-video.mjs). */
  musicFor: (theme: { kind?: string; slug?: string } | null | undefined, kind?: string) => string;
  /** Voice on unless the owner switched it off in the app (`layout.voice.by === "user"`). */
  voiceWanted: (layout: unknown) => boolean;
};
let videoEngine: Promise<VideoEngine> | null = null;
export function posterVideoEngine(): Promise<VideoEngine> {
  if (!videoEngine) {
    const file = path.join(process.cwd(), "bridge", "poster-video.mjs");
    videoEngine = (new Function("f", "return import(f)") as (f: string) => Promise<VideoEngine>)(`file://${file}`);
  }
  return videoEngine;
}
let engine: Promise<Engine> | null = null;
export function posterEngine(): Promise<Engine> {
  if (!engine) {
    const file = path.join(process.cwd(), "bridge", "poster-engine.mjs");
    // Webpack must not try to bundle the bridge module.
    engine = (new Function("f", "return import(f)") as (f: string) => Promise<Engine>)(`file://${file}`);
  }
  return engine;
}

export type CardMedia = { photos: { url: string; credit: string }[]; clip: { url: string; poster?: string; credit: string } | null };
type StockEngine = {
  ensureStockClip: (o: { theme: { kind: string; slug: string; en: string }; category: string; kind: string; dateStr: string }) => Promise<{ file: string } | null>;
  /** Judged stock photos + a 12 s landscape clip for a trade, cached per category (see bridge/stock-art.mjs). */
  ensureCardMedia: (o: { category: string; label?: string; want?: number; brand?: string }) => Promise<CardMedia>;
};
let stockEngine: Promise<StockEngine> | null = null;
/** Stock photos / clips (Pexels) chosen by eye — the free layer under the daily poster and status video. */
export function stockEngineMod(): Promise<StockEngine> {
  if (!stockEngine) {
    const file = path.join(process.cwd(), "bridge", "stock-art.mjs");
    stockEngine = (new Function("f", "return import(f)") as (f: string) => Promise<StockEngine>)(`file://${file}`);
  }
  return stockEngine;
}

export const OUT_URL = (file: string) => `/api/poster/img/${path.basename(file)}`;
/** The poster file's last-modified time (ms), or 0. Goes into the image URL as `?v=`, so a poster made again under the
 *  same file name (Edit → Save, a restyle, a re-render after a fix) is fetched fresh instead of served from the
 *  browser / PWA cache of the old picture (owner's report, 29 Sep 2026: "edit ke baad naya aaya, phir purana"). */
export async function posterVersion(url: string | null | undefined): Promise<number> {
  try { const eng = await posterEngine(); return Math.round(fs.statSync(path.join(eng.OUT_DIR, path.basename(String(url || "").split("?")[0]))).mtimeMs); } catch { return 0; }
}
/** The square (1:1) cut of a Signature poster for Google Business, when the engine made one; else the poster itself. */
export async function squarePosterUrl(url: string): Promise<string> {
  const square = String(url).replace(/\.jpg(\?.*)?$/, "-11.jpg");
  if (square === url) return url;
  try { const eng = await posterEngine(); return fs.existsSync(path.join(eng.OUT_DIR, path.basename(square.split("?")[0]))) ? square : url; }
  catch { return url; }
}


/** The status video for a poster — the voice line, the music picked for the day and a stock clip behind the poster,
 *  exactly what the 4 AM auto-post sends — made once and reused. Whatever way the owner posts (the in-app "Post to
 *  Status" button, the 4 AM job, the Share button) the WhatsApp Status is this video (owner's call, 29 Sep 2026:
 *  "user kaise bhi post kare, voice ke saath hi jaana chahiye"). Returns the site-relative URL, or "" when no video
 *  could be made — the caller then sends the image rather than nothing. */
export async function ensureStatusVideo(userId: string, posterId: string): Promise<string> {
  type Row = { id: string; url: string; profile_id: string; for_date: string; video_url: string | null; music: string | null; voice_text: string | null; voice_gender: string | null };
  type Prof = { id: string; name: string; tagline: string | null; phone: string | null; lang: string; persona: string; mode?: string | null; category?: string | null; layout?: { voice?: { on?: boolean; gender?: string; by?: string } } | null };
  const poster = (await restAsService<Row[]>(`posters?id=eq.${posterId}&select=id,url,profile_id,for_date,video_url,music,voice_text,voice_gender`)).data?.[0];
  if (!poster) return "";
  const prof = (await restAsService<Prof[]>(`poster_profiles?id=eq.${poster.profile_id}&user_id=eq.${userId}&select=id,name,tagline,phone,lang,persona,mode,category,layout`)).data?.[0];
  if (!prof) return "";
  const eng = await posterEngine();
  const v = await posterVideoEngine();
  const file = path.join(eng.OUT_DIR, path.basename(String(poster.url).split("?")[0]));
  if (!fs.existsSync(file)) return "";
  const theme = eng.themeFor(poster.for_date);
  const plan = await dayPlan(userId, prof.id, poster.for_date);
  const wantVoice = plan.cal?.overrides?.voice ? plan.cal.overrides.voice === "on" : v.voiceWanted(prof.layout);
  // Already made for this poster, with the voice when the voice is wanted → the same file again.
  if (poster.video_url) {
    const vf = path.join(eng.OUT_DIR, path.basename(String(poster.video_url).split("?")[0]));
    if (fs.existsSync(vf) && fs.statSync(vf).mtimeMs >= fs.statSync(file).mtimeMs && (!wantVoice || /-v(-c)?\.mp4$/.test(vf))) return OUT_URL(vf);
  }
  const kind = prof.mode === "product" ? "product" : "";
  let voice: { text: string; gender?: string; lang?: string } | null = null;
  if (wantVoice) {
    let text = String(poster.voice_text ?? "").trim();
    if (!text) {
      type Prod = { name: string; offer?: string; benefits?: string[]; category?: string };
      let product: Prod | null = null;
      if (kind === "product") {
        let list = (await restAsService<Prod[]>(`poster_products?user_id=eq.${userId}&brand_id=is.null&active=eq.true&order=sort,created_at&select=name,offer,benefits,category`)).data ?? [];
        if (!list.length) {
          const bid = (await restAsService<{ brand_id: string | null }[]>(`profiles?id=eq.${userId}&select=brand_id`)).data?.[0]?.brand_id;
          if (bid) list = (await restAsService<Prod[]>(`poster_products?brand_id=eq.${bid}&active=eq.true&order=sort,created_at&select=name,offer,benefits,category`)).data ?? [];
        }
        // the product ON the poster: the engine's own pick, products[day % n]
        if (list.length) product = list[Math.floor(new Date(`${poster.for_date}T00:00:00Z`).getTime() / 86400000) % list.length];
      }
      const brand = prof.persona === "personal" || prof.persona === "student" ? prof.name : (prof.tagline || prof.name);
      text = await v.suggestVoiceScript({ theme, lang: prof.lang, brand, name: prof.name, phone: prof.phone ?? "", product, custom: (plan.offer || "").slice(0, 120), category: String((prof as { category?: string }).category ?? "") });
    }
    if (text) voice = { text, gender: poster.voice_gender || prof.layout?.voice?.gender || "female", lang: prof.lang };
  }
  const music = poster.music || plan.cal?.overrides?.music || v.musicFor(theme, kind);
  // A Signature poster (spec json beside it) becomes a full-frame video of its own 9:16 layout — no clip behind it.
  let clip: string | null = null;
  if (!fs.existsSync(`${file}.spec.json`)) try {
    const st = await stockEngineMod();
    clip = (await st.ensureStockClip({ theme, category: String(prof.category ?? ""), kind: eng.rosterKind(theme, poster.for_date, { hasProducts: kind === "product" }), dateStr: poster.for_date }))?.file ?? null;
  } catch { clip = null; }
  const out = await v.renderStatusVideo(file, { music, voice, clip });
  const url = OUT_URL(out);
  await restAsService(`posters?id=eq.${poster.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ video_url: url, music, voice_text: voice?.text ?? "", voice_gender: voice ? voice.gender : "" }) });
  return url;
}

type CaptionWriter = {
  writeCaption: (o: { key?: string; name?: string; tagline?: string; phone?: string; lang?: string; theme?: string; offer?: string; product?: { name?: string; price?: string; benefits?: string[]; offer?: string } | null; link?: string; join?: string; kind?: string }) => Promise<string>;
  captionFooter: (o: { phone?: string; link?: string; join?: string; lang?: string }) => string;
  /** The caption for WhatsApp: hashtags removed, "my card" and "make your free card" links always there. */
  statusCaption: (caption: string, o: { phone?: string; link?: string; join?: string; lang?: string }) => string;
};
/** The owner's joining link — "make your free digital card" under every post; "" when the account has no username. */
export async function joinLinkFor(userId: string): Promise<string> {
  const u = (await restAsService<{ username: string | null }[]>(`profiles?id=eq.${userId}&select=username`)).data?.[0]?.username;
  return u ? `${SITE_URL}/signup?by=${encodeURIComponent(u)}` : "";
}
let captionMod: Promise<CaptionWriter> | null = null;
/** The one caption writer shared with the 4 AM auto-post (bridge/poster-caption.mjs). */
export function posterCaptionWriter(): Promise<CaptionWriter> {
  if (!captionMod) {
    const file = path.join(process.cwd(), "bridge", "poster-caption.mjs");
    captionMod = (new Function("f", "return import(f)") as (f: string) => Promise<CaptionWriter>)(`file://${file}`);
  }
  return captionMod;
}

/** The owner's V-Card: the profile's own card first, else their first live card. url = tap-to-open link for captions,
 *  show = the link as printed on the poster, data = the card itself (for the Sunday visiting-card poster). */
export async function cardLinkFor(userId: string, primaryCardId?: string | null): Promise<{ url: string; show: string; username: string; data: Record<string, unknown> } | null> {
  type Row = { username: string; data: Record<string, unknown> | null };
  let row: Row | undefined;
  if (primaryCardId && /^[0-9a-f-]{36}$/i.test(primaryCardId)) row = (await restAsService<Row[]>(`cards?id=eq.${primaryCardId}&owner_id=eq.${userId}&active=eq.true&select=username,data`)).data?.[0];
  if (!row) row = (await restAsService<Row[]>(`cards?owner_id=eq.${userId}&active=eq.true&order=created_at.asc&limit=1&select=username,data`)).data?.[0];
  if (!row?.username) return null;
  // ?view=card: opens the card on a computer too (plain /c/<user> shows the website version there)
  return { url: `${SITE_URL}/c/${row.username}?view=card`, show: `${SITE_URL.replace(/^https?:\/\//, "")}/c/${row.username}`, username: row.username, data: row.data && typeof row.data === "object" ? row.data : {} };
}

/** Post caption for a poster (cached on the row): the selling lines about the day's product / plan, the number and the
 *  owner's V-Card link, then hashtags — the same writer as the auto-post. ₹~0.05 via flash-lite. */
export async function ensurePosterCaption(posterId: string, ctx: { name: string; tagline?: string | null; phone?: string | null; lang?: string | null; theme: string; product?: { name?: string; price?: string; benefits?: string[]; offer?: string } | null; offer?: string; link?: string; join?: string; kind?: string }): Promise<string> {
  const row = (await restAsService<{ caption: string | null; title: string }[]>(`posters?id=eq.${posterId}&select=caption,title`)).data?.[0];
  if (row?.caption) return row.caption;
  const w = await posterCaptionWriter();
  const caption = await w.writeCaption({ key: process.env.GEMINI_API_KEY ?? "", name: ctx.name, tagline: ctx.tagline ?? "", phone: ctx.phone ?? "", lang: ctx.lang ?? "hi", theme: ctx.theme, offer: ctx.offer ?? "", product: ctx.product ?? null, link: ctx.link ?? "", join: ctx.join ?? "", kind: ctx.kind ?? (ctx.product?.name ? "product" : "") });
  await restAsService(`posters?id=eq.${posterId}`, { method: "PATCH", body: JSON.stringify({ caption }) });
  return caption;
}
