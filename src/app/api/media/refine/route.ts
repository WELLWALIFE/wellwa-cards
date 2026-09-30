// POST { text, lang?, business?, seconds? } → { text } — the owner's OWN words, read back cleaner.
// This is not a writer: it keeps their meaning, their facts and their language, and only fixes what makes text hard
// to listen to (run-on lines, repeated words, missing breaks). The length may move a little either way; when the
// video has a fixed number of seconds it is also trimmed to fit, because an over-long script gets cut mid-sentence.
// Free — the model call costs a fraction of a rupee, and a clean script is what makes the paid video worth buying.
import { geminiComplete } from "@/lib/gemini";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";

export const maxDuration = 60;
const MAX = 9000;
const LANG_NAME: Record<string, string> = {
  hi: "Hindi in Devanagari script", hinglish: "Hinglish — Hindi written in Roman letters", en: "simple Indian English",
  mr: "Marathi", gu: "Gujarati", pa: "Punjabi", bn: "Bengali", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", or: "Odia",
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `refine:${session.user.id}`), 30, 10 * 60_000)) {
    return Response.json({ error: "Please wait a moment and try again." }, { status: 429 });
  }
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "AI is not configured yet." }, { status: 503 });

  const b = await request.json().catch(() => ({}));
  const text = String(b.text ?? "").trim().slice(0, MAX);
  if (text.length < 40) return Response.json({ error: "Write a few lines first, then tap Improve." }, { status: 400 });
  const business = String(b.business ?? "").trim().slice(0, 120);
  const lang = LANG_NAME[String(b.lang)] ? String(b.lang) : "";
  // Only for the fixed-length tiers; a long video is as long as the text, so nothing is trimmed there.
  const seconds = Math.min(60, Math.max(0, Number(b.seconds) || 0));
  const words = seconds ? Math.round((seconds / 60) * 150) : 0;

  const prompt = `A shop owner in India wrote the text below to be read aloud in their own video. Give it back improved.

${business ? `THEIR BUSINESS: ${business}\n` : ""}THEIR TEXT:
"""
${text}
"""

Rules:
- Keep THEIR meaning and THEIR facts. Never add a price, an offer, a number, a claim or a promise they did not write, and never drop one they did.
- Keep the same language and the same script they used${lang ? ` (${lang})` : ""} — Hinglish in Roman letters stays Hinglish in Roman letters, Devanagari stays Devanagari.
- Write it the way a person speaks out loud, not like a printed advertisement. Short sentences. No emoji, no hashtags, no stage directions, no headings, no bullet markers.
- Break it into short paragraphs with a blank line between them — each paragraph is one thought.
- Fix grammar, repeated words and run-on sentences. The length may change a little.
${words ? `- It is read aloud in ${seconds} seconds, so it must be about ${words} words — trim whatever matters least to fit.` : ""}
- No medical claims and no guaranteed-income claims.

Reply with the improved text only — nothing before it, nothing after it.`;

  try {
    const out = await geminiComplete({
      apiKey: process.env.GEMINI_API_KEY,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      maxOutputTokens: 4000,
    });
    // The model sometimes wraps the answer in quotes or a fence; the owner should never see that.
    const clean = out.text.replace(/^```[a-z]*\n?|```$/g, "").replace(/^"""|"""$/g, "").trim().slice(0, MAX);
    if (out.blocked || clean.length < 20) return Response.json({ error: "The AI could not improve this. Your text is unchanged." }, { status: 502 });
    return Response.json({ text: clean });
  } catch {
    return Response.json({ error: "The AI did not respond. Your text is unchanged." }, { status: 502 });
  }
}
