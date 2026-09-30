// Ad Builder — AI production plan from a structured brief. The user reviews
// the plan once; the engines then render exactly what was approved.
import { NextResponse } from "next/server";
import { requireUser, rateLimited, clientKey, workerAlive } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AD_LENGTHS, REALISTIC_MAX_LENGTH } from "@/lib/media/ad-pricing";
import type { Card } from "@/lib/types";
import { planScripts } from "@/lib/media/ad-planner";
import type { ProductFacts } from "@/lib/media/product-facts";

export const maxDuration = 90;
const S = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const LANG_RULE: Record<string, string> = {
  hi: "Hindi in Devanagari script only (brand/product names may stay in Latin).",
  hinglish: "Hinglish — conversational Hindi written in Roman/Latin letters (e.g. 'Aaj hi demo book karein'), never Devanagari.",
  en: "Simple Indian English.",
  mr: "Marathi in Devanagari script (brand/product names may stay in Latin).",
  gu: "Gujarati in Gujarati script (brand/product names may stay in Latin).",
  pa: "Punjabi in Gurmukhi script (brand/product names may stay in Latin).",
  bn: "Bengali in Bengali script (brand/product names may stay in Latin).",
  ta: "Tamil in Tamil script (brand/product names may stay in Latin).",
  te: "Telugu in Telugu script (brand/product names may stay in Latin).",
  kn: "Kannada in Kannada script (brand/product names may stay in Latin).",
  ml: "Malayalam in Malayalam script (brand/product names may stay in Latin).",
  or: "Odia in Odia script (brand/product names may stay in Latin).",
};

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `ad-plan:${session.user.id}`), 40, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const key = process.env.GEMINI_API_KEY; if (!key) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const brief = {
    product: S(b.product, 80), category: S(b.category, 40), goal: S(b.goal, 30) || "leads", audience: S(b.audience, 160), lang: LANG_RULE[String(b.lang)] ? String(b.lang) : "hinglish",
    length: (AD_LENGTHS as readonly number[]).includes(Number(b.length)) ? Number(b.length) : 10, tone: S(b.tone, 30) || "warm", offer: S(b.offer, 120), phone: S(b.phone, 20), brand: S(b.brandName, 60),
    features: (Array.isArray(b.features) ? b.features : []).map((x: unknown) => S(x, 80)).filter(Boolean).slice(0, 6), notes: S(b.notes, 600), tier: b.tier === "realistic" ? "realistic" : "template",
  };
  if (brief.tier === "realistic" && brief.length > REALISTIC_MAX_LENGTH) brief.length = REALISTIC_MAX_LENGTH;
  if (!brief.product) return NextResponse.json({ error: "Enter the product name." }, { status: 400 });
  const scenes = brief.tier === "realistic"
    ? (brief.length <= 10 ? 2 : brief.length <= 20 ? 4 : 6)
    : (brief.length <= 10 ? 2 : brief.length <= 20 ? 3 : brief.length <= 30 ? 4 : brief.length <= 45 ? 5 : 6);

  const admin = getAdminSupabase();
  // Is the FREE storyboard really on offer right now? The phone screen may only say "free"
  // when the POST to /api/media/ad would actually take the pipeline-2 branch: that needs
  // AD_PIPELINE_V2=1 AND a live worker reporting the ad_v2 capability (ad/route.ts:73, 82).
  // Without both, the POST falls through to the immediate charge — so the label must say paid.
  // The one extra read only happens for a realistic brief with the flag on.
  const storyboard = brief.tier === "realistic" && process.env.AD_PIPELINE_V2 === "1" && !!admin && (await workerAlive(admin, true));

  // New planner: three scripts written from the owner's confirmed product facts, gated and ranked.
  if (admin && typeof b.product_id === "string" && /^[0-9a-f-]{36}$/i.test(b.product_id)) {
    const { data: prod } = await admin.from("poster_products").select("facts, facts_version").eq("id", b.product_id).eq("user_id", session.user.id).single();
    const pf = prod?.facts as ProductFacts | undefined;
    if (pf?.v === 1 && pf.label) {
      const scripts = await planScripts({ tier: brief.tier, length: brief.length, lang: brief.lang, goal: ["leads", "offer", "awareness", "festival", "transformation"].includes(brief.goal) ? brief.goal : "leads", audience: brief.audience, tone: brief.tone, offer: brief.offer, phone: brief.phone, brand: brief.brand, notes: brief.notes, speak_number: b.speak_number === true }, pf);
      if (!scripts.length) return NextResponse.json({ error: "Could not write scripts — try again." }, { status: 502 });
      const best = scripts[0].script;
      const plan = { headline: best.headline, scenes: best.scenes.map((x) => ({ text: x.text, caption_text: x.caption, visual: "", motion: "" })), cta: best.cta.text, caption: best.post_caption, features: best.features, voice: best.voice, music: best.music, template: best.template, questions: best.questions };
      return NextResponse.json({ plan, scripts, brief, storyboard, facts_version: prod?.facts_version ?? 0 });
    }
  }
  let facts = "";
  if (admin) {
    const { data } = await admin.from("cards").select("data").eq("owner_id", session.user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const c = (data?.data as Card | null) ?? null;
    if (c) facts = `\nOWNER'S BUSINESS (from their digital card): ${c.company || ""} — ${c.tagline || ""}. ${c.about || ""}\n${c.botKnowledge ? "Their own notes/prices/FAQ (use these facts, never invent): " + c.botKnowledge.slice(0, 2500) : ""}`;
  }
  const prompt = `You are an award-winning Indian ad director. Plan a ${brief.length}-second vertical ${brief.tier === "realistic" ? "live-action" : "motion-graphics"} ad. Return ONLY JSON.

BRIEF
Product: ${brief.product}${brief.category ? ` (${brief.category})` : ""}
Brand: ${brief.brand || "-"}
Goal: ${brief.goal} (leads = get WhatsApp enquiries; offer = push an offer; awareness = introduce; festival = festive greeting + product; transformation = a BEFORE → AFTER story: the first half of the scenes show the problem / "before" state without the product, the second half show the result / "after" with the product — make the contrast vivid, specific and truthful, no exaggerated claims)
Audience: ${brief.audience || "Indian families and small-business owners"}
Tone: ${brief.tone}
Language of all spoken/written lines: ${LANG_RULE[brief.lang]}
Offer: ${brief.offer || "(none — do not invent one)"}
Call/WhatsApp: ${brief.phone || "(none)"}
Known features: ${brief.features.join("; ") || "(use what the photo/facts show)"}
Extra notes from owner: ${brief.notes || "-"}${facts}

RULES
- Exactly ${scenes} scenes + a final CTA line. Each spoken line about ${Math.round((brief.length * 2.3) / (scenes + 1))} words (±3); total spoken words ≈ ${Math.round(brief.length * 2.3)}. Scene 1 must hook in 2 seconds (a question, a number, a pain). Only the final "cta" line may mention calling/WhatsApp/the phone number (and only if a phone number was given) — the scene lines must stay focused on the product/benefit/story and must NOT repeat a call-to-action.
- "visual": ENGLISH image-generation prompt for ONE photorealistic shot — real Indian people/home/shop, specific framing and light, the product clearly present, no text on screen. "motion": ENGLISH one-line camera/subject motion for a 5-second clip.
- "caption_text": the on-screen caption for that scene in the brief's language (max 8 words).
- "features": 4 punchy 2-3 word ENGLISH benefit labels for icons.
- Truthful: no medical/cure claims, no guaranteed income, no invented prices or discounts.
- If something essential is missing so that guessing would ruin the ad, put up to 2 short questions (in the brief's language) in "questions" and still return your best-guess plan.

JSON shape:
{"headline":"<max 6 words, brief language>","hook":"<scene 1 line>","scenes":[{"text":"<spoken line>","caption_text":"<on-screen>","visual":"<english prompt>","motion":"<english motion>"}],"cta":"<final spoken line>","caption":"<social post caption 1-2 lines + 5 hashtags>","features":["..",".."],"voice":"male|female","music":"upbeat-corporate|festive-diwali|calm-ambient|energetic-promo|inspiring-motivational|indian-sitar","template":"bold|clean|festive|offer|trust|fresh","questions":[]}`;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 1800 } }) });
  const j = await r.json().catch(() => ({}));
  try {
    const plan = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    if (!Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error("no scenes");
    plan.scenes = plan.scenes.slice(0, scenes);
    return NextResponse.json({ plan, brief, storyboard });
  } catch { return NextResponse.json({ error: "The AI plan could not be made — please try again." }, { status: 502 }); }
}
