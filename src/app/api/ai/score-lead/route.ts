// AI lead scoring: how likely is this lead to buy? Returns {score: 0-100, reason}.
// Env-gated: without GEMINI_API_KEY returns a simple heuristic score.

import { geminiComplete } from "@/lib/gemini";
import { clientKey, rateLimited, requireUser, sameOrigin } from "@/lib/api-security";

type Body = { name?: string; message?: string; source?: string };

function heuristic(b: Body): number {
  let s = 30;
  const m = (b.message || "").toLowerCase();
  if (/price|kimat|kitna|cost|emi|₹/.test(m)) s += 25;
  if (/demo|book|visit|dikhao|appointment/.test(m)) s += 30;
  if (/buy|kharid|order|chahiye/.test(m)) s += 25;
  if (b.source === "whatsapp") s += 10;
  return Math.min(95, s);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser();
  if (!session) return Response.json({ error: "sign in required" }, { status: 401 });
  if (rateLimited(clientKey(request, `lead-score:${session.user.id}`), 30, 60 * 60_000)) {
    return Response.json({ error: "AI hourly limit reached." }, { status: 429 });
  }
  const body = (await request.json()) as Body;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ score: heuristic(body), reason: "heuristic", demo: true });

  try {
    const { text } = await geminiComplete({
      apiKey: key,
      maxOutputTokens: 120,
      contents: [{
        role: "user",
        parts: [{ text: `Score this sales lead for a water-ionizer/wellness business (0-100, how likely to buy soon).
Signals: asking price/EMI/demo/booking = hot; vague greeting = cold; business-opportunity interest = warm.
Lead — name: ${body.name || "?"}, source: ${body.source || "form"}, message: "${(body.message || "").slice(0, 300)}"
Reply EXACTLY in this format:\nSCORE: <number>\nREASON: <max 8 words>` }],
      }],
    });
    const score = Math.max(0, Math.min(100, Number(text.match(/SCORE:\s*(\d+)/)?.[1] ?? heuristic(body))));
    const reason = text.match(/REASON:\s*(.+)/)?.[1]?.trim() ?? "";
    return Response.json({ score, reason });
  } catch {
    return Response.json({ score: heuristic(body), reason: "heuristic", demo: true });
  }
}
