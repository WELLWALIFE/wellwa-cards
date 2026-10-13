import "server-only";
// One AI photo from a text prompt (Gemini image model), stored in public media storage.
import sharp from "sharp";
import { SUPA_URL, serviceHeaders } from "@/lib/admin-guard";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
// The lite image model everywhere (owner's call, 4 Oct 2026: "sasta hai aur achha bhi"): half the price a picture.
export const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-lite-image";
/** What every picture made for a website must look like (owner, 14 Oct 2026: "jo image ai se bane wo perfect ho, aaj ke dor ki,
 *  old type ki nahi"): the first AI banners were dark, gritty and dusty — a 1990s shop. The model has no negative prompt, so the
 *  "never" list sits in the prompt itself. */
export const MODERN_LOOK = "Contemporary commercial photography of the kind a premium brand puts on its website in 2026: bright, airy natural daylight through large windows, crisp sharp detail, a clean modern space that is tidy and well organised, natural true-to-life colour, fresh and current, shot on a modern full-frame camera with a 35mm or 50mm lens. It must never look old-fashioned, dusty, gritty, vintage, sepia, dim, grainy, cluttered, over-processed or like a dark cave. Modern Indian business, well dressed people in current clothes, polished but real.";
/** A scene for a trade, so the picture shows the right place (key = poster-categories key). */
const SCENES: Record<string, string> = {
  hardware: "a modern, well-lit hardware, paint and sanitary store: neat floor-to-ceiling shelves, rows of paint tins with a colour-mixing machine, tidy displays of taps and fittings, wide clean aisles",
  sweets: "a bright modern mithai shop: glass counters with neatly arranged sweets on clean trays, warm but clean light, gift boxes stacked tidily",
  kirana: "a clean modern grocery store: well-lit aisles, neatly stocked shelves, fresh produce on display",
  garments: "a modern clothing showroom: tidy racks, mannequins in current styles, bright even light",
  furniture: "a modern furniture showroom: styled sofas and dining sets in a bright airy space with large windows",
  salon: "a modern salon: clean styling stations, big mirrors, soft daylight, calm tidy surfaces",
  restaurant: "a modern restaurant interior: clean tables, plants, natural light, plated food that looks fresh",
  doctor: "a modern clinic: clean consulting room, a friendly doctor in a white coat, bright calm light",
  dentist: "a modern dental clinic: clean chair and equipment, bright calm light",
  mobile: "a modern mobile phone store: glass display tables, current phones neatly shown, bright light",
  jewellery: "a modern jewellery showroom: glass cases with beautifully lit pieces, clean elegant surroundings",
  gym: "a modern gym: clean equipment, big windows, bright energetic light",
  electrician: "a tidy electrical shop: organised wiring, switches and lights on clean display",
  interior: "a modern interior-design studio: styled rooms, material samples neatly arranged, bright light",
};
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

/** A picture the website will show is stored as a compact JPEG, at most 1600 px wide: the image model hands back a 1-2 MB PNG,
 *  and a page of six of them is slow on a phone and heavy on our server (owner, 14 Oct 2026: "image size auto compact"). */
