// "AI se bharo": look at the product photo (+ name) and draft benefits/offer lines.
import { NextResponse } from "next/server";
import sharp from "sharp";
import { userFromRequest } from "@/lib/poster-server";
import { isOurMedia } from "@/lib/card-inputs";
import { rateLimited } from "@/lib/api-security";

export const maxDuration = 60;
const MAX_BODY = 20_000;               // bytes: a name, a photo address and a language
const MAX_PHOTO = 12 * 1024 * 1024;    // bytes of the picture the AI is shown
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const key = process.env.GEMINI_API_KEY; if (!key) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return NextResponse.json({ error: "That request is too big." }, { status: 413 });
  if (rateLimited(`product-ai:${me.id}`, 40, 60 * 60_000)) return NextResponse.json({ error: "Too many tries in an hour. Please wait a little." }, { status: 429 });
  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").slice(0, 80), photo = typeof b.photo_url === "string" ? b.photo_url : "";
  const parts: Record<string, unknown>[] = [];
  // Only a picture in our own storage is opened (never an address the caller makes up), within a time and a size, and shown small.
  if (/^https:\/\//.test(photo) && isOurMedia(photo)) {
    try {
      const r = await fetch(photo, { signal: AbortSignal.timeout(15_000) });
      if (r.ok && Number(r.headers.get("content-length") || 0) <= MAX_PHOTO) {
        const raw = Buffer.from(await r.arrayBuffer());
        if (raw.length <= MAX_PHOTO) {
          const small = await sharp(raw, { failOn: "none", limitInputPixels: 80_000_000 }).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
          parts.push({ inlineData: { mimeType: "image/jpeg", data: small.toString("base64") } });
        }
      }
    } catch { /* skip */ }
  }
  // One language for everything the owner sees (the app is in English unless they chose Hindi).
  const hi = b.lang === "hi";
  const L = hi ? "simple Hindi in Devanagari script" : "simple English";
  parts.push({ text: `You write short, truthful Indian ad copy. Product: "${name || "(see photo)"}". Look at the photo if given.
Write everything in ${L} only — never mix languages. Return JSON:
{"name": "<clean product name>", "benefits": ["<one full benefit line, 5 to 9 words>", ... exactly 4 lines, no medical, health-cure or income claims, no invented numbers], "offer": "<one realistic offer line, e.g. ${hi ? "'फ्री होम डेमो'" : "'Free home demo'"} — never invent a price or discount>", "tagline": "<3-6 word tagline>"}` });
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }), signal: AbortSignal.timeout(45_000) });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json(JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"));
  } catch { return NextResponse.json({ error: "AI reply unreadable" }, { status: 502 }); }
}
