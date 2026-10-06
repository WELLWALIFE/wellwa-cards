// Weekly social content plan for Facebook / Instagram (greetings stay on WhatsApp Status).
//   every day  → Story: the product poster + a voice line about that product's benefit
//   Mon/Wed/Fri/Sun → feed post: product poster + caption          (4 per week)
//   Tue/Thu/Sat     → reel: the owner's own ad if they made one this week, else a photo reel (3 per week)
// Cost per user per week ≈ ₹10-20 (voice + an occasional AI picture); no Kling, no credits.
import path from "node:path";
import { renderPoster, themeFor, effectiveStyle, offerFor } from "./poster-engine.mjs";
import { renderStatusVideo, suggestVoiceScript, musicFor, voiceWanted, voiceLangOf } from "./poster-video.mjs";

const GRAPH = "https://graph.facebook.com/v21.0";
const RUPLOAD = "https://rupload.facebook.com";
const dayIdx = (date) => Math.floor(new Date(date + "T00:00:00Z").getTime() / 86400000);
/** 0=Sun … 6=Sat → what Facebook / Instagram get today. */
export function planFor(date) {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  // AI scenes cost the platform ≈ ₹25 a reel, so only one reel a week may use them; the other two are stock-only.
  return { story: true, feed: [0, 1, 3, 5].includes(dow), reel: [2, 4, 6].includes(dow), reelAi: dow === 4 };
}

