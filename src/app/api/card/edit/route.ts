// POST (bearer) { card, instruction, lang } → { ops, summary }: the owner's words about their website turned into
// a few checked operations (card-edits.ts). The card is applied and published by the app, never here.
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-security";
import { userFromRequest } from "@/lib/poster-server";
import { editOpsFor } from "@/lib/card-edit-ai";
import type { Card } from "@/lib/types";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`card-edit:${me.id}`, 60, 60 * 60_000)) return NextResponse.json({ error: "Too many changes in an hour. Please wait a little." }, { status: 429 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const b = await request.json().catch(() => ({})) as { card?: Card; instruction?: string; lang?: string };
  const card = b.card && typeof b.card === "object" && Array.isArray(b.card.pages) ? b.card : null;
  const instruction = typeof b.instruction === "string" ? b.instruction.trim().slice(0, 600) : "";
  if (!card || !instruction) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const lang = b.lang === "hi" ? "hi" : b.lang === "hinglish" ? "hinglish" : "en";
  const r = await editOpsFor(card, instruction, lang, `card-edit:${me.id.slice(0, 8)}`);
  if (!r) return NextResponse.json({ error: "The AI did not respond. Please try again." }, { status: 502 });
  return NextResponse.json(r);
}
