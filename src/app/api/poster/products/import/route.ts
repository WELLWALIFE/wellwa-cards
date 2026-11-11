// "Add many at once" (owner, 14 Oct 2026): a pasted list, a photo of a price list, or the usual things of the owner's
// trade → a list of {name, price, category} for the owner to look over. Nothing is saved here; /bulk saves what is kept.
import { NextResponse } from "next/server";
import sharp from "sharp";
import { userFromRequest } from "@/lib/poster-server";
import { isOwnMedia } from "@/lib/card-inputs";
import { rateLimited } from "@/lib/api-security";
import { geminiComplete } from "@/lib/gemini";

export const maxDuration = 60;
const MAX_BODY = 50_000;               // bytes: a pasted list is at most 6000 characters
const MAX_PHOTO = 15 * 1024 * 1024;    // bytes of a price-list photo that is read
type Item = { name: string; price: string; category: string; photo?: string };
const S = (v: unknown, n: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/\s+/g, " ").trim().slice(0, n);
const money = (v: unknown) => S(v, 30).replace(/^(?:₹|rs\.?|inr)\s*/i, "").trim();
const clean = (v: unknown): Item[] => {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v : []).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { name: S(o.name, 60), price: money(o.price), category: S(o.category, 30) }; })
    .filter((x) => x.name && !seen.has(x.name.toLowerCase()) && !!seen.add(x.name.toLowerCase())).slice(0, 40);
};
const parse = (text: string): unknown => { try { return JSON.parse(text.slice(text.search(/[\[{]/), Math.max(text.lastIndexOf("]"), text.lastIndexOf("}")) + 1)); } catch { return null; } };
const RULES = `Return ONLY JSON: {"items":[{"name":"","price":"","category":""}]}. Rules: name = the product or service as it is written (keep the script it is written in, at most 60 characters); price = only what is written, as text like "120" or "1,500 / kg" with no ₹ sign, or "" when none is written — never guess or invent a price; category = a short group the item belongs to if the source shows one (a heading, a section), else "". At most 40 items, no duplicates.`;

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "This is not available right now. Please add them one by one." }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return NextResponse.json({ error: "That list is too long. Please add a shorter one." }, { status: 413 });
  if (rateLimited(`product-import:${me.id}`, 20, 60 * 60_000)) return NextResponse.json({ error: "Too many tries in an hour. Please wait a little." }, { status: 429 });
  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const mode = b.mode === "photo" ? "photo" : b.mode === "suggest" ? "suggest" : b.mode === "photos" ? "photos" : "text";
  // Many product photos at once (owner, 2 Nov 2026 — instead of Instagram, which does not let its photos be taken): each photo is ONE
  // product; the AI names it from what it sees, and the photo becomes that product's photo.
  if (mode === "photos") {
    const urls = (Array.isArray(b.image_urls) ? b.image_urls : []).filter((u): u is string => isOwnMedia(u, me.id)).slice(0, 12);
    if (!urls.length) return NextResponse.json({ error: "Choose your product photos first." }, { status: 400 });
    try {
      const shots = await Promise.all(urls.map(async (u) => {
        const r = await fetch(u, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
        if (!r?.ok) return null;
        const raw = Buffer.from(await r.arrayBuffer());
        if (raw.length > MAX_PHOTO) return null;
        return sharp(raw, { failOn: "none", limitInputPixels: 80_000_000 }).rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer().catch(() => null);
      }));
      const parts: Record<string, unknown>[] = [];
      const idx: number[] = [];
      shots.forEach((x, i) => { if (x) { parts.push({ text: `Photo ${idx.length + 1}:` }, { inlineData: { mimeType: "image/jpeg", data: x.toString("base64") } }); idx.push(i); } });
      if (!idx.length) return NextResponse.json({ error: "The photos could not be opened. Please choose them again." }, { status: 400 });
      const trade = S(b.trade, 60);
      const prompt = `Each photo above shows ONE product or service of an Indian ${trade || "shop"}. For each photo give what a customer would call it.
Return ONLY JSON: {"items":[{"n":1,"name":"","price":"","category":""}]} — one entry per photo, "n" = the photo number. name: short and plain (at most 5 words; a brand or label printed on it may be used, never invent one; English unless the label is in another script). price: only if a price is clearly printed in the photo, else "". category: a short group (e.g. "Sweets", "Shirts"), else "".`;
      const { text } = await geminiComplete({ apiKey: key, tag: "product-import:photos", maxOutputTokens: 1500, temperature: 0, json: true, contents: [{ role: "user", parts: [...parts, { text: prompt }] }] } as Parameters<typeof geminiComplete>[0]);
      const v = parse(text) as { items?: unknown } | unknown[] | null;
      const list = (Array.isArray(v) ? v : (v as { items?: unknown } | null)?.items) as unknown[] | undefined;
      const seen = new Set<string>();
      const items: Item[] = [];
      idx.forEach((orig, k) => {
        const o = ((Array.isArray(list) ? list : []).find((x) => Number((x as Record<string, unknown>)?.n) === k + 1) ?? {}) as Record<string, unknown>;
        let name = S(o.name, 60) || `Product ${k + 1}`;
        if (seen.has(name.toLowerCase())) name = `${name} ${k + 1}`.slice(0, 60);
        seen.add(name.toLowerCase());
        items.push({ name, price: money(o.price), category: S(o.category, 30), photo: urls[orig] });
      });
      return NextResponse.json({ items });
    } catch (e) {
      console.log("[product-import] failed", mode, e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300));
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
    }
  }
  try {
    let prompt = "", parts: Record<string, unknown>[] = [];
    if (mode === "text") {
      const text = S(b.text, 6000);
      if (text.length < 2) return NextResponse.json({ error: "Type or paste your list first." }, { status: 400 });
      prompt = `A shop owner pasted this list of what they sell (one item per line, maybe with prices; any language):\n"""${String(b.text ?? "").slice(0, 6000)}"""\nPick out each item. ${RULES}`;
    } else if (mode === "photo") {
      const url = b.image_url;
      if (!isOwnMedia(url, me.id)) return NextResponse.json({ error: "That photo could not be used. Please upload it again." }, { status: 400 });
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return NextResponse.json({ error: "The photo could not be opened. Please upload it again." }, { status: 400 });
      // A price-list photo is a few MB at most (the page shrinks it before it goes up): anything much bigger is not read.
      if (Number(r.headers.get("content-length") || 0) > MAX_PHOTO) return NextResponse.json({ error: "That photo is too big. Please take it again, a little smaller." }, { status: 413 });
      const raw = Buffer.from(await r.arrayBuffer());
      if (raw.length > MAX_PHOTO) return NextResponse.json({ error: "That photo is too big. Please take it again, a little smaller." }, { status: 413 });
      const small = await sharp(raw, { failOn: "none", limitInputPixels: 80_000_000 }).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      parts = [{ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } }];
      prompt = `This is a photo of a price list, menu, rate card or catalogue of an Indian shop. Read every item on it. ${RULES}`;
    } else {
      const trade = S(b.trade, 60) || "shop";
      const city = S(b.city, 40);
      prompt = `List the 12 most common things a "${trade}"${city ? ` in ${city}, India` : " in India"} sells or offers, by their everyday names in India (as customers say them). They are only suggestions the owner will tick, so give no prices (price must be ""). Use the category field for a short group name. ${RULES}`;
    }
    const { text } = await geminiComplete({ apiKey: key, tag: `product-import:${mode}`, maxOutputTokens: 3000, temperature: mode === "suggest" ? 0.4 : 0, json: true, contents: [{ role: "user", parts: [...parts, { text: prompt }] }] } as Parameters<typeof geminiComplete>[0]);
    const v = parse(text) as { items?: unknown } | unknown[] | null;
    const items = clean(Array.isArray(v) ? v : (v as { items?: unknown } | null)?.items);
    if (mode === "suggest") items.forEach((x) => { x.price = ""; });
    if (!items.length) return NextResponse.json({ error: mode === "photo" ? "No items could be read from that photo. Try a clearer, straight photo." : mode === "suggest" ? "No suggestions right now. Please add them yourself." : "No items found in that text." }, { status: 422 });
    return NextResponse.json({ items });
  } catch (e) {
    // Said in the server log, so a failing read can be told apart (seen live, 11 Nov 2026: "Type a list" and "Ideas for me" both failed).
    console.log("[product-import] failed", mode, e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300));
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}
