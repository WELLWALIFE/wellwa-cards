// POST (bearer) { card, instruction, lang } → { ops, summary }: the owner's words about their website turned into
// a few checked operations (card-edits.ts). The card is applied and published by the app, never here.
import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/api-security";
import { userFromRequest } from "@/lib/poster-server";
import { cardOutline, cleanOps } from "@/lib/card-edits";
import { logUsage } from "@/lib/ai-usage";
import type { Card } from "@/lib/types";

const MODEL = "gemini-3.5-flash";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (rateLimited(`card-edit:${me.id}`, 60, 60 * 60_000)) return NextResponse.json({ error: "Too many changes in an hour. Please wait a little." }, { status: 429 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const b = await request.json().catch(() => ({})) as { card?: Card; instruction?: string; lang?: string };
  const card = b.card && typeof b.card === "object" && Array.isArray(b.card.pages) ? b.card : null;
  const instruction = typeof b.instruction === "string" ? b.instruction.trim().slice(0, 600) : "";
  if (!card || !instruction) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const lang = b.lang === "hi" ? "hi" : b.lang === "hinglish" ? "hinglish" : "en";
  const system = `You edit a small business's website for its owner. You NEVER write the website: you choose from these operations and return them as JSON — the app applies and checks each one.
Operations (use block ids and page slugs from the OUTLINE exactly):
- {"op":"remove_block","id"} — remove a section
- {"op":"move_block","id","before": <block id on the same page> | null} — null = move to the end
- {"op":"set_title","id","value"}
- {"op":"set_text","id","value"} — the body of an about / offer / contact / cta section
- {"op":"set_item","id","index","name"?,"desc"?,"price"?} / {"op":"remove_item","id","index"} / {"op":"add_item","id","name","desc"?,"price"?}
- {"op":"set_hero","headline"?,"sub"?,"ctaLabel"?} — the top section
- {"op":"set_identity","tagline"?,"about"?,"company"?,"jobTitle"?}
- {"op":"set_style","palette"?,"font"?,"hero"?,"radius"?,"pattern"?,"motion"?} — palette: midnight, ocean, teal, emerald, royal, rose, crimson, saffron, gold, cocoa, steel, noir, ivory, pearl; font: modern, elegant, luxury, friendly, bold, editorial, tech, hindi; hero: split, photo, stage, minimal, grid, person, editorial, marquee; radius: sharp, soft, round; pattern: none, dots, waves, grid, diagonal, blobs, rings; motion: none, calm, lively
- {"op":"hide_page","slug"} / {"op":"show_page","slug"} / {"op":"rename_page","slug","label"}
- {"op":"set_table","id"?,"page"?,"title","columns":["Class","Fee per month"],"rows":[["Nursery–UKG","₹1,200"],["Class 1–5","₹1,500"]],"note"?} — a price list / fee table / tariff; with "id" it replaces that table, else it is added to "page" (a slug from the outline) or the products page
- {"op":"set_notice","text","sub"?,"label"?,"url"?,"mode"?: "bar"|"popup"|"both","until"?: "YYYY-MM-DD"} — news / an offer / a closure shown on the website and card ("admission open ki news lagao 30 April tak" → set_notice with until 2026-04-30); {"op":"clear_notice"} removes it
Rules: do only what was asked, with the fewest operations (at most 8). Write any new text in the website's language (${lang === "hi" ? "Hindi, Devanagari" : lang === "hinglish" ? "Hinglish" : "English"}), plain and specific to this business, no claims or numbers that are not in the outline or the instruction. If the request cannot be done with these operations, return no ops and say why in "summary". Reply with one JSON object: {"ops":[...],"summary":"one short line, in ${lang === "en" ? "English" : "Hinglish"}, of what you changed"}.`;
  const text = `OUTLINE OF THE CURRENT WEBSITE\n${cardOutline(card).slice(0, 9000)}\n\nOWNER'S REQUEST\n${instruction}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(40_000),
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 2500 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: "The AI did not respond. Please try again." }, { status: 502 });
    logUsage(`card-edit:${me.id.slice(0, 8)}`, MODEL, j?.usageMetadata);
    const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { text?: unknown; thought?: unknown }[];
    const out = parts.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text as string).join("").trim();
    let v: { ops?: unknown; summary?: unknown } = {};
    try { v = JSON.parse(out); } catch { const a = out.indexOf("{"), z = out.lastIndexOf("}"); if (a >= 0 && z > a) { try { v = JSON.parse(out.slice(a, z + 1)); } catch { v = {}; } } }
    const ops = cleanOps(v.ops);
    const summary = typeof v.summary === "string" ? v.summary.trim().slice(0, 300) : "";
    return NextResponse.json({ ops, summary });
  } catch {
    return NextResponse.json({ error: "The AI did not respond. Please try again." }, { status: 502 });
  }
}
