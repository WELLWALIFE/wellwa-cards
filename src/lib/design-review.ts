import "server-only";
// The designer looks at what it made (owner's call, 3 Oct 2026: "designer AI result nahi dekhta — use aankhein
// do"). After the card is built, the website is drawn in the browser on the server (render-page.ts) and the
// picture goes to a vision model with the page's outline. It answers with a score and at most five concrete
// fixes from a short, safe list — a headline that wraps to four lines, a hero that fights its photo, a thin
// section better removed, a pattern that muddies the picture. The fixes are applied as card edits
// (card-edits.ts), so the owner's undo and the chat editor see them the same way as any other change.
//
// Never changes prices, products, contact details or the owner's own words beyond the hero's headline and sub.
// One call, ~₹0.15 with the picture; skipped quietly when there is no browser, no key, or the model is slow.
import { cardOutline, cleanOps, type EditOp } from "@/lib/card-edits";
import { logUsage } from "@/lib/ai-usage";
import type { Card } from "@/lib/types";
import type { Lang } from "@/lib/card-facts";

const MODEL = "gemini-3.5-flash";
/** Only what a look can justify. Anything else the model proposes is dropped. */
const ALLOWED = new Set<EditOp["op"]>(["set_hero", "set_style", "remove_block", "move_block", "set_title"]);

export type DesignReview = {
  /** 1–10, the designer's own mark for the page as drawn. */
  score: number;
  /** What it saw, one line each, in the owner's language. */
  notes: string[];
  /** The fixes it chose, already validated. */
  ops: EditOp[];
};

const BRIEF = `You are a senior web designer reviewing a small-business website you designed, drawn exactly as a visitor sees it on a laptop. Look at the PICTURE first: the hero, how the headline sits against the photo or colour, whether text is readable, whether the first screen feels like this business and not a template, the rhythm of the sections that follow.

Fix only what the picture shows is wrong. Typical fixes:
- the headline wraps to 3+ lines or crowds the picture → set_hero with a shorter headline (≤ 6 words) and/or a shorter sub (≤ 18 words), same meaning, same language;
- the hero: the page opens on its banner photograph by the owner's rule, so the hero may only move between "photo" and "editorial" (the two that show the banner across the top) — never to split, stage, minimal, grid, person or marquee; fix a busy photo behind text with a shorter headline, not by hiding the banner;
- a background pattern that muddies the hero → set_style pattern "none" or a quieter one (dots, waves, grid, diagonal, blobs, rings);
- motion that distracts → set_style motion calm or none;
- a section whose title does not say what it holds → set_title;
- a section that is nearly empty or repeats the one above → remove_block;
- a section visibly out of order (contact before what is sold) → move_block.
Never touch prices, products, phone numbers, addresses or the owner's about text. Never change the palette or the font unless the text is unreadable in the picture. At most 5 fixes; zero is a fine answer when the page is good. The "FREE website by Shubhora" strips at the top and bottom are the platform's, not yours: ignore them.

Reply with one JSON object and nothing else: {"score": 1-10, "notes": ["what you saw, ≤ 12 words", ...] (≤ 4), "ops": [ ... ]}. Each op is one of:
{"op":"set_hero","headline":"...","sub":"..."} (either or both)
{"op":"set_style","hero":"...","pattern":"...","motion":"..."} (any of these keys)
{"op":"set_title","id":"<block id>","value":"..."}
{"op":"remove_block","id":"<block id>"}
{"op":"move_block","id":"<block id>","before":"<block id>" | null}
Block ids are in the outline below.`;

/** The designer's verdict and fixes, or null (no key, slow, or nothing usable). Never throws. */
export async function reviewDesign(o: { shot: Buffer; card: Card; lang: Lang; category?: string; timeoutMs?: number }): Promise<DesignReview | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const langLine = o.lang === "hi" ? "Write notes and any new headline/sub in Hindi (Devanagari)." : o.lang === "hinglish" ? "Write notes and any new headline/sub in Hinglish (Roman Hindi)." : "Write notes and any new headline/sub in English.";
  // The blueprint (docs/website-looks-v2.md §8): what this page's structure must look like, and what not to touch.
  const bp = o.card.site?.style?.blueprint;
  const bpLine = bp === "bento" ? "This page is a BENTO board: the hero is a grid of tiles (photo, name, call / WhatsApp, open now, rating, map, offer, product, since). Check: no tile is empty or repeats another, every tile's text fits, the board reads top-left to bottom-right. The hero layout words (photo / editorial) do not apply here — never send set_style hero."
    : bp === "cinematic" ? "This page is CINEMATIC: a full-screen photo under a dark gradient with the headline rising. Check: the headline is legible on the photo (the gradient is strong enough), the rail of products shows whole cards, the photo bands between sections carry no text. Never send set_style hero."
    : bp === "story" ? "This page is a STORY: full-screen slides inside a phone frame beside the name and QR. Check: every slide is full (no slide with only a heading), the cover's headline is legible on its photo, the contact slide has its buttons. Never send set_style hero or move_block."
    : "";
  const text = `Business: ${o.card.company || o.card.name}${o.category ? ` (${o.category})` : ""}. ${langLine}${bpLine ? `\n\n${bpLine}` : ""}\n\nOUTLINE (block ids in brackets):\n${cardOutline(o.card).slice(0, 6000)}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(o.timeoutMs ?? 30_000),
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BRIEF }] },
        contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: o.shot.toString("base64") } }, { text }] }],
        // 3.5-flash thinks before it answers and the thinking counts against this cap: 700 left no room for the
        // answer (every review came back "no verdict" at out≈684, 4 Oct 2026).
        generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 3000 },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    logUsage("design-review", MODEL, j?.usageMetadata);
    const parts = (j?.candidates?.[0]?.content?.parts ?? []) as { text?: unknown; thought?: unknown }[];
    const out = parts.filter((p) => typeof p?.text === "string" && !p.thought).map((p) => p.text as string).join("").trim();
    let v: unknown = null;
    try { v = JSON.parse(out); } catch { const a = out.indexOf("{"), z = out.lastIndexOf("}"); if (a >= 0 && z > a) { try { v = JSON.parse(out.slice(a, z + 1)); } catch { v = null; } } }
    const verdict = clean(v);
    // A miss is said out loud, with what came back, so it can be seen in the log rather than guessed at.
    if (!verdict) console.log("[card] design-review raw", JSON.stringify({ finish: j?.candidates?.[0]?.finishReason ?? null, parts: parts.length, text: out.slice(0, 240) }));
    return verdict;
  } catch {
    return null;
  }
}

function clean(v: unknown): DesignReview | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const score = Math.max(1, Math.min(10, Math.round(Number(o.score) || 0)));
  const notes = Array.isArray(o.notes) ? o.notes.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.trim().slice(0, 120)).slice(0, 4) : [];
  const ops = cleanOps(o.ops).filter((op) => ALLOWED.has(op.op)).map((op) => {
    // The banner stays on top (owner's call, 4 Oct 2026): a hero change is kept only between photo and editorial.
    if (op.op === "set_style" && op.hero && op.hero !== "photo" && op.hero !== "editorial") { const { hero: _h, ...rest } = op; void _h; return rest; }
    return op;
  }).filter((op) => op.op !== "set_style" || Object.keys(op).length > 1).slice(0, 5);
  if (!score && !ops.length) return null;
  return { score, notes, ops };
}
