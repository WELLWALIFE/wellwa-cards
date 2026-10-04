// POST (bearer) { photo_url, product, category } → 4 AI product photos
// (lifestyle, alt angle, marketplace white-bg, in-context) from ONE uploaded
// product photo — no video, no scenes, just fast catalog/social-ready images.
// Up to 5 labelled reference photos (front, left, right, top, back) keep the product faithful. Cost: 5 credits per photo, 1–4 photos.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { serviceHeaders, SUPA_URL } from "@/lib/admin-guard";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";
const IMG_MODEL = process.env.IMG_MODEL || "gemini-3.1-flash-lite-image"; // the lite image model everywhere (owner, 4 Oct 2026)
export const maxDuration = 120;
/** Owner's price (2026-09-17): 5 credits per photo; the user picks which of the 4 shots to make. A failed shot is refunded. */
const PER_PHOTO = 5;

type Shot = { key: string; label: string; ratio?: "1:1" | "4:5" | "9:16" | "4:3"; prompt: (p: string, c: string) => string };
const NO_TEXT = "ABSOLUTELY NO TEXT, letters, numbers, logos or watermarks anywhere in the image.";
const PRESETS: Record<string, { label: string; shots: Shot[] }> = {
  lifestyle: { label: "Lifestyle", shots: [
    { key: "lifestyle", label: "Lifestyle", prompt: (p, c) => `Photorealistic lifestyle photograph: the EXACT product from the reference image, in natural everyday use by a real Indian person or in an Indian home/shop relevant to "${c || p}". Real setting, soft natural daylight, shallow depth of field. ${NO_TEXT}` },
    { key: "angle", label: "Different angle", prompt: () => `Photorealistic close-up product photograph of the EXACT product from the reference image, shown from a different angle (three-quarter or top-down view), clean softly-blurred background, studio-quality lighting, product tack-sharp. ${NO_TEXT}` },
    { key: "white", label: "Marketplace (white bg)", prompt: () => `Photorealistic e-commerce product photograph: the EXACT product from the reference image, centered, pure white seamless background (#FFFFFF), soft natural shadow beneath, no props, catalog/marketplace listing style. ${NO_TEXT}` },
    { key: "scene", label: "In a setting", prompt: (p, c) => `Photorealistic photograph: the EXACT product from the reference image placed attractively in a real Indian setting relevant to "${c || p}" (a shelf, table, counter, or outdoor spot as fits the product), warm inviting natural light, professional composition. ${NO_TEXT}` },
  ] },
  marketplace: { label: "Marketplace (Amazon / Flipkart)", shots: [
    { key: "front", label: "Front, white bg", prompt: () => `Photorealistic e-commerce main image: the EXACT product from the reference image, straight-on front view, perfectly centered, filling about 85% of the frame, pure white seamless background (#FFFFFF), soft even studio light, faint natural shadow, no props. ${NO_TEXT}` },
    { key: "three-quarter", label: "3/4 angle, white bg", prompt: () => `Photorealistic e-commerce image: the EXACT product from the reference image, three-quarter angle view showing depth, pure white background (#FFFFFF), even studio lighting, tack-sharp, no props. ${NO_TEXT}` },
    { key: "detail", label: "Close-up detail", prompt: () => `Photorealistic macro close-up of the most important detail/feature of the EXACT product from the reference image (buttons, texture, display, material), pure white background, studio light, sharp. ${NO_TEXT}` },
    { key: "scale", label: "In use / scale", prompt: (p, c) => `Photorealistic image showing the EXACT product from the reference image in use or next to a hand for scale, clean light background, marketplace secondary-image style, relevant to "${c || p}". ${NO_TEXT}` },
  ] },
  model: { label: "With a model", shots: [
    { key: "model-f", label: "Woman using it", prompt: (p, c) => `Photorealistic photograph of a real Indian woman (around 30, natural look) happily using or holding the EXACT product from the reference image in a real Indian home, relevant to "${c || p}", natural daylight, candid feel, product clearly visible and sharp. ${NO_TEXT}` },
    { key: "model-m", label: "Man using it", prompt: (p, c) => `Photorealistic photograph of a real Indian man (around 35) using or presenting the EXACT product from the reference image in a real setting relevant to "${c || p}", warm natural light, product clearly visible. ${NO_TEXT}` },
    { key: "family", label: "Family", prompt: (p, c) => `Photorealistic photograph of a happy Indian family with the EXACT product from the reference image in their home, relevant to "${c || p}", bright natural light, product in focus. ${NO_TEXT}` },
    { key: "hands", label: "Hands close-up", prompt: () => `Photorealistic close-up of hands holding or operating the EXACT product from the reference image, soft background, product sharp and true to the reference. ${NO_TEXT}` },
  ] },
  social: { label: "Social (Insta / Story)", shots: [
    { key: "flatlay", label: "Flat-lay", ratio: "1:1", prompt: (p, c) => `Photorealistic top-down flat-lay: the EXACT product from the reference image with 2-3 tasteful props relevant to "${c || p}", pastel or textured backdrop, soft light, Instagram aesthetic. ${NO_TEXT}` },
    { key: "story", label: "Story (9:16)", ratio: "9:16", prompt: (p, c) => `Photorealistic vertical story image: the EXACT product from the reference image as the hero, stylish minimal background with room at top and bottom for text later, relevant to "${c || p}", premium look. ${NO_TEXT}` },
    { key: "feed", label: "Feed (4:5)", ratio: "4:5", prompt: (p, c) => `Photorealistic portrait-format image: the EXACT product from the reference image on a styled surface with soft directional light and a subtle colour backdrop, relevant to "${c || p}". ${NO_TEXT}` },
    { key: "minimal", label: "Minimal", ratio: "1:1", prompt: () => `Photorealistic minimal product image: the EXACT product from the reference image, single pastel background colour, soft shadow, lots of negative space, premium brand feel. ${NO_TEXT}` },
  ] },
};

