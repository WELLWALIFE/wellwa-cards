// Studio: plan a reel BEFORE any credits are spent.
//
// This is the part a generic AI video tool cannot do: we already hold the
// owner's real products, prices, warranty wording and compliance rules, so the
// plan is grounded in their actual business instead of a guessed prompt. The
// owner sees every scene, edits what they want, and only then pays to render.
//
// Free — one cheap model call. Returns either a full plan, or the questions the
// AI still needs answered to make the plan good.

import { NextResponse } from "next/server";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { geminiComplete } from "@/lib/gemini";
import type { Card } from "@/lib/types";

type Scene = { beat: string; visual: string };
type Plan = {
  script: string;
  headline: string;
  caption: string;
  voice: string;
  scenes: Scene[];
  questions?: string[];
};

const PURPOSES: Record<string, string> = {
  product: "Sell a specific product — the product must be the hero of the film.",
  intro: "Introduce the brand and the person behind it — build trust, not a hard sell.",
  offer: "Push a current, already-approved offer or a free demo booking.",
  educate: "Teach one useful thing so the viewer trusts our expertise.",
  story: "A small real-life moment the viewer recognises from their own home.",
  business: "Invite the viewer to join as a distributor — opportunity, never guaranteed income.",
};

/** Everything we already know about this owner's business, from their own card. */
function businessFacts(card: Card | null): string {
  if (!card) return "";
  const products = card.pages
    .flatMap((p) => p.blocks)
    .filter((b): b is Extract<typeof b, { kind: "product" }> => b.kind === "product")
    .flatMap((b) => b.items)
    .map((p) => `- ${p.name}${p.price ? ` — ${p.price}` : ""}${p.desc ? `: ${p.desc}` : ""}`)
    .join("\n");
  return [
    `THE OWNER: ${card.name}, ${card.jobTitle} at ${card.company}. Tagline: ${card.tagline}`,
    card.about ? `About them: ${card.about}` : "",
    products ? `THEIR REAL PRODUCTS AND PRICES:\n${products}` : "",
    card.botKnowledge?.trim() ? `THEIR OWN NOTES:\n${card.botKnowledge.trim().slice(0, 4000)}` : "",
  ].filter(Boolean).join("\n\n");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `media-plan:${session.user.id}`), 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const idea = String(b.idea ?? "").trim().slice(0, 600);
  const purpose = PURPOSES[String(b.purpose ?? "")] ? String(b.purpose) : "product";
  const audience = String(b.audience ?? "").trim().slice(0, 200);
  const website = String(b.website ?? "").trim().slice(0, 120);
  const answers = String(b.answers ?? "").trim().slice(0, 800);  // replies to earlier questions
  const sceneCount = Math.min(5, Math.max(2, Number(b.sceneCount) || 4));
  if (idea.length < 3 && !answers) {
    return NextResponse.json({ error: "Apna idea likhein." }, { status: 400 });
  }

  // The owner's own card — our unfair advantage over a generic prompt box.
  let card: Card | null = null;
  const admin = getAdminSupabase();
  if (admin) {
    const { data } = await admin.from("cards")
      .select("data").eq("owner_id", session.user.id)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    card = (data?.data as Card) ?? null;
  }

  const prompt = `You are an award-winning Indian ad director planning a 20-30 second vertical reel.

PURPOSE OF THIS FILM: ${PURPOSES[purpose]}
${audience ? `WHO IT IS FOR: ${audience}\n` : ""}THE OWNER'S IDEA: ${idea || "(they only answered the questions below)"}
${answers ? `\nTHEY ALSO TOLD YOU:\n${answers}\n` : ""}
${businessFacts(card)}
${website ? `\nTheir website is ${website} — search it so the facts, product names and positioning are real, not invented.` : ""}

Plan the film shot by shot. Rules that decide whether this is good or throwaway:
- The script is spoken aloud, 45-70 words total, in the SAME language and script as the owner's idea (Hinglish in Roman stays Roman; Hindi in Devanagari stays Devanagari).
- Open on a moment or a number that stops the scroll in 2 seconds. Never open on a logo or a slogan.
- Exactly ${sceneCount} scenes. Scene N is what fills the screen while beat N is spoken, so its visual must carry that beat's exact meaning and mood.
- Each "visual" is a real image-generation prompt in ENGLISH: one photorealistic live-action shot, real people in a real Indian home or shop, specific camera framing and lighting, warm and aspirational. Never cartoonish, never comedic, no text on screen.
- Use the owner's REAL product names and prices from the facts above. Never invent a price, offer, discount or customer count.
- No medical claims (nothing treats, cures or prevents disease) and no guaranteed-income claims.

If — and only if — something genuinely important is missing and guessing would spoil the film (for example: which product this is for, what the offer actually is, or which city/season to show), then ask instead of guessing: return up to 3 short questions in "questions" and leave "scenes" empty. Otherwise return a full plan with "questions" empty.

Respond with ONLY valid JSON, no markdown fence:
{"script":"...","headline":"3-5 words","caption":"social caption with 3-5 hashtags","voice":"warm|clear|deep|friendly|smooth|expert|calm|warmf|youthful|soft|gentle|mature|lively","scenes":[{"beat":"the spoken sentence","visual":"the English image prompt"}],"questions":[]}`;

  try {
    const { text, blocked } = await geminiComplete({
      apiKey: key,
      maxOutputTokens: 4000,
      webSearch: Boolean(website),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    if (blocked || !text) throw new Error("blocked or empty response");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON: " + text.slice(0, 200));
    const plan = JSON.parse(text.slice(start, end + 1)) as Plan;

    const questions = (plan.questions ?? []).map((q) => String(q).slice(0, 200)).filter(Boolean).slice(0, 3);
    const scenes = (plan.scenes ?? [])
      .map((s) => ({ beat: String(s?.beat ?? "").slice(0, 300), visual: String(s?.visual ?? "").slice(0, 600) }))
      .filter((s) => s.visual)
      .slice(0, 5);
    if (!scenes.length && !questions.length) throw new Error("empty plan");

    return NextResponse.json({
      script: String(plan.script ?? "").slice(0, 900),
      headline: String(plan.headline ?? "").slice(0, 60),
      caption: String(plan.caption ?? "").slice(0, 400),
      voice: String(plan.voice ?? "warm").slice(0, 20),
      scenes,
      questions,
      usedCard: Boolean(card),
      brandName: card?.company || card?.name || "",
    });
  } catch (e) {
    console.error("[media/plan] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The plan could not be made — please try again." }, { status: 502 });
  }
}
