import "server-only";
// One AI photo from a text prompt (Gemini image model), stored in public media storage.
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
// The lite image model everywhere (owner's call, 4 Oct 2026: "sasta hai aur achha bhi"): half the price a picture.
export const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-lite-image";
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

/** Pictures for a card built from a REFERENCE website.
 *
 *  A reference site is somebody else's: its photographs are theirs and are never copied onto a customer's
 *  card — that would hand our customer someone else's copyright problem. What we take from it is the look,
 *  and these pictures are made fresh in that look, of the owner's OWN trade. The owner replaces them with
 *  their own photos whenever they like; until then the card is not empty.
 *
 *  Best effort: a null or a short list simply means the card falls back to the trade's stock photos.
 */
export async function referenceImages(
  userId: string,
  opts: { trade: string; city?: string; dark?: boolean; color?: string; count?: number; /** "Hyundai": the pictures show that brand's kind of thing (no logos or text, as ever). */ brand?: string },
): Promise<string[]> {
  const brand = (opts.brand || "").trim().slice(0, 40);
  // "Hyundai auto showroom" — the brand's cars, phones or paint, not the trade's in general.
  const trade = `${brand ? `${brand} ` : ""}${opts.trade || "small business"}`.slice(0, 80);
  const where = opts.city ? ` in ${opts.city.slice(0, 40)}, India` : " in India";
  const mood = opts.dark
    ? "Moody, low-key lighting against a dark background; rich shadows, one warm light source."
    : "Bright, airy daylight; clean uncluttered background, soft natural shadows.";
  const accent = opts.color ? ` Subtle colour accents close to ${opts.color}.` : "";
  const brandLine = brand ? ` The products shown are unmistakably ${brand}'s — their real shapes and styling — but with no logo, badge, lettering or text visible anywhere.` : "";
  const briefs = [
    `Photorealistic wide banner photograph of a ${trade}${where}.${brandLine} ${mood}${accent} Composed with clear empty space on one side so a headline can sit there. Editorial quality, shot on a 35mm lens.`,
    `Photorealistic close detail photograph from a ${trade}${where} — the work itself, hands or the product in use.${brandLine} ${mood}${accent} Shallow depth of field.`,
    `Photorealistic photograph of the place a ${trade}${where} works from, seen from inside.${brandLine} ${mood}${accent} Welcoming and tidy, no clutter.`,
  ];
  const want = Math.max(1, Math.min(3, opts.count ?? 2));
  const made = await Promise.all(
    briefs.slice(0, want).map(async (prompt, i) => {
      const png = await aiImage(prompt, i === 0 ? "16:9" : "4:3");
      return png ? storeImage(userId, `ref-${i + 1}`, png) : null;
    }),
  );
  return made.filter((u): u is string => !!u);
}