export async function compactImage(src: Buffer, maxWidth = 1600): Promise<Buffer> {
  try { return await sharp(src).rotate().resize({ width: maxWidth, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(); } catch { return src; }
}

export async function storeImage(userId: string, name: string, png: Buffer): Promise<string | null> {
  const small = await compactImage(png);
  const jpeg = small !== png;
  const path = `poster/${userId}/${name}-${Date.now()}.${jpeg ? "jpg" : "png"}`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${path}`, {
    method: "POST", headers: { ...serviceHeaders(), "Content-Type": jpeg ? "image/jpeg" : "image/png", "x-upsert": "true" }, body: new Uint8Array(small),
    signal: AbortSignal.timeout(20_000),
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
  opts: { trade: string; city?: string; dark?: boolean; color?: string; /** How many in all (banner first when `banner` is not false). */ count?: number; /** false: no banner, gallery pictures only. */ banner?: boolean; /** "Hyundai": the pictures show that brand's kind of thing (no logos or text, as ever). */ brand?: string; /** What the owner asked the picture to show, in their words or the AI's brief from them. */ wish?: string },
): Promise<string[]> {
  const brand = (opts.brand || "").trim().slice(0, 40);
  // "Hyundai auto showroom" — the brand's cars, phones or paint, not the trade's in general.
  const trade = `${brand ? `${brand} ` : ""}${opts.trade || "small business"}`.slice(0, 80);
  const where = opts.city ? ` in ${opts.city.slice(0, 40)}, India` : " in India";
  const mood = `${MODERN_LOOK} ${opts.dark ? "Slightly deeper, richer tones with soft evening window light — still clean and contemporary, never gloomy." : "Bright and airy, clean uncluttered background, soft natural shadows."}`;
  const accent = opts.color ? ` Subtle colour accents close to ${opts.color}.` : "";
  const brandLine = brand ? ` The products shown are unmistakably ${brand}'s — their real shapes and styling — but with no logo, badge, lettering or text visible anywhere.` : "";
  const wish = (opts.wish || "").trim().replace(/\s+/g, " ").slice(0, 600);
  const wishLine = wish ? ` THE OWNER ASKS FOR THIS, AND IT COMES FIRST: ${wish}` : "";
  const briefs = [
    `Photorealistic wide banner photograph of a ${trade}${where}.${brandLine}${wishLine} ${mood}${accent} Composed with clear empty space on one side so a headline can sit there.`,
    `Photorealistic close detail photograph from a ${trade}${where} — the work itself, hands or the product in use.${brandLine}${wishLine} ${mood}${accent} Shallow depth of field.`,
    `Photorealistic photograph of the place a ${trade}${where} works from, seen from inside.${brandLine}${wishLine} ${mood}${accent} Welcoming and tidy, no clutter.`,
  ];
  // Gallery pictures beyond the first two: other angles of the same business, so six do not look like one.
  const more = [
    `Photorealistic photograph of customers being served at a ${trade}${where}, candid, mid-action.${brandLine}${wishLine} ${mood}${accent}`,
    `Photorealistic photograph of the team at work in a ${trade}${where}, natural and unposed.${brandLine}${wishLine} ${mood}${accent}`,
    `Photorealistic photograph of the products or the finished work of a ${trade}${where}, arranged neatly, from above.${brandLine}${wishLine} ${mood}${accent}`,
    `Photorealistic photograph of the entrance of a ${trade}${where}, inviting, early evening light.${brandLine}${wishLine} ${mood}${accent}`,
    `Photorealistic close photograph of textures and details at a ${trade}${where} — materials, tools or ingredients.${brandLine}${wishLine} ${mood}${accent}`,
    `Photorealistic photograph of a happy customer leaving a ${trade}${where}, candid.${brandLine}${wishLine} ${mood}${accent}`,
  ];
  const withBanner = opts.banner !== false;
  const want = Math.max(1, Math.min(7, opts.count ?? 2));
  const list = (withBanner ? briefs : briefs.slice(1)).concat(more).slice(0, want);
  // Three at a time: the image model is slow and seven in one go would take minutes.
  const made: (string | null)[] = [];
  for (let i = 0; i < list.length; i += 3) {
    const chunk = await Promise.all(list.slice(i, i + 3).map(async (prompt, k) => {
      const n = i + k;
      const png = await aiImage(prompt, withBanner && n === 0 ? "16:9" : "4:3");
      return png ? storeImage(userId, `ref-${n + 1}`, png) : null;
    }));
    made.push(...chunk);
  }
  return made.filter((u): u is string => !!u);
}

/** ONE picture made for ONE place on the website: what that place needs (a wide banner with room for the headline, a picture
 *  beside the About text, a gallery tile of a named thing), in the website's own mood and colour, of THIS trade and city.
 *  Null when the model gave nothing. */
export async function slotImage(
  userId: string,
  opts: { kind: "banner" | "about" | "gallery"; trade: string; tradeKey?: string; city?: string; label?: string; dark?: boolean; color?: string; brand?: string },
): Promise<string | null> {
  const trade = `${opts.brand ? `${opts.brand.slice(0, 40)} ` : ""}${opts.trade || "small business"}`.slice(0, 80);
  const where = opts.city ? ` in ${opts.city.slice(0, 40)}, India` : " in India";
  // Light unless the website itself is dark: and even then rich, not gloomy.
  const mood = `${MODERN_LOOK} ${opts.dark ? "Slightly deeper, richer tones with soft evening window light — still clean and contemporary, never gloomy." : "Bright and airy, clean uncluttered background, soft natural shadows."}`;
  const accent = opts.color ? ` Subtle colour accents close to ${opts.color}.` : "";
  const label = (opts.label || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const scene = (opts.tradeKey && SCENES[opts.tradeKey]) || `a modern ${trade}`;
  const prompt =
    opts.kind === "banner"
      ? `Photorealistic wide banner photograph of ${scene}${where}. ${mood}${accent} Composed with a large area of calm, clean empty space on the left third so a headline can sit there; the subject is on the right. Looks like the hero image of a leading brand's website.`
      : opts.kind === "about"
      ? `Photorealistic photograph of the people and the place of ${scene}${where}: the owner or two team members, smiling and confident, in current smart-casual clothes, working or talking with a customer in the clean space. A portrait-friendly composition that sits beside a paragraph of text. ${mood}${accent}`
      : `Photorealistic photograph for a website gallery tile${label ? ` called "${label}"` : ""} of ${scene}${where}${label ? ` — it must clearly show ${label}, nothing else` : " — the products, the work or the place"}. ${mood}${accent} One clear subject, sharp, tidy background, looks like current premium product photography.`;
  const png = await aiImage(prompt, opts.kind === "banner" ? "16:9" : "4:3");
  // "ref-N" is how the app recognises a picture it made itself.
  return png ? storeImage(userId, `ref-${opts.kind === "banner" ? 1 : opts.kind === "about" ? 2 : 3}`, png) : null;
}
