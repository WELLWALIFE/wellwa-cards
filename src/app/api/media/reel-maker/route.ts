// Reel Maker — separate from ads. Stock royalty-free clips + the owner's own images + API voice. No AI video, no credits.
//   POST { action:"plan", ... }   → script with a stock-search phrase per scene (free)
//   POST { action:"create", ... } → queues the reel (free, daily limit)
import { NextResponse } from "next/server";
import { requireUser, sameOrigin, rateLimited, clientKey, workerAlive, WORKER_DOWN } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { LANG_RULE } from "@/lib/media/ad-planner";
import { VOICE_KEYS } from "@/lib/media/voices";
import type { ProductFacts } from "@/lib/media/product-facts";

export const maxDuration = 60;
const S = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const TYPES: Record<string, string> = { tip: "a useful tip or fact the audience will want to save and share (education first, product last)", benefit: "one clear benefit of the product or service in everyday life", offer: "the owner's offer, stated plainly with urgency (only the offer text given — never invent one)", review: "a happy-customer story told in third person (no invented names or numbers)", festival: "a warm festival greeting that gently connects to the business", story: "a short relatable everyday story that ends with the business as the answer" };
const DAILY_FREE = 3;
const AI_SCENE_CREDITS = 1; // one generated picture ≈ ₹6 → 1 credit; stock clips and own images stay free

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser(); if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const admin = getAdminSupabase(); if (!admin) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const b = await request.json().catch(() => ({})); const uid = session.user.id;
  const lang = LANG_RULE[String(b.lang)] ? String(b.lang) : "hinglish";
  const length = [10, 15, 20, 30].includes(Number(b.length)) ? Number(b.length) : 15; const n = length <= 10 ? 2 : length <= 15 ? 3 : length <= 20 ? 4 : 5;
  let facts: ProductFacts | null = null;
  if (typeof b.product_id === "string" && /^[0-9a-f-]{36}$/i.test(b.product_id)) { const { data } = await admin.from("poster_products").select("facts").eq("id", b.product_id).eq("user_id", uid).single(); if ((data?.facts as ProductFacts)?.v === 1) facts = data!.facts as ProductFacts; }

  if (b.action === "plan") {
    if (rateLimited(clientKey(request, `reel-plan:${uid}`), 30, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
    const type = TYPES[String(b.type)] ? String(b.type) : "tip";
    const prompt = `You write short vertical Reels for an Indian small business. Write ONE ${length}-second reel. Return ONLY JSON.
Business / product: ${S(b.business, 80) || "-"}. Category: ${S(b.category, 40) || "-"}. Topic from the owner: ${S(b.topic, 300) || "(choose a good one for this category)"}.
Reel type: ${type} — ${TYPES[type]}.
${facts ? `Facts you may use (never invent others): ${JSON.stringify({ what: facts.what_it_is, benefits: facts.benefits, proof: facts.proof, offers: facts.offers, never_claim: facts.banned_claims })}` : "Never invent numbers, prices, awards or medical claims."}
Offer: ${S(b.offer, 120) || "(none — do not invent one)"}. Phone shown on the end card: ${b.phone ? "yes" : "no"}.
Spoken lines and captions in: ${LANG_RULE[lang]}
RULES: exactly ${n} scenes + 1 closing line. Each spoken line is short — about 3-4 seconds (max 10 words). Scene 1 is a hook: a question, a number or a surprising fact. One idea per scene. "caption_text" = 2-5 word on-screen keyword card. "text_en" = the plain English meaning of the line (used only to choose the video). "ai_prompt" = one ENGLISH sentence describing a photo of Indian people or an Indian place that would illustrate the line (who, doing what, where) — no brands, no text. "search_alt" = a 2-4 word ENGLISH phrase for a fallback clip WITHOUT people (objects, hands, food, nature, a room) that still fits the line. "search" = a 2-4 word ENGLISH phrase to find a matching royalty-free stock video (everyday visuals like "woman drinking water", "indian family breakfast", "shop owner smiling", "morning kitchen sunlight") — generic footage only, never a brand or a specific product. The closing line is the only one that asks to call / WhatsApp${b.phone ? "" : " (say 'message us', no number)"}.
JSON: {"title":"<max 6 words>","scenes":[{"text":"","text_en":"","caption_text":"","search":"","search_alt":"","ai_prompt":""}],"cta":"","caption":"<post caption 1-2 lines + 5 hashtags>"}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.PLAN_MODEL || "gemini-3.5-flash"}:generateContent`, { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 8192 } }), signal: AbortSignal.timeout(45000) }).then((x) => x.json()).catch(() => null);
    try {
      const t = String(r?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""); const plan = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      if (!Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error("no scenes");
      return NextResponse.json({ plan: { title: S(plan.title, 60), scenes: plan.scenes.slice(0, n).map((x: Record<string, unknown>) => ({ text: S(x.text, 200), caption_text: S(x.caption_text, 40), search: S(x.search, 60), search_alt: S(x.search_alt, 60), text_en: S(x.text_en, 200), ai_prompt: S(x.ai_prompt, 300), source: "auto", image: "" })), cta: S(plan.cta, 200), caption: S(plan.caption, 600) } });
    } catch { return NextResponse.json({ error: r?.error?.message ? "AI is not available right now — please try again." : "Could not write the script — try again." }, { status: 502 }); }
  }

  if (b.action === "create") {
    const okUrl = (u: unknown) => typeof u === "string" && /^https:\/\//.test(u) && u.includes("/storage/v1/object/public/media/") && u.length < 500;
    const scenes = (Array.isArray(b.scenes) ? b.scenes : []).slice(0, 6).map((x: Record<string, unknown>) => ({ text: S(x.text, 200), caption_text: S(x.caption_text, 40), search: S(x.search, 60), search_alt: S(x.search_alt, 60), text_en: S(x.text_en, 200), ai_prompt: S(x.ai_prompt, 300), source: okUrl(x.image) ? "image" : x.source === "ai" ? "ai" : x.source === "stock" ? "stock" : "auto", image: okUrl(x.image) ? String(x.image) : "" })).filter((x: { text: string }) => x.text);
    if (!scenes.length) return NextResponse.json({ error: "Write the script first." }, { status: 400 });
    const { count: active } = await admin.from("media_jobs").select("id", { count: "exact", head: true }).eq("owner_id", uid).in("status", ["queued", "running"]);
    if ((active ?? 0) > 0) return NextResponse.json({ error: "A video is already being made — please wait for it to finish." }, { status: 429 });
    const day = new Date(); day.setUTCHours(0, 0, 0, 0);
    const { count: today } = await admin.from("media_jobs").select("id", { count: "exact", head: true }).eq("owner_id", uid).eq("kind", "ad").eq("input->>tier", "stock").gte("created_at", day.toISOString());
    if ((today ?? 0) >= DAILY_FREE) return NextResponse.json({ error: `You have made ${DAILY_FREE} reels today. Come back tomorrow.` }, { status: 429 });
    const input = { tier: "stock", product: S(b.title, 60) || S(b.business, 60) || "Reel", topic: S(b.topic, 300), scenes, cta: S(b.cta, 200), caption: S(b.caption, 600), lang, length, voice: b.voice !== false, voiceStyle: VOICE_KEYS.includes(b.voiceStyle) ? b.voiceStyle : "warm", music: /^[a-z0-9-]{0,40}$/i.test(String(b.music ?? "")) ? String(b.music ?? "") : "", captions: b.captions === "off" ? "off" : "words", template: "clean", brandName: S(b.brandName, 40), phone: S(b.phone, 20), website: S(b.website, 60), logoUrl: okUrl(b.logoUrl) ? b.logoUrl : "", formats: ["reel"], glossary: facts?.pronunciations?.[lang] ?? null };
    // "auto" scenes may become AI scenes (when no fitting stock clip exists): reserve their credits if the balance allows; unused ones are returned.
    const fixedAi = scenes.filter((x: { source: string }) => x.source === "ai").length; const autoN = scenes.filter((x: { source: string }) => x.source === "auto").length;
    const { data: bal } = await session.supabase.rpc("my_credits"); const balance = Number(bal) || 0;
    const reserve = balance >= (fixedAi + autoN) * AI_SCENE_CREDITS ? autoN : 0;
    (input as Record<string, unknown>).reserved_ai = reserve;
    // Charge only when the render can actually happen. This also spares a free reel (cost 0) from
    // being queued to a worker that is not there — the owner is told to come back in a minute
    // instead of watching a video that never starts, and today's free count is not used up.
    if (!(await workerAlive(admin))) return NextResponse.json({ error: WORKER_DOWN }, { status: 503 });
    const cost = (fixedAi + reserve) * AI_SCENE_CREDITS; const id = crypto.randomUUID();
    if (cost > 0) { const { error: spendErr } = await admin.rpc("spend_credits", { p_user: uid, p_amount: cost, p_reason: "reel-ai-scenes", p_ref: id }); if (spendErr) return NextResponse.json({ error: spendErr.message.includes("INSUFFICIENT_CREDITS") ? `Not enough credits for the AI scenes (${cost} needed). Switch them to stock clips or add credits.` : "Could not charge credits.", cost }, { status: 402 }); }
    const { data: job, error } = await admin.from("media_jobs").insert({ id, owner_id: uid, kind: "ad", status: "queued", input, cost }).select("id").single();
    // The engine's words go to the log, never to the phone — a shopkeeper must not read
    // 'duplicate key value violates unique constraint "media_jobs_pkey"'.
    if (error || !job) {
      if (cost > 0) await admin.rpc("grant_credits", { p_user: uid, p_amount: cost, p_reason: "ad-refund", p_ref: id });
      console.error("[reel-maker] queue insert failed", id, error);
      return NextResponse.json({ error: cost > 0 ? "The reel could not be started. Your credits have been returned." : "The reel could not be started. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, jobId: job.id, charged: cost, left_today: DAILY_FREE - (today ?? 0) - 1 });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
