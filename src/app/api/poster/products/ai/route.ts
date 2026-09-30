// "AI se bharo": look at the product photo (+ name) and draft benefits/offer lines.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const key = process.env.GEMINI_API_KEY; if (!key) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? "").slice(0, 80), photo = typeof b.photo_url === "string" ? b.photo_url : "";
  const parts: Record<string, unknown>[] = [];
  if (/^https:\/\//.test(photo)) {
    try { const r = await fetch(photo); if (r.ok) parts.push({ inlineData: { mimeType: r.headers.get("content-type") || "image/png", data: Buffer.from(await r.arrayBuffer()).toString("base64") } }); } catch { /* skip */ }
  }
  // One language for everything the owner sees (the app is in English unless they chose Hindi).
  const hi = b.lang === "hi";
  const L = hi ? "simple Hindi in Devanagari script" : "simple English";
  parts.push({ text: `You write short, truthful Indian ad copy. Product: "${name || "(see photo)"}". Look at the photo if given.
Write everything in ${L} only — never mix languages. Return JSON:
{"name": "<clean product name>", "benefits": ["<one full benefit line, 5 to 9 words>", ... exactly 4 lines, no medical, health-cure or income claims, no invented numbers], "offer": "<one realistic offer line, e.g. ${hi ? "'फ्री होम डेमो'" : "'Free home demo'"} — never invent a price or discount>", "tagline": "<3-6 word tagline>"}` });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.4 } }) });
  const j = await r.json().catch(() => ({}));
  try { return NextResponse.json(JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}")); } catch { return NextResponse.json({ error: "AI reply unreadable" }, { status: 502 }); }
}
