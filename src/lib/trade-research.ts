// What the public web says about a TRADE in a CITY, read once and handed to the website writer as background
// (owner, 14 Oct 2026: "user limited data dete hain — Google aur reference sites se data lekar unique data banao,
// site bahri-bahri lagni chahiye; text kam hota hai").
//
// The writer (card-ai.ts) may only state facts the owner gave about THIS business, so with a short form its text came
// out thin. This is the other half: general, public knowledge about the trade and the place — what buyers look for,
// what the usual things are called, how to choose, the questions people ask, what the market or area is known for —
// gathered with Google search and re-worded by the model, never copied from a page. It is background for the
// explanatory paragraphs, the FAQ and the service lines; it is never a claim about the business itself.
//
// Best effort: no key, a slow search or a bad reply returns null and the card is written from the facts alone.
// Cached in memory per trade + city (a day), so the second sweet shop in Rewari costs nothing.
import { geminiComplete } from "@/lib/gemini";

export type TradeResearch = {
  /** What the place or market is known for, as it relates to this trade (empty when nothing solid was found). */
  area: string;
  /** What buyers of this trade look for and compare. */
  looksFor: string[];
  /** The usual things this trade offers, by their real names, with what each is. */
  items: { name: string; note: string }[];
  /** Plain advice on choosing well. */
  howToChoose: string[];
  /** Questions people actually ask, from the search results' "people also ask". */
  questions: string[];
};

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; v: TradeResearch | null }>();

const list = (v: unknown, n: number, max: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max)).filter(Boolean).slice(0, n);

export async function researchTrade(trade: string, city: string | undefined, apiKey = process.env.GEMINI_API_KEY): Promise<TradeResearch | null> {
  const t = (trade ?? "").trim();
  if (!apiKey || !t || /^(other|business)$/i.test(t)) return null;
  const key = `${t}|${(city ?? "").trim()}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const place = city?.trim() ? ` in ${city.trim()}, India` : " in India";
  const prompt = `Search the web (Google) for a ${t}${place}: read what the leading websites of this trade — well-known brands, template sites, local listings — say, and what customers search for.

Then write BACKGROUND NOTES in your own words (never copy a sentence), as plain facts about the trade and the place, NOT about any one business:
- area: 1-2 sentences on what ${city?.trim() ? city.trim() + " (its market, localities or local taste)" : "the region"} is known for as it relates to a ${t}. Empty string if you found nothing solid.
- looksFor: 5-6 things customers of a ${t} compare before choosing (each at most 14 words).
- items: 6-8 of the usual things a ${t} offers, each with its real name and what it is or who it suits (note at most 22 words).
- howToChoose: 4-5 plain tips for choosing a good one (each at most 22 words).
- questions: 6-8 questions people really ask about this trade (each at most 14 words).

Rules: no prices, no numbers or statistics, no awards, no claims about any named business, no health or income claims, nothing you could not find or are unsure of. Plain English.
Return ONLY this JSON:
{"area":"","looksFor":[""],"items":[{"name":"","note":""}],"howToChoose":[""],"questions":[""]}`;
  let out: TradeResearch | null = null;
  try {
    const r = await Promise.race([
      geminiComplete({ apiKey, webSearch: true, maxOutputTokens: 1800, temperature: 0.2, tag: "trade-research", contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      new Promise<null>((res) => setTimeout(() => res(null), 25_000)),
    ]);
    if (r && !r.blocked && r.text) {
      const raw = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)) as Record<string, unknown>;
      const items = (Array.isArray(raw.items) ? raw.items : []).map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return { name: String(o.name ?? "").trim().slice(0, 60), note: String(o.note ?? "").replace(/\s+/g, " ").trim().slice(0, 160) };
      }).filter((x) => x.name && x.note).slice(0, 8);
      const v: TradeResearch = {
        area: String(raw.area ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
        looksFor: list(raw.looksFor, 6, 100),
        items,
        howToChoose: list(raw.howToChoose, 5, 160),
        questions: list(raw.questions, 8, 100),
      };
      // Numbers and prices are a claim, whatever the source: a line carrying a digit is dropped.
      const noNum = (s: string) => !/\d/.test(s);
      v.looksFor = v.looksFor.filter(noNum); v.howToChoose = v.howToChoose.filter(noNum); v.questions = v.questions.filter(noNum);
      v.items = v.items.filter((x) => noNum(`${x.name} ${x.note}`));
      if (!noNum(v.area)) v.area = "";
      if (v.items.length || v.looksFor.length || v.howToChoose.length || v.questions.length) out = v;
    }
  } catch { /* best effort */ }
  cache.set(key, { at: Date.now(), v: out });
  return out;
}

/** The notes as the writer's prompt block. */
export function researchText(r: TradeResearch): string {
  return [
    r.area && `The place: ${r.area}`,
    r.looksFor.length && `What customers compare: ${r.looksFor.join(" | ")}`,
    r.items.length && `The usual things of this trade: ${r.items.map((x) => `${x.name} — ${x.note}`).join(" | ")}`,
    r.howToChoose.length && `How to choose well: ${r.howToChoose.join(" | ")}`,
    r.questions.length && `Questions people ask: ${r.questions.join(" | ")}`,
  ].filter(Boolean).join("\n");
}
