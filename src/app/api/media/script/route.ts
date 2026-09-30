// Studio: turn a rough idea (or a first-draft script) into one ready-to-shoot
// reel scripts. Free — the model call costs a fraction of a rupee and a good
// script is what makes the paid reel worth buying.

import { geminiComplete } from "@/lib/gemini";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";

type Option = { style: string; hook: string; script: string; headline: string; caption: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, "media-script"), 20, 10 * 60_000)) {
    return Response.json({ error: "Please wait a moment and try again." }, { status: 429 });
  }

  const b = await request.json().catch(() => ({}));
  const idea = String(b.idea ?? "").trim().slice(0, 600);
  if (idea.length < 5) return Response.json({ error: "Apna idea ya draft likhein." }, { status: 400 });
  const business = String(b.business ?? "").trim().slice(0, 120);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });

  const prompt = `You write short vertical reel scripts for Indian small businesses.

BUSINESS: ${business || "(not given)"}
THE OWNER'S IDEA / ROUGH DRAFT: ${idea}

If the idea names a specific real product, brand or model (not just a category), search the web first to check its actual features/specs before writing — so the script gets real details right instead of vague filler. Skip search entirely for generic ideas with no named product.

Write ONE script for a 15-25 second reel — your single best take, not a set of options. It must:
- open with a hook line that stops the scroll in the first 2 seconds — a surprising number, a sharp question, or a moment the viewer recognises from their own home
- be spoken aloud as a voiceover — so write it the way a person speaks, not like an ad banner
- run 45-70 words total (this is a hard limit; longer scripts get cut off)
- build one clear emotional thread from hook to close, and end with ONE clear action (WhatsApp message, free demo, call)
- use the SAME language and script as the owner's idea above (Hinglish in Roman letters stays Hinglish in Roman letters; Hindi in Devanagari stays Devanagari; English stays English)
- make no medical claims, no guaranteed-income claims, and invent no prices, offers or customer numbers — state a product's real, search-verified features but never a price or offer the owner did not give

After any research, respond with ONLY valid JSON, no markdown fence, no text before or after it:
{"options":[{"style":"best","hook":"...","script":"...","headline":"...","caption":"..."}]}
where headline is 3-5 words for the video's title card, and caption is a short social-post caption with 3-5 relevant hashtags.`;

  try {
    const { text, blocked } = await geminiComplete({
      apiKey: key,
      maxOutputTokens: 2000,
      webSearch: true,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    if (blocked || !text) throw new Error("blocked or empty response");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON in response: " + text.slice(0, 200));
    const json = text.slice(start, end + 1);
    const parsed = JSON.parse(json) as { options?: Option[] };
    const options = (parsed.options ?? []).slice(0, 1).filter((o) => o?.script?.trim());
    if (!options.length) throw new Error("zero valid options parsed");
    return Response.json({ options });
  } catch (e) {
    console.error("[media/script] generation failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "The script could not be made — please try again." }, { status: 502 });
  }
}