async function graph(p, params, method = "POST") {
  const r = await fetch(`${GRAPH}/${p}`, { method, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; throw e; }
  return j;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Instagram: create a container, wait for it to finish encoding, publish. */
async function igPublish(a, fields) {
  const c = await graph(`${a.account_id}/media`, { ...fields, access_token: a.access_token });
  for (let i = 0; i < 20; i++) {
    const st = await graph(`${c.id}?fields=status_code&access_token=${encodeURIComponent(a.access_token)}`, {}, "GET").catch(() => ({}));
    if (st.status_code === "FINISHED" || !st.status_code) break;
    if (st.status_code === "ERROR") throw new Error("Instagram could not process the media");
    await sleep(5000);
  }
  for (let i = 0; i < 6; i++) {
    try { return (await graph(`${a.account_id}/media_publish`, { creation_id: c.id, access_token: a.access_token })).id; }
    catch (e) { if (e.code !== 9007 && e.code !== 4) throw e; await sleep(4000); }
  }
  throw new Error("Instagram still processing");
}
/** Facebook resumable upload (reels and video stories): start → upload by URL → finish. */
async function fbVideo(a, edge, videoUrl, extra = {}) {
  const start = await graph(`${a.account_id}/${edge}`, { upload_phase: "start", access_token: a.access_token });
  const id = start.video_id ?? start.id;
  const up = await fetch(start.upload_url ?? `${RUPLOAD}/video-upload/v21.0/${id}`, { method: "POST", headers: { Authorization: `OAuth ${a.access_token}`, file_url: videoUrl } });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.error) throw new Error(uj.error?.message || `upload failed (${up.status})`);
  await graph(`${a.account_id}/${edge}`, { upload_phase: "finish", video_id: id, video_state: "PUBLISHED", access_token: a.access_token, ...extra });
  return id;
}

/** One Story. Video (poster + voice) when we have it, else the image. */
export async function publishStory(a, { imageUrl, videoUrl }) {
  if (a.provider === "instagram") return igPublish(a, videoUrl ? { media_type: "STORIES", video_url: videoUrl } : { media_type: "STORIES", image_url: imageUrl });
  if (videoUrl) return fbVideo(a, "video_stories", videoUrl);
  const ph = await graph(`${a.account_id}/photos`, { url: imageUrl, published: "false", access_token: a.access_token });
  return (await graph(`${a.account_id}/photo_stories`, { photo_id: ph.id, access_token: a.access_token })).post_id ?? ph.id;
}
/** One Reel. */
export async function publishReel(a, videoUrl, caption) {
  if (a.provider === "instagram") return igPublish(a, { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" });
  return fbVideo(a, "video_reels", videoUrl, { description: String(caption ?? "").slice(0, 2000) });
}

/** The product this user shows today (rotates through their catalogue). null = no products (service business). */
export async function productOfDay(rest, userId, date) {
  let list = (await rest(`poster_products?user_id=eq.${userId}&brand_id=is.null&active=eq.true&order=sort,created_at&select=*`)) ?? [];
  if (!list.length) {
    const bid = (await rest(`profiles?id=eq.${userId}&select=brand_id`))?.[0]?.brand_id;
    if (bid) list = (await rest(`poster_products?brand_id=eq.${bid}&active=eq.true&select=*`)) ?? [];
  }
  return list.length ? list[dayIdx(date) % list.length] : null;
}

/** Today's business poster (product if there is one, else the normal daily poster) + the Story video with its voice line. */
export async function prepareBusinessDay(ctx, prof, date, paid) {
  const { rest, userId, site } = ctx;
  const theme = themeFor(date);
  const product = await productOfDay(rest, userId, date);
  const offers = await rest(`poster_offers?user_id=eq.${userId}&active=is.true&starts=lte.${date}&ends=gte.${date}&select=text,scope,product_ids,categories`);
  const custom = offerFor(offers, date, product?.id ?? null, product?.category ?? "");
  const style = effectiveStyle(prof, date);
  const p = product ? { ...prof, mode: "product" } : prof;
  const file = await renderPoster(date, p, { watermark: !paid, products: product ? [product] : [], premium: !!paid, style, custom, tag: "-biz", link: ctx.link || "" });
  const url = `${site}/api/poster/img/${path.basename(file)}`;
  const L = prof.layout && typeof prof.layout === "object" ? prof.layout : {};
  let videoUrl = "";
  if (paid) {
    try {
      const brand = prof.tagline || prof.name;
      const text = voiceWanted(L) ? await suggestVoiceScript({ theme, lang: voiceLangOf(prof.layout), brand, name: prof.name, phone: prof.phone || "", product: product ? { name: product.name, offer: product.offer, benefits: product.benefits } : null, custom, category: prof.category || "" }) : "";
      const voice = text ? { text, gender: L.voice?.gender || "female", lang: voiceLangOf(prof.layout) } : null;
      const mp4 = await renderStatusVideo(file, { music: musicFor(theme, product ? "product" : ""), voice });
      videoUrl = `${site}/api/poster/img/${path.basename(mp4)}`;
    } catch (e) { ctx.log(`  story video failed: ${e.message} → image`); }
  }
  return { file, url, videoUrl, product, custom, theme };
}

/** A finished video of the owner's own (ad or reel) from the last 7 days that was never posted as a reel. */
export async function unpostedVideo(rest, userId, date) {
  const since = new Date(new Date(date + "T00:00:00Z").getTime() - 7 * 86400000).toISOString();
  const jobs = (await rest(`media_jobs?owner_id=eq.${userId}&kind=eq.ad&status=eq.done&created_at=gte.${since}&order=created_at.desc&select=id,output_url,input`)) ?? [];
  if (!Array.isArray(jobs) || !jobs.length) return null;
  const done = new Set(((await rest(`social_posts?user_id=eq.${userId}&kind=eq.reel&select=media_job_id`)) ?? []).map((x) => x.media_job_id));
  const j = jobs.find((x) => x.output_url && !done.has(x.id));
  return j ? { id: j.id, url: j.output_url, caption: j.input?.caption ?? "" } : null;
}

/** Queue a photo reel about today's product (the media worker builds it: stock clips or AI scenes, voice, captions). */
export async function queuePhotoReel(ctx, prof, product, custom, allowAi = false) {
  const { rest, userId, geminiKey } = ctx;
  const lang = prof.lang || "hinglish";
  const glossary = product?.facts?.pronunciations?.[lang] ?? null; // the owner-confirmed spellings (Product check)
  const facts = { name: product?.name ?? prof.tagline ?? prof.name, benefits: product?.benefits ?? [], offer: custom || product?.offer || "" };
  const prompt = `You write short vertical Reels for an Indian small business. Write ONE 20-second reel. Return ONLY JSON.
Business / product: ${facts.name}. Benefits the owner claims: ${(facts.benefits ?? []).slice(0, 4).join("; ") || "-"}. Offer: ${facts.offer || "(none — do not invent one)"}.
Spoken lines and captions in: ${lang === "en" ? "simple Indian English" : lang === "hi" ? "Hindi in Devanagari" : "Hinglish (Hindi in Roman letters)"}.
RULES: exactly 4 scenes + 1 closing line. Each spoken line max 10 words. Scene 1 hooks with a question or a fact. One idea per scene. Never invent numbers, prices, awards or medical claims.
The LAST scene shows the owner's own product photo, so its line is the product line. The first three scenes must be everyday human moments — a person, a family, a home, a shop, hands, food, nature — NEVER a close-up of the product, a machine, a control panel, a screen or a gadget (stock footage of those is always the wrong product).
"caption_text" = 2-5 word on-screen keyword. "text_en" = the line's meaning in English. "search" = 2-4 plain English words naming the everyday visual to look for in royalty-free stock footage (e.g. "woman drinking water", "family eating dinner", "shopkeeper smiling"). "ai_prompt" = one English sentence describing the same moment as a photo of Indian people in an Indian home, shop or street.
JSON: {"scenes":[{"text":"","text_en":"","caption_text":"","search":"","ai_prompt":""}],"cta":"","caption":"<post caption + 5 hashtags>"}`;
  let plan = null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.PLAN_MODEL || "gemini-3.5-flash"}:generateContent`, { method: "POST", headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 8192 } }), signal: AbortSignal.timeout(45000) }).then((x) => x.json());
    const t = String(r.candidates?.[0]?.content?.parts?.[0]?.text ?? ""); plan = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  } catch { /* handled below */ }
  if (!Array.isArray(plan?.scenes) || !plan.scenes.length) return null;
  const img = product?.photo_url || (Array.isArray(product?.photos) ? product.photos.find((x) => x?.role !== "context")?.url : "") || "";
  const scenes = plan.scenes.slice(0, 4).map((s, i) => ({ text: String(s.text ?? "").slice(0, 200), text_en: String(s.text_en ?? "").slice(0, 200), caption_text: String(s.caption_text ?? "").slice(0, 40), search: String(s.search ?? "").slice(0, 60), ai_prompt: String(s.ai_prompt ?? "").slice(0, 300), source: i === 3 && img ? "image" : "auto", image: i === 3 && img ? img : "" }));
  const input = { tier: "stock", product: facts.name, lang, length: 20, voice: true, voiceStyle: prof.layout?.voice?.gender === "male" ? "warm" : "warmf", music: "calm-ambient", captions: "words", template: "clean", brandName: prof.tagline || prof.name, phone: prof.phone || "", formats: ["reel"], glossary, scenes, ai_ok: allowAi, cta: String(plan.cta ?? "").slice(0, 200), caption: String(plan.caption ?? "").slice(0, 600), reserved_ai: scenes.filter((x) => x.source === "auto").length, auto_plan: true }; // platform-paid AI scenes when stock has no fitting clip
  const row = (await rest(`media_jobs`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: userId, kind: "ad", status: "queued", cost: 0, input }) }))?.[0];
  return row?.id ?? null;
}
/** Wait for a queued reel to finish (the worker polls every ~8 s; a photo reel takes 1-3 min). */
export async function waitForReel(rest, jobId, maxMs = 6 * 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await sleep(10000);
    const j = (await rest(`media_jobs?id=eq.${jobId}&select=status,output_url,error,input`))?.[0];
    if (j?.status === "done" && j.output_url) return { url: j.output_url, caption: j.input?.caption ?? "" };
    if (j?.status === "failed") throw new Error(j.error || "reel failed");
  }
  return null;
}