async function fetchRef(url: string, userId: string): Promise<Buffer | null> {
  const base = `${SUPA_URL}/storage/v1/object/public/media/`;
  if (!url.startsWith(base) || !url.includes(userId)) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= 8 * 1024 * 1024 ? buf : null;
  } catch { return null; }
}

async function genShot(key: string, prompt: string, refs: { buf: Buffer; view: string }[], ratio: "1:1" | "4:5" | "9:16" | "4:3" = "1:1"): Promise<Buffer | null> {
  try {
    const r = await fetch(`${GEMINI}/${IMG_MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [...refs.flatMap((r, i) => [{ text: `Image ${i + 1}: the product, ${r.view ? r.view + (r.view === "left" || r.view === "right" ? " side" : "") + " view" : "another view"}` }, { inlineData: { mimeType: "image/jpeg", data: r.buf.toString("base64") } }]), { text: (refs.length > 1 ? `The ${refs.length} reference images show the SAME single product from different sides — use them together to keep its shape, colours, parts and printing exact from whatever angle you show it. ` : "") + prompt + " The product has only the parts the references show; any screen on it shows no invented words." }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio } } }),
    });
    const d = await r.json().catch(() => null);
    const part = (d?.candidates?.[0]?.content?.parts ?? []).find((x: { inlineData?: { data?: string } }) => x.inlineData?.data);
    return part?.inlineData?.data ? Buffer.from(part.inlineData.data, "base64") : null;
  } catch { return null; }
}

async function upload(userId: string, key: string, ts: number, png: Buffer): Promise<string | null> {
  const path = `poster/${userId}/photoshoot-${key}-${ts}.png`;
  const r = await fetch(`${SUPA_URL}/storage/v1/object/media/${path}`, {
    method: "POST", headers: { ...serviceHeaders(), "Content-Type": "image/png", "x-upsert": "true" }, body: new Uint8Array(png),
  }).catch(() => null);
  return r?.ok ? `${SUPA_URL}/storage/v1/object/public/media/${path}` : null;
}

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const b = await request.json().catch(() => ({}));
  const urls0: string[] = (Array.isArray(b.photo_urls) ? b.photo_urls : [b.photo_url]).filter((u: unknown): u is string => typeof u === "string" && !!u).slice(0, 5);
  const views0: string[] = (Array.isArray(b.views) ? b.views : []).map((v: unknown) => (["front", "left", "right", "top", "back"].includes(String(v)) ? String(v) : ""));
  const product = String(b.product ?? "").trim().slice(0, 60);
  const category = String(b.category ?? "").trim().slice(0, 60);
  const allShots = (PRESETS[String(b.preset)] ?? PRESETS.lifestyle).shots;
  const want: string[] = Array.isArray(b.shots) ? b.shots.map(String) : [];
  const shots = want.length ? allShots.filter((x) => want.includes(x.key)) : allShots;
  if (!shots.length) return NextResponse.json({ error: "Choose at least one shot." }, { status: 400 });
  const SHOOT_CREDITS = PER_PHOTO * shots.length;
  if (!urls0.length) return NextResponse.json({ error: "Product photo is required." }, { status: 400 });
  const fetched = await Promise.all(urls0.map((u) => fetchRef(u.split("?")[0], me.id)));
  const refs = fetched.map((buf, i) => (buf ? { buf, view: views0[i] || "" } : null)).filter((x): x is { buf: Buffer; view: string } => !!x);
  if (!refs.length) return NextResponse.json({ error: "Could not read the uploaded photo." }, { status: 400 });

  const ts = Date.now(); const ref = `shoot:${me.id}:${ts}`;
  const spend = await restAsService(`rpc/spend_credits`, { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: SHOOT_CREDITS, p_reason: "photoshoot", p_ref: ref }) });
  if (!spend.ok) return NextResponse.json({ error: spend.text.includes("INSUFFICIENT_CREDITS") ? `Not enough credits (${SHOOT_CREDITS} needed).` : "Could not charge credits.", cost: SHOOT_CREDITS }, { status: 402 });
  const bufs = await Promise.all(shots.map((s) => genShot(s.key, s.prompt(product, category), refs, s.ratio ?? "1:1")));
  const urls = await Promise.all(bufs.map((buf, i) => (buf ? upload(me.id, shots[i].key, ts, buf) : Promise.resolve(null))));
  const photos = shots.map((s, i) => ({ key: s.key, label: s.label, url: urls[i] })).filter((p): p is { key: string; label: string; url: string } => !!p.url);
  const failed = shots.length - photos.length;
  if (failed > 0) await restAsService(`rpc/grant_credits`, { method: "POST", body: JSON.stringify({ p_user: me.id, p_amount: PER_PHOTO * failed, p_reason: "photoshoot-refund", p_ref: ref }) });
  if (!photos.length) return NextResponse.json({ error: "AI did not respond. Your credits were returned — please try again." }, { status: 502 });
  return NextResponse.json({ photos, partial: failed > 0, charged: PER_PHOTO * photos.length });
}
