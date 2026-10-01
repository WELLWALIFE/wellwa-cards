// "Ask about this screen" — the Help sheet's middle step, between reading the steps and calling a person.
//
// It answers about USING the app: where a button is, why the card is still empty, what Publish does. It is
// given the screen the person is on and the written steps for it, plus Shubhora's own facts, so it answers
// about the thing in front of them instead of guessing. It is told to hand over to live help rather than
// invent an answer — a wrong instruction wastes more of their time than "ask someone" does.

import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { clientKey, rateLimited } from "@/lib/api-security";
import { geminiComplete } from "@/lib/gemini";
import { helpFor, screenName } from "@/lib/help-screens";
import { SHUBHORA_KNOWLEDGE, SHUBHORA_SUPPORT } from "../../../../../bridge/shubhora-kb.mjs";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "sign in" }, { status: 401 });
  if (rateLimited(clientKey(request, "help-ask"), 20, 10 * 60_000)) {
    return NextResponse.json({ reply: "", error: "Too many questions in a row — please try again in a few minutes." }, { status: 429 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4_000) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  const body = (await request.json().catch(() => ({}))) as { question?: unknown; path?: unknown; lang?: unknown };
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : "/poster";
  const hindi = body.lang !== "en";
  if (!question) return NextResponse.json({ error: "Write your question." }, { status: 400 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({
      reply: hindi
        ? `अभी AI उपलब्ध नहीं है। “Live help बुलाएँ” दबाइए, या Shubhora सपोर्ट: ${SHUBHORA_SUPPORT.phone}।`
        : `The assistant is unavailable right now. Tap “Call for live help”, or contact Shubhora support: ${SHUBHORA_SUPPORT.phone}.`,
    });
  }

  const screen = helpFor(path);
  const here = screen
    ? `THE SCREEN THEY ARE ON: ${screen.title.en} (${path})
What it is for: ${screen.what.en}
The steps on it: ${screen.steps.map((s, i) => `${i + 1}. ${s.en}`).join(" ")}${screen.mistake ? `
The usual mistake here: ${screen.mistake.en}` : ""}`
    : `THE SCREEN THEY ARE ON: ${screenName(path)} (${path}) — nothing written for it.`;

  const system = `You are the in-app helper inside Shubhora, the app this person is using right now on their phone.
They are not a developer. Most are shop owners, agents, doctors and freelancers in India making their first
digital card and website. Many are not confident with apps at all.

${here}

ABOUT SHUBHORA (official, current):
${String(SHUBHORA_KNOWLEDGE).slice(0, 4000)}

HOW TO ANSWER
- Answer in ${hindi ? "simple Hindi written in the Devanagari script, the way people actually speak (English words like card, link, button are fine)" : "simple English"}.
- 2 to 4 short lines. No lists unless they asked for steps.
- Be concrete about THIS screen: name the button they should press and where it is.
- Never invent a button, a screen, a price or a feature. If you are not sure, say so and tell them to tap
  "${hindi ? "Live help बुलाएँ" : "Call for live help"}" at the bottom of this Help box — a person will look at their screen with them.
- If they seem stuck on something money-related, an account problem or a payment, send them to Shubhora
  support: ${SHUBHORA_SUPPORT.phone}.
- Never ask for a password, an OTP, a card number or a bank detail.`;

  try {
    const { text, blocked } = await geminiComplete({
      apiKey: key, maxOutputTokens: 400, system,
      contents: [{ role: "user", parts: [{ text: question }] }],
    });
    const reply = blocked ? "" : text.trim();
    return NextResponse.json({
      reply: reply || (hindi
        ? "मैं इसका पक्का जवाब नहीं दे पा रहा। नीचे “Live help बुलाएँ” दबाइए — कोई आपकी screen देखकर बता देगा।"
        : "I can't answer that confidently. Tap “Call for live help” below and someone will look at your screen with you."),
    });
  } catch {
    return NextResponse.json({
      reply: hindi
        ? "अभी जवाब नहीं मिल पाया। फिर से कोशिश करें, या “Live help बुलाएँ” दबाइए।"
        : "That didn't go through. Try again, or tap “Call for live help”.",
    });
  }
}
