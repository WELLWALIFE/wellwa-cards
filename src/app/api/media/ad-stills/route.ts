// POST { visual, photos[] } → { url } — one storyboard picture for a Pro video shot (owner, 27 Oct 2026: see the
// shots BEFORE paying for the video). The same picture model and the same strict "this exact product" words as the
// worker; the picture is saved and later becomes the first frame Veo animates. Free to the owner (~₹3 to us), so it
// is rate-limited.
import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireUser, sameOrigin, rateLimited, clientKey } from "@/lib/api-security";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

export const maxDuration = 90;
const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-lite-image";
const OWN = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/media\//;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const session = await requireUser(); if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY; if (!key) return NextResponse.json({ error: "AI is not configured yet." }, { status: 503 });
  if (rateLimited(clientKey(request, `ad-stills:${session.user.id}`), 24, 30 * 60_000)) return NextResponse.json({ error: "Too many pictures for now — please wait a few minutes." }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const visual = String(b.visual ?? "").trim().slice(0, 1400);
  if (visual.length < 20) return NextResponse.json({ error: "Describe the shot first." }, { status: 400 });
  const urls = (Array.isArray(b.photos) ? b.photos : []).filter((u: unknown): u is string => typeof u === "string" && OWN.test(u) && u.length < 500).slice(0, 3);
  const refs: { inlineData: { mimeType: string; data: string } }[] = [];
  for (const u of urls) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(10_000) }); if (!r.ok) continue; const small = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(1024, 1024, { fit: "inside" }).png().toBuffer(); refs.push({ inlineData: { mimeType: "image/png", data: small.toString("base64") } }); } catch { /* skip */ }
  }
  const prompt = `Photorealistic advertising still (9:16)${refs.length ? ` featuring the product shown in the first ${refs.length} reference image${refs.length > 1 ? "s (same product, different angles)" : ""}` : ""}. Premium TV-commercial look: cinematic lighting, shallow depth of field, the product the hero of the frame and sharp. STRICT: the product must look EXACTLY like the reference — same shape, colours, panel, buttons, hose; one unit only. Scene: ${visual}. ALL PEOPLE ARE INDIAN (South Asian features, Indian clothing/home). Natural skin, realistic lighting, 35mm photo look. ABSOLUTELY NO TEXT, letters, numbers, captions or watermarks anywhere.`;
  let png: Buffer | null = null;
  for (let t = 0; t < 2 && !png; t++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [...refs, { text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } } }), signal: AbortSignal.timeout(70_000) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    const part = (j.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: { data?: string } }) => x.inlineData?.data);
    if (part) png = await sharp(Buffer.from(part.inlineData.data, "base64")).resize(1080, 1920, { fit: "cover" }).png().toBuffer();
  }
  if (!png) return NextResponse.json({ error: "The picture could not be made — please try again." }, { status: 502 });
  const keyPath = `ai-media/${session.user.id}/still-${crypto.randomUUID()}.png`;
  const up = await fetch(`${SUPA_URL}/storage/v1/object/media/${keyPath}`, { method: "POST", headers: { ...serviceHeaders(), "Content-Type": "image/png", "x-upsert": "true", "Cache-Control": "max-age=31536000" }, body: new Uint8Array(png) });
  if (!up.ok) return NextResponse.json({ error: "The picture could not be saved — please try again." }, { status: 502 });
  return NextResponse.json({ url: `${SUPA_URL}/storage/v1/object/public/media/${keyPath}` });
}
