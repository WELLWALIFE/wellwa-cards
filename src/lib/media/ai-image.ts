import "server-only";
// One AI photo from a text prompt (Gemini image model), stored in public media storage.
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-image";
export const NO_TEXT = "ABSOLUTELY NO TEXT, letters, numbers, logos or watermarks anywhere in the image.";

export async function aiImage(prompt: string, ratio: "16:9" | "4:3" | "1:1" | "4:5" = "16:9"): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`${GEMINI}/${IMG_MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.timeout(90_000),
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt} ${NO_TEXT}` }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }),
    });
    const d = await r.json().catch(() => null);
    const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: { data?: string } }) => x.inlineData?.data);
    return part?.inlineData?.data ? Buffer.from(part.inlineData.data, "base64") : null;
  } catch { return null; }
}

export async function storeImage(userId: string, name: string, png: Buffer): Promise<string | null> {
  const path = `poster/${userId}/${name}-${Date.now()}.png`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${path}`, {
    method: "POST", headers: { ...serviceHeaders(), "Content-Type": "image/png", "x-upsert": "true" }, body: new Uint8Array(png),
  }).catch(() => null);
  return r?.ok ? `${SUPA_URL}/storage/v1/object/public/media/${path}` : null;
}
