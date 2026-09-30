// Hook-testing: 3 alternate opening lines for scene 1, so the user can try a
// different angle (question / number / pain-point) without re-planning the
// whole ad. Cheap — one small text call, no images.
import { NextResponse } from "next/server";
import { requireUser, rateLimited, clientKey } from "@/lib/api-security";

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
  if (rateLimited(clientKey(request, `ad-hook:${session.user.id}`), 40, 10 * 60_000)) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429 });
  const key = process.env.GEMINI_API_KEY; if (!key) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const product = S(b.product, 80), category = S(b.category, 40), tone = S(b.tone, 30) || "warm";
  const lang = LANG_RULE[String(b.lang)] ? String(b.lang) : "hinglish";
  const current = S(b.currentHook, 200);
  if (!product) return NextResponse.json({ error: "Enter the product name." }, { status: 400 });

  const prompt = `You write scroll-stopping openers for short Indian vertical ad videos. Product: "${product}"${category ? ` (${category})` : ""}. Tone: ${tone}. Language: ${LANG_RULE[lang]}
${current ? `The current opening line is: "${current}" — give 3 DIFFERENT alternatives, not rewordings of it.` : "Give 3 opening line options."}
Each must be a single spoken line, 6-14 words, hook the viewer in the first 2 seconds. Use 3 different angles: one a question, one a surprising number/fact, one a pain-point/relatable problem. Truthful — no invented stats, no medical/income claims.
Return ONLY JSON: {"hooks": ["<question angle>", "<number angle>", "<pain-point angle>"]}`;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: 400 } }) });
  const j = await r.json().catch(() => ({}));
  try {
    const raw = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const hooks = (Array.isArray(raw.hooks) ? raw.hooks : []).filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0).map((x: string) => x.trim()).slice(0, 3);
    if (!hooks.length) throw new Error("empty");
    return NextResponse.json({ hooks });
  } catch { return NextResponse.json({ error: "Hooks could not be made — please try again." }, { status: 502 }); }
}
