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
import type { Card, HeroVariant } from "@/lib/types";
import type { Lang } from "@/lib/card-facts";
import { HERO_VARIANTS_BY_BP, ownUpload } from "@/lib/site-hero";
import { tradeMood } from "@/lib/trade-moods";
import type { BlueprintKey } from "@/lib/site-blueprints";

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

Hero (docs/premium-look.md §7.3): no pill or chip shapes; the headline is a claim or the name, at most 2 lines, no slash; the trade word appears once; one filled CTA and one ghost; a trust row (rating · est. · open); facilities below the hero, not in it; the scrim only at the bottom of the photo; no emoji; one logo or wordmark. On a blueprint page the hero's SHAPE may change with set_style heroVariant, within that blueprint's own list given below — never a variant of another blueprint; "board-still" only with 4 or more of the owner's own product photos; "cover-centre" only for luxury trades and events.

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
{"op":"set_style","hero":"...","heroVariant":"...","pattern":"...","motion":"..."} (any of these keys)
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
  const variants = bp ? `Hero variants this blueprint can draw (set_style heroVariant): ${allowedVariants(o.card, bp).join(", ")}; it wears "${o.card.site?.style?.heroVariant ?? tradeMood(o.category).heroVariant[bp]}" now.` : "";
  const bpLine = bp === "bento" ? `This page is a BENTO board: a brand block (kicker, headline, one line, trust row, the CTA row) beside the photo tile, then strip tiles (open now, rating, map, offer). Check: no tile is empty or repeats another, every tile's text fits, the board reads top-left to bottom-right. The hero layout words (photo / editorial) do not apply here — never send set_style hero. ${variants}`
    : bp === "cinematic" ? `This page is CINEMATIC: a full-screen photo, the headline low over a bottom scrim, the top of the photo bright. Check: the headline is legible on the scrim, the top of the photo is not washed over, the rail of products shows whole cards, the photo bands between sections carry no text. Never send set_style hero. ${variants}`
    : bp === "story" ? `This page is a STORY: full-screen slides inside a phone frame beside the name and QR. Check: slide 1 has the headline, one line and ONE button, every slide is full (no slide with only a heading), the cover's headline is legible on its photo, the contact slide has its buttons. Never send set_style hero or move_block. ${variants}`
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
    const verdict = clean(v, o.card);
    // A miss is said out loud, with what came back, so it can be seen in the log rather than guessed at.
    if (!verdict) console.log("[card] design-review raw", JSON.stringify({ finish: j?.candidates?.[0]?.finishReason ?? null, parts: parts.length, text: out.slice(0, 240) }));
    return verdict;
  } catch {
    return null;
  }
}

/** The hero variants this card's blueprint may wear (docs/premium-look.md §3.7, §7.3): `board-still` only with four
 *  of the owner's own product photos, `cover-centre` only for luxury trades and events. */
function allowedVariants(card: Card, bp: BlueprintKey): HeroVariant[] {
  const products = card.pages.filter((p) => !p.hidden).flatMap((p) => p.blocks).flatMap((b) => (b.kind === "product" ? b.items : []));
  const stills = products.filter((p) => ownUpload(p.images?.[0] ?? p.imageUrl)).length;
  const cat = card.seo?.categoryKey ?? "";
  const luxe = !!tradeMood(cat).luxe || /^(event|wedding|banquet|hotel)$/.test(cat);
  return HERO_VARIANTS_BY_BP[bp].filter((v) => !(v === "board-still" && stills < 4) && !(v === "cover-centre" && !luxe));
}

function clean(v: unknown, card: Card): DesignReview | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const score = Math.max(1, Math.min(10, Math.round(Number(o.score) || 0)));
  const notes = Array.isArray(o.notes) ? o.notes.filter((n): n is string => typeof n === "string" && n.trim().length > 0).map((n) => n.trim().slice(0, 120)).slice(0, 4) : [];
  // `heroVariant` is not among the keys card-edits.ts cleans on set_style: it is read from the raw op here, gated to
  // the blueprint's list, and put back on the cleaned op (the apply step spreads every key into site.style).
  const bp = card.site?.style?.blueprint;
  const rawOps = Array.isArray(o.ops) ? (o.ops as unknown[]) : [];
  const wanted = rawOps.map((r) => (r && typeof r === "object" && (r as { op?: unknown }).op === "set_style" && typeof (r as { heroVariant?: unknown }).heroVariant === "string" ? ((r as { heroVariant: string }).heroVariant.trim().toLowerCase()) : ""));
  const okVariant = (x: string): x is HeroVariant => !!bp && (allowedVariants(card, bp) as string[]).includes(x);
  let styleSeen = 0;
  const ops = cleanOps(o.ops).filter((op) => ALLOWED.has(op.op)).map((op) => {
    if (op.op !== "set_style") return op;
    const idx = rawOps.findIndex((r, i) => i >= styleSeen && r && typeof r === "object" && (r as { op?: unknown }).op === "set_style");
    styleSeen = idx + 1;
    const want = idx >= 0 ? wanted[idx] : "";
    // The banner stays on top (owner's call, 4 Oct 2026): a hero change is kept only between photo and editorial.
    const { hero, ...rest } = op;
    const kept: EditOp = hero === "photo" || hero === "editorial" ? op : rest;
    return okVariant(want) ? ({ ...kept, heroVariant: want } as EditOp) : kept;
  }).filter((op) => op.op !== "set_style" || Object.keys(op).length > 1).slice(0, 5);
  if (!score && !ops.length) return null;
  return { score, notes, ops };
}
