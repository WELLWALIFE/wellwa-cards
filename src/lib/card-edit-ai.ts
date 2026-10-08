// The owner's words about their website → a few checked operations (card-edits.ts), by one cheap text-AI call.
// Shared by the app's "Edit" chat (/api/card/edit) and the WhatsApp bot (wa-onboard.ts): the card is applied and
// published by the caller, never here.
import { cardOutline, cleanOps, type EditOp } from "@/lib/card-edits";
import { logUsage } from "@/lib/ai-usage";
import type { Card } from "@/lib/types";

const MODEL = "gemini-3.5-flash";
export type EditLang = "en" | "hi" | "hinglish";

export function editSystemPrompt(lang: EditLang): string {
  return `You edit a small business's website for its owner. You NEVER write the website: you choose from these operations and return them as JSON — the app applies and checks each one.
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
}

/** The operations for one request. `null` when the AI did not answer (the caller says "try again"). */
export async function editOpsFor(card: Card, instruction: string, lang: EditLang, tag: string): Promise<{ ops: EditOp[]; summary: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const text = `OUTLINE OF THE CURRENT WEBSITE\n${cardOutline(card).slice(0, 9000)}\n\nOWNER'S REQUEST\n${instruction.slice(0, 600)}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(40_000),
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: editSystemPrompt(lang) }] }, contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 2500 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    logUsage(tag, MODEL, j?.usageMetadata);
    const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { text?: unknown; thought?: unknown }[];
    const out = parts.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text as string).join("").trim();
    let v: { ops?: unknown; summary?: unknown } = {};
    try { v = JSON.parse(out); } catch { const a = out.indexOf("{"), z = out.lastIndexOf("}"); if (a >= 0 && z > a) { try { v = JSON.parse(out.slice(a, z + 1)); } catch { v = {}; } } }
    return { ops: cleanOps(v.ops), summary: typeof v.summary === "string" ? v.summary.trim().slice(0, 300) : "" };
  } catch { return null; }
}
